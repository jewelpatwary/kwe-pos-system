import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Lock, LogIn, Store, AlertTriangle, CheckCircle2, Server, Terminal, HelpCircle, Layers } from 'lucide-react';

interface ConfigStatus {
  isConfigured: boolean;
  isConnected: boolean;
  errorDetail: string | null;
  env: {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  };
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    fetch('/api/config-status')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfigStatus(data);
        }
      })
      .catch(err => console.error('Failed to retrieve server configuration status:', err));
  }, []);

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
    } catch (err: any) {
      console.error('Login request failed details:', err);
      setError(`An error occurred during login: ${err?.message || err || 'Unknown'}`);
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

      <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        {/* Supabase Status Banner */}
        {configStatus && (
          <div className={`p-4 border rounded-lg flex flex-col gap-2 transition-all ${
            configStatus.isConnected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <div className="flex items-center justify-between font-bold tracking-wider">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                <span>DATABASE STATE: {configStatus.isConnected ? 'ONLINE_READY' : 'SETUP_REQUIRED'}</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 border rounded cursor-pointer transition-all duration-200 text-[8px]"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" /> {showHelp ? 'HIDE_GUIDE' : 'CONFIG_HELP'}
              </button>
            </div>

            {!configStatus.isConfigured && (
              <p className="text-[8px] leading-relaxed select-text font-medium self-start">
                SUPABASE CRITICAL KEYS ARE UNCONFIGURED. API AUTHENTICATION WILL NOT BE COMPLETED UNTIL VARIABLES ARE ADDED.
              </p>
            )}

            {configStatus.isConfigured && !configStatus.isConnected && (
              <div className="text-[8px] leading-relaxed font-black block w-full whitespace-pre-wrap select-text">
                KEYS LOADED BUT COUPLING FAILED:<br/>
                <span className="text-red-600 font-bold">{configStatus.errorDetail}</span>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Instruction Walkthrough Panel */}
        {((configStatus && (!configStatus.isConfigured || !configStatus.isConnected)) || showHelp) && (
          <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-xl space-y-4 text-[8px] font-bold tracking-wider text-slate-700">
            <div className="flex items-center gap-2 border-b pb-2 text-indigo-600">
              <Layers className="w-4 h-4" />
              <span>SUPABASE COUPLING MANUAL - 2 ENVIRONMENTS</span>
            </div>

            <div className="space-y-4 select-text">
              <div className="space-y-1">
                <div className="text-slate-900 border-l-2 border-indigo-500 pl-2">ENVIRONMENT 1: GOOGLE AI STUDIO (DEVELOPMENT REPLAY)</div>
                <p className="font-normal text-slate-500 leading-relaxed normal-case">
                  Open the Settings panel (gear icon) in the bottom-left corner of the AI Studio workspace, choose <strong className="font-bold text-slate-800">"Secrets"</strong>, and insert the keys:
                </p>
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 font-mono text-[8px] text-slate-600 lowercase">
                  <span className="uppercase font-bold text-slate-800">SUPABASE_URL</span>=https://your-project.supabase.co<br />
                  <span className="uppercase font-bold text-slate-800">SUPABASE_SERVICE_ROLE_KEY</span>=eyJhbGciOi...
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-900 border-l-2 border-indigo-500 pl-2">ENVIRONMENT 2: VERCEL (PRODUCTION ENVIRONMENT)</div>
                <p className="font-normal text-slate-500 leading-relaxed normal-case">
                  Go to your project dashboard on Vercel, navigate to <strong className="font-bold text-slate-800">Settings &gt; Environment Variables</strong>, and input these variables. Vercel automatically matches and injects them to Serverless functions on execution.
                </p>
              </div>

              <div className="space-y-1 bg-indigo-50/50 p-3 rounded border border-indigo-100/60 leading-relaxed text-indigo-900/80 font-medium normal-case">
                <span className="font-bold block uppercase tracking-widest text-indigo-600 mb-1">Database Schema Setup:</span>
                Make sure you have executed the schema commands in <abbr className="font-bold tracking-wide text-indigo-900" title="supabase-schema.sql">supabase-schema.sql</abbr> inside your Supabase SQL Editor. This initializes the <strong className="font-bold text-slate-800">users</strong> table and seeding triggers.
              </div>
            </div>
          </div>
        )}

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
