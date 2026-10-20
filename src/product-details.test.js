import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { normalizeProductDetails } from './product-details.js';

test('normalizes catalog stock for the product details dialog', () => {
  const result = normalizeProductDetails({ id: 7, name: 'Shirt', variants: [{ id: 11, stock: 4 }] });
  assert.equal(result.productId, 7);
  assert.equal(result.matchedVariantId, 11);
  assert.equal(result.variants[0].quantity, 4);
});
