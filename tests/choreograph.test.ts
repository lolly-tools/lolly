// SPDX-License-Identifier: MPL-2.0
/**
 * Choreograph (plans/104 P4) - the showcase generator, evaluated through the real engine.
 *
 * Run with: node --import ./tests/css-stub.mjs --test "tests/choreograph.test.ts" (also collected by `npm test`). No framework - node:test.
 *
 * What has to hold, per ARC TYPE (plans/104 section 9, the arc grammar):
 *   - INTRO and FEATURE end at the REST pose: every box back at its OWN z field (the lift
 *     ladder, never 0), x/y 0, s 1, o 1, b 0; the camera at the default pose. FEATURE
 *     also STARTS there.
 *   - OUTRO starts at rest and deliberately ends exploded.
 *   - LOOP's end state equals its start state (the gif/apng cycle) and passes through rest.
 *   - None of it is vacuous: every arc leaves rest somewhere in the middle.
 * Plus the wire laws: charset-clean, round-trips through parseKf/serialiseKf, every key
 * inside [0, T], per-box z inside the FIELD clamp, camera tilt inside the control range,
 * deterministic from the seed, and the stagger honours the order.
 * And the model write: one new array, promotions only on an untimed board, the camera
 * minted once and keyed in the same array, non-posable kinds skipped, <2 boxes refused.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  KF_CHARSET_RE, KF_Z_FIELD_CLAMP, evaluateKf, kfChannelsUsed, parseKf, serialiseKf,
} from '../engine/src/keyframes.ts';
import type { KfChannel, KfPose } from '../engine/src/keyframes.ts';
import {
  SHOWCASE_ARC, SHOWCASE_IDS, SHOWCASE_MS, applyChoreograph, choreograph, choreographable, rankStack, seedFor,
  whyNotChoreograph,
} from '../shells/web/src/views/choreograph.ts';
import type { ChoreoBox, ChoreoOptions, ShowcaseId } from '../shells/web/src/views/choreograph.ts';
import { boxTiming, deriveDuration, kfBoxTrack } from '../shells/web/src/views/timeline-math.ts';
import type { TimeCfg } from '../shells/web/src/views/timeline-math.ts';
import type { Box } from '../shells/web/src/views/free-canvas-math.ts';

const STAGE = { w: 1200, h: 800 };

/** A 3x2 swatch grid, lifted: ascending depth in reading order. */
function grid(): ChoreoBox[] {
  const out: ChoreoBox[] = [];
  let k = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      out.push({ id: `s${k}`, z: [0, 23.53, 46.15, 67.92, 88.89, 109.09][k]!, cx: 200 + col * 300, cy: 250 + row * 300, w: 200, h: 200 });
      k++;
    }
  }
  return out;
}

const BOX_REST: Record<string, number> = { x: 0, y: 0, s: 1, o: 1, b: 0 };
const CAM_REST: Record<string, number> = { x: 0, y: 0, z: 0, rx: 0, ry: 0, f: 0, a: 0 };

function poseAt(keys: Parameters<typeof serialiseKf>[0], t: number): KfPose {
  return evaluateKf(parseKf(serialiseKf(keys)), t);
}
function assertBoxAtRest(pose: KfPose, box: ChoreoBox, label: string): void {
  for (const ch of Object.keys(pose) as KfChannel[]) {
    const want = ch === 'z' ? box.z : BOX_REST[ch];
    assert.ok(want !== undefined, `${label}: channel ${ch} has no rest value`);
    assert.ok(Math.abs(pose[ch]! - want) < 1e-6, `${label}: ${ch} = ${pose[ch]} at rest should be ${want}`);
  }
}
function assertCamAtRest(pose: KfPose, label: string): void {
  for (const ch of Object.keys(pose) as KfChannel[]) {
    assert.ok(Math.abs(pose[ch]! - CAM_REST[ch]!) < 1e-6, `${label}: camera ${ch} = ${pose[ch]} should be ${CAM_REST[ch]}`);
  }
}
function leavesRest(keys: Parameters<typeof serialiseKf>[0], rest: (ch: KfChannel) => number, T: number): boolean {
  for (let t = 0; t <= T; t += Math.max(1, Math.round(T / 200))) {
    const p = poseAt(keys, t);
    for (const ch of Object.keys(p) as KfChannel[]) if (Math.abs(p[ch]! - rest(ch)) > 1) return true;
  }
  return false;
}

