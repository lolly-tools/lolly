// SPDX-License-Identifier: MPL-2.0
/**
 * The layout chooser as the close-out ships it (plan 275 close-out section 3.6): one
 * popover from every entry, the one tile rule, "This slide" first with the picture badge,
 * the continuation count as a suffix only where it differs, the Auto-match row with its
 * tally and its hover preview, and the design system's faces in every proposed drawing.
 *
 * The state is the real pipeline over tests/fixtures/rebrand/structures.pptx, the host
 * answers the starter design system, so the previews are real one-slide compiles, and the
 * Proposed pane is the real comparison module. The decision column and the filmstrip are
 * stand-ins that only record, so this suite pins the chooser's own work and nothing of
 * the regions beside it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { autoMatchCount, compileFaithful } from '@lolly/engine';
import type { RenovationPlanV1, SlidePlanV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';
import {
  STARTER_DESIGN_SYSTEM,
  STARTER_MASTER,
  runRebrandPipeline,
  type RebrandRunV1,
} from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type { RebrandControllerV1, RebrandEditOutcomeV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import type { RbCtx } from './context.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLDivElement', 'Element', 'Node',
  'Event', 'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'PointerEvent', 'DOMParser', 'getComputedStyle',
  'requestAnimationFrame', 'cancelAnimationFrame', 'navigator',
]) {
  const value = Reflect.get(dom.window, key);
  if (value !== undefined) Reflect.set(globalThis, key, value);
}

const { deriveReview } = await import('./shared.ts');
const { queueOps } = await import('./queue.ts');
const { compareOps } = await import('./compare.ts');
const { chooserOps, continuationMark, likelyTitle, settledText } = await import('./layout-chooser.ts');
const { PREVIEW_DELAY_MS } = await import('../../lib/slide-structures-ui.ts');

const FIXTURE = new URL('../../../../../tests/fixtures/rebrand/structures.pptx', import.meta.url);
const MASTERS = new URL('../../../../../brands/lolly-start/catalog/assets/lolly/slides/masters.json', import.meta.url);
const CSS = new URL('../../styles/parts/rebrand-chooser.css', import.meta.url);

const RUN: RebrandRunV1 = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(FIXTURE)));
const MASTER_BYTES = new Uint8Array(readFileSync(MASTERS));

/** The two reads the design system resolver makes, answered with the starter design system. */
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
      fonts: ['Brandface Sans', 'Brandface Mono'],
    },
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 1,
  };
}

function withSlides(edit: (slide: SlidePlanV1, index: number) => SlidePlanV1): RenovationPlanV1 {
  return { ...RUN.plan, slides: RUN.plan.slides.map(edit) };
}

/** A slide read as three boxes by the matcher, on another layout, for Auto-match to set. */
function readAs(slide: SlidePlanV1, structure: string, band: 'clear' | 'likely'): SlidePlanV1 {
  return { ...slide, layout: 'content', layoutSource: 'proposed', layoutMatch: { structure, confidence: 0.9, coverage: 1, band, signature: `${structure}-${slide.id}` } };
}

interface Call { name: string; args: unknown[] }

const OK: RebrandEditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };

function stubController(state: RebrandStateV1, calls: Call[]): RebrandControllerV1 {
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
    setArrangement: record('setArrangement'),
    autoMatchLayouts: record('autoMatchLayouts'),
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
}

interface Mounted {
  rb: RbCtx;
  calls: Call[];
  said: string[];
  unmount(): void;
}

/**
 * The regions, the context and the modules the chooser works with: the real queue (its
 * sentences), the real comparison (the Proposed pane the preview draws into) and the
 * chooser, with the column and the filmstrip as stand-ins that record.
 */
