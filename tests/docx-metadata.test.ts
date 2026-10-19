// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { XmlDocument } from 'libxml2-wasm';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { readZipMembers, decodeZipMember, storeZip, storeZipMembers } from '../engine/src/zip.ts';
import { inspectPreparation, applyPreparation } from '../engine/src/prepare.ts';
import { withExtendedFixtureProperties } from './fixtures/docx-metadata/generate-extended.ts';

const fixture = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/metadata.docx', import.meta.url)));
const extendedFixture = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/extended-properties.docx', import.meta.url)));
const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text);
const members = (bytes: Uint8Array = fixture) => readZipMembers(bytes);
const part = (path: string, bytes: Uint8Array = fixture): Uint8Array => decodeZipMember(members(bytes).find(m => m.name === path)!);
const text = (bytes: Uint8Array): string => new TextDecoder(bytes[0] === 0xff ? 'utf-16le' : bytes[0] === 0xfe ? 'utf-16be' : 'utf-8', { fatal: true }).decode(bytes);
function replace(path: string, bytes: Uint8Array, original: Uint8Array = fixture): Uint8Array {
  const changed = members(storeZip([{ name: path, bytes }]))[0]!;
  return storeZipMembers(members(original).map(m => m.name === path ? changed : m));
}
function linkedHeader(path: string, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml', defaultType = false): Uint8Array {
  const header = '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:fldSimple w:instr="DOCPROPERTY &quot;Private project&quot;"/></w:p></w:hdr>';
  let input = storeZipMembers([...members(), ...members(storeZip([{ name: path, bytes: utf8(header) }]))]);
  const declaration = defaultType ? `<Default Extension="${path.split('.').pop()}" ContentType="${type}"/>` : `<Override PartName="/${path}" ContentType="${type}"/>`;
  input = replace('[Content_Types].xml', utf8(text(part('[Content_Types].xml', input)).replace('</Types>', `${declaration}</Types>`)), input);
  input = replace('word/_rels/document.xml.rels', utf8(text(part('word/_rels/document.xml.rels', input)).replace('</Relationships>', `<Relationship Id="outsideHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="../${path}"/></Relationships>`)), input);
  return replace('word/document.xml', utf8(text(part('word/document.xml', input)).replace('<w:sectPr>', '<w:sectPr><w:headerReference w:type="default" r:id="outsideHeader"/>')), input);
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
  for (const path of ['docProps/core.xml', 'docProps/custom.xml', 'docProps/app.xml']) independentXml(part(path, output));
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
  const input = linkedHeader('header1.xml');
  const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('fields can display')));
});

test('Word XML relationship targets with binary names remain inspect-only regardless of their declared type', () => {
  for (const type of ['application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml', 'application/octet-stream']) {
    const input = linkedHeader('header1.bin', type);
    independentXml(part('header1.bin', input));
    const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('Word XML relationship target')));
  }
});

test('unconventional XML part overrides and defaults refuse cleanup even without a known Word relation', () => {
  for (const defaultType of [false, true]) for (const contentType of ['application/xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml']) {
    const entry = readZipMembers(storeZip([{ name: 'unknown.bin', bytes: utf8('<unknown/>') }]))[0]!;
    let input = storeZipMembers([...members(), entry]);
    const declaration = defaultType ? `<Default Extension="bin" ContentType="${contentType}"/>` : `<Override PartName="/unknown.bin" ContentType="${contentType}"/>`;
    input = replace('[Content_Types].xml', utf8(text(part('[Content_Types].xml', input)).replace('</Types>', `${declaration}</Types>`)), input);
    const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('unconventional filename')));
  }
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

test('the maintained extended fixture derives only its app part from the authored Writer source', () => {
  assert.deepEqual(withExtendedFixtureProperties(fixture), extendedFixture);
  const doc = openDocxMetadata(extendedFixture, 'file.docx'); assert.equal(doc.supported, true);
  assert.equal(doc.properties.find(p => p.id === 'app:Company')?.value, 'Private fixture company');
  assert.equal(doc.properties.find(p => p.id === 'app:Manager')?.value, 'Private fixture manager');
  for (const member of members()) if (member.name !== 'docProps/app.xml') {
    const current = members(extendedFixture).find(m => m.name === member.name)!;
    assert.deepEqual(current.local, member.local, member.name); assert.deepEqual(current.compressed, member.compressed, member.name);
  }
  independentXml(part('docProps/app.xml', extendedFixture));
});

