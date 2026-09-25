// SPDX-License-Identifier: MPL-2.0
/**
 * The deck theme (plan 275 close-out section 3.10, package CP5b) against the real
 * module, over a real plan of tests/fixtures/rebrand/formatting.pptx and a design
 * system read through the same readers the view uses (a host whose tokens are the
 * lolly-start pack, or that pack with brand hues added).
 *
 * What is pinned: the theme has one home, the popover, opened from the top-bar control
 * and from the door in the column's Background section; the column holds only the
 * folded Background section (its flag, the per-slide segment and the door); the tiles
 * follow the one tile rule (ring, tint and a check in the caption line, no corner
 * disc); the note states a problem only and carries the alert glyph; the look tiles
 * carry one line under their row; a controller that cannot apply a theme leaves the
 * tiles `aria-disabled` with one line; Brand colour's hues draw as swatches.
 *
 * The controller is a stub that records each command, so these tests pin which command
 * a control sends and with what, and what the view says afterwards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildDeckTheme, compileRenovated, createTokenSet, setDeckTheme } from '@lolly/engine';
import { compileSystemOpts } from '../../../../../engine/src/deck-compile.ts';
import type { CompiledDeckV1, DeckThemeV1, RenovationPlanV1, SlideGroundV1 } from '@lolly-tools/core/rebrand-v1';
import { STARTER_DESIGN_SYSTEM, runRebrandPipeline, type RebrandRunV1 } from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type { CompileStageInputV1, RebrandControllerV1, RebrandEditOutcomeV1, RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';
import type { ThemeTileRequestV1 } from '../../lib/rebrand/stage-rebrand.ts';
import { decodeBudgetFor } from '../../lib/rebrand/budget.ts';
import type { StageRunCtxV1 } from '../../lib/rebrand/stage-core.ts';
import type { RbCtx } from './context.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const key of [
  'window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'Event',
  'KeyboardEvent', 'MouseEvent', 'FocusEvent', 'PointerEvent', 'DOMParser', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
]) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}

const { deriveReview } = await import('./shared.ts');
const { themeOps, contrastSentence, hueName, setThemeTileRunnerForTest, THEME_THUMB_WIDTH } = await import('./theme.ts');
const { compileStage } = await import('../../lib/rebrand/stage-rebrand.ts');

const FIXTURE = new URL('../../../../../tests/fixtures/rebrand/formatting.pptx', import.meta.url);
const TOKENS_TEXT = readFileSync(new URL('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8');
const TOKENS = JSON.parse(TOKENS_TEXT) as unknown;
const RUN: RebrandRunV1 = await runRebrandPipeline('formatting.pptx', new Uint8Array(readFileSync(FIXTURE)));
const CSS = readFileSync(new URL('../../styles/parts/rebrand-theme.css', import.meta.url), 'utf8');

/**
 * The starter pack with three brand hues added and the primary moved onto the green, so
 * Brand colour is offered and more than one hue can carry it (plan 275 decision 33d).
 */
function chromaTokens(): unknown {
  const doc = JSON.parse(TOKENS_TEXT) as {
    base: { color: Record<string, unknown> };
    light: { color: { semantic: Record<string, { $value: string }> } };
  };
  doc.base.color.brand = {
    jungle: { $value: '#1f6b46' },
    waterhole: { $value: '#1d3fcc' },
    persimmon: { $value: '#b3401a' },
  };
  doc.light.color.semantic.primary = { $value: '{color.brand.jungle}' };
  return doc;
}

/** A host whose tokens are the given pack, light and dark (or light only), and whose registry says whether the design system is locked. */
function starterHost(locked: boolean, dark = true, tokens: unknown = TOKENS): RbCtx['host'] {
  const host = {} as RbCtx['host'];
  Reflect.set(host, 'tokens', {
    get: async (opts: { theme?: string } = {}) => createTokenSet(tokens, opts.theme ? { theme: opts.theme } : {}),
    themes: async () => (dark ? createTokenSet(tokens).themes() : []),
    activeRecord: async () => ({ id: 'lolly/start', label: 'Lolly start', headId: 'x', locked, source: { kind: 'shipped' } }),
  });
  return host;
}

