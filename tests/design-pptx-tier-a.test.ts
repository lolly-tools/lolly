// SPDX-License-Identifier: MPL-2.0
/**
 * Tier A PowerPoint for composed slides (plan 291 M3). `lolly compose` seeds frames from
 * a slide master, drops the slots it has nothing for, and binds every frame, so the
 * native lowering in packages/node-shell/src/design-pptx.ts has to hold up for:
 *
 *   - B1: a slot dropped before a later slot of the same role. `body-2` with no `body`
 *     still binds to the second body placeholder, by the slot its id names
 *     (`slotOrdinalOf` in engine/src/slide-master.ts), the rule Reset Slide relays by.
 *   - B2: synthetic `flow-cards|columns-N-C` archetypes, expanded on demand, keep a
 *     layout and placeholders rather than lowering unbound.
 *   - A cover picture whose aspect differs from its box is cropped with `a:srcRect`, the
 *     way the canvas crops it, instead of being squashed into the box.
 *   - B5: a frame bound to the engine's neutral master exports Tier A under a profile
 *     whose catalog does not carry that master, and the export notes report the fallback.
 *
 * Public: every frame is seeded from the engine's neutral master, the same geometry and
 * archetype ids the starter brand ships. The one SUSE-profile run is gated on the
 * private brand being checked out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

import { packPng } from '../engine/src/png.ts';
import { buildPptxParts, type PptxPic, type PptxText } from '../engine/src/pptx.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { seedFrame, slotOrdinalOf } from '../engine/src/slide-master.ts';
import { designFramesToPptx, slideMasterForExport } from '../packages/node-shell/src/design-pptx.ts';
import type { DesignBoxRowV1, SlideMasterV1 } from '../packages/core/src/index.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUSE_PRESENT = existsSync(join(REPO, 'brands', 'suse', 'pack.json'));
const master: SlideMasterV1 = neutralSlideMaster();

const TOKENS: Record<string, string> = {
  'color.semantic.text': '#11141f',
  'color.semantic.surface': '#ffffff',
  'color.semantic.muted': '#6b7280',
  'color.semantic.primary': '#30ba78',
};
const tokens = (path: string): string | undefined => TOKENS[path];

type Frame = { row: DesignBoxRowV1; layers: DesignBoxRowV1[] };

function seeded(archetype: string, frameId = 'f1'): Frame {
  const s = seedFrame(master, archetype, { frameId, x: 0, y: 0, resolveToken: tokens });
  assert.ok(s, `the neutral master seeds ${archetype}`);
  return { row: s!.frame, layers: s!.layers };
}

const textOf = (shape: PptxText): string => shape.paras.map((p) => p.runs.map((r) => r.text).join('')).join('\n');

/** A solid PNG of the given pixel size, so the lowering reads a real header. */
function png(width: number, height: number): Uint8Array {
  return packPng(new Uint8Array(width * height * 4).fill(200), { width, height });
}

// ─── B1: a dropped slot does not move the next one up ────────────────────────

test('B1: body-2 with body dropped binds to the second body placeholder, not the first', async () => {
  const frame = seeded('two-column');
  const second = frame.layers.find((l) => l.id === 'f1.body-2');
  assert.ok(second, 'two-column seeds f1.body and f1.body-2');
  // What compose does with an unfilled slot: the row is dropped, the next one stays.
  frame.layers = frame.layers.filter((l) => l.id !== 'f1.body');
  second!.text = 'right column';
  const title = frame.layers.find((l) => l.role === 'title')!;
  title.text = 'Two sides';

  const out = await designFramesToPptx({ frames: [frame], master, tokens });
  const layout = out.layouts[out.slides[0]!.layout!]!;
  const bodies = (layout.placeholders ?? []).filter((p) => p.type === 'body');
  assert.equal(bodies.length, 2, 'the two-column layout has two body placeholders');
  const right = bodies.reduce((a, b) => (b.x > a.x ? b : a));

  const shape = out.slides[0]!.shapes.find((s) => s.kind === 'text' && textOf(s as PptxText) === 'right column') as PptxText | undefined;
  assert.ok(shape?.ph, 'the kept body is placeholder-bound');
  assert.equal(shape!.ph!.idx, right.idx, 'and bound to the right-hand body placeholder, the slot its id names');
});

