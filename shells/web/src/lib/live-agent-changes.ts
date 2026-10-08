// SPDX-License-Identifier: MPL-2.0
import type { AgentChange } from '@lolly-tools/core/agent-presence-v1';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Capture admitted changes, including the former location of a deleted layer. */
export function liveAgentChange(before: readonly unknown[], after: readonly unknown[], size: { width: number; height: number }, id: string, label: string): AgentChange {
  const rows = (items: readonly unknown[]) => new Map(items.filter(record).filter(row => typeof row.id === 'string').map((row, index) => [row.id as string, { row, index }]));
  const previous = rows(before), current = rows(after);
  const targets: AgentChange['targets'] = [];
  for (const layerId of new Set([...previous.keys(), ...current.keys()])) {
    const old = previous.get(layerId), next = current.get(layerId);
    if (old && next && JSON.stringify(old.row) === JSON.stringify(next.row)) continue;
    const row = (next ?? old)!.row;
    const value = (key: string): number => typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] : 0;
    targets.push({ id: layerId, kind: !old ? 'added' : !next ? 'removed' : 'changed', x: value('x'), y: value('y'), w: Math.max(0, value('w')), h: Math.max(0, value('h')) });
    if (targets.length === 50) break;
  }
  return { id, label, ...size, targets };
}
