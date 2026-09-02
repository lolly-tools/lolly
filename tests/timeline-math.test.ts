// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-math - the pure time math behind the timeline panel (Fable timeline, phase 2).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * Spec: plans/53-fable-timeline-phase-2.md section 1. This file is the phase's real safety net:
 * every interaction edge case (trim clamps, split boundaries, magnetic reorder,
 * overlay ripple, snapping) is asserted here rather than in the DOM controller, so
 * the panel only has to get its wiring right.
 *
 * The parity block below loads the REAL design hooks.js off disk and runs its
 * seqDurationMs against deriveDuration for the same rows - the artboard's data-seq-ms
 * and the panel's ruler length disagreeing is a real bug class, not a hypothetical.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  DEFAULT_CLIP_S, DEFAULT_SEQ_S, MAX_TIME_S, MIN_DUR, MIN_TRIM_BAR_PX, SNAP_PX,
  boxTiming, deriveDuration, dropIndexAt, edgeZonePx, fmtDelta, fmtDur,
  fmtTime, indexOfId, isTimed, moveOverlay,
  moveSeqClip, packSeq,
  removeAndRipple, rippleOverlays, seqBoxes, setClipIn, setDuration, setSpeed,
  detachAudio, isThroughEdit, joinClips, reattachAudio, restackOverlay, splitAll,
  onionNeighbours, ONION_MAX_STEPS,
  snapTime, splitBox, trimClip, trimClips,
  // The keyframe EDITING surface (plans/104 section 8) - the arithmetic the panel is
  // forbidden from doing itself.
  KF_NEUTRAL, KF_POSE_SEED, clearKfTrack, kfDiamondAt, kfDiamondTimes, kfDuplicateMs,
  kfFormatChannel, kfLocalMs, kfSeekDiamond, kfSlideMs, kfTimelineSec, kfTrackDelete,
  kfTrackDuplicate, kfTrackRetime, kfTrackSetEase, kfWriteMs, rescaleKfTrack, setKfTrack, writeKfPose,
  // The motion path (plans/104 section 8's overlay bullet) - sampled through the engine.
  MOTION_PATH_MAX_SAMPLES, kfCameraClips, kfMotionPath,
  type Box, type TimeCfg,
} from '../shells/web/src/views/timeline-math.ts';
// The rebase is asserted through the ENGINE's own reader: a track that only
// timeline-math could evaluate would prove nothing about what the shells replay.
import {
  KF_CHARSET_RE, evaluateKf, kfChannelsUsed, parseKf, projectLayer, resolveCamera, serialiseKf,
} from '../engine/src/keyframes.ts';
import type { KfCameraClip, KfTrack } from '../engine/src/keyframes.ts';

// The field names phase 1 locked into BOTH brand copies of design's canvas cfg.
const cfg: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane',
};

/** A seq-lane clip. */
const clip = (id: string, extra: Box = {}): Box => ({ id, lane: 'seq', ...extra });
/** A free-floating overlay (timed, but off the magnetic row). */
const overlay = (id: string, start: number, extra: Box = {}): Box => ({ id, lane: '', start, ...extra });
/** Scenery - never timed, invisible to every function in the module. */
const scenery = (id: string, extra: Box = {}): Box => ({ id, lane: '', start: '', ...extra });

const byId = (boxes: Box[], id: string): Box => boxes[indexOfId(boxes, cfg, id)]!;
const startsOf = (boxes: Box[]): unknown[] => boxes.map((b) => b.start);

// ── 1. readers ─────────────────────────────────────────────────────────────────

test('boxTiming: reads seconds, tolerates stringy fields, distinguishes authored 0 from empty', () => {
  const t = boxTiming({ start: '2.5', dur: '3', clipIn: '1.25', speed: '2', lane: 'seq' }, cfg);
  assert.deepEqual(t, { start: 2.5, dur: 3, clipIn: 1.25, speed: 2, lane: 'seq' });

  // start:0 is "enters at the top"; start:'' is scenery. These must never collapse.
  assert.equal(boxTiming({ start: 0 }, cfg).start, 0);
  assert.equal(boxTiming({ start: '' }, cfg).start, null);
  assert.equal(boxTiming({}, cfg).start, null);
  assert.equal(boxTiming(undefined, cfg).start, null);

  // Defaults for the non-nullable pair.
  assert.equal(boxTiming({}, cfg).clipIn, 0);
  assert.equal(boxTiming({}, cfg).speed, 1);
  assert.equal(boxTiming({}, cfg).lane, '');
});

test('boxTiming: clamps every field into the phase-1 range', () => {
  const hot = boxTiming({ start: 1e9, dur: 1e9, clipIn: -5, speed: 99 }, cfg);
  assert.equal(hot.start, MAX_TIME_S);
  assert.equal(hot.dur, MAX_TIME_S);
  assert.equal(hot.clipIn, 0);
  assert.equal(hot.speed, 4);
  assert.equal(boxTiming({ dur: 0.0001, speed: 0.01 }, cfg).dur, MIN_DUR);
  assert.equal(boxTiming({ speed: 0.01 }, cfg).speed, 0.25);
  // Float noise off a slider must not survive into the model.
  assert.equal(boxTiming({ speed: 0.30000000000000004 }, cfg).speed, 0.3);
});

test('boxTiming: lane is only ever "" or "seq" - any other value is an overlay', () => {
  assert.equal(boxTiming({ lane: 'seq' }, cfg).lane, 'seq');
  assert.equal(boxTiming({ lane: 'SEQ' }, cfg).lane, '');
  assert.equal(boxTiming({ lane: 'constructor' }, cfg).lane, '');
  assert.equal(boxTiming({ lane: {} as never }, cfg).lane, '');
});

test('isTimed: seq lane OR a finite start; scenery is neither', () => {
  assert.equal(isTimed(clip('a'), cfg), true);
  assert.equal(isTimed(overlay('b', 0), cfg), true);
  assert.equal(isTimed(scenery('c'), cfg), false);
  assert.equal(isTimed({ id: 'd' }, cfg), false);
});

test('seqBoxes: seq lane only, ordered by start with ties broken by array index', () => {
  const boxes = [
    clip('c', { start: 2, dur: 1 }),
    overlay('ov', 0.5),
    clip('a', { start: 0, dur: 1 }),
    clip('b1', { start: 1, dur: 1 }),
    clip('b2', { start: 1, dur: 1 }),   // tie with b1 → array order decides
    scenery('sc'),
  ];
  assert.deepEqual(seqBoxes(boxes, cfg).map((b) => b.id), ['a', 'b1', 'b2', 'c']);
});

test('seqBoxes: an unpacked clip (no start) parks at the END of the row', () => {
  const boxes = [clip('fresh'), clip('a', { start: 0, dur: 1 }), clip('b', { start: 1, dur: 1 })];
  assert.deepEqual(seqBoxes(boxes, cfg).map((b) => b.id), ['a', 'b', 'fresh']);
});

test('indexOfId: exact id match, string-coerced; empty/absent ids never match', () => {
  const boxes: Box[] = [{ id: 3 }, { id: 'x' }, { id: '' }, {}];
  assert.equal(indexOfId(boxes, cfg, '3'), 0);
  assert.equal(indexOfId(boxes, cfg, 'x'), 1);
  assert.equal(indexOfId(boxes, cfg, ''), -1);
  assert.equal(indexOfId(boxes, cfg, 'nope'), -1);
});

// ── 2. deriveDuration - parity with the hook ───────────────────────────────────

test('deriveDuration: hand-computed cases (milliseconds, matching data-seq-ms)', () => {
  // Nothing timed at all.
  assert.equal(deriveDuration([scenery('a'), scenery('b')], cfg), 0);
  assert.equal(deriveDuration([], cfg), 0);
  // Timed, but nothing carries a duration → the 5 s fallback.
  assert.equal(deriveDuration([clip('a'), overlay('b', 1)], cfg), DEFAULT_SEQ_S * 1000);
  // max(start + dur) wins, whichever lane it is on.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2.5 }), clip('b', { start: 2.5, dur: 3 })], cfg), 5500);
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2 }), overlay('ov', 4, { dur: 2.4 })], cfg), 6400);
  // dur is TIMELINE seconds - speed must never scale it.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 4, speed: 2 })], cfg), 4000);
  // A single open-ended clip alongside a measured one does not extend the length.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2 }), clip('b', { start: 2 })], cfg), 2000);
});

test('deriveDuration: byte-identical to design hooks.js seqDurationMs', () => {
  // Load the REAL hook off disk and lift its internal seqDurationMs out. community/
  // is the public pack (brands/suse is a private, CI-skipped submodule).
  const hooksPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'design', 'hooks.js');
  const src = readFileSync(hooksPath, 'utf8');
  const seqDurationMs = new Function('host', `${src}\n;return seqDurationMs;`)(
    { log: () => {} },
  ) as (boxes: unknown[]) => number;

  const cases: Box[][] = [
    [],
    [scenery('s')],
    [clip('a')],
    [overlay('o', 3)],
    [clip('a', { start: 0, dur: 2.5 }), clip('b', { start: 2.5, dur: 3 }), overlay('o', 2.7, { dur: 2.4 })],
    [clip('a', { start: 0, dur: 4, speed: 2 }), clip('b', { start: 4 })],
    // Hostile / out-of-range values must clamp the same way on both sides.
    [clip('a', { start: 1e9, dur: 1e9 })],
    [clip('a', { start: -5, dur: 0.001 })],
    [clip('a', { start: '2', dur: '1.5' })],
    [{ id: 'weird', lane: 'seq', start: 'abc', dur: 'nope' }],
    [{ id: 'n', lane: 'seq', start: null as never, dur: undefined }],
    [overlay('o', 0.5, { dur: 0.25 }), scenery('s'), clip('c')],
  ];
  for (const boxes of cases) {
    assert.equal(deriveDuration(boxes, cfg), seqDurationMs(boxes),
      `deriveDuration parity for ${JSON.stringify(boxes)}`);
  }
});

test('design hooks.js: an ignored seq clip is compressed out of the played sequence (plans/174)', () => {
  const hooksPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'community', 'design', 'hooks.js');
  const src = readFileSync(hooksPath, 'utf8');
  const api = new Function('host', `${src}\n;return { seqDurationMs, timeAttrsFor, ignoredSeqSpans };`)(
    { log: () => {} },
  ) as {
    seqDurationMs: (b: unknown[]) => number;
    timeAttrsFor: (b: unknown, spans: unknown[]) => string;
    ignoredSeqSpans: (b: unknown[]) => unknown[];
  };

  // A[0,2] B[2,2] C[4,2] on the seq lane; B is struck. The played/exported sequence is
  // 4s (B removed), and C rides earlier by B's 2s. The RULER (deriveDuration) still reads
  // the full 6s - that divergence is the whole point of non-destructive ignore.
  const boxes: Box[] = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 2, ignored: true }),
    clip('c', { start: 4, dur: 2 }),
  ];
  assert.equal(api.seqDurationMs(boxes), 4000, 'B (2s) drops out of the played length');
  assert.equal(deriveDuration(boxes, cfg), 6000, 'the ruler still spans the full authored length');

  const spans = api.ignoredSeqSpans(boxes);
  assert.match(api.timeAttrsFor(boxes[0], spans), /data-t-start="0"/);            // A: nothing before it
  assert.match(api.timeAttrsFor(boxes[1], spans), /data-t-ignored="1"/);          // B: the skip marker
  assert.match(api.timeAttrsFor(boxes[2], spans), /data-t-start="2000"/);         // C: rides earlier by 2s
});

// ── 3. packSeq ─────────────────────────────────────────────────────────────────

test('packSeq: seq clips become gapless from 0; overlays and scenery are untouched', () => {
  const before = [
    clip('a', { start: 5, dur: 2 }),
    overlay('ov', 1.5, { dur: 1 }),
    clip('b', { start: 9, dur: 3 }),
    scenery('sc'),
  ];
  const after = packSeq(before, cfg);
  assert.notEqual(after, before, 'returns a NEW array');
  assert.equal(byId(after, 'a').start, 0);
  assert.equal(byId(after, 'b').start, 2);
  assert.equal(byId(after, 'b').dur, 3);
  // Untouched rows keep object identity.
  assert.equal(byId(after, 'ov'), before[1]);
  assert.equal(byId(after, 'sc'), before[3]);
});

test('packSeq: a null-dur clip takes its media length, or DEFAULT_CLIP_S when unknown', () => {
  // Play order is a (start 0), c (start 99), b (unpacked → parked last).
  const boxes = [clip('a', { start: 0, dur: 1 }), clip('b'), clip('c', { start: 99 })];
  const blind = packSeq(boxes, cfg);
  assert.deepEqual(seqBoxes(blind, cfg).map((b) => b.id), ['a', 'c', 'b']);
  assert.equal(byId(blind, 'b').dur, DEFAULT_CLIP_S);
  assert.equal(byId(blind, 'c').dur, DEFAULT_CLIP_S);
  assert.equal(byId(blind, 'c').start, 1);
  assert.equal(byId(blind, 'b').start, 1 + DEFAULT_CLIP_S);
  // pack NEVER leaves a null dur on the seq row.
  for (const b of seqBoxes(blind, cfg)) assert.equal(typeof b.dur, 'number');

  const known = packSeq(boxes, cfg, (b) => (b.id === 'b' ? 7.5 : null));
  assert.equal(byId(known, 'b').dur, 7.5);
  assert.equal(byId(known, 'b').start, 4);
  // A nonsense media length falls back rather than poisoning the row.
  const junk = packSeq(boxes, cfg, () => Number.NaN);
  assert.equal(byId(junk, 'b').dur, DEFAULT_CLIP_S);
});

test('packSeq: idempotent - pack(pack(x)) deep-equals pack(x), and stops allocating', () => {
  const boxes = [clip('a', { start: 5, dur: 2 }), overlay('ov', 1), clip('b'), clip('c', { start: 1, dur: 0.4 })];
  const once = packSeq(boxes, cfg);
  const twice = packSeq(once, cfg);
  assert.deepEqual(twice, once);
  // Second pass changes nothing, so every row keeps identity.
  for (let i = 0; i < once.length; i++) assert.equal(twice[i], once[i], `row ${i} identity`);
});

test('packSeq: an empty / all-scenery board is a no-op that still returns a new array', () => {
  const boxes = [scenery('a'), scenery('b')];
  const after = packSeq(boxes, cfg);
  assert.notEqual(after, boxes);
  assert.deepEqual(after, boxes);
  assert.deepEqual(packSeq([], cfg), []);
});

// ── 4. moveSeqClip (reorder) ───────────────────────────────────────────────────

test('moveSeqClip: reorder first↔last, with an overlay anchored mid-row travelling along', () => {
  const before = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 3 }),
    clip('c', { start: 5, dur: 1 }),
    overlay('ov', 2.5, { dur: 0.5 }),   // sits inside b
  ];
  const after = moveSeqClip(before, cfg, 'a', 2);   // a → last
  assert.deepEqual(seqBoxes(after, cfg).map((b) => b.id), ['b', 'c', 'a']);
  assert.equal(byId(after, 'b').start, 0);
  assert.equal(byId(after, 'c').start, 3);
  assert.equal(byId(after, 'a').start, 4);
  // b moved 2 → 0, so the overlay anchored inside b moves with it: 2.5 → 0.5.
  assert.equal(byId(after, 'ov').start, 0.5);
  // Array (z) order is untouched - the row order lives in `start`, not in the array.
  assert.deepEqual(after.map((b) => b.id), ['a', 'b', 'c', 'ov']);
});

test('moveSeqClip: moving last→first ripples the other way', () => {
  const before = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 3 }),
    overlay('ov', 0.5),
  ];
  const after = moveSeqClip(before, cfg, 'b', 0);
  assert.deepEqual(seqBoxes(after, cfg).map((b) => b.id), ['b', 'a']);
  assert.equal(byId(after, 'b').start, 0);
  assert.equal(byId(after, 'a').start, 3);
  assert.equal(byId(after, 'ov').start, 3.5, 'overlay anchored in a follows a');
});

test('moveSeqClip: unknown id, out-of-range index, and no-op moves stay sane', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 1 })];
  const miss = moveSeqClip(before, cfg, 'nope', 0);
  assert.notEqual(miss, before);
  assert.deepEqual(miss, before);
  // Index is clamped into the row, never thrown.
  assert.deepEqual(seqBoxes(moveSeqClip(before, cfg, 'a', 99), cfg).map((b) => b.id), ['b', 'a']);
  assert.deepEqual(seqBoxes(moveSeqClip(before, cfg, 'b', -99), cfg).map((b) => b.id), ['b', 'a']);
  assert.deepEqual(seqBoxes(moveSeqClip(before, cfg, 'a', Number.NaN), cfg).map((b) => b.id), ['a', 'b']);
});

// ── 5. removeAndRipple ─────────────────────────────────────────────────────────

test('removeAndRipple: deleting a seq clip closes the gap and carries later overlays back', () => {
  const before = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 3 }),
    clip('c', { start: 5, dur: 1 }),
    overlay('ov', 5.5),   // anchored inside c
  ];
  const after = removeAndRipple(before, cfg, 'b');
  assert.equal(indexOfId(after, cfg, 'b'), -1);
  assert.equal(byId(after, 'a').start, 0);
  assert.equal(byId(after, 'c').start, 2);
  assert.equal(byId(after, 'ov').start, 2.5, 'c moved -3, so its overlay moved -3');
});

test('removeAndRipple: an overlay anchored inside the DELETED clip stays put', () => {
  const before = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 3 }),
    overlay('ov', 2.5),
  ];
  const after = removeAndRipple(before, cfg, 'b');
  assert.equal(byId(after, 'ov').start, 2.5);
});

test('removeAndRipple: deleting an overlay touches no timing; unknown id is a no-op copy', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 1 }), overlay('ov', 1)];
  const after = removeAndRipple(before, cfg, 'ov');
  assert.deepEqual(after.map((b) => b.id), ['a', 'b']);
  assert.equal(after[0], before[0], 'seq rows keep identity when an overlay goes');
  const miss = removeAndRipple(before, cfg, 'nope');
  assert.notEqual(miss, before);
  assert.deepEqual(miss, before);
});

// ── 6. trimClip ────────────────────────────────────────────────────────────────

