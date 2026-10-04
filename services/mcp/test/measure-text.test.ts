// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_measure_text` (plan 291 W5) driven through dispatch() as a transport would:
 * a synthetic headline comes back as the same TextMeasureV1 `lolly measure --text
 * --json` writes, a document's plain text layers come back as `{ layers, skipped }`,
 * every structured result validates against the tool's own outputSchema, and the
 * refusals carry their codes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { measureTextNode } from '@lolly-tools/node-shell/text-measure';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { MEASURE_TEXT_MAX_LAYERS, MEASURE_TEXT_MAX_UNITS, MEASURE_TEXT_OUTPUT_SCHEMA, MEASURE_TEXT_TOOL_CODES, callMeasureText } from '../src/measure-text.ts';

const TRAP = JSON.parse(readFileSync(new URL('../../../tests/fixtures/check/trap.boxes.json', import.meta.url), 'utf8')) as Array<Record<string, unknown>>;
const HEADLINE = 'Every quarter we measure what our customers keep using, and why they stay';

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(MEASURE_TEXT_OUTPUT_SCHEMA);

interface Result { content: Array<{ type: string; text?: string }>; structuredContent: Record<string, unknown>; isError?: boolean }

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  if (!result.isError) assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
}

let nextId = 29_500;
async function measure(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_measure_text', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_measure_text errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

function refusedWith(result: Result, code: string, re?: RegExp): void {
  assert.equal(result.isError, true, `expected ${code}, got success`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
  if (re) assert.match(result.content[0]?.text ?? '', re);
}

test('tools/list carries lolly_measure_text right after lolly_check, with schemas that compile', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; outputSchema?: unknown; inputSchema: object }> }).tools;
  const names = tools.map((tool) => tool.name);
  assert.equal(names.indexOf('lolly_measure_text'), names.indexOf('lolly_check') + 1);
  const tool = tools.find((one) => one.name === 'lolly_measure_text')!;
  assert.deepEqual(tool.outputSchema, MEASURE_TEXT_OUTPUT_SCHEMA);
  assert.doesNotThrow(() => ajv.compile(tool.inputSchema));
  assert.deepEqual(MEASURE_TEXT_TOOL_CODES, ['request.invalid', 'font.unavailable', 'output.too-large', 'internal']);
});

test('a text box measures as lolly measure --text does', async () => {
  const args = { text: HEADLINE, font: 'sans', weight: 500, fontSize: 72, width: 900, lineHeight: 1.12, pad: 0 };
  const result = await measure(args);
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const s = result.structuredContent;
  const direct = await measureTextNode({ text: HEADLINE, font: 'sans', weight: '500', size: 72, width: 900, lineHeight: 1.12, pad: 0, valign: 'middle' });
  assert.deepEqual(s.lines, direct.lines);
  assert.equal(s.height, 241.875);
  assert.equal(s.scrollHeight, 246);
  assert.equal(result.content[0]?.text, '3 lines, 241.88 px tall, scrollHeight 246.');
  const boxed = await measure({ ...args, height: 200 });
  assert.match(boxed.content[0]?.text ?? '', /clipped by 46 px/);
  const styled = await measure({ text: 'A synthetic title', width: 1200, style: 'title' });
  assert.equal((styled.structuredContent as { pad: number }).pad, 0, 'a style sets the box up as an authored row');
});

test('a document measures every plain text layer, or the ones named', async () => {
  const result = await measure({ document: { boxes: TRAP } });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const layers = result.structuredContent.layers as Array<{ layerId: string; measure: { overflow?: { clipped: boolean } } }>;
  assert.equal(layers.length, 11);
  assert.equal(layers.find((l) => l.layerId === 'overflow')!.measure.overflow!.clipped, true);
  assert.equal(result.content[0]?.text, 'Measured 11 plain text layers: 1 clipped (overflow).');
  const named = await measure({ document: TRAP, layerIds: ['heading'] });
  assert.deepEqual((named.structuredContent.layers as Array<{ layerId: string }>).map((l) => l.layerId), ['heading']);
  refusedWith(await measure({ document: TRAP, layerIds: ['photo'] }), 'request.invalid', /not text/);
});

