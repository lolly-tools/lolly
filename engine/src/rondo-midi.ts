// SPDX-License-Identifier: MPL-2.0
/**
 * A rondocode song's scheduled notes as a Standard MIDI File.
 *
 * The shells render a song in the `vm` execution class and get back its tempo (cycles
 * per second) and the notes it schedules, in seconds. This turns that into the file
 * `host.audio.decode(src, { midi })` returns, through engine/src/smf-export.ts.
 *
 * Mapping, stated because a MIDI file cannot hold everything a song does:
 *   - one cycle is one bar of 4/4 (the staged data does not carry the song's meter), so the
 *     tempo is cps x 240 quarter notes a minute;
 *   - one track per synth, in order of first note, named for the synth;
 *   - velocity is the event's own, 0 to 1 (1 when it carried none);
 *   - a synth whose name reads as a General MIDI instrument gets that program; drum-like
 *     names go on channel 10;
 *   - not in the file: synth graphs, filters, effects, buses, sends, sidechain, master
 *     processing, samples, singing, and per-note modulation. A tuning off twelve-tone is
 *     rounded to the nearest semitone with a pitch bend.
 */
import { notesToMidiBytes, looksPercussive, type MidiNote, type MidiVoiceSpec } from './smf-export.ts';

export interface RondoMusicInput {
  /** Cycles per second. */
  cps: number;
  notes: readonly { synth: string; time: number; duration: number; note: number; velocity: number }[];
}

export function rondoMusicToMidi(music: RondoMusicInput, opts: { title?: string; text?: string } = {}): Uint8Array {
  const bpm = music.cps * 240;
  const beatsPerSecond = bpm / 60;
  const notes: MidiNote[] = music.notes.map((n) => ({
    voice: n.synth,
    startBeats: n.time * beatsPerSecond,
    durBeats: n.duration * beatsPerSecond,
    pitch: n.note,
    velocity: n.velocity,
  }));
  const voices: MidiVoiceSpec[] = [];
  for (const n of music.notes) if (!voices.some((v) => v.name === n.synth)) voices.push({ name: n.synth, percussion: looksPercussive(n.synth) });
  return notesToMidiBytes(notes, {
    bpm: Math.max(1, Math.min(60_000_000, bpm)),
    voices,
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.text !== undefined ? { text: opts.text } : {}),
  });
}
