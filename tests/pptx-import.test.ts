// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for shells/web/src/views/pptx-import.ts - the PURE slide→SVG renderer
 * (pptxSlideToSvg). The renderer is a string builder over the engine's
 * pptx-read model with no DOM APIs, so it runs directly in node; fixtures are
 * hand-built read-model nodes, no XML or zip involved. openPptxFile /
 * ingestPptxAsSvgAssets are DOM + dialog territory and are NOT tested here.
 *
 * Run with: node --test tests/pptx-import.test.ts
 */

// The module's ingest half type-references pdf-import → picker → the web export
// bridge, whose untyped vendor libs (dom-to-image-more, gifenc) are declared in
// an ambient d.ts the web project includes via its own tsconfig. Reference it so
// `tsc -p tests` sees the same declarations when this chain enters its program.
/// <reference path="../shells/web/src/vendor.d.ts" />

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { pptxSlideToSvg, pptxSlideToNodes, pptxParasToText, pptxSlideBackground, MAX_SLIDE_NODES } from '../shells/web/src/views/pptx-import.ts';
import type { PptxNodeMapOpts } from '../shells/web/src/views/pptx-import.ts';
import { EMU_PER_PX } from '../engine/src/pptx.ts';
import type { PptxReadNode, PptxReadSlide, PptxReadTheme } from '../engine/src/pptx-read.ts';

// ─── fixture helpers ─────────────────────────────────────────────────────────

const THEME: PptxReadTheme = {
  colors: { lt1: 'FFFFFF', dk1: '112233', accent1: '4472C4' },
  majorFont: 'Calibri Light',
  minorFont: 'Calibri',
};

/** A node box in px, converted to the read-model's EMU fields. */
function box(x: number, y: number, w: number, h: number): { xEmu: number; yEmu: number; cxEmu: number; cyEmu: number } {
  return { xEmu: x * EMU_PER_PX, yEmu: y * EMU_PER_PX, cxEmu: w * EMU_PER_PX, cyEmu: h * EMU_PER_PX };
}

function render(
  nodes: PptxReadNode[],
  over: Partial<Parameters<typeof pptxSlideToSvg>[1]> = {},
): ReturnType<typeof pptxSlideToSvg> {
  const slide: PptxReadSlide = { index: 0, nodes };
  return pptxSlideToSvg(slide, {
    widthEmu: 960 * EMU_PER_PX,
    heightEmu: 540 * EMU_PER_PX,
    theme: THEME,
    getMedia: () => null,
    ...over,
  });
}

const count = (s: string, needle: string): number => s.split(needle).length - 1;

// ─── dimensions + background ─────────────────────────────────────────────────

