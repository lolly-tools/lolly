// SPDX-License-Identifier: MPL-2.0
/**
 * A drawing as bounded items, and those items as Design rows (plan 275 decision 32).
 *
 * `svgItemsOf` reads an SVG's structure through an injected parser; `custGeomItems`
 * states a freeform's custom geometry the same way; `vectorItemsToRows` places items
 * as one group of rows; `vectorItemsSvg` draws them back as clean markup. These cases
 * pin the reading of a chart the way Lolly's own chart tool writes one, the raster
 * appearance of the re-drawn items against the source, one case per reason a part is
 * left out, every cap, and the row conversions the critique of the trace names.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { Resvg } from '@resvg/resvg-js';
import type { VectorItemsV1, VectorPathItemV1, VectorTextItemV1 } from '@lolly-tools/core';

import {
  cropVectorItems,
  custGeomItems,
  glyphRunsOf,
  isLabelGroup,
  MAX_VECTOR_ROWS_PER_OBJECT,
  svgItemsOf,
  vectorItemsDocument,
  vectorItemsSvg,
  vectorItemsToRows,
  vectorRowNameParts,
  vectorRowsPathChars,
} from '../engine/src/svg-items.ts';
import { decodeAuthoredPathsResult } from '../engine/src/geom/authored-url.ts';

const parser = new (new JSDOM('').window.DOMParser)();
const parse = (source: string) => parser.parseFromString(source, 'image/svg+xml');

/** A chart the way the chart tool writes one: title, credits, a font-only style sheet, an empty background. */
const CHART = '<svg xmlns="http://www.w3.org/2000/svg" id="c" viewBox="0 0 400 200" width="400" height="200" data-lolly-anno="x">'
  + '<title>bar chart</title><desc>Source: fixture (CC0-1.0).</desc>'
  + "<defs><style>#c text { font-family: 'Fixture Sans', sans-serif; }</style></defs>"
  + '<rect id="bg" width="400" height="200" fill="none" pointer-events="all"/>'
  + '<g id="plot"><g class="value-axis">'
  + [100, 170, 240, 310, 380].map((x) => `<line x1="${x}" y1="20" x2="${x}" y2="170" stroke="#999999" stroke-width="1" opacity="0.3"/>`).join('')
  + '</g><g class="cat-axis">'
  + [52, 102, 152].map((y) => `<path transform="translate(20,${y})" d="M0 0h40v10h-40z" fill="rgb(20, 20, 20)" opacity="0.8"/>`).join('')
  + '</g><g>'
  + '<rect x="100" y="40" width="220" height="30" rx="4" fill="#1f4e79" data-recolor="A"/>'
  + '<rect x="100" y="90" width="150" height="30" rx="4" fill="#1f4e79" data-recolor="B"/>'
  + '<rect x="100" y="140" width="90" height="30" rx="4" fill="#d65a28" data-recolor="C"/>'
  + '<rect x="100" y="180" width="0" height="10" fill="#d65a28" data-recolor="D"/>'
  + '</g><text x="200" y="195" font-size="12" text-anchor="middle" fill="#333333">Revenue</text>'
  + '<g transform="rotate(45 360 40)"><path d="M350 30h20v20h-20z" fill="#106e60"/></g></g></svg>';

const paths = (items: VectorItemsV1): VectorPathItemV1[] => items.items.filter((i): i is VectorPathItemV1 => i.kind === 'path');

