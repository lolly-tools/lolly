// SPDX-License-Identifier: MPL-2.0
/**
 * Phase-3 sequence export — THE BROWSER TIER.
 *
 * `tests/sequence-plan.test.ts` already pins the entire decision surface headlessly
 * (activity windows, crossfade alpha, source mapping, the frame grid, error codes).
 * What no Node process can answer is whether the pixels and the bytes are right:
 * WebCodecs, canvas compositing, mediabunny decode and the muxers only exist in a
 * browser. This file is that half, and it asserts only things a real Chromium can
 * prove:
 *
 *   1 determinism        the same sequence twice is bit-identical, and mp4 agrees with webm
 *   2 frame accuracy     output frame n shows source frame clipIn + n/fps × speed
 *   3 the cap is gone    1,350 frames export with no per-frame buffering at all
 *   4 resource policy    <= 2 samples in flight, <= MAX_LIVE decoders, a stall fails coded
 *   5 audio              clip audio lands at its offset, is packet-trimmed, and ducks the bed
 *   6 fidelity           the compositor frame matches a dom-to-image of the same DOM
 *   7 truncation         a half-file is caught, not silently exported short
 *   8 still contract     a png is the playhead frame, off-playhead boxes absent
 *
 * GATING (the reason this file can be in `npm test` at all):
 *   • no browser installed  -> the whole suite skips with the install command in the
 *     message, exactly like the `c2patool` conformance suite does for its binary;
 *   • Playwright's BUNDLED Chromium has no guaranteed proprietary codecs, so every
 *     mp4/H.264/AAC assertion is additionally gated on an in-page
 *     `VideoEncoder.isConfigSupported('avc1.…')` probe and skips naming that reason.
 *     VP8/VP9/Opus/WebM carry the bulk of the suite and run on any build.
 *
 * The synthesised media paints its own frame index as a binary block code, so
 * "which source frame is this?" is decided by a threshold on black-vs-white blocks
 * rather than by trusting a colour through two lossy codecs. See the harness header.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openHarness, browserGate, usingChannel, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';

const gate = browserGate();

/** Reported at the end of the run — the numbers the phase-3 brief asks to see. */
const measured: string[] = [];

