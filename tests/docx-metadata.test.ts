// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { XmlDocument } from 'libxml2-wasm';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { readZipMembers, decodeZipMember, storeZip, storeZipMembers } from '../engine/src/zip.ts';
import { inspectPreparation, applyPreparation } from '../engine/src/prepare.ts';

const fixture = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/metadata.docx', import.meta.url)));
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const members = (bytes: Uint8Array = fixture) => readZipMembers(bytes);
const part = (path: string, bytes: Uint8Array = fixture): Uint8Array => decodeZipMember(members(bytes).find(m => m.name === path)!);
const text = (bytes: Uint8Array): string => new TextDecoder(bytes[0] === 0xff ? 'utf-16le' : bytes[0] === 0xfe ? 'utf-16be' : 'utf-8', { fatal: true }).decode(bytes);
function replace(path: string, bytes: Uint8Array, original: Uint8Array = fixture): Uint8Array {
  const changed = members(storeZip([{ name: path, bytes }]))[0]!;
  return storeZipMembers(members(original).map(m => m.name === path ? changed : m));
}
function independentXml(bytes: Uint8Array): void {
  const native = XmlDocument.fromBuffer(bytes); native.dispose();
  const dom = new JSDOM(text(bytes), { contentType: 'application/xml' }); dom.window.close();
}
function utf16(value: string, little: boolean): Uint8Array {
  const bytes = new Uint8Array(2 + value.length * 2), view = new DataView(bytes.buffer);
  view.setUint16(0, 0xfeff, little);
  for (let i = 0; i < value.length; i++) view.setUint16(2 + i * 2, value.charCodeAt(i), little);
  return bytes;
}

test('authentic Writer DOCX removes selected properties and preserves unrelated raw ZIP members', () => {
  const original = fixture.slice(), document = openDocxMetadata(fixture, 'private.docx');
  assert.equal(document.supported, true);
  assert(document.properties.some(p => p.id === 'core:creator'));
  const selected = ['core:creator', 'custom:3'], output = document.remove(selected);
  const after = openDocxMetadata(output, 'copy.docx');
  assert.equal(after.supported, true); assert(after.properties.every(p => !selected.includes(p.id)));
  assert(after.properties.some(p => p.id === 'custom:2' && p.value === 'Unselected custom value'));
  for (const member of members()) {
    const current = members(output).find(m => m.name === member.name)!;
    if (['docProps/core.xml', 'docProps/custom.xml'].includes(member.name)) independentXml(decodeZipMember(current));
    else { assert.deepEqual(current.local, member.local, member.name); assert.deepEqual(current.compressed, member.compressed, member.name); }
  }
  const customBefore = text(part('docProps/custom.xml')), customAfter = text(part('docProps/custom.xml', output));
  const selectedRange = /<property\b[^>]*pid="3"[^>]*>[\s\S]*?<\/property>/.exec(customBefore)![0];
  assert.equal(customAfter, customBefore.replace(selectedRange, ''));
  assert.deepEqual(fixture, original); assert.deepEqual(document.remove([]), original);
  assert.throws(() => document.remove(['forged']), /Invalid DOCX/);
});

test('removing every supported property retains valid empty property parts and declarations', () => {
  const document = openDocxMetadata(fixture, 'file.docx'), output = document.remove(document.properties.map(p => p.id));
  assert.deepEqual(openDocxMetadata(output, 'copy.docx').properties, []);
  for (const path of ['docProps/core.xml', 'docProps/custom.xml']) independentXml(part(path, output));
  for (const path of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) assert.deepEqual(part(path, output), part(path));
});

test('UTF-8 and UTF-16 BOM offsets preserve unselected property text exactly', () => {
  const core = text(part('docProps/core.xml'));
  for (const little of [true, false]) {
    const encoded = utf16(core.replace(/encoding="UTF-8"/i, 'encoding="UTF-16"'), little);
    const input = replace('docProps/core.xml', encoded), doc = openDocxMetadata(input, 'file.docx');
    assert.equal(doc.supported, true);
    const output = doc.remove(['core:creator']), result = part('docProps/core.xml', output);
    assert.deepEqual(result.subarray(0, 2), encoded.subarray(0, 2)); independentXml(result);
    assert.equal(text(result), text(encoded).replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, ''));
  }
  const bom = new Uint8Array(part('docProps/core.xml').length + 3); bom.set([0xef, 0xbb, 0xbf]); bom.set(part('docProps/core.xml'), 3);
  assert.deepEqual(part('docProps/core.xml', openDocxMetadata(replace('docProps/core.xml', bom), 'file.docx').remove(['core:creator'])).subarray(0, 3), bom.subarray(0, 3));
});

