// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 274 work package 1: what `readPptx` learned so a renovation's stage 1 can
 * account for a real deck (plans/274-rebrand-renovate-journey.md sections 3.1,
 * 7 and 9).
 *
 * Seven additions, one group of tests each: group composition into slide
 * coordinates, run hyperlinks, gradient and modified colours, alt text, a
 * fallback picture for content the reader does not model, warnings in place of
 * silent truncation, and native chart caches.
 *
 * The parts are hand-authored XML strings, so nothing here needs a fixture file
 * on disk and every test runs everywhere. jsdom stands in for the shell's native
 * DOMParser, exactly as in tests/pptx-read.test.ts.
 *
 * Run with: node --test tests/pptx-read-274.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { PPTX_FORMATTING_READER_SINCE, readPptx } from '../engine/src/pptx-read.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import type {
  PptxParts,
  PptxPicNode,
  PptxReadPara,
  PptxReadRun,
  PptxReadNode,
  PptxShapeNode,
  PptxTextNode,
  PptxUnknownNode,
} from '../engine/src/pptx-read.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

// ─── the smallest deck that reads ────────────────────────────────────────────

const NS_P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';
const DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const PRESENTATION = `${DECL}
<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
  <p:sldIdLst><p:sldId id="256" r:id="rId2"/></p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;

const PRESENTATION_RELS = `${DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId2" Type="${NS_R}/slide" Target="slides/slide1.xml"/>
  <Relationship Id="rId3" Type="${NS_R}/theme" Target="theme/theme1.xml"/>
</Relationships>`;

const THEME = `${DECL}
<a:theme xmlns:a="${NS_A}" name="T">
  <a:themeElements>
    <a:clrScheme name="C">
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
    <a:fontScheme name="F">
      <a:majorFont><a:latin typeface="Calibri Light"/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/></a:minorFont>
    </a:fontScheme>
  </a:themeElements>
</a:theme>`;

const NO_RELS = `${DECL}<Relationships xmlns="${NS_PKG_REL}"/>`;

/** A slide part around `tree`, with every namespace these tests use declared. */
function slide(tree: string): string {
  return `${DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}" xmlns:c="${NS_C}" xmlns:mc="${NS_MC}"><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`;
}

function deckOf(tree: string, extra: PptxParts = {}, rels = NO_RELS): PptxParts {
  return {
    'ppt/presentation.xml': PRESENTATION,
    'ppt/_rels/presentation.xml.rels': PRESENTATION_RELS,
    'ppt/theme/theme1.xml': THEME,
    'ppt/slides/slide1.xml': slide(tree),
    'ppt/slides/_rels/slide1.xml.rels': rels,
    ...extra,
  };
}

function nodesOf(parts: PptxParts): PptxReadNode[] {
  return readPptx(parts, parseXml).slides[0]?.nodes ?? [];
}

function readOne(tree: string, extra: PptxParts = {}, rels = NO_RELS): PptxReadNode {
  const nodes = nodesOf(deckOf(tree, extra, rels));
  assert.equal(nodes.length, 1, 'the fixture states exactly one node');
  return nodes[0] as PptxReadNode;
}

/** A shape with an optional `a:xfrm` body, so a fixture reads at a glance. */
function sp(id: string, xfrm: string, extra = ''): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"${extra}/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
    <p:spPr>${xfrm}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:sp>`;
}

function xfrm(x: number, y: number, cx: number, cy: number, attrs = ''): string {
  return `<a:xfrm${attrs}><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`;
}

function grp(id: string, own: string, body: string): string {
  return `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="g${id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr>${own}</p:grpSpPr>${body}</p:grpSp>`;
}

/** A group xfrm with a child coordinate space of its own. */
function grpXfrm(o: number[], e: number[], co: number[], ce: number[], attrs = ''): string {
  return `<a:xfrm${attrs}><a:off x="${o[0]}" y="${o[1]}"/><a:ext cx="${e[0]}" cy="${e[1]}"/>
    <a:chOff x="${co[0]}" y="${co[1]}"/><a:chExt cx="${ce[0]}" cy="${ce[1]}"/></a:xfrm>`;
}

const near = (a: number, b: number, tol = 0.5): boolean => Math.abs(a - b) <= tol;

// ─── 1. group composition ────────────────────────────────────────────────────

test('a group composes chOff/chExt into its child, so the box names a place on the SLIDE', () => {
  const node = readOne(grp('4', grpXfrm([1000, 2000], [400, 200], [0, 0], [200, 100]), sp('5', xfrm(50, 25, 100, 50))));
  // off + (authored - chOff) * (ext / chExt): 1000 + 50*2 = 1100, 2000 + 25*2 = 2050.
  assert.equal(node.xEmu, 1100);
  assert.equal(node.yEmu, 2050);
  assert.equal(node.cxEmu, 200, 'the extent scales with the group');
  assert.equal(node.cyEmu, 100);
  assert.deepEqual(node.groupPath, ['4']);
  assert.equal(node.transform, undefined, 'a translate-and-scale needs no affine');
});

test('nested groups compose, outermost first in groupPath', () => {
  const inner = grp('11', grpXfrm([10, 10], [40, 40], [0, 0], [20, 20]), sp('12', xfrm(5, 5, 10, 10)));
  const node = readOne(grp('10', grpXfrm([0, 0], [200, 200], [0, 0], [100, 100]), inner));
  // inner puts the child at (20, 20) size 20; the outer doubles that again.
  assert.equal(node.xEmu, 40);
  assert.equal(node.yEmu, 40);
  assert.equal(node.cxEmu, 40);
  assert.deepEqual(node.groupPath, ['10', '11']);
});

test('a group that states no chOff/chExt is a plain translate, not a divide by zero', () => {
  const node = readOne(grp('4', `<a:xfrm><a:off x="500" y="500"/><a:ext cx="100" cy="100"/></a:xfrm>`, sp('5', xfrm(70, 80, 10, 10))));
  assert.equal(node.xEmu, 70, 'the child keeps its authored place');
  assert.equal(node.yEmu, 80);
  assert.equal(node.cxEmu, 10);
});

