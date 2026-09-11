// SPDX-License-Identifier: MPL-2.0
/**
 * transcript-edit.ts - the pure maths behind transcript-driven editing
 * (plans/174-transcript-driven-editing.md). "Delete a row deletes that part of
 * the clip"; "strike a row and it greys out but stays recoverable".
 *
 * The idea the whole design rests on (plan section 2): the timeline `boxes` ARE the cut-range
 * EDL. A box plays source seconds `[clipIn, clipIn + dur*speed)`; a hard delete
 * `removeAndRipple`s the box (gap closes), a strikethrough leaves the box in
 * place but flags it `ignored`. So there is NO separate per-word edit-state
 * store to drift against the boxes - the transcript is a PROJECTION of
 * (source words that still fall inside a surviving box window), and every edit
 * DELEGATES to timeline-math's already-tested ripple primitives.
 *
 * DOM-free and host-free on purpose, like timeline-captions.ts: words + boxes
 * in, rows / new box arrays out. The panel owns the box<->asset resolution
 * (refOf) and hands us the pre-filtered list of a source's boxes; all the
 * correctness lives here, headless-testable, exactly as plans/53 established for
 * timeline-math and plans/54 for the sequence planner.
 */

import type { CaptionCue, GroupWordsOpts } from '../../../../engine/src/captions.ts';
import { groupWordsToCues } from '../../../../engine/src/captions.ts';
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';
import type { Box, TimeCfg, MediaDurFn } from './timeline-math.ts';
import { boxTiming, packSeq, removeAndRipple, splitBox, trimClip, MIN_DUR } from './timeline-math.ts';
import { cueSpansOnTimeline, type CueSourceTiming } from './timeline-captions.ts';

/** Slop for "does this carve reach the box edge" tests, in seconds. Below any
 *  editable length (MIN_DUR) and below a single video frame. */
const EDGE_EPS = 1e-4;

/** One editable transcript row - a cue (sentence) or a single word, with BOTH
 *  its media span (source seconds - what a delete/ignore acts on) and its
 *  timeline span (what the panel highlights and seeks to). */
export interface TranscriptRow {
  text: string;
  /** Media (source-file) seconds - the range a delete/ignore removes. */
  mStart: number;
  mEnd: number;
  /** This row's position on the sequence timeline, in seconds. */
  timelineStart: number;
  timelineEnd: number;
  /** The box currently rendering this row's media (an edit target). */
  boxId: string;
  /** True when this row's box is struck through (present but skipped). */
  ignored: boolean;
  /** Indices into the source `words` array this row covers (read-along/highlight). */
  wordIdxs: number[];
}

export interface TranscriptRowsOpts {
  /** 'sentence' (default) groups words into cues; 'word' is one row per word. */
  granularity?: 'sentence' | 'word';
  /** Passed to groupWordsToCues at sentence granularity. */
  group?: GroupWordsOpts;
}

const idOf = (b: Box, cfg: TimeCfg): string => String(b[cfg.idField] ?? '');
// A URL-restored box carries STRING field values, so the wire's 'false' must
// read as false - same rule as the panel's muteField/boxIgnored readers.
const isIgnored = (b: Box, cfg: TimeCfg): boolean =>
  !!cfg.ignoredField && (b[cfg.ignoredField] === true || b[cfg.ignoredField] === 'true');

/** The media window `[clipIn, clipIn + dur*speed)` a box plays, or null when the
 *  box is open-ended / untimed (a transcript needs a bounded clip). */
export function mediaWindow(box: Box, cfg: TimeCfg): { start: number; end: number } | null {
  const t = boxTiming(box, cfg);
  if (t.dur == null) return null;
  const start = t.clipIn;
  const end = t.clipIn + t.dur * t.speed;
  return end > start ? { start, end } : null;
}

/**
 * Project the source's word timings through its surviving boxes into ordered,
 * editable rows. A word appears iff it overlaps some box's media window; a word
 * in NO box's window was deleted and simply has no row. A word whose box is
 * `ignored` still gets a row, flagged, so the panel can render it struck.
 *
 * `sourceBoxes` is the caller-filtered set of boxes rendering ONE source asset
 * (the panel gathers them by asset id off `refOf`). Order is irrelevant; rows
 * come back in timeline order.
 */