test('malformed XML is rejected by an independent reader and exposes no DOCX edits', () => {
  const core = text(part('docProps/core.xml'));
  const malformed = [
    core.replace('<dc:creator>', '<unbound:creator>').replace('</dc:creator>', '</unbound:creator>'),
    core.replace('<dc:creator>', '<dc:creator x="1" x="2">'),
    core.replace('<dc:creator>', '<dc:creator x="a<b">'),
    core.replace('<dc:creator>', '<dc:creator x=unquoted>'),
    core.replace('<dc:creator>', '<!--a--b--><dc:creator>'),
    core.replace('<dc:creator>', '<!--a---><dc:creator>'),
    core.replace('</dc:creator>', '</ dc:creator>'),
    core.replace('<dc:creator>', '<dc:creator/>').replace('</dc:creator>', '</dc:creator>'),
    core.replace('<?xml', '<?XML'),
    core.replace('<dc:creator>', '<dc:creator>\ud800'),
    core.replace('<dc:creator>', '<dc:creator>&#X41;'),
  ];
  for (const value of malformed) {
    const encoded = value.includes('\ud800') ? utf16(value.replace(/encoding="UTF-8"/i, 'encoding="UTF-16"'), true) : utf8(value);
    assert.throws(() => independentXml(encoded));
    assert.equal(openDocxMetadata(replace('docProps/core.xml', encoded), 'file.docx').supported, false);
  }
});

test('namespace matching removes only approved properties and leaves unrelated custom text unchanged', () => {
  const core = text(part('docProps/core.xml')).replace('xmlns:dc=', 'xmlns:alt=').replace(/dc:/g, 'alt:');
  const input = replace('docProps/core.xml', utf8(core));
  assert.equal(openDocxMetadata(input, 'file.docx').supported, true);
  const spoof = core.replace('http://purl.org/dc/elements/1.1/', 'urn:unrelated');
  const doc = openDocxMetadata(replace('docProps/core.xml', utf8(spoof)), 'file.docx');
  assert.equal(doc.supported, true); assert(!doc.properties.some(p => p.id === 'core:creator'));
  const output = doc.remove(['custom:2']); assert.equal(text(part('docProps/core.xml', output)), spoof);
  const malformedDeclaration = core.replace('<cp:coreProperties', '<cp:coreProperties xmlns:1bad="urn:bad"');
  assert.throws(() => independentXml(utf8(malformedDeclaration)));
  assert.equal(openDocxMetadata(replace('docProps/core.xml', utf8(malformedDeclaration)), 'file.docx').supported, false);
  const commented = core.replace('<dc:creator>', '<!----><?custom unchanged?><dc:creator>');
  assert.equal(openDocxMetadata(replace('docProps/core.xml', utf8(commented)), 'file.docx').supported, true);
});

test('property-dependent simple and split complex fields refuse cleanup even with cached visible text', () => {
  const body = text(part('word/document.xml'));
  for (const fields of [
    '<w:fldSimple w:instr=" DOCPROPERTY &quot;Private project&quot; "><w:r><w:t>Cached visible value</w:t></w:r></w:fldSimple>',
    '<w:r><w:instrText> DOC</w:instrText></w:r><w:r><w:instrText>PROPERTY Title </w:instrText></w:r><w:r><w:t>Cached visible value</w:t></w:r>',
    '<w:fldSimple w:instr=" AUTHOR "><w:r><w:t>Cached author</w:t></w:r></w:fldSimple>',
    '<w:p><w:r><w:instrText> DOCPRO</w:instrText></w:r><w:hyperlink><w:r><w:instrText>PERTY &quot;Private project&quot; </w:instrText></w:r></w:hyperlink></w:p><w:p><w:r><w:instrText> DATE </w:instrText></w:r></w:p>',
  ]) {
    const input = replace('word/document.xml', utf8(body.replace('<w:body>', `<w:body>${fields}`))), doc = openDocxMetadata(input, 'file.docx');
    independentXml(part('word/document.xml', input)); assert.equal(doc.supported, false);
    assert(doc.limitations.some(l => l.includes('fields can display'))); assert.throws(() => doc.remove(['core:creator']), /unavailable/);
  }
});

