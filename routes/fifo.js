const express = require('express');
const router = express.Router();
const pool = require('../db'); // mysql2 pool connection

// For settings storage, here simplified as in-memory or DB-backed (implement as needed)
let fifoSettings = {
  enableFifoForAllItems: true,
  enableFifoForCategories: ['Electronics', 'Medicines', 'Perishables'],
  enableFifoForSpecificItems: [],
  fifoCalculationMethod: 'strict_fifo',
  considerExpiryInFifo: true,
  autoAdjustNegativeStock: false,
  showFifoDetailsInReports: true,
  enableFifoForSales: true,
  enableFifoForConsumption: true,
  enableFifoForTransfers: true,
  fifoRoundingPrecision: 2,
  treatZeroStockAs: 'warning',
  enableBackdatedTransactions: false,
  fifoRevaluationMethod: 'automatic',
};

// GET FIFO settings
router.get('/api/fifo/settings', async (req, res) => {
  // If you have DB, fetch from there. Here direct from memory:
  res.json(fifoSettings);
});

// POST save/update FIFO settings
router.post('/api/fifo/settings', async (req, res) => {
  try {
    const newSettings = req.body;
    // TODO: Add validation for newSettings here
    fifoSettings = { ...fifoSettings, ...newSettings };
    // TODO: save to DB if applicable
    res.json({ success: true, message: 'FIFO settings saved', data: fifoSettings });
  } catch (error) {
    console.error("Error saving FIFO settings:", error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET FIFO transactions with filters and pagination support
router.get('/api/fifo/transactions', async (req, res) => {
  try {
    const {
      itemCode,
      fromDate,
      toDate,
      isConsumed, // true/false to filter consumed or available
      limit = 100,
      offset = 0,
    } = req.query;

    const conditions = [];
    const params = [];

    if (itemCode) {
      conditions.push('item_code = ?');
      params.push(itemCode);
    }
    if (fromDate) {
      conditions.push('transaction_date >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('transaction_date <= ?');
      params.push(toDate);
    }
    if (isConsumed === 'true' || isConsumed === 'false') {
      conditions.push('is_consumed = ?');
      params.push(isConsumed === 'true' ? 1 : 0);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT id, transaction_date AS date, transaction_type AS type, item_code, item_name, quantity, rate, batch_number, expiry_date, remaining_quantity, is_consumed
      FROM fifo_stock_transactions
      ${whereClause}
      ORDER BY transaction_date DESC, id DESC
      LIMIT ? OFFSET ?;
    `;

    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(sql, params);

    res.json(rows);
  } catch (error) {
    console.error("Error fetching FIFO transactions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
