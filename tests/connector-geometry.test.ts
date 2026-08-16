// SPDX-License-Identifier: MPL-2.0
// Golden + parity tests for the editor's connector routing geometry
// (shells/web/src/views/free-canvas-math.ts). This math was lifted out of
// free-canvas.ts so it could be tested, and it MIRRORS the committed-render routing in
// brands/suse/tools/org-chart/hooks.js. These golden values lock the shell path output;
// the parity test at the end guards the elbow fractions from drifting between the two files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { baseHost } from './helpers/host.ts';
import {
  edgeWaypoints, edgeBorderPt, edgeNested, roundedEdgePath, smoothEdgePath,
  edgeArrowHead, edgeHeadInset,
  isEdgePoint, parseEdgePoint, formatEdgePoint, edgeEndRect, buildConnectorSvg,
} from '../shells/web/src/views/free-canvas-math.ts';
import type { EdgeRect } from '../shells/web/src/views/free-canvas-math.ts';
// The unified path primitive's own decorations (plan 96 P1) + the host.connectors factory
// come straight from the engine module: the shell re-export above is the free-canvas
// surface, while these are what the PATH renderer and both bridges call.
import {
  pathHeadSvg, pathHeadInset, pathHeadSize, makeConnectorsApi,
  // plan 96 P3/P5 - the kind→route mapping and the ONE routed-line renderer.
  pathRouteStyle, isConnectorRouteStyle, CONNECTOR_ROUTE_STYLES, routedLineSvg,
} from '../engine/src/connectors.ts';
import { cornerFitDashArray } from '../engine/src/dash-fit.ts';

// org-chart ships in the (private) SUSE brand pack; the hook↔shell parity
// tests can only run when the pack is mounted (see profiles.json). Gate on the
// SOURCE pack, not the gitignored tools/ profile view: with the pack mounted, a
// missing hooks.js means the tool was renamed or deleted - FAIL, don't skip.
const SUSE_PACK = new URL('../brands/suse/tools/', import.meta.url);
const HOOK_URL = new URL('org-chart/hooks.js', SUSE_PACK);
const PACK_MOUNTED = existsSync(SUSE_PACK);
const SKIP_SUSE = !PACK_MOUNTED && 'SUSE brand pack not mounted (see profiles.json)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(HOOK_URL),
    'brands/suse/tools/org-chart/hooks.js is missing — pack is mounted, so the tool was renamed or deleted');
}

// A stacked pair (a above b) and a diagonal pair (a up-left of b), in native px.
const aTop = { x: 0, y: 0, w: 100, h: 50 };
const bBelow = { x: 0, y: 200, w: 100, h: 50 };
const bDiag = { x: 300, y: 200, w: 100, h: 50 };

test('edgeWaypoints: straight leaves + meets the box borders', () => {
  assert.deepEqual(edgeWaypoints(aTop, bBelow, 'straight'), [
    { x: 50, y: 50 },   // bottom-centre of a
    { x: 50, y: 200 },  // top-centre of b
  ]);
});

test('edgeWaypoints: mid elbow (auto orientation) routes through a horizontal trunk', () => {
  // |dy| < |dx| here, so the trunk is horizontal (useV false) and bends at the midpoint.
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow'), [
    { x: 100, y: 25 }, { x: 200, y: 25 }, { x: 200, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-src bends near the source (frac 0.18)', () => {
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow-src'), [
    { x: 100, y: 25 }, { x: 136, y: 25 }, { x: 136, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-tgt bends near the target (frac 0.82)', () => {
  assert.deepEqual(edgeWaypoints(aTop, bDiag, 'elbow-tgt'), [
    { x: 100, y: 25 }, { x: 264, y: 25 }, { x: 264, y: 225 }, { x: 300, y: 225 },
  ]);
});

test('edgeWaypoints: elbow-v forces a vertical trunk even when dx dominates', () => {
  const pts = edgeWaypoints(aTop, bDiag, 'elbow-v');
  // Vertical trunk: leaves the bottom face of a and meets the top face of b.
  assert.equal(pts[0]!.y, 50);        // a.y + a.h
  assert.equal(pts[pts.length - 1]!.y, 200); // b.y
});

test('edgeBorderPt: projects onto the ray toward the target', () => {
  assert.deepEqual(edgeBorderPt({ cx: 50, cy: 25, hw: 50, hh: 25 }, 50, 225), { x: 50, y: 50 });
});

test('edgeNested: a box fully inside another (or identical) reports nested', () => {
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 10, y: 10, w: 50, h: 50 }), true);
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0, w: 100, h: 100 }), true);
  assert.equal(edgeNested({ x: 0, y: 0, w: 100, h: 100 }, { x: 200, y: 200, w: 50, h: 50 }), false);
});

