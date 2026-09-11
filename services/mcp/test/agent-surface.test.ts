// SPDX-License-Identifier: MPL-2.0
/**
 * The Wave-1 agent surface: lolly_verify, catalog-derived prompts, the
 * lolly://assets listing + per-tool preview resources, and the dxf Tier-A path.
 * Driven through dispatch() like mcp.test.ts. Browser-free throughout.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

let nextId = 1000;
async function rpcRaw(method: string, params?: unknown): Promise<JsonRpcResponse> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method, params })) as JsonRpcResponse;
  assert.ok(res, `no response for ${method}`);
  return res;
}
async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const res = await rpcRaw(method, params);
  assert.ok(!res.error, `${method} errored: ${JSON.stringify(res.error)}`);
  return res.result as Record<string, unknown>;
}

interface ToolResult { content: { type: string; text?: string; mimeType?: string; data?: string }[]; isError?: boolean }
async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const r = (await rpc('tools/call', { name, arguments: args })) as unknown as ToolResult;
  assert.ok(!r.isError, `${name} isError: ${JSON.stringify(r.content)}`);
  return r;
}

test('tools/list includes lolly_verify', async () => {
  const list = await rpc('tools/list');
  const names = (list['tools'] as { name: string }[]).map(t => t.name);
  assert.ok(names.includes('lolly_verify'), 'missing lolly_verify');
});

test('verify round-trip: a C2PA-stamped render reads as made-with-lolly', async () => {
  const rendered = await callTool('lolly_render', {
    toolId: 'qr-code', inputs: { url: 'https://suse.com' }, format: 'png', width: 128, c2pa: '30',
  });
  const img = rendered.content.find(c => c.type === 'image');
  assert.ok(img?.data, 'expected a stamped png image block');

  const r = await callTool('lolly_verify', { file: { base64: img!.data!, name: 'qr.png', mime: 'image/png' } });
  const summary = r.content[0]!.text!;
  assert.match(summary, /Made with Lolly/);
  const json = JSON.parse(r.content[1]!.text!) as { verdict: string; report: { madeWithLolly: boolean; environment?: { surface?: string } | null }; metadata: { format: string } | null };
  assert.equal(json.verdict, 'made-with-lolly');
  assert.equal(json.report.madeWithLolly, true);
  assert.equal(json.report.environment?.surface, 'mcp');
  assert.equal(json.metadata?.format, 'PNG');
});

test('verify with credential-free bytes reads as no-credential', async () => {
  const base64 = Buffer.from('not an asset, just bytes').toString('base64');
  const r = await callTool('lolly_verify', { file: { base64, name: 'plain.txt' } });
  const json = JSON.parse(r.content[1]!.text!) as { verdict: string };
  assert.equal(json.verdict, 'no-credential');
});

test('prompts/list is catalog-derived: generic + featured tools', async () => {
  const list = await rpc('prompts/list');
  const prompts = list['prompts'] as { name: string; arguments?: { name: string; required?: boolean }[] }[];
  const names = prompts.map(p => p.name);
  assert.ok(names.includes('create-branded-asset'), 'missing the generic guided prompt');
  assert.ok(names.includes('qr-code'), 'featured qr-code should yield a prompt');
  const qr = prompts.find(p => p.name === 'qr-code')!;
  assert.ok((qr.arguments ?? []).some(a => a.name === 'url'), 'qr-code prompt should expose its url input');
});

test('prompts/get create-branded-asset carries the brief + workflow + catalog', async () => {
  const r = await rpc('prompts/get', { name: 'create-branded-asset', arguments: { brief: 'a QR poster for the booth' } });
  const messages = r['messages'] as { role: string; content: { type: string; text: string } }[];
  assert.equal(messages[0]!.role, 'user');
  const text = messages[0]!.content.text;
  assert.match(text, /a QR poster for the booth/);
  assert.match(text, /lolly_describe_tool/);
  assert.match(text, /qr-code/); // the live catalog listing
});

test('prompts/get for a tool prompt guides describe → render', async () => {
  const r = await rpc('prompts/get', { name: 'qr-code', arguments: { url: 'https://suse.com' } });
  const text = (r['messages'] as { content: { text: string } }[])[0]!.content.text;
  assert.match(text, /lolly_describe_tool with toolId "qr-code"/);
  assert.match(text, /lolly_render/);
  assert.match(text, /https:\/\/suse\.com/); // provided argument honoured
});

test('prompts/get with an unknown name fails as invalid params', async () => {
  const res = await rpcRaw('prompts/get', { name: 'no-such-prompt-xyz' });
  assert.ok(res.error, 'expected a JSON-RPC error for an unknown prompt');
});

test('lolly://assets lists real catalog asset ids', async () => {
  const list = await rpc('resources/list');
  const uris = (list['resources'] as { uri: string }[]).map(r => r.uri);
  assert.ok(uris.includes('lolly://assets'), 'lolly://assets missing from resources/list');

  const read = await rpc('resources/read', { uri: 'lolly://assets' });
  const content = (read['contents'] as { mimeType?: string; text?: string }[])[0]!;
  assert.equal(content.mimeType, 'application/json');
  const doc = JSON.parse(content.text!) as { count: number; assets: { id: string; type: string; tags: string[] }[] };
  assert.ok(doc.count > 0 && doc.assets.length === doc.count);
  assert.ok(doc.assets.every(a => a.id && a.type && Array.isArray(a.tags)));
});

test('lolly://tool/{id}/preview serves the committed SVG preview', async () => {
  const templates = await rpc('resources/templates/list');
  const uris = (templates['resourceTemplates'] as { uriTemplate: string }[]).map(t => t.uriTemplate);
  assert.ok(uris.includes('lolly://tool/{id}/preview'), 'preview template missing');

  const read = await rpc('resources/read', { uri: 'lolly://tool/qr-code/preview' });
  const content = (read['contents'] as { mimeType?: string; text?: string }[])[0]!;
  assert.equal(content.mimeType, 'image/svg+xml');
  assert.match(content.text!, /<svg/);
});

test('render qr-code to dxf (Tier A, no browser)', async () => {
  const r = await callTool('lolly_render', { toolId: 'qr-code', inputs: { url: 'https://suse.com' }, format: 'dxf' });
  const header = r.content[0]!.text!;
  assert.match(header, /tier A\)/);
  assert.ok(r.content.some(c => c.type === 'resource'), 'expected a dxf resource block');
});
