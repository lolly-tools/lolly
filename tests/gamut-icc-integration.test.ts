// SPDX-License-Identifier: MPL-2.0
/**
 * The seam: an ICC profile driving the gamut functions and host.color.
 *
 * icc.ts and gamut-source.ts were built to one interface and are unit-tested
 * separately (tests/icc.test.ts, tests/gamut-source.test.ts). Neither suite
 * proves they COMPOSE - that `iccGamutSource(p, intent)` is accepted everywhere a
 * gamut name is, and that the answers mean what the display path's mean. That is
 * what this file is for, plus the `host.color` surface a tool actually sees.
 *
 * The strongest check here needs no fixture arithmetic at all: run macOS's own
 * sRGB / Display-P3 / Rec.2020 profiles through the ICC path and compare the
 * chroma ceiling with the same gamut reached by its pre-composed matrix. Two
 * completely independent routes to one number - CLUT-free matrix/TRC tables read
 * from bytes nobody here wrote, versus brand-derive's Oklab core - so agreement
 * is evidence about both.
 *
 * Real-profile tests skip with the missing path so a box without a ColorSync
 * tree stays green rather than red.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  parseIccProfile, iccGamutSource, iccRoundTripDeltaE, iccRoundTripDecides, ICC_GAMUT_DELTA_E,
} from '../engine/src/icc.ts';
import type { IccProfile } from '../engine/src/icc.ts';
import {
  inGamut, maxChroma, oklchSlice, sliceGamutEdge, sliceGamutRegion,
} from '../engine/src/gamut.ts';
import { gamutSolid, projectSolidPoint } from '../engine/src/gamut-solid.ts';
import { gamutSourceId } from '../engine/src/gamut-source.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { oneWayProfileBytes } from './helpers/icc-fixture.ts';
import { srgbIccProfile } from '../engine/src/color.ts';

const SYS = '/System/Library/ColorSync/Profiles/';
const CMYK_PATH = `${SYS}Generic CMYK Profile.icc`;

/** Load + parse a stock profile, or skip naming the file that was missing. */
function withProfile(path: string, t: { skip(msg: string): void }, body: (p: IccProfile) => void): void {
  if (!existsSync(path)) {
    t.skip(`stock profile not on this machine: ${path}`);
    return;
  }
  const p = parseIccProfile(new Uint8Array(readFileSync(path)));
  if (!p) {
    t.skip(`stock profile did not parse: ${path}`);
    return;
  }
  body(p);
}

// ─── the two routes to one number ─────────────────────────────────────────────

test('a display gamut read from its own ICC profile agrees with its matrix', (t) => {
  const cases = [
    ['sRGB Profile.icc', 'srgb'],
    ['Display P3.icc', 'p3'],
    ['ITU-2020.icc', 'rec2020'],
  ] as const;
  let ran = 0;
  for (const [file, name] of cases) {
    withProfile(SYS + file, { skip: () => {} }, (p) => {
      ran++;
      const src = iccGamutSource(p, 'relative');
      for (const l of [0.4, 0.6, 0.8]) {
        for (const h of [0, 60, 120, 180, 240, 300]) {
          const viaIcc = maxChroma(l, h, src);
          const viaMatrix = maxChroma(l, h, name);
          // These agree to about 1e-4 - the two routes are the same boundary,
          // reached through a profile's s15Fixed16 matrix in one case and
          // brand-derive's float matrix in the other, both bisected to
          // GAMUT_EPSILON. 0.002 leaves room for the fixed-point quantisation and
          // still catches any real disagreement, which shows up in tenths (before
          // the cube test in icc.ts, deep blue here was out by 0.16).
          assert.ok(
            viaIcc >= viaMatrix - 0.002 && viaIcc <= viaMatrix + 0.002,
            `${name} ceiling at l=${l} h=${h}: ICC ${viaIcc.toFixed(4)} vs matrix ${viaMatrix.toFixed(4)}`,
          );
        }
      }
    });
  }
  if (ran === 0) t.skip('no stock display profiles on this machine');
});

// ─── the gamut functions accept a profile-backed source ───────────────────────

