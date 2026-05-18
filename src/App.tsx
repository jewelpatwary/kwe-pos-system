import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import POS from './pages/POS';
import Labels from './pages/Labels';
import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import ProductManagement from './pages/ProductManagement';
import Suppliers from './pages/Suppliers';
import SalesHistory from './pages/SalesHistory';
import SupplierReturns from './pages/SupplierReturns';
import ReturnHistory from './pages/ReturnHistory';
import DeletedReturnHistory from './pages/DeletedReturnHistory';
import CustomerReturnsReport from './pages/CustomerReturnsReport';
import Customers from './pages/Customers';
import UserManagement from './pages/UserManagement';
import VoidLogs from './pages/VoidLogs';
import MasterData from './pages/MasterData';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import CashManagement from './pages/CashManagement';
import InventoryManagement from './pages/InventoryManagement';
import InventoryAudit from './pages/InventoryAudit';
import PurchaseManagement from './pages/PurchaseManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import StockAdjustment from './pages/StockAdjustment';
import SalesReport from './pages/SalesReport';
import ProfitReport from './pages/ProfitReport';
import ExpiryInsights from './pages/ExpiryInsights';
import Login from './pages/Login';
import CreditCustomers from './pages/CreditCustomers';
import CreditCollections from './pages/CreditCollections';
import CreditEngine from './pages/CreditEngine';
import PurchasePaymentPage from './pages/PurchasePaymentPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        
        {/* Cashier / General Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/pos" element={<POS />} />
        </Route>
        
        {/* Admin / Manager Routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']} />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="products" element={<ProductManagement />} />
            <Route path="stock-adjustment" element={<StockAdjustment />} />
            <Route path="purchase-invoices" element={<PurchaseManagement />} />
            <Route path="inventory" element={<InventoryManagement />} />
            <Route path="inventory-audit" element={<InventoryAudit />} />
            <Route path="expenses" element={<ExpenseManagement />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="sales-history" element={<SalesHistory />} />
            <Route path="labels" element={<Labels />} />
            <Route path="returns" element={<SupplierReturns />} />
            <Route path="returns/:id/edit" element={<SupplierReturns />} />
            <Route path="return-history" element={<ReturnHistory />} />
            <Route path="deleted-return-history" element={<DeletedReturnHistory />} />
            <Route path="customer-returns" element={<CustomerReturnsReport />} />
            <Route path="customers" element={<Customers />} />
            <Route path="credit-customers" element={<CreditCustomers />} />
            <Route path="credit-collections" element={<CreditCollections />} />
            <Route path="credit-engine" element={<CreditEngine />} />
            <Route path="purchase-payments" element={<PurchasePaymentPage />} />
            <Route path="void-logs" element={<VoidLogs />} />
            <Route path="master-data" element={<MasterData />} />
            <Route path="sales-report" element={<SalesReport />} />
            <Route path="profit-report" element={<ProfitReport />} />
            <Route path="expiry-insights" element={<ExpiryInsights />} />
            <Route path="categories" element={<MasterData />} />
            <Route path="brands" element={<MasterData />} />
            <Route path="units" element={<MasterData />} />
            <Route path="currencies" element={<MasterData />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="cash" element={<CashManagement />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<div className="p-10 font-bold text-xl text-gray-400">Admin Page (In Progress)</div>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
