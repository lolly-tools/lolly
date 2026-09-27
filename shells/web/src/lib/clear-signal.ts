// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" across tabs (plan 277 P2, review finding B6).
 *
 * The clear empties storage that every tab of the app shares: IndexedDB, Cache
 * Storage, the private file system and localStorage. A second tab that is still
 * open keeps its own memory: a cached profile, a cached sync config that says
 * sync is on, a save waiting on a timer, a push waiting to go. Before this module
 * that tab wrote the profile back after the clear, and with sync on it uploaded
 * the emptied browser over the synced copy, so other devices then removed their
 * own copies of everything.
 *
 * A clear is now a short exchange between tabs:
 *
 *   1. The clearing tab writes a new clear marker to localStorage and posts
 *      `start` on a BroadcastChannel. Every other tab answers `seen` at once,
 *      then stops writing: its database connection closes and no new one opens,
 *      host writes are refused, sync reads as off and cannot upload. It lets the
 *      writes already under way finish, and answers `ready`. The clearing tab
 *      waits (bounded) for a `ready` from every tab that said `seen` and every tab
 *      that announced itself when it opened (`hello`, answered with `here`, and
 *      `bye` when it closes), so a tab busy with a long task is waited for too,
 *      and for its own writes under way, before it empties anything.
 *   2. When the clear is over the clearing tab records the marker as done and
 *      posts `done`; every other tab reloads to the fresh state.
 *
 * The marker is the fallback for a tab that misses the message (frozen in the
 * background, or a browser without BroadcastChannel). Each tab remembers the
 * marker it started with, and every host write, every database open and every
 * sync upload compares the current one first: a tab that started before the
 * latest clear never writes again, it reloads. A tab that opens while a clear is
 * running waits for that clear to finish and then reloads.
 *
 * A leaf with no imports: bridge/db.ts loads it at boot, which is what makes the
 * marker a tab remembers the one it saw when it started. Every browser API is
 * reached through `env`, so a node test can run two tabs side by side.
 */

export const CLEAR_CHANNEL = 'lolly-clear-all';
/** The latest clear: `<start time, base 36>.<random>`. */
export const CLEAR_MARKER_KEY = 'lolly-clear-marker';
/** The latest clear that finished (the same value as the marker once it has). */
export const CLEAR_DONE_KEY = 'lolly-clear-done';

/**
 * - `live`: an ordinary tab.
 * - `clearing`: this tab is running the clear. Host writes and sync writes are
 *   refused; the clear's own steps still run.
 * - `sealed`: this tab finished its clear and is about to reload.
 * - `stale`: another tab cleared (or is clearing) the data. Nothing is written;
 *   the tab reloads when that clear is done.
 */
export type ClearPhase = 'live' | 'clearing' | 'sealed' | 'stale';

type ClearMessage =
  | { type: 'start' | 'done'; marker: string; from: string }
  | { type: 'seen' | 'ready'; marker: string; from: string; to: string }
  | { type: 'hello' | 'bye'; from: string }
  | { type: 'here'; from: string; to: string };

export interface MarkerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The slice of BroadcastChannel this module uses. */
export interface MessageChannelLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close(): void;
}

export interface ClearSignalTimings {
  /** How long the clearing tab collects `seen` answers. */
  seenMs: number;
  /** How long it then waits for every `ready`. */
  readyMs: number;
  /** How long a tab waits for its own writes under way to finish. */
  settleMs: number;
  /** How long a stale tab waits for `done` before it reloads anyway. */
  doneMs: number;
  /** A clear that started this long ago and never finished was abandoned (its tab closed). */
  abandonedMs: number;
  /** How often a stale tab re-reads the done marker, for a missed message or event. */
  pollMs: number;
}

const TIMINGS: ClearSignalTimings = { seenMs: 400, readyMs: 10_000, settleMs: 3000, doneMs: 30_000, abandonedMs: 60_000, pollMs: 500 };

export interface ClearSignalEnv {
  /** localStorage, or null where it is unavailable. */
  storage(): MarkerStorage | null;
  /** A BroadcastChannel, or null where there is none. */
  channel(name: string): MessageChannelLike | null;
  /** Subscribe to localStorage changes made by other tabs (the `storage` event). */
  onStorage(listener: (key: string | null) => void): () => void;
  now(): number;
  /** Reload this tab to the fresh state. */
  reload(): void;
  /** Empty this tab's sessionStorage and refuse further web storage writes. */
  sealStorage?(): void;
  /** The page is hidden for good or into the back/forward cache ('hide'), or shown from it ('show'). */
  onLifecycle?(listener: (event: 'hide' | 'show') => void): () => void;
  timings?: Partial<ClearSignalTimings>;
}

