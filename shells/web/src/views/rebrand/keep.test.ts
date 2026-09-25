// SPDX-License-Identifier: MPL-2.0
/**
 * #/rebrand Keep the design (plan 274 mode A), the view module against a stub
 * controller.
 *
 * The decks are real: the simple fixture read through the stage 1 adapter and
 * `compileFaithful`, so the panes draw what the view will draw. The controller is a
 * stub that records calls, because what is pinned here is the view's side of the
 * contract: the mode control and its confirm, the three states in words, the stage's
 * views, the hold, the wipe and its keyboard path, the two actions, and that a render
 * with nothing new leaves the DOM alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { compileFaithful } from '@lolly/engine';
import { inflatePptx } from '@lolly-tools/node-shell/pptx';
import { sourceDeckFromPptx } from '@lolly-tools/node-shell/rebrand/source-pptx';
import type { CompiledDeckV1, RenovationProjectV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLDialogElement', 'Element', 'Node', 'KeyboardEvent', 'MouseEvent', 'Event', 'getComputedStyle', 'history', 'location']) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}
(globalThis as Record<string, unknown>).matchMedia = (query: string) =>
  ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
dom.window.HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) { this.setAttribute('open', ''); };
dom.window.HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
  this.dispatchEvent(new dom.window.Event('close'));
};
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => dom.window.requestAnimationFrame(cb)) as typeof requestAnimationFrame;
globalThis.cancelAnimationFrame = ((handle: number) => dom.window.cancelAnimationFrame(handle)) as typeof cancelAnimationFrame;

const { keepOps, keepMediaRemap, keepSummary, hasDecisions, KEEP_HOLD_ARM_MS } = await import('./keep.ts');
type RbCtx = import('./context.ts').RbCtx;
type Controller = import('../../lib/rebrand/controller-api.ts').RebrandControllerV1;
type State = import('../../lib/rebrand/controller-api.ts').RebrandStateV1;
type Download = import('../../lib/rebrand/controller-api.ts').RebrandDownloadV1;

// ─── fixtures ────────────────────────────────────────────────────────────────

const REPO = new URL('../../../../../', import.meta.url);
const SIMPLE = new Uint8Array(readFileSync(new URL('tests/fixtures/rebrand/simple.pptx', REPO)));
const parser = new dom.window.DOMParser();

const SOURCE: SourceDeckV1 = await sourceDeckFromPptx(await inflatePptx(SIMPLE), (xml) => parser.parseFromString(xml, 'application/xml'), {
  hash: 'sha256:simple',
  instanceId: 'keep-view',
  sink: async (_bytes, _mime, hash) => `user/media/${hash}`,
  reader: { name: 'pptx-read', version: 'test' },
});
const FAITHFUL: CompiledDeckV1 = compileFaithful(SOURCE);

/** The patched deck: the same frames with the page ground swapped and the refs in another scheme. */
function patchedPreview(): CompiledDeckV1 {
  const copy = structuredClone(FAITHFUL);
  for (const frame of copy.frames) {
    for (const row of frame.layers) {
      if (typeof row.fg === 'string') row.fg = '#30ba78';
      if (typeof row.image === 'string' && row.image) row.image = row.image.replace('user/media/', 'sha256:');
    }
  }
  return copy;
}

const PROJECT = { id: 'p1', name: 'simple.pptx' } as RenovationProjectV1;

function baseState(over: Partial<State> = {}): State {
  return {
    phase: 'review',
    mode: 'keep-design',
    progress: null,
    error: null,
    project: PROJECT,
    source: SOURCE,
    census: null,
    plan: null,
    faithful: FAITHFUL,
    preview: null,
    previewStale: false,
    designSystem: null,
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'working' },
    readiness: [],
    tick: 1,
    ...over,
  };
}

/** The previous harness's listeners, removed before the next one mounts. */
const lastDisposers: Array<() => void> = [];

/** The single-key shortcut preference the key hold reads. */
let singleKeys = true;

interface Harness {
  rb: RbCtx;
  calls: { setMode: string[]; downloads: number; saved: Array<{ filename: string; size: number }>; hrefs: string[]; announced: string[] };
  setState(next: State): void;
}

