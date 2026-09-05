// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { submodulePaths } from '../scripts/release-checklist.ts';

test('repository inventory covers every submodule exactly once', () => {
  const inventory = JSON.parse(readFileSync('security/repository-inventory.json', 'utf8')) as { repositories: Array<{ path: string }> };
  assert.deepEqual(inventory.repositories.filter((repo) => repo.path !== '.').map((repo) => repo.path).sort(), submodulePaths());
});

test('submodule parser ignores URLs and update policy', () => {
  assert.deepEqual(submodulePaths('[submodule "a"]\n path = one/a\n url = https://example.invalid/a\n update = none\n'), ['one/a']);
});
