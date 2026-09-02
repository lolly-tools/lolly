// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/pptx-read.ts - the .pptx PARSE spike (plan track E1).
 *
 * The fixtures are hand-written OOXML: a real-shaped presentation.xml +
 * theme1.xml + slide1.xml (+ rels + notesSlide) as an in-memory part map, which
 * is exactly the contract - the CALLER inflates the zip, we read the part map.
 * The injected `parseXml` adapter is built from the jsdom already in devDeps
 * (the web shell passes the native DOMParser instead); the engine itself imports
 * no DOM library.
 *
 * Coverage here is the common case + the hardening regime (hostile/malformed
 * input must never throw). Placeholder/layout/master inheritance is DEFERRED in
 * the module and therefore not asserted.
 *
 * Run with: node --test tests/pptx-read.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { isPptx, readPptx } from '../engine/src/pptx-read.ts';
import { readingOrder } from '../engine/src/pptx-read.ts';
import type { PptxParts, PptxReadNode, PptxTextNode, PptxShapeNode, PptxPicNode, PptxTableNode } from '../engine/src/pptx-read.ts';

// ─── the injected parser (jsdom stands in for the shell's native DOMParser) ───

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

// ─── fixtures ────────────────────────────────────────────────────────────────

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const PRESENTATION = `${XML_DECL}
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;

const PRESENTATION_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="${NS_R}/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="${NS_R}/theme" Target="theme/theme1.xml"/>
</Relationships>`;

const THEME = `${XML_DECL}
<a:theme xmlns:a="${NS_A}" name="TestTheme">
  <a:themeElements>
    <a:clrScheme name="TestColors">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="TestFonts">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="TestFmt">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

// spTree carries, in order: a text box (run in accent1), a rect (literal srgbClr
// fill + a tx1 scheme line), a picture, a table, and a grouped ellipse.
const SLIDE1 = `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm rot="5400000"><a:off x="838200" y="365125"/><a:ext cx="2743200" cy="1143000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1800" b="1" dirty="0">
                <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
                <a:latin typeface="Calibri"/>
              </a:rPr>
              <a:t>Hello</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Rectangle 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="4000000" y="2000000"/><a:ext cx="1000000" cy="500000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
          <a:ln w="12700"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>

      <p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Picture 3"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="100" y="200"/><a:ext cx="300" cy="400"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="5" name="Table 4"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="500000" y="3000000"/><a:ext cx="2000000" cy="800000"/></p:xfrm>
        <a:graphic><a:graphicData uri="${NS_A}/table">
          <a:tbl>
            <a:tblPr firstRow="1"/><a:tblGrid><a:gridCol w="1000000"/><a:gridCol w="1000000"/></a:tblGrid>
            <a:tr h="400000">
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>A1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>B1</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
            </a:tr>
            <a:tr h="400000">
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>A2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
              <a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>B2</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>
            </a:tr>
          </a:tbl>
        </a:graphicData></a:graphic>
      </p:graphicFrame>

      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="6" name="Group 5"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/><a:chOff x="0" y="0"/><a:chExt cx="100" cy="100"/></a:xfrm></p:grpSpPr>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="7" name="Grouped Oval"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr>
            <a:xfrm><a:off x="10" y="20"/><a:ext cx="30" cy="40"/></a:xfrm>
            <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
            <a:solidFill><a:schemeClr val="accent2"/></a:solidFill>
          </p:spPr>
        </p:sp>
      </p:grpSp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

const SLIDE1_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/notesSlide" Target="../notesSlides/notesSlide1.xml"/>
  <Relationship Id="rId2" Type="${NS_R}/image" Target="../media/image1.png"/>
</Relationships>`;

const NOTES1 = `${XML_DECL}
<p:notes xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr/><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Speaker note here</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Slide Number Placeholder 3"/><p:cNvSpPr/><p:nvPr><p:ph type="sldNum" sz="quarter" idx="10"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:fld id="{4B2}" type="slidenum"><a:rPr lang="en-US"/><a:t>1</a:t></a:fld></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;

function deckParts(overrides: PptxParts = {}): PptxParts {
  return {
    'ppt/presentation.xml': PRESENTATION,
    'ppt/_rels/presentation.xml.rels': PRESENTATION_RELS,
    // Bytes, not text - proves the Uint8Array decode path.
    'ppt/theme/theme1.xml': new TextEncoder().encode(THEME),
    'ppt/slides/slide1.xml': SLIDE1,
    'ppt/slides/_rels/slide1.xml.rels': SLIDE1_RELS,
    'ppt/notesSlides/notesSlide1.xml': NOTES1,
    'ppt/media/image1.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    ...overrides,
  };
}

const byType = <T extends PptxReadNode['type']>(nodes: PptxReadNode[], t: T): Extract<PptxReadNode, { type: T }>[] =>
  nodes.filter((n) => n.type === t) as Extract<PptxReadNode, { type: T }>[];

// ─── isPptx ──────────────────────────────────────────────────────────────────

test('isPptx detects a deck by ppt/presentation.xml', () => {
  assert.equal(isPptx(deckParts()), true);
  assert.equal(isPptx({ 'ppt/presentation.xml': new TextEncoder().encode(PRESENTATION) }), true);
});

test('isPptx rejects non-decks, empty parts, and junk', () => {
  assert.equal(isPptx({}), false);
  assert.equal(isPptx({ 'word/document.xml': '<w:document/>' }), false);
  // present-but-empty is not a deck
  assert.equal(isPptx({ 'ppt/presentation.xml': '' }), false);
  assert.equal(isPptx({ 'ppt/presentation.xml': new Uint8Array(0) }), false);
  assert.equal(isPptx(null as unknown as PptxParts), false);
  assert.equal(isPptx(undefined as unknown as PptxParts), false);
});

