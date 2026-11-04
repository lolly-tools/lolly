// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('publisher fixtures protect immutable artifacts and pointer promotion order', () => {
  const result = spawnSync('python3', [fileURLToPath(new URL('./desktop-update-publisher.test.py', import.meta.url))], { encoding: 'utf8' });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
