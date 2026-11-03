import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRuns, statusOf, summarize } from './model.js';

const runs = [
  { name: 'Pylint', status: 'completed', conclusion: 'success' },
  { name: 'Sync', status: 'completed', conclusion: 'failure' },
  { name: 'Sync', status: 'in_progress', conclusion: null },
];
test('filters combine workflow text and exact status', () => {
  assert.equal(filterRuns(runs, 'SYNC', 'failure').length, 1);
  assert.equal(filterRuns(runs, 'none', 'all').length, 0);
});
test('active runs are never classified as successful', () => {
  assert.equal(statusOf(runs[2]), 'in_progress');
});
test('summary counts workflows uniquely and conclusions separately', () => {
  assert.deepEqual(summarize(runs), { workflows: 2, successful: 1, failed: 1 });
});
