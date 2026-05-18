import React, { useState, useEffect } from 'react';
import { Search, X, Undo2, CreditCard, Banknote, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';

interface CustomerReturnModalProps {
  onClose: () => void;
}

interface ReturnCartItem {
  cart_id: string;
  sale_id: number;
  product_id: number;
  name: string;
  barcode: string;
  unit_price: number;
  qty: number;
  max_returnable: number;
}

export default function CustomerReturnModal({ onClose }: CustomerReturnModalProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const [returnCart, setReturnCart] = useState<ReturnCartItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'EXCHANGE'>('EXCHANGE');
  
  const { setReturnCredit } = useCartStore();
  const { token } = useAuthStore();
  const [isSuccess, setIsSuccess] = useState(false);
  const [recentReturnData, setRecentReturnData] = useState<any>(null);
  
  const [settings, setSettings] = useState({ validityDays: 3, allowCash: true });

  useEffect(() => {
    fetch('/api/settings/returns', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setSettings(data.data);
        if (!data.data.allowCash) setRefundMethod('EXCHANGE');
      }
    })
    .catch(err => console.error(err));
  }, [token]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    setSaleData(null);
    
    if (!invoiceId.trim()) return;

    try {
      const res = await fetch(`/api/sales/${invoiceId.trim()}`);
      const data = await res.json();
      
      if (data.success) {
        // Check validity
        const saleDate = new Date(data.data.created_at);
        const daysSinceSale = (new Date().getTime() - saleDate.getTime()) / (1000 * 3600 * 24);
        
        if (daysSinceSale > settings.validityDays) {
          setErrorStatus(`Return period expired. Valid only for ${settings.validityDays} days.`);
          return;
        }

        setSaleData(data.data);
      } else {
        setErrorStatus(data.message || 'Invoice not found');
      }
    } catch (err) {
      setErrorStatus('Error fetching invoice');
    }
  };

  const currentTotalRefund = returnCart.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);

  const addToReturnCart = (item: any) => {
    const maxReturnable = item.quantity - (item.returned_quantity || 0);
    if (maxReturnable <= 0) return;

    const cartId = `${saleData.id}_${item.product_id}`;
    
    setReturnCart(prev => {
      const existing = prev.find(i => i.cart_id === cartId);
      if (existing) {
        // already in cart, just increment if possible or do nothing
        if (existing.qty < maxReturnable) {
          return prev.map(i => i.cart_id === cartId ? { ...i, qty: i.qty + 1 } : i);
        }
        return prev;
      } else {
        return [...prev, {
          cart_id: cartId,
          sale_id: saleData.id,
          product_id: item.product_id,
          name: item.name,
          barcode: item.barcode,
          unit_price: item.unit_price,
          qty: 1,
          max_returnable: maxReturnable
        }];
      }
    });
  };

  const updateCartQty = (cartId: string, newQty: number) => {
    setReturnCart(prev => prev.map(item => {
      if (item.cart_id === cartId) {
        if (newQty < 1) return item; // minimum is 1 to keep in cart (or use trash icon to remove)
        if (newQty > item.max_returnable) return { ...item, qty: item.max_returnable };
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const removeCartItem = (cartId: string) => {
    setReturnCart(prev => prev.filter(item => item.cart_id !== cartId));
  };

  const handleConfirmReturn = async () => {
    if (returnCart.length === 0) return;

    const groupedBySale = returnCart.reduce((acc, item) => {
      if (!acc[item.sale_id]) acc[item.sale_id] = [];
      acc[item.sale_id].push(item);
      return acc;
    }, {} as Record<number, ReturnCartItem[]>);

    try {
      let totalProcessedRefund = 0;
      let allItemsReturned: any[] = [];

      for (const [saleId, items] of Object.entries(groupedBySale)) {
        const payload = {
          sale_id: Number(saleId),
          refund_type: refundMethod,
          items: (items as any[]).map(i => ({
            product_id: i.product_id,
            quantity: i.qty,
            refund_amount: i.unit_price,
            name: i.name
          }))
        };

        const res = await fetch('/api/sales-returns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
          totalProcessedRefund += data.total_refund;
          allItemsReturned = [...allItemsReturned, ...payload.items.map(i => ({...i}))];
        } else {
          alert(`Return failed for invoice ${saleId}: ` + data.message);
          return; // Stop processing if one fails
        }
      }

      setRecentReturnData({
        sale_ids: Object.keys(groupedBySale).join(', '),
        date: new Date().toLocaleString(),
        refund_type: refundMethod,
        total_refund: totalProcessedRefund,
        items: allItemsReturned
      });

      if (refundMethod === 'EXCHANGE') {
        setReturnCredit(totalProcessedRefund);
      }
      setIsSuccess(true);
    } catch (err) {
      alert("Error processing return");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print-hide" id="return-modal-overlay">
      <style>
        {`
          @media print {
            body * { visibility: hidden; }
            #return-receipt, #return-receipt * { visibility: visible; }
            #return-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
            #return-modal-overlay { background: none; backdrop-filter: none; }
            .modal-content { display: none; }
          }
        `}
      </style>
      
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl flex flex-col max-h-[95vh] modal-content border border-slate-200 text-slate-800">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-100">
          <h2 className="text-xl font-black flex items-center gap-2 uppercase tracking-widest text-slate-700">
            <Undo2 className="w-5 h-5 text-indigo-600" /> MULTI-INVOICE RETURN DESK
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-full transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-slate-50/50 text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
              <Undo2 className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-2 uppercase tracking-wider">RETURN COMPLETED</h2>
            <p className="text-slate-500 mb-8 max-w-md font-medium">
              Items successfully logged for return.
              {recentReturnData?.refund_type === 'CASH' && " Please disburse cash from drawer."}
              {recentReturnData?.refund_type === 'EXCHANGE' && " Exchange credit applied to terminal."}
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={handlePrint}
                className="px-8 py-3 bg-white border-2 border-indigo-600 text-indigo-700 font-bold tracking-widest uppercase rounded-xl hover:bg-indigo-50 transition"
              >
                PRINT RCPT
              </button>
              <button 
                onClick={onClose}
                className="px-8 py-3 bg-indigo-600 text-white font-bold tracking-widest uppercase rounded-xl hover:bg-indigo-700 transition"
              >
                CLOSE
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-50 relative">
            
            {/* LEFT PANE: Search and Invoice Details */}
            <div className="flex-[3] flex flex-col border-r border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-100">
                <form onSubmit={handleSearch} className="flex gap-3">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                      type="text" 
                      value={invoiceId}
                      onChange={e => setInvoiceId(e.target.value)}
                      placeholder="Scan/Enter Invoice ID..." 
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-bold uppercase transition-all placeholder:normal-case placeholder:font-normal"
                      autoFocus
                    />
                  </div>
                  <button type="submit" disabled={!invoiceId.trim()} className="bg-slate-900 text-white px-6 py-2.5 rounded-lg font-black tracking-widest uppercase hover:bg-slate-800 disabled:opacity-50 transition transform hover:scale-[1.02] active:scale-[0.98]">
                    FIND
                  </button>
                </form>
                {errorStatus && (
                  <div className="mt-3 text-red-500 bg-red-50 p-3 rounded font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                    <X size={14} className="text-red-500"/> {errorStatus}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/50 p-4">
                {saleData ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                      <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">INVOICE FOUND</div>
                        <div className="font-black text-lg text-indigo-700">#{saleData.id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ORIGINAL DATE</div>
                        <div className="font-bold text-sm text-slate-700">{new Date(saleData.created_at).toLocaleString()}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {saleData.items.map((item: any) => {
                        const maxReturnable = item.quantity - (item.returned_quantity || 0);
                        const isFullyReturned = maxReturnable <= 0;
                        
                        return (
                          <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${isFullyReturned ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' : 'bg-white border-slate-200 hover:border-indigo-300'} transition-colors`}>
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="font-bold text-slate-800 truncate">{item.name}</div>
                              <div className="flex gap-4 mt-1 text-[11px] font-bold tracking-wider uppercase text-slate-500">
                                <span>{item.barcode}</span>
                                <span>•</span>
                                <span>${item.unit_price.toFixed(2)}</span>
                                <span>•</span>
                                <span className={item.returned_quantity > 0 ? "text-red-500" : ""}>Sold: {item.quantity} (Rtn: {item.returned_quantity || 0})</span>
                              </div>
                            </div>
                            
                            {isFullyReturned ? (
                              <span className="text-[10px] bg-slate-200 text-slate-500 px-3 py-1 rounded font-black tracking-widest uppercase">FULLY RTN</span>
                            ) : (
                              <button 
                                onClick={() => addToReturnCart(item)}
                                className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 px-4 py-2 border border-emerald-200 rounded-lg font-black text-xs tracking-widest uppercase transition-colors"
                              >
                                <Plus size={14} /> ADD
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                    <Search className="w-16 h-16 opacity-30" />
                    <p className="font-black tracking-widest uppercase text-sm">Waiting for invoice...</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE: Return Cart & Payment */}
            <div className="flex-[2] bg-white flex flex-col shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
              <div className="p-4 border-b border-slate-100 bg-indigo-50/50">
                <h3 className="font-black text-xs uppercase tracking-widest text-indigo-800 flex items-center justify-between">
                  <span>RETURN CART</span>
                  <span className="bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full text-[10px]">{returnCart.length} ITEMS</span>
                </h3>
              </div>

              <div className="flex-1 overflow-auto p-2">
                {returnCart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <Undo2 className="w-12 h-12 mb-3 opacity-30" />
                    <p className="text-[10px] font-black tracking-widest uppercase text-center max-w-[200px]">Select items from an invoice to build return order</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {returnCart.map(item => (
                      <div key={item.cart_id} className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">INV #{item.sale_id}</div>
                            <div className="font-bold text-sm text-slate-800 truncate leading-tight">{item.name}</div>
                          </div>
                          <button onClick={() => removeCartItem(item.cart_id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-100 pt-2 mt-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateCartQty(item.cart_id, item.qty - 1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700"
                            >-</button>
                            <span className="w-6 text-center font-black text-sm">{item.qty}</span>
                            <button 
                              onClick={() => updateCartQty(item.cart_id, item.qty + 1)}
                              disabled={item.qty >= item.max_returnable}
                              className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded font-bold text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                            >+</button>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400">@ ${item.unit_price.toFixed(2)}</div>
                            <div className="font-black text-indigo-700">${(item.qty * item.unit_price).toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* PAYMENT FOOTER */}
              <div className="p-4 bg-slate-900 text-white rounded-tl-2xl shadow-[0_-10px_20px_rgba(0,0,0,0.1)]">
                <div className="flex justify-between items-end mb-4 border-b border-slate-700 pb-4">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOTAL REFUND OWE</div>
                  <div className="text-4xl font-black text-emerald-400 tracking-tighter">${currentTotalRefund.toFixed(2)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button 
                    onClick={() => {
                      if (settings.allowCash) setRefundMethod('CASH');
                    }}
                    disabled={!settings.allowCash}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-black text-xs tracking-widest uppercase transition-all ${
                      refundMethod === 'CASH' 
                      ? 'bg-emerald-500 text-slate-900 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.2)]' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Banknote className="w-4 h-4" /> CASH
                  </button>
                  <button 
                    onClick={() => setRefundMethod('EXCHANGE')}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg font-black text-xs tracking-widest uppercase transition-all ${
                      refundMethod === 'EXCHANGE' 
                      ? 'bg-indigo-500 text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.2)]' 
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    <Undo2 className="w-4 h-4" /> EX CREDIT
                  </button>
                </div>

                <button 
                  onClick={handleConfirmReturn}
                  disabled={returnCart.length === 0}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-white text-slate-900 rounded-lg font-black tracking-widest uppercase hover:bg-slate-100 disabled:opacity-20 disabled:grayscale transition-all"
                >
                  PROCESS RETURN <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HIDDEN PRINT SLIP */}
      {recentReturnData && (
        <div id="return-receipt" className="hidden print:block bg-white text-black font-mono text-sm leading-snug w-[80mm] mx-auto p-4">
           <div className="text-center mb-6">
             <h1 className="font-bold text-lg uppercase tracking-widest">MULTI-INV RETURN SLIP</h1>
             <p className="text-xs">Date: {recentReturnData.date}</p>
           </div>
           
           <div className="mb-4 space-y-1 text-xs">
             <div className="font-bold border-b border-dashed border-gray-400 pb-1 mb-2">Invoices: {recentReturnData.sale_ids}</div>
             <div><span className="font-bold">Refund Method:</span> {recentReturnData.refund_type}</div>
           </div>

           <div className="border-b-[1px] border-black mb-2 pb-1 flex font-bold uppercase text-[10px]">
             <div className="flex-1">Item</div>
             <div className="w-8 text-center">Qty</div>
             <div className="w-16 text-right">Refund</div>
           </div>

           <div className="flex flex-col gap-2 mb-6 text-[11px]">
               {recentReturnData.items.map((item: any, idx: number) => (
                 <div key={idx} className="flex items-start">
                   <div className="flex-1 pr-2 truncate">{item.name}</div>
                   <div className="w-8 text-center">{item.quantity}</div>
                   <div className="w-16 text-right">{(item.refund_amount * item.quantity).toFixed(2)}</div>
                 </div>
               ))}
           </div>
           
           <div className="border-t-[1px] border-b-[1px] border-black py-2 mb-10 flex justify-between font-bold text-sm">
             <span>TOTAL REFUND:</span>
             <span>${recentReturnData.total_refund.toFixed(2)}</span>
           </div>
           
           <div className="mt-12 text-center text-[10px] space-y-1">
              <p>Thank you.</p>
              <p>Please keep this slip for your records.</p>
           </div>
        </div>
      )}
    </div>
  );
}