test('Company and Manager can be removed individually or together while other app data stays exact', () => {
  const retained = '<HyperlinkBase>https://example.invalid/private-base/</HyperlinkBase><DocSecurity>4</DocSecurity><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Private heading</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs>';
  const app = text(part('docProps/app.xml', extendedFixture)).replace('</Properties>', `${retained}</Properties>`);
  const input = replace('docProps/app.xml', utf8(app), extendedFixture), original = input.slice();
  const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, true);
  for (const selected of [['app:Company'], ['app:Manager'], ['app:Company', 'app:Manager']]) {
    const output = doc.remove(selected), after = openDocxMetadata(output, 'copy.docx'); assert.equal(after.supported, true);
    assert(after.properties.every(p => !selected.includes(p.id)));
    let expected = app;
    for (const id of selected) { const name = id.slice(4); expected = expected.replace(new RegExp(`<${name}>[^<]*</${name}>`), ''); }
    assert.equal(text(part('docProps/app.xml', output)), expected);
    independentXml(part('docProps/app.xml', output));
    for (const member of members(input)) if (member.name !== 'docProps/app.xml') {
      const current = members(output).find(m => m.name === member.name)!;
      assert.deepEqual(current.local, member.local, member.name); assert.deepEqual(current.compressed, member.compressed, member.name);
    }
    assert.deepEqual(after.properties.filter(p => !p.id.startsWith('app:')), doc.properties.filter(p => !p.id.startsWith('app:')));
    for (const id of ['app:Company', 'app:Manager']) if (!selected.includes(id)) assert.deepEqual(after.properties.find(p => p.id === id)?.value, doc.properties.find(p => p.id === id)?.value);
  }
  assert.equal(doc.remove([]), input); assert.deepEqual(input, original);
  assert.throws(() => doc.remove(['app:DocSecurity']), /Invalid DOCX/);
  for (const path of ['[Content_Types].xml', '_rels/.rels']) assert.deepEqual(part(path, doc.remove(['app:Company', 'app:Manager'])), part(path, input));
});

test('extended-property surgery retains UTF-8 and UTF-16 BOMs and all unselected XML text', () => {
  const app = text(part('docProps/app.xml', extendedFixture));
  const encodings = [utf16(app.replace(/encoding="UTF-8"/i, 'encoding="UTF-16"'), true), utf16(app.replace(/encoding="UTF-8"/i, 'encoding="UTF-16"'), false)];
  const bom = new Uint8Array(utf8(app).length + 3); bom.set([0xef, 0xbb, 0xbf]); bom.set(utf8(app), 3); encodings.push(bom);
  for (const encoded of encodings) {
    const input = replace('docProps/app.xml', encoded, extendedFixture), doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, true);
    const output = doc.remove(['app:Company']), result = part('docProps/app.xml', output);
    assert.deepEqual(result.subarray(0, encoded[0] === 0xef ? 3 : 2), encoded.subarray(0, encoded[0] === 0xef ? 3 : 2));
    assert.equal(text(result), text(encoded).replace(/<Company>[^<]*<\/Company>/, '')); independentXml(result);
    assert.equal(openDocxMetadata(output, 'copy.docx').properties.find(p => p.id === 'app:Manager')?.value, 'Private fixture manager');
  }
});

