import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, ShoppingCart, Filter, Calendar, 
  ChevronRight, ArrowLeft, Trash2, Printer, 
  CreditCard, Banknote, CheckCircle2, AlertCircle,
  FileText, History, TrendingUp, DollarSign, Pencil, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';

export default function PurchaseManagement() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create' | 'details' | 'edit'>('list');
  const location = useLocation();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
  const { token } = useAuthStore();
  const { currency } = useTheme();

  // Create/Edit Invoice State
  const [newInvoice, setNewInvoice] = useState({
    id: null as number | null,
    invoice_number: '',
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    items: [] as any[],
    paid_amount: 0
  });
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);

  useEffect(() => {
    fetchInvoices();
    fetchSuppliers();
    fetchStats();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`/api/admin/purchase-invoices?search=${searchQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setInvoices(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSuppliers(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/purchase-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchInvoiceDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/purchase-invoices/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedInvoice(data.data);
        setView('details');
      } else {
        alert(data.message || 'Error fetching invoice details');
      }
    } catch (err) { 
      console.error(err);
      alert('Network error fetching invoice details');
    }
    finally { setLoading(false); }
  };

  const startEdit = (invoice: any) => {
    setNewInvoice({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      supplier_id: invoice.supplier_id.toString(),
      date: invoice.date,
      items: invoice.items.map((i: any) => ({
        product_id: i.product_id,
        name: i.product_name,
        barcode: i.barcode,
        quantity: i.quantity,
        bonus_qty: i.bonus_qty || 0,
        unit_price: i.unit_price,
        expiry_enabled: i.expiry_enabled || false,
        batch_number: i.batch_number || '',
        expiry_date: i.expiry_date || null
      })),
      paid_amount: invoice.paid_amount
    });
    setView('edit');
  };

  const handleProductSearch = async (query: string) => {
    setProductSearch(query);
    if (query.length < 2) {
      setProductResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/products/search?q=${query}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setProductResults(data.data);
    } catch (err) { console.error(err); }
  };

  const addItem = (product: any) => {
    const existing = newInvoice.items.find(i => i.product_id === product.id);
    if (existing) return;

    setNewInvoice({
      ...newInvoice,
      items: [...newInvoice.items, {
        product_id: product.id,
        name: product.name,
        barcode: product.barcode,
        quantity: 1,
        bonus_qty: 0,
        unit_price: product.purchase_price || 0,
        batch_number: '',
        expiry_date: product.expiry_enabled ? new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0] : null,
        expiry_enabled: product.expiry_enabled
      }]
    });
    setProductSearch('');
    setProductResults([]);
  };

  const removeItem = (id: number) => {
    setNewInvoice({
      ...newInvoice,
      items: newInvoice.items.filter(i => i.product_id !== id)
    });
  };

  const updateItem = (id: number, field: string, value: any) => {
    setNewInvoice({
      ...newInvoice,
      items: newInvoice.items.map(i => i.product_id === id ? { ...i, [field]: value } : i)
    });
  };

  const totalAmount = newInvoice.items.reduce((acc, i) => acc + (i.quantity * i.unit_price), 0);

  const submitInvoice = async () => {
    if (!newInvoice.invoice_number || !newInvoice.supplier_id || newInvoice.items.length === 0) {
      alert('Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const url = newInvoice.id ? `/api/admin/purchase-invoices/${newInvoice.id}` : '/api/admin/purchase-invoices';
      const method = newInvoice.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          ...newInvoice,
          total_amount: totalAmount
        })
      });
      const data = await res.json();
      if (data.success) {
        setView('list');
        fetchInvoices();
        fetchStats();
      } else {
        alert(data.message);
      }
    } catch (err) { alert('Error processing invoice'); }
    finally { setLoading(false); }
  };

  const voidInvoice = async (id: number) => {
    if (!confirm('Are you sure you want to VOID this invoice? Stock will be reversed.')) return;
    try {
      const res = await fetch(`/api/admin/purchase-invoices/${id}/void`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchInvoiceDetails(id);
        fetchInvoices();
        fetchStats();
      }
    } catch (err) { console.error(err); }
  };

  const deleteInvoice = async (id: number) => {
    setInvoiceToDelete(id);
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      const res = await fetch(`/api/admin/purchase-invoices/${invoiceToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchInvoices();
        fetchStats();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvoiceToDelete(null);
    }
  };

  const handleEditClick = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/purchase-invoices/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        startEdit(data.data);
      } else {
        alert(data.message || 'Error fetching invoice for edit');
      }
    } catch (err) { 
      console.error(err);
      alert('Network error fetching invoice for edit');
    }
    finally { setLoading(false); }
  };

  const [payAmount, setPayAmount] = useState('');
  const recordPayment = async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) return;
    try {
      const res = await fetch(`/api/admin/purchase-invoices/${selectedInvoice.id}/payments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ amount: parseFloat(payAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setPayAmount('');
        fetchInvoiceDetails(selectedInvoice.id);
        fetchInvoices();
        fetchStats();
      }
    } catch (err) { console.error(err); }
  };

  if (view === 'create' || view === 'edit') {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
           <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="p-1 text-slate-500 hover:text-slate-900 transition"><ArrowLeft className="w-5 h-5"/></button>
              <h1 className="text-slate-900 font-black tracking-widest">{view === 'create' ? 'PURCHASE_INVOICE_PROVISION' : 'PURCHASE_INVOICE_EVOLUTION'}</h1>
           </div>
           <div className="flex items-center gap-2">
              <button onClick={submitInvoice} disabled={loading || totalAmount <= 0} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-black disabled:opacity-50 shadow-lg shadow-indigo-500/20">SAVE_INVOICE</button>
           </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-auto custom-scrollbar bg-white">
            <div className="lg:col-span-3 space-y-4">
                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 border border-slate-200 rounded shadow-sm">
                    <div className="space-y-1">
                        <label className="text-slate-400 font-black">INVOICE_REF</label>
                        <input 
                            type="text" 
                            disabled={view === 'edit'}
                            value={newInvoice.invoice_number}
                            onChange={(e) => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                            className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 shadow-inner"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-400 font-black">VENDOR_UUID</label>
                        <select 
                            value={newInvoice.supplier_id}
                            onChange={(e) => setNewInvoice({ ...newInvoice, supplier_id: e.target.value })}
                            className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                        >
                            <option value="">SELECT_VENDOR</option>
                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-400 font-black">ENTRY_DATE</label>
                        <input 
                            type="date" 
                            value={newInvoice.date}
                            onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                            className="w-full bg-white border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded flex flex-col overflow-hidden shadow-sm">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-black text-slate-400">LINE_ITEMS_MANIFEST</span>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="COMPONENT_SEARCH..."
                                value={productSearch}
                                onChange={(e) => handleProductSearch(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] pl-6 pr-2 py-1 rounded outline-none shadow-inner"
                            />
                            {productResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-2xl z-50">
                                    {productResults.map(p => (
                                        <button key={p.id} onClick={() => addItem(p)} className="w-full px-3 py-1.5 text-left bg-white hover:bg-indigo-50 text-slate-900 text-[9px] font-black border-b border-slate-100">
                                            {p.name} <span className="text-slate-400 block">{p.barcode}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-400 font-black">
                                <th className="py-2 px-4 border-r border-slate-200 text-[8px]">IDENT_QUALIFIER</th>
                                <th className="py-2 px-4 border-r border-slate-200 text-center text-[8px]">BATCH_#</th>
                                <th className="py-2 px-4 border-r border-slate-200 text-center text-[8px]">EXPIRY_DATE</th>
                                <th className="py-2 px-4 border-r border-slate-200 text-center text-[8px]">QTY_MOD</th>
                                <th className="py-2 px-4 border-r border-slate-200 text-center text-[8px]">BONUS_QTY</th>
                                <th className="py-2 px-4 border-r border-slate-200 text-center text-[8px]">UNIT_VAL</th>
                                <th className="py-2 px-4 text-right text-[8px]">TOTAL_VAL</th>
                                <th className="py-2 px-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 transition-colors">
                            {newInvoice.items.map(item => (
                                <tr key={item.product_id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-4 border-r border-slate-100">
                                        <div className="text-slate-900 font-black">{item.name}</div>
                                        <div className="text-slate-400 font-black text-[8px]">{item.barcode}</div>
                                    </td>
                                    <td className="py-2 px-4 border-r border-slate-100">
                                        {item.expiry_enabled ? (
                                            <input type="text" placeholder="BATCH" value={item.batch_number} onChange={(e) => updateItem(item.product_id, 'batch_number', e.target.value)} className="w-full bg-white border border-slate-200 text-slate-900 text-[8px] px-1 py-0.5 rounded outline-none shadow-inner"/>
                                        ) : <span className="text-slate-300 italic block text-center">N/A</span>}
                                    </td>
                                    <td className="py-2 px-4 border-r border-slate-100">
                                        {item.expiry_enabled ? (
                                            <input type="date" value={item.expiry_date} onChange={(e) => updateItem(item.product_id, 'expiry_date', e.target.value)} className="w-full bg-white border border-slate-200 text-slate-900 text-[8px] px-1 py-0.5 rounded outline-none shadow-inner"/>
                                        ) : <span className="text-slate-300 italic block text-center">N/A</span>}
                                    </td>
                                    <td className="py-2 px-4 border-r border-slate-100">
                                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.product_id, 'quantity', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 text-slate-900 text-center rounded outline-none shadow-inner"/>
                                    </td>
                                    <td className="py-2 px-4 border-r border-slate-100">
                                        <input type="number" min="0" value={item.bonus_qty} onChange={(e) => updateItem(item.product_id, 'bonus_qty', parseInt(e.target.value) || 0)} className="w-full bg-white border border-slate-200 text-slate-900 text-center rounded outline-none shadow-inner"/>
                                    </td>
                                    <td className="py-2 px-4 border-r border-slate-100">
                                        <input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full bg-white border border-slate-200 text-slate-900 text-center rounded outline-none shadow-inner"/>
                                    </td>
                                    <td className="py-2 px-4 text-right font-black text-slate-900 underline decoration-indigo-200 underline-offset-4">
                                        {currency.symbol}{(item.quantity * item.unit_price).toFixed(2)}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                        <button onClick={() => removeItem(item.product_id)} className="text-slate-300 hover:text-red-600 Transition"><X size={14}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded shadow-lg text-center flex flex-col items-center">
                    <span className="text-slate-400 font-black mb-2 tracking-[0.3em]">GRAND_TOTAL_EXPOSURE</span>
                    <span className="text-4xl font-black text-slate-900 italic tracking-tighter mb-6 underline decoration-indigo-500 underline-offset-8">{currency.symbol}{totalAmount.toFixed(2)}</span>
                    
                    <div className="w-full space-y-4 mb-6 border-t border-slate-200 pt-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-black">SETTLED_AMOUNT</span>
                            <div className="relative w-28">
                                <span className="absolute left-1 top-1/2 -translate-y-1/2 text-indigo-600 font-bold">{currency.symbol}</span>
                                <input 
                                    type="number" 
                                    value={newInvoice.paid_amount}
                                    onChange={(e) => setNewInvoice({ ...newInvoice, paid_amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-white border border-slate-200 text-slate-900 pl-4 pr-2 py-1 rounded outline-none text-right font-black shadow-inner"
                                />
                            </div>
                        </div>
                        <div className="flex justify-between items-center text-red-600 font-black border-t border-dashed border-slate-200 pt-4">
                            <span>REMAINING_LIABILITY</span>
                            <span>{currency.symbol}{(totalAmount - newInvoice.paid_amount).toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded text-slate-400 shadow-sm">
                    <h4 className="font-black text-slate-900 mb-3 text-[9px] tracking-widest border-b border-slate-200 pb-2 uppercase">STOCK_INJE_LOGIC</h4>
                    <ul className="space-y-2 text-[8px] font-black uppercase italic">
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> INSTANT_QTY_INCREMENT</li>
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> PRICE_BASIS_CALIBRATION</li>
                        <li className="flex items-start gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> AUDIT_TRAIL_GEN_ACTIVE</li>
                    </ul>
                </div>
            </div>
        </div>
      </div>
    );
  }

  if (view === 'details' && selectedInvoice) {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
         <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between sticky top-0 z-20 shadow-md">
           <div className="flex items-center gap-3">
              <button onClick={() => setView('list')} className="p-1 text-slate-500 hover:text-slate-900 transition"><ArrowLeft className="w-5 h-5"/></button>
              <div className="flex items-center gap-2">
                 <h1 className="text-slate-900 font-black tracking-widest text-[11px]">INVOICE_DATA : {selectedInvoice.invoice_number}</h1>
                 {selectedInvoice.status === 'VOID' && <span className="bg-red-50 border border-red-200 text-red-600 px-2 rounded font-black italic">VOIDED</span>}
              </div>
           </div>
           <div className="flex items-center gap-2">
              {selectedInvoice.status === 'ACTIVE' && (
                <button onClick={() => startEdit(selectedInvoice)} className="px-4 py-1.5 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-600 rounded transition-all font-black shadow-sm uppercase italic">PATCH_DATA</button>
              )}
              {selectedInvoice.status === 'ACTIVE' && (
                <button onClick={() => voidInvoice(selectedInvoice.id)} className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-all font-black shadow-sm">VOID_NULLIFY</button>
              )}
           </div>
        </div>

        <div className="p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 overflow-auto custom-scrollbar bg-white">
            <div className="lg:col-span-3 space-y-4">
                <div className="bg-white border border-slate-200 rounded flex flex-col overflow-hidden shadow-sm">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 font-black text-slate-400 uppercase tracking-widest">MANIFEST_LINE_ITEMS</div>
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-slate-500 font-black">
                                <th className="py-3 px-6 border-r border-slate-200/50">DESCRIPTOR</th>
                                <th className="py-3 px-6 border-r border-slate-200/50 text-center">BATCH</th>
                                <th className="py-3 px-6 border-r border-slate-200/50 text-center">EXPIRY</th>
                                <th className="py-3 px-6 border-r border-slate-200/50 text-center">QTY</th>
                                <th className="py-3 px-6 border-r border-slate-200/50 text-center">BONUS</th>
                                <th className="py-3 px-6 border-r border-slate-200/50 text-center">UNIT_VAL</th>
                                <th className="py-3 px-6 text-right">EXT_VAL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedInvoice.items.map((item: any) => (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-6 border-r border-slate-100/50"><div className="text-slate-900 font-black">{item.product_name}</div><div className="text-slate-400 text-[8px]">{item.barcode}</div></td>
                                    <td className="py-3 px-6 border-r border-slate-100/50 text-center font-black">{item.batch_number || 'N/A'}</td>
                                    <td className="py-3 px-6 border-r border-slate-100/50 text-center font-black text-red-500">{item.expiry_date || 'N/A'}</td>
                                    <td className="py-3 px-6 border-r border-slate-100/50 text-center font-black">{item.quantity}</td>
                                    <td className="py-3 px-6 border-r border-slate-100/50 text-center font-black text-emerald-600">{item.bonus_qty || 0}</td>
                                    <td className="py-3 px-6 border-r border-slate-100/50 text-center font-black text-slate-500">{currency.symbol}{item.unit_price.toFixed(2)}</td>
                                    <td className="py-3 px-6 text-right font-black text-slate-900 underline decoration-indigo-200 underline-offset-4">{currency.symbol}{item.total_price.toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr className="font-black">
                                <td colSpan={5} className="py-4 px-6 text-slate-400 tracking-[0.5em]">GRAND_TOTAL_MANIFEST</td>
                                <td className="py-4 px-6 text-right text-slate-900 text-lg underline decoration-indigo-500 underline-offset-4">{currency.symbol}{selectedInvoice.total_amount.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="bg-white border border-slate-200 rounded flex flex-col overflow-hidden shadow-sm">
                    <div className="p-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <span className="font-black text-slate-400">PAYMENT_SETTLEMENT_LOG</span>
                        <span className={`text-[9px] font-black italic px-2 py-0.5 rounded border shadow-sm ${selectedInvoice.payment_status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>{selectedInvoice.payment_status}</span>
                    </div>
                    <div className="p-4 space-y-2 bg-white">
                        {selectedInvoice.payments.map((p: any) => (
                             <div key={p.id} className="flex justify-between items-center p-3 bg-slate-50/50 border border-slate-100 rounded">
                                <div className="flex flex-col">
                                    <span className="text-emerald-600 font-black tracking-widest">{currency.symbol}{p.amount.toFixed(2)}</span>
                                    <span className="text-slate-400 text-[8px] tracking-[0.2em]">{p.payment_method} | {new Date(p.date).toISOString().split('T')[0]}</span>
                                </div>
                                <span className="text-slate-300 italic font-black">LOG_VERIFIED</span>
                             </div>
                        ))}
                        {selectedInvoice.payments.length === 0 && <div className="py-10 text-center text-slate-300 font-black tracking-widest italic">ZERO_SETTLEMENTS_RECORDED</div>}
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 p-6 rounded shadow-lg text-center flex flex-col items-center">
                    <h4 className="font-black text-slate-400 text-[9px] mb-6 tracking-widest border-b border-slate-200 pb-2 w-full uppercase">EXPOSURE_SUMMARY</h4>
                    <div className="space-y-6 w-full">
                        <div className="flex flex-col items-center">
                            <span className="text-slate-400 font-black mb-1">REMAINING_DEBT</span>
                            <span className="text-3xl font-black text-red-600 tracking-tighter underline decoration-red-200 underline-offset-8">{currency.symbol}{selectedInvoice.due_amount.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full">
                            <div className="bg-white p-3 border border-slate-200 rounded text-center shadow-inner">
                                <div className="text-slate-400 text-[8px] font-black mb-1">SETTLED</div>
                                <div className="text-emerald-600 font-black italic">{currency.symbol}{selectedInvoice.paid_amount.toFixed(2)}</div>
                            </div>
                            <div className="bg-white p-3 border border-slate-200 rounded text-center shadow-inner">
                                <div className="text-slate-400 text-[8px] font-black mb-1">GROSS</div>
                                <div className="text-slate-900 font-black italic">{currency.symbol}{selectedInvoice.total_amount.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>

                    {selectedInvoice.due_amount > 0 && selectedInvoice.status === 'ACTIVE' && (
                        <div className="mt-8 pt-6 border-t border-dashed border-slate-200 w-full text-left">
                            <span className="text-slate-400 font-black text-[8px] uppercase tracking-widest block mb-3">PUSH_PARTIAL_SETTLEMENT</span>
                            <div className="flex gap-2">
                                <input 
                                    type="number"
                                    placeholder="VAL_REF"
                                    value={payAmount}
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 text-slate-900 px-2 py-1.5 rounded outline-none font-black text-[9px] shadow-inner"
                                />
                                <button onClick={recordPayment} className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-black text-[9px] shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">EXECUTE</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded shadow-sm">
                    <h4 className="font-black text-slate-900 text-[9px] mb-3 tracking-widest border-b border-slate-200 pb-2 uppercase">VENDOR_METADATA</h4>
                    <div className="text-[9px] space-y-2">
                        <div className="flex justify-between font-black"><span className="text-slate-400">IDENTITY</span> <span className="text-slate-900">{selectedInvoice.supplier_name}</span></div>
                        <div className="flex justify-between font-black"><span className="text-slate-400">CHANNEL</span> <span className="text-slate-900">{selectedInvoice.supplier_phone || 'N/A'}</span></div>
                        <div className="flex justify-between font-black"><span className="text-slate-400">SYNC_TS</span> <span className="text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString()}</span></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md transition-colors">
        <div className="flex items-center gap-3">
            <ShoppingCart className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-black tracking-widest italic">PURCHASE_INVOICE_LEDGER</span>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={() => setView('create')} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 font-black shadow-lg shadow-indigo-500/20 active:scale-95 leading-none">
             <Plus className="w-3.5 h-3.5" /> PROVISION_INVOICE
           </button>
        </div>
      </div>

      <div className="p-3 bg-slate-50 border-b border-slate-100 flex gap-3 items-center transition-colors">
            <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="LEDGER_SCAN_QUERY..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchInvoices()}
                    className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] pl-6 pr-2 py-1.5 rounded outline-none shadow-inner font-black italic"
                />
            </div>
            <div className="flex items-center gap-2">
                <button onClick={fetchInvoices} className="p-1.5 bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded transition shadow-sm active:scale-95"><Filter size={12}/></button>
            </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-100 bg-white custom-scrollbar">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200 transition-colors">
                <tr className="text-slate-400 bg-slate-50/80 backdrop-blur-md">
                    <th className="py-3 px-6 border-r border-slate-200 font-black">INVOICE_REF</th>
                    <th className="py-3 px-6 border-r border-slate-200 font-black">VENDOR_IDENT</th>
                    <th className="py-3 px-6 border-r border-slate-200 font-black">SYNC_DATE</th>
                    <th className="py-3 px-6 border-r border-slate-200 font-black">EXPOSURE_VAL</th>
                    <th className="py-3 px-6 border-r border-slate-200 font-black">SETTLEMENT_STATE</th>
                    <th className="py-3 px-6 text-right font-black">ACTION</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
                {invoices.map(inv => (
                    <tr key={inv.id} className={`hover:bg-slate-50/50 transition-colors group ${inv.status === 'VOID' ? 'opacity-40 grayscale-sm italic' : ''}`}>
                        <td className="py-3 px-6 border-r border-slate-100 text-slate-900 font-black italic tracking-tighter">{inv.invoice_number}</td>
                        <td className="py-3 px-6 border-r border-slate-100 font-bold text-slate-500 truncate max-w-xs">{inv.supplier_name}</td>
                        <td className="py-3 px-6 border-r border-slate-100 text-slate-400 font-black tracking-widest">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-3 px-6 border-r border-slate-100">
                            <div className="text-slate-900 font-black italic underline decoration-indigo-200 underline-offset-4">{currency.symbol}{inv.total_amount.toFixed(2)}</div>
                            {inv.due_amount > 0 && <div className="text-[8px] text-red-600 font-black italic tracking-tighter mt-1">DUE: {currency.symbol}{inv.due_amount.toFixed(2)}</div>}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded border shadow-sm transition-colors ${inv.payment_status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>{inv.payment_status}</span>
                        </td>
                        <td className="py-3 px-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => fetchInvoiceDetails(inv.id)} className="p-1 px-2 bg-white hover:bg-slate-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded transition-all font-black text-[8px] uppercase tracking-tighter flex items-center gap-1" title="VIEW">
                                    <FileText className="w-3 h-3" /> VIEW
                                </button>
                                <button onClick={() => handleEditClick(inv.id)} className="p-1 px-2 bg-white hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 border border-slate-200 rounded transition-all font-black text-[8px] shadow-sm uppercase italic flex items-center gap-1" title="EDIT">
                                    <Pencil className="w-3 h-3" /> EDIT
                                </button>
                                <button onClick={() => deleteInvoice(inv.id)} className="p-1 px-2 bg-white hover:bg-red-50 text-slate-300 hover:text-red-600 border border-slate-200 rounded transition-all font-black text-[8px] uppercase tracking-tighter flex items-center gap-1" title="DELETE">
                                    <Trash2 className="w-3 h-3" /> DELETE
                                </button>
                                <button onClick={() => navigate('/admin/purchase-payments')} className="p-1 px-2 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 border border-slate-200 rounded transition-all font-black text-[8px] uppercase tracking-tighter flex items-center gap-1" title="PAY">
                                    <DollarSign className="w-3 h-3" /> PAY
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
                {invoices.length === 0 && (
                    <tr><td colSpan={6} className="py-20 text-center font-black text-slate-300 tracking-[0.5em] grayscale italic select-none">EMPTY_INVOICE_LEDGER</td></tr>
                )}
            </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div className="flex gap-4">
             <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /> TOTAL_MONTHLY: <span className="text-slate-900">{currency.symbol}{(stats?.monthlyTotal || 0).toFixed(2)}</span></span>
             <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" /> SETTLED_ASSETS: <span className="text-emerald-600">{currency.symbol}{(stats?.totalPaid || 0).toFixed(2)}</span></span>
             <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500/50" /> LIABILITIES: <span className="text-red-700 underline decoration-red-200 underline-offset-4">{currency.symbol}{(stats?.totalDue || 0).toFixed(2)}</span></span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-sm shadow-indigo-500" />
            <span className="italic uppercase">SYSTEM_READY.ENTRY_MODE : {new Date().toISOString()}</span>
         </div>
      </div>

      <ConfirmModal
        isOpen={invoiceToDelete !== null}
        onClose={() => setInvoiceToDelete(null)}
        onConfirm={confirmDeleteInvoice}
        title="PURGE_PURCHASE_INVOICE"
        message="CRITICAL: ARE YOU ABSOLUTELY POSITIVE YOU WANT TO DELETE THIS PURCHASE INVOICE? THIS WILL REVERSE ALL STOCK INJECTIONS AND ORPHAN PAYMENT LOGS."
      />
    </div>
  );
}

