const express = require('express');
const router = express.Router();
const db = require('../db'); // Make sure db is using mysql2.promise()

// GET Ledgers
router.get('/ledgers', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM ledgers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Items
router.get('/items', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM items');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Sales Voucher
router.post('/vouchers', async (req, res) => {
  const {
    number, date, narration, partyId, referenceNo,
    dispatchDetails, subtotal, cgstTotal, sgstTotal,
    igstTotal, discountTotal, total, entries
  } = req.body;

  const dispatchDocNo = dispatchDetails?.docNo || null;
  const dispatchThrough = dispatchDetails?.through || null;
  const destination = dispatchDetails?.destination || null;
  const { voucherMode } = req.body; // Either 'sales' or 'accounting
let insertVoucherSql = '';
let insertVoucherValues = [];
let voucherId;
  if (voucherMode === 'item-invoice') {
  insertVoucherSql = `
    INSERT INTO sales_vouchers (number, date, narration, partyId, referenceNo,
      dispatchDocNo, dispatchThrough, destination, subtotal, cgstTotal,
      sgstTotal, igstTotal, discountTotal, total)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  insertVoucherValues = [
    number ?? null, date ?? null, narration ?? null, partyId ?? null, referenceNo ?? null,
    dispatchDocNo ?? null, dispatchThrough ?? null, destination ?? null,
    subtotal ?? 0, cgstTotal ?? 0, sgstTotal ?? 0, igstTotal ?? 0, discountTotal ?? 0, total ?? 0
  ];
} else {
  // Default to accounting mode
  insertVoucherSql = `
    INSERT INTO voucher_main (voucher_number, date, narration)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  insertVoucherValues = [
    number ?? null, date ?? null, narration ?? null  ?? 0
  ];
}

  try {
    const [voucherResult] = await db.execute(insertVoucherSql, insertVoucherValues);
voucherId = voucherResult.insertId;

    const itemEntries = entries.filter(e => e.itemId);
    const ledgerEntries = entries.filter(e => e.ledgerId);

    const insertItemQuery = `INSERT INTO sales_voucher_items (voucherId, itemId, quantity, rate, amount) VALUES ?`;
    const itemValues = itemEntries.map(e => [
      voucherId,
      e.itemId,
      e.quantity,
      e.rate,
      e.quantity * e.rate
    ]);

    const insertLedgerQuery = `INSERT INTO voucher_entries (voucher_id, ledger_id, amount, entry_type) VALUES ?`;
    const ledgerValues = ledgerEntries.map(e => [
      voucherId,
      e.ledgerId,
      e.amount,
      e.type
    ]);

    if (itemValues.length > 0) {
      await db.query(insertItemQuery, [itemValues]);
    }

    if (ledgerValues.length > 0) {
      await db.query(insertLedgerQuery, [ledgerValues]);
    }

    return res.status(200).json({
      message: 'Voucher saved successfully',
      id: voucherId
    });

  } catch (err) {
    console.error('Voucher save failed:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

module.exports = router;
