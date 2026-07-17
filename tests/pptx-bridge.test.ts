// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for shells/web/src/bridge/pptx.ts — the host.pptx web bridge (inspect +
 * surgical rebrand over a REAL zipped fixture).
 *
 * The part map mirrors tests/pptx-read.test.ts: hand-written OOXML —
 * presentation.xml + rels + theme1.xml + slide1.xml carrying one literal
 * srgbClr, one schemeClr reference, and one explicit a:latin typeface — zipped
 * with fflate, the same library the bridge inflates with. In node there is no
 * Worker, so the bridge's async unzip takes its unzipSync fallback; that IS the
 * CLI-shell path, exercised for real. The injected parseXml is a jsdom
 * DOMParser adapter, exactly what a node shell passes.
 *
 * Run with: node --test tests/pptx-bridge.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strFromU8 } from 'fflate';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { createPptxAPI, inflatePptx, looksLikePptxFile, PPTX_MIME } from '../shells/web/src/bridge/pptx.ts';

// ─── the injected parser (jsdom stands in for the shell's native DOMParser) ───

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const api = createPptxAPI({ parseXml });

// ─── fixtures ────────────────────────────────────────────────────────────────

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const PRESENTATION = `${XML_DECL}
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`;

const PRESENTATION_RELS = `${XML_DECL}
<Relationships xmlns="${NS_PKG_REL}">
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
  </a:themeElements>
</a:theme>`;

