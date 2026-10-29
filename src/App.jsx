import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from './api.js';
import InventoryPanel from './InventoryPanel.jsx';
import { ReportsPanel, TeamPanel } from './AdminPanels.jsx';
import ProductPanel from './ProductPanel.jsx';
import SecurityPanel from './SecurityPanel.jsx';
import CameraScanner from './CameraScanner.jsx';
import Skeleton from './Skeleton.jsx';
import PasswordField from './PasswordField.jsx';
import { PASSWORD_PATTERN } from './password-rules.js';
import { code128Bars } from './barcode.js';
import { parseCashCents } from './pos-money.js';
import { normalizeProductDetails } from './product-details.js';
import { SIZE_OPTIONS } from './product-variants.js';
import { colorImageKey, getProductColorImages, getProductImage, getProductVariantImage, loadProductImages, PRODUCT_IMAGE_STORAGE_KEY, readProductImage } from './product-images.js';

const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100);
const productPhoto = name => name?.trim().toLowerCase().startsWith('augyew') ? `${import.meta.env.BASE_URL}images/augyew-graphic-tee-vintage-pos.png` : null;
function variantImage(product, variant) {
  return variant?.image || product.images?.[variant?.color] || product.colorImages?.[variant?.color] || product.image;
}
function variantImageFilter(color) {
  const value = String(color || '').toLowerCase();
  if (/white|ivory|cream/.test(value)) return { filter: 'grayscale(1) brightness(1.25)' };
  if (/black|gray|grey/.test(value)) return { filter: 'grayscale(1) brightness(.58) contrast(1.15)' };
  if (/navy|blue/.test(value)) return { filter: 'hue-rotate(165deg) saturate(1.4)' };
  return undefined;
}
const logoPath = `${import.meta.env.BASE_URL}images/letstockin-logo.png`;
const remoteScannerStorageKey = 'letstockin:remote-scanner-sessions';
const loginEmailStorageKey = 'letstockin:login-email';
function loadLoginEmail() {
  try { return window.localStorage.getItem(loginEmailStorageKey) || ''; } catch { return ''; }
}
function saveLoginEmail(email, remember) {
  try { remember ? window.localStorage.setItem(loginEmailStorageKey, email.trim()) : window.localStorage.removeItem(loginEmailStorageKey); } catch {}
}
const googleAuthMessages = {
  'google-not-configured': 'Google sign-in is not configured yet. Use email and password for now.',
  'google-cancelled': 'Google sign-in was cancelled.',
  'google-invalid-state': 'Google sign-in expired. Please try again.',
  'google-not-registered': 'This Google account is not registered. Ask an administrator to create your account first.',
  'google-account-conflict': "This Google account is linked to a different Let'StockIn account.",
  'google-failed': 'Google sign-in could not be completed. Try again or use email and password.'
};
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
      return { token: session.token, pairedAt: session.pairedAt || null, cursor: Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0, url: remoteScannerUrl(session.token) };
    });
  } catch { return []; }
}
function saveRemoteScannerSessions(sessions, cursors) {
  try { window.localStorage.setItem(remoteScannerStorageKey, JSON.stringify(sessions.map(session => ({ token: session.token, pairedAt: session.pairedAt || null, cursor: cursors.get(session.token) ?? session.cursor ?? 0 })))); } catch {}
}
const navigation = [['pos', 'Point of sale'], ['inventory', 'Inventory'], ['products', 'Products'], ['reports', 'Reports'], ['team', 'Team'], ['security', 'Security']];
const themeStorageKey = 'letstockin:theme';
function loadTheme() {
  try { return window.localStorage.getItem(themeStorageKey) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

function PosNavIcon() {
  return <svg className="nav-pos-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="2" width="15" height="11" rx="1.5" /><path d="M5.5 5h7M5.5 8h7M5.5 11h4M18 6h3v5h-3M9 13l-.5 3h4l-.5-3M3 17h18v5H3zM13 17v5" /><circle cx="16" cy="19" r=".8" fill="currentColor" stroke="none" /><circle cx="19" cy="19" r=".8" fill="currentColor" stroke="none" /><circle cx="16" cy="21" r=".8" fill="currentColor" stroke="none" /><circle cx="19" cy="21" r=".8" fill="currentColor" stroke="none" /></svg>;
}

function NavIcon({ id }) {
  if (id === 'pos') return <PosNavIcon />;
  if (id === 'products') return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10M7.5 5l9 4" /></svg>;
  if (id === 'inventory') return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor" fillRule="evenodd"><path d="M2 8.8 12 3l10 5.8V21H2V8.8Zm4.2 2.6v2.8h3v-2.8h-3Zm4.3 0v2.8h3v-2.8h-3Zm4.3 0v2.8h3v-2.8h-3Zm-9 6.1v1.8h13v-1.8h-13Z" /></svg>;
  if (id === 'reports') return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 16 8 11l4 4 7-8" /><path d="M16 7h3v3" /></svg>;
  if (id === 'team') return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><circle cx="8.5" cy="7.5" r="3" /><path d="M2 19c0-3.4 2.8-6 6.5-6s6.5 2.6 6.5 6v1H2v-1Z" /><circle cx="17.5" cy="7" r="2.4" /><path d="M14.5 13.4c.9-.5 1.9-.8 3-.8 2.6 0 4.5 1.9 4.5 4.7V20h-3v-1c0-2.2-.8-4.1-2.2-5.6-.7-.1-1.5-.1-2.3 0Z" /></svg>;
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5 20 5v6.2c0 5-3.2 8.4-8 10.3-4.8-1.9-8-5.3-8-10.3V5l8-2.5Z" /><rect x="8.2" y="10.5" width="7.6" height="5.5" rx=".8" /><path d="M10 10.5V9a2 2 0 0 1 4 0v1.5" /></svg>;
}

function Brand({ theme, onToggleTheme }) {
  return <div className="brand"><img className="brand-logo" src={logoPath} alt="" /><span className="brand-name">Let'StockIn</span>{onToggleTheme && <button type="button" className={theme === 'dark' ? 'theme-toggle is-dark' : 'theme-toggle'} aria-pressed={theme === 'dark'} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={onToggleTheme}><span className="theme-toggle-track" aria-hidden="true"><span className="theme-toggle-thumb">{theme === 'dark' ? '☾' : '☀'}</span></span></button>}</div>;
}

function SessionSkeleton() {
  return <main className="login-page"><section className="login-card session-skeleton" role="status" aria-label="Checking session" aria-busy="true"><Brand /><Skeleton className="skeleton-session-heading" /><Skeleton className="skeleton-session-line" /><Skeleton className="skeleton-session-field" /><Skeleton className="skeleton-session-field" /><Skeleton className="skeleton-session-button" /></section></main>;
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
  const [theme, setTheme] = useState(loadTheme);
  const resetRoute = window.location.pathname === '/reset-password';
  const authErrorCode = useMemo(() => new URLSearchParams(window.location.search).get('authError') || '', []);
  const authError = Object.prototype.hasOwnProperty.call(googleAuthMessages, authErrorCode) ? googleAuthMessages[authErrorCode] : '';
  const remoteScannerToken = useMemo(() => {
    const token = new URLSearchParams(window.location.search).get('remoteScanner') || '';
    return /^[a-f0-9]{64}$/.test(token) ? token : '';
  }, []);

  useEffect(() => {
    if (resetRoute || remoteScannerToken) { setChecking(false); return; }
    let active = true;
    const controller = new AbortController();
    api.me(controller.signal).then(currentUser => { if (active) { setUser(currentUser); setChecking(false); } }).catch(error => { if (active && error.name !== 'AbortError') { setUser(null); setChecking(false); } });
    return () => { active = false; controller.abort(); };
  }, [resetRoute, remoteScannerToken]);

  useEffect(() => {
    if (!authErrorCode) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('authError');
    window.history.replaceState({}, '', url.toString());
  }, [authErrorCode]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(themeStorageKey, theme); } catch {}
  }, [theme]);

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
  if (checking) return <SessionSkeleton />;
  if (!user) return <Login onLogin={setUser} initialError={authError} />;

  const allowed = user.role === 'admin' ? navigation : navigation.filter(([id]) => id === 'pos' || id === 'inventory' || id === 'security');
  function openInventory(alert) { setInventoryQuery(alert.name); setView('inventory'); setAlertsOpen(false); setNavOpen(false); }
  async function signOut() { await api.logout(); setUser(null); setAlerts([]); setView('pos'); setNavOpen(false); }

  return <main className="shell">
    <aside id="main-navigation" className={navOpen ? 'sidebar open' : 'sidebar'}><Brand theme={theme} onToggleTheme={() => setTheme(current => current === 'dark' ? 'light' : 'dark')} /><nav>{allowed.map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} onClick={() => { setView(id); setNavOpen(false); setAlertsOpen(false); }}><i><NavIcon id={id} /></i><b>{label}</b></button>)}</nav><div className="profile">{user.name}<br/><small>{user.role} account</small><button className="signout" onClick={signOut}>Sign out</button></div></aside>
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
    let active = true;
    api.remoteScannerPair(token).catch(cause => {
      if (!active) return;
      setError(cause.message || 'This phone pairing is no longer available.');
      if (cause.status === 404) setPaired(false);
    });
    return () => { active = false; };
  }, [token]);

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

