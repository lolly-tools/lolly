// SPDX-License-Identifier: MPL-2.0
/**
 * narration.ts - speaker notes become a narrated slide (plans/180 sections 2 and 3).
 *
 * Every piece already existed: on-device Kokoro synthesis with exact word timings
 * behind `host.speech`, a `notes` field on every Design frame, caption boxes born
 * from word timings, and a sequence solver that packs frames end to end. This
 * module is the join. For each frame that has notes it speaks them, saves the WAV
 * as an ordinary user asset (`aiGenerated: 'full'`, synthetic-voice C2PA embedded
 * in the bytes by saveTtsClip), then writes ONE `kind:'audio'` box per frame under
 * the group `narration:<frameId>`.
 *
 * The group prefix is the contract, mirroring `CAPTION_GROUP_PREFIX`: re-generating
 * replaces the set rather than adding to it, so a second Narrate is idempotent and
 * costs one undo step.
 *
 * Everything above the job driver is pure - boxes in, boxes out - so the timing
 * rules T1 to T8 can be tested without a browser, a model download or a canvas.
 * The DOM-touching half is the consent sheet and the toast, both lazily imported.
 *
 * What this module refuses to do:
 *  - speak the '>' build markers. They are notation for the author, stripped
 *    before synthesis, and each one is read back as the moment a build appears.
 *  - caption from a second pass over audio we made ourselves. Cues come from the
 *    clip's own `meta.tts.words`, which is exact by construction.
 *  - re-synthesize a slide whose notes have not changed. `meta.narration.notesHash`
 *    is what makes "re-generate" a decision the user makes about the slides that
 *    actually moved.
 */

import { cuesForSlide, type CaptionCue } from '../../../../engine/src/captions.ts';
import { KOKORO_DEFAULT_VOICE } from '../../../../engine/src/speech-text.ts';
import { narrationDwellMs, NARRATION_LEAD_IN_MS, NARRATION_TAIL_MS } from './motion-model.ts';
import { DEFAULT_TRANSITION_MS } from './transitions.ts';
import { startJob, type JobHandle } from './jobs.ts';
import { captionGroup, captionPreset, withCaptionPreset } from '../views/timeline-captions.ts';
// The four-state vocabulary the navigator and the inspector paint is declared with
// the ports the columns read, so this module and the dot on the thumbnail can never
// end up naming the same slide two different things.
import type { NarrationStatus } from '../views/design-ports.ts';
// TYPE-ONLY on purpose. The Script-audio module owns the save path and the progress
// reading, but it also pulls in its own CSS chunk, and this module has to stay light
// enough for the canvas to import its pure status read at mount. The two functions
// are fetched lazily inside the one place that speaks (see narrateOneFrame).
import type { ScriptAudioHost, TtsClip } from '../views/script-audio.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import type { AssetRef, SpeechProgress, SpeechWordTiming } from '@lolly-tools/core/host-v1';
import type { Box } from '../views/free-canvas-math.ts';

/* ── the group contract ────────────────────────────────────────────────────── */

/**
 * A narration clip belongs to its slide through the tool's own `group` field:
 * `narration:<frame id>`. One clip per frame, never two, and a re-run replaces
 * the member rather than appending a second voice over the first.
 */
export const NARRATION_GROUP_PREFIX = 'narration:';

/** The group value carried by the narration clip of `frameId`. */
export function narrationGroup(frameId: string): string {
  return `${NARRATION_GROUP_PREFIX}${frameId}`;
}

/** Whether a box's group value marks it as a generated narration clip. */
export function isNarrationGroup(group: unknown): boolean {
  return typeof group === 'string' && group.startsWith(NARRATION_GROUP_PREFIX);
}

/** The frame a narration group names, or '' when the value is not one. */
export function narratedFrameId(group: unknown): string {
  return isNarrationGroup(group) ? String(group).slice(NARRATION_GROUP_PREFIX.length) : '';
}

/* ── which box fields this module writes ───────────────────────────────────── */

/**
 * The sub-field names a narration write needs, by the tool's own ids. Passed in
 * rather than imported so the module stays tool-agnostic and its test can drive
 * it with a two-field fake; {@link DESIGN_NARRATION_FIELDS} is Design's set.
 */
export interface NarrationFields {
  idField: string;
  kindField: string;
  frameField: string;
  frameKind: string;
  /** The frame's play-order field. Ties break on x, then array position - the exact
   *  key sequenceFramesInOrder sorts by, so both see one slide order. */
  orderField: string;
  groupField: string;
  laneField: string;
  startField: string;
  durField: string;
  enterField: string;
  exitField: string;
  enterMsField: string;
  exitMsField: string;
  notesField: string;
  buildField: string;
  duckField: string;
  presentAudioField: string;
  /** Where a box keeps its media - an audio box's "image" IS its track. */
  assetField: string;
  textField: string;
  audioKind: string;
  textKind: string;
}

/** Design's own field ids (community/design/tool.json `boxes.canvas`). */
export const DESIGN_NARRATION_FIELDS: NarrationFields = {
  idField: 'id',
  kindField: 'kind',
  frameField: 'frame',
  frameKind: 'frame',
  orderField: 'order',
  groupField: 'group',
  laneField: 'lane',
  startField: 'start',
  durField: 'dur',
  enterField: 'enter',
  exitField: 'exit',
  enterMsField: 'enterMs',
  exitMsField: 'exitMs',
  notesField: 'notes',
  buildField: 'build',
  duckField: 'duck',
  presentAudioField: 'presentAudio',
  assetField: 'image',
  textField: 'text',
  audioKind: 'audio',
  textKind: 'text',
};

/** The scenes lane: a narration clip rides the sequence with its slide. */
const SEQ_LANE = 'seq';

/** What the bed drops to while a slide is being narrated (plans/180 T6). */
export const NARRATION_BED_DUCK = 0.2;

/* ── notes to spoken words, and the build markers in between (T5) ──────────── */

/** The character that opens a build-step line in a speaker-notes box. */
export const BUILD_MARKER = '>';

/** One '>' line, resolved against the words it will be spoken as. */
export interface NarrationMark {
  /** 1-based build step, in the order the markers appear. */
  step: number;
  /** Index into the spoken word stream where this line's first word begins. */
  wordIndex: number;
  /** That first word as the author typed it, for re-finding it after normalizing. */
  token: string;
}

