const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/api/outstanding-ledger', async (req, res) => {
  try {
    const { ledgerName = '', searchTerm = '', from = '', to = '' } = req.query;
    let whereClauses = [];
    let params = [];

    if (ledgerName) {
      whereClauses.push("l.name = ?");
      params.push(ledgerName);
    }
    if (from) {
      whereClauses.push('vm.date >= ?');
      params.push(from);
    }
    if (to) {
      whereClauses.push('vm.date <= ?');
      params.push(to);
    }
    // Main query
    let sql = `
      SELECT
        l.id AS ledgerId,
        l.name AS ledgerName,
        vm.id AS voucherId,
        vm.date,
        vm.voucher_number AS refNo,
        vm.voucher_type AS particular,
        vm.narration,
        vm.due_date AS dueOn,
        SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) AS debit,
        SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS credit
      FROM voucher_main vm
      JOIN voucher_entries ve ON ve.voucher_id = vm.id
      JOIN ledgers l ON ve.ledger_id = l.id
      WHERE (vm.voucher_type LIKE '%sales%' OR vm.voucher_type LIKE '%purchase%')
        ${whereClauses.length ? 'AND ' + whereClauses.join(' AND ') : ''}
      GROUP BY l.id, vm.id
      ORDER BY l.name, vm.date DESC
    `;

    const [rows] = await pool.query(sql, params);

    // Group by ledger, process amounts and compute overdue
    const now = new Date();
    const grouped = {};
    rows.forEach(row => {
      // Optional: filter by search term at backend
      if (
        searchTerm &&
        !(
          (row.refNo && row.refNo.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (row.particular && row.particular.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (row.ledgerName && row.ledgerName.toLowerCase().includes(searchTerm.toLowerCase()))
        )
      ) return;

      if (!grouped[row.ledgerId]) {
        grouped[row.ledgerId] = { id: row.ledgerId, ledgerName: row.ledgerName, entries: [] };
      }
      const openingAmount = Number(row.debit) || 0;
      const pendingAmount = openingAmount - (Number(row.credit) || 0);
      // Overdue days calc
      let overdueByDays = 0;
      if (row.dueOn) {
        const due = new Date(row.dueOn);
        overdueByDays = Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
      }
      grouped[row.ledgerId].entries.push({
        id: row.voucherId,
        date: row.date,
        refNo: row.refNo,
        particular: row.particular,
        openingAmount: openingAmount,
        pendingAmount: pendingAmount,
        dueOn: row.dueOn,
        overdueByDays: overdueByDays,
      });
    });

    res.json(Object.values(grouped));
  } catch (err) {
    console.error('OutstandingLedger API error:', err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