function stateFrom(): RebrandStateV1 {
  return {
    phase: 'review',
    mode: 'renovate',
    progress: null,
    error: null,
    project: null,
    source: RUN.deck,
    census: RUN.census,
    plan: RUN.plan,
    faithful: null,
    preview: null,
    previewStale: false,
    designSystem: { id: 'lolly/start', name: 'Lolly start', neutralMaster: true, hasLogo: false, archetypes: [], colors: {}, fonts: [] },
    save: { kind: 'none' },
    history: { canUndo: false, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 1,
  };
}

interface Call { name: string; args: unknown[] }
interface Said { text: string; undo: boolean }
const OK: RebrandEditOutcomeV1 = { ok: true, touched: 1, skipped: 0 };
const NOT_BUILT: RebrandEditOutcomeV1 = { ok: false, touched: 0, skipped: 0, refusal: 'not-built' };

interface Mounted {
  rb: RbCtx;
  calls: Call[];
  /** What went through the live region alone (refusals, not-built). */
  announced: string[];
  /** What the footer's outcome line said, with whether it offered Undo. */
  said: Said[];
  style: HTMLElement;
  top: HTMLElement;
}

interface MountOpts {
  locked?: boolean;
  commands?: 'ok' | 'not-built' | 'absent';
  plan?: RenovationPlanV1;
  dark?: boolean;
  tokens?: unknown;
  narrow?: boolean;
  mode?: RebrandStateV1['mode'];
  /** Slides selected beside the current one, as the strip's multi-selection holds them. */
  many?: number;
  /** A project is open, so the popover compiles its tiles. */
  project?: boolean;
  /** The Proposed pane's drawing, as the controller holds it. */
  preview?: RebrandStateV1['preview'];
  /** Whether the design system's faces are loaded. Default true. */
  facesReady?: boolean;
}

/** The two mount points, the context and the theme module; `decide.render` redraws the Style section the way the column does. */
function mount(opts: MountOpts = {}): Mounted {
  document.querySelectorAll('.rb-theme-pop').forEach((one) => { one.remove(); });
  document.body.innerHTML = '<div class="rb"><header class="rb-top"><div class="rb-top-theme" data-top hidden></div></header><aside class="rb-decide"><div data-style-mount></div></aside></div>';
  const style = document.querySelector<HTMLElement>('[data-style-mount]');
  const top = document.querySelector<HTMLElement>('[data-top]');
  assert.ok(style && top);
  const calls: Call[] = [];
  const announced: string[] = [];
  const said: Said[] = [];
  const answer = opts.commands === 'not-built' ? NOT_BUILT : OK;
  const record = (name: string) => async (...args: unknown[]): Promise<RebrandEditOutcomeV1> => {
    calls.push({ name, args });
    return answer;
  };
  const controller = { getState: () => rb.state, mediaHref: () => undefined } as unknown as RebrandControllerV1;
  if (opts.commands !== 'absent') {
    controller.setTheme = record('setTheme');
    controller.setGround = record('setGround');
  }
  const rb = {} as RbCtx;
  rb.host = starterHost(opts.locked === true, opts.dark !== false, opts.tokens);
  rb.controller = controller;
  rb.state = {
    ...stateFrom(),
    ...(opts.plan ? { plan: opts.plan } : {}),
    ...(opts.mode ? { mode: opts.mode } : {}),
    ...(opts.project ? { project: { id: 'p1' } as RebrandStateV1['project'] } : {}),
    ...(opts.preview ? { preview: opts.preview } : {}),
  };
  const faces = { ready: opts.facesReady !== false };
  rb.compare = { fontsReady: () => faces.ready, fonts: () => ({ brand: 'Outfit' }) } as unknown as RbCtx['compare'];
  rb.derived = deriveReview(rb.state, null);
  const current = RUN.plan.slides[1]?.id ?? null;
  const many = opts.many ? new Set(RUN.plan.slides.slice(1, 1 + opts.many).map((one) => one.id)) : undefined;
  rb.sel = { slideId: current, objectId: null, itemId: null, ...(many ? { selSlides: many } : {}) } as RbCtx['sel'];
  rb.memo = {};
  rb.disposers = [];
  rb.narrow = opts.narrow === true;
  rb.medium = false;
  rb.announce = (message) => { announced.push(message); };
  rb.foot = { say: (text: string, o: { undo?: boolean } = {}) => { said.push({ text, undo: o.undo === true }); } } as unknown as RbCtx['foot'];
  rb.decide = { render: () => rb.theme.renderStyle(style) } as RbCtx['decide'];
  rb.theme = themeOps(rb);
  rb.theme.renderStyle(style);
  rb.theme.renderControl(top);
  return { rb, calls, announced, said, style, top };
}

/** Let the design system read finish and the redraw after it run. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => { setTimeout(resolve, 0); });
};

const tiles = (root: ParentNode): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('.rb-theme-tile')];
const popover = (): HTMLElement | null => document.querySelector<HTMLElement>('.rb-theme-pop');

/** Open the popover from the top-bar control and wait for its tiles. */
async function openFromTop(m: Mounted): Promise<HTMLElement> {
  await settle();
  m.top.querySelector<HTMLButtonElement>('.rb-theme-btn')?.click();
  await settle();
  const pop = popover();
  assert.ok(pop, 'the popover opens');
  return pop;
}

/** Close whatever popover a test left open, so the next mount starts clean. */
function closePopover(): void {
  document.activeElement?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  popover()?.remove();
}

// ─── one home ────────────────────────────────────────────────────────────────

test('the column holds only the folded Background section: its flag, then the segment and the door once opened', async () => {
  const { style } = mount();
  await settle();
  const section = style.querySelector<HTMLElement>('section.lp-sec[data-sec="background"]');
  assert.ok(section, 'one Background section');
  assert.equal(tiles(style).length, 0, 'no theme tile in the column');
  const head = section.querySelector<HTMLButtonElement>('.lp-sec-head');
  assert.ok(head);
  assert.equal(head.getAttribute('aria-expanded'), 'false', 'folded at rest');
  assert.equal(head.querySelector('.lp-sec-name')?.textContent, 'Background');
  assert.equal(head.querySelector('.lp-sec-flag')?.textContent, 'Light', 'the flag says the state');
  assert.ok(head.querySelector('.lp-caret'), 'a fold carries the caret');
  assert.equal(head.hasAttribute('aria-haspopup'), false, 'a fold opens in place');
  const rows = section.querySelector<HTMLElement>('.lp-rows');
  assert.equal(rows?.hidden, true);
  head.click();
  const again = style.querySelector<HTMLElement>('section[data-sec="background"]');
  assert.equal(again?.querySelector('.lp-sec-head')?.getAttribute('aria-expanded'), 'true');
  assert.equal(again?.querySelector<HTMLElement>('.lp-rows')?.hidden, false);
  const seg = again?.querySelector<HTMLElement>('.rb-ground-seg');
  assert.ok(seg?.classList.contains('lp-seg'), 'the segment is the panel primitive');
  assert.equal(again?.querySelector('.view-seg-btn'), null, 'never the app segment');
  const door = again?.querySelector<HTMLButtonElement>('[data-theme-door]');
  assert.ok(door?.classList.contains('lp-door'));
  assert.equal(door?.textContent, 'Deck theme: Light');
  assert.equal(door?.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(door?.querySelector('.lp-caret'), null, 'a door never carries a caret');
  assert.ok(door?.querySelector('svg'), 'it carries the arrow');
  assert.equal(again?.querySelectorAll('.lp-help').length, 0, 'no help line for a state that is fine');
});

test('the door opens the same popover the top bar does, and says so while it is open', async () => {
  const m = mount();
  await settle();
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  m.style.querySelector<HTMLButtonElement>('[data-theme-door]')?.click();
  await settle();
  const pop = popover();
  assert.ok(pop);
  assert.equal(pop.getAttribute('role'), 'dialog');
  assert.equal(pop.getAttribute('aria-label'), 'Deck theme');
  assert.ok(tiles(pop).length > 1);
  assert.equal(m.style.querySelector('[data-theme-door]')?.getAttribute('aria-expanded'), 'true');
  closePopover();
  await settle();
  assert.equal(popover(), null);
});

test('a slide with its own background names it in the flag', async () => {
  const slide = RUN.plan.slides[1];
  assert.ok(slide);
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((one) => (one.id === slide.id ? { ...one, ground: 'dark' } : one)) };
  const { style } = mount({ plan });
  await settle();
  assert.equal(style.querySelector('.lp-sec-flag')?.textContent, 'Dark, this slide');
});

test('Keep the design draws no Background section and no theme control', async () => {
  const { style, top } = mount({ mode: 'keep-design' });
  await settle();
  assert.equal(style.children.length, 0);
  assert.equal(top.hidden, true);
});

// ─── the tiles ───────────────────────────────────────────────────────────────

test('the popover shows Light and Dark, then the looks, each with the first slide, three colours and a name', async () => {
  const m = mount();
  const pop = await openFromTop(m);
  const keys = tiles(pop).map((tile) => tile.dataset.themeKey);
  // The starter pack is achromatic and its primary is its Dark ground, so it offers no
  // Brand colour tile: that tile would be the Dark tile again.
  assert.deepEqual(keys.slice(0, 2), ['light', 'dark']);
  assert.ok(keys.slice(2).every((key) => key?.startsWith('look:')), 'the looks follow');
  assert.ok(keys.length > 2, 'an unlocked design system offers its looks');
  assert.equal(pop.querySelectorAll('[role="group"]').length, 2, 'the themes and the looks are two groups');
  for (const tile of tiles(pop)) {
    assert.equal(tile.getAttribute('role'), null, 'a button, pressed when applied');
    assert.ok(tile.hasAttribute('aria-pressed'));
    assert.equal(tile.querySelector('.rb-theme-thumb')?.getAttribute('data-theme-art'), 'wireframe', 'no project open, so nothing compiles');
    assert.equal(tile.querySelectorAll('.rb-theme-sw').length, 3, 'three colours');
    const svg = tile.querySelector('svg');
    assert.equal(svg?.getAttribute('width'), String(THEME_THUMB_WIDTH), 'a 96 px wireframe');
    assert.equal(tile.querySelector('.arch-tile, .arch-page'), null, 'the chooser\'s classes are never on a theme tile');
    assert.equal(tile.querySelector('.rb-art-mark'), null, 'the slots stay empty: no plus that reads as an add button');
    // Picture, then colours, then the name: the order the one tile rule reads in.
    const order = [...tile.children].map((one) => one.className);
    assert.deepEqual(order.slice(0, 3), ['rb-theme-thumb', 'rb-theme-sws', 'rb-theme-name']);
  }
  const [light, dark] = tiles(pop);
  assert.ok(light && dark);
  // Ground, ink, accent: the Light tile's first dot is its white page.
  const dots = [...light.querySelectorAll<HTMLElement>('.rb-theme-sw')].map((one) => one.style.getPropertyValue('--sw').toLowerCase());
  assert.equal(dots[0], '#ffffff');
  // The Dark wireframe is drawn in the Dark theme's own colours: its page is the dark
  // surface, and its slots and marks are the theme's ink over it, not the fixed neutrals.
  const page = dark.querySelector('.rb-art-page')?.getAttribute('fill');
  const surface = createTokenSet(TOKENS, { theme: 'dark' }).get('color.semantic.surface')?.value;
  assert.equal(page?.toLowerCase(), String(surface).toLowerCase());
  const fills = [...dark.querySelectorAll('.rb-art-ph')].map((one) => one.getAttribute('fill'));
  assert.ok(fills.length > 0);
  for (const fill of fills) assert.notEqual(fill, '#33373b', 'a slot is not the fixed dark neutral');
  assert.equal(light.querySelector('.rb-art-page')?.getAttribute('fill')?.toLowerCase(), '#ffffff', 'the Light page is the pack\'s own white');
  closePopover();
});

test('the current tile is ringed with the check in its caption line, and only it carries a caption', async () => {
  const m = mount();
  const pop = await openFromTop(m);
  const [light, dark] = tiles(pop);
  assert.ok(light && dark);
  assert.equal(light.getAttribute('aria-pressed'), 'true');
  const cap = light.querySelector('.rb-theme-cap');
  assert.equal(cap?.textContent, 'Current', 'the applied theme says so in words');
  assert.ok(cap?.querySelector('svg'), 'with the check beside them');
  assert.equal(light.lastElementChild, cap, 'the caption line is the last line of the tile');
  assert.equal(dark.getAttribute('aria-pressed'), 'false');
  assert.equal(dark.querySelector('.rb-theme-cap'), null);
  assert.equal(pop.querySelectorAll('.rb-theme-cap').length, 1, 'one Current on screen');
  // The tile rule: ringed and tinted, no corner disc, no dashed edge.
  assert.match(CSS, /\.rb-theme-tile\[aria-pressed="true"\][^{]*\{[^}]*border-color: var\(--ui-color-selection-border\);[^}]*background: var\(--ui-color-selection-surface\);/);
  assert.match(CSS, /\.rb-theme-tile:hover \{ border-color: color-mix\(in srgb, var\(--ui-color-selection-border\) 40%, transparent\); \}/);
  assert.doesNotMatch(CSS, /dashed/);
  closePopover();
});

test('a look the tiles do not list is shown as the current theme by its own name, never as Light', async () => {
  const look = { id: 'example:gone', name: 'Gone', colors: { 'color.semantic.surface': '#f7f5ef', 'color.semantic.text': '#1f2a22' } };
  const theme: DeckThemeV1 = { id: 'look', remap: [{ from: 'color.semantic.surface', to: 'color.semantic.surface' }], lookId: look.id };
  const plan: RenovationPlanV1 = { ...RUN.plan, designSystem: { ...RUN.plan.designSystem, theme } };
  const m = mount({ plan });
  const pop = await openFromTop(m);
  const current = tiles(pop).filter((tile) => tile.getAttribute('aria-pressed') === 'true');
  assert.equal(current.length, 1, 'one tile is current');
  assert.equal(current[0]?.dataset.themeKey, 'look:example:gone');
  assert.equal(document.activeElement, current[0], 'focus opens on it');
  assert.match(current[0]?.textContent ?? '', /Look/);
  const button = m.top.querySelector<HTMLButtonElement>('.rb-theme-btn');
  assert.equal(button?.getAttribute('aria-label'), 'Deck theme: Look', 'the button names the stored theme, not Light');
  closePopover();
});

test('a look on a design system locked since keeps its tile, and the note gives the way back', async () => {
  const theme: DeckThemeV1 = { id: 'look', remap: [], lookId: 'example:orchard' };
  const plan: RenovationPlanV1 = { ...RUN.plan, designSystem: { ...RUN.plan.designSystem, theme } };
  const m = mount({ plan, locked: true });
  const pop = await openFromTop(m);
  const keys = tiles(pop).map((tile) => tile.dataset.themeKey);
  assert.deepEqual(keys, ['light', 'dark', 'look:example:orchard'], 'no look is offered, and the stored one is shown');
  assert.equal(tiles(pop)[2]?.getAttribute('aria-pressed'), 'true');
  const note = pop.querySelector<HTMLElement>('[data-theme-note]');
  assert.equal(document.activeElement instanceof HTMLElement ? document.activeElement.dataset.themeKey : null, 'look:example:orchard', 'focus opens on the applied theme');
  assert.equal(note?.hidden, false);
  assert.equal(note?.textContent, 'This design system is locked, so choose Light to use its own colours instead of Orchard.');
  tiles(pop)[0]?.click();
  await settle();
  assert.deepEqual(m.calls.at(-1), { name: 'setTheme', args: [null] }, 'Light is the way back');
  closePopover();
});

test('a locked design system offers no look, and so no looks line', async () => {
  const m = mount({ locked: true });
  const pop = await openFromTop(m);
  assert.deepEqual(tiles(pop).map((tile) => tile.dataset.themeKey), ['light', 'dark']);
  assert.equal(pop.querySelector('.rb-theme-line'), null);
  closePopover();
});

test('the look tiles carry one line under their row, and no tile repeats it', async () => {
  const m = mount();
  const pop = await openFromTop(m);
  const lines = [...pop.querySelectorAll('.rb-theme-line')];
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.textContent, 'Looks change this project only.');
  assert.ok(lines[0]?.previousElementSibling?.classList.contains('rb-theme-grid--looks'), 'under the looks row');
  for (const tile of tiles(pop).filter((one) => one.dataset.themeKey?.startsWith('look:'))) {
    assert.equal(tile.getAttribute('title'), null, 'no per-tile sentence');
  }
  closePopover();
});

