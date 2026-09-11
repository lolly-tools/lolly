// SPDX-License-Identifier: MPL-2.0
/**
 * Stable row identity - a dependency-free ULID, plus the hidden id field every
 * `blocks` row carries from birth.
 *
 * Why (plan 100 section 3, "Hard prerequisite - stable row ids"): a live collab addresses
 * ops at a ROW, and peers mint rows with no chance to coordinate - so an array
 * position cannot be an identity (a concurrent insert renumbers everything below it,
 * and a late field op would land on someone else's row), and neither can a per-mount
 * counter (two devices opening the same saved session both start at 1). A ULID is
 * 48 bits of millisecond timestamp + 80 bits of entropy in 26 Crockford-base32
 * characters: independent minting is safe, and the time prefix keeps ids sorted in
 * creation order, which also reads better in an L0 revision diff than a random blob.
 *
 * No dependency, because the whole spec is the thirty lines below.
 *
 * The ids are shell-internal and tool-invisible: `ROW_ID_FIELD` is not a declared
 * sub-field, so no control renders it and no template references it. It should not
 * ride a URL either - a URL is a transport for VALUES, and the rows it describes are
 * new rows on the receiving device, not the sender's rows - but only the COMPACT
 * blocks encoding gets that for free (lib/blocks-url.ts writes DECLARED fields in
 * field order). The lossless JSON fallback, which any row bearing a `,` or a `~`
 * falls back to, copies every key: `stripHiddenRowIds` is what keeps the link
 * builders honest, and ~38 characters per row out of the 8000-char budget.
 *
 * Known gap, deliberately not papered over here: the ENGINE's own serializer
 * (`serializeUrlState` → `blocksForUrl`) has no notion of this field, so a seed URL,
 * an embed/compose URL or a `z`-packed link built there still carries it. Fixing that
 * properly means the URL form carrying declared sub-fields only, which is an engine
 * decision about undeclared row keys in general (nothing constrains a sub-field id
 * today), not a special case for this one name.
 */

/** Crockford base32 - no I, L, O or U (unambiguous when read aloud or typed). */
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;      // 50 bits of characters holding a 48-bit ms timestamp
const RANDOM_LEN = 16;    // 80 bits of entropy

/** The hidden sub-field a generic `blocks` row carries its stable id in. */
export const ROW_ID_FIELD = '__rid';

/** 26-char ULID shape (Crockford alphabet, no ambiguous letters). */
const ULID_RE = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

// Monotonic state: within one millisecond the spec increments the random component
// rather than redrawing it, so ids minted in a tight loop (a 40-row paste) stay both
// unique and sorted. Per-tab only - cross-device ordering rides the 80 random bits.
let lastMs = -1;
let lastRandom: number[] = [];

function drawRandom(): number[] {
  const out: number[] = new Array(RANDOM_LEN);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(RANDOM_LEN);
    c.getRandomValues(bytes);
    // 256 is an exact multiple of 32, so masking is uniform (no modulo bias).
    for (let i = 0; i < RANDOM_LEN; i++) out[i] = bytes[i]! & 31;
  } else {
    for (let i = 0; i < RANDOM_LEN; i++) out[i] = Math.floor(Math.random() * 32);
  }
  return out;
}

/** Increment the random component (base 32, least-significant char last). */
function bumpRandom(): void {
  for (let i = RANDOM_LEN - 1; i >= 0; i--) {
    if (lastRandom[i]! < 31) { lastRandom[i]!++; return; }
    lastRandom[i] = 0;
  }
  // 80 bits exhausted inside one millisecond: not reachable in this universe, but a
  // silent wrap to all-zeros would repeat ids, so redraw instead.
  lastRandom = drawRandom();
}

/**
 * A fresh ULID. Monotonic within a millisecond; never throws, never awaits, and
 * degrades to `Math.random` where `crypto.getRandomValues` is missing (uniqueness is
 * what this needs - it is not a secret).
 */
export function ulid(): string {
  const now = Date.now();
  if (now > lastMs) { lastMs = now; lastRandom = drawRandom(); }
  else bumpRandom();   // same millisecond, or a clock that stepped backwards
  let time = '';
  let t = lastMs;
  for (let i = 0; i < TIME_LEN; i++) { time = ENCODING[t % 32] + time; t = Math.floor(t / 32); }
  let rand = '';
  for (let i = 0; i < RANDOM_LEN; i++) rand += ENCODING[lastRandom[i]!];
  return time + rand;
}

/** True for a value shaped like a ULID this module minted. */
export function isUlid(v: unknown): boolean {
  return typeof v === 'string' && ULID_RE.test(v);
}

/**
 * Give every row that lacks one an id in `field`, and return the SAME array when
 * nothing was missing - so a caller can commit only on a real change (`next !== rows`).
 * Existing ids are never rewritten: this is the lazy migration for rows saved before
 * ids existed, run on load, and it must be a no-op the second time it sees them.
 */
