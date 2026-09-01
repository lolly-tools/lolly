// SPDX-License-Identifier: MPL-2.0
/**
 * transcript-edit - the pure maths behind transcript-driven editing
 * (plans/174-transcript-driven-editing.md). Run with: npm test.
 *
 * Every edit here DELEGATES to the real timeline-math primitives (splitBox,
 * removeAndRipple), so these tests double as a contract check that the
 * "delete a row -> cut the media" mapping stays glued to timeline-math's
 * arithmetic. No framework - node:test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  transcriptRows, deleteMediaRange, ignoreMediaRange, restoreIgnored,
  mediaWindow, snapCut, removedSpansTimeline, originalToEdited, editedToOriginal,
  flattenIgnored,
} from '../shells/web/src/views/transcript-edit.ts';
import { boxTiming, type Box, type TimeCfg } from '../shells/web/src/views/timeline-math.ts';
import type { SpeechWordTiming } from '../packages/core/src/host-v1.ts';

const cfg: TimeCfg = {
  idField: 'id',
  startField: 'start', durField: 'dur', clipInField: 'clipIn', speedField: 'speed',
  enterField: 'enter', exitField: 'exit', enterMsField: 'enterMs', exitMsField: 'exitMs',
  muteField: 'mute', laneField: 'lane',
  ignoredField: 'ignored',
};

/** One 10s seq clip of source `a1`, one word per second: w0..w9. */
const clip10 = (): Box[] => [
  { id: 'c', lane: 'seq', start: 0, dur: 10, clipIn: 0, speed: 1, image: { id: 'a1' } },
];
const WORDS: SpeechWordTiming[] = Array.from({ length: 10 }, (_, i) => ({
  text: `w${i}`, start: i, end: i + 1,
}));

/** Deterministic id minter. */
const minter = () => { let n = 0; return () => `n${++n}`; };

const seqBoxes = (boxes: Box[]): Box[] => boxes.filter((b) => b.lane === 'seq');
const seqDur = (boxes: Box[]): number =>
  seqBoxes(boxes).reduce((s, b) => s + (boxTiming(b, cfg).dur ?? 0), 0);
/** The set of word indices whose media still lives in SOME surviving box. */
const presentWords = (boxes: Box[]): Set<number> =>
  new Set(transcriptRows(WORDS, boxes, cfg, { granularity: 'word' }).flatMap((r) => r.wordIdxs));
/** Word indices that would actually PLAY (surviving and not struck). */
const playedWords = (boxes: Box[]): Set<number> =>
  new Set(
    transcriptRows(WORDS, boxes, cfg, { granularity: 'word' })
      .filter((r) => !r.ignored).flatMap((r) => r.wordIdxs),
  );
const sameSet = (got: Set<number>, want: number[]): void =>
  assert.deepEqual([...got].sort((a, b) => a - b), want);

// ---- mediaWindow -----------------------------------------------------------

test('mediaWindow: [clipIn, clipIn + dur*speed)', () => {
  assert.deepEqual(mediaWindow({ dur: 4, clipIn: 2, speed: 1 } as Box, cfg), { start: 2, end: 6 });
  assert.deepEqual(mediaWindow({ dur: 3, clipIn: 0, speed: 2 } as Box, cfg), { start: 0, end: 6 });
  assert.equal(mediaWindow({ clipIn: 0, speed: 1 } as Box, cfg), null); // open-ended
});

// ---- transcriptRows (projection) ------------------------------------------

test('transcriptRows: sentence granularity groups a whole clip into cues', () => {
  const rows = transcriptRows(WORDS, clip10(), cfg);
  assert.ok(rows.length >= 1);
  assert.equal(rows[0]!.mStart, 0);
  assert.equal(rows.at(-1)!.mEnd, 10);
  assert.equal(rows.every((r) => !r.ignored), true);
});

test('transcriptRows: word granularity yields one row per word, timeline-mapped', () => {
  const rows = transcriptRows(WORDS, clip10(), cfg, { granularity: 'word' });
  assert.equal(rows.length, 10);
  assert.equal(rows[3]!.text, 'w3');
  assert.equal(rows[3]!.mStart, 3);
  assert.equal(rows[3]!.timelineStart, 3); // clipIn 0, speed 1 -> identity
});

test('transcriptRows: a trimmed clip only shows words inside its window', () => {
  // clipIn 3, dur 4 -> media window [3,7): words w3,w4,w5,w6.
  const boxes: Box[] = [{ id: 'c', lane: 'seq', start: 0, dur: 4, clipIn: 3, speed: 1, image: { id: 'a1' } }];
  sameSet(presentWords(boxes), [3, 4, 5, 6]);
  // timeline start rebased: media 3 renders at timeline 0.
  const rows = transcriptRows(WORDS, boxes, cfg, { granularity: 'word' });
  assert.equal(rows[0]!.timelineStart, 0);
});

