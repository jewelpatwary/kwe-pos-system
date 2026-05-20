import React, { useEffect, useState } from 'react';
import { X, Printer, Loader2, FileText, TrendingUp, CreditCard, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from './ThemeProvider';

interface POSSummaryModalProps {
  onClose: () => void;
}

interface SummaryData {
  category_name: string;
  product_name: string;
  barcode: string;
  qty: number;
  total: number;
}

interface SummaryTotals {
  grandTotal: number;
  totalCredit: number;
  totalCash: number;
  totalOnline: number;
  totalAutoBurn: number;
}

export default function POSSummaryModal({ onClose }: POSSummaryModalProps) {
  const [data, setData] = useState<SummaryData[]>([]);
  const [summary, setSummary] = useState<SummaryTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const { currency } = useTheme();
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pos/daily-summary?date=${selectedDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setSummary(json.summary);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchStore = async () => {
      try {
        const res = await fetch('/api/settings/store', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setStoreProfile(data.data);
      } catch (err) { console.error(err); }
    };

    fetchSummary();
    fetchStore();
  }, [token, selectedDate]);

  const handlePrint = () => {
    window.print();
  };

  const groupedData = data.reduce((acc, curr) => {
    if (!acc[curr.category_name]) {
      acc[curr.category_name] = [];
    }
    acc[curr.category_name].push(curr);
    return acc;
  }, {} as Record<string, SummaryData[]>);

  const categories = Object.keys(groupedData);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded text-white shadow-lg shadow-indigo-500/10">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 tracking-widest uppercase text-sm">DAILY_SALES_SUMMARY</h2>
              <div className="flex items-center gap-2 mt-1">
                 <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="p-1 border border-slate-300 rounded text-[9px] font-black uppercase text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500"
                 />
                 <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">• {storeProfile?.shop_name || 'POS_STATION_ALPHA'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              disabled={loading}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-all shadow-md disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div id="summary-print-area" className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white print:p-0 print:overflow-visible text-slate-900">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center py-20 grayscale opacity-20">
               <Loader2 className="w-12 h-12 animate-spin mb-4" />
               <div className="text-[10px] font-black uppercase tracking-[0.5em]">COMPILING_DAY_LOGS...</div>
            </div>
          ) : (
            <div className="text-slate-900 font-mono text-[11px] leading-relaxed">
              {/* Receipt Header (Visible only in print or clearly in UI) */}
              <div className="text-center mb-8 border-b border-dashed border-slate-300 pb-6 text-slate-900">
                <div className="text-lg font-black tracking-tighter uppercase mb-1">{storeProfile?.shop_name || 'KWE POS System'}</div>
                {storeProfile?.company_name && <div className="text-[10px] font-bold uppercase">{storeProfile.company_name}</div>}
                {storeProfile?.registration_number && <div className="text-[9px] text-slate-500 uppercase mt-1">Registration No: {storeProfile.registration_number}</div>}
                {storeProfile?.address && <div className="text-[8px] text-slate-400 max-w-[200px] mx-auto mt-2 whitespace-pre-line">{storeProfile.address}</div>}
                {storeProfile?.phone_number && <div className="text-[9px] text-slate-500 uppercase mt-1">TEL: {storeProfile.phone_number}</div>}
                
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="text-[10px] font-black tracking-widest uppercase">DAILY_SALES_REPORT</div>
                  <div className="text-[8px] opacity-60">
                    {new Date().toLocaleDateString()} 12:00:00 AM - {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-8">
                {categories.map(cat => (
                  <div key={cat} className="space-y-3">
                    <div className="border-b-2 border-slate-900 pb-1 flex justify-between items-end">
                      <span className="font-black text-sm tracking-widest truncate">{cat}</span>
                      <div className="flex gap-12 text-[10px] uppercase font-bold opacity-40">
                         <span>Qty</span>
                         <span>Total</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                       {groupedData[cat].map((item, idx) => (
                         <div key={idx} className="flex justify-between items-start">
                           <div className="flex flex-col max-w-[65%]">
                             <div className="font-bold truncate">[{item.barcode || 'N/A'}] {item.product_name}</div>
                           </div>
                           <div className="flex gap-12 font-bold min-w-[120px] justify-end">
                             <span className="w-8 text-right">{item.qty}</span>
                             <span className="w-16 text-right whitespace-nowrap">{currency.symbol}{item.total.toFixed(2)}</span>
                           </div>
                         </div>
                       ))}
                    </div>

                    <div className="pt-2 border-t border-dotted border-slate-300 flex justify-between font-black">
                      <span>Subtotal</span>
                      <div className="flex gap-12">
                         <span className="w-8 text-right underline decoration-double">{groupedData[cat].reduce((sum, i) => sum + i.qty, 0)}</span>
                         <span className="w-16 text-right underline decoration-double">{currency.symbol}{groupedData[cat].reduce((sum, i) => sum + i.total, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Totals */}
              <div className="mt-12 pt-8 border-t-4 border-slate-900 space-y-4">
                 <div className="flex justify-between items-center py-2 px-3 bg-slate-100 rounded border border-slate-200 font-black">
                    <span>Product Category Subtotal</span>
                    <span>{currency.symbol}{data.reduce((sum, i) => sum + i.total, 0).toFixed(2)}</span>
                 </div>

                <div className="pt-8 grid grid-cols-1 gap-1 border-t border-dashed border-slate-300">
                   <div className="flex justify-between items-center py-2 px-3 opacity-80">
                      <div className="flex items-center gap-2">
                         <CreditCard className="w-3 h-3 text-indigo-500" />
                         <span className="font-black tracking-widest uppercase">Credit Sales</span>
                      </div>
                      <span className="font-black text-indigo-600">{currency.symbol}{summary?.totalCredit.toFixed(2)}</span>
                   </div>
                   
                   <div className="flex justify-between items-center py-2 px-3 opacity-80">
                      <span className="font-black tracking-[0.2em] uppercase text-[9px]">Cash Volume</span>
                      <span className="font-bold">{currency.symbol}{summary?.totalCash.toFixed(2)}</span>
                   </div>
                   
                   <div className="flex justify-between items-center py-2 px-3 opacity-80">
                      <span className="font-black tracking-[0.2em] uppercase text-[9px]">TNG</span>
                      <span className="font-bold">{currency.symbol}{summary?.totalOnline.toFixed(2)}</span>
                   </div>

                   <div className="flex justify-between items-center py-2 px-3 bg-orange-50 rounded border border-orange-100">
                      <div className="flex items-center gap-2">
                         <Flame className="w-3 h-3 text-orange-500" />
                         <span className="font-black tracking-widest uppercase">Auto Burn Amount</span>
                      </div>
                      <span className="font-black text-orange-600">{currency.symbol}{summary?.totalAutoBurn.toFixed(2)}</span>
                   </div>
                </div>

                <div className="flex justify-between items-center text-lg font-black uppercase mt-4 pt-4 border-t-2 border-slate-900">
                  <span>Grand Total</span>
                  <div className="flex gap-12">
                     <span className="w-8 text-right">{data.reduce((sum, i) => sum + i.qty, 0)}</span>
                     <span className="w-16 text-right underline underline-offset-4">{currency.symbol}{summary?.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-10 text-center space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] italic">--- END_OF_SUMMARY_LOG ---</div>
                   <div className="text-[8px] opacity-40 font-bold uppercase tracking-widest">SYSTEM_GENERATED_REPORT_MD_v2.0</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CSS for print */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            #summary-print-area, #summary-print-area * {
              visibility: visible;
            }
            #summary-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm; /* Standard receipt width */
              margin: 0;
              padding: 5mm;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
            /* Hide theme-specific colors and backgrounds to save ink and ensure readability */
            #summary-print-area {
              background: white !important;
              color: black !important;
            }
            .dark #summary-print-area {
               color: black !important;
               background: white !important;
            }
          }
        `}} />
      </motion.div>
    </motion.div>
  );
}
