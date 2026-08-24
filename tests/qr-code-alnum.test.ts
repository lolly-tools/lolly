// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code Generator (community/qr-code) - alphanumeric-mode density contract.
 *
 * The vendored encoder used to hardcode byte mode (8 bits/char). It now splits
 * content into byte/alphanumeric segments (ISO/IEC 18004 8.4.3, 5.5 bits/char
 * for digits + UPPERCASE + ` $%*+-./:`), so uppercase content - most usefully a
 * packed `z=2…` base32 share-link token - renders as a smaller code. These tests
 * measure that through the rendered SVG: the module cell size is
 * 600 / (moduleCount + 2*padding), so a BIGGER cell means a SMALLER version.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/qr-code-alnum.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { packQuery } from '../engine/src/url-pack.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const SKIP = !existsSync(COMMUNITY) && 'community pack not mounted (clone without submodules)';
const tool: any = SKIP ? null : await loadTool('qr-code',
  (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

/** Render one url payload and return the code's module count, from the SVG. */
async function moduleCount(url: string): Promise<number> {
  // join:false renders one <rect> per module, whose width IS the cell size.
  const rt = await createRuntime(tool, baseHost(), { url, join: false });
  const svg = rt.getHydrated() as string;
  assert.ok(svg.includes('<svg'), 'rendered an SVG');
  assert.ok(!svg.includes('QR code unavailable'), `encoder refused: ${rt.getHydratedText('{{qrError}}')}`);
  // Module rects carry width=xsize; the 600-wide background rect is excluded.
  const widths = [...svg.matchAll(/<rect[^>]*width="([0-9.]+)"/g)]
    .map((m) => Number(m[1])).filter((w) => w < 600);
  assert.ok(widths.length > 0, 'code has dark modules');
  const cell = Math.min(...widths);
  return Math.round(600 / cell) - 8;   // default padding is 4 modules a side
}

test('an uppercase URL rides alphanumeric mode: smaller code than its lowercase twin', { skip: SKIP }, async () => {
  // Same length, same meaning to a browser (scheme+host are case-insensitive) -
  // only the mode differs. 27 chars: byte mode needs version 3, alnum fits in 2.
  const upper = await moduleCount('HTTPS://LOLLY.TOOLS/GALLERY');
  const lower = await moduleCount('https://lolly.tools/gallery');
  assert.ok(upper < lower, `expected fewer modules for uppercase (${upper} vs ${lower})`);
});

test('a tag-2 (base32) packed link renders a smaller code than the same state as tag 1', { skip: SKIP }, async () => {
  // The end-to-end claim behind packQuery({qr:true}): more characters, fewer QR
  // bits. Same state, same URL shape, only the token flavour differs.
  const state = Array.from({ length: 12 }, (_, i) =>
    `f${i}=${encodeURIComponent(`Panel ${i}, headline text riding along`)}`).join('&');
  const b64 = await packQuery(state);
  const b32 = await packQuery(state, { qr: true });
  assert.ok(b64 && b32, 'both tokens minted');
  const prefix = 'https://lolly.tools/#/tool/design?z=';
  const tag1 = await moduleCount(prefix + b64);
  const tag2 = await moduleCount(prefix + b32);
  assert.ok(tag2 < tag1, `expected fewer modules for the base32 link (${tag2} vs ${tag1})`);
});

test('long content reaches the repaired high versions instead of erroring', { skip: SKIP }, async () => {
  // Before the v2.3.0 RS-table repair, everything needing version 19+ (about
  // 650 chars at the default ecl M) hit "code length overflow" - a share link
  // of QR-worthy size could not be encoded at all.
  const long = 'https://lolly.tools/#/tool/design?boxes=' + 'section,text,120,80~'.repeat(40);
  const count = await moduleCount(long);
  assert.ok(count >= 93, `expected a version-19+ code, got ${count} modules`);
});

test('lowercase/mixed content stays a single byte segment: same version as the byte-mode table', { skip: SKIP }, async () => {
  // 27 lowercase chars sit past the version-2 M byte limit (26): the segmenter
  // must not change where ordinary links land, or every existing printed code's
  // sizing assumption shifts.
  const count = await moduleCount('https://lolly.tools/gallery');
  assert.equal(count, 29, 'version 3 = 29 modules, exactly what byte mode always chose');
});
