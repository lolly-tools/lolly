// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the `zzfxm:<seed>[:<style>]` procedural asset id scheme: parsing,
 * formatting, and the strictness that keeps the round trip byte-stable.
 * These ids ship inside saved sessions and shared links, so
 * parse(format(x)) must deep-equal x, and format(parse(s)) must equal s for
 * every well-formed s - a shell that regenerates a ref must never rewrite
 * somebody's shared link to point at a different song.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZZFXM_SCHEME,
  ZZFXM_ARCHETYPES,
  isZzfxmRef,
  parseZzfxmRef,
  formatZzfxmRef,
  type ZzfxmRef,
} from '../engine/src/zzfxm-ref.ts';

test('isZzfxmRef only matches strings starting with the scheme prefix', () => {
  assert.equal(isZzfxmRef('zzfxm:7'), true);
  assert.equal(isZzfxmRef('https://example.com/song.mp3'), false);
  assert.equal(isZzfxmRef(42), false);
  assert.equal(isZzfxmRef(null), false);
});

test('parses a bare seed with no style', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:7'), { seed: 7 });
});

test('parses a seed with a recognised style archetype', () => {
  const ref = parseZzfxmRef('zzfxm:7:ambient');
  assert.deepEqual(ref, { seed: 7, style: 'ambient' });
  assert.ok(ZZFXM_ARCHETYPES.includes(ref!.style!));
});

test('an unrecognised style is preserved as rawStyle, not dropped or rejected', () => {
  assert.deepEqual(parseZzfxmRef('zzfxm:7:not-a-style'), { seed: 7, rawStyle: 'not-a-style' });
});

test('non-zzfxm strings parse to null without throwing', () => {
  assert.equal(parseZzfxmRef('https://example.com'), null);
  assert.equal(parseZzfxmRef(''), null);
  assert.equal(parseZzfxmRef(undefined), null);
});

test('refuses leading zeros and seeds past uint32 rather than silently folding them', () => {
  // An earlier [0-9]{1,10} accepted these and >>> 0 folded them into 7 and 0,
  // which breaks format(parse(x)) === x for a shared link.
  assert.equal(parseZzfxmRef('zzfxm:0000000007'), null);
  assert.equal(parseZzfxmRef('zzfxm:4294967296'), null);
  assert.deepEqual(parseZzfxmRef('zzfxm:4294967295'), { seed: 4294967295 });
  assert.deepEqual(parseZzfxmRef('zzfxm:0'), { seed: 0 });
});

test('rejects malformed refs: extra segments or non-digit seeds', () => {
  assert.equal(parseZzfxmRef('zzfxm:7:ambient:extra'), null);
  assert.equal(parseZzfxmRef('zzfxm:abc'), null);
  assert.equal(parseZzfxmRef('zzfxm:-1'), null);
});

test('formatZzfxmRef renders the canonical string, with style only when present', () => {
  assert.equal(formatZzfxmRef({ seed: 7 }), 'zzfxm:7');
  assert.equal(formatZzfxmRef({ seed: 7, style: 'lofi' }), 'zzfxm:7:lofi');
});

test('round trip: parse(format(x)) deep-equals x for every well-formed ref shape', () => {
  const cases: ZzfxmRef[] = [{ seed: 0 }, { seed: 4294967295 }, { seed: 7, style: 'chiptune' }];
  for (const ref of cases) {
    assert.deepEqual(parseZzfxmRef(formatZzfxmRef(ref)), ref);
  }
});

test('formatZzfxmRef normalizes an out-of-range seed via >>> 0 (input contract is uint32)', () => {
  // formatZzfxmRef trusts its input is already a valid seed; this pins the
  // documented masking behaviour rather than asserting it silently throws.
  assert.equal(formatZzfxmRef({ seed: -1 }), `${ZZFXM_SCHEME}4294967295`);
});