test('a chart reads as its parts: bars, gridlines, outlined labels, text and a turned marker', () => {
  const items = svgItemsOf(CHART, parse);
  assert.deepEqual(items.viewBox, { x: 0, y: 0, w: 400, h: 200 });
  assert.equal(items.title, 'bar chart');
  assert.equal(items.desc, 'Source: fixture (CC0-1.0).');
  // The empty background and the zero-width bar paint nothing: dropped with no record,
  // so the chart is not approximate on their account.
  assert.equal(items.omitted, undefined);
  assert.equal(items.items.length, 13);
  const bars = paths(items).filter((p) => p.shape === 'rect');
  assert.deepEqual(bars.map((b) => b.series), ['A', 'B', 'C']);
  assert.deepEqual(bars.map((b) => b.rx), [4, 4, 4]);
  assert.deepEqual(bars[0]!.box, { x: 100, y: 40, w: 220, h: 30 });
  assert.deepEqual(bars[0]!.groups, ['plot']);
  const lines = paths(items).filter((p) => p.shape === 'line');
  assert.equal(lines.length, 5);
  assert.equal(lines[0]!.opacity, 0.3);
  assert.deepEqual(lines[0]!.fill, { none: true });
  assert.deepEqual(lines[0]!.stroke, { color: { hex: '#999999' }, width: 1 });
  assert.deepEqual(lines[0]!.groups, ['plot', 'value-axis']);
  const labels = paths(items).filter((p) => !p.shape && p.groups?.at(-1) === 'cat-axis');
  assert.equal(labels.length, 3);
  assert.equal(labels[0]!.d, 'M20 52L60 52L60 62L20 62Z', 'the translate is composed into absolute data');
  assert.equal(labels[0]!.opacity, 0.8);
  assert.deepEqual(labels[0]!.fill, { hex: '#141414' });
  const text = items.items.find((i): i is VectorTextItemV1 => i.kind === 'text')!;
  assert.deepEqual({ ...text }, { kind: 'text', text: 'Revenue', x: 200, y: 195, size: 12, fill: { hex: '#333333' }, anchor: 'middle', font: 'Fixture Sans', groups: ['plot'] });
  const marker = paths(items).at(-1)!;
  assert.equal(marker.shape, undefined, 'a turned square is no longer a box');
  assert.ok(Math.abs(marker.box.w - 28.284) < 0.01, `the turned square spans its diagonal (${marker.box.w})`);
});

test('the items drawn back match the source raster', () => {
  const source = CHART.replace(/<text[^>]*>[^<]*<\/text>/, '');
  const items = svgItemsOf(source, parse);
  const a = new Resvg(source).render().pixels;
  const b = new Resvg(vectorItemsDocument(items)).render().pixels;
  assert.equal(a.length, b.length);
  const error = a.reduce((sum, value, index) => sum + Math.abs(value - b[index]!), 0) / a.length;
  assert.ok(error < 0.05, `mean channel error ${error}`);
});

test('reading the same drawing twice gives the same items', () => {
  assert.deepEqual(svgItemsOf(CHART, parse), svgItemsOf(CHART, parse));
});

test('each part a row cannot carry is left out with its reason, and the rest stay', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g"/><clipPath id="k"><rect width="5" height="5"/></clipPath></defs>'
    + '<rect width="10" height="10" fill="url(#g)"/>'
    + '<rect x="20" width="10" height="10" fill="#000" clip-path="url(#k)"/>'
    + '<image href="https://example.com/a.png" width="10" height="10"/>'
    + '<text x="1 2 3" y="50">spaced</text>'
    + '<foreignObject width="10" height="10"/>'
    + '<use href="https://example.com/b.svg#x"/>'
    + '<rect x="40" width="10" height="10" fill="#123456"/></svg>';
  const items = svgItemsOf(svg, parse);
  assert.equal(items.items.length, 1);
  assert.deepEqual(items.omitted, [
    { reason: 'unsupported-paint', count: 2 },
    { reason: 'unsupported-element', count: 3 },
    { reason: 'unsupported-text', count: 1 },
  ]);
});

test('a local use is placed, and a use of its own ancestor is refused rather than followed', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><path id="m" d="M0 0h10v10h-10z" fill="#ff0000"/></defs>'
    + '<use href="#m" x="20" y="30"/><g id="loop"><use href="#loop"/></g></svg>';
  const items = svgItemsOf(svg, parse);
  assert.equal(items.items.length, 1);
  assert.equal((items.items[0] as VectorPathItemV1).d, 'M20 30L30 30L30 40L20 40Z');
  assert.deepEqual(items.omitted, [{ reason: 'unsupported-element', count: 1 }]);
});

