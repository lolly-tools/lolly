// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for videoSupport()'s WebCodecs-OR gate and the durable-credential
 * route probe.
 *
 * Runs under node: no MediaRecorder / VideoEncoder globals exist, so the module's
 * load-time probe is a no-op and both halves of the gate start false. Each test
 * drives probeWebCodecsVideoSupport through its injectable encoder (or installs a
 * MediaRecorder-shaped global) and asserts what the sync gate reports. The probe
 * cache is module state, so the tests are ordered: each one overwrites it.
 *
 * Run directly:  node --test shells/web/src/bridge/format-support.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durableSupport, probeDurableSupport, probeWebCodecsVideoSupport, videoSupport } from './format-support.ts';
import { DURABLE_ENCODER_BYTES, DURABLE_ENCODER_PATH } from '../lib/durable-model.ts';

/** VideoEncoder.isConfigSupported stub: supported iff the codec matches `re`. */
const stubVE = (re: RegExp, log: string[] = []) => ({
  isConfigSupported: async (c: { codec?: string; width?: number; height?: number }) => {
    log.push(c.codec ?? '');
    assert.equal(typeof c.width, 'number');
    assert.equal(typeof c.height, 'number');
    return { supported: re.test(c.codec ?? '') };
  },
});

test('videoSupport: before any probe resolves it reports the MediaRecorder-only answer (both false in node)', () => {
  assert.deepEqual(videoSupport(), { webm: false, mp4: false });
});

test('videoSupport: a WebCodecs AVC-only encoder unlocks mp4 (not webm) once the probe resolves', async () => {
  const codecs: string[] = [];
  await probeWebCodecsVideoSupport(stubVE(/^avc1\./, codecs));
  assert.deepEqual(videoSupport(), { webm: false, mp4: true });
  // The probe tries the same candidates renderVideo's pickWebCodecsVideo does.
  assert.deepEqual(codecs.sort(), ['avc1.4d0033', 'avc1.640033', 'vp09.00.10.08', 'vp8']);
});

test('videoSupport: a VP-only encoder unlocks webm and revokes the stale mp4 answer', async () => {
  await probeWebCodecsVideoSupport(stubVE(/^vp/));
  assert.deepEqual(videoSupport(), { webm: true, mp4: false });
});

test('probeWebCodecsVideoSupport: a throwing isConfigSupported reads as unsupported, never rejects', async () => {
  const result = await probeWebCodecsVideoSupport({ isConfigSupported: async () => { throw new Error('nope'); } });
  assert.deepEqual(result, { webm: false, mp4: false });
  assert.deepEqual(videoSupport(), { webm: false, mp4: false });
});

test('probeWebCodecsVideoSupport: no VideoEncoder leaves the cache untouched', async () => {
  await probeWebCodecsVideoSupport(stubVE(/^avc1\./));
  const before = videoSupport();
  await probeWebCodecsVideoSupport(undefined);
  assert.deepEqual(videoSupport(), before);
});

test('videoSupport: MediaRecorder and the WebCodecs cache OR together per container', async () => {
  await probeWebCodecsVideoSupport(stubVE(/^avc1\./));   // WebCodecs: mp4 only
  const g = globalThis as any;
  const saved = { MediaRecorder: g.MediaRecorder, HTMLCanvasElement: g.HTMLCanvasElement };
  class FakeCanvas {}
  (FakeCanvas.prototype as any).captureStream = () => ({});
  g.HTMLCanvasElement = FakeCanvas;
  g.MediaRecorder = { isTypeSupported: (t: string) => t.includes('webm') };  // recorder: webm only
  try {
    assert.deepEqual(videoSupport(), { webm: true, mp4: true });
  } finally {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete g[k]; else g[k] = v; }
  }
});

// ── The durable credential's route probe ────────────────────────────────────
//
// Three routes to the ~33 MB TrustMark encoder: cached in IndexedDB, same-origin,
// or the models base a Tauri build points at. The web answer must stay what it
// always was (a flat yes); the Tauri answer must be earned and must fail closed on
// a 404, since a toggle that appears and then cannot embed is worse than no toggle.
// Every case injects its seams and the probe memoises nothing between calls, so
// these are order-independent.

/** Run `fn` with a Tauri-shaped `window` in place, then restore the global. */
async function underTauri(fn: () => Promise<void>): Promise<void> {
  const g = globalThis as { window?: unknown };
  const had = 'window' in g;
  const saved = g.window;
  g.window = { __TAURI_INTERNALS__: { invoke: () => {} } };
  try { await fn(); } finally { if (had) g.window = saved; else delete g.window; }
}

test('durable: the web PWA answers yes with no network touch at all', async () => {
  let headed = 0;
  const route = await probeDurableSupport({
    base: 'https://models.example',
    cached: async () => false,
    reachable: async () => { headed++; return true; },
  });
  assert.deepEqual(route, { available: true, cached: false, bytes: DURABLE_ENCODER_BYTES });
  assert.equal(headed, 0, 'off Tauri the model is same-origin - the probe must not reach for a host');
  assert.equal(durableSupport(), true, 'the sync gate stays the flat yes it always was');
});

test('durable: a Tauri build with no models base has no route, so the toggle stays hidden', async () => {
  await underTauri(async () => {
    const route = await probeDurableSupport({ base: '', cached: async () => false, reachable: async () => true });
    assert.equal(route.available, false);
    assert.equal(durableSupport(), false);
  });
});

test('durable: a Tauri build fails CLOSED when the model host 404s', async () => {
  await underTauri(async () => {
    const route = await probeDurableSupport({
      base: 'https://models.example',
      cached: async () => false,
      reachable: async () => false,   // not uploaded yet
    });
    assert.equal(route.available, false, 'no toggle rather than a toggle that cannot embed');
    assert.equal(durableSupport(), false);
  });
});

test('durable: a reachable model host opens the route, asking for the encoder by its exact path', async () => {
  await underTauri(async () => {
    const asked: string[] = [];
    const route = await probeDurableSupport({
      base: 'https://models.example',
      cached: async () => false,
      reachable: async (url) => { asked.push(url); return true; },
    });
    assert.deepEqual(asked, [`https://models.example${DURABLE_ENCODER_PATH}`]);
    assert.equal(route.available, true);
    assert.equal(route.cached, false, 'the consent line must still say a download is coming');
    assert.equal(durableSupport(), true, 'the panel reveals the toggle when the probe resolves');
  });
});

test('durable: cached bytes settle it offline - no host is asked, and the consent line says so', async () => {
  await underTauri(async () => {
    let headed = 0;
    const route = await probeDurableSupport({
      base: 'https://models.example',
      cached: async () => true,
      reachable: async () => { headed++; return false; },
    });
    assert.equal(headed, 0, 'a model already on device never needs the network');
    assert.deepEqual(route, { available: true, cached: true, bytes: DURABLE_ENCODER_BYTES });
    assert.equal(durableSupport(), true);
  });
});

test('durable: a throwing cache read degrades to the network answer, never rejects', async () => {
  await underTauri(async () => {
    const route = await probeDurableSupport({
      base: 'https://models.example',
      cached: async () => { throw new Error('IDB blocked'); },
      reachable: async () => true,
    });
    assert.equal(route.available, true);
    assert.equal(route.cached, false);
  });
});
