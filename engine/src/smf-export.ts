// SPDX-License-Identifier: MPL-2.0
/**
 * Notes to a format-1 Standard MIDI File, for the music tools' `.mid` export.
 *
 * Input is a plain list of notes in quarter-note beats, so any tool can use it:
 * Rondocode feeds it the notes its songs schedule. Output is an {@link SmfFile}
 * (and {@link notesToMidiBytes} for the bytes) built on engine/src/smf.ts:
 *
 *   - a conductor track first (track name, tempo, time signature, optional key
 *     signature, optional text), then one track per voice, in first-appearance order;
 *   - each voice track carries its name, a General MIDI program change when the voice's
 *     name maps to one sensibly ({@link gmProgramFor}), and its notes;
 *   - voices take channels 1 to 16 in turn and skip channel 10 (index 9), which General
 *     MIDI reserves for drums; a voice marked `percussion` uses channel 10 and no program;
 *   - velocity is the note's own (0..1, mapped to 1..127, never 0 because velocity 0 means
 *     note-off), or `defaultVelocity` when the note carries none.
 *
 * What a MIDI file cannot hold is the caller's to state: synthesis parameters, effects,
 * filters, sample choice and tuning other than twelve-tone. A fractional pitch is rounded
 * to the nearest semitone, and when it is more than a cent off a pitch bend (default
 * plus or minus 2 semitone range) is written before the note and reset after the note ends.
 *
 * Deterministic: the same notes and options always give the same bytes.
 */
import {
  type SmfChannelEvent, type SmfEvent, type SmfFile, type SmfTrackChunk,
  smfEndOfTrack, smfKeySignatureEvent, smfTempoEvent, smfTextEvent, smfTimeSignatureEvent, writeSmf, SmfError,
} from './smf.ts';

export interface MidiNote {
  /** The voice (instrument or part) it belongs to. Notes with the same voice share a track. */
  voice: string;
  /** Start, in quarter notes from the beginning. */
  startBeats: number;
  /** Length in quarter notes. */
  durBeats: number;
  /** MIDI note number (60 is middle C). Fractional values are rounded, with a pitch bend. */
  pitch: number;
  /** 0 to 1. Mapped to 1 to 127. Left out: {@link MidiExportOptions.defaultVelocity}. */
  velocity?: number;
}

export interface MidiVoiceSpec {
  name: string;
  /** General MIDI program, 0 to 127. Left out: looked up from the name, else none. */
  program?: number | null;
  /** Write on channel 10 (drums). The notes are kept as given. */
  percussion?: boolean;
}

export interface MidiExportOptions {
  /** Tempo in quarter notes per minute. Default 120. */
  bpm?: number;
  /** Default 4/4. The denominator is a power of two. */
  timeSignature?: { numerator: number; denominator: number };
  /** Sharps from -7 to 7 and mode. Left out: no key signature is written. */
  keySignature?: { sharps: number; minor: boolean };
  /** Ticks per quarter note, 1 to 32767. Default 480. */
  ticksPerQuarter?: number;
  /** Name of the conductor track. */
  title?: string;
  /** A text event at tick 0 of the conductor track (a credit line, for instance). */
  text?: string;
  /** Velocity for a note with none, 1 to 127. Default 100. */
  defaultVelocity?: number;
  /** Voice order, names, programs and percussion flags. Voices not listed follow in first-appearance order. */
  voices?: readonly MidiVoiceSpec[];
  /** Cap on notes, so a hostile input cannot allocate without bound. Default 500000. */
  maxNotes?: number;
}

/** `velocity` 0 to 1 as a MIDI velocity, 1 to 127. */
export function velocityToMidi(v: number): number {
  return Math.max(1, Math.min(127, Math.round((Number.isFinite(v) ? v : 0) * 127)));
}

