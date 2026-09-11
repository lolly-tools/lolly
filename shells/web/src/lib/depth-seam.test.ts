// SPDX-License-Identifier: MPL-2.0
/**
 * The depth seam (lib/depth-seam.ts) - the `window.__lollyDepth` publish that
 * `main.ts` runs at boot, split out of lib/depth-job.ts to keep the driver off
 * the boot graph (plans/155 WP-3).
 *
 * Pinned here:
 *   - the shape a tool feature-detects, and that a second boot never swaps it
 *     under an in-flight request;
 *   - no window (a worker, an SSR pass) means no seam at all;
 *   - the LAZY half: importing this module must not pull the driver in, and a
 *     driver that cannot load resolves null rather than rejecting - the contract
 *     the spatial-photo tool's flat-photo fallback relies on.
 *
 * Run: node --test shells/web/src/lib/depth-seam.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDepthSeam } from './depth-seam.ts';

const SRC = readFileSync(new URL('./depth-seam.ts', import.meta.url), 'utf8');

test('installDepthSeam publishes one forImage, is idempotent, and skips a non-window host', () => {
  const g = globalThis as unknown as { __lollyDepth?: unknown; window?: unknown };
  const hadWindow = 'window' in g;
  delete g.__lollyDepth;
  try {
    installDepthSeam();
    assert.equal(g.__lollyDepth, undefined, 'a worker or an SSR pass has no window and must get no seam');
    g.window = g;
    installDepthSeam();
    const seam = g.__lollyDepth as { forImage: unknown } | undefined;
    assert.equal(typeof seam?.forImage, 'function', 'the tool feature-detects exactly this');
    installDepthSeam();
    assert.equal(g.__lollyDepth, seam, 'a second boot must not swap the seam under an in-flight request');
  } finally {
    delete g.__lollyDepth;
    if (!hadWindow) delete g.window;
  }
});

test('the driver is reached only through a dynamic import', () => {
  // The whole point of this file: a static edge to depth-job.ts re-anchors the
  // ORT canvas helpers + the depth model catalogue to the boot preload set, and
  // nothing would fail - so this asserts the split in source rather than inferring it.
  assert.doesNotMatch(SRC, /^\s*import\s[^\n]*from\s+['"]\.\/depth-job\.ts['"]/m,
    'depth-seam.ts must not statically import the depth driver');
  assert.match(SRC, /import\(\s*['"]\.\/depth-job\.ts['"]\s*\)/,
    'and must reach it through import() so the bytes load on the first request');
});
