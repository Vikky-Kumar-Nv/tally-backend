const express = require('express');
const router = express.Router();
const pool = require('../db'); // Your mysql2 pool connection

/**
 * GET /api/group-summary
 * Optional Query Param: groupType (string) - to filter ledgers by group type.
 * Returns: {
 *   ledgerGroups: [...],
 *   ledgers: [...]
 * }
 */
router.get('/api/group-summary', async (req, res) => {
  const { groupType } = req.query;

  try {
    // Fetch ledger groups
    const [ledgerGroups] = await pool.query('SELECT id, name, type FROM ledger_groups');

    let ledgersSql = `
      SELECT 
        l.id, l.name, l.group_id, l.opening_balance, l.balance_type,
        g.name AS group_name, g.type AS group_type
      FROM ledgers l
      LEFT JOIN ledger_groups g ON l.group_id = g.id
    `;

    const params = [];
    if (groupType) {
      ledgersSql += ' WHERE g.type = ? ';
      params.push(groupType);
    }

    ledgersSql += ' ORDER BY l.name';

    // Fetch ledgers with optional groupType filter
    const [ledgers] = await pool.query(ledgersSql, params);

    // Convert opening_balance (likely string) to number for frontend ease
    const normalizedLedgers = ledgers.map(ledger => ({
      ...ledger,
      opening_balance: parseFloat(ledger.opening_balance) || 0,
    }));

    res.json({
      ledgerGroups,
      ledgers: normalizedLedgers,
    });
  } catch (error) {
    console.error('Error fetching group summary data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
