// routes/assessee.js
const express = require('express');
const router = express.Router();
const db = require('../db'); // Your mysql2/promise pool connection


router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    employee_id,
    name,
    fatherName,
    dateOfBirth,
    pan,
    aadhar,
    email,
    phone,
    address,
    profession,
    category,
    assessmentYear,
    status,
  } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  if (!name || !pan || !email || !phone || !address || !address.line1 || !address.city) {
    return res.status(400).json({ error: 'Missing required assessee fields' });
  }

  try {
    const query = `
      UPDATE assessees
      SET 
        employee_id = ?, 
        name = ?, 
        father_name = ?, 
        date_of_birth = ?, 
        pan = ?, 
        aadhar = ?,
        email = ?, 
        phone = ?, 
        address_line1 = ?, 
        address_line2 = ?, 
        city = ?, 
        state = ?, 
        pincode = ?, 
        profession = ?, 
        category = ?, 
        assessment_year = ?, 
        status = ?
      WHERE id = ?
    `;

    const params = [
      employee_id,
      name,
      fatherName,
      dateOfBirth,
      pan,
      aadhar || null,
      email,
      phone,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
      profession,
      category,
      assessmentYear,
      status,
      id,
    ];

    const [result] = await db.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Assessee not found' });
    }

    // Return updated assessee data
    const updatedAssessee = {
      id: id.toString(),
      employee_id,
      name,
      fatherName,
      dateOfBirth,
      pan,
      aadhar,
      email,
      phone,
      address,
      profession,
      category,
      assessmentYear,
      status,
      createdDate: undefined, // Optionally fetch from DB if needed
    };

    res.json({ success: true, assessee: updatedAssessee });
  } catch (err) {
    console.error('DB Update Error:', err);
    res.status(500).json({ error: 'Failed to update assessee' });
  }
});










router.get('/', async (req, res) => {
  const { employee_id } = req.query;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id query parameter is required' });
  }

  try {
    const query = `
      SELECT 
        id, employee_id, name, father_name AS fatherName, date_of_birth AS dateOfBirth,
        pan, aadhar, email, phone,
        address_line1 AS line1, address_line2 AS line2, city, state, pincode,
        profession, category, assessment_year AS assessmentYear, status, created_date AS createdDate 
      FROM assessees
      WHERE employee_id = ?
      ORDER BY created_date DESC
    `;

    const [rows] = await db.query(query, [employee_id]);

    // Map rows to the frontend address structure
    const assessees = rows.map(row => ({
      id: row.id.toString(),
      employee_id: row.employee_id,
      name: row.name,
      fatherName: row.fatherName,
      dateOfBirth: row.dateOfBirth,
      pan: row.pan,
      aadhar: row.aadhar,
      email: row.email,
      phone: row.phone,
      address: {
        line1: row.line1,
        line2: row.line2,
        city: row.city,
        state: row.state,
        pincode: row.pincode,
      },
      profession: row.profession,
      category: row.category,
      assessmentYear: row.assessmentYear,
      status: row.status,
      createdDate: row.createdDate,
    }));

    res.json(assessees);
  } catch (err) {
    console.error('DB Fetch Error:', err);
    res.status(500).json({ error: 'Failed to fetch assessees' });
  }
});






// Create new assessee
router.post('/', async (req, res) => {
  const {
    employee_id,
    name,
    fatherName,
    dateOfBirth,
    pan,
    aadhar,
    email,
    phone,
    address,
    profession,
    category,
    assessmentYear,
    status,
  } = req.body;

  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  try {
    const query = `
      INSERT INTO assessees
      (employee_id, name, father_name, date_of_birth, pan, aadhar, email, phone,
       address_line1, address_line2, city, state, pincode, profession, category, assessment_year, status, created_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      employee_id,
      name,
      fatherName,
      dateOfBirth,
      pan,
      aadhar || null,
      email,
      phone,
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.pincode,
      profession,
      category,
      assessmentYear,
      status,
    ];

    const [result] = await db.query(query, params);

    // You can return the inserted data including id
    const insertedAssessee = {
      id: result.insertId.toString(),
      employee_id,
      name,
      fatherName,
      dateOfBirth,
      pan,
      aadhar,
      email,
      phone,
      address,
      profession,
      category,
      assessmentYear,
      status,
      createdDate: new Date().toISOString().split('T')[0],
    };

    res.json({ success: true, assessee: insertedAssessee });
  } catch (err) {
    console.error('DB Insert Error:', err);
    res.status(500).json({ error: 'Failed to insert assessee' });
  }
});

module.exports = router;