test('a foreign namespace is annotation: a provenance manifest neither draws nor counts against the drawing', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:c2pa="https://c2pa.org/manifest" viewBox="0 0 10 10">'
    + '<metadata><c2pa:manifest>x</c2pa:manifest></metadata><c2pa:note/><path d="M0 0h10v10z"/></svg>';
  const items = svgItemsOf(svg, parse);
  assert.equal(items.items.length, 1);
  assert.equal(items.omitted, undefined);
});

test('a file that is not an SVG yields no items and says so', () => {
  assert.deepEqual(svgItemsOf('<html/>', parse).omitted, [{ reason: 'unsupported-element', count: 1 }]);
  assert.deepEqual(svgItemsOf('not xml at all <', parse).omitted, [{ reason: 'unsupported-element', count: 1 }]);
  assert.deepEqual(svgItemsOf('', parse).items, []);
});

test('past the item cap the reading stops, keeps nothing and says cap-reached', () => {
  const rects = Array.from({ length: 12 }, (_, i) => `<rect x="${i}" width="1" height="1" fill="#000"/>`).join('');
  const items = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 2">${rects}</svg>`, parse, { maxItems: 10 });
  assert.deepEqual(items.items, []);
  assert.deepEqual(items.omitted, [{ reason: 'cap-reached', count: 11 }]);
});

test('past the path-data cap the reading stops too', () => {
  const rects = Array.from({ length: 5 }, (_, i) => `<rect x="${i}" width="1" height="1" fill="#000"/>`).join('');
  const items = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 2">${rects}</svg>`, parse, { maxChars: 40 });
  assert.deepEqual(items.items, []);
  assert.equal(items.omitted?.[0]?.reason, 'cap-reached');
});

test('a part too large for one Design path value is refused by node count and by encoded length', () => {
  const zigzag = (n: number): string => `M0 0${Array.from({ length: n }, (_, i) => `L${i + 1} ${i % 2 ? 0 : 7.123456}`).join('')}`;
  const nodes = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30000 10"><path d="${zigzag(20_001)}" stroke="#000"/></svg>`, parse);
  assert.equal(nodes.omitted?.[0]?.reason, 'cap-reached', 'over 20,000 nodes');
  const curls = `M0 0${Array.from({ length: 16_000 }, (_, i) => `C${i + 0.31} ${i % 2 ? 3.37 : 6.61} ${i + 0.67} ${i % 2 ? 5.71 : 1.29} ${i + 1} ${i % 2 ? 0 : 7.123456}`).join('')}`;
  const encoded = svgItemsOf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30000 10"><path d="${curls}" stroke="#000"/></svg>`, parse);
  assert.equal(encoded.omitted?.[0]?.reason, 'cap-reached', 'under the node cap, over the encoded length a Design row decodes');
});

test('custom geometry states each path in the box, with its paint and its flags', () => {
  const items = custGeomItems(
    { paths: [{ d: 'M0 0L100 0L100 100Z', w: 100, h: 100 }, { d: 'M0 0L100 100', w: 100, h: 100, noFill: true }] },
    { w: 200, h: 50 },
    { fill: { hex: '#30ba78', alpha: 0.4 }, line: { color: { hex: '#000000' }, widthPx: 2 } },
  );
  assert.deepEqual(items.viewBox, { x: 0, y: 0, w: 200, h: 50 });
  assert.equal(items.items.length, 2);
  const [a, b] = items.items as VectorPathItemV1[];
  assert.equal(a!.d, 'M0 0L200 0L200 50Z', 'stretched from the path space onto the box');
  assert.equal(a!.fillOpacity, 0.4);
  assert.deepEqual(b!.fill, { none: true }, 'fill="none" is outline only');
  assert.equal(b!.stroke?.width, 2);
});

