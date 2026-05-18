import React from 'react';
import { X, Keyboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ShortcutsModalProps {
  onClose: () => void;
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const shortcuts = [
    { key: 'F4', description: 'Cash Calculation' },
    { key: 'F8', description: 'Return Items' },
    { key: 'F9', description: 'Price Check' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
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
                <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Keyboard className="w-4 h-4" /> Shortcut Keys
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5"/></button>
            </div>

            <div className="space-y-3">
                {shortcuts.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded bg-slate-50 border border-slate-100">
                        <span className="font-black text-indigo-600 text-[12px] bg-indigo-50 px-2 py-1 rounded">{s.key}</span>
                        <span className="text-slate-600 font-bold text-[10px] uppercase">{s.description}</span>
                    </div>
                ))}
            </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