test('every showcase obeys its arc type - the Resolution Rule, per INTRO/FEATURE/OUTRO/LOOP', () => {
  const stack = grid();
  for (const id of SHOWCASE_IDS) {
    const plan = choreograph(stack, STAGE, { showcase: id, seed: 7 });
    const T = plan.durationMs;
    assert.equal(plan.arc, SHOWCASE_ARC[id]);
    assert.equal(T, SHOWCASE_MS[id], `${id}: a fresh stack gets the authored length`);
    assert.ok(plan.camera && plan.camera.length >= 2, `${id}: writes a camera track`);

    for (const entry of plan.boxes) {
      const box = stack.find((b) => b.id === entry.id)!;
      const start = poseAt(entry.keys, 0), end = poseAt(entry.keys, T);
      const label = `${id}/${entry.id}`;
      switch (plan.arc) {
        case 'intro': assertBoxAtRest(end, box, `${label} end`); break;
        case 'feature': assertBoxAtRest(start, box, `${label} start`); assertBoxAtRest(end, box, `${label} end`); break;
        case 'outro': {
          assertBoxAtRest(start, box, `${label} start`);
          assert.ok(Object.keys(end).some((ch) => Math.abs(end[ch as KfChannel]! - (ch === 'z' ? box.z : BOX_REST[ch]!)) > 1), `${label}: an OUTRO ends exploded`);
          break;
        }
        case 'loop': {
          assert.deepEqual(end, start, `${label}: a LOOP ends where it starts`);
          const mid = poseAt(entry.keys, Math.round(T / 2));
          assertBoxAtRest(mid, box, `${label} mid`);
          break;
        }
      }
      assert.ok(leavesRest(entry.keys, (ch) => (ch === 'z' ? box.z : BOX_REST[ch]!), T), `${label}: the move never leaves rest, so the ending proves nothing`);
    }

    const cam = plan.camera!;
    const cStart = poseAt(cam, 0), cEnd = poseAt(cam, T);
    if (plan.arc === 'intro' || plan.arc === 'feature') assertCamAtRest(cEnd, `${id} camera end`);
    if (plan.arc === 'feature' || plan.arc === 'outro') assertCamAtRest(cStart, `${id} camera start`);
    if (plan.arc === 'loop') assert.deepEqual(cEnd, cStart, `${id}: the camera loops too`);
    assert.ok(leavesRest(cam, (ch) => CAM_REST[ch]!, T), `${id}: the camera never sits still`);
  }
});

test('wire laws: charset, round trip, key times inside the arc, field clamp on z, tilt inside the control range', () => {
  const stack = grid();
  // Several (length, stagger) pairs, because the review found a .5-rounds-up-twice case
  // that put the last key ONE ms past T - and a loop that no longer cycled because of it.
  const timings = [[undefined, undefined], [2500, 400], [800, 5000], [801, 20], [999, 0], [20000, 90]] as const;
  for (const id of SHOWCASE_IDS) for (const [durationMs, staggerMs] of timings) for (const order of ['', 'reverse', 'random'] as const) {
    const plan = choreograph(stack, STAGE, { showcase: id, seed: 3, durationMs, staggerMs, order });
    const all = [...plan.boxes.map((b) => b.keys), plan.camera!];
    for (const keys of all) {
      const wire = serialiseKf(keys);
      assert.match(wire, KF_CHARSET_RE, `${id}: charset`);
      assert.equal(serialiseKf(parseKf(wire)), wire, `${id}: round trip`);
      assert.equal(parseKf(wire).length, keys.length, `${id} T=${durationMs} stagger=${staggerMs}: two keys collided on one ms`);
      for (const k of keys) {
        assert.ok(k.t! >= 0 && k.t! <= plan.durationMs, `${id} T=${durationMs} stagger=${staggerMs}: key at ${k.t} outside [0, ${plan.durationMs}]`);
      }
    }
    if (plan.arc === 'loop') {
      for (const e of plan.boxes) assert.deepEqual(poseAt(e.keys, plan.durationMs), poseAt(e.keys, 0), `loop T=${durationMs} stagger=${staggerMs} ${order}: ${e.id} must end where it starts`);
    }
    if (durationMs !== undefined || staggerMs !== undefined || order) continue;
    for (const entry of plan.boxes) {
      for (const k of entry.keys) {
        const z = (k.v as Record<string, number>)?.z;
        if (typeof z === 'number') assert.ok(z >= KF_Z_FIELD_CLAMP[0] && z <= KF_Z_FIELD_CLAMP[1], `${id}: box z ${z} outside the field clamp`);
        for (const ch of Object.keys(k.v ?? {})) assert.ok(!'rxryfapvwh'.includes(ch) || ch === 'x' || ch === 'y', `${id}: a box never keys ${ch}`);
      }
    }
    for (const k of plan.camera!) {
      const v = k.v as Record<string, number>;
      for (const ch of ['rx', 'ry'] as const) if (typeof v[ch] === 'number') assert.ok(Math.abs(v[ch]!) <= 75, `${id}: tilt ${v[ch]} past the control range`);
      assert.ok(!('o' in v) && !('s' in v) && !('b' in v), `${id}: a camera key carries camera channels only`);
    }
  }
});

