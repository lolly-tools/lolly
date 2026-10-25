// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view's undo/redo model - pure, DOM-free, testable.
 *
 * Extracted from views/tool.ts for maintainability-2026-07-29.md item 2, the
 * second increment after views/assets-filter.ts. Same shape as the pattern that
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
import { isTokenValue } from '../../../../engine/src/tokens.ts';

export function historyTokenLinks(model: Array<{ id: string; restoreTokenRef?: string }>, fields: readonly string[]): Record<string, string | null> {
  return Object.fromEntries(fields.map(id => [id, model.find(item => item.id === id)?.restoreTokenRef ?? null]));
}

/**
 * One undoable edit: an input's value before and after a single gesture.
 *
 * `before` and `after` are the values themselves, by reference, not copies. Model
 * values are copy on write (a commit builds a new array and keeps the rows it did not
 * change), so a kept value never changes afterwards, consecutive steps share every row
 * they did not touch, and a hundred steps of a large document cost pointers rather than
 * two hundred copies of the document. Development and test builds freeze what history
 * keeps, so a write in place fails loudly there (`FREEZE_HISTORY_VALUES`).
 */
export interface HistoryEntry {
  id: string;
  /** The input's human name - what the undo/redo toast shows. */
  label: string;
  before: InputValue;
  after: InputValue;
  collabStamp?: number;
  /** An atomic command can change several declared inputs together. */
  fields?: string[];
  tokenLinks?: { before: Record<string, string | null>; after: Record<string, string | null> };
  /**
   * The input's declared type, as `record` is told it: only a `file` input holds raw
   * bytes (see `carriesBytes`), so only its values, or those of an entry that does not
   * say, are walked for them. A command over several inputs says `file` when any of
   * them is one. Not kept on the stored entry.
   */
  inputType?: string;
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
 * Development and test builds freeze every value history is handed. Model values are
 * copy on write (a commit builds a new array and keeps the rows it did not change), and
 * history relies on that: a value history keeps must never change afterwards. Freezing
 * turns any code that writes to a model value in place into a TypeError where a test or
 * a developer sees it, instead of a corrupted undo step in production. Production
 * builds skip the walk.
 */
export const FREEZE_HISTORY_VALUES = import.meta.env?.PROD !== true;

/**
 * Deep-freeze a value's arrays and plain objects, in place, and return the value. Anything
 * else (bytes, a Blob, a class instance) is left alone: freezing a typed array with
 * elements throws, and an instance is not model data. An object already frozen is taken
 * as frozen all the way down, so a commit that replaced one row walks that row only.
 */
export function freezeValue<T>(v: T): T {
  if (!v || typeof v !== 'object' || Object.isFrozen(v)) return v;
  if (!Array.isArray(v)) {
    const proto: unknown = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return v;
  }
  Object.freeze(v);
  for (const child of Array.isArray(v) ? v : Object.values(v)) freezeValue(child);
  return v;
}

/** A value as history keeps it: frozen in development and test builds. */
const kept = (v: InputValue): InputValue => (FREEZE_HISTORY_VALUES ? freezeValue(v) : v);

/** One element as `JSON.stringify` writes it inside an array. */
const elementJson = (v: unknown): string => JSON.stringify(v) ?? 'null';

/** A value `JSON.stringify` leaves out of an object. */
const unwritten = (v: unknown): boolean => v === undefined || typeof v === 'function' || typeof v === 'symbol';

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto: unknown = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** Two arrays, row by row: a row that is the same object is the same row, and only a
 *  row that is not is serialised. */
function sameRowsJson(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && elementJson(a[i]) !== elementJson(b[i])) return false;
  return true;
}

/**
 * Value equality for "did this edit actually change anything". Structural, not by
 * reference, and it answers exactly as comparing the two values' JSON would; an
 * unserialisable value (a cycle, a function) reports NOT equal, which errs toward
 * recording a step rather than silently swallowing one.
 *
 * Identity comes first at every level that costs: the whole value, each row of an
 * array, and each value of a plain object such as a command's `{ input: value }`
 * map. A commit keeps the rows it did not change by reference, so an edit to one box
 * of a large document serialises that box, not the document.
 */
