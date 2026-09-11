// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view's undo/redo model - pure, DOM-free, testable.
 *
 * Extracted from views/tool.ts for maintainability-2026-07-29.md item 2, the
 * second increment after views/catalog-filter.ts. Same shape as the pattern that
 * already works in this repo (free-canvas-math.ts, timeline-math.ts): the view
 * keeps the wiring - the runtime, the toasts, the button sync - and this module
 * owns the rules.
 *
 * WHY THIS CLUSTER. Its own comments in tool.ts record two bugs that already
 * shipped here, and both are the kind only a unit test catches:
 *
 *   1. The recorded-value filter was once a `blob:` URL test, which silently
 *      disabled ALL undo in Design the moment any box image resolved
 *      through the asset-blob cache. The rule is about raw BYTES in memory, not
 *      about the URL scheme - an asset ref carrying a blob: URL is perfectly
 *      recordable because it re-derives its URL from a durable source + id.
 *   2. Coalescing keyed off the top entry rather than off the last RECORD meant a
 *      post-undo edit could merge into a stale entry and lose a state.
 *
 * Neither is visible in a type signature, and neither had a test.
 *
 * The model is deliberately time-injected (`now` is a parameter, never
 * `Date.now()`), so gesture coalescing is testable without faking the clock.
 */

import type { InputValue } from '../../../../engine/src/inputs.js';

/** One undoable edit: an input's value before and after a single gesture. */
export interface HistoryEntry {
  id: string;
  /** The input's human name - what the undo/redo toast shows. */
  label: string;
  before: InputValue;
  after: InputValue;
}

/** Entries kept before the oldest is dropped. */
export const HISTORY_LIMIT = 100;
/** Edits to the SAME input within this many ms merge into one undo step. */
export const COALESCE_MS = 500;

/** Structured deep copy, falling back to the original when a value is unclonable. */
export function cloneValue(v: InputValue): InputValue {
  try { return structuredClone(v); } catch { return v; }
}

/**
 * Value equality for "did this edit actually change anything". JSON-based, so it
 * compares structurally rather than by reference; an unserialisable value (a
 * cycle, a function) reports NOT equal, which errs toward recording a step
 * rather than silently swallowing one.
 */
export function sameValue(a: InputValue, b: InputValue): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/**
 * Does this value carry raw file bytes (a `file` input's in-memory ref)?
 *
 * Those are NOT recorded: the ref's object URL is revoked when the input is
 * replaced or cleared and there is no durable id to re-resolve from, so a
 * restored entry would point at a dead URL - and deep-cloning megabytes per
 * entry is wasteful.
 *
 * Note what this does NOT test: the URL. A `blob:`/`data:` URL *without* bytes is
 * fine to record, because an asset ref ({source, id, url}) re-derives its URL
 * from the durable source + id. Testing the scheme instead of the bytes is the
 * bug described in this file's header.
 */
export function carriesBytes(v: InputValue): boolean {
  if (!v || typeof v !== 'object') return false;
  const rec = v as { bytes?: unknown };
  if (rec.bytes instanceof Uint8Array || rec.bytes instanceof ArrayBuffer) return true;
  return (Array.isArray(v) ? v : Object.values(v)).some((c) => carriesBytes(c as InputValue));
}

// ── What the undo toast should CALL a change (plans/179 A16, second half) ──────
//
// A history entry is keyed on an INPUT, so the toast read "Undid Boxes" - the input's
// own name, which says nothing about what was taken back. Nothing in the model records
// the gesture behind a write, but the two VALUES do: for a blocks/canvas array the
// before/after says whether rows arrived, rows left, or one field of one row changed -
// and the canvas config names the geometry fields, so a drag reads as "Move" rather than
// as two field names. Pure and field-name-injected, exactly like the rest of this module.
//
// It answers `null` whenever it cannot name the change honestly (a non-array input, a
// wholesale rewrite, more fields than one gesture plausibly touches). The caller then
// falls back to the input label, so every input this cannot describe reads as it always did.

/** How a blocks/canvas array changed, as a stable key the view translates. */
export type RowChange =
  | { kind: 'add' | 'delete' | 'move' | 'resize' | 'rotate' }
  | { kind: 'field'; field: string };

/** The canvas field names that let a geometry change be named as one (all optional). */
export interface RowChangeFields {
  xField?: string; yField?: string; wField?: string; hField?: string; rotationField?: string;
  /** Give up once more than this many rows differ - a rewrite has no single name. */
  maxRows?: number;
  /** …and once more than this many distinct fields differ. */
  maxFields?: number;
}

