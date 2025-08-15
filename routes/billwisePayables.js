const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 (promise) pool connection

// Helper: Ageing bucket
function calcAgeingBucket(days) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

// API: GET /api/billwise-payables
router.get('/api/billwise-payables', async (req, res) => {
  try {
    const {
      searchTerm = '',
      selectedSupplier = '',
      selectedAgeingBucket = '',
      selectedRiskCategory = '',
      sortBy = 'amount',
      sortOrder = 'desc'
    } = req.query;

    // 1. Supplier ledgers
    const ledgerSql = `
      SELECT l.id, l.name, lg.name AS supplierGroup, l.address, l.phone, l.gst_number AS supplierGSTIN
      FROM ledgers l
      LEFT JOIN ledger_groups lg ON l.group_id = lg.id
      WHERE LOWER(l.name) LIKE ?
    `;
    const suppliers = (await pool.query(ledgerSql, [`%${searchTerm.toLowerCase()}%`]))[0];

    if (!suppliers.length) return res.json([]);
    const ledgerIds = suppliers.map(s => s.id);

    // 2. Fetch bills (purchase vouchers) for these suppliers
    const billsSql = `
      SELECT
        vm.id AS bill_id,
        vm.voucher_number AS billNo,
        vm.date AS billDate,
        vm.due_date AS dueDate,
        vm.reference_no AS reference,
        vm.narration,
        ve.ledger_id AS supplierId,
        l.name AS supplierName,
        lg.name AS supplierGroup,
        l.address AS supplierAddress,
        l.phone AS supplierPhone,
        l.gst_number AS supplierGSTIN,
        SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS billAmount
      FROM voucher_main vm
      JOIN voucher_entries ve ON vm.id = ve.voucher_id
      JOIN ledgers l ON ve.ledger_id = l.id
      LEFT JOIN ledger_groups lg ON l.group_id = lg.id
      WHERE vm.voucher_type LIKE '%purchase%'
        AND ve.ledger_id IN (?)
      GROUP BY vm.id, ve.ledger_id
    `;
    const bills = (await pool.query(billsSql, [ledgerIds.length ? ledgerIds : [0]]))[0];

    // 3. Fetch payments (payment/receipt vouchers) made to these suppliers, group by voucher, supplier
    const paySql = `
      SELECT
        ve.voucher_id AS voucherId,
        ve.ledger_id AS supplierId,
        SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) AS paidAmount
      FROM voucher_main vm
      JOIN voucher_entries ve ON vm.id = ve.voucher_id
      WHERE vm.voucher_type IN ('payment', 'receipt') AND ve.ledger_id IN (?)
      GROUP BY ve.voucher_id, ve.ledger_id
    `;
    const pays = (await pool.query(paySql, [ledgerIds.length ? ledgerIds : [0]]))[0];

    // 4. Prepare the final billwise payable list
    const today = new Date();

    let result = bills.map(bill => {
      // Find matched ledger details
      const supplier = suppliers.find(s => s.id === bill.supplierId);
      // Find payments for this voucher+supplier (NOTE: not all implementations link explicitly by bill, so you may want to total per-ledger)
      const paidOnBill = pays
        .filter(p => p.supplierId === bill.supplierId)
        .reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0); // crude sum

      // Ageing calculation
      const creditDays = 30; // adjust if you store per-purchase
      const billDate = bill.billDate || bill.date;
      const dueDate = bill.dueDate || (billDate ? (new Date(new Date(billDate).getTime() + creditDays * 86400000)) : new Date());
      const overdueDays = dueDate ? Math.max(0, Math.floor((today - new Date(dueDate)) / (1000 * 60 * 60 * 24))) : 0;
      const ageingBucket = calcAgeingBucket(overdueDays);

      const outstandingAmount = Number(bill.billAmount) - paidOnBill;

      // Risk category
      let riskCategory = 'Low';
      if (outstandingAmount > 200000 && overdueDays > 90) riskCategory = 'Critical';
      else if (outstandingAmount > 100000 && overdueDays > 60) riskCategory = 'High';
      else if (outstandingAmount > 50000 && overdueDays > 30) riskCategory = 'Medium';

      return {
        id: bill.bill_id.toString(),
        supplierName: bill.supplierName,
        billNo: bill.billNo || '',
        billDate: bill.billDate ? bill.billDate.toISOString ? bill.billDate.toISOString().slice(0,10) : bill.billDate : '',
        dueDate: dueDate ? (typeof dueDate === 'string' ? dueDate : dueDate.toISOString().slice(0,10)) : '',
        billAmount: Number(bill.billAmount) || 0,
        paidAmount: paidOnBill || 0,
        outstandingAmount: outstandingAmount || 0,
        overdueDays: overdueDays,
        creditDays: creditDays,
        interestAmount: 0,
        voucherType: 'Purchase',
        reference: bill.reference || '',
        narration: bill.narration || '',
        ageingBucket,
        supplierGroup: bill.supplierGroup || '',
        supplierAddress: bill.supplierAddress || '',
        supplierPhone: bill.supplierPhone || '',
        supplierGSTIN: bill.supplierGSTIN || '',
        creditLimit: 0, // add if you track this somewhere
        riskCategory,
        poNumber: '', // add if you track
        grnNumber: '', // add if you track
      };
    });

    // 5. Frontend-style filtering
    if (selectedSupplier)              result = result.filter(b => b.supplierName === selectedSupplier);
    if (selectedAgeingBucket)          result = result.filter(b => b.ageingBucket === selectedAgeingBucket);
    if (selectedRiskCategory)          result = result.filter(b => b.riskCategory === selectedRiskCategory);

    // 6. Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'amount':   cmp = a.outstandingAmount - b.outstandingAmount; break;
        case 'overdue':  cmp = a.overdueDays - b.overdueDays; break;
        case 'supplier': cmp = a.supplierName.localeCompare(b.supplierName); break;
        case 'date':     cmp = new Date(a.billDate).getTime() - new Date(b.billDate).getTime(); break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    res.json(result);

  } catch (err) {
    console.error('Error fetching billwise payables', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
