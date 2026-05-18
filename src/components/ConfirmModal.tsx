import React from 'react';
import { AlertTriangle, X, Trash2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'CONFIRM_DELETE',
  cancelText = 'ABORT_ACTION',
  variant = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const colors = {
    danger: {
      bg: 'bg-red-600',
      hover: 'hover:bg-red-700',
      text: 'text-red-500',
      border: 'border-red-500/20',
      light: 'bg-red-500/10',
      icon: <Trash2 className="w-4 h-4 text-red-500" />
    },
    warning: {
      bg: 'bg-amber-600',
      hover: 'hover:bg-amber-700',
      text: 'text-amber-500',
      border: 'border-amber-500/20',
      light: 'bg-amber-500/10',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />
    },
    info: {
      bg: 'bg-indigo-600',
      hover: 'hover:bg-indigo-700',
      text: 'text-indigo-500',
      border: 'border-indigo-500/20',
      light: 'bg-indigo-500/10',
      icon: <AlertCircle className="w-4 h-4 text-indigo-500" />
    }
  };

  const c = colors[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0f1117]/90 backdrop-blur-md"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-md bg-[#181a20] border border-[#2d303b] rounded-xl overflow-hidden shadow-2xl relative z-10"
          >
            {/* Header decor */}
            <div className={`h-1 w-full ${c.bg}`} />
            
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${c.light}`}>
                  {c.icon}
                </div>
                
                <div className="flex-1">
                  <h3 className="text-[12px] font-black text-white uppercase tracking-[0.2em] mb-2">{title}</h3>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-wider">{message}</p>
                </div>
                
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-[#2d303b] rounded transition-colors text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-4 bg-[#1c1f26] border-t border-[#2d303b] flex items-center justify-end gap-3">
              <button 
                onClick={onClose}
                className="px-4 py-2 rounded text-slate-400 hover:text-white text-[9px] font-black tracking-widest uppercase transition-colors"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`${c.bg} text-white px-6 py-2 rounded ${c.hover} transition shadow-lg text-[9px] font-black tracking-widest uppercase`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