// ---- deleteMediaRange ------------------------------------------------------

test('delete interior range: split x2 + ripple, gap closes, media excised', () => {
  const out = deleteMediaRange(clip10(), cfg, ['c'], 3, 5, minter());
  assert.equal(seqBoxes(out).length, 2);
  assert.equal(seqDur(out), 8);                 // 10 - 2 removed
  sameSet(presentWords(out), [0, 1, 2, 5, 6, 7, 8, 9]); // w3,w4 gone
  // gapless: seq clips laid end to end.
  const starts = seqBoxes(out).map((b) => boxTiming(b, cfg).start).sort((a, b) => (a! - b!));
  assert.deepEqual(starts, [0, 3]);
});

test('delete head range', () => {
  const out = deleteMediaRange(clip10(), cfg, ['c'], 0, 2, minter());
  assert.equal(seqBoxes(out).length, 1);
  assert.equal(seqDur(out), 8);
  sameSet(presentWords(out), [2, 3, 4, 5, 6, 7, 8, 9]);
});

test('delete tail range', () => {
  const out = deleteMediaRange(clip10(), cfg, ['c'], 8, 10, minter());
  assert.equal(seqDur(out), 8);
  sameSet(presentWords(out), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test('delete whole clip', () => {
  const out = deleteMediaRange(clip10(), cfg, ['c'], 0, 10, minter());
  assert.equal(seqBoxes(out).length, 0);
});

test('delete range spanning an earlier cut (multi-box)', () => {
  const once = deleteMediaRange(clip10(), cfg, ['c'], 3, 5, minter()); // -> c[0,3], n1[5,10]
  const ids = seqBoxes(once).map((b) => String(b.id));
  const twice = deleteMediaRange(once, cfg, ids, 2, 7, minter()); // crosses both boxes
  // survivors: media in [0,2) and [7,10) -> w0,w1,w7,w8,w9
  sameSet(presentWords(twice), [0, 1, 7, 8, 9]);
});

test('deleteMediaRange never mutates its input array', () => {
  const src = clip10();
  const snapshot = JSON.stringify(src);
  deleteMediaRange(src, cfg, ['c'], 3, 5, minter());
  assert.equal(JSON.stringify(src), snapshot);
});

// ---- deleteMediaRange on an OVERLAY chain (where a voiceover lives) ---------
// removeAndRipple only repacks the seq row, so the overlay gap-close is
// deleteMediaRange's own: the carved source's later pieces shift left; other
// sources (a music bed) stay put.

/** A 10s voiceover overlay at start 2, plus a 20s music bed of another source. */
const voiceover = (): Box[] => [
  { id: 'v', lane: '', start: 2, dur: 10, clipIn: 0, speed: 1, image: { id: 'a1' } },
  { id: 'm', lane: '', start: 0, dur: 20, clipIn: 0, speed: 1, image: { id: 'bed' } },
];
const byId = (boxes: Box[], id: string): Box | undefined => boxes.find((b) => b.id === id);
const byClipIn = (boxes: Box[], clipIn: number): Box | undefined =>
  boxes.filter((b) => b.id !== 'm').find((b) => boxTiming(b, cfg).clipIn === clipIn);

test('overlay interior delete closes the gap; another source does not move', () => {
  const out = deleteMediaRange(voiceover(), cfg, ['v'], 3, 5, minter());
  const head = byId(out, 'v')!;
  const tail = byClipIn(out, 5)!;
  assert.deepEqual(
    [boxTiming(head, cfg).start, boxTiming(head, cfg).dur], [2, 3]);
  // tail was minted at timeline 7 and pulled left onto the head's end.
  assert.deepEqual(
    [boxTiming(tail, cfg).start, boxTiming(tail, cfg).dur], [5, 5]);
  assert.equal(boxTiming(byId(out, 'm')!, cfg).start, 0); // bed untouched
});

test('overlay head delete keeps the chain anchored at its original start', () => {
  const out = deleteMediaRange(voiceover(), cfg, ['v'], 0, 2, minter());
  const v = byId(out, 'v')!;
  // trimClip 'in' moved start to 4; the gap-close pulls it back to 2.
  assert.deepEqual(
    [boxTiming(v, cfg).start, boxTiming(v, cfg).dur, boxTiming(v, cfg).clipIn], [2, 8, 2]);
});

test('overlay tail delete pulls later same-source pieces left, preserving their own gap', () => {
  // v1 plays media [0,4) at 2..6; v2 plays media [6,10) at 8..12 (a 2s authored gap).
  const boxes: Box[] = [
    { id: 'v1', lane: '', start: 2, dur: 4, clipIn: 0, speed: 1, image: { id: 'a1' } },
    { id: 'v2', lane: '', start: 8, dur: 4, clipIn: 6, speed: 1, image: { id: 'a1' } },
  ];
  const out = deleteMediaRange(boxes, cfg, ['v1', 'v2'], 2, 4, minter());
  assert.deepEqual(
    [boxTiming(byId(out, 'v1')!, cfg).start, boxTiming(byId(out, 'v1')!, cfg).dur], [2, 2]);
  assert.equal(boxTiming(byId(out, 'v2')!, cfg).start, 6); // shifted 8 -> 6, gap still 2s
});

test("URL-restored string field values: ignored 'false' is NOT struck, 'true' is", () => {
  // url-mode hands every field back as a string; Boolean('false') would strike
  // the whole transcript of any reloaded doc.
  const boxes: Box[] = [
    { id: 'c', lane: 'seq', start: 0, dur: 10, clipIn: 0, speed: 1, ignored: 'false', image: { id: 'a1' } },
  ];
  assert.equal(transcriptRows(WORDS, boxes, cfg, { granularity: 'word' }).some((r) => r.ignored), false);
  boxes[0]!.ignored = 'true';
  assert.equal(transcriptRows(WORDS, boxes, cfg, { granularity: 'word' }).every((r) => r.ignored), true);
});

test('overlay ignore does NOT compress the chain (documented v1 limit)', () => {
  const out = ignoreMediaRange(voiceover(), cfg, ['v'], 3, 5, minter());
  const spans = out
    .filter((b) => b.id !== 'm')
    .map((b) => boxTiming(b, cfg))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  // three pieces, still laid end to end over the ORIGINAL 2..12 span.
  assert.deepEqual(spans.map((s) => s.start), [2, 5, 7]);
});

// ---- ignoreMediaRange (strikethrough) -------------------------------------

test('ignore interior: media stays, middle box flagged, present but not played', () => {
  const out = ignoreMediaRange(clip10(), cfg, ['c'], 3, 5, minter());
  assert.equal(seqBoxes(out).length, 3);       // c, ignored middle, tail - nothing removed
  sameSet(presentWords(out), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // all media retained
  sameSet(playedWords(out), [0, 1, 2, 5, 6, 7, 8, 9]);        // w3,w4 skipped
  const struck = transcriptRows(WORDS, out, cfg, { granularity: 'word' }).filter((r) => r.ignored);
  assert.deepEqual(struck.map((r) => r.text), ['w3', 'w4']);
});

test('restoreIgnored un-strikes a box', () => {
  const ig = ignoreMediaRange(clip10(), cfg, ['c'], 3, 5, minter());
  const struckId = transcriptRows(WORDS, ig, cfg, { granularity: 'word' }).find((r) => r.ignored)!.boxId;
  const back = restoreIgnored(ig, cfg, struckId);
  sameSet(playedWords(back), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]); // all play again
});

test('ignore is a no-op when the tool declares no ignoredField', () => {
  const plain: TimeCfg = { ...cfg, ignoredField: undefined };
  const out = ignoreMediaRange(clip10(), plain, ['c'], 3, 5, minter());
  assert.equal(JSON.stringify(out), JSON.stringify(clip10()));
});

// ---- keep-projection: preview == export -----------------------------------

test('flattenIgnored == what playback skips (one keep-projection)', () => {
  const ig = ignoreMediaRange(clip10(), cfg, ['c'], 3, 5, minter());
  const spans = removedSpansTimeline(ig, cfg);
  assert.deepEqual(spans, [{ start: 3, end: 5 }]);

  const flat = flattenIgnored(ig, cfg);           // export projection
  assert.equal(seqBoxes(flat).length, 2);
  assert.equal(seqDur(flat), 8);
  sameSet(presentWords(flat), [0, 1, 2, 5, 6, 7, 8, 9]); // identical to a hard delete

  // the two agree: export length === played length of the full ruler.
  const fullDur = 10;
  assert.equal(seqDur(flat), originalToEdited(spans, fullDur));
});

test('originalToEdited / editedToOriginal round-trip in kept regions', () => {
  const spans = [{ start: 3, end: 5 }];
  assert.equal(originalToEdited(spans, 2), 2);   // before the cut
  assert.equal(originalToEdited(spans, 8), 6);   // after: 8 - 2 removed
  assert.equal(editedToOriginal(spans, 6), 8);   // inverse
  for (const e of [0, 1, 2.5, 3, 6]) {
    assert.ok(Math.abs(originalToEdited(spans, editedToOriginal(spans, e)) - e) < 1e-9);
  }
});

// ---- snapCut ---------------------------------------------------------------

test('snapCut lands on the midpoint of the nearest inter-word gap', () => {
  // words 0-0.4, 1-1.4 -> gap [0.4,1.0], midpoint 0.7.
  const w: SpeechWordTiming[] = [
    { text: 'a', start: 0, end: 0.4 },
    { text: 'b', start: 1.0, end: 1.4 },
  ];
  assert.ok(Math.abs(snapCut(w, 0.6) - 0.7) < 1e-9);
  assert.ok(Math.abs(snapCut(w, 0.9) - 0.7) < 1e-9);
});

test('snapCut returns the input when words are contiguous (no gap)', () => {
  assert.equal(snapCut(WORDS, 3.2), 3.2); // WORDS touch end-to-start, no gaps
});

// ---- regressions from the adversarial review (all CONFIRMED, now fixed) -----

const survWindow = (boxes: Box[]): { start: number; end: number } => {
  const b = seqBoxes(boxes)[0]!;
  return mediaWindow(b, cfg)!;
};

test('speed>1 head delete trims (does NOT no-op) - review finding 1', () => {
  // box media [0,4], timeline [0,2]. Delete media [0,1] (0.5s timeline).
  const w4: SpeechWordTiming[] = [0, 1, 2, 3].map((i) => ({ text: `w${i}`, start: i, end: i + 1 }));
  const boxes: Box[] = [{ id: 'c', lane: 'seq', start: 0, dur: 2, clipIn: 0, speed: 2, image: { id: 'a1' } }];
  const out = deleteMediaRange(boxes, cfg, ['c'], 0, 1, minter());
  assert.equal(seqBoxes(out).length, 1);
  assert.ok(Math.abs(survWindow(out).start - 1) < 1e-6);      // clipIn advanced to media 1
  assert.equal(new Set(transcriptRows(w4, out, cfg, { granularity: 'word' }).flatMap((r) => r.wordIdxs)).has(0), false);
});

test('speed>1 tail delete trims - review finding 1 (tail)', () => {
  const boxes: Box[] = [{ id: 'c', lane: 'seq', start: 0, dur: 2, clipIn: 0, speed: 2, image: { id: 'a1' } }];
  const out = deleteMediaRange(boxes, cfg, ['c'], 3, 4, minter()); // remove media [3,4]
  assert.ok(Math.abs(survWindow(out).end - 3) < 1e-6);
});

test('near-edge delete does not silently no-op (dead zone) - review findings 3 & 5', () => {
  // head remainder 0.05s < MIN_DUR: must snap to the head, not refuse.
  const out = deleteMediaRange(clip10(), cfg, ['c'], 0.05, 6, minter());
  assert.equal(seqBoxes(out).length, 1);
  sameSet(presentWords(out), [6, 7, 8, 9]);          // media [~0,6] gone
  // and a trimmed clip whose head sits at clipIn 3.05 (finding 5's exact shape)
  const trimmed: Box[] = [{ id: 'c', lane: 'seq', start: 0, dur: 6.95, clipIn: 3.05, speed: 1, image: { id: 'a1' } }];
  const out2 = deleteMediaRange(trimmed, cfg, ['c'], 3.1, 4.0, minter());
  assert.ok(Math.abs(survWindow(out2).start - 4.0) < 1e-6); // NOT unchanged at 3.05
});

test('ignored OVERLAY does not enter the play-time map - review finding 2', () => {
  const boxes: Box[] = [
    { id: 'c', lane: 'seq', start: 0, dur: 10, clipIn: 0, speed: 1, image: { id: 'a1' } },
    { id: 'o', start: 2, dur: 3, clipIn: 0, speed: 1, ignored: true, image: { id: 'a2' } },
  ];
  assert.deepEqual(removedSpansTimeline(boxes, cfg), []);       // overlay compresses nothing
  assert.equal(seqDur(flattenIgnored(boxes, cfg)), 10);         // export keeps the seq length
  assert.equal(originalToEdited(removedSpansTimeline(boxes, cfg), 10), 10); // preview agrees
});

test('a word straddling a box boundary is one row, not two - review finding 4', () => {
  const boxes: Box[] = [
    { id: 'c1', lane: 'seq', start: 0, dur: 3.5, clipIn: 0, speed: 1, image: { id: 'a1' } },
    { id: 'c2', lane: 'seq', start: 3.5, dur: 6.5, clipIn: 3.5, speed: 1, image: { id: 'a1' } },
  ];
  const rows = transcriptRows(WORDS, boxes, cfg, { granularity: 'word' });
  const idxs = rows.flatMap((r) => r.wordIdxs);
  assert.equal(idxs.length, new Set(idxs).size); // no duplicates
  assert.equal(rows.length, 10);                 // each word exactly once
});