export interface ClearSignal {
  readonly id: string;
  phase(): ClearPhase;
  /** Another tab cleared (or is clearing) the data since this tab started. */
  clearedElsewhere(): boolean;
  /** No write of the person's data may start from this tab. */
  writesBlocked(): boolean;
  /** The shared database connection is closed for good in this tab. */
  databaseSealed(): boolean;
  /** Close the shared database connection and refuse new ones (runs the hooks once). */
  sealDatabase(): void;
  onSealDatabase(hook: () => void): () => void;
  /** Runs once this tab has stopped because of another tab's clear (the notice). */
  onStale(hook: () => void): () => void;
  /** Count a write under way, so a clear can wait for that write to finish. */
  trackWrite<T>(write: Promise<T>): Promise<T>;
  /** Wait for every counted write under way, at most `ms`. */
  settleWrites(ms?: number): Promise<void>;
  /** Start a clear: tell every other tab to stop writing and wait for them. */
  beginClear(): Promise<{ tabs: number; ready: number }>;
  /** End a clear: record it as done and let the other tabs reload. */
  finishClear(): void;
  /** localStorage keys a clear keeps, so every tab can still compare the marker. */
  keptKeys(): string[];
  /** Listen for other tabs' clears (idempotent). */
  listen(): void;
  /** Tests: stop listening and cancel timers. */
  dispose(): void;
}

const isMessage = (value: unknown): value is ClearMessage => {
  const m = value as { type?: unknown; from?: unknown; to?: unknown; marker?: unknown } | null;
  if (!m || typeof m !== 'object' || typeof m.from !== 'string') return false;
  const addressed = typeof m.to === 'string';
  const marked = typeof m.marker === 'string';
  switch (m.type) {
    case 'start': case 'done': return marked;
    case 'seen': case 'ready': return marked && addressed;
    case 'here': return addressed;
    case 'hello': case 'bye': return true;
    default: return false;
  }
};

const randomPart = (): string => Math.random().toString(36).slice(2, 10);

