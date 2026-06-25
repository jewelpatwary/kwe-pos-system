import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Activity, Printer, Eye, X, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { currency } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'daily' | 'recent'>('daily');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7)); // 'YYYY-MM'
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'recent') {
      fetchRecentActivity();
    } else {
      fetchDailyReport();
    }
  }, [activeTab, reportMonth]);

  const fetchRecentActivity = async () => {
    /* setLoading removed to prevent flicker */
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
    /* setLoading removed to prevent flicker */
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
    
    const categories = (dailyData.categories || []).map((c: any) => c.name);

    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = i.toString().padStart(2, '0');
        const dbDate = `${reportMonth}-${dStr}`; // YYYY-MM-DD
        const displayDate = `${dStr}-${monthShort}-${yrShort}`;

        const row: any = { displayDate };
        categories.forEach((cat: string) => {
            row[cat] = 0;
            row['pur_' + cat] = 0;
        });
        row.totalCash = 0;
        row.totalTNG = 0;
        row.totalCredit = 0;

        row.purCash = 0;
        row.purTNG = 0;
        row.purCredit = 0;
        row.purTotal = 0;

        row.canteenCashPurchase = 0;
        row.canteenCreditPurchase = 0;
        row.minimartCashPurchase = 0;
        row.minimartCreditPurchase = 0;

        // Sales by category calculations
        dailyData.salesByCategory?.forEach((s: any) => {
             if (s.date === dbDate) {
                  if (row.hasOwnProperty(s.category)) row[s.category] += s.total;
                  else if (categories[0]) row[categories[0]] += s.total; // Default to first category
             }
        });
        dailyData.returnsByCategory?.forEach((s: any) => {
             if (s.date === dbDate) {
                  if (row.hasOwnProperty(s.category)) row[s.category] -= s.total;
                  else if (categories[0]) row[categories[0]] -= s.total;
             }
        });

        // Cash / TNG / Credit Sales
        dailyData.salesByPaymentMethod?.forEach((s: any) => {
            if (s.date === dbDate) {
                if (s.payment_method === 'CASH') row.totalCash += s.total;
                else if (s.payment_method === 'TNG' || s.payment_method === 'ONLINE') row.totalTNG += s.total;
                else row.totalCredit += s.total;
            }
        });
        dailyData.returnsByPaymentMethod?.forEach((s: any) => {
            if (s.date === dbDate) {
                if (s.payment_method === 'CASH') row.totalCash -= s.total;
                else if (s.payment_method === 'TNG' || s.payment_method === 'ONLINE') row.totalTNG -= s.total;
                else row.totalCredit -= s.total;
            }
        });

        row.actualTotal = (dailyData.salesTotals && dailyData.salesTotals[dbDate]) || 0;

        // Purchases
        dailyData.purchases?.forEach((p: any) => {
            if (p.date === dbDate) {
                const cat = p.category;
                const pMethod = p.payment_method || (p.payment_status === 'PAID' ? 'CASH' : 'CREDIT');
                const amt = p.total;

                if (row.hasOwnProperty('pur_' + cat)) {
                    row['pur_' + cat] += amt;
                } else {
                    row['pur_' + cat] = amt;
                }

                if (pMethod === 'CASH') {
                    row.purCash += amt;
                    if (cat?.includes('CANTEEN')) row.canteenCashPurchase += amt;
                    else row.minimartCashPurchase += amt;
                } else if (pMethod === 'TNG') {
                    row.purTNG += amt;
                    if (cat?.includes('CANTEEN')) row.canteenCashPurchase += amt;
                    else row.minimartCashPurchase += amt;
                } else {
                    row.purCredit += amt;
                    if (cat?.includes('CANTEEN')) row.canteenCreditPurchase += amt;
                    else row.minimartCreditPurchase += amt;
                }
                row.purTotal += amt;
            }
        });

        rows.push(row);
    }

    return rows;
  }, [dailyData, reportMonth]);

  const totals = useMemo(() => {
    const initialTotals: any = {
        totalCash: 0, totalTNG: 0, totalCredit: 0,
        canteenCashPurchase: 0, canteenCreditPurchase: 0, minimartCashPurchase: 0, minimartCreditPurchase: 0,
        purCash: 0, purTNG: 0, purCredit: 0, purTotal: 0,
        actualTotal: 0
    };

    if (!dailyData) return initialTotals;

    const categories = dailyData.categories?.map((c: any) => c.name) || [];
    categories.forEach((cat: string) => {
        initialTotals[cat] = 0;
        initialTotals['pur_' + cat] = 0;
    });

    return reportRows.reduce((acc, row) => {
        categories.forEach((cat: string) => {
            acc[cat] = (acc[cat] || 0) + (row[cat] || 0);
            acc['pur_' + cat] = (acc['pur_' + cat] || 0) + (row['pur_' + cat] || 0);
        });
        acc.totalCash += row.totalCash || 0;
        acc.totalTNG += row.totalTNG || 0;
        acc.totalCredit += row.totalCredit || 0;
        
        acc.canteenCashPurchase += row.canteenCashPurchase || 0;
        acc.canteenCreditPurchase += row.canteenCreditPurchase || 0;
        acc.minimartCashPurchase += row.minimartCashPurchase || 0;
        acc.minimartCreditPurchase += row.minimartCreditPurchase || 0;
        
        acc.purCash += row.purCash || 0;
        acc.purTNG += row.purTNG || 0;
        acc.purCredit += row.purCredit || 0;
        acc.purTotal += row.purTotal || 0;

        acc.actualTotal += row.actualTotal || 0;
        return acc;
    }, initialTotals);
  }, [reportRows, dailyData]);

  const expenses = useMemo(() => {
    const list = dailyData?.expenses || [];
    let net = (totals.totalCash + totals.totalTNG + totals.totalCredit) - (totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase);
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
        const cat = e.category?.toUpperCase() || 'OTHER';
        if (cat.includes('RENT')) mappings['-CANTEEN RENT'] += e.total;
        else if (cat.includes('SALARY') || cat.includes('WAGE')) mappings['-WORKER SALARY'] += e.total;
        else if (cat.includes('ELECTRIC')) mappings['-ELECTRICITY'] += e.total;
        else if (cat.includes('WATER')) mappings['-WATER BILL'] += e.total;
        else if (cat.includes('WIFI') || cat.includes('INTERNET')) mappings['-WIFI BILL'] += e.total;
        else mappings['-OTHERS BILL'] += e.total;
        
        totalExp += e.total;
    });

    net -= totalExp;

    return { mappings, net, profitBeforeExp: (totals.totalCash + totals.totalTNG + totals.totalCredit) - (totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase) };
  }, [dailyData, totals]);

  const { totalMinimartSales, totalCanteenSales } = useMemo(() => {
    if (!dailyData || !dailyData.categories) return { totalMinimartSales: 0, totalCanteenSales: 0 };
    const categories = dailyData.categories.map((c: any) => c.name);
    
    let minimart = 0, canteen = 0;
    categories.forEach((cat: string) => {
        if (cat?.includes('SNACK') || cat?.includes('GROCER') || cat?.includes('MINIMART')) minimart += totals[cat] || 0;
        else if (cat?.includes('MEAL') || cat?.includes('DRINK') || cat?.includes('CANTEEN')) canteen += totals[cat] || 0;
        else minimart += totals[cat] || 0; // Default
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

        <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded border border-slate-200">
                <input 
                    type="month" 
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="bg-transparent px-2 py-1.5 text-[11px] font-black outline-none cursor-pointer"
                />
             </div>
             <button 
                className="bg-indigo-600 text-white px-5 py-2.5 rounded shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-[11px] font-black flex items-center gap-2" 
                onClick={() => setShowPrintPreview(true)}
             >
                <Printer className="w-4 h-4" /> PRINT PDF
             </button>
        </div>
      </div>

      <AnimatePresence>
        {showPrintPreview && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-[1200px] h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/20"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-8 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-500/20 p-2 rounded-lg">
                    <Printer className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="font-black text-lg tracking-tight uppercase">Report Print Preview</h2>
                    <p className="text-xs text-slate-400 font-medium">Daily Sales and Purchase Summary for {getFullMonthName(reportMonth)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="bg-white text-slate-900 px-6 py-2.5 rounded-lg font-black text-[11px] hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2 shadow-xl"
                  >
                    <Printer className="w-4 h-4" /> SEND TO PRINTER
                  </button>
                  <button 
                    onClick={() => setShowPrintPreview(false)}
                    className="bg-white/10 hover:bg-white/20 p-2.5 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content - The actual Report */}
              <div className="flex-1 overflow-auto bg-slate-100 p-8 custom-scrollbar">
                <div className={`bg-white p-12 shadow-sm min-h-full mx-auto max-w-[1100px] pdf-container ${showPrintPreview ? 'print-target' : ''}`}>
                    <ReportContent 
                      dailyData={dailyData} 
                      loading={loading} 
                      reportRows={reportRows} 
                      totals={totals} 
                      totalMinimartSales={totalMinimartSales} 
                      totalCanteenSales={totalCanteenSales} 
                      expenses={expenses} 
                      reportMonth={reportMonth} 
                      getFullMonthName={getFullMonthName} 
                    />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 border-t border-slate-200 overflow-y-auto overflow-x-hidden w-full">
        {activeTab === 'daily' ? (
           <div className="p-4 sm:p-6 md:p-8 w-full max-w-full font-sans transition-all duration-300">
              <style dangerouslySetInnerHTML={{__html: `
                 @media print {
                     body * { visibility: hidden !important; }
                     .print-target, .print-target * { visibility: visible !important; }
                     .print-target {
                         visibility: visible !important;
                         display: block !important;
                         position: static !important;
                         width: 100% !important;
                         max-width: 100% !important;
                         height: auto !important;
                         overflow: visible !important;
                         margin: 0 !important;
                         padding: 0 !important;
                         box-shadow: none !important;
                         border: none !important;
                         background: white !important;
                     }
                     html, body, #root, main, .flex-1, .custom-scrollbar {
                         height: auto !important;
                         overflow: visible !important;
                         max-height: none !important;
                         position: static !important;
                     }
                     @page {
                         margin: 1.2cm 0.8cm !important;
                         size: landscape !important;
                     }
                     table {
                         width: 100% !important;
                         border-collapse: collapse !important;
                     }
                     th, td {
                         border: 2px solid black !important;
                         font-size: 8px !important;
                         padding: 4px 2px !important;
                         -webkit-print-color-adjust: exact;
                         print-color-adjust: exact;
                     }
                     tr {
                         page-break-inside: avoid !important;
                         break-inside: avoid !important;
                     }
                     .bg-pink-100 { background-color: #fce7f3 !important; }
                     .bg-pink-50 { background-color: #fdf2f8 !important; }
                     .bg-sky-100 { background-color: #e0f2fe !important; }
                     .bg-sky-200 { background-color: #bae6fd !important; }
                     .bg-sky-300 { background-color: #7dd3fc !important; }
                     .bg-red-300 { background-color: #fca5a5 !important; }
                     .bg-red-600 { background-color: #dc2626 !important; }
                     .bg-indigo-600 { background-color: #4f46e5 !important; }
                     .bg-yellow-105, .bg-yellow-100 { background-color: #fef9c3 !important; }
                 }
                 .old-ignored-print-styles {
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
                 }
              `}}/>
              
              <ReportContent 
                dailyData={dailyData} 
                loading={loading} 
                reportRows={reportRows} 
                totals={totals} 
                totalMinimartSales={totalMinimartSales} 
                totalCanteenSales={totalCanteenSales} 
                expenses={expenses} 
                reportMonth={reportMonth} 
                getFullMonthName={getFullMonthName} 
              />
           </div>
        ) : (
          <table className="w-full text-left border-collapse bg-white">
          <thead className="sticky top-0 bg-white z-20 shadow-md border-b border-slate-200">
            <tr className="uppercase tracking-[0.2em] text-slate-400 bg-slate-50/80 backdrop-blur-md">
              <th className="py-4 px-6 font-black border-r border-slate-100">Date</th>
              <th className="py-4 px-6 font-black border-r border-slate-100">Category</th>
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
                   {new Date(sale.timestamp).toLocaleDateString()}
                </td>
                <td className="py-4 px-6 border-r border-slate-100 text-indigo-600 font-bold italic tracking-widest">
                   {sale.category_name}
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

function ReportContent({ dailyData, loading, reportRows, totals, totalMinimartSales, totalCanteenSales, expenses, reportMonth, getFullMonthName }: any) {
    if (loading) return (
      <div className="py-32 flex flex-col items-center justify-center gap-4 text-indigo-600">
        <RefreshCw className="w-10 h-10 animate-spin opacity-50" />
        <div className="font-black uppercase tracking-widest text-[12px]">Generating Secure Report...</div>
      </div>
    );
    
    if (!dailyData) return (
      <div className="py-32 text-center text-slate-400 font-black uppercase tracking-widest text-[12px]">
        No Data found for this period
      </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <h1 className="text-center text-lg font-bold uppercase mb-4 pb-2 tracking-wide border-b-2 border-slate-900 mx-auto max-w-2xl">
                DAILY SALES AND PURCHASE SUMMARY - {getFullMonthName(reportMonth)} {reportMonth.split('-')[0]}
            </h1>



            <div className="overflow-x-auto shadow-sm rounded-lg border border-black/5">
                <table className="w-full border-collapse text-[10px] sm:text-[11px] border-2 border-black bg-white">
                    <thead>
                        <tr className="bg-slate-50">
                            <th className="border-2 border-black p-2 font-bold uppercase text-center">DATE</th>
                            {dailyData?.categories?.map((c: any) => (
                                <th key={c.name} className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center">{c.name}</th>
                            ))}
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center">TOTAL CASH SALES</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-sky-100">TNG SALES</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-pink-100">TOTAL CREDIT SALES</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[12%] text-center bg-black text-white">TOTAL SALES</th>
                            {dailyData?.categories?.map((c: any) => (
                                <th key={'pur-cat-' + c.name} className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-orange-50 text-orange-950">PURCHASE {c.name}</th>
                            ))}
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-orange-100 text-orange-950">CASH PURCHASE</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-sky-100 text-sky-950">TNG PURCHASE</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[10%] text-center bg-pink-100 text-pink-950">CREDIT PURCHASE</th>
                            <th className="border-2 border-black p-2 font-bold uppercase w-[12%] text-center bg-orange-600 text-white">TOTAL PURCHASE</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportRows.map((r: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="border-2 border-black px-2 py-1.5 text-center whitespace-nowrap font-medium">{r.displayDate}</td>
                                {dailyData?.categories?.map((c: any) => (
                                    <td key={c.name} className="border-2 border-black px-2 py-1.5 text-center font-mono text-[10px]">{r[c.name] > 0 ? r[c.name].toFixed(2) : ''}</td>
                                ))}
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black font-mono text-[10px]">{r.totalCash > 0 ? r.totalCash.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-sky-50 font-mono text-[10px]">{r.totalTNG > 0 ? r.totalTNG.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-pink-50 font-mono text-[10px]">{r.totalCredit > 0 ? r.totalCredit.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-slate-900 text-white font-mono text-[10px]">{r.actualTotal.toFixed(2)}</td>
                                {dailyData?.categories?.map((c: any) => (
                                    <td key={'pur-td-' + c.name} className="border-2 border-black px-2 py-1.5 text-center font-mono text-[10px] bg-orange-50/20 text-orange-950">{r['pur_' + c.name] > 0 ? r['pur_' + c.name].toFixed(2) : ''}</td>
                                ))}
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black font-mono text-[10px] bg-orange-50/40 text-orange-950">{r.purCash > 0 ? r.purCash.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-sky-50/20 text-sky-950 font-mono text-[10px]">{r.purTNG > 0 ? r.purTNG.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-pink-50/20 text-pink-950 font-mono text-[10px]">{r.purCredit > 0 ? r.purCredit.toFixed(2) : ''}</td>
                                <td className="border-2 border-black px-2 py-1.5 text-center font-black bg-orange-600 text-white font-mono text-[10px]">{r.purTotal > 0 ? r.purTotal.toFixed(2) : ''}</td>
                            </tr>
                        ))}
                        <tr className="bg-yellow-100 font-black">
                            <td className="border-2 border-black px-2 py-2 text-center uppercase">TOTAL</td>
                            {dailyData?.categories?.map((c: any) => (
                                <td key={c.name} className="border-2 border-black px-2 py-2 text-center font-mono">{(totals[c.name] || 0).toFixed(2)}</td>
                            ))}
                            <td className="border-2 border-black px-2 py-2 text-center font-mono font-black">{totals.totalCash.toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-sky-100 font-mono font-black">{totals.totalTNG.toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-pink-100 font-mono font-black">{totals.totalCredit.toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-black text-white font-mono shadow-inner italic">RM {totals.actualTotal.toFixed(2)}</td>
                            {dailyData?.categories?.map((c: any) => (
                                <td key={'pur-tot-' + c.name} className="border-2 border-black px-2 py-2 text-center font-mono bg-orange-100/40 text-orange-950">{(totals['pur_' + c.name] || 0).toFixed(2)}</td>
                            ))}
                            <td className="border-2 border-black px-2 py-2 text-center font-mono font-black bg-orange-100/60 text-orange-950">{(totals.purCash || 0).toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-sky-100/60 text-sky-950 font-mono font-black">{(totals.purTNG || 0).toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-pink-100/60 text-pink-950 font-mono font-black">{(totals.purCredit || 0).toFixed(2)}</td>
                            <td className="border-2 border-black px-2 py-2 text-center bg-orange-600 text-white font-mono shadow-inner italic font-black">RM {(totals.purTotal || 0).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="space-y-6">
                <table className="w-full border-collapse text-[11px] font-bold border-2 border-black bg-white">
                     <thead>
                         <tr className="bg-indigo-600 text-white">
                             <th colSpan={4} className="border-2 border-black p-2 uppercase italic tracking-widest text-left">Detailed Sales Reconciliation</th>
                         </tr>
                     </thead>
                    <tbody>
                        <tr className="bg-sky-200">
                            <td className="border-2 border-black p-3 w-[40%] text-right pr-6 shrink-0 font-black text-[12px]">TOTAL GROSS SALES (AGGREGATED)</td>
                            <td className="border-2 border-black p-3 font-mono bg-white"><span className="block text-slate-700 text-[9px] mb-1 font-black">CASH</span> RM {totals.totalCash.toFixed(2)}</td>
                            <td className="border-2 border-black p-3 bg-sky-300 font-mono"><span className="block text-slate-800 text-[9px] mb-1 font-black">TNG</span> RM {totals.totalTNG.toFixed(2)}</td>
                            <td className="border-2 border-black p-3 font-mono bg-white"><span className="block text-slate-700 text-[9px] mb-1 font-black">CREDIT</span> RM {totals.totalCredit.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-yellow-105">
                            <td className="border-2 border-black p-3 text-right pr-6 font-black text-[12px]">GRAND TOTAL (CASH + TNG + CREDIT)</td>
                            <td colSpan={3} className="border-2 border-black p-3 text-xl font-mono font-black text-center italic">RM {totals.actualTotal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse border-2 border-black bg-white text-[11px]">
                    <thead>
                        <tr className="bg-slate-100 text-center">
                            <th colSpan={2} className="border-2 border-black p-2 font-black uppercase italic tracking-widest bg-indigo-600 text-white">Sales Summary Overview</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border-2 border-black p-3 font-black uppercase w-[60%]">Total Minimart Sales</td>
                            <td className="border-2 border-black p-3 text-right font-mono text-indigo-600">RM {totalMinimartSales.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td className="border-2 border-black p-3 font-black uppercase">Total Canteen Sales</td>
                            <td className="border-2 border-black p-3 text-right font-mono text-indigo-600">RM {totalCanteenSales.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-yellow-105">
                            <td className="border-2 border-black p-3 font-black uppercase text-sm">Grand Total Gross Sales</td>
                            <td className="border-2 border-black p-3 text-right text-lg font-mono font-black text-slate-900 italic underline decoration-indigo-500 underline-offset-4">RM {totals.actualTotal.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse text-[11px] font-bold border-2 border-black bg-white">
                     <thead>
                         <tr className="bg-emerald-600 text-white">
                             <th colSpan={2} className="border-2 border-black p-2 uppercase italic tracking-widest">Net Profit Reconciliation</th>
                         </tr>
                     </thead>
                    <tbody>
                         <tr className="bg-slate-50">
                            <td className="border-2 border-black p-3 uppercase w-[60%] text-sm">TOTAL PROFIT (GROSS)</td>
                            <td className="border-2 border-black p-3 text-right text-lg font-mono font-black text-emerald-600"><span className="float-left text-slate-400 font-normal">RM</span> {expenses.profitBeforeExp.toFixed(2)}</td>
                         </tr>
                         {Object.entries(expenses.mappings).map(([name, amount]: [string, any], idx) => (
                            <tr key={idx}>
                                <td className="border-2 border-black p-3 uppercase text-slate-500 font-medium">{name}</td>
                                <td className="border-2 border-black p-3 text-right font-normal font-mono text-slate-600 italic"> - {amount > 0 ? (amount as number).toFixed(2) : '0.00'}</td>
                            </tr>
                         ))}
                         <tr className="bg-indigo-600 text-white font-black">
                            <td className="border-2 border-black p-4 uppercase text-lg italic tracking-widest underline decoration-white/30 decoration-wavy">NET PROFIT</td>
                            <td className="border-2 border-black p-4 text-right text-2xl font-mono">RM {expenses.net.toFixed(2)}</td>
                         </tr>
                    </tbody>
                 </table>

                <table className="w-full border-collapse text-[11px] font-bold uppercase border-2 border-black bg-white">
                    <thead>
                        <tr className="bg-red-600 text-white text-center">
                            <th colSpan={2} className="border-2 border-black p-2 uppercase italic tracking-widest">Procurement Summary</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="bg-orange-50 font-black text-[12px]">
                            <td colSpan={2} className="border-2 border-black p-2 bg-orange-100/60 text-orange-950 text-left">
                                💰 CASH & TNG PURCHASE
                            </td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border-2 border-black p-2.5 pl-6 font-semibold text-slate-700 w-[50%] text-left">CANTEEN CASH PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-slate-800">RM {totals.canteenCashPurchase.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border-2 border-black p-2.5 pl-6 font-semibold text-slate-700 text-left">MINIMART CASH PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-slate-800">RM {totals.minimartCashPurchase.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-orange-50/30 font-bold italic">
                            <td className="border-2 border-black p-2.5 pl-6 text-orange-900 text-left">SUBTOTAL CASH PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-orange-900">RM {(totals.canteenCashPurchase + totals.minimartCashPurchase).toFixed(2)}</td>
                        </tr>

                        <tr className="bg-pink-50 font-black text-[12px]">
                            <td colSpan={2} className="border-2 border-black p-2 bg-pink-100/60 text-pink-950 text-left">
                                💳 CREDIT PURCHASE
                            </td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border-2 border-black p-2.5 pl-6 font-semibold text-slate-700 text-left">CANTEEN CREDIT PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-slate-800">RM {totals.canteenCreditPurchase.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-white">
                            <td className="border-2 border-black p-2.5 pl-6 font-semibold text-slate-700 text-left">MINIMART CREDIT PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-slate-800">RM {totals.minimartCreditPurchase.toFixed(2)}</td>
                        </tr>
                        <tr className="bg-pink-50/30 font-bold italic">
                            <td className="border-2 border-black p-2.5 pl-6 text-pink-900 text-left">SUBTOTAL CREDIT PURCHASE</td>
                            <td className="border-2 border-black p-2.5 font-mono text-right pr-6 text-pink-900">RM {(totals.canteenCreditPurchase + totals.minimartCreditPurchase).toFixed(2)}</td>
                        </tr>

                        <tr className="bg-red-600 text-white font-black text-lg">
                            <td className="border-2 border-black p-4 text-right pr-6 italic uppercase underline decoration-white/30">TOTAL PURCHASED</td>
                            <td className="border-2 border-black p-4 text-right pr-6 text-2xl font-mono">RM {(totals.canteenCashPurchase + totals.canteenCreditPurchase + totals.minimartCashPurchase + totals.minimartCreditPurchase).toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div className="pt-12 text-center text-[10px] text-slate-400 font-medium uppercase border-t border-slate-100 pb-4">
                End of Report - Generated securely on {new Date().toLocaleString()} - AI Studio Financials Engine
            </div>
        </div>
    );
}
