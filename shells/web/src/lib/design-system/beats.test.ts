// SPDX-License-Identifier: MPL-2.0
/**
 * Beats - how much of a room is on screen (plan 182 sections 3a, 9 M1).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/beats.test.ts"
 *
 * The Colours and Type rooms live in `lib/brand-editor.ts`, which has no DOM
 * harness by design, so the thresholds are pulled out here and pinned here. The
 * report is built by hand rather than read off a document: `ownership.test.ts`
 * already proves the counts against the real shipped starter, and what this file
 * is about is the boundaries between the three beats.
 *
 * jsdom-free on purpose: nothing in the module touches a DOM.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SYSTEM_OWN_COLORS, colourBeat } from './beats.ts';
import type { BeatReport } from './beats.ts';

/** A report carrying only what the beat helpers read. */
const report = (counts: Partial<BeatReport['counts']>): BeatReport => ({
  counts: { ownColors: 0, starterColors: 0, ownFaces: 0, logos: 0, ...counts },
});

test('Colours: nothing of its own is beat 0, whatever the starter carries', () => {
  assert.equal(colourBeat(report({ ownColors: 0 })), 0);
  assert.equal(colourBeat(report({ ownColors: 0, starterColors: 16 })), 0);
});

test('Colours: a starter palette never lifts the beat on its own', () => {
  // The whole point of the ownership grammar: 16 colours nobody chose is still
  // an empty room, and it must not open the wings, the chart or the dock.
  assert.equal(colourBeat(report({ ownColors: 0, starterColors: 16 }), { generatedRamp: false }), 0);
});

test('Colours: one own colour and no generated ramp is beat 1', () => {
  assert.equal(colourBeat(report({ ownColors: 1 })), 1);
  assert.equal(colourBeat(report({ ownColors: 1, starterColors: 16 })), 1);
});

test('Colours: a generated ramp is beat 2 however few colours are own', () => {
  assert.equal(colourBeat(report({ ownColors: 1 }), { generatedRamp: true }), 2);
});

test('Colours: a generated ramp cannot lift an empty room off beat 0', () => {
  // Zero own colours wins: there is nothing to show a chart or a dock about, and
  // a document that somehow carries a secondary ramp with nothing of the
  // person's own in it is a starter, not a system.
  assert.equal(colourBeat(report({ ownColors: 0 }), { generatedRamp: true }), 0);
});

test(`Colours: ${SYSTEM_OWN_COLORS} own colours is beat 2 with no ramp at all`, () => {
  assert.equal(colourBeat(report({ ownColors: SYSTEM_OWN_COLORS - 1 })), 1);
  assert.equal(colourBeat(report({ ownColors: SYSTEM_OWN_COLORS })), 2);
  assert.equal(colourBeat(report({ ownColors: SYSTEM_OWN_COLORS + 40 })), 2);
});

test('Colours: a negative or absurd count never falls off the ladder', () => {
  assert.equal(colourBeat(report({ ownColors: -1 })), 0);
});

// The Type room's beat lives in beats-type.ts (re-exported from beats.ts) and
// is covered by the Type milestone, which owns both the module and the question
// it answers - a face installed but holding no role.
