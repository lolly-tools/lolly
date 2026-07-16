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

// ─── speaker notes ──────────────────────────────────────────────────────────────

test('a noted slide emits a notesSlide + the shared notesMaster, and the slide rel binds them', () => {
  const parts = buildPptxParts([{ shapes: [], media: [], notes: 'Hello\nWorld' }], {});
  for (const required of [
    'ppt/notesSlides/notesSlide1.xml', 'ppt/notesSlides/_rels/notesSlide1.xml.rels',
    'ppt/notesMasters/notesMaster1.xml', 'ppt/notesMasters/_rels/notesMaster1.xml.rels',
  ]) {
    assert.ok(required in parts, `missing part ${required}`);
  }
  // Each newline is its own paragraph; the note lives in the body ph PowerPoint's
  // Notes pane reads (a bare text box would render but leave the pane empty).
  const notes = parts['ppt/notesSlides/notesSlide1.xml'] as string;
  assert.match(notes, /<p:ph type="body" idx="1"\/>/);
  assert.match(notes, /<a:t>Hello<\/a:t>/);
  assert.match(notes, /<a:t>World<\/a:t>/);
  assert.equal([...notes.matchAll(/<a:p>/g)].length, 2, 'one paragraph per line');
  // No media → the notesSlide rel takes rId2, straight after the layout.
  const rels = parts['ppt/slides/_rels/slide1.xml.rels'] as string;
  assert.match(rels, /Id="rId2" Type="[^"]*\/notesSlide" Target="\.\.\/notesSlides\/notesSlide1\.xml"/);
  // The notesSlide relates back to its own slide and to the shared master. ECMA-376
  // §13.3.5 permits the back-rel rather than requiring it, but every real producer
  // emits it — don't be the one deck that doesn't.
  const nRels = parts['ppt/notesSlides/_rels/notesSlide1.xml.rels'] as string;
  assert.match(nRels, /Id="rId1" Type="[^"]*\/slide" Target="\.\.\/slides\/slide1\.xml"/);
  assert.match(nRels, /Id="rId2" Type="[^"]*\/notesMaster" Target="\.\.\/notesMasters\/notesMaster1\.xml"/);
});

