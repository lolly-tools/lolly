/**
 * Gamut SOURCES (engine/src/gamut-source.ts) — the generalisation that lets a
 * gamut come from an ICC profile instead of one of three hard-coded RGB
 * matrices.
 *
 * The whole risk of that change is a silent shift in the display path, so the
 * first test here is a REGRESSION PIN: the old string-union arithmetic is
 * re-implemented locally as an oracle (matrices, EPS = 1e-6 cube slack and the
 * 0.5-to-GAMUT_EPSILON bisection, exactly as they were before the refactor) and
 * the built-in sources must agree with it bit-for-bit across a dense sweep.
 *
 * The rest:
 *   (1) a hand-written GamutSource is honoured by inGamut / maxChroma /
 *       oklchSlice / gamutSolid — the generalisation actually reaches all four
 *   (2) a source wider than chroma 0.5 is bracketed upward, not clamped at the
 *       old probe start (which would draw our own guess as a boundary)
 *   (3) P3 is still NOT inside Rec.2020 — membership is never inferred from
 *       gamut order, however the gamut arrived
 *   (4) identity: `gamutSourceId` keys a cache where string interpolation would
 *       collide every source onto '[object Object]'
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { inGamut, maxChroma, oklchSlice, sliceGamutEdge, GAMUTS } from '../engine/src/gamut.ts';
import { gamutSolid } from '../engine/src/gamut-solid.ts';
import {
  BUILTIN_GAMUT_SOURCES, GAMUT_PROBE_MAX, SRGB_SOURCE, P3_SOURCE, REC2020_SOURCE,
  gamutSourceId, resolveGamutSource,
} from '../engine/src/gamut-source.ts';
import type { GamutSource } from '../engine/src/gamut-source.ts';
import { oklabToLinearSrgb, GAMUT_EPSILON } from '../engine/src/brand-derive.ts';

// ─── The oracle: the pre-refactor implementation, copied verbatim ─────────────

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
const apply3 = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];
const OLD_SRGB_TO_P3: Mat3 = [
  0.8224621, 0.1775380, 0.0000000,
  0.0331941, 0.9668058, 0.0000000,
  0.0170827, 0.0723974, 0.9105199,
];
const OLD_SRGB_TO_REC2020: Mat3 = [
  0.6274040, 0.3292820, 0.0433136,
  0.0690970, 0.9195400, 0.0113612,
  0.0163916, 0.0880132, 0.8955953,
];
const OLD_EPS = 1e-6;
const oldInUnitCube = (rgb: readonly [number, number, number]): boolean =>
  rgb[0]! >= -OLD_EPS && rgb[0]! <= 1 + OLD_EPS
  && rgb[1]! >= -OLD_EPS && rgb[1]! <= 1 + OLD_EPS
  && rgb[2]! >= -OLD_EPS && rgb[2]! <= 1 + OLD_EPS;

function oldInGamut(l: number, c: number, h: number, limit: 'srgb' | 'p3' | 'rec2020'): boolean {
  if (!(l >= 0) || l > 1 || !(c >= 0) || !Number.isFinite(h)) return false;
  const hr = (h * Math.PI) / 180;
  const lin = oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
  if (limit === 'srgb') return oldInUnitCube(lin);
  const m = limit === 'p3' ? OLD_SRGB_TO_P3 : OLD_SRGB_TO_REC2020;
  return oldInUnitCube(apply3(m, lin[0], lin[1], lin[2]));
}

function oldMaxChroma(l: number, h: number, limit: 'srgb' | 'p3' | 'rec2020' = 'srgb'): number {
  if (!(l > 0) || l >= 1 || !Number.isFinite(h)) return 0;
  let lo = 0;
  let hi = 0.5;
  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    if (oldInGamut(l, mid, h, limit)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ─── (0) the regression pin ───────────────────────────────────────────────────

test('the built-in sources reproduce the old string-union membership exactly', () => {
  let checked = 0;
  for (let li = 0; li <= 40; li++) {
    const l = li / 40;
    for (let h = 0; h < 360; h += 3) {
      for (let ci = 0; ci <= 26; ci++) {
        const c = ci * 0.02; // 0 … 0.52, so both sides of every real boundary
        for (const name of GAMUTS) {
          const want = oldInGamut(l, c, h, name);
          const where = `${name} at L${l.toFixed(3)} C${c.toFixed(2)} H${h}`;
          assert.equal(inGamut(l, c, h, name), want, `inGamut(name) moved for ${where}`);
          assert.equal(
            inGamut(l, c, h, BUILTIN_GAMUT_SOURCES[name]), want,
            `the ${name} source disagrees with the old matrix test for ${where}`,
          );
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 350_000, `the sweep is dense (checked ${checked} membership questions)`);
});

test('the built-in sources reproduce the old chroma ceiling bit-for-bit', () => {
  for (let li = 1; li < 60; li++) {
    const l = li / 60;
    for (let h = 0; h < 360; h += 2) {
      for (const name of GAMUTS) {
        const want = oldMaxChroma(l, h, name);
        const where = `${name} at L${l.toFixed(4)} H${h}`;
        assert.equal(maxChroma(l, h, name), want, `maxChroma(name) moved for ${where}`);
        assert.equal(
          maxChroma(l, h, BUILTIN_GAMUT_SOURCES[name]), want,
          `maxChroma via the ${name} source is not the identical bisection for ${where}`,
        );
      }
    }
  }
});

test('degenerate input still answers false rather than reaching a source', () => {
  // The guard sits in front of every source, so a custom one never sees NaN.
  let seen = 0;
  const counting: GamutSource = {
    id: 'test:counting', label: 'counting',
    contains: () => { seen++; return true; },
  };
  for (const [l, c, h] of [[NaN, 0.1, 30], [0.5, NaN, 30], [0.5, 0.1, NaN],
    [-0.1, 0.1, 30], [1.1, 0.1, 30], [0.5, -0.1, 30]] as const) {
    assert.equal(inGamut(l, c, h, counting), false, `L${l} C${c} H${h} is not a colour any gamut holds`);
    assert.equal(inGamut(l, c, h, 'srgb'), oldInGamut(l, c, h, 'srgb'), 'the built-in path agrees');
  }
  assert.equal(seen, 0, 'the guard rejects degenerate input before the source is asked');
});

// ─── (1) a custom source reaches every consumer ───────────────────────────────

/**
 * A deliberately un-RGB-like gamut: a chroma ceiling that rises and falls with
 * hue and tapers at both ends of lightness. It is not a display, which is the
 * point — nothing about it can be satisfied by falling through to a matrix.
 */
