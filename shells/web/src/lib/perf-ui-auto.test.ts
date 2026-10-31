// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI switch against a real jsdom document: the stored
 * record, how it meets a hand choice in the flag reads, both kinds of switch (for good,
 * for a weak device; for a while, for a constrained one), the notice with Undo and Keep,
 * how the notice waits behind a first-run prompt, "Allow again" after an Undo, who never
 * runs it, the start-up software-renderer path through the real WebGPU startup check
 * (with a fake adapter), and the constraint wiring with fake pressure and battery.
 *
 * The decision maths is covered with synthetic frames in perf-ui-auto-detect.test.ts,
 * and with synthetic pressure, battery and calm timelines in
 * perf-ui-auto-temporary.test.ts.
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

const { PERF_UI_AUTO_KEY, readPerfUiAuto, writePerfUiAuto, perfUiAutoPending, allowPerfUiAutoAgain, perfUiAutoOn } = await import('./perf-ui-auto-state.ts');
const { holdFirstRunBanner, settleFirstRunBanner } = await import('./first-run-prompts.ts');
const { PERFORMANCE_UI_FLAG, isFlagOn, isFlagOnSync, hydrateFeatureFlags, applyPerfUi } = await import('../feature-flags.ts');
const auto = await import('./perf-ui-auto.ts');
const { startWebGpuCheck } = await import('./webgpu/device.ts');
const { flushUndoToasts } = await import('./undo-toast.ts');
const { setIframeModeForTest } = await import('./iframe-mode.ts');
const { watchConstraints } = await import('./perf-ui-auto-signals.ts');
const { scaledTimings } = await import('./perf-ui-auto-temporary.ts');

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
  assert.deepEqual(readPerfUiAuto(), { v: 2 });
  const full = { v: 2 as const, on: { kind: 'temporary' as const, reason: 'battery' as const, at: 5, seen: true as const }, undone: { weak: 3 }, backAt: 4 };
  writePerfUiAuto(full);
  assert.deepEqual(readPerfUiAuto(), full);
  for (const bad of ['{', '"on"', '{"v":3,"on":{"kind":"lasting","reason":"slow","at":1}}', '{"v":2,"on":{"kind":"lasting","reason":"fast","at":1}}',
    '{"v":2,"on":{"kind":"lasting","reason":"slow"}}', '{"v":2,"on":{"kind":"temporary","reason":"slow","at":1}}', '{"v":1,"state":"on","reason":"slow"}']) {
    localStorage.setItem(PERF_UI_AUTO_KEY, bad);
    assert.equal(readPerfUiAuto().on, undefined, bad);
    assert.equal(perfUiAutoOn(), false, bad);
  }
  writePerfUiAuto({ v: 2 });
  assert.equal(localStorage.getItem(PERF_UI_AUTO_KEY), null, 'an empty record removes the key');
});

test('a version 1 record reads as its version 2 equivalent', () => {
  localStorage.setItem(PERF_UI_AUTO_KEY, '{"v":1,"state":"on","reason":"software","at":7,"seen":true}');
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'lasting', reason: 'software', at: 7, seen: true } });
  localStorage.setItem(PERF_UI_AUTO_KEY, '{"v":1,"state":"undone","at":9}');
  assert.deepEqual(readPerfUiAuto(), { v: 2, undone: { weak: 9 } }, 'an Undo then stopped the only kind there was');
});

test('only decisions, reason codes and times are stored: never a reading or a level', () => {
  auto.switchPerfUiTemporarily('battery', 11);
  const raw = localStorage.getItem(PERF_UI_AUTO_KEY) ?? '';
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['on', 'v']);
  assert.deepEqual(Object.keys(JSON.parse(raw).on).sort(), ['at', 'kind', 'reason']);
  assert.doesNotMatch(raw, /level|serious|critical|nominal|fair|charging/);
});

