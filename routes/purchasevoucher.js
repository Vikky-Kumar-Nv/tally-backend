const express = require('express');
const router = express.Router();
const db = require('../db');

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

// POST Purchase Voucher
router.post('/', async (req, res) => {
  const {
    number , date, narration, partyId, referenceNo, supplierInvoiceDate,
    dispatchDetails, subtotal, cgstTotal, sgstTotal, igstTotal,
    discountTotal, total, entries, mode, purchaseLedgerId
  } = req.body;

  const dispatchDocNo = dispatchDetails?.docNo || null;
  const dispatchThrough = dispatchDetails?.through || null;
  const destination = dispatchDetails?.destination || null;

  let insertVoucherSql = '';
  let insertVoucherValues = [];
  let voucherId;

  if (mode === 'item-invoice') {
    insertVoucherSql = `
      INSERT INTO purchase_vouchers (
    number, date, supplierInvoiceDate, narration, partyId, referenceNo,
    dispatchDocNo, dispatchThrough, destination, purchaseLedgerId,
    subtotal, cgstTotal, sgstTotal, igstTotal, discountTotal, total
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    insertVoucherValues = [
      number ?? null, date ?? null, supplierInvoiceDate ?? null, narration ?? null, partyId ?? null, referenceNo ?? null,
      dispatchDocNo ?? null, dispatchThrough ?? null, destination ?? null, purchaseLedgerId ?? null,
      subtotal ?? 0, cgstTotal ?? 0, sgstTotal ?? 0, igstTotal ?? 0, discountTotal ?? 0, total ?? 0
    ];
  } else {
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

    if (itemEntries.length > 0) {
      const insertItemQuery = `
        INSERT INTO purchase_voucher_items (
          voucherId, itemId, quantity, rate, discount, cgstRate, sgstRate, igstRate, amount, godownId
        ) VALUES ?
      `;
      const itemValues = itemEntries.map(e => [
        voucherId?? null,
        e.itemId?? null,
        e.quantity?? null,
        e.rate?? null,
        e.discount ?? 0,
        e.cgstRate ?? 0,
        e.sgstRate ?? 0,
        e.igstRate ?? 0,
        e.amount ?? 0,
        e.godownId ?? null
      ]);
      await db.query(insertItemQuery, [itemValues]);
    }

    if (ledgerEntries.length > 0) {
      const insertLedgerQuery = `
        INSERT INTO voucher_entries (voucher_id, ledger_id, amount, entry_type) VALUES ?
      `;
      const ledgerValues = ledgerEntries.map(e => [
        voucherId,
        e.ledgerId,
        e.amount,
        e.type
      ]);
      await db.query(insertLedgerQuery, [ledgerValues]);
    }

    return res.status(200).json({
      message: 'Purchase voucher saved successfully',
      id: voucherId
    });

  } catch (err) {
    console.error('Purchase voucher save failed:', err);
    return res.status(500).json({ error: err.message || 'Something went wrong' });
  }
});

module.exports = router;
