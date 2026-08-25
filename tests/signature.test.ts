// SPDX-License-Identifier: MPL-2.0
/**
 * Signature (community/signature) - path-data acceptance.
 *
 * Loads the REAL tool (manifest + template + hooks) and drives it through the
 * engine with host.geom wired exactly as the shells attach it. Pins the fix for
 * a pasted/authored signature (curves + relative moves) that the pad-only M/L
 * parser used to count as "unreadable" and drop:
 *  - a designed bezier path renders verbatim, one <path>, no warning;
 *  - trim reframes to the ink's curve-aware box, not the full 1200x400 frame;
 *  - the tool's own default is such a path and hydrates cleanly;
 *  - the pad's plain M/L polyline still parses and smooths as before.
 *
 * Run with: node --test tests/signature.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const PKG = join(COMMUNITY, 'signature');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(PKG, 'tool.json')),
    'community/signature/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('signature', fetchFile);
// host.geom is what makes a curved path trimmable; every real shell attaches it.
const host = () => baseHost({ geom: makeGeomApi() });

async function mount(values: Record<string, any> = {}) {
  const rt = await createRuntime(tool, host(), values);
  return { rt, html: rt.getHydrated() as string };
}

const CURSIVE =
  'm4 13q23 0 39-3m-42 12q2 0 6-7q7-13 11-13c3 0-13 28-6 20c14-14 17-25 11-17s-5 19-7 21s-6 2-2-2l10-9s-5 11-1 7l13-17c-24 31-2 9 2 9s-3 4-5 6s2-1 3 0s-6 4-6 7s11-9 19-9';

test('pasted bezier signature renders verbatim and trims to the ink', { skip: SKIP }, async () => {
  const { html } = await mount({ strokes: CURSIVE, trim: true });
  // The exact path data survives into the rendered <path>, curves and all.
  assert.ok(html.includes('d="' + CURSIVE + '"'), 'path data was not rendered verbatim');
  // No "unreadable" warning - the whole point of the fix.
  assert.ok(!/unreadable|not readable/.test(html), 'a warning was shown for a valid path');
  // Trimmed: the viewBox is the ink box (~1 2 48 25), not the full frame.
  const vb = /viewBox="([^"]+)"/.exec(html)?.[1] ?? '';
  assert.notEqual(vb, '0 0 1200 400', 'viewBox was not trimmed to the ink');
  const [, , w = 0, h = 0] = vb.split(/\s+/).map(Number);
  assert.ok(w > 0 && w < 200 && h > 0 && h < 200, `trimmed frame looks wrong: ${vb}`);
});

test('the tool default is the cursive path and hydrates clean', { skip: SKIP }, async () => {
  const { html } = await mount(); // no values -> manifest default
  assert.ok(html.includes('d="' + CURSIVE + '"'), 'default did not render the cursive signature');
  assert.ok(!/Sign here/.test(html), 'empty-pad hint showed despite a default signature');
  // Painted with currentColor (follows theme fg), pen defaults to 1, and with no
  // ink picked the wrapper sets no fixed colour so currentColor cascades.
  assert.match(html, /stroke="currentColor" stroke-width="1"/, 'not painted with currentColor at pen 1');
  assert.doesNotMatch(html, /class="sg-wrap"[^>]*style="color:/, 'a fixed ink colour was pinned by default');
});

test('a picked ink pins the wrapper colour (currentColor inherits it)', { skip: SKIP }, async () => {
  const { html } = await mount({ color: '#1d4ed8' });
  assert.match(html, /class="sg-wrap"[^>]*style="color:#1d4ed8"/, 'picked ink was not applied');
  assert.match(html, /stroke="currentColor"/, 'paths must still paint currentColor so the pin cascades');
});

test('pen width clamps to the 0.25..7 range', { skip: SKIP }, async () => {
  const wide = await mount({ penWidth: 40 });
  assert.match(wide.html, /stroke-width="7"/, 'pen width did not clamp down to 7');
  const fine = await mount({ penWidth: 0.1 });
  assert.match(fine.html, /stroke-width="0.25"/, 'pen width did not clamp up to 0.25');
});

test('foreign characters in path data are refused, not injected raw', { skip: SKIP }, async () => {
  const { html } = await mount({ strokes: 'm4 13 <script>alert(1)</script>' });
  assert.ok(!/<script>alert/.test(html), 'foreign markup leaked into the sheet');
  assert.ok(/not readable/.test(html), 'no warning for unreadable path data');
});

test('the pad\'s own M/L polyline still parses and draws', { skip: SKIP }, async () => {
  const { html } = await mount({ strokes: 'M100,200L140,180L180,210', smoothing: 0, trim: false });
  assert.match(html, /<path d="M100,200L140,180L180,210"/, 'plain polyline path changed');
});
