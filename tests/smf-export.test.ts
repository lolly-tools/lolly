// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSmf, smfTempo, smfTimeSignature, smfText, smfKeySignature, SmfError } from '../engine/src/smf.ts';
import type { SmfEvent, SmfTrackChunk } from '../engine/src/smf.ts';
import { notesToMidiBytes, gmProgramFor, voiceChannel, velocityToMidi, looksPercussive } from '../engine/src/smf-export.ts';

const tracks = (b: Uint8Array): SmfTrackChunk[] => readSmf(b).chunks.filter((c): c is SmfTrackChunk => c.kind === 'track');

test('writes a format-1 file: conductor first, one track per voice, notes round trip', () => {
  const bytes = notesToMidiBytes([
    { voice: 'piano', startBeats: 0, durBeats: 1, pitch: 60, velocity: 0.5 },
    { voice: 'piano', startBeats: 1, durBeats: 0.5, pitch: 64 },
    { voice: 'bass', startBeats: 0, durBeats: 2, pitch: 36, velocity: 1 },
  ], { bpm: 90, timeSignature: { numerator: 3, denominator: 4 }, keySignature: { sharps: -2, minor: false }, title: 'Demo', text: 'made on device' });
  const f = readSmf(bytes);
  assert.equal(f.header.format, 1);
  assert.equal(f.header.division, 480);
  const t = tracks(bytes);
  assert.equal(t.length, 3);
  const c = t[0]!.events;
  assert.equal(smfText(c[0]!), 'Demo');
  assert.equal(smfText(c[1]!), 'made on device');
  assert.equal(smfTempo(c[2]!), Math.round(60_000_000 / 90));
  assert.equal(smfTimeSignature(c[3]!)?.numerator, 3);
  assert.deepEqual(smfKeySignature(c[4]!), { sharps: -2, minor: false });
  const piano = t[1]!.events;
  assert.equal(smfText(piano[0]!), 'piano');
  assert.deepEqual([piano[1]!.kind === 'channel' && piano[1]!.type, piano[1]!.kind === 'channel' && piano[1]!.data1], ['programChange', 0]);
  const ons = piano.filter((e): e is Extract<SmfEvent, { kind: 'channel' }> => e.kind === 'channel' && e.type === 'noteOn');
  assert.deepEqual(ons.map((e) => [e.data1, e.data2]), [[60, 64], [64, 100]]);
  const bass = t[2]!.events.filter((e) => e.kind === 'channel');
  assert.equal(bass[0]!.kind === 'channel' && bass[0]!.channel, 1);
});

test('channels skip the drum channel and drums use it', () => {
  assert.deepEqual([0, 8, 9, 10, 14, 15].map(voiceChannel), [0, 8, 10, 11, 15, 0]);
  const b = notesToMidiBytes([{ voice: 'kick', startBeats: 0, durBeats: 0.25, pitch: 36 }], { voices: [{ name: 'kick', percussion: true }] });
  const ev = tracks(b)[1]!.events.filter((e) => e.kind === 'channel');
  assert.ok(ev.every((e) => e.kind === 'channel' && e.channel === 9 && e.type !== 'programChange'));
});

test('GM programs come from names only when a keyword fits', () => {
  assert.equal(gmProgramFor('Bass line'), 33);
  assert.equal(gmProgramFor('strings'), 48);
  assert.equal(gmProgramFor('acid'), 38);
  assert.equal(gmProgramFor('zork'), null);
  assert.equal(gmProgramFor('kick'), null);
  assert.ok(looksPercussive('hi-hat'));
});

test('velocity never maps to 0 and a missing velocity uses the default', () => {
  assert.equal(velocityToMidi(0), 1);
  assert.equal(velocityToMidi(2), 127);
  const b = notesToMidiBytes([{ voice: 'x', startBeats: 0, durBeats: 1, pitch: 60 }], { defaultVelocity: 80 });
  const on = tracks(b)[1]!.events.find((e) => e.kind === 'channel' && e.type === 'noteOn');
  assert.equal(on?.kind === 'channel' && on.data2, 80);
});

test('a fractional pitch is rounded and bent, then reset', () => {
  const b = notesToMidiBytes([{ voice: 'x', startBeats: 0, durBeats: 1, pitch: 60.5 }]);
  const types = tracks(b)[1]!.events.flatMap((e) => (e.kind === 'channel' ? [e.type] : []));
  assert.deepEqual(types, ['pitchBend', 'noteOn', 'noteOff', 'pitchBend']);
});

test('same-tick order: note-off before the next note-on', () => {
  const b = notesToMidiBytes([
    { voice: 'x', startBeats: 0, durBeats: 1, pitch: 60 },
    { voice: 'x', startBeats: 1, durBeats: 1, pitch: 60 },
  ]);
  const types = tracks(b)[1]!.events.flatMap((e) => (e.kind === 'channel' ? [e.type] : []));
  assert.deepEqual(types, ['noteOn', 'noteOff', 'noteOn', 'noteOff']);
});

test('output is deterministic and refuses bad input', () => {
  const n = [{ voice: 'a', startBeats: 0, durBeats: 1, pitch: 60 }];
  assert.deepEqual(notesToMidiBytes(n), notesToMidiBytes(n));
  assert.throws(() => notesToMidiBytes([{ voice: 'a', startBeats: NaN, durBeats: 1, pitch: 60 }]), SmfError);
  assert.throws(() => notesToMidiBytes(n, { bpm: 0 }), SmfError);
  assert.throws(() => notesToMidiBytes(n, { timeSignature: { numerator: 4, denominator: 3 } }), SmfError);
  assert.throws(() => notesToMidiBytes(n, { maxNotes: 0 }), SmfError);
});

test('an empty note list still writes a valid conductor-only file', () => {
  assert.equal(tracks(notesToMidiBytes([])).length, 1);
});
