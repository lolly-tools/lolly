// SPDX-License-Identifier: MPL-2.0
/**
 * Design NAVIGATOR tests (plans/179 M2, spec section 4).
 *
 * The module talks to the editor only through the ports in design-ports.ts, so the whole
 * column runs here against fakes: an in-memory model that echoes every write back through
 * `getBoxes` (a real round-trip, not a stubbed answer), a `SelectionPort` backed by a Set
 * that actually notifies, an `ArtboardPort` whose `focus` moves the active board, and a
 * thumbnail factory that hands back a countable node.
 *
 * The claims worth pinning, each of which is a bug the column would otherwise ship:
 *   • ONE list, in page order (order asc, x asc) - the same key the tool's hook uses;
 *   • rename is ONE commit through setField, never a whole-array rewrite;
 *   • reorder writes DENSE 0..n-1 `order` and does not touch `x` (plans/179 A9: moving a
 *     page's x drags its children, and the hook prefers order anyway);
 *   • the dwell chip needs BOTH a positive dur and auto-advance actually on - a chip that
 *     shows a dwell nothing honours is the class of lie this whole plan is about;
 *   • layers are the active board's children REVERSED (top of the list paints on top);
 *   • destroy unsubscribes every port it subscribed to, and takes its node with it.
 *
 * What is NOT covered here, and is verified in a browser: painted geometry (jsdom has no
 * layout, so every getBoundingClientRect the drag reads is stubbed), the collapsed rail's
 * look, and the thumbnail clone itself (that is free-canvas's `frameThumb`).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-navigator.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import type { Box } from './free-canvas-math.ts';
import type {
  ArtboardPort, ModelPort, NarrationStatus, NavigatorActions, SelectionPort,
} from './design-ports.ts';
import {
  NAV_MAX_WIDTH, NAV_MIN_WIDTH, NAV_RAIL_WIDTH, NAV_WIDTH,
  hashBox, initDesignNavigator, insertAt, layerTextLabel, moveInSeq, navWidthFor,
} from './design-navigator.ts';

// ── jsdom bootstrap (same shape as deck-editor.test.ts) ──────────────────────
const dom = new JSDOM('<!DOCTYPE html><body></body>');
const W = dom.window as unknown as typeof globalThis & {
  Event: typeof Event; MouseEvent: typeof MouseEvent; KeyboardEvent: typeof KeyboardEvent;
};
for (const k of ['window', 'document', 'HTMLElement', 'KeyboardEvent', 'Event', 'MouseEvent', 'Node', 'DOMParser', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
// a11y.announce() defers its write one frame, so the live region needs a pumpable rAF.
const rafQueue: Array<() => void> = [];
(globalThis as Record<string, unknown>).requestAnimationFrame = (fn: FrameRequestCallback): number => {
  rafQueue.push(() => fn(0));
  return rafQueue.length;
};
(globalThis as Record<string, unknown>).cancelAnimationFrame = (): void => {};
function frames(n = 2): void {
  for (let i = 0; i < n; i++) for (const fn of rafQueue.splice(0, rafQueue.length)) fn();
}
// The column remembers its dragged width per device. jsdom's window has storage, but the
// module reads the BARE global (as the rest of the shell does), so the tests need one.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
};
/** What a screen reader would have heard since the last read. */
function spoken(): string {
  frames();
  return [...document.querySelectorAll('[data-a11y-live]')].map((e) => e.textContent ?? '').join(' ').trim();
}

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() { return this; },
} as DOMRect);
const click = (el: Element): void => { el.dispatchEvent(new W.MouseEvent('click', { bubbles: true })); };
const key = (el: EventTarget, k: string, mods: Record<string, boolean> = {}): void => {
  el.dispatchEvent(new W.KeyboardEvent('keydown', { key: k, bubbles: true, ...mods }));
};
const pointer = (el: EventTarget, type: string, x: number, y: number): void => {
  el.dispatchEvent(new W.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
};
/**
 * A row's actions kebab. It is the row's SIBLING, not its child: a `role="option"`
 * flattens its content to an accessible name, so a button inside one is invisible to a
 * screen reader. Every lookup goes through here so the structure is asserted once.
 */
const kebab = (row: HTMLElement): HTMLButtonElement => {
  const item = row.parentElement!;
  assert.equal(item.className, 'fc-nav-item', 'the row sits in a presentation wrapper');
  assert.equal(item.getAttribute('role'), 'presentation');
  const btn = item.querySelector<HTMLButtonElement>('[data-nav-menu-btn]');
  assert.ok(btn, 'the wrapper carries the kebab beside the option, not inside it');
  assert.equal(row.querySelector('[data-nav-menu-btn]'), null, 'and nothing interactive is left in the option');
  return btn!;
};

// ── the fixture ───────────────────────────────────────────────────────────────

interface Calls {
  setField: Array<{ ids: string[]; field: string; value: unknown }>;
  commits: Box[][];
  selectionSet: string[][];
  focused: string[];
  thumbs: string[];
  actions: string[];
  reorderChildren: Array<{ frameId: string; ids: string[] }>;
  subs: { model: number; sel: number; art: number };
  unsubs: { model: number; sel: number; art: number };
  widths: number[];
  openChanges: boolean[];
}

function mount(rows: Box[], opt: {
  inputs?: Record<string, unknown>;
  skin?: 'column' | 'strip';
  active?: string;
  present?: boolean;
  reorderChildren?: boolean;
  /** Make duplicate/delete/add actually move the model, so the rebuild they cause is real. */
  liveActions?: boolean;
  /** A narration port (plans/180): what each frame's status is, read live on every paint. */
  narration?: (frameId: string) => NarrationStatus;
  /** Seed the remembered width, as a previous session would have left it. */
  width?: number;
  /** Leave whatever is in storage alone (for the "it was remembered" round trip). */
  keepWidth?: boolean;
} = {}) {
  // Every mount starts from a known width, or the one this case seeds: the column reads
  // the remembered width once, at init, so a width left behind by one case would decide
  // the result of the next one.
  if (opt.width !== undefined) store.set('lolly-design-nav-w', String(opt.width));
  else if (!opt.keepWidth) store.delete('lolly-design-nav-w');
  frames();      // drain any announcement the previous test left queued
  // Rebuilt rather than `innerHTML = ...`: a11y.ts's live region is a <body> child and is
  // cached module-side, so wiping the body would detach the very node `spoken()` reads.
  for (const old of [...document.querySelectorAll('#stage')]) old.remove();
  const stageEl = document.createElement('div');
  stageEl.id = 'stage';
  const canvasEl = document.createElement('div');
  canvasEl.id = 'tool-canvas';
  stageEl.append(canvasEl);
  document.body.append(stageEl);
  let boxes = rows.map((b) => ({ ...b }));
  const inputs: Record<string, unknown> = { transition: '', autoAdvance: false, ...(opt.inputs ?? {}) };
  const c: Calls = {
    setField: [], commits: [], selectionSet: [], focused: [], thumbs: [], actions: [], reorderChildren: [],
    subs: { model: 0, sel: 0, art: 0 }, unsubs: { model: 0, sel: 0, art: 0 }, widths: [], openChanges: [],
  };

  const modelSubs = new Set<() => void>();
  const fire = (): void => { for (const f of [...modelSubs]) f(); };
  const model: ModelPort = {
    blockId: 'boxes',
    cfg: {
      idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
      kindField: 'kind', textField: 'text', durField: 'dur', startField: 'start',
    } as unknown as ModelPort['cfg'],
    frame: { frameField: 'frame', frameKind: 'frame', orderField: 'order', labelField: 'name' },
    getBoxes: () => boxes,
    commit: (next) => { c.commits.push(next); boxes = next; fire(); },
    setField: (ids, field, value) => {
      c.setField.push({ ids, field, value });
      boxes = boxes.map((b) => (ids.includes(String(b.id)) ? ({ ...b, [field]: value } as Box) : b));
      fire();
    },
    subscribe: (cb) => {
      c.subs.model++; modelSubs.add(cb);
      return () => { c.unsubs.model++; modelSubs.delete(cb); };
    },
    getInput: (id) => inputs[id],
    setInput: (id, v) => { inputs[id] = v; fire(); },
  };

  const selIds = new Set<string>();
  const selSubs = new Set<(ids: string[]) => void>();
  const selection: SelectionPort = {
    get: () => [...selIds],
    set: (ids) => {
      c.selectionSet.push([...ids]);
      selIds.clear();
      for (const id of ids) selIds.add(id);
      for (const f of [...selSubs]) f([...selIds]);
    },
    onChange: (cb) => {
      c.subs.sel++; selSubs.add(cb);
      return () => { c.unsubs.sel++; selSubs.delete(cb); };
    },
  };

  let active = opt.active ?? String(rows.find((b) => b.kind === 'frame')?.id ?? '');
  const artSubs = new Set<(id: string) => void>();
  const artboard: ArtboardPort = {
    active: () => active,
    focus: (id) => {
      c.focused.push(id);
      if (id !== active) { active = id; for (const f of [...artSubs]) f(active); }
    },
    onChange: (cb) => {
      c.subs.art++; artSubs.add(cb);
      return () => { c.unsubs.art++; artSubs.delete(cb); };
    },
  };

  const nextOrder = (): number => boxes.reduce((n, b) => Math.max(n, Number(b.order ?? 0) + 1), 0);
  const actions: NavigatorActions = {
    makeArtboard: (ids) => { c.actions.push(`makeArtboard:${ids.join(',')}`); },
    duplicateFrame: (id) => {
      c.actions.push(`duplicate:${id}`);
      if (!opt.liveActions) return;
      const src = boxes.find((b) => String(b.id) === id)!;
      boxes = [...boxes, { ...src, id: `${id}-copy`, order: nextOrder() } as Box];
      fire();
    },
    deleteFrame: (id) => {
      c.actions.push(`delete:${id}`);
      if (!opt.liveActions) return;
      boxes = boxes.filter((b) => String(b.id) !== id);
      fire();
    },
    addArtboardAfter: (id) => c.actions.push(`add:${id}`),
    ...(opt.present ? { present: (id: string) => c.actions.push(`present:${id}`) } : {}),
    ...(opt.reorderChildren === false ? {} : {
      reorderChildren: (frameId: string, ids: string[]) => c.reorderChildren.push({ frameId, ids }),
    }),
  };

  const narration = opt.narration
    ? {
      narrateAll: () => { c.actions.push('narrate:all'); },
      narrateFrame: (id: string) => { c.actions.push(`narrate:${id}`); },
      status: (id: string) => opt.narration!(id),
    }
    : undefined;

  const nav = initDesignNavigator({
    stageEl, canvasEl, model, selection, artboard, actions, narration,
    skin: opt.skin,
    thumb: (fb) => {
      c.thumbs.push(String(fb.id));
      const d = document.createElement('div');
      d.className = 'thumb';
      d.dataset.for = String(fb.id);
      return d;
    },
    onWidthChange: (px) => c.widths.push(px),
    onOpenChange: (o) => c.openChanges.push(o),
  });
  frames();   // thumbnails build one frame after the paint (see queueThumb)

  const rowEls = (): HTMLElement[] => [...nav.el.querySelectorAll<HTMLElement>('.fc-nav-row')];
  const rowIds = (): string[] => rowEls().map((r) => r.dataset.id ?? '');
  const layerEls = (): HTMLElement[] => [...nav.el.querySelectorAll<HTMLElement>('.fc-nav-layer')];
  const layerIds = (): string[] => layerEls().map((r) => r.dataset.id ?? '');
  const rowById = (id: string): HTMLElement => rowEls().find((r) => r.dataset.id === id)!;
  const boxById = (id: string): Box => boxes.find((b) => String(b.id) === id)!;
  return { nav, stageEl, canvasEl, model, selection, artboard, c, rowEls, rowIds, layerEls, layerIds, rowById, boxById, boxesNow: () => boxes, inputs };
}

/** Three artboards, deliberately stored out of page order so the sort has work to do. */
const THREE: Box[] = [
  { id: 'f2', kind: 'frame', order: 1, x: 2000, y: 0, w: 1920, h: 1080, name: 'Two' },
  { id: 'f3', kind: 'frame', order: 2, x: 4000, y: 0, w: 1920, h: 1080, name: '' },
  { id: 'f1', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, name: 'One' },
];

// ── pure helpers ──────────────────────────────────────────────────────────────

test('moveInSeq / insertAt: reorder maths, clamped and pure', () => {
  assert.deepEqual(moveInSeq(['a', 'b', 'c'], 'a', 1), ['b', 'a', 'c']);
  assert.deepEqual(moveInSeq(['a', 'b', 'c'], 'a', -1), ['a', 'b', 'c'], 'first row cannot move up');
  assert.deepEqual(moveInSeq(['a', 'b', 'c'], 'c', 1), ['a', 'b', 'c'], 'last row cannot move down');
  assert.deepEqual(moveInSeq(['a', 'b', 'c'], 'zz', 1), ['a', 'b', 'c'], 'unknown id is a no-op');
  assert.deepEqual(insertAt(['a', 'b', 'c'], 'a', 3), ['b', 'c', 'a'], 'drop past the end');
  assert.deepEqual(insertAt(['a', 'b', 'c'], 'c', 0), ['c', 'a', 'b'], 'drop at the head');
  assert.deepEqual(insertAt(['a', 'b', 'c'], 'b', 1), ['a', 'b', 'c'], 'drop where it already is');
});

test('layerTextLabel: first line, clamped, tags stripped', () => {
  assert.equal(layerTextLabel('Hello\nsecond line'), 'Hello');
  assert.equal(layerTextLabel('  \n\n  Real text  '), 'Real text');
  assert.equal(layerTextLabel('<b>Bold</b> start'), 'Bold  start');
  assert.equal(layerTextLabel('0123456789012345678901234567890'), '01234567890123456789012…');
  assert.equal(layerTextLabel(''), '');
});

// ── the list ──────────────────────────────────────────────────────────────────

test('one row per frame, in page order (order asc, then x asc); non-frames excluded', () => {
  const f = mount([...THREE, { id: 'b1', kind: 'text', frame: 'f1', x: 10, y: 10, text: 'hi' }]);
  assert.deepEqual(f.rowIds(), ['f1', 'f2', 'f3']);
  assert.deepEqual([...f.nav.el.querySelectorAll('.fc-nav-idx')].map((e) => e.textContent), ['1', '2', '3']);
  // An unnamed board falls back to the placeholder name, numbered by its page position.
  assert.equal(f.rowById('f3').querySelector('.fc-nav-name')!.textContent, 'Artboard 3');
  assert.equal(f.rowById('f1').querySelector('.fc-nav-name')!.textContent, 'One');
  assert.deepEqual(f.c.thumbs, ['f1', 'f2', 'f3'], 'one thumbnail per row, built once');
  f.nav.destroy();
});

test('ties on order fall back to x, so a board drawn to the left still lists in page order', () => {
  const f = mount([
    { id: 'a', kind: 'frame', order: 0, x: 900, y: 0, w: 100, h: 100 },
    { id: 'b', kind: 'frame', order: 0, x: 100, y: 0, w: 100, h: 100 },
  ]);
  assert.deepEqual(f.rowIds(), ['b', 'a']);
  f.nav.destroy();
});

test('title: Artboards until a frame carries timing, notes or a build step', () => {
  const plain = mount(THREE);
  assert.equal(plain.nav.el.querySelector('.fc-nav-title')!.textContent, 'Artboards');
  plain.nav.destroy();

  const timed = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, dur: 4 } : b)));
  assert.equal(timed.nav.el.querySelector('.fc-nav-title')!.textContent, 'Slides');
  timed.nav.destroy();

  const noted = mount(THREE.map((b) => (b.id === 'f2' ? { ...b, notes: 'say hello' } : b)));
  assert.equal(noted.nav.el.querySelector('.fc-nav-title')!.textContent, 'Slides');
  noted.nav.destroy();
});