test('rows: bars are boxes, other parts paths, text text, all in one group, opacity 0 to 100', () => {
  const items = svgItemsOf(CHART, parse);
  const made = vectorItemsToRows(items, { x: 0, y: 0, w: 800, h: 400 }, { idPrefix: 'r.c', group: 'vector:r.c', frame: 'f', fit: 'contain' });
  assert.ok('rows' in made);
  assert.equal(made.rows.length, 13);
  assert.ok(made.rows.every((row) => row.group === 'vector:r.c' && row.frame === 'f'));
  assert.deepEqual(made.rows.map((row) => row.id).slice(0, 2), ['r.c.i0', 'r.c.i1']);
  const bar = made.rows.find((row) => row.kind === 'box' && row.bg === '#1f4e79')!;
  assert.deepEqual([bar.x, bar.y, bar.w, bar.h, bar.shape, bar.radius, bar.name], [200, 80, 440, 60, 'rounded', 8, 'Shape: A']);
  const line = made.rows.find((row) => row.kind === 'path' && row.name === 'Line: value-axis')!;
  assert.equal(line.opacity, 30, 'SVG 0.3 is Design 30');
  assert.equal(line.strokeCap, 'butt', 'SVG default caps are written, since Design defaults to round');
  assert.equal(line.strokeJoin, 'miter');
  assert.equal(line.strokeW, 2, 'the stroke scales with the drawing');
  assert.ok((line.w as number) > 0, 'a vertical line is widened by half its stroke each side');
  const decoded = decodeAuthoredPathsResult(String(line.path));
  assert.ok(Array.isArray(decoded), 'the path value decodes');
  const text = made.rows.find((row) => row.kind === 'text')!;
  assert.equal(text.align, 'center');
  assert.equal(text.fontSize, 24);
  assert.equal(text.text, 'Revenue');
  assert.equal(text.font, 'Fixture Sans', 'the face the sheet names travels to the row');
});

test('a label row is wide enough for wide glyphs, so a value and its % stay on one line in Design', () => {
  const items: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 100, h: 100 }, items: [
    { kind: 'text', text: '38%', x: 50, y: 50, size: 10, anchor: 'middle' },
  ] } as VectorItemsV1;
  const made = vectorItemsToRows(items, { x: 0, y: 0, w: 100, h: 100 }, { idPrefix: 'l', group: 'g', fit: 'fill' });
  assert.ok('rows' in made);
  const row = made.rows[0]!;
  // Two digits and a % in a wide face need about 2.2 em; the old flat 0.6 em a
  // character gave 1.8 em, and the % wrapped under the digits.
  assert.ok((row.w as number) >= 22, `wide enough for "38%": ${String(row.w)}`);
  assert.equal(row.align, 'center');
  assert.equal((row.x as number) + (row.w as number) / 2, 50, 'the anchor stays the centre');
});

test('rows fit contain inside a slot, and stretch onto the box on fill', () => {
  const items: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 100, h: 50 }, items: [{ kind: 'path', d: 'M0 0L100 0L100 50L0 50Z', box: { x: 0, y: 0, w: 100, h: 50 }, fill: { hex: '#000000' } }] };
  const contain = vectorItemsToRows(items, { x: 0, y: 0, w: 200, h: 200 }, { idPrefix: 'a', group: 'g', fit: 'contain' });
  assert.ok('rows' in contain);
  assert.deepEqual([contain.rows[0]!.x, contain.rows[0]!.y, contain.rows[0]!.w, contain.rows[0]!.h], [0, 50, 200, 100]);
  const fill = vectorItemsToRows(items, { x: 0, y: 0, w: 200, h: 200 }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in fill);
  assert.deepEqual([fill.rows[0]!.w, fill.rows[0]!.h], [200, 200]);
});

test('a turned and mirrored placement turns every row about the placement centre', () => {
  const items: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 100, h: 100 }, items: [
    { kind: 'path', shape: 'rect', d: 'M0 0L10 0L10 10L0 10Z', box: { x: 0, y: 0, w: 10, h: 10 }, fill: { hex: '#000000' } },
  ] };
  const turned = vectorItemsToRows(items, { x: 0, y: 0, w: 100, h: 100, rot: 90 }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in turned);
  assert.deepEqual([turned.rows[0]!.x, turned.rows[0]!.y, turned.rows[0]!.rot], [90, 0, 90], 'the top-left square goes to the top right');
  const mirrored = vectorItemsToRows(items, { x: 0, y: 0, w: 100, h: 100, flipH: true }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in mirrored);
  assert.deepEqual([mirrored.rows[0]!.x, mirrored.rows[0]!.flipH], [90, true]);
});