test('roundedEdgePath: two points draw a straight segment', () => {
  assert.equal(roundedEdgePath([{ x: 0, y: 0 }, { x: 100, y: 0 }], 16), 'M0 0L100 0');
});

test('roundedEdgePath: corners are rounded with quadratics (golden)', () => {
  const pts = edgeWaypoints(aTop, bDiag, 'elbow');
  assert.equal(
    roundedEdgePath(pts, 16),
    'M100 25L184 25Q200 25 200 41L200 209Q200 225 216 225L300 225',
  );
});

test('smoothEdgePath: renders a single cubic S-curve (golden)', () => {
  const pts = edgeWaypoints(aTop, bBelow, 'elbow');
  assert.equal(smoothEdgePath(pts), 'M50 50C50 125 50 125 50 200');
});

test('the elbow fractions live in the engine, and ONLY in the engine', { skip: SKIP_SUSE }, () => {
  // These three parity tests used to check that org-chart/hooks.js hand-mirrored the
  // engine's routing constants. Plan 96 P4 deleted that mirror: the hook builds decoration
  // ROWS and hands them to host.connectors.build, so there is one implementation and the
  // question is no longer "do the two agree" but "is there still only one". A re-appearing
  // copy of the routing maths in a pack hook is what these now catch.
  const engine = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const frac of ['0.18', '0.82']) {
    assert.ok(engine.includes(frac), `engine/connectors.ts should encode elbow fraction ${frac}`);
  }
  const hook = readFileSync(HOOK_URL, 'utf8');
  assert.doesNotMatch(hook, /elbowFrac|function waypoints\(/,
    'org-chart/hooks.js must not route on its own — that is host.connectors.build');
});

// ── Arc family (a sampled quadratic bow; the render draws a real Q) ────────────

test('edgeWaypoints: arc is a sampled bow off the chord, ending on the borders', () => {
  const pts = edgeWaypoints(aTop, bBelow, 'arc');
  assert.ok(pts.length > 2, 'arc samples into a polyline');
  assert.deepEqual(pts[0], { x: 50, y: 50 });                 // bottom-centre of a
  assert.deepEqual(pts[pts.length - 1]!, { x: 50, y: 200 });  // top-centre of b
  const mid = pts[Math.floor(pts.length / 2)]!;
  assert.ok(Math.abs(mid.x - 50) > 5, 'it bows sideways off the straight chord (x=50)');
});

test('edgeWaypoints: arc-flip bows the opposite side; arc-wide bows deeper', () => {
  const m = (s: string): number => { const p = edgeWaypoints(aTop, bBelow, s); return p[Math.floor(p.length / 2)]!.x - 50; };
  assert.equal(Math.sign(m('arc')), -Math.sign(m('arc-flip')), 'reverse bows the other way');
  assert.ok(Math.abs(m('arc-wide')) > Math.abs(m('arc')), 'wide bows deeper than the plain arc');
});

test('the arc variants live in the engine, and the hook only NAMES them', { skip: SKIP_SUSE }, () => {
  const engine = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const key of ['arc-wide', 'arc-flip', 'arc-flip-wide']) {
    assert.ok(engine.includes(key), `engine/connectors.ts should encode arc variant ${key}`);
  }
  const hook = readFileSync(HOOK_URL, 'utf8');
  assert.doesNotMatch(hook, /ARC_VARIANTS/,
    'org-chart/hooks.js must not carry its own arc table');
});

// ── Arrowheads (export-safe geometry - plan 90 thread A) ───────────────────────
// Every shape is a baked-in filled <path> or plain <line>: no <marker>, no <polygon>,
// no transform, so it survives the SVG/PDF/EMF vector walkers. A tip at the origin
// pointing +x (ux=1,uy=0), size 10, keeps the golden coordinates readable.
const TIP = { x: 0, y: 0 };

test('edgeArrowHead: triangle is a filled 3-point path (golden)', () => {
  assert.equal(edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'triangle'),
    '<path d="M0 0L-10 5.2L-10 -5.2Z" fill="#30ba78"/>');
});

