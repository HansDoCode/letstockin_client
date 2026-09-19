import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import React from 'react';
import InventoryPanel from './InventoryPanel.jsx';
import { ReportsPanel, TeamPanel } from './AdminPanels.jsx';
import ProductPanel from './ProductPanel.jsx';
import CameraScanner from './CameraScanner.jsx';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const navigation = [['pos', '▦', 'Point of sale'], ['inventory', '⌘', 'Inventory'], ['products', '◫', 'Products'], ['reports', '↗', 'Reports'], ['team', '◉', 'Team']];

export default function App() {
  const [view, setView] = useState('pos');
  const [user, setUser] = useState(null); const [checking, setChecking] = useState(true);
  const resetRoute = window.location.pathname === '/reset-password';
  useEffect(() => { if (resetRoute) return setChecking(false); api.me().then(setUser).catch(() => {}).finally(() => setChecking(false)); }, [resetRoute]);
  if (resetRoute) return <PasswordResetPage />;
  if (checking) return <main className="login-page"><p>Checking session…</p></main>;
  if (!user) return <Login onLogin={setUser} />;
  const allowed = user.role === 'admin' ? navigation : navigation.filter(([id]) => id === 'pos' || id === 'inventory');
  return <main className="shell"><aside className="sidebar"><div className="brand"><span>LS</span> Letstockin</div><nav>{allowed.map(([id, icon, label]) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><i>{icon}</i><b>{label}</b></button>)}</nav><div className="profile">{user.name}<br/><small>{user.role} account</small><button className="signout" onClick={async () => { await api.logout(); setUser(null); setView('pos'); }}>Sign out</button></div></aside><section className="workspace">{view === 'pos' && <PosPanel />}{view === 'inventory' && <InventoryPanel role={user.role} />}{user.role === 'admin' && view === 'products' && <ProductPanel />}{user.role === 'admin' && view === 'reports' && <ReportsPanel />}{user.role === 'admin' && view === 'team' && <TeamPanel />}</section></main>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { onLogin(await api.login({ email, password })); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (resetMode) return <PasswordResetRequest onBack={() => setResetMode(false)} />;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Sign in</h1><p>Access your retail workspace.</p><label className="field">Email<input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Password<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="secondary login-link" onClick={() => { setError(''); setResetMode(true); }}>Forgot password?</button></form></main>;
}

function PasswordResetRequest({ onBack }) {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await api.requestPasswordReset(email); setSent(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Reset password</h1>{sent ? <><p className="form-notice" role="status">If an account matches that email, a reset link will be sent shortly.</p><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></> : <><p>Enter your account email and we’ll send a reset link if it exists.</p><label className="field">Email<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'}</button><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></>}</form></main>;
}

function PasswordResetPage() {
  const token = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '', []);
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError('');
    if (!token) return setError('This reset link is invalid or expired.');
    if (password !== confirmation) return setError('Passwords do not match.');
    setBusy(true);
    try { await api.completePasswordReset({ token, password }); setDone(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  if (done) return <main className="login-page"><section className="login-card"><div className="brand"><span>LS</span> Letstockin</div><h1>Password updated</h1><p>Your password was changed. Sign in with the new password.</p><a className="secondary reset-link" href="/">Return to sign in</a></section></main>;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><div className="brand"><span>LS</span> Letstockin</div><h1>Choose a new password</h1><p>Use at least 12 characters. This link can only be used once.</p><label className="field">New password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label className="field">Confirm password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></main>;
}

function Receipt({ receipt, onClose }) {
  return <section className="receipt" aria-label={`Receipt for sale ${receipt.id}`}>
    <div className="receipt-head"><div><p className="eyebrow">Completed sale</p><h2>Receipt #{receipt.id}</h2></div><button className="secondary" onClick={onClose}>Close</button></div>
    <p>{new Date(receipt.createdAt).toLocaleString()} · {receipt.staffName} · Cash recorded</p>
    <div className="receipt-lines">{receipt.items.map((item, index) => <div key={index}><span>{item.name} · {item.size} × {item.quantity}{item.discountCents ? ` · Discount ${money(item.discountCents)}` : ''}</span><b>{money(item.totalCents)}</b></div>)}</div>
    <div className="receipt-total"><span>Total paid</span><b>{money(receipt.totalCents)}</b></div>
    <button className="secondary" onClick={() => window.print()}>Print receipt</button>
  </section>;
}

function PosPanel() {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [cart, setCart] = useState([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState(''); const [receipt, setReceipt] = useState(null); const [sort, setSort] = useState("stock"); const [cameraOpen, setCameraOpen] = useState(false);
  useEffect(() => {
    let current = true;
    const id = setTimeout(async () => {
      if (current) setCatalogLoading(true);
      try {
        const result = await api.products(query);
        if (current) { setProducts(result); setCatalogError(''); }
      } catch (cause) {
        if (current) { setProducts([]); setCatalogError(cause.message || 'Products could not be loaded.'); }
      } finally {
        if (current) setCatalogLoading(false);
      }
    }, 220);
    return () => { current = false; clearTimeout(id); };
  }, [query]);
  const visibleProducts = useMemo(() => [...products].sort((a, b) => sort === "recent" ? new Date(b.created_at) - new Date(a.created_at) : sort === "all" ? a.name.localeCompare(b.name) : Number(b.stock > 0) - Number(a.stock > 0) || a.name.localeCompare(b.name)), [products, sort]);
  const totals = useMemo(() => { const subtotal = cart.reduce((sum, x) => sum + x.variant.priceCents * x.quantity, 0); const discount = cart.reduce((sum, x) => sum + Math.min(x.discountCents, x.variant.priceCents * x.quantity), 0); return { subtotal, discount, total: subtotal - discount }; }, [cart]);
  function add(product, variant) { if (!variant?.stock) return setNotice('That size is out of stock.'); setCart(items => { const line = items.find(x => x.variant.id === variant.id); return line ? items.map(x => x.variant.id === variant.id ? { ...x, quantity: Math.min(x.quantity + 1, variant.stock) } : x) : [...items, { product, variant, quantity: 1, discountCents: 0 }]; }); setNotice(`${product.name}, size ${variant.size} added.`); }
  function updateLine(variantId, patch) {
    setCart(lines => lines.map(line => {
      if (line.variant.id !== variantId) return line;
      const next = { ...line, ...patch };
      const gross = next.variant.priceCents * next.quantity;
      const discount = Number.isSafeInteger(next.discountCents) ? next.discountCents : 0;
      next.discountCents = Math.min(Math.max(0, discount), gross);
      return next;
    }));
  }
  async function resolveCode(code) { try { const item = await api.lookup(code); add({ id: item.product_id, name: item.name }, { id: item.variant_id, size: item.size, priceCents: item.price_cents, stock: item.quantity }); } catch { setNotice('No product matched that barcode or QR code.'); } }
  function scan(event) { if (event.key !== 'Enter' || !event.currentTarget.value) return; const code = event.currentTarget.value.trim(); setQuery(''); resolveCode(code); }
  function closeCamera() { setCameraOpen(false); requestAnimationFrame(() => document.querySelector('.camera-trigger')?.focus()); }
  async function checkout() { if (!cart.length) return; setLoading(true); try { const sale = await api.checkout({ paymentMethod: 'cash', items: cart.map(x => ({ variantId: x.variant.id, quantity: x.quantity, discountCents: x.discountCents, discountReason: x.discountCents ? 'Item discount' : null })) }); setCart([]); setNotice(`Sale #${sale.id} completed — ${money(sale.total_cents)}.`); try { setReceipt(await api.receipt(sale.id)); } catch { setNotice(`Sale #${sale.id} completed, but its receipt could not be loaded.`); } try { setProducts(await api.products(query)); } catch { setCatalogError('Stock could not be refreshed.'); } } catch (error) { setNotice(error.message); } finally { setLoading(false); } }
  return <><header><div><p className="eyebrow">Retail workspace</p><h1>Point of sale</h1></div><button className="icon" aria-label="Notifications">♧<i /></button></header>{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}<div className="pos-grid"><section className="catalog"><div className="search"><span>⌕</span><input autoFocus value={query} onChange={e => setQuery(e.target.value)} onKeyDown={scan} placeholder="Search products, barcode, or scan…" /><kbd>Enter to scan</kbd></div><div className="filter-row"><button className={sort === "stock" ? "filter active" : "filter"} onClick={() => setSort("stock")}>In stock first</button><button className={sort === "all" ? "filter active" : "filter"} onClick={() => setSort("all")}>All products</button><button className={sort === "recent" ? "filter active" : "filter"} onClick={() => setSort("recent")}>Date added</button></div><div className="catalog-head"><h2>Products <small>{products.length} found</small></h2><button className="scan" onClick={() => document.querySelector('.search input')?.focus()}>⌁ Scan code</button><button className="scan camera-trigger" onClick={() => setCameraOpen(true)}>Use camera</button></div>{catalogError && <p className="form-notice" role="alert">{catalogError}</p>}{!catalogError && catalogLoading && <p className="catalog-state" role="status">Loading products…</p>}{!catalogError && !catalogLoading && !visibleProducts.length && <p className="catalog-state">No active products matched that search.</p>}<div className="cards">{visibleProducts.map(product => <article className="product-card" key={product.id}><div className="product-art">{product.name.split(' ').slice(0, 2).map(x => x[0]).join('')}</div><div className="product-info"><div><h3>{product.name}</h3><p>{product.stock} units across sizes</p></div><strong>{money(product.variants?.[0]?.priceCents || 0)}</strong></div><div className="sizes" aria-label={`Sizes for ${product.name}`}>{product.variants?.map(variant => <button key={variant.id} disabled={!variant.stock} onClick={() => add(product, variant)} className={variant.stock <= variant.reorderPoint ? 'low' : ''}>{variant.size}<small>{variant.stock}</small></button>)}</div></article>)}</div></section><aside className="cart"><div className="cart-title"><div><p className="eyebrow">Current order</p><h2>Cart <span>{cart.length}</span></h2></div><button className="clear" onClick={() => setCart([])} disabled={!cart.length}>Clear</button></div><div className="cart-lines">{cart.length ? cart.map(line => <div className="line" key={line.variant.id}><div className="line-art">{line.product.name[0]}</div><div className="line-main"><b>{line.product.name}</b><small>Size {line.variant.size} · {money(line.variant.priceCents)}</small><div className="line-controls"><button onClick={() => updateLine(line.variant.id, { quantity: Math.max(1, line.quantity - 1) })}>−</button><span>{line.quantity}</span><button onClick={() => updateLine(line.variant.id, { quantity: Math.min(line.variant.stock, line.quantity + 1) })}>+</button><label>Discount <input aria-label="Discount in dollars" value={(line.discountCents / 100).toFixed(2)} type="number" min="0" max={(line.variant.priceCents * line.quantity / 100).toFixed(2)} onChange={e => updateLine(line.variant.id, { discountCents: Math.round(Number(e.target.value) * 100) || 0 })} /></label></div></div><b>{money(line.variant.priceCents * line.quantity - line.discountCents)}</b></div>) : <div className="empty"><span>⌁</span><b>Your cart is empty</b><p>Scan a barcode or choose a product and size to begin.</p></div>}</div><div className="totals"><div><span>Subtotal</span><b>{money(totals.subtotal)}</b></div><div><span>Item discounts</span><b className="orange">−{money(totals.discount)}</b></div><div className="grand"><span>Total</span><b>{money(totals.total)}</b></div><button className="checkout" disabled={!cart.length || loading} onClick={checkout}>{loading ? 'Processing…' : `Checkout · ${money(totals.total)}`}</button><p className="payment">Cash payment recorded</p></div></aside></div>{receipt && <Receipt receipt={receipt} onClose={() => setReceipt(null)} />}{cameraOpen && <CameraScanner onClose={closeCamera} onDetected={code => { closeCamera(); resolveCode(code); }} />}</>;
}