function Login({ onLogin, initialError = '' }) {
  const [email, setEmail] = useState(loadLoginEmail); const [password, setPassword] = useState(''); const [remember, setRemember] = useState(true); const [error, setError] = useState(initialError); const [busy, setBusy] = useState(false); const [resetMode, setResetMode] = useState(false); const [mfaChallenge, setMfaChallenge] = useState('');
  function finishLogin(result) { saveLoginEmail(email, remember); onLogin(result); }
  async function submit(event) { event.preventDefault(); setBusy(true); setError(''); try { const result = await api.login({ email, password, remember }); if (result.mfaRequired) { setMfaChallenge(result.challenge); return; } finishLogin(result); } catch (cause) { setError(cause.message); } finally { setBusy(false); } }
  if (mfaChallenge) return <MfaLogin challenge={mfaChallenge} remember={remember} onLogin={finishLogin} onBack={() => setMfaChallenge('')} />;
  if (resetMode) return <PasswordResetRequest onBack={() => setResetMode(false)} />;
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Sign in</h1><div className="login-options"><a className="google-sign-in" href={api.googleLoginUrl()}><span className="google-logo-tile" aria-hidden="true"><svg className="google-logo" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.651 32.657 29.119 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20c10.493 0 19.386-7.613 19.386-20 0-1.341-.138-2.651-.389-3.917Z" /><path fill="#FF3D00" d="M6.306 14.691 12.878 19.51C14.654 15.113 18.967 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.278 4 24 4c-7.682 0-14.325 4.337-17.694 10.691Z" /><path fill="#4CAF50" d="M24 44c5.182 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.099 0-9.616-3.317-11.386-7.686l-6.522 5.025C9.505 39.556 16.227 44 24 44Z" /><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.57l.003-.002 6.19 5.238C36.973 39.205 44 34 44 24c0-1.341-.138-2.651-.389-3.917Z" /></svg></span>Continue with Google</a><div className="login-divider"><span>or use email and password</span></div></div><label className="field">Email<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label><PasswordField label="Password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /><label className="remember-field" htmlFor="remember-me"><input id="remember-me" name="remember" type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} /><span>Remember me</span></label>{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button><button type="button" className="secondary login-link" onClick={() => { setError(''); setResetMode(true); }}>Forgot password?</button></form></main>;
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
  return <main className="login-page"><form className="login-card" onSubmit={submit}><Brand /><h1>Choose a new password</h1><p>Use 8-50 characters with uppercase, lowercase, number, and symbol. This link can only be used once.</p><PasswordField label="New password" required minLength={8} maxLength={50} pattern={PASSWORD_PATTERN} title="Use 8-50 characters with uppercase, lowercase, number, and symbol." autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} showRequirements /><PasswordField label="Confirm password" required minLength={8} maxLength={50} pattern={PASSWORD_PATTERN} title="Use 8-50 characters with uppercase, lowercase, number, and symbol." autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} />{error && <p className="form-notice" role="alert">{error}</p>}<button className="checkout" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></main>;
}

