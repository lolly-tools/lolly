// SPDX-License-Identifier: MPL-2.0
/**
 * Vector artwork detection - telling a logo from the page it sits on.
 * Run directly:  node --test tests/pdf-artwork.test.ts
 *
 * Every negative case here is a shape a REAL page actually contains, because the
 * whole difficulty is that a logo and a table border are the same kind of object
 * in the node list. The detector is biased toward refusing: a missed logo is a
 * visible gap, whereas a "logo" that turns out to be the table grid teaches the
 * user the feature cannot be trusted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findVectorArtwork } from '../engine/src/pdf-artwork.ts';
import type { PdfNode } from '../engine/src/pdf-map.ts';

const PAGE = { width: 595, height: 842 };

// ─── harness ──────────────────────────────────────────────────────────────────

function rect(x: number, y: number, w: number, h: number, fill = '#000000', group?: string): PdfNode {
  return { kind: 'box', x, y, w, h, rot: 0, shape: 'rect', fill, ...(group ? { group } : {}) };
}

function ellipse(x: number, y: number, w: number, h: number, fill = '#0d6640'): PdfNode {
  return { kind: 'box', x, y, w, h, rot: 0, shape: 'ellipse', fill };
}

/** A baked vector path. `curved` decides whether it carries a C command. */
function path(x: number, y: number, w: number, h: number, fill: string, curved = true, group?: string): PdfNode {
  const d = curved
    ? `M${x} ${y}C${x + w} ${y} ${x + w} ${y + h} ${x} ${y + h}Z`
    : `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}Z`;
  return {
    kind: 'image', x, y, w, h, rot: 0,
    _vectorPath: d, _vectorFill: fill, ...(group ? { group } : {}),
  };
}

// ─── the positive case ────────────────────────────────────────────────────────

test('a multi-path curved mark is found, cropped to itself', () => {
  const found = findVectorArtwork([
    ellipse(60, 60, 60, 60),
    path(75, 74, 30, 36, '#ffffff'),
    path(72, 92, 36, 22, '#e6991a'),
  ], PAGE);

  assert.equal(found.length, 1);
  assert.equal(found[0]!.indices.length, 3);
  // Bounds are the union of the shapes, not the page.
  assert.equal(found[0]!.rect.x, 60);
  assert.equal(found[0]!.rect.w, 60);
  assert.deepEqual(found[0]!.fills, ['#0d6640', '#ffffff', '#e6991a']);
  assert.match(found[0]!.reason, /curved/);
});

test('indices come back in PAINT order, which is the z-order to redraw in', () => {
  const found = findVectorArtwork([
    ellipse(60, 60, 60, 60),
    path(75, 74, 30, 36, '#ffffff'),
    path(72, 92, 36, 22, '#e6991a'),
  ], PAGE);
  assert.deepEqual(found[0]!.indices, [0, 1, 2]);
});

test('two marks far apart are two separate candidates', () => {
  const found = findVectorArtwork([
    ellipse(40, 40, 50, 50),
    path(45, 50, 30, 30, '#fff'),
    ellipse(400, 600, 50, 50),
    path(405, 610, 30, 30, '#fff'),
  ], PAGE);
  assert.equal(found.length, 2);
});

// ─── page furniture that must NOT be reported ─────────────────────────────────

test('a hairline rule is not artwork', () => {
  assert.deepEqual(findVectorArtwork([rect(50, 700, 495, 1, '#b3b3b3')], PAGE), []);
});

test('a table grid of aligned rectangles is not artwork', () => {
  // The most convincing false positive there is: twenty perfectly aligned
  // shapes, adjacent, forming one tidy cluster.
  const nodes: PdfNode[] = [];
  for (let i = 0; i < 5; i++) nodes.push(rect(50, 400 + i * 30, 495, 0.8, '#999999'));
  for (let i = 0; i < 4; i++) nodes.push(rect(50 + i * 165, 400, 0.8, 120, '#999999'));
  assert.deepEqual(findVectorArtwork(nodes, PAGE), []);
});

test('a full-page background panel is not artwork', () => {
  const found = findVectorArtwork([
    rect(0, 0, 595, 842, '#f0f0f0'),
    rect(0, 0, 595, 842, '#eeeeee'),
  ], PAGE);
  assert.deepEqual(found, []);
});

test('a wide banner bar is rejected on aspect ratio', () => {
  const found = findVectorArtwork([
    rect(20, 100, 555, 20, '#123456'),
    rect(20, 100, 555, 20, '#654321'),
  ], PAGE);
  assert.deepEqual(found, []);
});

test('a single shape is never artwork, however pretty', () => {
  assert.deepEqual(findVectorArtwork([ellipse(60, 60, 80, 80)], PAGE), []);
});

test('two plain rectangles in two colours stay furniture', () => {
  // A callout panel with an accent stripe - extremely common, not a logo.
  const found = findVectorArtwork([
    rect(50, 200, 300, 90, '#eeeeee'),
    rect(50, 200, 4, 90, '#0d6640'),
  ], PAGE);
  assert.deepEqual(found, []);
});

// ─── the escape hatches ───────────────────────────────────────────────────────