test('edgeArrowHead: diamond is a filled 4-point path (golden)', () => {
  assert.equal(edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'diamond'),
    '<path d="M0 0L-10 5.2L-20 0L-10 -5.2Z" fill="#30ba78"/>');
});

test('edgeArrowHead: bar is a single perpendicular line (golden)', () => {
  assert.equal(edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'bar'),
    '<line x1="0" y1="6.2" x2="0" y2="-6.2" stroke="#30ba78" stroke-width="2.2"/>');
});

test('edgeArrowHead: open is two round-capped chevron lines meeting at the tip', () => {
  const out = edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'open');
  assert.equal((out.match(/<line /g) || []).length, 2, 'two arms');
  assert.match(out, /stroke-linecap="round"/, 'round caps to match the connector line');
  assert.doesNotMatch(out, /<path|<polygon|<marker|transform=/, 'never a fill/marker/transform');
});

test('edgeArrowHead: circle is a filled 4-cubic path, closed', () => {
  const out = edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'circle');
  assert.match(out, /^<path d="M[^"]*Z" fill="#30ba78"\/>$/, 'one closed filled path');
  assert.equal((out.match(/C/g) || []).length, 4, 'four cubic segments — never <circle>/<ellipse>');
});

test('edgeArrowHead: none draws nothing', () => {
  assert.equal(edgeArrowHead(TIP, 1, 0, 10, '#30ba78', 'none'), '');
});

