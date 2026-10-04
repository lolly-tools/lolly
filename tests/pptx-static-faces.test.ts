// SPDX-License-Identifier: MPL-2.0
/**
 * Static faces for weights PowerPoint cannot state (plan 291 decision D3).
 *
 * A PowerPoint run is Regular or Bold. A Medium 500 headline written as the family
 * with b=0 opens Regular, so the export writes the static face ("SUSE Medium", b=0)
 * when, and only when, the brand pack ships that file. These tests pin:
 *   - the pure helper that maps (family, weight, italic, shipped faces) to a face;
 *   - the pass both PPTX paths run before the engine writes the deck;
 *   - the Tier A lowering (design-pptx) and the deck-model lowering (pptx-deck plus the
 *     engine's buildPptxParts) end to end, into the OOXML a reader opens;
 *   - Design's deck model carrying the weight it used to flatten to a bold flag;
 *   - the file convention against the name table of every SUSE static face shipped;
 *   - lolly-start, which ships no static faces, building the same bytes as before;
 *   - deckFontName reading a hostile var() in linear time.
 *
 * Run with: pnpm test  (node --test over the tests/ globs). No framework - node:test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { buildPptxParts, type PptxLayout, type PptxSlide, type PptxText } from '../engine/src/pptx.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';
import {
  deckFontName, deckPlaceholder, deckSyncShape, emuOf, nameStaticFaces, staticFaceFile, staticFaceFor,
  STATIC_FACE_DIR, type ShipsFace,
} from '../packages/node-shell/src/pptx-deck.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';
import { contentRoots, contentUrlFile, contentUrlFileExact } from '../packages/node-shell/src/content-roots.ts';
import { catalogStaticFace } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import type { DesignBoxRowV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUSE_TTF = join(REPO, 'brands', 'suse', 'catalog', 'fonts', 'ttf');
const START_MASTERS = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'masters.json');

/** The faces a SUSE pack ships, as a set the fake `ships` answers from. */
const SHIPPED = new Set(['SUSE-Medium.ttf', 'SUSE-MediumItalic.ttf', 'SUSE-SemiBold.ttf', 'SUSE-Light.ttf', 'SUSEMono-Medium.ttf']);
const ships: ShipsFace = (file) => SHIPPED.has(file);
const shipsNothing: ShipsFace = () => false;
const FONTS = { major: 'SUSE', minor: 'SUSE' };
const NOW = '2026-10-02T00:00:00.000Z';

/** Every `<a:rPr>` in an XML part, as attributes plus its latin typeface. */
function runProps(xml: string): Array<{ b: string; i: string; face: string | null }> {
  const out: Array<{ b: string; i: string; face: string | null }> = [];
  for (const m of xml.matchAll(/<a:rPr ([^>]*?)(?:\/>|>(.*?)<\/a:rPr>)/g)) {
    const attrs = m[1] ?? '';
    const face = /<a:latin typeface="([^"]*)"/.exec(m[2] ?? '')?.[1] ?? null;
    out.push({ b: /\bb="(\d)"/.exec(attrs)?.[1] ?? '', i: /\bi="(\d)"/.exec(attrs)?.[1] ?? '', face });
  }
  return out;
}

const slideXml = (parts: Record<string, string | Uint8Array>, n = 1): string => {
  const v = parts[`ppt/slides/slide${n}.xml`];
  assert.equal(typeof v, 'string', `slide${n}.xml is in the package`);
  return v as string;
};

// ── 1. the pure helper ────────────────────────────────────────────────────────