test('three or more colours of rectangle DO count as a mark', () => {
  // A flag, a bar-chart glyph, a blocky wordmark: rectangles only, but no page
  // furniture is built from three distinct fills in a compact cluster.
  const found = findVectorArtwork([
    rect(60, 60, 30, 60, '#c00'),
    rect(90, 60, 30, 60, '#fff'),
    rect(120, 60, 30, 60, '#00c'),
  ], PAGE);
  assert.equal(found.length, 1);
  assert.match(found[0]!.reason, /multi-colour/);
});

test('an ellipse counts as curvature even with no path data', () => {
  const found = findVectorArtwork([ellipse(60, 60, 40, 40), rect(70, 70, 20, 20, '#fff')], PAGE);
  assert.equal(found.length, 1);
});

// ─── how proximity and grouping decide the SPLIT ──────────────────────────────
// Proximity decides; a shared group may only REJOIN across a short reach. Doing
// it the other way - group first, unconditionally - means one Illustrator OCG
// layer covering the page merges every graphic on it into a single useless asset.

test('a shared group REJOINS a symbol and its wordmark set slightly apart', () => {
  // The case a group genuinely earns: one form XObject, two pieces, a small gap
  // that plain proximity would have split.
  const found = findVectorArtwork([
    path(40, 40, 40, 40, '#0d6640', true, 'g7'),
    path(110, 45, 90, 30, '#0d6640', true, 'g7'),
  ], PAGE);
  assert.equal(found.length, 1, 'a lockup should come out as one asset');
  assert.equal(found[0]!.group, 'g7');
  assert.match(found[0]!.reason, /grouped in the document/);
});

test('a shared group does NOT merge marks at opposite ends of the page', () => {
  // A page-spanning OCG layer ("Layer 1") holding a header mark and a footer
  // mark. Honouring the group here produces one asset that is mostly empty space.
  const found = findVectorArtwork([
    path(40, 40, 40, 40, '#0d6640', true, 'layer1'),
    path(60, 50, 20, 20, '#ffffff', true, 'layer1'),
    path(430, 700, 40, 40, '#0d6640', true, 'layer1'),
    path(450, 710, 20, 20, '#ffffff', true, 'layer1'),
  ], PAGE);
  assert.equal(found.length, 2, 'far-apart marks on one layer stay separate assets');
});

test('the clustering gap scales with the size of the shapes', () => {
  // The SAME 18pt separation, read two ways. Between 90pt shapes it is an
  // internal gap inside one monogram; between 10pt shapes it is the space
  // between two distinct icons.
  const big = findVectorArtwork([
    ellipse(60, 60, 90, 90),
    path(168, 60, 90, 90, '#e6991a'),          // 18pt after the ellipse ends
  ], PAGE);
  assert.equal(big.length, 1, 'big shapes tolerate a proportionate internal gap');

  // Two icons, each of two touching shapes, 18pt apart.
  const small = findVectorArtwork([
    ellipse(60, 60, 10, 10), path(70, 60, 10, 10, '#e6991a'),
    ellipse(98, 60, 10, 10), path(108, 60, 10, 10, '#e6991a'),
  ], PAGE);
  assert.equal(small.length, 2, 'small shapes at the same separation are separate marks');
});

test('artwork with NO group is still found - grouping is a hint, not a requirement', () => {
  // Verified against a real generated PDF: paths drawn straight onto the page
  // carry no group at all, so a group-only rule would find nothing.
  const found = findVectorArtwork([
    path(60, 60, 40, 40, '#0d6640'),
    path(70, 70, 20, 20, '#ffffff'),
  ], PAGE);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.group, undefined);
});

// ─── boundaries ───────────────────────────────────────────────────────────────

test('text is never part of a mark', () => {
  const found = findVectorArtwork([
    ellipse(60, 60, 40, 40),
    path(70, 70, 20, 20, '#fff'),
    { kind: 'text', x: 62, y: 62, w: 40, h: 12, rot: 0, text: 'ACME', fontSize: 10 },
  ], PAGE);
  assert.equal(found.length, 1);
  assert.equal(found[0]!.indices.length, 2, 'the text run must not join the mark');
});

test('a raster image is left to the images pass', () => {
  const found = findVectorArtwork([
    { kind: 'image', x: 60, y: 60, w: 100, h: 100, rot: 0, _imageXObject: 'im0' },
    { kind: 'image', x: 60, y: 60, w: 100, h: 100, rot: 0, _imageXObject: 'im1' },
  ], PAGE);
  assert.deepEqual(found, []);
});

test('marks come back biggest first', () => {
  const found = findVectorArtwork([
    ellipse(40, 40, 30, 30), path(45, 45, 15, 15, '#fff'),
    ellipse(300, 300, 90, 90), path(310, 310, 50, 50, '#fff'),
  ], PAGE);
  assert.equal(found.length, 2);
  assert.ok(found[0]!.rect.w > found[1]!.rect.w, 'largest mark should lead');
});

test('degenerate geometry yields nothing rather than throwing', () => {
  const found = findVectorArtwork([
    { kind: 'box', x: NaN, y: NaN, w: NaN, h: NaN, rot: 0, fill: '#000' },
    { kind: 'box', x: 0, y: 0, w: 0, h: 0, rot: 0, fill: '#000' },
  ], PAGE);
  assert.deepEqual(found, []);
});

test('an empty page yields nothing', () => {
  assert.deepEqual(findVectorArtwork([], PAGE), []);
  assert.deepEqual(findVectorArtwork([], {}), []);
});
