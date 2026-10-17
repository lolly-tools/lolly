// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-revision-history.ts mountActionHistory, over the real controller, state
 * bridge and revision store on the in-memory IndexedDB (plan 277 P4, phase 1):
 *
 * - a write made before the chosen emoji set's artwork pins arrive is followed by one
 *   that carries them (phase 0 finding 1), and pins arriving before any edit write
 *   nothing, so opening a tool still files no creation;
 * - pins arriving while an explicit save takes its picture wait for that picture, so
 *   the save keeps its preview and Projects tile, while a real edit or another emoji
 *   set still drops it; flush, close and a cap release the wait when no picture comes;
 * - a tool with no export bar (Text) still has its slot remembered by the browser
 *   entry, until the controller is disposed;
 * - a page too large to photograph keeps its checkpoints without a preview.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-revision-history.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from '../bridge/idb-memory.test-utils.ts';
import type { SavedStateData, StateDb } from '../bridge/state.ts';
import type { EmojiStyleV1 } from '@lolly-tools/core';
import { emojiParams } from '../../../../engine/src/emoji-style.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/t/qr-code', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history, FileReader: dom.window.FileReader });

const { createStateAPI } = await import('../bridge/state.ts');
const { createRevisionStore } = await import('../bridge/revision-history.ts');
const { mountActionHistory, documentWords, PREVIEW_MAX_ELEMENTS, PREVIEW_TIMING, SAVE_PICTURE_TIMING } = await import('./tool-revision-history.ts');
// A preview waits for a pause; the tests shorten the wait, keep the interval long.
Object.assign(PREVIEW_TIMING, { quietMs: 30, idleTimeoutMs: 10, intervalMs: 60_000 });
const PNG = new dom.window.Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' });
const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const pin = { source: 'user', id: 'user/emoji/abc', type: 'data', format: 'json', pin: { version: 'abc', format: 'json' } };
// The style a fresh session saves with, and another set a person could pick instead.
const STYLE: EmojiStyleV1 = { schemaVersion: 1, primary: { id: 'community/emoji/fluent/high-contrast', pin: { version: '2026.8.24' }, checksum: `sha256:${'a'.repeat(64)}` }, fallbacks: [], metricsPolicy: 'inline-em-v1', treatment: { mode: 'original', strengthBps: 0 } };
const OTHER: EmojiStyleV1 = { ...STYLE, primary: { id: 'community/emoji/twemoji', pin: { version: '17.0.3' }, checksum: `sha256:${'b'.repeat(64)}` } };

function mount(snapshot: () => SavedStateData, opts: { canvas?: HTMLElement | null; rendered?: () => void } = {}) {
  const { db: memory } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  const listeners = new Set<(emoji: { assets?: readonly unknown[]; style?: EmojiStyleV1 | null }) => void>();
  let slot: string | null = null;
  const host = { state, export: { render: async () => { opts.rendered?.(); return PNG; } } };
  const controller = mountActionHistory({
    enabled: true, host: host as never, toolId: 'qr-code', el: null, canvas: opts.canvas ?? null,
    getSlot: () => slot, setSlot: next => { slot = next; }, takeFolder: () => null, snapshot,
    onEmojiChange: listener => { listeners.add(listener); return () => listeners.delete(listener); },
  });
  assert.ok(controller, 'history mounts');
  return { state, controller, slot: () => slot, emit: (assets: readonly unknown[], style: EmojiStyleV1 | null = STYLE) => { for (const listener of listeners) listener({ assets, style }); } };
}

test('a write before the emoji pins arrive is followed by one that carries them; pins arriving before an edit write nothing', async () => {
  let pins: unknown[] = [];
  const env = mount(() => ({ __toolId: 'qr-code', url: 'https://example.com', __emoji: { emoji: 'community/emoji/twemoji@17.0.3', emojifx: 'original' }, __emojiAssets: pins }));
  const { controller } = env;
  try {
    // Opening the tool: the Emoji section resolves its pins, and nobody has edited.
    env.emit([pin]);
    await controller.flush();
    assert.deepEqual(await env.state.list(), [], 'no creation is filed without an edit');
    env.emit([]);

    controller.changed();
    await controller.flush();
    const slot = env.slot();
    assert.ok(slot);
    assert.deepEqual((await env.state.load(slot))?.__emojiAssets, [], 'the first write went out before the pins');

    pins = [pin];
    env.emit(pins);
    await controller.flush();
    assert.deepEqual((await env.state.load(slot))?.__emojiAssets, [pin], 'the pins arriving counted as a change');

    // Once the record carries them, a later emoji pass is not a change.
    const before = (await env.state.load(slot))?.__emojiAssets;
    env.emit(pins);
    await controller.flush();
    assert.deepEqual((await env.state.load(slot))?.__emojiAssets, before);
  } finally { controller.dispose(); }
});

