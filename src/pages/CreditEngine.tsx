import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Zap, Settings, History, CheckCircle2, XCircle, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function CreditEngine() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', product_id: '', is_active: true });
  
  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchData = async () => {
    try {
      const [logsRes, prodRes, configRes] = await Promise.all([
        fetch('/api/admin/rfid-logs', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/products', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/auto-sale-config', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      
      const logsData = await logsRes.json();
      const prodData = await prodRes.json();
      const configData = await configRes.json();
      
      if (logsData.success) setLogs(logsData.data);
      if (prodData.success) setProducts(prodData.data);
      if (configData.success) setConfigs(configData.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Poll every 3 seconds for live monitoring
    return () => clearInterval(interval);
  }, []);

  const handleCreateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auto-sale-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowConfigForm(false);
        fetchData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error saving config');
    } finally {
      setLoading(false);
    }
  };

  const toggleConfig = async (config: any) => {
    try {
      const res = await fetch(`/api/admin/auto-sale-config/${config.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...config, is_active: !config.is_active })
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase overflow-hidden transition-colors duration-300">
      {/* Header Area */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span className="text-slate-900 font-black tracking-widest italic">ADV_CREDIT_ENGINE_v4.2</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-emerald-500/20 rounded">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[8px] font-black text-emerald-600 tracking-widest italic">CORE_KERNEL_ONLINE</span>
           </div>
           <button 
             onClick={() => setShowConfigForm(true)}
             className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4 py-1.5 rounded transition flex items-center gap-2 tracking-widest text-[9px] shadow-sm"
           >
             <Settings className="w-3.5 h-3.5" /> AUTO_SALE_CFG
           </button>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden bg-white">
        
        {/* Monitoring Panel */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-hidden bg-slate-50 border border-slate-200 rounded p-6 shadow-sm">
           <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-4">
              <h2 className="text-[11px] font-black text-slate-900 italic tracking-[0.2em] flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> LIVE_SCAN_MONITOR_SENTRY
              </h2>
              <div className="text-[8px] font-bold text-slate-400 tracking-tighter">LATENCY_MS: [240]</div>
           </div>

           <div className="flex-1 overflow-auto custom-scrollbar space-y-2 pr-2">
              {logs.map((log) => (
                <div 
                  key={log.id} 
                  className={`p-4 border transition-all duration-300 animate-in slide-in-from-left-4 flex items-center justify-between ${
 log.status === 'SUCCESS' ? 'bg-white border-emerald-500/20 shadow-sm' : 
 log.status === 'DUPLICATE' ? 'bg-white border-orange-500/10 shadow-sm' : 
 'bg-white border-red-500/20 shadow-sm'
 }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`${
 log.status === 'SUCCESS' ? 'text-emerald-600 ' : 
 log.status === 'DUPLICATE' ? 'text-orange-600 ' : 
 'text-red-600 '
 }`}>
                      {log.status === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5" /> : 
                       log.status === 'DUPLICATE' ? <RefreshCw className="w-5 h-5" /> : 
                       <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-900 italic tracking-widest flex items-center gap-3">
                        {log.customer_name || 'ANON_ENT_SCAN'}
                        <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded tracking-widest uppercase">{log.rfid_card}</span>
                      </div>
                      <div className="text-[9px] text-slate-400 font-bold italic mt-1 uppercase">
                        {log.status === 'SUCCESS' ? log.reason : <span className="text-red-600 uppercase">{log.reason}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] font-bold text-slate-400 tracking-tighter italic">{new Date(log.created_at).toLocaleTimeString()}</div>
                    <div className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${
 log.status === 'SUCCESS' ? 'text-emerald-600 ' : 
 log.status === 'DUPLICATE' ? 'text-amber-500' :
 log.status === 'INSUFFICIENT_CREDIT' ? 'text-red-400' :
 'text-red-600 '
 }`}>{log.status}</div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300 opacity-30">
                  <History className="w-12 h-12 mb-3" />
                  <p className="font-black tracking-[0.5em] text-xs">AWAITING_RFID_PULSE...</p>
                </div>
              )}
           </div>
        </div>

        {/* Info/Status Panel */}
        <div className="flex flex-col gap-6">
           <div className="bg-indigo-600 p-6 text-white shadow-xl shadow-indigo-500/10 relative overflow-hidden group rounded">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                  <Zap size={120} />
              </div>
              <h3 className="text-[9px] font-black mb-4 opacity-50 uppercase tracking-[0.3em]">ACTIVE_PKG_INJECTOR</h3>
              {configs.find(c => c.is_active) ? (
                 <div className="relative z-10">
                   <div className="text-2xl font-black mb-1 italic tracking-tighter">{configs.find(c => c.is_active).name}</div>
                   <div className="text-[9px] opacity-70 font-bold italic flex items-center gap-1 mb-6 uppercase">
                     IDENTIFIER_REF: {configs.find(c => c.is_active).product_id}
                   </div>
                   <div className="p-3 bg-white/5 border border-white/10 text-[9px] font-black italic tracking-widest">
                     SETTLE_MODEL: BURN_IN_DAILY_CHKSUM
                   </div>
                 </div>
              ) : (
                <div className="flex items-center gap-2 text-white/50 py-4 font-black italic tracking-widest text-[9px]">
                  <AlertCircle className="w-4 h-4" /> NO_ACTIVE_PKG_FOUND
                </div>
              )}
           </div>

           <div className="bg-slate-50 border border-slate-200 p-6 flex-1 flex flex-col rounded shadow-sm">
             <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 border-b border-slate-100 pb-2">ENGINE_METRICS</h3>
             <div className="space-y-6 flex-1">
               <div className="flex justify-between items-end group">
                 <div>
                   <div className="text-[24px] font-black text-slate-900 italic leading-none group-hover:text-emerald-600 transition-colors">{logs.filter(l => l.status === 'SUCCESS').length}</div>
                   <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">SUCCESS_AUTOMATIONS</div>
                 </div>
                 <div className="text-emerald-600 font-black italic text-[9px] bg-emerald-50 px-2 py-0.5 rounded tracking-tighter">99.8%_YIELD</div>
               </div>
               
               <div className="flex justify-between items-end group">
                 <div>
                   <div className="text-[24px] font-black text-slate-900 italic leading-none group-hover:text-red-600 transition-colors">{logs.filter(l => l.status !== 'SUCCESS').length}</div>
                   <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">REJECTED_ENTRIES</div>
                 </div>
                 <div className="text-red-600 font-black italic text-[9px] bg-red-50 px-2 py-0.5 rounded tracking-tighter">0.2%_ERR</div>
               </div>

               <div className="flex justify-between items-end">
                 <div>
                   <div className="text-[16px] font-black text-slate-900 italic leading-none uppercase tracking-tighter underline decoration-slate-100 underline-offset-4 decoration-2">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</div>
                   <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-2">CURRENT_CYC_VECTOR</div>
                 </div>
               </div>
             </div>

             <div className="mt-10 pt-6 border-t border-slate-100">
               <div className="p-4 bg-indigo-500/[0.03] border border-indigo-500/20 text-[8px] text-slate-400 font-black italic leading-normal uppercase">
                 SEC_PROTOCOL: DAILY_REBOOT_TRIGGERED_AT_0000_UTC. UNUSED_PORTIONS_AUTO_COMMITTED_TO_BURN_LOG.
               </div>
             </div>
           </div>
        </div>

      </div>

      {/* Footer Status Bar */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div className="flex gap-4">
            <span>ENG_IDENT : {Math.random().toString(36).substring(7).toUpperCase()}</span>
            <span>CYC_UPTIME : 142ms_P50</span>
         </div>
         <div>SYSTEM_READY.ENGINE_CORE : {new Date().toISOString()}</div>
      </div>

      {/* Config Overlay */}
      {showConfigForm && (
        <div className="fixed inset-0 bg-[#0f1117]/80 backdrop-blur-md z-50 flex items-center justify-center p-0">
           <div className="bg-[#181a20] border border-[#2d303b] p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button 
                onClick={() => setShowConfigForm(false)}
                className="absolute top-4 right-4 p-1 bg-[#2d303b] hover:bg-[#3b404d] text-slate-500 hover:text-white rounded transition-colors"
              >
                <X size={16} />
              </button>
              
              <h2 className="text-xl font-black text-white italic tracking-tighter mb-1 uppercase">AUTO_SALE_CONFIG_LAYER</h2>
              <p className="text-[9px] text-slate-500 mb-8 font-black uppercase italic tracking-widest">MAP_RFID_SIG_TO_ASSET_CLASS</p>
              
              <form onSubmit={handleCreateConfig} className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest">CONFIG_IDENT_NAME (EX: LUNCH_VEC)</label>
                  <input 
                    type="text" 
                    required 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-3 bg-[#2d303b] border border-[#3b404d] focus:border-indigo-500 focus:outline-none text-white font-black italic text-sm tracking-widest" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[8px] font-black text-slate-600 uppercase tracking-widest">SELECT_TARGET_ASSET</label>
                  <select 
                    required 
                    value={formData.product_id} 
                    onChange={e => setFormData({...formData, product_id: e.target.value})}
                    className="w-full px-4 py-3 bg-[#2d303b] border border-[#3b404d] focus:border-indigo-500 focus:outline-none text-white font-black italic text-sm tracking-widest"
                  >
                    <option value="">CHOOSE_ITEM...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#181a20]">{p.name} • {currency.symbol}{p.selling_price}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                   <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        id="auto-active"
                        checked={formData.is_active}
                        onChange={e => setFormData({...formData, is_active: e.target.checked})}
                        className="w-4 h-4 rounded bg-[#2d303b] border-[#3b404d] text-indigo-600 focus:ring-0"
                      />
                   </div>
                   <label htmlFor="auto-active" className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic cursor-pointer">SET_AS_PRIMARY_SENTRY_ENGINE</label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={loading} className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-[0.3em] transition shadow-xl shadow-indigo-500/10 active:scale-95 italic">
                    {loading ? 'MODULATING...' : 'SAVE_ENGINE_CONFIG'}
                  </button>
                </div>
              </form>

              <div className="mt-10 border-t border-[#2d303b] pt-6 flex flex-col h-[200px]">
                <h3 className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em] mb-4">SAVED_CONFIG_VECTORS</h3>
                <div className="flex-1 overflow-auto pr-2 custom-scrollbar space-y-4">
                   {configs.map(c => (
                     <div key={c.id} className="flex items-center justify-between p-3 bg-[#1c1f26]/50 border border-[#2d303b] hover:border-indigo-500/30 transition-colors">
                        <div>
                          <div className="font-black text-[10px] text-white tracking-widest italic uppercase">{c.name}</div>
                          <div className="text-[7px] text-slate-600 font-bold uppercase mt-1">ASSET_IDENT: {c.product_id}</div>
                        </div>
                        <button 
                          onClick={() => toggleConfig(c)}
                          className={`px-3 py-1 text-[7px] font-black uppercase tracking-widest transition-all ${
 c.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 italic' : 'bg-[#2d303b] text-slate-500'
 }`}
                        >
                          {c.is_active ? 'ACTIVE' : 'READY'}
                        </button>
                     </div>
                   ))}
                </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
