// SPDX-License-Identifier: MPL-2.0
/**
 * The Inspector's aspect lock and Scale % (design-inspector-aspect.ts).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-inspector-aspect.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAspectLocks, lockedSides, sizeAndScaleRows, wireAspectLocks } from './design-inspector-aspect.ts';
import type { AspectScaleCtx } from './design-inspector-aspect.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'HTMLElement', 'MouseEvent']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const cfg = { idField: 'id', wField: 'w', hField: 'h' } as unknown as BoxFieldConfig;

interface Harness {
  ctx: AspectScaleCtx;
  cells: Map<string, { value: number | 'mixed'; onCommit?(v: number): void }>;
  commits: Box[][];
  fields: Array<[string[], string, unknown]>;
  scaled: number[];
  resyncs: number;
}

function harness(opts: { scale?: number; scaleResult?: boolean; withScale?: boolean } = {}): Harness {
  const rows: Box[] = [{ id: 'a', w: 200, h: 100 } as Box];
  const h: Harness = { ctx: undefined as never, cells: new Map(), commits: [], fields: [], scaled: [], resyncs: 0 };
  const cell = (label: string, field: string | undefined, value: number | 'mixed', o: { onCommit?(v: number): void } = {}): string => {
    h.cells.set(field ?? 'scale', { value, onCommit: o.onCommit });
    return `<span data-cell="${field ?? 'scale'}">${label}</span>`;
  };
  const model = {
    getBoxes: () => rows,
    commit: (next: Box[]) => { h.commits.push(next); },
    setField: (ids: string[], field: string, value: unknown) => { h.fields.push([ids, field, value]); },
  } as unknown as ModelPort;
  h.ctx = {
    model, cfg, id: 'a', w: 200, h: 100, dimCell: cell, numCell: cell, scale: opts.scale ?? 1,
    scaleSelection: opts.withScale === false ? undefined : (k) => { h.scaled.push(k); return opts.scaleResult ?? true; },
    resync: () => { h.resyncs++; },
  };
  return h;
}

test('lockedSides holds the ratio from either side', () => {
  assert.deepEqual(lockedSides(200, 100, 'w', 400), { w: 400, h: 200 });
  assert.deepEqual(lockedSides(200, 100, 'h', 50), { w: 100, h: 50 });
});

test('lockedSides pulls both sides in step at the bounds', () => {
  assert.deepEqual(lockedSides(200, 100, 'h', 0), { w: 2, h: 1 });
  assert.deepEqual(lockedSides(200, 100, 'w', 1e9), { w: 100000, h: 50000 });
  assert.deepEqual(lockedSides(0, 100, 'w', 50), { w: 0, h: 100 });
});

test('an unlocked side writes one field; a locked one commits both in one commit', () => {
  const locks = createAspectLocks();
  const h = harness();
  sizeAndScaleRows(h.ctx, locks);
  h.cells.get('w')!.onCommit!(300);
  assert.deepEqual(h.fields, [[['a'], 'w', 300]]);
  assert.equal(h.commits.length, 0);
  locks.toggle('a');
  h.cells.get('h')!.onCommit!(50);
  assert.equal(h.commits.length, 1);
  assert.deepEqual(h.commits[0]![0], { id: 'a', w: 100, h: 50 });
  assert.equal(h.fields.length, 1);
});

test('a displayed unit converts to CSS px before the ratio is held', () => {
  const locks = createAspectLocks();
  locks.toggle('a');
  const h = harness({ scale: 2 });
  sizeAndScaleRows(h.ctx, locks);
  h.cells.get('w')!.onCommit!(150);
  assert.deepEqual(h.commits[0]![0], { id: 'a', w: 300, h: 150 });
});

test('the lock button toggles per box and mirrors its state', () => {
  const locks = createAspectLocks();
  const h = harness();
  const root = document.createElement('div');
  root.innerHTML = sizeAndScaleRows(h.ctx, locks);
  wireAspectLocks(root, locks);
  const btn = root.querySelector<HTMLButtonElement>('[data-aspect-lock]')!;
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  btn.dispatchEvent(new (dom.window as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent('click', { bubbles: true }));
  assert.equal(locks.has('a'), true);
  assert.equal(root.querySelector('[data-aspect-lock]')!.getAttribute('aria-pressed'), 'true');
});

test('Scale % commits a factor, resyncs when nothing was written, and is absent without the verb', () => {
  const locks = createAspectLocks();
  let h = harness();
  sizeAndScaleRows(h.ctx, locks);
  assert.equal(h.cells.get('scale')!.value, 100);
  h.cells.get('scale')!.onCommit!(150);
  assert.deepEqual(h.scaled, [1.5]);
  assert.equal(h.resyncs, 0);
  h = harness({ scaleResult: false });
  sizeAndScaleRows(h.ctx, locks);
  h.cells.get('scale')!.onCommit!(150);
  assert.equal(h.resyncs, 1);
  h = harness({ withScale: false });
  sizeAndScaleRows(h.ctx, locks);
  assert.equal(h.cells.has('scale'), false);
});
