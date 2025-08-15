const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');

router.post('/company', async (req, res) => {
  // ✅ Extract emp_id from frontend (localStorage → request body)
  // const employeeId = req.body.employeeId;

//   if (!employeeId) {
//     return res.status(401).json({ message: 'Unauthorized. Employee ID missing.' });
//   }

  const {
    name,
    financialYear,
    booksBeginningYear,
    address,
    pin,
    phoneNumber,
    email,
    panNumber,
    gstNumber,
    vatNumber,
    state,
    country,
    taxType,
    vaultPassword,
    accessControlEnabled,
    username,
    password,
    employeeId
  } = req.body;

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // 1️⃣ Insert company
    const [companyResult] = await connection.query(`
      INSERT INTO tbcompanies (
        name, financial_year, books_beginning_year, address, pin,
        phone_number, email, pan_number, gst_number, vat_number,
        state, country, tax_type, employee_id, vault_password
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      financialYear,
      booksBeginningYear,
      address,
      pin,
      phoneNumber,
      email,
      panNumber,
      taxType === "GST" ? gstNumber : null,
      taxType === "VAT" ? vatNumber : null,
      state,
      country,
      taxType,
      employeeId, // ✅ from request body
      vaultPassword || null
    ]);

    const companyId = companyResult.insertId;

    // 2️⃣ Insert Access Control if enabled
    if (accessControlEnabled && username && password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await connection.query(`
        INSERT INTO tbUsers (company_id, username, password)
        VALUES (?, ?, ?)
      `, [companyId, username, hashedPassword]);
    }

    await connection.commit();
    connection.release();
    console.log("Employee ID received:", employeeId);
    console.log("Full payload:", req.body);

    return res.status(201).json({
      
      message: 'Company created successfully',
      companyId
    });

  } catch (err) {
    await connection.rollback();
    connection.release();
    console.error("❌ Company creation error:", err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