test('empty document: the empty state shows and the list is hidden', () => {
  const f = mount([{ id: 'b1', kind: 'text', x: 0, y: 0, text: 'orphan' }]);
  assert.equal(f.rowIds().length, 0);
  const empty = f.nav.el.querySelector<HTMLElement>('.fc-nav-empty')!;
  assert.equal(empty.hidden, false);
  // A box with no artboard is a loose layer (plans/184 R15), and the text says so.
  assert.equal(empty.textContent, 'No artboards. Every box is a loose layer, listed below.');
  f.nav.destroy();
  // Nothing at all: the plain empty state.
  const g = mount([]);
  assert.equal(g.nav.el.querySelector<HTMLElement>('.fc-nav-empty')!.textContent, 'No artboards yet.');
  assert.equal(g.nav.el.querySelector<HTMLElement>('.fc-nav-make-all')!.hidden, true);
  g.nav.destroy();
});

// ── rename ────────────────────────────────────────────────────────────────────

test('rename: F2 opens an input, Enter writes the label field in ONE commit', () => {
  const f = mount(THREE);
  key(f.rowById('f1'), 'F2');
  const input = f.nav.el.querySelector<HTMLInputElement>('[data-nav-name-input]')!;
  assert.ok(input, 'the row swapped its name for an input');
  assert.equal(input.value, 'One');
  input.value = 'Cover';
  key(input, 'Enter');
  assert.deepEqual(f.c.setField, [{ ids: ['f1'], field: 'name', value: 'Cover' }]);
  assert.equal(f.c.commits.length, 0, 'a rename is a setField, never a whole-array commit');
  assert.equal(f.rowById('f1').querySelector('.fc-nav-name')!.textContent, 'Cover');
  f.nav.destroy();
});

test('rename: Escape restores the old name and writes nothing', () => {
  const f = mount(THREE);
  key(f.rowById('f2'), 'F2');
  const input = f.nav.el.querySelector<HTMLInputElement>('[data-nav-name-input]')!;
  input.value = 'Discarded';
  key(input, 'Escape');
  assert.equal(f.c.setField.length, 0);
  assert.equal(f.rowById('f2').querySelector('.fc-nav-name')!.textContent, 'Two');
  f.nav.destroy();
});

test('rename: an unchanged value writes nothing at all', () => {
  const f = mount(THREE);
  key(f.rowById('f1'), 'F2');
  const input = f.nav.el.querySelector<HTMLInputElement>('[data-nav-name-input]')!;
  key(input, 'Enter');
  assert.equal(f.c.setField.length, 0);
  f.nav.destroy();
});

// ── reorder ───────────────────────────────────────────────────────────────────

test('keyboard reorder: Alt+ArrowDown writes dense 0..n-1 order and never touches x', () => {
  const f = mount(THREE);
  const xBefore = ['f1', 'f2', 'f3'].map((id) => f.boxById(id).x);
  key(f.rowById('f1'), 'ArrowDown', { altKey: true });
  assert.equal(f.c.commits.length, 1, 'one commit for the whole move');
  assert.deepEqual(f.rowIds(), ['f2', 'f1', 'f3']);
  const now = f.boxesNow();
  assert.deepEqual(
    ['f1', 'f2', 'f3'].map((id) => now.find((b) => b.id === id)!.order),
    [1, 0, 2],
    'orders are dense 0..n-1 in the new page sequence',
  );
  assert.deepEqual(['f1', 'f2', 'f3'].map((id) => f.boxById(id).x), xBefore, 'x is exactly what it was');
  f.nav.destroy();
});

test('keyboard reorder: the first row cannot move up (no empty commit)', () => {
  const f = mount(THREE);
  key(f.rowById('f1'), 'ArrowUp', { altKey: true });
  assert.equal(f.c.commits.length, 0);
  f.nav.destroy();
});

test('drag reorder: a drop past the last row moves the board to the end, x untouched', () => {
  const f = mount(THREE);
  // jsdom has no layout: give the rows the geometry the drop maths reads.
  f.rowEls().forEach((r, i) => { r.getBoundingClientRect = () => rect(0, i * 40, 200, 40); });
  const row = f.rowById('f1');
  pointer(row, 'pointerdown', 20, 10);
  pointer(document, 'pointermove', 20, 100);
  pointer(document, 'pointerup', 20, 100);
  assert.equal(f.c.commits.length, 1);
  assert.deepEqual(f.rowIds(), ['f2', 'f3', 'f1']);
  assert.deepEqual(
    ['f1', 'f2', 'f3'].map((id) => f.boxById(id).order),
    [2, 0, 1],
  );
  assert.deepEqual(['f1', 'f2', 'f3'].map((id) => f.boxById(id).x), [0, 2000, 4000], 'x untouched by a drag');
  f.nav.destroy();
});

