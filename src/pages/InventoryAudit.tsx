import React, { useState, useEffect, useRef } from 'react';
import { 
  ClipboardCheck, Search, Plus, Trash2, Save, 
  ArrowLeft, CheckCircle2, AlertCircle, RefreshCcw,
  BarChart3, History, PackageSearch, PackageOpen,
  ArrowRightLeft, AlertTriangle, Check, Edit2, X,
  FileText, FileSpreadsheet
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [physicalCount, setPhysicalCount] = useState<string>('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingPhysicalCount, setEditingPhysicalCount] = useState<string>('');
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
    console.log("[AUDIT] deleteSession called for ID:", id);
    if (!id) return;
    try {
      setDeletingId(id);
      const res = await fetch(`/api/admin/inventory/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const resData = await res.json();
      console.log("[AUDIT] Delete session response:", resData);
      
      if (res.ok && resData.success) {
        fetchSessions();
        fetchStats();
      } else {
        alert(resData.message || 'Error deleting session');
      }
    } catch (err) {
      console.error("[AUDIT] Delete session network error:", err);
      alert('An error occurred during deletion.');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteItemFromSession = async (itemId: number) => {
    console.log("[AUDIT] deleteItemFromSession called for Item ID:", itemId);
    if (!activeSession || !itemId) {
      console.error("[AUDIT] Missing activeSession or itemId");
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const resData = await res.json();
      console.log("[AUDIT] Delete item response:", resData);

      if (res.ok && resData.success) {
        // Refresh session items directly
        const sessionRes = await fetch(`/api/admin/inventory/sessions/${activeSession.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const sessionData = await sessionRes.json();
        if (sessionData.success) {
          setSessionItems(sessionData.data.items || []);
        }
      } else {
        alert(`Error deleting item: ${resData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("[AUDIT] deleteItemFromSession network error:", err);
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
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        openSession(data.id);
      } else {
        alert(data.message || 'FAILED_TO_START_AUDIT');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('AUDIT_SERVICE_OFFLINE');
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

  const addOrUpdateItem = async (isInline: boolean = false) => {
    const prodId = isInline ? sessionItems.find(i => i.id === editingItemId)?.product_id : selectedProduct?.id;
    const count = isInline ? editingPhysicalCount : physicalCount;
    
    if (!prodId || count === '' || !activeSession) return;
    
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${activeSession.id}/items`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product_id: prodId,
          physical_stock: parseFloat(count)
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
        
        if (isInline) {
          setEditingItemId(null);
          setEditingPhysicalCount('');
        } else {
          setSelectedProduct(null);
          setPhysicalCount('');
        }
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

  const exportToPDF = () => {
    if (!activeSession || sessionItems.length === 0) return;
    
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Inventory Audit Session #${activeSession.id}`, 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date(activeSession.created_at).toLocaleString()}`, 14, 30);
    doc.text(`Inspector: ${activeSession.creator_name}`, 14, 37);
    
    const tableData = sessionItems.map(item => [
      item.name,
      item.barcode,
      item.system_stock.toString(),
      item.physical_stock.toString(),
      item.difference.toString(),
      `${currency.symbol}${item.value_difference.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Product', 'Barcode', 'System Stock', 'Physical Count', 'Variance', 'Value Diff']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
    });

    doc.save(`Audit_Session_${activeSession.id}.pdf`);
  };

  const exportToExcel = () => {
    if (!activeSession || sessionItems.length === 0) return;

    const data = sessionItems.map(item => ({
      'Product': item.name,
      'Barcode': item.barcode,
      'System Stock': item.system_stock,
      'Physical Count': item.physical_stock,
      'Variance': item.difference,
      'Value Difference': item.value_difference
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Items");
    XLSX.writeFile(wb, `Audit_Session_${activeSession.id}.xlsx`);
  };

  if (view === 'editor' && activeSession) {
    return (
      <>
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
                <div className="flex items-center gap-1 mr-4 border-r border-slate-200 pr-4">
                  <button 
                    onClick={exportToPDF}
                    disabled={sessionItems.length === 0}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                    title="EXPORT_PDF"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={exportToExcel}
                    disabled={sessionItems.length === 0}
                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                    title="EXPORT_EXCEL"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                  </button>
                </div>

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
             {/* Main Area: Item List */}
             <div className="flex-1 p-6 overflow-auto">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full border-t-2 border-t-indigo-500">
                   <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 gap-4 flex-wrap">
                    <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                        <div className="relative flex-1">
                           <PackageSearch className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-indigo-500" />
                           <input 
                             type="text"
                             placeholder="SCAN_BARCODE_OR_SEARCH_PRODUCT_TO_ADD..."
                             className="w-full bg-white border border-indigo-200 rounded pl-9 py-2 text-[9px] font-black italic outline-none focus:ring-2 focus:ring-indigo-500/20"
                             value={searchQuery}
                             onChange={(e) => {
                                setSearchQuery(e.target.value);
                                searchProducts(e.target.value);
                             }}
                             onKeyDown={(e) => {
                                if (e.key === 'Enter' && searchResults.length === 1) {
                                   handleProductSelect(searchResults[0]);
                                }
                             }}
                           />
                           
                           {/* Search Results Dropdown */}
                           {searchResults.length > 0 && (
                             <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-xl z-[60] max-h-60 overflow-auto">
                               {searchResults.map(p => (
                                 <button 
                                   key={p.id}
                                   onClick={() => handleProductSelect(p)}
                                   className="w-full p-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between text-left"
                                 >
                                   <div>
                                      <div className="text-[9px] font-black text-slate-900 uppercase">{p.name}</div>
                                      <div className="text-[7px] text-slate-400 font-bold uppercase">{p.barcode}</div>
                                   </div>
                                   <div className="text-[9px] font-black text-indigo-600 italic">
                                      STK: {p.stock_quantity}
                                   </div>
                                 </button>
                               ))}
                             </div>
                           )}
                        </div>

                        <div className="relative w-48">
                           <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                           <input 
                             type="text"
                             placeholder="FILTER_TABLE..."
                             className="w-full bg-white border border-slate-200 rounded pl-9 py-2 text-[9px] font-black italic outline-none"
                             value={tableSearchQuery}
                             onChange={(e) => setTableSearchQuery(e.target.value)}
                           />
                        </div>
                    </div>
                    
                    {selectedProduct && (
                      <div className="flex items-center gap-2 bg-indigo-600 p-1 rounded shadow-lg animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="px-2">
                           <div className="text-[8px] font-black text-indigo-100 uppercase leading-none mb-1">EDITING_QTY:</div>
                           <div className="text-[9px] font-black text-white uppercase leading-none">{selectedProduct.name}</div>
                        </div>
                        <input 
                          type="number"
                          value={physicalCount}
                          onChange={(e) => setPhysicalCount(e.target.value)}
                          autoFocus
                          className="w-16 bg-white border-0 rounded px-2 py-1.5 text-[10px] font-black outline-none"
                        />
                        <button 
                           onClick={addOrUpdateItem}
                           className="bg-emerald-500 text-white px-3 py-1.5 rounded text-[9px] font-black hover:bg-emerald-600 transition-colors"
                        >
                           SAVE
                        </button>
                        <button 
                           onClick={() => {
                              setSelectedProduct(null);
                              setPhysicalCount('');
                           }} 
                           className="p-1.5 text-white/60 hover:text-white transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                 </div>
                   <table className="w-full text-left">
                      <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                         <tr className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                            <th className="px-6 py-3">ASSET_IDENTIFIER</th>
                            <th className="px-6 py-3 text-center">SYSTEM_STOCK</th>
                            <th className="px-6 py-3 text-center">PHYSICAL_COUNT</th>
                            <th className="px-6 py-3 text-center">VARIANCE</th>
                            <th className="px-6 py-3 text-right">VALUE_DIFF</th>
                            <th className="px-6 py-3 text-right">{activeSession.status !== 'COMPLETED' && 'ACTIONS'}</th>
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
                            sessionItems
                              .filter(i => i.name.toLowerCase().includes(tableSearchQuery.toLowerCase()) || i.barcode.includes(tableSearchQuery))
                              .map(item => (
                               <tr key={item.id} className={`${editingItemId === item.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'} transition-colors group`}>
                                  <td className="px-6 py-4">
                                     <div className="font-black text-slate-900 uppercase text-[10px] tracking-tight">{item.name}</div>
                                     <div className="text-[7px] text-slate-400 font-bold tracking-[0.2em] mt-0.5">{item.barcode}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center font-bold text-slate-500 italic">
                                     {item.system_stock}
                                  </td>
                                  <td className="px-6 py-4 text-center font-black text-indigo-600 italic">
                                     {editingItemId === item.id ? (
                                        <input 
                                          type="number"
                                          value={editingPhysicalCount}
                                          onChange={(e) => setEditingPhysicalCount(e.target.value)}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') addOrUpdateItem(true);
                                            if (e.key === 'Escape') setEditingItemId(null);
                                          }}
                                          className="w-20 bg-white border border-indigo-200 rounded px-2 py-1 text-[10px] font-black outline-none focus:ring-2 focus:ring-indigo-500/20 text-center mx-auto"
                                        />
                                     ) : (
                                        item.physical_stock
                                     )}
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
                                     {activeSession.status !== 'COMPLETED' && (
                                        <div className="flex items-center justify-end gap-3">
                                        {editingItemId === item.id ? (
                                           <>
                                              <button 
                                                onClick={() => addOrUpdateItem(true)}
                                                className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                                title="Save Changes"
                                              >
                                                <Check className="w-4 h-4" />
                                              </button>
                                              <button 
                                                onClick={() => setEditingItemId(null)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                title="Cancel"
                                              >
                                                <X className="w-4 h-4" />
                                              </button>
                                           </>
                                        ) : (
                                           <>
                                              <button 
                                                onClick={() => {
                                                   setEditingItemId(item.id);
                                                   setEditingPhysicalCount(item.physical_stock.toString());
                                                }}
                                                className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                title="Edit Item"
                                              >
                                                <Edit2 className="w-3.5 h-3.5" />
                                              </button>
                                              <button 
                                                onClick={() => handleItemDeleteClick(item.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                title="Delete Item"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                           </>
                                        )}
                                     </div>
                                    )}
                                  </td>
                               </tr>
                            ))
                         )}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                         <tr className="text-[8px] font-black text-slate-900 uppercase tracking-widest">
                           <td className="px-6 py-4">TOTAL</td>
                           <td className="px-6 py-4 text-center">{sessionItems.reduce((s, i) => s + i.system_stock, 0)}</td>
                           <td className="px-6 py-4 text-center">{sessionItems.reduce((s, i) => s + i.physical_stock, 0)}</td>
                           <td className="px-6 py-4 text-center">{sessionItems.reduce((s, i) => s + i.difference, 0)}</td>
                           <td className="px-6 py-4 text-right">{currency.symbol}{sessionItems.reduce((s, i) => s + i.value_difference, 0).toFixed(2)}</td>
                           <td></td>
                         </tr>
                      </tfoot>
                   </table>
                </div>
             </div>
          </div>
        </div>
        
        <ConfirmModal 
          isOpen={sessionToDelete !== null}
          onClose={() => setSessionToDelete(null)}
          onConfirm={confirmDeleteSession}
          title="DELETE_AUDIT_SESSION"
          message={`ARE_YOU_ABSOLUTELY_SURE_TO_PURGE_SESSION_#${sessionToDelete}?_THIS_ACTION_CANNOT_BE_REVERSED.`}
        />

        <ConfirmModal 
          isOpen={itemToDelete !== null}
          onClose={() => setItemToDelete(null)}
          onConfirm={confirmDeleteItem}
          title="PURGE_RECORD"
          message="REMOVING_THIS_ASSET_DISCREPANCY_RECORD_FROM_CURRENT_BUFFER._PROCEED?"
        />
      </>
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
                           <th className="px-6 py-4 text-right">ACTIONS</th>
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
                     <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr className="text-[8px] font-black text-slate-900 uppercase tracking-widest">
                          <td className="px-6 py-4">TOTAL_HISTORY</td>
                          <td className="px-6 py-4"></td>
                          <td className="px-6 py-4"></td>
                          <td className="px-6 py-4 text-center">---</td>
                          <td className="px-6 py-4 text-right">{currency.symbol}{sessions.reduce((s, row) => s + (row.status === 'COMPLETED' ? (row.total_difference || 0) : 0), 0).toFixed(2)}</td>
                          <td></td>
                        </tr>
                     </tfoot>
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
