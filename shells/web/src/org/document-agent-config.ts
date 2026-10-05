// SPDX-License-Identifier: MPL-2.0
/** A copied connection delegates one document; the key stays out of device storage. */
let available = false;
export function setAgentInviteAvailability(member: boolean, path: unknown): void { available = member && path === '/api/workspace/mcp'; }
export function orgAgentInvitesEnabled(): boolean { return available; }

export function agentConnection(endpoint: string, secret: string, expectedEndpoint: string): string {
  if (endpoint !== expectedEndpoint || !/^lwa_[A-Za-z0-9_-]{43}$/.test(secret)) throw new Error('Invalid agent connection');
  return JSON.stringify({ mcpServers: { lolly_document: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${secret}` } } } }, null, 2);
}

/** A revoked invitation stays visible as a receipt of the access change. */
export function agentInviteState(agent: { revokedAt?: string; expiresAt: string; connected: boolean }, now = Date.now()): 'revoked' | 'expired' | 'connected' | 'ready' {
  if (agent.revokedAt) return 'revoked';
  if (!Number.isFinite(Date.parse(agent.expiresAt)) || Date.parse(agent.expiresAt) <= now) return 'expired';
  return agent.connected ? 'connected' : 'ready';
}
