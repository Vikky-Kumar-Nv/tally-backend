const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql2 pool connection

// GET all stock items with optional joins
router.get('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.execute(`
      SELECT 
        s.id,
        s.name,
        s.stockGroupId,
        sg.name AS stockGroupName,
        s.unit,
        u.name AS unitName,
        s.openingBalance,
        s.hsnCode,
        s.gstRate,
    s.batchNumber,
        s.batchExpiryDate,
        s.batchManufacturingDate,
        s.taxType
      FROM stock_items s
      LEFT JOIN stock_groups sg ON s.stockGroupId = sg.id
      LEFT JOIN stock_units u ON s.unit = u.id
    `);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("🔥 Error fetching stock items:", err);
    res.status(500).json({ success: false, message: 'Error fetching stock items' });
  } finally {
    connection.release();
  }
});



router.post('/', async (req, res) => {
  const connection = await db.getConnection(); // ✅ get a connection

  try {
    await connection.beginTransaction(); // ✅ begin transaction

    const {
        name, stockGroupId, unit, openingBalance, openingValue,
        hsnCode, gstRate, taxType, standardPurchaseRate, standardSaleRate,
        enableBatchTracking, allowNegativeStock, maintainInPieces, secondaryUnit,
        batchName, batchExpiryDate, batchManufacturingDate,
        godownAllocations = []
      } = req.body;

    const values = [
      name, stockGroupId ?? null, unit ?? null,
      openingBalance ?? 0, openingValue ?? 0, hsnCode ?? null, gstRate ?? 0,
      taxType ?? 'Taxable', standardPurchaseRate ?? 0, standardSaleRate ?? 0,
      enableBatchTracking ? 1 : 0, allowNegativeStock ? 1 : 0,
      maintainInPieces ? 1 : 0, secondaryUnit ?? null,
      batchName ?? null, batchExpiryDate ?? null, batchManufacturingDate ?? null,
    ];

    // Insert stock item
    const [result] = await connection.execute(`
      INSERT INTO stock_items (
    name, stockGroupId, unit, openingBalance, openingValue,
    hsnCode, gstRate, taxType, standardPurchaseRate, standardSaleRate,
    enableBatchTracking, allowNegativeStock, maintainInPieces, secondaryUnit,
    batchNumber, batchExpiryDate, batchManufacturingDate
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, values);

    const stockItemId = result.insertId; // ✅ get inserted ID

    // Insert godown allocations
    for (const alloc of godownAllocations) {
      await connection.execute(`
        INSERT INTO godown_allocations (stockItemId, godownId, quantity, value)
        VALUES (?, ?, ?, ?)
      `, [
        stockItemId,
        alloc.godownId ?? null,
        alloc.quantity ?? 0,
        alloc.value ?? 0
      ]);
    }

    await connection.commit(); // ✅ commit transaction
    res.json({ success: true, message: 'Stock item saved successfully' });

  }  catch (err) {
  console.error("🔥 Error saving stock item:", err); // log full error
  await connection.rollback();
  res.status(500).json({ success: false, message: 'Error saving stock item' });
}
 finally {
    connection.release(); // ✅ always release the connection
  }
});

module.exports = router;
