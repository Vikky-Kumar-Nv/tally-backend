const express = require('express');
const router = express.Router();
const db = require('../db'); // your db connection
const app = express();
const cors = require("cors");
app.use(cors());
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(`
  SELECT 
    l.id, 
    l.name, 
    l.group_id AS groupId, 
    l.opening_balance AS openingBalance, 
    l.balance_type AS balanceType,
    l.address, 
    l.email, 
    l.phone, 
    l.gst_number AS gstNumber, 
    l.pan_number AS panNumber,
    g.name AS groupName
  FROM ledgers l
  LEFT JOIN ledger_groups g ON l.group_id = g.id
`);


    res.json(rows);
  }  catch (err) {
  console.error("Error fetching ledgers:", err);
  res.status(500).json({ message: "Failed to fetch ledgers" });
}
});

// Get only Cash/Bank Ledgers (for Contra Voucher)
router.get('/cash-bank', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT 
        l.id, 
        l.name, 
        g.name AS groupName, 
        g.type AS groupType
      FROM ledgers l
      INNER JOIN ledger_groups g ON l.group_id = g.id
      WHERE g.type IN ('Cash', 'Bank')
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error fetching cash/bank ledgers:", err);
    res.status(500).json({ message: "Failed to fetch cash/bank ledgers" });
  }
});

// Create new ledger
router.post('/', async (req, res) => {
  const {
    name,
    groupId,
    openingBalance,
    balanceType,
    address,
    email,
    phone,
    gstNumber,
    panNumber
  } = req.body;

  try {
    const sql = `INSERT INTO ledgers 
      (name, group_id, opening_balance, balance_type, address, email, phone, gst_number, pan_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await db.execute(sql, [
      name,
      groupId,
      openingBalance,
      balanceType,
      address,
      email,
      phone,
      gstNumber,
      panNumber
    ]);

    res.status(201).json({ message: 'Ledger created successfully!' });
  } catch (err) {
    console.error('Ledger insert error:', err);
    res.status(500).json({ message: 'Failed to create ledger' });
  }
});

// Create multiple ledgers in bulk
router.post('/bulk', async (req, res) => {
  const { ledgers } = req.body;

  if (!ledgers || !Array.isArray(ledgers) || ledgers.length === 0) {
    return res.status(400).json({ message: 'Invalid ledgers data' });
  }

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    const sql = `INSERT INTO ledgers 
      (name, group_id, opening_balance, balance_type, address, email, phone, gst_number, pan_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const results = [];
    
    for (const ledger of ledgers) {
      const {
        name,
        groupId,
        openingBalance,
        balanceType,
        address,
        email,
        phone,
        gstNumber,
        panNumber
      } = ledger;

      // Validate required fields
      if (!name || !groupId) {
        throw new Error(`Missing required fields for ledger: ${name || 'Unknown'}`);
      }

      await connection.execute(sql, [
        name,
        groupId,
        openingBalance || 0,
        balanceType || 'debit',
        address || '',
        email || '',
        phone || '',
        gstNumber || '',
        panNumber || ''
      ]);

      results.push({ name, status: 'created' });
    }

    await connection.commit();
    res.status(201).json({ 
      message: `${results.length} ledger(s) created successfully!`,
      results 
    });
  } catch (err) {
    await connection.rollback();
    console.error('Bulk ledger insert error:', err);
    res.status(500).json({ 
      message: 'Failed to create ledgers', 
      error: err.message 
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
