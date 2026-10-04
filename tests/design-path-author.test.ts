// SPDX-License-Identifier: MPL-2.0
/**
 * designPathPlacement (plan 291 W5): absolute points or an SVG `d` to a stored Design
 * path row, fitted with the pen tool's own frame rule.
 *
 * The oracle is geometric, never a `d` string: the stored row is read back the way the
 * renderer reads it (x and y rounded, w and h rounded with a floor of 1, nodes scaled by
 * them), lowered to cubics, and compared with the stated geometry by the largest distance
 * from either curve to the other. The codec keeps six decimals of a fraction, so the
 * tolerance is 1e-3 px.
 *
 * The fixture under tests/fixtures/design-path-author/ is synthetic. The last test reads
 * the delivered deck's rows from a private file named by LOLLY_DESIGN_PATHS_GOLDEN and is
 * skipped without that file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { designPathPlacement, type DesignPathGeometry, type DesignPathPlacement } from '../engine/src/design-path-author.ts';
import { authoredFromSubPaths, refitAuthoredFrame, scaleAuthored } from '../engine/src/geom/authored-frame.ts';
import { decodeAuthoredPaths, encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { type Cubic, evalCubic, nearestOnCubic } from '../engine/src/geom/bezier.ts';
import { closeContour } from '../engine/src/geom/path.ts';
import { toCubics, type AuthoredPath, type SplineKind } from '../engine/src/geom/spline.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { parseSvgPath } from '../engine/src/svg-path.ts';
import { pathHeadSvg } from '../engine/src/connectors.ts';
import { penCommitFromNative, refitFrame } from '../shells/web/src/views/free-canvas-pen.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TOL = 1e-3;

interface Case {
  name: string;
  geometry: DesignPathGeometry;
  origin: { x: number; y: number };
  paint: Record<string, string | number>;
  expect: { x: number; y: number; w: number; h: number; path: string; paint: { x: number; y: number; w: number; h: number } };
}
const FIXTURE = JSON.parse(readFileSync(join(HERE, 'fixtures', 'design-path-author', 'cases.json'), 'utf8')) as { cases: Case[] };

type Row = { x: number; y: number; w: number; h: number; path: string };

// ── the oracle ───────────────────────────────────────────────────────────────

/** A stored row's contours in canvas px, read as the renderer reads it (or unrounded). */
function absolutePaths(row: Row, rounded = true): AuthoredPath[] {
  const x = rounded ? Math.round(row.x) : row.x;
  const y = rounded ? Math.round(row.y) : row.y;
  const w = rounded ? Math.max(1, Math.round(row.w)) : row.w;
  const h = rounded ? Math.max(1, Math.round(row.h)) : row.h;
  const paths = decodeAuthoredPaths(row.path);
  assert.ok(paths, `the stored value decodes: ${row.path}`);
  return paths!.map((p) => {
    const local = scaleAuthored(p, w, h);
    return { ...local, nodes: local.nodes.map((n) => ({ ...n, x: n.x + x, y: n.y + y })) };
  });
}

/** Every cubic a row draws, in canvas px. */
function drawn(row: Row, rounded = true): Cubic[] {
  return absolutePaths(row, rounded).flatMap((p) => toCubics(p));
}

/** What the geometry states, in canvas px: points through the same spline lowering,
 *  a `d` through the strict parser, closed subpaths with their closing edge. */
function intended(g: DesignPathGeometry, origin: { x: number; y: number }): Cubic[] {
  if (g.points) {
    const nodes = g.points.map(([x, y]) => ({ x: x + origin.x, y: y + origin.y }));
    const path: AuthoredPath = { kind: (g.curve ?? 'line') as SplineKind, closed: g.closed === true, nodes };
    if (g.tension !== undefined) path.tension = g.tension;
    return toCubics(path);
  }
  const parsed = makeGeomApi().parse(g.d!);
  if (!parsed.ok) assert.fail(`the stated d parses: ${parsed.message}`);
  const out: Cubic[] = [];
  for (const c of parsed.value) {
    const moved = { closed: c.closed, curves: c.curves.map((k) => k.map((v, i) => v + (i % 2 ? origin.y : origin.x)) as Cubic) };
    out.push(...(moved.closed ? closeContour(moved) : moved).curves);
  }
  return out;
}

