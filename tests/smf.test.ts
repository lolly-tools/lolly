// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/smf.ts, the lossless Standard MIDI File reader and writer.
 *
 * The malformed-input, running-status, SMPTE-division and unknown-chunk cases are
 * ported as data from the test suite of soundcraft's `crates/midi` (tests/it/smf.rs,
 * pin 7169dc4, MIT OR Apache-2.0). Only the byte inputs and the accept or refuse
 * outcome were taken; no code was translated. Original authors keep their copyright
 * in those case ideas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSmf, writeSmf, smfTimeDivision, smfTempo, smfTimeSignature, smfKeySignature, smfText, SmfError, SMF_LIMITS } from '../engine/src/smf.ts';

const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n: number): number[] => [(n >> 8) & 255, n & 255];
const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));
const vlq = (v: number): number[] => { const o = [v & 0x7f]; v >>= 7; while (v > 0) { o.unshift((v & 0x7f) | 0x80); v >>= 7; } return o; };
const header = (format: number, ntrks: number, division: number): number[] => [...ascii('MThd'), ...u32(6), ...u16(format), ...u16(ntrks), ...u16(division)];
const track = (body: number[]): number[] => [...ascii('MTrk'), ...u32(body.length), ...body];
const file = (format: number, division: number, bodies: number[][]): Uint8Array =>
  Uint8Array.from([...header(format, bodies.length, division), ...bodies.flatMap(track)]);
const EOT = [0, 0xff, 0x2f, 0];

const roundTrips = (b: Uint8Array): void => assert.deepEqual(writeSmf(readSmf(b)), b);
const refused = (b: Uint8Array, code?: string): void => {
  assert.throws(() => readSmf(b), (e: unknown) => e instanceof SmfError && (code === undefined || e.code === code));
};

test('committed fixtures read and write back to the same bytes', () => {
  const dir = fileURLToPath(new URL('./fixtures/smf/', import.meta.url));
  const names = readdirSync(dir).filter((f) => f.endsWith('.mid'));
  assert.ok(names.length >= 6, 'fixtures are present');
  for (const n of names) {
    const b = new Uint8Array(readFileSync(dir + n));
    assert.deepEqual(writeSmf(readSmf(b)), b, n);
  }
});

test('format 0, 1 and 2 round trip', () => {
  for (const f of [0, 1, 2]) roundTrips(file(f, 480, [[0, 0x90, 60, 100, 0x60, 0x80, 60, 0, ...EOT]]));
});

test('running status is kept as the file used it', () => {
  const body = [0, 0x91, 60, 100, 0, 64, 90, ...vlq(960), 60, 0, 0, 64, 0, 0, 0xb1, 7, 100, 0x10, 10, 64, ...EOT];
  const f = readSmf(file(0, 960, [body]));
  const ev = (f.chunks[0] as { events: { running?: true }[] }).events;
  assert.deepEqual(ev.map((e) => e.running === true), [false, true, true, true, false, true, false]);
  roundTrips(file(0, 960, [body]));
});

test('a note-on with velocity 0 stays a note-on', () => {
  const f = readSmf(file(0, 96, [[0, 0x90, 60, 100, 10, 0x90, 60, 0, ...EOT]]));
  const ev = (f.chunks[0] as { events: { type?: string; data2?: number }[] }).events;
  assert.equal(ev[1]!.type, 'noteOn');
  assert.equal(ev[1]!.data2, 0);
});

test('non-minimal variable-length quantities survive', () => {
  roundTrips(file(0, 96, [[0x80, 0x80, 0x00, 0x90, 60, 100, 0x81, 0x00, 0xff, 0x01, 0x80, 0x01, 0x78, ...EOT]]));
});

test('every variable-length boundary value round trips', () => {
  for (const v of [0, 1, 0x7f, 0x80, 0x3fff, 0x4000, 0x1fffff, 0x200000, 0x0fffffff]) {
    roundTrips(file(0, 96, [[...vlq(v), 0x90, 60, 100, ...EOT]]));
  }
});

