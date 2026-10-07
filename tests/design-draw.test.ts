// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CompiledFrameV1, DesignBoxRowV1 } from '@lolly-tools/core';
import { DESIGN_DRAW_VERSION, compileDesignDraw, compileDesignRow, describeDesignDrawPictures, designDrawFindings, layoutDesignDrawText, outlineDesignDrawText, pictureRect, type DrawPicture, type DrawShapeOp, type DrawTextToPath } from '../engine/src/design-draw.ts';
import { designDrawSvg } from '../engine/src/design-draw-svg.ts';
import { drawDesignText, measureDesignText, type TextShaperV1 } from '../engine/src/design-text-measure.ts';
import { framePreviewSvg } from '../engine/src/frame-preview-svg.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';

const triangle = encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [{ x: 0, y: 1 }, { x: 0.5, y: 0 }, { x: 1, y: 1 }] }] as never) ?? '';

/** One static page: a frame and a row of each kind version 0 draws, plus features it reports. */
function page(): DesignBoxRowV1[] {
  return [
    { id: 'f', kind: 'frame', x: 100, y: 50, w: 800, h: 600, bg: '#fafafa' },
    { id: 'rect', kind: 'box', x: 110, y: 60, w: 100, h: 40, bg: '#ff0000', stroke: '#000000', strokeW: 2, strokeDash: 'dashed' },
    { id: 'pill', kind: 'box', x: 110, y: 120, w: 100, h: 40, shape: 'pill', bg: '#00ff00' },
    { id: 'circle', kind: 'box', x: 300, y: 60, w: 80, h: 80, shape: 'circle', grad: 'lin.srgb_90_ff0000-0_0000ff-100', bg: '#ffffff' },
    { id: 'tri', kind: 'path', x: 400, y: 60, w: 100, h: 100, path: triangle, bg: '#222222', stroke: '#0000ff', strokeW: 3, rot: 30, flipH: true },
    { id: 'pic', kind: 'image', x: 520, y: 60, w: 160, h: 90, image: 'lolly/logo/primary', fit: 'cover', imgpos: '20% 30%' },
    { id: 'words', kind: 'text', x: 110, y: 200, w: 400, h: 120, text: 'Hello <world> & **bold**', fontSize: 24, font: 'display', fg: '#333333', opacity: 50, lineHeight: '1.4' },
    { id: 'gone', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: '#000000', hidden: true },
    { id: 'fx', kind: 'box', x: 600, y: 300, w: 50, h: 50, bg: '#123456', clip: 'pill', blend: 'multiply', shadow: 'soft', blur: 4, rx: 10, headEnd: 'arrow' },
  ];
}
const href = (ref: string) => `/assets/${ref}`;
const emit = { assetHref: href, family: (font: string) => font || 'system-ui', mono: 'monospace', title: 'Page' };

test('a static page compiles to versioned operations in page coordinates, in paint order, with its frame apart and without hidden rows', () => {
  const rows = page(), before = structuredClone(rows);
  const draw = compileDesignDraw(rows, { width: 800, height: 600 });
  assert.equal(draw.version, DESIGN_DRAW_VERSION);
  assert.equal(draw.background, '#fafafa');
  assert.deepEqual(draw.ops.map(op => `${op.op}:${op.id}`), ['shape:rect', 'shape:pill', 'shape:circle', 'shape:tri', 'shape:pic', 'shape:words', 'shape:fx'], 'in Design a text or picture row is a box that carries words or a picture');
  assert.deepEqual([draw.frame?.id, draw.frame?.box, draw.frame?.fills], ['f', { x: 0, y: 0, w: 800, h: 600 }, [{ kind: 'color', color: '#fafafa' }]], 'the frame paints the page');
  assert.equal(draw.clip, undefined, 'a square, borderless frame clips at the page edge alone');
  assert.deepEqual(draw.ops[0]!.box, { x: 10, y: 10, w: 100, h: 40 });
  assert.deepEqual(rows, before, 'compiling never mutates the authored rows');
  assert.deepEqual(compileDesignDraw(rows, { width: 800, height: 600 }), draw, 'the same rows compile to the same operations');
});

