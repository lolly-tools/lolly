// SPDX-License-Identifier: MPL-2.0
/**
 * gamutSolidToSvg (engine/src/gamut-solid.ts) - SVG gamut-solid emitter contract.
 *
 * The emitter walks the depth-sorted ProjectedQuad[] projectGamutSolid returns
 * and writes one <polygon> per quad IN DOCUMENT ORDER (document order == the
 * painter's algorithm, so nearer quads paint over farther ones with no
 * z-fighting). This file pins:
 *
 *   (1) exactly one <polygon> per projected quad
 *   (2) polygons appear in the SAME order as the input array (document order)
 *   (3) every emitted coordinate is finite and the markup is well-formed
 *   (4) a sample quad's fill EXACTLY equals the shared shading helper's output - 
 *       the guarantee that the vector and canvas renderings can never drift
 *
 * NOTE (see color-ramp.test.ts's header): the first bytes of every console.log
 * line must be ASCII.
 *
 * Run with: node --test tests/gamut-solid-svg.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gamutSolid,
  projectGamutSolid,
  gamutSolidToSvg,
  shadedSolidFill,
} from '../engine/src/gamut-solid.ts';

const view = { yaw: 35, pitch: 20 };

test('emits exactly one <polygon> per projected quad', () => {
  const solid = gamutSolid('srgb', 16, 12, 'cylinder');
  const projected = projectGamutSolid(solid, view);
  assert.ok(projected.length > 0, 'projection produced quads');

  const svg = gamutSolidToSvg(projected);
  const count = (svg.match(/<polygon\b/g) ?? []).length;
  assert.equal(count, projected.length,
    `one polygon per quad (${count} vs ${projected.length})`);

  console.log(`  ${projected.length} quads -> ${count} polygons`);
});

test('polygons are emitted in document order == input array order', () => {
  const solid = gamutSolid('srgb', 12, 10, 'cylinder');
  const projected = projectGamutSolid(solid, view);
  const svg = gamutSolidToSvg(projected);

  // Extract each polygon's fill in the order it appears in the markup, and
  // compare to the shading helper applied to the input array in order. A match
  // for every index proves both the count AND that document order is preserved.
  const fills = [...svg.matchAll(/<polygon\b[^>]*\bfill="([^"]+)"/g)].map(m => m[1]!);
  assert.equal(fills.length, projected.length, 'a fill per quad');

  for (let i = 0; i < projected.length; i++) {
    const q = projected[i]!;
    const expected = shadedSolidFill(q.oklch, q.shade, 'srgb');
    assert.equal(fills[i], expected, `polygon ${i} fill matches quad ${i} in order`);
  }

  console.log(`  ${fills.length} polygons verified in document order`);
});

test('every emitted coordinate is finite and well-formed', () => {
  const solid = gamutSolid('srgb', 20, 16, 'cylinder');
  const projected = projectGamutSolid(solid, view);
  const size = 400;
  const svg = gamutSolidToSvg(projected, { size });

  const pointBlocks = [...svg.matchAll(/<polygon\b[^>]*\bpoints="([^"]+)"/g)].map(m => m[1]!);
  assert.equal(pointBlocks.length, projected.length, 'a points attr per quad');

  let coordCount = 0;
  for (const block of pointBlocks) {
    const pairs = block.trim().split(/\s+/);
    assert.ok(pairs.length >= 3, 'a polygon has at least 3 vertices');
    for (const pair of pairs) {
      const parts = pair.split(',');
      assert.equal(parts.length, 2, `vertex "${pair}" is an x,y pair`);
      for (const part of parts) {
        const n = Number(part);
        assert.ok(Number.isFinite(n), `coordinate "${part}" is finite`);
        // 0–1 box scaled by size; projection fits the unit box, so coords stay
        // within a small margin of [0, size].
        assert.ok(n >= -size && n <= 2 * size, `coordinate "${part}" is in range`);
        coordCount++;
      }
    }
  }

  // Well-formed shell: single root, balanced svg tags, self-closing polygons.
  assert.ok(svg.startsWith('<svg '), 'opens with <svg');
  assert.ok(svg.endsWith('</svg>'), 'closes with </svg>');
  assert.equal((svg.match(/<svg\b/g) ?? []).length, 1, 'exactly one <svg> root');
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'), 'declares the SVG namespace');
  assert.ok(!/NaN|Infinity/.test(svg), 'no NaN/Infinity in the markup');

  console.log(`  ${coordCount} finite coordinates across ${pointBlocks.length} polygons`);
});

test('a sample quad fill exactly equals the shared shading helper (no drift)', () => {
  const solid = gamutSolid('srgb', 14, 11, 'cylinder');
  const projected = projectGamutSolid(solid, view);

  // Pick a representative interior quad.
  const idx = Math.floor(projected.length / 2);
  const q = projected[idx]!;
  const expected = shadedSolidFill(q.oklch, q.shade, 'srgb');

  const svg = gamutSolidToSvg(projected);
  const fills = [...svg.matchAll(/<polygon\b[^>]*\bfill="([^"]+)"/g)].map(m => m[1]!);
  assert.equal(fills[idx], expected, 'the emitted fill is the shading helper verbatim');

  // The helper's sRGB form is a plain rgb() triple.
  assert.match(expected, /^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/, 'srgb fill is an rgb() triple');

  console.log(`  quad ${idx} fill = ${expected}`);
});

test('display-p3 encode emits color(display-p3 ...) fills', () => {
  const solid = gamutSolid('p3', 12, 10, 'cylinder');
  const projected = projectGamutSolid(solid, view);
  const svg = gamutSolidToSvg(projected, { encode: 'display-p3' });

  const fills = [...svg.matchAll(/<polygon\b[^>]*\bfill="([^"]+)"/g)].map(m => m[1]!);
  assert.ok(fills.length > 0, 'produced fills');
  for (let i = 0; i < projected.length; i++) {
    const q = projected[i]!;
    assert.equal(fills[i], shadedSolidFill(q.oklch, q.shade, 'display-p3'),
      `p3 polygon ${i} matches the helper`);
    assert.match(fills[i]!, /^color\(display-p3 /, 'p3 fill is a color() function');
  }

  console.log(`  ${fills.length} display-p3 fills verified`);
});

test('optional background rect is emitted before the polygons', () => {
  const solid = gamutSolid('srgb', 10, 8, 'cylinder');
  const projected = projectGamutSolid(solid, view);
  const svg = gamutSolidToSvg(projected, { background: '#101014' });

  const rectAt = svg.indexOf('<rect');
  const polyAt = svg.indexOf('<polygon');
  assert.ok(rectAt >= 0, 'background rect present');
  assert.ok(rectAt < polyAt, 'background is painted behind the solid');
  assert.ok(svg.includes('fill="#101014"'), 'background carries the requested colour');

  // Absent by default.
  const plain = gamutSolidToSvg(projected);
  assert.ok(!plain.includes('<rect'), 'no background rect without the option');

  console.log(`  background rect ordering verified`);
});

test('empty projection yields a valid empty svg', () => {
  const svg = gamutSolidToSvg([]);
  assert.ok(svg.startsWith('<svg '), 'still a valid root');
  assert.ok(svg.endsWith('</svg>'), 'closed');
  assert.equal((svg.match(/<polygon\b/g) ?? []).length, 0, 'no polygons');

  console.log(`  empty projection -> empty svg`);
});
