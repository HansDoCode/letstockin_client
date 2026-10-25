import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import React from 'react';
import Skeleton from './Skeleton.jsx';
import { expandVariantGroups, generatedIdentifier, SIZE_OPTIONS } from './product-variants.js';

const blankVariant = () => ({ sizes: [], quantities: {}, color: '', sku: '', barcode: generatedIdentifier('BAR'), qrCode: generatedIdentifier('QR'), price: '', reorderPoint: '5' });

export default function ProductPanel({ onStockChanged }) {
  const [name, setName] = useState('');
  const [variants, setVariants] = useState([blankVariant()]);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState('all');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [statusBusy, setStatusBusy] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editJump, setEditJump] = useState(0);
  const [editVariants, setEditVariants] = useState([]);
  const [editReason, setEditReason] = useState('Product details and stock correction');
  const [editNotice, setEditNotice] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const editFormRef = useRef(null);

  async function loadCatalog() {
    setCatalogLoading(true);
    try { setCatalog(await api.products('', catalogStatus)); setCatalogError(''); }
    catch (error) { setCatalog([]); setCatalogError(error.message); }
    finally { setCatalogLoading(false); }
  }

  useEffect(() => { loadCatalog(); }, [catalogStatus]);
  useEffect(() => { if (editingProduct) editFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [editingProduct, editJump]);

  function updateVariant(index, key, value) { setVariants(rows => rows.map((row, i) => i === index ? { ...row, [key]: value } : row)); }
  function toggleSize(index, size, checked) { setVariants(rows => rows.map((row, i) => i !== index ? row : {
    ...row,
    sizes: checked ? [...row.sizes, size] : row.sizes.filter(value => value !== size),
    quantities: checked ? { ...row.quantities, [size]: '' } : Object.fromEntries(Object.entries(row.quantities).filter(([key]) => key !== size))
  })); }
  function updateSizeQuantity(index, size, value) { setVariants(rows => rows.map((row, i) => i === index ? { ...row, quantities: { ...row.quantities, [size]: value } } : row)); }

  function startEdit(product) {
    setEditingProduct(product);
    setEditJump(value => value + 1);
    setEditVariants((product.variants || []).map(variant => ({ id: variant.id, size: variant.size, color: variant.color, price: (Number(variant.priceCents) / 100).toFixed(2), quantity: String(variant.stock), expectedQuantity: Number(variant.stock) })));
    setEditReason('Product details and stock correction');
    setEditNotice('');
  }
  function cancelEdit() { setEditingProduct(null); setEditVariants([]); setEditNotice(''); }
  function updateEditVariant(id, key, value) { setEditVariants(rows => rows.map(row => String(row.id) === String(id) ? { ...row, [key]: value } : row)); }

  async function saveEdit(event) {
    event.preventDefault(); setEditSaving(true); setEditNotice('');
    if (!editReason.trim()) { setEditNotice('Enter a reason for the update.'); setEditSaving(false); return; }
    if (editVariants.some(row => !row.color.trim() || !String(row.price).trim() || !Number.isFinite(Number(row.price)) || Number(row.price) < 0 || !String(row.quantity).trim() || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 0)) {
      setEditNotice('Enter a color, valid price, and whole-number stock for every size.'); setEditSaving(false); return;
    }
    try {
      const productName = editingProduct.name;
      await api.updateProductVariants(editingProduct.id, { reason: editReason, variants: editVariants.map(row => ({ id: row.id, color: row.color, priceCents: Math.round(Number(row.price) * 100), quantity: Number(row.quantity), expectedQuantity: row.expectedQuantity })) });
      await loadCatalog(); onStockChanged?.(); cancelEdit(); setNotice(`${productName} updated.`);
    } catch (error) { setEditNotice(error.message); }
    finally { setEditSaving(false); }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setNotice('');
    if (variants.some(row => !row.sizes.length)) { setNotice('Choose at least one size for every variant group.'); setSaving(false); return; }
    if (variants.some(row => row.sizes.some(size => row.quantities[size] === '' || row.quantities[size] === undefined))) { setNotice('Enter opening pieces for every selected size.'); setSaving(false); return; }
    try {
      const productVariants = expandVariantGroups(variants);
      await api.createProduct({ name, variants: productVariants });
      setName(''); setVariants([blankVariant()]); setNotice('Product and stock saved.'); await loadCatalog(); onStockChanged?.();
    } catch (error) { setNotice(error.message); }
    finally { setSaving(false); }
  }

  async function toggleStatus(product) {
    setStatusBusy(product.id); setNotice('');
    try {
      const nextStatus = product.status === 'active' ? 'archived' : 'active';
      await api.updateProductStatus(product.id, nextStatus);
      setNotice(`${product.name} is now ${nextStatus}.`);
      await loadCatalog(); onStockChanged?.();
    } catch (error) { setNotice(error.message); }
    finally { setStatusBusy(null); }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;
    setDeleteBusy(product.id); setNotice('');
    try {
      await api.deleteProduct(product.id);
      setNotice(`${product.name} deleted.`);
      await loadCatalog(); onStockChanged?.();
    } catch (error) { setNotice(error.message); }
    finally { setDeleteBusy(null); }
  }

  return <>
    <section className="admin-heading"><h1>Add a product</h1></section>
    {editingProduct && <form ref={editFormRef} className="product-form product-edit-form" onSubmit={saveEdit}>
      <div className="variant-head"><div><h2>Update <span className="edit-product-name">{editingProduct.name}</span></h2></div><button type="button" className="secondary" onClick={cancelEdit} disabled={editSaving}>Cancel</button></div>
      <p className="edit-note">Set the absolute stock, color, and price for each size. Stock differences are recorded in the inventory audit trail.</p>
      <div className="edit-variants">{editVariants.map(variant => <fieldset key={variant.id}><legend>{variant.size}</legend><label className="field">Color<input required maxLength={50} value={variant.color} onChange={event => updateEditVariant(variant.id, 'color', event.target.value)} /></label><label className="field">Price (₱)<input required min="0" step="0.01" type="number" value={variant.price} onChange={event => updateEditVariant(variant.id, 'price', event.target.value)} /></label><label className="field">Pieces in stock<input required min="0" step="1" type="number" value={variant.quantity} onChange={event => updateEditVariant(variant.id, 'quantity', event.target.value)} /></label></fieldset>)}</div>
      <label className="field edit-reason">Reason for update<input required maxLength={500} value={editReason} onChange={event => setEditReason(event.target.value)} /></label>
      {editNotice && <p className="form-notice" role="alert">{editNotice}</p>}
      <div className="edit-actions"><button type="submit" className="checkout" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save product changes'}</button><button type="button" className="secondary" onClick={cancelEdit} disabled={editSaving}>Cancel</button></div>
    </form>}
    <form className="product-form" onSubmit={submit}>
      <label className="field product-name">Product name<input required maxLength={200} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Coastal Linen Shirt" /></label>
      <div className="variant-head"><h2>Variant groups & stock</h2><button type="button" className="secondary" onClick={() => setVariants(rows => [...rows, blankVariant()])}>+ Add group</button></div>
      <div className="variant-list">{variants.map((variant, index) => <fieldset key={index}>
        <legend>Variant group {index + 1}</legend>
        <div className="field size-field"><span>Sizes <small>(choose one or more)</small></span><div className="size-choices" role="group" aria-label={`Sizes for variant group ${index + 1}`}>{SIZE_OPTIONS.map(size => <label className="size-choice" key={size}><input type="checkbox" checked={variant.sizes.includes(size)} onChange={event => toggleSize(index, size, event.target.checked)} /><span>{size}</span></label>)}</div></div>
        {!!variant.sizes.length && <div className="size-stock" role="group" aria-label={`Opening pieces by size for variant group ${index + 1}`}>{variant.sizes.map(size => <label className="field" key={size}>{size} pieces<input required min="0" step="1" type="number" value={variant.quantities[size] ?? ''} onChange={event => updateSizeQuantity(index, size, event.target.value)} placeholder="0" /></label>)}</div>}
        <label className="field">Color<input required maxLength={50} value={variant.color} onChange={e => updateVariant(index, 'color', e.target.value)} placeholder="Navy" /></label>
        <label className="field">SKU<input required maxLength={100} value={variant.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} placeholder="DENIM-L" /></label>
        {variant.sizes.length > 1 ? <p className="size-stock-note">A unique barcode and QR code will be generated for each size.</p> : <><label className="field">Barcode (auto)<input maxLength={200} value={variant.barcode} onChange={e => updateVariant(index, 'barcode', e.target.value)} /></label><label className="field">QR code (auto)<input maxLength={200} value={variant.qrCode} onChange={e => updateVariant(index, 'qrCode', e.target.value)} /></label></>}
        <label className="field">Price (₱)<input required min="0" step="0.01" type="number" value={variant.price} onChange={e => updateVariant(index, 'price', e.target.value)} placeholder="49.00" /></label>
        <label className="field">Low-stock at<input required min="5" step="1" type="number" value={variant.reorderPoint} onChange={e => updateVariant(index, 'reorderPoint', e.target.value)} /></label>
        {variants.length > 1 && <button type="button" className="remove" onClick={() => setVariants(rows => rows.filter((_, i) => i !== index))}>Remove</button>}
      </fieldset>)}</div>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <button className="checkout form-submit" disabled={saving}>{saving ? 'Saving...' : 'Save product'}</button>
    </form>
    <section className="data-panel product-catalog" aria-labelledby="catalog-title">
      <div className="product-catalog-head"><h2 id="catalog-title">Product catalog</h2><label className="catalog-filter">Show<select value={catalogStatus} onChange={event => setCatalogStatus(event.target.value)}><option value="all">All products</option><option value="active">Active only</option><option value="archived">Archived only</option></select></label></div>
      {catalogError && <p className="form-notice catalog-error" role="alert">{catalogError}</p>}
      <div className="table-scroll" aria-busy={catalogLoading}>{catalogLoading && <span className="sr-only" role="status">Loading catalog…</span>}<table><thead><tr><th>Product</th><th>Sizes</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{catalogLoading ? Array.from({ length: 5 }, (_, index) => <tr key={`catalog-skeleton-${index}`} aria-hidden="true"><td><Skeleton className="skeleton-table-line wide" /><Skeleton className="skeleton-table-line subtext" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-pill" /></td><td><Skeleton className="skeleton-table-button" /></td></tr>) : catalog.length ? catalog.map(product => { const busy = statusBusy === product.id || deleteBusy === product.id || (editSaving && String(editingProduct?.id) === String(product.id)); return <tr key={product.id}><td><b>{product.name}</b><small className="table-subtext">{product.created_at ? new Date(product.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : ''}</small></td><td>{product.variants?.length || 0}</td><td>{product.stock}</td><td><span className={`role ${product.status}`}>{product.status}</span></td><td><button type="button" className="secondary status-toggle" disabled={busy} onClick={() => startEdit(product)}>Edit variants</button> <button type="button" className="secondary status-toggle" disabled={busy} onClick={() => toggleStatus(product)}>{statusBusy === product.id ? 'Saving...' : product.status === 'active' ? 'Archive' : 'Restore'}</button> <button type="button" className="remove status-toggle" disabled={busy} onClick={() => deleteProduct(product)}>{deleteBusy === product.id ? 'Deleting...' : 'Delete'}</button></td></tr>; }) : <tr><td colSpan={5} className="blank">No products in this view.</td></tr>}</tbody></table></div>
    </section>
  </>;
}