test('shapes, paints, strokes and poses carry Design semantics', () => {
  const draw = compileDesignDraw(page(), { width: 800, height: 600 });
  const [rect, pill, circle, tri] = draw.ops as DrawShapeOp[];
  assert.deepEqual(rect!.stroke, { color: '#000000', width: 2, dash: [6, 4], align: 'inside' }, 'Design draws a box outline as a border inside the box');
  assert.deepEqual(pill!.shape, { kind: 'rect', radius: 20 });
  assert.deepEqual(circle!.shape, { kind: 'ellipse' });
  assert.deepEqual(circle!.fills.map(fill => fill.kind), ['color', 'linear'], 'Design paints bg under the gradient');
  assert.equal(tri!.shape.kind, 'path');
  assert.ok(tri!.shape.kind === 'path' && tri!.shape.contours.length === 1 && tri!.shape.contours[0]!.closed);
  assert.deepEqual(tri!.stroke, { color: '#0000ff', width: 3, cap: 'round', join: 'round' });
  assert.deepEqual(tri!.pose, { rot: 30, flipH: true, flipV: false });
  const words = draw.ops[5]!;
  assert.equal(words.opacity, 50);
  assert.deepEqual(words.words, { spec: { text: 'Hello <world> & **bold**', width: 400, height: 120, font: 'display', size: 24, lineHeight: 1.4, valign: 'middle' }, align: 'center', ink: '#333333' },
    'the measure spec the shared row rule writes, Design\'s centred alignment and the row ink');
});

test('every feature version 0 does not draw is reported against its row, never dropped silently', () => {
  const draw = compileDesignDraw(page(), { width: 800, height: 600 });
  const by = (id: string) => draw.findings.filter(f => f.id === id).map(f => f.feature);
  assert.deepEqual(by('fx'), ['clip', 'blend', 'shadow', 'blur', 'tilt', 'arrowheads']);
  assert.deepEqual(by('words'), [], 'the measure lays out line height and tracking itself');
  assert.deepEqual(by('pic'), [], 'a picture\'s fit and position are drawn');
  assert.deepEqual(compileDesignDraw(page(), { width: 800, height: 600 }, { semantics: 'preview' }).findings.filter(f => f.id === 'pic').map(f => f.feature), ['image-position'], 'the preview still draws a picture centred');
  assert.deepEqual(by('rect'), ['border-style'], 'a dashed CSS border spaces its marks to fit; the SVG dash does not');
  assert.deepEqual(by('gone'), [], 'a hidden row draws nothing and reports nothing');
  assert.deepEqual(designDrawFindings({ id: 'c', kind: 'box', grad: 'con_0_ff0000-0_0000ff-100' }), ['conic-gradient']);
  assert.deepEqual(designDrawFindings({ id: 'v', kind: 'web' }), ['non-static-kind']);
});

test('the page emitter escapes document text and draws the same markup the preview draws from the same rows', () => {
  const rows = page().filter(row => row.id !== 'fx');
  const svg = designDrawSvg(compileDesignDraw(rows, { width: 800, height: 600 }, { semantics: 'preview' }), emit);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="800" height="600"/);
  assert.ok(svg.includes('Hello &lt;world&gt; &amp; '), 'row text is escaped');
  assert.ok(!svg.includes('<world>'));
  assert.ok(svg.includes('href="/assets/lolly/logo/primary" preserveAspectRatio="xMidYMid slice"'));
  const frame = { id: 'f', name: 'Page', width: 800, height: 600, layers: rows, placeholderLayerIds: [] } as unknown as CompiledFrameV1;
  assert.equal(svg, framePreviewSvg(frame, { assetHref: href, fonts: { brand: 'system-ui', mono: 'monospace', sans: 'system-ui', display: 'display' } }));
});

test('a thumbnail compile leaves out contours under a pixel both ways', () => {
  const row = { id: 'tiny', kind: 'path', x: 0, y: 0, w: 4, h: 4, path: triangle, bg: '#000000' };
  const full = compileDesignRow(row, { x: 0, y: 0 }) as DrawShapeOp;
  const thumb = compileDesignRow(row, { x: 0, y: 0 }, { thumbScale: 0.1 }) as DrawShapeOp;
  assert.ok(full.shape.kind === 'path' && full.shape.contours.length === 1);
  assert.ok(thumb.shape.kind === 'path' && thumb.shape.contours.length === 0);
});

