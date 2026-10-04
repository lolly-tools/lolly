// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_compose` (plan 291 W6) driven through dispatch() as a transport would: its
 * place in tools/list right after lolly_measure_text with schemas that compile, the
 * archetype list, a composed document whose every structured result validates against
 * the tool's own outputSchema, a suggestion for a public deck whose pictures then
 * package from the same source through lolly_package, and the refusals with
 * their codes. The slide text is synthetic and the profile is the public lolly-start.
 */
process.env.LOLLY_PROFILE ??= 'lolly-start';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { STRUCTURED_LIMITS } from '../src/structured.ts';
import { COMPOSE_OUTPUT_SCHEMA, COMPOSE_TOOL_CODES, callCompose } from '../src/compose.ts';

type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator; errorsText: (e: unknown) => string };
const ajv = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false });
const validateOutput = ajv.compile(COMPOSE_OUTPUT_SCHEMA);

const NOTES = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/rebrand/notes.pptx', import.meta.url)));
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

const SPEC = {
  slides: [
    { archetype: 'title', slots: { title: 'Quarterly field notes', subtitle: 'What the team learned this spring' } },
    { archetype: 'content', slots: { title: 'Three things changed', body: '- Orders arrive earlier\n- Returns fell\n- Support moved to chat' } },
  ],
};

interface Result { content: Array<{ type: string; text?: string }>; structuredContent: Record<string, any>; isError?: boolean }

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  if (!result.isError) assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
}

let nextId = 31_500;
async function compose(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_compose', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_compose errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

function refusedWith(result: Result, code: string, re?: RegExp): void {
  assert.equal(result.isError, true, `expected ${code}, got success`);
  assert.equal(result.structuredContent.error.code, code, result.content[0]?.text ?? '');
  if (re) assert.match(result.content[0]?.text ?? '', re);
}

test('tools/list carries lolly_compose right after lolly_measure_text, with schemas that compile', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; outputSchema?: unknown; inputSchema: unknown }> }).tools;
  const names = tools.map((tool) => tool.name);
  assert.equal(names.indexOf('lolly_compose'), names.indexOf('lolly_measure_text') + 1);
  const tool = tools.find((one) => one.name === 'lolly_compose')!;
  assert.doesNotThrow(() => ajv.compile(tool.outputSchema as object));
  assert.doesNotThrow(() => ajv.compile(tool.inputSchema as object));
  assert.deepEqual(COMPOSE_TOOL_CODES, ['request.invalid', 'spec.invalid', 'inventory.invalid', 'source.too-large', 'source.unreadable', 'output.too-large', 'internal']);
});

test('mode list: the profile master\'s archetypes', async () => {
  const result = await compose({ mode: 'list' });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.equal(result.structuredContent.master.id, 'lolly/slides/neutral');
  assert.equal(result.structuredContent.master.origin, 'catalog');
  assert.ok(result.structuredContent.archetypes.some((a: { id: string; dark?: string }) => a.id === 'agenda' && a.dark === 'agenda-dark'));
  assert.match(result.content[0]!.text!, /archetypes on lolly\/slides\/neutral/);
});

test('compose: the document, the report, the edits and the pictures, with dark twins on request', async () => {
  const result = await compose({ spec: SPEC, theme: 'dark', fit: 'shrink' });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const { document, report, edits, assets } = result.structuredContent;
  assert.deepEqual(report.slides.map((s: { archetype: string }) => s.archetype), ['title', 'content-dark']);
  assert.deepEqual(report.size, { width: 1920, height: 1080 });
  assert.equal(document.boxes.filter((b: { kind: string }) => b.kind === 'frame').length, 2);
  assert.deepEqual(edits, []);
  assert.deepEqual(assets, []);
  assert.match(result.content[0]!.text!, /^Composed 2 slides at 1920x1080 on lolly\/slides\/neutral \(catalog\)/);
  const sized = await compose({ spec: SPEC, size: { width: 1280, height: 720 } });
  assert.deepEqual(sized.structuredContent.report.size, { width: 1280, height: 720 });
});

test('compose with the deck: from references and notes read the source', async () => {
  const read = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_read', arguments: { file: { base64: b64(NOTES), name: 'notes.pptx' } } } })) as JsonRpcResponse;
  const inventory = (read.result as Result).structuredContent.inventory;
  const first = inventory.slides[0];
  const heading = first.text[0];
  const spec = { slides: [{ archetype: 'title-only', source: 1, slots: { title: { from: heading.objectId } } }] };
  const viaInventory = await compose({ spec, inventory });
  assert.ok(!viaInventory.isError, viaInventory.content[0]?.text ?? '');
  const title = viaInventory.structuredContent.document.boxes.find((b: { role?: string }) => b.role === 'title');
  assert.ok(String(title.text).includes(heading.plain.split('\n')[0]!.trim()), 'the slot copies the inventory text');
  const viaDeck = await compose({ spec, source: { base64: b64(NOTES), name: 'notes.pptx' } });
  assert.ok(!viaDeck.isError, viaDeck.content[0]?.text ?? '');
  assert.deepEqual(viaDeck.structuredContent.document, viaInventory.structuredContent.document, 'the deck and its inventory compose the same slide');
});