export function createClearSignal(env: ClearSignalEnv): ClearSignal {
  const timings: ClearSignalTimings = { ...TIMINGS, ...env.timings };
  const id = `${Date.now().toString(36)}.${randomPart()}`;
  const read = (key: string): string | null => { try { return env.storage()?.getItem(key) ?? null; } catch { return null; } };
  const write = (key: string, value: string): void => { try { env.storage()?.setItem(key, value); } catch { /* storage off */ } };
  const startedAt = (marker: string): number => parseInt(marker.split('.')[0] ?? '', 36);
  const abandoned = (marker: string): boolean => {
    const at = startedAt(marker);
    return !Number.isFinite(at) || env.now() - at > timings.abandonedMs;
  };

  let bootMarker = read(CLEAR_MARKER_KEY);
  let ownMarker: string | null = null;
  let phase: ClearPhase = 'live';
  let dbSealed = false;
  let staleHooksRan = false;
  let quiet: Promise<void> | null = null;
  let channel: MessageChannelLike | null = null;
  let listening = false;
  let unlistenStorage: (() => void) | null = null;
  let unlistenLifecycle: (() => void) | null = null;
  let waitingForDone = false;
  /** The other tabs of the app open right now, as they announced themselves. A
   *  clear waits for each of them, even one too busy to answer at once. */
  const known = new Set<string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const sealHooks = new Set<() => void>();
  const staleHooks = new Set<() => void>();
  const inbox = new Set<(message: ClearMessage) => void>();
  const pending = new Set<Promise<unknown>>();

  const later = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
    const handle = setTimeout(() => { timers.delete(handle); fn(); }, ms);
    timers.add(handle);
    return handle;
  };
  const cancel = (handle: ReturnType<typeof setTimeout>): void => { clearTimeout(handle); timers.delete(handle); };
  const sleep = (ms: number): Promise<void> => new Promise((resolve) => { later(resolve, ms); });
  const post = (message: ClearMessage): void => { try { channel?.postMessage(message); } catch { /* channel closed */ } };
  const runAll = (hooks: Set<() => void>): void => {
    for (const hook of hooks) { try { hook(); } catch { /* one hook never stops the others */ } }
  };

  function sealDatabase(): void {
    if (dbSealed) return;
    dbSealed = true;
    runAll(sealHooks);
  }

  async function settleWrites(ms = timings.settleMs): Promise<void> {
    if (!pending.size) return;
    let handle: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled([...pending]),
      new Promise<void>((resolve) => { handle = later(resolve, ms); }),
    ]);
    if (handle) cancel(handle);
  }

  /** Reload once the clear this tab stopped for is done: on the `done` message,
   *  on the storage event, on a poll of the done marker, or after `doneMs`. */
  function waitForDone(): void {
    if (waitingForDone) return;
    waitingForDone = true;
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      inbox.delete(onDone);
      unlistenDone();
      for (const handle of [...timers]) cancel(handle);
      env.reload();
    };
    const isDone = (): boolean => {
      const marker = read(CLEAR_MARKER_KEY);
      return marker !== null && read(CLEAR_DONE_KEY) === marker;
    };
    const onDone = (message: ClearMessage): void => { if (message.type === 'done') finish(); };
    inbox.add(onDone);
    const unlistenDone = env.onStorage((key) => { if ((key === CLEAR_DONE_KEY || key === null) && isDone()) finish(); });
    const poll = (): void => { if (isDone()) finish(); else later(poll, timings.pollMs); };
    later(poll, timings.pollMs);
    later(finish, timings.doneMs);
  }

  /** Stop for another tab's clear. Synchronous up to the database seal, so no
   *  write can start after this returns. */
  function enterStale(): void {
    if (phase !== 'live') return;
    phase = 'stale';
    sealDatabase();
    quiet = (async () => {
      await settleWrites();
      try { env.sealStorage?.(); } catch { /* storage off */ }
      staleHooksRan = true;
      runAll(staleHooks);
      waitForDone();
    })();
  }

  function clearedElsewhere(): boolean {
    if (phase === 'stale') return true;
    if (phase !== 'live') return false; // this tab's own clear
    const current = read(CLEAR_MARKER_KEY);
    if (current !== null && current !== bootMarker) { enterStale(); return true; }
    return false;
  }

  function onMessage(data: unknown): void {
    if (!isMessage(data) || data.from === id) return;
    for (const listener of [...inbox]) listener(data);
    if (data.type === 'hello') { known.add(data.from); post({ type: 'here', from: id, to: data.from }); return; }
    if (data.type === 'here') { if (data.to === id) known.add(data.from); return; }
    if (data.type === 'bye') { known.delete(data.from); return; }
    if (data.type !== 'start') return;
    known.add(data.from);
    const reply = (type: 'seen' | 'ready'): void => post({ type, marker: data.marker, from: id, to: data.from });
    reply('seen');
    enterStale();
    // A tab that is itself clearing, or already stopped, answers at once.
    void (quiet ?? Promise.resolve()).then(() => reply('ready'));
  }

  function listen(): void {
    if (listening) return;
    listening = true;
    channel = env.channel(CLEAR_CHANNEL);
    if (channel) channel.onmessage = (event) => onMessage(event.data);
    unlistenStorage = env.onStorage((key) => { if (key === CLEAR_MARKER_KEY) clearedElsewhere(); });
    // Announce this tab, so the others can wait for it; they answer with their own id.
    post({ type: 'hello', from: id });
    unlistenLifecycle = env.onLifecycle?.((event) => {
      if (event === 'hide') { post({ type: 'bye', from: id }); return; }
      post({ type: 'hello', from: id });
      clearedElsewhere(); // back from the back/forward cache: a clear may have run meanwhile
    }) ?? null;
  }

  async function beginClear(): Promise<{ tabs: number; ready: number }> {
    listen();
    const marker = `${env.now().toString(36)}.${randomPart()}`;
    phase = 'clearing';
    ownMarker = marker;
    bootMarker = marker;
    write(CLEAR_MARKER_KEY, marker);
    const seen = new Set<string>();
    const ready = new Set<string>();
    // Every tab that announced itself, and every tab that answered: a tab busy with
    // a long task answers late, and the clear must not start before it has stopped.
    const expected = (): Set<string> => new Set([...known, ...seen]);
    let wake: (() => void) | null = null;
    const answer = (message: ClearMessage): void => {
      if (message.type === 'bye') { wake?.(); return; }
      if (!('marker' in message) || message.marker !== marker || !('to' in message) || message.to !== id) return;
      seen.add(message.from);
      if (message.type === 'ready') ready.add(message.from);
      wake?.();
    };
    inbox.add(answer);
    try {
      post({ type: 'start', marker, from: id });
      await sleep(timings.seenMs);
      let timedOut = false;
      const deadline = later(() => { timedOut = true; wake?.(); }, timings.readyMs);
      while (!timedOut && [...expected()].some((tab) => !ready.has(tab))) {
        await new Promise<void>((resolve) => { wake = resolve; });
        wake = null;
      }
      cancel(deadline);
    } finally {
      inbox.delete(answer);
    }
    await settleWrites();
    return { tabs: expected().size, ready: ready.size };
  }

  function finishClear(): void {
    if (phase !== 'clearing' || !ownMarker) return;
    phase = 'sealed';
    write(CLEAR_DONE_KEY, ownMarker);
    post({ type: 'done', marker: ownMarker, from: id });
  }

  // A clear that is running as this tab starts: stop now, reload when it is done.
  // One that started long ago and never finished was abandoned, and stops nobody.
  if (bootMarker !== null && read(CLEAR_DONE_KEY) !== bootMarker && !abandoned(bootMarker)) enterStale();

  return {
    id,
    phase: () => phase,
    clearedElsewhere,
    writesBlocked: () => phase !== 'live' || clearedElsewhere(),
    databaseSealed: () => dbSealed || clearedElsewhere(),
    sealDatabase,
    onSealDatabase(hook) {
      sealHooks.add(hook);
      if (dbSealed) { try { hook(); } catch { /* as above */ } }
      return () => { sealHooks.delete(hook); };
    },
    onStale(hook) {
      staleHooks.add(hook);
      if (staleHooksRan) { try { hook(); } catch { /* as above */ } }
      return () => { staleHooks.delete(hook); };
    },
    trackWrite(write) {
      pending.add(write);
      const drop = (): void => { pending.delete(write); };
      write.then(drop, drop);
      return write;
    },
    settleWrites,
    beginClear,
    finishClear,
    keptKeys: () => [CLEAR_MARKER_KEY, CLEAR_DONE_KEY],
    listen,
    dispose() {
      for (const handle of [...timers]) cancel(handle);
      inbox.clear();
      post({ type: 'bye', from: id });
      unlistenStorage?.();
      unlistenStorage = null;
      unlistenLifecycle?.();
      unlistenLifecycle = null;
      known.clear();
      try { channel?.close(); } catch { /* already closed */ }
      channel = null;
      listening = false;
    },
  };
}

