const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise connection

router.post('/', async (req, res) => {
    const { date, number, narration, employee_id, entries } = req.body;

    const [deliveryResult] = await db.query(
        `INSERT INTO delivery_items (date, number, narration, employee_id) VALUES (?, ?, ?, ?)`,
        [date, number, narration, employee_id]
    );

    const deliveryItemId = deliveryResult.insertId;

    const entryData = entries.map(entry => [
        deliveryItemId,
        entry.ledgerId,
        entry.quantity,
        entry.rate,
        entry.amount
    ]);

    await db.query(
        `INSERT INTO delivery_entries (delivery_item_id, ledger_id, quantity, rate, amount) VALUES ?`,
        [entryData]
    );

    res.status(201).json({ success: true });
});

module.exports = router;