test('notes wire the presentation: notesMasterIdLst precedes sldIdLst, rel + content types resolve', () => {
  const parts = buildPptxParts([{ shapes: [], media: [], notes: 'note' }], {});
  const pres = parts['ppt/presentation.xml'] as string;
  // CT_Presentation is an xsd:sequence — notesMasterIdLst AFTER sldIdLst is invalid
  // XML that PowerPoint repairs. Assert the real order, not just presence.
  assert.match(pres, /<\/p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId4"\/><\/p:notesMasterIdLst><p:sldIdLst>/);
  const presRels = parts['ppt/_rels/presentation.xml.rels'] as string;
  assert.match(presRels, /Id="rId4" Type="[^"]*\/notesMaster" Target="notesMasters\/notesMaster1\.xml"/);
  const ct = parts['[Content_Types].xml'] as string;
  assert.match(ct, /PartName="\/ppt\/notesSlides\/notesSlide1\.xml" ContentType="[^"]*\.notesSlide\+xml"/);
  assert.match(ct, /PartName="\/ppt\/notesMasters\/notesMaster1\.xml" ContentType="[^"]*\.notesMaster\+xml"/);
});

test('the notes master gets its OWN theme part, not the slide master\'s', () => {
  // A theme part is 1:1 with a master in every real deck; pointing the notesMaster
  // at theme1 (shared with the slideMaster) is a known PowerPoint repair trigger.
  const parts = buildPptxParts([{ shapes: [], media: [], notes: 'note' }], {});
  assert.ok('ppt/theme/theme2.xml' in parts, 'notes master theme written');
  assert.match(parts['ppt/notesMasters/_rels/notesMaster1.xml.rels'] as string, /Target="\.\.\/theme\/theme2\.xml"/);
  assert.match(parts['[Content_Types].xml'] as string, /PartName="\/ppt\/theme\/theme2\.xml" ContentType="[^"]*\.theme\+xml"/);
  // The slide master keeps theme1 — the two must not cross.
  assert.match(parts['ppt/slideMasters/_rels/slideMaster1.xml.rels'] as string, /Target="\.\.\/theme\/theme1\.xml"/);
});

test('notes text is XML-escaped', () => {
  const parts = buildPptxParts([{ shapes: [], media: [], notes: 'Ampersand & <tag> "quoted"' }], {});
  const xml = parts['ppt/notesSlides/notesSlide1.xml'] as string;
  assert.match(xml, /<a:t>Ampersand &amp; &lt;tag&gt; &quot;quoted&quot;<\/a:t>/);
  assert.doesNotMatch(xml, /<tag>/, 'raw user markup must never reach the part');
});

test('a deck with NO notes is byte-for-byte what it was before notes existed', () => {
  // The whole feature is gated on a non-blank note. Compare the full part tree of an
  // un-noted deck against one built with notes explicitly absent/blank/whitespace.
  const base = buildPptxParts([picSlide(), picSlide()], {});
  for (const label of ['absent', 'empty', 'whitespace'] as const) {
    const notes = label === 'absent' ? undefined : label === 'empty' ? '' : '   \n  ';
    const got = buildPptxParts([{ ...picSlide(), notes }, { ...picSlide(), notes }], {});
    assert.deepEqual(Object.keys(got).sort(), Object.keys(base).sort(), `${label}: part paths`);
    for (const [path, content] of Object.entries(base)) {
      assert.deepEqual(got[path], content, `${label}: ${path} drifted`);
    }
    assert.ok(!Object.keys(got).some(p => /notes/i.test(p)), `${label}: no notes parts`);
    assert.doesNotMatch(got['ppt/presentation.xml'] as string, /notesMasterIdLst/, `${label}: no notesMasterIdLst`);
  }
});

test('only the noted slides get notes parts; indices and rels stay aligned', () => {
  // The likely bug: emitting notesSlide1..N by position instead of by slide index.
  const parts = buildPptxParts([picSlide(), { ...picSlide(), notes: 'only me' }, picSlide()], {});
  assert.ok('ppt/notesSlides/notesSlide2.xml' in parts, 'noted slide 2 keyed by its own index');
  assert.ok(!('ppt/notesSlides/notesSlide1.xml' in parts), 'un-noted slide 1');
  assert.ok(!('ppt/notesSlides/notesSlide3.xml' in parts), 'un-noted slide 3');
  assert.match(parts['ppt/notesSlides/notesSlide2.xml'] as string, /<a:t>only me<\/a:t>/);
  // The back-rel is keyed off the same index — pointing it at slide1 would attach the
  // note to the wrong slide in any reader that follows it.
  assert.match(parts['ppt/notesSlides/_rels/notesSlide2.xml.rels'] as string, /Type="[^"]*\/slide" Target="\.\.\/slides\/slide2\.xml"/);
  // Exactly one master for the whole deck, and the rel only on the noted slide.
  assert.equal(Object.keys(parts).filter(p => p.startsWith('ppt/notesMasters/')).length, 2);
  assert.doesNotMatch(parts['ppt/slides/_rels/slide1.xml.rels'] as string, /notesSlide/);
  assert.match(parts['ppt/slides/_rels/slide2.xml.rels'] as string, /Target="\.\.\/notesSlides\/notesSlide2\.xml"/);
  assert.doesNotMatch(parts['ppt/slides/_rels/slide3.xml.rels'] as string, /notesSlide/);
  const ct = parts['[Content_Types].xml'] as string;
  assert.equal([...ct.matchAll(/\.notesSlide\+xml/g)].length, 1, 'one notesSlide override');
});

test('the notesSlide rel never collides with media rIds', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'pic', x: 0, y: 0, cx: 10, cy: 10, media: 0 }, { kind: 'pic', x: 0, y: 0, cx: 10, cy: 10, media: 1 }],
    media: [{ bytes, ext: 'png' }, { bytes, ext: 'jpeg' }],
    notes: 'note',
  };
  const rels = buildPptxParts([slide], {})['ppt/slides/_rels/slide1.xml.rels'] as string;
  // media take rId2/rId3 → notes must land past them at rId4.
  assert.match(rels, /Id="rId2" Type="[^"]*\/image"/);
  assert.match(rels, /Id="rId3" Type="[^"]*\/image"/);
  assert.match(rels, /Id="rId4" Type="[^"]*\/notesSlide"/);
  const ids = [...rels.matchAll(/Id="(rId\d+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'relationship ids are unique');
});

