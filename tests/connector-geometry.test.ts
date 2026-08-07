// SPDX-License-Identifier: MPL-2.0
// Golden + parity tests for the editor's connector routing geometry
// (shells/web/src/views/free-canvas-math.ts). This math was lifted out of
// free-canvas.ts so it could be tested, and it MIRRORS the committed-render routing in
// brands/suse/tools/org-chart/hooks.js. These golden values lock the shell path output;
// the parity test at the end guards the elbow fractions from drifting between the two files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  edgeWaypoints, edgeBorderPt, edgeNested, roundedEdgePath, smoothEdgePath,
  edgeArrowHead, edgeHeadInset,
  isEdgePoint, parseEdgePoint, formatEdgePoint, edgeEndRect, buildConnectorSvg,
} from '../shells/web/src/views/free-canvas-math.ts';
import type { EdgeRect } from '../shells/web/src/views/free-canvas-math.ts';

// org-chart ships in the (private) SUSE brand pack; the hook↔shell parity
// tests can only run when the pack is mounted (see profiles.json). Gate on the
// SOURCE pack, not the gitignored tools/ profile view: with the pack mounted, a
// missing hooks.js means the tool was renamed or deleted — FAIL, don't skip.
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

test('parity: the tool hook and the shell math share the elbow fractions', { skip: SKIP_SUSE }, () => {
  // org-chart/hooks.js (committed render) and free-canvas-math.ts (editor preview)
  // hand-mirror the routing. If someone re-tunes the elbow bend in one, this fails.
  const hook = readFileSync(HOOK_URL, 'utf8');
  const shell = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const frac of ['0.18', '0.82']) {
    assert.ok(hook.includes(frac), `hooks.js should encode elbow fraction ${frac}`);
    assert.ok(shell.includes(frac), `engine/connectors.ts should encode elbow fraction ${frac}`);
  }
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

test('parity: the tool hook and the shell math share the arc variants', { skip: SKIP_SUSE }, () => {
  const hook = readFileSync(HOOK_URL, 'utf8');
  const shell = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const key of ['arc-wide', 'arc-flip', 'arc-flip-wide']) {
    assert.ok(hook.includes(key), `hooks.js should encode arc variant ${key}`);
    assert.ok(shell.includes(key), `free-canvas-math.ts should encode arc variant ${key}`);
  }
});

// ── Arrowheads (export-safe geometry — plan 90 thread A) ───────────────────────
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
  // border. This is the whole reason a point is modelled as a 0×0 rect — no new routing.
  const point = edgeEndRect('@50,-100', new Map())!;      // { x:50, y:-100, w:0, h:0 }
  const box: EdgeRect = { x: 0, y: 0, w: 100, h: 50 };
  const pts = edgeWaypoints(point, box, 'straight');
  assert.deepEqual(pts[0], { x: 50, y: -100 }, 'leaves the free point exactly');
  assert.deepEqual(pts[pts.length - 1]!, { x: 50, y: 0 }, 'meets the top-centre border of the box');
});

// ── Committed builder (the exported connector layer — plan 90 R1) ──────────────

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
  // A point at (50,25) sits inside box a — a nested NODE pair would be suppressed, but a
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

test('parity: the tool hook and the shell math share the arrowhead shapes + inset constants', { skip: SKIP_SUSE }, () => {
  // arrowHead()/headInset() in org-chart/hooks.js and edgeArrowHead()/edgeHeadInset() here
  // hand-mirror each other until plan 90 R1 makes the shell the sole committed renderer.
  const hook = readFileSync(HOOK_URL, 'utf8');
  const shell = readFileSync(new URL('../engine/src/connectors.ts', import.meta.url), 'utf8');
  for (const token of ['diamond', 'circle', 'bar', "'open'", '0.52', '0.5523', '0.42']) {
    assert.ok(hook.includes(token), `hooks.js should encode ${token}`);
    assert.ok(shell.includes(token), `free-canvas-math.ts should encode ${token}`);
  }
});