test('trimClip in: start += d, dur -= d, clipIn += d * speed', () => {
  const before = [overlay('o', 2, { dur: 4, clipIn: 1, speed: 1 })];
  const after = trimClip(before, cfg, 'o', 'in', 0.5, null);
  assert.deepEqual(
    { start: byId(after, 'o').start, dur: byId(after, 'o').dur, clipIn: byId(after, 'o').clipIn },
    { start: 2.5, dur: 3.5, clipIn: 1.5 },
  );
});

test('trimClip in: clipIn advances by d * speed (the media out-point is invariant)', () => {
  const before = [overlay('o', 0, { dur: 4, clipIn: 0, speed: 2 })];
  const after = byId(trimClip(before, cfg, 'o', 'in', 1, null), 'o');
  assert.equal(after.start, 1);
  assert.equal(after.dur, 3);
  assert.equal(after.clipIn, 2);
  // out point before = 0 + 4*2 = 8; after = 2 + 3*2 = 8.
  assert.equal((after.clipIn as number) + (after.dur as number) * 2, 8);
});

test('trimClip in: dragging past the far edge clamps to MIN_DUR - never zero, never negative', () => {
  const before = [overlay('o', 0, { dur: 2, clipIn: 0 })];
  for (const d of [2, 5, 1e9, MAX_TIME_S * 10]) {
    const o = byId(trimClip(before, cfg, 'o', 'in', d, null), 'o');
    assert.equal(o.dur, MIN_DUR, `dur floor at delta ${d}`);
    assert.ok((o.dur as number) > 0);
    assert.equal(o.start, 1.9);
  }
});

test('trimClip in: dragging left clamps at clipIn 0 and start 0 (cannot invent source)', () => {
  const a = byId(trimClip([overlay('o', 10, { dur: 2, clipIn: 1, speed: 1 })], cfg, 'o', 'in', -5, null), 'o');
  assert.equal(a.clipIn, 0, 'stops when the source in-point hits the head of the file');
  assert.equal(a.start, 9);
  assert.equal(a.dur, 3);

  // speed 2 halves how far a given clipIn budget reaches on the timeline.
  const b = byId(trimClip([overlay('o', 10, { dur: 2, clipIn: 1, speed: 2 })], cfg, 'o', 'in', -5, null), 'o');
  assert.equal(b.clipIn, 0);
  assert.equal(b.start, 9.5);
  assert.equal(b.dur, 2.5);

  // With no source head left at all, a left drag does nothing.
  const c = byId(trimClip([overlay('o', 3, { dur: 2, clipIn: 0 })], cfg, 'o', 'in', -1, null), 'o');
  assert.deepEqual({ s: c.start, d: c.dur, ci: c.clipIn }, { s: 3, d: 2, ci: 0 });

  // A clip already at t=0 with source to spare still cannot go negative on the timeline.
  const e = byId(trimClip([overlay('o', 0, { dur: 2, clipIn: 5 })], cfg, 'o', 'in', -3, null), 'o');
  assert.equal(e.start, 0);
  assert.equal(e.dur, 2);
  assert.equal(e.clipIn, 5);
});

test('trimClip in: the t=0 bound is an OVERLAY rule - the first seq clip can give its head back', () => {
  // On the magnetic row `start` is re-derived by packOrder at the end of trimClip, so
  // "cannot go before t=0" constrains nothing there - except at index 0, where start
  // really is 0 and the bound used to pin the delta window shut. The result was that a
  // head trim on the FIRST clip was the one trim in a sequence that could never be
  // dragged back out, however much source was still sitting behind the in-point.
  const rows = [clip('a', { start: 0, dur: 3, clipIn: 2 }), clip('b', { start: 3, dur: 3, clipIn: 0 })];
  const a = byId(trimClip(rows, cfg, 'a', 'in', -1, null), 'a');
  assert.equal(a.clipIn, 1, 'a second of the source head came back');
  assert.equal(a.dur, 4, 'and the clip is a second longer for it');
  assert.equal(a.start, 0, 'the magnetic row still starts at zero');
  // The same clip at a non-zero start behaves identically - the fix removed a
  // special case, it did not add one.
  const b = byId(trimClip(rows, cfg, 'b', 'in', -1, null), 'b');
  assert.equal(b.clipIn, 0, 'b had no source head, so it is unchanged');
  assert.equal(b.dur, 3);
  // And the OVERLAY rule is untouched: t=0 is a real wall for a free-floating clip.
  const o = byId(trimClip([overlay('o', 0, { dur: 2, clipIn: 5 })], cfg, 'o', 'in', -3, null), 'o');
  assert.deepEqual({ s: o.start, d: o.dur, ci: o.clipIn }, { s: 0, d: 2, ci: 5 });
});

test('trimClip out: dur += d, floored at MIN_DUR', () => {
  const before = [overlay('o', 1, { dur: 2, clipIn: 0 })];
  assert.equal(byId(trimClip(before, cfg, 'o', 'out', 1.5, null), 'o').dur, 3.5);
  assert.equal(byId(trimClip(before, cfg, 'o', 'out', -5, null), 'o').dur, MIN_DUR);
  assert.equal(byId(trimClip(before, cfg, 'o', 'out', 0, null), 'o').start, 1, 'start never moves on an out-trim');
});

test('trimClip out: clamps to the end of the media when the length is known', () => {
  // 10 s file, already 2 s in, played at 1× → at most 8 s of timeline left.
  const before = [overlay('o', 0, { dur: 3, clipIn: 2, speed: 1 })];
  assert.equal(byId(trimClip(before, cfg, 'o', 'out', 99, 10), 'o').dur, 8);
  // At 2× the same 8 s of media is only 4 s of timeline.
  const fast = [overlay('o', 0, { dur: 3, clipIn: 2, speed: 2 })];
  assert.equal(byId(trimClip(fast, cfg, 'o', 'out', 99, 10), 'o').dur, 4);
  // A clip already past the end of its media gets pulled back inside it.
  const over = [overlay('o', 0, { dur: 30, clipIn: 2, speed: 1 })];
  assert.equal(byId(trimClip(over, cfg, 'o', 'out', 0, 10), 'o').dur, 8);
  // Media shorter than MIN_DUR still leaves a legal clip.
  const tiny = [overlay('o', 0, { dur: 1, clipIn: 0 })];
  assert.equal(byId(trimClip(tiny, cfg, 'o', 'out', 99, 0.02), 'o').dur, MIN_DUR);
});

test('trimClip in: a trim-in never pushes the out-point past the end of the media', () => {
  const before = [overlay('o', 0, { dur: 4, clipIn: 0, speed: 1 })];
  const o = byId(trimClip(before, cfg, 'o', 'in', 1, 4), 'o');
  assert.ok((o.clipIn as number) + (o.dur as number) * 1 <= 4 + 1e-9, 'out point stays inside the file');
  assert.equal(o.clipIn, 1);
  assert.equal(o.dur, 3);
});

test('trimClip on the seq lane: the row repacks gapless and overlays ripple with it', () => {
  const before = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 3 }),
    overlay('ov', 2.5),
  ];
  // Trim a's OUT edge shorter: b (and the overlay anchored in it) slide left.
  const shorter = trimClip(before, cfg, 'a', 'out', -1, null);
  assert.equal(byId(shorter, 'a').dur, 1);
  assert.equal(byId(shorter, 'b').start, 1, 'row stays gapless');
  assert.equal(byId(shorter, 'ov').start, 1.5, 'overlay travelled with b');

  // Trim b's IN edge: b shortens, a is unmoved, the row stays gapless from 0.
  const trimmedIn = trimClip(before, cfg, 'b', 'in', 1, null);
  assert.equal(byId(trimmedIn, 'a').start, 0);
  assert.equal(byId(trimmedIn, 'b').start, 2, 'repacked back against a, not left at 3');
  assert.equal(byId(trimmedIn, 'b').dur, 2);
  assert.equal(byId(trimmedIn, 'b').clipIn, 1);
});

test('trimClip: a trim-in that would reorder the magnetic row does not reorder it', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 3 })];
  // Push a's in-point almost to its end: a is momentarily "later" than b, but the
  // row order was captured before the trim, so a stays first.
  const after = trimClip(before, cfg, 'a', 'in', 1.9, null);
  assert.deepEqual(seqBoxes(after, cfg).map((b) => b.id), ['a', 'b']);
  assert.equal(byId(after, 'a').start, 0);
  assert.equal(byId(after, 'a').dur, MIN_DUR);
  assert.equal(byId(after, 'b').start, MIN_DUR);
});

test('trimClip: open-ended and unknown clips are handled without inventing NaN', () => {
  const openEnded = [overlay('o', 1, { clipIn: 0 })];               // no dur
  const o = byId(trimClip(openEnded, cfg, 'o', 'out', 1, null), 'o');
  assert.equal(o.dur, DEFAULT_CLIP_S + 1);
  const known = byId(trimClip(openEnded, cfg, 'o', 'out', 0, 6), 'o');
  assert.equal(known.dur, 6, 'media length becomes the working duration');

  const miss = trimClip(openEnded, cfg, 'nope', 'in', 1, null);
  assert.notEqual(miss, openEnded);
  assert.deepEqual(miss, openEnded);
});

// ── 6b. trimClips - one edge, the whole selection ──────────────────────────────

test('trimClips out: every selected clip grows by the same delta, the rest are untouched', () => {
  const before = [overlay('o', 1, { dur: 2 }), overlay('p', 4, { dur: 1 }), overlay('q', 8, { dur: 3 })];
  const after = trimClips(before, cfg, ['o', 'p'], 'out', 1.5, () => null);
  assert.equal(byId(after, 'o').dur, 3.5);
  assert.equal(byId(after, 'p').dur, 2.5);
  assert.equal(byId(after, 'q').dur, 3, 'not selected, so not trimmed');
  assert.equal(byId(after, 'o').start, 1, 'an out-trim never moves a start');
  assert.equal(byId(after, 'p').start, 4);
});

test('trimClips in: each head moves by the delta and consumes its own source', () => {
  const before = [overlay('o', 2, { dur: 3, clipIn: 0, speed: 1 }), overlay('p', 5, { dur: 3, clipIn: 1, speed: 2 })];
  const after = trimClips(before, cfg, ['o', 'p'], 'in', 0.5, () => null);
  const o = byId(after, 'o'), p = byId(after, 'p');
  assert.equal(o.start, 2.5); assert.equal(o.dur, 2.5); assert.equal(o.clipIn, 0.5);
  assert.equal(p.start, 5.5); assert.equal(p.dur, 2.5); assert.equal(p.clipIn, 2, 'd × speed, like trimClip');
});

test('trimClips clamps PER CLIP: the one that runs out of file stops, the others keep going', () => {
  // o has 1s of headroom (3s source behind a 2s clip); p is a card with no source at all.
  const before = [overlay('o', 0, { dur: 2, clipIn: 0 }), overlay('p', 5, { dur: 2 })];
  const media = (id: string): number | null => (id === 'o' ? 3 : null);
  const after = trimClips(before, cfg, ['o', 'p'], 'out', 4, media);
  assert.equal(byId(after, 'o').dur, 3, 'held at the end of its source');
  assert.equal(byId(after, 'p').dur, 6, 'unconstrained, so it took the whole delta');
  // And the floor is per clip too: shrinking past MIN_DUR stops each at MIN_DUR.
  const floored = trimClips(before, cfg, ['o', 'p'], 'out', -9, media);
  assert.equal(byId(floored, 'o').dur, MIN_DUR);
  assert.equal(byId(floored, 'p').dur, MIN_DUR);
});

test('trimClips on the magnetic row: both clips shorten and the row stays gapless', () => {
  const before = [clip('a', { start: 0, dur: 3 }), clip('b', { start: 3, dur: 2 }), clip('c', { start: 5, dur: 4 }), overlay('o', 5.5, { dur: 1 })];
  const after = trimClips(before, cfg, ['a', 'b'], 'out', -1, () => null);
  assert.deepEqual(seqBoxes(after, cfg).map((b) => [b.id, b.start, b.dur]), [['a', 0, 2], ['b', 2, 1], ['c', 3, 4]]);
  assert.equal(byId(after, 'o').start, 3.5, 'the overlay anchored inside c rippled with it');
  // The same edge on the in side: both heads come off the source, starts repack from 0.
  const heads = trimClips(before, cfg, ['b', 'c'], 'in', 1, () => null);
  assert.deepEqual(seqBoxes(heads, cfg).map((b) => [b.id, b.start, b.dur, b.clipIn ?? 0]), [['a', 0, 3, 0], ['b', 3, 1, 1], ['c', 4, 3, 1]]);
});

test('trimClips skips ids that are not timed rows, and one id is exactly trimClip', () => {
  const before = [overlay('o', 1, { dur: 2 }), scenery('s'), overlay('p', 4, { dur: 1 })];
  const after = trimClips(before, cfg, ['o', 's', 'ghost'], 'out', 1, () => null);
  assert.equal(byId(after, 'o').dur, 3);
  assert.deepEqual(byId(after, 's'), scenery('s'), 'scenery is never given timing by a trim');
  assert.equal(byId(after, 'p').dur, 1);
  assert.deepEqual(trimClips(before, cfg, ['o'], 'in', 0.5, () => null), trimClip(before, cfg, 'o', 'in', 0.5, null));
  // Nothing eligible: a fresh copy, unchanged.
  const none = trimClips(before, cfg, ['s', 'ghost'], 'out', 1, () => null);
  assert.notEqual(none, before);
  assert.deepEqual(none, before);
});

// ── 7. splitBox ────────────────────────────────────────────────────────────────

let minted = 0;
const mintId = (): string => `new-${++minted}`;

test('splitBox: halves sum to the original, B follows A in array order, transitions go outward', () => {
  minted = 0;
  const before = [
    { id: 'x', lane: 'seq', start: 1, dur: 4, clipIn: 0, speed: 1, enter: 'rise', exit: 'fade' } as Box,
    scenery('sc'),
  ];
  const after = splitBox(before, cfg, 'x', 3, mintId)!;
  assert.ok(after, 'split inside the clip succeeds');
  assert.deepEqual(after.map((b) => b.id), ['x', 'new-1', 'sc'], 'B inserted immediately after A (z preserved)');

  const a = byId(after, 'x'), b = byId(after, 'new-1');
  assert.deepEqual({ s: a.start, d: a.dur }, { s: 1, d: 2 });
  assert.deepEqual({ s: b.start, d: b.dur }, { s: 3, d: 2 });
  assert.equal((a.dur as number) + (b.dur as number), 4, 'durations sum unchanged - the seq row needs no repack');
  // Transitions belong to the OUTER edges of the original clip.
  assert.equal(a.enter, 'rise');
  assert.equal(a.exit, 'none');
  assert.equal(b.enter, 'none');
  assert.equal(b.exit, 'fade');
  // The original array is untouched.
  assert.equal(before.length, 2);
  assert.equal(before[0]!.dur, 4);
});

test('splitBox: clipIn of the second half advances by (t - start) * speed', () => {
  minted = 0;
  const before = [clip('x', { start: 0, dur: 4, clipIn: 1, speed: 2 })];
  const after = splitBox(before, cfg, 'x', 1.5, mintId)!;
  assert.equal(byId(after, 'new-1').clipIn, 1 + 1.5 * 2);
  // …and at speed 0.5.
  minted = 0;
  const slow = splitBox([clip('y', { start: 2, dur: 4, clipIn: 0.5, speed: 0.5 })], cfg, 'y', 4, mintId)!;
  assert.equal(byId(slow, 'new-1').clipIn, 0.5 + 2 * 0.5);
});

test('splitBox: returns null at or outside the MIN_DUR boundaries', () => {
  const before = [clip('x', { start: 1, dur: 4 })];   // spans 1..5
  for (const t of [1, 5, 0, 6, 1 + MIN_DUR, 5 - MIN_DUR, -1, MAX_TIME_S * 2]) {
    assert.equal(splitBox(before, cfg, 'x', t, mintId), null, `split at exactly ${t} is refused`);
  }
  // Just inside is allowed.
  assert.ok(splitBox(before, cfg, 'x', 1 + MIN_DUR + 0.001, mintId));
  assert.ok(splitBox(before, cfg, 'x', 5 - MIN_DUR - 0.001, mintId));
});

test('splitBox: refuses an open-ended clip, an unknown id, and a non-finite t', () => {
  assert.equal(splitBox([clip('x', { start: 0 })], cfg, 'x', 1, mintId), null);
  assert.equal(splitBox([clip('x', { start: 0, dur: 4 })], cfg, 'nope', 1, mintId), null);
  assert.equal(splitBox([clip('x', { start: 0, dur: 4 })], cfg, 'x', Number.NaN, mintId), null);
  assert.equal(splitBox([clip('x', { start: 0, dur: 4 })], cfg, 'x', Number.POSITIVE_INFINITY, mintId), null);
  assert.equal(splitBox([clip('x', { start: 0, dur: 4 })], cfg, 'x', 'abc' as never, mintId), null);
});

test('splitBox: an open-ended clip splits against the sequence end when totalSec is given', () => {
  minted = 0;
  // Open-ended from 1s in a 6s sequence, playing at 2x from clipIn 0.5.
  const before = [clip('x', { start: 1, dur: '', clipIn: 0.5, speed: 2 })];
  const after = splitBox(before, cfg, 'x', 3, mintId, 6)!;
  assert.ok(after, 'the open-ended clip splits once its end is resolvable');
  const [a, b] = after;
  assert.equal(a!.dur, 2, 'the left half gets the authored span up to the cut');
  assert.equal(b!.start, 3, 'the right half starts at the cut');
  assert.equal(b!.dur, '', 'the right half stays OPEN-ENDED - it keeps following the sequence end');
  assert.equal(b!.clipIn, 0.5 + 2 * 2, 'its in-point advances by the media the left half consumed');
  // The MIN_DUR guard works against the RESOLVED end: a cut just shy of 6s is refused.
  assert.equal(splitBox(before, cfg, 'x', 5.95, mintId, 6), null);
  // No total, or a total the clip starts at/after: the old refusal stands.
  assert.equal(splitBox(before, cfg, 'x', 3, mintId), null);
  assert.equal(splitBox(before, cfg, 'x', 3, mintId, 1), null);
});

test('splitAll: totalSec lets the open-ended clip join the cut instead of being skipped', () => {
  minted = 0;
  const before = [overlay('open', 0, { dur: '' }), overlay('ok', 0, { dur: 4 })];
  const r = splitAll(before, cfg, ['open', 'ok'], 2, mintId, 6);
  assert.deepEqual(r.skipped, [], 'nothing refused once the end is resolvable');
  assert.equal(r.split.length, 2, 'both clips split');
  assert.equal(byId(r.next, 'open').dur, 2, 'the open left half is authored to the cut');
});

