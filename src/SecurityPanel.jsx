import React, { useEffect, useState } from 'react';
import { api } from './api.js';

export default function SecurityPanel() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try { setStatus(await api.mfaStatus()); setError(''); }
    catch (cause) { setError(cause.message || 'Security settings could not be loaded.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function startSetup(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { setSetup(await api.startMfaSetup(password)); setPassword(''); }
    catch (cause) { setError(cause.message || 'MFA setup could not start.'); }
    finally { setBusy(false); }
  }

  async function confirmSetup(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.confirmMfaSetup(code);
      setSetup(null); setRecoveryCodes(result.recoveryCodes); setCode('');
      setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length });
      setNotice('MFA is enabled. Save these recovery codes before leaving this page.');
    } catch (cause) { setError(cause.message || 'MFA setup could not be completed.'); }
    finally { setBusy(false); }
  }

  async function rotateCodes(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.rotateMfaRecoveryCodes({ password, code });
      setRecoveryCodes(result.recoveryCodes); setPassword(''); setCode('');
      setStatus(current => ({ ...current, recoveryCodesRemaining: result.recoveryCodes.length }));
      setNotice('Old recovery codes are no longer valid. Save the new set.');
    } catch (cause) { setError(cause.message || 'Recovery codes could not be regenerated.'); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(''); setNotice('');
    try {
      await api.disableMfa({ password, code });
      setStatus({ enabled: false, recoveryCodesRemaining: 0 }); setPassword(''); setCode(''); setRecoveryCodes([]);
      setNotice('MFA is disabled.');
    } catch (cause) { setError(cause.message || 'MFA could not be disabled.'); }
    finally { setBusy(false); }
  }

  if (loading) return <section className="data-panel security-panel"><h2>Security</h2><div className="security-content"><p>Loading security settings…</p></div></section>;
  return <>
    <section className="admin-heading"><p className="eyebrow">Account protection</p><h1>Security</h1><p>Use an authenticator app as a second factor when signing in.</p></section>
    <section className="data-panel security-panel">
      <h2>Authenticator app</h2>
      <div className="security-content">
        {error && <p className="form-notice" role="alert">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {!status?.enabled && !setup && <form onSubmit={startSetup}>
          <p>MFA is not enabled for this account.</p>
          <label className="field">Current password<input required type="password" autoComplete="current-password" minLength="12" maxLength="256" value={password} onChange={event => setPassword(event.target.value)} /></label>
          <button className="checkout" disabled={busy}>{busy ? 'Starting…' : 'Set up MFA'}</button>
        </form>}
        {setup && <div className="security-setup">
          <p>Open an authenticator app, add a new account, and enter this secret manually:</p>
          <code className="security-secret">{setup.secret}</code>
          <label className="field">Authenticator setup URI<input readOnly value={setup.otpauthUrl} onFocus={event => event.target.select()} /></label>
          <form onSubmit={confirmSetup}>
            <label className="field">6-digit authenticator code<input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" value={code} onChange={event => setCode(event.target.value)} /></label>
            <button className="checkout" disabled={busy}>{busy ? 'Verifying…' : 'Enable MFA'}</button>
          </form>
        </div>}
        {status?.enabled && !setup && <>
          <p>MFA is enabled. Sign-in requires your password and an authenticator code.</p>
          <p className="security-muted">Unused recovery codes: {status.recoveryCodesRemaining}</p>
          <form onSubmit={rotateCodes}>
            <label className="field">Current password<input required type="password" autoComplete="current-password" minLength="12" maxLength="256" value={password} onChange={event => setPassword(event.target.value)} /></label>
            <label className="field">Authenticator or recovery code<input required autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></label>
            <div className="security-actions"><button className="checkout" disabled={busy}>{busy ? 'Working…' : 'Regenerate recovery codes'}</button><button type="button" className="secondary" disabled={busy} onClick={disable}>Disable MFA</button></div>
          </form>
        </>}
        {!!recoveryCodes.length && <section className="recovery-code-box"><h3>Save your recovery codes</h3><p>Each code works once if you lose access to your authenticator. They are not shown again.</p><ul className="recovery-codes">{recoveryCodes.map(recoveryCode => <li key={recoveryCode}><code>{recoveryCode}</code></li>)}</ul></section>}
      </div>
    </section>
  </>;
}
