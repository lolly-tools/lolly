// SPDX-License-Identifier: MPL-2.0
/**
 * psd-import.ts: the Photoshop and GIMP layer -> Design node mapping.
 *
 * Run with: node --test shells/web/src/views/psd-import.test.ts
 *
 * The layered readers (engine/src/psd.ts, xcf.ts) report opacity as a 0..1
 * fraction; a Design node carries a 0..100 percentage. The two scales met
 * unconverted on the "Open into Design" route, so an opaque layer arrived at 1%
 * (plans/289, found while surveying the Photoshop import).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designNodeFromLayer } from './psd-import.ts';
import { finalizeBoxes } from '../../../../engine/src/design-map.ts';
import type { RasterLayer } from '../../../../engine/src/raster-layers.ts';

function layer(over: Partial<RasterLayer> = {}): RasterLayer {
  return {
    name: 'Layer', x: 10, y: 20, width: 30, height: 40, pixels: new Uint8Array(30 * 40 * 4),
    opacity: 1, blend: 'normal', blendRaw: 'norm', blendLossy: false, visible: true, clipped: false,
    isGroup: false, groupPath: [], ...over,
  } as RasterLayer;
}

test('an opaque layer becomes a fully opaque Design box, not a 1% one', () => {
  const node = designNodeFromLayer(layer({ opacity: 1 }), 'asset:a', '');
  assert.equal(node.opacity, 100);
  const [box] = finalizeBoxes([node] as Parameters<typeof finalizeBoxes>[0], { prefix: 'psd' }) as Array<{ opacity: number }>;
  assert.equal(box!.opacity, 100);
});

test('a partial layer opacity keeps its value on the percentage scale', () => {
  assert.equal(designNodeFromLayer(layer({ opacity: 128 / 255 }), 'asset:a', '').opacity, 50);
  assert.equal(designNodeFromLayer(layer({ opacity: 0 }), 'asset:a', '').opacity, 0);
});

test('placement, blend and group travel with the node', () => {
  const node = designNodeFromLayer(layer({ blend: 'multiply' }), 'asset:a', 'Outer/Inner');
  assert.deepEqual(
    { x: node.x, y: node.y, w: node.w, h: node.h, blend: node.blend, group: node.group, image: node.image },
    { x: 10, y: 20, w: 30, h: 40, blend: 'multiply', group: 'Outer/Inner', image: 'asset:a' },
  );
  assert.equal(designNodeFromLayer(layer(), 'asset:a', '').blend, undefined);
  assert.equal(designNodeFromLayer(layer(), 'asset:a', '').group, undefined);
});

// ── live layers (plans/289 item 1, M3 step 4) ────────────────────────────────

const { liveDesignNode, designPathFromSubpaths, parseLayeredAsDesign, psdRunsToMarkup } = await import('./psd-import.ts');
const { sameWinding, unionOutline } = await import('../../../../engine/src/psd-outline.ts');
const { decodeAuthoredPaths } = await import('../../../../engine/src/geom/authored-url.ts');
const fx = await import('../../../../tests/helpers/psd-fixtures.ts');

test('a text layer comes in as a Design text node with its type settings', () => {
  const l = layer({
    name: 'Headline', opacity: 0.8,
    psd: { notes: [], text: { text: 'Big news', postScriptName: 'Inter-SemiBold', family: 'Inter', weight: 600, italic: true, size: 40, color: '#30ba78', tracking: 1.5, lineHeight: 1.3, align: 'center', box: { x: 100, y: 50, w: 400, h: 52 }, paragraph: false, rotation: 15, runs: [{ text: 'Big news', family: 'Inter', weight: 600, italic: true, size: 40, color: '#30ba78', underline: false, strike: false }] } },
  });
  const live = liveDesignNode(l, { w: 800, h: 600 }, '')!;
  assert.equal(live.kind, 'text');
  assert.deepEqual(
    { ...live.node },
    { kind: 'text', opacity: 80, blend: undefined, group: undefined, x: 100, y: 50, w: 400, h: 52, rot: 15, text: 'Big news', fg: '#30ba78', fontSize: 40, fontFamily: 'Inter', fontWeight: 600, textAlign: 'center', lineHeight: 1.3, tracking: 1.5, pad: 0, fill: '' },
  );
  assert.equal(live.markup, '*Big news*', 'italic travels as the editor\'s own markup');
  assert.equal(live.notes.length, 0, 'nothing is lost, so the report says nothing');
});

test('combined outlines all turn one way, so the non-zero rule draws their union', () => {
  const k = (x: number, y: number) => ({ x, y, inX: x, inY: y, outX: x, outY: y });
  const clockwise = { closed: true, op: 1, knots: [k(0, 0), k(10, 0), k(10, 10), k(0, 10)] };
  const anti = { closed: true, op: 1, knots: [k(20, 0), k(20, 10), k(30, 10), k(30, 0)] };
  const [a, b] = sameWinding([clockwise, anti]);
  assert.equal(a, clockwise, 'an outline already turning the first way is left alone');
  assert.deepEqual(b!.knots.map(p => [p.x, p.y]), [[30, 0], [30, 10], [20, 10], [20, 0]]);
  const curved = sameWinding([{ closed: true, op: 1, knots: [{ x: 0, y: 0, inX: -1, inY: 1, outX: 1, outY: -1 }, k(-10, 5), k(0, 10)] }])[0]!;
  assert.deepEqual([curved.knots.at(-1)!.inX, curved.knots.at(-1)!.outX], [1, -1], 'handles swap with the direction');
});

test('a stroked combined shape is stroked around its outside only: the outlines merge into one', () => {
  const k = (x: number, y: number) => ({ x, y, inX: x, inY: y, outX: x, outY: y });
  const square = (x: number, y: number) => ({ closed: true, op: 1, knots: [k(x, y), k(x + 10, y), k(x + 10, y + 10), k(x, y + 10)] });
  const merged = unionOutline([square(0, 0), square(5, 5)])!;
  assert.equal(merged.length, 1, 'one outline, not two');
  const xs = merged[0]!.knots.map(p => p.x), ys = merged[0]!.knots.map(p => p.y);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [0, 15, 0, 15]);
  assert.ok(!merged[0]!.knots.some(p => p.x === 5 && p.y === 5), 'the inner corner of the overlap is gone');
  const live = liveDesignNode(layer({ psd: { notes: [], path: { subpaths: [square(0, 0), square(5, 5)], fill: '#00aa00', stroke: { color: '#000000', width: 1, cap: 'butt', join: 'miter', align: 'center' } } } }), { w: 800, h: 600 }, '')!;
  assert.equal(decodeAuthoredPaths(live.path!)!.length, 1);
  assert.equal(live.notes.length, 0);
});

test('style runs become inline markup: italic, weight, colour, underline and strikethrough per word', () => {
  const run = (text: string, over: Partial<{ weight: number; italic: boolean; color: string; underline: boolean; strike: boolean }> = {}) =>
    ({ text, weight: 400, italic: false, color: '#000000', underline: false, strike: false, ...over });
  assert.equal(
    psdRunsToMarkup([run('Big '), run('news', { italic: true, color: '#FF0000', underline: true }), run(' '), run('today', { weight: 700, strike: true })], { weight: 400, color: '#000000' }),
    'Big {#ff0000 u|*news*} {w700 s|today}',
  );
  assert.equal(psdRunsToMarkup([run('Line one\nline two', { italic: true })], { weight: 400, color: '#000000' }), '*Line one*\n*line two*', 'markers never cross a line end');
  assert.equal(psdRunsToMarkup([run('5 * 3 = 15_ish')], { weight: 400, color: '#000000' }), '5 \\* 3 = 15\\_ish', 'literal markers are escaped');
  assert.equal(psdRunsToMarkup([run(' lead', { italic: true })], { weight: 400, color: '#000000' }), ' *lead*', 'whitespace stays outside the markers');
});

test('shapes, fills and fill opacity come in as Design boxes', () => {
  const rounded = liveDesignNode(layer({ psd: { notes: [], shape: { kind: 'rounded', box: { x: 10, y: 20, w: 100, h: 50 }, radius: 12, fill: '#ff0000', stroke: { color: '#000000', width: 3, cap: 'round', join: 'miter', align: 'center', dash: [6, 3] } } } }), { w: 800, h: 600 }, 'Cards')!;
  assert.deepEqual({ ...rounded.node }, { kind: 'box', opacity: 100, blend: undefined, group: 'Cards', x: 8.5, y: 18.5, w: 103, h: 53, shape: 'rounded', radius: 13.5, fill: '#ff0000', stroke: '#000000', strokeW: 3 }, 'a centred 3 px stroke: the box grows by 1.5 px, because Design draws a box stroke inside its edge');
  assert.deepEqual(rounded.fields, { strokeCap: 'round', strokeJoin: 'miter', strokeDash: 'dashed', strokeDashArray: '6 3' }, 'cap, join and dashes go on after finalizeBoxes');
  const fill = liveDesignNode(layer({ x: 0, y: 0, width: 0, height: 0, psd: { notes: [], fill: '#336699' } }), { w: 800, h: 600 }, '')!;
  assert.deepEqual([fill.node.x, fill.node.y, fill.node.w, fill.node.h, fill.node.fill], [0, 0, 800, 600, '#336699']);
  const faded = liveDesignNode(layer({ opacity: 0.5, psd: { notes: [], fillOpacity: 0.5, shape: { kind: 'ellipse', box: { x: 0, y: 0, w: 10, h: 10 }, radius: 0, fill: '#fff', stroke: null } } }), { w: 800, h: 600 }, '')!;
  assert.equal(faded.node.opacity, 25);
  assert.equal(faded.node.shape, 'ellipse');
  assert.match(faded.notes.join(' '), /Fill opacity/);
  assert.equal(liveDesignNode(layer(), { w: 800, h: 600 }, ''), null, 'a plain pixel layer stays pixels');
});

test('a path keeps its curves: nodes and handles as fractions of its box', () => {
  const built = designPathFromSubpaths([{ closed: true, op: 1, knots: [
    { x: 100, y: 100, inX: 100, inY: 100, outX: 150, outY: 80 },
    { x: 300, y: 100, inX: 250, inY: 80, outX: 300, outY: 100 },
    { x: 200, y: 300, inX: 200, inY: 300, outX: 200, outY: 300 },
  ] }])!;
  assert.deepEqual(built.box, { x: 100, y: 80, w: 200, h: 220 });
  const [path] = decodeAuthoredPaths(built.wire)!;
  assert.equal(path!.kind, 'cubic');
  assert.equal(path!.closed, true);
  const n0 = path!.nodes[0]!;
  assert.deepEqual([n0.x, n0.y], [0, 20 / 220].map(v => Number(v.toFixed(6))));
  assert.ok(Math.abs((n0.hOutX ?? 0) - 0.25) < 1e-6 && Math.abs((n0.hOutY ?? 0) + 20 / 220) < 1e-6, 'outgoing handle kept');
  const live = liveDesignNode(layer({ psd: { notes: [], path: { subpaths: [{ closed: true, op: 1, knots: [{ x: 0, y: 0, inX: 0, inY: 0, outX: 0, outY: 0 }, { x: 10, y: 0, inX: 10, inY: 0, outX: 10, outY: 0 }, { x: 5, y: 9, inX: 5, inY: 9, outX: 5, outY: 9 }] }], fill: '#123456', stroke: null } } }), { w: 800, h: 600 }, '')!;
  assert.equal(live.kind, 'path');
  assert.ok(live.path);
});

test('a whole file: text, shapes and paths arrive editable, clipping follows the base, and nothing is stored', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, getComputedStyle: g.getComputedStyle };
  g.document = dom.window.document;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    const { writePsd } = await import('../../../../engine/src/psd-write.ts');
    const px = (w: number, h: number) => new Uint8Array(w * h * 4).fill(255);
    const bytes = writePsd({
      width: 800, height: 600,
      layers: [
        { name: 'Card', x: 100, y: 100, width: 300, height: 200, pixels: px(300, 200),
          extraBlocks: [['SoCo', fx.solidColor('#30ba78')], ['vogk', fx.origination(5, { left: 100, top: 100, right: 400, bottom: 300 })]] },
        { name: 'Title', x: 120, y: 150, width: 200, height: 40, pixels: px(200, 40), clipped: true,
          extraBlocks: [['TySh', fx.typeLayer({ text: 'Hello', font: 'Helvetica-Bold', size: 32 })]] },
        { name: 'Star', x: 500, y: 100, width: 100, height: 100, pixels: px(100, 100),
          extraBlocks: [['SoCo', fx.solidColor('#ffcc00')], ['vmsk', fx.vectorMask(800, 600, [[{ at: [550, 100] }, { at: [600, 200] }, { at: [500, 200] }]])], ['lfx2', new Uint8Array(4)]] },
      ],
    });
    const warnings: string[] = [];
    const res = await parseLayeredAsDesign(new Blob([bytes as BlobPart]), { host: {} as never, warn: (m) => warnings.push(m) });
    const [card, title, star] = res.boxes as Record<string, unknown>[];
    assert.deepEqual([card!.name, title!.name, star!.name], ['Card', 'Title', 'Star'], 'layer names label the rows');
    assert.equal(card!.kind, 'box');
    assert.equal(card!.shape, 'ellipse');
    assert.equal(card!.bg, '#30ba78');
    assert.equal(title!.kind, 'text');
    assert.equal(title!.text, 'Hello');
    assert.equal(title!.fontSize, 32);
    assert.equal(title!.weight, '700');
    assert.equal(title!.clip, card!.id, 'the clipped title clips to the ellipse below it');
    assert.ok(!warnings.some(w => /Clipped to the rectangle/.test(w)), 'an ellipse base clips exactly, so there is no note');
    assert.equal(star!.kind, 'path');
    assert.equal(star!.fillRule, 'nonzero');
    assert.equal(star!.bg, '#ffcc00');
    assert.ok(decodeAuthoredPaths(String(star!.path)));
    assert.ok(warnings.some(w => /Star: Layer effects/.test(w)), 'notes reach the caller when nobody is asked');
    assert.deepEqual(res.fontSubstitutions, ['Helvetica'], 'a family the design system lacks is reported');
  } finally {
    g.document = saved.document;
    g.getComputedStyle = saved.getComputedStyle;
  }
});

test('real Photoshop files: combined ellipses come in as one outline, an inside stroke keeps its box', async () => {
  const { JSDOM } = await import('jsdom');
  const { readFileSync } = await import('node:fs');
  const dom = new JSDOM('<!DOCTYPE html><body></body>');
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, getComputedStyle: g.getComputedStyle };
  g.document = dom.window.document;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try {
    const open = async (name: string) => (await parseLayeredAsDesign(new Blob([readFileSync(new URL(`../../../../tests/fixtures/psd/${name}`, import.meta.url))]), { host: {} as never, warn: () => {} })).boxes as Record<string, unknown>[];
    const [ellipses] = await open('path-operations_combine.psd');
    assert.equal(ellipses!.kind, 'path');
    assert.equal(decodeAuthoredPaths(String(ellipses!.path))!.length, 1, 'one outline, so the stroke runs round the outside only');
    // stroke.psd also has pixel layers, which the import would store; map its shapes directly.
    const { readPsd } = await import('../../../../engine/src/psd.ts');
    const doc = readPsd(new Uint8Array(readFileSync(new URL('../../../../tests/fixtures/psd/stroke.psd', import.meta.url))));
    const live = (name: string) => liveDesignNode(doc.layers.find(l => l.name === name)!, { w: doc.width, h: doc.height }, '')!;
    const rect = live('Rectangle 1');
    assert.deepEqual([rect.node.x, rect.node.y, rect.node.w, rect.node.h], [44, 44, 73, 38], 'Photoshop drew this stroke inside, as Design does');
    assert.deepEqual(rect.fields, { strokeCap: 'butt', strokeJoin: 'miter', strokeDash: 'dashed', strokeDashArray: '5.88 2.94' });
    assert.equal(live('Ellipse 1').fields!.strokeDash, 'dotted');
  } finally {
    g.document = saved.document;
    g.getComputedStyle = saved.getComputedStyle;
  }
});
