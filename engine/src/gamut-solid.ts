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

import { maxChroma, inGamut, encodeOklch, type EncodeSpace } from './gamut.ts';
import type { GamutLimit } from './gamut-source.ts';
import { oklchToHex } from './brand-derive.ts';

/**
 * A point in the model's own space: `x` and `z` are the two horizontal axes,
 * `y` is vertical. What each axis MEANS depends on the embedding — see
 * {@link SolidEmbed}.
 */
export interface SolidPoint { x: number; z: number; y: number }

/** One quad of the surface, with the colour of its own patch of the gamut. */
export interface SolidQuad {
  /** The four corners, in order around the quad. */
  pts: [SolidPoint, SolidPoint, SolidPoint, SolidPoint];
  /** The gamut-mapped sRGB hex of the quad's centre. */
  hex: string;
  /**
   * The centre's colour as AUTHORED, before `hex` clamped it into sRGB.
   *
   * `hex` is a bake and cannot describe a patch of a P3 or Rec.2020 surface — on
   * a wide-gamut display that is exactly the colour the chart exists to show. A
   * caller painting into a wide-gamut surface fills from this; `hex` remains the
   * right answer for an sRGB one, and for a label.
   */
  oklch: { l: number; c: number; h: number };
  /** The surface normal's `l` component — used for shading, and to tell a cap
   *  (facing up or down) from the side wall. */
  up: number;
}

/**
 * How the (lightness, hue, max-chroma) grid is laid out in 3D.
 *
 * `'cylinder'` wraps hue around a vertical lightness axis, chroma outward — the
 * gamut as a lumpy solid you can turn.
 *
 * `'landscape'` lays hue out FLAT along one horizontal axis, lightness along the
 * other, and stands chroma up as height. It reads much better for the question
 * people actually bring: the peaks and troughs per hue are directly comparable
 * (yellow towers, blue barely rises), where on the cylinder the same information
 * is wrapped around the back. It is the same numbers; only the embedding differs.
 *
 * `'lab'` is the ColorSync / iccview picture: the opponent axes a and b on the
 * floor, lightness standing up, and — the part that matters — ONE scale for all
 * three, so the proportions are true. The cylinder normalises chroma by the
 * gamut's own widest reach, which makes every gamut fill the frame identically
 * and quietly destroys the comparison a press profile is loaded to make. In
 * `'lab'` a squat gamut looks squat. Same grid, same numbers, third embedding.
 */
export type SolidEmbed = 'cylinder' | 'landscape' | 'lab';

/**
 * The model-space size of one unit of OKLab distance in the `'lab'` embedding.
 *
 * Lightness spans 1 and chroma spans at most `2·maxRadius` (~0.64 for sRGB), so
 * lightness is normally the longer axis and sets the unit; a source that reaches
 * further than L does widens it instead, keeping the model inside its ±1 box.
 * Isotropy is the whole point — divide both axes by the SAME number or the plot
 * is a cylinder with extra steps.
 */
export function labSolidUnit(maxRadius: number): number {
  return Math.max(0.5, maxRadius || 0);
}

/** One (lightness, chroma, hue-angle) sample placed in the `'lab'` embedding. */
function labPoint(l: number, c: number, ang: number, unit: number): SolidPoint {
  return {
    x: (c * Math.cos(ang)) / unit,
    z: (c * Math.sin(ang)) / unit,
    // Centred on 0.5 like every other embedding's vertical, and HALVED because
    // the projector doubles the vertical on the way out (`(y − 0.5) · 2`). After
    // that round trip one lightness unit and one chroma unit are the same length
    // on screen, which is the whole claim this embedding makes.
    y: 0.5 + (l - 0.5) / (2 * unit),
  };
}

export interface GamutSolid {
  /** The gamut this surface is of — a name, or the source it was built from.
   *  Cache solids by `gamutSourceId(limit)`, never by interpolating this into a
   *  string: a source stringifies to '[object Object]' and collides. */
  limit: GamutLimit;
  embed: SolidEmbed;
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
  limit: GamutLimit = 'srgb',
  hueSteps = 48,
  lightSteps = 28,
  embed: SolidEmbed = 'cylinder',
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

