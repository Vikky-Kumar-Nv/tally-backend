const express = require('express');
const router = express.Router();
const db = require('../db'); // mysql2/promise connection

router.get('/', async (req, res) => {
    const employeeId = req.params.employee_id;
    try {
        // Total Debit
        const [debitRows] = await db.query(`
            SELECT SUM(de.amount) AS totalDebit
            FROM voucher_main vm
            INNER JOIN debit_note_entries de ON vm.id = de.voucher_id
        `,);

        // Total Credit
        const [creditRows] = await db.query(`
            SELECT SUM(ce.amount) AS totalCredit
            FROM voucher_main vm
            INNER JOIN credit_voucher_accounts ce ON vm.id = ce.voucher_id
            
        `, );

        // Voucher Count
        const [voucherRows] = await db.query(`
            SELECT COUNT(*) AS count
            FROM voucher_main
        `);

        const totalDebit = debitRows[0].totalDebit || 0;
        const totalCredit = creditRows[0].totalCredit || 0;
        const vouchersCount = voucherRows[0].count || 0;

        res.json({
            totalDebit,
            totalCredit,
            netDifference: totalDebit - totalCredit,
            vouchersCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch totals' });
    }
});

module.exports = router;