test('edgeArrowHead: the colour is attribute-escaped', () => {
  const out = edgeArrowHead(TIP, 1, 0, 10, '#f00"onload=alert(1)', 'triangle');
  assert.match(out, /&quot;/, 'the quote is escaped');
  assert.doesNotMatch(out, /"onload/, 'so it cannot break out of the fill attribute');
});

test('edgeHeadInset: filled heads pull the shaft back, open/bar do not', () => {
  assert.equal(edgeHeadInset('none', 10), 0);
  assert.equal(edgeHeadInset('open', 10), 0);
  assert.equal(edgeHeadInset('bar', 10), 0);
  assert.equal(edgeHeadInset('triangle', 10), 9);
  assert.equal(edgeHeadInset('diamond', 10), 20);
  assert.ok(Math.abs(edgeHeadInset('circle', 10) - 8.4) < 1e-9);
});

// ── Endpoint model: box id OR free point (plan 90 thread D) ────────────────────

test('isEdgePoint / parseEdgePoint / formatEdgePoint round-trip the @x,y sentinel', () => {
  assert.equal(formatEdgePoint(320.5, 180), '@320.5,180');
  assert.equal(isEdgePoint('@320.5,180'), true);
  assert.equal(isEdgePoint('@-4,-4.25'), true);
  assert.deepEqual(parseEdgePoint('@320.5,180'), { x: 320.5, y: 180 });
  assert.deepEqual(parseEdgePoint(formatEdgePoint(-4, -4.25)), { x: -4, y: -4.25 });
});

test('a box id is not mistaken for a point (never begins with @)', () => {
  for (const id of ['ceo', 'e1a2b3', '0', 'role-2']) {
    assert.equal(isEdgePoint(id), false, `${id} is an id`);
    assert.equal(parseEdgePoint(id), null);
  }
  assert.equal(isEdgePoint('@notanumber'), false, 'a malformed sentinel is not a point');
});

test('edgeEndRect: a point → a zero-size rect; an id → its rect; a dangling id → null', () => {
  const rectById = new Map<string, EdgeRect>([['ceo', { x: 10, y: 20, w: 100, h: 50 }]]);
  assert.deepEqual(edgeEndRect('@200,300', rectById), { x: 200, y: 300, w: 0, h: 0 });
  assert.deepEqual(edgeEndRect('ceo', rectById), { x: 10, y: 20, w: 100, h: 50 });
  assert.equal(edgeEndRect('gone', rectById), null);
});

test('the existing routing math already handles a point endpoint (zero-size rect)', () => {
  // A free point → a box: the straight route leaves the point itself and meets the box
  // border. This is the whole reason a point is modelled as a 0×0 rect - no new routing.
  const point = edgeEndRect('@50,-100', new Map())!;      // { x:50, y:-100, w:0, h:0 }
  const box: EdgeRect = { x: 0, y: 0, w: 100, h: 50 };
  const pts = edgeWaypoints(point, box, 'straight');
  assert.deepEqual(pts[0], { x: 50, y: -100 }, 'leaves the free point exactly');
  assert.deepEqual(pts[pts.length - 1]!, { x: 50, y: 0 }, 'meets the top-centre border of the box');
});

// ── Committed builder (the exported connector layer - plan 90 R1) ──────────────

const RENDER_OPTS = { width: 1600, height: 1000, defaultStyle: 'straight', defaultArrow: 'end', defaultHead: 'triangle', defaultColor: '#30ba78', defaultWidth: 3 };

test('buildConnectorSvg: a node→node edge renders a shaft path + a head, in a canvas-sized svg', () => {
  const rectById = new Map<string, EdgeRect>([
    ['a', { x: 0, y: 0, w: 100, h: 50 }],
    ['b', { x: 0, y: 300, w: 100, h: 50 }],
  ]);
  const svg = buildConnectorSvg([{ from: 'a', to: 'b' }], rectById, RENDER_OPTS);
  assert.match(svg, /^<svg class="lolly-connectors" width="1600" height="1000" viewBox="0 0 1600 1000"/);
  assert.match(svg, /<path d="M[^"]*" fill="none" stroke="#30ba78"/, 'the shaft');
  assert.match(svg, /Z" fill="#30ba78"\/>/, 'a filled triangle head');
  assert.doesNotMatch(svg, /<marker|<polygon|stroke-dasharray/, 'export-safe: no markers/polygons/dash-arrays');
});

test('buildConnectorSvg: a free point endpoint renders (not treated as a dangling id)', () => {
  const rectById = new Map<string, EdgeRect>([['b', { x: 0, y: 300, w: 100, h: 50 }]]);
  const svg = buildConnectorSvg([{ from: '@50,-100', to: 'b' }], rectById, RENDER_OPTS);
  assert.match(svg, /<path d="M50 -100/, 'the shaft leaves the free point');
});

test('buildConnectorSvg: a dangling id draws nothing; a point inside a box still draws', () => {
  const rectById = new Map<string, EdgeRect>([['a', { x: 0, y: 0, w: 100, h: 50 }]]);
  assert.equal(buildConnectorSvg([{ from: 'a', to: 'gone' }], rectById, RENDER_OPTS).replace(/<svg[^>]*>|<\/svg>/g, ''), '', 'dangling → empty body');
  // A point at (50,25) sits inside box a - a nested NODE pair would be suppressed, but a
  // deliberate point endpoint is not.
  const svg = buildConnectorSvg([{ from: 'a', to: '@50,25' }], rectById, RENDER_OPTS);
  assert.match(svg, /<path /, 'a point inside a box is a real endpoint, not an overlap to skip');
});

test('buildConnectorSvg: dashed edges use real <line> segments, never stroke-dasharray', () => {
  const rectById = new Map<string, EdgeRect>([
    ['a', { x: 0, y: 0, w: 100, h: 50 }], ['b', { x: 0, y: 300, w: 100, h: 50 }],
  ]);
  const svg = buildConnectorSvg([{ from: 'a', to: 'b', dash: 'dashed', arrow: 'none' }], rectById, RENDER_OPTS);
  assert.match(svg, /<line /, 'dashes are real segments');
  assert.doesNotMatch(svg, /stroke-dasharray/, 'never a dash-array in the committed layer');
});

// ── Heads on an authored PATH (plan 96 P1) ────────────────────────────────────
// The unified path primitive (spline = line = connector) decorates its own ends. The
// head-for-a-tip primitive takes tip + OUTWARD tangent in radians instead of a unit
// vector, and must draw the very same shapes a routed connector does - one geometry
// source, so a spline, a line and a connector are indistinguishable in the export.

test('pathHeadSvg: an angle drives the same shapes as the unit-vector form', () => {
  const size = pathHeadSize(3);                       // the shared width → head-size rule
  for (const head of ['triangle', 'diamond', 'circle', 'bar', 'open']) {
    for (const [ang, ux, uy] of [[0, 1, 0], [Math.PI / 2, 0, 1], [Math.PI, -1, 0]] as const) {
      assert.equal(
        pathHeadSvg({ tipX: 40, tipY: 25, angle: ang, head, color: '#30ba78', width: 3 }),
        edgeArrowHead({ x: 40, y: 25 }, Math.cos(ang), Math.sin(ang), size, '#30ba78', head),
        `${head} @ ${ang}`,
      );
      // …and the unit vector the angle stands for is the one a caller would pass.
      assert.ok(Math.abs(Math.cos(ang) - ux) < 1e-9 && Math.abs(Math.sin(ang) - uy) < 1e-9);
    }
  }
});

test('pathHeadSvg: golden — a tip at the origin pointing +x matches the connector head', () => {
  // Same numbers as the edgeArrowHead goldens above, reached through the path surface:
  // width 2.5 → size max(9, 10) = 10.
  assert.equal(pathHeadSvg({ tipX: 0, tipY: 0, angle: 0, head: 'triangle', color: '#30ba78', width: 2.5 }),
    '<path d="M0 0L-10 5.2L-10 -5.2Z" fill="#30ba78"/>');
  assert.equal(pathHeadSvg({ tipX: 0, tipY: 0, angle: 0, head: 'diamond', color: '#30ba78', width: 2.5 }),
    '<path d="M0 0L-10 5.2L-20 0L-10 -5.2Z" fill="#30ba78"/>');
});

test('pathHeadSvg: none (or junk width/angle/colour) never emits anything unsafe', () => {
  assert.equal(pathHeadSvg({ tipX: 0, tipY: 0, angle: 0, head: 'none', color: '#30ba78', width: 3 }), '');
  assert.equal(pathHeadSvg({ tipX: 0, tipY: 0, angle: 0, head: '', color: '#30ba78', width: 3 }), '');
  const junk = pathHeadSvg({
    tipX: NaN, tipY: undefined as unknown as number, angle: NaN,
    head: 'triangle', color: '#f00"onload=alert(1)', width: NaN,
  });
  assert.match(junk, /&quot;/, 'the colour is attribute-escaped, as on a connector');
  assert.doesNotMatch(junk, /NaN|undefined/, 'junk numbers fall back, they do not leak');
  assert.doesNotMatch(junk, /<marker|<polygon|transform=/, 'export-safe');
});

test('pathHeadSize / pathHeadInset: the head sizing is the connector rule, clamped', () => {
  assert.equal(pathHeadSize(2.5), 10);
  assert.equal(pathHeadSize(1), 9, 'the 9px floor');
  assert.equal(pathHeadSize(1000), 80, 'stroke width clamps at 20');
  assert.equal(pathHeadSize(NaN), 10, 'a junk width falls back to the connector default');
  // The inset is edgeHeadInset at that size - filled heads pull the shaft back, open/bar
  // do not, and 'none' never does.
  assert.equal(pathHeadInset('none', 2.5), 0);
  assert.equal(pathHeadInset('open', 2.5), 0);
  assert.equal(pathHeadInset('triangle', 2.5), edgeHeadInset('triangle', 10));
  assert.equal(pathHeadInset('diamond', 2.5), edgeHeadInset('diamond', 10));
});

test('makeConnectorsApi: the factory every shell attaches carries the whole surface', () => {
  const api = makeConnectorsApi();
  assert.equal(typeof api.build, 'function');
  assert.equal(typeof api.pathHeadSvg, 'function');
  assert.equal(typeof api.pathHeadInset, 'function');
  assert.equal(typeof api.dashFit?.parse, 'function');
  assert.equal(typeof api.dashFit?.cornerFitDashArray, 'function');
  assert.equal(typeof api.dashFit?.dashSegments, 'function');
  // The members are the engine functions themselves, not re-wrapped copies.
  assert.equal(api.build, buildConnectorSvg);
  assert.equal(api.pathHeadSvg, pathHeadSvg);
  assert.deepEqual(api.dashFit!.parse('6 4'), [6, 4]);
});

test('the arrowhead SHAPES are the engine\'s; the hook keeps only the inset it must', { skip: SKIP_SUSE }, () => {
  const engine = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const token of ['diamond', 'circle', 'bar', "'open'", '0.52', '0.5523', '0.42']) {
    assert.ok(engine.includes(token), `engine/connectors.ts should encode ${token}`);
  }
  const hook = readFileSync(HOOK_URL, 'utf8');
  // No head DRAWING in the hook - every shape comes back from host.connectors.pathHeadSvg.
  assert.doesNotMatch(hook, /function arrowHead\(|function circlePath\(/,
    'org-chart/hooks.js must not draw its own arrowheads');
  // The one number it legitimately still mirrors is the shaft PULL-BACK: the head is drawn
  // by the engine and the trim is applied here, so the two formulas have to agree. They are
  // written to agree, and this is the check that they still do - the constants, and the
  // pairing, are asserted against the engine's own edgeHeadInset below.
  assert.match(hook, /function headInsetFor\(/, 'the hook keeps its pull-back mirror');
  assert.equal(edgeHeadInset('triangle', 10), 9);
  assert.equal(edgeHeadInset('diamond', 10), 20);
  for (const [kind, expected] of [['triangle', 10 * 0.9], ['diamond', 20], ['open', 0], ['bar', 0], ['none', 0]] as const) {
    assert.equal(edgeHeadInset(kind, 10), expected, `${kind} inset`);
  }
});

// ── the spline kind → route mapping (plan 96 P3) ──────────────────────────────
// A BOUND path is drawn by connector management, and what picks the route is the shape the
// user already asked for: the path's own spline kind. Six kinds cannot name thirteen
// routes, so a box also carries an explicit `route` override - which is the thing that
// makes the plan-90 edge migration lossless, and therefore the thing worth pinning.

test('pathRouteStyle: each spline kind maps to its documented route', () => {
  assert.equal(pathRouteStyle('line', '', 2), 'straight', 'two points stay straight');
  assert.equal(pathRouteStyle('line', '', 4), 'elbow', 'an authored polyline TURNS → elbow');
  assert.equal(pathRouteStyle('spiro', '', 2), 'arc', "spiro's signature is one clean bow");
  for (const k of ['cubic', 'hyperbezier', 'catmull-rom', 'bspline']) {
    assert.equal(pathRouteStyle(k, '', 2), 'curved', `${k} → the smooth S`);
  }
  assert.equal(pathRouteStyle('no-such-kind', '', 2), 'straight', 'an unknown kind is not guessed at');
  assert.equal(pathRouteStyle(undefined, undefined, undefined), 'straight');
});

test('pathRouteStyle: an explicit route override wins, and only a REAL one', () => {
  for (const style of CONNECTOR_ROUTE_STYLES) {
    assert.equal(pathRouteStyle('line', style, 2), style, `${style} overrides the kind`);
    assert.equal(isConnectorRouteStyle(style), true);
  }
  // Junk, an empty string and a prototype key all fall through to the kind - the last of
  // those is why the membership test is an own-property one and not a bare index.
  for (const junk of ['', 'nope', 'constructor', 'toString', '__proto__', null, 7]) {
    assert.equal(pathRouteStyle('spiro', junk as never, 2), 'arc', `${String(junk)} is not a route`);
    assert.equal(isConnectorRouteStyle(junk), false);
  }
});

test('CONNECTOR_ROUTE_STYLES is exactly the set connectorRoute understands', () => {
  assert.equal(CONNECTOR_ROUTE_STYLES.length, 13);
  // Every listed style must route to at least two distinct points - i.e. it is a style the
  // router really implements, not a menu entry with nothing behind it.
  for (const style of CONNECTOR_ROUTE_STYLES) {
    const pts = edgeWaypoints(aTop, bDiag, style);
    assert.ok(pts.length >= 2, `${style} routes`);
    assert.notDeepEqual(pts[0], pts[pts.length - 1], `${style} goes somewhere`);
  }
});

// ── routedLineSvg: ONE committed geometry for an edge and for a bound path ─────

test('routedLineSvg: a bound path with two heads draws a shaft + both heads, export-safe', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }, b = { x: 0, y: 300, w: 100, h: 50 };
  const out = routedLineSvg(a, b, {
    style: 'straight', headStart: 'circle', headEnd: 'triangle',
    dash: 'solid', color: '#30ba78', width: 3,
  });
  assert.match(out, /<path d="M[^"]*" fill="none" stroke="#30ba78"/, 'the shaft');
  assert.equal((out.match(/fill="#30ba78"\/>/g) || []).length, 2, 'a head at each end');
  assert.doesNotMatch(out, /<marker|<polygon|stroke-dasharray|transform=/, 'export-safe');
});

test('routedLineSvg: the edge reading and the path reading are the SAME drawing', () => {
  // This is the migration invariant in one line: `arrow:'end'` + `head:'open'` IS
  // `headStart:'none'` + `headEnd:'open'`, byte for byte, because buildConnectorSvg reduces
  // the first to the second before any geometry happens.
  const rectById = new Map<string, EdgeRect>([
    ['a', { x: 0, y: 0, w: 100, h: 50 }], ['b', { x: 300, y: 400, w: 100, h: 50 }],
  ]);
  const body = (svg: string): string => svg.replace(/^<svg[^>]*>|<\/svg>$/g, '');
  for (const style of CONNECTOR_ROUTE_STYLES) {
    for (const [arrow, hs, he] of [['end', 'none', 'open'], ['both', 'open', 'open'], ['none', 'none', 'none']] as const) {
      const legacy = buildConnectorSvg([{ from: 'a', to: 'b', style, arrow, head: 'open', dash: 'solid', color: '#30ba78', width: 3.5 }],
        rectById, { width: 800, height: 600 });
      const path = buildConnectorSvg([{ from: 'a', to: 'b', style, headStart: hs, headEnd: he, dash: 'solid', color: '#30ba78', width: 3.5 }],
        rectById, { width: 800, height: 600, headStartField: 'headStart', headEndField: 'headEnd' });
      assert.equal(body(path), body(legacy), `${style} / arrow=${arrow}`);
    }
  }
});

test('routedLineSvg: an AUTHORED dash pattern is real <line> segments, never a dasharray', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }, b = { x: 0, y: 400, w: 100, h: 50 };
  const out = routedLineSvg(a, b, {
    style: 'straight', headStart: 'none', headEnd: 'none',
    dash: 'solid', dashArray: [10, 6], dashFit: true, color: '#30ba78', width: 2,
  });
  const lines = out.match(/<line /g) || [];
  assert.ok(lines.length >= 10, `the 350px run is cut into dashes (got ${lines.length})`);
  assert.doesNotMatch(out, /stroke-dasharray|<path/, 'no dasharray and no continuous shaft');
  // The fit divides the span so a whole number of periods lands on it: the inked total is
  // the same ink cornerFitDashArray reports for the same span.
  const inked = [...out.matchAll(/x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g)]
    .reduce((acc, m) => acc + Math.hypot(Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])), 0);
  const fit = cornerFitDashArray([350], [10, 6]);
  const want = fit.filter((_, i) => i % 2 === 0).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(inked - want) < 0.5, `inked ${inked} vs the fit's ${want}`);
});

