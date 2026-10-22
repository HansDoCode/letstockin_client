import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from './api.js';
import InventoryPanel from './InventoryPanel.jsx';
import { ReportsPanel, TeamPanel } from './AdminPanels.jsx';
import ProductPanel from './ProductPanel.jsx';
import SecurityPanel from './SecurityPanel.jsx';
import CameraScanner from './CameraScanner.jsx';
import { code128Bars } from './barcode.js';
import { parseCashCents } from './pos-money.js';
import { normalizeProductDetails } from './product-details.js';
import { SIZE_OPTIONS } from './product-variants.js';

const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100);
const productPhoto = name => name?.trim().toLowerCase().startsWith('augyew') ? `${import.meta.env.BASE_URL}images/augyew-graphic-tee-vintage-pos.png` : null;
const logoPath = `${import.meta.env.BASE_URL}images/letstockin-logo.png`;
const productImageStorageKey = 'letstockin:product-images';
const remoteScannerStorageKey = 'letstockin:remote-scanner-sessions';
const validRemoteScannerToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function remoteScannerUrl(token) {
  const url = new URL(window.location.href); url.search = ''; url.hash = ''; url.searchParams.set('remoteScanner', token); return url.toString();
}
function loadRemoteScannerSessions() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(remoteScannerStorageKey) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter(session => session && validRemoteScannerToken(session.token)).slice(0, 2).map(session => {
      const cursor = Number(session.cursor);
      return { token: session.token, cursor: Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0, url: remoteScannerUrl(session.token) };
    });
  } catch { return []; }
}
function saveRemoteScannerSessions(sessions, cursors) {
  try { window.localStorage.setItem(remoteScannerStorageKey, JSON.stringify(sessions.map(session => ({ token: session.token, cursor: cursors.get(session.token) ?? session.cursor ?? 0 })))); } catch {}
}
const navigation = [['pos', '▦', 'Point of sale'], ['inventory', '⌘', 'Inventory'], ['products', '◫', 'Products'], ['reports', '↗', 'Reports'], ['team', '◉', 'Team'], ['security', 'S', 'Security']];

