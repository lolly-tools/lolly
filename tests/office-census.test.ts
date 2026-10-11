// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync } from 'fflate';
import { storeZip, readZipMembers } from '../engine/src/zip.ts';
import { inspectOfficePackage, isOfficeSource } from '../engine/src/office-census.ts';
import { readOfficeXml, OFFICE_MAX_XML_BYTES } from '../engine/src/office-xml.ts';
import { inspectPreparation, applyPreparation } from '../engine/src/prepare.ts';

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
function office(kind: 'docx' | 'pptx' | 'xlsx', parts: Record<string, string | Uint8Array>): Uint8Array {
  const main = { docx: 'word/document.xml', pptx: 'ppt/presentation.xml', xlsx: 'xl/workbook.xml' }[kind];
  const entries: Record<string, string | Uint8Array> = { '[Content_Types].xml': '<Types/>', [main]: '<document/>', ...parts };
  return storeZip(Object.entries(entries).map(([name, value]) => ({ name, bytes: typeof value === 'string' ? utf8(value) : value })));
}
const props = '<cp:coreProperties xmlns:cp="cp" xmlns:dc="dc"><dc:creator>Private Author</dc:creator><cp:lastModifiedBy>Private Editor</cp:lastModifiedBy></cp:coreProperties>';
const rels = '<Relationships><Relationship Id="r1" Type="hyperlink" TargetMode="External" Target="https://private.invalid/?token=private-link"/></Relationships>';

test('DOCX census identifies properties, comments, revisions, hidden runs and external links without changes', () => {
  const bytes = office('docx', {
    'docProps/core.xml': props, 'docProps/custom.xml': '<Properties><property name="Private id"><string>private-id</string></property></Properties>',
    'word/document.xml': '<w:document xmlns:w="w"><w:body><w:ins w:author="Revision Author"><w:r><w:t>Inserted private text</w:t></w:r></w:ins><w:del w:author="Deleted Author"><w:delText>Deleted text</w:delText></w:del><w:r><w:rPr><w:vanish/></w:rPr><w:t>Hidden private text</w:t></w:r><w:r><w:rPr><w:vanish w:val="false"/></w:rPr><w:t>Visible text</w:t></w:r></w:body></w:document>',
    'word/comments.xml': '<w:comments xmlns:w="w"><w:comment w:id="7" w:author="Comment Author"><w:p><w:r><w:t>Private comment</w:t></w:r></w:p></w:comment></w:comments>',
    'word/_rels/document.xml.rels': rels,
  });
  const original = bytes.slice(), result = inspectOfficePackage(bytes, 'file.docx');
  const findings = result.parts.flatMap(p => p.findings);
  assert.equal(result.format, 'docx');
  for (const category of ['office-properties', 'office-comments', 'office-revisions', 'office-hidden', 'office-links']) assert(findings.some(f => f.category === category), category);
  assert.equal(findings.filter(f => f.category === 'office-hidden').length, 1);
  assert(findings.some(f => f.value.includes('Private comment') && f.value.includes('Comment Author')));
  assert(findings.some(f => f.value.includes('private-link')));
  assert.deepEqual(bytes, original);
  assert(result.limitations.some(l => l.includes('read-only')));
});

test('PPTX census identifies notes, hidden slides, comment identities and nested workbooks', () => {
  const nested = office('xlsx', { 'docProps/core.xml': props, 'xl/workbook.xml': '<workbook><sheets><sheet name="Nested private sheet" state="veryHidden"/></sheets></workbook>' });
  const bytes = office('pptx', {
    'docProps/core.xml': props, 'ppt/slides/slide1.xml': '<p:sld xmlns:p="p" show="0"><text>Hidden slide content</text></p:sld>',
    'ppt/notesSlides/notesSlide1.xml': '<notes><text>Private speaker notes</text></notes>',
    'ppt/comments/comment1.xml': '<comments><cm authorId="5"><text>Private slide comment</text></cm></comments>',
    'ppt/commentAuthors.xml': '<authors><cmAuthor id="5" name="Slide Author"/></authors>',
    'ppt/_rels/presentation.xml.rels': rels, 'ppt/embeddings/workbook.xlsx': nested,
  });
  const result = inspectOfficePackage(bytes, 'file.pptx'), findings = result.parts.flatMap(p => p.findings);
  for (const category of ['office-properties', 'office-notes', 'office-hidden', 'office-comments', 'office-links', 'office-embedded']) assert(findings.some(f => f.category === category), category);
  assert(findings.some(f => f.value === 'Nested private sheet'));
  assert(result.parts.some(p => p.path.includes('workbook.xlsx!/xl/workbook.xml')));
});

