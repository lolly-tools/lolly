// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI switch against a real jsdom document: the stored
 * record, how it meets a hand choice in the flag reads, the switch itself, the notice
 * with Undo and Keep, how the notice waits behind a first-run prompt, "Allow again"
 * after an Undo, who never runs it, and the start-up software-renderer path through
 * the real WebGPU startup check (with a fake adapter).
 *
 * The decision maths is covered with synthetic frames in perf-ui-auto-detect.test.ts.
 *
 * Run directly:  node --test shells/web/src/lib/perf-ui-auto.test.ts
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = dirname(fileURLToPath(import.meta.url)); // shells/web/src/lib

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

const { PERF_UI_AUTO_KEY, readPerfUiAuto, writePerfUiAuto, perfUiAutoPending, allowPerfUiAutoAgain } = await import('./perf-ui-auto-state.ts');
const { holdFirstRunBanner, settleFirstRunBanner } = await import('./first-run-prompts.ts');
const { PERFORMANCE_UI_FLAG, isFlagOn, isFlagOnSync, hydrateFeatureFlags, applyPerfUi } = await import('../feature-flags.ts');
const auto = await import('./perf-ui-auto.ts');
const { startWebGpuCheck } = await import('./webgpu/device.ts');
const { flushUndoToasts } = await import('./undo-toast.ts');
const { setIframeModeForTest } = await import('./iframe-mode.ts');

const html = (): HTMLElement => document.documentElement;
/** Let the page's MutationObserver callbacks run. */
const tick = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
/** A first-run prompt as the gallery renders it: the personalise nudge. */
const nudge = (): HTMLElement => {
  const el = document.createElement('aside');
  el.className = 'personalize-nudge';
  el.textContent = 'Add your details to what you make?';
  document.body.append(el);
  return el;
};
const toast = (): HTMLElement | null => document.querySelector('.undo-toast');
const buttons = (): HTMLButtonElement[] => [...(toast()?.querySelectorAll<HTMLButtonElement>('.undo-toast-btn') ?? [])];

beforeEach(() => {
  flushUndoToasts(); // settles any notice left open, and its timer with it
  localStorage.clear();
  applyPerfUi(false);
  document.querySelectorAll('.undo-toast').forEach(el => { el.remove(); });
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

after(() => { flushUndoToasts(); });

// ── The stored record ──────────────────────────────────────────────────────────

test('the record round-trips, and a damaged one reads as nothing (never switches on)', () => {
  assert.equal(readPerfUiAuto(), null);
  writePerfUiAuto({ v: 1, state: 'on', reason: 'slow', at: 5 });
  assert.deepEqual(readPerfUiAuto(), { v: 1, state: 'on', reason: 'slow', at: 5 });
  for (const bad of ['{', '"on"', '{"v":2,"state":"on","reason":"slow","at":1}', '{"v":1,"state":"on","reason":"fast","at":1}', '{"v":1,"state":"on","reason":"slow"}']) {
    localStorage.setItem(PERF_UI_AUTO_KEY, bad);
    assert.equal(readPerfUiAuto(), null, bad);
  }
});

test('boot loads the detector only for an undecided device or an unseen notice, never after a hand choice', () => {
  assert.equal(perfUiAutoPending(false), true, 'undecided');
  assert.equal(perfUiAutoPending(true), false, 'a hand choice always wins');
  writePerfUiAuto({ v: 1, state: 'on', reason: 'slow', at: 1 });
  assert.equal(perfUiAutoPending(false), true, 'switched, notice not seen yet');
  writePerfUiAuto({ v: 1, state: 'on', reason: 'slow', at: 1, seen: true });
  assert.equal(perfUiAutoPending(false), false, 'switched and seen: nothing to do');
  writePerfUiAuto({ v: 1, state: 'undone', at: 1 });
  assert.equal(perfUiAutoPending(false), false, 'undone: never again on this device');
});

// ── Meeting the flag reads ─────────────────────────────────────────────────────

test('with nothing stored the flag reads exactly as before: off', () => {
  assert.equal(isFlagOn({}, PERFORMANCE_UI_FLAG), false);
  hydrateFeatureFlags({});
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  assert.equal(JSON.parse(localStorage.getItem('lolly:featureFlags') ?? '{}')['perf-ui'], false);
});

test('an automatic decision turns the flag on, in the profile read and the pre-paint mirror', () => {
  writePerfUiAuto({ v: 1, state: 'on', reason: 'slow', at: 1 });
  assert.equal(isFlagOn({}, PERFORMANCE_UI_FLAG), true);
  hydrateFeatureFlags({});
  assert.equal(JSON.parse(localStorage.getItem('lolly:featureFlags') ?? '{}')['perf-ui'], true, 'index.html reads this before first paint');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true);
});

test('a hand choice outranks the automatic decision in every read', () => {
  writePerfUiAuto({ v: 1, state: 'on', reason: 'software', at: 1 });
  const handOff = { featureFlags: { 'perf-ui': false } };
  assert.equal(isFlagOn(handOff, PERFORMANCE_UI_FLAG), false);
  hydrateFeatureFlags(handOff);
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  writePerfUiAuto({ v: 1, state: 'undone', at: 1 });
  assert.equal(isFlagOn({ featureFlags: { 'perf-ui': true } }, PERFORMANCE_UI_FLAG), true, 'and a hand ON stays on after an Undo');
});

// ── The switch and its notice ──────────────────────────────────────────────────

test('switching on applies the look, stores the reason and shows Undo and Keep', () => {
  auto.switchPerfUiOn('slow', 1000);
  assert.ok(html().hasAttribute('data-perf-ui'));
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true);
  assert.deepEqual(readPerfUiAuto(), { v: 1, state: 'on', reason: 'slow', at: 1000 });
  const el = toast();
  assert.ok(el, 'a toast is showing');
  assert.equal(el.getAttribute('role'), 'status', 'announced politely');
  assert.ok(el.classList.contains('undo-toast--wrap'), 'a sentence-long message wraps');
  assert.match(el.querySelector('.undo-toast-msg')?.textContent ?? '', /struggling/);
  assert.deepEqual(buttons().map(b => b.textContent), ['Undo', 'Keep']);
});

