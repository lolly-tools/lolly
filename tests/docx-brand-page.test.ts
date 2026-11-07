// SPDX-License-Identifier: MPL-2.0
/**
 * The page, the styles and the pictures of a Word document Lolly writes.
 *
 * Doc Studio's .docx used to be US Letter whatever size was chosen, name no face and no
 * colour, and carry an SVG logo with no PNG beside it, so a reader with no SVG support
 * showed nothing. These cases pin the XML each fix writes: the page size and margins in
 * `w:sectPr`, the faces and text colours as styles (document defaults plus Heading 1 to
 * 6, never per-run overrides), and an SVG picture as a PNG blip with the SVG through the
 * `asvg:svgBlip` extension, the way Word writes one. The web half reads those values off
 * the rendered page; its pure parts are checked here against a JSDOM page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { snapDocxPage, writeDocx, type DocxDoc } from '../engine/src/docx.ts';
import { readZip } from '../engine/src/zip.ts';
import { packPng } from '../engine/src/png.ts';

const decoder = new TextDecoder('utf-8');
const part = (bytes: Uint8Array, name: string): string => {
  const e = readZip(bytes).find((x) => x.name === name);
  assert.ok(e, `the package holds ${name}`);
  return decoder.decode(e!.bytes);
};
const has = (bytes: Uint8Array, name: string): boolean => readZip(bytes).some((x) => x.name === name);

const PAGE: DocxDoc['blocks'] = [
  { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Riverside Garden Day' }] },
  { type: 'para', inlines: [{ type: 'text', text: 'Seedlings, compost and lunch under the trees.' }] },
  { type: 'heading', level: 2, inlines: [{ type: 'text', text: 'What to bring' }] },
  { type: 'list', ordered: false, items: [{ level: 0, inlines: [{ type: 'text', text: 'A hat' }] }] },
];

// ── the page ──────────────────────────────────────────────────────────────────

test('snapDocxPage names A4, Letter and A5 exactly from a page laid out in whole pixels', () => {
  // Doc Studio lays a page out at 96 px to the inch: 15 twips to the pixel.
  assert.deepEqual(snapDocxPage(794 * 15, 1123 * 15), { width: 11906, height: 16838 }, 'A4');
  assert.deepEqual(snapDocxPage(816 * 15, 1054 * 15), { width: 12240, height: 15840 }, 'US Letter, from 216 x 279 mm');
  assert.deepEqual(snapDocxPage(559 * 15, 794 * 15), { width: 8391, height: 11906 }, 'A5');
  assert.deepEqual(snapDocxPage(1123 * 15, 794 * 15), { width: 16838, height: 11906 }, 'A4 landscape keeps its orientation');
  assert.deepEqual(snapDocxPage(10000, 10000), { width: 10000, height: 10000 }, 'a size that is no paper size stays as measured');
});

test('an A4 page writes the A4 pgSz and the margins it was laid out with', () => {
  const xml = part(writeDocx({
    blocks: PAGE,
    page: { width: 11906, height: 16838, margin: { top: 1260, right: 1013, bottom: 1770, left: 1013 } },
  }), 'word/document.xml');
  assert.match(xml, /<w:sectPr><w:pgSz w:w="11906" w:h="16838"\/><w:pgMar w:top="1260" w:right="1013" w:bottom="1770" w:left="1013" w:header="720" w:footer="720" w:gutter="0"\/><\/w:sectPr>/);
});

test('a landscape page says so, and a hostile page is held to Word\'s range', () => {
  const wide = part(writeDocx({ blocks: PAGE, page: { width: 16838, height: 11906 } }), 'word/document.xml');
  assert.match(wide, /<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"\/>/);
  const odd = part(writeDocx({
    blocks: PAGE,
    page: { width: Number.NaN, height: 1e9, margin: { top: -5, right: 1e9, bottom: Number.POSITIVE_INFINITY, left: 1e9 } },
  }), 'word/document.xml');
  const m = /<w:pgSz w:w="(\d+)" w:h="(\d+)"\/><w:pgMar w:top="(\d+)" w:right="(\d+)" w:bottom="(\d+)" w:left="(\d+)"/.exec(odd);
  assert.ok(m, 'every value is a whole number');
  const [w, h, top, right, bottom, left] = m!.slice(1).map(Number) as [number, number, number, number, number, number];
  assert.equal(w, 12240, 'a width that is not a number keeps Letter');
  assert.equal(h, 31680, 'a height past 22 inches is cut to 22 inches');
  assert.ok(w - left - right >= 720 && h - top - bottom >= 720, 'the margins always leave room for text');
});

test('a document with no page and no styles is exactly what the writer always wrote', () => {
  const bytes = writeDocx({ blocks: PAGE });
  assert.match(part(bytes, 'word/document.xml'),
    /<w:sectPr><w:pgSz w:w="12240" w:h="15840"\/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"\/><\/w:sectPr>/);
  const styles = part(bytes, 'word/styles.xml');
  assert.doesNotMatch(styles, /w:rFonts|w:color/, 'no face and no colour unless the caller names them');
  assert.match(styles, /<w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="22"\/><w:szCs w:val="22"\/><\/w:rPr><\/w:rPrDefault>/);
});

// ── the styles ────────────────────────────────────────────────────────────────

test('the faces and text colours are styles: document defaults plus Heading 1 and 2', () => {
  const bytes = writeDocx({
    blocks: PAGE,
    styles: { bodyFont: 'SUSE', headingFont: 'Outfit', textColor: '#09141a', headingColor: '#09141a' },
  });
  const styles = part(bytes, 'word/styles.xml');
  assert.match(styles,
    /<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="SUSE" w:hAnsi="SUSE" w:eastAsia="SUSE" w:cs="SUSE"\/><w:color w:val="09141A"\/><w:sz w:val="22"\/>/,
    'the body face and text colour are the document defaults');
  for (const level of [1, 2]) {
    assert.match(styles, new RegExp(
      `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/>` +
      `.*?<w:rPr><w:rFonts w:ascii="Outfit" w:hAnsi="Outfit" w:eastAsia="Outfit" w:cs="Outfit"/><w:b/><w:color w:val="09141A"/>`),
    `Heading ${level} names the headings face and colour`);
  }
  const doc = part(bytes, 'word/document.xml');
  assert.doesNotMatch(doc, /w:rFonts|w:color/, 'no run overrides a style');
  assert.match(doc, /<w:pStyle w:val="Heading1"\/>/, 'the title stays a real Heading 1');
  assert.match(doc, /<w:pStyle w:val="Heading2"\/>/, 'a section stays a real Heading 2');
  assert.match(doc, /<w:numPr><w:ilvl w:val="0"\/><w:numId w:val="1"\/><\/w:numPr>/, 'the list stays a real list');
});

test('a family or colour that is not a plain value is left out, never written into the XML', () => {
  const styles = part(writeDocx({
    blocks: PAGE,
    styles: { bodyFont: 'Evil"/><w:b/><x a="', headingFont: '', textColor: 'red', headingColor: '#12345' },
  }), 'word/styles.xml');
  assert.doesNotMatch(styles, /w:rFonts|w:color|Evil/);
});

// ── the pictures ──────────────────────────────────────────────────────────────

const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 20"><path d="M0 0h44v20H0z"/></svg>');
const PNG = packPng(new Uint8Array(4 * 4 * 4).fill(200), { width: 4, height: 4 });

test('an SVG with a PNG of the same artwork is written as Word writes it: PNG blip, SVG through svgBlip', () => {
  const bytes = writeDocx({
    blocks: [{ type: 'image', ref: 'image1.svg', alt: 'Lolly' }, ...PAGE],
    media: [{ name: 'image1.svg', bytes: SVG, width: 119, height: 52, fallback: PNG }],
  });
  const doc = part(bytes, 'word/document.xml');
  assert.match(doc,
    /<a:blip r:embed="(rId\d+)"><a:extLst><a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}"><asvg:svgBlip xmlns:asvg="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2016\/SVG\/main" r:embed="(rId\d+)"\/><\/a:ext><\/a:extLst><\/a:blip>/);
  const [, pngRid, svgRid] = /<a:blip r:embed="(rId\d+)">.*?r:embed="(rId\d+)"/.exec(doc)!;
  const rels = part(bytes, 'word/_rels/document.xml.rels');
  assert.match(rels, new RegExp(`Id="${pngRid}" Type="[^"]+/image" Target="media/image1\\.png"`), 'the blip is the PNG');
  assert.match(rels, new RegExp(`Id="${svgRid}" Type="[^"]+/image" Target="media/image2\\.svg"`), 'the extension is the SVG');
  assert.ok(has(bytes, 'word/media/image1.png') && has(bytes, 'word/media/image2.svg'));
  const types = part(bytes, '[Content_Types].xml');
  assert.match(types, /<Default Extension="png" ContentType="image\/png"\/>/);
  assert.match(types, /<Default Extension="svg" ContentType="image\/svg\+xml"\/>/);
  // The picture shows at its laid-out size, not at the PNG's print resolution.
  assert.match(doc, /<wp:extent cx="1133475" cy="495300"\/>/);
});

test('an SVG with no PNG keeps its one part, and a fallback that is not a PNG is ignored', () => {
  for (const fallback of [undefined, SVG]) {
    const bytes = writeDocx({
      blocks: [{ type: 'image', ref: 'image1.svg', alt: '' }],
      media: [{ name: 'image1.svg', bytes: SVG, width: 119, height: 52, ...(fallback ? { fallback } : {}) }],
    });
    assert.match(part(bytes, 'word/document.xml'), /<a:blip r:embed="rId\d+"\/>/);
    assert.ok(!has(bytes, 'word/media/image1.png'));
  }
});

test('a picture is scaled to the A4 text width, not the Letter one', () => {
  const page = { width: 11906, height: 16838, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } };
  const doc = part(writeDocx({
    blocks: [{ type: 'image', ref: 'wide.png', alt: '' }],
    media: [{ name: 'wide.png', bytes: PNG, width: 2000, height: 1000 }],
    page,
  }), 'word/document.xml');
  const cx = Number(/<wp:extent cx="(\d+)"/.exec(doc)![1]);
  assert.equal(cx, (11906 - 2880) * 635, 'A4 less two one-inch margins');
});

// ── the web half: what it reads off the rendered page ────────────────────────

async function withPage<T>(html: string, fn: (doc: Document) => Promise<T> | T): Promise<T> {
  const dom = new JSDOM(`<!doctype html><html><body><div id="tool-canvas">${html}</div></body></html>`);
  const g = globalThis as { window?: unknown; document?: unknown; getComputedStyle?: unknown };
  const before = { window: g.window, document: g.document, getComputedStyle: g.getComputedStyle };
  g.window = dom.window;
  g.document = dom.window.document;
  g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  try { return await fn(dom.window.document); } finally {
    g.window = before.window; g.document = before.document; g.getComputedStyle = before.getComputedStyle;
  }
}

/** A JSDOM page has no layout, so each box states the size Doc Studio lays out at. */
function lay(el: Element, box: { x: number; y: number; w: number; h: number }): void {
  Object.defineProperty(el, 'offsetWidth', { value: box.w, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: box.h, configurable: true });
  (el as HTMLElement).getBoundingClientRect = () => ({
    x: box.x, y: box.y, left: box.x, top: box.y, width: box.w, height: box.h,
    right: box.x + box.w, bottom: box.y + box.h, toJSON: () => ({}),
  }) as DOMRect;
}

