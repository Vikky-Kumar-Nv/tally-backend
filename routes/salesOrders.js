const express = require('express');
const router = express.Router();
const db = require('../db'); // Your DB connection file

router.post('/', async (req, res) => {
  const {
    empId,
    date,
    number,
    referenceNo,
    partyId,
    salesLedgerId,
    orderRef,
    termsOfDelivery,
    dispatchDetails,
    entries,
    narration
  } = req.body;

  if (!empId || !date || !number || !partyId || !salesLedgerId || !entries || entries.length === 0) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const [orderResult] = await connection.query(
      `INSERT INTO sales_orders 
      (empId, date, number, referenceNo, partyId, salesLedgerId, orderRef, termsOfDelivery, destination, dispatchThrough, dispatchDocNo, narration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        empId,
        date,
        number,
        referenceNo,
        partyId,
        salesLedgerId,
        orderRef,
        termsOfDelivery,
        dispatchDetails?.destination || '',
        dispatchDetails?.through || '',
        dispatchDetails?.docNo || '',
        narration
      ]
    );

    const salesOrderId = orderResult.insertId;

    for (const entry of entries) {
      await connection.query(
        `INSERT INTO sales_order_items (salesOrderId, itemId, hsnCode, quantity, rate, discount, amount, godownId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          salesOrderId,
          entry.itemId,
          entry.hsnCode || '',
          entry.quantity,
          entry.rate,
          entry.discount || 0,
          entry.amount,
          entry.godownId || null
        ]
      );
    }

    await connection.commit();
    res.json({ success: true, message: 'Sales Order saved successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error saving Sales Order:', error);
    res.status(500).json({ success: false, message: 'Error saving Sales Order' });
  } finally {
    connection.release();
  }
});

module.exports = router;
