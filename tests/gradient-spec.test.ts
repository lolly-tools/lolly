// SPDX-License-Identifier: MPL-2.0
/**
 * CSS Color 4 interpolation (css-color.ts) and the Lolly gradient spec
 * (gradient-spec.ts) - see plans/60-color-spaces.md section 10.
 *
 * The two properties worth defending here:
 *
 *   1. Interpolation is PREMULTIPLIED. A per-channel lerp toward `transparent`
 *      drags the colour toward transparent's black, so a red→transparent midpoint
 *      comes out dark red instead of plain red at half alpha. Browsers premultiply;
 *      the conic-gradient export fan used to not, and disagreed with the screen.
 *   2. Baking is FAITHFUL and BOUNDED. The emitted sRGB stops must reproduce the
 *      requested curve to within a JND at every sample, must not multiply without
 *      limit, and must be stable under the hue directions.
 *
 * Run directly:  node --test tests/gradient-spec.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColor, colorToHexString, convertColor, interpolateColor, gradientStops,
  deltaEOkColor, isNamedColor, NAMED_COLORS,
} from '../engine/src/css-color.ts';
import type { ColorStop, CssColor, HueDirection } from '../engine/src/css-color.ts';
import {
  parseGradientSpec, formatGradientSpec, gradientSpecToCss, gradientSpecStops,
  MAX_GRADIENT_STOPS,
} from '../engine/src/gradient-spec.ts';

const P = (s: string): CssColor => {
  const c = parseColor(s);
  assert.ok(c, `${s} parses`);
  return c;
};
const H = (c: CssColor): string => colorToHexString(c);

// ── interpolateColor: premultiplied alpha ────────────────────────────────────

test('mixing toward transparent holds the colour and fades the alpha', () => {
  // THE regression. Unpremultiplied this is #800000 at 50% (dark red); every
  // browser paints plain red at 50%.
  assert.equal(H(interpolateColor(P('red'), P('transparent'), 0.5)), '#ff000080');
  assert.equal(H(interpolateColor(P('#0000ff'), P('transparent'), 0.25)), '#0000ffbf');
  // …and in sRGB too: premultiplication is not a property of the space.
  assert.equal(H(interpolateColor(P('red'), P('transparent'), 0.5, { space: 'srgb' })), '#ff000080');
});

test('two translucent ends interpolate their premultiplied colour', () => {
  const mid = interpolateColor(P('#ff000080'), P('#0000ff80'), 0.5, { space: 'srgb' });
  // Equal alphas: the colour is the plain midpoint, alpha unchanged.
  assert.equal(H(mid), '#80008080');
});

test('a fully transparent pair falls back to an unpremultiplied lerp, not NaN', () => {
  const mid = interpolateColor(P('#ff000000'), P('#0000ff00'), 0.5, { space: 'srgb' });
  assert.equal(mid.alpha, 0);
  for (const v of mid.components) assert.ok(Number.isFinite(v), 'components stay finite');
});

test('endpoints are exact and t is clamped', () => {
  const a = P('#30ba78');
  const b = P('#efefef');
  assert.equal(H(interpolateColor(a, b, 0)), '#30ba78');
  assert.equal(H(interpolateColor(a, b, 1)), '#efefef');
  assert.equal(H(interpolateColor(a, b, -5)), '#30ba78');
  assert.equal(H(interpolateColor(a, b, 99)), '#efefef');
});

// ── interpolateColor: spaces and hue directions ──────────────────────────────

test('the interpolation space changes the midpoint in the documented way', () => {
  // sRGB drags red→blue through a dark purple; OKLab keeps the lightness up.
  assert.equal(H(interpolateColor(P('red'), P('blue'), 0.5, { space: 'srgb' })), '#800080');
  assert.equal(H(interpolateColor(P('red'), P('blue'), 0.5, { space: 'oklab' })), '#8c53a2');
  // Default space is oklab.
  assert.equal(
    H(interpolateColor(P('red'), P('blue'), 0.5)),
    H(interpolateColor(P('red'), P('blue'), 0.5, { space: 'oklab' })),
  );
});

test('black → white: sRGB midpoint is dark, OKLab midpoint is a real mid-grey', () => {
  const srgbMid = convertColor(interpolateColor(P('#000'), P('#fff'), 0.5, { space: 'srgb' }), 'oklab');
  const okMid = convertColor(interpolateColor(P('#000'), P('#fff'), 0.5, { space: 'oklab' }), 'oklab');
  assert.ok(Math.abs(okMid.components[0] - 0.5) < 0.01, `OKLab L ≈ 0.5, got ${okMid.components[0]}`);
  // sRGB's midpoint (#808080) sits well above half perceptual lightness.
  assert.ok(srgbMid.components[0] > 0.58, `sRGB L is high, got ${srgbMid.components[0]}`);
});

test('hue directions travel the requested way round the circle', () => {
  const a = P('oklch(0.6 0.2 30)');
  const b = P('oklch(0.6 0.2 60)');
  const hueAt = (dir: HueDirection, t = 0.5): number =>
    convertColor(interpolateColor(a, b, t, { space: 'oklch', hue: dir }), 'oklch').components[2];
  assert.ok(Math.abs(hueAt('shorter') - 45) < 0.5, `shorter → 45, got ${hueAt('shorter')}`);
  // longer takes the 330° way round, so the midpoint is on the far side.
  assert.ok(Math.abs(hueAt('longer') - 225) < 0.5, `longer → 225, got ${hueAt('longer')}`);
  assert.ok(Math.abs(hueAt('increasing') - 45) < 0.5, 'increasing matches shorter here');
  assert.ok(Math.abs(hueAt('decreasing') - 225) < 0.5, 'decreasing goes the other way');
});

test('a missing hue adopts the other side (section 13.2), so grey→colour deepens in place', () => {
  const grey = P('oklch(0.5 0 none)');
  const green = P('oklch(0.7 0.2 140)');
  const mid = convertColor(interpolateColor(grey, green, 0.5, { space: 'oklch' }), 'oklch');
  assert.ok(Math.abs(mid.components[2] - 140) < 0.5, `hue carried, got ${mid.components[2]}`);
  // Without the carry the hue would lerp from 0 and land near 70.
});

// ── gradientStops: faithfulness ──────────────────────────────────────────────

// What a flat sRGB renderer paints at `t` across a baked stop list.
function renderAt(stops: readonly ColorStop[], pos: number): CssColor {
  if (pos <= stops[0]!.pos) return stops[0]!.color;
  const last = stops[stops.length - 1]!;
  if (pos >= last.pos) return last.color;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1]!;
    const b = stops[i]!;
    if (pos <= b.pos) {
      const span = b.pos - a.pos;
      const f = span > 0 ? (pos - a.pos) / span : 0;
      return interpolateColor(a.color, b.color, f, { space: 'srgb' });
    }
  }
  return last.color;
}

test('baked stops reproduce the requested curve within a JND at every sample', () => {
  const pairs: Array<[string, string]> = [
    ['#000000', '#ffffff'], ['blue', 'yellow'], ['#30ba78', '#efefef'],
    ['red', 'blue'], ['navy', 'gold'], ['#ff0000', '#00ff00'],
  ];
  for (const space of ['oklab', 'oklch', 'lab'] as const) {
    for (const [from, to] of pairs) {
      const authored: ColorStop[] = [{ color: P(from), pos: 0 }, { color: P(to), pos: 100 }];
      const baked = gradientStops(authored, { space });
      let worst = 0;
      for (let i = 0; i <= 40; i++) {
        const pos = (i / 40) * 100;
        const want = interpolateColor(authored[0]!.color, authored[1]!.color, i / 40, { space });
        worst = Math.max(worst, deltaEOkColor(renderAt(baked, pos), want));
      }
      // The bake targets 0.01 at the midpoints it tests; between them the error can
      // be a little higher, but must stay well inside one JND (0.02).
      assert.ok(worst < 0.02, `${from}→${to} in ${space}: worst ΔEOK ${worst.toFixed(4)}`);
    }
  }
});

test('subdivision is adaptive - flat segments cost nothing, hue crossings cost a few', () => {
  const bake = (a: string, b: string): number =>
    gradientStops([{ color: P(a), pos: 0 }, { color: P(b), pos: 100 }]).length;
  assert.equal(bake('#888888', '#999999'), 2, 'a near-identical pair needs no help');
  assert.equal(bake('#30ba78', '#30ba78'), 2, 'an identical pair needs no help');
  assert.ok(bake('blue', 'yellow') > 4, 'a hue crossing gets real subdivision');
  assert.ok(bake('#000000', '#ffffff') > 4, 'so does a full lightness sweep');
  // Bounded: default maxDepth 5 → at most 31 inserted per segment.
  assert.ok(bake('blue', 'yellow') <= 33, 'and it stays bounded');
});

test('interpolating in sRGB needs no baking at all - the renderer already agrees', () => {
  for (const [a, b] of [['#000000', '#ffffff'], ['blue', 'yellow'], ['red', 'transparent']]) {
    assert.equal(
      gradientStops([{ color: P(a!), pos: 0 }, { color: P(b!), pos: 100 }], { space: 'srgb' }).length,
      2, `${a}→${b} in sRGB`);
  }
});

test('a longer-hue sweep is monotone in hue, not an oscillation', () => {
  // Recursing on freshly-made midpoints would re-apply `longer` to each half and
  // tour the whole wheel once per subdivision. Anchoring on the endpoints keeps it
  // to a single sweep - so the unwrapped hue must move in one direction only.
  const baked = gradientStops(
    [{ color: P('oklch(0.6 0.2 30)'), pos: 0 }, { color: P('oklch(0.6 0.2 60)'), pos: 100 }],
    { space: 'oklch', hue: 'longer' },
  );
  // Monotone in ONE direction - which direction is the pair's business. 30°→60°
  // "the long way" happens to run DOWNWARD (30 → 9 → 349 → … → 60), so the test
  // is that every step shares a sign, not that hue increases.
  const hueOf = (c: CssColor): number => convertColor(c, 'oklch').components[2];
  const steps: number[] = [];
  let prev = hueOf(baked[0]!.color);
  for (const s of baked.slice(1)) {
    const h = hueOf(s.color);
    steps.push(((h - prev + 540) % 360) - 180);    // shortest signed step
    prev = h;
  }
  const sign = Math.sign(steps.find(s => Math.abs(s) > 0.5) ?? 1);
  for (const s of steps) {
    assert.ok(Math.sign(s) === sign || Math.abs(s) <= 0.5,
      `hue never reverses (step ${s.toFixed(2)}, sweep sign ${sign})`);
  }
  const travelled = Math.abs(steps.reduce((a, b) => a + b, 0));
  assert.ok(travelled > 300, `covers the long arc, not the short one: ${travelled.toFixed(1)}°`);
});

test('positions stay ordered and inside the authored span', () => {
  const baked = gradientStops([
    { color: P('red'), pos: 10 }, { color: P('blue'), pos: 40 }, { color: P('yellow'), pos: 90 },
  ]);
  assert.equal(baked[0]!.pos, 10);
  assert.equal(baked[baked.length - 1]!.pos, 90);
  for (let i = 1; i < baked.length; i++) {
    assert.ok(baked[i]!.pos >= baked[i - 1]!.pos, `monotone at ${i}`);
  }
});

test('gradientStops handles degenerate input without throwing', () => {
  assert.deepEqual(gradientStops([]), []);
  assert.equal(gradientStops([{ color: P('red'), pos: 0 }]).length, 1);
  // Zero-width segment (a hard edge) emits nothing between the two.
  assert.equal(gradientStops([
    { color: P('red'), pos: 50 }, { color: P('blue'), pos: 50 },
  ]).length, 2);
});

// ── the spec grammar ─────────────────────────────────────────────────────────

test('the canonical form round-trips', () => {
  for (const spec of [
    'lin_90_30ba78-0_efefef-100',
    'rad_0_0c322c-0_30ba78-60_ffffff-100',
    'con_45_ff0000-0_0000ff-100',
    'lin.srgb_90_000000-0_ffffff-100',
    'lin.oklch.longer_90_ff0000-0_00ff00-100',
    'lin_270_30ba7880-0_efefef-100',
    'lin_90_navy-0_gold-100',
    'lin_90_transparent-0_000000-100',
  ]) {
    const g = parseGradientSpec(spec);
    assert.ok(g, `${spec} parses`);
    assert.equal(formatGradientSpec(g), spec, spec);
  }
});

test('an all-letters hex is hex, not a colour name', () => {
  // `efefef`, `dedede`, `facade` are valid 6-digit hex AND all letters. Reading
  // them as idents dropped the stop, silently turning a 3-stop gradient into a
  // 2-stop one - or refusing the whole spec when only two stops were authored.
  const g = parseGradientSpec('lin_90_efefef-0_dedede-50_facade-100');
  assert.ok(g);
  assert.deepEqual(g.stops.map(s => s.color), ['#efefef', '#dedede', '#facade']);
  // And the coincidence this relies on is itself pinned: no CSS colour name is
  // also a valid hex string.
  assert.equal(Object.keys(NAMED_COLORS).filter(n => /^[0-9a-f]{3,8}$/i.test(n)).length, 0);
  // A real name still wins.
  assert.equal(parseGradientSpec('lin_90_red-0_blue-100')!.stops[0]!.color, 'red');
  assert.ok(isNamedColor('red'));
});

test('lenient input forms all land on the same spec', () => {
  const want = 'lin_90_30ba78-0_efefef-100';
  for (const variant of [
    'lin_90_#30ba78@0_#efefef@100',
    'LIN_90_30BA78-0_EFEFEF-100',
    'linear_90_30ba78-0_efefef-100',
    '  lin_90_30ba78-0_efefef-100  ',
  ]) {
    assert.equal(formatGradientSpec(parseGradientSpec(variant)!), want, variant);
  }
});

test('unpositioned stops spread evenly, like CSS', () => {
  assert.deepEqual(parseGradientSpec('lin_90_red_blue')!.stops.map(s => s.pos), [0, 100]);
  assert.deepEqual(parseGradientSpec('lin_90_red_lime_blue')!.stops.map(s => s.pos), [0, 50, 100]);
  assert.deepEqual(
    parseGradientSpec('lin_90_red-20_lime_blue-80')!.stops.map(s => s.pos), [20, 50, 80]);
});

test('a position that goes backwards clamps up to its predecessor (hard edge)', () => {
  assert.deepEqual(
    parseGradientSpec('lin_90_red-60_blue-20_lime-100')!.stops.map(s => s.pos), [60, 60, 100]);
});

test('the angle slot is optional and normalised', () => {
  assert.equal(parseGradientSpec('lin_450_red-0_blue-100')!.angle, 90);
  assert.equal(parseGradientSpec('lin_-90_red-0_blue-100')!.angle, 270);
  // No angle at all: a linear gradient defaults to CSS's `to bottom`.
  assert.equal(parseGradientSpec('lin_red-0_blue-100')!.angle, 180);
  assert.equal(parseGradientSpec('con_red-0_blue-100')!.angle, 0);
});

test('unreadable specs return null rather than half a gradient', () => {
  for (const bad of [
    '', '   ', null, undefined, 'lin', 'garbage', 'lin_90', 'lin_90_red-0',
    'lin_90_nope-0_alsonope-100', 'xyz_90_red-0_blue-100',
    'lin.bogus_90_red-0_blue-100', 'lin.oklch.sideways_90_red-0_blue-100',
  ]) {
    assert.equal(parseGradientSpec(bad as string), null, JSON.stringify(bad));
  }
});

test('an unreadable stop is skipped, not fatal, while two remain', () => {
  const g = parseGradientSpec('lin_90_red-0_zzz-50_blue-100');
  assert.ok(g);
  assert.deepEqual(g.stops.map(s => s.color), ['red', 'blue']);
});

test('stop count is bounded - a hand-edited URL cannot ask for unbounded work', () => {
  const many = ['lin', '90', ...Array.from({ length: 40 }, (_, i) => `ff00${(i % 10)}${(i % 10)}-${i * 2}`)];
  const g = parseGradientSpec(many.join('_'));
  assert.ok(g);
  assert.equal(g.stops.length, MAX_GRADIENT_STOPS);
});

// ── the spec's CSS ───────────────────────────────────────────────────────────

test('each kind emits the CSS primitive the export walkers already parse', () => {
  assert.match(gradientSpecToCss('lin_90_30ba78-0_efefef-100')!, /^linear-gradient\(90deg, /);
  assert.match(gradientSpecToCss('rad_0_30ba78-0_efefef-100')!,
    /^radial-gradient\(ellipse farthest-corner at 50% 50%, /);
  assert.match(gradientSpecToCss('con_45_30ba78-0_efefef-100')!,
    /^conic-gradient\(from 45deg at 50% 50%, /);
  assert.equal(gradientSpecToCss('nope'), null);
  assert.equal(gradientSpecToCss(null), null);
});

test('the emitted CSS carries plain sRGB hex stops with percent positions', () => {
  const css = gradientSpecToCss('lin_90_30ba78-0_efefef-100')!;
  assert.equal(css, 'linear-gradient(90deg, #30ba78 0%, #9dd6b3 50%, #efefef 100%)');
  // No `in <space>` - that is the whole point of baking (SVG/PDF can't read it).
  assert.ok(!/\bin\s+oklab\b/.test(css), 'no interpolation-space keyword');
});

test("the spec's own stops survive baking as segment endpoints", () => {
  const baked = gradientSpecStops(parseGradientSpec('lin_90_ff0000-0_00ff00-50_0000ff-100')!);
  const hexes = baked.map(s => colorToHexString(s.color));
  for (const authored of ['#ff0000', '#00ff00', '#0000ff']) {
    assert.ok(hexes.includes(authored), `${authored} kept verbatim`);
  }
  assert.equal(baked[0]!.pos, 0);
  assert.equal(baked[baked.length - 1]!.pos, 100);
});

test('a spec in sRGB emits exactly its authored stops', () => {
  assert.equal(
    gradientSpecToCss('lin.srgb_90_000000-0_ffffff-100'),
    'linear-gradient(90deg, #000000 0%, #ffffff 100%)');
});
