// SPDX-License-Identifier: MPL-2.0
/**
 * The gamut SOLID — a display's whole reachable colour volume as a rotatable
 * 3D surface in OKLCH.
 *
 * The slice charts in gamut.ts answer "how much room is left at this hue?". They
 * cannot show the shape they are slicing, and that shape is the thing that
 * explains the slices: sRGB in OKLab is not a box or a ball but a lumpy solid
 * with six corners (the RGB cube's corners), pinched at black and white and
 * bulging much further out at yellow than at blue. Once you have turned it once,
 * every horseshoe in the 2D charts stops looking arbitrary.
 *
 * ## What this module does and does not own
 *
 * It builds the surface as a quad mesh, rotates it, and returns depth-sorted 2D
 * polygons with a colour each. There is no canvas, no SVG and no interaction
 * here — a shell paints the polygons it is handed, in whatever surface it likes,
 * and feeds back a yaw/pitch when the user drags. That keeps the 3D maths pure
 * and testable, and means the same solid can be drawn to a canvas in the web
 * shell or to paths in a vector export.
 *
 * Painter's algorithm rather than a depth buffer: the surface is a closed
 * star-shaped-ish hull of a few thousand small quads, so sorting by centroid
 * depth is both correct enough and far cheaper than per-pixel work. Where it
 * would be wrong — long thin quads straddling in depth — the quads are small
 * enough that the error is sub-pixel.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { maxChroma, oklchGamut, gamutWithin } from './gamut.ts';
import type { GamutName } from './gamut.ts';
import { oklchToHex } from './brand-derive.ts';

/** A point in the OKLab-ish solid space: a and b are the chroma plane, l is up. */
export interface SolidPoint { a: number; b: number; l: number }

/** One quad of the surface, with the colour of its own patch of the gamut. */
export interface SolidQuad {
  /** The four corners, in order around the quad. */
  pts: [SolidPoint, SolidPoint, SolidPoint, SolidPoint];
  /** The gamut-mapped sRGB hex of the quad's centre. */
  hex: string;
  /** The surface normal's `l` component — used for shading, and to tell a cap
   *  (facing up or down) from the side wall. */
  up: number;
}

export interface GamutSolid {
  limit: Exclude<GamutName, 'none'>;
  hueSteps: number;
  lightSteps: number;
  quads: SolidQuad[];
  /** The largest chroma anywhere on the surface — the natural scale for a view. */
  maxRadius: number;
}

const TAU = Math.PI * 2;

/**
 * Build the surface of a display gamut in OKLCH.
 *
 * The mesh is a lightness × hue grid: at each (lightness, hue) the surface sits
 * at that pair's maximum chroma, which is exactly `maxChroma` — so the solid and
 * the 2D charts are the same function seen two ways and cannot disagree.
 *
 * `lightSteps` rows span lightness 0…1 inclusive, so the top and bottom rows
 * collapse to the achromatic axis (chroma 0 at black and white) and the solid
 * closes itself without needing separate caps.
 */
