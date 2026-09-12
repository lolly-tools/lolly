// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the pure grammar for a logical "provider ref" asset id
 * (`<provider>://<scope>/<path>?<query>`) that runtime.ts's asset resolver
 * delegates to `host.assets.resolveProvider` for any non-http(s) scheme.
 * Resolution itself is HostV1's job; this module only owns parsing, so the
 * same string is recognised the same way by every shell.
 * Run: node --test tests/asset-provider.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseProviderRef, isProviderRef } from '../engine/src/asset-provider.ts';

test('parses provider, scope, path and query from a full ref', () => {
  const ref = parseProviderRef('figma://file123/path/to/asset?version=2&x=y');
  assert.deepEqual(ref, {
    raw: 'figma://file123/path/to/asset?version=2&x=y',
    provider: 'figma',
    scope: 'file123',
    path: 'path/to/asset',
    query: { version: '2', x: 'y' },
  });
});

test('scope with no path and no query yields empty path and empty query object', () => {
  const ref = parseProviderRef('gdrive://folder1');
  assert.ok(ref);
  assert.equal(ref!.path, '');
  assert.deepEqual(ref!.query, {});
});

test('empty/duplicate path segments are dropped, not preserved as empty strings', () => {
  const ref = parseProviderRef('s3://bucket/a//b/');
  assert.ok(ref);
  assert.equal(ref!.path, 'a/b');
});

test('percent-encoded scope and path segments are decoded', () => {
  const ref = parseProviderRef('drive://my%20folder/a%2Fb%20c');
  assert.ok(ref);
  assert.equal(ref!.scope, 'my folder');
  assert.equal(ref!.path, 'a/b c');
});

test('a scheme that does not start lowercase-alpha (or has no ://) is not a provider ref', () => {
  assert.equal(parseProviderRef('FIGMA://file123'), null);
  assert.equal(parseProviderRef('not a url'), null);
  assert.equal(parseProviderRef('justtext'), null);
  assert.equal(parseProviderRef(''), null);
});

test('non-string input returns null rather than throwing', () => {
  assert.equal(parseProviderRef(undefined), null);
  assert.equal(parseProviderRef(null), null);
  assert.equal(parseProviderRef(42), null);
  assert.equal(parseProviderRef({}), null);
});

test('malformed percent-encoding is caught and returns null, not a throw', () => {
  assert.equal(parseProviderRef('drive://scope/%E0%A4%A'), null);
});

test('isProviderRef mirrors parseProviderRef as a boolean guard', () => {
  assert.equal(isProviderRef('figma://file123/a'), true);
  assert.equal(isProviderRef('https://example.com/a.png'), true); // http(s) still parses; runtime special-cases it, not this module
  assert.equal(isProviderRef('not a url'), false);
  assert.equal(isProviderRef(123), false);
});