test('signatures, macros, ambiguous names, renamed packages and failed limits remain inspect-only', () => {
  assert.equal(openDocxMetadata(fixture, 'renamed.zip').supported, false);
  assert.equal(openDocxMetadata(fixture, 'file.docx', { maxParts: 1 }).supported, false);
  assert.equal(openDocxMetadata(fixture, 'file.docx', { maxExpandedBytes: 10 }).supported, false);
  for (const name of ['word/vbaProject.bin', '_xmlsignatures/sig1.xml', 'DOCPROPS/CORE.XML']) {
    const input = storeZipMembers([...members(), ...members(storeZip([{ name, bytes: utf8('<sig/>') }]))]);
    assert.equal(openDocxMetadata(input, 'file.docx').supported, false);
  }
  const duplicate = text(part('docProps/custom.xml')).replace('name="Keep this field"', 'name="Private project"');
  assert.equal(openDocxMetadata(replace('docProps/custom.xml', utf8(duplicate)), 'file.docx').supported, false);
  const normalizedDuplicate = text(part('docProps/custom.xml')).replace('name="Private project"', 'name="Keep\r\nthis field"');
  independentXml(utf8(normalizedDuplicate));
  assert.equal(openDocxMetadata(replace('docProps/custom.xml', utf8(normalizedDuplicate)), 'file.docx').supported, false);
});

test('property-dependent headers outside the conventional word directory refuse cleanup', () => {
  const header = '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:fldSimple w:instr="DOCPROPERTY &quot;Private project&quot;"/></w:p></w:hdr>';
  let input = storeZipMembers([...members(), ...members(storeZip([{ name: 'header1.xml', bytes: utf8(header) }]))]);
  input = replace('[Content_Types].xml', utf8(text(part('[Content_Types].xml', input)).replace('</Types>', '<Override PartName="/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>')), input);
  input = replace('word/_rels/document.xml.rels', utf8(text(part('word/_rels/document.xml.rels', input)).replace('</Relationships>', '<Relationship Id="outsideHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="../header1.xml"/></Relationships>')), input);
  input = replace('word/document.xml', utf8(text(part('word/document.xml', input)).replace('<w:sectPr>', '<w:sectPr><w:headerReference w:type="default" r:id="outsideHeader"/>')), input);
  const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('fields can display')));
});

test('XML-bound property content controls refuse cleanup despite cached display text', () => {
  const binding = '<w:sdt><w:sdtPr><w:dataBinding w:prefixMappings="xmlns:ns1=\'http://schemas.openxmlformats.org/package/2006/metadata/core-properties\' xmlns:ns0=\'http://purl.org/dc/elements/1.1/\'" w:xpath="/ns1:coreProperties[1]/ns0:title[1]" w:storeItemID="{6C3C8BC8-F283-45AE-878A-BAB7291924A1}"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Cached title</w:t></w:r></w:p></w:sdtContent></w:sdt>';
  const input = replace('word/document.xml', utf8(text(part('word/document.xml')).replace('<w:body>', `<w:body>${binding}`)));
  independentXml(part('word/document.xml', input));
  const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('bound content')));
});

test('Prepare removal choices are source-bound, granular, removal-only and value-free in reports', async () => {
  const source = { id: 'doc', name: 'private-name.docx', bytes: fixture }, inspection = await inspectPreparation([source]);
  assert(inspection.scopes[0]!.actions?.includes('remove-property'));
  const author = inspection.findings.find(f => f.action === 'remove-property' && f.label === 'Author')!;
  const group = inspection.groups.find(g => g.id === author.groupId)!;
  assert.equal(group.replacement, ''); assert.equal(group.readOnly, undefined);
  await assert.rejects(applyPreparation([source], inspection, [{ groupId: group.id, replacement: 'replace' }]), /removal only/);
  await assert.rejects(applyPreparation([source], inspection, [], [author.scopeId]), /read-only/);
  const result = await applyPreparation([source], inspection, [{ groupId: group.id, replacement: '' }]);
  assert.equal(result.report.replaced, 1); assert.equal(result.report.stages?.[0]?.operation, 'remove-properties');
  assert(!result.inspection.findings.some(f => f.action === 'remove-property' && f.label === 'Author'));
  assert(result.inspection.findings.some(f => f.action === 'remove-property' && f.value === 'Unselected custom value'));
  const report = JSON.stringify(result.report);
  for (const privateValue of ['private-name', 'Private project', 'Private core', 'Private author', 'Unselected custom value', 'docProps/']) assert(!report.includes(privateValue));
  await assert.rejects(applyPreparation([{ ...source, bytes: result.outputs[0]!.bytes }], inspection, [{ groupId: group.id, replacement: '' }]), /changed/);
  const nested = await inspectPreparation([{ id: 'zip', name: 'bundle.zip', bytes: storeZip([{ name: 'file.docx', bytes: fixture }]) }]);
  assert(nested.groups.every(g => g.readOnly));
});