test('a rotated group carries the full affine as well as the axis-aligned box', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' rot="5400000"'), sp('5', xfrm(0, 0, 100, 50))));
  assert.ok(near(node.rot ?? 0, 90), `rot composes to 90, got ${String(node.rot)}`);
  // The child's centre (50, 25) turns a quarter turn about the group's centre.
  assert.ok(near(node.xEmu + node.cxEmu / 2, 75), `centre x, got ${node.xEmu}`);
  assert.ok(near(node.yEmu + node.cyEmu / 2, 50), `centre y, got ${node.yEmu}`);
  const t = node.transform;
  assert.ok(t, 'a rotation makes the axis-aligned box an approximation, so the affine is exposed');
  assert.equal(t.length, 6);
  assert.ok(near(t[0] * t[3] - t[1] * t[2], 1, 1e-6), 'a rotation preserves orientation');
});

test('a flipped group yields a reflecting affine (determinant below zero)', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipH="1"'), sp('5', xfrm(10, 0, 20, 20))));
  // The child's centre sits at 20; mirrored about the group centre (50) it is 80,
  // so a 20-wide box starts at 70.
  assert.equal(node.xEmu, 70, 'the child mirrors about the group centre');
  assert.equal(node.cxEmu, 20);
  const t = node.transform;
  assert.ok(t, 'a flip cannot be described by box + rot');
  assert.ok(t[0] * t[3] - t[1] * t[2] < 0, 'the affine reflects');
});

// A mirror is not a half turn. `rot` is what the two in-tree consumers of this
// read use on its own, so a sideways mirror reported as `rot: 180` draws a
// chevron upside down as well as backwards. These three pin the three cases
// apart so they cannot collapse into one another again.

test('a sideways mirror reads as a mirror, NOT as a half turn', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipH="1"'), sp('5', xfrm(10, 20, 30, 40))));
  assert.equal(node.rot, undefined, 'no rotation was stated and none is reported');
  assert.equal(node.flipH, true);
  assert.equal(node.flipV, undefined);
});

test('a top-to-bottom mirror reads the same way round', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipV="1"'), sp('5', xfrm(10, 20, 30, 40))));
  assert.equal(node.rot, undefined);
  assert.equal(node.flipV, true);
  assert.equal(node.flipH, undefined);
});

test('two mirrors ARE a half turn, and are reported as one', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipH="1" flipV="1"'), sp('5', xfrm(10, 20, 30, 40))));
  assert.equal(node.rot, 180);
  assert.equal(node.flipH, undefined, 'a half turn needs no mirror to describe it');
  assert.equal(node.flipV, undefined);
});

test("a mirrored group carrying a turned child states both, and the child's own mirror cancels the group's", () => {
  const turned = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipH="1"'), sp('5', xfrm(0, 0, 40, 20, ' rot="2700000"'))));
  assert.ok(near(turned.rot ?? 0, -45), `a mirror reverses the turn it carries, got ${String(turned.rot)}`);
  assert.equal(turned.flipH, true);

  const cancelled = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100], ' flipH="1"'), sp('5', xfrm(10, 20, 30, 40, ' flipH="1"'))));
  assert.equal(cancelled.flipH, undefined, 'two mirrors in the same axis leave the child unmirrored');
  assert.equal(cancelled.rot, undefined);
  assert.equal(cancelled.transform, undefined, 'and the composition is a plain translate again');
});

test('an ungrouped shape states its own mirror and keeps its authored box', () => {
  const node = readOne(sp('5', xfrm(10, 20, 30, 40, ' flipH="1"')));
  assert.equal(node.xEmu, 10, 'a mirror about the box centre leaves the box where it is');
  assert.equal(node.cxEmu, 30);
  assert.equal(node.flipH, true);
  assert.equal(node.rot, undefined);
  assert.equal(node.transform, undefined, 'box, rot and the mirror say it all, so no affine is needed');
  assert.equal(node.groupPath, undefined);
  assert.equal(readOne(sp('5', xfrm(10, 20, 30, 40))).flipH, undefined, 'and an unmirrored shape states nothing');
});

test('a group child keeps its own rotation, composed with the group', () => {
  const node = readOne(grp('4', grpXfrm([0, 0], [100, 100], [0, 0], [100, 100]), sp('5', xfrm(0, 0, 40, 20, ' rot="2700000"'))));
  assert.ok(near(node.rot ?? 0, 45), `the child's own 45 degrees survives, got ${String(node.rot)}`);
  assert.ok(node.transform, 'and the affine states it exactly');
});

// ─── 2. hyperlinks ───────────────────────────────────────────────────────────

const LINK_RELS = `${DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId8" Type="${NS_R}/hyperlink" Target="https://example.org/report" TargetMode="External"/>
  <Relationship Id="rId9" Type="${NS_R}/slide" Target="slide3.xml"/>
</Relationships>`;

