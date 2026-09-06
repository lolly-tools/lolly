// SPDX-License-Identifier: MPL-2.0
/**
 * README's headline format counts ("N in, M out (K round-trip)") are derived
 * from the /info register (docs/site/formats-catalog.json), the same file
 * docs/build.ts computes the formats page from. They drifted once (37/40/21
 * against a register that said 49/54/33), so this pins the three numbers to
 * the register: add a format, and README must move with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface FmtEntry { token: string; dir: 'in' | 'out' | 'both' }

test('README format counts match the /info register', () => {
  const register = JSON.parse(readFileSync(resolve(ROOT, 'docs/site/formats-catalog.json'), 'utf8')) as { formats: FmtEntry[] };
  const inCount = register.formats.filter((f) => f.dir !== 'out').length;
  const outCount = register.formats.filter((f) => f.dir !== 'in').length;
  const both = register.formats.filter((f) => f.dir === 'both').length;

  const readme = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
  const m = /\*\*(\d+) in, (\d+) out\*\* \((\d+) round-trip/.exec(readme);
  assert.ok(m, 'README must state "**N in, M out** (K round-trip" once');
  assert.equal(Number(m[1]), inCount, `README says ${m[1]} in; register has ${inCount}`);
  assert.equal(Number(m[2]), outCount, `README says ${m[2]} out; register has ${outCount}`);
  assert.equal(Number(m[3]), both, `README says ${m[3]} round-trip; register has ${both}`);
});
