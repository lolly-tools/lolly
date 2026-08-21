// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for exportActionSteps (engine/src/c2pa.ts) - the honest C2PA action
 * history the shells assemble from what an export actually did. These pin down the
 * v1.35 provenance additions: a sensor origin swaps the created step to IPTC
 * digitalCapture with a truthful description, and text placed over an opened asset
 * appends a c2pa.edited "Added text" step (never fabricated for from-scratch text - 
 * the caller gates that, so passing textAdded here is always intentional).
 *
 * Run with: node --test tests/export-action-steps.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportActionSteps, DIGITAL_SOURCE_TYPE, CAPTURE_SOURCE_TYPE, SCREEN_SOURCE_TYPE, COMPOSITE_SOURCE_TYPE, collectAiIngredientDeclarations } from '../engine/src/index.ts';

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

// ─── screen capture (v1.54) ──────────────────────────────────────────────────
// A screenshot / screen recording is its OWN IPTC term (screenCapture), NOT the
// sensor term (digitalCapture): a display was captured, not the real world. Getting
// this wrong would over-claim the file's origin - the one thing a credential must
// never do.

test('screen capture: created is screenCapture (NOT digitalCapture)', () => {
  const steps = exportActionSteps('png', { capture: { screen: true } });
  assert.equal(created(steps).action, 'c2pa.created');
  assert.equal(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  // The two source-type URIs are genuinely distinct terms, not aliases.
  assert.notEqual(SCREEN_SOURCE_TYPE, CAPTURE_SOURCE_TYPE);
  assert.notEqual(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Captured from the screen');
});

test('SCREEN_SOURCE_TYPE is the IPTC screenCapture URI', () => {
  assert.equal(SCREEN_SOURCE_TYPE, 'http://cv.iptc.org/newscodes/digitalsourcetype/screenCapture');
});

test('screen takes PRECEDENCE over microphone (narrated screen recording is NOT a real-world recording)', () => {
  const steps = exportActionSteps('mp4', { capture: { screen: true, microphone: true } });
  // A mic laid over a screen recording must NOT flip the origin to digitalCapture:
  // the essence IS the screen; the mic is narration over it.
  assert.equal(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  assert.notEqual(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  // The description must acknowledge the narration.
  assert.equal(created(steps).description, 'Captured from the screen with microphone narration');
  assert.match(created(steps).description!, /narration/);
});

test('screen takes precedence over camera too', () => {
  const steps = exportActionSteps('mp4', { capture: { screen: true, camera: true } });
  assert.equal(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Captured from the screen');
});

// ─── regression guards on pre-1.54 sensor behaviour ───────────────────────────
// The screen branch must not have disturbed the camera/mic paths.

test('regression: {camera:true} still produces digitalCapture, unchanged', () => {
  const steps = exportActionSteps('png', { capture: { camera: true } });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.notEqual(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Captured live from the camera');
});

test('regression: {microphone:true} still produces digitalCapture, unchanged', () => {
  const steps = exportActionSteps('mp3', { capture: { microphone: true } });
  assert.equal(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.notEqual(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  assert.equal(created(steps).description, 'Recorded live from the microphone');
});

test('regression: no capture flag → digitalCreation, unchanged', () => {
  const steps = exportActionSteps('png', {});
  assert.equal(created(steps).digitalSourceType, DIGITAL_SOURCE_TYPE);
  assert.equal(created(steps).description, undefined);
});

test('screen capture composes with transform steps (created stays screenCapture)', () => {
  const steps = exportActionSteps('mp4', { capture: { screen: true }, audio: true });
  assert.equal(created(steps).digitalSourceType, SCREEN_SOURCE_TYPE);
  assert.deepEqual(codes(steps), ['c2pa.created', 'c2pa.edited' /* audio */, 'c2pa.converted']);
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
  assert.equal(textStep!.description, 'Added text - “Summer Sale”');
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

// ─── AI upscale (v1.101) ──────────────────────────────────────────────────────
// A real photo enlarged by a trained model is a COMPOSITE of real + algorithmic
// media (compositeWithTrainedAlgorithmicMedia), never claimed as wholly generated,
// and the model that did it is named in an edit step so an inspected asset can see
// with WHAT it was upscaled.

test('COMPOSITE_SOURCE_TYPE is the IPTC compositeWithTrainedAlgorithmicMedia URI', () => {
  assert.equal(COMPOSITE_SOURCE_TYPE, 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia');
  // Genuinely distinct from the fully-generated term - an upscale is not generation.
  assert.notEqual(COMPOSITE_SOURCE_TYPE, DIGITAL_SOURCE_TYPE);
});

test('aiUpscale: created is compositeWithTrainedAlgorithmicMedia + names the model in an edit step', () => {
  const steps = exportActionSteps('png', { aiUpscale: { model: 'realesr-general-x4v3', version: 'v3' } });
  assert.equal(created(steps).action, 'c2pa.created');
  assert.equal(created(steps).digitalSourceType, COMPOSITE_SOURCE_TYPE);
  assert.match(created(steps).description!, /real image/i);
  const edit = steps.find((s) => s.action === 'c2pa.edited');
  assert.ok(edit, 'an edit step naming the model should be present');
  assert.equal(edit!.description, 'AI-upscaled with realesr-general-x4v3 v3');
  // Sequenced as an edit, before the render close.
  const iEdit = steps.findIndex((s) => s.description?.startsWith('AI-upscaled'));
  const iConvert = steps.findIndex((s) => s.action === 'c2pa.converted');
  assert.ok(iEdit >= 0 && iEdit < iConvert, 'the AI-upscale edit precedes the render close');
});

test('aiUpscale wins the source-type label over a capture origin (composite is the fuller claim)', () => {
  const steps = exportActionSteps('png', {
    aiUpscale: { model: 'gfpgan-v1.4', version: 'v1.4' }, capture: { camera: true },
  });
  assert.equal(created(steps).digitalSourceType, COMPOSITE_SOURCE_TYPE);
  assert.notEqual(created(steps).digitalSourceType, CAPTURE_SOURCE_TYPE);
  assert.ok(steps.some((s) => s.description === 'AI-upscaled with gfpgan-v1.4 v1.4'));
});

test('no aiUpscale → no AI-upscale edit step, created stays digitalCreation', () => {
  const steps = exportActionSteps('png', {});
  assert.equal(created(steps).digitalSourceType, DIGITAL_SOURCE_TYPE);
  assert.equal(steps.some((s) => s.description?.startsWith('AI-upscaled')), false);
});

test('delivered short-circuits, ignoring aiUpscale', () => {
  const steps = exportActionSteps('png', { delivered: true, aiUpscale: { model: 'x', version: '1' } });
  assert.deepEqual(steps, [{ action: 'c2pa.published' }]);
});

// ─── aiIngredients (plans/126 WP-B3): a user's AI-origins assertion on placed
// assets becomes signed provenance - the composite created step + a c2pa.placed
// step naming each declared piece with its grade.

test('aiIngredients: created is composite + a c2pa.placed step names each piece with its grade', () => {
  const steps = exportActionSteps('png', { aiIngredients: [
    { name: 'robot.png', kind: 'full' }, { name: 'hero.jpg', kind: 'partial' },
  ] });
  assert.equal(created(steps).digitalSourceType, COMPOSITE_SOURCE_TYPE);
  assert.match(created(steps).description!, /declared as AI-made/);
  const placed = steps.find((s) => s.action === 'c2pa.placed');
  assert.ok(placed, 'a c2pa.placed step should be present');
  assert.equal(placed!.description, 'Placed AI-declared ingredients: robot.png (AI-generated) and hero.jpg (AI-assisted)');
});

test('aiIngredients: one piece reads singular, and the step precedes the render close', () => {
  const steps = exportActionSteps('png', { aiIngredients: [{ name: 'gen.webp', kind: 'full' }] });
  const iPlaced = steps.findIndex((s) => s.action === 'c2pa.placed');
  const iConvert = steps.findIndex((s) => s.action === 'c2pa.converted');
  assert.equal(steps[iPlaced]!.description, 'Placed AI-declared ingredient: gen.webp (AI-generated)');
  assert.ok(iPlaced >= 0 && iPlaced < iConvert, 'the placed step precedes the render close');
});

test('aiIngredients wins the source-type label over a capture origin, and aiUpscale wins the created description over both', () => {
  const cap = exportActionSteps('png', { aiIngredients: [{ name: 'a', kind: 'full' }], capture: { camera: true } });
  assert.equal(created(cap).digitalSourceType, COMPOSITE_SOURCE_TYPE);
  const both = exportActionSteps('png', { aiIngredients: [{ name: 'a', kind: 'full' }], aiUpscale: { model: 'm', version: 'v' } });
  assert.equal(created(both).digitalSourceType, COMPOSITE_SOURCE_TYPE);
  assert.match(created(both).description!, /real image/i);
  assert.ok(both.some((s) => s.action === 'c2pa.placed'), 'both disclosures ride: the placed step still names the ingredient');
});

test('empty aiIngredients adds nothing: created stays digitalCreation, no placed step', () => {
  const steps = exportActionSteps('png', { aiIngredients: [] });
  assert.equal(created(steps).digitalSourceType, DIGITAL_SOURCE_TYPE);
  assert.equal(steps.some((s) => s.action === 'c2pa.placed'), false);
});

// ─── collectAiIngredientDeclarations: the census the runtime and node shells share ───

test('collector walks top-level assets and blocks sub-fields, dedupes, and ignores undeclared refs', () => {
  const model = [
    { type: 'asset', value: { id: 'user/a', meta: { name: 'robot.png', aiGenerated: 'full' } } },
    { type: 'asset', value: { id: 'user/b', meta: { name: 'photo.jpg' } } },
    { type: 'text', value: 'hello' },
    { type: 'blocks', fields: [{ id: 'img', type: 'asset' }, { id: 'label', type: 'text' }], value: [
      { img: { id: 'user/c', meta: { name: 'hero.jpg', aiGenerated: 'partial' } }, label: 'x' },
      { img: { id: 'user/a', meta: { name: 'robot.png', aiGenerated: 'full' } } },
      { img: null },
    ] },
  ];
  assert.deepEqual(collectAiIngredientDeclarations(model), [
    { name: 'robot.png', kind: 'full' },
    { name: 'hero.jpg', kind: 'partial' },
  ]);
});

test('collector falls back to the ref id when meta carries no name, and rejects junk aiGenerated values', () => {
  const model = [
    { type: 'asset', value: { id: 'user/upload/x.png', meta: { aiGenerated: 'full' } } },
    { type: 'asset', value: { id: 'user/y', meta: { aiGenerated: 'yes' } } },
    { type: 'asset', value: 'user/plain-id-string' },
  ];
  assert.deepEqual(collectAiIngredientDeclarations(model), [{ name: 'user/upload/x.png', kind: 'full' }]);
});
