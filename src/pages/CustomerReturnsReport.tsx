import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Undo2, Banknote, CreditCard, ShoppingBag, ArrowDownRight, RefreshCcw, X, Download } from 'lucide-react';
import { useTheme } from '../components/ThemeProvider';

interface ReturnSummary {
  totalValue: number;
  exchangeCount: number;
  cashCount: number;
  totalReturns: number;
}

export default function CustomerReturnsReport() {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [returns, setReturns] = useState<any[]>([]);
  const [summary, setSummary] = useState<ReturnSummary>({ totalValue: 0, exchangeCount: 0, cashCount: 0, totalReturns: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/sales-returns');
      const data = await res.json();
      if (data.success) {
        setReturns(data.data);
        setSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md transition-colors">
        <div className="flex items-center gap-3">
            <Undo2 className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-black tracking-widest italic">REVERSE_LOGISTICS_AUDIT</span>
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-2">
            <button className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 transition flex items-center gap-2 font-black shadow-sm active:scale-95">
                <Download className="w-3.5 h-3.5" /> EXPORT_DATA
            </button>
            <button 
                onClick={fetchData}
                className="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 transition flex items-center gap-2 font-black shadow-sm active:scale-95"
            >
                <RefreshCcw className="w-3.5 h-3.5" /> SYNC_BUFFER
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white custom-scrollbar">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                <tr className="text-slate-400 bg-slate-50/80 backdrop-blur-md font-black italic">
                    <th className="py-4 px-6 font-black border-r border-[#2d303b]/30">Timestamp</th>
                    <th className="py-4 px-6 font-black border-r border-[#2d303b]/30">Return_ID</th>
                    <th className="py-4 px-6 font-black border-r border-[#2d303b]/30">Origin_Sale_IDX</th>
                    <th className="py-4 px-6 font-black border-r border-[#2d303b]/30">Refund_Vector</th>
                    <th className="py-4 px-6 font-black border-r border-[#2d303b]/30 text-center">Payload_Mass</th>
                    <th className="py-4 px-6 font-black text-right">Debit_Val</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
                {isLoading && returns.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="py-20 text-center font-black animate-pulse tracking-[0.5em] text-slate-400 uppercase italic">BUFFERING_RETURN_STREAM...</td>
                    </tr>
                ) : returns.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="py-20 text-center font-black text-slate-300 tracking-[0.5em] uppercase italic grayscale select-none">NULL_RETURN_RECORDS</td>
                    </tr>
                ) : (
                    returns.map((ret: any) => (
                        <tr key={ret.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-black italic">
                                {new Date(ret.created_at).toLocaleString()}
                            </td>
                            <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-900 italic">
                                RETx{ret.id.toString().padStart(5, '0')}
                            </td>
                            <td className="py-4 px-6 border-r border-slate-100 font-black text-indigo-600 tracking-widest">
                                #INV_{ret.sale_id}
                            </td>
                            <td className="py-4 px-6 border-r border-slate-100">
                                <span className={`px-2 py-0.5 rounded border transition-colors ${
 ret.refund_type === 'CASH' ? 'border-emerald-500/30 bg-emerald-50 text-emerald-600 ' : 'border-orange-500/30 bg-orange-50 text-orange-600 '
 } font-black italic text-[8px]`}>
                                    {ret.refund_type}
                                </span>
                            </td>
                            <td className="py-4 px-6 border-r border-slate-100 text-center text-slate-500 font-black tracking-tighter">
                                {ret.sum_qty} UNITS <span className="text-slate-300">[{ret.num_items}_LINES]</span>
                            </td>
                            <td className="py-4 px-6 text-right font-black text-slate-900 italic underline decoration-indigo-500 underline-offset-4 decoration-2">
                                {currency.symbol}{ret.total_refund.toFixed(2)}
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
      </div>


    </div>
  );
}
