import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Printer, Plus, Minus, Trash, Save, Undo2, X } from 'lucide-react';
import { Product } from '../store/cartStore';
import { useTheme } from '../components/ThemeProvider';

// Assuming new fields form DB, let's extend Product interface temporarily
interface DetailedProduct extends Product {
  purchase_price: number;
}

interface Supplier {
  id: number;
  name: string;
  contact: string;
  balance: number;
}

interface ReturnItem extends DetailedProduct {
  return_quantity: number;
  return_reason: string;
}

export default function SupplierReturns() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currency } = useTheme();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<DetailedProduct[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
  const [returnType, setReturnType] = useState('Damage Return');
  const [documentRef, setDocumentRef] = useState(id ? `RET-${id}` : `RET-${Date.now().toString().slice(-6)}`);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [recentReturnData, setRecentReturnData] = useState<any>(null); // For printing

  useEffect(() => {
    fetch('/api/suppliers')
      .then(res => res.json())
      .then(data => { if (data.success) setSuppliers(data.data); });
      
    fetch('/api/products')
      .then(res => res.json())
      .then(data => { if (data.success) setProducts(data.data); });

    if (id) {
        fetch(`/api/supplier-returns/${id}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              setSelectedSupplierId(data.data.supplier_id);
              setReturnType(data.data.return_type);
              setDocumentRef(`RET-${data.data.id}`);
              setReturnNotes(data.data.notes);
              setReturnItems(data.data.items.map((i: any) => ({
                ...products.find(p => p.id === i.product_id),
                ...i,
                id: i.product_id, // ensure correct id
                purchase_price: i.unit_cost,
                return_quantity: i.quantity,
                return_reason: i.reason
              })));
            }
          });
    }
  }, [id, products]);

  useEffect(() => {
    if (searchQuery.trim().length >= 3) {
      const exactMatch = products.find(p => 
        p.stock_quantity > 0 && 
        p.barcode === searchQuery.trim()
      );
      if (exactMatch) {
        addToReturnList(exactMatch);
        setSearchQuery('');
      }
    }
  }, [searchQuery, products]);

  const filteredProducts = products.filter(p => 
    p.stock_quantity > 0 &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery)))
  );

  const addToReturnList = (product: DetailedProduct) => {
    setReturnItems(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        if (existing.return_quantity >= product.stock_quantity) return prev; // Cannot return more than stock
        return prev.map(p => p.id === product.id ? { ...p, return_quantity: p.return_quantity + 1 } : p);
      }
      return [...prev, { ...product, return_quantity: 1, return_reason: '' }];
    });
  };

  const updateQuantity = (id: number, qty: number, maxQty: number) => {
    if (qty < 1) return;
    if (qty > maxQty) return;
    setReturnItems(prev => prev.map(p => p.id === id ? { ...p, return_quantity: qty } : p));
  };

  const updateReason = (id: number, reason: string) => {
    setReturnItems(prev => prev.map(p => p.id === id ? { ...p, return_reason: reason } : p));
  };

  const removeFromReturnList = (id: number) => {
    setReturnItems(prev => prev.filter(p => p.id !== id));
  };

  const totalReturnValue = returnItems.reduce((sum, item) => sum + (item.purchase_price * item.return_quantity), 0);

  const handleSubmit = async () => {
    const missingFields: string[] = [];
    if (!selectedSupplierId) missingFields.push("Target Vendor");
    if (returnItems.length === 0) missingFields.push("Return Products");
    
    // Check if reasons are filled
    if (returnItems.some(i => !i.return_reason.trim())) {
      missingFields.push("Return Reason for all items");
    }

    if (missingFields.length > 0) {
      alert(`Missing required information:\n- ${missingFields.join('\n- ')}`);
      return;
    }

    try {
      const payload = {
        supplier_id: selectedSupplierId,
        return_type: returnType,
        document_reference: documentRef,
        notes: returnNotes,
        total_amount: totalReturnValue,
        items: returnItems.map(item => ({
          product_id: item.id,
          quantity: item.return_quantity,
          unit_cost: item.purchase_price,
          total_cost: item.purchase_price * item.return_quantity,
          reason: item.return_reason
        }))
      };

      const res = await fetch(id ? `/api/supplier-returns/${id}` : '/api/supplier-returns', {
        method: id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        if (id) {
           navigate('/admin/return-history');
           return;
        }
        
        // Save data for slip printing before clearing
        setRecentReturnData({
          supplier: suppliers.find(s => s.id === Number(selectedSupplierId)),
          return_type: returnType,
          document_reference: documentRef,
          date: new Date().toLocaleDateString(),
          total_value: totalReturnValue,
          items: [...returnItems]
        });
        
        // Success state
        setIsSubmitSuccess(true);
        setReturnItems([]);
        setReturnNotes('');
        setDocumentRef(`RET-${Date.now().toString().slice(-6)}`);
        setReturnType('Damage Return');
        setSelectedSupplierId('');

        // Refresh stock
        fetch('/api/products')
          .then(res => res.json())
          .then(data => { if (data.success) setProducts(data.data); });

      } else {
        alert("Failed: " + data.message);
      }
    } catch (err) {
      alert("An error occurred");
    }
  };

  const handlePrintSlip = () => {
    setTimeout(() => window.print(), 100);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Find exact matches first
      const exactMatch = products.find(p => 
        p.stock_quantity > 0 && 
        ((p.barcode && p.barcode === searchQuery) || 
         p.name.toLowerCase() === searchQuery.toLowerCase() ||
         p.id.toString() === searchQuery)
      );

      const match = exactMatch || filteredProducts[0];
      
      if (match) {
        addToReturnList(match);
        setSearchQuery('');
      }
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .screen-only {
            display: none !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
          }
        }
      `}</style>
      
      {!isSubmitSuccess ? (
        <>
          {/* Sub-Header / Filters */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md transition-colors screen-only">
            <div className="flex items-center gap-3 text-slate-900 font-black tracking-widest px-2 italic uppercase">
                <Undo2 className="w-4 h-4 text-indigo-600" />
                PROCUREMENT_REVERSAL_CONVERT_v1.0
            </div>
            
            <div className="flex-1"></div>
            
            <button 
              onClick={() => navigate('/admin')}
              className="p-1.5 border border-slate-200 bg-white rounded text-slate-400 hover:text-slate-900 transition-all shadow-sm active:scale-95"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-auto screen-only bg-white transition-colors">
            {/* LEFT PANEL: PRODUCT SEARCH (REFINED) */}
            <div className="w-full flex flex-col bg-white transition-colors">
              <div className="p-4 border-b border-slate-200 bg-slate-50 transition-colors">
                <label className="text-[8px] text-slate-400 font-black tracking-widest italic uppercase mb-2 block">ASSET_IDENTIFICATION_SCAN</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="SCAN BARCODE / TYPE NAME & ENTER..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full bg-white border-2 border-indigo-600/20 text-slate-900 rounded pl-10 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500 text-xs font-black shadow-lg shadow-indigo-500/5 transition-all"
                  />
                  {/* Dropdown for search results */}
                  {searchQuery.length >= 1 && filteredProducts.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-indigo-600/20 rounded-b-xl shadow-xl z-50 max-h-60 overflow-y-auto mt-1 custom-scrollbar">
                      {filteredProducts.map(product => (
                        <button
                          key={product.id}
                          className="w-full text-left p-3 hover:bg-indigo-50 text-[10px] font-bold border-b border-slate-100"
                          onClick={() => {
                            addToReturnList(product);
                            setSearchQuery('');
                          }}
                        >
                          {product.name} ({product.barcode}) - Stock: {product.stock_quantity}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              

              <div className="mt-auto pt-8 text-center text-[7px] font-black text-slate-300 tracking-[0.4em] uppercase select-none">
                INTEGRATED_BUFFER_SYSTEM_OVR
              </div>
            </div>

            {/* RIGHT PANEL: TRANSACTION BUFFER */}
            <div className="flex-1 flex flex-col bg-white transition-colors">
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-4 transition-colors">
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] text-slate-400 font-black tracking-widest italic uppercase">TARGET_VENDOR</label>
                  <select 
                    value={selectedSupplierId}
                    onChange={e => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  >
                    <option value="">NULL_VENDOR_SELECT</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] text-slate-400 font-black tracking-widest italic uppercase">FAULT_CLASSIFCATION</label>
                  <select 
                    value={returnType}
                    onChange={e => setReturnType(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  >
                    <option value="Damage Return">DAMAGE_LOG_PHYSICAL</option>
                    <option value="Expiry Return">EXPIRY_TIMEOUT</option>
                    <option value="Supplier Mistake">VENDOR_DATA_ERR</option>
                  </select>
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[8px] text-slate-400 font-black tracking-widest italic uppercase">DOCUMENT_REF/ID</label>
                  <input 
                    type="text" 
                    placeholder="REFE_DOC_TRACE..." 
                    value={documentRef}
                    onChange={e => setDocumentRef(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar transition-colors">
                {returnItems.length === 0 ? (
                  <div className="py-20 text-center text-slate-300 flex flex-col items-center select-none grayscale opacity-60">
                    <Undo2 className="w-16 h-16 mb-4 opacity-10" />
                    <p className="font-black tracking-[0.4em] text-xl uppercase">BUFFER_EMPTY</p>
                    <p className="text-[8px] font-black italic mt-2 opacity-60 tracking-tighter uppercase">Select assets from registry to begin withdrawal</p>
                  </div>
                ) : (
                  returnItems.map(item => (
                    <div key={item.id} className="bg-white border border-slate-200 p-4 rounded group animate-in slide-in-from-right-4 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-black text-slate-900 italic tracking-tighter text-[11px] leading-tight uppercase underline underline-offset-4 decoration-indigo-500/30 decoration-2">{item.name}</div>
                          <div className="text-[7px] text-slate-400 font-bold tracking-widest mt-2 uppercase italic">AVAIL_NODE: {item.stock_quantity} • ACQ: {currency.symbol}{item.purchase_price.toFixed(2)}</div>
                        </div>
                        <button onClick={() => removeFromReturnList(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 active:scale-90">
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-12 gap-4 items-center bg-slate-50 p-3 border border-slate-200 rounded shadow-inner">
                        <div className="col-span-12 md:col-span-5 space-y-1">
                          <label className="text-[7px] text-slate-400 font-black tracking-widest uppercase italic">Reason</label>
                          <input 
                            type="text"
                            placeholder="Enter details..."
                            value={item.return_reason}
                            onChange={e => updateReason(item.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 uppercase shadow-sm"
                          />
                        </div>
                        <div className="col-span-6 md:col-span-4 space-y-1">
                          <label className="text-[7px] text-slate-400 font-black tracking-widest uppercase italic">Quantity</label>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => updateQuantity(item.id, item.return_quantity - 1, item.stock_quantity)}
                              className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-90"
                            ><Minus size={10} /></button>
                            <span className="w-10 text-center text-[11px] font-black text-indigo-600 italic font-mono transition-colors">{item.return_quantity}</span>
                            <button 
                              onClick={() => updateQuantity(item.id, item.return_quantity + 1, item.stock_quantity)}
                              className="w-6 h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-90"
                            ><Plus size={10} /></button>
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-3 text-right">
                          <label className="text-[7px] text-slate-400 font-black tracking-widest uppercase italic">TOTAL_VAL</label>
                          <div className="font-black text-slate-900 italic text-[11px] underline decoration-indigo-500 underline-offset-4 tracking-tighter transition-colors">{currency.symbol}{(item.purchase_price * item.return_quantity).toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                
                {returnItems.length > 0 && (
                  <div className="pt-4 border-t border-slate-200 transition-colors">
                     <label className="text-[8px] text-slate-400 font-black tracking-widest italic mb-2 block uppercase">TRANS_BUFFER_REMARKS</label>
                     <textarea 
                       rows={2} 
                       className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded p-3 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none italic shadow-inner uppercase tracking-widest transition-colors"
                       placeholder="Internal notes..."
                       value={returnNotes}
                       onChange={e => setReturnNotes(e.target.value)}
                     />
                  </div>
                )}
              </div>

              {/* ACTION_FOOTER */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center shadow-2xl transition-colors">
                <div>
                   <div className="text-[8px] text-slate-400 font-black tracking-[0.2em] uppercase italic">Total Refund Value</div>
                   <div className="text-3xl font-black text-slate-900 italic tracking-tighter transition-colors underline decoration-indigo-500 decoration-4 underline-offset-8 font-sans transition-all">{currency.symbol}{totalReturnValue.toFixed(2)}</div>
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={returnItems.length === 0}
                  className="bg-indigo-600 text-white px-10 py-4 rounded font-black tracking-[0.2em] hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center gap-3 shadow-xl shadow-indigo-500/20 uppercase"
                >
                  <Save className="w-5 h-5" /> Save Return to supplier
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 screen-only bg-white transition-colors">
          <div className="bg-slate-50 border border-slate-200 p-12 rounded-2xl shadow-2xl max-w-lg w-full text-center transition-colors">
            <div className="w-20 h-20 bg-emerald-50 border border-emerald-500/30 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/10">
              <Undo2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 italic tracking-tighter mb-3 uppercase transition-colors underline decoration-indigo-500 underline-offset-8 decoration-4">Return to supplier Successful</h2>
            <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-10 italic leading-relaxed">Stock registers updated. Debit memos logged to vendor accounts. Financial discrepancy resolved.</p>
            
            <div className="flex gap-4 justify-center">
              <button 
                onClick={handlePrintSlip}
                className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900 px-8 py-4 rounded font-black tracking-widest flex items-center gap-3 transition-all shadow-md active:scale-95 uppercase"
              >
                <Printer className="w-4 h-4" /> Print Receipt
              </button>
              <button 
                onClick={() => setIsSubmitSuccess(false)}
                className="bg-indigo-600 text-white hover:bg-indigo-700 px-8 py-4 rounded font-black tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 uppercase"
              >
                <Plus className="w-4 h-4" /> New Return
              </button>
            </div>
          </div>
        </div>
      )}



      {/* --- HIDDEN PRINT AREA --- */}
      {recentReturnData && (
        <div id="print-area" className="hidden print:block bg-white p-10 max-w-[80mm] mx-auto text-black font-sans text-sm leading-snug">
           <div className="text-center mb-8">
             <h1 className="font-black text-xl uppercase tracking-widest underline decoration-double decoration-indigo-500 decoration-4 underline-offset-8 italic transition-colors">Supplier Return Slip</h1>
             <div className="text-[10px] mt-4 font-black opacity-40 italic tracking-[0.3em] uppercase">INTERNAL_AUDIT_USE_ONLY</div>
           </div>
           
           <div className="mb-6 space-y-2 border-b-2 border-black pb-4">
             <div className="flex justify-between items-center"><span className="font-black underline uppercase italic">TARGET_VENDOR:</span> <span className="font-bold">{recentReturnData.supplier?.name.toUpperCase()}</span></div>
             <div className="flex justify-between items-center"><span className="font-black underline uppercase italic">DOCUMENT_REF:</span> <span className="font-bold">{recentReturnData.document_reference?.toUpperCase() || 'N/A'}</span></div>
             <div className="flex justify-between items-center"><span className="font-black underline uppercase italic">TIMESTAMP_PNT:</span> <span className="font-bold">{recentReturnData.date}</span></div>
           </div>

           <div className="border-b-4 border-black mb-4 pb-2 flex font-black uppercase text-[10px] italic tracking-widest">
             <div className="flex-1">Descriptor</div>
             <div className="w-10 text-center">Qty</div>
             <div className="w-14 text-right">Debit</div>
             <div className="w-16 text-right">Sum</div>
           </div>

           <div className="flex flex-col gap-4 mb-8">
               {recentReturnData.items.map((item: any, idx: number) => (
                 <div key={idx} className="text-xs">
                   <div className="flex items-start">
                     <div className="flex-1 pr-2 uppercase font-black italic tracking-tighter leading-none">{item.name}</div>
                     <div className="w-10 text-center font-bold">{item.return_quantity}</div>
                     <div className="w-14 text-right">{item.purchase_price.toFixed(2)}</div>
                     <div className="w-16 text-right font-black">{currency.symbol}{(item.purchase_price * item.return_quantity).toFixed(2)}</div>
                   </div>
                   {item.return_reason && (
                     <div className="text-[9px] italic mt-1 font-black uppercase opacity-60 ml-2">» FAULT_LOG: {item.return_reason.toUpperCase()}</div>
                   )}
                 </div>
               ))}
           </div>

           <div className="border-t-2 border-black pt-4 mb-8 space-y-2 text-xs font-black uppercase tracking-widest italic">
             <div className="flex justify-between items-baseline"><span className="underline decoration-indigo-500 decoration-2 underline-offset-2">FAULT_CLASS:</span> <span>{recentReturnData.return_type.toUpperCase()}</span></div>
             {recentReturnData.notes && <div className="flex flex-col gap-1 mt-2"><span className="underline decoration-indigo-500 decoration-2 underline-offset-2">REMARKS_LOG:</span> <span className="opacity-80 leading-relaxed">{recentReturnData.notes.toUpperCase()}</span></div>}
           </div>
           
           <div className="border-t-4 border-b-4 border-black py-4 mb-16 flex justify-between font-black text-lg italic tracking-tighter uppercase underline decoration-indigo-500 decoration-2 underline-offset-4 transition-all">
             <span>TOTAL_REVERSAL_VAL:</span>
             <span className="font-sans">{currency.symbol}{recentReturnData.total_value.toFixed(2)}</span>
           </div>
           
           <div className="mt-20 flex justify-between text-[10px] pt-4 italic font-black uppercase tracking-[0.3em]">
              <div className="border-t-2 border-black w-32 text-center pt-2">OPERATOR_SIG</div>
              <div className="border-t-2 border-black w-32 text-center pt-2">VENDOR_AUTH</div>
           </div>
           
           <div className="mt-12 text-center text-[8px] font-black italic opacity-30 tracking-widest uppercase">
             Generated by Tech Haven POS v1.0.0
           </div>
        </div>
      )}
    </div>
  );
}
