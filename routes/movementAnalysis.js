const express = require('express');
const router = express.Router();
const pool = require('../db'); // your mysql2 connection pool

/**
 * GET /api/movement-analysis
 * Query params:
 *  - fromDate (YYYY-MM-DD)
 *  - toDate (YYYY-MM-DD)
 *  - itemId (optional)
 */
router.get('/api/movement-analysis', async (req, res) => {
  try {
    const { fromDate, toDate, itemId } = req.query;
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "'fromDate' and 'toDate' are required" });
    }

    const paramsForPurchase = [fromDate, toDate];
    const purchaseItemFilter = itemId ? 'AND pvi.itemId = ?' : '';

    if (itemId) paramsForPurchase.push(itemId);

    const purchaseSQL = `
      SELECT 
        pv.date AS date,
        'Purchase Voucher' AS voucherType,
        pv.number AS voucherNumber,
        pvi.itemId,
        it.name AS itemName,
        pvi.quantity,
        pvi.rate,
        pvi.amount,
        pvi.godownId
      FROM purchase_vouchers pv
      JOIN purchase_voucher_items pvi ON pv.id = pvi.voucherId
      JOIN items it ON pvi.itemId = it.id
      WHERE pv.date BETWEEN ? AND ?
      ${purchaseItemFilter}
    `;

    // Repeat similar logic for other subqueries (sales orders, sales vouchers, delivery_items, stock journal)

    // Example for sales orders:
    const paramsForSalesOrder = [fromDate, toDate];
    const salesOrderItemFilter = itemId ? 'AND soi.itemId = ?' : '';
    if (itemId) paramsForSalesOrder.push(itemId);
    const salesOrderSQL = `
      SELECT 
        so.date AS date,
        'Sales Order' AS voucherType,
        so.number AS voucherNumber,
        soi.itemId,
        it.name AS itemName,
        soi.quantity,
        soi.rate,
        soi.amount,
        soi.godownId
      FROM sales_orders so
      JOIN sales_order_items soi ON so.id = soi.salesOrderId
      JOIN items it ON soi.itemId = it.id
      WHERE so.date BETWEEN ? AND ?
      ${salesOrderItemFilter}
    `;

    // Construct full union:
    const fullSQL = `
      ${purchaseSQL}
      UNION ALL
      ${salesOrderSQL}
      -- Add other union queries as necessary
      ORDER BY date ASC, voucherType ASC, voucherNumber ASC
    `;

    // Combine params in same order as union queries
    const combinedParams = [...paramsForPurchase, ...paramsForSalesOrder /*, ...other params */];

    const [rows] = await pool.query(fullSQL, combinedParams);

    res.json(rows);
  } catch (err) {
    console.error("Error querying movement analysis:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
