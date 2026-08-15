// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack — the IDML and Penpot readers (shells/web/src/views/idml-import.ts,
 * penpot-import.ts). Both openers take PRE-unzipped entries (path → bytes), so the
 * fixtures are tiny hand-built entry maps rather than real archives. IDML parses XML
 * with DOMParser, so a jsdom one is installed on the global for the node run.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { strToU8 } from 'fflate';
import { openIdmlFile } from '../shells/web/src/views/idml-import.ts';
import { openPenpotFile } from '../shells/web/src/views/penpot-import.ts';

// IDML uses `new DOMParser().parseFromString(xml, 'application/xml')`.
(globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM().window.DOMParser;

const ROOT = '00000000-0000-0000-0000-000000000000';
const NS = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging';
const entries = (m: Record<string, string | Uint8Array>): Record<string, Uint8Array> => {
  const out: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(m)) out[k] = typeof v === 'string' ? strToU8(v) : v;
  return out;
};
const PNG_16x9 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 16, 0, 0, 0, 9, 8, 6, 0, 0, 0,
]);
const geom = (a: string): string =>
  `<Properties><PathGeometry><GeometryPathType><PathPointArray>${a}</PathPointArray></GeometryPathType></PathGeometry></Properties>`;

const IDML = entries({
  'designmap.xml':
    `<?xml version="1.0"?><idPkg:Package xmlns:idPkg="${NS}">` +
    `<idPkg:Graphic src="Resources/Graphic.xml"/><idPkg:Fonts src="Resources/Fonts.xml"/>` +
    `<idPkg:Story src="Stories/Story_u1.xml"/><idPkg:Spread src="Spreads/Spread_1.xml"/></idPkg:Package>`,
  'Resources/Graphic.xml':
    `<idPkg:Graphic xmlns:idPkg="${NS}"><Color Self="Color/c1" Space="RGB" ColorValue="48 186 120"/></idPkg:Graphic>`,
  'Resources/Fonts.xml':
    `<idPkg:Fonts xmlns:idPkg="${NS}"><FontFamily Name="Inter"><Font Self="f1" FontFamily="Inter"/></FontFamily></idPkg:Fonts>`,
  'Stories/Story_u1.xml':
    `<idPkg:Story xmlns:idPkg="${NS}"><Story Self="Story_u1"><ParagraphStyleRange Justification="LeftAlign">` +
    `<CharacterStyleRange PointSize="24" FillColor="Color/c1" FontStyle="Bold"><AppliedFont>Inter</AppliedFont>` +
    `<Content>Hello world</Content></CharacterStyleRange></ParagraphStyleRange></Story></idPkg:Story>`,
  'Spreads/Spread_1.xml':
    `<idPkg:Spread xmlns:idPkg="${NS}"><Spread Self="s1">` +
    `<TextFrame Self="tf1" ParentStory="Story_u1" ItemTransform="1 0 0 1 0 0">${geom('<PathPointType Anchor="0 0"/><PathPointType Anchor="200 0"/><PathPointType Anchor="200 50"/><PathPointType Anchor="0 50"/>')}</TextFrame>` +
    `<Rectangle Self="r1" FillColor="Color/c1" ItemTransform="1 0 0 1 0 60">${geom('<PathPointType Anchor="0 0"/><PathPointType Anchor="100 0"/><PathPointType Anchor="100 40"/><PathPointType Anchor="0 40"/>')}</Rectangle>` +
    `<Rectangle Self="r2" ItemTransform="1 0 0 1 0 120">${geom('<PathPointType Anchor="0 0"/><PathPointType Anchor="80 0"/><PathPointType Anchor="80 60"/><PathPointType Anchor="0 60"/>')}` +
    `<Image Self="img1"><Link LinkResourceURI="file:///photo.png"/></Image></Rectangle>` +
    `</Spread></idPkg:Spread>`,
});

test('IDML: one page per spread, story text in order, bold and size read', async () => {
  const h = await openIdmlFile(IDML);
  assert.equal(h.pageCount, 1);
  const pt = h.pageToText!(0);
  assert.equal(pt.blocks[0]!.text, 'Hello world');
  assert.equal(pt.blocks[0]!.bold, true);
  assert.equal(pt.blocks[0]!.size, 24);
  assert.ok(pt.text.includes('Hello world'));
});

test('IDML: swatches become the palette', async () => {
  const h = await openIdmlFile(IDML);
  assert.ok(h.listPalette!().includes('#30ba78'), 'the RGB swatch is in the palette');
});

