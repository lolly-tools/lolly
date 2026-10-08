// SPDX-License-Identifier: MPL-2.0
/** Work-room provider: reliable edits and durable receipts, plus ephemeral presence.
 * Each queued operation has a persisted delivery identity. Chunking and reconnect
 * retain it; only explicit accepted/rejected receipts retire it. Socket writes,
 * peer echoes and room clocks never mean saved. Legacy servers join read-only.
 * The adapter and presence interface remain separate from private P2P transport.
 */

import {
  ReferenceCanvasDoc,
  isCompatibleOpVersion,
} from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness,
  CanvasDocState,
  CanvasOp,
  CanvasSyncAdapter,
  Damage,
  BoxId,
  BoxRow,
} from '@lolly-tools/core/canvas-op-v1';
import { ABUSE_REASONS } from '../collab/op-guard.ts';
import type { OpGuard } from '../collab/op-guard.ts';
import { getCollabClientId, initCollabClientId } from '../lib/collab-plumbing.ts';
import type { CollabHistoryCapability } from '../lib/collab-history.ts';
import {
  COLLAB_CLOSE,
  COLLAB_OP_VERSION,
  MAX_OPS_PER_FRAME,
  COLLAB_WS_PATH,
  SOCKET_OPEN,
  chunkOps,
  collabSocketUrl,
  docStateToOps,
  docStateToWire,
  checkpointOps,
  heldKeyIndex,
  isCrossOriginSocket,
  isTerminalClose,
  parseServerFrame,
  sanitizeOps,
  withoutHeldKeys,
} from './collab-protocol.ts';
import { createWorkClaims } from './collab-claims.ts';
import { claimCoversOp } from '@lolly-tools/core/canvas-interaction-v1';
import type { CanvasClaimCapability } from '../lib/canvas-interaction.ts';
import type {
  ClientFrame,
  CollabPresencePayload,
  CollabRole,
  CollabSocket,
  CollabSocketCtor,
  JoinAckFrame,
  RosterEntry,
  ServerFrame,
} from './collab-protocol.ts';

// ── Public shapes ─────────────────────────────────────────────────────────────

export type WorkCollabStatus =
  | 'idle'          // created, never connected
  | 'connecting'    // socket opening
  | 'joining'       // socket open, join sent, ack outstanding
  | 'live'          // joined
  | 'reconnecting'  // dropped, backoff timer armed
  | 'closed';       // closed by us, or ended by a typed close

export interface WorkCollabState {
  readonly status: WorkCollabStatus;
  readonly role: CollabRole;
  /** The OTHER members. The gateway excludes self on purpose (section 4.7's orphan ghost);
   *  this device's own seat is `self`. */
  readonly roster: readonly RosterEntry[];
  /** This device's seat as the gateway assigned it, when the `join-ack` said. */
  readonly self?: RosterEntry;
  /** Consecutive failed connection attempts - the backoff exponent. Reset on join. */
  readonly attempt: number;
  /** Operations waiting for an explicit durable receipt, including socket writes. */
  readonly pending: number;
  readonly localSaveFailed?: boolean;
  /** The whole durable journal, delivered or not (`pending` ≤ `queued`). */
  readonly queued: number;
  /** Input ids the gateway cannot sync in this session, so a UI can show them
   *  read-only instead of letting two people diverge on them silently. */
  readonly unsynced: readonly string[];
  /** Why the session ended / degraded, when the gateway said. */
  readonly reason?: string;
}

export type WorkCollabEvent =
  | { readonly kind: 'recovery'; readonly id: string; readonly ops: readonly CanvasOp[] }
  | { readonly kind: 'state'; readonly state: WorkCollabState }
  /** Ops for the runtime: remote peers' ops, and the `join-ack` snapshot seed.
   *  Never this device's own ops. Feed straight into `attachCollabPlumbing`'s
   *  `applyRemotePatch` - it coalesces per frame and applies atomically. */
  | { readonly kind: 'ops'; readonly from: string; readonly ops: readonly CanvasOp[]; readonly snapshot?: boolean }
  /** An inbound presence payload, forwarded verbatim - cast it to whatever the
   *  presence engine expects (`PresenceFrame` in lib/collab-presence.ts). See
   *  `CollabPresencePayload` for why this lane is opaque here. */
  | { readonly kind: 'presence'; readonly from: string; readonly frame: CollabPresencePayload }
  | { readonly kind: 'peer-join'; readonly peer: RosterEntry | null; readonly roster: readonly RosterEntry[] }
  /** `id` is the departing CONNECTION id (what the gateway sends); `userId` is the
   *  principal, resolved from the roster entry it removed, when one matched. */
  | {
      readonly kind: 'peer-leave';
      readonly id: string;
      readonly userId?: string;
      readonly roster: readonly RosterEntry[];
    }
  /** A sender-only gateway error. A locked-input veto names every input it refused
   *  in `inputs`; `inputId` is the first, for callers that only show one. */
  | {
      readonly kind: 'error';
      readonly code: string;
      readonly inputId?: string;
      readonly inputs?: readonly string[];
      readonly message?: string;
    }
  /** The outbox hit its cap and shed its oldest entries. Surfaced, never silent. */
  | { readonly kind: 'warning'; readonly code: 'outbox-overflow'; readonly dropped: number };

/** The IndexedDB slice the outbox needs. Injected in tests; the default is the
 *  shell's own 'profile' KV store, reached lazily (see `defaultOutboxStore`). */
export interface CollabOutboxStore {
  load(key: string): Promise<CanvasOp[] | null>;
  save(key: string, ops: readonly CanvasOp[]): Promise<void>;
  clear(key: string): Promise<void>;
}

