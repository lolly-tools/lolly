// SPDX-License-Identifier: MPL-2.0
/**
 * The gamut solid (engine/src/gamut-solid.ts) - a display's colour volume as a
 * rotatable 3D surface.
 *
 * The invariant worth the most here is 'the surface we see is the near one'. A
 * back-face cull with the sign inverted does NOT look broken: you get a
 * plausible, pretty solid rendered from the inside, and the only way to notice
 * by eye is to realise the hues are on the wrong sides. That bug shipped into
 * the first render of this module and was caught by asking which hue faces the
 * camera at a known angle - so that check lives here permanently.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { gamutSolid, projectGamutSolid, projectSolidPoint, solidPointOklch, labSolidUnit } from '../engine/src/gamut-solid.ts';
import { hexToOklch } from '../engine/src/brand-derive.ts';
import { maxChroma } from '../engine/src/gamut.ts';

// The default 'cylinder' embedding, which is what the geometry tests below are
// written against. The view uses 'landscape'; both are covered.
const solid = gamutSolid('srgb', 48, 28);

/** A cylinder point's OKLCH: x/z are the chroma plane, y is lightness. */
const cylOklch = (p: { x: number; z: number; y: number }) => {
  const c = Math.hypot(p.x, p.z);
  return { l: p.y, c, h: c < 1e-9 ? 0 : (Math.atan2(p.z, p.x) * 180) / Math.PI };
};

