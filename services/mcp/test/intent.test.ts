// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_resolve_intent` (plan 350 W4) driven through dispatch() as a transport would: its
 * place in tools/list, schemas that compile, a real resolution over the catalog, the prompt
 * flow an agent follows, and stable codes on refusal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Ajv from 'ajv/dist/2020.js';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { INTENT_TOOL_CODES, RESOLVE_INTENT_OUTPUT_SCHEMA } from '../src/intent.ts';

const ajv = new (Ajv as unknown as new (opts: object) => { compile(schema: object): ((data: unknown) => boolean) & { errors?: unknown } })({ allErrors: true, strict: false });
const validateOutput = ajv.compile(RESOLVE_INTENT_OUTPUT_SCHEMA as object);

interface Result {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
  structuredContent: Record<string, any>;
}

let nextId = 41_000;
async function resolve(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_resolve_intent', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `protocol error: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assert.ok(validateOutput(result.structuredContent), JSON.stringify(validateOutput.errors));
  return result;
}

test('tools/list carries lolly_resolve_intent after lolly_inspect_tokens, and says how an agent uses a prompt', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; description: string; inputSchema: object; outputSchema?: object }> }).tools;
  const names = tools.map((tool) => tool.name);
  assert.equal(names.indexOf('lolly_resolve_intent'), names.indexOf('lolly_inspect_tokens') + 1);
  const tool = tools.find((one) => one.name === 'lolly_resolve_intent')!;
  assert.doesNotThrow(() => ajv.compile(tool.inputSchema));
  assert.doesNotThrow(() => ajv.compile(tool.outputSchema as object));
  assert.match(tool.description, /first words/);
  assert.match(tool.description, /choose the `purpose`/);
  assert.match(tool.description, /intent\.purpose-needed/);
  assert.match(JSON.stringify(tool.inputSchema), /first words/);
  assert.deepEqual(INTENT_TOOL_CODES, ['request.invalid', 'intent.invalid', 'output.too-large', 'internal']);
});

test('a purpose and a surface resolve to a ready tool with its input values, over the real catalog', async () => {
  const result = await resolve({ intent: {
    version: 1, purpose: 'direct', surfaces: [{ id: 'social-square' }], content: { url: 'https://example.com' },
  } });
  assert.equal(result.isError, undefined);
  const body = result.structuredContent;
  assert.equal(body.outcome, 'ready');
  assert.equal(body.surfaces[0].chosen.toolId, 'qr-code');
  assert.equal(body.surfaces[0].chosen.inputs.url, 'https://example.com');
  assert.match(result.content[0]!.text!, /social-square ready \(qr-code\)/);
  assert.deepEqual(JSON.parse(result.content[1]!.text!), body);
});

test('a prompt with no purpose is handed back to the agent with the choices, and is never read', async () => {
  const prompt = 'Make a certificate for Sam, please. Purpose: promote.';
  const result = await resolve({ intent: { version: 1, prompt } });
  assert.equal(result.isError, undefined, 'a step in the flow, not an error');
  const body = result.structuredContent;
  assert.equal(body.outcome, 'purpose-needed');
  assert.equal(body.closed.purpose, null, 'the word "promote" in the prompt decided nothing');
  assert.equal(body.prompt, prompt);
  assert.equal(body.purposeNeeded.code, 'intent.purpose-needed');
  assert.ok(body.purposeNeeded.purposes.some((p: { purpose: string; tools: string[] }) => p.purpose === 'recognise' && p.tools.includes('certificate')));
  assert.ok(body.purposeNeeded.tools.length > 0);
  assert.match(result.content[0]!.text!, /^intent\.purpose-needed: /);
});

test('the agent calls again with the purpose it chose, and the prompt travels unread', async () => {
  const prompt = 'Make a certificate for Sam';
  const body = (await resolve({ intent: {
    version: 1, prompt, purpose: 'recognise', surfaces: [{ id: 'a4-landscape' }],
    content: { firstname: 'Sam', awardtopic: 'Rust' },
  } })).structuredContent;
  assert.equal(body.surfaces[0].chosen.toolId, 'certificate');
  assert.equal(body.prompt, prompt);
  assert.equal(body.recordPrompt, false);
  assert.equal(JSON.stringify(body.closed).includes(prompt), false);
});

test('a refused request carries a stable code and the call never throws', async () => {
  for (const [args, code] of [
    [{}, 'request.invalid'],
    [{ intent: {}, extra: 1 }, 'request.invalid'],
    [{ intent: { version: 1 } }, 'intent.invalid'],
    [{ intent: { version: 1, prompt: 'x'.repeat(2001) } }, 'intent.invalid'],
    [{ intent: { version: 1, purpose: 'nope', surfaces: [{ id: 'slide' }] } }, 'intent.invalid'],
  ] as const) {
    const result = await resolve(args as Record<string, unknown>);
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent.error.code, code);
  }
});
