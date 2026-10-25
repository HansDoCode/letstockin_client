import { useEffect, useState } from 'react';
import { api } from './api.js';
import Skeleton from './Skeleton.jsx';
import React from 'react';

const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);

export default function ReturnsPanel({ onReturned }) {
  const [sales, setSales] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.sales().then(setSales).catch(cause => setError(cause.message || 'Transactions could not be loaded.')).finally(() => setLoading(false)); }, []);
  async function openSale(id) {
    setError(''); setNotice('');
    try { const detail = await api.receipt(id); setReceipt(detail); setItemId(''); setQuantity('1'); setReason(''); }
    catch (cause) { setError(cause.message); }
  }
  async function recordReturn(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api.returnItem(receipt.id, { saleItemId: Number(itemId), quantity: Number(quantity), reason });
      setReceipt(await api.receipt(receipt.id)); setNotice(`Return #${result.id} recorded. Cash refund: ${money(result.refundCents)}.`);
      onReturned?.();
      setItemId(''); setQuantity('1'); setReason('');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  const selected = receipt?.items.find(item => String(item.id) === itemId);
  return <section className="data-panel returns-panel" aria-label="Sales returns">
    <h2>Sales and returns</h2>
    {error && <p className="form-notice" role="alert">{error}</p>}
    {notice && <p className="inventory-notice" role="status">{notice}</p>}
    <div className="returns-layout"><div className="returns-list">
      {loading ? <><span className="sr-only" role="status">Loading transactions…</span>{Array.from({ length: 4 }, (_, index) => <div className="return-sale skeleton-return-sale" key={`return-skeleton-${index}`} aria-hidden="true"><span><Skeleton className="skeleton-return-title" /><Skeleton className="skeleton-return-meta" /></span><Skeleton className="skeleton-return-total" /></div>)}</> : sales.length ? sales.map(sale => <button key={sale.id} className={String(receipt?.id) === String(sale.id) ? 'return-sale selected' : 'return-sale'} onClick={() => openSale(sale.id)}><span><b>Sale #{sale.id}</b><small>{new Date(sale.createdAt).toLocaleString()} · {sale.staffName}</small></span><strong>{money(sale.totalCents)}</strong></button>) : <p className="blank">{loading ? 'Loading transactions...' : error ? 'Transactions are unavailable.' : 'No completed sales yet.'}</p>}
    </div><div className="returns-detail">
      {receipt ? <><h3>Sale #{receipt.id}</h3><p>{receipt.staffName} · Cash payment {receipt.paymentStatus}</p>
        <div className="return-lines">{receipt.items.map(item => <div key={item.id}><span>{item.name} · {item.size} / {item.color}<small>{item.quantity} sold · {item.returnedQuantity} returned · {money(item.totalCents)} paid</small></span><b>{money(item.refundedCents)} refunded</b></div>)}</div>
        {receipt.items.some(item => item.returnedQuantity < item.quantity) ? <form className="return-form" onSubmit={recordReturn}>
          <label className="field">Item<select required value={itemId} onChange={event => { setItemId(event.target.value); setQuantity('1'); }}><option value="">Choose an item</option>{receipt.items.filter(item => item.returnedQuantity < item.quantity).map(item => <option key={item.id} value={item.id}>{item.name} · {item.size} / {item.color} ({item.quantity - item.returnedQuantity} available to return)</option>)}</select></label>
          <label className="field">Quantity<input required type="number" min="1" max={selected ? selected.quantity - selected.returnedQuantity : undefined} step="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
          <label className="field">Reason<input required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Customer return reason" /></label>
          <button className="checkout" disabled={busy || !itemId}>{busy ? 'Recording…' : 'Record cash refund and restock'}</button>
        </form> : <p className="blank">All items have been returned.</p>}
      </> : <p className="blank">Select a sale to inspect items and record a return.</p>}
    </div></div>
  </section>;
}
