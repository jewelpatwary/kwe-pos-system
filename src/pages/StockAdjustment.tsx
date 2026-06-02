import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Search, Info, Trash2, Save, 
  CheckCircle2, AlertTriangle, History, 
  ArrowUpCircle, ArrowDownCircle, ScanBarcode, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const REASONS = ['Correction', 'Damage', 'Expiry', 'Theft', 'Internal Use', 'Gift', 'Return to Supplier'];

export default function StockAdjustment() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [adjustmentType, setAdjustmentType] = useState<'IN' | 'OUT'>('OUT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('System correction');
  const [note, setNote] = useState('');
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [inspectedSession, setInspectedSession] = useState<any>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AUDIT'>('MANUAL');
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedAuditItem, setSelectedAuditItem] = useState<any>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    fetchProducts();
    fetchAdjustments();
    fetchInventorySessions();
  }, []);

  const fetchInventorySessions = async () => {
    try {
      const res = await fetch('/api/admin/inventory/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSessionItems = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/inventory/sessions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSessionItems(data.data.items);
        setSelectedItemIds([]); // Reset selection on new session
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const res = await fetch('/api/stock-adjustments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAdjustments(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const handleProductSelect = (product: any) => {
    setSelectedProduct(product);
    setSearch('');
  };

  const filteredAdjustments = adjustments.filter(adj => {
    const matchesReason = !filterReason || adj.reason === filterReason;
    const matchesSearch = !filterSearch || 
      adj.product_name.toLowerCase().includes(filterSearch.toLowerCase()) ||
      adj.barcode?.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesReason && matchesSearch;
  });

  const toggleSelectAll = () => {
    const eligibleIds = sessionItems
      .filter(item => item.difference !== 0 && !adjustments.some(adj => adj.inventory_item_id === item.id))
      .map(i => i.id);

    if (selectedItemIds.length === eligibleIds.length && eligibleIds.length > 0) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(eligibleIds);
    }
  };

  const toggleItemSelection = (item: any) => {
    const isAlreadyAdjusted = adjustments.some(adj => adj.inventory_item_id === item.id);
    if (isAlreadyAdjusted) return; // Prevent selection of adjusted items

    setSelectedItemIds(prev => {
      if (prev.includes(item.id)) {
        return prev.filter(id => id !== item.id);
      } else {
        return [...prev, item.id];
      }
    });
    
    // Also set as the "active" preview item for single click
    setSelectedAuditItem(item);
    setSelectedProduct({ id: item.product_id, name: item.name, barcode: item.barcode, stock_quantity: item.system_stock });
    setQuantity(Math.abs(item.difference).toString());
    setAdjustmentType(item.difference > 0 ? 'IN' : 'OUT');
    setNote(`Auto-adjusted from Inventory Audit Session #${selectedSessionId}`);
    setReason('Correction');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (activeTab === 'MANUAL') {
      if (!selectedProduct) {
        setError('Please select a product first');
        return;
      }
      if (!quantity) {
        setError('Please enter a quantity');
        return;
      }
    } else {
      if (selectedItemIds.length > 0) {
        // Multi-select adjustment
        await handleBulkAdjustment();
        return;
      }
      if (!selectedAuditItem) {
        if (selectedSessionId && sessionItems.length > 0) {
          // If a session is selected but no item, handle bulk adjustment as per user intent
          handleAdjustEntireSession();
          return;
        }
        setError('Please select an audit session or item first');
        return;
      }
    }
    
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Invalid quantity amount');
      return;
    }

    if (adjustmentType === 'OUT' && qty > (selectedProduct?.stock_quantity || 0) && user?.role !== 'ADMIN') {
      setError('Oops! Only admins can authorize negative stock levels');
      return;
    }

    if (!confirm(`Confirm adjustment for ${selectedProduct.name}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload: any = {
          product_id: selectedProduct.id,
          adjustment_type: adjustmentType,
          quantity: qty,
          reason: reason,
          note: note
      };

      if (activeTab === 'AUDIT' && selectedAuditItem) {
          payload.inventory_item_id = selectedAuditItem.id;
      }

      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('Adjustment successfully applied');
        setSelectedProduct(null);
        setQuantity('');
        setNote('');
        if (activeTab === 'AUDIT' && selectedSessionId) {
          loadSessionItems(selectedSessionId);
          setSelectedAuditItem(null);
          setSelectedItemIds([]);
        }
        fetchProducts();
        fetchAdjustments();
      } else {
        setError(data.message || 'Failed to save the adjustment');
      }
    } catch (err) {
      setError('Connection to the server was lost. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdjustment = async () => {
    if (selectedItemIds.length === 0) return;

    const itemsToAdjust = sessionItems.filter(i => selectedItemIds.includes(i.id) && i.difference !== 0);
    
    if (itemsToAdjust.length === 0) {
        setSelectedItemIds([]);
        setError('No selected items have any differences to adjust');
        return;
    }

    setLoading(true);
    setNotification({ message: `Applying adjustments for ${itemsToAdjust.length} items...`, type: 'success' });
    let successCount = 0;
    
    for (const item of itemsToAdjust) {
      try {
        const payload = {
          product_id: item.product_id,
          adjustment_type: item.difference > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(item.difference),
          reason: 'Correction',
          note: `Auto-adjusted from Inventory Audit Session #${selectedSessionId}`,
          inventory_item_id: item.id
        };

        const res = await fetch('/api/stock-adjustments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          console.error(`Failed to adjust ${item.name}:`, data.message);
        }
      } catch (err: any) {
        console.error(`Network error for item ${item.name}:`, err);
      }
    }

    setNotification({ message: `Successfully adjusted ${successCount} items`, type: 'success' });
    setSelectedItemIds([]);
    setSelectedAuditItem(null);
    setSelectedProduct(null);
    fetchProducts();
    fetchAdjustments();
    loadSessionItems(selectedSessionId!);
    setLoading(false);
  };

  const handleAdjustEntireSession = async () => {
    if (!selectedSessionId || sessionItems.length === 0) {
      setError('Please select an active audit session first');
      return;
    }

    // Find items that have a difference, and haven't been adjusted already in our adjustments list
    const unadjustedItems = sessionItems.filter(item => {
      if (item.difference === 0) return false;
      const isAlreadyAdjusted = adjustments.some(adj => adj.inventory_item_id === item.id);
      return !isAlreadyAdjusted;
    });

    if (unadjustedItems.length === 0) {
      alert('No unadjusted items with stock differences found in this session.');
      return;
    }

    if (!confirm(`Are you sure you want to adjust all ${unadjustedItems.length} products to match their physical counts?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    let successCount = 0;
    let failCount = 0;

    for (const item of unadjustedItems) {
      try {
        const payload = {
          product_id: item.product_id,
          adjustment_type: item.difference > 0 ? 'IN' : 'OUT',
          quantity: Math.abs(item.difference),
          reason: 'Correction',
          note: `Auto-adjusted from Inventory Audit Session #${selectedSessionId}`,
          inventory_item_id: item.id
        };

        const res = await fetch('/api/stock-adjustments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
          console.error(`Failed to adjust ${item.name}:`, data.message);
        }
      } catch (err) {
        failCount++;
        console.error(`Network error for item ${item.name}:`, err);
      }
    }

    if (successCount > 0) {
      setSuccess(`Adjusted ${successCount} items. Failed: ${failCount}`);
    } else {
      setError(`Failed to adjust ${failCount} items.`);
    }

    fetchProducts();
    fetchAdjustments();
    // reload session items to reflect updated states or simply reload
    loadSessionItems(selectedSessionId);
    setLoading(false);
  };

  if (inspectedSession) {
    return (
      <div className="h-full flex flex-col bg-slate-50 text-[10px] uppercase font-sans relative">
        {/* Toast Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ring-1 border ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 ring-emerald-500/20 text-emerald-900' 
              : 'bg-red-50 border-red-200 ring-red-500/20 text-red-900'
          }`}>
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <span className="font-black tracking-widest text-[9px]">{notification.message.toUpperCase()}</span>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Inspection Header */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setInspectedSession(null);
                setSelectedSessionId(null);
                setSessionItems([]);
              }}
              className="px-3 py-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors uppercase font-black text-[9px] flex items-center gap-1 border border-slate-200"
            >
              CLOSE
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-slate-950 font-black tracking-widest text-[12px]">INSPECTING_AUDIT_SESSION_#{inspectedSession.id}</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                  inspectedSession.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}>
                  {inspectedSession.status}
                </span>
              </div>
              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                Started: {new Date(inspectedSession.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAdjustEntireSession}
              disabled={loading || sessionItems.length === 0}
              className="px-4 py-2 bg-indigo-600 text-white rounded text-[8px] font-black tracking-widest hover:bg-indigo-700 transition disabled:opacity-30"
            >
              Adjust All Remaining Discrepancies
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full max-w-7xl mx-auto">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <span className="font-black text-slate-500 uppercase tracking-widest text-[9px]">Session Items & Discrepancies</span>
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{sessionItems.length} items counted</span>
            </div>
            
            <div className="overflow-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                  <tr className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-50">
                    <th className="px-6 py-4">Product Name & Barcode</th>
                    <th className="px-6 py-4 text-center">System Stock</th>
                    <th className="px-6 py-4 text-center">Physical Count</th>
                    <th className="px-6 py-4 text-center">Variance</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionItems.map((item) => {
                    const isAdjusted = adjustments.some(adj => adj.inventory_item_id === item.id);
                    const hasDiff = item.difference !== 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900 uppercase text-[10px]">{item.name || 'Unknown Product'}</div>
                          <div className="text-[7.5px] text-slate-400 font-bold font-mono tracking-[0.1em] mt-0.5">[{item.barcode || 'NO_BARCODE'}]</div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-500">{item.system_stock}</td>
                        <td className="px-6 py-4 text-center font-bold text-slate-900">{item.physical_stock}</td>
                        <td className="px-6 py-4 text-center">
                          {hasDiff ? (
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black italic ${
                              item.difference > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'
                            }`}>
                              {item.difference > 0 ? '+' : ''}{item.difference}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[8px] font-black text-slate-400 bg-slate-100">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {isAdjusted ? (
                            <span className="px-2 py-0.5 rounded text-[7.5px] font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-widest">ADJUSTED</span>
                          ) : !hasDiff ? (
                            <span className="px-2 py-0.5 rounded text-[7.5px] font-black bg-slate-100 text-slate-400 uppercase tracking-widest">MATCHED</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[7.5px] font-black bg-orange-500/10 text-orange-600 border border-orange-500/20 uppercase tracking-widest">PENDING</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {hasDiff && !isAdjusted && (
                            <button
                              onClick={async () => {
                                if (loading) return;
                                if (!confirm(`Confirm adjustment of ${item.name} to match its counted stock quantity of ${item.physical_stock}?`)) return;
                                
                                setLoading(true);
                                try {
                                  const payload = {
                                    product_id: item.product_id,
                                    adjustment_type: item.difference > 0 ? 'IN' : 'OUT',
                                    quantity: Math.abs(item.difference),
                                    reason: 'Correction',
                                    note: `Auto-adjusted from Inventory Audit Session #${inspectedSession.id}`,
                                    inventory_item_id: item.id
                                  };

                                  const res = await fetch('/api/stock-adjustments', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify(payload)
                                  });

                                  const data = await res.json();
                                  if (data.success) {
                                    setNotification({ message: `Adjusted stock for ${item.name}`, type: 'success' });
                                    fetchProducts();
                                    fetchAdjustments();
                                    loadSessionItems(inspectedSession.id);
                                  } else {
                                    setNotification({ message: data.message || 'Failed to adjust stock', type: 'error' });
                                  }
                                } catch (err) {
                                  setNotification({ message: 'Error updating stock levels', type: 'error' });
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded text-[8px] font-black transition-all"
                            >
                              ADJUST
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sessionItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-20 text-center font-black text-slate-400 tracking-[0.5em] uppercase">No items found in this session</td>
                    </tr>
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
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300 relative">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-2xl flex items-center gap-3 animate-in slide-in-from-right ring-1 border ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 ring-emerald-500/20 text-emerald-900' 
            : 'bg-red-50 border-red-200 ring-red-500/20 text-red-900'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          )}
          <span className="font-black tracking-widest text-[9px]">{notification.message.toUpperCase()}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
            <ClipboardList className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-900 font-black tracking-widest italic text-[11px]">STOCK ADJUSTMENTS</span>
        </div>
        
        <div className="flex-1"></div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Form Area */}
        <div className="w-80 shrink-0 border-r border-slate-200 bg-white overflow-auto p-4 space-y-6">
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex bg-slate-100 p-1 rounded">
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveTab('MANUAL');
                    setSelectedProduct(null);
                    setQuantity('');
                    setSelectedAuditItem(null);
                    setSelectedSessionId(null);
                    setSearch('');
                    setSuccess('');
                    setError('');
                  }} 
                  className={`flex-1 py-2 rounded text-[8px] font-black tracking-widest ${activeTab === 'MANUAL' ? 'bg-white shadow-sm' : ''}`}
                >
                  MANUAL ADJUST
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setActiveTab('AUDIT');
                    setSelectedProduct(null);
                    setQuantity('');
                    setSelectedAuditItem(null);
                    setSelectedSessionId(null);
                    setSearch('');
                    setSuccess('');
                    setError('');
                    fetchInventorySessions(); // Re-fetch when switching
                  }} 
                  className={`flex-1 py-2 rounded text-[8px] font-black tracking-widest ${activeTab === 'AUDIT' ? 'bg-white shadow-sm transition-all border border-indigo-200 text-indigo-600' : 'text-slate-400'}`}
                >
                  FROM AUDIT
                </button>
              </div>

              {activeTab === 'AUDIT' && (
                <div className="space-y-4 animate-in fade-in">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-black tracking-widest text-[8px]">Audit Session</label>
                    <select 
                      className="w-full bg-slate-100 border border-slate-200 rounded p-2 text-[9px] font-black focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800"
                      value={selectedSessionId || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const sessId = parseInt(val);
                          setSelectedSessionId(sessId);
                          loadSessionItems(sessId);
                        } else {
                          setSelectedSessionId(null);
                          setSessionItems([]);
                          setSelectedAuditItem(null);
                        }
                      }}
                    >
                      <option value="">Select Audit Session</option>
                      {sessions.map(s => {
                        const formattedDate = new Date(s.created_at || s.date).toLocaleDateString();
                        return (
                          <option key={s.id} value={s.id}>
                            #{s.id.toString().padStart(5, '0')} — {formattedDate} ({s.status}) — VAR: {s.total_difference || 0}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedSessionId && (
                    <div className="space-y-4">
                      {/* Display active list below the select dropdown for clean, beautiful UX */}
                      <div className="space-y-2">
                        <div className="text-slate-500 font-black tracking-widest text-[8px] flex justify-between items-center">
                          <span>Audited Items List</span>
                          <button 
                            type="button"
                            onClick={toggleSelectAll}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100"
                          >
                            {selectedItemIds.length === sessionItems.length ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-auto border border-slate-100 rounded p-1.5 bg-slate-50 custom-scrollbar">
                          {sessionItems.map(item => {
                            const isAdjusted = adjustments.some(adj => adj.inventory_item_id === item.id);
                            const isSelected = selectedItemIds.includes(item.id);
                            const hasDiff = item.difference !== 0;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleItemSelection(item)}
                                disabled={isAdjusted}
                                className={`w-full text-left p-2 rounded transition-all flex justify-between items-center border ${
                                  isAdjusted 
                                    ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' 
                                    : isSelected 
                                      ? 'bg-indigo-50 border-indigo-400 shadow-sm' 
                                      : 'bg-white border-slate-100 hover:border-slate-300'
                                }`}
                              >
                                <div className="space-y-0.5 flex-1">
                                  <div className="font-black text-slate-800 italic text-[9px]">{item.name || 'Unknown Product'}</div>
                                  <div className="text-[7px] text-slate-400 font-semibold font-mono">[{item.barcode || 'NO_BARCODE'}]</div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {isAdjusted ? (
                                    <span className="text-[7px] text-slate-400 font-black tracking-wider uppercase bg-slate-100 px-1 py-0.5 rounded">ADJUSTED</span>
                                  ) : !hasDiff ? (
                                    <span className="text-[7px] text-slate-400 font-black tracking-wider bg-slate-100 px-1 py-0.5 rounded">MATCHED</span>
                                  ) : (
                                    <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                      item.difference > 0 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                        : 'bg-orange-50 text-orange-600 border-orange-200'
                                    }`}>
                                      {item.difference > 0 ? '+' : ''}{item.difference}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'MANUAL' && (
                <div className="space-y-2">
                   <label className="text-slate-500 font-black tracking-widest text-[8px]">Search Product</label>
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                      <input 
                          type="text" 
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search by product name or barcode..."
                          className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                   </div>
                   {search && filteredProducts.length > 0 && (
                    <div className="mt-1 bg-white border border-slate-200 rounded shadow-sm max-h-40 overflow-auto z-50">
                      {filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleProductSelect(p)}
                          className="w-full p-2 text-left hover:bg-indigo-50 border-b border-slate-100 last:border-0"
                        >
                          <div className="font-black text-slate-800 italic">{p.name}</div>
                          <div className="text-[7px] text-slate-500 font-bold font-mono">[{p.barcode || 'No Barcode'}]</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'MANUAL' && selectedProduct && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded animate-in fade-in zoom-in-95">
                   <div className="flex justify-between items-start mb-2">
                       <span className="text-indigo-600 font-black italic">{selectedProduct.barcode}</span>
                       <span className="text-slate-900 font-black">{selectedProduct.stock_quantity} <span className="text-slate-500 text-[8px]">{selectedProduct.unit_name}</span></span>
                   </div>
                   <div className="text-slate-900 font-black italic tracking-widest truncate">{selectedProduct.name}</div>
                </div>
              )}

              {activeTab === 'AUDIT' && (selectedProduct || selectedItemIds.length > 0) && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded animate-in fade-in zoom-in-95 space-y-2">
                   <div className="text-[7px] text-indigo-500 font-black tracking-widest uppercase">
                     {selectedItemIds.length > 1 ? 'Bulk Adjustment Preview' : 'Proposed Adjustment Preview'}
                   </div>
                   {selectedItemIds.length > 1 ? (
                     <div className="text-indigo-600 font-black italic text-[9px]">
                       {selectedItemIds.length} items selected for batch update
                     </div>
                   ) : (
                     <div className="text-slate-900 font-black italic tracking-widest truncate">{selectedProduct?.name}</div>
                   )}
                   
                   {selectedItemIds.length <= 1 && (
                     <div className="flex justify-between items-center text-[8.5px] font-black mt-1">
                       <span className="text-slate-500">Adjustment:</span>
                       <span className={`px-1.5 py-0.5 rounded ${adjustmentType === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'}`}>
                         {adjustmentType === 'IN' ? '+' : '-'}{quantity} UNITS
                       </span>
                     </div>
                   )}
                   {selectedItemIds.length <= 1 && (
                     <div className="text-[7px] text-slate-400 font-bold font-mono">BARCODE: {selectedProduct?.barcode || 'NO_BARCODE'}</div>
                   )}
                </div>
              )}

              {activeTab === 'MANUAL' && (
                <div className="space-y-4">
                   <label className="text-slate-500 font-black tracking-widest text-[8px]">Adjustment Type</label>
                   <div className="grid grid-cols-2 gap-2">
                       <button 
                          type="button" 
                          onClick={() => setAdjustmentType('IN')}
                          className={`py-2 rounded font-black transition-all border ${adjustmentType === 'IN' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'}`}
                      >
                          [+] IN
                      </button>
                      <button 
                          type="button" 
                          onClick={() => setAdjustmentType('OUT')}
                          className={`py-2 rounded font-black transition-all border ${adjustmentType === 'OUT' ? 'bg-orange-600 border-orange-500 text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'}`}
                      >
                          [-] OUT
                      </button>
                   </div>
                </div>
              )}

              <div className="space-y-4">
                 {activeTab === 'MANUAL' && (
                    <div className="space-y-1">
                       <label className="text-slate-500 font-black tracking-widest text-[8px]">Quantity</label>
                       <input 
                           type="number" step="any" required
                           value={quantity}
                           onChange={(e) => setQuantity(e.target.value)}
                           placeholder="0.00"
                           className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-[12px] font-black rounded px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                       />
                    </div>
                 )}
                 <div className="space-y-1">
                    <label className="text-slate-500 font-black tracking-widest text-[8px]">Reason</label>
                    <select 
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                        {REASONS.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                    </select>
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-slate-500 font-black tracking-widest text-[8px]">Notes / Remarks</label>
                 <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                 />
              </div>

              {error && <div className="text-red-500 font-black text-[8px] animate-pulse">Error: {error}</div>}
              {success && <div className="text-emerald-500 font-black text-[8px] animate-bounce">Success: {success}</div>}

              <button 
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-widest rounded transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
              >
                {loading ? 'Saving Adjustment...' : 'Save Adjustment'}
              </button>
           </form>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto border-x border-slate-200">
           {showHistory ? (
             <div className="flex flex-col h-full bg-slate-50/50">
                <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-indigo-600" />
                      <span className="font-black tracking-widest">SESSION_CHRONOLOGY</span>
                   </div>
                   <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{sessions.length} SESSIONS_RECORDED</span>
                </div>
                <table className="w-full text-left border-collapse bg-white">
                  <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                     <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md">
                        <th className="py-4 px-6 font-black border-r border-slate-200/50">LOG_REF</th>
                        <th className="py-4 px-6 font-black border-r border-slate-200/50">TIMESTAMP</th>
                        <th className="py-4 px-6 font-black border-r border-slate-200/50 text-center">STATUS</th>
                        <th className="py-4 px-6 font-black text-right">ACTIONS</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {sessions.map((s) => (
                        <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${selectedSessionId === s.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''}`}>
                           <td className="py-4 px-6 border-r border-slate-200/50 font-black italic">#{s.id.toString().padStart(5, '0')}</td>
                           <td className="py-4 px-6 border-r border-slate-200/50">
                              <div className="text-slate-900 font-black italic">{new Date(s.created_at).toLocaleDateString()}</div>
                              <div className="text-[7px] text-slate-500 font-bold">{new Date(s.created_at).toLocaleTimeString()}</div>
                           </td>
                           <td className="py-4 px-6 border-r border-slate-200/50 text-center">
                              <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                                s.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}>
                                {s.status}
                              </span>
                           </td>
                           <td className="py-4 px-6 text-right">
                              <button 
                                 onClick={() => {
                                    setActiveTab('AUDIT');
                                    setSelectedSessionId(s.id);
                                    loadSessionItems(s.id);
                                    setInspectedSession(s);
                                 }}
                                 className="px-3 py-1 bg-indigo-600 text-white font-black text-[8px] rounded hover:bg-indigo-700 transition"
                              >
                                INSPECT_SESSION
                              </button>
                           </td>
                        </tr>
                     ))}
                     {sessions.length === 0 && (
                        <tr>
                           <td colSpan={4} className="py-20 text-center font-black text-slate-400 tracking-[0.5em]">No audit sessions found</td>
                        </tr>
                     )}
                  </tbody>
                </table>
             </div>
           ) : (
            <table className="w-full text-left border-collapse">
               <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                  <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md">
                     <th className="py-4 px-6 font-black border-r border-slate-200/50">Date & Time</th>
                     <th className="py-4 px-6 font-black border-r border-slate-200/50">Product Name</th>
                     <th className="py-4 px-6 font-black border-r border-slate-200/50">Adjustment Info</th>
                     <th className="py-4 px-6 font-black border-r border-slate-200/50 text-center">Stock Change</th>
                     <th className="py-4 px-6 font-black">Operator</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {filteredAdjustments.map((sa) => (
                     <tr key={sa.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-6 border-r border-slate-200/50">
                           <div className="text-slate-900 font-black italic">{new Date(sa.created_at).toLocaleDateString()}</div>
                           <div className="text-[7px] text-slate-500 font-bold">{new Date(sa.created_at).toLocaleTimeString()}</div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200/50">
                           <div className="text-slate-900 font-black italic truncate max-w-[150px]">{sa.product_name}</div>
                           <div className="text-[7px] text-indigo-500 font-bold tracking-widest">({sa.reason.toUpperCase()})</div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200/50">
                           <div className={`font-black italic ${sa.adjustment_type === 'IN' ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {sa.adjustment_type === 'IN' ? '+' : '-'}{sa.quantity} UNITS
                           </div>
                           <div className="text-[7px] text-slate-500 italic truncate max-w-[150px]">{sa.note || 'NULL_COMMENT'}</div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-200/50 text-center">
                           <div className="flex items-center justify-center gap-2">
                              <span className="text-slate-500 font-bold">{sa.previous_stock}</span>
                              <span className="text-slate-400">{'>>'}</span>
                              <span className="text-indigo-600 font-black">{sa.new_stock}</span>
                           </div>
                        </td>
                        <td className="py-4 px-6 font-black italic text-slate-600">
                           @ {sa.created_by_name?.toUpperCase().replace(' ', '_')}
                        </td>
                     </tr>
                  ))}
                  {filteredAdjustments.length === 0 && (
                     <tr>
                        <td colSpan={5} className="py-20 text-center font-black text-slate-400 tracking-[0.5em]">No adjustment logs found</td>
                     </tr>
                  )}
               </tbody>
            </table>
           )}
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-slate-500">
         <div>Adjustments Log • {adjustments.length} logs recorded</div>
         <div>Current Time : {new Date().toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
