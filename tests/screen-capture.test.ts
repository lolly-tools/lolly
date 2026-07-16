// SPDX-License-Identifier: MPL-2.0
/**
 * The v1.54 "screencap" surface at the engine/schema/contract seams.
 *
 * This proves the additive contract holds where a tool actually meets the
 * platform: both tool.schema.json copies accept the new `screen` capability and
 * `render.capture: "screen"`, the engine version bumped to 1.54.0, and a tool
 * declaring `^1.54.0` loads against the running engine (the v1.53 engineVersion
 * enforcement doesn't refuse it). The C2PA source-type behaviour is covered by
 * export-action-steps.test.ts; here we cover schema + version + loadTool.
 *
 * The two schema copies are kept byte-identical by an existing drift guard
 * (tests/lolly-tools-core.test.ts, `no drift`), so this file does NOT re-compare
 * them — it exercises each copy's real VALIDATOR instead, which the drift guard
 * does not: validateManifest (engine, reads schemas/tool.schema.json) and
 * validateTool (@lolly-tools/core, reads packages/core/schema/tool.schema.json).
 *
 * Run with: node --test tests/screen-capture.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../engine/src/validate.ts';
import { validateTool } from '../packages/core/src/index.ts';
import { loadTool, ToolLoadError } from '../engine/src/loader.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { satisfiesRange } from '../engine/src/semver-range.ts';

/** A well-formed screencap manifest, optionally with overrides merged in. */
function screencapManifest(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'screencap',
    name: 'Screencap',
    version: '1.0.0',
    engineVersion: '^1.54.0',
    status: 'official',
    capabilities: ['screen'],
    render: { width: 1280, height: 720, formats: ['png'], capture: 'screen' },
    inputs: [{ id: 'shot', type: 'asset' }],
    ...overrides,
  };
}

// ─── schema: both copies, via their real validators ──────────────────────────

test('engine validateManifest (schemas/tool.schema.json) accepts screen capability + capture', () => {
  const { valid, errors } = validateManifest(screencapManifest());
  assert.equal(valid, true, JSON.stringify(errors));
});

test('core validateTool (packages/core/schema/tool.schema.json) accepts screen capability + capture', () => {
  const { valid, errors } = validateTool(screencapManifest());
  assert.equal(valid, true, JSON.stringify(errors));
});

test('both validators still REJECT a bogus capability', () => {
  const bogus = screencapManifest({ capabilities: ['screeen'] }); // typo — not in the enum
  assert.equal(validateManifest(bogus).valid, false, 'engine schema must reject an unknown capability');
  assert.equal(validateTool(bogus).valid, false, 'core schema must reject an unknown capability');
});

test('both validators still REJECT a bogus render.capture value', () => {
  const bogus = screencapManifest({
    render: { width: 1, height: 1, formats: ['png'], capture: 'display' }, // not audio/video/av/screen
  });
  assert.equal(validateManifest(bogus).valid, false, 'engine schema must reject an unknown capture mode');
  assert.equal(validateTool(bogus).valid, false, 'core schema must reject an unknown capture mode');
});

test('the sensor capabilities still validate (screen is additive, not a replacement)', () => {
  for (const cap of ['camera', 'microphone', 'screen']) {
    const m = screencapManifest({ capabilities: [cap] });
    assert.equal(validateManifest(m).valid, true, `engine: ${cap}`);
    assert.equal(validateTool(m).valid, true, `core: ${cap}`);
  }
});

// ─── version ─────────────────────────────────────────────────────────────────

test('ENGINE_VERSION is 1.56.0', () => {
  // A literal pin: the screencap surface shipped at 1.54, and tools declare
  // ^1.54.0 to require it. session-record only checks the stamp equals whatever
  // ENGINE_VERSION happens to be (tautological) — this catches an errant bump.
  // Moved 1.55.0 → 1.56.0 by the deliberate PPTX native-rich-elements bump; the
  // ^1.54.0 screencap floor below is unaffected (a minor bump still satisfies it).
  assert.equal(ENGINE_VERSION, '1.56.0');
});

// ─── loadTool: a ^1.54.0 tool loads against this engine ───────────────────────

/** fetchFile serving the screencap tool.json (+ template) for a given engineVersion. */
function makeFetchFile(engineVersion: string) {
  const files: Record<string, string> = {
    'screencap/tool.json': JSON.stringify(screencapManifest({ engineVersion })),
    'screencap/template.html': '<div data-screen-preview></div>',
  };
  return async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) throw new Error(`404: ${path}`);
    return text;
  };
}

test('sanity: the running engine satisfies ^1.54.0', () => {
  assert.equal(satisfiesRange(ENGINE_VERSION, '^1.54.0'), true);
});

test('loadTool accepts a tool that requires ^1.54.0 (the screencap engineVersion)', async () => {
  const tool = await loadTool('screencap', makeFetchFile('^1.54.0'));
  assert.equal(tool.manifest.id, 'screencap');
  assert.equal(tool.manifest.render.capture, 'screen');
});

test('loadTool REFUSES a screencap tool pinned to a future engine (^1.57.0)', async () => {
  // Tracks ENGINE_VERSION: 1.56.0 is now the running engine, so the "future" pin
  // this asserts refusal of has to stay one minor ahead of it.
  await assert.rejects(loadTool('screencap', makeFetchFile('^1.57.0')), ToolLoadError);
});
