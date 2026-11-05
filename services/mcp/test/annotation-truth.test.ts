// SPDX-License-Identifier: MPL-2.0
// Annotation truth: a tool that can create a file handle, change a live document
// or write output must never be advertised as read-only.
//
// The idea comes from the MCP tests in storytold designcraft; no code is copied.
//
// Decision recorded here: creating a PRIVATE HANDLE COUNTS AS A WRITE. A handle
// stores bytes on the server, takes quota and outlives the call, so the call
// changes the environment even though no person's document moves. That is what
// readOnlyHint promises not to do. The same goes for a five-minute download
// link, which is a new retrievable object, and for any tool that renders or
// converts to output bytes. Joining or leaving a session changes who is in the
// document, so connect and disconnect are writes too.
//
// Every advertised tool must be classified below, so adding a tool forces a
// decision about its label instead of inheriting one by accident.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from '../src/server.ts';

type Effect = 'read' | 'writes-handle' | 'changes-document' | 'writes-output' | 'changes-session';

const EFFECTS: Readonly<Record<string, Effect>> = {
  // Pure reads of the catalogue, a document, or a status.
  lolly_validate: 'read',
  lolly_diff: 'read',
  lolly_list_tools: 'read',
  lolly_describe_tool: 'read',
  lolly_build_url: 'read',
  lolly_verify: 'read',
  lolly_compile: 'read',
  lolly_inspect: 'read',
  lolly_measure: 'read',
  lolly_check: 'read',
  lolly_compose: 'read',
  lolly_inspect_tokens: 'read',
  lolly_measure_text: 'read',
  lolly_resolve_intent: 'read',
  lolly_look: 'read',
  lolly_sample_color: 'read',
  lolly_trace_edges: 'read',
  lolly_read: 'read',
  files_list: 'read',
  files_report: 'read',
  lolly_live_status: 'read',
  lolly_live_document: 'read',
  lolly_live_find: 'read',
  lolly_live_context: 'read',
  // Returns an inline picture of the document; nothing is stored or exported.
  lolly_live_look: 'read',
  // Output bytes, and with a result store a retrievable link.
  lolly_render: 'writes-output',
  lolly_transform: 'writes-output',
  lolly_redact: 'writes-output',
  lolly_package: 'writes-output',
  lolly_rebrand: 'writes-output',
  // Private file handles.
  files_import: 'writes-handle',
  files_convert: 'writes-handle',
  files_delete: 'writes-handle',
  files_download: 'writes-handle',
  // The live document.
  lolly_live_apply: 'changes-document',
  lolly_live_undo: 'changes-document',
  // The session itself.
  lolly_live_connect: 'changes-session',
  lolly_live_disconnect: 'changes-session',
};

interface Advertised { name: string; annotations?: { readOnlyHint?: boolean } }

async function advertised(): Promise<Map<string, Advertised>> {
  const contexts = [{}, { fileScope: 'scope' }, { liveOnly: true }, { invitedLive: true }];
  const all = new Map<string, Advertised>();
  for (const context of contexts) {
    const listed = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, context);
    for (const tool of (listed!.result as { tools: Advertised[] }).tools) all.set(tool.name, tool);
  }
  return all;
}

test('every advertised tool has a recorded effect, so a new tool forces a label decision', async () => {
  const names = [...(await advertised()).keys()].sort();
  const unclassified = names.filter(name => !Object.hasOwn(EFFECTS, name));
  assert.deepEqual(unclassified, [], 'classify these in EFFECTS, then check their annotations');
  const stale = Object.keys(EFFECTS).filter(name => !names.includes(name));
  assert.deepEqual(stale, [], 'EFFECTS names a tool that is no longer advertised');
});

test('no tool that writes a handle, a document, a session or output is advertised read-only', async () => {
  for (const [name, tool] of await advertised()) {
    if (EFFECTS[name] === 'read') continue;
    assert.notEqual(tool.annotations?.readOnlyHint, true, `${name} (${EFFECTS[name]}) must not carry readOnlyHint: true`);
  }
});

test('a tool advertised read-only really is a read', async () => {
  for (const [name, tool] of await advertised()) {
    if (tool.annotations?.readOnlyHint === true) assert.equal(EFFECTS[name], 'read', `${name} claims read-only but is recorded as ${EFFECTS[name]}`);
  }
});

test('the invited connector labels every read tool read-only and nothing else', async () => {
  const { AGENT_TOOLS } = await import('../src/agent-connector.ts');
  for (const tool of AGENT_TOOLS) {
    assert.equal(tool.annotations.readOnlyHint, EFFECTS[tool.name] === 'read', tool.name);
  }
});
