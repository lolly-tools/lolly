// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly_inspect_tokens` (plan 286 M5) driven through dispatch() as a transport would:
 * the server's own design system by default, a supplied document with explicit theme
 * choices, a token's trace in both directions, every structured result valid against
 * the tool's own outputSchema, and the refusals with their codes. The report is the
 * same `tokenReport` the TUI inspector shows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { TOKEN_EXT } from '@lolly/engine';
import { readProfileTokenDocument } from '@lolly-tools/node-shell/design-brief';
import { tokenReport, tokenRevision } from '@lolly-tools/node-shell/token-report';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { STRUCTURED_LIMITS } from '../src/structured.ts';
import { TOKEN_INSPECT_OUTPUT_SCHEMA, TOKEN_INSPECT_TOOL_CODES, callInspectTokens } from '../src/token-inspect.ts';

const BEACON = JSON.parse(readFileSync(new URL('../../../shells/web/public/examples/beacon.tokens.json', import.meta.url), 'utf8')) as Record<string, unknown>;

const ajv = new Ajv({ allErrors: true, strict: false });
const validateOutput = ajv.compile(TOKEN_INSPECT_OUTPUT_SCHEMA);

interface Result { content: Array<{ type: string; text?: string }>; structuredContent: Record<string, unknown>; isError?: boolean }
interface Report {
  context: { origin: Record<string, unknown>; revision: string; selection: { choices: Record<string, string>; sets: string[]; defaults: string[] }; stored: Record<string, string>; preview: boolean };
  counts: { tokens: number; diagnostics: number };
  diagnostics: Array<{ code: string; message: string }>;
  list: { total: number; rows: Array<{ path: string; resolved?: unknown }> };
  trace?: { path: string; resolved: unknown; source: { set: string } | null; references: Array<{ path: string; depth: number; via: string }>; dependents: Array<{ path: string; depth: number }> };
}

function assertValid(result: Result): void {
  assert.ok(validateOutput(result.structuredContent), `structuredContent does not match the outputSchema: ${ajv.errorsText(validateOutput.errors)}`);
  if (!result.isError) assert.deepEqual(JSON.parse(result.content[1]?.text ?? ''), result.structuredContent);
}

let nextId = 31_200;
async function inspect(args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lolly_inspect_tokens', arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `lolly_inspect_tokens errored at the protocol level: ${JSON.stringify(res?.error)}`);
  const result = res.result as Result;
  assertValid(result);
  return result;
}

function refusedWith(result: Result, code: string, re?: RegExp): void {
  assert.equal(result.isError, true, `expected ${code}, got success`);
  assert.equal((result.structuredContent.error as { code: string }).code, code, result.content[0]?.text ?? '');
  if (re) assert.match(result.content[0]?.text ?? '', re);
}

const report = (result: Result): Report => {
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  return result.structuredContent as unknown as Report;
};

test('tools/list carries lolly_inspect_tokens after lolly_compose, with schemas that compile', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; outputSchema?: unknown; inputSchema: object }> }).tools;
  const names = tools.map((tool) => tool.name);
  assert.equal(names.indexOf('lolly_inspect_tokens'), names.indexOf('lolly_compose') + 1);
  const tool = tools.find((one) => one.name === 'lolly_inspect_tokens')!;
  assert.deepEqual(tool.outputSchema, TOKEN_INSPECT_OUTPUT_SCHEMA);
  assert.doesNotThrow(() => ajv.compile(tool.inputSchema));
  assert.deepEqual(TOKEN_INSPECT_TOOL_CODES, ['request.invalid', 'tokens.unavailable', 'tokens.unreadable', 'token.unknown', 'output.too-large', 'internal']);
});

test('with no tokens the tool reads the server profile, as lolly://design-context does', async () => {
  const profile = readProfileTokenDocument();
  assert.ok(profile, 'a public checkout resolves the lolly-start profile');
  const result = await inspect({});
  const r = report(result);
  assert.deepEqual(r.context.origin, { kind: 'profile', id: profile.profile, label: profile.label, tokensAsset: profile.tokensAsset });
  assert.equal(r.context.revision, tokenRevision(profile.doc));
  assert.equal(r.context.preview, false);
  assert.match(result.content[0]?.text ?? '', new RegExp(`^Inspected ${r.counts.tokens} tokens in .+ \\(content profile ${profile.profile}\\)`));
});

