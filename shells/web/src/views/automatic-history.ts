// SPDX-License-Identifier: MPL-2.0
/** Two independent cadences, one serial writer: fast rolling recovery and sparse
 * visible checkpoints. A competing tab's edits remain a recoverable branch.
 *
 * An explicit save never depends on history (plan 277 P1, review B1): when history
 * cannot take the document, the save writes the record directly through `store`
 * and history pauses for this creation until that saved state is recorded. */
import type { RevisionHistoryAPI, RevisionEntry } from '../bridge/revision-history.ts';
import type { SavedStateData } from '../bridge/state.ts';
import type { RevisionCursor } from '../bridge/revision-records.ts';
import { t } from '../i18n.ts';

/** How an explicit save reached the record: as a saved revision, or written
 * directly while history is paused. Either way the record holds the save. */
export type SaveOutcome = 'recorded' | 'stored';

export interface AutomaticHistory {
  changed(): void;
  save(slot: string, data: SavedStateData): Promise<SaveOutcome>;
  flush(): Promise<void>;
  /** Protect the latest edits one last time, then stop: nothing this controller
   * does afterwards writes. Leave without saving closes before it discards, so a
   * teardown flush cannot write the discarded edits back (plan 277 P1). */
  close(): Promise<void>;
  status(): string;
  /** Whether edits made now reach History as checkpoints a person can open as a
   * copy, so a discard can promise that History keeps them: not while history is
   * paused for this creation, checkpoints are paused, or recovery cannot write. */
  keepsEdits(): boolean;
  /** This creation has never been explicitly saved, so Leave without saving takes
   * it out of Projects (plan 277 P1, recheck R2). */
  neverSaved(): boolean;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
interface HistoryPorts extends Pick<RevisionHistoryAPI, 'head' | 'checkpoint' | 'attachPreview'> {
  current?: RevisionHistoryAPI['current'];
  recovery?: RevisionHistoryAPI['recovery'];
}

export function createAutomaticHistory(opts: {
  history: HistoryPorts;
  initial?: RevisionCursor;
  toolId: string;
  getSlot(): string | null;
  setSlot(slot: string): void;
  snapshot(): SavedStateData;
  load(slot: string): Promise<SavedStateData | null>;
  capture(): Promise<string | null>;
  /** Write the record without history (the state bridge's save): the path an
   * explicit save takes when history cannot record the document. */
  store?(slot: string, data: SavedStateData): Promise<void>;
  saved(): void;
  failure?(message: string): void;
  allowed?(): boolean;
}): AutomaticHistory {
  let head: string | null = null, version: string | null = null;
  const writerId = crypto.randomUUID();
  let generation = 0, savedGeneration = 0, recoveredGeneration = 0, lastSave = 0;
  let dirtySince: number | undefined, recoverySince: number | undefined;
  let recovering = false, recoveryFailed = false;
  let stopped = false, paused = false, diverged = false, initialized = false, closed = false;
  // The record holds a save that no revision has (an adopt on open failed, or a
  // save was written directly). Drafts and checkpoints wait: writing edits over
  // that save would leave Leave without saving an older save to return to.
  let adoptPending = false, retryTimer: ReturnType<typeof setTimeout> | undefined;
  // A fresh creation, or one opened with no last explicit save, until a save or an adopt.
  let neverSaved = opts.getSlot() ? opts.initial?.neverSaved === true : true;
  let message = 'Automatic recovery and checkpoints are on';
  let timer: ReturnType<typeof setTimeout> | undefined, recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = (value: string): void => { message = value; for (const listener of listeners) listener(); };
  const allowed = (): boolean => opts.allowed?.() !== false;
  const time = (): string => new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const report = (error: unknown): void => {
    const first = !paused; paused = true;
    notify(error instanceof Error ? error.message : 'History could not save. Your previous saved work is safe.');
    if (first) opts.failure?.(message);
  };
  /** History stops for this creation; saving still works. */
  const pause = (error?: unknown): void => {
    const first = !paused; paused = true;
    const reason = error instanceof Error ? ` ${error.message}` : '';
    if (first || reason) notify(`${t('History is paused for this creation.')}${reason}`);
    if (first) opts.failure?.(message);
  };
  const cursorOf = async (slot: string): Promise<RevisionCursor> =>
    opts.history.current ? await opts.history.current(slot) : { head: await opts.history.head(slot), version: null };
  /** Record the saved state the record holds as a saved revision, keeping the
   * record as it is. Throws when history cannot take that state. */
  const adopt = async (slot: string, cursor: RevisionCursor): Promise<void> => {
    const data = await opts.load(slot);
    if (!data || !allowed()) return;
    const entry = await opts.history.checkpoint(slot, data, { reason: 'save', adopt: true, expectedHead: cursor.head, ...(opts.history.current ? { expectedVersion: cursor.version } : {}) });
    head = entry.id; version = entry.currentVersion ?? entry.id; neverSaved = false;
  };
  const initialSlot = opts.getSlot();
  let queue: Promise<unknown> = (async () => {
    if (!allowed()) return;
    try {
      if (initialSlot) {
        const cursor: RevisionCursor = opts.initial ?? await cursorOf(initialSlot);
        head = cursor.head; version = cursor.version;
        // A saved state no revision holds yet (saved before history existed,
        // replaced from outside the editor, or a document from before the saved
        // pointer existed) is adopted as a saved revision before the first edit, so
        // Leave without saving has that state to return to.
        if ((!head && !version) || cursor.workingHash === '' || cursor.adopt) await adopt(initialSlot, cursor);
      }
    } catch (error) {
      // Pause for this creation instead of switching off: saves still write the
      // record, and the adopt is tried again later.
      adoptPending = true; pause(error);
    }
    initialized = true;
  })();
  /** Try the adopt again (after a direct save, or a minute into editing). */
  const resume = (): Promise<unknown> => {
    clearTimeout(retryTimer); retryTimer = undefined;
    const task = queue.then(async () => {
      const slot = opts.getSlot();
      if (closed || !adoptPending || !allowed() || !slot) return;
      await adopt(slot, await cursorOf(slot));
      adoptPending = false; paused = false; diverged = false; lastSave = Date.now();
      notify('Automatic recovery and checkpoints are on');
    });
    queue = task.catch(() => { /* still paused; the next save or edit tries again */ });
    return queue;
  };

  const claimSlot = (): string => {
    const slot = opts.getSlot() || `${opts.toolId}:${crypto.randomUUID()}`;
    opts.setSlot(slot); return slot;
  };
  const protect = async (data?: SavedStateData, captured = generation): Promise<void> => {
    clearTimeout(recoveryTimer);
    if (!opts.history.recovery || !allowed() || generation === recoveredGeneration) return;
    if (closed || adoptPending) return;
    if (recovering) { await queue; if (data) await protect(data, captured); return; }
    const slot = claimSlot();
    let frozen: SavedStateData;
    try { frozen = structuredClone(data ?? opts.snapshot()); } catch (error) { report(error); return; }
    recovering = true;
    const task = queue.then(async () => {
      if (closed || adoptPending || !allowed() || !initialized || captured <= recoveredGeneration) return;
      const entry = await opts.history.recovery!.save(slot, frozen, { writerId, expectedHead: head, expectedVersion: version });
      recoveredGeneration = captured; recoveryFailed = false;
      if (generation === captured) recoverySince = undefined;
      if (entry.diverged) {
        const first = !diverged; diverged = true; paused = true;
        notify(`Another tab saved this creation. Your separate draft was protected at ${time()}. Open it as a copy in History.`);
        if (first) opts.failure?.(message);
      } else {
        version = entry.version; opts.saved();
        notify(`Current work saved at ${time()} on this device${paused ? '; checkpoints paused' : ''}`);
      }
    });
    queue = task.catch(error => {
      notify(`Recovery could not save: ${error instanceof Error ? error.message : 'keep this tab open and save an editable file.'}`);
      if (!recoveryFailed) opts.failure?.(message); recoveryFailed = true;
    }).finally(() => {
      recovering = false;
      if (!stopped && generation > captured && generation !== recoveredGeneration) {
        clearTimeout(recoveryTimer); recoveryTimer = setTimeout(() => { void protect(); }, 1000);
      }
    });
    await queue;
  };
  /** A checkpoint; resolves true once written, false when nothing was written. */
  const write = (slot: string, data: SavedStateData, reason: RevisionEntry['reason'], captured = generation): Promise<boolean> => {
    const frozen = structuredClone(data);
    const task = queue.then(async () => {
      if (closed || adoptPending || !allowed() || !initialized || captured < recoveredGeneration) return false;
      if (diverged) throw new Error('Your edits are a separate recovery draft. Open that draft as a copy in History before saving.');
      notify('Saving checkpoint…');
      const entry = await opts.history.checkpoint(slot, frozen, { reason, expectedHead: head, ...(opts.history.current ? { expectedVersion: version } : {}) });
      head = entry.id; version = entry.currentVersion ?? entry.id; opts.setSlot(slot);
      savedGeneration = captured; recoveredGeneration = Math.max(recoveredGeneration, captured);
      if (generation === captured) { dirtySince = undefined; recoverySince = undefined; }
      lastSave = Date.now(); paused = false; opts.saved();
      notify(`Checkpoint saved at ${time()} on this device`);
      if (!stopped && generation === captured) void opts.capture().then(async thumb => {
        if (thumb && !stopped && generation === captured && allowed()) {
          await opts.history.attachPreview(entry.id, thumb); notify(message);
        }
      }).catch(() => {});
      return true;
    });
    // A failed explicit save is handled by save(), which still writes the record.
    queue = task.catch(reason === 'save' ? () => {} : report); return task;
  };
  /** Write an explicit save straight to the record, in turn with the other writes,
   * then record that saved state in history if it can take it now; otherwise
   * pause history for this creation until it can. */
  const store = (slot: string, data: SavedStateData, captured: number, cause?: unknown): Promise<SaveOutcome> => {
    const frozen = structuredClone(data);
    const task = queue.then(async () => {
      if (!opts.store) throw cause ?? new Error('History could not save. Your previous saved work is safe.');
      await opts.store(slot, frozen);
      adoptPending = true; neverSaved = false;
      savedGeneration = Math.max(savedGeneration, captured); recoveredGeneration = Math.max(recoveredGeneration, captured);
      if (generation === captured) { dirtySince = undefined; recoverySince = undefined; }
      opts.saved();
      try {
        if (!allowed()) throw cause;
        await adopt(slot, await cursorOf(slot));
        adoptPending = false; paused = false; diverged = false; lastSave = Date.now();
        notify(`Checkpoint saved at ${time()} on this device`);
      } catch (error) { pause(cause ?? error); }
      return 'stored' as const;
    });
    queue = task.catch(() => {});
    return task;
  };
  const checkpoint = async (data?: SavedStateData, captured = generation): Promise<void> => {
    clearTimeout(timer);
    if (closed || adoptPending || !allowed() || paused || generation === savedGeneration) return;
    try { await write(claimSlot(), data ?? opts.snapshot(), 'automatic', captured); } catch (error) { report(error); }
  };
  const flush = async (): Promise<void> => {
    if (closed || (generation === savedGeneration && generation === recoveredGeneration)) return;
    try {
      const data = structuredClone(opts.snapshot()), captured = generation;
      const protection = protect(data, captured), commit = checkpoint(data, captured);
      await protection; await commit;
    } catch (error) { report(error); }
  };
  return {
    changed() {
      if (stopped || !allowed()) return;
      generation++;
      const now = Date.now(); dirtySince ??= now; recoverySince ??= now;
      clearTimeout(recoveryTimer);
      if (opts.history.recovery) recoveryTimer = setTimeout(() => { void protect(); }, Math.min(1000, Math.max(0, recoverySince + 5000 - now)));
      if (adoptPending && !retryTimer) retryTimer = setTimeout(() => { void resume(); }, 60_000);
      if (paused) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void checkpoint(); }, Math.min(Math.max(2000, lastSave + 60_000 - now), Math.max(0, dirtySince + 60_000 - now)));
    },
    async save(slot, data) {
      clearTimeout(timer); clearTimeout(recoveryTimer); opts.setSlot(slot);
      const captured = generation;
      let cause: unknown;
      if (!adoptPending && !closed) {
        try { if (await write(slot, data, 'save', captured)) { neverSaved = false; return 'recorded'; } } catch (error) { cause = error; }
      }
      // History could not record it (not started, paused for this creation, a
      // refused value, a full budget, another tab): the record is still written.
      return store(slot, data, captured, cause);
    },
    flush,
    async close() {
      if (closed) return;
      await flush();
      closed = true; stopped = true; clearTimeout(timer); clearTimeout(recoveryTimer); clearTimeout(retryTimer);
      await queue.catch(() => {});
    },
    status: () => message,
    neverSaved: () => neverSaved,
    keepsEdits: () => !closed && initialized && !paused && !adoptPending && !recoveryFailed && !!opts.history.recovery && allowed(),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { stopped = true; clearTimeout(timer); clearTimeout(recoveryTimer); clearTimeout(retryTimer); listeners.clear(); },
  };
}
