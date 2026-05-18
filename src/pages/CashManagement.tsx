import React, { useState } from 'react';
import { Banknote, ShieldAlert, LogOut, ArrowRightCircle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider';

export default function CashManagement() {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [cashInDrawer, setCashInDrawer] = useState(150.00);

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Header Area */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Banknote className="w-4 h-4 text-indigo-600" />
          <span className="text-slate-900 font-black tracking-widest">Register & Drawer Management</span>
        </div>
        <div className="flex items-center gap-2">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-emerald-500/20 rounded">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[8px] font-black text-emerald-600 tracking-widest">Drawer 01 Connected</span>
           </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 custom-scrollbar bg-white">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 p-10 text-center flex flex-col items-center justify-center min-h-[350px] relative overflow-hidden group shadow-sm">
            <div className="absolute top-0 left-0 w-full h-full bg-indigo-500/[0.02] -skew-y-12 translate-y-32 group-hover:translate-y-24 transition-transform duration-1000"></div>
            
            <span className="text-slate-400 font-black tracking-[0.3em] mb-6">Expected Value Reconciliation</span>
            <div className="text-7xl font-black text-slate-900 mb-10 tracking-tighter italic">
              {currency.symbol}{cashInDrawer.toFixed(2)}
            </div>
            
            <div className="flex gap-4 relative z-10">
              <button className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded transition-all flex items-center gap-3 tracking-widest shadow-xl shadow-indigo-500/10 active:scale-95">
                 <ArrowRightCircle className="w-5 h-5" /> Push Cash In
              </button>
              <button className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black rounded border border-slate-200 transition-all flex items-center gap-3 tracking-widest active:scale-95">
                 <LogOut className="w-5 h-5" /> Push Cash Out
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-50 border-b border-slate-200 font-black text-slate-500 tracking-widest">Register Sync Logs (Last 12H)</div>
            <div className="divide-y divide-slate-100">
               {[
                 { action: 'CASH_IN_INIT', meta: 'By Admin at 08:00 AM', val: 150.00, type: 'pos' },
                 { action: 'CASH_SALE_TRX', meta: 'INV-1021 at 09:14 AM', val: 24.50, type: 'pos' },
                 { action: 'CASH_SALE_TRX', meta: 'INV-1022 at 09:18 AM', val: 18.00, type: 'pos' },
                 { action: 'VOID_REFUND', meta: 'INV-1022 at 09:20 AM', val: -18.00, type: 'neg' },
                 { action: 'CASH_OUT_VENDOR', meta: 'By Admin at 11:30 AM', val: -24.50, type: 'neg' },
               ].map((log, i) => (
                 <div key={i} className="px-6 py-4 flex justify-between items-center group hover:bg-slate-50 transition-colors">
                   <div className="flex flex-col">
                     <div className="font-black text-slate-900 italic tracking-widest underline decoration-slate-200 underline-offset-4">{log.action}</div>
                     <div className="text-slate-400 font-bold mt-1 tracking-tighter uppercase">{log.meta}</div>
                   </div>
                   <div className={`font-black text-lg ${log.type === 'pos' ? 'text-emerald-600 ' : 'text-red-600 '} italic`}>
                     {log.val > 0 ? '+' : ''}{log.val.toFixed(2)}
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-8 flex flex-col relative overflow-hidden shadow-sm">
           <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-red-500/[0.03] rounded-full blur-3xl"></div>
           
           <h3 className="font-black text-slate-900 mb-6 flex items-center gap-3 border-b border-slate-100 pb-4 tracking-widest">
              <ShieldAlert className="w-5 h-5 text-orange-500" /> End of Cycle Protos
           </h3>
           <p className="text-slate-500 font-bold mb-8 leading-relaxed italic tracking-tight">
             Initiate Z-Read reconciliation. This will lock the current active register till and log all variance discrepancies to audit log.
           </p>

           <div className="flex flex-col gap-6 flex-1 relative z-10">
             <div className="space-y-2">
               <label className="block text-[9px] font-black text-slate-400 tracking-[0.2em]">Actual Cash Count</label>
               <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">{currency.symbol}</span>
                 <input type="number" step="0.01" className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-black text-2xl italic tracking-tighter" placeholder="0.00" />
               </div>
             </div>

             <div className="mt-auto space-y-4 pt-10">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded">
                   <div className="flex items-center gap-2 text-orange-600 font-black text-[8px] uppercase tracking-widest mb-1">
                      <ShieldAlert size={12} /> Security Warning
                   </div>
                   <p className="text-[7px] text-slate-400 font-bold leading-tight uppercase italic">Closing the register is irreversible for the current session. All sales data will be committed to master vault.</p>
                </div>
                <button className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded transition-all text-sm tracking-[0.3em] shadow-xl shadow-red-500/10 active:scale-95 italic">
                   Execute Z-Read & Lock
                </button>
             </div>
           </div>
        </div>

      </div>

      {/* Footer Status Bar */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div className="flex gap-4">
            <span>Register ID : {Math.random().toString(16).substring(2, 10).toUpperCase()}</span>
            <span>UPTIME : 12h_42m_05s</span>
         </div>
         <div>SYSTEM_READY.SECURE_LAYER_6 : {new Date().toISOString()}</div>
      </div>
    </div>
  );
}
