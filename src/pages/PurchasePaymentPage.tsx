import React, { useState, useEffect } from 'react';
import { Search, DollarSign, X, Check, Loader2, Calendar, User, ShieldAlert, Award } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import { useNavigate } from 'react-router-dom';

export default function PurchasePaymentPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  
  // Filters
  const [search, setSearch] = useState('');
  const [supplierIdFilter, setSupplierIdFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Payment Modal States
  const [selectedPayInvoice, setSelectedPayInvoice] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [successState, setSuccessState] = useState<string | null>(null);

  const { token } = useAuthStore();
  const { currency } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvoices();
    fetchSuppliers();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/admin/purchase-invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data);
      }
    } catch (err) { console.error(err); }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (err) { console.error(err); }
  };

  const handleOpenPayModal = (inv: any) => {
    setSelectedPayInvoice(inv);
    setPayAmount(inv.due_amount.toString());
    setPayMethod('CASH');
    setPayDate(new Date().toISOString().split('T')[0]);
    setErrorState(null);
    setSuccessState(null);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayInvoice || !payAmount || parseFloat(payAmount) <= 0) return;
    
    try {
      setPaymentLoading(true);
      setErrorState(null);
      setSuccessState(null);
      
      const res = await fetch(`/api/admin/purchase-invoices/${selectedPayInvoice.id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(payAmount),
          payment_method: payMethod,
          date: payDate
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessState('Payment successfully registered and recorded!');
        setTimeout(() => {
          setSelectedPayInvoice(null);
          fetchInvoices(); // Refresh invoices list
        }, 1200);
      } else {
        setErrorState(data.message || 'Error executing invoice payment transaction.');
      }
    } catch (err) {
      console.error(err);
      setErrorState('Network failure detected. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    // 1. Keyword search (invoice_number or supplier_name)
    const matchesSearch = search === '' || 
                          (inv.invoice_number || '').toLowerCase().includes(search.toLowerCase()) ||
                          (inv.supplier_name || '').toLowerCase().includes(search.toLowerCase());
    
    // 2. Supplier ID filter
    const matchesSupplier = supplierIdFilter === '' || inv.supplier_id?.toString() === supplierIdFilter;
    
    // 3. Payment Status filter
    const matchesStatus = paymentStatusFilter === '' || inv.payment_status === paymentStatusFilter;
    
    // 4. Date filter (match exact date string YYYY-MM-DD)
    const dateFormatted = inv.date ? new Date(inv.date).toISOString().split('T')[0] : '';
    const matchesDate = dateFilter === '' || dateFormatted === dateFilter;
    
    return matchesSearch && matchesSupplier && matchesStatus && matchesDate;
  });

  return (
    <div className="p-6 bg-slate-50 h-full flex flex-col overflow-auto text-slate-800 font-sans text-[11px] uppercase antialiased">
      {/* HEADER SECTION WITH CLOSE BUTTON IN TOP RIGHT */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 shadow-sm">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black text-slate-900 tracking-tight leading-none uppercase">Purchase Invoice Payments</h1>
            <p className="text-[8px] text-slate-400 font-bold tracking-wider normal-case mt-1">Manage, search, and process supplier payment transactions</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/admin/purchase-invoices')} 
          className="p-1 px-3 bg-white hover:bg-red-50 hover:text-red-500 border border-slate-200 hover:border-red-200 text-slate-700 rounded-lg transition-all shadow-sm flex items-center gap-1.5 font-bold text-xs cursor-pointer active:scale-95 group"
          title="Close Page"
        >
          <X className="w-4 h-4 group-hover:scale-110 transition-transform" /> Close
        </button>
      </div>
      
      {/* FILTER BUILDER GROUP */}
      <div className="bg-white p-4 border border-slate-200 mb-6 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        {/* Keyword Text Search */}
        <div className="flex flex-col gap-1">
          <label className="text-[7.5px] font-black text-slate-400 tracking-widest uppercase">Search Query</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input 
              type="text" 
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none" 
              placeholder="Search invoice # or supplier..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
        </div>

        {/* Supplier Listing Selection */}
        <div className="flex flex-col gap-1">
          <label className="text-[7.5px] font-black text-slate-400 tracking-widest uppercase">Supplier</label>
          <div className="relative">
            <select 
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer"
              value={supplierIdFilter} 
              onChange={e => setSupplierIdFilter(e.target.value)}
            >
              <option value="">All Suppliers</option>
              {suppliers.map(sup => (
                <option key={sup.id} value={sup.id.toString()}>{sup.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px] font-black">▼</div>
          </div>
        </div>

        {/* Payment Status Option */}
        <div className="flex flex-col gap-1">
          <label className="text-[7.5px] font-black text-slate-400 tracking-widest uppercase">Payment Status</label>
          <div className="relative">
            <select 
              className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer"
              value={paymentStatusFilter} 
              onChange={e => setPaymentStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="CREDIT">CREDIT (Due/Outstanding)</option>
              <option value="PAID">PAID (Fully Settled)</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[8px] font-black">▼</div>
          </div>
        </div>

        {/* Select Date input */}
        <div className="flex flex-col gap-1">
          <label className="text-[7.5px] font-black text-slate-400 tracking-widest uppercase">Select Date</label>
          <input 
            type="date" 
            className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none cursor-pointer"
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)} 
          />
        </div>
      </div>

      {/* DATA VIEWPORT TABLE */}
      <div className="flex-1 overflow-auto border border-slate-200 bg-white rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase font-black text-slate-500 tracking-wider">
            <tr>
              <th className="py-3 px-5 border-r border-slate-100">Date</th>
              <th className="py-3 px-5 border-r border-slate-100">Invoice Number</th>
              <th className="py-3 px-5 border-r border-slate-100">Supplier Name</th>
              <th className="py-3 px-5 border-r border-slate-100 text-right">Total Amount</th>
              <th className="py-3 px-5 border-r border-slate-100 text-right">Paid Amount</th>
              <th className="py-3 px-5 border-r border-slate-100 text-right">Due Balance</th>
              <th className="py-3 px-5 border-r border-slate-100 text-center">Payment Status</th>
              <th className="py-3 px-5 text-right">Action Handler</th>
            </tr>
          </thead>
          <tbody className="text-[10px] font-medium text-slate-700 divide-y divide-slate-100">
            {filteredInvoices.map(inv => {
              const formattedDate = inv.date ? new Date(inv.date).toLocaleDateString() : 'N/A';
              return (
                <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-5 border-r border-slate-100 font-mono tracking-tight text-slate-500">{formattedDate}</td>
                  <td className="py-3 px-5 border-r border-slate-100 font-bold text-slate-900 tracking-wide">{inv.invoice_number}</td>
                  <td className="py-3 px-5 border-r border-slate-100 text-slate-800 font-semibold">{inv.supplier_name}</td>
                  <td className="py-3 px-5 border-r border-slate-100 text-right font-black italic underline decoration-slate-200 underline-offset-4">{currency.symbol}{inv.total_amount.toFixed(2)}</td>
                  <td className="py-3 px-5 border-r border-slate-100 text-right font-semibold text-emerald-600">{currency.symbol}{inv.paid_amount?.toFixed(2) || '0.00'}</td>
                  <td className={`py-3 px-5 border-r border-slate-100 text-right font-black ${inv.due_amount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    {currency.symbol}{inv.due_amount.toFixed(2)}
                  </td>
                  <td className="py-3 px-5 border-r border-slate-100 text-center">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border shadow-sm transition-colors ${inv.payment_status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-orange-50 border-orange-200 text-orange-600'}`}>
                      {inv.payment_status}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-right">
                    {inv.due_amount > 0 ? (
                      <button 
                        onClick={() => handleOpenPayModal(inv)} 
                        className="bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/10 hover:shadow-md text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-wide transition-all active:scale-95 cursor-pointer"
                      >
                        Pay Now
                      </button>
                    ) : (
                      <span className="text-[8px] font-black inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-md shadow-inner">
                        <Check className="w-2.5 h-2.5" /> Fully Settled
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center">
                  <div className="max-w-xs mx-auto text-slate-400">
                    <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                    <p className="text-xs font-bold italic">No matching purchase invoices found.</p>
                    <p className="text-[9px] text-slate-400 mt-1 normal-case">Try adjusting your filters, keyword queries, or date ranges.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* THE PAY NOW MODAL DRAWER */}
      {selectedPayInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[1000] p-4 transition-all animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden transform transition-transform scale-100">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-150 p-4 px-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 font-extrabold text-[10px]">
                  $
                </div>
                <span className="font-black text-slate-900 leading-none">Record Purchase Payment</span>
              </div>
              <button 
                onClick={() => setSelectedPayInvoice(null)} 
                className="text-slate-450 hover:text-slate-700 hover:bg-slate-200/50 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Form */}
            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">Invoice #</span>
                  <span className="text-slate-800 font-black">{selectedPayInvoice.invoice_number}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">Supplier Name</span>
                  <span className="text-slate-800 font-black">{selectedPayInvoice.supplier_name}</span>
                </div>
                <div className="h-px bg-slate-250/70 my-1"></div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">Total Invoice Cost</span>
                  <span className="text-slate-750 font-black">{currency.symbol}{selectedPayInvoice.total_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold">
                  <span className="text-slate-400">Already Settle Paid</span>
                  <span className="text-emerald-600 font-black">{currency.symbol}{selectedPayInvoice.paid_amount?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] font-black border-t border-dashed border-slate-300 pt-1.5 mt-1">
                  <span className="text-slate-900 uppercase">Outstanding Balance</span>
                  <span className="text-red-500 font-black">{currency.symbol}{selectedPayInvoice.due_amount?.toFixed(2)}</span>
                </div>
              </div>

              {/* Input for Amount Received */}
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-slate-500 tracking-wider">PAYMENT AMOUNT TO SETTLE ({currency.symbol})</label>
                <input 
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedPayInvoice.due_amount}
                  required
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-950 font-black px-4 py-3 text-sm rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                  placeholder="e.g., 150.00"
                />
              </div>

              {/* Payment Mode Selector */}
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-slate-500 tracking-wider">SETTLEMENT METHOD/MODE</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold px-3 py-2 text-xs rounded-xl focus:bg-white outline-none cursor-pointer"
                >
                  <option value="CASH">CASH</option>
                  <option value="ONLINE">ONLINE (TNG/BANK TRANSFER)</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>

              {/* Payment Date Selector */}
              <div className="space-y-1">
                <label className="block text-[8px] font-black text-slate-500 tracking-wider">PAYMENT DATE RECORDED</label>
                <input 
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-bold px-3 py-2 text-xs rounded-xl focus:bg-white outline-none cursor-pointer"
                />
              </div>

              {/* Status Banner */}
              {errorState && (
                <div className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2.5 normal-case">
                  <span>⚠️ Error: {errorState}</span>
                </div>
              )}
              {successState && (
                <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2.5 normal-case">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" /> {successState}
                </div>
              )}

              {/* Submit Controls */}
              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setSelectedPayInvoice(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl transition-all cursor-pointer active:scale-95 text-[10px] uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={paymentLoading || !!successState}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-[10px] uppercase tracking-wider disabled:opacity-50"
                >
                  {paymentLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...
                    </>
                  ) : (
                    <>
                      Record Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