// ─── the note ────────────────────────────────────────────────────────────────

test('the note states a problem only: hidden while quiet, with the alert glyph when it speaks', async () => {
  const m = mount();
  const pop = await openFromTop(m);
  const note = pop.querySelector<HTMLElement>('[data-theme-note]');
  assert.ok(note);
  assert.equal(note.getAttribute('aria-live'), null, 'read on focus as the description, not announced a second time');
  assert.ok(note.querySelector('svg'), 'the note carries the glyph');
  // Each tile in turn: the note either says nothing and is hidden, or says what would be
  // hard to read on that theme.
  let spoke = 0;
  for (const tile of tiles(pop)) {
    assert.equal(tile.getAttribute('aria-describedby'), note.id);
    tile.dispatchEvent(new window.FocusEvent('focusin', { bubbles: true }));
    const text = note.textContent ?? '';
    if (text) {
      spoke += 1;
      assert.equal(note.hidden, false);
      assert.match(text, /^On .+, \d+ texts? would be hard to read\.$/, 'a theme not applied yet names the count alone');
      assert.doesNotMatch(text, /stays readable/, 'never a sentence for a state that is fine');
    } else {
      assert.equal(note.hidden, true, 'the quiet state has no sentence');
    }
  }
  assert.ok(spoke < tiles(pop).length, 'at least one theme is quiet');
  assert.equal(m.calls.length, 0, 'focus alone changes nothing');
  closePopover();
});

