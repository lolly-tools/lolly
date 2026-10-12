// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createRuntime } from '../engine/src/runtime.ts';
import type { LoadedTool } from '../engine/src/loader.ts';
import type { InputFile } from '../packages/core/src/host-v1.ts';
import { createMockHost } from '../packages/core/src/mock-host.ts';
import { createPrepareAPI, inspectPreparation } from '../engine/src/prepare.ts';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { readZipMembers, decodeZipMember, storeZipMembers, storeZip } from '../engine/src/zip.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import { renderPreparationReview, preparationChoices } from '../shells/web/src/components/prepare/review.ts';
import { canvasBlockBooleanValue } from '../shells/web/src/lib/canvas-block-input.ts';
import { operationComparisonPair } from '../shells/web/src/lib/compare-operation-sources.ts';
import { compareSources } from '../engine/src/compare.ts';

const bytes = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/metadata.docx', import.meta.url)));
const extendedBytes = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/extended-properties.docx', import.meta.url)));
const fileRef = (name: string, data: Uint8Array = bytes): InputFile => ({ __file: true, name, bytes: data, size: data.length, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', url: null });
const tool: LoadedTool = {
  trustClass: 'development-unsigned', styles: null, hooksUrl: null, textTemplates: {}, textTemplateErrors: {},
  manifest: JSON.parse(readFileSync(new URL('../community/strip-data/tool.json', import.meta.url), 'utf8')),
  hooksSource: readFileSync(new URL('../community/strip-data/hooks.js', import.meta.url), 'utf8'),
  template: readFileSync(new URL('../community/strip-data/template.html', import.meta.url), 'utf8'),
};

test('Strip Data supports individual DOCX property choices and resets selection after a source change', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const runtime = await createRuntime(tool, host, { source: fileRef('private.docx') });
  assert.match(runtime.getHydrated(), /Select a property to remove/); assert.doesNotMatch(runtime.getHydrated(), /data-export-file|already clean/);
  assert.doesNotMatch(runtime.getHydrated(), /id="exif-show-details"[^>]*\bchecked\b/);
  await assert.rejects(runtime.exportFile(), /Select document properties/);
  const choices = runtime.getModel().find(item => item.id === 'properties')!.value as { id: string; remove: boolean }[];
  const inspection = await host.prepare.inspect([{ id: 'office', name: 'private.docx', bytes }]);
  const author = inspection.findings.find(f => f.action === 'remove-property' && f.label === 'Author')!;
  await runtime.setInput('properties', choices.map(row => ({ ...row, remove: row.id.endsWith(`:${author.groupId}`) })));
  assert.match(runtime.getHydrated(), /data-export-file/);
  const output = await runtime.exportFile() as { bytes: Uint8Array; filename: string };
  assert.equal(output.filename, 'private-prepared.docx');
  assert(!openDocxMetadata(output.bytes, 'copy.docx').properties.some(p => p.id === 'core:creator'));
  assert(openDocxMetadata(output.bytes, 'copy.docx').properties.some(p => p.value === 'Unselected custom value'));
  await runtime.setInput('source', fileRef('another.docx', output.bytes));
  assert.doesNotMatch(runtime.getHydrated(), /data-export-file/);
  assert((runtime.getModel().find(item => item.id === 'properties')!.value as { remove: boolean }[]).every(row => !row.remove));
  await runtime.setInput('properties', choices.map(row => ({ ...row, remove: true })));
  await assert.rejects(runtime.exportFile(), /Select document properties/);
  await runtime.setInput('source', null);
  assert.deepEqual(runtime.getModel().find(item => item.id === 'properties')!.value, []);
  assert.equal(host.inspect.logs.length, 0); assert.equal(host.inspect.state.size, 0);
});

test('Prepare offers removal controls without text replacement and retains value masking', async () => {
  const dom = new JSDOM('<main></main>'), previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const root = document.querySelector<HTMLElement>('main')!, inspection = await inspectPreparation([{ id: 'doc', name: 'private.docx', bytes }]);
    renderPreparationReview(root, inspection);
    assert(root.querySelector('[data-selected]:not(:disabled)')); assert.equal(root.querySelector('[data-replacement]'), null);
    assert(!root.textContent!.includes('Private project')); assert(!root.textContent!.includes('Private fixture title'));
    const choices = preparationChoices(root); assert(choices.length > 0); assert(choices.every(choice => choice.replacement === ''));
    root.querySelectorAll<HTMLButtonElement>('[data-reveal]').forEach(button => { button.click(); }); assert(root.textContent!.includes('Private fixture title')); assert(root.textContent!.includes('Private project'));
    assert.equal(root.querySelector('[data-remove]'), null);
  } finally { dom.window.close(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); }
});

