// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-math — the pure time math behind the timeline panel (Fable timeline, phase 2).
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework — node:test.
 *
 * Spec: plans/fable-timeline-phase-2.md §1. This file is the phase's real safety net:
 * every interaction edge case (trim clamps, split boundaries, magnetic reorder,
 * overlay ripple, snapping) is asserted here rather than in the DOM controller, so
 * the panel only has to get its wiring right.
 *
 * The parity block below loads the REAL layout-studio hooks.js off disk and runs its
 * seqDurationMs against deriveDuration for the same rows — the artboard's data-seq-ms
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
  detachAudio, isThroughEdit, joinClips, reattachAudio, splitAll,
  onionNeighbours, ONION_MAX_STEPS,
  snapTime, splitBox, trimClip,
  type Box, type TimeCfg,
} from '../shells/web/src/views/timeline-math.ts';

// The field names phase 1 locked into BOTH brand copies of layout-studio's canvas cfg.
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
/** Scenery — never timed, invisible to every function in the module. */
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

test('boxTiming: lane is only ever "" or "seq" — any other value is an overlay', () => {
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

// ── 2. deriveDuration — parity with the hook ───────────────────────────────────

test('deriveDuration: hand-computed cases (milliseconds, matching data-seq-ms)', () => {
  // Nothing timed at all.
  assert.equal(deriveDuration([scenery('a'), scenery('b')], cfg), 0);
  assert.equal(deriveDuration([], cfg), 0);
  // Timed, but nothing carries a duration → the 5 s fallback.
  assert.equal(deriveDuration([clip('a'), overlay('b', 1)], cfg), DEFAULT_SEQ_S * 1000);
  // max(start + dur) wins, whichever lane it is on.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2.5 }), clip('b', { start: 2.5, dur: 3 })], cfg), 5500);
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2 }), overlay('ov', 4, { dur: 2.4 })], cfg), 6400);
  // dur is TIMELINE seconds — speed must never scale it.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 4, speed: 2 })], cfg), 4000);
  // A single open-ended clip alongside a measured one does not extend the length.
  assert.equal(deriveDuration([clip('a', { start: 0, dur: 2 }), clip('b', { start: 2 })], cfg), 2000);
});

