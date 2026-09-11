// SPDX-License-Identifier: MPL-2.0
/**
 * Performance HUD flag (perf-hud) - the opt-in, draggable diagnostic overlay.
 *
 * Same split as feature-flags-perf-ui.test.ts:
 *   1. module behaviour against a real jsdom document - the flag shape, the
 *      perfHudOn() gate, and that the HUD mounts ONLY when the flag is on, is
 *      removed when off, and (byte-identical off) starts no rAF loop; and
 *   2. the WIRING, by source scan - the job-toast boot hook mounts it, the
 *      profile toggle mounts/unmounts it, the drag handlers exist, and the CSS
 *      floats it clear of the bottom search bar.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/feature-flags-perf-hud.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url)); // shells/web/src

// A real origin so localStorage doesn't throw SecurityError (as in perf-ui.test.ts).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
// The HUD's FPS loop needs the frame primitives. Bare jsdom doesn't define them
// (that needs pretendToBeVisual), so provide a small setTimeout-backed shim and
// count schedules to prove the loop is gated. clearTimeout on unmount keeps the
// test process from lingering on a pending frame.
let rafCalls = 0;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
  rafCalls += 1;
  return setTimeout(() => cb(Date.now()), 16) as unknown as number;
}) as typeof globalThis.requestAnimationFrame;
globalThis.cancelAnimationFrame = ((id: number): void => {
  clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
}) as typeof globalThis.cancelAnimationFrame;

// Dynamic import AFTER the globals are live, so the modules' document refs resolve.
const { PERF_HUD_FLAG, perfHudOn, isFlagOnSync, setFlagMirror } = await import('./feature-flags.ts');
const { mountPerfHud, unmountPerfHud, isPerfHudMounted } = await import('./lib/perf-hud.ts');

const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');
const PROFILE = read('views/profile.ts');
const JOB_TOAST = read('lib/job-toast.ts');
const HUD = read('lib/perf-hud.ts');
const CSS = read('styles/parts/job-toast.css');

const flagOff = () => localStorage.removeItem('lolly:featureFlags');

test('the flag is opt-in (off by default) with a label, a pill and an explainer', () => {
  assert.equal(PERF_HUD_FLAG.id, 'perf-hud');
  assert.equal(PERF_HUD_FLAG.default, false, 'default OFF - it is opt-in / debug');
  assert.ok(PERF_HUD_FLAG.label, 'has a user-facing label');
  assert.equal(PERF_HUD_FLAG.pill, 'debug', 'the debug pill');
  assert.ok(PERF_HUD_FLAG.info, 'has an explainer for the (i)');
});

test('perfHudOn() / isFlagOnSync read it OFF by default and ON once the mirror is set', () => {
  flagOff();
  assert.equal(isFlagOnSync(PERF_HUD_FLAG), false, 'opt-in ⇒ off with no stored value');
  assert.equal(perfHudOn(), false, 'the gate is off by default');
  setFlagMirror('perf-hud', true);
  assert.equal(isFlagOnSync(PERF_HUD_FLAG), true, 'a stored true wins');
  assert.equal(perfHudOn(), true, 'the gate flips on');
  flagOff();
});

test('mountPerfHud() is byte-identical when off: no element, no rAF loop', () => {
  flagOff();
  unmountPerfHud();          // clean slate
  const before = rafCalls;
  mountPerfHud();
  assert.equal(isPerfHudMounted(), false, 'nothing mounts while the flag is off');
  assert.equal(document.querySelector('.perf-hud'), null, 'no HUD element in the DOM');
  assert.equal(rafCalls, before, 'no FPS loop scheduled while off');
});

test('mountPerfHud() mounts the draggable overlay only when the flag is on', () => {
  setFlagMirror('perf-hud', true);
  mountPerfHud();
  assert.equal(isPerfHudMounted(), true, 'the HUD mounts once the flag is on');
  const el = document.querySelector<HTMLElement>('.perf-hud');
  assert.ok(el, 'the .perf-hud element exists');
  assert.ok(el!.querySelector('[data-hud-drag]'), 'a drag handle to grab');
  assert.ok(el!.querySelector('[data-hud="fps"]'), 'a live FPS readout');
  assert.ok(el!.querySelector('[data-hud="mem"]'), 'a device-memory readout');
  assert.ok(el!.querySelector('[data-hud="cpu"]'), 'a CPU-threads readout');
  // Idempotent - a second mount does not stack a duplicate.
  mountPerfHud();
  assert.equal(document.querySelectorAll('.perf-hud').length, 1, 'no duplicate on re-mount');
  flagOff();
});

test('unmountPerfHud() removes the element entirely (no residue)', () => {
  setFlagMirror('perf-hud', true);
  mountPerfHud();
  assert.ok(document.querySelector('.perf-hud'), 'mounted');
  unmountPerfHud();
  assert.equal(isPerfHudMounted(), false, 'gone after unmount');
  assert.equal(document.querySelector('.perf-hud'), null, 'no element left behind');
  flagOff();
});

test('a pointer-drag repositions the HUD, clamped on-screen', () => {
  setFlagMirror('perf-hud', true);
  mountPerfHud();
  const el = document.querySelector<HTMLElement>('.perf-hud')!;
  const handle = el.querySelector<HTMLElement>('[data-hud-drag]')!;
  // jsdom reports a zero-size rect, so the clamp pins any drag to (0,0) - which is
  // still proof the handlers ran and switched to inline top/left off the CSS corner.
  const down = new dom.window.Event('pointerdown', { bubbles: true }) as unknown as Record<string, unknown>;
  Object.assign(down, { clientX: 40, clientY: 40, pointerId: 1 });
  handle.dispatchEvent(down as unknown as Event);
  assert.equal(el.style.right, 'auto', 'the CSS corner is released on drag start');
  assert.equal(el.style.bottom, 'auto', 'both edges released so the drag owns top/left');
  const move = new dom.window.Event('pointermove', { bubbles: true }) as unknown as Record<string, unknown>;
  Object.assign(move, { clientX: 120, clientY: 90, pointerId: 1 });
  handle.dispatchEvent(move as unknown as Event);
  assert.match(el.style.left, /px$/, 'left set in px by the drag');
  assert.match(el.style.top, /px$/, 'top set in px by the drag');
  const up = new dom.window.Event('pointerup', { bubbles: true }) as unknown as Record<string, unknown>;
  Object.assign(up, { pointerId: 1 });
  handle.dispatchEvent(up as unknown as Event);
  unmountPerfHud();
  flagOff();
});

// ── Wiring, by source scan ──────────────────────────────────────────────────

test('the job-toast boot hook mounts the HUD in the same floating cluster', () => {
  // The import MUST stay dynamic and flag-gated. main.ts mounts the toast at boot, so a
  // static `import { mountPerfHud }` here puts the HUD (1.2 KB gz, measured 2026-08-25)
  // on the entry's modulepreload set for every visitor of an opt-in, default-OFF panel -
  // plans/155 task 3.3. mountPerfHud() still re-reads the flag itself; perfHudOn() here
  // is the loader gate, not a second source of truth.
  assert.ok(!/import \{[^}]*mountPerfHud[^}]*\} from '\.\/perf-hud\.ts'/.test(JOB_TOAST),
    'the boot hook must NOT statically import the HUD');
  assert.match(JOB_TOAST, /if \(perfHudOn\(\)\) void import\('\.\/perf-hud\.ts'\)/, 'boot hook imports it behind the flag');
  assert.match(JOB_TOAST, /mountPerfHud\(\)\)/, 'and calls it from mountJobToast');
});

test('the profile view offers the toggle and mounts/unmounts it live', () => {
  assert.match(PROFILE, /flagRow\(PERF_HUD_FLAG\)/, 'a toggle row in the standalone flags list');
  assert.match(PROFILE, /if \(input\.checked\) mountPerfHud\(\); else unmountPerfHud\(\)/,
    'flipping it mounts/unmounts on the spot (no reload)');
  assert.match(PROFILE, /import \{ mountPerfHud, unmountPerfHud \} from '\.\.\/lib\/perf-hud\.ts'/,
    'profile imports the mount helpers');
});

test('the HUD is drag-wired and reads the live device stats', () => {
  assert.match(HUD, /pointerdown/, 'a pointerdown starts the drag');
  assert.match(HUD, /pointermove/, 'a pointermove repositions');
  assert.match(HUD, /function clamp\(/, 'and the move is clamped on-screen');
  assert.match(HUD, /deviceMemory/, 'reads navigator.deviceMemory');
  assert.match(HUD, /hardwareConcurrency/, 'reads navigator.hardwareConcurrency');
  assert.match(HUD, /requestAnimationFrame\(tick\)/, 'the FPS loop runs off rAF (diagnostic, not reduced-motion gated)');
});

test('the CSS floats the HUD clear of the bottom search bar', () => {
  // Grab the .perf-hud block and assert it clears the footer via the shared idiom.
  const block = CSS.slice(CSS.indexOf('.perf-hud {'));
  assert.ok(block, 'the sheet carries a .perf-hud rule');
  assert.match(block, /position: fixed/, 'body-level fixed, like the toast');
  // The safe-area inset may be spelled as the raw env() or the shared --safe-bottom
  // token (the 2026-08 sweep) - either way it must ride --vv-bottom + a rem lift.
  assert.match(block, /bottom: calc\(var\(--vv-bottom, 0px\)[\s\S]*(safe-area-inset-bottom|var\(--safe-bottom\))[\s\S]*rem\)/,
    'sits above the footer using the same --vv-*/safe-area idiom as gallery.css');
  assert.match(block, /z-index: 9490/, 'above content + the footer (50), just under the job toast (9500)');
});
