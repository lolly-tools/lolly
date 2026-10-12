// SPDX-License-Identifier: MPL-2.0
/** Reorder siblings in their existing document slots, preserving ownership and geometry. */
import { designHierarchyIndex } from '../../../../engine/src/design-hierarchy.ts';
import type { Box } from './free-canvas-math.ts';
import type { DesignPage } from './design-ports.ts';

export function reorderHierarchyChildren(boxes: readonly Box[], ordered: string[], pages?: readonly DesignPage[]): Box[] {
  if (!ordered.length) return boxes.slice();
  const index = designHierarchyIndex(boxes, pages), owner = index.parent.get(ordered[0]!);
  const page = index.pageById.get(ordered[0]!);
  const siblings = boxes.filter(box => index.parent.get(String(box.id)) === owner && index.pageById.get(String(box.id)) === page);
  const allowed = new Set(siblings.map(box => String(box.id)));
  const ids = ordered.filter(id => allowed.has(id)), chosen = new Set(ids);
  let next = 0;
  const sequence = siblings.map(box => chosen.has(String(box.id)) ? ids[next++]! : String(box.id));
  const byId = new Map(siblings.map(box => [String(box.id), box]));
  const parent = owner ? index.byId.get(owner) : undefined, flow = parent?.layout === 'flex' || parent?.layout === 'grid';
  const rank = new Map(sequence.map((id, order) => [id, order]));
  next = 0;
  return boxes.map(box => {
    if (!allowed.has(String(box.id))) return box;
    const row = byId.get(sequence[next++]!)!;
    return flow && row.layoutOrder !== rank.get(String(row.id)) ? { ...row, layoutOrder: rank.get(String(row.id))! } : row;
  });
}