test('drag reorder: a press with no travel is a click, not a reorder', () => {
  const f = mount(THREE);
  f.rowEls().forEach((r, i) => { r.getBoundingClientRect = () => rect(0, i * 40, 200, 40); });
  const row = f.rowById('f1');
  pointer(row, 'pointerdown', 20, 10);
  pointer(document, 'pointerup', 21, 11);
  click(row);
  assert.equal(f.c.commits.length, 0);
  assert.deepEqual(f.c.selectionSet, [['f1']], 'the click still selected');
  f.nav.destroy();
});

// ── chips and dots ────────────────────────────────────────────────────────────

test('notes dot: only on the frame whose notes are non-empty', () => {
  const f = mount(THREE.map((b) => (b.id === 'f2' ? { ...b, notes: '  speak  ' } : { ...b, notes: '   ' })));
  assert.equal(f.rowById('f2').querySelectorAll('.fc-nav-dot').length, 1);
  assert.equal(f.rowById('f2').querySelector('.fc-nav-dot')!.getAttribute('aria-label'), 'Has speaker notes');
  assert.equal(f.rowById('f1').querySelectorAll('.fc-nav-dot').length, 0, 'whitespace-only notes are no notes');
  f.nav.destroy();
});

// ── narration status (plans/180 section 8) ────────────────────────────────────

test('narration dot: four states, each with the word a reader hears', () => {
  const status: Record<string, NarrationStatus> = { f1: 'pending', f2: 'current', f3: 'stale' };
  const f = mount(THREE, { narration: (id) => status[id] ?? 'none' });
  const dot = (id: string): HTMLElement | null => f.rowById(id).querySelector('.fc-nav-dot');
  assert.equal(dot('f1')!.getAttribute('data-narration'), 'pending');
  assert.equal(dot('f1')!.getAttribute('aria-label'), 'Speaker notes, not narrated yet');
  assert.equal(dot('f2')!.getAttribute('data-narration'), 'current');
  assert.equal(dot('f2')!.getAttribute('aria-label'), 'Narrated');
  assert.equal(dot('f3')!.getAttribute('data-narration'), 'stale');
  assert.equal(dot('f3')!.getAttribute('aria-label'), 'Narrated, but the notes changed since');
  // The tooltip says the same thing as the accessible name: a dot with two different
  // meanings depending on how you reach it is not a status, it is a guess.
  assert.equal(dot('f3')!.title, 'Narrated, but the notes changed since');
  f.nav.destroy();

  const none = mount(THREE, { narration: () => 'none' });
  assert.equal(none.nav.el.querySelectorAll('.fc-nav-dot').length, 0, 'nothing to say, no dot');
  none.nav.destroy();
});

test('narration dot: a status change alone repaints the row', () => {
  // Narrating a slide writes new BOXES, not new fields on the frame, so nothing in the
  // row's own values moves. Without the status in the row signature the dot would go on
  // saying "not narrated yet" until some unrelated edit happened to rebuild the row.
  let st: NarrationStatus = 'pending';
  const f = mount(THREE, { narration: (id) => (id === 'f1' ? st : 'none') });
  assert.equal(f.rowById('f1').querySelector('.fc-nav-dot')!.getAttribute('data-narration'), 'pending');
  st = 'current';
  f.model.setInput('autoAdvance', false);   // any model notification, no field changed
  assert.equal(f.rowById('f1').querySelector('.fc-nav-dot')!.getAttribute('data-narration'), 'current');
  f.nav.destroy();
});

test('narration dot: with no port the dot is the notes mark it has always been', () => {
  // A host with no speech bridge must not have its rows restyled by a feature it does
  // not have - the dot keeps its look (no `data-narration` for the sheet to hook) and
  // its old accessible name.
  const f = mount(THREE.map((b) => (b.id === 'f2' ? { ...b, notes: 'speak' } : b)));
  const dot = f.rowById('f2').querySelector('.fc-nav-dot')!;
  assert.equal(dot.getAttribute('data-narration'), null);
  assert.equal(dot.getAttribute('aria-label'), 'Has speaker notes');
  f.nav.destroy();
});

test('dwell chip: needs BOTH a positive dur and auto-advance on', () => {
  const f = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, dur: 3 } : b)));
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-chip--dwell').length, 0, 'dur alone is not a dwell');
  f.model.setInput('autoAdvance', true);
  const chips = [...f.nav.el.querySelectorAll('.fc-nav-chip--dwell')];
  assert.equal(chips.length, 1, 'only the frame that has a dur');
  assert.equal(chips[0]!.textContent, '3s');
  assert.equal(chips[0]!.getAttribute('aria-label'), 'Auto-advance 3s');
  assert.ok(f.rowById('f1').contains(chips[0]!));
  f.model.setInput('autoAdvance', false);
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-chip--dwell').length, 0, 'turning it off removes the chip');
  f.nav.destroy();
});

test('transition chip: reads the DOC-level input and is marked as such for M4', () => {
  const f = mount(THREE, { inputs: { transition: 'cross-fade' } });
  const chips = [...f.nav.el.querySelectorAll('.fc-nav-chip--trans')];
  assert.equal(chips.length, 3, 'a document-level transition applies to every board');
  assert.equal(chips[0]!.textContent, 'cross fade');
  assert.equal(chips[0]!.getAttribute('data-doc-default'), '1');
  // The NAME is the chip's own word, not the wire value: a chip reading "Cut" whose
  // accessible name said "Transition: none" gave a screen reader the internal token, and
  // in any non-English locale the two disagreed outright. An unknown value like this one
  // has no word of its own, so both fall back to the same tidied spelling.
  assert.equal(chips[0]!.getAttribute('aria-label'), 'Transition: cross fade');
  f.nav.destroy();
});

test('transition chip: absent when the document has none', () => {
  const f = mount(THREE, { inputs: { transition: 'none' } });
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-chip--trans').length, 0);
  f.nav.destroy();
});

// ── selection ─────────────────────────────────────────────────────────────────

test('row click: selection.set then artboard.focus, in that order', () => {
  const f = mount(THREE, { active: 'f1' });
  click(f.rowById('f3'));
  assert.deepEqual(f.c.selectionSet, [['f3']]);
  assert.deepEqual(f.c.focused, ['f3']);
  f.nav.destroy();
});

test('selection.onChange repaints is-active / aria-selected without a rebuild', () => {
  const f = mount(THREE, { active: 'f1' });
  const before = f.rowById('f2');
  assert.equal(before.getAttribute('aria-selected'), 'false');
  f.selection.set(['f2']);
  const after = f.rowById('f2');
  assert.equal(after, before, 'a selection change repaints, it does not rebuild the row');
  assert.equal(after.getAttribute('aria-selected'), 'true');
  assert.ok(after.classList.contains('is-active'));
  assert.equal(after.tabIndex, 0, 'the roving tab stop follows the selection');
  assert.equal(f.rowById('f3').tabIndex, -1);
  f.nav.destroy();
});

test('the active artboard is aria-current, NOT aria-selected (nothing is selected)', () => {
  const f = mount(THREE, { active: 'f2' });
  assert.equal(f.rowById('f2').getAttribute('aria-current'), 'true');
  assert.equal(f.rowById('f2').getAttribute('aria-selected'), 'false', 'active is not a selection');
  assert.ok(f.rowById('f2').classList.contains('is-active'), 'it still reads as the current row');
  assert.equal(f.rowById('f1').getAttribute('aria-current'), null);
  assert.equal(f.rowById('f1').getAttribute('aria-selected'), 'false');
  f.nav.destroy();
});

test('two selected boards are honest: aria-selected on both, in a multiselectable listbox', () => {
  const f = mount(THREE, { active: 'f1' });
  const list = f.nav.el.querySelector('.fc-nav-list')!;
  assert.equal(list.getAttribute('aria-multiselectable'), 'true');
  assert.equal(f.nav.el.querySelector('.fc-nav-layer-list')!.getAttribute('aria-multiselectable'), 'true');
  f.selection.set(['f1', 'f3']);
  assert.deepEqual(
    f.rowEls().map((r) => r.getAttribute('aria-selected')),
    ['true', 'false', 'true'],
  );
  assert.equal(f.rowById('f1').getAttribute('aria-current'), 'true', 'and f1 is also the active board');
  assert.equal(f.rowById('f3').getAttribute('aria-current'), null);
  f.nav.destroy();
});

// ── row menu ──────────────────────────────────────────────────────────────────

test('row menu: the injected verbs, and Present only when the host offers it', () => {
  const f = mount(THREE, { present: true });
  kebab(f.rowById('f2')).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const menu = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
  assert.equal(menu.getAttribute('role'), 'menu');
  const labels = [...menu.querySelectorAll('.fc-nav-menu-label')].map((e) => e.textContent);
  // THREE carries no timing, no notes and no build step, so the list is titled
  // "Artboards" - and the menu says the same word. It used to offer "Duplicate slide" /
  // "Delete slide" / "Add artboard after" in one menu on a poster.
  assert.equal(f.nav.el.querySelector('.fc-nav-title')!.textContent, 'Artboards');
  assert.deepEqual(labels, ['Duplicate artboard', 'Delete artboard', 'Present from here', 'Add artboard after', 'Move up', 'Move down']);
  assert.equal(menu.getAttribute('aria-label'), 'Artboard actions');
  const items = [...menu.querySelectorAll<HTMLButtonElement>('.fc-nav-menu-item')];
  click(items[0]!);
  assert.deepEqual(f.c.actions, ['duplicate:f2']);
  assert.equal(f.nav.el.querySelector('.fc-nav-menu'), null, 'choosing an item closes the menu');

  kebab(f.rowById('f1')).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const menu2 = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
  const items2 = [...menu2.querySelectorAll<HTMLButtonElement>('.fc-nav-menu-item')];
  assert.equal(items2[4]!.disabled, true, 'the first board cannot move up');
  click(items2[5]!);
  assert.equal(f.c.commits.length, 1, 'Move down is the same one-commit reorder');
  assert.deepEqual(f.rowIds(), ['f2', 'f1', 'f3']);
  f.nav.destroy();
});