const DOC_HTML = `<div class="doc" style="font-family: 'SUSE', system-ui, sans-serif">
  <div class="doc-page" data-pdf-page><div class="doc-body"><h1 class="doc-h doc-h1">Title</h1></div></div></div>`;

test('the web export reads an A4 page and its margins off the laid-out page, at any stage scale', async () => {
  const { docxPageOf } = await import('../shells/web/src/bridge/export-docx.ts');
  await withPage(DOC_HTML, (doc) => {
    // A4 at 96 px: 794 x 1123, margins 8.5% across and 7.5% down plus the footer band.
    const page = doc.querySelector('.doc-page')!, body = doc.querySelector('.doc-body')!;
    lay(page, { x: 0, y: 0, w: 794, h: 1123 });
    lay(body, { x: 67, y: 84, w: 660, h: 1123 - 84 - 118 });
    assert.deepEqual(docxPageOf(doc.querySelector('.doc')!), {
      width: 11906, height: 16838, margin: { top: 1259, right: 1005, bottom: 1769, left: 1005 },
    });
    // The export stage drew it at half size: the margins are a share of the page.
    lay(page, { x: 10, y: 10, w: 397, h: 561.5 });
    Object.defineProperty(page, 'offsetWidth', { value: 794, configurable: true });
    Object.defineProperty(page, 'offsetHeight', { value: 1123, configurable: true });
    (body as HTMLElement).getBoundingClientRect = () => ({ left: 43.5, top: 52, right: 373.5, bottom: 512.5, width: 330, height: 460.5 }) as DOMRect;
    assert.deepEqual(docxPageOf(doc.querySelector('.doc')!)?.margin, { top: 1259, right: 1005, bottom: 1769, left: 1005 });
  });
});