function harness(state: State, download: Download | null = null): Harness {
  for (const dispose of lastDisposers.splice(0)) dispose();
  document.body.innerHTML = '<div class="rb"><div class="rb-mode-slot"></div><section class="rb-compare"></section></div>';
  const calls: Harness['calls'] = { setMode: [], downloads: 0, saved: [], hrefs: [], announced: [] };
  const rb = {} as RbCtx;
  const unused = async () => ({ ok: false, touched: 0, skipped: 0 });
  const controller: Controller = {
    getState: () => rb.state,
    subscribe: () => () => {},
    start: async () => {},
    open: async () => {},
    recent: async () => [],
    remove: async () => {},
    close: () => {},
    decide: unused,
    acceptSuggestions: unused,
    include: unused,
    move: unused,
    setLayout: unused,
    setColour: unused,
    setFont: unused,
    shuffleColours: unused,
    undo: unused,
    redo: unused,
    openInDesign: async () => ({ ok: false, warnings: [] }),
    downloadProject: async () => null,
    setMode: async (mode) => {
      calls.setMode.push(mode);
    },
    keepDesignDownload: async () => {
      calls.downloads += 1;
      return download;
    },
    mediaHref: (ref) => {
      calls.hrefs.push(ref);
      return ref.startsWith('user/media/') ? `blob:${ref}` : undefined;
    },
    cancel: () => {},
    reload: async () => {},
    dispose: () => {},
  };
  const modeSlot = document.querySelector<HTMLElement>('.rb-mode-slot');
  const compare = document.querySelector<HTMLElement>('.rb-compare');
  assert.ok(modeSlot && compare);
  rb.els = { root: document.body, top: document.body, modeSlot, intake: document.body, body: document.body, queue: document.body, queueGrip: document.body, compare, decideGrip: document.body, decide: document.body, strip: document.body, report: document.body, foot: document.body, status: document.body, alert: document.body, scrim: document.body };
  rb.controller = controller;
  rb.state = state;
  rb.memo = {};
  rb.disposers = [];
  rb.sel = { slideId: null, objectId: null, itemId: null };
  rb.narrow = false;
  rb.keys = { singleKeys: () => singleKeys } as RbCtx['keys'];
  rb.announce = (message) => {
    calls.announced.push(message);
  };
  rb.host = {
    export: {
      download: async (blob: Blob, filename: string) => {
        calls.saved.push({ filename, size: blob.size });
      },
    },
  } as RbCtx['host'];
  rb.keep = keepOps(rb);
  rb.keep.wire();
  lastDisposers.push(...rb.disposers);
  rb.keep.render();
  return {
    rb,
    calls,
    setState(next) {
      rb.state = next;
      rb.keep.render();
    },
  };
}

const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// ─── the mode control ────────────────────────────────────────────────────────

test('the mode control is the panel segment the intake draws, titled for what it does, with no help tip', () => {
  const { rb, calls, setState } = harness(baseState({ project: null, source: null, mode: 'renovate' }));
  assert.equal(rb.els.modeSlot.innerHTML, '', 'no project, no control');

  setState(baseState({ mode: 'renovate' }));
  const seg = rb.els.modeSlot.querySelector<HTMLElement>('.lp-seg.rb-mode-seg');
  assert.ok(seg, 'the panel primitive segment (decision 15)');
  assert.equal(rb.els.modeSlot.querySelector('.view-seg, .view-seg-btn'), null, 'not the app segment');
  assert.equal(seg.getAttribute('title'), 'Switch mode');
  assert.equal(seg.getAttribute('aria-label'), 'Mode');
  assert.equal(rb.els.modeSlot.querySelector('.help-tip-btn'), null, 'the explanation lives in the intake line and the project menu');
  const buttons = [...seg.querySelectorAll<HTMLButtonElement>('button')];
  assert.deepEqual(buttons.map((b) => [text(b), b.getAttribute('aria-pressed')]), [['Renovate the layout', 'true'], ['Keep the design', 'false']]);

  buttons[0]?.click();
  assert.deepEqual(calls.setMode, [], 'the pressed mode does nothing');
  buttons[1]?.click();
  assert.deepEqual(calls.setMode, ['keep-design'], 'with no decisions it switches at once');

  setState(baseState({ mode: 'keep-design' }));
  const pressed = rb.els.modeSlot.querySelector('.rb-mode-seg > button[aria-pressed="true"]');
  assert.equal(text(pressed), 'Keep the design');
});

