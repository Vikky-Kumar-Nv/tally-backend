// routes/gstRates.js

const express = require('express');
const router = express.Router();
const db = require('../db'); // assuming you have a db.js for MySQL connection

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        sc.id AS categoryId,
        sc.name AS category,
        sc.description,
        si.hsnCode,
        si.gstRate,
        si.createdAt AS effectiveFrom
      FROM stock_items si
      LEFT JOIN stock_categories sc ON si.stockGroupId = sc.id
    `);

    // Add a fallback ID field for frontend usage
    const formatted = rows.map((row, index) => ({
      id: String(index + 1),
      category: row.category || 'Uncategorized',
      description: row.description || '',
      hsnCode: row.hsnCode || '',
      gstRate: parseFloat(row.gstRate),
      effectiveFrom: row.effectiveFrom,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching GST rates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
