const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise pool

// Create Purchase Order
router.post('/', async (req, res) => {
  const {
    date,
    number,
    partyId,                 // Supplier/Party A/c Name
    purchaseLedgerId,        // Purchase Ledger
    referenceNo,
    narration,
    items = [],              // Array of items with qty, rate, amount
    dispatchDetails = {},
    orderRef,
    termsOfDelivery,
    expectedDeliveryDate,
    status = 'pending'       // pending, confirmed, partially_received, completed, cancelled
  } = req.body;

  if (!date || !partyId || !purchaseLedgerId || !items.length) {
    return res.status(400).json({ 
      message: 'Missing required fields: date, partyId, purchaseLedgerId, and items are required' 
    });
  }

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Insert into purchase_orders table
    const [orderResult] = await conn.execute(
      `INSERT INTO purchase_orders (
        date, number, party_id, purchase_ledger_id, reference_no, narration,
        order_ref, terms_of_delivery, expected_delivery_date, status,
        dispatch_destination, dispatch_through, dispatch_doc_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        date,
        number || null,
        partyId,
        purchaseLedgerId,
        referenceNo || null,
        narration || null,
        orderRef || null,
        termsOfDelivery || null,
        expectedDeliveryDate || null,
        status,
        dispatchDetails.destination || null,
        dispatchDetails.through || null,
        dispatchDetails.docNo || null
      ]
    );

    const purchaseOrderId = orderResult.insertId;

    // Insert items into purchase_order_items table
    for (const item of items) {
      if (!item.itemId || !item.quantity || !item.rate) {
        throw new Error('Each item must have itemId, quantity, and rate');
      }

      await conn.execute(
        `INSERT INTO purchase_order_items (
          purchase_order_id, item_id, hsn_code, quantity, rate, discount, amount, godown_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          purchaseOrderId,
          item.itemId,
          item.hsnCode || null,
          item.quantity,
          item.rate,
          item.discount || 0,
          item.amount || (item.quantity * item.rate - (item.discount || 0)),
          item.godownId || null
        ]
      );
    }

    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Purchase Order created successfully',
      purchaseOrderId,
      number: number || `PO${purchaseOrderId.toString().padStart(4, '0')}`
    });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Purchase Order creation failed:', err);
    res.status(500).json({
      message: 'Failed to create Purchase Order',
      error: err.message
    });
  }
});

// Get Purchase Order by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [orderRows] = await db.execute(
      `SELECT po.*, 
              p.name as party_name, p.gst_number as party_gst,
              pl.name as purchase_ledger_name
       FROM purchase_orders po
       LEFT JOIN parties p ON po.party_id = p.id
       LEFT JOIN ledgers pl ON po.purchase_ledger_id = pl.id
       WHERE po.id = ?`,
      [id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Purchase Order not found' });
    }

    const [itemRows] = await db.execute(
      `SELECT poi.*, si.name as item_name, si.unit, si.hsn_code as item_hsn
       FROM purchase_order_items poi
       LEFT JOIN stock_items si ON poi.item_id = si.id
       WHERE poi.purchase_order_id = ?
       ORDER BY poi.id`,
      [id]
    );

    const purchaseOrder = {
      ...orderRows[0],
      items: itemRows
    };

    res.json(purchaseOrder);

  } catch (err) {
    console.error('Error fetching Purchase Order:', err);
    res.status(500).json({
      message: 'Failed to fetch Purchase Order',
      error: err.message
    });
  }
});

// Get all Purchase Orders with filters
router.get('/', async (req, res) => {
  const { 
    status, 
    partyId, 
    fromDate, 
    toDate, 
    page = 1, 
    limit = 50 
  } = req.query;

  try {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (status) {
      whereClause += ' AND po.status = ?';
      params.push(status);
    }

    if (partyId) {
      whereClause += ' AND po.party_id = ?';
      params.push(partyId);
    }

    if (fromDate) {
      whereClause += ' AND po.date >= ?';
      params.push(fromDate);
    }

    if (toDate) {
      whereClause += ' AND po.date <= ?';
      params.push(toDate);
    }

    const offset = (page - 1) * limit;

    const [rows] = await db.execute(
      `SELECT po.id, po.date, po.number, po.status, po.narration,
              p.name as party_name, p.gst_number as party_gst,
              pl.name as purchase_ledger_name,
              COUNT(poi.id) as item_count,
              SUM(poi.amount) as total_amount
       FROM purchase_orders po
       LEFT JOIN parties p ON po.party_id = p.id
       LEFT JOIN ledgers pl ON po.purchase_ledger_id = pl.id
       LEFT JOIN purchase_order_items poi ON po.id = poi.purchase_order_id
       ${whereClause}
       GROUP BY po.id
       ORDER BY po.date DESC, po.id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get total count for pagination
    const [countRows] = await db.execute(
      `SELECT COUNT(DISTINCT po.id) as total
       FROM purchase_orders po
       LEFT JOIN parties p ON po.party_id = p.id
       ${whereClause}`,
      params
    );

    res.json({
      purchaseOrders: rows,
      pagination: {
        total: countRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countRows[0].total / limit)
      }
    });

  } catch (err) {
    console.error('Error fetching Purchase Orders:', err);
    res.status(500).json({
      message: 'Failed to fetch Purchase Orders',
      error: err.message
    });
  }
});

// Update Purchase Order status
router.put('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const validStatuses = ['pending', 'confirmed', 'partially_received', 'completed', 'cancelled'];
  
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      message: 'Invalid status. Valid statuses: ' + validStatuses.join(', ')
    });
  }

  try {
    const [result] = await db.execute(
      `UPDATE purchase_orders 
       SET status = ?, remarks = ?, updated_at = NOW()
       WHERE id = ?`,
      [status, remarks || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Purchase Order not found' });
    }

    res.json({ 
      message: 'Purchase Order status updated successfully',
      status 
    });

  } catch (err) {
    console.error('Error updating Purchase Order status:', err);
    res.status(500).json({
      message: 'Failed to update Purchase Order status',
      error: err.message
    });
  }
});

// Delete Purchase Order
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Check if purchase order exists and can be deleted
    const [orderRows] = await conn.execute(
      'SELECT status FROM purchase_orders WHERE id = ?',
      [id]
    );

    if (orderRows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ message: 'Purchase Order not found' });
    }

    // Don't allow deletion if order is completed or has been partially received
    if (['completed', 'partially_received'].includes(orderRows[0].status)) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ 
        message: 'Cannot delete Purchase Order that has been received or completed' 
      });
    }

    // Delete items first (foreign key constraint)
    await conn.execute(
      'DELETE FROM purchase_order_items WHERE purchase_order_id = ?',
      [id]
    );

    // Delete purchase order
    await conn.execute(
      'DELETE FROM purchase_orders WHERE id = ?',
      [id]
    );

    await conn.commit();
    conn.release();

    res.json({ message: 'Purchase Order deleted successfully' });

  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Error deleting Purchase Order:', err);
    res.status(500).json({
      message: 'Failed to delete Purchase Order',
      error: err.message
    });
  }
});

module.exports = router;
