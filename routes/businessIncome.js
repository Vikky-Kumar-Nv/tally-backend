const express = require('express');
const router = express.Router();
const db = require('../db'); // your mysql2/promise pool

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [result] = await db.query('DELETE FROM business_incomes WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Business income record not found' });
    }

    res.json({ success: true, message: 'Business income record deleted successfully' });
  } catch (error) {
    console.error('Error deleting business income:', error);
    res.status(500).json({ error: 'Failed to delete business income' });
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
        id, employee_id, business_name, business_type, registration_number, financial_year,
        gross_receipts, gross_turnover, other_income, total_income,
        purchase_of_trading_goods, direct_expenses, employee_benefits, financial_charges,
        depreciation, other_expenses, total_expenses, net_profit_loss,
        section44AD, section44ADA, section44AB, presumptive_income, audit_required,
        books_profit_loss, additions, deductions, computed_income, status, created_date
      FROM business_incomes
      WHERE employee_id = ?
      ORDER BY created_date DESC
    `;

    const [rows] = await db.query(query, [employee_id]);

    // Map results to camelCase keys to match frontend model if needed
    const businessIncomes = rows.map(row => ({
      id: row.id.toString(),
      employee_id: row.employee_id,
      businessName: row.business_name,
      businessType: row.business_type,
      registrationNumber: row.registration_number,
      financialYear: row.financial_year,
      grossReceipts: Number(row.gross_receipts),
      grossTurnover: Number(row.gross_turnover),
      otherIncome: Number(row.other_income),
      totalIncome: Number(row.total_income),
      purchaseOfTradingGoods: Number(row.purchase_of_trading_goods),
      directExpenses: Number(row.direct_expenses),
      employeeBenefits: Number(row.employee_benefits),
      financialCharges: Number(row.financial_charges),
      depreciation: Number(row.depreciation),
      otherExpenses: Number(row.other_expenses),
      totalExpenses: Number(row.total_expenses),
      netProfitLoss: Number(row.net_profit_loss),
      section44AD: Boolean(row.section44AD),
      section44ADA: Boolean(row.section44ADA),
      section44AB: Boolean(row.section44AB),
      presumptiveIncome: Number(row.presumptive_income),
      auditRequired: Boolean(row.audit_required),
      booksProfitLoss: Number(row.books_profit_loss),
      additions: Number(row.additions),
      deductions: Number(row.deductions),
      computedIncome: Number(row.computed_income),
      status: row.status,
      createdDate: row.created_date ? new Date(row.created_date).toISOString().split('T')[0] : null,
    }));

    res.json(businessIncomes);
  } catch (error) {
    console.error('Error fetching business incomes:', error);
    res.status(500).json({ error: 'Failed to fetch business incomes' });
  }
});











// Create new Business Income
router.post('/', async (req, res) => {
  const {
    employee_id,
    businessName,
    businessType,
    registrationNumber,
    financialYear,
    grossReceipts,
    grossTurnover,
    otherIncome,
    totalIncome,
    purchaseOfTradingGoods,
    directExpenses,
    employeeBenefits,
    financialCharges,
    depreciation,
    otherExpenses,
    totalExpenses,
    netProfitLoss,
    section44AD,
    section44ADA,
    section44AB,
    presumptiveIncome,
    auditRequired,
    booksProfitLoss,
    additions,
    deductions,
    computedIncome,
    status
  } = req.body;

  if ( !businessName || !businessType || !financialYear) {
    return res.status(400).json({ error: 'Missing required business income fields' });
  }

  try {
    const query = `
      INSERT INTO business_incomes (employee_id,
         business_name, business_type, registration_number, financial_year,
        gross_receipts, gross_turnover, other_income, total_income,
        purchase_of_trading_goods, direct_expenses, employee_benefits, financial_charges,
        depreciation, other_expenses, total_expenses, net_profit_loss,
        section44AD, section44ADA, section44AB, presumptive_income, audit_required,
        books_profit_loss, additions, deductions, computed_income, status, created_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const params = [
      employee_id,
      businessName,
      businessType,
      registrationNumber || null,
      financialYear,
      grossReceipts || 0,
      grossTurnover || 0,
      otherIncome || 0,
      totalIncome || 0,
      purchaseOfTradingGoods || 0,
      directExpenses || 0,
      employeeBenefits || 0,
      financialCharges || 0,
      depreciation || 0,
      otherExpenses || 0,
      totalExpenses || 0,
      netProfitLoss || 0,
      section44AD ? 1 : 0,
      section44ADA ? 1 : 0,
      section44AB ? 1 : 0,
      presumptiveIncome || 0,
      auditRequired ? 1 : 0,
      booksProfitLoss || 0,
      additions || 0,
      deductions || 0,
      computedIncome || 0,
      status || 'draft'
    ];

    const [result] = await db.query(query, params);

    const insertedRecord = {
      id: result.insertId.toString(),
      employee_id,
      businessName,
      businessType,
      registrationNumber,
      financialYear,
      grossReceipts,
      grossTurnover,
      otherIncome,
      totalIncome,
      purchaseOfTradingGoods,
      directExpenses,
      employeeBenefits,
      financialCharges,
      depreciation,
      otherExpenses,
      totalExpenses,
      netProfitLoss,
      section44AD,
      section44ADA,
      section44AB,
      presumptiveIncome,
      auditRequired,
      booksProfitLoss,
      additions,
      deductions,
      computedIncome,
      status,
      createdDate: new Date().toISOString().split('T')[0],
    };

    res.json({ success: true, businessIncome: insertedRecord });
  } catch (error) {
    console.error('Insert Business Income error:', error);
    res.status(500).json({ error: 'Failed to insert business income' });
  }
});

module.exports = router;
