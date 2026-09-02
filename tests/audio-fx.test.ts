// SPDX-License-Identifier: MPL-2.0
/**
 * The fx kernels + grammar (plans/101 sections 2.2/3.4). Golden behaviours, not
 * ears: filters move energy the right way by measurable amounts, the grammar
 * round-trips and skips hostile input without throwing, reverb/echo/gate/crush
 * do exactly their one thing, and every preset expands to a clean parse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { parseFxChain, serializeFxChain, processFxPcm, FX_PRESETS, FX_CHAIN_MAX_CHARS } from '../engine/src/audio-fx.ts';

const RATE = 48_000;

function sine(seconds: number, freq: number, amp = 0.5): Float32Array {
  const n = Math.round(seconds * RATE);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE);
  return out;
}

const rms = (x: Float32Array, from = 0, to = x.length): number => {
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] as number) * (x[i] as number);
  return Math.sqrt(s / Math.max(1, to - from));
};

const applied = (chain: string, src: Float32Array): Float32Array => {
  const copy = Float32Array.from(src);
  processFxPcm([copy], RATE, parseFxChain(chain).entries);
  return copy;
};

test('grammar: round-trips, skips unknown and malformed tokens, caps overlong chains', () => {
  const p = parseFxChain('hp(80).eq(230-280-270).rv(20-35)');
  assert.equal(p.skipped.length, 0);
  assert.equal(serializeFxChain(p.entries), 'hp(80).eq(230-280-270).rv(20-35)');
  const hostile = parseFxChain('hp(80).wormhole(9).eq(999999-0-0).rev().<script>');
  assert.deepEqual(hostile.entries.map((e) => e.name), ['hp', 'rev'], 'good entries survive around bad ones');
  assert.equal(hostile.skipped.length, 3);
  const over = parseFxChain('hp(80).'.repeat(60));
  assert.equal(over.entries.length, 0, `over ${FX_CHAIN_MAX_CHARS} chars is junk, not intent`);
});

test('hp/lp move energy the right way by real amounts', () => {
  const low = sine(1, 60);
  const high = sine(1, 8000);
  // A 60 Hz tone through hp(300) drops by tens of dB; an 8 kHz one is untouched.
  assert.ok(rms(applied('hp(300)', low), RATE / 2) < rms(low) * 0.05, 'hp kills the low tone');
  assert.ok(Math.abs(rms(applied('hp(300)', high), RATE / 2) - rms(high)) < rms(high) * 0.1, 'hp passes the high tone');
  assert.ok(rms(applied('lp(1000)', high), RATE / 2) < rms(high) * 0.05, 'lp kills the high tone');
  assert.ok(Math.abs(rms(applied('lp(1000)', low), RATE / 2) - rms(low)) < rms(low) * 0.1, 'lp passes the low tone');
});

test('eq: each band lifts its own register by about its authored dB', () => {
  const low = sine(1, 100);
  // +6 dB low shelf = param 300; measure in the settled tail.
  const boosted = applied('eq(300-240-240)', low);
  const gainDb = 20 * Math.log10(rms(boosted, RATE / 2) / rms(low, RATE / 2));
  assert.ok(Math.abs(gainDb - 6) < 1, `low shelf +6 dB, measured ${gainDb.toFixed(2)}`);
  const high = sine(1, 8000);
  const cut = applied('eq(240-240-180)', high);
  const cutDb = 20 * Math.log10(rms(cut, RATE / 2) / rms(high, RATE / 2));
  assert.ok(Math.abs(cutDb - -6) < 1, `high shelf -6 dB, measured ${cutDb.toFixed(2)}`);
});

test('reverb: an impulse grows a tail, wet 0 is byte-identical, and re-runs match exactly', () => {
  const impulse = new Float32Array(RATE);
  impulse[0] = 1;
  const wet = applied('rv(40-60)', impulse);
  assert.ok(rms(wet, Math.round(RATE * 0.2), Math.round(RATE * 0.5)) > 0.0005, 'a tail rings after the impulse');
  const dry = applied('rv(0-60)', impulse);
  assert.deepEqual(dry, impulse, 'wet 0 leaves the buffer alone');
  const sha = (x: Float32Array): string => createHash('sha256').update(Buffer.from(x.buffer, x.byteOffset, x.byteLength)).digest('hex');
  assert.equal(sha(wet), sha(applied('rv(40-60)', impulse)), 'deterministic');
});

test('echo: the delayed copy lands at the authored offset', () => {
  const impulse = new Float32Array(RATE);
  impulse[0] = 1;
  const out = applied('echo(250-0-100)', impulse);
  const at = Math.round(0.25 * RATE);
  assert.ok(Math.abs(out[at] as number) > 0.9, `the echo lands at 250 ms: ${out[at]}`);
  assert.ok(Math.abs(out[at - 400] as number) < 0.01, 'and not before it');
});

test('gate: silence under the threshold, passage above it', () => {
  const loud = sine(0.5, 440, 0.5);
  const quiet = sine(0.5, 440, 0.002);   // ~-54 dBFS, under gate(40)
  const joined = new Float32Array(loud.length + quiet.length);
  joined.set(loud, 0);
  joined.set(quiet, loud.length);
  const out = applied('gate(40)', joined);
  assert.ok(rms(out, 0, loud.length) > rms(loud) * 0.8, 'the loud half passes');
  assert.ok(rms(out, loud.length + RATE / 4) < 0.0005, 'the quiet half closes');
});

test('crush quantises and rev reverses', () => {
  const s = sine(0.1, 440, 0.5);
  const crushed = applied('crush(3)', s);
  const distinct = new Set<number>();
  for (const v of crushed) distinct.add(v);
  assert.ok(distinct.size <= 9, `3 bits leaves at most 9 levels, got ${distinct.size}`);
  const r = applied('rev()', s);
  assert.equal(r[0], s[s.length - 1]);
  assert.equal(r[r.length - 1], s[0]);
});

test('clean() parses as a shell token and processFxPcm leaves the buffer alone for it', () => {
  const p = parseFxChain('clean().hp(80)');
  assert.deepEqual(p.entries.map((e) => e.name), ['clean', 'hp']);
  assert.equal(p.skipped.length, 0);
  const s = sine(0.2, 60, 0.5);
  const copy = Float32Array.from(s);
  processFxPcm([copy], RATE, parseFxChain('clean()').entries);
  assert.deepEqual(copy, s, 'the engine passes clean() through untouched - the shell owns the model');
});

test('every preset expands to a clean parse (the writers stay inside the registry)', () => {
  for (const [name, chain] of Object.entries(FX_PRESETS)) {
    const p = parseFxChain(chain);
    assert.equal(p.skipped.length, 0, `${name}: ${JSON.stringify(p.skipped)}`);
    assert.ok(p.entries.length > 0, `${name} is empty`);
    assert.equal(serializeFxChain(p.entries), chain, `${name} round-trips`);
  }
});