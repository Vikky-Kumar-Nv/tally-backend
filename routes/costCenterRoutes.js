const express = require('express');
const router = express.Router();
const db = require('../db'); // Adjust if your DB file path is different

// Create or Update Cost Center
router.post('/save', async (req, res) => {
  const { id, name, category, description } = req.body;

  try {
    if (id) {
      // Update existing
      await db.execute(
        `UPDATE cost_centers SET name=?, category=?, description=?, updated_at=NOW() WHERE id=?`,
        [name, category, description, id]
      );
      res.json({ success: true, message: 'Cost center updated successfully' });
    } else {
      // Insert new
      await db.execute(
        `INSERT INTO cost_centers (name, category, description) VALUES (?, ?, ?)`,
        [name, category, description]
      );
      res.json({ success: true, message: 'Cost center created successfully' });
    }
  } catch (err) {
    console.error('Error saving cost center:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get Cost Center by ID (for edit mode)
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM cost_centers WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Error fetching cost center:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// List All Cost Centers
router.get('/list/all', async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT * FROM cost_centers ORDER BY created_at DESC`);
    res.json(rows);
  } catch (err) {
    console.error('Error listing cost centers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Optional: Delete Cost Center
router.delete('/:id', async (req, res) => {
  try {
    await db.execute(`DELETE FROM cost_centers WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting cost center:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


module.exports = router;