test('Design semantics: whole-pixel boxes, radius only where Design rounds, and outlines inside the box', () => {
  const row = (extra: Record<string, unknown>) => compileDesignRow({ id: 'r', kind: 'box', x: 10.4, y: 20.6, w: 100.5, h: 0.2, bg: '#000000', ...extra }, { x: 0, y: 0 }) as DrawShapeOp;
  assert.deepEqual(row({}).box, { x: 10, y: 21, w: 101, h: 1 });
  assert.deepEqual(row({ radius: 12, h: 60 }).shape, { kind: 'rect', radius: 0 }, 'a plain rectangle ignores its radius');
  assert.deepEqual(row({ shape: 'rounded', radius: 400, h: 60 }).shape, { kind: 'rect', radius: 30 }, 'CSS shrinks a radius that does not fit');
  assert.equal(row({ opacity: '40%' }).opacity, 40, 'opacity reads as CSS parseFloat');
  assert.equal(row({ flipH: 'yes', h: 60 }).pose?.flipH, true);
  const preview = compileDesignRow({ id: 'r', kind: 'box', x: 10.4, y: 0, w: 50, h: 50, radius: 8, stroke: '#000', strokeW: 2 }, { x: 0, y: 0 }, { semantics: 'preview' }) as DrawShapeOp;
  assert.deepEqual([preview.box.x, preview.shape, preview.stroke?.align], [10.4, { kind: 'rect', radius: 8 }, undefined], 'the preview keeps its own approximations');
});

test('effects compile to clip polygons, blends, shadows and blur, and leave the findings', () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { id: 'mask', kind: 'box', x: 10, y: 10, w: 100, h: 100, shape: 'circle', bg: '#cccccc' },
    { id: 'a', kind: 'box', x: 0, y: 0, w: 200, h: 100, bg: '#ff0000', clip: 'mask', blend: 'multiply', shadow: 'box', shadowX: 4, shadowY: 6, blur: 3 },
    { id: 'b', kind: 'box', x: 0, y: 150, w: 50, h: 50, bg: '#00ff00', shadow: 'depth', z: 40, blend: 'nonsense' },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 }, { effects: true, colors: 'resolved' });
  const [, a, b] = draw.ops;
  assert.equal(a!.clip?.points.length, 48, 'an ellipse mask is the renderer\'s 48-point polygon');
  assert.equal(a!.blend, 'multiply');
  assert.deepEqual(a!.shadow, { target: 'box', dx: 4, dy: 6, blur: 10, color: '#000000', opacity: 0x55 / 255 });
  assert.equal(a!.blur, 3);
  assert.deepEqual(b!.shadow, { target: 'content', dx: 0, dy: 6, blur: 18, color: '#000000', opacity: 0x55 / 255 }, 'a depth shadow derives from z');
  assert.equal(b!.blend, undefined, 'an unknown blend keyword is ignored, as the renderer ignores it');
  assert.deepEqual(draw.findings, []);
  const svg = designDrawSvg(draw, emit);
  assert.ok(svg.includes('mix-blend-mode:multiply') && svg.includes('<clipPath') && svg.includes('<feDropShadow') && svg.includes('<feGaussianBlur'));
});

/** A shaper with fixed advances: half the size per character, a quarter for a space. */
const shaper: TextShaperV1 = async (run) => {
  const advances = [...run.text].map((ch) => (ch === ' ' ? run.size / 4 : run.size / 2) + run.tracking);
  return { advances, total: advances.reduce((a, b) => a + b, 0), font: { file: `/fonts/${run.family}.ttf`, variations: { wght: run.weight }, metrics: { upem: 1000, ascent: 980, descent: 280 } } };
};

