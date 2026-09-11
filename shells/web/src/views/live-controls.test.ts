// SPDX-License-Identifier: MPL-2.0
/**
 * live-controls contract tests - the Play (animated asset) + Go live (camera)
 * state machine and its SIDEBAR placement beside the asset picker.
 *
 * Driven through the REAL createLiveControls/mountSidebarLiveControls against a
 * jsdom panel that mirrors renderInputs' documented asset-picker markup
 * (.asset-picker-row + slot-actions - tool-inputs.ts controlHtml). The runtime
 * and host are stubs recording what the controller drives: which frame source is
 * armed (media.armAnimSource) and how the runtime loop is started - including
 * the provenance-critical `{ source: 'asset' }` for replayed assets.
 *
 * NOT covered here (needs a browser): the media bridge's actual frame sampling
 * (SVG bake / ImageDecoder stepping / <video> drawImage) and camera permissions.
 *
 * Run directly:  node --test shells/web/src/views/live-controls.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true, url: 'https://example.test/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'CustomEvent', 'getComputedStyle']) {
  try { (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k]; } catch { /* getter-only */ }
}
// mountSidebarLiveControls uses CSS.escape; give jsdom a fallback if absent.
const cssGlobal = (dom.window as unknown as { CSS?: { escape?: (s: string) => string } }).CSS;
if (!cssGlobal?.escape) {
  (globalThis as Record<string, unknown>).CSS = { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`) };
} else {
  (globalThis as Record<string, unknown>).CSS = cssGlobal;
}

const { createLiveControls, registerLiveControls, mountSidebarLiveControls } =
  await import('./live-controls.ts');

const tick = async (n = 4): Promise<void> => { for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0)); };
const t = (s: string) => s;

const ANIM_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><style>@keyframes spin { to { transform: rotate(1turn) } } .s { animation: spin 9s linear infinite }</style><g class="s"/></svg>';
const STILL_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="4" height="4"/></svg>';

interface Ref { type?: string; format?: string; url?: string; meta?: Record<string, unknown> }

function makeRuntime(image: Ref | null = null, render: Record<string, unknown> = { liveDefault: 'lolly/demo/lolly-spin' }) {
  const starts: Array<string> = [];
  let stops = 0;
  let live = false;
  const model: Array<{ id: string; type?: string; value: unknown }> = [
    { id: 'effect', type: 'select', value: 'halftone' },
    { id: 'image', type: 'asset', value: image },
  ];
  const rt = {
    hasFrameHook: true,
    isLive: () => live,
    startLive: async (o?: { source?: string }) => { starts.push(o?.source ?? 'camera'); live = true; return true; },
    stopLive: () => { stops++; live = false; },
    getModel: () => model,
    manifest: { id: 'filter', render },
  };
  return {
    rt, starts, stops: () => stops,
    setImage: (v: Ref | null) => { model[1] = { id: 'image', type: 'asset', value: v }; },
  };
}

function makeHost(svgByUrl: Record<string, string> = {}) {
  const armed: unknown[] = [];
  const host = {
    media: { isAvailable: () => true, armAnimSource: (s: unknown) => { armed.push(s); } },
    assets: { get: async (id: string) => ({ id, url: `blob:asset-${id}` }) },
    log: () => {},
  };
  const fetchSvgMarkup = async (url: string): Promise<string> => {
    const hit = svgByUrl[url];
    return hit !== undefined ? hit : ANIM_SVG; // the sample asset's markup by default
  };
  return { host, armed, fetchSvgMarkup };
}

/** A panel mirroring renderInputs' asset-picker card (the structure
 *  mountSidebarLiveControls targets: the pick trigger inside .asset-slot-source,
 *  which is where Use camera / Play join it). `withSettings` adds the settings row
 *  (a Fit-canvas chip) below, which the source cluster must not land in. */
function panelWithAssetRow(withSettings = false): HTMLElement {
  const panel = document.createElement('div');
  panel.innerHTML = `<div class="input input--asset" role="group">
      <span class="input-label">Image</span>
      <div class="asset-picker-row asset-slot has-value">
        <div class="asset-slot-source">
          <button type="button" class="asset-picker-trigger asset-slot-tab" data-input-id="image"><span class="asset-slot-tab-label">Use image</span></button>
        </div>
        ${withSettings ? '<div class="asset-slot-settings"><div class="slot-actions"><button type="button" class="slot-act" data-fit-id="image">⤡ Fit canvas</button></div></div>' : ''}
      </div>
    </div>`;
  document.body.appendChild(panel);
  return panel;
}

function makeControls(o: {
  image?: Ref | null; render?: Record<string, unknown>; svgByUrl?: Record<string, string>;
  announce?: (msg: string) => void; canDecodeRaster?: boolean;
} = {}) {
  const r = makeRuntime(o.image ?? null, o.render ?? { liveDefault: 'lolly/demo/lolly-spin' });
  const h = makeHost(o.svgByUrl ?? {});
  const lc = createLiveControls({
    runtime: r.rt, host: h.host, t,
    announce: o.announce ?? (() => {}),
    fetchSvgMarkup: h.fetchSvgMarkup,
    canDecodeRaster: o.canDecodeRaster ?? true,
  });
  return { ...r, ...h, lc };
}

// ── Sidebar placement ────────────────────────────────────────────────────────

test('sidebar: Play + Go live join the asset source tab row, after the pick tab', async () => {
  const { rt, lc } = makeControls();
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(true);
  mountSidebarLiveControls(panel, rt);

  const source = panel.querySelector('.asset-slot-source')!;
  const cluster = source.querySelector('[data-live-cluster="image"]');
  assert.ok(cluster, 'the live cluster joins the source tab row');
  // The "Use image" pick tab LEADS; Use camera / Play follow it.
  assert.ok(source.firstElementChild?.classList.contains('asset-slot-tab'), 'pick tab leads the source row');
  assert.equal(source.lastElementChild, cluster, 'live controls follow the pick tab');
  assert.ok(cluster!.querySelector('[data-live-play]'), 'Play button present');
  assert.ok(cluster!.querySelector('[data-live-camera]'), 'Go live button present');
  // The settings row (Fit canvas) is a sibling below - the cluster does NOT land there.
  assert.ok(!panel.querySelector('.asset-slot-settings [data-live-cluster]'), 'live controls are not in the settings row');

  // Re-mount after a panel rebuild is idempotent per rebuild.
  mountSidebarLiveControls(panel, rt);
  assert.equal(panel.querySelectorAll('[data-live-cluster]').length, 1);
  panel.remove();
  lc.dispose();
});

test('sidebar: the live cluster mounts in the source row even when the slot has no settings', () => {
  const { rt, lc } = makeControls();
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, rt);
  const source = panel.querySelector('.asset-slot-source');
  assert.ok(source?.querySelector('[data-live-cluster="image"]'), 'cluster joined the source row');
  assert.ok(source!.querySelector('[data-live-play]'));
  panel.remove();
  lc.dispose();
});

test('auto-camera: render.liveCameraWhen starts the camera on load and stops when the mode leaves camera', async () => {
  let starts = 0, stops = 0, live = false;
  const model = [{ id: 'mode', type: 'select', value: 'camera' }];
  const rt = {
    hasFrameHook: true,
    isLive: () => live,
    startLive: async () => { starts++; live = true; return true; },
    stopLive: () => { stops++; live = false; },
    getModel: () => model,
    manifest: { id: 'scan-code', render: { liveCameraWhen: { input: 'mode', value: 'camera' } } },
  };
  const h = makeHost();
  const lc = createLiveControls({ runtime: rt, host: h.host, t, announce: () => {}, fetchSvgMarkup: h.fetchSvgMarkup });
  registerLiveControls(rt as object, lc);

  // On load (mode=camera): auto-starts, no tap.
  lc.syncFromModel(model);
  await tick();
  assert.equal(starts, 1, 'camera auto-started on load in camera mode');
  assert.equal(live, true);

  // Switch the source away from camera: it stops.
  model[0] = { id: 'mode', type: 'select', value: 'image' };
  lc.syncFromModel(model);
  await tick();
  assert.equal(stops, 1, 'stopped when the mode left camera');
  assert.equal(live, false);

  // Switch back to camera: it starts again.
  model[0] = { id: 'mode', type: 'select', value: 'camera' };
  lc.syncFromModel(model);
  await tick();
  assert.equal(starts, 2, 're-started when the mode returned to camera');
  lc.dispose();
});

test('auto-camera: a load-time start that does not open is retried on the first tap (iOS gesture)', async () => {
  let attempts = 0, live = false;
  const model = [{ id: 'mode', type: 'select', value: 'camera' }];
  const rt = {
    hasFrameHook: true,
    isLive: () => live,
    // iOS Safari won't open the camera from a bare page-load call: model that as
    // the first attempt not opening, then succeeding once a gesture drives it.
    startLive: async () => { attempts++; if (attempts === 1) return false; live = true; return true; },
    stopLive: () => { live = false; },
    getModel: () => model,
    manifest: { id: 'scan-code', render: { liveCameraWhen: { input: 'mode', value: 'camera' } } },
  };
  const h = makeHost();
  const lc = createLiveControls({ runtime: rt, host: h.host, t, announce: () => {}, fetchSvgMarkup: h.fetchSvgMarkup });
  registerLiveControls(rt as object, lc);

  lc.syncFromModel(model);
  await tick();
  assert.equal(attempts, 1, 'tried to open on load');
  assert.equal(live, false, 'did not open without a gesture');

  // The first tap anywhere (the big viewfinder included) retries and opens it.
  document.dispatchEvent(new Event('pointerdown'));
  await tick();
  assert.equal(attempts, 2, 'retried on the first tap');
  assert.equal(live, true, 'camera opened after the gesture');
  lc.dispose();
});

test('auto-camera: a load-time NotAllowedError is NOT a denial - the first tap still prompts, and a denial THERE is remembered (iOS)', async () => {
  // iOS Safari rejects a getUserMedia call made outside a user gesture with
  // NotAllowedError WITHOUT prompting - that is not a real denial, so it must not
  // disarm the tap-retry (that was the bug: scan-code's camera never opened on
  // iPhone). A denial at the GESTURE prompt, on the other hand, IS remembered.
  let attempts = 0, live = false;
  const model = [{ id: 'mode', type: 'select', value: 'camera' }];
  const rt = {
    hasFrameHook: true,
    isLive: () => live,
    startLive: async () => { attempts++; const e = new Error('denied'); (e as { name?: string }).name = 'NotAllowedError'; throw e; },
    stopLive: () => { live = false; },
    getModel: () => model,
    manifest: { id: 'scan-code', render: { liveCameraWhen: { input: 'mode', value: 'camera' } } },
  };
  const h = makeHost();
  const lc = createLiveControls({ runtime: rt, host: h.host, t, announce: () => {}, fetchSvgMarkup: h.fetchSvgMarkup });
  registerLiveControls(rt as object, lc);

  lc.syncFromModel(model);
  await tick();
  assert.equal(attempts, 1, 'tried to open on load');

  // A later sync while the tap-retry is armed does NOT spam fresh no-gesture starts.
  lc.syncFromModel(model);
  await tick();
  assert.equal(attempts, 1, 'no re-attempt on a later sync while the tap-retry is armed');

  // The load-time failure was NOT treated as a denial: the first tap still prompts.
  document.dispatchEvent(new Event('pointerdown'));
  await tick();
  assert.equal(attempts, 2, 'the first tap re-prompted despite the load-time NotAllowedError');

  // That gesture prompt was denied - THAT is remembered, so a later sync does not re-prompt.
  lc.syncFromModel(model);
  await tick();
  assert.equal(attempts, 2, 'a gesture-time denial is remembered');
  lc.dispose();
});

test('camera: manifest render.liveFacing opens the rear camera, and flip toggles front/rear', async () => {
  const facings: Array<string | undefined> = [];
  const live = { v: false };
  const rt = {
    hasFrameHook: true,
    isLive: () => live.v,
    startLive: async (o?: { facingMode?: string }) => { facings.push(o?.facingMode); live.v = true; return true; },
    stopLive: () => { live.v = false; },
    getModel: () => [{ id: 'mode', type: 'select', value: 'camera' }],
    manifest: { id: 'scan-code', render: { liveFacing: 'environment' } },
  };
  const h = makeHost();
  const lc = createLiveControls({ runtime: rt, host: h.host, t, announce: () => {}, fetchSvgMarkup: h.fetchSvgMarkup });
  registerLiveControls(rt as object, lc);
  const panel = document.createElement('div');
  document.body.appendChild(panel);
  mountSidebarLiveControls(panel, rt);

  // Start: the rear camera by manifest default.
  (panel.querySelector('[data-live-camera]') as HTMLButtonElement).click();
  await tick();
  assert.equal(facings[0], 'environment', 'opens the rear camera by manifest default');

  // Flip: stop + restart with the front camera; the flip button is now visible.
  const flip = panel.querySelector('[data-live-flip]') as HTMLButtonElement;
  assert.ok(flip && !flip.hidden, 'flip control is visible while live');
  flip.click();
  await tick();
  assert.equal(facings[1], 'user', 'flip restarts on the front camera');

  panel.remove();
  lc.dispose();
});

test('sidebar: a tool with NO asset input pins a standalone camera row at the top of the inputs bar', () => {
  // A reader like scan-code has no asset slot to ride; the control must still be in
  // the inputs bar (reachable on mobile), not only a floating canvas toggle.
  const live = { v: false };
  const rt = {
    hasFrameHook: true,
    isLive: () => live.v,
    startLive: async () => { live.v = true; return true; },
    stopLive: () => { live.v = false; },
    getModel: () => [{ id: 'mode', type: 'select', value: 'camera' }], // no type:'asset'
    manifest: { id: 'scan-code', render: {} },
  };
  const h = makeHost();
  const lc = createLiveControls({ runtime: rt, host: h.host, t, announce: () => {}, fetchSvgMarkup: h.fetchSvgMarkup });
  assert.equal(lc.sourceInputId, null, 'no asset input → no source slot');
  registerLiveControls(rt as object, lc);

  const panel = document.createElement('div');
  panel.innerHTML = '<label class="input-row">Mode</label>';
  document.body.appendChild(panel);
  mountSidebarLiveControls(panel, rt);

  const first = panel.firstElementChild as HTMLElement;
  assert.ok(first?.classList.contains('slot-actions'), 'a standalone actions row is pinned at the top');
  const cluster = panel.querySelector('[data-live-cluster="__standalone__"]');
  assert.ok(cluster, 'a standalone live cluster is mounted');
  assert.ok(cluster!.querySelector('[data-live-camera]'), 'the camera (Use camera) button is present in the inputs bar');
  // Idempotent across input rebuilds.
  mountSidebarLiveControls(panel, rt);
  assert.equal(panel.querySelectorAll('[data-live-cluster="__standalone__"]').length, 1, 'not doubled on re-mount');
  panel.remove();
  lc.dispose();
});

test('sidebar: an unregistered runtime (e.g. /multi fanRuntime) is a no-op', () => {
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, { not: 'registered' });
  assert.equal(panel.querySelector('[data-live-cluster]'), null);
  panel.remove();
});

// ── Play / pause drives the frame loop ───────────────────────────────────────

test('Play arms the sample and starts the loop as source:asset; pause stops and disarms', async () => {
  const { rt, lc, armed, starts, stops } = makeControls();
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, rt);
  lc.syncFromModel(rt.getModel());
  await tick();

  const play = panel.querySelector<HTMLButtonElement>('[data-live-play]')!;
  assert.equal(play.hidden, false, 'Play offered (sample animation available)');
  play.click();
  await tick();
  assert.equal(starts.length, 1);
  assert.equal(starts[0], 'asset', 'asset playback must NOT claim a camera frame source');
  const spec = armed.at(-1) as { kind: string; markup: string };
  assert.equal(spec.kind, 'svg');
  assert.match(spec.markup, /@keyframes/, 'the sample SVG markup is what plays');
  assert.equal(lc.playing(), true);
  assert.equal(play.getAttribute('aria-pressed'), 'true');
  assert.ok(play.classList.contains('is-live'));

  play.click();
  await tick();
  assert.equal(stops(), 1, 'pause stops the runtime loop (freezing the current frame)');
  assert.equal(armed.at(-1), null, 'pause disarms the anim source');
  assert.equal(lc.playing(), false);
  assert.equal(play.getAttribute('aria-pressed'), 'false');
  panel.remove();
  lc.dispose();
});

test('Go live starts the camera loop (default source) and stops on toggle; switching to Play hands over', async () => {
  const { rt, lc, armed, starts, stops } = makeControls();
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, rt);
  lc.syncFromModel(rt.getModel());
  await tick();

  const cam = panel.querySelector<HTMLButtonElement>('[data-live-camera]')!;
  cam.click();
  await tick();
  assert.deepEqual(starts, ['camera'], 'the camera path keeps its default (provenance-marking) source');
  assert.equal(armed.at(-1), null, 'camera start disarms any animated source first');
  assert.equal(lc.cameraLive(), true);

  // Play while the camera runs: the camera stops, the asset loop takes over.
  const play = panel.querySelector<HTMLButtonElement>('[data-live-play]')!;
  play.click();
  await tick();
  assert.equal(stops(), 1, 'camera stopped before playback');
  assert.deepEqual(starts, ['camera', 'asset']);
  assert.equal(lc.playing(), true);
  assert.equal(lc.cameraLive(), false);
  panel.remove();
  lc.dispose();
});

// ── Animated-asset detection drives auto-play ────────────────────────────────

test('picking an animated asset (video) auto-plays it through the frame loop', async () => {
  const announced: string[] = [];
  const { rt, lc, armed, starts, setImage } = makeControls({ announce: (m) => announced.push(m) });
  lc.syncFromModel(rt.getModel()); // initial hydrate (image empty)
  await tick();
  assert.equal(starts.length, 0, 'nothing auto-plays on open');

  setImage({ type: 'video', format: 'mp4', url: 'blob:clip' });
  lc.syncFromModel(rt.getModel());
  await tick();
  assert.deepEqual(starts, ['asset'], 'an animated pick starts playback as source:asset');
  assert.deepEqual(armed.at(-1), { kind: 'video', url: 'blob:clip' });
  assert.ok(announced.some(m => m.includes('Playing the animation')), 'the start is announced');
  lc.dispose();
});

test('picking an animated SVG auto-plays; a STILL SVG does not', async () => {
  const { rt, lc, starts, armed, setImage } = makeControls({
    render: {}, // no sample - Play exists only for the pick
    svgByUrl: { 'blob:spin': ANIM_SVG, 'blob:still': STILL_SVG },
  });
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, rt);
  lc.syncFromModel(rt.getModel());
  await tick();
  const play = panel.querySelector<HTMLButtonElement>('[data-live-play]')!;
  assert.equal(play.hidden, true, 'no sample, no pick → no Play');

  setImage({ type: 'vector', format: 'svg', url: 'blob:still' });
  lc.syncFromModel(rt.getModel());
  await tick();
  assert.equal(starts.length, 0, 'a still SVG never starts the loop');
  assert.equal(play.hidden, true, 'still pick → Play stays hidden');

  setImage({ type: 'vector', format: 'svg', url: 'blob:spin' });
  lc.syncFromModel(rt.getModel());
  await tick();
  assert.deepEqual(starts, ['asset'], 'the animated SVG pick auto-plays');
  const spec = armed.at(-1) as { kind: string; markup: string };
  assert.equal(spec.kind, 'svg');
  assert.match(spec.markup, /@keyframes/);
  assert.equal(play.hidden, false);
  panel.remove();
  lc.dispose();
});

test('an animated raster pick plays only where the shell can decode it', async () => {
  const gif: Ref = { type: 'raster', format: 'gif', url: 'blob:g', meta: { animated: true } };
  // Decoder available → plays.
  const a = makeControls({ render: {}, canDecodeRaster: true });
  a.lc.syncFromModel(a.rt.getModel());
  await tick();
  a.setImage(gif);
  a.lc.syncFromModel(a.rt.getModel());
  await tick();
  assert.deepEqual(a.starts, ['asset']);
  assert.deepEqual(a.armed.at(-1), { kind: 'raster', url: 'blob:g' });
  a.lc.dispose();
  // No ImageDecoder → the pick stays a still, exactly as before the feature.
  const b = makeControls({ render: {}, canDecodeRaster: false });
  b.lc.syncFromModel(b.rt.getModel());
  await tick();
  b.setImage(gif);
  b.lc.syncFromModel(b.rt.getModel());
  await tick();
  assert.equal(b.starts.length, 0);
  b.lc.dispose();
});

test('no auto-play on the initial hydrate of a session/URL that lands with an animated pick', async () => {
  const { rt, lc, starts } = makeControls({ image: { type: 'video', format: 'mp4', url: 'blob:v' } });
  registerLiveControls(rt as object, lc);
  const panel = panelWithAssetRow(false);
  mountSidebarLiveControls(panel, rt);
  lc.syncFromModel(rt.getModel()); // first sync = hydrate, not a pick
  await tick();
  assert.equal(starts.length, 0, 'hydrate never auto-plays');
  assert.equal(panel.querySelector<HTMLButtonElement>('[data-live-play]')!.hidden, false, 'but Play is offered');
  panel.remove();
  lc.dispose();
});

test('swapping the source away mid-playback stops the loop cleanly', async () => {
  const { rt, lc, stops, starts, armed, setImage } = makeControls({ render: {} });
  lc.syncFromModel(rt.getModel());
  await tick();
  setImage({ type: 'video', format: 'mp4', url: 'blob:v1' });
  lc.syncFromModel(rt.getModel());
  await tick();
  assert.equal(lc.playing(), true);

  setImage({ type: 'raster', format: 'png', url: 'blob:still' });
  lc.syncFromModel(rt.getModel());
  await tick();
  assert.equal(stops(), 1, 'playback of the departed source stopped');
  assert.equal(armed.at(-1), null);
  assert.equal(lc.playing(), false);
  assert.equal(starts.length, 1, 'a still pick starts nothing new');
  lc.dispose();
});

// ── Stage fallback ───────────────────────────────────────────────────────────

test('stage fallback renders the classic floating toggles', async () => {
  const { rt, lc } = makeControls();
  const stage = document.createElement('div');
  document.body.appendChild(stage);
  lc.mountStage(stage);
  assert.ok(stage.querySelector('.canvas-live-toggle:not(.canvas-anim-toggle)'), 'Go live toggle');
  assert.ok(stage.querySelector('.canvas-live-toggle.canvas-anim-toggle'), 'Play toggle');
  lc.syncFromModel(rt.getModel());
  await tick();
  const play = stage.querySelector<HTMLButtonElement>('.canvas-anim-toggle')!;
  assert.equal(play.hidden, false, 'sample available → Play offered on the stage too');
  stage.remove();
  lc.dispose();
});