test('a dash becomes Design dashed with its first dash and gap, and a fill opacity rides on the colour', () => {
  const items: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 10, h: 10 }, items: [
    { kind: 'path', d: 'M0 0L10 10', box: { x: 0, y: 0, w: 10, h: 10 }, fill: { hex: '#ff0000' }, fillOpacity: 0.5, stroke: { color: { hex: '#000000' }, width: 1, dash: [4, 2] } },
  ] };
  const made = vectorItemsToRows(items, { x: 0, y: 0, w: 10, h: 10 }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in made);
  const row = made.rows[0]!;
  assert.deepEqual([row.strokeDash, row.strokeDashLen, row.strokeGapLen], ['dashed', 4, 2]);
  assert.equal(row.bg, '#ff000080');
});

test('more items than the row cap make no rows, and the caller keeps the picture', () => {
  const many: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 10, h: 10 }, items: Array.from({ length: MAX_VECTOR_ROWS_PER_OBJECT + 1 }, () => ({ kind: 'path' as const, d: 'M0 0L1 1', box: { x: 0, y: 0, w: 1, h: 1 }, stroke: { color: { hex: '#000000' }, width: 1 } })) };
  assert.deepEqual(vectorItemsToRows(many, { x: 0, y: 0, w: 10, h: 10 }, { idPrefix: 'a', group: 'g', fit: 'fill' }), { refused: 'cap-reached' });
});

test('the items drawn as markup hold nothing of the source but its shapes', () => {
  const hostile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><path d="M0 0h10v10z" fill="#123456" onclick="x()"/><text x="1" y="5">&lt;b&gt;</text></svg>';
  const markup = vectorItemsSvg(svgItemsOf(hostile, parse));
  assert.ok(!/script|onload|onclick|alert/.test(markup), markup);
  assert.match(markup, /&lt;b&gt;/, 'text is escaped');
});

/** Mean channel difference between two SVGs rendered at their own size. */
function rasterError(a: string, b: string): number {
  const pa = new Resvg(a).render().pixels;
  const pb = new Resvg(b).render().pixels;
  assert.equal(pa.length, pb.length);
  return pa.reduce((sum, value, index) => sum + Math.abs(value - pb[index]!), 0) / pa.length;
}

/** A drawing the way Illustrator exports one by default: every paint in a class rule. */
const ILLUSTRATOR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">'
  + '<defs><style>.cls-1{fill:#30ba78;}.cls-2{fill:none;stroke:#0c322c;stroke-width:2px;}#hero{fill:#d65a28}g.axis > path{stroke:#999999;stroke-width:1}</style></defs>'
  + '<rect class="cls-1" x="0" y="0" width="50" height="50"/>'
  + '<path class="cls-2" d="M0 40L100 40"/>'
  + '<rect id="hero" class="cls-1" x="60" y="60" width="30" height="30"/>'
  + '<g class="axis"><path d="M5 95L95 95"/></g></svg>';

test('a style sheet paints by class, id and type as a browser does, between attributes and style=', () => {
  const items = svgItemsOf(ILLUSTRATOR, parse);
  assert.equal(items.omitted, undefined, 'every rule was applied, so nothing is left out');
  const [box, line, hero, axis] = paths(items);
  assert.deepEqual(box!.fill, { hex: '#30ba78' }, 'a class rule fills');
  assert.deepEqual(line!.stroke, { color: { hex: '#0c322c' }, width: 2 }, 'a stroke from the sheet keeps a line of no area');
  assert.deepEqual(hero!.fill, { hex: '#d65a28' }, 'an id rule outranks a class rule');
  assert.deepEqual(axis!.stroke, { color: { hex: '#999999' }, width: 1 }, 'a child combinator matches');
  assert.ok(rasterError(ILLUSTRATOR, vectorItemsDocument(items)) < 0.05, 'the items draw what the source draws');
});

