import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  ShoppingBag, Plus, Edit2, Trash2, Search, Filter, 
  AlertTriangle, UploadCloud, Download, History, X, CheckCircle2, ArrowLeft,
  ArrowUpDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useProductStore } from '../store/productStore';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';

export default function ProductManagement() {
  const navigate = useNavigate();
  const { products, fetchProducts, setProducts } = useProductStore();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categories2, setCategories2] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [productToDelete, setProductToDelete] = useState<{id: number, name: string} | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedCategory2, setSelectedCategory2] = useState('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'modified_desc' | 'modified_asc'>('modified_desc');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [formData, setFormData] = useState({
    id: '', name: '', barcode: '', category_id: '', category2_id: '', brand_id: '', unit_id: '',
    purchase_price: '', selling_price: '', stock_quantity: '', supplier_id: '',
    image_url: '',
    is_credit_allowed: true, expiry_enabled: false, is_favorite: false,
    status: 'active',
    expiry_date: ''
  });
  const [selectedProductDetails, setSelectedProductDetails] = useState<any>(null);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  
  // Import States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const { token, user } = useAuthStore();
  const { currency } = useTheme();

  const fetchBatches = async (productId: number) => {
    setLoadingBatches(true);
    try {
      const res = await fetch(`/api/products/${productId}/batches`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setProductBatches(data.data);
    } catch (err) { console.error(err); }
    finally { setLoadingBatches(false); }
  };

  const fetchAdditionalMetadata = async () => {
    try {
      setLoading(true);
      const [supRes, catRes, cat2Res, brandRes, unitRes] = await Promise.all([
        fetch('/api/suppliers', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/categories2', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/brands', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/units', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const [supData, catData, cat2Data, brandData, unitData] = await Promise.all([
        supRes.json(), catRes.json(), cat2Res.json(), brandRes.json(), unitRes.json()
      ]);

      if (supData.success) setSuppliers(supData.data);
      if (catData.success) setCategories(catData.data);
      if (cat2Data.success) setCategories2(cat2Data.data);
      if (brandData.success) setBrands(brandData.data);
      if (unitData.success) setUnits(unitData.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = (force = true) => {
    fetchProducts(token!, force);
    fetchAdditionalMetadata();
  };

  useEffect(() => {
    refreshData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = formData.id ? `/api/products/${formData.id}` : '/api/products';
      const method = formData.id ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        purchase_price: Number(formData.purchase_price),
        selling_price: Number(formData.selling_price),
        stock_quantity: Number(formData.stock_quantity),
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        category2_id: formData.category2_id ? Number(formData.category2_id) : null,
        brand_id: formData.brand_id ? Number(formData.brand_id) : null,
        unit_id: formData.unit_id ? Number(formData.unit_id) : null,
        is_credit_allowed: Boolean(formData.is_credit_allowed),
        expiry_enabled: formData.expiry_enabled ? 1 : 0,
        is_favorite: !!formData.is_favorite,
        status: formData.status,
        expiry_date: formData.expiry_date || null
      };

      console.log('Saving product with payload:', payload);

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setFormData({
            id: '', name: '', barcode: '', category_id: '', category2_id: '', brand_id: '', unit_id: '',
            purchase_price: '', selling_price: '', stock_quantity: '', supplier_id: '',
            image_url: '',
            is_credit_allowed: true, expiry_enabled: false, is_favorite: false,
            status: 'active',
            expiry_date: ''
        });
        setShowForm(false);
        resetForm();
        refreshData();
      } else {
        alert(data.message || 'Error saving product');
      }
    } catch (err) {
      alert('Error connecting to server');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setProductToDelete({ id, name });
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    try {
      const res = await fetch(`/api/products/${productToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.success) refreshData();
      else alert(data.message);
    } catch (err) {
      console.error(err);
    } finally {
      setProductToDelete(null);
    }
  };

  const handleEdit = (prod: any) => {
    setFormData({
      id: prod.id,
      name: prod.name,
      barcode: prod.barcode,
      category_id: prod.category_id ? prod.category_id.toString() : '',
      category2_id: prod.category2_id ? prod.category2_id.toString() : '',
      brand_id: prod.brand_id ? prod.brand_id.toString() : '',
      unit_id: prod.unit_id ? prod.unit_id.toString() : '',
      purchase_price: prod.purchase_price.toString(),
      selling_price: prod.selling_price.toString(),
      stock_quantity: prod.stock_quantity.toString(),
      image_url: prod.image_url || '',
      supplier_id: prod.supplier_id ? prod.supplier_id.toString() : '',
      is_credit_allowed: Boolean(prod.is_credit_allowed),
      expiry_enabled: Boolean(prod.expiry_enabled),
      is_favorite: Boolean(prod.is_favorite),
      status: prod.status || 'active',
      expiry_date: prod.expiry_date || ''
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      id: '', name: '', barcode: '', category_id: '', category2_id: '', brand_id: '', unit_id: '',
      purchase_price: '', selling_price: '', stock_quantity: '', supplier_id: '',
      image_url: '',
      is_credit_allowed: true, expiry_enabled: false, is_favorite: false,
      status: 'active',
      expiry_date: ''
    });
  };

  const handleImport = async () => {
    if (!importFile) return alert('Select a file first');
    setImportLoading(true);
    setImportStatus('Analyzing CSV structure and validating data...');

    Papa.parse(importFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const processedRows = [];
        let errors = 0;

        for (const row of rows) {
          try {
            if (!row.Name || !row.Barcode) continue; // Skip strictly invalid rows

            // Find IDs from names
            const category = categories.find(c => c.name.toLowerCase() === (row.Category || '').trim().toLowerCase());
            const category2 = categories2.find(c => c.name.toLowerCase() === (row.Category2 || '').trim().toLowerCase());
            const brand = brands.find(b => b.name.toLowerCase() === (row.Brand || '').trim().toLowerCase());
            const unit = units.find(u => u.name.toLowerCase() === (row.Unit || '').trim().toLowerCase());
            const supplier = suppliers.find(s => s.name.toLowerCase() === (row.Supplier || '').trim().toLowerCase());

            const purchasePrice = parseFloat(row.PurchasePrice) || 0;
            const sellingPrice = parseFloat(row.SellingPrice) || 0;
            const stockQty = Math.floor(parseFloat(row.StockQuantity) || 0);

            processedRows.push({
              name: (row.Name || '').trim(),
              barcode: (row.Barcode || '').trim(),
              category_id: category?.id ? Number(category.id) : null,
              category2_id: category2?.id ? Number(category2.id) : null,
              brand_id: brand?.id ? Number(brand.id) : null,
              unit_id: unit?.id ? Number(unit.id) : null,
              supplier_id: supplier?.id ? Number(supplier.id) : null,
              purchase_price: purchasePrice,
              selling_price: sellingPrice,
              stock_quantity: stockQty,
              expiry_enabled: !!row.ExpiryDate,
              expiry_date: row.ExpiryDate || null,
              status: 'active',
              is_credit_allowed: true,
              is_favorite: false
            });
          } catch (e) {
            errors++;
          }
        }

        if (processedRows.length === 0) {
          setImportLoading(false);
          setImportStatus('Error: No valid data found in CSV.');
          return;
        }

        try {
          setImportStatus(`Syncing ${processedRows.length} products to database...`);
          const res = await fetch('/api/admin/products/bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ products: processedRows })
          });
          const data = await res.json();
          if (data.success) {
            setImportStatus(`Success! Bulk import completed. ${processedRows.length} products processed.`);
            setImportFile(null);
            refreshData();
          } else {
            setImportStatus('Error: ' + data.message);
          }
        } catch (err) {
          setImportStatus('Error connecting to server for bulk import.');
        } finally {
          setImportLoading(false);
        }
      },
      error: (err) => {
        setImportLoading(false);
        setImportStatus('Error parsing CSV: ' + err.message);
      }
    });
  };

  // Filter and sort products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !search || 
                         (p.name && p.name.toLowerCase().includes(search.toLowerCase())) || 
                         (p.barcode && p.barcode.toLowerCase().includes(search.toLowerCase())) ||
                         (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase())) ||
                         (p.brand_name && p.brand_name.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || p.category_id?.toString() === selectedCategory;
    const matchesCategory2 = selectedCategory2 === 'all' || p.category2_id?.toString() === selectedCategory2;
    const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesCategory2 && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'name_asc') {
      return (a.name || '').localeCompare(b.name || '');
    } else if (sortBy === 'name_desc') {
      return (b.name || '').localeCompare(a.name || '');
    } else if (sortBy === 'modified_desc') {
      const getVal = (item: any) => {
        const d = item.updated_at || item.created_at;
        if (!d) return Number(item.id || 0);
        const parsed = Date.parse(d);
        return isNaN(parsed) ? Number(item.id || 0) : parsed;
      };
      return getVal(b) - getVal(a);
    } else if (sortBy === 'modified_asc') {
      const getVal = (item: any) => {
        const d = item.updated_at || item.created_at;
        if (!d) return Number(item.id || 0);
        const parsed = Date.parse(d);
        return isNaN(parsed) ? Number(item.id || 0) : parsed;
      };
      return getVal(a) - getVal(b);
    }
    return 0;
  });

  if (showForm) {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => { setShowForm(false); setIsEditing(false); resetForm(); }}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition"
             >
                <ArrowLeft className="w-4 h-4" />
             </button>
             <span className="text-slate-900 font-black tracking-widest">{isEditing ? 'Edit Product' : 'Add New Product'}</span>
          </div>
          <button 
                onClick={() => { setShowForm(false); setIsEditing(false); resetForm(); }}
                className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition"
             >
                <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-12 bg-slate-100">
            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded p-8 shadow-2xl relative animate-in fade-in slide-in-from-bottom-4">
                <form id="productEntryForm" onSubmit={handleSubmit} className="space-y-8">
                    {/* Seq 1 & 2: Product Name & Barcode */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">NAME</label>
                            <input 
                                type="text" required 
                                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-black italic text-lg shadow-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">CODE</label>
                            <input 
                                type="text" required 
                                value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-lg shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Seq 3 & 7: Category & Category 2 */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">CAT</label>
                            <select 
                                required value={formData.category_id} 
                                onChange={e => {
                                    const selectedId = e.target.value;
                                    setFormData({...formData, category_id: selectedId});
                                }} 
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm h-[46px] font-black"
                            >
                                <option value="">SELECT...</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">CAT2</label>
                            <select 
                                value={formData.category2_id} 
                                onChange={e => {
                                    const selectedId = e.target.value;
                                    setFormData({...formData, category2_id: selectedId});
                                }} 
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm h-[46px] font-black"
                            >
                                <option value="">SELECT...</option>
                                {categories2.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Seq 5, 6 & 7: Buying Price, Seals Price & Stock */}
                    <div className="grid grid-cols-3 gap-8 p-6 bg-slate-50 border border-slate-200 rounded">
                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">BUY</label>
                            <input 
                                type="number" step="0.01" required 
                                value={formData.purchase_price} onChange={e => setFormData({...formData, purchase_price: e.target.value})} 
                                className="w-full bg-white border border-slate-200 text-slate-600 px-4 py-3 rounded outline-none font-mono text-xl shadow-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-indigo-600 font-black tracking-widest italic text-[9px]">SELL</label>
                            <input 
                                type="number" step="0.01" required 
                                value={formData.selling_price} onChange={e => setFormData({...formData, selling_price: e.target.value})} 
                                className="w-full bg-white border border-indigo-200 text-indigo-600 px-4 py-3 rounded outline-none font-mono text-xl shadow-sm focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-emerald-600 font-black tracking-widest text-[9px]">STOCK</label>
                            <input 
                                type="number" required 
                                value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: e.target.value})} 
                                className="w-full bg-white border border-slate-200 text-emerald-600 px-4 py-3 rounded outline-none font-mono text-xl shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Seq 8: Expiry Details */}
                    <div className="grid grid-cols-2 gap-8">
                        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded hover:border-indigo-300 transition-all cursor-pointer group shadow-sm">
                            <input type="checkbox" id="expiry" checked={formData.expiry_enabled} onChange={e => setFormData({...formData, expiry_enabled: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                            <label htmlFor="expiry" className="text-slate-500 font-black tracking-widest cursor-pointer group-hover:text-slate-900 text-[9px]">EXP_ON</label>
                        </div>
                        <div className="space-y-1">
                            <label className="text-slate-400 font-black tracking-widest text-[9px]">EXP_DATE</label>
                            <input 
                                type="date" 
                                value={formData.expiry_date} onChange={e => setFormData({...formData, expiry_date: e.target.value})} 
                                className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm text-[9px] font-black h-[46px]"
                            />
                        </div>
                    </div>

                    {/* Metadata descriptors */}
                    <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-slate-400 font-black tracking-widest text-[9px]">UNIT</label>
                                <select 
                                    required value={formData.unit_id} 
                                    onChange={e => setFormData({...formData, unit_id: e.target.value})} 
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm font-black"
                                >
                                    <option value="">SELECT...</option>
                                    {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-slate-400 font-black tracking-widest text-[9px]">BRAND</label>
                                <select 
                                    value={formData.brand_id} 
                                    onChange={e => setFormData({...formData, brand_id: e.target.value})} 
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm font-black"
                                >
                                    <option value="">GENERIC</option>
                                    {brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col justify-center gap-4">
                            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded hover:border-indigo-300 transition-all cursor-pointer group shadow-sm">
                                <input type="checkbox" id="fav" checked={formData.is_favorite} onChange={e => setFormData({...formData, is_favorite: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="fav" className="text-slate-500 font-black tracking-widest cursor-pointer group-hover:text-slate-900 text-[9px]">FAV</label>
                            </div>
                            <div className="space-y-1">
                                <label className="text-slate-400 font-black tracking-widest text-[9px]">STATUS</label>
                                <select 
                                    value={formData.status} 
                                    onChange={e => setFormData({...formData, status: e.target.value})} 
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 px-4 py-3 rounded outline-none shadow-sm font-black"
                                >
                                    <option value="active">ACTIVE</option>
                                    <option value="deactive">DEACTIVE</option>
                                </select>
                             </div>
                            <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded hover:border-indigo-300 transition-all cursor-pointer group shadow-sm">
                                <input type="checkbox" id="credit" checked={formData.is_credit_allowed} onChange={e => setFormData({...formData, is_credit_allowed: e.target.checked})} className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" />
                                <label htmlFor="credit" className="text-slate-500 font-black tracking-widest cursor-pointer group-hover:text-slate-900 text-[9px]">CREDIT</label>
                            </div>
                        </div>
                    </div>

                    <div className="pt-8 flex justify-end">
                         <button 
                            type="submit" 
                            disabled={loading}
                            className="px-12 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] tracking-widest uppercase italic shadow-sm rounded">{isEditing ? 'SAVE_CHANGES' : 'SAVE_PRODUCT'}</button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="bg-white border-l-4 border-indigo-500 px-3 py-1 mr-2 hidden sm:block shadow-sm">
           <div className="text-[8px] text-slate-400 font-bold uppercase overflow-hidden leading-tight">Database</div>
           <div className="text-[11px] text-slate-900 font-black leading-tight">{filteredProducts.length} FOUND</div>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="SEARCH..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
          />
        </div>

        <select 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white border border-slate-200 text-slate-750 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm h-[33px]"
        >
          <option value="all">CAT: ALL</option>
          {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        <select 
          value={selectedCategory2} 
          onChange={(e) => setSelectedCategory2(e.target.value)}
          className="bg-white border border-slate-200 text-slate-755 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm h-[33px]"
        >
          <option value="all">CAT2: ALL</option>
          {categories2.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
        </select>

        <select 
          value={selectedStatus} 
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-white border border-slate-200 text-slate-755 text-[9px] font-black rounded px-3 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm h-[33px]"
        >
          <option value="all">STATUS: ALL</option>
          <option value="active">ACTIVE</option>
          <option value="deactive">DEACTIVE</option>
        </select>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2.5 shadow-sm h-[33px]">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent border-none text-slate-900 text-[9px] font-black outline-none cursor-pointer py-1.5 pr-2 focus:ring-0 uppercase"
          >
            <option value="name_asc">A-Z</option>
            <option value="name_desc">Z-A</option>
            <option value="modified_desc">LATEST</option>
            <option value="modified_asc">OLDEST</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowImportModal(true)}
                className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-2 rounded hover:bg-slate-200 transition flex items-center gap-2 shadow-sm"
            >
                <UploadCloud className="w-3.5 h-3.5" /> BULK
            </button>
            <button 
                onClick={() => {
                   setIsEditing(false);
                   resetForm();
                   setShowForm(true);
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10 font-black uppercase"
            >
                <Plus className="w-3.5 h-3.5" /> ADD
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && products.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">SCANNING_PRODUCT_REGISTRY...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 text-[9px]">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">PRODUCT ID</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">NAME</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">CODE</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">CAT</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">CAT2</th>
                <th className="py-4 px-6 font-black text-right border-r border-slate-200">BUY</th>
                <th className="py-4 px-6 font-black text-right border-r border-slate-200">SELL</th>
                <th className="py-4 px-6 font-black text-center border-r border-slate-200">STOCK</th>
                <th className="py-4 px-6 font-black text-center border-r border-slate-200">UNIT</th>
                <th className="py-4 px-6 font-black text-center border-r border-slate-200">BRAND</th>
                <th className="py-4 px-6 font-black border-r border-slate-200 text-center">EXP</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">STATUS</th>
                <th className="py-4 px-6 font-black text-right">OP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100 font-mono text-[10px] text-slate-500 font-bold">
                    #{product.id}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-900 font-black italic tracking-widest">
                    {product.name}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-slate-400 tracking-tighter">
                    {product.barcode}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-indigo-600 font-black italic">
                    [{product.category_name || 'No Category'}]
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-indigo-650 font-black italic">
                    [{product.category2_name || 'No Category 2'}]
                  </td>
                  <td className="py-4 px-6 text-right border-r border-slate-100 text-slate-400 font-bold italic">
                    {currency.symbol}{product.purchase_price.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-right border-r border-slate-100 text-emerald-600 font-bold italic">
                    {currency.symbol}{product.selling_price.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-center border-r border-slate-100 animate-fade-in">
                    <div className={`font-black italic underline decoration-offset-4 ${product.stock_quantity <= 10 ? 'text-red-600 decoration-red-900' : 'text-slate-400 decoration-slate-200 '}`}>
                      {product.stock_quantity}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center border-r border-slate-100 text-slate-500 font-bold italic">
                    {product.unit_name || 'N/A'}
                  </td>
                  <td className="py-4 px-6 text-center border-r border-slate-100 text-slate-500 font-bold italic">
                    {product.brand_name || 'Generic'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-center font-black italic text-red-500/70">
                    {product.expiry_date || 'N/A'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 font-bold text-slate-400 tracking-tighter">
                    <span className={`px-2 py-1 rounded text-[8px] font-black ${product.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {product.status?.toUpperCase() || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => {
                        setSelectedProductDetails(product);
                        fetchBatches(product.id);
                      }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="BATCH_HISTORY"><History className="w-4 h-4" /></button>
                      <button onClick={() => handleEdit(product)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors" title="PATCH_ENTITY"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(product.id, product.name)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors" title="PURGE_ENTITY"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && !loading && (
                <tr>
                   <td colSpan={13} className="py-20 text-center font-black text-slate-300 tracking-[0.5em]">REGISTRY_NULL_SPACE</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>



      {/* Detail Overlay */}
      {selectedProductDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4" onClick={() => setSelectedProductDetails(null)}>
          <div className="bg-white border border-slate-200 rounded shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <span className="text-slate-900 font-black">META_ANALYSIS // {selectedProductDetails.name}</span>
                <button onClick={() => setSelectedProductDetails(null)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"><X size={16}/></button>
            </div>
            <div className="p-6 overflow-auto max-h-[70vh]">
                 <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 border border-slate-200 rounded mb-6">
                    <div className="space-y-4">
                        <div>
                            <div className="text-[7px] text-slate-400 font-black mb-1 tracking-widest">Product ID</div>
                            <div className="text-slate-900 font-black italic">{selectedProductDetails.id}</div>
                        </div>
                        <div>
                            <div className="text-[7px] text-slate-400 font-black mb-1 tracking-widest">Barcode</div>
                            <div className="text-slate-900 font-black font-mono underline decoration-indigo-200 underline-offset-4">{selectedProductDetails.barcode}</div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <div className="text-[7px] text-slate-400 font-black mb-1 tracking-widest">Price</div>
                            <div className="text-emerald-600 font-black text-xl italic">{currency.symbol}{selectedProductDetails.selling_price}</div>
                        </div>
                        <div>
                            <div className="text-[7px] text-slate-400 font-black mb-1 tracking-widest">Stock Level</div>
                            <div className="text-slate-900 font-black italic text-lg">{selectedProductDetails.stock_quantity} <span className="text-slate-400 text-[8px]">{selectedProductDetails.unit_name}</span></div>
                        </div>
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <h4 className="text-indigo-600 font-black text-[9px] tracking-widest border-b border-slate-200 pb-1 italic">Batch History</h4>
                    {loadingBatches ? (
                        <div className="animate-pulse py-4 font-black text-slate-400">QUERYING_BATCH_STREAM...</div>
                    ) : (
                        <div className="space-y-2">
                            {productBatches.map(b => (
                                <div key={b.id} className="bg-slate-50 px-4 py-2 border border-slate-100 flex justify-between items-center group hover:bg-slate-100 transition rounded">
                                    <span className="text-slate-400 font-black italic">[BATCH_#{b.batch_number}]</span>
                                    <span className="text-slate-900 font-black">{b.quantity} Units</span>
                                    <span className="text-red-600 font-black italic">{b.expiry_date}</span>
                                </div>
                            ))}
                            {productBatches.length === 0 && <div className="py-8 text-center text-slate-400 font-black tracking-[0.2em] italic">No batches found</div>}
                        </div>
                    )}
                 </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-100/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
                <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                    <span className="text-slate-900 font-black tracking-widest">Bulk Import Sync</span>
                    <button onClick={() => setShowImportModal(false)} className="text-slate-500 hover:text-slate-900"><X size={16}/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="border-2 border-dashed border-slate-200 p-10 text-center bg-slate-50 relative group hover:border-indigo-500/30 transition-all">
                         <UploadCloud className="w-8 h-8 mx-auto text-slate-400 mb-2 group-hover:text-indigo-600 transition-colors" />
                         <div className="text-slate-600 text-[8px] font-black uppercase tracking-[0.3em]">Select CSV File</div>
                         <input type="file" onChange={e => setImportFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                         {importFile && <div className="mt-4 text-emerald-600 font-black italic underline underline-offset-4 decoration-emerald-200">{importFile.name}</div>}
                    </div>
                    <a 
                      href={`data:text/csv;charset=utf-8,${encodeURIComponent('Name,Barcode,Category,Category2,Brand,Unit,Supplier,PurchasePrice,SellingPrice,StockQuantity,ExpiryDate\nPremium Product,123456789,General,Food,Generic,KG,Direct,10.00,20.00,100,2026-12-31')}`}
                      download="product_import_template.csv"
                      className="block text-center py-2 bg-slate-600 text-white font-black text-[8px] tracking-widest hover:bg-slate-700 transition-all rounded"
                    >
                      Download Sample CSV
                    </a>
                    {importStatus && (
                      <div className={`text-[10px] font-black italic tracking-widest p-3 border rounded shadow-inner ${importStatus.startsWith('Error') || importStatus.includes('Conflict') ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-indigo-600 border-slate-200'}`}>
                        {importStatus}
                      </div>
                    )}
                    <button 
                        onClick={handleImport}
                        disabled={!importFile || importLoading}
                        className="w-full py-4 bg-indigo-600 text-white font-black text-[9px] tracking-widest hover:bg-indigo-700 disabled:opacity-30 transition-all rounded"
                    >
                        {importLoading ? 'KERNEL_SYNCING...' : 'SAVE_IMPORT'}
                    </button>
                </div>
            </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={productToDelete !== null}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
        title="Delete Product"
        message={`Warning: Are you sure you want to delete "${productToDelete?.name?.toUpperCase()}"? This action cannot be undone.`}
      />
    </div>
  );
}
