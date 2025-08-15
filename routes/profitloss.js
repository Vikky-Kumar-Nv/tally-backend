const express = require('express');
const router = express.Router();
const pool = require('../db'); // your MySQL pool connection

// GET /api/profit-loss
router.get('/api/profit-loss', async (req, res) => {
  try {
    // Get all ledger groups
    const [groups] = await pool.query('SELECT id, name, type FROM ledger_groups');
    
    // Get all ledgers with their group info
    const [ledgers] = await pool.query(`
      SELECT 
        l.id, l.name, l.group_id, l.opening_balance, l.balance_type,
        g.name AS group_name,
        g.type AS group_type
      FROM ledgers l
      LEFT JOIN ledger_groups g ON l.group_id = g.id
      ORDER BY g.type, g.name, l.name
    `);

    res.json({ ledgerGroups: groups, ledgers });

  } catch (err) {
    console.error('Error fetching profit & loss data:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