// ─── deck-level reads ────────────────────────────────────────────────────────

test('readPptx reads the slide size from p:sldSz', () => {
  const deck = readPptx(deckParts(), parseXml);
  assert.equal(deck.widthEmu, 9144000);
  assert.equal(deck.heightEmu, 6858000);
});

test('readPptx reads the theme colours (incl. sysClr lastClr) and fonts', () => {
  const deck = readPptx(deckParts(), parseXml);
  assert.equal(deck.theme.colors.accent1, '4472C4');
  assert.equal(deck.theme.colors.accent2, 'ED7D31');
  assert.equal(deck.theme.colors.accent6, '70AD47');
  // dk1/lt1 arrive as sysClr - the lastClr attribute is the readable value.
  assert.equal(deck.theme.colors.dk1, '000000');
  assert.equal(deck.theme.colors.lt1, 'FFFFFF');
  assert.equal(deck.theme.colors.dk2, '44546A');
  assert.equal(deck.theme.colors.hlink, '0563C1');
  assert.equal(deck.theme.majorFont, 'Calibri Light');
  assert.equal(deck.theme.minorFont, 'Calibri');
});

test('readPptx yields one slide with the expected node sequence', () => {
  const deck = readPptx(deckParts(), parseXml);
  assert.equal(deck.slides.length, 1);
  const slide = deck.slides[0]!;
  assert.equal(slide.index, 0);
  // text box, rect, picture, table, grouped ellipse (group metadata is not a node)
  assert.deepEqual(
    slide.nodes.map((n) => n.type),
    ['text', 'shape', 'pic', 'table', 'shape'],
  );
});

// ─── text node + run provenance (the headline assertion) ─────────────────────

test('a text box reads its geometry, rotation, and run styling', () => {
  const deck = readPptx(deckParts(), parseXml);
  const text = byType(deck.slides[0]!.nodes, 'text')[0] as PptxTextNode;
  assert.ok(text);
  assert.equal(text.xEmu, 838200);
  assert.equal(text.yEmu, 365125);
  assert.equal(text.cxEmu, 2743200);
  assert.equal(text.cyEmu, 1143000);
  assert.equal(text.rot, 90); // 5400000 / 60000
  assert.equal(text.geom, 'rect');

  assert.equal(text.paras.length, 1);
  const run = text.paras[0]!.runs[0]!;
  assert.equal(run.text, 'Hello');
  assert.equal(run.bold, true);
  assert.equal(run.sizePt, 18); // sz=1800 → hundredths of a point
  assert.equal(run.font, 'Calibri');
  assert.equal(run.italic, undefined);
});

test('a schemeClr run keeps its accent1 PROVENANCE and resolves through the theme', () => {
  const deck = readPptx(deckParts(), parseXml);
  const text = byType(deck.slides[0]!.nodes, 'text')[0] as PptxTextNode;
  const color = text.paras[0]!.runs[0]!.color;
  assert.ok(color, 'run carries a colour');
  // This is the whole point: "this run WAS accent1" survives the read.
  assert.ok('scheme' in color, 'scheme provenance is preserved, not flattened to a hex');
  assert.equal(color.scheme, 'accent1');
  assert.equal(color.hex, '4472C4'); // resolved through the theme
});

// ─── shape node + literal-vs-scheme fill ─────────────────────────────────────

test('a rect reads prstGeom + a LITERAL srgbClr fill (no scheme provenance)', () => {
  const deck = readPptx(deckParts(), parseXml);
  const rect = byType(deck.slides[0]!.nodes, 'shape')[0] as PptxShapeNode;
  assert.equal(rect.geom, 'rect');
  assert.equal(rect.xEmu, 4000000);
  assert.equal(rect.yEmu, 2000000);
  assert.equal(rect.cxEmu, 1000000);
  assert.equal(rect.cyEmu, 500000);
  const fill = rect.fill;
  assert.ok(fill);
  assert.equal('scheme' in fill, false, 'a literal fill must NOT claim scheme provenance');
  assert.equal(fill.hex, 'FF0000');
});

test('a shape line resolves a tx1 schemeClr through the DEFAULT clrMap (tx1 → dk1)', () => {
  const deck = readPptx(deckParts(), parseXml);
  const rect = byType(deck.slides[0]!.nodes, 'shape')[0] as PptxShapeNode;
  const line = rect.line;
  assert.ok(line);
  assert.ok('scheme' in line);
  assert.equal(line.scheme, 'tx1'); // the authored slot survives verbatim
  assert.equal(line.hex, '000000'); // tx1 maps to dk1 under the default clrMap
});

test('a shape with an empty txBody stays a shape (not an empty text node)', () => {
  const deck = readPptx(deckParts(), parseXml);
  // The rect's txBody holds only an endParaRPr - real PowerPoint output.
  const shapes = byType(deck.slides[0]!.nodes, 'shape');
  assert.equal(shapes.length, 2);
  assert.equal(byType(deck.slides[0]!.nodes, 'text').length, 1);
});

// ─── picture / table / groups ────────────────────────────────────────────────

test('a picture resolves its r:embed rel to the media part path', () => {
  const deck = readPptx(deckParts(), parseXml);
  const pic = byType(deck.slides[0]!.nodes, 'pic')[0] as PptxPicNode;
  assert.equal(pic.embed, 'rId2');
  // "../media/image1.png" relative to ppt/slides → ppt/media/image1.png
  assert.equal(pic.media, 'ppt/media/image1.png');
  assert.equal(pic.xEmu, 100);
  assert.equal(pic.cyEmu, 400);
});

