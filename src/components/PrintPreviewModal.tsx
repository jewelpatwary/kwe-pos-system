import React, { useEffect, useState, useRef } from 'react';
import { X, Printer } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useReactToPrint } from 'react-to-print';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  hideHeader?: boolean;
}

export default function PrintPreviewModal({ isOpen, onClose, title, children, hideHeader }: PrintPreviewModalProps) {
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

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: title,
  });

  if (!isOpen) return null;

  const now = new Date().toLocaleString();

  const isReceipt = title.toLowerCase().includes('receipt');
  const shouldHideHeader = hideHeader !== undefined ? hideHeader : isReceipt;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print" id="print-modal-overlay">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="no-print flex justify-between items-center mb-4 border-b pb-2">
          <h2 className="text-xl font-bold">{title}</h2>
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
          <button onClick={handlePrint} className="px-4 py-2 bg-slate-900 text-white rounded flex items-center gap-2 font-bold hover:bg-slate-800">
            <Printer size={16} />
            Print Confirm
          </button>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
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
              margin: 10mm;
            }
          }
        `}} />
      </div>
    </div>
  );
}