test('every gamut function takes an ICC source where it takes a name', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const src = iccGamutSource(p, 'relative');
    assert.equal(p.dataColourSpace, 'CMYK', 'fixture must be the four-ink profile');

    // inGamut: a muted mid tone prints, a fully saturated one does not.
    assert.equal(inGamut(0.55, 0.06, 30, src), true, 'a muted mid tone must be inside a press gamut');
    assert.equal(inGamut(0.55, 0.30, 30, src), false, 'chroma 0.30 is outside every press gamut');

    // maxChroma: bracketed and bisected, so it must land between those two.
    const ceiling = maxChroma(0.55, 30, src);
    assert.ok(ceiling > 0.06 && ceiling < 0.30, `press ceiling at l=0.55 h=30 must sit between the two probes, got ${ceiling}`);
    assert.ok(ceiling < maxChroma(0.55, 30, 'srgb'), 'a press gamut must be narrower than sRGB at hue 30');

    // oklchSlice: some pixels painted, some left transparent - a source that
    // answered every pixel the same way would pass a "runs without throwing" test.
    const img = oklchSlice({ plane: 'lc', fixed: 30, width: 48, height: 32, limit: src });
    let opaque = 0;
    for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! > 0) opaque++;
    assert.ok(opaque > 0, 'the slice must paint the printable region');
    assert.ok(opaque < 48 * 32, 'the slice must leave the unprintable region transparent');

    // The boundary curve and the fill region, the two things a chart draws.
    const edge = sliceGamutEdge('lc', 30, src, 24);
    assert.equal(edge.length, 25, 'sliceGamutEdge must return steps + 1 points');
    assert.ok(edge.some(pt => pt.x > 0), 'the press boundary must leave the achromatic axis somewhere');
    assert.ok(sliceGamutRegion('lc', 30, src, 24)[0]!.length > 3, 'the lc region must close as one ring');

    // The 3D solid, built from the same maxChroma.
    const solid = gamutSolid(src, 24, 14);
    assert.equal(gamutSourceId(solid.limit), src.id, 'the solid must record the source it was built from, keyed by id');
    assert.ok(solid.maxRadius > 0 && solid.maxRadius < maxChroma(0.7, 100, 'srgb') * 2, `press solid radius out of range: ${solid.maxRadius}`);
    assert.equal(
      projectSolidPoint(solid, { l: 0.55, c: 0.06, h: 30 }, { yaw: 0.4, pitch: 0.3 }).inside, true,
      'a printable marker must report inside the solid it is drawn against',
    );
  });
});

test('the same profile gives the same answer every time (pure, no cached state)', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const a = iccGamutSource(p, 'relative');
    const b = iccGamutSource(parseIccProfile(new Uint8Array(readFileSync(CMYK_PATH)))!, 'relative');
    assert.equal(a.id, b.id, 'two reads of one file must produce one identity');
    for (const h of [10, 90, 200, 330]) {
      assert.equal(maxChroma(0.6, h, a), maxChroma(0.6, h, b), `ceiling at h=${h} must not depend on which parse it came from`);
    }
  });
});

test('ink coverage is in channels, not normalised — and null for additive light', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const src = iccGamutSource(p, 'relative');
    const ink = src.inkCoverage!(0.35, 0.05, 250);
    assert.ok(ink !== null && ink > 0 && ink <= 4, `four-ink coverage must be 0–4 (400% TAC), got ${ink}`);
    // Same colour asked of a display gamut: the question does not apply, and the
    // answer must say so rather than read as "needs no ink".
    assert.equal(inGamut(0.35, 0.05, 250, 'srgb'), true, 'sanity: the probe colour is displayable');
  });
});

test('an intent the profile does not carry contains nothing rather than guessing', (t) => {
  withProfile(`${SYS}Generic Lab Profile.icc`, t, (p) => {
    assert.equal(p.hasIntent('saturation'), false, 'fixture must be a profile without a saturation table');
    const src = iccGamutSource(p, 'saturation');
    assert.equal(inGamut(0.5, 0.05, 30, src), false, 'a missing intent must answer false, not fall back to another table');
    assert.equal(maxChroma(0.5, 30, src), 0, 'a missing intent must give no chroma at all');
    assert.equal(gamutSolid(src, 12, 8).maxRadius, 0, 'a solid of nothing must have radius 0, not a default scale');
  });
});