test('a table reads its cell text row-major, with the graphicFrame p:xfrm geometry', () => {
  const deck = readPptx(deckParts(), parseXml);
  const table = byType(deck.slides[0]!.nodes, 'table')[0] as PptxTableNode;
  assert.deepEqual(table.rows, [
    ['A1', 'B1'],
    ['A2', 'B2'],
  ]);
  assert.equal(table.xEmu, 500000);
  assert.equal(table.yEmu, 3000000);
  assert.equal(table.cxEmu, 2000000);
});

test('grouped shapes are flattened (group child-offset transform is deferred)', () => {
  const deck = readPptx(deckParts(), parseXml);
  const ellipse = byType(deck.slides[0]!.nodes, 'shape')[1] as PptxShapeNode;
  assert.equal(ellipse.geom, 'ellipse');
  const fill = ellipse.fill;
  assert.ok(fill && 'scheme' in fill);
  assert.equal(fill.scheme, 'accent2');
  assert.equal(fill.hex, 'ED7D31');
  // DEFERRED: chOff/chExt is not composed - the child keeps its authored xfrm.
  assert.equal(ellipse.xEmu, 10);
  assert.equal(ellipse.yEmu, 20);
});

// ─── notes ───────────────────────────────────────────────────────────────────

test('speaker notes read from the body placeholder, ignoring the slide-number field', () => {
  const deck = readPptx(deckParts(), parseXml);
  assert.equal(deck.slides[0]!.notes, 'Speaker note here');
});

test('a slide with no notes rel has no notes', () => {
  const parts = deckParts();
  delete parts['ppt/notesSlides/notesSlide1.xml'];
  parts['ppt/slides/_rels/slide1.xml.rels'] = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId2" Type="${NS_R}/image" Target="../media/image1.png"/>
</Relationships>`;
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides[0]!.notes, undefined);
});

// ─── slide ordering ──────────────────────────────────────────────────────────

test('slide order follows p:sldIdLst rels, not the part filename', () => {
  // sldIdLst lists slide2 FIRST - a reader that sorts filenames gets this wrong.
  const twoSlides: PptxParts = {
    'ppt/presentation.xml': `${XML_DECL}
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:sldIdLst><p:sldId id="257" r:id="rIdB"/><p:sldId id="256" r:id="rIdA"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rIdA" Type="${NS_R}/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rIdB" Type="${NS_R}/slide" Target="slides/slide2.xml"/>
</Relationships>`,
    'ppt/slides/slide1.xml': oneTextSlide('First'),
    'ppt/slides/slide2.xml': oneTextSlide('Second'),
  };
  const deck = readPptx(twoSlides, parseXml);
  assert.equal(deck.slides.length, 2);
  assert.equal(firstText(deck.slides[0]!.nodes), 'Second');
  assert.equal(firstText(deck.slides[1]!.nodes), 'First');
});

test('a deck with no sldIdLst falls back to numeric slide-part order', () => {
  const parts: PptxParts = {
    'ppt/presentation.xml': `${XML_DECL}<p:presentation xmlns:p="${NS_P}"><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
    'ppt/slides/slide2.xml': oneTextSlide('Second'),
    'ppt/slides/slide10.xml': oneTextSlide('Tenth'),
    'ppt/slides/slide1.xml': oneTextSlide('First'),
  };
  const deck = readPptx(parts, parseXml);
  // numeric, not lexicographic (slide10 must not sort before slide2)
  assert.deepEqual(deck.slides.map((s) => firstText(s.nodes)), ['First', 'Second', 'Tenth']);
});

function oneTextSlide(text: string): string {
  return `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${text}</a:t></a:r></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`;
}

function firstText(nodes: PptxReadNode[]): string | undefined {
  const t = byType(nodes, 'text')[0];
  return t?.paras[0]?.runs[0]?.text;
}

// ─── paragraph / run shapes ──────────────────────────────────────────────────

