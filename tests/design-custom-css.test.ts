// SPDX-License-Identifier: MPL-2.0
/**
 * Design - doc-level Custom CSS (plan 112 M4): the hook sanitises the `customCss`
 * input into a `<style>` (the shell scopes it to the canvas; present re-scopes onto clones).
 * Loads the REAL tool from disk and drives it through the engine, so this guards the actual
 * render + the security posture (mirrors tests/deck-builder-style.test.ts).
 *
 * Run with: npm test  (node --test over the tests/ globs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'tools');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');
assert.ok(existsSync(join(PACK_DIR, 'design', 'tool.json')), 'design missing');

const tool: any = await loadTool('design', fetchFile);

async function render(values: Record<string, unknown>): Promise<string> {
  const rt = await createRuntime(tool, baseHost(), values as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

test('customCss: a plain rule is emitted inside a <style>', async () => {
  const html = await render({ boxes: [], customCss: '.lolly-box { color: red; }' });
  assert.match(html, /<style>[\s\S]*\.lolly-box \{ color: red; \}[\s\S]*<\/style>/);
});

test('customCss: @keyframes survive at the top level (real animation)', async () => {
  const html = await render({ boxes: [], customCss: '@keyframes spin { to { transform: rotate(360deg); } }' });
  assert.match(html, /@keyframes spin/);
});

test('customCss: the </style> breakout is neutralised — no verbatim <script> escape', async () => {
  const html = await render({ boxes: [], customCss: '.x{}</style><script>alert(1)</script>' });
  // The closing </style is backslash-neutralised, so it never terminates the <style> and
  // the <script> stays inert as style text - the verbatim breakout is absent.
  assert.ok(!/<\/style><script>/i.test(html), 'no </style><script> breakout appears verbatim');
  assert.ok(html.includes('<\\/style'), 'the </style is backslash-neutralised');
});

test('customCss: @import is stripped (offline-first, no external fetch)', async () => {
  const html = await render({ boxes: [], customCss: '@import url(http://evil.test/x.css); .a{color:blue}' });
  assert.ok(!/@import/i.test(html), '@import removed');
  assert.match(html, /\.a\{color:blue\}/, 'the rest of the CSS survives');
});

test('customCss: empty → no <style> emitted (byte-identical to before)', async () => {
  const html = await render({ boxes: [] });
  assert.ok(!html.includes('<style>'), 'no style element without customCss');
});

test('customCss: emitted regardless of frames (applies to the whole document)', async () => {
  const withFrames = await render({
    boxes: [{ id: 'f', kind: 'frame', x: 0, y: 0, w: 800, h: 600, order: 0 }],
    customCss: '.lolly-box{outline:1px solid}',
  });
  assert.match(withFrames, /<style>[\s\S]*outline:1px solid/);
});
