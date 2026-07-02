// SPDX-License-Identifier: MPL-2.0
// Canary: proves the test runner strips types and executes .test.ts files.
import test from 'node:test';
import assert from 'node:assert/strict';

function double(n: number): number {
  return n * 2;
}

test('TypeScript test files run under node --experimental-strip-types', () => {
  assert.equal(double(21), 42);
});
