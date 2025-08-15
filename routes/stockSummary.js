const express = require('express');
const router = express.Router();
const pool = require('../db');  // your MySQL pool connection

/**
 * GET /api/stock-summary
 * Query Params: 
 *   fromDate, toDate - date range filters (voucher date)
 *   stockGroupId, stockItemId, godownId, batchId - optional filters
 *   basis - 'Quantity', 'Value', 'Cost'
 *   showProfit - boolean ('true'/'false')
 */
router.get('/api/stock-summary', async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      stockGroupId,
      stockItemId,
      godownId,
      batchId,
      basis = 'Quantity',   // default to Quantity
      showProfit = 'false',
    } = req.query;

    // Prepare parameters for query building
    const filters = [];
    const params = [];

    // Date filter on voucher_main.date (for transactions)
    if (fromDate && toDate) {
      filters.push('vm.date BETWEEN ? AND ?');
      params.push(fromDate, toDate);
    }

    // Filter by stock group or stock item
    if (stockGroupId) {
      filters.push('si.stockGroupId = ?');
      params.push(stockGroupId);
    }
    if (stockItemId) {
      filters.push('si.id = ?');
      params.push(stockItemId);
    }
    // godownId and batchId to filter movement entries
    if (godownId) {
      filters.push('(ve.godownId = ?)');
      params.push(godownId);
    }
    if (batchId) {
      filters.push('(ve.batchId = ?)');
      params.push(batchId);
    }

    // Build WHERE clause string for filters (for voucher and movement filters)
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    /*

    Calculation logic:

    - sum inward quantity: sum qty where ve.type IN ('debit', 'destination')
    - sum outward quantity: sum qty where ve.type IN ('credit', 'source')
    - closing qty = openingBalance + inwardQty - outwardQty
    - closing value = closing qty * standardPurchaseRate or standardSaleRate depending on basis param
    - profit = (total sale value - total cost value) if showProfit

    */

    // SQL query to fetch stock item info and aggregated quantities from voucher entries linked to vouchers (filtered by date etc.)
    // Join stock_items si, voucher_entries ve, voucher_main vm
    // Aggregate inward/outward qty and amounts grouped by si.id

    const sql = `
      SELECT 
  si.id as itemId,
  si.name,
  si.unit,
  si.stockGroupId,
  si.openingBalance,
  si.standardPurchaseRate,
  si.standardSaleRate,
  SUM(CASE WHEN ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) as inwardValue,
  SUM(CASE WHEN ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) as outwardValue
FROM stock_items si
LEFT JOIN voucher_entries ve ON ve.item_id = si.id
LEFT JOIN voucher_main vm ON vm.id = ve.voucher_id
WHERE vm.date BETWEEN ? AND ?
GROUP BY si.id, si.name, si.unit, si.stockGroupId, si.openingBalance, si.standardPurchaseRate, si.standardSaleRate
ORDER BY si.name;


    `;

    const [rows] = await pool.query(sql, params);

    // Process rows to add closingQty, closingValue, profit
    const result = rows.map(row => {
      const inwardQty = Number(row.inwardQty) || 0;
      const outwardQty = Number(row.outwardQty) || 0;
      const openingBalance = Number(row.openingBalance) || 0;

      const closingQty = openingBalance + inwardQty - outwardQty;

      // Closing value calculation depends on basis param from frontend
      let closingValue = 0;
      if (basis === 'Cost') {
        closingValue = closingQty * (Number(row.standardPurchaseRate) || 0);
      } else if (basis === 'Value') {
        closingValue = closingQty * (Number(row.standardSaleRate) || 0);
      }

      // Calculate profit if requested
      let profit = 0;
      if (showProfit === 'true') {
        const saleValue = (Number(row.standardSaleRate) || 0) * outwardQty;
        const costValue = (Number(row.standardPurchaseRate) || 0) * outwardQty;
        profit = saleValue - costValue;
      }

      return {
        itemId: row.itemId,
        name: row.name,
        unit: row.unit,
        stockGroupId: row.stockGroupId,
        inwardQty,
        outwardQty,
        closingQty,
        closingValue,
        profit,
      };
    });

    res.json(result);
  }
  catch (err) {
    console.error('Error fetching stock summary:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
