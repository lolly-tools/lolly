// SPDX-License-Identifier: MPL-2.0
/**
 * The decision column's Slide section and the layout chooser (plan 275 section 4, WP4,
 * decisions 28, 30 and 31), against the real modules.
 *
 * The state comes from the real pipeline over tests/fixtures/rebrand/structures.pptx
 * (three columns, four cards, a grid, a stats row, a picture row), run the way
 * tests/helpers/rebrand-pipeline.ts runs it. The host answers the starter design system
 * (its slide master and its colour tokens), so the chooser resolves the design system
 * the controller compiles with and its previews are real one-slide compiles. The
 * controller is a stub that records each command, so what these tests pin is which
 * command a control sends and what the pane and the grid show, never what the
 * controller does with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { REVIEW_NOUNS, compileFaithful } from '@lolly/engine';
import { ARCHETYPE_IDS } from '@lolly-tools/core';
import type { RenovationPlanV1, SlidePlanV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';
import {
  STARTER_DESIGN_SYSTEM,
  STARTER_MASTER,
  runRebrandPipeline,
  type RebrandRunV1,
} from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type { RebrandControllerV1, RebrandDecideInputV1, RebrandEditOutcomeV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import type { RbCtx } from './context.ts';
import { rebrandCss, reviewHarness, type ReviewMounted } from './shared.test-utils.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'HTMLDivElement',
  'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'DOMParser', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'navigator',
]) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}

const { deriveReview } = await import('./shared.ts');
const { queueOps } = await import('./queue.ts');
const { reviewItems, toReviewCount } = await import('./foot.ts');
const { compareOps } = await import('./compare.ts');
const { decideOps, fidelityFlag, plainShapeName, readingConfidence } = await import('./decide.ts');
const { stripOps } = await import('./strip.ts');
const { keysOps } = await import('./keys.ts');
const { chooserOps, likelySet, likelyText, matchLabel, matchedText } = await import('./layout-chooser.ts');
const { dragOps } = await import('./strip-drag.ts');
const { themeOps } = await import('./theme.ts');
const { layoutThumb, layoutThumbDraws, layoutTiles, searchLayoutTiles, structureIdOf, svgNode } = await import('../../lib/slide-structures-ui.ts');
const { archetypeThumbSvg } = await import('../free-canvas/archetype-thumb.ts');

const FIXTURE = new URL('../../../../../tests/fixtures/rebrand/structures.pptx', import.meta.url);
const MASTERS = new URL('../../../../../brands/lolly-start/catalog/assets/lolly/slides/masters.json', import.meta.url);

const RUN: RebrandRunV1 = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(FIXTURE)));
const MASTER_BYTES = new Uint8Array(readFileSync(MASTERS));
const LISTED = layoutTiles(STARTER_MASTER);

/**
 * A host that answers the starter design system: its slide master and its colour tokens.
 * Only the two reads the design system resolver makes are there, set by name, the way
 * the resolver feature-detects them.
 */
function starterHost(): RbCtx['host'] {
  const colors = Object.entries(STARTER_DESIGN_SYSTEM.input.colors).map(([path, value]) => ({ path, value }));
  const host = {} as RbCtx['host'];
  Reflect.set(host, 'assets', {
    query: async () => [{ id: 'lolly/slides/masters', url: '/masters.json' }],
    get: async () => ({ id: 'lolly/slides/masters', url: '/masters.json' }),
    bytes: async () => MASTER_BYTES,
  });
  Reflect.set(host, 'tokens', { get: async () => ({ query: () => colors, get: () => undefined }) });
  return host;
}

function stateFrom(plan: RenovationPlanV1 = RUN.plan, source: SourceDeckV1 = RUN.deck): RebrandStateV1 {
  return {
    phase: 'review',
    mode: 'renovate',
    progress: null,
    error: null,
    project: null,
    source,
    census: RUN.census,
    plan,
    faithful: compileFaithful(source),
    preview: { deck: RUN.compiled, planRevision: plan.revision },
    previewStale: false,
    designSystem: {
      id: 'lolly/start',
      name: 'Lolly start',
      neutralMaster: false,
      hasLogo: true,
      archetypes: STARTER_MASTER.archetypes.map((a) => a.id),
      colors: { ...STARTER_DESIGN_SYSTEM.input.colors },
      fonts: ['SUSE'],
    },
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 1,
  };
}

interface Call { name: string; args: unknown[] }

const OK: RebrandEditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };
const NOT_BUILT: RebrandEditOutcomeV1 = { ok: false, touched: 0, skipped: 0, refusal: 'not-built' };

function stubController(state: RebrandStateV1, calls: Call[], opts: { autoMatch?: boolean; text?: 'ok' | 'not-built' | 'absent' }): RebrandControllerV1 {
  const record = (name: string, answer: RebrandEditOutcomeV1 = OK) => async (...args: unknown[]): Promise<RebrandEditOutcomeV1> => {
    calls.push({ name, args });
    return answer;
  };
  const controller: RebrandControllerV1 = {
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
    setColour: record('setColour'),
    setFont: record('setFont'),
    shuffleColours: record('shuffleColours'),
    undo: record('undo'),
    redo: record('redo'),
    openInDesign: async () => ({ ok: false, reason: 'no-plan', warnings: [] }),
    downloadProject: async () => null,
    setMode: async () => {},
    keepDesignDownload: async () => null,
    mediaHref: () => undefined,
    cancel: () => {},
    reload: async () => {},
    dispose: () => {},
  };
  if (opts.autoMatch !== false) controller.autoMatchLayouts = record('autoMatchLayouts', NOT_BUILT);
  if (opts.text !== 'absent') controller.setObjectText = record('setObjectText', opts.text === 'not-built' ? NOT_BUILT : OK);
  return controller;
}

interface Mounted {
  rb: RbCtx;
  calls: Call[];
  said: string[];
  unmount: () => void;
}

