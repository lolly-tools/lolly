// SPDX-License-Identifier: MPL-2.0
/**
 * The automatic Performance UI switch with two tabs open on one device. Each tab runs its
 * own watches over the one record they share, so an Undo, a Keep or a hand choice made in
 * one tab must stand in the other: an automatic change reads the record again before it
 * writes and asks the profile about a hand choice, and the storage event ends the other
 * tab's watches.
 *
 * Two simulated tabs: tab B is this file's copy of lib/perf-ui-auto.ts on the main jsdom
 * document; tab A is a second copy of the module (imported under a query string, so its
 * notice and watch state are its own) that acts on a second, hidden document. Both share
 * one localStorage, as two tabs of one origin do, and what tab A writes reaches tab B as
 * a storage event, as a browser delivers one. The profile both tabs read is one shared
 * object, standing in for IndexedDB.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/perf-ui-auto-tabs.test.ts
 */
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const domB = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const domA = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = domB.window as unknown as typeof globalThis.window;
globalThis.document = domB.window.document;
globalThis.localStorage = domB.window.localStorage;
globalThis.HTMLElement = domB.window.HTMLElement;
globalThis.MutationObserver = domB.window.MutationObserver;
Object.defineProperty(globalThis, 'navigator', { value: domB.window.navigator, configurable: true });

const { PERF_UI_AUTO_KEY, readPerfUiAuto, writePerfUiAuto } = await import('./perf-ui-auto-state.ts');
const { FLAG_MIRROR_KEY, PERFORMANCE_UI_FLAG, applyPerfUi, isFlagOnSync, setFlagMirror } = await import('../feature-flags.ts');
const { flushUndoToasts } = await import('./undo-toast.ts');
const { startWebGpuCheck } = await import('./webgpu/device.ts');
/** Tab B, the tab under test. */
const auto = await import('./perf-ui-auto.ts');
/** Tab A, the other tab: its own copy of the module. */
const TAB_A = './perf-ui-auto.ts?tab=a';
const tabA = await import(TAB_A) as typeof import('./perf-ui-auto.ts');

/** The profile both tabs read, standing in for the copy in IndexedDB. */
const profile: { featureFlags?: Record<string, boolean> } = {};
const handChoice = (): Promise<boolean> => Promise.resolve(profile.featureFlags?.[PERFORMANCE_UI_FLAG.id] !== undefined);

const html = (): HTMLElement => domB.window.document.documentElement;
const toast = (): HTMLElement | null => domB.window.document.querySelector('.undo-toast');
const buttons = (): HTMLButtonElement[] => [...(toast()?.querySelectorAll<HTMLButtonElement>('.undo-toast-btn') ?? [])];
const wait = (ms: number): Promise<void> => new Promise(resolve => { setTimeout(resolve, ms); });

/**
 * Act as tab A: its document and module copy, over the shared localStorage. Then each key
 * it changed reaches tab B as one storage event, as a browser delivers it to the other
 * tabs (never to the tab that wrote).
 */
function inTabA(act: () => void): void {
  const keys = [PERF_UI_AUTO_KEY, FLAG_MIRROR_KEY];
  const before = keys.map(key => localStorage.getItem(key));
  const own = { window: globalThis.window, document: globalThis.document, HTMLElement: globalThis.HTMLElement, MutationObserver: globalThis.MutationObserver };
  globalThis.window = domA.window as unknown as typeof globalThis.window;
  globalThis.document = domA.window.document;
  globalThis.HTMLElement = domA.window.HTMLElement;
  globalThis.MutationObserver = domA.window.MutationObserver;
  try { act(); } finally { Object.assign(globalThis, own); }
  keys.forEach((key, i) => {
    const newValue = localStorage.getItem(key);
    if (newValue === before[i]) return;
    domB.window.dispatchEvent(new domB.window.StorageEvent('storage', { key, oldValue: before[i], newValue, storageArea: localStorage, url: 'https://lolly.tools/' }));
  });
}