// ─── 1.56.0 rich text ────────────────────────────────────────────────────────
test('a bulleted paragraph carries a hanging indent, level and buChar', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 200, paras: [
      { runs: [{ text: 'Top', sizePt: 18 }], bullet: true },
      { runs: [{ text: 'Nested', sizePt: 14 }], bullet: true, level: 1 },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  // level 0 bullet: marL = 1*342900, hanging indent = -342900, no lvl attr.
  assert.match(xml, /<a:pPr marL="342900" indent="-342900"><a:buFont typeface="Arial"\/><a:buChar char="•"\/><\/a:pPr>/);
  // level 1 bullet: marL = 2*342900 = 685800, lvl="1"; attrs in schema order (marL, lvl, indent).
  assert.match(xml, /<a:pPr marL="685800" lvl="1" indent="-342900"><a:buFont typeface="Arial"\/><a:buChar char="•"\/>/);
});

test('a numbered paragraph uses buAutoNum; a false bullet forces buNone', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 200, paras: [
      { runs: [{ text: 'One', sizePt: 18 }], bullet: 'number' },
      { runs: [{ text: 'Plain', sizePt: 18 }], bullet: false },
      { runs: [{ text: 'Star', sizePt: 18 }], bullet: { char: '★' } },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:buAutoNum type="arabicPeriod"\/>/);
  assert.match(xml, /<a:pPr><a:buNone\/><\/a:pPr>/);
  assert.match(xml, /<a:buChar char="★"\/>/);
});

test('line/space spacing children are emitted in schema order before the bullet', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 200, paras: [
      { runs: [{ text: 'x', sizePt: 12 }], bullet: true, lineSpacingPct: 150, spaceBeforePt: 6, spaceAfterPt: 3 },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:lnSpc><a:spcPct val="150000"\/><\/a:lnSpc><a:spcBef><a:spcPts val="600"\/><\/a:spcBef><a:spcAft><a:spcPts val="300"\/><\/a:spcAft><a:buFont/);
});

test('an underlined run adds u="sng"', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 100, paras: [{ runs: [{ text: 'u', sizePt: 12, underline: true }] }] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /b="0" i="0" u="sng" dirty="0"/);
});

test('a plain {runs, align} paragraph is byte-for-byte the pre-rich-text shape', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 100, paras: [{ align: 'ctr', runs: [{ text: 'h', sizePt: 12 }] }] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:p><a:pPr algn="ctr"\/><a:r>/);
  assert.doesNotMatch(xml, /buNone|marL|lvl=/);
});

// ─── 1.56.0 native tables ────────────────────────────────────────────────────
test('a native table is an inline a:tbl graphicFrame needing no extra parts/rels', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: 100, y: 100, cx: 6000000, cy: 1000000, cols: [3000000, 3000000], firstRow: true, rows: [
      { cells: [{ text: 'A', bold: true, fill: '#203864' }, { text: 'B' }] },
      { cells: [{ text: '1' }, { text: '2' }] },
    ] }],
    media: [],
  };
  const parts = buildPptxParts([slide], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:graphicData uri="http:\/\/schemas\.openxmlformats\.org\/drawingml\/2006\/table">/);
  assert.match(xml, /<a:tblPr firstRow="1" bandRow="1"><a:tableStyleId>\{5C22544A-7EE6-4342-B048-85BDC9FD1C3A\}<\/a:tableStyleId>/);
  assert.match(xml, /<a:tblGrid><a:gridCol w="3000000"\/><a:gridCol w="3000000"\/><\/a:tblGrid>/);
  // p:xfrm uses the p: prefix but a:off / a:ext children.
  assert.match(xml, /<p:xfrm><a:off x="100" y="100"\/><a:ext cx="6000000" cy="1000000"\/><\/p:xfrm>/);
  // A table adds NO relationship and NO content-type entry (unlike a chart).
  const rels = parts['ppt/slides/_rels/slide1.xml.rels'] as string;
  assert.doesNotMatch(rels, /table/);
  const ct = parts['[Content_Types].xml'] as string;
  assert.doesNotMatch(ct, /table\+xml|spreadsheet/);
  // No media declared → the deck is identical shape-wise to the notes-free baseline.
  assert.ok(!('ppt/charts/chart1.xml' in parts));
});