/** What {@link parseNarrationNotes} pulls out of one frame's notes. */
export interface ParsedNotes {
  /** The words to speak, markers removed. Empty when there is nothing to say. */
  spoken: string;
  /** The build markers, in document order. Empty when the author wrote none. */
  marks: NarrationMark[];
}

/**
 * Split one frame's speaker notes into the text to speak and the build markers
 * inside it (plans/180 T5).
 *
 * A line beginning `>` advances one build step at that line's FIRST spoken word.
 * The marker is notation, so it never reaches the voice - it is stripped here and
 * the line's words are spoken like any other. A bare `>` with no words after it
 * has no first word to advance on, so it is dropped rather than counted as a step
 * that could never be placed.
 */
export function parseNarrationNotes(notes: unknown): ParsedNotes {
  const src = String(notes ?? '').replace(/\r\n?/g, '\n');
  if (!src.trim()) return { spoken: '', marks: [] };
  const lines = src.split('\n');
  const kept: string[] = [];
  const marks: NarrationMark[] = [];
  let words = 0;
  for (const raw of lines) {
    const m = /^[ \t]*>[ \t]*(.*)$/.exec(raw);
    const body = m ? m[1] ?? '' : raw;
    const trimmed = body.trim();
    const tokens = trimmed ? trimmed.split(/\s+/) : [];
    if (m && tokens.length) marks.push({ step: marks.length + 1, wordIndex: words, token: tokens[0]! });
    kept.push(body);
    words += tokens.length;
  }
  return { spoken: kept.join('\n').trim(), marks };
}

/** Lowercase letters and digits only - what two spellings of one word share. */
const normWord = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Where each build step falls inside the finished clip, in MILLISECONDS from the
 * clip's first sample. Index n-1 holds step n; the array is empty when there is
 * nothing to place against (no marks, or a clip with no word timings).
 *
 * The index the notes counted is only a first guess: the shell's speech normalizer
 * can turn '2,024' into one word or '20 24' into two, which shifts every later
 * index. So each mark is re-found by its own first word, searching forward from
 * the previous step (never backwards, so the steps stay in order), and the counted
 * index is the fallback when the word cannot be found at all.
 */
export function narrationBuildOffsets(
  words: readonly SpeechWordTiming[], marks: readonly NarrationMark[],
): number[] {
  if (!Array.isArray(words) || !words.length || !marks.length) return [];
  const out: number[] = [];
  let cursor = 0;
  for (const mk of marks) {
    const want = normWord(mk.token || '');
    let hit = -1;
    if (want && mk.wordIndex >= cursor && mk.wordIndex < words.length
      && normWord(words[mk.wordIndex]!.text) === want) hit = mk.wordIndex;
    if (hit < 0 && want) {
      for (let i = cursor; i < words.length; i++) {
        if (normWord(words[i]!.text) === want) { hit = i; break; }
      }
    }
    if (hit < 0) hit = Math.min(Math.max(mk.wordIndex, cursor), words.length - 1);
    cursor = hit + 1;
    const start = Number(words[hit]?.start);
    out.push(Number.isFinite(start) && start > 0 ? Math.round(start * 1000) : 0);
  }
  return out;
}

/* ── stale detection ───────────────────────────────────────────────────────── */

/**
 * A short, stable digest of the words a clip was spoken from (FNV-1a, 32-bit).
 * Not a security hash and never used as one: its whole job is to answer "are these
 * the notes we already narrated?" without keeping a second copy of the text.
 */
