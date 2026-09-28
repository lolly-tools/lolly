// SPDX-License-Identifier: MPL-2.0
/** Artboard timing edits carry their members without rewriting clip-local keys. */
export interface SceneEditFields {
  idField: string;
  kindField: string;
  frameKind: string;
  frameField: string;
  startField: string;
}
type Row = Record<string, unknown>;
const start = (value: unknown): number | null => value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value);

export function retimeSceneMembers<T extends Row>(before: readonly T[], after: T[], fields: SceneEditFields): T[] {
  const { idField, kindField, frameKind, frameField, startField } = fields;
  const old = new Map(before.map(row => [String(row[idField] ?? ''), row]));
  const next = new Map(after.map(row => [String(row[idField] ?? ''), row]));
  let changed = false;
  const result: T[] = [];
  for (const row of after) {
    const previous = old.get(String(row[idField] ?? ''));
    const ownerId = String(row[frameField] ?? '');
    const owner = old.get(ownerId);
    if (!previous || !owner || owner[kindField] !== frameKind || row[kindField] === frameKind
      || previous[frameField] !== row[frameField]) { result.push(row); continue; }
    const placed = next.get(ownerId);
    if (!placed) { changed = true; continue; }
    const from = start(owner[startField]) ?? 0, to = start(placed[startField]) ?? 0;
    const child = start(previous[startField]);
    // Explicit child retiming and an already-applied timeline ripple both survive.
    if (to === from || child === null || start(row[startField]) !== child) { result.push(row); continue; }
    changed = true;
    result.push({ ...row, [startField]: Math.max(0, Math.round((child + to - from) * 1000) / 1000) });
  }
  return changed ? result : after;
}