const LINKED_TEXT = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
  <p:spPr>${xfrm(0, 0, 100, 100)}</p:spPr>
  <p:txBody><a:bodyPr/><a:lstStyle/>
    <a:p>
      <a:r><a:rPr lang="en-US"><a:hlinkClick r:id="rId8"/></a:rPr><a:t>Read the report</a:t></a:r>
      <a:r><a:rPr lang="en-US"><a:hlinkClick r:id="rId9" action="ppaction://hlinksldjump"/></a:rPr><a:t>Jump</a:t></a:r>
      <a:r><a:rPr lang="en-US"><a:hlinkClick action="ppaction://hlinkshowjump?jump=nextslide"/></a:rPr><a:t>Next</a:t></a:r>
      <a:r><a:rPr lang="en-US"/><a:t>Plain</a:t></a:r>
    </a:p>
  </p:txBody></p:sp>`;

test('a run carries its a:hlinkClick target: an external URL, a slide jump, or the bare action', () => {
  const node = readOne(LINKED_TEXT, {}, LINK_RELS) as PptxTextNode;
  assert.equal(node.type, 'text');
  const runs = node.paras[0]?.runs ?? [];
  assert.equal(runs[0]?.href, 'https://example.org/report', 'an external rel gives the URL verbatim');
  assert.equal(runs[1]?.href, 'ppt/slides/slide3.xml', 'an internal jump gives the resolved part path');
  assert.equal(runs[2]?.href, 'ppaction://hlinkshowjump?jump=nextslide', 'no rel leaves the action visible');
  assert.equal(runs[3]?.href, undefined, 'a run with no link carries none');
});

test('a link whose relationship is missing reads as no link, not as a broken id', () => {
  const node = readOne(LINKED_TEXT, {}, NO_RELS) as PptxTextNode;
  const runs = node.paras[0]?.runs ?? [];
  assert.equal(runs[0]?.href, undefined);
  assert.equal(runs[1]?.href, 'ppaction://hlinksldjump', 'the action still stands on its own');
});

// ─── 3. colours: gradients and the DrawingML transforms ──────────────────────

function filled(body: string): PptxShapeNode {
  return readOne(
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
      <p:spPr>${xfrm(0, 0, 10, 10)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${body}</p:spPr></p:sp>`,
  ) as PptxShapeNode;
}

test('a gradFill resolves to its FIRST stop and says the source was a ramp', () => {
  const node = filled(
    `<a:gradFill><a:gsLst>
       <a:gs pos="100000"><a:srgbClr val="FF0000"/></a:gs>
       <a:gs pos="0"><a:schemeClr val="accent1"/></a:gs>
     </a:gsLst></a:gradFill>`,
  );
  assert.deepEqual(node.fill, { scheme: 'accent1', hex: '4472C4' }, 'the lowest pos wins, whatever order it is written in');
  assert.equal(node.gradient, true);
});

test('a gradFill with no readable stop still reports the gradient', () => {
  const node = filled(`<a:gradFill><a:gsLst><a:gs pos="0"><a:prstClr val="black"/></a:gs></a:gsLst></a:gradFill>`);
  assert.equal(node.fill, undefined);
  assert.equal(node.gradient, true);
});

test('lumMod + lumOff resolve to a hex and KEEP the theme slot', () => {
  const node = filled(`<a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr></a:solidFill>`);
  // accent1 4472C4 "Lighter 40%" is 8FAADC in PowerPoint's own palette.
  assert.deepEqual(node.fill, { scheme: 'accent1', hex: '8FAADC', modified: true });
});

test('shade darkens a literal colour and marks the hex as computed', () => {
  const node = filled(`<a:solidFill><a:srgbClr val="4472C4"><a:shade val="50000"/></a:srgbClr></a:solidFill>`);
  assert.deepEqual(node.fill, { hex: '2F528F', modified: true });
});

// ECMA-376 measures a shade and a tint against LINEAR light, so half of pure
// green is 00BC00 and not 008000: multiplying the 0..255 codes is out by 60 of
// them on that channel, which is the difference between a census recognising
// the colour a deck shows and not. These pin the definition, not the code.

test('a shade is half the LIGHT, not half the code value', () => {
  assert.deepEqual(filled(`<a:solidFill><a:srgbClr val="00FF00"><a:shade val="50000"/></a:srgbClr></a:solidFill>`).fill, {
    hex: '00BC00',
    modified: true,
  });
});

test('a tint mixes with white in the same light', () => {
  assert.deepEqual(filled(`<a:solidFill><a:srgbClr val="00FF00"><a:tint val="50000"/></a:srgbClr></a:solidFill>`).fill, {
    hex: 'BCFFBC',
    modified: true,
  });
});

test('a full shade and an empty tint are exact, so the table inverts itself', () => {
  assert.deepEqual(filled(`<a:solidFill><a:srgbClr val="4472C4"><a:shade val="100000"/></a:srgbClr></a:solidFill>`).fill, {
    hex: '4472C4',
  });
  assert.deepEqual(filled(`<a:solidFill><a:srgbClr val="4472C4"><a:tint val="0"/></a:srgbClr></a:solidFill>`).fill, {
    hex: 'FFFFFF',
    modified: true,
  });
});

test('a gradient OUTLINE says so, instead of reading as a stated flat line colour', () => {
  const node = filled(
    `<a:ln w="12700"><a:gradFill><a:gsLst>
       <a:gs pos="100000"><a:srgbClr val="FF0000"/></a:gs>
       <a:gs pos="0"><a:schemeClr val="accent2"/></a:gs>
     </a:gsLst></a:gradFill></a:ln>`,
  );
  assert.deepEqual(node.line, { scheme: 'accent2', hex: 'ED7D31' }, 'the lowest stop is the nearest single colour');
  assert.equal(node.lineGradient, true, 'and the ramp is not passed off as a flat outline');
  assert.equal(node.lineWidthPt, 1);
});

test('a flat outline carries no gradient marker', () => {
  const node = filled(`<a:ln><a:solidFill><a:srgbClr val="112233"/></a:solidFill></a:ln>`);
  assert.deepEqual(node.line, { hex: '112233' });
  assert.equal(node.lineGradient, undefined);
});

// A slide's ground reads the way a shape's fill does, so a gradient ground is a
// stop plus a marker rather than nothing at all.

function groundOf(bg: string): ReturnType<typeof readPptx>['slides'][number]['background'] {
  const part = `${DECL}<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld>${bg}<p:spTree/></p:cSld></p:sld>`;
  return readPptx({ ...deckOf(''), 'ppt/slides/slide1.xml': part }, parseXml).slides[0]?.background;
}

