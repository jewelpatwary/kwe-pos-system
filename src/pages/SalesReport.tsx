import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  ArrowLeft,
  DollarSign,
  CreditCard,
  Banknote,
  Flame,
  Globe,
  Tag,
  Package,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function SalesReport() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { currency } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);

  // Filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/admin/dashboard');
      return;
    }
    fetchReport();
  }, [startDate, endDate, selectedCategory]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        category_id: selectedCategory
      });
      
      const res = await fetch(`/api/admin/detailed-sales-report-rows?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md transition-colors">
         <div className="flex items-center gap-2 bg-white p-1 rounded border border-slate-200 shadow-sm">
            <span className="px-2 text-slate-400 font-black">START</span>
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-[8px] font-black text-slate-900 uppercase outline-none"
            />
            <span className="text-slate-300 font-bold px-1">/</span>
            <span className="px-2 text-slate-400 font-black">END</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-[8px] font-black text-slate-900 uppercase outline-none"
            />
         </div>
         <div className="flex-1"></div>
         <button className="bg-white border border-slate-200 text-slate-800 px-4 py-2 rounded hover:bg-slate-50 transition flex items-center gap-2 font-black tracking-widest shadow-sm active:scale-95">
            <Download className="w-3.5 h-3.5" /> DOWNLOAD_CSV
         </button>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-100 relative bg-white custom-scrollbar">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-center transition-all">
             <div className="tracking-[0.5em] animate-pulse font-black text-slate-900 uppercase italic">QUERYING_AUDIT_LOGS...</div>
          </div>
        )}
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm border-b border-slate-200">
                <tr className="uppercase tracking-[0.2em] text-slate-400 bg-slate-50/80 backdrop-blur-md font-black">
                    <th className="py-3 px-4 border-r border-slate-200">Timestamp</th>
                    <th className="py-3 px-4 border-r border-slate-200">Category</th>
                    <th className="py-3 px-4 border-r border-slate-200">Entity_Name</th>
                    <th className="py-3 px-4 text-center border-r border-slate-200">Units</th>
                    <th className="py-3 px-4 text-right border-r border-slate-200">Cash_Val</th>
                    <th className="py-3 px-4 text-right border-r border-slate-200">TNG_Val</th>
                    <th className="py-3 px-4 text-right border-r border-slate-200">Credit_Val</th>
                    <th className="py-3 px-4 text-right">Total_Asset_Val</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
                {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-4 border-r border-slate-100">
                           <div className="text-slate-400 font-black italic">{new Date(row.timestamp).toLocaleDateString()}</div>
                           <div className="text-slate-300 text-[8px] font-bold">{new Date(row.timestamp).toLocaleTimeString()}</div>
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 italic text-indigo-600 font-black tracking-widest">
                           [{row.category_name}]
                        </td>
                        <td className="py-3 px-4 border-r border-slate-100 text-slate-900 font-black italic">
                           {row.product_name}
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-100 text-slate-500 font-bold uppercase italic">
                           {row.qty_sold}
                        </td>
                        <td className="py-3 px-4 text-right border-r border-slate-100 text-emerald-600 font-black underline decoration-emerald-100 underline-offset-4">
                           {currency.symbol}{row.cash_amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right border-r border-slate-100 text-indigo-600 font-black underline decoration-indigo-200 underline-offset-4">
                           {currency.symbol}{row.online_amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right border-r border-slate-100 text-indigo-600 font-black underline decoration-indigo-200 underline-offset-4">
                           {currency.symbol}{row.credit_amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 bg-slate-50/30 underline decoration-indigo-500 underline-offset-4">
                           {currency.symbol}{row.total_amount.toFixed(2)}
                        </td>
                    </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-20 text-center font-black text-slate-300 uppercase tracking-[0.5em] text-xs grayscale italic select-none">
                       NULL_DATA_SET : END_OF_LEADS
                    </td>
                  </tr>
                )}
            </tbody>
        </table>
      </div>


    </div>
  );
}