test('switching into Keep the design asks first when the project holds decisions', async () => {
  const { rb, calls } = harness(baseState({ mode: 'renovate', history: { canUndo: true, canRedo: false } }));
  assert.equal(hasDecisions(rb), true);
  rb.els.modeSlot.querySelector<HTMLButtonElement>('[data-mode="keep-design"]')?.click();
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
  assert.ok(dialog, 'a confirm');
  assert.match(text(dialog), /Switching to Keep the design recompiles the deck\. Your decisions stay with this project\./);
  assert.equal(dialog.querySelector('.modal-danger'), null, 'switching is not destructive');
  assert.deepEqual(calls.setMode, [], 'nothing switches before the answer');
  rb.els.modeSlot.querySelector<HTMLButtonElement>('[data-mode="keep-design"]')?.click();
  assert.equal(document.querySelectorAll('dialog[open]').length, 1, 'a second press does not stack a second confirm');
  dialog.querySelector<HTMLButtonElement>('[data-act="ok"]')?.click();
  await flush();
  assert.deepEqual(calls.setMode, ['keep-design']);

  // Back to Renovate never asks: nothing is compiled away.
  rb.state = baseState({ mode: 'keep-design', history: { canUndo: true, canRedo: false } });
  rb.keep.chooseMode('renovate');
  assert.deepEqual(calls.setMode, ['keep-design', 'renovate']);
  assert.equal(document.querySelector('dialog[open]'), null);
});

test('a cancelled confirm leaves the mode as it was', async () => {
  const { rb, calls } = harness(baseState({ mode: 'renovate', history: { canUndo: true, canRedo: false } }));
  rb.keep.chooseMode('keep-design');
  document.querySelector<HTMLButtonElement>('dialog[open] [data-act="cancel"]')?.click();
  await flush();
  assert.deepEqual(calls.setMode, []);
  assert.equal(rb.els.modeSlot.querySelector('[data-mode="renovate"]')?.getAttribute('aria-pressed'), 'true');
});

// ─── the shared comparison region ────────────────────────────────────────────

test('the work area draws inside the comparison region, beside what is there, and shows only in Keep the design', () => {
  const { rb, setState } = harness(baseState({ keep: { status: 'working' } }));
  const area = rb.keep.region();
  assert.equal(area.parentElement, rb.els.compare, 'a child of the comparison region, not a region of its own');
  assert.equal(area.getAttribute('aria-label'), 'Keep the design');
  assert.equal(area.hidden, false);
  assert.equal(rb.keep.region(), area, 'made once');

  // The comparison's own markup in the same region is left alone, and a click there is not Keep's.
  const other = document.createElement('button');
  other.dataset.keepView = 'wipe';
  rb.els.compare.prepend(other);
  other.click();
  assert.equal(area.querySelector('.rb-keep-cmp')?.getAttribute('data-show'), 'original', 'a click outside the work area changes nothing');
  assert.equal(other.isConnected, true);

  setState(baseState({ mode: 'renovate', keep: { status: 'working' } }));
  assert.equal(area.hidden, true, 'hidden while renovating');
  assert.equal(other.isConnected, true);
  setState(baseState({ keep: { status: 'working' } }));
  assert.equal(area.hidden, false);
});

// ─── the three states ────────────────────────────────────────────────────────

test('working: the Original alone with its name in the caption row, and a sentence saying what is happening', () => {
  const { rb } = harness(baseState({ keep: { status: 'working' } }));
  const area = rb.keep.region();
  assert.equal(text(area.querySelector('.rb-keep-status')), 'Swapping theme, colours and fonts.');
  assert.ok(area.querySelector('.rb-keep-pane[data-pane="before"] svg'), 'the original is drawn');
  assert.equal(text(area.querySelector('.rb-keep-cap strong')), 'Original');
  assert.equal(area.querySelector('.rb-keep-pane[data-pane="after"]'), null, 'no result yet');
  assert.equal(area.querySelector('.rb-keep-seg'), null, 'nothing to compare yet');
  assert.equal(area.querySelector('[data-keep-act="download"]'), null, 'nothing to download yet');
  assert.ok(area.querySelector('[data-keep-act="cancel"]'), 'the way out stays on screen');
});

test('failed: the failure in words, the reason beside it, no download', () => {
  const { rb, calls } = harness(baseState({ keep: { status: 'failed', error: 'keep.no-patcher' } }));
  const area = rb.keep.region();
  const status = area.querySelector('.rb-keep-status');
  assert.equal(text(status), 'The design system could not be swapped into this deck.');
  assert.equal(status?.getAttribute('data-status'), 'failed');
  assert.equal(text(area.querySelector('.rb-keep-detail')), 'This version of Lolly cannot change a PowerPoint file.', 'the code is shown in the view words');
  assert.equal(area.querySelector('[data-keep-act="download"]'), null);
  assert.deepEqual(calls.announced, ['The design system could not be swapped into this deck.']);
});

