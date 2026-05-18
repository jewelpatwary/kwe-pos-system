import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, Product } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { 
  Search, ShoppingCart, Trash2, CreditCard, Banknote, ScanBarcode, 
  Undo2, LogOut, Tag, Ban, Plus, PackageSearch, Star, X, FileText, Settings
} from 'lucide-react';
import CustomerReturnModal from '../components/CustomerReturnModal';
import OptionsModal from '../components/OptionsModal';
import ShortcutsModal from '../components/ShortcutsModal';
import VoidSaleModal from '../components/VoidSaleModal';
import VoidAuthModal from '../components/VoidAuthModal';
import POSSummaryModal from '../components/POSSummaryModal';
import PrintPreviewModal from '../components/PrintPreviewModal';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../components/ThemeProvider';

export default function POS() {
  const { items, addItem, removeItem, updateQuantity, getTotal, clearCart, discount, returnCredit } = useCartStore();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCartItemId, setSelectedCartItemId] = useState<number | null>(null);
  const [isNewInput, setIsNewInput] = useState(true);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cartBottomRef = useRef<HTMLDivElement>(null);
  
  const [scanMode, setScanMode] = useState<'SALES' | 'PRICE_CHECK'>('SALES');
  const [priceCheckResult, setPriceCheckResult] = useState<any>(null);
  
  const [showPriceCheck, setShowPriceCheck] = useState(false);
  const [priceCheckSearch, setPriceCheckSearch] = useState('');
  
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showVoidSaleModal, setShowVoidSaleModal] = useState(false);
  const [showVoidAuthModal, setShowVoidAuthModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showCashCalcModal, setShowCashCalcModal] = useState(false);
  const [cashAmountReceived, setCashAmountReceived] = useState('');
  const [receiptData, setReceiptData] = useState<any>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [pendingVoidAction, setPendingVoidAction] = useState<any>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [storeProfile, setStoreProfile] = useState<any>(null);

  const { logout, user, token } = useAuthStore();
  const { currency } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/settings/store', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) setStoreProfile(data.data);
    })
    .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (items.length > 0 && selectedCartItemId === null) {
      setSelectedCartItemId(items[0].id);
      setIsNewInput(true);
    } else if (items.length === 0) {
      setSelectedCartItemId(null);
    }
    
    // Auto-scroll to bottom of the cart when items change
    cartBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleRemoveItem = (id: number) => {
    if (user?.role === 'CASHIER') {
      setPendingVoidAction({ type: 'item', productId: id });
      setShowVoidAuthModal(true);
    } else {
      removeItem(id);
    }
  };

  const handleClearCart = () => {
    if (items.length === 0) return;
    if (user?.role === 'CASHIER') {
      setPendingVoidAction({ type: 'cart' });
      setShowVoidAuthModal(true);
    } else {
      clearCart();
    }
  };

  const executePendingVoid = () => {
    if (pendingVoidAction?.type === 'item') {
      removeItem(pendingVoidAction.productId);
    } else if (pendingVoidAction?.type === 'cart') {
      clearCart();
    }
    setPendingVoidAction(null);
    setShowVoidAuthModal(false);
  };

  const [settings, setSettings] = useState<{ returnValidityDays: number }>({ returnValidityDays: 3 });

  useEffect(() => {
    fetch('/api/settings/returns', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setSettings(data.data);
      }
    })
    .catch(err => console.error(err));
  }, [token]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        setShowCashCalcModal(true);
      }
      if (e.key === 'F8') {
        e.preventDefault();
        setShowReturnModal(true);
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setShowPriceCheck(prev => !prev);
        setPriceCheckSearch('');
        setTimeout(() => document.getElementById('price-check-search')?.focus(), 100);
      }
      const activeElement = document.activeElement;
      if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          barcodeInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    const focusInterval = setInterval(() => {
      // Don't auto-focus if any modal is open
      if (showCashCalcModal || showPriceCheck || showCustomerModal || showSummaryModal || showReturnModal || showVoidAuthModal || showVoidSaleModal || receiptData) {
        return;
      }
      
      const activeElement = document.activeElement;
      if (activeElement?.id !== 'search-input' && activeElement?.id !== 'price-check-search' && (activeElement?.tagName !== 'INPUT' || activeElement.id === 'barcode-scanner')) {
        barcodeInputRef.current?.focus();
      }
    }, 1000);
    return () => clearInterval(focusInterval);
  }, [showCashCalcModal, showPriceCheck, showCustomerModal, showSummaryModal, showReturnModal, showVoidAuthModal, showVoidSaleModal, receiptData]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [prodRes, catRes, custRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const [prodData, catData, custData] = await Promise.all([
          prodRes.json(),
          catRes.json(),
          custRes.json()
        ]);

        if (prodData.success) setProducts(prodData.data);
        if (catData.success) setCategories(catData.data);
        if (custData.success) setCustomers(custData.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [token]);

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim();
    setBarcodeInput('');
    setErrorMsg(null);
    setPriceCheckResult(null);

    try {
      if (scanMode === 'PRICE_CHECK') {
        const response = await fetch(`/api/products/price-check/${code}`);
        const data = await response.json();
        if (data.success) {
          setPriceCheckResult(data.data);
        } else {
          setErrorMsg(`Not found (${code})`);
          setTimeout(() => setErrorMsg(null), 3000);
        }
      } else {
        const response = await fetch(`/api/products/barcode/${code}`);
        const data = await response.json();
        if (data.success) {
          addItem(data.data);
          setSelectedCartItemId(data.data.id);
          setIsNewInput(true);
        } else {
          setErrorMsg(`Not found (${code})`);
          setTimeout(() => setErrorMsg(null), 3000);
        }
      }
    } catch (err) {
      setErrorMsg('Network error');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (selectedCartItemId === null) return;
    const item = items.find(i => i.id === selectedCartItemId);
    if (!item) return;

    let newQty: number;
    if (val === 'C') {
      newQty = 0;
      setIsNewInput(true);
    } else if (isNewInput || val.length > 1) {
      newQty = parseInt(val);
      setIsNewInput(false);
    } else {
      const currentQty = item.cart_quantity;
      const newQtyStr = currentQty.toString() + val;
      newQty = parseInt(newQtyStr);
    }
    updateQuantity(selectedCartItemId, newQty);
  };

  const handleCompleteSale = async (method: 'CASH' | 'CREDIT' | 'ONLINE', details?: any) => {
    if (items.length === 0) return;
    if (method === 'CREDIT' && !selectedCustomer) {
      setShowCustomerModal(true);
      return;
    }

    try {
      const payload = {
        items,
        payment_method: method,
        discount_amount: discount + returnCredit,
        customer_id: selectedCustomer?.id || null,
        ...details
      };
      
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.success) {
        setReceiptData({
          saleId: data.saleId,
          items: [...items],
          total: items.reduce((sum, item) => sum + item.selling_price * item.cart_quantity, 0),
          discount,
          returnCredit,
          method,
          customer: selectedCustomer,
          received: details?.receivedAmount,
          change: details?.changeAmount || 0,
          date: new Date().toLocaleString()
        });
        clearCart();
        setSelectedCustomer(null);
        // Refresh products
        const pRes = await fetch('/api/products');
        const pData = await pRes.json();
        if (pData.success) setProducts(pData.data);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      alert("Sale error");
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const favoriteProducts = products.filter(p => p.is_favorite);

  const parsedReceived = parseFloat(cashAmountReceived) || 0;
  const cashChange = parsedReceived - (getTotal() - discount);

  return (
    <div className="flex bg-slate-50 h-screen overflow-hidden text-slate-800 text-[10px] uppercase transition-colors duration-300">
      
      {/* 1. LEFT: CART AREA (53%) */}
      <div className="w-[53%] flex flex-col bg-white border-r border-slate-200">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center shadow-md z-20">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-indigo-600 rounded text-white shadow-lg shadow-indigo-500/10">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 italic tracking-widest uppercase">Shopping Cart</h2>
              <div className="text-[7px] text-slate-500 font-black tracking-[0.2em]">{items.length} items in basket</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowOptionsModal(true)}
              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Options"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Cart List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10 pointer-events-none grayscale">
              <ScanBarcode className="w-16 h-16 mb-4" />
              <p className="font-black tracking-[0.5em] text-[8px]">Scan or search items to start...</p>
            </div>
          ) : (
            items.map(item => (
              <div 
                key={item.id} 
                onClick={() => {
                  setSelectedCartItemId(item.id);
                  setIsNewInput(true);
                }}
                className={`flex gap-3 p-3 rounded border transition-all cursor-pointer ${
 selectedCartItemId === item.id 
 ? 'border-indigo-600 bg-indigo-50 shadow-xl shadow-indigo-500/5' 
 : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 '
 }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] font-black text-indigo-600 tracking-widest truncate">{item.category_name || 'UNCATEGORIZED'}</div>
                  <div className="font-black text-slate-900 leading-tight tracking-tighter truncate text-[11px] mt-0.5">{item.name}</div>
                  <div className="text-[7px] font-bold text-slate-400 mt-1 tracking-[0.2em]">{item.barcode}</div>
                </div>
                
                <div className="flex flex-col items-end justify-between min-w-[80px]">
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-black text-slate-400">x</span>
                    <span className={`font-black ${selectedCartItemId === item.id ? 'text-indigo-600 ' : 'text-slate-900 '}`}>{item.cart_quantity}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-black text-slate-900 tracking-tighter">
                      {currency.symbol}{(item.selling_price * item.cart_quantity).toFixed(2)}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }}
                  className="self-center p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
          <div ref={cartBottomRef} />
        </div>

        {/* Totals Section */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-indigo-500/10"></div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center text-slate-400 font-black tracking-widest text-[10px]">
              <span>Subtotal</span>
              <span className="text-slate-900 font-extrabold text-xl">{currency.symbol}{(items.reduce((sum, item) => sum + item.selling_price * item.cart_quantity, 0)).toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-emerald-600 font-black tracking-widest text-[8px]">
                <span>Discount</span>
                <span className="bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">-{currency.symbol}{discount.toFixed(2)}</span>
              </div>
            )}
            {returnCredit > 0 && (
              <div className="flex justify-between items-center text-indigo-600 font-black tracking-widest text-[8px]">
                <span>Sales return amount</span>
                <span className="bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">-{currency.symbol}{returnCredit.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between items-end pt-3 border-t border-slate-200">
               <div className="flex flex-col">
                  <span className="text-[8px] font-black text-indigo-600 tracking-[0.2em] mb-1 uppercase">Net Total</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                    {currency.symbol}{(getTotal()).toFixed(2)}
                  </div>
               </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <button 
                disabled={items.length === 0}
                onClick={() => handleCompleteSale('CREDIT')}
                className={`py-2 rounded border font-black tracking-widest transition-all flex flex-col items-center justify-center gap-1 ${
 selectedCustomer ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-500/20' : 'bg-slate-200 text-slate-500 border-slate-300 hover:text-slate-900 hover:bg-slate-300 '
 }`}
             >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5" /> Credit Store
                </div>
                {selectedCustomer && <span className="text-[7px] opacity-70 tracking-normal italic truncate w-full px-2">{selectedCustomer.name}</span>}
             </button>
             <button 
                disabled={items.length === 0}
                onClick={() => handleCompleteSale('CASH')}
                className="bg-emerald-600 border border-emerald-500 text-white py-2 rounded font-black tracking-widest shadow-xl shadow-emerald-500/10 hover:bg-emerald-700 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-2"
             >
                <Banknote className="w-3.5 h-3.5" /> Exact Cash
             </button>
             <button 
                disabled={items.length === 0}
                onClick={() => { setCashAmountReceived(''); setShowCashCalcModal(true); }}
                className="bg-emerald-500 border border-emerald-400 text-white py-2 rounded font-black tracking-widest shadow-xl shadow-emerald-500/10 hover:bg-emerald-600 transition-all disabled:opacity-30 disabled:grayscale flex items-center justify-center gap-2"
             >
                <Banknote className="w-3.5 h-3.5" /> Cash Calc
             </button>
             <button 
                disabled={items.length === 0}
                onClick={() => handleCompleteSale('ONLINE')}
                className="bg-slate-100 border border-slate-200 text-slate-800 py-2 rounded font-black tracking-widest hover:bg-slate-200 shadow-sm transition-all disabled:opacity-20 flex items-center justify-center gap-2"
             >
                <ShoppingCart className="w-3.5 h-3.5 text-indigo-600" /> TNG
             </button>
          </div>
        </div>
      </div>

      {/* 2. CENTER: QUICK QUANTITY PANEL (7%) */}
      <div className="w-[7%] bg-white flex flex-col border-r border-slate-200">
         <div className="p-3 bg-slate-50 border-b border-slate-200 text-center">
            <h2 className="text-[8px] font-black text-slate-400 italic tracking-[0.3em] uppercase">Quantity</h2>
         </div>
         
         {/* Keypad Grid */}
         <div className="flex-1 grid grid-cols-1 gap-px bg-slate-100 transition-colors">
            {[1,2,3,4,5,6,7,8,9,0, 'C'].map((val) => (
              <button
                key={val}
                onClick={() => handleKeypadPress(val.toString())}
                className={`flex items-center justify-center text-lg font-black transition-all
 ${val === 'C' 
 ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' 
 : 'bg-white text-slate-500 hover:bg-indigo-600 hover:text-white'}
 border-b border-slate-100 italic`}
              >
                {val}
              </button>
            ))}
         </div>

         <div className="p-4 bg-slate-50 flex flex-col gap-3">
            <button 
              onClick={handleClearCart} 
              className="w-full py-4 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white border border-red-200 rounded-lg transition-all flex flex-col items-center justify-center gap-1 shadow-sm font-black italic tracking-widest text-[8px]"
              title="Clear Cart"
            >
              <Trash2 className="w-3.5 h-3.5" />
              CLEAR ALL
            </button>
         </div>
      </div>

      {/* 3. RIGHT: PRODUCT PANEL (40%) */}
      <div className="w-[40%] flex flex-col bg-white transition-colors">
        
        {/* Scanner & Search Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shadow-md space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                id="search-input"
                type="text" 
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded pl-10 pr-4 py-2.5 outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-black italic shadow-inner tracking-widest"
              />
            </div>
            <form onSubmit={handleBarcodeSubmit} className="flex-1 relative">
              <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500" />
              <input 
                id="barcode-scanner"
                ref={barcodeInputRef}
                type="text"
                placeholder="Barcode..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className={`w-full bg-white border rounded pl-9 pr-3 py-2.5 text-[11px] font-black transition-all ${scanMode === 'PRICE_CHECK' ? 'border-emerald-500/50 text-emerald-600 ' : 'border-indigo-500/50 text-indigo-600 '}`}
              />
            </form>
          </div>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
             <button 
               onClick={() => setSelectedCategory(null)}
               className={`px-3 py-1 rounded border text-[8px] font-black italic tracking-widest transition-all ${!selectedCategory ? 'bg-indigo-600/20 border-indigo-600 text-slate-900 ' : 'border-slate-200 text-slate-500 hover:text-slate-900 '}`}
             >
               All Categories
             </button>
             {categories.map(cat => (
               <button 
                 key={cat.id}
                 onClick={() => setSelectedCategory(cat.id)}
                 className={`px-3 py-1 rounded border text-[8px] font-black italic tracking-widest whitespace-nowrap transition-all ${selectedCategory === cat.id ? 'bg-indigo-600/20 border-indigo-600 text-slate-900 ' : 'border-slate-200 text-slate-500 hover:text-slate-900 '}`}
               >
                 {cat.name.toUpperCase()}
               </button>
             ))}
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar bg-white">
          {/* Quick Access Area */}
          <div className="flex items-center gap-2 mb-3">
             <Star className="w-3 h-3 text-amber-500 fill-amber-500/20" />
             <h3 className="text-[8px] font-black text-slate-400 italic tracking-[0.3em] uppercase">Popular Items</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
             {products
               .filter(p => (p.is_favorite || !selectedCategory) && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode?.includes(searchQuery)))
               .filter(p => !selectedCategory || p.category_id === selectedCategory)
               .map(p => (
                <button 
                   key={p.id}
                   onClick={() => {
                     addItem(p);
                     setSelectedCartItemId(p.id);
                     setIsNewInput(true);
                   }}
                   className="flex flex-col bg-slate-50/50 p-2 rounded border border-slate-100 hover:border-indigo-600/50 hover:bg-white transition-all text-left group relative overflow-hidden shadow-sm hover:shadow-md"
                >
                  <div className="aspect-square w-full mb-1 bg-slate-200 rounded border border-slate-200 flex items-center justify-center overflow-hidden transition-all opacity-80 group-hover:opacity-100">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="p-2 text-center">
                        <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter leading-none">{p.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="font-black text-slate-900 text-[9px] tracking-tight leading-tight italic uppercase block w-full px-0.5 mt-1 truncate">{p.name}</div>
                  <div className="text-[8px] font-black text-indigo-600 mt-1 italic">{currency.symbol}{p.selling_price.toFixed(2)}</div>
                  
                  <div className="absolute top-1 right-1 w-5 h-5 bg-indigo-600 rounded flex items-center justify-center shadow-lg transform translate-y-8 group-hover:translate-y-0 transition-all opacity-0 group-hover:opacity-100">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </button>
             ))}
          </div>
        </div>
      </div>

      {/* PRICE CHECK POPUP (F9) */}
      <AnimatePresence>
        {showPriceCheck && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md transition-colors"
          >
            <motion.div 
              initial={{ scale: 0.98, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white border border-slate-200 p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden rounded-xl"
            >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-xl font-black tracking-widest uppercase italic leading-none text-slate-900">Price Check</h2>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2 italic">Ready for input</p>
                  </div>
                  <button onClick={() => setShowPriceCheck(false)} className="p-1.5 bg-slate-100 text-slate-500 hover:text-slate-900 rounded transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="relative mb-8">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600" />
                  <input 
                    id="price-check-search"
                    autoFocus
                    type="text" 
                    placeholder="Scan or type barcode..."
                    value={priceCheckSearch}
                    onChange={(e) => setPriceCheckSearch(e.target.value)}
                    className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 text-slate-900 text-[12px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 italic transition-all shadow-inner"
                  />
                </div>

                <div className="min-h-[200px] flex flex-col justify-center">
                  {!priceCheckSearch ? (
                    <div className="text-center py-10 opacity-20">
                       <Search className="w-12 h-12 mx-auto mb-4" />
                       <div className="text-[10px] font-black uppercase tracking-[0.5em] italic">Scanning Barcode...</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {products
                        .filter(p => p.name.toLowerCase().includes(priceCheckSearch.toLowerCase()) || p.barcode?.includes(priceCheckSearch))
                        .slice(0, 1) // Only show the top match for clarity
                        .map(p => (
                          <div key={p.id} className="flex flex-col items-center gap-6 p-8 bg-slate-50 border border-slate-200 rounded-lg animate-in zoom-in-98 duration-200">
                             <div className="w-32 h-32 rounded bg-white border border-slate-200 flex items-center justify-center shadow-xl overflow-hidden mb-2">
                              {p.image_url ? (
                                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <Tag className="w-10 h-10 text-slate-300" />
                              )}
                            </div>
                            <div className="text-center w-full">
                              <div className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-2 italic">IDENT: {p.barcode}</div>
                              <div className="font-black text-slate-900 uppercase tracking-tighter text-2xl leading-tight mb-6 italic">{p.name}</div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-4 rounded border border-slate-200">
                                   <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">In Stock</div>
                                   <div className={`text-xl font-black italic ${p.stock_quantity > 10 ? 'text-emerald-600 ' : 'text-red-600 '}`}>[{p.stock_quantity}]</div>
                                </div>
                                <div className="bg-white p-4 rounded border border-slate-200">
                                   <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">Unit Price</div>
                                   <div className="text-xl font-black text-indigo-600 italic">${p.selling_price.toFixed(2)}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      {priceCheckSearch && products.filter(p => p.name.toLowerCase().includes(priceCheckSearch.toLowerCase()) || p.barcode?.includes(priceCheckSearch)).length === 0 && (
                        <div className="py-12 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.4em] italic">Not Found : [ "{priceCheckSearch.toUpperCase()}" ]</div>
                      ) }
                    </div>
                  )}
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* MODALS */}
      {showReturnModal && <CustomerReturnModal onClose={() => setShowReturnModal(false)} />}
      {showVoidSaleModal && <VoidSaleModal onClose={() => setShowVoidSaleModal(false)} />}
      {showSummaryModal && <POSSummaryModal onClose={() => setShowSummaryModal(false)} />}
      {showOptionsModal && (
        <OptionsModal 
          onClose={() => setShowOptionsModal(false)} 
          onShowSummary={() => { setShowSummaryModal(true); setShowOptionsModal(false); }}
          onShowReturn={() => { setShowReturnModal(true); setShowOptionsModal(false); }}
          onShowShortcuts={() => { setShowShortcutsModal(true); setShowOptionsModal(false); }}
        />
      )}
      {showShortcutsModal && <ShortcutsModal onClose={() => setShowShortcutsModal(false)} />}

      {showCashCalcModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl">
            <h2 className="text-xl font-black mb-6 flex items-center justify-between">
              <span>CASH CALCULATION</span>
              <button onClick={() => setShowCashCalcModal(false)} className="text-slate-400 hover:text-slate-900">
                <X size={14} />
              </button>
            </h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Payable</div>
                  <div className="text-4xl font-black text-indigo-600">{currency.symbol}{(getTotal() - discount).toFixed(2)}</div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                   <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Change to Return</div>
                   <div className={`text-4xl font-black ${cashChange < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {currency.symbol}{Math.max(0, cashChange).toFixed(2)}
                   </div>
                </div>
                
                <div className="flex gap-3 pt-2">
                   <button onClick={() => setShowCashCalcModal(false)} className="flex-1 py-4 bg-slate-200 font-black rounded-lg hover:bg-slate-300 transition-colors uppercase tracking-widest text-[11px]">CANCEL</button>
                   <button 
                     disabled={cashChange < 0}
                     onClick={() => {
                       setShowCashCalcModal(false);
                       handleCompleteSale('CASH', { receivedAmount: parsedReceived, changeAmount: Math.max(0, cashChange) });
                     }} 
                     className="flex-1 py-4 bg-emerald-600 text-white font-black rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:grayscale transition-colors flex items-center justify-center gap-2 uppercase tracking-widest text-[11px]"
                   >
                     COMPLETE <Banknote size={16} />
                   </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">{currency.symbol}</span>
                  <input 
                    autoFocus
                    type="number" 
                    value={cashAmountReceived} 
                    onChange={e => setCashAmountReceived(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && cashChange >= 0) {
                        e.preventDefault();
                        setShowCashCalcModal(false);
                        handleCompleteSale('CASH', { receivedAmount: parsedReceived, changeAmount: Math.max(0, cashChange) });
                      }
                    }}
                    placeholder="Amount Received"
                    className="w-full text-2xl font-black p-3 pl-12 border-2 border-slate-300 rounded-lg focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9, '.', 0, 'C'].map((val) => (
                    <button
                      key={val}
                      onClick={() => {
                        if (val === 'C') {
                          setCashAmountReceived('');
                        } else {
                          setCashAmountReceived(prev => prev + val.toString());
                        }
                      }}
                      className="py-3 bg-slate-100 font-black text-xl rounded border border-slate-200 hover:bg-slate-200 transition-colors"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PrintPreviewModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        title="Sale Receipt"
      >
        {receiptData && (
          <div className="max-w-md mx-auto p-4 flex flex-col font-mono text-sm border border-slate-200 rounded">
             <div className="text-center mb-6">
                <h1 className="text-xl font-bold tracking-widest">{storeProfile?.shop_name || 'KWE POS System'}</h1>
                {storeProfile?.company_name && <p className="text-xs font-bold">{storeProfile.company_name}</p>}
                {storeProfile?.registration_number && <p className="text-[10px]">REG: {storeProfile.registration_number}</p>}
                {storeProfile?.address && <p className="text-[10px] whitespace-pre-line">{storeProfile.address}</p>}
                {storeProfile?.phone_number && <p className="text-[10px]">TEL: {storeProfile.phone_number}</p>}
                <div className="mt-2 border-t border-dashed border-slate-300 pt-2">
                  <p className="text-xs">Invoice #{receiptData.saleId}</p>
                  <p className="text-xs">{receiptData.date}</p>
                </div>
             </div>
             <table className="w-full text-left mb-4 border-b border-dashed border-slate-300 pb-4">
                <thead>
                   <tr>
                      <th className="py-1">ITEM</th>
                      <th className="py-1 text-right">QTY</th>
                      <th className="py-1 text-right">AMT</th>
                   </tr>
                </thead>
                <tbody>
                   {receiptData.items.map((item: any) => (
                      <tr key={item.id}>
                         <td className="py-1 uppercase text-xs truncate max-w-[200px]">{item.name}</td>
                         <td className="py-1 text-right">{item.cart_quantity}</td>
                         <td className="py-1 text-right">{currency.symbol}{(item.selling_price * item.cart_quantity).toFixed(2)}</td>
                      </tr>
                   ))}
                </tbody>
             </table>
             <div className="text-right space-y-1 text-xs">
                {receiptData.discount > 0 && <p>DISCOUNT: -{currency.symbol}{receiptData.discount.toFixed(2)}</p>}
                {receiptData.returnCredit > 0 && <p>RETURN CREDIT: -{currency.symbol}{receiptData.returnCredit.toFixed(2)}</p>}
                <p className="font-bold text-lg border-t border-slate-300 pt-2">TOTAL: {currency.symbol}{(receiptData.total - receiptData.discount - receiptData.returnCredit).toFixed(2)}</p>
                <p>METHOD: {receiptData.method}</p>
                {receiptData.method === 'CASH' && (
                  <>
                    <p>RECEIVED: {currency.symbol}{(receiptData.received || Math.max(0, receiptData.total - receiptData.discount - receiptData.returnCredit)).toFixed(2)}</p>
                    <p>CHANGE: {currency.symbol}{(receiptData.change || 0).toFixed(2)}</p>
                  </>
                )}
             </div>
             <div className="text-center mt-8 text-xs italic">
                <p>Thank you for your business!</p>
                <p className="mt-2 text-[10px]">Return Policy: Valid for {settings.returnValidityDays} days.</p>
             </div>
          </div>
        )}
      </PrintPreviewModal>

      {showVoidAuthModal && (
        <VoidAuthModal
          onClose={() => setShowVoidAuthModal(false)}
          onSuccess={executePendingVoid}
          actionDetails={{
            reason: pendingVoidAction?.type === 'cart' ? 'Cashier Cart Void' : 'Cashier Item Void',
            items: pendingVoidAction?.type === 'item' ? [{ product_id: pendingVoidAction.productId, quantity: 1 }] : items.map(item => ({ product_id: item.id, quantity: item.cart_quantity })),
            sale_id: null
          }}
          title={pendingVoidAction?.type === 'cart' ? "Manager Auth Required" : "Void Item Auth"}
          description="Admin authorization required"
        />
      )}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 p-10 max-w-md w-full shadow-2xl rounded-xl">
            <h2 className="text-[14px] font-black mb-8 uppercase tracking-[0.2em] italic text-slate-900 underline underline-offset-8 decoration-indigo-500">Identify Member</h2>
            <div className="relative mb-6">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
               <input 
                type="text" 
                placeholder="Scan member card..."
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded pl-11 pr-4 py-3 outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] font-black italic"
                onChange={(e) => setCustomerSearch(e.target.value)}
               />
            </div>
            <div className="max-h-[300px] overflow-auto space-y-1.5 pr-2 custom-scrollbar">
              {customers
                .filter(c => (c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.rfid_card && c.rfid_card.includes(customerSearch))) && c.credit_status === 'ACTIVE')
                .map(c => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCustomer(c); setShowCustomerModal(false); }}
                  className="w-full p-4 bg-white border border-slate-100 hover:border-indigo-600/50 rounded text-left transition-all group"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-black text-slate-900 group-hover:text-indigo-600 uppercase italic tracking-tighter text-[11px] transition-colors">{c.name}</div>
                      <div className="text-[7px] text-slate-400 font-black tracking-widest mt-1 italic">{c.rfid_card || 'No Card'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-black text-orange-600 italic">{currency.symbol}{c.current_balance.toFixed(2)}</div>
                      <div className="text-[7px] text-slate-400 font-black uppercase tracking-widest">Account Balance</div>
                    </div>
                  </div>
                </button>
              ))}
              {customers.length === 0 && (
                <div className="text-center py-10 text-slate-400 italic font-black text-[9px] tracking-widest uppercase">No registered members found.</div>
              )}
            </div>
            <button onClick={() => setShowCustomerModal(false)} className="w-full mt-8 py-3 text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] hover:text-slate-900 transition-colors italic">CANCEL</button>
          </div>
        </div>
      )}
    </div>
  );
}

