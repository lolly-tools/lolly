// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dispatch } from '../src/server.ts';
import { createGateway } from '../src/gateway.ts';
import { PROTOCOL_VERSION, SUPPORTED_VERSIONS, VERSION_META, CAPABILITIES_META, validateHttpHeaders } from '../src/negotiation.ts';
import type { JsonRpcRequest } from '../src/protocol.ts';

const request = (method: string, params: Record<string, unknown> = {}): JsonRpcRequest => ({ jsonrpc: '2.0', id: 0, method, params: { ...params, _meta: { [VERSION_META]: PROTOCOL_VERSION, [CAPABILITIES_META]: {} } } });
const result = async (method: string, params: Record<string, unknown> = {}) => {
  const response = await dispatch(request(method, params));
  assert.ok(response && !response.error, JSON.stringify(response));
  return response.result as Record<string, unknown>;
};

test('stateless discovery and ordinary calls carry modern result metadata', async () => {
  const found = await result('server/discover');
  assert.deepEqual(found.supportedVersions, SUPPORTED_VERSIONS);
  assert.equal(found.resultType, 'complete');
  assert.equal(found.cacheScope, 'private');
  assert.ok(Number(found.ttlMs) >= 0);
  assert.equal((found._meta as Record<string, { name: string }>)['io.modelcontextprotocol/serverInfo']?.name, 'lolly-mcp');
  for (const method of ['tools/list', 'resources/list', 'resources/templates/list', 'prompts/list']) {
    const value = await result(method);
    assert.equal(value.resultType, 'complete'); assert.equal(value.cacheScope, 'private'); assert.equal(typeof value.ttlMs, 'number');
  }
  const value = await result('tools/call', { name: 'lolly_list_tools', arguments: { q: 'qr', limit: 1 } });
  assert.equal(value.resultType, 'complete');
  assert.ok(Array.isArray(value.content));
  const resource = await result('resources/read', { uri: 'lolly://catalog' });
  assert.equal(resource.ttlMs, 0);
});
test('versions and capabilities are validated afresh on each request', async () => {
  const bad = request('tools/list');
  bad.params = { _meta: { [VERSION_META]: '2099-01-01', [CAPABILITIES_META]: {} } };
  const mismatch = await dispatch(bad);
  assert.equal(mismatch?.error?.code, -32022);
  assert.deepEqual(mismatch?.error?.data, { supported: SUPPORTED_VERSIONS, requested: '2099-01-01' });
  await result('tools/list');
  assert.equal((await dispatch({ ...request('tools/list'), params: { _meta: { [VERSION_META]: PROTOCOL_VERSION } } }))?.error?.code, -32602);
  assert.equal((await dispatch(request('ping')))?.error?.code, -32601);
  assert.equal((await dispatch(request('initialize')))?.error?.code, -32601);
  assert.equal((await dispatch(request('resources/read', { uri: 'lolly://missing' })))?.error?.code, -32602);
  assert.equal((await dispatch(request('tools/call', { name: 'not-a-tool' })))?.error?.code, -32602);
  assert.equal((await dispatch(request('resources/read', { uri: 'lolly://files/missing' }), { fileScope: 'test-owner' }))?.error?.code, -32602);
  assert.equal((await dispatch(request('prompts/get', { name: 'design', arguments: { title: 3 } })))?.error?.code, -32602);
});
test('legacy initialization negotiates supported versions without echoing arbitrary input', async () => {
  for (const version of ['2025-06-18', '2025-11-25', '2099-01-01']) {
    const response = await dispatch({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version } });
    const value = response?.result as Record<string, unknown>;
    assert.equal(value.protocolVersion, version === '2099-01-01' ? '2025-11-25' : version);
    assert.equal(value.resultType, undefined);
  }
  assert.equal(await dispatch({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'lolly_render' } }), null);
  for (const bad of [null, [], {}, { jsonrpc: '2.0', id: null, method: 'tools/list' }]) assert.equal((await dispatch(bad as JsonRpcRequest))?.error?.code, -32600);
});
test('HTTP mirrors reject mismatches and decode Unicode names exactly once', () => {
  const req = request('resources/read', { uri: 'lolly://asset/日本語' });
  const headers = { 'mcp-protocol-version': PROTOCOL_VERSION, 'mcp-method': req.method, 'mcp-name': `=?base64?${Buffer.from('lolly://asset/日本語').toString('base64')}?=` };
  assert.equal(validateHttpHeaders(req, headers), null);
  for (const patch of [{ 'mcp-method': 'tools/call' }, { 'mcp-name': 'other' }, { 'mcp-protocol-version': undefined }, { 'mcp-name': '=?base64?%%%?=' }]) assert.equal(validateHttpHeaders(req, { ...headers, ...patch })?.error?.code, -32020);
  for (const uri of [' padded ', '=?base64?literal?=', 'line1\nline2']) {
    assert.equal(validateHttpHeaders(request('resources/read', { uri }), { ...headers, 'mcp-name': `=?base64?${Buffer.from(uri).toString('base64')}?=` }), null);
  }
});
test('real HTTP supports stateless requests, legacy clients and origin refusals', async () => {
  const gateway = createGateway({ LOLLY_MCP_TOKEN: 'test-secret', LOLLY_MCP_PUBLIC_ORIGIN: 'https://mcp.example.test' });
  const server = createServer((req, res) => { void gateway(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/mcp`;
  const post = (body: JsonRpcRequest, extra: Record<string, string> = {}) => fetch(url, { method: 'POST', headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': PROTOCOL_VERSION, 'mcp-method': body.method, ...extra }, body: JSON.stringify(body) });
  try {
    const modern = await post(request('tools/list'));
    assert.equal(modern.status, 200); assert.equal((await modern.json()).result.resultType, 'complete');
    assert.equal(modern.headers.get('mcp-session-id'), null);
    assert.equal((await post(request('tools/list'), { 'mcp-method': 'tools/call' })).status, 400);
    assert.equal((await post(request('unknown'))).status, 404);
    assert.equal((await post(request('tools/list'), { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(request('tools/list'), { origin: 'https://mcp.example.test' })).status, 200);
    assert.equal((await post(request('tools/list'), { 'content-type': 'text/plain' })).status, 415);
    const future = request('tools/list');
    future.params = { _meta: { [VERSION_META]: '2099-01-01', [CAPABILITIES_META]: {} } };
    const unsupported = await post(future, { 'mcp-protocol-version': '2099-01-01' });
    assert.equal(unsupported.status, 400); assert.equal((await unsupported.json()).error.code, -32022);
    assert.equal((await fetch(url)).status, 405);
    const legacy = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer test-secret', 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-06-18' } }) });
    assert.equal((await legacy.json()).result.protocolVersion, '2025-06-18');
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test('stdio drains requests at EOF and keeps diagnostics off stdout', async () => {
  const child = execFile(process.execPath, [fileURLToPath(new URL('../bin/lolly-mcp.ts', import.meta.url))]);
  const output = new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = '', stderr = '';
    child.stdout!.on('data', data => { stdout += data; }); child.stderr!.on('data', data => { stderr += data; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr)));
  });
  child.stdin!.end(JSON.stringify(request('server/discover')) + '\n');
  const out = await output;
  assert.equal(JSON.parse(out.stdout).result.resultType, 'complete');
  assert.match(out.stderr, /ready/);
});