/** Stand-ins for the browser APIs the two watches read, recording what each one lets go. */
function fakeSignals(): { pressure: Array<{ disconnected: boolean; deliver(records: Array<{ state: string }>): void }>; frames: string[]; restore(): void } {
  const pressure: Array<{ disconnected: boolean; deliver(records: Array<{ state: string }>): void }> = [];
  const frames: string[] = [];
  class FakePressure {
    disconnected = false;
    readonly deliver: (records: Array<{ state: string }>) => void;
    constructor(deliver: (records: Array<{ state: string }>) => void) { this.deliver = deliver; pressure.push(this); }
    observe(): Promise<void> { return Promise.resolve(); }
    disconnect(): void { this.disconnected = true; }
  }
  class FakeFrames {
    static supportedEntryTypes = ['long-animation-frame', 'longtask'];
    private type = '';
    observe(opts: { type: string }): void { this.type = opts.type; }
    disconnect(): void { frames.push(this.type); }
  }
  const realObserver = globalThis.PerformanceObserver;
  Object.defineProperty(globalThis, 'PressureObserver', { value: FakePressure, configurable: true });
  globalThis.PerformanceObserver = FakeFrames as unknown as typeof PerformanceObserver;
  return {
    pressure,
    frames,
    restore: () => { Reflect.deleteProperty(globalThis, 'PressureObserver'); globalThis.PerformanceObserver = realObserver; },
  };
}

beforeEach(() => {
  flushUndoToasts();
  localStorage.clear();
  delete profile.featureFlags;
  applyPerfUi(false);
  domB.window.document.querySelectorAll('.undo-toast').forEach(el => { el.remove(); });
  Object.defineProperty(domB.window.document, 'visibilityState', { value: 'visible', configurable: true });
  // Tab A sits in the background: its own notices wait there and never reach tab B's page.
  Object.defineProperty(domA.window.document, 'visibilityState', { value: 'hidden', configurable: true });
});

after(() => { flushUndoToasts(); });

// ── An automatic change reads the record again before it writes ────────────────

test('an Undo in another tab stands: a switch for good decided here later changes nothing', () => {
  inTabA(() => {
    tabA.switchPerfUiOn('slow', 10);
    tabA.undoPerfUiAuto(11, 'slow'); // Undo on tab A's notice
  });
  assert.deepEqual(readPerfUiAuto(), { v: 2, undone: { weak: 11 } });
  auto.switchPerfUiOn('slow', 20); // tab B's slowness watch decides a minute later
  assert.deepEqual(readPerfUiAuto(), { v: 2, undone: { weak: 11 } }, 'the Undo is still the record');
  assert.equal(html().hasAttribute('data-perf-ui'), false, 'the look stays off here');
  assert.equal(isFlagOnSync(PERFORMANCE_UI_FLAG), false, 'and in the mirror every later start reads');
  assert.equal(toast(), null, 'no notice about a switch that did not happen');
});

test('a Keep in another tab stands: neither kind of switch decided here rewrites it', () => {
  inTabA(() => {
    tabA.switchPerfUiTemporarily('pressure', 10);
    tabA.keepPerfUiAuto(); // Keep on tab A's notice: lasting now
  });
  const kept = { v: 2, on: { kind: 'lasting', reason: 'pressure', at: 10, seen: true } };
  assert.deepEqual(readPerfUiAuto(), kept);
  auto.switchPerfUiOn('slow', 20);
  assert.deepEqual(readPerfUiAuto(), kept, 'the reason and the seen notice stay as Keep left them');
  auto.switchPerfUiTemporarily('battery', 21);
  assert.deepEqual(readPerfUiAuto(), kept, 'and a lasting look never turns temporary');
  assert.equal(toast(), null);
});