test('text lays out from the measure: runs in their faces and paint, aligned inside the pad, the block placed by valign', async () => {
  const spec = { text: 'ab **cd** {#ff0000 u|ef}\nnext line', width: 300, height: 200, size: 20 };
  const left = await drawDesignText({ ...spec, valign: 'top' }, shaper, { align: 'left' });
  assert.deepEqual(left.measure, await measureDesignText({ ...spec, valign: 'top' }, shaper), 'the layout carries the measure it came from');
  assert.deepEqual(left.lines[0]!.runs.map((r) => [r.text, r.x, r.width, r.face.weight, r.color ?? '', r.underline ?? false]),
    [['ab ', 0, 25, 700, '', false], ['cd', 25, 20, 900, '', false], [' ', 45, 5, 700, '', false], ['ef', 50, 20, 700, '#ff0000', true]]);
  assert.deepEqual(left.lines.map((l) => [l.baseline, l.x, l.width]), [[26, 8, 70], [48.39, 8, 85]], 'lines start at the pad, a line box (size x 1.12) apart');
  const x = async (align: string) => (await drawDesignText(spec, shaper, { align })).lines[0]!.x;
  assert.deepEqual([await x('center'), await x('right'), await x('justify'), await x('')], [115, 222, 115, 115], 'the free width of the 284 px text area goes before the line; the renderer centres anything else');
  const baseline = async (valign: 'middle' | 'bottom') => (await drawDesignText({ ...spec, valign }, shaper)).lines[0]!.baseline;
  assert.deepEqual([await baseline('middle'), await baseline('bottom')], [95.61, 165.22], 'the block moves by half, then all, of the room the 60.78 px of text leaves');
  const bordered = await drawDesignText({ ...spec, valign: 'top', strokeW: 6 }, shaper, { align: 'left' });
  assert.deepEqual([bordered.lines[0]!.baseline, bordered.lines[0]!.x], [32, 14], 'a border inside the box moves the text in by its width');
});

test('outlines replace runs with the host\'s glyph paths, and what cannot be outlined stays text and is reported', async () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300 },
    { id: 'words', kind: 'text', x: 10, y: 10, w: 300, h: 100, text: 'ab **cd** {u|ef} boom', fontSize: 20, align: 'left', valign: 'top' },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 });
  await layoutDesignDrawText(draw, shaper);
  const calls: Array<Parameters<DrawTextToPath>[0]> = [];
  await outlineDesignDrawText(draw, async (opts) => {
    calls.push(opts);
    if (opts.text.includes('boom')) throw new Error('no glyphs');
    return { d: `M0 0H${opts.text.length}` };
  });
  const words = draw.ops[0]!.words!;
  assert.deepEqual(words.layout!.lines[0]!.runs.map((r) => r.text), ['ab ', 'cd', ' ', 'ef', ' boom']);
  assert.deepEqual(words.outlines, [['M0 0H3', 'M0 0H2', '', 'M0 0H2', null]], 'a space run outlines to nothing; a failed run stays text');
  assert.deepEqual(calls[1], { text: 'cd', fontUrl: '/fonts/SUSE.ttf', fontSize: 20, variations: ['wght=900'] }, 'each run is outlined in the face file and axes the measure chose');
  assert.deepEqual(draw.findings.map((f) => f.feature), ['text-decoration', 'text-unoutlined']);
  const svg = designDrawSvg(draw, emit);
  assert.ok(svg.includes('<path transform="translate(18 36)" d="M0 0H3"'), 'an outline sits at the run\'s start on the baseline');
  assert.ok(svg.includes('> boom</tspan>') && !svg.includes('>ab </tspan>'), 'only the run that failed is drawn as text');
});