export function transcriptRows(
  words: readonly SpeechWordTiming[],
  sourceBoxes: readonly Box[],
  cfg: TimeCfg,
  opts: TranscriptRowsOpts = {},
): TranscriptRow[] {
  const perWord = opts.granularity === 'word';
  const rows: TranscriptRow[] = [];

  // Sort boxes by timeline position so concatenated rows read top-to-bottom.
  const ordered = sourceBoxes
    .map((b) => ({ b, t: boxTiming(b, cfg) }))
    .filter((x) => x.t.dur != null)
    .sort((a, b) => (a.t.start ?? 0) - (b.t.start ?? 0));

  for (const { b, t } of ordered) {
    const win = mediaWindow(b, cfg);
    if (!win) continue;
    const src: CueSourceTiming = { start: t.start ?? 0, dur: t.dur as number, clipIn: t.clipIn, speed: t.speed };
    const ignored = isIgnored(b, cfg);
    const boxId = idOf(b, cfg);

    // Assign each word to exactly ONE box by its MIDPOINT, so a word whose media
    // straddles a box boundary (a mid-word cut) is not emitted twice with
    // contradictory ignored flags. A word whose midpoint fell in a deleted gap
    // belongs to no box and correctly vanishes.
    const inWin: { w: SpeechWordTiming; i: number }[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i]!;
      const mid = (w.start + w.end) / 2;
      if (mid >= win.start && mid < win.end) inWin.push({ w, i });
    }
    if (!inWin.length) continue;

    const cues: CaptionCue[] = perWord
      ? inWin.map(({ w }) => ({ start: w.start, end: w.end, text: w.text.trim() }))
      : groupWordsToCues(inWin.map(({ w }) => w), opts.group);

    for (const cue of cues) {
      // Map through the CANONICAL trim maths, per cue, so media<->timeline never
      // drifts from timeline-captions. Dropped (fully trimmed) cues just vanish.
      const [mapped] = cueSpansOnTimeline([cue], src);
      if (!mapped) continue;
      const wordIdxs = inWin.filter(({ w }) => w.start < cue.end && w.end > cue.start).map(({ i }) => i);
      rows.push({
        text: mapped.text,
        mStart: cue.start,
        mEnd: cue.end,
        timelineStart: mapped.start,
        timelineEnd: mapped.end,
        boxId,
        ignored,
        wordIdxs,
      });
    }
  }
  return rows;
}

/**
 * Nudge a raw media-time cut to the midpoint of the nearest inter-word gap, so a
 * cut falls in silence rather than clipping a consonant (plan section 3, v1 - no
 * VAD needed, we have exact word boundaries). Returns `mSec` unchanged when the
 * words are contiguous around it (no gap to snap to). `side` biases nothing today
 * but is kept in the signature so a later asymmetric pad has a place to live.
 */
export function snapCut(words: readonly SpeechWordTiming[], mSec: number, _side: 'in' | 'out' = 'in'): number {
  if (!Number.isFinite(mSec) || words.length < 2) return mSec;
  const ws = [...words].sort((a, b) => a.start - b.start);
  let best: { mid: number; dist: number } | null = null;
  for (let i = 1; i < ws.length; i++) {
    const gapLo = ws[i - 1]!.end;
    const gapHi = ws[i]!.start;
    if (gapHi <= gapLo) continue; // no gap (overlap / touching)
    const mid = (gapLo + gapHi) / 2;
    // Distance to the gap: 0 if mSec is inside it, else to the nearer edge.
    const dist = mSec < gapLo ? gapLo - mSec : mSec > gapHi ? mSec - gapHi : 0;
    if (!best || dist < best.dist) best = { mid, dist };
    if (dist === 0) break; // inside a gap - can't do better
  }
  return best ? best.mid : mSec;
}

type CarveMode = 'delete' | 'ignore';

/** Set `ignoredField` true on the box with `id` (no-op if the tool declares none). */
function flag(boxes: Box[], cfg: TimeCfg, id: string): Box[] {
  if (!cfg.ignoredField) return boxes.map((b) => b);
  const f = cfg.ignoredField;
  return boxes.map((b) => (idOf(b, cfg) === id ? { ...b, [f]: true } : b));
}