/** The largest distance from any point of one curve set to the other, both ways. */
function distance(a: Cubic[], b: Cubic[]): number {
  const oneWay = (from: Cubic[], to: Cubic[]): number => {
    let worst = 0;
    for (const c of from) {
      for (let i = 0; i <= 24; i++) {
        const p = evalCubic(c, i / 24);
        let best = Infinity;
        for (const k of to) best = Math.min(best, nearestOnCubic(k, p.x, p.y).distance);
        worst = Math.max(worst, best);
      }
    }
    return worst;
  };
  return Math.max(oneWay(a, b), oneWay(b, a));
}

/** The geometry a stored row draws, stated again as absolute input. */
function restated(row: Row): DesignPathGeometry {
  const paths = absolutePaths(row);
  const only = paths[0]!;
  if (paths.length === 1 && only.kind !== 'cubic') {
    return {
      points: only.nodes.map((n) => [n.x, n.y] as [number, number]),
      closed: only.closed,
      ...(only.kind !== 'line' ? { curve: only.kind as DesignPathGeometry['curve'] } : {}),
      ...(only.tension !== undefined ? { tension: only.tension } : {}),
    };
  }
  let d = '';
  for (const p of paths) {
    const n = p.nodes;
    d += `M${n[0]!.x} ${n[0]!.y}`;
    for (let i = 1; i < n.length; i++) {
      const a = n[i - 1]!, b = n[i]!;
      if (a.hOutX !== undefined || a.hOutY !== undefined || b.hInX !== undefined || b.hInY !== undefined) {
        d += `C${a.x + (a.hOutX ?? 0)} ${a.y + (a.hOutY ?? 0)} ${b.x + (b.hInX ?? 0)} ${b.y + (b.hInY ?? 0)} ${b.x} ${b.y}`;
      } else {
        d += `L${b.x} ${b.y}`;
      }
    }
    if (p.closed) d += 'Z';
  }
  return { d };
}

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (err) {
    assert.match((err as Error).message, /^geom: /, 'every refusal says geom:');
    return String((err as { code?: unknown }).code);
  }
  return 'no error';
};

// ── the fixture ──────────────────────────────────────────────────────────────

for (const c of FIXTURE.cases) {
  test(`fixture: ${c.name}`, () => {
    const got = designPathPlacement(c.geometry, { origin: c.origin, ...c.paint });
    const { x, y, w, h, path, paint } = got;
    assert.deepEqual({ x, y, w, h, path, paint }, c.expect, 'the stored row and its paint rectangle');
    for (const v of [x, y, w, h]) assert.ok(Number.isInteger(v), `the frame is whole pixels: ${v}`);
    assert.ok(w >= 1 && h >= 1);

    const off = distance(drawn(got), intended(c.geometry, c.origin));
    assert.ok(off <= TOL, `drawn within ${TOL} px of the stated geometry (off by ${off})`);

    // The curve's own bounds sit inside the frame, give or take the rounding.
    const b = got.bounds;
    assert.ok(b.x >= x - 0.5 && b.y >= y - 0.5 && b.x + b.w <= x + w + 0.5 && b.y + b.h <= y + h + 0.5,
      `bounds ${JSON.stringify(b)} inside the frame ${JSON.stringify({ x, y, w, h })}`);

    // Idempotence: the drawn geometry, stated again, places to the same row.
    const again = designPathPlacement(restated(got), c.paint);
    assert.deepEqual([again.x, again.y, again.w, again.h, again.path], [x, y, w, h, path], 'a placed row is a fixed point');
  });
}

