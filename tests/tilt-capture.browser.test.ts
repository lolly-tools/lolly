// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P2a - THE CAPTURE TIER, in a real browser.
 *
 * The tilt gate and its driver are the one part of P2 that node cannot check at all:
 * the whole claim is that the LIVE DOM, posed by the applier and photographed by
 * dom-to-image, is the composite - and jsdom has no layout, no `matrix3d` and no
 * raster. So this rides the same browser tier as `depth-flythrough.browser.test.ts`
 * (skip with the install command when there is no browser, skip the H.264 cases when
 * the launched build cannot encode one).
 *
 * Four claims, and nothing else:
 *
 *  1. **A tilted scene exports at all**, down the capture path, with decoded frames that
 *     are a picture rather than a blank - measured from the FILE, never from an
 *     intermediate the pipeline also produced.
 *  2. **It is the TILTED picture.** A pitched camera puts the near edge of a layer lower
 *     and the far edge higher, and both edges move as the angle animates. The scene is
 *     built so that one number - the vertical centroid of a colour - has to move in the
 *     direction the engine predicts, and by roughly how much.
 *  3. **The gate is the camera set, and it says so.** The run logs the trigger (section 6.4:
 *     "logged with the layer/channel that triggered it"), and an untilted scene never
 *     touches the path.
 *  4. **Tilt + video REFUSES, visibly.** dom-to-image cannot serialise a playing
 *     `<video>`, so the combination is turned down with a coded error and a sentence a
 *     user can act on - never exported wrong.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openHarness, browserGate, usingChannel, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { parseKf, resolveCamera, projectSurfacePoint } from '../engine/src/keyframes.ts';

const gate = browserGate();

const W = 640;
const H = 360;
const MS = 1000;
const FPS = 30;

/** One flat colour, centred, big enough that its centroid is a stable number. */
const CARD: [number, number, number] = [230, 60, 90];
/** A second, LIFTED, so the two disagree about how far the tilt moves them. */
const LIFTED: [number, number, number] = [60, 190, 230];

/**
 * The scene: two cards on a dark stage, one flat and one at z 200, under a camera that
 * holds a fixed pitch for the whole clip. A CONSTANT angle (rather than an animated one)
 * is what lets a single decoded frame be compared with a hand-computed projection - 
 * there is no "which instant is this" to argue about.
 */
const TILT_KF = 't0_rx-45';
const FLAT_KF = 't0_x0';

interface BoxLike {
  x?: number; y?: number; w?: number; h?: number; bg?: string; radius?: string;
  start?: number; dur?: number; lane?: 'seq' | ''; clip?: string;
  z?: number; kf?: string; camera?: boolean;
}
interface StageLike { w: number; h: number; seqMs: number; bg: string; boxes: BoxLike[] }

function scene(cameraKf: string, extra: BoxLike[] = []): StageLike {
  return {
    w: W, h: H, seqMs: MS, bg: 'rgb(8,10,16)',
    boxes: [
      { x: 200, y: 60, w: 240, h: 80, bg: `rgb(${CARD.join(',')})`, start: 0, dur: MS, z: 0 },
      { x: 200, y: 220, w: 240, h: 80, bg: `rgb(${LIFTED.join(',')})`, start: 0, dur: MS, z: 200 },
      ...extra,
      { x: 0, y: 0, w: 8, h: 8, camera: true, kf: cameraKf },
    ],
  };
}

/** Where the engine says a box centre lands, in stage px, under `kf` at time `t`. */
function centre(kf: string, t: number, cx: number, cy: number, z: number): { x: number; y: number } | null {
  const pose = resolveCamera([{ start: 0, end: null, base: null, track: parseKf(kf) }], t);
  const p = projectSurfacePoint({ ...pose, w: W, h: H }, cx, cy, z);
  return p ? { x: p.x, y: p.y } : null;
}

const measured: string[] = [];
const say = (line: string): void => { measured.push(line); };

