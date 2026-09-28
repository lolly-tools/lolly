// SPDX-License-Identifier: MPL-2.0
/** Two independent cadences, one serial writer: fast rolling recovery and sparse
 * visible checkpoints. A competing tab's edits remain a recoverable branch.
 *
 * An explicit save never depends on history (plan 277 P1, review B1): when history
 * cannot take the document, the save writes the record directly through `store`
 * and history pauses for this creation until that saved state is recorded.
 *
 * Every write freezes the document once (bridge/revision-capture.ts: pinned,
 * canonical and serialised in a single walk) and hands that capture to the store,
 * which hashes it without walking it again (plan 277 P4, phase 0 finding 3). A
 * write whose JSON equals what this writer last wrote is skipped: that saves the
 * IndexedDB write, not the capture, and the generations settle as if it had been
 * written (plan 277 P4 section 3 item 6). */
import type { RevisionHistoryAPI, RevisionEntry } from '../bridge/revision-history.ts';
import type { SavedStateData } from '../bridge/state.ts';
import type { RevisionCursor } from '../bridge/revision-records.ts';
import { captureRevision, type RevisionCapture } from '../bridge/revision-capture.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { t, tRaw } from '../i18n.ts';

/** How an explicit save reached the record: as a saved revision, or written
 * directly while history is paused. Either way the record holds the save. */
export type SaveOutcome = 'recorded' | 'stored';

/** What the controller did last, for code that reacts to it (the History panel
 * refreshes on these). `status()` says the same moment in words, translated, so
 * nothing should compare its text. */
export type HistoryActivity = 'on' | 'saving' | 'checkpoint' | 'draft' | 'diverged' | 'paused' | 'failed' | 'recovery-failed';

