// SPDX-License-Identifier: MPL-2.0
/**
 * A live photo slide in both PowerPoint tiers (plan 291 M4, W7).
 *
 * A photo slide is a picture row (cover fit, sometimes mirrored, sometimes translucent)
 * under a scrim row (a box whose `grad` is a linear spec with translucent stops). Before
 * M4 both tiers left all three out of the .pptx: the deck model (Tier B) emitted nothing
 * for a `grad` box, a flipped picture or a translucent one, and Tier A left each out
 * with a note. So a recreated deck had to flatten photo, grade, mirror and scrim into
 * one JPEG. These cases pin:
 *
 *   - the renderer's deck model carries a linear scrim as `fill: {gradSpec, ...}`, a flat
 *     fill under it as a second rectangle first, and a picture's mirror, opacity, name,
 *     position and framing;
 *   - the node half lowers that to a native gradFill with one alpha per stop, and a
 *     picture to `flipH`/`alphaModFix` with a cover crop from its own pixels;
 *   - Tier A (designFramesToPptx) lowers the same rows the same way;
 *   - the two guards stay mirrored: a row the deck model leaves out, Tier A leaves out,
 *     and the other way round (radial and conic gradients, a turned gradient, a
 *     gradient on text, a translucent gradient over a fill of its own);
 *   - a treated photo (an SVG wrapper drawing a raster through a filter) is baked to one
 *     raster with no svg part.
 *
 * Public: neutral colours only, and pictures made here with packPng.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { packPng } from '../engine/src/png.ts';
import { wrapRasterWithTreatment } from '../engine/src/photo-treatment.ts';
import { buildPptxParts, EMU_PER_PX } from '../engine/src/pptx.ts';
import type { PptxMedia, PptxPic, PptxRect, PptxShape } from '../engine/src/pptx.ts';
import {
  deckCoverSrcRect, deckFill, deckPicLook, deckPlacePicture, deckSvgBakeRaster, deckSyncShape,
  gradSpecFill, isLinearGradSpec,
} from '../packages/node-shell/src/pptx-deck.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';
import type { DesignBoxRowV1 } from '../packages/core/src/index.ts';
import { baseHost } from './helpers/host.ts';

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const tool = await loadTool('design', (path: string) => readFile(join(PACK_DIR, path), 'utf8'));

/** The deck model the Design hook emits for these rows. */
async function deckOf(boxes: unknown[]): Promise<{ slides: Array<{ elements: Array<Record<string, any>> }> }> {
  const rt = await createRuntime(tool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const el = new JSDOM(rt.getHydrated() as string).window.document.querySelector('[data-pptx-deck]');
  assert.ok(el, 'frames present, so a deck model is emitted');
  return JSON.parse(el!.textContent ?? '');
}

const FRAME = { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, order: 0, bg: '#102030' };
/** The same page for Tier A with no fill of its own, so the slide's shapes are the layers' alone. */
const FRAME_A = { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, order: 0 } as DesignBoxRowV1;
const SCRIM = 'lin_90_102030f2-0_102030b3-30_10203000-62';
const SCRIM_UP = 'lin_0_fffffff2-0_ffffffa6-30_ffffff00-62';
const PHOTO_URL = 'https://example.com/photo.png';

function png(width: number, height: number): Uint8Array {
  return packPng(new Uint8Array(width * height * 4).fill(180), { width, height });
}

const slideXml = (shapes: PptxShape[], media: PptxMedia[] = []): string =>
  String(buildPptxParts([{ shapes, media }], { emuW: 1920 * EMU_PER_PX, emuH: 1080 * EMU_PER_PX })['ppt/slides/slide1.xml']);

// ─── the node half: grad specs and pictures ──────────────────────────────────

test('gradSpecFill: a linear scrim keeps three stops with their own alpha; radial and conic give null', () => {
  const fill = gradSpecFill(SCRIM);
  assert.ok(fill && 'grad' in fill, 'a linear spec lowers');
  assert.equal(fill!.angle, 90);
  assert.deepEqual(fill!.grad.map((s) => [s.pos, s.color]), [[0, '102030'], [0.3, '102030'], [0.62, '102030']]);
  assert.ok(Math.abs(fill!.grad[0]!.alpha! - 0xf2 / 255) < 1e-9);
  assert.ok(Math.abs(fill!.grad[1]!.alpha! - 0xb3 / 255) < 1e-9);
  assert.equal(fill!.grad[2]!.alpha, 0, 'the clear end stays clear');
  assert.equal(gradSpecFill('rad_102030-0_ffffff-100'), null);
  assert.equal(gradSpecFill('con_0_102030-0_ffffff-100'), null);
  assert.equal(gradSpecFill('lin_90_nonsense'), null, 'an unreadable spec gives null, not a guess');
  const xml = slideXml([{ kind: 'rect', x: 0, y: 0, cx: 100, cy: 100, fill: fill! }]);
  assert.match(xml, /<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="102030"><a:alpha val="94902"\/><\/a:srgbClr><\/a:gs><a:gs pos="30000"><a:srgbClr val="102030"><a:alpha val="70196"\/><\/a:srgbClr><\/a:gs><a:gs pos="62000"><a:srgbClr val="102030"><a:alpha val="0"\/><\/a:srgbClr><\/a:gs><\/a:gsLst><a:lin ang="0" scaled="1"\/><\/a:gradFill>/);
  const up = slideXml([{ kind: 'rect', x: 0, y: 0, cx: 100, cy: 100, fill: gradSpecFill(SCRIM_UP)! }]);
  assert.match(up, /<a:lin ang="16200000" scaled="1"\/>/, 'CSS 0deg (to top) is DrawingML 270deg');
  assert.match(up, /val="FFFFFF"><a:alpha val="65098"\/>/);
});

test('gradSpecFill: a mirror folds into the angle, opacity into every stop', () => {
  assert.equal((gradSpecFill(SCRIM, { flipH: true }) as { angle: number }).angle, 270, 'flipH: 360 - a');
  assert.equal((gradSpecFill('lin_30_102030-0_ffffff-100', { flipV: true }) as { angle: number }).angle, 150, 'flipV: 180 - a');
  assert.equal((gradSpecFill('lin_30_102030-0_ffffff-100', { flipH: true, flipV: true }) as { angle: number }).angle, 210, 'both: a + 180');
  // An OKLab spec (the default space) is baked to sRGB stops, so the ends are the authored ones.
  const half = gradSpecFill('lin_90_102030-0_ffffff80-100', { opacity: 0.5 }) as { grad: Array<{ alpha?: number }> };
  assert.equal(half.grad[0]!.alpha, 0.5);
  assert.ok(Math.abs(half.grad.at(-1)!.alpha! - (0x80 / 255) * 0.5) < 1e-9);
  assert.equal(isLinearGradSpec('linear.oklab_90_red_blue'), true);
  assert.equal(isLinearGradSpec(' lin_90_red_blue'), true);
  assert.equal(isLinearGradSpec('rad_red_blue'), false);
  assert.equal(isLinearGradSpec(''), false);
});

test('deckFill and deckSyncShape: a {gradSpec} fill is a native gradient rectangle', () => {
  const fill = deckFill({ gradSpec: SCRIM, flipH: true, opacity: 0.5 });
  assert.ok(fill && 'grad' in fill);
  assert.equal(fill!.angle, 270);
  assert.ok(Math.abs(fill!.grad[0]!.alpha! - (0xf2 / 255) * 0.5) < 1e-9);
  assert.equal(deckFill({ gradSpec: 'rad_red_blue' }), undefined, 'a radial spec has no native fill');
  const rect = deckSyncShape({ t: 'rect', x: 0, y: 0, w: 1920, h: 1080, fill: { gradSpec: SCRIM } }) as PptxRect;
  assert.equal(rect.kind, 'rect');
  assert.ok(rect.fill && 'grad' in rect.fill && rect.fill.grad.length === 3);
});

test('deckCoverSrcRect: a 3:2 photo in a 16:9 box is cropped top and bottom, centred', () => {
  const crop = deckCoverSrcRect({}, { w: 1920, h: 1080 }, { width: 2048, height: 1366 });
  assert.ok(crop);
  assert.equal(Math.round(crop!.t * 100000), 7833);
  assert.equal(Math.round(crop!.b * 100000), 7833);
  assert.equal(crop!.l, 0);
  assert.equal(crop!.r, 0);
  const top = deckCoverSrcRect({ imgpos: 'center top' }, { w: 1920, h: 1080 }, { width: 2048, height: 1366 });
  assert.equal(top!.t, 0, 'imgpos top keeps the top edge');
  assert.equal(deckCoverSrcRect({}, { w: 16, h: 9 }, { width: 1600, height: 900 }), null, 'same aspect, nothing cut');
});

test('deckPlacePicture: a contain picture anchored left shows on the right of a mirrored box', () => {
  const box = { x: 1000, y: 0, cx: 4000, cy: 1000 };
  const plain = deckPlacePicture({ imgpos: 'left center' }, box, { w: 100, h: 100, natural: true }, 'contain');
  assert.deepEqual(plain.box, { x: 1000, y: 0, cx: 1000, cy: 1000 });
  const mirrored = deckPlacePicture({ imgpos: 'left center', flipH: '1' }, box, { w: 100, h: 100, natural: true }, 'contain');
  assert.deepEqual(mirrored.box, { x: 4000, y: 0, cx: 1000, cy: 1000 }, 'the canvas mirrors the whole box, so the picture moves to the right');
  const cover = deckPlacePicture({ flipH: true }, box, { w: 300, h: 200, natural: true }, 'cover');
  assert.deepEqual(cover.box, box, 'a cover picture fills its box and does not move');
  assert.ok(cover.srcRect && cover.srcRect.l === 0);
});

test('deckPicLook: name, mirrors and opacity only when stated', () => {
  assert.deepEqual(deckPicLook({}), {});
  assert.deepEqual(deckPicLook({ name: 'Photo', flipH: true, alpha: 0.5 }), { name: 'Photo', flipH: true, alpha: 0.5 });
  assert.deepEqual(deckPicLook({ flipV: '1', opacity: 40 }), { flipV: true, alpha: 0.4 }, 'a row states opacity 0..100');
  assert.deepEqual(deckPicLook({ flipH: '0', opacity: 100, alpha: 1 }), {});
});

test('deckSvgBakeRaster: a treated photo wrapper is baked; a plain vector is not', () => {
  const jpegHref = 'data:image/jpeg;base64,/9j/AAAA';
  const wrapper = new TextEncoder().encode(wrapRasterWithTreatment({ href: jpegHref, width: 2048, height: 1366, treatment: { id: 'grey', kind: 'greyscale' } as never }));
  assert.deepEqual(deckSvgBakeRaster(wrapper), { w: 2048, h: 1366, mime: 'image/jpeg' });
  assert.deepEqual(deckSvgBakeRaster(wrapper, 1024), { w: 1024, h: 683, mime: 'image/jpeg' }, 'the longest side is capped');
  const logo = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
  assert.equal(deckSvgBakeRaster(logo), null);
});

// ─── the deck model the renderer emits (Tier B) ──────────────────────────────

test('deck model: a linear scrim box is a gradient rect, its mirror and opacity carried raw', async () => {
  const deck = await deckOf([
    FRAME,
    { id: 's1', kind: 'box', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, bg: '', grad: SCRIM, name: 'Scrim' },
    { id: 's2', kind: 'box', frame: 'f', x: 0, y: 0, w: 960, h: 1080, bg: '', grad: SCRIM, flipH: '1', opacity: 80 },
  ]);
  const els = deck.slides[0]!.elements;
  assert.equal(els.length, 2);
  assert.deepEqual(els[0]!.fill, { gradSpec: SCRIM });
  assert.deepEqual(els[1]!.fill, { gradSpec: SCRIM, flipH: true, opacity: 0.8 });
  const xml = slideXml([deckSyncShape(els[0]!)!]);
  assert.match(xml, /<a:gs pos="62000"><a:srgbClr val="102030"><a:alpha val="0"\/>/, 'the node half writes the scrim natively');
});

test('deck model: a flat fill under a gradient is a second rectangle, first; the outline rides the top one', async () => {
  const deck = await deckOf([
    FRAME,
    { id: 'b', kind: 'box', frame: 'f', x: 10, y: 20, w: 300, h: 200, bg: '#ffffff', grad: SCRIM, stroke: '#000000', strokeW: 2, shape: 'rounded', radius: 12 },
  ]);
  const els = deck.slides[0]!.elements;
  assert.equal(els.length, 2);
  assert.equal(els[0]!.fill, '#ffffff');
  assert.equal(els[0]!.line, undefined, 'the under rectangle has no outline');
  assert.equal(els[0]!.radius, 12);
  assert.deepEqual(els[1]!.fill, { gradSpec: SCRIM });
  assert.deepEqual(els[1]!.line, { color: '#000000', w: 2 });
  assert.equal(els[1]!.radius, 12);
  assert.deepEqual([els[0]!.x, els[0]!.y, els[0]!.w, els[0]!.h], [els[1]!.x, els[1]!.y, els[1]!.w, els[1]!.h]);
});

test('deck model: a picture carries its mirror, opacity, name, position and framing; a plain one is unchanged', async () => {
  const deck = await deckOf([
    FRAME,
    { id: 'p1', kind: 'image', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, image: { type: 'image', url: PHOTO_URL }, fit: 'cover', flipH: true, opacity: 50, name: 'Photo', imgpos: 'left top' },
    { id: 'p2', kind: 'image', frame: 'f', x: 0, y: 0, w: 100, h: 100, image: { type: 'image', url: PHOTO_URL }, fit: 'cover', imageFraming: { x: 20, y: 30, zoom: 150 }, flipV: '1' },
    { id: 'p3', kind: 'image', frame: 'f', x: 0, y: 0, w: 100, h: 100, image: { type: 'image', url: PHOTO_URL } },
  ]);
  const [a, b, c] = deck.slides[0]!.elements;
  assert.deepEqual(a, { t: 'image', x: 0, y: 0, w: 1920, h: 1080, src: PHOTO_URL, fit: 'cover', name: 'Photo', imgpos: 'left top', flipH: true, alpha: 0.5 });
  assert.deepEqual(b!.imageFraming, { x: 20, y: 30, zoom: 150 });
  assert.equal(b!.flipV, true);
  assert.deepEqual(c, { t: 'image', x: 0, y: 0, w: 100, h: 100, src: PHOTO_URL, fit: 'contain' }, 'nothing stated, nothing new carried');
});

// ─── Tier A lowers the same rows the same way ────────────────────────────────

test('Tier A: the photo slide lowers to a mirrored, cropped picture under a native scrim', async () => {
  const bytes = png(300, 200);
  const out = await designFramesToPptx({
    frames: [{
      row: FRAME_A,
      layers: [
        { id: 'photo', kind: 'image', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, image: 'user/media/abc', fit: 'cover', flipH: true, name: 'Photo', opacity: 90 },
        { id: 'scrim', kind: 'box', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, bg: '', grad: SCRIM, name: 'Scrim' },
      ],
    }],
    resolveAsset: async (ref) => (ref === 'user/media/abc' ? { bytes, mime: 'image/png' } : null),
  });
  assert.deepEqual(out.notes, [], 'nothing is left out');
  const pic = out.slides[0]!.shapes.find((s) => s.kind === 'pic') as PptxPic;
  const scrim = out.slides[0]!.shapes.find((s) => s.kind === 'rect') as PptxRect;
  assert.ok(pic && scrim);
  assert.equal(out.slides[0]!.shapes.indexOf(pic) < out.slides[0]!.shapes.indexOf(scrim), true, 'the photo is under the scrim');
  assert.equal(pic.flipH, true);
  assert.equal(pic.alpha, 0.9);
  assert.equal(pic.name, 'Photo');
  const crop = 1 - (3 / 2) / (16 / 9);
  assert.ok(Math.abs((pic.srcRect?.t ?? 0) - crop / 2) < 1e-9 && Math.abs((pic.srcRect?.b ?? 0) - crop / 2) < 1e-9);
  const xml = slideXml(out.slides[0]!.shapes, out.slides[0]!.media);
  assert.match(xml, /<a:blip r:embed="rId2"><a:alphaModFix amt="90000"\/><\/a:blip><a:srcRect l="0" t="7813" r="0" b="7813"\/>/);
  assert.match(xml, /<a:xfrm flipH="1">/);
  assert.match(xml, /<a:gs pos="30000"><a:srgbClr val="102030"><a:alpha val="70196"\/>/);
});

test('Tier A: a fill under a gradient is two rectangles; a translucent gradient folds into its stops', async () => {
  const out = await designFramesToPptx({
    frames: [{
      row: FRAME_A,
      layers: [
        { id: 'b', kind: 'box', frame: 'f', x: 0, y: 0, w: 100, h: 100, bg: '#ffffff', grad: SCRIM, stroke: '#000000', strokeW: 2 },
        { id: 'c', kind: 'box', frame: 'f', x: 200, y: 0, w: 100, h: 100, grad: 'lin_90_102030-0_ffffff-100', opacity: 50, flipV: true },
      ],
    }],
  });
  const rects = out.slides[0]!.shapes.filter((s) => s.kind === 'rect') as PptxRect[];
  assert.equal(rects.length, 3);
  assert.deepEqual(rects[0]!.fill, { solid: 'FFFFFF' });
  assert.equal(rects[0]!.line, undefined);
  assert.ok(rects[1]!.fill && 'grad' in rects[1]!.fill && rects[1]!.line, 'the gradient on top carries the outline');
  const folded = rects[2]!.fill as { grad: Array<{ alpha?: number }>; angle: number };
  assert.ok(folded.grad.every((s) => s.alpha === 0.5), 'every stop at half');
  assert.equal(folded.angle, 90, 'flipV maps 90 to 180 - 90');
});

test('Tier A: a treated photo travels as one baked raster with no svg part', async () => {
  const wrapper = new TextEncoder().encode(wrapRasterWithTreatment({ href: 'data:image/png;base64,iVBORw0KGgo=', width: 300, height: 200, treatment: { id: 'grey', kind: 'greyscale' } as never }));
  const asked: Array<[number, number]> = [];
  const out = await designFramesToPptx({
    frames: [{ row: FRAME_A, layers: [{ id: 'p', kind: 'image', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, image: 'lolly/photo?treatment=grey', fit: 'cover' }] }],
    resolveAsset: async () => ({ bytes: wrapper, mime: 'image/svg+xml' }),
    rasterizeSvg: async (_b, w, h) => { asked.push([w, h]); return png(w, h); },
  });
  const pic = out.slides[0]!.shapes.find((s) => s.kind === 'pic') as PptxPic;
  assert.ok(pic, `the picture reached the slide: ${out.notes}`);
  assert.equal(pic.svg, undefined, 'no svgBlip');
  assert.deepEqual(asked, [[300, 200]], 'baked once, at the photo\'s own size');
  assert.ok((pic.srcRect?.t ?? 0) > 0, 'and still cropped for cover');
});

test('Tier A: a cover SVG picture\'s PNG fallback keeps the vector\'s aspect, so one crop fits both blips', async () => {
  // A 2:1 vector in a square box. The fallback used to be drawn at the box's shape,
  // which the rasteriser letterboxes, and the vector's crop then cut it again, so a
  // viewer reading the PNG blip showed the picture as a band between blank strips.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><rect width="200" height="100" fill="#888"/></svg>');
  const run = async (extra: Record<string, unknown>): Promise<{ pic: PptxPic; asked: Array<[number, number]> }> => {
    const asked: Array<[number, number]> = [];
    const out = await designFramesToPptx({
      frames: [{ row: FRAME_A, layers: [{ id: 'p', kind: 'image', frame: 'f', x: 0, y: 0, w: 400, h: 400, image: 'lolly/vector', fit: 'cover', ...extra } as DesignBoxRowV1] }],
      resolveAsset: async () => ({ bytes: svg, mime: 'image/svg+xml' }),
      rasterizeSvg: async (_b, w, h) => { asked.push([w, h]); return png(w, h); },
    });
    const pic = out.slides[0]!.shapes.find((s) => s.kind === 'pic') as PptxPic;
    assert.ok(pic, `the picture reached the slide: ${out.notes}`);
    return { pic, asked };
  };
  const plain = await run({});
  assert.ok(plain.pic.svg !== undefined, 'the vector travels as an svgBlip');
  assert.deepEqual(plain.asked, [[1600, 800]], 'the fallback is drawn at the picture\'s own 2:1 aspect, twice the size it covers');
  assert.deepEqual(plain.pic.srcRect, { l: 0.25, t: 0, r: 0.25, b: 0 }, 'the same crop cuts the same content from both blips');
  const zoomed = await run({ imageFraming: { x: 50, y: 50, zoom: 150 } });
  const [w, h] = zoomed.asked[0]!;
  assert.equal(w / h, 2, 'a framing zoom keeps the aspect');
  assert.equal(w, 2400, 'and draws the fallback at the zoomed size');
});

// ─── the guards stay mirrored, both ways ─────────────────────────────────────

test('mirror: a row the deck model leaves out, Tier A leaves out, and the other way round', async () => {
  const pic = { type: 'image', url: PHOTO_URL };
  const cases: Array<{ row: Record<string, unknown>; native: boolean; why: string }> = [
    { row: { kind: 'box', bg: '', grad: SCRIM }, native: true, why: 'a linear scrim' },
    { row: { kind: 'box', bg: '', grad: 'linear.oklab_45_102030_ffffff' }, native: true, why: 'a linear spec in another space' },
    { row: { kind: 'box', bg: '#ffffff', grad: SCRIM }, native: true, why: 'a fill under a gradient' },
    { row: { kind: 'box', bg: '', grad: SCRIM, opacity: 50 }, native: true, why: 'a translucent gradient with no fill' },
    { row: { kind: 'box', bg: '#ffffff', grad: SCRIM, opacity: 50 }, native: false, why: 'a translucent gradient over a fill' },
    { row: { kind: 'box', bg: '', grad: SCRIM, flipH: '1' }, native: true, why: 'a mirrored gradient' },
    { row: { kind: 'box', bg: '', grad: SCRIM, rot: 15 }, native: false, why: 'a turned gradient' },
    { row: { kind: 'box', bg: '', grad: 'rad_102030-0_ffffff-100' }, native: false, why: 'a radial gradient' },
    { row: { kind: 'box', bg: '', grad: 'con_0_102030-0_ffffff-100' }, native: false, why: 'a conic gradient' },
    { row: { kind: 'text', text: 'Hi', grad: SCRIM }, native: false, why: 'a gradient on text' },
    { row: { kind: 'image', image: pic, grad: SCRIM }, native: false, why: 'a gradient on a picture' },
    { row: { kind: 'image', image: pic, flipH: true }, native: true, why: 'a mirrored picture' },
    { row: { kind: 'image', image: pic, flipV: '1' }, native: true, why: 'a picture mirrored top to bottom' },
    { row: { kind: 'image', image: pic, opacity: 40 }, native: true, why: 'a translucent picture' },
    { row: { kind: 'image', image: pic, rot: 10 }, native: false, why: 'a turned picture' },
    { row: { kind: 'text', text: 'Hi', flipH: true }, native: false, why: 'mirrored text' },
  ];
  const bytes = png(40, 20);
  for (const { row, native, why } of cases) {
    const full = { id: 'x', frame: 'f', x: 10, y: 10, w: 200, h: 100, ...row };
    const deck = await deckOf([FRAME, full]);
    const tierB = deck.slides[0]!.elements.length > 0;
    const out = await designFramesToPptx({
      frames: [{ row: FRAME_A, layers: [{ ...full, ...(row.kind === 'image' ? { image: 'user/media/x' } : {}) } as DesignBoxRowV1] }],
      resolveAsset: async () => ({ bytes, mime: 'image/png' }),
    });
    const tierA = out.slides[0]!.shapes.length > 0;
    assert.equal(tierB, native, `deck model, ${why}`);
    assert.equal(tierA, native, `Tier A, ${why}: ${out.notes}`);
  }
});
