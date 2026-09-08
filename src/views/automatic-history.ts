// SPDX-License-Identifier: MPL-2.0
/** Two independent cadences, one serial writer: fast rolling recovery and sparse
 * visible checkpoints. A competing tab's edits remain a recoverable branch. */
import type { RevisionHistoryAPI, RevisionEntry } from '../bridge/revision-history.ts';
import type { SavedStateData } from '../bridge/state.ts';
import type { RevisionCursor } from '../bridge/revision-records.ts';

export interface AutomaticHistory {
  changed(): void;
  save(slot: string, data: SavedStateData): Promise<void>;
  flush(): Promise<void>;
  status(): string;
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
  saved(): void;
  failure?(message: string): void;
  allowed?(): boolean;
}): AutomaticHistory {
  let head: string | null = null, version: string | null = null;
  const writerId = crypto.randomUUID();
  let generation = 0, savedGeneration = 0, recoveredGeneration = 0, lastSave = 0;
  let dirtySince: number | undefined, recoverySince: number | undefined;
  let recovering = false, recoveryFailed = false;
  let stopped = false, paused = false, diverged = false, initialized = false;
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
  const initialSlot = opts.getSlot();
  let queue: Promise<unknown> = (async () => {
    if (!allowed()) return;
    if (initialSlot) {
      const cursor = opts.initial ?? (opts.history.current ? await opts.history.current(initialSlot) : { head: await opts.history.head(initialSlot), version: null });
      head = cursor.head; version = cursor.version;
      if (!head && !version) {
        const data = await opts.load(initialSlot);
        if (data && allowed()) {
          const entry = await opts.history.checkpoint(initialSlot, data, { reason: 'save', expectedHead: null, ...(opts.history.current ? { expectedVersion: null } : {}) });
          head = entry.id; version = entry.currentVersion ?? entry.id;
        }
      }
    }
    initialized = true;
  })().catch(report);

  const claimSlot = (): string => {
    const slot = opts.getSlot() || `${opts.toolId}:${crypto.randomUUID()}`;
    opts.setSlot(slot); return slot;
  };
  const protect = async (data?: SavedStateData, captured = generation): Promise<void> => {
    clearTimeout(recoveryTimer);
    if (!opts.history.recovery || !allowed() || generation === recoveredGeneration) return;
    if (recovering) { await queue; if (data) await protect(data, captured); return; }
    const slot = claimSlot();
    let frozen: SavedStateData;
    try { frozen = structuredClone(data ?? opts.snapshot()); } catch (error) { report(error); return; }
    recovering = true;
    const task = queue.then(async () => {
      if (!allowed() || !initialized || captured <= recoveredGeneration) return;
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
  const write = (slot: string, data: SavedStateData, reason: RevisionEntry['reason'], captured = generation): Promise<void> => {
    const frozen = structuredClone(data);
    const task = queue.then(async () => {
      if (!allowed() || !initialized || captured < recoveredGeneration) return;
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
    });
    queue = task.catch(report); return task;
  };
  const checkpoint = async (data?: SavedStateData, captured = generation): Promise<void> => {
    clearTimeout(timer);
    if (!allowed() || paused || generation === savedGeneration) return;
    try { await write(claimSlot(), data ?? opts.snapshot(), 'automatic', captured); } catch (error) { report(error); }
  };
  return {
    changed() {
      if (stopped || !allowed()) return;
      generation++;
      const now = Date.now(); dirtySince ??= now; recoverySince ??= now;
      clearTimeout(recoveryTimer);
      if (opts.history.recovery) recoveryTimer = setTimeout(() => { void protect(); }, Math.min(1000, Math.max(0, recoverySince + 5000 - now)));
      if (paused) return;
      clearTimeout(timer);
      timer = setTimeout(() => { void checkpoint(); }, Math.min(Math.max(2000, lastSave + 60_000 - now), Math.max(0, dirtySince + 60_000 - now)));
    },
    async save(slot, data) {
      clearTimeout(timer); clearTimeout(recoveryTimer); opts.setSlot(slot);
      void protect(data); await write(slot, data, 'save');
    },
    async flush() {
      if (generation === savedGeneration && generation === recoveredGeneration) return;
      try {
        const data = structuredClone(opts.snapshot()), captured = generation;
        const protection = protect(data, captured), commit = checkpoint(data, captured);
        await protection; await commit;
      } catch (error) { report(error); }
    },
    status: () => message,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { stopped = true; clearTimeout(timer); clearTimeout(recoveryTimer); listeners.clear(); },
  };
}
