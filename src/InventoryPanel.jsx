import { useEffect, useState } from 'react';
import { api } from './api.js';
import React from 'react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import Skeleton from './Skeleton.jsx';
import { code128Bars } from './barcode.js';
import { groupInventoryRows } from './inventory-products.js';

const productPhoto = name => name?.trim().toLowerCase().startsWith('augyew') ? `${import.meta.env.BASE_URL}images/augyew-graphic-tee-vintage-pos.png` : null;
const productImageStorageKey = 'letstockin:product-images';

export default function InventoryPanel({ role, initialQuery = '', onStockChanged }) {
  const [query, setQuery] = useState(initialQuery); const [rows, setRows] = useState([]); const [selectedProductId, setSelectedProductId] = useState(null); const [adjustment, setAdjustment] = useState(null); const [barcodeRow, setBarcodeRow] = useState(null); const [barcodeBusy, setBarcodeBusy] = useState(null); const [delta, setDelta] = useState(''); const [reason, setReason] = useState(''); const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const [productImages] = useState(() => { try { const saved = JSON.parse(window.localStorage.getItem(productImageStorageKey) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { return {}; } });
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
  return <><section className="inventory-panel" aria-labelledby="inventory-title"><div className="inventory-top"><div><h1 id="inventory-title">Inventory</h1></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search inventory…" aria-label="Search inventory" /></div>{notice && <p className="inventory-notice">{notice}</p>}{error && <p className="inventory-notice" role="alert">{error}</p>}<div className="inventory-table-wrap" aria-busy={loading}>{loading && <span className="sr-only" role="status">Loading inventory…</span>}<table><thead><tr><th>Product</th><th>Variants</th><th>Available</th><th>Status</th></tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={`inventory-skeleton-${index}`} aria-hidden="true"><td><Skeleton className="skeleton-table-line wide" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-pill" /></td></tr>) : products.map(product => { const total = product.variants.reduce((sum, row) => sum + Number(row.quantity || 0), 0); const low = product.variants.some(row => Number(row.quantity) <= Number(row.reorderPoint)); return <tr key={product.product_id}><td className="inventory-product-cell"><button type="button" className="inventory-product" onClick={() => setSelectedProductId(product.product_id)}><b>{product.name}</b></button></td><td>{product.variants.length}</td><td>{total}</td><td><span className={low ? 'stock-pill low' : 'stock-pill'}>{low ? 'Low stock' : 'In stock'}</span></td></tr>; })}</tbody></table>{!products.length && !loading && <p className="inventory-empty">{error ? 'Inventory is unavailable.' : 'No inventory matched that search.'}</p>}</div></section>{selectedProduct && <InventoryProductDialog product={selectedProduct} image={productImages[selectedProduct.product_id] || productPhoto(selectedProduct.name)} role={role} barcodeBusy={barcodeBusy} adjustment={adjustment} delta={delta} reason={reason} notice={notice} onBarcode={showBarcode} onAdjust={row => { setAdjustment(row); setDelta(''); setReason(''); setNotice(''); }} onVariantChange={row => setAdjustment(row)} onDeltaChange={setDelta} onReasonChange={setReason} onSubmit={adjust} onCancel={() => { setAdjustment(null); setDelta(''); setReason(''); setNotice(''); }} onClose={() => { setSelectedProductId(null); setAdjustment(null); setDelta(''); setReason(''); setNotice(''); }} />}{barcodeRow && <BarcodeDialog row={barcodeRow} onClose={() => setBarcodeRow(null)} />}</>;
}

