import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { colorImageKey, deleteProductImages, fitImageDimensions, getProductColorImages, getProductImage, getProductVariantImage, PRODUCT_IMAGE_STORAGE_KEY, removeSolidEdgeBackground } from './product-images.js';

test('image dimensions stay within the storage-friendly edge', () => {
  assert.deepEqual(fitImageDimensions(4000, 2000, 1400), { width: 1400, height: 700 });
  assert.deepEqual(fitImageDimensions(800, 600, 1400), { width: 800, height: 600 });
});

test('removes an edge-connected background without removing an enclosed dark product', () => {
  const width = 5; const height = 5; const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < data.length; index += 4) data[index + 3] = 255;
  for (let y = 1; y < 4; y += 1) for (let x = 1; x < 4; x += 1) {
    const offset = (y * width + x) * 4;
    data[offset] = 24; data[offset + 1] = 24; data[offset + 2] = 24;
  }
  assert.equal(removeSolidEdgeBackground(data, width, height), 16);
  assert.equal(data[3], 0);
  assert.equal(data[(2 * width + 2) * 4 + 3], 255);
});

test('color image storage keys and lookup are case-insensitive', () => {
  const images = { [colorImageKey(7, 'Black')]: 'black.png' };
  assert.deepEqual(getProductColorImages(7, [{ color: 'black' }, { color: 'Red' }], images), { black: 'black.png' });
});

test('product image falls back to the first saved color image', () => {
  const images = { [colorImageKey(7, 'Black')]: 'black.png' };
  assert.equal(getProductImage(7, [{ color: 'Black' }], images), 'black.png');
});

test('variant image wins over the generic product image', () => {
  const images = { 7: 'black.png', [colorImageKey(7, 'Green')]: 'green.png' };
  assert.equal(getProductVariantImage(7, { color: 'Green' }, images), 'green.png');
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
