// SPDX-License-Identifier: MPL-2.0
/**
 * Performance UI flag (perf-ui) - the opt-in "simplified, cheaper-to-paint chrome" toggle.
 *
 * Two things are pinned here, the same split as lib/a11y-prefs + a11y-prefs-contract:
 *   1. the module behaviour (the flag shape, and applyPerfUi's <html> reflection), against
 *      a real jsdom document; and
 *   2. the WIRING + the gated stylesheet, by source scan - every CSS rule sits behind the
 *      html[data-perf-ui] gate (so OFF is byte-identical), the strip never reaches the tool
 *      canvas, box-shadow focus rings survive, the import uses the first layer, and the profile
 *      toggle + boot + pre-paint script all reflect the flag.
 *
 * Run directly:  node --test shells/web/src/feature-flags-perf-ui.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
const { PERFORMANCE_UI_FLAG, applyPerfUi, perfUiOn, isFlagOnSync, setFlagMirror, subscribePerfUi } = await import('./feature-flags.ts');

const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
const CSS = read('styles/parts/perf-ui.css');
const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const APP_CSS = read('styles/app.css');
// The profile view is an orchestrator plus feature modules under views/profile/ (2026-09-12
// split), so a source pin reads all of it rather than guessing which module a line moved to.
const PROFILE = [read('views/profile.ts'),
  ...readdirSync(join(HERE, 'views', 'profile')).filter((n) => n.endsWith('.ts')).sort().map((n) => read(`views/profile/${n}`))].join('\n');
const MAIN = read('main.ts');
const HTML = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

test('live subscribers see the applied DOM policy and unsubscribe cleanly', () => {
  const observed: boolean[] = [];
  const unsubscribe = subscribePerfUi(on => {
    assert.equal(document.documentElement.hasAttribute('data-perf-ui'), on);
    observed.push(on);
  });
  applyPerfUi(true); applyPerfUi(false);
  unsubscribe(); applyPerfUi(true);
  assert.deepEqual(observed, [true, false]);
  applyPerfUi(false);
});
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

test('decorative panning stays paused on hover as well as at rest', () => {
  assert.match(CSS, /\.ftile-img \{ animation-play-state: paused/);
  assert.doesNotMatch(CSS, /animation-play-state: running/);
});

test('app.css reserves the first layer for the important Performance UI policy', () => {
  const declarations = APP_CSS.replace(/\/\*[\s\S]*?\*\//g, '').trimStart();
  assert.match(declarations, /^@layer perf, vendor, base, primitives, chrome, views, overrides, a11y;/);
  const line = APP_CSS.split('\n').find(l => l.includes('perf-ui.css'));
  assert.ok(line, 'app.css imports perf-ui.css');
  assert.match(line, /layer\(perf\)/, 'important layer priority is reversed; the first layer wins');
});

test('the profile view offers the toggle and applies it live', () => {
  assert.match(PROFILE, /flagRow\(pv, PERFORMANCE_UI_FLAG\)/, 'a toggle row in the standalone flags list');
  assert.match(PROFILE, /flagId === PERFORMANCE_UI_FLAG\.id\) applyPerfUi\(input\.checked\)/,
    'flipping it reflects onto <html> on the spot (no reload)');
});

// ── Items 1-3: JS gates halt decorative loops / live rendering / Cover Flow ──

test('item 1: decorative rAF loops fold perf-ui into their reduce-motion guard', () => {
  assert.match(FEATURED, /prefersReducedMotion\(\) \|\| captureNeutralPinned\(\) \|\| opts\.staticStrip === true \|\| perfUiOn\(\)/,
    'the featured strip drift + variant queue idle under perf-ui');
  assert.match(PARTICLES, /if \(prefersReducedMotion\(\) \|\| perfUiOn\(\)\) return;/, 'no confetti burst under perf-ui');
  assert.match(TYPEDEMO, /let reduce = prefersReducedMotion\(\) \|\| perfUiOn\(\);/, 'the font showcase idles');
  // The ambient MilkDrop backdrop is gated at its call site, the dock host, NOT in the
  // butterchurn-viz engine wrapper (that wrapper also serves user-invoked rendering like
  // the catalog audio-asset preview, which must still paint under perf-ui).
  assert.match(DOCK, /prefersReducedMotion\(\) \|\| perfUiOn\(\)/, 'the ambient dock visualiser never starts');
});

test('item 2: the gallery skips live grid-tile rasterisation and settles on the static icon', () => {
  assert.match(GALLERY, /if \(perfUiOn\(\)\) \{ gcar\.classList\.add\('has-art'\); stripCarouselNav\(gcar\); return; \}/,
    'no renderFeaturedVariant/Pages on the main thread; has-art stops the waiting tracer, and the '
    + 'strip loses the nav + dots it would otherwise show for looks that are never coming (plans/246)');
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

// ── The automatic switch (lib/perf-ui-auto.ts): Settings shows when and why ──────

test('Settings explains an automatic switch beside the toggle, as its description', () => {
  assert.match(PROFILE, /const note = f\.id === PERFORMANCE_UI_FLAG\.id \? perfUiAutoNote\(pv\) : null;/,
    'only the Performance UI row carries the note');
  assert.match(PROFILE, /aria-describedby="\$\{ctlId\}-auto"/, 'the note describes the switch rather than renaming it');
  assert.match(PROFILE, /<p class="feature-flag-note"><span id="\$\{ctlId\}-auto">/,
    'the sentence alone is the description, not the button after it');
  assert.match(PROFILE, /Turned on automatically on \{date\} because this device draws without graphics acceleration\./);
  assert.match(PROFILE, /Turned on automatically on \{date\} because this device was struggling to draw the interface\./);
  assert.match(PROFILE, /featureFlags\?\.\[PERFORMANCE_UI_FLAG\.id\] !== undefined\) return null;/,
    'a hand choice hides the note: the person chose, so "automatically" would mislead');
});

test('after an Undo, Settings says automatic switching is off here and offers "Allow again"', () => {
  assert.match(PROFILE, /if \(rec\.state === 'undone'\) return \{ text: tRaw\('Automatic switching is off on this device because you chose Undo on \{date\}\.', \{ date \}\), allow: true \};/);
  assert.match(PROFILE, /class="btn btn--sm feature-flag-note-action" data-perf-ui-allow>\$\{escapeText\(t\('Allow again'\)\)\}<\/button>/,
    'the shared small button, rendered with the row');
  assert.match(PROFILE, /allow\.className = 'btn btn--sm feature-flag-note-action';/, 'and when the row is brought up to date in place');
  assert.match(PROFILE, /if \(\(e\.target as Element\)\.closest\('\[data-perf-ui-allow\]'\)\) pv\.rows\.allowPerfUiAgain\(\);/,
    'delegated, so it survives the list being rebuilt');
  const allow = PROFILE.slice(PROFILE.indexOf('export const allowPerfUiAgain'), PROFILE.indexOf('export const syncPerfUiRow'));
  assert.match(allow, /allowPerfUiAutoAgain\(\);/, 'clears the Undo record');
  assert.doesNotMatch(allow, /applyPerfUi|setFlagMirror|host\.profile\.set/, 'and never turns the look on, or records a hand choice');
  assert.match(allow, /Automatic switching is allowed again from the next time you open Lolly\./);
  assert.match(allow, /\?\.focus\(\);/, 'focus goes to the switch, not to the page, when the button goes');
});

// ── The flag switch's knob under the Performance UI ──────────────────────────────

/** WCAG relative luminance of an sRGB colour given as 0-255 channels. */
function luminance([r, g, b]: number[]): number {
  const lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}