test('splitBox: splitting a seq clip leaves the row gapless without a repack', () => {
  minted = 0;
  const before = [clip('a', { start: 0, dur: 4 }), clip('b', { start: 4, dur: 2 })];
  const after = splitBox(before, cfg, 'a', 1.5, mintId)!;
  assert.deepEqual(seqBoxes(after, cfg).map((b) => b.id), ['a', 'new-1', 'b']);
  assert.deepEqual(packSeq(after, cfg).map((b) => b.start), startsOf(after), 'already packed');
});

// ── 8. rippleOverlays (the rule itself, half-open) ─────────────────────────────

test('rippleOverlays: an overlay exactly at a clip\'s OLD END is NOT anchored to it', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 2 }), overlay('ov', 2)];
  // Lengthen a: b (and anything anchored in b) shifts +1. The overlay sits exactly on
  // a's old end - half-open [0,2) excludes it, so it belongs to b and moves with b.
  const after = trimClip(before, cfg, 'a', 'out', 1, null);
  assert.equal(byId(after, 'b').start, 3);
  assert.equal(byId(after, 'ov').start, 3, 'anchored to b (its start), not to a (its end)');
});

test('rippleOverlays: an overlay exactly at a clip\'s OLD START is anchored to that clip', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 2 }), overlay('ov', 0)];
  const after = moveSeqClip(before, cfg, 'a', 1);   // a → after b
  assert.equal(byId(after, 'a').start, 2);
  assert.equal(byId(after, 'ov').start, 2, 'travelled with a');
});

test('rippleOverlays: never moves seq clips, scenery, or overlays outside every span', () => {
  const before = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 2 }), overlay('far', 50), scenery('sc')];
  const after = trimClip(before, cfg, 'a', 'out', 1, null);
  assert.equal(byId(after, 'far').start, 50, 'past the end of the row - nothing to anchor to');
  assert.equal(byId(after, 'sc'), before[3], 'scenery keeps identity');
});

test('rippleOverlays: a zero-delta repack allocates nothing new for the overlays', () => {
  const boxes = [clip('a', { start: 0, dur: 2 }), overlay('ov', 1)];
  const after = rippleOverlays(boxes, packSeq(boxes, cfg), cfg);
  assert.equal(byId(after, 'ov'), boxes[1]);
});

// ── 9. snapTime ────────────────────────────────────────────────────────────────

test('snapTime: picks the NEAREST candidate inside the pixel threshold', () => {
  // 100 px/s, 6 px → 0.06 s of tolerance.
  const c = [0, 1, 2, 3];
  assert.deepEqual(snapTime(1.03, c, 100), { t: 1, snapped: 1 });
  assert.deepEqual(snapTime(1.5, c, 100), { t: 1.5, snapped: null });
  // Two candidates in range → the closer one wins, whichever side it is on.
  assert.deepEqual(snapTime(1.02, [1, 1.05], 200), { t: 1, snapped: 1 });
  assert.deepEqual(snapTime(1.04, [1, 1.05], 200), { t: 1.05, snapped: 1.05 });
});

test('snapTime: the threshold is SCREEN space, so zoom changes what snaps', () => {
  const c = [2];
  assert.deepEqual(snapTime(2.5, c, 10), { t: 2, snapped: 2 }, 'zoomed out, 0.5 s is inside 6 px');
  assert.deepEqual(snapTime(2.5, c, 1000), { t: 2.5, snapped: null }, 'zoomed in, 0.5 s is 500 px away');
  // A wider explicit threshold catches more.
  assert.deepEqual(snapTime(2.5, c, 10, 1), { t: 2.5, snapped: null });
  assert.deepEqual(snapTime(2.05, c, 10, 1), { t: 2, snapped: 2 });
  assert.equal(SNAP_PX, 6);
});

test('snapTime: degenerate zoom/threshold/candidates never snap and never NaN', () => {
  assert.deepEqual(snapTime(1.5, [1], 0), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(1.5, [1], -100), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(1.5, [1], Number.NaN), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(1.5, [1], 100, 0), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(1.5, [], 100), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(1.5, null as never, 100), { t: 1.5, snapped: null });
  assert.deepEqual(snapTime(Number.NaN, [1], 100), { t: 0, snapped: null });
  assert.deepEqual(snapTime(1.001, [Number.NaN, null, 'x', 1] as never, 100), { t: 1, snapped: 1 });
});

// ── 10. fmtTime ────────────────────────────────────────────────────────────────

test('fmtTime: m:ss.d, growing to h:mm:ss.d past an hour', () => {
  assert.equal(fmtTime(0), '0:00.0');
  assert.equal(fmtTime(0.05), '0:00.1');
  assert.equal(fmtTime(9.4), '0:09.4');
  assert.equal(fmtTime(65.25), '1:05.3');
  assert.equal(fmtTime(600), '10:00.0');
  assert.equal(fmtTime(3600), '1:00:00.0');
  assert.equal(fmtTime(3725.6), '1:02:05.6');
  assert.equal(fmtTime(36000), '10:00:00.0');
});

test('fmtTime: rounds to tenths BEFORE splitting, so 59.99 carries into the minute', () => {
  assert.equal(fmtTime(59.99), '1:00.0');
  assert.equal(fmtTime(3599.99), '1:00:00.0');
});

test('fmtTime: hostile input degrades to 0:00.0, negatives carry a sign', () => {
  assert.equal(fmtTime(Number.NaN), '0:00.0');
  assert.equal(fmtTime(Number.POSITIVE_INFINITY), '0:00.0');
  assert.equal(fmtTime(undefined as never), '0:00.0');
  assert.equal(fmtTime(null as never), '0:00.0');
  assert.equal(fmtTime('abc' as never), '0:00.0');
  assert.equal(fmtTime('2.5' as never), '0:02.5');
  assert.equal(fmtTime(-0.04), '0:00.0', 'a negative that rounds to zero has no sign');
  assert.equal(fmtTime(-1.5), '-0:01.5');
});

// ── 10b. the trim readout's formatters, and the edge-zone cap ──────────────────

test('fmtDur: one decimal under 10s, whole seconds to a minute, m:ss beyond', () => {
  assert.equal(fmtDur(0), '0.0s');
  assert.equal(fmtDur(0.04), '0.0s');
  assert.equal(fmtDur(0.6), '0.6s');
  assert.equal(fmtDur(4.24), '4.2s');
  assert.equal(fmtDur(9.9), '9.9s');
  // The band is picked from the ROUNDED value, so 9.96 is not printed as "10.0s".
  assert.equal(fmtDur(9.96), '10s');
  assert.equal(fmtDur(10), '10s', 'exactly ten seconds is the first whole-second reading');
  assert.equal(fmtDur(12.4), '12s');
  assert.equal(fmtDur(59.4), '59s');
  assert.equal(fmtDur(59.9), '1:00', 'and 59.9 carries into the minute rather than reading "60s"');
  assert.equal(fmtDur(60), '1:00', 'exactly a minute is the first m:ss reading');
  assert.equal(fmtDur(65.25), '1:05');
  assert.equal(fmtDur(600), '10:00');
  assert.equal(fmtDur(3725.6), '1:02:06', 'past an hour it inherits fmtTime’s hours field');
});

test('fmtDur: hostile input degrades to 0.0s, and a negative length carries a sign', () => {
  assert.equal(fmtDur(Number.NaN), '0.0s');
  assert.equal(fmtDur(Number.POSITIVE_INFINITY), '0.0s');
  assert.equal(fmtDur(undefined as never), '0.0s');
  assert.equal(fmtDur('2.5' as never), '2.5s');
  assert.equal(fmtDur(-1.5), '-1.5s');
});

test('fmtDelta: ASCII sign, one decimal under 10s, and no negative zero', () => {
  assert.equal(fmtDelta(0.6), '+0.6s');
  assert.equal(fmtDelta(-0.6), '-0.6s');
  assert.equal(fmtDelta(0), '+0.0s');
  assert.equal(fmtDelta(-0.04), '+0.0s', 'a delta that rounds away is never "-0.0s"');
  assert.equal(fmtDelta(-0.05), '-0.1s');
  assert.equal(fmtDelta(12.4), '+12s');
  assert.equal(fmtDelta(-65), '-1:05');
  // The sign is the ASCII one a screen reader reads correctly, not U+2212.
  assert.ok(!/[−±]/.test(fmtDelta(-1)), 'no typographic minus');
});

test('edgeZonePx: never lets the two zones meet, and gives up entirely on a narrow bar', () => {
  // Below the floor there is no zone at all - the whole bar stays grabbable.
  assert.equal(edgeZonePx(0, 10), 0);
  assert.equal(edgeZonePx(27, 10), 0);
  assert.equal(edgeZonePx(MIN_TRIM_BAR_PX - 0.5, 10), 0, 'the floor is inclusive, and fractional widths respect it');
  // At and above the floor, a third of the bar is the ceiling.
  assert.equal(edgeZonePx(28, 10), 9);
  assert.equal(edgeZonePx(29, 10), 9);
  assert.equal(edgeZonePx(30, 10), 10);
  assert.equal(edgeZonePx(60, 10), 10);
  assert.equal(edgeZonePx(300, 10), 10);
  // A coarse pointer asks for more, and is still capped by the bar.
  assert.equal(edgeZonePx(30, 24), 10);
  assert.equal(edgeZonePx(300, 24), 24);
  // THE invariant: two zones can never cover the whole bar, at any width or base.
  for (const w of [0, 27, 28, 29, 30, 60, 300, 1000]) {
    for (const base of [10, 24]) {
      const zone = edgeZonePx(w, base);
      assert.ok(2 * zone < w || zone === 0, `two ${zone}px zones still leave body on a ${w}px bar`);
    }
  }
  // Hostile input is a refusal, never a NaN width.
  assert.equal(edgeZonePx(Number.NaN, 10), 0);
  assert.equal(edgeZonePx(100, Number.NaN), 0);
  assert.equal(edgeZonePx(100, 0), 0);
});

// ── 11. hostile input ──────────────────────────────────────────────────────────

test('hostile input: no mutator throws, and none writes NaN into a time field', () => {
  const nasty: Box[] = [
    { id: 'a', lane: 'seq', start: 'abc', dur: {} as never, clipIn: [] as never, speed: null as never },
    { id: 'b', lane: 'seq', start: Number.NaN, dur: Number.POSITIVE_INFINITY },
    { id: 'c', lane: 'seq', start: undefined, dur: undefined },
    { id: 'd', lane: 'seq' as never, start: -1e12, dur: 1e12, clipIn: 1e12, speed: -3 },
    { id: 'e', start: '0', dur: 'NaN' },
    {} as Box,
    null as never,
  ];
  const results: Box[][] = [
    packSeq(nasty, cfg),
    moveSeqClip(nasty, cfg, 'a', 3),
    moveSeqClip(nasty, cfg, 'd', 0),
    removeAndRipple(nasty, cfg, 'b'),
    removeAndRipple(nasty, cfg, 'e'),
    trimClip(nasty, cfg, 'a', 'in', Number.NaN, null),
    trimClip(nasty, cfg, 'a', 'in', 1e9, Number.NaN),
    trimClip(nasty, cfg, 'd', 'out', -1e9, -5),
    trimClip(nasty, cfg, 'e', 'out', 'x' as never, null),
    rippleOverlays(nasty, packSeq(nasty, cfg), cfg),
    splitBox(nasty, cfg, 'd', 1, mintId) ?? [],
  ];
  const numeric = [cfg.startField, cfg.durField, cfg.clipInField];
  for (const rows of results) {
    assert.ok(Array.isArray(rows));
    for (const row of rows) {
      if (!row) continue;
      // A field this module WROTE is finite. A hostile value it never touched passes
      // straight through unchanged - these functions rewrite timing, they do not
      // sanitise rows they had no reason to edit; boxTiming clamps on READ, which is
      // where the contract actually lives.
      const src = nasty.find((n) => n && n.id === row.id);
      for (const f of numeric) {
        const v = row[f];
        if (typeof v !== 'number' || Object.is(v, src?.[f])) continue;
        assert.ok(Number.isFinite(v), `${f}=${v} must be finite`);
        assert.ok(v >= 0 && v <= MAX_TIME_S, `${f}=${v} must be in range`);
      }
      // Every timing read off any produced row is finite too.
      const t = boxTiming(row, cfg);
      assert.ok(t.start === null || Number.isFinite(t.start));
      assert.ok(t.dur === null || Number.isFinite(t.dur));
      assert.ok(Number.isFinite(t.clipIn) && Number.isFinite(t.speed));
    }
  }
  // …and the derived duration off any of them is a finite, non-negative integer.
  for (const rows of results) {
    const ms = deriveDuration(rows, cfg);
    assert.ok(Number.isFinite(ms) && ms >= 0 && Number.isInteger(ms), `derived ${ms}`);
  }
});

test('hostile input: a lane value inherited from Object.prototype is never treated as seq', () => {
  // Object-literal whitelists leak Object.prototype keys; the lane test must be a
  // strict === 'seq', never a truthiness lookup.
  for (const lane of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty']) {
    const boxes = [{ id: 'x', lane, start: 1, dur: 1 } as Box];
    assert.equal(boxTiming(boxes[0], cfg).lane, '');
    assert.deepEqual(seqBoxes(boxes, cfg), []);
    assert.equal(packSeq(boxes, cfg)[0], boxes[0], 'not on the magnetic row, so pack leaves it alone');
  }
});

test('hostile input: a non-array boxes argument is tolerated by every reader and mutator', () => {
  const bad = null as never;
  assert.equal(deriveDuration(bad, cfg), 0);
  assert.deepEqual(seqBoxes(bad, cfg), []);
  assert.deepEqual(packSeq(bad, cfg), []);
  assert.deepEqual(moveSeqClip(bad, cfg, 'a', 0), []);
  assert.deepEqual(removeAndRipple(bad, cfg, 'a'), []);
  assert.deepEqual(trimClip(bad, cfg, 'a', 'in', 1, null), []);
  assert.equal(splitBox(bad, cfg, 'a', 1, mintId), null);
  assert.deepEqual(rippleOverlays(bad, bad, cfg), []);
  assert.equal(indexOfId(bad, cfg, 'a'), -1);
});

// ── 12. off-grid values (real probe durations, real playhead positions) ────────
//
// Every assertion above sits on the millisecond grid, which is exactly what hid the
// three rounding defects this section pins. A media duration comes from a probe
// (3.3335 s) and a split time comes from pointer-px ÷ pxPerSec - neither is ever a
// round number, so "the row is gapless" and "the halves sum" have to hold for
// arbitrary reals, not just for the fixtures a human types.

/** Adjacency error on the seq row: [index, expected start, actual start] per break. */
const seqBreaks = (rows: Box[]): number[][] => {
  const q = seqBoxes(rows, cfg);
  const bad: number[][] = [];
  for (let i = 1; i < q.length; i++) {
    const end = (q[i - 1]!.start as number) + (q[i - 1]!.dur as number);
    if (Math.abs(end - (q[i]!.start as number)) > 1e-9) bad.push([i, end, q[i]!.start as number]);
  }
  return bad;
};

test('packSeq: off-grid durations still land gapless, and packing stays idempotent', () => {
  // Durations as a real <video>/<audio> probe reports them.
  const rows = [
    clip('a', { dur: 3.3335 }), clip('b', { dur: 2.0005 }),
    clip('c', { dur: 1.4445 }), clip('d', { dur: 5.5555 }),
  ];
  const once = packSeq(rows, cfg);
  assert.deepEqual(seqBreaks(once), [], 'no 1 ms gap or overlap between neighbours');
  const twice = packSeq(once, cfg);
  assert.deepEqual(startsOf(twice), startsOf(once), 'pack is idempotent off-grid too');
  assert.deepEqual(twice.map((b) => b.dur), once.map((b) => b.dur));
  assert.equal(deriveDuration(twice, cfg), deriveDuration(once, cfg), 'derived length does not drift');
});

test('packSeq: a repeated off-grid duration accumulates no error down the row', () => {
  const rows = Array.from({ length: 6 }, (_, i) => clip(`x${i}`, { dur: 0.1111 }));
  const packed = packSeq(rows, cfg);
  assert.deepEqual(seqBreaks(packed), []);
  // Stored durations are the ones the cursor advanced by, so the last clip's end is
  // exactly 6 × the stored duration.
  const d = packed[0]!.dur as number;
  assert.equal(packed[5]!.start, Number(((d as number) * 5).toFixed(3)));
});

test('packSeq: the MAX_TIME_S ceiling truncates rather than stacking full clips', () => {
  const packed = packSeq([clip('a', { dur: 2000 }), clip('b', { dur: 2000 }), clip('c', { dur: 2000 })], cfg);
  assert.equal(byId(packed, 'a').start, 0);
  assert.equal(byId(packed, 'b').start, 2000);
  assert.equal((byId(packed, 'b').start as number) + (byId(packed, 'b').dur as number), MAX_TIME_S,
    'b is truncated at the ceiling instead of running past it');
  assert.equal(byId(packed, 'c').start, MAX_TIME_S);
  assert.equal(byId(packed, 'c').dur, MIN_DUR, 'the overflow clip collapses to the minimum, not its full length');
});

test('splitBox: an off-grid cut still produces complementary halves', () => {
  minted = 0;
  const before = [clip('a', { start: 0, dur: 4, clipIn: 0, speed: 1 }), clip('b', { start: 4, dur: 2 })];
  const after = splitBox(before, cfg, 'a', 1.0005, mintId)!;
  const a = byId(after, 'a'), b = byId(after, 'new-1');
  assert.equal((a.dur as number) + (b.dur as number), 4, 'halves sum to the original duration');
  assert.equal(b.start, (a.start as number) + (a.dur as number), 'B starts exactly where A ends');
  assert.deepEqual(seqBreaks(after), [], 'the seq row needs no repack after an off-grid split');
});

test('splitBox: off-grid cuts are complementary at every speed, and never mint a sliver', () => {
  for (const t of [1.0005, 2.33333, 3.14159, 0.10049, 3.8999]) {
    for (const speed of [0.25, 1, 2.5, 4]) {
      minted = 0;
      const before = [clip('a', { start: 0, dur: 4, clipIn: 1, speed })];
      const after = splitBox(before, cfg, 'a', t, mintId);
      if (!after) continue;                       // refused near the MIN_DUR guard
      const a = byId(after, 'a'), b = byId(after, 'new-1');
      assert.equal((a.dur as number) + (b.dur as number), 4, `sum holds at t=${t} speed=${speed}`);
      assert.ok((a.dur as number) >= MIN_DUR && (b.dur as number) >= MIN_DUR, 'no sub-minimum sliver');
      assert.equal(b.start, (a.start as number) + (a.dur as number));
    }
  }
});

