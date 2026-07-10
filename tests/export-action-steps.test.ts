/**
 * Unit tests for exportActionSteps (engine/src/c2pa.ts) — the honest C2PA action
 * history the shells assemble from what an export actually did. These pin down the
 * v1.35 provenance additions: a sensor origin swaps the created step to IPTC
 * digitalCapture with a truthful description, and text placed over an opened asset
 * appends a c2pa.edited "Added text" step (never fabricated for from-scratch text —
 * the caller gates that, so passing textAdded here is always intentional).
 *
 * Run with: node --test tests/export-action-steps.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportActionSteps, DIGITAL_SOURCE_TYPE, CAPTURE_SOURCE_TYPE } from '../engine/src/index.ts';

const created = (steps: ReturnType<typeof exportActionSteps>) => steps[0]!;
const codes = (steps: ReturnType<typeof exportActionSteps>) => steps.map((s) => s.action);

test('default origin: created is digitalCreation with no description', () => {
  const steps = exportActionSteps('png', {});
  assert.equal(created(steps).action, 'c2pa.created');
  assert.equal(created(steps).digitalSourceType, DIGITAL_SOURCE_TYPE);
  assert.equal(created(steps).description, undefined);
  // A raster output still closes with a render step.
  assert.deepEqual(codes(steps), ['c2pa.created', 'c2pa.converted']);
});

test('camera capture: created is digitalCapture, "Captured live from the camera"', () => {
  const steps = exportActionSteps('png', { capture: { camera: true } });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Captured live from the camera');
});

test('mic-only capture: "Recorded live from the microphone"', () => {
  const steps = exportActionSteps('mp3', { capture: { microphone: true } });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Recorded live from the microphone');
});

test('camera + mic capture: names both', () => {
  const steps = exportActionSteps('mp4', { capture: { camera: true, microphone: true } });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Recorded live from the camera and microphone');
});

test('an empty capture object does not claim a capture', () => {
  const steps = exportActionSteps('png', { capture: {} });
  assert.equal(created(steps).digitalSourceType, DIGITAL_SOURCE_TYPE);
  assert.equal(created(steps).description, undefined);
});

test('textAdded appends a c2pa.edited "Added text" step with the sample', () => {
  const steps = exportActionSteps('png', { textAdded: true, textSample: 'Summer Sale' });
  const textStep = steps.find((s) => s.action === 'c2pa.edited');
  assert.ok(textStep, 'a c2pa.edited step should be present');
  assert.equal(textStep!.description, 'Added text — “Summer Sale”');
  // Text is an edit, sequenced before the closing render/convert step.
  const iText = steps.findIndex((s) => s.description?.startsWith('Added text'));
  const iConvert = steps.findIndex((s) => s.action === 'c2pa.converted');
  assert.ok(iText < iConvert, 'the text edit precedes the render close');
});

test('textAdded without a sample falls back to a bare "Added text"', () => {
  const steps = exportActionSteps('png', { textAdded: true });
  const textStep = steps.find((s) => s.action === 'c2pa.edited');
  assert.equal(textStep!.description, 'Added text');
});

test('no textAdded → no text edit step', () => {
  const steps = exportActionSteps('png', {});
  assert.equal(steps.some((s) => s.description?.startsWith('Added text')), false);
});

test('delivered short-circuits to a single published step (capture/text ignored)', () => {
  const steps = exportActionSteps('png', { delivered: true, capture: { camera: true }, textAdded: true });
  assert.deepEqual(steps, [{ action: 'c2pa.published' }]);
});

test('capture composes with the existing transform steps', () => {
  const steps = exportActionSteps('png', {
    capture: { camera: true }, paletteColors: 2, watermarked: true, textAdded: true, textSample: 'Hi',
  });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.deepEqual(codes(steps), [
    'c2pa.created', 'c2pa.color_adjustments', 'c2pa.edited' /* watermark */, 'c2pa.edited' /* text */, 'c2pa.converted',
  ]);
});