const contrast = (a: number[], b: number[]): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

test('the checked switch stays readable under perf-ui in dark: the knob keeps an edge the strip cannot remove', () => {
  const PROFILE_CSS = read('styles/parts/profile.css');
  // The regular look: a white knob that a shadow sets apart from its track. In a dark
  // theme the checked track is often white too, so the shadow is all there is.
  const knob = PROFILE_CSS.match(/\.profile-view \.feature-flag-switch::after \{([^}]*)\}/)?.[1] ?? '';
  assert.match(knob, /background: #fff;/);
  assert.match(knob, /box-shadow:/, 'the regular look relies on a shadow...');
  assert.match(CSS, /box-shadow: none !important/, '...which the strip removes');
  // Under perf-ui the knob gets a ring instead, drawn with outline (never stripped).
  const rule = CSS_NO_COMMENTS.match(/html\[data-perf-ui\] \.profile-view \.feature-flag-switch::after \{([^}]*)\}/);
  assert.ok(rule, 'a gated rule for the knob');
  const ring = rule[1]!.match(/outline:\s*(\d+(?:\.\d+)?)px solid rgb\(0 0 0 \/ (\.\d+|0\.\d+)\) !important/);
  assert.ok(ring, 'a solid outline ring, important so no later layer drops it');
  assert.ok(Number(ring[1]) >= 1, 'at least a pixel wide');
  assert.doesNotMatch(CSS_NO_COMMENTS.slice(0, CSS_NO_COMMENTS.indexOf('{')), /outline/, 'the strip itself leaves outlines alone');
  // Worst case in dark: a white checked track under a white knob. The ring, black at this
  // alpha over white, must stand 3:1 against the knob (WCAG 1.4.11, non-text contrast).
  const alpha = Number(ring[2]);
  const over = (bg: number) => Math.round(bg * (1 - alpha));
  const ringOnWhite = [over(255), over(255), over(255)];
  assert.ok(contrast(ringOnWhite, [255, 255, 255]) >= 3, `ring on a white track: ${contrast(ringOnWhite, [255, 255, 255]).toFixed(2)}:1`);
  // High contrast's dark theme turns the checked track a light green (147.6 75% 67.1%, about #6ceaa6).
  const green = [108, 234, 166];
  const ringOnGreen = green.map(c => Math.round(c * (1 - alpha)));
  assert.ok(contrast(ringOnGreen, [255, 255, 255]) >= 3, `ring on the high-contrast track: ${contrast(ringOnGreen, [255, 255, 255]).toFixed(2)}:1`);
  // And it is scoped to the gate, so perf-ui off stays byte-identical (the gate test above
  // checks every rule; this one checks the knob).
  assert.doesNotMatch(PROFILE_CSS, /outline: 1px solid rgb\(0 0 0/, 'the regular sheet is untouched');
});

test('the Settings row follows a switch or an Undo made elsewhere, and lets go on teardown', () => {
  assert.match(PROFILE, /pv\.perfUiUnsub = subscribePerfUi\(\(\) => \{ syncPerfUiRow\(pv\); \}\);/);
  assert.match(PROFILE, /pv\.perfUiUnsub\?\.\(\);\s*pv\.perfUiUnsub = null;/);
});

test('the pre-paint script needs no change: the flag mirror already carries the automatic value', () => {
  assert.doesNotMatch(HTML, /perfUiAuto/, 'index.html reads lolly:featureFlags only');
  assert.match(read('feature-flags.ts'), /if \(eff\[PERFORMANCE_UI_FLAG\.id\] === undefined && perfUiAutoOn\(\)\) eff\[PERFORMANCE_UI_FLAG\.id\] = true;/);
});