/** The General MIDI program names, index = program number. */
const GM_KEYWORDS: readonly (readonly [RegExp, number])[] = [
  [/\b(grand|piano|keys?)\b/i, 0], [/\b(e-?piano|rhodes|wurli)/i, 4], [/\b(harpsichord)/i, 6], [/\b(clav)/i, 7],
  [/\b(bell|glock|chime)/i, 9], [/\b(marimba|mallet)/i, 12], [/\b(vibes|vibraphone)/i, 11], [/\b(organ)/i, 19],
  [/\b(acoustic ?guitar|nylon|guitar)\b/i, 24], [/\b(elec(tric)? ?guitar|gtr)\b/i, 27], [/\b(sub|bass)\b/i, 33], [/\b(acid|303)\b/i, 38],
  [/\b(violin)/i, 40], [/\b(viola)/i, 41], [/\b(cello)/i, 42], [/\b(strings?|orch)/i, 48], [/\b(harp)/i, 46], [/\b(pizz)/i, 45],
  [/\b(choir|vox|voice|sing|aah)/i, 52], [/\b(trumpet)/i, 56], [/\b(trombone)/i, 57], [/\b(horn|brass)/i, 60],
  [/\b(sax)/i, 65], [/\b(oboe)/i, 68], [/\b(clarinet)/i, 71], [/\b(flute)/i, 73], [/\b(pan ?flute|recorder)/i, 74],
  [/\b(saw ?lead|lead|saw)\b/i, 81], [/\b(square)\b/i, 80], [/\b(pad|warm|ambient)\b/i, 89], [/\b(pluck|harp)\b/i, 45],
];

const DRUM_WORDS = /\b(drum|kick|snare|hat|hihat|hi-hat|clap|tom|perc|cymbal|rim|bd|sd|hh|cp)\b/i;

/** True when a voice name reads as drums or percussion. */
export function looksPercussive(name: string): boolean {
  return DRUM_WORDS.test(name);
}

/** A General MIDI program (0 to 127) for a voice name, or null when no keyword fits. Never guesses from nothing. */
export function gmProgramFor(name: string): number | null {
  if (looksPercussive(name)) return null;
  for (const [re, prog] of GM_KEYWORDS) if (re.test(name)) return prog;
  return null;
}

/** MIDI channel index for the i-th melodic voice: 0 to 15, skipping 9. */
export function voiceChannel(i: number): number {
  const c = i % 15;
  return c >= 9 ? c + 1 : c;
}

const bend = (semi: number): number => Math.max(0, Math.min(16383, 8192 + Math.round((semi / 2) * 8192)));

interface Abs { tick: number; order: number; ev: Omit<SmfChannelEvent, 'delta'> }

function checkOpts(o: MidiExportOptions): Required<Pick<MidiExportOptions, 'bpm' | 'ticksPerQuarter' | 'defaultVelocity' | 'maxNotes'>> {
  const bpm = o.bpm ?? 120;
  const tpq = o.ticksPerQuarter ?? 480;
  const dv = o.defaultVelocity ?? 100;
  if (!Number.isFinite(bpm) || bpm <= 0) throw new SmfError('invalid-value', 'bpm must be positive and finite', 0);
  if (!Number.isInteger(tpq) || tpq < 1 || tpq > 32767) throw new SmfError('invalid-value', 'ticksPerQuarter must be a whole number from 1 to 32767', 0);
  if (!Number.isInteger(dv) || dv < 1 || dv > 127) throw new SmfError('invalid-value', 'defaultVelocity must be a whole number from 1 to 127', 0);
  return { bpm, ticksPerQuarter: tpq, defaultVelocity: dv, maxNotes: o.maxNotes ?? 500_000 };
}

