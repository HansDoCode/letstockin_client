import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { groupInventoryRows } from './inventory-products.js';

test('groups inventory variants under one product without losing choices', () => {
  const products = groupInventoryRows([
    { product_id: 7, name: 'Shirt', variant_id: 11, size: 'S', color: 'Navy' },
    { product_id: 7, name: 'Shirt', variant_id: 12, size: 'M', color: 'Navy' },
    { product_id: 8, name: 'Pants', variant_id: 21, size: 'M', color: 'Black' }
  ]);

  assert.deepEqual(products.map(product => ({ id: product.product_id, name: product.name, variants: product.variants.map(row => row.variant_id) })), [
    { id: 7, name: 'Shirt', variants: [11, 12] },
    { id: 8, name: 'Pants', variants: [21] }
  ]);
});