test('trimClip in: an oversized drag can never park clipIn past the end of the media', () => {
  // 2 s file under a 4 s clip: dragging the in-edge almost to the out-edge must stop
  // at the file's end, not at the timeline's MIN_DUR.
  const o = byId(trimClip([overlay('o', 0, { dur: 4, clipIn: 0, speed: 1 })], cfg, 'o', 'in', 3.9, 2), 'o');
  assert.ok((o.clipIn as number) <= 2 - MIN_DUR * 1 + 1e-9, `clipIn ${o.clipIn} stays inside the 2 s file`);
  assert.ok((o.clipIn as number) + (o.dur as number) * 1 <= 2 + 1e-9, 'out point inside the file');

  // Same at 2×, where each timeline second consumes two of media.
  const fast = byId(trimClip([overlay('o', 0, { dur: 4, clipIn: 0, speed: 2 })], cfg, 'o', 'in', 2, 3), 'o');
  assert.ok((fast.clipIn as number) + (fast.dur as number) * 2 <= 3 + 1e-9, 'out point inside the 3 s file at 2×');

  // A clip that ALREADY overhangs its media is pulled back inside it by a no-op trim.
  const over = byId(trimClip([overlay('o', 0, { dur: 4, clipIn: 9, speed: 1 })], cfg, 'o', 'in', 0, 2), 'o');
  assert.ok((over.clipIn as number) <= 2 - MIN_DUR + 1e-9, 'a pre-violating clipIn is recovered, not preserved');
  assert.ok((over.clipIn as number) + (over.dur as number) <= 2 + 1e-9);

  // With no known media length the timeline guard is still the only stop.
  const free = byId(trimClip([overlay('o', 0, { dur: 4, clipIn: 0 })], cfg, 'o', 'in', 99, null), 'o');
  assert.equal(free.dur, MIN_DUR);
});

// ── moveOverlay ───────────────────────────────────────────────────────────────
// The seam the panel's drag and its Start field BOTH go through, so the two can never
// round or clamp differently (they did: the drag rounded inline and skipped MAX_TIME_S).

test('moveOverlay sets an absolute start, rounded to the ms grid and clamped to the range', () => {
  const rows = [overlay('o', 1, { dur: 2 }), clip('a', { dur: 3 })];
  assert.equal(byId(moveOverlay(rows, cfg, 'o', 4.25), 'o').start, 4.25);
  assert.equal(byId(moveOverlay(rows, cfg, 'o', -5), 'o').start, 0, 'never before the top');
  assert.equal(byId(moveOverlay(rows, cfg, 'o', 1e9), 'o').start, MAX_TIME_S, 'never past the ceiling');
  assert.equal(byId(moveOverlay(rows, cfg, 'o', 2.0004999), 'o').start, 2, 'snapped to the ms grid');
  assert.equal(byId(moveOverlay(rows, cfg, 'o', NaN), 'o').start, 0, 'junk reads as the top');
  assert.equal(byId(moveOverlay(rows, cfg, 'o', 4.25), 'o').dur, 2, 'a move never changes the length');
});

test('moveOverlay agrees with the drag path to the millisecond', () => {
  // Whatever route a time takes, the stored value is identical - this is the invariant
  // that stops a clip landing one frame off depending on how it was moved.
  for (const t of [0.0005, 1 / 3, 2.9999, 7.123456, 59.9995]) {
    const viaMove = byId(moveOverlay([overlay('o', 0)], cfg, 'o', t), 'o').start as number;
    const again = byId(moveOverlay([overlay('o', viaMove)], cfg, 'o', viaMove), 'o').start;
    assert.equal(again, viaMove, `idempotent at ${t}`);
    assert.equal(Math.round(viaMove * 1000), viaMove * 1000, `lands on the ms grid at ${t}`);
  }
});

test('moveOverlay refuses to write a seq clip, whose start the pack owns', () => {
  const rows = [clip('a', { dur: 3 }), clip('b', { dur: 2 })];
  const packed = packSeq(rows, cfg);
  const after = moveOverlay(packed, cfg, 'a', 12);
  assert.deepEqual(startsOf(after), startsOf(packed), 'unchanged - use moveSeqClip instead');
  // An unknown id is a no-op too, not a throw.
  assert.deepEqual(startsOf(moveOverlay(packed, cfg, 'nope', 5)), startsOf(packed));
});

// ── dropIndexAt ───────────────────────────────────────────────────────────────

test('dropIndexAt: crossing a clip MIDPOINT is what moves the drop index', () => {
  // Row: a 0-3, b 3-2 (3..5), c 5-2 (5..7). Midpoints 1.5, 4, 6.
  const rows = packSeq([clip('a', { dur: 3 }), clip('b', { dur: 2 }), clip('c', { dur: 2 })], cfg);
  assert.equal(dropIndexAt(rows, cfg, 0, 'c'), 0, 'before every midpoint → the front');
  assert.equal(dropIndexAt(rows, cfg, 1.49, 'c'), 0, 'just short of a\'s midpoint');
  assert.equal(dropIndexAt(rows, cfg, 1.51, 'c'), 1, 'just past a\'s midpoint');
  assert.equal(dropIndexAt(rows, cfg, 4.5, 'c'), 2, 'past b\'s midpoint too');
  assert.equal(dropIndexAt(rows, cfg, 999, 'c'), 2, 'past the end clamps to the last slot');
});

test('dropIndexAt: a clip does not displace itself', () => {
  const rows = packSeq([clip('a', { dur: 3 }), clip('b', { dur: 2 }), clip('c', { dur: 2 })], cfg);
  // Dragging `a` across its OWN midpoint must not advance the index - it is already there.
  assert.equal(dropIndexAt(rows, cfg, 1.6, 'a'), 0, 'own midpoint is not a crossing');
  assert.equal(dropIndexAt(rows, cfg, 4.5, 'a'), 1, 'crossing b DOES move it');
  assert.equal(dropIndexAt(rows, cfg, 6.5, 'a'), 2);
});

test('dropIndexAt: the index it reports is the index moveSeqClip acts on', () => {
  const rows = packSeq([clip('a', { dur: 3 }), clip('b', { dur: 2 }), clip('c', { dur: 2 })], cfg);
  const to = dropIndexAt(rows, cfg, 6.5, 'a');            // drag a to the end
  const after = moveSeqClip(rows, cfg, 'a', to);
  assert.deepEqual(seqBoxes(after, cfg).map((b) => b.id), ['b', 'c', 'a']);
  // And the preview index for "hasn't moved yet" really is the current index.
  assert.equal(dropIndexAt(rows, cfg, 0.1, 'a'), 0);
});

test('dropIndexAt tolerates an empty or overlay-only row', () => {
  assert.equal(dropIndexAt([], cfg, 5, 'x'), 0);
  assert.equal(dropIndexAt([overlay('o', 2, { dur: 1 })], cfg, 5, 'o'), 0, 'no seq row, no index');
});


// ── the absolute setters (what the inspector fields write) ────────────────────
//
// These exist because the inspector used to write clipIn and speed RAW, straight
// through patchBox, which bypassed the one invariant trimClip is built around:
// clipIn + dur x speed <= media. Violating it is unrecoverable at playback time - 
// the player seeks past the source duration and the bar plays nothing.

test('setDuration is ABSOLUTE: typing a length gives that length, whatever the clip was', () => {
  const rows = [clip('a', { start: 0, dur: 3, clipIn: 0, speed: 1 })];
  assert.equal(Number(setDuration(rows, cfg, 'a', 5, null)[0]!.dur), 5);
  assert.equal(Number(setDuration(rows, cfg, 'a', 0.5, null)[0]!.dur), 0.5);
  // The old delta shape read the field as `typed - (dur ?? 0)` and fell back to
  // DEFAULT_CLIP_S inside trimClip, so an OPEN-ENDED clip landed on 3 + typed.
  const open = [overlay('o', 2, { dur: '', clipIn: 0, speed: 1 })];
  assert.equal(Number(setDuration(open, cfg, 'o', 5, null)[0]!.dur), 5, 'not DEFAULT_CLIP_S + 5');
});

test('setDuration clamps to the media: a 2s source cannot back a 5s clip', () => {
  const rows = [clip('a', { start: 0, dur: 2, clipIn: 0, speed: 1 })];
  assert.equal(Number(setDuration(rows, cfg, 'a', 5, 2)[0]!.dur), 2);
  // ...and the in-point eats into what is left.
  const trimmed = [clip('a', { start: 0, dur: 1, clipIn: 0.5, speed: 1 })];
  assert.equal(Number(setDuration(trimmed, cfg, 'a', 5, 2)[0]!.dur), 1.5);
  assert.ok(Number(setDuration(rows, cfg, 'a', 0, 2)[0]!.dur) >= MIN_DUR, 'never below the floor');
});

test('setClipIn holds clipIn + dur x speed <= media by shortening dur, never overrunning', () => {
  const rows = [clip('a', { start: 0, dur: 4, clipIn: 0, speed: 1 })];
  const out = setClipIn(rows, cfg, 'a', 3.9, 4);
  const box = out[0]!;
  assert.ok(Number(box.clipIn) + Number(box.dur) * 1 <= 4 + 1e-9, `invariant held: ${box.clipIn} + ${box.dur} <= 4`);
  assert.ok(Number(box.dur) >= MIN_DUR);
  // Past the end of the file the in-point itself is pulled back inside it.
  const far = setClipIn(rows, cfg, 'a', 99, 4)[0]!;
  assert.ok(Number(far.clipIn) <= 4 - MIN_DUR, `clipIn stayed inside the source: ${far.clipIn}`);
  assert.equal(Number(setClipIn(rows, cfg, 'a', -5, 4)[0]!.clipIn), 0, 'never negative');
});

test('setSpeed clamps the rate AND compensates the length against the media', () => {
  const rows = [clip('a', { start: 0, dur: 4, clipIn: 0, speed: 1 })];
  const fast = setSpeed(rows, cfg, 'a', 4, 4)[0]!;
  assert.equal(Number(fast.speed), 4);
  // 4s of file at x4 is 1s of timeline - the old raw write left dur at 4 and the clip
  // played nothing for its last three seconds.
  assert.ok(Number(fast.clipIn) + Number(fast.dur) * 4 <= 4 + 1e-9, `invariant held: dur=${fast.dur}`);
  assert.equal(Number(setSpeed(rows, cfg, 'a', 99, null)[0]!.speed), 4, 'clamped to MAX_SPEED');
  assert.equal(Number(setSpeed(rows, cfg, 'a', 0, null)[0]!.speed), 0.25, 'clamped to MIN_SPEED');
});

test('the setters keep the seq row gapless and never materialise an open end', () => {
  const rows = [clip('a', { start: 0, dur: 3 }), clip('b', { start: 3, dur: 2 })];
  const out = setDuration(rows, cfg, 'a', 1, null);
  const seq = out.filter((b) => b!.lane === 'seq');
  assert.deepEqual(seq.map((b) => [b!.id, b!.start, b!.dur]), [['a', 0, 1], ['b', 1, 2]]);
  // An open-ended overlay edited only for its rate keeps its open end.
  const open = [overlay('o', 1, { dur: '', speed: 1 })];
  assert.equal(setSpeed(open, cfg, 'o', 2, null)[0]!.dur, '', 'still open-ended');
});

test('an unknown id is a no-op that still returns a fresh array', () => {
  const rows = [clip('a', { start: 0, dur: 3 })];
  for (const out of [setDuration(rows, cfg, 'zz', 5, null), setClipIn(rows, cfg, 'zz', 1, null), setSpeed(rows, cfg, 'zz', 2, null)]) {
    assert.deepEqual(out, rows);
    assert.notEqual(out, rows, 'callers may mutate what they get back');
  }
});

// ── 12. splitAll (one array, one undo step) ────────────────────────────────────

test('splitAll: three clips cut at one instant produce ONE array and three right halves', () => {
  minted = 0;
  // Three clips stacked on overlay lanes so a single instant is inside all of them.
  const before = [
    overlay('a', 0, { dur: 4 }),
    overlay('b', 0, { dur: 4 }),
    overlay('c', 0, { dur: 4 }),
  ];
  const r = splitAll(before, cfg, ['a', 'b', 'c'], 2, mintId);
  assert.deepEqual(r.skipped, []);
  assert.equal(r.split.length, 3, 'one minted right half per clip');
  assert.equal(new Set(r.split).size, 3, 'and every minted id is distinct');
  assert.equal(r.next.length, 6, 'three clips became six, in ONE array');
  for (const id of ['a', 'b', 'c']) assert.equal(byId(r.next, id).dur, 2, `${id} kept its left half`);
  for (const id of r.split) {
    assert.equal(byId(r.next, id).start, 2);
    assert.equal(byId(r.next, id).dur, 2);
  }
  assert.equal(before.length, 3, 'the input array is untouched');
});

test('splitAll: a minter that reads a SNAPSHOT cannot mint the same id twice', () => {
  // The panel's mintId reads getBoxes(), which does not move during the fold - so a
  // naive fold hands `b4` to all three halves and two of them vanish into the third.
  const before = [overlay('a', 0, { dur: 4 }), overlay('b', 0, { dur: 4 }), overlay('c', 0, { dur: 4 })];
  const frozen = (): string => 'dup';
  const r = splitAll(before, cfg, ['a', 'b', 'c'], 2, frozen);
  assert.equal(r.split.length, 3);
  assert.equal(new Set(r.split).size, 3, `distinct ids, got ${r.split.join(',')}`);
  assert.equal(r.next.length, 6);
  assert.equal(new Set(r.next.map((x) => String(x!.id))).size, 6, 'no id collides in the result');
});

test('splitAll: nothing to split returns the input array BY IDENTITY (no undo entry)', () => {
  minted = 0;
  const before = [clip('a', { start: 0, dur: 4 })];
  // Exactly on the clip's own start: splitBox refuses, so the whole command is a no-op.
  const r = splitAll(before, cfg, ['a'], 0, mintId);
  assert.equal(r.next, before, 'IDENTITY, so the caller can skip write() entirely');
  assert.deepEqual(r.split, []);
  assert.deepEqual(r.skipped, ['a']);
  // …and an empty id list is the same shape.
  assert.equal(splitAll(before, cfg, [], 2, mintId).next, before);
});

test('splitAll: an open-ended clip is SKIPPED without aborting the rest', () => {
  minted = 0;
  const before = [overlay('open', 0, { dur: '' }), overlay('ok', 0, { dur: 4 })];
  const r = splitAll(before, cfg, ['open', 'ok', 'ghost'], 2, mintId);
  assert.deepEqual(r.skipped, ['open', 'ghost'], 'open-ended and unknown ids are refused, in order');
  assert.equal(r.split.length, 1, 'the splittable one still split');
  assert.equal(byId(r.next, 'ok').dur, 2);
  assert.equal(byId(r.next, 'open').dur, '', 'the open-ended clip is untouched');
});

// ── 13. through edits + Join ───────────────────────────────────────────────────

/** The panel injects an asset-ref comparison; these fixtures carry a plain `src`. */
const sameSrc = (a: Box, b: Box): boolean => (a.src ?? null) === (b.src ?? null);

test('isThroughEdit: true immediately after a split, false once a transition lands', () => {
  minted = 0;
  const before = [clip('x', { start: 0, dur: 4, clipIn: 0, speed: 1, src: 'v.mp4' })];
  const after = splitBox(before, cfg, 'x', 2, mintId)!;
  assert.equal(isThroughEdit(after, cfg, 'x', 'new-1', sameSrc), true,
    'a fresh cut is a through edit - nothing has been decided yet');

  // A transition on either side ends it.
  const faded = after.map((b) => (b!.id === 'x' ? { ...b!, exit: 'fade' } : b));
  assert.equal(isThroughEdit(faded, cfg, 'x', 'new-1', sameSrc), false, 'A grew an exit');
  const entered = after.map((b) => (b!.id === 'new-1' ? { ...b!, enter: 'fade' } : b));
  assert.equal(isThroughEdit(entered, cfg, 'x', 'new-1', sameSrc), false, 'B grew an enter');
});

test('isThroughEdit: an edited in-point, a rate change or a different source ends it', () => {
  minted = 0;
  const after = splitBox([clip('x', { start: 0, dur: 4, clipIn: 0, speed: 1, src: 'v.mp4' })], cfg, 'x', 2, mintId)!;
  const patch = (id: string, p: Box): Box[] => after.map((b) => (b!.id === id ? { ...b!, ...p } : b));
  assert.equal(isThroughEdit(patch('new-1', { clipIn: 2.5 }), cfg, 'x', 'new-1', sameSrc), false, 'B was trimmed in');
  assert.equal(isThroughEdit(patch('new-1', { speed: 2 }), cfg, 'x', 'new-1', sameSrc), false, 'rates differ');
  assert.equal(isThroughEdit(patch('new-1', { src: 'other.mp4' }), cfg, 'x', 'new-1', sameSrc), false, 'different source');
  // A tolerance, not an equality: a millisecond of float drift is still contiguous.
  assert.equal(isThroughEdit(patch('new-1', { clipIn: 2.0005 }), cfg, 'x', 'new-1', sameSrc), true);
});

test('isThroughEdit: only ADJACENT seq clips, in that order, and never a clip with itself', () => {
  const rows = [
    clip('a', { start: 0, dur: 2, clipIn: 0, speed: 1, src: 'v' }),
    clip('b', { start: 2, dur: 2, clipIn: 2, speed: 1, src: 'v' }),
    clip('c', { start: 4, dur: 2, clipIn: 4, speed: 1, src: 'v' }),
  ];
  assert.equal(isThroughEdit(rows, cfg, 'a', 'b', sameSrc), true);
  assert.equal(isThroughEdit(rows, cfg, 'b', 'c', sameSrc), true);
  assert.equal(isThroughEdit(rows, cfg, 'a', 'c', sameSrc), false, 'not adjacent');
  assert.equal(isThroughEdit(rows, cfg, 'b', 'a', sameSrc), false, 'order matters - b does not precede a');
  assert.equal(isThroughEdit(rows, cfg, 'a', 'a', sameSrc), false);
  assert.equal(isThroughEdit(rows, cfg, 'a', 'zz', sameSrc), false);
  // An overlay pair is not a seq adjacency at all.
  const ovs = [overlay('p', 0, { dur: 2, clipIn: 0, speed: 1 }), overlay('q', 2, { dur: 2, clipIn: 2, speed: 1 })];
  assert.equal(isThroughEdit(ovs, cfg, 'p', 'q', sameSrc), false);
});

