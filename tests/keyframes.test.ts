// SPDX-License-Identifier: MPL-2.0
/**
 * Golden tests for engine/src/keyframes.ts - the `kf` wire grammar, keyframe
 * evaluation, the ease adapter, and the depth-camera projection (plans/104
 * section 4, section 5, section 10).
 *
 * This module is the root dependency of the depth/flythrough feature: the DOM
 * applier, the plan/worker compositor, the timeline UI and the CLI all fold
 * these exact numbers, so everything here is a pin, not a smoke test. Where a
 * value is stated in the plan (the section 4.1 fold, the section 4.5 guard rows, K = 40, the
 * section 4.6 quanta, the eight ease presets) the test carries the plan's own number.
 *
 * Run with: node --import ./tests/css-stub.mjs --test "tests/keyframes.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KF_CHANNELS, KF_CAMERA_CHANNELS, KF_CLAMPS, KF_Z_FIELD_CLAMP, KF_QUANTA, KF_BEZIER_QUANTUM,
  KF_MAX_KEYS, KF_MAX_CHARS, KF_MAX_TIME_MS, KF_MAX_BLUR, KF_CHARSET_RE,
  KF_EASE_TOKENS, KF_EASE_PRESETS, KF_HOLD_EASE, KF_DEFAULT_EASE, KF_HOLD_CSS,
  KF_GUARD_U, KF_GUARD_BAND, KF_EFF_MAX, DOF_K, DEFAULT_CAMERA, DEFAULT_PERSPECTIVE,
  isKfChannel, isKfSafe, cubicBezierAt, normaliseKfEase, kfEasePoints, kfEaseAt,
  kfEaseCss, kfEaseName, kfEaseToken, subdivideKfEase,
  parseKf, serialiseKf, evaluateKf, kfChannelsUsed,
  projectDepth, projectLayer, dofBlur, resolveCamera,
} from '../engine/src/keyframes.ts';
import type { KfCameraView, KfTrack } from '../engine/src/keyframes.ts';

// Floating-point comparison at a tolerance far tighter than any quantum.
function near(actual: number, expected: number, msg?: string, eps = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) <= eps,
    `${msg ?? 'value'}: expected ${expected}, got ${actual}`,
  );
}

/** Deterministic PRNG - the fuzz cases must be identical on every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const STAGE = { w: 1920, h: 1080 };
const CAM0: KfCameraView = { ...DEFAULT_CAMERA, ...STAGE };

// ─── grammar: the locked token rules ─────────────────────────────────────────

test('parses the plan section 5.1 example into three keyframes', () => {
  const track = parseKf('t0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60');
  assert.equal(track.length, 3);
  assert.deepEqual(track[0], { t: 0, ease: KF_DEFAULT_EASE, v: { z: 0, b: 4 } });
  assert.deepEqual(track[1], { t: 1500, ease: 'eo', v: { z: 140, b: 0 } });
  assert.deepEqual(track[2], { t: 4000, ease: 'eh', v: { x: -60, z: 140 } });
});

test('a channel token matches the LONGEST channel whose suffix is a number (rx-8 is rx, never r + junk)', () => {
  const k = parseKf('t0_rx-8_ry20_r15')[0];
  assert.deepEqual(k?.v, { r: 15, rx: -8, ry: 20 });
  // The reverse of the same rule: `ryy2` matches no channel that way, so it is junk.
  assert.deepEqual(parseKf('t0_ryy2')[0]?.v, {});
  // A bare channel name with no number is junk too.
  assert.deepEqual(parseKf('t0_r_x_rx')[0]?.v, {});
});

test('junk tokens are skipped, never thrown - and a keyframe with no leading t<ms> is dropped whole', () => {
  const warnings: string[] = [];
  const track = parseKf('t0_x10_bogus_1234_..._q9*x10_y5*t100_y5', { onWarn: (m) => warnings.push(m) });
  assert.equal(track.length, 2);
  assert.deepEqual(track[0]?.v, { x: 10 });
  assert.deepEqual(track[1]?.v, { y: 5 });
  assert.ok(warnings.some((w) => w.includes('junk token')), 'junk is reported');
  assert.ok(warnings.some((w) => w.includes('does not start with t<ms>')), 'the headless keyframe is reported');
});

test('non-string, empty and structurally empty input parse to an empty track without throwing', () => {
  for (const bad of ['', '***', '___', '*_*', null, undefined, 42, {}, []] as unknown[]) {
    assert.deepEqual(parseKf(bad), [], String(bad));
  }
});

test('a hostile value parses to nothing and serialises to nothing (the strict-emission property)', () => {
  const hostile = '"><img src=x onerror=alert(1)>';
  assert.deepEqual(parseKf(hostile), []);
  assert.equal(serialiseKf(parseKf(hostile)), '');
  // Even when a legal keyframe carries hostile junk, only clean tokens survive.
  const mixed = serialiseKf(parseKf('t0_x10_"><img_y5'));
  assert.equal(mixed, 't0_x10_y5');
  assert.ok(isKfSafe(mixed));
});

test('later tokens win inside one keyframe, and the last key at a given t wins', () => {
  assert.deepEqual(parseKf('t0_x1_x2_eo_el')[0], { t: 0, ease: 'el', v: { x: 2 } });
  const track = parseKf('t0_x1*t0_x2*t10_x3');
  assert.equal(track.length, 2);
  assert.deepEqual(track[0]?.v, { x: 2 });
});

test('keys are sorted by time regardless of authoring order', () => {
  assert.deepEqual(parseKf('t500_x5*t0_x0*t100_x1').map((k) => k.t), [0, 100, 500]);
});

// ─── clamps, quanta, caps ────────────────────────────────────────────────────

test('every channel is clamped to its declared range', () => {
  const k = parseKf('t0_z99999_z-99999')[0];
  assert.equal(k?.v.z, KF_CLAMPS.z[0]); // the LAST token wins, then clamps
  const hi = parseKf('t0_z99999_b-5_o2_s0.0001_a5_p1_r99999_rx-999_f99999')[0];
  assert.deepEqual(hi?.v, {
    z: 12000, s: 0.01, r: 3600, rx: -180, o: 1, b: 0, f: 3000, a: 1, p: 50,
  });
});

// The wire's `z` is NOT the z field's own clamp, and the difference is the dolly.
// section 4.3: "Uniform zoom/dolly is camZ … there is deliberately no separate zoom channel",
// so a camera track's `z` is the only zoom control the feature has. Held to the field's
// 900 ceiling the whole flat-scene zoom range would be eff ∈ [1200/2100, 1200/900] =
// [0.571, 1.333] - a Ken Burns push-in past 1.33× would not be expressible at all.
test('the camera dolly is expressible: section 4.3\'s Vertigo recipe survives the wire', () => {
  // camZ = P·(1/c − 1) + z_s pins the subject plane z_s at magnification c.
  for (const [c, camZ] of [[2, -600], [1.5, -400], [3, -800]] as const) {
    assert.equal(parseKf(`t0_z${camZ}`)[0]?.v.z, camZ, `c=${c} needs camZ=${camZ}`);
    assert.equal(resolveCamera([{ base: { z: camZ } }], 0).z, camZ);
    // …and it actually magnifies by c at the pinned plane (z_s = 0 here).
    const cam: KfCameraView = { ...resolveCamera([{ base: { z: camZ } }], 0), ...STAGE };
    near(projectLayer(cam, { bx: 0, by: 0, z: 0 }).scale, c, `eff at the subject plane, c=${c}`);
  }
  // A dolly authored on a camera TRACK reaches the pose the same way (the review's probe:
  // both the base-pose path and the parse path used to clamp it to −300).
  assert.equal(resolveCamera([{ track: parseKf('t0_z-5000') }], 0).z, -5000);
  assert.deepEqual([...KF_CLAMPS.z], [-12000, 12000], 'a few multiples of any usable P');
  // The per-box FIELD keeps its own section 5.3 / section 12 Q1 clamp - a different number, a different
  // job, applied where that field is read (the hooks\' data-t-z, the manifest min/max).
  assert.deepEqual([...KF_Z_FIELD_CLAMP], [-300, 900]);
});

test('values are quantised at the section 4.6 quanta on the way IN, which is what makes the round-trip law hold', () => {
  const k = parseKf('t10.6_x1.23456_y-1.23456_s1.23456_o0.98765_r45.678_p1199.999')[0];
  assert.equal(k?.t, 11);                 // t: integer ms
  assert.equal(k?.v.x, 1.23);             // px: 0.01
  assert.equal(k?.v.y, -1.23);
  assert.equal(k?.v.s, 1.235);            // unit-ish: 0.001
  assert.equal(k?.v.o, 0.988);
  assert.equal(k?.v.r, 45.68);            // deg: 0.01
  assert.equal(k?.v.p, 1200);
  assert.equal(KF_QUANTA.x, 0.01);
  assert.equal(KF_QUANTA.s, 0.001);
  assert.equal(KF_BEZIER_QUANTUM, 0.001);
});

test('t is clamped to KF_MAX_TIME_MS and never negative', () => {
  assert.equal(parseKf('t99999999_x1')[0]?.t, KF_MAX_TIME_MS);
  assert.equal(parseKf('t-500_x1')[0]?.t, 0);
  assert.equal(KF_MAX_TIME_MS, 3_600_000);
});

test('parse caps: KF_MAX_KEYS keyframes and KF_MAX_CHARS chars, both reported through onWarn', () => {
  const many = Array.from({ length: 400 }, (_, i) => `t${i * 10}_x${i}`).join('*');
  const warnings: string[] = [];
  const track = parseKf(many, { onWarn: (m) => warnings.push(m) });
  assert.equal(track.length, KF_MAX_KEYS);
  assert.equal(track[KF_MAX_KEYS - 1]?.t, (KF_MAX_KEYS - 1) * 10);
  assert.ok(warnings.some((w) => w.includes(String(KF_MAX_KEYS))));

  const long = `t0_x1*${'y'.repeat(KF_MAX_CHARS)}*t500_x2`;
  const w2: string[] = [];
  const capped = parseKf(long, { onWarn: (m) => w2.push(m) });
  assert.equal(capped.length, 1, 'everything past the char cap is ignored');
  assert.ok(w2.some((w) => w.includes(String(KF_MAX_CHARS))));
});

// The two caps have to be mutually SATISFIABLE, or the module emits a wire it then
// mangles: at 8 KB (the number the plan carried before anyone measured a full-pose
// track) a 256-key camera track serialised to 15 759 chars and re-parsed to 134 keys - 
// 122 keyframes lost, silently, with the section 4.6 round-trip law false above the cap.
// So the char cap is DERIVED from the key cap, and this is the derivation. Widen a
// clamp or add a channel and this test tells you to re-derive KF_MAX_CHARS.
test('the char cap DOMINATES the key cap: a full-density track always fits', () => {
  // The widest wire form of one keyframe, re-derived from the tables rather than quoted:
  // `t` at its cap + the widest custom bezier + every channel at the longest spelling its
  // clamp and quantum allow + one separator per token.
  let channelChars = 0;
  for (const ch of KF_CHANNELS) {
    const [lo, hi] = KF_CLAMPS[ch];
    const q = KF_QUANTA[ch];
    let widest = 0;
    for (const bound of [lo, hi]) {
      for (const d of [0, q, -q]) {
        const v = Math.round((bound + d) / q) * q;
        if (v < lo || v > hi) continue;
        widest = Math.max(widest, `${ch}${Number(v.toFixed(6))}`.length);
      }
    }
    channelChars += widest;
  }
  const widestEase = 'eb(0.999)(-9.999)(0.999)(-9.999)'.length; // x∈[0,1], y∈±10, q=0.001
  const widestKey = `t${KF_MAX_TIME_MS}`.length + 1 + widestEase + channelChars + KF_CHANNELS.length;
  const fullDensity = KF_MAX_KEYS * widestKey + (KF_MAX_KEYS - 1);
  assert.ok(
    fullDensity <= KF_MAX_CHARS,
    `KF_MAX_KEYS × ${widestKey} + separators = ${fullDensity} must fit KF_MAX_CHARS = ${KF_MAX_CHARS}`,
  );
  // The two numbers KF_MAX_CHARS's own docblock PRINTS. A cap whose whole claim is
  // "derived, not picked" has to have a derivation that reproduces, so the prose is
  // pinned here rather than left to be read: change a clamp, a quantum or the channel
  // list and this fails beside the headroom assertion above, naming both figures.
  assert.equal(widestKey, 174, 'the widest single keyframe, as the docblock states it');
  assert.equal(fullDensity, 44_799, 'a full-density 256-key track, as the docblock states it');

  // …and empirically, on the worst track the grammar can express.
  const worst = Array.from({ length: KF_MAX_KEYS }, (_v, i) => ({
    t: KF_MAX_TIME_MS - (KF_MAX_KEYS - 1 - i),
    ease: 'eb(0.999)(-9.999)(0.999)(-9.999)',
    v: Object.fromEntries(KF_CHANNELS.map((ch) => [ch, KF_CLAMPS[ch][0] + KF_QUANTA[ch]])),
  }));
  const wire = serialiseKf(worst);
  assert.ok(wire.length <= KF_MAX_CHARS, `worst serialised track is ${wire.length} chars`);
  assert.equal(parseKf(wire).length, KF_MAX_KEYS, 'and it re-parses whole - no key is lost');
  assert.deepEqual(parseKf(serialiseKf(parseKf(wire))), parseKf(wire), 'the law holds at full density');
});

// ─── round-trip + charset ────────────────────────────────────────────────────

const ROUND_TRIP_CASES = [
  '',
  't0_x0',
  't0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60',
  't0_el_x-12.5_y40_s1.2_r15_z140_rx-8_ry20_o0.8_b2.5',
  't0_eb(0.32)(0)(0.67)(1)_x0*t900_x100',
  't0_ek_a0.5_f200_p800*t3500_eo_a0_p1200',
  't0_x1.23456*t10.6_x-9999999*t99999999_z9999',
  't500_x5*t0_x0*t0_x9*junk*t100_bogus_y5',
  // MAX DENSITY - the case the law used to fail on. section 8's UI writes full poses, so a
  // 256-key content track is an ordinary artefact, not a fuzz artefact: at the old 8 KB
  // char cap this one re-parsed to 134 of its 256 keyframes.
  Array.from({ length: KF_MAX_KEYS }, (_v, i) =>
    `t${i * 100}_x${i}.5_y-${i}.25_z${i}_s1.${i}_r${i}_o0.${i}_b${i % 300}`).join('*'),
];

test('round-trip law: parse(serialise(parse(s))) deep-equals parse(s)', () => {
  for (const s of ROUND_TRIP_CASES) {
    const once = parseKf(s);
    const twice = parseKf(serialiseKf(once));
    assert.deepEqual(twice, once, s);
    // …and the wire itself is idempotent, which is what the hooks re-emit.
    assert.equal(serialiseKf(twice), serialiseKf(once), s);
  }
});

test('serialise omits the default ease and keeps every other one', () => {
  assert.equal(serialiseKf(parseKf('t0_eio_x1')), 't0_x1');
  assert.equal(serialiseKf(parseKf('t0_x1')), 't0_x1');
  assert.equal(serialiseKf(parseKf('t0_eh_x1')), 't0_eh_x1');
  assert.equal(serialiseKf(parseKf('t0_eb(0.32)(0)(0.67)(1)_x1')), 't0_eb(0.32)(0)(0.67)(1)_x1');
  // Channels serialise in the canonical order, not the authored order.
  assert.equal(serialiseKf(parseKf('t0_b1_o1_x1_z1')), 't0_x1_z1_o1_b1');
});

test('charset property: a serialised track is always [A-Za-z0-9._*()-], never ~ or ,', () => {
  const rnd = lcg(0x104);
  const alphabet = 'txyzsrba().-_*eiovkh0123456789~,<>"\'&%{$} \n\\/|+=?#@';
  const cases: string[] = [...ROUND_TRIP_CASES];
  for (let i = 0; i < 500; i++) {
    let s = '';
    const len = 1 + Math.floor(rnd() * 60);
    for (let j = 0; j < len; j++) s += alphabet[Math.floor(rnd() * alphabet.length)];
    cases.push(s);
  }
  for (const s of cases) {
    const out = serialiseKf(parseKf(s)); // never throws, whatever went in
    assert.ok(KF_CHARSET_RE.test(out), `charset violated by ${JSON.stringify(s)} → ${JSON.stringify(out)}`);
    assert.ok(!out.includes('~') && !out.includes(','), out);
    assert.ok(isKfSafe(out));
    // And the law survives the fuzz.
    assert.deepEqual(parseKf(out), parseKf(s), s);
  }
});

test('a parsed track is plain data - it survives structuredClone (the worker wire)', () => {
  const track = parseKf('t0_z0_b4*t1500_eo_z140_b0');
  const clone = structuredClone(track) as KfTrack;
  assert.deepEqual(clone, track);
  // The clone evaluates identically: nothing compiled is cached inside the data.
  assert.deepEqual(evaluateKf(clone, 750), evaluateKf(track, 750));
});

test('serialiseKf accepts a hand-built track and normalises it (what the rebase writes)', () => {
  assert.equal(serialiseKf([{ t: 1500.4, v: { x: 1.23456 } }, { t: 0, ease: 'ease-out' as string, v: { x: 0 } }]),
    't0_x0*t1500_x1.23');
  assert.equal(serialiseKf([]), '');
  assert.equal(serialiseKf(null), '');
  // An unusable ease falls back to the grammar default rather than reaching the wire.
  assert.equal(serialiseKf([{ t: 0, ease: 'wobble', v: { x: 0 } }]), 't0_x0');
});

// ─── easing: the eight presets + the bidirectional adapter ───────────────────

test('all eight preset tokens exist with the documented curves', () => {
  assert.deepEqual([...KF_EASE_TOKENS], ['el', 'ei', 'eo', 'eio', 'ev', 'ea', 'es', 'ek']);
  assert.deepEqual([...KF_EASE_PRESETS.el.pts], [0, 0, 1, 1]);
  assert.deepEqual([...KF_EASE_PRESETS.es.pts], [0.4, 0, 0.2, 1], 'smooth = cubic-bezier(0.4,0,0.2,1)');
  assert.deepEqual([...KF_EASE_PRESETS.ek.pts], [0.4, 0, 0.6, 1], 'snappy = Material sharp');
  // The first six must stay byte-identical to the shell's transition curves.
  assert.deepEqual([...KF_EASE_PRESETS.eo.pts], [0.33, 1, 0.68, 1]);
  assert.deepEqual([...KF_EASE_PRESETS.ei.pts], [0.32, 0, 0.67, 0]);
  assert.deepEqual([...KF_EASE_PRESETS.eio.pts], [0.65, 0, 0.35, 1]);
  assert.deepEqual([...KF_EASE_PRESETS.ev.pts], [0.34, 1.56, 0.64, 1]);
  assert.deepEqual([...KF_EASE_PRESETS.ea.pts], [0.36, -0.4, 0.66, 1]);
});

test('ease adapter round-trips all eight presets in both directions, by name', () => {
  for (const tok of KF_EASE_TOKENS) {
    const css = kfEaseCss(tok);
    const pts = KF_EASE_PRESETS[tok].pts;
    assert.equal(css, `cubic-bezier(${pts.join(',')})`, tok);
    assert.equal(kfEaseToken(css), tok, `${tok} → css → token`);
    assert.equal(kfEaseName(tok), KF_EASE_PRESETS[tok].name, tok);
    assert.equal(kfEaseToken(KF_EASE_PRESETS[tok].name), tok, 'the shell preset NAME also maps back');
    assert.equal(kfEaseToken(tok), tok, 'a token is idempotent through the adapter');
    assert.deepEqual(kfEasePoints(tok), [...pts]);
  }
});

test('ease adapter round-trips a custom bezier in both directions', () => {
  assert.equal(kfEaseToken('cubic-bezier(0.32, 0, 0.67, 1)'), 'eb(0.32)(0)(0.67)(1)');
  assert.equal(kfEaseCss('eb(0.32)(0)(0.67)(1)'), 'cubic-bezier(0.32,0,0.67,1)');
  assert.equal(kfEaseToken(kfEaseCss('eb(0.32)(0)(0.67)(1)')), 'eb(0.32)(0)(0.67)(1)');
  assert.equal(kfEaseName('eb(0.32)(0)(0.67)(1)'), '', 'a custom curve has no preset name');
  // A custom bezier that IS a preset normalises to the preset token.
  assert.equal(normaliseKfEase('eb(0)(0)(1)(1)'), 'el');
  assert.equal(kfEaseToken('cubic-bezier(0.4,0,0.2,1)'), 'es');
  // Bezier x is time and clamps to the unit interval; y stays free (overshoot).
  assert.equal(kfEaseToken('cubic-bezier(-2,-3,9,4)'), 'eb(0)(-3)(1)(4)');
  assert.equal(kfEaseToken('cubic-bezier(0.1234,0,0.5,1)'), 'eb(0.123)(0)(0.5)(1)');
});

test('hold and unrecognised input have defined adapter behaviour', () => {
  assert.equal(kfEaseCss(KF_HOLD_EASE), KF_HOLD_CSS);
  assert.equal(kfEaseToken(KF_HOLD_CSS), KF_HOLD_EASE);
  assert.equal(kfEaseToken(KF_HOLD_EASE), KF_HOLD_EASE);
  assert.equal(kfEasePoints(KF_HOLD_EASE), null);
  assert.equal(kfEaseName(KF_HOLD_EASE), '');
  for (const junk of ['', 'wobble', 'cubic-bezier(1,2)', 'steps(3)', null, 7, {}] as unknown[]) {
    assert.equal(kfEaseToken(junk), KF_DEFAULT_EASE, String(junk));
    assert.equal(normaliseKfEase(junk), null, String(junk));
  }
  assert.equal(kfEaseCss('wobble'), kfEaseCss(KF_DEFAULT_EASE), 'unknown falls back to the default curve');
});

test('cubicBezierAt: endpoints, the linear identity, and an overshoot above 1', () => {
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, 0), 0);
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, 1), 1);
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, -5), 0, 'x is clamped low');
  assert.equal(cubicBezierAt(0.33, 1, 0.68, 1, 5), 1, 'x is clamped high');
  for (const x of [0.1, 0.25, 0.5, 0.75, 0.9]) near(cubicBezierAt(0, 0, 1, 1, x), x, `linear at ${x}`, 1e-5);
  assert.ok(cubicBezierAt(0.34, 1.56, 0.64, 1, 0.5) > 1, 'overshoot passes its resting value');
  assert.ok(cubicBezierAt(0.36, -0.4, 0.66, 1, 0.2) < 0, 'anticipate pulls away first');
  // eased progress: hold is 0 until the segment ends.
  assert.equal(kfEaseAt(KF_HOLD_EASE, 0.999), 0);
  assert.equal(kfEaseAt(KF_HOLD_EASE, 1), 1);
  assert.equal(kfEaseAt('el', 0), 0);
});

// ─── segment subdivision (the section 5.6 rebase's ease half) ───────────────────────

/**
 * The defining property, straight off `subdivideKfEase`'s own doc block: a
 * segment cut at the time fraction λ is reproduced by its two halves.
 *
 *   left:   E(u·λ)                    === E_L(u) · E(λ)
 *   right:  E(λ + (1 − λ)·u)          === E(λ) + E_R(u) · (1 − E(λ))
 *
 * Checked as VALUES, which is what a rebased track actually replays - the
 * control points are an implementation detail, and only the composed progress
 * has to survive the 0.001 quantisation.
 */
