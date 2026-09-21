import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import InventoryPanel from './InventoryPanel.jsx';
import { ReportsPanel, TeamPanel } from './AdminPanels.jsx';
import ProductPanel from './ProductPanel.jsx';
import CameraScanner from './CameraScanner.jsx';

const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100);
const navigation = [['pos', '▦', 'Point of sale'], ['inventory', '⌘', 'Inventory'], ['products', '◫', 'Products'], ['reports', '↗', 'Reports'], ['team', '◉', 'Team']];

function handleDialogKeys(event, container, onClose) {
  if (event.key === 'Escape') { event.stopPropagation(); onClose(); return; }
  if (event.key !== 'Tab' || !container) return;
  const controls = [...container.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]')];
  if (!controls.length) return;
  const first = controls[0]; const last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export default function App() {
  const [view, setView] = useState('pos');
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsError, setAlertsError] = useState('');
  const [inventoryQuery, setInventoryQuery] = useState('');
  const resetRoute = window.location.pathname === '/reset-password';

  useEffect(() => {
    if (resetRoute) { setChecking(false); return; }
    api.me().then(setUser).catch(() => {}).finally(() => setChecking(false));
  }, [resetRoute]);

  const loadAlerts = useCallback(async () => {
    if (!user) return;
    try { setAlerts(await api.lowStock()); setAlertsError(''); }
    catch (error) { setAlertsError(error.message || 'Stock alerts could not be loaded.'); }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    loadAlerts();
    const timer = window.setInterval(loadAlerts, 60000);
    window.addEventListener('focus', loadAlerts);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', loadAlerts); };
  }, [user, loadAlerts]);

  if (resetRoute) return <PasswordResetPage />;
  if (checking) return <main className="login-page"><p>Checking session…</p></main>;
  if (!user) return <Login onLogin={setUser} />;

  const allowed = user.role === 'admin' ? navigation : navigation.filter(([id]) => id === 'pos' || id === 'inventory');
  function openInventory(alert) { setInventoryQuery(alert.name); setView('inventory'); setAlertsOpen(false); }
  async function signOut() { await api.logout(); setUser(null); setAlerts([]); setView('pos'); }

  return <main className="shell">
    <aside className="sidebar"><div className="brand"><span>LS</span> Letstockin</div><nav>{allowed.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><i>{icon}</i><b>{label}</b></button>)}</nav><div className="profile">{user.name}<br/><small>{user.role} account</small><button className="signout" onClick={signOut}>Sign out</button></div></aside>
    <section className="workspace">
      <div className="notification-anchor"><button className="icon notification-button" aria-label={`${alerts.length} low-stock notifications`} aria-expanded={alertsOpen} onClick={() => setAlertsOpen(true)}>📉{alerts.length > 0 && <span>{alerts.length > 99 ? '99+' : alerts.length}</span>}</button></div>
      {view === 'pos' && <PosPanel onStockChanged={loadAlerts} />}
      {view === 'inventory' && <InventoryPanel role={user.role} initialQuery={inventoryQuery} onStockChanged={loadAlerts} />}
      {user.role === 'admin' && view === 'products' && <ProductPanel onStockChanged={loadAlerts} />}
      {user.role === 'admin' && view === 'reports' && <ReportsPanel />}
      {user.role === 'admin' && view === 'team' && <TeamPanel />}
      {alertsOpen && <NotificationPanel alerts={alerts} error={alertsError} role={user.role} onClose={() => setAlertsOpen(false)} onOpenInventory={openInventory} onRefresh={loadAlerts} />}
    </section>
  </main>;
}

