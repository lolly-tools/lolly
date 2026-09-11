// SPDX-License-Identifier: MPL-2.0
/**
 * Pure, DOM-free helpers for tree-shaped `blocks` inputs - a trimmed copy of the
 * web shell's `shells/web/src/views/block-tree.ts` (which the TUI can't import
 * across the shell boundary). Only the pieces the terminal block editor needs:
 * effective-key derivation, parent-index resolution, pre-order tree layout, and
 * the `nesting` config/gate. Keep `slugRef` in lockstep with a tool's own `slug()`
 * (e.g. diagram-builder hooks.js) so the id a picker/reparent stores matches the
 * id a hook resolves.
 */
import type { InputValue, BlocksNesting } from '../../../../engine/src/inputs.ts';

/** A single row of a `blocks` input; sub-field values keyed by field id. */
export type BlockRow = { [key: string]: InputValue | undefined };

/** Key-derivation config: which sub-fields supply a row's effective id. */
export interface BlockKeyCfg {
  keyField?: string;
  labelField?: string;
  prefix?: string;
}

/** A `nesting` config with every field's default resolved to a concrete string. */
export interface ResolvedNestingCfg {
  parentField: string;
  keyField: string;
  labelField: string;
  prefix: string;
}

/** Pre-order tree entry: a row index paired with its depth in the forest. */
export interface TreeEntry {
  idx: number;
  depth: number;
}

/** Lowercase, collapse non-alphanumerics to single hyphens, trim hyphens. */
export function slugRef(s: InputValue | undefined): string {
  return String(s == null ? '' : s)
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Effective, de-duplicated id for each row of a blocks array, aligned by index.
 * Mirrors a tool's normalise step: slug(keyField) || slug(labelField) ||
 * `${prefix}${n}`, with `-2`/`-3` suffixes on collision.
 */
export function deriveBlockKeys(rows: BlockRow[], { keyField = 'nodeId', labelField = 'label', prefix = 'node-' }: BlockKeyCfg = {}): string[] {
  const used: Record<string, number> = Object.create(null);
  return (Array.isArray(rows) ? rows : []).map((r, i) => {
    let id = slugRef(r?.[keyField]) || slugRef(r?.[labelField]) || `${prefix}${i + 1}`;
    if (used[id]) { let k = 2; while (used[`${id}-${k}`]) k++; id = `${id}-${k}`; }
    used[id] = 1;
    return id;
  });
}

/**
 * Is a blocks input acting as an editable tree under the current model values?
 * `nesting.activeWhen` gates it by top-level input values (array value ⇒ membership);
 * no `activeWhen` ⇒ always on. No `nesting` ⇒ false.
 */
export function nestingActive(input: { nesting?: BlocksNesting } | undefined, modelValues: Record<string, InputValue | undefined> = {}): boolean {
  const n = input?.nesting;
  if (!n) return false;
  const when = n.activeWhen;
  if (!when) return true;
  return Object.entries(when).every(([k, v]) =>
    Array.isArray(v) ? v.includes(modelValues[k]) : modelValues[k] === v);
}

/** Normalise an input's `nesting` config to concrete field names + key cfg. */
export function nestingConfig(input: { nesting?: BlocksNesting } | undefined): ResolvedNestingCfg {
  const n: Partial<ResolvedNestingCfg> = input?.nesting ?? {};
  return {
    parentField: n.parentField ?? 'parent',
    keyField: n.keyField ?? 'nodeId',
    labelField: n.labelField ?? 'label',
    prefix: n.prefix ?? 'node-',
  };
}

/**
 * Parent row index per row (-1 for roots), by matching each row's parent
 * reference against the derived keys. Self-references and unknown refs ⇒ -1.
 */
export function blockParentIndex(rows: BlockRow[], keys: string[], parentField: string): number[] {
  const byId: Record<string, number> = Object.create(null);
  keys.forEach((id, i) => { if (id && byId[id] === undefined) byId[id] = i; });
  return keys.map((_, i) => {
    const ref = slugRef(rows[i]?.[parentField]);
    const p = ref && byId[ref] !== undefined ? byId[ref] : -1;
    return p === i ? -1 : p;
  });
}

/**
 * Pre-order [{idx, depth}] over the parent forest - the order the sidebar renders
 * a tree in. Cycle/orphan-safe: any row not reached from a root is appended as its
 * own root (matches the tool's buildTree promoting orphans).
 */
export function blockTreeOrder(rows: BlockRow[], parentIdx: number[]): TreeEntry[] {
  const n = rows.length;
  const children: number[][] = Array.from({ length: n }, () => []);
  const roots: number[] = [];
  parentIdx.forEach((p, i) => { (p >= 0 && p < n ? children[p]! : roots).push(i); });
  const out: TreeEntry[] = [], seen = new Array<boolean>(n).fill(false);
  const walk = (i: number, depth: number): void => {
    if (seen[i]) return;
    seen[i] = true;
    out.push({ idx: i, depth });
    children[i]!.forEach(c => walk(c, depth + 1));
  };
  roots.forEach(i => walk(i, 0));
  for (let i = 0; i < n; i++) if (!seen[i]) walk(i, 0); // detached / cyclic → root
  return out;
}
