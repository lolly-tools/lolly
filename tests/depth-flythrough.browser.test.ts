// SPDX-License-Identifier: MPL-2.0
/**
 * plans/104 P1 - THE FLYTHROUGH EXIT DEMO, run as a test.
 *
 * section 9's P1 exit criteria, enacted end to end in a real browser: "layers lifted, push-in
 * with parallax + DOF + soft shadows, mp4 byte-stable across two runs, still-at-playhead
 * is real SVG, bg moves under pan." Everything here is measured from the exported FILE - 
 * decoded pixels, hashed bytes, parsed markup - never from an intermediate the pipeline
 * also produced.
 *
 * WHY IT IS A TEST AND NOT A SCRIPT. The demo is a gate, and a gate that only ever ran
 * once is a screenshot. It rides the same browser tier as `sequence-render.browser.test.ts`
 * (skip with the install command when there is no browser; skip the H.264 cases when the
 * launched build cannot encode one), so it stays green on a bare machine and bites on a
 * real one. Set `LOLLY_P1_DEMO_OUT=<dir>` to also WRITE the artefacts - the mp4s, the
 * stills and the contact sheet - which is what makes it a demo as well as a gate.
 *
 * THE SCENE (built once, shared by every case). A 960×540 stage whose own paint is a
 * two-tone plane with one hard vertical edge at x = 300 - that plane is section 5.5's implicit
 * z = 0 background layer, and the edge is how "the bg moves under a pan" becomes a
 * number. On it, four flat, well-separated colours at a staggered depth:
 *
 *      z    centre        offset from stage centre     colour
 *      0    (320, 190)    (−160, −80)                  red
 *      80   (320, 350)    (−160, +80)                  green
 *      160  (640, 190)    (+160, −80)                  amber
 *      240  (640, 350)    (+160, +80)                  violet
 *
 * The four offsets are the SAME magnitude (178.9 px) by construction, which is the whole
 * point: a projected centre is `W/2 + (c − camX − W/2)·eff`, so the displacement between
 * two frames is exactly `|offset| · Δeff` - with the geometry held equal, the only thing
 * left that can order the four displacements is depth. The three lifted layers carry
 * `shadow: depth`, whose drop-shadow the hooks derive from z by the same formula.
 *
 * The camera is an untimed ("Always on") scene camera - section 5.4's implicit camera, the box
 * with nothing in it but the `[data-cam]` marker - carrying a SHIPPED preset track from
 * `KF_CAMERA_PRESETS` verbatim. Note the preset's dolly sign is the inverse of section 8's
 * sketch, deliberately and with the reasoning written at the constant: the engine's
 * `eff = P/(P − (z − camZ))` makes a GROWING camZ a camera moving away, so "Push in" is
 * `z0 → z−220`. The demo uses what a user clicking the button actually gets.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openHarness, browserGate, usingChannel, type Harness } from './helpers/sequence-browser.ts';
import { closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { parseKf, resolveCamera, projectLayer, dofBlur } from '../engine/src/keyframes.ts';
import { parseCssMatrix } from '../engine/src/css-box.ts';

const gate = browserGate();

/** Where to write the artefacts, or null to only assert. */
const OUT = process.env.LOLLY_P1_DEMO_OUT || null;

/** Everything the demo measured, printed at the end of the run. */
const measured: string[] = [];
const say = (line: string): void => { measured.push(line); };

// ── the scene ────────────────────────────────────────────────────────────────

const W = 960;
const H = 540;
const MS = 4000;
const FPS = 30;
/** frameTimestamps(4000, 30) = 120 frames at n·1000/30, so the last is 3966.67 ms. */
const LAST = 119;
const tOf = (n: number): number => (n * 1000) / FPS;

/**
 * The stage's own two-tone plane. The left tone's run along a clear row IS the edge.
 *
 * The two tones are 36/59/94 apart per channel and read with `tol = 22`, deliberately:
 * the first draft used a near-black pair 10/19/38 apart under the layer tracker's
 * `tol = 48`, so EVERY pixel of the row matched the left tone and the run came back a
 * constant 960 - a measurement that could not have failed and therefore said nothing.
 */