test('a box z near the field ceiling is clamped, never dropped or pushed past 900', () => {
  const stack: ChoreoBox[] = [
    { id: 'a', z: 880, cx: 100, cy: 100, w: 50, h: 50 },
    { id: 'b', z: 890, cx: 300, cy: 100, w: 50, h: 50 },
  ];
  const plan = choreograph(stack, STAGE, { showcase: 'buildup', seed: 1 });
  for (const entry of plan.boxes) {
    const track = parseKf(serialiseKf(entry.keys));
    assert.ok(kfChannelsUsed(track).includes('z'));
    for (const k of track) if (typeof k.v.z === 'number') assert.ok(k.v.z <= 900);
    const box = stack.find((b) => b.id === entry.id)!;
    assert.equal(evaluateKf(track, plan.durationMs).z, box.z, 'rest is the box\'s own depth');
  }
});

test('deterministic from the seed; a different seed moves the random order and the nudges', () => {
  const stack = grid();
  const a = choreograph(stack, STAGE, { showcase: 'loop', seed: 11, order: 'random' });
  const b = choreograph(stack, STAGE, { showcase: 'loop', seed: 11, order: 'random' });
  assert.deepEqual(a, b);
  const c = choreograph(stack, STAGE, { showcase: 'loop', seed: 12, order: 'random' });
  assert.notDeepEqual(a.boxes.map((x) => serialiseKf(x.keys)), c.boxes.map((x) => serialiseKf(x.keys)));
  assert.equal(seedFor(['s0', 's1']), seedFor(['s0', 's1']));
  assert.notEqual(seedFor(['s0', 's1']), seedFor(['s1', 's0']));
  // float off: no nudges, no breath, so the output is the plain deal.
  const flat = choreograph(stack, STAGE, { showcase: 'buildup', seed: 5, float: false });
  for (const e of flat.boxes) for (const k of e.keys) assert.ok(!(typeof (k.v as Record<string, number>)?.s === 'number' && (k.v as Record<string, number>).s !== 1), 'no breath without float');
});

