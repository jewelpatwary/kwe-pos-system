import React, { useState, useEffect, useRef } from 'react';
import { Search, Printer, Plus, Minus, Trash, Settings, X, ArrowLeft, Barcode as BarcodeIcon, Tag, Sliders } from 'lucide-react';
import { Product } from '../store/cartStore';

interface PrintItem extends Product {
  printQuantity: number;
}

export default function Labels() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printList, setPrintList] = useState<PrintItem[]>([]);
  const [labelWidth, setLabelWidth] = useState(50); // mm
  const [labelHeight, setLabelHeight] = useState(25); // mm
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setProducts(data.data);
        }
      })
      .catch(console.error);
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchQuery))
  );

  const addToPrintList = (product: Product) => {
    setPrintList(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.map(p => p.id === product.id ? { ...p, printQuantity: p.printQuantity + 1 } : p);
      }
      return [...prev, { ...product, printQuantity: 1 }];
    });
  };

  const updateQuantity = (id: number, qty: number) => {
    if (qty < 1) return;
    setPrintList(prev => prev.map(p => p.id === id ? { ...p, printQuantity: qty } : p));
  };

  const removeFromPrintList = (id: number) => {
    setPrintList(prev => prev.filter(p => p.id !== id));
  };

  const handlePrint = () => {
    if (printList.length === 0) {
      alert("Please add products to the print list.");
      return;
    }
    window.print();
  };

  // Generate an array of labels to render based on print quantities
  const labelsToRender = printList.flatMap(item => Array(item.printQuantity).fill(item));

  return (
    <div className="p-0 h-full flex flex-col bg-white text-slate-800 font-sans text-[10px] uppercase transition-colors duration-300 screen-only">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .screen-only {
            display: none !important;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex !important;
            flex-wrap: wrap;
            gap: 2mm;
            padding: 0;
            margin: 0;
          }
          @page {
            margin: 0;
            size: auto;
          }
          .label-box {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Sub-Header / Filters */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex flex-wrap items-center gap-3 sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3 text-slate-900 font-black tracking-widest px-2">
            <BarcodeIcon className="w-4 h-4 text-indigo-600" />
            LABEL_GEN_ENGINE_v4.0
        </div>
        
        <div className="flex-1"></div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={() => setShowConfig(!showConfig)}
                className={`px-4 py-2 rounded transition flex items-center gap-2 border border-slate-200 font-black ${showConfig ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 hover:text-slate-900 '}`}
            >
                <Settings className="w-3.5 h-3.5" /> CALIBRATE
            </button>
            <button 
                onClick={handlePrint}
                disabled={printList.length === 0}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-indigo-500/20 font-black"
            >
                <Printer className="w-3.5 h-3.5" /> EXECUTE_PRINT_JOB
            </button>
        </div>
      </div>

      {showConfig && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex gap-8 items-center animate-in slide-in-from-top duration-200">
           <div className="flex items-center gap-3">
              <span className="text-[8px] text-slate-400 font-black tracking-widest">X_AXIS (MM)</span>
              <input 
                type="number" 
                value={labelWidth} 
                onChange={e => setLabelWidth(Number(e.target.value))}
                className="w-16 bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-black italic shadow-inner"
              />
           </div>
           <div className="flex items-center gap-3">
              <span className="text-[8px] text-slate-400 font-black tracking-widest">Y_AXIS (MM)</span>
              <input 
                type="number" 
                value={labelHeight} 
                onChange={e => setLabelHeight(Number(e.target.value))}
                className="w-16 bg-white border border-slate-200 text-slate-900 px-2 py-1 rounded outline-none focus:ring-1 focus:ring-indigo-500 font-black italic shadow-inner"
              />
           </div>
           <div className="text-[7px] text-slate-400 font-black italic uppercase tracking-widest">
              COMMON_PRESETS: THERMAL_50x25 // 60x40 // A4_GRID
           </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT PANEL: PRODUCT SEARCH */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="PROD_QUERY_INJECT..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 text-slate-900 rounded pl-9 pr-4 py-2 outline-none focus:ring-1 focus:ring-indigo-500 text-[9px] font-black italic shadow-inner"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
            {filteredProducts.map(product => (
              <button 
                key={product.id}
                onClick={() => {
                  if (!product.barcode) {
                    alert("Barcode metadata missing.");
                    return;
                  }
                  addToPrintList(product);
                }}
                className="w-full flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded hover:bg-slate-50 hover:border-indigo-600/30 transition-all text-left group"
              >
                <div className="min-w-0">
                  <div className="text-slate-900 font-black italic tracking-tighter truncate w-48">{product.name}</div>
                  <div className="text-[7px] text-slate-400 font-bold tracking-widest flex items-center gap-2 mt-1 px-0.5">
                      <Tag className="w-2.5 h-2.5" /> {product.barcode || 'NO_IDX'} • ${product.selling_price.toFixed(2)}
                  </div>
                </div>
                <div className="p-1 px-2 border border-indigo-600/20 text-indigo-600 opacity-20 group-hover:opacity-100 transition-opacity rounded bg-indigo-50 text-[8px] font-black italic">
                    ADD_VEC
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* MIDDLE PANEL: PRINT LIST */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50/30">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center z-10 sticky top-0 shadow-sm transition-colors">
            <h2 className="font-black text-slate-900 italic tracking-widest text-[10px]">BATCH_QUEUE</h2>
            <span className="bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded tracking-tighter shadow-sm shadow-indigo-500/20">
              {labelsToRender.length} UNITS_IN_STREAM
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {printList.length === 0 ? (
              <div className="py-20 text-center text-slate-300 flex flex-col items-center select-none grayscale opacity-50">
                <Printer className="w-10 h-10 mb-4 opacity-10" />
                <p className="font-black tracking-[0.3em]">QUEUE_EMPTY</p>
                <p className="text-[7px] font-black italic mt-2 opacity-30 tracking-widest uppercase">AWAITING_PRODUCT_INJECTION</p>
              </div>
            ) : (
              printList.map(item => (
                <div key={item.id} className="bg-white border border-slate-200 p-3 rounded group shadow-sm">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-black text-slate-900 italic tracking-tighter truncate w-full">{item.name}</div>
                      <div className="text-[7px] text-slate-400 font-black tracking-widest mt-0.5">{item.barcode}</div>
                    </div>
                    <button onClick={() => removeFromPrintList(item.id)} className="text-slate-300 hover:text-red-600 transition-colors ml-2">
                      <Trash className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-3 bg-slate-50 p-2 border border-slate-100 rounded">
                    <span className="text-[7px] text-slate-400 font-black tracking-widest italic uppercase underline decoration-indigo-200 underline-offset-4">CMD_ITERATE</span>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => updateQuantity(item.id, item.printQuantity - 1)}
                        className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 hover:text-slate-900 transition shadow-sm"
                      ><Minus size={10} /></button>
                      <input 
                        type="number"
                        value={item.printQuantity}
                        onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                        className="w-8 text-center text-[10px] font-black bg-transparent border-none focus:outline-none text-indigo-600 italic"
                      />
                      <button 
                        onClick={() => updateQuantity(item.id, item.printQuantity + 1)}
                        className="w-5 h-5 flex items-center justify-center bg-white border border-slate-200 rounded text-slate-400 hover:text-slate-900 transition shadow-sm"
                      ><Plus size={10} /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT PANEL: LIVE PREVIEW */}
        <div className="w-1/3 bg-slate-100 flex flex-col h-full border-l border-slate-200">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center sticky top-0 shadow-md z-20">
            <h2 className="font-black text-slate-400 tracking-[0.3em] text-[8px] italic">LIVE_BUFFER_PREVIEW</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center gap-6 custom-scrollbar">
             {labelsToRender.slice(0, 15).map((label, idx) => (
                <div 
                  key={idx} 
                  className="bg-white shadow-[0_0_20px_rgba(0,0,0,0.15)] flex justify-center items-center overflow-hidden border border-slate-300 relative"
                  style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm` }}
                >
                  <div className="flex flex-col items-center justify-center w-full h-full p-2">
                    <div className="text-[10px] font-black text-black uppercase leading-[1] truncate w-full text-center mb-0.5 tracking-tighter" style={{ fontSize: '7px' }}>
                      {label.name}
                    </div>
                    <img 
                      src={`/api/barcode/${label.barcode}`} 
                      alt={`barcode ${label.barcode}`} 
                      className="max-h-[60%] object-contain"
                    />
                    <div className="text-[11px] font-black text-black mt-0.5 tracking-tighter leading-none" style={{ fontSize: '8px' }}>
                      ${label.selling_price.toFixed(2)}
                    </div>
                  </div>
                </div>
             ))}
             {labelsToRender.length > 15 && (
               <div className="text-slate-400 text-[8px] font-black tracking-widest animate-pulse border-t border-slate-200 pt-4 uppercase italic">
                 + {labelsToRender.length - 15} BUFFERED_NODES_PENDING...
               </div>
             )}
             {labelsToRender.length === 0 && (
               <div className="mt-20 flex flex-col items-center gap-4 text-slate-300 grayscale">
                  <Sliders className="w-10 h-10 opacity-10" />
                  <span className="font-black tracking-[0.4em] italic text-[8px] uppercase">AWAITING_VISUAL_COMPILE</span>
               </div>
             )}
          </div>
        </div>

      </div>

      <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-[8px] font-black tracking-widest text-[#475569] transition-colors">
         <div>ENGINE_STATUS: IDLE // BUFFER_SIZE: {labelsToRender.length} UNITS</div>
         <div>SYSTEM_READY_FOR_IO</div>
      </div>

      {/* --- HIDDEN PRINT AREA --- */}
      <div id="print-area" className="hidden print:flex relative bg-white items-start content-start">
         {labelsToRender.map((label, idx) => (
            <div 
              key={`print-${idx}`} 
              className="label-box bg-white flex justify-center items-center overflow-hidden box-border"
              style={{ width: `${labelWidth}mm`, height: `${labelHeight}mm` }}
            >
              <div className="flex flex-col items-center justify-center w-full h-full p-1 box-border">
                <div className="font-bold text-black uppercase text-center w-full leading-none" style={{ fontSize: '10px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {label.name}
                </div>
                <img 
                  src={`/api/barcode/${label.barcode}`} 
                  alt={`barcode ${label.barcode}`} 
                  style={{ display: 'block', maxHeight: '50%', objectFit: 'contain' }}
                />
                <div className="font-bold text-black text-center" style={{ fontSize: '11px', marginTop: '2px', lineHeight: '1' }}>
                  Price: ${label.selling_price.toFixed(2)}
                </div>
              </div>
            </div>
         ))}
      </div>
    </div>
  );
}