export interface AutomaticHistory {
  changed(): void;
  save(slot: string, data: SavedStateData): Promise<SaveOutcome>;
  flush(): Promise<void>;
  /** Protect the latest edits one last time, then stop: nothing this controller
   * does afterwards writes. Leave without saving closes before it discards, so a
   * teardown flush cannot write the discarded edits back (plan 277 P1). */
  close(): Promise<void>;
  status(): string;
  activity(): HistoryActivity;
  /** Give the last recorded explicit save its picture: the revision's preview and
   * the Projects tile. Works after close() and dispose(), because Save & leave
   * takes the picture while the tool is already going. Skipped when the creation
   * changed since that save, unless the tool has closed. */
  attachSaveThumbnail(thumb: string): Promise<void>;
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
/** What one checkpoint write did: recorded a revision, wrote an explicit save as
 * the current state only (the budget had no room), or wrote nothing. */
type Written = 'recorded' | 'stored' | 'none';
/** After an automatic checkpoint is refused, the next edit this long after tries
 * again: space may have been freed (Settings > Storage, eviction, another tab). */
export const CHECKPOINT_RETRY_MS = 60_000;

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
  // The pending save is one the budget skipped: its record is written, only the
  // revision is missing. Drafts continue meanwhile, kept beside that saved record
  // as a protected branch so they never write over the save.
  let skippedSave = false;
  // When an automatic checkpoint was last refused, so a later edit can try again.
  let refusedAt: number | undefined;
  // The last explicit save a revision records, for its picture.
  let lastRecordedSave: { id: string; generation: number } | undefined;
  // A fresh creation, or one opened with no last explicit save, until a save or an adopt.
  let neverSaved = opts.getSlot() ? opts.initial?.neverSaved === true : true;
  // What the current state and the head hold, as this writer last wrote them: a
  // capture equal to the state needs no draft, and one equal to both needs no
  // checkpoint. A draft since the last checkpoint still wants a checkpoint, which
  // clears that draft.
  let stateJson: string | null = null, checkpointJson: string | null = null, draftSinceCheckpoint = false;
  let message = t('Automatic recovery and checkpoints are on'), kind: HistoryActivity = 'on';
  let timer: ReturnType<typeof setTimeout> | undefined, recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const notify = (value: string, next: HistoryActivity): void => { message = value; kind = next; for (const listener of listeners) listener(); };
  const allowed = (): boolean => opts.allowed?.() !== false;
  const time = (): string => new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const checkpointSaved = (): string => isTauriShell()
    ? tRaw('Checkpoint saved at {time} on this device', { time: time() })
    : tRaw('Checkpoint saved at {time} in this browser', { time: time() });
  const draftSaved = (): string => {
    if (paused) return isTauriShell()
      ? tRaw('Current work saved at {time} on this device; checkpoints paused', { time: time() })
      : tRaw('Current work saved at {time} in this browser; checkpoints paused', { time: time() });
    return isTauriShell()
      ? tRaw('Current work saved at {time} on this device', { time: time() })
      : tRaw('Current work saved at {time} in this browser', { time: time() });
  };
  const report = (error: unknown): void => {
    const first = !paused; paused = true; refusedAt = Date.now();
    notify(error instanceof Error ? error.message : t('History could not save. Your previous saved work is safe.'), 'failed');
    if (first) opts.failure?.(message);
  };
  /** History stops for this creation; saving still works. */
  const pause = (error?: unknown): void => {
    const first = !paused; paused = true;
    const reason = error instanceof Error ? ` ${error.message}` : '';
    if (first || reason) notify(`${t('History is paused for this creation.')}${reason}`, 'paused');
    if (first) opts.failure?.(message);
  };
  const recoveryFailure = (error: unknown): void => {
    notify(tRaw('Recovery could not save: {reason}', { reason: error instanceof Error ? error.message : t('keep this tab open and save an editable file.') }), 'recovery-failed');
    if (!recoveryFailed) opts.failure?.(message);
    recoveryFailed = true;
  };
  /** Freeze the live document for one write (or `data`, an explicit save's). */
  const freeze = (data?: SavedStateData): RevisionCapture => captureRevision(data ?? opts.snapshot());
  /** The state holds generation `captured`; with no newer edit, nothing waits for a draft. */
  const settleRecovered = (captured: number): void => {
    recoveredGeneration = Math.max(recoveredGeneration, captured); recoveryFailed = false;
    if (generation === captured) recoverySince = undefined;
  };
  /** A revision holds generation `captured`; with no newer edit, nothing waits at all. */
  const settleSaved = (captured: number): void => {
    savedGeneration = Math.max(savedGeneration, captured); recoveredGeneration = Math.max(recoveredGeneration, captured);
    if (generation === captured) { dirtySince = undefined; recoverySince = undefined; }
  };
  const cursorOf = async (slot: string): Promise<RevisionCursor> =>
    opts.history.current ? await opts.history.current(slot) : { head: await opts.history.head(slot), version: null };
  const fullMessage = (): string => t('History storage is full, so this save is not kept as a version. Remove older checkpoints in Settings > Storage.');
  /** Record the saved state the record holds as a saved revision, keeping the
   * record as it is. Throws when history cannot take that state. */
  const adopt = async (slot: string, cursor: RevisionCursor): Promise<void> => {
    const data = await opts.load(slot);
    if (!data || !allowed()) return;
    const capture = freeze(data);
    const entry = await opts.history.checkpoint(slot, capture.data, { reason: 'save', adopt: true, expectedHead: cursor.head, ...(opts.history.current ? { expectedVersion: cursor.version } : {}), capture });
    if (entry.skipped) { if (entry.currentVersion) version = entry.currentVersion; throw new Error(fullMessage()); }
    head = entry.id; version = entry.currentVersion ?? entry.id; neverSaved = false; skippedSave = false;
    stateJson = checkpointJson = capture.json; draftSinceCheckpoint = false;
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
      adoptPending = false; paused = false; diverged = false; refusedAt = undefined; lastSave = Date.now();
      notify(t('Automatic recovery and checkpoints are on'), 'on');
    });
    queue = task.catch(() => { /* still paused; the next save or edit tries again */ });
    return queue;
  };

  const claimSlot = (): string => {
    const slot = opts.getSlot() || `${opts.toolId}:${crypto.randomUUID()}`;
    opts.setSlot(slot); return slot;
  };
  /** Drafts wait while the record holds a save no revision has, except a save the
   * budget skipped: then they go to a protected branch beside that save. */
  const draftsWait = (): boolean => adoptPending && !skippedSave;
  const protect = async (given?: RevisionCapture, captured = generation): Promise<void> => {
    clearTimeout(recoveryTimer);
    if (!opts.history.recovery || !allowed() || generation === recoveredGeneration) return;
    if (closed || draftsWait()) return;
    if (recovering) { await queue; if (given) await protect(given, captured); return; }
    let capture: RevisionCapture;
    try { capture = given ?? freeze(); } catch (error) { recoveryFailure(error); return; }
    const slot = claimSlot();
    recovering = true;
    const task = queue.then(async () => {
      if (closed || draftsWait() || !allowed() || !initialized || captured <= recoveredGeneration) return;
      // The state already holds exactly this: no draft to write.
      if (capture.json === stateJson) {
        settleRecovered(captured);
        if (capture.json === checkpointJson && !draftSinceCheckpoint) settleSaved(captured);
        return;
      }
      const branch = adoptPending;
      const entry = await opts.history.recovery!.save(slot, capture.data, { writerId, expectedHead: head, expectedVersion: version, capture, ...(branch ? { branch: true } : {}) });
      settleRecovered(captured);
      if (branch) notify(draftSaved(), 'draft');
      else if (entry.diverged) {
        stateJson = null;
        const first = !diverged; diverged = true; paused = true;
        notify(tRaw('Another tab saved this creation. Your separate draft was protected at {time}. Open it as a copy in History.', { time: time() }), 'diverged');
        if (first) opts.failure?.(message);
      } else {
        version = entry.version; stateJson = capture.json; draftSinceCheckpoint = true; opts.saved();
        notify(draftSaved(), 'draft');
      }
    });
    queue = task.catch(recoveryFailure).finally(() => {
      recovering = false;
      if (!stopped && generation > captured && generation !== recoveredGeneration) {
        clearTimeout(recoveryTimer); recoveryTimer = setTimeout(() => { void protect(); }, 1000);
      }
    });
    await queue;
  };
  /** A checkpoint write, in turn with the others; see Written. */
  const write = (slot: string, capture: RevisionCapture, reason: RevisionEntry['reason'], captured = generation): Promise<Written> => {
    const task = queue.then(async (): Promise<Written> => {
      if (closed || adoptPending || !allowed() || !initialized || captured < recoveredGeneration) return 'none';
      if (diverged) throw new Error(t('Your edits are a separate recovery draft. Open that draft as a copy in History before saving.'));
      // The state and the head already hold exactly this: an automatic checkpoint
      // would write nothing new. An explicit save always goes through.
      if (reason === 'automatic' && capture.json === checkpointJson && capture.json === stateJson && !draftSinceCheckpoint) {
        settleSaved(captured);
        return 'none';
      }
      notify(t('Saving checkpoint…'), 'saving');
      const entry = await opts.history.checkpoint(slot, capture.data, { reason, expectedHead: head, ...(opts.history.current ? { expectedVersion: version } : {}), capture });
      opts.setSlot(slot);
      if (entry.skipped) {
        // The budget had no room for this save's revision, so the store wrote it as
        // the current state only. History waits until it can record that save.
        if (entry.currentVersion) version = entry.currentVersion;
        adoptPending = true; skippedSave = true; neverSaved = false; stateJson = capture.json;
        settleSaved(captured);
        opts.saved();
        pause(new Error(fullMessage()));
        return 'stored';
      }
      head = entry.id; version = entry.currentVersion ?? entry.id;
      settleSaved(captured);
      stateJson = checkpointJson = capture.json; draftSinceCheckpoint = false;
      lastSave = Date.now(); paused = false; refusedAt = undefined; opts.saved();
      notify(checkpointSaved(), 'checkpoint');
      // An explicit save also gets the Save action's picture (attachSaveThumbnail),
      // which arrives even after Save & leave has closed the tool; the small preview
      // below needs the tool still open.
      if (reason === 'save') lastRecordedSave = { id: entry.id, generation: captured };
      if (!stopped && generation === captured) void opts.capture().then(async thumb => {
        if (thumb && !stopped && generation === captured && allowed()) {
          await opts.history.attachPreview(entry.id, thumb); notify(message, kind);
        }
      }).catch(() => {});
      return 'recorded';
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
      if (!opts.store) throw cause ?? new Error(t('History could not save. Your previous saved work is safe.'));
      await opts.store(slot, frozen);
      adoptPending = true; neverSaved = false; stateJson = null;
      savedGeneration = Math.max(savedGeneration, captured); recoveredGeneration = Math.max(recoveredGeneration, captured);
      if (generation === captured) { dirtySince = undefined; recoverySince = undefined; }
      opts.saved();
      try {
        if (!allowed()) throw cause;
        await adopt(slot, await cursorOf(slot));
        adoptPending = false; paused = false; diverged = false; refusedAt = undefined; lastSave = Date.now();
        notify(checkpointSaved(), 'checkpoint');
      } catch (error) { pause(cause ?? error); }
      return 'stored' as const;
    });
    queue = task.catch(() => {});
    return task;
  };
  const checkpoint = async (given?: RevisionCapture, captured = generation): Promise<void> => {
    clearTimeout(timer);
    if (closed || adoptPending || !allowed() || paused || generation === savedGeneration) return;
    let capture: RevisionCapture;
    try { capture = given ?? freeze(); } catch (error) { report(error); return; }
    try { await write(claimSlot(), capture, 'automatic', captured); } catch (error) { report(error); }
  };
  const flush = async (): Promise<void> => {
    if (closed || (generation === savedGeneration && generation === recoveredGeneration)) return;
    const captured = generation;
    let capture: RevisionCapture;
    try { capture = freeze(); } catch (error) { report(error); return; }
    try {
      const protection = protect(capture, captured), commit = checkpoint(capture, captured);
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
      // A refused checkpoint is tried again on an edit a while later, in case space
      // was freed since; another refusal pauses it again.
      if (paused && refusedAt !== undefined && !diverged && !adoptPending && now - refusedAt >= CHECKPOINT_RETRY_MS) { paused = false; refusedAt = undefined; }
      if (paused) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void checkpoint(); }, Math.min(Math.max(2000, lastSave + 60_000 - now), Math.max(0, dirtySince + 60_000 - now)));
    },
    async save(slot, data) {
      clearTimeout(timer); clearTimeout(recoveryTimer); opts.setSlot(slot);
      const captured = generation;
      let cause: unknown;
      if (!adoptPending && !closed) {
        try {
          const outcome = await write(slot, freeze(data), 'save', captured);
          if (outcome === 'recorded') { neverSaved = false; return 'recorded'; }
          if (outcome === 'stored') return 'stored';
        } catch (error) { cause = error; }
      }
      // History could not record it (not started, paused for this creation, a
      // refused value, another tab): the record is still written.
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
    activity: () => kind,
    async attachSaveThumbnail(thumb) {
      const saved = lastRecordedSave;
      if (!saved || !thumb || (!stopped && generation !== saved.generation)) return;
      await opts.history.attachPreview(saved.id, thumb);
      if (!stopped) notify(message, kind);
    },
    neverSaved: () => neverSaved,
    keepsEdits: () => !closed && initialized && !paused && !adoptPending && !recoveryFailed && !!opts.history.recovery && allowed(),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { stopped = true; clearTimeout(timer); clearTimeout(recoveryTimer); clearTimeout(retryTimer); listeners.clear(); },
  };
}