test('boot loads the detector only when there is something to do, never after a hand choice', () => {
  assert.equal(perfUiAutoPending(false), true, 'undecided');
  assert.equal(perfUiAutoPending(true), false, 'a hand choice always wins');
  writePerfUiAuto({ v: 2, on: { kind: 'lasting', reason: 'slow', at: 1 } });
  assert.equal(perfUiAutoPending(false), true, 'switched, notice not seen yet');
  writePerfUiAuto({ v: 2, on: { kind: 'lasting', reason: 'slow', at: 1, seen: true } });
  assert.equal(perfUiAutoPending(false), false, 'switched for good and seen: nothing to do');
  writePerfUiAuto({ v: 2, on: { kind: 'temporary', reason: 'pressure', at: 1, seen: true } });
  assert.equal(perfUiAutoPending(false), true, 'on for a while: it watches for calm');
  assert.equal(perfUiAutoPending(true), false, '...unless the person chose by hand');
  writePerfUiAuto({ v: 2, undone: { weak: 1, constrained: 1 } });
  assert.equal(perfUiAutoPending(false), false, 'both kinds undone: never again on this device');
  writePerfUiAuto({ v: 2, undone: { weak: 1 } });
  assert.equal(perfUiAutoPending(false), false, 'a weak-device Undo, in a browser with no pressure or battery signal (jsdom)');
  Object.defineProperty(globalThis, 'PressureObserver', { value: class {}, configurable: true });
  try {
    assert.equal(perfUiAutoPending(false), true, '...but where the temporary kind can run, it still may');
    writePerfUiAuto({ v: 2, undone: { constrained: 1 } });
    assert.equal(perfUiAutoPending(false), true, 'a temporary Undo leaves the weak-device switch');
  } finally { Reflect.deleteProperty(globalThis, 'PressureObserver'); }
});

// ── Meeting the flag reads ─────────────────────────────────────────────────────

test('with nothing stored the flag reads exactly as before: off', () => {
  assert.equal(isFlagOn({}, PERFORMANCE_UI_FLAG), false);
  hydrateFeatureFlags({});
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  assert.equal(JSON.parse(localStorage.getItem('lolly:featureFlags') ?? '{}')['perf-ui'], false);
});

test('an automatic decision turns the flag on, in the profile read and the pre-paint mirror', () => {
  writePerfUiAuto({ v: 2, on: { kind: 'lasting', reason: 'slow', at: 1 } });
  assert.equal(isFlagOn({}, PERFORMANCE_UI_FLAG), true);
  hydrateFeatureFlags({});
  assert.equal(JSON.parse(localStorage.getItem('lolly:featureFlags') ?? '{}')['perf-ui'], true, 'index.html reads this before first paint');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true);
});

test('a hand choice outranks the automatic decision in every read', () => {
  const handOff = { featureFlags: { 'perf-ui': false } };
  for (const kind of ['lasting', 'temporary'] as const) {
    writePerfUiAuto({ v: 2, on: { kind, reason: 'pressure', at: 1 } });
    assert.equal(isFlagOn({}, PERFORMANCE_UI_FLAG), true, `${kind}: on with no hand choice`);
    assert.equal(isFlagOn(handOff, PERFORMANCE_UI_FLAG), false, kind);
    hydrateFeatureFlags(handOff);
    assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false, kind);
  }
  writePerfUiAuto({ v: 2, undone: { weak: 1, constrained: 1 } });
  assert.equal(isFlagOn({ featureFlags: { 'perf-ui': true } }, PERFORMANCE_UI_FLAG), true, 'and a hand ON stays on after an Undo');
});

// ── The switch and its notice ──────────────────────────────────────────────────

test('switching on applies the look, stores the reason and shows Undo and Keep', () => {
  auto.switchPerfUiOn('slow', 1000);
  assert.ok(html().hasAttribute('data-perf-ui'));
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true);
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'lasting', reason: 'slow', at: 1000 } });
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
  assert.deepEqual(readPerfUiAuto().undone, { weak: readPerfUiAuto().undone?.weak }, 'the weak-device kind only');
  assert.equal(typeof readPerfUiAuto().undone?.weak, 'number');
  assert.equal(readPerfUiAuto().on, undefined);
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
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'lasting', reason: 'slow', at: 7, seen: true } });
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
  writePerfUiAuto({ v: 2, on: { kind: 'lasting', reason: 'software', at: 1 } });
  await auto.startPerfUiAuto({ browseRoute: () => null });
  assert.ok(toast());
});

// ── Never stacked on a first-run prompt ─────────────────────────────────────────

