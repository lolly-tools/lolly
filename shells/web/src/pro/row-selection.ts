// SPDX-License-Identifier: MPL-2.0
/** Selection follows row identities through edits, paging and reordering. */
export interface IdentifiedRow { uid: string }

export class RowSelection {
  readonly ids = new Set<string>();
  private anchor: string | undefined;

  toggle(rows: readonly IdentifiedRow[], uid: string, checked: boolean, extend = false): void {
    const end = rows.findIndex(row => row.uid === uid);
    if (end < 0) return;
    const start = extend ? rows.findIndex(row => row.uid === this.anchor) : -1;
    const range = start < 0 ? [rows[end]!] : rows.slice(Math.min(start, end), Math.max(start, end) + 1);
    for (const row of range) {
      if (checked) this.ids.add(row.uid);
      else this.ids.delete(row.uid);
    }
    if (start < 0) this.anchor = uid;
  }

  reconcile(rows: readonly IdentifiedRow[]): void {
    const present = new Set(rows.map(row => row.uid));
    for (const uid of this.ids) if (!present.has(uid)) this.ids.delete(uid);
    if (this.anchor && !present.has(this.anchor)) this.anchor = undefined;
  }

  clear(): void { this.ids.clear(); this.anchor = undefined; }

  scope<R extends IdentifiedRow>(rows: readonly R[]): R[] {
    return this.ids.size ? rows.filter(row => this.ids.has(row.uid)) : [...rows];
  }
}

export const BATCH_PAGE_SIZE = 50;

export function rowPage<R>(rows: readonly R[], requested: number): { rows: R[]; page: number; pages: number; start: number } {
  const pages = Math.max(1, Math.ceil(rows.length / BATCH_PAGE_SIZE));
  const page = Math.max(0, Math.min(pages - 1, requested));
  const start = page * BATCH_PAGE_SIZE;
  return { rows: rows.slice(start, start + BATCH_PAGE_SIZE), page, pages, start };
}

/** A page drag replaces only that page's slots in the complete row order. */
export function reorderRows<R extends IdentifiedRow>(rows: readonly R[], order: readonly string[]): R[] {
  const byId = new Map(rows.map(row => [row.uid, row]));
  const moved = [...new Set(order)].flatMap(uid => byId.has(uid) ? [byId.get(uid)!] : []);
  const ids = new Set(moved.map(row => row.uid));
  let index = 0;
  return rows.map(row => ids.has(row.uid) ? moved[index++]! : row);
}

export function duplicateRows<R extends IdentifiedRow & { values: Record<string, unknown>; kitOutputId?: string }>(
  rows: readonly R[], ids: ReadonlySet<string>, newUid: () => string,
): { rows: R[]; copies: R[] } {
  const copies: R[] = [];
  const next = rows.flatMap(row => {
    if (!ids.has(row.uid)) return [row];
    const copy = { ...row, uid: newUid(), values: structuredClone(row.values) };
    delete copy.kitOutputId;
    copies.push(copy);
    return [row, copy];
  });
  return { rows: next, copies };
}

export function removeRows<R extends IdentifiedRow>(rows: readonly R[], ids: ReadonlySet<string>): { rows: R[]; removed: Array<{ row: R; index: number }> } {
  return { rows: rows.filter(row => !ids.has(row.uid)), removed: rows.flatMap((row, index) => ids.has(row.uid) ? [{ row, index }] : []) };
}

export function restoreRows<R extends IdentifiedRow>(rows: readonly R[], removed: readonly { row: R; index: number }[]): R[] {
  const next = [...rows];
  const present = new Set(next.map(row => row.uid));
  for (const { row, index } of removed) if (!present.has(row.uid)) { next.splice(Math.min(index, next.length), 0, row); present.add(row.uid); }
  return next;
}