  let maxR = 0;
  for (const row of radius) for (const r of row) maxR = Math.max(maxR, r);
  const scaleR = maxR || 1;

  /**
   * Grid node → model point. Both embeddings put two axes horizontal and one
   * vertical, so the projector below serves either without knowing which.
   *
   *   cylinder:  x/z = the chroma plane (hue as angle), y = lightness
   *   landscape: x = hue, z = lightness, y = chroma
   *   lab:       x/z = a and b, y = lightness — all three on one scale
   *
   * The landscape's hue axis deliberately runs the FULL 0–360 without wrapping:
   * a wrapped landscape would hide the red seam behind itself, and the seam is
   * where the interesting asymmetry lives.
   *
   * The lab embedding pre-divides by `unit` here rather than leaving it to the
   * projector, so the model itself is isotropic and anything reading a point
   * back (the marker, a shell hit-test) needs one inverse, not two.
   */
  const unit = labSolidUnit(maxR);
  const at = (i: number, j: number): SolidPoint => {
    const l = i / (L - 1);
    const jj = (j % H + H) % H;
    const r = radius[i]![jj]!;
    if (embed === 'landscape') {
      // j runs 0…H inclusive here (the caller wraps), so the far edge lands at 1.
      return { x: (j / H) * 2 - 1, z: l * 2 - 1, y: r / scaleR };
    }
    const ang = (jj / H) * TAU;
    if (embed === 'lab') return labPoint(l, r, ang, unit);
    return { x: r * Math.cos(ang), z: r * Math.sin(ang), y: l };
  };

  const quads: SolidQuad[] = [];
  const maxRadius = maxR;

  for (let i = 0; i < L - 1; i++) {
    for (let j = 0; j < H; j++) {
      // Hue wraps modulo H at the seam. On the cylinder that closes the solid all
      // the way round; on the landscape the far column lands at x = +1 carrying
      // hue 0's radius, which is correct — 360° IS 0°.
      const p0 = at(i, j), p1 = at(i, j + 1), p2 = at(i + 1, j + 1), p3 = at(i + 1, j);
      // The patch's own colour comes from the GRID, not from its 3D position —
      // the landscape embedding throws hue's angular meaning away, so reading it
      // back off x/z would be wrong there.
      const li = (i + 0.5) / (L - 1);
      const hj = ((j + 0.5) / H) * 360;
      const cl = Math.min(1, li);
      const c = (radius[i]![j % H]! + radius[i + 1]![j % H]!) / 2;
      const h = hj;
      // Pull the sample very slightly inside the surface: dead on the boundary,
      // rounding can push the centre out of gamut and the mapper desaturates the
      // patch, banding the whole silhouette one step duller than it should be.
      const oklch = { l: cl, c: c * 0.995, h };
      const hex = oklchToHex(oklch);

      // The normal, from the two edge vectors — its vertical component says how
      // much the patch faces up, which is all the shading needs.
      const e1 = { x: p1.x - p0.x, z: p1.z - p0.z, y: p1.y - p0.y };
      const e2 = { x: p3.x - p0.x, z: p3.z - p0.z, y: p3.y - p0.y };
      const nx = e1.z * e2.y - e1.y * e2.z;
      const ny = e1.x * e2.z - e1.z * e2.x;
      const nz = e1.y * e2.x - e1.x * e2.y;
      const nMag = Math.hypot(nx, ny, nz) || 1;

      quads.push({ pts: [p0, p1, p2, p3], hex, oklch, up: ny / nMag });
    }
  }

  // A landscape is an open sheet, so its hue-seam edges are raw cuts — you can see
  // that it has no thickness, and it reads as a ribbon rather than a body. Cap them.
  if (embed === 'landscape') {
    for (const [j, x] of [[0, -1], [H, 1]] as [number, number][]) {
      quads.push(...capQuads(radius, L, H, j, x, scaleR));
    }
  }