export function notesHash(text: string): string {
  let h = 0x811c9dc5;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * What a narration is checked against: the words that were spoken, plus where the
 * build markers sat in them.
 *
 * The markers are in here because moving one changes the narration even when every
 * spoken word is identical - the build appears at a different moment - and a check
 * that only read the words would call that slide current and leave the build where
 * it was. Reformatting the notes without touching either does not count as an edit.
 */
export function narrationSignature(notes: unknown): string {
  const { spoken, marks } = parseNarrationNotes(notes);
  // \u0000 as the separator, written as an escape rather than the byte: a literal NUL
  // makes the whole file read as binary to grep. Nothing a person types can contain it,
  // so the two halves can never be confused for one another.
  return `${spoken}\u0000${marks.map((m) => m.wordIndex).join(',')}`;
}

/** The `meta.narration` block a narration clip's asset record carries. */
export interface NarrationNote {
  frameId: string;
  /** {@link notesHash} of the {@link narrationSignature}. */
  notesHash: string;
}

/** The note to file on the clip that was just spoken for `frameId`. */
export function narrationNote(frameId: string, notes: unknown): NarrationNote {
  return { frameId, notesHash: notesHash(narrationSignature(notes)) };
}

/** The `meta.narration` block off an asset record, shape-checked, or null. */
export function narrationNoteOf(meta: unknown): NarrationNote | null {
  const n = (meta as { narration?: unknown } | null | undefined)?.narration;
  const frameId = (n as { frameId?: unknown } | null | undefined)?.frameId;
  const hash = (n as { notesHash?: unknown } | null | undefined)?.notesHash;
  if (typeof frameId !== 'string' || typeof hash !== 'string' || !hash) return null;
  return { frameId, notesHash: hash };
}

/**
 * One slide's answer: nothing to narrate, notes never narrated, narrated and
 * current, or narrated before the notes were edited. Stale is the one that matters
 * - it turns "re-generate" into a decision the user makes rather than a surprise
 * re-synthesis on every keystroke.
 */
export type NarrationState = NarrationStatus;

/** {@link NarrationState} for one frame, given its notes and its clip's asset meta. */
export function narrationState(notes: unknown, clipMeta: unknown): NarrationState {
  const spoken = parseNarrationNotes(notes).spoken;
  if (!spoken) return 'none';
  const note = narrationNoteOf(clipMeta);
  if (!note) return 'pending';
  return note.notesHash === notesHash(narrationSignature(notes)) ? 'current' : 'stale';
}

/**
 * One slide's status, read straight off the document - what the navigator dot and
 * the inspector's Narrate button paint (plans/180 section 8).
 *
 * Sync on purpose, so a column can call it while painting. It can be, because the
 * runtime re-resolves a blocks asset sub-field through `host.assets.get` on every
 * mount (engine runtime.ts `resolveAssetRefs`), so the clip box holds a live ref
 * carrying the `meta.narration` note rather than a bare id.
 */
export function narrationStatusFor(
  boxes: readonly Box[], f: NarrationFields, frameId: string,
): NarrationStatus {
  const frame = narrationFrames(boxes, f).find((fr) => fr.id === frameId);
  if (!frame) return 'none';
  return narrationState(frame.notes, clipMetaOf(frame, f));
}

/* ── reading the deck ──────────────────────────────────────────────────────── */

const str = (v: unknown): string => (v == null ? '' : String(v));

/** `v` as a finite number, else `d`. */
function numOr(v: unknown, d: number): number {
  if (v == null || v === '') return d;
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : d;
}

/** One frame, plus everything a narration pass needs to know about it. */
export interface NarrationFrame {
  id: string;
  /** Index into the boxes array. */
  index: number;
  /** Its speaker notes, verbatim. */
  notes: string;
  /** The words to speak, markers stripped. Empty when the slide has no notes. */
  spoken: string;
  marks: NarrationMark[];
  /** Scene start in MILLISECONDS, or 0 when the deck has not been sequenced. */
  startMs: number;
  /** Scene length in MILLISECONDS, 0 when unset. */
  durMs: number;
  /** The frame's enter motion, ms - 0 when it declares none, else its own length or the
   *  400 ms every player gives an unset one (see {@link transitionMsOf}). */
  enterMs: number;
  /** The frame's exit motion, ms, read the same way. */
  exitMs: number;
  /** The slide's page rect in canvas px - what a caption's lower third is offset by. */
  rect: { x: number; y: number; w: number; h: number };
  /** The existing narration clip box, when one is already in the document. */
  clip: Box | null;
}

/**
 * How long one half of a frame's slide transition actually runs, ms.
 *
 * The length field is normally ABSENT on a frame row - blocks rows are stored verbatim,
 * and neither the artboard seed nor `sequenceFramesInOrder` writes one - while every
 * player defaults it to {@link DEFAULT_TRANSITION_MS}. Reading the absent field as 0 is
 * what made the dwell solver size a slide 400 ms short of its own fade, so the exit
 * started while the voice was still talking (plans/180 T2, T3).
 *
 * A frame that declares NO transition (absent, '' or 'none') genuinely takes 0 ms: the
 * players skip the phase outright rather than running a 400 ms cut.
 */
function transitionMsOf(kind: unknown, len: unknown): number {
  const k = str(kind);
  if (!k || k === 'none') return 0;
  return Math.max(0, numOr(len, DEFAULT_TRANSITION_MS));
}

/** Frames in play order (order asc, then x asc) with their notes resolved. */
export function narrationFrames(boxes: readonly Box[], f: NarrationFields): NarrationFrame[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const clips = new Map<string, Box>();
  for (const b of rows) {
    if (!b) continue;
    const frameId = narratedFrameId(b[f.groupField]);
    if (frameId && !clips.has(frameId)) clips.set(frameId, b);
  }
  const out: NarrationFrame[] = [];
  for (let i = 0; i < rows.length; i++) {
    const b = rows[i];
    if (!b || str(b[f.kindField]) !== f.frameKind) continue;
    const id = str(b[f.idField]);
    if (!id) continue;
    const notes = str(b[f.notesField]);
    const parsed = parseNarrationNotes(notes);
    out.push({
      id,
      index: i,
      notes,
      spoken: parsed.spoken,
      marks: parsed.marks,
      startMs: Math.round(numOr(b[f.startField], 0) * 1000),
      durMs: Math.round(numOr(b[f.durField], 0) * 1000),
      enterMs: transitionMsOf(b[f.enterField], b[f.enterMsField]),
      exitMs: transitionMsOf(b[f.exitField], b[f.exitMsField]),
      rect: { x: numOr(b.x, 0), y: numOr(b.y, 0), w: numOr(b.w, 0), h: numOr(b.h, 0) },
      clip: clips.get(id) ?? null,
    });
  }
  out.sort((a, b) => {
    const oa = numOr(rows[a.index]?.[f.orderField], 0), ob = numOr(rows[b.index]?.[f.orderField], 0);
    if (oa !== ob) return oa - ob;
    const xa = numOr(rows[a.index]?.x, 0), xb = numOr(rows[b.index]?.x, 0);
    return xa !== xb ? xa - xb : a.index - b.index;
  });
  return out;
}

/* ── the writes ────────────────────────────────────────────────────────────── */

/** Mint ids that collide with nothing already in `boxes` and nothing minted yet. */
function minter(boxes: readonly Box[], f: NarrationFields): () => string {
  const used = new Set<string>();
  for (const b of boxes) if (b) used.add(str(b[f.idField]));
  let n = used.size + 1;
  return (): string => {
    let next = `b${n}`;
    while (used.has(next)) { n++; next = `b${n}`; }
    used.add(next);
    return next;
  };
}

/** One narration clip to write onto the timeline. */
export interface NarrationClipSpec {
  frameId: string;
  /** The saved clip's ref, written into the box's media field. */
  asset: unknown;
  /** When the first sample plays, MILLISECONDS on the film clock. */
  startMs: number;
  /** The clip's own length, MILLISECONDS. */
  durMs: number;
  /** A display name for the timeline row. */
  name?: string;
  /** The slide's page rect in canvas px. An audio box paints nothing, but a box
   *  stores GLOBAL x/y, so parking it at the slide's own origin keeps it from
   *  widening the canvas bounds every export and fit-to-content measures. */
  frameRect?: { x: number; y: number; w: number; h: number };
}

/**
 * Replace the `narration:<frameId>` group with one audio box (plans/180 section 2).
 *
 * Idempotent by construction: every existing member of the group is dropped first,
 * so a re-run swaps the clip instead of stacking a second voice on the slide. The
 * box rides the scenes lane with `presentAudio` on, which is what lets the
 * presenter unmute it.
 *
 * Two things go with the outgoing clip, because a slide must never end up with two
 * sets of words:
 *  - its CAPTIONS. A caption set is grouped by the id of the clip it was written
 *    from, so the cues of the voice being replaced are retired here rather than
 *    left for a caption writer that may not run (captions can be turned off).
 *  - its ID, which the replacement keeps. Minting a fresh id every re-narrate is
 *    what stranded the previous caption set in the first place, and a stable id also
 *    keeps every other reference to the clip (selection, the transcript panel)
 *    pointing at the slide's one voice.
 */
export function applyNarrationClip(
  boxes: readonly Box[], f: NarrationFields, spec: NarrationClipSpec, seed?: Box,
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const gid = narrationGroup(spec.frameId);
  const outgoing = rows.filter((b) => b && str(b[f.groupField]) === gid);
  const reusedId = str(outgoing[0]?.[f.idField]);
  const retired = new Set(outgoing
    .map((b) => str(b[f.idField]))
    .filter((id) => id !== '')
    .map((id) => captionGroup(id)));
  const kept = rows.filter((b) => {
    if (!b) return true;
    const g = str(b[f.groupField]);
    return g !== gid && !retired.has(g);
  });
  const mint = minter(kept, f);
  const box: Box = {
    ...(seed ?? {}),
    [f.idField]: reusedId || mint(),
    [f.kindField]: f.audioKind,
    [f.frameField]: spec.frameId,
    [f.groupField]: gid,
    [f.laneField]: SEQ_LANE,
    [f.startField]: Math.round(Math.max(0, spec.startMs)) / 1000,
    [f.durField]: Math.round(Math.max(0, spec.durMs)) / 1000,
    [f.presentAudioField]: true,
    [f.assetField]: spec.asset as Box[string],
    ...(spec.name ? { name: spec.name } : {}),
    ...(spec.frameRect
      ? {
        x: spec.frameRect.x,
        y: spec.frameRect.y,
        w: Math.max(1, Math.min(320, spec.frameRect.w || 320)),
        h: Math.max(1, Math.min(120, spec.frameRect.h || 120)),
      }
      : {}),
  };
  return [...kept, box];
}

/** The window a narration clip occupies on the film clock, MILLISECONDS. */
export interface NarrationWindow { startMs: number; endMs: number }

/**
 * Does this box's own time window overlap `win`?
 *
 * An audio box with no `dur` is open-ended - it runs to the end of the film - so it is
 * under every voice by construction, which is exactly what a music bed is.
 */
function overlapsWindow(b: Box, f: NarrationFields, win: NarrationWindow): boolean {
  const startMs = Math.round(numOr(b[f.startField], 0) * 1000);
  const durMs = Math.round(numOr(b[f.durField], 0) * 1000);
  const endMs = durMs > 0 ? startMs + durMs : Number.POSITIVE_INFINITY;
  return startMs < win.endMs && endMs > win.startMs;
}

/**
 * Duck the audio that plays UNDER this narration clip (plans/180 T6).
 *
 * Two boxes are left alone by rule: one that already carries an authored duck level (the
 * author said what they wanted) and the narration itself, which would otherwise duck
 * against its neighbours. The third exemption is the one the window buys - a sound effect
 * on slide nine has nothing to do with slide two's voice, and re-narrating one slide used
 * to quieten it anyway, five times over, inside the same undo entry.
 *
 * With no window it still ducks the whole document, which is what a caller that cannot
 * say when the voice speaks should get.
 */
export function duckBedForNarration(
  boxes: readonly Box[], f: NarrationFields,
  level = NARRATION_BED_DUCK, window?: NarrationWindow | null,
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  return rows.map((b) => {
    if (!b || str(b[f.kindField]) !== f.audioKind) return b;
    if (isNarrationGroup(b[f.groupField])) return b;
    if (b[f.duckField] != null && b[f.duckField] !== '') return b;
    if (window && !overlapsWindow(b, f, window)) return b;
    return { ...b, [f.duckField]: level };
  });
}

/**
 * Replace one frame's caption set with cues taken from its narration (T4).
 *
 * The cues are already on the film clock (`cuesForSlide` clamps them into the
 * slide's window), so nothing here maps time. Caption boxes ride the OVERLAY lane,
 * above the sequence, exactly as the timeline panel's own caption writer places
 * them - and under the same `captions:<source id>` group, so the two surfaces
 * replace each other's sets instead of doubling them up. The lower-third preset
 * (plans/180 section 4, layer 1) is filled in the same way, so a narrated deck's
 * burned-in captions are readable over a photograph without further styling.
 */
export function applyNarrationCaptions(
  boxes: readonly Box[], f: NarrationFields,
  opts: {
    sourceId: string; frameId: string; cues: readonly CaptionCue[]; seed?: Box;
    /** The slide's page rect in canvas px. A Design box stores GLOBAL x/y and the
     *  render subtracts its frame's origin, so the lower third has to be offset by
     *  it or slide three's captions would draw over slide one. */
    frameRect?: { x: number; y: number; w: number; h: number };
  },
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const gid = captionGroup(opts.sourceId);
  const kept = rows.filter((b) => !b || str(b[f.groupField]) !== gid);
  if (!opts.cues.length) return kept;
  const mint = minter(kept, f);
  const rect = opts.frameRect;
  const sized = rect && rect.w > 0 && rect.h > 0 ? { stageW: rect.w, stageH: rect.h } : {};
  const band = captionPreset(sized);
  const made: Box[] = opts.cues.map((c) => withCaptionPreset({
    ...(opts.seed ?? {}),
    [f.idField]: mint(),
    [f.kindField]: f.textKind,
    [f.frameField]: opts.frameId,
    [f.textField]: c.text,
    [f.laneField]: '',
    [f.startField]: c.start,
    [f.durField]: Math.round((c.end - c.start) * 1000) / 1000,
    [f.enterField]: 'fade',
    [f.exitField]: 'fade',
    [f.groupField]: gid,
    x: (rect?.x ?? 0) + band.x,
    y: (rect?.y ?? 0) + band.y,
  } as Box, sized));
  return [...kept, ...made];
}

/**
 * Give every build box on one frame the moment its '>' line is spoken (T5).
 *
 * `offsetsMs` is what {@link narrationBuildOffsets} returned - index n-1 for build
 * step n. A step with no marker keeps whatever the box already had, so a deck whose
 * author wrote no markers at all comes back untouched and every build appears with
 * its slide.
 */
export function applyBuildStarts(
  boxes: readonly Box[], f: NarrationFields,
  opts: { frameId: string; slideStartMs: number; leadInMs: number; offsetsMs: readonly number[] },
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  if (!opts.offsetsMs.length) return rows.slice();
  const base = Math.max(0, opts.slideStartMs) + Math.max(0, opts.leadInMs);
  return rows.map((b) => {
    if (!b || str(b[f.frameField]) !== opts.frameId) return b;
    const step = Math.round(numOr(b[f.buildField], 0));
    if (!(step >= 1) || step > opts.offsetsMs.length) return b;
    const at = Math.round(base + Math.max(0, opts.offsetsMs[step - 1] ?? 0)) / 1000;
    return b[f.startField] === at ? b : { ...b, [f.startField]: at };
  });
}

/* ── the dwell solver (T1, T7, T8) ─────────────────────────────────────────── */

/** Document-level narration settings, all optional with the plan's defaults. */
export interface NarrationTiming {
  /** Silence before the first word. Default 400 ms, raised to the frame's enter. */
  leadInMs?: number;
  /** Silence after the last word. Default 600 ms. */
  tailMs?: number;
}

/** The lead-in one frame actually gets: never shorter than its own enter (T2). */
export function leadInForFrame(frame: { enterMs?: number }, timing: NarrationTiming = {}): number {
  const declared = Number(timing.leadInMs);
  const leadIn = Number.isFinite(declared) && declared >= 0 ? declared : NARRATION_LEAD_IN_MS;
  return Math.max(leadIn, Math.max(0, Number(frame.enterMs) || 0));
}

/**
 * The per-frame dwell FLOORS a narrated deck has to be re-packed against - the
 * `minDurMs` map `sequenceFramesInOrder` takes (plans/180 T1, T7).
 *
 * Only frames that carry a narration clip appear in the map, so a slide with no
 * notes keeps its authored dwell (or the 3 s default) exactly as T8 requires. The
 * author's own dwell is deliberately NOT folded in here: the solver already takes
 * `max(authored, floor)`, and passing it twice would make a shortened slide
 * un-shortenable.
 */
export function narrationDwellFloors(
  boxes: readonly Box[], f: NarrationFields, timing: NarrationTiming = {},
): Record<string, number> {
  const tail = Number.isFinite(Number(timing.tailMs)) && Number(timing.tailMs) >= 0
    ? Number(timing.tailMs) : NARRATION_TAIL_MS;
  const out: Record<string, number> = {};
  for (const frame of narrationFrames(boxes, f)) {
    if (!frame.clip) continue;
    const narrationMs = Math.round(numOr(frame.clip[f.durField], 0) * 1000);
    if (narrationMs <= 0) continue;
    out[frame.id] = narrationDwellMs({
      narrationMs,
      enterMs: frame.enterMs,
      exitMs: frame.exitMs,
      leadInMs: leadInForFrame(frame, timing),
      tailMs: tail,
    });
  }
  return out;
}

/** `b` with its start moved by `deltaMs`, or the same object when nothing moves. */
function shiftedStart(b: Box, f: NarrationFields, deltaMs: number): Box {
  const at = Math.max(0, Math.round(numOr(b[f.startField], 0) * 1000) + deltaMs) / 1000;
  return b[f.startField] === at ? b : { ...b, [f.startField]: at };
}

/**
 * Put every narration clip back on its slide after a re-pack (plans/180 T7).
 *
 * `sequenceFramesInOrder` rewrites FRAME rows and returns every other row untouched, but
 * a Design box stores ABSOLUTE film-clock seconds. So the moment a re-pack lengthens one
 * slide, every later slide's voice, its caption boxes and its build starts are left where
 * they were - slide three begins while slide two is still speaking. Nothing in the solver
 * can fix that: it does not know which rows belong to which slide's voice.
 *
 * This does. For each frame carrying a narration clip it computes where the clip SHOULD
 * start (the frame's post-pack start plus its lead-in) and moves three sets of rows by
 * that one delta:
 *   • the clip itself,
 *   • its caption boxes, which are grouped by the clip's id and were cut from its words,
 *   • the frame's build fragments, whose starts {@link applyBuildStarts} wrote relative
 *     to the same base (a fragment with no start at all is left alone - it has no moment
 *     to move).
 *
 * Idempotent: a deck already anchored comes back with every row's object identity intact.
 */
export function reanchorNarration(
  boxes: readonly Box[], f: NarrationFields, timing: NarrationTiming = {},
): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const byFrame = new Map<string, number>();
  const byCaptionGroup = new Map<string, number>();
  for (const frame of narrationFrames(rows, f)) {
    const clip = frame.clip;
    if (!clip) continue;
    const want = Math.max(0, frame.startMs) + leadInForFrame(frame, timing);
    const have = Math.round(numOr(clip[f.startField], 0) * 1000);
    const delta = want - have;
    if (!delta) continue;
    byFrame.set(frame.id, delta);
    const clipId = str(clip[f.idField]);
    if (clipId) byCaptionGroup.set(captionGroup(clipId), delta);
  }
  if (!byFrame.size) return rows.slice();
  return rows.map((b) => {
    if (!b) return b;
    const group = str(b[f.groupField]);
    const narrated = narratedFrameId(group);
    if (narrated) {
      const d = byFrame.get(narrated);
      return d == null ? b : shiftedStart(b, f, d);
    }
    const capDelta = byCaptionGroup.get(group);
    if (capDelta != null) return shiftedStart(b, f, capDelta);
    const d = byFrame.get(str(b[f.frameField]));
    if (d == null) return b;
    if (!(Math.round(numOr(b[f.buildField], 0)) >= 1)) return b;
    if (b[f.startField] == null || b[f.startField] === '') return b;
    return shiftedStart(b, f, d);
  });
}

