// SPDX-License-Identifier: MPL-2.0
/**
 * native-transport-select (collab/native-transport-select.ts): the full decision table
 * for choosing rtc / native / none (plans/110 section 4). Pure - no I/O, no crypto.
 *
 * Run directly:  node --test shells/web/src/collab/native-transport-select.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectTransport, type TransportSelectInput, type TransportChoice } from './native-transport-select.ts';

function pick(over: Partial<TransportSelectInput>): TransportChoice {
  return selectTransport({ localPlatform: 'tauri', webrtcAvailable: true, pref: 'auto', ...over });
}

// ── accepting: the invite is the agreement ───────────────────────────────────────

test('accepting a native invite: native on tauri, none on web', () => {
  assert.equal(pick({ inviteKind: 'native', localPlatform: 'tauri' }), 'native');
  assert.equal(pick({ inviteKind: 'native', localPlatform: 'web' }), 'none');
  // A native invite is honoured natively even if WebRTC is also available.
  assert.equal(pick({ inviteKind: 'native', localPlatform: 'tauri', webrtcAvailable: true }), 'native');
});

test('accepting a webrtc invite: rtc when WebRTC exists, none when absent', () => {
  assert.equal(pick({ inviteKind: 'webrtc', webrtcAvailable: true }), 'rtc');
  assert.equal(pick({ inviteKind: 'webrtc', webrtcAvailable: false }), 'none');
  // Even on tauri with native possible, a webrtc invite is not upgraded to native.
  assert.equal(pick({ inviteKind: 'webrtc', localPlatform: 'tauri', webrtcAvailable: false }), 'none');
});

test('local preference never overrides a received invite kind', () => {
  assert.equal(pick({ inviteKind: 'webrtc', pref: 'prefer-lan', webrtcAvailable: true }), 'rtc');
  assert.equal(pick({ inviteKind: 'native', pref: 'prefer-webrtc', localPlatform: 'tauri' }), 'native');
});

// ── minting on web ────────────────────────────────────────────────────────────────

test('web can only ever mint rtc, or none when WebRTC is absent', () => {
  assert.equal(pick({ localPlatform: 'web', webrtcAvailable: true, pref: 'auto' }), 'rtc');
  assert.equal(pick({ localPlatform: 'web', webrtcAvailable: false, pref: 'auto' }), 'none');
  // A web shell can never satisfy a LAN preference - there is no native transport.
  assert.equal(pick({ localPlatform: 'web', webrtcAvailable: false, pref: 'prefer-lan' }), 'none');
});

// ── minting via nearby on tauri (the only path that unlocks native) ───────────────

test('nearby+tauri auto: WebRTC when it exists, native as the webkitgtk fallback', () => {
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: true, pref: 'auto' }), 'rtc');
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: false, pref: 'auto' }), 'native');
});

test('nearby+tauri prefer-lan: always native', () => {
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: true, pref: 'prefer-lan' }), 'native');
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: false, pref: 'prefer-lan' }), 'native');
});

test('nearby+tauri prefer-webrtc: rtc when available, native fallback when absent', () => {
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: true, pref: 'prefer-webrtc' }), 'rtc');
  assert.equal(pick({ localPlatform: 'tauri', origin: 'nearby', webrtcAvailable: false, pref: 'prefer-webrtc' }), 'native');
});

// ── the nearby-only rule: a link/QR mint NEVER yields native ──────────────────────

test('minting via link never yields native, even on tauri prefer-lan', () => {
  assert.equal(pick({ localPlatform: 'tauri', origin: 'link', webrtcAvailable: true, pref: 'prefer-lan' }), 'rtc');
  // Linux/webkitgtk consequence: a link pairing with no WebRTC has no viable transport.
  assert.equal(pick({ localPlatform: 'tauri', origin: 'link', webrtcAvailable: false, pref: 'prefer-lan' }), 'none');
  assert.equal(pick({ localPlatform: 'tauri', origin: 'link', webrtcAvailable: false, pref: 'auto' }), 'none');
});

test('absent origin defaults to link (never native) - the conservative default', () => {
  assert.equal(pick({ localPlatform: 'tauri', webrtcAvailable: false, pref: 'prefer-lan' }), 'none');
  assert.equal(pick({ localPlatform: 'tauri', webrtcAvailable: true, pref: 'auto' }), 'rtc');
});

// ── the choice is exhaustive ──────────────────────────────────────────────────────

test('every input combination yields a defined choice, and only nearby+tauri mints native', () => {
  const platforms = ['web', 'tauri'] as const;
  const prefs = ['auto', 'prefer-lan', 'prefer-webrtc'] as const;
  const kinds = [undefined, 'webrtc', 'native'] as const;
  const origins = [undefined, 'nearby', 'link'] as const;
  for (const localPlatform of platforms)
    for (const webrtcAvailable of [true, false])
      for (const pref of prefs)
        for (const inviteKind of kinds)
          for (const origin of origins) {
            const choice = selectTransport({ localPlatform, webrtcAvailable, pref, inviteKind, origin });
            assert.ok(['rtc', 'native', 'none'].includes(choice));
            // A web shell must NEVER be told to run native.
            if (localPlatform === 'web') assert.notEqual(choice, 'native');
            // MINTING (no inviteKind) native requires nearby origin on tauri.
            if (choice === 'native' && !inviteKind) {
              assert.equal(origin, 'nearby', `link/absent origin minted native: ${localPlatform}/${pref}/${origin}`);
              assert.equal(localPlatform, 'tauri');
            }
          }
});