test('staticFaceFile follows the catalog convention and refuses 400, 700 and odd names', () => {
  assert.equal(staticFaceFile('SUSE', 500), 'SUSE-Medium.ttf');
  assert.equal(staticFaceFile('SUSE', 500, true), 'SUSE-MediumItalic.ttf');
  assert.equal(staticFaceFile('SUSE Mono', 600), 'SUSEMono-SemiBold.ttf', 'the stem drops the space');
  assert.equal(staticFaceFile('SUSE', 300), 'SUSE-Light.ttf');
  assert.equal(staticFaceFile('SUSE', 540), 'SUSE-Medium.ttf', 'a weight rounds to the nearest 100');
  assert.equal(staticFaceFile('SUSE', 400), null, '400 keeps the family');
  assert.equal(staticFaceFile('SUSE', 700), null, '700 keeps the family with b=1');
  assert.equal(staticFaceFile(undefined, 500), null);
  assert.equal(staticFaceFile('../etc/passwd', 500), null, 'a family that is not a plain name never becomes a path');
});

test('staticFaceFor picks the shipped face with b=0 and leaves everything else alone', () => {
  const shipped = new Set(SHIPPED);
  assert.deepEqual(staticFaceFor('SUSE', 500, false, shipped), { face: 'SUSE Medium', bold: false });
  assert.deepEqual(staticFaceFor('SUSE', 500, true, shipped), { face: 'SUSE Medium', bold: false }, 'italic keeps its own i=1 on the named face');
  assert.deepEqual(staticFaceFor('SUSE', 600, false, shipped), { face: 'SUSE SemiBold', bold: false });
  assert.deepEqual(staticFaceFor('SUSE Mono', 500, false, shipped), { face: 'SUSE Mono Medium', bold: false });
  assert.deepEqual(staticFaceFor('SUSE', 700, false, shipped), { face: 'SUSE', bold: true });
  assert.deepEqual(staticFaceFor('SUSE', 400, false, shipped), { face: 'SUSE', bold: false });
  assert.deepEqual(staticFaceFor('Arial', 500, false, shipped), { face: 'Arial', bold: false }, 'a family the pack does not carry stays');
  assert.deepEqual(staticFaceFor('SUSE', 800, false, shipped), { face: 'SUSE', bold: true }, 'an unshipped weight keeps the old bold rule');
  assert.deepEqual(staticFaceFor('SUSE', 500, false, new Set()), { face: 'SUSE', bold: false }, 'nothing shipped, nothing named');
});

// ── 2. the pass ────────────────────────────────────────────────────────────────

/** A text shape with one run per entry, as a lowering hands it over (weight included). */
function textShape(runs: Array<Record<string, unknown>>, ph?: PptxText['ph']): PptxText {
  return {
    kind: 'text', x: 0, y: 0, cx: 100, cy: 100,
    paras: [{ runs: runs.map((r) => ({ text: 'x', sizePt: 24, ...r })) as PptxText['paras'][number]['runs'] }],
    ...(ph ? { ph } : {}),
  };
}

test('nameStaticFaces renames a shipped weight, keeps Bold runs bold and strips every weight', async () => {
  const shape = textShape([
    { weight: 500 },                                  // the row's Medium
    { weight: 500, italic: true },                     // Medium italic
    { weight: 700, bold: true },                       // a ** run inside the Medium row
    { weight: 500, font: 'SUSE Mono' },                // a mono run
    { weight: 500, font: 'Arial' },                    // a family the pack does not carry
    { weight: 800, bold: true },                       // a weight the pack does not ship
    {},                                                // no weight at all
  ]);
  const asked: string[] = [];
  await nameStaticFaces({ slides: [{ shapes: [shape] }] }, FONTS, (file) => { asked.push(file); return SHIPPED.has(file); });
  const runs = shape.paras[0]!.runs;
  assert.deepEqual(runs.map((r) => [r.font, !!r.bold, !!r.italic]), [
    ['SUSE Medium', false, false],
    ['SUSE Medium', false, true],
    [undefined, true, false],
    ['SUSE Mono Medium', false, false],
    ['Arial', false, false],
    [undefined, true, false],
    [undefined, false, false],
  ]);
  for (const r of runs) assert.ok(!('weight' in r), 'no weight reaches the engine');
  assert.deepEqual(asked.sort(), ['Arial-Medium.ttf', 'SUSE-ExtraBold.ttf', 'SUSE-Medium.ttf', 'SUSE-MediumItalic.ttf', 'SUSEMono-Medium.ttf'],
    'each distinct file is asked once');
});