test('multiple paragraphs, breaks, and fields are captured', () => {
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="en-US" i="1" u="sng"/><a:t>One</a:t></a:r><a:br/><a:r><a:rPr lang="en-US"/><a:t>Two</a:t></a:r></a:p>
      <a:p><a:fld id="{X}" type="slidenum"><a:rPr lang="en-US"/><a:t>7</a:t></a:fld></a:p>
    </p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`,
  });
  const text = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'text')[0] as PptxTextNode;
  assert.equal(text.paras.length, 2);
  assert.deepEqual(text.paras[0]!.runs.map((r) => r.text), ['One', '\n', 'Two']);
  assert.equal(text.paras[0]!.runs[0]!.italic, true);
  assert.equal(text.paras[0]!.runs[0]!.underline, true);
  assert.equal(text.paras[1]!.runs[0]!.text, '7'); // cached field text
});

test('an unresolved scheme slot keeps provenance with no hex', () => {
  const parts = deckParts();
  delete parts['ppt/theme/theme1.xml']; // no theme → nothing to resolve against
  const text = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'text')[0] as PptxTextNode;
  const color = text.paras[0]!.runs[0]!.color;
  assert.ok(color && 'scheme' in color);
  assert.equal(color.scheme, 'accent1');
  assert.equal(color.hex, undefined, 'no theme → no resolved hex, but provenance survives');
});

// ─── hardening: hostile / malformed input must never throw ───────────────────

test('an empty part map yields defaults, not a throw', () => {
  const deck = readPptx({}, parseXml);
  assert.equal(deck.widthEmu, 12192000); // 16:9 default
  assert.equal(deck.heightEmu, 6858000);
  assert.deepEqual(deck.slides, []);
  assert.deepEqual(deck.theme.colors, {});
});

test('null/undefined parts and a non-function parser are handled', () => {
  assert.deepEqual(readPptx(null as unknown as PptxParts, parseXml).slides, []);
  assert.deepEqual(readPptx(deckParts(), null as unknown as typeof parseXml).slides, []);
});

test('a malformed slide skips cleanly - the rest of the deck still parses', () => {
  const deck = readPptx(deckParts({ 'ppt/slides/slide1.xml': '<p:sld><<< not xml' }), parseXml);
  assert.equal(deck.theme.colors.accent1, '4472C4', 'theme still read');
  assert.equal(deck.widthEmu, 9144000, 'slide size still read');
  assert.equal(deck.slides.length, 1, 'the slide is still listed');
  assert.deepEqual(deck.slides[0]!.nodes, [], 'but contributes no nodes');
});

test('a malformed theme/presentation degrades to defaults without throwing', () => {
  const deck = readPptx(
    deckParts({ 'ppt/theme/theme1.xml': '<a:theme>&&&', 'ppt/presentation.xml': '<p:presentation' }),
    parseXml,
  );
  assert.deepEqual(deck.theme.colors, {});
  assert.equal(deck.widthEmu, 12192000);
  // presentation.xml is unparseable → fall back to the slide parts themselves
  assert.equal(deck.slides.length, 1);
});

test('a parser that throws on every part never escapes readPptx', () => {
  const boom = (): Document => {
    throw new Error('hostile parser');
  };
  let deck!: ReturnType<typeof readPptx>;
  assert.doesNotThrow(() => {
    deck = readPptx(deckParts(), boom);
  });
  assert.deepEqual(deck.theme.colors, {}, 'no theme could be read');
  assert.equal(deck.widthEmu, 12192000, 'size falls back to the default');
  // Nothing is parseable, but the slide PART is still visible in the map, so the
  // filename-glob fallback still reports it - with no nodes. "Return what
  // parsed, skip the rest" rather than pretending the deck is empty.
  assert.equal(deck.slides.length, 1);
  assert.deepEqual(deck.slides[0]!.nodes, []);
});

test('a parser returning a document with no documentElement is tolerated', () => {
  const empty = (): Document => ({ documentElement: null }) as unknown as Document;
  let deck!: ReturnType<typeof readPptx>;
  assert.doesNotThrow(() => {
    deck = readPptx(deckParts(), empty);
  });
  assert.equal(deck.slides.length, 1);
  assert.deepEqual(deck.slides[0]!.nodes, []);
});

test('deeply nested groups are depth-capped, not stack-overflowed', () => {
  // 400 nested grpSp, each wrapping the next; the innermost holds a shape.
  const depth = 400;
  const inner =
    '<p:sp><p:nvSpPr><p:cNvPr id="9" name="deep"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom></p:spPr></p:sp>';
  let xml = inner;
  for (let i = 0; i < depth; i++) xml = `<p:grpSp><p:nvGrpSpPr/><p:grpSpPr/>${xml}</p:grpSp>`;
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${xml}</p:spTree></p:cSld></p:sld>`,
  });
  let deck!: ReturnType<typeof readPptx>;
  assert.doesNotThrow(() => {
    deck = readPptx(parts, parseXml);
  });
  // The shape sits far below MAX_GROUP_DEPTH, so it is skipped - the cap holds
  // and nothing crashes. What matters is that we returned.
  assert.equal(deck.slides.length, 1);
  assert.deepEqual(deck.slides[0]!.nodes, []);
});

test('a huge shape count is capped per slide', () => {
  const sp =
    '<p:sp><p:nvSpPr><p:cNvPr id="9" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
    '<p:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>';
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${sp.repeat(9000)}</p:spTree></p:cSld></p:sld>`,
  });
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides[0]!.nodes.length, 8000, 'MAX_NODES_PER_SLIDE holds');
});

test('absurd/garbage geometry attributes coerce to safe numbers', () => {
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="T"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm rot="notanumber"><a:off x="99999999999999999999" y="abc"/><a:ext cx="-99999999999999999999" cy=""/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:solidFill><a:srgbClr val="ZZZ"/></a:solidFill>
    </p:spPr>
  </p:sp>
</p:spTree></p:cSld></p:sld>`,
  });
  const shape = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'shape')[0] as PptxShapeNode;
  assert.ok(Number.isFinite(shape.xEmu) && Math.abs(shape.xEmu) <= 1e11, 'x clamped, finite');
  assert.equal(shape.yEmu, 0, 'unparseable y → 0');
  assert.ok(Number.isFinite(shape.cxEmu) && Math.abs(shape.cxEmu) <= 1e11, 'cx clamped, finite');
  assert.equal(shape.cyEmu, 0);
  assert.equal(shape.rot, undefined, 'unparseable rot is dropped, never NaN');
  assert.equal(shape.fill, undefined, 'a non-hex srgbClr val yields no colour, not garbage');
});

test('an oversized part is skipped rather than parsed', () => {
  // 25 MB > MAX_PART_BYTES (24 MB)
  const huge = new Uint8Array(25 * 1024 * 1024);
  const deck = readPptx(deckParts({ 'ppt/slides/slide1.xml': huge }), parseXml);
  assert.equal(deck.slides.length, 1);
  assert.deepEqual(deck.slides[0]!.nodes, [], 'oversized slide contributes nothing');
  assert.equal(deck.theme.colors.accent1, '4472C4', 'the rest of the deck is unaffected');
});

test('a pic whose r:embed has no matching rel keeps the embed id but no media', () => {
  const parts = deckParts({
    'ppt/slides/_rels/slide1.xml.rels': `${XML_DECL}<Relationships xmlns="${NS_PKG_REL}"/>`,
  });
  const pic = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'pic')[0] as PptxPicNode;
  assert.equal(pic.embed, 'rId2');
  assert.equal(pic.media, undefined);
});

