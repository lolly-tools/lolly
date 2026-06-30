// SPDX-License-Identifier: MPL-2.0
/**
 * Pure helpers for tree-shaped `blocks` inputs and cross-block reference pickers.
 *
 * Two features live here, both DOM-free so they're unit-testable at the repo root:
 *
 *  - Reference pickers (`optionsFrom`): a block sub-field whose choices come from
 *    the rows of another blocks input. The value stored is the target row's
 *    *effective id* — derived the SAME way a tool's hook derives it (slug of the
 *    key field, else the label, else an ordinal, de-duplicated). Because tools
 *    slug both a node's id and the back-reference to it, storing the slug here
 *    keeps the reference valid without the engine knowing the tool's id scheme.
 *
 *  - Nesting (`nesting`): treats a flat blocks array as an editable tree by reading
 *    each row's parent reference. The data stays a flat, reference-by-id array
 *    (so graphs / groupings still work and the URL format is unchanged) — only the
 *    sidebar *presentation* (indentation, drag above/below/inside) is tree-shaped.
 *
 * Keep `slugRef` in lockstep with the tool-side `slug()` (e.g. diagram-builder
 * hooks.js): same normalisation ⇒ the id a picker stores matches the id a hook
 * resolves.
 *
 * Durable references: a row's effective id can be POSITION-derived when it has no
 * explicit key and no label (`node-${i}`) or order-dependent when labels collide
 * (`lead-2`). Such a key would drift if the array is reordered, breaking any stored
 * reference to that row. So whenever a reference is created (drag-reparent, or a
 * dropdown pick), we MATERIALISE the target's current effective id onto its
 * `keyField` (see freezeReferencedKeys / materializeRefTarget), so the reference is
 * anchored to a durable, explicit id and survives later reorders.
 */

