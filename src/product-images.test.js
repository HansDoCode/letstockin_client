import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { colorImageKey, deleteProductImages, fitImageDimensions, getProductColorImages, getProductImage, PRODUCT_IMAGE_STORAGE_KEY } from './product-images.js';

test('image dimensions stay within the storage-friendly edge', () => {
  assert.deepEqual(fitImageDimensions(4000, 2000, 1400), { width: 1400, height: 700 });
  assert.deepEqual(fitImageDimensions(800, 600, 1400), { width: 800, height: 600 });
});

test('color image storage keys and lookup are case-insensitive', () => {
  const images = { [colorImageKey(7, 'Black')]: 'black.png' };
  assert.deepEqual(getProductColorImages(7, [{ color: 'black' }, { color: 'Red' }], images), { black: 'black.png' });
});

test('product image falls back to the first saved color image', () => {
  const images = { [colorImageKey(7, 'Black')]: 'black.png' };
  assert.equal(getProductImage(7, [{ color: 'Black' }], images), 'black.png');
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