test('pins arriving while a save takes its picture wait for it: the Projects tile keeps the picture and the pins follow', async () => {
  // The Save action writes the record, then photographs the scene and attaches the
  // picture (tool-actions/saving.ts). The Emoji section can resolve its pins in
  // between; that changes nothing the picture shows, so the picture must survive.
  const THUMB = 'data:image/png;base64,SAVE';
  let pins: unknown[] = [];
  const data = (): SavedStateData => ({ __toolId: 'qr-code', url: 'https://example.com', __emoji: emojiParams(STYLE), __emojiAssets: pins });
  const env = mount(data);
  const { controller } = env;
  try {
    const slot = 'qr-code:picture';
    assert.equal(await controller.save(slot, data()), 'recorded');
    pins = [pin];
    env.emit(pins);
    await controller.attachSaveThumbnail(THUMB);
    const tile = async (): Promise<string | null | undefined> => (await env.state.list()).find(item => item.slot === slot)?.thumb;
    assert.equal(await tile(), THUMB, 'the save keeps its picture');
    // Released by the picture, the pins reach the record in a draft of their own,
    // which keeps the tile's picture.
    await controller.flush();
    assert.deepEqual((await env.state.load(slot))?.__emojiAssets, [pin], 'the pins reach the record after the picture');
    assert.equal(await tile(), THUMB);
  } finally { controller.dispose(); }

  // A save whose picture is not coming releases the pins at once, without a flush.
  pins = [];
  const next = mount(data);
  try {
    const slot = 'qr-code:no-picture';
    assert.equal(await next.controller.save(slot, data()), 'recorded');
    pins = [pin];
    next.emit(pins);
    await next.controller.attachSaveThumbnail(null);
    const pinned = async (): Promise<boolean> => { const held = (await next.state.load(slot))?.__emojiAssets; return Array.isArray(held) && held.length > 0; };
    for (let waited = 0; waited < 3000 && !(await pinned()); waited += 50) await pause(50);
    assert.deepEqual((await next.state.load(slot))?.__emojiAssets, [pin], 'the recovery draft carries the pins');
  } finally { next.controller.dispose(); }
});

test('pins arriving while the save is still writing also wait for the picture; a real edit in that gap still costs the picture', async () => {
  const THUMB = 'data:image/png;base64,SAVE';
  let pins: unknown[] = [];
  const data = (): SavedStateData => ({ __toolId: 'qr-code', url: 'https://example.com', __emoji: emojiParams(STYLE), __emojiAssets: pins });
  const tile = async (env: ReturnType<typeof mount>, slot: string): Promise<string | null | undefined> => (await env.state.list()).find(item => item.slot === slot)?.thumb;

  const env = mount(data);
  try {
    const slot = 'qr-code:pins-while-writing';
    const saving = env.controller.save(slot, data());
    pins = [pin];
    env.emit(pins);
    assert.equal(await saving, 'recorded');
    await env.controller.attachSaveThumbnail(THUMB);
    assert.equal(await tile(env, slot), THUMB, 'the save keeps its picture');
    await env.controller.flush();
    assert.deepEqual((await env.state.load(slot))?.__emojiAssets, [pin]);
  } finally { env.controller.dispose(); }

  // A real edit in that gap makes the picture out of date, so it is still dropped.
  pins = [];
  const edited = mount(data);
  try {
    const slot = 'qr-code:edited';
    assert.equal(await edited.controller.save(slot, data()), 'recorded');
    edited.controller.changed();
    await edited.controller.attachSaveThumbnail(THUMB);
    assert.notEqual(await tile(edited, slot), THUMB, 'a picture older than the creation is not attached');
  } finally { edited.controller.dispose(); }

  // Pins for another set mean the person changed the set during the save: an edit.
  pins = [];
  const other = mount(data);
  try {
    const slot = 'qr-code:other-set';
    assert.equal(await other.controller.save(slot, data()), 'recorded');
    other.emit([pin], OTHER);
    await other.controller.attachSaveThumbnail(THUMB);
    assert.notEqual(await tile(other, slot), THUMB, 'a picture of the set the save recorded is not attached after another set arrived');
  } finally { other.controller.dispose(); }
});

