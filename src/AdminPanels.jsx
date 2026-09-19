import { useEffect, useState } from 'react';
import { api } from './api.js';
import ReturnsPanel from './ReturnsPanel.jsx';

const money = cents => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);

export function ReportsPanel() {
  const [overview, setOverview] = useState(null);
  const [sales, setSales] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [nextOverview, nextSales, nextAlerts] = await Promise.all([api.overview(), api.sales(), api.lowStock()]);
      setOverview(nextOverview); setSales(nextSales); setAlerts(nextAlerts);
    } catch (cause) { setError(cause.message || 'Reports could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const cards = [['Net sales today', overview ? money(overview.todaySalesCents) : '—'], ['Orders today', overview?.todayOrders ?? '—'], ['Low-stock variants', overview?.lowStockCount ?? '—'], ['Units in stock', overview?.unitsInStock ?? '—']];
  const emptySales = loading ? 'Loading transactions...' : error ? 'Transactions are unavailable.' : 'No completed sales yet.';
  const emptyAlerts = loading ? 'Loading stock alerts...' : error ? 'Stock alerts are unavailable.' : 'All stocked variants are above their reorder points.';
  return <>
    <section className="admin-heading"><p className="eyebrow">Sales intelligence</p><h1>Reports & analytics</h1><p>Track today’s retail performance and stock that needs attention.</p></section>
    {error && <p className="form-notice" role="alert">{error}</p>}
    <section className="metric-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><b>{value}</b></article>)}</section>
    <section className="admin-grid"><Panel title="Recent transactions"><table><thead><tr><th>Sale</th><th>Staff</th><th>Items</th><th>Total</th></tr></thead><tbody>{sales.length ? sales.slice(0, 6).map(s => <tr key={s.id}><td>#{s.id}</td><td>{s.staffName || '—'}</td><td>{s.itemCount}</td><td><b>{money(s.totalCents)}</b></td></tr>) : <Empty colSpan={4} text={emptySales} />}</tbody></table></Panel><Panel title="Low-stock alerts"><div className="alert-list">{alerts.length ? alerts.map(a => <div key={a.variantId}><span><b>{a.name}</b><small>Size {a.size} · reorder at {a.reorder_point}</small></span><strong>{a.quantity} left</strong></div>) : <p className="blank">{emptyAlerts}</p>}</div></Panel></section>
    <ReturnsPanel onReturned={load} />
  </>;
}

export function TeamPanel() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('staff');
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setUsers(await api.users()); setError(''); }
    catch (cause) { setUsers([]); setError(cause.message || 'Team accounts could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function invite(event) {
    event.preventDefault(); setNotice('');
    try { const user = await api.createUser({ name, email, password, role }); setUsers(current => [...current, user]); setError(''); setName(''); setEmail(''); setPassword(''); setNotice('Account created. Give the password to the team member securely.'); }
    catch (cause) { setNotice(cause.message || 'Account could not be created.'); }
  }

  const emptyUsers = loading ? 'Loading team accounts...' : error ? 'Team accounts are unavailable.' : 'No team accounts yet.';
  return <><section className="admin-heading"><p className="eyebrow">Access control</p><h1>Team accounts</h1><p>Staff operate checkout; administrators manage inventory, reports, products, and permissions.</p></section>{error && <p className="form-notice" role="alert">{error}</p>}<section className="team-layout"><Panel title="Staff and admins"><table><thead><tr><th>Team member</th><th>Email</th><th>Role</th><th>Created</th></tr></thead><tbody>{users.length ? users.map(user => <tr key={user.id}><td><b>{user.name}</b></td><td>{user.email}</td><td><span className={`role ${user.role}`}>{user.role}</span></td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>) : <Empty colSpan={4} text={emptyUsers} />}</tbody></table></Panel><form className="invite-form" onSubmit={invite}><h2>Add team member</h2><label className="field">Name<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Lee" /></label><label className="field">Email<input required type="email" maxLength={320} value={email} onChange={e => setEmail(e.target.value)} placeholder="jordan@example.com" /></label><label className="field">Password<input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label><label className="field">Role<select value={role} onChange={e => setRole(e.target.value)}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>{notice && <p className="form-notice" role="status">{notice}</p>}<button className="checkout">Create account</button></form></section></>;
}

function Panel({ title, children }) { return <section className="data-panel"><h2>{title}</h2><div className="table-scroll">{children}</div></section>; }
function Empty({ colSpan, text }) { return <tr><td colSpan={colSpan} className="blank">{text}</td></tr>; }