/**
 * Refuse every web storage write in this page from now on. Only for a page that
 * is about to reload after a clear: a view that saves a preference on the way out
 * (theme, sidebar width) would otherwise write a key back into the cleared
 * localStorage, and the fresh app would start with that key. Reads still work, so the
 * marker stays readable. Patching the prototype (not the instance) is deliberate:
 * a Storage object turns an assigned property into a stored key.
 */
export function sealWebStorage(): void {
  const proto = (globalThis as { Storage?: { prototype: object } }).Storage?.prototype;
  if (!proto) return;
  for (const name of ['setItem', 'removeItem', 'clear']) {
    try { Object.defineProperty(proto, name, { value: function refused(): void { /* sealed until reload */ }, configurable: true, writable: true }); }
    catch { /* a locked-down realm keeps its storage; the database seal still holds */ }
  }
}

function browserEnv(): ClearSignalEnv {
  return {
    storage: () => { try { return globalThis.localStorage ?? null; } catch { return null; } },
    channel: (name) => {
      if (typeof BroadcastChannel === 'undefined') return null;
      try {
        const channel: BroadcastChannel & { unref?(): void } = new BroadcastChannel(name);
        // Node (the test runner) keeps a process alive for an open channel; a browser has no unref.
        channel.unref?.();
        // The channel's own handler hands each message on, so the signal sees only `data`.
        const like: MessageChannelLike = { postMessage: (message) => channel.postMessage(message), onmessage: null, close: () => channel.close() };
        channel.onmessage = (event) => like.onmessage?.(event);
        return like;
      } catch { return null; }
    },
    onStorage: (listener) => {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
      const handler = (event: StorageEvent): void => {
        let local: Storage | null = null;
        try { local = globalThis.localStorage; } catch { /* storage off */ }
        if (event.storageArea === null || event.storageArea === local) listener(event.key);
      };
      window.addEventListener('storage', handler);
      return () => window.removeEventListener('storage', handler);
    },
    now: () => Date.now(),
    reload: () => {
      if (typeof location === 'undefined') return;
      // Land on the gallery, as the tab that ran the clear does: a hash that points
      // at a saved creation would point at something that is gone.
      try { history.replaceState(null, '', location.pathname + location.search); } catch { /* keep the hash */ }
      location.reload();
    },
    sealStorage: () => {
      try { globalThis.sessionStorage?.clear(); } catch { /* storage off */ }
      sealWebStorage();
    },
    onLifecycle: (listener) => {
      if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
      const hide = (): void => listener('hide');
      const show = (event: PageTransitionEvent): void => { if (event.persisted) listener('show'); };
      window.addEventListener('pagehide', hide);
      window.addEventListener('pageshow', show);
      return () => { window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); };
    },
  };
}

/** This tab's signal. Created when bridge/db.ts first loads, at boot. */
export const clearSignal: ClearSignal = createClearSignal(browserEnv());
if (typeof window !== 'undefined' && typeof document !== 'undefined') clearSignal.listen();
