// SPDX-License-Identifier: MPL-2.0
/**
 * planCopies - the gallery "Make copies…" flow's pure core: turn a per-tool copy
 * count into the ordered list of fresh sessions to mint, one per copy.
 *
 * The one subtlety worth pinning: slots must be unique ACROSS tools, not just
 * within one. The tool view's "Make variants" could get away with `stamp + i`
 * because it only ever copies a single tool; here several tools are minted in the
 * same tick, so a single running counter (`stamp++`) is what keeps two tools'
 * first copies from colliding on the same millisecond.
 */
export interface CopyCount { id: string; n: number; }
export interface PlannedCopy { slot: string; toolId: string; label: string; }

export function planCopies(
  counts: CopyCount[],
  nameOf: (id: string) => string,
  base: number,
): PlannedCopy[] {
  let stamp = base;
  const out: PlannedCopy[] = [];
  for (const { id, n } of counts) {
    const nm = nameOf(id);
    for (let i = 0; i < Math.max(0, n); i++) {
      // `${nm} 1`, `${nm} 2`… only when a tool has more than one copy - a lone
      // copy keeps the plain tool name (what multi-edit shows as the cell label).
      out.push({ slot: `${id}:${stamp++}`, toolId: id, label: n > 1 ? `${nm} ${i + 1}` : nm });
    }
  }
  return out;
}