test('canvas boolean row controls validate declared fields and refuse stale row identifiers', () => {
  const input = buildInputModel({ inputs: [{ id: 'choices', type: 'blocks', fields: [{ id: 'id', type: 'text' }, { id: 'remove', type: 'boolean' }], default: [{ id: 'row', remove: false }] }] })[0]!;
  assert.deepEqual(canvasBlockBooleanValue(input, 'row', 'remove', true), [{ id: 'row', remove: true }]);
  assert.equal(canvasBlockBooleanValue(input, 'stale', 'remove', true), undefined);
  assert.equal(canvasBlockBooleanValue(input, 'row', 'unknown', true), undefined);
  assert.deepEqual(input.value, [{ id: 'row', remove: false }]);
});

test('operation comparison reviews only DOCX properties and explicitly limits appearance claims', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const output = openDocxMetadata(bytes, 'file.docx').remove(['core:creator']);
  const pair = await operationComparisonPair(new File([bytes], 'private.docx'), new File([Uint8Array.from(output).buffer], 'copy.docx'), host);
  assert.equal(pair.mode, 'json'); if (pair.mode !== 'json') throw new Error('Expected property review');
  assert.equal(pair.request.before.content.kind, 'structure');
  assert.equal(pair.request.before.fidelity?.level, 'partial');
  assert(pair.request.before.fidelity!.limitations.some(l => l.includes('Visible content')));
  assert(!JSON.stringify(pair.request.before.identity).includes('private.docx'));
  const core = readZipMembers(bytes).find(m => m.name === 'word/document.xml')!;
  const changed = new TextDecoder().decode(decodeZipMember(core)).replace('<w:body>', '<w:body><w:fldSimple w:instr="AUTHOR"/>');
  const part = readZipMembers(storeZip([{ name: core.name, bytes: new TextEncoder().encode(changed) }]))[0]!;
  const guarded = storeZipMembers(readZipMembers(bytes).map(m => m.name === core.name ? part : m));
  await assert.rejects(operationComparisonPair(new File([Uint8Array.from(guarded).buffer], 'private.docx'), new File([Uint8Array.from(output).buffer], 'copy.docx'), host), /inspect-only/);
});

