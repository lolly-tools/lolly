// SPDX-License-Identifier: MPL-2.0
/**
 * penpot-api (plans/178) - the pure RPC client, against a recording stub
 * fetch: URLs, the Token auth header, the proven multipart import-binfile
 * shape, the server-sent-event reply, the narrow result typing, and error
 * propagation. No network, no DOM.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makePenpotClient, PENPOT_PROXY_BASE } from './penpot-api.ts';

/** A recording fetch: every call captured, one canned answer per call - JSON by
 *  default, or `text` verbatim for the import stream. */
function stub(responses: Array<{ status?: number; json?: unknown; text?: string; type?: string }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let i = 0;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const r = responses[Math.min(i++, responses.length - 1)] ?? {};
    return new Response(r.text ?? JSON.stringify(r.json ?? {}), {
      status: r.status ?? 200,
      headers: { 'content-type': r.type ?? (r.text ? 'text/event-stream' : 'application/json') },
    });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

/** The shape design.penpot.app actually answers with (probed 2026-09-02). */
const IMPORT_SSE = [
  'event: progress',
  'data: {"~:section":"~:manifest"}',
  '',
  'event: progress',
  'data: {"~:section":"~:file"}',
  '',
  'event: end',
  'data: ["~u40e06342-8830-80d6-8008-93e8caf41d9f"]',
  '',
].join('\n');

const headers = (init?: RequestInit): Record<string, string> => (init?.headers ?? {}) as Record<string, string>;

test('listProjects: POSTs empty JSON to the proxy with the Token header, narrows to id/name/team', async () => {
  const { calls, fetchImpl } = stub([{
    json: [
      { id: 'p1', name: 'Brand', 'team-id': 't1', 'team-name': 'SUSE', extra: 42 },
      { id: 'p2', name: 'Web', teamId: 't2', teamName: 'Side projects' },
      { id: 'p3', name: 'No team' },
      { id: 123, name: 'malformed - dropped' },
      null,
    ],
  }]);
  const projects = await makePenpotClient({ token: 'pat-1', fetchImpl }).listProjects();
  assert.deepEqual(projects, [
    { id: 'p1', name: 'Brand', teamId: 't1', teamName: 'SUSE' },
    { id: 'p2', name: 'Web', teamId: 't2', teamName: 'Side projects' },
    { id: 'p3', name: 'No team' },
  ]);
  const call = calls[0]!;
  assert.equal(call.url, `${PENPOT_PROXY_BASE}/get-all-projects`);
  assert.equal(call.init?.method, 'POST');
  assert.equal(headers(call.init).Authorization, 'Token pat-1');
  assert.equal(headers(call.init)['Content-Type'], 'application/json');
  assert.equal(String(call.init?.body), '{}');
});

test('a custom base is honoured, trailing slash trimmed', async () => {
  const { calls, fetchImpl } = stub([{ json: [] }]);
  const projects = await makePenpotClient({ base: 'https://pen.example/rpc/', token: 't', fetchImpl }).listProjects();
  assert.deepEqual(projects, []);
  assert.equal(calls[0]!.url, 'https://pen.example/rpc/get-all-projects');
});

test('importFile: multipart with the proven field set, no JSON content type', async () => {
  const { calls, fetchImpl } = stub([{ text: IMPORT_SSE }]);
  const archive = new Blob([new Uint8Array([0x50, 0x4b, 3, 4])], { type: 'application/x-penpot' });
  const out = await makePenpotClient({ token: 'pat-2', fetchImpl }).importFile('Poster', 'p1', archive);
  assert.deepEqual(out.fileIds, ['40e06342-8830-80d6-8008-93e8caf41d9f'], '~u stripped off the end event');
  assert.deepEqual(out.sections, ['manifest', 'file']);

  const call = calls[0]!;
  assert.equal(call.url, `${PENPOT_PROXY_BASE}/import-binfile`);
  assert.equal(call.init?.method, 'POST');
  assert.equal(headers(call.init).Authorization, 'Token pat-2');
  assert.equal(headers(call.init)['Content-Type'], undefined, 'FormData must set its own boundary');
  const form = call.init?.body as FormData;
  assert.ok(form instanceof FormData);
  assert.equal(form.get('project-id'), 'p1');
  assert.equal(form.get('name'), 'Poster');
  assert.equal(form.get('version'), '3', 'binfile v3 - the format the writer emits');
  const file = form.get('file');
  assert.ok(file instanceof Blob);
  assert.equal((file as File).name, 'Poster.penpot');
});

test('importFile: an error event becomes a thrown hint, never a silent success', async () => {
  const sse = [
    'event: progress',
    'data: {"~:section":"~:manifest"}',
    '',
    'event: error',
    'data: {"~:type":"~:validation","~:hint":"inconsistent-penpot-file"}',
    '',
  ].join('\n');
  const { fetchImpl } = stub([{ text: sse }]);
  await assert.rejects(
    () => makePenpotClient({ token: 't', fetchImpl }).importFile('x', 'p1', new Blob([new Uint8Array([1])])),
    /inconsistent-penpot-file/);
});

test('importFile: a stream that confirms nothing is a failure too', async () => {
  const { fetchImpl } = stub([{ text: 'event: progress\ndata: {"~:section":"~:manifest"}\n\n' }]);
  await assert.rejects(
    () => makePenpotClient({ token: 't', fetchImpl }).importFile('x', 'p1', new Blob([new Uint8Array([1])])),
    /did not confirm/);
});

test('errors carry the command and status, and propagate', async () => {
  const { fetchImpl } = stub([{ status: 401 }]);
  await assert.rejects(
    () => makePenpotClient({ token: 'bad', fetchImpl }).listProjects(),
    /get-all-projects failed \(401\)/);

  const rejected = stub([{ status: 401, text: '{"type":"authentication"}', type: 'application/json' }]);
  await assert.rejects(
    () => makePenpotClient({ token: 'bad', fetchImpl: rejected.fetchImpl }).importFile('x', 'p1', new Blob([new Uint8Array([1])])),
    /import-binfile failed \(401\)/);

  const boom = (async () => { throw new Error('socket hangup'); }) as unknown as typeof fetch;
  await assert.rejects(
    () => makePenpotClient({ token: 't', fetchImpl: boom }).listProjects(),
    /socket hangup/);
});
