/**
 * Contract tests for the END-USER tool-URL surface (parseToolUrl / buildEmbedUrl /
 * isToolUrl) — what the asset picker accepts when a user pastes a Lolly link.
 *
 * Unlike parseEmbedUrl (the strict, host-locked gate for author-written template
 * embeds), parseToolUrl is deliberately liberal: it recognises every link shape
 * the app hands a user (embed URL, hash share route, pretty path) on any host,
 * because the user's intent ("render this tool as my image") is explicit. The real
 * safety net is downstream — the toolId must resolve to a real local tool.
 *
 * buildEmbedUrl canonicalises into the strict embed form, so its output must always
 * re-parse through parseEmbedUrl (the persistent-identity round-trip).
 *
 * Run with: node --test tests/tool-url.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseToolUrl, buildEmbedUrl, isToolUrl } from '../engine/src/tool-url.js';
import { parseEmbedUrl } from '../engine/src/embed.js';

test('accepts the canonical embed form (delegates to parseEmbedUrl)', () => {
  const r = parseToolUrl('https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c');
  assert.deepEqual(r, { toolId: 'qr-code', format: 'svg', query: 'url=https://suse.com&color=0c322c' });
});

test('accepts the hash share route (what the Share dialog produces)', () => {
  const r = parseToolUrl('https://lolly.tools/#/tool/qr-code?url=https://suse.com&color=0c322c');
  assert.deepEqual(r, { toolId: 'qr-code', format: null, query: 'url=https://suse.com&color=0c322c' });
});

test('accepts the hash route on any host (localhost / preview deploys)', () => {
  const r = parseToolUrl('http://localhost:5173/#/tool/filter-duotone?image=x');
  assert.deepEqual(r, { toolId: 'filter-duotone', format: null, query: 'image=x' });
});

test('accepts the pretty path shortcut, with and without /tool/', () => {
  assert.deepEqual(parseToolUrl('https://lolly.tools/qr-code?url=x'),
    { toolId: 'qr-code', format: null, query: 'url=x' });
  assert.deepEqual(parseToolUrl('https://lolly.tools/tool/qr-code?url=x'),
    { toolId: 'qr-code', format: null, query: 'url=x' });
});

test('hash route with no query yields an empty query string', () => {
  assert.equal(parseToolUrl('https://lolly.tools/#/tool/qr-code').query, '');
});

test('does not mistake app routes for tools', () => {
  for (const route of ['pro', 'platform', 'capabilities', 'profile', 'gallery']) {
    assert.equal(parseToolUrl(`https://lolly.tools/${route}`), null, `should reject /${route}`);
  }
});

test('rejects non-tool URLs and junk', () => {
  const bad = [
    'https://lolly.tools/',                  // no tool segment
    'https://suse.com/some/page',            // arbitrary deep path
    'https://lolly.tools/qr-code.svg',       // pretty path WITH extension (not a route the app emits)
    'https://lolly.tools/tool/bad_id',       // underscore not allowed
    'https://lolly.tools/tool/-bad',         // leading hyphen
    'ftp://lolly.tools/tool/qr-code.svg',    // wrong protocol
    'just some text',
    'qr-code',                               // bare id, not a URL
    '',
    null,
    undefined,
    42,
  ];
  for (const s of bad) assert.equal(parseToolUrl(s), null, `should reject: ${String(s)}`);
});

test('rejects an absurdly long string without throwing', () => {
  assert.equal(parseToolUrl('https://lolly.tools/#/tool/qr-code?x=' + 'a'.repeat(9000)), null);
});

test('isToolUrl mirrors parseToolUrl and never matches a plain library id', () => {
  assert.equal(isToolUrl('https://lolly.tools/#/tool/qr-code?url=x'), true);
  assert.equal(isToolUrl('suse/logo/primary'), false);   // catalog id, not a URL
  assert.equal(isToolUrl('user/upload/123-pic.webp'), false);
});

test('buildEmbedUrl produces the strict embed form and round-trips through parseEmbedUrl', () => {
  const url = buildEmbedUrl({ toolId: 'qr-code', format: 'svg', query: 'url=https%3A%2F%2Fsuse.com&w=600&h=600' });
  assert.equal(url, 'https://lolly.tools/tool/qr-code.svg?url=https%3A%2F%2Fsuse.com&w=600&h=600');
  const back = parseEmbedUrl(url);
  assert.equal(back.toolId, 'qr-code');
  assert.equal(back.format, 'svg');
  assert.equal(back.query, 'url=https%3A%2F%2Fsuse.com&w=600&h=600');
});

test('buildEmbedUrl defaults to svg, maps jpeg→jpg, and tolerates an empty query', () => {
  assert.equal(buildEmbedUrl({ toolId: 'qr-code' }), 'https://lolly.tools/tool/qr-code.svg');
  assert.equal(buildEmbedUrl({ toolId: 'qr-code', format: 'jpeg', query: '' }), 'https://lolly.tools/tool/qr-code.jpg');
  assert.equal(buildEmbedUrl({ toolId: 'bad_id' }), null);  // invalid id → no junk identity
});

test('buildEmbedUrl refuses to mint an id longer than parseEmbedUrl will accept', () => {
  const huge = buildEmbedUrl({ toolId: 'qr-code', format: 'svg', query: 'x=' + 'a'.repeat(5000) });
  assert.equal(huge, null, 'an un-re-parseable identity must not be minted');
  // And whatever parseToolUrl accepts always re-parses through parseEmbedUrl.
  const ok = buildEmbedUrl({ toolId: 'qr-code', format: 'png', query: 'x=' + 'a'.repeat(3000) });
  assert.ok(ok && parseEmbedUrl(ok), 'a within-bounds id round-trips');
});

test('a pasted hash route canonicalises into a re-parseable embed id', () => {
  // The flow renderUrl performs: parse a share link, then mint the canonical id.
  const parsed = parseToolUrl('https://lolly.tools/#/tool/qr-code?url=https://suse.com');
  const id = buildEmbedUrl({ toolId: parsed.toolId, format: 'png', query: parsed.query });
  // The canonical id is the strict form, so the runtime can re-resolve it anywhere.
  assert.ok(parseEmbedUrl(id), 'canonical id must satisfy the strict parser');
  assert.equal(isToolUrl(id), true);
});