function assertSubdivides(ease: string, lam: number, tol = 3e-3): void {
  const { left, right } = subdivideKfEase(ease, lam);
  const eLam = kfEaseAt(ease, lam);
  for (const u of [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.9, 1]) {
    near(kfEaseAt(left, u) * eLam, kfEaseAt(ease, u * lam), `${ease}@${lam} left u=${u}`, tol);
    near(
      eLam + kfEaseAt(right, u) * (1 - eLam),
      kfEaseAt(ease, lam + (1 - lam) * u),
      `${ease}@${lam} right u=${u}`,
      tol,
    );
  }
}

test('subdivideKfEase reproduces the original curve on both sides of the cut', () => {
  // The six monotone presets are exact to the quantum at every cut.
  for (const tok of ['el', 'ei', 'eo', 'eio', 'es', 'ek']) {
    for (const lam of [0.1, 0.25, 0.5, 0.618, 0.9]) assertSubdivides(tok, lam);
  }
  // …and so is a custom curve.
  assertSubdivides('eb(0.2)(0.9)(0.8)(0.1)', 0.37);
});

test('subdivideKfEase: the overshoot family too, away from its own self-crossings', () => {
  // Both overshoot curves cross their OWN endpoint value in flight - `ev` reaches
  // E = 1 at λ ≈ 0.369, `ea` returns to E = 0 at λ ≈ 0.274 - and around each
  // crossing the halves' endpoints coincide, which no easing vocabulary can
  // express (see the band test below). Away from those bands both are exact.
  for (const lam of [0.2, 0.5, 0.8]) assertSubdivides('ev', lam, 5e-3);
  for (const lam of [0.15, 0.7, 0.9]) assertSubdivides('ea', lam, 5e-3);
});

