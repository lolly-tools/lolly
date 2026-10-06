// SPDX-License-Identifier: MPL-2.0
import type { AgentPresence } from '@lolly-tools/core/agent-presence-v1';
import { readAgentPresence } from '@lolly-tools/core/agent-presence-v1';
import type { CollabParticipant, CollabSessionState } from './collab-session.ts';
import type { PresencePeer } from './collab-presence.ts';
import { collabPalette } from './collab-colors.ts';
import { t } from '../i18n.ts';

interface Source {
  state(): CollabSessionState;
  subscribe(fn: (state: CollabSessionState) => void): () => void;
}
export interface AgentControls { disconnect(): void; pause(paused: boolean): void }
export interface AgentRoster extends Source {
  hasPeople(): boolean;
  local(): readonly AgentPresence[];
  subscribeLocal(fn: (agents: readonly AgentPresence[]) => void): () => void;
  attach(source: Source, presence: () => readonly PresencePeer[]): () => void;
  join(name: string, controls: AgentControls): { id: string; update(patch: Partial<AgentPresence>): void; remove(): void };
  disconnect(id: string): void;
  pause(id: string): void;
}

const rosters = new WeakMap<HTMLElement, AgentRoster>();

/** One roster per stage. Local agents and the transport's people share this source. */
export function agentRosterFor(stage: HTMLElement): AgentRoster {
  const found = rosters.get(stage);
  if (found) return found;
  const colors = collabPalette().map(color => color.hex);
  const agents = new Map<string, { presence: AgentPresence; controls: AgentControls }>();
  const listeners = new Set<(state: CollabSessionState) => void>();
  const localListeners = new Set<(agents: readonly AgentPresence[]) => void>();
  let people: Source | null = null;
  let remotePresence: () => readonly PresencePeer[] = () => [];
  let offPeople: (() => void) | undefined;
  const selfId = `editor:${globalThis.crypto.randomUUID()}`;
  const self: CollabParticipant = { clientId: selfId, userId: selfId, name: '', color: colors[0] ?? '', colorIndex: 0, away: false, isSelf: true, isHost: false, inviteeIndex: 0 };
  const participant = (agent: AgentPresence, parent: CollabParticipant, local: boolean): CollabParticipant => ({
    clientId: local ? agent.id : `${parent.clientId}:agent:${agent.id}`, userId: parent.userId,
    name: agent.name, color: colors[agent.colorIndex % colors.length] ?? parent.color, colorIndex: agent.colorIndex,
    role: parent.role, away: parent.away, isSelf: false, isHost: false, inviteeIndex: 0,
    kind: 'agent', phase: agent.phase, activity: agent.activity, agentChange: agent.change, delegatedBy: parent.clientId,
  });
  const local = (): AgentPresence[] => [...agents.values()].map(agent => agent.presence);
  const state = (): CollabSessionState => {
    const base = people?.state() ?? { connection: agents.size ? 'live' : 'closed', role: 'writer', self: { ...self, name: t('You'), role: 'writer' }, peers: [] } as CollabSessionState;
    const remote = new Map(remotePresence().map(peer => [peer.id, peer]));
    const peers = base.peers.flatMap(parent => [parent, ...readAgentPresence(remote.get(parent.clientId)?.state.agents).map(agent => participant(agent, parent, false))]);
    return { ...base, peers: [...peers, ...local().map(agent => participant(agent, base.self, true))] };
  };
  const notify = (): void => { const snapshot = state(); for (const listener of [...listeners]) listener(snapshot); };
  const changed = (): void => { for (const listener of [...localListeners]) listener(local()); notify(); };
  const roster: AgentRoster = {
    state, local, hasPeople: () => !!people,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    subscribeLocal(fn) { localListeners.add(fn); return () => { localListeners.delete(fn); }; },
    attach(source, presence) {
      offPeople?.(); people = source; remotePresence = presence;
      offPeople = source.subscribe(notify); notify();
      return () => { if (people !== source) return; offPeople?.(); offPeople = undefined; people = null; remotePresence = () => []; notify(); };
    },
    join(name, controls) {
      if (agents.size >= 4) throw new Error('Four agents are already connected to this document.');
      const id = `agent:${globalThis.crypto.randomUUID()}`;
      const taken = new Set([state().self.colorIndex, ...state().peers.map(peer => peer.colorIndex)]);
      let colorIndex = 0;
      while (taken.has(colorIndex) && colorIndex < colors.length - 1) colorIndex++;
      agents.set(id, { presence: { id, name, colorIndex, phase: 'idle' }, controls }); changed();
      return {
        id,
        update(patch) { const agent = agents.get(id); if (!agent) return; const next = readAgentPresence([{ ...agent.presence, ...patch, id }])[0]; if (!next) return; agent.presence = next; changed(); },
        remove() { if (agents.delete(id)) changed(); },
      };
    },
    disconnect(id) { agents.get(id)?.controls.disconnect(); },
    pause(id) { const agent = agents.get(id); if (!agent) return; const paused = agent.presence.phase !== 'paused'; agent.controls.pause(paused); agent.presence = { ...agent.presence, phase: paused ? 'paused' : 'idle' }; changed(); },
  };
  rosters.set(stage, roster);
  return roster;
}