test('routedLineSvg: an elbow route corner-fits its dashes per span', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 }, b = { x: 400, y: 400, w: 100, h: 50 };
  const fitted = routedLineSvg(a, b, {
    style: 'elbow', headStart: 'none', headEnd: 'none',
    dash: 'solid', dashArray: [12, 8], dashFit: true, color: '#000', width: 2,
  });
  const plain = routedLineSvg(a, b, {
    style: 'elbow', headStart: 'none', headEnd: 'none',
    dash: 'solid', dashArray: [12, 8], dashFit: false, color: '#000', width: 2,
  });
  assert.notEqual(fitted, plain, 'the corner fit changes where the dashes land');
  for (const out of [fitted, plain]) assert.doesNotMatch(out, /stroke-dasharray/);
});

// ── Design: the unified render, end to end (plan 96 P3/P5) ──────────────
//
// The pieces above are the engine's. This drives the REAL parent-owned pack (brands/
// lolly-start, present in every public checkout) through the engine, because the thing
// worth guarding is the SEAM: a free path draws inside its own box <svg>, a bound one
// steps aside and is drawn by connector management in the canvas-sized layer, and both
// carry the same decorations from the same primitives. Getting that wrong draws a
// connector twice, or not at all.

const LS_PACK = join(dirname(fileURLToPath(import.meta.url)), '..', 'brands', 'lolly-start', 'tools');
const lsTool: any = await loadTool('design', (p: string) => readFile(join(LS_PACK, p), 'utf8'));
const LS_HOST = (): unknown => baseHost({ connectors: makeConnectorsApi(), geom: makeGeomApi() });

