import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { expandVariantGroups, groupVariantsByColor } from './product-variants.js';

test('variants with the same color stay in one editable group', () => {
  assert.deepEqual(groupVariantsByColor([
    { id: 1, size: 'S', color: 'Black' },
    { id: 2, size: 'M', color: 'black' },
    { id: 3, size: 'S', color: 'Red' }
  ]), [
    { color: 'Black', variants: [{ id: 1, size: 'S', color: 'Black' }, { id: 2, size: 'M', color: 'black' }] },
    { color: 'Red', variants: [{ id: 3, size: 'S', color: 'Red' }] }
  ]);
});

test('one color and price expand into separately stocked sizes', () => {
  const rows = expandVariantGroups([{ sizes: ['S', 'M', 'L'], color: 'Navy', sku: 'TEE-NAVY', barcode: '', qrCode: '', price: '499.00', quantities: { S: '2', M: '5', L: '0' }, reorderPoint: '5' }]);
  assert.deepEqual(rows.map(({ size, color, sku, priceCents, quantity }) => ({ size, color, sku, priceCents, quantity })), [
    { size: 'S', color: 'Navy', sku: 'TEE-NAVY-S', priceCents: 49900, quantity: 2 },
    { size: 'M', color: 'Navy', sku: 'TEE-NAVY-M', priceCents: 49900, quantity: 5 },
    { size: 'L', color: 'Navy', sku: 'TEE-NAVY-L', priceCents: 49900, quantity: 0 }
  ]);
  assert.equal(new Set(rows.map(row => row.barcode)).size, 3);
  assert.equal(new Set(rows.map(row => row.qrCode)).size, 3);
});
