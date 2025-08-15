const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql2 pool connection

// Helper: Validate deductee data (basic)
function validateDeductee(data) {
  const categories = ['individual', 'company', 'huf', 'firm', 'aop', 'trust'];
  const statuses = ['active', 'inactive'];
  if (!data.name || typeof data.name !== 'string') return 'Name is required';
  if (!data.pan || typeof data.pan !== 'string') return 'PAN is required';
  if (!data.category || !categories.includes(data.category)) return 'Invalid category';
  if (data.status && !statuses.includes(data.status)) return 'Invalid status';
  // Add further validations as needed
  return null;
}

// GET /api/deductees - List all deductees with optional search and category filters
router.get('/api/deductees', async (req, res) => {
  try {
    const { search = '', category = 'all' } = req.query;
    let sql = `SELECT * FROM deductees WHERE 1=1 `;
    const params = [];

    if (search) {
      sql += ` AND (LOWER(name) LIKE ? OR LOWER(pan) LIKE ? OR LOWER(tds_section) LIKE ?) `;
      const likeSearch = `%${search.toLowerCase()}%`;
      params.push(likeSearch, likeSearch, likeSearch);
    }

    if (category && category !== 'all') {
      sql += ` AND category = ? `;
      params.push(category);
    }

    sql += ` ORDER BY name ASC `;

    const [rows] = await db.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error('Error fetching deductees:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/deductees - Add new deductee
router.post('/api/deductees', async (req, res) => {
  try {
    const data = req.body;

    const validationError = validateDeductee(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const sql = `
      INSERT INTO deductees
      (name, pan, category, address, email, phone, tds_section, rate, threshold, total_deducted, last_deduction, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.name,
      data.pan.toUpperCase(),
      data.category,
      data.address || null,
      data.email || null,
      data.phone || null,
      data.tdsSection || null,
      data.rate || 0,
      data.threshold || 0,
      data.totalDeducted || 0,
      data.lastDeduction || null,
      data.status || 'active',
    ];

    const [result] = await db.query(sql, params);

    res.status(201).json({ success: true, id: result.insertId });

  } catch (err) {
    console.error('Error adding deductee:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'PAN already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// PUT /api/deductees/:id - Update deductee by ID
router.put('/api/deductees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const validationError = validateDeductee(data);
    if (validationError) return res.status(400).json({ error: validationError });

    const sql = `
      UPDATE deductees SET
        name = ?, pan = ?, category = ?, address = ?, email = ?, phone = ?, tds_section = ?,
        rate = ?, threshold = ?, total_deducted = ?, last_deduction = ?, status = ?, updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      data.name,
      data.pan.toUpperCase(),
      data.category,
      data.address || null,
      data.email || null,
      data.phone || null,
      data.tdsSection || null,
      data.rate || 0,
      data.threshold || 0,
      data.totalDeducted || 0,
      data.lastDeduction || null,
      data.status || 'active',
      id
    ];

    const [result] = await db.query(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Deductee not found' });
    }

    res.json({ success: true });

  } catch (err) {
    console.error('Error updating deductee:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'PAN already exists' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Optional: DELETE /api/deductees/:id - Delete deductee (if needed)
router.delete('/api/deductees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM deductees WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Deductee not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting deductee:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
