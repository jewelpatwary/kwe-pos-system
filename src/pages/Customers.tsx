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
  const [creditHistory, setCreditHistory] = useState<any[]>([]);
  const [statusLogs, setStatusLogs] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [multiplier, setMultiplier] = useState('1.0');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', daily_limit: '0', monthly_limit: '0', status: 'active', credit_status: 'ACTIVE', auto_sale_cfg: false
  });

  // Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setCustomers(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
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
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
          auto_sale_cfg: formData.auto_sale_cfg
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
      status: c.status,
      credit_status: c.credit_status || 'ACTIVE',
      auto_sale_cfg: c.auto_sale_cfg === 1
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

  const updateCreditStatus = async (customerId: any, newStatus: string) => {
    const reason = prompt(`Reason for changing status to ${newStatus}:`);
    if (reason === null) return;
    setLoading(true);
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
                <UploadCloud className="w-3.5 h-3.5 text-indigo-500" /> BULK_UPLOAD
            </button>
            <button 
                onClick={() => setShowSettings(true)}
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 px-4 py-2 rounded transition-all flex items-center gap-2 shadow-sm"
            >
                <ShieldAlert className="w-3.5 h-3.5 text-orange-500" /> Member Rules
            </button>
            <button 
                onClick={() => {
                   setFormData({ id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', daily_limit: '0', monthly_limit: '0', status: 'active', credit_status: 'ACTIVE', auto_sale_cfg: false });
                   setShowForm(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
            >
                <Plus className="w-3.5 h-3.5" /> Add Member
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && customers.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">SYNCING_CUSTOMER_DATABASE...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">Member Name</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Card & Contact</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Credit Limits</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Balance</th>
                <th className="py-4 px-6 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className="text-slate-900 font-black">{c.name}</div>
                    <div className="flex gap-2 mt-0.5">
                        {c.credit_status === 'SUSPENDED' && <span className="text-orange-600 text-[8px] font-black italic underline decoration-transparent underline-offset-2 tracking-widest">SUSPENDED</span>}
                        {c.credit_status === 'CLOSED' && <span className="text-red-600 text-[8px] font-black italic underline decoration-transparent underline-offset-2 tracking-widest">CLOSED</span>}
                        {c.credit_status === 'ACTIVE' && <span className="text-emerald-600 text-[8px] font-black italic tracking-widest">ACTIVE</span>}
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-black text-slate-400">
                    <div className="flex items-center gap-1.5"><span className="text-slate-300">RFID:</span> {c.rfid_card || 'NONE'}</div>
                    <div className="flex items-center gap-1.5"><span className="text-slate-300">TEL:</span> {c.phone || 'NONE'}</div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-slate-500">
                    <div className="grid grid-cols-2 gap-x-4">
                        <span>MONTHLY: <span className="text-slate-900">{currency.symbol}{c.monthly_limit}</span></span>
                        <span>DAILY: <span className="text-slate-900">{currency.symbol}{c.daily_limit}</span></span>
                        <span className="col-span-2">TOTAL LIMIT: <span className="text-teal-600 font-black">{currency.symbol}{c.credit_limit}</span></span>
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className={c.current_balance > 0 ? 'text-red-600  font-black' : 'text-emerald-600  font-black'}>
                        {currency.symbol}{c.current_balance.toFixed(2)}
                    </div>
                    <div className="w-full max-w-[80px] h-0.5 bg-slate-100 mt-1 overflow-hidden relative">
                         <div 
                            className="absolute left-0 h-full bg-indigo-500 transition-all duration-1000" 
                            style={{ width: `${Math.min(100, (c.current_balance / (c.credit_limit || 1)) * 100)}%` }} 
                        />
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setShowManageCredit(c); fetchCreditManageData(c.id); }} className="p-1.5 text-slate-400 hover:text-indigo-600" title="Manage Credit"><ShieldAlert className="w-4 h-4" /></button>
                      <button onClick={() => setShowPaymentFor(c)} disabled={c.current_balance <= 0} className="p-1.5 text-slate-400 hover:text-emerald-600 disabled:opacity-30" title="Accept Payment"><DollarSign className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-600"><Edit2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                   <td colSpan={5} className="py-20 text-center font-black text-slate-300 tracking-[0.5em]">NO MEMBERS FOUND</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div>MEMBER DIRECTORY • {customers.length} REGISTERED MEMBERS</div>
         <div>SYSTEM ACTIVE • {new Date().toISOString()}</div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-slate-900/40 backdrop-blur-sm">
           <div className="w-full max-w-2xl bg-white border border-slate-200 rounded flex flex-col relative animate-in fade-in zoom-in-95 shadow-2xl">
              <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between rounded-t">
                 <h2 className="text-slate-800 font-black">{formData.id ? 'Edit Member' : 'Add New Member'}</h2>
                 <button onClick={() => setShowForm(false)} className="p-1 hover:bg-slate-200 text-slate-500 transition-colors rounded"><X size={16}/></button>
              </div>
              <div className="p-6 overflow-auto max-h-[80vh]">
                 <form id="customerForm" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Full Name</label>
                        <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
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
                            value={formData.rfid_card} 
                            onChange={e => setFormData({...formData, rfid_card: e.target.value})} 
                            onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); e.currentTarget.blur(); } }} 
                            placeholder="Select and scan card..." 
                            className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500/50 transition-colors bg-white" 
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Phone Number</label>
                        <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Total Credit Limit</label>
                        <input type="number" step="0.01" value={formData.credit_limit} onChange={e => setFormData({...formData, credit_limit: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Monthly Limit</label>
                        <input type="number" step="0.01" value={formData.monthly_limit} onChange={e => setFormData({...formData, monthly_limit: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-slate-500 text-[9px] font-black uppercase">Daily Limit</label>
                        <input type="number" step="0.01" value={formData.daily_limit} onChange={e => setFormData({...formData, daily_limit: e.target.value})} className="w-full border border-slate-200 text-slate-900 px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-bold bg-white" />
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 bg-[#0f1117]/90 backdrop-blur-sm">
           <div className="w-full max-w-sm bg-[#181a20] border border-[#2d303b] rounded shadow-2xl relative animate-in fade-in zoom-in-95">
              <div className="p-3 border-b border-[#2d303b] bg-[#1c1f26] flex items-center justify-between">
                 <span className="font-black text-white">Payment Settlement</span>
                 <button onClick={() => setShowPaymentFor(null)} className="text-slate-500 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-6">
                 <div className="mb-6 p-4 bg-[#0f1117] border border-[#2d303b] text-center">
                    <span className="text-slate-500 font-black text-[8px] uppercase tracking-widest block mb-1">Current Debt</span>
                    <span className="text-2xl font-black text-red-500 italictracking-tighter">{currency.symbol}{showPaymentFor.current_balance.toFixed(2)}</span>
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-1 text-center">
                       <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Payment Amount</label>
                       <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 font-black">{currency.symbol}</span>
                          <input 
                            type="number" step="0.01" 
                            value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} 
                            autoFocus 
                            className="w-full bg-[#2d303b] border-[#3b404d] text-white pl-8 pr-4 py-3 rounded outline-none focus:ring-1 focus:ring-emerald-500 text-xl font-black text-center" 
                          />
                       </div>
                    </div>
                    <button onClick={handlePayment} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded text-xs tracking-[0.2em] transition-all disabled:opacity-50">Process Payment</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showManageCredit && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 bg-[#0f1117]/90 backdrop-blur-md">
           <div className="w-full max-w-5xl h-[85vh] bg-[#181a20] border border-[#2d303b] rounded shadow-2xl flex flex-col relative animate-in fade-in slide-in-from-bottom-4">
               <div className="p-3 border-b border-[#2d303b] bg-[#1c1f26] flex items-center justify-between">
                  <div className="flex gap-4 items-center">
                     <span className="font-black text-white px-3 py-1 bg-indigo-600/20 border border-indigo-500/30 rounded">Member Credit Audit : {showManageCredit.name}</span>
                     <span className={`text-[8px] font-black italic underline decoration-offset-4 ${showManageCredit.credit_status === 'ACTIVE' ? 'text-emerald-400 decoration-emerald-900' : 'text-red-400 decoration-red-900'}`}>{showManageCredit.credit_status}</span>
                  </div>
                  <button onClick={() => setShowManageCredit(null)} className="text-slate-500 hover:text-white transition"><X size={18}/></button>
               </div>
               
               <div className="flex-1 overflow-hidden grid grid-cols-12">
                   {/* Left Panel: Control */}
                   <div className="col-span-3 border-r border-[#2d303b] p-4 space-y-6 flex flex-col bg-[#1c1f26]/20">
                       <div className="space-y-3">
                           <h4 className="text-slate-500 font-black text-[9px] tracking-widest border-b border-[#2d303b] pb-2">Status Control</h4>
                           <div className="grid gap-2">
                               {showManageCredit.credit_status === 'ACTIVE' ? (
                                 <button onClick={() => updateCreditStatus(showManageCredit.id, 'SUSPENDED')} className="w-full py-2 bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/20 rounded font-black text-[9px] transition-all tracking-widest uppercase italic">Suspend Account</button>
                               ) : (
                                 <button onClick={() => updateCreditStatus(showManageCredit.id, 'ACTIVE')} className="w-full py-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded font-black text-[9px] transition-all tracking-widest uppercase italic">Reactivate Account</button>
                               )}
                               <button onClick={() => updateCreditStatus(showManageCredit.id, 'CLOSED')} className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 rounded font-black text-[9px] transition-all tracking-widest uppercase italic">Close Account</button>
                           </div>
                       </div>
                       
                       <div className="space-y-3">
                           <h4 className="text-slate-500 font-black text-[9px] tracking-widest border-b border-[#2d303b] pb-2">Manual Adjustment</h4>
                           <div className="p-3 bg-[#0f1117] border border-[#2d303b] rounded text-center">
                               <div className="text-slate-600 text-[8px] font-black uppercase mb-1">Current Limit</div>
                               <div className="text-xl font-black text-white italic tracking-tighter">{currency.symbol}{showManageCredit.credit_limit}</div>
                               <button onClick={() => updateCreditLimitManually(showManageCredit.id)} className="mt-3 text-[8px] font-black text-indigo-400 uppercase tracking-widest hover:underline decoration-indigo-800">Change Limit</button>
                           </div>
                       </div>
                   </div>

                   {/* Right Panel: Audit Logs */}
                   <div className="col-span-9 flex flex-col overflow-hidden bg-[#0f1117]/30">
                       <div className="flex-1 overflow-hidden grid grid-rows-2">
                           {/* Limit history */}
                           <div className="flex flex-col border-b border-[#2d303b]/50">
                               <div className="p-2 bg-[#1c1f26] border-b border-[#2d303b] text-[9px] font-black text-slate-500 tracking-widest">Limit Change History</div>
                               <div className="flex-1 overflow-auto p-4 space-y-2 custom-scrollbar">
                                   {creditHistory.map((h, i) => (
                                     <div key={i} className="bg-[#181a20]/80 border border-[#2d303b]/30 p-2 flex justify-between items-center text-[9px] font-black tracking-widest">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-4">
                                                <span className="text-slate-700 line-through decoration-slate-900">{currency.symbol}{h.old_limit}</span>
                                                <span className="text-emerald-400 animate-pulse">→ {currency.symbol}{h.new_limit}</span>
                                            </div>
                                            <span className="text-slate-500 italic opacity-50 tracking-tighter">REASON: {h.reason}</span>
                                        </div>
                                        <span className="text-slate-700 font-bold">{new Date(h.created_at).toISOString().split('T')[0]}</span>
                                     </div>
                                   ))}
                                   {creditHistory.length === 0 && <div className="py-20 text-center text-slate-800 tracking-[0.5em]">NO HISTORY FOUND</div>}
                               </div>
                           </div>
                           {/* Status logs */}
                           <div className="flex flex-col">
                               <div className="p-2 bg-[#1c1f26] border-b border-[#2d303b] text-[9px] font-black text-slate-500 tracking-widest">Status Change History</div>
                               <div className="flex-1 overflow-auto p-4 space-y-2 custom-scrollbar">
                                   {statusLogs.map((l, i) => (
                                     <div key={i} className="bg-[#181a20]/80 border border-[#2d303b]/30 p-2 flex justify-between items-center text-[9px] font-black tracking-widest">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex gap-4 capitalize">
                                                <span className="text-slate-700">{l.previous_status}</span>
                                                <span className="text-orange-400">→ {l.new_status}</span>
                                            </div>
                                            <span className="text-slate-500 italic opacity-50 tracking-tighter">REASON: {l.reason} <span className="not-italic text-slate-700">| BY: {l.changed_by_user}</span></span>
                                        </div>
                                        <span className="text-slate-700 font-bold">{new Date(l.created_at).toISOString().split('T')[0]}</span>
                                     </div>
                                   ))}
                                   {statusLogs.length === 0 && <div className="py-10 text-center text-slate-800 tracking-[0.5em]">NO HISTORY FOUND</div>}
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 bg-[#0f1117]/90 backdrop-blur-sm">
           <div className="w-full max-w-sm bg-[#181a20] border border-[#2d303b] rounded shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <div className="p-3 border-b border-[#2d303b] bg-[#1c1f26] flex items-center justify-between">
                 <span className="font-black text-white uppercase tracking-widest">Credit Settings</span>
                 <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition"><X size={16}/></button>
              </div>
              <div className="p-6 space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Credit Increase Ratio</label>
                    <div className="flex items-center gap-3">
                       <input 
                        type="number" step="0.1" 
                        value={multiplier} onChange={e => setMultiplier(e.target.value)} 
                        className="flex-1 bg-[#2d303b] border border-[#3b404d] text-white px-3 py-2 rounded outline-none focus:ring-1 focus:ring-indigo-500 text-xl font-black text-center italic"
                       />
                       <span className="text-slate-700 font-black text-xl">x</span>
                    </div>
                    <p className="text-[8px] text-slate-600 font-bold leading-relaxed tracking-tighter">Calculates how much credit limit increases when debt is paid (Amount * {multiplier})</p>
                 </div>
                 <button onClick={saveSettings} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded text-xs tracking-widest uppercase transition-all disabled:opacity-50 shadow-xl shadow-indigo-500/10">Save Settings</button>
              </div>
           </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <span className="text-slate-900 font-black tracking-widest text-[10px]">MEMBER_BULK_UPLOAD</span>
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
                      <div className={`text-[8px] font-black italic tracking-widest p-2 border rounded ${importStatus.includes('Error') ? 'bg-red-50 text-red-500 border-red-100' : 'bg-indigo-50 text-indigo-500 border-indigo-100'}`}>
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
                                const customersToImport = results.data.map((row: any) => ({
                                  name: row.name || '',
                                  rfid_card: row.rfid_card || '',
                                  phone: row.phone || '',
                                  credit_limit: parseFloat(row.credit_limit) || 0,
                                  daily_limit: parseFloat(row.daily_limit) || 0,
                                  monthly_limit: parseFloat(row.monthly_limit) || 0,
                                  working_place: row.working_place || '',
                                  emp_id: row.emp_id || '',
                                  passport_no: row.passport_no || '',
                                  auto_burn: row.auto_burn === 'true' || row.auto_burn === '1',
                                  auto_burn_start_date: row.auto_burn_start_date || '',
                                  auto_burn_stop_date: row.auto_burn_stop_date || ''
                                }));

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
                                setImportStatus(`Import failed: ${err.message}`);
                              } finally {
                                setImportLoading(false);
                              }
                            }
                          });
                        }}
                        disabled={!importFile || importLoading}
                        className="w-full py-4 bg-indigo-600 text-white font-black text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-30 transition-all rounded shadow-lg shadow-indigo-500/20 uppercase"
                    >
                        {importLoading ? 'PROCESSING...' : 'START_IMPORT'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
