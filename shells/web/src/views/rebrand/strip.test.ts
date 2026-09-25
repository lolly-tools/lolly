// SPDX-License-Identifier: MPL-2.0
/**
 * The filmstrip as a slide sorter (plan 275 section 5 and decision 31), in jsdom.
 *
 * What jsdom can answer: the render (the listbox, its options, the More button, the
 * left-out mark), the memo, the selection set, the menu rows and what each sends, the
 * gap arithmetic of a drop, the keyboard (flicking, extending, moving, the layout
 * chooser, select all, the keyboard move) and the words said. What it cannot, since every
 * rect is zero here, is in `strip.browser.test.ts`: the drag, pointer capture, the
 * neighbours' motion, the menu's placement, right to left and the frame budget.
 *
 * The state is the real pipeline over tests/fixtures/rebrand/adversarial.pptx, drawn by
 * the real comparison, so "the Proposed pane changes" is read off the pane itself. The
 * controller is a stub that records each command and answers ok.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/strip.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { compileFaithful, neutralSlideMaster } from '@lolly/engine';
import { ARCHETYPE_IDS } from '@lolly-tools/core';
import type { RenovationPlanV1 } from '@lolly-tools/core/rebrand-v1';
import { STARTER_COLORS, runRebrandPipeline, type RebrandRunV1 } from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type { RebrandControllerV1, RebrandEditOutcomeV1, RebrandOpenOutcomeV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import type { RbCtx } from './context.ts';
import { arrangementName, autoMatchBlockedFor, matchLabel, matchedText, type RbChooserEntry } from './layout-chooser.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://lolly.test/#/rebrand' });
// JSDOM has no top layer; a dialog opens and closes by its attribute.
dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) { this.removeAttribute('open'); };
for (const key of [
  'window', 'document', 'history', 'location', 'HTMLElement', 'HTMLDialogElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLButtonElement', 'Element', 'Node', 'Event',
  'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'PointerEvent', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage',
]) {
  const value = Reflect.get(dom.window, key);
  if (value !== undefined) Reflect.set(globalThis, key, value);
}
if (typeof globalThis.PointerEvent === 'undefined') Reflect.set(globalThis, 'PointerEvent', dom.window.MouseEvent);

const { deriveReview, selectedSlideIds, RB_STRIP_OVERSCAN } = await import('./shared.ts');
const { compareOps } = await import('./compare.ts');
const { queueOps } = await import('./queue.ts');
const { stripOps, RB_STRIP_FALLBACK_VISIBLE } = await import('./strip.ts');
const { keysOps, flickOf, SINGLE_KEYS_KEY } = await import('./keys.ts');
const { dragOps, gapAt, landingIndex } = await import('./strip-drag.ts');

const FIXTURE = new URL('../../../../../tests/fixtures/rebrand/adversarial.pptx', import.meta.url);
const RUN: RebrandRunV1 = await runRebrandPipeline('adversarial.pptx', new Uint8Array(readFileSync(FIXTURE)));

function stateFrom(plan: RenovationPlanV1 = RUN.plan, extra: Partial<RebrandStateV1> = {}): RebrandStateV1 {
  return {
    phase: 'review',
    mode: 'renovate',
    progress: null,
    error: null,
    project: null,
    source: RUN.deck,
    census: RUN.census,
    plan,
    faithful: compileFaithful(RUN.deck),
    preview: { deck: RUN.compiled, planRevision: plan.revision },
    previewStale: false,
    designSystem: {
      id: 'lolly/start',
      name: 'Lolly start',
      neutralMaster: false,
      hasLogo: true,
      archetypes: [...ARCHETYPE_IDS],
      colors: Object.fromEntries(STARTER_COLORS),
      fonts: ['SUSE'],
    },
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 1,
    ...extra,
  };
}

interface Call {
  name: string;
  args: unknown[];
}

const OK: RebrandEditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };

function stubController(state: RebrandStateV1, calls: Call[], opts: { autoMatch?: boolean } = {}): RebrandControllerV1 {
  const record = (name: string) => async (...args: unknown[]): Promise<RebrandEditOutcomeV1> => {
    calls.push({ name, args });
    return OK;
  };
  return {
    getState: () => state,
    subscribe: () => () => {},
    start: async () => {},
    open: async () => {},
    recent: async () => [],
    remove: async () => {},
    close: () => {},
    decide: record('decide'),
    acceptSuggestions: record('acceptSuggestions'),
    include: record('include'),
    move: record('move'),
    setLayout: record('setLayout'),
    moveTo: record('moveTo'),
    moveSlides: record('moveSlides'),
    duplicateSlide: record('duplicateSlide'),
    resetSlide: record('resetSlide'),
    ...(opts.autoMatch === false ? {} : { autoMatchLayouts: record('autoMatchLayouts') }),
    setColour: record('setColour'),
    setFont: record('setFont'),
    shuffleColours: record('shuffleColours'),
    undo: record('undo'),
    redo: record('redo'),
    openInDesign: async (opts?: { focusSlideId?: string }): Promise<RebrandOpenOutcomeV1> => {
      calls.push({ name: 'openInDesign', args: [opts] });
      return { ok: true, warnings: [] };
    },
    downloadProject: async () => null,
    setMode: async () => {},
    keepDesignDownload: async () => null,
    // Every picture has loaded, so a render with nothing new to draw is skipped.
    mediaHref: (ref: string) => `blob:${ref}`,
    cancel: () => {},
    reload: async () => {},
    dispose: () => {},
  };
}

interface Mounted {
  rb: RbCtx;
  calls: Call[];
  said: string[];
  chooser: Array<{ ids: string[]; entry: string }>;
  /** The slides Open in Design was asked for through the footer's path, '' for the whole deck. */
  footOpens: string[];
  unmount: () => void;
}

/** A stand-in for the orchestrator with the real comparison, filmstrip, drag and keys. */
const MASTER = neutralSlideMaster();

