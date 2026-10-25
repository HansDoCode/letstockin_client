// Production uses Vercel's same-origin /api rewrite. This keeps the HTTP-only
// session cookie first-party instead of depending on third-party cookie access
// between the Vercel frontend and Render backend.
const baseUrl = import.meta.env.MODE === 'development'
  ? (String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '') || 'http://localhost:3001/api')
  : '/api';
const headers = { 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, credentials: 'include', headers: { ...headers, ...options.headers } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'Request failed.'); error.status = response.status; throw error; }
  return body;
}
export const api = {
  me: (signal) => request('/auth/me', { cache: 'no-store', signal }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  verifyMfa: (data) => request('/auth/mfa/verify', { method: 'POST', body: JSON.stringify(data) }),
  mfaStatus: () => request('/auth/mfa/status'),
  startMfaSetup: (password) => request('/auth/mfa/setup', { method: 'POST', body: JSON.stringify({ password }) }),
  confirmMfaSetup: (code) => request('/auth/mfa/setup/confirm', { method: 'POST', body: JSON.stringify({ code }) }),
  rotateMfaRecoveryCodes: (data) => request('/auth/mfa/recovery-codes', { method: 'POST', body: JSON.stringify(data) }),
  disableMfa: (data) => request('/auth/mfa/disable', { method: 'POST', body: JSON.stringify(data) }),
  requestPasswordReset: (email) => request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  completePasswordReset: (data) => request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  createRemoteScanner: () => request('/remote-scanner/sessions', { method: 'POST' }),
  remoteScannerPair: (token) => request(`/remote-scanner/sessions/${encodeURIComponent(token)}/pair`, { method: 'POST' }),
  remoteScannerScan: (token, code) => request(`/remote-scanner/sessions/${encodeURIComponent(token)}/scans`, { method: 'POST', body: JSON.stringify({ code }) }),
  remoteScannerScans: (token, after = 0) => request(`/remote-scanner/sessions/${encodeURIComponent(token)}/scans?after=${encodeURIComponent(after)}`),
  closeRemoteScanner: (token) => request(`/remote-scanner/sessions/${encodeURIComponent(token)}`, { method: 'DELETE' }),
  products: (q = '', status) => request(`/products?q=${encodeURIComponent(q)}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  inventory: (q = '') => request(`/inventory?q=${encodeURIComponent(q)}`),
  overview: () => request('/reports/overview'),
  salesReport: ({ period, from, to, page = 1, pageSize = 25 }) => {
    const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize) });
    if (period === 'custom') { params.set('from', from); params.set('to', to); }
    return request(`/reports/sales?${params}`);
  },
  sales: () => request('/sales'),
  lowStock: () => request('/alerts/low-stock'),
  users: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProductStatus: (id, status) => request(`/products/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateProductVariants: (id, data) => request(`/products/${encodeURIComponent(id)}/variants`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adjustInventory: (variantId, data) => request(`/inventory/${variantId}/adjustments`, { method: 'POST', body: JSON.stringify(data) }),
  generateBarcode: (variantId) => request(`/inventory/${encodeURIComponent(variantId)}/barcode`, { method: 'POST' }),
  lookup: (code) => request(`/products/lookup/${encodeURIComponent(code)}`),
  checkout: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
  receipt: (id) => request(`/sales/${encodeURIComponent(id)}/receipt`),
  returnItem: (saleId, data) => request(`/sales/${encodeURIComponent(saleId)}/returns`, { method: 'POST', body: JSON.stringify(data) })
};