// One text run in a LITERAL srgbClr (with an explicit a:latin), and one rect
// whose fill is a schemeClr REFERENCE — inspect must list only the literal.
const SLIDE1 = `${XML_DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="TextBox 1"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="838200" y="365125"/><a:ext cx="2743200" cy="1143000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="1800" dirty="0">
                <a:solidFill><a:srgbClr val="FF0000"/></a:solidFill>
                <a:latin typeface="Georgia"/>
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
          <a:solidFill><a:schemeClr val="accent1"/></a:solidFill>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

const ENC = new TextEncoder();

function zipDeck(overrides: Record<string, string | Uint8Array> = {}): Uint8Array {
  const parts: Record<string, string | Uint8Array> = {
    'ppt/presentation.xml': PRESENTATION,
    'ppt/_rels/presentation.xml.rels': PRESENTATION_RELS,
    'ppt/theme/theme1.xml': THEME,
    'ppt/slides/slide1.xml': SLIDE1,
    ...overrides,
  };
  const files: Record<string, Uint8Array> = {};
  for (const [path, v] of Object.entries(parts)) files[path] = typeof v === 'string' ? ENC.encode(v) : v;
  return zipSync(files);
}

const SWATCHES = [
  { hex: '#30BA78', name: 'Jungle', role: 'accent' },
  { hex: '#0C322C', name: 'Pine', role: 'ink' },
  { hex: '#FFFFFF', name: 'White', role: 'bg' },
];

// ─── file sniff + inflate ────────────────────────────────────────────────────

test('looksLikePptxFile matches the extension or the pptx MIME', () => {
  assert.equal(looksLikePptxFile({ name: 'deck.pptx' }), true);
  assert.equal(looksLikePptxFile({ name: 'DECK.PPTX', type: '' }), true);
  assert.equal(looksLikePptxFile({ name: 'blob', type: PPTX_MIME }), true);
  assert.equal(looksLikePptxFile({ name: 'deck.pdf', type: 'application/pdf' }), false);
  assert.equal(looksLikePptxFile({}), false);
});

test('inflatePptx returns every entry of the archive', async () => {
  const parts = await inflatePptx(zipDeck());
  assert.deepEqual(Object.keys(parts).sort(), [
    'ppt/_rels/presentation.xml.rels',
    'ppt/presentation.xml',
    'ppt/slides/slide1.xml',
    'ppt/theme/theme1.xml',
  ]);
  assert.equal(strFromU8(parts['ppt/slides/slide1.xml']!), SLIDE1);
});

// ─── inspect ─────────────────────────────────────────────────────────────────

test('inspect lists literal colours only, fonts, and the theme as #RRGGBB', async () => {
  const res = await api.inspect(zipDeck());
  assert.equal(res.ok, true);
  assert.equal(res.slideCount, 1);
  // the schemeClr accent1 fill follows the theme swap — only the literal remains
  assert.deepEqual(res.colors, [{ hex: '#FF0000' }]);
  // run typeface first-appearance, then the theme faces
  assert.deepEqual(res.fonts.map((f) => f.family), ['Georgia', 'Calibri Light', 'Calibri']);
  assert.equal(res.theme.colors.accent1, '#4472C4');
  assert.equal(res.theme.colors.dk1, '#000000');
  assert.equal(res.theme.colors.lt1, '#FFFFFF');
  assert.equal(res.theme.majorFont, 'Calibri Light');
  assert.equal(res.theme.minorFont, 'Calibri');
  assert.equal(res.themeSuggestion, undefined);
});

test('inspect with brand swatches + fonts suggests replacements and a theme', async () => {
  const res = await api.inspect(zipDeck(), { swatches: SWATCHES, fonts: { brand: 'Poppins' } });
  assert.equal(res.ok, true);
  const red = res.colors[0]!;
  assert.equal(red.hex, '#FF0000');
  assert.match(red.suggested!, /^#[0-9A-F]{6}$/);
  // pure red against a green/white brand is a perceptual stretch
  assert.equal(red.review, true);
  for (const f of res.fonts) assert.equal(f.suggested, 'Poppins');
  assert.ok(res.themeSuggestion);
  // the contract emits every themeSuggestion colour slot as #RRGGBB (the bridge
  // hashes the engine's hash-less theme-write form); fonts pass through
  assert.equal(res.themeSuggestion!.accent1, '#30BA78');
  for (const [slot, v] of Object.entries(res.themeSuggestion!)) {
    if (slot === 'majorFont' || slot === 'minorFont') continue;
    assert.match(v as string, /^#[0-9A-F]{6}$/, slot);
  }
  assert.equal(res.themeSuggestion!.majorFont, 'Poppins');
  assert.equal(res.themeSuggestion!.minorFont, 'Poppins');
});

test('inspect never throws: garbage bytes and non-deck zips resolve ok:false', async () => {
  for (const bytes of [
    new Uint8Array(0),
    new Uint8Array([1, 2, 3, 4, 5]),
    zipSync({ 'word/document.xml': ENC.encode('<w:document/>') }), // a real zip, not a deck
  ]) {
    const res = await api.inspect(bytes);
    assert.equal(res.ok, false);
    assert.equal(res.slideCount, 0);
    assert.deepEqual(res.colors, []);
    assert.deepEqual(res.fonts, []);
    assert.deepEqual(res.theme.colors, {});
  }
});

// ─── rebrand ─────────────────────────────────────────────────────────────────

test('rebrand normalises colorMap keys and passes untouched parts byte-identically', async () => {
  const { bytes, report } = await api.rebrand(zipDeck(), {
    colorMap: { '#ff0000': '30BA78' }, // lowercase, hashed — must still match FF0000
  });
  const files = unzipSync(bytes);
  const slide = strFromU8(files['ppt/slides/slide1.xml']!);
  assert.ok(slide.includes('val="30BA78"'));
  assert.ok(!slide.includes('FF0000'));
  // the schemeClr reference is not a literal — it stays
  assert.ok(slide.includes('<a:schemeClr val="accent1"/>'));
  assert.equal(report.colorsRemapped, 1);
  assert.deepEqual(report.slidesTouched, ['ppt/slides/slide1.xml']);
  // untouched parts survive verbatim
  assert.equal(strFromU8(files['ppt/presentation.xml']!), PRESENTATION);
  assert.equal(strFromU8(files['ppt/theme/theme1.xml']!), THEME);
  assert.equal(strFromU8(files['ppt/_rels/presentation.xml.rels']!), PRESENTATION_RELS);
});

test('rebrand accepts a "#"-prefixed theme slot (engine hexNorm strips the hash)', async () => {
  const { bytes, report } = await api.rebrand(zipDeck(), {
    theme: { accent1: '#30BA78' }, // themeSuggestion's #RRGGBB form must patch as-is
  });
  const theme = strFromU8(unzipSync(bytes)['ppt/theme/theme1.xml']!);
  assert.ok(theme.includes('<a:accent1><a:srgbClr val="30BA78"/></a:accent1>'));
  assert.equal(report.themesPatched, 1);
});

test('rebrand colorMap keys accept alpha hex forms; near-hex garbage still drops', async () => {
  // #RGBA expands like #RGB and #RRGGBBAA slices — both must match FF0000
  for (const key of ['#F00A', '#FF0000CC', 'ff0000cc']) {
    const { bytes, report } = await api.rebrand(zipDeck(), { colorMap: { [key]: '0C322C' } });
    const slide = strFromU8(unzipSync(bytes)['ppt/slides/slide1.xml']!);
    assert.ok(slide.includes('val="0C322C"'), key);
    assert.equal(report.colorsRemapped, 1, key);
  }
  // 5-hex would zero-pad into a real colour in the engine — it must be no key at all
  const { report } = await api.rebrand(zipDeck(), { colorMap: { '#F0000': '0C322C' } });
  assert.equal(report.colorsRemapped, 0);
});

test('rebrand rejects bytes that are not a .pptx', async () => {
  await assert.rejects(api.rebrand(new Uint8Array([1, 2, 3, 4, 5])));
  await assert.rejects(
    api.rebrand(zipSync({ 'word/document.xml': ENC.encode('<w:document/>') })),
    /PowerPoint/,
  );
});
