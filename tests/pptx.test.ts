/**
 * PPTX builder contract tests.
 * Run with: node --test tests/pptx.test.ts
 *
 * buildPptxParts returns the pre-zip OOXML part tree (path → bytes/string). These
 * assert the tree is complete and internally consistent — the parts a valid deck
 * needs, one media + slide + rels per input, and rels that actually point at parts
 * that exist — without pulling in a zip library.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPptxParts, EMU_PER_PX } from '../engine/src/pptx.ts';
import type { PptxSlideInput } from '../engine/src/pptx.ts';

const slide = (ext: PptxSlideInput['ext'] = 'emf'): PptxSlideInput =>
  ({ image: new Uint8Array([1, 2, 3, 4]), ext, wPx: 1280, hPx: 720 });

test('single-slide deck has the full required part tree', () => {
  const parts = buildPptxParts([slide()], { emuW: 1280 * EMU_PER_PX, emuH: 720 * EMU_PER_PX });
  for (const required of [
    '[Content_Types].xml', '_rels/.rels',
    'ppt/presentation.xml', 'ppt/_rels/presentation.xml.rels',
    'ppt/slideMasters/slideMaster1.xml', 'ppt/slideMasters/_rels/slideMaster1.xml.rels',
    'ppt/slideLayouts/slideLayout1.xml', 'ppt/slideLayouts/_rels/slideLayout1.xml.rels',
    'ppt/theme/theme1.xml', 'docProps/core.xml', 'docProps/app.xml',
    'ppt/slides/slide1.xml', 'ppt/slides/_rels/slide1.xml.rels', 'ppt/media/image1.emf',
  ]) {
    assert.ok(required in parts, `missing part ${required}`);
  }
  assert.ok(parts['ppt/media/image1.emf'] instanceof Uint8Array, 'media is raw bytes');
});

test('N slides produce N slide/rels/media parts and N sldId entries', () => {
  const parts = buildPptxParts([slide(), slide('png'), slide()], {});
  for (const i of [1, 2, 3]) {
    assert.ok(`ppt/slides/slide${i}.xml` in parts);
    assert.ok(`ppt/slides/_rels/slide${i}.xml.rels` in parts);
  }
  assert.ok('ppt/media/image1.emf' in parts);
  assert.ok('ppt/media/image2.png' in parts, 'per-slide extension is honoured');
  assert.ok('ppt/media/image3.emf' in parts);
  const pres = parts['ppt/presentation.xml'] as string;
  assert.equal([...pres.matchAll(/<p:sldId /g)].length, 3);
  // Slide ids start at 256 and slide rels are rId2..rId4 (rId1 is the master).
  assert.match(pres, /<p:sldId id="256" r:id="rId2"\/>/);
  assert.match(pres, /<p:sldId id="258" r:id="rId4"\/>/);
});

test('content types declare each media extension used', () => {
  const ct = buildPptxParts([slide('emf'), slide('png')], {})['[Content_Types].xml'] as string;
  assert.match(ct, /Extension="emf" ContentType="image\/x-emf"/);
  assert.match(ct, /Extension="png" ContentType="image\/png"/);
  // Slide overrides present for both slides.
  assert.equal([...ct.matchAll(/presentationml\.slide\+xml/g)].length, 2);
});

test('slide rels point at the layout and the matching media file', () => {
  const rels = buildPptxParts([slide('png')], {})['ppt/slides/_rels/slide1.xml.rels'] as string;
  assert.match(rels, /Target="\.\.\/slideLayouts\/slideLayout1\.xml"/);
  assert.match(rels, /Target="\.\.\/media\/image1\.png"/);
  // The slide's blip must embed the same rId the image rel declares.
  const slideXml = buildPptxParts([slide('png')], {})['ppt/slides/slide1.xml'] as string;
  assert.match(slideXml, /<a:blip r:embed="rId2"\/>/);
  assert.match(rels, /Id="rId2" Type="[^"]*\/image"/);
});

test('deck slide size comes from opts EMU; presentation carries sldSz', () => {
  const parts = buildPptxParts([slide()], { emuW: 9144000, emuH: 6858000 });
  assert.match(parts['ppt/presentation.xml'] as string, /<p:sldSz cx="9144000" cy="6858000"\/>/);
});

test('a portrait picture into a landscape deck is pillarboxed and centred', () => {
  // deck 1000×500 EMU, picture aspect 1:2 (portrait) → cx = 500*0.5 = 250, centred x=375.
  const parts = buildPptxParts([{ image: new Uint8Array([0]), ext: 'png', wPx: 100, hPx: 200 }], { emuW: 1000, emuH: 500 });
  const s = parts['ppt/slides/slide1.xml'] as string;
  assert.match(s, /<a:off x="375" y="0"\/><a:ext cx="250" cy="500"\/>/);
});

test('empty slide list throws', () => {
  assert.throws(() => buildPptxParts([], {}), /at least one slide/);
});

test('.rels use the package Relationships namespace, not a doubled/officeDocument one', () => {
  // Regression: the container xmlns must be .../package/2006/relationships. A wrong
  // namespace (e.g. .../officeDocument/2006/relationships/relationships) makes every
  // relationship fail to resolve → LibreOffice rejects the file, PowerPoint "repairs".
  const parts = buildPptxParts([slide()], {});
  for (const [path, content] of Object.entries(parts)) {
    if (!path.endsWith('.rels')) continue;
    const xml = content as string;
    assert.match(xml, /<Relationships xmlns="http:\/\/schemas\.openxmlformats\.org\/package\/2006\/relationships">/, `${path} container ns`);
    assert.doesNotMatch(xml, /relationships\/relationships/, `${path} has a doubled namespace`);
  }
});
