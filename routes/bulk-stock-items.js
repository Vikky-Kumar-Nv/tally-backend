const express = require('express');
const multer = require('multer');
const csvParse = require('csv-parse').parse; // <-- Correct!
const fs = require('fs');
const router = express.Router();
const db = require('../db'); // your mysql2 pool connection

const upload = multer({ dest: 'uploads/' });

// Basic validation helper
const validateItem = (item) => {
  const errors = [];
  if (!item.name || typeof item.name !== "string" || !item.name.trim()) {
    errors.push("Name is required");
  }
  if (!item.unit || typeof item.unit !== "string" || !item.unit.trim()) {
    errors.push("Unit is required");
  }
  if (typeof item.openingBalance !== "number" || item.openingBalance < 0) {
    errors.push("Opening Balance must be non-negative number");
  }
  if (typeof item.openingValue !== "number" || item.openingValue < 0) {
    errors.push("Opening Value must be non-negative number");
  }
  return errors;
};

// Helper: bulk insert function for reuse
async function bulkInsertItems(items, connection) {
  let successCount = 0;
  const errors = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const validationErrors = validateItem(item);
    if (validationErrors.length > 0) {
      errors.push({ index: i, errors: validationErrors });
      continue;
    }

    const values = [
      item.name,
      item.stockGroupId || null,
      item.unit,
      item.openingBalance || 0,
      item.openingValue || 0,
      item.hsnCode || null,
      item.gstRate || 0,
      item.taxType || "Taxable",
      item.standardPurchaseRate || 0,
      item.standardSaleRate || 0,
      item.enableBatchTracking ? 1 : 0,
      item.allowNegativeStock ? 1 : 0,
      item.maintainInPieces ? 1 : 0,
      item.secondaryUnit || '',
      item.batchName || item.batchNumber || null,
      item.batchExpiryDate ? new Date(item.batchExpiryDate) : null,
      item.batchManufacturingDate ? new Date(item.batchManufacturingDate) : null,
    ];

    try {
      const [result] = await connection.execute(
        `INSERT INTO stock_items
         (name, stockGroupId, unit, openingBalance, openingValue, hsnCode, gstRate, taxType,
          standardPurchaseRate, standardSaleRate, enableBatchTracking, allowNegativeStock,
          maintainInPieces, secondaryUnit, batchNumber, batchExpiryDate, batchManufacturingDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );

      const stockItemId = result.insertId;

      // Insert godown allocations if present
      if (Array.isArray(item.godownAllocations)) {
        for (const alloc of item.godownAllocations) {
          await connection.execute(
            `INSERT INTO godown_allocations (stockItemId, godownId, quantity, value)
             VALUES (?, ?, ?, ?)`,
            [
              stockItemId,
              alloc.godownId || null,
              alloc.quantity || 0,
              alloc.value || 0
            ]
          );
        }
      }

      successCount++;
    } catch (err) {
      errors.push({ index: i, errors: ['Database insert error'], detail: err.message });
    }
  }

  return { successCount, errors };
}

// POST bulk insert JSON array
router.post('/bulk', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "Request body must be a non-empty array" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { successCount, errors } = await bulkInsertItems(items, connection);

    await connection.commit();

    res.json({
      success: true,
      message: `Processed ${items.length} items.`,
      inserted: successCount,
      skipped: items.length - successCount,
      errors,
    });

  } catch (err) {
    await connection.rollback();
    console.error("Bulk stock insert error:", err);
    res.status(500).json({ success: false, message: "Internal server error during bulk insert", error: err.message });
  } finally {
    connection.release();
  }
});

// POST bulk upload CSV file and insert
router.post('/bulk-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'CSV file is required' });
  }

  const stream = fs.createReadStream(req.file.path);
  const items = [];

stream.pipe(csvParse({ columns: true, trim: true }))
    .on('data', row => {
      // Map CSV columns to your stock item fields
      items.push({
        name: row['Name'],
        unit: row['Unit'] || 'Piece',
        openingBalance: parseFloat(row['Opening Balance']) || 0,
        openingValue: parseFloat(row['Opening Value']) || 0,
        stockGroupId: null, // Optionally map stock group here from group name
        gstRate: parseFloat(row['GST Rate']) || 0,
        hsnCode: row['HSN Code'],
        taxType: row['Tax Type'],
        standardPurchaseRate: parseFloat(row['Purchase Rate']) || 0,
        standardSaleRate: parseFloat(row['Sale Rate']) || 0,
        enableBatchTracking: row['Enable Batch'] === 'true',
        allowNegativeStock: row['Allow Negative'] === 'true',
        maintainInPieces: row['Maintain Pieces'] === 'true',
        secondaryUnit: row['Secondary Unit'],
        batchName: row['Batch Name'] || null,
        batchExpiryDate: row['Batch Expiry Date'] || null,
        batchManufacturingDate: row['Batch Manufacturing Date'] || null,
        godownAllocations: [] // optionally extend this with CSV columns later
      });
    })
    .on('end', async () => {
      fs.unlinkSync(req.file.path); // delete temp file

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const { successCount, errors } = await bulkInsertItems(items, connection);

        await connection.commit();

        res.json({ success: true, inserted: successCount, errors });
      } catch (err) {
        await connection.rollback();
        res.status(500).json({ success: false, message: "Error during bulk CSV insert", error: err.message });
      } finally {
        connection.release();
      }
    })
    .on('error', err => {
      fs.unlinkSync(req.file.path);
      res.status(500).json({ success: false, message: "CSV parse error", error: err.message });
    });
});

module.exports = router;
