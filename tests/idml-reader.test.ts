import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';
import { readZip } from '../engine/src/zip.ts';
import type { IdmlStats } from '../engine/src/idml-styles.ts';

const dom = new JSDOM(''), parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const enc = (s: string) => new TextEncoder().encode(s);
const path = (w: number, h: number) => `<Properties><PathGeometry><GeometryPathType PathOpen="false"><PathPointArray><PathPointType Anchor="0 0"/><PathPointType Anchor="${w} 0"/><PathPointType Anchor="${w} ${h}"/><PathPointType Anchor="0 ${h}"/></PathPointArray></GeometryPathType></PathGeometry></Properties>`;
const PKG = 'xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"';

/** A small independently written package: the pieces a test needs and nothing else. */
function pkg(o: { styles?: string; graphic?: string; stories?: Record<string, string>; spread?: string; masters?: Record<string, string> }): Record<string, Uint8Array> {
  const stories = o.stories ?? {}, masters = o.masters ?? {};
  const map = `<Document ${PKG}><idPkg:Graphic src="Resources/Graphic.xml"/><idPkg:Styles src="Resources/Styles.xml"/>${Object.keys(masters).map(k => `<idPkg:MasterSpread src="MasterSpreads/${k}.xml"/>`).join('')}${Object.keys(stories).map(k => `<idPkg:Story src="Stories/${k}.xml"/>`).join('')}<idPkg:Spread src="Spreads/s.xml"/></Document>`;
  const files: Record<string, Uint8Array> = {
    'designmap.xml': enc(map),
    'Resources/Graphic.xml': enc(`<idPkg:Graphic ${PKG}>${o.graphic ?? '<Color Self="Color/Ink" Space="RGB" ColorValue="20 50 80"/><Color Self="Color/Red" Space="RGB" ColorValue="200 0 0"/>'}</idPkg:Graphic>`),
    'Resources/Styles.xml': enc(`<idPkg:Styles ${PKG}>${o.styles ?? ''}</idPkg:Styles>`),
    'Spreads/s.xml': enc(`<idPkg:Spread ${PKG}>${o.spread ?? ''}</idPkg:Spread>`),
  };
  for (const [k, v] of Object.entries(stories)) files[`Stories/${k}.xml`] = enc(`<idPkg:Story ${PKG}>${v}</idPkg:Story>`);
  for (const [k, v] of Object.entries(masters)) files[`MasterSpreads/${k}.xml`] = enc(`<idPkg:MasterSpread ${PKG}>${v}</idPkg:MasterSpread>`);
  return files;
}
const frame = (story: string, extra = '') => `<TextFrame Self="tf" ParentStory="${story}" ${extra}>${path(300, 100)}</TextFrame>`;
const read = async (files: Record<string, Uint8Array>) => { const notes: string[] = []; const spreads = await readIdmlSpreads(files, parse, { warn: m => notes.push(m) }); return { spreads, boxes: spreads.flatMap(s => s.boxes as Record<string, unknown>[]), notes }; };

