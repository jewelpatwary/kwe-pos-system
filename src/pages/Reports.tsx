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
import { formatDate } from '../lib/utils';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6'];

export default function Reports() {
  const navigate = useNavigate();
  const { currency, dateFormat } = useTheme();
  const [reportType, setReportType] = useState('sales');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState('today');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const activeTab = 'summary';
  
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
    /* setLoading removed to prevent flicker */
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
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="flex-1"></div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400 font-black">Compiling Analytics Data...</div>
             </div>
        ) : reportData && (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200 uppercase tracking-widest text-[9px]">Date</th>
                {reportData.dailyPivot?.categories?.map((cat: string) => (
                  <th key={cat} className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">{cat}</th>
                ))}
                <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">Cash Sales</th>
                <th className="py-4 px-6 font-black text-center border-r border-slate-200 uppercase tracking-widest text-[9px]">TNG Sales</th>
                <th className="py-4 px-6 font-black text-right uppercase tracking-widest text-[9px]">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {reportData.dailyPivot?.rows?.map((row: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-6 border-r border-slate-200 text-slate-900 font-bold">{formatDate(row.date, dateFormat)}</td>
                  {reportData.dailyPivot.categories?.map((cat: string) => (
                    <td key={cat} className="py-4 px-6 border-r border-slate-200 text-center font-semibold text-slate-700">
                      {currency.symbol}{(row.values?.[cat] || 0).toFixed(2)}
                    </td>
                  ))}
                  <td className="py-4 px-6 border-r border-slate-200 text-center font-semibold text-slate-700">
                    {currency.symbol}{(row.cash || 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-200 text-center font-semibold text-slate-700">
                    {currency.symbol}{(row.tng || 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-right text-slate-900 font-black bg-slate-50">
                    {currency.symbol}{row.total.toFixed(2)}
                  </td>
                </tr>
              ))}
              {reportData.dailyPivot?.rows?.length > 0 && (
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-black text-[10px]">
                  <td className="py-4 px-6 border-r border-slate-200 text-slate-900">Total</td>
                  {reportData.dailyPivot.categories?.map((cat: string) => {
                    const totalCat = reportData.dailyPivot.rows.reduce((sum: number, r: any) => sum + (r.values?.[cat] || 0), 0);
                    return (
                      <td key={cat} className="py-4 px-6 border-r border-slate-200 text-center text-slate-900">
                        {currency.symbol}{totalCat.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="py-4 px-6 border-r border-slate-200 text-center text-slate-900">
                    {currency.symbol}{reportData.dailyPivot.rows.reduce((sum: number, r: any) => sum + (r.cash || 0), 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-200 text-center text-slate-900">
                    {currency.symbol}{reportData.dailyPivot.rows.reduce((sum: number, r: any) => sum + (r.tng || 0), 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-right text-indigo-600 bg-slate-200">
                    {currency.symbol}{reportData.dailyPivot.rows.reduce((sum: number, r: any) => sum + r.total, 0).toFixed(2)}
                  </td>
                </tr>
              )}
              {(!reportData.dailyPivot?.rows || reportData.dailyPivot.rows.length === 0) && (
                <tr>
                  <td colSpan={4 + (reportData.dailyPivot?.categories?.length || 0)} className="py-8 text-center text-slate-400">
                    No sales found for the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>


    </div>
  );
}

