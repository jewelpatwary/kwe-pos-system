import React, { useEffect, useState, useRef } from 'react';
import { formatDate } from '../lib/utils';
import { X, Printer } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  hideHeader?: boolean;
  isSyncing?: boolean;
}

export default function PrintPreviewModal({ isOpen, onClose, title, children, hideHeader, isSyncing }: PrintPreviewModalProps) {
  const [storeProfile, setStoreProfile] = useState<any>(null);
  const { token } = useAuthStore();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && token) {
      fetch('/api/settings/store', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStoreProfile(data.data);
        }
      })
      .catch(console.error);
    }
  }, [isOpen, token]);

  const handlePrintClick = () => {
    // Direct window.print() is 100% safe, fast, and robust across browsers & in sandboxed iframes.
    // We combine it with advanced CSS media queries that hide other elements completely.
    window.focus();
    window.print();
    // Automatically close the receipt preview after a short delay so the cashier can continue scanning instantly
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  const now = formatDate(new Date(), 'DD/MM/YYYY HH:mm');

  const isReceipt = title.toLowerCase().includes('receipt');
  const shouldHideHeader = hideHeader !== undefined ? hideHeader : isReceipt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" id="print-modal-overlay">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col print-modal-card">
        <div className="no-print flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold font-sans tracking-tight">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={14} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto mb-4 print-content" id="print-content" ref={contentRef}>
          {!shouldHideHeader && (
            <div className="mb-6 flex justify-between items-center border-b pb-4">
              <div>
                <h1 className="text-2xl font-black">{storeProfile?.shop_name || 'KWE POS SYSTEM'}</h1>
                <p className="text-xs text-slate-500">{storeProfile?.address || 'SYSTEM OVERVIEW REPORT'}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>REPORT: {title}</p>
                <p>DATE: {now}</p>
              </div>
            </div>
          )}
          {children}
        </div>
        
        <div className="flex justify-end gap-2 no-print">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 rounded font-bold hover:bg-slate-300">
            Close
          </button>
          <button onClick={handlePrintClick} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded flex items-center gap-2 font-bold transition-all shadow-md active:scale-95">
            <Printer size={16} />
            Print Confirm
          </button>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            /* Hide every single element in the DOM by default */
            body * {
              visibility: hidden !important;
            }
            /* Explicitly flag and show ONLY the print modal overlay container and its sub-nodes */
            #print-modal-overlay,
            #print-modal-overlay * {
              visibility: visible !important;
            }
            body { 
              background: white !important; 
              color: black !important;
            }
            .no-print, .no-print * { 
              display: none !important; 
              visibility: hidden !important;
            }
            
            #print-modal-overlay {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
              display: block !important;
              padding: 0 !important;
              margin: 0 !important;
              z-index: 9999999 !important;
              backdrop-filter: none !important;
            }
            
            .print-modal-card {
              box-shadow: none !important;
              border: none !important;
              padding: 0 !important;
              margin: 0 !important;
              max-width: none !important;
              max-height: none !important;
              width: 100% !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }

            .print-content {
              display: block !important;
              overflow: visible !important;
              width: ${isReceipt ? '80mm' : '100%'} !important;
              margin: ${isReceipt ? '0 auto' : '0'} !important;
              padding: ${isReceipt ? '5mm' : '0'} !important;
              background: white !important;
              color: black !important;
            }
            @page {
              size: ${isReceipt ? '80mm auto' : 'auto'};
              margin: 5mm;
            }
          }
        `}} />
      </div>
    </div>
  );
}
