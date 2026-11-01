// SPDX-License-Identifier: MPL-2.0
/**
 * Springs and design-system eases on the `kf` wire (plans/329): the physics and its
 * landing rule, the determinism that keeps bytes equal across hosts, the grammar, the
 * channel clamps, exact subdivision, CSS `linear()`, token binding and its fallbacks, the
 * motion-token reader and the dotLottie bake.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMockHost } from '@lolly-tools/core';
import type { ExportOpts, HostV1, TokenSet } from '../engine/src/bridge/host-v1.ts';
import {
  KF_CLAMPS, evaluateKf, kfBindEase, kfEaseAt, kfEaseCss, kfEaseIsSpring, kfEaseKind, kfEasePoints,
  kfEaseResolved, kfEaseSpring, kfEaseSpringName, kfEaseTokenPath, kfEaseTokensSnapshot, normaliseKfEase,
  parseKf, serialiseKf, setKfEaseTokens, subdivideKfEase, withKfEaseTokens,
} from '../engine/src/keyframes.ts';
import {
  KF_SPRING_PRESETS, kfSpring, kfSpringDampingRatio, kfSpringPosition, kfSpringSettleMs, kfSpringToken, parseKfSpring,
} from '../engine/src/kf-spring.ts';
import { kfExportKeys } from '../engine/src/kf-bake.ts';
import { motionDurationMs, motionEaseMap, readMotionTokens } from '../engine/src/motion-tokens.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { exportDesignLottie } from '../engine/src/design-lottie.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { LottieObject } from '../engine/src/lottie-model.ts';

const BOUNCY = 'esp(600)(15)(1)';
const near = (a: number, b: number, tol: number, msg?: string): void =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

test('a spring lands exactly on the next key, settled or not', () => {
  for (const sp of Object.values(KF_SPRING_PRESETS)) {
    const tok = kfSpringToken(sp);
    for (const span of [80, 250, 600, 2000, 9000]) {
      assert.equal(kfEaseAt(tok, 0, span), 0);
      assert.equal(kfEaseAt(tok, 1, span), 1);
      // Continuous into the landing: the last millisecond is within a step of the target.
      near(kfEaseAt(tok, 1 - 1e-9, span), 1, 1e-6, `${tok} over ${span} ms`);
    }
  }
  // Slow over 100 ms has barely started; the landing rule still carries it home, evenly.
  const slow = kfSpringToken(KF_SPRING_PRESETS.slow);
  const x100 = kfSpringPosition(KF_SPRING_PRESETS.slow, 100);
  assert.ok(x100 < 0.5, 'not settled');
  near(kfEaseAt(slow, 0.5, 100), kfSpringPosition(KF_SPRING_PRESETS.slow, 50) + (1 - x100) * 0.5, 1e-12);
  // A settled spring gains nothing from the rule: the curve is the physics itself.
  const g = KF_SPRING_PRESETS.gentle;
  assert.equal(kfSpringPosition(g, 5000), 1, 'settled is exactly 1');
  assert.equal(kfEaseAt(kfSpringToken(g), 0.1, 5000), kfSpringPosition(g, 500));
});

test('a spring runs in real time: the same spring over a longer segment rests sooner in u', () => {
  const short = kfEaseAt(BOUNCY, 0.5, 400), long = kfEaseAt(BOUNCY, 0.5, 4000);
  near(long, 1, 1e-3, 'halfway through 4 s, Bouncy has settled');
  assert.notEqual(short, long);
});

test('the presets behave as named, and the physics is the integrator\'s, bit for bit', () => {
  const peak = (sp: (typeof KF_SPRING_PRESETS)[keyof typeof KF_SPRING_PRESETS]): number => {
    let m = 0;
    for (let t = 0; t < 3000; t++) m = Math.max(m, kfSpringPosition(sp, t));
    return m;
  };
  assert.ok(peak(KF_SPRING_PRESETS.bouncy) > 1.3, 'Bouncy bounces');
  assert.ok(peak(KF_SPRING_PRESETS.quick) > 1.05 && peak(KF_SPRING_PRESETS.quick) < 1.2);
  assert.ok(peak(KF_SPRING_PRESETS.gentle) < 1.05, 'Gentle barely overshoots');
  assert.ok(peak(KF_SPRING_PRESETS.slow) <= 1, 'Slow is overdamped and never passes the target');
  assert.ok(kfSpringDampingRatio(KF_SPRING_PRESETS.slow) > 1);
  for (const sp of Object.values(KF_SPRING_PRESETS)) {
    const s = kfSpringSettleMs(sp);
    assert.ok(s > 300 && s < 2000, `settles in ${s} ms`);
  }
  // Only + − × ÷ run in the integrator and the Hermite blend, so these numbers are the
  // same on every IEEE 754 host. A rewrite onto Math.exp/sin/cos would move them, and this
  // hash is what says so.
  const samples: number[] = [];
  for (const sp of Object.values(KF_SPRING_PRESETS)) for (let t = 0; t <= 1500; t += 16.6667) samples.push(kfSpringPosition(sp, t));
  const hash = createHash('sha256').update(new Uint8Array(Float64Array.from(samples).buffer)).digest('hex');
  assert.equal(hash, SPRING_SAMPLES_SHA256);
});

// Recorded from the integrator itself (V8). Pinned so a later change to the arithmetic,
// however small, is a decision rather than an accident.
const SPRING_SAMPLES_SHA256 = 'b4b49b2c2fe676d558e2f64febde05dd3de6aec50a2635083c564868259e2e75';

test('the wire: canonical spellings, clamps, windows and junk', () => {
  assert.equal(normaliseKfEase('esp(600)(15)(1)'), BOUNCY);
  assert.equal(normaliseKfEase('esp(600.04)(15.001)(1.004)'), BOUNCY, 'quantised');
  assert.equal(normaliseKfEase('esp(0)(-1)(0)'), 'esp(1)(0)(0.1)', 'clamped, never refused');
  assert.equal(normaliseKfEase('esp(99999)(9999)(9999)'), 'esp(5000)(500)(100)');
  assert.equal(normaliseKfEase('esp(600)(15)(1)(500)(0)(200)'), 'esp(600)(15)(1)(500)(0)(200)');
  assert.equal(normaliseKfEase('esp(600)(15)(1)(500)(-5)(9999)'), 'esp(600)(15)(1)(500)(0)(500)');
  assert.equal(normaliseKfEase('esp(600)(15)(1)(500)(300)(200)'), null, 'an inverted window is junk');
  assert.equal(normaliseKfEase('esp(1)(2)'), null);
  assert.equal(normaliseKfEase('esp(1e3)(2)(3)'), null, 'no exponents');
  assert.equal(kfEaseKind(BOUNCY), 'spring');
  assert.equal(kfEaseSpringName(BOUNCY), 'bouncy');
  assert.equal(kfEaseSpringName('esp(600)(15)(1)(500)(0)(200)'), '', 'a window is not a preset');
  assert.equal(kfEaseSpringName('esp(601)(15)(1)'), '');
  assert.equal(kfEasePoints(BOUNCY), null, 'a spring has no bezier');
  const track = parseKf(`t0_${BOUNCY}_x0*t500_x100`);
  assert.equal(serialiseKf(track), `t0_${BOUNCY}_x0*t500_x100`);
  assert.deepEqual(parseKf(serialiseKf(track)), track);
  assert.deepEqual(parseKfSpring(BOUNCY), { spring: kfSpring(600, 15, 1), window: null });
});

test('overshoot stays inside each channel\'s range; opacity stays linear', () => {
  const track = parseKf(`t0_${BOUNCY}_ts0_te0.2_cl0.8_o0_s0.5_a0.5*t600_ts0.9_te1_cl1_o1_s0.01_a1`);
  let sawOver = false;
  for (let t = 0; t <= 600; t += 5) {
    const p = evaluateKf(track, t);
    for (const ch of ['ts', 'te', 'cl', 's', 'a'] as const) {
      const [lo, hi] = KF_CLAMPS[ch];
      assert.ok(p[ch]! >= lo && p[ch]! <= hi, `${ch} at ${t}: ${p[ch]}`);
    }
    if (p.te === 1 && t < 590) sawOver = true;
    near(p.o!, kfEaseAt('el', t / 600), 0, 'opacity is linear');
  }
  assert.ok(sawOver, 'the spring did overshoot, and was held at the clamp');
  // An unclamped channel keeps its overshoot: that is the spring.
  const x = parseKf(`t0_${BOUNCY}_x0*t600_x100`);
  assert.ok(Math.max(...Array.from({ length: 120 }, (_v, i) => evaluateKf(x, i * 5).x!)) > 130);
});

test('a cut through a spring is exact: the two windows replay the original', () => {
  for (const [tok, span] of [[BOUNCY, 500], [kfSpringToken(KF_SPRING_PRESETS.slow), 300], ['esp(600)(15)(1)(900)(120)(700)', 640]] as const) {
    for (const lam of [0.13, 0.4, 0.77]) {
      const { left, right } = subdivideKfEase(tok, lam, span);
      assert.match(left, /^esp\(/);
      assert.match(right, /^esp\(/);
      const E = (u: number): number => kfEaseAt(tok, u, span);
      const eL = E(lam);
      for (const u of [0.05, 0.3, 0.5, 0.9]) {
        near(kfEaseAt(left, u, span * lam) * eL, E(u * lam), 1e-6, `${tok} left @${lam}`);
        near(eL + kfEaseAt(right, u, span * (1 - lam)) * (1 - eL), E(lam + (1 - lam) * u), 1e-6, `${tok} right @${lam}`);
      }
    }
  }
  assert.deepEqual(subdivideKfEase(BOUNCY, 1.2, 500), { left: BOUNCY, right: BOUNCY }, 'a cut outside keeps the spring');
});

test('kfEaseCss: a spring is CSS linear() with 61 stops, a bezier is unchanged', () => {
  const css = kfEaseCss(BOUNCY, 500);
  assert.match(css, /^linear\(0, .*, 1\)$/);
  assert.equal(css.split(',').length, 61);
  assert.ok(css.split(',').some((s) => Number(s.replace(/[^\d.]/g, '')) > 1.2), 'the overshoot is in it');
  assert.equal(kfEaseCss('es'), 'cubic-bezier(0.4,0,0.2,1)');
});

test('a design-system ease plays its token, then its fallback, then the default', () => {
  const misses: string[] = [];
  setKfEaseTokens({ 'motion.spring.bouncy': 'esp(700)(10)(1)', 'motion.curve.standard': 'cubic-bezier(0.2,0,0,1)', 'bad path': 'eo', 'motion.hold': 'eh' }, { onMiss: (p) => misses.push(p) });
  try {
    assert.deepEqual(kfEaseTokensSnapshot(), { 'motion.spring.bouncy': 'esp(700)(10)(1)' }, 'only bindable paths and concrete eases are kept');
    const bound = kfBindEase('motion.spring.bouncy', BOUNCY)!;
    assert.equal(bound, `et(motion.spring.bouncy)${BOUNCY}`);
    assert.equal(kfEaseKind(bound), 'token');
    assert.equal(kfEaseTokenPath(bound), 'motion.spring.bouncy');
    assert.equal(kfEaseResolved(bound), 'esp(700)(10)(1)', 'the live token wins over the fallback');
    assert.ok(kfEaseIsSpring(bound));
    assert.deepEqual(kfEaseSpring(bound)?.spring, kfSpring(700, 10, 1));
    const missing = 'et(motion.curve.gone)eo';
    assert.equal(kfEaseResolved(missing), 'eo', 'a missing token plays its fallback');
    assert.equal(kfEaseAt(missing, 0.3), kfEaseAt('eo', 0.3));
    assert.equal(kfEaseResolved('et(motion.curve.gone)'), 'eio', 'and with none, the default');
    kfEaseResolved(missing);
    assert.deepEqual(misses, ['motion.curve.gone'], 'a miss is reported once');
    // Scoped installs put the previous design system back.
    withKfEaseTokens({ 'motion.spring.bouncy': 'ev' }, () => assert.equal(kfEaseResolved(bound), 'ev'));
    assert.equal(kfEaseResolved(bound), 'esp(700)(10)(1)');
    // A bound segment cut in two plays the curve it had, written out.
    const halves = subdivideKfEase(bound, 0.5, 400);
    assert.match(halves.left, /^esp\(700\)\(10\)\(1\)\(400\)/);
    assert.deepEqual(subdivideKfEase(bound, 2, 400), { left: bound, right: bound }, 'a cut outside keeps the binding');
  } finally {
    setKfEaseTokens(null);
  }
  assert.equal(kfEaseResolved(`et(motion.spring.bouncy)${BOUNCY}`), BOUNCY, 'no design system: the fallback');
  assert.equal(kfBindEase('a b'), null);
  assert.equal(kfBindEase('x'.repeat(65)), null);
  assert.equal(kfBindEase('m.x', 'eio'), 'et(m.x)', 'the default fallback is not written');
});

const MOTION_DOC = {
  motion: {
    duration: { $type: 'duration', short: { $value: '200ms' }, medium: { $value: { value: 0.4, unit: 's' } }, odd: { $value: 'soon' } },
    curve: { $type: 'cubicBezier', standard: { $value: [0.2, 0, 0, 1], $description: 'Most moves.' }, bad: { $value: [2, 0, 0, 1] } },
    spring: {
      gentle: {
        $type: 'transition', $value: { duration: '600ms', delay: '0ms', timingFunction: [0.3, 0, 0.2, 1] },
        $extensions: { 'com.suse.lolly': { spring: { stiffness: 120, damping: 20, mass: 1 } } },
      },
      ratio: { $type: 'transition', $value: { duration: '500ms', delay: '0ms', timingFunction: [0.3, 0, 0.2, 1] }, $extensions: { 'com.suse.lolly': { spring: { stiffness: 400, dampingRatio: 0.5 } } } },
    },
    fade: { $type: 'transition', $value: { duration: '300ms', delay: '0ms', timingFunction: [0.4, 0, 1, 1] } },
  },
  'spaced name': { $type: 'cubicBezier', $value: [0.4, 0, 0.2, 1] },
};

test('readMotionTokens: durations, curves, transitions and springs, bindable ones only', () => {
  const m = readMotionTokens(createTokenSet(MOTION_DOC));
  assert.deepEqual(m.durations.map((d) => [d.path, d.label, d.ms]), [['motion.duration.short', 'Short', 200], ['motion.duration.medium', 'Medium', 400]]);
  assert.deepEqual(m.curves.map((c) => [c.path, c.kind, c.ease, c.durationMs]), [
    ['motion.curve.standard', 'curve', 'eb(0.2)(0)(0)(1)', null],
    ['motion.spring.gentle', 'spring', 'esp(120)(20)(1)', 600],
    ['motion.spring.ratio', 'spring', 'esp(400)(20)(1)', 500],
    ['motion.fade', 'curve', 'eb(0.4)(0)(1)(1)', 300],
  ]);
  assert.equal(m.curves[0]!.description, 'Most moves.');
  assert.deepEqual(motionEaseMap(m)['motion.spring.gentle'], 'esp(120)(20)(1)');
  assert.equal(motionDurationMs(250), 250);
  assert.equal(motionDurationMs('1.5s'), 1500);
  assert.equal(motionDurationMs('-1ms'), null);
  assert.deepEqual(readMotionTokens(null), { curves: [], durations: [] });
});

test('kfExportKeys: beziers pass through untouched, a spring is baked at every frame', () => {
  const plain = parseKf('t0_eo_x0*t500_ev_x100*t900_x50');
  assert.deepEqual(kfExportKeys(plain, 'x', 30, 100).map((k) => [k.f, k.ease, k.v]), [[3, 'eo', 0], [18, 'ev', 100], [30, 'eio', 50]]);
  const sprung = parseKf(`t0_${BOUNCY}_x0*t3000_x100`);
  const keys = kfExportKeys(sprung, 'x', 30, 0);
  assert.equal(keys[0]!.ease, 'el');
  for (const k of keys.slice(1, -1)) {
    assert.equal(k.ease, 'el');
    assert.equal(k.v, evaluateKf(sprung, (k.f * 1000) / 30).x, `frame ${k.f} is the editor's value`);
  }
  assert.deepEqual(keys[keys.length - 1], { f: 90, ease: 'eio', v: 100 });
  assert.ok(keys.length < 80, 'the settled tail collapses to its two ends');
});

function host(doc?: unknown): HostV1 {
  const h = createMockHost();
  h.geom = makeGeomApi();
  if (doc) {
    const set = createTokenSet(doc) as TokenSet;
    h.tokens = { get: async () => set, colors: async () => set.colors(), resolve: async (r: string) => set.resolve(r), themes: async () => [] };
  }
  return h;
}

test('dotLottie: a bound spring plays the design system\'s value, baked into frames', async () => {
  const kf = `t0_${kfBindEase('motion.spring.gentle', BOUNCY)}_x0*t1000_x200`;
  const opts: ExportOpts = { width: 400, height: 300, sourceDocument: { toolId: 'design', values: { background: 'transparent', projectFps: 30, boxes: [
    { id: 'a', kind: 'box', x: 0, y: 0, w: 40, h: 40, bg: '#e85d75', start: 0, dur: 2, lane: 'seq', kf },
  ] } } };
  const read = async (h: HostV1): Promise<LottieObject[]> => {
    const anim = readLottie(new Uint8Array(await (await exportDesignLottie(opts, h)).arrayBuffer())).animations[0]!.animation;
    const layer = (anim.layers as LottieObject[]).find((l) => l.nm === 'a')!;
    const pos = (layer.ks as LottieObject).p as LottieObject;
    return (pos.x as LottieObject).k as LottieObject[];
  };
  const withDs = await read(host(MOTION_DOC));
  const gentle = parseKf(`t0_esp(120)(20)(1)_x0*t1000_x200`);
  for (const k of withDs.slice(1, -1)) {
    assert.equal((k.s as number[])[0], 20 + evaluateKf(gentle, ((k.t as number) * 1000) / 30).x!, `frame ${k.t}`);
  }
  const without = await read(host());
  assert.notDeepEqual(without, withDs, 'with no design system the fallback (Bouncy) plays instead');
  assert.equal(kfEaseResolved('et(motion.spring.gentle)'), 'eio', 'and the export installed nothing that outlives it');
});