function Receipt({ receipt }) {
  const bars = code128Bars(`SALE-${receipt.id}`);
  const barcodeWidth = bars.reduce((total, bar) => total + bar.width * 2, 0) + 24;
  const receiptDate = new Date(receipt.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });
  let barcodeX = 12;
  return <section className="receipt" aria-label={`Receipt for sale ${receipt.id}`}>
    <div className="receipt-paper">
      <div className="receipt-title"><h2>Cash Receipt</h2><p>Let'StockIn</p></div>
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

function ProductCardSkeleton() {
  return <article className="product-card product-skeleton-card" aria-hidden="true"><Skeleton className="skeleton-product-art" /><div className="product-info"><Skeleton className="skeleton-product-title" /><Skeleton className="skeleton-product-price" /></div></article>;
}

function PosPanel({ onStockChanged, lowStockCount, alertsOpen, onOpenLowStock }) {
  const [products, setProducts] = useState([]); const [query, setQuery] = useState(''); const [cart, setCart] = useState([]); const [notice, setNotice] = useState(''); const [loading, setLoading] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState(''); const [receipt, setReceipt] = useState(null); const [sort, setSort] = useState('stock'); const [cameraOpen, setCameraOpen] = useState(false); const [qrProduct, setQrProduct] = useState(null); const [remoteSessions, setRemoteSessions] = useState(loadRemoteScannerSessions); const [remoteDialogOpen, setRemoteDialogOpen] = useState(false); const [remotePairBusy, setRemotePairBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [productImages, setProductImages] = useState(loadProductImages);
  const [cashReceived, setCashReceived] = useState('');
  const searchRef = useRef(null); const cartRef = useRef(null); const remoteSessionsRef = useRef(remoteSessions); const remoteCursorsRef = useRef(new Map(remoteSessions.map(session => [session.token, session.cursor]))); const resolveCodeRef = useRef(null);
  useEffect(() => { const refreshImages = () => setProductImages(loadProductImages()); window.addEventListener('letstockin:product-images-updated', refreshImages); return () => window.removeEventListener('letstockin:product-images-updated', refreshImages); }, []);
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
    const images = loadProductImages();
    setQrProduct(normalizeProductDetails({ ...product, image: images[product.id] || productPhoto(product.name), colorImages: getProductColorImages(product.id, variants, images), variants }));
  }

  function add(product, variant, scanned = false, requestedQuantity = 1) {
    if (loading) return;
    if (!variant?.stock) return setNotice('That size and color is out of stock.');
    const quantity = Math.max(1, Number(requestedQuantity) || 1);
    const existing = cart.find(line => line.variant.id === variant.id);
    if ((existing?.quantity || 0) + quantity > variant.stock) return setNotice(`Only ${variant.stock} available for ${product.name}, ${variant.size} / ${variant.color}.`);
    setCart(items => { const line = items.find(item => item.variant.id === variant.id); return line ? items.map(item => item.variant.id === variant.id ? { ...item, quantity: item.quantity + quantity } : item) : [...items, { product, variant, quantity, discountCents: 0 }]; });
    setNotice(`${scanned ? 'Product found — ' : ''}${product.name}, ${variant.size} / ${variant.color}, ${money(variant.priceCents * quantity)} added.`);
    return true;
  }
  function updateLine(variantId, patch) { setCart(lines => lines.map(line => { if (line.variant.id !== variantId) return line; const next = { ...line, ...patch }; const gross = next.variant.priceCents * next.quantity; next.discountCents = Math.min(Math.max(0, Number.isSafeInteger(next.discountCents) ? next.discountCents : 0), gross); return next; })); }
  async function resolveCode(code) {
    try {
      const result = await api.lookup(code);
      const matched = result.variants.find(variant => String(variant.id) === String(result.matchedVariantId));
      if (!matched) throw new Error('The matched product variant is unavailable.');
       if (result.identifierType === 'qr') { const images = loadProductImages(); setQrProduct(normalizeProductDetails({ ...result, image: images[result.productId] || productPhoto(result.name), colorImages: getProductColorImages(result.productId, result.variants, images) })); setNotice(`${result.name} product details opened.`); }
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
          const pairedAt = result.pairedAt || null;
          if (pairedAt !== (session.pairedAt || null)) updateRemoteSessions(remoteSessionsRef.current.map(item => item.token === session.token ? { ...item, pairedAt } : item));
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
  function saveProductImage(productId, event, color = '') {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setNotice('Choose an image file.');
    if (file.size > 2_000_000) return setNotice('Use an image smaller than 2 MB.');
    readProductImage(file).then(image => {
      const key = color ? colorImageKey(productId, color) : productId;
      const next = { ...productImages, [key]: image };
      try {
        window.localStorage.setItem(PRODUCT_IMAGE_STORAGE_KEY, JSON.stringify(next));
        setProductImages(next);
        setQrProduct(current => {
          if (!current || String(current.productId) !== String(productId)) return current;
          return color ? { ...current, colorImages: { ...(current.colorImages || {}), [color]: image } } : { ...current, image };
        });
        setNotice('Product image saved on this device.');
      }
      catch { setNotice('Image could not be saved. Use a smaller file.'); }
    }).catch(error => setNotice(error.message));
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
        <div className="catalog-head"><h2>Products <small>{products.length} found</small></h2><div className="catalog-actions"><button className="scan scan-secondary" disabled={loading || remotePairBusy} onClick={() => remoteSessions.length ? setRemoteDialogOpen(true) : pairPhone()}>{remoteSessions.length ? `Show phone${remoteSessions.length > 1 ? 's' : ''}` : remotePairBusy ? 'Pairing…' : 'Pair phone'}</button><button className="scan camera-trigger" disabled={loading} onClick={() => setCameraOpen(true)}>Barcode Scanner</button></div></div>
        {catalogError && <p className="form-notice" role="alert">{catalogError}</p>}
        {!catalogError && !catalogLoading && !visibleProducts.length && <p className="catalog-state">No active products matched that search.</p>}
        {!catalogError && catalogLoading && <div className="cards product-skeletons" role="status" aria-label="Loading products" aria-busy="true">{Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)}</div>}
        {!catalogError && !catalogLoading && <div className="cards">{visibleProducts.map(product => {
          const variants = [...(product.variants || [])].sort((a, b) => {
            const aSize = SIZE_OPTIONS.indexOf(a.size); const bSize = SIZE_OPTIONS.indexOf(b.size);
            return a.color.localeCompare(b.color) || (aSize < 0 ? 99 : aSize) - (bSize < 0 ? 99 : bSize);
          });
          const lowestPrice = variants.length ? Math.min(...variants.map(variant => variant.priceCents)) : null;
          const photo = getProductImage(product.id, variants, productImages) || productPhoto(product.name);
          return <article className="product-card" key={product.id} role="button" tabIndex={0} aria-label={`View details for ${product.name}`} onClick={event => { if (event.target.closest?.('button, input, label, a, select, textarea')) return; openProductDetails(product, variants); }} onKeyDown={event => { if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return; event.preventDefault(); openProductDetails(product, variants); }}>
          <div className={photo ? 'product-art photo' : 'product-art'}>{photo ? <img src={photo} alt="" loading="lazy" /> : product.name.split(' ').slice(0, 2).map(word => word[0]).join('')}{!photo && <label className="product-image-input" aria-label="Add product image" title="Add product image"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 4.5-4.5 3 3 2.5-2.5L20 17" /></svg><input type="file" accept="image/*" onChange={event => saveProductImage(product.id, event)} /></label>}</div>
          <div className="product-info"><h3>{product.name}</h3>{lowestPrice != null && <strong>{money(lowestPrice)}</strong>}</div>
        </article>;
        })}</div>}
      </section>
      <aside className="cart" ref={cartRef} aria-label="Current order">
        <div className="cart-title"><div><h2>Cart <span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="clear" onClick={() => { setCart([]); setCashReceived(''); }} disabled={!cart.length || loading}>Clear cart</button></div>
        <div className="cart-lines">{cart.length ? cart.map(line => <div className="line" key={line.variant.id}>
          <div className="line-art">{getProductVariantImage(line.product.id, line.variant, productImages) || productPhoto(line.product.name) ? <img src={getProductVariantImage(line.product.id, line.variant, productImages) || productPhoto(line.product.name)} alt="" /> : line.product.name[0]}</div>
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
    {qrProduct && <ProductDetailsDialog product={qrProduct} onClose={() => setQrProduct(null)} onImageChange={(event, color) => saveProductImage(qrProduct.productId, event, color)} onAdd={(product, variant, quantity) => { if (add(product, { ...variant, stock: variant.quantity }, false, quantity)) setQrProduct(null); }} />}
    {remoteSessions.length > 0 && remoteDialogOpen && <RemoteScannerDialog sessions={remoteSessions} onClose={() => setRemoteDialogOpen(false)} onStop={stopRemoteScanner} onPair={pairPhone} pairBusy={remotePairBusy} />}
  </>;
}

function RemoteScannerDialog({ sessions, onClose, onStop, onPair, pairBusy }) {
  const closeRef = useRef(null); const dialogRef = useRef(null); const [qrCodes, setQrCodes] = useState({});
  useEffect(() => {
    let active = true;
    setQrCodes({});
    Promise.all(sessions.filter(session => !session.pairedAt).map(async session => {
      try { return [session.token, await QRCode.toDataURL(session.url, { errorCorrectionLevel: 'M', margin: 2, width: 240 })]; }
      catch { return [session.token, '']; }
    })).then(entries => { if (active) setQrCodes(Object.fromEntries(entries)); });
    closeRef.current?.focus();
    return () => { active = false; };
  }, [sessions]);
  return <div className="remote-scanner-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, dialogRef.current, onClose)}><section ref={dialogRef} className="remote-scanner-dialog" role="dialog" aria-modal="true" aria-labelledby="remote-scanner-title"><div className="camera-head"><div><h2 id="remote-scanner-title">Paired phone scanners</h2></div><button ref={closeRef} className="secondary" onClick={onClose}>Close</button></div><p>Open each phone camera and scan its QR code. Pairings stay active until you stop them or sign out.</p><div className="remote-scanner-devices">{sessions.map((session, index) => <article className="remote-scanner-device" key={session.token}><h3>Phone {index + 1}{session.pairedAt ? ' PAIRED' : ''}</h3>{!session.pairedAt && <>{qrCodes[session.token] ? <img className="remote-scanner-qr" src={qrCodes[session.token]} alt={`Phone ${index + 1} scanner pairing QR code`} /> : <p className="form-notice" role="alert">Pairing QR code could not be generated. Use the link below.</p>}<code className="remote-scanner-link">{session.url}</code></>}<button className="secondary" onClick={() => onStop(session.token)}>Stop pairing</button></article>)}</div><div className="remote-scanner-actions">{sessions.length < 2 && <button className="secondary" disabled={pairBusy} onClick={onPair}>{pairBusy ? 'Pairing…' : 'Pair another phone'}</button>}<button className="checkout" onClick={onClose}>Done</button></div></section></div>;
}

function ProductDetailsDialog({ product, onClose, onImageChange, onAdd }) {
  const closeRef = useRef(null); const dialogRef = useRef(null); const returnFocusRef = useRef(document.activeElement);
  const [selectedId, setSelectedId] = useState(product.matchedVariantId);
  const [quantity, setQuantity] = useState(1);
  const selected = product.variants.find(variant => String(variant.id) === String(selectedId)) || product.variants[0];
  const colors = [...new Map(product.variants.map(variant => [variant.color, product.variants.filter(item => item.color === variant.color)])).entries()];
  const colorVariants = product.variants.filter(variant => variant.color === selected.color);
  const selectedImage = variantImage(product, selected);
  const priceFrom = Math.min(...product.variants.map(variant => variant.priceCents));
  useEffect(() => { closeRef.current?.focus(); return () => returnFocusRef.current?.focus(); }, []);
  useEffect(() => { setQuantity(1); }, [selectedId]);
  function chooseColor(variants) { setSelectedId((variants.find(variant => variant.quantity > 0) || variants[0]).id); }
  return <div className="product-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => handleDialogKeys(event, dialogRef.current, onClose)}><section ref={dialogRef} className="product-detail-dialog pos-product-picker" role="dialog" aria-modal="true" aria-labelledby="product-detail-title"><div className="product-picker-head"><h2 id="product-detail-title">{product.name}</h2><button ref={closeRef} className="product-picker-close" onClick={onClose} aria-label="Close product details">×</button></div><div className="product-picker-summary"><div className="product-picker-image">{selectedImage ? <img src={selectedImage} style={!selected.image && !product.images?.[selected.color] && !product.colorImages?.[selected.color] ? variantImageFilter(selected.color) : undefined} alt={`${product.name} ${selected.color}`} /> : <span>{product.name.split(' ').slice(0, 2).map(word => word[0]).join('')}</span>}<label className="product-image-input" aria-label={selectedImage ? 'Change product image' : 'Add product image'} title={selectedImage ? 'Change product image' : 'Add product image'}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4 17 4.5-4.5 3 3 2.5-2.5L20 17" /></svg><input type="file" accept="image/*" onChange={event => onImageChange(event, selected.color)} /></label></div><div className="product-picker-price"><b>{money(priceFrom)}</b><small>Stock: {selected.quantity}</small></div></div><section className="product-picker-section" aria-labelledby="color-heading"><h3 id="color-heading">Color</h3><div className="product-color-choices">{colors.map(([color, variants]) => { const active = color === selected.color; const colorVariant = variants[0]; const image = variantImage(product, colorVariant); return <button type="button" key={color} className={active ? 'selected' : ''} aria-pressed={active} onClick={() => chooseColor(variants)}><span className="product-color-image">{image ? <img src={image} style={!colorVariant.image && !product.images?.[color] && !product.colorImages?.[color] ? variantImageFilter(color) : undefined} alt="" /> : color}</span><span>{color}</span></button>; })}</div></section><section className="product-picker-section" aria-labelledby="size-heading"><h3 id="size-heading">Size</h3><div className="product-size-choices" role="group" aria-label={`Sizes for ${selected.color}`}>{colorVariants.map(variant => { const active = String(variant.id) === String(selected.id); return <button type="button" key={variant.id} className={`${active ? 'selected ' : ''}${variant.quantity ? 'available' : 'out-of-stock'}`} aria-pressed={active} disabled={!variant.quantity} onClick={() => setSelectedId(variant.id)}><span>{variant.size}</span></button>; })}</div></section><section className="product-picker-quantity" aria-labelledby="quantity-heading"><h3 id="quantity-heading">Quantity</h3><div className="quantity-control"><button type="button" disabled={quantity <= 1} onClick={() => setQuantity(value => value - 1)} aria-label="Decrease quantity">−</button><input className="quantity-input" type="number" min="1" max={selected.quantity} step="1" value={quantity} disabled={!selected.quantity} onChange={event => setQuantity(Math.min(selected.quantity, Math.max(1, Number(event.target.value) || 1)))} aria-label="Quantity" /><button type="button" disabled={quantity >= selected.quantity} onClick={() => setQuantity(value => value + 1)} aria-label="Increase quantity">+</button></div></section><button className="checkout product-picker-submit" disabled={!selected.quantity} onClick={() => onAdd({ id: product.productId, name: product.name }, selected, quantity)}><span>{selected.quantity ? 'Add to cart' : 'Out of stock'}</span><small>{selected.quantity ? money(selected.priceCents * quantity) : ''}</small></button></section></div>;
}
