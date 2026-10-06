// SPDX-License-Identifier: MPL-2.0
import { readLiveRelay } from '@lolly-tools/core/live-invite-v1';
export interface AgentInvitationHost {
  canEdit(): boolean;
  create(permission: 'edit' | 'read'): Promise<{ instructions: string; expiresAt: number }>;
  revoke(): void;
}
const hosts = new WeakMap<object, AgentInvitationHost>();
export const agentInvitationHost = (runtime: object): AgentInvitationHost | undefined => hosts.get(runtime);
export function setAgentInvitationHost(runtime: object, host: AgentInvitationHost): () => void {
  hosts.set(runtime, host);
  return () => { if (hosts.get(runtime) === host) hosts.delete(runtime); };
}

export function agentRelayBase(): string | null {
  const value = import.meta.env?.VITE_LIVE_RELAY || (import.meta.env?.DEV ? '/live' : '');
  return readLiveRelay(value, window.location.href);
}
