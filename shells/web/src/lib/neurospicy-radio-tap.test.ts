// SPDX-License-Identifier: MPL-2.0
/**
 * plans/146: on iOS the Neurospicy radio <audio> element must NOT be tapped into the
 * Web Audio graph, or it goes silent when the app backgrounds (iOS suspends Web Audio).
 * Played bare it keeps sounding in the background. tapDecision is the one pure rule that
 * gates this; everything else in neurospicy.ts is AudioContext plumbing verified by hand.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { tapDecision } from './neurospicy.ts';

test('tap when the graph is available and the host allows it', () => {
  assert.equal(tapDecision({ untappedHost: false, graphUnavailable: false, appleMobile: false }), true);
});

test('never tap on Apple mobile - background playback needs the bare element', () => {
  assert.equal(tapDecision({ untappedHost: false, graphUnavailable: false, appleMobile: true }), false);
});

test('a CORS-refused host stays untapped (existing fallback)', () => {
  assert.equal(tapDecision({ untappedHost: true, graphUnavailable: false, appleMobile: false }), false);
});

test('no Web Audio at all - never tap', () => {
  assert.equal(tapDecision({ untappedHost: false, graphUnavailable: true, appleMobile: false }), false);
});
