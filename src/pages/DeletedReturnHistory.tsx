import React, { useEffect, useState } from 'react';
import { Undo2, Clock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DeletedReturnHistory() {
  const navigate = useNavigate();
  const [deletedReturns, setDeletedReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/deleted-returns-logs')
      .then(r => r.json())
      .then(res => { if (res.success) setDeletedReturns(res.data); })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 h-full bg-white text-slate-800 font-sans text-[10px] uppercase">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-red-500" />
            <h2 className="font-black text-lg">DELETED_RETURN_HISTORY_LOGS</h2>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 bg-slate-200 rounded-full">
            <X className="w-4 h-4" />
        </button>
      </div>
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
                <th className="p-3">RETURN_ID</th>
                <th className="p-3">DELETED_BY</th>
                <th className="p-3">REASON</th>
                <th className="p-3">DATE</th>
            </tr>
        </thead>
        <tbody>
            {deletedReturns.map(log => (
                <tr key={log.id} className="border-b text-slate-500">
                    <td className="p-3">RET-{log.return_id}</td>
                    <td className="p-3">{log.deleted_by_user}</td>
                    <td className="p-3">{log.reason}</td>
                    <td className="p-3">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