export interface WorkCollabOptions {
  /** Optional authoritative revision capability supplied by the Work opener. */
  history?: CollabHistoryCapability;
  /** This device's collab client id (plan 100 section 5). Defaults to the persisted ULID. */
  clientId?: string;
  /**
   * The org principal this session belongs to (`OrgUser.sub`), which partitions the
   * durable outbox. REQUIRED in practice on any shared device: without it two
   * people who sign into the same browser share one outbox key, and the second one
   * to open the session replays the first one's unsent ops over their OWN
   * authenticated socket - the gateway audits those edits as the second user
   * (`user:${ctx.user.id}`), and `op.origin.client` is the shared device id, so
   * nothing downstream could tell. `org/index.ts` passes it when it registers the
   * factory.
   */
  principal?: string;
  /** Instance base the session lives on - the other half of the outbox partition,
   *  so pointing the shell at a different deployment cannot resurrect a foreign
   *  room's queue. Defaults to `lib/instance.ts`'s configured base (or, when `url`
   *  is given, that endpoint's origin). */
  instanceBase?: string;
  /** WebSocket constructor - injected by tests, defaults to the platform one. */
  socket?: CollabSocketCtor;
  /** Explicit endpoint, bypassing instance-base derivation (tests; and an escape
   *  hatch for a deployment that terminates the gateway elsewhere). */
  url?: string;
  /** Page URL the relative endpoint resolves against. Defaults to `location.href`. */
  href?: string;
  /** Jitter source - injected so the backoff schedule is assertable. */
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  store?: CollabOutboxStore;
  /** Soft operation cap. Preserve the gesture that crosses it and pause further edits. */
  outboxLimit?: number;
  /** Reconnect automatically after a non-terminal drop. Default true. */
  reconnect?: boolean;
  /**
   * The inbound boundary (plan 100 section 11.21) for peer-authored ops BEFORE they reach
   * `doc` - this file's own `CanvasSyncAdapter`, handed out verbatim as
   * `handle.adapter` (`org/collab-handle.ts`'s header). Build it from the mounted
   * tool's declared inputs: `createOpGuard({ inputs: runtime.getModel() })`. Only
   * the caller knows them; this transport does not, and never will (a manifest
   * whitelist belongs to whoever mounted a tool, not to the socket).
   *
   * Mirrors `collab/rtc-handle.ts`'s own `guard` option, and for an identical
   * reason stated there: without one, this module still refuses to write anything
   * structurally unchecked (schema-valid, safe-integer clock, no forbidden key - 
   * see `floorFilter`), but that is a FLOOR, never a whitelist - no value-size cap,
   * no check that a `param` key is even a DECLARED input. `lib/collab-plumbing.ts`'s
   * `buildPatch` reads a converged key's value out of `doc.state()` the moment ANY
   * later op touches it (`ConvergedRead` - deliberate: two peers' MODELS must not
   * diverge while their documents agree). That is what makes a second, LATER guard
   * (`createCollabSession`'s own, over `session.applyRemotePatch`) insufficient on
   * its own: if THIS write already poisoned the register, a later legitimate op on
   * the same key promotes the poison into the runtime regardless of its own guard
   * verdict. Passing the SAME manifest-derived guard here closes that - the two
   * must agree, which is exactly what building both from the same
   * `runtime.getModel()` guarantees.
   */
  guard?: OpGuard | null;
}

/** Keys that are never data, whatever a manifest says. Mirrors `op-guard.ts`'s
 *  private `FORBIDDEN_KEYS` - duplicated rather than imported, the same call
 *  `collab/rtc-handle.ts` makes for its own copy (their header explains why: this
 *  file and the guard's home deliberately do not depend on each other beyond the
 *  guard TYPE itself). */
const FORBIDDEN_OP_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Own-key check for the guardless floor - mirrors `rtc-handle.ts`'s
 *  `hasForbiddenName` exactly (same three names, same op shapes). */
function hasForbiddenOpName(op: CanvasOp): boolean {
  if (op.k === 'param') return FORBIDDEN_OP_KEYS.has(op.key);
  if (op.col !== undefined && FORBIDDEN_OP_KEYS.has(op.col)) return true;
  if (op.k === 'field') return FORBIDDEN_OP_KEYS.has(op.field);
  if (op.k === 'add') return Object.keys(op.row).some((field) => FORBIDDEN_OP_KEYS.has(field));
  return false;
}

/** Numbers the schema lets through unbounded: `type:'number'` is a `typeof` test,
 *  so NaN and Infinity are numbers, and `Infinity % 1` is NaN so `type:'integer'`
 *  passes too. Mirrors `rtc-handle.ts`'s `hasNonFiniteNumber`. */
function hasNonFiniteOpNumber(op: CanvasOp): boolean {
  if (!Number.isFinite(op.origin.clock)) return true;
  if (op.k === 'geom') {
    return Object.values(op.fields).some((v) => typeof v === 'number' && !Number.isFinite(v));
  }
  if (op.k === 'field' || op.k === 'param') return typeof op.value === 'number' && !Number.isFinite(op.value);
  if (op.k === 'add') {
    return Object.values(op.row).some((v) => typeof v === 'number' && !Number.isFinite(v));
  }
  return false;
}

/**
 * The floor when no manifest-aware `guard` was supplied (see `WorkCollabOptions
 * .guard`). `sanitizeOps` (collab-protocol.ts) has already proven each entry
 * satisfies `isCanvasOp`'s SHAPE gate before this runs; what is added here is the
 * safe-integer clock and forbidden-key checks that gate cannot make (it has no
 * model, and no own-property whitelist is possible without one) - exactly
 * `collab/rtc-handle.ts`'s `checkWithoutGuard`, same floor, same reasoning.
 */
function floorFilter(ops: readonly CanvasOp[]): CanvasOp[] {
  const ok: CanvasOp[] = [];
  for (const op of ops) {
    if (!Number.isSafeInteger(op.origin.clock) || op.origin.clock < 0) continue;
    if (hasForbiddenOpName(op)) continue;
    if (hasNonFiniteOpNumber(op)) continue;
    ok.push(op);
  }
  return ok;
}

/** One saved review write in this room: the thread and its new revision, never its text. */
export interface WorkCollabReviewEvent { readonly threadId: string; readonly revision: number }

export interface WorkCollabHandle {
  readonly claims?: CanvasClaimCapability;
  /**
   * Saved comment writes announced by the gateway (`comment` frames, plan 76 milestone 4),
   * per provider. org/collab-work-opener.ts hands it to the comments capability as its
   * `changes`, so the comments panel fetches only the thread that changed. Listeners
   * are released by `close()`.
   */
  readonly reviewEvents?: { subscribe(fn: (event: WorkCollabReviewEvent) => void): () => void };
  recovery?(): { id: string; ops: readonly CanvasOp[] } | undefined;
  recoveries?(): readonly { id: string; ops: readonly CanvasOp[] }[];
  readonly clientId?: string;
  readonly sessionId: string;
  readonly history?: CollabHistoryCapability;
  /** Register this into `lib/canvas-sync-provider.ts`. */
  readonly adapter: CanvasSyncAdapter;
  /** Current validated projection, including the Lamport floor for a late mount. */
  snapshot?(): { ops: readonly CanvasOp[]; clock: number };
  /** Open the socket (loading the persisted outbox first). Resolves once the socket
   *  has been constructed - NOT once joined; watch the state events for that. */
  connect(): Promise<void>;
  /** End the session: send `leave`, drop every socket handler, clear every timer. */
  close(): void;
  state(): WorkCollabState;
  /** Subscribe to state/ops/presence/roster/error/warning events. */
  on(listener: (event: WorkCollabEvent) => void): () => void;
  /** Hand ONE outbound presence payload to the lane, verbatim. The caller owns
   *  cadence (lib/collab-presence.ts throttles to 50 ms and goes silent when alone
   * - plan 100 section 4.7); this only writes it. Dropped, never queued, when not live:
   *  presence is ephemeral by definition. Open to observers (section 7.5). */
  sendPresence(frame: CollabPresencePayload): void;
  /** The durable journal, oldest first - every local op not yet retired, delivered
   *  or not (diagnostics + tests). `state().pending` counts work without a durable receipt. */
  outbox(): readonly CanvasOp[];
  /** Resolves when every queued outbox write has hit the store (tests). */
  persisted(): Promise<void>;
}

