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
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchAdjustments();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !quantity || !reason) {
       setError('FILL_ALL_REQUIRED_FIELDS');
       return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('INV_QUANTITY');
      return;
    }

    if (adjustmentType === 'OUT' && qty > selectedProduct.stock_quantity && user?.role !== 'ADMIN') {
      setError('INSUFFICIENT_OVERRIDE_AUTH');
      return;
    }

    if (!confirm(`CONFIRM_ADJUSTMENT: ${selectedProduct.name}?`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/stock-adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          adjustment_type: adjustmentType,
          quantity: qty,
          reason: reason,
          note: note
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('REGISTRY_PATCH_SUCCESS');
        setSelectedProduct(null);
        setQuantity('');
        setNote('');
        fetchProducts();
        fetchAdjustments();
      } else {
        setError(data.message || 'REGISTRY_WRITE_FAILED');
      }
    } catch (err) {
      setError('NETWORK_SIGNAL_LOST');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
            <ClipboardList className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-900 font-black tracking-widest italic">STOCK_CORRECTION_ENGINE</span>
        </div>
        
        <div className="flex-1"></div>
        
        <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`px-3 py-1.5 rounded transition-all flex items-center gap-2 font-black border ${
 showHistory ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
 }`}
        >
            <History className="w-3.5 h-3.5" /> {showHistory ? 'TERMINATE_AUDIT_VIEW' : 'INIT_AUDIT_LOGS'}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Form Area */}
        <div className="w-80 shrink-0 border-r border-slate-200 bg-white overflow-auto p-4 space-y-6">
           <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-slate-500 font-black tracking-widest text-[8px]">ENTITY_QUERY</label>
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input 
                        type="text" 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="SEARCH_BY_NAME_OR_SCAN..."
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
                        <div className="text-[7px] text-slate-500 font-bold font-mono">[{p.barcode || 'NULL_BARCODE'}]</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded animate-in fade-in zoom-in-95">
                   <div className="flex justify-between items-start mb-2">
                       <span className="text-indigo-600 font-black italic">{selectedProduct.barcode}</span>
                       <span className="text-slate-900 font-black">{selectedProduct.stock_quantity} <span className="text-slate-500 text-[8px]">{selectedProduct.unit_name}</span></span>
                   </div>
                   <div className="text-slate-900 font-black italic tracking-widest truncate">{selectedProduct.name}</div>
                </div>
              )}

              <div className="space-y-4">
                 <label className="text-slate-500 font-black tracking-widest text-[8px]">OP_VECTOR</label>
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

              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-slate-500 font-black tracking-widest text-[8px]">QUANTITY_VEC</label>
                    <input 
                        type="number" step="any" required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-100 border border-slate-200 text-slate-900 text-[12px] font-black rounded px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-slate-500 font-black tracking-widest text-[8px]">REASON_CODE</label>
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
                 <label className="text-slate-500 font-black tracking-widest text-[8px]">NOTATION_FIELD</label>
                 <textarea 
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                 />
              </div>

              {error && <div className="text-red-500 font-black text-[8px] animate-pulse">ERROR_SIGNAL: {error}</div>}
              {success && <div className="text-emerald-500 font-black text-[8px] animate-bounce">TRANS_COMPLETE: {success}</div>}

              <button 
                type="submit"
                disabled={loading || !selectedProduct}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-widest rounded transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
              >
                {loading ? 'EXECUTING_ADJUSTMENT...' : 'SAVE_ADJUSTMENT'}
              </button>
           </form>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-auto border-x border-slate-200">
           <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                 <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md">
                    <th className="py-4 px-6 font-black border-r border-slate-200/50">Timestamp_Pnt</th>
                    <th className="py-4 px-6 font-black border-r border-slate-200/50">Descriptor</th>
                    <th className="py-4 px-6 font-black border-r border-slate-200/50">Adjustment_Vec</th>
                    <th className="py-4 px-6 font-black border-r border-slate-200/50 text-center">Sync_Result</th>
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
                       <td colSpan={5} className="py-20 text-center font-black text-slate-400 tracking-[0.5em]">NULL_ADJUSTMENT_LOGS</td>
                    </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-slate-500">
         <div>AUDIT_CAPACITY • {adjustments.length} LOGS_REGISTERED • SECTOR_07</div>
         <div>SYSTEM_TIME_SYNC : {new Date().toISOString()}</div>
      </div>
    </div>
  );
}
