import React, { useState } from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface VoidAuthModalProps {
  onClose: () => void;
  onSuccess: () => void;
  actionDetails: any; // data to be sent to /api/void
  title?: string;
  description?: string;
}

export default function VoidAuthModal({ onClose, onSuccess, actionDetails, title = "Manager Authorization", description = "Enter manager credentials to void this item." }: VoidAuthModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...actionDetails,
        admin_username: username,
        admin_password: password
      };

      const res = await fetch('/api/void', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (data.success) {
        onSuccess();
      } else {
        setError(data.message || 'Authorization failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        
        <div className="bg-red-50 p-6 flex flex-col items-center border-b border-red-100 relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition">
            <X className="w-3.5 h-3.5" />
          </button>
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-red-500 shadow-sm mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-red-900 text-center">{title}</h2>
          <p className="text-sm text-red-600 font-medium text-center mt-1">
            {description}
          </p>
        </div>

        <div className="p-6">
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-lg text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Manager Username</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Authorizing...' : 'Authorize & Void'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
