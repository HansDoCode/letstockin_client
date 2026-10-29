import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { deleteConfirmationToken, matchesDeleteConfirmation } from './delete-confirmation.js';

test('product deletion confirmation uses the normalized product name', () => {
  assert.equal(deleteConfirmationToken('Tee Shirt'), 'teeshirt');
  assert.equal(matchesDeleteConfirmation('Tee Shirt', 'teeshirt'), true);
  assert.equal(matchesDeleteConfirmation('Tee Shirt', 'tee shirt'), false);
});