test('the software reason says so in plain words', () => {
  auto.switchPerfUiOn('software');
  assert.match(toast()?.querySelector('.undo-toast-msg')?.textContent ?? '', /without graphics acceleration/);
});

test('Undo turns it off and stops this device ever switching automatically again', async () => {
  auto.switchPerfUiOn('slow');
  buttons()[0]!.click();
  assert.equal(html().hasAttribute('data-perf-ui'), false);
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  assert.equal(readPerfUiAuto()?.state, 'undone');
  assert.equal(toast(), null, 'the notice goes');
  assert.equal(perfUiAutoPending(false), false, 'boot will not even load the detector');
  const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery' });
  stop();
  assert.equal(html().hasAttribute('data-perf-ui'), false, 'and starting it anyway does nothing');
});

test('Keep leaves it on and marks the notice seen', () => {
  auto.switchPerfUiOn('slow', 7);
  buttons()[1]!.click();
  assert.ok(html().hasAttribute('data-perf-ui'));
  assert.deepEqual(readPerfUiAuto(), { v: 1, state: 'on', reason: 'slow', at: 7, seen: true });
  assert.equal(toast(), null);
});

test('the notice never appears unseen in a hidden tab: it waits for the tab to show', () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  auto.showPerfUiNotice('slow');
  assert.equal(toast(), null);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new dom.window.Event('visibilitychange'));
  assert.ok(toast());
});

test('an unseen notice from an earlier start is shown once more on the next start', async () => {
  writePerfUiAuto({ v: 1, state: 'on', reason: 'software', at: 1 });
  await auto.startPerfUiAuto({ browseRoute: () => null });
  assert.ok(toast());
});

// ── Never stacked on a first-run prompt ─────────────────────────────────────────

test('the notice waits while a first-run prompt is showing, and appears once it is dismissed', async () => {
  const prompt = nudge();
  auto.switchPerfUiOn('software');
  assert.ok(html().hasAttribute('data-perf-ui'), 'the look switches at once');
  assert.equal(readPerfUiAuto()?.state, 'on');
  assert.equal(toast(), null, 'but the notice waits behind "Add your details to what you make?"');
  await tick();
  assert.equal(toast(), null);
  prompt.remove(); // "Not now" or the close button
  await tick();
  assert.ok(toast(), 'shown once the prompt is answered');
});

