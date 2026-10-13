// SPDX-License-Identifier: MPL-2.0
import { readLiveRelay } from '@lolly-tools/core/live-invite-v1';
import type { ToolSkillV1 } from '@lolly-tools/core/tool-skill-v1';
export interface AgentGuidanceHost {
  documentId: string;
  toolId: string;
  toolVersion: string;
  facts: string;
  active(): boolean;
  skill(): Promise<ToolSkillV1>;
}
export interface AgentInvitationHost {
  canEdit(): boolean;
  create(permission: 'edit' | 'read', agentName?: string): Promise<{ instructions: string; expiresAt: number }>;
  revoke(): void;
}
const hosts = new WeakMap<object, AgentInvitationHost>();
const guidanceHosts = new WeakMap<object, AgentGuidanceHost>();
export const agentInvitationHost = (runtime: object): AgentInvitationHost | undefined => hosts.get(runtime);
export const agentGuidanceHost = (runtime: object): AgentGuidanceHost | undefined => guidanceHosts.get(runtime);
export function setAgentGuidanceHost(runtime: object, host: AgentGuidanceHost): () => void {
  guidanceHosts.set(runtime, host);
  return () => { if (guidanceHosts.get(runtime) === host) guidanceHosts.delete(runtime); };
}
export function setAgentInvitationHost(runtime: object, host: AgentInvitationHost): () => void {
  hosts.set(runtime, host);
  return () => { if (hosts.get(runtime) === host) hosts.delete(runtime); };
}

export function agentRelayBase(): string | null {
  const value = import.meta.env?.VITE_LIVE_RELAY || (import.meta.env?.DEV ? '/live' : '');
  return readLiveRelay(value, window.location.href);
}
