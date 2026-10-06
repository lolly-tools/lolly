// SPDX-License-Identifier: MPL-2.0
import { boxRect, type Box, type BoxFieldConfig } from './free-canvas-math.ts';

const selector = '.lolly-box[data-box-id],.lolly-frame-page[data-frame-id]';
/** Stable IDs index the current projection only. Source rows remain authoritative. */
export function canvasProjection(root: HTMLElement, read: () => readonly Box[], cfg: BoxFieldConfig) {
  let rows: readonly Box[] | undefined, byId = new Map<string, Box>(), dirty = true;
  const elements = new Map<string, HTMLElement>();
  const observer = new root.ownerDocument.defaultView!.MutationObserver(records => { if (structural(records)) dirty = true; });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-box-id', 'data-frame-id'] });
  function structural(records: MutationRecord[]) {
    return records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes].some(node =>
      node.nodeType === 1 && ((node as Element).matches(selector) || (node as Element).querySelector(selector))));
  }
  return {
    snapshot() {
      const current = read();
      if (current !== rows) {
        rows = current; byId = new Map(); const duplicates = new Set<string>();
        for (const row of rows) {
          const id = String(row[cfg.idField] ?? '');
          if (!id || byId.has(id)) duplicates.add(id);
          else byId.set(id, row);
        }
        for (const id of duplicates) byId.delete(id);
      }
      if (structural(observer.takeRecords())) dirty = true;
      if (dirty) {
        dirty = false; elements.clear(); const duplicates = new Set<string>();
        for (const node of root.querySelectorAll<HTMLElement>(selector)) {
          const id = node.getAttribute(node.classList.contains('lolly-box') ? 'data-box-id' : 'data-frame-id')!;
          if (elements.has(id)) duplicates.add(id); else elements.set(id, node);
        }
        for (const id of duplicates) elements.delete(id);
      }
      const model = byId, mounted = new Map(elements);
      return (id: string) => {
        const row = model.get(id); if (!row) return null;
        const rect = boxRect(row, cfg), element = mounted.get(id) ?? null;
        return { ...rect, rot: rect.rot ?? 0, element: element?.isConnected && root.contains(element) ? element : null };
      };
    },
    invalidate() { rows = undefined; dirty = true; },
    dispose() { observer.disconnect(); rows = undefined; byId.clear(); elements.clear(); },
  };
}