test('sysex F0, the F7 escape and a continuation round trip', () => {
  roundTrips(file(0, 960, [[0, 0xf0, 3, 0x7e, 0x7f, 0xf7, 0, 0xf7, 2, 0xf8, 0xfa, 5, 0xf0, 2, 1, 2, 5, 0xf7, 1, 0xf7, ...EOT]]));
});

test('unknown chunks, extra header bytes, tail and trailing bytes are kept', () => {
  const t1 = track([0, 0x90, 60, 100, ...EOT, 1, 2, 3]);
  const b = Uint8Array.from([
    ...ascii('MThd'), ...u32(8), ...u16(1), ...u16(2), ...u16(960), 9, 9,
    ...track([0, 0xff, 0x51, 3, 7, 0xa1, 0x20, ...EOT]),
    ...ascii('XFIH'), ...u32(3), 97, 98, 99,
    ...t1, 1, 2, 3,
  ]);
  const f = readSmf(b);
  assert.equal(f.chunks.length, 3);
  assert.equal(f.chunks[1]!.kind, 'unknown');
  assert.deepEqual([...f.header.extra!], [9, 9]);
  assert.deepEqual([...(f.chunks[2] as { tail: Uint8Array }).tail], [1, 2, 3]);
  assert.deepEqual([...f.trailing!], [1, 2, 3]);
  assert.deepEqual(writeSmf(f), b);
});

test('a header that declares the wrong track count keeps it', () => {
  const b = Uint8Array.from([...header(1, 5, 96), ...track([...EOT])]);
  assert.equal(readSmf(b).header.trackCount, 5);
  roundTrips(b);
});

test('a track with no end-of-track event round trips', () => {
  roundTrips(file(0, 96, [[0, 0x90, 60, 100, 0x10, 0x80, 60, 0]]));
});

test('typed views of meta events', () => {
  const f = readSmf(file(1, 96, [[
    0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20,
    0, 0xff, 0x58, 4, 6, 3, 24, 8,
    0, 0xff, 0x59, 2, 0xfd, 1,
    0, 0xff, 0x03, 3, 79, 114, 103,
    0, 0xff, 0x06, 5, ...ascii('Intro'),
    ...EOT,
  ]]));
  const ev = (f.chunks[0] as { events: Parameters<typeof smfTempo>[0][] }).events;
  assert.equal(smfTempo(ev[0]!), 500000);
  assert.deepEqual(smfTimeSignature(ev[1]!), { numerator: 6, denominator: 8, clocksPerClick: 24, thirtySecondsPerQuarter: 8 });
  assert.deepEqual(smfKeySignature(ev[2]!), { sharps: -3, minor: true });
  assert.equal(smfText(ev[3]!), 'Org');
  assert.equal(smfText(ev[4]!), 'Intro');
});

test('writer running-status option compresses and reads back to the same events', () => {
  const b = file(0, 96, [[0, 0x90, 60, 100, 0, 0x90, 62, 100, 0, 0x90, 64, 100, ...EOT]]);
  const compact = writeSmf(readSmf(b), { runningStatus: true });
  assert.ok(compact.length < b.length);
  const again = readSmf(compact);
  assert.equal((again.chunks[0] as { events: unknown[] }).events.length, 4);
});

test('SMPTE divisions: four frame rates read, other rates and zero ticks refused', () => {
  for (const fps of [24, 25, 29, 30]) {
    const div = ((256 - fps) << 8) | 40;
    assert.deepEqual(smfTimeDivision(div), { kind: 'smpte', framesPerSecond: fps, ticksPerFrame: 40 });
    roundTrips(file(0, div, [[0, 0x90, 60, 100, ...EOT]]));
    refused(file(0, ((256 - fps) << 8) | 0, [[...EOT]]), 'bad-division');
  }
  for (let high = 0x80; high <= 0xff; high++) {
    if ([256 - 24, 256 - 25, 256 - 29, 256 - 30].includes(high)) continue;
    refused(file(0, (high << 8) | 40, [[...EOT]]), 'bad-division');
  }
  refused(file(0, 0, [[...EOT]]), 'bad-division');
});