test('a gradient ground reads as its lowest stop and says it was a ramp', () => {
  const ground = groundOf(`<p:bg><p:bgPr><a:gradFill><a:gsLst>
      <a:gs pos="100000"><a:srgbClr val="FF0000"/></a:gs>
      <a:gs pos="0"><a:schemeClr val="accent3"/></a:gs>
    </a:gsLst></a:gradFill></p:bgPr></p:bg>`);
  assert.deepEqual(ground?.color, { scheme: 'accent3', hex: 'A5A5A5' });
  assert.equal(ground?.gradient, true);
});

test('a solid ground still reads exactly as it did, with no gradient marker', () => {
  const ground = groundOf(`<p:bg><p:bgPr><a:solidFill><a:srgbClr val="102030"/></a:solidFill></p:bgPr></p:bg>`);
  assert.deepEqual(ground, { color: { hex: '102030' } });
});

test('a colour with no transforms is untouched and carries no `modified` flag', () => {
  const node = filled(`<a:solidFill><a:schemeClr val="accent2"/></a:solidFill>`);
  assert.deepEqual(node.fill, { scheme: 'accent2', hex: 'ED7D31' });
  assert.equal(node.gradient, undefined);
});

test('a run colour takes the transforms too', () => {
  const node = readOne(
    `<p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(0, 0, 10, 10)}</p:spPr>
      <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>
        <a:rPr lang="en-US"><a:solidFill><a:schemeClr val="accent1"><a:lumMod val="60000"/><a:lumOff val="40000"/></a:schemeClr></a:solidFill></a:rPr>
        <a:t>Tinted</a:t></a:r></a:p></p:txBody></p:sp>`,
  ) as PptxTextNode;
  assert.deepEqual(node.paras[0]?.runs[0]?.color, { scheme: 'accent1', hex: '8FAADC', modified: true });
});

// ─── 4. alt text ─────────────────────────────────────────────────────────────

const PIC_RELS = `${DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId2" Type="${NS_R}/image" Target="../media/image1.png"/>
</Relationships>`;

test('descr on p:cNvPr becomes the node alt text', () => {
  const node = readOne(sp('2', xfrm(0, 0, 10, 10), ' descr="A quarterly revenue chart" title="Chart"'));
  assert.equal(node.alt, 'A quarterly revenue chart', 'descr wins over title');
});

test('title stands in when there is no descr', () => {
  const node = readOne(sp('2', xfrm(0, 0, 10, 10), ' title="Partner mark"'));
  assert.equal(node.alt, 'Partner mark');
});

test('a picture carries alt text, and a shape with neither carries none', () => {
  const pic = readOne(
    `<p:pic><p:nvPicPr><p:cNvPr id="3" name="p" descr="The Lolly mascot"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr>${xfrm(0, 0, 10, 10)}</p:spPr></p:pic>`,
    {},
    PIC_RELS,
  ) as PptxPicNode;
  assert.equal(pic.alt, 'The Lolly mascot');
  assert.equal(pic.media, 'ppt/media/image1.png');
  assert.equal(readOne(sp('2', xfrm(0, 0, 10, 10))).alt, undefined);
});

// ─── 5. a fallback picture for content the reader does not model ─────────────

const CHART_FRAME = `<p:graphicFrame>
  <p:nvGraphicFramePr><p:cNvPr id="7" name="Chart 6"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
  <p:xfrm><a:off x="100" y="200"/><a:ext cx="3000" cy="2000"/></p:xfrm>
  <a:graphic><a:graphicData uri="${NS_C}"><c:chart r:id="rId5"/></a:graphicData></a:graphic>
</p:graphicFrame>`;

const ALT_CONTENT = `<mc:AlternateContent>
  <mc:Choice Requires="c">${CHART_FRAME}</mc:Choice>
  <mc:Fallback>
    <p:pic><p:nvPicPr><p:cNvPr id="8" name="fallback"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rId6"/></p:blipFill><p:spPr>${xfrm(100, 200, 3000, 2000)}</p:spPr></p:pic>
  </mc:Fallback>
</mc:AlternateContent>`;

const FALLBACK_RELS = `${DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId6" Type="${NS_R}/image" Target="../media/image7.png"/>
</Relationships>`;

test('an mc:AlternateContent reads its Choice and takes the Fallback picture for it', () => {
  const node = readOne(ALT_CONTENT, {}, FALLBACK_RELS) as PptxUnknownNode;
  assert.equal(node.type, 'unknown', 'the chart keeps its own identity, it is not replaced by the picture');
  assert.equal(node.tag, NS_C, 'with no chart part to read, the graphicData uri stands');
  assert.equal(node.fallbackMedia, 'ppt/media/image7.png');
  assert.equal(node.xEmu, 100, 'and the Choice branch supplies the geometry');
});

test('an AlternateContent whose Fallback carries no picture leaves fallbackMedia absent', () => {
  const bare = `<mc:AlternateContent><mc:Choice Requires="c">${CHART_FRAME}</mc:Choice>
    <mc:Fallback>${sp('9', xfrm(100, 200, 3000, 2000))}</mc:Fallback></mc:AlternateContent>`;
  const node = readOne(bare, {}, FALLBACK_RELS) as PptxUnknownNode;
  assert.equal(node.type, 'unknown');
  assert.equal(node.fallbackMedia, undefined, 'nothing is invented when the file carries nothing');
});

test('a Choice this reader walks to nothing hands on to the Fallback rather than losing it', () => {
  // `p:contentPart` is a structural child walkTree does not model, so the Choice
  // produces no node at all. The Fallback's picture is the only thing in the file
  // for this object, and taking the first Choice on faith would throw it away.
  const opaque = `<mc:AlternateContent>
    <mc:Choice Requires="p14"><p:contentPart r:id="rId7"/></mc:Choice>
    <mc:Fallback>
      <p:pic><p:nvPicPr><p:cNvPr id="8" name="fallback"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId6"/></p:blipFill><p:spPr>${xfrm(5, 6, 70, 80)}</p:spPr></p:pic>
    </mc:Fallback>
  </mc:AlternateContent>`;
  const node = readOne(opaque, {}, FALLBACK_RELS) as PptxPicNode;
  assert.equal(node.type, 'pic', 'the Fallback picture is read');
  assert.equal(node.media, 'ppt/media/image7.png');
  assert.equal(node.xEmu, 5);
});