test('subdivideKfEase: near a self-crossing it NEVER emits a clamped, wrong-motion curve', () => {
  // THE DEFECT. `easeFromPoints` clamps a control y to ±10, which is right for an
  // author typing a wild bezier and catastrophic for a renormalised half: a half whose
  // control y works out at −40 came back spelled −10, i.e. a completely different
  // motion, silently. `ev` at λ = 0.37 was the measured case. The fix is not to make
  // the band exact - a segment whose two endpoint VALUES are equal cannot carry an
  // excursion in ANY easing vocabulary - but to detect the clamp and keep the original
  // token, which is the documented approximation.
  //
  // Swept densely across both bands: every token that comes back must be one this
  // module can hand straight to the wire AND must reproduce the segment at least as
  // well as the fallback does.
  for (const tok of ['ev', 'ea']) {
    for (let i = 0; i <= 400; i++) {
      const lam = 0.2 + (i / 400) * 0.3;             // covers λ ≈ 0.274 and λ ≈ 0.369
      const { left, right } = subdivideKfEase(tok, lam);
      for (const half of [left, right]) {
        assert.ok(KF_CHARSET_RE.test(half), `${tok}@${lam} → ${half}`);
        assert.equal(normaliseKfEase(half), half, `${tok}@${lam} → ${half} is canonical`);
        const pts = kfEasePoints(half);
        if (!pts) continue;
        // The clamp is the tell: a control point sitting exactly on ±10 is a value
        // that was truncated to fit, not a curve anybody computed.
        assert.ok(Math.abs(pts[1]) < 10 && Math.abs(pts[3]) < 10,
          `${tok}@${lam} → ${half} carries a clamped control point`);
      }
    }
  }
  // And the residual is stated rather than claimed away: inside the band the halves
  // are an approximation, bounded by the excursion the coinciding endpoints cannot
  // carry - up to ~0.10 in E, falling to 0 at each edge.
  const err = (tok: string, lam: number): number => {
    const { right } = subdivideKfEase(tok, lam);
    const eLam = kfEaseAt(tok, lam);
    let worst = 0;
    for (let u = 0; u <= 1; u += 0.02) {
      const got = eLam + kfEaseAt(right, u) * (1 - eLam);
      worst = Math.max(worst, Math.abs(got - kfEaseAt(tok, lam + (1 - lam) * u)));
    }
    return worst;
  };
  assert.ok(err('ev', 0.37) > 0.02, 'the band really is approximate (the vacuity guard)');
  assert.ok(err('ev', 0.37) < 0.12, 'and bounded where the doc block says it is');
  assert.ok(err('ev', 0.25) < 5e-3, 'outside the band it is exact again');
});

