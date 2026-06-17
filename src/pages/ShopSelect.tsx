import React, { useState, useEffect } from 'react';
import { Building2, Save, LogIn, Plus, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function ShopSelect({ onShopSelect }: { onShopSelect: (skipCheck?: boolean) => void }) {
  const [shops, setShops] = useState<{id: string, name: string, isDefault?: boolean}[]>([]);
  const [showAdd, setShowAdd] = useState(() => {
    const forceAdd = localStorage.getItem('forceAddNew') === 'true';
    if (forceAdd) localStorage.removeItem('forceAddNew');
    return forceAdd;
  });
  const [editShopId, setEditShopId] = useState<string | null>(() => {
    const editId = localStorage.getItem('editShopId');
    if (editId) localStorage.removeItem('editShopId');
    return editId;
  });

  const [initialShowAdd] = useState(showAdd);
  const [initialEditMode] = useState(Boolean(editShopId));
  const [newShop, setNewShop] = useState({ name: '', supabaseUrl: '', supabaseKey: '' });
  const [useMainConfig, setUseMainConfig] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/shops')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setShops(data.data);
          
          if (editShopId) {
             const target = data.data.find((s: any) => s.id === editShopId);
             if (target) {
                setNewShop({ name: target.name, supabaseUrl: '', supabaseKey: '' }); // We can't fetch secrets, so leave empty
                setShowAdd(true);
             }
          } else {
            // Only auto select if there is literally 1 shop and we don't already have an active one we cleared
            if (data.data.length === 1 && data.data[0].id === 'default' && !localStorage.getItem('activeShop') && !initialShowAdd) {
              handleSelect(data.data[0].id, data.data[0].name, true);
            }
          }
        }
      })
      .finally(() => setLoading(false));
  }, [initialShowAdd, editShopId]);

  const handleSelect = (id: string, name?: string, skipAutoSelect = false) => {
    localStorage.setItem('activeShop', id);
    if (name) localStorage.setItem('activeShopName', name);
    useAuthStore.getState().logout();
    onShopSelect();
  };

  const handleDelete = async () => {
    if (!editShopId) return;
    if (!confirm("Are you sure you want to remove this shop configuration? (Data in Supabase will NOT be deleted)")) return;
    
    const res = await fetch(`/api/shops/${editShopId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert("Shop deleted");
      window.location.reload();
    } else {
      alert(data.message || 'Error occurred');
    }
  };

  const handleCreate = async () => {
    if (!newShop.name) {
      alert("Please fill the shop name");
      return;
    }
    if (!useMainConfig && (!newShop.supabaseUrl || !newShop.supabaseKey)) {
      alert("Please fill all Supabase fields");
      return;
    }
    
    const method = editShopId ? 'PUT' : 'POST';
    const url = editShopId ? `/api/shops/${editShopId}` : '/api/shops';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newShop, useDefaultConfig: useMainConfig })
    });
    const data = await res.json();
    if (data.success) {
      alert(editShopId ? "Shop updated!" : "Shop connected!");
      handleSelect(data.shopId || editShopId, newShop.name);
    } else {
      alert(data.message || 'Error occurred');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><p className="text-slate-500 font-medium animate-pulse">Loading shops...</p></div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl border-t-4 border-t-indigo-600">
        <div className="text-center pb-2 p-6">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Select Active Shop</h2>
          <p className="text-sm text-slate-500 mt-2">Choose a server environment before logging in</p>
        </div>
        <div className="p-6 pt-4 flex flex-col gap-4">
          {!showAdd ? (
            <>
              {shops.map(shop => (
                <button
                  key={shop.id}
                  onClick={() => handleSelect(shop.id, shop.name)}
                  className="group flex flex-col p-4 bg-white border border-slate-200 rounded-lg hover:border-indigo-500 hover:shadow-md transition-all text-left"
                >
                  <div className="flex w-full items-center justify-between mb-1">
                    <h3 className="font-bold text-slate-800">{shop.name}</h3>
                    <LogIn className="text-slate-300 group-hover:text-indigo-600 w-5 h-5 transition-colors" />
                  </div>
                  {shop.isDefault && <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded w-max">Default Config</span>}
                </button>
              ))}
              <div className="text-center mt-4 border-t border-slate-100 pt-4">
                 <button onClick={() => setShowAdd(true)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1.5 mx-auto transition-colors bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100">
                   <Plus size={16} /> Register New Shop Server
                 </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button 
                onClick={() => { setShowAdd(false); setEditShopId(null); setNewShop({name: '', supabaseUrl: '', supabaseKey: ''}); localStorage.removeItem('editShopId'); }} 
                className="text-xs font-semibold text-slate-500 flex items-center gap-1 mb-2 hover:text-slate-800 w-fit"
              >
                <ArrowLeft size={14} /> Back to Shops
              </button>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Shop Name</label>
                <input value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} className="w-full border-slate-300 bg-slate-50 rounded-md p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none" placeholder="e.g. Branch B" />
              </div>
              
              <div className="flex items-center gap-2 mt-2 mb-1">
                 <input 
                   type="checkbox" 
                   id="useMainConfig" 
                   checked={useMainConfig} 
                   onChange={(e) => setUseMainConfig(e.target.checked)}
                   className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                 />
                 <label htmlFor="useMainConfig" className="text-xs font-medium text-slate-700 cursor-pointer">
                   Use Main Server Database (Shared Data)
                 </label>
              </div>

              {!useMainConfig && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-2">
                  <p className="text-[10px] text-slate-500 leading-tight">Must provide a new Supabase Project URL and Service Role Key to separate data.</p>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Supabase Project URL</label>
                    <input value={newShop.supabaseUrl} onChange={e => setNewShop({...newShop, supabaseUrl: e.target.value})} className="w-full border-slate-300 bg-white rounded-md p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none" placeholder="https://xyz.supabase.co" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Database Keys (Service Role Secret)</label>
                    <input type="password" value={newShop.supabaseKey} onChange={e => setNewShop({...newShop, supabaseKey: e.target.value})} className="w-full border-slate-300 bg-white rounded-md p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none font-mono" placeholder="eyJ..." />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button onClick={handleCreate} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                  <Save size={16} /> {editShopId ? 'Update & Connect' : 'Save & Connect'}
                </button>
                {editShopId && (
                  <button onClick={handleDelete} className="py-2.5 px-4 bg-red-50 text-red-600 border border-red-200 rounded-md text-sm hover:bg-red-100 font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                    Delete
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