test('row menu: a DECK says slide, and the same document says artboard when it is not one', () => {
  // The vocabulary is a property of the document, not of the menu: one authored
  // speaker note is what makes this list "Slides", and the menu has to follow it.
  const f = mount(THREE.map((b) => (b.id === 'f2' ? { ...b, notes: 'say hello' } : b)), { present: true });
  assert.equal(f.nav.el.querySelector('.fc-nav-title')!.textContent, 'Slides');
  kebab(f.rowById('f2')).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const menu = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
  assert.deepEqual([...menu.querySelectorAll('.fc-nav-menu-label')].map((e) => e.textContent),
    ['Duplicate slide', 'Delete slide', 'Present from here', 'Add slide after', 'Move up', 'Move down']);
  assert.equal(menu.getAttribute('aria-label'), 'Slide actions');
  f.nav.destroy();
});

test('row menu: no Present item when the host passes no present verb', () => {
  const f = mount(THREE);
  kebab(f.rowById('f1')).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const labels = [...f.nav.el.querySelectorAll('.fc-nav-menu-label')].map((e) => e.textContent);
  assert.ok(!labels.includes('Present from here'));
  key(f.nav.el.querySelector('.fc-nav-menu')!, 'Escape');
  assert.equal(f.nav.el.querySelector('.fc-nav-menu'), null, 'Escape closes the menu');
  f.nav.destroy();
});

// ── layers ────────────────────────────────────────────────────────────────────

const WITH_KIDS: Box[] = [
  { id: 'f1', kind: 'frame', order: 0, x: 0, y: 0, w: 1920, h: 1080, name: 'One' },
  { id: 'f2', kind: 'frame', order: 1, x: 2000, y: 0, w: 1920, h: 1080, name: 'Two' },
  { id: 'c1', kind: 'box', frame: 'f1', x: 10, y: 10 },
  { id: 'c2', kind: 'text', frame: 'f1', x: 20, y: 20, text: 'Hello there\nsecond' },
  { id: 'c3', kind: 'image', frame: 'f1', x: 30, y: 30, name: 'Logo' },
  { id: 'c9', kind: 'text', frame: 'f2', x: 10, y: 10, text: 'other board' },
];

test('layers: the active board\'s children, array order REVERSED (top of list paints on top)', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  assert.deepEqual(f.layerIds(), ['c3', 'c2', 'c1'], 'reversed, and only this board\'s children');
  const labels = f.layerEls().map((r) => r.querySelector('.fc-nav-layer-name')!.textContent);
  assert.deepEqual(labels, ['Logo', 'Hello there', 'Box'], 'name, else first line of text, else the kind word');
  f.nav.destroy();
});

test('layers: clicking a layer selects it (and does not move the board)', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  click(f.layerEls()[1]!);
  assert.deepEqual(f.c.selectionSet, [['c2']]);
  assert.deepEqual(f.c.focused, [], 'a layer click is not an artboard focus');
  f.nav.destroy();
});

test('layers: Alt+ArrowDown hands back PAINT order (the reverse of the list)', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  key(f.layerEls()[0]!, 'ArrowDown', { altKey: true });
  assert.deepEqual(f.c.reorderChildren, [{ frameId: 'f1', ids: ['c1', 'c3', 'c2'] }]);
  f.nav.destroy();
});

test('layers: the section is absent when the active board has no children', () => {
  const f = mount(WITH_KIDS, { active: 'f2' });
  assert.deepEqual(f.layerIds(), ['c9']);
  f.artboard.focus('f1');
  assert.deepEqual(f.layerIds(), ['c3', 'c2', 'c1'], 'the list follows the active board');
  const empty = mount(THREE, { active: 'f1' });
  assert.equal(empty.nav.el.querySelector<HTMLElement>('.fc-nav-layers')!.hidden, true);
  empty.nav.destroy();
  f.nav.destroy();
});

// ── layer flags (plans/179 M4: hidden / locked) ──────────────────────────────

/** The two flag toggles beside a layer row, in order: the eye, then the padlock. */
const flags = (row: HTMLElement): HTMLButtonElement[] => {
  const item = row.parentElement!;
  assert.equal(item.className, 'fc-nav-layer-item', 'the row sits in a presentation wrapper');
  assert.equal(item.getAttribute('role'), 'presentation');
  assert.equal(row.querySelector('[data-nav-flag]'), null, 'and nothing interactive is left in the option');
  return [...item.querySelectorAll<HTMLButtonElement>('[data-nav-flag]')];
};

test('layers: the eye hides a layer in ONE commit, and the row says so', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  const row = f.layerEls()[0]!;                       // c3, the top layer
  const [eye, lock] = flags(row);
  assert.equal(eye!.getAttribute('aria-pressed'), 'false');
  assert.equal(eye!.getAttribute('aria-label'), 'Hide layer');
  assert.equal(lock!.getAttribute('aria-label'), 'Lock layer');
  click(eye!);
  assert.deepEqual(f.c.setField, [{ ids: ['c3'], field: 'hidden', value: true }]);
  assert.equal(f.c.commits.length, 0, 'a flag is a setField, never a whole-array commit');
  // The rebuilt row: dimmed, the struck-through eye, the state in its own text, and a
  // toggle that now offers the way back.
  const after = f.layerEls()[0]!;
  assert.ok(after.className.includes('is-hidden'));
  assert.equal(after.querySelector('.fc-nav-layer-state')!.textContent, 'Hidden');
  const [eye2] = flags(after);
  assert.equal(eye2!.getAttribute('aria-pressed'), 'true');
  assert.equal(eye2!.getAttribute('aria-label'), 'Show layer');
  click(eye2!);
  assert.deepEqual(f.c.setField.at(-1), { ids: ['c3'], field: 'hidden', value: false });
  assert.equal(f.layerEls()[0]!.querySelector('.fc-nav-layer-state'), null);
  f.nav.destroy();
});

test('layers: the padlock is the other flag, and both can be on at once', () => {
  const f = mount(WITH_KIDS.map((b) => (b.id === 'c2' ? { ...b, hidden: '1' } : b)), { active: 'f1' });
  const row = f.layerEls()[1]!;                       // c2, stored as the string a link carries
  assert.ok(row.className.includes('is-hidden'), 'a flag read back off a URL is still a flag');
  click(flags(row)[1]!);
  assert.deepEqual(f.c.setField, [{ ids: ['c2'], field: 'locked', value: true }]);
  const after = f.layerEls()[1]!;
  assert.equal(after.querySelector('.fc-nav-layer-state')!.textContent, 'Hidden, Locked');
  assert.equal(flags(after)[1]!.getAttribute('aria-label'), 'Unlock layer');
  f.nav.destroy();
});

test('layers: H hides and L locks from the ROW - the toggles are not tab stops', () => {
  // `flagBtn` keeps both buttons out of the tab order (a `role="option"` flattens its
  // content into the option's name, so a focusable control in there is unreachable to a
  // screen reader anyway). Without a key on the row that left the two capabilities
  // pointer-only: a keyboard user could arrow to a layer and had nowhere to hide it
  // except the inspector's Object section, which needs that column docked open.
  const f = mount(WITH_KIDS, { active: 'f1' });
  const row = f.layerEls()[0]!;                       // c3, the top layer
  const [eye, lock] = flags(row);
  assert.equal(eye!.tabIndex, -1, 'precondition: not a tab stop');
  assert.equal(eye!.getAttribute('aria-keyshortcuts'), 'h', 'and it says which key reaches it');
  assert.equal(lock!.getAttribute('aria-keyshortcuts'), 'l');

  key(row, 'h');
  assert.deepEqual(f.c.setField, [{ ids: ['c3'], field: 'hidden', value: true }]);
  key(f.layerEls()[0]!, 'h');
  assert.deepEqual(f.c.setField.at(-1), { ids: ['c3'], field: 'hidden', value: false }, 'and back again');
  key(f.layerEls()[0]!, 'L');
  assert.deepEqual(f.c.setField.at(-1), { ids: ['c3'], field: 'locked', value: true }, 'either case');
  f.nav.destroy();
});

test('layers: the flag keys stay on the layer list - a FRAME row answers neither', () => {
  const f = mount(THREE);
  key(f.rowById('f1'), 'h');
  key(f.rowById('f1'), 'l');
  assert.deepEqual(f.c.setField, [], 'an artboard has no eye or padlock beside it');
  f.nav.destroy();
});

test('layers: a flag toggle neither selects the row nor starts a reorder', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  const row = f.layerEls()[2]!;
  const [eye] = flags(row);
  eye!.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
  click(eye!);
  assert.deepEqual(f.c.selectionSet, [], 'the press stays on the button it was aimed at');
  assert.deepEqual(f.c.reorderChildren, []);
  f.nav.destroy();
});

// ── the transition chip (plans/179 M4: the per-frame slot) ───────────────────

const trans = (row: HTMLElement): HTMLElement | null => row.querySelector<HTMLElement>('.fc-nav-chip--trans');

test('transition chip: the frame\'s OWN value wins over the deck, and is not dimmed', () => {
  const f = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, slideTransition: 'morph' } : b)), { inputs: { transition: 'fade' } });
  const own = trans(f.rowById('f1'))!;
  assert.equal(own.textContent, 'Morph');
  assert.equal(own.getAttribute('data-doc-default'), null, 'this slide answered for itself');
  assert.equal(own.className.includes('is-inherited'), false);
  // Its neighbours inherit: the same chip, dimmed, marked as the document's answer.
  const inherited = trans(f.rowById('f2'))!;
  assert.equal(inherited.textContent, 'Fade');
  assert.equal(inherited.getAttribute('data-doc-default'), '1');
  assert.ok(inherited.className.includes('is-inherited'));
  f.nav.destroy();
});

test('transition chip: a slide that CUTS while the deck fades still shows one', () => {
  // `none` is a real per-frame answer, unlike an empty document-level transition: the
  // slide is saying "no move here", which is exactly the thing worth a chip.
  const f = mount(THREE.map((b) => (b.id === 'f2' ? { ...b, slideTransition: 'none' } : b)), { inputs: { transition: 'fade' } });
  assert.equal(trans(f.rowById('f2'))!.textContent, 'Cut');
  assert.equal(trans(f.rowById('f2'))!.getAttribute('data-doc-default'), null);
  f.nav.destroy();
});