test('a supplied document with explicit choices matches the shared report the TUI shows', async () => {
  const selection = { appearance: 'night', density: 'roomy' };
  const result = await inspect({ tokens: BEACON, selection, token: 'border.exampleOutline' });
  const r = report(result);
  assert.deepEqual(r.context.origin, { kind: 'supplied' });
  assert.deepEqual(r.context.selection.choices, selection);
  assert.deepEqual(r.context.selection.sets, ['foundation', 'night', 'roomy']);
  assert.deepEqual(r.context.stored, { appearance: 'day', density: 'compact' });
  assert.equal(r.context.preview, true);
  assert.deepEqual(r.trace!.resolved, { color: '#b5a0ff', width: { value: 4, unit: 'px' }, style: 'dotted' });
  assert.equal(r.trace!.source!.set, 'night');
  assert.deepEqual(r.trace!.references.map((s) => s.path), ['color.semantic.primary', 'stroke.exampleWidth']);
  assert.match(result.content[0]?.text ?? '', /a preview; the stored choices differ/);
  assert.match(result.content[0]?.text ?? '', /border\.exampleOutline reads 2 tokens and is read by 0 tokens\./);
  const shared = tokenReport(BEACON, { origin: { kind: 'supplied' }, selection, token: 'border.exampleOutline' });
  assert.deepEqual(JSON.parse(JSON.stringify(shared)), r);
});

test('a primitive traces to its dependents, the list filters and pages, and an unknown choice is reported', async () => {
  const primitive = report(await inspect({ tokens: BEACON, token: 'identity.Beacon', depth: 1 }));
  assert.deepEqual(primitive.trace!.dependents.map((s) => [s.path, s.depth]), [['color.semantic.primary', 1]]);
  const page = report(await inspect({ tokens: BEACON, query: 'semantic', limit: 2, offset: 1 }));
  assert.equal(page.list.total, 3);
  assert.deepEqual(page.list.rows.map((row) => row.path), ['color.semantic.surface', 'color.semantic.foreground']);
  const dusk = report(await inspect({ tokens: BEACON, selection: { appearance: 'dusk' } }));
  assert.equal(dusk.context.selection.choices.appearance, 'day');
  assert.deepEqual(dusk.diagnostics.map((d) => d.message), ['Unknown choice dusk in appearance.']);
  const legacy = report(await inspect({ tokens: BEACON, theme: 'Night' }));
  assert.equal(legacy.context.selection.choices.appearance, 'night');
});

test('a lolly-design-context file is read as its token document', async () => {
  const wrapped = report(await inspect({ tokens: { format: 'lolly-design-context', version: 1, tokens: BEACON }, token: 'font.brand' }));
  assert.equal(wrapped.context.revision, tokenRevision(BEACON));
  assert.equal(wrapped.trace!.resolved, 'SUSE');
});

test('declared roles and a missing role target come back as declarations and a diagnostic, not as usage', async () => {
  const tokens = { identity: { Beacon: { $type: 'color', $value: '#7c3aed' } }, $extensions: { [TOKEN_EXT]: { brandSystem: {
    schemaVersion: 1, id: 'custom-brand', label: 'Custom brand',
    roles: [{ id: 'signal', label: 'Beacon', resources: [{ type: 'token', path: 'identity.Beacon' }] }, { id: 'absent', label: 'Absent', resources: [{ type: 'token', path: 'missing' }] }],
    bindings: [{ id: 'headline-accent', roleId: 'signal', consumer: { slot: 'accent' } }], rules: [],
  } } } };
  const r = report(await inspect({ tokens, token: 'identity.Beacon' })) as Report & { trace: { declaredConsumers: unknown[] } };
  assert.deepEqual(r.trace.declaredConsumers, [{ roleId: 'signal', label: 'Beacon', bindings: [{ id: 'headline-accent', slot: 'accent' }] }]);
  assert.deepEqual(r.trace!.dependents, []);
  assert.deepEqual(r.diagnostics.map((d) => d.code), ['missing']);
});

test('refusals carry their codes', async () => {
  refusedWith(await inspect({ tokens: BEACON, token: 'primary' }), 'token.unknown', /Similar paths: color\.semantic\.primary/);
  refusedWith(await inspect({ tokens: BEACON, theme: 'Night', selection: { appearance: 'night' } }), 'request.invalid', /theme or selection, not both/);
  refusedWith(await inspect({ tokens: BEACON, depth: 3 }), 'request.invalid', /pass it with token/);
  refusedWith(await inspect({ tokens: BEACON, token: 'font.brand', depth: 40 }), 'request.invalid');
  refusedWith(await inspect({ tokens: BEACON, limit: 0 }), 'request.invalid');
  refusedWith(await inspect({ tokens: BEACON, selection: { appearance: 7 } }), 'request.invalid');
  refusedWith(await inspect({ tokens: BEACON, colour: 'red' }), 'request.invalid', /not colour/);
  refusedWith(await inspect({ tokens: [1, 2] }), 'tokens.unreadable');
  // Deeper than the importer reads: refused before any inspection runs.
  let deep: Record<string, unknown> = { $value: '#000000' };
  for (let i = 0; i < 70; i++) deep = { [`g${i}`]: deep };
  refusedWith(await inspect({ tokens: deep }), 'tokens.unreadable', /levels/);
});

test('a hosted answer over the response limit is refused as output.too-large', async () => {
  const hosted = { VERCEL: '1' };
  const result = (await callInspectTokens({ tokens: BEACON }, hosted, { ...STRUCTURED_LIMITS, responseMaxBytes: 500 })) as Result;
  assertValid(result);
  refusedWith(result, 'output.too-large', /smaller limit/);
});
