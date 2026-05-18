import React from 'react';
import { X, Printer } from 'lucide-react';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function PrintPreviewModal({ isOpen, onClose, title, children }: PrintPreviewModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const now = new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print-hide" id="print-modal-overlay">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-auto flex flex-col">
        <div className="no-print flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={14} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto mb-4 print-content" id="print-content">
          <div className="mb-6 flex justify-between items-center border-b pb-4">
              <div>
                <h1 className="text-2xl font-black">TECH HAVEN POS</h1>
                <p className="text-xs text-slate-500">123 TECH BOULEVARD, SILICON VALLEY</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>REPORT: {title}</p>
                <p>DATE: {now}</p>
              </div>
          </div>
          {children}
        </div>
        
        <div className="flex justify-end gap-2 no-print">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded font-bold hover:bg-slate-300">
            Close
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-900 text-white rounded flex items-center gap-2 font-bold hover:bg-slate-800">
            <Printer size={16} />
            Print Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