// ─── host.color, the surface a tool sees ──────────────────────────────────────

test('host.color.iccProfile → the three profile queries', (t) => {
  withProfile(CMYK_PATH, t, () => {
    const api = makeColorApi();
    const handle = api.iccProfile!(new Uint8Array(readFileSync(CMYK_PATH)));
    assert.ok(handle, 'a stock CMYK profile must produce a handle');
    assert.equal(handle.colourSpace, 'CMYK');
    assert.equal(handle.deviceClass, 'prtr', 'a press profile must report the printer device class');
    assert.equal(handle.channels, 4);
    assert.equal(handle.intent, 'relative', 'the default intent must be relative colorimetric');
    assert.equal(handle.usable, true);
    assert.ok(handle.id.startsWith('icc:'), `handle id must be the source identity, got ${handle.id}`);

    assert.equal(api.inProfileGamut!(handle, 0.55, 0.06, 30), true, 'a muted mid tone must print');
    assert.equal(api.inProfileGamut!(handle, 0.55, 0.30, 30), false, 'chroma 0.30 must not print');
    assert.equal(
      api.profileMaxChroma!(handle, 0.55, 30), maxChroma(0.55, 30, iccGamutSource(parseIccProfile(new Uint8Array(readFileSync(CMYK_PATH)))!, 'relative')),
      'the tool-facing ceiling must be the engine ceiling, not a second implementation',
    );
    const ink = api.inkCoverage!(handle, 0.35, 0.05, 250);
    assert.ok(ink !== null && ink > 0, `inkCoverage must report coverage for a press profile, got ${ink}`);
  });
});

test('a profile with no reverse transform reports usable:false rather than an empty gamut', () => {
  // A2B0 only: device → Lab exists, so `hasIntent` says yes, but membership goes
  // through fromLab and there is nothing to invert. Reporting `usable: true` here
  // promises an answer the queries can only give as "nothing at all is printable"
  // - a caller told to gate on `usable` then draws a chart of nothing and cannot
  // tell it apart from a press that reproduces nothing.
  const api = makeColorApi();
  const handle = api.iccProfile!(oneWayProfileBytes(), 'perceptual');
  assert.ok(handle, 'the fixture must still parse as a profile');
  assert.equal(handle.usable, false,
    'a profile that cannot answer a membership question must advertise usable:false, not an empty gamut behind a valid label');
  assert.equal(api.inProfileGamut!(handle, 0.5, 0, 0), false, 'and every query gives its no-answer value');
  assert.equal(api.profileMaxChroma!(handle, 0.5, 120), 0, 'including the ceiling');
});

test('the stock abstract profiles do not advertise a gamut to a tool', (t) => {
  // The real files of that shape. An `abst` profile has no device gamut at all.
  const path = '/Library/ColorSync/Profiles/Sepia Tone.icc';
  if (!existsSync(path)) {
    t.skip(`stock abstract profile not on this machine: ${path}`);
    return;
  }
  const bytes = new Uint8Array(readFileSync(path));
  const p = parseIccProfile(bytes)!;
  assert.ok(p.hasIntent('perceptual'), 'precondition: Sepia Tone carries A2B0 and no B2A0');
  const handle = makeColorApi().iccProfile!(bytes, 'perceptual');
  assert.ok(handle, 'the profile parses');
  assert.equal(handle.usable, false,
    'an abstract profile must not advertise itself as a gamut a tool can query');
});

test('a handle the host did not issue gets the no-answer result, never an answer', () => {
  const api = makeColorApi();
  // Shaped exactly like a real handle, including a plausible id - the point is
  // that shape is not authority: the tables live in the host, keyed by object
  // identity, so a forged handle cannot borrow some other profile's answers.
  const forged = {
    id: 'icc:0000000000000000:relative', label: 'Forged', deviceClass: 'prtr',
    colourSpace: 'CMYK', channels: 4, intent: 'relative' as const, version: '2.2.0', usable: true,
  };
  assert.equal(api.inProfileGamut!(forged, 0.5, 0.05, 30), false, 'a forged handle must not report membership');
  assert.equal(api.profileMaxChroma!(forged, 0.5, 30), 0, 'a forged handle must give no ceiling');
  assert.equal(api.inkCoverage!(forged, 0.5, 0.05, 30), null, 'a forged handle must give no ink figure');
});