test('B1: a body row with no seeded id still takes the lowest free slot, in document order', async () => {
  const frame = seeded('two-column');
  const first = frame.layers.find((l) => l.id === 'f1.body')!;
  // A hand-added body whose id states no slot comes after f1.body-2 in the document.
  frame.layers = frame.layers.filter((l) => l.id !== 'f1.body');
  frame.layers.push({ ...first, id: 'handmade', text: 'by hand' });
  frame.layers.find((l) => l.id === 'f1.body-2')!.text = 'seeded second';

  const out = await designFramesToPptx({ frames: [frame], master, tokens });
  const layout = out.layouts[0]!;
  const bodies = (layout.placeholders ?? []).filter((p) => p.type === 'body').sort((a, b) => a.x - b.x);
  const texts = out.slides[0]!.shapes.filter((s) => s.kind === 'text') as PptxText[];
  const hand = texts.find((t) => textOf(t) === 'by hand');
  const kept = texts.find((t) => textOf(t) === 'seeded second');
  assert.equal(kept?.ph?.idx, bodies[1]!.idx, 'the seeded body-2 keeps slot 2');
  assert.equal(hand?.ph?.idx, bodies[0]!.idx, 'the unnamed body takes slot 1, the lowest one free');
});

// ─── B2: flow recipes keep their layout ──────────────────────────────────────

test('B2: a flow-cards-4-2 frame exports Tier A, with a layout, placeholders and its card rules', async () => {
  const frame = seeded('flow-cards-4-2');
  let n = 0;
  for (const layer of frame.layers) if (layer.role && layer.kind === 'text') layer.text = `cell ${++n}`;

  const out = await designFramesToPptx({ frames: [frame], master, tokens });
  assert.equal(out.layouts.length, 1, 'the recipe builds a layout');
  assert.equal(out.slides[0]!.layout, 0, 'and the slide is bound to it');
  assert.deepEqual(out.layoutOfArchetype, [{ archetype: 'flow-cards-4-2', index: 0 }]);
  const layout = out.layouts[0]!;
  // title + 4 labels + 4 bodies
  assert.equal((layout.placeholders ?? []).length, 9, 'every text slot of the recipe is a placeholder');
  const bound = out.slides[0]!.shapes.filter((s) => s.kind === 'text' && (s as PptxText).ph);
  assert.ok(bound.length >= 8, `the cell text is placeholder-bound (${bound.length})`);
  const idxs = bound.map((s) => (s as PptxText).ph!.idx).filter((i) => i !== undefined);
  assert.equal(new Set(idxs).size, idxs.length, 'no two cells share a placeholder');
  const rules = (layout.shapes ?? []).filter((s) => s.kind === 'rect');
  assert.ok(rules.length >= 4, `the four card rules ride the layout (${rules.length} rects)`);
  assert.ok(!out.notes.some((line) => /flow-cards/.test(line)), `nothing about the recipe is reported: ${out.notes}`);
});

test('B2: a flow-columns recipe beside a plain archetype builds one layout each', async () => {
  const a = seeded('content', 'f1');
  const b = seedFrame(master, 'flow-columns-3-3', { frameId: 'f2', x: 1400, y: 0, resolveToken: tokens })!;
  a.row.order = 0;
  b.frame.order = 1;
  const out = await designFramesToPptx({ frames: [a, { row: b.frame, layers: b.layers }], master, tokens });
  assert.deepEqual(out.layoutOfArchetype.map((e) => e.archetype), ['content', 'flow-columns-3-3']);
  assert.deepEqual(out.slides.map((s) => s.layout), [0, 1]);
});

// ─── cover pictures are cropped, not squashed ────────────────────────────────