test('XLSX census identifies comments, hidden rows/columns/sheets, names, connections and cache surfaces', () => {
  const bytes = office('xlsx', {
    'docProps/core.xml': props,
    'xl/workbook.xml': '<workbook><sheets><sheet name="Private sheet" state="hidden"/></sheets><definedNames><definedName name="PrivateRange">Private!A1:A2</definedName></definedNames></workbook>',
    'xl/worksheets/sheet1.xml': '<worksheet><cols><col min="2" max="4" hidden="1"/></cols><sheetData><row r="5" hidden="true"><c><v>Private cached value</v></c></row><row r="6" hidden="0"/></sheetData></worksheet>',
    'xl/comments1.xml': '<comments><authors><author>Cell Author</author></authors><commentList><comment ref="B5"><text>Private note</text></comment></commentList></comments>',
    'xl/connections.xml': '<connections><connection name="Private DB"><dbPr connection="Server=private-db;User=private-user"/></connection></connections>',
    'xl/externalLinks/externalLink1.xml': '<externalLink><sheetData><v>Private external cache</v></sheetData></externalLink>',
    'xl/pivotCache/pivotCacheRecords1.xml': '<pivotCacheRecords><s v="private pivot value"/></pivotCacheRecords>',
    'xl/_rels/workbook.xml.rels': rels, 'xl/embeddings/object.bin': new Uint8Array([1, 2, 3]),
  });
  const result = inspectOfficePackage(bytes, 'file.xlsx'), findings = result.parts.flatMap(p => p.findings);
  for (const category of ['office-comments', 'office-hidden', 'office-names', 'office-links', 'office-caches', 'office-embedded']) assert(findings.some(f => f.category === category), category);
  assert.equal(findings.filter(f => f.category === 'office-hidden').length, 3);
  assert(findings.some(f => f.value.includes('private-db')));
  assert(result.parts.find(p => p.path === 'xl/embeddings/object.bin')?.limitations.some(l => l.includes('without execution')));
});

test('host Prepare keeps Office groups read-only and refuses fabricated replacements and part removal', async () => {
  const bytes = office('docx', { 'docProps/core.xml': props, 'word/_rels/document.xml.rels': rels });
  const source = { id: 'office', name: 'private-file.docx', bytes }, inspection = await inspectPreparation([source]);
  assert(inspection.groups.length > 0); assert(inspection.groups.every(g => g.readOnly)); assert(inspection.findings.every(f => f.readOnly));
  assert(inspection.scopes.every(s => s.readOnly));
  await assert.rejects(applyPreparation([source], inspection, [{ groupId: inspection.groups[0]!.id, replacement: '' }]), /read-only/);
  await assert.rejects(applyPreparation([source], inspection, [], [inspection.scopes[1]!.id]), /read-only/);
  const result = await applyPreparation([source], inspection, []);
  assert.deepEqual(result.outputs[0]!.bytes, bytes); assert.equal(result.report.replaced, 0); assert(result.report.remaining > 0);
  const report = JSON.stringify(result.report);
  for (const privateValue of ['Private Author', 'private-file', 'private-link', 'https://']) assert(!report.includes(privateValue));
});

test('Office part removal stays forbidden inside a ZIP while other members remain editable', async () => {
  const docx = office('docx', { 'docProps/core.xml': props });
  const source = { id: 'bundle', name: 'bundle.zip', bytes: storeZip([{ name: 'doc.docx', bytes: docx }, { name: 'secret.txt', bytes: utf8('password=synthetic') }]) };
  const inspection = await inspectPreparation([source]);
  const officePart = inspection.scopes.find(s => s.path.endsWith('/docProps/core.xml'))!;
  await assert.rejects(applyPreparation([source], inspection, [], [officePart.id]), /read-only/);
  const editable = inspection.groups.find(g => !g.readOnly)!;
  const result = await applyPreparation([source], inspection, [{ groupId: editable.id, replacement: 'replacement' }]);
  assert(result.report.replaced > 0); assert.deepEqual(readZipMembers(result.outputs[0]!.bytes)[0]!.compressed, readZipMembers(source.bytes)[0]!.compressed);
});

test('Office package detection protects package parts even when the filename has a ZIP extension', async () => {
  const source = { id: 'renamed', name: 'document.zip', bytes: office('docx', { 'docProps/core.xml': props }) };
  const inspection = await inspectPreparation([source]);
  assert.equal(inspection.scopes[0]!.format, 'docx');
  assert(inspection.scopes.every(s => s.readOnly));
  await assert.rejects(applyPreparation([source], inspection, [], [inspection.scopes[1]!.id]), /read-only/);
});