function mount(state: RebrandStateV1): Mounted {
  document.body.innerHTML = `<div id="view"><div class="rb">
    <header class="rb-top"><div class="rb-mode-slot"></div></header>
    <section class="rb-intake"></section>
    <div class="rb-body"><nav class="rb-queue"></nav><div class="rb-grip" data-grip="queue" hidden></div><main class="rb-work"><section class="rb-compare"></section></main><div class="rb-grip" data-grip="decide" hidden></div><aside class="rb-decide"><button type="button" data-key="layout-change">Change layout</button></aside></div>
    <nav class="rb-strip"><button type="button" class="rb-thumb-layout" data-layout-of="s">Pill</button><div role="option" tabindex="0" class="rb-thumb-pick">Slide</div></nav>
    <aside class="rb-report" hidden></aside><footer class="rb-foot"></footer><p class="rb-status"></p>
  </div></div>`;
  const q = (selector: string): HTMLElement => {
    const found = document.querySelector<HTMLElement>(selector);
    assert.ok(found, selector);
    return found;
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
  rb.controller = stubController(state, calls);
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
    rb.compare.render();
    rb.decide.render();
  };
  rb.select = (next) => {
    rb.sel = { ...rb.sel, ...next };
    rb.render();
  };
  rb.announce = (message) => { said.push(message); };
  rb.foot = { wire() {}, render() {}, say: (message: string) => { said.push(message); } } as RbCtx['foot'];
  rb.decide = {
    wire() {},
    // The column's render ends by letting the chooser put its preview in the pane.
    render: () => rb.chooser.sync(),
    announceOutcome: (outcome: RebrandEditOutcomeV1, success: string) => { said.push(outcome.ok ? success : 'refused'); },
    openSheet() {},
    headName: () => '',
    chooserOpen: () => rb.chooser.isOpen(),
    closeChooser: () => rb.chooser.close(),
    sheetOpen: () => false,
    closeSheet() {},
  } as RbCtx['decide'];
  // The filmstrip's focus call is recorded and done on the one thumbnail the page holds.
  rb.strip = {
    wire() {},
    render() {},
    focus: (slideId: string) => {
      said.push(`focus:${slideId}`);
      document.querySelector<HTMLElement>('.rb-thumb-pick')?.focus();
    },
  } as RbCtx['strip'];
  rb.queue = queueOps(rb);
  rb.compare = compareOps(rb);
  rb.chooser = chooserOps(rb);
  rb.compare.wire();
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

async function ready(state: RebrandStateV1 = stateFrom()): Promise<Mounted> {
  const mounted = mount(state);
  for (let i = 0; i < 100 && !mounted.rb.chooser.master(); i += 1) await wait(5);
  assert.ok(mounted.rb.chooser.master(), 'the design system resolves');
  return mounted;
}

function pop(): HTMLElement {
  const found = document.querySelector<HTMLElement>('.rb-lc-pop');
  assert.ok(found, 'the popover is open');
  return found;
}

function tiles(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.arch-tile')];
}

function pressEscape(from: Element): void {
  from.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

function preview(rb: RbCtx): HTMLElement | null {
  return rb.els.compare.querySelector<HTMLElement>('[data-chooser-preview]');
}

/** The Proposed pane's caption row, where the preview names itself. */
function caption(rb: RbCtx): HTMLElement | null {
  return rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] .rb-pane-cap');
}

// ─── one popover, four ways in ───────────────────────────────────────────────

test('every entry opens the same popover, titled for its slide, and Escape gives the focus back to the opener', async () => {
  const { rb, unmount } = await ready();
  const second = RUN.plan.slides[1]?.id;
  assert.ok(second);
  const change = rb.els.decide.querySelector<HTMLElement>('[data-key="layout-change"]');
  const pill = rb.els.strip.querySelector<HTMLElement>('.rb-thumb-layout');
  assert.ok(change && pill);
  for (const [entry, opener] of [['inline', change], ['chip', pill], ['menu', pill]] as const) {
    opener.focus();
    rb.chooser.open([second], entry, opener);
    const box = pop();
    assert.equal(box.getAttribute('role'), 'dialog', entry);
    assert.equal(box.querySelector('.rb-lc-pop-title')?.textContent, 'Change layout');
    assert.equal(document.getElementById(box.getAttribute('aria-labelledby') ?? '')?.textContent, 'Change layout', 'named by its heading');
    assert.equal(box.querySelector('.rb-lc-pop-subject')?.textContent, 'Slide 2');
    assert.equal(rb.sel.slideId, second, 'the slide it is for is the one on screen');
    assert.equal(rb.els.decide.querySelector('.arch-chooser'), null, `${entry}: nothing unfolds in the column`);
    assert.equal(rb.chooser.popoverOpen(), true);
    pressEscape(tiles(box)[0] ?? box);
    assert.equal(document.querySelector('.rb-lc-pop'), null, `${entry}: Escape closes it`);
    assert.equal(document.activeElement, opener, `${entry}: the focus goes back to what opened it`);
  }
  // The L key has no element to hang it from: the focus goes back to what had it.
  const thumb = rb.els.strip.querySelector<HTMLElement>('.rb-thumb-pick');
  assert.ok(thumb);
  thumb.focus();
  rb.chooser.open([second], 'menu');
  pressEscape(tiles(pop())[0] ?? pop());
  assert.equal(document.activeElement, thumb, 'L: the focus goes back to the thumbnail');
  // A selection is named by its count.
  const [a, b, c] = RUN.plan.slides.map((slide) => slide.id);
  assert.ok(a && b && c);
  rb.chooser.open([a, b, c], 'menu');
  assert.equal(pop().querySelector('.rb-lc-pop-subject')?.textContent, '3 slides');
  assert.equal(pop().querySelector('[data-band="lead"] .arch-band-name')?.textContent, 'These 3 slides');
  rb.chooser.close(false);
  unmount();
});

test('a pick applies as one command, closes the popover and gives the focus back to Change layout', async () => {
  const { rb, calls, said, unmount } = await ready();
  const first = RUN.plan.slides[0]?.id;
  const change = rb.els.decide.querySelector<HTMLElement>('[data-key="layout-change"]');
  assert.ok(first && change);
  change.focus();
  rb.chooser.open([first], 'inline', change);
  tiles(pop()).find((tile) => tile.dataset.layout === 'columns-4')?.click();
  await wait();
  assert.deepEqual(calls.filter((call) => call.name === 'setLayout'), [{ name: 'setLayout', args: [[first], 'columns-4'] }]);
  assert.equal(document.querySelector('.rb-lc-pop'), null);
  assert.equal(document.activeElement, change);
  assert.match(said.at(-1) ?? '', /^Slide 1 now uses the Four boxes layout\.$/);
  unmount();
});

// ─── the tiles ───────────────────────────────────────────────────────────────

test('one tile rule: flat tiles, the current one ringed and tinted with a check in its caption, no dash and no card', async () => {
  const css = readFileSync(CSS, 'utf8');
  const rule = (selector: string): string => {
    const at = css.indexOf(`\n  ${selector} {`);
    return at < 0 ? '' : css.slice(at, css.indexOf('}', at) + 1);
  };
  assert.doesNotMatch(css, /(border|outline)[\w-]*:[^;]*dashed/u, 'no dashed edge anywhere in the chooser');
  assert.match(rule('.arch-tile'), /border: 0;[\s\S]*background: transparent;/u, 'flat on its surface');
  // The rings are the selection-ring effect roles (tokens.css): 2px at 40% on hover, full strength when current.
  assert.match(rule('.arch-tile:hover'), /box-shadow: var\(--ui-effect-selection-ring-hover\)/u, 'hover is the faint ring');
  assert.match(rule('.arch-tile[aria-current="true"]'), /box-shadow: var\(--ui-effect-selection-ring\);[\s\S]*background: var\(--ui-color-selection-surface\);/u);
  assert.doesNotMatch(rule('.rb-lc-preview-label'), /border:/u, 'the preview pill is the tint alone');
  assert.equal(css.includes('.rb-lc-now') || css.includes('.rb-lc-mount') || /\.rb-lc [.a-z]/u.test(css), false, 'the inline chooser\'s rules are gone');
  // Reduced motion, from the system and from the app's own preference.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.arch-tile \{ transition: none; \}/u);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.arch-tile \{ transition: none; \}/u);

  const { rb, unmount } = await ready();
  const first = RUN.plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  const all = tiles(pop());
  const current = all.filter((tile) => tile.getAttribute('aria-current') === 'true');
  assert.equal(current.length, 1, 'one current tile');
  const cap = current[0]?.querySelector('.arch-cap');
  assert.ok(cap?.querySelector('svg'), 'a check in the caption line');
  assert.equal(cap?.textContent, 'Current');
  assert.equal(pop().querySelector('.arch-more, .arch-badge-current'), null, 'no caption line under the name for the count, and no corner disc');
  for (const tile of all) {
    const name = tile.querySelector('.arch-name');
    assert.ok(name?.closest('.arch-line'), `${tile.dataset.key}: the name is on the one name line`);
    assert.ok(tile.title.startsWith(name?.textContent ?? '!'), `${tile.dataset.key}: the whole name is its hover text`);
  }
  rb.chooser.close(false);
  unmount();
});

test('"This slide" leads: Original arrangement, then Keep as a picture with its badge, then the current layout', async () => {
  const { rb, calls, said, unmount } = await ready();
  const first = RUN.plan.slides[0];
  assert.ok(first);
  rb.chooser.open([first.id], 'menu');
  const lead = pop().querySelector<HTMLElement>('[data-band="lead"]');
  assert.ok(lead);
  assert.equal(lead.querySelector('.arch-band-name')?.textContent, 'This slide');
  const shown = tiles(lead);
  assert.deepEqual(shown.slice(0, 2).map((tile) => tile.querySelector('.arch-name')?.textContent), ['Original arrangement', 'Keep as a picture']);
  assert.equal(shown[0]?.querySelector('.arch-badge'), null, 'Original arrangement carries no badge');
  const badge = shown[1]?.querySelector('.arch-badge');
  assert.ok(badge?.querySelector('svg'), 'Keep as a picture carries the picture badge');
  assert.equal(badge?.getAttribute('aria-hidden'), 'true', 'the badge is for the eye; the name says it');
  assert.equal(shown[2]?.getAttribute('aria-current'), 'true', 'then the layout the slide uses now');
  assert.equal(lead.querySelector('.arch-note'), null, 'no sentence under the group: each tile carries its own as its description');
  shown[1]?.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'setArrangement')?.args, [[first.id], 'picture']);
  assert.ok(said.includes('Slide 1 is kept as a picture.'), said.join(' | '));
  unmount();
});