test('an AlternateContent no branch of which reads says so instead of going quiet', () => {
  const nothing = `<mc:AlternateContent><mc:Choice Requires="p14"><p:contentPart r:id="rId7"/></mc:Choice>
    <mc:Fallback><p:contentPart r:id="rId7"/></mc:Fallback></mc:AlternateContent>`;
  const deck = readPptx(deckOf(nothing), parseXml);
  assert.deepEqual(deck.slides[0]?.nodes, []);
  const hit = (deck.warnings ?? []).find((w) => /AlternateContent/.test(w.message));
  assert.ok(hit, 'the object is accounted for as unread');
  assert.equal(hit.code, 'nodes-truncated');
});

test('with no Choice branch the Fallback itself is read, so no content is lost', () => {
  const only = `<mc:AlternateContent><mc:Fallback>${sp('9', xfrm(7, 8, 9, 10))}</mc:Fallback></mc:AlternateContent>`;
  const node = readOne(only);
  assert.equal(node.type, 'shape');
  assert.equal(node.xEmu, 7);
});

// ─── 7. native chart data (and its own cached picture) ───────────────────────

const BAR_CHART_PART = `${DECL}
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}">
  <c:chart><c:plotArea><c:layout/>
    <c:barChart>
      <c:barDir val="bar"/>
      <c:ser>
        <c:idx val="0"/>
        <c:tx><c:strRef><c:f>Sheet1!$B$1</c:f><c:strCache><c:pt idx="0"><c:v>Revenue</c:v></c:pt></c:strCache></c:strRef></c:tx>
        <c:cat><c:strRef><c:f>Sheet1!$A$2:$A$3</c:f><c:strCache><c:ptCount val="2"/>
          <c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:strCache></c:strRef></c:cat>
        <c:val><c:numRef><c:f>Sheet1!$B$2:$B$3</c:f><c:numCache><c:ptCount val="2"/>
          <c:pt idx="0"><c:v>12.5</c:v></c:pt><c:pt idx="1"><c:v>18</c:v></c:pt></c:numCache></c:numRef></c:val>
      </c:ser>
      <c:ser>
        <c:idx val="1"/>
        <c:tx><c:strRef><c:strCache><c:pt idx="0"><c:v>Cost</c:v></c:pt></c:strCache></c:strRef></c:tx>
        <c:val><c:numRef><c:numCache><c:pt idx="1"><c:v>4</c:v></c:pt></c:numCache></c:numRef></c:val>
      </c:ser>
    </c:barChart>
  </c:plotArea></c:chart>
</c:chartSpace>`;

