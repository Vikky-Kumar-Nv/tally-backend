const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool

// Insert Credit Voucher
router.post('/', async (req, res) => {
  const { date, number, mode, partyId, narration, entries, employee_id } = req.body;

  console.log('--- /api/CreditNotevoucher START ---');
  console.log('Body:', req.body);

  const mainVoucherQuery = `
    INSERT INTO credit_vouchers (\`date\`, \`number\`, \`mode\`, \`partyId\`, \`narration\`, \`employee_id\`)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const connection = await db.getConnection(); // Get pooled connection
  try {
    await connection.beginTransaction();

    // Insert into main table
    const [mainResult] = await connection.query(mainVoucherQuery, [
     date, number, mode, partyId, narration, employee_id
    ]);
    const voucherId = mainResult.insertId;
    console.log('Main insert OK:', voucherId);

    // Insert entries based on mode
    if (entries && entries.length > 0) {
      let entryQuery = '';
      let entryValues = [];

      if (mode === 'item-invoice') {
        entryQuery = `
          INSERT INTO credit_voucher_items
          (voucher_id, itemId, hsnCode, quantity, rate, discount, amount)
          VALUES ?
        `;
        entryValues = entries.map(e => [
          voucherId,
          e.itemId || null,
          e.hsnCode || '',
          e.quantity || 0,
          e.rate || 0,
          e.discount || 0,
          e.amount || 0
        ]);
      } else if (mode === 'accounting-invoice') {
        entryQuery = `
          INSERT INTO credit_voucher_accounts
          (voucher_id, narration, rate, amount, ledgerId)
          VALUES ?
        `;
        entryValues = entries.map(e => [
          voucherId,
          e.narration || '',
          e.rate || 0,
          e.amount || 0,
          e.ledgerId || null
        ]);
      } else if (mode === 'as-voucher') {
        entryQuery = `
          INSERT INTO credit_voucher_double_entry
          (voucher_id, ledgerId, type, amount)
          VALUES ?
        `;
        entryValues = entries.map(e => [
          voucherId,
          e.ledgerId || null,
          e.type || 'debit',
          e.amount || 0
        ]);
      }

      console.log('Entry Insert:', entryValues);

      await connection.query(entryQuery, [entryValues]);
    }

    await connection.commit();
    res.json({ message: 'Credit Note Voucher inserted successfully!' });

  } catch (err) {
    await connection.rollback();
    console.error('Insert Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
