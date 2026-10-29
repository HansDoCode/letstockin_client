export function deleteConfirmationToken(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function matchesDeleteConfirmation(name, value) {
  return typeof value === 'string' && value.trim().toLowerCase() === deleteConfirmationToken(name);
}