test('transition chip: `custom` names the timeline as the owner', () => {
  const f = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, slideTransition: 'custom' } : b)));
  const c = trans(f.rowById('f1'))!;
  assert.equal(c.textContent, 'Custom');
  assert.equal(c.getAttribute('aria-label'), 'Transition: set in the timeline');
  f.nav.destroy();
});

test('transition chip: pressing it is a preview, never a selection or a rename', () => {
  const f = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, slideTransition: 'fade' } : b)));
  const c = trans(f.rowById('f1'))!;
  assert.equal(c.tagName, 'BUTTON');
  assert.equal(c.tabIndex, -1, 'a tab stop inside a role=option is not one this list owns');
  // No page is on the canvas here (jsdom renders none), so the click is a no-op that
  // costs no import - and it must not fall through to the row underneath it.
  click(c);
  assert.deepEqual(f.c.selectionSet, []);
  assert.equal(f.c.setField.length, 0);
  f.nav.destroy();
});

test('transition chip: P on the ROW is the keyboard door onto the preview', () => {
  // The chip is deliberately not a tab stop (a `role="option"` flattens its content into
  // the option's name), so the press has to be reachable from the row - the same shape as
  // the frame kebab's Shift+F10. Without it a keyboard user had no way anywhere in the
  // editor to see what a slide transition looks like short of entering present mode: the
  // timeline's own Preview button resolves `.lolly-box[data-box-id]`, and an artboard is
  // a `.lolly-frame-page`, so a frame's Enter row never grows one.
  const f = mount(THREE.map((b) => (b.id === 'f1' ? { ...b, slideTransition: 'fade' } : b)));
  assert.equal(trans(f.rowById('f1'))!.getAttribute('aria-keyshortcuts'), 'p');

  // Answered, and stopped here: this list's keys must never ALSO drive the canvas.
  const press = (row: HTMLElement, k: string): KeyboardEvent => {
    const ev = new W.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
    row.dispatchEvent(ev);
    return ev;
  };
  assert.equal(press(f.rowById('f1'), 'p').defaultPrevented, true);
  assert.equal(press(f.rowById('f1'), 'P').defaultPrevented, true, 'either case');
  // No page is on the canvas in jsdom, so the preview itself is a no-op that costs no
  // import - exactly as the chip-click case above asserts. What is pinned here is that
  // the row answers the key at all, and that it changes nothing else.
  assert.deepEqual(f.c.selectionSet, []);
  assert.equal(f.c.setField.length, 0);
  assert.equal(f.c.commits.length, 0);
  f.nav.destroy();
});

// ── collapse, skins, teardown ────────────────────────────────────────────────

test('collapse: the rail carries one numbered dot per frame, each focusing its board', () => {
  const f = mount(THREE);
  assert.equal(f.nav.isOpen(), true);
  assert.equal(f.nav.width(), 232);
  f.nav.setOpen(false);
  assert.equal(f.nav.isOpen(), false);
  assert.equal(f.nav.width(), 36);
  assert.deepEqual(f.c.openChanges, [false]);
  assert.deepEqual(f.c.widths.slice(-1), [36], 'the host is told the new reserve');
  assert.ok(f.nav.el.classList.contains('is-collapsed'));
  const dots = [...f.nav.el.querySelectorAll<HTMLElement>('.fc-nav-dot-btn')];
  assert.deepEqual(dots.map((d) => d.textContent), ['1', '2', '3']);
  assert.equal(dots[2]!.getAttribute('aria-label'), 'Artboard 3');
  // A dot is a BUTTON in a list item, never a button wearing role="listitem": an explicit
  // role replaces the implicit one, which would take the control out of the rotor.
  const rail = f.nav.el.querySelector<HTMLElement>('.fc-nav-rail')!;
  assert.equal(rail.tagName, 'UL');
  assert.equal(rail.getAttribute('role'), 'list');
  assert.deepEqual([...rail.children].map((li) => li.tagName), ['LI', 'LI', 'LI']);
  for (const d of dots) {
    assert.equal(d.tagName, 'BUTTON');
    assert.equal(d.getAttribute('role'), null, 'the button keeps its own role');
    assert.equal(d.parentElement!.tagName, 'LI');
  }
  click(dots[1]!);
  assert.deepEqual(f.c.selectionSet, [['f2']]);
  assert.deepEqual(f.c.focused, ['f2']);
  const toggle = f.nav.el.querySelector<HTMLButtonElement>('.fc-nav-toggle')!;
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-label'), 'Show navigator');
  click(toggle);
  assert.equal(f.nav.isOpen(), true);
  assert.equal(toggle.getAttribute('aria-label'), 'Hide navigator');
  f.nav.destroy();
});

test('strip skin: the same rows, horizontally, with no Layers list', () => {
  const f = mount(WITH_KIDS, { skin: 'strip', active: 'f1' });
  assert.ok(f.nav.el.classList.contains('fc-nav--strip'));
  assert.deepEqual(f.rowIds(), ['f1', 'f2']);
  assert.equal(f.layerIds().length, 0, 'no layer stack in the mobile strip');
  assert.equal(f.nav.width(), 0, 'a bottom strip reserves no stage width');
  assert.equal(f.nav.el.querySelector('.fc-nav-grip'), null, 'and no side grip to drag');
  assert.equal(f.nav.el.querySelector('[data-nav-rail-slot]'), null, 'nor a seat for the tool rail');
  f.nav.destroy();
});

// ── the left sidebar: one column, dragged from its own edge (plans/179 M4) ────

/** Drag the grip so the column's right edge ends up `to` px from its left edge. */
function dragGrip(f: ReturnType<typeof mount>, to: number, o: { release?: boolean } = {}): void {
  const grip = f.nav.el.querySelector<HTMLElement>('.fc-nav-grip')!;
  const from = f.nav.width();
  grip.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: from }));
  grip.dispatchEvent(new W.MouseEvent('pointermove', { bubbles: true, button: 0, buttons: 1, clientX: to }));
  frames();
  if (o.release !== false) {
    grip.dispatchEvent(new W.MouseEvent('pointerup', { bubbles: true, button: 0, buttons: 0, clientX: to }));
  }
}

test('navWidthFor: one snap point for the pointer and the arrow keys', () => {
  assert.deepEqual(navWidthFor(300), { open: true, width: 300 });
  assert.deepEqual(navWidthFor(NAV_MIN_WIDTH), { open: true, width: NAV_MIN_WIDTH }, 'the min is open');
  assert.deepEqual(navWidthFor(NAV_MIN_WIDTH - 1), { open: false, width: NAV_RAIL_WIDTH }, 'a hair under snaps shut');
  assert.deepEqual(navWidthFor(-400), { open: false, width: NAV_RAIL_WIDTH });
  assert.deepEqual(navWidthFor(9999), { open: true, width: NAV_MAX_WIDTH }, 'and it cannot eat the canvas');
  assert.deepEqual(navWidthFor(Number.NaN), { open: false, width: NAV_RAIL_WIDTH }, 'an unmeasurable drag is not "very wide"');
});

test('the grip resizes the column live, and the host hears every frame of it', () => {
  const f = mount(THREE);
  assert.equal(f.nav.width(), NAV_WIDTH, 'starts at the design width');
  const widths = f.c.widths.length;
  dragGrip(f, 300, { release: false });
  assert.equal(f.nav.width(), 300);
  assert.equal(f.nav.el.style.width, '300px', 'the column box follows the edge');
  assert.ok(f.c.widths.length > widths, 'the reserve was told mid-drag, not on release');
  assert.deepEqual(f.c.widths.slice(-1), [300]);
  assert.deepEqual(f.c.openChanges, [], 'a resize is not an open/close');
  f.nav.destroy();
});

test('dragging under the minimum snaps the column shut to the dot rail', () => {
  const f = mount(THREE);
  dragGrip(f, NAV_MIN_WIDTH - 4);
  assert.equal(f.nav.isOpen(), false);
  assert.equal(f.nav.width(), NAV_RAIL_WIDTH);
  assert.deepEqual(f.c.openChanges, [false]);
  assert.ok(f.nav.el.classList.contains('is-collapsed'));
  assert.ok(f.nav.el.querySelector<HTMLElement>('.fc-nav-dot-btn'), 'the dots are what is left');
  // …and dragging the rail's edge back out re-opens it at the width being asked for.
  dragGrip(f, 260);
  assert.equal(f.nav.isOpen(), true);
  assert.equal(f.nav.width(), 260);
  assert.deepEqual(f.c.openChanges, [false, true]);
  f.nav.destroy();
});

test('the width is remembered per device, and the toggle re-opens at it', () => {
  const f = mount(THREE);
  dragGrip(f, 288);
  assert.equal(store.get('lolly-design-nav-w'), '288', 'the release persisted it');
  f.nav.setOpen(false);
  f.nav.setOpen(true);
  assert.equal(f.nav.width(), 288, 'the toggle came back to the dragged width, not the default');
  f.nav.destroy();

  const back = mount(THREE, { keepWidth: true });
  assert.equal(back.nav.width(), 288, 'and the next session opens there');
  back.nav.destroy();

  // A stored width narrower than the minimum is not a column, so the default stands.
  const junk = mount(THREE, { width: 12 });
  assert.equal(junk.nav.width(), NAV_WIDTH);
  junk.nav.destroy();
});

