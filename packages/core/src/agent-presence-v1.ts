// SPDX-License-Identifier: MPL-2.0
/** An agent's ephemeral presence, delegated by the connected person's device. */
export interface AgentChangeTarget {
  id: string;
  kind: 'added' | 'changed' | 'removed';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AgentChange {
  id: string;
  label: string;
  width: number;
  height: number;
  targets: AgentChangeTarget[];
}

export interface AgentPresence {
  id: string;
  name: string;
  colorIndex: number;
  phase: 'idle' | 'working' | 'paused';
  activity?: string;
  change?: AgentChange;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const number = (value: unknown, min = -1e6, max = 1e6): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const text = (value: unknown, max: number): string => typeof value === 'string' ? Array.from(value.slice(0, max), ch => {
  const code = ch.codePointAt(0)!;
  return code < 32 || (code >= 127 && code <= 159) || code === 8232 || code === 8233 ? ' ' : ch;
}).join('').trim().slice(0, max) : '';

/** Bounded display data only. Agent identity remains scoped to the frame's sender. */
export function readAgentPresence(raw: unknown): AgentPresence[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const agents: AgentPresence[] = [];
  for (const value of raw.slice(0, 4)) {
    if (!object(value)) continue;
    const id = text(value.id, 128), name = text(value.name, 60);
    if (!id || !name || seen.has(id) || !['idle', 'working', 'paused'].includes(String(value.phase))) continue;
    seen.add(id);
    const agent: AgentPresence = { id, name, phase: value.phase as AgentPresence['phase'], colorIndex: Number.isInteger(value.colorIndex) && number(value.colorIndex, 0, 31) ? value.colorIndex : 0 };
    const activity = text(value.activity, 80);
    if (activity) agent.activity = activity;
    const change = value.change;
    if (object(change) && text(change.id, 128) && number(change.width, 1) && number(change.height, 1) && Array.isArray(change.targets)) {
      const targets: AgentChangeTarget[] = [];
      // Keep four agents within the existing presence lane's string budget.
      let targetCharacters = 512;
      for (const target of change.targets.slice(0, 50)) {
        if (!object(target) || !text(target.id, 256) || !['added', 'changed', 'removed'].includes(String(target.kind)) || !number(target.x) || !number(target.y) || !number(target.w, 0) || !number(target.h, 0)) continue;
        const id = text(target.id, 256), kind = target.kind as AgentChangeTarget['kind'];
        const characters = id.length + kind.length;
        if (characters > targetCharacters) continue;
        targetCharacters -= characters;
        targets.push({ id, kind, x: target.x, y: target.y, w: target.w, h: target.h });
      }
      agent.change = { id: text(change.id, 128), label: text(change.label, 80), width: change.width, height: change.height, targets };
    }
    agents.push(agent);
  }
  return agents;
}
