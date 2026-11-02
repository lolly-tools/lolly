import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';
import { readZip } from '../engine/src/zip.ts';

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

// Corpus-derived: the converted open fixtures, when fetched by `node plans/idml-reader/convert.ts`.
const corpus = resolve(import.meta.dirname, '../plans/corpora/idml');
const sample = 'PublicDataLab__fake-news-field-guide_layout_chapter-01.idml';
test('corpus case: a converted InDesign file keeps style-driven type', { skip: existsSync(resolve(corpus, sample)) ? false : 'converted corpus not present (plans/idml-reader/convert.ts)' }, async () => {
  const parts = readZip(new Uint8Array(readFileSync(resolve(corpus, sample))), { maxInputBytes: 64 << 20, maxTotalBytes: 256 << 20, maxEntryBytes: 32 << 20, maxEntries: 4096 });
  const { boxes } = await read(Object.fromEntries(parts.map(p => [p.name, p.bytes])));
  const text = boxes.filter(b => b.kind === 'text');
  assert.ok(text.length > 10 && new Set(text.map(b => b.fontSize)).size > 3, 'sizes come from styles, not one default');
});