test('refusals carry a code and the call never throws', async () => {
  refusedWith(await measure({ text: 'x' }), 'request.invalid', /width is required/);
  refusedWith(await measure({ width: 100 }), 'request.invalid', /text is required/);
  refusedWith(await measure({ text: 'x', width: -5 }), 'request.invalid', /width must be a positive number/);
  refusedWith(await measure({ text: 'x', width: 100, valign: 'centre' }), 'request.invalid', /valign/);
  refusedWith(await measure({ document: TRAP, width: 100 }), 'request.invalid', /width describes one text box/);
  refusedWith(await measure({ document: { rows: [] } }), 'request.invalid', /Design document/);
  refusedWith(await measure({ text: 'x', width: 100, font: 'Nowhere Sans' }), 'font.unavailable', /Nowhere Sans/);
  refusedWith(await measure({ text: 'x', width: 100, style: 'nope' }), 'request.invalid', /does not exist/);
  const direct = await callMeasureText({ text: 'x', width: 100, colour: 'red' });
  assertValid(direct as Result);
  refusedWith(direct as Result, 'request.invalid', /not colour/);
});

test('a document over the layer or text cap is refused before anything is measured', async () => {
  const long = 'Synthetic words that wrap across a narrow box many times over. '.repeat(10);
  const many = Array.from({ length: MEASURE_TEXT_MAX_LAYERS + 1 }, (_, i) => ({ id: `t${i}`, kind: 'text', x: 0, y: 0, w: 120, h: 40, text: long }));
  let started = performance.now();
  refusedWith(await measure({ document: many }), 'request.invalid', /2001 text layers to measure; this tool measures up to 2000/);
  assert.ok(performance.now() - started < 5000, 'refused without measuring 2001 layers');
  const heavy = Array.from({ length: 5 }, (_, i) => ({ id: `w${i}`, kind: 'text', x: 0, y: 0, w: 60, h: 40, text: 'a'.repeat(60000) }));
  started = performance.now();
  refusedWith(await measure({ document: heavy }), 'request.invalid', new RegExp(`hold 300000 characters; this tool measures up to ${MEASURE_TEXT_MAX_UNITS}`));
  assert.ok(performance.now() - started < 5000, 'refused without measuring 300000 characters');
  // Named layers count alone, so the same document measures one of them.
  const one = await measure({ document: heavy.map((r) => ({ ...r, text: 'short' })), layerIds: ['w1'] });
  assert.ok(!one.isError, one.content[0]?.text ?? '');
});

test('a layer index is its place in boxes, rows that are not objects included', async () => {
  const result = await measure({ document: [{ id: 'f1', kind: 'frame', x: 0, y: 0, w: 800, h: 600 }, 'junk', { id: 't1', kind: 'text', text: 'x', x: 0, y: 0, w: 100, h: 60 }] });
  assert.deepEqual((result.structuredContent.layers as Array<{ layerId: string; index: number }>).map((l) => [l.layerId, l.index]), [['t1', 2]]);
});

test('a style is sized for artboardWidth (default 1920), and the result says so', async () => {
  const at1280 = await measure({ text: 'Quarterly review of the platform', width: 600, style: 'title', artboardWidth: 1280 });
  const at1920 = await measure({ text: 'Quarterly review of the platform', width: 600, style: 'title' });
  const size = (r: Result) => (r.structuredContent as { size: number }).size;
  assert.ok(size(at1280) < size(at1920), `${size(at1280)} at 1280 against ${size(at1920)} at 1920`);
  assert.equal(size(at1280), Math.round((size(at1920) * 1280) / 1920));
  assert.ok((at1920.structuredContent.notes as string[]).some((n) => /artboard 1920 px wide \(the default/.test(n)));
  refusedWith(await measure({ text: 'x', width: 100, artboardWidth: 1280 }), 'request.invalid', /artboardWidth sizes a style/);
});