test('the notice waits while a first-run prompt is showing, and appears once it is dismissed', async () => {
  const prompt = nudge();
  auto.switchPerfUiOn('software');
  assert.ok(html().hasAttribute('data-perf-ui'), 'the look switches at once');
  assert.equal(readPerfUiAuto().on?.kind, 'lasting');
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
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'lasting', reason: 'slow', at: 3 } }, 'stepping aside is not Keep');
  guide.remove();
  await tick();
  assert.ok(toast(), 'back once the guide closes');
  buttons()[1]!.click(); // Keep
  assert.equal(readPerfUiAuto().on?.seen, true);
  // Settled: a later prompt finds nothing to hold back or bring back.
  const later = nudge();
  await tick();
  later.remove();
  await tick();
  assert.equal(toast(), null);
});

// ── Allow again ────────────────────────────────────────────────────────────────

test('"Allow again" forgets every Undo without turning the look on', () => {
  auto.switchPerfUiOn('slow');
  buttons()[0]!.click(); // Undo
  auto.switchPerfUiTemporarily('pressure');
  buttons()[0]!.click(); // Undo, on the temporary kind too
  assert.deepEqual(Object.keys(readPerfUiAuto().undone ?? {}).sort(), ['constrained', 'weak']);
  assert.equal(perfUiAutoPending(false), false);
  allowPerfUiAutoAgain();
  assert.deepEqual(readPerfUiAuto(), { v: 2 }, 'both suppressions are gone');
  assert.equal(perfUiAutoPending(false), true, 'so the next start loads the detector again');
  assert.equal(html().hasAttribute('data-perf-ui'), false, 'and the look stays off');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  hydrateFeatureFlags({});
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false, 'also on the next start, before anything is measured');
});

test('"Allow again" never touches an automatic switch that is on', () => {
  writePerfUiAuto({ v: 2, on: { kind: 'temporary', reason: 'pressure', at: 9 }, undone: { weak: 2 } });
  allowPerfUiAutoAgain();
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'temporary', reason: 'pressure', at: 9 } });
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

test('in Chromium the watch also reads long tasks and times every frame, and lets go of all of it', () => {
  const observed: string[] = [];
  const disconnected: string[] = [];
  class FakeObserver {
    static supportedEntryTypes = ['long-animation-frame', 'longtask'];
    private type = '';
    observe(opts: { type: string }): void { this.type = opts.type; observed.push(opts.type); }
    disconnect(): void { disconnected.push(this.type); }
  }
  const real = globalThis.PerformanceObserver;
  globalThis.PerformanceObserver = FakeObserver as unknown as typeof PerformanceObserver;
  try {
    const stop = auto.watchPerfUi({ browseRoute: () => 'gallery' }, () => {});
    assert.deepEqual(observed.sort(), ['long-animation-frame', 'longtask']);
    stop();
    assert.deepEqual(disconnected.sort(), ['long-animation-frame', 'longtask']);
  } finally {
    globalThis.PerformanceObserver = real;
  }
  // By source: the frame loop runs on both paths, each frame carries its main-thread
  // time, and the work inside every long frame is recorded before the eligibility check.
  const src = readFileSync(join(HERE, 'perf-ui-auto.ts'), 'utf8');
  assert.match(src, /if \(eligible && !rafId\) rafId = requestAnimationFrame\(frame\);/);
  assert.match(src, /evidence\.compositorFrame\(at, interval, previous \+ Math\.max\(0, now\(\) - at\)\);/);
  assert.ok(src.indexOf('evidence.frameWork(f)') < src.indexOf('if (!eligibleAt(at)) { evidence.cut(at)'), 'long frames rule late frames out even while ineligible');
  assert.match(src, /channel\?\.port1\.close\(\);/);
});

// ── For a while: a constrained device ──────────────────────────────────────────

const message = (): string => toast()?.querySelector('.undo-toast-msg')?.textContent ?? '';

test('a constrained device switches on for a while, and the notice says it is temporary', () => {
  auto.switchPerfUiTemporarily('pressure', 5);
  assert.ok(html().hasAttribute('data-perf-ui'));
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), true, 'the pre-paint mirror too');
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'temporary', reason: 'pressure', at: 5 } });
  assert.equal(message(), 'Lolly switched to the simpler, faster look while this device is busy. It switches back when things calm down.');
  assert.deepEqual(buttons().map(b => b.textContent), ['Undo', 'Keep']);
  flushUndoToasts();
  auto.switchPerfUiBack(6);
  auto.switchPerfUiTemporarily('battery', 7);
  assert.equal(message(), 'Lolly switched to the simpler, faster look while the battery is low. It switches back when this device is charging.');
});