test('nameStaticFaces takes a title from the major font and a placeholder style too', async () => {
  const title = textShape([{ weight: 500 }], { type: 'title' });
  const body = textShape([{ weight: 300 }], { type: 'body', idx: 1 });
  const ph = deckPlaceholder({ type: 'title', x: 0, y: 0, w: 100, h: 50, style: { sizePt: 40, weight: 500 } });
  assert.ok(ph?.style);
  const layouts: PptxLayout[] = [{ name: 'Title', placeholders: [ph!] }];
  await nameStaticFaces({ slides: [{ shapes: [title, body] }], layouts }, { major: 'SUSE', minor: 'SUSE Mono' }, ships);
  assert.equal(title.paras[0]!.runs[0]!.font, 'SUSE Medium', 'a title draws in the major font');
  assert.equal(body.paras[0]!.runs[0]!.font, undefined, 'the minor family here ships no Light, so the body run is untouched');
  assert.equal(ph!.style!.font, 'SUSE Medium', 'a new slide from the layout gets the Medium face too');
  assert.ok(!('weight' in ph!.style!), 'the placeholder style loses its weight');
});

test('with nothing shipped the pass only strips weights, so the deck bytes do not change', async () => {
  const withWeights = textShape([{ weight: 500 }, { weight: 600, bold: true }, { weight: 500, italic: true }]);
  const without = textShape([{}, { bold: true }, { italic: true }]);
  await nameStaticFaces({ slides: [{ shapes: [withWeights] }] }, FONTS, shipsNothing);
  const a = buildPptxParts([{ shapes: [withWeights], media: [] }], { now: NOW });
  const b = buildPptxParts([{ shapes: [without], media: [] }], { now: NOW });
  assert.deepEqual(a, b);
});

test('a slide run bound to a renamed layout style states the family it used to inherit', async () => {
  // Layout 0 sets its title style to "SUSE Medium" and its body (idx 1) "SUSE Light";
  // layout 1 keeps its weights at 400 and 700, so nothing bound to it changes.
  const layouts: PptxLayout[] = [
    { name: 'Medium', placeholders: [
      { type: 'title', x: 0, y: 0, cx: 1, cy: 1, style: { sizePt: 40, weight: 500 } as never },
      { type: 'body', idx: 1, x: 0, y: 0, cx: 1, cy: 1, style: { sizePt: 20, font: 'SUSE', weight: 300 } as never },
    ] },
    { name: 'Plain', placeholders: [
      { type: 'title', x: 0, y: 0, cx: 1, cy: 1, style: { sizePt: 40, weight: 700 } as never },
    ] },
  ];
  const title = textShape([{ weight: 700, bold: true }, { weight: 500 }, {}, { weight: 400, font: 'Arial' }], { type: 'title' });
  const body = textShape([{ weight: 400 }, { weight: 800, bold: true }], { type: 'body', idx: 1 });
  const free = textShape([{ weight: 400 }]);
  const plain = textShape([{ weight: 700, bold: true }], { type: 'title' });
  await nameStaticFaces({ slides: [{ shapes: [title, body, free] }, { shapes: [plain], layout: 1 }], layouts }, FONTS, ships);
  assert.equal(layouts[0]!.placeholders![0]!.style!.font, 'SUSE Medium', 'the layout is still a Medium template');
  assert.equal(layouts[0]!.placeholders![1]!.style!.font, 'SUSE Light');
  assert.deepEqual(title.paras[0]!.runs.map((r) => [r.font, !!r.bold]), [
    ['SUSE', true],                                   // 700 is real Bold, not a faux-bold Medium
    ['SUSE Medium', false],                           // gets its own Medium face
    ['SUSE', false],                                  // no weight: what it drew in before
    ['Arial', false],                                 // a typeface of its own is kept
  ]);
  assert.deepEqual(body.paras[0]!.runs.map((r) => r.font), ['SUSE', 'SUSE'], 'bound by idx to the Light body style');
  assert.equal(free.paras[0]!.runs[0]!.font, undefined, 'a shape with no placeholder inherits nothing');
  assert.equal(plain.paras[0]!.runs[0]!.font, undefined, 'a slide on an unrenamed layout is untouched');
});

