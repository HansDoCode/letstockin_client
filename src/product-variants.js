export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One size'];

export function generatedIdentifier(prefix) {
  const source = globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`;
  return `LS-${prefix}-${source.replace(/[^a-z0-9]/gi, '').slice(-12).toUpperCase()}`;
}

export function expandVariantGroups(groups) {
  return groups.flatMap(group => group.sizes.map(size => ({
    size,
    color: group.color,
    sku: group.sizes.length > 1 ? `${group.sku}-${size.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toUpperCase()}` : group.sku,
    barcode: group.sizes.length > 1 ? generatedIdentifier('BAR') : group.barcode,
    qrCode: group.sizes.length > 1 ? generatedIdentifier('QR') : group.qrCode,
    priceCents: Math.round(Number(group.price) * 100),
    quantity: Number(group.quantities[size]),
    reorderPoint: Number(group.reorderPoint)
  })));
}