test('ready: the Result as the hero, the Original as the inset, names in the caption row, and the two actions', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3])]);
  const changes = { themeSlots: 6, colours: 0, fonts: [{ from: 'Calibri', to: 'SUSE' }, { from: 'Arial', to: 'SUSE' }] };
  const { rb, calls } = harness(baseState({ keep: { status: 'ready', preview: patchedPreview(), changes } }), { blob, filename: 'simple-rebranded.pptx' });
  const area = rb.keep.region();
  assert.equal(text(area.querySelector('.rb-keep-status')), 'Changed 6 theme colours and 2 fonts.');
  assert.deepEqual(calls.announced, ['Changed 6 theme colours and 2 fonts.'], 'the settled result is said once');

  const cmp = area.querySelector<HTMLElement>('.rb-keep-cmp');
  assert.equal(cmp?.dataset.show, 'result', 'the Result is the hero by default');
  const seg = area.querySelector<HTMLElement>('.lp-seg.rb-keep-seg');
  assert.ok(seg, 'the stage segment is the panel segment');
  assert.deepEqual([...seg.querySelectorAll('button')].map((b) => [text(b), b.getAttribute('aria-pressed')]), [
    ['Original', 'false'], ['Result', 'true'], ['Both', 'false'], ['Wipe', 'false'],
  ]);
  // The inset is the Original, with its name and the slide in its caption.
  assert.deepEqual([...(area.querySelector('.rb-keep-inset-cap')?.children ?? [])].map((el) => text(el)), ['Original', `Slide 1 of ${FAITHFUL.frames.length}`]);
  assert.equal(area.querySelector('.rb-keep-inset-art')?.getAttribute('aria-label'), 'Show the Original');
  // The names are in the caption row, never pills over the slide (copy table K2).
  assert.equal(text(area.querySelector('.rb-keep-cap strong')), 'Result');
  assert.equal(area.querySelector('.rb-keep-hero .rb-keep-tag, .rb-keep-hero strong'), null);
  const hint = area.querySelector<HTMLElement>('.rb-keep-hint');
  assert.equal(text(hint), 'Hold the slide to see the Original');
  assert.equal(hint?.title, 'Hold the \\ key to see the Original.', 'the key is named in the tooltip');

  const before = area.querySelector('.rb-keep-art--before svg');
  const after = area.querySelector('.rb-keep-art--after svg');
  assert.ok(before && after, 'the Original waits under the Result for a hold');
  assert.equal(after.getAttribute('viewBox'), before.getAttribute('viewBox'), 'same geometry');
  // The result's pictures resolve through the original's refs, matched by layer id.
  const afterHrefs = [...after.querySelectorAll('image')].map((img) => img.getAttribute('href'));
  const beforeHrefs = [...before.querySelectorAll('image')].map((img) => img.getAttribute('href'));
  assert.deepEqual(afterHrefs, beforeHrefs);

  const download = area.querySelector<HTMLButtonElement>('[data-keep-act="download"]');
  assert.equal(text(download), 'Download .pptx');
  assert.ok(download?.classList.contains('btn--primary'), 'Download is the primary');
  const design = area.querySelector<HTMLButtonElement>('[data-keep-act="design"]');
  assert.equal(text(design), 'Open the result in Design');
  assert.ok(design?.classList.contains('btn--ghost'));
  assert.equal(area.querySelector('a[href="#/tool/design"]'), null, 'the old sentence with a link is gone (copy table K1)');
  download?.click();
  assert.equal(calls.downloads, 1);
  await flush();
  await flush();
  assert.deepEqual(calls.saved, [{ filename: 'simple-rebranded.pptx', size: 3 }]);
  assert.equal(area.querySelector<HTMLButtonElement>('[data-keep-act="download"]')?.disabled, false, 'ready again once the file went out');
});

test('a download the controller cannot make says so beside the button', async () => {
  const { rb, calls } = harness(baseState({ keep: { status: 'ready', preview: patchedPreview(), changes: { themeSlots: 1, colours: 1, fonts: [] } } }), null);
  rb.keep.region().querySelector<HTMLButtonElement>('[data-keep-act="download"]')?.click();
  await flush();
  await flush();
  assert.equal(calls.saved.length, 0);
  assert.equal(text(rb.keep.region().querySelector('[role="alert"]')), 'The download did not start.');
});

