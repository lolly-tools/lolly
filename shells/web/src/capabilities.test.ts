// SPDX-License-Identifier: MPL-2.0
/**
 * Capability-policy decision tests. The environment-gating policy (Chromium
 * detection, CMYK-TIFF desktop gating, MediaRecorder video containers) is pure
 * decision logic over an injected probe object; the zero-arg wrappers read the
 * real navigator/document and are exercised here only for their inert node paths.
 * Run directly:  node --experimental-strip-types --test shells/web/src/capabilities.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  unmetCapabilities, capabilityLabel, toolSupport, toolSupportFor,
  isChromium, isChromiumFor,
  cmykTiffSupport, cmykTiffSupportFor,
  videoSupport, videoSupportFor,
} from './capabilities.ts';

// ── unmetCapabilities ────────────────────────────────────────────────────────

test('unmetCapabilities: no declared needs → runnable', () => {
  assert.deepEqual(unmetCapabilities(undefined, ['network']), []);
  assert.deepEqual(unmetCapabilities([], ['network']), []);
});

test('unmetCapabilities: host without a declared set skips gating', () => {
  assert.deepEqual(unmetCapabilities(['capture'], undefined), []);
});

test('unmetCapabilities: returns exactly the missing subset', () => {
  assert.deepEqual(unmetCapabilities(['capture', 'network'], ['network']), ['capture']);
  assert.deepEqual(unmetCapabilities(['network'], ['network', 'wasm']), []);
  assert.deepEqual(unmetCapabilities(['ffmpeg', 'camera'], []), ['ffmpeg', 'camera']);
});

// ── capabilityLabel ──────────────────────────────────────────────────────────

test('capabilityLabel: known ids map to friendly labels, unknown pass through', () => {
  assert.equal(capabilityLabel('capture'), 'page capture');
  assert.equal(capabilityLabel('wasm'), 'WebAssembly');
  assert.equal(capabilityLabel('quantum'), 'quantum');
});

// ── isChromium ───────────────────────────────────────────────────────────────

test('isChromiumFor: UA-Client-Hints brands decide when present', () => {
  const base = { hasWindowChrome: false, userAgent: '' };
  assert.equal(isChromiumFor({ ...base, brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] }), true);
  assert.equal(isChromiumFor({ ...base, brands: [{ brand: 'chromium' }] }), true); // case-insensitive
  assert.equal(isChromiumFor({ ...base, brands: [{ brand: 'Firefox' }] }), false);
});

test('isChromiumFor: falls back to window.chrome + UA when brands absent/empty', () => {
  assert.equal(isChromiumFor({ brands: undefined, hasWindowChrome: true, userAgent: 'Mozilla/5.0 Chrome/126' }), true);
  assert.equal(isChromiumFor({ brands: [], hasWindowChrome: true, userAgent: 'Mozilla/5.0 Chrome/126' }), true);
  assert.equal(isChromiumFor({ brands: undefined, hasWindowChrome: false, userAgent: 'Mozilla/5.0 Chrome/126' }), false);
  assert.equal(isChromiumFor({ brands: undefined, hasWindowChrome: true, userAgent: 'Mozilla/5.0 Firefox/127' }), false);
});

test('isChromium wrapper: false outside a browser', () => {
  assert.equal(isChromium(), false);
});

// ── toolSupport ──────────────────────────────────────────────────────────────

test('toolSupportFor: all capabilities met → ok', () => {
  assert.deepEqual(
    toolSupportFor({ capabilities: ['network'] }, ['network'], false),
    { status: 'ok', unmet: [] },
  );
  assert.deepEqual(toolSupportFor({}, [], false), { status: 'ok', unmet: [] });
});

test('toolSupportFor: only capture missing on Chromium → install (extension)', () => {
  assert.deepEqual(
    toolSupportFor({ capabilities: ['capture'] }, [], true),
    { status: 'install', unmet: ['capture'] },
  );
});

test('toolSupportFor: capture missing off Chromium, or any other gap → unavailable', () => {
  assert.deepEqual(
    toolSupportFor({ capabilities: ['capture'] }, [], false),
    { status: 'unavailable', unmet: ['capture'] },
  );
  assert.deepEqual(
    toolSupportFor({ capabilities: ['ffmpeg'] }, [], true),
    { status: 'unavailable', unmet: ['ffmpeg'] },
  );
  assert.deepEqual(
    toolSupportFor({ capabilities: ['capture', 'ffmpeg'] }, [], true),
    { status: 'unavailable', unmet: ['capture', 'ffmpeg'] },
  );
});

test('toolSupport wrapper: matches toolSupportFor with real Chromium detection', () => {
  // Outside a browser isChromium() is false, so a capture-only gap is unavailable.
  assert.deepEqual(toolSupport({ capabilities: ['capture'] }, []), { status: 'unavailable', unmet: ['capture'] });
  assert.deepEqual(toolSupport(null, ['network']), { status: 'ok', unmet: [] });
});

// ── cmykTiffSupport ──────────────────────────────────────────────────────────

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15';

test('cmykTiffSupportFor: desktop with canvas readback → supported', () => {
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: DESKTOP_UA, maxTouchPoints: 0 }), true);
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: MAC_UA, maxTouchPoints: 0 }), true);
});

test('cmykTiffSupportFor: blocked canvas readback (Tor / RFP) → unsupported', () => {
  assert.equal(cmykTiffSupportFor({ canvasReadback: false, userAgent: DESKTOP_UA, maxTouchPoints: 0 }), false);
});

test('cmykTiffSupportFor: mobile devices → unsupported', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile';
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: IPHONE, maxTouchPoints: 5 }), false);
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: ANDROID, maxTouchPoints: 5 }), false);
  // iPadOS masquerades as Macintosh but exposes multi-touch.
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: MAC_UA, maxTouchPoints: 5 }), false);
  // Generic "Mobi" UA with a touch screen.
  assert.equal(cmykTiffSupportFor({ canvasReadback: true, userAgent: 'Mozilla/5.0 (Mobi) Foo', maxTouchPoints: 1 }), false);
});

test('cmykTiffSupport wrapper: false (and memoised) outside a browser', () => {
  assert.equal(cmykTiffSupport(), false);
  assert.equal(cmykTiffSupport(), false);
});

// ── videoSupport ─────────────────────────────────────────────────────────────

test('videoSupportFor: no MediaRecorder pipeline → neither container', () => {
  assert.deepEqual(
    videoSupportFor({ canRecord: false, isTypeSupported: () => true }),
    { webm: false, mp4: false },
  );
});

test('videoSupportFor: containers follow codec support (Firefox / Safari / Chrome)', () => {
  const firefox = (t: string) => t.startsWith('video/webm');
  const safari = (t: string) => t.startsWith('video/mp4');
  assert.deepEqual(videoSupportFor({ canRecord: true, isTypeSupported: firefox }), { webm: true, mp4: false });
  assert.deepEqual(videoSupportFor({ canRecord: true, isTypeSupported: safari }), { webm: false, mp4: true });
  assert.deepEqual(videoSupportFor({ canRecord: true, isTypeSupported: () => true }), { webm: true, mp4: true });
  assert.deepEqual(videoSupportFor({ canRecord: true, isTypeSupported: () => false }), { webm: false, mp4: false });
});

test('videoSupportFor: a single supported codec variant is enough', () => {
  const vp9only = (t: string) => t === 'video/webm;codecs=vp9';
  assert.deepEqual(videoSupportFor({ canRecord: true, isTypeSupported: vp9only }), { webm: true, mp4: false });
});

test('videoSupport wrapper: neither container outside a browser', () => {
  assert.deepEqual(videoSupport(), { webm: false, mp4: false });
});
