// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P2b - THE GPU QUAD COMPOSITOR, at parity with P2a, in a real browser.
 *
 * P2b (`sequence-gl.ts` + `renderGlComposite`) replaces the P2a capture tier's 127
 * independent dom-to-image rasters with one clean plate texture per layer, resampled on
 * the GPU through the engine's per-quad homography - the flicker fix. This is the gate
 * the plan requires before P2b can ship (section 6.4: "P2b behind a flag with an image-diff
 * parity harness against P2a"). node cannot run it: `glQuadCompositorSupported()` is
 * false without a real WebGL2, so the whole thing rides the browser tier and, when the
 * launched build has no WebGL2, SKIPS the GPU half rather than silently testing P2a
 * twice.
 *
 * The scene is a CONSTANT −45° pitch (not animated), for two reasons: a single decoded
 * frame can be checked against a hand-computed projection, and - because the picture is
 * nominally identical every frame - the frame-to-frame delta is a clean read of temporal
 * jitter (the flicker). Four claims:
 *
 *  1. **P2b takes the GPU path; P2a takes the capture path** - each announces itself, so
 *     a browser with no WebGL2 (P2b silently fell back to P2a) is detected and skipped,
 *     never passed off as parity.
 *  2. **P2b draws the TILTED picture correctly** - both cards' centroids land where the
 *     engine's own `projectSurfacePoint` puts them, same tolerance as the P2a tier.
 *  3. **P2b is at PARITY with P2a** - the same output frame of the two exports differs by
 *     only AA/codec noise (mean luma diff small). This is the parity gate, and it is also
 *     the alarm for the premultiplied-alpha readback risk: a mismatched alpha model
 *     darkens P2b's edges and blows this number up.
 *  4. **P2b is temporally STABLE (the flicker fix)** - on a constant pose, P2b's
 *     frame-to-frame delta is ≤ P2a's: one texture resampled identically every frame
 *     cannot shimmer the way independent per-frame rasters do.
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

const CARD: [number, number, number] = [230, 60, 90];
const LIFTED: [number, number, number] = [60, 190, 230];

const TILT_KF = 't0_rx-45';   // constant pitch - same picture every frame

interface BoxLike {
  x?: number; y?: number; w?: number; h?: number; bg?: string;
  start?: number; dur?: number; z?: number; kf?: string; camera?: boolean;
}
interface StageLike { w: number; h: number; seqMs: number; bg: string; boxes: BoxLike[] }

function scene(cameraKf: string): StageLike {
  return {
    w: W, h: H, seqMs: MS, bg: 'rgb(8,10,16)',
    boxes: [
      { x: 200, y: 60, w: 240, h: 80, bg: `rgb(${CARD.join(',')})`, start: 0, dur: MS, z: 0 },
      { x: 200, y: 220, w: 240, h: 80, bg: `rgb(${LIFTED.join(',')})`, start: 0, dur: MS, z: 200 },
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

describe('plans/104 P2b — the GPU quad compositor at parity with P2a', { skip: gate ?? false, concurrency: 1 }, () => {
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

  test('P2b matches P2a on a tilted scene, draws the right picture, and does not flicker', async () => {
    const idx = [0, 14, 29];
    const r = await page().evaluate(async ({ spec, fps, targets, idx }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const [f0, f1, f2] = idx as [number, number, number];
      // Same scene, both tiers: P2b behind the flag, P2a with it off.
      const gl = await S.exportSeq(spec, 'webm', { fps, width: spec.w, gl: true });
      const cap = await S.exportSeq(spec, 'webm', { fps, width: spec.w, gl: false });
      const took = (logs: string[], re: RegExp): boolean => logs.some((l) => re.test(l));
      const out = {
        gl: {
          err: gl.error, size: gl.size, logs: gl.logs,
          usedGpu: took(gl.logs, /GPU compositor/i),
          track: gl.key ? await S.trackColors(gl.key, idx, fps, targets) : null,
          self: gl.key ? [await S.frameSelfDelta(gl.key, f0, f1, fps), await S.frameSelfDelta(gl.key, f1, f2, fps)] : [],
        },
        cap: {
          err: cap.error, size: cap.size, logs: cap.logs,
          usedCapture: took(cap.logs, /TILT export/i),
          track: cap.key ? await S.trackColors(cap.key, idx, fps, targets) : null,
          self: cap.key ? [await S.frameSelfDelta(cap.key, f0, f1, fps), await S.frameSelfDelta(cap.key, f1, f2, fps)] : [],
        },
        // parity: same frame of both exports, mean luma diff
        delta: (gl.key && cap.key) ? await Promise.all(idx.map((f) => S.frameDelta(gl.key as string, cap.key as string, f, fps))) : [],
      };
      return out;
    }, { spec: scene(TILT_KF), fps: FPS, targets: [CARD, LIFTED] as [number, number, number][], idx });

    // Both exported.
    assert.equal(r.cap.err, null, `the P2a capture export failed: ${JSON.stringify(r.cap.err)}`);
    assert.ok(r.cap.usedCapture, 'the P2a run must take (and log) the capture tier');
    assert.equal(r.gl.err, null, `the P2b GPU export failed: ${JSON.stringify(r.gl.err)}`);

    // 1. If WebGL2 is absent, P2b fell back to P2a - do not pretend that is parity.
    if (!r.gl.usedGpu) {
      say('[skip] the launched browser has no WebGL2 quad compositor — P2b fell back to P2a; GPU parity not exercised here.');
      console.log('[browser] no WebGL2 — GPU compositor parity SKIPPED (P2a fallback verified to still export).');
      assert.ok(r.gl.size > 1000, 'even the fallback must produce a video');
      return;
    }
    say('[measured] P2b took the GPU compositor path.');
    assert.ok(r.gl.size > 1000, `a ${r.gl.size}B file is not a video`);

    // 2. P2b draws the TILTED picture: both cards present, centroids where the engine puts them.
    const tf = r.gl.track!.frames;
    assert.ok(tf.length === 3, 'three probed frames');
    const scaleY = r.gl.track!.h / H;
    for (const [i, box] of ([[0, { cy: 100, z: 0 }], [1, { cy: 260, z: 200 }]] as const)) {
      assert.ok((tf[0]?.[i]?.n ?? 0) > 500, `card ${i} missing from P2b frame (${tf[0]?.[i]?.n} px)`);
      const want = centre(TILT_KF, 0, 320, box.cy, box.z);
      assert.ok(want, 'the engine can project this centre');
      const got = (tf[0]?.[i]?.cy ?? Number.NaN) / scaleY;
      say(`[measured] P2b card ${i} centroid ${got.toFixed(1)} (engine says ${want.y.toFixed(1)})`);
      assert.ok(Math.abs(got - want.y) < 12, `P2b card ${i} centroid ${got.toFixed(1)} ≠ engine ${want.y.toFixed(1)}`);
    }

    // 3. PARITY: P2b vs P2a, same frame, only AA/codec noise apart. Also the alpha alarm.
    for (let k = 0; k < idx.length; k++) {
      const d = r.delta[k] as number;
      say(`[measured] parity frame ${idx[k]}: P2b↔P2a mean luma Δ = ${d.toFixed(2)}`);
      assert.ok(Number.isFinite(d), `parity delta for frame ${idx[k]} did not compute`);
      assert.ok(d < 10, `P2b diverges from P2a at frame ${idx[k]} (Δ ${d.toFixed(2)} — check the premultiplied-alpha readback)`);
    }

    // 4. TEMPORAL STABILITY (the flicker fix): P2b's frame-to-frame delta ≤ P2a's.
    const glSelf = Math.max(...(r.gl.self as number[]));
    const capSelf = Math.max(...(r.cap.self as number[]));
    say(`[measured] temporal jitter (const pose): P2b ${glSelf.toFixed(3)} vs P2a ${capSelf.toFixed(3)} mean luma`);
    assert.ok(Number.isFinite(glSelf) && Number.isFinite(capSelf), 'temporal deltas computed');
    assert.ok(glSelf <= capSelf + 0.5, `P2b flickers more than P2a (${glSelf.toFixed(3)} vs ${capSelf.toFixed(3)})`);
  });
});

// ── the page-side API, typed only as far as this file uses it ────────────────

interface RunLike {
  key: string | null; type: string; size: number; ms: number; logs: string[]; frames: number;
  error: { code: string; message: string } | null;
}
interface SeqApi {
  exportSeq(spec: unknown, format: 'mp4' | 'webm' | 'gif' | 'apng', opts?: Record<string, unknown>): Promise<RunLike>;
  frameDelta(keyA: string, keyB: string, frameIdx: number, fps: number): Promise<number>;
  frameSelfDelta(key: string, frameA: number, frameB: number, fps: number): Promise<number>;
  trackColors(key: string, frameIdx: number[], fps: number, targets: [number, number, number][], tol?: number):
    Promise<{ w: number; h: number; frames: { n: number; cx: number; cy: number }[][] }>;
}