test('every kind of first-run prompt holds it: the banner slot, the welcome, the models sheet, a tool guide', async () => {
  const kinds: Array<() => HTMLElement> = [
    () => Object.assign(document.createElement('aside'), { className: 'privacy-notice' }),
    () => Object.assign(document.createElement('aside'), { className: 'personalize-nudge offline-nudge' }),
    () => { const d = document.createElement('dialog'); d.className = 'welcome-dialog'; d.setAttribute('open', ''); return d; },
    () => { const d = document.createElement('dialog'); d.className = 'models-welcome'; d.setAttribute('open', ''); return d; },
    () => { const d = document.createElement('dialog'); d.className = 'tool-guide-dialog'; d.setAttribute('open', ''); return d; },
  ];
  for (const make of kinds) {
    const el = make();
    document.body.append(el);
    auto.showPerfUiNotice('slow');
    await tick();
    assert.equal(toast(), null, el.className);
    if (el.tagName === 'DIALOG') el.removeAttribute('open'); else el.hidden = true;
    await tick();
    assert.ok(toast(), `${el.className}: shown once it closes`);
    flushUndoToasts();
    el.remove();
  }
});

test('a gallery banner still waiting to be shown holds it too, and one the gallery keeps hidden lets go', async () => {
  const banner = holdFirstRunBanner(nudge());
  assert.equal(banner?.hidden, true);
  auto.showPerfUiNotice('slow');
  assert.equal(toast(), null, 'the gallery has not decided yet');
  settleFirstRunBanner(banner); // decided: this visit shows no banner
  await tick();
  assert.ok(toast(), 'a banner that stays hidden is not a prompt');
  flushUndoToasts();
  banner?.remove();
});

test('a prompt that opens over the notice comes first: the notice steps aside unrecorded, then returns', async () => {
  auto.switchPerfUiOn('slow', 3);
  assert.ok(toast());
  const guide = document.createElement('dialog');
  guide.className = 'tool-guide-dialog';
  guide.setAttribute('open', '');
  document.body.append(guide); // a tool's guide opening on its first visit
  await tick();
  assert.equal(toast(), null, 'never stacked');
  assert.deepEqual(readPerfUiAuto(), { v: 1, state: 'on', reason: 'slow', at: 3 }, 'stepping aside is not Keep');
  guide.remove();
  await tick();
  assert.ok(toast(), 'back once the guide closes');
  buttons()[1]!.click(); // Keep
  const kept = readPerfUiAuto();
  assert.equal(kept?.state === 'on' ? kept.seen : undefined, true);
  // Settled: a later prompt finds nothing to hold back or bring back.
  const later = nudge();
  await tick();
  later.remove();
  await tick();
  assert.equal(toast(), null);
});

// ── Allow again ────────────────────────────────────────────────────────────────

test('"Allow again" forgets an Undo without turning the look on', () => {
  auto.switchPerfUiOn('slow');
  buttons()[0]!.click(); // Undo
  assert.equal(perfUiAutoPending(false), false);
  allowPerfUiAutoAgain();
  assert.equal(readPerfUiAuto(), null, 'the suppression is gone');
  assert.equal(perfUiAutoPending(false), true, 'so the next start loads the detector again');
  assert.equal(html().hasAttribute('data-perf-ui'), false, 'and the look stays off');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  hydrateFeatureFlags({});
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false, 'also on the next start, before anything is measured');
});

test('"Allow again" never touches an automatic switch that is on', () => {
  writePerfUiAuto({ v: 1, state: 'on', reason: 'software', at: 9 });
  allowPerfUiAutoAgain();
  assert.deepEqual(readPerfUiAuto(), { v: 1, state: 'on', reason: 'software', at: 9 });
});

// ── Who never runs it ──────────────────────────────────────────────────────────