test('deriveDuration: byte-identical to layout-studio hooks.js seqDurationMs', () => {
  // Load the REAL hook off disk and lift its internal seqDurationMs out. brands/
  // lolly-start is parent-owned (brands/suse is a private, CI-skipped submodule).
  const hooksPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'tools', 'layout-studio', 'hooks.js');
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

test('packSeq: idempotent — pack(pack(x)) deep-equals pack(x), and stops allocating', () => {
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
  // Array (z) order is untouched — the row order lives in `start`, not in the array.
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

test('trimClip in: dragging past the far edge clamps to MIN_DUR — never zero, never negative', () => {
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

test('trimClip in: the t=0 bound is an OVERLAY rule — the first seq clip can give its head back', () => {
  // On the magnetic row `start` is re-derived by packOrder at the end of trimClip, so
  // "cannot go before t=0" constrains nothing there — except at index 0, where start
  // really is 0 and the bound used to pin the delta window shut. The result was that a
  // head trim on the FIRST clip was the one trim in a sequence that could never be
  // dragged back out, however much source was still sitting behind the in-point.
  const rows = [clip('a', { start: 0, dur: 3, clipIn: 2 }), clip('b', { start: 3, dur: 3, clipIn: 0 })];
  const a = byId(trimClip(rows, cfg, 'a', 'in', -1, null), 'a');
  assert.equal(a.clipIn, 1, 'a second of the source head came back');
  assert.equal(a.dur, 4, 'and the clip is a second longer for it');
  assert.equal(a.start, 0, 'the magnetic row still starts at zero');
  // The same clip at a non-zero start behaves identically — the fix removed a
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
  assert.equal((a.dur as number) + (b.dur as number), 4, 'durations sum unchanged — the seq row needs no repack');
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
  // a's old end — half-open [0,2) excludes it, so it belongs to b and moves with b.
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
  assert.equal(byId(after, 'far').start, 50, 'past the end of the row — nothing to anchor to');
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
  // Below the floor there is no zone at all — the whole bar stays grabbable.
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
      // straight through unchanged — these functions rewrite timing, they do not
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
// (3.3335 s) and a split time comes from pointer-px ÷ pxPerSec — neither is ever a
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
  // Whatever route a time takes, the stored value is identical — this is the invariant
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
  assert.deepEqual(startsOf(after), startsOf(packed), 'unchanged — use moveSeqClip instead');
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
  // Dragging `a` across its OWN midpoint must not advance the index — it is already there.
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
// clipIn + dur x speed <= media. Violating it is unrecoverable at playback time —
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
  // 4s of file at x4 is 1s of timeline — the old raw write left dur at 4 and the clip
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
  // The panel's mintId reads getBoxes(), which does not move during the fold — so a
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
    'a fresh cut is a through edit — nothing has been decided yet');

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
  assert.equal(isThroughEdit(rows, cfg, 'b', 'a', sameSrc), false, 'order matters — b does not precede a');
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

test('joinClips: a clip with NO exit round-trips too — absence is carried, not undefined', () => {
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

/** A cfg that DECLARES the link sub-field — the opt-in the manifest makes. */
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

  assert.equal(audio.lane, '', 'the sound lands on an OVERLAY lane — packSeq must never see it');
  assert.equal(audio.mute, '', 'the sound is the half that plays');
  assert.equal(audio.enter, 'none');
  assert.equal(audio.exit, 'none');

  // The link is written on BOTH sides — that is what makes re-attach reachable either way.
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
  assert.equal(detachAudio(rows, cfg, 'v', mintId), null, 'no linkField declared — the feature is not offered');
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
  assert.equal(reattachAudio(rows, linkCfg, 'v'), null, 'the partner does not exist — group of one');
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
  // One instant earlier is still s1 — so the ghosts flip on the SAME frame the picture
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
    'the first scene has no past at all — clamped, never wrapped');
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
  // A junk count draws NOTHING on that side — the safe direction for a decoration.
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, NaN as unknown as number, 2), { past: [], future: [] });
  assert.deepEqual(onionNeighbours(rows, cfg, 6.5, 1.9, 0), { past: ['s3'], future: [] }, 'a fraction floors');
});

test('onionNeighbours: nothing active, an empty lane and a gap all return two empty arrays', () => {
  const rows = SCENES();
  assert.deepEqual(onionNeighbours(rows, cfg, 99, 2, 2), { past: [], future: [] }, 'past the end');
  assert.deepEqual(onionNeighbours([], cfg, 1, 2, 2), { past: [], future: [] }, 'empty model');
  assert.deepEqual(onionNeighbours([scenery('x'), overlay('o', 0, { dur: 5 })], cfg, 1, 2, 2),
    { past: [], future: [] }, 'no seq lane at all');
  // A gap in the row (possible only from a hand-edited ?boxes= — packSeq never leaves
  // one): the playhead is inside nothing, so there is no "either side" to speak of.
  const gapped = [clip('a', { start: 0, dur: 1 }), clip('b', { start: 5, dur: 1 })];
  assert.deepEqual(onionNeighbours(gapped, cfg, 3, 2, 2), { past: [], future: [] });
});

test('onionNeighbours: SEQ LANE ONLY — overlays are never ghosted and never counted', () => {
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
  // end of the sequence", where the end is deriveDuration's — here stretched to 10s by
  // an overlay. This must agree with span() or the ghosts would blink out early.
  const rows: Box[] = [
    clip('a', { start: 0, dur: 3 }),
    clip('b', { start: 3 }),
    overlay('bed', 0, { dur: 10 }),
  ];
  assert.deepEqual(onionNeighbours(rows, cfg, 5, 1, 1), { past: ['a'], future: [] },
    'b is still on screen at 5s because the sequence runs to 10');
  // With nothing else to stretch it the derived end IS a's end, so the open clip
  // collapses to the MIN_DUR floor — the same (deliberate) reading span() takes.
  const bare = [clip('a', { start: 0, dur: 3 }), clip('b', { start: 3 })];
  assert.deepEqual(onionNeighbours(bare, cfg, 3.05, 1, 1), { past: ['a'], future: [] });
  assert.deepEqual(onionNeighbours(bare, cfg, 3.5, 1, 1), { past: [], future: [] });
});
