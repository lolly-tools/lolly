/**
 * describeColor / contrastVsExtremes (engine/src/color-describe.ts) — the join
 * between CSS Color 4 parsing and display-gamut classification.
 *
 * The behaviour that matters, and the reason the module exists: the OKLCH it
 * reports is UNCLAMPED. Every surface that flattened a colour to hex first threw
 * away exactly the colours worth asking about — a Display-P3 red became #ff0000
 * and then trivially "fitted sRGB". These tests pin that it no longer does.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeColor, contrastVsExtremes, wcagLevel, NOTATION_SPACES, EXTREMES_CONTRAST_FLOOR,
} from '../engine/src/color-describe.ts';
import { hexToOklch } from '../engine/src/brand-derive.ts';

test('a wide-gamut colour keeps its real chroma instead of collapsing to sRGB', () => {
  const p3 = describeColor('color(display-p3 1 0 0)');
  assert.ok(p3);
  assert.equal(p3.gamut, 'p3');
  assert.equal(p3.inSrgb, false);
  // sRGB red is oklch C 0.2577. P3 red is genuinely more chromatic; if this
  // came back at or under sRGB red's chroma, the value was flattened.
  const srgbRed = hexToOklch('#ff0000')!;
  assert.ok(p3.oklch.c > srgbRed.c + 0.02, `P3 red C ${p3.oklch.c} vs sRGB red ${srgbRed.c}`);
  assert.ok(p3.headroom < 0, 'it is past the sRGB ceiling');
  // And it still offers what will actually render.
  assert.match(p3.srgbHex, /^#[0-9a-f]{6}$/);

  const wide = describeColor('color(rec2020 1 0 0)')!;
  assert.equal(wide.gamut, 'rec2020');
  assert.ok(wide.oklch.c > p3.oklch.c, 'Rec.2020 red is wider still');
});

test('every input notation parses, and an sRGB colour round-trips exactly', () => {
  for (const input of [
    '#c0392b', '#c0392bff', 'rgb(192 57 43)',
    'hsl(5.6 63.4% 46.1%)', 'lab(45.37% 53.9 40.63)', 'lch(45.37% 67.5 37)',
    'oklch(54.3% 0.174 29.7)', 'oklab(54.3% 0.151 0.086)',
    'color(srgb 0.753 0.224 0.169)', 'color(xyz-d65 0.2364 0.1431 0.038)',
  ]) {
    const d = describeColor(input);
    assert.ok(d, `${input} parses`);
    assert.equal(d.gamut, 'srgb', `${input} is an sRGB colour`);
    assert.equal(d.inSrgb, true);
    // All of these name the same colour, so they must agree on the hex.
    assert.ok(
      Math.abs(hexToOklch(d.srgbHex)!.l - hexToOklch('#c0392b')!.l) < 0.02,
      `${input} → ${d.srgbHex} should be the same colour`,
    );
  }
});

test('white is white however it is spelled — the gamut cannot depend on the notation', () => {
  // `lab(100 0 0)` converts to OKLCH l = 1.0000000010492212, an ulp past the
  // domain guard's ceiling, where the same colour written '#fff' lands at
  // 0.9999999934. Without a float tolerance on that ceiling, one spelling was in
  // sRGB and the other in no gamut at all.
  for (const spelling of ['white', '#fff', '#ffffff', 'rgb(255 255 255)', 'lab(100 0 0)', 'lch(100 0 0)',
    'oklch(100% 0 0)']) {
    const d = describeColor(spelling);
    assert.ok(d, `${spelling} parses`);
    assert.equal(d.gamut, 'srgb', `${spelling} is white, and white is inside sRGB — not 'none'`);
    assert.equal(d.inSrgb, true, `${spelling} must be reported as displayable`);
  }
});

test('a colour outside every gamut is reported as such, not clamped into one', () => {
  const d = describeColor('oklch(50% 0.45 200)');
  assert.ok(d);
  assert.equal(d.gamut, 'none');
  assert.equal(d.inSrgb, false);
  assert.ok(Math.abs(d.oklch.c - 0.45) < 1e-6, 'the authored chroma survives');
  assert.ok(d.headroom < -0.3, `headroom ${d.headroom} is deeply negative`);
  // The ceilings nest, and all sit below the requested chroma.
  assert.ok(d.ceiling.srgb <= d.ceiling.p3 && d.ceiling.p3 <= d.ceiling.rec2020);
  assert.ok(d.ceiling.rec2020 < d.oklch.c);
});

test('unparseable input returns null rather than a guess', () => {
  for (const bad of ['', '   ', 'not-a-colour', '#12345', 'oklch()', 'rgb(', 'color(nope 1 1 1)']) {
    assert.equal(describeColor(bad), null, JSON.stringify(bad));
  }
  assert.equal(contrastVsExtremes('not-a-colour'), null);
});

test('notations cover every listed space, and `exact` matches the numbers shown', () => {
  for (const input of ['#c0392b', 'color(display-p3 1 0 0)', 'oklch(50% 0.45 200)', '#ffffff']) {
    const d = describeColor(input)!;
    assert.equal(d.notations.length, NOTATION_SPACES.length);
    for (const n of d.notations) {
      assert.ok(n.css.length > 0, `${input} ${n.space} has a value`);
      // The claim and the printed components must agree: a notation marked exact
      // may not show a component outside 0–1 for a bounded space.
      // Scan the ARGUMENTS only: the space name itself contains a digit
      // ("display-p3"), which a naive number sweep happily reads as 3.
      const args = n.css.replace(/^[a-z]+\(\s*/, '').replace(/^[a-z0-9-]+\s+/, '');
      const nums = [...args.matchAll(/-?\d+\.?\d*/g)].map(m => Number(m[0]));
      const bounded = ['srgb', 'display-p3', 'rec2020'].includes(n.space);
      if (bounded && n.exact) {
        for (const v of nums) {
          assert.ok(v >= -0.001 && v <= 1.001, `${input} ${n.space} exact but has ${v}: ${n.css}`);
        }
      }
      if (bounded && !n.exact) {
        assert.ok(nums.some(v => v < -0.001 || v > 1.001),
          `${input} ${n.space} marked inexact but every component fits: ${n.css}`);
      }
    }
    // The colour's own space always describes it exactly.
    const own = d.notations.find(n => n.space === d.parsed.space);
    if (own) assert.equal(own.exact, true, `${input} fits its own space`);
  }
});