/** Split `boxes` at timeline second `tl`, returning the array and the RIGHT
 *  half's minted id, or null when the cut is refused (too near an edge). */
function splitAt(
  boxes: Box[], cfg: TimeCfg, id: string, tl: number, mint: () => string,
): { boxes: Box[]; rightId: string } | null {
  let rightId = '';
  const next = splitBox(boxes, cfg, id, tl, () => (rightId = mint()));
  return next ? { boxes: next, rightId } : null;
}

/** Carve one source box's `[a,b]` media portion out (delete) or grey it (ignore).
 *
 * The edge test uses MIN_DUR, not EDGE_EPS: when a remainder on one side would be
 * a sub-MIN_DUR sliver, `splitBox` refuses to mint it, so that side must be
 * treated as reaching the edge. A DELETE at an edge is a TRIM (there is no
 * remainder box to keep), which sidesteps the refusal for any portion size and
 * for speed != 1; only the INTERIOR case needs the two splits. An IGNORE must
 * leave a flagged box, so it always splits - and a sub-MIN_DUR ignore that
 * splitBox refuses is a no-op (a piece too small to be its own box).
 */
function carveOneBox(
  boxes: Box[], cfg: TimeCfg, id: string, aMedia: number, bMedia: number,
  mint: () => string, mode: CarveMode, mediaDur?: MediaDurFn,
): Box[] {
  const box = boxes.find((b) => idOf(b, cfg) === id);
  if (!box) return boxes;
  const win = mediaWindow(box, cfg);
  const t = boxTiming(box, cfg);
  if (!win || t.dur == null) return boxes;
  const a = Math.max(win.start, Math.min(aMedia, bMedia));
  const b = Math.min(win.end, Math.max(aMedia, bMedia));
  if (!(b - a > EDGE_EPS)) return boxes; // nothing of this box is in range

  const start = t.start ?? 0;
  const tlEnd = start + t.dur;
  // a,b are clamped into the window, so toTl stays in [start, tlEnd] exactly.
  const toTl = (m: number): number => start + (m - win.start) / t.speed;
  const tlA = toTl(a);
  const tlB = toTl(b);
  const atHead = tlA - start < MIN_DUR;   // no keepable left remainder
  const atTail = tlEnd - tlB < MIN_DUR;   // no keepable right remainder

  if (mode === 'delete') {
    if (atHead && atTail) return removeAndRipple(boxes, cfg, id, mediaDur); // whole box
    // Head/tail deletes are trims - no remainder box, so no MIN_DUR sliver, at any
    // speed. Media length is not needed to SHRINK a clip; pass null.
    if (atHead) return trimClip(boxes, cfg, id, 'in', tlB - start, null, mediaDur);
    if (atTail) return trimClip(boxes, cfg, id, 'out', -(tlEnd - tlA), null, mediaDur);
    // Interior: split off [a,end], split that at b, remove the middle [a,b].
    const s1 = splitAt(boxes, cfg, id, tlA, mint);
    if (!s1) return boxes;
    const s2 = splitAt(s1.boxes, cfg, s1.rightId, tlB, mint);
    if (!s2) return boxes;
    return removeAndRipple(s2.boxes, cfg, s1.rightId, mediaDur); // middle keeps s1's right id
  }

  // ignore: always isolate the piece into its own box, then flag it.
  if (atHead && atTail) return flag(boxes, cfg, id); // whole box
  if (atHead) {
    const s = splitAt(boxes, cfg, id, tlB, mint); // left=id [start,b] ignored, right plays
    return s ? flag(s.boxes, cfg, id) : boxes;
  }
  if (atTail) {
    const s = splitAt(boxes, cfg, id, tlA, mint); // right=newId [a,end] ignored
    return s ? flag(s.boxes, cfg, s.rightId) : boxes;
  }
  const s1 = splitAt(boxes, cfg, id, tlA, mint);
  if (!s1) return boxes;
  const s2 = splitAt(s1.boxes, cfg, s1.rightId, tlB, mint);
  if (!s2) return boxes;
  return flag(s2.boxes, cfg, s1.rightId);
}