export function gamutSolid(
  limit: Exclude<GamutName, 'none'> = 'srgb',
  hueSteps = 48,
  lightSteps = 28,
): GamutSolid {
  const H = Math.max(6, Math.floor(hueSteps));
  const L = Math.max(3, Math.floor(lightSteps));

  // Sample the radius once per (row, hue) — every quad shares its corners with
  // three neighbours, so computing per-quad would run each bisection 4 times.
  const radius: number[][] = [];
  for (let i = 0; i < L; i++) {
    const l = i / (L - 1);
    const row: number[] = [];
    for (let j = 0; j < H; j++) row.push(maxChroma(l, (j / H) * 360, limit));
    radius.push(row);
  }

  const at = (i: number, j: number): SolidPoint => {
    const l = i / (L - 1);
    const ang = ((j % H) / H) * TAU;
    const r = radius[i]![(j % H + H) % H]!;
    return { a: r * Math.cos(ang), b: r * Math.sin(ang), l };
  };

  const quads: SolidQuad[] = [];
  let maxRadius = 0;
  for (const row of radius) for (const r of row) maxRadius = Math.max(maxRadius, r);

  for (let i = 0; i < L - 1; i++) {
    for (let j = 0; j < H; j++) {
      // Wrap the hue seam by taking j+1 modulo H, so the solid is closed all the
      // way round rather than split open at 0°.
      const p0 = at(i, j), p1 = at(i, j + 1), p2 = at(i + 1, j + 1), p3 = at(i + 1, j);
      const cl = (p0.l + p1.l + p2.l + p3.l) / 4;
      const ca = (p0.a + p1.a + p2.a + p3.a) / 4;
      const cb = (p0.b + p1.b + p2.b + p3.b) / 4;
      const c = Math.hypot(ca, cb);
      const h = c < 1e-9 ? 0 : (Math.atan2(cb, ca) * 180) / Math.PI;
      // Pull the sample very slightly inside the surface: dead on the boundary,
      // rounding can push the centre out of gamut and the mapper desaturates the
      // patch, banding the whole silhouette one step duller than it should be.
      const hex = oklchToHex({ l: cl, c: c * 0.995, h });

      // The normal, from the two edge vectors — its `l` component says how much
      // the patch faces up, which is all the shading needs.
      const e1 = { a: p1.a - p0.a, b: p1.b - p0.b, l: p1.l - p0.l };
      const e2 = { a: p3.a - p0.a, b: p3.b - p0.b, l: p3.l - p0.l };
      const nl = e1.a * e2.b - e1.b * e2.a;
      const nMag = Math.hypot(
        e1.b * e2.l - e1.l * e2.b,
        e1.l * e2.a - e1.a * e2.l,
        nl,
      ) || 1;

      quads.push({ pts: [p0, p1, p2, p3], hex, up: nl / nMag });
    }
  }

  return { limit, hueSteps: H, lightSteps: L, quads, maxRadius };
}

// ─── Projection ───────────────────────────────────────────────────────────────

export interface SolidView {
  /** Rotation about the lightness axis, in degrees. */
  yaw: number;
  /** Tilt toward the viewer, in degrees. Clamped to ±89 so the solid never
   *  degenerates to a line. */
  pitch: number;
  /** Zoom. 1 (the default) means the solid exactly fills the unit box at THIS
   *  angle — the fit is measured per view, so it neither overflows at an oblique
   *  pitch nor breathes while the user drags. Below 1 leaves a margin. */
  scale?: number;
}

/** A point in the 0–1 screen box (y DOWN) plus its camera depth. */
interface Projected { x: number; y: number; z: number }

/**
 * The one model→screen transform, shared by the mesh and the "you are here"
 * marker so the two can never drift out of register.
 *
 * Returns screen x/y already mapped into the 0–1 box (y flipped, since screen
 * coordinates run downward) and z as camera depth, larger being nearer.
 */
function makeProjector(solid: GamutSolid, view: SolidView): (p: SolidPoint) => Projected {
  const yaw = (view.yaw * Math.PI) / 180;
  const pitch = (Math.max(-89, Math.min(89, view.pitch)) * Math.PI) / 180;
  const scale = view.scale && view.scale > 0 ? view.scale : 1;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  // Normalise the model: the chroma plane by its widest reach, lightness over
  // its full 0–1 range, centred on 0 so pitch tilts about the solid's middle.
  const rad = solid.maxRadius || 1;

  const raw = (p: SolidPoint): Projected => {
    const a = p.a / rad, b = p.b / rad, l = (p.l - 0.5) * 2;
    const x = a * cy - b * sy;    // spin about the lightness axis
    const zh = a * sy + b * cy;   // depth contribution from the chroma plane
    return {
      x,
      y: l * cp - zh * sp,        // tilt lightness toward the viewer
      z: l * sp + zh * cp,
    };
  };

  // Fit the ROTATED solid, not the model. Both axes reach ±1 before rotation, so
  // an oblique view spans up to √2 — at pitch 45 the naive mapping pushes the
  // silhouette off a box it claimed to fit. Measuring the actual extent per view
  // is what makes `scale: 1` mean "exactly fills the box" at every angle, and it
  // also stops the solid from visibly breathing as the user drags.
  let extent = 1e-6;
  for (const q of solid.quads) {
    for (const p of q.pts) {
      const r = raw(p);
      extent = Math.max(extent, Math.abs(r.x), Math.abs(r.y));
    }
  }

  return (p: SolidPoint): Projected => {
    const r = raw(p);
    return {
      x: 0.5 + (r.x / extent) * (scale / 2),
      y: 0.5 - (r.y / extent) * (scale / 2),
      z: r.z,
    };
  };
}

