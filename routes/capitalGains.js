const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to convert snake_case db fields -> camelCase for frontend
function camelRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    assetType: row.asset_type,
    gainType: row.gain_type,
    purchaseDate: row.purchase_date,
    saleDate: row.sale_date,
    purchaseValue: row.purchase_value,
    saleValue: row.sale_value,
    indexationBenefit: row.indexation_benefit,
    exemptionClaimed: row.exemption_claimed,
    description: row.description,
    gainAmount: row.gain_amount,
    taxableGain: row.taxable_gain,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// GET all capital gains
// GET all capital gains (optional employee_id filter)
router.get('/', async (req, res) => {
  const employeeId = req.query.employee_id;
  try {
    let query = 'SELECT * FROM capital_gains';
    let params = [];

    if (employeeId) {
      query += ' WHERE employee_id = ?';
      params.push(employeeId);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, params);
    res.json(rows.map(camelRow));
  } catch (err) {
    console.error('Error fetching capital gains:', err);
    res.status(500).json({ error: 'Failed to fetch capital gains' });
  }
});


// POST create new capital gain
router.post('/', async (req, res) => {
  let {
    employeeId,
    assetType,
    gainType,
    purchaseDate,
    saleDate,
    purchaseValue,
    saleValue,
    indexationBenefit = 0,
    exemptionClaimed = 0,
    description = '',
    gainAmount,
    taxableGain,
    createdAt,
    updatedAt
  } = req.body;

  createdAt = createdAt || new Date().toISOString();
  updatedAt = updatedAt || createdAt;

  let id = req.body.id;
  if (!id) {
    id = Date.now().toString();
  }

  try {
    const query = `
      INSERT INTO capital_gains (
        id, employee_id, asset_type, gain_type, purchase_date, sale_date, purchase_value, sale_value,
        indexation_benefit, exemption_claimed, description, gain_amount, taxable_gain, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id, employeeId, assetType, gainType, purchaseDate, saleDate,
      purchaseValue, saleValue, indexationBenefit, exemptionClaimed,
      description, gainAmount, taxableGain, createdAt, updatedAt
    ];

    await db.query(query, params);

    const [rows] = await db.query('SELECT * FROM capital_gains WHERE id = ?', [id]);
    if (rows.length)
      return res.json(camelRow(rows[0]));
    else
      return res.json({ success: true, id });

  } catch (error) {
    console.error('Error inserting capital gain:', error);
    res.status(500).json({ error: 'Failed to insert capital gain' });
  }
});


// PUT update existing capital gain by id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    employeeId,  // optional
    assetType,
    gainType,
    purchaseDate,
    saleDate,
    purchaseValue,
    saleValue,
    indexationBenefit = 0,
    exemptionClaimed = 0,
    description = '',
    gainAmount,
    taxableGain,
    updatedAt = new Date().toISOString(),
  } = req.body;

  try {
    const query = `
      UPDATE capital_gains SET
        employee_id = ?, asset_type = ?, gain_type = ?, purchase_date = ?, sale_date = ?, purchase_value = ?,
        sale_value = ?, indexation_benefit = ?, exemption_claimed = ?, description = ?,
        gain_amount = ?, taxable_gain = ?, updated_at = ?
      WHERE id = ?
    `;

    const params = [
      employeeId, assetType, gainType, purchaseDate, saleDate, purchaseValue, saleValue,
      indexationBenefit, exemptionClaimed, description, gainAmount, taxableGain, updatedAt, id
    ];

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Capital gain not found' });
    }

    const [rows] = await db.query('SELECT * FROM capital_gains WHERE id = ?', [id]);
    if (rows.length)
      return res.json(camelRow(rows[0]));

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating capital gain:', error);
    res.status(500).json({ error: 'Failed to update capital gain' });
  }
});


// DELETE capital gain by id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM capital_gains WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Capital gain not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting capital gain:', error);
    res.status(500).json({ error: 'Failed to delete capital gain' });
  }
});

module.exports = router;