const CHART_SLIDE_RELS = `${DECL}
<Relationships xmlns="${NS_PKG_REL}">
  <Relationship Id="rId5" Type="${NS_R}/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

test('a native chart surfaces its cached series, categories and bar direction', () => {
  const node = readOne(CHART_FRAME, { 'ppt/charts/chart1.xml': BAR_CHART_PART }, CHART_SLIDE_RELS) as PptxUnknownNode;
  assert.equal(node.tag, 'barChart', 'the tag names the chart type once the part is read');
  const data = node.chartData;
  assert.ok(data, 'chart data is present');
  assert.equal(data.type, 'barChart');
  assert.equal(data.barDir, 'bar', 'horizontal bars are recorded as such');
  assert.deepEqual(data.categories, ['Q1', 'Q2']);
  assert.equal(data.series.length, 2);
  assert.equal(data.series[0]?.name, 'Revenue');
  assert.deepEqual(data.series[0]?.values, [12.5, 18]);
  assert.equal(data.series[1]?.name, 'Cost');
  assert.deepEqual(data.series[1]?.values, [0, 4], 'a hole in the cache reads as 0, never as NaN');
});

test('a pie chart is named as one, and states no bar direction', () => {
  const pie = `${DECL}<c:chartSpace xmlns:c="${NS_C}"><c:chart><c:plotArea><c:pieChart><c:ser>
      <c:val><c:numRef><c:numCache><c:pt idx="0"><c:v>7</c:v></c:pt></c:numCache></c:numRef></c:val>
    </c:ser></c:pieChart></c:plotArea></c:chart></c:chartSpace>`;
  const node = readOne(CHART_FRAME, { 'ppt/charts/chart1.xml': pie }, CHART_SLIDE_RELS) as PptxUnknownNode;
  assert.equal(node.tag, 'pieChart');
  assert.equal(node.chartData?.barDir, undefined);
  assert.deepEqual(node.chartData?.series[0]?.values, [7]);
});

test('a chart part that also relates an image surfaces it as the fallback picture', () => {
  const node = readOne(
    CHART_FRAME,
    {
      'ppt/charts/chart1.xml': BAR_CHART_PART,
      'ppt/charts/_rels/chart1.xml.rels': `${DECL}<Relationships xmlns="${NS_PKG_REL}">
        <Relationship Id="rId1" Type="${NS_R}/package" Target="../embeddings/book.xlsx"/>
        <Relationship Id="rId2" Type="${NS_R}/image" Target="../media/chartcache3.png"/>
      </Relationships>`,
    },
    CHART_SLIDE_RELS,
  ) as PptxUnknownNode;
  assert.equal(node.fallbackMedia, 'ppt/media/chartcache3.png');
});

test('a chart cache past the point cap is truncated AND reported', () => {
  const long = `${DECL}<c:chartSpace xmlns:c="${NS_C}"><c:chart><c:plotArea><c:lineChart><c:ser>
      <c:val><c:numRef><c:numCache><c:ptCount val="9001"/>
        <c:pt idx="0"><c:v>1</c:v></c:pt>
        <c:pt idx="8191"><c:v>2</c:v></c:pt>
        <c:pt idx="9000"><c:v>3</c:v></c:pt>
      </c:numCache></c:numRef></c:val>
    </c:ser></c:lineChart></c:plotArea></c:chart></c:chartSpace>`;
  const deck = readPptx(deckOf(CHART_FRAME, { 'ppt/charts/chart1.xml': long }, CHART_SLIDE_RELS), parseXml);
  const node = deck.slides[0]?.nodes[0] as PptxUnknownNode;
  assert.equal(node.chartData?.series[0]?.values.length, 8192, 'MAX_CHART_POINTS still holds');
  const hit = (deck.warnings ?? []).find((w) => /chart cache/.test(w.message));
  assert.ok(hit, 'a series read short is not passed off as the whole series');
  assert.equal(hit.code, 'nodes-truncated');
  assert.equal(hit.slideIndex, 0);
});

test('a chart with no readable part keeps its uri tag and states no data', () => {
  const node = readOne(CHART_FRAME, {}, CHART_SLIDE_RELS) as PptxUnknownNode;
  assert.equal(node.tag, NS_C);
  assert.equal(node.chartData, undefined);
  assert.equal(node.fallbackMedia, undefined);
});

// ─── 6. warnings instead of silent truncation ────────────────────────────────

function codesOf(parts: PptxParts): string[] {
  return (readPptx(parts, parseXml).warnings ?? []).map((w) => w.code);
}

test('a clean deck reports an empty warnings array, not an absent one', () => {
  const deck = readPptx(deckOf(sp('2', xfrm(0, 0, 10, 10))), parseXml);
  assert.deepEqual(deck.warnings, []);
});

test('a picture whose relationship resolves to nothing raises media-skipped', () => {
  const parts = deckOf(
    `<p:pic><p:nvPicPr><p:cNvPr id="3" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
      <p:blipFill><a:blip r:embed="rId99"/></p:blipFill><p:spPr>${xfrm(0, 0, 10, 10)}</p:spPr></p:pic>`,
  );
  const deck = readPptx(parts, parseXml);
  const hit = (deck.warnings ?? []).find((w) => w.code === 'media-skipped');
  assert.ok(hit, 'the reader says the bytes are missing rather than dropping the fact');
  assert.equal(hit.slideIndex, 0, 'and names the slide it happened on');
  assert.match(hit.message, /rId99/);
});

test('a part over the size cap raises part-too-large', () => {
  const huge = new Uint8Array(25 * 1024 * 1024); // MAX_PART_BYTES is 24 MB
  const parts = deckOf(sp('2', xfrm(0, 0, 10, 10)), { 'ppt/slides/slide1.xml': huge });
  const hit = (readPptx(parts, parseXml).warnings ?? []).find((w) => w.code === 'part-too-large');
  assert.ok(hit);
  assert.match(hit.message, /ppt\/slides\/slide1\.xml/);
});

test('the per-slide node cap raises nodes-truncated once, with a count', () => {
  const parts = deckOf(sp('2', xfrm(0, 0, 10, 10)).repeat(8100));
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides[0]?.nodes.length, 8000, 'the cap still holds');
  const hit = (deck.warnings ?? []).find((w) => w.code === 'nodes-truncated');
  assert.ok(hit, 'and it is reported');
  assert.equal(hit.count, 1, 'a repeat of one warning folds into one row');
});

test('nesting past the group depth cap raises group-depth-exceeded', () => {
  let tree = sp('9', xfrm(0, 0, 10, 10));
  for (let i = 0; i < 40; i++) tree = grp(String(100 + i), grpXfrm([0, 0], [10, 10], [0, 0], [10, 10]), tree);
  const deck = readPptx(deckOf(tree), parseXml);
  assert.deepEqual(deck.slides[0]?.nodes, [], 'nothing past the cap is read');
  assert.ok((deck.warnings ?? []).some((w) => w.code === 'group-depth-exceeded'));
});

test('more slides than the reader carries raises slides-truncated', () => {
  const ids: string[] = [];
  const rels: string[] = [];
  for (let i = 0; i < 2100; i++) {
    ids.push(`<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`);
    rels.push(`<Relationship Id="rId${100 + i}" Type="${NS_R}/slide" Target="slides/slide${i + 1}.xml"/>`);
  }
  const parts: PptxParts = {
    'ppt/presentation.xml': `${DECL}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
      <p:sldIdLst>${ids.join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `${DECL}<Relationships xmlns="${NS_PKG_REL}">${rels.join('')}</Relationships>`,
    'ppt/theme/theme1.xml': THEME,
  };
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides.length, 2000, 'MAX_SLIDES holds');
  assert.ok(codesOf(parts).includes('slides-truncated'));
  void deck;
});

