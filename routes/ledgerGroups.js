const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/ledger-groups
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM ledger_groups');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching ledger groups:', err);
    res.status(500).json({ message: 'Failed to fetch ledger groups' });
  }
});

module.exports = router;
