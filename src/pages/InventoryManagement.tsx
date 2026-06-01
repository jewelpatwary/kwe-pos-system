import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Package, Search, Plus, Save, CheckCircle2, 
  AlertTriangle, History, BarChart3, ArrowRight,
  TrendingUp, TrendingDown, ClipboardCheck, Trash2, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function InventoryManagement() {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [physicalQty, setPhysicalQty] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const { token } = useAuthStore();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/inventory/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/inventory/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) { console.error(err); }
  };

  const startNewSession = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/inventory/sessions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        fetchSessionDetails(data.id);
      } else {
        alert(data.message || 'Error creating session');
      }
    } catch (err) { alert('Error connecting to server'); }
    finally { setLoading(false); }
  };

  const fetchSessionDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setActiveSession(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleProductSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/products/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSearchResults(data.data);
    } catch (err) { console.error(err); }
  };

  const addProductToSession = async () => {
    if (!selectedProduct || !physicalQty) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          physical_stock: parseInt(physicalQty)
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchSessionDetails(activeSession.id);
        setSelectedProduct(null);
        setPhysicalQty('');
        setSearchQuery('');
        setSearchResults([]);
        searchInputRef.current?.focus();
      }
    } catch (err) { alert('Error adding product'); }
    finally { setLoading(false); }
  };

  const completeSession = async (option: 'AUTO_UPDATE' | 'FINISH_ONLY') => {
    if (!confirm(`Are you sure you want to complete this session with ${option === 'AUTO_UPDATE' ? 'auto stock update' : 'audit only'}?`)) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ option })
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(null);
        fetchSessions();
        fetchStats();
      }
    } catch (err) { alert('Error completing session'); }
    finally { setLoading(false); }
  };

  if (activeSession) {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
           <div className="flex items-center gap-3">
              <span className="text-indigo-600 font-black">AUDIT_SESSION_#{activeSession.id}</span>
              <span className="text-slate-400 font-bold tracking-[0.2em]">| {new Date(activeSession.date).toISOString()}</span>
           </div>
           <div className="flex items-center gap-2">
               <button onClick={() => setActiveSession(null)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded text-slate-600 transition-colors shadow-sm">SAVE_DRAFT</button>
               <button onClick={() => completeSession('AUTO_UPDATE')} disabled={activeSession.items.length === 0} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50 shadow-lg shadow-emerald-500/10">SYNC_REGISTRY</button>
           </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-3 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        ref={searchInputRef}
                        type="text"
                        placeholder="SCAN_BARCODE_OR_UUID..."
                        value={searchQuery}
                        onChange={(e) => handleProductSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
                    />
                    {searchResults.length > 0 && searchQuery && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-2xl z-50 overflow-hidden">
                            {searchResults.map(p => (
                                <button key={p.id} onClick={() => { setSelectedProduct(p); setSearchResults([]); setSearchQuery(p.name); }} className="w-full px-4 py-2 text-left hover:bg-indigo-50 transition flex justify-between border-b border-slate-100">
                                    <span className="text-slate-900 font-black">{p.name} <span className="text-slate-400 ml-2">({p.barcode})</span></span>
                                    <span className="text-indigo-600">SELECT_REF</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {selectedProduct && (
                    <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded animate-in fade-in zoom-in-95">
                        <span className="text-indigo-600 font-black">{selectedProduct.barcode}</span>
                        <input 
                            type="number"
                            min="0"
                            value={physicalQty}
                            autoFocus
                            onChange={(e) => setPhysicalQty(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addProductToSession()}
                            className="w-20 bg-white border border-slate-200 text-slate-900 px-2 py-0.5 rounded outline-none shadow-sm"
                            placeholder="QTY"
                        />
                        <button onClick={addProductToSession} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-0.5 rounded text-[9px] shadow-sm">PUSH</button>
                        <button onClick={() => setSelectedProduct(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto border-x border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                        <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                            <th className="py-3 px-6 font-black border-r border-slate-200 text-[9px]">ID_IDENT</th>
                            <th className="py-3 px-6 font-black border-r border-slate-200 text-[9px]">DESCRIPTOR</th>
                            <th className="py-3 px-6 font-black text-center border-r border-slate-200 text-[9px]">SYS_STOCK</th>
                            <th className="py-3 px-6 font-black text-center border-r border-slate-200 text-[9px]">PHYS_STOCK</th>
                            <th className="py-3 px-6 font-black text-center border-r border-slate-200 text-[9px]">VARIANCE</th>
                            <th className="py-3 px-6 font-black text-right text-[9px]">VAL_DIFF</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 transition-colors">
                        {activeSession.items.map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-3 px-6 border-r border-slate-100 text-slate-400">{item.barcode}</td>
                                <td className="py-3 px-6 border-r border-slate-100 font-black text-slate-900 uppercase">{item.name}</td>
                                <td className="py-3 px-6 border-r border-slate-100 text-center font-black text-slate-400">{item.system_stock}</td>
                                <td className="py-3 px-6 border-r border-slate-100 text-center font-black text-indigo-600 italic">[{item.physical_stock}]</td>
                                <td className="py-3 px-6 border-r border-slate-100 text-center font-black">
                                    {item.difference > 0 ? <span className="text-emerald-600">+{item.difference}</span> : item.difference < 0 ? <span className="text-red-600">{item.difference}</span> : <span className="text-slate-300">0</span>}
                                </td>
                                <td className={`py-3 px-6 text-right font-black ${item.value_difference < 0 ? 'text-red-600 ' : 'text-emerald-600 '}`}>
                                    {currency.symbol}{item.value_difference.toFixed(2)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>


      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
           <div className="flex items-center gap-3">
              <History className="w-4 h-4 text-indigo-600" />
              <span className="text-slate-900 font-black tracking-widest">STOCK_RECONCILIATION_LOG</span>
           </div>
           <div className="flex items-center gap-2">
               <button onClick={startNewSession} disabled={loading} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition flex items-center gap-2 shadow-lg shadow-indigo-500/10">
                 <Plus className="w-3.5 h-3.5" /> INIT_SESSION
               </button>
           </div>
        </div>

        <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <tr className="text-slate-500 bg-slate-50 text-[9px] backdrop-blur-md transition-colors">
                        <th className="py-3 px-6 font-black border-r border-slate-200">Session_UUID</th>
                        <th className="py-3 px-6 font-black border-r border-slate-200">Sync_Date</th>
                        <th className="py-3 px-6 font-black border-r border-slate-200">Sys_Value</th>
                        <th className="py-3 px-6 font-black border-r border-slate-200 text-center">Variance_Vol</th>
                        <th className="py-3 px-6 font-black border-r border-slate-200">Status</th>
                        <th className="py-3 px-6 font-black text-right">Ops</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 transition-colors">
                    {sessions.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                           <td className="py-3 px-6 border-r border-slate-100 text-slate-400">#{s.id.toString().padStart(5, '0')}</td>
                           <td className="py-3 px-6 border-r border-slate-100 text-slate-900 font-black">{new Date(s.date).toLocaleDateString()}</td>
                           <td className="py-3 px-6 border-r border-slate-100 font-bold text-slate-600">{currency.symbol}{s.total_system_value.toFixed(2)}</td>
                           <td className="py-3 px-6 border-r border-slate-100 text-center">
                               <span className={`font-black ${s.total_difference < 0 ? 'text-red-600 ' : 'text-emerald-600 '}`}>
                                   {s.total_difference > 0 ? '+' : ''}{s.total_difference.toFixed(2)}
                               </span>
                           </td>
                           <td className="py-3 px-6 border-r border-slate-100">
                               <span className={`text-[9px] font-black italic px-2 py-0.5 rounded border ${s.status === 'COMPLETED' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 ' : 'bg-orange-50 border-orange-200 text-orange-600 '}`}>
                                   {s.status}
                               </span>
                           </td>
                           <td className="py-3 px-6 text-right">
                               <button onClick={() => fetchSessionDetails(s.id)} className="p-1 px-3 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 border border-slate-200 rounded transition-all shadow-sm">LOAD_DATA</button>
                           </td>
                        </tr>
                    ))}
                    {sessions.length === 0 && (
                        <tr>
                            <td colSpan={6} className="py-20 text-center font-black text-slate-300 tracking-[0.5em]">EMPTY_SESSION_HISTORY</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>


      </div>
    );
}