/**
 * One slide's spoken words, on the FILM clock - what a caption sidecar is cut from
 * (plans/180 T4).
 *
 * The words come off the clip's own `meta.tts.words`, which is exact by construction, so
 * a caller never transcribes audio it synthesised. A slide whose clip carries no timings
 * (an imported voice, or a save that predates them) is simply absent from the list rather
 * than guessed at.
 */
export interface NarrationSlice {
  frameId: string;
  words: SpeechWordTiming[];
  /** The slide's own window on the film clock, ms. Cues are clamped to it. */
  startMs: number;
  endMs: number;
  /** How far into the slide the clip's t=0 sits - the lead-in. */
  offsetMs: number;
}

/**
 * {@link narrationSlices} against a runtime model, whatever the blocks input is called.
 *
 * The narrated rows are found by their own contract - a `narration:` group - rather than
 * by an input id, so a caller that only holds `runtime.getModel()` (the export path) can
 * reach them without knowing the tool's field names.
 */
export function narrationSlicesFromModel(
  model: ReadonlyArray<{ id?: string; value?: unknown }>,
  f: NarrationFields = DESIGN_NARRATION_FIELDS,
): NarrationSlice[] {
  for (const input of model ?? []) {
    const rows = input?.value;
    if (!Array.isArray(rows) || !rows.length) continue;
    if (!rows.some((b) => b && isNarrationGroup((b as Box)[f.groupField]))) continue;
    return narrationSlices(rows as Box[], f);
  }
  return [];
}