test('alpha is carried through without affecting the gamut verdict', () => {
  const d = describeColor('#c0392b80')!;
  assert.ok(Math.abs(d.alpha - 128 / 255) < 1e-6, `alpha ${d.alpha}`);
  assert.equal(d.gamut, 'srgb');
  const opaque = describeColor('#c0392b')!;
  assert.ok(Math.abs(d.oklch.c - opaque.oklch.c) < 1e-9, 'alpha does not move the colour');
});

// ─── contrastVsExtremes ───────────────────────────────────────────────────────

test('contrast picks whichever extreme it contrasts with more', () => {
  const dark = contrastVsExtremes('#111111')!;
  assert.equal(dark.against, '#ffffff', 'a near-black is read against white');
  const light = contrastVsExtremes('#f5f5f5')!;
  assert.equal(light.against, '#000000', 'a near-white is read against black');
  // Both extremes at once: white contrasts maximally with black.
  const white = contrastVsExtremes('#ffffff')!;
  assert.equal(white.against, '#000000');
  assert.ok(Math.abs(white.ratio - 21) < 0.01, `white/black is 21:1, got ${white.ratio}`);
});

test('WCAG levels use the body and large-text thresholds separately', () => {
  // Measured values, not estimates: against the BETTER extreme these greys land
  // where the two scales (4.5/7 body, 3/4.5 large) put them.
  const cases: [string, 'AA' | 'AAA', 'AA' | 'AAA'][] = [
    ['#ffffff', 'AAA', 'AAA'],   // 21.00
    ['#767676', 'AA', 'AAA'],    //  4.62 — just over the body AA line
    ['#8a8a8a', 'AA', 'AAA'],    //  6.08
    ['#949494', 'AA', 'AAA'],    //  6.92 — still short of body AAA
    ['#a0a0a0', 'AAA', 'AAA'],   //  8.03
  ];
  for (const [hex, level, largeLevel] of cases) {
    const v = contrastVsExtremes(hex)!;
    assert.equal(v.level, level, `${hex} body level (ratio ${v.ratio.toFixed(2)})`);
    assert.equal(v.largeLevel, largeLevel, `${hex} large level (ratio ${v.ratio.toFixed(2)})`);
    const rank = { fail: 0, AA: 1, AAA: 2 } as const;
    assert.ok(rank[v.largeLevel] >= rank[v.level], `${hex}: large should not be stricter`);
  }
});

test('no colour can score below sqrt(21) against the better extreme', () => {
  // The two ratios always multiply to exactly 21, so taking the better of them
  // bottoms out where they cross — above the 4.5 body-AA threshold. This is why
  // `level` is never 'fail' here, and why the report must not read as a pass.
  let worst = Infinity;
  for (let r = 0; r <= 255; r += 15) {
    for (let g = 0; g <= 255; g += 15) {
      for (let b = 0; b <= 255; b += 15) {
        const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
        const v = contrastVsExtremes(hex)!;
        assert.ok(Math.abs(v.onBlack * v.onWhite - 21) < 1e-6,
          `${hex}: ${v.onBlack} x ${v.onWhite} should be 21`);
        assert.notEqual(v.level, 'fail', `${hex} cannot fail body AA against both extremes`);
        worst = Math.min(worst, v.ratio);
      }
    }
  }
  assert.ok(worst >= EXTREMES_CONTRAST_FLOOR - 1e-9, `worst ${worst} vs floor ${EXTREMES_CONTRAST_FLOOR}`);
  assert.ok(worst < EXTREMES_CONTRAST_FLOOR + 0.15, `the floor is actually reached (worst ${worst})`);
});

test('wcagLevel is the reusable scale, where failure IS reachable', () => {
  // The exported scale for callers scoring against a real surface rather than
  // the extremes — this is the one that can say no.
  assert.equal(wcagLevel(21), 'AAA');
  assert.equal(wcagLevel(7), 'AAA');
  assert.equal(wcagLevel(6.99), 'AA');
  assert.equal(wcagLevel(4.5), 'AA');
  assert.equal(wcagLevel(4.49), 'fail');
  assert.equal(wcagLevel(1), 'fail');
  assert.equal(wcagLevel(4.5, { large: true }), 'AAA');
  assert.equal(wcagLevel(3, { large: true }), 'AA');
  assert.equal(wcagLevel(2.99, { large: true }), 'fail');
});

test('a wide-gamut colour is scored on what actually renders', () => {
  // You cannot read text against a colour a screen can't show, so the score has
  // to be measured on the mapped hex — not on the authored value.
  const v = contrastVsExtremes('color(display-p3 1 0 0)')!;
  const mapped = contrastVsExtremes(describeColor('color(display-p3 1 0 0)')!.srgbHex)!;
  assert.equal(v.against, mapped.against);
  assert.ok(Math.abs(v.ratio - mapped.ratio) < 1e-9, 'scored on the rendered colour');
});
