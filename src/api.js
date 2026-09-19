const configuredBaseUrl = String(import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const baseUrl = configuredBaseUrl || (import.meta.env.DEV ? 'http://localhost:3001/api' : '');
const missingBaseUrlMessage = 'The API URL is not configured for this deployment.';
const headers = { 'Content-Type': 'application/json' };
async function request(path, options = {}) {
  if (!baseUrl) throw new Error(missingBaseUrlMessage);
  const response = await fetch(`${baseUrl}${path}`, { ...options, credentials: 'include', headers: { ...headers, ...options.headers } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error || 'Request failed.'); error.status = response.status; throw error; }
  return body;
}
export const api = {
  me: () => request('/auth/me'),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  requestPasswordReset: (email) => request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  completePasswordReset: (data) => request('/auth/password-reset/complete', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  products: (q = '', status) => request(`/products?q=${encodeURIComponent(q)}${status ? `&status=${encodeURIComponent(status)}` : ''}`),
  inventory: (q = '') => request(`/inventory?q=${encodeURIComponent(q)}`),
  overview: () => request('/reports/overview'),
  sales: () => request('/sales'),
  lowStock: () => request('/alerts/low-stock'),
  users: () => request('/users'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  createProduct: (data) => request('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProductStatus: (id, status) => request(`/products/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  adjustInventory: (variantId, data) => request(`/inventory/${variantId}/adjustments`, { method: 'POST', body: JSON.stringify(data) }),
  lookup: (code) => request(`/products/lookup/${encodeURIComponent(code)}`),
  checkout: (data) => request('/sales', { method: 'POST', body: JSON.stringify(data) }),
  receipt: (id) => request(`/sales/${encodeURIComponent(id)}/receipt`),
  returnItem: (saleId, data) => request(`/sales/${encodeURIComponent(saleId)}/returns`, { method: 'POST', body: JSON.stringify(data) })
};
