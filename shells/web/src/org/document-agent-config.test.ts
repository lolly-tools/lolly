// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentConnection, agentInviteState, orgAgentInvitesEnabled, setAgentInviteAvailability } from './document-agent-config.ts';
test('agent invitation controls require a member and the exact advertised route', () => {
  setAgentInviteAvailability(true, '/api/workspace/mcp'); assert.equal(orgAgentInvitesEnabled(), true);
  setAgentInviteAvailability(false, '/api/workspace/mcp'); assert.equal(orgAgentInvitesEnabled(), false);
  setAgentInviteAvailability(true, 'https://foreign.test/mcp'); assert.equal(orgAgentInvitesEnabled(), false);
  setAgentInviteAvailability(true, null); assert.equal(orgAgentInvitesEnabled(), false);
});
test('agent configuration carries only the expected workspace endpoint and scoped key', () => {
  const endpoint = 'https://lolly.ing/api/workspace/mcp', secret = `lwa_${'a'.repeat(43)}`;
  const parsed = JSON.parse(agentConnection(endpoint, secret, endpoint));
  assert.equal(parsed.mcpServers.lolly_document.headers.Authorization, `Bearer ${secret}`);
  assert.equal(parsed.mcpServers.lolly_document.url, endpoint);
  assert.throws(() => agentConnection('https://elsewhere.test/mcp', secret, endpoint));
  assert.throws(() => agentConnection(endpoint, 'unscoped-token', endpoint));
});
test('agent invite state gives revocation and expiry precedence over a stale connected indicator', () => {
  const agent = { expiresAt: '2026-10-06T00:00:00Z', connected: true };
  const now = Date.parse('2026-10-05T00:00:00Z');
  assert.equal(agentInviteState(agent, now), 'connected');
  assert.equal(agentInviteState({ ...agent, connected: false }, now), 'ready');
  assert.equal(agentInviteState({ ...agent, expiresAt: 'bad' }, now), 'expired');
  assert.equal(agentInviteState({ ...agent, revokedAt: '2026-10-04T00:00:00Z' }, now), 'revoked');
});
