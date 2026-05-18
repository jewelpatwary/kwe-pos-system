import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Activity
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { currency } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'recent'>('daily');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'recent') {
      fetchRecentActivity();
    } else {
      fetchDailyReport();
    }
  }, [activeTab, reportMonth]);

  const fetchRecentActivity = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/detailed-sales-report-rows?limit=100', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setRecentSales(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/daily-pdf-report?month=${reportMonth}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDailyData(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('default', { month: 'short' });
  };
  
  const getFullMonthName = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('default', { month: 'long' });
  };

  const reportRows = useMemo(() => {
    if (!dailyData) return [];
    
    // Create an array for all days in the selected month
    const [year, month] = reportMonth.split('-');
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    
    const rows = [];
    const monthShort = getMonthName(reportMonth);
    const yrShort = year.substring(2, 4);
    
    const categories = dailyData.categories.map((c: any) => c.name);

    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = i.toString().padStart(2, '0');
        const dbDate = `${reportMonth}-${dStr}`; // YYYY-MM-DD
        const displayDate = `${dStr}-${monthShort}-${yrShort}`;

        const row: any = { displayDate };
        categories.forEach((cat: string) => row[cat] = 0);
        row.totalCash = 0;
        row.totalCredit = 0;
        row.canteenCashPurchase = 0;
        row.canteenCreditPurchase = 0;
        row.minimartCashPurchase = 0;
        row.minimartCreditPurchase = 0;

        // Sales by category calculations
        dailyData.salesByCategory.forEach((s: any) => {
             if (s.date === dbDate) {
                 if (row.hasOwnProperty(s.category)) row[s.category] += s.total;
                 else row[categories[0]] += s.total; // Default to first category
             }
        });
        dailyData.returnsByCategory.forEach((s: any) => {
             if (s.date === dbDate) {
                 if (row.hasOwnProperty(s.category)) row[s.category] -= s.total;
                 else row[categories[0]] -= s.total;
             }
        });

        // Cash / Credit Sales
        dailyData.salesByPaymentMethod.forEach((s: any) => {
            if (s.date === dbDate) {
                if (s.payment_method === 'CASH' || s.payment_method === 'ONLINE') row.totalCash += s.total;
                else row.totalCredit += s.total;
            }
        });
        dailyData.returnsByPaymentMethod.forEach((s: any) => {
            if (s.date === dbDate) {
                if (s.payment_method === 'CASH' || s.payment_method === 'ONLINE') row.totalCash -= s.total;
                else row.totalCredit -= s.total;
            }
        });

        // Purchases
        dailyData.purchases.forEach((p: any) => {
            if (p.date === dbDate) {
                const isCanteen = p.category.includes('MEAL') || p.category.includes('DRINK') || p.category.includes('CANTEEN');
                if (isCanteen) {
                    if (p.payment_status === 'PAID') row.canteenCashPurchase += p.total;
                    else row.canteenCreditPurchase += p.total;
                } else {
                    if (p.payment_status === 'PAID') row.minimartCashPurchase += p.total;
                    else row.minimartCreditPurchase += p.total;
                }
            }
        });

        rows.push(row);
    }

    return rows;
  }, [dailyData, reportMonth]);

  const totals = useMemo(() => {
    if (!dailyData) return {};
    const categories = dailyData.categories.map((c: any) => c.name);
    
    const initialTotals: any = {
        totalCash: 0, totalCredit: 0, canteenCashPurchase: 0, canteenCreditPurchase: 0, minimartCashPurchase: 0, minimartCreditPurchase: 0
    };
    categories.forEach((cat: string) => initialTotals[cat] = 0);

    return reportRows.reduce((acc, row) => {
        categories.forEach((cat: string) => acc[cat] += row[cat]);
        acc.totalCash += row.totalCash;
        acc.totalCredit += row.totalCredit;
        acc.canteenCashPurchase += row.canteenCashPurchase;
        acc.canteenCreditPurchase += row.canteenCreditPurchase;
        acc.minimartCashPurchase += row.minimartCashPurchase;
        acc.minimartCreditPurchase += row.minimartCreditPurchase;
        return acc;
    }, initialTotals);
  }, [reportRows, dailyData]);

  const expenses = useMemo(() => {
    const list = dailyData ? dailyData.expenses : [];
    let net = (totals.totalCash + totals.totalCredit) - (totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase);
    let totalExp = 0;
    
    // Default mapped expenses
    const mappings: {[key: string]: number} = {
        '-CANTEEN RENT': 0,
        '-WORKER SALARY': 0,
        '-ELECTRICITY': 0,
        '-WATER BILL': 0,
        '-WIFI BILL': 0,
        '-OTHERS BILL': 0
    };

    list.forEach((e: any) => {
        const cat = e.category.toUpperCase();
        if (cat.includes('RENT')) mappings['-CANTEEN RENT'] += e.total;
        else if (cat.includes('SALARY') || cat.includes('WAGE')) mappings['-WORKER SALARY'] += e.total;
        else if (cat.includes('ELECTRIC')) mappings['-ELECTRICITY'] += e.total;
        else if (cat.includes('WATER')) mappings['-WATER BILL'] += e.total;
        else if (cat.includes('WIFI') || cat.includes('INTERNET')) mappings['-WIFI BILL'] += e.total;
        else mappings['-OTHERS BILL'] += e.total;
        
        totalExp += e.total;
    });

    net -= totalExp;

    return { mappings, net, profitBeforeExp: (totals.totalCash + totals.totalCredit) - (totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase) };
  }, [dailyData, totals]);

  const { totalMinimartSales, totalCanteenSales } = useMemo(() => {
    if (!dailyData) return { totalMinimartSales: 0, totalCanteenSales: 0 };
    const categories = dailyData.categories.map((c: any) => c.name);
    
    let minimart = 0, canteen = 0;
    categories.forEach((cat: string) => {
        if (cat.includes('SNACK') || cat.includes('GROCER')) minimart += totals[cat] || 0;
        if (cat.includes('MEAL') || cat.includes('DRINK') || cat.includes('CANTEEN')) canteen += totals[cat] || 0;
    });
    return { totalMinimartSales: minimart, totalCanteenSales: canteen };
  }, [totals, dailyData]);

  return (
    <div className="p-0 h-full flex flex-col bg-slate-50 text-slate-800 font-sans text-[10px] transition-colors duration-300">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex bg-slate-100 p-1 rounded">
            <button 
                onClick={() => setActiveTab('daily')} 
                className={`px-4 py-2 font-black flex items-center gap-2 rounded transition-colors ${activeTab === 'daily' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <FileText className="w-4 h-4" /> DAILY PDF REPORT
            </button>
            <button 
                onClick={() => setActiveTab('recent')} 
                className={`px-4 py-2 font-black flex items-center gap-2 rounded transition-colors ${activeTab === 'recent' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
            >
                <Activity className="w-4 h-4" /> RECENT ACTIVITY
            </button>
        </div>

        {activeTab === 'daily' && (
             <div className="flex items-center gap-4">
                 <input 
                    type="month" 
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="border border-slate-200 px-3 py-2 rounded text-slate-900 font-black cursor-pointer shadow-sm outline-none"
                 />
                 <button className="bg-indigo-600 text-white px-4 py-2 rounded font-black shadow-md hover:bg-indigo-700 active:scale-95 transition-all text-[11px]" onClick={() => window.print()}>PRINT PDF</button>
             </div>
        )}
      </div>

      <div className="flex-1 border-t border-slate-200 printable-area overflow-auto">
        {activeTab === 'daily' ? (
           <div className="bg-white m-8 p-12 border border-slate-200 shadow-xl max-w-[1200px] mx-auto pdf-container font-sans">
              <style dangerouslySetInnerHTML={{__html: `
                 @media print {
                     body * { visibility: hidden; }
                     .printable-area * { visibility: visible; }
                     .printable-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0;}
                     .pdf-container { margin: 0; box-shadow: none; border: none; width: 100%; max-width: 100%;}
                     @page { margin: 0.5cm; }
                     .bg-pink-100 { background-color: #fce7f3 !important; -webkit-print-color-adjust: exact; }
                     .bg-red-200 { background-color: #fecaca !important; -webkit-print-color-adjust: exact; }
                     .bg-red-300 { background-color: #fca5a5 !important; -webkit-print-color-adjust: exact; }
                     .bg-red-400 { background-color: #f87171 !important; -webkit-print-color-adjust: exact; }
                     .bg-sky-200 { background-color: #bae6fd !important; -webkit-print-color-adjust: exact; }
                     .bg-blue-300 { background-color: #93c5fd !important; -webkit-print-color-adjust: exact; }
                     .bg-blue-400 { background-color: #60a5fa !important; -webkit-print-color-adjust: exact; }
                     .bg-yellow-100 { background-color: #fef9c3 !important; -webkit-print-color-adjust: exact; }
                 }
              `}}/>
              
              <h1 className="text-center text-lg font-bold uppercase mb-8 pb-2 tracking-wide">
                 DAILY SALES AND PURCHASE SUMMARY - {getFullMonthName(reportMonth)} {reportMonth.split('-')[0]}
              </h1>

              {loading ? (
                <div className="py-20 text-center animate-pulse text-indigo-600 font-bold uppercase tracking-widest text-[11px]">Loading Document Data...</div>
              ) : (
                <div className="space-y-6">
                    <table className="w-full border-collapse text-[10px] sm:text-[11px] border-2 border-black">
                        <thead>
                            <tr>
                                <th className="border-2 border-black p-2 font-bold uppercase bg-white">DATE</th>
                                {dailyData?.categories.map((c: any) => (
                                    <th key={c.name} className="border-2 border-black p-2 font-bold uppercase w-[8%] text-center">{c.name}</th>
                                ))}
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center bg-white">TOTAL CASH SALES</th>
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center bg-pink-100/50">TOTAL CREDIT SALES</th>
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center text-[9px] leading-tight break-words">CANTEEN CASH PURCHASE</th>
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center text-[9px] leading-tight break-words">CANTEEN CREDIT PURCHASE</th>
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center text-[9px] leading-tight break-words">MINIMART CASH PURCHASE</th>
                                <th className="border-2 border-black p-2 font-bold uppercase w-[9%] text-center text-[9px] leading-tight break-words">MINIMART CREDIT PURCHASE</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportRows.map((r, i) => (
                                <tr key={i}>
                                    <td className="border-2 border-black px-2 py-1.5 text-center">{r.displayDate}</td>
                                    {dailyData?.categories.map((c: any) => (
                                        <td key={c.name} className="border-2 border-black px-2 py-1.5 text-center">{r[c.name] > 0 ? r[c.name].toFixed(2) : ''}</td>
                                    ))}
                                    <td className="border-2 border-black px-2 py-1.5 text-center font-bold bg-white">{r.totalCash.toFixed(2)}</td>
                                    <td className="border-2 border-black px-2 py-1.5 font-bold bg-pink-100">{r.totalCredit > 0 ? r.totalCredit.toFixed(2) : ''}</td>
                                    <td className="border-2 border-black px-2 py-1.5 text-center">{r.canteenCashPurchase > 0 ? r.canteenCashPurchase.toFixed(2) : ''}</td>
                                    <td className="border-2 border-black px-2 py-1.5 text-center">{r.canteenCreditPurchase > 0 ? r.canteenCreditPurchase.toFixed(2) : ''}</td>
                                    <td className="border-2 border-black px-2 py-1.5 text-center">{r.minimartCashPurchase > 0 ? r.minimartCashPurchase.toFixed(2) : ''}</td>
                                    <td className="border-2 border-black px-2 py-1.5 text-center">{r.minimartCreditPurchase > 0 ? r.minimartCreditPurchase.toFixed(2) : ''}</td>
                                </tr>
                            ))}
                            <tr className="bg-yellow-100 font-bold">
                                <td className="border-2 border-black px-2 py-2 text-center uppercase text-black font-black bg-white">TOTAL</td>
                                {dailyData?.categories.map((c: any) => (
                                    <td key={c.name} className="border-2 border-black px-2 py-2 text-center">{totals[c.name].toFixed(2)}</td>
                                ))}
                                <td className="border-2 border-black px-2 py-2 text-center bg-white">{totals.totalCash.toFixed(2)}</td>
                                <td className="border-2 border-black px-2 py-2 text-center bg-pink-100 text-black">{totals.totalCredit.toFixed(2)}</td>
                                <td className="border-2 border-black px-2 py-2 text-center bg-white">{totals.canteenCashPurchase.toFixed(2)}</td>
                                <td className="border-2 border-black px-2 py-2 text-center bg-white">{totals.canteenCreditPurchase > 0 ? totals.canteenCreditPurchase.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-2 text-center bg-white">{totals.minimartCashPurchase > 0 ? totals.minimartCashPurchase.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-2 text-center bg-white">{totals.minimartCreditPurchase > 0 ? totals.minimartCreditPurchase.toFixed(2) : ''}</td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex">
                        <table className="w-[48%] border-collapse text-[11px] font-bold border-2 border-black">
                            <tbody>
                                <tr>
                                    <td className="border-2 border-black p-2 uppercase bg-white">TOTAL MINIMART SALES</td>
                                    <td className="border-2 border-black p-2 text-center bg-yellow-100">{totalMinimartSales.toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <td className="border-2 border-black p-2 uppercase bg-white">TOTAL CANTEEN SALES</td>
                                    <td className="border-2 border-black p-2 text-center bg-yellow-100">{totalCanteenSales.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="w-full mt-4">
                        <table className="w-full border-collapse text-[11px] font-bold uppercase text-center border-2 border-black">
                            <tbody>
                                <tr className="bg-sky-200">
                                    <td className="border-2 border-black p-2 w-[20%] text-right pr-6 bg-white shrink-0 font-black text-[12px]">TOTAL SELLS AMOUNT</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.totalCash.toFixed(2)}</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.totalCredit.toFixed(2)}</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.canteenCashPurchase.toFixed(2)}</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.canteenCreditPurchase.toFixed(2)}</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.minimartCashPurchase.toFixed(2)}</td>
                                    <td className="border-2 border-black p-2"><span className="float-left text-gray-500 text-[9px] mt-0.5">RM</span> {totals.minimartCreditPurchase.toFixed(2)}</td>
                                </tr>
                                <tr className="bg-red-300">
                                    <td className="border-2 border-black p-2 text-right pr-6 font-black text-[12px]">TOTAL CASH & CREDIT SALES</td>
                                    <td colSpan={2} className="border-2 border-black p-2 bg-red-300">RM {(totals.totalCash + totals.totalCredit).toFixed(2)}</td>
                                    <td colSpan={2} className="border-2 border-black p-2 bg-sky-200">RM {(totals.canteenCashPurchase + totals.canteenCreditPurchase).toFixed(2)}</td>
                                    <td colSpan={2} className="border-2 border-black p-2 bg-slate-200">RM {(totals.minimartCashPurchase + totals.minimartCreditPurchase).toFixed(2)}</td>
                                </tr>
                                <tr className="bg-red-400 text-black">
                                    <td colSpan={5} className="border-2 border-black p-2 text-right pr-6 font-black text-[12px]">TOTAL PURCHASED</td>
                                    <td colSpan={2} className="border-2 border-black p-2 text-center font-black">RM {(totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="w-[50%] mt-8 mx-auto">
                         <table className="w-full border-collapse text-[11px] font-bold border-2 border-black">
                            <tbody>
                                 <tr>
                                    <td className="border-2 border-black p-2 uppercase w-[60%]">TOTAL PROFIT</td>
                                    <td className="border-2 border-black p-2 text-right"><span className="float-left text-gray-500">RM</span> {expenses.profitBeforeExp.toFixed(2)}</td>
                                 </tr>
                                 {Object.entries(expenses.mappings).map(([name, amount]: [string, any], idx) => (
                                    <tr key={idx}>
                                        <td className="border-2 border-black p-2 uppercase">{name}</td>
                                        <td className="border-2 border-black p-2 text-right font-normal">{amount > 0 ? (amount as number).toFixed(0) : ''}</td>
                                    </tr>
                                 ))}
                                 <tr className="bg-blue-400 text-black font-black text-[12px]">
                                    <td className="border-2 border-black p-2 uppercase">NET PROFIT</td>
                                    <td className="border-2 border-black p-2 text-right">{expenses.net.toFixed(2)}</td>
                                 </tr>
                            </tbody>
                         </table>
                    </div>
                </div>
              )}
           </div>
        ) : (
          <table className="w-full text-left border-collapse bg-white">
          <thead className="sticky top-0 bg-white z-20 shadow-md border-b border-slate-200">
            <tr className="uppercase tracking-[0.2em] text-slate-400 bg-slate-50/80 backdrop-blur-md">
              <th className="py-4 px-6 font-black border-r border-slate-100">Sale Ref</th>
              <th className="py-4 px-6 font-black border-r border-slate-100">Type</th>
              <th className="py-4 px-6 font-black border-r border-slate-100">Product</th>
              <th className="py-4 px-6 font-black border-r border-slate-100 text-center">Qty</th>
              <th className="py-4 px-6 font-black text-right border-r border-slate-100">Total</th>
              <th className="py-4 px-6 font-black text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {/* Same recent sales logic */}
            {loading ? (
              <tr>
                <td colSpan={6} className="py-20 text-center animate-pulse tracking-[0.5em] text-indigo-600 font-black">
                    Loading sales records...
                </td>
              </tr>
            ) : recentSales.map((sale, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors group">
                <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-black">
                   LOGx{i.toString().padStart(4, '0')}
                </td>
                <td className="py-4 px-6 border-r border-slate-100 text-indigo-600 font-bold italic tracking-widest">
                   RETAIL_SALE
                </td>
                <td className="py-4 px-6 border-r border-slate-100 text-slate-900 font-black uppercase">
                   {sale.product_name}
                </td>
                <td className="py-4 px-6 border-r border-slate-100 text-center text-slate-500 font-bold">
                   [x{sale.qty_sold}]
                </td>
                <td className="py-4 px-6 border-r border-slate-100 text-right text-emerald-600 font-black bg-emerald-50">
                   {currency.symbol}{sale.total_amount?.toFixed(2)}
                </td>
                <td className="py-4 px-6 text-right">
                   <div className="inline-flex items-center gap-2 group-hover:translate-x-[-4px] transition-transform">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-emerald-500 font-black uppercase tracking-tighter">Paid</span>
                   </div>
                </td>
              </tr>
            ))}
            {!loading && recentSales.length === 0 && (
              <tr>
                <td colSpan={6} className="py-20 text-center text-slate-400 font-black uppercase tracking-[0.5em]">
                   No sales found in database
                </td>
              </tr>
            )}
          </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