async function layoutStudio(boxes: unknown[]): Promise<{ html: string; layer: string }> {
  const rt = await createRuntime(lsTool, LS_HOST() as never, { boxes } as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const html = rt.getHydrated() as string;
  const m = /<svg class="lolly-connectors"[\s\S]*?<\/svg>/.exec(html);
  return { html, layer: m ? m[0] : '' };
}

/** A two-node line box, free unless a binding is passed. */
const lineBox = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'ln', kind: 'path', x: 200, y: 200, w: 400, h: 300, rot: 0, shape: 'rect', bg: '',
  path: '1!line!0_0!0_1!1', stroke: '#c8102e', strokeW: 5,
  strokeCap: 'round', strokeJoin: 'round', headStart: 'none', headEnd: 'triangle',
  bindStart: '', bindEnd: '', ...extra,
});
const card = (id: string, x: number, y: number): Record<string, unknown> =>
  ({ id, kind: 'box', x, y, w: 240, h: 120, rot: 0, shape: 'rounded', radius: 12, bg: '#5283d5', text: id });

test('design: a FREE path draws in its own box svg and no connector layer appears', async () => {
  const { html, layer } = await layoutStudio([lineBox()]);
  assert.match(html, /class="lolly-box-path"/, 'the box draws its own shape');
  assert.equal(layer, '', 'nothing bound → no layer at all, so an ordinary doc is unchanged');
});

