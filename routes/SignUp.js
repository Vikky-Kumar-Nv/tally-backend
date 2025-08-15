const express = require('express');
const router = express.Router();
const db = require('../db'); // already a promise-based pool
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

require('dotenv').config(); // Load env variables
const JWT_SECRET = process.env.JWT_SECRET;

router.post('/register', async (req, res) => {
  console.log("📥 /register hit");

  const {
    firstName,
    lastName,
    email,
    companyName,
    phoneNumber,
    password
  } = req.body;

  if (!firstName || !lastName || !email || !password || !companyName || !phoneNumber) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    // 🔍 Check if email already exists
    const [existing] = await db.query(`SELECT id FROM tbemployees WHERE email = ?`, [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already registered' }); // 409 = Conflict
    }

    // 🔒 Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 📌 Generate JWT token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '7d' });

    // 📥 Insert into DB
    const sql = `
      INSERT INTO tbemployees (firstName, lastName, email, companyName, phoneNumber, password, token)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [
      firstName,
      lastName,
      email,
      companyName,
      phoneNumber,
      hashedPassword,
      token
    ]);

    console.log("✅ User inserted:", result.insertId);

    return res.status(200).json({
      message: 'User registered successfully',
      userId: result.insertId,
      token
    });

  } catch (err) {
    console.error('❌ DB Error:', err.message);
    return res.status(500).json({ message: 'Database error', error: err.message });
  }
});

module.exports = router;