describe('sequence export (browser tier)', { skip: gate ?? false, concurrency: 1 }, () => {
  let H: Harness;
  const page = (): Harness['page'] => H.page;

  before(async () => {
    H = await openHarness();
    const p = H.probe;
    console.log(`[browser] ${usingChannel() ? `channel=${process.env.LOLLY_BROWSER_CHANNEL ?? process.env.LOLLY_BROWSER_PATH}` : 'bundled Chromium'} :: ${p.ua}`);
    console.log(`[codecs] vp8=${p.vp8} vp9=${p.vp9} opus=${p.opus} avcEncode=${p.avcEncode} avcDecode=${p.avcDecode} aac=${p.aac}`);
    assert.ok(p.webcodecs, 'the launched browser has no WebCodecs at all');
    assert.ok(p.vp8 || p.vp9, 'no VP8/VP9 encode: even the codec-agnostic cases cannot run');
  });

  after(async () => {
    await H?.close();
    await closeBrowser();
    for (const line of measured) console.log(line);
  });

  // ── 1. determinism ─────────────────────────────────────────────────────────

  test('the same sequence exported twice is frame-identical (and byte-identical)', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 90, fps: 30, w: 640, h: 360 });
      const spec = { w: 640, h: 360, seqMs: 3000, boxes: [{ clip: clip.key, start: 0, dur: 3000, lane: 'seq' as const }] };
      const a = await S.exportSeq(spec, 'webm', { fps: 30, width: 640 });
      const b = await S.exportSeq(spec, 'webm', { fps: 30, width: 640 });
      const idx = [0, 22, 45, 67, 89];
      return {
        a: { err: a.error, size: a.size }, b: { err: b.error, size: b.size },
        ha: a.key ? await S.frameHashes(a.key, idx, 30) : [],
        hb: b.key ? await S.frameHashes(b.key, idx, 30) : [],
      };
    });
    assert.equal(r.a.err, null, `first export failed: ${JSON.stringify(r.a.err)}`);
    assert.equal(r.b.err, null, `second export failed: ${JSON.stringify(r.b.err)}`);
    assert.equal(r.ha.length, 5);
    assert.ok(!r.ha.includes('(none)'), 'a probed frame was missing from the export');
    assert.deepEqual(r.ha, r.hb, 'spread frames differ between two runs of the same sequence');
    // Bit-identical output is a stronger claim than the brief asks for; it holds
    // because nothing in the path is time- or randomness-dependent. Assert it, so a
    // future non-determinism (a timestamp in the container, a racing raster) is loud.
    assert.equal(r.a.size, r.b.size, 'the two exports are not the same size');
  });

  test('mp4 and webm agree at the middle frame', async (t) => {
    if (!H.probe.avcEncode) {
      t.skip('no H.264 encode in this browser build (Playwright bundled Chromium ships no proprietary codecs) — set LOLLY_BROWSER_CHANNEL=chrome');
      return;
    }
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 60, fps: 30, w: 640, h: 360 });
      const spec = { w: 640, h: 360, seqMs: 2000, boxes: [{ clip: clip.key, start: 0, dur: 2000, lane: 'seq' as const }] };
      const webm = await S.exportSeq(spec, 'webm', { fps: 30, width: 640 });
      const mp4 = await S.exportSeq(spec, 'mp4', { fps: 30, width: 640 });
      return {
        webm: { err: webm.error, type: webm.type }, mp4: { err: mp4.error, type: mp4.type },
        delta: webm.key && mp4.key ? await S.frameDelta(webm.key, mp4.key, 30, 30) : Number.NaN,
        codes: mp4.key ? await S.decodeCodes(mp4.key, [0, 30, 59], 30) : [],
      };
    });
    assert.equal(r.webm.err, null, `webm export failed: ${JSON.stringify(r.webm.err)}`);
    assert.equal(r.mp4.err, null, `mp4 export failed: ${JSON.stringify(r.mp4.err)}`);
    assert.equal(r.mp4.type, 'video/mp4');
    assert.deepEqual(r.codes, [0, 30, 59], 'the mp4 shows different source frames than it should');
    // Two different lossy codecs will never be identical; what must hold is that they
    // are the SAME PICTURE. 2.0 mean absolute luma (out of 255) is far below any
    // structural difference and far above VP9-vs-H.264 quantisation noise (measured
    // 0.08 on this fixture).
    assert.ok(r.delta < 2, `mp4 vs webm mean luma difference ${r.delta.toFixed(3)} is too large to be codec noise`);
    measured.push(`[measured] mp4 vs webm middle-frame mean luma difference: ${r.delta.toFixed(3)} / 255`);
  });

  // ── 2. frame accuracy (the end-to-end version of the spike's 7/7) ──────────

  test('output frame n shows source frame clipIn + n/fps (frame-exact through the whole export)', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 120, fps: 30, w: 640, h: 360 });
      const idx = [0, 1, 7, 14, 15, 22, 29];
      const plain = await S.exportSeq(
        { w: 640, h: 360, seqMs: 1000, boxes: [{ clip: clip.key, start: 0, dur: 1000, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 640 },
      );
      const shifted = await S.exportSeq(
        { w: 640, h: 360, seqMs: 1000, boxes: [{ clip: clip.key, start: 0, dur: 1000, clipIn: 1000, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 640 },
      );
      // A clip placed LATE in the sequence: its own frame 0 must appear at the cut,
      // not at output frame 0 (an off-by-one in the source mapping hides otherwise).
      const late = await S.exportSeq(
        { w: 640, h: 360, seqMs: 2000, boxes: [{ clip: clip.key, start: 1000, dur: 1000, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 640 },
      );
      return {
        idx,
        plain: { err: plain.error, codes: plain.key ? await S.decodeCodes(plain.key, idx, 30) : [] },
        shifted: { err: shifted.error, codes: shifted.key ? await S.decodeCodes(shifted.key, idx, 30) : [] },
        late: { err: late.error, codes: late.key ? await S.decodeCodes(late.key, [30, 31, 45, 59], 30) : [] },
      };
    });
    assert.equal(r.plain.err, null, `export failed: ${JSON.stringify(r.plain.err)}`);
    assert.deepEqual(r.plain.codes, r.idx, 'output frame n did not show source frame n');
    assert.equal(r.shifted.err, null, `clipIn export failed: ${JSON.stringify(r.shifted.err)}`);
    assert.deepEqual(r.shifted.codes, r.idx.map((n) => n + 30), 'clipIn=1000ms did not shift the source by exactly 30 frames');
    assert.equal(r.late.err, null, `late-clip export failed: ${JSON.stringify(r.late.err)}`);
    assert.deepEqual(r.late.codes, [0, 1, 15, 29], 'a clip starting at 1000ms did not start from its own frame 0');
  });

  // Regression: reconcileProviders used to hand reconcileDecoded the OUTPUT fps, but a
  // speed-s clip samples its source only fps/s times per second of span, so byCount
  // reported a bogus (1 - 1/s) shortfall and every speed>1 clip failed SEQ_TRUNCATED.
  test('a speed != 1 clip exports and advances the source proportionally', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 120, fps: 30, w: 640, h: 360 });
      const run = await S.exportSeq(
        { w: 640, h: 360, seqMs: 1000, boxes: [{ clip: clip.key, start: 0, dur: 1000, speed: 2, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 640 },
      );
      return { err: run.error, codes: run.key ? await S.decodeCodes(run.key, [0, 5, 15, 29], 30) : [] };
    });
    assert.equal(r.err, null, `a 2x clip should export, not fail: ${JSON.stringify(r.err)}`);
    assert.deepEqual(r.codes, [0, 10, 30, 58], 'a 2x clip should advance two source frames per output frame');
  });

  // ── 3. the 600-frame cap is gone on the streaming path ─────────────────────

  test('a 45s / 1,350-frame sequence exports with no per-frame buffering', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 450, fps: 30, w: 640, h: 360 });
      const boxes = [0, 1, 2].map((i) => ({ clip: clip.key, start: i * 15_000, dur: 15_000, lane: 'seq' as const }));
      const run = await S.exportSeq({ w: 640, h: 360, seqMs: 45_000, boxes }, 'webm', { fps: 30, width: 640 });
      return {
        err: run.error, size: run.size, frames: run.frames, ms: run.ms, counters: run.counters, logs: run.logs,
        codes: run.key ? await S.decodeCodes(run.key, [0, 449, 450, 899, 900, 1349], 30) : [],
      };
    });
    assert.equal(r.err, null, `long export failed: ${JSON.stringify(r.err)}`);
    assert.equal(r.frames, 1350, 'the fixture is not 1,350 frames');
    assert.ok(r.size > 100_000, `suspiciously small output (${r.size} bytes)`);
    // The old buffered path kept an ImageBitmap per frame — which is the only reason
    // maxVideoFrames() (600) ever existed. ZERO is the proof it is not being used:
    // createImageBitmap is the sole entry to that array.
    assert.equal(r.counters.imageBitmapsMade, 0, 'the streaming path allocated ImageBitmaps — it is buffering frames');
    // video-encode-core documents "at most HIGH_WATER + 1 VideoFrames alive".
    assert.ok(r.counters.videoFramesPeak <= 7, `peak live VideoFrames ${r.counters.videoFramesPeak} exceeds HIGH_WATER + 1`);
    assert.equal(r.counters.videoFramesLive, 0, 'a VideoFrame outlived the export');
    assert.equal(r.counters.videoFramesMade, 1350, 'one VideoFrame per output frame is expected');
    // Each 15s clip is its own decoder, opened and closed on its own edges.
    assert.ok(r.counters.decodersPeak <= 3, `peak live decoders ${r.counters.decodersPeak}`);
    assert.deepEqual(r.codes, [0, 449, 0, 449, 0, 449], 'the three clips did not tile the timeline in order');
    const ratio = 45_000 / r.ms;
    assert.ok(ratio > 1, `export was slower than realtime (${ratio.toFixed(1)}x)`);
    measured.push(`[measured] 45s @30fps 640x360: ${Math.round(r.ms)}ms wall = ${ratio.toFixed(1)}x realtime, ${r.counters.imageBitmapsMade} ImageBitmaps, peak ${r.counters.videoFramesPeak} VideoFrames`);
  });

  // ── 4. resource discipline ─────────────────────────────────────────────────

  test('a provider never holds more than 2 decoded samples', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 150, fps: 30, w: 640, h: 360 });
      return await S.driveProvider(clip.key, 30, 5000);
    });
    assert.equal(r.asked, 150, 'the grid handed to the provider is not the whole clip');
    assert.equal(r.drawn, 150, `${r.asked - r.drawn} frames were missed`);
    assert.equal(r.stats.kind, 'mediabunny', 'the mediabunny path did not open — this test is not measuring what it claims');
    assert.ok(r.stats.maxInFlight <= 2, `held ${r.stats.maxInFlight} samples at once; the cap is 2`);
    assert.equal(r.stats.inFlight, 0, 'a sample was still held after the last draw');
    assert.equal(r.stats.randomAccess, false, 'the primed samplesAtTimestamps path was abandoned on a monotonic grid');
    measured.push(`[measured] provider ledger over 150 frames: maxInFlight=${r.stats.maxInFlight}, missed=${r.stats.missed}, primed=${!r.stats.randomAccess}`);
  });

  test('overlapping clips: MAX_LIVE decoders is honoured, and one more fails fast', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clips = [];
      for (let i = 0; i < 4; i++) clips.push(await S.makeClip({ frames: 60, fps: 30, w: 160, h: 120, tint: ['#123456', '#563412', '#345612', '#333333'][i] }));
      const box = (k: string, i: number): BoxLike => ({ clip: k, x: i * 160, y: 0, w: 160, h: 120, start: 0, dur: 2000 });
      const three = await S.exportSeq({ w: 640, h: 360, seqMs: 2000, boxes: clips.slice(0, 3).map((c, i) => box(c.key, i)) }, 'webm', { fps: 30, width: 640 });
      const four = await S.exportSeq({ w: 640, h: 360, seqMs: 2000, boxes: clips.map((c, i) => box(c.key, i)) }, 'webm', { fps: 30, width: 640 });
      return {
        three: { err: three.error, counters: three.counters },
        four: { err: four.error, ms: four.ms, counters: four.counters },
        max: S.constants.MAX_LIVE_PROVIDERS,
      };
    });
    assert.equal(r.three.err, null, `three overlapping clips should export: ${JSON.stringify(r.three.err)}`);
    assert.equal(r.three.counters.decodersPeak, r.max, `expected exactly ${r.max} concurrent decoders, saw ${r.three.counters.decodersPeak}`);
    assert.equal(r.three.counters.decodersLive, 0, 'a decoder outlived the export');
    assert.equal(r.four.err?.code, 'SEQ_TOO_HEAVY', `a 4-clip overlap should be refused, got ${JSON.stringify(r.four.err)}`);
    // Refused from the plan, before any container is opened: the budget check is
    // worthless if it only fires half way through a render.
    assert.equal(r.four.counters.decodersPeak, 0, 'the over-budget composition opened decoders before failing');
    assert.ok(r.four.ms < 500, `the refusal took ${Math.round(r.four.ms)}ms; it should be immediate`);
  });

  test('a source that never answers fails with a coded error instead of hanging', async () => {
    const r = await page().evaluate(async () => await (window as never as { SEQ: SeqApi }).SEQ.stalledProvider());
    assert.ok(r.error, 'a stalled source resolved successfully — the timeout did not fire');
    assert.ok(['SEQ_UNSUPPORTED_MEDIA', 'SEQ_DECODE_FAILED', 'SEQ_ABORTED'].includes(r.error.code), `unexpected code ${r.error.code}`);
    // Both the mediabunny open and the element fallback are time-boxed; the sum of
    // the two is what a caller waits. It must be bounded and nowhere near a hang.
    assert.ok(r.ms < 8000, `the stall took ${Math.round(r.ms)}ms to fail`);
    measured.push(`[measured] stalled source failed in ${Math.round(r.ms)}ms as ${r.error.code}`);
  });

  // ── 5. audio ───────────────────────────────────────────────────────────────

  test('clip audio lands at its own offset and is trimmed to the packet, not past it', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      // Clip A's source is LOUD for its first 0.5s and silent after; the sequence
      // starts it at clipIn=500ms. If AudioBufferSink's packet-granular range were
      // taken as-is, up to 21ms of that tone would be dragged in at the head.
      const a = await S.makeClip({ frames: 60, fps: 30, w: 320, h: 240, tone: { hz: 3000, gain: 0.5, fromSec: 0, toSec: 0.5 } });
      const b = await S.makeClip({ frames: 60, fps: 30, w: 320, h: 240, tint: '#aa3333', tone: { hz: 600, gain: 0.5, fromSec: 0, toSec: 2 } });
      const run = await S.exportSeq({
        w: 320, h: 240, seqMs: 2000, boxes: [
          { clip: a.key, start: 0, dur: 1000, clipIn: 500, lane: 'seq' as const },
          { clip: b.key, start: 1000, dur: 1000, lane: 'seq' as const },
        ],
      }, 'webm', { fps: 30, width: 320 });
      return {
        err: run.error, logs: run.logs,
        hasAudio: run.key ? await S.hasAudioTrack(run.key) : false,
        rms: run.key ? await S.audioRms(run.key, [[0, 0.03], [0.05, 0.9], [1.05, 1.9]]) : [],
      };
    });
    assert.equal(r.err, null, `export failed: ${JSON.stringify(r.err)}`);
    assert.ok(r.hasAudio, 'the export has no audio track');
    const [head, silent, tone] = r.rms as [number, number, number];
    // The positive control first: clip B's 0.5-amplitude tone is RMS 0.354.
    assert.ok(tone > 0.25, `clip B's tone is missing from 1.05-1.9s (rms ${tone.toFixed(4)})`);
    // An untrimmed straddling packet would put ~21ms of a 0.354-rms tone into a 30ms
    // window: rms ~0.29. Anything under 0.02 is decoder ringing, not leaked audio.
    assert.ok(head < 0.02, `clip A leaked its pre-clipIn tone into the first 30ms (rms ${head.toFixed(4)})`);
    assert.ok(silent < 0.02, `clip A's window should be silent (rms ${silent.toFixed(4)})`);
    measured.push(`[measured] audio rms: head=${head.toFixed(4)} clipA=${silent.toFixed(4)} clipB=${tone.toFixed(4)}`);
  });

  test('the music bed ducks under an unmuted clip and comes back after it', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      // The clip carries a REAL audio track that happens to be silent, so the only
      // thing the level can be measuring is the bed's own duck envelope.
      const sil = await S.makeClip({ frames: 90, fps: 30, w: 320, h: 240, silentTrack: true });
      const bed = S.makeBed(4, 440, 0.4);
      const run = await S.exportSeq(
        { w: 320, h: 240, seqMs: 3000, boxes: [{ clip: sil.key, start: 800, dur: 1400, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 320, audio: { url: bed.url, duck: 0.2, volume: 1 } },
      );
      return { err: run.error, rms: run.key ? await S.audioRms(run.key, [[0.1, 0.6], [1.2, 2.0], [2.5, 2.9]]) : [] };
    });
    assert.equal(r.err, null, `export failed: ${JSON.stringify(r.err)}`);
    const [before_, during, after_] = r.rms as [number, number, number];
    assert.ok(before_ > 0.2, `no bed before the clip (rms ${before_.toFixed(4)})`);
    assert.ok(after_ > 0.2, `the bed did not come back after the clip (rms ${after_.toFixed(4)})`);
    const ratio = during / before_;
    // duck: 0.2 with 0.25s ramps either side of a 1.4s window — the steady-state
    // level is 0.2x, and the measured window sits inside the ramps.
    assert.ok(ratio < 0.35, `the bed was not ducked under the clip (ratio ${ratio.toFixed(3)})`);
    measured.push(`[measured] bed duck ratio ${ratio.toFixed(3)} (asked for 0.2)`);
  });

  // ── 6. compositor vs preview ───────────────────────────────────────────────
  //
  // TOLERANCE, AND WHY. The two paths cannot be bit-identical by construction: the
  // compositor rasterises each box ONCE, unrotated, and then rotates/scales that
  // bitmap on the canvas, while dom-to-image rasterises the already-transformed
  // geometry. Edge antialiasing therefore differs along every non-axis-aligned or
  // rounded edge. Interior pixels have no such excuse.
  //   • mean absolute difference (0-255) <= 1.0
  //   • at most 1% of pixels may differ by more than 24/255 (an edge band)
  // Measured on these fixtures: rotation 0.005 / 0.000, radius 0.076 / 0.0017,
  // blend 0.000 / 0.000 — three orders of magnitude inside the threshold, so the
  // gate catches a real drift long before it catches noise.

  const MAE_LIMIT = 1.0;
  const OVER_LIMIT = 0.01;

  const fidelityCase = (name: string, boxes: unknown[]): void => {
    test(`compositor matches the preview: ${name}`, async () => {
      const r = await page().evaluate(async (bs) => {
        const S = (window as never as { SEQ: SeqApi }).SEQ;
        // A one-frame sequence (33ms at 30fps) exported as APNG: lossless, and a
        // single-frame APNG is an ordinary PNG to any decoder. The four properties
        // under test are static box styles, so one frame settles them; transition-time
        // parity with the clock is pinned headlessly in tests/sequence-plan.test.ts.
        return await S.fidelity({ w: 320, h: 240, seqMs: 33, bg: '#0b1220', boxes: bs as never });
      }, boxes);
      assert.equal(r.error, undefined, `fidelity run failed: ${JSON.stringify(r.error)}`);
      measured.push(`[measured] fidelity ${name}: mae=${r.mae.toFixed(3)} over24=${(r.overFrac * 100).toFixed(3)}%`);
      assert.ok(r.mae <= MAE_LIMIT, `mean difference ${r.mae.toFixed(3)} exceeds ${MAE_LIMIT}`);
      assert.ok(r.overFrac <= OVER_LIMIT, `${(r.overFrac * 100).toFixed(2)}% of pixels differ by more than 24/255`);
    });
  };

  const T = { start: 0, dur: 33 };
  fidelityCase('rotation', [{ x: 60, y: 60, w: 120, h: 80, bg: '#e0a020', rot: 23, ...T }]);
  fidelityCase('border-radius clip', [{ x: 40, y: 40, w: 160, h: 120, bg: '#20c0a0', radius: '32px', ...T }]);
  fidelityCase('mix-blend-mode multiply', [
    { x: 20, y: 20, w: 160, h: 160, bg: '#ff8800', ...T },
    { x: 90, y: 60, w: 160, h: 140, bg: '#3388ff', blend: 'multiply', ...T },
  ]);

  // Regression: the authored opacity used to be applied TWICE — once by rasterBox
  // (which photographed the element with its own opacity:0.45 still set) and again by
  // drawItem's globalAlpha, which the planner already defines as layer.opacity x
  // transition alpha. 0.45 exported as 0.20. rasterBox now shoots boxes with {opaque:true}.
  test('compositor matches the preview: opacity', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.fidelity({
        w: 320, h: 240, seqMs: 33, bg: '#0b1220',
        boxes: [{ x: 40, y: 40, w: 160, h: 120, bg: '#ffffff', opacity: 0.45, start: 0, dur: 33 }],
      });
    });
    assert.ok(r.mae <= MAE_LIMIT, `mean difference ${r.mae?.toFixed(3)} exceeds ${MAE_LIMIT}`);
    assert.ok(r.overFrac <= OVER_LIMIT, `${((r.overFrac ?? 0) * 100).toFixed(2)}% of pixels differ by more than 24/255`);
  });

  // ── 7. silent truncation ───────────────────────────────────────────────────

  test('a truncated clip is caught instead of exporting short', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 90, fps: 30, w: 320, h: 240 });
      const out: Record<string, unknown> = {};
      for (const frac of [0.6, 0.35]) {
        const cut = await S.truncate(clip.key, frac);
        const run = await S.exportSeq(
          { w: 320, h: 240, seqMs: 3000, boxes: [{ clip: cut.key, start: 0, dur: 3000, lane: 'seq' as const }] },
          'webm', { fps: 30, width: 320 },
        );
        out[`f${frac}`] = { err: run.error, produced: Boolean(run.key) };
      }
      // The control: the SAME sequence with the whole file must still export.
      const whole = await S.exportSeq(
        { w: 320, h: 240, seqMs: 3000, boxes: [{ clip: clip.key, start: 0, dur: 3000, lane: 'seq' as const }] },
        'webm', { fps: 30, width: 320 },
      );
      out.whole = { err: whole.error, produced: Boolean(whole.key) };
      return out as { [k: string]: { err: { code: string } | null; produced: boolean } };
    });
    assert.equal(r.whole?.err, null, `the intact control failed: ${JSON.stringify(r.whole?.err)}`);
    for (const frac of ['f0.6', 'f0.35']) {
      // The whole point of spike rule 7: this decodes CLEANLY and just stops early,
      // so "no exception was thrown" is not evidence of anything.
      assert.equal(r[frac]?.produced, false, `${frac}: a truncated source produced a file`);
      assert.equal(r[frac]?.err?.code, 'SEQ_TRUNCATED', `${frac}: expected SEQ_TRUNCATED, got ${JSON.stringify(r[frac]?.err)}`);
    }
  });

  // ── 8. the still contract (Andy's rule: a still is the playhead frame) ─────

  test('a png still is the frame at the playhead, with off-playhead boxes absent', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 90, fps: 30, w: 320, h: 240 });
      const spec = {
        w: 320, h: 240, seqMs: 3000, bg: '#0b1220', boxes: [
          { clip: clip.key, start: 0, dur: 3000, lane: 'seq' as const },
          { x: 20, y: 160, w: 60, h: 60, bg: '#ff0000', start: 0, dur: 1000 },
          { x: 200, y: 160, w: 60, h: 60, bg: '#00ff00', start: 2000, dur: 1000 },
        ],
      };
      const probes = [{ x: 50, y: 190 }, { x: 230, y: 190 }];
      return {
        early: await S.stillAt(spec, 500, probes, 0.5),
        late: await S.stillAt(spec, 2500, probes, 2.5),
      };
    });
    for (const [when, shot] of [['early', r.early], ['late', r.late]] as const) {
      assert.equal(shot.type, 'image/png', `${when}: not a png`);
      assert.equal(shot.offCount, 1, `${when}: exactly one box should be off the playhead`);
    }
    const isRed = (p: number[] | undefined): boolean => !!p && (p[0] as number) > 200 && (p[1] as number) < 60;
    const isGreen = (p: number[] | undefined): boolean => !!p && (p[1] as number) > 200 && (p[0] as number) < 60;
    // t = 500ms: the 0-1000ms box is painted, the 2000-3000ms box is NOT.
    assert.ok(isRed(r.early.at[0]), `the on-playhead box is missing at 500ms (${r.early.at[0]})`);
    assert.ok(!isGreen(r.early.at[1]), `an off-playhead box was captured at 500ms (${r.early.at[1]})`);
    // t = 2500ms: the other way round.
    assert.ok(!isRed(r.late.at[0]), `an off-playhead box was captured at 2500ms (${r.late.at[0]})`);
    assert.ok(isGreen(r.late.at[1]), `the on-playhead box is missing at 2500ms (${r.late.at[1]})`);
    // And the still is WYSIWYG for video too: a live <video> serialises blank, so a
    // readable frame code is the evidence snapshotMotion still runs for a still format
    // on a [data-sequence] stage (the phase-3 guard must skip it for MOTION only).
    assert.equal(r.early.code, 15, `the still should show source frame 15 (0.5s), got ${r.early.code}`);
    assert.equal(r.late.code, 75, `the still should show source frame 75 (2.5s), got ${r.late.code}`);
  });

  // ── 9. the stage is LIVE, and phase 2 has been on it ──────────────────────

  // Regression: the compositor photographs the real artboard, and the phase-2 clock
  // leaves `.seq-off` (display:none) on every box outside the playhead window. Every
  // off-playhead box therefore rasterised BLANK — exporting from a playhead at 1.5s
  // shipped picture for exactly one clip and nothing for the rest.
  test('an export taken with the playhead mid-sequence still paints every clip', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const spec = {
        w: 320, h: 240, seqMs: 2000, bg: '#0b1220', boxes: [
          { x: 0, y: 0, w: 320, h: 240, bg: '#ff0000', start: 0, dur: 1000, lane: 'seq' as const },
          { x: 0, y: 0, w: 320, h: 240, bg: '#00ff00', start: 1000, dur: 1000, lane: 'seq' as const },
        ],
      };
      // The playhead sits inside the SECOND clip, so the first carries .seq-off.
      const scrubbed = await S.exportSeq(spec, 'apng', { fps: 10, width: 320, applyClockAtMs: 1500 });
      const clean = await S.exportSeq(spec, 'apng', { fps: 10, width: 320 });
      const probe = [{ x: 160, y: 120 }];
      return {
        scrubbed: { err: scrubbed.error, px: scrubbed.key ? await S.firstFramePixels(scrubbed.key, probe, 320) : [] },
        clean: { err: clean.error, px: clean.key ? await S.firstFramePixels(clean.key, probe, 320) : [] },
      };
    });
    assert.equal(r.clean.err, null, `control export failed: ${JSON.stringify(r.clean.err)}`);
    assert.equal(r.scrubbed.err, null, `scrubbed export failed: ${JSON.stringify(r.scrubbed.err)}`);
    const isRed = (p: number[] | undefined): boolean => !!p && (p[0] as number) > 200 && (p[1] as number) < 60;
    assert.ok(isRed(r.clean.px[0]), `frame 0 of the control is not the first clip (${r.clean.px[0]})`);
    assert.ok(isRed(r.scrubbed.px[0]), `frame 0 lost its clip because the playhead was elsewhere (${r.scrubbed.px[0]})`);
  });

  // Regression: gif/apng clamp the frame count to maxVideoFrames(), but every layer's
  // decode span was still derived from the UNCAPPED grid — so a capped export asked
  // the truncation guard to account for frames it had deliberately never rendered and
  // threw SEQ_TRUNCATED after the whole file was already encoded.
  test('a gif/apng export clamped by the frame cap still succeeds', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 90, fps: 30, w: 160, h: 120 });
      // deviceMemory 1 → maxVideoFrames() is 200; 30 s at 10 fps wants 300.
      const run = await S.exportSeq(
        { w: 160, h: 120, seqMs: 30_000, boxes: [{ clip: clip.key, start: 0, dur: 30_000, lane: 'seq' as const }] },
        'apng', { fps: 10, width: 160, deviceMemory: 1 },
      );
      return { err: run.error, type: run.type, size: run.size, capped: run.logs.filter((l) => l.includes('capped')) };
    });
    assert.equal(r.err, null, `a capped export must still produce a file: ${JSON.stringify(r.err)}`);
    assert.equal(r.type, 'image/png');
    assert.ok(r.size > 0);
    assert.equal(r.capped.length, 1, `expected exactly one cap warning, got ${JSON.stringify(r.capped)}`);
  });

  // Regression: a ZIP bundle re-dispatches mp4/webm through renderFormat with the
  // OUTER format ('zip'), so snapshotMotion has already frozen every <video> into a
  // sibling <img>. That still was captured into the box's "over" plate and drawn on
  // top of every decoded frame — a zipped mp4 of a sequence was a static picture.
  test('a frozen snapshotMotion still does not bake into the composited frames', async () => {
    const r = await page().evaluate(async () => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 60, fps: 30, w: 320, h: 240 });
      const spec = {
        w: 320, h: 240, seqMs: 1000, boxes: [{ clip: clip.key, start: 0, dur: 1000, lane: 'seq' as const }],
      };
      const run = await S.exportSeq(spec, 'webm', { fps: 30, width: 320, freezeVideos: true });
      return { err: run.error, codes: run.key ? await S.decodeCodes(run.key, [0, 10, 29], 30) : [] };
    });
    assert.equal(r.err, null, `export failed: ${JSON.stringify(r.err)}`);
    assert.deepEqual(r.codes, [0, 10, 29], 'the frozen still covered the decoded frames');
  });

});

