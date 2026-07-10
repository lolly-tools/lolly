// SPDX-License-Identifier: MPL-2.0
/**
 * Standard MIDI File → ZzFXM. A self-contained SMF parser plus a note→pattern
 * mapper that turns a .mid into a tiny {@link ZzfxSong} the engine renders to PCM
 * (zzfxm.ts) — the SAME portable format hand-authored songs and the procedural
 * generator produce, so a converted MIDI plays through ONE code path everywhere
 * (Neurospicy player, catalog preview, video music bed) with no per-format player,
 * WASM, or soundfont.
 *
 * DOM-free and dependency-free (Uint8Array + DataView only), so it runs unchanged
 * in the browser upload path (shells/web picker) and the `scripts/ingest-midi.ts`
 * CLI off the same source.
 *
 * Mapping: notes quantise to a fixed step grid; ZzFXM BPM is set so a step equals
 * that grid unit at the file's tempo. Overlapping notes (chords/polyphony) split
 * greedily across ZzFXM voice-channels (one note per channel per step). Notes are
 * shifted so the LOWEST note becomes ZzFXM note 1 (0/negative are rest/stop in
 * ZzFXM); the single voice's base frequency compensates, so absolute pitch is
 * preserved. Velocity/dynamics are dropped (v1).
 *
 * Hardened for untrusted uploads: every offset is bounds-checked, malformed track
 * lengths are clamped to the buffer, and note count / step span are capped so a
 * hostile or corrupt file can't spin the parser or blow up array allocation.
 */
import type { ZzfxSong, ZzfxInstrument } from './zzfxm.ts';

/**
 * The single voice a converted MIDI plays through — a soft tan-wave, quick-attack
 * piano-ish timbre (ZzFX param list; index 2 is the base frequency, overwritten
 * per song so absolute pitch stays exact). Mirrors PRESETS.piano in
 * scripts/lib/zzfx-music.ts (C4 = 261.63 Hz).
 */
const PIANO: ZzfxInstrument = [0.4, 0, 261.63, 0.002, 0.06, 0.55, 3, 1];

/** Bounds that keep a hostile/corrupt file from hanging or exhausting memory. */
const MAX_NOTES = 200_000;      // a real focus loop has hundreds; this is a hard backstop
const MAX_STEPS = 1 << 15;      // 32768 grid steps — caps per-voice array allocation
const MAX_VOICES = 8;           // simultaneous ZzFXM channels; excess overlaps are dropped

interface NoteEv { start: number; end: number; midi: number }

export interface ParsedMidi { notes: NoteEv[]; division: number; bpm: number }

export interface MidiToSongOptions {
  /** Human title stored on the song (metadata only). */
  name?: string;
  /** Grid resolution: steps per quarter note (4 = 16th-note grid). Default 4. */
  stepsPerQuarter?: number;
}

/** Read 4 bytes at `off` as an ASCII chunk tag ('MThd' / 'MTrk'). */
function tag(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off] ?? 0, b[off + 1] ?? 0, b[off + 2] ?? 0, b[off + 3] ?? 0);
}

/** Minimal Standard MIDI File parser → absolute-tick note events + tempo. */
export function parseMidi(bytes: Uint8Array): ParsedMidi {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 14 || tag(bytes, 0) !== 'MThd') throw new Error('not a Standard MIDI File');
  const division = dv.getUint16(12);
  const ntracks = dv.getUint16(10);
  let pos = 8 + dv.getUint32(4);
  const notes: NoteEv[] = [];
  let usPerQuarter = 500000; // 120 BPM default

  for (let t = 0; t < ntracks && notes.length < MAX_NOTES; t++) {
    if (pos + 8 > bytes.length || tag(bytes, pos) !== 'MTrk') break;
    const len = dv.getUint32(pos + 4);
    let p = pos + 8;
    const end = Math.min(p + len, bytes.length);   // clamp a bogus length to the real buffer
    let tick = 0;
    let status = 0;
    const active = new Map<number, number[]>(); // (channel<<8|note) → stack of start ticks

    while (p < end && notes.length < MAX_NOTES) {
      let delta = 0, b: number;
      do { b = bytes[p++] ?? 0; delta = (delta << 7) | (b & 0x7f); } while (b & 0x80 && p < end);
      tick += delta;
      let sb = bytes[p] ?? 0;
      if (sb & 0x80) { status = sb; p++; } else sb = status; // running status

      if (sb === 0xff) {
        const type = bytes[p++] ?? 0;
        let mlen = 0, mb: number;
        do { mb = bytes[p++] ?? 0; mlen = (mlen << 7) | (mb & 0x7f); } while (mb & 0x80 && p < end);
        if (type === 0x51 && mlen === 3 && p + 3 <= end) {
          usPerQuarter = (bytes[p]! << 16) | (bytes[p + 1]! << 8) | bytes[p + 2]!;
        }
        p += mlen;
      } else if (sb === 0xf0 || sb === 0xf7) {
        let slen = 0, sbb: number;
        do { sbb = bytes[p++] ?? 0; slen = (slen << 7) | (sbb & 0x7f); } while (sbb & 0x80 && p < end);
        p += slen;
      } else {
        const hi = sb & 0xf0, ch = sb & 0x0f;
        if (hi === 0x90 || hi === 0x80) {
          const note = bytes[p++] ?? 0, vel = bytes[p++] ?? 0;
          const key = (ch << 8) | note;
          if (hi === 0x90 && vel > 0) {
            (active.get(key) ?? active.set(key, []).get(key)!).push(tick);
          } else {
            const stack = active.get(key);
            if (stack && stack.length) notes.push({ start: stack.shift()!, end: tick, midi: note });
          }
        } else if (hi === 0xc0 || hi === 0xd0) { p += 1; } else { p += 2; }
      }
    }
    pos = end;
  }
  return { notes, division, bpm: usPerQuarter > 0 ? 60000000 / usPerQuarter : 120 };
}

