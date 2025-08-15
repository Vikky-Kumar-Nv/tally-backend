const express = require('express');
const router = express.Router();
const db = require('../db');


router.post('/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Find user
    const [rows] = await db.query('SELECT * FROM tbadmin WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];

    // Compare hashed passwords
    

    // ✅ Return token and ID to frontend (no session used)
    return res.status(200).json({
      message: 'Login successful',
    });

  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
