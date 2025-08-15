const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise connection

// Insert Stock Journal Voucher
router.post('/', async (req, res) => {
  const { date, number, narration, entries, employee_id } = req.body;
    
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [mainResult] = await connection.query(
      `INSERT INTO stock_journal_vouchers (date, number, narration, employee_id)
       VALUES (?, ?, ?, ?)`,
      [date, number, narration, employee_id]
    );

    const voucherId = mainResult.insertId;

    const entryValues = entries.map(entry => [
      voucherId,
      entry.ledgerId || null,
      entry.type || 'debit',
      entry.quantity || 0,
      entry.rate || 0,
      entry.amount || 0,
      entry.batchNumber || ''
    ]);

    await connection.query(
      `INSERT INTO stock_journal_entries
      (voucher_id, ledger_id, type, quantity, rate, amount, batch_no)
      VALUES ?`,
      [entryValues]
    );

    await connection.commit();
    res.json({ message: 'Stock Journal Voucher saved successfully' });

  } catch (err) {
    await connection.rollback();
    console.error('Insert Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
