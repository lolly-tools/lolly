// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX native animation (plans/175 WP-E) - the `<p:timing>` emitter.
 *
 * Run with: npm test  (node --test over the tests/ globs). No framework - node:test.
 *
 * What has to hold:
 *   - A slide with no `anim` emits NO timing element at all - every deck built before
 *     this feature serialises byte-identically.
 *   - The tree keeps PowerPoint's own triple nesting (root par → main seq → click
 *     group → inner par → effect par) with unique cTn ids, because diverging from
 *     that shape is what earns a repair prompt.
 *   - Split text rides `<p:iterate>` with an ABSOLUTE `p:tmAbs` gap - Lolly's stagger
 *     verbatim - so appear+iterate is the native typewriter, and `backwards` carries
 *     the reverse order.
 *   - Fly directions land on the t=1/r=2/b=4/l=8 presetSubtype bitfield with the
 *     matching `#ppt_*` formula; exits mirror entrances and end hidden.
 *   - `click` steps become real click groups (delay="indefinite" + clickEffect);
 *     step 0 plays with the slide (delay="0").
 *   - Every slide XML stays well-formed (jsdom XML parse, no parsererror).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { buildPptxParts, timingXml } from '../engine/src/pptx.ts';
import type { PptxAnim, PptxSlide } from '../engine/src/pptx.ts';

const xmlParser = new (new JSDOM('').window.DOMParser)();
function assertWellFormed(xml: string, label: string): void {
  const doc = xmlParser.parseFromString(xml, 'text/xml');
  const err = doc.querySelector('parsererror');
  assert.ok(!err, `${label}: slide XML is not well-formed - ${err?.textContent?.slice(0, 200)}`);
}

const textShape = (anim?: PptxAnim): PptxSlide['shapes'][number] => ({
  kind: 'text', x: 0, y: 0, cx: 914400, cy: 914400,
  paras: [{ runs: [{ text: 'Hello world', sizePt: 24 }] }],
  ...(anim ? { anim } : {}),
});
const slideOf = (...shapes: PptxSlide['shapes']): PptxSlide => ({ shapes, media: [] });
const slide1 = (parts: Record<string, unknown>): string => parts['ppt/slides/slide1.xml'] as string;

test('a slide with no anim emits no timing element - byte-identity with every prior deck', () => {
  const xml = slide1(buildPptxParts([slideOf(textShape())], {}));
  assert.ok(!xml.includes('<p:timing>'), 'no timing tree on a still slide');
  assertWellFormed(xml, 'still slide');
  assert.equal(timingXml(slideOf(textShape())), '');
});