export type WorkCollabFactory = (sessionId: string, opts?: WorkCollabOptions) => WorkCollabHandle;

// ── Tunables ──────────────────────────────────────────────────────────────────

const OUTBOX_LIMIT = 500;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
/** Fraction of each step the jitter may subtract. Downward, so the schedule stays
 *  inside the documented 1 s..30 s band instead of overshooting the ceiling. */
const RECONNECT_JITTER = 0.25;

/** Key prefix of one session's outbox inside the 'profile' KV store - the
 *  small-IDB idiom lib/instance.ts and lib/collab-plumbing.ts already use (their
 *  'instance-base' / 'collab-client-id' keys are siblings of this one). A dedicated
 *  object store would be tidier, but it costs a DB version bump plus a migration for
 *  every user on the fleet, and this is a small, per-session, evictable record. */
const OUTBOX_KEY_PREFIX = 'collab-outbox:';

/** FNV-1a, 32-bit. Not a hash for secrecy - the scope tag is a PARTITION, keeping
 *  one principal's queue off another's key, and a short stable digest keeps a
 *  principal id and an instance URL out of a store other code enumerates. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, '0');
}

/**
 * The IDB key one session's outbox lives under. Scoped by (instance base,
 * principal) as well as session, because the 'profile' store is origin-wide and
 * shared across everyone who signs into this browser - see `WorkCollabOptions
 * .principal` for the cross-user replay this prevents. Exported so a caller (and
 * the tests) can name the exact key rather than reconstruct the digest.
 */
export function collabOutboxKey(
  sessionId: string,
  scope: { base?: string; principal?: string } = {},
): string {
  return `${OUTBOX_KEY_PREFIX}${fnv1a(`${scope.base ?? ''}\n${scope.principal ?? ''}`)}:${sessionId}`;
}

/**
 * A box id no real row can carry - `lib/row-id.ts` mints base-36 ULIDs and a tool's
 * blocks rows key off input ids, neither of which can contain a NUL. See
 * `primeClock` for what it anchors.
 */
const CLOCK_ANCHOR_ID = '\u0000lolly:clock';

/** `state().reason` when the derived endpoint is not same-origin - see
 *  collab-protocol.ts's header for why that can never authenticate. */
export const CROSS_ORIGIN_REASON = 'cross-origin-instance';

/**
 * A schema-valid origin for projection operations. Checkpoint projections carry
 * clock zero and do not replace the document's original register origins.
 */
const SEED_CLIENT = 'lw:seed';

/**
 * Backoff for attempt `n` (1-based): 1s, 2s, 4s, … capped at 30s, with up to 25%
 * subtracted by the injected jitter source and never dropping below the 1 s floor.
 * Pure and exported so the schedule is a test, not a stopwatch.
 */
export function backoffDelay(attempt: number, random: () => number): number {
  const step = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** Math.max(0, attempt - 1));
  const jittered = Math.round(step * (1 - RECONNECT_JITTER * clamp01(random())));
  return Math.min(RECONNECT_MAX_MS, Math.max(RECONNECT_MIN_MS, jittered));
}

// Not lib/util/number.ts's clamp01: a non-finite input reads as 0 here rather than
// passing NaN on into a stored outbox record.
function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// ── The default (real) outbox store ───────────────────────────────────────────

/**
 * Reads/writes the 'profile' KV store. `bridge/db.ts` is imported LAZILY, exactly as
 * `initCollabClientId` does it: a static import would drag `idb` into whatever chunk
 * loads this module (and into its DOM-free unit tests, which never touch a store at
 * all - they inject their own). Every method is failure-tolerant: a durability
 * problem must never cost the user their edit, so it degrades to an in-memory outbox.
 */
/** Merge each tab's pending IDs in one IndexedDB transaction. A tab may only
 * remove IDs it previously loaded or saved; other tabs' edits remain recoverable. */
export function defaultOutboxStore(): CollabOutboxStore {
  const known = new Map<string, Set<string>>();
  const db = async () => (await import('../bridge/db.ts')).openDB();
  const read = (value: unknown): Queued['op'][] => sanitizeOps(value).map(op => ({ ...op,
    deliveryId: (op as Queued['op']).deliveryId ?? globalThis.crypto.randomUUID() }));
  async function replace(key: string, ops: readonly CanvasOp[]): Promise<void> {
    const tx = (await db()).transaction('profile', 'readwrite');
    const previous = read(await tx.store.get(key));
    const owned = known.get(key) ?? new Set<string>();
    const merged = new Map(previous.filter(op => !owned.has(op.deliveryId!)).map(op => [op.deliveryId!, op]));
    const next = read(ops);
    for (const op of next) merged.set(op.deliveryId!, op);
    if (merged.size) await tx.store.put([...merged.values()], key);
    else await tx.store.delete(key);
    await tx.done;
    known.set(key, new Set(next.map(op => op.deliveryId!)));
  }
  return {
    async load(key) {
      const tx = (await db()).transaction('profile', 'readwrite');
      const ops = read(await tx.store.get(key));
      if (ops.length) await tx.store.put(ops, key); // Upgrade legacy IDs atomically.
      await tx.done;
      known.set(key, new Set(ops.map(op => op.deliveryId!)));
      return ops.length ? ops : null;
    },
    save: replace,
    clear: key => replace(key, []),
  };
}


interface Queued {
  readonly op: CanvasOp & { deliveryId?: string; claimId?: string };
  /** Written to an open socket at least once. See the header's retirement rules. */
  sent: boolean;
  saved: boolean;
}

