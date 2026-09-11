// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the shared WebCodecs codec selection, focused on plan 154 WP-2's
 * HDR additions: the 10-bit ladder is probed FIRST only when hdr===true, falls
 * through silently to the SDR ladder when no HDR codec encodes, and is byte-identical
 * to before when hdr is omitted/false. Plus the is10bitHdrCodec predicate and the
 * HDR_VF_COLORSPACE tag.
 *
 * WebCodecs doesn't exist in node, so `VideoEncoder.isConfigSupported` is stubbed on
 * globalThis with a controllable support predicate that also records probe order.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/video-shared.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickWebCodecsVideo, is10bitHdrCodec, HDR_VF_COLORSPACE } from './video-shared.ts';

/** Install a stub VideoEncoder whose isConfigSupported returns `supported(codec)` and
 *  records every probed codec in order. Restores the previous global on teardown. */
function withVideoEncoder(supported: (codec: string) => boolean): { probed: string[]; restore: () => void } {
  const probed: string[] = [];
  const g = globalThis as any;
  const prev = g.VideoEncoder;
  g.VideoEncoder = { isConfigSupported: async (c: any) => { probed.push(c.codec); return { supported: supported(c.codec) }; } };
  return { probed, restore: () => { if (prev === undefined) delete g.VideoEncoder; else g.VideoEncoder = prev; } };
}

test('pickWebCodecsVideo: hdr=true probes the 10-bit ladder first and returns AV1 Main10', async () => {
  const env = withVideoEncoder(() => true);                 // everything encodes
  try {
    const pick = await pickWebCodecsVideo('mp4', 1920, 1080, 30, 8_000_000, undefined, true);
    assert.deepEqual(pick, { container: 'mp4', codec: 'av01.0.08M.10', muxCodec: 'av1' });
    assert.equal(env.probed[0], 'av01.0.08M.10', 'the HDR ladder is probed before anything else');
  } finally { env.restore(); }

  const wenv = withVideoEncoder(() => true);
  try {
    const pick = await pickWebCodecsVideo('webm', 1920, 1080, 30, 8_000_000, undefined, true);
    assert.deepEqual(pick, { container: 'webm', codec: 'av01.0.08M.10', muxCodec: 'V_AV1' });
  } finally { wenv.restore(); }
});

test('pickWebCodecsVideo: hdr=true falls through to the SDR ladder when no HDR codec encodes', async () => {
  // Only 8-bit H.264 High encodes; every 10-bit HDR codec is rejected.
  const env = withVideoEncoder((c) => c === 'avc1.640033');
  try {
    const pick = await pickWebCodecsVideo('mp4', 1280, 720, 30, 4_000_000, undefined, true);
    assert.deepEqual(pick, { container: 'mp4', codec: 'avc1.640033', muxCodec: 'avc' }, 'quietly SDR');
    assert.ok(env.probed.includes('av01.0.08M.10'), 'the HDR ladder was still tried');
    assert.ok(env.probed.indexOf('av01.0.08M.10') < env.probed.indexOf('avc1.640033'), 'HDR tried before SDR');
  } finally { env.restore(); }
});

test('pickWebCodecsVideo: hdr omitted/false never probes an HDR codec (byte-identical pick)', async () => {
  const env = withVideoEncoder(() => true);
  const isHdrProbe = (c: string): boolean =>
    c === 'av01.0.08M.10' || c === 'vp09.02.10.10' || c.startsWith('hev1') || c.startsWith('hvc1');
  try {
    const omitted = await pickWebCodecsVideo('mp4', 1920, 1080, 30, 8_000_000);
    assert.deepEqual(omitted, { container: 'mp4', codec: 'av01.0.08M.08', muxCodec: 'av1' });
    assert.ok(!env.probed.some(isHdrProbe), 'no HDR codec probed when hdr is omitted');

    env.probed.length = 0;
    const off = await pickWebCodecsVideo('webm', 1920, 1080, 30, 8_000_000, undefined, false);
    assert.deepEqual(off, { container: 'webm', codec: 'av01.0.08M.08', muxCodec: 'V_AV1' });
    assert.ok(!env.probed.some(isHdrProbe), 'no HDR codec probed when hdr=false');
  } finally { env.restore(); }
});

test('pickWebCodecsVideo: no VideoEncoder global ⇒ null even with hdr=true', async () => {
  const g = globalThis as any;
  const prev = g.VideoEncoder;
  delete g.VideoEncoder;
  try {
    assert.equal(await pickWebCodecsVideo('mp4', 1920, 1080, 30, 8_000_000, undefined, true), null);
  } finally { if (prev === undefined) delete g.VideoEncoder; else g.VideoEncoder = prev; }
});

test('is10bitHdrCodec: recognises the HDR ladder codecs, rejects the SDR ones', () => {
  for (const c of ['av01.0.08M.10', 'hev1.2.4.L153.B0', 'hvc1.2.4.L153.B0', 'vp09.02.10.10']) {
    assert.equal(is10bitHdrCodec(c), true, `expected HDR: ${c}`);
  }
  for (const c of ['av01.0.08M.08', 'avc1.640033', 'avc1.4d0033', 'vp09.00.10.08', 'vp8', 'hev1.1.6.L93.B0']) {
    assert.equal(is10bitHdrCodec(c), false, `expected SDR: ${c}`);
  }
});

test('HDR_VF_COLORSPACE is a complete Rec.2100-PQ tag (all four fields mediabunny needs)', () => {
  assert.deepEqual(HDR_VF_COLORSPACE, { primaries: 'bt2020', transfer: 'pq', matrix: 'bt2020-ncl', fullRange: false });
});
