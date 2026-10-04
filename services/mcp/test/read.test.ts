// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_read` (plan 291 W2) driven through dispatch() as a transport would: the
 * synthetic notes.pptx fixture comes back as the same content inventory
 * `lolly read --json` writes, every structured result validates against the tool's
 * own outputSchema, the inventory validates against
 * schemas/content-inventory-v1.schema.json, and the speaker notes keep their
 * paragraphs and line breaks apart. The hosted caps (request, response, slides) and
 * the inline/resource split run through `callRead` with the limits lowered, so a
 * small fixture reaches them.
 *
 * Counts are never pinned: where a number is compared, it is read from the same
 * reader the tool runs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { readContentInventory } from '@lolly-tools/node-shell/content-inventory';
import type { ContentInventoryV1 } from '@lolly-tools/core';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { READ_LIMITS, READ_OUTPUT_SCHEMA, READ_TOOL_CODES, callRead } from '../src/read.ts';
import { CHECK_OUTPUT_SCHEMA } from '../src/check.ts';

const FIXTURES = new URL('../../../tests/fixtures/rebrand/', import.meta.url);
const notes = new Uint8Array(readFileSync(new URL('notes.pptx', FIXTURES)));
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');
const inventorySchema = JSON.parse(readFileSync(new URL('../../../schemas/content-inventory-v1.schema.json', import.meta.url), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(READ_OUTPUT_SCHEMA);
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
const validateInventory = new (Ajv2020 as unknown as new (o: unknown) => { compile: (s: unknown) => Validator })({ allErrors: true, strict: false }).compile(inventorySchema);

interface Block { type: string; text?: string; resource?: { uri: string; mimeType?: string; text?: string; blob?: string } }
interface Result { content: Block[]; structuredContent: Record<string, unknown>; isError?: boolean }

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  // The structured JSON also travels as text, for a client that reads no structuredContent.
  if (!result.isError) assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
}

let nextId = 29_100;
async function read(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_read', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_read errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

function refusedWith(result: Result, code: string): void {
  assertValid(result);
  assert.equal(result.isError, true, `expected ${code}, got success`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
  assert.ok(result.content[0]?.text?.startsWith(`${code}: `));
}

test('tools/list carries lolly_read and lolly_check with output schemas that compile', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; outputSchema?: unknown; inputSchema: { required?: string[] } }> }).tools;
  const names = tools.map((tool) => tool.name);
  assert.ok(names.indexOf('lolly_read') === names.indexOf('lolly_rebrand') + 1, 'lolly_read follows lolly_rebrand');
  assert.ok(names.indexOf('lolly_check') === names.indexOf('lolly_read') + 1, 'lolly_check follows lolly_read');
  for (const name of ['lolly_read', 'lolly_check']) {
    const tool = tools.find((one) => one.name === name)!;
    assert.equal((tool.outputSchema as { type?: string }).type, 'object');
    assert.doesNotThrow(() => ajv.compile(tool.outputSchema as object), name);
    assert.doesNotThrow(() => ajv.compile(tool.inputSchema as object), name);
  }
  assert.deepEqual(tools.find((one) => one.name === 'lolly_read')!.inputSchema.required, ['file']);
  assert.deepEqual(tools.find((one) => one.name === 'lolly_check')!.outputSchema, CHECK_OUTPUT_SCHEMA);
});

test('a deck reads as the inventory lolly read writes, with notes paragraphs and line breaks kept apart', async () => {
  const result = await read({ file: { base64: b64(notes), name: 'notes.pptx' } });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const s = result.structuredContent;
  assert.deepEqual(s.inventoryDelivery, { mode: 'inline', bytes: Buffer.byteLength(JSON.stringify(s.inventory)) });
  const inventory = s.inventory as ContentInventoryV1;
  assert.ok(validateInventory(inventory), JSON.stringify(validateInventory.errors, null, 2));

  // The same reader as the CLI: the inventory is the one readContentInventory returns.
  const direct = (await readContentInventory({ bytes: notes, name: 'notes.pptx' })).inventory;
  assert.deepEqual(inventory, direct);
  assert.deepEqual(s.source, direct.source);
  assert.equal(s.ocr, false);

  const counts = s.counts as Record<string, number>;
  assert.equal(counts.slides, direct.slides.length);
  assert.equal(counts.notes, direct.slides.filter((slide) => slide.notes).length);
  assert.equal(counts.media, direct.media.length);
  assert.ok(direct.slides.some((slide) => slide.notes === null), 'a slide with no notes reads as null');
  const lines = direct.slides.flatMap((slide) => slide.notes?.paragraphs ?? []).map((p) => p.lines.length);
  assert.ok(lines.some((n) => n > 1), 'a line break stays a second line of the same paragraph');
  assert.ok(direct.slides.some((slide) => (slide.notes?.paragraphs.length ?? 0) > 1), 'a second paragraph stays a paragraph');

  // Facts only by default: no picture bytes, no uri.
  assert.equal(result.content.length, 2);
  for (const row of s.media as Array<Record<string, unknown>>) assert.equal(row.uri, undefined);
  assert.match(result.content[0]!.text!, new RegExp(`^notes\\.pptx: ${direct.slides.length} slides`));
});

