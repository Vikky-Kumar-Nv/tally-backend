const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. List all roles with user count and descriptions
router.get('/roles', async (req, res) => {
  const [roles] = await pool.query(`
    SELECT r.id, r.role_name as name, r.description,
      (
        SELECT COUNT(*) FROM tbuser_roles ur WHERE ur.role_id = r.id
      ) as userCount
    FROM tbroles r
    ORDER BY r.role_name
  `);

  // Add a color value (just as a static map like your UI for demo)
  const colorMap = ['purple','blue','green','gray','red','yellow','indigo','cyan'];
  roles.forEach((r, i) => r.color = colorMap[i % colorMap.length]);

  res.json({ success: true, roles });
});

// 2. Get all modules and assignable permissions (for the matrix/grid)
router.get('/modules', async (req, res) => {
  // Example: privilege_name = 'masters.edit' → module: Masters, permission: edit
  const [privs] = await pool.query('SELECT * FROM tbprivileges ORDER BY privilege_name');
  const modules = {};
  for (const priv of privs) {
    const [module, action] = priv.privilege_name.split('.');
    if (!modules[module]) modules[module] = [];
    modules[module].push(action);
  }
  // Reformat for your screen: [{name:'Masters', permissions:['view','edit',...]}, ...]
  const moduleList = Object.entries(modules).map(([name, permissions]) => ({
    name,
    permissions
  }));
  res.json({ success: true, modules: moduleList });
});

// 3. Get permissions for a role (returns: { [module]: string[] })
router.get('/roles/:roleId/permissions', async (req, res) => {
  const roleId = req.params.roleId;
  const [rows] = await pool.query(`
    SELECT p.privilege_name
    FROM tbrole_privileges rp
    JOIN tbprivileges p ON rp.privilege_id = p.id
    WHERE rp.role_id = ?
  `, [roleId]);

  // Map to { module: [perm, ...] }
  const perms = {};
  for (const { privilege_name } of rows) {
    const [mod, action] = privilege_name.split('.');
    if (!perms[mod]) perms[mod] = [];
    perms[mod].push(action);
  }
  res.json({ success: true, permissions: perms });
});

// 4. Update (set) permissions for a role (replace all permissions)
router.put('/roles/:roleId/permissions', async (req, res) => {
  const roleId = req.params.roleId;
  const perms = req.body.permissions; // should be { [module]: [action, ...], ... }

  if (!perms || typeof perms !== 'object') {
    return res.status(400).json({ success: false, error: "permissions must be an object" });
  }

  // Flatten to privilege_names
  const privNames = [];
  for (const [mod, actions] of Object.entries(perms)) {
    for (const action of actions) {
      privNames.push(`${mod}.${action}`);
    }
  }

  // Get all privilege ids
  let privilegeMap = {};
  if (privNames.length) {
    const [privRows] = await pool.query(
      `SELECT id, privilege_name FROM tbprivileges WHERE privilege_name IN (${privNames.map(()=>'?').join(',')})`,
      privNames
    );
    privRows.forEach(row => privilegeMap[row.privilege_name] = row.id);
  }

  // Replace role's privileges
  await pool.query('DELETE FROM tbrole_privileges WHERE role_id = ?', [roleId]);
  if (privNames.length) {
    for (const privName of privNames) {
      const privId = privilegeMap[privName];
      if (privId)
        await pool.query('INSERT INTO tbrole_privileges (role_id, privilege_id) VALUES (?, ?)', [roleId, privId]);
    }
  }
  res.json({ success: true, message: 'Role permissions updated' });
});

// 5. Create new role
router.post('/roles', async (req, res) => {
  const { roleName, description } = req.body;
  if (!roleName) return res.status(400).json({ success: false, error: 'roleName required' });

  // Check for unique role name
  const [exist] = await pool.query('SELECT id FROM tbroles WHERE role_name = ?', [roleName]);
  if (exist.length) return res.status(400).json({ success: false, error: 'Role already exists' });

  const [result] = await pool.query(
    'INSERT INTO tbroles (role_name, description) VALUES (?, ?)',
    [roleName, description || '']
  );
  res.json({ success: true, roleId: result.insertId });
});

// 6. Delete role
router.delete('/roles/:roleId', async (req, res) => {
  const roleId = req.params.roleId;
  // Check for assignment
  const [assigned] = await pool.query('SELECT COUNT(*) as n FROM tbuser_roles WHERE role_id = ?', [roleId]);
  if (assigned[0].n > 0) return res.status(400).json({ success: false, error: 'Role assigned to some users' });

  await pool.query('DELETE FROM tbrole_privileges WHERE role_id = ?', [roleId]);
  await pool.query('DELETE FROM tbroles WHERE id = ?', [roleId]);
  res.json({ success: true, message: 'Role deleted' });
});

module.exports = router;
