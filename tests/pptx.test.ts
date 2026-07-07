/**
 * PPTX builder contract tests.
 * Run with: node --test tests/pptx.test.ts
 *
 * buildPptxParts returns the pre-zip OOXML part tree (path → bytes/string). These
 * assert the tree is complete and internally consistent — required parts, one
 * media/rels per slide, resolvable relationships, and correct DrawingML for the
 * three shape kinds (rect / text / pic incl. the SVG-blip vector embed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPptxParts } from '../engine/src/pptx.ts';
import type { PptxSlide } from '../engine/src/pptx.ts';

const bytes = new Uint8Array([1, 2, 3, 4]);
const picSlide = (): PptxSlide => ({ shapes: [{ kind: 'pic', x: 0, y: 0, cx: 100, cy: 100, media: 0 }], media: [{ bytes, ext: 'png' }] });

test('single-slide deck has the full required part tree', () => {
  const parts = buildPptxParts([picSlide()], {});
  for (const required of [
    '[Content_Types].xml', '_rels/.rels',
    'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
    'ppt/slideMasters/slideMaster1.xml', 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    'ppt/slideLayouts/slideLayout1.xml', 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    'ppt/theme/theme1.xml', 'docProps/core.xml', 'docProps/app.xml',
    'ppt/slides/slide1.xml', 'ppt/slides/_rels/slide1.xml.rels', 'ppt/media/image1_1.png',
  ]) {
    assert.ok(required in parts, `missing part ${required}`);
  }
  assert.ok(parts['ppt/media/image1_1.png'] instanceof Uint8Array, 'media is raw bytes');
});

test('N slides produce N slide/rels parts and N sldId entries; media names are per-slide', () => {
  const parts = buildPptxParts([picSlide(), picSlide(), picSlide()], {});
  for (const i of [1, 2, 3]) {
    assert.ok(`ppt/slides/slide${i}.xml` in parts);
    assert.ok(`ppt/slides/_rels/slide${i}.xml.rels` in parts);
    assert.ok(`ppt/media/image${i}_1.png` in parts, `media for slide ${i}`);
  }
  const pres = parts['ppt/presentation.xml'] as string;
  assert.equal([...pres.matchAll(/<p:sldId /g)].length, 3);
  assert.match(pres, /<p:sldId id="256" r:id="rId2"\/>/);
  assert.match(pres, /<p:sldId id="258" r:id="rId4"\/>/);
});

test('.rels use the package Relationships namespace, not a doubled/officeDocument one', () => {
  // Regression: the container xmlns must be .../package/2006/relationships. A wrong ns
  // makes every relationship fail to resolve → LibreOffice rejects, PowerPoint repairs.
  const parts = buildPptxParts([picSlide()], {});
  for (const [path, content] of Object.entries(parts)) {
    if (!path.endsWith('.rels')) continue;
    const xml = content as string;
    assert.match(xml, /<Relationships xmlns="http:\/\/schemas\.openxmlformats\.org\/package\/2006\/relationships">/, `${path} ns`);
    assert.doesNotMatch(xml, /relationships\/relationships/, `${path} doubled ns`);
  }
});

test('a pic shape embeds the raster and the slide rel points at it', () => {
  const parts = buildPptxParts([picSlide()], {});
  const slide = parts['ppt/slides/slide1.xml'] as string;
  const rels = parts['ppt/slides/_rels/slide1.xml.rels'] as string;
  assert.match(slide, /<a:blip r:embed="rId2"\/>/);
  assert.match(rels, /Id="rId2" Type="[^"]*\/image" Target="\.\.\/media\/image1_1\.png"/);
});

test('a VECTOR pic embeds a real SVG via svgBlip with a PNG fallback', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'pic', x: 0, y: 0, cx: 200, cy: 200, media: 0, svg: 1, name: 'logo' }],
    media: [{ bytes, ext: 'png' }, { bytes: new TextEncoder().encode('<svg/>'), ext: 'svg' }],
  };
  const parts = buildPptxParts([slide], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  // PNG fallback is the primary blip; the SVG rides in the ext extension.
  assert.match(xml, /<a:blip r:embed="rId2"><a:extLst><a:ext uri="\{96DAC541-7B7A-43D3-8B79-37D633B846F1\}">/);
  assert.match(xml, /<asvg:svgBlip [^>]*r:embed="rId3"\/>/);
  const ct = parts['[Content_Types].xml'] as string;
  assert.match(ct, /Extension="svg" ContentType="image\/svg\+xml"/);
  assert.ok('ppt/media/image1_2.svg' in parts, 'svg media written');
});

test('a text shape becomes an editable text box with sized/coloured runs', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 100, anchor: 'ctr',
      paras: [{ align: 'ctr', runs: [{ text: 'Hello & <world>', sizePt: 24, color: '#30BA78', bold: true, font: 'SUSE' }] }] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<p:sp><p:nvSpPr>.*txBox="1"/s);
  assert.match(xml, /sz="2400" b="1"/);
  assert.match(xml, /<a:srgbClr val="30BA78"\/>/);
  assert.match(xml, /<a:t>Hello &amp; &lt;world&gt;<\/a:t>/, 'text is XML-escaped');
  assert.match(xml, /typeface="SUSE"/);
});

test('a pic with srcRect crops the source (object-fit:cover) and keeps a full blip', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'pic', x: 0, y: 0, cx: 400, cy: 200, media: 0, srcRect: { l: 0.1, t: 0, r: 0.1, b: 0 } }],
    media: [{ bytes, ext: 'jpeg' }],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  // 10% each side → 10000 (1000ths of a percent); a plain stretch fill still follows.
  assert.match(xml, /<a:srcRect l="10000" t="0" r="10000" b="0"\/>/);
  assert.match(xml, /<a:srcRect[^>]*\/><a:stretch><a:fillRect\/><\/a:stretch>/);
});

test('a rect shape carries fill, border and rounded geometry', () => {
  const slide: PptxSlide = {
    shapes: [
      { kind: 'rect', x: 0, y: 0, cx: 100, cy: 100, fill: { solid: '#0C322C' }, line: { color: '#30BA78', w: 12700 }, radius: 20 },
      { kind: 'rect', x: 0, y: 0, cx: 100, cy: 100, fill: { grad: [{ pos: 0, color: '#fff' }, { pos: 1, color: '#000' }], angle: 90 } },
    ],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:prstGeom prst="roundRect">/);
  assert.match(xml, /<a:solidFill><a:srgbClr val="0C322C"\/><\/a:solidFill>/);
  assert.match(xml, /<a:ln w="12700">/);
  assert.match(xml, /<a:gradFill><a:gsLst>/);
  // CSS 90deg (to-right) → DrawingML ang 0.
  assert.match(xml, /<a:lin ang="0" scaled="1"\/>/);
});

test('empty slide list throws', () => {
  assert.throws(() => buildPptxParts([], {}), /at least one slide/);
});
