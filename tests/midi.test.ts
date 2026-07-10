import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMidi, midiToSong, midiToZzfxm } from '../engine/src/midi.ts';
import { renderZzfxm } from '../engine/src/zzfxm.ts';

// ── Minimal Standard MIDI File builders ─────────────────────────────────────
const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** Wrap track-event bytes into a complete Type-0 SMF at the given PPQ division. */
function smf(events: number[], division = 96): Uint8Array {
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0x00, 0x00, 0x00, 0x01, (division >> 8) & 255, division & 255, // MThd, fmt0, 1 trk
    0x4d, 0x54, 0x72, 0x6b, ...u32(events.length), ...events, // MTrk
  ]);
}

const EOT = [0x00, 0xff, 0x2f, 0x00]; // delta 0, end-of-track meta

// Two sequential quarter notes (C4=60, then E4=64) at 96 PPQ.
const TWO_NOTES = smf([
  0x00, 0x90, 0x3c, 0x64, 0x60, 0x80, 0x3c, 0x00,
  0x00, 0x90, 0x40, 0x64, 0x60, 0x80, 0x40, 0x00,
  ...EOT,
]);

// A chord: C4 + E4 + G4 struck together, held a quarter note — forces polyphony.
const CHORD = smf([
  0x00, 0x90, 0x3c, 0x64, 0x00, 0x90, 0x40, 0x64, 0x00, 0x90, 0x43, 0x64, // three note-ons at tick 0
  0x60, 0x80, 0x3c, 0x00, 0x00, 0x80, 0x40, 0x00, 0x00, 0x80, 0x43, 0x00, // three note-offs at tick 96
  ...EOT,
]);

test('parseMidi extracts note events and tempo', () => {
  const parsed = parseMidi(TWO_NOTES);
  assert.equal(parsed.notes.length, 2, 'two notes');
  assert.deepEqual(parsed.notes.map((n) => n.midi), [60, 64]);
  assert.equal(parsed.division, 96);
  assert.ok(parsed.bpm > 0 && Number.isFinite(parsed.bpm), 'a finite positive tempo');
});

test('midiToZzfxm produces a renderable, audible, non-clipping song', () => {
  const song = midiToZzfxm(TWO_NOTES, { name: 'Test' });
  assert.equal(song.title, 'Test');
  assert.equal(song.instruments.length, 1, 'one voice instrument');
  assert.equal(song.sequence.length, 1);
  const pcm = renderZzfxm(song);
  assert.ok(pcm.left.length > 0, 'renders samples');
  let peak = 0;
  for (let i = 0; i < pcm.left.length; i++) peak = Math.max(peak, Math.abs(pcm.left[i]!));
  assert.ok(peak > 0.02, 'audible (not silent)');
  assert.ok(peak <= 1, 'no clipping');
});

test('overlapping notes split across voice-channels', () => {
  const song = midiToSong(parseMidi(CHORD));
  // A 3-note chord can't sit on one channel per step → at least 3 voice rows.
  assert.ok(song.patterns[0]!.length >= 3, `expected ≥3 voices, got ${song.patterns[0]!.length}`);
});

test('the lowest note maps to a positive ZzFXM note value', () => {
  // ZzFXM reserves 0/negative for rest/stop, so the mapper shifts pitches up and
  // compensates with the instrument base frequency. Every emitted note must be > 0.
  const song = midiToSong(parseMidi(TWO_NOTES));
  const notes = song.patterns[0]!.flatMap((ch) => ch.slice(2)).filter((n) => n !== 0);
  assert.ok(notes.length > 0 && notes.every((n) => n > 0), 'no zero/negative live notes');
});

// ── Hardening: hostile / malformed input must throw, never hang or OOM ───────
test('rejects a non-MIDI file', () => {
  assert.throws(() => parseMidi(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])), /Standard MIDI File/);
});

test('rejects a header with no notes', () => {
  assert.throws(() => midiToZzfxm(smf([...EOT])), /no notes/);
});

test('a bogus track length is clamped, not trusted (no hang)', () => {
  // Claim a 4 GB track in the header; the parser must clamp to the real buffer and
  // return promptly with just the notes actually present.
  const events = [0x00, 0x90, 0x3c, 0x64, 0x60, 0x80, 0x3c, 0x00, ...EOT];
  const bytes = new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, ...u32(6), 0x00, 0x00, 0x00, 0x01, 0x00, 0x60,
    0x4d, 0x54, 0x72, 0x6b, ...u32(0xffffffff), ...events, // lying length
  ]);
  const parsed = parseMidi(bytes);
  assert.equal(parsed.notes.length, 1, 'still reads the one real note without over-running');
});

test('rejects SMPTE time division (only PPQ is mapped)', () => {
  assert.throws(() => midiToSong(parseMidi(smf([0x00, 0x90, 0x3c, 0x64, 0x60, 0x80, 0x3c, 0x00, ...EOT], 0xe250))), /SMPTE/);
});
