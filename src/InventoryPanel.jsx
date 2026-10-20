import { useEffect, useState } from 'react';
import { api } from './api.js';
import React from 'react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { code128Bars } from './barcode.js';
import { groupInventoryRows } from './inventory-products.js';

export default function InventoryPanel({ role, initialQuery = '', onStockChanged }) {
  const [query, setQuery] = useState(initialQuery); const [rows, setRows] = useState([]); const [selectedProductId, setSelectedProductId] = useState(null); const [adjustment, setAdjustment] = useState(null); const [barcodeRow, setBarcodeRow] = useState(null); const [barcodeBusy, setBarcodeBusy] = useState(null); const [delta, setDelta] = useState(''); const [reason, setReason] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  const load = async () => { setLoading(true); try { setRows(await api.inventory(query)); setError(''); } catch (cause) { setRows([]); setError(cause.message || 'Inventory could not be loaded.'); } finally { setLoading(false); } };
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [query]);
  async function adjust(event) { event.preventDefault(); if (!adjustment?.variant_id) return; try { await api.adjustInventory(adjustment.variant_id, { quantityDelta: Number(delta), reason }); setAdjustment(null); setDelta(''); setReason(''); setNotice('Stock adjustment recorded in the inventory audit trail.'); await load(); onStockChanged?.(); } catch (error) { setNotice(error.message); } }
  async function showBarcode(row) {
    if (row.barcode) return setBarcodeRow(row);
    if (role !== 'admin' || barcodeBusy) return;
    setBarcodeBusy(row.variant_id); setNotice('');
    try {
      const result = await api.generateBarcode(row.variant_id);
      const updated = { ...row, barcode: result.barcode };
      setRows(current => current.map(item => item.variant_id === row.variant_id ? updated : item));
      setBarcodeRow(updated);
      setNotice(`Barcode generated for ${row.name}, ${row.size} / ${row.color}.`);
    } catch (cause) { setNotice(cause.message || 'Barcode could not be generated.'); }
    finally { setBarcodeBusy(null); }
  }
  const products = groupInventoryRows(rows);
  const selectedProduct = products.find(product => String(product.product_id) === String(selectedProductId));
  return <><section className="inventory-panel" aria-labelledby="inventory-title"><div className="inventory-top"><div><h1 id="inventory-title">Inventory</h1></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search inventory…" aria-label="Search inventory" /></div>{notice && <p className="inventory-notice">{notice}</p>}{error && <p className="inventory-notice" role="alert">{error}</p>}<div className="inventory-table-wrap"><table><thead><tr><th>Product</th><th>Variants</th><th>Available</th><th>Status</th></tr></thead><tbody>{products.map(product => { const total = product.variants.reduce((sum, row) => sum + Number(row.quantity || 0), 0); const low = product.variants.some(row => Number(row.quantity) <= Number(row.reorderPoint)); return <tr key={product.product_id}><td><button type="button" className="inventory-product" onClick={() => setSelectedProductId(product.product_id)}><b>{product.name}</b></button></td><td>{product.variants.length}</td><td>{total}</td><td><span className={low ? 'stock-pill low' : 'stock-pill'}>{low ? 'Low stock' : 'In stock'}</span></td></tr>; })}</tbody></table>{!products.length && <p className="inventory-empty">{loading ? 'Loading inventory…' : error ? 'Inventory is unavailable.' : 'No inventory matched that search.'}</p>}</div>{adjustment && <form className="adjust-form" onSubmit={adjust}><div><b>Adjust {adjustment.name}, {adjustment.size} / {adjustment.color}</b><small>Enter a positive number to receive stock or a negative number to remove it.</small></div><label className="field">Quantity change<input required autoFocus type="number" step="1" value={delta} onChange={e => setDelta(e.target.value)} placeholder="e.g. 6 or -1" /></label><label className="field">Reason<input required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="Stock count correction" /></label><button className="checkout">Record adjustment</button><button className="secondary" type="button" onClick={() => setAdjustment(null)}>Cancel</button></form>}</section>{selectedProduct && <InventoryProductDialog product={selectedProduct} role={role} barcodeBusy={barcodeBusy} onBarcode={showBarcode} onAdjust={row => { setSelectedProductId(null); setAdjustment(row); setNotice(''); }} onClose={() => setSelectedProductId(null)} />}{barcodeRow && <BarcodeDialog row={barcodeRow} onClose={() => setBarcodeRow(null)} />}</>;
}