test('a picture reads its fit, keyword or framing, and is clipped inside the border at the inner radius', () => {
  const pic = (extra: Record<string, unknown>) => (compileDesignRow({ id: 'p', kind: 'image', x: 0, y: 0, w: 200, h: 100, image: 'a/b', ...extra }, { x: 0, y: 0 }) as DrawShapeOp).picture!;
  assert.deepEqual([pic({}).fit, pic({ fit: 'stretch' }).fit, pic({ fit: 'scale-down' }).fit], ['contain', 'contain', 'scale-down'], 'the renderer reads an unknown fit as contain');
  assert.deepEqual([pic({ imgpos: 'right bottom' }).x, pic({ imgpos: 'right bottom' }).y, pic({ imgpos: 'top' }).x, pic({ imgpos: 'top' }).y, pic({ imgpos: 'middle' }).x], [100, 100, 50, 0, 50]);
  const framed = pic({ imgpos: 'left top', imageFraming: { x: 130, y: '20', zoom: 50 } });
  assert.deepEqual([framed.x, framed.y, framed.zoom], [100, 20, 0.5], 'framing wins over imgpos and clamps its anchor; a zoom under 100 zooms out');
  assert.deepEqual(framed.element.box, { x: 100, y: 10, w: 100, h: 50 }, 'zoomed out, the element is smaller than the box and clips the picture itself');
  const bordered = pic({ shape: 'rounded', radius: 20, stroke: '#000000', strokeW: 6 });
  assert.deepEqual([bordered.area, bordered.clip], [{ x: 6, y: 6, w: 188, h: 88 }, { box: { x: 6, y: 6, w: 188, h: 88 }, shape: { kind: 'rect', radius: 14 } }]);
  assert.deepEqual(pic({ shape: 'circle' }).clip?.shape, { kind: 'ellipse' });
  // `imageFraming` is a vector input, an object on the row, which the scalar row type leaves out.
  const onPath = (compileDesignRow({ id: 'p', kind: 'path', x: 0, y: 0, w: 100, h: 100, path: triangle, image: 'a/b', imageFraming: { x: 0, y: 0, zoom: 200 } } as never, { x: 0, y: 0 }) as DrawShapeOp).picture!;
  assert.deepEqual([onPath.clip, onPath.element.box], [undefined, { x: 0, y: 0, w: 200, h: 200 }], 'a path box does not clip, so the picture is clipped by its own zoomed element alone');
  assert.equal(compileDesignRow({ id: 'w', kind: 'web', x: 0, y: 0, w: 10, h: 10, image: 'a/b' }, { x: 0, y: 0 }).picture, undefined, 'a web box draws its own marker');
  assert.equal(compileDesignRow({ id: 'p', kind: 'image', x: 0, y: 0, w: 10, h: 10, image: 'a/b' }, { x: 0, y: 0 }, { semantics: 'preview' }).op, 'image', 'the preview keeps its picture operation');
});

test('a picture is placed as CSS object-fit and object-position place it, snapped to whole pixels, then zoomed about its anchor', () => {
  const at = (fit: DrawPicture['fit'], natural: { width: number; height: number }, x = 50, y = 50, zoom = 1): number[] => {
    const r = pictureRect({ ref: '', fit, x, y, zoom, area: { x: 10, y: 20, w: 140, h: 100 }, element: { box: { x: 0, y: 0, w: 0, h: 0 }, shape: { kind: 'ellipse' } }, label: '' }, natural);
    return [r.x, r.y, r.w, r.h];
  };
  assert.deepEqual(at('contain', { width: 120, height: 80 }), [10, 23, 140, 94], 'contain is 140 x 93.33 at y 23.33, drawn from row 23 to row 117');
  assert.deepEqual(at('cover', { width: 120, height: 80 }, 0, 0), [10, 20, 150, 100]);
  assert.deepEqual(at('fill', { width: 120, height: 80 }), [10, 20, 140, 100]);
  assert.deepEqual(at('none', { width: 160, height: 80 }, 100, 100), [-10, 40, 160, 80], 'none keeps the picture\'s own size and shares the room by the anchor');
  assert.deepEqual(at('scale-down', { width: 60, height: 60 }), [50, 40, 60, 60], 'scale-down never enlarges');
  assert.deepEqual(at('scale-down', { width: 280, height: 100 }), [10, 45, 140, 50]);
  assert.deepEqual(at('cover', { width: 140, height: 100 }, 30, 70, 1.5), [-11, -15, 210, 150], 'the zoom scales about the anchor at 30% across and 70% down');
});