function mount(state: RebrandStateV1, opts: { pending?: number; autoMatch?: boolean; autoRefused?: boolean; matchCount?: number } = {}): Mounted {
  document.body.innerHTML = `<div id="view"><div class="rb">
    <header class="rb-top"></header><section class="rb-intake"></section>
    <div class="rb-body"><nav class="rb-queue"></nav><div class="rb-grip" data-grip="queue" hidden></div><main class="rb-work"><section class="rb-compare"></section></main><div class="rb-grip" data-grip="decide" hidden></div><aside class="rb-decide"></aside></div>
    <nav class="rb-strip"></nav><aside class="rb-report" hidden></aside><footer class="rb-foot"></footer><p class="rb-status"></p>
  </div></div>`;
  const q = (selector: string): HTMLElement => {
    const el = document.querySelector<HTMLElement>(selector);
    assert.ok(el, selector);
    return el;
  };
  const calls: Call[] = [];
  const said: string[] = [];
  const chooser: Mounted['chooser'] = [];
  const footOpens: string[] = [];
  const rb = {} as RbCtx;
  rb.viewEl = q('#view');
  rb.host = {} as RbCtx['host'];
  rb.params = new URLSearchParams();
  rb.els = {
    root: q('.rb'), top: q('.rb-top'), modeSlot: q('.rb-top'), intake: q('.rb-intake'), body: q('.rb-body'),
    queue: q('.rb-queue'), queueGrip: q('.rb-grip[data-grip="queue"]'), compare: q('.rb-compare'),
    decideGrip: q('.rb-grip[data-grip="decide"]'), decide: q('.rb-decide'), strip: q('.rb-strip'),
    report: q('.rb-report'), foot: q('.rb-foot'), status: q('.rb-status'),
    alert: q('.rb'), scrim: q('.rb'),
  };
  rb.controller = stubController(state, calls, { autoMatch: opts.autoMatch });
  let autoRefused = opts.autoRefused === true;
  rb.state = state;
  rb.derived = null;
  rb.sel = { slideId: null, objectId: null, itemId: null };
  rb.queueTab = 'attention';
  rb.compareSide = 'both';
  rb.reportOpen = false;
  rb.narrow = false;
  rb.medium = false;
  rb.memo = {};
  rb.disposers = [];
  rb.render = () => {
    rb.derived = deriveReview(rb.state, rb.derived);
    if (!rb.derived) return;
    if (!rb.sel.slideId) rb.sel = { ...rb.sel, slideId: rb.derived.slides[0]?.id ?? null };
    rb.compare.render();
    rb.strip.render();
  };
  rb.select = (next) => {
    rb.sel = { ...rb.sel, ...next };
    rb.render();
    if (rb.sel.slideId) rb.strip.reveal(rb.sel.slideId);
  };
  rb.announce = (message) => { said.push(message); };
  rb.intake = { wire() {}, render() {} } as RbCtx['intake'];
  rb.top = { wire() {}, render() {}, download: async () => {}, close() {}, menuOpen: () => false, stepDone: () => 'Undone.' } as RbCtx['top'];
  rb.foot = {
    wire() {},
    render() {},
    toReviewCount: () => opts.pending ?? 0,
    say: (m: string) => { said.push(m); },
    // The footer's own path: with cards left it would ask first; the stand-in records the open.
    openInDesign: async (focusSlideId?: string) => {
      footOpens.push(focusSlideId ?? '');
      await rb.controller.openInDesign(focusSlideId ? { focusSlideId } : undefined);
    },
  } as RbCtx['foot'];
  rb.keep = { wire() {}, render() {} } as RbCtx['keep'];
  rb.report = { wire() {}, render() {}, open() {}, close() {} } as RbCtx['report'];
  // The comparison names objects the way the queue does, so it reads the real queue's words.
  rb.queue = queueOps(rb);
  rb.decide = {
    wire() {},
    render() {},
    announceOutcome: (outcome: RebrandEditOutcomeV1, success: string) => { said.push(outcome.ok ? success : `refused ${outcome.refusal ?? ''}`); },
    chooserOpen: () => false,
    closeChooser() {},
    sheetOpen: () => false,
    closeSheet() {},
  } as RbCtx['decide'];
  rb.chooser = {
    open: (ids: string[], entry: RbChooserEntry, anchor?: HTMLElement) => {
      chooser.push({ ids, entry });
      chooserAnchors.push(anchor ?? null);
    },
    close() {},
    isOpen: () => false,
    master: () => MASTER,
    arrangementName: (arrangement: 'original' | 'picture', as?: 'action' | 'state') => arrangementName(arrangement, as),
    autoMatchState: () => (rb.controller.autoMatchLayouts
      ? { shown: true, reason: autoRefused ? 'Auto-match is not available yet.' : '' }
      : { shown: false, reason: '' }),
    noteAutoMatchRefused: () => { autoRefused = true; },
    autoMatchCounts: (ids?: string[]) => ({ count: opts.matchCount ?? ids?.length ?? 0, likely: 1, anyMatch: true }),
    matchedText: (touched: number, likely: number) => matchedText(touched, likely),
    matchLabel: (count: number, blocked?: boolean) => matchLabel(count, blocked),
    autoMatchBlockedFor: (ids: string[], counts: { count: number; likely: number; anyMatch: boolean }) =>
      (autoRefused ? 'Auto-match is not available yet.' : autoMatchBlockedFor(rb, ids, counts)),
    // The run's likely count is read from the plan before and after; this stand-in plan does not move.
    likelySet: (_before: RenovationPlanV1 | null | undefined, _after: RenovationPlanV1 | null | undefined) => 1,
  } as RbCtx['chooser'];
  rb.theme = { renderControl() {}, renderStyle() {}, renderBackground() {} } as RbCtx['theme'];
  rb.compare = compareOps(rb);
  rb.strip = stripOps(rb);
  rb.keys = keysOps(rb);
  rb.drag = dragOps(rb);
  rb.compare.wire();
  rb.strip.wire();
  rb.keys.wire();
  rb.render();
  return { rb, calls, said, chooser, footOpens, unmount: () => { for (const dispose of rb.disposers.splice(0)) dispose(); } };
}

/** The anchor each chooser open was given, null when it took whatever had focus. */
const chooserAnchors: Array<HTMLElement | null> = [];

const settle = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

function key(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): void {
  target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

function options(rb: RbCtx): HTMLElement[] {
  return [...rb.els.strip.querySelectorAll<HTMLElement>('.rb-thumb-pick')];
}

/** The open menu's rows: the action, the row's name (its first line), and whether it cannot run now. */
function menuRows(): Array<{ act: string; text: string; disabled: boolean }> {
  return [...document.querySelectorAll<HTMLButtonElement>('.ctx-menu [data-act]')].map((row) => ({
    act: row.dataset.act ?? '',
    text: (row.querySelector('.folder-menu-text > span') ?? row.querySelector('span'))?.textContent ?? '',
    disabled: row.getAttribute('aria-disabled') === 'true',
  }));
}

/** The reason a row or a bar button that cannot run now gives, read through its description. */
function reasonOf(el: Element | null | undefined): string {
  const id = el?.getAttribute('aria-describedby') ?? '';
  return id ? document.getElementById(id)?.textContent ?? '' : '';
}

function rightClick(el: Element): void {
  el.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20, button: 2 }));
}

/** The frame the Proposed pane draws, by id. */
function proposedFrame(rb: RbCtx): string {
  return rb.els.compare.querySelector<HTMLElement>('[data-frames] .rb-frame, .rb-frame')?.dataset.frame ?? '';
}

// ─── render ──────────────────────────────────────────────────────────────────

test('the strip is a listbox of options, with a More button that is no tab stop and no control row', () => {
  const { rb, unmount } = mount(stateFrom());
  const box = rb.els.strip.querySelector<HTMLElement>('[data-list]');
  assert.equal(box?.getAttribute('role'), 'listbox');
  assert.equal(box?.getAttribute('aria-multiselectable'), 'true');
  assert.ok(box?.getAttribute('aria-describedby'), 'the instructions are the list\'s description, heard once');
  const all = options(rb);
  assert.ok(all.length > 0);
  for (const option of all) {
    assert.equal(option.getAttribute('role'), 'option');
    assert.match(option.getAttribute('aria-selected') ?? '', /^(true|false)$/);
  }
  assert.equal(all.filter((option) => option.tabIndex === 0).length, 1, 'one tab stop in the strip');
  assert.equal(all.find((option) => option.getAttribute('aria-current') === 'true')?.getAttribute('aria-selected'), 'true');
  const more = rb.els.strip.querySelectorAll<HTMLElement>('[data-more]');
  assert.equal(more.length, all.length);
  for (const button of more) assert.equal(button.tabIndex, -1);
  assert.equal(rb.els.strip.querySelector('[data-reorder-handle], .rb-thumb-ctl, input[type="checkbox"]'), null, 'no grip, no checkbox');
  // The layout rides in the name, and in the hover title on the picture, which is hidden
  // from the accessibility tree so the title is never read as a second copy of the name.
  const layout = rb.derived?.slides[0]?.layout ?? '';
  assert.ok(layout);
  assert.match(all[0]?.getAttribute('aria-label') ?? '', /, [A-Z]/);
  assert.equal(all[0]?.hasAttribute('title'), false, 'no title on the option');
  const art = all[0]?.querySelector('.rb-thumb-art');
  assert.equal(art?.getAttribute('aria-hidden'), 'true');
  assert.ok((art?.getAttribute('title') ?? '').length > 0);
  // A windowed listbox gives each option its place in the whole deck.
  const count = rb.derived?.slides.length ?? 0;
  all.forEach((option, i) => {
    assert.equal(option.getAttribute('aria-setsize'), String(count));
    assert.equal(option.getAttribute('aria-posinset'), String(i + 1));
  });
  unmount();
});

