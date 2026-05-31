import React, { useState, useEffect } from 'react';
import { useTheme } from '../components/ThemeProvider';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ArrowLeft, 
  Calendar, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Briefcase,
  X,
  Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

export default function ProfitReport() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { currency } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  
  // Filters
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchReport();
  }, [startDate, endDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/admin/profit-analytics?${query.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
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
             <div className="tracking-[0.5em] animate-pulse text-indigo-600 font-black uppercase">QUERYING_FINANCIAL_MATRIX...</div>
          </div>
        )}
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm border-b border-slate-200">
                <tr className="uppercase tracking-[0.2em] text-slate-400 bg-slate-50/80 backdrop-blur-md font-black text-[9px]">
                    <th className="py-3 px-6 border-r border-slate-200">Registry_Date</th>
                    <th className="py-3 px-6 border-r border-slate-200 text-right">Revenue</th>
                    <th className="py-3 px-6 border-r border-slate-200 text-right">COGS_Exp</th>
                    <th className="py-3 px-6 border-r border-slate-200 text-right">Gross_Profit</th>
                    <th className="py-3 px-6 border-r border-slate-200 text-right">Op_Ex</th>
                    <th className="py-3 px-6 text-right font-black">Net_Profit</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
                {data?.dailyLedger?.map((row: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-3 px-6 border-r border-slate-100 text-slate-400 font-bold tracking-widest">
                           {row.date}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-right text-slate-900 font-black underline decoration-indigo-200 underline-offset-4">
                           {currency.symbol}{row.sales.toFixed(2)}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-right text-slate-400 font-bold">
                           {currency.symbol}{row.cogs.toFixed(2)}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-right text-emerald-600 font-black underline decoration-emerald-100 underline-offset-4">
                           {currency.symbol}{row.gross_profit.toFixed(2)}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-right text-red-600 font-bold">
                           {currency.symbol}{row.expenses.toFixed(2)}
                        </td>
                        <td className={`py-3 px-6 text-right font-black transition-colors ${row.net_profit >= 0 ? 'text-indigo-600 bg-indigo-50/50 ' : 'text-orange-600 bg-orange-50/50 '}`}>
                           <span className="underline decoration-current underline-offset-4">{currency.symbol}{row.net_profit.toFixed(2)}</span>
                        </td>
                    </tr>
                ))}
                {(!data?.dailyLedger || data.dailyLedger.length === 0) && !loading && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center font-black text-slate-300 uppercase tracking-[0.5em] text-xs grayscale select-none">
                       NULL_LEDGER_DATA : END_OF_LEADS
                    </td>
                  </tr>
                )}
            </tbody>
        </table>
      </div>


    </div>
  );
}
