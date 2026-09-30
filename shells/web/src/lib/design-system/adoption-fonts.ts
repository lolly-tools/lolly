// SPDX-License-Identifier: MPL-2.0
/** Choose the exact imported faces belonging to the active material revision. */
export function selectAdoptionFonts<T extends { id: string; meta?: Record<string, unknown> }>(rows: T[], selected: readonly string[] = []): T[] {
  const ids = new Set(selected);
  const family = (row: T) => String(row.meta?.family ?? row.meta?.name ?? '').toLowerCase();
  const families = new Map<string, number>();
  for (const row of rows) if (ids.has(row.id)) families.set(family(row), Math.max(families.get(family(row)) ?? 0, Number(row.meta?.modifiedAt) || 0));
  const replaced = new Set(rows.filter(row => !row.meta?.adoption && (Number(row.meta?.modifiedAt) || 0) > (families.get(family(row)) ?? Infinity)).map(family));
  return rows.filter(row => ids.has(row.id) ? !replaced.has(family(row)) : !row.meta?.adoption && (!families.has(family(row)) || replaced.has(family(row))));
}
