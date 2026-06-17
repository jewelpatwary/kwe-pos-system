import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, CreditCard, Edit2, ShieldAlert, X, History, TrendingUp, DollarSign, Scan, UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPaymentFor, setShowPaymentFor] = useState<any>(null);
  const [showManageCredit, setShowManageCredit] = useState<any>(null);
  const [showAutoBurnLogs, setShowAutoBurnLogs] = useState<any>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [autoBurnHistory, setAutoBurnHistory] = useState<any[]>([]);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [multiplier, setMultiplier] = useState('1.0');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', 
    daily_limit: '0', daily_limit_mode: 'AUTO', monthly_limit: '0', 
    total_pax: '1', total_monthly_limit: '0',
    status: 'active', credit_status: 'ACTIVE', auto_sale_cfg: false,
    auto_credit_product_id: '',
    working_place: '', emp_id: '', passport_no: '', auto_burn: false, auto_burn_start_date: '', auto_burn_stop_date: ''
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

  useEffect(() => {
    const pax = parseFloat(formData.total_pax) || 1;
    const mLimit = parseFloat(formData.monthly_limit) || 0;
    const totalMLimit = (pax * mLimit).toFixed(2);

    let nextDailyLimit = formData.daily_limit;
    if (formData.daily_limit_mode === 'AUTO') {
      const now = new Date();
      const days = getDaysInMonth(now.getFullYear(), now.getMonth());
      nextDailyLimit = (parseFloat(totalMLimit) / days).toFixed(2);
    }

    setFormData(prev => ({ 
      ...prev, 
      total_monthly_limit: totalMLimit,
      daily_limit: nextDailyLimit
    }));
  }, [formData.monthly_limit, formData.total_pax, formData.daily_limit_mode]);

  // Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchCustomers = async () => {
    try {
      /* setLoading removed to prevent flicker */
      const res = await fetch('/api/customers?type=DELIVERY', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setCustomers(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setProducts(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/credit-settings', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setMultiplier(data.multiplier);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { 
    fetchCustomers(); 
    fetchProducts();
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    /* setLoading removed to prevent flicker */
    try {
      const url = formData.id ? `/api/customers/${formData.id}` : '/api/customers';
      const method = formData.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData, 
          credit_limit: Number(formData.credit_limit), 
          daily_limit: Number(formData.daily_limit),
          monthly_limit: Number(formData.monthly_limit),
          total_pax: Number(formData.total_pax || 1),
          total_monthly_limit: Number(formData.total_monthly_limit || 0),
          auto_sale_cfg: formData.auto_sale_cfg,
          auto_credit_product_id: formData.auto_credit_product_id || null,
          member_type: 'DELIVERY'
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        fetchCustomers();
      } else { alert(data.message); }
    } catch (err) { alert('Error saving customer'); }
    finally { setLoading(false); }
  };

  const handlePayment = async () => {
    if (!paymentAmount || Number(paymentAmount) <= 0) return alert('Enter valid amount');
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${showPaymentFor.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount: Number(paymentAmount) })
      });
      const data = await res.json();
      if (data.success) {
        setShowPaymentFor(null);
        setPaymentAmount('');
        fetchCustomers();
      } else { alert(data.message); }
    } catch (err) { alert('Error processing payment'); }
    finally { setLoading(false); }
  };

  const handleEdit = (c: any) => {
    setFormData({
      id: c.id,
      name: c.name,
      rfid_card: c.rfid_card || '',
      phone: c.phone || '',
      credit_limit: (c.credit_limit || 0).toString(),
      daily_limit: (c.daily_limit || 0).toString(),
      monthly_limit: (c.monthly_limit || 0).toString(),
      daily_limit_mode: c.daily_limit_mode || 'AUTO',
      total_pax: (c.total_pax || 1).toString(),
      total_monthly_limit: (c.total_monthly_limit || 0).toString(),
      status: c.status,
      credit_status: c.credit_status || 'ACTIVE',
      auto_sale_cfg: c.auto_sale_cfg === 1,
      auto_credit_product_id: c.auto_credit_product_id || '',
      working_place: c.working_place || '',
      emp_id: c.emp_id || '',
      passport_no: c.passport_no || '',
      auto_burn: !!c.auto_burn,
      auto_burn_start_date: c.auto_burn_start_date ? c.auto_burn_start_date.split('T')[0] : '',
      auto_burn_stop_date: c.auto_burn_stop_date ? c.auto_burn_stop_date.split('T')[0] : ''
    });
    setShowForm(true);
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/credit-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ multiplier: Number(multiplier) })
      });
      const data = await res.json();
      if (data.success) setShowSettings(false);
    } catch (err) { alert('Error saving settings'); }
    finally { setLoading(false); }
  };

  const fetchCreditManageData = async (customerId: any) => {
    try {
      const [histRes, logsRes] = await Promise.all([
        fetch(`/api/admin/customers/${customerId}/limit-history`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/admin/customers/${customerId}/status-logs`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const histData = await histRes.json();
      const logsData = await logsRes.json();
      if (histData.success) setCreditHistory(histData.data);
      if (logsData.success) setStatusLogs(logsData.data);
    } catch (err) { console.error(err); }
  };

  const fetchAutoBurnData = async (customerId: any) => {
    try {
        const res = await fetch(`/api/customers/${customerId}/auto-burn-logs`, { headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) setAutoBurnHistory(data.data);
    } catch (err) { console.error(err); }
  };


  const updateCreditStatus = async (customerId: any, newStatus: string) => {
    const reason = prompt(`Reason for changing status to ${newStatus}:`);
    if (reason === null) return;
    /* setLoading removed to prevent flicker */
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/credit-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_status: newStatus, reason })
      });
      const data = await res.json();
      if (data.success) {
        setShowManageCredit({ ...showManageCredit, credit_status: newStatus });
        fetchCustomers();
        fetchCreditManageData(customerId);
      }
    } catch (err) { alert('Error updating status'); }
    finally { setLoading(false); }
  };

  const updateCreditLimitManually = async (customerId: any) => {
    const newLimitStr = prompt('Enter new credit limit (Manual update):');
    if (newLimitStr === null) return;
    const newLimit = parseFloat(newLimitStr);
    if (isNaN(newLimit)) return alert('Invalid number');
    
    const reason = prompt('Reason for manual limit update:');
    if (reason === null) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/update-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ new_limit: newLimit, reason })
      });
      const data = await res.json();
      if (data.success) {
        setShowManageCredit({ ...showManageCredit, credit_limit: newLimit });
        fetchCustomers();
        fetchCreditManageData(customerId);
      }
    } catch (err) { alert('Error updating limit'); }
    finally { setLoading(false); }
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.rfid_card && c.rfid_card.includes(search))
  );

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by name or RFID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowImportModal(true)}
                className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded transition-all flex items-center gap-2 shadow-sm font-black"
            >
                <UploadCloud className="w-3.5 h-3.5 text-indigo-500" /> Bulk Upload
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-4 py-2 rounded transition-all flex items-center gap-2 shadow-sm"
            >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" /> Member Rules
            </button>
            <button 
                onClick={() => {
                   setFormData({ 
                     id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', 
                     daily_limit: '0', daily_limit_mode: 'AUTO', monthly_limit: '0', 
                     total_pax: '1', total_monthly_limit: '0',
                     status: 'active', credit_status: 'ACTIVE', auto_sale_cfg: false,
                     working_place: '', emp_id: '', passport_no: '', 
                     auto_burn: false, auto_burn_start_date: '', auto_burn_stop_date: '' 
                   });
                   setShowForm(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
            >
                <Plus className="w-3.5 h-3.5" /> Add Member (Delivery food)
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && customers.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">Syncing database list...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center w-12">SL</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">EMP ID</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Member Profile</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Working Place</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Passport No</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">RFID Number</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Contact Number</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Total Limit</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Monthly Limit</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Daily Limit</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Auto Burn Status</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Auto Credit Products</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Start Date</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">End Date</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">Total Credited</th>
                <th className="py-4 px-6 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {filtered.map((c, idx) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-500 text-center">
                    {idx + 1}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-400">
                    <div className="flex items-center gap-1.5">{c.emp_id || '-'}</div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className="text-slate-900 font-black">{c.name}</div>
                    <div className="flex gap-2 mt-0.5">
                        {c.credit_status === 'SUSPENDED' && <span className="text-orange-600 text-[8px] font-black italic underline decoration-transparent underline-offset-2 tracking-widest">SUSPENDED</span>}
                        {c.credit_status === 'CLOSED' && <span className="text-red-600 text-[8px] font-black italic underline decoration-transparent underline-offset-2 tracking-widest">CLOSED</span>}
                        {c.credit_status === 'ACTIVE' && <span className="text-emerald-600 text-[8px] font-black italic tracking-widest">ACTIVE</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-400">
                    <div className="flex items-center gap-1.5">{c.working_place || '-'}</div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-400">
                    <div className="flex items-center gap-1.5">{c.passport_no || '-'}</div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-indigo-600">
                    {c.rfid_card || 'NONE'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-700">
                    {c.phone || 'NONE'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center">
                    <span className="text-teal-600 font-black">{currency.symbol}{c.credit_limit}</span>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center">
                    <span className="text-slate-900">{currency.symbol}{c.monthly_limit}</span>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center">
                    <span className="text-slate-900">{currency.symbol}{c.daily_limit}</span>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-400 text-center">
                    <div className="flex justify-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] tracking-widest w-fit ${c.auto_burn ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                        {c.auto_burn ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center text-slate-700">
                    {products.find(p => p.id.toString() === c.auto_credit_product_id?.toString())?.name || '-'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center text-slate-500">
                    {c.auto_burn && c.auto_burn_start_date ? new Date(c.auto_burn_start_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center text-slate-500">
                    {c.auto_burn && c.auto_burn_stop_date ? new Date(c.auto_burn_stop_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-center text-slate-700">
                    {currency.symbol}{(c.auto_burn_total || 0).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setShowManageCredit(c); fetchCreditManageData(c.id); }} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Manage Credit"><ShieldAlert className="w-4 h-4" /></button>
                      <button onClick={() => { setShowAutoBurnLogs(c); fetchAutoBurnData(c.id); }} className="p-1.5 text-slate-400 hover:text-indigo-650 animate-pulse" title="View Auto Burn Logs"><History className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-600"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                   <td colSpan={16} className="py-20 text-center font-black text-slate-300 tracking-[0.5em]">NO MEMBERS FOUND</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>



      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-slate-900/40 backdrop-blur-sm">
           <div className="w-full max-w-2xl bg-white border border-slate-200 rounded flex flex-col relative animate-in fade-in zoom-in-95 shadow-2xl">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between rounded-t">
                 <h2 className="text-slate-800 font-black">{formData.id ? 'Edit Member (Delivery food)' : 'Add New Member (Delivery food)'}</h2>
                 <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-200 text-slate-500 transition-colors rounded"><X size={16}/></button>
              </div>
              <div className="p-6 overflow-auto max-h-[80vh]">
                 <form id="customerForm" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Full Name</label>
                        <input type="text" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1 relative group">
                        <label className="text-slate-500 text-[9px] font-black uppercase flex justify-between items-center">
                            <span>RFID Card</span>
                            <button type="button" onClick={() => document.getElementById('rfid_input')?.focus()} className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors bg-indigo-50 px-1.5 py-0.5 rounded">
                                <Scan className="w-3 h-3" /> SCAN
                            </button>
                        </label>
                        <input 
                            id="rfid_input" 
                            type="text" 
                            value={formData.rfid_card || ''} 
                            onChange={e => setFormData({...formData, rfid_card: e.target.value})} 
                            onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); e.currentTarget.blur(); } }} 
                            placeholder="Select and scan card..." 
                            className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 transition-colors bg-white" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Phone Number</label>
                        <input type="text" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Total Credit Limit</label>
                        <input type="number" step="0.01" value={formData.credit_limit || ''} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Monthly Limit Per Pax</label>
                        <input type="number" step="0.01" value={formData.monthly_limit || ''} onChange={e => setFormData({...formData, monthly_limit: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Total Pax</label>
                        <input type="number" value={formData.total_pax || '1'} onChange={e => setFormData({...formData, total_pax: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Total Monthly Limit</label>
                        <input type="number" readOnly value={formData.total_monthly_limit || ''} className="w-full border border-slate-200 text-indigo-600 px-3 py-1.5 rounded outline-none bg-slate-50 font-black" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase flex justify-between">
                            <span>Daily Limit</span>
                            <div className="flex gap-2">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" className="w-2.5 h-2.5" checked={formData.daily_limit_mode === 'AUTO'} onChange={() => setFormData({...formData, daily_limit_mode: 'AUTO'})} />
                                    <span className="text-[7px]">AUTO</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input type="radio" className="w-2.5 h-2.5" checked={formData.daily_limit_mode === 'MANUAL'} onChange={() => setFormData({...formData, daily_limit_mode: 'MANUAL'})} />
                                    <span className="text-[7px]">MANUAL</span>
                                </label>
                            </div>
                        </label>
                        <input 
                            type="number" step="0.01" 
                            readOnly={formData.daily_limit_mode === 'AUTO'}
                            value={formData.daily_limit || ''} 
                            onChange={e => setFormData({...formData, daily_limit: e.target.value})} 
                            className={`w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold ${formData.daily_limit_mode === 'AUTO' ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`} 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Working Place</label>
                        <input type="text" value={formData.working_place || ''} onChange={e => setFormData({...formData, working_place: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Employee ID</label>
                        <input type="text" value={formData.emp_id || ''} onChange={e => setFormData({...formData, emp_id: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Passport No</label>
                        <input type="text" value={formData.passport_no || ''} onChange={e => setFormData({...formData, passport_no: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1 col-span-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                checked={formData.auto_burn} 
                                onChange={e => setFormData({...formData, auto_burn: e.target.checked})} 
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-slate-800 text-[11px] font-black uppercase">Auto Burn</span>
                                <span className="text-slate-500 text-[9px]">Enable auto deduction mode for this member</span>
                            </div>
                        </label>
                    </div>
                    {formData.auto_burn && (
                        <>
                            <div className="space-y-1">
                                <label className="text-slate-500 text-[9px] font-black uppercase">Auto Burn Start Date</label>
                                <input type="date" value={formData.auto_burn_start_date || ''} onChange={e => setFormData({...formData, auto_burn_start_date: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-slate-500 text-[9px] font-black uppercase">Auto Burn Stop Date</label>
                                <input type="date" value={formData.auto_burn_stop_date || ''} onChange={e => setFormData({...formData, auto_burn_stop_date: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                            </div>
                        </>
                    )}
                    <div className="space-y-1 col-span-2">
                       <label className="text-slate-500 text-[9px] font-black uppercase">Auto Credit Products</label>
                       <select
                           value={formData.auto_credit_product_id || ''}
                           onChange={e => setFormData({...formData, auto_credit_product_id: e.target.value})}
                           className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                       >
                           <option value="">Select product...</option>
                           {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-1 col-span-2 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer p-2 border border-slate-200 rounded hover:bg-slate-50 transition-colors select-none">
                            <input 
                                type="checkbox" 
                                checked={formData.auto_sale_cfg} 
                                onChange={e => setFormData({...formData, auto_sale_cfg: e.target.checked})} 
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                            />
                            <div className="flex flex-col">
                                <span className="text-slate-800 text-[11px] font-black uppercase">Auto Sale Mode</span>
                                <span className="text-slate-500 text-[9px]">Automatically process member sales when card is scanned</span>
                            </div>
                        </label>
                    </div>
                    {formData.id && (
                        <>
                            <div className="space-y-1">
                                <label className="text-slate-500 text-[9px] font-black uppercase">Account Status</label>
                                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-slate-500 text-[9px] font-black uppercase">Credit Status</label>
                                <select value={formData.credit_status} onChange={e => setFormData({...formData, credit_status: e.target.value})} className="w-full border border-slate-200 text-indigo-600 font-black px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 uppercase italic bg-white">
                                    <option value="ACTIVE">Active</option>
                                    <option value="SUSPENDED">Suspended</option>
                                    <option value="CLOSED">Closed</option>
                                </select>
                            </div>
                        </>
                    )}
                 </form>
              </div>
              <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 rounded-b">
                 <button onClick={() => setShowForm(false)} className="px-4 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors uppercase outline-none focus:ring-2 focus:ring-slate-400 rounded">Cancel</button>
                 <button form="customerForm" disabled={loading} type="submit" className="px-4 py-1.5 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 transition-colors uppercase flex items-center gap-2 outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded">
                     {loading ? 'Saving...' : 'Save Member'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {showPaymentFor && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
           <div className="w-full max-w-sm bg-white border border-slate-200 rounded shadow-2xl relative animate-in fade-in zoom-in-95">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                 <span className="font-black text-slate-900">Payment Settlement</span>
                 <button onClick={() => setShowPaymentFor(null)} className="text-slate-400 hover:text-slate-700 transition"><X size={16}/></button>
              </div>
              <div className="p-6">
                 <div className={`mb-6 p-4 ${showPaymentFor.current_balance > 0 ? 'bg-red-50 border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'} border rounded text-center`}>
                    <span className="text-slate-500 font-black text-[8px] uppercase tracking-widest block mb-1">
                      {showPaymentFor.current_balance > 0 ? 'Current Outstanding Debt' : 'Outstanding Debt'}
                    </span>
                    <span className="text-2xl font-black italic tracking-tighter block">
                      {currency.symbol}{showPaymentFor.current_balance.toFixed(2)}
                    </span>
                    {showPaymentFor.current_balance <= 0 && (
                      <p className="text-[7px] text-emerald-600 font-black mt-2 tracking-wider leading-relaxed">
                        THIS MEMBER HAS NO OUTSTANDING DEBT. Settle payments anyway to pre-fund/credit their limits.
                      </p>
                    )}
                    {showPaymentFor.current_balance > 0 && (
                      <p className="text-[7px] text-red-500 font-black mt-2 tracking-wider leading-relaxed">
                        Use this to register payment received toward clearing member's credit balance.
                      </p>
                    )}
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-1 text-center">
                       <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Payment Amount</label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black">{currency.symbol}</span>
                          <input 
                            type="number" step="0.01" 
                            value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} 
                            autoFocus 
                            className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-8 pr-4 py-3 rounded outline-none focus:ring-1 focus:ring-emerald-500 text-xl font-black text-center" 
                          />
                       </div>
                    </div>
                    <button onClick={handlePayment} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded text-xs tracking-[0.2em] transition-all disabled:opacity-50">Process Payment</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showAutoBurnLogs && (() => {
        const filteredLogs = autoBurnHistory.filter(h => h.created_at.startsWith(selectedMonth));
        return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 bg-slate-900/40 backdrop-blur-md">
           <div className="w-full max-w-3xl h-[80vh] bg-white border border-slate-200 rounded shadow-2xl flex flex-col relative animate-in fade-in slide-in-from-bottom-4">
               <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <span className="font-black text-slate-900 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded">Auto Burn Audit Logs : {showAutoBurnLogs.name}</span>
                  <div className="flex items-center gap-2">
                     <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="text-[10px] p-1 border rounded" />
                     <button onClick={() => setShowAutoBurnLogs(null)} className="text-slate-500 hover:text-slate-900 transition"><X size={18}/></button>
                  </div>
               </div>
               <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 text-[9px] font-black uppercase">
                        <tr>
                            <th className="p-2 border-b border-slate-200">Date</th>
                            <th className="p-2 border-b border-slate-200">Amount</th>
                            <th className="p-2 border-b border-slate-200">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {filteredLogs.map((h, i) => (
                            <tr key={i} className="text-[9px] text-slate-700 font-black tracking-widest">
                                <td className="p-2">{new Date(h.created_at).toLocaleString()}</td>
                                <td className="p-2 text-indigo-600">{currency.symbol}{Number(h.amount).toFixed(2)}</td>
                                <td className="p-2">{h.status}</td>
                            </tr>
                        ))}
                    </tbody>
                  </table>
                  {filteredLogs.length === 0 && <div className="py-20 text-center text-slate-400 tracking-[0.5em] font-black">NO AUTO BURN LOGS FOUND FOR THIS MONTH</div>}
               </div>
               <div className="p-3 border-t border-slate-200 bg-slate-50 text-right">
                    <span className="text-slate-900 font-black tracking-widest">TOTAL BURNED: {currency.symbol}{filteredLogs.reduce((s, h) => s + Number(h.amount), 0).toFixed(2)}</span>
               </div>
           </div>
        </div>
        );
      })()}

      {showManageCredit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <div className="w-full max-w-5xl h-[85vh] bg-white border border-slate-200 rounded shadow-2xl flex flex-col relative animate-in fade-in slide-in-from-bottom-4">
               <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                     <span className="font-black text-slate-900 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded">Member Credit Audit : {showManageCredit.name}</span>
                     <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${showManageCredit.credit_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{showManageCredit.credit_status}</span>
                  </div>
                  <button onClick={() => setShowManageCredit(null)} className="text-slate-400 hover:text-slate-900 transition"><X size={18}/></button>
               </div>
               
               <div className="flex-1 overflow-hidden grid grid-cols-12">
                   {/* Left Panel: Control */}
                   <div className="col-span-3 border-r border-slate-200 p-4 space-y-6 flex flex-col bg-slate-50">
                       <div className="space-y-3">
                           <h4 className="text-slate-500 font-black text-[9px] tracking-widest border-b border-slate-200 pb-2">Status Control</h4>
                           <div className="grid gap-2">
                               {showManageCredit.credit_status === 'ACTIVE' ? (
                                 <button onClick={() => updateCreditStatus(showManageCredit.id, 'SUSPENDED')} className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded font-black text-[9px] transition-all tracking-widest uppercase italic">Suspend Account</button>
                               ) : (
                                 <button onClick={() => updateCreditStatus(showManageCredit.id, 'ACTIVE')} className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded font-black text-[9px] transition-all tracking-widest uppercase italic">Reactivate Account</button>
                               )}
                               <button onClick={() => updateCreditStatus(showManageCredit.id, 'CLOSED')} className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-250 rounded font-black text-[9px] transition-all tracking-widest uppercase italic justify-center">Close Account</button>
                           </div>
                       </div>
                       
                       <div className="space-y-3">
                           <h4 className="text-slate-500 font-black text-[9px] tracking-widest border-b border-slate-200 pb-2">Manual Adjustment</h4>
                           <div className="p-3 bg-white border border-slate-200 rounded text-center">
                               <div className="text-slate-500 text-[8px] font-black uppercase mb-1">Current Limit</div>
                               <div className="text-xl font-black text-slate-900 italic tracking-tighter">{currency.symbol}{showManageCredit.credit_limit}</div>
                               <button onClick={() => updateCreditLimitManually(showManageCredit.id)} className="mt-3 text-[8px] font-black text-indigo-600 uppercase tracking-widest hover:underline hover:text-indigo-800">Change Limit</button>
                           </div>
                       </div>
                   </div>

                   {/* Right Panel: Audit Logs */}
                   <div className="col-span-9 flex flex-col overflow-hidden bg-slate-50/30">
                       <div className="flex-1 overflow-hidden grid grid-rows-2">
                           {/* Limit history */}
                           <div className="flex flex-col border-b border-slate-200">
                               <div className="p-2 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 tracking-widest">Limit Change History</div>
                               <div className="flex-1 overflow-auto p-4 space-y-2 custom-scrollbar">
                                   {creditHistory.map((h, i) => (
                                     <div key={i} className="bg-white border border-slate-200 p-2 flex justify-between items-center text-[9px] font-black tracking-widest rounded shadow-sm">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-4">
                                                <span className="text-slate-400 line-through decoration-slate-250">{currency.symbol}{h.old_limit}</span>
                                                <span className="text-emerald-600 animate-pulse">→ {currency.symbol}{h.new_limit}</span>
                                            </div>
                                            <span className="text-slate-500 italic opacity-85 tracking-tighter">REASON: {h.reason}</span>
                                        </div>
                                        <span className="text-slate-400 font-bold">{new Date(h.created_at).toISOString().split('T')[0]}</span>
                                     </div>
                                   ))}
                                   {creditHistory.length === 0 && <div className="py-20 text-center text-slate-400 tracking-[0.5em] font-black">NO HISTORY FOUND</div>}
                               </div>
                           </div>
                           {/* Status logs */}
                           <div className="flex flex-col">
                               <div className="p-2 bg-slate-50 border-b border-slate-200 text-[9px] font-black text-slate-500 tracking-widest">Status Change History</div>
                               <div className="flex-1 overflow-auto p-4 space-y-2 custom-scrollbar">
                                   {statusLogs.map((l, i) => (
                                     <div key={i} className="bg-white border border-slate-200 p-2 flex justify-between items-center text-[9px] font-black tracking-widest rounded shadow-sm">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-4 capitalize">
                                                <span className="text-slate-400">{l.previous_status}</span>
                                                <span className="text-orange-600">→ {l.new_status}</span>
                                            </div>
                                            <span className="text-slate-500 italic opacity-85 tracking-tighter">REASON: {l.reason} <span className="not-italic text-slate-450">| BY: {l.changed_by_user}</span></span>
                                        </div>
                                        <span className="text-slate-400 font-bold">{new Date(l.created_at).toISOString().split('T')[0]}</span>
                                     </div>
                                   ))}
                                   {statusLogs.length === 0 && <div className="py-10 text-center text-slate-400 tracking-[0.5em] font-black">NO HISTORY FOUND</div>}
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 bg-slate-900/40 backdrop-blur-sm">
           <div className="w-full max-w-sm bg-white border border-slate-200 rounded shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                 <span className="font-black text-slate-900 uppercase tracking-widest">Credit Settings</span>
                 <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-900 transition"><X size={16}/></button>
              </div>
              <div className="p-6 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Credit Increase Ratio</label>
                    <div className="flex items-center gap-3">
                       <input 
                        type="number" step="0.1" 
                        value={multiplier} onChange={e => setMultiplier(e.target.value)} 
                        className="flex-1 bg-slate-50 border border-slate-200 text-slate-900 px-3 py-2 rounded outline-none focus:ring-1 focus:ring-indigo-500 text-xl font-black text-center italic"
                       />
                       <span className="text-slate-400 font-black text-xl">x</span>
                    </div>
                    <p className="text-[8px] text-slate-500 font-bold leading-relaxed tracking-tighter">Calculates how much credit limit increases when debt is paid (Amount * {multiplier})</p>
                 </div>
                 <button onClick={saveSettings} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded text-xs tracking-widest uppercase transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/10">Save Settings</button>
              </div>
           </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-100/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <span className="text-slate-900 font-black tracking-widest text-[10px]">Customer Bulk Upload</span>
                    <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={16}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50 relative group hover:border-indigo-300 transition-all rounded-lg">
                         <UploadCloud className="w-8 h-8 mx-auto text-slate-300 mb-2 group-hover:text-indigo-400 transition-colors" />
                         <div className="text-slate-400 text-[8px] font-black uppercase tracking-[0.3em]">Select CSV File</div>
                         <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                         {importFile && <div className="mt-4 text-emerald-600 font-black italic underline underline-offset-4 decoration-emerald-200 text-[10px] break-all">{importFile.name}</div>}
                    </div>
                    
                    <a 
                      href={`data:text/csv;charset=utf-8,${encodeURIComponent('name,rfid_card,phone,credit_limit,daily_limit,monthly_limit,working_place,emp_id,passport_no,auto_burn,auto_burn_start_date,auto_burn_stop_date\nJohn Doe,RFID123456,0123456789,1000,50,500,Office,EMP001,P1234567,true,2026-01-01,2026-12-31')}`}
                      download="member_sample.csv"
                      className="block text-center py-2 bg-slate-100 text-slate-600 font-black text-[8px] tracking-widest hover:bg-slate-200 transition-all rounded border border-slate-200 uppercase"
                    >
                      Download Sample CSV
                    </a>

                    {importStatus && (
                      <div className={`text-[10px] font-bold p-3 border rounded whitespace-pre-wrap ${importStatus.includes('Error') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-indigo-50 text-indigo-600 border-indigo-200'}`}>
                        {importStatus}
                      </div>
                    )}

                    <button 
                        onClick={async () => {
                          if (!importFile) return alert('Select a file first');
                          setImportLoading(true);
                          setImportStatus('Parsing data...');
                          
                          Papa.parse(importFile, {
                            header: true,
                            skipEmptyLines: true,
                            complete: async (results) => {
                              try {
                                const errors: string[] = [];
                                const customersToImport: any[] = [];
                                
                                const existingRfids = new Set(customers.map(c => c.rfid_card).filter(Boolean));

                                results.data.forEach((row: any, index: number) => {
                                  const rowNum = index + 2; // header is row 1
                                  
                                  if (!row.name || row.name.toString().trim() === '') {
                                    errors.push(`Row ${rowNum}: 'name' is required`);
                                  }
                                  
                                  if (row.rfid_card && existingRfids.has(row.rfid_card)) {
                                    errors.push(`Row ${rowNum}: rfid_card '${row.rfid_card}' already exists`);
                                  }

                                  const creditLimit = parseFloat(row.credit_limit);
                                  if (row.credit_limit && isNaN(creditLimit)) errors.push(`Row ${rowNum}: 'credit_limit' formatting error`);
                                  
                                  const dailyLimit = parseFloat(row.daily_limit);
                                  if (row.daily_limit && isNaN(dailyLimit)) errors.push(`Row ${rowNum}: 'daily_limit' formatting error`);

                                  const monthlyLimit = parseFloat(row.monthly_limit);
                                  if (row.monthly_limit && isNaN(monthlyLimit)) errors.push(`Row ${rowNum}: 'monthly_limit' formatting error`);
                                  
                                  const autoBurnStr = String(row.auto_burn).toLowerCase();
                                  if (row.auto_burn && !['true', 'false', '1', '0', ''].includes(autoBurnStr)) {
                                    errors.push(`Row ${rowNum}: 'auto_burn' must be TRUE/FALSE`);
                                  }

                                  customersToImport.push({
                                    name: row.name || '',
                                    rfid_card: row.rfid_card || '',
                                    phone: row.phone || '',
                                    credit_limit: isNaN(creditLimit) ? 0 : creditLimit,
                                    daily_limit: isNaN(dailyLimit) ? 0 : dailyLimit,
                                    monthly_limit: isNaN(monthlyLimit) ? 0 : monthlyLimit,
                                    working_place: row.working_place || '',
                                    emp_id: row.emp_id || '',
                                    passport_no: row.passport_no || '',
                                    auto_burn: autoBurnStr === 'true' || autoBurnStr === '1',
                                    auto_burn_start_date: row.auto_burn_start_date || '',
                                    auto_burn_stop_date: row.auto_burn_stop_date || '',
                                    member_type: 'DELIVERY'
                                  });
                                });

                                if (errors.length > 0) {
                                  setImportStatus(`Error: Validation failed\n${errors.join('\n')}`);
                                  setImportLoading(false);
                                  return;
                                }

                                const res = await fetch('/api/customers/bulk', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                  body: JSON.stringify({ customers: customersToImport })
                                });

                                const data = await res.json();
                                if (data.success) {
                                  setImportStatus(`Success! ${data.message}`);
                                  setTimeout(() => {
                                    setShowImportModal(false);
                                    setImportFile(null);
                                    setImportStatus(null);
                                    fetchCustomers();
                                  }, 2000);
                                } else {
                                  setImportStatus(`Error: ${data.message}`);
                                }
                              } catch (err: any) {
                                setImportStatus(`Error: Import failed - ${err.message}`);
                              } finally {
                                setImportLoading(false);
                              }
                            }
                          });
                        }}
                        disabled={!importFile || importLoading}
                        className="w-full py-4 bg-indigo-600 text-white font-black text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-30 transition-all rounded shadow-lg shadow-indigo-500/20 uppercase"
                    >
                        {importLoading ? 'Processing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