/**
 * Carve a media range `[mStart,mEnd)` out of every source box it overlaps. The
 * shared core of {@link deleteMediaRange} and {@link ignoreMediaRange}: it
 * collects the overlapping targets up front (each box's window is in its own
 * media coordinates and unaffected by another box's carve), then folds one carve
 * per box - so a selection that crosses an earlier cut is handled correctly.
 */
function carveMediaRange(
  boxes: readonly Box[], cfg: TimeCfg, sourceIds: Iterable<string>,
  mStart: number, mEnd: number, mint: () => string, mode: CarveMode,
  mediaDur?: MediaDurFn,
): Box[] {
  const lo = Math.min(mStart, mEnd);
  const hi = Math.max(mStart, mEnd);
  const ids = sourceIds instanceof Set ? sourceIds : new Set(sourceIds);
  if (!(hi - lo > EDGE_EPS)) return boxes.map((b) => b);

  // Snapshot the overlap of each source box up front (ids/windows are stable
  // across sibling carves - only `start` ripples, which we don't rely on here).
  const targets: { id: string; a: number; b: number }[] = [];
  for (const box of boxes) {
    const id = idOf(box, cfg);
    if (!ids.has(id)) continue;
    const win = mediaWindow(box, cfg);
    if (!win) continue;
    const a = Math.max(win.start, lo);
    const b = Math.min(win.end, hi);
    if (b - a > EDGE_EPS) targets.push({ id, a, b });
  }

  // The pieces this run mints join the source's chain, so a later target's
  // gap-close shifts them too.
  const chain = new Set(ids);
  const mintChained = (): string => { const m = mint(); chain.add(m); return m; };

  let out: Box[] = boxes.map((b) => b);
  for (const t of targets) {
    // Pre-carve timing: the carve's own timeline span, for the gap-close.
    const box = out.find((b) => idOf(b, cfg) === t.id);
    const bt = box ? boxTiming(box, cfg) : null;
    const win = box ? mediaWindow(box, cfg) : null;
    out = carveOneBox(out, cfg, t.id, t.a, t.b, mintChained, mode, mediaDur);
    // Overlay gap-close, DELETE only: removeAndRipple repacks the SEQ row, so a
    // seq carve is already gapless - an overlay chain (where a voiceover lives)
    // must close its own gap or a deleted sentence leaves a hole of silence.
    // Shifting is scoped to the carved source's own boxes: a music bed or a
    // second speaker underneath keeps its place.
    // ponytail: one source's chain only - multi-speaker ripple is a later rung.
    if (mode !== 'delete' || !bt || !win || bt.dur == null || bt.lane === 'seq') continue;
    const start = bt.start ?? 0;
    const tlA = start + (t.a - win.start) / bt.speed;
    const tlB = start + (t.b - win.start) / bt.speed;
    const d = tlB - tlA;
    if (!(d > EDGE_EPS)) continue;
    out = out.map((b) => {
      if (!chain.has(idOf(b, cfg))) return b;
      const bx = boxTiming(b, cfg);
      if (bx.lane === 'seq' || bx.start == null || bx.start < tlB - EDGE_EPS) return b;
      return { ...b, [cfg.startField]: Math.max(0, Math.round((bx.start - d) * 1000) / 1000) };
    });
  }
  return out;
}

/**
 * Hard-delete a media range: split the covering box(es) at the range edges and
 * `removeAndRipple` the piece(s), closing the gap - the seq row via packSeq,
 * an overlay chain by shifting the same source's later pieces left. Reversible
 * only via the undo stack (that is the v1 contract, plan section 9 Q2).
 */
export function deleteMediaRange(
  boxes: readonly Box[], cfg: TimeCfg, sourceIds: Iterable<string>,
  mStart: number, mEnd: number, mint: () => string,
  mediaDur?: MediaDurFn,
): Box[] {
  return carveMediaRange(boxes, cfg, sourceIds, mStart, mEnd, mint, 'delete', mediaDur);
}

/**
 * Strikethrough / ignore a media range: same split, but the piece is flagged
 * `ignored` instead of removed - it stays in the ruler, greyed, and is skipped
 * by playback and export. A persistent, reversible toggle (plan section 5.5).
 * No-op when the tool declares no `ignoredField`.
 */
