import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import React from 'react';
import Skeleton from './Skeleton.jsx';
import { expandVariantGroups, generatedIdentifier, groupVariantsByColor, SIZE_OPTIONS } from './product-variants.js';
import { colorImageKey, deleteProductImages, loadProductImages, readProductImage, saveProductColorImages } from './product-images.js';
import { deleteConfirmationToken, matchesDeleteConfirmation } from './delete-confirmation.js';

const blankVariant = () => ({ sizes: [], quantities: {}, color: '', sku: '', barcode: generatedIdentifier('BAR'), qrCode: generatedIdentifier('QR'), price: '', reorderPoint: '5', image: '' });
const blankEditGroup = () => ({ color: '', sku: '', variants: [], image: '' });

function readImage(event, onImage, onError) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  if (!file.type.startsWith('image/')) return onError('Choose an image file.');
  if (file.size > 2_000_000) return onError('Use an image smaller than 2 MB.');
  readProductImage(file).then(onImage).catch(error => onError(error.message));
}

function ColorImagePicker({ image, label, onChange }) {
  return <div className="color-image-field"><label className="color-image-picker"><span>{image ? 'Change image' : '+ Add image'}</span><input type="file" accept="image/*" aria-label={`${image ? 'Change' : 'Add'} image for ${label}`} onChange={onChange} /></label>{image && <img className="color-image-preview" src={image} alt={`${label} product`} />}</div>;
}

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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editJump, setEditJump] = useState(0);
  const [editGroups, setEditGroups] = useState([]);
  const [editReason, setEditReason] = useState('');
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
    const images = loadProductImages();
    setEditGroups(groupVariantsByColor(product.variants || []).map(group => ({
      color: group.color,
      sku: '',
      image: images[colorImageKey(product.id, group.color)] || '',
      variants: group.variants.map(variant => ({ id: variant.id, size: variant.size, price: (Number(variant.priceCents) / 100).toFixed(2), quantity: String(variant.stock), expectedQuantity: Number(variant.stock) }))
    })));
    setEditReason('');
    setEditNotice('');
  }
  function cancelEdit() { setEditingProduct(null); setEditGroups([]); setEditNotice(''); }
  function updateEditGroup(index, key, value) { setEditGroups(groups => groups.map((group, i) => i === index ? { ...group, [key]: value } : group)); }
  function toggleEditSize(index, size, checked) {
    setEditGroups(groups => groups.map((group, i) => {
      if (i !== index) return group;
      if (!checked) return { ...group, variants: group.variants.filter(variant => variant.size !== size) };
      if (group.variants.some(variant => variant.size === size)) return group;
      return { ...group, variants: [...group.variants, { id: null, size, price: '', quantity: '', barcode: generatedIdentifier('BAR'), qrCode: generatedIdentifier('QR') }] };
    }));
  }
  function updateEditVariant(groupIndex, size, key, value) {
    setEditGroups(groups => groups.map((group, i) => i === groupIndex ? {
      ...group,
      variants: group.variants.map(variant => variant.size === size ? { ...variant, [key]: value } : variant)
    } : group));
  }
  function updateEditImage(index, event) { readImage(event, image => updateEditGroup(index, 'image', image), setEditNotice); }
  function updateVariantImage(index, event) { readImage(event, image => updateVariant(index, 'image', image), setNotice); }

  async function saveEdit(event) {
    event.preventDefault(); setEditSaving(true); setEditNotice('');
    if (!editReason.trim()) { setEditNotice('Enter a reason for the update.'); setEditSaving(false); return; }
    if (editGroups.some(group => !group.color.trim() || !group.variants.length || group.variants.some(row => !String(row.price).trim() || !Number.isFinite(Number(row.price)) || Number(row.price) < 0 || !String(row.quantity).trim() || !Number.isSafeInteger(Number(row.quantity)) || Number(row.quantity) < 0 || (!row.id && !group.sku.trim())))) {
      setEditNotice('Enter a color, size, valid price, and whole-number stock for every group.'); setEditSaving(false); return;
    }
    try {
      const productName = editingProduct.name;
      const payloadVariants = editGroups.flatMap(group => group.variants.map(row => ({
        id: row.id,
        ...(row.id ? {} : {
          size: row.size,
          sku: group.variants.length > 1 ? `${group.sku}-${row.size.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()}` : group.sku,
          barcode: row.barcode,
          qrCode: row.qrCode
        }),
        color: group.color,
        priceCents: Math.round(Number(row.price) * 100),
        quantity: Number(row.quantity),
        ...(row.id ? { expectedQuantity: row.expectedQuantity } : {})
      })));
      await api.updateProductVariants(editingProduct.id, { reason: editReason, variants: payloadVariants });
      let imageNotice = '';
      try { saveProductColorImages(editingProduct.id, editGroups); } catch { imageNotice = ' Image could not be saved on this device.'; }
      await loadCatalog(); onStockChanged?.(); cancelEdit(); setNotice(`${productName} updated.${imageNotice}`);
    } catch (error) { setEditNotice(error.message); }
    finally { setEditSaving(false); }
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setNotice('');
    if (variants.some(row => !row.sizes.length)) { setNotice('Choose at least one size for every variant group.'); setSaving(false); return; }
    if (variants.some(row => row.sizes.some(size => row.quantities[size] === '' || row.quantities[size] === undefined))) { setNotice('Enter opening pieces for every selected size.'); setSaving(false); return; }
    try {
      const productVariants = expandVariantGroups(variants);
      const product = await api.createProduct({ name, variants: productVariants });
      let imageNotice = '';
      try { saveProductColorImages(product.id, variants); } catch { imageNotice = ' Images could not be saved on this device.'; }
      setName(''); setVariants([blankVariant()]); setNotice(`Product and stock saved.${imageNotice}`); await loadCatalog(); onStockChanged?.();
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

  function openDeleteDialog(product) {
    setDeleteTarget(product); setDeleteConfirmation(''); setDeleteError(''); setNotice('');
  }
  function closeDeleteDialog() {
    if (deleteBusy === deleteTarget?.id) return;
    setDeleteTarget(null); setDeleteConfirmation(''); setDeleteError('');
  }
  async function deleteProduct(product) {
    if (!matchesDeleteConfirmation(product.name, deleteConfirmation)) { setDeleteError(`Type "${deleteConfirmationToken(product.name)}" exactly to confirm.`); return; }
    setDeleteBusy(product.id); setNotice('');
    try {
      await api.deleteProduct(product.id);
      let imageNotice = '';
      try { deleteProductImages(product.id); } catch { imageNotice = ' Product images could not be removed from this device.'; }
      setNotice(`${product.name} deleted.${imageNotice}`);
      setDeleteTarget(null); setDeleteConfirmation(''); setDeleteError('');
      await loadCatalog(); onStockChanged?.();
    } catch (error) { setDeleteError(error.message); }
    finally { setDeleteBusy(null); }
  }

  const deleteExpected = deleteTarget ? deleteConfirmationToken(deleteTarget.name) : '';

  return <>
    <section className="admin-heading"><h1>Add a product</h1></section>
    {editingProduct && <form ref={editFormRef} className="product-form product-edit-form" onSubmit={saveEdit}>
      <div className="variant-head"><div><h2>Update <span className="edit-product-name">{editingProduct.name}</span></h2></div><div className="edit-head-actions"><button type="button" className="secondary" onClick={() => setEditGroups(groups => [...groups, blankEditGroup()])} disabled={editSaving}>+ Add color group</button><button type="button" className="secondary" onClick={cancelEdit} disabled={editSaving}>Cancel</button></div></div>
      <p className="edit-note">Sizes in one color group share the same color. Add another group to add a new color. Variant and stock changes are recorded in the inventory audit trail.</p>
      <div className="edit-variant-groups">{editGroups.map((group, index) => <fieldset className="edit-variant-group" key={index}>
        <legend>Group {index + 1}</legend>
        <div className="edit-group-fields"><label className="field">Color<input required maxLength={50} value={group.color} onChange={event => updateEditGroup(index, 'color', event.target.value)} /></label>{!group.variants.some(variant => variant.id) && <label className="field">SKU base<input required maxLength={100} value={group.sku} onChange={event => updateEditGroup(index, 'sku', event.target.value)} placeholder="TEE-RED" /></label>}</div>
        <ColorImagePicker image={group.image} label={group.color || `color group ${index + 1}`} onChange={event => updateEditImage(index, event)} />
        {!group.variants.some(variant => variant.id) && <div className="field size-field"><span>Sizes <small>(choose one or more)</small></span><div className="size-choices" role="group" aria-label={`Sizes for color group ${index + 1}`}>{SIZE_OPTIONS.map(size => <label className="size-choice" key={size}><input type="checkbox" checked={group.variants.some(variant => variant.size === size)} onChange={event => toggleEditSize(index, size, event.target.checked)} /><span>{size}</span></label>)}</div></div>}
        <div className="edit-group-sizes" role="group" aria-label={`Stock and price for color group ${index + 1}`}>{group.variants.map(variant => <div className="edit-size-row" key={variant.id || variant.size}><h3>{variant.size}</h3><label className="field">Price (₱)<input required min="0" step="0.01" type="number" value={variant.price} onChange={event => updateEditVariant(index, variant.size, 'price', event.target.value)} /></label><label className="field">Pieces in stock<input required min="0" step="1" type="number" value={variant.quantity} onChange={event => updateEditVariant(index, variant.size, 'quantity', event.target.value)} /></label></div>)}</div>
        {!group.variants.some(variant => variant.id) && <button type="button" className="remove edit-group-remove" onClick={() => setEditGroups(groups => groups.filter((_, i) => i !== index))} disabled={editSaving}>Remove group</button>}
      </fieldset>)}</div>
      <label className="field edit-reason"><span>Reason for update (required)<small>Explain what changed and why. This is saved in the inventory audit trail.</small></span><input required maxLength={500} value={editReason} onChange={event => setEditReason(event.target.value)} /></label>
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
        <ColorImagePicker image={variant.image} label={variant.color || `variant group ${index + 1}`} onChange={event => updateVariantImage(index, event)} />
        <label className="field">SKU<input required maxLength={100} value={variant.sku} onChange={e => updateVariant(index, 'sku', e.target.value)} placeholder="DENIM-L" /></label>
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
      <div className="table-scroll" aria-busy={catalogLoading}>{catalogLoading && <span className="sr-only" role="status">Loading catalog…</span>}<table><thead><tr><th>Product</th><th>Sizes</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead><tbody>{catalogLoading ? Array.from({ length: 5 }, (_, index) => <tr key={`catalog-skeleton-${index}`} aria-hidden="true"><td><Skeleton className="skeleton-table-line wide" /><Skeleton className="skeleton-table-line subtext" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-table-line short" /></td><td><Skeleton className="skeleton-pill" /></td><td><Skeleton className="skeleton-table-button" /></td></tr>) : catalog.length ? catalog.map(product => { const busy = statusBusy === product.id || deleteBusy === product.id || (editSaving && String(editingProduct?.id) === String(product.id)); return <tr key={product.id}><td><b>{product.name}</b><small className="table-subtext">{product.created_at ? new Date(product.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' }) : ''}</small></td><td>{product.variants?.length || 0}</td><td>{product.stock}</td><td><span className={`role ${product.status}`}>{product.status}</span></td><td><button type="button" className="secondary status-toggle" disabled={busy} onClick={() => startEdit(product)}>Edit variants</button> <button type="button" className="secondary status-toggle" disabled={busy} onClick={() => toggleStatus(product)}>{statusBusy === product.id ? 'Saving...' : product.status === 'active' ? 'Archive' : 'Restore'}</button> <button type="button" className="remove status-toggle" disabled={busy} onClick={() => openDeleteDialog(product)}>Delete</button></td></tr>; }) : <tr><td colSpan={5} className="blank">No products in this view.</td></tr>}</tbody></table></div>
    </section>
    {deleteTarget && <div className="delete-overlay" onMouseDown={event => { if (event.target === event.currentTarget) closeDeleteDialog(); }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeDeleteDialog(); } }}>
      <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-product-title" aria-describedby="delete-product-description">
        <div className="camera-head"><div><span className="delete-kicker">Permanent deletion</span><h2 id="delete-product-title">Delete {deleteTarget.name}?</h2></div><button type="button" className="secondary" onClick={closeDeleteDialog} disabled={deleteBusy === deleteTarget.id}>Close</button></div>
        <p id="delete-product-description">This permanently deletes the product, its variants, and inventory data.</p>
        <p className="delete-warning">This also removes sales, returns, and inventory history tied to this product. Other products in the same sale stay in the sale.</p>
        <form onSubmit={event => { event.preventDefault(); deleteProduct(deleteTarget); }}>
          <label className="field">Type <code>{deleteExpected}</code> to confirm<input autoFocus required value={deleteConfirmation} onChange={event => { setDeleteConfirmation(event.target.value); setDeleteError(''); }} aria-invalid={Boolean(deleteError)} /></label>
          {deleteError && <p className="form-notice delete-error" role="alert">{deleteError}</p>}
          <div className="delete-actions"><button type="button" className="secondary" onClick={closeDeleteDialog} disabled={deleteBusy === deleteTarget.id}>Cancel</button><button type="submit" className="delete-confirm" disabled={deleteBusy === deleteTarget.id}>{deleteBusy === deleteTarget.id ? 'Deleting…' : 'Delete permanently'}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
