import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Search, Filter, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function VoidLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const { token } = useAuthStore();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/void-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLogs = logs.filter(log => 
    (log.product_name && log.product_name.toLowerCase().includes(search.toLowerCase())) ||
    (log.sale_id && log.sale_id.toString().includes(search)) ||
    (log.void_by_user && log.void_by_user.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
         <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input 
                type="text" 
                placeholder="Search void logs..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 text-[9px] pl-6 pr-2 py-1.5 rounded outline-none shadow-sm"
            />
         </div>
         <div className="flex-1"></div>
         <div className="flex gap-2">
            <span className="px-2 py-1 bg-red-50 border border-red-200 text-red-600 font-black rounded italic">Void Log Surveillance</span>
         </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-20 border-b border-slate-200">
                <tr className="uppercase tracking-[0.2em] text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                    <th className="py-3 px-6 font-black border-r border-slate-200">Timestamp</th>
                    <th className="py-3 px-6 font-black border-r border-slate-200">Sale Reference</th>
                    <th className="py-3 px-6 font-black border-r border-slate-200">Product Details</th>
                    <th className="py-3 px-6 font-black border-r border-slate-200 text-center">Qty</th>
                    <th className="py-3 px-6 font-black border-r border-slate-200">Reason</th>
                    <th className="py-3 px-6 font-black text-right">Authorized By</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
                {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-red-50 transition-colors group">
                        <td className="py-3 px-6 border-r border-slate-100 text-slate-400 font-bold">
                           {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 font-bold">
                           {log.sale_id ? (
                             <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">#{log.sale_id}</span>
                           ) : (
                             <span className="text-slate-300">No Reference</span>
                           )}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-slate-900 font-black uppercase">
                           {log.product_name ? (
                             <div>
                                <span>{log.product_name}</span>
                                <span className="block text-[8px] text-slate-400 tracking-widest">{log.barcode}</span>
                             </div>
                           ) : (
                             <span className="text-red-600 font-black italic underline decoration-red-500">Full Transaction Void</span>
                           )}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100 text-center text-slate-500 font-bold">
                           {log.quantity ? `[x${log.quantity}]` : 'N/A'}
                        </td>
                        <td className="py-3 px-6 border-r border-slate-100">
                           <span className="text-orange-600 font-black italic">{log.reason || 'Not specified'}</span>
                        </td>
                        <td className="py-3 px-6 text-right font-black text-slate-600">
                           {log.void_by_user}
                        </td>
                    </tr>
                ))}
                {filteredLogs.length === 0 && (
                    <tr>
                        <td colSpan={6} className="py-20 text-center font-black text-slate-300 uppercase tracking-[0.5em] text-xs">
                          No void entries recorded
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>


    </div>
  );
}