test('table cell fill comes AFTER the four borders inside a:tcPr', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: 0, y: 0, cx: 100, cy: 100, cols: [100], rows: [
      { cells: [{ text: 'x', fill: '#DDEBF7', borders: { b: { color: '#BFBFBF', w: 12700 } } }] },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:lnB w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:srgbClr val="BFBFBF"\/><\/a:solidFill><\/a:lnB><a:solidFill><a:srgbClr val="DDEBF7"\/><\/a:solidFill><\/a:tcPr>/);
});

test('colSpan/rowSpan produce a rectangular hMerge/vMerge grid', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: 0, y: 0, cx: 100, cy: 100, cols: [50, 50], rows: [
      { cells: [{ text: 'Header', colSpan: 2 }] },   // origin + 1 hMerge marker
      { cells: [{ text: 'Tall', rowSpan: 2 }, { text: 'b' }] },
      { cells: [{ text: 'c' }] },                    // first col is a vMerge marker
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  // Every row has exactly 2 <a:tc> — the grid stays rectangular.
  const rows = [...xml.matchAll(/<a:tr [^>]*>([\s\S]*?)<\/a:tr>/g)].map(m => m[1]!);
  assert.equal(rows.length, 3);
  for (const r of rows) assert.equal((r.match(/<a:tc[ >]/g) || []).length, 2, 'each row has 2 cells');
  assert.match(rows[0]!, /<a:tc gridSpan="2">/);
  assert.match(rows[0]!, /<a:tc hMerge="1">/);
  assert.match(rows[1]!, /<a:tc rowSpan="2">/);
  assert.match(rows[2]!, /<a:tc vMerge="1">/);
});

// ─── 1.56.0 themed master from values ────────────────────────────────────────
test('a caller theme overrides the scheme colours and fonts in theme1 + notes theme2', () => {
  const slide: PptxSlide = { shapes: [{ kind: 'text', x: 0, y: 0, cx: 10, cy: 10, paras: [{ runs: [{ text: 'x', sizePt: 12 }] }] }], media: [], notes: 'n' };
  const parts = buildPptxParts([slide], { theme: { name: 'SUSE', colors: { accent1: '#FF0000', dk2: '112233' }, fonts: { major: 'SUSE', minor: 'SUSE Mono' } } });
  const t1 = parts['ppt/theme/theme1.xml'] as string;
  assert.match(t1, /name="SUSE"/);
  assert.match(t1, /<a:accent1><a:srgbClr val="FF0000"\/><\/a:accent1>/);
  assert.match(t1, /<a:dk2><a:srgbClr val="112233"\/><\/a:dk2>/);
  assert.match(t1, /<a:majorFont><a:latin typeface="SUSE"\//);
  assert.match(t1, /<a:minorFont><a:latin typeface="SUSE Mono"\//);
  // Untouched slots keep the default spectrum.
  assert.match(t1, /<a:accent2><a:srgbClr val="4DA46B"\/>/);
  // The notes theme is themed identically (theme2 is 1:1 with the notes master).
  assert.match(parts['ppt/theme/theme2.xml'] as string, /<a:accent1><a:srgbClr val="FF0000"\/>/);
});

test('no theme → theme1 is byte-for-byte the pre-1.56 default scheme', () => {
  const slide: PptxSlide = { shapes: [{ kind: 'rect', x: 0, y: 0, cx: 10, cy: 10 }], media: [] };
  const t1 = buildPptxParts([slide], {})['ppt/theme/theme1.xml'] as string;
  assert.match(t1, /<a:clrScheme name="Lolly"><a:dk1><a:srgbClr val="000000"\/><\/a:dk1>/);
  assert.match(t1, /<a:accent1><a:srgbClr val="5194D5"\/>/);
  assert.match(t1, /<a:majorFont><a:latin typeface="Calibri"\/>/);
});

// ─── 1.56.0 hardening (adversarial-verify findings F1–F5) ────────────────────
test('a colSpan passing under an existing rowSpan does not corrupt the merge grid (F1)', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: 0, y: 0, cx: 300, cy: 300, cols: [100, 100, 100], rows: [
      { cells: [{ text: 'A' }, { text: 'B', rowSpan: 2 }, { text: 'C' }] },
      { cells: [{ text: 'wide', colSpan: 3 }] },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  const rows = [...xml.matchAll(/<a:tr [^>]*>([\s\S]*?)<\/a:tr>/g)].map(m => m[1]!);
  for (const r of rows) assert.equal((r.match(/<a:tc[ >]/g) || []).length, 3);
  assert.doesNotMatch(xml, /<a:tc hMerge="1" vMerge="1">/);
  assert.match(rows[1]!, /<a:tc vMerge="1">/);
  assert.doesNotMatch(rows[1]!, /gridSpan="3"/);
});

test('an empty cols[] still emits gridCol-count === tc-per-row-count (F2)', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: 0, y: 0, cx: 500, cy: 100, cols: [], rows: [{ cells: [{ text: 'x' }] }] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  const gridCols = (xml.match(/<a:gridCol /g) || []).length;
  const row = /<a:tr [^>]*>([\s\S]*?)<\/a:tr>/.exec(xml)![1]!;
  assert.equal(gridCols, 1);
  assert.equal((row.match(/<a:tc[ >]/g) || []).length, gridCols);
});

test('non-finite table geometry never leaks a literal NaN attribute (F3)', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'table', x: NaN, y: 0, cx: Infinity, cy: 100, cols: [NaN, 100], rows: [
      { cells: [{ text: 'a', colSpan: NaN }, { text: 'b' }] },
    ] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.doesNotMatch(xml, /NaN|Infinity/);
  const row = /<a:tr [^>]*>([\s\S]*?)<\/a:tr>/.exec(xml)![1]!;
  assert.equal((row.match(/<a:tc[ >]/g) || []).length, 2);
});