// ── 3. Tier A: design-pptx ──────────────────────────────────────────────────

function plainFrame(layers: DesignBoxRowV1[]): Array<{ row: DesignBoxRowV1; layers: DesignBoxRowV1[] }> {
  return [{ row: { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0 }, layers }];
}

async function tierA(shipsFace: ShipsFace | undefined): Promise<Array<{ b: string; i: string; face: string | null }>> {
  const frames = plainFrame([
    { id: 'h', kind: 'text', frame: 'f1', x: 0, y: 0, w: 800, h: 100, text: 'Medium headline', weight: 500, font: 'display', order: 0 },
    { id: 'm', kind: 'text', frame: 'f1', x: 0, y: 200, w: 800, h: 100, text: 'Lead **bold**{w500|*it*}', weight: 500, order: 1 },
    { id: 'k', kind: 'text', frame: 'f1', x: 0, y: 400, w: 800, h: 100, text: 'Bold headline', order: 2 },
  ]);
  const out = await designFramesToPptx({ frames, fonts: FONTS, ...(shipsFace ? { shipsFace } : {}) });
  for (const slide of out.slides) {
    for (const s of slide.shapes) {
      if (s.kind === 'text') for (const p of s.paras) for (const r of p.runs) assert.ok(!('weight' in r), 'no weight leaves design-pptx');
    }
  }
  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), theme: out.theme, now: NOW });
  return runProps(slideXml(parts));
}

test('Tier A: a weight-500 run is "SUSE Medium" with b=0 when the face ships', async () => {
  const runs = await tierA(ships);
  assert.deepEqual(runs[0], { b: '0', i: '0', face: 'SUSE Medium' }, 'the Medium headline');
  assert.deepEqual(runs[1], { b: '0', i: '0', face: 'SUSE Medium' }, 'the Medium lead');
  assert.deepEqual(runs[2], { b: '1', i: '0', face: null }, 'a ** run inside the Medium row stays Bold on the theme family');
  assert.deepEqual(runs[3], { b: '0', i: '1', face: 'SUSE Medium' }, 'italic Medium keeps i=1 on the named face');
  assert.deepEqual(runs[4], { b: '1', i: '0', face: null }, 'a 700 row is untouched');
});

test('Tier A: the same deck stays "SUSE" when the face is not shipped', async () => {
  const runs = await tierA(shipsNothing);
  assert.deepEqual(runs[0], { b: '0', i: '0', face: 'SUSE' });
  assert.deepEqual(runs[1], { b: '0', i: '0', face: null });
  assert.deepEqual(runs[2], { b: '1', i: '0', face: null });
  assert.deepEqual(await tierA(undefined), runs, 'no shipsFace is the same as nothing shipped');
});

/** The run properties of the title placeholder on one slide. */
function titleRuns(xml: string): Array<{ b: string; i: string; face: string | null }> {
  const sp = [...xml.matchAll(/<p:sp>.*?<\/p:sp>/gs)].map((m) => m[0]).find((x) => x.includes('<p:ph type="title"'));
  assert.ok(sp, 'the slide has a title placeholder');
  return runProps(sp!).filter((r) => r.b !== '' || r.face !== null);
}