/** {@link NarrationSlice} for every narrated frame, in play order. */
export function narrationSlices(boxes: readonly Box[], f: NarrationFields): NarrationSlice[] {
  const out: NarrationSlice[] = [];
  for (const frame of narrationFrames(boxes, f)) {
    const clip = frame.clip;
    if (!clip) continue;
    const meta = (clip[f.assetField] as { meta?: { tts?: { words?: SpeechWordTiming[] } } } | null | undefined)?.meta;
    const words = meta?.tts?.words;
    if (!Array.isArray(words) || !words.length) continue;
    const clipStartMs = Math.round(numOr(clip[f.startField], 0) * 1000);
    const clipDurMs = Math.round(numOr(clip[f.durField], 0) * 1000);
    const startMs = Math.max(0, frame.startMs);
    // A deck nobody sequenced has no slide window, so the clip's own is the honest one.
    const endMs = frame.durMs > 0 ? startMs + frame.durMs : clipStartMs + clipDurMs;
    out.push({
      frameId: frame.id,
      words: words.slice(),
      startMs,
      endMs,
      offsetMs: Math.max(0, clipStartMs - startMs),
    });
  }
  return out;
}

/* ── the job ───────────────────────────────────────────────────────────────── */

/**
 * The host slice a narration run touches: the speech bridge, the user-asset store
 * (the clip is saved through the identical path the Script-audio dialog uses), and
 * the meta annotation write that files `meta.narration` for stale detection.
 */