test('the warnings list says when it is itself incomplete', () => {
  // One distinct warning per slide (same code and message, different slide), so
  // the list's own cap is what is under test rather than any single parser cap.
  const count = 300;
  const ids: string[] = [];
  const rels: string[] = [];
  const parts: PptxParts = { 'ppt/theme/theme1.xml': THEME };
  const broken = `<p:pic><p:nvPicPr><p:cNvPr id="3" name="p"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="rId99"/></p:blipFill><p:spPr>${xfrm(0, 0, 10, 10)}</p:spPr></p:pic>`;
  for (let i = 0; i < count; i++) {
    ids.push(`<p:sldId id="${256 + i}" r:id="rId${100 + i}"/>`);
    rels.push(`<Relationship Id="rId${100 + i}" Type="${NS_R}/slide" Target="slides/slide${i + 1}.xml"/>`);
    parts[`ppt/slides/slide${i + 1}.xml`] = slide(broken);
    parts[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = NO_RELS;
  }
  parts['ppt/presentation.xml'] = `${DECL}<p:presentation xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}">
    <p:sldIdLst>${ids.join('')}</p:sldIdLst><p:sldSz cx="9144000" cy="6858000"/></p:presentation>`;
  parts['ppt/_rels/presentation.xml.rels'] = `${DECL}<Relationships xmlns="${NS_PKG_REL}">${rels.join('')}</Relationships>`;

  const warnings = readPptx(parts, parseXml).warnings ?? [];
  assert.equal(warnings.length, 256, 'MAX_WARNINGS holds');
  const last = warnings[255];
  assert.ok(last, 'the last row exists');
  assert.match(last.message, /kinds of warning/, 'and it is the list accounting for itself');
  assert.equal(last.count, count - 255, 'counting every kind it had no room for');
});

test('a hostile deck still returns: warnings are reported, nothing throws', () => {
  const parts = deckOf(`<p:sp><p:nvSpPr/><p:spPr><a:xfrm><a:off x="x" y="y"/></a:xfrm></p:spPr></p:sp>`);
  assert.doesNotThrow(() => readPptx(parts, parseXml));
});

// ─── the committed adversarial fixture (plan 274 section 9) ──────────────────
//
// tests/fixtures/rebrand/adversarial.pptx is built by
// scripts/build-rebrand-fixtures.ts and committed, so this runs everywhere. It
// checks the two additions that a hand-authored part map cannot prove on its
// own: a real group composes into slide coordinates, and the fallback picture
// of an mc:AlternateContent is found in a file PowerPoint would open.

const FIXTURE = new URL('./fixtures/rebrand/adversarial.pptx', import.meta.url);
const EMU_PER_REF_PX = 9525; // 96 dpi, the reference the labels file states boxes in

test('the adversarial fixture: a group composes to slide coordinates', async () => {
  const { readFileSync } = await import('node:fs');
  const { unzipSync } = await import('fflate');
  const parts = unzipSync(new Uint8Array(readFileSync(FIXTURE))) as unknown as PptxParts;
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides.length, 3);

  const grouped = (deck.slides[0]?.nodes ?? []).filter((n) => n.groupPath);
  assert.equal(grouped.length, 2, 'slide 1 holds one group of two children');
  const px = (v: number): number => v / EMU_PER_REF_PX;
  // The group states an extent half its child extent, and both children are
  // authored full size, so a correct composition halves them. These are the
  // boxes adversarial.labels.json states for slide1.71 and slide1.72.
  const bar = grouped[0] as PptxShapeNode;
  assert.deepEqual(
    [px(bar.xEmu), px(bar.yEmu), px(bar.cxEmu), px(bar.cyEmu)],
    [120, 470, 200, 30],
    'the bar sits where a composed group puts it, not at its authored full size',
  );
  const caption = grouped[1] as PptxTextNode;
  assert.deepEqual([px(caption.xEmu), px(caption.yEmu), px(caption.cxEmu), px(caption.cyEmu)], [120, 510, 280, 30]);
  assert.deepEqual(bar.groupPath, ['70'], 'the group cNvPr id is the ancestry entry');
  assert.deepEqual(caption.groupPath, ['70']);
  assert.equal(bar.transform, undefined, 'a scale-and-translate group needs no affine');
});

test('the adversarial fixture: the AlternateContent fallback picture is found, the chart without one has none', async () => {
  const { readFileSync } = await import('node:fs');
  const { unzipSync } = await import('fflate');
  const parts = unzipSync(new Uint8Array(readFileSync(FIXTURE))) as unknown as PptxParts;
  const deck = readPptx(parts, parseXml);

  const withFallback = (deck.slides[2]?.nodes ?? []).filter((n): n is PptxUnknownNode => n.type === 'unknown');
  assert.equal(withFallback.length, 1, 'the Choice branch reads as one object, not two');
  assert.equal(withFallback[0]?.fallbackMedia, 'ppt/media/image3_2.png', 'the file carries real bytes for it');
  assert.ok(withFallback[0]?.chartData, 'and the chart part states its own cached series');

  const bare = (deck.slides[1]?.nodes ?? []).filter((n): n is PptxUnknownNode => n.type === 'unknown');
  assert.equal(bare.length, 1);
  assert.equal(bare[0]?.fallbackMedia, undefined, 'a chart with no picture in the file gets none invented for it');
});

test('the adversarial fixture: the long URL keeps its hyperlink', async () => {
  const { readFileSync } = await import('node:fs');
  const { unzipSync } = await import('fflate');
  const parts = unzipSync(new Uint8Array(readFileSync(FIXTURE))) as unknown as PptxParts;
  const deck = readPptx(parts, parseXml);
  const links: string[] = [];
  for (const node of deck.slides[0]?.nodes ?? []) {
    if (node.type !== 'text') continue;
    for (const para of node.paras) for (const run of para.runs) if (run.href) links.push(run.href);
  }
  assert.deepEqual(links, ['https://example.invalid/reports/2021/regional-performance-and-outlook/full-text']);
});

// ─── plan 275 section 7.2: paragraph formatting through the cascade ──────────

const FORMATTING = new URL('./fixtures/rebrand/formatting.pptx', import.meta.url);
const FORMATTING_LABELS = new URL('./fixtures/rebrand/formatting.labels.json', import.meta.url);

interface LabelRun { text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; baseline?: 'super' | 'sub'; case?: 'upper' | 'small-caps'; sizePt?: number }
interface LabelPara {
  runs: LabelRun[];
  lvl?: number;
  bullet?: 'none' | 'bullet' | 'number';
  bulletChar?: string;
  numberStyle?: string;
  align?: string;
  lineSpacingPct?: number;
  spaceBeforePt?: number;
  indentPx?: number;
  firstIndentPx?: number;
}