test('the grip is a keyboard splitter: arrows resize, Home/End are the ends, dblclick resets', () => {
  const f = mount(THREE);
  const grip = f.nav.el.querySelector<HTMLElement>('.fc-nav-grip')!;
  assert.equal(grip.getAttribute('role'), 'separator');
  assert.equal(grip.getAttribute('aria-orientation'), 'vertical');
  assert.equal(grip.tabIndex, 0);
  assert.equal(grip.getAttribute('aria-valuenow'), String(NAV_WIDTH));
  key(grip, 'ArrowRight');
  assert.equal(f.nav.width(), NAV_WIDTH + 16);
  key(grip, 'ArrowLeft', { shiftKey: true });
  assert.equal(f.nav.width(), NAV_WIDTH + 16 - 48, 'Shift takes bigger steps');
  key(grip, 'End');
  assert.equal(f.nav.width(), NAV_MAX_WIDTH);
  assert.equal(grip.getAttribute('aria-valuenow'), String(NAV_MAX_WIDTH), 'the value it exposes follows');
  key(grip, 'Home');
  assert.equal(f.nav.isOpen(), false, 'Home is all the way in, which is shut');
  grip.dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true }));
  assert.equal(f.nav.width(), NAV_WIDTH, 'and a double-click is the reset');
  f.nav.destroy();
});

test('a grip key never reaches the canvas (the same gate the rows keep)', () => {
  const f = mount(THREE);
  const spy = windowSpy();
  const grip = f.nav.el.querySelector<HTMLElement>('.fc-nav-grip')!;
  key(grip, 'ArrowRight');
  key(grip, 'Home');
  assert.deepEqual(spy.keys, [], 'an arrow on the grip must not also nudge the artboard');
  spy.off();
  f.nav.destroy();
});

test('the tool rail\'s seat: open and empty while the column is open, gone when it is not', () => {
  const f = mount(THREE);
  const slot = f.nav.el.querySelector<HTMLElement>('[data-nav-rail-slot]')!;
  assert.ok(slot, 'the column carries a slot for the editor\'s tool rail');
  assert.equal(slot.hidden, false, 'and free-canvas can see it while the column is open');
  // The host parks its rail in there; the column must not lose it on a rebuild.
  const rail = document.createElement('div');
  rail.className = 'fc-toolbar';
  slot.append(rail);
  f.model.setField(['f1'], 'name', 'Cover');
  assert.equal(rail.parentElement, slot, 'a row rebuild does not touch the slot');
  f.nav.setOpen(false);
  assert.equal(slot.hidden, true, 'a collapsed column has nowhere to put a grid of buttons');
  f.nav.setOpen(true);
  assert.equal(slot.hidden, false);
  // Teardown hands the host's node back to the stage rather than taking it away.
  f.nav.destroy();
  assert.equal(rail.parentElement, f.stageEl, 'the rail outlived the column that borrowed it');
  rail.remove();
});

test('repaint memo: an unrelated model change rebuilds no rows and re-clones no thumbnails', () => {
  const f = mount(THREE);
  const before = f.rowById('f2');
  assert.equal(f.c.thumbs.length, 3);
  f.model.setInput('somethingElse', 42);
  assert.equal(f.rowById('f2'), before, 'the row element survived');
  assert.equal(f.c.thumbs.length, 3, 'no thumbnail was re-cloned');
  // A change that DOES touch a row rebuilds it, and re-clones only that row's thumbnail.
  f.model.setField(['f2'], 'name', 'Renamed');
  assert.notEqual(f.rowById('f2'), before);
  assert.deepEqual(f.c.thumbs, ['f1', 'f2', 'f3'], 'not yet: the clone waits for the paint frame');
  frames();
  assert.deepEqual(f.c.thumbs, ['f1', 'f2', 'f3', 'f2']);
  f.nav.destroy();
});

test('destroy: the node goes, and every port subscription is released', () => {
  const f = mount(THREE);
  assert.deepEqual(f.c.subs, { model: 1, sel: 1, art: 1 });
  assert.ok(document.querySelector('.fc-nav'));
  f.nav.destroy();
  assert.deepEqual(f.c.unsubs, { model: 1, sel: 1, art: 1 });
  assert.equal(document.querySelector('.fc-nav'), null);
  // And it is inert afterwards: a late model change must not resurrect or throw.
  f.model.setInput('transition', 'fade');
  f.selection.set(['f1']);
  assert.equal(document.querySelector('.fc-nav'), null);
  f.nav.destroy();   // idempotent
  assert.deepEqual(f.c.unsubs, { model: 1, sel: 1, art: 1 });
});

test('the column is chrome: hidden from every export walk and from a live take', () => {
  const f = mount(THREE);
  assert.ok(f.nav.el.hasAttribute('data-export-hide'));
  assert.ok(f.nav.el.hasAttribute('data-live-hide'));
  assert.equal(f.nav.el.getAttribute('aria-label'), 'Navigator');
  assert.equal(f.nav.el.querySelector('.fc-nav-list')!.getAttribute('role'), 'listbox');
  assert.equal(f.rowById('f1').getAttribute('role'), 'option');
  f.nav.destroy();
});

test('a keyboard reorder keeps the focus (and the single tab stop) on the row that moved', () => {
  const f = mount(THREE);
  const row = f.rowById('f2');
  row.focus();
  key(row, 'ArrowDown', { altKey: true });
  const moved = f.rowById('f2');
  assert.equal(document.activeElement, moved, 'focus followed the row through the rebuild');
  assert.equal(moved.tabIndex, 0);
  assert.deepEqual(f.rowEls().filter((r) => r.tabIndex === 0).length, 1, 'still exactly one tab stop');
  f.nav.destroy();
});

// ── the keyboard gate (the canvas binds its shortcuts on `window`) ────────────

/** Everything a `window` keydown listener - i.e. free-canvas's `onKey` - would have seen. */
function windowSpy(): { keys: string[]; off(): void } {
  const keys: string[] = [];
  const on = (e: Event): void => {
    const k = e as KeyboardEvent;
    keys.push(`${k.altKey ? 'Alt+' : ''}${k.metaKey ? 'Meta+' : ''}${k.key}`);
  };
  W.window.addEventListener('keydown', on);
  return { keys, off: () => W.window.removeEventListener('keydown', on) };
}

test('list keys stop at the navigator: the canvas never sees an arrow, a Space or a chord', () => {
  const f = mount(THREE);
  const spy = windowSpy();
  const row = f.rowById('f2');
  row.focus();
  key(row, 'ArrowDown');
  key(row, 'ArrowUp');
  key(row, 'Home');
  key(row, ' ');
  key(f.rowById('f2'), 'ArrowDown', { altKey: true });
  assert.deepEqual(spy.keys, [], 'not one of them reached a window handler');
  // Bare keys the list does NOT act on are stopped too - every letter is a canvas tool
  // shortcut (V pointer, P pen, N nodes, Shift+H flip), and none of them mean anything
  // while the keyboard is in this column.
  key(f.rowById('f2'), 'v');
  key(f.rowById('f2'), 'Delete');
  assert.deepEqual(spy.keys, []);
  // App-wide chords still travel: ⌘Z is the tool view's undo, bound on window as well.
  key(f.rowById('f2'), 'z', { metaKey: true });
  assert.deepEqual(spy.keys, ['Meta+z']);
  spy.off();
  f.nav.destroy();
});

test('EVERY app-wide chord travels, including the ones whose bare key this list owns', () => {
  // ⌘/Ctrl+Return is "present", bound on `window` by the tool view. The gate used to
  // test its owned-key list BEFORE the modifier, and `Enter` is on that list - so
  // ⌘Return pressed on the slide you wanted to present from did nothing at all, while
  // the ⌘S and ⌘E beside it worked. The row handler declines the chord too, so it
  // does not rename instead.
  const f = mount(THREE);
  const spy = windowSpy();
  const row = f.rowById('f2');
  row.focus();
  key(row, 'Enter', { metaKey: true });
  key(row, 'Backspace', { ctrlKey: true });
  assert.deepEqual(spy.keys, ['Meta+Enter', 'Backspace']);
  assert.equal(f.nav.el.querySelector('[data-nav-name-input]'), null, '⌘Return must not start a rename');
  spy.off();
  f.nav.destroy();
});

test('the gate covers the whole column: rail dots, the toggle and the row menu', () => {
  const f = mount(THREE, { present: true });
  const spy = windowSpy();
  key(f.nav.el.querySelector('.fc-nav-toggle')!, ' ');
  kebab(f.rowById('f1')).dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
  const menu = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
  key(menu.querySelector('.fc-nav-menu-item')!, 'ArrowDown');
  assert.deepEqual(spy.keys, []);
  // Escape with a menu open closes the menu; with no menu it LEAVES THE COLUMN, and it
  // still does not reach the editor - whose Escape ladder starts by clearing the
  // selection, which is not what "take me back to the canvas" means.
  key(menu, 'Escape');
  assert.equal(f.nav.el.querySelector('.fc-nav-menu'), null);
  key(f.rowById('f1'), 'Escape');
  assert.deepEqual(spy.keys, [], 'the editor never sees it');
  spy.off();
  f.nav.destroy();
});

test('the tool rail is a guest in the slot, so its canvas keys still travel', () => {
  // free-canvas parks its `.fc-toolbar` in the rail slot while this column is open. Those
  // buttons are canvas controls: `v` arms the pointer tool and Delete removes the selected
  // box from a FLOATING rail, and they have to mean the same thing from a docked one -
  // otherwise the same button changes meaning depending on whether a panel is open.
  const f = mount(THREE);
  const slot = f.nav.el.querySelector<HTMLElement>('[data-nav-rail-slot]')!;
  const btn = document.createElement('button');
  slot.append(btn);
  const spy = windowSpy();
  key(btn, 'v');
  key(btn, 'Delete');
  key(btn, 'ArrowDown');
  assert.deepEqual(spy.keys, ['v', 'Delete', 'ArrowDown'], 'the editor still hears its own palette');
  // …and the column's own rows are unchanged: the exemption is the guest, not the column.
  key(f.rowById('f1'), 'v');
  assert.deepEqual(spy.keys, ['v', 'Delete', 'ArrowDown']);
  spy.off();
  f.nav.destroy();
});

test('Escape hands the keyboard back to the canvas and keeps the selection', () => {
  const f = mount(THREE);
  // The overlay makes every rendered card focusable; the column reaches for the selected
  // one so the keyboard goes to the artwork rather than to <body>.
  const card = document.createElement('div');
  card.className = 'lolly-box';
  card.dataset.boxId = 'f2';
  card.tabIndex = 0;
  f.canvasEl.append(card);
  f.selection.set(['f2']);
  const row = f.rowById('f2');
  row.focus();
  assert.equal(document.activeElement, row, 'precondition: the keyboard is in the column');
  key(row, 'Escape');
  assert.equal(document.activeElement, card, 'focus went to the selected card');
  assert.deepEqual(f.selection.get(), ['f2'], 'and the selection survived');
  f.nav.destroy();
});