test('Keep turns a temporary switch into a lasting one', () => {
  auto.switchPerfUiTemporarily('pressure', 5);
  buttons()[1]!.click(); // Keep
  assert.ok(html().hasAttribute('data-perf-ui'));
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'lasting', reason: 'pressure', at: 5, seen: true } });
  assert.equal(perfUiAutoPending(false), false, 'nothing left to watch');
  auto.switchPerfUiBack(9);
  assert.ok(html().hasAttribute('data-perf-ui'), 'a lasting look never switches back by itself');
});

test('letting the notice time out leaves the switch temporary', () => {
  auto.switchPerfUiTemporarily('battery', 5);
  flushUndoToasts(); // what the 20 s timeout does
  assert.deepEqual(readPerfUiAuto(), { v: 2, on: { kind: 'temporary', reason: 'battery', at: 5, seen: true } });
  assert.equal(perfUiAutoPending(false), true, 'the next start still watches for calm');
});

test('Undo on a temporary switch turns it off and stops temporary switching only', () => {
  auto.switchPerfUiTemporarily('pressure', 5);
  buttons()[0]!.click(); // Undo
  assert.equal(html().hasAttribute('data-perf-ui'), false);
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  const rec = readPerfUiAuto();
  assert.equal(rec.on, undefined);
  assert.equal(typeof rec.undone?.constrained, 'number');
  assert.equal(rec.undone?.weak, undefined, 'the weak-device switch is a separate choice');
  auto.switchPerfUiTemporarily('pressure', 8);
  assert.equal(html().hasAttribute('data-perf-ui'), false, 'no temporary switch again on this device');
  auto.switchPerfUiOn('slow', 9);
  assert.ok(html().hasAttribute('data-perf-ui'), 'while a weak device can still switch for good');
});

test('switching back is silent, keeps the time, and withdraws a notice still waiting', async () => {
  const prompt = nudge();
  auto.switchPerfUiTemporarily('pressure', 5);
  assert.equal(toast(), null, 'waiting behind the first-run prompt');
  auto.switchPerfUiBack(50);
  assert.equal(html().hasAttribute('data-perf-ui'), false);
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false);
  assert.deepEqual(readPerfUiAuto(), { v: 2, backAt: 50 }, 'when, so the next switch waits its turn');
  prompt.remove();
  await tick();
  assert.equal(toast(), null, 'a notice about a look that has gone never appears');
});

test('a hand choice outranks a temporary switch, and ends the constraint watch', async () => {
  const observers: FakePressure[] = [];
  class FakePressure {
    observed = '';
    disconnected = false;
    readonly deliver: (records: Array<{ state: string }>) => void;
    constructor(deliver: (records: Array<{ state: string }>) => void) { this.deliver = deliver; observers.push(this); }
    observe(source: string): Promise<void> { this.observed = source; return Promise.resolve(); }
    disconnect(): void { this.disconnected = true; }
  }
  Object.defineProperty(globalThis, 'PressureObserver', { value: FakePressure, configurable: true });
  try {
    writePerfUiAuto({ v: 2, on: { kind: 'temporary', reason: 'pressure', at: 1, seen: true } });
    applyPerfUi(true);
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery' });
    assert.equal(observers.length, 1, 'watching for calm');
    assert.equal(observers[0]!.observed, 'cpu');
    applyPerfUi(false); // the person turns it off in Settings
    assert.equal(observers[0]!.disconnected, true, 'their choice ends the watch');
    stop();
  } finally { Reflect.deleteProperty(globalThis, 'PressureObserver'); }
});

test('Undo and Keep on the temporary notice end the constraint watch in this tab', async () => {
  const observers: Array<{ disconnected: boolean; deliver: (records: Array<{ state: string }>) => void }> = [];
  class FakePressure {
    disconnected = false;
    readonly deliver: (records: Array<{ state: string }>) => void;
    constructor(deliver: (records: Array<{ state: string }>) => void) { this.deliver = deliver; observers.push(this); }
    observe(): Promise<void> { return Promise.resolve(); }
    disconnect(): void { this.disconnected = true; }
  }
  Object.defineProperty(globalThis, 'PressureObserver', { value: FakePressure, configurable: true });
  try {
    for (const press of [0, 1]) {
      localStorage.clear();
      writePerfUiAuto({ v: 2, undone: { weak: 1 } }); // only the temporary kind runs
      const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery' });
      auto.switchPerfUiTemporarily('pressure'); // what the watch does once a constraint has lasted
      buttons()[press]!.click();
      assert.equal(observers.at(-1)!.disconnected, true, press ? 'Keep' : 'Undo');
      stop();
    }
  } finally { Reflect.deleteProperty(globalThis, 'PressureObserver'); }
});