test('design: binding an end hands the SAME box to connector management', async () => {
  const { html, layer } = await layoutStudio([card('a', 80, 80), card('b', 700, 640), lineBox({ bindStart: 'a', bindEnd: 'b' })]);
  assert.doesNotMatch(html, /class="lolly-box-path"/, 'the box svg steps aside');
  assert.match(layer, /^<svg class="lolly-connectors" width="1080" height="1080"/);
  assert.match(layer, /<path d="M[^"]*" fill="none" stroke="#c8102e" stroke-width="5"/, 'the shaft, in the path\'s own ink');
  assert.match(layer, /Z" fill="#c8102e"\/>/, 'and its arrowhead');
  assert.doesNotMatch(layer, /<marker|<polygon|stroke-dasharray/, 'export-safe committed layer');
});

test('design: the SPLINE KIND picks the route, and `route` overrides it', async () => {
  const both = { bindStart: 'a', bindEnd: 'b' };
  const cards = [card('a', 80, 80), card('b', 700, 640)];
  // A two-node `line` routes straight: one M…L, no corner quadratics.
  const straight = await layoutStudio([...cards, lineBox(both)]);
  assert.match(straight.layer, /d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+"/, 'line → straight');
  // A smooth kind routes as the curved S: one cubic.
  const curved = await layoutStudio([...cards, lineBox({ ...both, path: '1!hyperbezier!0_0!0_1!1' })]);
  assert.match(curved.layer, /d="M[^"]*C[^"]*"/, 'hyperbezier → curved S');
  // …and the override wins over both, with the bend fraction the style names.
  const src = await layoutStudio([...cards, lineBox({ ...both, route: 'elbow-src' })]);
  assert.match(src.layer, /Q/, 'elbow-src → a rounded orthogonal elbow');
  assert.notEqual(src.layer, straight.layer);
  assert.notEqual(src.layer, curved.layer);
});

test('design: a HALF-bound path routes from the box to its own free node', async () => {
  const { layer } = await layoutStudio([card('a', 80, 80), lineBox({ bindStart: 'a' })]);
  // The free end is the last node in canvas px: x + 1·w, y + 1·h = (600, 500).
  const tip = /L([\d.]+) ([\d.]+)"/.exec(layer);
  assert.ok(tip, `the shaft ends somewhere: ${layer}`);
  // The SHAFT stops a gap plus the head's inset short of the endpoint - 16 + 18 at width 5,
  // i.e. 34px back along the route - because a routed head sits in clear space rather than
  // jammed against its own tip. So "reaches it" means within that, and nowhere near the card.
  assert.ok(Math.hypot(Number(tip[1]) - 600, Number(tip[2]) - 500) < 40,
    `it reaches the free node (600,500), got ${tip[1]},${tip[2]}`);
});

test('design: an authored dash pattern on a BOUND path is real <line> segments', async () => {
  const { layer } = await layoutStudio([
    card('a', 80, 80), card('b', 700, 640),
    lineBox({ bindStart: 'a', bindEnd: 'b', headEnd: 'none', strokeDashArray: '14 8', dashFit: true }),
  ]);
  assert.ok((layer.match(/<line /g) || []).length >= 8, 'the run is cut into dashes');
  assert.doesNotMatch(layer, /stroke-dasharray/, 'never a dasharray in the committed layer');
});

test('design: a dangling binding draws nothing rather than guessing', async () => {
  const { html, layer } = await layoutStudio([card('a', 80, 80), lineBox({ bindStart: 'a', bindEnd: 'gone' })]);
  assert.equal(layer, '<svg class="lolly-connectors" width="1080" height="1080" viewBox="0 0 1080 1080" preserveAspectRatio="none" aria-hidden="true"></svg>',
    'an empty layer, not a line to nowhere');
  assert.doesNotMatch(html, /class="lolly-box-path"/, 'and the box does not draw it either — it IS bound');
});
