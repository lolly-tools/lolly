// SPDX-License-Identifier: MPL-2.0
/**
 * Path handles (plans/330, engine 1.292): the `hi(..)(..)` / `ho(..)(..)` wire, the
 * curved travel they make, the split that keeps a curve whole, the inverse projection
 * the canvas edits through, and the dotLottie tangents.
 *
 * The first test is the one that matters most to everyone who never draws a handle: a
 * track without handles evaluates, and compiles to dotLottie, exactly as the 1.290 code
 * did. The two hashes were taken from that code (`git archive` of the previous commit)
 * over the same inputs, so a change to the straight path that moves a single bit fails
 * here.
 *
 * Run directly:  node --test tests/keyframes-path.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  KF_CHARSET_RE, evaluateKf, kfEaseAt, kfPathCurves, kfSubdividePath, kfUnprojectCentre, parseKf,
  projectLayer, serialiseKf, subdivideKfEase, type KfCameraView, type KfKeyInput,
} from '../engine/src/keyframes.ts';
import { compileLottieSequence, type LottieSequenceLayer } from '../engine/src/lottie-sequence.ts';
import { sampleLottieProperty } from '../engine/src/lottie-properties.ts';
import type { LottieObject } from '../engine/src/lottie-model.ts';

// ── byte identity without handles ─────────────────────────────────────────────

const STRAIGHT = [
  't0_x0_y0*t1000_eo_x200_y-50*t2000_ev_x100_y80*t3000_eh_x0_y0',
  't0_ea_x-40_y10_s1.2_r15_o0.5*t1500_es_x60_s1_o1*t2600_ek_y-30',
  't0_eb(0.2)(1.4)(0.5)(-0.3)_x0_y0*t900_x300_y300',
  't0_x0*t500_y40*t1000_x100*t2000_y-20_x0',
];

const shape = (): LottieSequenceLayer['content'] => ({
  kind: 'shape',
  shapes: [{ ty: 'gr', it: [
    { ty: 'rc', p: { a: 0, k: [50, 25] }, s: { a: 0, k: [100, 50] }, r: { a: 0, k: 0 } },
    { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 } },
    { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
  ] }],
});

test('a track without handles evaluates and exports bit for bit as 1.290 did', () => {
  const evals: number[] = [];
  for (const w of STRAIGHT) {
    const tr = parseKf(w);
    assert.equal(kfPathCurves(tr).size, 0, 'no handle, no curved segment');
    for (let t = -100; t <= 3200; t += 7) {
      const p = evaluateKf(tr, t);
      for (const ch of ['x', 'y', 's', 'r', 'o'] as const) evals.push(p[ch] ?? Number.NaN);
    }
  }
  const evalHash = createHash('sha256').update(Buffer.from(new Float64Array(evals).buffer)).digest('hex');
  assert.equal(evalHash, '8a5ba64571d9262b87da34ace832858e9913beba82bfc7f7c789b06c623df77c');

  const layers: LottieSequenceLayer[] = STRAIGHT.map((kf, i) => ({
    name: `L${i}`, x: 10 * i, y: 20, w: 100, h: 50, rotation: 0, opacity: 1, startMs: 100 * i, durationMs: 3000, kf, content: shape(),
  }));
  const anim = compileLottieSequence({ width: 400, height: 300, fps: 30, durationMs: 3500, layers });
  const lottieHash = createHash('sha256').update(JSON.stringify(anim)).digest('hex');
  assert.equal(lottieHash, '719bd60db69e0ec3cada636570dadf5c35add78262e1d7a695b53ae6abf4546e');
});

test('a straight segment beside a curved one is untouched by the curve', () => {
  const plain = parseKf('t0_x0_y0*t1000_eo_x200_y0*t2000_x200_y200');
  const mixed = parseKf('t0_x0_y0*t1000_eo_x200_y0_ho(0)(80)*t2000_x200_y200_hi(80)(0)');
  assert.deepEqual([...kfPathCurves(mixed)], [[1, 2]], 'only the second segment curves');
  for (let t = 0; t <= 1000; t += 13) {
    assert.deepEqual(evaluateKf(mixed, t), evaluateKf(plain, t), `identical before the curve at ${t}`);
  }
});

// ── the wire ──────────────────────────────────────────────────────────────────

test('wire: handles round-trip, follow the channels and stay inside the charset', () => {
  const wire = 't0_x0_y0_ho(80)(-60)*t1500_eo_x300_y0_hi(-80)(-60)';
  const tr = parseKf(wire);
  assert.deepEqual(tr[0]!.ho, [80, -60]);
  assert.deepEqual(tr[1]!.hi, [-80, -60]);
  assert.equal(tr[0]!.hi, undefined, 'an absent handle stays absent');
  assert.equal(serialiseKf(tr), wire);
  assert.match(serialiseKf(tr), KF_CHARSET_RE);
  // Written after the channels and `hi` before `ho`, whatever order they arrived in.
  assert.equal(serialiseKf(parseKf('t0_ho(1)(2)_hi(3)(4)_x5_y6')), 't0_x5_y6_hi(3)(4)_ho(1)(2)');
  // The law, with handles.
  for (const w of [wire, 't0_x0_y0_hi(1.234)(-9)_ho(0.005)(0)*t9_x1_y1']) {
    assert.deepEqual(parseKf(serialiseKf(parseKf(w))), parseKf(w));
  }
});

test('wire: kept only beside a whole position, clamped, quantised, dropped at (0, 0)', () => {
  assert.equal(serialiseKf(parseKf('t0_x5_hi(3)(4)*t10_y5_ho(1)(1)')), 't0_x5*t10_y5', 'no whole position');
  assert.equal(serialiseKf(parseKf('t0_x0_y0_hi(0.004)(-0.004)')), 't0_x0_y0', '(0, 0) after the quantum');
  assert.equal(serialiseKf(parseKf('t0_x0_y0_ho(5)(5)_ho(0)(0)')), 't0_x0_y0', 'a later (0, 0) clears it');
  assert.equal(serialiseKf(parseKf('t0_x0_y0_ho(999999)(-1.23456)')), 't0_x0_y0_ho(100000)(-1.23)');
  // Malformed tokens are junk, like any other unreadable token.
  const warns: string[] = [];
  assert.equal(serialiseKf(parseKf('t0_x0_y0_ho(1)(2)(3)_hi()(1)_hx(1)(2)', { onWarn: (m) => warns.push(m) })), 't0_x0_y0');
  assert.equal(warns.length, 3);
  // From the input side too: a hand-built key's handle goes through the same rules.
  const built: KfKeyInput[] = [{ t: 0, v: { x: 0, y: 0 }, ho: [1.006, 0] }, { t: 5, v: { x: 1 }, hi: [3, 3] }];
  assert.equal(serialiseKf(built), 't0_x0_y0_ho(1.01)(0)*t5_x1');
});

test('wire: neither token reads as a channel, so an older reader skips both as junk', () => {
  // The rule an older parser applies: a channel name followed by a plain number.
  const channelForm = /^(?:x|y|z|s|r|rx|ry|o|b|f|a|p|w|h|v|cl|ca|cb|ll|la|lb|lw|cr|ts|te)-?(?:\d+(?:\.\d+)?|\.\d+)$/;
  for (const tok of ['hi(80)(-60)', 'ho(-1.5)(2)']) assert.equal(channelForm.test(tok), false, tok);
});

// ── evaluation ────────────────────────────────────────────────────────────────

const CURVED = 't0_el_x0_y0_ho(100)(0)*t1000_x200_y0_hi(0)(-100)';

test('a curved segment starts and ends exactly on its keyframes and leaves the chord', () => {
  const tr = parseKf(CURVED);
  assert.deepEqual(evaluateKf(tr, 0), { x: 0, y: 0 });
  assert.deepEqual(evaluateKf(tr, 1000), { x: 200, y: 0 });
  const mid = evaluateKf(tr, 500);
  assert.ok(mid.y! < -20, `the travel bows away from the straight line (y = ${mid.y})`);
  assert.deepEqual(evaluateKf(tr, 500, ['x']), { x: mid.x }, 'one axis asked for, the same number');
});

test('a linear ease is a constant speed along the curve: arc length, not the parameter', () => {
  const tr = parseKf(CURVED);
  // Travelled length per 20 ms, measured on fine sub-steps so the chord error is tiny.
  const steps: number[] = [];
  for (let t = 0; t < 1000; t += 20) {
    let d = 0;
    let p = evaluateKf(tr, t);
    for (let k = 1; k <= 20; k++) {
      const q = evaluateKf(tr, t + k);
      d += Math.hypot(q.x! - p.x!, q.y! - p.y!);
      p = q;
    }
    steps.push(d);
  }
  const lo = Math.min(...steps), hi = Math.max(...steps);
  assert.ok(hi / lo < 1.01, `speed varies by ${((hi / lo - 1) * 100).toFixed(2)} % (want under 1 %)`);
});

test('an ease that overshoots carries on along the end tangent, as a straight segment does', () => {
  const tr = parseKf('t0_ev_x0_y0_ho(100)(0)*t1000_x200_y0_hi(0)(-100)');
  // The end tangent points straight down (from the handle tip at y = -100 into the point).
  let past = false;
  for (let t = 400; t < 1000; t += 10) {
    const p = evaluateKf(tr, t);
    if (p.y! > 0.01) { past = true; assert.ok(Math.abs(p.x! - 200) < 1e-9, `overshoot stays on the tangent at ${t}`); }
  }
  assert.ok(past, 'ev carries the travel past the end of the curve');
});

test('only a segment whose ends both hold a whole position, and nothing keys x or y between, curves', () => {
  // A key between that keys only x splits x into two segments: no shared cubic.
  assert.equal(kfPathCurves(parseKf('t0_x0_y0_ho(50)(50)*t500_x10*t1000_x100_y0')).size, 0);
  // A key between that keys something else entirely is transparent.
  assert.deepEqual([...kfPathCurves(parseKf('t0_x0_y0_ho(50)(50)*t500_o0.5*t1000_x100_y0'))], [[0, 2]]);
  // A hold travels nowhere until the next key, curved or not.
  const held = parseKf('t0_eh_x0_y0_ho(50)(50)*t1000_x100_y0');
  assert.deepEqual(evaluateKf(held, 600), { x: 0, y: 0 });
});

// ── the split that keeps a curve whole ────────────────────────────────────────

test('kfSubdividePath: two halves trace the same curve at the same times', () => {
  const tr = parseKf('t0_eio_x0_y0_ho(120)(-40)*t1200_x300_y100_hi(-20)(-150)');
  const cut = 500;
  const split = kfSubdividePath(tr, cut)!;
  assert.ok(split, 'a cut inside a curved segment splits');
  const at = evaluateKf(tr, cut);
  assert.equal(split.x, at.x);
  assert.equal(split.y, at.y);
  const { left, right } = subdivideKfEase(tr[0]!.ease, cut / 1200);
  const halves: KfKeyInput[] = [
    { t: 0, ease: left, v: tr[0]!.v, ho: split.aHo },
    { t: cut, ease: right, v: { x: split.x, y: split.y }, hi: split.hi, ho: split.ho },
    { t: 1200, v: tr[1]!.v, hi: split.bHi },
  ];
  // Unquantised, so the comparison measures the geometry rather than the 0.01 px wire.
  const rebuilt = halves.map((k) => ({ t: k.t!, ease: k.ease ?? 'eio', v: k.v!, hi: k.hi as [number, number], ho: k.ho as [number, number] }));
  for (let t = 0; t <= 1200; t += 25) {
    const a = evaluateKf(tr, t), b = evaluateKf(rebuilt, t);
    assert.ok(Math.hypot(a.x! - b.x!, a.y! - b.y!) < 0.5, `within half a pixel at ${t}`);
  }
});

test('kfSubdividePath: null off a curve, on a hold, and where the ease has overshot the end', () => {
  assert.equal(kfSubdividePath(parseKf('t0_x0_y0*t1000_x100_y0'), 500), null, 'straight');
  assert.equal(kfSubdividePath(parseKf(CURVED), 0), null, 'on a keyframe, not inside');
  assert.equal(kfSubdividePath(parseKf('t0_eh_x0_y0_ho(9)(9)*t1000_x100_y0'), 500), null, 'hold');
  const ev = parseKf('t0_ev_x0_y0_ho(100)(0)*t1000_x200_y0_hi(0)(-100)');
  let t = 1;
  while (t < 1000 && !(kfEaseAt('ev', t / 1000) > 1)) t++;
  assert.equal(kfSubdividePath(ev, t + 1), null, 'past the end of the curve');
});

// ── the inverse projection ────────────────────────────────────────────────────

test('kfUnprojectCentre undoes the centre fold exactly, flat and tilted', () => {
  const flat: KfCameraView = { x: 30, y: -20, z: -200, p: 900, f: 0, a: 0, w: 1000, h: 800 };
  const tilted: KfCameraView = { ...flat, rx: -30, ry: 15 };
  for (const cam of [flat, tilted]) {
    for (const z of [0, 150, -80]) {
      const p = projectLayer(cam, { bx: 300, by: 200, dxK: 40, dyK: 10, z });
      const back = kfUnprojectCentre(cam, 300 + p.dx, 200 + p.dy, z)!;
      assert.ok(Math.abs(back.x - 340) < 1e-6 && Math.abs(back.y - 210) < 1e-6, `round trip at z ${z}: ${JSON.stringify(back)}`);
    }
  }
  // No camera at all: the default projects z = 0 at eff = 1, so the map is the identity.
  assert.deepEqual(kfUnprojectCentre({ x: 0, y: 0, z: 0, p: 1200, f: 0, a: 0, w: 640, h: 360 }, 12, 34, 0), { x: 12, y: 34 });
  // Pitched hard down, a point above the horizon has no surface point under the pointer.
  const steep: KfCameraView = { ...flat, rx: -70, ry: 0 };
  assert.equal(kfUnprojectCentre(steep, 500, -5000, 0), null);
});

// ── dotLottie ─────────────────────────────────────────────────────────────────

const layer = (kf: string): LottieSequenceLayer => ({
  name: 'Mover', x: 0, y: 0, w: 100, h: 50, rotation: 0, opacity: 1, startMs: 0, durationMs: 2000, kf, content: shape(),
});

function position(kf: string, fps = 30): LottieObject {
  const anim = compileLottieSequence({ width: 400, height: 300, fps, durationMs: 2000, layers: [layer(kf)] });
  return (anim.layers[0] as LottieObject).ks.p as LottieObject;
}

test('dotLottie: a curved track writes one position with native ti/to that a player reads back', () => {
  const kf = 't0_el_x0_y0_ho(100)(0)*t1000_es_x200_y0_hi(0)(-100)*t2000_x200_y150';
  const p = position(kf);
  assert.equal(p.s, undefined, 'one combined property, not separate axes');
  const keys = p.k as LottieObject[];
  assert.deepEqual(keys[0]!.to, [100, 0, 0]);
  assert.deepEqual(keys[0]!.ti, [0, -100, 0]);
  assert.equal(keys[1]!.to, undefined, 'the straight segment carries no tangents');
  // The engine's own reader of Lottie spatial keys (the player convention: 150 samples
  // by arc length) stays within a pixel of the editor's travel at every frame.
  const tr = parseKf(kf);
  for (let f = 0; f <= 60; f++) {
    const got = sampleLottieProperty(p, f);
    const want = evaluateKf(tr, (f * 1000) / 30);
    assert.ok(Math.hypot(got[0]! - (50 + want.x!), got[1]! - (25 + want.y!)) < 1, `frame ${f}`);
  }
});

test('dotLottie: a curved segment with an overshooting ease is written one key per frame', () => {
  const kf = 't0_ev_x0_y0_ho(100)(0)*t1000_x200_y0_hi(0)(-100)';
  const keys = position(kf).k as LottieObject[];
  assert.ok(keys.length >= 30, `baked across the segment (${keys.length} keys)`);
  assert.ok(keys.every((k) => k.to === undefined), 'players hold a curve at its ends, so no tangents');
  const tr = parseKf(kf);
  const at = keys.find((k) => k.t === 20)!;
  const want = evaluateKf(tr, (20 * 1000) / 30);
  assert.deepEqual(at.s, [50 + want.x!, 25 + want.y!, 0], 'each frame carries the editor travel');
});

test('dotLottie: a curved track must key x and y together, and says which layer', () => {
  assert.throws(() => position('t0_x0_y0_ho(50)(0)*t1000_x100_y0_hi(0)(50)*t1500_x150'), /Mover: a curved motion path/);
  // A key between that splits one axis leaves no curve at all, so the axes export apart.
  assert.equal(position('t0_x0_y0_ho(50)(0)*t500_o0.5_x40*t1000_x100_y0_hi(0)(50)').s, true);
});