test('a left-out slide is grey with a crossed eye and the words Left out', () => {
  const [first] = RUN.plan.slides;
  assert.ok(first);
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((slide) => (slide.id === first.id ? { ...slide, include: false } : slide)) };
  const { rb, unmount } = mount(stateFrom(plan));
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${first.id}"]`);
  assert.equal(tile?.dataset.include, 'false');
  assert.ok(tile?.querySelector('.rb-thumb-out svg'), 'the crossed eye');
  assert.match(tile?.querySelector('.rb-thumb-pick')?.getAttribute('aria-label') ?? '', /Left out/);
  assert.equal(tile?.querySelector('[data-layout-of]'), null, 'a slide left out has no layout to change');
  assert.equal(tile?.querySelector('.rb-thumb-dot'), null, 'nor a mark');
  unmount();
});

test('the render skips when nothing it draws changed, and a new selection only marks the nodes it has', () => {
  const { rb, unmount } = mount(stateFrom());
  const tiles = (): HTMLElement[] => [...rb.els.strip.querySelectorAll<HTMLElement>('.rb-thumb')];
  const before = tiles();
  const arts = before.map((tile) => tile.querySelector('.rb-thumb-art'));
  rb.strip.render();
  assert.deepEqual(tiles(), before, 'the same nodes: nothing moved');
  const [first, second] = rb.derived?.slides ?? [];
  assert.ok(first && second);
  rb.strip.pick(second.id, 'toggle');
  assert.deepEqual(tiles(), before, 'a new selection keeps every thumbnail');
  assert.deepEqual(tiles().map((tile) => tile.querySelector('.rb-thumb-art')), arts, 'and every picture');
  const option = (id: string): HTMLElement | null => rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${id}"]`);
  assert.equal(option(second.id)?.getAttribute('aria-selected'), 'true');
  assert.equal(option(second.id)?.getAttribute('aria-current'), 'true');
  assert.equal(option(second.id)?.tabIndex, 0, 'the Tab stop follows the current slide');
  assert.equal(option(first.id)?.hasAttribute('aria-current'), false);
  assert.equal(option(first.id)?.tabIndex, -1);
  unmount();
});

test('a focused thumbnail keeps its node through a redraw that changes it, so it is not read again', () => {
  const { rb, unmount } = mount(stateFrom());
  const [first] = rb.derived?.slides ?? [];
  assert.ok(first);
  rb.strip.focus(first.id);
  const focused = document.activeElement;
  assert.ok(focused instanceof HTMLElement && focused.classList.contains('rb-thumb-pick'));
  let refocused = 0;
  focused.addEventListener('focus', () => { refocused += 1; });
  // The slide is left out: its name, its mark and its controls change.
  const plan: RenovationPlanV1 = { ...RUN.plan, revision: RUN.plan.revision + 1, slides: RUN.plan.slides.map((slide) => (slide.id === first.id ? { ...slide, include: false } : slide)) };
  rb.state = stateFrom(plan);
  rb.render();
  assert.equal(document.activeElement, focused, 'the same option keeps focus');
  assert.equal(refocused, 0, 'no second focus event');
  assert.match(focused.getAttribute('aria-label') ?? '', /Left out/);
  assert.equal(focused.closest('.rb-thumb')?.getAttribute('data-include'), 'false');
  unmount();
});

test('a slide name says its own problem once, and leaves out the state most slides share', () => {
  const { rb, unmount } = mount(stateFrom());
  const names = options(rb).map((option) => option.getAttribute('aria-label') ?? '');
  for (const name of names) assert.doesNotMatch(name, /Needs attention.*Needs a look|Needs a look.*Needs attention/, name);
  const slides = rb.derived?.slides ?? [];
  const kinds = new Map<string, number>();
  for (const slide of slides) {
    const kind = !slide.include ? 'Left out' : slide.attention > 0 ? 'Needs attention' : slide.unreviewed > 0 ? 'Not reviewed' : 'Accepted';
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  for (const [word, count] of kinds) {
    if (word === 'Left out' || count * 2 <= slides.length) continue;
    for (const name of names) assert.doesNotMatch(name, new RegExp(`, ${word}(,|$)`), `${word} is on most slides, so no name says it`);
  }
  unmount();
});

// ─── selection ───────────────────────────────────────────────────────────────

test('click selects one, Ctrl or Cmd adds, Shift takes a range in deck order', () => {
  const { rb, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  assert.ok(slides.length >= 3);
  const click = (id: string, init: MouseEventInit = {}): void => {
    rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${id}"]`)?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ...init }));
  };
  click(slides[0]!.id);
  assert.deepEqual(selectedSlideIds(rb.sel, slides), [slides[0]!.id]);
  click(slides[2]!.id, { ctrlKey: true });
  assert.deepEqual(selectedSlideIds(rb.sel, slides), [slides[0]!.id, slides[2]!.id]);
  assert.equal(rb.sel.slideId, slides[2]!.id, 'the comparison follows the slide picked last');
  const selected = options(rb).filter((option) => option.getAttribute('aria-selected') === 'true').map((option) => option.dataset.slide);
  assert.deepEqual(selected, [slides[0]!.id, slides[2]!.id]);
  click(slides[0]!.id);
  click(slides[2]!.id, { shiftKey: true });
  assert.deepEqual(selectedSlideIds(rb.sel, slides), slides.slice(0, 3).map((slide) => slide.id));
  // The bar over the strip says how many, in words.
  const bar = rb.els.strip.querySelector<HTMLElement>('[data-bar]');
  assert.equal(bar?.hidden, false);
  assert.equal(bar?.querySelector('.rb-strip-count')?.textContent, '3 slides selected');
  // A selection made elsewhere, on a slide outside the set, leaves the strip with that slide.
  click(slides[0]!.id);
  click(slides[1]!.id, { shiftKey: true });
  rb.select({ slideId: slides[2]!.id, objectId: null, itemId: null });
  assert.equal(selectedSlideIds(rb.sel, slides).length, 1);
  unmount();
});

// ─── the menu ────────────────────────────────────────────────────────────────

test('right click opens the nine rows in order, Duplicate absent, Reset disabled with its reason on an untouched slide', async () => {
  const { rb, calls, chooser, footOpens, unmount } = mount(stateFrom(), { pending: 6 });
  const second = rb.derived?.slides[1];
  assert.ok(second);
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${second.id}"]`);
  assert.ok(tile);
  rightClick(tile);
  const rows = menuRows();
  // Duplicate is left out until its contract is built, and the rows fall in five groups.
  assert.deepEqual(rows.map((row) => row.act), ['layout', 'exclude', 'earlier', 'later', 'position', 'reset', 'design', 'select', 'shortcuts']);
  assert.deepEqual(rows.map((row) => row.text), [
    'Change layout…', 'Leave out', 'Move earlier', 'Move later', 'Move to position…', 'Reset slide', 'Open in Design', 'Select several…', 'Keyboard shortcuts',
  ]);
  assert.equal(document.querySelectorAll('.ctx-menu [role="separator"]').length, 4, 'a rule between the groups');
  assert.equal(rows.some((row) => /\.\.\./.test(row.text)), false, 'the ellipsis is one character');
  // A row that cannot run now keeps its focus and says why on a second line: nothing on
  // this slide was changed, so Reset has nothing to put back.
  const reset = document.querySelector<HTMLButtonElement>('.ctx-menu [data-act="reset"]');
  assert.ok(reset);
  assert.equal(reset.disabled, false, 'no disabled attribute, so it takes focus');
  assert.equal(reset.getAttribute('aria-disabled'), 'true');
  assert.equal(reasonOf(reset), 'Nothing to reset on this slide.');
  reset.click();
  await settle();
  assert.equal(calls.some((call) => call.name === 'resetSlide'), false, 'a disabled row runs nothing');
  // Open in Design runs with cards left, through the footer's path, which asks first.
  rightClick(tile);
  const design = document.querySelector<HTMLButtonElement>('.ctx-menu [data-act="design"]');
  assert.equal(design?.getAttribute('aria-disabled'), null, 'Open in Design is never disabled over cards left');
  design?.click();
  await settle();
  assert.deepEqual(footOpens, [second.id], 'the footer opens it, on this slide');
  // Each move row has an icon of its own.
  rightClick(tile);
  const glyphs = ['earlier', 'later', 'position'].map((act) => document.querySelector(`.ctx-menu [data-act="${act}"] svg`)?.outerHTML ?? '');
  assert.equal(new Set(glyphs).size, 3, 'three different move icons');
  document.querySelector<HTMLElement>('.ctx-menu [data-act="layout"]')?.click();
  assert.deepEqual(chooser.at(-1), { ids: [second.id], entry: 'menu' });
  rightClick(tile);
  document.querySelector<HTMLElement>('.ctx-menu [data-act="later"]')?.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'move', args: [second.id, 1] });
  rightClick(tile);
  document.querySelector<HTMLElement>('.ctx-menu [data-act="exclude"]')?.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'include', args: [[second.id], false] });
  unmount();
});

