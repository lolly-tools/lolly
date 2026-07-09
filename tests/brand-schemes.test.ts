/**
 * Unit tests for engine/src/brand-schemes.ts — the pure scheme-accent
 * generator behind the brand generator's harmony picker. Covers the accent
 * COUNT per scheme (= total count − 1), that every emitted hex is a real
 * 6-digit sRGB colour, that hues are the primary's hue rotated by the scheme's
 * offsets and normalised into [0,360), and that generation is deterministic.
 *
 * Run with: node --test tests/brand-schemes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCHEME_KINDS, generateSchemeAccents,
} from '../engine/src/brand-schemes.ts';
import type { SchemeKind } from '../engine/src/brand-schemes.ts';
import { hexToOklch } from '../engine/src/brand-derive.ts';

const HEX6 = /^#[0-9a-f]{6}$/i;
const PRIMARY = '#4f83cc';

// Expected accent hue offsets per scheme (must mirror the module's table).
const EXPECTED_OFFSETS: Record<SchemeKind, number[]> = {
  complement: [180],
  'adjacent-3': [-30, 30],
  'triad-3': [120, 240],
  'tetrad-4': [90, 180, 270],
  'free-2': [180],
  'free-3': [120, 240],
  'free-4': [90, 180, 270],
};

const normHue = (h: number): number => ((h % 360) + 360) % 360;

// ── scheme table ───────────────────────────────────────────────────────────────

test('SCHEME_KINDS carries the documented total counts', () => {
  const byId = Object.fromEntries(SCHEME_KINDS.map(s => [s.id, s.count]));
  assert.equal(byId['complement'], 2);
  assert.equal(byId['adjacent-3'], 3);
  assert.equal(byId['triad-3'], 3);
  assert.equal(byId['tetrad-4'], 4);
  assert.equal(byId['free-2'], 2);
  assert.equal(byId['free-3'], 3);
  assert.equal(byId['free-4'], 4);
  assert.equal(SCHEME_KINDS.length, Object.keys(EXPECTED_OFFSETS).length);
});

// ── accent counts ──────────────────────────────────────────────────────────────

test('accent count is total count − 1 for every scheme (primary excluded)', () => {
  for (const { id, count } of SCHEME_KINDS) {
    const accents = generateSchemeAccents(PRIMARY, id);
    assert.equal(accents.length, count - 1, `${id}: expected ${count - 1} accents`);
  }
  // Named spot-checks from the task spec.
  assert.equal(generateSchemeAccents(PRIMARY, 'tetrad-4').length, 3);
  assert.equal(generateSchemeAccents(PRIMARY, 'complement').length, 1);
});

// ── hex validity ───────────────────────────────────────────────────────────────

test('every accent hex is a 6-digit sRGB colour', () => {
  for (const { id } of SCHEME_KINDS) {
    for (const a of generateSchemeAccents(PRIMARY, id)) {
      assert.match(a.hex, HEX6, `${id}: bad hex ${a.hex}`);
    }
  }
});

test('hex is gamut-safe even for a saturated / extreme primary', () => {
  for (const primary of ['#ff0000', '#0000ff', '#00ff00', '#000000', '#ffffff']) {
    for (const { id } of SCHEME_KINDS) {
      for (const a of generateSchemeAccents(primary, id)) {
        assert.match(a.hex, HEX6, `${primary}/${id}: bad hex ${a.hex}`);
      }
    }
  }
});

// ── hue rotation + normalisation ────────────────────────────────────────────────

test('accent hues are the primary hue rotated by the scheme offsets, normalised to [0,360)', () => {
  const p = hexToOklch(PRIMARY);
  assert.ok(p, 'primary parsed');
  for (const { id } of SCHEME_KINDS) {
    const accents = generateSchemeAccents(PRIMARY, id);
    const offsets = EXPECTED_OFFSETS[id];
    assert.equal(accents.length, offsets.length, `${id}: offset count`);
    accents.forEach((a, i) => {
      const expected = normHue(p!.h + offsets[i]!);
      assert.ok(a.hue >= 0 && a.hue < 360, `${id}[${i}]: hue ${a.hue} out of [0,360)`);
      assert.equal(a.hue, a.oklch.h, `${id}[${i}]: hue field mismatches oklch.h`);
      assert.ok(
        Math.abs(a.hue - expected) < 1e-9,
        `${id}[${i}]: hue ${a.hue} ≠ expected ${expected}`,
      );
    });
  }
});

test('accents keep the primary L and C, changing only the hue', () => {
  const p = hexToOklch(PRIMARY)!;
  for (const { id } of SCHEME_KINDS) {
    for (const a of generateSchemeAccents(PRIMARY, id)) {
      assert.equal(a.oklch.l, p.l, `${id}: L changed`);
      assert.equal(a.oklch.c, p.c, `${id}: C changed`);
    }
  }
});

test('adjacent-3 negative rotation wraps into [0,360)', () => {
  // A red primary (hue ~29°) with a −30° accent must wrap, not go negative.
  const [minus30] = generateSchemeAccents('#ff0000', 'adjacent-3');
  assert.ok(minus30);
  assert.ok(minus30!.hue >= 0 && minus30!.hue < 360, `wrapped hue ${minus30!.hue}`);
});

// ── determinism + fallback ──────────────────────────────────────────────────────

test('generation is deterministic — same input, identical output', () => {
  for (const { id } of SCHEME_KINDS) {
    const a = generateSchemeAccents(PRIMARY, id);
    const b = generateSchemeAccents(PRIMARY, id);
    assert.deepEqual(a, b, `${id}: not deterministic`);
  }
});

test('an unparseable primary falls back to the neutral primary (no throw, still valid)', () => {
  const bad = generateSchemeAccents('not-a-colour', 'triad-3');
  assert.equal(bad.length, 2);
  for (const a of bad) assert.match(a.hex, HEX6);
  // Fallback is the documented neutral mid-blue {l:.62,c:.11,h:250}; triad
  // accents sit at 250+120 = 370→10 and 250+240 = 490→130.
  assert.ok(Math.abs(bad[0]!.hue - normHue(250 + 120)) < 1e-9);
  assert.ok(Math.abs(bad[1]!.hue - normHue(250 + 240)) < 1e-9);
});
