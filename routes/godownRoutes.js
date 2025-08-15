const express = require('express');
const router = express.Router();
const db = require('../db');

// Add Godown
router.post('/', async (req, res) => {
  const {name, address, description } = req.body;
  try {
    await db.execute(
      'INSERT INTO godowns (name, address, description) VALUES (?, ?, ?)',
      [name, address, description]
    );
    res.json({ success: true, message: 'Godown added successfully' });
  } catch (error) {
    console.error('Error adding godown:', error);
    res.status(500).json({ success: false, message: 'Error adding godown' });
  }
});

// Fetch Godown by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM godowns WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch godown' });
  }
});

// List All Godowns
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM godowns ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching godowns' });
  }
});

module.exports = router;