test('Escape with nothing focusable on the canvas just lets the column go', () => {
  const f = mount(THREE);
  const row = f.rowById('f1');
  row.focus();
  key(row, 'Escape');
  assert.notEqual(document.activeElement, row, 'the column no longer holds the keyboard');
  f.nav.destroy();
});

test('a rename swallows its own keys too (a stray Delete must not delete the board)', () => {
  const f = mount(THREE);
  const spy = windowSpy();
  key(f.rowById('f1'), 'F2');
  const input = f.nav.el.querySelector<HTMLInputElement>('[data-nav-name-input]')!;
  key(input, 'Delete');
  key(input, 'Escape');
  assert.deepEqual(spy.keys, []);
  spy.off();
  f.nav.destroy();
});

// ── the row menu's own toggle ─────────────────────────────────────────────────

/** A real click: the capture-phase document listener sees the pointerdown FIRST. */
function kebabClick(row: HTMLElement): void {
  const btn = kebab(row);
  btn.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true }));
  btn.dispatchEvent(new W.MouseEvent('click', { bubbles: true }));
}

test('the kebab closes the menu it opened (its own pointerdown is not "outside")', () => {
  const f = mount(THREE);
  const row = f.rowById('f2');
  kebabClick(row);
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-menu').length, 1);
  assert.equal(kebab(row).getAttribute('aria-expanded'), 'true');
  kebabClick(row);
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-menu').length, 0, 'the second press dismisses it');
  assert.equal(kebab(row).getAttribute('aria-expanded'), 'false');
  assert.equal(document.activeElement, f.rowById('f2'), 'and hands the keyboard back to the row');
  f.nav.destroy();
});

test('a press anywhere else still closes the menu, and another row\'s kebab swaps it', () => {
  const f = mount(THREE);
  kebabClick(f.rowById('f1'));
  document.body.dispatchEvent(new W.MouseEvent('pointerdown', { bubbles: true }));
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-menu').length, 0);
  kebabClick(f.rowById('f1'));
  kebabClick(f.rowById('f3'));
  assert.equal(f.nav.el.querySelectorAll('.fc-nav-menu').length, 1, 'one menu at a time');
  assert.equal(kebab(f.rowById('f3')).getAttribute('aria-expanded'), 'true');
  assert.equal(kebab(f.rowById('f1')).getAttribute('aria-expanded'), 'false');
  f.nav.destroy();
});

test('the menu is placed off the row\'s CLIENT rect, and a scroll closes it', () => {
  const f = mount(THREE);
  (W.window as unknown as { innerWidth: number; innerHeight: number }).innerWidth = 1200;
  (W.window as unknown as { innerWidth: number; innerHeight: number }).innerHeight = 800;
  const row = f.rowById('f2');
  // A row scrolled far down the list: its offsetTop would be ~1000 (content coordinates),
  // its painted position is 120. The menu must follow the PAINTED one.
  row.getBoundingClientRect = () => rect(8, 120, 200, 40);
  kebabClick(row);
  const menu = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
  assert.equal(menu.style.top, '164px', 'just under the painted row');
  assert.equal(menu.style.left, '8px');
  W.window.dispatchEvent(new W.Event('resize'));
  assert.equal(f.nav.el.querySelector('.fc-nav-menu'), null, 'a fixed menu cannot follow, so it closes');
  f.nav.destroy();
});

test('a row near the bottom of the viewport opens its menu upward, never off the edge', () => {
  const f = mount(THREE);
  (W.window as unknown as { innerWidth: number; innerHeight: number }).innerWidth = 1200;
  (W.window as unknown as { innerWidth: number; innerHeight: number }).innerHeight = 800;
  // The menu measures itself DURING placement, so the stub has to be on the prototype -
  // jsdom lays nothing out, and the element does not exist before openRowMenu builds it.
  const proto = (W.window as unknown as { Element: { prototype: Element } }).Element.prototype as
    Element & { getBoundingClientRect(): DOMRect };
  const orig = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (this: Element): DOMRect {
    if (this.classList?.contains('fc-nav-menu')) return rect(0, 0, 200, 220);
    if (this.classList?.contains('fc-nav-row')) return rect(8, 700, 200, 40);
    return rect(0, 0, 0, 0);
  };
  try {
    kebabClick(f.rowById('f1'));
    const menu = f.nav.el.querySelector<HTMLElement>('.fc-nav-menu')!;
    // 700 - 220 - 4: above the row, because 744 + 220 would run off an 800px viewport.
    assert.equal(menu.style.top, '476px');
    assert.equal(menu.style.left, '8px');
    // Width stays with the sheet: an inline min-width would out-rank its min-inline-size
    // and let a 96px filmstrip row squash its own menu.
    assert.equal(menu.style.minWidth, '');
  } finally {
    proto.getBoundingClientRect = orig;
  }
  f.nav.destroy();
});

// ── focus after a menu verb ───────────────────────────────────────────────────

test('a menu verb leaves the keyboard in the navigator, not on <body>', () => {
  const f = mount(THREE, { liveActions: true });
  kebabClick(f.rowById('f2'));
  const items = [...f.nav.el.querySelectorAll<HTMLButtonElement>('.fc-nav-menu-item')];
  assert.equal(document.activeElement, items[0], 'the menu takes the focus when it opens');
  click(items[0]!);                                  // Duplicate
  assert.deepEqual(f.c.actions, ['duplicate:f2']);
  assert.equal(document.activeElement, f.rowById('f2'), 'focus came back through the rebuild');
  assert.equal(f.rowById('f2').tabIndex, 0, 'and it is the list\'s single tab stop');
  assert.equal(spoken(), 'Two duplicated');
  f.nav.destroy();
});

test('deleting a slide moves the focus to the row that takes its place', () => {
  const f = mount(THREE, { liveActions: true });
  kebabClick(f.rowById('f2'));
  click([...f.nav.el.querySelectorAll<HTMLButtonElement>('.fc-nav-menu-item')][1]!);   // Delete
  assert.deepEqual(f.rowIds(), ['f1', 'f3']);
  assert.equal(document.activeElement, f.rowById('f3'), 'the row now standing at that index');
  assert.equal(spoken(), 'Two deleted');
  f.nav.destroy();
});

test('a keyboard reorder says where the row landed', () => {
  const f = mount(THREE);
  key(f.rowById('f1'), 'ArrowDown', { altKey: true });
  assert.equal(spoken(), 'One moved to 2 of 3');
  f.nav.destroy();
});

// ── the focus flag never outlives its own write ───────────────────────────────

test('a no-op reorder verb cannot steal the focus from a later, unrelated rebuild', () => {
  const f = mount(WITH_KIDS, { active: 'f1', reorderChildren: false });
  const outside = document.createElement('input');
  document.body.append(outside);
  const layer = f.layerEls()[0]!;
  layer.focus();
  key(layer, 'ArrowDown', { altKey: true });          // the host wired no reorderChildren
  assert.deepEqual(f.c.reorderChildren, [], 'nothing was committed');
  // The user moves on to a text field on the canvas and types; the first model change
  // rebuilds the list underneath them.
  outside.focus();
  f.model.setField(['f1'], 'name', 'Cover');
  assert.equal(document.activeElement, outside, 'the caret stayed where the user put it');
  outside.remove();
  f.nav.destroy();
});

test('a reorder still hands focus back when the navigator is where the keyboard was', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  const layer = f.layerEls()[0]!;
  layer.focus();
  key(layer, 'ArrowDown', { altKey: true });
  assert.deepEqual(f.c.reorderChildren, [{ frameId: 'f1', ids: ['c1', 'c3', 'c2'] }]);
  f.nav.destroy();
});

// ── thumbnails ────────────────────────────────────────────────────────────────

test('the thumbnail follows what is ON the slide, not just the frame row', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  assert.deepEqual(f.c.thumbs, ['f1', 'f2'], 'one per board to begin with');
  f.model.setField(['c2'], 'text', 'Completely different headline');
  frames();
  assert.deepEqual(f.c.thumbs, ['f1', 'f2', 'f1'], 'editing a child re-clones ITS board only');
  f.model.setField(['c9'], 'text', 'other board, edited');
  frames();
  assert.deepEqual(f.c.thumbs, ['f1', 'f2', 'f1', 'f2']);
  // Moving a child re-clones too - the picture is of the page, so anything that moves on
  // the page moves in the picture.
  f.model.setField(['c1'], 'x', 999);
  frames();
  assert.deepEqual(f.c.thumbs.slice(-1), ['f1']);
  f.nav.destroy();
});

test('an edit that changes nothing on any page re-clones nothing', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  const n = f.c.thumbs.length;
  f.model.setInput('somethingElse', 42);
  f.model.setField(['c2'], 'text', 'Hello there\nsecond');   // the value it already had
  frames();
  assert.equal(f.c.thumbs.length, n);
  f.nav.destroy();
});

test('hashBox: order-sensitive, field-complete, and blind to an absent value', () => {
  const a = hashBox(5381, { id: 'a', x: 1, y: 2 });
  assert.equal(hashBox(5381, { y: 2, x: 1, id: 'a' }), a, 'key order in the object is not data');
  assert.notEqual(hashBox(5381, { id: 'a', x: 1, y: 3 }), a);
  assert.equal(hashBox(5381, { id: 'a', x: 1, y: 2, name: undefined }), a, 'an absent field is absent');
  assert.notEqual(hashBox(hashBox(5381, { id: 'a' }), { id: 'b' }), hashBox(hashBox(5381, { id: 'b' }), { id: 'a' }));
});

test('double-click renames too (the mouse path to the same one commit)', () => {
  const f = mount(THREE);
  f.rowById('f3').dispatchEvent(new W.MouseEvent('dblclick', { bubbles: true }));
  const input = f.nav.el.querySelector<HTMLInputElement>('[data-nav-name-input]')!;
  assert.equal(input.placeholder, 'Artboard 3', 'the placeholder is the page-numbered fallback');
  input.value = 'Thanks';
  key(input, 'Enter');
  assert.deepEqual(f.c.setField, [{ ids: ['f3'], field: 'name', value: 'Thanks' }]);
  f.nav.destroy();
});

