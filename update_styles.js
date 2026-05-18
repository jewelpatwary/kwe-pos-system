const fs = require('fs');
const path = require('path');

const files = [
  './src/pages/ProfitReport.tsx',
  './src/pages/ExpiryInsights.tsx',
  './src/pages/SalesReport.tsx',
  './src/pages/Settings.tsx',
  './src/pages/InventoryManagement.tsx',
  './src/pages/MasterData.tsx',
  './src/pages/POS.tsx',
  './src/pages/Reports.tsx',
  './src/pages/CashManagement.tsx',
  './src/pages/CustomerReturnsReport.tsx',
  './src/pages/Login.tsx',
  './src/pages/VoidLogs.tsx',
  './src/pages/UserManagement.tsx',
  './src/pages/CreditEngine.tsx',
  './src/pages/SalesHistory.tsx',
  './src/pages/Customers.tsx',
  './src/pages/Labels.tsx',
  './src/pages/ExpenseManagement.tsx',
  './src/pages/PurchaseManagement.tsx',
  './src/pages/ProductManagement.tsx',
  './src/pages/SupplierReturns.tsx',
  './src/pages/AdminDashboard.tsx',
  './src/pages/InventoryAudit.tsx',
  './src/pages/StockAdjustment.tsx',
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace "italic" when it's a standalone word or class, i.e., bordered by spaces/quotes
    content = content.replace(/\bitalic\b/g, '');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