test('Office recolourable icon classes, !important and style= take their places in the cascade', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><style>.MsftOfcThm_Accent1_Fill_v2{fill:#4472C4;}'
    + '.pin{fill:#111111 !important}</style>'
    + '<path class="MsftOfcThm_Accent1_Fill_v2" fill="#000000" d="M0 0h40v40h-40z"/>'
    + '<path class="MsftOfcThm_Accent1_Fill_v2" style="fill:#ff0000" d="M50 0h40v40h-40z"/>'
    + '<path class="pin" style="fill:#ff0000" d="M0 50h40v40h-40z"/></svg>';
  const [sheet, inline, important] = paths(svgItemsOf(svg, parse));
  assert.deepEqual(sheet!.fill, { hex: '#4472c4' }, 'a rule beats a presentation attribute');
  assert.deepEqual(inline!.fill, { hex: '#ff0000' }, 'style= beats a rule');
  assert.deepEqual(important!.fill, { hex: '#111111' }, 'an important rule beats style=');
});

test('a rule this reading cannot match refuses the drawing when it paints, and is passed over when it only sets a face', () => {
  const hover = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>rect:hover{fill:red}</style><rect width="5" height="5"/></svg>', parse);
  assert.deepEqual(hover.items, [], 'the drawing stays its picture rather than arriving in the wrong colour');
  assert.deepEqual(hover.omitted, [{ reason: 'unsupported-paint', count: 1 }]);
  const media = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@media (prefers-color-scheme: dark){rect{fill:#fff}}</style><rect width="5" height="5"/></svg>', parse);
  assert.deepEqual(media.omitted, [{ reason: 'unsupported-paint', count: 1 }]);
  const face = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>text:first-child{font-family:Serif}@font-face{font-family:X;src:url(x.woff)}</style><rect width="5" height="5" fill="#000"/></svg>', parse);
  assert.equal(face.items.length, 1);
  assert.equal(face.omitted, undefined);
});

test('percentage geometry resolves against the viewport, unreadable geometry is counted, and a non-scaling stroke keeps its width', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">'
    + '<rect x="10%" width="50%" height="20" fill="red"/>'
    + '<path d="garbage" fill="red"/>'
    + '<rect width="1furlong" height="5" fill="red"/>'
    + '<g transform="scale(4)"><line x1="0" y1="0" x2="10" y2="0" stroke="#000" vector-effect="non-scaling-stroke"/></g></svg>';
  const items = svgItemsOf(svg, parse);
  const [pct, line] = paths(items);
  assert.deepEqual(pct!.box, { x: 20, y: 0, w: 100, h: 20 });
  assert.equal(line!.stroke?.width, 1, 'the width the source states, whatever the scale above it');
  assert.deepEqual(items.omitted, [{ reason: 'unsupported-element', count: 2 }], 'unparsable data and an unknown unit are named, so the drawing is approximate');
});

test('a circle is a path row, so a deck lowering keeps it round', () => {
  const items = svgItemsOf('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="5" fill="#123456"/><ellipse cx="20" cy="20" rx="6" fill="#123456"/></svg>', parse);
  assert.equal(paths(items)[0]!.shape, 'ellipse', 'the item still says what it is');
  assert.equal(items.items.length, 2, 'an ellipse with one radius takes it for both');
  const made = vectorItemsToRows(items, { x: 0, y: 0, w: 100, h: 100 }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in made);
  assert.deepEqual(made.rows.map((row) => [row.kind, row.name]), [['path', 'Drawing'], ['path', 'Drawing']]);
  assert.deepEqual([made.rows[0]!.x, made.rows[0]!.y, made.rows[0]!.w, made.rows[0]!.h], [45, 45, 10, 10]);
});

test('a straight freeform line with no extent on one axis keeps its outline as a row', () => {
  const items = custGeomItems({ paths: [{ d: 'M0 0L300 0', w: 300, h: 1 }] }, { w: 300, h: 0 }, { line: { color: { hex: '#0c322c' }, widthPx: 2 } });
  assert.deepEqual(items.viewBox, { x: 0, y: 0, w: 300, h: 0 });
  assert.equal(items.items.length, 1);
  const made = vectorItemsToRows(items, { x: 10, y: 50, w: 300, h: 0 }, { idPrefix: 'a', group: 'g', fit: 'fill' });
  assert.ok('rows' in made, 'a drawing with one axis of no size is placed');
  const row = made.rows[0]!;
  assert.equal(row.kind, 'path');
  assert.deepEqual([row.x, row.y, row.w, row.h], [10, 49, 300, 2], 'the thin box is widened by the stroke');
  assert.deepEqual(vectorItemsToRows({ ...items, viewBox: { x: 0, y: 0, w: 0, h: 0 } }, { x: 0, y: 0, w: 0, h: 0 }, { idPrefix: 'a', group: 'g', fit: 'fill' }), { refused: 'unplaceable' });
});

test('a crop cuts the viewBox, drops what it hides, and refuses a part it cuts through', () => {
  const items: VectorItemsV1 = { version: 1, viewBox: { x: 0, y: 0, w: 100, h: 100 }, items: [
    { kind: 'path', d: 'M10 10L30 10L30 30Z', box: { x: 10, y: 10, w: 20, h: 20 }, fill: { hex: '#000000' } },
    { kind: 'path', d: 'M80 80L95 80L95 95Z', box: { x: 80, y: 80, w: 15, h: 15 }, fill: { hex: '#000000' } },
  ] };
  assert.equal(cropVectorItems(items, {}), items, 'no crop, the same drawing');
  const cut = cropVectorItems(items, { r: 0.4, b: 0.4 });
  assert.deepEqual(cut?.viewBox, { x: 0, y: 0, w: 60, h: 60 });
  assert.equal(cut?.items.length, 1, 'the hidden part is dropped');
  assert.equal(cropVectorItems(items, { l: 0.2 }), null, 'a crop through a part keeps the picture');
  assert.deepEqual(cropVectorItems(items, { l: -0.5 })?.viewBox, { x: -50, y: 0, w: 150, h: 100 }, 'a negative crop is a margin');
});

test('a drawing row name comes apart into its kind word and its label, and path data is counted', () => {
  assert.deepEqual(vectorRowNameParts('Shape: Yes'), { kind: 'Shape', label: 'Yes' });
  assert.deepEqual(vectorRowNameParts('Drawing'), { kind: 'Drawing' });
  assert.equal(vectorRowNameParts('ppt/slides/slide2.xml.3'), undefined);
  assert.equal(vectorRowsPathChars([{ id: 'a', kind: 'path', path: '1!cubic!0_0' }, { id: 'b', kind: 'box' }]), 11);
});

test('outlined glyphs on one baseline are a run; a wide box standing in for a label is not', () => {
  // The fixture chart's category "labels" are plain boxes 40 wide and 10 tall: no glyph is that shape.
  assert.equal(glyphRunsOf(svgItemsOf(CHART, parse)).length, 0);
  // "Hi" outlined the way the chart tool writes a label: one path, glyphs standing on y = 0.
  const hi = 'M0 0V-14H2V-8H8V-14H10V0H8V-6H2V0ZM13 0V-10H15V0ZM13 -12V-14H15V-12Z';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><g class="cat-axis"><path d="${hi}" transform="translate(40,100)" fill="#141414" opacity="0.8"/></g></svg>`;
  const items = svgItemsOf(svg, parse);
  const runs = glyphRunsOf(items);
  assert.equal(runs.length, 1);
  assert.deepEqual(runs[0]!.box, { x: 40, y: 86, w: 15, h: 14 });
  assert.equal(runs[0]!.glyphs, 2, 'the dot of the i is part of its glyph');
  assert.equal(runs[0]!.baseline, 100);
  assert.equal(runs[0]!.opacity, 0.8);
  assert.equal(runs[0]!.labelGroup, true);
  assert.deepEqual(runs[0]!.items, [0]);
  assert.equal(isLabelGroup('value-axis'), true);
  assert.equal(isLabelGroup('d3-plot'), false);
});