test('oversized compressed Office members cannot fall back to editable generic ZIP inspection', async () => {
  const bytes = zipSync({ '[Content_Types].xml': utf8('<Types/>'), 'word/document.xml': utf8('<document/>'),
    'docProps/core.xml': utf8('<props><creator>PRIVATE_OVERSIZED_AUTHOR</creator></props>'),
    'word/media/oversized.bin': new Uint8Array(33 * 1024 * 1024) });
  assert(isOfficeSource(bytes, 'document.zip'));
  const source = { id: 'oversized', name: 'document.zip', bytes };
  const inspection = await inspectPreparation([source], [{ id: 'author', label: 'Author', kind: 'literal', value: 'PRIVATE_OVERSIZED_AUTHOR' }]);
  assert(inspection.scopes.every(s => s.readOnly)); assert.equal(inspection.groups.length, 0);
  assert(inspection.scopes[0]!.limitations.some(l => l.includes('expansion limits')));
  const result = await applyPreparation([source], inspection, []); assert.deepEqual(result.outputs[0]!.bytes, bytes);
});

test('DTD/entities, malformed XML, large XML and corrupt packages remain explicitly uninspected', () => {
  const attacks = ['<!DOCTYPE x [<!ENTITY secret SYSTEM "https://private.invalid/">]><x>&secret;</x>', '<x><y></x>', '<x>&amp</x>', '<x a="1" a="2"/>'];
  for (const xml of attacks) assert.throws(() => readOfficeXml(utf8(xml), { nodes: 0 }));
  assert.throws(() => readOfficeXml(new Uint8Array(OFFICE_MAX_XML_BYTES + 1), { nodes: 0 }));
  const result = inspectOfficePackage(office('docx', { 'docProps/core.xml': attacks[0]! }), 'file.docx');
  assert.equal(result.parts.find(p => p.path === 'docProps/core.xml')?.status, 'uninspected');
  const malformed = inspectOfficePackage(new Uint8Array([0x50, 0x4b]), 'file.docx');
  assert.equal(malformed.parts.length, 0); assert(malformed.limitations.some(l => l.includes('malformed')));
});

test('wide XML elements and oversized attribute tags fail within the bounded census', () => {
  const wide = `<x ${Array.from({ length: 129 }, (_, i) => `a${i}="v"`).join(' ')}/>`;
  assert.throws(() => readOfficeXml(utf8(wide), { nodes: 0 }), /attribute limit/);
  const padded = `<x ${Array.from({ length: 5000 }, (_, i) => `a${i}="v"`).join(' ')}${' '.repeat(512 * 1024)}/>`;
  assert.throws(() => readOfficeXml(utf8(padded), { nodes: 0 }), /length limit/);
  const inspection = inspectOfficePackage(office('docx', { 'docProps/core.xml': wide }), 'file.docx');
  assert.equal(inspection.parts.find(p => p.path === 'docProps/core.xml')?.status, 'uninspected');
});

test('package, shared expansion, nesting and finding budgets prevent unbounded inspection', () => {
  const bytes = office('docx', { 'docProps/core.xml': props });
  assert.equal(inspectOfficePackage(bytes, 'file.docx', { maxParts: 1 }).parts.length, 0);
  assert.equal(inspectOfficePackage(bytes, 'file.docx', { maxExpandedBytes: 1 }).parts.length, 0);
  let nested = bytes;
  for (let i = 0; i < 4; i++) nested = office('docx', { 'word/embeddings/nested.docx': nested });
  const result = inspectOfficePackage(nested, 'file.docx');
  assert(result.parts.some(p => p.limitations.some(l => l.includes('beyond two levels'))));
  assert(result.parts.every(p => (p.path.match(/!\//g) ?? []).length <= 2));
  const comments = `<comments>${Array.from({ length: 2100 }, (_, i) => `<comment id="${i}"><t>value ${i}</t></comment>`).join('')}</comments>`;
  const capped = inspectOfficePackage(office('docx', { 'word/comments.xml': comments }), 'file.docx');
  assert.equal(capped.parts.flatMap(p => p.findings).length, 2000);
  assert(capped.parts.some(p => p.status === 'partial'));
});

test('macro packages, legacy/encrypted containers and ambiguous names are identified without execution', () => {
  const macro = inspectOfficePackage(office('docx', { 'word/vbaProject.bin': new Uint8Array([1]) }), 'file.docm');
  assert(macro.limitations.some(l => l.includes('Macro content'))); assert(macro.limitations.some(l => l.includes('unsupported')));
  const ole = inspectOfficePackage(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'file.docx');
  assert.equal(ole.format, 'office-container'); assert(ole.limitations.some(l => l.includes('encrypted')));
  const unsafe = office('docx', { '../secret.xml': '<x/>' });
  assert.equal(inspectOfficePackage(unsafe, 'file.docx').parts.length, 0);
});
