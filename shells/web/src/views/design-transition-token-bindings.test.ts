// SPDX-License-Identifier: MPL-2.0
/** Enter links validate both projections and preserve each layer's timeline placement. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { BlockFieldSpec } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { readBlockTokenBindings, resolveBlockTokenBindings } from '../../../../engine/src/token-block-bindings.ts';
import { mountDesignTokenBindings } from './design-token-bindings.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';

const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'AbortController']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const fields: BlockFieldSpec[] = [{ id: 'enterMs', type: 'number', min: 100, max: 3000, default: 400 }, { id: 'enterEase', type: 'text' }];
const transition = (duration = 800, delay = 0, timingFunction = [0.2, 0.8, 0.4, 1]) => ({ $type: 'transition', $value: { duration: { value: duration, unit: 'ms' }, delay: { value: delay, unit: 'ms' }, timingFunction } });
const set = createTokenSet({ motion: transition(), delayed: transition(800, 100), long: transition(3001), short: transition(99), badCurve: transition(800, 0, [1.1, 0, 0.4, 1]), min: transition(100), max: transition(3000), scalar: { $type: 'duration', $value: { value: 600, unit: 'ms' } } });
const initial = (): Box => ({ id: 'a', kind: 'box', enter: 'rise', enterMs: 400, enterEase: '', exit: 'fade', exitMs: 300, exitEase: 'ease-in', start: 2, dur: 6, build: 3, lane: 'art' });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function harness(initialRows = [initial()], host = { tokens: { get: async () => set } } as HostV1, declared = fields) {
  let rows = initialRows, commits = 0;
  const past: Box[][] = [], future: Box[][] = [];
  const root = document.createElement('div'); document.body.append(root);
  const model: ModelPort = { blockId: 'boxes', cfg: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot', kindField: 'kind', enterMsField: 'enterMs', enterEaseField: 'enterEase' } as BoxFieldConfig, frame: { frameField: 'frame', frameKind: 'frame', orderField: 'order' }, getBoxes: () => rows, commit: next => { past.push(rows); future.length = 0; rows = next; commits++; }, setField: () => {}, subscribe: () => () => {}, getInput: () => 'sdr', setInput: () => {} };
  let dispose = () => {}, selected = initialRows.map(row => String(row.id));
  const mount = (ids = selected) => { dispose(); selected = ids; dispose = mountDesignTokenBindings(root, { host, metadataField: 'links', fields: declared, fieldIds: declared.map(field => field.id), model, ids }); };
  mount();
  const property = (id = '__transition') => { const picker = root.querySelector<HTMLSelectElement>('[data-design-token-property]')!; assert.ok([...picker.options].some(option => option.value === id)); picker.value = id; picker.dispatchEvent(new Event('change')); };
  const candidates = async () => { root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick(); return root.querySelector<HTMLSelectElement>('[data-token-options] select')!; };
  const choose = async (id = 'motion') => { const picker = await candidates(); assert.ok([...picker.options].some(option => option.value === id)); picker.value = id; picker.dispatchEvent(new Event('change')); await tick(); return root.querySelector<HTMLButtonElement>('[data-token-link]')!; };
  const undo = () => { if (past.length) { future.push(rows); rows = past.pop()!; } };
  const redo = () => { if (future.length) { past.push(rows); rows = future.pop()!; } };
  return { root, property, candidates, choose, remount: mount, rows: () => rows, replace: (next: Box[]) => { rows = next; }, commits: () => commits, undo, redo, destroy: () => { dispose(); root.remove(); } };
}

test('Enter transition appears only for a single non-frame layer with both declared targets', () => {
  for (const [rows, declared, expected] of [[[{ ...initial(), kind: 'frame' }], fields, false], [[initial(), { ...initial(), id: 'b' }], fields, false], [[initial()], fields.slice(0, 1), false], [[initial()], fields, true]] as const) {
    const h = harness([...rows], undefined, [...declared]);
    try { assert.equal([...h.root.querySelectorAll<HTMLOptionElement>('[data-design-token-property] option')].some(option => option.value === '__transition'), expected); } finally { h.destroy(); }
  }
});

test('a whole Enter transition applies both fields in one undo step without changing timeline placement', async () => {
  const h = harness();
  try {
    h.property(); assert.match(h.root.textContent!, /geometry easing.*Opacity keeps the preset easing/);
    const button = await h.choose(); assert.equal(button.disabled, false); assert.equal(h.commits(), 0);
    button.click(); await tick(); assert.equal(h.commits(), 1);
    const row = h.rows()[0]!;
    assert.deepEqual({ ...row, enterMs: 400, enterEase: '', links: undefined }, { ...initial(), links: undefined });
    assert.deepEqual([row.enterMs, row.enterEase], [800, 'cubic-bezier(0.2,0.8,0.4,1)']);
    const links = readBlockTokenBindings(row.links);
    assert.equal(links.enterMs?.adapter, 'transition.duration-ms'); assert.equal(links.enterEase?.adapter, 'transition.timingFunction');
    h.undo(); assert.deepEqual(h.rows(), [initial()]); h.redo(); assert.deepEqual(h.rows()[0], row);
    h.remount(); h.property(); assert.match(h.root.textContent!, /Linked: \{motion\}/); assert.ok(h.root.querySelector('[data-token-inspect]'));
  } finally { h.destroy(); }
});

test('delayed, out-of-range and malformed transitions stay visible with Link disabled and a reason', async () => {
  const h = harness();
  try {
    h.property();
    for (const [id, reason] of [['delayed', /cannot apply a delay/], ['long', /outside this field range/], ['short', /outside this field range/], ['badCurve', /four finite controls/]] as const) {
      const button = await h.choose(id); assert.equal(button.disabled, true); button.click(); await tick();
      const picker = h.root.querySelector<HTMLSelectElement>('[data-token-options] select')!;
      assert.match(picker.selectedOptions[0]!.text, /Incompatible/); assert.match(h.root.querySelector('[data-token-message]')!.textContent!, reason);
      assert.equal(h.commits(), 0); assert.deepEqual(h.rows(), [initial()]);
    }
    const picker = await h.candidates(); assert.ok(![...picker.options].some(option => option.value === 'scalar'));
    for (const id of ['min', 'max']) { const button = await h.choose(id); assert.equal(button.disabled, false); }
  } finally { h.destroy(); }
});

test('individual duration remains custom through refresh and whole Restore replaces both fields in one undo step', async () => {
  let theme = set;
  const h = harness([initial()], { tokens: { get: async () => theme } } as HostV1);
  try {
    h.property(); (await h.choose()).click(); await tick();
    const nextTheme = createTokenSet({ motion: transition(1200, 0, [0.1, 0.6, 0.3, 1]) });
    h.replace(resolveBlockTokenBindings([{ ...h.rows()[0], enterMs: 900 }], 'links', fields, nextTheme) as Box[]); theme = nextTheme;
    assert.equal(h.rows()[0]!.enterMs, 900); assert.equal(h.rows()[0]!.enterEase, 'cubic-bezier(0.1,0.6,0.3,1)');
    assert.equal(readBlockTokenBindings(h.rows()[0]!.links).enterMs?.custom, true); assert.equal(readBlockTokenBindings(h.rows()[0]!.links).enterEase?.custom, undefined);
    const beforeRestore = h.rows(); h.remount(); h.property();
    h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.equal(h.commits(), 2); assert.deepEqual([h.rows()[0]!.enterMs, h.rows()[0]!.enterEase], [1200, 'cubic-bezier(0.1,0.6,0.3,1)']);
    assert.ok(Object.values(readBlockTokenBindings(h.rows()[0]!.links)).every(link => !link.custom));
    h.undo(); assert.deepEqual(h.rows(), beforeRestore); h.redo(); assert.equal(h.rows()[0]!.enterMs, 1200);
  } finally { h.destroy(); }
});

test('individual easing Restore uses its saved transition projection while whole Make custom preserves both literals', async () => {
  const h = harness();
  try {
    h.property(); (await h.choose()).click(); await tick();
    h.replace(resolveBlockTokenBindings([{ ...h.rows()[0], enterEase: 'linear' }], 'links', fields, set) as Box[]);
    h.remount(); h.property('enterEase'); h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.equal(h.commits(), 2); assert.equal(h.rows()[0]!.enterEase, 'cubic-bezier(0.2,0.8,0.4,1)');
    h.remount(); h.property(); h.root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click(); await tick();
    assert.equal(h.commits(), 3); assert.deepEqual([h.rows()[0]!.enterMs, h.rows()[0]!.enterEase], [800, 'cubic-bezier(0.2,0.8,0.4,1)']);
    assert.ok(Object.values(readBlockTokenBindings(h.rows()[0]!.links)).every(link => link.custom));
  } finally { h.destroy(); }
});

test('individual duration Restore preserves its transition adapter and supports a scalar duration replacement', async () => {
  const h = harness();
  try {
    h.property(); (await h.choose()).click(); await tick();
    h.replace(resolveBlockTokenBindings([{ ...h.rows()[0], enterMs: 900 }], 'links', fields, set) as Box[]);
    h.remount(); h.property('enterMs'); h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.equal(h.commits(), 2); assert.equal(h.rows()[0]!.enterMs, 800); assert.equal(readBlockTokenBindings(h.rows()[0]!.links).enterMs?.adapter, 'transition.duration-ms');
    h.remount(); h.property('enterMs'); const picker = await h.candidates(); picker.value = 'scalar'; picker.dispatchEvent(new Event('change')); await tick();
    assert.equal(h.commits(), 3); assert.equal(h.rows()[0]!.enterMs, 600); assert.equal(readBlockTokenBindings(h.rows()[0]!.links).enterMs?.adapter, 'duration-ms');
    assert.equal(h.rows()[0]!.enterEase, 'cubic-bezier(0.2,0.8,0.4,1)');
  } finally { h.destroy(); }
});

test('whole Restore refuses an out-of-range source duration and preserves the local duration and active easing', async () => {
  let theme = set;
  const h = harness([initial()], { tokens: { get: async () => theme } } as HostV1);
  try {
    h.property(); (await h.choose()).click(); await tick();
    theme = createTokenSet({ motion: transition(4000, 0, [0.1, 0.6, 0.3, 1]) });
    h.replace(resolveBlockTokenBindings([{ ...h.rows()[0], enterMs: 900 }], 'links', fields, theme) as Box[]);
    assert.deepEqual([h.rows()[0]!.enterMs, h.rows()[0]!.enterEase], [900, 'cubic-bezier(0.1,0.6,0.3,1)']);
    const beforeRestore = h.rows(); h.remount(); h.property(); h.root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick();
    assert.equal(h.commits(), 1); assert.deepEqual(h.rows(), beforeRestore); assert.equal(readBlockTokenBindings(h.rows()[0]!.links).enterMs?.custom, true);
    assert.match(h.root.querySelector('[data-token-message]')!.textContent!, /outside this field range/);
  } finally { h.destroy(); }
});

test('a transition becoming delayed during the final lookup refuses both fields before any write', async () => {
  let calls = 0;
  const invalid = createTokenSet({ motion: transition(1800, 100) });
  const h = harness([initial()], { tokens: { get: async () => ++calls === 3 ? invalid : set } } as HostV1);
  try {
    h.property(); (await h.choose()).click(); await tick();
    assert.equal(calls, 3); assert.equal(h.commits(), 0); assert.deepEqual(h.rows(), [initial()]); assert.match(h.root.textContent!, /cannot apply a delay/);
  } finally { h.destroy(); }
});

test('a pending Enter action refuses changed duration or frame kind and cancels after selection disposal', async () => {
  for (const change of ['duration', 'frame', 'selection']) {
    let calls = 0, finish: (value: typeof set) => void = () => {};
    const pending = new Promise<typeof set>(resolve => { finish = resolve; });
    const h = harness([initial(), { ...initial(), id: 'b' }], { tokens: { get: () => ++calls === 3 ? pending : Promise.resolve(set) } } as HostV1);
    try {
      h.remount(['a']); h.property(); (await h.choose()).click(); await tick(); assert.equal(calls, 3); assert.equal(h.commits(), 0);
      if (change === 'selection') h.remount(['b']); else h.replace(h.rows().map(row => row.id === 'a' ? { ...row, ...(change === 'frame' ? { kind: 'frame' } : { enterMs: 900 }) } : row));
      finish(set); await tick(); assert.equal(h.commits(), 0);
      if (change !== 'selection') assert.match(h.root.textContent!, /These layer values changed/);
    } finally { h.destroy(); }
  }
});
