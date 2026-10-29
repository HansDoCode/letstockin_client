import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getPasswordRequirements } from './password-rules.js';

test('password requirement indicators track the shared policy', () => {
  assert.deepEqual(getPasswordRequirements('short').map(requirement => requirement.valid), [false, false, true, false, false]);
  assert.ok(getPasswordRequirements('Strong1!').every(requirement => requirement.valid));
  assert.equal(getPasswordRequirements(`Strong1!${'x'.repeat(42)}`)[0].valid, true);
  assert.equal(getPasswordRequirements(`Strong1!${'x'.repeat(43)}`)[0].valid, false);
});