test('the constraint wiring: pressure on, calm back, battery reduced to one yes or no, and all of it let go', async () => {
  const observers: Array<{ observed: string; disconnected: boolean; deliver: (records: Array<{ state: string }>) => void }> = [];
  class FakePressure {
    observed = '';
    disconnected = false;
    readonly deliver: (records: Array<{ state: string }>) => void;
    constructor(deliver: (records: Array<{ state: string }>) => void) { this.deliver = deliver; observers.push(this); }
    observe(source: string): Promise<void> { this.observed = source; return Promise.resolve(); }
    disconnect(): void { this.disconnected = true; }
  }
  const battery = Object.assign(new dom.window.EventTarget(), { charging: true, level: 0.9 });
  const added: string[] = [];
  const removed: string[] = [];
  const addB = battery.addEventListener.bind(battery);
  const removeB = battery.removeEventListener.bind(battery);
  battery.addEventListener = ((type: string, ...rest: unknown[]) => { added.push(type); return (addB as (...a: unknown[]) => void)(type, ...rest); }) as typeof battery.addEventListener;
  battery.removeEventListener = ((type: string, ...rest: unknown[]) => { removed.push(type); return (removeB as (...a: unknown[]) => void)(type, ...rest); }) as typeof battery.removeEventListener;
  Object.defineProperty(globalThis, 'PressureObserver', { value: FakePressure, configurable: true });
  Object.defineProperty(dom.window.navigator, 'getBattery', { value: async () => battery, configurable: true });
  const focus = document.hasFocus;
  document.hasFocus = () => true;
  const wait = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms); });
  try {
    const decisions: string[] = [];
    // A thousand times faster: on after 60 ms, calm for 300 ms, at least 600 ms in each state.
    const stop = watchConstraints({ browseRoute: () => 'gallery', busy: () => false, timings: scaledTimings(1000), probe: false },
      d => { decisions.push(d.kind === 'off' ? 'off' : `${d.kind}:${d.reason}`); });
    await wait(20);
    assert.equal(observers[0]?.observed, 'cpu');
    assert.deepEqual(added.sort(), ['chargingchange', 'levelchange']);
    observers[0]!.deliver([{ state: 'serious' }]);
    await wait(400);
    assert.deepEqual(decisions, ['on:pressure']);
    observers[0]!.deliver([{ state: 'nominal' }]);
    await wait(1200);
    assert.deepEqual(decisions, ['on:pressure', 'off'], 'back once calm has lasted and the dwell has passed');
    // The battery: discharging at 15% is a constraint; the level itself goes no further.
    Object.assign(battery, { charging: false, level: 0.15 });
    battery.dispatchEvent(new dom.window.Event('levelchange'));
    await wait(900);
    assert.deepEqual(decisions, ['on:pressure', 'off', 'on:battery']);
    stop();
    assert.equal(observers[0]!.disconnected, true);
    assert.deepEqual(removed.sort(), ['chargingchange', 'levelchange']);
  } finally {
    document.hasFocus = focus;
    Reflect.deleteProperty(globalThis, 'PressureObserver');
    Reflect.deleteProperty(dom.window.navigator, 'getBattery');
  }
});

test('the constraint wiring does nothing where the browser offers no signal (Safari, Firefox)', () => {
  const added: string[] = [];
  const add = document.addEventListener.bind(document);
  document.addEventListener = ((type: string, ...rest: unknown[]) => { added.push(type); return (add as (...a: unknown[]) => void)(type, ...rest); }) as typeof document.addEventListener;
  try {
    const stop = watchConstraints({ browseRoute: () => 'gallery', busy: () => false, timings: scaledTimings(1), probe: false }, () => {});
    stop();
    assert.deepEqual(added, [], 'not even an input listener');
  } finally { document.addEventListener = add; }
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
  assert.deepEqual(readPerfUiAuto().on, { kind: 'lasting', reason: 'software', at: readPerfUiAuto().on?.at });
  assert.ok(!(localStorage.getItem(PERF_UI_AUTO_KEY) ?? '').includes('swiftshader'), 'the renderer string itself is never stored');
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