test('a sub-pixel tick gets a whole-pixel frame, with the offset carried in the fractions', () => {
  const tick = designPathPlacement({ d: 'M1078.79 896L1078.79 908' }, { origin: { x: 4160, y: 0 } });
  assert.deepEqual([tick.x, tick.y, tick.w, tick.h, tick.path], [5238, 896, 1, 12, '1!line!0_.79!0_.79!1']);
  assert.ok(Math.abs(tick.bounds.x - 5238.79) < 1e-9 && tick.bounds.w === 0);
});

test('rounding happens on the canvas after the origin is added', () => {
  // 0.4 + 0.4 rounds up only once the two are summed.
  const a = designPathPlacement({ points: [[10.4, 0], [20.4, 5]] }, { origin: { x: 0.4, y: 0 } });
  assert.equal(a.x, 11);
  const local = designPathPlacement({ points: [[10.4, 0], [20.4, 5]] });
  assert.equal(local.x, 10);
});

test('the stroke never grows the stored frame; paint reports the padded rectangle', () => {
  const bare = designPathPlacement({ points: [[0, 0], [100, 50]] });
  const stroked = designPathPlacement({ points: [[0, 0], [100, 50]] }, { stroke: '#000000', strokeW: 10, strokeCap: 'square', strokeJoin: 'miter' });
  assert.deepEqual([stroked.x, stroked.y, stroked.w, stroked.h], [bare.x, bare.y, bare.w, bare.h]);
  // A miter join reaches strokeW * 4 / 2 = 20 on each side.
  assert.deepEqual(stroked.paint, { x: -20, y: -20, w: 140, h: 90 });
  assert.deepEqual(bare.paint, { x: 0, y: 0, w: 100, h: 50 }, 'no stroke, no pad');
  const textual = designPathPlacement({ points: [[0, 0], [100, 50]] }, { stroke: '#000000', strokeW: '4' });
  assert.deepEqual(textual.paint, { x: -2, y: -2, w: 104, h: 54 }, 'a numeric string strokeW reads as a number');
});

// ── the d grammar ────────────────────────────────────────────────────────────

test('d: relative commands, H and V, and Z close a straight rectangle as kind line', () => {
  const r = designPathPlacement({ d: 'm10 10 h100 v50 h-100 z' });
  assert.deepEqual([r.x, r.y, r.w, r.h], [10, 10, 100, 50]);
  const [p] = decodeAuthoredPaths(r.path)!;
  assert.equal(p!.kind, 'line');
  assert.equal(p!.closed, true);
  assert.equal(p!.nodes.length, 4, 'Z adds no node');
});

test('d: a quadratic raises to a cubic whose handles reach past the tight frame', () => {
  const r = designPathPlacement({ d: 'M0 0 Q50 100 100 0' });
  assert.deepEqual([r.x, r.y, r.w, r.h], [0, 0, 100, 50], 'the frame is the curve, not the control hull');
  const [p] = decodeAuthoredPaths(r.path)!;
  assert.ok(Math.abs(p!.nodes[0]!.hOutY! - 4 / 3) < 1e-5, 'the handle sits at 1.333 of the height');
});

test('d: an arc becomes cubics, framed by its tight bounds', () => {
  const r = designPathPlacement({ d: 'M0 0 A50 50 0 0 1 100 0' });
  assert.deepEqual([r.x, r.y, r.w, r.h], [0, -50, 100, 50]);
  assert.equal(decodeAuthoredPaths(r.path)![0]!.kind, 'cubic');
});

test('d: a closed subpath that repeats its start collapses the repeat', () => {
  const r = designPathPlacement({ d: 'M0 0L100 0L100 50L0 0Z' });
  assert.equal(decodeAuthoredPaths(r.path)![0]!.nodes.length, 3);
});

test('d: several subpaths stay several contours in one value', () => {
  const r = designPathPlacement({ d: 'M0 0L10 0L10 10Z M20 0L30 0L30 10Z' });
  assert.equal(decodeAuthoredPaths(r.path)!.length, 2);
  assert.deepEqual([r.x, r.w], [0, 30]);
});

