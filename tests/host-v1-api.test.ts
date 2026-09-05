// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { snapshot } from '../scripts/check-host-v1-api.ts';

test('HostV1 stable barrel exports every capability module', () => {
  const barrel = readFileSync('packages/core/src/host-v1.ts', 'utf8');
  for (const module of readdirSync('packages/core/src/host-v1').filter((file) => file.endsWith('.ts'))) {
    assert.match(barrel, new RegExp(`export \\* from './host-v1/${module.replace('.', '\\.')}';`));
  }
});

test('HostV1 capability modules stay reviewably sized', () => {
  const entries = snapshot().entries;
  assert.ok(Object.keys(entries).length > 100);
  for (const entry of Object.values(entries)) assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  for (const module of readdirSync('packages/core/src/host-v1').filter((file) => file.endsWith('.ts'))) {
    assert.ok(readFileSync(`packages/core/src/host-v1/${module}`, 'utf8').split(/\r?\n/).length < 750, `${module} is too large`);
  }
});