test('the host describes pictures: their size, motion that is reported and not drawn, and sound that leaves no mark', async () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 300, image: 'clip.mp4' },
    { id: 'still', kind: 'image', x: 0, y: 0, w: 100, h: 100, image: 'still' },
    { id: 'anim', kind: 'image', x: 0, y: 0, w: 100, h: 100, image: 'anim', bg: '#ff0000' },
    { id: 'sound', kind: 'box', x: 0, y: 0, w: 100, h: 100, image: 'sound', bg: '#ff0000', text: 'gone' },
    { id: 'lost', kind: 'image', x: 0, y: 0, w: 100, h: 100, image: 'lost', imageFraming: { x: 20, y: 50, zoom: 100 } },
    { id: 'lost-centred', kind: 'image', x: 0, y: 0, w: 100, h: 100, image: 'lost' },
  ];
  const draw = compileDesignDraw(rows as never, { width: 400, height: 300 });
  const known: Record<string, { width: number; height: number; media?: 'still' | 'motion' | 'audio' }> = { still: { width: 40, height: 20 }, anim: { width: 10, height: 10, media: 'motion' }, sound: { width: 0, height: 0, media: 'audio' }, 'clip.mp4': { width: 10, height: 10, media: 'motion' } };
  await describeDesignDrawPictures(draw, async (ref) => known[ref] ?? null);
  assert.deepEqual(draw.ops.map((op) => op.id), ['still', 'anim', 'lost', 'lost-centred'], 'a box whose asset is sound draws nothing at all');
  assert.deepEqual(draw.ops[0]!.picture?.natural, { width: 40, height: 20 });
  assert.equal(draw.ops[1]!.picture, undefined);
  assert.equal(draw.frame?.picture, undefined);
  assert.deepEqual(draw.findings, [{ id: 'f', feature: 'image-motion' }, { id: 'anim', feature: 'image-motion' }, { id: 'lost', feature: 'image-unsized' }], 'a centred contain places the same without its size');
});

test('the frame paints the page and clips its rows inside its border, as the board does in Design', () => {
  const board = (extra: Record<string, unknown>) => compileDesignDraw([{ id: 'f', kind: 'frame', x: 50, y: 50, w: 400, h: 300, ...extra }, { id: 'r', kind: 'box', x: 60, y: 60, w: 10, h: 10, bg: '#000000', frame: 'f' }] as never, { width: 400, height: 300 });
  const plain = board({});
  assert.deepEqual([plain.frame?.fills, plain.clip, plain.findings], [[{ kind: 'color', color: '#ffffff' }], undefined, []], 'a frame with no fill is white');
  const rich = board({ bg: '#111111', grad: 'lin.srgb_90_ff0000-0_0000ff-100', stroke: '#00ff00', strokeW: 10, shape: 'rounded', radius: 40, image: 'a/b' });
  assert.equal(rich.frame?.fills.length, 2);
  assert.deepEqual(rich.frame?.stroke, { color: '#00ff00', width: 10, align: 'inside' });
  assert.deepEqual(rich.clip, { box: { x: 10, y: 10, w: 380, h: 280 }, shape: { kind: 'rect', radius: 30 } }, 'rows are clipped at the inner radius');
  assert.deepEqual([rich.frame?.picture?.element, rich.frame?.picture?.clip], [{ box: { x: 10, y: 10, w: 380, h: 280 }, shape: { kind: 'rect', radius: 40 } }, rich.clip], 'the board picture is rounded by the frame\'s own radius and clipped with the rows');
  assert.deepEqual(rich.ops.map((op) => op.box), [{ x: 10, y: 10, w: 10, h: 10 }], 'rows stay at their model position inside the border');
  assert.equal(board({ stroke: '#00ff00', strokeW: 10, clipChildren: 'no' }).clip, undefined);
  assert.deepEqual(board({ opacity: 50, shadow: 'box' }).findings, [{ id: 'f', feature: 'frame-paint' }], 'opacity, blend and shadow composite the page onto what is under it');
  const svg = designDrawSvg(rich, emit);
  assert.ok(svg.indexOf('stroke="#00ff00"') < svg.indexOf('fill="#000000"/></g>') && /<g clip-path="url\(#pc[a-z0-9]+\)"><rect x="10" y="10" width="10" height="10" fill="#000000"\/><\/g>/.test(svg), 'the frame draws first and the rows inside its clip');
});