// ── refusals ─────────────────────────────────────────────────────────────────

test('refusals carry a code and a geom: message', () => {
  assert.equal(codeOf(() => designPathPlacement({ d: 'M0 0 L10 10 oops' })), 'invalid-path');
  assert.equal(codeOf(() => designPathPlacement({ d: 'L10 10' })), 'invalid-path');
  assert.equal(codeOf(() => designPathPlacement({ d: 'M0 0' })), 'empty');
  assert.equal(codeOf(() => designPathPlacement({ d: '' })), 'empty');
  assert.equal(codeOf(() => designPathPlacement({ points: [[5, 5]] })), 'empty');
  assert.equal(codeOf(() => designPathPlacement({ points: [[5, 5], [5, 5], [5, 5]] })), 'empty');
  assert.equal(codeOf(() => designPathPlacement({ points: Array.from({ length: 20_001 }, (_, i) => [i, i % 2] as [number, number]) })), 'too-large');
  assert.equal(codeOf(() => designPathPlacement({ d: `M0 0${' L1 1'.repeat(20_001)}` })), 'too-large');
  assert.equal(codeOf(() => designPathPlacement({ d: `M0 0 L${'1'.repeat(400_001)} 0` })), 'too-large');
  assert.equal(codeOf(() => designPathPlacement({})), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [1, 1]], d: 'M0 0L1 1' })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [Number.NaN, 1]] })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [2e9, 1]] })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [1, 1]], curve: 'zigzag' as never })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [1, 1]] }, { headEnd: 'constructor' })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [1, 1]] }, { strokeCap: 'pointy' })), 'invalid-argument');
  assert.equal(codeOf(() => designPathPlacement({ points: [[0, 0], [1, 1]], tension: 3, curve: 'catmull-rom' })), 'invalid-argument');
});

test('numeric strings read as numbers, the way the blocks wire format carries them', () => {
  const a = designPathPlacement({ points: [['10', '20'] as never, [110, 20]] }, { origin: { x: '100' as never, y: 0 } });
  assert.deepEqual([a.x, a.y, a.w], [110, 20, 100]);
});

// ── notes ────────────────────────────────────────────────────────────────────

test('notes say when an arrowhead will not draw, and that a bar has no PowerPoint end', () => {
  const stroke = { stroke: '#000000', strokeW: 2 };
  const closed = designPathPlacement({ points: [[0, 0], [10, 0], [10, 10]], closed: true }, { ...stroke, headEnd: 'triangle' });
  assert.match(closed.notes.join(' '), /closed path has no ends/);
  const bare = designPathPlacement({ points: [[0, 0], [10, 0]] }, { headEnd: 'open' });
  assert.match(bare.notes.join(' '), /needs a stroke/);
  assert.deepEqual(bare.paint, { x: 0, y: 0, w: 10, h: 1 }, 'an undrawn head adds no pad');
  const several = designPathPlacement({ d: 'M0 0L10 0M0 5L10 5' }, { ...stroke, headStart: 'circle' });
  assert.match(several.notes.join(' '), /one contour/);
  const bar = designPathPlacement({ points: [[0, 0], [10, 0]] }, { ...stroke, headEnd: 'bar' });
  assert.match(bar.notes.join(' '), /bar head has no PowerPoint line end/);
  assert.deepEqual(designPathPlacement({ points: [[0, 0], [10, 0]] }, { ...stroke, headEnd: 'open' }).notes, []);
  assert.match(designPathPlacement({ points: [[0, 0], [10, 0]], curve: 'cubic' }).notes.join(' '), /straight between them/);
  assert.match(designPathPlacement({ d: 'M0 0L10 0', closed: true }).notes.join(' '), /Z closes/);
});

// ── one fitting rule with the pen tool ───────────────────────────────────────

