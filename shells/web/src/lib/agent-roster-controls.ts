// SPDX-License-Identifier: MPL-2.0
import { mountCollabPill, type CollabPill } from '../components/collab-pill.ts';
import { mountAgentChanges, type AgentChanges } from '../components/agent-changes.ts';
import { agentRosterFor } from './agent-collaborators.ts';

const controls = new WeakMap<HTMLElement, { retain(): () => void }>();

/** Local transports share one control when the document has no human session. */
export function mountAgentRosterControls(stage: HTMLElement, canvas: HTMLElement | null): () => void {
  const existing = controls.get(stage);
  if (existing) return existing.retain();
  const roster = agentRosterFor(stage);
  let pill: CollabPill | null = null, changes: AgentChanges | null = null, references = 0;
  const clear = () => { pill?.destroy(); pill = null; changes?.dispose(); changes = null; };
  const refresh = () => {
    if (roster.hasPeople() || !roster.local().length) { clear(); return; }
    pill ??= mountCollabPill(stage, { source: roster, className: 'collab-pill--stage collab-pill--agent', onDisconnectAgent: id => roster.disconnect(id), onPauseAgent: id => roster.pause(id) });
    if (canvas) changes ??= mountAgentChanges(stage, canvas, roster);
  };
  const off = roster.subscribe(refresh);
  const source = { retain() {
    references++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--references) return;
      off(); clear(); controls.delete(stage);
    };
  } };
  controls.set(stage, source); refresh();
  return source.retain();
}
