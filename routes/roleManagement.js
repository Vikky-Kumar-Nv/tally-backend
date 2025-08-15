// routes/roleManagement.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper: Fetch permissions for a role
async function getRolePermissions(roleId) {
  const [rows] = await pool.query(`
    SELECT s.screen_name, p.permission_name
    FROM tbRolePermissions rp
      JOIN tbScreens s ON rp.screen_id = s.screen_id
      JOIN tbPermissions p ON rp.permission_id = p.permission_id
    WHERE rp.role_id = ?
  `, [roleId]);
  // Format as array of "screen.permission", e.g. "masters.view"
  return rows.map(r => `${r.screen_name}.${r.permission_name}`);
}

// GET /api/roles
router.get('/roles', async (req, res) => {
  const [roles] = await pool.query(`
    SELECT r.role_id AS id, r.role_name AS name, r.description,
      r.is_system AS isSystem, r.created_at, r.updated_at,
      (SELECT COUNT(*) FROM tbUserRoles ur WHERE ur.role_id = r.role_id) AS userCount
    FROM tbRoles r
    ORDER BY r.is_system DESC, r.role_name
  `);

  // Fetch permissions for each role (async)
  for (const role of roles) {
    role.permissions = await getRolePermissions(role.id);
  }

  res.json({ success: true, roles });
});
// GET /api/role-management/options
router.get('/role-management/options', async (req, res) => {
  const [permissions] = await pool.query(
    'SELECT permission_id as id, permission_name as name, description FROM tbPermissions'
  );
  const [screens] = await pool.query(
    'SELECT screen_id as id, screen_name as name, screen_path FROM tbScreens'
  );
  res.json({ success: true, permissions, screens });
});

// POST /api/roles
router.post('/roles', async (req, res) => {
  const { name, description, isSystem = false, permissions } = req.body;
  if (!name || !permissions) return res.status(400).json({ success: false, error: 'Role name & permissions required' });

  // Insert role
  const [result] = await pool.query(
    `INSERT INTO tbRoles (role_name, description, is_system) VALUES (?, ?, ?)`,
    [name, description || '', isSystem ? 1 : 0]
  );
  const roleId = result.insertId;

  // Insert RolePermissions
  for (const perm of permissions) {
    const screenId = perm.screen_id;
    for (const pid of perm.permission_ids) {
      await pool.query(
        `INSERT INTO tbRolePermissions (role_id, screen_id, permission_id) VALUES (?, ?, ?)`,
        [roleId, screenId, pid]
      );
    }
  }

  res.json({ success: true, roleId });
});
// PUT /api/roles/:roleId
router.put('/roles/:roleId', async (req, res) => {
  const roleId = req.params.roleId;
  const { name, description, permissions } = req.body;

  // Check if system role
  const [[role]] = await pool.query('SELECT is_system FROM tbRoles WHERE role_id = ?', [roleId]);
  if (role?.is_system) {
    return res.status(403).json({ success: false, error: 'System roles cannot be edited' });
  }

  // Update name/description
  await pool.query('UPDATE tbRoles SET role_name = ?, description = ? WHERE role_id = ?', [name, description, roleId]);

  // Replace RolePermissions
  await pool.query('DELETE FROM tbRolePermissions WHERE role_id = ?', [roleId]);
  if (permissions) {
    for (const perm of permissions) {
      const screenId = perm.screen_id;
      for (const pid of perm.permission_ids) {
        await pool.query(
          `INSERT INTO tbRolePermissions (role_id, screen_id, permission_id) VALUES (?, ?, ?)`,
          [roleId, screenId, pid]
        );
      }
    }
  }
  res.json({ success: true });
});
// DELETE /api/roles/:roleId
router.delete('/roles/:roleId', async (req, res) => {
  const roleId = req.params.roleId;
  const [[role]] = await pool.query('SELECT is_system FROM tbRoles WHERE role_id = ?', [roleId]);
  if (role?.is_system) {
    return res.status(403).json({ success: false, error: 'System roles cannot be deleted' });
  }
  const [[assign]] = await pool.query('SELECT COUNT(*) AS n FROM tbUserRoles WHERE role_id = ?', [roleId]);
  if (assign.n > 0) {
    return res.status(400).json({ success: false, error: 'Role assigned to users' });
  }
  await pool.query('DELETE FROM tbRolePermissions WHERE role_id = ?', [roleId]);
  await pool.query('DELETE FROM tbRoles WHERE role_id = ?', [roleId]);
  res.json({ success: true });
});



module.exports = router;