test('Tier A with a master: a Medium title layout does not turn 700, 400 or ** titles into Medium', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const master: SlideMasterV1 = structuredClone((JSON.parse(readFileSync(START_MASTERS, 'utf8')) as SlideMasterFileV1).masters[0]!);
  const content = master.archetypes.find((a) => a.id === 'content');
  const titlePh = content?.placeholders.find((p) => p.role === 'title');
  assert.ok(titlePh?.style, 'the starter master has a content title');
  titlePh!.style!.weight = '500';
  const titles: Array<[string, string]> = [['Quarterly **review**', '500'], ['Where the growth came from', '700'], ['What we do next', '400']];
  const frames = titles.map(([text, weight], i) => {
    const seeded = seedFrame(master, 'content', { frameId: `f${i}`, x: i * 1400, y: 0 });
    assert.ok(seeded);
    seeded!.frame.order = i;
    for (const layer of seeded!.layers) {
      if (layer.role === 'title' && layer.kind === 'text') { layer.text = text; layer.weight = weight; }
    }
    return { row: seeded!.frame, layers: seeded!.layers };
  });
  const out = await designFramesToPptx({ frames, master, fonts: FONTS, shipsFace: ships });
  const parts = buildPptxParts(out.slides, {
    emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), theme: out.theme, layouts: out.layouts, now: NOW,
  });
  const layoutXml = parts[`ppt/slideLayouts/slideLayout${(out.slides[0]!.layout ?? 0) + 1}.xml`] as string;
  assert.match(layoutXml, /<p:ph type="title"\/>.*?<a:latin typeface="SUSE Medium"\/>/s, 'a new slide from the layout is Medium');
  assert.deepEqual(titleRuns(slideXml(parts, 1)), [
    { b: '0', i: '0', face: 'SUSE Medium' },
    { b: '1', i: '0', face: 'SUSE' },
  ], 'the ** run is real Bold on the family, not a faux-bold Medium');
  assert.deepEqual(titleRuns(slideXml(parts, 2)), [{ b: '1', i: '0', face: 'SUSE' }], 'a 700 title is real Bold');
  assert.deepEqual(titleRuns(slideXml(parts, 3)), [{ b: '0', i: '0', face: 'SUSE' }], 'a 400 title is Regular');
});

// ── 4. the deck model: pptx-deck plus buildPptxParts ─────────────────────────

async function deckModel(shipsFace: ShipsFace): Promise<Array<{ b: string; i: string; face: string | null }>> {
  const el = {
    t: 'text', x: 0, y: 0, w: 800, h: 100,
    paras: [{ runs: [
      { text: 'Medium', sizePt: 36, bold: false, weight: 500 },
      { text: 'Medium italic', sizePt: 36, bold: false, italic: true, weight: 500 },
      { text: 'Bold', sizePt: 36, bold: true },
      { text: 'Mono', sizePt: 36, bold: false, weight: 500, font: 'var(--font-mono)' },
    ] }],
  };
  const resolve = (name: string): string | undefined => (name === '--font-mono' ? "'SUSE Mono', monospace" : undefined);
  const shape = deckSyncShape(el, undefined, resolve);
  assert.ok(shape);
  const slides: PptxSlide[] = [{ shapes: [shape!], media: [] }];
  await nameStaticFaces({ slides }, FONTS, shipsFace);
  return runProps(slideXml(buildPptxParts(slides, { theme: { fonts: FONTS }, now: NOW })));
}

test('deck model: a weight-500 run is "SUSE Medium" with b=0 when the face ships', async () => {
  assert.deepEqual(await deckModel(ships), [
    { b: '0', i: '0', face: 'SUSE Medium' },
    { b: '0', i: '1', face: 'SUSE Medium' },
    { b: '1', i: '0', face: null },
    { b: '0', i: '0', face: 'SUSE Mono Medium' },
  ]);
});

test('deck model: the same runs stay on the family when the face is not shipped', async () => {
  assert.deepEqual(await deckModel(shipsNothing), [
    { b: '0', i: '0', face: null },
    { b: '0', i: '1', face: null },
    { b: '1', i: '0', face: null },
    { b: '0', i: '0', face: 'SUSE Mono' },
  ]);
});

