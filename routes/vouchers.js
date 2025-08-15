const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool

router.post('/', async (req, res) => {
  const {
    type,                  // e.g. "payment", "receipt", "journal", "contra"
    mode,                  // optional: "single-entry", "double-entry"
    date,
    number,
    narration,
    referenceNo,
    supplierInvoiceDate,
    entries = []
  } = req.body;

  if (!type || !date || !entries.length) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Insert into voucher_main
    const [voucherResult] = await conn.execute(
      `INSERT INTO voucher_main (voucher_type, voucher_number, date, narration, reference_no, supplier_invoice_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        type,
        number || null,
        date,
        narration || null,
        referenceNo || null,
        supplierInvoiceDate || null
      ]
    );

    const voucherId = voucherResult.insertId;

    // Insert multiple voucher_entries
    const entryValues = entries.map(entry => [
      voucherId,
      entry.ledgerId,
      parseFloat(entry.amount || 0),
      entry.type || 'debit',
      entry.narration || null,
      entry.bankName || null,
      entry.chequeNumber || null,
      entry.costCentreId || null
    ]);

    await conn.query(
      `INSERT INTO voucher_entries 
        (voucher_id, ledger_id, amount, entry_type, narration, bank_name, cheque_number, cost_centre_id)
       VALUES ?`,
      [entryValues]
    );

    await conn.commit();
    conn.release();

    res.status(200).json({
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} voucher saved successfully`
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Voucher save failed:', err);
    res.status(500).json({
      message: 'Failed to save voucher',
      error: err.message
    });
  }
});

module.exports = router;
