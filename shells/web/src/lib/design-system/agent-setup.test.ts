// SPDX-License-Identifier: MPL-2.0
/** The settings a person pastes: right for each client, and never holding a token. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { clientSetup, PUBLIC_MCP_URL, TOKEN_ENV } from './agent-setup.ts';

test('the public server needs no key in any client', () => {
  for (const client of ['claude', 'cursor', 'vscode'] as const) {
    const { text } = clientSetup(client, 'lolly', PUBLIC_MCP_URL);
    assert.ok(text.includes(PUBLIC_MCP_URL));
    assert.doesNotMatch(text, /Authorization|Bearer/);
  }
});

test('an instance names a variable and never holds a token', () => {
  const url = 'https://work.example.com/api/v1/mcp';
  for (const client of ['claude', 'cursor', 'vscode'] as const) {
    const { text } = clientSetup(client, 'lolly-work', url, TOKEN_ENV);
    assert.ok(text.includes(TOKEN_ENV), client);
    assert.doesNotMatch(text, /lwt_/);
  }
});

test('each client gets the shape it reads', () => {
  assert.match(clientSetup('claude', 'lolly', PUBLIC_MCP_URL).text, /^claude mcp add --transport http lolly https:/);
  const cursor = clientSetup('cursor', 'lolly', PUBLIC_MCP_URL);
  assert.equal(cursor.where, '.cursor/mcp.json');
  assert.deepEqual(JSON.parse(cursor.text), { mcpServers: { lolly: { url: PUBLIC_MCP_URL } } });
  const vscode = clientSetup('vscode', 'lolly', PUBLIC_MCP_URL);
  assert.equal(vscode.where, '.vscode/mcp.json');
  assert.deepEqual(JSON.parse(vscode.text), { servers: { lolly: { type: 'http', url: PUBLIC_MCP_URL } } });
});
