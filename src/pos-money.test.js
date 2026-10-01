import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseCashCents } from './pos-money.js';

test('cash entry accepts pesos with at most two decimal places', () => {
  assert.equal(parseCashCents(' 500.50 '), 50050);
  assert.equal(parseCashCents('0'), 0);
  assert.equal(parseCashCents('12.3'), 1230);
  assert.equal(parseCashCents('12.345'), null);
  assert.equal(parseCashCents('-1'), null);
  assert.equal(parseCashCents(''), null);
  assert.equal(parseCashCents('999999999999999'), null);
});
