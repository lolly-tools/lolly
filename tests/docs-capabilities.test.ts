// SPDX-License-Identifier: MPL-2.0
/**
 * The machine-readable claims file /info/capabilities.json (plan 116 workstream A,
 * priority 1). It is built straight from the format register so an agent can ask
 * "what does Lolly do with format X" without scraping HTML. This test builds the
 * same object the site emits (buildCapabilities over the register) and pins its
 * shape plus the register-to-row bijection: every register format appears exactly
 * once, and no extra row is invented.
 *
 * Run directly: node --test tests/docs-capabilities.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCapabilities, type FmtCatalog } from '../docs/formats-pages.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTER = resolve(ROOT, 'docs/site/formats-catalog.json');
const catalog = JSON.parse(readFileSync(REGISTER, 'utf8')) as FmtCatalog;

test('the top-level shape is the platform-neutral, server-free claim', () => {
  const cap = buildCapabilities(catalog, { url: 'https://lolly.tools' });
  assert.equal(cap.generator, 'lolly');
  assert.equal(cap.license, 'MPL-2.0');
  assert.equal(cap.offers, 0);
  assert.equal(cap.url, 'https://lolly.tools');
  assert.ok(Array.isArray(cap.formats));
});

test('the default url is the canonical site origin', () => {
  assert.equal(buildCapabilities(catalog).url, 'https://lolly.tools');
});

test('every register format appears exactly once, with the derived flags', () => {
  const cap = buildCapabilities(catalog);
  assert.equal(cap.formats.length, catalog.formats.length, 'one row per register format');

  const seen = new Set<string>();
  for (const row of cap.formats) {
    assert.ok(!seen.has(row.token), `token ${row.token} appears more than once`);
    seen.add(row.token);
  }
  // Every register token is present, no extra token invented.
  const registerTokens = new Set(catalog.formats.map((f) => f.token));
  assert.deepEqual(
    [...seen].sort(),
    [...registerTokens].sort(),
    'the capabilities rows and the register tokens must be the same set',
  );
});

test('reads/writes/roundTrips are computed from dir, never asserted independently', () => {
  const cap = buildCapabilities(catalog);
  const byToken = new Map(catalog.formats.map((f) => [f.token, f]));
  for (const row of cap.formats) {
    const entry = byToken.get(row.token)!;
    assert.equal(row.reads, entry.dir !== 'out', `${row.token} reads`);
    assert.equal(row.writes, entry.dir !== 'in', `${row.token} writes`);
    assert.equal(row.roundTrips, entry.dir === 'both', `${row.token} roundTrips`);
    assert.deepEqual(row.features, entry.features, `${row.token} features carried verbatim`);
    // A round-trip format must read AND write - the property the register guarantees.
    if (row.roundTrips) assert.ok(row.reads && row.writes, `${row.token} round-trips so must read and write`);
  }
});