test('an entrance fade: preset label, visibility set, fade behaviour, well-formed', () => {
  const xml = slide1(buildPptxParts([slideOf(textShape({ enter: { preset: 'fade', ms: 500 } }))], {}));
  assertWellFormed(xml, 'fade');
  assert.match(xml, /<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot">/);
  assert.match(xml, /<p:cTn id="2" dur="indefinite" nodeType="mainSeq">/);
  assert.match(xml, /presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="afterEffect"/);
  // The shape is index 0 → cNvPr id 2, and every behaviour targets that spid.
  assert.match(xml, /<p:spTgt spid="2"\/>/);
  assert.match(xml, /<p:attrName>style\.visibility<\/p:attrName>.*<p:strVal val="visible"\/>/);
  assert.match(xml, /<p:animEffect transition="in" filter="fade">/);
  assert.match(xml, /<p:cTn id="\d+" dur="500" fill="hold"\/>/);
  // The slide-entry group fires with the slide, and the seq keeps its click conds.
  assert.match(xml, /<p:stCondLst><p:cond delay="0"\/><\/p:stCondLst>/);
  assert.match(xml, /<p:prevCondLst><p:cond evt="onPrev" delay="0">/);
  assert.match(xml, /<p:nextCondLst><p:cond evt="onNext" delay="0">/);
  // A build entry marks the animated TEXT shape.
  assert.match(xml, /<p:bldLst><p:bldP spid="2" grpId="0"\/><\/p:bldLst>/);
});

test('a shape with an entrance AND an exit gets two effect groups, each with its own build entry', () => {
  // The 2026-09-01 real-PowerPoint finding: both effects stamped grpId="0" on one shape
  // played the entrance and silently dropped the timed exit. PowerPoint numbers a
  // shape's effects 0, 1, ... and lists one bldP per (shape, group).
  const t = timingXml(slideOf(textShape({
    enter: { preset: 'fly', dir: 'b', ms: 500 }, exit: { preset: 'fade', ms: 400, delayMs: 4000 }, click: 1,
  })));
  assert.match(t, /presetClass="entr" presetSubtype="4" fill="hold" grpId="0"/);
  assert.match(t, /presetClass="exit" presetSubtype="0" fill="hold" grpId="1"/);
  assert.match(t, /<p:bldLst><p:bldP spid="2" grpId="0"\/><p:bldP spid="2" grpId="1"\/><\/p:bldLst>/);
  // And every cTn id appears in document order - the hide's id is minted after the fade's.
  const ids = [...t.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(ids, [...ids].sort((x, y) => x - y), `ids out of document order: ${ids.join(',')}`);
});

test('the typewriter: appear + iterate by letter with the ABSOLUTE stagger, backwards for reverse', () => {
  const t = timingXml(slideOf(textShape({
    enter: { preset: 'appear', ms: 100, iterate: { by: 'letter', staggerMs: 80 } },
  })));
  assert.match(t, /presetID="1" presetClass="entr"/);
  assert.match(t, /<p:iterate type="lt"><p:tmAbs val="80"\/><\/p:iterate>/);
  assert.ok(!t.includes('animEffect'), 'appear is visibility alone - a cut, not a fade');

  const rev = timingXml(slideOf(textShape({
    enter: { preset: 'fade', ms: 400, iterate: { by: 'word', staggerMs: 120, backwards: true } },
  })));
  assert.match(rev, /<p:iterate type="wd" backwards="1"><p:tmAbs val="120"\/><\/p:iterate>/);
});

test('fly directions: the t/r/b/l subtype bitfield and the matching #ppt formulas', () => {
  const cases = [
    { dir: 'b', sub: 4, attr: 'ppt_y', from: '1+#ppt_h/2' },
    { dir: 't', sub: 1, attr: 'ppt_y', from: '0-#ppt_h/2' },
    { dir: 'r', sub: 2, attr: 'ppt_x', from: '1+#ppt_w/2' },
    { dir: 'l', sub: 8, attr: 'ppt_x', from: '0-#ppt_w/2' },
  ] as const;
  for (const c of cases) {
    const t = timingXml(slideOf(textShape({ enter: { preset: 'fly', dir: c.dir, ms: 500 } })));
    assert.match(t, new RegExp(`presetID="2" presetClass="entr" presetSubtype="${c.sub}"`), c.dir);
    assert.ok(t.includes(`<p:attrName>${c.attr}</p:attrName>`), c.dir);
    assert.ok(t.includes(`<p:tav tm="0"><p:val><p:strVal val="${c.from}"/></p:val></p:tav>`), `${c.dir} starts offscreen`);
    assert.ok(t.includes(`<p:tav tm="100000"><p:val><p:strVal val="#${c.attr}"/></p:val></p:tav>`), `${c.dir} arrives at rest`);
  }
});

test('an exit mirrors the entrance and ends hidden on its final tick', () => {
  const t = timingXml(slideOf(textShape({
    exit: { preset: 'fade', ms: 400, delayMs: 2600 },
  })));
  assert.match(t, /presetClass="exit"/);
  assert.match(t, /<p:cond delay="2600"\/>/);
  assert.match(t, /<p:animEffect transition="out" filter="fade">/);
  // The hide sits at dur-1 so the shape is gone exactly when the effect ends.
  assert.match(t, /<p:cond delay="399"\/>.*<p:strVal val="hidden"\/>/);
  assert.ok(!t.includes('val="visible"'), 'an exit never shows anything');
});

test('click steps become click groups; step 0 plays with the slide', () => {
  const t = timingXml(slideOf(
    textShape({ enter: { preset: 'fade', ms: 300 } }),                       // auto (click 0)
    textShape({ enter: { preset: 'appear', ms: 100 }, click: 1 }),           // 1st click
    textShape({ enter: { preset: 'appear', ms: 100 }, click: 2 }),           // 2nd click
  ));
  assert.equal([...t.matchAll(/<p:cond delay="indefinite"\/>/g)].length, 2, 'two click groups');
  assert.equal([...t.matchAll(/nodeType="clickEffect"/g)].length, 2, 'each click group leads with its click');
  assert.equal([...t.matchAll(/nodeType="afterEffect"/g)].length, 1, 'the auto group leads on slide entry');
  // Shape order → spids 2, 3, 4.
  for (const spid of [2, 3, 4]) assert.ok(t.includes(`spid="${spid}"`), `spid ${spid} animated`);
});

test('zoom scales through animScale with a fade; easing rides accel/decel', () => {
  const t = timingXml(slideOf(textShape({
    enter: { preset: 'zoom', ms: 600, accel: 0, decel: 80000 },
  })));
  assert.match(t, /presetID="23" presetClass="entr" presetSubtype="16"/);
  assert.match(t, /<p:animScale><p:cBhvr><p:cTn id="\d+" dur="600" decel="80000" fill="hold"\/>/);
  assert.match(t, /<p:from x="25000" y="25000"\/><p:to x="100000" y="100000"\/>/);
  assert.match(t, /<p:animEffect transition="in" filter="fade">/);
});

test('every cTn id in the tree is unique', () => {
  const t = timingXml(slideOf(
    textShape({ enter: { preset: 'fly', dir: 'b', ms: 500 }, exit: { preset: 'fade', ms: 400, delayMs: 3000 } }),
    textShape({ enter: { preset: 'zoom', ms: 600 }, click: 1 }),
  ));
  const ids = [...t.matchAll(/<p:cTn id="(\d+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, `duplicate cTn id in: ${ids.join(',')}`);
});

test('hostile numbers clamp instead of corrupting the tree', () => {
  const t = timingXml(slideOf(textShape({
    enter: {
      preset: 'fade', ms: Number.POSITIVE_INFINITY, delayMs: -50,
      iterate: { by: 'letter', staggerMs: 1e12 },
      accel: 9e9, decel: Number.NaN,
    },
    click: 1e9,
  })));
  assert.ok(!/NaN|Infinity/.test(t), 'no non-finite number reaches an attribute');
  assert.match(t, /<p:tmAbs val="60000"\/>/, 'the stagger clamps to the effect ceiling');
  const slide = slide1(buildPptxParts([slideOf(textShape({ enter: { preset: 'fade', ms: 1e9, delayMs: 1e9 } }))], {}));
  assertWellFormed(slide, 'clamped hostile slide');
});

test('a fully animated multi-shape slide stays well-formed XML end to end', () => {
  const slide = slideOf(
    { kind: 'rect', x: 0, y: 0, cx: 100, cy: 100, anim: { enter: { preset: 'fly', dir: 'l', ms: 500 } } },
    textShape({
      enter: { preset: 'appear', ms: 100, iterate: { by: 'letter', staggerMs: 60 } },
      exit: { preset: 'fade', ms: 400, delayMs: 4000 },
      click: 1,
    }),
  );
  assertWellFormed(slide1(buildPptxParts([slide], {})), 'multi-shape animated slide');
});