test('points agree byte for byte with the pen tool committing the same drawing', () => {
  const runs: Array<[Array<[number, number]>, boolean]> = [
    [[[100, 200], [900, 200]], false],
    [[[410.79, 500], [410.79, 512]], false],
    [[[40, 10], [100, 10], [80, 90], [0, 90]], true],
    [[[578, 390], [578, 457], [826, 457], [826, 792]], false],
    [[[3.3, 7.7], [44.1, 7.7], [20.5, 60.25]], true],
  ];
  for (const [points, closed] of runs) {
    const mine = designPathPlacement({ points, closed });
    const pen = penCommitFromNative({ kind: 'line', closed, nodes: points.map(([x, y]) => ({ x, y })) });
    assert.ok(pen);
    assert.deepEqual([mine.x, mine.y, mine.w, mine.h, mine.path], [pen!.x, pen!.y, pen!.w, pen!.h, encodeAuthoredPaths([pen!.path])]);
  }
  assert.equal(refitFrame, refitAuthoredFrame, 'the pen tool re-exports the engine fit');
});

test('authoredFromSubPaths: straight subpaths store no handles, curves store them on C only', () => {
  const [lines, mixed] = authoredFromSubPaths(parseSvgPath('M0 0L10 0L10 10Z M0 0C5 0 10 5 10 10L0 10'));
  assert.equal(lines!.kind, 'line');
  assert.ok(lines!.nodes.every((n) => n.hInX === undefined && n.hOutX === undefined));
  assert.equal(mixed!.kind, 'cubic');
  assert.deepEqual(mixed!.nodes[0], { x: 0, y: 0, hOutX: 5, hOutY: 0 });
  assert.deepEqual(mixed!.nodes[1], { x: 10, y: 10, hInX: 0, hInY: -5 });
  assert.deepEqual(mixed!.nodes[2], { x: 0, y: 10 }, 'the straight segment after the curve adds no handle');
  const [loop] = authoredFromSubPaths(parseSvgPath('M0 0C10 0 10 10 0 10C-10 10 -10 0 0 0Z'));
  assert.equal(loop!.nodes.length, 3, 'a closed run back to its start through one other node keeps the repeat');
  assert.deepEqual([loop!.nodes[2]!.hInX, loop!.nodes[2]!.hInY], [-10, 0], 'and the repeat keeps its incoming handle');
  assert.ok(distance(toCubics(loop!), intended({ d: 'M0 0C10 0 10 10 0 10C-10 10 -10 0 0 0Z' }, { x: 0, y: 0 })) <= TOL, 'so both halves of the loop are drawn');
  const [quad] = authoredFromSubPaths(parseSvgPath('M0 0L10 0C15 0 15 10 10 10L0 10C-5 10 -5 0 0 0Z'));
  assert.equal(quad!.nodes.length, 4, 'with three or more nodes left the repeat collapses');
  assert.deepEqual([quad!.nodes[0]!.hInX, quad!.nodes[0]!.hInY], [-5, 0], 'and its incoming handle moves to the first node');
});

test('d: a closed shape that returns to its start through one other node draws its closing curve', () => {
  for (const d of ['M0 0 Q50 -40 100 0 Q50 40 0 0 Z', 'M0 0 L100 0 Q50 60 0 0 Z', 'M0 0C10 0 10 10 0 10C-10 10 -10 0 0 0Z']) {
    const placed = designPathPlacement({ d });
    const off = distance(drawn(placed), intended({ d }, { x: 0, y: 0 }));
    assert.ok(off <= TOL, `${d} drawn within ${TOL} px (off by ${off})`);
    const markup = renderPath({ id: 'p', kind: 'path', x: placed.x, y: placed.y, w: placed.w, h: placed.h, path: placed.path, bg: '#000000' });
    const drawnD = /<path d="([^"]*)"/.exec(markup)?.[1] ?? '';
    assert.ok((drawnD.match(/C/g) ?? []).length >= 2, `the renderer draws the closing curve of ${d}: ${drawnD}`);
  }
});

