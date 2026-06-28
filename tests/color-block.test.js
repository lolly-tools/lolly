/**
 * color-block tool contract tests.
 *
 * Run with: npm test  (node --test over the tests/ globs)
 * No test framework — uses node:test built-in.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with a stub host, so these guard the tool's actual
 * behaviour, not a fixture. The host's asset stub resolves every id to a
 * recognisable "asset:<id>" URL, so the chosen logo variant is visible in the
 * hydrated output.
 *
 * Two ideas underpin the suite:
 *   1. The render is a PURE function of the input model. Every visual format
 *      (png/jpg/webp/pdf/pdf-cmyk/cmyk-tiff/svg/html) is produced by the export
 *      bridge from this one hydrated DOM — so if the DOM is correct and stable,
 *      the formats are consistent by construction. The determinism test pins this.
 *   2. URL mode is the only transport: the CLI is `?param` under argv. The
 *      round-trip test proves a composition survives serialize → parse unchanged,
 *      i.e. the CLI and the web shell render the same thing.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.js';
import { createRuntime } from '../engine/src/runtime.js';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.js';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools');
const fetchFile = (path) => readFile(join(TOOLS_DIR, path), 'utf8');

// Load + validate the real tool once; createRuntime never mutates it (only the
// web shell annotates the template), so it's safe to share across mounts.
const tool = await loadTool('color-block', fetchFile);

// A stub host. Asset ids resolve to "asset:<id>" so the rendered logo src reveals
// exactly which mark the hook picked. `fetched` records every resolved id.
function makeHost() {
  const fetched = [];
  const host = {
    version: '1',
    profile: { get: async () => ({}) },
    assets: { get: async (id) => { fetched.push(id); return { id, url: 'asset:' + id }; } },
    log: () => {},
  };
  return { host, fetched };
}

async function mount(initialState = {}) {
  const { host, fetched } = makeHost();
  const rt = await createRuntime(tool, host, initialState);
  return { rt, fetched, html: rt.getHydrated() };
}

// Count rendered cells. Every block becomes one ".cb-block <kind>-block" element.
const cellCount = (html) => (html.match(/class="cb-block /g) ?? []).length;
// Logo marks rendered, in order, by resolved asset URL.
const logoSrcs = (html) => [...html.matchAll(/<img class="cb-logo-mark" src="([^"]*)"/g)].map(m => m[1]);

// ─── manifest shape ──────────────────────────────────────────────────────────

test('color-block: the only top-level input is the block list (no corner-logo input)', () => {
  const ids = (tool.manifest.inputs ?? []).map(i => i.id);
  assert.deepEqual(ids, ['blocks']);
});

test('color-block: "logo" is a block kind that can be added like any other', () => {
  const kind = tool.manifest.inputs[0].fields.find(f => f.id === 'kind');
  const kinds = kind.options.map(o => o.value);
  assert.ok(kinds.includes('logo'), `kinds were ${kinds.join(', ')}`);
  // Logo controls are scoped to the logo kind; image controls are scoped away
  // from it (a logo cell takes a background colour, never a photo).
  const fields = Object.fromEntries(tool.manifest.inputs[0].fields.map(f => [f.id, f]));
  assert.deepEqual(fields.logoOrient.showFor, ['logo']);
  assert.deepEqual(fields.logoColor.showFor, ['logo']);
  assert.ok(!fields.bgImage.showFor.includes('logo'));
});

// ─── structure: one cell per block, logo is a cell (never an overlay) ─────────

test('color-block: renders exactly one grid cell per block', async () => {
  // Derive the expected count from the manifest's own default list, so trimming
  // (or growing) the default block set never silently breaks this assertion.
  const defaultBlocks = tool.manifest.inputs[0].default.length;
  const { html } = await mount();                       // ships the manifest default blocks
  assert.equal(cellCount(html), defaultBlocks);

  const { html: six } = await mount({
    blocks: Array.from({ length: 6 }, (_, i) => ({ kind: 'blank', bgColor: '', text: '' + i })),
  });
  assert.equal(cellCount(six), 6);
});

test('color-block: the logo is its own grid cell, never a corner overlay', async () => {
  const { html } = await mount();
  // The mark renders inside a logo-block cell …
  assert.match(html, /class="cb-block logo-block/);
  assert.equal(logoSrcs(html).length, 1);
  // … and none of the old absolutely-positioned corner-logo markup survives.
  assert.doesNotMatch(html, /cb-logo-top|cb-logo-bottom|id="cb-logo"|data-corner/);
});

test('color-block: every cell carries a click-to-focus marker for its block', async () => {
  const { html } = await mount();
  const n = cellCount(html);
  for (let i = 0; i < n; i++) {
    assert.match(html, new RegExp(`data-canvas-input="blocks:${i}"`));
  }
  // No marker past the last block.
  assert.doesNotMatch(html, new RegExp(`data-canvas-input="blocks:${n}"`));
});

// ─── logo variant selection: orientation × colour × background polarity ───────

const LOGO_MATRIX = [
  // orient,      colour,  background, expected asset id
  ['horizontal', 'mono',  '#0c322c', 'hor-neg-white'],   // mono on dark  → white
  ['horizontal', 'mono',  '#ffffff', 'hor-pos-black'],   // mono on light → black
  ['horizontal', 'green', '#0c322c', 'hor-neg-green'],   // green flips pos/neg too
  ['horizontal', 'green', '#ffffff', 'hor-pos-green'],
  ['stacked',    'mono',  '#0c322c', 'vert-neg-white'],
  ['stacked',    'mono',  '#ffffff', 'vert-pos-black'],
  ['stacked',    'green', '#0c322c', 'vert-neg-green'],
  ['stacked',    'green', '#ffffff', 'vert-pos-green'],
];

for (const [logoOrient, logoColor, bgColor, expected] of LOGO_MATRIX) {
  test(`color-block: logo ${logoOrient}/${logoColor} on ${bgColor} → ${expected}`, async () => {
    const { html } = await mount({ blocks: [{ kind: 'logo', logoOrient, logoColor, bgColor }] });
    assert.deepEqual(logoSrcs(html), [`asset:suse/logo/${expected}`]);
  });
}

test('color-block: a logo defaults to the horizontal mono lockup', async () => {
  // No orientation/colour set → horizontal + mono; dark bg → the white mark.
  const { html } = await mount({ blocks: [{ kind: 'logo', bgColor: '#0c322c' }] });
  assert.deepEqual(logoSrcs(html), ['asset:suse/logo/hor-neg-white']);
});

// ─── per-block colour resolution ──────────────────────────────────────────────

test('color-block: an empty background falls back to the next palette colour', async () => {
  const { html } = await mount({ blocks: [{ kind: 'heading', text: 'Hi', bgColor: '' }] });
  assert.match(html, /background-color:#0c322c/);        // first SUSE palette entry
});

test('color-block: text colour auto-contrasts with the background', async () => {
  const dark = await mount({ blocks: [{ kind: 'heading', text: 'X', bgColor: '#0c322c' }] });
  assert.match(dark.html, /; color:#ffffff/);            // white text on dark
  const light = await mount({ blocks: [{ kind: 'heading', text: 'X', bgColor: '#ffffff' }] });
  assert.match(light.html, /; color:#0c322c/);           // dark text on light
});

test('color-block: a background image forces light text regardless of bgColor', async () => {
  const { html } = await mount({
    blocks: [{
      kind: 'heading', text: 'X', bgColor: '#ffffff',
      bgImage: { source: 'library', id: 'photo', _unresolved: true },
    }],
  });
  assert.match(html, /<img class="cb-img" src="asset:photo"/);  // image resolved
  assert.match(html, /; color:#ffffff/);                        // light over the photo
});

// ─── the unified --scale knob (logo size vs text scale, split by kind) ────────

test('color-block: logo size and text scale both feed --scale, chosen by kind', async () => {
  const { html } = await mount({ blocks: [
    { kind: 'logo',    logoOrient: 'horizontal', logoColor: 'mono', bgColor: '#0c322c', logoSize: 0.5 },
    { kind: 'heading', text: 'Big', bgColor: '#30ba78', scale: 1.8 },
  ]});
  assert.match(html, /--scale:0\.5/);    // logo cell reads "Logo size"
  assert.match(html, /--scale:1\.8/);    // text cell reads "Text scale"
});

// ─── consistency: pure render + lossless URL transport ────────────────────────

test('color-block: identical inputs render byte-identical output (render is pure)', async () => {
  const state = { blocks: [
    { kind: 'logo',    logoOrient: 'stacked', logoColor: 'green', bgColor: '#30ba78', logoSize: 0.7 },
    { kind: 'heading', text: 'Same', bgColor: '#0c322c', scale: 1 },
    { kind: 'cta',     text: 'Go', ctaStyle: 'pill', bgColor: '#90ebcd' },
  ]};
  const a = await mount(structuredClone(state));
  const b = await mount(structuredClone(state));
  assert.equal(a.html, b.html);
});

test('color-block: a composition survives a URL serialize → parse round-trip', async () => {
  const state = { blocks: [
    { kind: 'logo',       logoOrient: 'horizontal', logoColor: 'green', bgColor: '#01564a', logoSize: 0.9 },
    { kind: 'subheading', text: 'Round & trip', bgColor: '' },
    { kind: 'body',       text: '**Bold** and *italic*', bgColor: '#ffffff' },
    { kind: 'cta',        text: '> Go', ctaStyle: 'arrow', bgColor: '#30ba78' },
  ]};
  const first  = await mount(structuredClone(state));
  const query  = serializeUrlState(first.rt.getModel());           // web "?…" / CLI argv
  const parsed = parseUrlState(query, tool.manifest).values;       // back to a model
  const second = await mount(parsed);
  // Same model → same DOM → every export format stays in lock-step across transports.
  assert.equal(second.html, first.html);
});