test('the stagger honours the order: reading, reverse, centre-out, depth, random', () => {
  const stack = grid();
  const rnd = () => 0.5;
  assert.deepEqual(rankStack(stack, '', rnd), [0, 1, 2, 3, 4, 5], 'reading order over a 3x2 grid');
  assert.deepEqual(rankStack(stack, 'reverse', rnd), [5, 4, 3, 2, 1, 0]);
  const centre = rankStack(stack, 'center', rnd);
  // Centroid (500, 400): s1 (500,250) and s4 (500,550) are nearest, s0/s2/s3/s5 the corners.
  assert.ok(centre[1]! < 2 && centre[4]! < 2, `centre first: ${centre.join(',')}`);
  assert.deepEqual(rankStack(stack, 'depth', rnd), [0, 1, 2, 3, 4, 5], 'depth == reading order on this ladder');
  const shuffled = rankStack(stack, 'random', () => 0.99);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5], 'a permutation');
  // And the deal follows the rank: a later rank settles later.
  const plan = choreograph(stack, STAGE, { showcase: 'buildup', seed: 2, float: false, staggerMs: 120 });
  const settleEnd = plan.boxes.map((e) => Math.max(...e.keys.map((k) => k.t!)));
  for (let i = 1; i < settleEnd.length; i++) assert.ok(settleEnd[i]! > settleEnd[i - 1]!, `rank ${i} settles after rank ${i - 1}`);
  assert.equal(settleEnd[1]! - settleEnd[0]!, 120, 'the requested gap when there is room');
  // Sixty boxes at 120ms would overrun a 3s window: the gap compresses instead.
  const many: ChoreoBox[] = Array.from({ length: 60 }, (_v, i) => ({ id: `m${i}`, z: 0, cx: (i % 10) * 100, cy: Math.floor(i / 10) * 100, w: 80, h: 80 }));
  const dense = choreograph(many, STAGE, { showcase: 'buildup', seed: 2, float: false, staggerMs: 120 });
  for (const e of dense.boxes) for (const k of e.keys) assert.ok(k.t! <= dense.durationMs);
  assert.ok(Math.max(...dense.boxes.map((e) => Math.max(...e.keys.map((k) => k.t!)))) <= Math.round(dense.durationMs * 0.85));
  // The window is FILLED: the last rank settles at the window's end, and a longer arc is
  // a slower settle rather than a static tail (the review measured 77 % dead air at 8 s).
  const long = choreograph(stack, STAGE, { showcase: 'buildup', seed: 2, float: false, staggerMs: 90, durationMs: 8000 });
  const ends = long.boxes.map((e) => Math.max(...e.keys.map((k) => k.t!)));
  assert.equal(Math.max(...ends), Math.round(8000 * 0.85));
  const spans = long.boxes.map((e) => Math.max(...e.keys.map((k) => k.t!)) - Math.min(...e.keys.map((k) => k.t!)));
  assert.ok(Math.min(...spans) >= 0.4 * 0.85 * 8000, `each settle spans at least 40 % of the window: ${spans.join(',')}`);
});

