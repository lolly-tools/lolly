// SPDX-License-Identifier: MPL-2.0
/**
 * Covers the generated GLSL (lib/viz-glsl.ts).
 *
 * A shader can only really be validated by compiling it, which needs a WebGL2 context
 * this suite doesn't have - so these assert the properties that are checkable as text
 * AND that have actually bitten:
 *
 *  - a WARP shader must apply `decay`, or the feedback loop never fades and the field
 *    saturates to white within a second (butterchurn's built-in body does this, and a
 *    custom shader replaces it);
 *  - a glow must NAME `sampler_blurN`, because that's how `Renderer.getHighestBlur`
 *    decides to allocate blur passes at all - no mention, no bloom;
 *  - every numeric literal needs a decimal point, since `1` is an int in GLSL and
 *    won't implicitly convert where a float is wanted;
 *  - the brand palette has to actually be baked in, or the whole point is lost.
 *
 * Structural balance checks catch the commonest way a generated shader breaks: a
 * template branch that emits an unclosed block.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildVizPalette } from './viz-palette.ts';
import {
  brandGlslHeader, compBrandBump, compBrandClouds, compBrandEcho, compBrandEdge,
  compBrandMosaic, compBrandRadial, compBrandRelief, compBrandStreak, compBrandTone,
  compBrandPrism, compBrandWatercolour, f, warpBrandFlow, warpBrandRadial, warpBrandTile,
  warpBrandVolume, warpBrandWatercolour, warpPlain,
} from './viz-glsl.ts';

const SUSE = ['#0c322c', '#01564a', '#008878', '#30ba78', '#90ebcd'];
const palette = buildVizPalette(SUSE, '#30ba78');
const other = buildVizPalette(['#1a0033', '#7b2ff7', '#f72585', '#ffd6e8'], '#7b2ff7');

const WARPS = [
  ['warpBrandFlow', warpBrandFlow(palette)],
  ['warpBrandRadial', warpBrandRadial(palette)],
  ['warpBrandVolume', warpBrandVolume(palette)],
  ['warpBrandTile', warpBrandTile(palette)],
  ['warpBrandWatercolour', warpBrandWatercolour(palette)],
  ['warpPlain', warpPlain(palette)],
] as const;

const COMPS = [
  ['compBrandTone', compBrandTone(palette)],
  ['compBrandEcho', compBrandEcho(palette)],
  ['compBrandRadial', compBrandRadial(palette)],
  ['compBrandEdge', compBrandEdge(palette)],
  ['compBrandRelief', compBrandRelief(palette)],
  ['compBrandStreak', compBrandStreak(palette)],
  ['compBrandClouds', compBrandClouds(palette)],
  ['compBrandMosaic', compBrandMosaic(palette)],
  ['compBrandBump', compBrandBump(palette)],
  ['compBrandWatercolour', compBrandWatercolour(palette)],
  ['compBrandPrism', compBrandPrism(palette)],
  ['compBrandPrism-noglow', compBrandPrism(palette, { glow: 0 })],
  ['compBrandTone+solarize+invert', compBrandTone(palette, { solarize: true, invert: true })],
  ['compBrandEdge+invert', compBrandEdge(palette, { invert: true })],
] as const;

const ALL = [...WARPS, ...COMPS];

// ── float literals ──────────────────────────────────────────────────────────

test('f() always emits a float literal, never a bare int', () => {
  for (const n of [0, 1, -1, 7, 0.5, 1e-6, -2.25]) {
    assert.match(f(n), /\./, `f(${n}) = ${f(n)} has no decimal point`);
  }
  // Non-finite input must not emit "NaN" or "Infinity" into shader source.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(f(bad), '0.0');
  }
});

// ── structure ───────────────────────────────────────────────────────────────

test('every shader has a shader_body block with balanced braces and parens', () => {
  for (const [name, src] of ALL) {
    assert.ok(src.includes('shader_body'), `${name} has no shader_body`);
    const open = (src.match(/\{/g) ?? []).length;
    const close = (src.match(/\}/g) ?? []).length;
    assert.equal(open, close, `${name} brace mismatch`);
    const po = (src.match(/\(/g) ?? []).length;
    const pc = (src.match(/\)/g) ?? []).length;
    assert.equal(po, pc, `${name} paren mismatch`);
  }
});

test('every shader assigns ret - that is its only output', () => {
  for (const [name, src] of ALL) {
    const body = src.slice(src.indexOf('shader_body'));
    assert.match(body, /\bret\s*=/, `${name} never assigns ret`);
  }
});

test('no shader emits a legacy texture2D/texture3D call', () => {
  // butterchurn rewrites them, but emitting GLSL ES 3.00 directly is clearer and means
  // the source we read is the source that compiles.
  for (const [name, src] of ALL) {
    assert.ok(!/texture2D|texture3D/.test(src), `${name} uses a legacy sampler call`);
  }
});

test('no shader body declares a variable that shadows a butterchurn built-in', () => {
  // These are provided by the generated preamble; redeclaring any is a compile error.
  const reserved = ['uv', 'uv_orig', 'rad', 'ang', 'time', 'decay', 'texsize', 'ret'];
  for (const [name, src] of ALL) {
    const body = src.slice(src.indexOf('shader_body'));
    for (const r of reserved) {
      assert.ok(
        !new RegExp(`\\b(float|vec2|vec3|vec4|int)\\s+${r}\\b`).test(body),
        `${name} redeclares built-in ${r}`,
      );
    }
  }
});

// ── the two traps ───────────────────────────────────────────────────────────

test('EVERY warp shader applies decay', () => {
  // The regression that matters most: a custom warp replaces butterchurn's built-in
  // `ret = texture(sampler_main, uv).rgb * decay`, so dropping decay means trails
  // never fade and the screen blows out to white almost immediately.
  for (const [name, src] of WARPS) {
    assert.match(src, /\*\s*decay/, `${name} does not apply decay`);
  }
});

test('a shader names ONLY the blur levels it uses', () => {
  // getHighestBlur allocates passes by grepping for `sampler_blurN`, so a helper sitting
  // unused in the header silently costs a full render pass every frame. This is why the
  // blur helpers are emitted per-shader rather than in the shared header.
  assert.match(compBrandTone(palette, { glow: 0.5 }), /sampler_blur1/);
  const noGlow = compBrandTone(palette, { glow: 0 });
  assert.ok(!noGlow.includes('sampler_blur'), 'glow: 0 must not request blur passes');
  // Warps that don't touch blur must not drag the pyramid in either.
  for (const [name, src] of WARPS) {
    if (name === 'warpBrandWatercolour') continue;   // genuinely needs levels 2 and 3
    assert.ok(!src.includes('sampler_blur'), `${name} should not request blur passes`);
  }
  // And nothing may CALL a helper it didn't ask to have emitted.
  for (const [name, src] of ALL) {
    for (const n of [1, 2, 3]) {
      if (src.includes(`lolBlur${n}(`) && !src.includes(`float lolBlur${n}(vec2`)) {
        assert.fail(`${name} calls lolBlur${n} without declaring blur level ${n}`);
      }
    }
    if (src.includes('lolBlurGradient(') && !src.includes('vec2 lolBlurGradient(')) {
      assert.fail(`${name} calls lolBlurGradient without declaring blur level 2+`);
    }
  }
});

test('optional composite terms drop out cleanly when disabled', () => {
  const bare = compBrandTone(palette, { glow: 0, grain: 0, vignette: 0 });
  assert.ok(!bare.includes('sampler_blur'));
  assert.ok(!bare.includes('lolGrain(uv'), 'grain: 0 should emit no grain term');
  assert.ok(!bare.includes('smoothstep'), 'vignette: 0 should emit no vignette term');
  // Still a valid, complete shader.
  assert.equal((bare.match(/\{/g) ?? []).length, (bare.match(/\}/g) ?? []).length);
  assert.match(bare.slice(bare.indexOf('shader_body')), /\bret\s*=/);
});

// ── brand colour is genuinely baked in ──────────────────────────────────────

test('the header declares the palette and its lookup helpers', () => {
  const h = brandGlslHeader(palette);
  for (const sym of ['BRAND_DEEP', 'BRAND_HERO', 'BRAND_TIP', 'BRAND_DEEPEST',
    'brandRamp', 'brandTone', 'lolLum', 'lolNoise']) {
    assert.ok(h.includes(sym), `header is missing ${sym}`);
  }
  // Every ramp stop should appear as a vec3 literal.
  const stops = (h.match(/vec3\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+\)/g) ?? []).length;
  assert.ok(stops >= palette.ramp.length, `expected ${palette.ramp.length} stops, saw ${stops}`);
});

test('a different brand produces different shader source', () => {
  for (const build of [compBrandTone, compBrandEcho, compBrandRadial, warpBrandFlow]) {
    assert.notEqual(build(palette), build(other), `${build.name} ignores the palette`);
  }
});

test('shader source is deterministic for the same palette', () => {
  // Identical text keeps driver shader caches warm across preset switches, and makes
  // these assertions meaningful in the first place.
  assert.equal(compBrandTone(palette), compBrandTone(palette));
  assert.equal(brandGlslHeader(palette), brandGlslHeader(palette));
});

test('the invert and solarize curves emit real GLSL, and only when asked', () => {
  const plain = compBrandTone(palette);
  assert.ok(!plain.includes('e = 1.0 - e'), 'invert must be opt-in');
  assert.ok(!plain.includes('e * (1.0 - e) * 4.0'), 'solarize must be opt-in');
  const inv = compBrandTone(palette, { invert: true });
  assert.ok(inv.includes('e = 1.0 - e;'), 'invert should emit its curve');
  const sol = compBrandTone(palette, { solarize: true });
  assert.ok(sol.includes('e * (1.0 - e) * 4.0'), 'solarize should emit its curve');
  // Both together: solarize first, then invert, so they compose predictably.
  const both = compBrandTone(palette, { invert: true, solarize: true });
  assert.ok(both.indexOf('(1.0 - e) * 4.0') < both.indexOf('e = 1.0 - e;'),
    'solarize must be applied before inversion');
  // A curve must sit BEFORE the brand mapping, or it would recolour the output instead of
  // reshaping the intensity that the ramp is looked up with.
  assert.ok(both.indexOf('e = 1.0 - e;') < both.indexOf('ret = brandTone(e)'));
});

test('the ramp lookup has one mix per segment', () => {
  const h = brandGlslHeader(palette);
  const mixes = (h.match(/c = mix\(c,/g) ?? []).length;
  assert.equal(mixes, palette.ramp.length - 1, 'piecewise lerp needs stops-1 blends');
});

test('a degenerate palette still yields compilable-looking source', () => {
  // A brand with nothing usable falls back, but must never emit an empty ramp - that
  // would leave `vec3 c = ;` in the header.
  const empty = buildVizPalette([]);
  const h = brandGlslHeader(empty);
  assert.match(h, /vec3 c = vec3\([\d.]+, [\d.]+, [\d.]+\);/);
  assert.equal((h.match(/\{/g) ?? []).length, (h.match(/\}/g) ?? []).length);
});