async function coverDeck(pixels: { w: number; h: number }, extra: Record<string, unknown> = {}) {
  const frame = seeded('full-image');
  const visual = frame.layers.find((l) => l.role === 'visual' && l.kind === 'image');
  assert.ok(visual, 'full-image seeds a picture placeholder');
  assert.equal(visual!.fit, 'cover', 'the full-image placeholder is a cover picture');
  visual!.image = 'user/media/abc123';
  Object.assign(visual!, extra);
  const bytes = png(pixels.w, pixels.h);
  const out = await designFramesToPptx({
    frames: [frame], master, tokens,
    resolveAsset: async (ref) => (ref === 'user/media/abc123' ? { bytes, mime: 'image/png' } : null),
  });
  const pic = out.slides[0]!.shapes.find((s) => s.kind === 'pic') as PptxPic | undefined;
  assert.ok(pic, 'the picture reached the slide');
  return { out, pic: pic!, visual: visual! };
}

const close = (a: number | undefined, b: number, what: string): void =>
  assert.ok(Math.abs((a ?? 0) - b) < 1e-6, `${what}: ${a} is not ${b}`);

test('cover: a 3:2 photo in a 16:9 cover placeholder is cropped top and bottom, centred', async () => {
  const { out, pic } = await coverDeck({ w: 300, h: 200 });
  assert.ok(pic.srcRect, 'the picture carries a source crop');
  const crop = 1 - (3 / 2) / (16 / 9);
  close(pic.srcRect!.t, crop / 2, 'top');
  close(pic.srcRect!.b, crop / 2, 'bottom');
  close(pic.srcRect!.l, 0, 'left');
  close(pic.srcRect!.r, 0, 'right');
  assert.ok(!out.notes.some((n) => n.includes('cover')), `nothing is reported about the crop: ${out.notes}`);
  // The crop reaches the OOXML.
  const parts = buildPptxParts(out.slides, { emuW: 12192000, emuH: 6858000, layouts: out.layouts, now: '2026-10-03T00:00:00.000Z' });
  assert.match(String(parts['ppt/slides/slide1.xml']), /<a:srcRect l="0" t="7813" r="0" b="7813"\/>/);
});

test('cover: a wide photo is cropped left and right, and the image position picks the window', async () => {
  const { pic } = await coverDeck({ w: 400, h: 100 }, { imgpos: 'right top' });
  const crop = 1 - (16 / 9) / 4;
  close(pic.srcRect!.l, crop, 'left takes the whole crop when the right edge is kept');
  close(pic.srcRect!.r, 0, 'right');
  close(pic.srcRect!.t, 0, 'top');
  close(pic.srcRect!.b, 0, 'bottom');
});

test('cover: a framing pan and zoom narrow the window the way the canvas scales it', async () => {
  // 16:9 source in a 16:9 box: no aspect crop, so only the zoom crops. A zoom of 200
  // about the centre shows the middle half of the picture.
  const { pic } = await coverDeck({ w: 1600, h: 900 }, { imageFraming: { x: 50, y: 50, zoom: 200 } });
  close(pic.srcRect!.l, 0.25, 'left');
  close(pic.srcRect!.r, 0.25, 'right');
  close(pic.srcRect!.t, 0.25, 'top');
  close(pic.srcRect!.b, 0.25, 'bottom');
});

test('cover: a picture of the box\'s own aspect, or one set to contain, carries no crop', async () => {
  const same = await coverDeck({ w: 1600, h: 900 });
  assert.equal(same.pic.srcRect, undefined, 'same aspect, nothing to crop');
  const contain = await coverDeck({ w: 300, h: 200 }, { fit: 'contain' });
  assert.equal(contain.pic.srcRect, undefined, 'contain is not cropped');
});

// ─── contain pictures keep their aspect ──────────────────────────────────────
//
// The canvas draws an unset fit as contain (`imgCss` in the Design renderer), and every
// logo row and the `visual` slot are contain, so the deck letterboxes them the way the
// canvas does instead of stretching them over the row's box.

