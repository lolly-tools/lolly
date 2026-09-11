// SPDX-License-Identifier: MPL-2.0
/**
 * caption-format.ts - a finished transcript in, the text a tool's target input
 * holds out (plans/147 T1a, `render.transcribe`).
 *
 * The cue maths is NOT here: `groupWordsToCues`, `cuesToSrt` and `cuesToVtt`
 * are the engine's (engine/src/captions.ts), so a caption written by this shell
 * breaks lines at the same words a headless run would. What this module owns is
 * the one decision the engine has no opinion about - what a transcript's
 * `granularity` means for grouping:
 *
 *   - 'word'    - the model timed each word, so the engine's greedy grouper
 *                 decides where a cue ends (sentence punctuation, 42 chars,
 *                 5 seconds, or a 0.6 s pause);
 *   - 'segment' - the model already decided, and each entry IS a cue. Re-running
 *                 the grouper over segments would either split a segment the
 *                 model kept whole or glue two of them together, so it doesn't
 *                 run at all.
 *
 * Empty in, empty out. A clip with no speech produces `''` for every format -
 * never a bare `WEBVTT` header, and never a fabricated line.
 */
import { cuesToSrt, cuesToVtt, groupWordsToCues, type CaptionCue } from '../../../../engine/src/captions.ts';
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';

/** What `render.transcribe.format` may ask for. */
export type CaptionFormat = 'srt' | 'vtt' | 'words';

/** The transcript fields this module reads - a structural slice of
 *  `SpeechTranscript`, so a caller can pass one straight in. */
export interface TranscriptLike {
  words: readonly SpeechWordTiming[];
  granularity?: 'word' | 'segment' | 'sentence' | 'none';
}

/**
 * Timed spans to cues. Word-granular spans go through the engine's grouper;
 * anything else is already cue-shaped and passes through, minus the entries no
 * cue can be made of (blank text, a non-finite or backwards span).
 */
export function transcriptToCues(t: TranscriptLike): CaptionCue[] {
  const words = t.words ?? [];
  if (!words.length) return [];
  if ((t.granularity ?? 'word') === 'word') return groupWordsToCues(words);
  const out: CaptionCue[] = [];
  for (const w of words) {
    const text = (w?.text ?? '').trim();
    if (!text || !Number.isFinite(w.start) || !Number.isFinite(w.end) || w.end < w.start) continue;
    out.push({ start: w.start, end: w.end, text });
  }
  return out;
}

/**
 * One cue, one line. A blank line TERMINATES a cue block in both SubRip and
 * WebVTT, so a cue payload carrying one would silently split into a good cue and
 * a malformed fragment; `words` separately promises one line per cue. Line
 * breaks (CRLF included) therefore collapse to a single space before
 * serialising. Whitespace only - no word is changed, reordered or dropped.
 */
const oneLine = (s: string): string => s.replace(/\s*\n\s*/g, ' ').trim();

/**
 * The text `render.transcribe` writes into its target input. `words` is the
 * plain spoken text, one cue per line - for a tool that wants what was said and
 * not when. SRT and VTT are the engine's serialisers verbatim, trailing newline
 * included, so a `.srt` written here and one written by the CLI are the same
 * bytes.
 */
export function formatCaptions(t: TranscriptLike, format: CaptionFormat = 'srt'): string {
  const cues = transcriptToCues(t).map((c) => ({ ...c, text: oneLine(c.text) })).filter((c) => c.text);
  if (!cues.length) return '';
  if (format === 'words') return cues.map((c) => c.text).join('\n');
  return format === 'vtt' ? cuesToVtt(cues) : cuesToSrt(cues);
}