test('an Undo of temporary switching in another tab stands here too', () => {
  inTabA(() => {
    tabA.switchPerfUiTemporarily('pressure', 10);
    tabA.undoPerfUiAuto(11, 'pressure');
  });
  auto.switchPerfUiTemporarily('pressure', 20);
  assert.deepEqual(readPerfUiAuto(), { v: 2, undone: { constrained: 11 } });
  assert.equal(html().hasAttribute('data-perf-ui'), false);
});

test('a look switched on for a while in another tab is no reason to switch for good here', () => {
  inTabA(() => { tabA.switchPerfUiTemporarily('battery', 10); });
  auto.switchPerfUiOn('slow', 20);
  assert.deepEqual(readPerfUiAuto().on, { kind: 'temporary', reason: 'battery', at: 10 }, 'still temporary, so it can switch back');
});

test('Undo on a notice records the kind that notice described, whatever another tab did since', () => {
  auto.switchPerfUiTemporarily('pressure', 5); // tab B's own notice, for a while
  inTabA(() => {
    tabA.switchPerfUiTemporarily('pressure', 6);
    tabA.keepPerfUiAuto(); // tab A keeps its own: the record says lasting now
  });
  buttons()[0]!.click(); // Undo on tab B's notice
  const rec = readPerfUiAuto();
  assert.equal(rec.on, undefined);
  assert.equal(typeof rec.undone?.constrained, 'number', 'temporary switching stops, as the notice said');
  assert.equal(rec.undone?.weak, undefined, 'the weak-device switch was never on offer');
  assert.equal(html().hasAttribute('data-perf-ui'), false);
});

// ── The storage event ends the matching watch in the other tab ─────────────────

test('an Undo in another tab ends the matching watch here, and only that one', async () => {
  const fake = fakeSignals();
  try {
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    assert.equal(fake.pressure.length, 1, 'watching for a constrained device');
    assert.deepEqual(fake.frames, [], 'and for slowness');
    inTabA(() => {
      tabA.switchPerfUiOn('slow', 10);
      tabA.undoPerfUiAuto(11, 'slow');
    });
    await wait(0);
    assert.deepEqual(fake.frames.sort(), ['long-animation-frame', 'longtask'], 'the slowness watch has ended');
    assert.equal(fake.pressure[0]!.disconnected, false, 'temporary switching was not undone');
    inTabA(() => {
      tabA.switchPerfUiTemporarily('pressure', 12);
      tabA.undoPerfUiAuto(13, 'pressure');
    });
    await wait(0);
    assert.equal(fake.pressure[0]!.disconnected, true, 'now that watch has ended too');
    assert.equal(html().hasAttribute('data-perf-ui'), false, 'nothing switched here');
    stop();
  } finally { fake.restore(); }
});

test('a look kept in another tab ends both watches here', async () => {
  const fake = fakeSignals();
  try {
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    inTabA(() => {
      tabA.switchPerfUiTemporarily('pressure', 10);
      tabA.keepPerfUiAuto();
    });
    await wait(0);
    assert.deepEqual(fake.frames.sort(), ['long-animation-frame', 'longtask']);
    assert.equal(fake.pressure[0]!.disconnected, true);
    stop();
  } finally { fake.restore(); }
});

test('a hand choice in another tab ends every watch here, once the profile confirms the choice', async () => {
  const fake = fakeSignals();
  try {
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    inTabA(() => {
      // What Settings does on a hand toggle (views/profile/rows.ts).
      profile.featureFlags = { [PERFORMANCE_UI_FLAG.id]: true };
      setFlagMirror(PERFORMANCE_UI_FLAG.id, true);
      applyPerfUi(true);
    });
    await wait(0);
    assert.deepEqual(fake.frames.sort(), ['long-animation-frame', 'longtask']);
    assert.equal(fake.pressure[0]!.disconnected, true);
    stop();
  } finally { fake.restore(); }
});

