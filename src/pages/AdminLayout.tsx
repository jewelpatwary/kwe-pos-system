import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Printer, Settings, ShoppingBag, Users, Store, 
  Undo2, LogOut, ShieldAlert, Truck, 
  FileText, CreditCard, Banknote, BarChart3, Database, Cpu, ClipboardCheck,
  ShoppingCart, Receipt, Monitor, Plus, Search, ChevronRight, PackageSearch,
  Sun, Moon, User, History, Coffee, RefreshCcw
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { prefetchAPI } from '../main';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (token && user) {
        // Pre-fetch critical endpoints so pages load instantly on clicking
        const today = new Date().toISOString().split('T')[0];
        
        const endpointsToPrefetch = [
           '/api/products',
           '/api/categories',
           '/api/brands',
           '/api/suppliers',
           '/api/customers?type=MEMBERS_DELIVERY_FOOD',
           '/api/customers?type=MEMBERS_WALK_IN',
           '/api/credit-collections',
           '/api/credit-engine',
           '/api/purchase-invoices',
           '/api/purchase-payments',
           '/api/users',
           '/api/settings',
           '/api/admin/dashboard',
           '/api/inventory-audits',
           '/api/expenses',
           `/api/admin/detailed-sales-report-rows?start_date=${today}&end_date=${today}&category_id=all`,
           `/api/admin/daily-pdf-report?month=${today.substring(0,7)}`
        ];

        // Trigger prefetching with small delay to allow main render to finish
        setTimeout(() => {
            endpointsToPrefetch.forEach(url => prefetchAPI(url, token));
        }, 500);
    }
  }, [token, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navGroups = [
    {
      id: "dashboard",
      label: "MAIN",
      items: [
        { to: "/admin/dashboard", label: "DASHBOARD", icon: LayoutDashboard }
      ]
    },
    {
      id: "sales",
      label: "SALES",
      items: [
        { to: "/pos", label: "POS", icon: Monitor },
        { to: "/admin/reports", label: "REPORTS", icon: BarChart3 },
        { to: "/admin/sales-history", label: "RECEIPTS", icon: FileText },
        { to: "/admin/void-logs", label: "VOIDS", icon: ShieldAlert }
      ]
    },
    {
      id: "catalog",
      label: "INVENTORY",
      items: [
        { to: "/admin/products", label: "PRODUCTS", icon: ShoppingBag },
        { to: "/admin/expiry-insights", label: "EXPIRY INSIGHTS", icon: ShieldAlert },
        { to: "/admin/return-history", label: "RET. TO SUPPLIER HIS.", icon: History },
        { to: "/admin/labels", label: "LABELS", icon: Printer }
      ]
    },
    {
      id: "inventory",
      label: "STOCK",
      items: [
        { to: "/admin/inventory-audit", label: "AUDIT", icon: ClipboardCheck },
        { to: "/admin/stock-adjustment", label: "ADJUSTMENT", icon: Database }
      ]
    },
    {
      id: "procurement",
      label: "PURCHASES",
      items: [
        { to: "/admin/purchase-invoices", label: "INVOICES", icon: ShoppingCart },
        { to: "/admin/requisition", label: "REQUISITION", icon: FileText },
        { to: "/admin/purchase-payments", label: "PAYMENT INV", icon: Banknote },
        { to: "/admin/suppliers", label: "SUPPLIERS", icon: Truck }
      ]
    },
    {
      id: "entities",
      label: "CUSTOMERS",
      items: [
        { to: "/admin/customers", label: "MEMBERS (DELIVERY FOOD)", icon: Users },
        { to: "/admin/credit-customers", label: "MEMBERS (WALK IN)", icon: CreditCard },
        { to: "/admin/credit-collections", label: "COLLECTIONS", icon: Banknote },
        { to: "/admin/credit-engine", label: "ENGINE", icon: CreditCard }
      ]
    },
    {
      id: "finance",
      label: "FINANCE",
      items: [
        { to: "/admin/expenses", label: "EXPENSES", icon: Receipt },
        { to: "/admin/profit-report", label: "PROFIT", icon: BarChart3 }
      ]
    },
    {
      id: "system",
      label: "SYSTEM",
      items: [
        { to: "/admin/users", label: "STAFF", icon: Users },
        { to: "/admin/system", label: "SYSTEM RESET", icon: RefreshCcw },
        { to: "/admin/master-data", label: "MASTER DATA", icon: Database },
        { to: "/admin/settings", label: "SETTINGS", icon: Settings }
      ]
    }
  ];

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden text-[10px] transition-colors duration-300">
      {/* PERSISTENT SIDEBAR */}
      <aside 
        className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 z-[100] shrink-0 ${collapsed ? 'w-0 opacity-0 invisible' : 'w-64'}`}
      >
         <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar space-y-5">
            {navGroups.map(group => (
                <div key={group.id} className="space-y-1">
                     <div className="px-2 py-1 text-[7px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                        <span>{group.label}</span>
                        <div className="flex-1 h-[1px] bg-slate-200"></div>
                     </div>
                    <div className="grid grid-cols-1 gap-px">
                        {group.items.map(item => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({isActive}) => `
                                    flex items-center gap-3 py-2 px-3 transition-all rounded group relative
                                    ${isActive ? 'bg-indigo-600 text-white font-black shadow-lg shadow-indigo-500/20' : 'text-slate-500  hover:bg-slate-100  hover:text-slate-900 '}
                                `}
                            >
                                <item.icon className="w-4 h-4 shrink-0" />
                                <span className="truncate tracking-widest font-bold">{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                </div>
            ))}
        </div>

        {/* Sidebar Footer: LOGOUT */}
        <div className="border-t border-slate-200 bg-slate-50 mt-auto">
            <div className="p-4">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded transition-all font-black text-[10px] tracking-widest uppercase shadow-sm group"
                >
                    <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span>LOGOUT_SYSTEM</span>
                </button>
            </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white transition-colors duration-300 relative">
         {/* HEADER BAR */}
         <header className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                    title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    <Monitor className={`w-5 h-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
                </button>
                
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="font-black tracking-widest text-[#64748b]">ONLINE</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                
                <div className="h-4 w-px bg-slate-200"></div>
                
                <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                        <div className="text-[9px] font-black text-slate-900 leading-none uppercase">{user?.username}</div>
                        <div className="text-[7px] text-slate-500 font-bold uppercase">{user?.role}</div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-black">
                        {user?.username?.charAt(0).toUpperCase() || 'G'}
                    </div>
                </div>
            </div>
         </header>

         <div className="flex-1 overflow-hidden">
            <Outlet />
         </div>
      </main>
    </div>
  );
}
