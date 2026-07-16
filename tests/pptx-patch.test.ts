// SPDX-License-Identifier: MPL-2.0
/**
 * Tests for engine/src/pptx-patch.ts — the surgical .pptx rebrand (plan track E2).
 *
 * Strategy: build a minimal-but-REALISTIC in-memory part map (theme + slide +
 * presentation + rels + content-types + a fntdata part + unrelated string/binary
 * parts), rebrand it, and assert every §2.2 behaviour: theme slots swapped, the
 * fontScheme faces swapped, literal colours remapped, explicit typefaces remapped,
 * embedded-font parts+rels+content-type-default removed together, theme parts
 * excluded from the literal colour remap, and unrelated parts passed through
 * BYTE-IDENTICAL. Every emitted XML string is re-parsed with a strict SAX parser
 * to prove nothing malformed shipped. A final suite feeds hostile inputs (malformed
 * XML, missing close tags, a large repeated body) and asserts no hang / no throw /
 * linear behaviour.
 *
 * Run with: node --test tests/pptx-patch.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { rebrandPptxParts } from '../engine/src/pptx-patch.ts';
import type { PartMap, RebrandPlan } from '../engine/src/pptx-patch.ts';

const require = createRequire(import.meta.url);
// saxes is a strict XML SAX parser (a repo dev dep); with xmlns off it validates
// pure well-formedness (tag balance, quoting, entities) without needing every
// OOXML namespace declared on the fragment.
const { SaxesParser } = require('saxes') as typeof import('saxes');

const asText = (v: Uint8Array | string): string =>
  typeof v === 'string' ? v : new TextDecoder().decode(v);

function assertWellFormed(name: string, xml: string): void {
  const parser = new SaxesParser({ fileName: name });
  let err: Error | null = null;
  parser.on('error', (e) => { if (!err) err = e as Error; });
  parser.write(xml).close();
  assert.equal(err, null, `${name} malformed: ${err ? (err as Error).message : ''}`);
}

// ─── the sample deck ─────────────────────────────────────────────────────────

const THEME1 =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office"><a:themeElements>` +
  `<a:clrScheme name="Office">` +
  `<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>` +
  `<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>` +
  `<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>` +
  `<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>` +
  `<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>` +
  `<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>` +
  `<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>` +
  `</a:clrScheme>` +
  `<a:fontScheme name="Office">` +
  `<a:majorFont><a:latin typeface="Calibri Light" panose="020F0302020204030204"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>` +
  `<a:minorFont><a:latin typeface="Calibri" panose="020F0502020204030204"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>` +
  `</a:fontScheme>` +
  `<a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>` +
  `</a:themeElements></a:theme>`;

const SLIDE1 =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
  `<p:cSld><p:spTree><p:sp><p:spPr>` +
  `<a:solidFill><a:schemeClr val="accent1"/></a:solidFill>` +
  `<a:ln><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></a:ln>` +
  `</p:spPr><p:txBody><a:p><a:r><a:rPr lang="en-US"><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>Hi &amp; bye</a:t></a:r></a:p></p:txBody>` +
  `</p:sp></p:spTree></p:cSld></p:sld>`;

const CHART1 =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
  `<c:chart><c:plotArea><c:ser><c:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></c:spPr></c:ser></c:plotArea></c:chart>` +
  `<c:txPr><a:p><a:pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:pPr></a:p></c:txPr>` +
  `</c:chartSpace>`;

const TABLE_STYLES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A}">` +
  `<a:tblStyle styleId="{5C22544A}" styleName="X"><a:wholeTbl><a:tcTxStyle><a:latin typeface="Arial"/></a:tcTxStyle></a:wholeTbl></a:tblStyle>` +
  `</a:tblStyleLst>`;

const PRESENTATION =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" embedTrueTypeFonts="1">` +
  `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
  `<p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>` +
  `<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>` +
  `<p:embeddedFontLst><p:embeddedFont><p:font typeface="MyBrandFont"/><p:regular r:id="rId5"/></p:embeddedFont></p:embeddedFontLst>` +
  `<p:defaultTextStyle><a:lvl1pPr><a:defRPr><a:latin typeface="Arial"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle>` +
  `</p:presentation>`;

const PRES_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>` +
  `<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="fonts/font1.fntdata"/>` +
  `</Relationships>`;

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Default Extension="fntdata" ContentType="application/x-fontdata"/>` +
  `<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>` +
  `<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>` +
  `</Types>`;

const APP_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
  `<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Microsoft Office PowerPoint</Application><Slides>1</Slides></Properties>`;

const FNT_BYTES = Uint8Array.from([0x4c, 0x50, 0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
const PNG_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1, 2, 3]);

function sampleParts(): PartMap {
  return {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="ppt/presentation.xml"/></Relationships>`,
    'ppt/presentation.xml': PRESENTATION,
    'ppt/_rels/presentation.xml.rels': PRES_RELS,
    // theme handed over as BYTES to exercise the decode → rewrite → re-encode path
    'ppt/theme/theme1.xml': new TextEncoder().encode(THEME1),
    'ppt/slides/slide1.xml': SLIDE1,
    'ppt/charts/chart1.xml': CHART1,
    'ppt/tableStyles.xml': TABLE_STYLES,
    'ppt/fonts/font1.fntdata': FNT_BYTES,
    'docProps/app.xml': APP_XML,
    'ppt/media/image1.png': PNG_BYTES,
  };
}

const PLAN: RebrandPlan = {
  theme: { dk1: '101010', accent1: '112233', majorFont: 'Poppins', minorFont: 'Inter' },
  // FF0000 → 00FF00 hits slide + chart literals; 5B9BD5 → 999999 exists ONLY in
  // the theme (an unswapped slot) to prove the theme is excluded from the literal remap.
  colorMap: new Map([['FF0000', '00FF00'], ['5B9BD5', '999999'], ['4472C4', '112233']]),
  fontMap: new Map([['Arial', 'Helvetica'], ['Calibri', 'Roboto']]),
  dropEmbeddedFonts: true,
};

// ─── behavioural tests ───────────────────────────────────────────────────────

test('theme swap: the 12 clrScheme slots + fontScheme faces are replaced', () => {
  const { parts, report } = rebrandPptxParts(sampleParts(), PLAN);
  const theme = asText(parts['ppt/theme/theme1.xml']!);

  // dk1 was a <a:sysClr> → replaced by a single srgbClr with the brand value.
  assert.match(theme, /<a:dk1><a:srgbClr val="101010"\/><\/a:dk1>/);
  assert.doesNotMatch(theme, /windowText/); // the sysClr child is gone
  assert.match(theme, /<a:accent1><a:srgbClr val="112233"\/><\/a:accent1>/);
  // untouched slots keep their original literals
  assert.match(theme, /<a:accent2><a:srgbClr val="ED7D31"\/><\/a:accent2>/);
  // scheme fonts swapped, panose attr on the ORIGINAL is dropped by the slot? no —
  // only the typeface VALUE changes; other latin attrs stay.
  assert.match(theme, /<a:majorFont><a:latin typeface="Poppins" panose="020F0302020204030204"\/>/);
  assert.match(theme, /<a:minorFont><a:latin typeface="Inter" panose="020F0502020204030204"\/>/);
  assert.equal(report.themesPatched, 1);
  // theme part came in as bytes → goes out as bytes (representation preserved)
  assert.ok(parts['ppt/theme/theme1.xml'] instanceof Uint8Array, 'bytes in → bytes out');
});

test('theme is EXCLUDED from the literal colour remap (only theme-swap touches it)', () => {
  const { parts } = rebrandPptxParts(sampleParts(), PLAN);
  const theme = asText(parts['ppt/theme/theme1.xml']!);
  // 5B9BD5 is in colorMap but accent5 was NOT theme-swapped: it must survive
  // verbatim, proving the literal remap never runs on theme parts.
  assert.match(theme, /<a:accent5><a:srgbClr val="5B9BD5"\/><\/a:accent5>/);
  assert.doesNotMatch(theme, /999999/);
});

test('literal colour remap rewrites srgbClr in slides + charts, not schemeClr refs', () => {
  const { parts, report } = rebrandPptxParts(sampleParts(), PLAN);
  const slide = asText(parts['ppt/slides/slide1.xml']!);
  const chart = asText(parts['ppt/charts/chart1.xml']!);

  assert.match(slide, /<a:srgbClr val="00FF00"\/>/);
  assert.doesNotMatch(slide, /FF0000/);
  // scheme colour reference is theme-linked and must be left ALONE (it rebrands
  // automatically via the swapped theme).
  assert.match(slide, /<a:schemeClr val="accent1"\/>/);
  assert.match(chart, /<a:srgbClr val="00FF00"\/>/);
  assert.ok(report.colorsRemapped >= 2, `colorsRemapped=${report.colorsRemapped}`);
});

test('font remap rewrites explicit typefaces everywhere they live', () => {
  const { parts, report } = rebrandPptxParts(sampleParts(), PLAN);
  const slide = asText(parts['ppt/slides/slide1.xml']!);
  const chart = asText(parts['ppt/charts/chart1.xml']!);
  const tbl = asText(parts['ppt/tableStyles.xml']!);
  const pres = asText(parts['ppt/presentation.xml']!);

  // slide has latin + cs Arial → both Helvetica
  assert.match(slide, /<a:latin typeface="Helvetica"\/>/);
  assert.match(slide, /<a:cs typeface="Helvetica"\/>/);
  assert.doesNotMatch(slide, /Arial/);
  assert.match(chart, /<a:latin typeface="Helvetica"\/>/);
  assert.match(tbl, /<a:latin typeface="Helvetica"\/>/);
  // presentation.xml defaultTextStyle latin → Helvetica
  assert.match(pres, /<a:latin typeface="Helvetica"\/>/);
  assert.ok(report.fontsRemapped >= 4, `fontsRemapped=${report.fontsRemapped}`);
});

test('embedded fonts: list element + fntdata part + rel + content-type default all removed', () => {
  const { parts, report } = rebrandPptxParts(sampleParts(), PLAN);
  const pres = asText(parts['ppt/presentation.xml']!);
  const rels = asText(parts['ppt/_rels/presentation.xml.rels']!);
  const ct = asText(parts['[Content_Types].xml']!);

  assert.doesNotMatch(pres, /embeddedFontLst/, 'embeddedFontLst removed');
  assert.doesNotMatch(pres, /MyBrandFont/, 'embedded font entry removed');
  assert.equal('ppt/fonts/font1.fntdata' in parts, false, 'fntdata part removed');
  assert.doesNotMatch(rels, /font1\.fntdata/, 'font rel removed');
  assert.doesNotMatch(rels, /relationships\/font"/, 'font-type rel removed');
  assert.match(rels, /Id="rId1"/); // other rels intact
  assert.match(rels, /Id="rId2"/);
  assert.doesNotMatch(ct, /Extension="fntdata"/, 'fntdata content-type default removed');
  assert.match(ct, /Extension="xml"/); // other defaults intact
  assert.equal(report.embeddedFontsStripped, 1);
});

test('unrelated parts pass through BYTE-IDENTICAL (same reference)', () => {
  const input = sampleParts();
  const { parts } = rebrandPptxParts(input, PLAN);
  // a string part we never touch: identical value AND identical reference
  assert.strictEqual(parts['docProps/app.xml'], input['docProps/app.xml']);
  // a binary part we never touch: identical reference, bytes unchanged
  assert.strictEqual(parts['ppt/media/image1.png'], input['ppt/media/image1.png']);
  assert.deepEqual(parts['ppt/media/image1.png'], PNG_BYTES);
  // the top-level .rels is out of scope entirely
  assert.strictEqual(parts['_rels/.rels'], input['_rels/.rels']);
});

test('report.slidesTouched lists exactly the modified slide parts', () => {
  const { report } = rebrandPptxParts(sampleParts(), PLAN);
  assert.deepEqual(report.slidesTouched, ['ppt/slides/slide1.xml']);
});

test('an IN-SCOPE part with nothing to rewrite stays byte-identical and unreported', () => {
  // The common real-world case: most slides in a deck carry none of the mapped
  // colours/fonts. They are rebrand CANDIDATES (in scope) but must come back
  // untouched — not re-encoded, and not listed as touched.
  const input: PartMap = {
    'ppt/slides/slide1.xml': SLIDE1, // will change
    // in scope for colour + font remap, but carries no mapped value:
    'ppt/slides/slide2.xml': `<p:sld xmlns:a="u" xmlns:p="v"><a:srgbClr val="ABCDEF"/><a:latin typeface="Georgia"/></p:sld>`,
    // in scope (chart) and handed over as BYTES: must return the SAME array, not a re-encode
    'ppt/charts/chart1.xml': new TextEncoder().encode(`<c:chartSpace xmlns:c="u" xmlns:a="v"><a:srgbClr val="ABCDEF"/></c:chartSpace>`),
  };
  const { parts, report } = rebrandPptxParts(input, PLAN);
  assert.strictEqual(parts['ppt/charts/chart1.xml'], input['ppt/charts/chart1.xml'], 'unchanged bytes not re-encoded');
  assert.equal(asText(parts['ppt/slides/slide2.xml']!), input['ppt/slides/slide2.xml']);
  assert.deepEqual(report.slidesTouched, ['ppt/slides/slide1.xml'], 'an unchanged slide is not reported as touched');
});

test('every emitted XML part is well-formed (strict SAX re-parse)', () => {
  const { parts } = rebrandPptxParts(sampleParts(), PLAN);
  for (const [path, value] of Object.entries(parts)) {
    if (!/\.(xml|rels)$/i.test(path)) continue;
    assertWellFormed(path, asText(value));
  }
});

test('font names with XML-special chars round-trip through the entity codec', () => {
  const parts: PartMap = {
    'ppt/slides/slide1.xml':
      `<p:sld xmlns:a="u" xmlns:p="v"><a:latin typeface="AT&amp;T Sans"/></p:sld>`,
  };
  const { parts: out, report } = rebrandPptxParts(parts, { fontMap: new Map([['AT&T Sans', 'Brand & Co']]) });
  const slide = asText(out['ppt/slides/slide1.xml']!);
  assert.match(slide, /typeface="Brand &amp; Co"/);
  assert.equal(report.fontsRemapped, 1);
  assertWellFormed('slide', slide);
});

test('an empty plan is a byte-identical pass-through of the whole map', () => {
  const input = sampleParts();
  const { parts, report } = rebrandPptxParts(input, {});
  for (const key of Object.keys(input)) {
    assert.strictEqual(parts[key], input[key], `${key} unchanged`);
  }
  assert.deepEqual(report, {
    themesPatched: 0, colorsRemapped: 0, fontsRemapped: 0,
    embeddedFontsStripped: 0, slidesTouched: [],
  });
});

// ─── hostile-input hardening ─────────────────────────────────────────────────

test('malformed XML never hangs or throws — unmatched patterns pass through', () => {
  const hostile: PartMap = {
    // unclosed slot, unterminated tag, truncated attr — nothing we can safely edit
    'ppt/theme/theme1.xml': `<a:theme><a:clrScheme><a:dk1><a:srgbClr val="000000"`,
    // srgbClr WITH a valid closing context but a broken sibling
    'ppt/slides/slide1.xml': `<p:sld><a:srgbClr val="FF0000"/><a:t>unclosed`,
    'ppt/presentation.xml': `<p:presentation><p:embeddedFontLst><p:embeddedFont`, // no close tag
    'ppt/_rels/presentation.xml.rels': `<Relationships><Relationship Id="rId5" Target="fonts/x.fntdata"`,
    '[Content_Types].xml': `<Types><Default Extension="fntdata"`,
  };
  const { parts, report } = rebrandPptxParts(hostile, PLAN);
  // the one editable, well-delimited token still rebrands:
  assert.match(asText(parts['ppt/slides/slide1.xml']!), /val="00FF00"/);
  // the theme slot with no close tag was left untouched (no crash, no bad edit):
  assert.match(asText(parts['ppt/theme/theme1.xml']!), /val="000000"/);
  // embeddedFontLst with no close tag is NOT removed (delimiter absent) — verbatim:
  assert.match(asText(parts['ppt/presentation.xml']!), /embeddedFontLst/);
  assert.ok(report.colorsRemapped >= 1);
});

test('a large repeated body is handled in linear time', () => {
  const N = 20000;
  const body = `<a:srgbClr val="FF0000"/>`.repeat(N);
  const parts: PartMap = { 'ppt/slides/slide1.xml': `<p:sld xmlns:a="u" xmlns:p="v">${body}</p:sld>` };
  const t0 = Date.now();
  const { parts: out, report } = rebrandPptxParts(parts, { colorMap: new Map([['FF0000', '00FF00']]) });
  const ms = Date.now() - t0;
  assert.equal(report.colorsRemapped, N);
  assert.equal(asText(out['ppt/slides/slide1.xml']!).includes('FF0000'), false);
  assert.ok(ms < 4000, `linear rewrite of ${N} tokens took ${ms}ms`);
});

test('inputs given as raw bytes are decoded, rewritten, and returned as bytes', () => {
  const parts: PartMap = {
    'ppt/slides/slide1.xml': new TextEncoder().encode(`<p:sld xmlns:a="u" xmlns:p="v"><a:srgbClr val="FF0000"/></p:sld>`),
  };
  const { parts: out } = rebrandPptxParts(parts, { colorMap: new Map([['FF0000', '00FF00']]) });
  assert.ok(out['ppt/slides/slide1.xml'] instanceof Uint8Array);
  assert.match(asText(out['ppt/slides/slide1.xml']!), /val="00FF00"/);
});
