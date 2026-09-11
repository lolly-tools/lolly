// SPDX-License-Identifier: MPL-2.0
/**
 * studio-state.ts - the Design System studio's save discipline (plan 97 section 6).
 *
 * One head document, one write path. Every committed action installs the whole
 * tokens document immediately through `installUserTokens` - the single write
 * chokepoint (plan 97 section 3 principle 9) - and what makes immediate safe is the
 * session undo stack kept here plus the rolling checkpoints persisted in
 * `host.state`. There is no draft/committed split to leak.
 *
 * DOM-free on purpose, so it runs under plain node in tests: installing busts
 * the tokens caches but nothing repaints the chrome by itself, so the view
 * passes its `applyChromeBrandVars` call as the `afterInstall` option rather
 * than this module reaching for the document.
 *
 * Documents crossing this boundary are always cloned: `doc()` hands back a copy
 * so a caller mutating it (the brand-doc helpers all mutate in place) cannot
 * move the head behind our back, which is what keeps an undo snapshot an honest
 * picture of the state before the action.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import { installUserTokens } from '../../bridge/tokens.ts';
import type { WebTokensAPI } from '../../bridge/tokens.ts';

/** A named, restorable snapshot of the head document. */
export interface Checkpoint {
  id: string;
  label: string;
  /** ISO timestamp of when it was taken. */
  date: string;
}

/** What a checkpoint stores: the listing fields plus the document itself. */
interface CheckpointRecord extends Checkpoint {
  doc: unknown;
}

export interface StudioState {
  /** Read the current head document (`host.tokens.raw()`) into memory. */
  load(): Promise<void>;
  /** The head document, or null before `load()` (or when none is reachable). */
  doc(): unknown;
  /** Install a new head document, recording an undo entry for the outgoing one. */
  install(next: unknown, action: string): Promise<void>;
  canUndo(): boolean;
  /** Reinstall the previous snapshot. False when there is nothing to go back to. */
  undo(): Promise<boolean>;
  /** Persist a named checkpoint of the head document; returns its id. */
  checkpoint(label: string): Promise<string>;
  /** Checkpoints oldest first - the order they were taken. */
  listCheckpoints(): Promise<Checkpoint[]>;
  /** Reinstall a checkpoint's document. False when the id is unknown. */
  restoreCheckpoint(id: string): Promise<boolean>;
  /** Subscribe to installs; returns an unsubscribe. */
  onChange(cb: (action: string) => void): () => void;
}

export interface StudioStateOptions {
  /**
   * Runs after every successful install, before subscribers are notified - the
   * view's hook for repainting chrome (`applyChromeBrandVars`). A rejection is
   * logged, never rethrown: the tokens already landed, so a failed repaint must
   * not read to the caller as a failed write.
   */
  afterInstall?: () => void | Promise<void>;
  /**
   * Rename the design system on every install this studio makes.
   *
   * Absent for the studio's own callers, and that is the point: a label here is
   * forwarded to the write chokepoint each time, so passing one for a routine
   * save renames the system on every commit (plans/186 section 3.3). Pass it
   * only when the install IS a rename; with none, the chokepoint keeps the name
   * already on the record and names a first install itself.
   */
  label?: string;
}

/** The state slot holding the checkpoint ring. */
export const CHECKPOINTS_KEY = 'design-system.checkpoints.v1';
/** Rolling history depth (plan 97 section 6 / risk 8) - the oldest is evicted past it. */
export const CHECKPOINT_LIMIT = 20;
/** Session undo depth. Snapshots are a few KB of JSON, so this is memory-shaped,
 *  not a product limit. */
export const UNDO_LIMIT = 50;

/** The action names this module notifies with on its own behalf. */
export const UNDO_ACTION = 'undo';
export const RESTORE_ACTION = 'restore-checkpoint';

/** A DTCG document is a plain object - the same shape installUserTokens accepts. */
function isDoc(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const clone = <T>(v: T): T => structuredClone(v);

function checkpointId(): string {
  // Matches folders.ts: randomUUID everywhere we target, with a fallback so a
  // non-secure context can still take a checkpoint.
  if ((globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID) return crypto.randomUUID();
  return 'cp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createStudioState(host: HostV1, opts: StudioStateOptions = {}): StudioState {
  // The web bridge's tokens surface (raw()) and the install chokepoint's host
  // slice (assets._uploadUserAsset) are shell extensions of HostV1 - reached
  // through the same narrow casts the brand editor and the wizard use.
  const tokens = host.tokens as unknown as WebTokensAPI | undefined;
  const installHost = host as unknown as Parameters<typeof installUserTokens>[0];

  let head: unknown = null;
  const undoStack: unknown[] = [];
  const subs = new Set<(action: string) => void>();

  async function readCheckpoints(): Promise<CheckpointRecord[]> {
    const stored = await host.state.load(CHECKPOINTS_KEY).catch(() => null);
    const entries = (stored as { entries?: unknown } | null)?.entries;
    if (!Array.isArray(entries)) return [];
    return entries.filter((e): e is CheckpointRecord =>
      isDoc(e) && typeof e.id === 'string' && typeof e.label === 'string' && typeof e.date === 'string');
  }

  /** Install + refresh the head + notify. The one path every mutation takes. */
  async function write(next: unknown, action: string): Promise<void> {
    await installUserTokens(installHost, next, opts.label ? { label: opts.label } : {});
    head = clone(next);
    try {
      await opts.afterInstall?.();
    } catch (err) {
      console.warn('[design-system] afterInstall failed', err);
    }
    for (const cb of [...subs]) {
      try { cb(action); } catch (err) { console.warn('[design-system] onChange listener failed', err); }
    }
  }

  /** write() plus an undo entry for the outgoing document. The entry is pushed
   *  only after the install succeeds, so a refused write (a locked brand) leaves
   *  the stack exactly as it was. */
  async function commit(next: unknown, action: string): Promise<void> {
    const outgoing = isDoc(head) ? clone(head) : null;
    await write(next, action);
    if (!outgoing) return; // nothing was installed before - there is nowhere to go back to
    undoStack.push(outgoing);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
  }

  return {
    async load() {
      const raw = await tokens?.raw?.().catch(() => null);
      head = isDoc(raw) ? clone(raw) : null;
    },

    doc: () => (isDoc(head) ? clone(head) : null),

    install: (next, action) => commit(next, action),

    canUndo: () => undoStack.length > 0,

    async undo() {
      const prev = undoStack[undoStack.length - 1];
      if (prev === undefined) return false;
      // Reinstall through write(), not commit() - an undo is not itself an
      // undoable action, and the entry is dropped only once the install lands.
      await write(prev, UNDO_ACTION);
      undoStack.pop();
      return true;
    },

    async checkpoint(label) {
      if (!isDoc(head)) throw new Error('checkpoint: no tokens document loaded');
      const record: CheckpointRecord = { id: checkpointId(), label, date: new Date().toISOString(), doc: clone(head) };
      const list = await readCheckpoints();
      list.push(record);
      while (list.length > CHECKPOINT_LIMIT) list.shift();
      await host.state.save(CHECKPOINTS_KEY, { entries: list });
      return record.id;
    },

    async listCheckpoints() {
      return (await readCheckpoints()).map(({ id, label, date }) => ({ id, label, date }));
    },

    async restoreCheckpoint(id) {
      const record = (await readCheckpoints()).find(c => c.id === id);
      if (!record || !isDoc(record.doc)) return false;
      await commit(record.doc, RESTORE_ACTION);
      return true;
    },

    onChange(cb) {
      subs.add(cb);
      return () => { subs.delete(cb); };
    },
  };
}
