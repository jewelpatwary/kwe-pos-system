import React, { useState } from 'react';
import { Search, X, Tag } from 'lucide-react';

interface PriceCheckModalProps {
  onClose: () => void;
}

export default function PriceCheckModal({ onClose }: PriceCheckModalProps) {
  const [barcode, setBarcode] = useState('');
  const [product, setProduct] = useState<any>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStatus(null);
    setProduct(null);
    
    if (!barcode.trim()) return;

    try {
      const res = await fetch(`/api/products/price-check/${barcode.trim()}`);
      const data = await res.json();
      
      if (data.success) {
        setProduct(data.data);
      } else {
        setErrorStatus(data.message || 'Product not found');
      }
    } catch (err) {
      setErrorStatus('Error fetching price');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-emerald-50 rounded-t-2xl">
          <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-800">
            <Tag className="w-5 h-5" /> Price Check
          </h2>
          <button onClick={onClose} className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-full transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                value={barcode}
                onChange={e => setBarcode(e.target.value)}
                placeholder="Scan barcode or type to check..." 
                className="w-full pl-10 pr-4 py-3 border-2 border-emerald-200 rounded-xl focus:outline-none focus:border-emerald-500 bg-white"
                autoFocus
              />
            </div>
            <button type="submit" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-sm transition">
              Check
            </button>
          </form>

          {errorStatus && (
            <div className="text-red-500 bg-red-50 p-4 rounded-xl font-medium text-center">
              {errorStatus}
            </div>
          )}

          {product && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center space-y-4 shadow-inner">
              <div className="text-emerald-600 font-bold tracking-widest text-xs uppercase">{product.category}</div>
              <h3 className="text-2xl font-black text-gray-900">{product.name}</h3>
              <div className="text-5xl font-black text-emerald-600 py-2">
                ${product.selling_price.toFixed(2)}
              </div>
              <div className="flex justify-center items-center gap-2 text-sm font-medium">
                <span className={product.stock_quantity > 0 ? "text-emerald-600" : "text-red-500"}>
                  {product.stock_quantity > 0 ? `In Stock: ${product.stock_quantity}` : 'Out of Stock'}
                </span>
              </div>
            </div>
          )}

          <div className="text-center text-xs text-gray-400 font-medium">
            Scan another item or press escape to close
          </div>
        </div>
      </div>
    </div>
  );
}
