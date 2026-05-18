import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardCheck, Search, Plus, Trash2, Save, 
  ArrowLeft, CheckCircle2, AlertCircle, RefreshCcw,
  BarChart3, History, PackageSearch, PackageOpen,
  ArrowRightLeft, AlertTriangle, Check
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';

interface InventorySession {
  id: number;
  date: string;
  created_by: number;
  creator_name: string;
  status: 'DRAFT' | 'COMPLETED';
  total_system_value: number;
  total_physical_value: number;
  total_difference: number;
  created_at: string;
}

interface InventoryItem {
  id: number;
  inventory_id: number;
  product_id: number;
  name: string;
  barcode: string;
  system_stock: number;
  physical_stock: number;
  difference: number;
  buying_price: number;
  selling_price: number;
  value_difference: number;
}

interface Product {
  id: number;
  name: string;
  barcode: string;
  stock_quantity: number;
  purchase_price: number;
}

export default function InventoryAudit() {
  const { token } = useAuthStore();
  const { currency } = useTheme();
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [sessionItems, setSessionItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [view, setView] = useState<'list' | 'editor'>('list');
  
  // Editor state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [completing, setCompleting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSessions();
    fetchStats();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`/api/admin/inventory/sessions?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionDeleteClick = (id: number) => {
    console.log('[AUDIT] Session delete requested for ID:', id);
    setSessionToDelete(id);
  };

  const handleItemDeleteClick = (itemId: number) => {
    console.log('[AUDIT] Item delete requested for ID:', itemId);
    setItemToDelete(itemId);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    await deleteSession(sessionToDelete);
    setSessionToDelete(null);
  };

  const confirmDeleteItem = async () => {
    if (!itemToDelete) return;
    await deleteItemFromSession(itemToDelete);
    setItemToDelete(null);
  };

  const deleteSession = async (id: number) => {
    console.log("Delete session function called for ID:", id);
    try {
      console.log("Proceeding to delete session ID:", id);
      setDeletingId(id);
      const res = await fetch(`/api/admin/inventory/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log("Delete session response status:", res.status);
      
      if (res.ok) {
        console.log("Delete session successful");
        fetchSessions();
        fetchStats();
      } else {
        const error = await res.json();
        console.error("Delete session error response:", error);
        alert(error.message || 'Error deleting session');
      }
    } catch (err) {
      console.error("Delete session error:", err);
      alert('An error occurred during deletion.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteItemFromSession = async (itemId: number) => {
    console.log("Attempting to delete item:", itemId, "Active session:", activeSession?.id);
    if (!activeSession) {
      console.error("No active session");
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      console.log("Delete response:", res.status, res.ok);

      if (res.ok) {
        // Refresh session items
        const sessionRes = await fetch(`/api/admin/inventory/sessions/${activeSession.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const sessionData = await sessionRes.json();
        console.log("Refresh response data:", sessionData);
        if (sessionData.success) {
          setSessionItems(sessionData.data.items || []);
        }
      } else {
        const error = await res.json();
        console.error("Delete error:", error);
        alert(`Error deleting item ${itemId} from session ${activeSession.id}: ${error.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Catch error:", err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/inventory/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startNewSession = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/inventory/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        openSession(data.id);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const openSession = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/inventory/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setActiveSession(data.data);
        setSessionItems(data.data.items || []);
        setView('editor');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/products/search?q=${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setSearchQuery('');
    setSearchResults([]);
    setPhysicalCount('');
    // Auto focus physical count input if we had ref
  };

  const addOrUpdateItem = async () => {
    if (!selectedProduct || physicalCount === '' || !activeSession) return;
    
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/items`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          physical_stock: parseFloat(physicalCount)
        })
      });
      
      if (res.ok) {
        // Refresh session items
        const sessionRes = await fetch(`/api/admin/inventory/sessions/${activeSession.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          setSessionItems(sessionData.data.items || []);
        }
        setSelectedProduct(null);
        setPhysicalCount('');
      } else {
        const error = await res.json();
        alert(error.message || 'Error updating item');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const completeSession = async (option: 'AUTO_UPDATE' | 'FINISH_ONLY') => {
    if (!activeSession) return;
    
    const confirmMsg = option === 'AUTO_UPDATE' 
      ? 'This will update your system stock levels to match your physical counts. Proceed?'
      : 'Finish this audit session without updating system stock levels?';
      
    if (!confirm(confirmMsg)) return;

    try {
      setCompleting(true);
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/complete`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ option })
      });
      
      if (res.ok) {
        setView('list');
        setActiveSession(null);
        fetchSessions();
        fetchStats();
      } else {
        const error = await res.json();
        alert(error.message || 'Error completing session');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCompleting(false);
    }
  };

  if (view === 'editor' && activeSession) {
    return (
      <div className="h-full flex flex-col bg-slate-50">
        {/* Editor Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm sticky top-0 z-50">
           <div className="flex items-center gap-4">
              <button 
                onClick={() => setView('list')}
                className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                   <ClipboardCheck className="w-4 h-4 text-indigo-600" />
                   <h1 className="font-black text-slate-900 tracking-widest uppercase">AUDIT_SESSION_#{activeSession.id}</h1>
                   <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[8px] font-black uppercase tracking-widest leading-none">DRAFT_MODE</span>
                </div>
                <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 mt-1">STARTED_ON: {new Date(activeSession.created_at).toLocaleString()}</div>
              </div>
           </div>

           <div className="flex items-center gap-2">
              <button 
                onClick={() => completeSession('FINISH_ONLY')}
                disabled={completing || sessionItems.length === 0}
                className="px-4 py-2 rounded text-slate-500 hover:text-slate-900 text-[9px] font-black tracking-widest uppercase transition-colors disabled:opacity-30"
              >
                SAVE_AS_REPORT
              </button>
              <button 
                onClick={() => completeSession('AUTO_UPDATE')}
                disabled={completing || sessionItems.length === 0}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10 text-[9px] font-black tracking-widest uppercase disabled:opacity-30"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${completing ? 'animate-spin' : ''}`} /> SYNC_STOCK_LEVELS
              </button>
           </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
           {/* Left Sidebar: Form */}
           <div className="w-[350px] border-r border-slate-200 p-6 bg-white flex flex-col gap-6">
              <div className="space-y-4">
                 <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 shadow-inner">IDENTIFY_ASSET_BY_LABEL</label>
                    <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                       <input 
                         type="text"
                         placeholder="SCAN_BARCODE_OR_SEARCH..."
                         className="w-full bg-slate-50 border border-slate-200 rounded pl-9 pr-4 py-2.5 text-[10px] font-black italic outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                         value={searchQuery}
                         onChange={(e) => {
                           setSearchQuery(e.target.value);
                           searchProducts(e.target.value);
                         }}
                       />
                       {searchResults.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded shadow-2xl z-[100] max-h-[300px] overflow-auto">
                            {searchResults.map(p => (
                               <button 
                                 key={p.id}
                                 onClick={() => handleProductSelect(p)}
                                 className="w-full p-3 flex flex-col items-start border-b border-slate-100 hover:bg-indigo-50 transition-colors text-left group"
                               >
                                  <div className="font-black text-slate-900 text-[10px] group-hover:text-indigo-600 flex items-center justify-between w-full">
                                    <span>{p.name}</span>
                                    <span className="text-[7px] bg-slate-100 px-1 rounded">{p.stock_quantity} UNIT</span>
                                  </div>
                                  <div className="text-[8px] text-slate-400 font-bold tracking-widest mt-0.5">{p.barcode}</div>
                               </button>
                            ))}
                          </div>
                       )}
                    </div>
                 </div>

                 {selectedProduct && (
                    <div className="bg-slate-50 border border-indigo-500/20 rounded p-4 animate-in fade-in slide-in-from-top-2">
                       <div className="text-[10px] font-black text-slate-900 uppercase mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                          <span>{selectedProduct.name}</span>
                          <span className="text-slate-400 font-bold">{selectedProduct.barcode}</span>
                       </div>
                       
                       <div className="flex items-center justify-between mb-4 mt-2">
                          <div className="text-center bg-white p-2 rounded border border-slate-200 flex-1 mr-2">
                             <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">SYSTEM_VAL</div>
                             <div className="text-[14px] font-black text-slate-900">{selectedProduct.stock_quantity}</div>
                          </div>
                          <div className="text-center font-black text-slate-400">vs</div>
                          <div className="flex-1 ml-2">
                             <div className="text-[7px] font-black text-indigo-600 uppercase tracking-widest mb-1 text-center">PHYSICAL_ACT</div>
                             <input 
                               type="number"
                               placeholder="COUNT"
                               className="w-full bg-white border border-indigo-200 rounded py-2 text-center text-[18px] font-black outline-none focus:ring-1 focus:ring-indigo-500 no-spinner text-indigo-600"
                               value={physicalCount}
                               onChange={(e) => setPhysicalCount(e.target.value)}
                               autoFocus
                               onKeyDown={(e) => {
                                 if (e.key === 'Enter') addOrUpdateItem();
                               }}
                             />
                          </div>
                       </div>
                       
                       <button 
                         onClick={addOrUpdateItem}
                         disabled={physicalCount === ''}
                         className="w-full bg-indigo-600 text-white font-black py-2.5 rounded shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest disabled:opacity-30"
                       >
                         <Check className="w-3.5 h-3.5" /> SAVE_COUNT
                       </button>
                    </div>
                 )}
              </div>

              <div className="mt-auto bg-slate-900 rounded p-4 text-white shadow-2xl">
                 <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 border-b border-white/5 pb-2">SESSION_SUMMARY</h4>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center">
                       <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">ITEMS_SCANNED</span>
                       <span className="font-black text-[12px] italic">{sessionItems.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-slate-400 font-bold uppercase tracking-wider text-[8px]">TOTAL_VARIANCE</span>
                       <span className={`font-black text-[12px] italic ${sessionItems.reduce((acc, i) => acc + i.difference, 0) < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                         {sessionItems.reduce((acc, i) => acc + i.difference, 0) > 0 ? '+' : ''}{sessionItems.reduce((acc, i) => acc + i.difference, 0)}
                       </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                       <span className="text-indigo-400 font-bold uppercase tracking-wider text-[8px]">VALUE_DELTA ({currency.code})</span>
                       <span className={`font-black text-[14px] italic ${sessionItems.reduce((acc, i) => acc + i.value_difference, 0) < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                         {currency.symbol}{sessionItems.reduce((acc, i) => acc + i.value_difference, 0).toFixed(2)}
                       </span>
                    </div>
                 </div>
              </div>
           </div>

           {/* Main Area: Item List */}
           <div className="flex-1 p-6 overflow-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full border-t-2 border-t-indigo-500">
                 <table className="w-full text-left">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                       <tr className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-6 py-3">ASSET_IDENTIFIER</th>
                          <th className="px-6 py-3 text-center">SYSTEM_STOCK</th>
                          <th className="px-6 py-3 text-center">PHYSICAL_COUNT</th>
                          <th className="px-6 py-3 text-center">VARIANCE</th>
                          <th className="px-6 py-3 text-right">VALUE_DIFF</th>
                          <th className="px-6 py-3"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {sessionItems.length === 0 ? (
                          <tr>
                             <td colSpan={6} className="py-32 text-center text-slate-400 font-black uppercase tracking-[0.5em] opacity-30">
                                NO_DATA_STREAM_CAPTURED
                             </td>
                          </tr>
                       ) : (
                          sessionItems.map(item => (
                             <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-6 py-4">
                                   <div className="font-black text-slate-900 uppercase text-[10px] tracking-tight">{item.name}</div>
                                   <div className="text-[7px] text-slate-400 font-bold tracking-[0.2em] mt-0.5">{item.barcode}</div>
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-slate-500 italic">
                                   {item.system_stock}
                                </td>
                                <td className="px-6 py-4 text-center font-black text-indigo-600 italic">
                                   {item.physical_stock}
                                </td>
                                <td className="px-6 py-4 text-center">
                                   <span className={`px-2 py-0.5 rounded text-[8px] font-black italic tracking-widest ${
 item.difference === 0 ? 'bg-slate-100 text-slate-500' :
 item.difference > 0 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
 'bg-red-500/10 text-red-600 border border-red-500/20'
 }`}>
                                     {item.difference > 0 ? '+' : ''}{item.difference}
                                   </span>
                                </td>
                                <td className={`px-6 py-4 text-right font-black italic ${item.value_difference < 0 ? 'text-red-500' : item.value_difference > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                   {currency.symbol}{item.value_difference.toFixed(2)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button 
                                     onClick={() => handleItemDeleteClick(item.id)}
                                     className="text-slate-400 hover:text-red-500 transition-colors"
                                     title="Delete Item"
                                   >
                                     <Trash2 className="w-3.5 h-3.5" />
                                   </button>
                                </td>
                             </tr>
                          ))
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
         <div className="flex items-center gap-3">
             <ClipboardCheck className="w-4 h-4 text-indigo-600" />
             <h1 className="font-black text-slate-900 tracking-widest uppercase">SHELF_AUDIT_LOGISTICS</h1>
         </div>
         
         <button 
           onClick={startNewSession}
           className="bg-indigo-600 text-white px-5 py-2.5 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/20 text-[10px] font-black tracking-widest uppercase"
         >
           <Plus className="w-4 h-4" /> START_NEW_AUDIT
         </button>
      </div>

      <div className="flex-1 p-6 overflow-auto custom-scrollbar">
         {/* Stats Bar */}
         {stats && (
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm border-l-4 border-l-indigo-600">
                 <div className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">SESSIONS_TOTAL</div>
                 <div className="text-2xl font-black text-slate-900 italic tracking-tighter">{currency.symbol}{stats.summary.total_sessions}</div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm border-l-4 border-l-red-500">
                 <div className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">LOSS_VALUATION_CUMULATIVE</div>
                 <div className="text-2xl font-black text-red-500 italic tracking-tighter">{currency.symbol}{Math.abs(stats.summary.total_loss || 0).toFixed(2)}</div>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm border-l-4 border-l-emerald-500">
                 <div className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">GAIN_VALUATION_CUMULATIVE</div>
                 <div className="text-2xl font-black text-emerald-500 italic tracking-tighter">{currency.symbol}{(stats.summary.total_gain || 0).toFixed(2)}</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-xl shadow-2xl border border-white/5">
                 <div className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">NET_VARIANCE_INDEX</div>
                 <div className={`text-2xl font-black italic tracking-tighter ${stats.summary.net_variance >= 0 ? 'text-indigo-400' : 'text-orange-400'}`}>
                    {currency.symbol}{stats.summary.net_variance?.toFixed(2) || '0.00'}
                 </div>
              </div>
           </div>
         )}
         
         <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Session History */}
            <div className="xl:col-span-2 space-y-4">
               <div className="flex items-center gap-2 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">SESSION_CHRONOLOGY</h3>
               </div>
               
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                     <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                           <th className="px-6 py-4">LOG_REF</th>
                           <th className="px-6 py-4">AUDIT_TIMESTAMP</th>
                           <th className="px-6 py-4">INSPECTOR</th>
                           <th className="px-6 py-4 text-center">STATUS</th>
                           <th className="px-6 py-4 text-right">VARIANCE</th>
                           <th className="px-6 py-4"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                        {loading && sessions.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="py-20 text-center animate-pulse tracking-[0.5em] text-indigo-600 font-black">ESTABLISHING_DB_LINK...</td>
                           </tr>
                        ) : sessions.length === 0 ? (
                           <tr>
                              <td colSpan={6} className="py-20 text-center text-slate-400 font-black uppercase tracking-[0.5em]">NO_HISTORYFound_IN_REGISTRY</td>
                           </tr>
                        ) : sessions.map((s, i) => (
                           <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-6 py-4 font-black text-slate-900 italic tracking-tighter">
                                 #{s.id.toString().padStart(5, '0')}
                              </td>
                              <td className="px-6 py-4 text-[9px] font-bold text-slate-400">
                                 {new Date(s.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4">
                                 <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[8px] font-black text-indigo-600">
                                       {s.creator_name?.charAt(0)}
                                    </div>
                                    <span className="font-black text-slate-600 uppercase italic tracking-tighter">{s.creator_name}</span>
                                 </div>
                              </td>
                              <td className="px-6 py-4 text-center">
                                 <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
 s.status === 'COMPLETED' 
 ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
 : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
 }`}>
                                   {s.status}
                                 </span>
                              </td>
                              <td className={`px-6 py-4 text-right font-black italic ${s.total_difference < 0 ? 'text-red-500' : s.total_difference > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                 {s.status === 'COMPLETED' ? `${currency.symbol}${s.total_difference.toFixed(2)}` : '---'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button 
                                      onClick={() => openSession(s.id)}
                                      className="p-1.5 hover:bg-indigo-600 hover:text-white rounded transition-all text-slate-400"
                                      title="Open Session"
                                    >
                                       {s.status === 'DRAFT' ? <PackageSearch className="w-3.5 h-3.5" /> : <PackageOpen className="w-3.5 h-3.5" />}
                                    </button>
                                    <button 
                                     onClick={() => handleSessionDeleteClick(s.id)}
                                      disabled={deletingId === s.id}
                                      className="p-1.5 hover:bg-red-600 hover:text-white rounded transition-all text-slate-400 disabled:opacity-30"
                                      title="Delete Session"
                                    >
                                       <Trash2 className={`w-3.5 h-3.5 ${deletingId === s.id ? 'animate-pulse' : ''}`} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>

            {/* High Variance Items */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">HIGH_VARIANCE_ASSETS</h3>
               </div>
               <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-1">
                  {stats?.topVariance?.length > 0 ? (
                    stats.topVariance.map((item: any) => (
                      <div key={item.name} className="p-3 flex items-center justify-between border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-lg transition-colors">
                         <div>
                            <div className="font-black text-slate-900 uppercase text-[10px] italic">{item.name}</div>
                            <div className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">LIFETIME_LEV_DELTA</div>
                         </div>
                         <div className="text-right">
                            <div className="text-[12px] font-black text-red-500 italic">-{item.total_variance} UNIT</div>
                            <div className="text-[7px] text-slate-300 font-black tracking-widest">DISCREPANCY_VAL</div>
                         </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-[8px] font-black text-slate-400 uppercase tracking-widest italic">NO_DISCREPANCIES_REPORTED</div>
                  )}
                  <div className="p-3 mt-2">
                     <button className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded text-[8px] font-black text-slate-500 uppercase tracking-widest transition-all">VIEW_FULL_VARIANCE_INDEX</button>
                  </div>
               </div>
            </div>
         </div>
      </div>
      
      <ConfirmModal 
        isOpen={sessionToDelete !== null}
        onClose={() => {
          console.log('[AUDIT] Session deletion cancelled by user');
          setSessionToDelete(null);
        }}
        onConfirm={confirmDeleteSession}
        title="DELETE_AUDIT_SESSION"
        message={`ARE_YOU_ABSOLUTELY_SURE_TO_PURGE_SESSION_#${sessionToDelete}?_THIS_ACTION_CANNOT_BE_REVERSED.`}
      />

      <ConfirmModal 
        isOpen={itemToDelete !== null}
        onClose={() => {
          console.log('[AUDIT] Item deletion cancelled by user');
          setItemToDelete(null);
        }}
        onConfirm={confirmDeleteItem}
        title="PURGE_RECORD"
        message="REMOVING_THIS_ASSET_DISCREPANCY_RECORD_FROM_CURRENT_BUFFER._PROCEED?"
      />
    </div>
  );
}