export function ignoreMediaRange(
  boxes: readonly Box[], cfg: TimeCfg, sourceIds: Iterable<string>,
  mStart: number, mEnd: number, mint: () => string,
  mediaDur?: MediaDurFn,
): Box[] {
  // A tool with no `ignoredField` can't express a strike - do NOTHING rather
  // than fragment the timeline with splits whose flag would silently no-op.
  if (!cfg.ignoredField) return boxes.map((b) => b);
  return carveMediaRange(boxes, cfg, sourceIds, mStart, mEnd, mint, 'ignore', mediaDur);
}

/** Un-strike: clear the `ignored` flag on a box (bring it back). */
export function restoreIgnored(boxes: readonly Box[], cfg: TimeCfg, id: string): Box[] {
  if (!cfg.ignoredField) return boxes.map((b) => b);
  const f = cfg.ignoredField;
  return boxes.map((b) => (idOf(b, cfg) === id ? { ...b, [f]: false } : b));
}

/** A skipped span on the timeline, in seconds. */
export interface Span { start: number; end: number }

/**
 * The timeline spans occupied by `ignored` boxes, merged and sorted. These are
 * the spans playback and export skip; feed them to {@link originalToEdited}.
 */
export function removedSpansTimeline(boxes: readonly Box[], cfg: TimeCfg): Span[] {
  const raw: Span[] = [];
  for (const b of boxes) {
    if (!isIgnored(b, cfg)) continue;
    const t = boxTiming(b, cfg);
    if (t.dur == null) continue;
    // Only a SEQ clip's time closes when it's dropped (removeAndRipple repacks the
    // row); an ignored OVERLAY just hides in place and compresses nothing, so it
    // must not enter the play-time map or preview and export disagree.
    if (t.lane !== 'seq') continue;
    const start = t.start ?? 0;
    raw.push({ start, end: start + t.dur });
  }
  raw.sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + EDGE_EPS) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

/**
 * Map an ORIGINAL timeline second to the EDITED (played) second, subtracting the
 * length of every skipped span before it (Rescript's `originalToEdited`). Keeps
 * the transcript playhead advancing smoothly over struck spans.
 */
export function originalToEdited(spans: readonly Span[], t: number): number {
  let removed = 0;
  for (const s of spans) {
    if (t >= s.end) removed += s.end - s.start;
    else if (t > s.start) removed += t - s.start;
    else break; // spans are sorted; nothing further is before t
  }
  return Math.max(0, t - removed);
}

/**
 * The inverse: an EDITED second back to the ORIGINAL timeline second, so a scrub
 * in played-time places the real playhead correctly. Adds back each skipped span
 * that lies at or before the running original position.
 */
export function editedToOriginal(spans: readonly Span[], e: number): number {
  let orig = Math.max(0, e);
  for (const s of spans) {
    if (orig >= s.start) orig += s.end - s.start;
    else break;
  }
  return orig;
}

/**
 * Collapse every `ignored` box into a real delete - the EXPORT projection and,
 * written back to the model, Descript's irreversible "Flatten tracks". Because
 * both playback (via {@link originalToEdited}) and export (this) consume the same
 * ignored set, preview == export by construction (plan section 5.5).
 */
export function flattenIgnored(
  boxes: readonly Box[], cfg: TimeCfg, mediaDur?: MediaDurFn,
): Box[] {
  if (!cfg.ignoredField) return boxes.map((b) => b);
  const ids = boxes.filter((b) => isIgnored(b, cfg)).map((b) => idOf(b, cfg));
  let out: Box[] = boxes.map((b) => b);
  for (const id of ids) out = removeAndRipple(out, cfg, id, mediaDur);
  return out;
}

// ─── Regeneration: re-fitting the cuts and skips (plans/181 section 5.3) ──────

/**
 * One regenerated span, in the clip's OLD source seconds: the range that was
 * re-synthesized and how much longer (or shorter) the new audio is. A merged or
 * split sentence arrives as one wider range, because the hunk that produced it
 * covered every old line it touched.
 */
export interface SentenceEdit {
  /** Start of the replaced range, in old source seconds. */
  from: number;
  /** End of the replaced range, in old source seconds. */
  to: number;
  /** New length minus old length, in seconds. */
  delta: number;
}