const WEDGE_C = 0.18;
const wedge: GamutSource = {
  id: 'test:wedge',
  label: 'Wedge (test)',
  contains: (l, c, h) => {
    if (l <= 0 || l >= 1) return c === 0;
    const ceiling = WEDGE_C * Math.min(1, 2 * Math.min(l, 1 - l)) * (0.5 + 0.5 * Math.cos((h * Math.PI) / 180));
    return c <= ceiling;
  },
  inkCoverage: (_l, c) => Math.min(1, c / WEDGE_C),
};

test('inGamut and maxChroma answer from a custom source, not from a matrix', () => {
  for (let li = 1; li < 20; li++) {
    const l = li / 20;
    for (let h = 0; h < 360; h += 15) {
      const got = maxChroma(l, h, wedge);
      const want = WEDGE_C * Math.min(1, 2 * Math.min(l, 1 - l)) * (0.5 + 0.5 * Math.cos((h * Math.PI) / 180));
      assert.ok(
        Math.abs(got - want) <= GAMUT_EPSILON,
        `maxChroma traces the wedge's own ceiling at L${l.toFixed(2)} H${h}: got ${got}, want ${want}`,
      );
      assert.equal(inGamut(l, want * 0.9, h, wedge), true, `just inside the wedge at L${l.toFixed(2)} H${h}`);
      assert.equal(
        inGamut(l, want + 0.01, h, wedge), false,
        `past the wedge's ceiling at L${l.toFixed(2)} H${h}`,
      );
    }
  }
  // Hue 180 is the wedge's null direction, where no chroma at all fits.
  assert.equal(maxChroma(0.5, 180, wedge), 0, 'the wedge holds no chroma at its null hue');
});

test('oklchSlice paints a custom source, transparent exactly past its boundary', () => {
  const img = oklchSlice({ plane: 'ch', fixed: 0.5, width: 48, height: 32, cMax: 0.4, limit: wedge });
  assert.equal(img.data.length, 48 * 32 * 4, 'the buffer is width × height × RGBA');
  let opaque = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 48; x++) {
      const c = (1 - (y + 0.5) / 32) * 0.4;
      const h = ((x + 0.5) / 48) * 360;
      const alpha = img.data[(y * 48 + x) * 4 + 3];
      assert.equal(
        alpha !== 0, inGamut(0.5, c, h, wedge),
        `pixel ${x},${y} (C${c.toFixed(3)} H${h.toFixed(1)}) is opaque iff the wedge holds it`,
      );
      if (alpha !== 0) opaque++;
    }
  }
  assert.ok(opaque > 0 && opaque < 48 * 32, `the wedge paints part of the plane, not all or none (${opaque} px)`);
  // The built-in default is untouched by the widening.
  const srgb = oklchSlice({ plane: 'ch', fixed: 0.5, width: 24, height: 16, limit: 'srgb' });
  const viaSource = oklchSlice({ plane: 'ch', fixed: 0.5, width: 24, height: 16, limit: SRGB_SOURCE });
  assert.deepEqual(viaSource.data, srgb.data, 'the sRGB source paints the identical buffer to the name');
});