test('an automated browser, a documentation capture and a framed tool never run it', () => {
  assert.equal(auto.perfUiAutoAllowedHere(), true, 'an ordinary page');
  Object.defineProperty(dom.window.navigator, 'webdriver', { value: true, configurable: true });
  try {
    assert.equal(auto.perfUiAutoAllowedHere(), false, 'automation');
    localStorage.setItem(auto.PERF_UI_AUTO_PROBE_KEY, '1');
    assert.equal(auto.perfUiAutoAllowedHere(), true, 'a browser test opts back in');
    localStorage.setItem('lolly-capture-neutral', '1');
    assert.equal(auto.perfUiAutoAllowedHere(), false, 'a docs capture never, even opted in');
  } finally {
    Object.defineProperty(dom.window.navigator, 'webdriver', { value: false, configurable: true });
  }
  localStorage.clear();
  setIframeModeForTest(true);
  try { assert.equal(auto.perfUiAutoAllowedHere(), false, 'a tool framed in another page'); }
  finally { setIframeModeForTest(); }
});

test('the watch ends, listeners and all, the moment the person changes the flag by hand', () => {
  const added: string[] = [];
  const removed: string[] = [];
  const add = document.addEventListener.bind(document);
  const remove = document.removeEventListener.bind(document);
  document.addEventListener = ((type: string, ...rest: unknown[]) => { added.push(type); return (add as (...a: unknown[]) => void)(type, ...rest); }) as typeof document.addEventListener;
  document.removeEventListener = ((type: string, ...rest: unknown[]) => { removed.push(type); return (remove as (...a: unknown[]) => void)(type, ...rest); }) as typeof document.removeEventListener;
  try {
    let decided = false;
    auto.watchPerfUi({ browseRoute: () => 'gallery' }, () => { decided = true; });
    for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'scroll']) assert.ok(added.includes(type), `listens for ${type}`);
    applyPerfUi(true); // a hand toggle in Settings ends here
    for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'scroll', 'visibilitychange']) assert.ok(removed.includes(type), `stops listening for ${type}`);
    assert.equal(decided, false);
  } finally {
    document.addEventListener = add;
    document.removeEventListener = remove;
  }
});

// ── Signal (a), end to end through the real startup check ──────────────────────

test('a software adapter from the WebGPU startup check switches at start-up', async () => {
  const limits = { maxStorageBuffersPerShaderStage: 8, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256, maxStorageBufferBindingSize: 1 << 27 };
  const adapter = {
    info: { vendor: 'google', architecture: 'swiftshader', device: '', description: '', isFallbackAdapter: true },
    requestDevice: async () => ({ limits, destroy() {}, lost: new Promise(() => {}) }),
  };
  Object.defineProperty(dom.window.navigator, 'gpu', { value: { requestAdapter: async () => adapter }, configurable: true });
  await startWebGpuCheck();
  const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery' });
  stop();
  assert.ok(html().hasAttribute('data-perf-ui'));
  const rec = readPerfUiAuto();
  assert.equal(rec?.state === 'on' ? rec.reason : null, 'software');
  assert.ok(!JSON.stringify(readPerfUiAuto()).includes('swiftshader'), 'the renderer string itself is never stored');
});

// ── Wiring, by source ──────────────────────────────────────────────────────────

test('boot starts it only when pending, after load and the welcome, and never for a scripted export', () => {
  const main = readFileSync(join(HERE, '..', 'main.ts'), 'utf8');
  assert.match(main, /if \(!scriptedExport && perfUiAutoPending\(perfUiHandChoice\)\) onWindowLoad\(\(\) => \{ void welcomeSettled\(\)\.then\(\(\) => import\('\.\/lib\/perf-ui-auto\.ts'\)\)/);
  assert.match(main, /footer === 'search'/, 'browse routes only');
});

test('the toast adds no motion of its own: its drain bar already stops under both reduce-motion switches', () => {
  const css = readFileSync(join(HERE, '..', 'styles', 'parts', 'job-toast.css'), 'utf8');
  const wrap = css.slice(css.indexOf('.undo-toast--wrap'), css.indexOf('@media (pointer: coarse)'));
  assert.doesNotMatch(wrap, /animation|transition/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.undo-toast-bar \{ animation: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.undo-toast-bar \{ animation: none; \} \}/);
});
