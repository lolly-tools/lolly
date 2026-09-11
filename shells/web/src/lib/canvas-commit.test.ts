// SPDX-License-Identifier: MPL-2.0
/**
 * Per-canvas commit channel - attachCanvasCommit wires a mounted canvas element to
 * the runtime that owns it, so an interactive tool template resolves the channel from
 * its OWN subtree (`closest('[data-lolly-canvas]')`) and reads/writes 1:1.
 *
 * Run directly:  node --test shells/web/src/lib/canvas-commit.test.ts
 *
 * The write half (__lollyCommit / __lollyCommitQuiet / __lollyNudge) is the older
 * contract; the READ half (__lollyModel / __lollySubscribe, plan 107) is what lets a
 * data-channel tool (render.sidebar:false, e.g. Run Web Code) seed its own editor DOM
 * from the model and mirror remote edits without the template ever referencing the
 * inputs. These tests pin both halves against a minimal fake runtime.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachCanvasCommit, type CanvasCommitEl } from './canvas-commit.ts';
import type { Runtime, RuntimeState } from '../../../../engine/src/runtime.ts';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.document = dom.window.document;

interface Call { id: string; value: InputValue; }

/** A minimal fake covering only what attachCanvasCommit touches. */
function makeRuntime(model: InputModelItem[]) {
  const setInputCalls: Call[] = [];
  const noHistoryCalls: Call[] = [];
  const listeners = new Set<(s: RuntimeState) => void>();
  const rt = {
    getModel: () => model,
    subscribe(fn: (s: RuntimeState) => void) { listeners.add(fn); return () => listeners.delete(fn); },
    setInput(id: string, value: InputValue) { setInputCalls.push({ id, value }); return Promise.resolve(); },
    // mountTool installs this as the raw (undo- and collab-free) setter after mount.
    setInputNoHistory(id: string, value: InputValue) { noHistoryCalls.push({ id, value }); return Promise.resolve(); },
  } as unknown as Runtime;
  return { rt, setInputCalls, noHistoryCalls, listeners };
}

const el = (): CanvasCommitEl => document.createElement('div') as CanvasCommitEl;

test('attach stamps the data-lolly-canvas marker + installs all four channel methods', () => {
  const { rt } = makeRuntime([]);
  const canvas = el();
  attachCanvasCommit(canvas, rt);
  assert.equal(canvas.dataset.lollyCanvas, '');
  assert.equal(typeof canvas.__lollyCommit, 'function');
  assert.equal(typeof canvas.__lollyCommitQuiet, 'function');
  assert.equal(typeof canvas.__lollyModel, 'function');
  assert.equal(typeof canvas.__lollySubscribe, 'function');
});

test('__lollyModel returns the runtime model (fresh on each call)', () => {
  const model: InputModelItem[] = [{ id: 'html', type: 'longtext', value: '<h1>hi</h1>' } as unknown as InputModelItem];
  const { rt } = makeRuntime(model);
  const canvas = el();
  attachCanvasCommit(canvas, rt);
  const got = canvas.__lollyModel!();
  assert.strictEqual(got, model);
  assert.equal(got.find((i) => i.id === 'html')?.value, '<h1>hi</h1>');
});

test('__lollySubscribe forwards to runtime.subscribe and returns the unsubscribe fn', () => {
  const model: InputModelItem[] = [{ id: 'css', type: 'longtext', value: '' } as unknown as InputModelItem];
  const { rt, listeners } = makeRuntime(model);
  const canvas = el();
  attachCanvasCommit(canvas, rt);
  const seen: RuntimeState[] = [];
  const unsub = canvas.__lollySubscribe!((s) => seen.push(s));
  assert.equal(listeners.size, 1);
  // A later emission reaches the subscriber…
  const snapshot: RuntimeState = { model, hydrated: '<x/>' };
  listeners.forEach((fn) => fn(snapshot));
  assert.equal(seen.length, 1);
  assert.strictEqual(seen[0], snapshot);
  // …and the returned unsub detaches it.
  unsub();
  assert.equal(listeners.size, 0);
});

test('__lollyCommit routes through setInput (broadcast + undo), __lollyCommitQuiet through setInputNoHistory', () => {
  const { rt, setInputCalls, noHistoryCalls } = makeRuntime([]);
  const canvas = el();
  attachCanvasCommit(canvas, rt);
  canvas.__lollyCommit!('html', 'A');
  canvas.__lollyCommitQuiet!('html', 'B');
  assert.deepEqual(setInputCalls, [{ id: 'html', value: 'A' }]);
  assert.deepEqual(noHistoryCalls, [{ id: 'html', value: 'B' }]);
});

test('__lollyCommitQuiet falls back to setInput when setInputNoHistory is absent (pre-mount / CLI)', () => {
  const model: InputModelItem[] = [];
  const setInputCalls: Call[] = [];
  const rt = {
    getModel: () => model,
    subscribe() { return () => {}; },
    setInput(id: string, value: InputValue) { setInputCalls.push({ id, value }); return Promise.resolve(); },
    // no setInputNoHistory
  } as unknown as Runtime;
  const canvas = el();
  attachCanvasCommit(canvas, rt);
  canvas.__lollyCommitQuiet!('css', 'x');
  assert.deepEqual(setInputCalls, [{ id: 'css', value: 'x' }]);
});