export function describeRowChange(
  before: InputValue, after: InputValue, fields: RowChangeFields = {},
): RowChange | null {
  if (!Array.isArray(before) || !Array.isArray(after)) return null;
  if (after.length > before.length) return { kind: 'add' };
  if (after.length < before.length) return { kind: 'delete' };
  const maxRows = fields.maxRows ?? 64;
  const maxFields = fields.maxFields ?? 4;
  const changed = new Set<string>();
  let rows = 0;
  for (let i = 0; i < after.length; i++) {
    const a: unknown = before[i];
    const b: unknown = after[i];
    if (a === b) continue;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return null;
    if (++rows > maxRows) return null;
    const ar = a as Record<string, unknown>;
    const br = b as Record<string, unknown>;
    for (const k of new Set([...Object.keys(ar), ...Object.keys(br)])) {
      if (!sameValue(ar[k] as InputValue, br[k] as InputValue)) changed.add(k);
      if (changed.size > maxFields) return null;
    }
  }
  if (!changed.size) return null;
  const { xField: x, yField: y, wField: w, hField: h, rotationField: r } = fields;
  /** Is every changed field one of these (ignoring the ones the tool does not declare)? */
  const onlyIn = (...ids: Array<string | undefined>): boolean => {
    const set = new Set(ids.filter((v): v is string => !!v));
    return set.size > 0 && [...changed].every((k) => set.has(k));
  };
  if (onlyIn(r)) return { kind: 'rotate' };
  if (onlyIn(x, y)) return { kind: 'move' };
  if (onlyIn(x, y, w, h)) return { kind: 'resize' };
  if (changed.size === 1) return { kind: 'field', field: [...changed][0]! };
  return null;
}

/** What `record` did, so a caller can drive toasts/UI without inspecting stacks. */
export type RecordOutcome = 'pushed' | 'coalesced' | 'ignored';

export interface HistoryModel {
  /**
   * Offer an edit to the history. Returns 'ignored' when the value did not
   * change or either side carries raw bytes, 'coalesced' when it extended the
   * previous gesture, and 'pushed' when it became a new undo step. A push or a
   * coalesce breaks the redo chain.
   */
  record(edit: { id: string; label: string; before: InputValue; after: InputValue }, now: number): RecordOutcome;
  /** Pop the newest undo entry onto the redo stack and return it, or null. */
  undo(): HistoryEntry | null;
  /** Pop the newest redo entry back onto the undo stack and return it, or null. */
  redo(): HistoryEntry | null;
  /**
   * End the current gesture, so the next edit starts a fresh step. The view
   * calls this around an undo/redo application - without it, an edit made
   * straight after an undo can coalesce into the entry that undo left on top.
   */
  endGesture(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Depths, for tests and diagnostics. */
  sizes(): { undo: number; redo: number };
}

export function createHistory(opts: { limit?: number; coalesceMs?: number } = {}): HistoryModel {
  const limit = opts.limit ?? HISTORY_LIMIT;
  const coalesceMs = opts.coalesceMs ?? COALESCE_MS;

  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  // Keyed off the last RECORD, not off the top entry - see the header. undo/redo
  // leaves an old entry on top still carrying its original time, so keying off
  // the entry would let the next edit merge into it and lose a state.
  let lastRecordId: string | null = null;
  let lastRecordTime = 0;

  return {
    record({ id, label, before, after }, now) {
      if (sameValue(before, after)) return 'ignored';
      if (carriesBytes(after) || carriesBytes(before)) return 'ignored';

      const last = undoStack[undoStack.length - 1];
      let outcome: RecordOutcome;
      if (last && lastRecordId === id && now - lastRecordTime < coalesceMs) {
        last.after = cloneValue(after);   // extend the gesture, keep its original `before`
        outcome = 'coalesced';
      } else {
        undoStack.push({ id, label, before: cloneValue(before), after: cloneValue(after) });
        if (undoStack.length > limit) undoStack.shift();
        outcome = 'pushed';
      }
      lastRecordId = id;
      lastRecordTime = now;
      redoStack.length = 0;   // a fresh edit breaks the redo chain
      return outcome;
    },

    undo() {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push(entry);
      return entry;
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(entry);
      return entry;
    },

    endGesture() { lastRecordId = null; },
    canUndo() { return undoStack.length > 0; },
    canRedo() { return redoStack.length > 0; },
    sizes() { return { undo: undoStack.length, redo: redoStack.length }; },
  };
}
