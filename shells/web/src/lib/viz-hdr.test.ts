// SPDX-License-Identifier: MPL-2.0
/**
 * WP-4 live on-screen HDR for the butterchurn viz (plan 154) - the branch-selection and
 * lifecycle logic that jsdom CAN check without WebGL.
 *
 * Run directly:  node --test shells/web/src/lib/viz-hdr.test.ts
 *
 * jsdom has no WebGL2 and no `configureHighDynamicRange`, so this is exactly the
 * SDR/headless environment the HARD ACCEPTANCE targets: `hdrCanvasSupported()` is false, so
 * every mount stays on the plain butterchurn canvas and the boost pass never runs. The
 * actual glow (values above SDR white on an HDR panel) is OLED-pending - it needs a real
 * HDR display and cannot be asserted here.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';

// jsdom logs a "Not implemented: getContext" jsdomError when boostHdrCanvas probes for
// WebGL2; that is exactly the SDR fall-through under test, so swallow it and keep anything else.
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (err: Error) => {
  if (!/getContext/.test(err.message)) process.stderr.write(`[jsdom] ${err.message}\n`);
});
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/', virtualConsole });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;

const { vizWantsHdr } = await import('./butterchurn-viz.ts');
const { hdrCanvasSupported, boostHdrCanvas, releaseHdrCanvas } = await import('./hdr-canvas.ts');

test('headless/SDR is not HDR-capable → the plain butterchurn path', () => {
  // No `configureHighDynamicRange` on the prototype in jsdom → the whole HDR path is dead.
  assert.equal(hdrCanvasSupported(), false);
});

test('vizWantsHdr: only a LIVE surface on an HDR display takes the boost path', () => {
  // Both directions of the gate, support injected so it does not depend on the environment.
  assert.equal(vizWantsHdr(false, true), true, 'live + HDR display → boost');
  assert.equal(vizWantsHdr(true, true), false, 'capture mount never boosts (export byte-identical)');
  assert.equal(vizWantsHdr(false, false), false, 'SDR display → no boost');
  assert.equal(vizWantsHdr(true, false), false, 'capture + SDR → no boost');
  // Default arg wires the real display probe, which is false headless → SDR path in CI.
  assert.equal(vizWantsHdr(false), false);
  assert.equal(vizWantsHdr(true), false);
});

test('boostHdrCanvas fails safe when WebGL2 is unavailable', () => {
  const present = document.createElement('canvas');
  const source = document.createElement('canvas');
  // No GL context in jsdom → returns false so the caller leaves the plain SDR canvas up.
  assert.equal(boostHdrCanvas(present, source, 64, 48, 'srgb'), false);
  // And it does not retry (init failure is cached as null) - still false, still no throw.
  assert.equal(boostHdrCanvas(present, source, 64, 48, 'srgb'), false);
});

test('releaseHdrCanvas is teardown-safe on a canvas that never took the HDR path', () => {
  const c = document.createElement('canvas');
  assert.doesNotThrow(() => releaseHdrCanvas(c));
  // Idempotent - destroyToolViz + handle.destroy() can both call it.
  assert.doesNotThrow(() => releaseHdrCanvas(c));
});
