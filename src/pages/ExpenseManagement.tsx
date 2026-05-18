import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../components/ThemeProvider';
import { 
  Plus, Search, Trash2, Filter, Calendar, 
  ChevronRight, ArrowLeft, Download, 
  Receipt, Wallet, CreditCard, Banknote,
  CheckCircle2, AlertCircle, History, TrendingDown, X,
  BarChart3, Settings, PieChart, Tag
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RePieChart, Pie
} from 'recharts';

const INITIAL_CATEGORIES = [
  'Rent', 'Salary', 'Electricity Bill', 'Water Bill', 
  'Internet / WiFi', 'Hostel / Accommodation', 
  'Maintenance', 'Equipment Purchase', 'Office Supplies', 'Misc'
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function ExpenseManagement() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'list' | 'create' | 'report' | 'categories'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ 
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });
  const [availableCategories, setAvailableCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [newCatName, setNewCatName] = useState('');

  const { token } = useAuthStore();
  const { currency } = useTheme();

  const [newExpense, setNewExpense] = useState({
    category: '',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'CASH'
  });

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, dateRange.from, dateRange.to]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/expenses?search=${searchQuery}&category=${categoryFilter}&from=${dateRange.from}&to=${dateRange.to}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setExpenses(data.data);
        // Sync categories if they show up in data but not in available list
        const dataCats = Array.from(new Set(data.data.map((e: any) => e.category) as string[]));
        setAvailableCategories(prev => Array.from(new Set([...prev, ...dataCats])));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const reportData = useMemo(() => {
    const summary: Record<string, number> = {};
    expenses.forEach(e => {
        summary[e.category] = (summary[e.category] || 0) + e.amount;
    });
    return Object.entries(summary).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const createExpense = async () => {
    if (!newExpense.category || !newExpense.amount || !newExpense.date) {
      alert('Please fill category, amount and date');
      return;
    }
    try {
      const res = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(newExpense)
      });
      const data = await res.json();
      if (data.success) {
        setView('list');
        fetchExpenses();
        setNewExpense({ category: '', description: '', amount: '', date: new Date().toISOString().split('T')[0], payment_method: 'CASH' });
      }
    } catch (err) { console.error(err); }
  };

  const deleteExpense = async (id: number) => {
    setExpenseToDelete(id);
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      const res = await fetch(`/api/admin/expenses/${expenseToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchExpenses();
    } catch (err) { console.error(err); }
    finally { setExpenseToDelete(null); }
  };

  if (view === 'report') {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shadow-md z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-1.5 hover:bg-slate-200 rounded transition text-slate-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-black text-slate-900 tracking-widest">Expense Analytics</span>
          </div>
          <div className="flex gap-2">
            <input 
               type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})}
               className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-[8px] font-black"
            />
            <span className="self-center">TO</span>
            <input 
               type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})}
               className="bg-white border border-slate-200 rounded px-2 py-1 outline-none text-[8px] font-black"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded shadow-sm">
                 <h3 className="font-black text-slate-900 italic tracking-widest mb-6 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-500" /> Category Distribution
                 </h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <RePieChart>
                          <Pie
                            data={reportData}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            label={({name}) => name.toUpperCase()}
                          >
                             {reportData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Pie>
                          <Tooltip />
                       </RePieChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-6 rounded shadow-sm">
                 <h3 className="font-black text-slate-900 italic tracking-widest mb-6 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-500" /> Financial Magnitude by Tag
                 </h3>
                 <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={reportData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#2d303b22" />
                          <XAxis dataKey="name" tick={{fontSize: 8, fontWeight: 'bold'}} />
                          <YAxis tick={{fontSize: 8, fontWeight: 'bold'}} />
                          <Tooltip cursor={{fill: 'transparent'}} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {reportData.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

           <div className="bg-white border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                       <th className="py-3 px-6 font-black tracking-widest uppercase italic">CATEGORY</th>
                       <th className="py-3 px-6 font-black tracking-widest uppercase italic text-right">Total Debit</th>
                       <th className="py-3 px-6 font-black tracking-widest uppercase italic text-right">Volume</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                    {reportData.map((row, i) => (
                       <tr key={i} className="hover:bg-slate-50">
                          <td className="py-3 px-6 font-black text-slate-900 italic">{row.name}</td>
                          <td className="py-3 px-6 text-right font-black text-red-500 italic">{currency.symbol}{row.value.toFixed(2)}</td>
                          <td className="py-3 px-6 text-right font-bold text-slate-400">
                             {((row.value / reportData.reduce((acc, r) => acc + r.value, 0)) * 100).toFixed(1)}%
                          </td>
                       </tr>
                    ))}
                    <tr className="bg-slate-50 font-black text-lg">
                       <td className="py-4 px-6 italic">GRAND_TOTAL</td>
                       <td className="py-4 px-6 text-right text-red-600 underline decoration-indigo-500 decoration-2 underline-offset-4">
                          {currency.symbol}{reportData.reduce((acc, r) => acc + r.value, 0).toFixed(2)}
                       </td>
                       <td className="py-4 px-6 text-right">100.0%</td>
                    </tr>
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'categories') {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shadow-md z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-1.5 hover:bg-slate-200 rounded transition text-slate-500">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="font-black text-slate-900 tracking-widest">CATEGORY_REGISTRY_MANAGER</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-12">
           <div className="max-w-md mx-auto space-y-8">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg shadow-sm">
                 <label className="text-slate-400 font-black tracking-widest uppercase italic block mb-3">CONSTRUCT_NEW_CATEGORY</label>
                 <div className="flex gap-2">
                    <input 
                       type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)}
                       placeholder="CATEGORY_NAME..."
                       className="flex-1 bg-white border border-slate-200 rounded px-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 font-black italic shadow-inner"
                    />
                    <button 
                       onClick={() => {
                          if (newCatName && !availableCategories.includes(newCatName)) {
                             setAvailableCategories([...availableCategories, newCatName]);
                             setNewCatName('');
                          }
                       }}
                       className="bg-indigo-600 text-white px-4 py-2 rounded font-black tracking-widest shadow-lg shadow-indigo-500/20"
                    >
                       ADD
                    </button>
                 </div>
              </div>

              <div className="space-y-2">
                 <h4 className="font-black text-slate-400 text-[8px] tracking-[0.3em] italic uppercase pl-2 mb-4">ACTIVE_ENTITIES</h4>
                 <div className="grid grid-cols-1 gap-2">
                    {availableCategories.map(cat => (
                       <div key={cat} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded group hover:border-indigo-500/30 transition-all">
                          <span className="font-black text-slate-900 italic tracking-widest flex items-center gap-2">
                             <Tag className="w-3 h-3 text-indigo-500" /> {cat}
                          </span>
                          <button 
                             onClick={() => setAvailableCategories(availableCategories.filter(c => c !== cat))}
                             className="text-slate-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                             <X className="w-3.5 h-3.5" />
                          </button>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center gap-4 shadow-md z-20">
          <button onClick={() => setView('list')} className="p-1.5 hover:bg-slate-200 rounded transition text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-black text-slate-900 tracking-widest">PROVISION_EXPENSE_ENTRY</span>
        </div>
        <div className="flex-1 overflow-auto p-12 bg-white">
            <div className="max-w-xl mx-auto bg-slate-50 border border-slate-200 p-8 rounded-lg shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Receipt size={64} className="text-slate-900" />
               </div>
               <div className="space-y-6 relative z-10">
                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <label className="text-slate-400 font-black tracking-widest">CATEGORY_TYPE</label>
                        <select 
                          value={newExpense.category}
                          onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                          className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-black italic shadow-inner"
                        >
                          <option value="">SELECT_VEC</option>
                          {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-slate-400 font-black tracking-widest">CREDIT_VAL</label>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600 font-black">{currency.symbol}</span>
                           <input 
                             type="number" 
                             value={newExpense.amount}
                             onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                             placeholder="0.00"
                             className="w-full bg-white border border-slate-200 text-slate-900 pl-9 pr-4 py-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-black italic shadow-inner"
                           />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-1">
                     <label className="text-slate-400 font-black tracking-widest">PAYLOAD_DESC</label>
                     <textarea 
                       rows={3}
                       value={newExpense.description}
                       onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                       placeholder="EXPENSE_LOG_DETAILS..."
                       className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-black italic resize-none shadow-inner"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="space-y-1">
                        <label className="text-slate-400 font-black tracking-widest">TIMESTAMP</label>
                        <input 
                          type="date" 
                          value={newExpense.date}
                          onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                          className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-black shadow-inner"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-slate-400 font-black tracking-widest">SETTLE_METHOD</label>
                        <select 
                          value={newExpense.payment_method}
                          onChange={(e) => setNewExpense({ ...newExpense, payment_method: e.target.value })}
                          className="w-full bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded focus:ring-1 focus:ring-indigo-500 outline-none font-black italic shadow-inner"
                        >
                          <option value="CASH">CASH_NODE</option>
                          <option value="BANK">L_BANK_TRX</option>
                          <option value="ONLINE">TNG</option>
                        </select>
                     </div>
                  </div>

                  <button 
                    onClick={createExpense}
                    className="w-full bg-indigo-600 text-white font-black py-4 rounded-lg shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 transition transform active:scale-[0.98] tracking-[0.2em] mt-4"
                  >
                     SAVE_EXPENSE
                  </button>
               </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="SEARCH_LOGS..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchExpenses()}
            className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded pl-10 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
          />
        </div>
        <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white border border-slate-200 text-slate-900 text-[9px] font-black rounded px-3 py-2 outline-none shadow-inner"
        >
            <option value="">ALL_CATEGORIES</option>
            {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-2 shadow-inner">
           <Calendar className="w-3.5 h-3.5 text-slate-400" />
           <input 
              type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})}
              className="bg-transparent border-none text-slate-900 text-[8px] font-black p-1 outline-none"
           />
           <span className="text-slate-300">/</span>
           <input 
              type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})}
              className="bg-transparent border-none text-slate-900 text-[8px] font-black p-1 outline-none"
           />
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setView('categories')}
                className="p-2 hover:bg-slate-200 rounded transition text-slate-500 relative group"
                title="Manage Categories"
            >
                <Settings className="w-4 h-4" />
            </button>
            <button 
                onClick={() => setView('report')}
                className="bg-slate-100 text-slate-900 px-4 py-2 rounded hover:bg-slate-200 transition flex items-center gap-2 border border-slate-200"
            >
                <BarChart3 className="w-3.5 h-3.5" /> SUMMARY_GEN_X
            </button>
            <button 
                onClick={() => setView('create')}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
            >
                <Plus className="w-3.5 h-3.5" /> PROVISION_ENTRY
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && expenses.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400">SCANNING_EXPENSE_LEDGER...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">Timestamp</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Category_Vect</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Payload_Descriptor</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">Settle_Method</th>
                <th className="py-4 px-6 font-black text-right border-r border-slate-200">Debit_Val</th>
                <th className="py-4 px-6 font-black text-center">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-bold">
                    {new Date(expense.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-600 font-black italic tracking-widest leading-none">
                        {expense.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-900 font-black italic">
                    {expense.description || 'NULL_DESC'}
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className="flex items-center gap-2 text-slate-500 font-black italic">
                        {expense.payment_method === 'CASH' ? <Banknote className="w-3.5 h-3.5 text-emerald-600" /> : <CreditCard className="w-3.5 h-3.5 text-indigo-600" />}
                        {expense.payment_method}
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-right text-red-600 font-black italic bg-red-50">
                    {currency.symbol}{expense.amount.toFixed(2)}
                  </td>
                  <td className="py-4 px-6 text-center">
                    <button 
                        onClick={() => deleteExpense(expense.id)}
                        className="p-1.5 hover:text-red-500 text-slate-400 opacity-20 group-hover:opacity-100 transition-opacity"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && !loading && (
                <tr>
                   <td colSpan={6} className="py-20 text-center font-black text-slate-400 tracking-[0.5em]">ZERO_LEDGER_ENTRIES</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div className="flex gap-4">
            <span>EXPENSE_AUDIT • {expenses.length} RECORD_SETS</span>
            <span>TOTAL_DEBIT: <span className="text-red-600 font-black italic">{currency.symbol}{expenses.reduce((acc, e) => acc + e.amount, 0).toFixed(2)}</span></span>
         </div>
         <div>VERIFIED_STAMP : {new Date().toISOString()}</div>
      </div>

      <ConfirmModal
        isOpen={expenseToDelete !== null}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="VOID_EXPENSE_SAVE"
        message="CRITICAL: ARE YOU SURE YOU WANT TO DELETE THIS EXPENSE RECORD? THIS ACTION WILL BE LOGGED IN THE FINANCIAL AUDIT TRAIL."
      />
    </div>
  );
}