test('paragraph styles resolve BasedOn chains into type, leading, tracking and alignment', async () => {
  const styles = `<RootParagraphStyleGroup Self="r">
    <ParagraphStyle Self="ParagraphStyle/Base" Name="Base" PointSize="20" FontStyle="Bold" FillColor="Color/Ink" Justification="CenterAlign" Tracking="100"><Properties><BasedOn type="string">$ID/[No paragraph style]</BasedOn><Leading type="unit">30</Leading><AppliedFont type="string">Studio Sans</AppliedFont></Properties></ParagraphStyle>
    <ParagraphStyle Self="ParagraphStyle/Child" Name="Child" FillColor="Color/Red"><Properties><BasedOn type="object">ParagraphStyle/Base</BasedOn></Properties></ParagraphStyle></RootParagraphStyleGroup>`;
  const story = `<Story Self="a"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Child"><CharacterStyleRange><Content>Hello</Content></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes } = await read(pkg({ styles, stories: { a: story }, spread: `<Page GeometricBounds="0 0 200 400"/>${frame('a')}` }));
  const text = boxes.find(b => b.kind === 'text')!;
  assert.equal(text.fontSize, 20); assert.equal(text.weight, '700'); assert.equal(text.fg, '#c80000');
  assert.equal(text.align, 'center'); assert.equal(text.lineHeight, 1.5); assert.equal(text.tracking, 2);
});

test('character styles and local overrides beat the paragraph style, and loops stop', async () => {
  const styles = `<RootParagraphStyleGroup Self="r"><ParagraphStyle Self="ParagraphStyle/A" Name="A" PointSize="12"><Properties><BasedOn type="object">ParagraphStyle/B</BasedOn></Properties></ParagraphStyle><ParagraphStyle Self="ParagraphStyle/B" Name="B" FontStyle="Italic"><Properties><BasedOn type="object">ParagraphStyle/A</BasedOn></Properties></ParagraphStyle></RootParagraphStyleGroup>
    <RootCharacterStyleGroup Self="c"><CharacterStyle Self="CharacterStyle/Hot" Name="Hot" FillColor="Color/Red"/></RootCharacterStyleGroup>`;
  const story = `<Story Self="a"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/A"><CharacterStyleRange AppliedCharacterStyle="CharacterStyle/Hot" FontStyle="Bold"><Content>Red bold </Content></CharacterStyleRange><CharacterStyleRange><Content>plain words</Content></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes } = await read(pkg({ styles, stories: { a: story }, spread: `<Page GeometricBounds="0 0 200 400"/>${frame('a')}` }));
  const text = boxes.find(b => b.kind === 'text')!;
  assert.equal(text.fontSize, 12);
  assert.match(String(text.text), /\*\*\{#c80000\|Red bold}\*\*|\{#c80000\|Red bold}/);
});

test('a missing style is reported and the text still imports', async () => {
  const story = `<Story Self="a"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/Gone"><CharacterStyleRange><Content>Words</Content></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes, notes } = await read(pkg({ stories: { a: story }, spread: `<Page GeometricBounds="0 0 200 400"/>${frame('a')}` }));
  assert.equal(boxes.find(b => b.kind === 'text')!.text, 'Words');
  assert.ok(notes.some(n => /styles named in the text were not found/.test(n)));
});

test('paragraph breaks split paragraphs and spacing, indents and justification are reported', async () => {
  const styles = `<RootParagraphStyleGroup Self="r"><ParagraphStyle Self="ParagraphStyle/P" Name="P" PointSize="10" SpaceAfter="6" LeftIndent="12" Justification="FullyJustified"/></RootParagraphStyleGroup>`;
  const story = `<Story Self="a"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/P"><CharacterStyleRange><Content>One</Content><Br/><Content>Two</Content><Br/></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes, notes } = await read(pkg({ styles, stories: { a: story }, spread: `<Page GeometricBounds="0 0 200 400"/>${frame('a')}` }));
  assert.equal(boxes.find(b => b.kind === 'text')!.text, 'One\nTwo');
  for (const re of [/paragraph spacing/, /indents/, /Justified/]) assert.ok(notes.some(n => re.test(n)), String(re));
});

test('style chains deeper than the bound are cut and reported', async () => {
  const levels = Array.from({ length: 40 }, (_, i) => `<ParagraphStyle Self="ParagraphStyle/L${i}" Name="L${i}" ${i === 39 ? 'PointSize="33"' : ''}><Properties><BasedOn type="object">ParagraphStyle/L${i + 1}</BasedOn></Properties></ParagraphStyle>`).join('');
  const story = `<Story Self="a"><ParagraphStyleRange AppliedParagraphStyle="ParagraphStyle/L0"><CharacterStyleRange><Content>Deep</Content></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes, notes } = await read(pkg({ styles: `<RootParagraphStyleGroup Self="r">${levels}</RootParagraphStyleGroup>`, stories: { a: story }, spread: `<Page GeometricBounds="0 0 200 400"/>${frame('a')}` }));
  assert.notEqual(boxes.find(b => b.kind === 'text')!.fontSize, 33);
  assert.ok(notes.some(n => /cut short/.test(n)));
});

const rect = (self: string, w: number, h: number, extra = '') => `<Rectangle Self="${self}" ${extra}>${path(w, h)}</Rectangle>`;
const masterA = `<MasterSpread Self="MasterSpread/mA"><Page Self="mp1" GeometricBounds="0 0 200 300" ItemTransform="1 0 0 1 -300 0"/><Page Self="mp2" GeometricBounds="0 0 200 300" ItemTransform="1 0 0 1 0 0"/>
  ${rect('lm', 40, 20, 'FillColor="Color/Ink" ItemTransform="1 0 0 1 -290 10"')}${rect('rm', 40, 20, 'FillColor="Color/Red" ItemTransform="1 0 0 1 10 10"')}${rect('gone', 40, 20, 'FillColor="Color/Red" ItemTransform="1 0 0 1 60 100"')}${rect('board', 40, 20, 'FillColor="Color/Red" ItemTransform="1 0 0 1 500 10"')}</MasterSpread>`;

test('master items sit below the page items, on the matching side, honouring overrides', async () => {
  const spread = `<Page GeometricBounds="0 0 200 300" ItemTransform="1 0 0 1 0 0" AppliedMaster="MasterSpread/mA" OverrideList="gone"/>${rect('own', 50, 50, 'FillColor="Color/Ink" ItemTransform="1 0 0 1 100 100"')}${rect('gone-copy', 10, 10, 'FillColor="Color/Ink" ItemTransform="1 0 0 1 61 101"')}`;
  const { boxes } = await read(pkg({ masters: { mA: masterA }, spread }));
  const fills = boxes.map(b => b.bg);
  assert.equal(boxes.length, 3, 'right master item, the page item and the override copy; no left, overridden or pasteboard item');
  assert.equal(boxes[0]!.bg, '#c80000'); assert.equal(boxes[0]!.x, 10); assert.equal(boxes[0]!.y, 10);
  assert.ok(fills.slice(1).every(f => f === '#143250'));
});

test('a page with hidden master items, or a master that loops, draws only its own items', async () => {
  const hidden = `<Page GeometricBounds="0 0 200 300" AppliedMaster="MasterSpread/mA"/>`;
  const files = pkg({ masters: { mA: masterA }, spread: hidden });
  files['Spreads/s.xml'] = enc(`<idPkg:Spread ${PKG}><Spread ShowMasterItems="false">${hidden}${rect('own', 5, 5)}</Spread></idPkg:Spread>`);
  assert.equal((await read(files)).boxes.length, 1);
  const loop = `<MasterSpread Self="MasterSpread/mL"><Page GeometricBounds="0 0 100 100" AppliedMaster="MasterSpread/mL"/>${rect('x', 10, 10, 'FillColor="Color/Ink"')}</MasterSpread>`;
  const { boxes } = await read(pkg({ masters: { mL: loop }, spread: `<Page GeometricBounds="0 0 100 100" AppliedMaster="MasterSpread/mL"/>` }));
  assert.equal(boxes.length, 1);
});

test('a master based on another master places the parent items first', async () => {
  const parent = `<MasterSpread Self="MasterSpread/mP"><Page GeometricBounds="0 0 100 100"/>${rect('p', 10, 10, 'FillColor="Color/Ink"')}</MasterSpread>`;
  const child = `<MasterSpread Self="MasterSpread/mC"><Page GeometricBounds="0 0 100 100" AppliedMaster="MasterSpread/mP"/>${rect('c', 10, 10, 'FillColor="Color/Red" ItemTransform="1 0 0 1 20 0"')}</MasterSpread>`;
  const { boxes } = await read(pkg({ masters: { mP: parent, mC: child }, spread: `<Page GeometricBounds="0 0 100 100" AppliedMaster="MasterSpread/mC"/>` }));
  assert.deepEqual(boxes.map(b => b.bg), ['#143250', '#c80000']);
});

const tableStory = (extra = '') => `<Story Self="t"><ParagraphStyleRange><CharacterStyleRange><Content>Intro</Content><Br/></CharacterStyleRange></ParagraphStyleRange><ParagraphStyleRange><CharacterStyleRange><Table Self="tb" ColumnCount="2" BodyRowCount="2" ${extra}>
  <Row Self="r0" Name="0" SingleRowHeight="20"/><Row Self="r1" Name="1" SingleRowHeight="30"/><Column Self="c0" Name="0" SingleColumnWidth="60"/><Column Self="c1" Name="1" SingleColumnWidth="40"/>
  <Cell Self="a" Name="0:0" RowSpan="1" ColumnSpan="1" FillColor="Color/Red" TopEdgeStrokeWeight="2" TopEdgeStrokeColor="Color/Ink" TopInset="2" LeftInset="2" BottomInset="2" RightInset="2"><ParagraphStyleRange><CharacterStyleRange PointSize="9"><Content>A1</Content></CharacterStyleRange></ParagraphStyleRange></Cell>
  <Cell Self="b" Name="1:0" RowSpan="1" ColumnSpan="1"><ParagraphStyleRange><CharacterStyleRange><Content>B1</Content></CharacterStyleRange></ParagraphStyleRange></Cell>
  <Cell Self="c" Name="0:1" RowSpan="1" ColumnSpan="2"><ParagraphStyleRange><CharacterStyleRange><Content>Wide</Content></CharacterStyleRange></ParagraphStyleRange></Cell>
  </Table></CharacterStyleRange></ParagraphStyleRange></Story>`;

test('a table becomes grouped cell frames on the grid with text, fills and borders', async () => {
  const { boxes, notes } = await read(pkg({ stories: { t: tableStory() }, spread: `<Page GeometricBounds="0 0 200 300"/>${frame('t', 'ItemTransform="1 0 0 1 10 10"')}` }));
  const cells = boxes.filter(b => b.group !== '' && b.kind !== 'group');
  assert.equal(cells.length, 3);
  assert.equal(new Set(cells.map(c => c.group)).size, 1);
  const a = cells.find(c => c.text === 'A1')!, wide = cells.find(c => c.text === 'Wide')!;
  assert.equal(a.bg, '#c80000'); assert.equal(a.w, 60); assert.equal(a.h, 20); assert.equal(a.stroke, '#143250'); assert.equal(a.strokeTop, 2);
  assert.equal(wide.w, 100); assert.equal(wide.x, 10); assert.ok((wide.y as number) > (a.y as number));
  assert.equal(boxes.find(b => b.text === 'Intro')!.kind, 'text');
  for (const re of [/Tables become grouped frames/, /Merged cells/]) assert.ok(notes.some(n => re.test(n)), String(re));
});

test('a table over the cell limit is dropped and reported, not parsed', async () => {
  const many = Array.from({ length: 5001 }, (_, i) => `<Cell Self="x${i}" Name="0:0"/>`).join('');
  const story = `<Story Self="t"><ParagraphStyleRange><CharacterStyleRange><Table Self="tb"><Row Self="r" Name="0" SingleRowHeight="10"/><Column Self="c" Name="0" SingleColumnWidth="10"/>${many}</Table></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const { boxes, notes } = await read(pkg({ stories: { t: story }, spread: `<Page GeometricBounds="0 0 200 300"/>${frame('t')}` }));
  assert.equal(boxes.length, 0);
  assert.ok(notes.some(n => /beyond the size limits/.test(n)));
});

const shapes = `<RootObjectStyleGroup Self="o"><ObjectStyle Self="ObjectStyle/Card" Name="Card" FillColor="Color/Ink" StrokeColor="Color/Red" StrokeWeight="3" StrokeAlignment="InsideAlignment" CornerOption="RoundedCorner" CornerRadius="9"><Properties><BasedOn type="object">ObjectStyle/Base</BasedOn></Properties><TransparencySetting><BlendingSetting Opacity="40" BlendMode="Multiply"/></TransparencySetting></ObjectStyle>
  <ObjectStyle Self="ObjectStyle/Base" Name="Base" StrokeType="StrokeStyle/$ID/Dashed"/></RootObjectStyleGroup>`;

test('object styles carry fill, stroke, corners, opacity and blend, with the item on top', async () => {
  const spread = `<Page GeometricBounds="0 0 200 300"/>${rect('a', 50, 50, 'AppliedObjectStyle="ObjectStyle/Card"')}${rect('b', 50, 50, 'AppliedObjectStyle="ObjectStyle/Card" FillColor="Color/Red" StrokeWeight="0" ItemTransform="1 0 0 1 100 0"')}`;
  const { boxes } = await read(pkg({ styles: shapes, spread }));
  const [a, b] = boxes;
  assert.equal(a!.bg, '#143250'); assert.equal(a!.stroke, '#c80000'); assert.equal(a!.strokeW, 3); assert.equal(a!.strokeAlign, 'inside');
  assert.equal(a!.strokeDash, 'dashed'); assert.equal(a!.radius, 9); assert.equal(a!.opacity, 40); assert.equal(a!.blend, 'multiply');
  assert.equal(b!.bg, '#c80000'); assert.equal(b!.strokeW, 0);
});

test('a text frame keeps its own fill, wrap and effects are reported, and a rule becomes a thin filled frame', async () => {
  const story = `<Story Self="a"><ParagraphStyleRange><CharacterStyleRange><Content>Hi</Content></CharacterStyleRange></ParagraphStyleRange></Story>`;
  const line = `<GraphicLine Self="ln" StrokeColor="Color/Red" StrokeWeight="4"><Properties><PathGeometry><GeometryPathType PathOpen="true"><PathPointArray><PathPointType Anchor="0 0"/><PathPointType Anchor="100 0"/></PathPointArray></GeometryPathType></PathGeometry></Properties></GraphicLine>`;
  const spread = `<Page GeometricBounds="0 0 200 300"/><TextFrame Self="tf" ParentStory="a" FillColor="Color/Ink"><TextWrapPreference TextWrapMode="BoundingBoxTextWrap"/><TransparencySetting><DropShadowSetting Mode="Drop"/></TransparencySetting>${path(100, 40)}</TextFrame>${line}`;
  const { boxes, notes } = await read(pkg({ stories: { a: story }, spread }));
  const text = boxes.find(b => b.kind === 'text')!;
  assert.equal(text.bg, '#143250');
  const rule = boxes.find(b => b.kind === 'box')!;
  assert.equal(rule.bg, '#c80000'); assert.equal(rule.h, 4);
  for (const re of [/Text wrap around objects/, /Drop shadows/]) assert.ok(notes.some(n => re.test(n)), String(re));
});

// Corpus-derived: the converted open fixtures, when fetched by `node plans/idml-reader/convert.ts`.
const corpus = resolve(import.meta.dirname, '../plans/corpora/idml');
const sample = 'PublicDataLab__fake-news-field-guide_layout_chapter-01.idml';
test('corpus case: a converted InDesign file keeps style-driven type', { skip: existsSync(resolve(corpus, sample)) ? false : 'converted corpus fixtures not present (plans/idml-reader/convert.ts)' }, async () => {
  const parts = readZip(new Uint8Array(readFileSync(resolve(corpus, sample))), { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
  const { boxes } = await read(Object.fromEntries(parts.map(p => [p.name, p.bytes])));
  const text = boxes.filter(b => b.kind === 'text');
  assert.ok(text.length > 10 && new Set(text.map(b => b.fontSize)).size > 3, 'sizes come from styles, not one default');
});

const leaflet = '3plus2__3plus2_leaflet_definitions_lent_2015_spreads_distribution.idml';
test('corpus case: master items of a converted leaflet reach its pages', { skip: existsSync(resolve(corpus, leaflet)) ? false : 'converted corpus fixtures not present (plans/idml-reader/convert.ts)' }, async () => {
  const parts = readZip(new Uint8Array(readFileSync(resolve(corpus, leaflet))), { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
  const stats: IdmlStats = {};
  await readIdmlSpreads(Object.fromEntries(parts.map(p => [p.name, p.bytes])), parse, { stats });
  assert.ok((stats['master.items']?.mapped ?? 0) > 0);
});

const cfpb = 'cfpb__debt-collection-files_print_cfpb_debt-collection_model-validation-notice_es.idml';
test('corpus case: the tables of a converted notice become cell frames', { skip: existsSync(resolve(corpus, cfpb)) ? false : 'converted corpus fixtures not present (plans/idml-reader/convert.ts)' }, async () => {
  const parts = readZip(new Uint8Array(readFileSync(resolve(corpus, cfpb))), { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
  const stats: IdmlStats = {};
  await readIdmlSpreads(Object.fromEntries(parts.map(p => [p.name, p.bytes])), parse, { stats });
  assert.ok((stats['table.cells']?.mapped ?? 0) >= 10, JSON.stringify(stats['table.cells']));
});

const guide = 'andgein__sis-guide_2014_guide_trims.idml';
test('corpus case: object styles reach strokes, corners and opacity in a converted guide', { skip: existsSync(resolve(corpus, guide)) ? false : 'converted corpus fixtures not present (plans/idml-reader/convert.ts)' }, async () => {
  const parts = readZip(new Uint8Array(readFileSync(resolve(corpus, guide))), { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
  const { boxes } = await read(Object.fromEntries(parts.map(p => [p.name, p.bytes])));
  assert.ok(boxes.some(b => Number(b.strokeW) > 0) || boxes.some(b => Number(b.opacity) < 100), 'some appearance reaches the boxes');
});