test('the contrast sentence is empty when every text reads, and counts otherwise', () => {
  assert.equal(contrastSentence({ textsUnder: 0 }, 'Dark'), '');
  assert.equal(contrastSentence(null, 'Dark'), '');
  assert.equal(contrastSentence({ textsUnder: 1 }, 'Dark'), 'On Dark, 1 text would be hard to read.');
  assert.equal(contrastSentence({ textsUnder: 21 }, 'Brand colour'), 'On Brand colour, 21 texts would be hard to read.');
});

test('a pack with no dark mode says what Dark is made of, as the Dark tile\'s title', async () => {
  const m = mount({ dark: false });
  const pop = await openFromTop(m);
  const dark = tiles(pop).find((one) => one.dataset.themeKey === 'dark');
  assert.equal(dark?.getAttribute('title'), 'This design system has no dark mode, so Dark uses the darkest step of its main colour.');
  assert.equal(tiles(pop).find((one) => one.dataset.themeKey === 'light')?.getAttribute('title'), null);
  closePopover();
});

// ─── applying ────────────────────────────────────────────────────────────────

test('choosing a tile applies it through setTheme as one step and says so with Undo; Light clears the theme', async () => {
  const m = mount();
  let pop = await openFromTop(m);
  tiles(pop)[1]?.click();
  await settle();
  assert.equal(m.calls.length, 1);
  assert.equal(m.calls[0]?.name, 'setTheme');
  const theme = m.calls[0]?.args[0] as DeckThemeV1;
  assert.equal(theme.id, 'dark');
  assert.equal(theme.mode, 'dark', 'the pack\'s own dark mode');
  assert.deepEqual(m.said.at(-1), { text: 'Deck theme: Dark.', undo: true }, 'the footer says it, with Undo');
  assert.deepEqual(m.announced, [], 'and nothing is said a second time');
  // With Dark applied, Light sends null: the master as shipped.
  m.rb.state = { ...m.rb.state, plan: { ...RUN.plan, designSystem: { ...RUN.plan.designSystem, theme } } };
  m.rb.derived = deriveReview(m.rb.state, m.rb.derived);
  closePopover();
  m.rb.theme.renderControl(m.top);
  assert.equal(m.top.querySelector('.rb-theme-btn')?.getAttribute('aria-label'), 'Deck theme: Dark');
  pop = await openFromTop(m);
  assert.equal(tiles(pop)[1]?.getAttribute('aria-pressed'), 'true');
  tiles(pop)[0]?.click();
  await settle();
  assert.deepEqual(m.calls[1], { name: 'setTheme', args: [null] });
  closePopover();
});