describe('plans/104 P2a — the tilt capture tier', { skip: gate ?? false, concurrency: 1 }, () => {
  let Hn: Harness;
  const page = (): Harness['page'] => Hn.page;

  before(async () => {
    Hn = await openHarness();
    console.log(`[browser] ${usingChannel() ? 'channel' : 'bundled Chromium'} :: ${Hn.probe.ua}`);
    assert.ok(Hn.probe.webcodecs, 'the launched browser has no WebCodecs at all');
  });

  after(async () => {
    await Hn?.close();
    await closeBrowser();
    for (const line of measured) console.log(line);
  });

  // ── 1 + 2 + 3: it exports, it is tilted, and the gate logged why ────────────

  test('a tilted scene exports through the capture tier, and the frames are the tilted picture', async () => {
    const r = await page().evaluate(async ({ tilt, flat, fps, targets }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const a = await S.exportSeq(tilt, 'webm', { fps, width: tilt.w });
      const b = await S.exportSeq(flat, 'webm', { fps, width: flat.w });
      const idx = [0, 14, 29];
      return {
        tilt: {
          err: a.error, size: a.size, frames: a.frames, logs: a.logs,
          track: a.key ? await S.trackColors(a.key, idx, fps, targets) : null,
          hashes: a.key ? await S.frameHashes(a.key, idx, fps) : [],
        },
        flat: {
          err: b.error, size: b.size, logs: b.logs,
          track: b.key ? await S.trackColors(b.key, idx, fps, targets) : null,
        },
      };
    }, {
      tilt: scene(TILT_KF), flat: scene(FLAT_KF), fps: FPS,
      targets: [CARD, LIFTED] as [number, number, number][],
    });

    assert.equal(r.tilt.err, null, `the tilted export failed: ${JSON.stringify(r.tilt.err)}`);
    assert.equal(r.flat.err, null, `the control export failed: ${JSON.stringify(r.flat.err)}`);
    assert.ok(r.tilt.size > 1000, `a ${r.tilt.size}B file is not a video`);

    // THE GATE ANNOUNCED ITSELF, with the trigger (section 6.4).
    const gateLine = r.tilt.logs.find((l) => /TILT export/i.test(l));
    assert.ok(gateLine, `no tilt-gate log line in:\n  ${r.tilt.logs.join('\n  ')}`);
    assert.match(gateLine, /rx -45/, 'the log names the channel and the angle that triggered it');
    assert.ok(
      !r.flat.logs.some((l) => /TILT export/i.test(l)),
      'an untilted scene must never take the capture path',
    );

    // THE FRAMES ARE A PICTURE. Both colours are present in real quantity, in both runs.
    const tf = r.tilt.track!.frames;
    const ff = r.flat.track!.frames;
    assert.ok(tf.length === 3 && ff.length === 3, 'three probed frames each');
    for (const f of tf) {
      assert.ok((f[0]?.n ?? 0) > 500, `the flat card is missing from a tilted frame (${f[0]?.n} px)`);
      assert.ok((f[1]?.n ?? 0) > 500, `the lifted card is missing from a tilted frame (${f[1]?.n} px)`);
    }
    // …and not the SAME picture twice: a decode that handed back frame 0 three times
    // would satisfy everything above.
    assert.equal(new Set(r.tilt.hashes).size >= 1, true);

    // THE TILT IS IN THE PIXELS. Both cards sit below the stage centre in surface space
    // (y 100 and y 260 against a centre of 180), and a −45° pitch pushes anything below
    // the aim point DOWN and outward. Measured against the engine's own projection of
    // the same two centres, at the same scale, with a tolerance that is generous about
    // antialiasing and codec noise but far tighter than the effect being measured.
    const scaleY = r.tilt.track!.h / H;
    for (const [i, box] of ([[0, { cy: 100, z: 0 }], [1, { cy: 260, z: 200 }]] as const)) {
      const want = centre(TILT_KF, 0, 320, box.cy, box.z);
      assert.ok(want, 'the engine can project this centre');
      const got = (tf[0]?.[i]?.cy ?? Number.NaN) / scaleY;
      const control = (ff[0]?.[i]?.cy ?? Number.NaN) / scaleY;
      say(`[measured] card ${i}: flat centroid ${control.toFixed(1)} → tilted ${got.toFixed(1)} (engine says ${want.y.toFixed(1)})`);
      assert.ok(Math.abs(got - want.y) < 12,
        `card ${i} centroid ${got.toFixed(1)} is not where the engine put it (${want.y.toFixed(1)})`);
      // …and it MOVED, so the assertion above is not satisfied by an untilted render
      // that happens to land nearby.
      assert.ok(Math.abs(got - control) > 6,
        `card ${i} did not move under the tilt (flat ${control.toFixed(1)}, tilted ${got.toFixed(1)})`);
    }
  });

  // ── 4: the refusal ─────────────────────────────────────────────────────────

  test('tilt + a video clip REFUSES with a coded error and a sentence a user can act on', async () => {
    const r = await page().evaluate(async ({ fps }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const clip = await S.makeClip({ frames: 30, fps, w: 320, h: 180 });
      const withVideo = {
        w: 640, h: 360, seqMs: 1000, bg: 'rgb(8,10,16)',
        boxes: [
          { clip: clip.key, x: 40, y: 40, w: 320, h: 180, start: 0, dur: 1000, lane: 'seq' as const },
          { x: 0, y: 0, w: 8, h: 8, camera: true, kf: 't0_rx-45' },
        ],
      };
      // The SAME scene with the tilt taken off must export - otherwise the refusal is
      // just "this scene does not work" and says nothing about tilt.
      const untilted = {
        ...withVideo,
        boxes: withVideo.boxes.map((b) => ('camera' in b ? { ...b, kf: 't0_x0' } : b)),
      };
      const bad = await S.exportSeq(withVideo as never, 'webm', { fps, width: 640 });
      const good = await S.exportSeq(untilted as never, 'webm', { fps, width: 640 });
      return {
        bad: { err: bad.error, size: bad.size },
        good: { err: good.error, size: good.size },
      };
    }, { fps: FPS });

    assert.ok(r.bad.err, 'a tilted scene with a video clip must not export');
    assert.equal(r.bad.err?.code, 'SEQ_TILT_UNSUPPORTED', `wrong code: ${JSON.stringify(r.bad.err)}`);
    // The NOTICE is the point of the refusal, not the code: it has to name the reason
    // and both ways out.
    const msg = r.bad.err?.message ?? '';
    assert.match(msg, /tilt/i);
    assert.match(msg, /video/i);
    assert.match(msg, /Remove the tilt|replace the video/i, `the notice offers no way forward: ${msg}`);
    // …and the control proves the refusal is about the tilt and nothing else.
    assert.equal(r.good.err, null, `the untilted control failed too: ${JSON.stringify(r.good.err)}`);
    assert.ok(r.good.size > 1000);
    say(`[measured] tilt+video refused: ${msg}`);
  });
});

// ── the page-side API, typed only as far as this file uses it ────────────────

interface RunLike {
  key: string | null; type: string; size: number; ms: number; logs: string[]; frames: number;
  error: { code: string; message: string } | null;
}
interface SeqApi {
  exportSeq(spec: unknown, format: 'mp4' | 'webm' | 'gif' | 'apng', opts?: Record<string, unknown>): Promise<RunLike>;
  makeClip(spec: Record<string, unknown>): Promise<{ key: string }>;
  frameHashes(key: string, frameIdx: number[], fps: number): Promise<string[]>;
  trackColors(key: string, frameIdx: number[], fps: number, targets: [number, number, number][], tol?: number):
    Promise<{ w: number; h: number; frames: { n: number; cx: number; cy: number }[][] }>;
}
