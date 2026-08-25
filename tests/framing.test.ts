// SPDX-License-Identifier: MPL-2.0
/**
 * Image framing (plans/148) - the contract that makes ONE placement recipe hold
 * across every surface.
 *
 * Three things are pinned here, and they are the whole reason the module exists:
 *
 *   (1) The engine's frameRect() and the hook-side twin in
 *       community/_shared/framing.js agree to the bit over a fixture table. Tools
 *       cannot import from the engine, so the canvas-drawing hooks carry a
 *       byte-synced copy; without this table the two re-fork exactly the way the
 *       five hand-written drawCover copies did.
 *   (2) framingStyle()'s CSS is ALGEBRAICALLY the same placement frameRect()
 *       returns. The DOM tools emit the CSS and the export walker reads it back;
 *       the canvas tools draw the rects. If those two ever disagree, an image
 *       moves between the preview and the export, which is the failure this plan
 *       set out to end.
 *   (3) A neutral framing emits no transform at all, so adopting the helper
 *       leaves an existing tool's markup - and therefore its exports - unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { hydrate } from '../engine/src/template.ts';
import {
  frameRect, framingStyle, normalizeFraming, isNeutralFraming, isTilted,
  framingQuad, projectFramingPoint, minZoomForCover, FRAMING_PERSPECTIVE,
} from '../engine/src/framing.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── The hook-side copy, loaded the way a hooks.js body actually runs it ──────
// (a bare function declaration in a `new Function` body, no imports, no host).
function sharedRegion(name: string): string {
  const src = readFileSync(join(ROOT, 'community/_shared/framing.js'), 'utf8');
  const m = new RegExp(`// === lolly:shared ${name}[^\\n]*\\n([\\s\\S]*?)\\n// === /lolly:shared ${name} ===`).exec(src);
  assert.ok(m, `community/_shared/framing.js must carry a \`${name}\` shared region`);
  return m![1]!;
}

function loadSharedFrameRect(): (iw: number, ih: number, W: number, H: number, f: unknown, fit?: string) => Record<string, number> {
  return new Function(`${sharedRegion('frameRect')}; return frameRect;`)() as ReturnType<typeof loadSharedFrameRect>;
}

function loadSharedProject(): (px: number, py: number, ox: number, oy: number, f: unknown, persp?: number) => { x: number; y: number } {
  return new Function(`${sharedRegion('projectFraming')}; return projectFraming;`)() as ReturnType<typeof loadSharedProject>;
}

// Portrait into landscape, landscape into portrait, square into square, plus the
// degenerate source every tool eventually meets (a 1px favicon, a broken decode).
const CASES: Array<{ iw: number; ih: number; W: number; H: number; f: Record<string, number>; fit: 'cover' | 'contain' }> = [
  { iw: 1200, ih: 1600, W: 1080, H: 1080, f: {}, fit: 'cover' },
  { iw: 1200, ih: 1600, W: 1080, H: 1080, f: { zoom: 100, x: 50, y: 50 }, fit: 'cover' },
  { iw: 1200, ih: 1600, W: 1080, H: 1080, f: { zoom: 180, x: 20, y: 80 }, fit: 'cover' },
  { iw: 4000, ih: 2250, W: 800, H: 1200, f: { zoom: 100, x: 0, y: 0 }, fit: 'cover' },
  { iw: 4000, ih: 2250, W: 800, H: 1200, f: { zoom: 400, x: 100, y: 100 }, fit: 'cover' },
  { iw: 640, ih: 640, W: 1920, H: 1080, f: { zoom: 250, x: 33, y: 67, rotate: -8.5 }, fit: 'cover' },
  { iw: 1200, ih: 1600, W: 1080, H: 1080, f: { zoom: 100, x: 50, y: 50 }, fit: 'contain' },
  { iw: 4000, ih: 2250, W: 800, H: 1200, f: { zoom: 160, x: 25, y: 75, rotate: 90 }, fit: 'contain' },
  { iw: 1, ih: 1, W: 400, H: 400, f: { zoom: 300, x: 10, y: 90 }, fit: 'cover' },
  { iw: 0, ih: 0, W: 400, H: 400, f: { zoom: 200, x: 10, y: 90 }, fit: 'cover' },
];

test('frameRect: the engine and the hook-side copy agree exactly', () => {
  const shared = loadSharedFrameRect();
  for (const c of CASES) {
    const a = frameRect(c.iw, c.ih, c.W, c.H, c.f, c.fit) as unknown as Record<string, number>;
    const b = shared(c.iw, c.ih, c.W, c.H, c.f, c.fit);
    const label = `${c.iw}x${c.ih} → ${c.W}x${c.H} ${c.fit} ${JSON.stringify(c.f)}`;
    for (const k of ['sx', 'sy', 'sw', 'sh', 'dx', 'dy', 'dw', 'dh', 'rotate', 'originX', 'originY']) {
      assert.equal(b[k], a[k], `${label}: ${k}`);
    }
  }
});

test('frameRect: cover fills the frame, contain fits inside it, at zoom 100', () => {
  const cover = frameRect(1200, 1600, 1080, 1080, {}, 'cover');
  assert.ok(cover.dw >= 1080 - 1e-9 && cover.dh >= 1080 - 1e-9, 'cover must reach both edges');
  const contain = frameRect(1200, 1600, 1080, 1080, {}, 'contain');
  assert.ok(contain.dw <= 1080 + 1e-9 && contain.dh <= 1080 + 1e-9, 'contain must stay inside');
  // Centred by default, either way.
  assert.equal(cover.dx + cover.dw / 2, 540);
  assert.equal(contain.dy + contain.dh / 2, 540);
});

test('frameRect: pan spans the whole overflow, so 0 and 100 pin opposite edges', () => {
  const left = frameRect(4000, 2250, 800, 1200, { x: 0 }, 'cover');
  const right = frameRect(4000, 2250, 800, 1200, { x: 100 }, 'cover');
  assert.equal(Math.abs(left.dx), 0, 'x=0 pins the left edge of the image to the frame');
  assert.equal(right.dx + right.dw, 800, 'x=100 pins the right edge');
});

test('frameRect: a dimensionless source falls back to filling the frame, never NaN', () => {
  const r = frameRect(0, 0, 400, 300, { zoom: 200, x: 10 }, 'cover');
  for (const v of Object.values(r)) assert.ok(Number.isFinite(v), 'no NaN escapes');
  assert.deepEqual([r.dx, r.dy, r.dw, r.dh], [0, 0, 400, 300]);
});

// ── (2) CSS ≡ rects ─────────────────────────────────────────────────────────
// Re-derive the placement the browser produces from the emitted declarations,
// independently of frameRect's own arithmetic: fit the image per object-fit,
// place it per object-position, then apply transform:scale about
// transform-origin. The result must be frameRect's destination rectangle.
function parseDecls(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

test('framingStyle: the CSS places the image exactly where frameRect does', () => {
  for (const c of CASES) {
    if (!(c.iw > 0 && c.ih > 0)) continue;      // the degenerate fallback is not a CSS case
    const d = parseDecls(framingStyle(c.f, c.fit));
    const label = `${c.iw}x${c.ih} → ${c.W}x${c.H} ${c.fit} ${JSON.stringify(c.f)}`;

    // object-fit
    const base = d['object-fit'] === 'contain'
      ? Math.min(c.W / c.iw, c.H / c.ih)
      : Math.max(c.W / c.iw, c.H / c.ih);
    let dw = c.iw * base, dh = c.ih * base;

    // object-position (always a percentage pair from this helper)
    const [pxs, pys] = d['object-position']!.split(/\s+/);
    const px = parseFloat(pxs!) / 100, py = parseFloat(pys!) / 100;
    let dx = (c.W - dw) * px, dy = (c.H - dh) * py;

    // transform: scale about transform-origin (rotation is checked separately -
    // it moves the whole painted box, not the box's pre-rotation geometry).
    const scaleM = /scale\(([-\d.]+)\)/.exec(d.transform ?? '');
    if (scaleM) {
      const z = parseFloat(scaleM[1]!);
      const [oxs, oys] = d['transform-origin']!.split(/\s+/);
      const ox = (parseFloat(oxs!) / 100) * c.W, oy = (parseFloat(oys!) / 100) * c.H;
      dx = ox + (dx - ox) * z; dy = oy + (dy - oy) * z;
      dw *= z; dh *= z;
    }

    const r = frameRect(c.iw, c.ih, c.W, c.H, c.f, c.fit);
    for (const [k, got, want] of [['dx', dx, r.dx], ['dy', dy, r.dy], ['dw', dw, r.dw], ['dh', dh, r.dh]] as const) {
      assert.ok(Math.abs(got - want) < 1e-6, `${label}: ${k} ${got} != ${want}`);
    }

    // The rotation the CSS declares is the rotation frameRect reports, about the
    // same origin - that is what lets a canvas hook reproduce the DOM exactly.
    const rotM = /rotate\(([-\d.]+)deg\)/.exec(d.transform ?? '');
    assert.equal(rotM ? parseFloat(rotM[1]!) : 0, r.rotate, `${label}: rotate`);
    if (rotM) {
      const [oxs, oys] = d['transform-origin']!.split(/\s+/);
      assert.ok(Math.abs((parseFloat(oxs!) / 100) * c.W - r.originX) < 1e-6, `${label}: originX`);
      assert.ok(Math.abs((parseFloat(oys!) / 100) * c.H - r.originY) < 1e-6, `${label}: originY`);
    }
  }
});

test('framingStyle: a neutral framing emits no transform, so adopting it changes nothing', () => {
  assert.equal(framingStyle({}, 'cover'), 'object-fit:cover;object-position:50% 50%');
  assert.equal(framingStyle({ zoom: 100, x: 50, y: 50, rotate: 0 }, 'contain'), 'object-fit:contain;object-position:50% 50%');
  assert.ok(isNeutralFraming({}));
  assert.ok(isNeutralFraming({ zoom: 100, x: 50, y: 50, rotate: 0 }));
  assert.ok(!isNeutralFraming({ zoom: 101 }));
  assert.ok(!isNeutralFraming({ rotate: 0.5 }));
});

test('framingStyle: rotation is emitted before scale, and both share the pan origin', () => {
  const s = framingStyle({ zoom: 150, x: 20, y: 80, rotate: -6 }, 'cover');
  assert.match(s, /transform:rotate\(-6deg\) scale\(1\.5\)/);
  assert.match(s, /object-position:20% 80%/);
  assert.match(s, /transform-origin:20% 80%/);
});

test('normalizeFraming: junk and partials fall back to the neutral value', () => {
  assert.deepEqual(normalizeFraming(undefined), { zoom: 100, x: 50, y: 50, rotate: 0, pitch: 0, yaw: 0 });
  assert.deepEqual(normalizeFraming({ zoom: 'nope', x: '30' } as unknown as Record<string, unknown>), { zoom: 100, x: 30, y: 50, rotate: 0, pitch: 0, yaw: 0 });
  // A zero/negative zoom would invert or annihilate the image - clamp, don't trust.
  assert.equal(normalizeFraming({ zoom: 0 }).zoom, 1);
  assert.equal(normalizeFraming({ zoom: -200 }).zoom, 1);
});

// ── The envelope: pitch / yaw / roll ─────────────────────────────────────────
// Perspective correction is a projective homography, so it gets its own entry
// point and its own equivalence check - a rect pair cannot carry it, and the
// canvas twin draws a tile mesh rather than one drawImage.

test('projectFramingPoint: the engine and the hook-side copy agree exactly', () => {
  const shared = loadSharedProject();
  const cases = [
    { f: { rotate: 0, pitch: 0, yaw: 0 }, pts: [[0, 0], [100, 50]] },
    { f: { rotate: 12, pitch: 0, yaw: 0 }, pts: [[0, 0], [800, 600], [-40, 900]] },
    { f: { rotate: 0, pitch: 9, yaw: 0 }, pts: [[0, 0], [800, 600]] },
    { f: { rotate: 0, pitch: 0, yaw: -14 }, pts: [[0, 0], [800, 600]] },
    { f: { rotate: -6, pitch: 11, yaw: 7 }, pts: [[0, 0], [1080, 1080], [540, 0]] },
    { f: { rotate: 0, pitch: 89, yaw: 0 }, pts: [[0, 0], [800, 4000]] },   // near the eye
  ];
  for (const c of cases) {
    const full = normalizeFraming(c.f);
    for (const [px, py] of c.pts) {
      const a = projectFramingPoint(px!, py!, 540, 540, full);
      const b = shared(px!, py!, 540, 540, c.f);
      assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9,
        `${JSON.stringify(c.f)} @ ${px},${py}: engine ${a.x},${a.y} vs shared ${b.x},${b.y}`);
    }
  }
});

test('projectFramingPoint: the origin is the fixed point, and a flat framing is identity', () => {
  const flat = normalizeFraming({ rotate: 0, pitch: 0, yaw: 0 });
  const p = projectFramingPoint(123, 456, 540, 540, flat);
  assert.deepEqual([p.x, p.y], [123, 456]);
  const tilted = normalizeFraming({ pitch: 14, yaw: -9, rotate: 5 });
  const o = projectFramingPoint(540, 540, 540, 540, tilted);
  assert.ok(Math.abs(o.x - 540) < 1e-9 && Math.abs(o.y - 540) < 1e-9, 'the pan point never moves');
});

test('framingQuad: yaw keystones one side - the far edge is shorter than the near one', () => {
  const q = framingQuad(1080, 1080, 1080, 1080, { yaw: 20 }, 'cover');
  const leftEdge = Math.hypot(q[3]!.x - q[0]!.x, q[3]!.y - q[0]!.y);
  const rightEdge = Math.hypot(q[2]!.x - q[1]!.x, q[2]!.y - q[1]!.y);
  assert.ok(Math.abs(leftEdge - rightEdge) > 1, 'a yaw must actually keystone the image');
  // …and a flat framing must leave the quad exactly the rectangle frameRect gives.
  const r = frameRect(1080, 1080, 1080, 1080, {}, 'cover');
  const flat = framingQuad(1080, 1080, 1080, 1080, {}, 'cover');
  assert.deepEqual(flat.map(p => [p.x, p.y]), [
    [r.dx, r.dy], [r.dx + r.dw, r.dy], [r.dx + r.dw, r.dy + r.dh], [r.dx, r.dy + r.dh],
  ]);
});

test('minZoomForCover: a tilt that opens a corner is zoomed back to full coverage', () => {
  // A square photo exactly covering a square frame: any pitch pulls a corner in.
  const before = minZoomForCover(1080, 1080, 1080, 1080, { zoom: 100 }, 'cover');
  assert.equal(before, 100, 'an untilted cover framing is already covered');
  const tilt = { zoom: 100, pitch: 12, yaw: 8 };
  const z = minZoomForCover(1080, 1080, 1080, 1080, tilt, 'cover');
  assert.ok(z > 100, 'a tilted framing needs more zoom to stay covered');
  // The returned zoom must actually cover - the whole point of rounding out.
  const q = framingQuad(1080, 1080, 1080, 1080, { ...tilt, zoom: z }, 'cover');
  const inside = (x: number, y: number): boolean => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const a = q[i]!, b = q[(i + 1) % 4]!;
      const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      if (Math.abs(cross) < 1e-9) continue;
      const s = cross > 0 ? 1 : -1;
      if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
  };
  for (const [cx, cy] of [[0, 0], [1080, 0], [1080, 1080], [0, 1080]]) {
    assert.ok(inside(cx!, cy!), `frame corner ${cx},${cy} is still outside the tilted image`);
  }
  // `contain` deliberately opts out: letterboxing is the point of contain.
  assert.equal(minZoomForCover(1080, 1080, 1080, 1080, tilt, 'contain'), 100);
});

test('framingStyle: pitch/yaw emit a perspective envelope, and only when set', () => {
  assert.ok(!/perspective/.test(framingStyle({ rotate: 5, zoom: 120 }, 'cover')));
  const s = framingStyle({ pitch: 9, yaw: -4, rotate: 2, zoom: 110 }, 'cover');
  assert.match(s, new RegExp(`transform:perspective\\(${FRAMING_PERSPECTIVE}px\\) rotateX\\(9deg\\) rotateY\\(-4deg\\) rotate\\(2deg\\) scale\\(1\\.1\\)`));
  assert.match(s, /transform-style:preserve-3d/);
  assert.ok(isTilted({ pitch: 1 }));
  assert.ok(isTilted({ yaw: -1 }));
  assert.ok(!isTilted({ rotate: 30 }));
  assert.ok(!isNeutralFraming({ pitch: 0.5 }));
});

// ── The {{framing}} template helper ─────────────────────────────────────────
// One call emits BOTH halves of the recipe - the placement CSS and the
// data-framing marker the shell's overlay binds to - because a tool that got one
// without the other would look right and be un-draggable (or vice versa).

test('{{framing}}: emits the style and the marker from an input ID', () => {
  const out = hydrate('<img src="x" {{framing "imageFraming"}}>', {
    imageFraming: { zoom: 150, x: 20, y: 80, rotate: -6 },
  });
  assert.match(out, /data-framing="imageFraming"/);
  assert.match(out, /object-fit:cover/);
  assert.match(out, /object-position:20% 80%/);
  assert.match(out, /rotate\(-6deg\) scale\(1\.5\)/);
});

test('{{framing}}: the companion fit input is found by name, and overridable', () => {
  const contain = hydrate('<img {{framing "imageFraming"}}>', { imageFraming: {}, imageFit: 'contain' });
  assert.match(contain, /object-fit:contain/);
  // bgFraming looks for bgFit, not imageFit - two slots on one tool stay separate.
  const two = hydrate('<img {{framing "bgFraming"}}>', { bgFraming: {}, bgFit: 'contain', imageFit: 'cover' });
  assert.match(two, /object-fit:contain/);
  assert.match(two, /data-framing="bgFraming"/);
});

test('{{framing}}: block mode reads the row\'s four numbers and marks the row', () => {
  const out = hydrate(
    '{{#each boxes}}<img {{framing "bg" block="boxes" index=@index}}>{{/each}}',
    { boxes: [{ bgZoom: 120, bgX: 10, bgY: 90 }, { bgZoom: 100, bgX: 50, bgY: 50, bgRotate: 3, bgFit: 'contain' }] },
  );
  assert.match(out, /data-framing="boxes:0:bg"/);
  assert.match(out, /object-position:10% 90%/);
  assert.match(out, /data-framing="boxes:1:bg"/);
  assert.match(out, /object-fit:contain/);
  assert.match(out, /rotate\(3deg\)/);
});

test('{{framing}}: a missing or junk value degrades to the neutral placement', () => {
  const out = hydrate('<img {{framing "imageFraming"}}>', {});
  assert.match(out, /style="object-fit:cover;object-position:50% 50%"/);
  assert.ok(!/transform/.test(out), 'nothing to transform, so no transform is emitted');
  assert.equal(hydrate('<img {{framing ""}}>', {}), '<img >');
});

test('{{media}}: framing= places the asset with the same recipe', () => {
  const out = hydrate('{{media hero framing="imageFraming"}}', {
    hero: { url: 'https://example.test/a.png', type: 'raster', meta: { name: 'A' } },
    imageFraming: { zoom: 200, x: 0, y: 100 },
  });
  assert.match(out, /data-framing="imageFraming"/);
  assert.match(out, /object-position:0% 100%/);
  assert.match(out, /scale\(2\)/);
});
