import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Search, Edit2, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';

export default function Suppliers() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    id: '', 
    name: '', 
    contact: '', 
    phone: '',
    bank_name: '',
    bank_account_name: '',
    bank_account_no: '',
    bank_routing_no: ''
  });
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);
  
  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers', {
          headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSuppliers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = formData.id ? `/api/suppliers/${formData.id}` : '/api/suppliers';
      const method = formData.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormData({ 
          id: '', 
          name: '', 
          contact: '', 
          phone: '',
          bank_name: '',
          bank_account_name: '',
          bank_account_no: '',
          bank_routing_no: ''
        });
        fetchSuppliers();
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('Error saving supplier');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSupplierToDelete(id);
  };

  const confirmDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      const res = await fetch(`/api/suppliers/${supplierToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchSuppliers();
      else alert(data.message);
    } catch (err) {
      console.error(err);
    } finally {
      setSupplierToDelete(null);
    }
  };

  const handleEdit = (sup: any) => {
    setFormData({ 
      id: sup.id, 
      name: sup.name, 
      contact: sup.contact || '', 
      phone: sup.phone || '',
      bank_name: sup.bank_name || '',
      bank_account_name: sup.bank_account_name || '',
      bank_account_no: sup.bank_account_no || '',
      bank_routing_no: sup.bank_routing_no || ''
    });
    setShowForm(true);
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.contact && s.contact.toLowerCase().includes(search.toLowerCase())) ||
    (s.bank_name && s.bank_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="SEARCH..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => {
                setFormData({ 
                  id: '', 
                  name: '', 
                  contact: '', 
                  phone: '',
                  bank_name: '',
                  bank_account_name: '',
                  bank_account_no: '',
                  bank_routing_no: ''
                });
                setShowForm(true);
             }}
             className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10 font-black tracking-widest uppercase"
           >
             <Plus className="w-3.5 h-3.5" /> ADD
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && suppliers.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">Loading suppliers...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-[9px]">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">ID</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">NAME</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">MAIL</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">TEL</th>
                <th className="py-4 px-6 font-black text-right border-r border-slate-200">BAL</th>
                <th className="py-4 px-6 font-black text-right">OP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {filtered.map((sup) => (
                <tr key={sup.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-bold">
                    #{sup.id.toString().padStart(4, '0')}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className="text-slate-900 font-black">{sup.name}</div>
                    <div className="text-[8px] mt-0.5 tracking-[0.2em] flex flex-wrap gap-x-2 gap-y-1 items-center">
                      <span className="text-slate-400">Added: {new Date(sup.created_at).toLocaleDateString()}</span>
                      {sup.bank_name && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-indigo-600 font-extrabold bg-indigo-50 px-1 rounded">Bank: {sup.bank_name}</span>
                        </>
                      )}
                      {sup.bank_account_no && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-bold">A/C: {sup.bank_account_no}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-500">
                    {sup.contact || 'No Email'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-500">
                    {sup.phone || 'No Phone'}
                  </td>
                  <td className={`py-4 px-6 text-right border-r border-slate-100 font-black ${sup.balance > 0 ? 'text-red-600 ' : 'text-emerald-600 '}`}>
                    {currency.symbol}{Number(sup.balance).toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(sup)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(sup.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center font-black text-slate-300 tracking-[0.5em]">
                     No suppliers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>



      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-black/40 backdrop-blur-sm">
           <div className="w-full max-w-lg bg-white border border-slate-200 shadow-2xl rounded-lg flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">
                  {formData.id ? 'UPDATE' : 'CREATE'}
                </h2>
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-1 h-6 w-6 flex items-center justify-center bg-white hover:bg-red-50 text-slate-500 hover:text-red-500 transition-all rounded border border-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-white overflow-y-auto max-h-[80vh]">
                <form id="supplierForm" onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase">NAME</label>
                    <input 
                        type="text" required 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all font-black"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase">MAIL</label>
                    <input 
                        type="text" 
                        value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase">TEL</label>
                    <input 
                        type="text" 
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} 
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold"
                    />
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-2 space-y-4">
                    <h3 className="text-[9px] text-indigo-600 font-black tracking-widest uppercase italic">BANK_DETAILS</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase font-mono">BANK</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Chase Bank"
                            value={formData.bank_name || ''} 
                            onChange={e => setFormData({...formData, bank_name: e.target.value})} 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all text-[9.5px] font-black uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase font-mono">A/C_NAME</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Acme Corp"
                            value={formData.bank_account_name || ''} 
                            onChange={e => setFormData({...formData, bank_account_name: e.target.value})} 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all text-[9.5px] font-black uppercase"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase font-mono">A/C_NO</label>
                        <input 
                            type="text" 
                            placeholder="e.g. 123456789"
                            value={formData.bank_account_no || ''} 
                            onChange={e => setFormData({...formData, bank_account_no: e.target.value})} 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all text-[9.5px] font-black uppercase"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] text-slate-500 font-black tracking-widest uppercase font-mono">CODE</label>
                        <input 
                            type="text" 
                            placeholder="e.g. TR0921"
                            value={formData.bank_routing_no || ''} 
                            onChange={e => setFormData({...formData, bank_routing_no: e.target.value})} 
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-white outline-none transition-all text-[9.5px] font-black uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
                <button 
                  form="supplierForm"
                  type="submit" 
                  disabled={loading}
                  className="px-8 py-2 bg-indigo-600 text-white font-black text-[10px] tracking-widest rounded hover:bg-indigo-700 transition-all disabled:opacity-50 uppercase shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'SAVING...' : 'SAVE'}
                </button>
              </div>
           </div>
        </div>
      )}
      
      <ConfirmModal 
        isOpen={supplierToDelete !== null}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={confirmDeleteSupplier}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? This action cannot be undone."
      />
    </div>
  );
}