function InventoryProductDialog({ product, image, role, barcodeBusy, adjustment, delta, reason, notice, onBarcode, onAdjust, onVariantChange, onDeltaChange, onReasonChange, onSubmit, onCancel, onClose }) {
  const closeRef = useRef(null);
  const [selectedId, setSelectedId] = useState(product.variants[0]?.variant_id);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const close = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  const selected = product.variants.find(row => String(row.variant_id) === String(selectedId)) || product.variants[0];
  const editing = Boolean(adjustment && product.variants.some(row => String(row.variant_id) === String(adjustment.variant_id)));
  return createPortal(<div className="product-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="product-detail-dialog inventory-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-product-title"><div className="camera-head"><div><h2 id="inventory-product-title">{product.name}</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div>{image && <img className="product-detail-image" src={image} alt={`${product.name} product`} />}<p className="inventory-note">Choose a specific size and color to see its available stock and actions.</p><div className="detail-variants inventory-variant-choices" aria-label="Product variants">{product.variants.map(row => { const selectedVariant = String(row.variant_id) === String(selected.variant_id); const low = Number(row.quantity) <= Number(row.reorderPoint); return <button type="button" key={row.variant_id} className={`${selectedVariant ? 'selected' : ''}${low ? ' low' : ''}`} aria-pressed={selectedVariant} onClick={() => { setSelectedId(row.variant_id); if (editing && String(row.variant_id) !== String(selected.variant.variant_id)) onVariantChange(row); }}><b>{row.size}</b><span>{row.color}</span><small>{row.quantity} available</small></button>; })}</div><dl><div><dt>SKU</dt><dd>{selected.sku}</dd></div></dl>{notice && <p className="form-notice inventory-detail-notice" role="status">{notice}</p>}<div className="inventory-detail-actions"><button type="button" className="adjust-button barcode-button" onClick={() => onBarcode(selected)} disabled={barcodeBusy === selected.variant_id || (!selected.barcode && role !== 'admin')}>{barcodeBusy === selected.variant_id ? 'Generating…' : selected.barcode ? 'Barcode' : role === 'admin' ? 'Generate barcode' : 'No barcode'}</button>{role === 'admin' && !editing && <button type="button" className="adjust-button add-stock-button" onClick={() => onAdjust(selected)}>Add stock</button>}</div>{editing && <form className="adjust-form inventory-detail-adjust-form" onSubmit={onSubmit}><div><b>Add stock for {selected.sku}</b><small>Use a positive number to add stock or a negative number to remove it.</small></div><label className="field">Quantity change<input required autoFocus type="number" step="1" value={delta} onChange={event => onDeltaChange(event.target.value)} placeholder="e.g. 6 or -1" /></label><label className="field">Reason<input required maxLength={500} value={reason} onChange={event => onReasonChange(event.target.value)} placeholder="Stock count correction" /></label><div className="inventory-detail-adjust-actions"><button className="checkout">Record stock change</button><button className="secondary" type="button" onClick={onCancel}>Cancel</button></div></form>}</section></div>, document.body);
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
  return createPortal(<div className="barcode-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="barcode-dialog" role="dialog" aria-modal="true" aria-labelledby="barcode-title"><div className="camera-head"><div><h2 id="barcode-title">{row.name}</h2></div><button type="button" ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><p className="barcode-item">{row.size} / {row.color} · SKU {row.sku}</p>{barcodeError ? <p className="form-notice" role="alert">{barcodeError}</p> : <div className="barcode-art"><svg className="barcode-svg" width={svgWidth} height="88" viewBox={`0 0 ${svgWidth} 88`} role="img" aria-label={`Barcode ${row.barcode}`}><rect width={svgWidth} height="88" fill="#fff" />{bars.map((bar, index) => { const left = x; x += bar.width * moduleWidth; return bar.black ? <rect key={index} x={left} y="7" width={bar.width * moduleWidth} height="53" fill="#102747" /> : null; })}<text x={svgWidth / 2} y="77" textAnchor="middle" fill="#102747" fontSize="12" fontFamily="monospace">{row.barcode}</text></svg></div>}<div className="barcode-actions"><button type="button" className="checkout" onClick={() => window.print()} disabled={Boolean(barcodeError)}>Print barcode</button><button type="button" className="secondary" onClick={onClose}>Done</button></div></section></div>, document.body);
}
