const express = require('express');
const router = express.Router();
const db = require('../db'); // Your DB connection module

// GET all stock categories
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM stock_categories ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching stock categories:', err);
    res.status(500).json({ message: 'Failed to fetch stock categories' });
  }
});

// GET single stock category
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM stock_categories WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching stock category:', err);
    res.status(500).json({ message: 'Failed to fetch stock category' });
  }
});

// CREATE stock category
router.post('/', async (req, res) => {
  const { id, name, parent, description } = req.body;
  try {
    await db.execute(
      'INSERT INTO stock_categories (id, name, parent, description) VALUES (?, ?, ?, ?)',
      [id, name, parent || null, description || null]
    );
    res.json({ message: 'Stock category created successfully' });
  } catch (err) {
    console.error('Error creating stock category:', err);
    res.status(500).json({ message: 'Failed to create stock category' });
  }
});

// UPDATE stock category
router.put('/:id', async (req, res) => {
  const { name, parent, description } = req.body;
  try {
    await db.execute(
      'UPDATE stock_categories SET name = ?, parent = ?, description = ? WHERE id = ?',
      [name, parent || null, description || null, req.params.id]
    );
    res.json({ message: 'Stock category updated successfully' });
  } catch (err) {
    console.error('Error updating stock category:', err);
    res.status(500).json({ message: 'Failed to update stock category' });
  }
});

// DELETE stock category
router.delete('/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM stock_categories WHERE id = ?', [req.params.id]);
    res.json({ message: 'Stock category deleted successfully' });
  } catch (err) {
    console.error('Error deleting stock category:', err);
    res.status(500).json({ message: 'Failed to delete stock category' });
  }
});

module.exports = router;
