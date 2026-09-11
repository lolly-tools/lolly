// SPDX-License-Identifier: MPL-2.0
/**
 * The controlled WebCodecs recorder's two pure surfaces (plans/153 WP-I), the parts a
 * node test can pin without a real MediaStream or encoder:
 *
 *  - webCodecsRecorderAvailable() - the Chromium-first gate, which must be CORRECT PER
 *    TRACK SET: a mic-only take needs no VideoEncoder, a muted screen take no AudioEncoder,
 *    so requiring all three unconditionally (the naive version) would refuse both of the
 *    recorder's real shapes. Toggled here against installed/absent WebCodecs globals.
 *  - webCodecsContainerMime() - the container decided UP FRONT. The mic-only branch is the
 *    one the red-team flagged: no video pick exists to derive from, so the container is
 *    spelled out, and the take must still land in a signable CaptureFormat. Verified against
 *    the engine's own captureContainer() so a bad landing fails HERE, not on a take that
 *    quietly saved unsigned.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/recorder-webcodecs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { webCodecsContainerMime, webCodecsRecorderAvailable } from './recorder-webcodecs.ts';
import { captureContainer, CAPTURE_FORMATS } from './export.ts';

// ── the capability gate, per track set ────────────────────────────────────────
// node has none of these globals, so install the ones a shape needs and assert the gate.

const g = globalThis as Record<string, unknown>;
function withGlobals(names: string[], fn: () => void): void {
  const saved: Record<string, unknown> = {};
  for (const n of ['MediaStreamTrackProcessor', 'VideoEncoder', 'AudioEncoder']) saved[n] = g[n];
  try {
    for (const n of ['MediaStreamTrackProcessor', 'VideoEncoder', 'AudioEncoder']) delete g[n];
    for (const n of names) g[n] = class {};
    fn();
  } finally {
    for (const [n, v] of Object.entries(saved)) { if (v === undefined) delete g[n]; else g[n] = v; }
  }
}

const MIC = { wantVideo: false, wantAudio: true };
const SCREEN_MUTED = { wantVideo: true, wantAudio: false };
const AV = { wantVideo: true, wantAudio: true };

test('webCodecsRecorderAvailable: node has no WebCodecs globals, so every shape is unavailable', () => {
  assert.equal(webCodecsRecorderAvailable(MIC), false);
  assert.equal(webCodecsRecorderAvailable(SCREEN_MUTED), false);
  assert.equal(webCodecsRecorderAvailable(AV), false);
});

test('webCodecsRecorderAvailable: MediaStreamTrackProcessor is always required', () => {
  // Encoders present but no track processor - mediabunny cannot read the live track.
  withGlobals(['VideoEncoder', 'AudioEncoder'], () => {
    assert.equal(webCodecsRecorderAvailable(MIC), false);
    assert.equal(webCodecsRecorderAvailable(SCREEN_MUTED), false);
    assert.equal(webCodecsRecorderAvailable(AV), false);
  });
});

test('webCodecsRecorderAvailable: a mic-only take needs AudioEncoder but NOT VideoEncoder', () => {
  // The red-team correction: the naive "require all three" gate would return false here.
  withGlobals(['MediaStreamTrackProcessor', 'AudioEncoder'], () => {
    assert.equal(webCodecsRecorderAvailable(MIC), true, 'mic-only is available with no VideoEncoder');
    assert.equal(webCodecsRecorderAvailable(SCREEN_MUTED), false, 'a muted screen still needs a VideoEncoder');
    assert.equal(webCodecsRecorderAvailable(AV), false, 'an AV take still needs a VideoEncoder');
  });
});

test('webCodecsRecorderAvailable: a muted screen take needs VideoEncoder but NOT AudioEncoder', () => {
  withGlobals(['MediaStreamTrackProcessor', 'VideoEncoder'], () => {
    assert.equal(webCodecsRecorderAvailable(SCREEN_MUTED), true, 'muted screen is available with no AudioEncoder');
    assert.equal(webCodecsRecorderAvailable(MIC), false, 'a mic take still needs an AudioEncoder');
    assert.equal(webCodecsRecorderAvailable(AV), false, 'an AV take still needs an AudioEncoder');
  });
});

test('webCodecsRecorderAvailable: an A/V take needs all three; neither-track is never a recording', () => {
  withGlobals(['MediaStreamTrackProcessor', 'VideoEncoder', 'AudioEncoder'], () => {
    assert.equal(webCodecsRecorderAvailable(AV), true);
    assert.equal(webCodecsRecorderAvailable(MIC), true);
    assert.equal(webCodecsRecorderAvailable(SCREEN_MUTED), true);
    assert.equal(webCodecsRecorderAvailable({ wantVideo: false, wantAudio: false }), false);
  });
});

// ── the container decided up front reaches somewhere signable ─────────────────

test('webCodecsContainerMime: every container the path can hand back is a signable CaptureFormat', () => {
  for (const kind of ['video', 'audio'] as const) {
    for (const container of ['mp4', 'webm'] as const) {
      const mime = webCodecsContainerMime(kind, container);
      const fmt = captureContainer(mime);
      assert.ok(fmt, `${mime} must map to a container the engine can embed into`);
      assert.ok((CAPTURE_FORMATS as readonly string[]).includes(fmt), `${mime} → ${fmt} must be a CaptureFormat`);
    }
  }
});

test('webCodecsContainerMime: the mic-only branch derives a valid audio container, no video pick needed', () => {
  // red-team #1: a mic-only take (wantVideo=false) has no video pick to derive from, so the
  // container is spelled out from the preferred format. Both landings must be signable.
  assert.equal(webCodecsContainerMime('audio', 'mp4'), 'audio/mp4');
  assert.equal(captureContainer('audio/mp4'), 'm4a', 'audio/mp4 is an M4A, a signable capture container');
  assert.equal(webCodecsContainerMime('audio', 'webm'), 'audio/webm');
  assert.equal(captureContainer('audio/webm'), 'webm', 'audio/webm (Matroska Opus) is signable');
});