test('with nothing pending Open in Design opens on that slide; the More button opens the same menu', async () => {
  const { rb, calls, unmount } = mount(stateFrom());
  const first = rb.derived?.slides[0];
  assert.ok(first);
  rb.els.strip.querySelector<HTMLElement>(`[data-more="${first.id}"]`)?.click();
  const rows = menuRows();
  assert.equal(rows[0]?.act, 'layout', 'the More button opens the same rows');
  assert.deepEqual(rows.find((row) => row.act === 'design'), { act: 'design', text: 'Open in Design', disabled: false });
  assert.deepEqual(rows.find((row) => row.act === 'earlier'), { act: 'earlier', text: 'Move earlier', disabled: true }, 'the first slide is already first');
  assert.equal(reasonOf(document.querySelector('.ctx-menu [data-act="earlier"]')), 'This slide is already first.');
  document.querySelector<HTMLElement>('.ctx-menu [data-act="design"]')?.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'openInDesign', args: [{ focusSlideId: first.id }] });
  unmount();
});

test('the keyboard opens the menu on the focused thumbnail, and inside a multi-selection it is the bulk menu', () => {
  const { rb, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  const option = options(rb)[0];
  assert.ok(option);
  option.focus();
  // Shift+F10: the browser fires contextmenu on the focused element, at no pointer.
  option.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
  assert.equal(menuRows()[0]?.act, 'layout');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  rb.strip.pick(slides[0]!.id);
  rb.strip.pick(slides[1]!.id, 'toggle');
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[1]!.id}"]`);
  assert.ok(tile);
  rightClick(tile);
  assert.equal(document.querySelector('.ctx-menu .folder-menu-head')?.textContent, '2 slides selected');
  assert.deepEqual(menuRows().find((row) => row.act === 'match'), { act: 'match', text: 'Match 2 slides', disabled: false }, 'the count it would set, before it runs');
  assert.equal(menuRows().some((row) => row.act === 'duplicate'), false, 'no Duplicate row until it is built');
  assert.deepEqual(menuRows().find((row) => row.act === 'reset'), { act: 'reset', text: 'Reset slides', disabled: true }, 'nothing to reset on these slides');
  unmount();
});

test('Reset slide runs on a slide a person changed, and the menu hands focus back to the thumbnail', async () => {
  const [, second] = RUN.plan.slides;
  assert.ok(second);
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((slide) => (slide.id === second.id ? { ...slide, layoutSource: 'user' as const } : slide)) };
  const { rb, calls, unmount } = mount(stateFrom(plan));
  rb.strip.focus(second.id);
  const option = document.activeElement as HTMLElement;
  option.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 0, clientY: 0 }));
  const reset = document.querySelector<HTMLElement>('.ctx-menu [data-act="reset"]');
  assert.equal(reset?.getAttribute('aria-disabled'), null);
  reset?.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'resetSlide', args: [[second.id]] });
  const active = document.activeElement as HTMLElement | null;
  assert.ok(active?.classList.contains('rb-thumb-pick'), `focus is on ${active?.tagName}`);
  assert.equal(active?.dataset.slide, second.id);
  unmount();
});

test('the bulk menu matches layouts for the selected slides only, as one command, and says how many were likely', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.strip.pick(slides[0]!.id);
  rb.strip.pick(slides[2]!.id, 'toggle');
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[2]!.id}"]`);
  assert.ok(tile);
  rightClick(tile);
  document.querySelector<HTMLElement>('.ctx-menu [data-act="match"]')?.click();
  await settle();
  assert.deepEqual(calls.filter((call) => call.name === 'autoMatchLayouts'), [{ name: 'autoMatchLayouts', args: ['likely', [slides[0]!.id, slides[2]!.id]] }]);
  assert.equal(said.at(-1), 'Matched 1 slide. It was a likely match.');
  unmount();
});

test('Auto-match is offered nowhere when the controller has no such command, and disabled with its reason once refused', async () => {
  const absent = mount(stateFrom(), { autoMatch: false });
  let slides = absent.rb.derived?.slides ?? [];
  absent.rb.strip.pick(slides[0]!.id);
  absent.rb.strip.pick(slides[1]!.id, 'toggle');
  const bar = (rb: RbCtx): HTMLButtonElement | null => rb.els.strip.querySelector<HTMLButtonElement>('[data-bar-act="match"]');
  assert.equal(bar(absent.rb), null, 'no Auto-match in the bar');
  const tile = absent.rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[1]!.id}"]`);
  assert.ok(tile);
  rightClick(tile);
  assert.equal(menuRows().some((row) => row.act === 'match'), false, 'no Auto-match in the bulk menu');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  absent.unmount();
  const refused = mount(stateFrom(), { autoRefused: true });
  slides = refused.rb.derived?.slides ?? [];
  refused.rb.strip.pick(slides[0]!.id);
  refused.rb.strip.pick(slides[1]!.id, 'toggle');
  assert.equal(bar(refused.rb)?.getAttribute('aria-disabled'), 'true');
  assert.equal(reasonOf(bar(refused.rb)), 'Auto-match is not available yet.', 'the reason the chooser gives');
  assert.equal(bar(refused.rb)?.textContent, 'Match layouts', 'the same verb, with no count, while it cannot run');
  refused.unmount();
});

test('Auto-match over a selection it would set none of is disabled, with the reason, in the bar and the bulk menu', () => {
  const { rb, unmount } = mount(stateFrom(), { matchCount: 0 });
  const slides = rb.derived?.slides ?? [];
  rb.strip.pick(slides[0]!.id);
  rb.strip.pick(slides[1]!.id, 'toggle');
  const bar = rb.els.strip.querySelector<HTMLButtonElement>('[data-bar-act="match"]');
  assert.equal(bar?.getAttribute('aria-disabled'), 'true');
  assert.equal(bar?.disabled, false, 'it keeps its focus');
  assert.equal(bar?.textContent, 'Match layouts');
  assert.match(reasonOf(bar), /^(These slides already use their suggested layouts\.|None of these slides has a suggested layout\.)$/);
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[1]!.id}"]`);
  assert.ok(tile);
  rightClick(tile);
  assert.equal(menuRows().find((row) => row.act === 'match')?.disabled, true);
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  unmount();
});

test('Auto-match that would set none because the suggested layouts have too few boxes says so, in the singular and the plural', () => {
  const { rb, unmount } = mount(stateFrom(), { matchCount: 0 });
  const ids = (rb.derived?.slides ?? []).slice(0, 2).map((slide) => slide.id);
  assert.equal(autoMatchBlockedFor(rb, ids, { count: 0, likely: 0, anyMatch: true, tooSmall: 1 }), '1 suggested layout has too few boxes, so that slide is left for you.');
  assert.equal(autoMatchBlockedFor(rb, ids, { count: 0, likely: 0, anyMatch: true, tooSmall: 2 }), '2 suggested layouts have too few boxes, so those slides are left for you.');
  assert.equal(autoMatchBlockedFor(rb, ids, { count: 1, likely: 0, anyMatch: true, tooSmall: 2 }), '', 'a slide it would set leaves it on offer');
  unmount();
});

