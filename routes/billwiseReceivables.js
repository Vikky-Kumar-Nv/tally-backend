const express = require('express');
const router = express.Router();
const pool = require('../db'); // mysql2 pool with promises

// Helper to safely handle empty arrays for SQL IN
const safeArray = (arr) => (arr && arr.length ? arr : [-1]);

// Ageing bucket calculator helper
function calculateAgeingBucket(diffDays) {
  if (diffDays <= 30) return '0-30';
  if (diffDays <= 60) return '31-60';
  if (diffDays <= 90) return '61-90';
  return '90+';
}

router.get('/api/billwise-receivables', async (req, res) => {
  try {
    const {
      searchTerm = '',
      partyName = '',
     selectedAgeingBucket = '',
  selectedRiskCategory = '',
      sortBy = 'amount',
      sortOrder = 'desc',
      limit = 100,
      offset = 0,
    } = req.query;

    // Search pattern for party name
    const searchPattern = `%${searchTerm.toLowerCase()}%`;

    // 1. Fetch party details from ledgers table
    const partyGroupCondition = partyName ? 'AND LOWER(l.name) LIKE ?' : '';
    let partyGroupParams = [];
    if (partyName) partyGroupParams.push(`%${partyName.toLowerCase()}%`);

    // Fetch parties that have sales vouchers
    const partiesSql = `
      SELECT
        l.id,
        l.name,
        lg.name as partyGroup,
        l.address,
        l.phone,
        l.email,
        l.gst_number as gstin
      FROM ledgers l
      LEFT JOIN ledger_groups lg ON l.group_id = lg.id
      WHERE LOWER(l.name) LIKE ?
      ${partyGroupCondition}
      LIMIT ? OFFSET ?
    `;

    const partiesParams = partyName ? [searchPattern, ...partyGroupParams, Number(limit), Number(offset)] : [searchPattern, Number(limit), Number(offset)];
    const [parties] = await pool.query(partiesSql, partiesParams);

    if (parties.length === 0) return res.json([]);

    const partyIds = parties.map(p => p.id);
    const safePartyIds = safeArray(partyIds);

    // 2. Fetch bills - sales vouchers that belong to these parties
    const billsSql = `
  SELECT
    vm.id AS bill_id,
    vm.voucher_number AS billNo,
    vm.date AS billDate,
    vm.due_date,
    vm.reference_no AS reference,
    vm.narration,
    ve.ledger_id AS partyId,
    l.name AS partyName,
    lg.name AS partyGroup,
    l.address AS partyAddress,
    l.phone AS partyPhone,
    l.email AS partyEmail,
    l.gst_number AS partyGSTIN,
    SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) AS billAmount,
    SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS receivedAmount
  FROM voucher_main vm
  JOIN voucher_entries ve ON vm.id = ve.voucher_id
  JOIN ledgers l ON l.id = ve.ledger_id
  LEFT JOIN ledger_groups lg ON l.group_id = lg.id
  WHERE vm.voucher_type LIKE '%sales%'
    AND ve.ledger_id IN (?)
  GROUP BY vm.id, ve.ledger_id
`;


    const [billsRaw] = await pool.query(billsSql, [safePartyIds]);

    // 3. For each bill, calculate outstanding, overdue days, ageing bucket, risk (you can improve risk calc)
    const today = new Date();
    const bills = billsRaw.map(bill => {
      const billDate = new Date(bill.billDate);
      const creditDays = bill.creditDays || 30;
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + creditDays);

      const outstandingAmount = Number(bill.billAmount) - Number(bill.receivedAmount || 0);
      const overdueDays = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));

      const ageingBucketVal = calculateAgeingBucket(overdueDays);

      // Simple risk categorization based on overdueDays and outstanding amount
      let riskCat = 'Low';
      if (overdueDays > 90 && outstandingAmount > 50000) riskCat = 'Critical';
      else if (overdueDays > 60 && outstandingAmount > 30000) riskCat = 'High';
      else if (overdueDays > 30 && outstandingAmount > 10000) riskCat = 'Medium';

      return {
        id: bill.bill_id.toString(),
        partyName: bill.partyName,
        billNo: bill.billNo,
        billDate: bill.billDate,
        dueDate: dueDate.toISOString().split('T')[0],
        billAmount: Number(bill.billAmount),
        receivedAmount: Number(bill.receivedAmount || 0),
        outstandingAmount,
        overdueDays,
        creditDays,
        interestAmount: 0, // calculate if needed
        voucherType: 'Sales',
        reference: bill.reference || undefined,
        narration: bill.narration || undefined,
        ageingBucket: ageingBucketVal,
        partyGroup: bill.partyGroup || '',
        partyAddress: bill.partyAddress,
        partyPhone: bill.partyPhone,
        partyGSTIN: bill.partyGSTIN,
        creditLimit: bill.creditLimit || 0,
        riskCategory: riskCat,
      };
    });

    // 4. Apply frontend-like filters server side to reduce payload if requested
    let filtered = bills;
if (partyName) {
  filtered = filtered.filter(b => b.partyName === partyName);}
    if (selectedAgeingBucket) filtered = filtered.filter(b => b.ageingBucket === selectedAgeingBucket);
    if (selectedRiskCategory) filtered = filtered.filter(b => b.riskCategory === selectedRiskCategory);

    // 5. Sorting
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'amount':
          cmp = a.outstandingAmount - b.outstandingAmount;
          break;
        case 'overdue':
          cmp = a.overdueDays - b.overdueDays;
          break;
        case 'party':
          cmp = a.partyName.localeCompare(b.partyName);
          break;
        case 'date':
          cmp = new Date(a.billDate).getTime() - new Date(b.billDate).getTime();
          break;
      }
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    res.json(filtered);

  } catch (error) {
    console.error('Error fetching billwise receivables', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
