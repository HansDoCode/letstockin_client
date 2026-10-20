import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { code128Bars, code128Values } from './barcode.js';

test('encodes a printable inventory barcode as Code 128B', () => {
  assert.deepEqual(code128Values('ABC'), [104, 33, 34, 35, 1, 106]);
  assert.equal(code128Bars('ABC').reduce((total, bar) => total + bar.width, 0), 68);
});