test('applying keeps keyboard focus on the tile: the tiles are busy, never disabled, and a second choice waits', async () => {
  const m = mount();
  await settle();
  let release: (() => void) | undefined;
  const calls: unknown[] = [];
  m.rb.controller.setTheme = async (theme) => {
    calls.push(theme);
    await new Promise<void>((resolve) => { release = resolve; });
    return OK;
  };
  const pop = await openFromTop(m);
  const dark = tiles(pop)[1];
  assert.ok(dark);
  dark.focus();
  dark.click();
  await settle();
  assert.equal(pop.querySelector('.rb-theme-body')?.getAttribute('aria-busy'), 'true');
  assert.equal(tiles(pop).some((tile) => tile.hasAttribute('disabled')), false, 'no tile is disabled while busy');
  assert.equal(document.activeElement instanceof HTMLElement ? document.activeElement.dataset.key : null, 'theme-dark', 'focus stays on Dark while it applies');
  tiles(pop)[0]?.click();
  assert.equal(calls.length, 1, 'a second choice while busy is ignored');
  release?.();
  await settle();
  assert.equal(pop.querySelector('.rb-theme-body')?.getAttribute('aria-busy'), null);
  assert.equal(document.activeElement instanceof HTMLElement ? document.activeElement.dataset.key : null, 'theme-dark', 'and after');
  // The busy look is the stylesheet's own, unlayered so the view-wide aria-busy rule cannot dim the whole popover.
  assert.match(CSS, /\.rb-theme-body\[aria-busy="true"\] :is\(\.rb-theme-tile, \.rb-theme-hue\) \{ opacity: \.6; cursor: progress; \}/);
  closePopover();
});

test('a controller that answers not-built leaves the tiles aria-disabled with one line, and sends nothing again', async () => {
  const m = mount({ commands: 'not-built' });
  let pop = await openFromTop(m);
  tiles(pop)[1]?.click();
  await settle();
  assert.equal(m.calls.length, 1);
  assert.equal(m.announced.at(-1), 'Themes arrive with the next update.');
  assert.deepEqual(m.said, [], 'nothing applied, so the footer says nothing');
  pop = popover() ?? pop;
  assert.ok(tiles(pop).length > 1, 'the tiles stay');
  assert.equal(pop.querySelector('.rb-theme-off')?.textContent, 'Themes arrive with the next update.');
  for (const tile of tiles(pop)) assert.equal(tile.getAttribute('aria-disabled'), 'true');
  tiles(pop)[2]?.click();
  await settle();
  assert.equal(m.calls.length, 1, 'a second choice does not send the command again');
  closePopover();
});

test('a controller without the commands says so from the start, hides the segment and sends nothing', async () => {
  const m = mount({ commands: 'absent' });
  const pop = await openFromTop(m);
  assert.equal(pop.querySelector('.rb-theme-off')?.textContent, 'Themes arrive with the next update.');
  tiles(pop)[1]?.click();
  closePopover();
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  assert.equal(m.style.querySelector('.rb-ground-seg'), null, 'a background that cannot apply is hidden, not explained');
  assert.ok(m.style.querySelector('[data-theme-door]'), 'the door stays');
  await settle();
  assert.deepEqual(m.calls, []);
});

// ─── the Background segment ──────────────────────────────────────────────────

