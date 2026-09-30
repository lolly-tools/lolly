// SPDX-License-Identifier: MPL-2.0
// Trusted sites (plan 288 section 5.3): the entry grammar and the one matcher.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRUSTED_SITES_MAX, matchTrustedSite, normaliseTrustedSite, normaliseTrustedSites, trustedSiteHost } from '../engine/src/trusted-sites.ts';

test('entries normalise to one of the three grammars', () => {
  const cases: Array<[string, string | null]> = [
    ['Example.COM', 'example.com'],
    ['  example.com  ', 'example.com'],
    ['https://example.com', 'example.com'],
    ['https://example.com/', 'example.com'],
    ['*.Example.com', '*.example.com'],
    ['https://example.com/docs/', 'https://example.com/docs/'],
    ['example.com/docs', 'https://example.com/docs'],
    ['example.com:8443', 'https://example.com:8443/'],
    ['localhost', 'localhost'],
    ['localhost:3000', 'http://localhost:3000/'],
    ['127.0.0.1:5173/demo', 'http://127.0.0.1:5173/demo'],
    ['http://localhost:3000', 'http://localhost:3000/'],
    ['bücher.de', 'xn--bcher-kva.de'],
    ['*.bücher.de', '*.xn--bcher-kva.de'],
  ];
  for (const [input, want] of cases) assert.equal(normaliseTrustedSite(input), want, input);
});

test('anything outside the grammar is refused', () => {
  for (const input of [
    '', '   ', 'com', '*.com', '*', '*.*.example.com', '**.example.com', 'ex ample.com',
    'http://example.com', 'ftp://example.com', 'javascript:alert(1)', 'data:text/html,x', 'mailto:a@example.com',
    'https://user:pw@example.com', 'https://example.com/?q=1', 'https://example.com/#x', '*.example.com/docs',
    '*.example.com:443', '*.localhost', '*.127.0.0.1', 'x'.repeat(3000),
  ]) assert.equal(normaliseTrustedSite(input), null, input);
  assert.equal(normaliseTrustedSite(42), null);
  assert.equal(normaliseTrustedSite(null), null);
});

test('a host entry covers that host on https, and a wildcard its subdomains too', () => {
  assert.equal(matchTrustedSite('https://example.com/a', ['example.com']), 'example.com');
  assert.equal(matchTrustedSite('https://example.com:8443/a', ['example.com']), 'example.com');
  assert.equal(matchTrustedSite('https://www.example.com/', ['example.com']), null, 'a bare host is that host only');
  assert.equal(matchTrustedSite('http://example.com/', ['example.com']), null, 'never plain http');
  assert.equal(matchTrustedSite('https://cdn.example.com/x.css', ['*.example.com']), '*.example.com');
  assert.equal(matchTrustedSite('https://example.com/', ['*.example.com']), '*.example.com');
  assert.equal(matchTrustedSite('https://notexample.com/', ['*.example.com']), null);
  assert.equal(matchTrustedSite('https://example.com.evil.net/', ['*.example.com']), null);
});

test('a prefix entry covers its origin at or under its path, and nothing beside it', () => {
  const entries = ['https://example.com/docs'];
  assert.equal(matchTrustedSite('https://example.com/docs', entries), 'https://example.com/docs');
  assert.equal(matchTrustedSite('https://example.com/docs/intro?x=1', entries), 'https://example.com/docs');
  assert.equal(matchTrustedSite('https://example.com/docs-private', entries), null);
  assert.equal(matchTrustedSite('https://example.com/', entries), null);
  assert.equal(matchTrustedSite('https://example.com:8443/docs', entries), null, 'another port is another origin');
  assert.equal(matchTrustedSite('http://localhost:3000/app', ['localhost:3000']), 'http://localhost:3000/');
  assert.equal(matchTrustedSite('http://localhost:4000/app', ['localhost:3000']), null);
  assert.equal(matchTrustedSite('http://localhost:4000/app', ['localhost']), 'localhost', 'bare localhost covers every port');
});

test('the matcher refuses targets trust can never apply to, and cleans raw lists', () => {
  assert.equal(matchTrustedSite('https://user:pw@example.com/', ['example.com']), null);
  assert.equal(matchTrustedSite('javascript:alert(1)', ['example.com']), null);
  assert.equal(matchTrustedSite('not a url', ['example.com']), null);
  assert.equal(matchTrustedSite('https://example.com/', ['*', 'EXAMPLE.com']), 'example.com', 'raw entries are normalised before matching');
  assert.equal(matchTrustedSite('https://example.com/', [42, null, 'com']), null);
});

test('lists drop invalid entries, keep order, dedupe and cap', () => {
  assert.deepEqual(normaliseTrustedSites(['b.com', 'nope', 'A.com', 'https://b.com/', 7]), ['b.com', 'a.com']);
  assert.deepEqual(normaliseTrustedSites('example.com'), []);
  const many = Array.from({ length: TRUSTED_SITES_MAX + 20 }, (_, i) => `s${i}.example.com`);
  assert.equal(normaliseTrustedSites(many).length, TRUSTED_SITES_MAX);
});

test('each entry reads as the host it is about', () => {
  assert.equal(trustedSiteHost('*.example.com'), 'example.com');
  assert.equal(trustedSiteHost('https://example.com/docs/'), 'example.com');
  assert.equal(trustedSiteHost('http://localhost:3000/'), 'localhost:3000');
  assert.equal(trustedSiteHost('example.com'), 'example.com');
});