  return { limit, embed, hueSteps: H, lightSteps: L, quads, maxRadius };
}

/** Vertical subdivisions per cap cell. The cap spans chroma 0 → the surface, and
 *  one flat quad over that whole span would be a single colour where the eye
 *  expects the same ramp the 2D L×C chart shows. */
const CAP_STEPS = 10;

/**
 * The wall closing one hue edge of a landscape, from the surface down to zero
 * chroma — filled with that hue's own lightness × chroma blend.
 *
 * Both edges sit at the seam (hue 0 and hue 360 are the same hue), so both caps
 * carry the same profile and the object is symmetric about it. The face is
 * literally the 'lc' slice chart at that hue stood on its edge, which is why it
 * looks right next to the flat charts: it IS the same surface.
 */
function capQuads(
  radius: number[][],
  L: number,
  H: number,
  j: number,
  x: number,
  scaleR: number,
): SolidQuad[] {
  const out: SolidQuad[] = [];
  const jj = (j % H + H) % H;
  const hue = (jj / H) * 360;

  for (let i = 0; i < L - 1; i++) {
    const l0 = i / (L - 1);
    const l1 = (i + 1) / (L - 1);
    const r0 = radius[i]![jj]!;
    const r1 = radius[i + 1]![jj]!;
    for (let k = 0; k < CAP_STEPS; k++) {
      const t0 = k / CAP_STEPS;
      const t1 = (k + 1) / CAP_STEPS;
      // Each rung spans a chroma band at both lightness edges, so the wall follows
      // the surface's own silhouette instead of being a rectangle behind it.
      const pts: [SolidPoint, SolidPoint, SolidPoint, SolidPoint] = [
        { x, z: l0 * 2 - 1, y: (r0 * t0) / scaleR },
        { x, z: l0 * 2 - 1, y: (r0 * t1) / scaleR },
        { x, z: l1 * 2 - 1, y: (r1 * t1) / scaleR },
        { x, z: l1 * 2 - 1, y: (r1 * t0) / scaleR },
      ];
      const cl = (l0 + l1) / 2;
      const c = ((r0 + r1) / 2) * ((t0 + t1) / 2);
      // 0.995 for the same reason the surface does it: dead on the boundary,
      // rounding can push a sample out of gamut and the mapper desaturates it.
      const oklch = { l: cl, c: c * 0.995, h: hue };
      const hex = oklchToHex(oklch);
      // A vertical face: `up` is 0, so the shading treats it as a side wall.
      out.push({ pts, hex, oklch, up: 0 });
    }
  }
  return out;
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
  // The cylinder's x/z are raw chroma, so they need normalising by the widest
  // reach and its y (lightness 0–1) centring on 0. The landscape and the lab plot
  // already arrive pre-scaled in −1…1, so they only need the same centring on the
  // vertical — and the lab plot's pre-scale is deliberately the SAME divisor on
  // all three axes, which is what stops this from re-normalising its proportions
  // away again.
  const rad = solid.embed === 'cylinder' ? (solid.maxRadius || 1) : 1;

  const raw = (p: SolidPoint): Projected => {
    // Vertical centred on 0 either way, so pitch tilts about the middle.
    const px = p.x / rad, pz = p.z / rad, py = (p.y - 0.5) * 2;
    const x = px * cy - pz * sy;   // spin the two horizontals about the vertical
    const zh = px * sy + pz * cy;  // …giving the depth contribution
    return {
      x,
      y: py * cp - zh * sp,        // tilt the vertical toward the viewer
      z: py * sp + zh * cp,
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
  /** The patch's colour before the sRGB bake — see {@link SolidQuad.oklch}. */
  oklch: { l: number; c: number; h: number };
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
    // A landscape is an OPEN surface — from below, every quad is back-facing, and
    // culling would render nothing at all. Only the closed embeddings (cylinder
    // and lab, which is the same closed hull on different axes) can cull.
    if (solid.embed !== 'landscape' && area <= 0) continue;

    const depth = cam.reduce((s, p) => s + p.z, 0) / cam.length;
    // A soft top-light: patches facing up read brighter. Kept mild (0.82–1) so
    // the chart still shows the real colour rather than a rendering of it.
    const shade = 0.82 + 0.18 * Math.max(0, Math.min(1, (q.up + 1) / 2));
    out.push({
      points: cam.map(p => ({ x: p.x, y: p.y })),
      hex: q.hex,
      oklch: q.oklch,
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
/**
 * Where one colour sits in the solid's own model space.
 *
 * One function rather than an inline expression per caller: the marker, the batch
 * projector and `solidPointOklch`'s inverse all have to agree, and an embedding's
 * scale factor living in three places is how a dot drifts off the surface.
 */
function modelPoint(solid: GamutSolid, o: { l: number; c: number; h: number }): SolidPoint {
  const hr = (o.h * Math.PI) / 180;
  const scaleR = solid.maxRadius || 1;
  return solid.embed === 'landscape'
    ? { x: (((o.h % 360) + 360) % 360) / 360 * 2 - 1, z: o.l * 2 - 1, y: o.c / scaleR }
    : solid.embed === 'lab'
      ? labPoint(o.l, o.c, hr, labSolidUnit(solid.maxRadius))
      : { x: o.c * Math.cos(hr), z: o.c * Math.sin(hr), y: o.l };
}

/**
 * Many colours through one camera — a point CLOUD against the solid.
 *
 * The batch form exists for a real reason, not tidiness: `projectSolidPoint`
 * builds a fresh projector per call, and building one scans every quad of the
 * mesh to measure the rotated extent. At 15k quads and a few thousand cloud
 * points that is tens of millions of operations per frame, on the rAF that also
 * has to draw the surface. Here the camera is built once.
 *
 * `inside` is deliberately NOT computed. It costs a gamut classification per
 * point and a cloud drawn against its own source gamut is trivially all-inside;
 * a caller that wants the out-of-gamut ones already has them from
 * `imageColorCloud`'s coverage numbers.
 */
export function projectSolidPoints(
  solid: GamutSolid,
  points: readonly { l: number; c: number; h: number }[],
  view: SolidView,
): { x: number; y: number; depth: number }[] {
  const project = makeProjector(solid, view);
  return points.map(o => {
    const p = project(modelPoint(solid, o));
    return { x: p.x, y: p.y, depth: p.z };
  });
}

export function projectSolidPoint(
  solid: GamutSolid,
  o: { l: number; c: number; h: number },
  view: SolidView,
): { x: number; y: number; depth: number; inside: boolean } {
  // Placed with the SAME embedding the mesh used, or the two land in different
  // spaces and the dot drifts off the surface.
  const p = makeProjector(solid, view)(modelPoint(solid, o));
  return {
    x: p.x,
    y: p.y,
    depth: p.z,
    inside: inGamut(o.l, o.c, o.h, solid.limit),
  };
}

/**
 * A model point back to the colour it stands for — the exact inverse of the
 * placement each embedding uses.
 *
 * Worth having as one function rather than three inline inversions: the marker,
 * a shell hit-test and the tests all need it, and an embedding's scale factor
 * living in two places is how the marker drifts off the surface.
 */
// ─── SVG emission ───────────────────────────────────────────────────────────

/**
 * One solid patch's CSS fill: its OKLCH encoded for the target space, times the
 * soft top-light `k`.
 *
 * This is the SAME operation the web shell's canvas painter runs (`shadedFill`
 * in shells/web/src/views/color-lab.ts) — `encodeOklch` is the engine's own
 * painter path, so a quad drawn to a canvas and the same quad emitted to SVG
 * cannot name different colours. The multiply lands on the ENCODED channels, not
 * on L, because shading is a lighting effect on the drawing, not a claim about
 * the colour. Factored here so the vector and canvas renderings share one source.
 */
export function shadedSolidFill(
  o: { l: number; c: number; h: number },
  k: number,
  encode: EncodeSpace = 'srgb',
): string {
  const [r, g, b] = encodeOklch(o.l, o.c, o.h, encode);
  const n = (v: number): string => Math.min(1, Math.max(0, v * k)).toFixed(4);
  return encode === 'display-p3'
    ? `color(display-p3 ${n(r)} ${n(g)} ${n(b)})`
    : `rgb(${Math.round(+n(r) * 255)} ${Math.round(+n(g) * 255)} ${Math.round(+n(b) * 255)})`;
}

export interface GamutSolidSvgOptions {
  /** Side length of the square viewport in px. Default 512. The projected quads
   *  live in a 0–1 box, so this is the only scale the SVG needs. */
  size?: number;
  /** Colour space the fills are encoded for. 'srgb' (default) emits plain
   *  `rgb(...)`; 'display-p3' emits `color(display-p3 …)` for a wide-gamut view. */
  encode?: EncodeSpace;
  /** Optional background rect fill (e.g. a page colour behind the solid). When
   *  omitted the SVG is transparent. */
  background?: string;
  /** Numeric precision (decimal places) for point coordinates. Default 2. */
  precision?: number;
}

/**
 * Emit a self-contained SVG of one projected gamut solid.
 *
 * Walks the SAME depth-sorted `ProjectedQuad[]` that {@link projectGamutSolid}
 * returns and writes one `<polygon>` per quad IN DOCUMENT ORDER — document order
 * is the painter's algorithm here, so a nearer quad's markup comes after (and
 * paints over) the far quads it occludes, with no z-fighting and no need for a
 * depth buffer. The array arrives already sorted far-to-near, so the emitter
 * simply preserves that order.
 *
 * Each polygon is filled AND stroked in its own colour — the same trick the
 * canvas painter uses to close the hairline antialiasing gap between abutting
 * fills that would otherwise make a dense mesh read as chicken wire.
 *
 * No external references (no defs, no gradients, no fonts): geometry is fully
 * recoverable from the projection, so this is pure string assembly.
 */
export function gamutSolidToSvg(
  projected: ProjectedQuad[],
  opts: GamutSolidSvgOptions = {},
): string {
  const size = opts.size && opts.size > 0 ? opts.size : 512;
  const encode = opts.encode ?? 'srgb';
  const dp = Math.max(0, Math.floor(opts.precision ?? 2));
  const fmt = (v: number): string => {
    // Guard against a NaN/Infinity slipping into markup — clamp non-finite to 0
    // so the emitted SVG is always well-formed. Trim a trailing '.00' etc.
    const n = Number.isFinite(v) ? v : 0;
    return parseFloat(n.toFixed(dp)).toString();
  };

  const polys: string[] = [];
  for (const q of projected) {
    const pts = q.points
      .map(p => `${fmt(p.x * size)},${fmt(p.y * size)}`)
      .join(' ');
    const fill = shadedSolidFill(q.oklch, q.shade, encode);
    // Fill and a matching stroke, to seal the sub-pixel seam between neighbours.
    polys.push(
      `<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`,
    );
  }

  const bg = opts.background
    ? `<rect width="${fmt(size)}" height="${fmt(size)}" fill="${opts.background}"/>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(size)}" height="${fmt(size)}" ` +
    `viewBox="0 0 ${fmt(size)} ${fmt(size)}">` +
    bg +
    polys.join('') +
    `</svg>`
  );
}

export function solidPointOklch(
  solid: GamutSolid,
  p: SolidPoint,
): { l: number; c: number; h: number } {
  if (solid.embed === 'landscape') {
    return {
      l: (p.z + 1) / 2,
      c: p.y * (solid.maxRadius || 1),
      h: ((p.x + 1) / 2) * 360,
    };
  }
  const unit = solid.embed === 'lab' ? labSolidUnit(solid.maxRadius) : 1;
  const c = Math.hypot(p.x, p.z) * unit;
  const l = solid.embed === 'lab' ? 0.5 + (p.y - 0.5) * 2 * unit : p.y;
  const h = c < 1e-12 ? 0 : (((Math.atan2(p.z, p.x) * 180) / Math.PI) + 360) % 360;
  return { l, c, h };
}