test('the inert profile handle passed where a SOURCE belongs answers nothing, and never throws', (t) => {
  withProfile(CMYK_PATH, t, () => {
    const api = makeColorApi();
    const handle = api.iccProfile!(new Uint8Array(readFileSync(CMYK_PATH)))!;
    // The natural mistake: the handle carries an id, a label and usable:true, so it
    // reads source-like, but the tables stay in the host and it has no `contains`.
    // The three limit-taking queries must degrade to their no-answer values rather
    // than throw out of the hook that asked - from beforeExport, a failed export.
    assert.equal(api.maxChroma!(0.55, 30, handle as never), 0,
      'a limit that is not a gamut source must give no ceiling, not a TypeError');
    const img = api.slice!({ plane: 'ch', fixed: 0.55, width: 8, height: 8, limit: handle as never });
    assert.ok(img.data.every((v) => v === 0),
      'every pixel of a slice against a non-source must stay transparent — nothing is in gamut');
    const region = api.gamutRegion!('ch', 0.55, handle as never);
    assert.ok(region.every((ring) => ring.every((pt) => pt.y === 1)),
      'and its boundary must collapse onto the zero-chroma edge rather than draw sRGB under a press label');
    // The handle-keyed queries are the ones that DO work with a handle, and must
    // keep working - the guard above must not have made every handle inert.
    assert.equal(api.inProfileGamut!(handle, 0.55, 0.06, 30), true,
      'the handle still answers through the query built for it');
  });
});

test('host.color.iccProfile returns null for bytes that are not a profile', () => {
  const api = makeColorApi();
  assert.equal(api.iccProfile!(new Uint8Array(0)), null, 'empty input must be null, not a throw');
  assert.equal(api.iccProfile!(new Uint8Array(400)), null, 'zero-filled bytes carry no acsp signature');
  assert.equal(api.iccProfile!(new Uint8Array([1, 2, 3])), null, 'a three-byte buffer must be null');
});

test('an unknown intent string falls back to relative rather than indexing a prototype key', (t) => {
  withProfile(CMYK_PATH, t, () => {
    const api = makeColorApi();
    const bytes = new Uint8Array(readFileSync(CMYK_PATH));
    for (const bogus of ['constructor', 'toString', 'perceptualish', '']) {
      const h = api.iccProfile!(bytes, bogus as never);
      assert.ok(h, `an unknown intent must still parse: ${bogus}`);
      assert.equal(h.intent, 'relative', `an unknown intent must fall back to relative, not ${bogus}`);
    }
  });
});

test('ICC_GAMUT_DELTA_E is the documented dial, not an accident', () => {
  assert.equal(ICC_GAMUT_DELTA_E, 3.0, 'the membership threshold is a documented constant; changing it changes every chart');
});

// ─── the ceiling grid stands in for `contains` ────────────────────────────────

/**
 * The slice painter no longer calls a profile's `contains` per pixel - it tests
 * `c <= sampleCeiling(grid, l, h)` against that source's own ceiling grid, which
 * is what took a profile chart from ~85 ms to the RGB path's cost. The trade is
 * an assumption (a gamut is an interval in chroma at fixed L and h) plus grid
 * interpolation error, so this pins the substitution against the real thing on a
 * real CMYK profile: every pixel the painter draws must be one `contains` would
 * have accepted, to within one grid cell of the boundary.
 */
