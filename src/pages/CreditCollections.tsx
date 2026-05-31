import React, { useState, useEffect } from 'react';
import { 
  Banknote, 
  Search, 
  Printer, 
  DollarSign, 
  Filter, 
  X, 
  Check, 
  Eye, 
  Layers, 
  ChevronDown, 
  Calendar, 
  FileText, 
  RefreshCw, 
  UserCheck, 
  Plus, 
  Trash2, 
  CreditCard 
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import PrintPreviewModal from '../components/PrintPreviewModal';

export default function CreditCollections() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all'); // all, paid, unpaid
  const [selectedWorkingPlace, setSelectedWorkingPlace] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const { token } = useAuthStore();
  const { currency } = useTheme();

  // Screen level view control: 'list' (Main Grid) or 'bulk_page' (Dedicated Workspace)
  const [currentScreen, setCurrentScreen] = useState<'list' | 'bulk_page'>('list');

  // Segment Filter for Main Grid ('DELIVERY' | 'WALKIN' | 'ALL')
  const [activeMemberType, setActiveMemberType] = useState<'DELIVERY' | 'WALKIN' | 'ALL'>('DELIVERY');
  const [selectedCustomers, setSelectedCustomers] = useState<Record<string, boolean>>({});

  // Core Processing & Status states
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Single Quick Payment Modal States
  const [singlePayCustomer, setSinglePayCustomer] = useState<any>(null);
  const [singleAmount, setSingleAmount] = useState('');
  const [singleNotes, setSingleNotes] = useState('Collected individual balance');

  // --- Put Ledger Modal States ---
  const [ledgerCustomer, setLedgerCustomer] = useState<any>(null);
  const [ledgerMode, setLedgerMode] = useState<'limit' | 'status'>('limit');
  const [newCreditLimit, setNewCreditLimit] = useState('');
  const [newCreditStatus, setNewCreditStatus] = useState('ACTIVE');
  const [ledgerReason, setLedgerReason] = useState('');
  const [ledgerSuccess, setLedgerSuccess] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // --- View Payments Modal States ---
  const [historyCustomer, setHistoryCustomer] = useState<any>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // --- Dedicated Bulk Page States ---
  const [bulkWorkspaceMembers, setBulkWorkspaceMembers] = useState<any[]>([]);
  const [bulkMemberSearch, setBulkMemberSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [bulkPageAmounts, setBulkPageAmounts] = useState<Record<string, string>>({});
  const [bulkWorkplaceFilter, setBulkWorkplaceFilter] = useState('');
  
  // Checkout popup for Bulk Page Settle Payment
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState<'Cash' | 'Banking' | 'Payroll Deduction'>('Cash');
  const [checkoutDate, setCheckoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [checkoutRemark, setCheckoutRemark] = useState('');

  // Fetch all customers on load
  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers', { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        // Enforce visible credit items
        setCustomers(data.data.filter((c: any) => c.credit_limit > 0));
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  useEffect(() => { 
    fetchCustomers(); 
  }, []);

  // Sync / Auto-clear selections
  useEffect(() => {
    setSelectedCustomers({});
  }, [activeMemberType, search, status, selectedWorkingPlace, startDate, endDate]);

  // Handle building unique list of working places
  const workingPlaces = Array.from(new Set(customers.map(c => c.working_place).filter(Boolean))) as string[];

  // General Filtered Customers for main listing
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const balance = parseFloat(c.current_balance || '0');
    const matchesStatus = status === 'all' ? true : status === 'paid' ? balance <= 0 : balance > 0;
    const matchesWorkingPlace = selectedWorkingPlace === '' ? true : (c.working_place || '').toLowerCase() === selectedWorkingPlace.toLowerCase();
    
    // Member Class type filter
    const matchesMemberType = activeMemberType === 'ALL' ? true : (c.member_type === 'DELIVERY' ? 'DELIVERY' : 'WALKIN') === activeMemberType;
    return matchesSearch && matchesStatus && matchesWorkingPlace && matchesMemberType;
  });

  // Action: Select / Deselect individual rows in main table
  const handleSelectAll = (checked: boolean) => {
    const nextSelection: Record<string, boolean> = {};
    if (checked) {
      filteredCustomers.forEach(c => {
        nextSelection[String(c.id)] = true;
      });
    }
    setSelectedCustomers(nextSelection);
  };

  const handleSelectCustomer = (id: string, checked: boolean) => {
    setSelectedCustomers(prev => {
      const next = { ...prev };
      if (checked) {
        next[String(id)] = true;
      } else {
        delete next[String(id)];
      }
      return next;
    });
  };

  const selectedCount = Object.keys(selectedCustomers).length;
  const totalSelectedOutstanding = filteredCustomers
    .filter(c => selectedCustomers[String(c.id)])
    .reduce((sum, c) => sum + parseFloat(c.current_balance || '0'), 0);

  // Quick Payment Modal actions
  const openSinglePaymentModal = (customer: any) => {
    setSinglePayCustomer(customer);
    setSingleAmount(parseFloat(customer.current_balance || '0').toFixed(2));
    setSingleNotes('Manual individual outstanding balance settlement');
    setPaymentSuccess(null);
    setPaymentError(null);
  };

  const handleSinglePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(singleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Please enter a valid credit payment amount');
      return;
    }

    setProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    try {
      const res = await fetch(`/api/customers/${singlePayCustomer.id}/payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ amount: amountNum, notes: singleNotes })
      });
      const data = await res.json();
      if (data.success) {
        setPaymentSuccess(`Succeeded: Paid ${currency.symbol}${amountNum.toFixed(2)} toward ${singlePayCustomer.name}`);
        setTimeout(() => {
          setSinglePayCustomer(null);
          fetchCustomers();
        }, 1200);
      } else {
        setPaymentError(data.message || 'Server rejected ledger balance change');
      }
    } catch (err) {
      setPaymentError('Network signals disrupted. Retry again.');
    } finally {
      setProcessing(false);
    }
  };

  // --- Put Ledger Modal Helpers (Set Custom credit levels / update states) ---
  const openPutLedgerModal = (customer: any) => {
    setLedgerCustomer(customer);
    setNewCreditLimit(parseFloat(customer.credit_limit || '0').toFixed(2));
    setNewCreditStatus(customer.credit_status || 'ACTIVE');
    setLedgerReason('Standard ledger adjustment audit update');
    setLedgerSuccess(null);
    setLedgerError(null);
    setLedgerMode('limit');
  };

  const handleLedgerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setLedgerSuccess(null);
    setLedgerError(null);

    try {
      if (ledgerMode === 'limit') {
        const limitFloat = parseFloat(newCreditLimit);
        if (isNaN(limitFloat) || limitFloat < 0) {
          setLedgerError('Please provide a valid threshold number');
          setProcessing(false);
          return;
        }

        const res = await fetch(`/api/admin/customers/${ledgerCustomer.id}/update-limit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ new_limit: limitFloat, reason: ledgerReason })
        });
        const data = await res.json();
        if (data.success) {
          setLedgerSuccess(`Credit limit updated to ${currency.symbol}${limitFloat.toFixed(2)} successfully!`);
          setTimeout(() => {
            setLedgerCustomer(null);
            fetchCustomers();
          }, 1500);
        } else {
          setLedgerError(data.message || 'Operation rejected by database safety rules.');
        }
      } else {
        // Update credit status logs
        const res = await fetch(`/api/admin/customers/${ledgerCustomer.id}/credit-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ new_status: newCreditStatus, reason: ledgerReason })
        });
        const data = await res.json();
        if (data.success) {
          setLedgerSuccess(`Credit status successfully modified to: ${newCreditStatus}`);
          setTimeout(() => {
            setLedgerCustomer(null);
            fetchCustomers();
          }, 1500);
        } else {
          setLedgerError(data.message || 'Failed to update credit policy status.');
        }
      }
    } catch (err) {
      setLedgerError('Network communication failed during ledger sync.');
    } finally {
      setProcessing(false);
    }
  };

  // --- View Payment / Credit History Timeline Modal helpers ---
  const openViewPaymentsModal = async (customer: any) => {
    setHistoryCustomer(customer);
    setHistoryLogs([]);
    setLogsLoading(true);

    try {
      const res = await fetch(`/api/customers/${customer.id}/credit-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistoryLogs(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  // --- Dedicated Page Bulk Payments Workspaces ---
  const openDedicatedBulkPage = () => {
    // Collect customers who are checked on the main screen to populate initially
    const preselected = customers.filter(c => selectedCustomers[String(c.id)]);
    const initialAmounts: Record<string, string> = {};
    preselected.forEach(c => {
      initialAmounts[String(c.id)] = parseFloat(c.current_balance || '0').toFixed(2);
    });

    setBulkWorkspaceMembers(preselected);
    setBulkPageAmounts(initialAmounts);
    setBulkMemberSearch('');
    setDropdownOpen(false);
    setBulkWorkplaceFilter('');
    setCurrentScreen('bulk_page');
    setPaymentSuccess(null);
    setPaymentError(null);
  };

  const handleBulkWorkplaceFilterChange = (wp: string) => {
    setBulkWorkplaceFilter(wp);
    if (wp) {
      // Find all customers belonging to this working place
      const membersOfWP = customers.filter(c => (c.working_place || '').toLowerCase() === wp.toLowerCase());
      
      // Auto-load them in the bulk workspace table
      setBulkWorkspaceMembers(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const toAdd = membersOfWP.filter(m => !existingIds.has(m.id));
        return [...prev, ...toAdd];
      });

      // Initialize defaults
      setBulkPageAmounts(prev => {
        const next = { ...prev };
        membersOfWP.forEach(c => {
          if (!next[String(c.id)]) {
            next[String(c.id)] = parseFloat(c.current_balance || '0').toFixed(2);
          }
        });
        return next;
      });
    }
  };

  // Dropdown member selector: add / remove customer
  const toggleBulkPageMemberSelection = (customer: any) => {
    const isAlreadyAdded = bulkWorkspaceMembers.some(m => m.id === customer.id);
    if (isAlreadyAdded) {
      // Remove
      setBulkWorkspaceMembers(prev => prev.filter(m => m.id !== customer.id));
      setBulkPageAmounts(prev => {
        const next = { ...prev };
        delete next[String(customer.id)];
        return next;
      });
    } else {
      // Add
      setBulkWorkspaceMembers(prev => [...prev, customer]);
      setBulkPageAmounts(prev => ({
        ...prev,
        [String(customer.id)]: parseFloat(customer.current_balance || '0').toFixed(2)
      }));
    }
  };

  const handleRemoveMemberFromBulkList = (id: string | number) => {
    setBulkWorkspaceMembers(prev => prev.filter(m => m.id !== id));
    setBulkPageAmounts(prev => {
      const next = { ...prev };
      delete next[String(id)];
      return next;
    });
  };

  // Open Checkout Popup from Bulk page
  const handleProceedToCheckout = () => {
    const visibleMembers = bulkWorkspaceMembers.filter(member => 
      !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase()
    );

    // Validate we have at least one valid payment amount > 0
    const hasValidPayment = visibleMembers.some(member => {
      const v = bulkPageAmounts[String(member.id)] || '0';
      const parsed = parseFloat(v);
      return !isNaN(parsed) && parsed > 0;
    });

    if (!hasValidPayment || visibleMembers.length === 0) {
      setPaymentError('Must include at least one valid member with a positive payment amount.');
      return;
    }

    setPaymentError(null);
    setPaymentSuccess(null);
    
    // Default checkout settings
    setCheckoutMethod('Cash');
    setCheckoutRemark('Multi-member bulk payments processing session');
    setCheckoutDate(new Date().toISOString().split('T')[0]);
    setCheckoutOpen(true);
  };

  // Settle bulk page payment through popup
  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setPaymentError(null);
    setPaymentSuccess(null);

    let successesCount = 0;
    let totalPaidValue = 0;
    const errorsList: string[] = [];

    // Formatted aggregated notes including the requested cash/banking/payroll, date, and remark
    const compositeNotes = `Method: ${checkoutMethod} | Settle Date: ${checkoutDate} | Remark: ${checkoutRemark || 'None'}`;

    const visibleMembers = bulkWorkspaceMembers.filter(member => 
      !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase()
    );

    for (const member of visibleMembers) {
      const amntStr = bulkPageAmounts[String(member.id)] || '0';
      const amntFloat = parseFloat(amntStr);
      if (isNaN(amntFloat) || amntFloat <= 0) continue;

      try {
        const res = await fetch(`/api/customers/${member.id}/payment`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ amount: amntFloat, notes: compositeNotes })
        });
        const data = await res.json();
        if (data.success) {
          successesCount++;
          totalPaidValue += amntFloat;
        } else {
          errorsList.push(`${member.name}: ${data.message || 'Settlement Denied'}`);
        }
      } catch (err) {
        errorsList.push(`${member.name}: Timeout`);
      }
    }

    setProcessing(false);

    if (errorsList.length > 0) {
      setPaymentError(`Succeeded: ${successesCount} payments processed. Amount: ${currency.symbol}${totalPaidValue.toFixed(2)}. Issues: ${errorsList.join(', ')}`);
      fetchCustomers();
    } else {
      setPaymentSuccess(`Splendid! Successfully processed payments for ${successesCount} accounts! Gross Settle Value: ${currency.symbol}${totalPaidValue.toFixed(2)}`);
      
      // Clear bulk workspace state for only the paid members
      setBulkWorkspaceMembers(prev => prev.filter(m => !visibleMembers.some(vm => vm.id === m.id)));
      setBulkPageAmounts(prev => {
        const next = { ...prev };
        visibleMembers.forEach(vm => {
          delete next[String(vm.id)];
        });
        return next;
      });
      setSelectedCustomers({});

      setTimeout(() => {
        setCheckoutOpen(false);
        setCurrentScreen('list');
        fetchCustomers();
      }, 2000);
    }
  };

  // Multi-selector payout launch directly from float bar
  const openBulkPaymentFromFloatBar = () => {
    // Populate the workspace list from current selections on main panel
    openDedicatedBulkPage();
  };

  return (
    <div className="p-4 h-full flex flex-col bg-slate-50 text-slate-800 font-sans text-[10px] uppercase transition-all">
      
      {/* ==================== VIEW 1: DEDICATED BULK PAYMENT PAGE ==================== */}
      {currentScreen === 'bulk_page' ? (
        <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded shadow-sm overflow-hidden">
          
          {/* Header Panel for Bulk Workspace */}
          <div className="bg-slate-900 text-white p-4 shrink-0 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400 animate-pulse"/>
              <div>
                <h1 className="text-xs font-black tracking-widest uppercase">Multi-Account Settle Desk & Ledger Workbench</h1>
                <p className="text-[8px] text-slate-400 font-bold tracking-wider normal-case mt-0.5">Configure individual settlement fields, then execute aggregate payments via cashier channels</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setCurrentScreen('list'); 
                  setPaymentError(null); 
                  setPaymentSuccess(null);
                }} 
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-3 py-1.5 rounded text-[10px] uppercase font-black tracking-wider transition-all"
              >
                ← Back to List
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-auto flex flex-col lg:flex-row gap-4">
            
            {/* LEFT / MAIN WORK AREA: Selected list to make payment */}
            <div className="flex-1 flex flex-col min-h-[300px]">
                           {/* Filter Button with Dropdown for Members Selection */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sticky top-0 z-20">
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Workplace Filter Select */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Workplace:</span>
                    <select
                      value={bulkWorkplaceFilter}
                      onChange={e => handleBulkWorkplaceFilterChange(e.target.value)}
                      className="border border-slate-200 p-1.5 rounded text-[10px] uppercase bg-white font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">All Workplaces</option>
                      {workingPlaces.map(wp => (
                        <option key={wp} value={wp}>{wp}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <span>Filter & Select Members</span>
                      <ChevronDown size={12} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Options List */}
                    {dropdownOpen && (
                      <div className="absolute left-0 mt-2 w-72 bg-white border border-slate-200 shadow-2xl rounded-lg z-50 p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <span className="font-black text-slate-500 text-[8px] tracking-wider uppercase">Active Customer Register</span>
                          <button 
                            onClick={() => setDropdownOpen(false)}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <X size={12}/>
                          </button>
                        </div>

                        {/* Dropdown Search container */}
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search registered names..."
                            value={bulkMemberSearch}
                            onChange={e => setBulkMemberSearch(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded py-1 pl-7 pr-2 font-bold focus:bg-white text-[9px] outline-none tracking-wider text-slate-800"
                          />
                        </div>

                        {/* List scrollbox */}
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 pr-1">
                          {customers
                            .filter(c => c.name.toLowerCase().includes(bulkMemberSearch.toLowerCase()))
                            .filter(c => !bulkWorkplaceFilter || (c.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase())
                            .map(customer => {
                              const isAdded = bulkWorkspaceMembers.some(m => m.id === customer.id);
                              return (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => toggleBulkPageMemberSelection(customer)}
                                  className="w-full p-2 hover:bg-indigo-50/50 flex items-center justify-between rounded text-left gap-2 transition-colors"
                                >
                                  <div>
                                    <div className="font-black text-slate-900 text-[9px]">{customer.name}</div>
                                    <div className="text-[7.5px] text-slate-400 font-mono tracking-wide">
                                      {customer.working_place || 'No Workplace'} | Bal: RM{parseFloat(customer.current_balance || '0').toFixed(2)}
                                    </div>
                                  </div>
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                    isAdded ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                                  }`}>
                                    {isAdded && <Check size={10} strokeWidth={3}/>}
                                  </div>
                                </button>
                              );
                            })}
                          {customers
                            .filter(c => c.name.toLowerCase().includes(bulkMemberSearch.toLowerCase()))
                            .filter(c => !bulkWorkplaceFilter || (c.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase())
                            .length === 0 && (
                            <div className="text-center py-4 text-slate-400 italic text-[8px]">No matching members found</div>
                          )}
                        </div>

                        {/* Fast selection macros */}
                        <div className="flex gap-1.5 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              // Add all visible and matching workplace
                              const visible = customers
                                .filter(c => c.name.toLowerCase().includes(bulkMemberSearch.toLowerCase()))
                                .filter(c => !bulkWorkplaceFilter || (c.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase());
                              
                              setBulkWorkspaceMembers(prev => {
                                const existingIds = new Set(prev.map(m => m.id));
                                const toAdd = visible.filter(m => !existingIds.has(m.id));
                                return [...prev, ...toAdd];
                              });

                              setBulkPageAmounts(prev => {
                                const next = { ...prev };
                                visible.forEach(c => {
                                  if (!next[String(c.id)]) {
                                    next[String(c.id)] = parseFloat(c.current_balance || '0').toFixed(2);
                                  }
                                });
                                return next;
                              });
                            }}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-1 rounded text-[7.5px] font-black text-center"
                          >
                            Add All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Remove all members of current workplace filter
                              if (bulkWorkplaceFilter) {
                                setBulkWorkspaceMembers(prev => prev.filter(m => (m.working_place || '').toLowerCase() !== bulkWorkplaceFilter.toLowerCase()));
                                setBulkPageAmounts(prev => {
                                  const next = { ...prev };
                                  bulkWorkspaceMembers
                                    .filter(m => (m.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase())
                                    .forEach(m => {
                                      delete next[String(m.id)];
                                    });
                                  return next;
                                });
                              } else {
                                setBulkWorkspaceMembers([]);
                                setBulkPageAmounts({});
                              }
                            }}
                            className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-1 rounded text-[7.5px] font-black text-center"
                          >
                            Clear All
                          </button>
                        </div>

                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white py-1 px-3.5 rounded border">
                  Session Count: <span className="text-indigo-600">
                    {bulkWorkspaceMembers.filter(member => !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase()).length} Accounts Active
                  </span>
                </div>
              </div>

              {/* Multiple Section list body */}
              <div className="flex-1 border border-slate-200 rounded overflow-hidden flex flex-col bg-slate-50/50">
                <div className="flex-1 overflow-auto min-h-[150px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-500 font-black border-b sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 uppercase text-[8px] tracking-wider">Member Details</th>
                        <th className="py-2.5 px-3 uppercase text-[8px] tracking-wider">Working Place</th>
                        <th className="py-2.5 px-3 uppercase text-[8px] tracking-wider text-orange-600 font-mono">Debt Balance</th>
                        <th className="py-2.5 px-3 uppercase text-[8px] tracking-wider font-mono w-48">Payment Settle Amount ({currency.symbol})</th>
                        <th className="py-2.5 px-3 text-center uppercase text-[8px] tracking-wider w-16">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {bulkWorkspaceMembers
                        .filter(member => !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase())
                        .map(member => (
                          <tr key={member.id} className="hover:bg-indigo-50/20 transition-all">
                            <td className="py-3 px-3">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-900 text-[10px]">{member.name}</span>
                                <span className="text-[8px] text-slate-400 font-mono lower">{member.phone || 'No phone logs'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-500">{member.working_place || 'Walk-In'}</td>
                            <td className="py-3 px-3 font-mono font-bold text-red-600">{currency.symbol}{parseFloat(member.current_balance || '0').toFixed(2)}</td>
                            <td className="py-3 px-3">
                              <div className="relative">
                                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-[9px] text-slate-400">{currency.symbol}</div>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={bulkPageAmounts[String(member.id)] || ''}
                                  onChange={e => setBulkPageAmounts({
                                    ...bulkPageAmounts,
                                    [String(member.id)]: e.target.value
                                  })}
                                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-7 pr-3 py-1.5 rounded font-mono text-[10px] font-black focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none shadow-inner text-right"
                                  placeholder="0.00"
                                />
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMemberFromBulkList(member.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-all active:scale-95"
                                title="Delete row"
                              >
                                <Trash2 size={13}/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      {bulkWorkspaceMembers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-20 text-center text-slate-300 font-extrabold italic tracking-widest text-[9px] uppercase">
                            No members added to compilation list.<br/>
                            <span className="text-[8px] text-indigo-500 font-sans font-bold normal-case mt-1 inline-block">Use the "Filter & Select Members" dropdown to add records.</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer totals ribbon */}
                {bulkWorkspaceMembers.length > 0 && (
                  <div className="bg-slate-900 text-white p-3.5 shrink-0 flex justify-between items-center border-t rounded-b shadow-inner">
                    <div className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                      Cumulative Outstanding Settle Total:
                    </div>
                    <div className="text-sm font-black font-mono text-emerald-400">
                      {currency.symbol}{
                        bulkWorkspaceMembers.reduce((sum, m) => {
                          const val = parseFloat(bulkPageAmounts[String(m.id)] || '0');
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0).toFixed(2)
                      }
                    </div>
                  </div>
                )}
              </div>

              {/* Error Ribbon */}
              {paymentError && (
                <div className="mt-3 bg-red-50 border border-red-200 text-red-600 p-3 rounded font-mono text-[9px] uppercase whitespace-pre-line shadow-inner animate-pulse">
                  ❌ Execution Error:<br/>
                  <span className="font-semibold normal-case text-slate-800">{paymentError}</span>
                </div>
              )}

              {/* General submission button */}
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentScreen('list');
                    setPaymentError(null);
                    setPaymentSuccess(null);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold tracking-wider text-[10px] px-6 py-3 rounded uppercase border cursor-pointer active:scale-95"
                >
                  Cancel Workspace
                </button>
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  disabled={bulkWorkspaceMembers.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/30 text-white font-black tracking-widest text-[10px] px-8 py-3 rounded uppercase shadow-lg shadow-emerald-600/10 cursor-pointer active:scale-95 flex items-center gap-1.5 transition-all"
                >
                  <DollarSign size={13}/> Settle Bulk Collection
                </button>
              </div>

            </div>

          </div>

          {/* ========================================================== */}
          {/* POP UP Checkout Dialog (Cash / Banking / Payroll Deduction) */}
          {/* ========================================================== */}
          {checkoutOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in duration-150">
              <div className="bg-white border border-slate-300 shadow-2xl rounded-lg w-full max-w-md overflow-hidden animate-zoom-in">
                
                {/* Header */}
                <div className="bg-slate-955 bg-indigo-950 text-white p-4 flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-black tracking-widest text-[10px] uppercase">
                      Confirm Bulk Settle Channel
                    </h3>
                  </div>
                  <button onClick={() => setCheckoutOpen(false)} className="text-slate-300 hover:text-white transition-colors">
                    <X size={15} />
                  </button>
                </div>

                <form onSubmit={handleCheckoutSubmit} className="p-5 space-y-4">
                  
                  {/* Payment Methods radio segment selection */}
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Settle Payment Mode</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['Cash', 'Banking', 'Payroll Deduction'].map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setCheckoutMethod(method as any)}
                          className={`py-2 px-1 rounded uppercase font-black text-[8px] tracking-wider text-center border transition-all ${
                            checkoutMethod === method
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Settle Date Input */}
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Transaction Allocation Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="date"
                        required
                        value={checkoutDate}
                        onChange={e => setCheckoutDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-9 pr-4 py-2 rounded font-mono font-bold text-[10px] uppercase outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Remarks Notes */}
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Batch Collection Remarks
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutRemark}
                      onChange={e => setCheckoutRemark(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-[10px] text-slate-900 px-3 py-2 rounded font-bold outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white shadow-inner"
                      placeholder="Input billing remark details..."
                    />
                  </div>

                  {/* Operational parameters output */}
                  <div className="bg-slate-50 border rounded p-2 text-slate-600 text-[8.5px] font-mono leading-relaxed uppercase">
                    Accounts: <span className="font-bold text-slate-900">
                      {bulkWorkspaceMembers.filter(member => !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase()).length}
                    </span><br/>
                    Settle Sum: <span className="font-bold text-slate-900">{currency.symbol}{
                      bulkWorkspaceMembers
                        .filter(member => !bulkWorkplaceFilter || (member.working_place || '').toLowerCase() === bulkWorkplaceFilter.toLowerCase())
                        .reduce((sum, m) => {
                          const val = parseFloat(bulkPageAmounts[String(m.id)] || '0');
                          return sum + (isNaN(val) ? 0 : val);
                        }, 0).toFixed(2)
                    }</span>
                  </div>

                  {paymentSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-2.5 rounded text-[9.5px] font-black tracking-wide flex items-center gap-1.5 uppercase transition-all duration-150 animate-bounce">
                      <Check size={12}/> {paymentSuccess}
                    </div>
                  )}

                  {paymentError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded font-mono text-[8px] uppercase tracking-wide">
                      ❌ {paymentError}
                    </div>
                  )}

                  {/* Form Submission Actions */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="flex-1 bg-slate-100 border hover:bg-slate-200 text-slate-700 py-2.5 rounded font-black cursor-pointer uppercase transition-all"
                      disabled={processing}
                    >
                      Close Back
                    </button>
                    <button
                      type="submit"
                      disabled={processing}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/30 text-white py-2.5 rounded font-black shadow-lg shadow-indigo-500/20 uppercase tracking-widest flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                    >
                      {processing ? 'Processing...' : 'Settle Now'}
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

        </div>
      ) : (
        /* ==================== VIEW 2: CORE REGISTER MAIN LIST ==================== */
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Header Panel */}
          <div className="bg-white border border-slate-200 p-3.5 flex flex-wrap justify-between items-center gap-3 mb-4 rounded shadow-sm">
            <h1 className="text-sm font-black flex items-center gap-2">
              <Banknote className="w-4 h-4 text-indigo-600" /> 
              Credit Collections Dashboard
            </h1>
            
            <div className="flex items-center gap-2 ml-auto">
              {/* Compact Search Wrapper */}
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  className="w-full border border-slate-200 text-slate-900 py-1.5 pl-8 pr-2.5 rounded text-[10px] uppercase focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 font-bold" 
                  placeholder="Search Registered Name..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                />
              </div>

              {/* Toggle Filters Button */}
              <button 
                type="button"
                onClick={() => setShowFilters(!showFilters)} 
                className={`px-2.5 py-1.5 rounded border text-[10px] uppercase font-black flex items-center gap-1.5 transition-colors cursor-pointer ${
                  showFilters || status !== 'all' || selectedWorkingPlace !== '' || month !== '' || year !== '' || startDate !== '' || endDate !== ''
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                }`}
                title="Toggle Filter Options"
              >
                <Filter size={11} className={showFilters ? 'text-indigo-600' : 'text-slate-500'} />
                <span>Filters</span>
                {(status !== 'all' || selectedWorkingPlace !== '' || month !== '' || year !== '' || startDate !== '' || endDate !== '') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-pulse"></span>
                )}
              </button>

              {/* Optional Quick Clear button when filters are active */}
              {(status !== 'all' || selectedWorkingPlace !== '' || month !== '' || year !== '' || startDate !== '' || endDate !== '' || search !== '') && (
                <button
                  onClick={() => {
                    setStatus('all');
                    setSelectedWorkingPlace('');
                    setMonth('');
                    setYear('');
                    setStartDate('');
                    setEndDate('');
                    setSearch('');
                  }}
                  className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 px-3 py-1.5 rounded font-black transition-colors pointer-events-auto"
                >
                  Reset
                </button>
              )}

              {/* PRINT BUTTON */}
              <button 
                onClick={() => setShowPrintModal(true)} 
                className="bg-slate-200 px-3 py-1.5 rounded flex items-center gap-1 font-black hover:bg-slate-300 transition-colors cursor-pointer"
              >
                <Printer size={12}/> Print Report
              </button>

              {/* DEDICATED BULK PAYMENT PAGE LAUNCHER */}
              <button
                type="button"
                onClick={openDedicatedBulkPage}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded flex items-center gap-1.5 font-black uppercase transition-colors shadow-sm cursor-pointer"
              >
                <Layers size={12}/> Bulk Payment Page
              </button>
            </div>
          </div>

          {/* Expanded filters block */}
          {showFilters && (
            <div className="bg-white p-3 border border-slate-200 mb-4 rounded shadow-sm grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 transition-all duration-300">
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">STATUS</label>
                <select className="w-full border border-slate-200 p-1.5 rounded text-[10px] uppercase bg-white font-bold" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">WORKING PLACE</label>
                <select className="w-full border border-slate-200 p-1.5 rounded text-[10px] uppercase bg-white font-bold" value={selectedWorkingPlace} onChange={e => setSelectedWorkingPlace(e.target.value)}>
                  <option value="">All Working Places</option>
                  {workingPlaces.map((wp) => (
                    <option key={wp} value={wp}>{wp}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">MONTH</label>
                <select className="w-full border border-slate-200 p-1.5 rounded text-[10px] uppercase bg-white font-bold" value={month} onChange={e => setMonth(e.target.value)}>
                  <option value="">Month</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">YEAR</label>
                <select className="w-full border border-slate-200 p-1.5 rounded text-[10px] uppercase bg-white font-bold" value={year} onChange={e => setYear(e.target.value)}>
                  <option value="">Year</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">START DATE</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-slate-200 p-1 rounded text-[10px] bg-white font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[8px] font-black text-slate-400 mb-1">END DATE</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-slate-200 p-1 rounded text-[10px] bg-white font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Segmented Filter Control Buttons */}
          <div className="flex bg-slate-200/60 p-1 border border-slate-200/80 rounded mb-4 w-fit shadow-sm gap-1">
            <button
              onClick={() => setActiveMemberType('DELIVERY')}
              className={`px-4 py-2 rounded text-[9px] font-black tracking-wider transition-all duration-200 uppercase ${
                activeMemberType === 'DELIVERY'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              Members (Delivery Food)
            </button>
            <button
              onClick={() => setActiveMemberType('WALKIN')}
              className={`px-4 py-2 rounded text-[9px] font-black tracking-wider transition-all duration-200 uppercase ${
                activeMemberType === 'WALKIN'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              Members (Walk-In)
            </button>
            <button
              onClick={() => setActiveMemberType('ALL')}
              className={`px-4 py-2 rounded text-[9px] font-black tracking-wider transition-all duration-200 uppercase ${
                activeMemberType === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              All Classes
            </button>
          </div>



          {/* Table Grid list */}
          <div className="flex-1 overflow-auto border border-slate-200 bg-white rounded shadow-sm mb-2" id="report-content">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 font-black">Name</th>
                  <th className="py-3 px-4 font-black">Member Type</th>
                  <th className="py-3 px-4 font-black">Working Place</th>
                  <th className="py-3 px-4 font-black">Credit Limit</th>
                  <th className="py-3 px-4 font-black text-orange-600">Current Balance</th>
                  <th className="py-3 px-4 font-black text-right no-print w-64">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(c => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">

                      {/* Name Card */}
                      <td className="py-3 px-4 font-black">
                        <div className="flex flex-col">
                          <span className="text-slate-900 text-[10px]">{c.name}</span>
                          <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">{c.phone || 'No Phone Logs'}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-4">
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${
                          c.member_type === 'DELIVERY' 
                            ? 'bg-amber-50 border-amber-200 text-amber-700' 
                            : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        }`}>
                          {c.member_type === 'DELIVERY' ? 'Delivery Food' : 'Walk-In'}
                        </span>
                      </td>

                      {/* Workplace */}
                      <td className="py-3 px-4 font-bold text-slate-500">{c.working_place || '-'}</td>
                      
                      {/* Limits representation */}
                      <td className="py-3 px-4 font-mono">{currency.symbol}{parseFloat(c.credit_limit || '0').toFixed(2)}</td>
                      
                      {/* Balance indicators */}
                      <td className="py-3 px-4 font-black text-orange-600 font-mono italic text-[11px]">
                        {currency.symbol}{parseFloat(c.current_balance || '0').toFixed(2)}
                      </td>

                      {/* Actions Column: Put Ledger, Make Payment, View Payment buttons */}
                      <td className="py-3 px-4 text-right no-print">
                        <div className="flex items-center gap-1.5 justify-end">
                          
                          {/* 1. Put Ledger Button */}
                          <button
                            type="button"
                            onClick={() => openPutLedgerModal(c)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            title="Adjust limit levels and statuses logs"
                          >
                            <FileText size={10} className="text-indigo-600"/> Ledger
                          </button>

                          {/* 2. Make Payment Button (Collect payment manually for single customer) */}
                          <button
                            type="button"
                            onClick={() => openSinglePaymentModal(c)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer ml-1"
                            title="Collect payment now"
                          >
                            <DollarSign size={10} className="text-white"/> Pay
                          </button>

                          {/* 3. View Payment Button */}
                          <button
                            type="button"
                            onClick={() => openViewPaymentsModal(c)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                            title="Inspect payment transaction reports"
                          >
                            <Eye size={10}/> View
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center font-black text-slate-300 tracking-[0.3em] uppercase italic bg-slate-50">
                      No matching credit accounts on register
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Print Report Preview modal container */}
          <PrintPreviewModal
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            title="Report Preview"
          >
            <h2 className="text-xl font-bold mb-4">Credit Collections Report ({activeMemberType === 'ALL' ? 'All Classes' : activeMemberType})</h2>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 border-2">
                <tr>
                  <th className="py-2 px-2 border">Name</th>
                  <th className="py-2 px-2 border">Member Type</th>
                  <th className="py-2 px-2 border">Working Place</th>
                  <th className="py-2 px-2 border">Credit Limit</th>
                  <th className="py-2 px-2 border">Current Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map(c => (
                  <tr key={c.id}>
                    <td className="py-2 px-2 border font-bold">{c.name}</td>
                    <td className="py-2 px-2 border uppercase text-[8px]">{c.member_type || 'WALKIN'}</td>
                    <td className="py-2 px-2 border">{c.working_place || '-'}</td>
                    <td className="py-2 px-2 border font-mono">{currency.symbol}{parseFloat(c.credit_limit || '0').toFixed(2)}</td>
                    <td className="py-2 px-2 border font-bold text-orange-600 font-mono">{currency.symbol}{parseFloat(c.current_balance || '0').toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintPreviewModal>

        </div>
      )}

      {/* ========================================= */}
      {/* GLOBAL POPUPS FOR GRID MAIN VIEW          */}
      {/* ========================================= */}

      {/* 1. SINGLE PAYMENT MODAL */}
      {singlePayCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in duration-200">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-lg w-full max-w-md overflow-hidden animate-zoom-in">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-black tracking-widest text-[10px] flex items-center gap-1.5 uppercase">
                <DollarSign className="w-4 h-4 text-emerald-400 animate-pulse" /> Settle Member Balance
              </h3>
              <button onClick={() => setSinglePayCustomer(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSinglePaymentSubmit} className="p-5 space-y-4">
              <div>
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">MEMBER NAME</div>
                <div className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">{singlePayCustomer.name}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CURRENT OUTSTANDING</div>
                  <div className="font-mono text-xs font-black text-red-600">
                    {currency.symbol}{parseFloat(singlePayCustomer.current_balance || '0').toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">CREDIT LIMIT CAPACITY</div>
                  <div className="font-mono text-xs font-black text-slate-500">
                    {currency.symbol}{parseFloat(singlePayCustomer.credit_limit || '0').toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">PAYMENT AMOUNT RECEIVED ({currency.symbol})</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-xs">{currency.symbol}</div>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={singleAmount}
                    onChange={e => setSingleAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-8 pr-4 py-2.5 rounded font-mono font-black text-sm outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white shadow-inner"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">AUDIT MEMO REMARK</label>
                <input 
                  type="text"
                  value={singleNotes}
                  onChange={e => setSingleNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-[10px] text-slate-900 px-3 py-2 rounded font-bold outline-none focus:ring-1 focus:ring-indigo-600 shadow-inner"
                />
              </div>

              {paymentError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded text-[8px] font-black uppercase leading-relaxed whitespace-pre-line animate-pulse">
                  ❌ Error: {paymentError}
                </div>
              )}

              {paymentSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-2.5 rounded text-[8px] font-black flex items-center gap-1.5 uppercase leading-relaxed">
                  <Check size={12}/> {paymentSuccess}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSinglePayCustomer(null)}
                  className="flex-1 bg-slate-100 border hover:bg-slate-200 text-slate-700 py-2.5 rounded font-black cursor-pointer uppercase transition-all text-[10px]"
                  disabled={processing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white py-2.5 rounded font-black shadow-lg shadow-emerald-500/20 uppercase tracking-wider flex items-center justify-center transition-all active:scale-95 cursor-pointer text-[10px]"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Settle Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. PUT LEDGER MODAL (Change Limits or switch overall Credit status) */}
      {ledgerCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in duration-200">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-lg w-full max-w-md overflow-hidden animate-zoom-in">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div>
                <h3 className="font-black tracking-widest text-[10px] uppercase flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-400" />
                  Put Ledger Workspace
                </h3>
                <p className="text-[7.5px] text-slate-400 tracking-wider">Adjustment ledger logs mapping for {ledgerCustomer.name}</p>
              </div>
              <button onClick={() => setLedgerCustomer(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Selector mode Tabs */}
            <div className="flex bg-slate-100 p-1 border-b border-slate-200">
              <button
                type="button"
                onClick={() => setLedgerMode('limit')}
                className={`flex-1 py-2 font-black text-[9px] uppercase text-center rounded transition-all ${
                  ledgerMode === 'limit' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Adjust Credit Limit
              </button>
              <button
                type="button"
                onClick={() => setLedgerMode('status')}
                className={`flex-1 py-2 font-black text-[9px] uppercase text-center rounded transition-all ${
                  ledgerMode === 'status' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Settle Credit Status
              </button>
            </div>

            <form onSubmit={handleLedgerSubmit} className="p-5 space-y-4">
              
              {/* Conditional Input Block */}
              {ledgerMode === 'limit' ? (
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Configure Brand New Credit Limit ({currency.symbol})
                  </label>
                  <p className="text-[7.5px] text-slate-400 tracking-wide lowercase mb-2 normal-case">Updates overall allowed credit cap for manual member purchases.</p>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">{currency.symbol}</div>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newCreditLimit}
                      onChange={e => setNewCreditLimit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 text-slate-900 pl-8 pr-4 py-2 rounded font-mono font-black text-xs outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white shadow-inner"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                     Settle Credit Status Policy
                  </label>
                  <p className="text-[7.5px] text-slate-400 tracking-wide lowercase mb-2 normal-case">Block or allow overall credit allocation logs for this member.</p>
                  <select
                    value={newCreditStatus}
                    onChange={e => setNewCreditStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 text-xs px-2.5 py-2 rounded font-bold outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white"
                  >
                    <option value="ACTIVE">ACTIVE (ALLOW CREDIT TRANSACTIONS)</option>
                    <option value="SUSPENDED">SUSPENDED (BLOCK POS CREDIT ACTIONS)</option>
                  </select>
                </div>
              )}

              {/* General audit reason is requested */}
              <div>
                <label className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                   Reason / Comments Log for DB Change
                </label>
                <input
                  type="text"
                  required
                  value={ledgerReason}
                  onChange={e => setLedgerReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-[10px] text-slate-900 px-3 py-2 rounded font-bold outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white shadow-inner"
                  placeholder="Enter audit comment log reason..."
                />
              </div>

              {/* Status responses */}
              {ledgerError && (
                <div className="bg-red-50 border border-red-200 text-red-600 p-2.5 rounded text-[8.5px] font-mono uppercase tracking-wide">
                  ❌ Error: {ledgerError}
                </div>
              )}

              {ledgerSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-600 p-2.5 rounded text-[8.5px] font-mono uppercase tracking-wide flex items-center gap-1">
                  <Check size={11} strokeWidth={3}/> {ledgerSuccess}
                </div>
              )}

              {/* Footer actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setLedgerCustomer(null)}
                  className="flex-1 bg-slate-100 border hover:bg-slate-200 text-slate-700 py-2 rounded font-black cursor-pointer uppercase transition-all text-[9px]"
                  disabled={processing}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white py-2 rounded font-black shadow-lg shadow-indigo-500/20 uppercase tracking-widest flex items-center justify-center transition-all active:scale-95 cursor-pointer text-[9px]"
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Apply Adjustments'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 3. VIEW PAYMENTS MODAL */}
      {historyCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fade-in duration-200">
          <div className="bg-white border border-slate-300 shadow-2xl rounded-lg w-full max-w-lg overflow-hidden animate-zoom-in max-h-[80vh] flex flex-col">
            
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-black tracking-widest text-[10px] uppercase flex items-center gap-1.5">
                  <Eye strokeWidth={2.5} className="w-4 h-4 text-emerald-400" />
                  Collection & Ledger Audit logs
                </h3>
                <p className="text-[7.5px] text-slate-400 tracking-wider">Payment ledger timeline history for {historyCustomer.name}</p>
              </div>
              <button onClick={() => setHistoryCustomer(null)} className="text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Scrollable List body */}
            <div className="flex-1 overflow-auto p-4 space-y-4">
              
              {/* Summary Metadata */}
              <div className="bg-slate-50 border rounded p-3 grid grid-cols-3 gap-2 text-center text-[9px] uppercase">
                <div className="border-r font-black text-slate-500">
                  Total Debt<br/>
                  <span className="text-red-600 font-mono text-xs block mt-1">RM{parseFloat(historyCustomer.current_balance || '0').toFixed(2)}</span>
                </div>
                <div className="border-r font-black text-slate-500">
                  Allocated Limit<br/>
                  <span className="text-slate-900 font-mono text-xs block mt-1">RM{parseFloat(historyCustomer.credit_limit || '0').toFixed(2)}</span>
                </div>
                <div className="font-black text-slate-500">
                  Type Class<br/>
                  <span className="text-indigo-600 font-mono text-[9px] block mt-1.5">{historyCustomer.member_type || 'WALKIN'}</span>
                </div>
              </div>

              {/* Date Filters inside Modal */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3">
                <div className="font-black text-slate-500 text-[8px] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Calendar size={11} className="text-indigo-600" /> Payment Date Filters
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 mb-1">START DATE</label>
                    <input 
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-slate-200 p-1 rounded text-[10px] bg-white font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 mb-1">END DATE</label>
                    <input 
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-slate-200 p-1 rounded text-[10px] bg-white font-bold uppercase outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                {(startDate || endDate) && (
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setStartDate('');
                        setEndDate('');
                      }}
                      className="text-[8px] font-black uppercase text-red-600 hover:text-red-700 tracking-wider pointer-events-auto"
                    >
                      Clear Date Filter
                    </button>
                  </div>
                )}
              </div>

              {logsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-indigo-600">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                  <span className="font-extrabold text-[8px] tracking-widest uppercase">Fetching logs register...</span>
                </div>
              ) : (() => {
                const filteredPayments = historyLogs.filter((log: any) => {
                  // Show payment details only
                  if (log.type !== 'PAYMENT') return false;
                  
                  if (startDate || endDate) {
                    const logDateStr = new Date(log.created_at || Date.now()).toISOString().split('T')[0];
                    if (startDate && logDateStr < startDate) return false;
                    if (endDate && logDateStr > endDate) return false;
                  }
                  return true;
                });

                return (
                  <div className="space-y-2">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-between">
                      <span>Transacted payments history ({filteredPayments.length})</span>
                      {startDate || endDate ? (
                        <span className="text-indigo-600 lowercase normal-case font-bold">
                          Selected range: {startDate || '*'} to {endDate || '*'}
                        </span>
                      ) : (
                        <span className="text-slate-400 lowercase normal-case">All periods</span>
                      )}
                    </div>
                    
                    <div className="border border-slate-200 rounded overflow-hidden">
                      <table className="w-full text-left border-collapse text-[9px]">
                        <thead className="bg-slate-100 text-slate-500 font-black border-b text-[8px]">
                          <tr>
                            <th className="p-2 border-r">Date</th>
                            <th className="p-2 border-r font-mono">Amount Paid</th>
                            <th className="p-2">Transaction Memo Logs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredPayments.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-2 border-r text-slate-400 font-mono">
                                {new Date(log.created_at || Date.now()).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                              <td className="p-2 border-r font-mono text-emerald-600 font-extrabold uppercase">
                                +RM{parseFloat(log.amount || '0').toFixed(2)}
                              </td>
                              <td className="p-2 text-slate-600 font-bold capitalize select-text leading-relaxed">
                                {log.notes || 'Manual Ledger Payment'}
                              </td>
                            </tr>
                          ))}
                          {filteredPayments.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-12 text-center text-slate-300 font-extrabold uppercase italic tracking-widest text-[8.5px]">
                                No payment records within selected date range
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t shrink-0 text-right">
              <button
                type="button"
                onClick={() => setHistoryCustomer(null)}
                className="bg-slate-900 text-white px-5 py-2 rounded text-[9px] font-black uppercase hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
              >
                Close Logs Drawer
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