export interface NarrationHost extends ScriptAudioHost {
  assets: ScriptAudioHost['assets'] & {
    _updateUserAssetMeta?(id: string, meta: Record<string, unknown>, patch?: { aiGenerated?: 'full' | 'partial' }): Promise<void>;
  };
}

/** One Narrate press, snapshotted at click time. */
export interface NarrateRequest {
  fields: NarrationFields;
  /** Read the document's rows. Called again after every slide, so a concurrent
   *  edit is merged rather than clobbered by a stale snapshot. */
  getBoxes(): Box[];
  /** Commit a whole new rows array - one undo step per slide. */
  commit(next: Box[]): void;
  /** Re-pack the deck after the floors change; the caller owns the solver options. */
  repack(floors: Record<string, number>): void;
  /** Voice id or `+`-joined blend. Empty uses the shell's default voice. */
  voice?: string;
  speed?: number;
  timing?: NarrationTiming;
  /** Narrate only these frames. Empty/omitted means every frame with notes. */
  frameIds?: readonly string[];
  /** Re-speak even the slides whose notes have not changed. */
  force?: boolean;
  /** The document's language, for the English-only announcement. */
  lang?: string;
  /** Write caption boxes from the clip's own word timings. Default true. */
  captions?: boolean;
}

/** What a finished run reports. */
export interface NarrateResult {
  /** Frames spoken this run. */
  narrated: number;
  /** Frames already current, so nothing was spoken for them. */
  skipped: number;
  /** Frames with builds but no '>' markers, which appear with the slide. */
  unmarkedBuilds: number;
}

export interface NarrateHooks {
  onError?(err: unknown): void;
  onSettled?(): void;
}

/** Is this document's language one the shipped voices actually read? */
export function isEnglishLang(lang: unknown): boolean {
  const s = String(lang ?? '').trim().toLowerCase();
  return !s || s === 'en' || s.startsWith('en-') || s.startsWith('en_');
}

/** Frames this run should speak: notes present, and stale unless `force`. */
export function framesToNarrate(
  frames: readonly NarrationFrame[],
  metaOf: (frame: NarrationFrame) => unknown,
  opts: { frameIds?: readonly string[]; force?: boolean } = {},
): NarrationFrame[] {
  const only = opts.frameIds && opts.frameIds.length ? new Set(opts.frameIds) : null;
  return frames.filter((fr) => {
    if (!fr.spoken) return false;
    if (only && !only.has(fr.id)) return false;
    if (opts.force) return true;
    return narrationState(fr.notes, metaOf(fr)) !== 'current';
  });
}

/** The asset meta already attached to a frame's clip box, when the ref carries it. */
function clipMetaOf(frame: NarrationFrame, f: NarrationFields): unknown {
  const ref = frame.clip?.[f.assetField];
  return (ref as { meta?: unknown } | null | undefined)?.meta;
}

/**
 * Speak one frame's notes and save the clip. Resolves the saved ref plus the word
 * timings, or null when the run was cancelled. Throws whatever the speech bridge
 * threw, for the job to fail with.
 */
