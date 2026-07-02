// SPDX-License-Identifier: MPL-2.0
/**
 * Undo / redo as an explicit input controller (finding 7).
 *
 * History used to be bolted on inside mountTool by REPLACING runtime.setInput
 * and stuffing a `setInputNoHistory` escape hatch onto the runtime object — a
 * leaky boundary every other scope then depended on. This controller owns the
 * chokepoint instead: UI code calls history.set / history.setSilent, and the
 * runtime keeps its real, unpatched API.
 *
 * Semantics preserved from the original wrap:
 * - A slider drag fires per pixel, so rapid same-input changes coalesce (by id
 *   + time) into a single step — one gesture, one undo.
 * - Values carrying raw file bytes / blob: URLs are never recorded: the source
 *   blob URL is revoked when the input is replaced, so a restored ref would be
 *   dead, and deep-cloning megabytes per entry is wasteful.
 * - An undo/redo ends any gesture — the next edit starts a new step (tracked
 *   separately from stack entries, so a post-undo edit can't merge into an
 *   entry that survived the undo).
 * - Restoring just replays setInput, so the existing subscriber refreshes the
 *   sidebar + canvas for free and onInput re-derives computed inputs.
 */
import type { Runtime, InputValue } from '@lolly/engine';

/** The slice of the runtime history needs — the real Runtime satisfies it. */
export type HistoryRuntime = Pick<Runtime, 'setInput' | 'getModel'>;

/** What undo()/redo() hand back so the caller can show its toast. */
export interface HistoryStep {
  id: string;
  /** The input's human name (falls back to its id). */
  label: string;
}

export interface InputHistory {
  /** Apply a user edit: records an undo step (with gesture coalescing). */
  set(id: string, value: InputValue): Promise<void>;
  /** Apply a programmatic change without touching history (e.g. px-sync). */
  setSilent(id: string, value: InputValue): Promise<void>;
  /** Revert the newest step. Returns it (for the toast) or null if empty. */
  undo(): HistoryStep | null;
  /** Reapply the newest undone step. Returns it or null if empty. */
  redo(): HistoryStep | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Notifies whenever canUndo/canRedo may have changed (header ↶/↷ sync). */
  onChange(fn: () => void): void;
}

export interface InputHistoryOpts {
  /** Max recorded steps; the oldest is evicted beyond this. */
  limit?: number;
  /** Same-input edits within this window merge into one step. */
  coalesceMs?: number;
  /** Injected clock for tests. */
  now?: () => number;
}

interface HistoryEntry {
  id: string;
  label: string;
  before: InputValue;
  after: InputValue;
}

const cloneValue = (v: InputValue): InputValue => {
  try { return structuredClone(v); } catch { return v; }
};

const sameValue = (a: InputValue, b: InputValue): boolean => {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

/**
 * A value carrying raw file bytes / a blob: URL (a file input, or a `blocks`
 * array with an embedded image) — never recorded, see module comment.
 */
const carriesBytes = (v: InputValue): boolean => {
  if (!v || typeof v !== 'object') return false;
  if (v instanceof Uint8Array) return true;
  const record = v as Record<string, unknown>;
  if (record.bytes instanceof Uint8Array || record.bytes instanceof ArrayBuffer) return true;
  if (typeof record.url === 'string' && record.url.startsWith('blob:')) return true;
  const children = Array.isArray(v) ? v : Object.values(v);
  return children.some(c => carriesBytes(c as InputValue));
};

export function createInputHistory(
  runtime: HistoryRuntime,
  { limit = 100, coalesceMs = 500, now = Date.now }: InputHistoryOpts = {},
): InputHistory {
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  const listeners: (() => void)[] = [];
  // Gesture continuity for coalescing, tracked SEPARATELY from stack entries:
  // an undo/redo leaves an old entry on top still carrying its original time,
  // so keying off the entry could wrongly merge a post-undo edit into it.
  let lastRecordId: string | null = null;
  let lastRecordTime = 0;

  const notify = (): void => listeners.forEach(fn => fn());

  const record = (id: string, value: InputValue): void => {
    const cur = runtime.getModel().find(i => i.id === id);
    if (!cur || sameValue(cur.value, value) || carriesBytes(value) || carriesBytes(cur.value)) return;
    const t = now();
    const last = undoStack[undoStack.length - 1];
    if (last && lastRecordId === id && t - lastRecordTime < coalesceMs) {
      last.after = cloneValue(value); // extend the gesture, keep its original `before`
    } else {
      undoStack.push({ id, label: cur.label || cur.id, before: cloneValue(cur.value), after: cloneValue(value) });
      if (undoStack.length > limit) undoStack.shift();
    }
    lastRecordId = id;
    lastRecordTime = t;
    redoStack.length = 0; // a fresh edit breaks the redo chain
    notify();
  };

  const apply = (id: string, value: InputValue): Promise<void> => {
    lastRecordId = null; // an undo/redo ends any gesture
    return runtime.setInput(id, cloneValue(value));
  };

  return {
    set(id, value) {
      record(id, value);
      return runtime.setInput(id, value);
    },
    setSilent(id, value) {
      return runtime.setInput(id, value);
    },
    undo() {
      const entry = undoStack.pop();
      if (!entry) return null;
      redoStack.push(entry);
      void apply(entry.id, entry.before);
      notify();
      return { id: entry.id, label: entry.label };
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return null;
      undoStack.push(entry);
      void apply(entry.id, entry.after);
      notify();
      return { id: entry.id, label: entry.label };
    },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    onChange(fn) { listeners.push(fn); },
  };
}