test('subdivideKfEase: linear stays linear, and a preset half comes back BY NAME', () => {
  assert.deepEqual(subdivideKfEase('el', 0.5), { left: 'el', right: 'el' });
  assert.deepEqual(subdivideKfEase('el', 0.137), { left: 'el', right: 'el' });
  for (const lam of [0.25, 0.5, 0.75]) {
    const { left, right } = subdivideKfEase('eio', lam);
    // Charset-clean and re-parseable - these tokens are spliced straight into a
    // track by the rebase, so they must survive the wire unchanged.
    for (const tok of [left, right]) {
      assert.ok(KF_CHARSET_RE.test(tok), tok);
      assert.equal(normaliseKfEase(tok), tok, `${tok} is already canonical`);
    }
  }
});

test('subdivideKfEase: the inexpressible cases keep the original token, and say so', () => {
  // hold has no bezier to split.
  assert.deepEqual(subdivideKfEase(KF_HOLD_EASE, 0.5), { left: KF_HOLD_EASE, right: KF_HOLD_EASE });
  // A cut outside the segment is not a cut.
  for (const lam of [0, 1, -0.5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(subdivideKfEase('eo', lam), { left: 'eo', right: 'eo' }, String(lam));
  }
  // Junk resolves to the default curve rather than throwing.
  assert.deepEqual(subdivideKfEase('wobble', 0.5), subdivideKfEase(KF_DEFAULT_EASE, 0.5));
  assert.deepEqual(subdivideKfEase(null, 0.5), subdivideKfEase(KF_DEFAULT_EASE, 0.5));
  // `ea` passes back through its own start value; at that λ the first half's two
  // endpoints coincide, so no curve can express it and the original is kept.
  let cross = 0.5;
  for (let lo = 0.2, hi = 0.6, i = 0; i < 60; i++) {
    cross = (lo + hi) / 2;
    if (kfEaseAt('ea', cross) < 0) lo = cross; else hi = cross;
  }
  assert.ok(Math.abs(kfEaseAt('ea', cross)) < 1e-6, 'found the zero crossing');
  assert.equal(subdivideKfEase('ea', cross).left, 'ea', 'left keeps the original at the crossing');
});

test('subdivideKfEase: subdivision is NOT a no-op (the vacuity guard)', () => {
  // If the halves just echoed the input, the property above would hold for a
  // linear curve and nothing else. An asymmetric cut on a strongly-eased curve
  // must move both control nets.
  const { left, right } = subdivideKfEase('eo', 0.25);
  assert.notEqual(left, 'eo');
  assert.notEqual(right, 'eo');
  // And keeping the original ease (the naive rebase) would visibly miss.
  const lam = 0.25;
  const eLam = kfEaseAt('eo', lam);
  const naive = Math.abs(kfEaseAt('eo', 0.5) * eLam - kfEaseAt('eo', 0.5 * lam));
  const exact = Math.abs(kfEaseAt(left, 0.5) * eLam - kfEaseAt('eo', 0.5 * lam));
  assert.ok(naive > 0.05, `the naive rebase is off by ${naive}`);
  assert.ok(exact < naive / 20, `the subdivision is off by only ${exact}`);
});

// ─── evaluation ──────────────────────────────────────────────────────────────

test('linear segment, clamp-hold outside the authored range', () => {
  const track = parseKf('t0_el_x0*t1000_x100');
  near(evaluateKf(track, 500).x ?? NaN, 50, 'midpoint');
  near(evaluateKf(track, -5000).x ?? NaN, 0, 'before the first key');
  near(evaluateKf(track, 999999).x ?? NaN, 100, 'after the last key');
  near(evaluateKf(track, 0).x ?? NaN, 0);
  near(evaluateKf(track, 1000).x ?? NaN, 100);
});

test('a channel the track never mentions is ABSENT, not zero', () => {
  const pose = evaluateKf(parseKf('t0_x0*t1000_x100'), 500);
  assert.ok(Object.hasOwn(pose, 'x'));
  assert.ok(!Object.hasOwn(pose, 'y'));
  assert.deepEqual(kfChannelsUsed(parseKf('t0_b1_x1*t9_z2')), ['x', 'z', 'b']);
  assert.deepEqual(kfChannelsUsed(parseKf('')), []);
  assert.deepEqual(evaluateKf(null, 0), {});
  // The channels argument restricts the work without changing the numbers.
  assert.deepEqual(evaluateKf(parseKf('t0_x0_y0*t100_x10_y20'), 50, ['y']), { y: 10 });
});

test('sparse channels: x spans a diamond that never mentions it, on the earlier MENTIONING key’s ease', () => {
  // The t500 diamond touches only `o`; x interpolates 0→100 straight across it.
  const track = parseKf('t0_el_x0_o1*t500_eo_o0.5*t1000_x100');
  const mid = evaluateKf(track, 500);
  near(mid.x ?? NaN, 50, 'x crosses the unmentioning diamond linearly');
  near(mid.o ?? NaN, 0.5);
  near(evaluateKf(track, 250).x ?? NaN, 25, 'quarter way', 1e-5);
  // Swap the ease onto the crossing key: the ease that governs x's segment is
  // the EARLIER MENTIONING key's (t0), not the diamond's.
  const held = parseKf('t0_eh_x0_o1*t500_el_o0.5*t1000_x100');
  near(evaluateKf(held, 999).x ?? NaN, 0, 'hold on the mentioning key holds across the diamond');
  near(evaluateKf(held, 1000).x ?? NaN, 100);
});

test('hold (eh) freezes a channel until the next keyframe', () => {
  const track = parseKf('t0_eh_x0*t1000_x100');
  near(evaluateKf(track, 999.9).x ?? NaN, 0);
  near(evaluateKf(track, 1000).x ?? NaN, 100);
});

test('the segment ease governs every channel EXCEPT o, which is always linear', () => {
  const track = parseKf('t0_ei_o0_x0_b0*t1000_o1_x100_b10');
  const mid = evaluateKf(track, 500);
  assert.equal(mid.o, 0.5, 'o ignores the ease entirely');
  assert.ok(Math.abs((mid.x ?? NaN) - 50) > 1, 'x follows ease-in');
  near(mid.b ?? NaN, (mid.x ?? NaN) / 10, 'b follows the segment ease like every other channel');
  // eh still holds o, like any channel.
  const holdO = parseKf('t0_eh_o0*t1000_o1');
  assert.equal(evaluateKf(holdO, 500).o, 0);
});

test('two keys at the same time do not divide by zero', () => {
  // Distinct channels at one instant survive dedupe via the last-wins rule.
  const track = parseKf('t0_x0*t1000_x50*t1000_x100');
  assert.equal(track.length, 2);
  near(evaluateKf(track, 1000).x ?? NaN, 100);
});

// ─── the projection fold (section 4.1) ──────────────────────────────────────────────

test('the DEFAULT camera is a no-op on a z = 0 layer - every existing document is byte-identical', () => {
  assert.deepEqual({ ...DEFAULT_CAMERA }, { x: 0, y: 0, z: 0, p: DEFAULT_PERSPECTIVE, f: 0, a: 0 });
  assert.equal(DEFAULT_PERSPECTIVE, 1200);
  for (const [bx, by] of [[0, 0], [100, 200], [1920, 1080], [-40, 4000]] as const) {
    const pr = projectLayer(CAM0, { bx, by, z: 0 });
    // `m: null` is P2's additive field: the screen-parallel tier hands back no
    // homography at all, which is what keeps every pre-tilt document on the exact path
    // it was always on (plans/104 section 6.4, engine 1.121).
    assert.deepEqual(pr, { dx: 0, dy: 0, scale: 1, alphaGuard: 1, m: null }, `${bx},${by}`);
  }
});

test('golden fold table: cx′ = W/2 + (cx − camX − W/2)·eff, per axis', () => {
  const rows: Array<{ cam: Partial<KfCameraView>; bx: number; by: number; z: number; dx: number; dy: number; eff: number }> = [
    // A lifted layer at the stage centre does not move; one off-centre spreads outward.
    { cam: {}, bx: 960, by: 540, z: 240, dx: 0, dy: 0, eff: 1.25 },
    { cam: {}, bx: 460, by: 540, z: 240, dx: -125, dy: 0, eff: 1.25 },
    { cam: {}, bx: 960, by: 340, z: 240, dx: 0, dy: -50, eff: 1.25 },
    // A sunken layer contracts toward the centre.
    { cam: {}, bx: 460, by: 540, z: -300, dx: 100, dy: 0, eff: 0.8 },
    // Pan: at z = 0 the shift is exactly the camera's; a lifted layer parallaxes further.
    { cam: { x: 200 }, bx: 960, by: 540, z: 0, dx: -200, dy: 0, eff: 1 },
    { cam: { x: 200 }, bx: 960, by: 540, z: 240, dx: -250, dy: 0, eff: 1.25 },
    { cam: { y: -120 }, bx: 960, by: 540, z: 240, dx: 0, dy: 150, eff: 1.25 },
    // Dolly: raising camZ pushes the scene away (eff < 1) - the section 4.1 sign convention.
    { cam: { z: 300 }, bx: 460, by: 540, z: 0, dx: 100, dy: 0, eff: 0.8 },
    { cam: { z: -240 }, bx: 460, by: 540, z: 0, dx: -125, dy: 0, eff: 1.25 },
  ];
  for (const r of rows) {
    const cam: KfCameraView = { ...CAM0, ...r.cam };
    const pr = projectLayer(cam, { bx: r.bx, by: r.by, z: r.z });
    near(pr.scale, r.eff, `eff @ z=${r.z}`);
    near(pr.dx, r.dx, `dx @ ${JSON.stringify(r)}`, 1e-9);
    near(pr.dy, r.dy, `dy @ ${JSON.stringify(r)}`, 1e-9);
    assert.equal(pr.alphaGuard, 1);
  }
});

test('transition × camera: the offsets are INSIDE the projection, so they scale by eff', () => {
  const cam: KfCameraView = { ...CAM0 };
  // A slide-enter offset of 100px on a layer at z = 240 (eff 1.25) must land 125px
  // out, not 100 - the naive fold (camera displacement added to an unscaled offset)
  // makes the enter land short on a lifted layer.
  const lifted = projectLayer(cam, { bx: 960, by: 540, dxT: 100, z: 240 });
  near(lifted.dx, 125, 'transition offset scales by eff');
  const flat = projectLayer(cam, { bx: 960, by: 540, dxT: 100, z: 0 });
  near(flat.dx, 100, 'at z = 0 the same offset is untouched');
  // Transition and keyframe offsets fold identically and are additive.
  const split = projectLayer(cam, { bx: 960, by: 540, dxT: 60, dxK: 40, z: 240 });
  near(split.dx, 125);
  // …and it composes with a pan: (cx − camX − W/2)·eff.
  const panned = projectLayer({ ...cam, x: 200 }, { bx: 960, by: 540, dxT: 100, z: 240 });
  near(panned.dx, 125 - 250);
  // dy takes the same path through H.
  near(projectLayer(cam, { bx: 960, by: 540, dyT: 80, z: 240 }).dy, 100);
});

test('guard band (section 4.5): eff freezes at 10 while alpha ramps linearly over u ∈ [0.8, 0.9]', () => {
  assert.equal(KF_GUARD_U, 0.9);
  assert.equal(KF_GUARD_BAND, 0.1);
  assert.equal(KF_EFF_MAX, 10);
  const rows: Array<[u: number, eff: number, alpha: number]> = [
    [0, 1, 1],
    [0.5, 2, 1],
    [0.8, 5, 1],
    [0.85, 1 / 0.15, 0.5],
    [0.9, 10, 0],
    [0.95, 10, 0],
    [5, 10, 0],
    [-1, 0.5, 1],
  ];
  for (const [u, eff, alpha] of rows) {
    const z = u * DEFAULT_PERSPECTIVE; // camZ = 0, P = 1200
    const d = projectDepth(CAM0, z);
    near(d.u, u, `u @ ${u}`);
    near(d.eff, eff, `eff @ u=${u}`);
    near(d.alphaGuard, alpha, `alphaGuard @ u=${u}`);
    // The same numbers reach the caller through projectLayer.
    const pr = projectLayer(CAM0, { bx: 0, by: 0, z });
    near(pr.scale, eff);
    near(pr.alphaGuard, alpha);
  }
  // The guard reads the DISTANCE, so a dolly moves it: the same layer that is
  // safe under camZ = 0 is past the pole once the camera rises past it.
  near(projectDepth({ z: -1080, p: 1200 }, 0).alphaGuard, 0);
});

// KF_EFF_MAX is a DECLARED maximum: section 5.5's plate-resolution buckets and the λ budget are
// both computed from maxEff, and section 4.5 calls eff_max part of the byte-stable contract. So
// the number the function returns at the clamp has to BE it - `1/(1 − 0.9)` is
// 10.000000000000002 in IEEE-754, which is above the maximum it is documented as.
test('KF_EFF_MAX is exactly what projectDepth returns at and beyond the guard', () => {
  for (const p of [50, 200, 600, 1080, 1200, 5000, 12000]) {
    for (const camZ of [0, 137, -250, 900]) {
      for (const past of [0, 1, 100, 1e6]) {
        const z = camZ + KF_GUARD_U * p + past;
        const { eff } = projectDepth({ z: camZ, p }, z);
        assert.equal(eff, KF_EFF_MAX, `p=${p} camZ=${camZ} past=${past}`);
        assert.ok(eff <= KF_EFF_MAX, 'the declared maximum is a real bound');
      }
    }
  }
  // Below the guard it is strictly under the cap, so nothing was flattened to reach it.
  assert.ok(projectDepth({ z: 0, p: 1200 }, 0.89 * 1200).eff < KF_EFF_MAX);
});

test('p is perspective strength (FOV), never magnification: eff(z = camZ) === 1 for every p', () => {
  for (const p of [50, 200, 600, 1200, 5000, 12000]) {
    for (const camZ of [0, 137, -250, 900]) {
      assert.equal(projectDepth({ z: camZ, p }, camZ).eff, 1, `p=${p} camZ=${camZ}`);
    }
  }
  // On a FLAT scene, p is a no-op - which is exactly why the not-a-no-op
  // companion below has to use two distinct z values (section 4.3).
  const flat = { bx: 460, by: 200, z: 0 };
  const a = projectLayer({ ...CAM0, p: 300 }, flat);
  const b = projectLayer({ ...CAM0, p: 9000 }, flat);
  assert.deepEqual(a, b);
  assert.equal(a.scale, 1);
});

test('p is NOT a no-op on a scene with two distinct z values (the companion golden)', () => {
  const near0 = { bx: 460, by: 200, z: 0 };
  const lifted = { bx: 460, by: 200, z: 200 };
  const wide = { ...CAM0, p: 600 };   // short focal length = strong perspective
  const flatish = { ...CAM0, p: 4800 };
  // The z = 0 layer is unmoved by p; the lifted one separates from it.
  assert.equal(projectLayer(wide, near0).scale, projectLayer(flatish, near0).scale);
  near(projectLayer(wide, lifted).scale, 600 / 400);      // 1.5
  near(projectLayer(flatish, lifted).scale, 4800 / 4600); // ≈1.043
  assert.ok(projectLayer(wide, lifted).dx !== projectLayer(flatish, lifted).dx);
  // A non-positive or absent p can never reach the divide.
  assert.equal(projectDepth({ z: 0, p: 0 }, 0).eff, 1);
  assert.equal(projectDepth({ z: 0, p: Number.NaN }, 600).eff, projectDepth({ z: 0, p: DEFAULT_PERSPECTIVE }, 600).eff);
});

// ─── depth of field (section 4.4) ───────────────────────────────────────────────────

test('DOF golden table pins K = 40 and the eff(z)·eff(f) factor', () => {
  assert.equal(DOF_K, 40);
  const cam = { z: 0, p: 1200, f: 0, a: 1 };
  // blur = a·K·|z − f|·eff(z)·eff(f)/P
  near(dofBlur(cam, 0), 0, 'a layer in the focal plane is sharp');
  near(dofBlur(cam, 240), (40 * 240 * 1.25 * 1) / 1200, 'z = 240');   // 10
  near(dofBlur(cam, 240), 10);
  near(dofBlur({ ...cam, a: 0.5 }, 240), 5, 'aperture scales linearly');
  near(dofBlur({ ...cam, a: 0 }, 240), 0, 'a = 0 is everything sharp');
  near(dofBlur({ ...cam, f: 240 }, 0), (40 * 240 * 1 * 1.25) / 1200, 'the factor is symmetric in z and f');
  // The correction itself: without eff(z)·eff(f) this row would read 8.
  assert.notEqual(dofBlur(cam, 240), (40 * 240) / 1200);
  // Sunken layers defocus too.
  near(dofBlur(cam, -300), (40 * 300 * (1200 / 1500) * 1) / 1200);
  // Runaway is capped at the b channel's own ceiling.
  // Raw 40·1080·10·1/1200 = 360 at the guard clamp; the cap holds it at 300.
  assert.equal(dofBlur({ z: 0, p: 1200, f: 0, a: 1 }, 1080), KF_MAX_BLUR);
  assert.equal(KF_MAX_BLUR, KF_CLAMPS.b[1]);
});

test('blur GROWS as the camera approaches an out-of-focus layer (the v1 formula got this backwards)', () => {
  const z = 200, f = 0;
  let prevBlur = -Infinity;
  let prevDist = Infinity;
  for (const camZ of [0, -100, -200, -300, -400]) {
    const cam = { z: camZ, p: 1200, f, a: 1 };
    const dist = 1200 - (z - camZ);        // camera → layer distance
    const blur = dofBlur(cam, z);
    assert.ok(dist < prevDist, `distance shrinks @ camZ=${camZ}`);
    assert.ok(blur > prevBlur, `blur grows @ camZ=${camZ}: ${blur} vs ${prevBlur}`);
    prevDist = dist;
    prevBlur = blur;
  }
  near(dofBlur({ z: 0, p: 1200, f: 0, a: 1 }, 200), 8);
  // Both factors grow as the camera closes in: eff(z) = 1200/700, eff(f) = 1200/900.
  near(dofBlur({ z: -300, p: 1200, f: 0, a: 1 }, 200), (40 * 200 * (1200 / 700) * (1200 / 900)) / 1200);
});

// ─── camera resolution (section 5.4) ────────────────────────────────────────────────

test('no camera resolves to the DEFAULT camera - never a literal identity', () => {
  for (const cams of [null, undefined, [], [null as never]] as const) {
    assert.deepEqual(resolveCamera(cams, 0), { ...DEFAULT_CAMERA });
    assert.deepEqual(resolveCamera(cams, 7331), { ...DEFAULT_CAMERA });
  }
  // The default projects z = 0 at eff = 1 but still SEES z - an identity would swallow it.
  const cam: KfCameraView = { ...resolveCamera([], 0), ...STAGE };
  assert.equal(projectLayer(cam, { bx: 0, by: 0, z: 0 }).scale, 1);
  near(projectLayer(cam, { bx: 0, by: 0, z: 240 }).scale, 1.25);
});

test('an untimed camera covers every t; its base pose is the scene default', () => {
  const cams = [{ base: { z: 100, p: 800 } }];
  for (const t of [0, 5000, 3_600_000]) {
    assert.deepEqual(resolveCamera(cams, t), { ...DEFAULT_CAMERA, z: 100, p: 800 });
  }
});

test('camera cuts: the latest-in-array clip whose half-open window covers t wins', () => {
  const cams = [
    { start: 0, end: 2000, base: { x: 10 } },
    { start: 2000, end: 4000, base: { x: 20 } },
  ];
  assert.equal(resolveCamera(cams, 0).x, 10);
  assert.equal(resolveCamera(cams, 1999).x, 10);
  assert.equal(resolveCamera(cams, 2000).x, 20, 'the cut is exact at the boundary');
  assert.equal(resolveCamera(cams, 3999).x, 20);
  assert.deepEqual(resolveCamera(cams, 4000), { ...DEFAULT_CAMERA }, 'past the last window: the default');
  // Overlap resolves by array order, not by start time.
  const overlapping = [{ base: { x: 1 } }, { start: 0, end: 9999, base: { x: 2 } }];
  assert.equal(resolveCamera(overlapping, 100).x, 2);
  assert.equal(resolveCamera([...overlapping].reverse(), 100).x, 1);
});

test('a camera track runs in LOCAL clip time and its channels REPLACE the base pose', () => {
  const cams = [{
    start: 1000,
    end: 5000,
    base: { z: 50, p: 800, a: 0.25 },
    track: parseKf('t0_el_z0*t1000_z240'),
  }];
  assert.equal(resolveCamera(cams, 1000).z, 0, 'local t = 0 at the clip start');
  near(resolveCamera(cams, 1500).z ?? NaN, 120);
  assert.equal(resolveCamera(cams, 2000).z, 240);
  assert.equal(resolveCamera(cams, 4999).z, 240, 'clamp-hold to the end of the window');
  // Untouched channels keep the base; the keyed one replaces it.
  assert.equal(resolveCamera(cams, 1500).p, 800);
  assert.equal(resolveCamera(cams, 1500).a, 0.25);
  assert.equal(resolveCamera(cams, 1500).f, DEFAULT_CAMERA.f);
});

test('a resolved camera is always usable: p is sane and the pose is a fresh object', () => {
  const a = resolveCamera([], 0);
  a.z = 999;
  assert.equal(resolveCamera([], 0).z, 0, 'DEFAULT_CAMERA is not handed out by reference');
  assert.equal(resolveCamera([{ base: { p: 0 } }], 0).p, KF_CLAMPS.p[0]);
  assert.equal(resolveCamera([{ base: { p: Number.NaN } }], 0).p, DEFAULT_PERSPECTIVE);
  assert.equal(resolveCamera([{ base: { p: 1e9 } }], 0).p, KF_CLAMPS.p[1]);
  // Camera channels only - an `s` on a camera track is not a camera channel.
  const cams = [{ track: parseKf('t0_s4_z10') }];
  assert.equal(resolveCamera(cams, 0).z, 10);
  assert.ok(!Object.hasOwn(resolveCamera(cams, 0), 's'));
});

// The overshoot presets exist to overshoot, so a segment between two IN-RANGE keys leaves
// the range mid-flight. The resolved pose is this module's public contract - the section 8 camera
// panel and any plate-padding budget read it directly - so `a` documented as "Aperture
// 0–1" has to be 0–1 at every t, not only where dofBlur re-clamps it for itself.
test('EVERY resolved channel is held to its range, not just p (an overshoot ease cannot leak)', () => {
  const overshoot = [{ track: parseKf('t0_ea_a1*t1000_a0') }];
  let peak = 0;
  for (let t = 0; t <= 1000; t += 5) {
    const a = resolveCamera(overshoot, t).a;
    assert.ok(a >= 0 && a <= 1, `a stays in 0–1 at t=${t}: ${a}`);
    peak = Math.max(peak, a);
  }
  assert.equal(peak, 1, 'and it does reach the top of the range, so the clamp is what held it');
  // The same mechanism on the other bounded channels.
  for (let t = 0; t <= 1000; t += 5) {
    const pose = resolveCamera([{ track: parseKf('t0_ev_p12000_f3000*t1000_p50_f-3000') }], t);
    assert.ok(pose.p >= KF_CLAMPS.p[0] && pose.p <= KF_CLAMPS.p[1], `p @ ${t}`);
    assert.ok(pose.f >= KF_CLAMPS.f[0] && pose.f <= KF_CLAMPS.f[1], `f @ ${t}`);
  }
  // Clamped, NOT quantised: a resolved pose is a per-frame value, and rounding a slow pan
  // to the wire's 0.01px would stair-step it.
  near(resolveCamera([{ track: parseKf('t0_el_x0*t1000_x1') }], 1).x, 0.001);
});

// ─── surface invariants ──────────────────────────────────────────────────────

test('the channel vocabulary, its clamps and its quanta are all declared together', () => {
  // APPEND-ONLY, and the order IS the serialisation order: `w`/`h` (plans/104 section 5.2, P1)
  // joined at the TAIL, never beside x/y where they read better, because inserting in
  // the middle would re-spell every track already on the wire.
  assert.deepEqual([...KF_CHANNELS],
    ['x', 'y', 'z', 's', 'r', 'rx', 'ry', 'o', 'b', 'f', 'a', 'p', 'w', 'h']);
  for (const ch of KF_CHANNELS) {
    assert.ok(isKfChannel(ch));
    assert.ok(Object.hasOwn(KF_CLAMPS, ch), `${ch} has a clamp`);
    assert.ok(Object.hasOwn(KF_QUANTA, ch), `${ch} has a quantum`);
    assert.ok(KF_CLAMPS[ch][0] < KF_CLAMPS[ch][1], ch);
  }
  assert.deepEqual([...KF_CLAMPS.z], [-12000, 12000], 'the WIRE clamp - wide enough for the dolly');
  assert.deepEqual([...KF_Z_FIELD_CLAMP], [-300, 900], 'the section 5.3 field clamp, separately');
  assert.deepEqual([...KF_CLAMPS.o], [0, 1]);
  assert.deepEqual([...KF_CLAMPS.a], [0, 1]);
  assert.deepEqual([...KF_CLAMPS.s], [0.01, 100]);
  // Size is a CONTENT-box channel: a camera has no width, and `KF_CAMERA_CHANNELS` is
  // what `resolveCamera` iterates, so a stray `w` token on a camera track is inert.
  assert.deepEqual([...KF_CAMERA_CHANNELS], ['x', 'y', 'z', 'rx', 'ry', 'f', 'a', 'p']);
  assert.deepEqual([...KF_CLAMPS.w], [0, 16384], 'absolute px, non-negative');
  assert.deepEqual([...KF_CLAMPS.h], [0, 16384]);
  assert.equal(KF_QUANTA.w, 0.01);
  for (const bad of ['q', 'wh', '', 'toString', '__proto__', 1, null] as unknown[]) {
    assert.equal(isKfChannel(bad), false, String(bad));
  }
  // A prototype key can never be read as a channel through the wire either.
  assert.deepEqual(parseKf('t0___proto__1_constructor2')[0]?.v, {});
});

test('rx/ry parse from day one even though the consumers ignore them until P2', () => {
  const k = parseKf('t0_rx-12.5_ry33.25')[0];
  assert.equal(k?.v.rx, -12.5);
  assert.equal(k?.v.ry, 33.25);
  assert.equal(serialiseKf(parseKf('t0_ry33.25_rx-12.5')), 't0_rx-12.5_ry33.25');
});