test('joinClips: split then join round-trips the clip, modulo the minted id', () => {
  minted = 0;
  const before = [
    { id: 'x', lane: 'seq', start: 0, dur: 4, clipIn: 0, speed: 1, enter: 'rise', exit: 'fade', exitMs: 600 } as Box,
    overlay('ov', 3, { dur: 1 }),
  ];
  const after = splitBox(before, cfg, 'x', 2, mintId)!;
  const rejoined = joinClips(after, cfg, 'x', 'new-1')!;
  assert.ok(rejoined, 'the pair is adjacent, so the join lands');
  assert.deepEqual(rejoined, before, 'byte-identical to the pre-split array');
});

test('joinClips: a clip with NO exit round-trips too - absence is carried, not undefined', () => {
  minted = 0;
  const before = [clip('x', { start: 0, dur: 4, clipIn: 0, speed: 1 })];
  const after = splitBox(before, cfg, 'x', 1.5, mintId)!;
  assert.equal(after[0]!.exit, 'none', 'precondition: the split wrote an exit on A');
  const rejoined = joinClips(after, cfg, 'x', 'new-1')!;
  assert.deepEqual(rejoined, before);
  assert.ok(!('exit' in rejoined[0]!), 'the key is DELETED, never written as undefined');
});

test('joinClips: B\'s length and outer edge move to A, and the row repacks', () => {
  const before = [
    clip('a', { start: 0, dur: 2, exit: 'none' }),
    clip('b', { start: 2, dur: 3, exit: 'fade', exitMs: 250 }),
    clip('c', { start: 5, dur: 1 }),
    overlay('ov', 5.5, { dur: 0.5 }),
  ];
  const out = joinClips(before, cfg, 'a', 'b')!;
  assert.deepEqual(out.map((x) => x!.id), ['a', 'c', 'ov'], 'B is gone');
  assert.equal(byId(out, 'a').dur, 5);
  assert.equal(byId(out, 'a').exit, 'fade');
  assert.equal(byId(out, 'a').exitMs, 250);
  assert.deepEqual(seqBoxes(out, cfg).map((x) => [x.id, x.start]), [['a', 0], ['c', 5]], 'gapless');
  assert.equal(byId(out, 'ov').start, 5.5, 'the overlay anchored in c travelled with it (c did not move)');
});

test('joinClips: refuses a non-adjacent pair, a reversed pair and an unknown id', () => {
  const rows = [clip('a', { start: 0, dur: 2 }), clip('b', { start: 2, dur: 2 }), clip('c', { start: 4, dur: 2 })];
  assert.equal(joinClips(rows, cfg, 'a', 'c'), null);
  assert.equal(joinClips(rows, cfg, 'b', 'a'), null);
  assert.equal(joinClips(rows, cfg, 'a', 'zz'), null);
  assert.equal(joinClips([overlay('p', 0, { dur: 1 }), overlay('q', 1, { dur: 1 })], cfg, 'p', 'q'), null);
});

// ── 14. detach / re-attach audio (the symmetric link) ──────────────────────────

/** A cfg that DECLARES the link sub-field - the opt-in the manifest makes. */
const linkCfg: TimeCfg = { ...cfg, linkField: 'linkOf' };

test('detachAudio: one new OVERLAY box, same ref and timing, symmetric link, source muted', () => {
  minted = 0;
  const before = [
    clip('v', { start: 0, dur: 4, clipIn: 1, speed: 2, image: { id: 'a/b.mp4' } as never, enter: 'rise', exit: 'fade' }),
    clip('w', { start: 4, dur: 2 }),
  ];
  const out = detachAudio(before, linkCfg, 'v', mintId, { kind: 'audio' })!;
  assert.ok(out, 'detach landed');
  assert.equal(out.length, 3, 'exactly ONE new box');
  const audio = byId(out, 'new-1');
  const video = byId(out, 'v');

  // Reference, not copy: the same asset ref and the same timing, verbatim.
  assert.deepEqual(audio.image, before[0]!.image);
  assert.equal(audio.start, 0);
  assert.equal(audio.dur, 4);
  assert.equal(audio.clipIn, 1);
  assert.equal(audio.speed, 2);
  assert.equal(audio.kind, 'audio', 'the add-kind seed is applied over the copy');

  assert.equal(audio.lane, '', 'the sound lands on an OVERLAY lane - packSeq must never see it');
  assert.equal(audio.mute, '', 'the sound is the half that plays');
  assert.equal(audio.enter, 'none');
  assert.equal(audio.exit, 'none');

  // The link is written on BOTH sides - that is what makes re-attach reachable either way.
  assert.equal(audio.linkOf, 'v');
  assert.equal(video.linkOf, 'new-1');
  assert.equal(video.mute, true, 'the picture is silenced');
  assert.equal(video.dur, 4, 'and otherwise untouched');
  assert.equal(byId(out, 'w').start, 4, 'the seq row did not move');
  assert.equal(before.length, 2, 'the input array is untouched');
});

test('detachAudio: refused without a link field, on a missing box, and when already linked', () => {
  minted = 0;
  const rows = [clip('v', { start: 0, dur: 4 })];
  assert.equal(detachAudio(rows, cfg, 'v', mintId), null, 'no linkField declared - the feature is not offered');
  assert.equal(detachAudio(rows, linkCfg, 'nope', mintId), null);
  const linked = [clip('v', { start: 0, dur: 4, linkOf: 'x' })];
  assert.equal(detachAudio(linked, linkCfg, 'v', mintId), null, 'already detached');
});

test('reattachAudio: un-mutes BOTH halves of a video that was split after detaching', () => {
  // The case the symmetric link exists for: splitBox copies fields, so cutting the
  // muted video leaves two halves that both name the sound.
  minted = 0;
  const detached = detachAudio([clip('v', { start: 0, dur: 4 })], linkCfg, 'v', mintId, { kind: 'audio' })!;
  const split = splitBox(detached, linkCfg, 'v', 2, mintId)!;
  assert.equal(byId(split, 'new-2').linkOf, 'new-1', 'precondition: both halves name the sound');

  const back = reattachAudio(split, linkCfg, 'v')!;
  assert.ok(back, 're-attach landed');
  assert.deepEqual(back.map((b) => String(b!.id)), ['v', 'new-2'], 'the sound box is gone');
  for (const id of ['v', 'new-2']) {
    assert.equal(byId(back, id).mute, '', `${id} is audible again`);
    assert.equal(byId(back, id).linkOf, '', `${id} is unlinked`);
  }
});

test('reattachAudio: works from the SOUND\'s side too, and removes every audio member', () => {
  minted = 0;
  const detached = detachAudio([clip('v', { start: 0, dur: 4 })], linkCfg, 'v', mintId, { kind: 'audio' })!;
  const back = reattachAudio(detached, linkCfg, 'new-1')!;
  assert.deepEqual(back.map((b) => String(b!.id)), ['v']);
  assert.equal(byId(back, 'v').mute, '');
});

test('reattachAudio: refuses when the muted side is empty rather than guessing', () => {
  minted = 0;
  const detached = detachAudio([clip('v', { start: 0, dur: 4 })], linkCfg, 'v', mintId, { kind: 'audio' })!;
  // The user un-muted the picture by hand: two unmuted linked boxes, and deleting the
  // wrong one is unrecoverable.
  const unmuted = detached.map((b) => (b!.id === 'v' ? { ...b!, mute: '' } : b));
  assert.equal(reattachAudio(unmuted, linkCfg, 'v'), null);
});

test('reattachAudio: null without a link field, on a singleton, and on a dangling id', () => {
  const rows = [clip('v', { start: 0, dur: 4, linkOf: 'ghost' })];
  assert.equal(reattachAudio(rows, cfg, 'v'), null, 'no linkField declared');
  assert.equal(reattachAudio(rows, linkCfg, 'v'), null, 'the partner does not exist - group of one');
  assert.equal(reattachAudio([clip('v', { start: 0, dur: 4 })], linkCfg, 'v'), null, 'nothing linked');
  assert.equal(reattachAudio(rows, linkCfg, 'zz'), null, 'unknown id');
});

test('reattachAudio: removing a SEQ-lane sound closes the gap it leaves', () => {
  // A detached sound normally lands on an overlay lane, but a user can promote it onto
  // the magnetic row; pulling it back out must repack like any other removal.
  const rows = [
    clip('v', { start: 0, dur: 2, mute: true, linkOf: 's' }),
    clip('s', { start: 2, dur: 2, linkOf: 'v' }),
    clip('w', { start: 4, dur: 2 }),
  ];
  const back = reattachAudio(rows, linkCfg, 'v')!;
  assert.deepEqual(seqBoxes(back, cfg).map((b) => [b.id, b.start]), [['v', 0], ['w', 2]], 'gapless after the removal');
});

// ── onionNeighbours (the onion skin's model half) ──────────────────────────────
//
// The DRAWING is views/onion-skin.ts and is covered on jsdom; everything about WHICH
// scenes are ghosted is decided here, where it can be asserted exactly.

/** Four scenes back to back: 0-2, 2-4, 4-6, 6-8. */
const SCENES = (): Box[] => ([
  clip('s1', { start: 0, dur: 2 }),
  clip('s2', { start: 2, dur: 2 }),
  clip('s3', { start: 4, dur: 2 }),
  clip('s4', { start: 6, dur: 2 }),
]);

test('onionNeighbours: the active window is HALF-OPEN, exactly like isActiveAt', () => {
  const rows = SCENES();
  // Just inside s2.
  assert.deepEqual(onionNeighbours(rows, cfg, 2.5, 1, 1), { past: ['s1'], future: ['s3'] });
  // The frame at s2's own start belongs to s2 (start is INSIDE).
  assert.deepEqual(onionNeighbours(rows, cfg, 2, 1, 1), { past: ['s1'], future: ['s3'] });
  // One instant earlier is still s1 - so the ghosts flip on the SAME frame the picture
  // does, never one frame early and never one frame late.
  assert.deepEqual(onionNeighbours(rows, cfg, 1.999, 1, 1), { past: [], future: ['s2'] });
  // And the frame at s2's END belongs to s3, not to s2.
  assert.deepEqual(onionNeighbours(rows, cfg, 4, 1, 1), { past: ['s2'], future: ['s4'] });
});

test('onionNeighbours: two either side, NEAREST first, clamped at the row ends', () => {
  const rows = SCENES();
  assert.deepEqual(onionNeighbours(rows, cfg, 4.5, 2, 2), { past: ['s2', 's1'], future: ['s4'] },
    'nearest first in both lists; the future runs out after one');
  assert.deepEqual(onionNeighbours(rows, cfg, 0.5, 2, 2), { past: [], future: ['s2', 's3'] },
    'the first scene has no past at all - clamped, never wrapped');
  assert.deepEqual(onionNeighbours(rows, cfg, 7.5, 2, 2), { past: ['s3', 's2'], future: [] });
});

test('onionNeighbours: before and after are honoured INDEPENDENTLY', () => {
  const rows = SCENES();
  const at = 4.5;   // inside s3
  assert.deepEqual(onionNeighbours(rows, cfg, at, 0, 0), { past: [], future: [] }, 'off');
  assert.deepEqual(onionNeighbours(rows, cfg, at, 2, 0), { past: ['s2', 's1'], future: [] },
    '"two behind, none ahead" is a real way to work (the Procreate Dreams pattern)');
  assert.deepEqual(onionNeighbours(rows, cfg, at, 0, 1), { past: [], future: ['s4'] });
  assert.deepEqual(onionNeighbours(rows, cfg, at, 1, 2), { past: ['s2'], future: ['s4'] });
});

test('onionNeighbours: counts clamp to 0…ONION_MAX_STEPS and survive junk', () => {
  const rows = SCENES();
  assert.equal(ONION_MAX_STEPS, 2);
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, 99, 99).past, ['s3', 's2'], 'never more than two');
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, -5, -5), { past: [], future: [] });
  // A junk count draws NOTHING on that side - the safe direction for a decoration.
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, NaN as unknown as number, 2), { past: [], future: [] });
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, 1.9, 0), { past: ['s3'], future: [] }, 'a fraction floors');
});

test('onionNeighbours: nothing active, an empty lane and a gap all return two empty arrays', () => {
  const rows = SCENES();
  assert.deepEqual(onionNeighbours(rows, cfg, 99, 2, 2), { past: [], future: [] }, 'past the end');
  assert.deepEqual(onionNeighbours([], cfg, 1, 2, 2), { past: [], future: [] }, 'empty model');
  assert.deepEqual(onionNeighbours([scenery('x'), overlay('o', 0, { dur: 5 })], cfg, 1, 2, 2),
    { past: [], future: [] }, 'no seq lane at all');
  // A gap in the row (possible only from a hand-edited ?boxes= - packSeq never leaves
  // one): the playhead is inside nothing, so there is no "either side" to speak of.
  const gapped = [clip('a', { start: 0, dur: 1 }), clip('b', { start: 5, dur: 1 })];
  assert.deepEqual(onionNeighbours(gapped, cfg, 3, 2, 2), { past: [], future: [] });
});

test('onionNeighbours: SEQ LANE ONLY - overlays are never ghosted and never counted', () => {
  const rows: Box[] = [
    ...SCENES(),
    overlay('lower3', 3, { dur: 2 }),     // straddles the s2/s3 cut
    scenery('logo'),
  ];
  const n = onionNeighbours(rows, cfg, 4.5, 2, 2);
  assert.deepEqual(n, { past: ['s2', 's1'], future: ['s4'] },
    'the overlay is neither a ghost nor a step in the walk');
});

test('onionNeighbours: an open-ended seq clip runs to the DERIVED sequence end', () => {
  // No authored dur on the last clip. The panel's own span() reads that as "runs to the
  // end of the sequence", where the end is deriveDuration's - here stretched to 10s by
  // an overlay. This must agree with span() or the ghosts would blink out early.
  const rows: Box[] = [
    clip('a', { start: 0, dur: 3 }),
    clip('b', { start: 3 }),
    overlay('bed', 0, { dur: 10 }),
  ];
  assert.deepEqual(onionNeighbours(rows, cfg, 5, 1, 1), { past: ['a'], future: [] },
    'b is still on screen at 5s because the sequence runs to 10');
  // With nothing else to stretch it the derived end IS a's end, so the open clip
  // collapses to the MIN_DUR floor - the same (deliberate) reading span() takes.
  const bare = [clip('a', { start: 0, dur: 3 }), clip('b', { start: 3 })];
  assert.deepEqual(onionNeighbours(bare, cfg, 3.05, 1, 1), { past: ['a'], future: [] });
  assert.deepEqual(onionNeighbours(bare, cfg, 3.5, 1, 1), { past: [], future: [] });
});

// ── keyframe rebase (plans/104 section 5.6) ──────────────────────────────────────────
//
// A keyframe track lives in the box's OWN local time, so every edit that moves the
// clip's head has to move the track with it. The property under test is always the
// same one, and it is a CONTINUITY property rather than a wire property: whatever the
// rebase writes, evaluating the result at a given instant must return the pose the
// original returned at that same instant of the clip's content. The wire is allowed
// to change (a subdivided ease is a different token); the motion is not.

/** The track a box carries, parsed the way every consumer will parse it. */
const trackOf = (box: Box | undefined): KfTrack => parseKf(String(box?.kf ?? ''));

/**
 * Continuity across a rebase: `half(t)` must equal `orig(t + shiftMs)` for every
 * channel, sampled densely enough to catch a wrong ease and not just a wrong endpoint.
 *
 * The tolerance is stated per channel as a fraction of that channel's own authored
 * SPREAD, because the error a correct rebase can still carry is the section 4.6 wire
 * quantisation (0.001 on a bezier control point, 0.01 px / 0.001 unit on a value)
 * scaled by how far the channel travels - not an absolute number of pixels. A tenth
 * of a percent of the travel plus one quantum is what that works out to, and it is
 * deliberately snug: the worst error across the split/trim/join cases below is
 * 0.024 px on a 120 px move, so a rebase that dropped the ease subdivision (tens of
 * px out - see the vacuity guard) could not hide inside it.
 */
function assertContinuity(
  orig: KfTrack, half: KfTrack, shiftMs: number, from: number, to: number, label: string,
  opts: { frac?: number; only?: string[] } = {},
): void {
  const frac = opts.frac ?? 0.001;
  const spread = new Map<string, number>();
  for (const ch of kfChannelsUsed(orig)) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const k of orig) {
      const v = k.v[ch as keyof typeof k.v];
      if (typeof v !== 'number') continue;
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    spread.set(ch, Number.isFinite(hi - lo) ? hi - lo : 0);
  }
  for (let t = from; t <= to; t += 25) {
    const want = evaluateKf(orig, t + shiftMs);
    const got = evaluateKf(half, t);
    for (const [ch, v] of Object.entries(want)) {
      if (opts.only && !opts.only.includes(ch)) continue;
      const tol = 0.011 + frac * (spread.get(ch) ?? 0);
      const g = got[ch as keyof typeof got];
      assert.ok(
        typeof g === 'number' && Math.abs(g - v) <= tol,
        `${label}: ${ch} at local ${t}ms - want ${v}, got ${String(g)} (tol ${tol})`,
      );
    }
  }
}

/** Every diamond poses every channel - what the UI writes (plan section 8), and the exact case. */
const FULL_TRACK = 't0_eo_x0_y0_s1_r0_o1_b0_z0'
  + '*t1200_ei_x120_y-40_s1.4_r15_o0.5_b6_z80'
  + '*t3000_x0_y0_s1_r0_o1_b0_z0';

const kfCfg: TimeCfg = { ...cfg, kfField: 'kf' };
const kfClip = (kf: string, extra: Box = {}): Box[] => [
  clip('x', { start: 0, dur: 3, clipIn: 0, speed: 1, kf, ...extra }),
];

