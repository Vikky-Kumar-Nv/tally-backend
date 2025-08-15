const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // use bcryptjs or bcrypt
const pool = require('../db'); // your mysql2 connection pool

// Helper to get full name from employee record
async function getUserFullName(employeeId) {
  const [[employee]] = await pool.query('SELECT firstName, lastName FROM tbemployees WHERE id = ?', [employeeId]);
  if (!employee) return '';
  return `${employee.firstName} ${employee.lastName}`.trim();
}

// Helper: Get roles and permissions for a user
async function getUserRolesAndPermissions(userId) {
  // Get roles linked to this user
  const [roles] = await pool.query(`
    SELECT r.role_id, r.role_name
    FROM tbUserRoles ur
    JOIN tbRoles r ON ur.role_id = r.role_id
    WHERE ur.user_id = ?
  `, [userId]);

  // For each role, get privileges
  let permissionsSet = new Set();
  for (const role of roles) {
    const [privs] = await pool.query(`
      SELECT p.permission_name
      FROM tbRolePermissions rp
      JOIN tbPermissions p ON rp.permission_id = p.permission_id 
      WHERE rp.role_id = ?
    `, [role.role_id]);
    privs.forEach(p => permissionsSet.add(p.permission_name));
  }

  return {
    roles: roles.map(r => r.role_name),
    permissions: Array.from(permissionsSet),
    primaryRole: roles.length > 0 ? roles[0].role_name : 'No Role'
  };
}

// GET /api/users
// Supports query params: search, status, role, pagination (optional)
router.get('/users', async (req, res) => {
  try {
    const { search = '', status = 'all', role = 'all' } = req.query;

    // Base query: Join tbUsers + employees + user roles + role name
    let sql = `
      SELECT 
        u.id, u.email, u.created_at,
        e.firstName, e.lastName,
        r.role_name
      FROM tbUsers u
      LEFT JOIN tbemployees e ON u.employee_id = e.id
      LEFT JOIN tbUserRoles ur ON u.id = ur.user_id
      LEFT JOIN tbRoles r ON ur.role_id = r.role_id
      WHERE 1=1
    `;

    const params = [];

    // Search filter on employee name or email
    if (search.trim() !== '') {
      sql += ` AND (CONCAT(e.firstName, ' ', e.lastName) LIKE ? OR u.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Status filter
    // if (status !== 'all') {
    //   sql += ` AND u.status = ?`;
    //   params.push(status);
    // }

    // Role filter
    if (role !== 'all') {
      sql += ` AND r.role_name = ?`;
      params.push(role);
    }

    sql += ' ORDER BY e.firstName, e.lastName, u.created_at DESC';

    const [rows] = await pool.query(sql, params);

    // Aggregate users by id to handle multiple roles (show primary role, permissions)
    const usersMap = new Map();

    // Fetch permissions and roles asynchronously for each user
    for (const userRow of rows) {
      if (!usersMap.has(userRow.id)) {
        const fullName = `${userRow.firstName} ${userRow.lastName}`.trim();
        const { roles: userRoles, permissions, primaryRole } = await getUserRolesAndPermissions(userRow.id);
        usersMap.set(userRow.id, {
          id: userRow.id,
          name: fullName || userRow.email,
          email: userRow.email,
          
          role: primaryRole,
          createdAt: userRow.created_at ? userRow.created_at.toISOString().slice(0, 10) : null,
          permissions,
        });
      }
    }

    res.json({ success: true, users: Array.from(usersMap.values()) });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/users — Create new user
router.post('/users', async (req, res) => {
  try {
    const { name, email, phone, role, department, password } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ success: false, error: 'Name, email, password, and role are required' });
    }

    // Split full name into first and last (simple split, adapt as needed)
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';

    // Check if employee with this name/email exists or create new employee
    let [[employee]] = await pool.query(
      'SELECT id FROM tbemployees WHERE firstName = ? AND lastName = ?',
      [firstName, lastName]
    );

    let employeeId;
    if (employee) {
      employeeId = employee.id;
    } else {
      // Insert new employee
      const [empResult] = await pool.query(
        `INSERT INTO tbemployees (firstName, lastName, email, phoneNumber) VALUES (?, ?, ?, ?)`,
        [firstName, lastName, email, phone]
      );
      employeeId = empResult.insertId;
    }

    // Check if user email already exists
    const [[existingUser]] = await pool.query('SELECT id FROM tbUsers WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert into tbUsers (status default 'active')
    const [userResult] = await pool.query(
      `INSERT INTO tbUsers (employee_id, email, password, created_at)
      VALUES (?, ?, ?, NOW())`,
      [employeeId, email, passwordHash]
    );
    const userId = userResult.insertId;

    // Get role_id from role name (assuming unique role names)
    const [[roleRow]] = await pool.query(
      `SELECT role_id FROM tbRoles WHERE role_name = ? LIMIT 1`,
      [role]
    );
    if (!roleRow) {
      return res.status(400).json({ success: false, error: 'Invalid role specified' });
    }
    const roleId = roleRow.role_id; // ✅ use correct column name

    // Insert into tbUserRoles
    await pool.query(
      'INSERT INTO tbUserRoles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );

    res.json({ success: true, message: 'User created', userId });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /api/users/:id/suspend — Change user status to suspended
// router.put('/users/:id/suspend', async (req, res) => {
//   try {
//     const userId = req.params.id;

//     // Change user status to suspended
//     await pool.query(`UPDATE tbUsers SET status = 'suspended' WHERE id = ?`, [userId]);

//     res.json({ success: true, message: 'User suspended' });
//   } catch (err) {
//     console.error('Error suspending user:', err);
//     res.status(500).json({ success: false, error: 'Internal Server Error' });
//   }
// });

// DELETE /api/users/:id — Delete user entirely
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Remove roles assigned first
    await pool.query('DELETE FROM tbUserRoles WHERE user_id = ?', [userId]);

    // Delete user record
    await pool.query('DELETE FROM tbUsers WHERE id = ?', [userId]);

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
// GET /api/roles/names - fetch all role names
router.get('/roles/names', async (req, res) => {
  try {
    const [roles] = await pool.query('SELECT role_name FROM tbRoles ORDER BY role_name');
    res.json({ success: true, roles: roles.map(r => r.role_name) });
  } catch (err) {
    console.error('Error fetching role names:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

module.exports = router;
