const express = require('express');
const router = express.Router();
const pool = require('../db');

const inflowVoucherTypes = ['receipt', 'sales', 'receipt'];      // Set your actual types
const outflowVoucherTypes = ['payment', 'purchase', 'payment'];  // Set your actual types

function getFinancialYearDates(finYear) {
  const [startYear, endYear] = finYear.split('-').map(y => {
    if (y.length === 2) return parseInt('20' + y);
    else return parseInt(y);
  });
  const startDate = `${startYear}-04-01`;
  const endDate = `${endYear}-03-31`;
  return { startDate, endDate };
}

router.get('/api/cash-flow', async (req, res) => {
  try {
    const finYear = req.query.financialYear || '2024-25';
    const { startDate, endDate } = getFinancialYearDates(finYear);

    const sql = `
      SELECT
        DATE_FORMAT(vm.date, '%b-%y') AS monthCode,
        MONTH(vm.date) AS monthNumber,
        YEAR(vm.date) AS year,
        SUM(CASE WHEN vm.voucher_type IN (?) AND ve.entry_type = 'debit' THEN ve.amount ELSE 0 END) AS totalInflow,
        SUM(CASE WHEN vm.voucher_type IN (?) AND ve.entry_type = 'credit' THEN ve.amount ELSE 0 END) AS totalOutflow
      FROM voucher_main vm
      JOIN voucher_entries ve ON vm.id = ve.voucher_id
      WHERE vm.date BETWEEN ? AND ?
      GROUP BY year, monthNumber
      ORDER BY year, monthNumber;
    `;

    const [rows] = await pool.query(sql, [
      inflowVoucherTypes,
      outflowVoucherTypes,
      startDate,
      endDate,
    ]);

    // Process rows to fill all months with zeros if missing
    const monthsOrder = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    const startYear = parseInt(finYear.split('-')[0]);
    const endYear = startYear + 1;

    const rowMap = {};
    rows.forEach(row => {
      rowMap[row.monthCode] = row;
    });

    const cashFlowData = monthsOrder.map((m, i) => {
      const y = (i < 9) ? startYear : endYear;
      const suffix = y.toString().substr(2,2);
      const code = `${m}-${suffix}`;
      const d = rowMap[code] || { totalInflow: 0, totalOutflow: 0 };
      return {
        month: m,
        monthCode: code,
        inflow: Number(d.totalInflow) || 0,
        outflow: Number(d.totalOutflow) || 0,
        netFlow: (Number(d.totalInflow) || 0) - (Number(d.totalOutflow) || 0),
      }
    });

    const totalInflow = cashFlowData.reduce((a,c) => a + c.inflow, 0);
    const totalOutflow = cashFlowData.reduce((a,c) => a + c.outflow, 0);
    const totalNetFlow = totalInflow - totalOutflow;

    res.json({ cashFlowData, totalInflow, totalOutflow, totalNetFlow });

  } catch (error) {
    console.error('Cash flow API error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

function getMonthDateRange(monthCode) {
  if (!monthCode) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }

  // monthCode format: 'Apr-24' means April 2024
  const [monStr, yrStr] = monthCode.split('-');
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const month = monthMap[monStr];
  if (month === undefined) throw new Error('Invalid month code');

  // Parse year '24' to 2024 (assumption)
  const year = 2000 + parseInt(yrStr, 10);

  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0); // last day of month
  return { start: startDate, end: endDate };
}

// Define voucher types that represent cash inflows and outflows
// Example
const INFLOW_VOUCHER_TYPES = ['receipt', 'sales', 'receipt'];
const OUTFLOW_VOUCHER_TYPES = ['payment', 'purchase', 'payment'];

// Helper to convert 'Apr-24' monthCode to JS Date range for that month
function getMonthDateRange(monthCode) {
  if (!monthCode) {
    const now = new Date();
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0)
    };
  }

  const [monStr, yrStr] = monthCode.split('-');
  const monthMap = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
  };
  const month = monthMap[monStr];
  if (month === undefined) throw new Error('Invalid month code');

  const year = 2000 + parseInt(yrStr, 10);
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

// Generate placeholders for SQL IN clause for safety
function createPlaceholders(arr) {
  return arr.map(() => '?').join(',');
}

// Cash Flow Summary route
router.get('/api/cashflow/summary/:monthCode', async (req, res) => {
  try {
    const { monthCode } = req.params;
    const { start, end } = getMonthDateRange(monthCode);

    const inflowTypes = ['receipt', 'sales']; // make sure these match your voucher_main exactly!
const outflowTypes = ['payment', 'purchase'];

const inflowPlaceholders = inflowTypes.map(() => '?').join(',');
const outflowPlaceholders = outflowTypes.map(() => '?').join(',');

const inflowQuery = `
  SELECT lg.name as account_name, SUM(ve.amount) as total_amount
  FROM voucher_entries ve
  JOIN voucher_main vm ON ve.voucher_id = vm.id
  JOIN ledgers lg ON ve.ledger_id = lg.id
  WHERE vm.voucher_type IN (${inflowPlaceholders})
    AND ve.entry_type = 'debit'
    AND vm.date BETWEEN ? AND ?
  GROUP BY lg.name
  ORDER BY total_amount DESC
`;
const outflowQuery = `
  SELECT lg.name as account_name, SUM(ve.amount) as total_amount
  FROM voucher_entries ve
  JOIN voucher_main vm ON ve.voucher_id = vm.id
  JOIN ledgers lg ON ve.ledger_id = lg.id
  WHERE vm.voucher_type IN (${outflowPlaceholders})
    AND ve.entry_type = 'credit'
    AND vm.date BETWEEN ? AND ?
  GROUP BY lg.name
  ORDER BY total_amount DESC
`;

const [inflowRows] = await pool.query(inflowQuery, [...inflowTypes, start, end]);
const [outflowRows] = await pool.query(outflowQuery, [...outflowTypes, start, end]);

    // Map results to expected API format
    const inflow = inflowRows.map(row => ({
      name: row.account_name,
      amount: Number(row.total_amount) || 0
    }));

    const outflow = outflowRows.map(row => ({
      name: row.account_name,
      amount: Number(row.total_amount) || 0
    }));

    res.json({ inflow, outflow });
  } catch (err) {
    console.error('Error fetching cash flow summary:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
