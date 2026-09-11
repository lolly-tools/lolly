// SPDX-License-Identifier: MPL-2.0
// Tests for instance-probe.ts's pure logic - URL validation shaping and
// probe-response classification for components/instance-sheet.ts's connect
// flow. Split into its own module specifically so it's importable with no
// DOM/CSS dependency: instance-sheet.ts itself has a top-level CSS import for
// its dialog chrome, which a plain `node --test` run can't load (unknown
// ".css" extension under ESM). Everything else in instance-sheet.ts
// (mountModal, fetch, IndexedDB via bridge/db.ts) needs a real browser/IDB,
// same split as lib/instance.test.ts and lib/drop-router.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInstanceUrl, shapeProbeResult, shapeInstanceManifest } from './instance-probe.ts';

// ── validateInstanceUrl ──────────────────────────────────────────────────────

test('validateInstanceUrl: accepts + normalizes a valid https URL', () => {
  const result = validateInstanceUrl('https://demo.lolly.tools/');
  assert.deepEqual(result, { ok: true, base: 'https://demo.lolly.tools' });
});

test('validateInstanceUrl: rejects http with a message', () => {
  const result = validateInstanceUrl('http://example.com');
  assert.equal(result.ok, false);
  assert.match((result as { message: string }).message, /https/);
});

test('validateInstanceUrl: rejects unparsable input with a message', () => {
  const result = validateInstanceUrl('not a url');
  assert.equal(result.ok, false);
  assert.match((result as { message: string }).message, /valid URL/);
});

test('validateInstanceUrl: rejects embedded credentials', () => {
  const result = validateInstanceUrl('https://user:pass@example.com');
  assert.equal(result.ok, false);
  assert.match((result as { message: string }).message, /credentials/);
});

// ── shapeProbeResult ─────────────────────────────────────────────────────────

test('shapeProbeResult: a real tool index → ok with the count', () => {
  const result = shapeProbeResult(200, true, { tools: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
  assert.deepEqual(result, { ok: true, toolCount: 3 });
});

test('shapeProbeResult: an empty tools array is still a valid catalogue (0 tools)', () => {
  const result = shapeProbeResult(200, true, { tools: [] });
  assert.deepEqual(result, { ok: true, toolCount: 0 });
});

test('shapeProbeResult: non-2xx status → http reason, status carried through', () => {
  const result = shapeProbeResult(404, false, undefined);
  assert.deepEqual(result, { ok: false, reason: 'http', status: 404 });
});

test('shapeProbeResult: ok status but unparsable body → parse reason', () => {
  const result = shapeProbeResult(200, true, undefined);
  assert.deepEqual(result, { ok: false, reason: 'parse' });
});

test('shapeProbeResult: ok status + valid JSON but no tools array → shape reason', () => {
  assert.deepEqual(shapeProbeResult(200, true, { notTools: [] }), { ok: false, reason: 'shape' });
  assert.deepEqual(shapeProbeResult(200, true, { tools: 'nope' }), { ok: false, reason: 'shape' });
  assert.deepEqual(shapeProbeResult(200, true, null), { ok: false, reason: 'parse' });
  assert.deepEqual(shapeProbeResult(200, true, 42), { ok: false, reason: 'shape' });
});

// ── shapeInstanceManifest ────────────────────────────────────────────────────

test('shapeInstanceManifest: a full manifest shapes into the card fields', () => {
  assert.deepEqual(
    shapeInstanceManifest(200, true, {
      name: 'Acme Hub', accessMode: 'gated', providerName: 'Acme SSO',
      engineVersion: '1.146.0', capabilities: { catalog: true },
      connect: { packUrl: 'https://hub.acme.example/connect/pack.lolly' },
    }),
    {
      found: true, name: 'Acme Hub', accessMode: 'gated', providerName: 'Acme SSO',
      engineVersion: '1.146.0', packUrl: 'https://hub.acme.example/connect/pack.lolly',
    },
  );
});

test('shapeInstanceManifest: optional fields are simply absent, never invented', () => {
  assert.deepEqual(shapeInstanceManifest(200, true, { name: 'Plain Hub' }), { found: true, name: 'Plain Hub' });
  // providerName null (the dev provider) must not become a field.
  assert.deepEqual(shapeInstanceManifest(200, true, { name: 'H', providerName: null }), { found: true, name: 'H' });
});

test('shapeInstanceManifest: absence is not an error - a plain deployment has no manifest', () => {
  assert.deepEqual(shapeInstanceManifest(404, false, undefined), { found: false });
  assert.deepEqual(shapeInstanceManifest(200, true, undefined), { found: false });
  assert.deepEqual(shapeInstanceManifest(200, true, '<html>SPA fallback</html>'), { found: false });
  assert.deepEqual(shapeInstanceManifest(200, true, { name: '' }), { found: false });
  assert.deepEqual(shapeInstanceManifest(200, true, { name: 42 }), { found: false });
});