test('a slide title with an ampersand is read as written, not as an entity', () => {
  const source = structuredClone(RUN.deck);
  const first = source.slides[0];
  assert.ok(first);
  for (const object of first.objects) {
    for (const para of object.text?.paras ?? []) for (const run of para.runs) run.text = 'R&D';
  }
  const { rb, unmount } = mount(stateFrom(RUN.plan, { source }));
  const pick = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${first.id}"]`);
  const label = pick?.getAttribute('aria-label') ?? '';
  assert.match(label, /R&D/, label);
  assert.doesNotMatch(label, /&amp;|&#/, label);
  assert.doesNotMatch(pick?.querySelector('.rb-thumb-art')?.getAttribute('title') ?? '', /&amp;|&#/);
  unmount();
});

test('the layout pill names the layout the way the chooser does, draws it with no plus, and opens the chooser', () => {
  const { rb, chooser, unmount } = mount(stateFrom());
  const slide = rb.derived?.slides.find((one) => one.include);
  assert.ok(slide);
  const pick = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${slide.id}"]`);
  const archetype = MASTER.archetypes.find((a) => a.id === slide.layout);
  assert.ok(archetype, `${slide.layout} is on the master`);
  const pill = rb.els.strip.querySelector<HTMLElement>(`[data-layout-of="${slide.id}"]`);
  assert.ok(pill?.querySelector('.rb-thumb-wire svg.arch-thumb'), 'the pill draws the slide\'s own layout');
  assert.equal(pill?.tabIndex, -1, 'L is the keyboard\'s way; the pill is no tab stop');
  assert.equal(pill?.getAttribute('title'), `Change layout: ${pill?.querySelector('.rb-thumb-layout-name')?.textContent ?? ''}`, 'the whole name, even when the pill shows only the wireframe');
  assert.equal(pill?.getAttribute('aria-haspopup'), 'dialog');
  const name = pill?.querySelector('.rb-thumb-layout-name')?.textContent ?? '';
  assert.ok(name && (pick?.getAttribute('aria-label') ?? '').endsWith(`, ${name}`), 'one name in the pill and the thumbnail');
  pill?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  assert.deepEqual(chooser.at(-1), { ids: [slide.id], entry: 'menu' });
  // The number sits on the picture, in the top start corner.
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slide.id}"]`);
  assert.equal(tile?.querySelector('.rb-thumb-pick .rb-thumb-num')?.textContent, String(slide.number));
  assert.equal(tile?.querySelector('.rb-thumb-foot, .rb-thumb-state'), null, 'nothing under the picture');
  unmount();
});

test('a slide in its original arrangement or kept as a picture names that on its pill and draws no wireframe', () => {
  const [first, second] = RUN.plan.slides;
  assert.ok(first && second);
  const plan: RenovationPlanV1 = {
    ...RUN.plan,
    slides: RUN.plan.slides.map((slide) => (slide.id === first.id
      ? { ...slide, arrangement: 'original' as const }
      : slide.id === second.id ? { ...slide, arrangement: 'picture' as const } : slide)),
  };
  const { rb, unmount } = mount(stateFrom(plan));
  const pill = (id: string): HTMLElement | null => rb.els.strip.querySelector<HTMLElement>(`[data-layout-of="${id}"]`);
  // The chooser's own names for the two arrangements, in their state form.
  assert.equal(pill(first.id)?.querySelector('.rb-thumb-layout-name')?.textContent, arrangementName('original', 'state'));
  assert.equal(pill(first.id)?.querySelector('.rb-thumb-wire'), null);
  assert.equal(pill(second.id)?.querySelector('.rb-thumb-layout-name')?.textContent, arrangementName('picture', 'state'));
  assert.equal(pill(second.id)?.querySelector('.rb-thumb-wire'), null);
  assert.ok((rb.els.strip.querySelector(`.rb-thumb-pick[data-slide="${first.id}"]`)?.getAttribute('aria-label') ?? '').endsWith(`, ${arrangementName('original', 'state')}`));
  unmount();
});

test('bulk include and leave out are said in whole plural sentences', async () => {
  const { rb, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.strip.pick(slides[0]!.id);
  rb.strip.pick(slides[2]!.id, 'range');
  rb.els.strip.querySelector<HTMLElement>('[data-bar-act="exclude"]')?.click();
  await settle();
  assert.equal(said.at(-1), '3 slides are left out.');
  await rb.strip.include([slides[1]!.id], true);
  assert.equal(said.at(-1), `Slide ${slides[1]!.number} is in the deck.`);
  unmount();
});

test('no menu opens on the intake', () => {
  const { rb, unmount } = mount(stateFrom());
  const event = new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
  rb.els.intake.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false, 'the browser keeps its own menu there');
  assert.equal(document.querySelector('.ctx-menu [data-act]'), null);
  unmount();
});

// ─── the keyboard ────────────────────────────────────────────────────────────

test('ArrowRight goes to the next slide and the Proposed pane changes; J, K, Page Down, Home and End flick too', () => {
  const { rb, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  assert.ok(slides.length >= 3);
  rb.select({ slideId: slides[0]!.id, objectId: null, itemId: null });
  const before = proposedFrame(rb);
  key('ArrowRight');
  assert.equal(rb.sel.slideId, slides[1]!.id);
  assert.notEqual(proposedFrame(rb), before, 'the Proposed pane draws the next slide');
  key('j');
  assert.equal(rb.sel.slideId, slides[2]!.id);
  key('k');
  assert.equal(rb.sel.slideId, slides[1]!.id);
  key('PageDown');
  assert.equal(rb.sel.slideId, slides[2]!.id);
  key('PageUp');
  key('ArrowLeft');
  assert.equal(rb.sel.slideId, slides[0]!.id);
  key('End');
  assert.equal(rb.sel.slideId, slides.at(-1)!.id);
  key('Home');
  assert.equal(rb.sel.slideId, slides[0]!.id);
  unmount();
});

test('flicking leaves a text field, a select, an open menu and a tab row alone', () => {
  const { rb, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.select({ slideId: slides[0]!.id, objectId: null, itemId: null });
  const field = document.createElement('input');
  rb.els.compare.append(field);
  key('ArrowRight', {}, field);
  key('j', {}, field);
  const select = document.createElement('select');
  rb.els.compare.append(select);
  key('ArrowRight', {}, select);
  const tabs = document.createElement('div');
  tabs.setAttribute('role', 'tablist');
  const tab = document.createElement('button');
  tabs.append(tab);
  rb.els.compare.append(tabs);
  key('ArrowRight', {}, tab);
  assert.equal(rb.sel.slideId, slides[0]!.id, 'nothing moved');
  const tile = rb.els.strip.querySelector<HTMLElement>('.rb-thumb');
  assert.ok(tile);
  rightClick(tile);
  key('ArrowRight');
  assert.equal(rb.sel.slideId, slides[0]!.id, 'an open menu keeps its arrows');
  unmount();
});

test('on the filmstrip focus follows the flick, Shift extends the selection and Ctrl+A selects every slide', () => {
  const { rb, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.strip.focus(slides[0]!.id);
  const focused = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset.slide;
  key('ArrowRight', {}, document.activeElement ?? document.body);
  assert.equal(focused(), slides[1]!.id, 'focus moved with the slide');
  key('ArrowRight', { shiftKey: true }, document.activeElement ?? document.body);
  assert.deepEqual(selectedSlideIds(rb.sel, slides), [slides[1]!.id, slides[2]!.id]);
  key('a', { ctrlKey: true }, document.activeElement ?? document.body);
  assert.equal(selectedSlideIds(rb.sel, slides).length, slides.length);
  assert.equal(said.at(-1), `${slides.length} slides selected.`);
  key('Escape', {}, document.activeElement ?? document.body);
  assert.equal(selectedSlideIds(rb.sel, slides).length, 1, 'Esc goes back to one slide');
  assert.equal(said.at(-1), '1 slide selected.', 'in the bar\'s own words');
  unmount();
});

test('the instructions pair K with previous and J with next, and name no direction that flips', () => {
  const { rb, unmount } = mount(stateFrom());
  const help = rb.els.strip.querySelector('#rb-strip-help')?.textContent ?? '';
  assert.match(help, /K and J, go to the previous and next slide/);
  assert.doesNotMatch(help, /Left and Right/);
  unmount();
});

test('while the report drawer is open the review keys do nothing to the slides behind it', () => {
  const { rb, calls, chooser, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.select({ slideId: slides[1]!.id, objectId: null, itemId: null });
  rb.reportOpen = true;
  const button = document.createElement('button');
  rb.els.report.hidden = false;
  rb.els.report.append(button);
  key('j', {}, button);
  key('ArrowRight', {}, button);
  key('ArrowRight', { altKey: true }, button);
  key('l', {}, button);
  assert.equal(rb.sel.slideId, slides[1]!.id, 'the selection did not move');
  assert.equal(calls.some((call) => call.name === 'move' || call.name === 'moveSlides'), false, 'nothing moved');
  assert.equal(chooser.length, 0, 'no chooser opened behind the drawer');
  rb.reportOpen = false;
  unmount();
});

test('J, K and L work by the key\'s place on a layout that types another script', () => {
  const { rb, chooser, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.select({ slideId: slides[0]!.id, objectId: null, itemId: null });
  // Ukrainian: the J key types о, the K key л, the L key д.
  key('о', { code: 'KeyJ' });
  assert.equal(rb.sel.slideId, slides[1]!.id);
  key('л', { code: 'KeyK' });
  assert.equal(rb.sel.slideId, slides[0]!.id);
  key('д', { code: 'KeyL' });
  assert.deepEqual(chooser.at(-1), { ids: [slides[0]!.id], entry: 'menu' });
  unmount();
});

test('Alt with an arrow at either end writes nothing and says the slide is already there', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const included = (rb.derived?.slides ?? []).filter((slide) => slide.include);
  rb.select({ slideId: included[0]!.id, objectId: null, itemId: null });
  key('ArrowLeft', { altKey: true });
  await settle();
  assert.equal(calls.some((call) => call.name === 'move'), false);
  assert.equal(said.at(-1), 'This slide is already first.');
  rb.select({ slideId: included.at(-1)!.id, objectId: null, itemId: null });
  key('ArrowRight', { altKey: true });
  await settle();
  assert.equal(calls.some((call) => call.name === 'move'), false);
  assert.equal(said.at(-1), 'This slide is already last.');
  unmount();
});

test('a key pressed outside the filmstrip ends the keyboard move and does that control\'s work', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const first = rb.derived?.slides[0];
  assert.ok(first);
  rb.drag.startMove(first.id);
  key('ArrowRight', {}, document.activeElement ?? document.body);
  const accept = document.createElement('button');
  rb.els.decide.append(accept);
  accept.focus();
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  accept.dispatchEvent(enter);
  await settle();
  assert.equal(said.at(-1), 'Move cancelled.');
  assert.equal(calls.some((call) => call.name === 'moveSlides'), false, 'the Enter did not drop the move');
  assert.equal(rb.drag.active(), false);
  assert.equal(enter.defaultPrevented, false, 'the Enter was left to the focused control');
  unmount();
});

test('Alt with an arrow moves the slide one place, and L opens the layout chooser for the selection', async () => {
  const { rb, calls, chooser, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  rb.select({ slideId: slides[0]!.id, objectId: null, itemId: null });
  key('ArrowRight', { altKey: true });
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'move', args: [slides[0]!.id, 1] });
  key('l');
  assert.deepEqual(chooser.at(-1), { ids: [slides[0]!.id], entry: 'menu' });
  unmount();
});

test('the keyboard move shows the slide at each place, says where, and drops as one move', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  const first = slides[0]!;
  rb.drag.startMove(first.id);
  assert.match(said.at(-1) ?? '', /^Moving slide 1, position 1 of \d+\. Left and Right move it, Enter drops it, Escape cancels\.$/);
  key('ArrowRight', {}, document.activeElement ?? document.body);
  key('ArrowRight', {}, document.activeElement ?? document.body);
  assert.equal(said.at(-1), `Position 3 of ${slides.filter((slide) => slide.include).length}.`);
  assert.equal(options(rb)[2]?.dataset.slide, first.id, 'the strip shows the slide at its new place');
  assert.equal(calls.filter((call) => call.name === 'moveSlides').length, 0, 'nothing written before the drop');
  key('Enter', {}, document.activeElement ?? document.body);
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'moveSlides', args: [[first.id], 2] });
  // Escape leaves a move with nothing written.
  rb.drag.startMove(first.id);
  key('ArrowRight', {}, document.activeElement ?? document.body);
  key('Escape', {}, document.activeElement ?? document.body);
  assert.equal(said.at(-1), 'Move cancelled.');
  assert.equal(calls.filter((call) => call.name === 'moveSlides').length, 1);
  unmount();
});

