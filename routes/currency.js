const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql2 connection

// POST - Add currency
router.post('/', async (req, res) => {
  const { code, symbol, name, exchangeRate, isBase } = req.body;

  if (!code || !name) {
    return res.status(400).json({ message: 'Code and name are required.' });
  }

  try {
    if (isBase) {
      // Set all others to non-base first
      await db.execute('UPDATE currencies SET is_base = false');
    }

    const [result] = await db.execute(
      `INSERT INTO currencies (code, symbol, name, exchange_rate, is_base)
       VALUES (?, ?, ?, ?, ?)`,
      [code, symbol, name, exchangeRate, isBase]
    );

    res.status(200).json({ message: 'Currency saved successfully.', id: result.insertId });
  } catch (err) {
    console.error('Currency insert error:', err);
    res.status(500).json({ message: 'Failed to insert currency.' });
  }
});

// GET - All currencies
router.get('/', async (req, res) => {
  try {
    const [currencies] = await db.execute('SELECT * FROM currencies ORDER BY id DESC');
    res.json(currencies);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch currencies.' });
  }
});

module.exports = router;