test('Strip Data extended choices remove one property and retire stale source selections', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const runtime = await createRuntime(tool, host, { source: fileRef('private-extended.docx', extendedBytes) });
  const inspection = await host.prepare.inspect([{ id: 'office', name: 'private-extended.docx', bytes: extendedBytes }]);
  const company = inspection.findings.find(f => f.propertyId === 'app:Company')!, manager = inspection.findings.find(f => f.propertyId === 'app:Manager')!;
  assert(company && manager); assert.notEqual(company.groupId, manager.groupId);
  const rows = runtime.getModel().find(item => item.id === 'properties')!.value as { id: string; remove: boolean }[];
  await runtime.setInput('properties', rows.map(row => ({ ...row, remove: row.id.endsWith(`:${company.groupId}`) })));
  const copy = await runtime.exportFile() as { bytes: Uint8Array; filename: string };
  assert.equal(copy.filename, 'private-extended-prepared.docx');
  const after = openDocxMetadata(copy.bytes, 'copy.docx'); assert(!after.properties.some(p => p.id === 'app:Company'));
  assert.equal(after.properties.find(p => p.id === 'app:Manager')?.value, 'Private fixture manager');
  await runtime.setInput('source', fileRef('another.docx', copy.bytes));
  assert((runtime.getModel().find(item => item.id === 'properties')!.value as { remove: boolean }[]).every(row => !row.remove));
  await runtime.setInput('properties', rows.map(row => ({ ...row, remove: row.id.endsWith(`:${manager.groupId}`) })));
  await assert.rejects(runtime.exportFile(), /Select document properties/);
  assert.deepEqual(host.inspect.logs, []); assert.equal(host.inspect.state.size, 0);
});

test('extended Prepare values stay concealed until reveal and operation comparison preserves identities', async () => {
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const inspection = await host.prepare.inspect([{ id: 'doc', name: 'private-extended.docx', bytes: extendedBytes }]);
  const dom = new JSDOM('<main></main>'), previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const root = document.querySelector<HTMLElement>('main')!; renderPreparationReview(root, inspection);
    assert(root.textContent!.includes('Company')); assert(root.textContent!.includes('Manager'));
    assert.doesNotMatch(root.textContent!, /Private fixture company|Private fixture manager/);
    for (const control of root.querySelectorAll<HTMLButtonElement>('[data-reveal]')) control.click();
    assert(root.textContent!.includes('Private fixture company')); assert(root.textContent!.includes('Private fixture manager'));
  } finally { dom.window.close(); if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); }
  const output = openDocxMetadata(extendedBytes, 'file.docx').remove(['app:Company', 'app:Manager']);
  const pair = await operationComparisonPair(new File([extendedBytes], 'private-extended.docx'), new File([Uint8Array.from(output).buffer], 'copy.docx'), host);
  assert.equal(pair.mode, 'json'); if (pair.mode !== 'json') throw new Error('Expected property review');
  const result = compareSources(pair.request);
  assert.equal(result.summary.removed, 2); assert.equal(result.summary.changed, 0);
  assert.deepEqual(result.changes.map(change => change.before?.path[0]).sort(), ['app:Company', 'app:Manager']);
  assert.equal(result.appearance, 'not-compared'); assert.equal(result.completeness, 'partial');
  assert.doesNotMatch(JSON.stringify(result.before), /private-extended/);
});

test('property comparison discloses capped previews without claiming equality for a changed tail', async () => {
  const company = (tail: string): Uint8Array => {
    const members = readZipMembers(extendedBytes);
    const app = members.find(member => member.name === 'docProps/app.xml')!;
    const xml = new TextDecoder().decode(decodeZipMember(app)).replace('Private fixture company', 'x'.repeat(2048) + tail);
    const replacement = readZipMembers(storeZip([{ name: app.name, bytes: new TextEncoder().encode(xml) }]))[0]!;
    return storeZipMembers(members.map(member => member.name === app.name ? replacement : member));
  };
  const host = createMockHost();
  host.prepare = createPrepareAPI();
  const before = company('first private tail');
  const after = company('second private tail');
  const pair = await operationComparisonPair(new File([Uint8Array.from(before).buffer], 'before.docx'), new File([Uint8Array.from(after).buffer], 'after.docx'), host);
  assert.equal(pair.mode, 'json');
  if (pair.mode !== 'json') throw new Error('Expected property review');
  const result = compareSources(pair.request);
  assert.equal(result.byteEquality, 'different');
  assert.equal(result.equality, 'undetermined');
  assert.equal(result.completeness, 'partial');
  assert.equal(result.summary.total, 0);
  assert.ok(result.limitations.some(message => message.includes('2048 characters') && message.includes('unavailable')));
});