function Brand() {
  return <div className="brand"><img className="brand-logo" src={logoPath} alt="" /><span className="brand-name">Letstockin</span></div>;
}

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
  const [navOpen, setNavOpen] = useState(false);
  const resetRoute = window.location.pathname === '/reset-password';
  const remoteScannerToken = useMemo(() => {
    const token = new URLSearchParams(window.location.search).get('remoteScanner') || '';
    return /^[a-f0-9]{64}$/.test(token) ? token : '';
  }, []);

  useEffect(() => {
    if (resetRoute || remoteScannerToken) { setChecking(false); return; }
    api.me().then(setUser).catch(() => {}).finally(() => setChecking(false));
  }, [resetRoute, remoteScannerToken]);

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

  useEffect(() => {
    if (!navOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setNavOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [navOpen]);

  if (remoteScannerToken) return <RemoteScannerPage token={remoteScannerToken} />;
  if (resetRoute) return <PasswordResetPage />;
  if (checking) return <main className="login-page"><p>Checking session…</p></main>;
  if (!user) return <Login onLogin={setUser} />;

  const allowed = user.role === 'admin' ? navigation : navigation.filter(([id]) => id === 'pos' || id === 'inventory' || id === 'security');
  function openInventory(alert) { setInventoryQuery(alert.name); setView('inventory'); setAlertsOpen(false); setNavOpen(false); }
  async function signOut() { await api.logout(); setUser(null); setAlerts([]); setView('pos'); setNavOpen(false); }

  return <main className="shell">
    <aside id="main-navigation" className={navOpen ? 'sidebar open' : 'sidebar'}><Brand /><nav>{allowed.map(([id, icon, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setNavOpen(false); setAlertsOpen(false); }}><i>{icon}</i><b>{label}</b></button>)}</nav><div className="profile">{user.name}<br/><small>{user.role} account</small><button className="signout" onClick={signOut}>Sign out</button></div></aside>
    <button type="button" className={navOpen ? 'nav-toggle icon open' : 'nav-toggle icon'} aria-label={navOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={navOpen} aria-controls="main-navigation" onClick={() => { setNavOpen(open => !open); setAlertsOpen(false); }}>{navOpen ? '×' : '☰'}</button>
    {navOpen && <button type="button" className="nav-scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <section className="workspace">
      {view === 'pos' && <PosPanel onStockChanged={loadAlerts} lowStockCount={alerts.length} alertsOpen={alertsOpen} onOpenLowStock={() => setAlertsOpen(true)} />}
      {view === 'inventory' && <InventoryPanel role={user.role} initialQuery={inventoryQuery} onStockChanged={loadAlerts} />}
      {user.role === 'admin' && view === 'products' && <ProductPanel onStockChanged={loadAlerts} />}
      {user.role === 'admin' && view === 'reports' && <ReportsPanel />}
      {user.role === 'admin' && view === 'team' && <TeamPanel />}
      {view === 'security' && <SecurityPanel />}
      {alertsOpen && <NotificationPanel alerts={alerts} error={alertsError} role={user.role} onClose={() => setAlertsOpen(false)} onOpenInventory={openInventory} onRefresh={loadAlerts} />}
    </section>
  </main>;
}

function RemoteScannerPage({ token }) {
  const [cameraOpen, setCameraOpen] = useState(true);
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [paired, setPaired] = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const [notice, setNotice] = useState('Ready to scan for the computer.');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => { setCooldown(false); setScanKey(current => current + 1); setCameraOpen(true); }, 1200);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function detected(code) {
    setCameraOpen(false); setBusy(true); setError('');
    try {
      await api.remoteScannerScan(token, code);
      setNotice('Scan sent. Move to the next item…');
      setCooldown(true);
    } catch (cause) {
      setError(cause.message || 'The scan could not be sent.');
      if (cause.status === 404) setPaired(false);
      else { setScanKey(current => current + 1); setCameraOpen(true); }
    } finally { setBusy(false); }
  }

  function openCamera() { setError(''); setScanKey(current => current + 1); setCameraOpen(true); }

  return <main className="remote-scanner-page"><section className="remote-scanner-card"><Brand /><h1>Phone scanner</h1><p>Keep this page open while the computer is taking the order. Each barcode scan is sent to its cart.</p>{notice && <p className="form-notice" role="status">{notice}</p>}{error && <p className="form-notice" role="alert">{error}</p>}{busy && <p className="remote-scanner-status">Sending scan…</p>}{cooldown && <p className="remote-scanner-status">Wait a moment before the next scan…</p>}{!paired ? <button className="checkout" onClick={() => { window.location.href = window.location.pathname; }}>Return to app</button> : !cameraOpen && !busy && !cooldown && <button className="checkout" onClick={openCamera}>Start camera</button>}{paired && cameraOpen && <CameraScanner key={scanKey} onClose={() => setCameraOpen(false)} onDetected={detected} />}</section></main>;
}

function NotificationPanel({ alerts, error, role, onClose, onOpenInventory, onRefresh }) {
  const closeRef = useRef(null); const panelRef = useRef(null); const returnFocusRef = useRef(document.activeElement);
  useEffect(() => { closeRef.current?.focus(); return () => returnFocusRef.current?.focus(); }, []);
  return <div className="notification-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, panelRef.current, onClose)}>
    <aside ref={panelRef} className="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notifications-title">
      <div className="notification-head"><div><h2 id="notifications-title">Low-stock alerts <span>{alerts.length}</span></h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div>
      {error && <p className="form-notice" role="alert">{error} <button className="link-button" onClick={onRefresh}>Retry</button></p>}
      {!error && !alerts.length && <div className="notification-empty"><b>Stock levels look healthy</b><p>No active variants are at or below their reorder point.</p></div>}
      <div className="notification-list">{alerts.map(alert => <button key={alert.variantId} onClick={() => onOpenInventory(alert)}><span><b>{alert.name}</b><small>{alert.size} · {alert.color} · reorder at {alert.reorderPoint}</small></span><strong className={alert.quantity === 0 ? 'out' : ''}>{alert.quantity === 0 ? 'Out of stock' : `${alert.quantity} left`}</strong></button>)}</div>
      <p className="notification-foot">{role === 'admin' ? 'Open an item to review or adjust its stock.' : 'Open an item to review its inventory details.'}</p>
    </aside>
  </div>;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [remember, setRemember] = useState(false); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [resetMode, setResetMode] = useState(false); const [mfaChallenge, setMfaChallenge] = useState('');
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const result = await api.login({ email, password, remember }); if (result.mfaRequired) { setMfaChallenge(result.challenge); return; } onLogin(result); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (mfaChallenge) return <MfaLogin challenge={mfaChallenge} remember={remember} onLogin={onLogin} onBack={() => setMfaChallenge('')} />;
  if (resetMode) return <PasswordResetRequest onBack={() => setResetMode(false)} />;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Sign in</h1><p>Access your retail workspace.</p><label className="field">Email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label><label className="field">Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="remember-field"><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Remember me on this device</span></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="secondary login-link" onClick={() => { setError(''); setResetMode(true); }}>Forgot password?</button></form></main>;
}

function MfaLogin({ challenge, remember, onLogin, onBack }) {
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { onLogin(await api.verifyMfa({ challenge, code, remember })); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Two-step verification</h1><p>Enter the code from your authenticator app, or use a recovery code.</p><label className="field">Verification code<input required autoFocus autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Verifying…' : 'Verify and sign in'}</button><button type="button" className="secondary login-link" onClick={onBack}>Back to password</button></form></main>;
}

function PasswordResetRequest({ onBack }) {
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { await api.requestPasswordReset(email); setSent(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Reset password</h1>{sent ? <><p className="form-notice" role="status">If an account matches that email, a reset link will be sent shortly. Check the inbox and spam folder.</p><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></> : <><p>Enter your account email and we’ll send a reset link if it exists.</p><label className="field">Email<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Requesting…' : 'Send reset link'}</button><button type="button" className="secondary" onClick={onBack}>Back to sign in</button></>}</form></main>;
}

function PasswordResetPage() {
  const token = useMemo(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '', []);
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event) { event.preventDefault(); setError(''); if (!token) return setError('This reset link is invalid or expired.'); if (password !== confirmation) return setError('Passwords do not match.'); setBusy(true); try { await api.completePasswordReset({ token, password }); setDone(true); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (done) return <main className="login-page"><section className="login-card"><Brand /><h1>Password updated</h1><p>Your password was changed. Sign in with the new password.</p><a className="secondary reset-link" href="/">Return to sign in</a></section></main>;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Choose a new password</h1><p>Use at least 12 characters. This link can only be used once.</p><label className="field">New password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field">Confirm password<input required minLength="12" maxLength="256" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></main>;
}

function Receipt({ receipt }) {
  const bars = code128Bars(`SALE-${receipt.id}`);
  const barcodeWidth = bars.reduce((total, bar) => total + bar.width * 2, 0) + 24;
  const receiptDate = new Date(receipt.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
  let barcodeX = 12;
  return <section className="receipt" aria-label={`Receipt for sale ${receipt.id}`}>
    <div className="receipt-paper">
      <div className="receipt-title"><h2>Cash Receipt</h2><p>Letstockin</p></div>
      <div className="receipt-divider" />
      <dl className="receipt-meta"><div><dt>Address:</dt><dd>—</dd></div><div><dt>Tel:</dt><dd>—</dd></div><div><dt>Date:</dt><dd>{receiptDate}</dd></div><div><dt>Manager:</dt><dd>{receipt.staffName}</dd></div></dl>
      <div className="receipt-divider" />
      <div className="receipt-lines" aria-label="Purchased items">{receipt.items.map(item => <div key={item.id}><span className="receipt-line-name"><strong>{item.name}</strong><small>{item.size} / {item.color} · {item.quantity} × {money(item.unitPriceCents)}{item.discountCents ? ` · Discount ${money(item.discountCents)}` : ''}</small></span><b>{money(item.totalCents)}</b></div>)}</div>
      <div className="receipt-divider" />
      <div className="receipt-summary"><div><span>Price</span><b>{money(receipt.subtotalCents)}</b></div><div><span>Sale</span><b>{receipt.discountCents ? `−${money(receipt.discountCents)}` : money(0)}</b></div><div><span>VAT</span><b>{money(0)}</b></div></div>
      <div className="receipt-divider" />
      <div className="receipt-total"><span>Total</span><b>{money(receipt.totalCents)}</b></div>
      {receipt.cashReceivedCents != null && <div className="receipt-cash"><div><span>Cash received</span><b>{money(receipt.cashReceivedCents)}</b></div><div><span>{receipt.cashReceivedCents >= receipt.totalCents ? 'Change to give' : 'Cash short'}</span><b>{money(Math.abs(receipt.cashReceivedCents - receipt.totalCents))}</b></div></div>}
      <div className="receipt-divider" />
      <p className="receipt-thanks">Thank you!</p>
      <svg className="receipt-barcode" width={barcodeWidth} height="64" viewBox={`0 0 ${barcodeWidth} 64`} role="img" aria-label={`Barcode for sale ${receipt.id}`} shapeRendering="crispEdges"><rect width={barcodeWidth} height="64" fill="#fff" />{bars.map((bar, index) => { const left = barcodeX; barcodeX += bar.width * 2; return bar.black ? <rect key={index} x={left} y="3" width={bar.width * 2} height="52" fill="#707070" /> : null; })}</svg>
    </div>
  </section>;
}

function DiscountEditor({ line, onChange, disabled = false }) {
  const gross = line.variant.priceCents * line.quantity;
  const [draft, setDraft] = useState(line.discountCents ? (line.discountCents / 100).toFixed(2) : '');
  useEffect(() => { setDraft(line.discountCents ? (line.discountCents / 100).toFixed(2) : ''); }, [line.discountCents]);
  function commit(value) {
    const amount = value.trim() === '' ? 0 : Number(value);
    const cents = Number.isFinite(amount) ? Math.round(amount * 100) : line.discountCents;
    const next = Math.min(Math.max(0, cents), gross);
    onChange(next);
    setDraft(next ? (next / 100).toFixed(2) : '');
  }
  return <div className="discount-editor">
    <div className="discount-head"><label htmlFor={`discount-${line.variant.id}`}>Discount</label></div>
    <div className="discount-entry"><span aria-hidden="true">PHP</span><input id={`discount-${line.variant.id}`} aria-label="Discount amount in Philippine pesos" inputMode="decimal" type="number" min="0" max={(gross / 100).toFixed(2)} step="0.01" value={draft} placeholder="0.00" disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={() => commit(draft)} />{line.discountCents > 0 && <button type="button" className="discount-clear" disabled={disabled} onClick={() => { onChange(0); setDraft(''); }}>Clear</button>}</div>
    <div className="discount-presets" aria-label="Quick discount"><span>Quick</span>{[10, 20, 50].map(percent => <button type="button" key={percent} disabled={disabled} onClick={() => onChange(Math.round(gross * percent / 100))}>{percent}%</button>)}</div>
  </div>;
}

function PosPanel({ onStockChanged, lowStockCount, alertsOpen, onOpenLowStock }) {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [cart, setCart] = useState([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState(''); const [receipt, setReceipt] = useState(null); const [sort, setSort] = useState('stock'); const [cameraOpen, setCameraOpen] = useState(false); const [qrProduct, setQrProduct] = useState(null); const [remoteSessions, setRemoteSessions] = useState(loadRemoteScannerSessions); const [remoteDialogOpen, setRemoteDialogOpen] = useState(false); const [remotePairBusy, setRemotePairBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [productImages, setProductImages] = useState(() => { try { const saved = JSON.parse(window.localStorage.getItem(productImageStorageKey) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}; } catch { return {}; } });
  const [cashReceived, setCashReceived] = useState('');
  const searchRef = useRef(null); const cartRef = useRef(null); const remoteSessionsRef = useRef(remoteSessions); const remoteCursorsRef = useRef(new Map(remoteSessions.map(session => [session.token, session.cursor]))); const resolveCodeRef = useRef(null);
  function updateRemoteSessions(next) { remoteSessionsRef.current = next; setRemoteSessions(next); saveRemoteScannerSessions(next, remoteCursorsRef.current); }
  function removeRemoteSession(token) { remoteCursorsRef.current.delete(token); const next = remoteSessionsRef.current.filter(session => session.token !== token); updateRemoteSessions(next); if (!next.length) setRemoteDialogOpen(false); }
  useEffect(() => {
    let current = true;
    const timer = window.setTimeout(async () => { if (current) setCatalogLoading(true); try { const result = await api.products(query); if (current) { setProducts(result); setCatalogError(''); } } catch (cause) { if (current) { setProducts([]); setCatalogError(cause.message || 'Products could not be loaded.'); } } finally { if (current) setCatalogLoading(false); } }, 220);
    return () => { current = false; window.clearTimeout(timer); };
  }, [query]);
  const visibleProducts = useMemo(() => [...products].sort((a, b) => {
    if (sort === 'recent') return new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'all') return a.name.localeCompare(b.name);
    const healthy = product => product.variants?.some(variant => variant.stock <= variant.reorderPoint) ? 0 : 1;
    return Number(b.stock > 0) - Number(a.stock > 0) || healthy(b) - healthy(a) || a.name.localeCompare(b.name);
  }), [products, sort]);
  const totals = useMemo(() => { const subtotal = cart.reduce((sum, line) => sum + line.variant.priceCents * line.quantity, 0); const discount = cart.reduce((sum, line) => sum + Math.min(line.discountCents, line.variant.priceCents * line.quantity), 0); return { subtotal, discount, total: subtotal - discount }; }, [cart]);
  const cashCents = parseCashCents(cashReceived);
  const canPay = Number.isSafeInteger(cashCents) && cashCents >= totals.total;
  const canPrintReceipt = Boolean(receipt && notice.startsWith(`Sale #${receipt.id} completed.`));
  useEffect(() => {
    if (!receipt) return undefined;
    const timer = window.setTimeout(() => window.print(), 0);
    return () => window.clearTimeout(timer);
  }, [receipt]);

  function openProductDetails(product, variants) {
    if (!variants.length) return;
    setQrProduct(normalizeProductDetails({ ...product, image: productImages[product.id] || productPhoto(product.name), variants }));
  }

  function add(product, variant, scanned = false) {
    if (loading) return;
    if (!variant?.stock) return setNotice('That size and color is out of stock.');
    if (cart.find(line => line.variant.id === variant.id)?.quantity >= variant.stock) return setNotice(`Only ${variant.stock} available for ${product.name}, ${variant.size} / ${variant.color}.`);
    setCart(items => { const line = items.find(item => item.variant.id === variant.id); return line ? items.map(item => item.variant.id === variant.id ? { ...item, quantity: Math.min(item.quantity + 1, variant.stock) } : item) : [...items, { product, variant, quantity: 1, discountCents: 0 }]; });
    setNotice(`${scanned ? 'Product found — ' : ''}${product.name}, ${variant.size} / ${variant.color}, ${money(variant.priceCents)} added.`);
  }
  function updateLine(variantId, patch) { setCart(lines => lines.map(line => { if (line.variant.id !== variantId) return line; const next = { ...line, ...patch }; const gross = next.variant.priceCents * next.quantity; next.discountCents = Math.min(Math.max(0, Number.isSafeInteger(next.discountCents) ? next.discountCents : 0), gross); return next; })); }
  async function resolveCode(code) {
    try {
      const result = await api.lookup(code);
      const matched = result.variants.find(variant => String(variant.id) === String(result.matchedVariantId));
      if (!matched) throw new Error('The matched product variant is unavailable.');
       if (result.identifierType === 'qr') { setQrProduct(normalizeProductDetails({ ...result, image: productImages[result.productId] || productPhoto(result.name) })); setNotice(`${result.name} product details opened.`); }
      else add({ id: result.productId, name: result.name }, { ...matched, stock: matched.quantity }, true);
    } catch (error) { setNotice(error.message || 'No product matched that barcode or QR code.'); }
  }
  resolveCodeRef.current = resolveCode;
  useEffect(() => {
    if (!remoteSessions.length) return undefined;
    let active = true;
    let polling = false;
    let currentToken = '';
    async function pollRemoteScans() {
      if (!active || polling) return;
      polling = true;
      try {
        for (const session of remoteSessions) {
          if (!active) break;
          currentToken = session.token;
          const result = await api.remoteScannerScans(session.token, remoteCursorsRef.current.get(session.token) ?? session.cursor);
          for (const scan of result.scans) {
            if (!active) break;
            remoteCursorsRef.current.set(session.token, Number(scan.id));
            saveRemoteScannerSessions(remoteSessionsRef.current, remoteCursorsRef.current);
            await resolveCodeRef.current(scan.code);
          }
        }
      } catch (error) {
        if (active && error.status === 404 && currentToken) { removeRemoteSession(currentToken); setNotice('Phone pairing is no longer available.'); }
      } finally { polling = false; }
    }
    pollRemoteScans();
    // shortcut: 700 ms polling, replace with a push channel if scan volume or latency requires it.
    const timer = window.setInterval(pollRemoteScans, 700);
    return () => { active = false; window.clearInterval(timer); };
  }, [remoteSessions]);
  function scan(event) { if (event.key !== 'Enter' || !event.currentTarget.value.trim() || loading) return; event.preventDefault(); const code = event.currentTarget.value.trim(); setQuery(''); resolveCode(code); }
  async function pairPhone() {
    if (remotePairBusy || remoteSessionsRef.current.length >= 2) return;
    setRemotePairBusy(true); setNotice('');
    try {
      const session = await api.createRemoteScanner();
      const paired = { ...session, token: session.token, cursor: 0, url: remoteScannerUrl(session.token) };
      remoteCursorsRef.current.set(paired.token, 0);
      updateRemoteSessions([...remoteSessionsRef.current, paired]); setRemoteDialogOpen(true);
    } catch (error) { setNotice(error.message || 'Phone pairing could not start.'); }
    finally { setRemotePairBusy(false); }
  }
  async function stopRemoteScanner(token) {
    try { await api.closeRemoteScanner(token); removeRemoteSession(token); setNotice('Phone pairing stopped.'); }
    catch (error) { if (error.status === 404) removeRemoteSession(token); setNotice(error.message || 'Phone pairing could not be stopped.'); }
  }
  function closeCamera() { setCameraOpen(false); requestAnimationFrame(() => document.querySelector('.camera-trigger')?.focus()); }
  function saveProductImage(productId, event) {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setNotice('Choose an image file.');
    if (file.size > 2_000_000) return setNotice('Use an image smaller than 2 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return setNotice('That image could not be read.');
      const next = { ...productImages, [productId]: reader.result };
      try { window.localStorage.setItem(productImageStorageKey, JSON.stringify(next)); setProductImages(next); setNotice('Product image saved on this device.'); }
      catch { setNotice('Image could not be saved. Use a smaller file.'); }
    };
    reader.onerror = () => setNotice('That image could not be read.');
    reader.readAsDataURL(file);
  }
  async function checkout() {
    if (!cart.length || !canPay || loading) return;
    setLoading(true);
    try {
      const sale = await api.checkout({ paymentMethod: 'cash', items: cart.map(line => ({ variantId: line.variant.id, quantity: line.quantity, discountCents: line.discountCents, discountReason: line.discountCents ? 'Item discount' : null })) });
      const balance = cashCents - sale.total_cents;
      const paymentMessage = balance >= 0 ? `Change: ${money(balance)}.` : `Cash short by ${money(-balance)}; verify the final price.`;
      setCart([]); setCashReceived(''); setReceipt(null);
      setNotice(`Sale #${sale.id} completed. ${paymentMessage}`);
      try { setReceipt({ ...(await api.receipt(sale.id)), cashReceivedCents: cashCents }); }
      catch { setNotice(`Sale #${sale.id} completed. ${paymentMessage} Receipt could not be loaded.`); searchRef.current?.scrollIntoView({ behavior: 'smooth' }); }
      try { setProducts(await api.products(query)); } catch { setCatalogError('Stock could not be refreshed.'); }
      onStockChanged?.();
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }

  return <>
    <header><div><h1>Point of sale</h1></div></header>
    {notice && <div className="notice" role="status"><span>{notice}</span><div className="notice-actions">{canPrintReceipt && <button type="button" className="notice-print" onClick={() => window.print()}>Print receipt</button>}<button type="button" className="notice-dismiss" onClick={() => setNotice('')} aria-label="Dismiss">×</button></div></div>}
    <div className="pos-grid">
      <section className="catalog">
        <div className="search-row"><div className="search"><span aria-hidden="true">⌕</span><input ref={searchRef} autoFocus aria-label="Search products or scan a code" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={scan} placeholder="Search products or scan a code…" disabled={loading} /><button type="button" className="search-clear" onClick={() => { setQuery(''); searchRef.current?.focus(); }} disabled={!query || loading} aria-label="Clear search">×</button></div><button type="button" className={filtersOpen ? 'filter-toggle active' : 'filter-toggle'} aria-label="Filter products" aria-expanded={filtersOpen} aria-controls="product-filters" title="Filter products" onClick={() => setFiltersOpen(open => !open)}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" /></svg></button><button type="button" className="low-stock-button" aria-label={`${lowStockCount} low-stock notifications`} aria-expanded={alertsOpen} title="Low-stock alerts" onClick={onOpenLowStock}><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>{lowStockCount > 0 && <b aria-hidden="true">{lowStockCount > 99 ? '99+' : lowStockCount}</b>}</button></div>
        {filtersOpen && <div id="product-filters" className="filter-row"><button className={sort === 'stock' ? 'filter active' : 'filter'} onClick={() => setSort('stock')}>In stock first</button><button className={sort === 'all' ? 'filter active' : 'filter'} onClick={() => setSort('all')}>All products</button><button className={sort === 'recent' ? 'filter active' : 'filter'} onClick={() => setSort('recent')}>Date added</button></div>}
        <div className="catalog-head"><h2>Products <small>{products.length} found</small></h2><div className="catalog-actions"><button className="scan scan-secondary" disabled={loading || remotePairBusy} onClick={() => remoteSessions.length ? setRemoteDialogOpen(true) : pairPhone()}>{remoteSessions.length ? 'Paired' : remotePairBusy ? 'Pairing…' : 'Pair phone'}</button><button className="scan camera-trigger" disabled={loading} onClick={() => setCameraOpen(true)}>Barcode Scanner</button></div></div>
        {catalogError && <p className="form-notice" role="alert">{catalogError}</p>}
        {!catalogError && catalogLoading && <p className="catalog-state" role="status">Loading products…</p>}
        {!catalogError && !catalogLoading && !visibleProducts.length && <p className="catalog-state">No active products matched that search.</p>}
        <div className="cards">{visibleProducts.map(product => {
          const variants = [...(product.variants || [])].sort((a, b) => {
            const aSize = SIZE_OPTIONS.indexOf(a.size); const bSize = SIZE_OPTIONS.indexOf(b.size);
            return a.color.localeCompare(b.color) || (aSize < 0 ? 99 : aSize) - (bSize < 0 ? 99 : bSize);
          });
          const onePrice = variants.length > 0 && variants.every(variant => variant.priceCents === variants[0].priceCents);
          const photo = productImages[product.id] || productPhoto(product.name);
          return <article className="product-card" key={product.id} role="button" tabIndex={0} aria-label={`View details for ${product.name}`} onClick={event => { if (event.target.closest?.('button, input, label, a, select, textarea')) return; openProductDetails(product, variants); }} onKeyDown={event => { if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return; event.preventDefault(); openProductDetails(product, variants); }}>
          <div className={photo ? 'product-art photo' : 'product-art'}>{photo ? <img src={photo} alt="" loading="lazy" /> : product.name.split(' ').slice(0, 2).map(word => word[0]).join('')}<label className="product-image-input" aria-label={photo ? 'Change product image' : 'Add product image'} title={photo ? 'Change product image' : 'Add product image'}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 4.5-4.5 3 3 2.5-2.5L20 17" /></svg><input type="file" accept="image/*" onChange={event => saveProductImage(product.id, event)} /></label></div>
          <div className="product-info"><h3>{product.name}</h3>{onePrice && <strong>{money(variants[0].priceCents)}</strong>}</div>
        </article>;
        })}</div>
      </section>
      <aside className="cart" ref={cartRef} aria-label="Current order">
        <div className="cart-title"><div><h2>Cart <span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="clear" onClick={() => { setCart([]); setCashReceived(''); }} disabled={!cart.length || loading}>Clear cart</button></div>
        <div className="cart-lines">{cart.length ? cart.map(line => <div className="line" key={line.variant.id}>
          <div className="line-art">{productImages[line.product.id] || productPhoto(line.product.name) ? <img src={productImages[line.product.id] || productPhoto(line.product.name)} alt="" /> : line.product.name[0]}</div>
          <div className="line-main"><b>{line.product.name}</b><small><strong>{line.variant.size}</strong> / {line.variant.color} · {money(line.variant.priceCents)} each</small>
            <div className="line-controls"><button type="button" disabled={loading || line.quantity === 1} onClick={() => updateLine(line.variant.id, { quantity: line.quantity - 1 })} aria-label={`Decrease ${line.product.name} ${line.variant.size} ${line.variant.color}`}>−</button><span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span><button type="button" disabled={loading || line.quantity >= line.variant.stock} onClick={() => updateLine(line.variant.id, { quantity: line.quantity + 1 })} aria-label={`Increase ${line.product.name} ${line.variant.size} ${line.variant.color}`}>+</button><button type="button" className="line-remove" disabled={loading} onClick={() => { setCart(lines => lines.filter(item => item.variant.id !== line.variant.id)); if (cart.length === 1) setCashReceived(''); }} aria-label={`Remove ${line.product.name} ${line.variant.size} ${line.variant.color}`}>Remove</button></div>
            <details className="line-discount"><summary>Discount{line.discountCents ? ` · −${money(line.discountCents)}` : ''}</summary><DiscountEditor line={line} disabled={loading} onChange={discountCents => updateLine(line.variant.id, { discountCents })} /></details>
          </div><b className="line-total">{money(line.variant.priceCents * line.quantity - line.discountCents)}</b>
        </div>) : <div className="empty"><span aria-hidden="true">⌁</span><b>Your cart is empty</b><p>Scan a barcode or choose a size and color to begin.</p></div>}</div>
        <div className="totals"><div><span>Subtotal</span><b>{money(totals.subtotal)}</b></div><div><span>Item discounts</span><b className="orange">−{money(totals.discount)}</b></div><div className="grand"><span>Total due</span><b>{money(totals.total)}</b></div>
          <div className="cash-entry"><label htmlFor="cash-received">Cash received</label><div><span aria-hidden="true">₱</span><input id="cash-received" inputMode="decimal" type="text" autoComplete="off" placeholder="0.00" value={cashReceived} onChange={event => setCashReceived(event.target.value)} disabled={!cart.length || loading} /><button type="button" className="secondary" disabled={!cart.length || loading} onClick={() => setCashReceived((totals.total / 100).toFixed(2))}>Exact</button></div></div>
          {cashReceived && !canPay && <p className="cash-hint" role="status">{cashCents === null ? 'Enter a valid amount with up to two decimals.' : `Still due: ${money(totals.total - cashCents)}`}</p>}
          {canPay && <div className="change-due" role="status"><span>Change to give</span><b>{money(cashCents - totals.total)}</b></div>}
          <button className="checkout" disabled={!cart.length || !canPay || loading} onClick={checkout}>{loading ? 'Processing…' : `Complete cash sale · ${money(totals.total)}`}</button>
        </div>
      </aside>
    </div>
    {!!cart.length && <button type="button" className="mobile-cart-link" onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>View cart · {money(totals.total)}</button>}
    {receipt && <Receipt receipt={receipt} />}
    {cameraOpen && <CameraScanner onClose={closeCamera} onDetected={code => { closeCamera(); resolveCode(code); }} />}
    {qrProduct && <ProductDetailsDialog product={qrProduct} onClose={() => setQrProduct(null)} onAdd={(product, variant) => { add(product, { ...variant, stock: variant.quantity }); setQrProduct(null); }} />}
    {remoteSessions.length > 0 && remoteDialogOpen && <RemoteScannerDialog sessions={remoteSessions} onClose={() => setRemoteDialogOpen(false)} onStop={stopRemoteScanner} onPair={pairPhone} pairBusy={remotePairBusy} />}
  </>;
}

function RemoteScannerDialog({ sessions, onClose, onStop, onPair, pairBusy }) {
  const closeRef = useRef(null); const dialogRef = useRef(null); const [qrCodes, setQrCodes] = useState({});
  useEffect(() => {
    let active = true;
    setQrCodes({});
    Promise.all(sessions.map(async session => {
      try { return [session.token, await QRCode.toDataURL(session.url, { errorCorrectionLevel: 'M', margin: 2, width: 240 })]; }
      catch { return [session.token, '']; }
    })).then(entries => { if (active) setQrCodes(Object.fromEntries(entries)); });
    closeRef.current?.focus();
    return () => { active = false; };
  }, [sessions]);
  return <div className="remote-scanner-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, dialogRef.current, onClose)}><section ref={dialogRef} className="remote-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="remote-scanner-title"><div className="camera-head"><div><h2 id="remote-scanner-title">Paired phone scanners</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><p>Open each phone camera and scan its QR code. Pairings stay active until you stop them or sign out.</p><div className="remote-scanner-devices">{sessions.map((session, index) => <article className="remote-scanner-device" key={session.token}><h3>Phone {index + 1}</h3>{qrCodes[session.token] ? <img className="remote-scanner-qr" src={qrCodes[session.token]} alt={`Phone ${index + 1} scanner pairing QR code`} /> : <p className="form-notice" role="alert">Pairing QR code could not be generated. Use the link below.</p>}<code className="remote-scanner-link">{session.url}</code><button className="secondary" onClick={() => onStop(session.token)}>Stop pairing</button></article>)}</div><div className="remote-scanner-actions">{sessions.length < 2 && <button className="secondary" disabled={pairBusy} onClick={onPair}>{pairBusy ? 'Pairing…' : 'Pair another phone'}</button>}<button className="checkout" onClick={onClose}>Done</button></div></section></div>;
}

function ProductDetailsDialog({ product, onClose, onAdd }) {
  const closeRef = useRef(null); const dialogRef = useRef(null); const returnFocusRef = useRef(document.activeElement);
  const [selectedId, setSelectedId] = useState(product.matchedVariantId);
  const selected = product.variants.find(variant => String(variant.id) === String(selectedId)) || product.variants[0];
  useEffect(() => { closeRef.current?.focus(); return () => returnFocusRef.current?.focus(); }, []);
  return <div className="product-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, dialogRef.current, onClose)}><section ref={dialogRef} className="product-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="product-detail-title"><div className="camera-head"><div><h2 id="product-detail-title">{product.name}</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div>{product.image && <img className="product-detail-image" src={product.image} alt={`${product.name} product`} /> }<div className="detail-summary"><b>{money(selected.priceCents)}</b></div><dl><div><dt>Size</dt><dd>{selected.size}</dd></div><div><dt>Color</dt><dd>{selected.color}</dd></div><div className={selected.quantity > selected.reorderPoint ? 'stock-status good' : 'stock-status low'}><dt>Available</dt><dd>{selected.quantity} pieces</dd></div></dl><div className="detail-variants" aria-label="Product variants">{product.variants.map(variant => { const selectedVariant = String(variant.id) === String(selected.id); return <button type="button" key={variant.id} className={selectedVariant ? 'selected' : ''} aria-pressed={selectedVariant} onClick={() => setSelectedId(variant.id)}><b>{variant.size}</b><span>{variant.color}</span></button>; })}</div><button className="checkout" disabled={!selected.quantity} onClick={() => onAdd({ id: product.productId, name: product.name }, selected)}>{selected.quantity ? `Add to cart · ${money(selected.priceCents)}` : 'Out of stock'}</button></section></div>;
}