test('plan 275: the reader resolves every paragraph and run property the formatting fixture states', async () => {
  const { readFileSync } = await import('node:fs');
  const { unzipSync } = await import('fflate');
  const parts = unzipSync(new Uint8Array(readFileSync(FORMATTING))) as unknown as PptxParts;
  const deck = readPptx(parts, parseXml);
  const labels = JSON.parse(readFileSync(FORMATTING_LABELS, 'utf8')) as { slides: Array<{ objects: Array<{ id: string; paras?: LabelPara[] }> }> };
  const EMU_PER_PX = 9525;
  let checked = 0;
  for (const [s, slide] of labels.slides.entries()) {
    const nodes = deck.slides[s]?.nodes ?? [];
    for (const [i, object] of slide.objects.entries()) {
      if (!object.paras) continue;
      const node = nodes[i];
      assert.ok(node && node.type === 'text', `${object.id}: a text node`);
      for (const [p, want] of object.paras.entries()) {
        const got: PptxReadPara | undefined = (node as PptxTextNode).paras[p];
        const where = `${object.id} paragraph ${p}`;
        assert.ok(got, `${where}: read`);
        assert.equal(got.bullet, want.bullet, `${where}: marker kind`);
        assert.equal(got.bulletChar, want.bulletChar, `${where}: glyph`);
        assert.equal(got.numberStyle, want.numberStyle, `${where}: numbering scheme`);
        assert.equal(got.align, want.align, `${where}: alignment`);
        assert.equal(got.lineSpacingPct, want.lineSpacingPct, `${where}: line spacing`);
        assert.equal(got.spaceBeforePt, want.spaceBeforePt, `${where}: space before`);
        assert.equal(got.marginLeftEmu === undefined ? undefined : got.marginLeftEmu / EMU_PER_PX, want.indentPx, `${where}: left margin`);
        assert.equal(got.indentEmu === undefined ? undefined : got.indentEmu / EMU_PER_PX, want.firstIndentPx, `${where}: first-line indent`);
        for (const [r, run] of want.runs.entries()) {
          const read: PptxReadRun | undefined = got.runs[r];
          assert.equal(Boolean(read?.strike), Boolean(run.strike), `${where} run ${r}: strike`);
          assert.equal(read?.baseline, run.baseline, `${where} run ${r}: baseline`);
          assert.equal(read?.cap === 'all' ? 'upper' : read?.cap === 'small' ? 'small-caps' : undefined, run.case, `${where} run ${r}: letter case`);
        }
        checked += 1;
      }
    }
  }
  assert.equal(checked, 18, 'every labelled paragraph of the three slides was compared');
  assert.equal(deck.slides[0]?.layoutName, 'Content', 'the layout name the slide was built from');
});

test('plan 275: an explicit buNone stops an inherited bullet, and buAutoNum states its scheme and start', () => {
  const master = `${DECL}
<p:sldMaster xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>
<p:txStyles><p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900" algn="l"><a:buChar char="&#8226;"/><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle></p:txStyles></p:sldMaster>`;
  const layout = `${DECL}
<p:sldLayout xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld name="Title and Content"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`;
  const slide = `${DECL}
<p:sld xmlns:a="${NS_A}" xmlns:r="${NS_R}" xmlns:p="${NS_P}"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="b"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100" cy="100"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:p><a:r><a:t>inherited</a:t></a:r></a:p><a:p><a:pPr><a:buNone/></a:pPr><a:r><a:t>stopped</a:t></a:r></a:p>
<a:p><a:pPr algn="ctr"><a:buAutoNum type="alphaLcParenR" startAt="3"/></a:pPr><a:r><a:rPr strike="dblStrike" baseline="-25000" cap="small"/><a:t>third</a:t></a:r></a:p>
<a:p><a:pPr><a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcAft><a:spcPts val="600"/></a:spcAft></a:pPr><a:r><a:rPr strike="noStrike" baseline="0" cap="none"/><a:t>plain again</a:t></a:r></a:p></p:txBody></p:sp>
</p:spTree></p:cSld></p:sld>`;
  const rels = (type: string, target: string): string =>
    `${DECL}<Relationships xmlns="${NS_PKG_REL}"><Relationship Id="rId1" Type="${NS_R}/${type}" Target="${target}"/></Relationships>`;
  const parts: PptxParts = {
    'ppt/presentation.xml': PRESENTATION,
    'ppt/_rels/presentation.xml.rels': PRESENTATION_RELS,
    'ppt/theme/theme1.xml': THEME,
    'ppt/slides/slide1.xml': slide,
    'ppt/slides/_rels/slide1.xml.rels': rels('slideLayout', '../slideLayouts/slideLayout1.xml'),
    'ppt/slideLayouts/slideLayout1.xml': layout,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': rels('slideMaster', '../slideMasters/slideMaster1.xml'),
    'ppt/slideMasters/slideMaster1.xml': master,
  };
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides[0]?.layoutName, 'Title and Content');
  const first = deck.slides[0]?.nodes[0];
  assert.ok(first && first.type === 'text');
  const paras = first.paras;
  assert.deepEqual(paras.map((p) => [p.bullet, p.bulletChar, p.numberStyle, p.numberStart, p.align]), [
    ['bullet', '•', undefined, undefined, 'left'],
    ['none', undefined, undefined, undefined, 'left'],
    ['number', undefined, 'alphaLcParenR', 3, 'center'],
    ['bullet', '•', undefined, undefined, 'left'],
  ]);
  const third = paras[2]?.runs[0];
  assert.deepEqual([third?.strike, third?.baseline, third?.cap], [true, 'sub', 'small']);
  const plain = paras[3]?.runs[0];
  assert.deepEqual([plain?.strike, plain?.baseline, plain?.cap], [undefined, undefined, undefined], 'an explicit off states nothing');
  assert.deepEqual([paras[3]?.lineSpacingPct, paras[3]?.spaceAfterPt], [90, 6]);
});

test('the formatting reader floor is never past the running engine, so a fresh reading is never called stale', () => {
  const parts = (v: string): number[] => v.split('.').map(Number);
  const [a, b, c] = parts(PPTX_FORMATTING_READER_SINCE);
  const [x, y, z] = parts(ENGINE_VERSION);
  const atOrBelow = a! !== x! ? a! < x! : b! !== y! ? b! < y! : c! <= z!;
  assert.ok(atOrBelow, `PPTX_FORMATTING_READER_SINCE ${PPTX_FORMATTING_READER_SINCE} is at or below ENGINE_VERSION ${ENGINE_VERSION}`);
});
