// SPDX-License-Identifier: MPL-2.0
import type { InputSpec, InputValue } from '@lolly/engine';

/**
 * Pure helpers for tree-shaped `blocks` inputs and cross-block reference pickers.
 *
 * Two features live here, both DOM-free so they're unit-testable from the repo root:
 *
 * - Reference pickers (`optionsFrom`): a block sub-field whose choices come from
 *   rows of another blocks input. The value stored is the target row's
 *   *effective id* — derived the SAME way a tool's hook derives it (slug of the
 *   key field, else the label, else an ordinal, de-duplicated). Because tools
 *   slug both the node's id and the back-reference to it, storing the slug here
 *   keeps the reference valid without the engine knowing the tool's id scheme.
 *
 * - Nesting (`nesting`): treats a flat blocks array as an editable tree by reading
 *   each row's parent reference. The data stays a flat, reference-by-id array
 *   (so graphs / groupings still work and the URL format is unchanged) — only
 *   the sidebar *presentation* (indentation, drag above/below/inside) is tree-shaped.
 *
 * Keep `slugRef` in lockstep with the tool-side `slug()` (e.g. diagram-builder
 * hooks.js): same normalisation ⇒ the id the picker stores matches the id the hook
 * resolves.
 *
 * Durable references: a row's effective id can be POSITION-derived when it has no
 * explicit key and no label (`node-${i}`) and order-dependent when labels collide
 * (`lead-2`). Such a key would drift if the array is reordered, breaking any stored
 * reference to that row. So whenever a reference is created (drag-reparent, or
 * dropdown pick), we MATERIALISE the target's current effective id onto its
 * `keyField` (see freezeReferencedKeys / materializeRefTarget), so the reference is
 * anchored to a durable, explicit id that survives later reorders.
 */

/** A single row of a `blocks` input; sub-field values keyed by field id. */
export type BlockRow = { [key: string]: InputValue | undefined };

/** Key-derivation config: which sub-fields supply a row's effective id. */
export interface BlockKeyCfg {
  keyField?: string;
  labelField?: string;
  prefix?: string;
}

