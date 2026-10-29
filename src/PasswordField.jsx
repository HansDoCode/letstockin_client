import React, { useState } from 'react';
import { getPasswordRequirements } from './password-rules.js';

function VisibilityIcon({ visible }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />{visible ? <path d="m4 4 16 16" /> : <circle cx="12" cy="12" r="2.5" />}</svg>;
}

export default function PasswordField({ label, hint, value, onChange, showRequirements = false, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  const requirements = showRequirements ? getPasswordRequirements(value) : [];

  return <label className="field password-field">{label}{hint && <small>{hint}</small>}<span className="password-input"><input {...inputProps} type={visible ? 'text' : 'password'} value={value} onChange={onChange} /><button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} title={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(current => !current)}><VisibilityIcon visible={visible} /></button></span>{showRequirements && <ul className="password-requirements" aria-label="Password requirements">{requirements.map(requirement => <li key={requirement.label} className={requirement.valid ? 'valid' : ''} aria-label={`${requirement.label}: ${requirement.valid ? 'met' : 'not met'}`}><span aria-hidden="true">{requirement.valid ? '✓' : '○'}</span>{requirement.label}</li>)}</ul>}</label>;
}
