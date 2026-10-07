// SPDX-License-Identifier: MPL-2.0
/**
 * Link-preview origin (scripts/lib/site-url.ts).
 *
 * Share cards need absolute URLs, so every page that carries them is built for
 * one origin. lolly.tools is the default; LOLLY_SITE_URL points an instance's own
 * shell build (lolly.ing) at itself. These tests pin the resolver's contract and
 * check that each place that writes share tags reads from it, so a new generator
 * cannot quietly hard-code lolly.tools again.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_SITE_URL, siteUrl } from '../scripts/lib/site-url.ts';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('siteUrl: lolly.tools by default, the override as a bare origin when set', () => {
  assert.equal(DEFAULT_SITE_URL, 'https://lolly.tools');
  assert.equal(siteUrl({}), DEFAULT_SITE_URL);
  assert.equal(siteUrl({ LOLLY_SITE_URL: '  ' }), DEFAULT_SITE_URL);
  assert.equal(siteUrl({ LOLLY_SITE_URL: 'https://lolly.ing' }), 'https://lolly.ing');
  assert.equal(siteUrl({ LOLLY_SITE_URL: 'https://lolly.ing/' }), 'https://lolly.ing');
  assert.equal(siteUrl({ LOLLY_SITE_URL: 'https://Lolly.ING:8443' }), 'https://lolly.ing:8443');
  assert.equal(siteUrl({ LOLLY_SITE_URL: 'http://localhost:5241' }), 'http://localhost:5241');
});

test('siteUrl: refuses anything that would ship broken share cards', () => {
  for (const bad of ['lolly.ing', 'http://lolly.ing', 'https://lolly.ing/app', 'https://lolly.ing/?x=1',
    'https://lolly.ing/#a', 'https://user:pw@lolly.ing', 'ftp://lolly.ing', 'not a url']) {
    assert.throws(() => siteUrl({ LOLLY_SITE_URL: bad }), /LOLLY_SITE_URL/, bad);
  }
});

test('every share-tag writer reads the preview origin from the resolver', () => {
  for (const rel of ['scripts/build-tool-og.ts', 'scripts/build-view-og.ts']) {
    const src = read(rel);
    assert.match(src, /const SITE_URL = siteUrl\(\);/, rel);
    assert.doesNotMatch(src, /const SITE_URL = 'https:\/\/lolly\.tools'/, rel);
  }
  const docs = read('docs/build.ts');
  assert.match(docs, /const PREVIEW_URL = siteUrl\(\);/);
  for (const tag of ['OG_IMAGE = `${PREVIEW_URL}', 'OG_LOGO = `${PREVIEW_URL}', '`${PREVIEW_URL}/info/og/${page.slug}.png`',
    '<meta property="og:url" content="${esc(shareUrl)}">']) {
    assert.ok(docs.includes(tag), `docs/build.ts: ${tag}`);
  }
  // The docs keep the public project site for canonical links.
  assert.ok(docs.includes('<link rel="canonical" href="${esc(localeUrl)}">'));
  const vite = readFileSync(join(ROOT, 'shells/web/vite.config.js'), 'latin1');
  assert.match(vite, /brandChrome\(\), sitePreview\(\)/);
  assert.match(read('docs/og-image.ts'), /const FOOTER_HOST = new URL\(siteUrl\(\)\)\.host;/);
});

test('index.html still carries the exact share tags sitePreview rewrites', () => {
  const html = read('shells/web/index.html');
  for (const tag of [
    '<meta property="og:url" content="https://lolly.tools/" />',
    '<meta property="og:image" content="https://lolly.tools/og.png" />',
    '<meta name="twitter:image" content="https://lolly.tools/og.png" />',
  ]) {
    assert.ok(html.includes(tag), tag);
  }
});