// ─── the stage ───────────────────────────────────────────────────────────────

test('the stage shows the slide the filmstrip selected', () => {
  const state = baseState({ keep: { status: 'ready', preview: patchedPreview(), changes: { themeSlots: 1, colours: 0, fonts: [] } } });
  const { rb, setState } = harness(state);
  const second = FAITHFUL.frames[1];
  assert.ok(second);
  rb.sel = { slideId: second.sourceSlideId, objectId: null, itemId: null };
  setState({ ...state, tick: state.tick + 1 });
  const area = rb.keep.region();
  assert.equal(text(area.querySelector('.rb-keep-inset-cap span')), `Slide 2 of ${FAITHFUL.frames.length}`);
  assert.equal(area.querySelector('.rb-keep-hero')?.getAttribute('aria-label'), `Result: Slide 2 of ${FAITHFUL.frames.length}`);
});

test('Original, Both and Wipe from the segment; the inset swaps the hero; the wipe keeps its place', () => {
  const { rb } = harness(baseState({ keep: { status: 'ready', preview: patchedPreview(), changes: { themeSlots: 1, colours: 0, fonts: [] } } }));
  const area = rb.keep.region();
  const show = (): string | undefined => area.querySelector<HTMLElement>('.rb-keep-cmp')?.dataset.show;

  area.querySelector<HTMLElement>('.rb-keep-inset-art')?.click();
  assert.equal(show(), 'original', 'the inset puts its side on the hero');
  assert.equal(text(area.querySelector('.rb-keep-inset-cap strong')), 'Result', 'and the inset shows the other');

  area.querySelector<HTMLElement>('.rb-keep-seg [data-keep-view="both"]')?.click();
  assert.equal(show(), 'both');
  assert.equal(area.querySelector('.rb-keep-inset'), null, 'both slides show, so no inset');
  assert.deepEqual([...area.querySelectorAll('.rb-keep-cap strong')].map((el) => text(el)), ['Original', 'Result']);

  area.querySelector<HTMLElement>('[data-keep-view="wipe"]')?.click();
  assert.equal(show(), 'wipe');
  const slider = area.querySelector<HTMLElement>('[role="slider"]');
  const pane = area.querySelector<HTMLElement>('.rb-keep-art--after');
  const divider = area.querySelector<HTMLElement>('.rb-keep-divider');
  assert.ok(slider && pane && divider);
  assert.ok(slider.closest('.rb-keep-cap'), 'the slider sits in the caption row under the hero');
  assert.equal(slider.getAttribute('aria-label'), 'Wipe between the original and the result');
  slider.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(pane.style.clipPath, 'inset(0 0 0 51%)');
  assert.equal(divider.style.left, '51%');
  slider.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  assert.equal(divider.hidden, true, 'at an end the divider would be a stripe down one edge');
  assert.equal(area.querySelector('.rb-keep-art--after'), pane, 'the same element, not a redraw');
  rb.keep.setWipe(80);

  area.querySelector<HTMLElement>('[data-keep-view="result"]')?.click();
  assert.equal(area.querySelector('[role="slider"]'), null);
  assert.equal(area.querySelector<HTMLElement>('.rb-keep-art--after')?.style.clipPath ?? '', '', 'the Result hero is never clipped');
  area.querySelector<HTMLElement>('[data-keep-view="wipe"]')?.click();
  assert.equal(area.querySelector<HTMLElement>('.rb-keep-art--after')?.style.clipPath, 'inset(0 0 0 80%)', 'the wipe comes back where it was left');
});