test('rel targets cannot escape the package root via ../..', () => {
  const parts = deckParts({
    'ppt/slides/_rels/slide1.xml.rels': `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId2" Type="${NS_R}/image" Target="../../../../../../etc/passwd"/>
</Relationships>`,
  });
  const pic = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'pic')[0] as PptxPicNode;
  // `..` segments pop; they can never produce a path above the package root.
  assert.equal(pic.media, 'etc/passwd');
  assert.ok(!pic.media!.startsWith('..'), 'no traversal above the root');
  assert.ok(!pic.media!.startsWith('/'), 'never absolute');
});

// ─── placeholders + reading order (plan 139 WP1) ─────────────────────────────

const PH_SLIDE = `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>The title</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="3" name="Content 2"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="900000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:rPr lang="en-US"/><a:t>Top level</a:t></a:r></a:p>
      <a:p><a:pPr lvl="1"/><a:r><a:rPr lang="en-US"/><a:t>Nested</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="4" name="Loose box"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="1800000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>No placeholder</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="5" name="Footer 3"/><p:cNvSpPr/><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="2700000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Confidential</a:t></a:r></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`;

test('a slide sp reports its own p:ph type and idx', () => {
  const nodes = readPptx(deckParts({ 'ppt/slides/slide1.xml': PH_SLIDE }), parseXml).slides[0]!.nodes;
  const texts = byType(nodes, 'text');
  assert.equal(texts.length, 4);
  assert.deepEqual(texts[0]!.ph, { type: 'title' });
  // A ph element with NO type attribute means `body` per ECMA-376.
  assert.deepEqual(texts[1]!.ph, { type: 'body', idx: 1 });
  assert.equal(texts[2]!.ph, undefined, 'a plain text box carries no placeholder');
  assert.deepEqual(texts[3]!.ph, { type: 'ftr', idx: 11 });
});

test('a paragraph reports its outline level from a:pPr lvl', () => {
  const nodes = readPptx(deckParts({ 'ppt/slides/slide1.xml': PH_SLIDE }), parseXml).slides[0]!.nodes;
  const body = byType(nodes, 'text')[1] as PptxTextNode;
  assert.equal(body.paras[0]!.lvl, undefined, 'level 0 is absent, not 0');
  assert.equal(body.paras[1]!.lvl, 1);
});

test('an empty placeholder shape keeps its ph without becoming a text node', () => {
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Subtitle 1"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`,
  });
  const shape = byType(readPptx(parts, parseXml).slides[0]!.nodes, 'shape')[0] as PptxShapeNode;
  assert.deepEqual(shape.ph, { type: 'subTitle', idx: 1 });
});

test('hostile ph attributes are clamped, never NaN and never unbounded', () => {
  const parts = deckParts({
    'ppt/slides/slide1.xml': `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="X"/><p:cNvSpPr/><p:nvPr><p:ph type="${'t'.repeat(500)}" idx="99999999999"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="9999"/><a:r><a:rPr lang="en-US"/><a:t>x</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="3" name="Y"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="not-a-number"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="500000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="-4"/><a:r><a:rPr lang="en-US"/><a:t>y</a:t></a:r></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`,
  });
  let nodes!: PptxReadNode[];
  assert.doesNotThrow(() => {
    nodes = readPptx(parts, parseXml).slides[0]!.nodes;
  });
  const texts = byType(nodes, 'text');
  assert.equal(texts[0]!.ph!.type!.length, 64, 'a runaway type value is clamped');
  assert.equal(texts[0]!.ph!.idx, 1_000_000, 'idx is clamped');
  assert.equal(texts[0]!.paras[0]!.lvl, 8, 'nine outline levels, 0..8');
  assert.equal(texts[1]!.ph!.idx, undefined, 'an unparseable idx is dropped, never NaN');
  assert.equal(texts[1]!.paras[0]!.lvl, undefined, 'a negative level is dropped');
});

test('readingOrder sorts rows top-down then left-right, leaving the stored order alone', () => {
  // Two columns, authored out of order: right column first, then left.
  const stored = readPptx(
    deckParts({
      'ppt/slides/slide1.xml': `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  ${[
    ['Right top', 5_000_000, 1_000_000],
    ['Right bottom', 5_000_000, 3_000_000],
    ['Left top', 500_000, 1_020_000],
    ['Left bottom', 500_000, 3_000_000],
  ]
    .map(
      ([t, x, y], i) => `<p:sp>
    <p:nvSpPr><p:cNvPr id="${i + 2}" name="b${i}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="1000000" cy="500000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>${t}</a:t></a:r></a:p></p:txBody>
  </p:sp>`,
    )
    .join('\n')}
</p:spTree></p:cSld></p:sld>`,
    }),
    parseXml,
  ).slides[0]!.nodes;

  const textOf = (n: PptxReadNode): string => (n as PptxTextNode).paras[0]!.runs[0]!.text;
  assert.deepEqual(stored.map(textOf), ['Right top', 'Right bottom', 'Left top', 'Left bottom'], 'spTree order is untouched');
  // "Left top" sits 20000 EMU below "Right top" - well inside the half-line row
  // tolerance, so they band together and sort left to right.
  assert.deepEqual(readingOrder(stored).map(textOf), ['Left top', 'Right top', 'Left bottom', 'Right bottom']);
  assert.deepEqual(stored.map(textOf), ['Right top', 'Right bottom', 'Left top', 'Left bottom'], 'the input array is not mutated');
});

test('readingOrder never throws on garbage', () => {
  assert.deepEqual(readingOrder(null as unknown as PptxReadNode[]), []);
  assert.deepEqual(readingOrder(undefined as unknown as PptxReadNode[]), []);
  assert.deepEqual(readingOrder([]), []);
  const junk = [
    null,
    { type: 'text', xEmu: Number.NaN, yEmu: Number.NaN },
    { type: 'shape', xEmu: '5', yEmu: {} },
  ] as unknown as PptxReadNode[];
  let out!: PptxReadNode[];
  assert.doesNotThrow(() => {
    out = readingOrder(junk);
  });
  assert.equal(out.length, 2, 'null entries are dropped, the rest survive in authored order');
});

