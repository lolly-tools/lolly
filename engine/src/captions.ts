// SPDX-License-Identifier: MPL-2.0
/**
 * Captions - spoken-word timings in, subtitle cues out.
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
  /** Longest cue text in characters before a break. Default 42 - the classic
   *  broadcast line length. */
  maxChars?: number;
  /** Longest a cue may stay on screen, in seconds. Default 5. */
  maxDurationS?: number;
  /** An inter-word silence at least this long (seconds) starts a new cue.
   * Default 0.6 - long enough to be a spoken pause, not articulation. */
  gapS?: number;
}

/** Trailing sentence punctuation, allowing a closing quote/bracket after it. */
const SENTENCE_END = /[.!?…][)\]"'”’]*$/;

/**
 * Group word timings into subtitle cues, greedily: a word joins the open cue
 * unless it arrives after a >= `gapS` silence, or joining it would push the cue
 * past `maxChars` or `maxDurationS`; a word ending in sentence punctuation
 * closes the cue after itself. A cue's end is its last word's `end` - no
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

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/** How the narration clip sits inside its slide, plus the grouping knobs. */
export interface SlideCueOpts extends GroupWordsOpts {
  /**
   * Where the clip's own t=0 sits, in milliseconds AFTER `slideStartMs`. Default 0.
   * A narrated slide passes its lead-in here (plans/180 T2: narration starts once the
   * slide's enter motion has settled), so the cues land on the words.
   */
  offsetMs?: number;
  /**
   * A cue the window clamps shorter than this many SECONDS is dropped rather than kept
   * as an unreadable flash. Default 0.05 - the timeline's own floor, so a caption box
   * drawn on the canvas and a cue written into a file survive or die together.
   */
  minKeepS?: number;
}

/**
 * The subtitle cues for ONE slide's narration, on the film's clock, clamped to the
 * slide's window (plans/180 T4).
 *
 * The words are the clip's own - media seconds from the start of the sound - and the
 * clip begins `offsetMs` into the slide. Everything comes back in film-clock SECONDS
 * (`CaptionCue`'s unit), which is what a sidecar `.vtt` and an embedded subtitle track
 * both want; a per-slide file subtracts `slideStartMs / 1000` itself.
 *
 * The clamp is the point. T1 and T3 already size a slide to hold its narration plus the
 * tail, so under normal timing nothing needs cutting - but an author can shorten a slide
 * by hand, and a cue that outlives its slide would sit over the next one's first words.
 * A cue straddling an edge is trimmed to it; a cue entirely outside is dropped; a cue
 * trimmed below `minKeepS` is dropped rather than flashed. Times are rounded to the
 * millisecond, which is all VTT and SRT can express anyway.
 *
 * A window that is empty or backwards yields no cues, never a throw.
 */
export function cuesForSlide(
  words: readonly SpeechWordTiming[],
  slideStartMs: number,
  slideEndMs: number,
  opts: SlideCueOpts = {},
): CaptionCue[] {
  const startS = Number.isFinite(slideStartMs) ? Math.max(0, slideStartMs) / 1000 : 0;
  const endS = Number.isFinite(slideEndMs) ? slideEndMs / 1000 : 0;
  if (!(endS > startS)) return [];
  const offsetS = Number.isFinite(opts.offsetMs) ? Math.max(0, opts.offsetMs as number) / 1000 : 0;
  const minKeepS = Number.isFinite(opts.minKeepS) && (opts.minKeepS as number) > 0 ? (opts.minKeepS as number) : 0.05;
  const base = startS + offsetS;
  const out: CaptionCue[] = [];
  for (const c of groupWordsToCues(words, opts)) {
    const s = Math.max(startS, base + c.start);
    const e = Math.min(endS, base + c.end);
    if (!(e > s) || e - s < minKeepS) continue;
    out.push({ start: round3(s), end: round3(e), text: c.text });
  }
  return out;
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
 * Boundaries: a cue covers `[start, end)` - at exactly `end` it has left.
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