// ── 5. Design's deck model carries the weight ────────────────────────────────

test('Design states a run weight only where the bold flag cannot say it', async () => {
  const tool: any = await loadTool('design', (path: string) => readFile(join(REPO, 'community', path), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), { boxes: [
    { id: 'fa', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff' },
    { id: 'a', kind: 'text', x: 0, y: 0, w: 800, h: 100, text: 'Medium', weight: '500', frame: 'fa' },
    { id: 'b', kind: 'text', x: 0, y: 200, w: 800, h: 100, text: 'Bold', weight: '700', frame: 'fa' },
    { id: 'c', kind: 'text', x: 0, y: 400, w: 800, h: 100, text: 'Lead **bold** {w600|semi}', weight: '500', frame: 'fa' },
  ] as never });
  const html = rt.getHydrated() as string;
  const raw = new JSDOM(html).window.document.querySelector('[data-pptx-deck]')?.textContent ?? '';
  const deck = JSON.parse(raw);
  const runsOf = (i: number) => deck.slides[0].elements[i].paras.flatMap((p: { runs: unknown[] }) => p.runs);
  assert.deepEqual(runsOf(0).map((r: any) => [r.bold, r.weight]), [[false, 500]]);
  assert.deepEqual(runsOf(1).map((r: any) => [r.bold, r.weight]), [[true, undefined]], 'a Bold row needs no weight');
  assert.deepEqual(runsOf(2).map((r: any) => [r.text, r.bold, r.weight]), [
    ['Lead ', false, 500],
    ['bold', true, undefined],
    [' ', false, 500],
    ['semi', true, 600],
  ]);
});

// ── 6. the convention against the shipped name tables ────────────────────────

/** The Windows English (platform 3, language 0x409) name records of one sfnt. */
function windowsNames(bytes: Buffer): Map<number, string> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let nameOff = -1;
  for (let i = 0; i < dv.getUint16(4); i++) {
    const rec = 12 + i * 16;
    if (bytes.toString('latin1', rec, rec + 4) === 'name') nameOff = dv.getUint32(rec + 8);
  }
  assert.notEqual(nameOff, -1, 'font has no name table');
  const strOff = nameOff + dv.getUint16(nameOff + 4);
  const out = new Map<number, string>();
  for (let i = 0; i < dv.getUint16(nameOff + 2); i++) {
    const r = nameOff + 6 + i * 12;
    if (dv.getUint16(r) !== 3 || dv.getUint16(r + 4) !== 0x409) continue;
    const off = strOff + dv.getUint16(r + 10);
    out.set(dv.getUint16(r + 6), Buffer.from(bytes.subarray(off, off + dv.getUint16(r + 8))).swap16().toString('utf16le'));
  }
  return out;
}