test('EMU→px canvas: rounded slide size, viewBox, and the theme lt1 background', () => {
  const out = render([]);
  assert.equal(out.width, 960);
  assert.equal(out.height, 540);
  assert.ok(out.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" width="960" height="540">'));
  assert.ok(out.svg.includes('<rect x="0" y="0" width="960" height="540" fill="#FFFFFF"/>'));
});

test('degenerate EMU dimensions clamp to 1px; a missing lt1 falls back to white', () => {
  const out = render([], { widthEmu: 0, heightEmu: 3, theme: { colors: {} } });
  assert.equal(out.width, 1);
  assert.equal(out.height, 1);
  assert.ok(out.svg.includes('fill="#ffffff"'));
});

// ─── elementCount semantics ──────────────────────────────────────────────────

test('a blank slide reports elementCount 0 (background rect excluded)', () => {
  const out = render([]);
  assert.equal(out.elementCount, 0);
  assert.equal(count(out.svg, '<rect'), 1); // the background only
});

test('an invisible shape (no fill, no line) is skipped and not counted', () => {
  const out = render([{ type: 'shape', geom: 'rect', ...box(10, 10, 100, 50) }]);
  assert.equal(out.elementCount, 0);
  assert.equal(count(out.svg, '<rect'), 1);
});

test('drawn nodes each count once - a text and a shape make 2', () => {
  const out = render([
    { type: 'shape', geom: 'rect', fill: { hex: 'FF0000' }, ...box(0, 0, 10, 10) },
    { type: 'text', paras: [{ runs: [{ text: 'hi' }] }], ...box(0, 20, 100, 30) },
  ]);
  assert.equal(out.elementCount, 2);
});

// ─── shapes ──────────────────────────────────────────────────────────────────

test('shape geom maps: ellipse → <ellipse>, roundRect → <rect rx>, else plain <rect>', () => {
  const ell = render([{ type: 'shape', geom: 'ellipse', fill: { hex: '30BA78' }, ...box(100, 40, 200, 100) }]);
  assert.ok(ell.svg.includes('<ellipse cx="200" cy="90" rx="100" ry="50" fill="#30BA78"/>'));

  const round = render([{ type: 'shape', geom: 'roundRect', fill: { hex: '0C322C' }, ...box(0, 0, 100, 40) }]);
  assert.ok(round.svg.includes('<rect x="0" y="0" width="100" height="40" rx="6" fill="#0C322C"/>'));

  const plain = render([{ type: 'shape', geom: 'star5', fill: { hex: 'ABCDEF' }, ...box(0, 0, 10, 10) }]);
  assert.ok(plain.svg.includes('<rect x="0" y="0" width="10" height="10" fill="#ABCDEF"/>'));
});

test('shape paint: line-only strokes with fill "none"; scheme colours use their resolved hex', () => {
  const lineOnly = render([{ type: 'shape', geom: 'rect', line: { hex: '112233' }, ...box(0, 0, 10, 10) }]);
  assert.ok(lineOnly.svg.includes('fill="none" stroke="#112233" stroke-width="1.5"'));

  const scheme = render([{ type: 'shape', geom: 'rect', fill: { scheme: 'accent1', hex: '4472C4' }, ...box(0, 0, 10, 10) }]);
  assert.ok(scheme.svg.includes('fill="#4472C4"'));

  // an unresolved scheme colour (phClr - no hex) paints nothing; with no line the node skips
  const phClr = render([{ type: 'shape', geom: 'rect', fill: { scheme: 'phClr' }, ...box(0, 0, 10, 10) }]);
  assert.equal(phClr.elementCount, 0);
});

// ─── text ────────────────────────────────────────────────────────────────────

test('runs carry styling: bold/italic/underline, pt→px size, explicit font + colour', () => {
  const out = render([{
    type: 'text',
    paras: [{ runs: [{ text: 'Hello', bold: true, italic: true, underline: true, sizePt: 24, font: 'Georgia', color: { hex: 'FF0000' } }] }],
    ...box(10, 20, 300, 60),
  }]);
  assert.ok(out.svg.includes(
    '<tspan font-family="Georgia" font-size="32" fill="#FF0000" font-weight="bold" font-style="italic" text-decoration="underline">Hello</tspan>',
  ));
});

test('run fallbacks: theme minorFont + dk1 ink; sans-serif + black when the theme is bare', () => {
  const node: PptxReadNode = { type: 'text', paras: [{ runs: [{ text: 'x' }] }], ...box(0, 0, 100, 30) };
  const themed = render([node]);
  assert.ok(themed.svg.includes('font-family="Calibri" font-size="24" fill="#112233"'));

  const bare = render([node], { theme: { colors: {} } });
  assert.ok(bare.svg.includes('font-family="sans-serif" font-size="24" fill="#000000"'));
});

test('text content and attribute values are XML-escaped', () => {
  const out = render([{
    type: 'text',
    paras: [{ runs: [{ text: '<&">', font: 'A"B<C' }] }],
    ...box(0, 0, 100, 30),
  }]);
  assert.ok(out.svg.includes('>&lt;&amp;&quot;&gt;</tspan>'));
  assert.ok(out.svg.includes('font-family="A&quot;B&lt;C"'));
  assert.ok(!out.svg.includes('<&'));
});

test('paragraph baselines advance by 1.25 × the paragraph max size (empty runs still emit no <text>)', () => {
  const out = render([{
    type: 'text',
    paras: [
      { runs: [{ text: 'big', sizePt: 36 }, { text: 'small', sizePt: 12 }] }, // max 36pt → 48px ascent, 60px advance
      { runs: [] },                                                          // blank line: advances 18pt default, no <text>
      { runs: [{ text: 'after' }] },                                         // default 18pt → 24px ascent
    ],
    ...box(10, 20, 400, 200),
  }]);
  // para 1 baseline: 20 + 48 = 68; para 3 baseline: 20 + 60 + 30 + 24 = 134
  assert.ok(out.svg.includes('<text x="10" y="68">'));
  assert.ok(out.svg.includes('<text x="10" y="134">'));
  assert.equal(count(out.svg, '<text'), 2);
});

// ─── pictures ────────────────────────────────────────────────────────────────

test('pic with resolvable media inlines the data URL; without it, a labeled placeholder', () => {
  const withMedia = render(
    [{ type: 'pic', embed: 'rId4', media: 'ppt/media/image1.png', ...box(50, 60, 200, 100) }],
    { getMedia: (path) => (path === 'ppt/media/image1.png' ? { dataUrl: 'data:image/png;base64,AAAA' } : null) },
  );
  assert.ok(withMedia.svg.includes(
    '<image x="50" y="60" width="200" height="100" preserveAspectRatio="none" href="data:image/png;base64,AAAA"/>',
  ));
  assert.equal(withMedia.elementCount, 1);

  const noMedia = render([{ type: 'pic', media: 'ppt/media/movie1.mp4', ...box(50, 60, 200, 100) }]);
  assert.ok(!noMedia.svg.includes('<image'));
  assert.ok(noMedia.svg.includes('>Image</text>'));
  assert.ok(noMedia.svg.includes('fill="#e8e8e8"'));
  assert.equal(noMedia.elementCount, 1); // a placeholder is still drawn content
});

// ─── tables ──────────────────────────────────────────────────────────────────

test('table draws an outer frame, a capped 20×12 grid, and 11pt cell text', () => {
  const rows = Array.from({ length: 25 }, (_, i) => Array.from({ length: 15 }, (_, j) => `r${i}c${j}`));
  const out = render([{ type: 'table', rows, ...box(0, 0, 480, 400) }]);
  assert.equal(out.elementCount, 1);
  // 20 rows → 19 inner horizontal lines; 12 cols → 11 inner vertical lines
  assert.equal(count(out.svg, '<line'), 19 + 11);
  // cell text is capped to the 20×12 window
  assert.equal(count(out.svg, '<text'), 20 * 12);
  assert.ok(out.svg.includes('font-size="14.67"')); // 11pt × 96/72
  assert.ok(out.svg.includes('>r0c0</text>'));
  assert.ok(out.svg.includes('>r19c11</text>'));
  assert.ok(!out.svg.includes('r20c0'));
  assert.ok(!out.svg.includes('r0c12'));
});

test('a small table draws one line per inner boundary and skips empty cells', () => {
  const out = render([{ type: 'table', rows: [['a', ''], ['', 'b']], ...box(0, 0, 100, 50) }]);
  assert.equal(count(out.svg, '<line'), 2); // 1 horizontal + 1 vertical
  assert.equal(count(out.svg, '<text'), 2); // empty cells emit nothing
});

// ─── unknown nodes ───────────────────────────────────────────────────────────

test('unknown nodes (charts, SmartArt) become a labeled light-grey placeholder', () => {
  const out = render([{ type: 'unknown', tag: 'chart', ...box(100, 100, 300, 200) }]);
  assert.ok(out.svg.includes('fill="#e8e8e8"'));
  assert.ok(out.svg.includes('>Chart / SmartArt</text>'));
  assert.equal(out.elementCount, 1);
});

// ─── rotation ────────────────────────────────────────────────────────────────

test('rot wraps the node in a group rotated about its centre', () => {
  const out = render([{ type: 'shape', geom: 'rect', fill: { hex: '000000' }, rot: 45, ...box(100, 50, 200, 100) }]);
  assert.ok(out.svg.includes('<g transform="rotate(45 200 100)"><rect'));
  assert.ok(out.svg.includes('</g>'));
  assert.equal(out.elementCount, 1);
});

test('a node without rot is emitted bare (no wrapper group)', () => {
  const out = render([{ type: 'shape', geom: 'rect', fill: { hex: '000000' }, ...box(0, 0, 10, 10) }]);
  assert.ok(!out.svg.includes('<g '));
});

// ─── slides as EDITABLE boxes (pptxSlideToNodes, the Design import) ──────────

const NODE_OPTS: PptxNodeMapOpts = { widthEmu: 960 * EMU_PER_PX, heightEmu: 540 * EMU_PER_PX, theme: THEME, resolveMedia: () => null };
const nodes = (ns: PptxReadNode[], over: Partial<PptxNodeMapOpts> & { inherited?: PptxReadNode[]; background?: PptxReadSlide['background']; index?: number } = {}) =>
  pptxSlideToNodes({ index: over.index ?? 0, nodes: ns, ...(over.inherited ? { inherited: over.inherited } : {}), ...(over.background ? { background: over.background } : {}) }, { ...NODE_OPTS, ...over });

test('pptxParasToText: bold/italic runs become the markdown subset, one line per paragraph', () => {
  assert.equal(pptxParasToText([
    { runs: [{ text: 'Plain ' }, { text: 'bold', bold: true }, { text: ' and ' }, { text: 'em', italic: true }] },
    { runs: [] },
    { runs: [{ text: 'last' }] },
  ]), 'Plain **bold** and *em*\n\nlast');
});

test('a text node maps to a text box in slide px: size, face, ink and the shape’s fill', () => {
  const [n] = nodes([{ type: 'text', ...box(10, 20, 300, 60), fill: { hex: '30BA78' },
    paras: [{ runs: [{ text: 'Title', sizePt: 36, bold: true, font: 'SUSE', color: { hex: '112233' } }] }] }]);
  assert.equal(n!.kind, 'text');
  assert.deepEqual([n!.x, n!.y, n!.w, n!.h], [10, 20, 300, 60]);
  assert.equal(n!.text, '**Title**');
  assert.equal(n!.fontSize, 48, '36pt × 96/72');
  assert.equal(n!.fontFamily, 'SUSE');
  assert.equal(n!.fontWeight, 700);
  assert.equal(n!.fg, '#112233');
  assert.equal(n!.fill, '#30BA78', 'a coloured title bar keeps its colour on the box');
});

test('text with no size or face takes the deck’s: 18pt and the theme minor font, dk1 ink', () => {
  const [n] = nodes([{ type: 'text', ...box(0, 0, 100, 20), paras: [{ runs: [{ text: 'x' }] }] }]);
  assert.equal(n!.fontSize, 24);
  assert.equal(n!.fontFamily, 'Calibri');
  assert.equal(n!.fg, '#112233');
  assert.equal(n!.fill, '', 'no fill means transparent, not the seed colour');
});

test('shapes: fill, outline and geometry; an invisible shape is skipped', () => {
  const out = nodes([
    { type: 'shape', geom: 'ellipse', fill: { hex: 'FF0000' }, line: { hex: '00FF00' }, lineWidthPt: 3, ...box(0, 0, 50, 50) },
    { type: 'shape', geom: 'roundRect', fill: { hex: '0000FF' }, ...box(60, 0, 50, 50) },
    { type: 'shape', geom: 'rect', ...box(120, 0, 50, 50) },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.shape, 'ellipse');
  assert.equal(out[0]!.fill, '#FF0000');
  assert.equal(out[0]!.stroke, '#00FF00');
  assert.equal(out[0]!.strokeW, 4, '3pt outline in px');
  assert.equal(out[1]!.shape, 'rounded');
  assert.equal(out[1]!.stroke, undefined);
});

test('an EMPTY title/body placeholder becomes an empty text box to type into; furniture slots do not', () => {
  const out = nodes([
    { type: 'shape', ...box(0, 0, 400, 60), ph: { type: 'ctrTitle' } },
    { type: 'shape', ...box(0, 80, 400, 200), ph: { type: 'body', idx: 1 } },
    { type: 'shape', ...box(0, 500, 100, 20), ph: { type: 'sldNum', idx: 12 } },
    { type: 'shape', ...box(0, 500, 100, 20), ph: { type: 'ftr' } },
  ]);
  assert.equal(out.length, 2, 'two slots to type into, no invisible furniture');
  assert.equal(out[0]!.kind, 'text');
  assert.equal(out[0]!.text, '');
  assert.equal(out[0]!.fontWeight, 700, 'a title slot reads as a title');
  assert.equal(out[0]!.fontFamily, 'Calibri Light', 'the theme’s major face');
  assert.equal(out[0]!.fontSize, Math.round(28 * 96 / 72 * 100) / 100);
  assert.equal(out[1]!.fontWeight, 400);
});

test('a slide-number field reads as the number itself', () => {
  const [n] = nodes([{ type: 'text', ...box(0, 0, 50, 20), ph: { type: 'sldNum' }, paras: [{ runs: [{ text: '‹#›' }] }] }], { index: 6 });
  assert.equal(n!.text, '7');
});

test('pictures: a stored ref becomes an image box stretched to its frame; nothing stored becomes a labelled placeholder', () => {
  const ref = { source: 'user', id: 'user/upload/1-logo.png', type: 'raster', url: 'blob:1' };
  const got = nodes([{ type: 'pic', media: 'ppt/media/logo.png', ...box(5, 5, 90, 40) }], { resolveMedia: (p) => (p === 'ppt/media/logo.png' ? ref as never : null) });
  assert.equal(got.length, 1);
  assert.equal(got[0]!.kind, 'image');
  assert.equal(got[0]!.image, ref);
  assert.equal(got[0]!.fit, 'fill');
  const none = nodes([{ type: 'pic', media: 'ppt/media/chart.emf', ...box(5, 5, 90, 40) }]);
  assert.equal(none.length, 2, 'a card and its label');
  assert.equal(none[0]!.kind, 'box');
  assert.equal(none[1]!.text, 'Image');
});

test('a table is an outline plus one text box per cell; a chart is a labelled placeholder', () => {
  const out = nodes([
    { type: 'table', ...box(0, 0, 200, 100), rows: [['a', 'b'], ['c', '']] },
    { type: 'unknown', tag: 'chart', ...box(0, 200, 100, 100) },
  ]);
  const texts = out.filter((n) => n.kind === 'text').map((n) => n.text);
  assert.deepEqual(texts, ['a', 'b', 'c', 'Chart / SmartArt']);
  assert.equal(out[0]!.kind, 'box');
  assert.equal(out[0]!.stroke, '#112233', 'the grid is outlined in ink');
  // Cells sit in their grid: the second column starts at half the width.
  assert.equal(out.find((n) => n.text === 'b')!.x, 104);
});

test('inherited furniture paints behind the slide’s own nodes, and a picture ground goes under everything', () => {
  const ref = { source: 'user', id: 'user/upload/2-bg.jpg', type: 'raster', url: 'blob:2' };
  const out = nodes(
    [{ type: 'text', ...box(0, 0, 100, 20), paras: [{ runs: [{ text: 'own' }] }] }],
    {
      inherited: [{ type: 'shape', fill: { hex: '30BA78' }, ...box(0, 0, 960, 30) }],
      background: { media: 'ppt/media/bg.jpg' },
      resolveMedia: (p) => (p === 'ppt/media/bg.jpg' ? ref as never : null),
    },
  );
  assert.deepEqual(out.map((n) => n.kind), ['image', 'box', 'text']);
  assert.deepEqual([out[0]!.w, out[0]!.h, out[0]!.fit], [960, 540, 'cover'], 'the ground covers the slide');
  assert.equal(out[1]!.fill, '#30BA78');
});

test('pptxSlideBackground: the slide’s own colour, else the deck’s lt1', () => {
  const deck = { widthEmu: 1, heightEmu: 1, theme: THEME, slides: [] };
  assert.equal(pptxSlideBackground({ index: 0, nodes: [] }, deck), '#FFFFFF');
  assert.equal(pptxSlideBackground({ index: 0, nodes: [], background: { color: { hex: '0C322C' } } }, deck), '#0C322C');
});

test('the node budget holds: a wall of shapes stops at MAX_SLIDE_NODES', () => {
  const many: PptxReadNode[] = Array.from({ length: MAX_SLIDE_NODES + 50 }, (_, i) => ({ type: 'shape', geom: 'rect', fill: { hex: '000000' }, ...box(i, 0, 1, 1) }));
  assert.equal(nodes(many).length, MAX_SLIDE_NODES);
});

test('pptxSlideToSvg paints inherited furniture behind the slide and the slide’s own ground colour', () => {
  const out = pptxSlideToSvg({
    index: 0,
    nodes: [{ type: 'text', paras: [{ runs: [{ text: 'hi' }] }], ...box(0, 20, 100, 30) }],
    inherited: [{ type: 'shape', geom: 'rect', fill: { hex: '30BA78' }, ...box(0, 0, 960, 30) }],
    background: { color: { hex: '0C322C' } },
  }, { widthEmu: 960 * EMU_PER_PX, heightEmu: 540 * EMU_PER_PX, theme: THEME, getMedia: () => null });
  assert.ok(out.svg.includes('fill="#0C322C"'), 'the slide’s ground, not lt1');
  assert.equal(out.elementCount, 2, 'furniture counts as content - a designed empty slide is not blank');
  assert.ok(out.svg.indexOf('#30BA78') < out.svg.indexOf('<text'), 'the bar is painted before the text');
});