const BG_LEFT: [number, number, number] = [10, 15, 30];
const BG_TOL = 22;
const BG_EDGE_X = 300;
const BG_CSS = `linear-gradient(90deg, rgb(10,15,30) 0 ${BG_EDGE_X}px, rgb(46,74,124) ${BG_EDGE_X}px)`;

/** The four layers: depth, centre, size, colour. Offsets are equal in magnitude. */
const LAYERS = [
  { name: 'bg panel', z: 0, cx: 320, cy: 190, w: 220, h: 140, rgb: [200, 60, 60] as [number, number, number] },
  { name: 'card A', z: 80, cx: 320, cy: 350, w: 220, h: 140, rgb: [60, 180, 90] as [number, number, number] },
  { name: 'card B', z: 160, cx: 640, cy: 190, w: 220, h: 140, rgb: [230, 190, 40] as [number, number, number] },
  { name: 'title', z: 240, cx: 640, cy: 350, w: 220, h: 140, rgb: [110, 90, 220] as [number, number, number] },
] as const;

const TARGETS = LAYERS.map((l) => l.rgb);

/** The shipped preset tracks, copied verbatim from `KF_CAMERA_PRESETS`. */
const PUSH_IN = 't0_z0*t4000_eo_z-220';
const PAN_ACROSS = 't0_x-140*t4000_el_x140';
const REVEAL = 't0_z-260_a0.5_f200*t3500_eo_z0_a0';

interface BoxLike {
  x?: number; y?: number; w?: number; h?: number; bg?: string; text?: string; radius?: string;
  start?: number; dur?: number; lane?: 'seq' | '';
  z?: number; kf?: string; camera?: boolean; depthShadow?: boolean;
}
interface StageLike { w: number; h: number; seqMs: number; bg: string; boxes: BoxLike[] }

/** The scene, with `cameraKf` as the only variable. */
function scene(cameraKf: string): StageLike {
  return {
    w: W, h: H, seqMs: MS, bg: BG_CSS,
    boxes: [
      ...LAYERS.map((l) => ({
        x: l.cx - l.w / 2, y: l.cy - l.h / 2, w: l.w, h: l.h,
        bg: `rgb(${l.rgb[0]},${l.rgb[1]},${l.rgb[2]})`,
        radius: '18px',
        start: 0, dur: MS,
        z: l.z,
        // Every LIFTED layer carries the depth shadow; the z = 0 plane has nothing to
        // cast (10 + 0·0.2 would still draw a 10px ring, which is not "at rest").
        depthShadow: l.z > 0,
      })),
      // section 5.4's implicit scene camera: untimed, no picture, pose on the wrapper.
      { x: 0, y: 0, w: 8, h: 8, camera: true, kf: cameraKf },
    ],
  };
}

// ── what the ENGINE says should happen (predicted before anything is measured) ──

/** The camera pose at sequence time `t`, resolved by the engine itself. */
function poseAt(kf: string, t: number): ReturnType<typeof resolveCamera> {
  return resolveCamera([{ start: 0, end: null, base: null, track: parseKf(kf) }], t);
}

/** A layer's projected centre, stage-native px, at sequence time `t`. */
function centreAt(kf: string, t: number, l: { z: number; cx: number; cy: number }): { x: number; y: number } {
  const pose = poseAt(kf, t);
  const proj = projectLayer({ ...pose, w: W, h: H }, { bx: l.cx, by: l.cy, z: l.z });
  return { x: l.cx + proj.dx, y: l.cy + proj.dy };
}

/** Predicted |displacement| in stage px between two frames, per layer. */
function predictedParallax(kf: string, tA: number, tB: number): number[] {
  return LAYERS.map((l) => {
    const a = centreAt(kf, tA, l);
    const b = centreAt(kf, tB, l);
    return Math.hypot(b.x - a.x, b.y - a.y);
  });
}

// ── the run ──────────────────────────────────────────────────────────────────

