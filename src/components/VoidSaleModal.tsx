import React, { useState } from 'react';
import { Search, X, Ban, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface VoidSaleModalProps {
  onClose: () => void;
}

export default function VoidSaleModal({ onClose }: VoidSaleModalProps) {
  const [invoiceId, setInvoiceId] = useState('');
  const [saleData, setSaleData] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const [voidQuantities, setVoidQuantities] = useState<Record<number, number>>({});
  
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const { token, user } = useAuthStore();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    setSaleData(null);
    setVoidQuantities({});
    
    if (!invoiceId.trim()) return;

    try {
      const res = await fetch(`/api/sales/${invoiceId.trim()}`);
      const data = await res.json();
      
      if (data.success) {
        if (data.data.status === 'voided') {
          setErrorStatus('This invoice has already been fully voided.');
          return;
        }
        setSaleData(data.data);
        const initialQtys: Record<number, number> = {};
        data.data.items.forEach((item: any) => {
          initialQtys[item.product_id] = 0;
        });
        setVoidQuantities(initialQtys);
      } else {
        setErrorStatus(data.message || 'Invoice not found');
      }
    } catch (err) {
      setErrorStatus('Error fetching invoice');
    }
  };

  const updateVoidQty = (productId: number, qty: number, maxAllowed: number) => {
    if (qty < 0 || qty > maxAllowed) return;
    setVoidQuantities(prev => ({
      ...prev,
      [productId]: qty
    }));
  };

  const setAllMax = () => {
    if (!saleData) return;
    const allQtys: Record<number, number> = {};
    saleData.items.forEach((item: any) => {
      allQtys[item.product_id] = item.quantity; // Note: We might want to subtract already returned qtys if they exist, but for void we'll assume it's a direct correction.
    });
    setVoidQuantities(allQtys);
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Auth Check
    if (user?.role === 'CASHIER' && (!adminUsername || !adminPassword)) {
      setErrorStatus("Admin/Manager credentials required.");
      return;
    }

    const itemsToVoid = saleData.items
      .filter((item: any) => voidQuantities[item.product_id] > 0)
      .map((item: any) => ({
        product_id: item.product_id,
        quantity: voidQuantities[item.product_id],
      }));

    if (itemsToVoid.length === 0) {
      setErrorStatus('Please select at least one item to void.');
      return;
    }

    setProcessing(true);
    setErrorStatus(null);

    // Check if full sale void
    let isFullSale = true;
    for (const item of saleData.items) {
      if (voidQuantities[item.product_id] !== item.quantity) {
        isFullSale = false;
        break;
      }
    }

    try {
      const payload = {
        sale_id: saleData.id,
        items: itemsToVoid,
        is_full_sale: isFullSale,
        reason: 'Operator Void',
        admin_username: adminUsername,
        admin_password: adminPassword
      };

      const res = await fetch('/api/void', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert("Void processed successfully. Stock has been restored.");
        onClose();
      } else {
        setErrorStatus("Void failed: " + data.message);
      }
    } catch (err) {
      setErrorStatus("Error processing void");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-red-100 bg-red-50 rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2 text-red-900">
            <Ban className="w-5 h-5 text-red-600" /> Void Transaction
          </h2>
          <button onClick={onClose} className="p-2 bg-white text-red-500 hover:bg-red-100 rounded-full transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 bg-gray-50/50">
          
          {/* Search Box */}
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
                placeholder="Scan receipt barcode or enter invoice ID to void..." 
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-red-500 bg-white"
                autoFocus
              />
            </div>
            <button type="submit" className="bg-gray-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black shadow-sm transition">
              Find
            </button>
          </form>

          {errorStatus && (
            <div className="text-red-600 bg-red-50 border border-red-100 p-4 rounded-lg font-medium text-center flex justify-center items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {errorStatus}
            </div>
          )}

          {saleData && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-gray-800">Invoice #{saleData.id}</div>
                  <div className="text-sm text-gray-500">Total: ${saleData.total_amount.toFixed(2)}</div>
                </div>
                <button
                  onClick={setAllMax}
                  className="px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg text-sm font-bold transition"
                >
                  Void Entire Sale
                </button>
              </div>

              <div className="p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50/50">
                      <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qty Sold</th>
                      <th className="py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qty to Void</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {saleData.items.map((item: any) => {
                      const maxVoidable = item.quantity;
                      const currentVoidQty = voidQuantities[item.product_id] || 0;
                      return (
                        <tr key={item.id} className={maxVoidable === 0 ? "bg-gray-50 opacity-60" : ""}>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-gray-800">{item.name}</div>
                            <div className="text-xs text-gray-500">${item.unit_price.toFixed(2)}</div>
                          </td>
                          <td className="py-3 px-4 text-center font-medium">{item.quantity}</td>
                          <td className="py-3 px-4 text-center">
                            {maxVoidable > 0 ? (
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => updateVoidQty(item.product_id, currentVoidQty - 1, maxVoidable)}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
                                >-</button>
                                <span className="w-6 font-bold text-red-600">{currentVoidQty}</span>
                                <button 
                                  onClick={() => updateVoidQty(item.product_id, currentVoidQty + 1, maxVoidable)}
                                  className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded hover:bg-gray-200 text-gray-700"
                                >+</button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 font-medium">None</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Auth & Confirm */}
        {saleData && (
          <form className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl" onSubmit={handleConfirmVoid}>
            {user?.role === 'CASHIER' && (
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                   <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Manager Username</label>
                   <input type="text" required value={adminUsername} onChange={e => setAdminUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                </div>
                <div className="flex-1">
                   <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Manager Password</label>
                   <input type="password" required value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500" />
                </div>
              </div>
            )}
            
            <button 
              type="submit"
              disabled={processing || Object.values(voidQuantities).every(q => q === 0)}
              className="w-full py-4 rounded-xl font-bold text-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition flex justify-center items-center gap-2"
            >
              <AlertTriangle className="w-5 h-5 text-red-200" /> {processing ? 'Processing...' : 'Confirm & Process Void'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
