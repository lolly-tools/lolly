// SPDX-License-Identifier: MPL-2.0
/**
 * The Design editor's copy-style payload.
 *
 * A style is deliberately a caller-supplied allow-list, not "the object minus a few
 * fields". New document fields therefore stay out until the editor explicitly decides
 * they are visual properties. That is the safe direction for ids, geometry, timing,
 * artboard ownership, notes and other state whose accidental copy can lose work.
 */

export interface DesignStyleSnapshot {
  readonly version: 1;
  /** Fields the source explicitly carried. */
  readonly values: Readonly<Record<string, unknown>>;
  /** Allowed style fields absent on the source; paste removes them from the target. */
  readonly absent: readonly string[];
}

/** Capture exactly the allow-listed fields, including their explicit absence. */
export function captureDesignStyle(
  source: Readonly<Record<string, unknown>>,
  fields: readonly string[]
): DesignStyleSnapshot {
  const values: Record<string, unknown> = {};
  const absent: string[] = [];
  for (const field of [...new Set(fields.filter(Boolean))]) {
    if (Object.hasOwn(source, field) && source[field] !== undefined) values[field] = source[field];
    else absent.push(field);
  }
  return { version: 1, values, absent };
}

/**
 * Apply one snapshot to all named rows. Every non-style property survives verbatim and
 * untouched rows keep object identity; callers can therefore detect a true no-op.
 */
export function applyDesignStyle<T extends Record<string, unknown>>(
  rows: readonly T[],
  targetIds: ReadonlySet<string>,
  idOf: (row: T, index: number) => string,
  snapshot: DesignStyleSnapshot
): T[] {
  if (!targetIds.size) return rows.slice();
  const absent = new Set(snapshot.absent);
  return rows.map((row, index) => {
    if (!targetIds.has(idOf(row, index))) return row;
    const next = { ...row } as T;
    const writable = next as Record<string, unknown>;
    for (const field of absent) delete writable[field];
    for (const [field, value] of Object.entries(snapshot.values)) writable[field] = value;
    return next;
  });
}
