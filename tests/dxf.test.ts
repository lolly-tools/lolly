/**
 * DXF emitter contract tests.
 * Run with: node --test tests/dxf.test.ts
 *
 * Parses the emitted group-code stream back into structured records and asserts
 * against the actual entities, not the emitter's intent. DXF is a flat stream of
 * (code, value) line pairs; `parseGroups` rebuilds that, and `entities` slices out
 * the ENTITIES section as POLYLINE → VERTEX* → SEQEND records.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emitDxf } from '../engine/src/dxf.ts';
import type { VectorIr } from '../engine/src/emf.ts';

type Group = { code: number; value: string };
function parseGroups(text: string): Group[] {
  const lines = text.split('\n');
  const out: Group[] = [];
  // Trailing '' from the final newline; ignore any odd tail.
  for (let i = 0; i + 1 < lines.length; i += 2) {
    out.push({ code: Number(lines[i]), value: lines[i + 1]! });
  }
  return out;
}

// Extract polylines from the ENTITIES section: each is { closed, color, verts }.
interface Poly { closed: boolean; color: number; verts: Array<{ x: number; y: number }> }
function polylines(groups: Group[]): Poly[] {
  let inEnt = false;
  const polys: Poly[] = [];
  let cur: Poly | null = null;
  let pendingVertex: { x?: number; y?: number } | null = null;
  const flushVertex = () => {
    if (cur && pendingVertex && pendingVertex.x != null && pendingVertex.y != null) {
      cur.verts.push({ x: pendingVertex.x, y: pendingVertex.y });
    }
    pendingVertex = null;
  };
  for (let i = 0; i < groups.length; i++) {
    const { code, value } = groups[i]!;
    if (code === 2 && value === 'ENTITIES') { inEnt = true; continue; }
    if (!inEnt) continue;
    if (code === 0) {
      flushVertex();
      if (value === 'POLYLINE') { cur = { closed: false, color: 7, verts: [] }; polys.push(cur); }
      else if (value === 'VERTEX') { pendingVertex = {}; }
      else if (value === 'SEQEND') { cur = null; }
      else if (value === 'ENDSEC') { inEnt = false; }
      continue;
    }
    if (pendingVertex) {
      if (code === 10) pendingVertex.x = Number(value);
      else if (code === 20) pendingVertex.y = Number(value);
    } else if (cur) {
      if (code === 70) cur.closed = (Number(value) & 1) === 1;
      else if (code === 62) cur.color = Number(value);
    }
  }
  return polys;
}

const squareIr: VectorIr = {
  width: 100,
  height: 100,
  prims: [{
    type: 'path',
    fill: { r: 255, g: 0, b: 0 },
    stroke: null,
    fillRule: 'nonzero',
    subpaths: [{
      closed: true,
      segments: [
        { op: 'M', x: 0, y: 0 },
        { op: 'L', x: 100, y: 0 },
        { op: 'L', x: 100, y: 100 },
        { op: 'L', x: 0, y: 100 },
      ],
    }],
  }],
};

test('emits a well-formed R12 DXF envelope', () => {
  const { text } = emitDxf(squareIr, { width: '100mm', height: '100mm' });
  const g = parseGroups(text);
  // Balanced SECTION/ENDSEC and a terminating EOF.
  const sections = g.filter(x => x.code === 0 && x.value === 'SECTION').length;
  const ends = g.filter(x => x.code === 0 && x.value === 'ENDSEC').length;
  assert.equal(sections, 3, 'HEADER + TABLES + ENTITIES');
  assert.equal(ends, 3);
  assert.equal(g.at(-1)!.value, 'EOF');
  assert.ok(g.some(x => x.code === 1 && x.value === 'AC1009'), 'declares DXF R12');
  assert.ok(g.some(x => x.code === 9 && x.value === '$INSUNITS'), 'declares units');
});

test('a closed square becomes one closed 4-vertex polyline, y-flipped to mm', () => {
  const { text } = emitDxf(squareIr, { width: '100mm', height: '100mm' });
  const polys = polylines(parseGroups(text));
  assert.equal(polys.length, 1);
  const p = polys[0]!;
  assert.equal(p.closed, true);
  assert.equal(p.verts.length, 4);
  assert.equal(p.color, 1, 'pure red → ACI 1');
  // Model is 100mm tall; device (0,0) top-left maps to (0,100) bottom-left in y-up.
  assert.deepEqual(p.verts[0], { x: 0, y: 100 });
  assert.deepEqual(p.verts[1], { x: 100, y: 100 });
  assert.deepEqual(p.verts[2], { x: 100, y: 0 });
  assert.deepEqual(p.verts[3], { x: 0, y: 0 });
});

test('cubic béziers flatten to multiple vertices within the polyline', () => {
  const curve: VectorIr = {
    width: 100, height: 100,
    prims: [{
      type: 'path', fill: null, stroke: { r: 0, g: 0, b: 0, width: 1 }, fillRule: 'nonzero',
      subpaths: [{ closed: false, segments: [
        { op: 'M', x: 0, y: 50 },
        { op: 'C', x1: 25, y1: 0, x2: 75, y2: 100, x: 100, y: 50 },
      ] }],
    }],
  };
  const polys = polylines(parseGroups(emitDxf(curve, { width: '100mm', height: '100mm' }).text));
  assert.equal(polys.length, 1);
  assert.equal(polys[0]!.closed, false);
  assert.ok(polys[0]!.verts.length > 3, 'a curved segment produced interior vertices');
  assert.equal(polys[0]!.color, 7, 'black stroke (no fill) → ACI 7 default');
});

test('raster escape-hatch (image) prims are dropped and counted', () => {
  const withImage: VectorIr = {
    width: 10, height: 10,
    prims: [
      squareIr.prims[0]!,
      { type: 'image', x: 0, y: 0, w: 10, h: 10, pxW: 2, pxH: 2, rgb: new Uint8Array(12) },
    ],
  };
  const { text, droppedImages } = emitDxf(withImage, { width: '10mm', height: '10mm' });
  assert.equal(droppedImages, 1);
  assert.equal(polylines(parseGroups(text)).length, 1, 'the path still emits; only the image is gone');
});

test('no physical size falls back to px-at-96dpi millimetres', () => {
  const { text } = emitDxf(squareIr);   // 100px canvas, no width/height
  const g = parseGroups(text);
  const extMaxIdx = g.findIndex(x => x.code === 9 && x.value === '$EXTMAX');
  const wmm = Number(g[extMaxIdx + 1]!.value);   // the code-10 line right after
  assert.ok(Math.abs(wmm - (100 / 96) * 25.4) < 0.01, '100px → ~26.46mm');
});