function NotificationPanel({ alerts, error, role, onClose, onOpenInventory, onRefresh }) {
  const closeRef = useRef(null); const panelRef = useRef(null); const returnFocusRef = useRef(document.activeElement);
  useEffect(() => { closeRef.current?.focus(); return () => returnFocusRef.current?.focus(); }, []);
  return <div className="notification-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, panelRef.current, onClose)}>
    <aside ref={panelRef} className="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
      <div className="notification-head"><div><p className="eyebrow">Inventory status</p><h2 id="notifications-title">Low-stock alerts <span>{alerts.length}</span></h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div>
      {error && <p className="form-notice" role="alert">{error} <button className="link-button" onClick={onRefresh}>Retry</button></p>}
      {!error && !alerts.length && <div className="notification-empty"><b>Stock levels look healthy</b><p>No active variants are at or below their reorder point.</p></div>}
      <div className="notification-list">{alerts.map(alert => <button key={alert.variantId} onClick={() => onOpenInventory(alert)}><span><b>{alert.name}</b><small>{alert.size} · {alert.color} · reorder at {alert.reorderPoint}</small></span><strong className={alert.quantity === 0 ? 'out' : ''}>{alert.quantity === 0 ? 'Out of stock' : `${alert.quantity} left`}</strong></button>)}</div>
      <p className="notification-foot">{role === 'admin' ? 'Open an item to review or adjust its stock.' : 'Open an item to review its inventory details.'}</p>
    </aside>
  </div>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [resetMode, setResetMode] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { onLogin(await api.login({ email, password })); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (resetMode) return <PasswordResetRequest onBack={() => setResetMode(false)} />;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Sign in</h1><p>Access your retail workspace.</p><label className="field">Email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="field">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="secondary login-link" onClick={() => { setError(''); setResetMode(true); }}>Forgot password?</button></form></main>;
}

function PasswordResetRequest({ onBack }) {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await api.requestPasswordReset(email); setSent(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Reset password</h1>{sent ? <><p className="form-notice" role="status">If an account matches that email, a reset link will be sent shortly. Check the inbox and spam folder.</p><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></> : <><p>Enter your account email and we’ll send a reset link if it exists.</p><label className="field">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'}</button><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></>}</form></main>;
}

function PasswordResetPage() {
  const token = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '', []);
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setError(''); if (!token) return setError('This reset link is invalid or expired.'); if (password !== confirmation) return setError('Passwords do not match.'); setBusy(true); try { await api.completePasswordReset({ token, password }); setDone(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (done) return <main className="login-page"><section className="login-card"><div className="brand"><span>LS</span> Letstockin</div><h1>Password updated</h1><p>Your password was changed. Sign in with the new password.</p><a className="secondary reset-link" href="/">Return to sign in</a></section></main>;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Choose a new password</h1><p>Use at least 12 characters. This link can only be used once.</p><label className="field">New password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field">Confirm password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></main>;
}

function Receipt({ receipt, onClose }) {
  return <section className="receipt" aria-label={`Receipt for sale ${receipt.id}`}><div className="receipt-head"><div><p className="eyebrow">Completed sale</p><h2>Receipt #{receipt.id}</h2></div><button className="secondary" onClick={onClose}>Close</button></div><p>{new Date(receipt.createdAt).toLocaleString()} · {receipt.staffName} · Cash recorded</p><div className="receipt-lines">{receipt.items.map(item => <div key={item.id}><span>{item.name} · {item.size} / {item.color} × {item.quantity}{item.discountCents ? ` · Discount ${money(item.discountCents)}` : ''}</span><b>{money(item.totalCents)}</b></div>)}</div><div className="receipt-total"><span>Total paid</span><b>{money(receipt.totalCents)}</b></div><button className="secondary" onClick={() => window.print()}>Print receipt</button></section>;
}

function PosPanel({ onStockChanged }) {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [cart, setCart] = useState([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState(''); const [receipt, setReceipt] = useState(null); const [sort, setSort] = useState('stock'); const [cameraOpen, setCameraOpen] = useState(false); const [qrProduct, setQrProduct] = useState(null);
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(async () => { if (current) setCatalogLoading(true); try { const result = await api.products(query); if (current) { setProducts(result); setCatalogError(''); } } catch (cause) { if (current) { setProducts([]); setCatalogError(cause.message || 'Products could not be loaded.'); } } finally { if (current) setCatalogLoading(false); } }, 220);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query]);
  const visibleProducts = useMemo(() => [...products].sort((a, b) => sort === 'recent' ? new Date(b.created_at) - new Date(a.created_at) : sort === 'all' ? a.name.localeCompare(b.name) : Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name)), [products, sort]);
  const totals = useMemo(() => { const subtotal = cart.reduce((sum, line) => sum + line.variant.priceCents * line.quantity, 0); const discount = cart.reduce((sum, line) => sum + Math.min(line.discountCents, line.variant.priceCents * line.quantity), 0); return { subtotal, discount, total: subtotal - discount }; }, [cart]);

  function add(product, variant, scanned = false) {
    if (!variant?.stock) return setNotice('That size and color is out of stock.');
    setCart(items => { const line = items.find(item => item.variant.id === variant.id); return line ? items.map(item => item.variant.id === variant.id ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock) } : item) : [...items, { product, variant, quantity: 1, discountCents: 0 }]; });
    setNotice(`${scanned ? 'Product found — ' : ''}${product.name}, ${variant.size} / ${variant.color}, ${money(variant.priceCents)} added.`);
  }
  function updateLine(variantId, patch) { setCart(lines => lines.map(line => { if (line.variant.id !== variantId) return line; const next = { ...line, ...patch }; const gross = next.variant.priceCents * next.quantity; next.discountCents = Math.min(Math.max(0, Number.isSafeInteger(next.discountCents) ? next.discountCents : 0), gross); return next; })); }
  async function resolveCode(code) {
    try {
      const result = await api.lookup(code);
      const matched = result.variants.find(variant => String(variant.id) === String(result.matchedVariantId));
      if (!matched) throw new Error('The matched product variant is unavailable.');
      if (result.identifierType === 'qr') { setQrProduct(result); setNotice(`${result.name} product details opened.`); }
      else add({ id: result.productId, name: result.name }, { ...matched, stock: matched.quantity }, true);
    } catch (error) { setNotice(error.message || 'No product matched that barcode or QR code.'); }
  }
  function scan(event) { if (event.key !== 'Enter' || !event.currentTarget.value.trim()) return; event.preventDefault(); const code = event.currentTarget.value.trim(); setQuery(''); resolveCode(code); }
  function closeCamera() { setCameraOpen(false); requestAnimationFrame(() => document.querySelector('.camera-trigger')?.focus()); }
  async function checkout() { if (!cart.length) return; setLoading(true); try { const sale = await api.checkout({ paymentMethod: 'cash', items: cart.map(line => ({ variantId: line.variant.id, quantity: line.quantity, discountCents: line.discountCents, discountReason: line.discountCents ? 'Item discount' : null })) }); setCart([]); setNotice(`Sale #${sale.id} completed — ${money(sale.total_cents)}.`); try { setReceipt(await api.receipt(sale.id)); } catch { setNotice(`Sale #${sale.id} completed, but its receipt could not be loaded.`); } try { setProducts(await api.products(query)); } catch { setCatalogError('Stock could not be refreshed.'); } onStockChanged?.(); } catch (error) { setNotice(error.message); } finally { setLoading(false); } }

  return <><header><div><p className="eyebrow">Retail workspace</p><h1>Point of sale</h1></div></header>{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}<div className="pos-grid"><section className="catalog"><div className="search"><span>⌕</span><input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={scan} placeholder="Search products, barcode, QR, size, or color…" /><kbd>Enter to scan</kbd></div><div className="filter-row"><button className={sort === 'stock' ? 'filter active' : 'filter'} onClick={() => setSort('stock')}>In stock first</button><button className={sort === 'all' ? 'filter active' : 'filter'} onClick={() => setSort('all')}>All products</button><button className={sort === 'recent' ? 'filter active' : 'filter'} onClick={() => setSort('recent')}>Date added</button></div><div className="catalog-head"><h2>Products <small>{products.length} found</small></h2><button className="scan" onClick={() => document.querySelector('.search input')?.focus()}>⌁ Scan code</button><button className="scan camera-trigger" onClick={() => setCameraOpen(true)}>Use camera</button></div>{catalogError && <p className="form-notice" role="alert">{catalogError}</p>}{!catalogError && catalogLoading && <p className="catalog-state" role="status">Loading products…</p>}{!catalogError && !catalogLoading && !visibleProducts.length && <p className="catalog-state">No active products matched that search.</p>}<div className="cards">{visibleProducts.map(product => <article className="product-card" key={product.id}><div className="product-art">{product.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</div><div className="product-info"><div><h3>{product.name}</h3><p>{product.stock} units across variants</p></div><strong>{money(product.variants?.[0]?.priceCents)}</strong></div><div className="sizes" aria-label={`Variants for ${product.name}`}>{product.variants?.map(variant => <button key={variant.id} disabled={!variant.stock} title={`${variant.color} · ${variant.stock} available`} onClick={() => add(product, variant)} className={variant.stock <= variant.reorderPoint ? 'low' : ''}>{variant.size}<small>{variant.color}</small></button>)}</div></article>)}</div></section><aside className="cart"><div className="cart-title"><div><p className="eyebrow">Current order</p><h2>Cart <span>{cart.length}</span></h2></div><button className="clear" onClick={() => setCart([])} disabled={!cart.length}>Clear</button></div><div className="cart-lines">{cart.length ? cart.map(line => <div className="line" key={line.variant.id}><div className="line-art">{line.product.name[0]}</div><div className="line-main"><b>{line.product.name}</b><small>{line.variant.size} / {line.variant.color} · {money(line.variant.priceCents)}</small><div className="line-controls"><button onClick={() => updateLine(line.variant.id, { quantity: Math.max(1, line.quantity - 1) })}>−</button><span>{line.quantity}</span><button onClick={() => updateLine(line.variant.id, { quantity: Math.min(line.variant.stock, line.quantity + 1) })}>+</button><label>Discount <input aria-label="Discount in Philippine pesos" value={(line.discountCents / 100).toFixed(2)} type="number" min="0" max={(line.variant.priceCents * line.quantity / 100).toFixed(2)} onChange={event => updateLine(line.variant.id, { discountCents: Math.round(Number(event.target.value) * 100) || 0 })} /></label></div></div><b>{money(line.variant.priceCents * line.quantity - line.discountCents)}</b></div>) : <div className="empty"><span>⌁</span><b>Your cart is empty</b><p>Scan a barcode or choose a size and color to begin.</p></div>}</div><div className="totals"><div><span>Subtotal</span><b>{money(totals.subtotal)}</b></div><div><span>Item discounts</span><b className="orange">−{money(totals.discount)}</b></div><div className="grand"><span>Total</span><b>{money(totals.total)}</b></div><button className="checkout" disabled={!cart.length || loading} onClick={checkout}>{loading ? 'Processing…' : `Checkout · ${money(totals.total)}`}</button><p className="payment">Cash payment recorded</p></div></aside></div>{receipt && <Receipt receipt={receipt} onClose={() => setReceipt(null)} />}{cameraOpen && <CameraScanner onClose={closeCamera} onDetected={code => { closeCamera(); resolveCode(code); }} />}{qrProduct && <ProductDetailsDialog product={qrProduct} onClose={() => setQrProduct(null)} onAdd={(product, variant) => { add(product, { ...variant, stock: variant.quantity }); setQrProduct(null); }} />}</>;
}

function ProductDetailsDialog({ product, onClose, onAdd }) {
  const closeRef = useRef(null); const dialogRef = useRef(null); const returnFocusRef = useRef(document.activeElement);
  const [selectedId, setSelectedId] = useState(product.matchedVariantId);
  const selected = product.variants.find(variant => String(variant.id) === String(selectedId)) || product.variants[0];
  useEffect(() => { closeRef.current?.focus(); return () => returnFocusRef.current?.focus(); }, []);
  return <div className="product-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, dialogRef.current, onClose)}><section ref={dialogRef} className="product-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="product-detail-title"><div className="camera-head"><div><p className="eyebrow">QR product details</p><h2 id="product-detail-title">{product.name}</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><div className="detail-summary"><span className={selected.quantity <= selected.reorderPoint ? 'stock-pill low' : 'stock-pill'}>{selected.quantity ? `${selected.quantity} available` : 'Out of stock'}</span><b>{money(selected.priceCents)}</b></div><dl><div><dt>Size</dt><dd>{selected.size}</dd></div><div><dt>Color</dt><dd>{selected.color}</dd></div><div><dt>SKU</dt><dd>{selected.sku}</dd></div><div><dt>Barcode</dt><dd>{selected.barcode || '—'}</dd></div><div><dt>QR code</dt><dd>{selected.qrCode || '—'}</dd></div><div><dt>Low-stock point</dt><dd>{selected.reorderPoint}</dd></div></dl><div className="detail-variants" aria-label="Product variants">{product.variants.map(variant => <button key={variant.id} className={String(variant.id) === String(selected.id) ? 'selected' : ''} onClick={() => setSelectedId(variant.id)}><b>{variant.size} · {variant.color}</b><small>{variant.quantity} available · {money(variant.priceCents)}</small></button>)}</div><button className="checkout" disabled={!selected.quantity} onClick={() => onAdd({ id: product.productId, name: product.name }, selected)}>{selected.quantity ? `Add to cart · ${money(selected.priceCents)}` : 'Out of stock'}</button></section></div>;
}