export function createWorkCollabProvider(sessionId: string, opts: WorkCollabOptions = {}): WorkCollabHandle {
  const clientId = opts.clientId ?? `${getCollabClientId()}:${globalThis.crypto.randomUUID()}`;
  const store = opts.store ?? defaultOutboxStore();
  const limit = Math.max(1, opts.outboxLimit ?? OUTBOX_LIMIT);
  const random = opts.random ?? Math.random;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const autoReconnect = opts.reconnect !== false;

  /** The local convergence document. Rebuilt on every `join-ack` (see seedFrom). */
  let doc = new ReferenceCanvasDoc(clientId);
  /** Highest clock this device has ever minted or observed - the Lamport floor a
   *  rebuilt document is primed to, so a reconnect cannot re-mint a used pair. */
  let clockCeiling = 0;
  let durableReceipts = false;

  let status: WorkCollabStatus = 'idle';
  let role: CollabRole = 'writer';
  let roster: readonly RosterEntry[] = [];
  let self: RosterEntry | undefined;
  let unsynced: readonly string[] = [];
  let reason: string | undefined;
  let attempt = 0;

  let sock: CollabSocket | null = null;
  let timer: unknown = null;
  let loaded = false;
  let opening = false;
  let connecting: Promise<void> | null = null;
  /** The handle has been torn down by `close()`. */
  let ended = false;
  /** The session is OVER - `close()`, or a typed close the gateway answered with.
   *  A terminal close must stop the journal growing just as surely as close() does,
   *  or every later edit is persisted forever with no transport that can drain it. */
  let dead = false;

  const outbox: Queued[] = [];
  const listeners = new Set<(event: WorkCollabEvent) => void>();
  const reviewListeners = new Set<(event: WorkCollabReviewEvent) => void>();

  let persistChain: Promise<void> = Promise.resolve();
  let dirty = false;
  let localSaveFailed = false;
  let outboxReadFailed = false;
  let outboxKey: string | null = null;
  let recovery: { id: string; ops: readonly CanvasOp[] } | undefined;
  let recoveryArchives: CanvasOp[] = [];
  const recoveries: { id: string; ops: readonly CanvasOp[] }[] = [];
  let recoveryChain: Promise<void> = Promise.resolve();
  let savingRecovery = false;
  const archivedReceipts = new WeakSet<object>();
  const recoveryFrames: ServerFrame[] = [];

  // - events - 

  function emit(event: WorkCollabEvent): void {
    for (const fn of [...listeners]) {
      // A subscriber's bug must not take the transport down with it.
      try { fn(event); } catch (e) { console.warn('[lolly:collab] listener', e); }
    }
  }

  function pendingCount(): number { return outbox.length; }

  function snapshotState(): WorkCollabState {
    return {
      status,
      role,
      roster,
      attempt,
      pending: pendingCount(),
      ...(localSaveFailed ? { localSaveFailed: true } : {}),
      queued: outbox.length,
      unsynced,
      ...(self ? { self } : {}),
      ...(reason ? { reason } : {}),
    };
  }

  function emitState(): void {
    emit({ kind: 'state', state: snapshotState() });
  }

  function setStatus(next: WorkCollabStatus): void {
    if (status === next) return;
    status = next;
    emitState();
  }

  // - outbox - 

  /**
   * The (instance, principal, session) key this journal lives under. Resolved once,
   * lazily: with an explicit `url` the endpoint's origin IS the scope, so no module
   * has to be loaded at all; otherwise `lib/instance.ts` is reached the same way
   * `endpoint()` reaches it, and an unreadable base degrades to the unscoped
   * default rather than losing the journal.
   */
  async function keyFor(): Promise<string> {
    if (outboxKey !== null) return outboxKey;
    outboxKey = collabOutboxKey(sessionId, { base: await resolveBase(), principal: opts.principal });
    return outboxKey;
  }

  /**
   * The instance base this session lives on: injected, else the explicit `url`'s
   * origin, else `lib/instance.ts`'s configured base. Lazy so this module stays
   * importable without `idb` (lib/instance.ts reaches bridge/db.ts, which does), and
   * so the dormant registration path in org/index.ts costs nothing on a build with
   * no control plane. An unreadable base degrades to same-origin rather than
   * throwing - the caller has a socket to open either way.
   */
  async function resolveBase(): Promise<string> {
    if (opts.instanceBase !== undefined) return opts.instanceBase;
    if (opts.url) {
      try { return new URL(opts.url).origin; } catch { return opts.url; }
    }
    try {
      const { getInstanceBase } = await import('../lib/instance.ts');
      return getInstanceBase();
    } catch {
      return '';
    }
  }

  function persist(): void {
    if (outboxReadFailed) return;
    dirty = true;
    persistChain = persistChain.then(async () => {
      if (!dirty) return;
      dirty = false;
      const key = await keyFor();
      const entries = [...outbox];
      if (entries.length) await store.save(key, entries.map((e) => e.op));
      else await store.clear(key);
      for (const entry of entries) entry.saved = true;
      if (status === 'live' && !ended) postEntries(outbox.filter(e => !e.sent));
      if (localSaveFailed) { localSaveFailed = false; emitState(); }
    }).catch(() => { localSaveFailed = true; emitState(); emit({ kind: 'error', code: 'local-save-failed', message: 'Pending edits could not be saved on this device. Keep the session open or save a copy.' }); });
  }

  /** Preserve queued work at capacity and stop admitting further local writes. */
  function trim(): void {
    if (outbox.length <= limit) return;
    role = 'observer'; reason = 'outbox-full';
    emit({ kind: 'warning', code: 'outbox-overflow', dropped: 0 });
    emitState();
  }

  function enqueue(ops: readonly CanvasOp[]): void {
    // An observer's writes are not durable and never reach the wire: the gateway
    // would refuse them, so persisting them would only replay a refusal forever.
    // A dead session's writes have nowhere to go at all.
    if (role === 'observer' || dead || !ops.length) return;
    for (const op of ops) {
      const claim = claims.list().find(c => c.owner === self?.id && claimCoversOp(c.target, op));
      outbox.push({ op: { ...op, deliveryId: (op as Queued['op']).deliveryId ?? globalThis.crypto.randomUUID(),
        ...(claim ? { claimId: claim.id } : {}) }, sent: false, saved: false });
    }
    trim();
    persist();
  }

  function post(frame: ClientFrame): boolean {
    const s = sock;
    if (!s || (s.readyState !== undefined && s.readyState !== SOCKET_OPEN)) return false;
    try {
      s.send(JSON.stringify(frame));
      return true;
    } catch (e) {
      console.warn('[lolly:collab] send', e);
      return false;
    }
  }
  const claims = createWorkClaims(frame => status === 'live' && post(frame));

  // `sent` tracks this socket delivery only. A durable receipt retires an entry.
  const wireOp = (op: Queued['op']): CanvasOp => { const { deliveryId: _id, claimId: _claim, ...value } = op; return value as CanvasOp; };
  const inflight = new Map<string, Set<string>>();
  let windowOps = 0, windowUntil = 0;
  let pumpTimer: unknown = null;
  const stopPump = (): void => { if (pumpTimer !== null) clearTimer(pumpTimer); pumpTimer = null; };
  const deferPump = (): void => {
    if (pumpTimer !== null) return;
    pumpTimer = setTimer(() => {
      pumpTimer = null; windowOps = 0; windowUntil = Date.now() + 1050;
      if (status === 'live' && !ended) postEntries(outbox.filter(e => !e.sent));
    }, Math.max(1, windowUntil - Date.now()));
  };
  function postEntries(pending: readonly Queued[]): Queued[] {
    const entries = pending.filter(entry => entry.saved);
    const delivered: Queued[] = [];
    if (!durableReceipts || !entries.length) return delivered;
    let i = 0;
    if (Date.now() >= windowUntil) { windowOps = 0; windowUntil = Date.now() + 1050; }
    const groups: Queued[][] = [];
    for (const entry of entries) {
      const last = groups[groups.length - 1];
      if (last && last[0]!.op.claimId === entry.op.claimId) last.push(entry);
      else groups.push([entry]);
    }
    for (const chunk of groups.flatMap(group => chunkOps(group.map(e => wireOp(e.op))))) {
      if (windowOps + chunk.length > MAX_OPS_PER_FRAME) { deferPump(); return delivered; }
      const ids = entries.slice(i, i + chunk.length).map(e => e.op.deliveryId!);
      const batchId = `${ids[0]}:${ids[ids.length - 1]}`;
      inflight.set(batchId, new Set(ids));
      const claimId = entries[i]?.op.claimId;
      if (!post({ t: 'ops', batchId, ids, ops: chunk, ...(claimId ? { claimId } : {}) })) { inflight.delete(batchId); return delivered; }
      windowOps += chunk.length;
      for (let n = 0; n < chunk.length; n++) {
        const entry = entries[i + n]!;
        entry.sent = true;
        delivered.push(entry);
      }
      i += chunk.length;
    }
    return delivered;
  }

  function sendOps(ops: readonly CanvasOp[]): void {
    if (!ops.length) return;
    for (const op of ops) observe(op.origin.clock);
    if (role === 'observer' || dead) return;
    enqueue(ops);
    emitState();
    // Persist owns the send: an edit arriving during an IndexedDB write must
    // wait for the transaction that actually contains its immutable ID.
  }

  function observe(clock: number): void {
    if (Number.isFinite(clock) && clock > clockCeiling) clockCeiling = clock;
  }

  /**
   * Admit inbound peer-authored ops through the boundary (section 11.21) BEFORE they can
   * reach `doc` - see `WorkCollabOptions.guard`'s comment for why this has to run
   * here rather than only downstream, at `session.applyRemotePatch`. `ops` has
   * already passed `sanitizeOps`'s structural gate (`isCanvasOp`, collab-
   * protocol.ts); what happens here is either the full manifest-aware check (a
   * caller-supplied `guard`) or the guardless floor (`floorFilter`).
   *
   * `checkOps`'s own contract already discards the WHOLE message on an ABUSE-class
   * rejection rather than the one op that tripped it (its own comment: "the two
   * decisions must not be able to disagree at the call site"), so `result.ok` is
   * already the right thing to write regardless of which reason fired.
   */
  function admitInbound(ops: CanvasOp[]): CanvasOp[] {
    if (!ops.length) return ops;
    const active = opts.guard;
    if (!active) return floorFilter(ops);
    const result = active.checkOps(ops);
    for (const rejection of result.rejected) {
      const abuse = ABUSE_REASONS.has(rejection.reason) ? ' (abuse)' : '';
      console.warn(`[lolly:collab] op refused${abuse}`, rejection);
    }
    return result.ok;
  }

  function sendPresence(frame: CollabPresencePayload): void {
    if (status === 'live') post({ t: 'presence', frame });
  }

  // - join - 

  function join(): void {
    setStatus('joining');
    post({ t: 'join', opVersion: COLLAB_OP_VERSION, presenceVersion: 1, receipts: 1, interactionVersion: 1 });
  }

  /** Keep the local Lamport clock above every observed edit after rebuilding. */
  function primeClock(target: ReferenceCanvasDoc, floor: number): void {
    if (!(floor > 0)) return;
    target.apply({ k: 'remove', id: CLOCK_ANCHOR_ID, origin: { client: clientId, clock: floor } });
  }

  /**
   * Restore the gateway document and replay remaining outbox operations. The
   * mounted runtime receives a separate authoritative projection, not a delta.
   */
  function seedFrom(frame: JoinAckFrame): CanvasOp[] {
    const serverClock = Number.isFinite(frame.serverClock) ? Number(frame.serverClock) : 0;
    observe(serverClock);
    if (frame.checkpoint) {
      const registers = checkpointOps(frame.checkpoint);
      if (!registers) throw new Error('Invalid room checkpoint');
      for (const chunk of chunkOps(registers)) if (admitInbound(chunk).length !== chunk.length) throw new Error('Rejected room checkpoint');
      const previous = doc.state();
      doc = new ReferenceCanvasDoc(clientId); doc.restore(frame.checkpoint);
      primeClock(doc, Math.max(clockCeiling, frame.checkpoint.clock));
      for (const entry of outbox) doc.apply(entry.op);
      const state = doc.state(), origin = { client: SEED_CLIENT, clock: 0 };
      const seed = docStateToOps(docStateToWire(state), origin);
      for (const [col, old] of previous.collections ?? []) for (const id of old.boxes.keys())
        if (!state.collections?.get(col)?.boxes.has(id)) seed.push({ k: 'remove', col, id, origin });
      for (const key of previous.params.keys()) if (!state.params.has(key)) seed.push({ k: 'param', key, value: null, origin });
      return seed;
    }
    const held = heldKeyIndex(outbox.map((e) => e.op));
    const rawSeed: CanvasOp[] = [];
    for (const op of docStateToOps(frame.docState, { client: SEED_CLIENT, clock: serverClock })) {
      const kept = withoutHeldKeys(op, held);
      if (kept) rawSeed.push(kept);
    }
    // The snapshot is stored server state, which is exactly what a peer's OWN
    // out-of-band write becomes once the room persists it and a later joiner's
    // `join-ack` restates it - section 11.21's boundary applies here for the same reason
    // it applies to a live `ops` frame, and BEFORE `doc` sees any of it (below),
    // never after. See `WorkCollabOptions.guard`.
    const seed = admitInbound(rawSeed);
    // A fresh document, so a reconnect cannot leave a stale register standing that
    // the snapshot no longer contains (a row a peer deleted while we were away) - 
    // primed to this device's clock ceiling so "fresh" never means "back to 1".
    doc = new ReferenceCanvasDoc(clientId);
    primeClock(doc, clockCeiling);
    for (const op of seed) doc.apply(op);
    for (const entry of outbox) doc.apply(entry.op);
    return seed;
  }

  function onJoinAck(frame: JoinAckFrame): void {
    durableReceipts = frame.receipts === 1;
    // The gateway assigns the seat, and it says so in `you` (gateway.ts `doJoin`).
    // ABSENT IS NEVER A GRANT: an ack that declares no role at all seats us as an
    // observer, the same fail-closed reading org/collab-config.ts takes on every
    // capability bit. We degrade further on our own if the gateway's op version is
    // a different major, so a gateway that forgot cannot make us write ops it will
    // discard (plans/99 section 9).
    self = isRosterEntry(frame.you) ? frame.you : undefined;
    const stated = self?.role ?? frame.role;
    const declared: CollabRole = stated === 'writer' ? 'writer' : 'observer';
    const versionOk = typeof frame.opVersion !== 'string' || isCompatibleOpVersion(frame.opVersion);
    role = versionOk ? declared : 'observer';
    // `notice` is the gateway's own word for why a would-be writer is read-only
    // ('no-edit-grant', 'op-version-observer', 'room-full-view-only').
    reason = frame.reason
      ?? (typeof frame.notice === 'string' ? frame.notice : undefined)
      ?? (versionOk ? undefined : 'op-version');
    roster = Array.isArray(frame.roster) ? frame.roster.filter(isRosterEntry) : [];
    unsynced = Array.isArray(frame.unsynced)
      ? frame.unsynced.filter((id): id is string => typeof id === 'string')
      : [];

    let seed: CanvasOp[];
    try { seed = seedFrom(frame); }
    catch { role = 'observer'; reason = 'invalid-room-checkpoint'; dead = true; setStatus('closed'); sock?.close(COLLAB_CLOSE.PROTOCOL); return; }
    attempt = 0;
    status = 'live';
    emitState();

    emit({ kind: 'ops', from: '', ops: seed, snapshot: true });

    if (!durableReceipts) {
      role = 'observer'; reason = 'durable-receipts-required'; emitState(); return;
    }
    stopPump(); windowOps = 0; windowUntil = 0;
    for (const entry of outbox) entry.sent = false;
    postEntries([...outbox]);
    emitState();
  }

  // - inbound - 

  function handle(frame: ServerFrame): void {
    // A review event changes no document state, so it never waits behind a recovery save.
    if (frame.t === 'comment') {
      for (const fn of [...reviewListeners]) {
        try { fn({ threadId: frame.threadId, revision: frame.revision }); } catch (e) { console.warn('[lolly:collab] review listener', e); }
      }
      return;
    }
    if (savingRecovery) {
      if (recoveryFrames.length < 500) recoveryFrames.push(frame);
      else sock?.close(COLLAB_CLOSE.PROTOCOL);
      return;
    }
    switch (frame.t) {
      case 'claims': case 'claim-result': claims.receive(frame); return;
      case 'receipt': {
        if (!Number.isSafeInteger(frame.durableRevision) || frame.durableRevision < 1
          || !Array.isArray(frame.acceptedIds) || !Array.isArray(frame.rejectedIds)) return;
        const sent = inflight.get(frame.batchId);
        if (!sent || frame.acceptedIds.length + frame.rejectedIds.length !== sent.size
          || [...frame.acceptedIds, ...frame.rejectedIds].some(id => !sent.has(id))) return;
        const ids = new Set([...frame.acceptedIds, ...frame.rejectedIds]);
        if (ids.size !== sent.size) return;
        if (frame.rejectedIds.length && !archivedReceipts.has(frame)) {
          // Archive the optimistic document before its rejected IDs retire or a
          // checkpoint refreshes the canvas. The archive is scoped to the account, instance and room.
          const ops = docStateToOps(docStateToWire(doc.state()), { client: SEED_CLIENT, clock: 0 })
            .map(op => ({ ...op, deliveryId: globalThis.crypto.randomUUID() }));
          const copy = { id: ops[0]?.deliveryId ?? globalThis.crypto.randomUUID(), ops };
          savingRecovery = true;
          recoveryChain = persistChain.then(async () => {
            const archive: CanvasOp = { k: 'param', key: `recovery:${copy.id}`, value: JSON.stringify(ops), origin: { client: SEED_CLIENT, clock: 0 } };
            const next = [...recoveryArchives, { ...archive, deliveryId: copy.id }].slice(-8);
            while (next.length > 1 && JSON.stringify(next).length > 16_000_000) next.shift();
            await store.save(`${await keyFor()}:recovery`, next);
            recoveryArchives = next; recoveries.push(copy); if (recoveries.length > 8) recoveries.shift();
            recovery = copy; emit({ kind: 'recovery', ...copy });
            archivedReceipts.add(frame); savingRecovery = false;
            if (ended) { recoveryFrames.length = 0; return; }
            handle(frame);
            while (!savingRecovery && recoveryFrames.length) handle(recoveryFrames.shift()!);
          }).catch(() => {
            savingRecovery = false; recoveryFrames.length = 0;
            localSaveFailed = true; role = 'observer'; dead = true; reason = 'recovery-save-failed';
            claims.disconnect(); setStatus('closed');
            emit({ kind: 'error', code: reason, message: 'Interrupted edits could not be saved on this device. Save a copy before reopening.' });
            sock?.close(COLLAB_CLOSE.NORMAL);
          });
          return;
        }
        inflight.delete(frame.batchId);
        const keep = outbox.filter(e => !ids.has(e.op.deliveryId!));
        if (keep.length !== outbox.length) {
          outbox.splice(0, outbox.length, ...keep); persist(); emitState();
        }
        if (frame.rejectedIds.length) {
          emit({ kind: 'error', code: 'edits-rejected', message: 'Some edits were rejected by room policy.' });
        }
        if (frame.checkpoint) {
          try {
            const seed = seedFrom({ t: 'join-ack', checkpoint: frame.checkpoint, serverClock: frame.serverClock });
            emit({ kind: 'ops', from: '', ops: seed, snapshot: true });
          } catch { reason = 'invalid-room-checkpoint'; sock?.close(COLLAB_CLOSE.PROTOCOL); }
        }
        return;
      }
      case 'join-ack':
        onJoinAck(frame);
        if (status === 'live') claims.join(frame.interactionVersion, frame.claims, self?.id);
        return;
      case 'ops': {
        // Admitted BEFORE anything below can touch `doc` (section 11.21) - including the
        // clock absorption two lines down, which is exactly what an out-of-range
        // `origin.clock` would otherwise poison (see `WorkCollabOptions.guard`'s
        // comment and `op-guard.ts`'s `clockOutOfRange`). A rejected op never
        // reaches `theirs`, never reaches `doc.applyRemotePatch`, and is never
        // handed on to a session that would have refused it anyway - which is the
        // whole point: a session's OWN refusal, arriving after this write, would
        // have been too late to matter.
        const ops = admitInbound(sanitizeOps(frame.ops));
        if (!ops.length) return;
        for (const op of ops) observe(op.origin.clock);
        // Own echoes do not retire durable pending work or re-enter runtime history.
        const theirs: CanvasOp[] = [];
        for (const op of ops) {
          if (op.origin.client !== clientId) theirs.push(op);
        }
        // Peer echoes are not durable receipts.
        if (!theirs.length) return;
        doc.applyRemotePatch(theirs);
        emit({ kind: 'ops', from: typeof frame.from === 'string' ? frame.from : '', ops: theirs });
        return;
      }
      case 'presence': {
        // Only "is an object" is checked: the payload's SHAPE belongs to the
        // presence engine, not the transport (see CollabPresencePayload). A
        // stricter guard here would silently drop every real frame the moment the
        // engine wraps its state with a `seq`.
        const p = frame.frame;
        if (!p || typeof p !== 'object') return;
        emit({ kind: 'presence', from: typeof frame.from === 'string' ? frame.from : '', frame: p });
        return;
      }
      case 'peer-join': {
        // The gateway names the arrival `member`; `peer` is accepted as an alias.
        const peer = isRosterEntry(frame.member) ? frame.member
          : isRosterEntry(frame.peer) ? frame.peer
          : null;
        roster = nextRoster(frame.roster, peer, null);
        emit({ kind: 'peer-join', peer, roster });
        emitState();
        return;
      }
      case 'peer-role': {
        if (typeof frame.id !== 'string' || frame.role !== 'observer') return;
        // Live promotion requires a new seat allocation. This frame only revokes.
        if (frame.id === self?.id) {
          role = 'observer'; self = { ...self, role }; reason = 'no-edit-grant';
        } else roster = roster.map(peer => peer.id === frame.id ? { ...peer, role: 'observer' } : peer);
        emitState();
        return;
      }
      case 'peer-leave': {
        // The gateway sends the departing CONNECTION id as `id` (rooms.ts `leave`),
        // not a user id - matched against `RosterEntry.id` first, so a user's second
        // device is not evicted with their first.
        const id = typeof frame.id === 'string' ? frame.id
          : typeof frame.from === 'string' ? frame.from
          : '';
        const gone = roster.find((r) => r.id === id || r.userId === id);
        roster = nextRoster(frame.roster, null, id);
        emit({ kind: 'peer-leave', id, ...(gone ? { userId: gone.userId } : {}), roster });
        emitState();
        return;
      }
      case 'error': {
        // The gateway groups a batch's vetoes by code and names every refused input
        // in `inputs`; `inputId` is the single-input alias.
        const inputs = Array.isArray(frame.inputs)
          ? frame.inputs.filter((id): id is string => typeof id === 'string')
          : [];
        const inputId = typeof frame.inputId === 'string' ? frame.inputId : inputs[0];
        emit({
          kind: 'error',
          code: typeof frame.code === 'string' ? frame.code : 'unknown',
          ...(inputId !== undefined ? { inputId } : {}),
          ...(inputs.length ? { inputs } : {}),
          ...(typeof frame.message === 'string' ? { message: frame.message } : {}),
        });
        return;
      }
    }
  }

  function nextRoster(
    sent: readonly RosterEntry[] | undefined,
    add: RosterEntry | null,
    remove: string | null,
  ): readonly RosterEntry[] {
    if (Array.isArray(sent)) return sent.filter(isRosterEntry);
    let next = roster;
    if (add) next = [...next.filter((r) => rosterKey(r) !== rosterKey(add)), add];
    // A leave names a connection id; a gateway that names the principal instead is
    // still honoured, which is why both are matched.
    if (remove) next = next.filter((r) => r.id !== remove && r.userId !== remove);
    return next;
  }

  // - socket lifecycle - 

  function detachSocket(s: CollabSocket | null): void {
    if (!s) return;
    s.onopen = null;
    s.onmessage = null;
    s.onclose = null;
    s.onerror = null;
  }

  /**
   * The endpoint, or a refusal. An explicit `opts.url` is the documented escape
   * hatch (a deployment that terminates the gateway elsewhere, and every test) and
   * is taken as given; a DERIVED endpoint must be same-origin, because the gateway
   * authenticates from a `SameSite=Lax` cookie a browser will not attach to a
   * cross-site upgrade - see collab-protocol.ts's header. Refusing here turns an
   * undiagnosable reconnect loop into one stated reason.
   */
  async function endpoint(): Promise<string> {
    if (opts.url) return opts.url;
    const rel = `${COLLAB_WS_PATH}/${encodeURIComponent(sessionId)}`;
    const base = await resolveBase();
    // Same rule as lib/instance.ts's `instancePath` for a root-relative path: the
    // base prefixes it, or it stands alone on this origin.
    const path = base ? base.replace(/\/+$/, '') + rel : rel;
    const href = opts.href
      ?? (globalThis as { location?: { href?: string } }).location?.href
      ?? 'https://localhost/';
    const url = collabSocketUrl(path, href);
    if (isCrossOriginSocket(url, href)) throw new Error(CROSS_ORIGIN_REASON);
    return url;
  }

  async function open(): Promise<void> {
    // `opening` closes the window `await endpoint()` opens: without it two
    // overlapping calls (a connect() racing the backoff timer) each construct a
    // socket, and the loser is orphaned - detached by the `sock === s` guards, but
    // never closed, so it stays open until GC.
    //
    // It is cleared the instant that await resumes, NOT in a `finally` around the
    // whole body: everything below the await is synchronous, so a `finally` would
    // hold the guard for one microtask longer than the race it exists for - long
    // enough to swallow the very next reconnect attempt.
    if (ended || sock || opening) return;
    opening = true;
    if (status !== 'reconnecting') setStatus('connecting');
    let url: string;
    try {
      url = await endpoint();
      opening = false;
    } catch (e) {
      opening = false;
      if (e instanceof Error && e.message === CROSS_ORIGIN_REASON) {
        // Permanent by construction: retrying cannot make a Lax cookie cross-site.
        reason = CROSS_ORIGIN_REASON;
        dead = true;
        setStatus('closed');
        return;
      }
      scheduleReconnect();
      return;
    }
    if (ended) return;
    const Ctor = opts.socket ?? (globalThis as { WebSocket?: CollabSocketCtor }).WebSocket;
    if (!Ctor) {
      reason = 'no-websocket';
      dead = true;
      setStatus('closed');
      return;
    }
    let s: CollabSocket;
    try {
      s = new Ctor(url);
    } catch {
      scheduleReconnect();
      return;
    }
    inflight.clear();
    sock = s;
    s.onopen = () => { if (sock === s && !ended) join(); };
    s.onmessage = (ev) => {
      if (sock !== s || ended) return;
      const frame = parseServerFrame(ev?.data);
      if (frame) handle(frame);
    };
    s.onerror = () => { /* a close always follows; nothing useful to report here */ };
    s.onclose = (ev) => {
      if (sock !== s) return;
      claims.disconnect();
      stopPump();
      detachSocket(s);
      sock = null;
      if (ended) return;
      const code = typeof ev?.code === 'number' ? ev.code : 1006;
      if (typeof ev?.reason === 'string' && ev.reason) reason = ev.reason;
      if (!autoReconnect || isTerminalClose(code)) {
        // A terminal close is an answer (see isTerminalClose): stop, and say why.
        // `dead` as well as 'closed', or the adapter would keep taking local edits
        // and persisting them to IndexedDB for a session that can never reconnect - 
        // climbing to the cap and pausing further edits.
        if (!reason) reason = `close:${code}`;
        dead = true;
        setStatus('closed');
        return;
      }
      scheduleReconnect();
    };
  }

  function scheduleReconnect(): void {
    if (ended || timer !== null) return;
    attempt += 1;
    status = 'reconnecting';
    emitState();
    const delay = backoffDelay(attempt, random);
    timer = setTimer(() => {
      timer = null;
      if (!ended) void open();
    }, delay);
  }

  // - the adapter - 

  const adapter: CanvasSyncAdapter = {
    onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
      const ops = doc.onLocalChange(damage, rows, col);
      sendOps(ops);
      return ops;
    },
    apply(op: CanvasOp): void {
      // The contract's single-op door is the LOCAL one (`applyRemotePatch` is
      // explicitly the remote door) - lib/collab-plumbing.ts mints param and order
      // ops itself and delivers them here, so this must both converge and send.
      doc.apply(op);
      sendOps([op]);
    },
    applyRemotePatch(ops: readonly CanvasOp[]): Damage {
      for (const op of ops) observe(op.origin.clock);
      return doc.applyRemotePatch(ops);
    },
    presence(a: Awareness): void {
      doc.presence(a);
      // Presence is ephemeral: never queued, never replayed, and open to observers
      // (plan 100 section 7.5 - the presence lane is structurally unauthorized). Cadence is
      // the caller's (lib/collab-presence.ts owns the throttle).
      sendPresence(a);
    },
    state(): CanvasDocState {
      return doc.state();
    },
  };

  // - the handle - 

  return {
    sessionId,
    clientId,
    claims,
    reviewEvents: {
      subscribe(fn) {
        if (ended) return () => {};
        reviewListeners.add(fn);
        return () => { reviewListeners.delete(fn); };
      },
    },
    recovery: () => recovery,
    recoveries: () => recoveries,
    history: opts.history,
    adapter,
    snapshot: () => ({ ops: docStateToOps(docStateToWire(doc.state()), { client: SEED_CLIENT, clock: 0 }), clock: clockCeiling }),
    connect(): Promise<void> {
      if (ended) return Promise.resolve();
      // Memoised: `connect()` yields twice (the store load, then endpoint
      // derivation), and two overlapping callers must not each open a socket. A
      // second call while the first is in flight awaits the same work.
      connecting ??= runConnect().finally(() => { connecting = null; });
      return connecting;
    },
    close(): void {
      if (ended) return;
      ended = true;
      claims.disconnect();
      dead = true;
      stopPump();
      if (timer !== null) { clearTimer(timer); timer = null; }
      const s = sock;
      sock = null;
      if (s) {
        if (status === 'live') { try { s.send(JSON.stringify({ t: 'leave' })); } catch { /* already gone */ } }
        detachSocket(s);
        try { s.close(COLLAB_CLOSE.NORMAL); } catch { /* already closed */ }
      }
      persist();
      status = 'closed';
      emitState();
      // Subscribers are released last, after the final state has been delivered - 
      // "close() tears down listeners and timers" is the whole point of this method.
      listeners.clear();
      reviewListeners.clear();
    },
    state: snapshotState,
    on(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    sendPresence,
    outbox: () => outbox.map((e) => wireOp(e.op)),
    persisted: async () => { await persistChain; await recoveryChain; await persistChain; },
  };

  async function runConnect(): Promise<void> {
    if (!loaded) {
      loaded = true;
      // A store that throws must not stop the session opening - the outbox is a
      // durability nicety, the socket is the feature.
      let stored: CanvasOp[] | null;
      try {
        stored = await store.load(await keyFor());
        recoveryArchives = sanitizeOps(await store.load(`${await keyFor()}:recovery`)).slice(-8);
        for (const archive of recoveryArchives) {
          if (archive.k !== 'param' || !archive.key.startsWith('recovery:') || typeof archive.value !== 'string' || archive.value.length > 16_000_000) continue;
          let ops: CanvasOp[];
          try { ops = sanitizeOps(JSON.parse(archive.value)); } catch { continue; }
          if (!ops.length) continue;
          recovery = { id: archive.key.slice('recovery:'.length), ops };
          recoveries.push(recovery); emit({ kind: 'recovery', ...recovery });
        }
      }
      catch {
        outboxReadFailed = true; localSaveFailed = true; role = 'observer'; dead = true;
        reason = 'outbox-load-failed'; setStatus('closed');
        emit({ kind: 'error', code: reason, message: 'Pending edits could not be recovered on this device. Reopen the session to retry.' });
        return;
      }
      if (stored?.length && !ended) {
        for (const op of stored) {
          // `sent: false` - a stored entry was written by a previous run whose
          // delivery nothing here witnessed, so it counts as pending and survives
          // its first replay (the header's rule (b)).
          outbox.push({ op: { ...op, deliveryId: (op as Queued['op']).deliveryId ?? globalThis.crypto.randomUUID() }, sent: false, saved: false });
          observe(op.origin.clock);
          // Applied so `state()` is honest before the first join; the join-ack
          // rebuild re-applies them over the snapshot anyway.
          doc.apply(op);
        }
        trim();
        persist();
        await persistChain;
        emitState();
      }
    }
    if (ended || sock) return;
    await open();
  }
}

