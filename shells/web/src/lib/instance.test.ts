// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-base unit tests - the pure parts (URL validation/normalization and
 * path prefixing) that don't touch IndexedDB. setInstanceBase/initInstanceBase
 * go through bridge/db.ts's real IndexedDB, which node:test has no fake for
 * (see font-registry.test.ts's header for the same split); _setBaseForTests
 * exercises getInstanceBase/instancePath's reaction to a base without it.
 *
 * Run directly:  node --test shells/web/src/lib/instance.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInstanceBase, instancePath, getInstanceBase, _setBaseForTests, setInstallTag, clientHeaderValue } from './instance.ts';

// ── normalizeInstanceBase ────────────────────────────────────────────────────

test('normalizeInstanceBase: strips trailing slashes', () => {
  assert.equal(normalizeInstanceBase('https://demo.lolly.tools/'), 'https://demo.lolly.tools');
  assert.equal(normalizeInstanceBase('https://demo.lolly.tools///'), 'https://demo.lolly.tools');
});

test('normalizeInstanceBase: keeps an explicit port', () => {
  assert.equal(normalizeInstanceBase('https://192.168.1.5:8443'), 'https://192.168.1.5:8443');
});

test('normalizeInstanceBase: keeps a sub-path deployment', () => {
  assert.equal(normalizeInstanceBase('https://example.com/lolly/'), 'https://example.com/lolly');
});

test('normalizeInstanceBase: drops query and hash (a base is a prefix, not a page)', () => {
  assert.equal(normalizeInstanceBase('https://example.com/lolly?foo=bar#frag'), 'https://example.com/lolly');
});

test('normalizeInstanceBase: rejects http (https only)', () => {
  assert.throws(() => normalizeInstanceBase('http://example.com'), /https/);
});

test('normalizeInstanceBase: rejects embedded credentials', () => {
  assert.throws(() => normalizeInstanceBase('https://user:pass@example.com'), /credentials/);
});

test('normalizeInstanceBase: rejects unparsable input', () => {
  assert.throws(() => normalizeInstanceBase('not a url'), /valid URL/);
});

test('normalizeInstanceBase: trims surrounding whitespace before parsing', () => {
  assert.equal(normalizeInstanceBase('  https://example.com  '), 'https://example.com');
});

// ── instancePath ──────────────────────────────────────────────────────────────

test('instancePath: passthrough when no base is set (default, byte-identical)', () => {
  _setBaseForTests('');
  assert.equal(getInstanceBase(), '');
  assert.equal(instancePath('/catalog/tools/index.json'), '/catalog/tools/index.json');
  assert.equal(instancePath('/tools/qr-code/tool.json'), '/tools/qr-code/tool.json');
});

test('instancePath: prefixes a root-relative path with the base', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(getInstanceBase(), 'https://demo.lolly.tools');
  assert.equal(instancePath('/catalog/tools/index.json'), 'https://demo.lolly.tools/catalog/tools/index.json');
  _setBaseForTests('');
});

test('instancePath: joins a non-slash-prefixed path with a single slash', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(instancePath('tools/qr-code/tool.json'), 'https://demo.lolly.tools/tools/qr-code/tool.json');
  _setBaseForTests('');
});

test('instancePath: leaves an already-absolute URL untouched (e.g. a re-absolutized asset format URL)', () => {
  _setBaseForTests('https://demo.lolly.tools');
  assert.equal(
    instancePath('https://other-cdn.example.com/asset.png'),
    'https://other-cdn.example.com/asset.png',
  );
  assert.equal(
    instancePath('http://legacy.example.com/asset.png'),
    'http://legacy.example.com/asset.png',
  );
  _setBaseForTests('');
});

test('instancePath: sub-path base composes correctly', () => {
  _setBaseForTests('https://example.com/lolly');
  assert.equal(instancePath('/catalog/assets/index.json'), 'https://example.com/lolly/catalog/assets/index.json');
  _setBaseForTests('');
});

// ── install tag on the client header ─────────────────────────────────────────
// clientHeaderValue is the ONE place the x-lolly-client value is built, so
// these pin the whole install-identity surface the header can ever carry.

test('clientHeaderValue: untagged by default, and the tag joins only while set', () => {
  setInstallTag(null);
  const untagged = clientHeaderValue();
  assert.match(untagged, /^web engine\/\d+\.\d+\.\d+$/, 'no install token unless org/ turned it on');
  setInstallTag('9f2c1a44-7b1e-4e02-8f45-0a1b2c3d4e5f');
  assert.equal(clientHeaderValue(), `${untagged} install/9f2c1a44-7b1e-4e02-8f45-0a1b2c3d4e5f`);
  setInstallTag(null);
  assert.equal(clientHeaderValue(), untagged, 'clearing the tag restores the untagged header');
});

test('setInstallTag: anything outside the header grammar is refused, not escaped', () => {
  const untagged = clientHeaderValue();
  for (const bad of ['has space', 'semi;colon', 'newline\nx', 'x'.repeat(65), '']) {
    setInstallTag(bad);
    assert.equal(clientHeaderValue(), untagged, `refused: ${JSON.stringify(bad)}`);
  }
});