describe('plans/104 P1 — the depth flythrough exit demo', { skip: gate ?? false, concurrency: 1 }, () => {
  let Hn: Harness;
  const page = (): Harness['page'] => Hn.page;
  let mp4 = false;

  before(async () => {
    Hn = await openHarness();
    const p = Hn.probe;
    mp4 = p.avcEncode;
    console.log(`[browser] ${usingChannel() ? `channel=${process.env.LOLLY_BROWSER_CHANNEL ?? process.env.LOLLY_BROWSER_PATH}` : 'bundled Chromium'} :: ${p.ua}`);
    console.log(`[codecs] avcEncode=${p.avcEncode} vp8=${p.vp8} vp9=${p.vp9}`);
    if (OUT) { mkdirSync(OUT, { recursive: true }); console.log(`[demo] writing artefacts to ${OUT}`); }
    assert.ok(p.webcodecs, 'the launched browser has no WebCodecs at all');
  });

  after(async () => {
    await Hn?.close();
    await closeBrowser();
    for (const line of measured) console.log(line);
  });

  /** Pull a stored blob out of the page and write it, when an out dir was given. */
  async function save(key: string, name: string): Promise<string | null> {
    if (!OUT) return null;
    const b64 = await page().evaluate((k) => (window as never as { SEQ: SeqApi }).SEQ.blobBytes(k), key);
    const path = join(OUT, name);
    writeFileSync(path, Buffer.from(b64, 'base64'));
    return path;
  }

  // ── 1. the flythrough: byte-stable twice over, with a depth-ordered parallax ──

  test('push-in: the same flythrough exports twice byte-identically, and parallax is ordered by depth', async () => {
    const spec = scene(PUSH_IN);
    const r = await page().evaluate(async ({ spec, fps, targets, last }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      // THROUGH THE PUBLIC FUNNEL, both times. `exportSeq` calls `renderSequence`
      // directly, which is one layer below where every real export lives - and the
      // difference is not cosmetic: the funnel detaches `[data-export-hide]` nodes
      // from the live tree, which used to include the section 5.4 camera marker and left
      // this exact flythrough completely motionless (measured: 0.0 px on all four
      // layers, 35,691 B instead of 230,632 B). Driving the demo through
      // `exportViaApi` is what makes that class of defect visible here at all.
      const a = await S.exportViaApi(spec, 'mp4', { fps, width: spec.w });
      const b = await S.exportViaApi(spec, 'mp4', { fps, width: spec.w });
      // The same scene down the OTHER container, twice. mp4 and webm share the whole
      // render - compositor, plates, projection, frame grid - and differ only in the
      // encoder and muxer, so running both is what separates "the render wobbles" from
      // "the container stamps the clock".
      const wa = await S.exportViaApi(spec, 'webm', { fps, width: spec.w });
      const wb = await S.exportViaApi(spec, 'webm', { fps, width: spec.w });
      // The compositor called DIRECTLY, as the control: the funnel must add nothing
      // and take nothing away. A byte difference here is a funnel-only regression,
      // which is precisely the shape the camera-marker detach had.
      const direct = await S.exportSeq(spec, 'mp4', { fps, width: spec.w });
      const idx = [0, 30, 60, last];
      return {
        a: { err: a.error, size: a.size, key: a.key, ms: a.ms, logs: a.logs },
        b: { err: b.error, size: b.size, key: b.key, ms: b.ms },
        sha: { a: a.key ? await S.blobSha(a.key) : '', b: b.key ? await S.blobSha(b.key) : '' },
        diff: a.key && b.key ? await S.blobDiff(a.key, b.key) : null,
        pix: {
          a: a.key ? await S.frameHashes(a.key, idx, fps) : [],
          b: b.key ? await S.frameHashes(b.key, idx, fps) : [],
        },
        webm: {
          err: wa.error ?? wb.error, size: wa.size,
          shaA: wa.key ? await S.blobSha(wa.key) : '', shaB: wb.key ? await S.blobSha(wb.key) : '',
        },
        direct: {
          err: direct.error, size: direct.size,
          pix: direct.key ? await S.frameHashes(direct.key, idx, fps) : [],
        },
        track: a.key ? await S.trackColors(a.key, [0, last], fps, targets) : null,
      };
    }, { spec, fps: FPS, targets: TARGETS as unknown as [number, number, number][], last: LAST });

    if (!mp4 && r.a.err) {
      say(`[skip] mp4: this build cannot encode H.264 (${r.a.err.code}) — rerun with LOLLY_BROWSER_CHANNEL=chrome`);
      return;
    }
    assert.equal(r.a.err, null, `first flythrough failed: ${JSON.stringify(r.a.err)}`);
    assert.equal(r.b.err, null, `second flythrough failed: ${JSON.stringify(r.b.err)}`);

    // ── STABILITY, in the three layers the evidence actually supports ──────────
    //
    // 1. THE PICTURE is bit-identical. This is the render's own claim and the only one
    //    that can catch a nondeterministic compositor, plate ladder or projection.
    assert.deepEqual(r.pix.a, r.pix.b,
      `the two flythroughs decoded to different pixels:\n  A ${r.pix.a.join('\n    ')}\n  B ${r.pix.b.join('\n    ')}`);
    // 1b. THE FUNNEL IS TRANSPARENT: the same scene straight through `renderSequence`
    //     decodes to the same pixels. This is the camera-marker regression's own pin.
    assert.equal(r.direct.err, null, `the direct control export failed: ${JSON.stringify(r.direct.err)}`);
    assert.deepEqual(r.pix.a, r.direct.pix,
      `the public export funnel and a direct renderSequence disagree — something in api.render is changing the stage:\n  funnel ${r.pix.a.join('\n         ')}\n  direct ${r.direct.pix.join('\n         ')}`);
    // 2. THE WEBM CONTAINER is byte-identical - same render, a muxer that stamps no clock.
    assert.equal(r.webm.err, null, `webm control export failed: ${JSON.stringify(r.webm.err)}`);
    assert.equal(r.webm.shaA, r.webm.shaB,
      `webm is not byte-stable across two runs — this IS the render:\n  A ${r.webm.shaA}\n  B ${r.webm.shaB}`);
    // 3. THE MP4 CONTAINER is not, and the difference is bounded to metadata.
    //    section 9's exit criterion says "mp4 byte-stable across two runs"; it is not, and the
    //    reason is outside this feature: `mp4-muxer` 5.2.2 writes
    //    `Math.floor(Date.now()/1000)` into mvhd/tkhd/mdhd creation+modification time
    //    (6 bytes, no option to pin it), and macOS VideoToolbox tags the IDR with a
    //    user_data_unregistered SEI (UUID 47564adc-5c4c-433f-94ef-c5113cd143a8) whose
    //    payload carries one varying byte. The coded slice NALs are identical. The
    //    number is asserted rather than the sha, so genuine drift - which would be
    //    thousands of bytes across the slice data - still fails here.
    const d = r.diff!;
    assert.equal(d.sizeA, d.sizeB, `the two mp4s are different lengths: ${d.sizeA} vs ${d.sizeB}`);
    // The bound is STRUCTURAL, not a byte count. The count is not stable: each of the
    // six timestamp fields is a 32-bit second counter, so two runs a second apart differ
    // in one byte each and two runs that straddle a 256-second boundary differ in two - 
    // a `<= 8` budget passed standalone and failed under a loaded full-suite run for
    // reasons that had nothing to do with the render. What IS stable is WHERE: this
    // fixture's `moov` ends at 1191 and the first sample's SEI at 1256, and the ~228 KB
    // of coded slices after that must be identical byte for byte. Real drift lands in
    // the slice data and fails here regardless of the clock.
    const HEADER_END = 2048;
    const outside = d.ranges.filter(([s]) => s >= HEADER_END);
    assert.deepEqual(outside, [],
      `mp4 differs in the CODED PICTURE data across two runs (not just the container header): ${JSON.stringify(outside.slice(0, 12))}`);
    assert.ok(d.ranges.length <= 8 && d.bytes <= 32,
      `mp4 header differs more than the mvhd/tkhd/mdhd timestamps + one SEI byte can explain: ${d.bytes} bytes in ${d.ranges.length} ranges ${JSON.stringify(d.ranges.slice(0, 12))}`);
    say(`[demo] push-in mp4  ${r.a.size} B  sha A ${r.sha.a.slice(0, 16)}… / B ${r.sha.b.slice(0, 16)}…  → ${d.bytes} differing bytes at ${JSON.stringify(d.ranges)} (mvhd/tkhd/mdhd time + 1 SEI byte); pixels identical; webm sha ${r.webm.shaA.slice(0, 16)}… identical both runs  ${Math.round(r.a.ms)} ms/run`);

    // PARALLAX - measured from the decoded frames, in stage px.
    const t = r.track!;
    const k = t.w / W;
    const first = t.frames[0]!;
    const lastF = t.frames[1]!;
    const moved = LAYERS.map((_, i) => {
      const A = first[i]!;
      const B = lastF[i]!;
      return Math.hypot(B.cx - A.cx, B.cy - A.cy) / k;
    });
    const predicted = predictedParallax(PUSH_IN, tOf(0), tOf(LAST));

    for (let i = 0; i < LAYERS.length; i++) {
      assert.ok((first[i]!.n) > 500 && (lastF[i]!.n) > 500,
        `layer "${LAYERS[i]!.name}" is not on screen in both frames (px: ${first[i]!.n} then ${lastF[i]!.n})`);
    }
    for (let i = 0; i < LAYERS.length; i++) {
      say(`[demo] parallax z=${String(LAYERS[i]!.z).padStart(3)} "${LAYERS[i]!.name}": measured ${moved[i]!.toFixed(1)} px, engine predicts ${predicted[i]!.toFixed(1)} px (Δ ${(moved[i]! - predicted[i]!).toFixed(2)})`);
    }

    // The headline assertion: the deepest-lifted layer moves further than the flat one.
    assert.ok(moved[3]! > moved[0]!,
      `the z=240 layer must displace further than the z=0 layer: ${moved[3]!.toFixed(1)} px vs ${moved[0]!.toFixed(1)} px`);
    // …and the whole ladder is monotone in z, which a single pair could not prove.
    for (let i = 1; i < moved.length; i++) {
      assert.ok(moved[i]! > moved[i - 1]!,
        `parallax must grow with depth: z=${LAYERS[i]!.z} moved ${moved[i]!.toFixed(1)} px but z=${LAYERS[i - 1]!.z} moved ${moved[i - 1]!.toFixed(1)} px`);
    }
    // Every measurement inside 2 px of the engine's own arithmetic. The tolerance is
    // for the centroid of a chroma-subsampled edge, not for the projection: a real
    // fold error is tens of px (the section 4.1 "naive reading" defect is 240 px).
    for (let i = 0; i < moved.length; i++) {
      assert.ok(Math.abs(moved[i]! - predicted[i]!) < 2,
        `layer "${LAYERS[i]!.name}": exported displacement ${moved[i]!.toFixed(2)} px disagrees with the engine's ${predicted[i]!.toFixed(2)} px`);
    }
    say(`[demo] parallax ratio z240/z0 = ${(moved[3]! / moved[0]!).toFixed(3)} (engine: ${(predicted[3]! / predicted[0]!).toFixed(3)})`);

    const path = await save(r.a.key!, 'push-in.mp4');
    if (path) say(`[demo] wrote ${path}`);
  });

  // ── 2. the background is a layer, and a pan moves it ─────────────────────────

  test('pan across: the stage background moves under the camera', async () => {
    const spec = scene(PAN_ACROSS);
    const r = await page().evaluate(async ({ spec, fps, last, bgLeft, tol }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      const a = await S.exportViaApi(spec, 'mp4', { fps, width: spec.w });
      return {
        err: a.error, size: a.size, key: a.key,
        // y = 0.037 → row 20 of 540: above every layer at every instant of this move.
        run: a.key ? await S.rowRun(a.key, [0, last], fps, 0.037, bgLeft, tol) : null,
      };
    }, { spec, fps: FPS, last: LAST, bgLeft: BG_LEFT, tol: BG_TOL });

    if (!mp4 && r.err) { say('[skip] pan-across mp4: no H.264 on this build'); return; }
    assert.equal(r.err, null, `pan-across export failed: ${JSON.stringify(r.err)}`);

    const k = r.run!.w / W;
    // The TRAILING edge of the left tone, not the count. camZ stays 0 through this
    // move, so the bg plane's eff is exactly 1 and the edge sits at `BG_EDGE_X − camX`
    // - 440 px at t0 (camX = −140) and 160 px at the end. The count is a different
    // number as soon as the pan pushes the plane's own left edge off-canvas (at
    // camX = −140 the frame's first 140 px are outside the plane), which is exactly
    // what the first draft of this case mistook for the edge.
    const edge = r.run!.span.map(([, end]) => end / k);
    const predA = BG_EDGE_X - poseAt(PAN_ACROSS, tOf(0)).x;
    const predB = BG_EDGE_X - poseAt(PAN_ACROSS, tOf(LAST)).x;
    const revealed = r.run!.head[0]!;
    say(`[demo] bg edge: ${edge[0]!.toFixed(1)} px → ${edge[1]!.toFixed(1)} px (engine predicts ${predA.toFixed(1)} → ${predB.toFixed(1)}), travel ${(edge[1]! - edge[0]!).toFixed(1)} px; the strip the pan reveals at x=2 reads rgba(${revealed.join(',')})`);

    assert.ok(Math.abs(edge[1]! - edge[0]!) > 200,
      `the background did not move under the pan: edge at ${edge[0]!.toFixed(1)} px then ${edge[1]!.toFixed(1)} px`);
    assert.ok(Math.abs(edge[0]! - predA) < 3 && Math.abs(edge[1]! - predB) < 3,
      `the background moved, but not where the projection says: ${edge[0]!.toFixed(1)}/${edge[1]!.toFixed(1)} vs ${predA.toFixed(1)}/${predB.toFixed(1)}`);

    const path = await save(r.key!, 'pan-across.mp4');
    if (path) say(`[demo] wrote ${path}`);
  });

  // ── 3. the posed still stays VECTOR ─────────────────────────────────────────

  test('the still at the playhead, mid-move, is real SVG: matrix() transforms that round-trip', async () => {
    const spec = scene(PUSH_IN);
    const r = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.vectorStillAt(spec, t, 'svg');
    }, { spec, t: 2000 });

    assert.equal(r.type, 'image/svg+xml', `the still is not SVG: ${r.type}`);
    assert.ok(r.text.startsWith('<svg') || r.text.includes('<svg'), 'no <svg> root in the still');
    assert.ok(!/<image\b/.test(r.text), 'the posed still fell back to an embedded raster');

    const mats = [...r.text.matchAll(/matrix\(([^)]*)\)/g)].map((m) => `matrix(${m[1]})`);
    assert.ok(mats.length >= LAYERS.length,
      `expected at least one matrix() per projected layer, found ${mats.length}`);
    // Every one of them is a 2-D affine the engine's own reader accepts - the
    // "posed still stays vector" claim is exactly this, and nothing weaker.
    const scales: number[] = [];
    for (const m of mats) {
      const parsed = parseCssMatrix(m);
      assert.ok(parsed, `parseCssMatrix refused a transform the walker emitted: ${m}`);
      scales.push(parsed.a);
    }
    // The projection at t = 2000 puts four distinct scales on the stage; a still that
    // had flattened the camera away would carry one repeated value.
    const wanted = LAYERS.map((l) => projectLayer({ ...poseAt(PUSH_IN, 2000), w: W, h: H }, { bx: l.cx, by: l.cy, z: l.z }).scale);
    for (const s of wanted) {
      assert.ok(scales.some((v) => Math.abs(v - s) < 0.01),
        `no matrix in the still carries the projected scale ${s.toFixed(4)}; got ${scales.map((v) => v.toFixed(4)).join(', ')}`);
    }
    // The soft shadows are geometry too, not a bitmap: one <feDropShadow> per lifted
    // layer, derived from z by the section 5.3 straight-overhead formula.
    const fd = (r.text.match(/<feDropShadow/g) ?? []).length;
    assert.equal(fd, LAYERS.filter((l) => l.z > 0).length,
      `expected one <feDropShadow> per lifted layer, got ${fd}`);
    say(`[demo] still @2000ms: ${r.size} B SVG, ${mats.length} matrix() transforms + ${fd} feDropShadow + 0 rasters, scales ${[...new Set(scales.map((v) => v.toFixed(3)))].join(' / ')} (engine: ${wanted.map((v) => v.toFixed(3)).join(' / ')})`);

    const path = await save(r.key, 'still-mid-move.svg');
    if (path) say(`[demo] wrote ${path}`);
  });

  test('with DOF active the still carries feGaussianBlur (the Reveal preset, mid-move)', async () => {
    // Reveal is the DOF showcase: `a` runs 0.5 → 0, `f` sits at 200. At t = 1200 the
    // aperture is open, so every layer off the focal plane is genuinely defocused.
    const spec = scene(REVEAL);
    const pose = poseAt(REVEAL, 1200);
    const blurs = LAYERS.map((l) => dofBlur(pose, l.z));
    assert.ok(blurs.some((b) => b > 0.5), `the fixture has no DOF at t=1200: ${blurs.join(', ')}`);

    const r = await page().evaluate(async ({ spec, t }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.vectorStillAt(spec, t, 'svg');
    }, { spec, t: 1200 });

    assert.equal(r.type, 'image/svg+xml', `the still is not SVG: ${r.type}`);
    const appliedBlur = r.posed.filter((p) => /blur\(/.test(p.filter)).length;
    assert.ok(appliedBlur > 0,
      `the DOM applier wrote no blur at the playhead — engine says ${blurs.map((b) => b.toFixed(2)).join(', ')} px; filters were: ${r.posed.map((p) => p.filter || '(none)').join(' | ')}`);
    assert.ok(/feGaussianBlur/.test(r.text),
      `a defocused still exported without a single feGaussianBlur (${appliedBlur} boxes carried a CSS blur)`);
    const fe = (r.text.match(/feGaussianBlur/g) ?? []).length;
    const fd = (r.text.match(/feDropShadow/g) ?? []).length;
    const img = (r.text.match(/<image\b/g) ?? []).length;

    // WHERE THE VECTOR GUARANTEE ACTUALLY STOPS, pinned rather than glossed. The flat
    // layer carries DOF alone and stays vector (`feGaussianBlur`). The three LIFTED
    // layers carry the DOF blur AND their depth drop-shadow in one chain, and a mixed
    // chain defeats both parsers - `parseDropShadowFilter` refuses a chain containing
    // a non-drop-shadow function, and `parseCssFilter`'s flat tokeniser cannot see past
    // the nested `rgba()` of a computed drop-shadow colour - so each takes the
    // per-element raster escape hatch. That is the house posture (degrade visibly, with
    // the spill measured so nothing is sheared off) and it is pinned in
    // `shells/web/src/bridge/export-pdf-filter.test.ts`. Pinned HERE too because it is
    // the exact boundary of section 9's "the still-at-playhead is real SVG": with depth
    // shadows and no DOF the still is 100% vector (the case above proves it); switch
    // DOF on over the same shadows and the lifted layers become images.
    assert.equal(img, 3,
      `expected exactly the three blur+drop-shadow layers to rasterise, got ${img} <image> elements`);
    assert.ok(fe >= 1, `the DOF-only layer did not stay vector: ${fe} feGaussianBlur`);
    say(`[demo] DOF still @1200ms: ${r.size} B SVG, ${fe} feGaussianBlur + ${fd} feDropShadow + ${img} raster fallbacks (the blur×drop-shadow chains); engine DOF px per layer ${blurs.map((b) => b.toFixed(2)).join(' / ')}`);

    const path = await save(r.key, 'still-mid-move-dof.svg');
    if (path) say(`[demo] wrote ${path}`);
  });

  // ── 4. the contact sheet comes free ─────────────────────────────────────────

  test('cuts=4 walks the same flythrough into a four-up contact sheet', async () => {
    const spec = scene(PUSH_IN);
    const r = await page().evaluate(async ({ spec }) => {
      const S = (window as never as { SEQ: SeqApi }).SEQ;
      return await S.cutsAt(spec, 4, 'svg', [{ x: 640, y: 350 }]);
    }, { spec });

    assert.equal(r.type, 'application/zip', `cuts=4 did not produce an archive: ${r.type}`);
    assert.equal(r.names!.length, 4, `expected 4 members, got ${r.names!.join(', ')}`);
    assert.ok(r.restored, 'the contact sheet left the artboard modified');

    // Each cut is a DIFFERENT instant of the same move, so each member must carry its
    // own projected scales. Reading the markup rather than a raster probe is what the
    // page can actually do here (Chromium refuses `createImageBitmap` on the walker's
    // viewBox-only SVG), and it is the stronger check anyway: it proves the sheet is
    // vector AND that the camera advanced between cuts.
    const scalesPer = (r.texts ?? []).map((svg) => {
      const set = new Set<string>();
      for (const m of svg.matchAll(/matrix\(([^)]*)\)/g)) {
        const p = parseCssMatrix(`matrix(${m[1]})`);
        if (p) set.add(p.a.toFixed(4));
      }
      return [...set].sort();
    });
    assert.equal(scalesPer.length, 4, 'the members were not readable as SVG text');
    for (let i = 0; i < 4; i++) {
      assert.ok(scalesPer[i]!.length >= LAYERS.length,
        `cut ${i + 1} carries ${scalesPer[i]!.length} distinct projected scales, expected ${LAYERS.length}: ${scalesPer[i]!.join(', ')}`);
    }
    const distinct = new Set(scalesPer.map((s) => s.join('|')));
    assert.equal(distinct.size, 4, `the four cuts are not four different instants: ${[...distinct].join('  ||  ')}`);
    say(`[demo] contact sheet: ${r.size} B zip, members ${r.names!.join(', ')}; per-cut projected scales ${scalesPer.map((s) => s.join('/')).join('   ')}`);

    const path = await save(r.key!, 'contact-sheet-cuts4.zip');
    if (path) say(`[demo] wrote ${path}`);
  });
});

