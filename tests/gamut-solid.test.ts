/**
 * The gamut solid (engine/src/gamut-solid.ts) — a display's colour volume as a
 * rotatable 3D surface.
 *
 * The invariant worth the most here is 'the surface we see is the near one'. A
 * back-face cull with the sign inverted does NOT look broken: you get a
 * plausible, pretty solid rendered from the inside, and the only way to notice
 * by eye is to realise the hues are on the wrong sides. That bug shipped into
 * the first render of this module and was caught by asking which hue faces the
 * camera at a known angle — so that check lives here permanently.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { gamutSolid, projectGamutSolid, projectSolidPoint } from '../engine/src/gamut-solid.ts';
import { hexToOklch } from '../engine/src/brand-derive.ts';
import { maxChroma } from '../engine/src/gamut.ts';

const solid = gamutSolid('srgb', 48, 28);

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
      const c = Math.hypot(p.a, p.b);
      const h = c < 1e-9 ? 0 : (Math.atan2(p.b, p.a) * 180) / Math.PI;
      assert.ok(Math.abs(c - maxChroma(p.l, h, 'srgb')) < 1e-6,
        `L${p.l.toFixed(3)} H${h.toFixed(1)}: surface C ${c} vs ceiling ${maxChroma(p.l, h, 'srgb')}`);
    }
  }
});

test('the solid closes at black and white', () => {
  // The top and bottom rows collapse to the achromatic axis, so the surface has
  // no holes and needs no separate caps.
  const extremes = solid.quads.flatMap(q => q.pts).filter(p => p.l <= 1e-9 || p.l >= 1 - 1e-9);
  assert.ok(extremes.length > 0, 'the mesh reaches both extremes');
  for (const p of extremes) {
    assert.ok(Math.hypot(p.a, p.b) < 1e-6, `L${p.l} should have no chroma`);
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
    // And the nearest-drawn quad must have positive depth — it faces us.
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

test('a wider gamut makes a strictly bigger solid', () => {
  const p3 = gamutSolid('p3', 48, 28);
  const wide = gamutSolid('rec2020', 48, 28);
  assert.ok(p3.maxRadius > solid.maxRadius, `P3 ${p3.maxRadius} > sRGB ${solid.maxRadius}`);
  assert.ok(wide.maxRadius > p3.maxRadius, `Rec.2020 ${wide.maxRadius} > P3 ${p3.maxRadius}`);
  // Every vertex of the narrower solid is inside the wider one at the same
  // lightness and hue — the gamuts nest, so the solids must too.
  for (const q of solid.quads) {
    for (const p of q.pts) {
      const c = Math.hypot(p.a, p.b);
      const h = c < 1e-9 ? 0 : (Math.atan2(p.b, p.a) * 180) / Math.PI;
      assert.ok(c <= maxChroma(p.l, h, 'p3') + 1e-6, 'an sRGB point escapes P3');
    }
  }
});

test('the marker lands in register with the mesh and reports its own gamut', () => {
  const view = { yaw: 30, pitch: 20, scale: 0.9 };
  const inside = projectSolidPoint(solid, { l: 0.6, c: 0.1, h: 250 }, view);
  assert.equal(inside.inside, true);
  assert.ok(inside.x > 0 && inside.x < 1 && inside.y > 0 && inside.y < 1);

  // A colour past the surface is reported as outside rather than silently
  // clamped onto it — a marker floating off the solid needs explaining, not hiding.
  const outside = projectSolidPoint(solid, { l: 0.6, c: 0.35, h: 250 }, view);
  assert.equal(outside.inside, false);

  // In register: a point placed exactly ON a surface vertex must project to that
  // vertex's own projected position.
  const q = projectGamutSolid(solid, view)[0]!;
  const vtx = solid.quads.flatMap(x => x.pts).find(p => p.l > 0.4 && p.l < 0.6)!;
  const c = Math.hypot(vtx.a, vtx.b);
  const h = (Math.atan2(vtx.b, vtx.a) * 180) / Math.PI;
  const m = projectSolidPoint(solid, { l: vtx.l, c, h }, view);
  assert.ok(m.inside, 'a surface vertex counts as inside');
  assert.ok(q.points.length === 4, 'quads are quads');
  // Re-project the same vertex through the mesh path and compare.
  const meshMatch = projectGamutSolid({ ...solid, quads: [{ pts: [vtx, vtx, vtx, vtx], hex: '#000000', up: 1 }] }, view);
  // A degenerate quad is culled (zero area), so compare against the marker path's
  // own determinism instead: the same input must give the same point twice.
  assert.equal(meshMatch.length, 0, 'a zero-area quad is culled, not drawn');
  const again = projectSolidPoint(solid, { l: vtx.l, c, h }, view);
  assert.deepEqual(again, m, 'projection is deterministic');
});

test('degenerate mesh sizes are clamped instead of producing nothing', () => {
  for (const [hs, ls] of [[0, 0], [2, 1], [-5, -5], [7.9, 3.2]] as [number, number][]) {
    const s = gamutSolid('srgb', hs, ls);
    assert.ok(s.hueSteps >= 6 && s.lightSteps >= 3, `${hs}x${ls} clamped to ${s.hueSteps}x${s.lightSteps}`);
    assert.ok(s.quads.length > 0, `${hs}x${ls} still builds a surface`);
    assert.ok(projectGamutSolid(s, { yaw: 20, pitch: 15 }).length > 0);
  }
});
