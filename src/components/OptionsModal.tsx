import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, LogOut, Keyboard, Undo2, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/authStore';

interface OptionsModalProps {
  onClose: () => void;
  onShowSummary: () => void;
  onShowReturn: () => void;
  onShowShortcuts: () => void;
}

export default function OptionsModal({ onClose, onShowSummary, onShowReturn, onShowShortcuts }: OptionsModalProps) {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const options = [
    { label: 'DAILY SALES SUMMARY', icon: BarChart3, action: () => { onShowSummary(); onClose(); } },
    { label: 'SALES RETURN', icon: Undo2, action: () => { onShowReturn(); onClose(); } },
    { label: 'SHORTCUT KEYS', icon: Keyboard, action: () => { onShowShortcuts(); onClose(); } },
    { label: 'LOGOUT', icon: LogOut, action: handleLogout, danger: true }
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        />
        
        <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-sm bg-white rounded-lg shadow-xl relative z-10 p-6"
        >
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em]">Options</h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>
            </div>

            <div className="space-y-2">
                {options.map((opt, i) => (
                    <button 
                        key={i}
                        onClick={opt.action}
                        className={`w-full flex items-center gap-3 p-3 rounded font-black uppercase tracking-widest text-[10px] transition-all ${
                            opt.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        <opt.icon className="w-4 h-4" />
                        {opt.label}
                    </button>
                ))}
            </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