// ─── the layout/master cascade (plans/139 WP7) ───────────────────────────────
//
// A slide states only what the author overrode; everything else lives in the
// layout placeholder, the master placeholder, the master's txStyles, or the
// presentation's defaultTextStyle. These fixtures wire all four layers up so
// each one can be shown filling in where the one above it stayed silent.

const CASCADE_PRESENTATION = `${XML_DECL}
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
  <p:defaultTextStyle>
    <a:lvl1pPr><a:defRPr><a:latin typeface="Default Face"/></a:defRPr></a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`;

const CASCADE_SLIDE = `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="100000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Deck title</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="3" name="Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="900000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/>
      <a:p><a:r><a:t>Subtitle line</a:t></a:r></a:p>
      <a:p><a:pPr lvl="1"/><a:r><a:t>Second level</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="4" name="Content 3"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="2"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="1800000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" b="0"/><a:t>Not bold</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="5" name="TextBox 4"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="2700000"/><a:ext cx="10" cy="10"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>Plain box</a:t></a:r></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="6" name="Rectangle 5"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>
      <a:xfrm><a:off x="100000" y="3600000"/><a:ext cx="500000" cy="200000"/></a:xfrm>
      <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      <a:ln w="28575"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln>
    </p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`;

const CASCADE_SLIDE_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

// The layout titles its slot `ctrTitle` where the slide says `title` (the two
// spellings are one slot), and it names a face without stating a size.
const CASCADE_LAYOUT = `${XML_DECL}
<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="title"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/>
      <a:lstStyle><a:lvl1pPr><a:defRPr><a:latin typeface="Layout Title Face"/></a:defRPr></a:lvl1pPr></a:lstStyle>
      <a:p><a:endParaRPr lang="en-US"/></a:p>
    </p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="3" name="Subtitle 2"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/>
      <a:lstStyle>
        <a:lvl1pPr><a:defRPr sz="2000" b="1"/></a:lvl1pPr>
        <a:lvl2pPr><a:defRPr sz="1600"/></a:lvl2pPr>
      </a:lstStyle>
      <a:p><a:endParaRPr lang="en-US"/></a:p>
    </p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="4" name="Content 3"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="2"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/>
      <a:lstStyle><a:lvl1pPr><a:defRPr sz="1800" b="1"/></a:lvl1pPr></a:lstStyle>
      <a:p><a:endParaRPr lang="en-US"/></a:p>
    </p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sldLayout>`;

const CASCADE_LAYOUT_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

// The master's own placeholders say nothing; its txStyles carry the sizes and
// colours, which is where PowerPoint actually puts them.
const CASCADE_MASTER = `${XML_DECL}
<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title Placeholder 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="3" name="Text Placeholder 2"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld>
<p:txStyles>
  <p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle>
  <p:bodyStyle>
    <a:lvl1pPr><a:defRPr><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:defRPr></a:lvl1pPr>
    <a:lvl2pPr><a:defRPr><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:defRPr></a:lvl2pPr>
  </p:bodyStyle>
  <p:otherStyle><a:lvl1pPr><a:defRPr sz="1000"/></a:lvl1pPr></p:otherStyle>
</p:txStyles>
</p:sldMaster>`;

function cascadeParts(overrides: PptxParts = {}): PptxParts {
  return deckParts({
    'ppt/presentation.xml': CASCADE_PRESENTATION,
    'ppt/slides/slide1.xml': CASCADE_SLIDE,
    'ppt/slides/_rels/slide1.xml.rels': CASCADE_SLIDE_RELS,
    'ppt/slideLayouts/slideLayout1.xml': CASCADE_LAYOUT,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': CASCADE_LAYOUT_RELS,
    'ppt/slideMasters/slideMaster1.xml': CASCADE_MASTER,
    ...overrides,
  });
}

const cascadeTexts = (parts: PptxParts = cascadeParts()): PptxTextNode[] =>
  byType(readPptx(parts, parseXml).slides[0]!.nodes, 'text');

test('an idx-only slide placeholder takes its type from the matching layout slot', () => {
  const texts = cascadeTexts();
  // Without a layout this reads as the ECMA-376 default `body`; the layout's
  // idx="1" slot says what it really is.
  assert.deepEqual(texts[1]!.ph, { type: 'subTitle', idx: 1 });
  // An explicit slide-level type is never overwritten by the layout.
  assert.deepEqual(texts[2]!.ph, { type: 'body', idx: 2 });
});

test('a run with no rPr inherits size and bold from the layout placeholder', () => {
  const run = cascadeTexts()[1]!.paras[0]!.runs[0]!;
  assert.equal(run.text, 'Subtitle line');
  assert.equal(run.sizePt, 20);
  assert.equal(run.bold, true);
});

test('outline level picks the matching layout level, not level 1', () => {
  const body = cascadeTexts()[1]!;
  assert.equal(body.paras[1]!.lvl, 1);
  assert.equal(body.paras[1]!.runs[0]!.sizePt, 16);
});

test('master txStyles fill in where the layout stayed silent', () => {
  const texts = cascadeTexts();
  const title = texts[0]!.paras[0]!.runs[0]!;
  // Size comes from the master's titleStyle (neither the slide nor the layout
  // states one); the face still comes from the layout, which is nearer.
  assert.equal(title.sizePt, 44);
  assert.equal(title.font, 'Layout Title Face');
  // bodyStyle colours the subtitle per level, resolved through the theme.
  assert.deepEqual(texts[1]!.paras[0]!.runs[0]!.color, { scheme: 'accent2', hex: 'ED7D31' });
  assert.deepEqual(texts[1]!.paras[1]!.runs[0]!.color, { scheme: 'accent3', hex: 'A5A5A5' });
});

