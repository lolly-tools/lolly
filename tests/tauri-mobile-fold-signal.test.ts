// SPDX-License-Identifier: MPL-2.0
/**
 * The mobile shell's fold helper (plan 345, P4): subscribes to `lolly://fold`,
 * asks `plugin:lolly-fold|current` once, and re-dispatches valid payloads as the
 * `lolly:fold` DOM event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFoldSignal, parseFold, type FoldPayload } from '../shells/tauri-mobile/bridge-overrides/fold.ts';

const fold: FoldPayload = {
  state: 'half-opened',
  orientation: 'vertical',
  bounds: { x: 400, y: 0, width: 0, height: 800 },
  isSeparating: true,
  occlusion: 'none',
};

function rig(answer: unknown) {
  const seen: Array<FoldPayload | null> = [];
  const target = new EventTarget();
  target.addEventListener('lolly:fold', (e) => seen.push((e as CustomEvent).detail));
  let handler: ((event: { payload: unknown }) => void) | undefined;
  let release: (() => void) | undefined;
  const signal = createFoldSignal({
    target,
    listen: async (_event, h) => { handler = h; },
    invoke: () => new Promise((resolve) => { release = () => resolve(answer); }),
  });
  return { seen, signal, emit: (payload: unknown) => handler?.({ payload }), release: () => release?.() };
}

test('parseFold accepts the documented shape and null', () => {
  assert.deepEqual(parseFold(fold), fold);
  assert.equal(parseFold(null), null);
});

test('parseFold refuses anything else', () => {
  assert.equal(parseFold(undefined), undefined);
  assert.equal(parseFold('flat'), undefined);
  assert.equal(parseFold({ ...fold, state: 'tent' }), undefined);
  assert.equal(parseFold({ ...fold, orientation: 'diagonal' }), undefined);
  assert.equal(parseFold({ ...fold, occlusion: 'partial' }), undefined);
  assert.equal(parseFold({ ...fold, isSeparating: 'yes' }), undefined);
  assert.equal(parseFold({ ...fold, bounds: { x: 1, y: 2, width: Number.NaN, height: 4 } }), undefined);
  assert.equal(parseFold({ ...fold, bounds: null }), undefined);
});

test('the boot answer is dispatched and readable', async () => {
  const r = rig(fold);
  const started = r.signal.start();
  await Promise.resolve();
  r.release();
  await started;
  assert.deepEqual(r.seen, [fold]);
  assert.deepEqual(r.signal.current(), fold);
});

test('a null boot answer is dispatched as null', async () => {
  const r = rig(null);
  const started = r.signal.start();
  await Promise.resolve();
  r.release();
  await started;
  assert.deepEqual(r.seen, [null]);
  assert.equal(r.signal.current(), null);
});

test('an event that lands before the boot answer wins over it', async () => {
  const r = rig(null);
  const started = r.signal.start();
  await Promise.resolve();
  r.emit(fold);
  r.release();
  await started;
  assert.deepEqual(r.seen, [fold]);
  assert.deepEqual(r.signal.current(), fold);
});

test('later events replace the value and bad payloads are dropped', async () => {
  const r = rig(fold);
  const started = r.signal.start();
  await Promise.resolve();
  r.release();
  await started;
  r.emit({ nonsense: true });
  r.emit(null);
  assert.deepEqual(r.seen, [fold, null]);
  assert.equal(r.signal.current(), null);
});