/** One projected quad, ready to fill. Coordinates are in a 0–1 box, y DOWN. */
export interface ProjectedQuad {
  points: { x: number; y: number }[];
  hex: string;
  /** Camera depth of the centroid — larger is nearer. Already sorted on. */
  depth: number;
  /** 0–1 shading factor from the surface normal, for a lit look. */
  shade: number;
}

/**
 * Rotate and flatten a solid into depth-sorted 2D polygons.
 *
 * Orthographic on purpose. A perspective projection would make the near face
 * larger than the far one, which reads as drama but lies about the shape — and
 * the shape is the entire content of this chart. Orthographic keeps equal
 * chroma equally wide wherever it sits, so the silhouette IS the gamut's
 * cross-section.
 *
 * Back-facing quads are dropped (the surface is closed, so they are never
 * visible), which halves the fill work.
 */
export function projectGamutSolid(solid: GamutSolid, view: SolidView): ProjectedQuad[] {
  const project = makeProjector(solid, view);
  const out: ProjectedQuad[] = [];
  for (const q of solid.quads) {
    const cam = q.pts.map(project);
    // Signed area in screen space tells us which way the quad faces; the mesh is
    // wound consistently, so one sign is the back and can be dropped.
    let area = 0;
    for (let i = 0; i < cam.length; i++) {
      const p = cam[i]!, n = cam[(i + 1) % cam.length]!;
      area += p.x * n.y - n.x * p.y;
    }
    // Back-face cull. Which SIGN means "facing us" follows from the mesh's
    // winding (hue-then-lightness) combined with screen y running downward —
    // easy to get backwards, and a flipped cull is not obviously wrong to the
    // eye: you get a plausible-looking solid seen from the inside. The test
    // 'the surface we see is the near one' pins it against a known view
    // (yaw 0 / pitch 0 must show hue ~90, the +b axis pointing at the viewer).
    if (area <= 0) continue;

    const depth = cam.reduce((s, p) => s + p.z, 0) / cam.length;
    // A soft top-light: patches facing up read brighter. Kept mild (0.82–1) so
    // the chart still shows the real colour rather than a rendering of it.
    const shade = 0.82 + 0.18 * Math.max(0, Math.min(1, (q.up + 1) / 2));
    out.push({
      points: cam.map(p => ({ x: p.x, y: p.y })),
      hex: q.hex,
      depth,
      shade,
    });
  }

  // Painter's algorithm: far first, so nearer quads overwrite them.
  out.sort((p, q) => p.depth - q.depth);
  return out;
}

/**
 * Where a single colour sits inside the projected solid — the marker for "you
 * are here". Uses the same projection as the quads, so it lands in register.
 *
 * `inside` reports whether the colour is within `solid.limit`; a marker outside
 * the surface it is drawn against needs saying so rather than floating
 * unexplained.
 */
export function projectSolidPoint(
  solid: GamutSolid,
  o: { l: number; c: number; h: number },
  view: SolidView,
): { x: number; y: number; depth: number; inside: boolean } {
  const hr = (o.h * Math.PI) / 180;
  const p = makeProjector(solid, view)({
    a: o.c * Math.cos(hr), b: o.c * Math.sin(hr), l: o.l,
  });
  return {
    x: p.x,
    y: p.y,
    depth: p.z,
    inside: gamutWithin(oklchGamut(o.l, o.c, o.h), solid.limit),
  };
}
