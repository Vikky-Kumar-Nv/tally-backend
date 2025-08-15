const express = require('express');
const router = express.Router();
const db = require('../db'); // make sure this is using `mysql2/promise`

router.get('/', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        vm.*,
        GROUP_CONCAT(DISTINCT dne.item_id) AS debit_items,
        GROUP_CONCAT(DISTINCT cva.ledgerId) AS credit_ledgers,
        SUM(DISTINCT dne.amount) AS total_debit,
        SUM(DISTINCT cva.amount) AS total_credit
      FROM voucher_main vm
      LEFT JOIN debit_note_entries dne ON vm.id = dne.voucher_id
      LEFT JOIN credit_voucher_accounts cva ON vm.id = cva.voucher_id
      GROUP BY vm.id
      ORDER BY vm.date DESC
    `);

    res.json(results);
  } catch (err) {
    console.error('Error fetching daybook entries:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


module.exports = router;
