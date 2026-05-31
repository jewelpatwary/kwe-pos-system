import React, { useState, useEffect } from 'react';
import { AlertTriangle, Database, Trash2, RefreshCcw, X, CheckCircle2, ShieldAlert, Check, Loader2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SystemResetViewProps {
  token: string | null;
}

type ResetScope = 'transactions' | 'complete';

export default function SystemResetView({ token }: SystemResetViewProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Custom modal interaction states
  const [activeModal, setActiveModal] = useState<ResetScope | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [modalCheckbox, setModalCheckbox] = useState(false);

  const handleResetExecute = async (scope: ResetScope) => {
    // Requirements validation
    if (scope === 'complete' && !modalCheckbox) {
      setError("Please check the acknowledgement checkbox first.");
      return;
    }

    const requiredWord = scope === 'complete' ? 'WIPE' : 'RESET';
    if (typedConfirmation.trim().toUpperCase() !== requiredWord) {
      setError(`Please type the confirmation word "${requiredWord}" correctly.`);
      return;
    }

    // Launch action
    setLoading(true);
    setSuccess(null);
    setError(null);
    setActiveModal(null); // Close modal on launch

    try {
      const res = await fetch('/api/admin/reset-system', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scope })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`${data.message}. The database has been successfully refreshed.`);
      } else {
        setError(data.message || "The server reports that the reset could not be processed.");
      }
    } catch (err: any) {
      console.error("SystemResetView error:", err);
      setError(`A network error occurred: ${err.message || "Failed to contact the server."}`);
    } finally {
      setLoading(false);
      setTypedConfirmation('');
      setModalCheckbox(false);
    }
  };

  return (
    <div className="py-10 px-4 max-w-4xl mx-auto relative font-sans">
      {/* Alert Banner System */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-6 bg-emerald-50 border-2 border-emerald-500 rounded-xl p-5 flex items-start gap-4 shadow-md"
          >
            <div className="bg-emerald-500 text-white p-2.5 rounded-lg shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-emerald-900 text-sm tracking-wide">SYSTEM RESET COMPLETED SUCCESSFULLY</h3>
              <p className="text-xs text-emerald-700 mt-1 font-medium">{success}</p>
              <span className="text-[9px] mt-2 inline-block bg-emerald-200/50 text-emerald-800 px-2 py-0.5 rounded font-bold tracking-widest uppercase">System is now clean</span>
            </div>
            <button onClick={() => setSuccess(null)} className="text-emerald-500 hover:text-emerald-700 p-1 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mb-6 bg-rose-50 border-2 border-rose-500 rounded-xl p-5 flex items-start gap-4 shadow-md"
          >
            <div className="bg-rose-500 text-white p-2.5 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-rose-900 text-sm tracking-wide">ACTION REQUIRED / RESET ERROR</h3>
              <p className="text-xs text-rose-700 mt-1 font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 p-1 rounded-md transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Card */}
      <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Action Card 1: Transactions Reset */}
            <div className="border border-slate-200 hover:border-amber-300 rounded-xl p-6 transition-all bg-white flex flex-col justify-between shadow-sm hover:shadow-md">
              <div>
                <div className="bg-amber-50 border border-amber-200 w-12 h-12 rounded-xl flex items-center justify-center text-amber-600 mb-4 shadow-sm">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2 flex items-center gap-1.5">
                  Clear Transactions
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Erases active sales invoices, purchase record histories, collection inputs, cost records, and movement logs.
                </p>

                {/* Audit Checklist */}
                <div className="space-y-2 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Impact Matrix:</span>
                  <div className="flex items-center gap-2 text-xs text-rose-700">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Clear all Sales & Returns</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-rose-700">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Clear Expense Entries</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Keep Products & Pricing</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Keep Customers & Credits</span>
                  </div>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={() => {
                  setTypedConfirmation('');
                  setActiveModal('transactions');
                }}
                className="w-full font-bold py-3.5 rounded-xl border border-amber-300 hover:border-amber-400 bg-amber-50 hover:bg-amber-100/70 text-amber-800 transition-all text-xs uppercase tracking-wider text-center active:scale-[0.98]"
              >
                Clear Transactional History
              </button>
            </div>

            {/* Action Card 2: Complete Reset */}
            <div className="border border-slate-200 hover:border-rose-300 rounded-xl p-6 transition-all bg-white flex flex-col justify-between shadow-sm hover:shadow-md">
              <div>
                <div className="bg-rose-50 border border-rose-200 w-12 h-12 rounded-xl flex items-center justify-center text-rose-600 mb-4 shadow-sm">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2 flex items-center gap-1.5">
                  Complete Factory Wipe
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed mb-6">
                  Wipes the entire database back to default state. Perfect for starting completely fresh after testing.
                </p>

                {/* Audit Checklist */}
                <div className="space-y-2 mb-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Impact Matrix:</span>
                  <div className="flex items-center gap-2 text-xs text-rose-700">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Wipe all Registered Products</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-rose-700">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Wipe Categories, Suppliers, Customers</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-rose-700">
                    <X className="w-3.5 h-3.5 shrink-0" />
                    <span>Wipe Sales, Cash registers, Stock entries</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Generate Fresh Blank Session</span>
                  </div>
                </div>
              </div>

              <button
                disabled={loading}
                onClick={() => {
                  setTypedConfirmation('');
                  setModalCheckbox(false);
                  setActiveModal('complete');
                }}
                className="w-full font-bold py-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all text-xs uppercase tracking-wider text-center shadow-lg hover:shadow-rose-100 active:scale-[0.98]"
              >
                Perform Full System Wipe
              </button>
            </div>
          </div>

          {/* Bottom security assurance alert */}
          <div className="pt-6 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-400">
            <RefreshCcw className="w-4 h-4 text-slate-300 animate-spin" style={{ animationDuration: '6s' }} />
            <span>Reset actions are secure, validated server-side, and recorded in the audit logs directory.</span>
          </div>
        </div>
      </div>

      {/* Confirmation Safeguard Modal Panel */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden relative z-10"
            >
              {/* Close Button */}
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {activeModal === 'transactions' ? (
                <>
                  <div className="p-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-4">
                      <Trash2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-wide">Clear Transactions History?</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      This will delete all sales, returns, credit registries, and stock movements. Your customer records, suppliers list, products inventory, and pricing data will be **fully retained**.
                    </p>
                  </div>

                  <div className="px-6 py-4 bg-slate-50 border-t border-b border-slate-100 space-y-3">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider text-left">
                      To confirm, type <span className="text-amber-700 font-extrabold select-all">"RESET"</span> below:
                    </label>
                    <input 
                      type="text" 
                      placeholder="Type RESET"
                      value={typedConfirmation}
                      onChange={(e) => setTypedConfirmation(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono tracking-widest text-center focus:ring-2 focus:ring-amber-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="p-4 bg-slate-50/50 flex gap-3">
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleResetExecute('transactions')}
                      disabled={typedConfirmation.trim().toUpperCase() !== 'RESET'}
                      className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:hover:bg-amber-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Yes, Clear Transactions
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-6 text-center">
                    <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-4">
                      <ShieldAlert className="w-6 h-6 animate-bounce" style={{ animationDuration: '3s' }} />
                    </div>
                    <h3 className="text-lg font-bold text-rose-900 tracking-wide">Danger: Unrecoverable Wipe</h3>
                    <p className="text-xs text-rose-700/90 mt-2 leading-relaxed">
                      You are about to wipe the entire database. This will drop all custom goods, customer limits, category registries, profiles, sales, and settings.
                    </p>
                  </div>

                  <div className="px-6 py-4 bg-rose-50/50 border-t border-b border-rose-100 space-y-4">
                    <div className="flex items-start gap-2.5 text-left">
                      <input 
                        type="checkbox" 
                        id="modalConfirmComplete" 
                        checked={modalCheckbox}
                        onChange={(e) => setModalCheckbox(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                      />
                      <label htmlFor="modalConfirmComplete" className="text-[10px] font-bold text-rose-800 uppercase tracking-tight cursor-pointer select-none leading-normal">
                        I am a system manager and explicitly authorize deleting all records.
                      </label>
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="block text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                        To confirm, type <span className="text-rose-900 font-extrabold select-all">"WIPE"</span> below:
                      </label>
                      <input 
                        type="text" 
                        placeholder="Type WIPE"
                        value={typedConfirmation}
                        onChange={(e) => setTypedConfirmation(e.target.value)}
                        className="w-full bg-white border border-rose-300 rounded-xl px-4 py-2.5 text-xs font-mono tracking-widest text-center focus:ring-2 focus:ring-rose-500 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-rose-50 flex gap-3">
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-800 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleResetExecute('complete')}
                      disabled={!modalCheckbox || typedConfirmation.trim().toUpperCase() !== 'WIPE'}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                    >
                      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Yes, Wipe All Data
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