/** Map parsed MIDI note events onto a ZzFXM song (one piano voice, greedy polyphony). */
export function midiToSong(parsed: ParsedMidi, opts: MidiToSongOptions = {}): ZzfxSong {
  const { notes, division } = parsed;
  const bpm = Number.isFinite(parsed.bpm) && parsed.bpm > 0 ? parsed.bpm : 120;
  const stepsPerQuarter = opts.stepsPerQuarter && opts.stepsPerQuarter > 0 ? opts.stepsPerQuarter : 4;
  if (!notes.length) throw new Error('no notes in MIDI');
  // SMPTE time division (high bit set) encodes frames/sec, not ticks/quarter — we
  // only map the common PPQ form; reject rather than silently mistiming.
  if (!division || (division & 0x8000)) throw new Error('unsupported MIDI time division (SMPTE)');

  const stepTicks = division / stepsPerQuarter;
  const quant = (tick: number): number => Math.round(tick / stepTicks);

  const minMidi = notes.reduce((m, n) => Math.min(m, n.midi), Infinity);
  const K = minMidi - 1; // shift so the lowest note becomes ZzFXM note 1 (must be > 0)
  const baseFreq = 440 * 2 ** ((K - 57) / 12); // compensate so pitch of note 12 stays exact
  const piano = [...PIANO];
  piano[2] = baseFreq;

  const events = notes
    .map((n) => ({ s: quant(n.start), e: Math.max(quant(n.start) + 1, quant(n.end)), z: n.midi - K }))
    .filter((ev) => ev.s < MAX_STEPS)       // drop notes past the step cap (hostile/huge file)
    .sort((a, b) => a.s - b.s || b.z - a.z);
  if (!events.length) throw new Error('no notes in MIDI');
  const totalSteps = Math.min(events.reduce((m, e) => Math.max(m, e.e), 1), MAX_STEPS);

  // Greedy voice allocation: one note per voice-channel per step; overlaps → more voices.
  const voiceEnd: number[] = [];
  const voices: number[][] = [];
  for (const ev of events) {
    if (ev.s >= totalSteps) continue;
    let v = voiceEnd.findIndex((endStep) => endStep <= ev.s);
    if (v < 0) {
      if (voices.length >= MAX_VOICES) continue; // drop excess simultaneous notes
      v = voices.length;
      voices.push(new Array<number>(totalSteps).fill(0));
      voiceEnd.push(0);
    }
    voices[v]![ev.s] = ev.z;
    voiceEnd[v] = Math.min(ev.e, totalSteps);
  }

  const channels = voices.map((v) => [0, 0, ...v]);
  const song: ZzfxSong = {
    bpm: Math.round((bpm * stepsPerQuarter) / 4),
    instruments: [piano],
    patterns: [channels],
    sequence: [0],
  };
  if (opts.name) song.title = opts.name;
  return song;
}

/** Convenience: bytes-in → {@link ZzfxSong}-out (parse + map). */
export function midiToZzfxm(bytes: Uint8Array, opts: MidiToSongOptions = {}): ZzfxSong {
  return midiToSong(parseMidi(bytes), opts);
}
