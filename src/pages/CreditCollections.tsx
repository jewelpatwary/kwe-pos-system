import React, { useState, useEffect } from 'react';
import { Banknote, Search, Printer, DollarSign } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import PrintPreviewModal from '../components/PrintPreviewModal';

export default function CreditCollections() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all, paid, unpaid
  const [month, setMonth] = useState(''); // 1-12 or ''
  const [year, setYear] = useState(''); // YYYY or ''
  const [showPrintModal, setShowPrintModal] = useState(false);
  const { token } = useAuthStore();
  const { currency } = useTheme();

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setCustomers(data.data.filter((c: any) => c.credit_limit > 0));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const balance = parseFloat(c.current_balance || '0');
    const matchesStatus = status === 'all' ? true : status === 'paid' ? balance <= 0 : balance > 0;
                
    // For now, month and year don't have direct date fields in customers table, 
    // maybe for future implementation.
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-4 h-full flex flex-col bg-slate-50 text-slate-800 font-sans text-[10px] uppercase">
      <div className="bg-white border border-slate-200 p-3 flex justify-between items-center mb-4 rounded shadow-sm">
        <h1 className="text-sm font-black flex items-center gap-2"><Banknote className="w-4 h-4"/> Credit Collections</h1>
        <div className="flex gap-2">
            <button onClick={() => setShowPrintModal(true)} className="bg-slate-200 px-3 py-1.5 rounded flex items-center gap-1 font-black"><Printer size={12}/> Print Report</button>
        </div>
      </div>

       <div className="bg-white p-4 border border-slate-200 mb-4 rounded shadow-sm grid grid-cols-4 gap-4">
          <div className="relative col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              className="w-full border p-2 pl-9 rounded" 
              placeholder="Search customers..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <select className="border p-2 rounded" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <select className="border p-2 rounded" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="">Month</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="border p-2 rounded" value={year} onChange={e => setYear(e.target.value)}>
            <option value="">Year</option>
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
       </div>

       <div className="flex-1 overflow-auto border border-slate-200 bg-white rounded shadow-sm" id="report-content">
        <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="py-3 px-4 font-black">Name</th>
                    <th className="py-3 px-4 font-black">Credit Limit</th>
                    <th className="py-3 px-4 font-black">Current Balance</th>
                    <th className="py-3 px-4 font-black text-right no-print">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-black">{c.name}</td>
                        <td className="py-3 px-4">{currency.symbol}{c.credit_limit}</td>
                        <td className="py-3 px-4 font-black text-orange-600">{currency.symbol}{c.current_balance || '0.00'}</td>
                        <td className="py-3 px-4 text-right no-print">
                          <button className="bg-emerald-600 text-white px-3 py-1 rounded font-black flex items-center gap-1 ml-auto">
                            <DollarSign size={10}/> Collect Payment
                          </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
       </div>

       <PrintPreviewModal
         isOpen={showPrintModal}
         onClose={() => setShowPrintModal(false)}
         title="Report Preview"
       >
         <h2 className="text-xl font-bold mb-4">Credit Collections Report</h2>
         <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 border-2">
                <tr>
                    <th className="py-2 px-2 border">Name</th>
                    <th className="py-2 px-2 border">Credit Limit</th>
                    <th className="py-2 px-2 border">Current Balance</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(c => (
                    <tr key={c.id}>
                        <td className="py-2 px-2 border">{c.name}</td>
                        <td className="py-2 px-2 border">{currency.symbol}{c.credit_limit}</td>
                        <td className="py-2 px-2 border">{currency.symbol}{c.current_balance || '0.00'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
       </PrintPreviewModal>
    </div>
  );
}
