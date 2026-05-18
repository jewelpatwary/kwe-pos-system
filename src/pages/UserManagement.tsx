import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Edit2, Trash2, Shield, Ban, CheckCircle, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import ConfirmModal from '../components/ConfirmModal';

export default function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: '', username: '', password: '', role: 'CASHIER', status: 'active' });
  const [loading, setLoading] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const { token } = useAuthStore();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setUsers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = formData.id ? `/api/users/${formData.id}` : '/api/users';
      const method = formData.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setFormData({ id: '', username: '', password: '', role: 'CASHIER', status: 'active' });
        fetchUsers();
      } else {
        alert(data.message || 'Error saving user');
      }
    } catch (err) {
      alert('Error saving user');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: any) => {
    setFormData({ id: user.id, username: user.username, password: '', role: user.role, status: user.status });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    setUserToDelete(id);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      const res = await fetch(`/api/users/${userToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      else alert(data.message);
    } catch (err) {
      console.error(err);
    } finally {
      setUserToDelete(null);
    }
  };

  const toggleStatus = async (user: any) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...user, status: newStatus })
      });
      const data = await res.json();
      if (data.success) fetchUsers();
      else alert(data.message);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300">
      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center justify-between sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="text-slate-900 font-black tracking-widest uppercase">STAFF_DIRECTORY</span>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={() => {
                setFormData({ id: '', username: '', password: '', role: 'CASHIER', status: 'active' });
                setShowForm(true);
             }}
             className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-500/10"
           >
             <UserPlus className="w-3.5 h-3.5" /> ADD_NEW_STAFF
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto border-x border-slate-200 bg-white">
        {loading && users.length === 0 ? (
             <div className="flex items-center justify-center h-full">
                <div className="animate-pulse tracking-[0.5em] text-slate-400 uppercase">LOADING_MART_STAFF...</div>
             </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-500 bg-slate-50/80 backdrop-blur-md transition-colors">
                <th className="py-4 px-6 font-black border-r border-slate-200">STAFF_LOGIN</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">ACCESS_ROLE</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">STATUS</th>
                <th className="py-4 px-6 font-black border-r border-slate-200">JOINED_ON</th>
                <th className="py-4 px-6 font-black text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 transition-colors">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="py-4 px-6 border-r border-slate-100">
                    <div className="flex items-center gap-3">
                       <div className="w-6 h-6 rounded bg-slate-100 text-indigo-600 flex items-center justify-center font-black border border-slate-200 shadow-sm">
                          {user.username.charAt(0)}
                       </div>
                       <div className="text-slate-900 font-black tracking-widest">{user.username}</div>
                    </div>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100">
                    <span className={`px-2 py-0.5 rounded border border-opacity-30 font-black text-[9px] ${
 user.role === 'ADMIN' ? 'bg-purple-50 border-purple-200 text-purple-600 ' :
 user.role === 'MANAGER' ? 'bg-blue-50 border-blue-200 text-blue-600 ' :
 'bg-slate-50 border-slate-200 text-slate-500 '
 }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-center">
                    <button 
                        onClick={() => user.id !== 1 && toggleStatus(user)}
                        disabled={user.id === 1}
                        className={`text-[9px] font-black italic underline decoration-offset-4 ${
 user.status === 'active' ? 'text-emerald-600 decoration-emerald-100 ' : 'text-red-600 decoration-red-100 '
 } ${user.id === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {user.status}
                    </button>
                  </td>
                  <td className="py-4 px-6 border-r border-slate-100 text-slate-400 font-bold">
                    {new Date(user.created_at).toISOString().split('T')[0]}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(user)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                      {user.id !== 1 && (
                        <button onClick={() => handleDelete(user.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div>IDENTITY_LOG_DB • {users.length} ACTIVE_ENTITIES</div>
         <div>SYSTEM_WATCHDOG_ONLINE • {new Date().toISOString()}</div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 bg-[#0f1117]/80 backdrop-blur-sm">
           <div className="w-full max-w-lg bg-[#181a20] border border-[#2d303b] rounded-lg flex flex-col relative animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
              <div className="p-4 border-b border-[#2d303b] flex items-center justify-between bg-[#1c1f26]">
                <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
                  {formData.id ? 'CREDENTIAL_UPDATE' : 'NEW_ENTITY_PROVISION'}
                </h2>
                <button 
                  onClick={() => setShowForm(false)}
                  className="p-1 h-6 w-6 flex items-center justify-center bg-[#2d303b] hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all rounded border border-[#3b404d]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 bg-[#0f1117] space-y-4">
                <form id="userForm" onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">USERNAME_IDENT</label>
                    <input 
                        type="text" required 
                        value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} 
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">SECRET_PHRASE {formData.id && '(OPTIONAL)'}</label>
                    <input 
                        type="password" required={!formData.id}
                        value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} 
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 font-black tracking-widest">CLEARANCE_PROTOCOL</label>
                    <select 
                        value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                        className="w-full px-3 py-2 bg-[#1c1f26] border border-[#2d303b] text-white focus:border-indigo-500 outline-none transition-all"
                    >
                        <option value="CASHIER">CASHIER_PROTO</option>
                        <option value="MANAGER">MANAGER_REPORTS</option>
                        <option value="ADMIN">ADMIN_COMPLETE</option>
                    </select>
                  </div>
                </form>
              </div>

              <div className="p-4 border-t border-[#2d303b] bg-[#1c1f26] flex items-center justify-end">
                <button 
                  form="userForm"
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2 bg-indigo-600 text-white font-black text-[10px] tracking-widest rounded hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {loading ? 'MODULATING...' : 'SAVE_USER'}
                </button>
              </div>
           </div>
        </div>
      )}
      
      <ConfirmModal 
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={confirmDeleteUser}
        title="TERMINATE_STAFF_ACCESS"
        message="PERMANENTLY_REVOKING_ALL_CLEARANCE_FOR_THIS_ENTITY._THIS_DATABASE_PURGE_IS_FINAL."
      />
    </div>
  );
}