test('splitBox: the halves REPLAY the original - every channel, across an eased cut', () => {
  minted = 0;
  const rows = kfClip(FULL_TRACK);
  const orig = trackOf(rows[0]);
  // 1.5s lands inside the second segment, whose ease (`ei`) therefore has to be
  // subdivided rather than copied to both halves.
  const out = splitBox(rows, kfCfg, 'x', 1.5, mintId)!;
  const a = trackOf(byId(out, 'x'));
  const b = trackOf(byId(out, 'new-1'));
  assertContinuity(orig, a, 0, 0, 1500, 'A half');
  assertContinuity(orig, b, 1500, 0, 1500, 'B half');
  // The pose AT the cut is the same object on both sides - that is the seam.
  assert.deepEqual(evaluateKf(a, 1500), evaluateKf(b, 0), 'the halves meet at the cut');
});

test('splitBox: the crossing segment is SUBDIVIDED, not copied (the vacuity guard)', () => {
  minted = 0;
  const out = splitBox(kfClip(FULL_TRACK), kfCfg, 'x', 1.5, mintId)!;
  const a = trackOf(byId(out, 'x'));
  const b = trackOf(byId(out, 'new-1'));
  const crossing = a.find((k) => k.t === 1200)!;
  assert.ok(crossing, 'A still carries the key the crossing segment starts at');
  assert.notEqual(crossing.ease, 'ei', 'its ease is the left half of ei, not ei');
  assert.notEqual(b[0]!.ease, 'ei', 'and B opens on the right half');
  // What copying would have cost. One long eased move, cut three quarters of the way
  // through: keeping the ease (the naive rebase) replays the WHOLE curve inside the
  // first half, so the picture arrives somewhere else entirely at the same instant.
  minted = 0;
  const one = [clip('x', { start: 0, dur: 2, clipIn: 0, speed: 1, kf: 't0_eo_x0*t2000_x100' })];
  const orig = trackOf(one[0]);
  const half = trackOf(byId(splitBox(one, kfCfg, 'x', 1.5, mintId)!, 'x'));
  const naive: KfTrack = half.map((k) => (k.t === 0 ? { t: 0, ease: 'eo', v: k.v } : k));
  const at = 750;
  const want = evaluateKf(orig, at).x!;
  const exact = Math.abs(evaluateKf(half, at).x! - want);
  const copied = Math.abs(evaluateKf(naive, at).x! - want);
  assert.ok(copied > 5, `the naive rebase is ${copied}px out`);
  assert.ok(exact < copied / 20, `the subdivision is only ${exact}px out`);
});

test('splitBox: a cut ON a keyframe leaves the eases alone, and a cut outside the keys still holds', () => {
  minted = 0;
  // Cut exactly on the middle diamond: no segment crosses, so nothing is subdivided.
  const onKey = splitBox(kfClip(FULL_TRACK), kfCfg, 'x', 1.2, mintId)!;
  const a = trackOf(byId(onKey, 'x'));
  assert.equal(a[0]!.ease, 'eo', 'the first key keeps its authored ease');
  assert.equal(a[a.length - 1]!.t, 1200, 'the synthesised key IS the cut');
  assertContinuity(trackOf(kfClip(FULL_TRACK)[0]), a, 0, 0, 1200, 'A on-key');

  // A track that finishes long before the cut: both halves are a clamp-hold.
  minted = 0;
  const early = splitBox(kfClip('t0_x0*t400_x60'), kfCfg, 'x', 2, mintId)!;
  assert.equal(evaluateKf(trackOf(byId(early, 'new-1')), 0).x, 60);
  assert.equal(evaluateKf(trackOf(byId(early, 'new-1')), 99999).x, 60, 'B holds it forever');
  assert.equal(evaluateKf(trackOf(byId(early, 'x')), 2000).x, 60, 'A ends holding it too');

  // …and one that only starts after it.
  minted = 0;
  const late = splitBox(kfClip('t2500_x0*t2900_x60'), kfCfg, 'x', 1, mintId)!;
  assert.equal(evaluateKf(trackOf(byId(late, 'x')), 0).x, 0, 'A is a constant hold');
  assertContinuity(trackOf(kfClip('t2500_x0*t2900_x60')[0]), trackOf(byId(late, 'new-1')), 1000, 0, 2000, 'B late');
});

test('splitBox: a SPARSE channel keeps its endpoints exactly (the stated approximation)', () => {
  // `z` is mentioned at 0 and 2400 only, so its segment spans a diamond that never
  // names it - two different crossing segments meet at one cut, and a keyframe carries
  // one ease. The contract is: exact at the cut and at every key, shape approximate.
  minted = 0;
  const sparse = 't0_eo_x0_z0*t1200_x100*t2400_x0_z90';
  const rows = kfClip(sparse);
  const orig = trackOf(rows[0]);
  const out = splitBox(rows, kfCfg, 'x', 1.8, mintId)!;
  const a = trackOf(byId(out, 'x'));
  const b = trackOf(byId(out, 'new-1'));
  for (const [ch, v] of Object.entries(evaluateKf(orig, 1800))) {
    const key = ch as 'x' | 'z';
    assert.ok(Math.abs((evaluateKf(a, 1800)[key] as number) - v) <= 0.011, `A at the cut: ${ch}`);
    assert.ok(Math.abs((evaluateKf(b, 0)[key] as number) - v) <= 0.011, `B at the cut: ${ch}`);
  }
  // x's crossing segment starts at the last key before the cut, so IT is exact.
  assertContinuity(orig, a, 0, 1200, 1800, 'A sparse x', { only: ['x'] });
  // z's does not, and is allowed to differ in shape - but never by more than the
  // segment it lives on (a bound, so a future regression that inverts it still fails).
  const zErr = Math.abs((evaluateKf(a, 1500).z as number) - (evaluateKf(orig, 1500).z as number));
  assert.ok(zErr < 12, `the sparse channel stays near its curve (off by ${zErr})`);
});

test('trimClip: an IN trim rebases the track by the head it removed; an OUT trim never does', () => {
  const rows = kfClip(FULL_TRACK);
  const orig = trackOf(rows[0]);
  const trimmed = trimClip(rows, kfCfg, 'x', 'in', 0.8, null);
  assertContinuity(orig, trackOf(byId(trimmed, 'x')), 800, 0, 2200, 'trim-in');
  assert.equal(byId(trimmed, 'x').dur, 2.2, 'the clip really did lose 0.8s');

  const out = trimClip(rows, kfCfg, 'x', 'out', -0.5, null);
  assert.equal(byId(out, 'x').kf, FULL_TRACK, 'an out trim leaves the track byte-identical');
  const longer = trimClip(rows, kfCfg, 'x', 'out', 1, null);
  assert.equal(byId(longer, 'x').kf, FULL_TRACK, 'and so does growing it');
});

test('trimClip: a NEGATIVE in trim gives the head back, motion and all', () => {
  // A clip already cut into its source: dragging the in edge left restores 0.5s.
  const rows = [clip('x', { start: 0, dur: 3, clipIn: 1, speed: 1, kf: FULL_TRACK })];
  const orig = trackOf(rows[0]);
  const out = trimClip(rows, kfCfg, 'x', 'in', -0.5, null);
  const back = trackOf(byId(out, 'x'));
  assert.equal(byId(out, 'x').dur, 3.5);
  // Everything slid 0.5s later, and the revealed head holds the opening pose.
  assertContinuity(orig, back, -500, 500, 3500, 'negative trim-in');
  assert.equal(evaluateKf(back, 0).x, 0, 'the revealed head clamp-holds the first pose');
  assert.equal(back.length, orig.length, 'nothing was synthesised and nothing dropped');
});

test('the media-only edits do NOT rebase: speed, trim-in-point and length leave the track alone', () => {
  // `speed` remaps which frame of the FILE plays when; the box's own animation runs in
  // the clip's local timeline, which a rate change does not move. Same for the Trim-in
  // FIELD (the clip keeps its length and position) and for Length.
  const rows = kfClip(FULL_TRACK, { clipIn: 2 });
  for (const out of [
    setSpeed(rows, kfCfg, 'x', 2, 20),
    setSpeed(rows, kfCfg, 'x', 0.5, 20),
    setClipIn(rows, kfCfg, 'x', 4, 20),
    setDuration(rows, kfCfg, 'x', 1.5, 20),
    setDuration(rows, kfCfg, 'x', 6, 20),
    moveOverlay([overlay('y', 0, { dur: 2, kf: FULL_TRACK })], kfCfg, 'y', 3),
    packSeq(rows, kfCfg),
    moveSeqClip([...rows, clip('b', { start: 3, dur: 1 })], kfCfg, 'x', 1),
  ]) {
    const box = out.find((r) => r && (r.id === 'x' || r.id === 'y'))!;
    assert.equal(box.kf, FULL_TRACK, 'the track is byte-identical');
  }
});

test('joinClips: split then join replays the original, with ONE key at the seam', () => {
  minted = 0;
  const rows = kfClip(FULL_TRACK);
  const orig = trackOf(rows[0]);
  const halves = splitBox(rows, kfCfg, 'x', 1.5, mintId)!;
  const out = joinClips(halves, kfCfg, 'x', 'new-1')!;
  const merged = trackOf(byId(out, 'x'));
  assert.equal(byId(out, 'x').dur, 3, 'the clip is whole again');
  assert.equal(merged.filter((k) => k.t === 1500).length, 1, 'the seam is one keyframe, never two');
  assertContinuity(orig, merged, 0, 0, 3000, 'rejoined');
});

test('joinClips: B\'s track moves to where B now plays, and B\'s opening pose wins the seam', () => {
  const rows = [
    clip('a', { start: 0, dur: 2, clipIn: 0, speed: 1, kf: 't0_x0*t2000_x50' }),
    clip('b', { start: 2, dur: 2, clipIn: 0, speed: 1, kf: 't0_x200*t2000_x300' }),
  ];
  const out = joinClips(rows, kfCfg, 'a', 'b')!;
  const merged = trackOf(byId(out, 'a'));
  assert.equal(byId(out, 'a').dur, 4);
  assert.deepEqual(merged.map((k) => k.t), [0, 2000, 4000], 'B\'s keys land at +A.dur');
  assert.equal(evaluateKf(merged, 2000).x, 200, 'the seam plays B\'s opening pose');
  assert.equal(evaluateKf(merged, 4000).x, 300);
  assertContinuity(trackOf(rows[1]), merged, -2000, 2000, 4000, 'B inside the join');
});

test('joinClips: an unanimated B leaves A\'s track byte-identical', () => {
  const rows = [
    clip('a', { start: 0, dur: 2, kf: FULL_TRACK }),
    clip('b', { start: 2, dur: 2 }),
  ];
  const out = joinClips(rows, kfCfg, 'a', 'b')!;
  assert.equal(byId(out, 'a').kf, FULL_TRACK, 'nothing to merge, nothing rewritten');
});

test('joinClips: an animated B onto an unanimated A keeps the motion (and poses the seam back)', () => {
  // The documented lossy case: one clip has one track, and a track clamp-holds its
  // first pose backwards. Preserving B's animation is worth that; dropping it is not.
  const rows = [
    clip('a', { start: 0, dur: 2 }),
    clip('b', { start: 2, dur: 2, kf: 't0_o0*t1000_o1' }),
  ];
  const merged = trackOf(byId(joinClips(rows, kfCfg, 'a', 'b')!, 'a'));
  assert.deepEqual(merged.map((k) => k.t), [2000, 3000]);
  assert.equal(evaluateKf(merged, 2000).o, 0, 'B\'s fade still starts where B starts');
  assert.equal(evaluateKf(merged, 0).o, 0, 'and A\'s span holds it - stated, not accidental');
});

test('splitAll routes through exactly the same rebase', () => {
  minted = 0;
  const rows = [
    clip('x', { start: 0, dur: 3, clipIn: 0, speed: 1, kf: FULL_TRACK }),
    clip('y', { start: 3, dur: 3, clipIn: 0, speed: 1, kf: 't0_x0*t2000_x40' }),
  ];
  minted = 0;
  const one = splitBox(rows, kfCfg, 'x', 1.5, mintId)!;
  minted = 0;
  const all = splitAll(rows, kfCfg, ['x'], 1.5, mintId);
  assert.equal(byId(all.next, 'x').kf, byId(one, 'x').kf);
  assert.equal(byId(all.next, 'new-1').kf, byId(one, 'new-1').kf);
  // And a multi-clip cut rebases each clip against its OWN local time.
  minted = 0;
  const both = splitAll(rows, kfCfg, ['x', 'y'], 4, mintId);
  assert.deepEqual(both.skipped, ['x'], 'the playhead is outside x');
  assert.equal(evaluateKf(trackOf(byId(both.next, 'new-1')), 0).x, 20, 'y was cut at ITS local 1s');
});

test('the rebase rewrites the kf field and NOTHING else (the field-copy contracts hold)', () => {
  minted = 0;
  const src: Box = {
    id: 'x', lane: 'seq', start: 0, dur: 3, clipIn: 0, speed: 1,
    kf: FULL_TRACK, ref: 'asset://clip.mp4', text: 'hello', link: 'snd', group: 'g1', z: 40,
  };
  const out = splitBox([src], kfCfg, 'x', 1.5, mintId)!;
  for (const half of out) {
    for (const f of ['ref', 'text', 'link', 'group', 'z'] as const) {
      assert.equal(half![f], src[f], `${f} is copied verbatim`);
    }
  }
  // detachAudio's link survival is the contract most at risk from a field rewrite.
  const linkCfg: TimeCfg = { ...kfCfg, linkField: 'link' };
  const det = detachAudio([{ ...src, link: '' }], linkCfg, 'x', () => 'snd')!;
  assert.equal(det[0]!.link, 'snd');
  assert.equal(det[1]!.link, 'x');
  assert.equal(det[1]!.kf, FULL_TRACK, 'a detach still COPIES the track - no local time moved');
});

test('a tool with no kf field is byte-identical through every edit (the floor)', () => {
  minted = 0;
  const rows = kfClip(FULL_TRACK);
  // `cfg` declares no kfField at all: the whole rebase is unreachable.
  const halves = splitBox(rows, cfg, 'x', 1.5, mintId)!;
  assert.equal(halves[0]!.kf, FULL_TRACK);
  assert.equal(halves[1]!.kf, FULL_TRACK, 'the verbatim copy this module has always made');
  assert.equal(byId(trimClip(rows, cfg, 'x', 'in', 0.8, null), 'x').kf, FULL_TRACK);
  const pair = [clip('a', { start: 0, dur: 2, kf: 't0_x0' }), clip('b', { start: 2, dur: 2, kf: 't0_x9' })];
  assert.equal(byId(joinClips(pair, cfg, 'a', 'b')!, 'a').kf, 't0_x0');

  // And a box with NO track never grows one, even where the field IS declared.
  minted = 0;
  const bare = [clip('x', { start: 0, dur: 3, clipIn: 0, speed: 1 })];
  const cut = splitBox(bare, kfCfg, 'x', 1.5, mintId)!;
  assert.ok(!('kf' in cut[0]!), 'A gained no kf key');
  assert.ok(!('kf' in cut[1]!), 'B gained no kf key');
  assert.ok(!('kf' in byId(trimClip(bare, kfCfg, 'x', 'in', 0.5, null), 'x')));
});

test('a hostile kf value can never be rewritten into something worse', () => {
  minted = 0;
  // Junk plus one real keyframe: the rebase re-serialises through the grammar, so
  // whatever comes out is charset-clean by construction.
  const rows = kfClip('"><img src=x>*t0_x0*t2000_x80');
  const out = splitBox(rows, kfCfg, 'x', 1, mintId)!;
  for (const half of out) {
    assert.ok(KF_CHARSET_RE.test(String(half!.kf)), `${String(half!.kf)} is charset-clean`);
  }
  assert.equal(evaluateKf(trackOf(byId(out, 'new-1')), 0).x, 40, 'and the real key still rebased');

  // A value with nothing parseable in it is left exactly as found: this module rewrites
  // a track, it does not sanitise a field it has no motion for (the hooks refuse to
  // emit it, which is where that guarantee belongs).
  minted = 0;
  const junk = splitBox(kfClip('"><img src=x>'), kfCfg, 'x', 1, mintId)!;
  assert.equal(junk[0]!.kf, '"><img src=x>');
  assert.equal(junk[1]!.kf, '"><img src=x>');
});

test('rebase fuzz: 300 random tracks × random cuts meet exactly at the seam', () => {
  // Structural property rather than a shape one, so it can afford to be random:
  // whatever the track and wherever the cut, the two halves must MEET (A's last
  // instant is B's first), the wire must stay charset-clean and re-parseable, and no
  // key may land out of order or before zero. Deterministic PRNG - a fuzz case that
  // cannot be reproduced is a rumour, not a test.
  let seed = 0x104f00d;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const eases = ['el', 'ei', 'eo', 'eio', 'ev', 'ea', 'es', 'ek', 'eh', 'eb(0.2)(1.4)(0.7)(0.3)'];
  for (let i = 0; i < 300; i++) {
    const keys: string[] = [];
    const n = 1 + Math.floor(rnd() * 5);
    let t = Math.floor(rnd() * 400);
    for (let k = 0; k < n; k++) {
      const parts = [`t${t}`, eases[Math.floor(rnd() * eases.length)]!];
      if (rnd() < 0.9) parts.push(`x${(rnd() * 400 - 200).toFixed(2)}`);
      if (rnd() < 0.6) parts.push(`o${rnd().toFixed(3)}`);
      if (rnd() < 0.5) parts.push(`z${(rnd() * 300).toFixed(2)}`);
      keys.push(parts.join('_'));
      t += 1 + Math.floor(rnd() * 900);
    }
    const kf = keys.join('*');
    const dur = 3;
    const cut = 0.2 + rnd() * 2.6;
    minted = 0;
    const out = splitBox([clip('x', { start: 0, dur, clipIn: 0, speed: 1, kf })], kfCfg, 'x', cut, mintId);
    if (!out) continue;                       // refused (too close to an edge) - fine
    const label = `seed case ${i}: "${kf}" cut at ${cut}`;
    const a = trackOf(byId(out, 'x'));
    const b = trackOf(byId(out, 'new-1'));
    for (const half of [byId(out, 'x'), byId(out, 'new-1')]) {
      assert.ok(KF_CHARSET_RE.test(String(half.kf)), `${label}: charset`);
    }
    for (const half of [a, b]) {
      let prev = -1;
      for (const k of half) {
        assert.ok(k.t >= 0 && k.t > prev, `${label}: keys ascend from zero`);
        prev = k.t;
      }
    }
    const cutMs = Math.round(cut * 1000);
    const orig = parseKf(kf);
    const atCut = evaluateKf(a, cutMs) as Record<string, number>;
    const atZero = evaluateKf(b, 0) as Record<string, number>;
    for (const [ch, v] of Object.entries(evaluateKf(orig, cutMs) as Record<string, number>)) {
      assert.ok(Math.abs((atCut[ch] as number) - v) <= 0.011, `${label}: A meets ${ch}`);
      assert.ok(Math.abs((atZero[ch] as number) - v) <= 0.011, `${label}: B meets ${ch}`);
    }
  }
});