test('grid-based slice membership agrees with the profile’s own contains', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const src = iccGamutSource(p, 'relative');
    const W = 96, H = 60, cMax = 0.4;
    for (const [plane, fixed] of [['lc', 120], ['ch', 0.6]] as const) {
      const img = oklchSlice({ plane, fixed, width: W, height: H, cMax, limit: src });
      // One grid cell, in the units of whichever axis carries chroma here.
      const cellC = cMax * (plane === 'lc' ? 1 / W : 1 / H);
      let checked = 0, disagreed = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
          const l = plane === 'lc' ? v : fixed;
          const c = plane === 'lc' ? u * cMax : v * cMax;
          const h = plane === 'lc' ? fixed : u * 360;
          const painted = img.data[(y * W + x) * 4 + 3] !== 0;
          if (painted === src.contains(l, c, h)) { checked++; continue; }
          // A disagreement is only allowed within one cell of the boundary: the
          // exact ceiling has to be near this pixel's chroma.
          const edge = maxChroma(l, h, src);
          assert.ok(
            Math.abs(c - edge) <= cellC * 2.5,
            `${plane} pixel (${x},${y}) l=${l.toFixed(3)} c=${c.toFixed(4)} h=${h.toFixed(1)}: `
            + `painted=${painted}, contains=${!painted}, exact ceiling ${edge.toFixed(4)}`,
          );
          disagreed++;
        }
      }
      assert.ok(checked > W * H * 0.9, `${plane}: ${disagreed} of ${W * H} pixels differed — too many`);
    }
  });
});

// ─── the round-trip ΔE as a readable quantity ─────────────────────────────────

test('iccRoundTripDeltaE is the number the membership threshold is applied to', (t) => {
  withProfile(CMYK_PATH, t, (p) => {
    const src = iccGamutSource(p, 'relative');
    // Spread across the space rather than at chosen points: whatever the profile
    // says, `contains` must be exactly "the shift is within tolerance".
    for (const l of [0.25, 0.5, 0.75]) {
      for (const c of [0.02, 0.1, 0.2, 0.3]) {
        for (const h of [20, 100, 200, 300]) {
          const de = iccRoundTripDeltaE(p, 'relative', l, c, h);
          assert.equal(typeof de, 'number', `no ΔE at ${l}/${c}/${h}`);
          assert.equal(
            src.contains(l, c, h), de! <= ICC_GAMUT_DELTA_E,
            `contains disagrees with ΔE ${de!.toFixed(2)} at l=${l} c=${c} h=${h}`,
          );
        }
      }
    }
    // Not a colour, and an intent the profile cannot answer: null, never a number.
    assert.equal(iccRoundTripDeltaE(p, 'relative', Number.NaN, 0.1, 100), null);
    assert.equal(iccRoundTripDeltaE(p, 'relative', 1.5, 0.1, 100), null);
  });
});

test('iccRoundTripDeltaE declines an intent the profile has no table for', () => {
  const p = parseIccProfile(oneWayProfileBytes());
  assert.ok(p, 'the one-way fixture parses');
  for (const intent of ['perceptual', 'relative', 'saturation', 'absolute'] as const) {
    assert.equal(iccRoundTripDeltaE(p!, intent, 0.5, 0.1, 120), null);
  }
});


test('iccRoundTripDecides tells apart the profiles the ΔE actually decides', (t) => {
  // A matrix/TRC profile has no B2A table, so `fromLab` clips into the device cube
  // and the round trip is near zero well OUTSIDE the gamut - `contains` tests the
  // cube instead. Anything showing the ΔE beside a verdict has to gate on this, or
  // it prints "outside, ΔE 0.0" under "in gamut is decided by ΔE 3.0".
  const matrix = parseIccProfile(srgbIccProfile());
  assert.ok(matrix, 'the engine\'s own sRGB profile parses');
  assert.equal(iccRoundTripDecides(matrix!), false);

  // …and a LUT profile is the case the sentence is true of.
  withProfile(CMYK_PATH, t, (p) => {
    assert.equal(iccRoundTripDecides(p), true);
  });
});

test('a matrix profile refuses colours whose round trip is well inside the tolerance', () => {
  // The evidence the readout gating exists for: outside by the cube test, tiny by
  // ΔE. If this ever stops finding one, the two tests above have gone stale.
  const p = parseIccProfile(srgbIccProfile())!;
  const src = iccGamutSource(p, 'relative');
  let found = 0;
  for (let l = 0.05; l < 1; l += 0.1) {
    for (let c = 0.05; c < 0.4; c += 0.05) {
      for (let h = 0; h < 360; h += 30) {
        const de = iccRoundTripDeltaE(p, 'relative', l, c, h);
        if (!src.contains(l, c, h) && de != null && de <= ICC_GAMUT_DELTA_E) found++;
      }
    }
  }
  assert.ok(found > 0, 'no colour is refused by the cube while passing the ΔE — gating would be moot');
});
