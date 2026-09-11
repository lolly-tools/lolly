/**
 * Shared hook helpers - image framing (plans/148).
 *
 * CANONICAL SOURCE for the `frameRect`, `projectFraming` and `drawFramed`
 * regions below. Tool hooks.js ship as self-contained data (no imports), so each
 * consumer carries a byte-for-byte copy of each region between `lolly:shared`
 * marker comments. Edit the regions HERE, then run `npm run sync:shared` to
 * rewrite every consumer; `npm run validate:catalog` fails if any consumer
 * drifts.
 *
 * This is the hook-side twin of `engine/src/framing.ts`. It replaces the five
 * hand-written `drawCover` copies (darkroom, filter x3, booth-studio's inline
 * drawMedia) with one implementation whose numbers are pinned equal to the
 * engine's by a fixture table in `tests/framing.test.ts` - so a canvas-drawing
 * tool and a DOM tool place the same photo the same way, and both survive
 * export identically.
 *
 * Framing is `{ zoom, x, y, rotate, pitch, yaw }`: percent, percent, percent,
 * and three angles in degrees (roll, then the two perspective axes). Every field
 * is optional. Pitch and yaw make the placement a projective homography, which
 * neither a drawImage rectangle nor a canvas 2-D matrix can express - so
 * drawFramed switches to a tile mesh, each tile affine, converging on the
 * projection. Same technique the vector piecewise-affine path uses.
 */

// === lolly:shared frameRect - canonical source; edit here and run npm run sync:shared ===
// Where an iw×ih image lands inside a W×H frame, as CSS would place it:
// object-fit + object-position + transform:scale about the pan point. Returns
// source/destination rects for one drawImage, plus the roll and its origin.
function frameRect(iw, ih, W, H, framing, fit) {
  var f = framing || {};
  var nz = Number(f.zoom); var zoom = isFinite(nz) ? Math.max(1, nz) : 100;
  var nx = Number(f.x); var px = (isFinite(nx) ? nx : 50) / 100;
  var ny = Number(f.y); var py = (isFinite(ny) ? ny : 50) / 100;
  var nr = Number(f.rotate); var rotate = isFinite(nr) ? nr : 0;
  if (!(iw > 0) || !(ih > 0) || !(W > 0) || !(H > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(1, iw), sh: Math.max(1, ih),
      dx: 0, dy: 0, dw: W, dh: H, rotate: rotate, originX: W / 2, originY: H / 2 };
  }
  var base = fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  var s = base * (zoom / 100);
  var dw = iw * s, dh = ih * s;
  return { sx: 0, sy: 0, sw: iw, sh: ih,
    dx: (W - dw) * px, dy: (H - dh) * py, dw: dw, dh: dh,
    rotate: rotate, originX: W * px, originY: H * py };
}
// === /lolly:shared frameRect ===

// === lolly:shared projectFraming - canonical source; edit here and run npm run sync:shared ===
// The CSS perspective projection, expanded by hand: roll about Z, then yaw about
// Y, then pitch about X, then the perspective divide - all about the pan origin.
// 1200 is the same viewing distance the {{framing}} helper writes into
// `perspective(...)`, so the canvas and the DOM tilt identically.
var FRAMING_PERSPECTIVE = 1200;
function projectFraming(px, py, originX, originY, framing, persp) {
  var f = framing || {};
  var d = isFinite(Number(persp)) && Number(persp) > 0 ? Number(persp) : FRAMING_PERSPECTIVE;
  var roll = Number(f.rotate) || 0, pitch = Number(f.pitch) || 0, yaw = Number(f.yaw) || 0;
  var X = px - originX, Y = py - originY, Z = 0;
  var rad = Math.PI / 180, c, s, nx, ny, nz;
  if (roll) {
    c = Math.cos(roll * rad); s = Math.sin(roll * rad);
    nx = X * c - Y * s; ny = X * s + Y * c; X = nx; Y = ny;
  }
  if (yaw) {
    c = Math.cos(yaw * rad); s = Math.sin(yaw * rad);
    nx = X * c + Z * s; nz = -X * s + Z * c; X = nx; Z = nz;
  }
  if (pitch) {
    c = Math.cos(pitch * rad); s = Math.sin(pitch * rad);
    ny = Y * c - Z * s; nz = Y * s + Z * c; Y = ny; Z = nz;
  }
  var w = 1 - Z / d;
  var k = 1 / (w > 1e-3 ? w : 1e-3);
  return { x: originX + X * k, y: originY + Y * k };
}
// === /lolly:shared projectFraming ===

// === lolly:shared drawFramed - canonical source; edit here and run npm run sync:shared ===
// Draw `source` into the current context's W×H frame with the given framing.
// Needs frameRect() and projectFraming() in scope.
//
// No tilt: one drawImage, with roll applied about the pan point (matching CSS
// transform-origin). Tilted: a mesh of small quads, each drawn with the affine
// map through three of its projected corners - canvas 2-D has no projective
// transform, so perspective emerges from the subdivision. Tiles are drawn with a
// half-pixel overlap because adjacent affine patches otherwise leave hairline
// seams where their edges disagree.
// Measured against the exact projection at a hard 12 degree pitch / 9 degree yaw
// on a 1080 frame: 8 tiles is 11.0px out at the worst corner, 16 is 2.9, 24 is
// 1.3. 24 is the live-preview compromise - a canvas tool redraws this per frame,
// and 576 draws is affordable where 1024 starts to cost. The shell's one-off bake
// (lib/framing-bake.ts) uses 32 for the extra half-pixel.
var FRAMING_TILES = 24;
function drawFramed(ctx, source, iw, ih, W, H, framing, fit) {
  var r = frameRect(iw, ih, W, H, framing, fit);
  var f = framing || {};
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  if (!Number(f.pitch) && !Number(f.yaw)) {
    if (r.rotate) {
      ctx.save();
      ctx.translate(r.originX, r.originY);
      ctx.rotate(r.rotate * Math.PI / 180);
      ctx.translate(-r.originX, -r.originY);
    }
    ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    if (r.rotate) ctx.restore();
    return;
  }
  var n = FRAMING_TILES;
  var tw = r.sw / n, th = r.sh / n;       // source tile
  var dw = r.dw / n, dh = r.dh / n;       // destination tile, before projection
  var over = 0.5;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      var x0 = r.dx + i * dw, y0 = r.dy + j * dh;
      var p00 = projectFraming(x0, y0, r.originX, r.originY, f);
      var p10 = projectFraming(x0 + dw, y0, r.originX, r.originY, f);
      var p01 = projectFraming(x0, y0 + dh, r.originX, r.originY, f);
      // The affine that carries the tile's own unit square onto its projected
      // corners: columns are the two edge vectors, translation is the corner.
      var a = (p10.x - p00.x) / dw, b = (p10.y - p00.y) / dw;
      var c = (p01.x - p00.x) / dh, d = (p01.y - p00.y) / dh;
      if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;
      ctx.save();
      // transform(), not setTransform(): the caller may already have a transform
      // on the context (a translate into a panel, a device-pixel scale), and
      // replacing it would move every tile out of that space.
      ctx.transform(a, b, c, d, p00.x, p00.y);
      // In tile space the destination is the un-projected tile at the origin.
      ctx.drawImage(source,
        r.sx + i * tw, r.sy + j * th, tw, th,
        0, 0, dw + over, dh + over);
      ctx.restore();
    }
  }
}
// === /lolly:shared drawFramed ===
