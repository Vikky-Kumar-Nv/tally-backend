// routes/outstandingSummary.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Utility to sum receivables/payables from same tables as main reports
router.get('/api/outstanding-summary', async (req, res) => {
  try {
    // Receivables (ledgers/debtors)
    const [recvRows] = await pool.query(`
      SELECT
        SUM(
          (CASE WHEN vm.voucher_type LIKE '%sales%' THEN ve.amount ELSE 0 END) -
          (CASE WHEN vm.voucher_type IN ('receipt','payment') AND ve.entry_type = 'credit' THEN ve.amount ELSE 0 END)
        ) AS totalReceivables
      FROM voucher_main vm
      JOIN voucher_entries ve ON vm.id = ve.voucher_id
      -- You may add a condition here if you have a customer ledger group id to restrict only to customers
    `);
    const totalReceivables = Number(recvRows[0]?.totalReceivables || 0);

    // Payables (ledgers/creditors)
    const [payRows] = await pool.query(`
      SELECT
        SUM(
          (CASE WHEN vm.voucher_type LIKE '%purchase%' THEN ve.amount ELSE 0 END) -
          (CASE WHEN vm.voucher_type IN ('payment','receipt') AND ve.entry_type = 'debit' THEN ve.amount ELSE 0 END)
        ) AS totalPayables
      FROM voucher_main vm
      JOIN voucher_entries ve ON vm.id = ve.voucher_id
      -- You may add a condition here if you have a supplier ledger group id
    `);
    const totalPayables = Number(payRows[0]?.totalPayables || 0);

    res.json({
      totalReceivables,
      totalPayables,
      netOutstanding: totalReceivables - totalPayables
    });
  } catch (err) {
    console.error('Error fetching outstanding summary:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
module.exports = router;
