// routes/godownSummary.js

const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 pool connection

/**
 * GET /api/godown-summary
 * Query params:
 *  - godownId (optional) to filter by godown
 *  - asOnDate (optional) date string in YYYY-MM-DD to represent snapshot date (can be used later)
 */
router.get('/api/godown-summary', async (req, res) => {
  try {
    const { godownId, asOnDate } = req.query;

    // Base query: join godown_allocations with stock_items and godowns for names and details
    let sql = `
      SELECT
        g.id as godownId,
        g.name as godownName,
        si.id as itemId,
        si.name as itemName,
        si.unit,
        ga.quantity,
        IFNULL(si.standardPurchaseRate, 0) as rate,
        (ga.quantity * IFNULL(si.standardPurchaseRate, 0)) as value
      FROM godown_allocations ga
      JOIN stock_items si ON ga.stockItemId = si.id
      JOIN godowns g ON ga.godownId = g.id
      WHERE 1=1
    `;

    const params = [];

    if (godownId) {
      sql += ' AND g.id = ?';
      params.push(godownId);
    }

    // Future: asOnDate can be used to filter allocations at a specific snapshot date if you maintain history

    sql += ' ORDER BY g.name, si.name';

    const [rows] = await pool.query(sql, params);

    res.json(rows);

  } catch (error) {
    console.error('Error fetching godown summary:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