// ── the keyframe EDITING primitives (plans/104 section 8, workstream I2) ─────────────
//
// The surface's arithmetic, asserted with no DOM anywhere near it. The panel is
// editing glue and calls exactly these; timeline-panel.test.ts pins the wiring, this
// pins the numbers. Where the two could disagree - what a "full pose" contains, where
// a dragged diamond lands, which token an ease splice touches - this file is right.

const zCfg: TimeCfg = { ...cfg, kfField: 'kf', zField: 'z' };

test('kfLocalMs / kfTimelineSec: a keyframe lives in the CLIP\'s own time, unscaled by speed', () => {
  const box = clip('x', { start: 2, dur: 3, clipIn: 0.75, speed: 2, kf: 't0_x0*t1000_x9' });
  // The DOM evaluator reads `tMs - timing.start` (sequence-dom.ts) and the trim rebase
  // shifts by the same number. `clipIn` and `speed` remap the MEDIA inside a clip, never
  // the clip's own animation, so neither may appear in this conversion.
  assert.equal(kfLocalMs(box, zCfg, 2), 0);
  assert.equal(kfLocalMs(box, zCfg, 3.25), 1250);
  assert.equal(kfLocalMs(box, zCfg, 1.5), -500, 'before the clip is a negative local time, not a clamp');
  assert.equal(kfTimelineSec(box, zCfg, 1250), 3.25, 'and the round trip is exact on the ms grid');
  // Scenery: no start at all reads as 0, so an untimed box's track is still addressable.
  assert.equal(kfLocalMs({ id: 'y', start: '', dur: '' }, zCfg, 1.5), 1500);
});

test('kfDiamondAt is EXACT - one millisecond off a keyframe is off it', () => {
  const box = clip('x', { start: 1, dur: 3, kf: 't0_x0*t1500_x40' });
  assert.equal(kfDiamondAt(box, zCfg, 1), 0);
  assert.equal(kfDiamondAt(box, zCfg, 2.5), 1500);
  assert.equal(kfDiamondAt(box, zCfg, 2.501), null,
    'the latch has already snapped the playhead onto the diamond, so "near" is a state '
    + 'the user cannot be left in by accident - a tolerance here would let an edit land '
    + 'on a keyframe the header says you are not on');
  assert.equal(kfDiamondAt(clip('x', { start: 0, dur: 3 }), zCfg, 0), null, 'no track, no diamonds');
  assert.deepEqual(kfDiamondTimes(box, zCfg), [1, 2.5], 'and the latch candidates are TIMELINE seconds');
});

test('the latch candidate is the ROUND TRIP of the latch test, on and off the ms grid', () => {
  // `kfDiamondTimes` emits what the ruler snaps the playhead to and what Alt+←/→ seeks
  // to; `kfDiamondAt` decides whether the header says "Keyframe @ …" and whether a
  // canvas drag poses. If the two round differently the playhead can land EXACTLY on a
  // diamond that the panel then denies being on - pose fields disabled, drag moving the
  // box - which is the one lie this model cannot afford. A start is not required to sit
  // on the millisecond grid anywhere in `TimeCfg`, the schema or `boxTiming`: an
  // authored, imported or URL-supplied document can carry any float.
  const kf = 't0_x0*t500_x10*t2000_x20';
  for (const start of [0, 0.0005, 0.1235, 1 / 3, 2.7182818, 59.9999, 1234.5678]) {
    const box = clip('x', { start, dur: 3600, kf });
    const cands = kfDiamondTimes(box, zCfg);
    assert.deepEqual(cands.map((s) => kfDiamondAt(box, zCfg, s)), [0, 500, 2000],
      `start ${start}: every candidate reads back as its own keyframe`);
    // …and the write lands on that same key rather than forking a twin beside it.
    for (const s of cands) {
      const out = writeKfPose([box], zCfg, 'x', s, { y: 1 }, 'add');
      assert.equal(parseKf(String(out[0]!.kf)).length, 3, `start ${start}: no fourth keyframe at ${s}`);
    }
  }
  // Seeking is the same set, so it inherits the property.
  const odd = clip('x', { start: 0.1235, dur: 3600, kf });
  const first = kfSeekDiamond([odd], zCfg, ['x'], -1, 1);
  assert.equal(kfDiamondAt(odd, zCfg, first as number), 0, 'Alt+→ lands ON the diamond it announces');
});

test('a keyframe never lands past the out-point - but an existing one is posed where it is', () => {
  // The tail clamp is the drag path's own stated law ("a keyframe past the out-point is
  // unreachable without a trim, and a drag that silently parks one there looks exactly
  // like a drag that did nothing"), and "+Keyframe"/K go through the same door.
  const box = clip('x', { start: 0, dur: 3, kf: 't0_x0*t1000_x50' });
  assert.equal(kfWriteMs(box, zCfg, 10), 3000, 'past the out-point clamps to the clip end');
  assert.equal(kfWriteMs(box, zCfg, -4), 0, 'before the in-point clamps to the clip start');
  assert.equal(kfWriteMs(box, zCfg, 1), 1000, 'inside, it is simply the playhead');
  const late = writeKfPose([box], zCfg, 'x', 10, {}, 'set');
  assert.deepEqual(parseKf(String(late[0]!.kf)).map((k) => k.t), [0, 1000, 3000],
    'so the dot is on the bar the user is looking at, not seven seconds past its right edge');

  // An open-ended clip has no out-point to clamp against, so it keeps the full range.
  const openEnded = clip('y', { start: 0, dur: '', kf: 't0_x0' });
  assert.equal(kfWriteMs(openEnded, zCfg, 10), 10000);

  // And a key already sitting past the end - reachable by hand-editing a share URL, or
  // by trimming the clip shorter afterwards - is EDITED, never forked: the latch's whole
  // claim is that the header names the keyframe a gesture will write.
  const stale = clip('z', { start: 0, dur: 3, kf: 't0_x0*t9000_x50' });
  assert.equal(kfWriteMs(stale, zCfg, 9), 9000);
  const posed = writeKfPose([stale], zCfg, 'z', 9, { x: 5 }, 'add');
  assert.deepEqual(parseKf(String(posed[0]!.kf)).map((k) => k.t), [0, 9000]);
});

test('kfFormatChannel prints a channel at ITS OWN quantum, never a hardcoded 1e-3', () => {
  // section 4.6: x/y/z/b/r are hundredths, s/o/a thousandths. A single 1e-3 in the inspector
  // printed five significant decimals for a depth the wire could never hold.
  assert.equal(kfFormatChannel('z', 140.23456), '140.23');
  assert.equal(kfFormatChannel('b', 2.5), '2.5', 'and never pads to the quantum');
  assert.equal(kfFormatChannel('s', 1.23456), '1.235');
  assert.equal(kfFormatChannel('o', 0.5), '0.5');
  assert.equal(kfFormatChannel('x', 0.1 + 0.2), '0.3', 'no binary artefacts in a field');
  assert.equal(kfFormatChannel('z', 0), '0');
  assert.equal(kfFormatChannel('z', Number.NaN), '0', 'junk reads as the neutral, never "NaN"');
});

test('writeKfPose composes a FULL pose over the active channel set, at the section 4.6 quanta', () => {
  const rows = [clip('x', { start: 0, dur: 4, z: 140, kf: 't0_x0_s1*t2000_eo_x60_s1.5' })];
  // 'add' - a gesture's delta, on top of what the box is already doing there.
  const moved = writeKfPose(rows, zCfg, 'x', 2, { x: 12.345, y: -4 }, 'add');
  const t = parseKf(String(moved[0]!.kf));
  assert.equal(t.length, 2, 'the diamond was UPDATED, never duplicated');
  assert.deepEqual({ ...t[1]!.v }, { x: 72.35, y: -4, s: 1.5 },
    'x carried its own value + the delta, s came along because the track animates it, '
    + 'and y joined the set because this edit touched it');
  assert.equal(t[1]!.ease, 'eo', 'the curve out of the keyframe is not an edit');
  assert.deepEqual({ ...t[0]!.v }, { x: 0, s: 1 }, 'and every other keyframe is byte-identical');

  // 0.01px for x/y/z/b, 0.001 for s/o/a, integer ms for t - the wire's own quanta, and
  // the round-trip law `parse(serialise(parse(s))) === parse(s)` holds through an edit.
  assert.equal(String(moved[0]!.kf), 't0_x0_s1*t2000_eo_x72.35_y-4_s1.5');
  assert.deepEqual(parseKf(serialiseKf(parseKf(String(moved[0]!.kf)))), parseKf(String(moved[0]!.kf)));

  // 'set' - a typed number IS the value, and it still writes a full pose around itself.
  const typed = writeKfPose(rows, zCfg, 'x', 2, { o: 0.5 }, 'set');
  assert.deepEqual({ ...parseKf(String(typed[0]!.kf))[1]!.v }, { x: 60, s: 1.5, o: 0.5 });
});

test('a pose\'s unauthored `z` is the box\'s own depth FIELD, never a neutral zero', () => {
  // section 5.2: a keyed `z` REPLACES the field for its segment. A full pose that wrote 0 over
  // an authored 140 would drop the box to the floor the instant it was keyed.
  const rows = [clip('x', { start: 0, dur: 4, z: 140, kf: 't0_x0*t2000_x60' })];
  const out = writeKfPose(rows, zCfg, 'x', 2, { z: 200 }, 'set');
  assert.deepEqual({ ...parseKf(String(out[0]!.kf))[1]!.v }, { x: 60, z: 200 });
  const nudged = writeKfPose(rows, zCfg, 'x', 2, { z: 10 }, 'add');
  assert.deepEqual({ ...parseKf(String(nudged[0]!.kf))[1]!.v }, { x: 60, z: 150 }, '140 + 10');
  // A tool that declares no depth field has no authored depth to preserve.
  const noZ = writeKfPose(rows, { ...cfg, kfField: 'kf' }, 'x', 2, { z: 10 }, 'add');
  assert.deepEqual({ ...parseKf(String(noZ[0]!.kf))[1]!.v }, { x: 60, z: 10 });
});

test('a pose\'s unauthored `rx`/`ry` is the box\'s own TILT field, on `z`\'s rule verbatim', () => {
  // P2.1: an `rx`/`ry` token REPLACES the tilt field for its segment, exactly as `z`
  // replaces the depth field. So the unkeyed value in a full pose is the FIELD, not the
  // table's 0 - otherwise keying a tumble onto a box the user had already posed at
  // rx -12 would flatten it on the first diamond, silently.
  const tiltCfg: TimeCfg = { ...cfg, kfField: 'kf', zField: 'z', rxField: 'rx', ryField: 'ry' };
  const rows = [clip('x', { start: 0, dur: 4, z: 140, rx: -12, ry: 30, kf: 't0_x0*t2000_x60' })];
  // A full pose written over the active set carries the authored tilt through.
  const out = writeKfPose(rows, tiltCfg, 'x', 2, { rx: -40 }, 'set');
  assert.deepEqual({ ...parseKf(String(out[0]!.kf))[1]!.v }, { x: 60, rx: -40 },
    'the channel this edit touched is the typed value');
  const both = writeKfPose(rows, tiltCfg, 'x', 2, { rx: -40, ry: 0 }, 'set');
  assert.deepEqual({ ...parseKf(String(both[0]!.kf))[1]!.v }, { x: 60, rx: -40, ry: 0 },
    'and an explicit 0 is an authored flat, not an absent channel');
  // 'add' is a delta over the authored base, which is the whole point of the exception.
  const nudged = writeKfPose(rows, tiltCfg, 'x', 2, { ry: 10 }, 'add');
  assert.deepEqual({ ...parseKf(String(nudged[0]!.kf))[1]!.v }, { x: 60, ry: 40 }, '30 + 10');
  // The exception is only for a channel the track does NOT mention: once rx is keyed,
  // the evaluated curve wins, which is what "an existing curve survives the write" means.
  const keyed = [clip('x', { start: 0, dur: 4, rx: -12, kf: 't0_rx-40*t2000_rx-40' })];
  const later = writeKfPose(keyed, tiltCfg, 'x', 2, { x: 5 }, 'add');
  assert.deepEqual({ ...parseKf(String(later[0]!.kf))[1]!.v }, { x: 5, rx: -40 },
    'a keyed tilt is the track\'s, never the field\'s');
  // A tool that declares no tilt fields has no authored tilt to preserve.
  const noTilt = writeKfPose(rows, { ...cfg, kfField: 'kf' }, 'x', 2, { ry: 10 }, 'add');
  assert.deepEqual({ ...parseKf(String(noTilt[0]!.kf))[1]!.v }, { x: 60, ry: 10 });
});

test('writeKfPose returns the array by IDENTITY when the pose it would write is the one already there', () => {
  // The caller's "did this write anything?" test is `next === boxes`, and `Array.map`
  // mints a new array even when nothing changed. Without this, "+Keyframe" on a diamond
  // already holding that pose would be an undo step that undoes nothing visible.
  const rows = [clip('x', { start: 0, dur: 4, kf: 't0_x0*t2000_eo_x60' })];
  assert.equal(writeKfPose(rows, zCfg, 'x', 2, {}, 'set'), rows);
  assert.notEqual(writeKfPose(rows, zCfg, 'x', 2, { x: 1 }, 'add'), rows);
  assert.equal(writeKfPose(rows, cfg, 'x', 2, { x: 1 }, 'add'), rows, 'a tool with no kf field writes nothing');
});

test('a brand-new track is born with the SEED pose - five neutral channels, so nothing moves', () => {
  const rows = [clip('x', { start: 1, dur: 4 })];
  const out = writeKfPose(rows, zCfg, 'x', 1, {}, 'set');
  const t = parseKf(String(out[0]!.kf));
  assert.deepEqual(t.map((k) => k.t), [0]);
  assert.deepEqual({ ...t[0]!.v }, { x: 0, y: 0, s: 1, r: 0, o: 1 });
  assert.deepEqual([...KF_POSE_SEED], ['x', 'y', 's', 'r', 'o'],
    'z and b are deliberately NOT seeded: both have an authored base of their own, and '
    + 'seeding them would write a value the user never touched into every keyframe');
  // A camera is nothing but animation, so its pose IS the camera channels.
  const cam = writeKfPose([clip('c', { start: 0, dur: 4, kind: 'camera' })], zCfg, 'c', 0, {}, 'set');
  assert.deepEqual(kfChannelsUsed(parseKf(String(cam[0]!.kf))), ['x', 'y', 'z', 'rx', 'ry', 'f', 'a', 'p']);
});

test('the neutral table IS what an absent channel composes to (the foldKfPose reading)', () => {
  // Pinned against the multiplicative/additive split the fold applies, not restated
  // prose: if the fold ever changes what an absent channel means, a "full pose" written
  // from this table would silently move the box.
  assert.deepEqual({ ...KF_NEUTRAL }, {
    x: 0, y: 0, z: 0, s: 1, r: 0, rx: 0, ry: 0, o: 1, b: 0, f: 0, a: 0, p: 1200,
    // `w`/`h` are the `z` case: 0 stands for "unauthored", and the fold reads that as
    // the box's own size. Never seeded (see KF_POSE_SEED) - a size in every diamond
    // would reflow every keyed box.
    w: 0, h: 0,
    // Clip volume (plans/165 WP-3): a multiplier, neutral at unity. The visual fold
    // never reads it - it is the audio mix's channel.
    v: 1,
  });
});

test('retime / duplicate / delete / re-ease each touch exactly what they name', () => {
  const track = parseKf('t0_x0*t1500_eo_x40*t2500_el_x0');

  // A drag lands on the ms grid, never before the clip's start nor past its end.
  assert.equal(kfSlideMs(1500, 1.0, 3), 2500);
  assert.equal(kfSlideMs(1500, -9, 3), 0, 'clamped at the head');
  assert.equal(kfSlideMs(1500, 9, 3), 3000, 'and at the clip\'s own length, not the track\'s');
  assert.equal(kfSlideMs(1500, 0.0004, 3), 1500, 'integer ms - the wire has no finer grid');

  const moved = kfTrackRetime(track, 1500, 2000);
  assert.deepEqual(moved.map((k) => k.t).sort((a, b) => a - b), [0, 2000, 2500]);
  assert.equal(serialiseKf(moved), 't0_x0*t2000_eo_x40*t2500_el_x0', 'pose AND ease travelled with it');
  assert.deepEqual(kfTrackRetime(track, 1500, 2500).map((k) => k.t).sort((a, b) => a - b), [0, 2500],
    'landing on another diamond REPLACES it - the wire cannot hold two poses at one instant');
  assert.deepEqual(kfTrackRetime(track, 1234, 2000).map((k) => k.t), [0, 1500, 2500],
    'and retiming a keyframe that is not there is not an edit');

  // Duplicate: halfway to the next diamond, so a copy never lands on top of one.
  assert.equal(kfDuplicateMs(track, 1500, 3), 2000);
  assert.equal(kfDuplicateMs(track, 2500, 3), 3000, 'past the last one, half a second on, clamped to the clip');
  const dup = kfTrackDuplicate(track, 1500, kfDuplicateMs(track, 1500, 3));
  assert.equal(serialiseKf(dup), 't0_x0*t1500_eo_x40*t2000_eo_x40*t2500_el_x0');

  assert.equal(serialiseKf(kfTrackDelete(track, 1500)), 't0_x0*t2500_el_x0');
  assert.equal(serialiseKf(kfTrackDelete(track, 9999)), serialiseKf(track), 'deleting nothing changes nothing');

  // Ease: ONE token, spliced through the engine's own adapter - the canonical CSS wire
  // uses commas, which the kf charset bans, so a raw hand-off would emit junk.
  assert.equal(serialiseKf(kfTrackSetEase(track, 0, 'ease-out')), 't0_eo_x0*t1500_eo_x40*t2500_el_x0');
  assert.equal(serialiseKf(kfTrackSetEase(track, 1500, 'cubic-bezier(0.2,0,0.3,1)')),
    't0_x0*t1500_eb(0.2)(0)(0.3)(1)_x40*t2500_el_x0');
  assert.ok(KF_CHARSET_RE.test(serialiseKf(kfTrackSetEase(track, 1500, 'cubic-bezier(0.2,0,0.3,1)'))));
  assert.equal(serialiseKf(kfTrackSetEase(track, 1500, '<script>')), 't0_x0*t1500_x40*t2500_el_x0',
    'junk normalises to the grammar\'s default rather than reaching the wire');
});

