// SPDX-License-Identifier: MPL-2.0
/**
 * Where the PDF painter puts SVG markers (export-pdf-svg-markers.ts), without a browser:
 * the vertices a path or polyline yields, which way each marker faces and how a marker
 * is laid out at its vertex. The expected values are Chromium's, read from its own
 * rendering; export-pdf-svg.browser.test.ts compares the drawn markers with Chromium's
 * screenshot.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { markerLayout, markerVertices, type MarkerVertex } from './export-pdf-svg-markers.ts';

const VP = { w: 300, h: 200 };
/** A stand-in for an element: its name and attributes. */
const el = (localName: string, attrs: Record<string, string>): Element => ({ localName, getAttribute: (k: string) => attrs[k] ?? null }) as unknown as Element;
const kinds = (vs: MarkerVertex[]): string[] => vs.map(v => `${v.kind}@${v.x},${v.y}`);
const angles = (vs: MarkerVertex[]): number[] => vs.map(v => Math.round(v.angle));

test('a lone moveto and a one-point polyline take a start and an end marker at their one vertex', () => {
  assert.deepEqual(kinds(markerVertices(el('path', { d: 'M40 40' }), VP)!), ['start@40,40', 'end@40,40']);
  assert.deepEqual(kinds(markerVertices(el('polyline', { points: '200,40' }), VP)!), ['start@200,40', 'end@200,40']);
  assert.deepEqual(kinds(markerVertices(el('path', { d: 'M90 40 M140 40' }), VP)!), ['start@90,40', 'end@140,40']);
  assert.deepEqual(kinds(markerVertices(el('path', { d: 'M0 0 L10 0 M20 20 M30 0 L40 0' }), VP)!), ['start@0,0', 'mid@10,0', 'mid@20,20', 'mid@30,0', 'end@40,0']);
});

test('a corner faces along the bisector of its two segments', () => {
  assert.deepEqual(angles(markerVertices(el('polyline', { points: '0,0 10,0 10,10' }), VP)!), [0, 45, 90]);
  // Short of a half turn, the bisector halves the turn the path makes: 0 to 174 degrees gives 87.
  assert.deepEqual(angles(markerVertices(el('path', { d: 'M0 0 L10 0 L0 1' }), VP)!).slice(1, 2), [87]);
});

test('where a path doubles back the mid marker faces as it does in Chromium', () => {
  // In 0 degrees, out 180: a turn of -180, so the bisector is -90 (up the page).
  assert.deepEqual(angles(markerVertices(el('path', { d: 'M20 40 h60 h-60' }), VP)!), [0, -90, 180]);
  assert.deepEqual(angles(markerVertices(el('path', { d: 'M240 20 v60 v-60' }), VP)!), [90, 0, -90]);
  assert.deepEqual(angles(markerVertices(el('path', { d: 'M280 80 v-60 v60' }), VP)!), [-90, -180, 90]);
  assert.deepEqual(angles(markerVertices(el('path', { d: 'M20 110 h60 z' }), VP)!).slice(1, 2), [-90]);
});

test('a long run of zero-length segments costs time in proportion to its length', () => {
  const same = Array.from({ length: 32000 }, () => '50,50').join(' ');
  const t0 = performance.now();
  const v = markerVertices(el('polyline', { points: same }), VP)!;
  const ms = performance.now() - t0;
  assert.equal(v.length, 32000);
  // The previous scan looked back and forward over the whole run at every vertex: 1.5 s here.
  assert.ok(ms < 500, `32,000 repeated points in ${Math.round(ms)} ms`);
});

/** The rotation a layout matrix carries, in degrees. */
const turn = (m: { a: number; b: number }): number => Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI);
const at = (kind: MarkerVertex['kind'] = 'mid'): MarkerVertex => ({ x: 100, y: 50, angle: 30, kind });

test('a fixed orient angle reads deg, rad, grad and turn, and auto follows the vertex', () => {
  const lay = (orient: string, kind?: MarkerVertex['kind']) => markerLayout(el('marker', { orient, markerWidth: '6', markerHeight: '6' }), at(kind), 1, VP, true)!;
  assert.equal(turn(lay('45').matrix), 45);
  assert.equal(turn(lay('90deg').matrix), 90);
  assert.equal(turn(lay('1.5708rad').matrix), 90);
  assert.equal(turn(lay('-50grad').matrix), -45);
  assert.equal(turn(lay('0.25turn').matrix), 90);
  assert.equal(turn(lay('auto').matrix), 30);
  assert.equal(turn(lay('auto-start-reverse', 'start').matrix), -150);
});

test('refX and refY are read as Chromium reads them: a length or a percentage of the shape\'s viewport, keywords as 0', () => {
  const origin = (refX: string, refY: string): [number, number] => {
    const m = markerLayout(el('marker', { viewBox: '0 0 20 10', markerWidth: '10', markerHeight: '10', markerUnits: 'userSpaceOnUse', refX, refY }), { x: 0, y: 0, angle: 0, kind: 'end' }, 1, VP, true)!.content;
    return [Math.round(m.e * 100) / 100, Math.round(m.f * 100) / 100];
  };
  // The viewBox meets the 10 by 10 viewport at half scale, 2.5 down from its top.
  assert.deepEqual(origin('0', '0'), [0, 0]);
  assert.deepEqual(origin('10', '5'), [-5, -2.5]);
  assert.deepEqual(origin('center', 'center'), origin('0', '0'), 'keywords count as 0');
  // 50% of the 300-wide viewport is 150 viewBox units, half a unit to the pixel here.
  assert.deepEqual(origin('50%', '0'), [-75, 0]);
});

test('a marker clips to its viewport only when asked, and markerUnits strokeWidth scales by the stroke', () => {
  const marker = el('marker', { markerWidth: '4', markerHeight: '3' });
  assert.deepEqual(markerLayout(marker, at(), 2, VP, true)!.clip, { x: 0, y: 0, w: 4, h: 3 });
  assert.equal(markerLayout(marker, at(), 2, VP, false)!.clip, null);
  const scaled = markerLayout(el('marker', { orient: '0' }), at(), 4, VP, true)!.matrix;
  assert.equal(Math.round(scaled.a), 4, 'four times the size for a stroke four units wide');
});
