import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import Skeleton from './Skeleton.jsx';
import ReturnsPanel from './ReturnsPanel.jsx';

const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100);

function ReportChartSkeleton() {
  return <div className="sales-chart sales-chart-skeleton" role="status" aria-label="Loading chart" aria-busy="true">{Array.from({ length: 12 }, (_, index) => <div className="chart-column" key={index}><Skeleton className="chart-skeleton-bar" /><Skeleton className="chart-skeleton-label" /></div>)}</div>;
}

export function ReportsPanel() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const [period, setPeriod] = useState('daily');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setReport(await api.salesReport({ period, from, to, page, pageSize: 25 })); }
    catch (cause) { setError(cause.message || 'Reports could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [period, from, to, page]);

  const summary = report?.summary;
  const cards = [['Gross sales', summary ? money(summary.grossSalesCents) : '—'], ['Discounts', summary ? money(summary.discountCents) : '—'], ['Refunds', summary ? money(summary.refundCents) : '—'], ['Net sales', summary ? money(summary.netSalesCents) : '—'], ['Orders', summary?.orderCount ?? '—'], ['Units sold', summary?.unitsSold ?? '—'], ['Units returned', summary?.unitsReturned ?? '—']];
  const maxValue = Math.max(1, ...(report?.series || []).map(point => Math.abs(point.netSalesCents)));
  const emptyActivity = loading ? 'Loading sales activity…' : error ? 'Sales activity is unavailable.' : 'No sales or refunds in this period.';
  function choosePeriod(next) { setPeriod(next); setPage(1); }

  return <>
    <section className="admin-heading"><h1>Reports & analytics</h1></section>
    <section className="report-controls" aria-label="Report period"><div className="period-tabs">{[['daily', 'Today'], ['weekly', 'This week'], ['monthly', 'This month'], ['custom', 'Custom range']].map(([value, label]) => <button key={value} className={period === value ? 'active' : ''} onClick={() => choosePeriod(value)}>{label}</button>)}</div>{period === 'custom' && <div className="date-range"><label className="field">From<input type="date" value={from} max={to} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label><label className="field">To<input type="date" value={to} min={from} onChange={event => { setTo(event.target.value); setPage(1); }} /></label></div>}{report?.range && <p>{new Date(report.range.from).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })} to {new Date(report.range.to).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })} · {report.range.timeZone}</p>}</section>
    {error && <p className="form-notice" role="alert">{error}</p>}
    <section className="metric-grid" aria-busy={loading}>{cards.map(([label, value]) => <article key={label}><span>{label}</span><b>{loading ? <Skeleton className="skeleton-metric-value" /> : value}</b></article>)}</section>
    <section className="data-panel sales-chart-panel"><h2>Daily net sales</h2>{loading ? <ReportChartSkeleton /> : report?.series?.length ? <div className="sales-chart" role="img" aria-label="Daily net sales bar chart">{report.series.map(point => <div className="chart-column" key={point.date} title={`${point.date}: ${money(point.netSalesCents)}`}><span className={point.netSalesCents < 0 ? 'chart-bar negative' : 'chart-bar'} style={{ height: `${Math.max(3, Math.abs(point.netSalesCents) / maxValue * 100)}%` }} /><small>{report.series.length <= 14 ? point.date.slice(5) : new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}</small></div>)}</div> : <p className="blank">No sales data for this period.</p>}</section>
    <Panel title="Sales and refund activity" loading={loading} skeletonColumns={6}><table><thead><tr><th>Type</th><th>Reference</th><th>Date</th><th>Staff</th><th>Units</th><th>Total</th></tr></thead><tbody>{report?.activities?.length ? report.activities.map(activity => <tr key={`${activity.type}-${activity.id}`}><td><span className={`activity-type ${activity.type}`}>{activity.type}</span></td><td>Sale #{activity.saleId}</td><td>{new Date(activity.occurredAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: report.range.timeZone })}</td><td>{activity.staffName || '—'}</td><td>{activity.units}</td><td><b className={activity.totalCents < 0 ? 'negative-money' : ''}>{money(activity.totalCents)}</b></td></tr>) : <Empty colSpan={6} text={emptyActivity} />}</tbody></table>{report?.pagination?.totalPages > 1 && <div className="pagination"><button className="secondary" disabled={page <= 1 || loading} onClick={() => setPage(current => current - 1)}>Previous</button><span>Page {page} of {report.pagination.totalPages}</span><button className="secondary" disabled={page >= report.pagination.totalPages || loading} onClick={() => setPage(current => current + 1)}>Next</button></div>}</Panel>
    <ReturnsPanel onReturned={load} />
  </>;
}

export function TeamPanel() {
  const [users, setUsers] = useState([]);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState('staff');
  const [notice, setNotice] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [deleteBusy, setDeleteBusy] = useState(null);

  async function load() { setLoading(true); try { setUsers(await api.users()); setError(''); } catch (cause) { setUsers([]); setError(cause.message || 'Team accounts could not be loaded.'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function invite(event) { event.preventDefault(); setNotice(''); try { const user = await api.createUser({ name, email, password, role }); setUsers(current => [...current, user]); setError(''); setName(''); setEmail(''); setPassword(''); setNotice('Account created. Give the password to the team member securely.'); } catch (cause) { setNotice(cause.message || 'Account could not be created.'); } }
  async function remove(user) {
    if (!window.confirm(`Delete ${user.name}? This temporary testing action cannot be undone.`)) return;
    setDeleteBusy(user.id); setNotice(''); setError('');
    try { await api.deleteUser(user.id); setUsers(current => current.filter(entry => entry.id !== user.id)); setNotice('Team account deleted.'); }
    catch (cause) { setError(cause.message || 'Account could not be deleted.'); }
    finally { setDeleteBusy(null); }
  }

  const emptyUsers = loading ? 'Loading team accounts…' : error ? 'Team accounts are unavailable.' : 'No team accounts yet.';
  return <><section className="admin-heading"><h1>Team accounts</h1></section>{error && <p className="form-notice" role="alert">{error}</p>}<section className="team-layout"><Panel title="Staff and admins" loading={loading} skeletonColumns={5}><table><thead><tr><th>Team member</th><th>Email</th><th>Role</th><th>Created</th><th>Actions</th></tr></thead><tbody>{users.length ? users.map(user => <tr key={user.id}><td><b>{user.name}</b></td><td>{user.email}</td><td><span className={`role ${user.role}`}>{user.role}</span></td><td>{new Date(user.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })}</td><td><button type="button" className="remove status-toggle" disabled={deleteBusy === user.id} onClick={() => remove(user)}>{deleteBusy === user.id ? 'Deleting…' : 'Delete'}</button></td></tr>) : <Empty colSpan={5} text={emptyUsers} />}</tbody></table></Panel><form className="invite-form" onSubmit={invite}><h2>Add team member</h2><label className="field">Name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="Jordan Lee" /></label><label className="field">Email<input required type="email" maxLength={320} value={email} onChange={event => setEmail(event.target.value)} placeholder="jordan@example.com" /></label><label className="field">Password<input required type="password" minLength={12} maxLength={256} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field">Role<select value={role} onChange={event => setRole(event.target.value)}><option value="staff">Staff</option><option value="admin">Admin</option></select></label>{notice && <p className="form-notice" role="status">{notice}</p>}<button className="checkout">Create account</button></form></section></>;
}

function Panel({ title, children, loading = false, skeletonColumns = 4 }) { return <section className="data-panel"><h2>{title}</h2><div className="table-scroll" aria-busy={loading}>{loading ? <><span className="sr-only" role="status">Loading {title}…</span><table className="skeleton-table" aria-hidden="true"><tbody>{Array.from({ length: 5 }, (_, rowIndex) => <tr key={rowIndex}>{Array.from({ length: skeletonColumns }, (_, cellIndex) => <td key={cellIndex}><Skeleton className={cellIndex === 0 ? "skeleton-table-line wide" : "skeleton-table-line medium"} /></td>)}</tr>)}</tbody></table></> : children}</div></section>; }
function Empty({ colSpan, text }) { return <tr><td colSpan={colSpan} className="blank">{text}</td></tr>; }
