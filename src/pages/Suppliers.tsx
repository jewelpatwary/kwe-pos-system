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
  const [formData, setFormData] = useState({ id: '', name: '', contact: '', phone: '' });
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
        setFormData({ id: '', name: '', contact: '', phone: '' });
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
    setFormData({ id: sup.id, name: sup.name, contact: sup.contact, phone: sup.phone });
    setShowForm(true);
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.contact && s.contact.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="VENDOR_SEARCH_QUERY..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => {
                setFormData({ id: '', name: '', contact: '' });
                setShowForm(true);
             }}
             className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
           >
             <Plus className="w-3.5 h-3.5" /> NEW_VENDOR_ENTRY
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && suppliers.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">SYNCING_VENDORS...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">Vendor_UUID</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Company_Identity</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Email_Channel</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Tel_Channel</th>
                <th className="py-4 px-6 font-black text-right border-r border-slate-200">Debt_Exposure</th>
                <th className="py-4 px-6 font-black text-right">Operation</th>
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
                    <div className="text-[8px] text-slate-400 mt-0.5 tracking-[0.2em]">SINCE: {new Date(sup.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-500">
                    {sup.contact || 'EMAIL_NULL'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-500">
                    {sup.phone || 'TEL_NULL'}
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
                     EMPTY_VENDOR_SPACE
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div>VENDOR_STORAGE • {filtered.length} ACTIVE_VENDORS</div>
         <div>ADMIN_SESSION_ACTIVE • {new Date().toISOString()}</div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-[#0f1117]/80 backdrop-blur-sm">
           <div className="w-full max-w-lg bg-[#181a20] border border-[#2d303b] rounded-lg flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-[#2d303b] flex items-center justify-between bg-[#1c1f26]">
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
                  {formData.id ? 'VENDOR_PATCH' : 'NEW_VENDOR_REGISTRY'}
                </h2>
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-1 h-6 w-6 flex items-center justify-center bg-[#2d303b] hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all rounded border border-[#3b404d]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-[#0f1117]">
                <form id="supplierForm" onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">COMPANY_NAME</label>
                    <input 
                        type="text" required 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">EMAIL_CHANNEL</label>
                    <input 
                        type="text" 
                        value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} 
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">TEL_CHANNEL</label>
                    <input 
                        type="text" 
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} 
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-[#2d303b] bg-[#1c1f26] flex items-center justify-end">
                <button 
                  form="supplierForm"
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white font-black text-[10px] tracking-widest rounded hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'EXECUTING...' : 'SAVE_SUPPLIER'}
                </button>
              </div>
           </div>
        </div>
      )}
      
      <ConfirmModal 
        isOpen={supplierToDelete !== null}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={confirmDeleteSupplier}
        title="BLACKLIST_VENDOR"
        message="ARE_YOU_SURE_TO_PURGE_THIS_VENDOR_FROM_CORE_LOGISTICS?_THIS_MAY_ORPHAN_LINKED_ASSETS."
      />
    </div>
  );
}
