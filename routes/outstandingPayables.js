const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 pool

// Utility to safely handle empty array for SQL IN clause
function safeArray(arr) {
  return arr.length ? arr : [-1];
}

router.get('/api/outstanding-payables', async (req, res) => {
  try {
    const {
      searchTerm = '',
      supplierGroup = '',
      riskCategory = '',
      sortBy = 'amount',
      sortOrder = 'desc',
      limit = '100',
      offset = '0'
    } = req.query;

    // Construct search pattern (case-insensitive)
    const searchPattern = `%${(searchTerm || '').toLowerCase()}%`;

    // Fetch suppliers (ledgers)
    const supplierGroupFilter = supplierGroup ? 'AND lg.name = ?' : '';
    const params = supplierGroup ? [searchPattern, supplierGroup, parseInt(limit), parseInt(offset)] 
                                 : [searchPattern, parseInt(limit), parseInt(offset)];

    const suppliersSql = `
  SELECT 
    l.id, l.name, lg.name AS group_name, l.address, l.phone, l.email, l.gst_number AS gstin
  FROM ledgers l
  LEFT JOIN ledger_groups lg ON lg.id = l.group_id
  WHERE LOWER(l.name) LIKE ?
  ${supplierGroupFilter}
  LIMIT ? OFFSET ?
`;


    const [suppliers] = await pool.query(suppliersSql, params);

    if (suppliers.length === 0) {
      return res.json([]);
    }

    const supplierIds = suppliers.map(s => s.id);
    const safeIds = safeArray(supplierIds);

    // Fetch purchase invoices (voucher_type contains 'purchase' for suppliers’ bills)
    const purchaseSql = `
      SELECT vm.id AS voucher_id, vm.voucher_type, vm.voucher_number, vm.date,
             ve.ledger_id AS supplier_id,
             SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) as credit_amount,
             SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) as debit_amount,
             MAX(vm.due_date) AS due_date
      FROM voucher_main vm
      JOIN voucher_entries ve ON ve.voucher_id = vm.id
      WHERE vm.voucher_type LIKE '%purchase%'
      AND ve.ledger_id IN (?)
      GROUP BY vm.id, ve.ledger_id
    `;
    const [purchases] = await pool.query(purchaseSql, [safeIds]);

    // Fetch payment vouchers (receipt/payment) related to suppliers
    const paymentSql = `
      SELECT ve.ledger_id AS supplier_id,
             SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) as total_paid,
             MAX(vm.date) AS last_payment_date
      FROM voucher_main vm
      JOIN voucher_entries ve ON ve.voucher_id = vm.id
      WHERE vm.voucher_type IN ('receipt', 'payment')
      AND ve.ledger_id IN (?)
      GROUP BY ve.ledger_id
    `;
    const [payments] = await pool.query(paymentSql, [safeIds]);

    // Map payments for quick lookup
    const paymentsMap = new Map();
    payments.forEach(p => {
      paymentsMap.set(p.supplier_id, {
        totalPaid: p.total_paid,
        lastPaymentDate: p.last_payment_date,
      });
    });

    const today = new Date();

    const result = suppliers.map(supplier => {
      const supplierPurchases = purchases.filter(p => p.supplier_id === supplier.id);

      // Sum purchase amounts per supplier
      let totalPurchaseAmt = 0;
      let overdueAmt = 0;
      let currentAmt = 0;

      for (const purchase of supplierPurchases) {
        // Calculate amt = credit_amount - debit_amount per purchase voucher
        const amt = (purchase.credit_amount || 0) - (purchase.debit_amount || 0);
        totalPurchaseAmt += amt;

        if (purchase.due_date) {
          const dueDate = new Date(purchase.due_date);
          const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          if (daysOverdue > 0) overdueAmt += amt;
          else currentAmt += amt;
        } else {
          currentAmt += amt;
        }
      }

      // Payments data
      const payment = paymentsMap.get(supplier.id);
      const totalPaid = payment?.totalPaid || 0;
      const lastPaymentDate = payment?.lastPaymentDate || null;

      // Outstanding calculation
      const outstanding = totalPurchaseAmt - totalPaid;

      // Risk evaluation (simple thresholds)
      let riskCat = 'Low';
      if (overdueAmt > 500000) riskCat = 'Critical';
      else if (overdueAmt > 200000) riskCat = 'High';
      else if (overdueAmt > 50000) riskCat = 'Medium';

      // oldest bill date calculation (earliest purchase date)
      const oldestDate = supplierPurchases.length > 0
        ? supplierPurchases.reduce((min, p) => !min || p.date < min ? p.date : min, null)
        : null;

      const oldestBillDate = oldestDate ? new Date(oldestDate).toISOString().slice(0, 10) : '';
return {
  id: supplier.id.toString(),
  supplierName: supplier.name,
  supplierGroup: supplier.group_name || '',
  supplierAddress: supplier.address || '',
  supplierPhone: supplier.phone || '',
  supplierEmail: supplier.email || '',
  supplierGSTIN: supplier.gstin || '',
  totalOutstanding: Number(outstanding.toFixed(2)),
  currentDue: Number(currentAmt.toFixed(2)),
  overdue: Number(overdueAmt.toFixed(2)),
  creditLimit: 0,    // Set default to 0 as you do not have this info
  creditDays: 0,     // Set default to 0 as well
  lastPayment: lastPaymentDate ? { date: lastPaymentDate, amount: totalPaid } : undefined,
  oldestBillDate,
  totalBills: supplierPurchases.length,
  riskCategory: riskCat,
  ageingBreakdown: {
    '0-30': currentAmt,
    '31-60': 0,
    '61-90': 0,
    '90+': overdueAmt,
  },
};

    });

    // Sorting on the result list per sortBy and sortOrder
    if (['amount', 'overdue', 'supplier', 'risk'].includes(sortBy)) {
      const riskOrder = { Low: 1, Medium: 2, High: 3, Critical: 4 };
      result.sort((a,b) => {
        let cmp = 0;
        switch(sortBy){
          case 'amount': cmp = a.totalOutstanding - b.totalOutstanding; break;
          case 'overdue': cmp = a.overdue - b.overdue; break;
          case 'supplier': cmp = a.supplierName.localeCompare(b.supplierName); break;
          case 'risk': cmp = riskOrder[a.riskCategory] - riskOrder[b.riskCategory]; break;
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error fetching payables outstanding:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
