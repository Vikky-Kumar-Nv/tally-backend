const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql2/promise connection pool

router.get('/report', async (req, res) => {
  const {
    ledgerId,           // required
    fromDate,           // required, YYYY-MM-DD
    toDate,             // required, YYYY-MM-DD
    includeOpening,     // true/false
    includeClosing,     // true/false
  } = req.query;

  if (!ledgerId || !fromDate || !toDate) {
    return res.status(400).json({ success: false, message: 'Missing ledgerId, fromDate, or toDate' });
  }
  const connection = await db.getConnection();
  try {
    // Fetch master info
    const [ledRows] = await connection.execute(
      `SELECT l.*, g.name as groupName 
       FROM ledgers l LEFT JOIN ledger_groups g ON l.group_id = g.id 
       WHERE l.id = ?`, [ledgerId]
    );
    if (ledRows.length === 0) return res.status(404).json({ success: false, message: 'Ledger not found' });
    const ledger = ledRows[0];

    // Opening balance calculation (anything BEFORE fromDate)
    const [opRows] = await connection.execute(
      `SELECT 
        SUM(CASE WHEN ve.entry_type='debit' THEN ve.amount ELSE 0 END) as totalDebit,
        SUM(CASE WHEN ve.entry_type='credit' THEN ve.amount ELSE 0 END) as totalCredit
       FROM voucher_entries ve
         LEFT JOIN voucher_main vm ON ve.voucher_id = vm.id
       WHERE ve.ledger_id = ? AND vm.date < ?`,
      [ledgerId, fromDate]
    );
    const totalPreDebit = +opRows[0].totalDebit || 0;
    const totalPreCredit = +opRows[0].totalCredit || 0;
    let runningBalance =
      parseFloat(ledger.opening_balance) +
      (ledger.balance_type === 'debit'
        ? (totalPreDebit - totalPreCredit)
        : (totalPreCredit - totalPreDebit));

    // Fetch period transactions
    const [txns] = await connection.execute(
      `SELECT 
         vm.id as voucher_id,
         vm.voucher_type,
         vm.voucher_number,
         vm.date,
         ve.id as entry_id,
         ve.entry_type,
         ve.amount,
         ve.narration,
         ve.cheque_number,
         ve.bank_name
       FROM voucher_entries ve
         LEFT JOIN voucher_main vm ON ve.voucher_id = vm.id
       WHERE ve.ledger_id = ?
         AND vm.date >= ? AND vm.date <= ?
       ORDER BY vm.date ASC, vm.id ASC, ve.id ASC
      `,
      [ledgerId, fromDate, toDate]
    );

    // Build the result list and running balance
    const transactions = [];
    let balance = runningBalance;

    // Opening
    if (includeOpening === 'true') {
      transactions.push({
        id: 'opening',
        date: fromDate,
        particulars: 'Opening Balance',
        voucherType: '',
        voucherNo: '',
        debit: ledger.balance_type === 'debit' ? runningBalance : 0,
        credit: ledger.balance_type === 'credit' ? Math.abs(runningBalance) : 0,
        balance,
        narration: 'Opening as on ' + fromDate,
        isOpening: true,
        isClosing: false
      });
    }

    // Transactions
    txns.forEach(row => {
      let debit = row.entry_type === 'debit' ? +row.amount : 0;
      let credit = row.entry_type === 'credit' ? +row.amount : 0;

      // For running balance: add debits, subtract credits
      balance += debit - credit;
      transactions.push({
        id: row.entry_id,
        date: row.date,
        voucherType: row.voucher_type,
        voucherNo: row.voucher_number,
        particulars: row.narration || '-',
        debit, credit,
        balance,
        narration: row.narration,
        chequeNo: row.cheque_number,
        bankName: row.bank_name,
        isOpening: false,
        isClosing: false,
      });
    });

    // Closing
    if (includeClosing === 'true') {
      transactions.push({
        id: 'closing',
        date: toDate,
        particulars: 'Closing Balance',
        voucherType: '',
        voucherNo: '',
        debit: balance < 0 ? Math.abs(balance) : 0,
        credit: balance > 0 ? balance : 0,
        balance: 0,
        narration: 'Closing as on ' + toDate,
        isOpening: false,
        isClosing: true
      });
    }

    // Response
    res.json({
      success: true,
      ledger: {
        id: ledger.id,
        name: ledger.name,
        groupId: ledger.group_id,
        groupName: ledger.groupName,
        openingBalance: ledger.opening_balance,
        balanceType: ledger.balance_type,
        address: ledger.address,
        email: ledger.email,
        phone: ledger.phone,
        gst_number: ledger.gst_number,
        pan_number: ledger.pan_number
      },
      transactions,
      summary: {
        openingBalance: runningBalance,
        closingBalance: balance,
        totalDebit: txns.reduce((s, row) => s + (row.entry_type === 'debit' ? +row.amount : 0), 0),
        totalCredit: txns.reduce((s, row) => s + (row.entry_type === 'credit' ? +row.amount : 0), 0),
        transactionCount: txns.length
      }
    });
  } catch (err) {
    console.error('Error in ledger report:', err);
    res.status(500).json({ success: false, message: 'Internal error' });
  } finally {
    connection.release();
  }
});

module.exports = router;