test('Left and Right swap in a right to left layout', () => {
  assert.equal(flickOf('ArrowRight', false), 'next');
  assert.equal(flickOf('ArrowRight', true), 'prev');
  assert.equal(flickOf('ArrowLeft', true), 'next');
  assert.equal(flickOf('j', true), 'next');
  assert.equal(flickOf('K', false), 'prev');
  assert.equal(flickOf('x', false), null);
});

// ─── the drop arithmetic ─────────────────────────────────────────────────────

test('a drop maps its gap over included slides, a block keeps its own order, and past the window by pitch', () => {
  const included = ['a', 'b', 'c', 'd', 'e'];
  assert.equal(landingIndex(included, new Set(['b']), 4), 3, 'b dropped between d and e sits at 3');
  assert.equal(landingIndex(included, new Set(['d']), 0), 0);
  assert.equal(landingIndex(included, new Set(['b', 'd']), 5), 3, 'a block at the end');
  assert.equal(landingIndex(included, new Set(['a']), 1), 0, 'its own gap is no move');
  assert.equal(gapAt(0, 224, 5), 0);
  assert.equal(gapAt(224 * 3 + 10, 224, 5), 3);
  assert.equal(gapAt(224 * 30, 224, 40), 30, 'a gap far past the mounted window');
  assert.equal(gapAt(224 * 99, 224, 5), 5, 'clamped to the end');
});

test('the strip says a move with the position and the count', async () => {
  const { rb, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  await rb.strip.moveBy(slides[1]!.id, 1);
  const count = slides.filter((slide) => slide.include).length;
  assert.equal(said.at(-1), `Moved slide ${slides[1]!.number} to position 3 of ${count}.`);
  unmount();
});

// ─── the window, the names and the words ────────────────────────────────────

test('the filmstrip mounts only the window and the overscan on a forty-slide deck', () => {
  const template = RUN.deck.slides[0];
  const planSlide = RUN.plan.slides[0];
  assert.ok(template && planSlide);
  const ids = Array.from({ length: 40 }, (_, i) => `synthetic/slide${i + 1}`);
  const source = { ...RUN.deck, slides: ids.map((id, index) => ({ ...template, id, index, objects: [], readingOrder: [] })) };
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: ids.map((id) => ({ ...planSlide, id, objects: [] })) };
  const census = { ...RUN.census, groups: [], layouts: [], objects: [] };
  const { rb, unmount } = mount(stateFrom(plan, { source, census, preview: null, faithful: compileFaithful(source) }));
  const mounted = rb.els.strip.querySelectorAll('.rb-thumb');
  assert.ok(mounted.length < 40, `mounted ${mounted.length} of 40`);
  assert.ok(mounted.length <= RB_STRIP_FALLBACK_VISIBLE + 2 * RB_STRIP_OVERSCAN, `mounted ${mounted.length}`);
  assert.ok(rb.els.strip.querySelector('.rb-strip-spacer'), 'the rest of the deck is a sized spacer');
  // Revealing a slide far along mounts it.
  const last = ids[39];
  assert.ok(last);
  rb.strip.reveal(last);
  const shown = [...rb.els.strip.querySelectorAll<HTMLElement>('.rb-thumb')].map((el) => el.dataset.slide);
  assert.ok(shown.includes(last));
  assert.ok(shown.length <= RB_STRIP_FALLBACK_VISIBLE + 2 * RB_STRIP_OVERSCAN);
  unmount();
});