test('every shipped SUSE static face is named "<Family> <Weight>" in its own name table', (t) => {
  if (!existsSync(SUSE_TTF)) { t.skip('brands/suse is not checked out'); return; }
  const files = readdirSync(SUSE_TTF).filter((f) => f.endsWith('.ttf'));
  assert.ok(files.length > 0);
  let checked = 0;
  for (const family of ['SUSE', 'SUSE Mono']) {
    for (const weight of [100, 200, 300, 500, 600, 800, 900]) {
      for (const italic of [false, true]) {
        const file = staticFaceFile(family, weight, italic);
        assert.ok(file);
        if (!files.includes(file!)) continue;
        const face = staticFaceFor(family, weight, italic, new Set([file!])).face;
        const id1 = windowsNames(readFileSync(join(SUSE_TTF, file!))).get(1);
        assert.equal(id1, face, `${file}: PowerPoint finds it by name ID 1`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 26, `checked ${checked} faces`);
});

// ── 7. which profiles ship faces ──────────────────────────────────────────────

test('lolly-start ships no static face, so nothing it exports is renamed', async (t) => {
  let roots: ReturnType<typeof contentRoots>;
  try { roots = contentRoots({ profile: 'lolly-start' }); } catch { t.skip('the lolly-start profile does not resolve here'); return; }
  for (const file of ['SUSE-Medium.ttf', 'SUSE-SemiBold.ttf', 'SUSEMono-Medium.ttf']) {
    assert.equal(catalogStaticFace(file, roots), false, `${file} is not in lolly-start`);
  }
  const shape = textShape([{ weight: 500 }]);
  await nameStaticFaces({ slides: [{ shapes: [shape] }] }, FONTS, (file) => catalogStaticFace(file, roots));
  assert.equal(shape.paras[0]!.runs[0]!.font, undefined);
});

test('the suse profile ships the Medium face at the catalog URL the shells probe', (t) => {
  if (!existsSync(SUSE_TTF)) { t.skip('brands/suse is not checked out'); return; }
  let roots: ReturnType<typeof contentRoots>;
  try { roots = contentRoots({ profile: 'suse' }); } catch { t.skip('the suse profile does not resolve here'); return; }
  assert.ok(contentUrlFile(STATIC_FACE_DIR + 'SUSE-Medium.ttf', roots));
  assert.equal(catalogStaticFace('SUSE-Medium.ttf', roots), true);
});

test('a face file is matched letter for letter, so a Mac and Linux write the same deck', async (t) => {
  if (!existsSync(SUSE_TTF)) { t.skip('brands/suse is not checked out'); return; }
  let roots: ReturnType<typeof contentRoots>;
  try { roots = contentRoots({ profile: 'suse' }); } catch { t.skip('the suse profile does not resolve here'); return; }
  for (const file of ['suse-Medium.ttf', 'Suse-medium.ttf', 'SUSE-medium.ttf']) {
    assert.equal(contentUrlFileExact(STATIC_FACE_DIR + file, roots), null, `${file} is not the shipped name`);
    assert.equal(catalogStaticFace(file, roots), false, `${file} is not shipped, whatever the volume's case rules`);
  }
  assert.ok(contentUrlFileExact(STATIC_FACE_DIR + 'SUSE-Medium.ttf', roots));
  const shape = textShape([{ weight: 500, font: 'suse' }]);
  await nameStaticFaces({ slides: [{ shapes: [shape] }] }, FONTS, (file) => catalogStaticFace(file, roots));
  assert.equal(shape.paras[0]!.runs[0]!.font, 'suse', 'a wrongly cased family keeps its name on every OS');
});

// ── 8. deckFontName cannot backtrack ─────────────────────────────────────────

test('deckFontName resolves nested var() and reads a hostile one in linear time', () => {
  const resolve = (n: string): string | undefined => (n === '--b' ? 'SUSE Mono, monospace' : undefined);
  assert.equal(deckFontName('var(--a, var(--b, serif))', resolve), 'SUSE Mono', 'a nested fallback resolves');
  assert.equal(deckFontName("var(--x, 'Brand Face', serif)"), 'Brand Face');
  assert.equal(deckFontName('var(--a)', () => 'var(--a)'), undefined, 'a self-reference resolves to nothing');
  assert.equal(deckFontName('Brand Face'), 'Brand Face');

  // The old pattern took quadratic time on an unclosed var() padded with spaces: 16k
  // spaces cost ~110 ms there, and 64k some seconds. Linear, 256k is a few ms.
  const time = (n: number): number => {
    const s = 'var(--a,' + ' '.repeat(n);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) deckFontName(s);
    return (performance.now() - t0) / 5;
  };
  time(1000);
  const big = time(256_000);
  assert.ok(big < 100, `256k characters took ${big.toFixed(1)} ms`);
  const nested = 'var(--a, '.repeat(20_000) + 'x' + ')'.repeat(20_000);
  const t0 = performance.now();
  deckFontName(nested, () => undefined);
  assert.ok(performance.now() - t0 < 100, 'a deeply nested var() is bounded by the hop cap');
});