test('holding the slide, or the backslash key, shows the Original on the hero without a redraw', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { rb } = harness(baseState({ keep: { status: 'ready', preview: patchedPreview(), changes: { themeSlots: 1, colours: 0, fonts: [] } } }));
  const area = rb.keep.region();
  const cmp = area.querySelector<HTMLElement>('.rb-keep-cmp');
  const hero = area.querySelector<HTMLElement>('.rb-keep-hero[data-hold]');
  assert.ok(cmp && hero);
  const pointer = (type: string, x = 100, y = 100): Event => {
    const e = new dom.window.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperty(e, 'pointerType', { value: 'mouse' });
    return e;
  };
  hero.dispatchEvent(pointer('pointerdown'));
  t.mock.timers.tick(KEEP_HOLD_ARM_MS - 1);
  assert.equal(cmp.dataset.held, 'false', 'a short press is not a hold');
  t.mock.timers.tick(1);
  assert.equal(cmp.dataset.held, 'true');
  assert.equal(text(cmp.querySelector('.rb-keep-cap strong')), 'Original', 'the caption names what shows');
  assert.equal(cmp.querySelector('.rb-keep-hint'), null, 'the hint goes once the hold is learnt');
  window.dispatchEvent(pointer('pointerup'));
  assert.equal(cmp.dataset.held, 'false');
  assert.equal(area.querySelector('.rb-keep-cmp'), cmp, 'the same element, not a redraw');

  // A drag is not a hold.
  hero.dispatchEvent(pointer('pointerdown'));
  window.dispatchEvent(pointer('pointermove', 120, 100));
  t.mock.timers.tick(KEEP_HOLD_ARM_MS);
  assert.equal(cmp.dataset.held, 'false');
  window.dispatchEvent(pointer('pointerup'));

  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '\\', bubbles: true }));
  assert.equal(cmp.dataset.held, 'true', 'the backslash key holds');
  document.dispatchEvent(new dom.window.KeyboardEvent('keyup', { key: '\\', bubbles: true }));
  assert.equal(cmp.dataset.held, 'false');
  // With single-key shortcuts limited, the key acts only from the stage or the strip.
  singleKeys = false;
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '\\', bubbles: true }));
  assert.equal(cmp.dataset.held, 'false');
  hero.tabIndex = -1;
  hero.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '\\', bubbles: true }));
  assert.equal(cmp.dataset.held, 'true');
  window.dispatchEvent(new dom.window.Event('blur'));
  assert.equal(cmp.dataset.held, 'false', 'a lost key-up lets go with the window');
  singleKeys = true;
});

test('a render with nothing new leaves the DOM alone', () => {
  const state = baseState({ keep: { status: 'ready', preview: patchedPreview(), changes: { themeSlots: 1, colours: 0, fonts: [] } } });
  const { rb, setState } = harness(state);
  const cmp = rb.keep.region().querySelector('.rb-keep-cmp');
  const mode = rb.els.modeSlot.firstElementChild;
  setState({ ...state, tick: state.tick + 1 });
  assert.equal(rb.keep.region().querySelector('.rb-keep-cmp'), cmp);
  assert.equal(rb.els.modeSlot.firstElementChild, mode);
});

test('the stylesheet sizes the mode control to the bar and keeps the pressed look the primitive gives', () => {
  const keepCss = readFileSync(new URL('../../styles/parts/rebrand-keep.css', import.meta.url), 'utf8');
  const topCss = readFileSync(new URL('../../styles/parts/rebrand-top.css', import.meta.url), 'utf8');
  assert.doesNotMatch(keepCss, /view-seg/, 'no app segment in the Keep sheet');
  assert.doesNotMatch(keepCss, /\[aria-pressed="true"\]/, 'the pressed half is the primitive raised step');
  assert.match(topCss, /\.rb-top \.rb-mode-seg \{[^}]*height: var\(--rb-top-control\);/);
});

// ─── the pure helpers ────────────────────────────────────────────────────────

test('the summary is one sentence with the numbers in it', () => {
  assert.equal(keepSummary({ themeSlots: 6, colours: 0, fonts: [{ from: 'a', to: 'b' }, { from: 'c', to: 'b' }] }), 'Changed 6 theme colours and 2 fonts.');
  assert.equal(keepSummary({ themeSlots: 1, colours: 3, fonts: [{ from: 'a', to: 'b' }] }), 'Changed 1 theme colour, 3 slide colours and 1 font.');
  assert.equal(keepSummary({ themeSlots: 0, colours: 1, fonts: [] }), 'Changed 1 slide colour.');
  assert.equal(keepSummary({ themeSlots: 0, colours: 0, fonts: [] }), 'Nothing in this deck needed changing.');
});

test('the media remap pairs refs by layer id', () => {
  const [before] = FAITHFUL.frames;
  const [after] = patchedPreview().frames;
  assert.ok(before && after);
  const remap = keepMediaRemap(before, after);
  assert.ok(remap.size > 0, 'the first slide holds a picture');
  for (const [from, to] of remap) {
    assert.match(from, /^sha256:/);
    assert.equal(to, from.replace('sha256:', 'user/media/'));
  }
});