test('media: "inline" attaches each distinct picture once, at the uri its media row gives', async () => {
  const result = await read({ file: { base64: b64(notes), name: 'notes.pptx' }, media: 'inline' });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const rows = result.structuredContent.media as Array<{ sha256: string; mime: string; uri: string }>;
  assert.ok(rows.length > 0);
  const blobs = result.content.filter((block) => block.type === 'resource');
  assert.equal(blobs.length, rows.length);
  for (const row of rows) {
    const block = blobs.find((one) => one.resource?.uri === row.uri);
    assert.ok(block?.resource?.blob, `a resource for ${row.uri}`);
    assert.match(row.uri, /^lolly:\/\/read\/[0-9a-f]{12}\/media\/[0-9a-f]{64}\.[a-z]+$/);
    assert.equal(block.resource.mimeType, row.mime);
    assert.equal(createHash('sha256').update(Buffer.from(block.resource.blob, 'base64')).digest('hex'), row.sha256);
  }
});

test('an inventory over the inline limit travels as an embedded JSON resource', async () => {
  const result = (await callRead({ file: { base64: b64(notes), name: 'notes.pptx' } }, {}, { ...READ_LIMITS, inlineBytes: 64 })) as Result;
  assertValid(result);
  const delivery = result.structuredContent.inventoryDelivery as { mode: string; uri: string; bytes: number };
  assert.equal(delivery.mode, 'resource');
  assert.equal(result.structuredContent.inventory, undefined);
  const block = result.content.find((one) => one.resource?.uri === delivery.uri);
  assert.ok(block?.resource?.text);
  assert.equal(block.resource.mimeType, 'application/json');
  assert.equal(Buffer.byteLength(block.resource.text), delivery.bytes);
  assert.ok(validateInventory(JSON.parse(block.resource.text)));
  assert.match(delivery.uri, /^lolly:\/\/read\/[0-9a-f]{12}\/notes\.inventory\.json$/);
});

test('hosted caps: the request, the response and the slides are refused with their codes', async () => {
  const file = { base64: b64(notes), name: 'notes.pptx' };
  const hosted = { VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' };
  // A request too small for the file: refused before decoding.
  refusedWith((await callRead({ file }, hosted, { ...READ_LIMITS, bodyMaxBytes: 20_000 })) as Result, 'source.too-large');
  // A response too large for the platform: refused in words, not cut off.
  refusedWith((await callRead({ file, media: 'inline' }, hosted, { ...READ_LIMITS, responseMaxBytes: 2_000 })) as Result, 'output.too-large');
  // More slides than a hosted call reads, counted from the zip directory before the read.
  const slides = (await read({ file })).structuredContent.counts as { slides: number };
  refusedWith((await callRead({ file }, hosted, { ...READ_LIMITS, hostedMaxSlides: slides.slides - 1 })) as Result, 'source.too-large');
  // The same deck reads on a local server with the hosted cap lowered.
  assert.ok(!((await callRead({ file }, {}, { ...READ_LIMITS, hostedMaxSlides: 1 })) as Result).isError);
});

test('requests it cannot read are refused with a stable code, and the call never throws', async () => {
  refusedWith(await read({}), 'source.missing');
  refusedWith(await read({ file: { base64: '' } }), 'source.missing');
  refusedWith(await read({ file: { base64: 'not*base64!' } }), 'request.invalid');
  refusedWith(await read({ file: { base64: b64(notes) }, media: 'thumbnails' }), 'request.invalid');
  refusedWith((await callRead({ file: { base64: b64(notes) }, slide: 1 })) as Result, 'request.invalid');
  refusedWith(await read({ file: { base64: b64(new TextEncoder().encode('not a deck at all')), name: 'deck.pptx' } }), 'source.unreadable');
  for (const code of ['source.missing', 'source.too-large', 'source.unreadable', 'request.invalid', 'output.too-large', 'internal'])
    assert.ok(READ_TOOL_CODES.includes(code as never), code);
});

const EDITABLE_PDF = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/rebrand-pdf/editable.pdf', import.meta.url)));

test('a deck sent without a name is named for what its bytes are', async () => {
  const pdf = await read({ file: { base64: b64(EDITABLE_PDF) } });
  const source = pdf.structuredContent.source as { name: string; kind: string };
  assert.deepEqual([source.name, source.kind], ['deck.pdf', 'pdf']);
  assert.match(pdf.content[0]?.text ?? '', /^deck\.pdf: /);
  const pptx = await read({ file: { base64: b64(notes) } });
  assert.equal((pptx.structuredContent.source as { name: string }).name, 'deck.pptx');
});

test('a hosted server counts a PDF\'s pages before reading it', async () => {
  const hosted = { VERCEL: '1', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' };
  const refused = (await callRead({ file: { base64: b64(EDITABLE_PDF), name: 'editable.pdf' } }, hosted, { ...READ_LIMITS, hostedMaxSlides: 2 })) as Result;
  refusedWith(refused, 'source.too-large');
  assert.match(refused.content[0]?.text ?? '', /3 slides/);
});
