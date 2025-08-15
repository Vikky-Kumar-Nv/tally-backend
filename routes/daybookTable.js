const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                voucher_main.id AS voucherId,
                voucher_main.voucher_number AS voucherNo,
                voucher_main.voucher_type AS voucherType,
                voucher_main.supplier_invoice_date AS supplier_invoice_date,
                COUNT(DISTINCT debit_note_entries.id) + COUNT(DISTINCT credit_voucher_double_entry.id) AS entriesCount,
                COALESCE(SUM(debit_note_entries.amount), 0) AS totalDebit,
                COALESCE(SUM(credit_voucher_double_entry.amount), 0) AS totalCredit
            FROM voucher_main
            LEFT JOIN debit_note_entries ON debit_note_entries.voucher_id = voucher_main.id
            LEFT JOIN credit_voucher_double_entry ON credit_voucher_double_entry.voucher_id = voucher_main.id
            GROUP BY voucher_main.id, voucher_main.voucher_number, voucher_main.voucher_type
            ORDER BY voucher_main.voucher_type, voucher_main.voucher_number,voucher_main.supplier_invoice_date;
        `);

        let totalDebit = 0;
        let totalCredit = 0;
        let vouchersCount = 0;

        const groupedVouchers = rows.map(row => {
            totalDebit += parseFloat(row.totalDebit);
            totalCredit += parseFloat(row.totalCredit);
            vouchersCount += parseInt(row.entriesCount);
            return {
                voucherId: row.voucherId,
                voucherNo: row.voucherNo,
                voucherType: row.voucherType,
                entriesCount: row.entriesCount,
                supplier_invoice_date:row.supplier_invoice_date,
                totalDebit: parseFloat(row.totalDebit),
                totalCredit: parseFloat(row.totalCredit),
            };
        });

        res.json({
            groupedVouchers,
            totalDebit,
            totalCredit,
            netDifference: totalDebit - totalCredit,
            vouchersCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Something went wrong.' });
    }
});

module.exports = router;