test('a slide titled with underscores is named by its number on the filmstrip', async () => {
  const { readableTitle } = await import('./shared.ts');
  assert.equal(readableTitle('___'), undefined);
  assert.equal(readableTitle(' _ \n '), undefined);
  assert.equal(readableTitle('Q3 review'), 'Q3 review');
  assert.equal(readableTitle('المبيعات'), 'المبيعات');
  const source = structuredClone(RUN.deck);
  const third = source.slides[2];
  assert.ok(third);
  for (const object of third.objects) {
    for (const para of object.text?.paras ?? []) for (const run of para.runs) run.text = '_';
  }
  const { rb, unmount } = mount(stateFrom(RUN.plan, { source }));
  const pick = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${third.id}"]`);
  assert.match(pick?.getAttribute('aria-label') ?? '', /^Slide 3(,|$)/);
  unmount();
});

test('the filmstrip says the state in the words the rest of the view uses', () => {
  const plan: RenovationPlanV1 = {
    ...RUN.plan,
    slides: RUN.plan.slides.map((slide, index) => (index === 0
      ? { ...slide, objects: slide.objects.map((row) => ({ ...row, review: 'accepted' as const, decision: row.proposal, author: 'user' as const })) }
      : slide)),
  };
  const { rb, unmount } = mount(stateFrom(plan));
  const names = [...rb.els.strip.querySelectorAll('.rb-thumb-pick')].map((el) => el.getAttribute('aria-label') ?? '');
  for (const text of names) {
    assert.doesNotMatch(text, /Reviewed|Unreviewed/, text);
  }
  assert.ok(names.some((name) => /, Accepted(,|$)/.test(name)), 'an accepted slide says Accepted');
  unmount();
});

// ─── close-out section 3.7 ───────────────────────────────────────────────────

test('the needs-a-look mark is on a slide with a problem of its own, never on a deck-wide suggestion, and on none when most would carry it', () => {
  const { rb, unmount } = mount(stateFrom());
  const base = rb.derived;
  assert.ok(base && base.queue.length > 0 && base.slides.length >= 3, `${base?.queue.length} cards, ${base?.slides.length} slides`);
  const [template] = base.queue;
  assert.ok(template);
  const { type: _type, ...plain } = template;
  const slides = base.slides.filter((slide) => slide.include);
  const item = (id: string, slideIds: string[], objectIds: string[], section: 'attention' | 'suggestions' = 'attention') =>
    ({ ...plain, id, section, slideIds, objectIds });
  const marked = (): string[] => [...rb.els.strip.querySelectorAll<HTMLElement>('.rb-thumb[data-problem="true"]')].map((el) => el.dataset.slide ?? '');
  const redraw = (queue: typeof base.queue, pendingIds: string[]): void => {
    rb.derived = { ...base, queue, pendingIds };
    rb.memo.strip = '';
    rb.strip.render();
  };
  redraw([
    item('own', [slides[1]!.id], ['x1']),
    item('wide', slides.slice(0, 3).map((slide) => slide.id), ['x2', 'x3', 'x4']),
    item('suggested', [slides[2]!.id], ['x5'], 'suggestions'),
    item('answered', [slides[2]!.id], ['x6']),
  ], ['x1', 'x2', 'x3', 'x4', 'x5']);
  assert.deepEqual(marked(), [slides[1]!.id], 'only the slide whose own card waits');
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[1]!.id}"]`);
  const dot = tile?.querySelector<HTMLElement>('.rb-thumb-dot');
  assert.ok(dot?.querySelector('svg'), 'a glyph, so the colour is not the only sign');
  assert.equal(dot?.getAttribute('title'), 'Needs a look');
  assert.match(tile?.querySelector('.rb-thumb-pick')?.getAttribute('aria-label') ?? '', /, Needs a look,/);
  // More than half the slides: the queue says it, and no tile is marked.
  const most = base.slides.slice(0, Math.floor(base.slides.length / 2) + 1);
  redraw(most.map((slide, i) => item(`own${i}`, [slide.id], [`y${i}`])), most.map((_, i) => `y${i}`));
  assert.deepEqual(marked(), []);
  assert.equal(rb.els.strip.querySelector('.rb-thumb-dot'), null);
  unmount();
});

test('More and the pill are drawn once per included slide, off the tab order, and the current slide carries them at rest', () => {
  const { rb, unmount } = mount(stateFrom());
  const current = rb.els.strip.querySelector<HTMLElement>('.rb-thumb[data-current="true"]');
  assert.ok(current);
  assert.ok(current.querySelector('[data-more][aria-haspopup="menu"]'));
  assert.ok(current.querySelector('[data-layout-of][aria-haspopup="dialog"]'));
  for (const control of rb.els.strip.querySelectorAll<HTMLElement>('[data-more], [data-layout-of]')) {
    assert.equal(control.tabIndex, -1, 'Shift+F10 and L are the keyboard\'s way');
    assert.equal(control.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(rb.els.strip.querySelector('.help-tip-btn, .rb-strip-side'), null, 'the shortcuts left the corner');
  assert.ok(rb.els.strip.querySelector('h2.visually-hidden'), 'a hidden heading names the region');
  unmount();
});

test('M starts the keyboard move and the bar says where the slide is, with Done and Cancel', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  const count = slides.filter((slide) => slide.include).length;
  rb.strip.focus(slides[0]!.id);
  key('m', {}, document.activeElement ?? document.body);
  const bar = rb.els.strip.querySelector<HTMLElement>('[data-bar]');
  assert.equal(bar?.hidden, false);
  assert.equal(bar?.dataset.mode, 'move');
  assert.equal(bar?.querySelector('.rb-strip-count')?.textContent, `Moving slide 1. Position 1 of ${count}. Left and Right move it, Enter drops it, Escape cancels.`);
  assert.equal(rb.els.strip.querySelector(`.rb-thumb[data-slide="${slides[0]!.id}"]`)?.getAttribute('data-moving'), 'true', 'the moving slide lifts');
  key('ArrowRight', {}, document.activeElement ?? document.body);
  assert.match(bar?.querySelector('.rb-strip-count')?.textContent ?? '', new RegExp(`^Moving slide 1\\. Position 2 of ${count}\\.`));
  // Enter on the bar's own button is that button's, not a drop.
  const done = bar?.querySelector<HTMLElement>('[data-bar-act="move-done"]');
  assert.ok(done);
  const enter = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  done.dispatchEvent(enter);
  assert.equal(enter.defaultPrevented, false);
  done.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'moveSlides', args: [[slides[0]!.id], 1] });
  assert.equal(bar?.dataset.mode, undefined, 'the bar goes back to the selection');
  // Cancel writes nothing.
  rb.strip.focus(slides[1]!.id);
  key('m', {}, document.activeElement ?? document.body);
  key('ArrowRight', {}, document.activeElement ?? document.body);
  rb.els.strip.querySelector<HTMLElement>('[data-bar-act="move-cancel"]')?.click();
  assert.equal(said.at(-1), 'Move cancelled.');
  assert.equal(calls.filter((call) => call.name === 'moveSlides').length, 1);
  assert.equal(rb.drag.active(), false);
  unmount();
});

