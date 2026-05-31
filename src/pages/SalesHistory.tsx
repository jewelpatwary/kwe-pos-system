import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Filter, Eye, Printer, User, X, Hash, CreditCard } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function SalesHistory() {
  const navigate = useNavigate();
  const { currency } = useTheme();
  const [sales, setSales] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { token } = useAuthStore();

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/sales', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSales(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleViewSale = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSale(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSales = sales.filter(s => 
    s.id.toString().includes(search) || 
    s.payment_method.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md transition-colors">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search Invoice (ID/Method)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
          />
        </div>
        
        <div className="flex-1"></div>
        <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded hover:bg-slate-50 transition flex items-center gap-2 font-black shadow-sm active:scale-95">
            <Filter className="w-3.5 h-3.5" /> Filter Logs
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden transition-colors">
        {/* Sales List */}
        <div className="flex-1 overflow-auto border-r border-slate-200 bg-white custom-scrollbar">
            {loading && sales.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                    <div className="animate-pulse tracking-[0.5em] font-black text-slate-400 uppercase italic">Loading Sales History...</div>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                        <tr className="text-slate-400 bg-slate-50/80 backdrop-blur-md font-black">
                            <th className="py-4 px-6 border-r border-slate-200">Invoice ID</th>
                            <th className="py-4 px-6 border-r border-slate-200">Date & Time</th>
                            <th className="py-4 px-6 border-r border-slate-200">Payment Method</th>
                            <th className="py-4 px-6 text-right border-r border-slate-200">Total Price</th>
                            <th className="py-4 px-6 text-center font-black">Audit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 transition-colors">
                        {filteredSales.map((sale) => (
                            <tr 
                                key={sale.id} 
                                className={`hover:bg-slate-50 cursor-pointer transition-all group ${selectedSale?.id === sale.id ? 'bg-indigo-50 ' : ''}`}
                                onClick={() => handleViewSale(sale.id)}
                            >
                                <td className="py-4 px-6 border-r border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-900 tracking-tighter">INV-x{sale.id.toString().padStart(6, '0')}</span>
                                        {sale.status === 'voided' && <span className="bg-red-500/10 border border-red-500/30 text-red-600 text-[7px] px-1.5 py-0.5 rounded font-black">VOIDED</span>}
                                    </div>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-black">
                                    {new Date(sale.created_at).toLocaleString()}
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100">
                                    <span className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600 font-black text-[8px] transition-colors">
                                        {sale.payment_method === 'ONLINE' ? 'TNG' : sale.payment_method}
                                    </span>
                                </td>
                                <td className="py-4 px-6 border-r border-slate-100 text-right font-black text-slate-900 underline decoration-indigo-200 underline-offset-4">
                                    {currency.symbol}{sale.total_amount.toFixed(2)}
                                </td>
                                <td className="py-4 px-6 text-center">
                                    <Eye className="w-3.5 h-3.5 mx-auto text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>

        {/* Selected Sale Preview */}
        {selectedSale && (
          <div className="w-[450px] shrink-0 bg-slate-50 border-l border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 transition-colors shadow-2xl">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center transition-colors">
              <div>
                <h2 className="text-slate-900 font-black italic tracking-tighter uppercase underline decoration-indigo-500 underline-offset-4 decoration-2">
                   Sale Details: INV-x{selectedSale.id.toString().padStart(6, '0')}
                </h2>
                <div className="text-[8px] text-slate-400 font-black mt-0.5 tracking-widest">{new Date(selectedSale.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                  <button className="p-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:text-indigo-600 transition-all shadow-sm active:scale-90">
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setSelectedSale(null)} className="p-1.5 bg-white border border-slate-200 rounded text-slate-400 hover:text-red-500 transition-all shadow-sm active:scale-90">
                    <X className="w-3.5 h-3.5" />
                  </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6 custom-scrollbar space-y-8 bg-white transition-colors">
                <div className="p-4 bg-slate-50 border border-slate-200 rounded flex items-center gap-3 shadow-inner">
                   <User className="w-4 h-4 text-indigo-600" />
                   <span className="text-slate-500 font-black italic tracking-widest text-[9px] uppercase">Walk-In Customer</span>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] border-b border-slate-200 pb-1 italic">Items List</h3>
                    <div className="space-y-2">
                        {selectedSale.items?.map((item: any, i: number) => (
                            <div key={i} className="bg-slate-50/50 p-3 border border-slate-100 flex justify-between items-center group hover:bg-slate-100 transition-colors">
                                <div>
                                    <div className="font-black text-slate-900 italic tracking-tighter uppercase">{item.product_name}</div>
                                    <div className="text-[7px] text-slate-400 font-black mt-1 uppercase tracking-widest italic">{item.quantity} UNIT x {currency.symbol}{item.unit_price.toFixed(2)}</div>
                                </div>
                                <div className="font-black text-indigo-600 italic underline decoration-indigo-100 underline-offset-2 tracking-tighter">{currency.symbol}{item.subtotal.toFixed(2)}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 bg-slate-50 p-4 border-t border-b border-slate-200 font-black transition-colors shadow-inner">
                    <div className="flex justify-between items-center text-slate-400">
                        <span>Subtotal</span>
                        <span className="italic">{currency.symbol}{(selectedSale.total_amount + selectedSale.discount_amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-600">
                        <span>Discount</span>
                        <span className="italic">-{currency.symbol}{selectedSale.discount_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-900 text-xl border-t border-slate-200 pt-3 tracking-tighter underline underline-offset-4 decoration-indigo-500 decoration-2">
                        <span>Total Paid</span>
                        <span className="italic font-sans underline decoration-current">{currency.symbol}{selectedSale.total_amount.toFixed(2)}</span>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-indigo-600 italic tracking-widest text-[8px] pt-2 transition-colors">
                        <div className="flex items-center gap-1.5 underline decoration-indigo-500/30 underline-offset-4">
                            <CreditCard className="w-3 h-3" />
                            Settled : {selectedSale.payment_method === 'ONLINE' ? 'TNG' : selectedSale.payment_method}
                        </div>
                        <span className="text-slate-300 font-sans tracking-tighter uppercase">Verified</span>
                    </div>
                </div>
            </div>
            
            <div className="p-3 bg-slate-50 border-t border-slate-200 transition-colors">
                <button onClick={() => setSelectedSale(null)} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-black tracking-[0.2em] hover:bg-slate-50 hover:text-slate-900 transition shadow-sm text-[9px] uppercase italic active:scale-95">
                    Close
                </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
}
