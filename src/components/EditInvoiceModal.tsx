import React, { useState } from 'react';
import { X, Check, Trash2, CreditCard } from 'lucide-react';

interface EditInvoiceModalProps {
  sale: any;
  onClose: () => void;
  onSave: (data: any) => void;
  currency: any;
  customers: any[];
  availableProducts: any[];
}

export default function EditInvoiceModal({ sale, onClose, onSave, currency, customers, availableProducts }: EditInvoiceModalProps) {
  const [editPaymentMethod, setEditPaymentMethod] = useState(sale.payment_method);
  const [editCustomerId, setEditCustomerId] = useState<string>(sale.customer_id?.toString() || '');
  const [editDiscountAmount, setEditDiscountAmount] = useState<number>(sale.discount_amount || 0);
  const [editCreatedAt, setEditCreatedAt] = useState(sale.created_at ? new Date(sale.created_at).toISOString().slice(0, 16) : '');
  const [editItems, setEditItems] = useState(sale.items?.map((i: any) => ({ ...i })) || []);

  const updateEditItem = (idx: number, field: string, value: any) => {
    const newItems = [...editItems];
    newItems[idx][field] = value;
    newItems[idx].subtotal = Number(newItems[idx].quantity) * Number(newItems[idx].unit_price);
    setEditItems(newItems);
  };

  const removeEditItem = (idx: number) => {
    const newItems = [...editItems];
    newItems.splice(idx, 1);
    setEditItems(newItems);
  };

  const addEditItem = (productId: string) => {
    if (!productId) return;
    const prod = availableProducts.find(p => p.id.toString() === productId);
    if (!prod) return;
    setEditItems([...editItems, {
      product_id: prod.id,
      product_name: prod.name,
      quantity: 1,
      unit_price: prod.selling_price,
      subtotal: prod.selling_price
    }]);
  };

  const calculateNewSubtotal = () => {
    return editItems.reduce((acc, item) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-lg font-black text-slate-900 italic tracking-tighter uppercase">Edit Sale Invoice - INV-{sale.id}</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Items List</h3>
            {editItems.map((item, idx) => (
              <div key={idx} className="bg-white p-3 border border-slate-100 rounded-lg flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-sm mb-1">{item.product_name || item.name}</div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number" min="1" step="1" 
                      value={item.quantity} 
                      onChange={(e) => updateEditItem(idx, 'quantity', Number(e.target.value) || 1)}
                      className="w-16 border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-indigo-500" 
                    />
                    <span className="text-xs text-slate-400 font-bold">X</span>
                    <span className="text-xs font-black text-slate-700">{currency.symbol}{item.unit_price.toFixed(2)}</span>
                    <span className="font-black text-indigo-600 ml-auto">{currency.symbol}{item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
                <button onClick={() => removeEditItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <select
                onChange={(e) => { addEditItem(e.target.value); e.target.value = ''; }}
                className="w-full border-2 border-dashed border-slate-200 text-slate-600 px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-xs font-bold"
            >
                <option value="">+ Add Item...</option>
                {availableProducts.map(p => (
                <option key={p.id} value={p.id}>{p.name} - {currency.symbol}{p.selling_price.toFixed(2)}</option>
                ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Payment Method</label>
              <select
                value={editPaymentMethod}
                onChange={(e) => setEditPaymentMethod(e.target.value)}
                className="w-full border border-slate-200 p-2 rounded-lg text-xs font-bold"
              >
                  <option value="CASH">CASH</option>
                  <option value="ONLINE">ONLINE / TNG</option>
                  <option value="CREDIT">CREDIT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">Discount ({currency.symbol})</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editDiscountAmount}
                onChange={(e) => setEditDiscountAmount(Number(e.target.value) || 0)}
                className="w-full border border-slate-200 p-2 rounded-lg text-xs font-bold"
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 flex gap-4 items-center justify-between">
           <div className="font-black text-lg">Total: {currency.symbol}{Math.max(0, calculateNewSubtotal() - Number(editDiscountAmount)).toFixed(2)}</div>
           <button 
             onClick={() => onSave({ payment_method: editPaymentMethod, customer_id: editCustomerId, discount_amount: editDiscountAmount, created_at: editCreatedAt, items: editItems })}
             className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2"
           >
             <Check className="w-4 h-4" /> Save Changes
           </button>
        </div>
      </div>
    </div>
  );
}
