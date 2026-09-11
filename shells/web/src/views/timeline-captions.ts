// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-captions.ts - the pure maths behind the timeline panel's "Generate
 * subtitles" action (plans/41-tts-stt-programme.md section 5).
 *
 * Word timings arrive from one of two sources - a TTS asset's own `meta.tts`
 * block (exact by construction, see script-audio.ts's buildTtsRecord) or an
 * on-device Whisper transcription (`host.speech.transcribe`, v1.99) - and the
 * engine's `groupWordsToCues` turns either into readable cues. Those cues are
 * in MEDIA time: seconds into the audio file. A timeline box shows a WINDOW of
 * that media (`clipIn` onward, at `speed`), so mapping a cue onto the timeline
 * has to run through the same transform trimClip maintains. That mapping lives
 * here, pure and co-located-testable, instead of inline in the panel where it
 * would silently drift from timeline-math's arithmetic.
 *
 * DOM-free and host-free on purpose: cues in, timeline spans out.
 */

import type { CaptionCue } from '../../../../engine/src/captions.ts';
import type { SpeechWordTiming } from '@lolly-tools/core/host-v1';
import { MIN_DUR } from './timeline-math.ts';

/**
 * Caption boxes belong to their source clip through the tool's own `group`
 * field: `captions:<source box id>`. The prefix is the whole contract - it is
 * what lets a re-run replace the previous set instead of duplicating it, and
 * what the panel's lane collapse reads to label the row.
 */
export const CAPTION_GROUP_PREFIX = 'captions:';

/** The group id carried by every caption box generated from `sourceId`. */
export function captionGroup(sourceId: string): string {
  return `${CAPTION_GROUP_PREFIX}${sourceId}`;
}

/** Whether a box's group value marks it as a generated-caption member. */
export function isCaptionGroup(group: unknown): boolean {
  return typeof group === 'string' && group.startsWith(CAPTION_GROUP_PREFIX);
}

/**
 * The CSS class the preset below puts on every caption box (the `cls` field,
 * plan 112 M4's per-box class hook). It is two things at once:
 *
 *   - the style handle, so a document's Custom CSS can restyle every caption at
 *     once with `.caption { … }`;
 *   - the DOM MARKER the export reads. `group` never reaches the rendered
 *     markup - the design hook emits geometry, timing and class tokens, not the
 *     model's grouping - so a class is the only thing that says "this drawn box
 *     is a caption" to `stageCaptionCues` in bridge/sequence-render.ts, which is
 *     what turns burned-in captions into a subtitle track and a sidecar file.
 *
 * Plain `caption` rather than a namespaced token: the design hook's `classTokens`
 * drops anything starting `lolly-`, `pr-`, `seq-` or `fc-`.
 */
export const CAPTION_BOX_CLASS = 'caption';

/** The artboard a caption is being placed on, in px. Both optional; a caller who
 *  knows neither gets the 1920x1080 default frame. */
export interface CaptionPresetOpts {
  stageW?: number;
  stageH?: number;
}

/** The look the preset writes. Field ids are the Design tool's own box fields. */
export interface CaptionPresetFields {
  cls: string;
  shape: 'rounded';
  radius: number;
  bg: string;
  fg: string;
  pad: number;
  align: 'center';
  valign: 'middle';
  fontSize: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The frame a caption is placed on when the caller knows no artboard size. */
const PRESET_STAGE_W = 1920;
const PRESET_STAGE_H = 1080;
/** Caption type as a share of the artboard height - 4.5% is ~49px at 1080p, the
 *  broadcast band. Clamped so a business-card artboard and a billboard both stay
 *  readable. */
const PRESET_TYPE_SHARE = 0.045;
const PRESET_TYPE_MIN = 14;
const PRESET_TYPE_MAX = 72;
/** How wide the band runs, and how far its baseline sits off the bottom edge. */
const PRESET_WIDTH_SHARE = 0.8;
const PRESET_BOTTOM_SHARE = 0.08;

const sizeOr = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * The lower-third caption preset (plans/180 section 4, layer 1).
 *
 * A generated caption used to be a bare text box: black type on nothing, sitting
 * wherever the seed put it. Over a photograph that is unreadable, which makes
 * the DEFAULT caption - the one that is burned into every video export - the
 * weakest of the three caption layers. This gives it the broadcast shape:
 * a dark panel with padding and soft corners, centred type, anchored as a lower
 * third of its own artboard.
 *
 * Pure: sizes in, field values out. No DOM, no model, no writes - the caller
 * merges these onto the boxes it mints (see {@link withCaptionPreset}).
 */
export function captionPreset(opts: CaptionPresetOpts = {}): CaptionPresetFields {
  const stageW = sizeOr(opts.stageW, PRESET_STAGE_W);
  const stageH = sizeOr(opts.stageH, PRESET_STAGE_H);
  const fontSize = Math.round(Math.min(PRESET_TYPE_MAX, Math.max(PRESET_TYPE_MIN, stageH * PRESET_TYPE_SHARE)));
  const pad = Math.round(fontSize * 0.5);
  // Two lines of type plus the padding, which is what the 42-char grouper emits at
  // its longest. A shorter cue simply centres inside the band, so every cue in a
  // set sits in exactly the same place - the whole point of a lower third.
  const h = Math.round(fontSize * 2 * 1.2 + pad * 2);
  const w = Math.round(stageW * PRESET_WIDTH_SHARE);
  return {
    cls: CAPTION_BOX_CLASS,
    shape: 'rounded',
    radius: Math.round(fontSize * 0.25),
    bg: '#000000cc',
    fg: '#ffffff',
    pad,
    align: 'center',
    valign: 'middle',
    fontSize,
    x: Math.round((stageW - w) / 2),
    y: Math.round(stageH - stageH * PRESET_BOTTOM_SHARE - h),
    w,
    h,
  };
}

/** Whether a box field is unset - the preset fills those and leaves every other
 *  value the caller (or a restyled earlier caption) already decided. */
const unset = (v: unknown): boolean => v === undefined || v === null || v === '';

/**
 * Merge the preset onto one caption box.
 *
 * FILL, not overwrite: every field the caller already set survives, so a tool
 * seeding its own caption look, or a re-generated set built off a box the author
 * restyled, keeps what it had. The one exception is {@link CAPTION_BOX_CLASS},
 * which is always added to `cls`: it is the marker the export reads, so losing
 * it would silently cost the subtitle track rather than change a colour.
 */
export function withCaptionPreset<T extends Record<string, unknown>>(box: T, opts: CaptionPresetOpts = {}): T {
  const preset = captionPreset(opts) as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...box };
  for (const [k, v] of Object.entries(preset)) {
    if (k !== 'cls' && unset(out[k])) out[k] = v;
  }
  const tokens = String(out.cls ?? '').split(/\s+/).filter(Boolean);
  if (!tokens.includes(CAPTION_BOX_CLASS)) tokens.push(CAPTION_BOX_CLASS);
  out.cls = tokens.join(' ');
  return out as T;
}

/**
 * The source box's placement, in timeline seconds - exactly the fields
 * `boxTiming` resolves. `dur` is the RESOLVED span (an open-ended clip's
 * caller passes the derived length, the way the panel's `span()` does).
 */
export interface CueSourceTiming {
  start: number;
  dur: number;
  clipIn: number;
  speed: number;
}

/** A cue clamped shorter than this by the clip's trim is dropped rather than
 *  kept as an unreadable flash. Deliberately under MIN_DUR: a cue that merely
 *  BRUSHES the trim edge still gets floored up to an editable box below. */
export const MIN_CUE_KEEP_S = 0.05;

const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Map media-time cues onto the timeline through one source box's window.
 *
 * Media second `m` renders at timeline second `start + (m - clipIn) / speed` - 
 * the inverse of the trim maths (trimClip moves clipIn by `d * speed` when the
 * bar edge moves by `d`). Cues the trim cut out entirely are dropped; cues that
 * straddle an edge are clamped to it; a surviving cue is floored to MIN_DUR so
 * every emitted box stays grabbable and trimmable in the panel (the floor may
 * overhang the source's tail by a fraction of a second - an editable box beats
 * a sub-minimum one the model would clamp anyway).
 */
export function cueSpansOnTimeline(cues: readonly CaptionCue[], src: CueSourceTiming): CaptionCue[] {
  const speed = Number.isFinite(src.speed) && src.speed > 0 ? src.speed : 1;
  const start = Number.isFinite(src.start) ? Math.max(0, src.start) : 0;
  const clipIn = Number.isFinite(src.clipIn) ? Math.max(0, src.clipIn) : 0;
  const dur = Number.isFinite(src.dur) && src.dur > 0 ? src.dur : 0;
  const end = start + dur;
  const out: CaptionCue[] = [];
  if (!(end > start)) return out;
  for (const c of cues) {
    const text = (c?.text ?? '').trim();
    if (!text || !Number.isFinite(c.start) || !Number.isFinite(c.end) || !(c.end > c.start)) continue;
    let s = start + (c.start - clipIn) / speed;
    let e = start + (c.end - clipIn) / speed;
    if (e <= start || s >= end) continue;   // trimmed out of the visible window
    s = Math.max(start, s);
    e = Math.min(end, e);
    if (e - s < MIN_CUE_KEEP_S) continue;   // a clamped sliver reads as a flash
    out.push({ start: round3(s), end: round3(Math.max(e, s + MIN_DUR)), text });
  }
  return out;
}

/**
 * Validate a word-timing list that crossed a storage boundary, distrusting
 * everything about it. THE one validator: both meta rungs of the timing ladder
 * read through it, so a TTS alignment and a Whisper transcript can never be
 * sanitised by two drifting sets of rules. Null when nothing usable survives.
 */
export function wordTimingsOf(words: unknown): SpeechWordTiming[] | null {
  if (!Array.isArray(words) || !words.length) return null;
  const out: SpeechWordTiming[] = [];
  for (const w of words) {
    const text = typeof (w as { text?: unknown } | null)?.text === 'string' ? (w as { text: string }).text : '';
    const start = Number((w as { start?: unknown } | null)?.start);
    const end = Number((w as { end?: unknown } | null)?.end);
    if (!text.trim() || !Number.isFinite(start) || !Number.isFinite(end) || end < start || start < 0) continue;
    out.push({ text, start, end });
  }
  return out.length ? out : null;
}

/**
 * The word timings off an asset's `meta.tts` block, shape-validated - the
 * record is model data that crossed a storage boundary, so nothing about it is
 * trusted. Returns null when there is nothing usable, which is the caller's
 * cue to fall through to the transcript rung, then to transcription.
 */
export function ttsWordsOf(meta: unknown): SpeechWordTiming[] | null {
  const tts = (meta as { tts?: unknown } | null | undefined)?.tts;
  return wordTimingsOf((tts as { words?: unknown } | null | undefined)?.words);
}

/**
 * The asset-meta key a FINISHED TRANSCRIPTION is filed under by
 * lib/stt-job.ts, so a re-run reads minutes of on-device inference back off the
 * record instead of paying for them twice.
 *
 * Deliberately NOT `meta.tts`: that block is the proof a clip was SYNTHESISED by
 * Lolly (lib/tts-provenance.ts heals audio from it, and the Gen AI disclosure
 * rides on it), and a transcript of a recording somebody made is the opposite
 * claim. Two different facts, two different keys.
 */
export const TRANSCRIPT_META_KEY = 'transcript';

/** The note written under {@link TRANSCRIPT_META_KEY}. */
export interface TranscriptNote {
  words: SpeechWordTiming[];
  /** When it was made, ms epoch. */
  at: number;
  /** What produced it - never an assertion that a person typed it. */
  engine: 'whisper';
}

/**
 * The word timings off an asset's persisted `meta.transcript`, shape-validated,
 * or null when there is nothing usable. The ladder rung that makes a second
 * "Generate subtitles" on the same clip instant.
 */
export function transcriptWordsOf(meta: unknown): SpeechWordTiming[] | null {
  const note = (meta as Record<string, unknown> | null | undefined)?.[TRANSCRIPT_META_KEY];
  return wordTimingsOf((note as { words?: unknown } | null | undefined)?.words);
}