test('the Background segment gives the selected slide its own ground, and the deck\'s ground sends null', async () => {
  const m = mount();
  await settle();
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  const seg = m.style.querySelector<HTMLElement>('.rb-ground-seg');
  assert.ok(seg);
  assert.match(seg.getAttribute('aria-label') ?? '', /^Background for slide \d+$/);
  const buttons = [...seg.querySelectorAll<HTMLElement>('[data-ground]')];
  // The starter's Brand colour ground is its Dark ground, so the segment leaves it out.
  assert.deepEqual(buttons.map((one) => one.textContent), ['Light', 'Dark']);
  assert.equal(m.style.querySelector('.rb-ground-help'), null, 'one slide needs no sentence');
  assert.equal(buttons[0]?.getAttribute('aria-pressed'), 'true', 'a slide with no ground of its own shows the deck\'s');
  buttons[1]?.click();
  await settle();
  const slideId = m.rb.sel.slideId;
  assert.deepEqual(m.calls.at(-1), { name: 'setGround', args: [[slideId], 'dark' satisfies SlideGroundV1] });
  assert.deepEqual(m.said.at(-1), { text: 'Background: Dark.', undo: true });
  // The controller answers with the slide's own ground; Light is then the deck's, so it clears it.
  m.rb.state = { ...m.rb.state, plan: { ...RUN.plan, slides: RUN.plan.slides.map((one) => (one.id === slideId ? { ...one, ground: 'dark' } : one)) } };
  m.rb.derived = deriveReview(m.rb.state, m.rb.derived);
  m.rb.theme.renderStyle(m.style);
  assert.equal(m.style.querySelector('.lp-sec-flag')?.textContent, 'Dark, this slide');
  assert.equal(m.style.querySelector('[data-ground="dark"]')?.getAttribute('aria-pressed'), 'true');
  m.style.querySelector<HTMLElement>('[data-ground="light"]')?.click();
  await settle();
  assert.deepEqual(m.calls.at(-1), { name: 'setGround', args: [[slideId], null] });
  assert.equal(m.style.querySelector('.lp-sec-head')?.getAttribute('aria-expanded'), 'true', 'the section stays open after a choice');
});

test('several slides selected: the segment sets them all and says how many under it', async () => {
  const m = mount({ many: 2 });
  await settle();
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  const seg = m.style.querySelector<HTMLElement>('.rb-ground-seg');
  assert.equal(seg?.getAttribute('aria-label'), 'Background for 2 slides');
  assert.equal(m.style.querySelector('.rb-ground-help')?.textContent, 'Sets 2 slides.');
  m.style.querySelector<HTMLElement>('[data-ground="dark"]')?.click();
  await settle();
  const call = m.calls.at(-1);
  assert.ok(call);
  assert.equal(call.name, 'setGround');
  assert.equal((call.args[0] as string[]).length, 2);
  assert.deepEqual(m.said.at(-1), { text: 'Background on 2 slides: Dark.', undo: true });
});

test('a slide whose layout has no dark version hides the segment and explains nothing', async () => {
  const bare = RUN.plan.slides[1];
  assert.ok(bare);
  const plan: RenovationPlanV1 = { ...RUN.plan, slides: RUN.plan.slides.map((slide) => (slide.id === bare.id ? { ...slide, layout: 'split' } : slide)) };
  const m = mount({ plan });
  await settle();
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  assert.equal(m.style.querySelector('.rb-ground-seg'), null);
  assert.doesNotMatch(m.style.textContent ?? '', /no dark version/);
  assert.ok(m.style.querySelector('[data-theme-door]'), 'the door is still the way to the deck theme');
  assert.deepEqual(m.calls, []);
});

// ─── keys, the top bar and Brand colour ─────────────────────────────────────

test('the tiles are buttons: Tab reaches each, the arrow keys move along a group, and only a press applies', async () => {
  const m = mount();
  const pop = await openFromTop(m);
  const [light, dark] = tiles(pop);
  assert.ok(light && dark);
  for (const tile of tiles(pop)) assert.notEqual(tile.tabIndex, -1, 'every tile is a tab stop');
  assert.equal(pop.querySelector('[role="radio"], [role="radiogroup"]'), null, 'no radio role whose arrow keys would promise a choice');
  light.focus();
  light.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(document.activeElement, dark);
  assert.equal(dark.getAttribute('aria-pressed'), 'false', 'moving focus chooses nothing');
  dark.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(document.activeElement, light, 'the themes group wraps without walking into the looks');
  await settle();
  assert.deepEqual(m.calls, [], 'the arrow keys send nothing');
  closePopover();
});

