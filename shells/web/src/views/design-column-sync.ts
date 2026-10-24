// SPDX-License-Identifier: MPL-2.0
/**
 * How the Design side columns (the inspector and the navigator) follow the model
 * without paying for the whole document on every emit.
 *
 * Every edit emits twice (once before the Design hook runs and once after), and a drag
 * or a slider elsewhere emits on every tick. The columns used to answer each emit with
 * work the size of the document: the inspector serialised every row to learn whether
 * anything had changed, and the navigator hashed every field of every row. Three small
 * pieces replace that:
 *
 * - `rowsWatch` notices a change to the rows by the identity of the array. Model writes
 *   are copy on write (a commit keeps unchanged rows by reference and builds a new
 *   array), so a new array is a new revision, and the same row objects in a new array
 *   are no change at all.
 * - `oncePerFrame` coalesces the repaint an emit asks for into one per frame. The shell
 *   asks for its canvas paint first, so the column runs after the paint.
 * - `ownWrites` tells the column's own writes apart from everyone else's. Those still
 *   repaint at once, because the code after them reads the rebuilt column (a focus
 *   hand-back, a rename that refocuses its row).
 */
import type { Box } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';

/** Two row arrays holding the same row objects in the same order: no row changed. */
export function sameRows(a: readonly Box[], b: readonly Box[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export interface RowsWatch {
  /** Read the rows now. True when they changed since the last read: O(1) when the
   *  array is the same, O(n) pointer reads when it is new, never a serialisation. */
  changed(): boolean;
  /** A count that moves on every change `changed` reported. */
  revision(): number;
}

export function rowsWatch(read: () => readonly Box[]): RowsWatch {
  let seen = read();
  let revision = 0;
  return {
    changed() {
      const rows = read();
      if (rows === seen) return false;
      const before = seen;
      seen = rows;
      if (sameRows(before, rows)) return false;
      revision++;
      return true;
    },
    revision: () => revision,
  };
}

export interface FrameCoalesced {
  /** Run once on the next frame, however many times this is called before that frame. */
  schedule(): void;
  /** Run now, and drop a run already scheduled. */
  now(): void;
}

export function oncePerFrame(run: () => void): FrameCoalesced {
  let queued = false;
  const now = (): void => { queued = false; run(); };
  return {
    schedule() {
      if (queued) return;
      if (typeof requestAnimationFrame !== 'function') { now(); return; }
      queued = true;
      requestAnimationFrame(() => { if (queued) now(); });
    },
    now,
  };
}

export interface OwnWrites {
  /** True while one of the column's own writes is running. */
  active(): boolean;
  /** Wrap a write so that it counts as the column's own while it runs. */
  wrap<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R;
  /** The model port with its three writes wrapped. */
  model(port: ModelPort): ModelPort;
  /** A verb table (the host's actions) with every verb wrapped. */
  verbs<T extends object>(table: T): T;
}

export function ownWrites(): OwnWrites {
  let depth = 0;
  const wrap = <A extends unknown[], R>(fn: (...args: A) => R) => (...args: A): R => {
    depth++;
    try { return fn(...args); } finally { depth--; }
  };
  return {
    active: () => depth > 0,
    wrap,
    model: (port) => ({ ...port, commit: wrap(port.commit), setField: wrap(port.setField), setInput: wrap(port.setInput) }),
    verbs<T extends object>(table: T): T {
      const out: T = { ...table };
      for (const key of Object.keys(out) as Array<keyof T>) {
        const verb = out[key];
        if (typeof verb === 'function') out[key] = wrap(verb as (...args: unknown[]) => unknown) as T[keyof T];
      }
      return out;
    },
  };
}
