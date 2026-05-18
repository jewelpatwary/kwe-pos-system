import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Database, PackageSearch, Truck, ClipboardCheck, Banknote, 
  Plus, Search, Edit2, Check, X, AlertTriangle, ChevronRight, 
  Layers, Info, DollarSign
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'categories' | 'brands' | 'units' | 'currencies';

export default function MasterData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'categories';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { token } = useAuthStore();

  // Data states
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});

  const tabs = [
    { id: 'categories', label: 'Categories', icon: PackageSearch, description: 'GROUP_HIERARCHY' },
    { id: 'brands', label: 'Brands', icon: Truck, description: 'BRAND_REGISTRY' },
    { id: 'units', label: 'Units', icon: ClipboardCheck, description: 'MEASUREMENT_SPEC' },
    { id: 'currencies', label: 'Currencies', icon: Banknote, description: 'FX_CONFIG' }
  ];

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        if (activeTab === 'categories') setCategories(result.data);
        if (activeTab === 'brands') setBrands(result.data);
        if (activeTab === 'units') setUnits(result.data);
        if (activeTab === 'currencies') setCurrencies(result.data);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `/api/${activeTab}/${editingItem.id}` : `/api/${activeTab}`;

    try {
      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(`${activeTab.slice(0, -1)} saved successfully`);
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Error saving data');
    } finally {
      setLoading(false);
    }
  };

  const openForm = (item: any = null) => {
    setEditingItem(item);
    setFormData(item || getDefaultFormData());
    setIsModalOpen(true);
  };

  const getDefaultFormData = () => {
    switch (activeTab) {
      case 'categories': return { name: '', parent_id: null, status: 'active' };
      case 'brands': return { name: '', description: '', status: 'active' };
      case 'units': return { name: '', short_name: '', status: 'active' };
      case 'currencies': return { code: '', name: '', rate: 1, symbol: '', is_base: 0, status: 'active' };
      default: return {};
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-black tracking-widest italic">MASTER_CORE_REGISTRY_v4.2</span>
        </div>
        
        <div className="flex-1 overflow-x-auto flex no-scrollbar gap-2 px-6 border-l border-slate-200 mx-4">
            {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => {
                            setActiveTab(tab.id as TabType);
                            setSearchParams({ tab: tab.id });
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 transition-all whitespace-nowrap rounded border shadow-sm ${isActive ? 'bg-indigo-50 border-indigo-600 text-indigo-600 ' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-900 '}`}
                    >
                        <Icon className="w-3 h-3" />
                        <span className="font-black italic tracking-widest">{tab.label}</span>
                        <span className="text-[7px] opacity-30">[{tab.description}]</span>
                    </button>
                );
            })}
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={() => openForm()}
                className="bg-indigo-600 border border-indigo-500 text-white px-3 py-1.5 rounded hover:bg-indigo-700 transition flex items-center gap-2 font-black italic shadow-lg shadow-indigo-500/20 active:scale-95"
            >
                <Plus className="w-3.5 h-3.5" /> NEW_ENTRY
            </button>
            <button 
                onClick={() => navigate('/admin')}
                className="p-1.5 border border-slate-200 bg-white rounded text-slate-400 hover:text-slate-900 transition"
                title="Close"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white">
        <AnimatePresence mode="wait">
          {loading && !isModalOpen ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <div className="w-8 h-8 border-2 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-xs font-black text-slate-400 italic animate-pulse tracking-[0.5em]">SYNCING_BUFFER...</span>
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4"
            >
              <div className="border border-slate-200 bg-slate-50/30 rounded-lg overflow-hidden backdrop-blur-sm shadow-sm transition-colors">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr className="text-slate-500">
                            <th className="py-4 px-6 font-black border-r border-slate-200">ID / LABEL</th>
                            <th className="py-4 px-6 font-black border-r border-slate-200">ATTRIBUTE_METADATA</th>
                            <th className="py-4 px-6 font-black border-r border-slate-200">STATUS_BIT</th>
                            <th className="py-4 px-6 font-black text-right">OPS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 transition-colors">
                        {activeTab === 'categories' && categories.map(cat => (
                            <tr key={cat.id} className="hover:bg-slate-50 transition-all group">
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-900 font-black italic shadow-sm">
                                            {cat.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="text-[11px] font-black text-slate-900 italic tracking-tighter uppercase">{cat.name}</div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    {cat.parent_id ? (
                                        <div className="flex items-center gap-2 text-slate-500 font-bold tracking-widest text-[8px]">
                                            <ChevronRight className="w-3 h-3 text-indigo-600" /> CHILD_NODE_POINTER
                                        </div>
                                    ) : (
                                        <div className="text-[8px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded inline-block italic tracking-[0.2em] shadow-sm">ROOT_ANCHOR</div>
                                    )}
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <span className={`px-2 py-0.5 rounded border ${cat.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 ' : 'border-slate-200 bg-slate-50 text-slate-500 '} font-black italic text-[8px]`}>
                                        {cat.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button onClick={() => openForm(cat)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'brands' && brands.map(brand => (
                            <tr key={brand.id} className="hover:bg-slate-50 transition-all group">
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="text-[11px] font-black text-slate-900 italic tracking-tighter uppercase">{brand.name}</div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="text-[8px] font-bold text-slate-400 italic max-w-xs truncate tracking-widest">{brand.description || 'NULL_DESCRIPTION'}</div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <span className={`px-2 py-0.5 rounded border ${brand.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 ' : 'border-slate-200 bg-slate-50 text-slate-500 '} font-black italic text-[8px]`}>
                                        {brand.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button onClick={() => openForm(brand)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'units' && units.map(unit => (
                            <tr key={unit.id} className="hover:bg-slate-50 transition-all group">
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="text-[11px] font-black text-slate-900 italic tracking-tighter uppercase">{unit.name}</div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <span className="text-[9px] font-black text-indigo-600 border border-indigo-200 bg-indigo-50 px-3 py-1 rounded italic tracking-[0.2em] shadow-sm">{unit.short_name}</span>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <span className={`px-2 py-0.5 rounded border ${unit.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 ' : 'border-slate-200 bg-slate-50 text-slate-500 '} font-black italic text-[8px]`}>
                                        {unit.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button onClick={() => openForm(unit)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}

                        {activeTab === 'currencies' && currencies.map(cur => (
                            <tr key={cur.id} className="hover:bg-slate-50 transition-all group">
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-center text-emerald-600 font-black italic shadow-sm">
                                            {cur.symbol || '$'}
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black text-slate-900 italic tracking-tighter uppercase">{cur.code}</div>
                                            <div className="text-[7px] font-bold text-slate-400 tracking-widest">{cur.name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="text-[9px] font-black text-slate-600 italic tracking-[0.1em]">RATE: {cur.rate}</div>
                                        {cur.is_base === 1 && (
                                            <span className="text-[7px] font-black text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded italic tracking-[0.2em] shadow-lg shadow-amber-500/5">BASE_VECTOR</span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-200 transition-colors">
                                    <span className={`px-2 py-0.5 rounded border ${cur.status === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-600 ' : 'border-slate-200 bg-slate-50 text-slate-500 '} font-black italic text-[8px]`}>
                                        {cur.status}
                                    </span>
                                </td>
                                <td className="py-4 px-6 text-right">
                                    <button onClick={() => openForm(cur)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div>MASTER_NODE_v4 • COMPAT_LAYER_ACTIVE • SECTOR_CORE</div>
         <div>SYSTEM_TIME_STAMP : {new Date().toISOString()}</div>
      </div>

      {/* Form Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden rounded-xl transition-colors"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-[11px] font-black text-slate-900 italic tracking-[0.2em] uppercase">
                  MODIFY_BUFFER: {activeTab.toUpperCase().slice(0, -1)}
                </h3>
                <div className="text-[7px] font-black text-slate-400 italic uppercase">Core registry write operation</div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 transition-all rounded bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 bg-white">
              {activeTab === 'categories' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">CATEGORY_DESCRIPTOR</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                      placeholder="ENTRY_NAME..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">UPSTREAM_POINTER (PARENT)</label>
                    <select 
                       value={formData.parent_id || ''}
                       onChange={e => setFormData({...formData, parent_id: e.target.value || null})}
                       className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all appearance-none shadow-inner"
                    >
                      <option value="">NULL [ROOT_LEVEL]</option>
                      {categories.filter(c => c.id !== editingItem?.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'brands' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">BRAND_LABEL</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">DESCRIPTOR_METADATA</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all h-20 resize-none shadow-inner"
                    />
                  </div>
                </>
              )}

              {activeTab === 'units' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">FULL_NAME</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">NODE_SHORT</label>
                    <input 
                      type="text" 
                      required
                      value={formData.short_name}
                      onChange={e => setFormData({...formData, short_name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'currencies' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">ISO_CODE</label>
                      <input 
                        type="text" 
                        required
                        value={formData.code}
                        onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">SYM_VECTOR</label>
                      <input 
                        type="text" 
                        required
                        value={formData.symbol}
                        onChange={e => setFormData({...formData, symbol: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                      />
                    </div>
                  </div>
                   <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">CURRENCY_DESCRIPTOR</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">EX_RATE</label>
                      <input 
                        type="number" 
                        step="0.0001"
                        required
                        value={formData.rate}
                        onChange={e => setFormData({...formData, rate: parseFloat(e.target.value)})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">BASE_VEC</label>
                      <div className="flex items-center gap-3 py-2">
                         <input 
                          type="checkbox"
                          checked={formData.is_base === 1}
                          onChange={e => setFormData({...formData, is_base: e.target.checked ? 1 : 0})}
                          className="w-4 h-4 rounded bg-slate-200 border border-slate-300 accent-indigo-600"
                        />
                        <span className="text-[8px] font-black text-slate-400 italic">SYSTEM_DEFAULT</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5 pt-2">
                <label className="text-[8px] font-black text-slate-400 italic tracking-widest block uppercase">NODE_STATUS_BIT</label>
                <div className="flex gap-2">
                  {['active', 'inactive'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData({...formData, status})}
                      className={`flex-1 py-2 rounded text-[9px] font-black uppercase italic tracking-widest border transition-all shadow-sm ${formData.status === status ? 'bg-indigo-50 text-indigo-600 border-indigo-200 ' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 '}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-lg font-black text-[10px] uppercase italic tracking-[0.2em] hover:bg-slate-200 transition-all"
                >
                  DISCARD
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-3 bg-indigo-600 text-white rounded-lg font-black text-[10px] uppercase italic tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
                >
                  {loading ? 'WRITING...' : 'SAVE'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