test('rescaleKfTrack stretches a track to a target span, tempo only - never its shape (A1#5)', () => {
  const track = parseKf('t0_x0*t1000_eo_x40*t4000_el_x0'); // last key at 4 s

  // Stretch to 8 s: every time doubles, ratios and eases and values ride along.
  const up = rescaleKfTrack(track, 8000);
  assert.deepEqual(up.map((k) => k.t), [0, 2000, 8000], 'first stays at 0, last lands on the target, mid scales');
  assert.equal(serialiseKf(up), 't0_x0*t2000_eo_x40*t8000_el_x0', 'eases and poses are untouched - only the tempo');

  // Compress to 2 s: same shape, half again.
  assert.deepEqual(rescaleKfTrack(track, 2000).map((k) => k.t), [0, 500, 2000], 'compression is the same map, other way');

  // Degenerate inputs are returned unchanged - nothing to stretch.
  assert.equal(serialiseKf(rescaleKfTrack(track, 0)), serialiseKf(track), 'a zero target leaves the authored track');
  assert.equal(serialiseKf(rescaleKfTrack(track, -5)), serialiseKf(track), 'a negative target too');
  assert.equal(serialiseKf(rescaleKfTrack(track, Number.NaN)), serialiseKf(track), 'and a non-finite target');
  const single = parseKf('t0_x0');
  assert.equal(serialiseKf(rescaleKfTrack(single, 5000)), serialiseKf(single),
    'a single key at 0 has a zero natural end - nothing to scale against');
  assert.deepEqual(rescaleKfTrack([], 5000), [], 'an empty track is empty');
});

test('kfSeekDiamond walks the union of the given boxes and stops at the ends', () => {
  const rows = [
    clip('a', { start: 0, dur: 3, kf: 't0_x0*t1500_x40' }),
    clip('b', { start: 3, dur: 3, kf: 't0_x0*t500_x9' }),
  ];
  assert.equal(kfSeekDiamond(rows, zCfg, ['a', 'b'], 0, 1), 1.5);
  assert.equal(kfSeekDiamond(rows, zCfg, ['a', 'b'], 1.5, 1), 3);
  assert.equal(kfSeekDiamond(rows, zCfg, ['a', 'b'], 3.5, 1), null, 'no wrap - you keep your place');
  assert.equal(kfSeekDiamond(rows, zCfg, ['a', 'b'], 3.5, -1), 3, 'and backwards across the boundary');
  assert.equal(kfSeekDiamond(rows, zCfg, ['a'], 3.5, 1), null, 'only the boxes asked about');
  assert.equal(kfSeekDiamond(rows, zCfg, [], 0, 1), null);
});

test('clearKfTrack / setKfTrack write the ONE field and nothing else', () => {
  const rows = [clip('x', { start: 0, dur: 3, z: 140, clipIn: 0.5, kf: 't0_x0*t1500_x40' })];
  const cleared = clearKfTrack(rows, zCfg, 'x');
  assert.equal(cleared[0]!.kf, '');
  assert.equal(cleared[0]!.z, 140, 'the depth field is not a keyframe');
  assert.equal(cleared[0]!.clipIn, 0.5, 'nor is anything else the box carried');
  assert.equal(clearKfTrack(rows, cfg, 'x'), rows, 'a tool with no kf field has nothing to clear');
  assert.equal(String(setKfTrack(rows, zCfg, 'x', kfTrackDelete(parseKf('t0_x0*t1500_x40'), 0))[0]!.kf), 't1500_x40');
});

// ── P1a: the size channels ride the rebase (plans/104 section 5.2 + section 5.6) ──────────

test('the rebase is channel-agnostic, so `w`/`h` split, trim and join like everything else', () => {
  // section 5.6 rewrites the TRACK, not a list of channels - which is exactly why adding two
  // to the grammar (section 5.2, P1) needs no rebase change. This is the assertion that keeps
  // it that way: the same continuity harness, driven by the new channels alone, over
  // the same eased cut the full-pose case uses.
  minted = 0;
  const SIZE_TRACK = 't0_eo_w640_h360*t1200_ei_w1280_h720*t3000_w640_h360';
  const rows = kfClip(SIZE_TRACK);
  const orig = trackOf(rows[0]);
  assert.deepEqual(kfChannelsUsed(orig), ['w', 'h'], 'the fixture really does key only the size');

  const out = splitBox(rows, kfCfg, 'x', 1.5, mintId)!;
  const a = trackOf(byId(out, 'x'));
  const b = trackOf(byId(out, 'new-1'));
  assertContinuity(orig, a, 0, 0, 1500, 'A half (size)');
  assertContinuity(orig, b, 1500, 0, 1500, 'B half (size)');
  assert.deepEqual(evaluateKf(a, 1500), evaluateKf(b, 0), 'the halves meet at the cut');
  // …and the crossing segment really was SUBDIVIDED, not copied to both halves - the
  // vacuity guard, restated for the channels that arrived last.
  assert.notEqual(a.find((k) => k.t === 1200)?.ease, 'ei');

  // An IN trim shifts the size track by the head it removed, exactly as it shifts x.
  minted = 0;
  const trimmed = trimClip(kfClip(SIZE_TRACK), kfCfg, 'x', 'in', 0.8, null);
  assertContinuity(orig, trackOf(byId(trimmed, 'x')), 800, 0, 2000, 'trim-in (size)');
});

// ══ the motion path (plans/104 section 8's overlay, under section 6.5's projection rule) ══════
//
// The overlay's DOM half is pinned in shells/web/src/views/motion-path.test.ts. What
// is pinned HERE is the only claim that matters for correctness: the samples are the
// engine's own arithmetic, not a second implementation of the fold that happens to
// look right. Every assertion below recomputes the expected point from
// `evaluateKf` → `resolveCamera` → `projectLayer` directly and demands equality - so
// if `kfMotionPath` ever grew a shortcut, an approximation, or its own idea of what a
// camera does, this fails rather than the picture quietly drifting from the export.

/** The design field set, plus the two P0 appended in slots 69/70. */
const pathCfg: TimeCfg = { ...cfg, kfField: 'kf', zField: 'z' };
const STAGE = { stageW: 1920, stageH: 1080 };

/** The engine's own answer for one box at one TIMELINE instant - the reference. */
function enginePoint(
  track: KfTrack, cams: KfCameraClip[], startMs: number, bx: number, by: number, baseZ: number, tMs: number,
): { x: number; y: number; a: number } {
  const cam = resolveCamera(cams, tMs);
  const pose = evaluateKf(track, tMs - startMs);
  const z = typeof pose.z === 'number' ? pose.z : baseZ;
  const p = projectLayer({ ...cam, w: STAGE.stageW, h: STAGE.stageH },
    { bx, by, dxK: pose.x ?? 0, dyK: pose.y ?? 0, z });
  return { x: bx + p.dx, y: by + p.dy, a: p.alphaGuard };
}

test('kfCameraClips derives the same shape stageCameras does, from the model instead', () => {
  const rows: Box[] = [
    { id: 'art', x: 0, y: 0, w: 100, h: 100, start: 0, dur: 4, kf: 't0_x0*t1000_x50' },
    // A TIMED camera: a butted, half-open window.
    { id: 'c1', kind: 'camera', start: 0, dur: 2, z: 0, kf: 't0_z0*t2000_z-100' },
    // The implicit scene camera: untimed ("Always on"), with an authored depth base.
    { id: 'c2', kind: 'camera', start: '', dur: '', z: 120, kf: '' },
  ] as unknown as Box[];
  const cams = kfCameraClips(rows, pathCfg);
  assert.equal(cams.length, 2, 'only the camera-kind boxes');
  assert.equal(cams[0]!.start, 0);
  assert.equal(cams[0]!.end, 2000, 'end = start + dur, in ms, EXCLUSIVE');
  assert.ok(cams[0]!.track && cams[0]!.track.length === 2, 'the parsed track travels, not the wire');
  assert.equal(cams[0]!.base, null, 'a z of 0 is the default dolly, so no base is written');
  assert.equal(cams[1]!.start, 0);
  assert.equal(cams[1]!.end, null, 'an untimed camera never ends');
  assert.deepEqual(cams[1]!.base, { z: 120 }, 'the camera’s own z FIELD is the scene-default dolly');
  assert.equal(cams[1]!.track, null);
  // Latest-in-array wins - cuts, not blends. Inside c1's window, c2 (declared later)
  // is the one `resolveCamera` picks, which is the engine's rule, not this function's.
  assert.equal(resolveCamera(cams, 500).z, 120);
});

test('the sampled path IS the engine’s arithmetic - checked at three instants', () => {
  const rows: Box[] = [
    // 400×200 at (200, 300) → centre (400, 400). Lifted 160px off the surface.
    { id: 'art', x: 200, y: 300, w: 400, h: 200, rot: 0, start: 1, dur: 3, z: 160,
      kf: 't0_x0_y0*t1500_eo_x120_y-60*t3000_x0_y0' },
    { id: 'cam', kind: 'camera', start: 0, dur: 10, z: 0, kf: 't0_x0_z0*t4000_el_x-280_z-220' },
  ] as unknown as Box[];
  const cams = kfCameraClips(rows, pathCfg);
  const track = parseKf('t0_x0_y0*t1500_eo_x120_y-60*t3000_x0_y0');
  const out = kfMotionPath(rows, pathCfg, 'art', { x: 400, y: 400 }, { ...STAGE, cameras: cams });

  assert.ok(out.pts.length >= 2, 'the box travels, so there is a path');
  // The window is the clip's own: [1s, 4s]. First and last samples land ON its ends.
  assert.equal(out.pts[0]!.t, 1000);
  assert.equal(out.pts[out.pts.length - 1]!.t, 4000);

  // THREE instants, chosen to exercise all three things that can go wrong: the start
  // (camera at rest, box at rest), mid-ease (both moving, `eo` in flight), and the
  // out-point (the last sample, where an accumulated step would have drifted).
  for (const i of [0, Math.floor(out.pts.length / 2), out.pts.length - 1]) {
    const got = out.pts[i]!;
    const want = enginePoint(track, cams, 1000, 400, 400, 160, got.t);
    assert.equal(got.x, want.x, `x at t=${got.t}`);
    assert.equal(got.y, want.y, `y at t=${got.t}`);
    assert.equal(got.a, want.a, `alphaGuard at t=${got.t}`);
  }
  // …and the projection is really DOING something: a flat reading (ignoring the
  // camera and the depth) would put the last sample back at the authored centre.
  assert.notEqual(out.pts[out.pts.length - 1]!.x, 400);

  // One mark per keyframe, at the same projected pose - the diamonds and the line
  // cannot disagree, because they come out of the same expression.
  assert.deepEqual(out.keys.map((k) => k.t), [1000, 2500, 4000]);
  for (const k of out.keys) {
    const want = enginePoint(track, cams, 1000, 400, 400, 160, k.t);
    assert.equal(k.x, want.x, `key x at t=${k.t}`);
    assert.equal(k.y, want.y, `key y at t=${k.t}`);
  }
});

test('a kf `z` token REPLACES the depth field for its segment, and the path shows it', () => {
  const base: Box[] = [
    { id: 'art', x: 0, y: 0, w: 200, h: 200, rot: 0, start: 0, dur: 2, z: 0,
      kf: 't0_x0*t2000_el_x100' },
    { id: 'cam', kind: 'camera', start: 0, dur: 10, z: 0, kf: 't0_x0*t4000_el_x-200' },
  ] as unknown as Box[];
  const flat = kfMotionPath(base, pathCfg, 'art', { x: 100, y: 100 },
    { ...STAGE, cameras: kfCameraClips(base, pathCfg) });

  // Same document, same camera, one keyed `z` - the parallax has to change, because
  // eff = P/(P − (z − camZ)) is what the whole feature rests on.
  const lifted = base.map((b) => (b.id === 'art' ? { ...b, kf: 't0_x0_z240*t2000_el_x100_z240' } : b));
  const out = kfMotionPath(lifted, pathCfg, 'art', { x: 100, y: 100 },
    { ...STAGE, cameras: kfCameraClips(lifted, pathCfg) });
  assert.notEqual(out.pts[out.pts.length - 1]!.x, flat.pts[flat.pts.length - 1]!.x,
    'a lifted layer travels further under the same pan');
  const want = enginePoint(parseKf('t0_x0_z240*t2000_el_x100_z240'),
    kfCameraClips(lifted, pathCfg), 0, 100, 100, 0, out.pts[out.pts.length - 1]!.t);
  assert.equal(out.pts[out.pts.length - 1]!.x, want.x);
});

test('no track, one key, or no travel: there is no path, and the caller draws nothing', () => {
  const box = (kf: string): Box[] =>
    ([{ id: 'a', x: 0, y: 0, w: 100, h: 100, rot: 0, start: 0, dur: 2, kf }] as unknown as Box[]);
  for (const kf of ['', 't0_x40', 't0_o1*t2000_o0', 't0_b0*t2000_b20']) {
    const out = kfMotionPath(box(kf), pathCfg, 'a', { x: 50, y: 50 }, STAGE);
    assert.deepEqual(out.pts, [], `kf=${JSON.stringify(kf)} draws no path`);
    assert.deepEqual(out.keys, [], `kf=${JSON.stringify(kf)} draws no marks`);
  }
  // A tool with no kf field is not keyframable at all.
  assert.deepEqual(kfMotionPath(box('t0_x0*t2000_x99'), { ...pathCfg, kfField: '' }, 'a', { x: 50, y: 50 }, STAGE).pts, []);
  // …and an unknown id is not a crash.
  assert.deepEqual(kfMotionPath(box('t0_x0*t2000_x99'), pathCfg, 'nope', { x: 50, y: 50 }, STAGE).pts, []);
});

test('the sample count is bounded, and an UNTIMED animated box uses the sequence length', () => {
  const long: Box[] = [
    { id: 'a', x: 0, y: 0, w: 10, h: 10, rot: 0, start: 0, dur: 600, kf: 't0_x0*t600000_x900' },
  ] as unknown as Box[];
  const out = kfMotionPath(long, pathCfg, 'a', { x: 5, y: 5 }, STAGE);
  assert.equal(out.pts.length, MOTION_PATH_MAX_SAMPLES,
    'a ten-minute move samples coarser rather than minting ten thousand vertices');
  assert.equal(out.pts[out.pts.length - 1]!.t, 600000, 'and still ends exactly on the out-point');

  // Untimed ("Always on"): no dur of its own, so the window is the sequence's.
  const scenery: Box[] = [
    { id: 'a', x: 0, y: 0, w: 10, h: 10, rot: 0, start: '', dur: '', kf: 't0_x0*t2000_x200' },
    { id: 'clip', x: 0, y: 0, w: 10, h: 10, start: 0, dur: 5 },
  ] as unknown as Box[];
  const sc = kfMotionPath(scenery, pathCfg, 'a', { x: 5, y: 5 }, { ...STAGE, totalMs: 5000 });
  assert.equal(sc.pts[sc.pts.length - 1]!.t, 5000, 'the whole run, because it is on screen for it');
  assert.deepEqual(sc.keys.map((k) => k.t), [0, 2000]);
});


// ── restackOverlay (plans/165 Slice C-tracks) ─────────────────────────────────

test('restackOverlay: onto shares the row and stacks directly in front', () => {
  const cfgG = { ...cfg, groupField: 'group' };
  const before = [overlay('a', 0, { dur: 2 }), overlay('b', 0, { dur: 2 }), clip('s1', { start: 0, dur: 3 })];
  const next = restackOverlay(before, cfgG, 'a', { onto: 'b' });
  assert.deepEqual(next.map((b) => b.id), ['b', 'a', 's1'], 'a stacks directly in front of b');
  assert.equal(next[0]!.group, 'share-b', 'the target minted the shared group');
  assert.equal(next[1]!.group, 'share-b', 'the moved box joined it');
  // A target that already carries a group keeps it.
  const grouped = [overlay('a', 0, { dur: 2 }), overlay('b', 0, { dur: 2, group: 'g9' })];
  assert.equal(restackOverlay(grouped, cfgG, 'a', { onto: 'b' })[1]!.group, 'g9');
  // Without a groupField, sharing degrades to plain adjacency.
  const plain = restackOverlay(before, cfg, 'a', { onto: 'b' });
  assert.deepEqual(plain.map((b) => b.id), ['b', 'a', 's1']);
  assert.equal(plain[1]!.group, undefined, 'no group written where no field is declared');
});

test('restackOverlay: before takes its own row and leaves a shared one', () => {
  const cfgG = { ...cfg, groupField: 'group' };
  const before = [overlay('a', 0, { dur: 2, group: 'g1' }), overlay('b', 3, { dur: 2, group: 'g1' }), overlay('c', 0, { dur: 1 })];
  const next = restackOverlay(before, cfgG, 'b', { before: 'a' });
  assert.deepEqual(next.map((b) => b.id), ['b', 'a', 'c'], 'b now sits directly behind a');
  assert.equal(next[0]!.group, '', 'leaving the shared row clears the group');
  // before: null = in FRONT of every overlay (the new top row).
  const front = restackOverlay(before, cfgG, 'b', { before: null });
  assert.deepEqual(front.map((b) => b.id), ['a', 'c', 'b']);
});

test('restackOverlay: seq boxes are never restacked and identity costs nothing', () => {
  const before = [clip('s1', { start: 0, dur: 3 }), overlay('a', 0, { dur: 2 }), overlay('b', 0, { dur: 2 })];
  assert.equal(restackOverlay(before, cfg, 's1', { onto: 'a' }), before, 'a seq clip is refused');
  assert.equal(restackOverlay(before, cfg, 'a', { onto: 's1' }), before, 'a seq target is refused');
  assert.equal(restackOverlay(before, cfg, 'a', { onto: 'ghost' }), before, 'an unknown target is refused');
  // Dropping b in front of a (onto a) when b is ALREADY directly in front and
  // ungrouped-vs-grouped differs - with no groupField, order unchanged = identity.
  assert.equal(restackOverlay(before, cfg, 'b', { onto: 'a' }), before, 'a no-op drag returns the array by identity');
});