test('the question mark opens the keyboard shortcuts, which list the hold key, and the menu row opens the same sheet', () => {
  const { rb, unmount } = mount(stateFrom());
  key('?', { shiftKey: true });
  const sheet = document.querySelector<HTMLDialogElement>('dialog.rb-keys-sheet');
  assert.ok(sheet);
  assert.ok(sheet.hasAttribute('open'));
  assert.equal(sheet.getAttribute('aria-label'), 'Keyboard shortcuts');
  const keys = [...sheet.querySelectorAll('kbd')].map((el) => el.textContent);
  for (const one of ['?', 'M', 'L', '\\']) assert.ok(keys.includes(one), one);
  sheet.querySelector<HTMLElement>('.modal-primary')?.click();
  assert.equal(document.querySelector('dialog.rb-keys-sheet'), null);
  const tile = rb.els.strip.querySelector<HTMLElement>('.rb-thumb');
  assert.ok(tile);
  rightClick(tile);
  document.querySelector<HTMLElement>('.ctx-menu [data-act="shortcuts"]')?.click();
  assert.ok(document.querySelector('dialog.rb-keys-sheet[open]'));
  document.querySelector<HTMLElement>('dialog.rb-keys-sheet .modal-primary')?.click();
  unmount();
});

test('Move to position asks for a number and moves the slide there as one step', async () => {
  const { rb, calls, said, unmount } = mount(stateFrom());
  const slides = (rb.derived?.slides ?? []).filter((slide) => slide.include);
  assert.ok(slides.length >= 3);
  const tile = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb[data-slide="${slides[0]!.id}"]`);
  assert.ok(tile);
  const ask = async (typed: string): Promise<void> => {
    rightClick(tile);
    document.querySelector<HTMLElement>('.ctx-menu [data-act="position"]')?.click();
    const input = document.querySelector<HTMLInputElement>('dialog .modal-input');
    assert.ok(input, 'a one-field dialog');
    input.value = typed;
    document.querySelector<HTMLElement>('dialog [data-act="ok"]')?.click();
    await settle();
  };
  await ask('3');
  assert.deepEqual(calls.at(-1), { name: 'moveSlides', args: [[slides[0]!.id], 2] });
  await ask('٢');
  assert.deepEqual(calls.at(-1), { name: 'moveSlides', args: [[slides[0]!.id], 1] }, 'Arabic-Indic digits count too');
  const before = calls.length;
  await ask('0');
  assert.equal(calls.length, before, 'out of range writes nothing');
  // The dialog opens again with what was typed and the reason in it.
  const again = document.querySelector<HTMLInputElement>('dialog[open] .modal-input');
  assert.ok(again, 'the dialog is still asking');
  assert.equal(again.value, '0');
  assert.match(document.querySelector('dialog[open]')?.textContent ?? '', new RegExp(`Type a position from 1 to ${slides.length}\\.`));
  assert.equal(said.includes(`Type a position from 1 to ${slides.length}.`), false, 'said in the dialog, not after it closed');
  document.querySelector<HTMLElement>('dialog[open] [data-act="cancel"]')?.click();
  await settle();
  assert.equal(calls.length, before);
  unmount();
});

test('in Keep the design the strip only selects: no menu, no drag, no pill, no mark, and the keys flick', () => {
  const { rb, calls, chooser, unmount } = mount(stateFrom(RUN.plan, { mode: 'keep-design' }));
  const slides = rb.derived?.slides ?? [];
  assert.ok(slides.length >= 3);
  assert.ok(rb.els.strip.hasAttribute('data-selection-only'));
  assert.equal(rb.els.strip.querySelector('[data-more], [data-layout-of], .rb-thumb-dot'), null);
  assert.equal(rb.els.strip.querySelector('#rb-strip-help')?.textContent, 'Arrows, or K and J, go to the previous and next slide. Question mark lists the shortcuts.');
  const tile = rb.els.strip.querySelector<HTMLElement>('.rb-thumb');
  assert.ok(tile);
  rightClick(tile);
  assert.equal(document.querySelector('.ctx-menu [data-act]'), null, 'no slide menu');
  // Ctrl adds nothing: one slide at a time.
  rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${slides[2]!.id}"]`)?.dispatchEvent(new window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
  assert.deepEqual(selectedSlideIds(rb.sel, slides), [slides[2]!.id]);
  rb.strip.focus(slides[0]!.id);
  key('j', {}, document.activeElement ?? document.body);
  assert.equal(rb.sel.slideId, slides[1]!.id, 'J flicks');
  key('m', {}, document.activeElement ?? document.body);
  key('l', {}, document.activeElement ?? document.body);
  key('ArrowRight', { altKey: true }, document.activeElement ?? document.body);
  assert.equal(rb.drag.active(), false, 'no keyboard move');
  assert.equal(chooser.length, 0, 'no layout chooser');
  assert.equal(calls.some((call) => call.name === 'move' || call.name === 'moveSlides'), false);
  unmount();
});

// ─── keys that act on the review from elsewhere ──────────────────────────────

test('L from a control outside the strip opens the chooser on that control, so focus goes back to it', () => {
  const { rb, chooser, unmount } = mount(stateFrom());
  const button = document.createElement('button');
  button.textContent = 'Move earlier';
  rb.els.decide.append(button);
  button.focus();
  key('l', {}, button);
  assert.equal(chooser.length, 1);
  assert.equal(chooserAnchors.at(-1), null, 'no thumbnail stands in for the control that had focus');
  const [first] = rb.derived?.slides ?? [];
  assert.ok(first);
  rb.strip.focus(first.id);
  key('l', {}, document.activeElement ?? document.body);
  assert.equal(chooserAnchors.at(-1), document.activeElement, 'from a thumbnail it anchors on that thumbnail');
  unmount();
});

test('Alt with an arrow on a column grip resizes the column and moves no slide', () => {
  const { rb, calls, unmount } = mount(stateFrom());
  const grip = rb.els.queueGrip;
  grip.hidden = false;
  grip.setAttribute('role', 'separator');
  grip.tabIndex = 0;
  grip.focus();
  key('ArrowRight', { altKey: true }, grip);
  key('j', {}, grip);
  assert.equal(calls.some((call) => call.name === 'move' || call.name === 'moveSlides'), false);
  unmount();
});

test('with single-key shortcuts limited, letters act only on a focused thumbnail, and the sheet turns them back on', () => {
  localStorage.setItem(SINGLE_KEYS_KEY, 'off');
  const { rb, chooser, unmount } = mount(stateFrom());
  const slides = rb.derived?.slides ?? [];
  assert.ok(slides.length >= 3);
  const at = rb.sel.slideId;
  key('j');
  key('l');
  key('?');
  assert.equal(rb.sel.slideId, at, 'J does nothing from the page');
  assert.equal(chooser.length, 0, 'nor L');
  assert.equal(document.querySelector('dialog.rb-keys-sheet'), null, 'nor the question mark');
  key('ArrowRight');
  assert.equal(rb.sel.slideId, slides[1]!.id, 'the arrows still flick');
  rb.strip.focus(slides[1]!.id);
  key('j', {}, document.activeElement ?? document.body);
  assert.equal(rb.sel.slideId, slides[2]!.id, 'on a thumbnail J flicks');
  key('?', {}, document.activeElement ?? document.body);
  const sheet = document.querySelector<HTMLElement>('dialog.rb-keys-sheet[open]');
  assert.ok(sheet);
  const toggle = sheet.querySelector<HTMLInputElement>('.rb-keys-single input[role="switch"]');
  assert.ok(toggle);
  assert.equal(toggle.checked, false);
  assert.ok(document.getElementById(toggle.getAttribute('aria-describedby') ?? '')?.textContent, 'what off means, as its description');
  toggle.checked = true;
  toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(localStorage.getItem(SINGLE_KEYS_KEY), null, 'back on, the default');
  sheet.querySelector<HTMLElement>('.modal-primary')?.click();
  unmount();
  localStorage.removeItem(SINGLE_KEYS_KEY);
});

test('Undo from the chord shows its words on the footer line, said once', async () => {
  const { calls, said, unmount } = mount(stateFrom());
  const before = said.length;
  key('z', { ctrlKey: true });
  await settle();
  assert.equal(calls.at(-1)?.name, 'undo');
  assert.deepEqual(said.slice(before), ['Undone.'], 'through the footer, which speaks it');
  unmount();
});