test('reading order bands rows by tolerance, so centres that straddle a boundary stay one row', () => {
  // Six side-by-side swatches whose centres wobble by a few px (crops of unequal heights).
  const wobble = [145, 152, 148, 155, 143, 151];
  const rowOfSix: ChoreoBox[] = wobble.map((cy, i) => ({ id: `w${i}`, z: 0, cx: 100 + i * 120, cy, w: 100, h: 100 }));
  assert.deepEqual(rankStack(rowOfSix, '', () => 0.5), [0, 1, 2, 3, 4, 5]);
  // And two real rows a full band apart are still two rows.
  const twoRows: ChoreoBox[] = [...rowOfSix, ...wobble.map((cy, i) => ({ id: `v${i}`, z: 0, cx: 100 + i * 120, cy: cy + 130, w: 100, h: 100 }))];
  assert.deepEqual(rankStack(twoRows, '', () => 0.5), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('the corridor camera sits INSIDE the exploded depth range; a flat stack gets no aperture from the hero', () => {
  const ladder: ChoreoBox[] = [200, 300, 400].map((z, i) => ({ id: `l${i}`, z, cx: 400, cy: 300, w: 300, h: 200 }));
  const trench = choreograph(ladder, STAGE, { showcase: 'trench', seed: 1 });
  const camZ = (trench.camera![1]!.v as Record<string, number>).z!;
  const lift = 120 * 0.4;
  assert.ok(camZ > 200 + lift && camZ < 400 + lift, `camera z ${camZ} between the exploded floor and ceiling`);
  const flat = choreograph(grid().map((b) => ({ ...b, z: 0 })), STAGE, { showcase: 'trench', seed: 1 });
  assert.ok((flat.camera![1]!.v as Record<string, number>).z! < lift, 'a single plane has no inside: the camera sits below it');
  const hero = choreograph(grid().map((b) => ({ ...b, z: 0 })), STAGE, { showcase: 'hero', seed: 1 });
  for (const k of hero.camera!) assert.equal((k.v as Record<string, number>).a, 0, 'no depth to separate, so the aperture stays shut');
  const heroDeep = choreograph(ladder, STAGE, { showcase: 'hero', seed: 1 });
  const f = (heroDeep.camera![1]!.v as Record<string, number>).f!;
  assert.ok(f > 200 + 120 && f < 400 + 120, `focus ${f} inside the exploded range`);
  assert.ok(heroDeep.camera!.some((k) => (k.v as Record<string, number>).a! > 0));
});

test('a lifted stack (every centre equal) keeps its array order, and a lone box or an empty stack is harmless', () => {
  const stack: ChoreoBox[] = [0, 23.53, 46.15].map((z, i) => ({ id: `l${i}`, z, cx: 400, cy: 300, w: 300, h: 200 }));
  assert.deepEqual(rankStack(stack, '', () => 0.5), [0, 1, 2]);
  const plan = choreograph(stack, STAGE, { showcase: 'hero', seed: 1 });
  for (const e of plan.boxes) {
    const ex = e.keys.find((k) => (k.v as Record<string, number>).z! > stack[0]!.z + 1)!;
    assert.ok(ex, 'every layer lifts');
    assert.ok(Math.abs((ex.v as Record<string, number>).x!) <= 24.01 && Math.abs((ex.v as Record<string, number>).y!) <= 24.01, 'no radial spread when the centres coincide - only the floor');
  }
  assert.equal(choreograph([], STAGE, { showcase: 'buildup' }).boxes.length, 0);
  const one = choreograph(stack.slice(0, 1), STAGE, { showcase: 'scan', seed: 1 });
  assert.equal(one.boxes.length, 1);
  assert.ok(one.camera!.length >= 2);
});

test('hostile options: unknown showcase, NaN duration/stagger, absurd durations - clamped, never thrown', () => {
  const stack = grid();
  const p = choreograph(stack, STAGE, { showcase: 'nope' as ShowcaseId, durationMs: Number.NaN, staggerMs: Number.NaN, seed: Number.NaN });
  assert.equal(p.arc, 'intro');
  assert.equal(p.durationMs, SHOWCASE_MS.buildup);
  assert.equal(choreograph(stack, STAGE, { showcase: 'loop', durationMs: 10 }).durationMs, 800);
  assert.equal(choreograph(stack, STAGE, { showcase: 'loop', durationMs: 1e12 }).durationMs, 3_600_000);
  const tiny = choreograph(stack, { w: 0, h: Number.NaN }, { showcase: 'scan', seed: 1 });
  for (const k of tiny.camera!) for (const v of Object.values(k.v ?? {})) assert.ok(Number.isFinite(v), 'a degenerate stage never yields NaN');
});

// ── the model write ────────────────────────────────────────────────────────────

const cfg: TimeCfg = {
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed', enterField: 'enter', exitField: 'exit',
  enterMsField: 'enterMs', exitMsField: 'exitMs', muteField: 'mute', laneField: 'lane', idField: 'id',
  kfField: 'kf', zField: 'z', groupField: 'group',
};
const rect = (b: Box) => ({ x: Number(b.x), y: Number(b.y), w: Number(b.w), h: Number(b.h) });
const env = (over: Partial<Parameters<typeof applyChoreograph>[3]> = {}) => ({
  cfg, rect, stage: STAGE, cameraSeed: { kind: 'camera' } as Box,
  mint: (rows: Box[]) => `c${rows.length}`, ...over,
});
const board = (): Box[] => [
  { id: 'bg', x: 0, y: 0, w: 1200, h: 800, z: 0 },
  { id: 'a', x: 100, y: 100, w: 200, h: 200, z: 23.53, group: 'g1' },
  { id: 'b', x: 400, y: 100, w: 200, h: 200, z: 46.15, group: 'g1' },
  { id: 'c', x: 700, y: 100, w: 200, h: 200, z: 67.92, group: 'g1' },
  // Untimed, so the board has NO sequence yet - a timed audio row would make it one.
  { id: 'snd', kind: 'audio' },
];

test('applyChoreograph on an UNTIMED board promotes the posed boxes to clips and mints the camera - one array', () => {
  const rows = board();
  const res = applyChoreograph(rows, ['a', 'b', 'c', 'snd', 'missing'], { showcase: 'buildup', seed: 4 }, env())!;
  assert.ok(res);
  assert.notEqual(res.rows, rows);
  assert.deepEqual(res.ids, ['a', 'b', 'c'], 'the audio clip and the unknown id are skipped');
  assert.equal(res.cameraId, 'c5', 'minted against the growing array');
  const cam = res.rows.find((b) => b.kind === 'camera')!;
  assert.equal(cam.id, 'c5');
  assert.ok(String(cam.kf).length > 0, 'the camera is keyed in the same array');
  assert.equal(boxTiming(cam, cfg).start, null, 'the camera stays untimed (always on)');
  for (const id of ['a', 'b', 'c']) {
    const b = res.rows.find((r) => r.id === id)!;
    const tm = boxTiming(b, cfg);
    assert.equal(tm.start, 0, `${id} promoted to start at 0`);
    assert.equal(tm.dur, SHOWCASE_MS.buildup / 1000, `${id} runs the arc's length`);
    const track = kfBoxTrack(b, cfg);
    assert.ok(track.length >= 2, `${id} has a track`);
    assert.equal(evaluateKf(track, SHOWCASE_MS.buildup).z, Number(b.z), `${id} rests at its own depth`);
  }
  assert.equal(res.rows.find((r) => r.id === 'bg')!.kf, undefined, 'an unselected box is untouched');
  assert.equal(rows.find((r) => r.id === 'a')!.kf, undefined, 'the input array is not mutated');
});

test('on a TIMED board the arc starts at the earliest chosen clip, tracks are head-trimmed into each local clock, and an existing camera is re-keyed', () => {
  const rows: Box[] = [
    { id: 'cam', kind: 'camera', kf: 't0_z-220' },
    { id: 'a', x: 0, y: 0, w: 100, h: 100, z: 0, start: 1, dur: 4 },
    { id: 'b', x: 200, y: 0, w: 100, h: 100, z: 20, start: 2, dur: 3 },
    { id: 'scenery', x: 400, y: 0, w: 100, h: 100, z: 40 },
  ];
  const res = applyChoreograph(rows, ['a', 'b', 'scenery'], { showcase: 'hero', seed: 9 }, env())!;
  assert.equal(res.cameraId, 'cam', 'the existing camera is reused, not a second one minted');
  assert.equal(res.rows.filter((b) => b.kind === 'camera').length, 1);
  assert.notEqual(res.rows.find((b) => b.id === 'cam')!.kf, 't0_z-220', 'its track is replaced');
  // 4 s span from t=1 to t=5 (the scenery member runs to the scene end, 5 s).
  assert.equal(res.plan.durationMs, 4000);
  const a = res.rows.find((b) => b.id === 'a')!, b = res.rows.find((r) => r.id === 'b')!, sc = res.rows.find((r) => r.id === 'scenery')!;
  assert.equal(boxTiming(a, cfg).start, 1, 'timed starts are not moved');
  assert.equal(boxTiming(b, cfg).dur, 3, 'timed lengths are not changed');
  assert.equal(boxTiming(sc, cfg).start, null, 'scenery stays scenery on a timed board');
  const ta = kfBoxTrack(a, cfg), tb = kfBoxTrack(b, cfg), ts = kfBoxTrack(sc, cfg);
  const planOf = (id: string) => res.plan.boxes.find((e) => e.id === id)!.keys;
  const planLast = (id: string): number => Math.max(...planOf(id).map((k) => k.t!));
  // a starts AT the arc: its track is the plan verbatim.
  assert.equal(ta.length, planOf('a').length);
  assert.equal(ta[ta.length - 1]!.t, planLast('a'));
  // b enters 1 s into the arc: the keys before its start are TRIMMED, not piled onto t=0 -
  // it opens on the pose the absolute arc has reached at that instant (the review found
  // it opening already exploded with a key lost), and keeps every later key 1000 ms earlier.
  const absB = parseKf(serialiseKf(planOf('b').map((k) => ({ ...k, t: k.t! + 1000 }))));
  const atCut = evaluateKf(absB, 2000);
  assert.equal(tb[0]!.t, 0);
  for (const ch of Object.keys(atCut) as KfChannel[]) {
    assert.ok(Math.abs(tb[0]!.v[ch]! - atCut[ch]!) <= 0.011, `the synthesised opening key IS the arc pose at the clip start (${ch}: ${tb[0]!.v[ch]} vs ${atCut[ch]})`);
  }
  assert.equal(tb.length, 1 + planOf('b').filter((k) => k.t! + 1000 > 2000).length, 'no key lost, none duplicated');
  assert.equal(tb[tb.length - 1]!.t, planLast('b') - 1000);
  // Scenery runs on the sequence clock: 1000 ms later, so its last key is at the arc's absolute end.
  assert.equal(ts[ts.length - 1]!.t, planLast('scenery') + 1000);
  const cam = kfBoxTrack(res.rows.find((r) => r.id === 'cam')!, cfg);
  assert.equal(cam[0]!.t, 1000, 'the camera is keyed from the arc start, absolute');
  assert.equal(cam[cam.length - 1]!.t, 5000);
});

test('a clip that starts after the arc has finished is left alone, never frozen on a one-key pose', () => {
  const rows: Box[] = [
    { id: 'a', x: 0, y: 0, w: 100, h: 100, z: 0, start: 0, dur: 3 },
    { id: 'b', x: 200, y: 0, w: 100, h: 100, z: 20, start: 2.4, dur: 1 },
  ];
  // A deconstruct: the review found b written a single exploded, transparent key - invisible for life.
  const res = applyChoreograph(rows, ['a', 'b'], { showcase: 'deconstruct', seed: 3, durationMs: 2000 }, env())!;
  assert.deepEqual(res.ids, ['a']);
  assert.equal(res.rows.find((r) => r.id === 'b')!.kf, undefined);
  assert.ok(kfBoxTrack(res.rows.find((r) => r.id === 'a')!, cfg).length >= 2);
});

test('a camera that carries its own start is keyed in ITS local clock', () => {
  const rows: Box[] = [
    { id: 'cam', kind: 'camera', start: 3, dur: 4 },
    { id: 'a', x: 0, y: 0, w: 100, h: 100, z: 0, start: 1, dur: 4 },
    { id: 'b', x: 200, y: 0, w: 100, h: 100, z: 20, start: 1, dur: 4 },
  ];
  const res = applyChoreograph(rows, ['a', 'b'], { showcase: 'trench', seed: 2 }, env())!;
  const cam = kfBoxTrack(res.rows.find((r) => r.id === 'cam')!, cfg);
  // The arc runs 1 s..5 s absolute; the camera's clock starts at 3 s, so its keys sit 3000 ms earlier (floored at 0).
  assert.equal(cam[cam.length - 1]!.t, 5000 - 3000);
  assert.equal(cam[0]!.t, 0);
});

test('a showcase that keys only the camera still promotes every chosen box, so the sequence exists', () => {
  const res = applyChoreograph(board(), ['a', 'b', 'c'], { showcase: 'scan', seed: 1, float: false }, env())!;
  assert.deepEqual(res.ids, [], 'no box track was written');
  for (const id of ['a', 'b', 'c']) assert.equal(boxTiming(res.rows.find((r) => r.id === id)!, cfg).start, 0, `${id} promoted`);
  assert.ok(res.cameraId);
  assert.equal(deriveDuration(res.rows, cfg), SHOWCASE_MS.scan);
});

test('a frames document is refused outright - both evaluators opt out of projection there', () => {
  const rows: Box[] = [...board(), { id: 'page', kind: 'frame', x: 0, y: 0, w: 1200, h: 800 }];
  assert.equal(whyNotChoreograph(rows, ['a', 'b'], cfg), 'frames');
  assert.equal(applyChoreograph(rows, ['a', 'b'], { showcase: 'buildup' }, env()), null);
  assert.equal(whyNotChoreograph(board(), ['a'], cfg), 'few');
  assert.equal(whyNotChoreograph(board(), ['a', 'b'], cfg), '');
  assert.equal(whyNotChoreograph(board(), ['a', 'b'], { ...cfg, kfField: '' }), 'few');
});

test('refusals: fewer than two posable boxes, or no kf field', () => {
  assert.equal(applyChoreograph(board(), ['a'], { showcase: 'buildup' }, env()), null);
  assert.equal(applyChoreograph(board(), ['a', 'snd'], { showcase: 'buildup' }, env()), null);
  assert.equal(applyChoreograph(board(), ['a', 'b'], { showcase: 'buildup' }, env({ cfg: { ...cfg, kfField: '' } })), null);
  assert.equal(choreographable({ kind: 'camera' }), false);
  assert.equal(choreographable({ kind: 'frame' }), false);
  assert.equal(choreographable({ kind: 'audio' }), false);
  assert.equal(choreographable({}), true);
  assert.equal(choreographable(undefined), false);
});

test('the camera option off leaves every camera row alone and mints none', () => {
  const res = applyChoreograph(board(), ['a', 'b'], { showcase: 'trench', seed: 1, camera: false }, env())!;
  assert.equal(res.cameraId, '');
  assert.ok(!res.rows.some((b) => b.kind === 'camera'));
  assert.equal(res.plan.camera, null);
});

test('the options type is exhaustive enough for the picker', () => {
  const o: ChoreoOptions = { showcase: 'scan', durationMs: 8000, staggerMs: 90, order: 'center', seed: 1, camera: true, float: true };
  assert.equal(choreograph(grid(), STAGE, o).arc, 'intro');
});
