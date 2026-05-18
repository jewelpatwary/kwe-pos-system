import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Search, 
  AlertTriangle, 
  Clock, 
  Package, 
  ArrowRight,
  Filter,
  Download,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from '../components/ThemeProvider';
import { useAuthStore } from '../store/authStore';

interface ExpiringItem {
  batch_id: number;
  batch_number: string;
  expiry_date: string;
  batch_quantity: number;
  product_id: number;
  product_name: string;
  barcode: string;
  total_stock: number;
  invoice_number: string;
  supplier_name: string;
}

const ExpiryInsights: React.FC = () => {
  const [items, setItems] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysThreshold, setDaysThreshold] = useState(90);
  const [searchTerm, setSearchTerm] = useState('');
  const { currency } = useTheme();
  const { token } = useAuthStore();

  const fetchExpiryData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/expiry-insights?days=${daysThreshold}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching expiry data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiryData();
  }, [daysThreshold]);

  const filteredItems = items.filter(item => 
    item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode.includes(searchTerm)
  );

  const getStatusColor = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'text-red-600 bg-red-100 border-red-200';
    if (diffDays <= 30) return 'text-orange-600 bg-orange-100 border-orange-200';
    return 'text-amber-600 bg-amber-100 border-amber-200';
  };

  const getDaysRemaining = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-red-500" />
              EXPIRY_INSIGHTS_PROTOCOL
            </h1>
            <p className="text-slate-500 text-sm font-medium">Critical inventory end-of-life status monitoring</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={daysThreshold}
                onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value={30}>EXPIRES_IN_30_DAYS</option>
                <option value={60}>EXPIRES_IN_60_DAYS</option>
                <option value={90}>EXPIRES_IN_90_DAYS</option>
                <option value={180}>EXPIRES_IN_180_DAYS</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-black hover:opacity-90 transition shadow-lg">
              <Download className="w-4 h-4" />
              EXPORT_LOG
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-xs font-black text-slate-400 tracking-wider">CRITICAL_EXPIRED</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {items.filter(i => getDaysRemaining(i.expiry_date) <= 0).length}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-xs font-black text-slate-400 tracking-wider">EXPIRING_30D</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {items.filter(i => getDaysRemaining(i.expiry_date) > 0 && getDaysRemaining(i.expiry_date) <= 30).length}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-xs font-black text-slate-400 tracking-wider">TOTAL_RISK_ATTRITION</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {filteredItems.length}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ArrowRight className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-black text-slate-400 tracking-wider">REMAINING_STOCK</span>
            </div>
            <div className="text-3xl font-black text-slate-900">
              {filteredItems.reduce((acc, curr) => acc + curr.total_stock, 0)}
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="PROBE_PRODUCT_NAME_OR_BARCODE..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-black text-slate-900 outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="py-4 px-6">PRODUCT_DESCRIPTOR</th>
                  <th className="py-4 px-6 text-center">BATCH_ID</th>
                  <th className="py-4 px-6 text-center">EXP_DATE</th>
                  <th className="py-4 px-6 text-center">TTL_STOCK</th>
                  <th className="py-4 px-6 text-center">STATUS_FLAGS</th>
                  <th className="py-4 px-6">SUPPLY_ORIGIN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-black animate-pulse">SYNCHRONIZING_EXPIRY_DATA...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-black">NO_CRITICAL_EXPIRY_THRESHOLD_DETECTED</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const daysLeft = getDaysRemaining(item.expiry_date);
                    return (
                      <motion.tr 
                        key={item.batch_id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="py-4 px-6">
                            <div className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.product_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">{item.barcode}</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-mono rounded border border-slate-200">
                                {item.batch_number || 'N/A'}
                            </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                            <div className="text-xs font-black text-slate-900">{item.expiry_date}</div>
                            <div className={`text-[10px] font-black mt-0.5 ${daysLeft <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                                {daysLeft <= 0 ? 'STATUS: EXPIRED' : `T-MINUS: ${daysLeft} DAYS`}
                            </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                            <div className="text-lg font-black text-slate-900">{item.total_stock}</div>
                            <div className="text-[10px] text-slate-400 font-black">IN_SYSTEM_STOCK</div>
                        </td>
                        <td className="py-4 px-6 text-center">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black border ${getStatusColor(item.expiry_date)}`}>
                                {daysLeft <= 0 ? 'CRITICAL_FAIL' : daysLeft <= 30 ? 'URGENT_LIQUIDATE' : 'MONITOR_CLOSELY'}
                            </div>
                        </td>
                        <td className="py-4 px-6">
                            <div className="text-[10px] font-black text-slate-900">{item.supplier_name || 'UNKNOWN_SOURCE'}</div>
                            <div className="text-[10px] text-slate-400 font-mono uppercase mt-0.5">INV: {item.invoice_number || 'SYSTEM'}</div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExpiryInsights;
