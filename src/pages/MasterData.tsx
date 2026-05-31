import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Database, PackageSearch, Truck, ClipboardCheck, 
  Plus, Search, Edit2, X, ChevronRight, HelpCircle, ArrowLeft, RefreshCw,
  CreditCard, FileText, Trash2
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from '../components/ConfirmModal';

type TabType = 'categories' | 'categories2' | 'brands' | 'units' | 'payment_types' | 'invoice_categories';

export default function MasterData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: TabType = (tabParam === 'categories' || tabParam === 'categories2' || tabParam === 'brands' || tabParam === 'units' || tabParam === 'payment_types' || tabParam === 'invoice_categories') ? tabParam : 'categories';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { token } = useAuthStore();

  // Data states
  const [categories, setCategories] = useState<any[]>([]);
  const [categories2, setCategories2] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<any[]>([]);
  const [invoiceCategories, setInvoiceCategories] = useState<any[]>([]);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({});
  const [itemToDelete, setItemToDelete] = useState<{id: any, name: string} | null>(null);

  const tabs = [
    { id: 'categories', label: 'Categories', icon: PackageSearch, description: 'Product classification and hierarchy' },
    { id: 'categories2', label: 'Categories 2', icon: Database, description: 'Secondary product categorization' },
    { id: 'brands', label: 'Brands', icon: Truck, description: 'Manufacturer and product brands' },
    { id: 'units', label: 'Units', icon: ClipboardCheck, description: 'Unit of measurement configuration' },
    { id: 'payment_types', label: 'Payment Types', icon: CreditCard, description: 'Payment methods configuration' },
    { id: 'invoice_categories', label: 'Invoice Categories', icon: FileText, description: 'Invoice categories configuration' }
  ];

  useEffect(() => {
    fetchData();
    setSearchQuery('');
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
        if (activeTab === 'categories2') setCategories2(result.data);
        if (activeTab === 'brands') setBrands(result.data);
        if (activeTab === 'units') setUnits(result.data);
        if (activeTab === 'payment_types') setPaymentTypes(result.data);
        if (activeTab === 'invoice_categories') setInvoiceCategories(result.data);
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
        setSuccess(`${activeTab.slice(0, -1).toUpperCase()} saved successfully!`);
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({});
        fetchData();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        setError(result.message || 'An error occurred during save.');
        setTimeout(() => setError(null), 4000);
      }
    } catch (err) {
      setError('Error saving data. Please check connection.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: any) => {
    const list = getListByTab();
    const item = list.find((i: any) => i.id === id);
    if (item) {
      setItemToDelete({ id: item.id, name: item.name });
    }
  };

  const getListByTab = () => {
    switch (activeTab) {
      case 'categories': return categories;
      case 'categories2': return categories2;
      case 'brands': return brands;
      case 'units': return units;
      case 'payment_types': return paymentTypes;
      case 'invoice_categories': return invoiceCategories;
      default: return [];
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/${activeTab}/${itemToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        let label = tabs.find(t => t.id === activeTab)?.label || activeTab;
        let singularLabel = label.endsWith('s') ? label.slice(0, -1) : label;
        if (label === 'Categories') singularLabel = 'Category';
        
        setSuccess(`${singularLabel.toUpperCase()} deleted successfully!`);
        fetchData();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        setError(result.message || 'Failed to delete record.');
        setTimeout(() => setError(null), 4000);
      }
    } catch (err) {
      setError('Error deleting data.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
      setItemToDelete(null);
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
      case 'categories2': return { name: '', status: 'active' };
      case 'brands': return { name: '', description: '', status: 'active' };
      case 'units': return { name: '', short_name: '', status: 'active' };
      case 'payment_types': return { name: '', status: 'active' };
      case 'invoice_categories': return { name: '', status: 'active' };
      default: return {};
    }
  };

  // Human-readable terms for statuses
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
      case 'inactive':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  const getStatusLabel = (status: string) => {
    if (activeTab === 'categories' || activeTab === 'categories2') {
      if (status === 'active') return 'Active Category';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 flex flex-col font-sans">
      {/* Dynamic Header Section */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Database className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Master Data</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button 
              onClick={() => openForm()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-500/10 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add {activeTab.slice(0, -1)}</span>
            </button>
            <button 
              onClick={() => navigate('/admin')}
              className="px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition flex items-center gap-1.5 text-xs font-medium"
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </div>

        </div>

        {/* Categories Tab Bar */}
        <div className="border-t border-slate-100 bg-slate-50/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-2 overflow-x-auto py-2.5 no-scrollbar">
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
                    className={`flex items-center gap-2.5 px-4 py-2 transition-all duration-200 rounded-lg text-xs font-semibold whitespace-nowrap shadow-sm border ${
                      isActive 
                        ? 'bg-white border-slate-200 text-indigo-600 ring-2 ring-indigo-600/5' 
                        : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 lg:px-8 flex flex-col gap-6">
        
        {/* Alerts Block */}
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-xs font-medium flex items-center justify-between"
            >
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700"><X size={14}/></button>
            </motion.div>
          )}

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -10 }}
              className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 text-xs font-medium flex items-center justify-between"
            >
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700"><X size={14}/></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          
          {/* Internal Filtering Block */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 pl-9 pr-4 text-xs font-medium outline-none text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
              />
            </div>
            
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>Showing defined {activeTab} attributes for database references</span>
            </div>
          </div>

          {/* Table Area */}
          <div className="overflow-x-auto min-h-[300px]">
            {loading && !isModalOpen ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
                <span className="text-xs font-semibold text-slate-400 tracking-wider">Syncing attributes...</span>
              </div>
            ) : (() => {
              // Filters the datasets depending on the searches
              let filteredList: any[] = [];
              if (activeTab === 'categories') {
                filteredList = categories.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
              } else if (activeTab === 'categories2') {
                filteredList = categories2.filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
              } else if (activeTab === 'brands') {
                filteredList = brands.filter(b => 
                  (b.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (b.description || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
              } else if (activeTab === 'units') {
                filteredList = units.filter(u => 
                  (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (u.short_name || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
              } else if (activeTab === 'payment_types') {
                filteredList = paymentTypes.filter(pt => 
                  (pt.name || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
              } else if (activeTab === 'invoice_categories') {
                filteredList = invoiceCategories.filter(ic => 
                  (ic.name || '').toLowerCase().includes(searchQuery.toLowerCase())
                );
              }

              if (filteredList.length === 0) {
                return (
                  <div className="py-24 text-center">
                    <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 text-xs font-semibold italic">No registered records found matching your query</p>
                    <button 
                      onClick={() => openForm()}
                      className="mt-3 text-indigo-600 text-xs font-bold hover:underline"
                    >
                      Create first record now &rarr;
                    </button>
                  </div>
                );
              }

              return (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/40 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-6 border-r border-slate-100">ID & Name / Code</th>
                      <th className="py-3 px-6 border-r border-slate-100">Details & Metadata</th>
                      <th className="py-3 px-6 border-r border-slate-100 text-center w-36">Status</th>
                      <th className="py-3 px-6 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTab === 'categories' && filteredList.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold text-xs shadow-sm capitalize">
                              {cat.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-sm">{cat.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100">
                          {cat.parent_id ? (
                            <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-xs bg-slate-100 px-2 py-1 rounded-md inline-flex">
                              <ChevronRight className="w-3 h-3 text-indigo-500" />
                              <span>Subcategory</span>
                            </div>
                          ) : (
                            <span className="text-indigo-600 bg-indigo-50 font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border border-indigo-100 inline-block shadow-sm">
                              Top Level Category
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(cat.status)}`}>
                            {getStatusLabel(cat.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(cat)} 
                              className="p-1 px-2 border border-slate-205 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(cat.id)} 
                              className="p-1 px-2 border border-slate-205 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'categories2' && filteredList.map(cat => (
                      <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold text-xs shadow-sm capitalize">
                              {cat.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-sm">{cat.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100">
                          <span className="text-indigo-600 bg-indigo-50 font-bold text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md border border-indigo-100 inline-block shadow-sm">
                            Secondary Category
                          </span>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(cat.status)}`}>
                            {getStatusLabel(cat.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(cat)} 
                              className="p-1 px-2 border border-slate-205 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(cat.id)} 
                              className="p-1 px-2 border border-slate-205 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'brands' && filteredList.map(brand => (
                      <tr key={brand.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 font-extrabold text-xs shadow-sm capitalize">
                              {brand.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-sm">{brand.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100">
                          <div className="text-slate-500 font-medium max-w-sm truncate text-xs">
                            {brand.description || <span className="text-slate-300 italic">No description available</span>}
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(brand.status)}`}>
                            {getStatusLabel(brand.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(brand)} 
                              className="p-1 px-2 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(brand.id)} 
                              className="p-1 px-2 border border-slate-200 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'units' && filteredList.map(unit => (
                      <tr key={unit.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-extrabold text-xs shadow-sm shadow-indigo-500/5">
                              {unit.short_name}
                            </div>
                            <span className="font-bold text-slate-840 text-sm">{unit.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100">
                          <span className="text-indigo-600 bg-indigo-50 font-bold text-[10px] tracking-wide px-2 py-0.5 rounded-md border border-indigo-100 font-mono shadow-sm">
                            Short Code: {unit.short_name}
                          </span>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(unit.status)}`}>
                            {getStatusLabel(unit.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(unit)} 
                              className="p-1 px-2 border border-slate-205 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(unit.id)} 
                              className="p-1 px-2 border border-slate-205 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeTab === 'payment_types' && filteredList.map(pt => (
                      <tr key={pt.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold text-xs shadow-sm capitalize">
                              {pt.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-sm">{pt.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-20 flex items-center">
                             <span className="text-indigo-600 bg-indigo-50 font-bold text-[10px] tracking-wide px-2 py-0.5 rounded-md border border-indigo-100 uppercase">Payment Method</span>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(pt.status)}`}>
                            {getStatusLabel(pt.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(pt)} 
                              className="p-1 px-2 border border-slate-205 hover:border-indigo-400 hover:bg-indigo-50/50 text-slate-500 hover:text-indigo-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(pt.id)} 
                              className="p-1 px-2 border border-slate-205 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeTab === 'invoice_categories' && filteredList.map(ic => (
                      <tr key={ic.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-6 border-r border-slate-100 font-semibold text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700 font-extrabold text-xs shadow-sm capitalize">
                              {ic.name.charAt(0)}
                            </div>
                            <span className="font-bold text-slate-850 text-sm">{ic.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-20 flex items-center">
                             <span className="text-purple-600 bg-purple-50 font-bold text-[10px] tracking-wide px-2 py-0.5 rounded-md border border-purple-100 uppercase">Invoice Cat</span>
                        </td>
                        <td className="py-4 px-6 border-r border-slate-100 text-center">
                          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold inline-block shadow-sm ${getStatusBadgeClass(ic.status)}`}>
                            {getStatusLabel(ic.status)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openForm(ic)} 
                              className="p-1 px-2 border border-slate-205 hover:border-purple-400 hover:bg-purple-50/50 text-slate-500 hover:text-purple-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button 
                              onClick={() => handleDelete(ic.id)} 
                              className="p-1 px-2 border border-slate-205 hover:border-rose-400 hover:bg-rose-50/50 text-slate-500 hover:text-rose-600 rounded-md transition-all inline-flex items-center gap-1 text-[10px] font-bold"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Footer system details */}
      <div className="bg-white border-t border-slate-200 py-3.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center text-[10px] font-semibold tracking-wider text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block animate-pulse"></span>
            <span>Master Data Core System Active</span>
          </div>
          <div>All indices are securely persistent.</div>
        </div>
      </div>

      {/* Modern Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white border border-slate-200 w-full max-w-md shadow-2xl overflow-hidden rounded-2xl transition-all"
          >
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingItem ? 'Edit' : 'Create'} {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)}
                </h3>
                <p className="text-[10px] font-semibold text-slate-400 text-slate-500">Configure references to save inside database storage</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 bg-white">
              {activeTab === 'categories' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Category Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                      placeholder="e.g., Cold Drinks, Bakery Ingredients..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Parent Category (Optional)</label>
                    <div className="relative">
                      <select 
                         value={formData.parent_id || ''}
                         onChange={e => setFormData({...formData, parent_id: e.target.value || null})}
                         className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all appearance-none shadow-inner"
                      >
                        <option value="">(None - Top Level Category)</option>
                        {categories.filter(c => c.id !== editingItem?.id).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'categories2' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Category Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., Normal, Premium, Special..."
                  />
                </div>
              )}

              {activeTab === 'brands' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Brand Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                      placeholder="e.g., Nestle, Coca-Cola..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Description</label>
                    <textarea 
                      value={formData.description || ''}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all h-20 resize-none shadow-inner"
                      placeholder="Provide simple tags or context about this brand..."
                    />
                  </div>
                </>
              )}

              {activeTab === 'units' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Unit Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name || ''}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                      placeholder="e.g., Kilogram, Piece, Litre..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500">Short Name / Code</label>
                    <input 
                      type="text" 
                      required
                      value={formData.short_name || ''}
                      onChange={e => setFormData({...formData, short_name: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner uppercase"
                      placeholder="e.g., KG, PCS, LTR..."
                    />
                  </div>
                </>
              )}

              {activeTab === 'payment_types' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Payment Type Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., Cash, Bank, Mobile Banking..."
                  />
                </div>
              )}

              {activeTab === 'invoice_categories' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">Category Name</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-slate-950 text-xs font-semibold rounded-lg focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-500 outline-none transition-all shadow-inner"
                    placeholder="e.g., Minimart, Canteen..."
                  />
                </div>
              )}


              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-slate-500">Availability status</label>
                <div className="flex gap-2">
                  {['active', 'inactive'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData({...formData, status})}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all shadow-sm ${
                        formData.status === status 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-extrabold ring-1 ring-indigo-500/10' 
                          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600'
                      }`}
                    >
                      {getStatusLabel(status)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs shadow-sm transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-md shadow-indigo-500/15 transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal 
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title={`Delete ${activeTab.replace('_', ' ').slice(0, -1)}`}
        message={`Warning: Are you sure you want to delete "${itemToDelete?.name?.toUpperCase()}"? This action cannot be undone.`}
      />
    </div>
  );
}
