// ✅ server.js (Updated without express-session)
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Routes
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'GST Billing Backend API is running successfully',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

const ledgerGroupRoutes = require('./routes/ledgerGroups');
app.use('/api/ledger-groups', ledgerGroupRoutes);


const ledgerRoutes = require('./routes/ledger');
app.use('/api/ledger', ledgerRoutes);

const GroupRoutes = require('./routes/group');
app.use('/api/group', GroupRoutes);

const currencyRoutes = require('./routes/currency');
app.use('/api/currencies', currencyRoutes);

const budgetRoutes = require('./routes/budgets');
app.use('/api/budgets', budgetRoutes);

const voucherRoutes = require('./routes/vouchers');
app.use('/api/vouchers', voucherRoutes);

const voucherTypesRoutes = require('./routes/voucherTypes');
app.use('/api/voucher-types', voucherTypesRoutes);

const saleVoucherRoutes = require('./routes/salevoucher');
app.use('/api/sale-vouchers', saleVoucherRoutes);

const purchaseVoucherRoutes = require('./routes/purchasevoucher');  
app.use('/api/purchase-vouchers', purchaseVoucherRoutes);

const scenarioRoutes = require('./routes/scenarioRoutes');
app.use('/api/scenario', scenarioRoutes);

const costCenterRoutes = require('./routes/costCenterRoutes');
app.use('/api/cost-centers', costCenterRoutes);

const stockCategoriesRoutes = require('./routes/stockCategories');
app.use('/api/stock-categories', stockCategoriesRoutes);

const stockUnitsRoutes = require('./routes/stockUnits');  
app.use('/api/stock-units', stockUnitsRoutes);

const stockGroupRoutes = require('./routes/stockGroupRoutes');    
app.use('/api/stock-groups', stockGroupRoutes);

const godownRoutes = require('./routes/godownRoutes');
app.use('/api/godowns', godownRoutes);

const stockItemRoutes = require('./routes/stockItems');
app.use('/api/stock-items', stockItemRoutes);

const signupRoute = require('./routes/SignUp');
app.use('/api/SignUp', signupRoute);

const loginRoute = require('./routes/login');
app.use('/api/login', loginRoute);

const companyRoutes = require('./routes/company');
app.use('/api/company', companyRoutes);

const adminloginRoute = require('./routes/adminlogin');
app.use('/api/admin/login', adminloginRoute);

const ledgerDropdown = require("./routes/ledgerDropdown");
app.use("/api/ledger-dropdown", ledgerDropdown);

const salesOrders = require('./routes/salesOrders');
app.use('/api/sales-orders', salesOrders);

const DebitNoteVoucher = require('./routes/DebitNoteVoucher');
app.use('/api/DebitNoteVoucher', DebitNoteVoucher);

const CreditNotevoucher = require('./routes/CreditNotevoucher');
app.use('/api/CreditNotevoucher', CreditNotevoucher);

const StockJournal = require('./routes/StockJournal');
app.use('/api/StockJournal', StockJournal);

const DeliveryItem = require('./routes/DeliveryItem');
app.use('/api/DeliveryItem', DeliveryItem);

const DayBookCards = require('./routes/DayBookCards');
app.use('/api/DayBookCards', DayBookCards);

const daybookTable = require('./routes/daybookTable');
app.use('/api/daybookTable', daybookTable);

const gstRoutes = require("./routes/gst");
app.use("/api/gst", gstRoutes);

const gstr3bRoutes = require("./routes/gstr3b");
app.use("/api/gstr3b", gstr3bRoutes);

const gstRatesRoutes = require("./routes/gstRates");
app.use("/api/gst-rates", gstRatesRoutes);

// const stockSummaryRouter = require('./routes/stockSummary');
// app.use('/api', stockSummaryRouter);

const tds24qRoutes = require("./routes/tds_24q");
app.use("/api/tds24q", tds24qRoutes);
const tds26qRouter = require("./routes/tds_26q");
app.use(tds26qRouter);
const tds27qRouter = require("./routes/tds_27q");
app.use(tds27qRouter);

const tds27eqRouter = require("./routes/tds_27eq");
app.use(tds27eqRouter);

const deducteesRouter = require('./routes/deductees');
app.use(deducteesRouter);

const trialBalanceRouter = require('./routes/trialBalance');
app.use(trialBalanceRouter);

const profitLossRouter = require('./routes/profitloss'); // Assuming you saved route above as profitLoss.js
app.use(profitLossRouter);

const balanceSheetRouter = require('./routes/balanceSheet');
app.use(balanceSheetRouter);

// Remember to have your mysql2 pool connection in db.js and export it properly.
const groupSummaryRouter = require('./routes/groupSummary');
app.use(groupSummaryRouter);
// Remember to have your mysql2 pool connection in db.js and export it properly.
const cashflowRouter = require('./routes/cashFlow');
app.use(cashflowRouter);

const stockSummaryRouter = require('./routes/stockSummary');
app.use(stockSummaryRouter);

const movementAnalysisRouter = require('./routes/movementAnalysis');
app.use(movementAnalysisRouter);

const ageingAnalysisRouter = require('./routes/ageingAnalysis');
app.use(ageingAnalysisRouter);

const godownSummaryRouter = require('./routes/godownSummary');
app.use(godownSummaryRouter);

const fifoRouter = require('./routes/fifo');
app.use(fifoRouter);

const outstandingRouter = require('./routes/outstandingReceivables');
app.use(outstandingRouter);

const outstandingPayablesRouter = require('./routes/outstandingPayables');
app.use(outstandingPayablesRouter);

const billwiseReceivablesRouter = require('./routes/billwiseReceivables');
app.use(billwiseReceivablesRouter);

// in your app.js or server.js
const billwisePayablesRouter = require('./routes/billwisePayables');
app.use(billwisePayablesRouter);

const outstandingLedgerRouter = require('./routes/outstandingLedger');
app.use(outstandingLedgerRouter);

const outstandingSummaryRouter = require('./routes/outstandingSummary');
app.use(outstandingSummaryRouter);

const bulkStockItemsRouter = require('./routes/bulk-stock-items'); // the above file
app.use('/api/stock-items', bulkStockItemsRouter);

const ledgerReportRouter = require('./routes/ledger-report');
app.use('/api/ledger-report', ledgerReportRouter);

const permissionsRouter = require('./routes/permissions');
app.use(permissionsRouter);

const roleManagementRouter = require('./routes/roleManagement');
app.use('/api', roleManagementRouter);

const userAccountsRouter = require('./routes/userAccounts');
app.use('/api', userAccountsRouter);

const assessee = require('./routes/assessee');
app.use('/api/assessee', assessee);

const itrfiling = require('./routes/ITRFilling');
app.use('/api/itr-filling', itrfiling);

// ✅ MySQL Connection
const db = mysql.createConnection({
  host: '192.145.238.16',
  user: 'amtbug5_usrtally',
  password: 'Tally@786$',
  database: 'amtbug5_dbtally'
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL Connected!');
});

// ✅ Start Server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
