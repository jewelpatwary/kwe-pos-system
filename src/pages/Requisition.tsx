import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Search, Printer, ArrowLeft, 
  ChevronRight, Filter, Truck, Calendar,
  CheckCircle2, AlertCircle, Trash2, Download
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import PrintPreviewModal from '../components/PrintPreviewModal';

export default function Requisition() {
  const { token } = useAuthStore();
  const { currency } = useTheme();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['DUE']);
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (selectedSupplierId) {
      fetchInvoices();
    } else {
      setInvoices([]);
      setSelectedInvoiceIds([]);
    }
  }, [selectedSupplierId, filterStatuses]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSuppliers(data.data);
    } catch (err) { console.error(err); }
  };

  const fetchInvoices = async () => {
    /* setLoading removed to prevent flicker */
    try {
      let url = `/api/admin/purchase-invoices?supplier_id=${selectedSupplierId}`;
      if (filterStatuses.length > 0 && !filterStatuses.includes('ALL')) {
        url += `&status_list=${filterStatuses.join(',')}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data);
        // Clean up selected IDs if they are no longer in the list
        const currentIds = data.data.map((inv: any) => inv.id);
        setSelectedInvoiceIds(prev => prev.filter(id => currentIds.includes(id)));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleInvoiceSelection = (id: number) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectedInvoicesData = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
  
  // Calculate stats for the template
  const totalAmount = selectedInvoicesData.reduce((sum, inv) => sum + (inv.due_amount || inv.total_amount), 0);
  
  const getWeekOfMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate();
    return Math.ceil(day / 7);
  };

  const getMonthAndYear = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
    const year = date.getFullYear().toString().slice(-2);
    return { month, year };
  };

  const currentMonthYear = selectedInvoicesData.length > 0 
    ? getMonthAndYear(selectedInvoicesData[0].date)
    : { month: new Date().toLocaleString('default', { month: 'short' }).toUpperCase(), year: new Date().getFullYear().toString().slice(-2) };

  const currentWeek = selectedInvoicesData.length > 0
    ? `WK${getWeekOfMonth(selectedInvoicesData[0].date)}`
    : `WK${Math.ceil(new Date().getDate() / 7)}`;

  const renderTemplateContent = () => (
    <div className="w-full flex-1 flex flex-col font-mono text-left bg-white text-slate-900" style={{ fontFamily: 'monospace' }}>
       {/* TEMPLATE HEADER */}
       <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold bg-white text-black py-2 border-b-2 border-black text-left leading-tight">
            BINA SENTUHAN TRANSACTION SUMMARY OF CREDIT FOR {currentMonthYear.month}'{currentMonthYear.year} {currentWeek}
          </h1>
          <div className="flex justify-end mt-2 text-xs italic text-slate-500 font-bold">
             LAST UPDATE : {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}
          </div>
       </div>

       <div className="mb-4 text-left">
          <h2 className="text-base font-bold border-b-2 border-black inline-block pb-1">
            SUPPLIER NAME: {suppliers.find(s => s.id.toString() === selectedSupplierId)?.name || 'N/A'}
          </h2>
       </div>

       {/* TEMPLATE TABLE */}
       <table className="w-full border-collapse border border-black mb-6 text-xs text-slate-900 font-mono">
          <thead>
             <tr className="bg-slate-100/90 font-bold text-black border-b border-black">
                <th className="border border-black p-1.5 text-center">DATE</th>
                <th className="border border-black p-1.5 text-left">COMPANY NAME</th>
                <th className="border border-black p-1.5 text-center">INV NO.</th>
                <th className="border border-black p-1.5 text-center">CATEGORY</th>
                <th className="border border-black p-1.5 text-center">PAID BY</th>
                <th className="border border-black p-1.5 text-center">TYPE</th>
                <th className="border border-black p-1.5 text-center">WEEK</th>
                <th className="border border-black p-1.5 text-right">AMOUNT ({currency.symbol})</th>
             </tr>
          </thead>
          <tbody>
             {selectedInvoicesData.map((inv) => (
                <tr key={inv.id} className="border-b border-black">
                   <td className="border border-black p-1.5 text-center">
                     {new Date(inv.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')}
                   </td>
                   <td className="border border-black p-1.5 text-left">{inv.supplier_name}</td>
                   <td className="border border-black p-1.5 text-center font-bold">{inv.invoice_number}</td>
                   <td className="border border-black p-1.5 text-center italic text-slate-700">{inv.category_name}</td>
                   <td className="border border-black p-1.5 text-center text-slate-700">KL PAID</td>
                   <td className="border border-black p-1.5 text-center text-slate-700">{inv.payment_type}</td>
                   <td className="border border-black p-1.5 text-center font-bold">W{getWeekOfMonth(inv.date)}</td>
                   <td className="border border-black p-1.5 text-right font-bold">
                     {(inv.due_amount || inv.total_amount).toFixed(2)}
                   </td>
                </tr>
             ))}
             {/* Empty rows to maintain structure if needed */}
             {[...Array(Math.max(0, 5 - selectedInvoiceIds.length))].map((_, i) => (
                <tr key={`empty-${i}`} className="border-b border-black">
                   <td className="border border-black p-1.5 h-8"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                   <td className="border border-black p-1.5"></td>
                </tr>
             ))}
             <tr className="bg-slate-50 border-t-2 border-black font-bold">
                <td colSpan={7} className="border border-black p-2 text-right font-black text-xs uppercase">TOTAL :</td>
                <td className="border-2 border-black p-2 text-right font-black text-xs underline decoration-double underline-offset-4 font-mono text-black">
                  {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
             </tr>
          </tbody>
       </table>

       {/* TEMPLATE FOOTER */}
       <div className="mt-auto pt-10 grid grid-cols-3 gap-8 text-center text-xs font-bold text-black font-mono">
          <div className="flex flex-col items-center">
             <div className="font-bold border-b border-slate-900 w-full pb-1 mb-1">Requested By,</div>
             <div className="h-14 flex items-end justify-center w-full">
                <div className="w-full border-b border-black border-dotted"></div>
             </div>
             <div className="mt-2 font-bold uppercase">JAMAL</div>
             <div className="text-[9px] italic font-normal text-slate-500">Applicant</div>
          </div>

          <div className="flex flex-col items-center">
             <div className="font-bold border-b border-slate-900 w-full pb-1 mb-1">Verified By,</div>
             <div className="h-14 flex items-end justify-center w-full">
                <div className="w-full border-b border-black border-dotted"></div>
             </div>
             <div className="mt-2 font-bold uppercase">HOW</div>
             <div className="text-[9px] italic font-normal text-slate-500">Admin department</div>
          </div>

          <div className="flex flex-col items-center">
             <div className="font-bold border-b border-slate-900 w-full pb-1 mb-1">Approved By,</div>
             <div className="h-14 flex items-end justify-center w-full">
                <div className="w-full border-b border-black border-dotted"></div>
             </div>
             <div className="mt-2 font-bold uppercase"></div>
             <div className="text-[9px] italic font-normal text-slate-500">M. Director</div>
          </div>
       </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 text-slate-800 font-sans text-xs uppercase">
      {/* Filters Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 mb-1.5 tracking-widest uppercase">Select Supplier</label>
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select 
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-10 pr-4 py-2 font-black text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
              >
                <option value="">Choose a vendor...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 mb-1.5 tracking-widest uppercase">Multi-Status Filter</label>
            <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200 gap-1">
              {(['DUE', 'PAID', 'PARTIAL', 'ALL'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => {
                    if (type === 'ALL') {
                      setFilterStatuses(['ALL']);
                      return;
                    }
                    setFilterStatuses(prev => {
                      const withoutAll = prev.filter(s => s !== 'ALL');
                      if (withoutAll.includes(type)) {
                        const next = withoutAll.filter(s => s !== type);
                        return next.length === 0 ? ['ALL'] : next;
                      }
                      return [...withoutAll, type];
                    });
                  }}
                  className={`px-4 py-1.5 rounded text-[9px] font-black tracking-widest transition-all ${
                    filterStatuses.includes(type) 
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="ml-auto flex gap-3">
             <button 
              onClick={() => setShowPrintModal(true)}
              disabled={selectedInvoiceIds.length === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded font-black flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:shadow-none"
             >
                <Printer className="w-4 h-4" /> GENERATE REQUISITION
             </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        {/* Invoice Selector Panel */}
        <div className="w-full md:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 tracking-widest flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" /> AVAILABLE INVOICES
            </h3>
            <span className="bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-[8px] font-black">
              {invoices.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-50">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-black tracking-[0.3em]">FETCHING_DATA...</span>
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-20 opacity-30 select-none">
                <Search className="w-12 h-12 mx-auto mb-4" />
                <p className="font-black tracking-widest italic">{selectedSupplierId ? 'NO INVOICES MATCHING CRITERIA' : 'SELECT A SUPPLIER TO BEGIN'}</p>
              </div>
            ) : (
              invoices.map(inv => (
                <div 
                  key={inv.id}
                  onClick={() => toggleInvoiceSelection(inv.id)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedInvoiceIds.includes(inv.id)
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-md ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-black text-slate-900 tracking-tighter text-[11px]">{inv.invoice_number}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${
                      inv.payment_status === 'PAID' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-orange-50 border-orange-200 text-orange-600'
                    }`}>
                      {inv.payment_status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                       <span className="text-slate-400 text-[8px] tracking-widest flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {new Date(inv.date).toLocaleDateString()}
                       </span>
                       <span className="text-[8px] text-slate-500 font-bold uppercase">{inv.category_name}</span>
                    </div>
                    <div className="text-right">
                       <span className="font-black text-slate-900">{currency.symbol}{(inv.due_amount || inv.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Viewport / Template Preview */}
        <div className="flex-1 bg-slate-200/50 p-8 overflow-auto custom-scrollbar flex justify-center">
           {selectedInvoiceIds.length === 0 ? (
             <div className="flex flex-col items-center justify-center opacity-30 select-none max-w-md text-center">
                <Printer className="w-20 h-20 mb-6" />
                <h2 className="text-xl font-black tracking-widest mb-2 italic">REQUISITION_PREVIEW</h2>
                <p className="font-bold tracking-widest">Select invoices from the left panel to generate the transaction summary requisition report.</p>
             </div>
           ) : (
             <div 
               className="bg-white w-full max-w-5xl shadow-2xl p-12 min-h-[1056px] flex flex-col"
             >
                {renderTemplateContent()}
             </div>
           )}
        </div>
      </div>

      <PrintPreviewModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Purchase Requisition Summary Report"
        hideHeader={true}
      >
        {renderTemplateContent()}
      </PrintPreviewModal>
    </div>
  );
}
