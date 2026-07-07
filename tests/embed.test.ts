/**
 * Contract tests for the embed URL grammar (parseEmbedUrl) — the portable
 * surface of tool composition. The strict matcher is the security boundary, so
 * these tests pin down exactly what is accepted (canonical lolly.tools/tool URLs)
 * and rejected (everything else — other hosts, http, bad ids, traversal, …).
 *
 * Run with: node --test tests/embed.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseEmbedUrl } from '../engine/src/embed.ts';

test('accepts the canonical embed URL and extracts id/format/query', () => {
  const r = parseEmbedUrl('https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c');
  assert.deepEqual(r, {
    toolId: 'qr-code',
    ext: 'svg',
    format: 'svg',
    query: 'url=https://suse.com&color=0c322c',
  });
});

test('maps each known extension to a render format', () => {
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.png')?.format, 'png');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.webp')?.format, 'webp');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.pdf')?.format, 'pdf');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.JPG')?.format, 'jpg'); // ext case-insensitive
  // Motion formats: a composed child can carry its animation/video through an embed.
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.gif')?.format, 'gif');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.apng')?.format, 'apng');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.mp4')?.format, 'mp4');
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.webm')?.format, 'webm');
});

test('empty query is an empty string', () => {
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.svg')?.query, '');
});

test('rejects anything that is not the exact shape', () => {
  const bad: unknown[] = [
    'http://lolly.tools/tool/qr-code.svg',          // not https
    'https://evil.com/tool/qr-code.svg',            // wrong host
    'https://lolly.tools.evil.com/tool/qr-code.svg',// host suffix trick
    'https://lolly.tools/tools/qr-code.svg',        // wrong path segment
    'https://lolly.tools/tool/qr-code.bmp',         // unsupported ext
    'https://lolly.tools/tool/qr-code',             // no ext
    'https://lolly.tools/tool/.svg',                // empty id
    'https://lolly.tools/tool/-bad.svg',            // leading hyphen
    'https://lolly.tools/tool/bad-.svg',            // trailing hyphen
    'https://lolly.tools/tool/a/b.svg',             // slash in id (extra segment)
    'https://lolly.tools/tool/../secret.svg',       // traversal
    'https://lolly.tools/tool/qr_code.svg',         // underscore not allowed
    'https://lolly.tools/qr-code.svg',              // missing /tool/
    '/tool/qr-code.svg',                            // relative
    'not a url',
    '',
    null,
    undefined,
    123,
  ];
  for (const s of bad) {
    assert.equal(parseEmbedUrl(s), null, `should reject: ${String(s)}`);
  }
});

test('normalizes a single FQDN trailing dot (so it agrees with the neutralizer)', () => {
  const r = parseEmbedUrl('https://lolly.tools./tool/qr-code.svg?url=x');
  assert.equal(r?.toolId, 'qr-code');
  // but a host-suffix trick is still rejected
  assert.equal(parseEmbedUrl('https://lolly.tools.evil.com/tool/qr-code.svg'), null);
});

test('rejects an absurdly long string without throwing', () => {
  assert.equal(parseEmbedUrl('https://lolly.tools/tool/qr-code.svg?x=' + 'a'.repeat(5000)), null);
});

test('preserves a complex query verbatim (caller hands it to parseUrlState)', () => {
  const r = parseEmbedUrl('https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fx.io%2Fa%3Fb%3D1&ecl=H&padding=2');
  assert.equal(r?.query, 'url=https%3A%2F%2Fx.io%2Fa%3Fb%3D1&ecl=H&padding=2');
});
