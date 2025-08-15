const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/trial-balance
router.get('/api/trial-balance', async (req, res) => {
  try {
    // Fetch ledger groups first
    const [ledgerGroups] = await db.query('SELECT * FROM ledger_groups');

    // Fetch ledgers with their group info
    const [ledgers] = await db.query(`
      SELECT 
        l.id, l.name, l.group_id, l.opening_balance, l.balance_type,
        lg.name as group_name, lg.type AS group_type
      FROM ledgers l
      LEFT JOIN ledger_groups lg ON l.group_id = lg.id
      ORDER BY lg.type, lg.name, l.name
    `);

    // Aggregate data by group type (string -> group container)
    // This matches your frontend groupedData structure
    const groups = {};

    ledgers.forEach(ledger => {
      const groupType = ledger.group_type || 'Ungrouped';
      const groupName = ledger.group_name || 'Ungrouped';

      if (!groups[groupType]) {
        groups[groupType] = {
          groupName,
          groupType,
          ledgers: [],
          total: { debit: 0, credit: 0 }
        };
      }

      // Calculate debit and credit balance
      const debitAmt = ledger.balance_type === 'debit' ? parseFloat(ledger.opening_balance) : 0;
      const creditAmt = ledger.balance_type === 'credit' ? parseFloat(ledger.opening_balance) : 0;

      groups[groupType].ledgers.push({
        id: ledger.id,
        name: ledger.name,
        groupId: ledger.group_id,
        openingBalance: parseFloat(ledger.opening_balance),
        balanceType: ledger.balance_type
      });

      groups[groupType].total.debit += debitAmt;
      groups[groupType].total.credit += creditAmt;
    });

    // Calculate overall totals
    const totalDebit = ledgers.reduce((sum, ledger) => 
      sum + (ledger.balance_type === 'debit' ? parseFloat(ledger.opening_balance) : 0), 0);
    const totalCredit = ledgers.reduce((sum, ledger) => 
      sum + (ledger.balance_type === 'credit' ? parseFloat(ledger.opening_balance) : 0), 0);

    res.json({
      groupedData: groups,
      totalDebit,
      totalCredit
    });

  } catch (err) {
    console.error('Error fetching trial balance:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
