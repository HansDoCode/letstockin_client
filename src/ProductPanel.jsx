import { useEffect, useState } from 'react';
import { api } from './api.js';
import React from 'react';

const blankVariant = () => ({ size: '', sku: '', barcode: '', qrCode: '', price: '', quantity: '', reorderPoint: '3' });

export default function ProductPanel() {
  const [name, setName] = useState('');
  const [variants, setVariants] = useState([blankVariant()]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('all');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [statusBusy, setStatusBusy] = useState(null);

  async function loadCatalog() {
    setCatalogLoading(true);
    try { setCatalog(await api.products('', catalogStatus)); setCatalogError(''); }
    catch (error) { setCatalog([]); setCatalogError(error.message); }
    finally { setCatalogLoading(false); }
  }

  useEffect(() => { loadCatalog(); }, [catalogStatus]);

  function updateVariant(index, key, value) { setVariants(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setNotice('');
    try {
      await api.createProduct({ name, variants: variants.map(row => ({ ...row, priceCents: Math.round(Number(row.price) * 100), quantity: Number(row.quantity), reorderPoint: Number(row.reorderPoint) })) });
      setName(''); setVariants([blankVariant()]); setNotice('Product and stock saved.'); await loadCatalog();
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(product) {
    setStatusBusy(product.id); setNotice('');
    try {
      const nextStatus = product.status === 'active' ? 'archived' : 'active';
      await api.updateProductStatus(product.id, nextStatus);
      setNotice(`${product.name} is now ${nextStatus}.`);
      await loadCatalog();
    } catch (error) { setNotice(error.message); }
    finally { setStatusBusy(null); }
  }

  return <>
    <section className="admin-heading"><p className="eyebrow">Catalog management</p><h1>Add a product</h1><p>Create each clothing size as a variant. Barcode and QR codes resolve to the exact size during scanning.</p></section>
    <form className="product-form" onSubmit={submit}>
      <label className="field product-name">Product name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Coastal Linen Shirt" /></label>
      <div className="variant-head"><h2>Variants & stock</h2><button type="button" className="secondary" onClick={() => setVariants(rows => [...rows, blankVariant()])}>+ Add size</button></div>
      <div className="variant-list">{variants.map((variant, index) => <fieldset key={index}>
        <legend>Size variant {index + 1}</legend>
        <label className="field">Size<input required maxLength={50} value={variant.size} onChange={e => updateVariant(index, 'size', e.target.value)} placeholder="M" /></label>
        <label className="field">SKU<input required maxLength={100} value={variant.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} placeholder="CLS-M" /></label>
        <label className="field">Barcode<input maxLength={200} value={variant.barcode} onChange={e => updateVariant(index, 'barcode', e.target.value)} placeholder="100002" /></label>
        <label className="field">QR code<input maxLength={200} value={variant.qrCode} onChange={e => updateVariant(index, 'qrCode', e.target.value)} placeholder="QR-CLS-M" /></label>
        <label className="field">Price ($)<input required min="0" step="0.01" type="number" value={variant.price} onChange={e => updateVariant(index, 'price', e.target.value)} placeholder="49.00" /></label>
        <label className="field">Opening stock<input required min="0" step="1" type="number" value={variant.quantity} onChange={e => updateVariant(index, 'quantity', e.target.value)} placeholder="0" /></label>
        <label className="field">Low-stock at<input required min="0" step="1" type="number" value={variant.reorderPoint} onChange={e => updateVariant(index, 'reorderPoint', e.target.value)} /></label>
        {variants.length > 1 && <button type="button" className="remove" onClick={() => setVariants(rows => rows.filter((_, i) => i !== index))}>Remove</button>}
      </fieldset>)}</div>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <button className="checkout form-submit" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
    </form>
    <section className="data-panel product-catalog" aria-labelledby="catalog-title">
      <div className="product-catalog-head"><h2 id="catalog-title">Product catalog</h2><label className="catalog-filter">Show<select value={catalogStatus} onChange={event => setCatalogStatus(event.target.value)}><option value="all">All products</option><option value="active">Active only</option><option value="archived">Archived only</option></select></label></div>
      {catalogError && <p className="form-notice catalog-error" role="alert">{catalogError}</p>}
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>Sizes</th><th>Stock</th><th>Status</th><th /></tr></thead><tbody>{catalog.length ? catalog.map(product => <tr key={product.id}><td><b>{product.name}</b><small className="table-subtext">{product.created_at ? new Date(product.created_at).toLocaleDateString() : ''}</small></td><td>{product.variants?.length || 0}</td><td>{product.stock}</td><td><span className={`role ${product.status}`}>{product.status}</span></td><td><button type="button" className="secondary status-toggle" disabled={statusBusy === product.id} onClick={() => toggleStatus(product)}>{statusBusy === product.id ? 'Saving...' : product.status === 'active' ? 'Archive' : 'Restore'}</button></td></tr>) : <tr><td colSpan={5} className="blank">{catalogLoading ? 'Loading catalog...' : 'No products in this view.'}</td></tr>}</tbody></table></div>
    </section>
  </>;
}
