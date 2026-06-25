import { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';

export default function OfflineOverlay() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [checking, setChecking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const checkConnection = async () => {
    setChecking(true);
    try {
      // Fetch with cache-busting to bypass browser caches
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      
      const res = await fetch(`/api/health?t=${Date.now()}`, { 
        method: 'GET',
        signal: controller.signal 
      });
      clearTimeout(id);
      
      if (res.ok) {
        setIsOnline(true);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      checkConnection();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic live health-checking every 7 seconds to catch silent disconnects
    const interval = setInterval(() => {
      checkConnection();
    }, 7000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/90 [backdrop-filter:blur(8px)] z-[999999] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-2 border-red-500 rounded-xl shadow-2xl p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 bg-red-100 rounded-full scale-150 animate-ping opacity-60"></div>
            <div className="relative bg-red-50 p-4 rounded-full border border-red-200">
              <WifiOff className="w-10 h-10 text-red-600" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-black text-slate-900 italic uppercase tracking-tight mb-2 flex items-center justify-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
          Internet Disconnected
        </h2>

        <p className="text-xs font-medium text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
          To protect transactional integrity, database consistency, and prevent sync gaps, POS operations and system key-ins are suspended until an active internet connection is restored.
        </p>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg mb-6">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            <span>Network Status</span>
            <span className="text-red-500 italic">OFFLINE</span>
          </div>
          <div className="text-[11px] font-mono text-slate-600 bg-slate-100 py-1.5 px-3 rounded text-left border border-slate-200/50">
            Signal: No response from KWE Cloud Server.
          </div>
        </div>

        <button
          onClick={() => {
            setRetryCount(prev => prev + 1);
            checkConnection();
          }}
          disabled={checking}
          className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-black tracking-widest text-xs uppercase italic rounded-lg transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking Link...' : 'Retry Connection Check'}
        </button>

        {retryCount > 0 && !checking && (
          <p className="text-[9px] text-slate-400 font-bold mt-3 italic tracking-wider">
            Attempted check #{retryCount}. Please double check your local router, Wi-Fi, or LTE connection.
          </p>
        )}
      </div>
    </div>
  );
}