test('mode suggest: a first spec for the deck, one slide per source slide, that composes', async () => {
  const result = await compose({ mode: 'suggest', source: { base64: b64(NOTES), name: 'notes.pptx' } });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const { spec, reasons, master } = result.structuredContent;
  assert.equal(master.origin, 'catalog');
  assert.equal(reasons.length, spec.slides.length);
  assert.ok(spec.slides.every((s: { source?: number }, i: number) => s.source === i + 1));
  const composed = await compose({ spec, source: { base64: b64(NOTES), name: 'notes.pptx' } });
  assert.ok(!composed.isError, composed.content[0]?.text ?? '');
  assert.equal(composed.structuredContent.report.slides.length, spec.slides.length);
});

test('a suggested deck\'s photo:<sha12> pictures package from the same source with lolly_package', async () => {
  const recreate = { base64: b64(new Uint8Array(readFileSync(new URL('../../../tests/fixtures/rebrand/recreate.pptx', import.meta.url)))), name: 'recreate.pptx' };
  const suggested = await compose({ mode: 'suggest', source: recreate });
  assert.ok(!suggested.isError, suggested.content[0]?.text ?? '');
  const composed = await compose({ spec: suggested.structuredContent.spec, source: recreate });
  assert.ok(!composed.isError, composed.content[0]?.text ?? '');
  const keys = (composed.structuredContent.assets as Array<{ key: string }>).map((a) => a.key).sort();
  assert.ok(keys.length >= 1 && keys.every((k) => /^photo:[0-9a-f]{12}$/.test(k)), keys.join(', '));
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_package', arguments: { document: composed.structuredContent.document, source: recreate } } })) as JsonRpcResponse;
  const packed = res.result as Result;
  assert.ok(!packed.isError, packed.content[0]?.text ?? '');
  const media = packed.structuredContent.media as Array<{ origin: string; keys: string[] }>;
  assert.deepEqual(media.flatMap((m) => m.keys).sort(), keys);
  assert.ok(media.every((m) => m.origin === 'source'));
});

test('refusals carry their codes', async () => {
  refusedWith(await compose({ spec: SPEC, colour: 'red' }), 'request.invalid', /not colour/);
  refusedWith(await compose({ mode: 'list', spec: SPEC }), 'request.invalid', /spec does not apply to mode list/);
  refusedWith(await compose({ mode: 'draw' }), 'request.invalid', /mode must be/);
  refusedWith(await compose({}), 'spec.invalid', /spec is required/);
  refusedWith(await compose({ spec: { slides: [{ archetype: 'contnet' }] } }), 'spec.invalid', /\/slides\/0\/archetype/);
  refusedWith(await compose({ spec: SPEC, size: 'wide' }), 'request.invalid', /size is the artboard size/);
  refusedWith(await compose({ spec: SPEC, theme: 'sepia' }), 'request.invalid');
  refusedWith(await compose({ mode: 'suggest' }), 'request.invalid', /suggest reads a deck/);
  refusedWith(await compose({ spec: SPEC, inventory: { version: 'nope' } }), 'inventory.invalid');
  const capped = (await callCompose({ spec: SPEC }, {}, { ...STRUCTURED_LIMITS, localMaxSlides: 1 })) as Result;
  refusedWith(capped, 'request.invalid', /composes up to 1/);
});

test('a hosted call measures within its budget, and the sentence counts the slots it did not measure', async () => {
  const lowered = { ...STRUCTURED_LIMITS, hostedMeasureUnits: 10 };
  const hosted = (await callCompose({ spec: SPEC, fit: 'shrink' }, { VERCEL: '1' }, lowered)) as Result;
  assertValid(hosted);
  assert.ok(!hosted.isError, hosted.content[0]?.text ?? '');
  assert.match(hosted.content[0]!.text!, /4 text slots not measured/);
  assert.doesNotMatch(hosted.content[0]!.text!, /every text slot fits/);
  assert.ok(hosted.structuredContent.report.notes.some((n: { code: string; message: string }) => n.code === 'compose.fit.unmeasured' && /measuring budget of 10 characters/.test(n.message)));
  const local = (await callCompose({ spec: SPEC }, {}, lowered)) as Result;
  assert.ok(!local.isError, local.content[0]?.text ?? '');
  assert.match(local.content[0]!.text!, /every text slot fits/, 'a local server has no measuring budget');
});

test('a slot whose face is not here is counted as not measured, never as fitting', async () => {
  const spec = { slides: [{ archetype: 'content', slots: { title: { text: 'Hello '.repeat(200), font: 'Nope Sans' }, body: { text: 'Body', font: 'Nope Sans' } } }] };
  const result = await compose({ spec });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.equal(result.structuredContent.report.slides[0].fit, undefined);
  assert.match(result.content[0]!.text!, /2 text slots not measured/);
  assert.doesNotMatch(result.content[0]!.text!, /every text slot fits/);
});