test('a physical export size wins, and US Letter and A5 come out exactly', async () => {
  const { docxPageOf } = await import('../shells/web/src/bridge/export-docx.ts');
  await withPage(DOC_HTML, (doc) => {
    lay(doc.querySelector('.doc-page')!, { x: 0, y: 0, w: 816, h: 1054 });
    const node = doc.querySelector('.doc')!;
    assert.deepEqual({ ...docxPageOf(node), margin: undefined }, { width: 12240, height: 15840, margin: undefined }, 'Letter from the page box');
    const a5 = docxPageOf(node, { width: 148, height: 210, unit: 'mm' } as never);
    assert.deepEqual([a5?.width, a5?.height], [8391, 11906], 'A5 from the size the export states');
  });
  await withPage('<p>Not a paged document</p>', (doc) => {
    const { docxPageOf: of } = { docxPageOf };
    assert.equal(of(doc.body), undefined, 'a node with no page keeps the writer\'s own page');
  });
});

test('the styles are the document face, the headings face and the design system text colour', async () => {
  const { docxStylesOf } = await import('../shells/web/src/bridge/export-docx.ts');
  await withPage(DOC_HTML, (doc) => {
    const canvas = doc.getElementById('tool-canvas')!;
    canvas.style.setProperty('--font-brand', "'SUSE', ui-sans-serif, system-ui, sans-serif");
    canvas.style.setProperty('--font-display', "'Outfit', 'SUSE', sans-serif");
    canvas.style.setProperty('--brand-text', '#09141a');
    const node = doc.querySelector('.doc')!;
    assert.deepEqual(docxStylesOf(node), { bodyFont: 'SUSE', headingFont: 'Outfit', textColor: '#09141a', headingColor: '#09141a' });
    // The person set the document in the mono face: the body follows them.
    (node as HTMLElement).style.fontFamily = "'SUSE Mono', ui-monospace, monospace";
    assert.equal(docxStylesOf(node)?.bodyFont, 'SUSE Mono');
    // A design system with no headings face: headings take the body face.
    canvas.style.removeProperty('--font-display');
    assert.equal(docxStylesOf(node)?.headingFont, 'SUSE Mono');
    // A text colour that would not read on Word's white page is left to Word.
    canvas.style.setProperty('--brand-text', '#f3f7f5');
    assert.equal(docxStylesOf(node)?.textColor, undefined);
  });
});