test('the continuation count is a suffix on the name, shown only where it differs from the current layout', async () => {
  assert.deepEqual(continuationMark(0, 0), { text: '', describe: '' });
  assert.deepEqual(continuationMark(2, 0), { text: '+2', describe: 'Continues on 2 more slides.' });
  assert.deepEqual(continuationMark(1, 1), { text: '', describe: 'Continues on 1 more slide.' }, 'the same as now: the words stay, the suffix goes');
  assert.deepEqual(continuationMark(1, 2), { text: '+1', describe: 'Continues on 1 more slide.' });

  const { rb, unmount } = await ready();
  const first = RUN.plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  let heard: HTMLElement[] = [];
  for (let i = 0; i < 80; i += 1) {
    heard = [...pop().querySelectorAll<HTMLElement>('.arch-more-said')].filter((one) => one.textContent);
    if (heard.length > 0 && pop().querySelector('.arch-count:not([hidden])')) break;
    await wait(10);
  }
  const suffixes = [...pop().querySelectorAll<HTMLElement>('.arch-count:not([hidden])')];
  assert.ok(suffixes.length > 0, 'some layout continues this slide');
  const current = tiles(pop()).find((tile) => tile.getAttribute('aria-current') === 'true');
  assert.equal(current?.querySelector<HTMLElement>('.arch-count')?.hidden, true, 'the current layout carries none');
  for (const suffix of suffixes) {
    assert.match(suffix.textContent ?? '', /^\+\d+$/u);
    assert.equal(suffix.getAttribute('aria-hidden'), 'true', 'for the eye: a screen reader hears the words');
    const tile = suffix.closest<HTMLElement>('.arch-tile');
    const said = (tile?.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
    assert.match(said, /Continues on \d+ more slides?\./u);
    assert.match(tile?.title ?? '', /Continues on \d+ more slides?\.$/u, 'and the hover text says it in words');
  }
  rb.chooser.close(false);
  unmount();
});

// ─── Auto-match ──────────────────────────────────────────────────────────────

/** Five slides read by the matcher: three as three boxes, one only likely, and two as four boxes. */
function matchPlan(): RenovationPlanV1 {
  return withSlides((slide, i) => {
    if (i < 3) return readAs(slide, 'columns-3', i === 2 ? 'likely' : 'clear');
    if (i < 5) return readAs(slide, 'columns-4', 'clear');
    return { ...slide, layoutSource: 'user' };
  });
}

test('the tally counts the layouts Auto-match would set, with units, summing to the number on the button', async () => {
  const plan = matchPlan();
  const { rb, unmount } = await ready(stateFrom(plan));
  const counts = rb.chooser.autoMatchCounts();
  const engine = autoMatchCount(plan, RUN.deck, RUN.census, { bands: 'likely', master: rb.chooser.master() ?? STARTER_MASTER });
  assert.deepEqual([counts.count, counts.likely, counts.anyMatch, counts.tooSmall], [engine.count, engine.likely, engine.anyMatch, engine.capacity], 'the engine\'s own count');
  const by = counts.byLayout ?? [];
  assert.equal(by.reduce((sum, row) => sum + row.count, 0), counts.count, 'the tally sums to the count');
  assert.deepEqual(by.map((row) => row.count), [...by.map((row) => row.count)].sort((a, b) => b - a), 'most first');
  assert.ok(by.length >= 2, `two layouts: ${JSON.stringify(by)}`);

  const first = plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  const row = pop().querySelector<HTMLElement>('.rb-lc-auto-row');
  assert.ok(row, 'the Auto-match row');
  const search = pop().querySelector('.arch-search-row');
  const groups = pop().querySelector('.arch-groups');
  assert.ok(search && groups);
  assert.equal(search.compareDocumentPosition(row) & window.Node.DOCUMENT_POSITION_FOLLOWING, window.Node.DOCUMENT_POSITION_FOLLOWING, 'under the search');
  assert.equal(row.compareDocumentPosition(groups) & window.Node.DOCUMENT_POSITION_FOLLOWING, window.Node.DOCUMENT_POSITION_FOLLOWING, 'over the tiles');
  const items = [...row.querySelectorAll<HTMLElement>('.rb-lc-tally-item')];
  assert.equal(items.length, by.length);
  const shown = items.map((item) => item.querySelector('.rb-lc-tally-count')?.textContent ?? '');
  for (const words of shown) assert.match(words, /^(1 slide|\d+ slides)$/u, 'each count carries its unit');
  assert.equal(shown.reduce((sum, words) => sum + Number.parseInt(words, 10), 0), counts.count);
  for (const item of items) {
    const art = item.querySelector('svg')?.outerHTML ?? '';
    assert.ok(art, 'a wireframe');
    assert.equal(art.includes('arch-mark'), false, 'small enough to draw no plus');
  }
  const tally = row.querySelector<HTMLElement>('.rb-lc-tally');
  assert.equal(tally?.getAttribute('role'), 'img');
  assert.match(tally?.title ?? '', /^Three boxes, \d+ slides?\. Four boxes, \d+ slides?\.$/u, 'the whole row is titled in words');
  assert.equal(tally?.getAttribute('aria-label'), tally?.title);
  const button = row.querySelector<HTMLElement>('[data-key="layout-pop-auto"]');
  assert.equal(button?.textContent, `Match ${counts.count} slides`);
  assert.equal(button?.title, likelyTitle(counts));
  assert.equal(likelyTitle({ count: 5, likely: 1, anyMatch: true }), '1 of the 5 is a likely match. Check it after.');
  assert.equal(likelyTitle({ count: 8, likely: 3, anyMatch: true }), '3 of the 8 are likely matches. Check them after.');
  assert.equal(likelyTitle({ count: 8, likely: 0, anyMatch: true }), '', 'clear matches need no words');
  rb.chooser.close(false);
  unmount();
});

test('resting on Match previews the slide on screen under its match, writes nothing, and Escape restores', async () => {
  const plan = matchPlan();
  const { rb, calls, unmount } = await ready(stateFrom(plan));
  const first = plan.slides[0]?.id;
  assert.ok(first);
  const holder = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"] [data-frames]');
  assert.ok(holder, 'the Proposed pane');
  rb.chooser.open([first], 'menu');
  const button = pop().querySelector<HTMLElement>('[data-key="layout-pop-auto"]');
  assert.ok(button);
  button.dispatchEvent(new window.Event('pointerenter'));
  await wait(PREVIEW_DELAY_MS + 60);
  const pill = caption(rb)?.querySelector<HTMLElement>('[data-chooser-label]');
  assert.match(pill?.textContent ?? '', /^Preview: Three boxes$/u, 'the match the slide would get, named in the caption row');
  assert.equal(pill?.previousElementSibling?.tagName, 'STRONG', 'right after "Proposed", in place of the layout name');
  assert.ok(caption(rb)?.hasAttribute('data-chooser-previewing'), 'the caption\'s own parts step aside');
  assert.equal(preview(rb)?.querySelector('.rb-lc-preview-label'), null, 'nothing above the hero');
  assert.ok(preview(rb)?.querySelector('.rb-art svg'), 'a compiled slide');
  assert.equal(holder.hidden, true);
  button.dispatchEvent(new window.Event('pointerleave'));
  await wait(PREVIEW_DELAY_MS + 60);
  assert.equal(preview(rb), null, 'leaving restores');
  button.focus();
  await wait(PREVIEW_DELAY_MS + 60);
  assert.ok(preview(rb), 'the focus previews too');
  pressEscape(button);
  assert.equal(document.querySelector('.rb-lc-pop'), null);
  assert.equal(preview(rb), null, 'Escape restores the committed slide');
  assert.equal(holder.hidden, false);
  assert.equal(caption(rb)?.querySelector('[data-chooser-part]'), null, 'and the caption is compare\'s again');
  assert.equal(caption(rb)?.hasAttribute('data-chooser-previewing'), false);
  await wait(PREVIEW_DELAY_MS + 60);
  assert.equal(preview(rb), null, 'and nothing comes back after');
  assert.equal(calls.length, 0, 'nothing written');
  unmount();
});

test('once every slide uses its match, Match is retired in place with its reason, and does nothing', async () => {
  const plan = withSlides((slide, i) => (i < 3
    ? { ...readAs(slide, 'columns-3', 'clear'), layout: 'columns-3' }
    : { ...slide, layoutSource: 'user' }));
  const { rb, calls, unmount } = await ready(stateFrom(plan));
  const counts = rb.chooser.autoMatchCounts();
  assert.equal(counts.count, 0);
  assert.equal(counts.settled, 3);
  rb.chooser.open([plan.slides[0]!.id], 'menu');
  const row = pop().querySelector<HTMLElement>('.rb-lc-auto-row');
  const button = row?.querySelector<HTMLElement>('[data-key="layout-pop-auto"]');
  assert.ok(button);
  assert.equal(button.textContent, 'Layouts match');
  assert.equal(button.getAttribute('aria-disabled'), 'true', 'reachable, and says it cannot run');
  assert.equal(document.getElementById(button.getAttribute('aria-describedby') ?? '')?.textContent, 'All 3 slides already use their suggested layout.');
  assert.equal(row?.querySelector('.rb-lc-tally'), null, 'nothing to tally');
  button.click();
  await wait();
  assert.equal(calls.length, 0);
  assert.equal(settledText({ count: 0, likely: 0, anyMatch: true, settled: 1 }), '1 slide already uses its suggested layout.');
  rb.chooser.close(false);
  unmount();
});

test('with no command there is no row, and after a run the popover counts again and keeps the focus', async () => {
  const plan = matchPlan();
  const bare = await ready(stateFrom(plan));
  delete bare.rb.controller.autoMatchLayouts;
  bare.rb.chooser.open([plan.slides[0]!.id], 'menu');
  assert.equal(pop().querySelector('.rb-lc-auto-row'), null);
  bare.unmount();

  const { rb, calls, said, unmount } = await ready(stateFrom(plan));
  rb.chooser.open([plan.slides[0]!.id], 'menu');
  const button = pop().querySelector<HTMLElement>('[data-key="layout-pop-auto"]');
  assert.ok(button);
  button.focus();
  button.click();
  await wait();
  assert.deepEqual(calls.find((call) => call.name === 'autoMatchLayouts')?.args, ['likely']);
  assert.match(said.at(-1) ?? '', /^Matched /u);
  assert.equal(document.activeElement?.getAttribute('data-key'), 'layout-pop-auto', 'the focus stays on Match after the redraw');
  rb.chooser.close(false);
  unmount();
});

// ─── the design system's faces (close-out 9.2) ───────────────────────────────

test('every proposed drawing is set in the design system\'s faces, and waits for them to load', async () => {
  const waiting: RebrandStateV1 = Object.assign(stateFrom(), { fontsReady: false });
  const { rb, unmount } = await ready(waiting);
  const first = RUN.plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  const tile = tiles(pop()).find((one) => one.dataset.layout === 'columns-4');
  assert.ok(tile);
  tile.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  await wait(PREVIEW_DELAY_MS + 60);
  const early = preview(rb);
  assert.ok(early, 'the preview shows while the faces load');
  assert.equal(early.querySelector('.arch-thumb') !== null, true, 'as the wireframe, not a compile in a fallback face');
  assert.equal(early.innerHTML.includes('font-family'), false);
  const lead = tiles(pop()).find((one) => one.dataset.leading === 'original');
  assert.equal(lead?.querySelector('text'), null, 'the arrangement tile waits too');

  rb.state = Object.assign(stateFrom(), { fontsReady: true });
  rb.render();
  tiles(pop()).find((one) => one.dataset.layout === 'columns-4')?.dispatchEvent(new window.Event('pointerover', { bubbles: true }));
  await wait(PREVIEW_DELAY_MS + 60);
  const drawn = preview(rb)?.innerHTML ?? '';
  assert.ok(drawn.includes('<text'), 'a compiled slide with its words');
  const families = [...drawn.matchAll(/font-family="([^"]+)"/gu)].map((m) => m[1]);
  assert.ok(families.length > 0);
  for (const family of families) assert.match(family ?? '', /^(Brandface Sans|Brandface Mono)/u, 'only the design system\'s faces');
  const art = tiles(pop()).find((one) => one.dataset.leading === 'original')?.querySelector('svg')?.outerHTML ?? '';
  for (const m of art.matchAll(/font-family="([^"]+)"/gu)) assert.match(m[1] ?? '', /^Brandface/u, 'the arrangement tile too');
  rb.chooser.close(false);
  unmount();
});

test('from the search field, Down reaches the results and Enter picks the one layout a search leaves', async () => {
  const { rb, calls, unmount } = await ready();
  const first = RUN.plan.slides[0]?.id;
  assert.ok(first);
  rb.chooser.open([first], 'menu');
  const search = pop().querySelector<HTMLInputElement>('.arch-search');
  assert.ok(search);
  search.focus();
  const key = (name: string): KeyboardEvent => {
    const ev = new window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
    search.dispatchEvent(ev);
    return ev;
  };
  search.value = 'quote';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  const shown = tiles(pop());
  assert.equal(shown.length, 1, `one layout left: ${shown.map((one) => one.dataset.layout).join(', ')}`);
  assert.equal(key('ArrowDown').defaultPrevented, true);
  assert.equal(document.activeElement, shown[0], 'Down goes to the first result');
  assert.equal(shown[0]?.tabIndex, 0, 'which is the list\'s Tab stop');
  const layout = shown[0]?.dataset.layout ?? '';
  const name = shown[0]?.querySelector('.arch-name')?.textContent ?? '';
  await wait(PREVIEW_DELAY_MS + 60);
  assert.equal(caption(rb)?.querySelector('[data-chooser-label]')?.textContent, `Preview: ${name}`, 'a focused tile previews, as a rested one does');
  search.focus();
  key('Enter');
  await wait();
  assert.deepEqual(calls.filter((call) => call.name === 'setLayout'), [{ name: 'setLayout', args: [[first], layout] }]);
  assert.equal(document.querySelector('.rb-lc-pop'), null);

  // With more than one result Enter picks nothing.
  rb.chooser.open([first], 'menu');
  const again = pop().querySelector<HTMLInputElement>('.arch-search');
  assert.ok(again);
  again.value = 'box';
  again.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(tiles(pop()).length > 1);
  again.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await wait();
  assert.equal(calls.filter((call) => call.name === 'setLayout').length, 1, 'no second pick');
  rb.chooser.close(false);
  unmount();
});

test('a pick from the filmstrip whose opener a redraw took away leaves the focus on the slide\'s thumbnail', async () => {
  const { rb, said, unmount } = await ready();
  const first = RUN.plan.slides[0]?.id;
  const pill = rb.els.strip.querySelector<HTMLElement>('.rb-thumb-layout');
  assert.ok(first && pill);
  pill.focus();
  rb.chooser.open([first], 'chip', pill);
  // The strip draws its tiles again for the new plan: the pill the popover returns to is gone.
  pill.remove();
  tiles(pop()).find((tile) => tile.dataset.layout === 'columns-4')?.click();
  await wait();
  assert.ok(said.includes(`focus:${first}`), said.join(' | '));
  assert.equal(document.activeElement, rb.els.strip.querySelector('.rb-thumb-pick'), 'never left on the page');
  unmount();
});

test('the Match button is the queue\'s plain ghost button, with no glyph of its own', async () => {
  const plan = matchPlan();
  const { rb, unmount } = await ready(stateFrom(plan));
  rb.chooser.open([plan.slides[0]!.id], 'menu');
  const button = pop().querySelector<HTMLElement>('[data-key="layout-pop-auto"]');
  assert.ok(button);
  assert.equal(button.className, 'btn btn--ghost btn--sm rb-lc-auto-btn');
  assert.equal(button.querySelector('svg'), null);
  rb.chooser.close(false);
  unmount();
});
