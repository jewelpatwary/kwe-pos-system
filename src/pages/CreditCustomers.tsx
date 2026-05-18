import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, CreditCard, Edit2, ShieldAlert, X, DollarSign, Scan, Printer, Trash2, UploadCloud } from 'lucide-react';
import Papa from 'papaparse';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import ConfirmModal from '../components/ConfirmModal';
import PrintPreviewModal from '../components/PrintPreviewModal';

export default function CreditCustomers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<number | null>(null);
  
  // Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', 
    working_place: '', emp_id: '', passport_no: '', 
    daily_limit: '0', monthly_limit: '0', auto_burn: false, auto_burn_start_date: '', auto_burn_stop_date: ''
  });

  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
          // Filter for credit customers if needed, though for now let's show all
          setCustomers(data.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${customerToDelete}`, { 
          method: 'DELETE', 
          headers: { 'Authorization': `Bearer ${token}` } 
      });
      const data = await res.json();
      if(data.success) {
          fetchCustomers();
      } else {
          alert('Failed to delete: ' + data.message);
      }
    } catch (err) {
        console.error(err);
        alert('Error deleting customer');
    } finally {
        setLoading(false);
        setCustomerToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting formData:', formData);

    // Manual validation
    if(!formData.name || !formData.working_place || !formData.emp_id || !formData.passport_no || !formData.monthly_limit || !formData.auto_burn_start_date) {
        alert('Please fill in all required fields: Name, Working Place, Emp ID, Passport No, Monthly Limit, and Auto Burn Start Date.');
        return;
    }

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
          daily_limit: Number(formData.daily_limit || 0),
          monthly_limit: Number(formData.monthly_limit),
          auto_burn: formData.auto_burn ? 1 : 0,
        })
      });
      const data = await res.json();
      console.log('Server response:', data);
      if (data.success) {
        setShowForm(false);
        fetchCustomers();
      } else { alert('Error: ' + data.message); }
    } catch (err) { console.error(err); alert('Error saving customer: ' + err); }
    finally { setLoading(false); }
  };

  const handleImport = async () => {
    if (!importFile) return alert('Select a file first');
    setImportLoading(true);
    setImportStatus('Parsing and validating CSV data...');

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const customers = results.data.map((row: any) => ({
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
            body: JSON.stringify({ customers })
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
      },
      error: (err) => {
        setImportStatus(`Parsing error: ${err.message}`);
        setImportLoading(false);
      }
    });
  };

  const activeCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase">
      <div className="bg-slate-50 border border-slate-200 p-3 flex justify-between items-center mb-4">
        <h1 className="text-sm font-black flex items-center gap-2"><CreditCard className="w-4 h-4"/> Credit Customers</h1>
        <div className="flex gap-2">
            <button onClick={() => setShowPrintModal(true)} className="bg-slate-200 px-3 py-1.5 rounded flex items-center gap-1 font-black"><Printer size={12}/> Print Report</button>
            <button onClick={() => setShowImportModal(true)} className="bg-white border border-slate-200 px-3 py-1.5 rounded flex items-center gap-1 font-black hover:bg-slate-50 transition-colors"><UploadCloud size={12}/> Bulk Upload</button>
            <button onClick={() => { setFormData({ id: '', name: '', rfid_card: '', phone: '', credit_limit: '0', working_place: '', emp_id: '', passport_no: '', monthly_limit: '0', auto_burn: false, auto_burn_start_date: '', auto_burn_stop_date: '' }); setShowForm(true); }} className="bg-indigo-600 text-white px-3 py-1.5 rounded flex items-center gap-1 font-black hover:bg-indigo-700 transition-colors"><Plus size={12}/> Add Credit Member</button>
        </div>
      </div>

       <div className="flex-1 overflow-auto border border-slate-200 bg-white shadow-sm" id="report-content">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="py-3 px-4 font-black">Name</th>
                    <th className="py-3 px-4 font-black">Workplace</th>
                    <th className="py-3 px-4 font-black">Emp ID</th>
                    <th className="py-3 px-4 font-black">Daily Limit</th>
                    <th className="py-3 px-4 font-black">Monthly Limit</th>
                    <th className="py-3 px-4 font-black">Auto Burn</th>
                    <th className="py-3 px-4 font-black no-print">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {activeCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-black">{c.name}</td>
                        <td className="py-3 px-4">{c.working_place || '-'}</td>
                        <td className="py-3 px-4">{c.emp_id || '-'}</td>
                        <td className="py-3 px-4">{c.daily_limit}</td>
                        <td className="py-3 px-4">{c.monthly_limit}</td>
                        <td className="py-3 px-4">{c.auto_burn ? 'YES' : 'NO'}</td>
                        <td className="py-3 px-4 flex gap-2 no-print">
                          <button 
                            onClick={() => { 
                                setFormData({
                                  ...c,
                                  name: c.name || '',
                                  rfid_card: c.rfid_card || '',
                                  phone: c.phone || '',
                                  credit_limit: c.credit_limit?.toString() || '0',
                                  monthly_limit: c.monthly_limit?.toString() || '0',
                                  working_place: c.working_place || '',
                                  emp_id: c.emp_id || '',
                                  passport_no: c.passport_no || '',
                                  daily_limit: c.daily_limit?.toString() || '0',
                                  auto_burn: !!c.auto_burn,
                                  auto_burn_start_date: c.auto_burn_start_date || '',
                                  auto_burn_stop_date: c.auto_burn_stop_date || ''
                                }); 
                                setShowForm(true); 
                              }}
                            className="text-indigo-600 font-bold hover:underline"
                          >
                            Edit
                          </button>
                            <button 
                              onClick={() => setCustomerToDelete(c.id)}
                              className="text-red-600 font-bold hover:underline"
                            >
                              Delete
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
       </div>

       <ConfirmModal 
         isOpen={customerToDelete !== null}
         onClose={() => setCustomerToDelete(null)}
         onConfirm={confirmDeleteCustomer}
         title="Delete Customer"
         message="Are you sure you want to delete this customer? This action cannot be undone."
       />

       <PrintPreviewModal
         isOpen={showPrintModal}
         onClose={() => setShowPrintModal(false)}
         title="Report Preview"
       >
         <h2 className="text-xl font-bold mb-4">Credit Customers Report</h2>
         <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 border-2">
                <tr>
                    <th className="py-2 px-2 border">Name</th>
                    <th className="py-2 px-2 border">Workplace</th>
                    <th className="py-2 px-2 border">Monthly Limit</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {activeCustomers.map(c => (
                    <tr key={c.id}>
                        <td className="py-2 px-2 border">{c.name}</td>
                        <td className="py-2 px-2 border">{c.working_place || '-'}</td>
                        <td className="py-2 px-2 border">{c.monthly_limit}</td>
                    </tr>
                ))}
            </tbody>
        </table>
       </PrintPreviewModal>

       {showForm && (
        <div className="absolute inset-0 z-50 bg-slate-900/50 backdrop-blur-sm p-4 md:p-6 overflow-auto">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-2xl p-6 md:p-8">
                <div className="flex justify-between items-center mb-8 border-b pb-4">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{formData.id ? 'Edit Credit Customer' : 'Add New Credit Customer'}</h2>
                    <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                </div>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Name</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter Full Name" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Working Place</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter Workplace" value={formData.working_place || ''} onChange={e => setFormData({...formData, working_place: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Emp ID</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter Emp ID" type="text" value={formData.emp_id || ''} onChange={e => setFormData({...formData, emp_id: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Passport No</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter Passport No" type="text" value={formData.passport_no || ''} onChange={e => setFormData({...formData, passport_no: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Daily Limit</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" type="number" value={formData.daily_limit} onChange={e => setFormData({...formData, daily_limit: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Monthly Limit</label>
                        <input className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00" type="number" value={formData.monthly_limit} onChange={e => setFormData({...formData, monthly_limit: e.target.value})} />
                    </div>
                    <div className="flex gap-4 items-center pt-5">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto Burn</label>
                        <input type="checkbox" className="w-5 h-5 accent-indigo-600 cursor-pointer" checked={formData.auto_burn} onChange={e => setFormData({...formData, auto_burn: e.target.checked})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto Burn Start Date</label>
                        <input type="date" className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.auto_burn_start_date} onChange={e => setFormData({...formData, auto_burn_start_date: e.target.value})} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Auto Burn Stop Date</label>
                        <input type="date" className="w-full border border-slate-300 rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" value={formData.auto_burn_stop_date} onChange={e => setFormData({...formData, auto_burn_stop_date: e.target.value})} />
                    </div>
                    
                    <button type="submit" className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 text-white py-4 font-black rounded text-sm tracking-widest uppercase transition-colors mt-4">Save Customer Information</button>
                </form>
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
                        onClick={handleImport}
                        disabled={!importFile || importLoading}
                        className="w-full py-4 bg-indigo-600 text-white font-black text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-30 transition-all rounded shadow-lg shadow-indigo-500/20 uppercase"
                    >
                        {importLoading ? 'PROCESSING_DATA...' : 'START_IMPORT'}
                    </button>
                </div>
            </div>
        </div>
       )}
    </div>
  );
}
