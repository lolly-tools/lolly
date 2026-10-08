// SPDX-License-Identifier: MPL-2.0
import { diffBoxes, type FastPathCfg } from './canvas-scene.ts';
import type { Box } from './free-canvas-math.ts';

/** Small, independent Design text/style/size edits. The renderer proves the full template. */
export function contentPatchPlan(prev: readonly Box[], next: readonly Box[], cfg: FastPathCfg): string[] | null {
  const damage = diffBoxes(prev, next, cfg.field, { frameField: cfg.frameField, groupField: cfg.groupField, kindField: cfg.kindField });
  if (!damage.dirty || damage.added.length || damage.removed.length || damage.zChanged.length || damage.frames.length) return null;
  const changed = [...new Set([...damage.moved, ...damage.restyled])];
  if (!changed.length || changed.length > 20) return null;
  const masks = new Set(next.map(row => String(row[cfg.clipField ?? 'clip'] ?? '')).filter(Boolean));
  const old = new Map(prev.map(row => [String(row[cfg.field.idField] ?? ''), row]));
  if (old.size !== prev.length) return null;
  const ids: string[] = [];
  for (const index of changed) {
    const row = next[index]!, id = String(row[cfg.field.idField] ?? ''), before = old.get(id);
    if (!id || !before || masks.has(id) || cfg.connectorEndpointIds?.has(id)) return null;
    if (![before, row].every(box => ['box', 'text'].includes(String(box[cfg.kindField ?? 'kind'] ?? 'box'))
      && !String(box[cfg.clipField ?? 'clip'] ?? ''))) return null;
    ids.push(id);
  }
  return ids;
}
