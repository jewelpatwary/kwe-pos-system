import React, { useEffect, useState } from 'react';
import { Undo2, Trash2, Edit3, CheckCircle, Clock, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';
import { useTheme } from '../components/ThemeProvider';

export default function ReturnHistory() {
  const { currency } = useTheme();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token); // Add this
  const [returnToDelete, setReturnToDelete] = useState<number | null>(null);
  const [supplierReturns, setSupplierReturns] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/supplier-returns?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) setSupplierReturns(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // updateSupplierReturn can be removed as it's not needed anymore

  const deleteSupplierReturn = async (id: number) => {
    console.log('[AUDIT] Session delete requested for ID:', id);
    setReturnToDelete(id);
  };

  const confirmDeleteReturn = async () => {
    if (!returnToDelete) return;
    const id = returnToDelete;

    try {
      console.log('START: deleteSupplierReturn for ID:', id);
      
      const requestOptions = {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`
        }
      };
      
      console.log('Fetching DELETE /api/supplier-returns/' + id + '?reason=Manual%20deletion');
      
      const res = await fetch(`/api/supplier-returns/${id}?reason=Manual%20deletion`, {
        ...requestOptions
      });
      
      console.log('Response Status:', res.status, res.statusText);
      
      let data;
      try {
          data = await res.json();
          console.log('Response JSON Data:', data);
      } catch (jsonErr) {
          console.error('Failed to parse response JSON:', jsonErr);
          throw new Error('Server returned invalid JSON response');
      }
      
      if (res.ok && data && data.success) {
          console.log('Deletion success on server. Updating local state...');
          setSupplierReturns(prev => prev.filter(ret => ret.id !== id));
      } else {
          const errMsg = data?.message || 'Unknown server error';
          console.error('Deletion failed on server:', errMsg);
          alert('Failed to delete: ' + errMsg);
      }
    } catch (err: any) {
      console.error('CRITICAL ERROR in deleteSupplierReturn:', err);
      alert('Delete error: ' + (err.message || String(err)));
    } finally {
      console.log('END: deleteSupplierReturn for ID:', id);
      setReturnToDelete(null);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
            <Undo2 className="w-4 h-4 text-indigo-600" />
            <span className="font-black tracking-widest">SUPPLIER_RETURN_HISTORY</span>
        </div>
        <button onClick={() => navigate('/admin/deleted-return-history')} className="flex items-center gap-2 bg-slate-200 px-3 py-1 rounded font-bold">
          <History className="w-3 h-3" />
          VIEW_DELETED_LOGS
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-left border-collapse mb-8">
            <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th className="p-3">REF</th>
                    <th className="p-3">DATE</th>
                    <th className="p-3">SUPPLIER</th>
                    <th className="p-3">TYPE</th>
                    <th className="p-3">VALUE</th>
                    <th className="p-3">ACTION</th>
                </tr>
            </thead>
            <tbody>
                {supplierReturns.map(ret => (
                    <tr key={ret.id} className="border-b">
                        <td className="p-3">{ret.document_reference || `RET-${ret.id}`}</td>
                        <td className="p-3">{new Date(ret.created_at).toLocaleString()}</td>
                        <td className="p-3">{ret.supplier_name}</td>
                        <td className="p-3">{ret.return_type}</td>
                        <td className="p-3">{currency.symbol}{ret.total_amount.toFixed(2)}</td>
                        <td className="p-3 flex gap-2">
                           <button onClick={() => navigate(`/admin/returns/${ret.id}/edit`)} className="text-blue-500"><Edit3 className="w-3 h-3"/></button>
                           <button onClick={(e) => { e.stopPropagation(); deleteSupplierReturn(ret.id); }} className="text-red-500"><Trash2 className="w-3 h-3"/></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
      {/* No editing modal needed here anymore - handled by navigation */}

      <ConfirmModal
        isOpen={returnToDelete !== null}
        onClose={() => {
          console.log('[AUDIT] Session deletion cancelled by user');
          setReturnToDelete(null);
        }}
        onConfirm={confirmDeleteReturn}
        title="VOID_RETURN_TRANSACTION"
        message="CRITICAL: ARE YOU ABSOLUTELY POSITIVE YOU WANT TO DELETE THIS SUPPLIER RETURN RECORD? THIS WILL RESTORE STOCK LEVELS AND REVERT VENDOR DEBITS."
      />
    </div>
  );
}
