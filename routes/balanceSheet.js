const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 connection pool

// GET /api/balance-sheet
router.get('/api/balance-sheet', async (req, res) => {
  try {
    // Fetch all ledger groups
    const [ledgerGroups] = await pool.query(`
      SELECT id, name, type FROM ledger_groups
    `);
    
    // Fetch all ledgers joined with ledger group info
    const [ledgers] = await pool.query(`
      SELECT 
        l.id, 
        l.name, 
        l.group_id,
        CAST(l.opening_balance AS DECIMAL(15,2)) AS opening_balance,
        l.balance_type,
        g.name AS group_name,
        g.type AS group_type
      FROM ledgers l
      LEFT JOIN ledger_groups g ON l.group_id = g.id
      ORDER BY g.type, g.name, l.name
    `);

    res.json({ ledgerGroups, ledgers });
  } catch (err) {
    console.error('Error fetching balance sheet data', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
