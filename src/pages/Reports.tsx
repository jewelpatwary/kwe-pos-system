import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Download, 
  Calendar, 
  Filter, 
  Globe, 
  CreditCard, 
  Flame, 
  ChevronDown,
  ChevronRight,
  PieChart as PieIcon,
  Tag,
  Package,
  ShoppingBag,
  X
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6'];

export default function Reports() {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [reportType, setReportType] = useState('sales');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [activeTab, setActiveTab] = useState<'summary' | 'items' | 'sales_by_category'>('summary');
  
  const { token } = useAuthStore();

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDateRangeChange = (range: string) => {
    setDateRange(range);
    const today = new Date();
    let start = new Date();
    let end = new Date();

    if (range === 'today') {
      start = today;
      end = today;
    } else if (range === 'yesterday') {
      start = new Date(today);
      start.setDate(today.getDate() - 1);
      end = new Date(start);
    } else if (range === 'week') {
      start = new Date(today);
      start.setDate(today.getDate() - 7);
      end = today;
    } else if (range === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = today;
    }

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const fetchDetailedReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        category_id: selectedCategory
      });
      
      const res = await fetch(`/api/admin/detailed-sales-report?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (reportType === 'sales') {
      fetchDetailedReport();
    }
  }, [reportType, startDate, endDate, selectedCategory]);

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <select 
            value={reportType}
            onChange={(e) => {
              if (e.target.value === 'expiry') {
                navigate('/admin/expiry-insights');
              } else {
                setReportType(e.target.value);
              }
            }}
            className="bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none shadow-sm"
        >
            {['sales', 'profit', 'expiry', 'taxes', 'returns', 'cash_flow', 'stock_valuation'].map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
        </select>

        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black text-slate-900 p-2 outline-none"
            />
            <span className="text-slate-300">{'>>'}</span>
            <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[9px] font-black text-slate-900 p-2 outline-none"
            />
        </div>

        <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none shadow-sm"
        >
            <option value="all">ALL_CATEGORIES</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex-1"></div>

        <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200 rounded">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`px-3 py-1 rounded text-[8px] font-black tracking-widest transition-all ${activeTab === 'summary' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 '}`}
          >
            SUMMARY_VIEW
          </button>
          <button 
             onClick={() => setActiveTab('items')}
             className={`px-3 py-1 rounded text-[8px] font-black tracking-widest transition-all ${activeTab === 'items' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 '}`}
          >
            ITEM_METRICS
          </button>
          <button 
             onClick={() => setActiveTab('sales_by_category')}
             className={`px-3 py-1 rounded text-[8px] font-black tracking-widest transition-all ${activeTab === 'sales_by_category' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 '}`}
          >
            SALES_BY_CATEGORY
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400 font-black">COMPILING_ANALYTICS_DATA...</div>
             </div>
        ) : reportData && (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                {activeTab === 'summary' ? (
                  <>
                    <th className="py-4 px-6 font-black border-r border-slate-200 uppercase tracking-widest text-[9px]">Identity_Vec</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Cash_Trx</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">TNG</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Credit_Flow</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Burn_Rate</th>
                    <th className="py-4 px-6 font-black text-right uppercase tracking-widest text-[9px]">Agg_Summation</th>
                  </>
                ) : activeTab === 'sales_by_category' ? (
                  <>
                    <th className="py-4 px-6 font-black border-r border-slate-200 uppercase tracking-widest text-[9px]">Category_Name</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Total_Quantity</th>
                    <th className="py-4 px-6 font-black text-right uppercase tracking-widest text-[9px]">Total_Value</th>
                  </>
                ) : (
                  <>
                    <th className="py-4 px-6 font-black border-r border-slate-200 uppercase tracking-widest text-[9px]">Descriptor</th>
                    <th className="py-4 px-6 font-black border-r border-slate-200 uppercase tracking-widest text-[9px]">Class_Vec</th>
                    <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Volume</th>
                    <th className="py-4 px-6 font-black text-right uppercase tracking-widest text-[9px]">Value_Index</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {activeTab === 'summary' ? (
                reportData.categoryBreakdown?.map((cat: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 border-r border-slate-200 text-slate-900 font-black italic">{cat.category_name}</td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center text-emerald-600 font-bold italic">{currency.symbol}{(cat.payments?.['CASH'] || 0).toFixed(2)}</td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center text-indigo-600 font-bold italic">{currency.symbol}{(cat.payments?.['ONLINE'] || 0).toFixed(2)}</td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center text-indigo-600 font-bold italic bg-indigo-50">{currency.symbol}{(cat.payments?.['CREDIT'] || 0).toFixed(2)}</td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center text-orange-600 font-bold italic">{currency.symbol}{(cat.payments?.['AUTO_BURN'] || 0).toFixed(2)}</td>
                    <td className="py-4 px-6 text-right text-slate-900 font-black italic bg-slate-100">{currency.symbol}{cat.total_value.toFixed(2)}</td>
                  </tr>
                ))
              ) : activeTab === 'sales_by_category' ? (
                reportData.categoryBreakdown?.map((cat: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 border-r border-slate-200 text-slate-900 font-black italic">{cat.category_name}</td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center text-slate-600 font-bold italic">{cat.total_qty} units</td>
                    <td className="py-4 px-6 text-right text-indigo-600 font-black italic">{currency.symbol}{cat.total_value.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                reportData.itemDetails?.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 border-r border-slate-200 text-slate-900 font-black italic tracking-widest">{item.product_name}</td>
                    <td className="py-4 px-6 border-r border-slate-200">
                      <span className="px-2 py-0.5 rounded border border-slate-200 text-slate-400 font-black italic">{item.category_name}</span>
                    </td>
                    <td className="py-4 px-6 border-r border-slate-200 text-center font-bold text-slate-500">{item.total_qty} units</td>
                    <td className="py-4 px-6 text-right text-slate-900 font-black italic">{currency.symbol}{item.total_value.toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div className="flex gap-4">
            <span>AGG_VOLUME : {reportData?.categoryBreakdown?.length || 0} SECTORS</span>
            <span>NET_SUMMATION : <span className="text-emerald-400 font-black italic">{currency.symbol}{reportData?.summary?.grandTotal?.toFixed(2) || '0.00'}</span></span>
         </div>
         <div>SYSTEM_TIME_OFFS : {new Date().toISOString()}</div>
      </div>
    </div>
  );
}