test('sliceGamutEdge traces a custom source', () => {
  const edge = sliceGamutEdge('ch', 0.5, wedge, 24, 0.4);
  assert.equal(edge.length, 25, 'steps + 1 points, as documented');
  for (let i = 0; i < edge.length; i++) {
    const h = (i / 24) * 360;
    const want = 1 - Math.min(1, maxChroma(0.5, h, wedge) / 0.4);
    assert.ok(Math.abs(edge[i]!.y - want) < 1e-9, `the edge at H${h} sits on the wedge's ceiling`);
  }
});

test('gamutSolid builds the surface of a custom source', () => {
  const solid = gamutSolid(wedge, 24, 12);
  assert.equal(solid.limit, wedge, 'the solid carries the source it was built from');
  assert.ok(solid.quads.length > 0, 'the wedge produces a surface');
  assert.ok(
    solid.maxRadius > 0 && solid.maxRadius <= WEDGE_C + GAMUT_EPSILON,
    `the widest reach is the wedge's own ceiling, not an RGB gamut's (${solid.maxRadius})`,
  );
  const srgbSolid = gamutSolid('srgb', 24, 12);
  assert.ok(
    srgbSolid.maxRadius > solid.maxRadius,
    'sRGB reaches further than the wedge, so the two solids are genuinely different surfaces',
  );
  const viaSource = gamutSolid(SRGB_SOURCE, 24, 12);
  assert.deepEqual(viaSource.quads, srgbSolid.quads, 'the sRGB source builds the identical mesh to the name');
});

// ─── (2) the probe bound is bracketed, not clamped ────────────────────────────

test('a source wider than the old 0.5 probe start is bracketed upward, not clamped', () => {
  const huge: GamutSource = { id: 'test:huge', label: 'Huge', contains: (_l, c) => c <= 1.75 };
  const got = maxChroma(0.5, 30, huge);
  assert.ok(
    Math.abs(got - 1.75) <= GAMUT_EPSILON,
    `the ceiling past 0.5 is found rather than clamped at the probe start: got ${got}`,
  );

  // A source that never says no cannot have a ceiling reported; the honest
  // answer is the probe bound itself, not a number that looks measured.
  const boundless: GamutSource = { id: 'test:boundless', label: 'Boundless', contains: () => true };
  assert.equal(
    maxChroma(0.5, 30, boundless), GAMUT_PROBE_MAX,
    'a source that accepts every chroma returns the probe bound, not a false measurement',
  );
});

// ─── (3) the non-nesting property survives ────────────────────────────────────

test('Display-P3 is still not inside Rec.2020, whichever form the gamut arrives in', () => {
  // Membership asked of each source in turn, exactly as the string form asks it.
  const escapees: string[] = [];
  for (let li = 1; li < 40; li++) {
    for (let hi = 0; hi < 72; hi++) {
      for (let ci = 1; ci < 45; ci++) {
        const l = li / 40, h = hi * 5, c = ci / 100;
        if (inGamut(l, c, h, P3_SOURCE) && !inGamut(l, c, h, REC2020_SOURCE)) {
          escapees.push(`L${l.toFixed(2)} C${c.toFixed(2)} H${h}`);
        }
      }
    }
  }
  assert.ok(escapees.length > 0, 'the deep-red sliver where P3 exceeds Rec.2020 is still found via sources');
  for (const e of escapees) assert.match(e, /H(25|30|35)$/, `the sliver is confined to the reds; got ${e}`);

  // And the consequence: a chroma search must ask Rec.2020 itself, not infer
  // from order — the ceiling there is genuinely NARROWER than P3's.
  assert.ok(
    maxChroma(0.5433, 29.7, REC2020_SOURCE) < maxChroma(0.5433, 29.7, P3_SOURCE),
    'the Rec.2020 source reports the narrower ceiling in the red sliver',
  );
});

// ─── (4) identity ─────────────────────────────────────────────────────────────

test('a source has a stable id that string interpolation would have collided', () => {
  assert.equal(gamutSourceId('p3'), 'p3', 'a name is its own id');
  assert.equal(gamutSourceId(P3_SOURCE), 'p3', 'the built-in source shares the name as its id');
  assert.equal(gamutSourceId(wedge), 'test:wedge', 'a custom source reports its own id');
  assert.notEqual(
    gamutSourceId(wedge), gamutSourceId({ id: 'test:other', label: 'x', contains: () => true }),
    'two distinct sources get distinct cache keys, where `${source}` gives both [object Object]',
  );
  assert.equal(`${wedge}`, '[object Object]', 'which is exactly the collision gamutSourceId exists to avoid');

  for (const name of GAMUTS) {
    assert.equal(resolveGamutSource(name).id, name, `resolveGamutSource('${name}') is the matching built-in`);
  }
  assert.equal(resolveGamutSource(wedge), wedge, 'resolving a source is the identity');
  assert.equal(
    resolveGamutSource('constructor' as unknown as 'srgb'), SRGB_SOURCE,
    'a prototype key is not mistaken for a built-in gamut',
  );
  assert.equal(SRGB_SOURCE.inkCoverage?.(0.5, 0.1, 30), null, 'additive light reports no ink coverage');
});
