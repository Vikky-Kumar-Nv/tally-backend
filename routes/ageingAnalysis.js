const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 connection pool

// Helper to calculate days difference
function daysBetween(date1, date2) {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

router.get('/api/ageing-analysis', async (req, res) => {
  try {
    const {
      toDate,
      stockItemId,
      stockGroupId,
      godownId,
      batchId,
      basis = 'Quantity',
      showProfit = false,
    } = req.query;

    if (!toDate) {
      return res.status(400).json({ error: "'toDate' is required" });
    }

    const filters = [];
    const params = [];

    filters.push('vm.date <= ?');
    params.push(toDate);

    if (stockItemId) {
      filters.push('si.id = ?');
      params.push(stockItemId);
    }

    if (stockGroupId) {
      filters.push('si.stockGroupId = ?');
      params.push(stockGroupId);
    }

    if (godownId) {
      filters.push('ve.godown_id = ?');
      params.push(godownId);
    }

    if (batchId) {
      filters.push('si.batchNumber = ?');
      params.push(batchId);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    // Main query to get stock item info with latest transaction date
    const sql = `
      SELECT
        si.id as item_id,
        si.name as item_name,
        si.batchNumber,
        si.batchExpiryDate,
        MAX(vm.date) as transaction_date,
        si.openingBalance as quantity,
        si.standardPurchaseRate as rate
      FROM stock_items si
      LEFT JOIN voucher_entries ve ON ve.item_id = si.id
      LEFT JOIN voucher_main vm ON vm.id = ve.voucher_id
      ${whereClause}
      GROUP BY si.id, si.name, si.batchNumber, si.batchExpiryDate, si.openingBalance, si.standardPurchaseRate
      ORDER BY si.id ASC, transaction_date ASC
    `;

    const [rows] = await pool.query(sql, params);

    const ageingBuckets = [
      { label: '0-30 Days', from: 0, to: 30 },
      { label: '31-60 Days', from: 31, to: 60 },
      { label: '61-90 Days', from: 61, to: 90 },
      { label: '91-180 Days', from: 91, to: 180 },
      { label: 'Above 180 Days', from: 181, to: Infinity },
    ];

    const today = new Date(toDate);
    const result = {};

    for (const row of rows) {
      if (!row.transaction_date) {
        // Skip items with no transaction date
        continue;
      }

      if (!result[row.item_id]) {
        result[row.item_id] = {
          item: {
            id: row.item_id,
            name: row.item_name,
            batchNumber: row.batchNumber,
            batchExpiryDate: row.batchExpiryDate,
          },
          ageing: ageingBuckets.map(b => ({ label: b.label, qty: 0, value: 0 })),
          totalQty: 0,
          totalValue: 0,
        };
      }

      const ageDays = daysBetween(new Date(row.transaction_date), today);
      const bucket = ageingBuckets.find(b => ageDays >= b.from && ageDays <= b.to);

      if (bucket) {
        const idx = ageingBuckets.indexOf(bucket);
        const qty = +row.quantity || 0;
        const val = basis === 'cost' ? qty * row.rate : qty * row.rate; // Adjust if needed

        result[row.item_id].ageing[idx].qty += qty;
        result[row.item_id].ageing[idx].value += val;
        result[row.item_id].totalQty += qty;
        result[row.item_id].totalValue += val;
      }
    }

    res.json(Object.values(result));
  } catch (err) {
    console.error('Error fetching ageing analysis:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
