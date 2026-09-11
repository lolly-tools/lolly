// SPDX-License-Identifier: MPL-2.0
/**
 * Performance UI flag (perf-ui) - the opt-in "simplified, cheaper-to-paint chrome" toggle.
 *
 * Two things are pinned here, the same split as lib/a11y-prefs + a11y-prefs-contract:
 *   1. the module behaviour (the flag shape, and applyPerfUi's <html> reflection), against
 *      a real jsdom document; and
 *   2. the WIRING + the gated stylesheet, by source scan - every CSS rule sits behind the
 *      html[data-perf-ui] gate (so OFF is byte-identical), the strip never reaches the tool
 *      canvas, box-shadow focus rings survive, the import is unlayered, and the profile
 *      toggle + boot + pre-paint script all reflect the flag.
 *
 * Run directly:  node --test shells/web/src/feature-flags-perf-ui.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url)); // shells/web/src

// A real origin so localStorage doesn't throw SecurityError (as in a11y-prefs.test.ts).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

// Dynamic import AFTER the globals are live, so applyPerfUi's document reference resolves.
const { PERFORMANCE_UI_FLAG, applyPerfUi, perfUiOn, isFlagOnSync, setFlagMirror } = await import('./feature-flags.ts');

const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
const CSS = read('styles/parts/perf-ui.css');
const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const APP_CSS = read('styles/app.css');
const PROFILE = read('views/profile.ts');
const MAIN = read('main.ts');
const HTML = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
// JS gate sites (items 1-3): the decorative loops / live-render / Cover Flow.
const FEATURED = read('components/featured-row.ts');
const GALLERY = read('views/gallery.ts');
const PARTICLES = read('lib/particles.ts');
const TYPEDEMO = read('lib/type-demo.ts');
const DOCK = read('lib/neurospicy-dock-host.ts');

test('the flag is opt-in (off by default) with a label and an explainer', () => {
  assert.equal(PERFORMANCE_UI_FLAG.id, 'perf-ui');
  assert.equal(PERFORMANCE_UI_FLAG.default, false, 'default OFF - it is opt-in');
  assert.ok(PERFORMANCE_UI_FLAG.label, 'has a user-facing label');
  assert.ok(PERFORMANCE_UI_FLAG.info, 'has an explainer for the (i)');
});

test('isFlagOnSync reads it OFF by default and ON once the mirror is set', () => {
  localStorage.removeItem('lolly:featureFlags');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false, 'opt-in ⇒ off with no stored value');
  setFlagMirror('perf-ui', true);
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true, 'a stored true wins');
  localStorage.removeItem('lolly:featureFlags');
});

test('perfUiOn() is the JS gate: OFF by default, ON once set (byte-identical off)', () => {
  localStorage.removeItem('lolly:featureFlags');
  assert.equal(perfUiOn(), false, 'ungated decorative work behaves exactly as before');
  setFlagMirror('perf-ui', true);
  assert.equal(perfUiOn(), true, 'decorative rAF loops / live previews can idle when on');
  localStorage.removeItem('lolly:featureFlags');
});

test('applyPerfUi reflects the flag onto <html> and clears it entirely when off', () => {
  applyPerfUi(true);
  assert.ok(document.documentElement.hasAttribute('data-perf-ui'), 'ON sets the attribute');
  applyPerfUi(false);
  assert.equal(document.documentElement.hasAttribute('data-perf-ui'), false, 'OFF removes it - no residue');
});

test('every CSS rule is gated on html[data-perf-ui] - so OFF matches nothing', () => {
  const selectors = CSS_NO_COMMENTS.match(/[^{}]+\{/g) ?? [];
  assert.ok(selectors.length >= 2, 'the sheet has rules');
  for (const sel of selectors) {
    assert.match(sel, /html\[data-perf-ui\]/, `ungated rule would leak when off: ${sel.trim().slice(0, 60)}`);
  }
});

test('the strip turns off the GPU-expensive effects', () => {
  assert.match(CSS, /backdrop-filter:\s*none\s*!important/);
  assert.match(CSS, /box-shadow:\s*none\s*!important/);
  assert.match(CSS, /mix-blend-mode:\s*normal\s*!important/);
  assert.match(CSS, /background-blend-mode:\s*normal\s*!important/);
});

test('the strip never reaches the tool canvas or export stages (render is untouched)', () => {
  assert.match(CSS, /:not\(:is\(#tool-canvas, \.tool-canvas, #tool-content, \.pro-export-canvas\)\)/,
    'the canvas roots + their subtrees are excluded via :not(:is(...)) and :not(:is(...) *)');
});

test('box-shadow focus rings survive the strip (:focus-visible exempted)', () => {
  assert.match(CSS, /:not\(:focus-visible\)/, 'a keyboard focus indicator is never a perf casualty');
});

test('decorative preview animation idles off-hover and runs on hover', () => {
  assert.match(CSS, /\.ftile-img \{ animation-play-state: paused/);
  assert.match(CSS, /\.ftile:hover \.ftile-img/);
});

test('app.css imports perf-ui.css UNLAYERED so its !important outranks every layer', () => {
  const line = APP_CSS.split('\n').find(l => l.includes('perf-ui.css'));
  assert.ok(line, 'app.css imports perf-ui.css');
  assert.doesNotMatch(line!, /layer\(/, 'no layer() - unlayered');
});

test('the profile view offers the toggle and applies it live', () => {
  assert.match(PROFILE, /flagRow\(PERFORMANCE_UI_FLAG\)/, 'a toggle row in the standalone flags list');
  assert.match(PROFILE, /flagId === PERFORMANCE_UI_FLAG\.id\) applyPerfUi\(input\.checked\)/,
    'flipping it reflects onto <html> on the spot (no reload)');
});

// ── Items 1-3: JS gates halt decorative loops / live rendering / Cover Flow ──

test('item 1: decorative rAF loops fold perf-ui into their reduce-motion guard', () => {
  assert.match(FEATURED, /prefersReducedMotion\(\) \|\| captureNeutralPinned\(\) \|\| opts\.staticStrip === true \|\| perfUiOn\(\)/,
    'the featured strip drift + variant queue idle under perf-ui');
  assert.match(PARTICLES, /if \(prefersReducedMotion\(\) \|\| perfUiOn\(\)\) return;/, 'no confetti burst under perf-ui');
  assert.match(TYPEDEMO, /const reduce = prefersReducedMotion\(\) \|\| perfUiOn\(\);/, 'the font showcase idles');
  // The ambient MilkDrop backdrop is gated at its call site, the dock host, NOT in the
  // butterchurn-viz engine wrapper (that wrapper also serves user-invoked rendering like
  // the catalog audio-asset preview, which must still paint under perf-ui).
  assert.match(DOCK, /prefersReducedMotion\(\) \|\| perfUiOn\(\)/, 'the ambient dock visualiser never starts');
});

test('item 2: the gallery skips live grid-tile rasterisation and settles on the static icon', () => {
  assert.match(GALLERY, /if \(perfUiOn\(\)\) \{ gcar\.classList\.add\('has-art'\); return; \}/,
    'no renderFeaturedVariant/Pages on the main thread; has-art stops the waiting tracer');
});

test('item 3: perf-ui forces the flat filmstrip (no Cover Flow fan)', () => {
  assert.match(GALLERY, /if \(captureNeutralPinned\(\) \|\| perfUiOn\(\)\) featuredView = 'gallery';/,
    'reuses the capture path to drop the 3-D fan and its rAF loop');
});

// ── Items 4-5: CSS releases GPU layers + pauses ambient animation, sparing functional motion ──

test('item 4: will-change is released to auto, but the virtualised data-grid keeps its hint', () => {
  assert.match(CSS_NO_COMMENTS, /will-change: auto !important/, 'decorative compositor hints are dropped');
  assert.doesNotMatch(CSS_NO_COMMENTS, /\.dg-rows/, 'the scroll-recycling data-grid (.dg-rows) is NOT targeted');
});

test('item 5: ambient animation pauses, but spinners/progress/recording keep running', () => {
  assert.match(CSS_NO_COMMENTS, /animation-play-state: paused !important/, 'ambient decorations idle');
  assert.match(CSS_NO_COMMENTS, /\.valid-ai-flag/, 'e.g. the verify AI-flag pulse is paused');
  // Loading/progress/recording motion must never be paused - none of these appear in the sheet.
  // (export-shutter is deliberately NOT here: its will-change is released, but its transient
  // export animation is left running - so the class DOES appear, in the will-change block only.)
  for (const functional of ['job-bar-fill', 'canvas-processing-spinner', 'gtile-icon-trace', 'tl-rec-dot', 'odl-indet']) {
    assert.ok(!CSS_NO_COMMENTS.includes(functional), `${functional} must keep animating (loading/progress/recording feedback)`);
  }
  // And the export-shutter animation specifically is never paused (only its will-change is dropped).
  const pauseBlock = CSS_NO_COMMENTS.slice(CSS_NO_COMMENTS.indexOf('animation-play-state: paused !important', CSS_NO_COMMENTS.indexOf('will-change')));
  assert.ok(!pauseBlock.includes('export-shutter'), 'the export shutter keeps its own iris animation');
});

test('boot applies the flag, and the pre-paint script mirrors it to avoid a flash', () => {
  assert.match(MAIN, /applyPerfUi\(isFlagOnSync\(PERFORMANCE_UI_FLAG\)\)/, 'boot reflects the flag from the profile');
  assert.match(HTML, /lolly:featureFlags/, 'the FOUC script reads the feature-flag mirror');
  assert.match(HTML, /ff\['perf-ui'\]/, 'checks the perf-ui flag');
  assert.match(HTML, /setAttribute\('data-perf-ui'/, 'and sets the attribute before paint');
});