/** Key-derivation config with a mandatory key field (materialisation target). */
export interface KeyedBlockCfg extends BlockKeyCfg {
  keyField: string;
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

/** One normalised reference source (rows of another blocks input). */
export interface OptionsFromSource {
  input: string;
  value: string;
  label: string;
  prefix: string;
}

/** Normalised form of an input field's `optionsFrom` config. */
export interface NormalizedOptionsFrom {
  sources: OptionsFromSource[];
  freeText: boolean;
  excludeSelf: boolean;
  excludeDescendants: boolean;
  emptyLabel: string | null;
}

/** One <option> choice rendered by a reference picker. */
export interface RefOption {
  value: string;
  label: string;
}

/** Result of building a reference picker's option list. */
export interface RefOptionsResult {
  options: RefOption[];
  emptyLabel: string | null;
  freeText: boolean;
}

/** Params for {@link buildRefOptions}. */
export interface BuildRefOptionsParams {
  of: Record<string, unknown> | undefined;
  ownerInputId: string;
  idx: number;
  getRows: (inputId: string) => InputValue[] | undefined;
  ownerNestingCfg?: ResolvedNestingCfg | null;
}

/** Narrows an unknown value read off the manifest-shaped `optionsFrom` config. */
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Narrows an `activeWhen` value, which may be a scalar or an array of scalars. */
const isUnknownArray = (v: unknown): v is unknown[] => Array.isArray(v);

/**
 * Coerces a row value read from an external `getRows` callback into a BlockRow.
 * `getRows` is a trust boundary (it hands back arbitrary InputValue elements of
 * whatever array the caller's model holds); a plain-object element is treated as
 * a blocks row, matching this module's documented assumption that rows are objects.
 */
const asRow = (v: InputValue | undefined): BlockRow =>
  (isRecord(v) ? (v as BlockRow) : {});

/** Lowercase, collapse non-alphanumerics to single hyphens, trim hyphens. */
export function slugRef(s: InputValue | undefined): string {
  return String(s == null ? '' : s)
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Effective, de-duplicated id per row of a blocks array, aligned by index.
 * Mirrors a tool's normalise step: slug(keyField) || slug(labelField) ||
 * `${prefix}${n}`, with `-2`/`-3` suffixes on collision.
 * @param {object[]} rows
 * @param {{keyField?:string,labelField?:string,prefix?:string}} [cfg]
 * @returns {string[]}
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
 * Is a blocks input acting as an editable tree under these model values?
 * `nesting.activeWhen` gates it by top-level input values (array value ⇒ membership);
 * no `activeWhen` ⇒ always on. No `nesting` ⇒ false.
 */
export function nestingActive(input: InputSpec | undefined, modelValues: Record<string, InputValue | undefined> = {}): boolean {
  const n = input?.nesting;
  if (!n) return false;
  const when = n.activeWhen;
  if (!when) return true;
  return Object.entries(when).every(([k, v]) =>
    isUnknownArray(v) ? v.includes(modelValues[k]) : modelValues[k] === v);
}

/** Normalise an input's `nesting` config to concrete field names + key cfg. */
export function nestingConfig(input: InputSpec | undefined): ResolvedNestingCfg {
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
 * @param {object[]} rows
 * @param {string[]} keys from deriveBlockKeys
 * @param {string} parentField
 * @returns {number[]}
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
 * Pre-order [{idx, depth}] over the parent forest — the order the sidebar renders
 * the tree in. Cycle/orphan-safe: any row not reached from a root is appended as its
 * own root (matches the tool's buildTree promoting orphans).
 */
export function blockTreeOrder(rows: BlockRow[], parentIdx: number[]): TreeEntry[] {
  const n = rows.length;
  const children: number[][] = Array.from({ length: n }, () => []);
  const roots: number[] = [];
  parentIdx.forEach((p, i) => {
    const bucket = p >= 0 && p < n ? children[p] : undefined;
    (bucket ?? roots).push(i);
  });
  const out: TreeEntry[] = [], seen = new Array<boolean>(n).fill(false);
  const walk = (i: number, depth: number): void => {
    if (seen[i]) return;
    seen[i] = true;
    out.push({ idx: i, depth });
    const kids = children[i];
    if (kids) kids.forEach(c => walk(c, depth + 1));
  };
  roots.forEach(i => walk(i, 0));
  for (let i = 0; i < n; i++) if (!seen[i]) walk(i, 0); // detached / cyclic → root
  return out;
}

/**
 * Pre-order list of indices in the subtree rooted at `idx` (idx first).
 * Cycle-safe (via a `seen` guard) and range-safe, so malformed/cyclic parent data
 * yields a finite, de-duplicated subtree instead of overflowing the stack.
 */
export function blockSubtree(idx: number, parentIdx: number[]): number[] {
  const n = parentIdx.length;
  if (idx < 0 || idx >= n) return [];
  const children: number[][] = Array.from({ length: n }, () => []);
  parentIdx.forEach((p, i) => { if (p >= 0 && p < n) { const bucket = children[p]; if (bucket) bucket.push(i); } });
  const out: number[] = [], seen = new Array<boolean>(n).fill(false);
  const walk = (i: number): void => {
    if (seen[i]) return;
    seen[i] = true;
    out.push(i);
    const kids = children[i];
    if (kids) kids.forEach(walk);
  };
  walk(idx);
  return out;
}

/**
 * Move the dragged row's whole subtree next to the target and update its parent ref.
 * Returns a NEW rows array in pre-order, or null for a no-op / illegal move
 * (drop on self, or into the dragged node's own subtree — would orphan it).
 *
 * @param {object[]} rows
 * @param {number} fromIdx index of the dragged row
 * @param {number} targetIdx index of the row dropped onto
 * @param {'before'|'after'|'inside'} intent
 * @param {{parentField:string,keyField?:string,labelField?:string,prefix?:string}} cfg
 */
export function blockReparentMove(rows: BlockRow[], fromIdx: number, targetIdx: number, intent: 'before' | 'after' | 'inside', cfg: ResolvedNestingCfg): BlockRow[] | null {
  if (!Array.isArray(rows)) return null;
  if (fromIdx === targetIdx) return null;
  if (fromIdx < 0 || fromIdx >= rows.length) return null;
  if (targetIdx < 0 || targetIdx >= rows.length) return null;

  const keys = deriveBlockKeys(rows, cfg);
  const parentIdx = blockParentIndex(rows, keys, cfg.parentField);

  // Refuse to drop a node into its own subtree (would orphan it). Use the
  // cycle-safe descendant set, not the pre-order run — under malformed/cyclic
  // input a real descendant can fall outside the contiguous run.
  if (blockSubtree(fromIdx, parentIdx).includes(targetIdx)) return null;

  const D = blockTreeOrder(rows, parentIdx);            // [{idx, depth}] pre-order
  const dpos = D.findIndex(e => e.idx === fromIdx);
  if (dpos < 0) return null;
  const dEntry = D[dpos];
  if (!dEntry) return null; // dpos came from findIndex above, so always in range
  const dDepth = dEntry.depth;
  // The dragged subtree is contiguous in a pre-order list: from dpos until the
  // depth drops back to dDepth or shallower.
  let dEnd = dpos + 1;
  while (dEnd < D.length) {
    const e = D[dEnd];
    if (!e || e.depth <= dDepth) break;
    dEnd++;
  }
  const run = D.slice(dpos, dEnd);

  const restD = [...D.slice(0, dpos), ...D.slice(dEnd)];
  const tp = restD.findIndex(e => e.idx === targetIdx);
  if (tp < 0) return null;
  const tEntry = restD[tp];
  if (!tEntry) return null; // tp came from findIndex above, so always in range
  const tDepth = tEntry.depth;

  let insertAt: number;
  if (intent === 'before') {
    insertAt = tp;
  } else if (intent === 'inside') {
    insertAt = tp + 1;                                  // first child of target
  } else {                                              // 'after' — skip target's subtree
    let e = tp + 1;
    while (e < restD.length) {
      const entry = restD[e];
      if (!entry || entry.depth <= tDepth) break;
      e++;
    }
    insertAt = e;
  }

  const newD = [...restD.slice(0, insertAt), ...run, ...restD.slice(insertAt)];
  const order = newD.map(e => e.idx);
  const out = order.map(i => ({ ...rows[i] }));
  // The dragged root is run[0], now sitting at position `insertAt` in `out`.
  const newParentOrig = intent === 'inside' ? targetIdx : (parentIdx[targetIdx] ?? -1);
  const draggedRoot = out[insertAt];
  if (draggedRoot) draggedRoot[cfg.parentField] = newParentOrig >= 0 ? (keys[newParentOrig] ?? '') : '';

  // The reorder above can change a position-derived key. Anchor every row that is
  // now referenced as a parent to its ORIGINAL effective id (which the references
  // already hold) by writing it onto keyField — so the move can't silently orphan
  // a card whose id was auto-derived. Leaf/unreferenced rows keep their blank id.
  return freezeReferencedKeys(out, order, keys, cfg);
}

/**
 * Write each referenced parent's original effective id onto its keyField, so the
 * id is explicit and survives reordering. `out` is the reordered clone array,
 * `order` maps out-position → original index, `origKeys` are the pre-move keys.
 */
function freezeReferencedKeys(out: BlockRow[], order: number[], origKeys: string[], cfg: ResolvedNestingCfg): BlockRow[] {
  const referenced = new Set<string>();
  out.forEach(r => { const ref = slugRef(r?.[cfg.parentField]); if (ref) referenced.add(ref); });
  order.forEach((origIdx, pos) => {
    const key = origKeys[origIdx] ?? '';
    if (!referenced.has(key)) return;
    const row = out[pos];
    if (row && slugRef(row[cfg.keyField]) !== key) out[pos] = { ...row, [cfg.keyField]: key };
  });
  return out;
}

/**
 * Materialise a single reference target's effective id onto its keyField, so a
 * dropdown-picked reference is anchored to a durable id. Returns a new rows array
 * (or the same one if nothing to do). Used on the dropdown commit path, mirroring
 * what blockReparentMove does for the drag path.
 */
export function materializeRefTarget(rows: BlockRow[], refKey: string, cfg: KeyedBlockCfg): BlockRow[] {
  if (!Array.isArray(rows) || !refKey) return rows;
  const keys = deriveBlockKeys(rows, cfg);
  const i = keys.indexOf(refKey);
  if (i < 0) return rows;                                   // unknown ref — leave as-is
  if (slugRef(rows[i]?.[cfg.keyField]) === refKey) return rows; // already explicit
  return rows.map((r, j) => (j === i ? { ...r, [cfg.keyField]: refKey } : r));
}

/**
 * Normalise a field's `optionsFrom` to a list of sources plus picker flags.
 * Accepts either a single source ({input, value, label}) or {sources:[...]}.
 * @returns {{sources:{input:string,value:string,label:string,prefix:string}[],
 *   freeText:boolean, excludeSelf:boolean, excludeDescendants:boolean,
 *   emptyLabel:(string|null)}}
 */
export function normalizeOptionsFrom(of: Record<string, unknown> | undefined): NormalizedOptionsFrom {
  if (!of) return { sources: [], freeText: false, excludeSelf: false, excludeDescendants: false, emptyLabel: null };
  const one = (s: Record<string, unknown>): OptionsFromSource => ({
    input: typeof s.input === 'string' ? s.input : '',
    value: typeof s.value === 'string' ? s.value : 'nodeId',
    label: typeof s.label === 'string' ? s.label : 'label',
    prefix: typeof s.prefix === 'string' ? s.prefix : 'node-',
  });
  const sources = Array.isArray(of.sources) ? of.sources.filter(isRecord).map(one) : (of.input ? [one(of)] : []);
  return {
    sources,
    freeText: of.freeText === true,
    excludeSelf: of.excludeSelf === true,
    excludeDescendants: of.excludeDescendants === true,
    emptyLabel: typeof of.emptyLabel === 'string' ? of.emptyLabel : null,
  };
}

/**
 * Build the option list for a reference picker on row `idx` of `ownerInputId`.
 * `getRows(inputId)` returns the live rows of any blocks input.
 * Each option is { value, label }. De-duplicated by value (first wins).
 * `excludeSelf` / `excludeDescendants` apply only to options drawn from the
 * owner input (you can't be your own parent, nor reparent into your own subtree).
 */
export function buildRefOptions({ of, ownerInputId, idx, getRows, ownerNestingCfg }: BuildRefOptionsParams): RefOptionsResult {
  const norm = normalizeOptionsFrom(of);
  const rowsOf = (inId: string): BlockRow[] => { const r = getRows(inId); return Array.isArray(r) ? r.map(asRow) : []; };
  let selfSubtree: Set<number> | null = null;
  if (norm.excludeDescendants && ownerNestingCfg) {
    const rows = rowsOf(ownerInputId);
    const keys = deriveBlockKeys(rows, ownerNestingCfg);
    const pIdx = blockParentIndex(rows, keys, ownerNestingCfg.parentField);
    selfSubtree = new Set(blockSubtree(idx, pIdx));
  }
  const seen = new Set<string>();
  const opts: RefOption[] = [];
  for (const s of norm.sources) {
    const rows = rowsOf(s.input);
    const keys = deriveBlockKeys(rows, { keyField: s.value, labelField: s.label, prefix: s.prefix });
    rows.forEach((r, ri) => {
      const isOwner = s.input === ownerInputId;
      if (isOwner && norm.excludeSelf && ri === idx) return;
      if (isOwner && selfSubtree && selfSubtree.has(ri)) return;
      const value = keys[ri];
      if (!value || seen.has(value)) return;
      seen.add(value);
      const text = String(r?.[s.label] ?? '').trim() || value;
      opts.push({ value, label: text });
    });
  }
  return { options: opts, emptyLabel: norm.emptyLabel, freeText: norm.freeText };
}