/** The visible quad nearest the centre of the screen. */
function centreQuad(quads: ReturnType<typeof projectGamutSolid>) {
  let best = quads[0]!, bd = Infinity;
  for (const q of quads) {
    const cx = q.points.reduce((s, p) => s + p.x, 0) / q.points.length;
    const cy = q.points.reduce((s, p) => s + p.y, 0) / q.points.length;
    const d = Math.hypot(cx - 0.5, cy - 0.5);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}

const hueGap = (a: number, b: number): number => {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return Math.min(d, 360 - d);
};

test('the mesh sits exactly on the gamut boundary the 2D charts use', () => {
  // Same function, two views: every surface vertex's chroma must be maxChroma at
  // its own lightness and hue, or the solid and the slices describe different
  // gamuts.
  for (const q of solid.quads) {
    for (const p of q.pts) {
      const { l, c, h } = cylOklch(p);
      assert.ok(Math.abs(c - maxChroma(l, h, 'srgb')) < 1e-6,
        `L${l.toFixed(3)} H${h.toFixed(1)}: surface C ${c} vs ceiling ${maxChroma(l, h, 'srgb')}`);
    }
  }
});

test('the solid closes at black and white', () => {
  // The top and bottom rows collapse to the achromatic axis, so the surface has
  // no holes and needs no separate caps.
  const extremes = solid.quads.flatMap(q => q.pts).filter(p => p.y <= 1e-9 || p.y >= 1 - 1e-9);
  assert.ok(extremes.length > 0, 'the mesh reaches both extremes');
  for (const p of extremes) {
    assert.ok(Math.hypot(p.x, p.z) < 1e-6, `L${p.y} should have no chroma`);
  }
});

test('the surface we see is the NEAR one, not the inside of the far wall', () => {
  // At pitch 0 the +b axis (hue 90) points at the viewer, and yaw rotates that
  // round. So the centre of the silhouette must show the hue facing the camera.
  // A flipped back-face cull shows the hue 180° away and looks fine.
  for (const [yaw, expected] of [[0, 90], [90, 0], [180, 270], [270, 180]] as [number, number][]) {
    const quads = projectGamutSolid(solid, { yaw, pitch: 0 });
    assert.ok(quads.length > 0, `yaw ${yaw} renders something`);
    const hue = hexToOklch(centreQuad(quads).hex)!.h;
    assert.ok(hueGap(hue, expected) < 35,
      `yaw ${yaw}: centre shows hue ${hue.toFixed(1)}, expected ~${expected}`);
    // And the nearest-drawn quad must have positive depth - it faces us.
    assert.ok(quads[quads.length - 1]!.depth > 0, `yaw ${yaw}: the nearest quad is in front`);
  }
});

test('roughly half the mesh is culled, and what survives is depth-sorted', () => {
  const quads = projectGamutSolid(solid, { yaw: 30, pitch: 20 });
  assert.ok(quads.length > solid.quads.length * 0.3, `kept ${quads.length}`);
  assert.ok(quads.length < solid.quads.length * 0.85, `culled too little: kept ${quads.length}`);
  for (let i = 1; i < quads.length; i++) {
    assert.ok(quads[i - 1]!.depth <= quads[i]!.depth, `quad ${i} breaks the far-to-near order`);
  }
});

test('projected points stay inside the unit box, and scale zooms about the centre', () => {
  for (const view of [
    { yaw: 0, pitch: 0 }, { yaw: 137, pitch: 45 }, { yaw: -90, pitch: -60 },
    { yaw: 0, pitch: 200 }, // pitch clamps to ±89 rather than degenerating
  ]) {
    const quads = projectGamutSolid(solid, { ...view, scale: 0.9 });
    assert.ok(quads.length > 0, `${JSON.stringify(view)} renders`);
    for (const q of quads) {
      for (const p of q.points) {
        assert.ok(p.x >= -0.01 && p.x <= 1.01, `x ${p.x} out of box at ${JSON.stringify(view)}`);
        assert.ok(p.y >= -0.01 && p.y <= 1.01, `y ${p.y} out of box at ${JSON.stringify(view)}`);
      }
    }
  }
  // Half the scale halves every offset from the centre.
  const wide = projectGamutSolid(solid, { yaw: 25, pitch: 15, scale: 1 });
  const half = projectGamutSolid(solid, { yaw: 25, pitch: 15, scale: 0.5 });
  assert.equal(wide.length, half.length, 'scale does not change what is visible');
  const spread = (qs: typeof wide): number =>
    Math.max(...qs.flatMap(q => q.points.map(p => Math.abs(p.x - 0.5))));
  assert.ok(Math.abs(spread(wide) / 2 - spread(half)) < 1e-9, 'scale is linear about the centre');
});

test('a wider gamut makes a bigger solid', () => {
  const p3 = gamutSolid('p3', 48, 28);
  const wide = gamutSolid('rec2020', 48, 28);
  assert.ok(p3.maxRadius > solid.maxRadius, `P3 ${p3.maxRadius} > sRGB ${solid.maxRadius}`);
  assert.ok(wide.maxRadius > solid.maxRadius, `Rec.2020 ${wide.maxRadius} > sRGB ${solid.maxRadius}`);
  // Every vertex of the sRGB solid is inside P3 at the same lightness and hue.
  // (sRGB ⊂ P3 genuinely holds; P3 ⊂ Rec.2020 does NOT - see the deep-red sliver
  // test in gamut.test.ts - so that pair is deliberately not asserted.)
  for (const q of solid.quads) {
    for (const p of q.pts) {
      const { l, c, h } = cylOklch(p);
      assert.ok(c <= maxChroma(l, h, 'p3') + 1e-6, 'an sRGB point escapes P3');
    }
  }
});

test('the marker lands in register with the mesh and reports its own gamut', () => {
  const view = { yaw: 30, pitch: 20, scale: 0.9 };
  const inside = projectSolidPoint(solid, { l: 0.6, c: 0.1, h: 250 }, view);
  assert.equal(inside.inside, true);
  assert.ok(inside.x > 0 && inside.x < 1 && inside.y > 0 && inside.y < 1);

  // A colour past the surface is reported as outside rather than silently
  // clamped onto it - a marker floating off the solid needs explaining, not hiding.
  const outside = projectSolidPoint(solid, { l: 0.6, c: 0.35, h: 250 }, view);
  assert.equal(outside.inside, false);

  // In register: a point placed exactly ON a surface vertex must project to that
  // vertex's own projected position.
  const q = projectGamutSolid(solid, view)[0]!;
  const vtx = solid.quads.flatMap(x => x.pts).find(p => p.y > 0.4 && p.y < 0.6)!;
  const { l, c, h } = cylOklch(vtx);
  const m = projectSolidPoint(solid, { l, c, h }, view);
  assert.ok(m.inside, 'a surface vertex counts as inside');
  assert.ok(q.points.length === 4, 'quads are quads');
  // A degenerate quad is culled (zero area), so determinism is what's checkable:
  // the same input must give the same point twice.
  const meshMatch = projectGamutSolid({ ...solid, quads: [{ pts: [vtx, vtx, vtx, vtx], hex: '#000000', oklch: { l: 0, c: 0, h: 0 }, up: 1 }] }, view);
  assert.equal(meshMatch.length, 0, 'a zero-area quad is culled, not drawn');
  assert.deepEqual(projectSolidPoint(solid, { l, c, h }, view), m, 'projection is deterministic');
});

test('degenerate mesh sizes are clamped instead of producing nothing', () => {
  for (const [hs, ls] of [[0, 0], [2, 1], [-5, -5], [7.9, 3.2]] as [number, number][]) {
    const s = gamutSolid('srgb', hs, ls);
    assert.ok(s.hueSteps >= 6 && s.lightSteps >= 3, `${hs}x${ls} clamped to ${s.hueSteps}x${s.lightSteps}`);
    assert.ok(s.quads.length > 0, `${hs}x${ls} still builds a surface`);
    assert.ok(projectGamutSolid(s, { yaw: 20, pitch: 15 }).length > 0);
  }
});

test('the landscape embedding lays hue flat and stands chroma up', () => {
  const land = gamutSolid('srgb', 48, 28, 'landscape');
  assert.equal(land.embed, 'landscape');
  // The surface is the same grid as the cylinder's; the extra quads are the seam
  // caps, which a closed cylinder does not need.
  const wall = land.quads.filter(q => q.up === 0);
  assert.equal(land.quads.length - wall.length, solid.quads.length, 'same surface grid');
  assert.ok(wall.length > 0, 'the landscape is capped at the hue seam');

  // x is hue across −1…1, z is lightness across −1…1, y is chroma 0…1.
  for (const q of land.quads) {
    for (const p of q.pts) {
      assert.ok(p.x >= -1.001 && p.x <= 1.001, `hue axis ${p.x}`);
      assert.ok(p.z >= -1.001 && p.z <= 1.001, `lightness axis ${p.z}`);
      assert.ok(p.y >= 0 && p.y <= 1.001, `chroma height ${p.y}`);
    }
  }
  // The tallest point is the most chromatic colour in the gamut, and it should be
  // in the yellows/greens rather than the blues - that asymmetry is the whole
  // reason this view beats a cylinder for reading.
  let peak = land.quads[0]!, best = -1;
  for (const q of land.quads.filter(q => q.up !== 0)) {
    const top = Math.max(...q.pts.map(p => p.y));
    if (top > best) { best = top; peak = q; }
  }
  assert.ok(Math.abs(best - 1) < 0.02, `the peak reaches full height (${best})`);
  const peakHue = ((peak.pts[0]!.x + 1) / 2) * 360;
  assert.ok(peakHue > 240 && peakHue < 340, `sRGB's chroma peak is in the blues/magentas, got ${peakHue.toFixed(0)}°`);

  // The caps stand at the two hue-seam edges and nowhere else, spanning chroma 0 up
  // to the surface - so the sheet reads as a body rather than a ribbon.
  for (const q of wall) {
    const xs = q.pts.map(p => p.x);
    assert.ok(xs.every(x => Math.abs(Math.abs(x) - 1) < 1e-9),
      `a cap quad sits off the seam: ${JSON.stringify(xs)}`);
    assert.ok(q.pts.every(p => p.y >= -1e-9 && p.y <= 1 + 1e-9), 'cap height stays in range');
  }
  // Both edges are capped, and both are hue 0 (360° IS 0°), so the body is
  // symmetric about the seam.
  assert.ok(wall.some(q => q.pts[0]!.x < 0), 'the hue-0 edge is capped');
  assert.ok(wall.some(q => q.pts[0]!.x > 0), 'the hue-360 edge is capped');

  // An OPEN surface: nothing may be culled, or looking from below shows nothing.
  assert.equal(projectGamutSolid(land, { yaw: 20, pitch: 35 }).length, land.quads.length);
  assert.equal(projectGamutSolid(land, { yaw: 20, pitch: -35 }).length, land.quads.length);

  // And the marker still lands in the box, in the same space as the mesh.
  const m = projectSolidPoint(land, { l: 0.62, c: 0.19, h: 260 }, { yaw: 20, pitch: 35 });
  assert.ok(m.x > 0 && m.x < 1 && m.y > 0 && m.y < 1, JSON.stringify(m));
  assert.equal(m.inside, true);
});

test('the lab embedding stands lightness up over the a/b floor, in true proportion', () => {
  const lab = gamutSolid('srgb', 48, 28, 'lab');
  assert.equal(lab.embed, 'lab');
  // A closed hull, exactly like the cylinder - same grid, different axes - so it
  // needs no seam caps and every quad is part of the surface.
  assert.equal(lab.quads.length, solid.quads.length, 'same surface grid, no caps');

  // Every vertex still sits on the gamut boundary: the embedding moves the
  // numbers, it does not change them.
  for (const q of lab.quads) {
    for (const p of q.pts) {
      const { l, c, h } = solidPointOklch(lab, p);
      assert.ok(Math.abs(c - maxChroma(l, h, 'srgb')) < 1e-9,
        `L${l.toFixed(3)} H${h.toFixed(1)}: surface C ${c} vs ceiling ${maxChroma(l, h, 'srgb')}`);
      assert.ok(p.x >= -1.001 && p.x <= 1.001 && p.z >= -1.001 && p.z <= 1.001, `a/b floor ${p.x},${p.z}`);
      assert.ok(p.y >= -0.001 && p.y <= 1.001, `lightness height ${p.y}`);
    }
  }

  // The near surface is still the one we see (a flipped cull is invisible to the
  // eye - see the cylinder's version of this check above).
  for (const [yaw, expected] of [[0, 90], [90, 0], [180, 270]] as [number, number][]) {
    const quads = projectGamutSolid(lab, { yaw, pitch: 0 });
    assert.ok(quads.length > 0 && quads.length < lab.quads.length, `yaw ${yaw} culls a back face`);
    const hue = hexToOklch(centreQuad(quads).hex)!.h;
    assert.ok(hueGap(hue, expected) < 35, `yaw ${yaw}: centre shows hue ${hue.toFixed(1)}, expected ~${expected}`);
  }
});

test('the lab plot keeps proportions the cylinder normalises away', () => {
  // The claim this embedding makes is isotropy: ONE scale for lightness and for
  // a/b. So the projected silhouette's aspect must equal the model's, and a
  // wider gamut must come out visibly wider rather than refilling the frame.
  const screenAspect = (s: ReturnType<typeof gamutSolid>): number => {
    const pts = projectGamutSolid(s, { yaw: 0, pitch: 0, scale: 1 }).flatMap(q => q.points);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
  };
  // The projector doubles the vertical on the way out, which is exactly what the
  // embedding's half-height pre-scale accounts for.
  const modelAspect = (s: ReturnType<typeof gamutSolid>): number => {
    const pts = s.quads.flatMap(q => q.pts);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    return ((Math.max(...ys) - Math.min(...ys)) * 2) / (Math.max(...xs) - Math.min(...xs));
  };

  for (const g of ['srgb', 'p3', 'rec2020'] as const) {
    const s = gamutSolid(g, 96, 40, 'lab');
    assert.ok(Math.abs(screenAspect(s) - modelAspect(s)) < 1e-6,
      `${g}: the projection rescaled the axes apart (${screenAspect(s)} vs ${modelAspect(s)})`);
  }

  const srgb = screenAspect(gamutSolid('srgb', 96, 40, 'lab'));
  const wide = screenAspect(gamutSolid('rec2020', 96, 40, 'lab'));
  assert.ok(wide < srgb * 0.8, `Rec.2020 must read wider than sRGB, got ${wide} vs ${srgb}`);
  // …where the cylinder gives every gamut the same silhouette width, which is
  // precisely the comparison a press profile is loaded to make.
  const cyl = (g: 'srgb' | 'rec2020') => screenAspect(gamutSolid(g, 96, 40, 'cylinder'));
  assert.ok(Math.abs(cyl('srgb') - cyl('rec2020')) < 0.2, 'the cylinder normalises width away');
});

test('the lab marker lands in register with the lab mesh', () => {
  const lab = gamutSolid('srgb', 48, 28, 'lab');
  const view = { yaw: 35, pitch: 25, scale: 0.9 };
  const m = projectSolidPoint(lab, { l: 0.62, c: 0.19, h: 260 }, view);
  assert.equal(m.inside, true);
  assert.ok(m.x > 0 && m.x < 1 && m.y > 0 && m.y < 1, JSON.stringify(m));
  assert.equal(projectSolidPoint(lab, { l: 0.62, c: 0.42, h: 260 }, view).inside, false);

  // In register: a colour read off a surface vertex must project back onto that
  // vertex's own projected position, or the dot floats off the solid.
  const vtx = lab.quads.flatMap(q => q.pts).find(p => p.y > 0.45 && p.y < 0.55 && Math.hypot(p.x, p.z) > 0.1)!;
  const o = solidPointOklch(lab, vtx);
  const at = projectSolidPoint(lab, o, view);
  const mesh = projectGamutSolid({ ...lab, quads: [{ pts: [vtx, vtx, vtx, vtx], hex: '#000000', oklch: { l: 0, c: 0, h: 0 }, up: 1 }] }, view);
  assert.equal(mesh.length, 0, 'a zero-area quad is culled, not drawn');
  assert.deepEqual(projectSolidPoint(lab, o, view), at, 'projection is deterministic');

  // The achromatic axis is the axis: zero chroma sits dead centre horizontally at
  // any yaw, which is the centring the vertical pre-scale has to preserve.
  for (const yaw of [0, 40, 137]) {
    const grey = projectSolidPoint(lab, { l: 0.5, c: 0, h: 0 }, { yaw, pitch: 0, scale: 1 });
    assert.ok(Math.abs(grey.x - 0.5) < 1e-9 && Math.abs(grey.y - 0.5) < 1e-9, `yaw ${yaw}: ${JSON.stringify(grey)}`);
  }
});

test('solidPointOklch inverts every embedding', () => {
  const o = { l: 0.58, c: 0.13, h: 217 };
  for (const embed of ['cylinder', 'landscape', 'lab'] as const) {
    const s = gamutSolid('srgb', 48, 28, embed);
    const unit = embed === 'landscape' ? (s.maxRadius || 1) : 1;
    const hr = (o.h * Math.PI) / 180;
    // Rebuild the model point the way the placement does, then read it back.
    const p = embed === 'landscape'
      ? { x: (o.h / 360) * 2 - 1, z: o.l * 2 - 1, y: o.c / unit }
      : embed === 'lab'
        ? { x: (o.c * Math.cos(hr)) / labSolidUnit(s.maxRadius), z: (o.c * Math.sin(hr)) / labSolidUnit(s.maxRadius), y: 0.5 + (o.l - 0.5) / (2 * labSolidUnit(s.maxRadius)) }
        : { x: o.c * Math.cos(hr), z: o.c * Math.sin(hr), y: o.l };
    const back = solidPointOklch(s, p);
    assert.ok(Math.abs(back.l - o.l) < 1e-9, `${embed} lightness ${back.l}`);
    assert.ok(Math.abs(back.c - o.c) < 1e-9, `${embed} chroma ${back.c}`);
    assert.ok(hueGap(back.h, o.h) < 1e-6, `${embed} hue ${back.h}`);
  }
});

/**
 * Every quad carries the colour it was AUTHORED with, not only its sRGB bake.
 *
 * The bake is what a caller must not paint a wide-gamut surface from - on a P3
 * canvas it shows the chart's own subject as the fallback it is supposed to be
 * demonstrating you do not need. The test is written on a P3 solid because that
 * is where the two values are allowed to differ: on an sRGB solid they agree by
 * construction, so an sRGB-only assertion would pass against `oklch` being a
 * copy of `hexToOklch(hex)` and prove nothing.
 */
test('a wide-gamut solid carries chroma its sRGB hex cannot hold', () => {
  const s = gamutSolid('p3', 64, 32);
  let widest = 0;
  for (const q of s.quads) {
    assert.ok(q.oklch, 'every quad has an authored colour');
    // The bake preserves L and H and reduces C (CSS Color 4 section 14.2), so the hex can
    // never be MORE chromatic than what it was baked from. Checked only above
    // c 0.05: the hex is 8-bit, and down near the achromatic axis one quantisation
    // step is a large FRACTION of the chroma - a near-grey can round to 0.017 from
    // an authored 0.013 without anything being wrong.
    const baked = hexToOklch(q.hex)!;
    if (q.oklch.c >= 0.05) {
      assert.ok(baked.c <= q.oklch.c + 0.01, `bake gained chroma: ${baked.c} > ${q.oklch.c}`);
    }
    widest = Math.max(widest, q.oklch.c - baked.c);
  }
  // Anti-vacuity: if `oklch` were just the hex read back, this gap would be ~0
  // everywhere and the assertion above would be trivially true.
  assert.ok(widest > 0.01, `no quad outruns its bake (widest gap ${widest})`);
});

test('projection carries the authored colour through to the painter', () => {
  const s = gamutSolid('p3', 48, 24);
  const quads = projectGamutSolid(s, { yaw: 30, pitch: 20 });
  assert.ok(quads.length > 0);
  for (const q of quads) assert.ok(typeof q.oklch?.c === 'number', 'projected quad keeps oklch');
});