test('d: a drawing command after Z starts a new subpath at the closed start', () => {
  const r = designPathPlacement({ d: 'M0 0 L10 0 Z L10 10' });
  const paths = decodeAuthoredPaths(r.path)!;
  assert.equal(paths.length, 2, 'the closed edge and the open line are separate subpaths');
  assert.deepEqual(paths.map((p) => p.closed), [true, false]);
  assert.ok(distance(drawn(r), intended({ d: 'M0 0 L10 0 Z M0 0 L10 10' }, { x: 0, y: 0 })) <= TOL);
});

// ── the paint rectangle is the svg the renderer draws ────────────────────────

/** hooks.js compiled the way the runtime compiles it (tests/design-path.test.ts does the same). */
function renderPath(row: Record<string, unknown>): string {
  const src = readFileSync(join(ROOT, 'community', 'design', 'hooks.js'), 'utf8');
  const factory = new Function('host', `${src}; return { onInit };`) as (h: unknown) => { onInit: (ctx: { model: unknown }) => { pathHtml: string[] } };
  const host = { geom: makeGeomApi(), connectors: { pathHeadSvg }, log: () => {} };
  const out = factory(host).onInit({ model: [
    { id: 'background', value: '#ffffff' },
    { id: 'transparentBg', value: false },
    { id: 'boxes', value: [row] },
  ] });
  return out.pathHtml[0]!;
}

test('paint matches the svg size and viewBox the renderer emits', () => {
  const cases: Array<[DesignPathGeometry, Record<string, string | number>, number]> = [
    [{ points: [[0, 0], [50, 0]] }, { stroke: '#123456', strokeW: 6, headEnd: 'open' }, 89.6],
    [{ points: [[0, 0], [175, 0], [135, 150], [0, 150]], closed: true }, { stroke: '#ffffff', strokeW: 4 }, 179],
    [{ points: [[0, 0], [100, 50]] }, { stroke: '#000000', strokeW: 10, strokeCap: 'square', strokeJoin: 'miter' }, 140],
    [{ points: [[0, 0], [100, 0]] }, { stroke: '#000000', strokeW: 2, headStart: 'circle', headEnd: 'triangle' }, 114.6],
  ];
  for (const [geometry, paint, width] of cases) {
    const placed: DesignPathPlacement = designPathPlacement(geometry, paint);
    assert.equal(placed.paint.w, width);
    const markup = renderPath({ id: 'p', kind: 'path', x: placed.x, y: placed.y, w: placed.w, h: placed.h, path: placed.path, bg: '', ...paint });
    const attr = (name: string): string => (new RegExp(`${name}="([^"]*)"`).exec(markup) ?? [])[1] ?? '';
    assert.equal(Number(attr('width')), placed.paint.w, `svg width for ${JSON.stringify(paint)}`);
    assert.equal(Number(attr('height')), placed.paint.h);
    const [vx, vy] = attr('viewBox').split(' ').map(Number);
    assert.equal(vx, placed.paint.x - placed.x, 'the viewBox starts at minus the pad');
    assert.equal(vy, placed.paint.y - placed.y);
  }
});

// ── the delivered deck (private) ─────────────────────────────────────────────

const GOLDEN = (process.env.LOLLY_DESIGN_PATHS_GOLDEN ?? '').trim();
const goldenSkip = GOLDEN && existsSync(GOLDEN)
  ? false
  : 'the delivered deck boxes fixture is not on this machine (set LOLLY_DESIGN_PATHS_GOLDEN to its light boxes JSON)';