const EMU = 9525;
const ratio = (pic: PptxPic): number => pic.cx / pic.cy;
const near = (a: number, b: number, tol: number, what: string): void =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);

/** Lowers one seeded frame whose picture row `pick` names, with the given bytes, and returns the row, the picture and the rasteriser's calls. */
async function fittedDeck(
  archetype: string,
  pick: (l: DesignBoxRowV1) => boolean,
  asset: { bytes: Uint8Array; mime: string },
  extra: Record<string, unknown> = {},
) {
  const frame = seeded(archetype);
  const row = frame.layers.find(pick);
  assert.ok(row, `${archetype} seeds the picture row`);
  row!.image = 'user/media/fit';
  Object.assign(row!, extra);
  // Only the row under test carries a picture.
  for (const l of frame.layers) if (l !== row && l.kind === 'image') l.image = '';
  const rasters: Array<{ w: number; h: number }> = [];
  const out = await designFramesToPptx({
    frames: [frame], master, tokens,
    resolveAsset: async (ref) => (ref === 'user/media/fit' ? asset : null),
    rasterizeSvg: async (_bytes, w, h) => {
      rasters.push({ w, h });
      return png(w, h);
    },
  });
  const pics = out.slides[0]!.shapes.filter((s) => s.kind === 'pic') as PptxPic[];
  assert.equal(pics.length, 1, 'the picture reached the slide');
  const box = { x: Number(row!.x) * EMU, y: Number(row!.y) * EMU, cx: Number(row!.w) * EMU, cy: Number(row!.h) * EMU };
  return { out, pic: pics[0]!, row: row!, box, rasters };
}

