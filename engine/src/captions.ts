// SPDX-License-Identifier: MPL-2.0
/**
 * Captions — spoken-word timings in, subtitle cues out.
 *
 * This is the engine half of what `host.speech` (v1.96) starts: `synthesize`
 * returns per-word spans, and anything drawing or exporting subtitles needs
 * those words grouped into readable cues and serialised to the two formats the
 * world actually consumes (WebVTT and SRT). The grouping and the timestamp
 * maths live HERE, exactly like `analysePcm`, so a caption rendered in the
 * browser and the same caption written headlessly break lines at the same
 * words. DOM-free: plain objects in, strings out.
 *
 * The grouping is deliberately greedy and rule-based, not layout-aware: a cue
 * ends at a sentence boundary, at a character or duration ceiling, or across a
 * silence long enough to read as a pause. Sentence-granular input (the common
 * `host.speech` fallback) passes through mostly unchanged, because each "word"
 * already ends in sentence punctuation.
 */
import type { SpeechWordTiming } from './bridge/host-v1.ts';

/** One subtitle cue. Times in seconds, relative to the clip start. */
export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

export interface GroupWordsOpts {
  /** Longest cue text in characters before a break. Default 42 — the classic
   *  broadcast line length. */
  maxChars?: number;
  /** Longest a cue may stay on screen, in seconds. Default 5. */
  maxDurationS?: number;
  /** An inter-word silence at least this long (seconds) starts a new cue.
   *  Default 0.6 — long enough to be a spoken pause, not articulation. */
  gapS?: number;
}

/** Trailing sentence punctuation, allowing a closing quote/bracket after it. */
const SENTENCE_END = /[.!?…][)\]"'”’]*$/;

/**
 * Group word timings into subtitle cues, greedily: a word joins the open cue
 * unless it arrives after a >= `gapS` silence, or joining it would push the cue
 * past `maxChars` or `maxDurationS`; a word ending in sentence punctuation
 * closes the cue after itself. A cue's end is its last word's `end` — no
 * padding, so `cueAt` answers honestly during silence.
 */
export function groupWordsToCues(
  words: readonly SpeechWordTiming[],
  opts: GroupWordsOpts = {},
): CaptionCue[] {
  const maxChars = opts.maxChars ?? 42;
  const maxDurationS = opts.maxDurationS ?? 5;
  const gapS = opts.gapS ?? 0.6;

  const cues: CaptionCue[] = [];
  let open: CaptionCue | null = null;

  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;

    if (open) {
      const joined = `${open.text} ${text}`;
      const overflow = joined.length > maxChars || w.end - open.start > maxDurationS;
      const paused = w.start - open.end >= gapS;
      if (overflow || paused) {
        cues.push(open);
        open = null;
      } else {
        open.text = joined;
        open.end = w.end;
      }
    }
    if (!open) open = { start: w.start, end: w.end, text };

    // Sentence punctuation closes the cue AFTER the word that carries it.
    if (SENTENCE_END.test(text)) {
      cues.push(open);
      open = null;
    }
  }
  if (open) cues.push(open);
  return cues;
}

/** `seconds` → `HH:MM:SS<sep>mmm`. VTT wants a dot, SRT a comma. */
function stamp(seconds: number, sep: '.' | ','): string {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const frac = ms % 1000;
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}${sep}${pad(frac, 3)}`;
}

/** Serialise cues as WebVTT (header, dot-millisecond timestamps). */
export function cuesToVtt(cues: readonly CaptionCue[]): string {
  const blocks = cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}`);
  return `WEBVTT\n\n${blocks.join('\n\n')}\n`;
}

/** Serialise cues as SubRip (1-based numbered blocks, comma-millisecond timestamps). */
export function cuesToSrt(cues: readonly CaptionCue[]): string {
  const blocks = cues.map(
    (c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}`,
  );
  return `${blocks.join('\n\n')}\n`;
}

/**
 * The cue on screen at time `t`, or null during silence. Binary search over the
 * (already time-ordered) cues, so a per-frame draw loop can afford to call it.
 * Boundaries: a cue covers `[start, end)` — at exactly `end` it has left.
 */
export function cueAt(cues: readonly CaptionCue[], t: number): CaptionCue | null {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = cues[mid]!;
    if (t < c.start) hi = mid - 1;
    else if (t >= c.end) lo = mid + 1;
    else return c;
  }
  return null;
}
