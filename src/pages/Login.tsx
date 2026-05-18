import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, LogIn, Store } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.token, data.user);
        if (data.user.role === 'ADMIN' || data.user.role === 'MANAGER') {
          navigate('/admin/dashboard');
        } else {
          navigate('/pos');
        }
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-6 text-[10px] uppercase transition-colors duration-300">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded flex items-center justify-center text-indigo-500 shadow-xl">
            <Store className="w-6 h-6" />
          </div>
        </div>
        <div className="text-center space-y-2">
            <h2 className="text-[14px] font-black text-slate-900 tracking-[0.2em]">CORE_SYSTEM_ACCESS_v1.0</h2>
            <div className="text-[7px] text-slate-400 font-black tracking-widest">SECURED_GATEWAY_TERMINAL</div>
            <div className="text-[7px] text-indigo-600 font-bold tracking-widest mt-4">
              LOGIN_DEFAULT : [ADMIN] / [ADMIN123]
            </div>
        </div>
      </div>

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-8 border border-slate-200 shadow-2xl rounded-lg">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-500/5 border border-red-500/20 text-red-600 p-4 rounded text-[9px] font-black tracking-widest text-center">
                ERROR_BIT: {error.toUpperCase()}
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="block text-[8px] font-black text-slate-400 tracking-[0.2em]">IDENT_ID_STRING</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ID_STRING..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[8px] font-black text-slate-400 tracking-[0.2em]">ACCESS_KEY_BUFFER</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-[10px] font-black rounded outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black tracking-[0.3em] rounded transition-all shadow-xl shadow-indigo-500/10 disabled:opacity-50"
              >
                {loading ? 'SYNCING_CREDENTIALS...' : (
                  <>
                    <LogIn className="w-4 h-4" /> SAVE_ACCESS_v1.0
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        <div className="mt-8 text-center text-slate-400 text-[7px] font-black tracking-[0.4em] opacity-50">
          PROTECTED_BY_CRYPTO_CORE • SECTOR_09
        </div>
      </div>
    </div>
  );
}