/** Lowercase, collapse non-alphanumerics to single hyphens, trim hyphens. */
export function slugRef(s) {
  return String(s == null ? '' : s)
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Effective, de-duplicated id for each row of a blocks array, aligned by index.
 * Mirrors a tool's normalise step: slug(keyField) || slug(labelField) ||
 * `${prefix}${n}`, with `-2`/`-3` suffixes on collision.
 * @param {object[]} rows
 * @param {{keyField?:string,labelField?:string,prefix?:string}} [cfg]
 * @returns {string[]}
 */
export function deriveBlockKeys(rows, { keyField = 'nodeId', labelField = 'label', prefix = 'node-' } = {}) {
  const used = Object.create(null);
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
export function nestingActive(input, modelValues = {}) {
  const n = input?.nesting;
  if (!n) return false;
  const when = n.activeWhen;
  if (!when) return true;
  return Object.entries(when).every(([k, v]) =>
    Array.isArray(v) ? v.includes(modelValues[k]) : modelValues[k] === v);
}

/** Normalise an input's `nesting` config to concrete field names + key cfg. */
export function nestingConfig(input) {
  const n = input?.nesting ?? {};
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
 * @param {string[]} keys   from deriveBlockKeys
 * @param {string} parentField
 * @returns {number[]}
 */
export function blockParentIndex(rows, keys, parentField) {
  const byId = Object.create(null);
  keys.forEach((id, i) => { if (id && byId[id] === undefined) byId[id] = i; });
  return keys.map((_, i) => {
    const ref = slugRef(rows[i]?.[parentField]);
    const p = ref && byId[ref] !== undefined ? byId[ref] : -1;
    return p === i ? -1 : p;
  });
}

/**
 * Pre-order [{idx, depth}] over the parent forest — the order the sidebar renders
 * a tree in. Cycle/orphan-safe: any row not reached from a root is appended as its
 * own root (matches the tool's buildTree promoting orphans).
 */
export function blockTreeOrder(rows, parentIdx) {
  const n = rows.length;
  const children = Array.from({ length: n }, () => []);
  const roots = [];
  parentIdx.forEach((p, i) => { (p >= 0 && p < n ? children[p] : roots).push(i); });
  const out = [], seen = new Array(n).fill(false);
  const walk = (i, depth) => {
    if (seen[i]) return;
    seen[i] = true;
    out.push({ idx: i, depth });
    children[i].forEach(c => walk(c, depth + 1));
  };
  roots.forEach(i => walk(i, 0));
  for (let i = 0; i < n; i++) if (!seen[i]) walk(i, 0); // detached / cyclic → root
  return out;
}

/**
 * Pre-order list of indices in the subtree rooted at `idx` (idx first).
 * Cycle-safe (a `seen` guard) and range-safe, so malformed/cyclic parent data
 * yields a finite, de-duplicated subtree rather than overflowing the stack.
 */
export function blockSubtree(idx, parentIdx) {
  const n = parentIdx.length;
  if (idx < 0 || idx >= n) return [];
  const children = Array.from({ length: n }, () => []);
  parentIdx.forEach((p, i) => { if (p >= 0 && p < n) children[p].push(i); });
  const out = [], seen = new Array(n).fill(false);
  const walk = i => { if (seen[i]) return; seen[i] = true; out.push(i); children[i].forEach(walk); };
  walk(idx);
  return out;
}

/**
 * Move a dragged row's whole subtree next to a target and update its parent ref.
 * Returns a NEW rows array in pre-order, or null for a no-op / illegal move
 * (drop on self, or into the dragged node's own subtree — which would orphan it).
 *
 * @param {object[]} rows
 * @param {number} fromIdx  index of the dragged row
 * @param {number} targetIdx index of the row dropped onto
 * @param {'before'|'after'|'inside'} intent
 * @param {{parentField:string,keyField?:string,labelField?:string,prefix?:string}} cfg
 */
export function blockReparentMove(rows, fromIdx, targetIdx, intent, cfg) {
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
  const dDepth = D[dpos].depth;
  // The dragged subtree is contiguous in a pre-order list: from dpos until the
  // depth drops back to dDepth or shallower.
  let dEnd = dpos + 1;
  while (dEnd < D.length && D[dEnd].depth > dDepth) dEnd++;
  const run = D.slice(dpos, dEnd);

  const restD = [...D.slice(0, dpos), ...D.slice(dEnd)];
  const tp = restD.findIndex(e => e.idx === targetIdx);
  if (tp < 0) return null;
  const tDepth = restD[tp].depth;

  let insertAt;
  if (intent === 'before') {
    insertAt = tp;
  } else if (intent === 'inside') {
    insertAt = tp + 1;                                  // first child of target
  } else {                                              // 'after' — skip target's subtree
    let e = tp + 1;
    while (e < restD.length && restD[e].depth > tDepth) e++;
    insertAt = e;
  }

  const newD = [...restD.slice(0, insertAt), ...run, ...restD.slice(insertAt)];
  const order = newD.map(e => e.idx);
  const out = order.map(i => ({ ...rows[i] }));
  // The dragged root is run[0], now sitting at position `insertAt` in `out`.
  const newParentOrig = intent === 'inside' ? targetIdx : parentIdx[targetIdx];
  out[insertAt][cfg.parentField] = newParentOrig >= 0 ? keys[newParentOrig] : '';

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
function freezeReferencedKeys(out, order, origKeys, cfg) {
  const referenced = new Set();
  out.forEach(r => { const ref = slugRef(r?.[cfg.parentField]); if (ref) referenced.add(ref); });
  order.forEach((origIdx, pos) => {
    const key = origKeys[origIdx];
    if (!referenced.has(key)) return;
    if (slugRef(out[pos]?.[cfg.keyField]) !== key) out[pos] = { ...out[pos], [cfg.keyField]: key };
  });
  return out;
}

/**
 * Materialise a single reference target's effective id onto its keyField, so a
 * dropdown-picked reference is anchored to a durable id. Returns a new rows array
 * (or the same one if nothing to do). Used on the dropdown commit path, mirroring
 * what blockReparentMove does for the drag path.
 */
export function materializeRefTarget(rows, refKey, cfg) {
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
export function normalizeOptionsFrom(of) {
  if (!of) return { sources: [], freeText: false, excludeSelf: false, excludeDescendants: false, emptyLabel: null };
  const one = (s) => ({
    input: s.input,
    value: s.value ?? 'nodeId',
    label: s.label ?? 'label',
    prefix: s.prefix ?? 'node-',
  });
  const sources = Array.isArray(of.sources) ? of.sources.map(one) : (of.input ? [one(of)] : []);
  return {
    sources,
    freeText: of.freeText === true,
    excludeSelf: of.excludeSelf === true,
    excludeDescendants: of.excludeDescendants === true,
    emptyLabel: of.emptyLabel ?? null,
  };
}

/**
 * Build the option list for a reference picker on row `idx` of `ownerInputId`.
 * `getRows(inputId)` returns the live rows of any blocks input.
 * Each option is { value, label }. De-duplicated by value (first wins).
 * `excludeSelf` / `excludeDescendants` apply only to options drawn from the
 * owner input (you can't be your own parent, nor reparent into your own subtree).
 */
export function buildRefOptions({ of, ownerInputId, idx, getRows, ownerNestingCfg }) {
  const norm = normalizeOptionsFrom(of);
  const rowsOf = (inId) => { const r = getRows(inId); return Array.isArray(r) ? r : []; };
  let selfSubtree = null;
  if (norm.excludeDescendants && ownerNestingCfg) {
    const rows = rowsOf(ownerInputId);
    const keys = deriveBlockKeys(rows, ownerNestingCfg);
    const pIdx = blockParentIndex(rows, keys, ownerNestingCfg.parentField);
    selfSubtree = new Set(blockSubtree(idx, pIdx));
  }
  const seen = new Set();
  const opts = [];
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
