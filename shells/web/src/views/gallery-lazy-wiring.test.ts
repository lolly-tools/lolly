// SPDX-License-Identifier: MPL-2.0
/**
 * A gallery mount torn down before one of its lazy chunks arrives wires nothing.
 *
 * Boot mounts the gallery twice in quick succession: the first paint, then the forced
 * remount when the catalog sync arrives (main.ts refreshMountedView). The tile context
 * menu and the marquee selection are imported fire-and-forget at mount and attach their
 * listeners to the persistent #view host. When the first mount's cleanup ran before its
 * import resolved, the listeners were attached afterwards and pushed a destroy() into a
 * cleanup list that had already been drained, so they stayed for the session. The
 * stale context menu, registered first, took every right-click: it acted on the
 * torn-down mount's favourites and featured strip (so Add to favourites changed nothing
 * on screen) and its preventDefault made the live mount's own handler stand aside. The
 * fav-strip-gallery docs shot caught it, capturing the default strip on about half of
 * its runs.
 *
 * WHY A SOURCE SCAN: `mountGallery` cannot be imported outside Vite (see
 * gallery-templates.test.ts for the same note), so this asserts the guard in the source.
 *
 * Run directly:  node --test shells/web/src/views/gallery-lazy-wiring.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'gallery.ts'), 'utf-8');

/** The callback body of `void import('<spec>').then((m) => { ... })`, up to its first
 *  wiring call, comments removed. */
function lazyCallback(spec: string, wiring: string): string {
  const head = `void import('${spec}').then((m) => {`;
  const at = SRC.indexOf(head);
  assert.notEqual(at, -1, `gallery.ts still imports ${spec} lazily at mount`);
  const call = SRC.indexOf(wiring, at);
  assert.notEqual(call, -1, `${spec}: ${wiring} follows the import`);
  return SRC.slice(at + head.length, call).replace(/\/\/.*$/gm, '').trim();
}

test('the mounted flag is cleared by the mount cleanup', () => {
  assert.match(SRC, /let mounted = true;\s*cleanups\.push\(\(\) => \{ mounted = false; \}\);/);
  assert.ok(SRC.indexOf('let mounted = true;') < SRC.indexOf("void import('../lib/tile-select.ts')"),
    'declared before the first lazy wiring reads it');
});

for (const [spec, wiring] of [
  ['../lib/context-menu.ts', 'm.wireTileContextMenu('],
  ['../lib/tile-select.ts', 'm.wireTileSelect('],
] as const) {
  test(`${spec}: a torn-down mount does not wire listeners onto #view`, () => {
    const before = lazyCallback(spec, wiring);
    assert.match(before, /^if \(!mounted\) return;/, 'the callback bails before it wires anything');
  });
}