async function narrateOneFrame(
  host: NarrationHost, frame: NarrationFrame,
  opts: { voice: string; speed: number; signal: AbortSignal; onProgress(p: SpeechProgress): void },
): Promise<{ ref: AssetRef | null; words: SpeechWordTiming[]; durationMs: number } | null> {
  const speech = host.speech;
  if (!speech) return null;
  const [{ pcmToWavBlob }, { saveTtsClip }] = await Promise.all([
    import('./pcm-wav.ts'),
    import('../views/script-audio.ts'),
  ]);
  const result = await speech.synthesize(frame.spoken, {
    ...(opts.voice ? { voice: opts.voice } : {}),
    speed: opts.speed,
    signal: opts.signal,
    onProgress: opts.onProgress,
  });
  const clip: TtsClip = {
    result,
    // Mono PCM to 16-bit WAV: the encoder is stereo, so the one channel feeds both.
    wavBlob: pcmToWavBlob({ left: result.pcm, right: result.pcm, sampleRate: result.sampleRate }),
    spokenText: frame.spoken,
    // The voice the clip was ACTUALLY spoken with. The document's narration voice
    // defaults to '' ("use the shell's default"), and a recipe saved with '' read as
    // "not generated by Lolly" to ttsRecipeFromMeta, so Regenerate refused every
    // narration clip with "this clip has no recipe" (Andy, 2026-09-03).
    voice: opts.voice || KOKORO_DEFAULT_VOICE,
    speed: opts.speed,
  };
  // saveTtsClip is the ONE save path: `aiGenerated: 'full'`, the signed
  // synthetic-voice C2PA embedded in the wav bytes, and the `meta.tts` recipe the
  // captions are read back from. Narration adds nothing to it except the note
  // below, which says which slide the clip belongs to and what it was spoken from.
  const ref = await saveTtsClip(host, clip);
  if (ref) {
    const note = narrationNote(frame.id, frame.notes);
    try {
      await host.assets._updateUserAssetMeta?.(ref.id, { ...(ref.meta ?? {}), narration: note });
      if (ref.meta) (ref.meta as Record<string, unknown>).narration = note;
    } catch (err) {
      // The clip is saved and the audio is right; only the stale check degrades,
      // so the next Narrate re-speaks this slide instead of skipping it.
      host.log?.('warn', `narration note not stored - ${String(err)}`);
    }
  }
  return { ref, words: result.words ?? [], durationMs: Math.round((result.duration || 0) * 1000) };
}

/**
 * Narrate a deck as a background job (the lib/stt-job.ts pattern): the serial heavy
 * queue a model run belongs in, the global toast that owns progress and cancel, and
 * a run that keeps going when the user navigates away.
 *
 * Each slide is committed as it finishes, so a cancel half way through keeps the
 * slides already spoken rather than discarding the whole run. The deck is re-packed
 * once per committed slide (T7): later starts have to shift the moment a slide gets
 * longer, or the next slide's narration would begin under this one's last words.
 */
export function narrateDeckAsJob(
  host: NarrationHost, req: NarrateRequest, hooks: NarrateHooks = {},
): JobHandle {
  const controller = new AbortController();
  const job = startJob({ title: t('Narrating slides'), cancel: () => controller.abort() });
  const f = req.fields;
  const timing = req.timing ?? {};
  const voice = String(req.voice ?? '').trim();
  const speed = Number.isFinite(Number(req.speed)) && Number(req.speed) > 0 ? Number(req.speed) : 1;
  const wantCaptions = req.captions !== false;
  void (async (): Promise<void> => {
    let narrated = 0;
    let skipped = 0;
    let unmarkedBuilds = 0;
    try {
      await job.started;
      if (job.cancelled) return;
      // The ONE reading of a SpeechProgress lives with the generate path, so this
      // toast and the Script-audio panel's own track can never show two different
      // percentages. Fetched here rather than imported at the top for the reason
      // the type-only import above states.
      const { speechProgressFraction } = await import('../views/script-audio.ts');
      // English-only is the honest state of this build's phoneme coverage
      // (plans/41 section 2), so say it once rather than reading the words in an
      // English accent without comment.
      if (!isEnglishLang(req.lang)) announce(t('Narration uses an English voice.'));
      const all = narrationFrames(req.getBoxes(), f);
      const todo = framesToNarrate(all, (fr) => clipMetaOf(fr, f), { frameIds: req.frameIds, force: req.force });
      skipped = all.filter((fr) => fr.spoken).length - todo.length;
      if (!todo.length) {
        job.finish({ narrated: 0, skipped, unmarkedBuilds: 0 } satisfies NarrateResult);
        announce(skipped
          ? t('Every narrated slide is already up to date.')
          : t('No slide has speaker notes to narrate yet.'));
        return;
      }
      for (let n = 0; n < todo.length; n++) {
        if (job.cancelled) break;
        const target = todo[n]!;
        const label = tRaw('Slide {n} of {total}', { n: String(n + 1), total: String(todo.length) });
        job.progress(n, todo.length, label);
        const spoken = await narrateOneFrame(host, target, {
          voice,
          speed,
          signal: controller.signal,
          onProgress: (p) => {
            const fraction = speechProgressFraction(p);
            const note = p.phase === 'download' ? t('Downloading the voice model…') : label;
            // One slide's share of the bar, so the toast advances inside a slide
            // as well as between them.
            if (fraction == null) job.progress(n, todo.length, note);
            else job.progress(Math.round((n + fraction) * 100), todo.length * 100, note);
          },
        });
        if (job.cancelled || !spoken?.ref) break;
        // Re-read the model: minutes may have passed and the user may have edited
        // the deck, so the write goes onto the CURRENT rows, never the snapshot.
        const fresh = narrationFrames(req.getBoxes(), f).find((fr) => fr.id === target.id);
        if (!fresh) continue;   // the slide was deleted while its voice was being made
        const leadIn = leadInForFrame(fresh, timing);
        const startMs = fresh.startMs + leadIn;
        let next = applyNarrationClip(req.getBoxes(), f, {
          frameId: fresh.id,
          asset: spoken.ref,
          startMs,
          durMs: spoken.durationMs,
          // No `name`. The row's own `group` already says what it is, and the timeline
          // translates the word where it paints it - a t() literal stored here would put
          // the UI language into the document, the packed `z=` link and every exported
          // layer name, so a German author's deck read "Erzählung" on an English desk.
          frameRect: fresh.rect,
        });
        // Only the audio actually under THIS voice (T6): a sound effect five slides away
        // has nothing to duck against, and quietening it would ride the same undo entry.
        next = duckBedForNarration(next, f, NARRATION_BED_DUCK, {
          startMs, endMs: startMs + spoken.durationMs,
        });
        const offsets = narrationBuildOffsets(spoken.words, target.marks);
        if (offsets.length) {
          next = applyBuildStarts(next, f, {
            frameId: fresh.id, slideStartMs: fresh.startMs, leadInMs: leadIn, offsetsMs: offsets,
          });
        } else if (!target.marks.length && hasBuilds(next, f, fresh.id)) {
          unmarkedBuilds++;
        }
        if (wantCaptions && spoken.words.length) {
          const clipId = str(next[next.length - 1]?.[f.idField]);
          const slideEndMs = startMs + spoken.durationMs;
          const cues = cuesForSlide(spoken.words, startMs, slideEndMs, { offsetMs: 0 });
          if (clipId) next = applyNarrationCaptions(next, f, { sourceId: clipId, frameId: fresh.id, cues, frameRect: fresh.rect });
        }
        req.commit(next);
        // T7, both halves. The re-pack moves the FRAMES: this slide just got a floor, so
        // every later start shifts. Then the re-anchor moves what rides on them - each
        // slide's clip, its captions and its build fragments all store absolute film
        // time, and the solver returns every non-frame row untouched. Without the second
        // step, lengthening slide one leaves slide two's voice speaking over it.
        req.repack(narrationDwellFloors(req.getBoxes(), f, timing));
        const packed = req.getBoxes();
        const anchored = reanchorNarration(packed, f, timing);
        // Only when something actually moved. A caller whose own repack already
        // re-anchored (the Design overlay composes both into one commit) must not pay a
        // second undo entry for an array that is row-for-row the one it just wrote.
        if (anchored.some((b, i) => b !== packed[i])) req.commit(anchored);
        narrated++;
      }
      if (unmarkedBuilds) {
        // The animNotes precedent: say it once for the whole run, not per box.
        host.log?.('warn', `narration: ${unmarkedBuilds} slide(s) have build steps but no "${BUILD_MARKER}" markers in their notes - every build appears with its slide`);
      }
      if (job.cancelled) return;
      job.finish({ narrated, skipped, unmarkedBuilds } satisfies NarrateResult);
      // The commonest run is ONE slide, from the inspector - "1 slides narrated." is the
      // sentence a reader meets first (views/catalog.ts's own singular/plural pattern).
      announce(narrated === 1
        ? t('1 slide narrated.')
        : tRaw('{n} slides narrated.', { n: String(narrated) }));
    } catch (err) {
      if (job.cancelled || (err as Error | null)?.name === 'AbortError') return;
      host.log?.('warn', `narration job failed - ${String(err)}`);
      job.fail(err);
      hooks.onError?.(err);
    } finally {
      hooks.onSettled?.();
    }
  })();
  return job;
}