/** The regions, the context and the modules, the way views/rebrand.ts wires them. */
function mount(state: RebrandStateV1, opts: { autoMatch?: boolean; text?: 'ok' | 'not-built' | 'absent' } = {}): Mounted {
  document.body.innerHTML = `<div id="view"><div class="rb">
    <header class="rb-top"><div class="rb-mode-slot"></div></header>
    <section class="rb-intake"></section>
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
  const rb = {} as RbCtx;
  rb.viewEl = q('#view');
  rb.host = starterHost();
  rb.params = new URLSearchParams();
  rb.els = {
    root: q('.rb'), top: q('.rb-top'), modeSlot: q('.rb-mode-slot'), intake: q('.rb-intake'), body: q('.rb-body'),
    queue: q('.rb-queue'), queueGrip: q('.rb-grip[data-grip="queue"]'), compare: q('.rb-compare'),
    decideGrip: q('.rb-grip[data-grip="decide"]'), decide: q('.rb-decide'), strip: q('.rb-strip'),
    report: q('.rb-report'), foot: q('.rb-foot'), status: q('.rb-status'),
    alert: q('.rb'), scrim: q('.rb'),
  };
  rb.controller = stubController(state, calls, opts);
  rb.state = state;
  rb.derived = null;
  rb.sel = { slideId: state.plan?.slides[0]?.id ?? null, objectId: null, itemId: null };
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
    rb.queue.render();
    rb.compare.render();
    rb.decide.render();
    rb.strip.render();
  };
  rb.select = (next) => {
    rb.sel = { ...rb.sel, ...next };
    rb.render();
  };
  rb.announce = (message) => { said.push(message); };
  rb.intake = { wire() {}, render() {} } as RbCtx['intake'];
  rb.top = {
    wire() {},
    render() {},
    download: async () => {},
    close() {},
    menuOpen: () => false,
    stepDone: () => '',
  } as RbCtx['top'];
  rb.foot = {
    wire() {},
    render() {},
    toReviewCount: () => toReviewCount(rb),
    reviewItems: () => reviewItems(rb),
    say: (message: string) => { said.push(message); },
  } as RbCtx['foot'];
  rb.keep = { wire() {}, render() {} } as RbCtx['keep'];
  rb.report = { wire() {}, render() {}, open() {}, close() {} } as RbCtx['report'];
  rb.queue = queueOps(rb);
  rb.compare = compareOps(rb);
  rb.decide = decideOps(rb);
  rb.strip = stripOps(rb);
  rb.keys = keysOps(rb);
  rb.chooser = chooserOps(rb);
  rb.drag = dragOps(rb);
  rb.theme = themeOps(rb);
  rb.compare.wire();
  rb.decide.wire();
  rb.keys.wire();
  rb.render();
  return {
    rb,
    calls,
    said,
    unmount: () => {
      rb.chooser.close(false);
      for (const dispose of rb.disposers.splice(0)) dispose();
    },
  };
}

const wait = (ms = 0): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Mount and wait until the design system is resolved, so the chooser has its master. */
async function ready(state: RebrandStateV1 = stateFrom(), opts: Parameters<typeof mount>[1] = {}): Promise<Mounted> {
  const mounted = mount(state, opts);
  for (let i = 0; i < 100 && !mounted.rb.chooser.master(); i += 1) await wait(5);
  assert.ok(mounted.rb.chooser.master(), 'the design system resolves');
  return mounted;
}

function decideEl(rb: RbCtx, selector: string): HTMLElement | null {
  return rb.els.decide.querySelector<HTMLElement>(selector);
}

/** The layout chooser: a popover docked over the column since the close-out (plan 275 section 3.6). */
function grid(): HTMLElement {
  const pop = document.querySelector<HTMLElement>('.rb-lc-pop');
  assert.ok(pop, 'the chooser popover is open');
  return pop;
}

/** Change layout, pressed from the keyboard's place: focus first, so Escape has somewhere to return. */
function unfold(rb: RbCtx): void {
  const change = decideEl(rb, '[data-key="layout-change"]');
  assert.ok(change, 'the Change layout button');
  change.focus();
  change.click();
  grid();
}

function tiles(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.arch-tile')];
}

function search(_rb: RbCtx, text: string): string[] {
  const input = grid().querySelector<HTMLInputElement>('.arch-search input, input.arch-search');
  assert.ok(input, 'the search field');
  input.value = text;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  return tiles(grid().querySelector('.arch-groups') ?? grid()).map((tile) => tile.dataset.layout ?? '');
}

/** The sections and band heads the column shows unfolded. */
function openParts(rb: RbCtx): string[] {
  return [...rb.els.decide.querySelectorAll<HTMLElement>('[aria-expanded="true"]:is(.lp-sec-head, .lp-band-head)')]
    .map((head) => head.closest<HTMLElement>('[data-sec]')?.dataset.sec ?? '');
}

/** Help lines a person can see: none inside a folded section. */
function visibleHelp(rb: RbCtx): HTMLElement[] {
  return [...rb.els.decide.querySelectorAll<HTMLElement>('.lp-help')].filter((el) => !el.closest('[hidden]'));
}

function withSlides(edit: (slide: SlidePlanV1, index: number) => SlidePlanV1): RenovationPlanV1 {
  return { ...RUN.plan, slides: RUN.plan.slides.map(edit) };
}

/** A slide as the first pass would leave it with no structure read: no match and no reasons. */
function unread(slide: SlidePlanV1): SlidePlanV1 {
  const { layoutMatch: _match, layoutReasons: _reasons, ...rest } = slide;
  return { ...rest, layout: 'content' };
}

// ─── the Slide section ───────────────────────────────────────────────────────

test('the Layout band is one head with who set the layout, open at rest on its picture, its name and Change layout', async () => {
  const { rb, unmount } = await ready();
  assert.equal(decideEl(rb, 'select[data-act="archetype"]'), null, 'no native select of layouts');
  const slide = RUN.plan.slides[0];
  assert.ok(slide);
  assert.equal(decideEl(rb, '.lp-head-name')?.textContent, `Slide 1 of ${RUN.plan.slides.length}`);
  assert.equal(decideEl(rb, '.lp-head-name')?.tagName, 'H2', 'the head is a heading, and it names the column');
  assert.equal(rb.els.decide.getAttribute('aria-labelledby'), 'rb-decide-name');
  // The band holds one section of its own name, so the rule is its head: no LAYOUT over Layout.
  const band = decideEl(rb, '.lp-band[data-band="layout"]');
  assert.ok(band);
  const head = band.querySelector<HTMLElement>(':scope > .lp-band-head');
  assert.ok(head, 'the band rule is the head');
  assert.equal(band.querySelector('.lp-sec-head, .lp-band-label'), null, 'no section head and no label under it');
  assert.equal(head.getAttribute('aria-expanded'), 'true');
  assert.match(head.querySelector('.lp-sec-flag')?.textContent ?? '', /^(Suggested|By the rule|Yours|Set by Auto-match|Set by the preset)$/);
  const name = decideEl(rb, '.rb-layout-name')?.textContent ?? '';
  assert.equal(name, LISTED.find((tile) => tile.id === slide.layout || tile.flip === slide.layout)?.name ?? name);
  assert.ok(decideEl(rb, '.rb-layout-art svg'), 'the current layout is drawn');
  const change = decideEl(rb, '[data-key="layout-change"]');
  assert.equal(change?.textContent, 'Change layout');
  assert.equal(change?.getAttribute('aria-haspopup'), 'dialog');
  assert.ok(change?.querySelector('svg'), 'a door carries the arrow');
  assert.equal(change?.getAttribute('aria-expanded'), 'false');
  assert.equal(document.querySelector('.rb-lc-pop'), null, 'the chooser opens only when asked');
  // One section open, and no help line saying a state that is fine.
  assert.deepEqual(openParts(rb), ['layout']);
  assert.deepEqual(visibleHelp(rb).map((el) => el.textContent), []);
  assert.equal(decideEl(rb, '[data-key="layout-auto"]'), null, 'Auto-match lives in the queue and the chooser, not on every slide');
  // The Position row: the moves and the switch.
  assert.ok(decideEl(rb, '[data-act="move"][data-delta="1"]'));
  const include = decideEl(rb, 'input[data-act="include"]') as HTMLInputElement | null;
  assert.equal(include?.getAttribute('role'), 'switch');
  assert.equal(include?.closest('label')?.textContent, 'In the deck');
  unmount();
});

test('the bands follow the vocabulary: Content, Style, then Layout, with every section but Layout folded', async () => {
  const { rb, unmount } = await ready();
  const bands = [...rb.els.decide.querySelectorAll<HTMLElement>('.lp-band')].map((band) => band.dataset.band);
  assert.deepEqual(bands, ['content', 'style', 'layout']);
  assert.deepEqual([...rb.els.decide.querySelectorAll<HTMLElement>('.lp-band-label')].map((el) => el.textContent), ['Content', 'Style']);
  const order = [...rb.els.decide.querySelectorAll<HTMLElement>('.lp-band > .lp-sec')].map((sec) => sec.dataset.sec);
  assert.deepEqual(order, ['objects', 'colours', 'fonts']);
  const objects = decideEl(rb, '[data-sec="objects"] .lp-sec-head');
  assert.equal(objects?.getAttribute('aria-expanded'), 'false');
  assert.match(objects?.querySelector('.lp-sec-flag')?.textContent ?? '', /^\d+$/, 'the count as a number');
  assert.ok(decideEl(rb, '.lp-band[data-band="style"] [data-style-mount]'), 'the deck theme draws Background in the Style band');
  unmount();
});

test('Change layout opens the categorised chooser over the column: Current first, then the bands, and no tile that does nothing', async () => {
  const { rb, unmount } = await ready();
  unfold(rb);
  const chooser = grid().querySelector<HTMLElement>('.arch-chooser');
  assert.ok(chooser, 'the chooser opened');
  assert.equal(decideEl(rb, '[data-key="layout-change"]')?.getAttribute('aria-expanded'), 'true');
  const bands = [...chooser.querySelectorAll<HTMLElement>('.arch-band-name')].map((h) => h.textContent);
  assert.deepEqual(bands.slice(1), ['Titles', 'Text', 'Boxes', 'Pictures', 'Data', 'Steps and lists'], 'six display bands at slice size');
  const all = tiles(chooser);
  // The ways back (Original arrangement, Keep as it was) show only with a controller that carries them out.
  assert.equal(chooser.querySelector('.arch-tile[data-leading]'), null, 'no unavailable tiles lead the grid');
  const current = all.filter((tile) => tile.getAttribute('aria-current') === 'true');
  assert.equal(current.length, 1, 'one current tile');
  assert.equal(current[0], all[0], 'Current comes first');
  // Every layout the master lists is on the grid once: the mirror rides on its partner.
  const shown = all.map((tile) => tile.dataset.layout).filter(Boolean);
  assert.equal(new Set(shown).size, shown.length, 'no layout twice');
  assert.equal(shown.length, LISTED.length);
  assert.equal(all[0]?.tabIndex, 0, 'the current tile is the one Tab stop');
  rb.chooser.close(false);
  unmount();
});

test('text and pictures share one box: a pictures layout arranged like a box layout is that box tile', async () => {
  // Any box takes any content (decision 30), so "Three pictures" is "Three boxes".
  for (const [pictures, boxes] of [['images-2', 'columns-2'], ['images-3', 'columns-3'], ['image-grid-2x2', 'grid-2x2'], ['visual', 'content']] as const) {
    assert.equal(LISTED.some((tile) => tile.id === pictures), false, `${pictures} has no tile of its own`);
    assert.ok(LISTED.find((tile) => tile.id === boxes)?.also?.includes(pictures), `${pictures} rides on ${boxes}`);
  }
  // A slide on the pictures layout is marked on the box tile, under its name.
  const plan = withSlides((slide, i) => (i === 0 ? { ...slide, layout: 'images-3' } : slide));
  const { rb, unmount } = await ready(stateFrom(plan));
  assert.equal(decideEl(rb, '.rb-layout-name')?.textContent, 'Three boxes');
  unfold(rb);
  const current = tiles(grid()).find((tile) => tile.getAttribute('aria-current') === 'true');
  assert.equal(current?.dataset.layout, 'columns-3');
  // What the Pictures band keeps: only arrangements no box layout draws.
  const band = grid().querySelector<HTMLElement>('[data-band="band-pictures"]');
  assert.ok(band);
  const kept = tiles(band).map((tile) => tile.dataset.layout);
  for (const id of kept) assert.ok(!['images-2', 'images-3', 'image-grid-2x2', 'image-grid-3x2', 'visual'].includes(id ?? ''), `${id} is unique to pictures`);
  // No picture glyph on a slot that takes anything.
  for (const tile of tiles(band)) assert.equal(tile.querySelector('svg circle'), null, `${tile.dataset.layout} draws the neutral box`);
  unmount();
});

test('M mirrors a mirrored pair from the keyboard, and says the layout it turned to', async () => {
  const { rb, said, unmount } = await ready();
  unfold(rb);
  const cell = [...grid().querySelectorAll<HTMLElement>('.arch-cell')].find((one) => one.querySelector('[data-flip]'));
  assert.ok(cell, 'a mirrored pair on the grid');
  const tile = cell.querySelector<HTMLElement>('.arch-tile');
  assert.ok(tile);
  const before = tile.dataset.layout;
  assert.equal(tile.getAttribute('aria-keyshortcuts'), 'M');
  tile.focus();
  tile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
  const turned = tiles(grid()).find((one) => one.dataset.key === tile.dataset.key);
  assert.ok(turned);
  assert.notEqual(turned.dataset.layout, before, 'the tile shows the mirror');
  assert.equal(document.activeElement, turned, 'focus stays on the tile');
  assert.match(said.at(-1) ?? '', /^Mirrored: .+\.$/);
  unmount();
});

test('no two tiles in one chooser render byte-identical pictures, and a redraw draws none again', async () => {
  const { rb, unmount } = await ready();
  unfold(rb);
  const art = tiles(grid()).map((tile) => tile.querySelector('svg')?.outerHTML ?? '');
  assert.ok(art.every(Boolean), 'every tile has a picture');
  assert.equal(new Set(art).size, art.length, 'every picture differs');
  const before = layoutThumbDraws();
  rb.memo.decide = '';
  rb.decide.render();
  assert.equal(layoutThumbDraws(), before, 'the wireframes came from the cache');
  unmount();
});

test('both tools draw the same tile for Three boxes', async () => {
  const { rb, unmount } = await ready();
  unfold(rb);
  const tile = tiles(grid()).find((one) => one.dataset.layout === 'columns-3');
  assert.ok(tile);
  // Design's chooser draws layoutThumb(master, id, 96) through the same builder.
  assert.equal(tile.querySelector('svg')?.outerHTML, svgNode(layoutThumb(STARTER_MASTER, 'columns-3', 96, archetypeThumbSvg))?.outerHTML);
  assert.equal(tile.querySelector('.arch-name')?.textContent, 'Three boxes');
  unmount();
});

// ─── the ways back: Original arrangement and Keep as it was ──────────────────

/** A mounted chooser whose controller carries arrangements out, recording each command. */
async function arranging(state: RebrandStateV1 = stateFrom()): Promise<Mounted> {
  const mounted = await ready(state);
  const { rb, calls } = mounted;
  rb.controller.setArrangement = async (ids, arrangement) => {
    calls.push({ name: 'setArrangement', args: [ids, arrangement] });
    return OK;
  };
  rb.memo.decide = '';
  rb.decide.render();
  return mounted;
}

test('Original arrangement and Keep as it was lead every chooser, drawn from the slide itself', async () => {
  const { rb, calls, said, unmount } = await arranging();
  unfold(rb);
  const all = tiles(grid());
  assert.deepEqual(all.slice(0, 2).map((tile) => tile.dataset.leading), ['original', 'picture'], 'the two ways back come first');
  assert.deepEqual(all.slice(0, 2).map((tile) => tile.querySelector('.arch-name')?.textContent), [rb.chooser.arrangementName('original'), rb.chooser.arrangementName('picture')]);
  for (const tile of all.slice(0, 2)) {
    assert.ok(tile.querySelector('svg'), `${tile.dataset.leading} is drawn`);
    const said = document.getElementById(tile.getAttribute('aria-describedby') ?? '')?.textContent ?? '';
    assert.match(said, /^The (objects|slide) stay/, 'it says what it does');
  }
  // Each is a compile of this slide: they differ from each other and from every layout tile.
  const art = all.map((tile) => tile.querySelector('svg')?.outerHTML ?? '');
  assert.equal(new Set(art).size, art.length, 'no two tiles draw the same picture');
  // The layout stays current until an arrangement is chosen.
  assert.equal(all.filter((tile) => tile.getAttribute('aria-current') === 'true')[0]?.dataset.layout, RUN.plan.slides[0]?.layout);

  all[1]?.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setArrangement')?.args, [[RUN.plan.slides[0]!.id], 'picture']);
  assert.ok(said.some((line) => /^Slide 1 is kept as (it was|a picture)\.$/.test(line)), said.join(' | '));
  assert.equal(calls.filter((call) => call.name === 'setLayout').length, 0, 'no layout written');
  unmount();
});

test('a slide kept as it was is current on that tile, previews like a layout, and its layout is one click away', async () => {
  const plan = withSlides((slide, i) => (i === 0 ? { ...slide, arrangement: 'picture' } : slide));
  const { rb, calls, unmount } = await arranging(stateFrom(plan));
  assert.equal(decideEl(rb, '.rb-layout-name')?.textContent, rb.chooser.arrangementName('picture', 'state'), 'the state, not the command');
  assert.equal(decideEl(rb, '.lp-band-head .lp-sec-flag')?.textContent, 'Yours');
  unfold(rb);
  const all = tiles(grid());
  const current = all.filter((tile) => tile.getAttribute('aria-current') === 'true');
  assert.deepEqual(current.map((tile) => tile.dataset.leading), ['picture'], 'one current tile, the picture');
  assert.match(current[0]?.textContent ?? '', /Current/);
  // Resting on the other way back previews it, without a command.
  all[0]?.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  await wait(200);
  assert.match(rb.els.compare.querySelector('[data-chooser-label]')?.textContent ?? '', /Preview: Original arrangement/);
  assert.equal(calls.length, 0, 'nothing written to the plan');
  // The layout the slide keeps underneath is pinned as Last used, and choosing it switches
  // the arrangement back, so the Undo and the sentence name that.
  const last = all.find((tile) => tile.dataset.layout === plan.slides[0]?.layout);
  assert.match(last?.textContent ?? '', /Last used/);
  last?.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setArrangement')?.args, [[plan.slides[0]!.id], 'layout']);
  assert.equal(calls.filter((call) => call.name === 'setLayout').length, 0, 'not a new layout');
  unmount();
});

test('a layout pick other than the one a slide kept as it was keeps on its row pours it into that layout', async () => {
  const plan = withSlides((slide, i) => (i === 0 ? { ...slide, arrangement: 'picture' } : slide));
  const { rb, calls, unmount } = await arranging(stateFrom(plan));
  unfold(rb);
  const other = tiles(grid()).find((tile) => tile.dataset.layout && tile.dataset.layout !== plan.slides[0]?.layout);
  assert.ok(other);
  other.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setLayout')?.args, [[plan.slides[0]!.id], other.dataset.layout]);
  unmount();
});

test('the slides like this one leave out a slide kept as it was or in its original arrangement', async () => {
  const match = { structure: 'columns-3', confidence: 0.9, coverage: 1, band: 'clear' as const, signature: 'row3' };
  const plan = withSlides((slide, i) => {
    if (i >= 4) return slide;
    const base = { ...slide, layout: 'content', layoutSource: 'proposed' as const, layoutMatch: { ...match } };
    if (i === 1) return { ...base, arrangement: 'picture' as const };
    if (i === 2) return { ...base, arrangement: 'original' as const };
    return base;
  });
  const { rb, unmount } = await arranging(stateFrom(plan));
  assert.deepEqual(rb.chooser.similar(plan.slides[0]!.id), [plan.slides[3]!.id], 'only the slide still in a layout');
  unmount();
});

test('the filmstrip names a slide kept as it was for that, and its chip draws that way, not its layout', async () => {
  const plan = withSlides((slide, i) => (i === 0 ? { ...slide, arrangement: 'picture' } : slide));
  const { rb, unmount } = await arranging(stateFrom(plan));
  rb.strip.wire();
  rb.memo.strip = '';
  rb.strip.render();
  const pick = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-pick[data-slide="${plan.slides[0]!.id}"]`);
  assert.ok((pick?.getAttribute('aria-label') ?? '').endsWith(rb.chooser.arrangementName('picture', 'state')), pick?.getAttribute('aria-label') ?? '');
  const chip = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-layout[data-layout-of="${plan.slides[0]!.id}"]`);
  const wire = rb.els.strip.querySelector<HTMLElement>(`.rb-thumb-layout[data-layout-of="${plan.slides[1]!.id}"]`);
  assert.ok(chip && wire, 'both slides carry a layout chip');
  assert.notEqual(chip.innerHTML, wire.innerHTML, 'the glyph, not a layout wireframe');
  unmount();
});

// ─── search ──────────────────────────────────────────────────────────────────

test('search finds a layout by count, by the PowerPoint and Google names, and suggests a near miss', async () => {
  const { rb, unmount } = await ready();
  unfold(rb);
  const three = search(rb, '3');
  for (const id of ['columns-3', 'icon-columns-3', 'cards-3', 'stats-3', 'steps-3']) {
    assert.ok(three.includes(id), `"3" finds ${id}`);
  }
  const four = search(rb, '4');
  for (const id of ['columns-4', 'steps-4', 'stats-4', 'grid-2x2']) {
    assert.ok(four.includes(id), `"4" finds ${id}`);
  }
  assert.ok(search(rb, 'three pictures').includes('columns-3'), 'a pictures name finds the box tile it rides on');
  assert.ok(search(rb, 'gallery').includes('grid-2x2'), 'and its keywords do too');
  assert.deepEqual(search(rb, 'four'), four, 'a number word is the digit');
  assert.ok(search(rb, 'two content').includes('columns-2'), 'the PowerPoint name Two Content finds Two boxes');
  assert.ok(search(rb, 'title and content').includes('content'), 'Title and Content finds Title and body');
  assert.ok(search(rb, 'caption only').includes('image-caption'), 'the Google name Caption only finds Picture with caption');
  assert.deepEqual(search(rb, 'timline'), []);
  const none = grid().querySelector<HTMLElement>('.arch-none');
  assert.equal(none?.hidden, false);
  assert.match(none?.textContent ?? '', /No layout matches "timline"\./);
  const suggest = none?.querySelector<HTMLElement>('[data-suggest]');
  assert.equal(suggest?.textContent, 'Did you mean Timeline?');
  suggest?.click();
  assert.ok(tiles(grid().querySelector('.arch-groups') ?? grid()).length > 0, 'the suggestion searches for it');
  unmount();
});

test('a master that predates the library names the structure each of the twelve became', () => {
  assert.equal(structureIdOf({ id: 'content' }), 'title-body');
  assert.equal(structureIdOf({ id: 'split' }), 'text-and-image');
  assert.equal(structureIdOf({ id: 'main-point' }), 'statement');
  assert.equal(structureIdOf({ id: 'columns-3' }), 'columns-3');
  assert.equal(structureIdOf({ id: 'content', structure: 'agenda' }), 'agenda', 'a stated structure wins');
});

test('search over the model alone: "4 box" and "columns-4" find Four boxes first', () => {
  assert.equal(searchLayoutTiles(STARTER_MASTER, LISTED, 'columns-4').ids[0], 'columns-4');
  assert.ok(searchLayoutTiles(STARTER_MASTER, LISTED, '4 box').ids.includes('columns-4'));
  assert.ok(searchLayoutTiles(STARTER_MASTER, LISTED, 'quadrants').ids.includes('grid-2x2'));
});

// ─── preview and apply ───────────────────────────────────────────────────────

test('resting on a tile previews it in the Proposed pane without touching the plan, and Escape restores', async () => {
  const { rb, calls, unmount } = await ready();
  unfold(rb);
  const holder = rb.els.compare.querySelector<HTMLElement>('[data-frames]');
  assert.ok(holder);
  const committed = holder.innerHTML;
  const tile = tiles(grid()).find((one) => one.dataset.layout === 'columns-4');
  assert.ok(tile);
  tile.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  await wait(200);
  const preview = rb.els.compare.querySelector<HTMLElement>('[data-chooser-preview]');
  assert.ok(preview, 'the pane shows the preview');
  assert.match(rb.els.compare.querySelector('[data-pane="proposed"] .rb-pane-cap [data-chooser-label]')?.textContent ?? '', /Preview: Four boxes/, 'named in the caption row');
  assert.ok(preview.querySelector('.rb-art svg'), 'a compiled slide, drawn');
  assert.equal(holder.hidden, true, 'the committed frames step aside');
  assert.equal(holder.innerHTML, committed, 'and are left as they were');
  assert.equal(calls.filter((call) => call.name === 'setLayout').length, 0, 'nothing written to the plan');

  tile.focus();
  tile.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(rb.els.compare.querySelector('[data-chooser-preview]'), null, 'Escape takes the preview away');
  assert.equal(holder.hidden, false);
  assert.equal(document.querySelector('.rb-lc-pop'), null, 'and closes the chooser');
  assert.equal(document.activeElement, decideEl(rb, '[data-key="layout-change"]'), 'focus goes back to Change');
  unmount();
});

test('a click applies the layout at once as one command, and the pane changes on the next render', async () => {
  const { rb, calls, said, unmount } = await ready();
  const slideId = rb.sel.slideId;
  assert.ok(slideId);
  unfold(rb);
  // The first slide reads as three boxes and carries that layout already, so the test picks four.
  const target = LISTED.find((tile) => tile.id !== RUN.plan.slides[0]?.layout && tile.id === 'columns-4');
  assert.ok(target);
  tiles(grid()).find((one) => one.dataset.layout === 'columns-4')?.click();
  await wait();
  const sets = calls.filter((call) => call.name === 'setLayout');
  assert.deepEqual(sets, [{ name: 'setLayout', args: [[slideId], 'columns-4'] }], 'one command, one undo step');
  assert.match(said.at(-1) ?? '', /^Slide 1 now uses the Four boxes layout\./);
  assert.equal(document.querySelector('.rb-lc-pop'), null, 'the chooser closes');
  // What the controller emits next: the plan with the new layout, the pane's preview
  // still the old one and marked stale while the deck recompiles.
  const plan = { ...RUN.plan, revision: RUN.plan.revision + 1, slides: RUN.plan.slides.map((one) => (one.id === slideId ? { ...one, layout: 'columns-4', layoutSource: 'user' as const } : one)) };
  rb.state = { ...rb.state, plan, previewStale: true };
  rb.render();
  const shown = rb.els.compare.querySelector<HTMLElement>('[data-chooser-preview]');
  assert.ok(shown?.querySelector('.rb-art svg'), 'the pane shows the new layout before the deck recompiles');
  assert.equal(rb.els.compare.querySelector('.rb-lc-preview-label'), null, 'as the result, not as a preview');
  assert.equal(rb.els.compare.querySelector('.rb-pane-cap .rb-lc-preview-name')?.textContent, 'Four boxes', 'the caption names the layout it shows');
  assert.equal(rb.els.compare.querySelector<HTMLElement>('[data-frames]')?.hidden, true);
  // The controller's own preview of the new plan arrives: the pane is its again.
  rb.state = { ...rb.state, preview: { deck: RUN.compiled, planRevision: plan.revision }, previewStale: false };
  rb.render();
  assert.equal(rb.els.compare.querySelector('[data-chooser-preview]'), null);
  assert.equal(rb.els.compare.querySelector<HTMLElement>('[data-frames]')?.hidden, false);
  unmount();
});

test('a tile that would pour onto another slide names it in its description, and any count beside its name is for the eye alone', async () => {
  const { rb, unmount } = await ready();
  unfold(rb);
  const described = (tile: HTMLElement): string => (tile.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
  for (let i = 0; i < 60; i += 1) {
    if (tiles(grid()).some((tile) => /Continues on \d+ more slides?\./.test(described(tile)))) break;
    await wait(10);
  }
  assert.ok(tiles(grid()).some((tile) => /Continues on \d+ more slides?\./.test(described(tile))), 'some layout overflows this slide');
  for (const mark of grid().querySelectorAll<HTMLElement>('.arch-more:not([hidden])')) {
    assert.match(mark.textContent ?? '', /^(Adds \d+ slides?|\+\d+)$/);
    assert.equal(mark.getAttribute('aria-hidden'), 'true', 'not part of the tile\'s name');
  }
  rb.chooser.close(false);
  unmount();
});

test('Suggested and Also fits sit in the first group with their sentence, and the toggle counts the slides like this one', async () => {
  const sentence = 'Three text boxes side by side, about the same width and lined up.';
  const plan = withSlides((slide, i) => (i < 3
    ? {
      ...slide,
      layout: 'content',
      layoutSource: 'proposed',
      layoutAlternative: 'grid-2x2',
      layoutMatch: { structure: 'columns-3', confidence: 0.9, coverage: 1, band: i === 0 ? 'likely' : 'clear', signature: 'row3' },
      layoutReasons: [{ code: 'layout.test', params: {}, text: sentence }],
    }
    : slide));
  const { rb, calls, unmount } = await ready(stateFrom(plan));
  unfold(rb);
  const lead = grid().querySelector<HTMLElement>('[data-band="lead"]');
  assert.ok(lead);
  const suggested = tiles(lead).find((tile) => tile.dataset.layout === 'columns-3');
  assert.match(suggested?.textContent ?? '', /Suggested, check it/, 'a likely read asks to be checked');
  assert.equal(suggested?.dataset.suggested, 'true', 'marked in shape, not by its caption alone');
  assert.ok(suggested?.querySelector('.arch-cap svg'), 'with a sparkle beside the caption');
  assert.match(lead.textContent ?? '', /Three text boxes side by side/);
  assert.ok(!/\d/.test(sentence), 'the sentence carries no number');
  const also = tiles(lead).find((tile) => tile.dataset.layout === 'grid-2x2');
  assert.match(also?.textContent ?? '', /Also fits/);
  assert.equal(also?.dataset.suggested, 'true');
  // The layout Lolly set is not the one it suggests, so the band says the rule set it.
  assert.equal(decideEl(rb, '.lp-band-head .lp-sec-flag')?.textContent, 'By the rule');

  const toggle = grid().querySelector<HTMLElement>('[data-key="layout-similar"]') as HTMLInputElement | null;
  assert.ok(toggle, 'the toggle shows when other slides read the same');
  assert.equal(toggle.checked, false, 'off by default');
  assert.match(toggle.parentElement?.textContent ?? '', /Also the 2 slides like this one/);
  toggle.checked = true;
  toggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  suggested?.click();
  await wait();
  const set = calls.find((call) => call.name === 'setLayout');
  assert.deepEqual(set?.args, [[plan.slides[0]?.id, plan.slides[1]?.id, plan.slides[2]?.id], 'columns-3'], 'one command for all three');
  // The tick belonged to that chooser: a multi-slide apply later takes the named slides only.
  const [a, b] = [plan.slides[4]?.id, plan.slides[5]?.id];
  assert.ok(a && b);
  rb.select({ slideId: a, objectId: null, itemId: null });
  rb.chooser.open([a, b], 'menu');
  tiles(document.querySelector<HTMLElement>('.rb-lc-pop') ?? document.body).find((one) => one.dataset.layout === 'grid-2x2')?.click();
  await wait();
  assert.deepEqual(calls.filter((call) => call.name === 'setLayout').at(-1)?.args, [[a, b], 'grid-2x2'], 'only the selected slides');
  unmount();
});

test('the Layout band flag says Suggested only when the layout is the suggestion, and the layout name once folded', async () => {
  const plan = withSlides((slide, i) => (i === 0
    ? { ...slide, layout: 'columns-3', layoutSource: 'proposed', layoutMatch: { structure: 'columns-3', confidence: 0.9, coverage: 1, band: 'clear', signature: 'x' } }
    : unread(slide)));
  const { rb, unmount } = await ready(stateFrom(plan));
  const flag = (): string => decideEl(rb, '.lp-band-head .lp-sec-flag')?.textContent ?? '';
  assert.equal(flag(), 'Suggested');
  rb.select({ slideId: plan.slides[1]!.id, objectId: null, itemId: null });
  assert.equal(flag(), 'By the rule');
  decideEl(rb, '.lp-band-head')?.click();
  assert.equal(decideEl(rb, '.lp-band-head')?.getAttribute('aria-expanded'), 'false');
  assert.equal(flag(), 'Title and body', 'folded, the flag is the layout it uses');
  assert.equal(decideEl(rb, '#rb-sec-layout')?.hidden, true);
  unmount();
});

test('the Layout band flag names who set the layout', async () => {
  const { layoutFlagText } = await import('./decide.ts');
  const base = { layout: 'content', arrangement: undefined } as const;
  assert.equal(layoutFlagText({ ...base, layoutSource: 'user' }, undefined), 'Yours');
  assert.equal(layoutFlagText({ ...base, layoutSource: 'preset' }, undefined), 'Set by the preset');
  assert.equal(layoutFlagText({ ...base, layoutSource: 'auto' }, undefined), 'Set by Auto-match');
  assert.equal(layoutFlagText({ ...base, layoutSource: 'proposed' }, 'content'), 'Suggested');
  assert.equal(layoutFlagText({ ...base, layoutSource: 'proposed' }, 'columns-3'), 'By the rule');
  assert.equal(layoutFlagText({ layout: 'content', layoutSource: 'proposed', arrangement: 'original' }, 'content'), 'Yours');
});

// ─── Auto-match ──────────────────────────────────────────────────────────────

test('the likely count after a run is read from what the run set, not from the count before it', () => {
  const band = (b: 'clear' | 'likely') => ({ structure: 'columns-3', confidence: 0.9, coverage: 1, band: b, signature: 'x' });
  const before = withSlides((slide, i) => (i < 4
    ? { ...slide, layout: 'content', layoutSource: i === 3 ? 'auto' : 'proposed', layoutMatch: band(i % 2 === 0 ? 'likely' : 'clear') }
    : slide));
  // The run set slides 0 and 1; slide 2 (likely) was passed by, and slide 3 was Auto-match's already.
  const after = { ...before, slides: before.slides.map((slide, i) => (i < 2 ? { ...slide, layout: 'columns-3', layoutSource: 'auto' as const } : slide)) };
  assert.equal(likelySet(before, after), 1, 'slide 0 only: slide 2 was skipped, so the count before it would have said 2');
  assert.equal(likelySet(before, before), 0, 'nothing set, nothing likely');
});

test('the Auto-match sentences count one slide in the singular', () => {
  assert.equal(matchedText(1, 1), 'Matched 1 slide. It was a likely match.');
  assert.equal(matchedText(1, 0), 'Matched 1 slide.');
  assert.equal(matchedText(4, 1), 'Matched 4 slides. 1 was a likely match.');
  assert.equal(matchedText(23, 4), 'Matched 23 slides. 4 were likely matches.');
  assert.equal(matchedText(4, 0), 'Matched 4 slides.');
  assert.equal(matchedText(0, 0), 'No slide changed.');
  assert.equal(matchLabel(1), 'Match 1 slide');
  assert.equal(matchLabel(3, true), 'Match layouts');
  assert.equal(matchLabel(23), 'Match 23 slides');
  assert.equal(likelyText({ count: 5, likely: 1, anyMatch: true }), '1 is a likely match. Check it after.');
  assert.equal(likelyText({ count: 5, likely: 2, anyMatch: true }), '2 are likely matches. Check them after.');
  assert.equal(likelyText({ count: 5, likely: 0, anyMatch: true }), 'All are clear matches.');
});

// ─── the popover ─────────────────────────────────────────────────────────────

test('rb.chooser.open puts the same grid in a popover, and Escape closes it back to its opener', async () => {
  const { rb, calls, unmount } = await ready();
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const second = RUN.plan.slides[1]?.id;
  assert.ok(second);
  rb.chooser.open([second], 'menu', opener);
  assert.equal(rb.sel.slideId, second, 'the slide it was opened for is the one on screen');
  const pop = document.querySelector<HTMLElement>('.rb-lc-pop');
  assert.ok(pop, 'the popover opened');
  assert.equal(pop.getAttribute('role'), 'dialog');
  assert.equal(rb.decide.chooserOpen(), true, 'the column counts it as its topmost overlay');
  assert.equal(tiles(pop).length, LISTED.length, 'the whole grid, each layout once');
  assert.match(pop.querySelector('.rb-lc-pop-title')?.textContent ?? '', /^(Apply|Change) layout$/, 'the heading names what it does');
  const tile = tiles(pop).find((one) => one.dataset.layout === 'stats-3');
  tile?.focus();
  tile?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(document.querySelector('.rb-lc-pop'), null, 'Escape closes it');
  assert.equal(document.activeElement, opener, 'focus goes back to what opened it');

  rb.chooser.open([second], 'chip', opener);
  tiles(document.querySelector<HTMLElement>('.rb-lc-pop') ?? document.body).find((one) => one.dataset.layout === 'stats-3')?.click();
  await wait();
  assert.deepEqual(calls.at(-1), { name: 'setLayout', args: [[second], 'stats-3'] });
  assert.equal(document.querySelector('.rb-lc-pop'), null, 'a pick closes it');
  unmount();
});

test('the popover docks over the decision column, so the Proposed pane it previews into stays in view', async () => {
  const { rb, unmount } = await ready();
  rb.els.decide.getBoundingClientRect = () => ({ x: 860, y: 56, left: 860, top: 56, right: 1220, bottom: 700, width: 360, height: 644, toJSON: () => ({}) }) as DOMRect;
  const first = RUN.plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  const pop = document.querySelector<HTMLElement>('.rb-lc-pop');
  assert.ok(pop);
  assert.equal(pop.dataset.docked, 'true');
  assert.equal(pop.style.left, '860px');
  assert.equal(pop.style.top, '56px');
  assert.equal(pop.style.width, '360px');
  rb.chooser.close(false);
  unmount();
});

test('a chooser for several slides previews the one on screen, the one a Shift+arrow selection ends on', async () => {
  const { rb, unmount } = await ready();
  const [a, b, c] = RUN.plan.slides.map((slide) => slide.id);
  assert.ok(a && b && c);
  rb.select({ slideId: c, objectId: null, itemId: null });
  rb.chooser.open([a, b, c], 'menu');
  const pop = document.querySelector<HTMLElement>('.rb-lc-pop');
  assert.ok(pop);
  const tile = tiles(pop).find((one) => one.dataset.layout === 'columns-4');
  assert.ok(tile);
  tile.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  await wait(200);
  assert.match(rb.els.compare.querySelector('[data-chooser-label]')?.textContent ?? '', /Preview: Four boxes/, 'the pane shows it for the slide on screen');
  rb.chooser.close(false);
  unmount();
});

// ─── the object's text ───────────────────────────────────────────────────────

function firstTextObject(source: SourceDeckV1): { slideId: string; objectId: string } {
  for (const slide of source.slides) {
    const object = slide.objects.find((one) => one.kind === 'text' && (one.text?.paras.length ?? 0) > 0);
    if (object) return { slideId: slide.id, objectId: object.id };
  }
  throw new Error('the fixture has a text object');
}

test('a text object gets a correction field that commits through setObjectText, and a low reading is named in words', async () => {
  const { slideId, objectId } = firstTextObject(RUN.deck);
  const source: SourceDeckV1 = {
    ...RUN.deck,
    slides: RUN.deck.slides.map((slide) => (slide.id === slideId
      ? {
        ...slide,
        objects: slide.objects.map((one) => (one.id === objectId
          ? { ...one, ocr: { state: 'text-found', lines: [{ text: 'x', confidence: 0.42, box: { x: 0, y: 0, w: 1, h: 1, rot: 0 } }] } }
          : one)),
      }
      : slide)),
  };
  const { rb, calls, said, unmount } = await ready(stateFrom(RUN.plan, source));
  rb.select({ slideId, objectId, itemId: null });
  const field = decideEl(rb, 'textarea[data-act="object-text"]') as HTMLTextAreaElement | null;
  assert.ok(field, 'the correction field');
  assert.ok(field.value.length > 0, 'it holds the words as read');
  assert.equal(decideEl(rb, '#rb-text-low')?.textContent, 'This text may be misread.');
  assert.equal(field.getAttribute('aria-describedby'), 'rb-text-low');
  field.value = 'Corrected words';
  field.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setObjectText')?.args, [objectId, 'Corrected words']);
  assert.ok(said.includes('Text corrected.'));
  unmount();

  const later = await ready(stateFrom(RUN.plan, source), { text: 'not-built' });
  later.rb.select({ slideId, objectId, itemId: null });
  const again = decideEl(later.rb, 'textarea[data-act="object-text"]') as HTMLTextAreaElement | null;
  assert.ok(again);
  again.value = 'Other words';
  again.dispatchEvent(new window.Event('change', { bubbles: true }));
  await wait();
  assert.ok(later.said.includes('Correcting text is not available yet.'));
  assert.equal((decideEl(later.rb, 'textarea[data-act="object-text"]') as HTMLTextAreaElement | null)?.disabled, true);
  later.unmount();
});

test('reading confidence is the mean of the lines read, and absent when nothing was read', () => {
  const lines = [0.9, 0.5].map((confidence) => ({ text: 'a', confidence, box: { x: 0, y: 0, w: 1, h: 1, rot: 0 } }));
  const base = RUN.deck.slides[0]?.objects[0];
  assert.ok(base);
  assert.equal(readingConfidence({ ...base, ocr: { state: 'text-found', lines } }), 0.7);
  assert.equal(readingConfidence({ ...base, ocr: { state: 'not-run' } }), undefined);
  assert.equal(readingConfidence(base), undefined);
});

test('a plain shape is named by what it looks like', () => {
  const slide = { width: 1280, height: 720 };
  const base = RUN.deck.slides[0]?.objects[0];
  assert.ok(base);
  const shape = (w: number, h: number, geom?: string) => ({ ...base, kind: 'shape' as const, box: { x: 0, y: 0, w, h, rot: 0 }, ...(geom ? { geom } : {}) });
  assert.equal(plainShapeName(shape(1000, 20), slide, 'Shape'), 'Bar');
  assert.equal(plainShapeName(shape(1000, 2), slide, 'Shape'), 'Line');
  assert.equal(plainShapeName(shape(700, 500), slide, 'Shape'), 'Panel');
  assert.equal(plainShapeName(shape(80, 80, 'ellipse'), slide, 'Shape'), 'Circle');
  assert.equal(plainShapeName(shape(80, 60), slide, 'Shape'), 'Shape');
  assert.equal(plainShapeName({ ...base, kind: 'text' }, slide, 'Text'), 'Text', 'only shapes are renamed');
});

// ─── slide-level queue cards (plan 275 section 3.3), the plain card ───────────

test('a layout card sits in the queue as a plain card, and a click selects its slide', async () => {
  const { rb, unmount } = await ready();
  rb.queue.wire();
  const card = rb.els.queue.querySelector<HTMLElement>('[data-slide-item="layout:columns-3"]');
  assert.ok(card, 'the Three boxes card is listed');
  assert.match(card.textContent ?? '', /Three boxes, slide 1/, 'the layout first, so the useful word survives truncation');
  rb.select({ slideId: RUN.plan.slides[3]!.id, objectId: null, itemId: null });
  rb.els.queue.querySelector<HTMLElement>('[data-slide-item="layout:columns-3"]')?.click();
  assert.equal(rb.sel.slideId, RUN.plan.slides[0]!.id);
  assert.equal(rb.sel.objectId, null, 'a layout card names no object');
  assert.equal(toReviewCount(rb), reviewItems(rb).length, 'the count of cards holding rows is unchanged by it');
  unmount();
});

test('slides that read as diagrams are one card, and Keep as it was shows only once the controller can do it', async () => {
  const dense = { code: 'layout.reason.dense', params: { units: 24 }, text: 'Many small boxes that fit no layout, like a diagram.' };
  const plan = withSlides((slide, i) => (i === 5 ? { ...unread(slide), layoutReasons: [dense] } : slide));
  const without = await ready(stateFrom(plan));
  assert.match(without.rb.els.queue.querySelector('[data-slide-item="diagram:slides"]')?.textContent ?? '', /Slide 6 reads as a diagram/);
  assert.equal(without.rb.els.queue.querySelector('[data-keep-picture]'), null, 'no action the controller cannot carry out');
  without.unmount();

  const { rb, calls, said, unmount } = await ready(stateFrom(plan));
  rb.queue.wire();
  rb.controller.setArrangement = async (ids, arrangement) => {
    calls.push({ name: 'setArrangement', args: [ids, arrangement] });
    return OK;
  };
  rb.memo.queue = '';
  rb.queue.render();
  const keep = rb.els.queue.querySelector<HTMLElement>('[data-keep-picture]');
  assert.match(keep?.textContent ?? '', /^Keep as (it was|a picture)$/);
  keep?.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setArrangement')?.args, [[plan.slides[5]!.id], 'picture']);
  assert.ok(said.some((line) => /^Slide 6 is kept as (it was|a picture)\.$/.test(line)), said.join(' | '));
  unmount();
});

// ─── the column over the adversarial deck ───────────────────────────────────

const {
  RUN: ADV, MARK_GROUP, planWithLockedMark, stateFrom: advState, mount: advMount, settle, change, keydown, firstSlide, deckWithSurplus,
} = await reviewHarness();

test('Keep, Replace and Remove send decide with the right ids and scope, locked members left out', async () => {
  const { plan, lockedId } = planWithLockedMark();
  const { rb, calls, said, unmount } = advMount(advState(plan));
  const group = rb.derived?.queue.find((item) => item.id === MARK_GROUP?.id);
  assert.ok(group);
  rb.queue.selectItem(group.id);

  const button = (action: string): HTMLElement => {
    const el = rb.els.decide.querySelector<HTMLElement>(`[data-key="act-${action}"]`);
    assert.ok(el, action);
    return el;
  };

  // This object: the exemplar alone, able to change an earlier choice, no group scope.
  button('keep').click();
  await settle();
  const one = calls.at(-1)?.args[0] as RebrandDecideInputV1;
  assert.equal(calls.at(-1)?.name, 'decide');
  assert.deepEqual(one.objectIds, [group.exemplar]);
  assert.equal(one.action, 'keep');
  assert.equal(one.scope, undefined);
  assert.equal(one.includeCorrected, true);
  assert.equal(said.at(-1), 'Kept 1 object.', 'the sentence alone, with no lesson on the Undo button');

  // Apply to is a two-option segment named with the card's own noun, the group first
  // because the person came from the group's card; the broad option counts the members
  // the apply will touch: three less the locked one.
  const scope = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-scope-seg > button')];
  assert.deepEqual(scope.map((one) => one.dataset.scope), ['group', 'one'], 'the group first, from its card');
  assert.equal(rb.els.decide.querySelector('.rb-scope-seg')?.classList.contains('lp-seg'), true);
  const broad = scope[0];
  assert.ok(broad);
  assert.match(broad.textContent ?? '', /^All 2 \S+$/);
  assert.match(scope[1]?.textContent ?? '', /^This \S+$/);
  assert.equal(scope[1]?.getAttribute('aria-pressed'), 'true', 'this one by default');
  assert.match(rb.els.decide.textContent ?? '', /1 locked stays\./);
  broad.click();
  assert.equal(rb.els.decide.querySelector('[data-scope="group"]')?.getAttribute('aria-pressed'), 'true');
  button('remove').click();
  await settle();
  const many = calls.at(-1)?.args[0] as RebrandDecideInputV1;
  assert.equal(many.action, 'remove');
  assert.equal(many.scope, group.id);
  assert.equal(many.includeCorrected, false);
  assert.ok(!many.objectIds.includes(lockedId), 'the locked member is left out');
  assert.deepEqual([...many.objectIds].sort(), group.objectIds.filter((id) => id !== lockedId).sort());
  assert.match(said.at(-1) ?? '', /Removed 2 objects\./);

  // Replace opens the chooser; the design system logo is one choice in it.
  button('replace').click();
  const logo = rb.els.decide.querySelector<HTMLElement>('[data-kind="brand-logo"]');
  assert.ok(logo, 'the chooser is open');
  logo.click();
  await settle();
  const replaced = calls.at(-1)?.args[0] as RebrandDecideInputV1;
  assert.equal(replaced.action, 'replace');
  assert.deepEqual(replaced.replacement, { kind: 'brand-logo', variant: 'auto' });
  assert.equal(replaced.scope, group.id);
  assert.equal(rb.els.decide.querySelector('[data-chooser]'), null, 'the chooser closes after a choice');
  unmount();
});

test('Move later sends move with plus one, from the Slide section', async () => {
  const { rb, calls, unmount } = advMount(advState());
  const first = rb.derived?.slides[0];
  assert.ok(first);
  rb.select({ slideId: first.id, objectId: null, itemId: null });
  // The pointer path that needs no drag lives in the decision column; the filmstrip keeps the grip.
  const later = rb.els.decide.querySelector<HTMLButtonElement>('[data-act="move"][data-delta="1"]');
  assert.ok(later, 'the first slide has Move later');
  const earlier = rb.els.decide.querySelector<HTMLButtonElement>('[data-act="move"][data-delta="-1"]');
  assert.equal(earlier?.disabled, true, 'the first slide cannot move earlier');
  later.click();
  await settle();
  assert.deepEqual(calls.at(-1), { name: 'move', args: [first.id, 1] });
  unmount();
});

test('on a narrow screen selecting an object opens the sheet, and Esc closes it', () => {
  const { rb, unmount } = advMount(advState(), { narrow: true });
  assert.equal(rb.els.decide.dataset.sheet, 'closed');
  const chip = rb.els.queue.querySelector<HTMLElement>('.rb-q-chip');
  assert.ok(chip, 'a narrow queue is a row of chips');
  chip.focus();
  chip.click();
  assert.equal(rb.els.decide.dataset.sheet, 'open');
  assert.equal(rb.els.decide.getAttribute('role'), 'dialog');
  keydown('Escape');
  assert.equal(rb.els.decide.dataset.sheet, 'closed');
  unmount();
});

test('an object the compile placed nowhere is named in the decision column, in the queue card\'s words', () => {
  const slide = firstSlide();
  const id = slide.objects[0]?.id;
  assert.ok(id);
  const { rb, unmount } = advMount(advState(ADV.plan, { preview: deckWithSurplus([id]) }));
  rb.select({ objectId: id, slideId: slide.id, itemId: null });
  const head = rb.els.decide.querySelector<HTMLElement>('[data-sec="decision"] .lp-sec-head');
  assert.match(head?.textContent ?? '', /Not placed/);
  const flag = head?.querySelector<HTMLElement>('.lp-sec-flag');
  assert.ok(flag?.classList.contains('rb-flag--danger'), 'what blocks the handoff takes the danger tone');
  assert.ok(flag?.querySelector('svg'), 'with its glyph, so colour is not the only signal');
  assert.match(rb.els.decide.textContent ?? '', /Goes to the Not placed artboard in Design; Remove takes it out of the deck\./);
  unmount();
});

test('no fidelity flag is a noun an object is named by', () => {
  const nouns = new Set(Object.values(REVIEW_NOUNS).flatMap((noun) => [noun.one.toLowerCase(), noun.many.toLowerCase()]));
  for (const fidelity of ['picture', 'approximate', 'unavailable'] as const) {
    const word = fidelityFlag(fidelity);
    assert.ok(word, `${fidelity} has a flag`);
    assert.equal(nouns.has(word.toLowerCase()), false, `the ${fidelity} flag "${word}" is not a noun from REVIEW_NOUNS`);
  }
});

test('colour uses that share a role, a source and a target are one row with their count', async () => {
  const base = ADV.plan.colors[0];
  assert.ok(base, 'the adversarial plan maps at least one colour');
  const same = { role: 'ink' as const, from: '#000000', to: '#ffffff', toPath: 'color.brand.white' };
  const colors = [
    { ...base, ...same, useId: 'use.a' },
    { ...base, ...same, useId: 'use.b' },
    { ...base, ...same, useId: 'use.c' },
    { ...base, role: 'ink' as const, from: '#333333', useId: 'use.d', unresolved: 'contrast-unreachable' as const, to: undefined, toPath: undefined },
  ];
  const plan: RenovationPlanV1 = { ...ADV.plan, colors };
  const { rb, calls, unmount } = advMount(advState(plan));
  rb.els.decide.querySelector<HTMLElement>('[data-fold="colours"]')?.click();
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-colour')];
  assert.equal(rows.length, 2, 'three uses of one mapping are one row, the unresolved one its own');
  assert.match(rows[0]?.querySelector('.rb-colour-src')?.textContent ?? '', /^#000000 · 3 uses$/);
  const noMatch = rows[1]?.querySelector<HTMLElement>('.rb-nomatch');
  assert.equal(noMatch?.textContent, 'No match');
  assert.equal(noMatch?.title, 'No design system colour keeps this text readable.', 'the reason is its tooltip');
  // One sentence for the lot, never one per row.
  assert.deepEqual(visibleHelp(rb).filter((el) => el.closest('[data-sec="colours"]')).map((el) => el.textContent), ['1 text colour has no readable match and stays automatic.']);
  assert.ok([...rows[0]!.querySelectorAll('option')].every((option) => !/#/.test(option.textContent ?? '')), 'options named without the hex');
  const select = rows[0]?.querySelector<HTMLSelectElement>('select');
  assert.ok(select);
  const options = [...select.options].map((option) => option.value);
  assert.ok(options.every((value) => value === '' || value.startsWith('path:')), 'every target is a design system colour');
  select.value = options.find((value) => value.startsWith('path:') && value !== select.value) ?? '';
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  await settle();
  assert.deepEqual(calls.at(-1)?.args[0], ['use.a', 'use.b', 'use.c'], 'one choice sets every use the row covers');
  rb.els.decide.querySelector<HTMLElement>('.rb-colour [data-act="lock"]')?.click();
  await settle();
  assert.deepEqual(calls.at(-1)?.args[0], ['use.a', 'use.b', 'use.c'], 'and so does the lock');
  assert.equal(calls.at(-1)?.args[2], true);
  unmount();
});

test('while the narrow sheet is open the job toast moves to the top, clear of its rows', () => {
  const css = rebrandCss();
  const rule = /html:has\(\.rb\[data-narrow="true"\] \.rb-decide\[data-sheet="open"\]\) \.job-toast \{([^}]*)\}/.exec(css);
  assert.ok(rule, 'a rule for the toast while the sheet is open');
  assert.match(rule[1] ?? '', /top: calc\(var\(--safe-top, 0px\) \+ var\(--sp-3\)\);/);
  assert.match(rule[1] ?? '', /bottom: auto;/);
});

test('the Colours flag counts what to check in ink, with no danger tone, since nothing there blocks the handoff', () => {
  const base = ADV.plan.colors[0];
  assert.ok(base);
  const colors = [
    { ...base, role: 'ink' as const, from: '#333333', useId: 'use.a', unresolved: 'contrast-unreachable' as const, to: undefined, toPath: undefined },
    { ...base, role: 'ink' as const, from: '#444444', useId: 'use.b', unresolved: 'contrast-unreachable' as const, to: undefined, toPath: undefined },
  ];
  const { rb, unmount } = advMount(advState({ ...ADV.plan, colors }));
  const flag = rb.els.decide.querySelector<HTMLElement>('[data-sec="colours"] .lp-sec-flag');
  assert.ok(flag);
  assert.equal(flag.textContent, '2 to check');
  assert.ok(flag.classList.contains('rb-flag--ink'));
  assert.equal(flag.querySelector('svg'), null, 'no warning glyph on a count to review');
  unmount();
});

test('with no match signature the layout chooser counts the slides from the same source layout, and offers no toggle when nothing else would change', async () => {
  const { slidesSharingSourceLayout } = await import('@lolly/engine');
  const slide = firstSlide();
  const sharing = slidesSharingSourceLayout(ADV.deck, slide.id);
  const others = sharing.filter((id) => id !== slide.id);
  // The matcher named nothing, so the source layout is what makes slides alike.
  const unmatched: RenovationPlanV1 = {
    ...ADV.plan,
    slides: ADV.plan.slides.map((one) => {
      const copy = { ...one };
      delete copy.layoutMatch;
      return copy;
    }),
  };
  const target = ARCHETYPE_IDS.find((id) => unmatched.slides.every((one) => one.layout !== id));
  assert.ok(target, 'a layout no slide uses yet');

  const open = async (plan: RenovationPlanV1): Promise<ReviewMounted> => {
    const mounted = advMount(advState(plan));
    for (let i = 0; i < 100 && !mounted.rb.chooser.master(); i += 1) await new Promise((resolve) => { setTimeout(resolve, 5); });
    assert.ok(mounted.rb.chooser.master(), 'the design system resolves');
    mounted.rb.select({ slideId: slide.id, objectId: null, itemId: null });
    unfold(mounted.rb);
    return mounted;
  };
  const tileFor = (_rb: RbCtx): HTMLElement | undefined => tiles(grid()).find((tile) => tile.dataset.layout === target);

  const first = await open(unmatched);
  assert.ok(tileFor(first.rb), 'the chooser lists the target');
  const toggle = grid().querySelector<HTMLInputElement>('[data-key="layout-similar"]');
  if (others.length > 0) {
    assert.ok(toggle, 'the toggle shows when other slides share the source layout');
    assert.equal(toggle.checked, false, 'off by default');
    toggle.checked = true;
    change(toggle);
    tileFor(first.rb)?.click();
    await settle();
    const set = first.calls.filter((call) => call.name === 'setLayout');
    assert.deepEqual(set.map((call) => call.args), [[[slide.id, ...others], target]], 'one command for every slide');
  } else {
    assert.equal(toggle, null);
  }
  first.rb.chooser.close(false);
  first.unmount();

  // Every other slide from the same source layout is set by hand: only this one can change.
  const handSet = new Set(others);
  const second = await open({
    ...unmatched,
    slides: unmatched.slides.map((one) => (handSet.has(one.id) ? { ...one, layoutSource: 'user' as const } : one)),
  });
  assert.equal(grid().querySelector('[data-key="layout-similar"]'), null);
  tileFor(second.rb)?.click();
  await settle();
  assert.deepEqual(second.calls.filter((call) => call.name === 'setLayout').map((call) => call.args), [[[slide.id], target]], 'this slide alone still changes');
  second.rb.chooser.close(false);
  second.unmount();
});

// ─── the close-out column (plan 275 close-out section 3.5) ───────────────────

/** The first slide with five bars added: shapes with no words the rule removes. */
function withBars(): { state: RebrandStateV1; slideId: string; bars: string[] } {
  const deck = structuredClone(ADV.deck);
  const slide = deck.slides[0];
  assert.ok(slide);
  const base = slide.objects[0];
  assert.ok(base);
  const bars = [0, 1, 2, 3, 4].map((i) => `${slide.id}.bar${i}`);
  for (const [i, id] of bars.entries()) {
    slide.objects.push({ ...structuredClone(base), id, kind: 'shape', text: undefined, alt: undefined, ocr: undefined, box: { x: 40, y: 100 + i * 40, w: 600, h: 12, rot: 0 } });
  }
  const plan: RenovationPlanV1 = {
    ...ADV.plan,
    slides: ADV.plan.slides.map((one) => (one.id === slide.id
      ? { ...one, objects: [...one.objects, ...bars.map((id) => ({ id, class: 'decoration' as const, evidence: [], proposal: 'remove' as const, review: 'unreviewed' as const }))] }
      : one)),
  };
  return { state: advState(plan, { source: deck }), slideId: slide.id, bars };
}

test('an object selected opens Decision and Objects, and nothing else, with a door glyph on Replace and no caret on a popup', () => {
  const { rb, unmount } = advMount(advState());
  rb.controller.setObjectText = async () => ({ ok: true, touched: 1, skipped: 0 });
  const slide = firstSlide();
  const object = slide.objects.find((one) => rb.derived?.objects.has(one.id));
  assert.ok(object);
  rb.select({ slideId: slide.id, objectId: object.id, itemId: null });
  assert.deepEqual(openParts(rb), ['decision', 'objects']);
  assert.match(decideEl(rb, '.lp-head-name')?.textContent ?? '', / on slide 1$/);
  assert.ok(visibleHelp(rb).length <= 1, visibleHelp(rb).map((el) => el.textContent).join(' | '));
  const replace = decideEl(rb, '[data-key="act-replace"]');
  assert.ok(replace?.querySelector('svg'), 'Replace carries the arrow of a door');
  assert.equal(replace?.querySelector('.lp-caret'), null);
  for (const popup of rb.els.decide.querySelectorAll('[aria-haspopup]')) assert.equal(popup.querySelector('.lp-caret'), null, 'no caret on a popup');
  for (const head of rb.els.decide.querySelectorAll('.lp-sec-head, .lp-band-head')) assert.equal(head.hasAttribute('aria-haspopup'), false, 'a fold is never a popup');
  // Layout folds with the layout's name as its flag.
  const layout = decideEl(rb, '.lp-band-head');
  assert.equal(layout?.getAttribute('aria-expanded'), 'false');
  assert.ok((layout?.querySelector('.lp-sec-flag')?.textContent ?? '').length > 0);
  // Replace's choices unfold under it, with no Cancel: the segment and Escape close them.
  replace?.click();
  assert.ok(decideEl(rb, '#rb-replace'));
  assert.equal(decideEl(rb, '[data-act="close-chooser"]'), null);
  assert.equal(decideEl(rb, '[data-key="act-replace"]')?.getAttribute('aria-expanded'), 'true');
  unmount();
});

test('five bars with no words and one action are one row, and pressing it selects the first and unfolds the rest', () => {
  const { state, slideId, bars } = withBars();
  const { rb, unmount } = advMount(state);
  rb.select({ slideId, objectId: null, itemId: null });
  decideEl(rb, '[data-fold="objects"]')?.click();
  const groups = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-obj--group')];
  const bar = groups.find((one) => one.querySelector('.rb-obj-name')?.textContent === '5 bars');
  assert.ok(bar, groups.map((one) => one.querySelector('.rb-obj-name')?.textContent).join(' | '));
  assert.equal(bar.querySelector('.rb-obj-act')?.textContent, 'Remove');
  assert.equal(bar.getAttribute('aria-expanded'), 'false');
  assert.ok(bar.querySelector('.rb-obj-pic[data-crop]'), 'the row leads with a crop');
  bar.click();
  assert.equal(rb.sel.objectId, bars[0]);
  const again = rb.els.decide.querySelector<HTMLElement>('.rb-obj--group[aria-expanded="true"]');
  assert.ok(again);
  const members = [...(again.parentElement?.querySelectorAll<HTMLElement>('.rb-objs--sub .rb-obj[data-object]') ?? [])];
  assert.deepEqual(members.map((one) => one.dataset.object), bars);
  assert.equal(members[0]?.getAttribute('aria-current'), 'true');
  // The list is one Tab stop, and the arrows move along it.
  const stops = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-objs [data-rove]')].filter((one) => one.tabIndex === 0);
  assert.equal(stops.length, 1);
  const list = rb.els.decide.querySelector<HTMLElement>('ul.rb-objs:not(.rb-objs--sub)');
  assert.equal(document.getElementById(list?.getAttribute('aria-describedby') ?? '')?.textContent, 'Up and Down move between objects.', 'the list says which keys move along it');
  assert.equal(stops[0], members[0]);
  members[0]?.focus();
  members[0]?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, members[1]);
  unmount();
});

test('a picture object shows no Text field, and words read from a picture are named that way in the field\'s name', () => {
  const { state, slideId } = withBars();
  const { rb, unmount } = advMount(state);
  const slide = state.source?.slides.find((one) => one.id === slideId);
  const bar = slide?.objects.find((one) => one.id.endsWith('.bar0'));
  assert.ok(bar);
  rb.select({ slideId, objectId: bar.id, itemId: null });
  assert.equal(decideEl(rb, 'textarea[data-act="object-text"]'), null, 'no empty field for an object with no words');
  const read = structuredClone(state);
  const text = read.source?.slides.find((one) => one.id === slideId)?.objects.find((one) => one.kind === 'text' && (one.text?.paras.length ?? 0) > 0);
  assert.ok(text);
  text.ocr = { state: 'text-found', lines: [{ text: 'x', confidence: 0.95, box: { x: 0, y: 0, w: 1, h: 1, rot: 0 } }] };
  rb.state = read;
  rb.select({ slideId, objectId: text.id, itemId: null });
  const field = decideEl(rb, 'textarea[data-act="object-text"]');
  assert.ok(field);
  assert.equal(field.title, 'Read from the picture. Edit it here if a word is wrong.');
  assert.match(field.getAttribute('aria-label') ?? '', /^Text\. /, 'the visible label starts the name');
  assert.equal(visibleHelp(rb).filter((el) => /picture/.test(el.textContent ?? '')).length, 0, 'not a help line');
  unmount();
});

test('Fonts groups the faces of a family, says once when every face becomes one, and sets a specimen in the target', () => {
  const fonts = [
    { from: 'Poppins Light', to: 'SUSE', source: 'class' as const },
    { from: 'Poppins', to: 'SUSE', source: 'class' as const },
    { from: 'Poppins SemiBold', to: 'SUSE', source: 'class' as const },
    { from: 'Poppins Bold', to: 'SUSE', source: 'class' as const },
    { from: 'Calibri', to: 'SUSE', source: 'alias' as const },
  ];
  const { rb, calls, unmount } = advMount(advState({ ...ADV.plan, fonts }));
  const head = decideEl(rb, '[data-sec="fonts"] .lp-sec-head');
  assert.equal(head?.querySelector('.lp-sec-flag')?.textContent, '5 become SUSE');
  head?.click();
  assert.equal(decideEl(rb, '.rb-font-all')?.textContent, 'All 5 fonts become SUSE.');
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-font')];
  assert.deepEqual(rows.map((row) => row.querySelector('.rb-font-from')?.textContent), ['Poppins, 4 weights', 'Calibri']);
  assert.equal(rows[0]?.querySelector('.rb-font-from')?.classList.contains('lp-label'), false, 'the source in its own case, not the eyebrow');
  const specimen = rows[0]?.querySelector<HTMLElement>('.rb-font-specimen');
  if (specimen) assert.match(specimen.getAttribute('style') ?? '', /font-family:'SUSE'/);
  const select = rows[0]?.querySelector<HTMLSelectElement>('select');
  assert.ok(select);
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  return settle().then(() => {
    assert.deepEqual(calls.filter((call) => call.name === 'setFont').map((call) => call.args[0]), ['Poppins Light', 'Poppins', 'Poppins SemiBold', 'Poppins Bold']);
    unmount();
  });
});

test('colours of one role that go to one target fold into one row, and the swatch grid sets it', async () => {
  const base = ADV.plan.colors[0];
  assert.ok(base);
  const white = { role: 'bg' as const, to: '#ffffff', toPath: 'color.surface' };
  const colors = [
    { ...base, ...white, from: '#fafafa', useId: 'use.a' },
    { ...base, ...white, from: '#f5f5f5', useId: 'use.b' },
    { ...base, ...white, from: '#eeeeee', useId: 'use.c' },
  ];
  const { rb, calls, unmount } = advMount(advState({ ...ADV.plan, colors }));
  decideEl(rb, '[data-fold="colours"]')?.click();
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-colour')];
  assert.equal(rows.length, 1);
  assert.match(rows[0]?.querySelector('.rb-colour-src')?.textContent ?? '', /^3 colours · 3 uses$/);
  rows[0]?.querySelector<HTMLElement>('[data-act="swatches"]')?.click();
  const pop = document.querySelector<HTMLElement>('.rb-swatch-pop');
  assert.ok(pop, 'the swatch grid opens');
  assert.equal(pop.getAttribute('role'), 'dialog');
  const tilesIn = [...pop.querySelectorAll<HTMLElement>('[data-swatch]')];
  assert.equal(tilesIn[0]?.dataset.swatch, '', 'Automatic first');
  const pick = tilesIn.find((tile) => tile.dataset.swatch?.startsWith('path:') && tile.getAttribute('aria-pressed') !== 'true');
  assert.ok(pick);
  pick.click();
  await settle();
  assert.equal(document.querySelector('.rb-swatch-pop'), null, 'a pick closes it');
  assert.deepEqual(calls.at(-1)?.args[0], ['use.a', 'use.b', 'use.c'], 'one choice for the three');
  unmount();
});

test('the column carries no app segment and no caret on a popup, in its source', () => {
  const source = readFileSync(new URL('./decide.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /view-seg-btn/);
  const css = rebrandCss();
  assert.doesNotMatch(css, /\.rb-decide[^{]*\{[^}]*border[^:]*:[^;]*dashed/, 'no dashed border in the column');
});

test('the Fonts flag branches on one: "1 becomes SUSE"', () => {
  const { rb, unmount } = advMount(advState({ ...ADV.plan, fonts: [{ from: 'Poppins', to: 'SUSE', source: 'class' as const }] }));
  assert.equal(decideEl(rb, '[data-sec="fonts"] .lp-sec-head .lp-sec-flag')?.textContent, '1 becomes SUSE');
  unmount();
});

test('with text cut off, the Layout band gives only the way out: the caption and the boxes already say the problem', async () => {
  const { rb, unmount } = await ready();
  Reflect.set(rb.compare, 'cutOff', () => [{ layerId: 'x', words: 2 }]);
  rb.memo.decide = '';
  rb.decide.render();
  const lines = visibleHelp(rb).map((el) => el.textContent ?? '');
  assert.ok(lines.includes('Try another layout, or shorten the text.'), lines.join(' | '));
  assert.equal(lines.some((line) => /cut off/u.test(line)), false, 'the problem is not said a third time');
  unmount();
});

test('object rows and swatch tiles follow the one tile rule, and the danger flag reads at text contrast', () => {
  const css = readFileSync(new URL('../../styles/parts/rebrand-decide.css', import.meta.url), 'utf8');
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n  ${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at) + 1);
  };
  assert.match(rule('.rb-obj:hover'), /box-shadow: var\(--ui-effect-selection-ring-hover\);/u, 'hover is the faint ring, not a grey fill');
  assert.doesNotMatch(rule('.rb-obj:hover'), /background/u);
  assert.match(rule('.rb-obj[aria-current="true"]'), /background: var\(--ui-color-selection-surface\); box-shadow: var\(--ui-effect-selection-ring\);/u);
  assert.match(rule('.rb-swatch-tile:hover'), /box-shadow: var\(--ui-effect-selection-ring-hover\);/u);
  assert.match(rule('.rb-swatch-tile[aria-pressed="true"]'), /box-shadow: var\(--ui-effect-selection-ring\);/u);
  assert.doesNotMatch(css, /--ui-effect-selected\b/u, 'no inset tint-plus-border idiom left');
  assert.match(css, /\.rb-flag--danger \{ color: color-mix\(in oklab, var\(--ui-color-status-danger\) 50%, var\(--ui-color-text-default\)\);/u);
});
