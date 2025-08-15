const express = require('express');
const router = express.Router();
const db = require('../db'); // your db connection (e.g., mysql2 or mysql)

// POST /api/budgets - Create a new budget
router.post('/', async (req, res) => {
  const { name, startDate, endDate, description, status } = req.body;
  const [result] = await db.execute(
      `INSERT INTO budgets (name, start_date, end_date, description, status)
    VALUES (?, ?, ?, ?, ?)`,
      [name, startDate, endDate, description, status]
    );

    res.status(200).json({ message: 'Budget created successfully.', id: result.insertId });
  
  });
// GET /api/budgets/:id - Fetch budget by ID
// GET /api/budgets - Fetch all budgets
router.get('/', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM budgets ORDER BY id DESC');
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching budgets', error: err });
  }
});


// PUT /api/budgets/:id - Update budget
router.put('/:id', (req, res) => {
  const { name, startDate, endDate, description, status } = req.body;
  const sql = `
    UPDATE budgets
    SET name = ?, start_date = ?, end_date = ?, description = ?, status = ?
    WHERE id = ?
  `;
  db.query(sql, [name, startDate, endDate, description, status, req.params.id], (err) => {
    if (err) return res.status(500).json({ message: 'Update failed', error: err });
    res.json({ message: 'Budget updated successfully' });
  });
});

module.exports = router;