/** Lowercased, punctuation-free comparison key - what alignWords matches on. */
function alignKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Match two lists of strings and report, for each index in `a`, the index in
 * `b` holding the same string (null when it has no counterpart). A longest
 * common subsequence, so unchanged entries either side of an insertion, a
 * deletion or a replacement all keep their pairing.
 *
 * Shared by {@link alignWords} (which feeds it words with case and punctuation
 * removed) and by the transcript panel's line diff (which feeds it whole
 * script lines, compared exactly, because punctuation IS the edit there).
 */
export function lcsMap(a: readonly string[], b: readonly string[]): (number | null)[] {
  const n = a.length;
  const m = b.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n === 0 || m === 0) return out;

  // dp[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const w = m + 1;
  const dp = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * w + j] = a[i] === b[j]
        ? (dp[(i + 1) * w + j + 1] as number) + 1
        : Math.max(dp[(i + 1) * w + j] as number, dp[i * w + j + 1] as number);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out[i] = j; i++; j++; continue; }
    if ((dp[(i + 1) * w + j] as number) >= (dp[i * w + j + 1] as number)) i++;
    else j++;
  }
  return out;
}

/**
 * Align an old run of words to a new one: for each OLD index, the NEW index it
 * is the same word as, or null.
 *
 * Case and punctuation come off first, so this is the identity for a
 * punctuation-only edit (the common case: "wow" becoming "wow!"), and still
 * finds the unchanged words around a typo fix, an inserted word, or a token
 * the normalizer split ("$45" being read as "45 dollars").
 */
export function alignWords(oldWords: readonly string[], newWords: readonly string[]): (number | null)[] {
  return lcsMap(oldWords.map(alignKey), newWords.map(alignKey));
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** The word indices whose midpoint falls inside `[lo, hi)`, in order. */
function wordsInRange(words: readonly SpeechWordTiming[], lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as SpeechWordTiming;
    const mid = (w.start + w.end) / 2;
    if (mid >= lo && mid < hi) out.push(i);
  }
  return out;
}

/**
 * Build the old-source-second to new-source-second map for one regeneration.
 * Outside every edit it is a shift by the deltas that came before; inside an
 * edit it re-fits through the word alignment, so a cut that sat between two
 * words comes back between the same two words.
 */
function mediaMapper(
  oldWords: readonly SpeechWordTiming[],
  newWords: readonly SpeechWordTiming[],
  edits: readonly SentenceEdit[],
): (sec: number) => number {
  const cache = new Map<SentenceEdit, { oldIdx: number[]; newIdx: number[]; map: (number | null)[] }>();

  const refit = (sec: number, e: SentenceEdit, shift: number): number => {
    const newFrom = e.from + shift;
    const newTo = e.to + shift + e.delta;
    const oldSpan = Math.max(1e-6, e.to - e.from);
    const spread = (): number => newFrom + ((sec - e.from) / oldSpan) * (newTo - newFrom);

    let cached = cache.get(e);
    if (!cached) {
      const oldIdx = wordsInRange(oldWords, e.from, e.to);
      const newIdx = wordsInRange(newWords, newFrom, newTo);
      const map = alignWords(
        oldIdx.map((k) => (oldWords[k] as SpeechWordTiming).text),
        newIdx.map((k) => (newWords[k] as SpeechWordTiming).text),
      );
      cached = { oldIdx, newIdx, map };
      cache.set(e, cached);
    }
    const { oldIdx, newIdx, map } = cached;
    if (!oldIdx.length || !newIdx.length) return spread();

    // The first old word the cut is at or before; none means it sits after the
    // last word of the range, which is the range's own end.
    let at = oldIdx.findIndex((k) => (oldWords[k] as SpeechWordTiming).end > sec);
    if (at < 0) at = oldIdx.length;

    // The cut sits BEFORE the word at `at`. If that word is still in the
    // rewritten line, put the cut before its counterpart. If it is not, use the
    // end of the last word before it that is, so a replaced word cannot drag
    // the cut past the words that stayed; only when nothing before it is left
    // do we look forward.
    let target: number | null = null;
    const here = at < oldIdx.length ? map[at] : null;
    if (here != null) target = (newWords[newIdx[here] as number] as SpeechWordTiming).start;
    for (let k = at - 1; k >= 0 && target == null; k--) {
      const j = map[k];
      if (j != null) target = (newWords[newIdx[j] as number] as SpeechWordTiming).end;
    }
    for (let k = at + 1; k < oldIdx.length && target == null; k++) {
      const j = map[k];
      if (j != null) target = (newWords[newIdx[j] as number] as SpeechWordTiming).start;
    }
    if (target == null) target = spread();
    // Land the cut in the middle of the silence, exactly as a hand cut would.
    const snapped = snapCut(newWords, target);
    return Math.min(newTo, Math.max(newFrom, snapped));
  };

  return (sec: number): number => {
    if (!Number.isFinite(sec)) return sec;
    let shift = 0;
    for (const e of edits) {
      if (sec >= e.to) { shift += e.delta; continue; }
      if (sec > e.from) return refit(sec, e, shift);
      break;
    }
    return sec + shift;
  };
}