test('malformed inputs are refused with a code', () => {
  refused(new Uint8Array(0), 'not-smf');
  refused(Uint8Array.from(ascii('RIFF\0\0\0\x06')), 'not-smf');
  refused(Uint8Array.from([...ascii('MThd'), 0, 0, 0, 6, 0, 1]), 'bad-chunk-length');
  refused(Uint8Array.from([...ascii('MThd'), 0, 0, 0, 2, 0, 1]), 'bad-header');
  refused(Uint8Array.from(header(3, 0, 96)), 'unsupported-format');
  refused(Uint8Array.from(header(0, 0, 0)), 'bad-division');
  refused(Uint8Array.from([...header(0, 1, 96), ...ascii('MTrk'), 0xff, 0xff, 0xff, 0xf0, 0, 0x90]), 'bad-chunk-length');
  refused(file(0, 96, [[0xff, 0xff, 0xff, 0xff, 0x7f, 0x90, 60, 100]]), 'vlq-too-long');
  refused(file(0, 96, [[0, 0xff, 0x03, 0x7f, 97]]), 'truncated');
  refused(file(0, 96, [[0, 0x90, 60]]), 'truncated');
  refused(file(0, 96, [[0, 60, 100]]), 'no-running-status');
  refused(file(0, 96, [[0, 0xf2, 0, 0]]), 'bad-status');
  refused(file(0, 96, [[0, 0x90, 0x90, 100]]), 'bad-data-byte');
  assert.equal(readSmf(Uint8Array.from(header(1, 0, 96))).chunks.length, 0);
});

test('a meta event cancels running status', () => {
  refused(file(0, 960, [[0, 0x90, 60, 100, 0, 0xff, 0x01, 1, 120, 0, 60, 0]]), 'no-running-status');
});

test('limits: events, tracks, size and payload length', () => {
  const body = [0, 0xc0, 0, ...Array.from({ length: 50 }, () => [0, 1]).flat()];
  assert.throws(() => readSmf(file(0, 96, [body]), { maxEvents: 10 }), (e: unknown) => e instanceof SmfError && e.code === 'too-many-events');
  assert.throws(() => readSmf(file(1, 96, [[...EOT], [...EOT], [...EOT]]), { maxTracks: 2 }), (e: unknown) => e instanceof SmfError && e.code === 'too-many-tracks');
  assert.throws(() => readSmf(file(0, 96, [[...EOT]]), { maxBytes: 10 }), (e: unknown) => e instanceof SmfError && e.code === 'too-large');
  assert.throws(() => readSmf(file(0, 96, [[0, 0xff, 1, 10, ...Array(10).fill(65), ...EOT]]), { maxEventBytes: 5 }), (e: unknown) => e instanceof SmfError && e.code === 'event-too-long');
  assert.ok(SMF_LIMITS.maxEvents > 0);
});

test('writer refuses values that do not fit', () => {
  const f = readSmf(file(0, 96, [[0, 0x90, 60, 100, ...EOT]]));
  const ev = (f.chunks[0] as { events: { data1?: number; delta: number }[] }).events;
  ev[0]!.data1 = 128;
  assert.throws(() => writeSmf(f), SmfError);
  ev[0]!.data1 = 60; ev[0]!.delta = 0x10000000;
  assert.throws(() => writeSmf(f), SmfError);
});

test('random bytes and random track bodies never throw anything but SmfError', () => {
  let seed = 12345;
  const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed >>> 24; };
  for (let i = 0; i < 3000; i++) {
    const body = Array.from({ length: rnd() % 64 }, rnd);
    const b = i % 2 ? file(rnd() % 4, (rnd() << 8) | rnd(), [body]) : Uint8Array.from(Array.from({ length: rnd() % 40 }, rnd));
    try { roundTrips(b); } catch (e) { assert.ok(e instanceof SmfError, String(e)); }
  }
});
