import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { colorImageKey, deleteProductImages, getProductColorImages, PRODUCT_IMAGE_STORAGE_KEY } from './product-images.js';

test('color image storage keys and lookup are case-insensitive', () => {
  const images = { [colorImageKey(7, 'Black')]: 'black.png' };
  assert.deepEqual(getProductColorImages(7, [{ color: 'black' }, { color: 'Red' }], images), { black: 'black.png' });
});

test('deleting product images keeps other products intact', () => {
  const previousWindow = globalThis.window;
  const storage = new Map([[PRODUCT_IMAGE_STORAGE_KEY, JSON.stringify({ '7:color:black': 'black.png', '8:color:red': 'red.png' })]]);
  globalThis.window = { localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, dispatchEvent() {} };
  try {
    deleteProductImages(7);
    assert.deepEqual(JSON.parse(storage.get(PRODUCT_IMAGE_STORAGE_KEY)), { '8:color:red': 'red.png' });
  } finally {
    globalThis.window = previousWindow;
  }
});
