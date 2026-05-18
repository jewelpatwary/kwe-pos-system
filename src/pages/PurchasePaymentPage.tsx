import React, { useState, useEffect } from 'react';
import { Search, Filter, DollarSign, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';

export default function PurchasePaymentPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [invoiceNumberFilter, setInvoiceNumberFilter] = useState('');
  const { token } = useAuthStore();
  const { currency } = useTheme();

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/admin/purchase-invoices', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data.filter((inv: any) => inv.due_amount > 0));
      }
    } catch (err) { console.error(err); }
  };

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.supplier_name.toLowerCase().includes(search.toLowerCase()) || 
                          inv.invoice_number.toLowerCase().includes(search.toLowerCase());
    const matchesVendor = vendorFilter === '' || inv.supplier_name.toLowerCase().includes(vendorFilter.toLowerCase());
    const matchesInvoiceNumber = invoiceNumberFilter === '' || inv.invoice_number.toLowerCase().includes(invoiceNumberFilter.toLowerCase());
    return matchesSearch && matchesVendor && matchesInvoiceNumber;
  });

  return (
    <div className="p-4 bg-slate-50 h-full">
      <h1 className="text-xl font-black mb-4">PURCHASE_INVOICE_PAYMENT</h1>
      
      <div className="bg-white p-4 border border-slate-200 mb-4 rounded shadow-sm grid grid-cols-3 gap-4">
        <input className="border p-2 rounded" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Filter by Vendor Name" value={vendorFilter} onChange={e => setVendorFilter(e.target.value)} />
        <input className="border p-2 rounded" placeholder="Filter by Invoice Number" value={invoiceNumberFilter} onChange={e => setInvoiceNumberFilter(e.target.value)} />
      </div>

      <div className="flex-1 overflow-auto border border-slate-200 bg-white rounded shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="py-2 px-4">Invoice #</th>
              <th className="py-2 px-4">Vendor</th>
              <th className="py-2 px-4">Due Amount</th>
              <th className="py-2 px-4">Payment</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => (
              <tr key={inv.id} className="border-b">
                <td className="py-2 px-4">{inv.invoice_number}</td>
                <td className="py-2 px-4">{inv.supplier_name}</td>
                <td className="py-2 px-4">{currency.symbol}{inv.due_amount.toFixed(2)}</td>
                <td className="py-2 px-4"><button className="bg-emerald-600 text-white px-3 py-1 rounded">PAY</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