// ══ the sheet's layout contract ══════════════════════════════════════════════
//
// Three of the column's promises are pure CSS, and jsdom has no cascade - so they are
// read off the sheet itself. Each one shipped broken, and each was invisible to every
// behavioural test in this file.

const NAV_CSS = readFileSync(new URL('../styles/parts/design-navigator.css', import.meta.url), 'utf8');
const EDITOR_CSS = readFileSync(new URL('../styles/parts/editor.css', import.meta.url), 'utf8');

/** The declarations of the first rule whose selector list matches `sel` exactly. */
function ruleBody(css: string, sel: string): string {
  const at = css.indexOf(`${sel} {`);
  assert.ok(at >= 0, `the sheet declares \`${sel}\``);
  const open = css.indexOf('{', at);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

test('the column is laid out INSIDE the docked bands, never under them', () => {
  // `.fc-nav` is a stage sibling of the top bar, which is `top: 0` with a higher
  // z-index and a near-opaque background - so a column at `top: 0` had its whole head
  // painted over, and `.fc-nav-toggle` (the only way back out of the collapsed rail)
  // swallowed no clicks at all: the bar was above it. The inspector column always got
  // this right, which is what made it read as an oversight rather than a choice.
  const body = ruleBody(NAV_CSS, '.fc-nav');
  assert.match(body, /top:\s*var\(--stage-reserve-top,\s*0px\)/, 'offset by the top bar\'s own band');
  assert.match(body, /bottom:\s*var\(--stage-reserve-bottom,\s*0px\)/, 'and by the docked timeline\'s');
});

test('the column goes with the rest of the chrome in the `\\` full preview', () => {
  // The top bar and the inspector both ship this rule, and editor.css lists the rail,
  // the timeline, the object bar, the frame labels and the back pill. The navigator was
  // the one piece of chrome the "hide every control" preview left on screen.
  assert.match(NAV_CSS, /\.tool-view\.is-chrome-hidden\s+\.fc-nav\s*\{\s*display:\s*none\s*!important/);
});

test('the docked tool rail is a fluid grid inside the column, with no grip and no rules', () => {
  // free-canvas re-parents `.fc-toolbar` into the slot and marks it `--grid`; the layout
  // is entirely this sheet's, so the sheet is where it can be asserted.
  const body = ruleBody(NAV_CSS, '.fc-nav-rail-slot .fc-toolbar--grid');
  // As many 40px columns as the sidebar is wide: the grid expands with the available
  // dock space (Andy, 2026-09-03), so a fixed count is exactly the wrong pin.
  assert.match(body, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(40px,\s*1fr\)\)/, 'fluid columns of one .fc-btn');
  assert.match(body, /display:\s*grid/);
  assert.match(NAV_CSS, /\.fc-nav-rail-slot \.fc-grip,\s*\n\.fc-nav-rail-slot \.fc-sep \{[^}]*display:\s*none/,
    'a docked rail has nothing to drag and no line for a divider to sit on');
  assert.match(NAV_CSS, /\.fc-nav-rail-slot:empty \{[^}]*display:\s*none/,
    'an editor with no rail loses no vertical space to an empty slot');
});

test('the column\'s edge grip rides the app\'s shared resize primitive', () => {
  // `.resize-grip` (parts/tool.css) is the ONE drag affordance - the inputs sidebar's
  // edge and the right dock's edge both use it. A second pill recipe here would fork it.
  assert.match(NAV_CSS, /\.fc-nav-grip \{/, 'the column declares its own hit strip');
  const body = ruleBody(NAV_CSS, '.fc-nav-grip');
  assert.match(body, /position:\s*absolute/);
  // PHYSICAL, and the column's own `left: 0` is why. A logical `inset-inline-end` moved
  // the grip to the LEFT of a column that had not moved in Arabic or Urdu, which left the
  // 8px strip against the stage edge and the resize edge with no pointer target at all
  // (`.fc-nav` clips its overflow, so nothing else sits near it).
  assert.match(body, /(^|[\s;])right:\s*0/, 'inside the right edge - the column clips its overflow');
  assert.doesNotMatch(body, /inset-inline-end/,
    'the column is pinned with a physical `left`, so a logical grip inset flips it away from the edge it drags');
  assert.doesNotMatch(body, /background|box-shadow/, 'the look belongs to .resize-grip, not to a copy of it');
});

test('the layer flags read as state: a hidden row dims, and a set flag stays visible', () => {
  // jsdom has no cascade, so the two claims the M4 toggles rest on are read off the
  // sheet. Both are the whole point of the control: a hidden layer has to LOOK absent,
  // and a flag that only appears on hover would hide the state it is reporting.
  assert.match(ruleBody(NAV_CSS, '.fc-nav-layer.is-hidden'), /opacity:\s*0?\.5/);
  const at = NAV_CSS.indexOf('.fc-nav-layer-btn.is-on { opacity: 1; }');
  assert.ok(at > 0, 'a set flag is opaque without the pointer on the row');
});

test('the timeline band spans the whole stage; the docked rail band sits between the bar and it', () => {
  // It used to be gated on `.has-tl-reserve`, which only means "the RAIL is the column":
  // with the navigator open the band ran under its rows and clipped the layer names.
  const body = ruleBody(EDITOR_CSS, '.tool-stage .tl-panel');
  // Andy, 2026-09-03: "the sequence editor does not enjoy the full width of the viewport" -
  // the band runs edge to edge and the side columns end at its top instead.
  assert.match(body, /left:\s*0\b/);
});

test('the floating tool rail starts where the navigator ends', () => {
  // Both are stage children at the left edge. `--stage-reserve-left` is the whole left
  // band and `--ldock-rail-w` is the rail's own share of it (non-zero only while the
  // timeline has docked the rail into a column), so the difference is the navigator's
  // width in both states - and 0px for every editor that has no navigator.
  const body = ruleBody(EDITOR_CSS, '.fc-toolbar-dock');
  assert.match(body, /left:\s*calc\(var\(--stage-reserve-left,\s*0px\)\s*-\s*var\(--ldock-rail-w,\s*0px\)\)/);
});

test('the rail docked as a left column starts below the top bar, like the navigator', () => {
  // It carries a HIGHER z-index than the bar (24 vs 22, so a floating rail rides over the
  // timeline), so a docked column at the stage top painted over the Home pill and took
  // its clicks: the label read as "ome" and elementFromPoint over it returned the dock
  // (Andy's screenshot, 2026-09-02). Same defect the navigator had, same fix.
  const body = ruleBody(EDITOR_CSS, '.tool-stage.has-tl-reserve .fc-toolbar-dock');
  assert.match(body, /top:\s*var\(--stage-reserve-top,\s*0px\)/);
});

test('two edits to one board before the paint frame clone it once, after the paint', () => {
  const f = mount(WITH_KIDS, { active: 'f1' });
  const n = f.c.thumbs.length;
  f.model.setField(['c2'], 'text', 'first');
  f.model.setField(['c2'], 'text', 'second');
  assert.equal(f.c.thumbs.length, n, 'nothing cloned on the emit itself');
  frames();
  assert.deepEqual(f.c.thumbs.slice(n), ['f1'], 'one clone, from the row standing after the paint');
  f.nav.destroy();
});

// ── a document with no artboards (plans/184 R15) ─────────────────────────────

test('no artboards: the column lists every box as a loose layer, with its timing, and offers Make artboard', () => {
  const f = mount([
    { id: 'a', kind: 'text', text: 'Opening line', x: 0, y: 0, w: 400, h: 80, start: 0, dur: 3, lane: 'seq' },
    { id: 'b', kind: 'image', x: 0, y: 100, w: 400, h: 300, start: 1.25 },
    { id: 'c', kind: 'box', x: 50, y: 50, w: 10, h: 10 },
  ] as Box[]);
  const empty = f.nav.el.querySelector<HTMLElement>('.fc-nav-empty')!;
  assert.equal(empty.hidden, false);
  assert.equal(empty.textContent, 'No artboards. Every box is a loose layer, listed below.');
  assert.equal(f.nav.el.querySelector<HTMLElement>('.fc-nav-subhead')!.textContent, 'Loose layers');
  const rows = [...f.nav.el.querySelectorAll<HTMLElement>('.fc-nav-layer')];
  // Reversed: the top of the list paints on top.
  assert.deepEqual(rows.map((r) => r.dataset.id), ['c', 'b', 'a']);
  const chips = rows.map((r) => r.querySelector('.fc-nav-layer-time')?.textContent ?? null);
  assert.deepEqual(chips, [null, 'from 1.3s', 'Sequence 0.0s for 3.0s']);
  // Each loose row carries the verb; the button under the empty text wraps everything.
  const perRow = f.nav.el.querySelector<HTMLButtonElement>('.fc-nav-layer-item [data-nav-verb="make-artboard"]')!;
  assert.ok(perRow);
  click(perRow);
  assert.deepEqual(f.c.actions, ['makeArtboard:c']);
  const all = f.nav.el.querySelector<HTMLButtonElement>('.fc-nav-make-all')!;
  assert.equal(all.hidden, false);
  click(all);
  assert.deepEqual(f.c.actions, ['makeArtboard:c', 'makeArtboard:a,b,c']);
  f.nav.destroy();
});

test('with an artboard the loose-layer verbs are gone and the empty text is the old one', () => {
  const f = mount([
    { id: 'f1', kind: 'frame', name: 'One', x: 0, y: 0, w: 800, h: 450, order: 0 },
    { id: 'a', kind: 'text', frame: 'f1', text: 'Hi', x: 10, y: 10, w: 100, h: 40 },
  ] as Box[]);
  assert.equal(f.nav.el.querySelector<HTMLElement>('.fc-nav-empty')!.hidden, true);
  assert.equal(f.nav.el.querySelector<HTMLElement>('.fc-nav-make-all')!.hidden, true);
  assert.equal(f.nav.el.querySelector('[data-nav-verb="make-artboard"]'), null);
  assert.equal(f.nav.el.querySelector<HTMLElement>('.fc-nav-subhead')!.textContent, 'Layers');
  f.nav.destroy();
});