/** Does this frame hold any box with a build step? */
function hasBuilds(boxes: readonly Box[], f: NarrationFields, frameId: string): boolean {
  for (const b of boxes) {
    if (!b || str(b[f.frameField]) !== frameId) continue;
    if (Math.round(numOr(b[f.buildField], 0)) >= 1) return true;
  }
  return false;
}

/**
 * What the run does, what it downloads once, and one Go - then ENQUEUE and close,
 * the shape lib/stt-job.ts's consent sheet already keeps.
 *
 * Closing the sheet aborts nothing. Before Go there is nothing to abort; after Go
 * the run belongs to the job, whose cancel in the global toast is the honest one,
 * so a stray Escape can never throw away a model download and the synthesis behind
 * it. `onDismiss` fires only when the sheet closed WITHOUT enqueuing.
 */
export async function openNarrateConsent(
  host: NarrationHost, req: NarrateRequest,
  hooks: NarrateHooks & { onDismiss?(): void } = {},
): Promise<void> {
  const speech = host.speech;
  if (!speech?.isAvailable()) { hooks.onDismiss?.(); return; }
  const f = req.fields;
  const frames = narrationFrames(req.getBoxes(), f);
  const todo = framesToNarrate(frames, (fr) => clipMetaOf(fr, f), { frameIds: req.frameIds, force: req.force });
  if (!todo.length) {
    announce(frames.some((fr) => fr.spoken)
      ? t('Every narrated slide is already up to date.')
      : t('No slide has speaker notes to narrate yet.'));
    hooks.onDismiss?.();
    return;
  }
  // Lazily imported so this module stays loadable outside a document (its own test
  // suite, and any headless caller of the job driver above).
  const [{ mountModal }, { fmtBytes }] = await Promise.all([
    import('../components/modal.ts'),
    import('./device-info.ts'),
  ]);
  let bytes = 0;
  try { bytes = speech.modelBytes(); } catch { /* the consent line just omits the size */ }
  let enqueued = false;
  const title = t('Narrate slides');
  const html = `<form method="dialog" class="tl-junction tl-stt">
    <h2 class="tl-junction-title">${title}</h2>
    <p class="tl-stt-note">${todo.length === 1
      ? t('Reads the speaker notes on 1 slide aloud on this device and places the audio on that slide. Nothing is uploaded.')
      : tRaw('Reads the speaker notes on {n} slides aloud on this device and places the audio on each slide. Nothing is uploaded.', { n: String(todo.length) })}</p>
    <p class="tl-stt-note">${t('The voices are English only. The clip is marked as a synthetic voice.')}</p>
    <p class="tl-stt-note tl-stt-note-dl" data-narrate-dl hidden></p>
    <p class="tl-stt-note">${t('It runs in the background, so you can close this and keep working.')}</p>
    <div class="tl-junction-actions">
      <button type="button" class="btn" data-act="cancel">${t('Cancel')}</button>
      <button type="button" class="btn btn--primary" data-act="go">${t('Narrate')}</button>
    </div>
  </form>`;
  const modal = mountModal<void>(html, {
    className: 'modal tl-junction-modal',
    ariaLabel: title,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="go"]'),
    onClose: () => { if (!enqueued) hooks.onDismiss?.(); },
  });
  const dlNote = modal.el.querySelector<HTMLElement>('[data-narrate-dl]');
  // The one-time download is the consent-worthy part, so say so up front - but only
  // when it is actually owed (the probe is async, the line arrives).
  void speech.cached().then((cached) => {
    if (cached || !dlNote) return;
    dlNote.textContent = bytes > 0
      ? t('The first run downloads the voice model once ({size}). It stays on this device.', { size: fmtBytes(bytes) })
      : t('The first run downloads the voice model once. It stays on this device.');
    dlNote.hidden = false;
  }).catch(() => { /* the probe failing just means no size line */ });
  modal.el.querySelector<HTMLElement>('[data-act="go"]')?.addEventListener('click', () => {
    if (enqueued) return;
    enqueued = true;
    narrateDeckAsJob(host, req, hooks);
    modal.close();
    announce(t('Narrating in the background. You can keep working.'));
  });
  modal.el.querySelector<HTMLElement>('[data-act="cancel"]')?.addEventListener('click', () => modal.close());
}