const svg = (attrs: string): { bytes: Uint8Array; mime: string } => ({
  bytes: new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}><rect width="10" height="10"/></svg>`),
  mime: 'image/svg+xml',
});
const isLogo = (l: DesignBoxRowV1): boolean => l.furniture === 'logo';

test('contain: a square SVG mark in the 3.4:1 logo furniture box stays square, centred, and its fallback is square', async () => {
  const { pic, row, box, rasters } = await fittedDeck('content', isLogo, svg('viewBox="0 0 285.75 285.75"'));
  assert.equal(row.fit, 'contain', 'the logo furniture is a contain picture');
  assert.ok(box.cx / box.cy > 3, `the furniture box is wide (${box.cx / box.cy})`);
  near(ratio(pic), 1, 0.02, 'the mark keeps its 1:1 aspect');
  assert.equal(pic.cy, box.cy, 'it fills the box height');
  near(pic.x - box.x, (box.cx - pic.cx) / 2, 1, 'and sits in the middle of the leftover width');
  assert.equal(pic.y, box.y);
  assert.equal(pic.srcRect, undefined, 'nothing is cut');
  assert.ok(pic.svg !== undefined, 'the vector travels beside its fallback');
  assert.equal(rasters.length, 1);
  assert.equal(rasters[0]!.w, rasters[0]!.h, `the PNG fallback is drawn square (${rasters[0]!.w}x${rasters[0]!.h})`);
});

test('contain: a wordmark wider than its box is letterboxed top and bottom at its unrounded viewBox aspect', async () => {
  const { pic, box, rasters } = await fittedDeck('title', (l) => l.furniture === 'logo-hero', svg('viewBox="0 0 210.179 37.666"'));
  const aspect = 210.179 / 37.666;
  assert.ok(aspect > box.cx / box.cy, 'the wordmark is wider than the box');
  assert.equal(pic.cx, box.cx, 'it fills the box width');
  near(ratio(pic), aspect, 0.01, 'and keeps the 5.58:1 aspect instead of the box\'s');
  near(pic.y - box.y, (box.cy - pic.cy) / 2, 1, 'centred in the leftover height');
  near(rasters[0]!.w / rasters[0]!.h, aspect, 0.1, 'the fallback is drawn at the same aspect');
});

test('contain: an SVG with absolute width and height takes its aspect from them', async () => {
  const { pic } = await fittedDeck('content', isLogo, svg('width="2in" height="1in" viewBox="0 0 500 500"'));
  near(ratio(pic), 2, 0.02, 'width and height, not the viewBox, give an image its size');
});

test('contain: a 4:3 photo in the visual slot keeps its aspect, centred, and the OOXML carries the fitted box', async () => {
  const { out, pic, row, box } = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: png(1600, 1200), mime: 'image/png' });
  assert.equal(row.fit, 'contain', 'the visual slot is a contain picture');
  assert.equal(pic.cy, box.cy, 'the photo fills the slot height');
  near(ratio(pic), 4 / 3, 0.005, 'and keeps its 4:3 aspect instead of the slot\'s');
  near(pic.x - box.x, (box.cx - pic.cx) / 2, 1, 'centred across the slot');
  assert.equal(pic.srcRect, undefined, 'a contained photo is not cut');
  const parts = buildPptxParts(out.slides, { emuW: 12192000, emuH: 6858000, layouts: out.layouts, now: '2026-10-03T00:00:00.000Z' });
  const xml = String(parts['ppt/slides/slide1.xml']);
  const ext = new RegExp(`<p:pic>[\\s\\S]*?<a:ext cx="${pic.cx}" cy="${pic.cy}"/>`).exec(xml);
  assert.ok(ext, 'the slide writes the fitted size');
});

test('contain: an unset fit is drawn as contain, and imgpos places the picture in the leftover space', async () => {
  const { pic, box } = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: png(400, 300), mime: 'image/png' }, { fit: '', imgpos: 'left top' });
  near(ratio(pic), 4 / 3, 0.005, 'an unset fit is not stretched');
  assert.equal(pic.x, box.x, 'left keeps the left edge');
  assert.equal(pic.y, box.y);
});

test('contain: a framing zoom scales about its point and the box cuts the overflow', async () => {
  // A picture of the box's own aspect, zoomed 200 about the centre: the shape keeps the
  // whole box and the middle half of the picture shows, the same as cover would.
  const frame = seeded('visual');
  const slot = frame.layers.find((l) => l.role === 'visual')!;
  const w = Number(slot.w);
  const h = Number(slot.h);
  const { pic, box } = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: png(w, h), mime: 'image/png' }, { imageFraming: { x: 50, y: 50, zoom: 200 } });
  near(pic.cx, box.cx, 1, 'the shape keeps the whole box width');
  near(pic.cy, box.cy, 1, 'and height');
  close(pic.srcRect!.l, 0.25, 'left');
  close(pic.srcRect!.r, 0.25, 'right');
  close(pic.srcRect!.t, 0.25, 'top');
  close(pic.srcRect!.b, 0.25, 'bottom');
});

test('fill stretches over the box, none draws at the picture\'s own pixel size', async () => {
  const fill = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: png(400, 300), mime: 'image/png' }, { fit: 'fill' });
  assert.deepEqual([fill.pic.x, fill.pic.y, fill.pic.cx, fill.pic.cy], [fill.box.x, fill.box.y, fill.box.cx, fill.box.cy], 'fill is the one fit that stretches');
  const none = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: png(100, 50), mime: 'image/png' }, { fit: 'none' });
  assert.deepEqual([none.pic.cx, none.pic.cy], [100 * EMU, 50 * EMU], 'none keeps the pixel size');
  near(none.pic.y - none.box.y, (none.box.cy - none.pic.cy) / 2, 1, 'centred');
});

test('contain: a picture whose size cannot be read is placed over its box and reported', async () => {
  const { out, pic, box } = await fittedDeck('visual', (l) => l.role === 'visual', { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), mime: 'image/png' });
  assert.deepEqual([pic.cx, pic.cy], [box.cx, box.cy]);
  assert.ok(out.notes.some((n) => /set to contain was placed over its whole box/.test(n)), `the export notes say so: ${out.notes}`);
});

// ─── B5: the neutral master outside its own profile ──────────────────────────

test('B5: the catalog master wins; the neutral id falls back to the engine copy with a note; another id does not', () => {
  const catalog = { ...master, version: '9.9.9' };
  assert.equal(slideMasterForExport(master.id, catalog)?.master, catalog, 'the catalog answer is used as it is');
  assert.equal(slideMasterForExport(master.id, catalog)?.note, undefined, 'and needs no note');

  const fallback = slideMasterForExport('lolly/slides/neutral', null);
  assert.ok(fallback, 'the neutral id is answered without a catalog');
  assert.equal(fallback!.master.id, 'lolly/slides/neutral');
  assert.deepEqual(fallback!.master, neutralSlideMaster(), 'with the engine\'s own neutral master');
  assert.match(fallback!.note ?? '', /lolly\/slides\/neutral is not in this profile's catalog/);

  assert.equal(slideMasterForExport('acme/slides/house', null), null, 'any other id keeps to the deck model');
  assert.equal(slideMasterForExport('', undefined), null);
});

test('B5: a neutral-master frame exported under the suse profile is Tier A, and the notes say why',
  { skip: SUSE_PRESENT ? false : 'brands/suse is not checked out' }, () => {
    const bx = JSON.stringify([
      { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', master: 'lolly/slides/neutral', archetype: 'title' },
      { id: 'f1.title', kind: 'text', frame: 'f1', x: 44, y: 158, w: 925, h: 287, text: 'A neutral deck', role: 'title', master: 'lolly/slides/neutral', order: 1 },
      { id: 'f2', kind: 'frame', x: 1400, y: 0, w: 1280, h: 720, order: 1, bg: '#ffffff', master: 'lolly/slides/neutral', archetype: 'flow-cards-4-2' },
    ]);
    const dir = mkdtempSync(join(tmpdir(), 'lolly-tier-a-b5-'));
    const out = join(dir, 'deck.pptx');
    const run = spawnSync(process.execPath, [join(REPO, 'shells', 'cli', 'bin', 'lolly.ts'), 'design', '--export=pptx', `--bx=${bx}`, `--output=${out}`], {
      cwd: REPO,
      env: { ...process.env, LOLLY_PROFILE: 'suse' },
      encoding: 'utf8',
      timeout: 120_000,
    });
    assert.equal(run.status, 0, `the export ran: ${run.stderr}`);
    const entries = unzipSync(new Uint8Array(readFileSync(out)));
    assert.ok(entries['ppt/slideLayouts/slideLayout2.xml'], `one layout for the title, one for the flow recipe: ${Object.keys(entries).join(', ')}`);
    const slide1 = new TextDecoder().decode(entries['ppt/slides/slide1.xml']!);
    assert.match(slide1, /<p:ph type="title"\/>/, 'the title is placeholder-bound');
    assert.match(`${run.stdout}\n${run.stderr}`, /neutral slide master/, 'the export notes name the fallback');
  });

// ─── slotOrdinalOf, the one rule both sides use ──────────────────────────────

test('slotOrdinalOf: the id suffix first, then the lowest free slot in list order; furniture fills none', () => {
  const rows: DesignBoxRowV1[] = [
    { id: 'f.title', role: 'title' },
    { id: 'f.body-3', role: 'body' },
    { id: 'loose', role: 'body' },
    { id: 'f.body', role: 'body' },
    { id: 'also-loose', role: 'body' },
    { id: 'f.logo', furniture: 'logo-corner', role: 'body' },
    { id: 'f.bar' },
  ];
  assert.deepEqual(rows.map((r) => slotOrdinalOf(r, rows)), [1, 3, 2, 1, 4, 0, 0]);
  const stray: DesignBoxRowV1 = { id: 'stray', role: 'body' };
  assert.equal(slotOrdinalOf(stray, rows), 5, 'a row not in the list counts as if it came last');
  const twice: DesignBoxRowV1[] = [{ id: 'a.body-2', role: 'body' }, { id: 'b.body-2', role: 'body' }];
  assert.deepEqual(twice.map((r) => slotOrdinalOf(r, twice)), [2, 1], 'a slot claimed twice goes to the first claim; the other takes the lowest free');
});