test('title and ctrTitle are one slot when placeholders are matched', () => {
  // The slide says `title`, the layout says `ctrTitle`; the run is only styled
  // if the two spellings matched.
  assert.equal(cascadeTexts()[0]!.paras[0]!.runs[0]!.font, 'Layout Title Face');
});

test('an explicit b="0" survives a bold layout placeholder', () => {
  const run = cascadeTexts()[2]!.paras[0]!.runs[0]!;
  assert.equal(run.text, 'Not bold');
  assert.equal(run.bold, undefined, 'an explicit off is a value, not an absence');
  assert.equal(run.sizePt, 18, 'the fields it stayed silent about still inherit');
});

test('presentation defaultTextStyle is the last layer, and reaches a plain text box', () => {
  const texts = cascadeTexts();
  assert.equal(texts[3]!.paras[0]!.runs[0]!.font, 'Default Face');
  // A shape with no placeholder takes nothing from the master's txStyles.
  assert.equal(texts[3]!.paras[0]!.runs[0]!.sizePt, undefined);
});

test('a:ln width surfaces in points so importers stop defaulting one', () => {
  const shapes = byType(readPptx(cascadeParts(), parseXml).slides[0]!.nodes, 'shape');
  const outlined = shapes.find((s) => s.geom === 'rect')!;
  assert.equal(outlined.lineWidthPt, 2.25, '28575 EMU at 12700 EMU per point');
  assert.deepEqual(outlined.line, { scheme: 'accent1', hex: '4472C4' });
});

test('a layout relationship pointing at a missing part degrades to the slide-only read', () => {
  let texts!: PptxTextNode[];
  assert.doesNotThrow(() => {
    texts = cascadeTexts(
      cascadeParts({
        'ppt/slides/_rels/slide1.xml.rels': `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideLayout" Target="../slideLayouts/slideLayout9.xml"/>
</Relationships>`,
      }),
    );
  });
  assert.deepEqual(texts[1]!.ph, { type: 'body', idx: 1 }, 'the ECMA-376 default stands in');
  assert.equal(texts[1]!.paras[0]!.runs[0]!.sizePt, undefined, 'nothing to inherit, nothing invented');
  assert.equal(texts[3]!.paras[0]!.runs[0]!.font, 'Default Face', 'the deck-level layer still applies');
});

test('a layout carrying ten thousand placeholders is capped, not fatal', () => {
  const wanted = `<p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Subtitle"/><p:cNvSpPr/><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/><a:lstStyle><a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr></a:lstStyle><a:p/></p:txBody>
  </p:sp>`;
  const filler = Array.from(
    { length: 10_000 },
    (_, i) => `<p:sp>
    <p:nvSpPr><p:cNvPr id="${i + 3}" name="p${i}"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="${i + 100}"/></p:nvPr></p:nvSpPr>
    <p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`,
  ).join('');
  let texts!: PptxTextNode[];
  assert.doesNotThrow(() => {
    texts = cascadeTexts(
      cascadeParts({
        'ppt/slideLayouts/slideLayout1.xml': `${XML_DECL}
<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree>${wanted}${filler}</p:spTree></p:cSld></p:sldLayout>`,
      }),
    );
  });
  assert.equal(texts.length, 4, 'the slide still reads in full');
  assert.equal(texts[1]!.paras[0]!.runs[0]!.sizePt, 20, 'placeholders inside the cap still resolve');
});

test('a deck with no layout parts reads exactly as it did before the cascade', () => {
  // Pinned against the pre-cascade output of the shared fixture. The ONLY
  // difference is the additive `lineWidthPt`, which is new surface, not a
  // changed value: nothing inherits when there is no layout to inherit from.
  const slide = readPptx(deckParts(), parseXml).slides[0]!;
  assert.deepEqual(slide, {
    index: 0,
    nodes: [
      {
        type: 'text',
        xEmu: 838200,
        yEmu: 365125,
        cxEmu: 2743200,
        cyEmu: 1143000,
        rot: 90,
        paras: [{ runs: [{ text: 'Hello', bold: true, sizePt: 18, font: 'Calibri', color: { scheme: 'accent1', hex: '4472C4' } }] }],
        geom: 'rect',
      },
      {
        type: 'shape',
        xEmu: 4000000,
        yEmu: 2000000,
        cxEmu: 1000000,
        cyEmu: 500000,
        geom: 'rect',
        fill: { hex: 'FF0000' },
        line: { scheme: 'tx1', hex: '000000' },
        lineWidthPt: 1,
      },
      { type: 'pic', xEmu: 100, yEmu: 200, cxEmu: 300, cyEmu: 400, embed: 'rId2', media: 'ppt/media/image1.png' },
      {
        type: 'table',
        xEmu: 500000,
        yEmu: 3000000,
        cxEmu: 2000000,
        cyEmu: 800000,
        rows: [
          ['A1', 'B1'],
          ['A2', 'B2'],
        ],
      },
      { type: 'shape', xEmu: 10, yEmu: 20, cxEmu: 30, cyEmu: 40, geom: 'ellipse', fill: { scheme: 'accent2', hex: 'ED7D31' } },
    ],
    notes: 'Speaker note here',
  });
});

// ─── core props (plans/144 Wave 2 G6): the source's authorship surfaces ──────

