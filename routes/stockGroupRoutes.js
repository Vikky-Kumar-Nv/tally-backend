// routes/stockGroupRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Create new stock group
router.post('/', async (req, res) => {
  const s = req.body;
  try {
    const sql = `
      INSERT INTO stock_groups 
      (id, name, parent, should_quantities_be_added, set_alter_hsn, hsn_sac_classification_id, hsn_code, hsn_description, 
      set_alter_gst, gst_classification_id, taxability, gst_rate, cess)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      s.id, s.name, s.parent || null, s.shouldQuantitiesBeAdded,
      s.hsnSacDetails?.setAlterHSNSAC || false,
      s.hsnSacDetails?.hsnSacClassificationId || null,
      s.hsnSacDetails?.hsnCode || null,
      s.hsnSacDetails?.description || null,
      s.gstDetails?.setAlterGST || false,
      s.gstDetails?.gstClassificationId || null,
      s.gstDetails?.taxability || null,
      s.gstDetails?.integratedTaxRate || 0,
      s.gstDetails?.cess || 0
    ];

    await db.execute(sql, values);
    res.json({ message: 'Stock Group added successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to insert', details: err.message });
  }
});

// Get all Stock Groups
router.get('/list', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM stock_groups');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching stock groups:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch stock groups' });
  }
});

// Delete Stock Group
router.delete('/delete/:id', async (req, res) => {
  try {
    await db.execute('DELETE FROM stock_groups WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Stock Group deleted successfully' });
  } catch (err) {
    console.error('Error deleting stock group:', err);
    res.status(500).json({ success: false, message: 'Failed to delete stock group' });
  }
});


module.exports = router;