/** Build the format-1 file for `notes`. Throws {@link SmfError} for values that cannot be written. */
export function notesToSmfFile(notes: readonly MidiNote[], options: MidiExportOptions = {}): SmfFile {
  const { bpm, ticksPerQuarter: tpq, defaultVelocity, maxNotes } = checkOpts(options);
  if (notes.length > maxNotes) throw new SmfError('invalid-value', `more than ${maxNotes} notes`, 0);

  const order: string[] = [];
  const spec = new Map<string, MidiVoiceSpec>();
  for (const v of options.voices ?? []) if (!spec.has(v.name)) { spec.set(v.name, v); order.push(v.name); }
  const byVoice = new Map<string, MidiNote[]>(order.map((n) => [n, []]));
  notes.forEach((n, i) => {
    if (!Number.isFinite(n.startBeats) || !Number.isFinite(n.durBeats) || !Number.isFinite(n.pitch) || n.startBeats < 0) {
      throw new SmfError('invalid-value', 'a note has a start, length or pitch that is not a finite number (start must not be negative)', i);
    }
    let l = byVoice.get(n.voice);
    if (!l) { l = []; byVoice.set(n.voice, l); order.push(n.voice); }
    l.push(n);
  });

  const ts = options.timeSignature ?? { numerator: 4, denominator: 4 };
  const conductor: SmfEvent[] = [smfTextEvent(0x03, options.title ?? 'Conductor')];
  if (options.text) conductor.push(smfTextEvent(0x01, options.text));
  conductor.push(smfTempoEvent(60_000_000 / bpm), smfTimeSignatureEvent(ts.numerator, ts.denominator));
  if (options.keySignature) conductor.push(smfKeySignatureEvent(options.keySignature.sharps, options.keySignature.minor));
  conductor.push(smfEndOfTrack());
  const chunks: SmfTrackChunk[] = [{ kind: 'track', events: conductor }];

  let melodic = 0;
  for (const name of order) {
    const vs = spec.get(name);
    const percussion = vs?.percussion ?? false;
    const channel = percussion ? 9 : voiceChannel(melodic++);
    const program = percussion ? null : vs?.program !== undefined ? vs.program : gmProgramFor(name);
    if (program != null && (!Number.isInteger(program) || program < 0 || program > 127)) throw new SmfError('invalid-value', 'program must be 0 to 127', 0);

    const abs: Abs[] = [];
    for (const n of byVoice.get(name)!) {
      const start = Math.round(n.startBeats * tpq);
      const dur = Math.max(1, Math.round(n.durBeats * tpq));
      const rounded = Math.max(0, Math.min(127, Math.round(n.pitch)));
      const off = n.pitch - rounded;
      const vel = n.velocity === undefined ? defaultVelocity : velocityToMidi(n.velocity);
      const bent = Math.abs(off) > 0.01;
      if (bent) {
        const v = bend(off);
        abs.push({ tick: start, order: 2, ev: { kind: 'channel', type: 'pitchBend', channel, data1: v & 0x7f, data2: v >> 7 } });
        abs.push({ tick: start + dur, order: 1, ev: { kind: 'channel', type: 'pitchBend', channel, data1: 0, data2: 64 } });
      }
      abs.push({ tick: start, order: 3, ev: { kind: 'channel', type: 'noteOn', channel, data1: rounded, data2: vel } });
      abs.push({ tick: start + dur, order: 0, ev: { kind: 'channel', type: 'noteOff', channel, data1: rounded, data2: 64 } });
    }
    abs.sort((a, b) => a.tick - b.tick || a.order - b.order);

    const events: SmfEvent[] = [smfTextEvent(0x03, name)];
    if (program !== null && program !== undefined) events.push({ kind: 'channel', type: 'programChange', channel, data1: program, delta: 0 });
    let last = 0;
    for (const a of abs) {
      events.push({ ...a.ev, delta: a.tick - last });
      last = a.tick;
    }
    events.push(smfEndOfTrack());
    chunks.push({ kind: 'track', events });
  }
  return { header: { format: 1, division: tpq }, chunks };
}

/** The bytes of {@link notesToSmfFile}. `runningStatus` is on by default to keep files small. */
export function notesToMidiBytes(notes: readonly MidiNote[], options: MidiExportOptions = {}): Uint8Array {
  return writeSmf(notesToSmfFile(notes, options), { runningStatus: true });
}