test('extended properties use expanded namespaces, ignore spoofs and reject ambiguous or structured strings', () => {
  const app = text(part('docProps/app.xml', extendedFixture)), uri = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
  const aliases = app.replace('<Company>', `<alias:Company xmlns:alias="${uri}">`).replace('</Company>', '</alias:Company>').replace('<Manager>', `<alias:Manager xmlns:alias="${uri}">`).replace('</Manager>', '</alias:Manager>');
  const input = replace('docProps/app.xml', utf8(aliases), extendedFixture), doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, true);
  const output = doc.remove(['app:Company']); assert(!openDocxMetadata(output, 'copy.docx').properties.some(p => p.id === 'app:Company')); independentXml(part('docProps/app.xml', output));
  const spoof = app.replace('<Company>', '<fake:Company xmlns:fake="urn:unrelated">').replace('</Company>', '</fake:Company>');
  const guarded = openDocxMetadata(replace('docProps/app.xml', utf8(spoof), extendedFixture), 'file.docx'); assert.equal(guarded.supported, true); assert(!guarded.properties.some(p => p.id === 'app:Company'));
  assert.equal(text(part('docProps/app.xml', guarded.remove(['app:Manager']))), spoof.replace(/<Manager>[^<]*<\/Manager>/, ''));
  for (const name of ['Company', 'Manager']) {
    const duplicate = app.replace('</Properties>', `<alias:${name} xmlns:alias="${uri}">Duplicate</alias:${name}></Properties>`);
    assert.equal(openDocxMetadata(replace('docProps/app.xml', utf8(duplicate), extendedFixture), 'file.docx').supported, false);
    const structured = app.replace(`<${name}>`, `<${name}><vt:lpwstr>`).replace(`</${name}>`, `</vt:lpwstr></${name}>`);
    assert.equal(openDocxMetadata(replace('docProps/app.xml', utf8(structured), extendedFixture), 'file.docx').supported, false);
    const attribute = app.replace(`<${name}>`, `<${name} unexpected="value">`);
    assert.equal(openDocxMetadata(replace('docProps/app.xml', utf8(attribute), extendedFixture), 'file.docx').supported, false);
  }
  const empty = app.replace(/<Company>[^<]*<\/Company>/, '<Company/>');
  assert(!openDocxMetadata(openDocxMetadata(replace('docProps/app.xml', utf8(empty), extendedFixture), 'file.docx').remove(['app:Company']), 'copy.docx').properties.some(p => p.id === 'app:Company'));
});

