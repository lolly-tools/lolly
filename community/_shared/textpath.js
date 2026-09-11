/**
 * Shared hook helpers - text along a path.
 *
 * CANONICAL SOURCE for the `textOnPath` region below. Tool hooks.js ship as
 * self-contained data (no imports), so each consumer carries a byte-for-byte
 * copy of the region between `lolly:shared` marker comments. Edit the region
 * HERE, then run `npm run sync:shared` to rewrite every consumer;
 * `npm run validate:catalog` fails if any consumer drifts.
 *
 * The model: host.text.toPath({ clusters: true }) shapes a run once (kerning,
 * ligatures and contextual joining already applied) and hands back one piece per
 * cluster with its pen position and advance. Text on a path is then a placement
 * problem only: stand each cluster on the path at its own centre and turn it to
 * the heading there. A "sampler" answers that question for one kind of path -
 * `arcSampler` is the circle, which is all a ring badge needs; the design tool's
 * text-on-path (plans/185) adds a polyline sampler over a lowered spline and
 * reuses `placeOnPath` unchanged.
 *
 * Consumers: work-avatar.
 */

// === lolly:shared textOnPath - canonical source; edit here and run npm run sync:shared ===
// A sampler maps an arc length s (px along the path, in READING order) to the
// point and heading there: { x, y, rot }, rot in SVG degrees (clockwise positive
// in the y-down plane - what a `rotate()` transform takes).
//
// arcSampler: a circle of radius r about (cx, cy). Angles are clock degrees -
// 0 at the top, clockwise positive. `startDeg` is where reading begins and `dir`
// which way it proceeds: -1 counter-clockwise, which is how text reads left to
// right along the BOTTOM of a ring (glyph tops toward the centre); +1 clockwise,
// which reads along the TOP (tops facing out). The heading follows from the
// tangent of that motion, so an inside run comes out upright and an outside run
// too - the same rule SVG's textPath applies to the path's own direction.
function arcSampler(cx, cy, r, startDeg, dir) {
  var rad = Math.PI / 180;
  return function (s) {
    var a = startDeg + dir * (s / r) / rad;
    return {
      x: cx + r * Math.sin(a * rad),
      y: cy - r * Math.cos(a * rad),
      rot: dir < 0 ? a + 180 : a,
    };
  };
}

// Place shaped clusters ({ d, x, advance }, x and advance in px from the run's
// origin, d with the baseline at y=0) along a sampler, the run's origin sitting
// at arc length s0. Each cluster stands at its own centre, so a run bends per
// letter rather than per word. Returns one record per cluster:
//   { d, pre, x, y, rot, dx } - draw as
//   <path d="{d}" transform="translate(x y) rotate(rot) translate(dx 0) {pre}"/>
// dx is the shift that puts the cluster's centre at the origin before rotating;
// `pre` is an optional innermost transform a synthetic cluster (a drawn glyph in
// its own coordinates) carries through untouched.
function placeOnPath(clusters, sampler, s0) {
  var out = [];
  for (var i = 0; i < clusters.length; i++) {
    var c = clusters[i];
    var mid = c.x + c.advance / 2;
    var p = sampler(s0 + mid);
    out.push({ d: c.d, pre: c.pre || '', x: p.x, y: p.y, rot: p.rot, dx: -mid });
  }
  return out;
}
// === /lolly:shared textOnPath ===