test('a pathological table is capped, not unbounded (F5)', () => {
  const cols = Array.from({ length: 1000 }, () => 100);
  const rows = Array.from({ length: 5000 }, () => ({ cells: [{ text: 'x' }] }));
  const slide: PptxSlide = { shapes: [{ kind: 'table', x: 0, y: 0, cx: 500, cy: 500, cols, rows }], media: [] };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.ok((xml.match(/<a:gridCol /g) || []).length <= 128);
  assert.ok((xml.match(/<a:tr /g) || []).length <= 512);
});

test('illegal XML control chars are stripped from run text and notes (F4)', () => {
  const ctrl = String.fromCharCode(1) + String.fromCharCode(0x1f);
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 100, cy: 100, paras: [{ runs: [{ text: 'a' + ctrl + 'bc', sizePt: 12 }] }] }],
    media: [],
    notes: 'note' + ctrl + 'here',
  };
  const parts = buildPptxParts([slide], {});
  assert.match(parts['ppt/slides/slide1.xml'] as string, /<a:t>abc<\/a:t>/);
  assert.doesNotMatch(parts['ppt/notesSlides/notesSlide1.xml'] as string, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
});

test('a struck-through run adds strike="sngStrike" (F10)', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 100, cy: 100, paras: [{ runs: [{ text: 's', sizePt: 12, strike: true, underline: true }] }] }],
    media: [],
  };
  const xml = buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /u="sng" strike="sngStrike" dirty="0"/);
});

test('a run with linkSlide emits an internal slide-jump hlinkClick + slide→slide rel', () => {
  const slide: PptxSlide = {
    shapes: [{ kind: 'text', x: 0, y: 0, cx: 500, cy: 200, paras: [
      { runs: [{ text: 'Agenda item', sizePt: 20, linkSlide: 2 }] },
    ] }],
    media: [],
  };
  const parts = buildPptxParts([slide, { shapes: [], media: [] }, { shapes: [], media: [] }], {});
  const xml = parts['ppt/slides/slide1.xml'] as string;
  const rels = parts['ppt/slides/_rels/slide1.xml.rels'] as string;
  // No media/notes → the link rel is the first free id (rId2), and the run points at it.
  assert.match(xml, /<a:hlinkClick r:id="rId2" action="ppaction:\/\/hlinksldjump"\/>/);
  assert.match(rels, /Id="rId2" Type="[^"]*\/slide" Target="slide3\.xml"/);
  // A slide with no links carries no slide-jump rel and no stale map leaks into it.
  assert.doesNotMatch(buildPptxParts([slide], {})['ppt/slides/slide1.xml'] as string, /rId3/);
});