test('canonical app declarations and extended DigSig are required for every DOCX cleanup', () => {
  const app = text(part('docProps/app.xml', extendedFixture));
  const types = text(part('[Content_Types].xml', extendedFixture)), rels = text(part('_rels/.rels', extendedFixture));
  for (const [path, changed] of [
    ['docProps/app.xml', app.replace('http://schemas.openxmlformats.org/officeDocument/2006/extended-properties', 'urn:unrelated')],
    ['[Content_Types].xml', types.replace('application/vnd.openxmlformats-officedocument.extended-properties+xml', 'application/xml')],
    ['_rels/.rels', rels.replace('http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties', 'urn:unrelated')],
    ['_rels/.rels', rels.replace('Target="docProps/app.xml"', 'Target="docProps/missing.xml"')],
    ['_rels/.rels', rels.replace('Target="docProps/app.xml"', 'Target="docProps/app.xml" TargetMode="External"')],
    ['_rels/.rels', rels.replace('Target="docProps/app.xml"', 'Target="docProps/app.xml" TargetMode=""')],
    ['_rels/.rels', rels.replace(/<Relationship\b[^>]*Target="docProps\/app.xml"[^>]*\/>/, match => match.replace(/\bId="[^"]*"/, 'Id=""'))],
    ['_rels/.rels', rels.replace(/<Relationship\b[^>]*Target="docProps\/app.xml"[^>]*\/>/, match => match.replace(/\bId="[^"]*"/, 'Id="not a name"'))],
  ]) assert.equal(openDocxMetadata(replace(path!, utf8(changed!), extendedFixture), 'file.docx').supported, false);
  const missing = storeZipMembers(members(extendedFixture).filter(m => m.name !== 'docProps/app.xml'));
  assert.equal(openDocxMetadata(missing, 'file.docx').supported, false);
  for (const signature of ['<DigSig>U2lnbmF0dXJl</DigSig>', '<DigSig/>', '<s:DigSig xmlns:s="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"/>']) {
    const signed = replace('docProps/app.xml', utf8(app.replace('</Properties>', `${signature}</Properties>`)), extendedFixture), doc = openDocxMetadata(signed, 'file.docx');
    assert.equal(doc.supported, false); assert(doc.limitations.some(l => l.includes('digital-signature'))); assert.throws(() => doc.remove(['core:creator']), /unavailable/);
  }
  const unrelated = replace('docProps/app.xml', utf8(app.replace('</Properties>', '<s:DigSig xmlns:s="urn:unrelated">Retained</s:DigSig></Properties>')), extendedFixture);
  assert.equal(openDocxMetadata(unrelated, 'file.docx').supported, true);
  assert(text(part('docProps/app.xml', openDocxMetadata(unrelated, 'file.docx').remove(['app:Company']))).includes('xmlns:s="urn:unrelated">Retained'));
});

test('content-type Overrides reject ASCII-case duplicates while one valid case alias remains supported', () => {
  const types = text(part('[Content_Types].xml', extendedFixture));
  for (const path of ['word/document.xml', 'docProps/core.xml', 'docProps/custom.xml', 'docProps/app.xml']) {
    const declaration = types.match(/<Override\b[^>]*\/>/g)!.find(node => node.includes(`PartName="/${path}"`))!;
    assert(declaration);
    const alias = declaration.replace(`/${path}`, `/${path.toUpperCase()}`);
    const duplicate = replace('[Content_Types].xml', utf8(types.replace('</Types>', `${alias}</Types>`)), extendedFixture);
    const rejected = openDocxMetadata(duplicate, 'private-input.docx');
    assert.equal(rejected.supported, false); assert.deepEqual(rejected.properties, []);
    assert.throws(() => rejected.remove(['app:Company']), /unavailable/);
    assert.doesNotMatch(JSON.stringify(rejected.limitations), /private-input|Private fixture|DOCPROPS/);
    const valid = replace('[Content_Types].xml', utf8(types.replace(declaration, alias)), extendedFixture);
    const doc = openDocxMetadata(valid, 'file.docx'); assert.equal(doc.supported, true);
    assert.equal(doc.remove([]), valid);
    const copy = doc.remove(['app:Company']);
    assert(!openDocxMetadata(copy, 'copy.docx').properties.some(property => property.id === 'app:Company'));
    assert.deepEqual(part('[Content_Types].xml', copy), part('[Content_Types].xml', valid));
    for (const member of members(valid)) if (member.name !== 'docProps/app.xml') {
      const retained = members(copy).find(current => current.name === member.name)!;
      assert.deepEqual(retained.local, member.local, member.name); assert.deepEqual(retained.compressed, member.compressed, member.name);
    }
  }
});

test('recognized absent property parts refuse orphan Overrides even without their relationship', () => {
  const types = text(part('[Content_Types].xml', extendedFixture)), rels = text(part('_rels/.rels', extendedFixture));
  for (const path of ['docProps/core.xml', 'docProps/custom.xml', 'docProps/app.xml']) {
    const withoutRelationship = rels.replace(/<Relationship\b[^>]*\/>/g, node => node.includes(`Target="${path}"`) ? '' : node);
    assert.notEqual(withoutRelationship, rels);
    const orphan = storeZipMembers(members(replace('_rels/.rels', utf8(withoutRelationship), extendedFixture)).filter(member => member.name !== path));
    for (const partName of [path, path.toUpperCase()]) {
      const input = replace('[Content_Types].xml', utf8(types.replace(`PartName="/${path}"`, `PartName="/${partName}"`)), orphan);
      const before = input.slice(), doc = openDocxMetadata(input, 'private-input.docx');
      assert.equal(doc.supported, false); assert.deepEqual(doc.properties, []);
      assert.throws(() => doc.remove(['app:Company']), /unavailable/); assert.deepEqual(input, before);
      assert.doesNotMatch(JSON.stringify(doc.limitations), /private-input|Private fixture|docProps/);
    }
    const optionalAbsent = replace('[Content_Types].xml', utf8(types.replace(/<Override\b[^>]*\/>/g, node => node.includes(`PartName="/${path}"`) ? '' : node)), orphan);
    const supported = openDocxMetadata(optionalAbsent, 'file.docx'); assert.equal(supported.supported, true); assert.equal(supported.remove([]), optionalAbsent);
    assert(!supported.properties.some(property => property.part === path));
  }
});

test('Company and Manager fields or bound controls remain inspect-only despite cached display text', () => {
  const body = text(part('word/document.xml', extendedFixture));
  for (const name of ['Company', 'Manager']) for (const markup of [
    `<w:fldSimple w:instr=" DOCPROPERTY ${name} "><w:r><w:t>Cached ${name}</w:t></w:r></w:fldSimple>`,
    `<w:p><w:r><w:instrText> DOCPRO</w:instrText></w:r><w:hyperlink><w:r><w:instrText>PERTY ${name} </w:instrText></w:r></w:hyperlink><w:r><w:t>Cached ${name}</w:t></w:r></w:p>`,
    `<w:sdt><w:sdtPr><w:dataBinding w:prefixMappings="xmlns:ap='http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'" w:xpath="/ap:Properties/ap:${name}" w:storeItemID="{66666666-1111-2222-3333-444444444444}"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Cached ${name}</w:t></w:r></w:p></w:sdtContent></w:sdt>`,
  ]) {
    const input = replace('word/document.xml', utf8(body.replace('<w:body>', `<w:body>${markup}`)), extendedFixture), doc = openDocxMetadata(input, 'file.docx');
    independentXml(part('word/document.xml', input)); assert.equal(doc.supported, false); assert.throws(() => doc.remove([`app:${name}`]), /unavailable/);
  }
});

test('extended Prepare choices stay granular and source-bound with private reports and byte-identical no-op', async () => {
  const source = { id: 'doc', name: 'private-extended.docx', bytes: extendedFixture }, inspection = await inspectPreparation([source]);
  const fields = ['app:Company', 'app:Manager'].map(id => inspection.findings.find(f => f.propertyId === id && f.action === 'remove-property')!);
  assert(fields.every(field => field?.groupId)); assert.notEqual(fields[0]!.groupId, fields[1]!.groupId);
  const unchanged = await applyPreparation([source], inspection, []); assert.deepEqual(unchanged.outputs[0]!.bytes, extendedFixture); assert.equal(unchanged.report.replaced, 0);
  const choices = [{ groupId: fields[0]!.groupId, replacement: '' }], result = await applyPreparation([source], inspection, choices);
  assert.equal(result.report.replaced, 1); assert(!result.inspection.findings.some(f => f.propertyId === 'app:Company'));
  assert(result.inspection.findings.some(f => f.propertyId === 'app:Manager' && f.value === 'Private fixture manager'));
  assert.doesNotMatch(JSON.stringify(result.report), /Private fixture|private-extended|docProps/);
  await assert.rejects(applyPreparation([{ ...source, bytes: result.outputs[0]!.bytes }], inspection, choices), /changed/);
  assert.deepEqual(source.bytes, extendedFixture);
});

const APPLICATION = ['app:Template', 'app:HyperlinkBase', 'app:Application', 'app:AppVersion'];
const STATISTICS = ['app:TotalTime', 'app:Pages', 'app:Words', 'app:Characters', 'app:CharactersWithSpaces', 'app:Lines', 'app:Paragraphs'];
const privateApplication = /Private fixture template|private-fixture\.example\.invalid|Private fixture producer|Private heading/;
function applicationFixture(): { input: Uint8Array; app: string } {
  const app = text(part('docProps/app.xml', extendedFixture))
    .replace('<Template></Template>', '<Template>Private fixture template.dotx</Template>')
    .replace('<TotalTime>0</TotalTime>', '<TotalTime>4242</TotalTime>')
    .replace(/<Application>[^<]*<\/Application>/, '<Application>Private fixture producer</Application>')
    .replace(/<AppVersion>[^<]*<\/AppVersion>/, '<AppVersion>16.0000</AppVersion>')
    .replace('</Properties>', '<Pages>7</Pages><Words>1234</Words><Characters>5678</Characters><CharactersWithSpaces>6789</CharactersWithSpaces><Lines>89</Lines><Paragraphs>21</Paragraphs><HyperlinkBase>https://private-fixture.example.invalid/base/</HyperlinkBase><DocSecurity>0</DocSecurity><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Private heading</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs></Properties>');
  return { input: replace('docProps/app.xml', utf8(app), extendedFixture), app };
}
function withoutElements(app: string, ids: string[]): string {
  let expected = app;
  for (const id of ids) { const name = id.slice(4); expected = expected.replace(new RegExp(`<${name}>[^<]*</${name}>`), ''); }
  return expected;
}

test('Template, hyperlink base, application and statistics fields are removed with raw members preserved and the copy inspected again', () => {
  const { input, app } = applicationFixture(), original = input.slice();
  independentXml(part('docProps/app.xml', input));
  const doc = openDocxMetadata(input, 'file.docx'); assert.equal(doc.supported, true);
  for (const id of [...APPLICATION, ...STATISTICS]) assert(doc.properties.some(p => p.id === id && p.part === 'docProps/app.xml'), id);
  assert.equal(doc.properties.find(p => p.id === 'app:HyperlinkBase')?.label, 'Hyperlink base');
  assert(!doc.limitations.some(l => l.includes('so they are retained')));
  for (const selected of [['app:Template'], ['app:HyperlinkBase'], ['app:Application', 'app:AppVersion'], STATISTICS, [...APPLICATION, ...STATISTICS, 'app:Company', 'app:Manager']]) {
    const output = doc.remove(selected), after = openDocxMetadata(output, 'copy.docx'); assert.equal(after.supported, true);
    assert(after.properties.every(p => !selected.includes(p.id)));
    for (const property of doc.properties.filter(p => !selected.includes(p.id))) assert.equal(after.properties.find(p => p.id === property.id)?.value, property.value, property.id);
    const result = text(part('docProps/app.xml', output));
    assert.equal(result, withoutElements(app, selected)); independentXml(part('docProps/app.xml', output));
    assert(result.includes('<DocSecurity>0</DocSecurity>')); assert(result.includes('<vt:lpstr>Private heading</vt:lpstr>'));
    for (const member of members(input)) if (member.name !== 'docProps/app.xml') {
      const current = members(output).find(m => m.name === member.name)!;
      assert.deepEqual(current.local, member.local, member.name); assert.deepEqual(current.compressed, member.compressed, member.name);
    }
  }
  assert.equal(doc.remove([]), input); assert.deepEqual(input, original);
  for (const unsupported of ['app:DocSecurity', 'app:HeadingPairs', 'app:TitlesOfParts', 'app:LinksUpToDate']) assert.throws(() => doc.remove([unsupported]), /Invalid DOCX/);
});

test('the preservation guard refuses structured or duplicated application and statistics values', () => {
  const { app } = applicationFixture(), uri = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
  for (const name of ['Template', 'HyperlinkBase', 'Application', 'AppVersion', 'TotalTime', 'Pages', 'Words', 'Characters', 'CharactersWithSpaces', 'Lines', 'Paragraphs']) {
    const structured = app.replace(new RegExp(`<${name}>([^<]*)</${name}>`), `<${name}><vt:lpwstr>$1</vt:lpwstr></${name}>`);
    assert.notEqual(structured, app, name);
    assert.equal(openDocxMetadata(replace('docProps/app.xml', utf8(structured), extendedFixture), 'file.docx').supported, false, name);
    const duplicate = app.replace('</Properties>', `<alias:${name} xmlns:alias="${uri}">1</alias:${name}></Properties>`);
    assert.equal(openDocxMetadata(replace('docProps/app.xml', utf8(duplicate), extendedFixture), 'file.docx').supported, false, name);
  }
});

test('fields and relative links that use application properties keep those properties and still allow other removals', () => {
  const { input } = applicationFixture(), body = text(part('word/document.xml', input));
  const cases: [string, string[]][] = [
    ['<w:fldSimple w:instr=" TEMPLATE \\p "><w:r><w:t>Cached template</w:t></w:r></w:fldSimple>', ['app:Template']],
    ['<w:r><w:instrText> EDIT</w:instrText></w:r><w:r><w:instrText>TIME </w:instrText></w:r><w:r><w:t>4242</w:t></w:r>', ['app:TotalTime']],
    ['<w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>7</w:t></w:r></w:fldSimple>', ['app:Pages']],
    ['<w:fldSimple w:instr=" NUMWORDS "><w:r><w:t>1234</w:t></w:r></w:fldSimple>', ['app:Words']],
    ['<w:fldSimple w:instr=" NUMCHARS "><w:r><w:t>5678</w:t></w:r></w:fldSimple>', ['app:Characters', 'app:CharactersWithSpaces']],
    ['<w:fldSimple w:instr=" HYPERLINK &quot;shared/spec.docx&quot; "><w:r><w:t>Spec</w:t></w:r></w:fldSimple>', ['app:HyperlinkBase']],
    ['<w:r><w:instrText> INCLUDEPICTURE &quot;images/logo.png&quot; </w:instrText></w:r>', ['app:HyperlinkBase']],
  ];
  for (const [markup, retained] of cases) {
    const fielded = replace('word/document.xml', utf8(body.replace('<w:body>', `<w:body><w:p>${markup}</w:p>`)), input);
    independentXml(part('word/document.xml', fielded));
    const doc = openDocxMetadata(fielded, 'private-input.docx'); assert.equal(doc.supported, true, markup);
    for (const id of retained) { assert(!doc.properties.some(p => p.id === id), id); assert.throws(() => doc.remove([id]), /Invalid DOCX/); }
    const labels = retained.map(id => ({ 'app:Template': 'Template', 'app:TotalTime': 'Total editing time', 'app:Pages': 'Page count', 'app:Words': 'Word count', 'app:Characters': 'Character count', 'app:CharactersWithSpaces': 'Character count with spaces', 'app:HyperlinkBase': 'Hyperlink base' } as Record<string, string>)[id]!);
    assert(doc.limitations.some(l => l.includes('so they are retained') && labels.every(label => l.includes(label))), markup);
    assert.doesNotMatch(JSON.stringify(doc.limitations), privateApplication);
    const others = [...APPLICATION, ...STATISTICS].filter(id => !retained.includes(id));
    const output = doc.remove(others), result = text(part('docProps/app.xml', output));
    for (const id of retained) assert.match(result, new RegExp(`<${id.slice(4)}>[^<]+</${id.slice(4)}>`), id);
    const after = openDocxMetadata(output, 'copy.docx'); assert.equal(after.supported, true);
    assert(others.every(id => !after.properties.some(p => p.id === id))); assert(retained.every(id => !after.properties.some(p => p.id === id)));
  }
});

test('relative external relationships keep the hyperlink base while absolute links do not', () => {
  const { input } = applicationFixture(), rels = text(part('word/_rels/document.xml.rels', input));
  const link = (target: string): Uint8Array => replace('word/_rels/document.xml.rels', utf8(rels.replace('</Relationships>', `<Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${target}" TargetMode="External"/></Relationships>`)), input);
  for (const target of ['../shared/spec.docx', 'spec.docx', '\\\\server\\share\\spec.docx']) {
    const doc = openDocxMetadata(link(target), 'file.docx'); assert.equal(doc.supported, true, target);
    assert(!doc.properties.some(p => p.id === 'app:HyperlinkBase'), target); assert(doc.properties.some(p => p.id === 'app:Template'), target);
    assert(doc.limitations.some(l => l.includes('so they are retained: Hyperlink base.')), target);
  }
  for (const target of ['https://example.invalid/spec', 'mailto:someone@example.invalid', 'file:///C:/shared/spec.docx']) {
    const doc = openDocxMetadata(link(target), 'file.docx'); assert.equal(doc.supported, true, target);
    const output = doc.remove(['app:HyperlinkBase']); assert(!text(part('docProps/app.xml', output)).includes('HyperlinkBase'), target);
  }
});

test('charts and drawings keep the application name and version in every selection while other properties are still removed', async () => {
  const { input, app } = applicationFixture(), body = text(part('word/document.xml', input));
  const drawing = (markup: string, before = ''): Uint8Array => replace('word/document.xml', utf8(body.replace('<w:body>', `${before}<w:body>${markup}`)), input);
  let chart = storeZipMembers([...members(input), ...members(storeZip([{ name: 'word/charts/chart1.xml', bytes: utf8('<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart/></c:chartSpace>') }]))]);
  chart = replace('[Content_Types].xml', utf8(text(part('[Content_Types].xml', chart)).replace('</Types>', '<Override PartName="/word/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>')), chart);
  chart = replace('word/_rels/document.xml.rels', utf8(text(part('word/_rels/document.xml.rels', chart)).replace('</Relationships>', '<Relationship Id="rIdChart" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart1.xml"/></Relationships>')), chart);
  const kept = ['app:Application', 'app:AppVersion'], others = [...APPLICATION, ...STATISTICS, 'app:Company', 'app:Manager'].filter(id => !kept.includes(id));
  const variants: [string, Uint8Array][] = [
    ['DrawingML', drawing('<w:p><w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Chart 1"/></wp:inline></w:drawing></w:r></w:p>')],
    ['VML picture', drawing('<w:p><w:r><w:pict><v:rect style="width:10pt;height:10pt"/></w:pict></w:r></w:p>')],
    ['embedded object', drawing('<w:p><w:r><w:object/></w:r></w:p>')],
    ['VML background', drawing('', '<w:background w:color="FFFFFF"><v:background id="page"/></w:background>')],
    ['chart part', chart],
  ];
  for (const [name, variant] of variants) {
    independentXml(part('word/document.xml', variant));
    const doc = openDocxMetadata(variant, 'private-input.docx'); assert.equal(doc.supported, true, name);
    for (const id of kept) { assert(!doc.properties.some(p => p.id === id), `${name} ${id}`); assert.throws(() => doc.remove([id]), /Invalid DOCX/); }
    assert(doc.limitations.some(l => l.includes('so they are retained: Application, Application version.')), name);
    assert.doesNotMatch(JSON.stringify(doc.limitations), privateApplication);
    const output = doc.remove(others);
    assert.equal(text(part('docProps/app.xml', output)), withoutElements(app, others), name); independentXml(part('docProps/app.xml', output));
    for (const member of members(variant)) if (member.name !== 'docProps/app.xml') assert.deepEqual(members(output).find(m => m.name === member.name)!.compressed, member.compressed, `${name} ${member.name}`);
    const after = openDocxMetadata(output, 'copy.docx'); assert.equal(after.supported, true, name);
    assert.deepEqual(after.properties.filter(p => p.part === 'docProps/app.xml'), [], name);
  }
  // Bulk paths (Prepare's default selection, --strip-hidden-data and --replace-all) take every remove-property group, so none may name these fields.
  const source = { id: 'doc', name: 'private-chart.docx', bytes: chart }, inspection = await inspectPreparation([source]);
  assert(!inspection.findings.some(f => f.action === 'remove-property' && kept.includes(f.propertyId!)));
  const choices = inspection.groups.filter(g => g.action === 'remove-property').map(g => ({ groupId: g.id, replacement: '' }));
  const result = await applyPreparation([source], inspection, choices), copy = text(part('docProps/app.xml', result.outputs[0]!.bytes));
  assert.match(copy, /<Application>Private fixture producer<\/Application><AppVersion>16\.0000<\/AppVersion>/); assert.doesNotMatch(copy, /<Company>|<Template>|<Words>/);
  assert.doesNotMatch(JSON.stringify(result.report), privateApplication);
  // The base fixture declares the DrawingML and VML namespaces without using them, and both fields stay removable there.
  assert.match(body, /xmlns:v="urn:schemas-microsoft-com:vml"/); assert.match(body, /xmlns:wp="/);
  assert(kept.every(id => openDocxMetadata(input, 'file.docx').properties.some(p => p.id === id)));
});

test('DOCPROPERTY fields and bound controls for the new application fields remain inspect-only', () => {
  const { input } = applicationFixture(), body = text(part('word/document.xml', input));
  for (const name of ['Template', 'HyperlinkBase', 'Application', 'AppVersion', 'TotalTime', 'Pages', 'Words', 'Characters', 'CharactersWithSpaces', 'Lines', 'Paragraphs']) for (const markup of [
    `<w:fldSimple w:instr=" DOCPROPERTY ${name} "><w:r><w:t>Cached ${name}</w:t></w:r></w:fldSimple>`,
    `<w:sdt><w:sdtPr><w:dataBinding w:prefixMappings="xmlns:ap='http://schemas.openxmlformats.org/officeDocument/2006/extended-properties'" w:xpath="/ap:Properties/ap:${name}" w:storeItemID="{66666666-1111-2222-3333-444444444444}"/></w:sdtPr><w:sdtContent><w:p><w:r><w:t>Cached ${name}</w:t></w:r></w:p></w:sdtContent></w:sdt>`,
  ]) {
    const guarded = replace('word/document.xml', utf8(body.replace('<w:body>', `<w:body>${markup}`)), input), doc = openDocxMetadata(guarded, 'file.docx');
    independentXml(part('word/document.xml', guarded)); assert.equal(doc.supported, false, name); assert.throws(() => doc.remove([`app:${name}`]), /unavailable/);
  }
});

test('Prepare removes application and statistics fields with granular choices and a value-free report', async () => {
  const { input } = applicationFixture(), source = { id: 'doc', name: 'private-app.docx', bytes: input }, inspection = await inspectPreparation([source]);
  const findings = [...APPLICATION, ...STATISTICS].map(id => inspection.findings.find(f => f.propertyId === id && f.action === 'remove-property')!);
  assert(findings.every(f => f?.groupId)); assert.equal(new Set(findings.map(f => f.groupId)).size, findings.length);
  assert(inspection.scopes[0]!.limitations.some(l => l.includes('compatibility behaviour')));
  const choices = findings.map(f => ({ groupId: f.groupId, replacement: '' })), result = await applyPreparation([source], inspection, choices);
  assert.equal(result.report.replaced, findings.length); assert.equal(result.report.stages?.[0]?.operation, 'remove-properties');
  assert(![...APPLICATION, ...STATISTICS].some(id => result.inspection.findings.some(f => f.propertyId === id)));
  assert(result.inspection.findings.some(f => f.propertyId === 'app:Company' && f.value === 'Private fixture company'));
  const after = openDocxMetadata(result.outputs[0]!.bytes, 'copy.docx'); assert.equal(after.supported, true);
  assert(![...APPLICATION, ...STATISTICS].some(id => after.properties.some(p => p.id === id)));
  assert.match(text(part('docProps/app.xml', result.outputs[0]!.bytes)), /<DocSecurity>0<\/DocSecurity>/);
  assert.doesNotMatch(JSON.stringify(result.report), privateApplication); assert.doesNotMatch(JSON.stringify(result.report), /private-app|docProps/);
  await assert.rejects(applyPreparation([{ ...source, bytes: result.outputs[0]!.bytes }], inspection, choices), /changed/);
  assert.deepEqual(source.bytes, input);
});
