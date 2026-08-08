// SPDX-License-Identifier: MPL-2.0
/**
 * brand-harmony (engine/src/brand-schemes.ts) — parametric hue-rotation contract.
 *
 * Covers the F-HARMONY primitives layered on top of the existing scheme accent
 * generator:
 *   (1) rotateHue — rotates OKLCH hue by exactly the given degrees (mod 360),
 *       holding lightness AND chroma fixed, then emitting through the
 *       gamut-mapped `oklchToHex` (the same path generateSchemeAccents uses) so
 *       the result stays renderable without a flat channel clip or a chroma
 *       pre-clip that would mute saturated colours.
 *   (2) generateAnalogous — a TRUE parametric analogous set: N accents at an
 *       evenly spaced hue step, distinct from the fixed ±30° 'adjacent-3'.
 *   (3) rotateRampHue — the same fixed-L/C rotation across a whole ramp.
 *   (4) Regression pins on the shipped generateSchemeAccents outputs, so the
 *       new code cannot perturb existing scheme behaviour.
 *
 * NOTE (see color-ramp.test.ts header): the first bytes of every console.log
 * line must be ASCII.
 *
 * Run with: node --test tests/brand-harmony.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  rotateHue,
  generateAnalogous,
  rotateRampHue,
  generateSchemeAccents,
} from '../engine/src/brand-schemes.ts';
import { hexToOklch, oklchToHex } from '../engine/src/brand-derive.ts';
import { maxChroma } from '../engine/src/gamut.ts';

const HEX6 = /^#[0-9a-f]{6}$/i;
const normHue = (h: number): number => ((h % 360) + 360) % 360;

// The primary used across the rotation tests — a mid-blue with modest chroma, so
// most rotations stay well inside the sRGB gamut and chroma is preserved rather
// than clipped (the few hues where it clips are checked against maxChroma).
const PRIMARY = '#4f83cc';

// ─── rotateHue: fixed L/C, exact hue rotation ────────────────────────────────

test('rotateHue rotates H by exactly the given degrees (mod 360) at fixed L and C, emitted via oklchToHex', () => {
  const src = hexToOklch(PRIMARY)!;

  for (const deg of [30, 90, 180, 240, -45, -120, 360, 720]) {
    const out = rotateHue(PRIMARY, deg);
    assert.match(out, HEX6, `${deg} produces a real hex: ${out}`);

    // INDEPENDENT oracle (does NOT mirror any chroma pre-clip): rotate the hue
    // holding L and C, then emit through the canonical gamut-mapped path.
    const expectedH = normHue(src.h + deg);
    const reference = oklchToHex({ l: src.l, c: src.c, h: expectedH });
    assert.equal(out, reference, `deg ${deg}: matches canonical rotate-then-oklchToHex`);

    // Decode sanity: CSS Color 4 gamut mapping holds L and H roughly (MINDE can
    // trade a little of each for chroma, and 8-bit hex quantises hue at low C),
    // reducing only C where the hue can't carry it — never inflating chroma.
    // The exact contract is the `out === reference` pin above; these are loose.
    const o = hexToOklch(out)!;
    assert.ok(Math.abs(o.l - src.l) < 0.03, `deg ${deg}: L ~held (${o.l} vs ${src.l})`);
    let dh = Math.abs(o.h - expectedH);
    if (dh > 180) dh = 360 - dh;
    assert.ok(dh < 8.0, `deg ${deg}: H ~held is ${o.h}, expected ${expectedH}`);
    assert.ok(o.c <= src.c + 0.02, `deg ${deg}: chroma never inflated (${o.c} vs ${src.c})`);

    console.log(`  rot ${deg} -> ${out} L=${o.l.toFixed(3)} C=${o.c.toFixed(3)} H=${o.h.toFixed(1)}`);
  }
});

test('rotateHue by 0 or 360 is a TRUE identity, even for saturated gamut-corner colours', () => {
  // The old pre-clip muted saturated colours even at 0 rotation; holding chroma
  // and letting oklchToHex map means an in-gamut colour round-trips unchanged.
  for (const hex of ['#0000ff', '#ffff00', '#00cc00', PRIMARY]) {
    assert.equal(rotateHue(hex, 0), rotateHue(hex, 360), `${hex}: 0 and 360 agree`);

    const src = hexToOklch(hex)!;
    const out0 = hexToOklch(rotateHue(hex, 0))!;
    assert.ok(Math.abs(out0.l - src.l) < 0.004, `${hex}: L held at 0 rotation`);
    // The key regression guard: chroma is NOT desaturated at a 0 rotation.
    assert.ok(Math.abs(out0.c - src.c) < 0.004, `${hex}: C not muted at 0 rotation (${out0.c} vs ${src.c})`);
    let dh = Math.abs(out0.h - src.h);
    if (dh > 180) dh = 360 - dh;
    assert.ok(dh < 1.0, `${hex}: H held at 0 rotation`);
  }
});

test('rotateHue keeps the result renderable, reducing chroma the hue cannot carry', () => {
  // A vivid, high-chroma green rotated toward blue exceeds what that hue carries
  // at this lightness, so oklchToHex must gamut-MAP it down to a real sRGB
  // colour (holding L/H, reducing C) rather than clip channels.
  const src = hexToOklch('#00cc00')!;
  const out = rotateHue('#00cc00', 150);
  const o = hexToOklch(out)!;
  assert.match(out, HEX6);
  // Never inflated past the source chroma…
  assert.ok(o.c <= src.c + 0.006, `chroma not inflated (${o.c} vs ${src.c})`);
  // …and always within the gamut ceiling for the colour's OWN L and H (the
  // defining property of an in-gamut result — nominal-hue maxChroma would be
  // wrong here because MINDE mapping shifts L/H slightly).
  assert.ok(o.c <= maxChroma(o.l, o.h) + 0.01, `within its own gamut ceiling (${o.c} vs ${maxChroma(o.l, o.h)})`);
});

test('rotateHue falls back to a neutral primary on an unparseable hex', () => {
  const out = rotateHue('not-a-colour', 90);
  assert.match(out, HEX6, `fallback still yields a real hex: ${out}`);
});

// ─── generateAnalogous: parametric, evenly spaced ────────────────────────────

test('generateAnalogous yields N accents at evenly spaced hues of the requested step', () => {
  const src = hexToOklch(PRIMARY)!;
  const count = 4;
  const angle = 12;
  const accents = generateAnalogous(PRIMARY, { count, angle });

  assert.equal(accents.length, count, 'produces exactly `count` accents');

  for (let i = 0; i < accents.length; i++) {
    const a = accents[i]!;
    assert.match(a.hex, HEX6, `accent ${i} is a real hex`);
    // hue field mirrors the OKLCH hue.
    assert.ok(Math.abs(a.hue - a.oklch.h) < 1e-9, `accent ${i} hue mirrors oklch.h`);
    // Each accent sits at primary + (i+1)*angle.
    const expected = normHue(src.h + angle * (i + 1));
    let dh = Math.abs(a.oklch.h - expected);
    if (dh > 180) dh = 360 - dh;
    assert.ok(dh < 1e-6, `accent ${i} hue ${a.oklch.h} == ${expected}`);
  }

  // Consecutive accent hues differ by exactly `angle` (the "evenly spaced" claim).
  for (let i = 1; i < accents.length; i++) {
    let step = accents[i]!.oklch.h - accents[i - 1]!.oklch.h;
    step = normHue(step);
    if (step > 180) step -= 360;
    assert.ok(Math.abs(step - angle) < 1e-6, `step ${i}: ${step} == ${angle}`);
  }

  console.log(`  analogous(${count}, ${angle}): ${accents.map(a => a.hex).join(' ')}`);
});

test('generateAnalogous is distinct from the fixed adjacent-3 scheme', () => {
  // adjacent-3 is hardwired to ±30°; the parametric generator with a different
  // step must not reproduce it.
  const adjacent = generateSchemeAccents(PRIMARY, 'adjacent-3').map(a => a.hex);
  const analog = generateAnalogous(PRIMARY, { count: 2, angle: 15 }).map(a => a.hex);
  assert.notDeepEqual(analog, adjacent, 'a different step yields different accents');
});

test('generateAnalogous handles zero/negative count as an empty set', () => {
  assert.deepEqual(generateAnalogous(PRIMARY, { count: 0, angle: 20 }), []);
  assert.deepEqual(generateAnalogous(PRIMARY, { count: -3, angle: 20 }), []);
});

// ─── rotateRampHue: whole-ramp rotation ──────────────────────────────────────

test('rotateRampHue rotates every stop by the same fixed-L/C rotation', () => {
  const ramp = ['#1d3557', '#457b9d', '#a8dadc', '#f1faee', '#e63946'];
  const deg = 45;
  const rotated = rotateRampHue(ramp, deg);

  assert.equal(rotated.length, ramp.length, 'one output stop per input stop');

  for (let i = 0; i < ramp.length; i++) {
    assert.match(rotated[i]!, HEX6, `stop ${i} is a real hex`);
    // Each rotated stop is exactly what rotateHue would produce for that stop.
    assert.equal(rotated[i], rotateHue(ramp[i]!, deg), `stop ${i} matches per-stop rotateHue`);

    const src = hexToOklch(ramp[i]!)!;
    const o = hexToOklch(rotated[i]!)!;
    assert.ok(Math.abs(o.l - src.l) < 0.006, `stop ${i} holds lightness`);
  }

  console.log(`  ramp rot ${deg}: ${rotated.join(' ')}`);
});

test('rotateRampHue by 0 returns the encoded ramp unchanged in hue', () => {
  const ramp = ['#1d3557', '#e63946'];
  const rotated = rotateRampHue(ramp, 0);
  for (let i = 0; i < ramp.length; i++) {
    const src = hexToOklch(ramp[i]!)!;
    const o = hexToOklch(rotated[i]!)!;
    let dh = Math.abs(o.h - src.h);
    if (dh > 180) dh = 360 - dh;
    assert.ok(dh < 1.0, `stop ${i} hue unchanged at 0 rotation`);
  }
});

// ─── Regression pins: shipped scheme outputs unchanged ───────────────────────

// Golden hexes captured from generateSchemeAccents('#4f83cc', ...) before the
// F-HARMONY additions. The new primitives must not perturb these.
test('generateSchemeAccents outputs for shipped schemes are unchanged (golden pin)', () => {
  assert.deepEqual(
    generateSchemeAccents(PRIMARY, 'complement').map(a => a.hex),
    ['#ac7708'],
  );
  assert.deepEqual(
    generateSchemeAccents(PRIMARY, 'adjacent-3').map(a => a.hex),
    ['#0090bc', '#7e75c9'],
  );
  assert.deepEqual(
    generateSchemeAccents(PRIMARY, 'triad-3').map(a => a.hex),
    ['#c16067', '#5c9345'],
  );
});