test('a mirror change that is no hand choice (another tab switching by itself) leaves the watches running', async () => {
  const fake = fakeSignals();
  try {
    writePerfUiAuto({ v: 2, undone: { weak: 1 } }); // only temporary switching runs here
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    inTabA(() => { setFlagMirror(PERFORMANCE_UI_FLAG.id, true); });
    await wait(0);
    assert.equal(fake.pressure[0]!.disconnected, false);
    stop();
    assert.equal(fake.pressure[0]!.disconnected, true, 'stop() lets go');
  } finally { fake.restore(); }
});

test('a hand choice the storage event never carried still stops a decision here: the profile is asked first', async () => {
  const fake = fakeSignals();
  const focus = domB.window.document.hasFocus;
  const info = console.info;
  domB.window.document.hasFocus = () => true;
  console.info = () => {};
  // A thousand times faster: on after 60 ms of 'serious' (the probe allows the scale).
  localStorage.setItem(auto.PERF_UI_AUTO_PROBE_KEY, '1');
  localStorage.setItem(auto.PERF_UI_AUTO_TIMESCALE_KEY, '1000');
  writePerfUiAuto({ v: 2, undone: { weak: 1 } });
  try {
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    // Chosen elsewhere with nothing in this tab's storage to show for it (a profile that
    // arrived by sync, say).
    profile.featureFlags = { [PERFORMANCE_UI_FLAG.id]: false };
    fake.pressure[0]!.deliver([{ state: 'serious' }]);
    await wait(400);
    assert.equal(readPerfUiAuto().on, undefined, 'the watch decided, and the profile said no');
    assert.equal(html().hasAttribute('data-perf-ui'), false);
    assert.equal(toast(), null);
    assert.equal(fake.pressure[0]!.disconnected, true, 'and the watch has ended');
    stop();
  } finally {
    fake.restore();
    domB.window.document.hasFocus = focus;
    console.info = info;
  }
});

test('with no hand choice the same decision switches, so the wait for the profile changes nothing else', async () => {
  const fake = fakeSignals();
  const focus = domB.window.document.hasFocus;
  const info = console.info;
  domB.window.document.hasFocus = () => true;
  console.info = () => {};
  localStorage.setItem(auto.PERF_UI_AUTO_PROBE_KEY, '1');
  localStorage.setItem(auto.PERF_UI_AUTO_TIMESCALE_KEY, '1000');
  writePerfUiAuto({ v: 2, undone: { weak: 1 } });
  try {
    const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
    fake.pressure[0]!.deliver([{ state: 'serious' }]);
    await wait(400);
    assert.equal(readPerfUiAuto().on?.kind, 'temporary');
    assert.ok(html().hasAttribute('data-perf-ui'));
    stop();
  } finally {
    fake.restore();
    domB.window.document.hasFocus = focus;
    console.info = info;
  }
});

// Last: the startup check's adapter facts stay for the rest of this file.
test('the start-up switch for good asks the profile too: a hand choice made since boot read it stands', async () => {
  const limits = { maxStorageBuffersPerShaderStage: 8, maxComputeInvocationsPerWorkgroup: 256, maxComputeWorkgroupSizeX: 256, maxStorageBufferBindingSize: 1 << 27 };
  const adapter = {
    info: { vendor: 'google', architecture: 'swiftshader', device: '', description: '', isFallbackAdapter: true },
    requestDevice: async () => ({ limits, destroy() {}, lost: new Promise(() => {}) }),
  };
  Object.defineProperty(domB.window.navigator, 'gpu', { value: { requestAdapter: async () => adapter }, configurable: true });
  await startWebGpuCheck();
  profile.featureFlags = { [PERFORMANCE_UI_FLAG.id]: false }; // chosen in another tab
  const stop = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
  stop();
  assert.equal(readPerfUiAuto().on, undefined);
  assert.equal(html().hasAttribute('data-perf-ui'), false);
  delete profile.featureFlags;
  const again = await auto.startPerfUiAuto({ browseRoute: () => 'gallery', handChoice });
  again();
  assert.equal(readPerfUiAuto().on?.reason, 'software', 'with no hand choice it switches as before');
});