test('eight delivered path rows reproduce from the generator inputs within 1e-3 px after renderer rounding', { skip: goldenSkip }, () => {
  const rows = JSON.parse(readFileSync(GOLDEN, 'utf8')) as Array<Record<string, unknown>>;
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  // The generator's own geometry, artboard px, and the artboard origin.
  const tickX = 800 + (1980 - 1960) / 66 * 920;
  const facets = (cx: number, top: number, girdle: number, tip: number, th: number, gh: number): Array<Array<[number, number]>> => {
    const tq = th / 2, gq = gh / 2;
    return [
      [[cx - th, top], [cx - tq, top], [cx - gq, girdle], [cx - gh, girdle]],
      [[cx - tq, top], [cx, top], [cx, girdle], [cx - gq, girdle]],
      [[cx, top], [cx + tq, top], [cx + gq, girdle], [cx, girdle]],
      [[cx + tq, top], [cx + th, top], [cx + gh, girdle], [cx + gq, girdle]],
      [[cx - gh, girdle], [cx - gq, girdle], [cx, tip]],
      [[cx - gq, girdle], [cx + gq, girdle], [cx, tip]],
      [[cx + gq, girdle], [cx + gh, girdle], [cx, tip]],
    ];
  };
  const key = facets(140, 366, 366 + 36.8 * 0.28, 366 + 36.8, 12, 20);
  const cases: Array<[string, DesignPathGeometry, { x: number; y: number }, boolean]> = [
    ['s02-rule1', { points: [[700, 432], [1800, 432]] }, { x: 2080, y: 0 }, true],
    ['s03-tick1980', { points: [[tickX, 896], [tickX, 908]] }, { x: 4160, y: 0 }, false],
    ['s04-facet0', { points: facets(960, 330, 480, 900, 190, 270)[0]!, closed: true }, { x: 6240, y: 0 }, false],
    ['s04-g0k0o', { d: key.map((p) => `M${p.map(([x, y]) => `${x} ${y}`).join('L')}Z`).join('') }, { x: 6240, y: 0 }, false],
    ['s07-arrow', { points: [[945, 660], [995, 660]] }, { x: 4160, y: 1240 }, true],
    ['s08-c0l', { d: 'M880 362C1111 362 1069 618 1300 618' }, { x: 6240, y: 1240 }, true],
    ['s08-c2l', { d: 'M880 618C1111 618 1069 618 1300 618' }, { x: 6240, y: 1240 }, true],
    ['s13-route', { points: [[578, 390], [578, 457], [826, 457], [826, 792]] }, { x: 0, y: 3720 }, false],
  ];
  for (const [id, geometry, origin, sameBytes] of cases) {
    const row = byId.get(id);
    assert.ok(row, `${id} is in the delivered rows`);
    const golden: Row = { x: Number(row!.x), y: Number(row!.y), w: Number(row!.w), h: Number(row!.h), path: String(row!.path) };
    const paint = { stroke: String(row!.stroke ?? ''), strokeW: Number(row!.strokeW ?? 0), ...(row!.headEnd ? { headEnd: String(row!.headEnd) } : {}) };
    const got = designPathPlacement(geometry, { origin, ...paint });

    const vsIntent = distance(drawn(got), intended(geometry, origin));
    assert.ok(vsIntent <= TOL, `${id}: drawn within ${TOL} px of the generator's geometry (off by ${vsIntent})`);
    // The delivered row is itself quantised: frames at 2 decimals and fractions at 5, so
    // it is read unrounded and allowed its own rounding on top of the tolerance.
    const own = (Number.isInteger(golden.x) && Number.isInteger(golden.y) ? 0 : 0.005) + 0.5e-5 * Math.max(golden.w, golden.h);
    const vsGolden = distance(drawn(got), drawn(golden, false));
    assert.ok(vsGolden <= TOL + own, `${id}: within ${TOL} px of the delivered row plus its own rounding ${own} (off by ${vsGolden})`);
    if ([golden.x, golden.y, golden.w, golden.h].every(Number.isInteger)) {
      assert.deepEqual([got.x, got.y, got.w, got.h], [golden.x, golden.y, golden.w, golden.h], `${id}: a whole-pixel delivered frame is kept`);
    }
    if (sameBytes) assert.equal(got.path, encodeAuthoredPaths(decodeAuthoredPaths(golden.path)!), `${id}: the canonical value is byte-identical`);
    if (id === 's07-arrow') assert.equal(got.paint.w, 89.6, 'the arrow paints its open head');
  }
});
