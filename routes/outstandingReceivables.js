const express = require('express');
const router = express.Router();
const pool = require('../db'); // your MySQL pool connection with promise support

// Util to safely handle array params for SQL IN clause
function safeArrayParams(arr) {
  if (Array.isArray(arr) && arr.length > 0) return arr;
  return [0]; // fallback to prevent SQL error with empty IN ()
}

router.get('/api/outstanding-receivables', async (req, res) => {
  try {
    const {
      searchTerm = '',
      customerGroup = '',
      riskCategory = '',
      sortBy = 'amount',
      sortOrder = 'desc',
      limit = 100,
      offset = 0,
    } = req.query;

    // Prepare search pattern for customer name
    const searchPattern = `%${(searchTerm).toLowerCase()}%`;

    // 1. Query customers with groups
    const groupsFilterSql = customerGroup ? 'AND lg.name = ?' : '';
    const groupsFilterParams = customerGroup ? [customerGroup] : [];

    const customersSql = `
      SELECT 
        l.id, l.name, lg.name AS group_name, l.address, l.phone, l.email, l.gst_number AS gstin
      FROM ledgers l
      LEFT JOIN ledger_groups lg ON lg.id = l.group_id
      WHERE LOWER(l.name) LIKE ?
      ${groupsFilterSql}
      LIMIT ? OFFSET ?
    `;

    const customersParams = [searchPattern, ...groupsFilterParams, Number(limit), Number(offset)];
    const [customers] = await pool.query(customersSql, customersParams);

    if (!customers.length) {
      return res.json([]);
    }

    const custIds = customers.map(c => c.id);

    // Defensive safe params for IN clause
    const safeCustIds = safeArrayParams(custIds);

    // 2. Fetch invoices (sales)
    const invoiceSql = `
      SELECT vm.id as voucher_id, vm.voucher_type, vm.voucher_number, vm.date,
        ve.ledger_id as customer_id,
        SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) AS debit_amount,
        SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS credit_amount,
        MAX(vm.due_date) AS due_date
      FROM voucher_main vm
      JOIN voucher_entries ve ON ve.voucher_id = vm.id
      WHERE vm.voucher_type LIKE '%sale%'
        AND ve.ledger_id IN (?)
      GROUP BY vm.id, ve.ledger_id
    `;
    const [invoices] = await pool.query(invoiceSql, [safeCustIds]);

    // 3. Fetch payments (receipt/payment vouchers)
    const paymentSql = `
      SELECT ve.ledger_id AS customer_id,
        SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS total_paid,
        MAX(vm.date) AS last_payment_date
      FROM voucher_main vm
      JOIN voucher_entries ve ON ve.voucher_id = vm.id
      WHERE vm.voucher_type IN ('receipt', 'payment')
        AND ve.ledger_id IN (?)
      GROUP BY ve.ledger_id
    `;
    const [payments] = await pool.query(paymentSql, [safeCustIds]);

    // Map payments by customer_id
    const paymentsMap = new Map();
    for (const p of payments) {
      paymentsMap.set(p.customer_id, {
        lastPaymentDate: p.last_payment_date,
        totalPaid: p.total_paid,
      });
    }

    const today = new Date();

    // Build final response array
    let results = customers.map(cust => {
      // Filter invoices for current customer
      const custInvoices = invoices.filter(inv => inv.customer_id === cust.id);
      
      let totalInvoiceAmt = 0;
      let overdueAmt = 0;
      let currentAmt = 0;
      // Sum invoices and split by overdue buckets
      custInvoices.forEach(inv => {
        const invAmount = inv.debit_amount - inv.credit_amount;
        if (inv.due_date) {
          const dueDate = new Date(inv.due_date);
          const ageDays = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
          if (ageDays > 0) overdueAmt += invAmount;
          else currentAmt += invAmount;
        } else {
          currentAmt += invAmount;
        }
        totalInvoiceAmt += invAmount;
      });

      const payment = paymentsMap.get(cust.id);
      const totalPaid = payment?.totalPaid ?? 0;
      const lastPayment = payment?.lastPaymentDate ?? null;

      const outstanding = totalInvoiceAmt - totalPaid;

      let riskCat = 'Low';
      if (overdueAmt > 500000) riskCat = 'Critical';
      else if (overdueAmt > 200000) riskCat = 'High';
      else if (overdueAmt > 50000) riskCat = 'Medium';

      // Calculate oldest bill date
      const oldestBillDate = custInvoices.length
        ? custInvoices.reduce((oldest, i) => (!oldest || i.date < oldest ? i.date : oldest), null)?.toISOString().slice(0,10)
        : null;

      return {
        id: cust.id.toString(),
        customerName: cust.name,
        customerGroup: cust.group_name ?? '',
        customerAddress: cust.address ?? '',
        customerPhone: cust.phone ?? '',
        customerEmail: cust.email ?? '',
        customerGSTIN: cust.gstin ?? '',
        totalOutstanding: Number(outstanding.toFixed(2)),
        currentDue: Number(currentAmt.toFixed(2)),
        overdue: Number(overdueAmt.toFixed(2)),
        creditLimit: 0,     // Add if you have the field elsewhere
        creditDays: 0,      // Add if you have the field elsewhere
        lastPayment: lastPayment ? { date: lastPayment, amount: totalPaid } : undefined,
        oldestBillDate,
        totalBills: custInvoices.length,
        riskCategory: riskCat,
        ageingBreakdown: {
          '0-30': currentAmt,
          '31-60': 0,  // Extend by fetching proper due_dates and bucket logic
          '61-90': 0,
          '90+': overdueAmt,
        }
      };
    });

    // Sort results client side based on parameters
    if (['amount', 'overdue', 'customer', 'risk'].includes(sortBy)) {
      const riskOrder = { Low: 1, Medium: 2, High: 3, Critical: 4 };
      results.sort((a, b) => {
        let comp = 0;
        switch (sortBy) {
          case 'amount': comp = a.totalOutstanding - b.totalOutstanding; break;
          case 'overdue': comp = a.overdue - b.overdue; break;
          case 'customer': comp = a.customerName.localeCompare(b.customerName); break;
          case 'risk': comp = riskOrder[a.riskCategory] - riskOrder[b.riskCategory]; break;
        }
        return sortOrder === 'desc' ? -comp : comp;
      });
    }

    res.json(results);

  } catch (err) {
    console.error('Error fetching outstanding receivables', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