test('readPptx surfaces docProps/core.xml, round-tripping buildPptxParts meta', async () => {
  const { buildPptxParts } = await import('../engine/src/pptx.ts');
  const parts = buildPptxParts(
    [{ shapes: [], media: [] }],
    { meta: { title: 'Launch Deck', author: 'Ana Kovac', description: 'H2 plan' }, now: '2026-08-24T00:00:00Z' },
  );
  const deck = readPptx(parts as never, parseXml);
  assert.ok(deck.coreProps, 'core props surfaced');
  assert.equal(deck.coreProps!.creator, 'Ana Kovac');
  assert.equal(deck.coreProps!.title, 'Launch Deck');
  assert.equal(deck.coreProps!.description, 'H2 plan');
  assert.equal(deck.coreProps!.created, '2026-08-24T00:00:00Z');
});

// ─── inherited furniture + ground (engine 1.166) ─────────────────────────────
//
// A template deck (a Google Slides export of a branded template is the canonical
// case) keeps every logo, colour bar and page ground on its LAYOUTS and MASTER;
// its slides hold nothing but empty placeholders. The read model surfaces that
// layer so a consumer can paint it behind the slide.

const FURN_SLIDE = (extra = '') => `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>${extra}<p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Hello</a:t></a:r></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sld>`;
const FURN_SLIDE_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
// The layout: the title SLOT with real geometry, a colour bar, and a logo picture
// whose r:embed only resolves through the LAYOUT's own rels.
const FURN_LAYOUT = (attrs = '') => `${XML_DECL}
<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" type="title"${attrs}><p:cSld><p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="100000" y="200000"/><a:ext cx="3000000" cy="400000"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="5" name="Bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="9144000" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="30BA78"/></a:solidFill></p:spPr>
  </p:sp>
  <p:pic>
    <p:nvPicPr><p:cNvPr id="6" name="Logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
    <p:spPr><a:xfrm><a:off x="8000000" y="6000000"/><a:ext cx="1000000" cy="500000"/></a:xfrm></p:spPr>
  </p:pic>
</p:spTree></p:cSld></p:sldLayout>`;
const FURN_LAYOUT_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId1" Type="${NS_R}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="${NS_R}/image" Target="../media/logo.png"/>
</Relationships>`;
// The master: a page ground and a footer bar; its title slot has no geometry.
const FURN_MASTER = `${XML_DECL}
<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>
  <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FAFAFA"/></a:solidFill></p:bgPr></p:bg>
  <p:spTree>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="9" name="Footer bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="6558000"/><a:ext cx="9144000" cy="300000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="0C322C"/></a:solidFill></p:spPr>
  </p:sp>
  <p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="Title Placeholder"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr/>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
  </p:sp>
</p:spTree></p:cSld></p:sldMaster>`;

function furnitureParts(o: { layoutAttrs?: string; slideExtra?: string } = {}): PptxParts {
  return deckParts({
    'ppt/slides/slide1.xml': FURN_SLIDE(o.slideExtra),
    'ppt/slides/_rels/slide1.xml.rels': FURN_SLIDE_RELS,
    'ppt/slideLayouts/slideLayout1.xml': FURN_LAYOUT(o.layoutAttrs),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': FURN_LAYOUT_RELS,
    'ppt/slideMasters/slideMaster1.xml': FURN_MASTER,
    'ppt/media/logo.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  });
}

test('a slide inherits the master’s and the layout’s furniture, in that order, never their placeholders', () => {
  const slide = readPptx(furnitureParts(), parseXml).slides[0]!;
  assert.ok(slide.inherited, 'the layer is surfaced');
  const f = slide.inherited!;
  assert.deepEqual(f.map((n) => n.type), ['shape', 'shape', 'pic'], 'master bar, layout bar, layout logo');
  assert.equal((f[0] as PptxShapeNode).fill?.hex, '0C322C', 'the master paints first (behind)');
  assert.equal((f[1] as PptxShapeNode).fill?.hex, '30BA78');
  assert.equal((f[2] as PptxPicNode).media, 'ppt/media/logo.png', 'resolved through the LAYOUT’s rels, not the slide’s');
  assert.ok(f.every((n) => !('ph' in n) || !n.ph), 'a slot is not furniture');
  // The slide's own content is untouched by the layer.
  assert.equal(slide.nodes.length, 1);
  assert.equal(firstText(slide.nodes), 'Hello');
});

test('a placeholder with no geometry sits where its layout slot does', () => {
  const title = readPptx(furnitureParts(), parseXml).slides[0]!.nodes[0] as PptxTextNode;
  assert.equal(title.type, 'text');
  assert.deepEqual([title.xEmu, title.yEmu, title.cxEmu, title.cyEmu], [100000, 200000, 3000000, 400000]);
});

test('the ground resolves slide → layout → master, and a slide’s own wins', () => {
  assert.deepEqual(readPptx(furnitureParts(), parseXml).slides[0]!.background, { color: { hex: 'FAFAFA' } }, 'the master’s');
  const own = '<p:bg><p:bgPr><a:solidFill><a:srgbClr val="123456"/></a:solidFill></p:bgPr></p:bg>';
  assert.deepEqual(readPptx(furnitureParts({ slideExtra: own }), parseXml).slides[0]!.background, { color: { hex: '123456' } });
});

test('showMasterSp="0" on the layout hides the master’s shapes, and keeps the layout’s own', () => {
  const slide = readPptx(furnitureParts({ layoutAttrs: ' showMasterSp="0"' }), parseXml).slides[0]!;
  assert.deepEqual(slide.inherited!.map((n) => n.type), ['shape', 'pic']);
  assert.equal((slide.inherited![0] as PptxShapeNode).fill?.hex, '30BA78', 'the layout bar, not the master footer');
  assert.deepEqual(slide.background, { color: { hex: 'FAFAFA' } }, 'the ground still cascades - only SHAPES are hidden');
});

test('a deck with no layout parts reads exactly as before: no inherited, no background', () => {
  const slide = readPptx(deckParts(), parseXml).slides[0]!;
  assert.equal(slide.inherited, undefined);
  assert.equal(slide.background, undefined);
});