test('the top bar control names the theme with its colours and opens the popover; Escape closes and returns focus', async () => {
  const m = mount();
  await settle();
  assert.equal(m.top.hidden, false);
  const button = m.top.querySelector<HTMLButtonElement>('.rb-theme-btn');
  assert.ok(button);
  assert.equal(button.getAttribute('aria-label'), 'Deck theme: Light');
  assert.equal(button.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(button.querySelectorAll('.rb-theme-sw').length, 3);
  assert.equal(button.querySelector('.rb-btn-label')?.textContent, 'Light');
  button.click();
  await settle();
  const pop = popover();
  assert.ok(pop, 'the popover opens');
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  document.activeElement?.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await settle();
  assert.equal(popover(), null, 'Escape closes it');
  assert.equal(document.activeElement, button, 'focus goes back to the control');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
});

test('the narrow top bar leaves the theme out: the door is the way in there', async () => {
  const m = mount({ narrow: true });
  await settle();
  assert.equal(m.top.hidden, true);
  m.style.querySelector<HTMLButtonElement>('.lp-sec-head')?.click();
  assert.ok(m.style.querySelector('[data-theme-door]'));
});

test('Brand colour offers the palette\'s hues as swatches beside the tiles, and each one applies a theme', async () => {
  const m = mount({ tokens: chromaTokens() });
  const pop = await openFromTop(m);
  assert.ok(tiles(pop).some((one) => one.dataset.themeKey?.startsWith('brand')), 'a pack with a hue offers Brand colour');
  const hues = [...pop.querySelectorAll<HTMLElement>('.rb-theme-hue')];
  assert.ok(hues.length > 1, 'more than one hue can carry it');
  const row = pop.querySelector('.rb-theme-hue-row');
  assert.equal(row?.getAttribute('role'), 'group');
  assert.equal(pop.querySelector(`#${row?.getAttribute('aria-labelledby') ?? 'none'}`)?.textContent, 'Brand colour');
  for (const hue of hues) {
    assert.ok(hue.hasAttribute('aria-pressed'));
    assert.ok(hue.getAttribute('aria-label'), 'a swatch is named');
    assert.equal(hue.getAttribute('title'), hue.getAttribute('aria-label'));
  }
  assert.ok(hues.some((one) => one.getAttribute('aria-label') === 'Waterhole'));
  const blue = hues.find((one) => one.getAttribute('aria-label') === 'Waterhole');
  blue?.click();
  await settle();
  const theme = m.calls.at(-1)?.args[0] as DeckThemeV1 | undefined;
  assert.equal(theme?.id, 'brand');
  assert.equal(theme?.remap.find((row) => row.from === 'color.semantic.surface')?.to, 'color.brand.waterhole');
  assert.deepEqual(m.said.at(-1), { text: 'Deck theme: Brand colour.', undo: true });
  closePopover();
});

test('a hue is named from its token path', () => {
  assert.equal(hueName('color.brand.jungle'), 'Jungle');
  assert.equal(hueName('color.brand.midnight_blue'), 'Midnight blue');
  assert.equal(hueName('color.semantic.primary'), 'Primary');
});


// ─── the compiled tiles (close-out CP5c) ─────────────────────────────────────

const STAGE_CTX: StageRunCtxV1 = {
  budget: decodeBudgetFor('laptop'),
  cancelled: false,
  throwIfCancelled(): void {},
  progress(): void {},
};

type TileInput = CompileStageInputV1 & ThemeTileRequestV1;

interface HeldTile {
  input: TileInput;
  tag: { projectId: string; planRevision: number };
  signal: AbortSignal;
  release: () => Promise<void>;
}

/**
 * A stand-in for the stage worker that holds each request until the test releases it,
 * then answers with the real stage run in this realm. The plan in these tests was made
 * against the starter design system the pipeline resolves, so that is what it compiles
 * against, whatever design system the view read.
 */
function heldRunner(): { held: HeldTile[] } {
  const held: HeldTile[] = [];
  setThemeTileRunnerForTest((input, tag, signal) => new Promise<CompiledDeckV1>((resolve, reject) => {
    const release = async (): Promise<void> => {
      try {
        resolve(await compileStage({ ...input, system: STARTER_DESIGN_SYSTEM.input }, STAGE_CTX));
      } catch (err) {
        reject(err);
      }
      await settle();
    };
    held.push({ input, tag, signal, release });
  }));
  return { held };
}

const firstIncluded = (): string => {
  const first = RUN.plan.slides.find((one) => one.include);
  assert.ok(first);
  return first.id;
};
const artOf = (tile: HTMLElement | undefined): string | null | undefined => tile?.querySelector('.rb-theme-thumb')?.getAttribute('data-theme-art');
const tileByKey = (pop: HTMLElement, key: string): HTMLElement | undefined => tiles(pop).find((one) => one.dataset.themeKey === key);

test('the tiles compile the first slide under each theme only while the popover is open, one at a time, in the stage request', async () => {
  const { held } = heldRunner();
  try {
    const m = mount({ project: true });
    await settle();
    m.rb.theme.renderControl(m.top);
    await settle();
    assert.equal(held.length, 0, 'nothing compiles while the popover is closed');
    const pop = await openFromTop(m);
    assert.equal(held.length, 1, 'one compile at a time');
    const [first] = held;
    assert.ok(first);
    assert.equal(first.input.tile.theme?.id, 'dark', 'the first theme that is not applied');
    assert.deepEqual(first.input.tile.slideIds, [firstIncluded()], 'the deck\'s first slide');
    assert.deepEqual(first.tag, { projectId: 'p1', planRevision: RUN.plan.revision });
    assert.equal(first.input.applyUnreviewed, true, 'every proposal applied, as the Proposed pane shows it');
    assert.equal(artOf(tileByKey(pop, 'dark')), 'wireframe', 'the wireframe stands in until the compile is in');
    await first.release();
    const now = popover();
    assert.ok(now);
    const dark = tileByKey(now, 'dark');
    assert.equal(artOf(dark), 'compiled');
    const svg = dark?.querySelector('.rb-theme-thumb > svg');
    assert.equal(svg?.getAttribute('width'), String(THEME_THUMB_WIDTH), 'the compiled slide at the tile\'s width');
    assert.equal(dark?.querySelector('.rb-art-page'), null, 'not the wireframe');
    assert.equal(held.length, 2, 'the next tile asks once the first is in');
    assert.ok(held[1]?.input.tile.theme?.id === 'look', 'then the looks, in tile order');
    assert.equal(artOf(tileByKey(now, 'light')), 'wireframe', 'the applied theme waits for the Proposed pane, never a compile of its own');
    assert.ok(held.every((one) => one.input.tile.theme !== null), 'Light, the applied theme, is never asked for');
    // Closing stops the compile in flight and asks for nothing more.
    closePopover();
    await settle();
    assert.equal(held[1]?.signal.aborted, true, 'the compile in flight is stopped');
    await held[1]?.release();
    assert.equal(held.length, 2);
    // Reopening on the same revision draws what is in and compiles only what is not.
    const again = await openFromTop(m);
    assert.equal(artOf(tileByKey(again, 'dark')), 'compiled', 'kept for the same revision');
    assert.equal(held.length, 3);
    assert.equal(held[2]?.input.tile.theme?.id, 'look', 'the stopped tile is asked for again');
    assert.ok(held.slice(2).every((one) => one.input.tile.theme?.id !== 'dark'), 'Dark is not compiled twice');
    closePopover();
  } finally {
    setThemeTileRunnerForTest(null);
  }
});

test('a new plan revision compiles the tiles again, and the faces must be in before a compiled tile is drawn', async () => {
  const { held } = heldRunner();
  try {
    const m = mount({ project: true, facesReady: false });
    const pop = await openFromTop(m);
    await held[0]?.release();
    assert.equal(artOf(tileByKey(popover() ?? pop, 'dark')), 'wireframe', 'no compiled tile in a fallback face');
    // The faces come in: the next render draws the compiled tile.
    Reflect.set(m.rb, 'compare', { fontsReady: () => true, fonts: () => ({ brand: 'Outfit' }) });
    m.rb.theme.renderControl(m.top);
    assert.equal(artOf(tileByKey(popover() ?? pop, 'dark')), 'compiled');
    const before = held.length;
    // An edit: the plan moves to the next revision while the popover is open.
    m.rb.state = { ...m.rb.state, plan: { ...RUN.plan, revision: RUN.plan.revision + 1 } };
    m.rb.derived = deriveReview(m.rb.state, m.rb.derived);
    m.rb.theme.renderControl(m.top);
    await settle();
    assert.equal(artOf(tileByKey(popover() ?? pop, 'dark')), 'wireframe', 'a drawing of the old revision is not shown');
    const fresh = held.slice(before);
    assert.equal(fresh.length, 1);
    assert.equal(fresh[0]?.tag.planRevision, RUN.plan.revision + 1);
    assert.equal(fresh[0]?.input.tile.theme?.id, 'dark');
    closePopover();
  } finally {
    setThemeTileRunnerForTest(null);
  }
});

test('the applied theme\'s tile draws the Proposed pane\'s own slide while that drawing is current', async () => {
  const { held } = heldRunner();
  try {
    const preview = { deck: RUN.compiled, planRevision: RUN.plan.revision };
    const m = mount({ project: true, preview });
    const pop = await openFromTop(m);
    assert.equal(artOf(tileByKey(pop, 'light')), 'compiled', 'no compile needed for the applied theme');
    assert.ok(held.every((one) => one.input.tile.theme !== null));
    closePopover();
    m.rb.state = { ...m.rb.state, previewStale: true };
    const stale = await openFromTop(m);
    assert.equal(artOf(tileByKey(stale, 'light')), 'wireframe', 'an Updating pane is not the plan as it stands');
    closePopover();
  } finally {
    setThemeTileRunnerForTest(null);
  }
});

test('the stage draws a tile as applying the theme would: the colours solved, the lock kept, the one slide alone', async () => {
  const input = STARTER_DESIGN_SYSTEM.input;
  const source = { colors: input.colors, master: input.master, ...(input.darkColors ? { darkColors: input.darkColors } : {}) };
  const dark = buildDeckTheme('dark', source);
  assert.ok(dark);
  const slideId = firstIncluded();
  const tile = await compileStage({
    source: RUN.deck,
    census: RUN.census,
    plan: RUN.plan,
    system: input,
    applyUnreviewed: false,
    applyNeedsAttention: false,
    tile: { theme: dark.theme, slideIds: [slideId] },
  }, STAGE_CTX);
  assert.ok(tile.frames.length > 0);
  assert.ok(tile.frames.every((frame) => frame.sourceSlideId === slideId), 'the one slide alone');
  // The same slide from the whole deck with the theme applied the way setTheme applies it.
  const solve = { census: RUN.census, source: RUN.deck, system: source };
  const applied = setDeckTheme(RUN.plan, dark.theme, { solve }).plan;
  const whole = compileRenovated({
    source: RUN.deck,
    census: RUN.census,
    plan: applied,
    master: STARTER_DESIGN_SYSTEM.input.master,
    designSystem: STARTER_DESIGN_SYSTEM.compile,
    opts: { ...compileSystemOpts(input), applyUnreviewed: false, applyNeedsAttention: false },
  });
  const own = whole.frames.find((frame) => frame.sourceSlideId === slideId && frame.continuation !== true);
  const drawn = tile.frames.find((frame) => frame.continuation !== true);
  assert.ok(own && drawn);
  const fills = (layers: typeof own.layers): string[] => layers.map((row) => String(row.fill ?? '')).sort();
  assert.deepEqual(fills(drawn.layers), fills(own.layers), 'the tile draws the colours applying the theme draws');
  assert.equal(drawn.layers.length, own.layers.length);
  // A tile with no request compiles the deck as ever.
  const plain = await compileStage({ source: RUN.deck, census: RUN.census, plan: RUN.plan, system: input, applyUnreviewed: false, applyNeedsAttention: false }, STAGE_CTX);
  assert.ok(plain.frames.some((frame) => frame.sourceSlideId !== slideId), 'the Proposed pane still gets every slide');
});

// ─── the stylesheet ──────────────────────────────────────────────────────────

test('the stylesheet sizes chrome with the type and hides what is hidden', () => {
  // 16 px swatches in the popover, the tile track and the hue targets grow with the type.
  assert.match(CSS, /\.rb-theme-sw \{[^}]*width: calc\(16px \* var\(--a11y-fs\)\);/);
  assert.match(CSS, /--rb-theme-col: calc\(96px \* var\(--a11y-fs\)\);/);
  assert.match(CSS, /\.rb-theme-hue \{ width: calc\(44px \* var\(--a11y-fs\)\); height: calc\(44px \* var\(--a11y-fs\)\); \}/, '44 px under a coarse pointer');
  assert.match(CSS, /\.rb-theme-note\[hidden\] \{ display: none; \}/);
  assert.match(CSS, /\.rb-top-theme\[hidden\] \{ display: none; \}/);
  assert.match(CSS, /html\[data-a11y-previews="hidden"\] \.rb-theme-tile \.rb-theme-thumb \{ display: none; \}/);
  assert.doesNotMatch(CSS, /view-seg/);
});
