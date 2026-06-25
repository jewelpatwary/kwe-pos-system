import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Filter, Eye, Printer, User, X, Hash, CreditCard, Pencil, Check, Trash2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import { formatDate } from '../lib/utils';

import ConfirmModal from '../components/ConfirmModal';
import EditInvoiceModal from '../components/EditInvoiceModal';

// Helper function to render payment method
const renderPaymentMethod = (method: string) => {
  if (!method) return '';
  if (method.startsWith('SPLIT|')) {
    return 'SPLIT';
  }
  return method === 'ONLINE' ? 'TNG' : method;
};

export default function SalesHistory() {
  const navigate = useNavigate();
  const { currency, dateFormat } = useTheme();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { token, user } = useAuthStore();

  // Invoice Edit State for Admins
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);

  const handleStartEdit = async () => {
    if (!selectedSale) return;
    
    if (customers.length === 0) {
      try {
        const res = await fetch('/api/customers', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setCustomers(data.data);
        }
      } catch (err) {
        console.error('Error fetching customers:', err);
      }
    }

    if (availableProducts.length === 0) {
      try {
        const pRes = await fetch('/api/products', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const pData = await pRes.json();
        if (pData.success) {
          setAvailableProducts(pData.data);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      }
    }
    
    setShowEditModal(true);
  };

  const handleSaveEdit = async (editData: any) => {
    if (!selectedSale) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/sales/${selectedSale.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payment_method: editData.payment_method,
          customer_id: editData.payment_method === 'CREDIT' ? editData.customer_id : null,
          discount_amount: Number(editData.discount_amount) || 0,
          created_at: editData.created_at ? new Date(editData.created_at).toISOString() : undefined,
          items: editData.items
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Invoice updated successfully!');
        setShowEditModal(false);
        fetchSales();
        handleViewSale(selectedSale.id);
      } else {
        alert('Failed to update invoice: ' + data.message);
      }
    } catch (err: any) {
      alert('Error updating invoice: ' + (err.message || err));
    } finally {
      setSavingEdit(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteSale = async () => {
    if (!selectedSale || user?.role !== 'ADMIN') return;
    setDeleteConfirmOpen(false);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sales/${selectedSale.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSale(null);
        fetchSales();
      } else {
        alert('Failed to delete invoice: ' + data.message);
      }
    } catch (err: any) {
      alert('Error deleting invoice: ' + (err.message || 'Unknown error'));
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchSales = async () => {
    try {
      /* setLoading removed to prevent flicker */
      const res = await fetch('/api/sales', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSales(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleViewSale = async (id: number) => {
    setLoading(true);
    setShowEditModal(false);
    try {
      const res = await fetch(`/api/sales/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSale(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(s => {
    const formattedInvoiceNo = `INV-${s.id}`;
    const matchesSearch = s.id.toString().includes(search) || 
                          formattedInvoiceNo.toLowerCase().includes(search.toLowerCase()) ||
                          s.payment_method.toLowerCase().includes(search.toLowerCase());
                          
    let matchesDate = true;
    if (filterDate) {
      const saleDate = new Date(s.created_at);
      const year = saleDate.getFullYear();
      const month = String(saleDate.getMonth() + 1).padStart(2, '0');
      const day = String(saleDate.getDate()).padStart(2, '0');
      const localDateStr = `${year}-${month}-${day}`;
      matchesDate = localDateStr === filterDate;
    }

    let matchesMethod = true;
    if (filterMethod) {
      if (filterMethod === 'TNG') {
        matchesMethod = s.payment_method === 'ONLINE' || s.payment_method === 'TNG' || s.payment_method.startsWith('SPLIT|');
      } else if (filterMethod === 'CASH') {
        matchesMethod = s.payment_method === 'CASH' || s.payment_method.startsWith('SPLIT|');
      } else {
        matchesMethod = s.payment_method === filterMethod;
      }
    }

    return matchesSearch && matchesDate && matchesMethod;
  });


  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md transition-colors">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search Invoice (ID/Method)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
          />
        </div>
        
        <div className="flex items-center gap-2">
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner h-[34px]"
            />
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner h-[34px]"
            >
              <option value="">All Methods</option>
              <option value="CASH">CASH</option>
              <option value="TNG">TNG</option>
              <option value="CREDIT">CREDIT</option>
            </select>
        </div>
        
        <div className="flex-1"></div>
        <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded hover:bg-slate-50 transition flex items-center gap-2 font-black shadow-sm active:scale-95">
            <Filter className="w-3.5 h-3.5" /> Filter Logs
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden transition-colors">
        {/* Sales List */}
        <div className="flex-1 overflow-auto border-r border-slate-200 bg-white custom-scrollbar">
            {loading && sales.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-pulse tracking-[0.5em] font-black text-slate-400 uppercase italic">Loading Sales History...</div>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                        <tr className="text-slate-400 bg-slate-50/80 backdrop-blur-md font-black">
                            <th className="py-4 px-6 border-r border-slate-200">Invoice ID</th>
                            <th className="py-4 px-6 border-r border-slate-200">Date & Time</th>
                            <th className="py-4 px-6 border-r border-slate-200">Payment Method</th>
                            <th className="py-4 px-6 text-right border-r border-slate-200">Total Price</th>
                            <th className="py-4 px-6 text-center font-black">Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 transition-colors">
                        {filteredSales.map((sale) => (
                            <tr 
                                key={sale.id} 
                                className={`hover:bg-slate-50 cursor-pointer transition-all group ${selectedSale?.id === sale.id ? 'bg-indigo-50 ' : ''}`}
                                onClick={() => handleViewSale(sale.id)}
                            >
                                <td className="py-4 px-6 border-r border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900 tracking-tighter">INV-{sale.id}</span>
                                        {sale.status === 'voided' && <span className="bg-red-500/10 border border-red-500/30 text-red-600 text-[7px] px-1.5 py-0.5 rounded font-black">VOIDED</span>}
                                    </div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-black">
                                                                    {formatDate(sale.created_at, `${dateFormat} HH:mm`)}
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100">
                                    <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 font-black text-[8px] transition-colors">
                                        {renderPaymentMethod(sale.payment_method)}
                                    </span>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100 text-right font-black text-slate-900 underline decoration-indigo-200 underline-offset-4">
                                    {currency.symbol}{sale.total_amount.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <Eye className="w-3.5 h-3.5 mx-auto text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        {/* Selected Sale Preview */}
        {selectedSale && (
          <div className="w-[450px] shrink-0 bg-slate-50 border-l border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 transition-colors shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center transition-colors">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-slate-900 font-black italic tracking-tighter uppercase underline decoration-indigo-500 underline-offset-4 decoration-2 truncate">
                   {`Sale Details: INV-${selectedSale.id}`}
                </h2>
                                <div className="text-[8px] text-slate-400 font-black mt-0.5 tracking-widest">{formatDate(selectedSale.created_at, `${dateFormat} HH:mm`)}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                  {user?.role === 'ADMIN' && (
                      <>
                        <button 
                          onClick={handleStartEdit} 
                          title="Edit Invoice" 
                          className="p-1.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-600 hover:bg-indigo-100 transition-all shadow-sm active:scale-90"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirmOpen(true)}
                          disabled={isDeleting}
                          title="Delete Invoice" 
                          className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-600 hover:bg-rose-100 transition-all shadow-sm active:scale-90"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                  )}
                  <button className="p-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-90">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setSelectedSale(null); }} className="p-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:text-red-500 transition-all shadow-sm active:scale-90">
                    <X className="w-3.5 h-3.5" />
                  </button>
              </div>
            </div>
            
            {/* VIEW ONLY */}
            <div className="flex-1 overflow-auto p-6 custom-scrollbar space-y-8 bg-white transition-colors">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center gap-3 shadow-inner">
                   <User className="w-4 h-4 text-indigo-600" />
                   <span className="text-slate-500 font-black italic tracking-widest text-[9px] uppercase">
                     {selectedSale.customers?.name || 'Walk-In Customer'}
                   </span>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-200 pb-1 italic">Items List</h3>
                    <div className="space-y-2">
                        {selectedSale.items?.map((item: any, i: number) => (
                            <div key={i} className="bg-slate-50/50 p-3 border border-slate-100 flex justify-between items-center group hover:bg-slate-100 transition-colors">
                                <div>
                                    <div className="font-black text-slate-900 italic tracking-tighter uppercase">{item.product_name || item.name}</div>
                                    <div className="text-[7px] text-slate-400 font-black mt-1 uppercase tracking-widest italic">{item.quantity} UNIT x {currency.symbol}{item.unit_price.toFixed(2)}</div>
                                </div>
                                <div className="font-black text-indigo-600 italic underline decoration-indigo-100 underline-offset-2 tracking-tighter">{currency.symbol}{item.subtotal.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 border-t border-b border-slate-200 font-black transition-colors shadow-inner">
                    <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal</span>
                        <span className="italic">{currency.symbol}{(selectedSale.total_amount + selectedSale.discount_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                        <span>Discount</span>
                        <span className="italic">-{currency.symbol}{selectedSale.discount_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900 text-xl border-t border-slate-200 pt-3 tracking-tighter underline underline-offset-4 decoration-indigo-500 decoration-2">
                        <span>Total Paid</span>
                        <span className="italic font-sans underline decoration-current">{currency.symbol}{selectedSale.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-indigo-600 italic tracking-widest text-[8px] pt-2 transition-colors">
                        <div className="flex items-center gap-1.5 underline decoration-indigo-500/30 underline-offset-4">
                            <CreditCard className="w-3 h-3" />
                            Settled : {renderPaymentMethod(selectedSale.payment_method)}
                        </div>
                        <span className="text-slate-300 font-sans tracking-tighter uppercase">Verified</span>
                    </div>
                </div>
              </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-200 transition-colors">
                <button onClick={() => setSelectedSale(null)} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-black tracking-[0.2em] hover:bg-slate-50 hover:text-slate-900 transition shadow-sm text-[9px] uppercase italic active:scale-95">
                    Close
                </button>
            </div>
          </div>
        )}
      </div>
      
      <ConfirmModal 
        isOpen={deleteConfirmOpen} 
        onClose={() => setDeleteConfirmOpen(false)} 
        onConfirm={handleDeleteSale} 
        title="Delete Invoice" 
        message="Are you sure you want to completely delete this invoice? This will restore product stock and reverse any credit applied, and cannot be undone." 
        confirmText="Yes, Delete" 
        cancelText="Cancel" 
      />
      {showEditModal && selectedSale && (
        <EditInvoiceModal
          sale={selectedSale}
          currency={currency}
          customers={customers}
          availableProducts={availableProducts}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
