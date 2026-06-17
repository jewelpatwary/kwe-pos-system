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
  const [loading, setLoading] = useState(false);
  const [daysThreshold, setDaysThreshold] = useState(90);
  const [searchTerm, setSearchTerm] = useState('');
  const { currency } = useTheme();
  const { token } = useAuthStore();

  const fetchExpiryData = async () => {
    /* setLoading removed to prevent flicker */
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
    <div className="p-0 h-full flex flex-col bg-slate-50 text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Header Area */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <span className="text-slate-900 font-black tracking-widest">Expiry Insights</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <select 
              value={daysThreshold}
              onChange={(e) => setDaysThreshold(parseInt(e.target.value))}
              className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 text-[9px] font-black text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner rounded"
            >
              <option value={30}>Expires in 30 days</option>
              <option value={60}>Expires in 60 days</option>
              <option value={90}>Expires in 90 days</option>
              <option value={180}>Expires in 180 days</option>
              <option value={365}>Expires in 365 days</option>
            </select>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] tracking-widest transition shadow-md rounded">
            <Download className="w-3.5 h-3.5" />
            Export Log
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-6 custom-scrollbar bg-white">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 border border-slate-200 flex flex-col relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1 px-2 bg-red-100 border border-red-200 rounded text-red-600 font-black text-[8px] tracking-widest uppercase">
                Critical Expired
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 italic tracking-tighter">
              {items.filter(i => getDaysRemaining(i.expiry_date) <= 0).length}
            </div>
          </div>
          
          <div className="bg-white p-4 border border-slate-200 flex flex-col relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1 px-2 bg-orange-100 border border-orange-200 rounded text-orange-600 font-black text-[8px] tracking-widest uppercase">
                Expiring in 30 Days
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 italic tracking-tighter">
              {items.filter(i => getDaysRemaining(i.expiry_date) > 0 && getDaysRemaining(i.expiry_date) <= 30).length}
            </div>
          </div>

          <div className="bg-white p-4 border border-slate-200 flex flex-col relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1 px-2 bg-amber-100 border border-amber-200 rounded text-amber-600 font-black text-[8px] tracking-widest uppercase">
                Total At Risk
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 italic tracking-tighter">
              {filteredItems.length}
            </div>
          </div>

          <div className="bg-white p-4 border border-slate-200 flex flex-col relative overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-1 px-2 bg-emerald-100 border border-emerald-200 rounded text-emerald-600 font-black text-[8px] tracking-widest uppercase">
                Remaining Stock
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 italic tracking-tighter">
              {filteredItems.reduce((acc, curr) => acc + curr.total_stock, 0)}
            </div>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search product name or barcode..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner uppercase tracking-widest"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[10px] uppercase font-sans">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-[8px] uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="py-3 px-4 border-r border-slate-200/50">Product Description</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200/50">Batch ID</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200/50">Expiry Date</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200/50">Total Stock</th>
                  <th className="py-3 px-4 text-center border-r border-slate-200/50">Status</th>
                  <th className="py-3 px-4">Supplier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-black animate-pulse tracking-widest text-[9px]">Synchronizing Expiry Data...</td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-black tracking-widest text-[9px]">No critical expiry detected</td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const daysLeft = getDaysRemaining(item.expiry_date);
                    return (
                      <tr 
                        key={item.batch_id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4 border-r border-slate-200/50">
                            <div className="font-black text-slate-900 italic tracking-tighter text-[11px] leading-tight uppercase underline underline-offset-4 decoration-indigo-500/30 decoration-2">{item.product_name}</div>
                            <div className="text-[7px] text-slate-400 font-bold tracking-widest mt-1 uppercase">[{item.barcode || 'No Barcode'}]</div>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-200/50">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[8px] font-black uppercase tracking-widest rounded border border-slate-200">
                                {item.batch_number || 'N/A'}
                            </span>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-200/50">
                            <div className="text-[10px] font-black text-slate-900 italic font-mono">{item.expiry_date}</div>
                            <div className={`text-[8px] font-black mt-1 tracking-wider ${daysLeft <= 30 ? 'text-red-500' : 'text-slate-400'}`}>
                                {daysLeft <= 0 ? 'STATUS: EXPIRED' : `EXPIRES IN: ${daysLeft} DAYS`}
                            </div>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-200/50">
                            <div className="text-[12px] font-black text-slate-900 italic">{item.total_stock}</div>
                            <div className="text-[7px] text-slate-400 font-bold mt-1 tracking-widest uppercase">System Reserved</div>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-200/50">
                            <div className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black border tracking-widest ${getStatusColor(item.expiry_date)}`}>
                                {daysLeft <= 0 ? 'EXPIRED' : daysLeft <= 30 ? 'URGENT' : 'MONITOR'}
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="text-[10px] font-black text-slate-900 italic tracking-widest">{item.supplier_name || 'Unknown Source'}</div>
                            <div className="text-[7px] text-slate-400 font-bold uppercase mt-1 tracking-widest">INV: {item.invoice_number || 'SYSTEM'}</div>
                        </td>
                      </tr>
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