export function ensureRowIds<T extends object>(rows: readonly T[], field: string = ROW_ID_FIELD): T[] {
  let changed = false;
  const out = rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    const cur = (row as Record<string, unknown>)[field];
    if (cur != null && cur !== '') return row;
    changed = true;
    return { ...row, [field]: ulid() } as T;
  });
  return changed ? out : (rows as T[]);
}

/**
 * A blocks value with the HIDDEN id stripped from every row - what a link carries.
 * Returns the same array when there was nothing to strip, and touches only
 * `ROW_ID_FIELD`: a canvas collection's DECLARED id is content (connector endpoints,
 * frame membership and masks all reference it by name) and must ride the URL.
 */
export function stripHiddenRowIds<T>(value: T): T {
  if (!Array.isArray(value)) return value;
  let changed = false;
  const out = value.map(row => {
    if (!row || typeof row !== 'object' || !(ROW_ID_FIELD in row)) return row;
    changed = true;
    const { [ROW_ID_FIELD]: _drop, ...rest } = row as Record<string, unknown>;
    return rest;
  });
  return changed ? (out as unknown as T) : value;
}

// ── Which field, and the once-per-mount migration ──────────────────────────────

/** The slice of an input model item this module reads - structural on purpose, so
 *  row-id.ts stays importable from anywhere (no engine, no DOM, no view). */
export interface RowIdInput {
  id: string;
  type?: string;
  value?: unknown;
  fields?: { id: string }[];
  canvas?: Record<string, unknown> | undefined;
}

/**
 * The sub-field a row of this input carries its stable id in (plan 100 section 3, "Hard
 * prerequisite - stable row ids"):
 *
 *  - a CANVAS collection uses the tool's own declared id sub-field, because that id is
 *    already the wire identity everything resolves a box through (selection, connector
 *    endpoints, frame membership, masks). free-canvas resolves the same name the same
 *    way - declared, else the 'id' default - so a row added from the sidebar is born
 *    with exactly the identity a box added on the canvas gets;
 *  - every OTHER blocks input uses the hidden `ROW_ID_FIELD`. Undeclared on purpose: no
 *    control renders it, no template references it, and the compact blocks URL form
 *    (declared fields, in field order) never carries it.
 *
 * ONE definition, because a row minted under one name and addressed under another is a
 * row nothing can resolve: the sidebar (which births rows), the canvas and the collab
 * projection all call this.
 */
export function rowIdField(inp: Pick<RowIdInput, 'fields' | 'canvas'>): string {
  const declared = inp.canvas?.idField;
  const name = inp.canvas ? (typeof declared === 'string' && declared ? declared : 'id') : '';
  return name && (inp.fields ?? []).some(f => f.id === name) ? name : ROW_ID_FIELD;
}

/** The write path the migration takes - `applyPatch`, never `setInput`. See below. */
export interface RowIdRuntime {
  getModel(): RowIdInput[];
  applyPatch(values: Record<string, unknown>): Promise<void>;
}

/**
 * Give every id-less row in every `blocks` input its stable id, once, at mount.
 *
 * Rows created from here on are born with one (`newBlockRow` in views/tool-inputs.ts);
 * this is the lazy migration for sessions saved before ids existed - no pass over
 * stored slots, and a session closed unsaved simply gets fresh ids next time.
 *
 * Two placement rules built into this function's structure, both learned the hard way:
 *
 *  - it belongs to a MOUNTED SESSION, not to a sidebar render. Panel rendering is
 *    also driven by `/multi`'s fan-out runtime, whose `getModel()` returns the LEAD
 *    session's items and whose `setInput` writes to EVERY session declaring that id - 
 *    so migrating from there would overwrite each sibling session's rows with the
 *    lead's and mark them all dirty, before the user touched anything.
 *  - it writes through `applyPatch`, not `setInput`. In mountTool `setInput` is the
 *    undo-history wrapper, so stamping ids there pushes a phantom step and the user's
 *    first ⌘Z would undo an id migration they never made (on a canvas tool, back to
 *    an id-less array where every row answers to the same empty key). `applyPatch` is
 *    the engine's atomic apply: no history, no collab echo, one render for the lot.
 */
export async function migrateBlockRowIds(runtime: RowIdRuntime): Promise<void> {
  const values: Record<string, unknown> = {};
  for (const item of runtime.getModel()) {
    if (item.type !== 'blocks' || !Array.isArray(item.value) || !item.value.length) continue;
    const rows = item.value as object[];
    const next = ensureRowIds(rows, rowIdField(item));
    if (next !== rows) values[item.id] = next;
  }
  if (Object.keys(values).length) await runtime.applyPatch(values);
}
