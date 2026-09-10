// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { inspectPreparation, applyPreparation, preparationRecipe, readPreparationRecipe } from '../engine/src/prepare.ts';
import { piiFindings } from '../engine/src/prepare-pii.ts';
import { storeZip, readZip, readZipMembers, storeZipMembers } from '../engine/src/zip.ts';
const enc = new TextEncoder(), dec = new TextDecoder();
const source = (text: string, name = 'input.txt', id = 'file0') => ({ id, name, bytes: enc.encode(text) });
const all = (i: Awaited<ReturnType<typeof inspectPreparation>>) => i.groups.map(g => ({ groupId: g.id, replacement: '[REMOVED]' }));
test('one mapping applies consistently across text and JSON; untouched JSON bytes retain precision', async () => {
  const inputs = [source('email: someone@example.test'), source('{"email":"someone@example.test", "integer":9007199254740993}', 'input.json', 'file1')];
  const i = await inspectPreparation(inputs);
  const email = i.groups.find(g => g.value === 'someone@example.test')!;
  assert.equal(email.count, 2);
  const r = await applyPreparation(inputs, i, [{ groupId: email.id, replacement: 'person-1' }]);
  assert.equal(dec.decode(r.outputs[1]!.bytes), '{"email":"person-1", "integer":9007199254740993}');
  assert.equal(r.report.replaced, 2);
  assert(!JSON.stringify(r.report).includes('someone'));
  assert(!JSON.stringify(r.report).includes('input.json'));
});
test('HAR inspects URLs, headers, arbitrary cookie names, body JSON and base64 response text', async () => {
  const har = { log: { entries: [{ request: { url: 'https://example.test/?token=query%20secret', headers: [{ name: 'Authorization', value: 'Bearer headersecret' }], cookies: [{ name: 'foo', value: 'cookiesecret' }], postData: { text: '{"password":"bodysecret"}' } }, response: { content: { encoding: 'base64', text: btoa('{"password":"responsesecret"}') } } }] } };
  const files = [source(JSON.stringify(har), 'request.har')], i = await inspectPreparation(files);
  for (const v of ['query secret', 'headersecret', 'cookiesecret', 'bodysecret', 'responsesecret']) assert(i.groups.some(g => g.value === v), v);
  const r = await applyPreparation(files, i, all(i));
  const out = JSON.parse(dec.decode(r.outputs[0]!.bytes));
  assert(!JSON.stringify(out).includes('bodysecret'));
  assert(!atob(out.log.entries[0].response.content.text).includes('responsesecret'));
});
test('YAML preserves comments, anchors, unrelated formatting and block semantics', async () => {
  const files = [source('password: &p hunter22\ncopy: *p\ncount: 9007199254740993\nnote: |\n  mail someone@example.test\n# password=commentsecret\nurl: "https://example.test/#fragment" # password=tailsecret\n', 'config.yaml')];
  const i = await inspectPreparation(files);
  assert(i.groups.some(g => g.value === 'hunter22'));
  assert(i.groups.some(g => g.value === 'commentsecret'));
  assert(i.groups.some(g => g.value === 'tailsecret'));
  const r = await applyPreparation(files, i, all(i));
  const out = dec.decode(r.outputs[0]!.bytes);
  assert(out.includes('copy: *p')); assert(out.includes('9007199254740993')); assert(!out.includes('someone@'));
  assert.equal(r.inspection.scopes[0]!.status, 'partial');
});
test('keep all is byte-identical, individual occurrences and manual missed values remain editable', async () => {
  const files = [source('Project Acorn\nsomeone@example.test\nsomeone@example.test')];
  const rules = [{ id: 'project', label: 'Project', kind: 'literal' as const, value: 'Project Acorn' }];
  const i = await inspectPreparation(files, rules);
  const unchanged = await applyPreparation(files, i, []);
  assert.deepEqual(unchanged.outputs[0]!.bytes, files[0]!.bytes);
  const email = i.groups.find(g => g.value.includes('@'))!;
  const r = await applyPreparation(files, i, [{ groupId: email.id, replacement: 'one', findings: [i.findings.find(f => f.groupId === email.id)!.id] }]);
  assert.equal(dec.decode(r.outputs[0]!.bytes), 'Project Acorn\none\nsomeone@example.test');
});
test('stale bytes and edited findings are rejected without mutating input', async () => {
  const files = [source('password=oldsecret')], i = await inspectPreparation(files);
  await assert.rejects(applyPreparation([source('password=newsecret')], i, all(i)), /changed/);
  i.findings[0]!.value = 'tampered';
  await assert.rejects(applyPreparation(files, i, all(i)), /changed/);
  assert.equal(dec.decode(files[0]!.bytes), 'password=oldsecret');
});
test('nested ZIP maps are consistent; encrypted and unsupported members survive exact compressed bytes', async () => {
  const inner = storeZip([{ name: 'data.txt', bytes: enc.encode('password=sameSecret') }]);
  const raw = readZipMembers(storeZip([{ name: 'encrypted.bin', bytes: enc.encode('opaque private bytes') }]));
  raw[0]!.flags |= 1; new DataView(raw[0]!.local.buffer, raw[0]!.local.byteOffset).setUint16(6, raw[0]!.flags, true); new DataView(raw[0]!.central.buffer, raw[0]!.central.byteOffset).setUint16(8, raw[0]!.flags, true);
  const mixed = storeZipMembers([...readZipMembers(storeZip([{ name: 'data.txt', bytes: enc.encode('password=sameSecret') }, { name: 'nested.zip', bytes: inner }])), ...raw]);
  const files = [{ id: 'file0', name: 'bundle.zip', bytes: mixed }], i = await inspectPreparation(files);
  assert.equal(i.groups.find(g => g.value === 'sameSecret')!.count, 2);
  assert(i.scopes.some(s => s.status === 'uninspected' && s.path.endsWith('encrypted.bin')));
  const r = await applyPreparation(files, i, all(i));
  const members = readZipMembers(r.outputs[0]!.bytes);
  assert.deepEqual(members[2]!.compressed, raw[0]!.compressed);
  assert.equal(new Set(i.scopes.map(s => s.path)).size, i.scopes.length);
  const removed = await applyPreparation(files, i, [], [i.scopes.find(s => s.path.endsWith('encrypted.bin'))!.id]);
  assert.equal(readZip(removed.outputs[0]!.bytes).length, 2);
});
test('unsupported binary, corrupt structure and size limits are explicit and preserve originals', async () => {
  for (const file of [source('{ invalid', 'bad.json'), source('opaque', 'file.pdf'), source('a'.repeat(1024 * 1024 + 1))]) {
    const i = await inspectPreparation([file]); assert.equal(i.scopes[0]!.status, 'uninspected');
    assert.deepEqual((await applyPreparation([file], i, [])).outputs[0]!.bytes, file.bytes);
  }
});
test('recipes omit private literals and arbitrary extra payloads', () => {
  const r = preparationRecipe(['credential'], [{ id: 'literal', label: 'secret', kind: 'literal', value: 'mysecret' }, { id: 'field', label: 'field', kind: 'field', value: 'account' }]);
  assert.deepEqual(r, { version: 1, categories: ['credential'], fields: ['account'] });
  assert.deepEqual(readPreparationRecipe({ ...r, payload: 'mysecret' }), r);
  assert.throws(() => readPreparationRecipe({ version: 1, categories: [], fields: ['a'.repeat(300)] }));
});
test('cancellation returns no transformed output and leaves originals available', async () => {
  const controller = new AbortController(), files = [source('password=secret')];
  controller.abort(); await assert.rejects(inspectPreparation(files, [], { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(dec.decode(files[0]!.bytes), 'password=secret');
});
test('personal-data suggestions retain parity with Redact canonical helper', async () => {
  const context: Record<string, unknown> = {};
  runInNewContext(await readFile(new URL('../community/_shared/pii.js', import.meta.url), 'utf8'), context);
  const input = 'Jane Smith: jane@example.com, +1 (202) 555-0123, 4111 1111 1111 1111, 15/03/1980';
  assert.deepEqual(JSON.parse(JSON.stringify(piiFindings(input))), JSON.parse(JSON.stringify((context.piiFindings as (s: string) => unknown)(input))));
});
test('global archive budget bounds nested members and retains uninspected branches', async () => {
  const archive = storeZip(Array.from({ length: 200 }, (_, i) => ({ name: `${i}.txt`, bytes: enc.encode('password=secret') })));
  const bytes = storeZip([{ name: 'first.zip', bytes: archive }, { name: 'second.zip', bytes: archive }]);
  const files = [{ id: 'f', name: 'root.zip', bytes }], i = await inspectPreparation(files);
  assert(i.scopes.length <= 300);
  assert(i.scopes.some(s => s.path.endsWith('second.zip') && s.status === 'uninspected'));
  const r = await applyPreparation(files, i, all(i));
  assert.deepEqual(readZip(r.outputs[0]!.bytes)[1]!.bytes, archive);
});
test('metadata adapter removes real SVG metadata, reports exact hashes and keeps failed siblings', async () => {
  const { applyPreparationMetadata } = await import('../engine/src/prepare-metadata.ts');
  const files = [source('<svg xmlns="http://www.w3.org/2000/svg"><metadata>private author</metadata><rect width="2" height="2"/></svg>', 'drawing.svg'), source('broken', 'broken.pdf', 'file1')];
  const i = await inspectPreparation(files), base = await applyPreparation(files, i, []);
  const r = await applyPreparationMetadata(base, files.map(s => s.id));
  assert(!dec.decode(r.outputs[0]!.bytes).includes('private author'));
  assert.deepEqual(r.outputs[1]!.bytes, files[1]!.bytes);
  assert.equal(r.report.stages?.[0]?.status, 'completed'); assert.equal(r.report.stages?.[1]?.status, 'failed');
  assert(!JSON.stringify(r.report).includes('private author'));
  assert.equal(r.report.outputs[0]!.sha256, r.report.stages?.[0]?.outputSha256);
  assert.equal(r.report.sources[0]!.sha256, i.sources[0]!.sha256);
  assert.deepEqual(base.outputs[0]!.bytes, files[0]!.bytes);
});
test('encoded query identifiers and exact literals are mapped without network lookups', async () => {
  const files = [source('https://example.test/?email=person%40example.test&project=Project%20Acorn')];
  const i = await inspectPreparation(files, [{ id: 'project', label: 'Project', kind: 'literal', value: 'Project Acorn' }]);
  assert(i.groups.some(g => g.value === 'person@example.test')); assert(i.groups.some(g => g.value === 'Project Acorn'));
  const r = await applyPreparation(files, i, all(i)); assert(!dec.decode(r.outputs[0]!.bytes).includes('Acorn'));
});
test('archive reports track retained member identities after removal, including ambiguous display paths', async () => {
  const inner = storeZip([{ name: 'config.txt', bytes: enc.encode('password=nested') }]);
  const files = [{ id: 'f', name: 'root.zip', bytes: storeZip([{ name: 'remove.txt', bytes: enc.encode('password=removed') }, { name: 'nested.zip/config.txt', bytes: enc.encode('password=direct') }, { name: 'nested.zip', bytes: inner }]) }];
  const i = await inspectPreparation(files);
  const g = i.groups.find(g => g.value === 'direct')!;
  const r = await applyPreparation(files, i, [{ groupId: g.id, replacement: '' }], ['f:m0']);
  assert.equal(r.report.scopes.find(s => s.id === 'f:m1')!.remaining, 0);
  assert.equal(r.report.scopes.find(s => s.id === 'f:m2:m0')!.remaining, 1);
});
test('near-limit structured input is bounded and retains unvisited values', async () => {
  const text = JSON.stringify(Array.from({ length: 22000 }, (_, i) => ({ harmless: `value${i}` })));
  const i = await inspectPreparation([source(text, 'many.json')]);
  assert.equal(i.scopes[0]!.status, 'partial'); assert(i.scopes[0]!.limitations.length > 0);
});
test('a failed structured rewrite retains that source while other files complete', async () => {
  const files = [source('{"one@example.test":1,"two@example.test":2}', 'keys.json'), source('password=secret', 'plain.txt', 'file1')];
  const i = await inspectPreparation(files);
  const r = await applyPreparation(files, i, i.groups.map(g => ({ groupId: g.id, replacement: 'same' })));
  assert.deepEqual(r.outputs[0]!.bytes, files[0]!.bytes); assert.equal(dec.decode(r.outputs[1]!.bytes), 'password=same');
  assert.equal(r.report.stages?.[0]?.status, 'failed'); assert.equal(r.report.replaced, 1);
});
test('unsupported ZIP compression survives alongside rewritten text', async () => {
  const raw = readZipMembers(storeZip([{ name: 'opaque.bin', bytes: enc.encode('uninspectable') }]));
  raw[0]!.method = 99;
  new DataView(raw[0]!.local.buffer, raw[0]!.local.byteOffset).setUint16(8, 99, true);
  new DataView(raw[0]!.central.buffer, raw[0]!.central.byteOffset).setUint16(10, 99, true);
  const files = [{ id: 'f', name: 'mixed.zip', bytes: storeZipMembers([...readZipMembers(storeZip([{ name: 'secret.txt', bytes: enc.encode('password=known') }])), ...raw]) }];
  const i = await inspectPreparation(files); assert.equal(i.scopes.find(s => s.path.endsWith('opaque.bin'))!.status, 'uninspected');
  const result = await applyPreparation(files, i, all(i));
  assert.deepEqual(readZipMembers(result.outputs[0]!.bytes)[1]!.local, raw[0]!.local);
});
test('an unknown file extension cannot leak a private filename through a summary format field', async () => {
  const sources = [{ id: 'f', name: 'bundle.PrivateClientName', bytes: new Uint8Array([0, 1, 2]) }];
  const result = await applyPreparation(sources, await inspectPreparation(sources), []);
  assert.equal(result.report.scopes[0]!.format, 'unknown'); assert(!JSON.stringify(result.report).toLowerCase().includes('privateclientname'));
});
test('Node Buffer views hash only their bytes and inspection snapshots mutable inputs', async () => {
  const { preparationDigest } = await import('../engine/src/prepare.ts');
  const backing = Buffer.from('prefixpassword=originalsuffix'), bytes = backing.subarray(6, 23);
  assert.equal(await preparationDigest(bytes), await preparationDigest(Uint8Array.from(bytes)));
  const pending = inspectPreparation([{ id: 'f', name: 'file.txt', bytes }]);
  bytes.fill(120);
  assert((await pending).groups.some(g => g.value === 'original'));
});
test('ZIP reframing does not mutate Node Buffer-backed source headers', () => {
  const input = Buffer.from(storeZip([{ name: 'first', bytes: enc.encode('one') }, { name: 'second', bytes: enc.encode('two') }]));
  const original = Buffer.from(input), members = readZipMembers(input);
  const output = storeZipMembers([members[1]!]);
  assert.deepEqual(input, original);
  assert.equal(readZip(output)[0]!.name, 'second');
});