// ── the page-side API, typed only as far as this file uses it ────────────────

interface RunLike {
  key: string | null; type: string; size: number; ms: number; logs: string[];
  error: { code: string; message: string } | null;
}
interface SeqApi {
  exportSeq(spec: unknown, format: 'mp4' | 'webm' | 'gif' | 'apng', opts?: Record<string, unknown>): Promise<RunLike>;
  blobSha(key: string): Promise<string>;
  blobBytes(key: string): Promise<string>;
  blobDiff(a: string, b: string, maxRanges?: number):
    Promise<{ sizeA: number; sizeB: number; ranges: [number, number][]; bytes: number; truncated: boolean }>;
  frameHashes(key: string, frameIdx: number[], fps: number): Promise<string[]>;
  trackColors(key: string, frameIdx: number[], fps: number, targets: [number, number, number][], tol?: number):
    Promise<{ w: number; h: number; frames: { n: number; cx: number; cy: number }[][] }>;
  rowRun(key: string, frameIdx: number[], fps: number, yFrac: number, target: [number, number, number], tol?: number):
    Promise<{ w: number; runs: number[]; span: [number, number][]; head: number[][] }>;
  exportViaApi(spec: unknown, format: string, opts?: Record<string, unknown>): Promise<RunLike>;
  vectorStillAt(spec: unknown, tMs: number, format?: 'svg' | 'pdf'): Promise<{
    text: string; size: number; type: string; key: string;
    posed: { z: string | null; transform: string; filter: string; opacity: string; zIndex: string; off: boolean }[];
  }>;
  cutsAt(spec: unknown, cuts: number, format: string, probes: { x: number; y: number }[]): Promise<{
    key: string | null; type: string; size: number; names?: string[]; texts?: string[];
    notes?: string[]; restored: boolean;
  }>;
}