test('pins waiting for a picture that never comes reach the record on flush, on close or at the cap', async () => {
  let pins: unknown[] = [];
  const data = (): SavedStateData => ({ __toolId: 'qr-code', url: 'https://example.com', __emoji: emojiParams(STYLE), __emojiAssets: pins });
  const pinned = async (env: ReturnType<typeof mount>, slot: string): Promise<unknown> => (await env.state.load(slot))?.__emojiAssets;
  /** A recorded save, then the pins, and no attachSaveThumbnail. */
  const waiting = async (slot: string): Promise<ReturnType<typeof mount>> => {
    pins = [];
    const env = mount(data);
    assert.equal(await env.controller.save(slot, data()), 'recorded');
    pins = [pin];
    env.emit(pins);
    return env;
  };

  // Hiding the page or leaving: the record gets the pins at once.
  const hidden = await waiting('qr-code:flush');
  try {
    await hidden.controller.flush();
    assert.deepEqual(await pinned(hidden, 'qr-code:flush'), [pin], 'flush writes the waiting pins');
  } finally { hidden.controller.dispose(); }

  const closed = await waiting('qr-code:close');
  try {
    await closed.controller.close();
    assert.deepEqual(await pinned(closed, 'qr-code:close'), [pin], 'close writes the waiting pins');
  } finally { closed.controller.dispose(); }

  // A caller that never answers: the cap releases the pins without a flush.
  const cap = SAVE_PICTURE_TIMING.waitMs;
  SAVE_PICTURE_TIMING.waitMs = 30;
  try {
    const silent = await waiting('qr-code:cap');
    try {
      const held = async (): Promise<boolean> => { const value = await pinned(silent, 'qr-code:cap'); return Array.isArray(value) && value.length > 0; };
      for (let waited = 0; waited < 3000 && !(await held()); waited += 50) await pause(50);
      assert.deepEqual(await pinned(silent, 'qr-code:cap'), [pin], 'the cap releases the pins to the recovery draft');
    } finally { silent.controller.dispose(); }
  } finally { SAVE_PICTURE_TIMING.waitMs = cap; }
});

test('with no export bar, the browser entry remembers the slot until the controller is disposed', async () => {
  window.history.replaceState({ lollyUnsaved: 'qr-code' }, '', location.href);
  const canvas = document.createElement('div');
  document.body.append(canvas);
  let value = 'first';
  const env = mount(() => ({ __toolId: 'qr-code', url: value }), { canvas });
  env.controller.changed();
  await env.controller.flush();
  const remembered = (window.history.state as { lollyHistory?: { slot?: string }; lollyUnsaved?: string });
  assert.equal(remembered.lollyHistory?.slot, env.slot());
  assert.equal(remembered.lollyUnsaved, 'qr-code', 'the entry keeps what it already held');

  // Leaving: a write still in flight must not point the next view's entry at this slot.
  window.history.replaceState({}, '', location.href);
  value = 'second';
  env.controller.changed();
  const last = env.controller.flush();
  env.controller.dispose();
  await last;
  assert.equal((window.history.state as { lollyHistory?: unknown }).lollyHistory, undefined);
  canvas.remove();
});

test('a preview waits for a pause, skips a page too large to photograph, and is not taken at every checkpoint', async () => {
  /** Mount on a page of `count` elements; `checkpoint` edits the document and writes a checkpoint. */
  const photographed = async (count: number, edit: (checkpoint: () => Promise<void>, changed: () => void) => Promise<void>): Promise<{ renders: number; kept: number }> => {
    const canvas = document.createElement('div');
    for (let i = 0; i < count; i++) canvas.append(document.createElement('span'));
    document.body.append(canvas);
    let renders = 0, n = 0;
    const env = mount(() => ({ __toolId: 'qr-code', url: `https://example.com/${count}/${n}` }), { canvas, rendered: () => { renders++; } });
    try {
      await edit(async () => { n++; env.controller.changed(); await env.controller.flush(); }, () => { n++; env.controller.changed(); });
      const slot = env.slot();
      return { renders, kept: slot ? (await env.state.history!.list({ slot })).entries.length : 0 };
    } finally { env.controller.dispose(); canvas.remove(); }
  };
  // A small page, left alone: one photograph. A second checkpoint soon after: none.
  assert.deepEqual(await photographed(12, async checkpoint => { await checkpoint(); await pause(120); await checkpoint(); await pause(120); }), { renders: 1, kept: 2 });
  // Too large to photograph: the checkpoint is kept, with no preview.
  assert.deepEqual(await photographed(PREVIEW_MAX_ELEMENTS + 100, async checkpoint => { await checkpoint(); await pause(120); }), { renders: 0, kept: 1 });
  // An edit during the wait: no photograph; the next checkpoint offers again.
  assert.equal((await photographed(12, async (checkpoint, changed) => { await checkpoint(); changed(); await pause(120); })).renders, 0);
});

test('documentWords: the first prose longtext, else the first two text inputs, never a JSON value', () => {
  const inputs = [{ id: 'source', type: 'longtext' }, { id: 'body', type: 'longtext' }, { id: 'heading', type: 'text' }, { id: 'sub', type: 'text' }, { id: 'more', type: 'text' }];
  assert.deepEqual(documentWords(inputs, new Map<string, unknown>([['source', '{"name":"a.md"}'], ['body', ' Notes '], ['heading', 'Hi']])), ['Notes']);
  assert.deepEqual(documentWords(inputs, new Map<string, unknown>([['body', ''], ['heading', 'Find us'], ['sub', '[1]'], ['more', 'One link']])), ['Find us', 'One link']);
  assert.deepEqual(documentWords(inputs, new Map()), []);
});
