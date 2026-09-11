// SPDX-License-Identifier: MPL-2.0
/**
 * Neutral capture state - both halves of lib/capture-neutral.ts:
 *
 *   1. RUNTIME: the pin forces the effect flags off and clears the a11y
 *      attributes, and - the invariant that matters most - is a strict no-op
 *      without the key, because it runs on every boot for every user;
 *   2. CONTRACT: scripts/build-docs-shots.ts actually SETS the key this module
 *      reads, pins the OS-level preference media queries on every capture
 *      context, and main.ts calls the pin at the one point in boot where it
 *      works - after the flag mirror is rewritten from the profile, and before
 *      the two reads that act on it.
 *
 * (2) is the half a runtime test cannot see. The pin's whole value is that a
 * published screenshot shows plain chrome; the failure mode is silent (a shot
 * that merely looks slightly different), the key is spelled out in a second
 * place (an init-script string in a build script), and this repo has been bitten
 * by two-copies drift before - so the second copy is asserted against the module.
 *
 * Run directly:  node --test shells/web/src/lib/capture-neutral.test.ts
 *
 * jsdom with a real origin: localStorage throws SecurityError on the default
 * opaque `about:blank` origin, and the mirror is what's under test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { CAPTURE_NEUTRAL_KEY, NEUTRALISED_FLAGS, applyCaptureNeutral, captureNeutralPinned } =
  await import('./capture-neutral.ts');
const { flagEnabledSync, overrideFlagInMemory, JELLY_FLAG, NEUROSPICY_FLAG } = await import('../feature-flags.ts');
const { applyA11yPrefs, A11Y_STORE_KEY } = await import('./a11y-prefs.ts');

const SRC = dirname(dirname(fileURLToPath(import.meta.url)));          // shells/web/src
const ROOT = dirname(dirname(dirname(SRC)));                            // repo root
const SHOTS_SCRIPT = readFileSync(join(ROOT, 'scripts', 'build-docs-shots.ts'), 'utf-8');
const MAIN_TS = readFileSync(join(SRC, 'main.ts'), 'utf-8');

function reset(): void {
  localStorage.clear();
  applyA11yPrefs({});
  for (const k of Object.keys(dom.window.document.documentElement.dataset)) {
    delete dom.window.document.documentElement.dataset[k];
  }
}

// ── Runtime ───────────────────────────────────────────────────────────────────

test('unpinned: applyCaptureNeutral is a strict no-op', () => {
  reset();
  // The brand-aware jelly default is resolved elsewhere (setJellyDefault); what
  // matters here is that this module does not touch the mirror at all, so a real
  // user's flags - whatever they are - survive untouched.
  localStorage.setItem('lolly:featureFlags', JSON.stringify({ [JELLY_FLAG.id]: true }));
  const before = localStorage.getItem('lolly:featureFlags');

  assert.equal(captureNeutralPinned(), false);
  assert.equal(applyCaptureNeutral(), false);

  assert.equal(localStorage.getItem('lolly:featureFlags'), before);
  assert.equal(flagEnabledSync(JELLY_FLAG.id), true, 'an unpinned boot keeps jelly on');
});

test('unpinned: a11y preferences are left alone', () => {
  reset();
  applyA11yPrefs({ highContrast: true, largeText: true });
  assert.equal(applyCaptureNeutral(), false);
  assert.equal(document.documentElement.dataset.a11yContrast, 'high');
  assert.equal(document.documentElement.dataset.a11yText, 'large');
  assert.ok(localStorage.getItem(A11Y_STORE_KEY), 'the FOUC mirror still holds the user choice');
});

test('pinned: effect flags are forced off even when the profile turned them on', () => {
  reset();
  localStorage.setItem(CAPTURE_NEUTRAL_KEY, '1');
  // Exactly what hydrateFeatureFlags leaves behind for a profile with jelly on.
  localStorage.setItem('lolly:featureFlags', JSON.stringify({
    [JELLY_FLAG.id]: true, [NEUROSPICY_FLAG.id]: true,
  }));

  assert.equal(applyCaptureNeutral(), true);

  for (const id of NEUTRALISED_FLAGS) {
    assert.equal(flagEnabledSync(id), false, `${id} must be off in a capture`);
  }
  assert.ok(NEUTRALISED_FLAGS.includes(JELLY_FLAG.id), 'jelly is the flag this exists for');
});

test('pinned: an absent flag mirror is still neutralised', () => {
  reset();
  localStorage.setItem(CAPTURE_NEUTRAL_KEY, '1');
  // The case that made this module necessary: nothing in the mirror, and
  // flagEnabledSync treats a missing key as ON.
  assert.equal(flagEnabledSync(JELLY_FLAG.id), true, 'a missing key reads as ON - the bug');
  assert.equal(applyCaptureNeutral(), true);
  assert.equal(flagEnabledSync(JELLY_FLAG.id), false);
});

test('pinned: a11y preferences are cleared, attributes and mirror both', () => {
  reset();
  localStorage.setItem(CAPTURE_NEUTRAL_KEY, '1');
  applyA11yPrefs({ reduceMotion: true, highContrast: true, largeText: true });

  assert.equal(applyCaptureNeutral(), true);

  const d = document.documentElement.dataset;
  assert.equal(d.a11yMotion, undefined);
  assert.equal(d.a11yContrast, undefined);
  assert.equal(d.a11yText, undefined);
  assert.equal(localStorage.getItem(A11Y_STORE_KEY), null);
});

test('pinned: only the literal "1" counts', () => {
  reset();
  localStorage.setItem(CAPTURE_NEUTRAL_KEY, 'true');
  assert.equal(captureNeutralPinned(), false, 'a truthy-looking value must not pin');
});

// ── Contract: the capture pipeline sets what this module reads ────────────────

test('build-docs-shots seeds the pin key this module reads', () => {
  assert.ok(
    SHOTS_SCRIPT.includes(`'${CAPTURE_NEUTRAL_KEY}'`),
    `scripts/build-docs-shots.ts must seed '${CAPTURE_NEUTRAL_KEY}' - the key was renamed on one side only`,
  );
  // It has to be set from the init script (which runs pre-boot), not merely
  // mentioned in prose. The script holds its own const - a build script cannot
  // import a web-shell module - so accept either the literal or that const.
  // Accepts either shape: the original `const CAPTURE_INIT = '...'` or the
  // per-theme factory it became (`const captureInit = (theme) => '...'`). What is
  // asserted is unchanged - the neutral key must be SEEDED from the pre-boot init
  // script, not merely mentioned somewhere in the file.
  const init = /const (?:CAPTURE_INIT|captureInit)\s*=([\s\S]*?);\n/.exec(SHOTS_SCRIPT)?.[1] ?? '';
  assert.ok(init, 'the pre-boot init script (CAPTURE_INIT / captureInit) must exist');
  assert.ok(
    init.includes(CAPTURE_NEUTRAL_KEY) || /\$\{CAPTURE_NEUTRAL_KEY\}/.test(init),
    'the key must be seeded from the init script',
  );
  assert.match(
    SHOTS_SCRIPT,
    new RegExp(`const CAPTURE_NEUTRAL_KEY\\s*=\\s*'${CAPTURE_NEUTRAL_KEY}'`),
    'the script\'s copy of the key must match this module',
  );
});

test('build-docs-shots pins the OS-level preference queries', () => {
  const block = /const (?:CAPTURE_CONTEXT\s*=\s*|captureContext\s*=\s*\([^)]*\)\s*(?::[^=]*)?=>\s*)\(?\{([\s\S]*?)\}/.exec(SHOTS_SCRIPT)?.[1] ?? '';
  assert.ok(block, 'the context prefs (CAPTURE_CONTEXT / captureContext) must exist');
  // These three are read by CSS before any app code runs, so no storage pin can
  // reach them - a dark-mode or high-contrast build machine would publish a
  // differently-styled baseline.
  // colorScheme became per-shot (light baseline, dark where a recipe asks), so
  // accept the literal or the ternary - what matters is that it is PINNED, never
  // left to the build machine's OS setting.
  assert.match(block, /colorScheme:\s*(?:'light'|theme\s*===\s*'dark'\s*\?\s*'dark'\s*:\s*'light')/);
  assert.match(block, /reducedMotion:\s*'no-preference'/);
  assert.match(block, /forcedColors:\s*'none'/);
});

test('every capture context applies both pins', () => {
  // Three capture paths open a context: the raster shot (through captureUrl), the
  // vector print, and the cropSelector measuring pass. A path that skips the pins
  // silently captures un-neutral chrome, which is the whole failure this guards.
  const contexts = SHOTS_SCRIPT.match(/browser\.newContext\(\{[\s\S]*?\}\)/g) ?? [];
  assert.ok(contexts.length >= 2, 'expected the vector + cropSelector contexts');
  for (const c of contexts) {
    assert.ok(/CAPTURE_CONTEXT|captureContext\(/.test(c), `a newContext call is missing the context pins:\n${c}`);
  }
  const captureUrlCall = /captureUrl\(\s*\{[\s\S]*?\}/.exec(SHOTS_SCRIPT)?.[0] ?? '';
  assert.match(captureUrlCall, /initScript:\s*(?:CAPTURE_INIT|captureInit\()/, 'raster path must seed the init script');
  assert.match(captureUrlCall, /contextPrefs:\s*(?:CAPTURE_CONTEXT|captureContext\()/, 'raster path must pin the prefs');
});

test('the first-run tool guide is suppressed by the pin, not by a list of tool ids', () => {
  const guide = readFileSync(join(SRC, 'components', 'tool-guide.ts'), 'utf-8');
  const auto = /export function autoOpenToolGuide[\s\S]*?\n}/.exec(guide)?.[0] ?? '';
  assert.ok(auto, 'autoOpenToolGuide must exist');
  assert.ok(auto.includes('captureNeutralPinned()'),
    'a capture must never get the first-run guide modal - it would bake a dialog over every tool shot');
  // Order matters only in that the pin has to be consulted before the modal opens.
  assert.ok(auto.indexOf('captureNeutralPinned()') < auto.indexOf('showToolGuide'),
    'the pin must be checked before the guide is shown');
});

test('the run verifies neutrality in-page, so the pin cannot become a silent no-op', () => {
  // The unit tests above prove the MECHANISM. This asserts the pipeline also checks
  // the OUTCOME: a jelly gate that stops reading the flag mirror, or a new first-run
  // overlay, would otherwise publish non-neutral chrome across every baseline.
  assert.match(SHOTS_SCRIPT, /const NEUTRAL_PROBE\s*=/, 'the probe must exist');
  assert.match(SHOTS_SCRIPT, /await preflightNeutralState\(baseUrl, shots\)/,
    'the run must preflight neutral state before capturing');
  for (const guard of ['jelly-button', 'data-jelly-nav', 'privacy-notice', 'tool-guide-steps', 'a11yContrast']) {
    assert.ok(SHOTS_SCRIPT.includes(guard), `the probe must still guard ${guard}`);
  }
  // A probe that reports violations but does not fail the run is decoration.
  assert.match(SHOTS_SCRIPT, /capture state is not neutral/, 'a violation must throw');
});

test('main.ts pins neutral state at the one point in boot where it works', () => {
  const pin = MAIN_TS.indexOf('applyCaptureNeutral()');
  assert.ok(pin > 0, 'main.ts must call applyCaptureNeutral()');

  const hydrate = MAIN_TS.indexOf('hydrateFeatureFlags(profile');
  assert.ok(hydrate > 0 && hydrate < pin,
    'the pin must run AFTER hydrateFeatureFlags - that call rewrites the whole flag mirror from the profile, discarding anything set before it');

  // The two reads that act on the flags. Both must come after the pin, or the
  // capture loads the jelly bundle / mounts the neuro dock anyway.
  for (const read of ['flagEnabledSync(\'neurospicy\')', 'if (jellyEnabled())']) {
    const at = MAIN_TS.indexOf(read);
    assert.ok(at > 0, `expected main.ts to still contain ${read}`);
    assert.ok(pin < at, `the pin must run BEFORE ${read}`);
  }

  // The ?neuro demo hook (lib/neuro-demo.ts): peekNeuroDemo() is a pure, memoised
  // URL read and may sit anywhere in boot; the ordering contract binds APPLY - the
  // call that performs the overrideFlagInMemory write - which must run after the
  // pin and after both hydrates, or the hydrates/pin ordering silently regresses
  // under a demo capture. (2026-08-09: neurospicy/atmosphere are deferred off the
  // boot chunk, so applyNeuroDemo lives inside their import().then - textually
  // after the hydrates it also follows at runtime; the old anchor on
  // peekNeuroDemo() predates the deferral.)
  assert.ok(MAIN_TS.indexOf('peekNeuroDemo()') > 0, 'main.ts must call peekNeuroDemo()');
  const demoHook = MAIN_TS.indexOf('applyNeuroDemo(', MAIN_TS.indexOf('from \'./lib/neuro-demo.ts\'') + 1);
  assert.ok(demoHook > 0, 'main.ts must call applyNeuroDemo()');
  assert.ok(pin < demoHook, 'the ?neuro demo apply must run AFTER applyCaptureNeutral()');
  // ...and after both hydrates, which would otherwise overwrite the demo state.
  for (const hydrate of ['hydrateNeurospicy(', 'hydrateAtmosphere(']) {
    const at = MAIN_TS.indexOf(hydrate);
    assert.ok(at > 0 && at < demoHook, `the ?neuro demo apply must run AFTER ${hydrate}`);
  }
});

// Kept LAST in this file on purpose: overrideFlagInMemory is module-level state in
// feature-flags.ts with no un-override API (the demo is one page load), so the
// override this test sets would leak into any flag assertion declared after it.
test('overrideFlagInMemory is memory-only, outranks the mirror, and leaves the pin alone', () => {
  reset();
  localStorage.setItem(CAPTURE_NEUTRAL_KEY, '1');
  assert.equal(applyCaptureNeutral(), true);
  assert.equal(flagEnabledSync(NEUROSPICY_FLAG.id), false, 'the pin forces neurospicy off');
  const mirror = localStorage.getItem('lolly:featureFlags');

  overrideFlagInMemory(NEUROSPICY_FLAG.id, true);
  assert.equal(flagEnabledSync(NEUROSPICY_FLAG.id), true,
    'the in-memory override is consulted before the mirror');
  assert.equal(localStorage.getItem('lolly:featureFlags'), mirror,
    'overrideFlagInMemory must not write localStorage - a ?neuro link affects one page load only');

  // applyCaptureNeutral's behaviour is unchanged by the override existing: it still
  // applies, still writes the same mirror, and still clears the a11y prefs.
  applyA11yPrefs({ highContrast: true });
  assert.equal(applyCaptureNeutral(), true);
  assert.equal(localStorage.getItem('lolly:featureFlags'), mirror);
  assert.equal(document.documentElement.dataset.a11yContrast, undefined);
  // The override still wins the sync read afterwards - that precedence is the point.
  assert.equal(flagEnabledSync(NEUROSPICY_FLAG.id), true);
  assert.equal(flagEnabledSync(JELLY_FLAG.id), false, 'un-overridden flags still read the pinned mirror');
});