export function sameValue(a: InputValue, b: InputValue): boolean {
  if (a === b) return true;
  try {
    if (Array.isArray(a) && Array.isArray(b)) return sameRowsJson(a, b);
    if (isPlainRecord(a) && isPlainRecord(b) && typeof a.toJSON !== 'function' && typeof b.toJSON !== 'function') {
      const ka = Object.keys(a).filter((k) => !unwritten(a[k]));
      const kb = Object.keys(b).filter((k) => !unwritten(b[k]));
      if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
      return ka.every((k) => {
        const x = a[k], y = b[k];
        if (x === y) return true;
        if (Array.isArray(x) && Array.isArray(y)) return sameRowsJson(x, y);
        return JSON.stringify(x) === JSON.stringify(y);
      });
    }
    return JSON.stringify(a) === JSON.stringify(b);
  } catch { return false; }
}

/**
 * Does this value carry raw file bytes (a `file` input's in-memory ref)?
 *
 * Those are NOT recorded: the ref's object URL is revoked when the input is
 * replaced or cleared and there is no durable id to re-resolve from, so a
 * restored entry would point at a dead URL - and keeping megabytes alive per
 * entry is wasteful.
 *
 * Only a `file` input holds such a ref, so `record` walks a value for bytes only when
 * its entry is a file input's or does not say what it is (`HistoryEntry.inputType`):
 * walking every row of a large document on every edit, to find bytes no row can
 * hold, was one of the whole-document passes each Design edit paid.
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
  record(edit: HistoryEntry, now: number): RecordOutcome;
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
  /**
   * A pointer went DOWN: whatever it edits until it comes up is one gesture, however
   * long it takes (plans/268 SI-13). It also ends the gesture before it, so a drag
   * begun within the window of the last edit does not merge into that edit.
   */
  beginHold(): void;
  /** The pointer came UP: the gesture is over, and the next edit is a new step. */
  endHold(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** The entry the next undo would take, compared by identity (a live agent may undo only its own). */
  peekUndo(): HistoryEntry | null;
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
  // WHAT ONE GESTURE IS (plans/268 SI-13). The window alone got it wrong both ways in
  // an editor where every edit writes the SAME input (Design's `boxes`):
  //   • two different edits made inside half a second (delete a clip, move another)
  //     merged into one undo step, and Cmd+Z took back both;
  //   • one slow drag of a slider, with a pause in it longer than the window, split
  //     into several steps.
  // So the window now only covers edits made with NO pointer down - typing, key repeat
  // on an arrow nudge - which is where "fast enough to be one thought" is all there is
  // to go on. A held pointer is one gesture by definition, whatever the clock says.
  // And rows arriving or leaving is never part of a gesture: an add, a delete, a paste
  // and a split are each a decision, and each undoes on its own.
  let holding = false;

  return {
    record({ id, label, before, after, collabStamp, fields, tokenLinks, inputType }, now) {
      if (sameValue(before, after) && sameValue(tokenLinks?.before ?? null, tokenLinks?.after ?? null)) return 'ignored';
      if ((inputType === undefined || inputType === 'file') && (carriesBytes(after) || carriesBytes(before))) return 'ignored';
      // Kept by reference: for a plain write, the model's own values.
      kept(before); kept(after);

      const last = undoStack[undoStack.length - 1];
      const structural = Array.isArray(before) && Array.isArray(after) && before.length !== after.length;
      const bindingChange = (isTokenValue(before) ? before.ref : null) !== (isTokenValue(after) ? after.ref : null);
      const decision = structural || bindingChange;
      let outcome: RecordOutcome;
      if (!decision && last && lastRecordId === id && JSON.stringify(last.fields) === JSON.stringify(fields) && (holding || now - lastRecordTime < coalesceMs)) {
        last.after = after;   // extend the gesture, keep its original `before`
        if (tokenLinks) last.tokenLinks = { before: last.tokenLinks?.before ?? { ...tokenLinks.before }, after: { ...tokenLinks.after } };
        outcome = 'coalesced';
      } else {
        undoStack.push({ id, label, before, after, ...(collabStamp !== undefined ? { collabStamp } : {}), ...(fields ? { fields: [...fields] } : {}), ...(tokenLinks ? { tokenLinks: structuredClone(tokenLinks) } : {}) });
        if (undoStack.length > limit) undoStack.shift();
        outcome = 'pushed';
      }
      // Nothing merges INTO a structural step either: a move made straight after a paste
      // is its own step, so one undo takes back the move and the next takes back the paste.
      lastRecordId = decision ? null : id;
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
    beginHold() { holding = true; lastRecordId = null; },
    endHold() { holding = false; lastRecordId = null; },
    canUndo() { return undoStack.length > 0; },
    canRedo() { return redoStack.length > 0; },
    peekUndo() { return undoStack[undoStack.length - 1] ?? null; },
    sizes() { return { undo: undoStack.length, redo: redoStack.length }; },
  };
}