/**
 * Re-fit one source's boxes after some of its sentences were re-synthesized in
 * place (plans/181 section 5.3). The asset id never changes, so no box is
 * re-pointed; because the untouched audio is the same samples, a box that plays
 * only untouched sentences needs at most a shift.
 *
 * `srcIds` is the source's box ids, the same set deleteMediaRange takes (the
 * panel gathers them off the asset ref). Boxes outside it never move, so a
 * music bed or a second speaker on the lane keeps its place.
 *
 *  - A box before every edit is returned unchanged.
 *  - A box after an edit takes the running delta on its `clipIn`, and its
 *    timeline `start` moves by the same amount, so a longer sentence pushes the
 *    rest of the same voiceover later and a shorter one pulls it in.
 *  - A box overlapping an edit is re-fitted through the word alignment and
 *    snapped to the new gap midpoints; a skipped box stays skipped, and a
 *    deleted span stays deleted, because neither flag nor box list is touched.
 *
 * Sequence-lane boxes get their row repacked instead of a hand-written start,
 * which is the same division of labour removeAndRipple keeps.
 */
export function spliceSentences(
  boxes: readonly Box[],
  cfg: TimeCfg,
  srcIds: Iterable<string>,
  oldWords: readonly SpeechWordTiming[],
  newWords: readonly SpeechWordTiming[],
  edits: readonly SentenceEdit[],
  mediaDur?: MediaDurFn,
): Box[] {
  const ids = srcIds instanceof Set ? srcIds : new Set(srcIds);
  // `to === from` is a real edit, not an empty one: a sentence typed between
  // two others replaces no old audio at all, and dropping it would leave every
  // box after the insert playing the wrong seconds of a longer clip.
  const eds = edits
    .filter((e) => Number.isFinite(e.from) && Number.isFinite(e.to) && Number.isFinite(e.delta) && e.to >= e.from)
    .sort((a, b) => a.from - b.from);
  const out: Box[] = boxes.map((b) => b);
  if (!ids.size || !eds.length) return out;

  const mapMedia = mediaMapper(oldWords, newWords, eds);

  // Timeline seconds already absorbed on each lane, so several boxes of the
  // same voiceover accumulate their neighbours' growth in order.
  const shifts = new Map<string, number>();
  let touchedSeq = false;

  const order = out
    .map((b, i) => ({ b, i, t: boxTiming(b, cfg) }))
    .filter((x) => ids.has(idOf(x.b, cfg)) && x.t.dur != null)
    .sort((a, b) => (a.t.start ?? 0) - (b.t.start ?? 0));

  for (const { b, i, t } of order) {
    const win = mediaWindow(b, cfg);
    if (!win) continue;
    const lane = String(t.lane ?? '');
    const shift = shifts.get(lane) ?? 0;
    const ns = mapMedia(win.start);
    const ne = mapMedia(win.end);
    const dur = Math.max(MIN_DUR, (ne - ns) / t.speed);
    const next: Box = { ...b, [cfg.clipInField]: r3(ns), [cfg.durField]: r3(dur) };
    if (t.lane === 'seq') touchedSeq = true;
    else if (shift !== 0) next[cfg.startField] = r3(Math.max(0, (t.start ?? 0) + shift));
    shifts.set(lane, shift + (dur - (t.dur as number)));
    out[i] = next;
  }
  return touchedSeq ? packSeq(out, cfg, mediaDur) : out;
}