function isRosterEntry(v: unknown): v is RosterEntry {
  return !!v && typeof v === 'object' && typeof (v as { userId?: unknown }).userId === 'string';
}

/** Roster identity: the CONNECTION id when the gateway sent one, the principal
 *  otherwise. Keying on `userId` alone would collapse one user's two devices into
 *  a single row, so the second one to leave would evict the first (see
 *  RosterEntry's note in collab-protocol.ts). */
function rosterKey(entry: RosterEntry): string {
  return entry.id ?? entry.userId;
}

// ── The factory seam (see the header) ─────────────────────────────────────────

let factory: WorkCollabFactory | undefined;

/**
 * Register the work-collab factory (last-wins, like every other optional-provider
 * seam in this shell). Returns an unregister fn. Called by `org/index.ts`'s member
 * branch, gated on the instance granting `collab.join`.
 */
export function registerWorkCollabFactory(make: WorkCollabFactory): () => void {
  factory = make;
  return () => { if (factory === make) factory = undefined; };
}

/** The registered factory, or undefined when this instance does not offer collab. */
export function getWorkCollabFactory(): WorkCollabFactory | undefined {
  return factory;
}

/**
 * Await the durable per-device client id before a provider can be built - its own
 * doc says whoever registers a provider must (a mount's synchronous read otherwise
 * gets a fresh in-memory id, putting two clients on the wire from one device).
 */
export function initWorkCollab(): Promise<void> {
  return initCollabClientId().then(() => undefined);
}

/** TEST-ONLY: clear the registry back to its dormant default. */
export function _clearWorkCollabFactoryForTests(): void {
  factory = undefined;
}