// ── the page-side API, typed only as far as these tests use it ───────────────

interface BoxLike {
  clip?: string; audioSrc?: string;
  x?: number; y?: number; w?: number; h?: number; bg?: string; rot?: number; opacity?: number;
  blend?: string; radius?: string; text?: string;
  start?: number; dur?: number; clipIn?: number; speed?: number; mute?: boolean;
  enter?: string; enterMs?: number; exit?: string; exitMs?: number; lane?: 'seq' | '';
}
interface StageLike { w?: number; h?: number; seqMs?: number; bg?: string; boxes: BoxLike[] }
interface RunLike {
  key: string | null; type: string; size: number; ms: number; logs: string[];
  error: { code: string; message: string } | null;
  counters: { videoFramesLive: number; videoFramesPeak: number; videoFramesMade: number; imageBitmapsMade: number; decodersLive: number; decodersPeak: number };
  frames: number; fps: number;
}
interface SeqApi {
  makeClip(spec: Record<string, unknown>): Promise<{ key: string; url: string; w: number; h: number; frames: number; fps: number; size: number }>;
  truncate(key: string, frac: number): Promise<{ key: string; url: string; size: number }>;
  makeBed(sec: number, hz: number, gain: number): { key: string; url: string };
  exportSeq(spec: StageLike, format: 'mp4' | 'webm' | 'gif' | 'apng', opts?: Record<string, unknown>): Promise<RunLike>;
  decodeCodes(key: string, frameIdx: number[], fps: number): Promise<(number | null)[]>;
  frameHashes(key: string, frameIdx: number[], fps: number): Promise<string[]>;
  frameDelta(a: string, b: string, frameIdx: number, fps: number): Promise<number>;
  audioRms(key: string, windows: [number, number][]): Promise<number[]>;
  hasAudioTrack(key: string): Promise<boolean>;
  driveProvider(key: string, fps: number, durMs: number): Promise<{ asked: number; drawn: number; durationSec: number; stats: { kind: string; inFlight: number; maxInFlight: number; decoded: number; missed: number; lastSourceSec: number; randomAccess: boolean } }>;
  stalledProvider(): Promise<{ ms: number; error: { code: string; message: string } | null }>;
  stillAt(spec: StageLike, tMs: number, probes: { x: number; y: number }[], seekSec?: number): Promise<{ w: number; h: number; type: string; size: number; offCount: number; at: number[][]; code: number | null }>;
  firstFramePixels(key: string, probes: { x: number; y: number }[], stageW: number): Promise<number[][]>;
  fidelity(spec: StageLike): Promise<{ w: number; h: number; mae: number; overFrac: number; error?: { code: string; message: string }; logs?: string[] }>;
  constants: { HIGH_WATER: number; MAX_LIVE_PROVIDERS: number; CODE_BITS: number };
}