test('IDML: fonts are referenced, not embedded (names-only rows)', async () => {
  const h = await openIdmlFile(IDML);
  const fonts = h.listFonts!();
  const inter = fonts.find((f) => f.family === 'Inter')!;
  assert.ok(inter, 'Inter should be listed');
  assert.equal(inter.installable, false);
  assert.equal(inter.bytes.length, 0, 'a referenced font carries no bytes');
});

test('IDML: linked images are counted, never fetched', async () => {
  const h = await openIdmlFile(IDML);
  const scan = await h.listImages!();
  assert.equal(scan.images.length, 0);
  assert.equal(scan.skipped, 1);
});

test('IDML: pageToSvg renders a recognisable spread preview', async () => {
  const h = await openIdmlFile(IDML);
  const svg = await h.pageToSvg(0);
  assert.ok(svg.svg.startsWith('<svg'));
  assert.ok(svg.svg.includes('Hello world'), 'text frame rendered');
  assert.ok(svg.svg.includes('#30ba78'), 'the filled rectangle rendered');
});

const PENPOT = entries({
  'manifest.json': JSON.stringify({ files: [{ id: 'f1' }] }),
  'files/f1/pages/p1.json': JSON.stringify({ index: 0 }),
  [`files/f1/pages/p1/${ROOT}.json`]: JSON.stringify({ id: ROOT, type: 'frame', shapes: ['s1', 's2', 'g1', 's4'] }),
  'files/f1/pages/p1/s1.json': JSON.stringify({
    id: 's1', type: 'text', selrect: { x: 0, y: 0, width: 200, height: 40 },
    fills: [{ fillColor: '#123456' }],
    content: { children: [{ type: 'paragraph', children: [{ text: 'Hello penpot', fontId: 'gfont-work-sans', fontFamily: 'Work Sans', fontWeight: '400' }] }] },
  }),
  'files/f1/pages/p1/s2.json': JSON.stringify({ id: 's2', type: 'rect', fills: [{ fillColor: '#30ba78' }], selrect: { x: 0, y: 50, width: 100, height: 50 } }),
  'files/f1/pages/p1/g1.json': JSON.stringify({ id: 'g1', type: 'group', shapes: ['s3'], selrect: { x: 0, y: 120, width: 60, height: 60 } }),
  'files/f1/pages/p1/s3.json': JSON.stringify({ id: 's3', type: 'rect', fills: [{ fillColor: '#e2231a' }], selrect: { x: 0, y: 120, width: 60, height: 60 } }),
  'files/f1/pages/p1/s4.json': JSON.stringify({ id: 's4', type: 'rect', fills: [{ fillImage: { id: 'm1' } }], selrect: { x: 100, y: 120, width: 80, height: 80 } }),
  'files/f1/media/m1.json': JSON.stringify({ mediaId: 'obj1', mtype: 'image/png' }),
  'objects/obj1.png': PNG_16x9,
});

test('Penpot: text shapes give their content, in order', async () => {
  const h = await openPenpotFile(PENPOT);
  assert.equal(h.pageCount, 1);
  const pt = h.pageToText!(0);
  assert.ok(pt.text.includes('Hello penpot'), `got: ${pt.text}`);
});

test('Penpot: fills and text colours across the file become the palette', async () => {
  const h = await openPenpotFile(PENPOT);
  const pal = h.listPalette!();
  for (const c of ['#123456', '#30ba78', '#e2231a']) {
    assert.ok(pal.includes(c), `palette should include ${c}, got ${pal.join(', ')}`);
  }
});

test('Penpot: named font families come back names-only', async () => {
  const h = await openPenpotFile(PENPOT);
  const fonts = h.listFonts!();
  const ws = fonts.find((f) => f.family === 'Work Sans')!;
  assert.ok(ws, 'Work Sans should be listed');
  assert.equal(ws.installable, false);
  assert.equal(ws.bytes.length, 0);
});

test('Penpot: embedded media round-trips its bytes', async () => {
  const h = await openPenpotFile(PENPOT);
  const scan = await h.listImages!();
  assert.equal(scan.images.length, 1);
  assert.equal(scan.images[0]!.mime, 'image/png');
  assert.deepEqual([...scan.images[0]!.bytes], [...PNG_16x9]);
  assert.equal(scan.images[0]!.width, 16);
  assert.equal(scan.images[0]!.height, 9);
});

test('Penpot: a group becomes a standalone vector', async () => {
  const h = await openPenpotFile(PENPOT);
  const vecs = await h.listVectors!();
  assert.ok(vecs.length >= 1, 'the group should yield a vector');
  const g = vecs[0]!;
  assert.ok(g.svg.startsWith('<svg'));
  assert.ok(g.fills.includes('#e2231a'), `group fills: ${g.fills.join(', ')}`);
});