function InventoryProductDialog({ product, role, barcodeBusy, onBarcode, onAdjust, onClose }) {
  const closeRef = useRef(null);
  const [selectedId, setSelectedId] = useState(product.variants[0]?.variant_id);
  useEffect(() => {
    closeRef.current?.focus();
    const close = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  const selected = product.variants.find(row => String(row.variant_id) === String(selectedId)) || product.variants[0];
  const low = Number(selected.quantity) <= Number(selected.reorderPoint);
  return createPortal(<div className="product-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-product-title"><div className="camera-head"><div><h2 id="inventory-product-title">{product.name}</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><p className="inventory-note">Choose a specific size and color to see its available stock and actions.</p><div className="detail-variants inventory-variant-choices" aria-label="Product variants">{product.variants.map(row => <button type="button" key={row.variant_id} className={String(row.variant_id) === String(selected.variant_id) ? 'selected' : ''} aria-pressed={String(row.variant_id) === String(selected.variant_id)} onClick={() => setSelectedId(row.variant_id)}><b>{row.size} · {row.color}</b><small>{row.quantity} available</small></button>)}</div><div className="detail-summary"><span className={low ? 'stock-pill low' : 'stock-pill'}>{selected.quantity} available</span><b>{selected.size} / {selected.color}</b></div><dl><div><dt>Size</dt><dd>{selected.size}</dd></div><div><dt>Color</dt><dd>{selected.color}</dd></div><div><dt>SKU</dt><dd>{selected.sku}</dd></div><div><dt>Barcode</dt><dd>{selected.barcode || '—'}</dd></div><div><dt>QR code</dt><dd>{selected.qrCode || '—'}</dd></div><div><dt>Low-stock point</dt><dd>{selected.reorderPoint}</dd></div></dl><div className="inventory-detail-actions"><button type="button" className="adjust-button" onClick={() => onBarcode(selected)} disabled={barcodeBusy === selected.variant_id || (!selected.barcode && role !== 'admin')}>{barcodeBusy === selected.variant_id ? 'Generating…' : selected.barcode ? 'Barcode' : role === 'admin' ? 'Generate barcode' : 'No barcode'}</button>{role === 'admin' && <button type="button" className="adjust-button" onClick={() => onAdjust(selected)}>Adjust stock</button>}</div></section></div>, document.body);
}

function BarcodeDialog({ row, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const close = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  let bars = [];
  let barcodeError = '';
  try { bars = code128Bars(row.barcode); } catch (error) { barcodeError = error.message; }
  const moduleWidth = 2; const quietZone = 14; const barcodeWidth = bars.reduce((total, bar) => total + bar.width, 0) * moduleWidth; const svgWidth = barcodeWidth + quietZone * 2; let x = quietZone;
  return createPortal(<div className="barcode-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="barcode-dialog" role="dialog" aria-modal="true" aria-labelledby="barcode-title"><div className="camera-head"><div><h2 id="barcode-title">{row.name}</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><p className="barcode-item">{row.size} / {row.color} · SKU {row.sku}</p>{barcodeError ? <p className="form-notice" role="alert">{barcodeError}</p> : <div className="barcode-art"><svg className="barcode-svg" width={svgWidth} height="88" viewBox={`0 0 ${svgWidth} 88`} role="img" aria-label={`Barcode ${row.barcode}`}><rect width={svgWidth} height="88" fill="#fff" />{bars.map((bar, index) => { const left = x; x += bar.width * moduleWidth; return bar.black ? <rect key={index} x={left} y="7" width={bar.width * moduleWidth} height="53" fill="#102747" /> : null; })}<text x={svgWidth / 2} y="77" textAnchor="middle" fill="#102747" fontSize="12" fontFamily="monospace">{row.barcode}</text></svg></div>}<code className="barcode-value">{row.barcode}</code><div className="barcode-actions"><button className="checkout" onClick={() => window.print()} disabled={Boolean(barcodeError)}>Print barcode</button><button className="secondary" onClick={onClose}>Done</button></div></section></div>, document.body);
}
