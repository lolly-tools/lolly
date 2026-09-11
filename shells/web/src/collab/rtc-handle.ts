// SPDX-License-Identifier: MPL-2.0
/**
 * rtc-handle - a connected `rtc-transport` as a `CollabSessionHandle`
 * (plan 100 section 5, section 6.2, section 6.2a, section 11.19, section 11.21; wave 2.3, Track A).
 *
 * `lib/collab-session.ts` is the composition every collab reduces to, and its header
 * names the two producers that have to reduce to it. This is Track A's - the one
 * place where "a WebRTC pair is up" becomes "a session can be mounted on it". It owns
 * the pair's LOCAL convergence document and nothing else about the network: the
 * `RTCPeerConnection`, the three lanes, ICE's vocabulary and the ceremony all stay
 * behind `rtc-transport.ts`, which this module only ever talks to through
 * {@link RtcHandleTransport} - the five-method subset a transport owes a session.
 *
 * It is deliberately the mirror of `org/collab-provider.ts` MINUS everything a server
 * implies. Both wrap `ReferenceCanvasDoc` (no yjs in the browser, ever - section 7's last
 * paragraph), both put what the LOCAL doors produce on the wire and send nothing from
 * the remote door. What is absent here is the whole point of Track A:
 *
 *   - **no outbox.** A pair has no server to be authoritative, so there is nothing to
 *     replay INTO on rejoin - a dropped connection needs a fresh ceremony (section 6.1), and
 *     the catch-up is the peer's own state, not a durable journal. Persisting ops for
 *     a session whose only other participant is a laptop on the same table would buy
 *     nothing and cost an IDB write per keystroke.
 *   - **no acks.** The gateway's "did the room accept this?" question does not exist:
 *     there is no room. Send-and-converge is the whole protocol, and what makes it
 *     safe is the backstop below rather than a receipt.
 *   - **no join handshake / role grant.** Both peers in a pair are writers by
 *     construction (section 6.2a's asymmetry is about PERSISTENCE and continuation, not about
 *     who may type). The only demotion is section 11.19's version skew, in-band, below.
 *
 * ── The divergence backstop (section 6.2, Excalidraw's pattern) ──────────────────────────
 *
 * Two peers converge by LWW while every op arrives. The ops lane is reliable and
 * ordered, so "every op arrives" is nearly always true - but nearly is not a
 * convergence proof, and there is no server holding the answer when it is not. So
 * every {@link BACKSTOP_INTERVAL_MS} milliseconds, WHEN this side has emitted
 * anything since the last exchange, the whole of our state goes out again.
 *
 * WHAT A STATE EXCHANGE IS, precisely: the op log compacted to its LWW winners - for
 * every register (`registerKeys`) the one op that currently owns it, replayed
 * VERBATIM with its original `(client, clock)` origin. That is what makes receiving
 * one a merge and not an overwrite: the receiver's document arbitrates each register
 * exactly as it would have for the live op, `beats()` is strict, so re-applying what
 * a peer already holds changes nothing (idempotent), and a register the peer holds
 * NEWER survives our restatement untouched.
 *
 * The alternative - serialising `doc.state()` and restating it under one invented
 * origin - was rejected: a snapshot carries no per-register origins, so any single
 * watermark is wrong in one direction or the other (low enough not to clobber the
 * peer's newer writes is also low enough to lose to the stale ones it exists to
 * repair), and two peers both restating under their own watermark would ping-pong a
 * contested key forever. `org/collab-protocol.ts`'s `withoutHeldKeys` documents the
 * same reasoning for the join-ack seed, which is the same problem with a server in it.
 *
 * The index costs O(registers), not O(edits) - section 11.20's "op-log unboundedness is a
 * non-issue in Track A by construction", made true rather than assumed.
 *
 * Order inside an exchange is NOT arbitrary: adds, then order keys, then field/geom/
 * param writes, then removes. The document does not care (membership is its own LWW
 * register, `ensure()` materialises a box whatever arrives first), but
 * `collab-plumbing.ts`'s model rebuild does - it refuses to resurrect a row a
 * `remove` took out and refuses to write a field on a row that does not exist yet
 * ("no resurrection"), so a batch that stated them in the other order would leave the
 * two peers' DOCUMENTS converged and their input MODELS diverged.
 *
 * ── Rate discipline: why the wire shape is a batch ────────────────────────────────
 *
 * The ops-lane payload is ALWAYS an array of ops, live edits and exchanges alike - 
 * `rtc-transport`'s `d` is opaque, so one shape beats two, and one gesture is one
 * frame. It matters: section 11.21 caps a peer at ~200 ops/s and disconnects rather than
 * throttles, and `collab-plumbing.ts` mints one `OrderOp` PER ROW when a blocks array
 * is reordered - 200 rows would be 200 frames if each `apply()` wrote its own. Local
 * ops are therefore coalesced to one frame per microtask, and a state exchange is
 * PACED ({@link STATE_CHUNK_OPS} per {@link STATE_CHUNK_GAP_MS}) so a large repair
 * cannot make a healthy peer disconnect us for flooding.
 *
 * ── What arrives is untrusted, continuously (section 11.21, section 11.22) ─────────────────────
 *
 * `op-guard.ts` is the boundary, and a caller that has a mounted tool SHOULD pass one
 * (`guard`): only the guard can run the manifest whitelist, because only the caller
 * knows the tool's declared inputs. With no guard this module still refuses to apply
 * anything unchecked - the canonical ajv `validateCanvasOp` (the same compiled schema
 * lolly-work's gateway runs), a safe-integer clock, finite numbers, and the
 * `__proto__`/`constructor`/`prototype` refusal - but that is the FLOOR, not the
 * boundary: it cannot tell a declared input id from an undeclared one.
 *
 * A cap breach disconnects the peer (section 11.21 is explicit that it is not silently
 * throttled); a merely unrecognised op is dropped and the session continues (section 11.11,
 * section 11.19 - PWA staleness makes version skew routine).
 *
 * Presence frames are rate-capped here and otherwise forwarded verbatim, because
 * `rtc-transport.parsePresenceFrame` has already checked the envelope and the roster
 * rules are `lib/collab-presence.ts`'s. `guard.checkPresence` is deliberately NOT
 * wired: it requires `cursor` and `selection`, which the engine's own `PresenceState`
 * makes optional and which every sidebar-only tool omits (section 4.1 - focus, not a cursor,
 * is the presence primitive that generalises), so wiring it here would drop every
 * real frame. That mismatch is op-guard's to resolve, not something to work around
 * with a shape sniff at this seam.
 *
 * ── No wall clock in convergence (section 11.7) ────────────────────────────────────────
 *
 * Ordering is `(clock, client)` only. The one `now()` in this file feeds op-guard's
 * per-second RATE window, never a merge, and it is monotonic by default - an
 * airgapped device with a wrong system clock behaves identically.
 *
 * Everything time-shaped is injected ({@link RtcCollabHandleOptions.timers},
 * `now`, `schedule`), so the whole of the backstop is testable at CPU speed and
 * `close()` can be proved to leave ZERO armed timers.
 */

import { ReferenceCanvasDoc, isCompatibleOpVersion } from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness,
  BoxId,
  BoxRow,
  CanvasDocState,
  CanvasOp,
  CanvasSyncAdapter,
  Damage,
  OpOrigin,
} from '@lolly-tools/core/canvas-op-v1';
import { validateCanvasOp } from '@lolly-tools/core';
import type { CeremonyRole, CeremonyTimerHandle, CeremonyTimers } from './ceremony.ts';
import { ABUSE_REASONS } from './op-guard.ts';
import type { OpGuard } from './op-guard.ts';
import { MAX_CLIENT_ID_CHARS } from './rtc-transport.ts';
import type {
  RtcInboundMessage,
  RtcPresenceOutbound,
  RtcSendResult,
  RtcTransport,
  RtcTransportEventMap,
  RtcTransportState,
} from './rtc-transport.ts';
import type { PresenceFrame } from '../lib/collab-presence.ts';
import type {
  CollabConnectionState,
  CollabRole,
  CollabSelf,
  CollabSessionHandle,
  CollabStream,
} from '../lib/collab-session.ts';
import { createP2PCollabHistory } from './rtc-history.ts';
import { historySharingAgreed } from '../lib/collab-history.ts';

// ── Tunables ───────────────────────────────────────────────────────────────────────

/** How often a dirty side restates its whole document (section 6.2's "~20 s, only when
 *  dirty"). Cheap by design: our states are tens of KB and it only runs after a real
 *  local edit. */
export const BACKSTOP_INTERVAL_MS = 20_000;

/** Ops per frame in a paced state exchange. With {@link STATE_CHUNK_GAP_MS} this is
 *  100 ops/s - comfortably inside section 11.21's ~200/s inbound ceiling, leaving room for
 *  the live edits still flowing alongside the repair. */
export const STATE_CHUNK_OPS = 100;

/** Gap between a state exchange's chunks. See {@link STATE_CHUNK_OPS}. */
export const STATE_CHUNK_GAP_MS = 1_000;

/** section 11.21's per-message ceiling, applied in BOTH directions: we never write more in
 *  one frame, and a peer that does is refused as a cap breach (op-guard's
 *  `batch-too-large`, which is an abuse reason). */
export const MAX_OPS_PER_MESSAGE = 200;

/**
 * How many distinct peer ids this handle will remember for {@link RtcCollabHandle
 * .peerRole}. A pair has exactly one, and every frame's `from` is peer-supplied - so
 * the set is bounded rather than trusted. Beyond the cap new ids are simply not
 * learned (they still reach the presence engine, which has its own roster rules).
 */
const MAX_KNOWN_PEERS = 8;

/** Keys that are never data, whatever a manifest says. Mirrors `op-guard.ts`'s
 *  private `FORBIDDEN_KEYS` - three literals, the enum/prototype-key discipline
 *  `engine/src/url-mode.ts` applies to untrusted URL text. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const REAL_TIMERS: CeremonyTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

/** Monotonic where it exists. Feeds op-guard's rate window ONLY - never a merge
 *  (section 11.7), which is why a device with a wrong system clock converges identically. */
function defaultNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function defaultSchedule(fn: () => void): void {
  if (typeof queueMicrotask === 'function') queueMicrotask(fn);
  else void Promise.resolve().then(fn);
}

// ── The transport subset a session needs ──────────────────────────────────────────

/**
 * What this module asks of a transport - narrower than {@link RtcTransport} on
 * purpose, so a test needs an in-memory wire rather than a fake `RTCPeerConnection`,
 * and so a future native LAN transport (section 11.29's Tauri Linux rung) can satisfy the
 * same five members without inheriting WebRTC's shape.
 */
export interface RtcHandleTransport {
  /** This DEVICE's collab client id, as the transport stamps its hello with. */
  readonly clientId: string;
  state(): RtcTransportState;
  /** Write one ops-lane payload. This module always passes an ARRAY of ops. */
  sendOp(op: unknown): RtcSendResult;
  sendPresence(frame: RtcPresenceOutbound): RtcSendResult;
  on<K extends keyof RtcTransportEventMap>(type: K, fn: (value: RtcTransportEventMap[K]) => void): () => void;
  close(): void;
}

/** Compile-time proof that a real transport still satisfies the subset above - no
 *  cast, so a change to either side fails `tsc` rather than production. */
export type RtcTransportSatisfiesHandleTransport = RtcTransport extends RtcHandleTransport ? true : never;

// ── Options + the handle ──────────────────────────────────────────────────────────

export interface RtcCollabHandleOptions {
  /** A CONNECTED transport (the ceremony has reached `phase: 'connected'`). */
  readonly transport: RtcHandleTransport;
  /** Which end of the ceremony this is. It decides one thing and one thing only:
   *  who the session's host is (section 6.2a) - both peers are writers. */
  readonly role: CeremonyRole;
  /** This client's chosen identity (section 11.23). `clientId` is the per-device ULID. */
  readonly self: CollabSelf;
  /**
   * The inbound boundary (section 11.21). Build it from the mounted tool's declared inputs
   * (`createOpGuard({ inputs: runtime.getModel() })`) - only the caller knows them.
   * Omitted, this module falls back to schema + finiteness + forbidden-key checks,
   * which is a floor and not a whitelist (see the header).
   */
  readonly guard?: OpGuard | null;
  readonly timers?: CeremonyTimers;
  /** Monotonic ms for the guard's rate window. Never used for ordering (section 11.7). */
  readonly now?: () => number;
  /** Outbound coalescing scheduler. Defaults to `queueMicrotask`, so one gesture is
   *  one frame however many `apply()` calls it makes. */
  readonly schedule?: (fn: () => void) => void;
  readonly backstopMs?: number;
  readonly stateChunkOps?: number;
  readonly stateChunkGapMs?: number;
  readonly opsPerMessage?: number;
  /** Diagnostics. Never user copy. */
  readonly log?: (message: string, detail?: unknown) => void;
}

/**
 * A `CollabSessionHandle` (so `createCollabSession` takes it unchanged) plus the few
 * things only a P2P pair has to say.
 */
export interface RtcCollabHandle extends CollabSessionHandle {
  readonly transport: RtcHandleTransport;
  /** Always present on this track - a pair learns its peer's role from the hello, so
   *  the session contract's optional member is narrowed to required here. */
  peerRole(clientId: string): CollabRole | undefined;
  /**
   * Inbound ops - validated, applied to this side's document, and handed on for
   * `CollabSession.applyRemotePatch` (which coalesces them per frame and lands them
   * atomically). The session contract has no inbound-op stream of its own because
   * Track B's provider emits ops through its own event union; this is Track A's.
   */
  readonly opsIn: CollabStream<readonly CanvasOp[]>;
  /** Role changes - i.e. the section 11.19 observer downgrade. Replays the current role on
   *  subscribe, so a late subscriber cannot miss a demotion that already happened. */
  readonly roleIn: CollabStream<CollabRole>;
  /** The peer's client id, once its hello (or a presence frame) has landed. */
  peerClientId(): string | undefined;
  /** The peer's declared `CANVAS_OP_VERSION`, once its hello has landed. */
  peerOpVersion(): string | undefined;
  /** The peer's announced shared-history capability, or `undefined` until its hello
   *  arrives (or forever, for an older peer that announces none). */
  peerHistoryProtocol(): string | undefined;
  /** Whether both sides agreed the same shared-history capability - the gate the
   *  future revision/preview exchange and shared restore open behind (plan 221 section 9).
   *  False until the peer's hello arrives, and permanently false against an older peer;
   *  each side's own memory-only session history does not depend on it. */
  historySharingAvailable(): boolean;
  /** Why this side degraded or ended the session, when this module decided it
   *  ('op-version', an op-guard reason, …). Undefined for a healthy session. */
  reason(): string | undefined;
  /** Restate the whole document to the peer now - the catch-up path a rejoining
   *  acceptor needs (section 6.2a), and what the backstop calls on a timer. */
  exchangeState(): void;
  /** The converged document (diagnostics, tests, and the "Save a copy" exit). */
  docState(): CanvasDocState;
}

// ── Registers ─────────────────────────────────────────────────────────────────────

/** The register-key delimiter. A NUL is not a character a box id, a collection id or
 *  a field name can carry, so it is a separator no peer-supplied name can forge - 
 *  with any printable delimiter, a field called `"b c"` and a field called `"c"` on a
 *  box called `"b"` would collide. Spelled through `fromCharCode` so this source stays
 *  plain ASCII (`lib/collab-plumbing.ts`'s `NO_ID` does the same). */
const SEP = String.fromCharCode(0);

/**
 * The LWW registers one op writes.
 *
 * Geometry and content share the `f` namespace deliberately: a `geom` op and a
 * `field` op on `x` write the SAME register, and an index that thought otherwise
 * would restate both and let the loser win half the time.
 *
 * Exported because the backstop's whole correctness argument is "one op per
 * register": the co-located test pins this against `org/collab-protocol.ts`'s
 * `opKeys`, which is the same grammar for the join-ack's held keys. The two are
 * pinned by a drift test rather than an import - Track A does not depend on the
 * control-plane seam, and that seam's copy is a gateway contract that may move for
 * gateway reasons.
 */
export function registerKeys(op: CanvasOp): string[] {
  if (op.k === 'param') return [`p${SEP}${op.key}`];
  const box = `${op.col ?? ''}${SEP}${op.id}`;
  switch (op.k) {
    case 'field':
      return [`f${SEP}${box}${SEP}${op.field}`];
    case 'geom':
      return Object.keys(op.fields).map((field) => `f${SEP}${box}${SEP}${field}`);
    case 'order':
      return [`o${SEP}${box}`];
    case 'remove':
      return [`m${SEP}${box}`];
    default:
      return [
        `m${SEP}${box}`,
        `o${SEP}${box}`,
        ...Object.keys(op.row).map((field) => `f${SEP}${box}${SEP}${field}`),
      ];
  }
}

/** Does origin `a` beat origin `b`? Higher clock wins; on a tie the higher client id
 *  wins. Strict, so an identical op never displaces itself - which is what makes a
 *  restatement idempotent. MIRRORS `ReferenceCanvasDoc`'s own private rule; the
 *  co-located test pins the two together through the real document. */
function beatsOrigin(a: OpOrigin, b: OpOrigin): boolean {
  return a.clock !== b.clock ? a.clock > b.clock : a.client > b.client;
}

// ── A minimal stream ──────────────────────────────────────────────────────────────

interface Emitter<T> {
  readonly stream: CollabStream<T>;
  emit(value: T): void;
  clear(): void;
}

/**
 * `current` makes a stream REPLAY on subscribe, which the connection and role streams
 * need and the ops/presence streams must not have. The ceremony reaches `connected`
 * BEFORE a session is built on top of it, so a connection stream that only spoke on
 * change would leave the pill saying "connecting" over a live pair forever.
 */
function emitter<T>(current?: () => T): Emitter<T> {
  const subscribers = new Set<(value: T) => void>();
  return {
    stream: {
      subscribe(fn) {
        subscribers.add(fn);
        if (current) {
          try {
            fn(current());
          } catch {
            /* a subscriber's failure is its own */
          }
        }
        return () => {
          subscribers.delete(fn);
        };
      },
    },
    emit(value) {
      for (const fn of [...subscribers]) {
        try {
          fn(value);
        } catch {
          /* same rule as the transport's: a broken observer breaks nothing else */
        }
      }
    },
    clear() {
      subscribers.clear();
    },
  };
}

// ── The handle ────────────────────────────────────────────────────────────────────

export function createRtcCollabHandle(opts: RtcCollabHandleOptions): RtcCollabHandle {
  const transport = opts.transport;
  const self = opts.self;
  const selfId = self.clientId;
  const timers = opts.timers ?? REAL_TIMERS;
  const now = opts.now ?? defaultNow;
  const schedule = opts.schedule ?? defaultSchedule;
  const log = opts.log ?? ((): void => {});
  const guard = opts.guard ?? null;
  const backstopMs = opts.backstopMs ?? BACKSTOP_INTERVAL_MS;
  const chunkSize = Math.max(1, opts.stateChunkOps ?? STATE_CHUNK_OPS);
  const chunkGapMs = Math.max(0, opts.stateChunkGapMs ?? STATE_CHUNK_GAP_MS);
  const opsPerMessage = Math.max(1, opts.opsPerMessage ?? MAX_OPS_PER_MESSAGE);

  /** The pair's local convergence document (section 6.2 - no yjs in the browser, ever). */
  const doc = new ReferenceCanvasDoc(selfId);
  /** Register → the op that currently owns it. The state exchange, compacted. */
  const registers = new Map<string, CanvasOp>();

  let closed = false;
  /** Both peers in a pair are writers; only section 11.19's version skew demotes us. */
  let role: CollabRole = 'writer';
  /** The transport's memory-only revision history (`rtc-history.ts`). The inviter owns
   *  the durable document, so it shares its session; an invitee stays memory-scoped.
   *  Ephemeral by construction and dropped in `close()` - nothing survives the leave. */
  const history = createP2PCollabHistory({ host: opts.role === 'inviter', role });
  let connection: CollabConnectionState = transport.state().connection;
  /** Local ops emitted since the last completed state exchange (section 6.2's "only when
   *  dirty"). Set by an emission, cleared only by an exchange that fully landed AND
   *  has covered every emission - see `dirtyGen`. */
  let dirty = false;
  /**
   * Bumped on every local emission (`queueLocal`), never reset. `stateOps()` is
   * snapshotted once, up front, in `exchangeState()` - but the exchange it feeds is
   * PACED (`pumpChunks`, `STATE_CHUNK_GAP_MS` apart), so a local edit made mid-pace
   * is not in that snapshot; it left only as its own live frame via
   * `queueLocal`→`flushOutbound`, and if THAT frame is the one the lane drops, the
   * backstop is its only remaining repair path. `exchangeGen` (below) pins the
   * generation an in-flight exchange was snapshotted at, so its completion clears
   * `dirty` only when nothing has set it again since - never "cleared by an exchange
   * that fully landed" alone, which is not the same claim.
   */
  let dirtyGen = 0;
  /** The `dirtyGen` value `exchangeState()` snapshotted `stateOps()` at. Compared
   *  against the LIVE `dirtyGen` before `pumpChunks()` may clear `dirty`. */
  let exchangeGen = 0;
  let everLive = false;
  let reason: string | undefined;
  let peerId: string | undefined;
  let peerVersion: string | undefined;
  let peerHistory: string | undefined;
  const knownPeers = new Set<string>();

  /** Outbound ops awaiting this microtask's flush (one gesture, one frame). */
  let outbound: CanvasOp[] = [];
  let flushScheduled = false;

  let backstopTimer: CeremonyTimerHandle | null = null;
  let chunkTimer: CeremonyTimerHandle | null = null;
  let chunkQueue: CanvasOp[][] = [];
  let exchangeLanded = true;

  const events = emitter<CollabConnectionState>(() => connection);
  const roleIn = emitter<CollabRole>(() => role);
  const presenceIn = emitter<PresenceFrame>();
  const opsIn = emitter<readonly CanvasOp[]>();

  // ── the register index ──────────────────────────────────────────────────────────

  function indexOp(op: CanvasOp): void {
    for (const key of registerKeys(op)) {
      const held = registers.get(key);
      if (held === undefined || beatsOrigin(op.origin, held.origin)) registers.set(key, op);
    }
  }

  /**
   * True when applying `op` could not change anything: every register it writes is
   * already held by an op it does not beat.
   *
   * This is what "our own ops are never echoed back into the doc twice" is, done
   * precisely. A peer's backstop legitimately restates ops that ORIGINATED here - it
   * holds the whole converged document, not just its own writes - so filtering by
   * client id would be wrong in the one case it matters: a reload keeps this device's
   * client id but loses its Lamport clock and its document, and the peer's
   * restatement of our own older ops is exactly the catch-up that repairs it. Holding
   * the register is the honest test, and it also swallows a peer's duplicate
   * restatements and any stale reordering for free.
   */
  function redundant(op: CanvasOp): boolean {
    for (const key of registerKeys(op)) {
      const held = registers.get(key);
      if (held === undefined || beatsOrigin(op.origin, held.origin)) return false;
    }
    return true;
  }

  // ── outbound ────────────────────────────────────────────────────────────────────

  /** Write one batch as a single ops-lane frame, halving on the SCTP ceiling (section 11.6)
   *  rather than accounting bytes ourselves - the transport already knows the limit
   *  and refuses without sending. Returns whether every op reached the wire. */
  function sendBatch(ops: readonly CanvasOp[]): boolean {
    if (ops.length === 0) return true;
    const result = transport.sendOp(ops);
    if (result === 'sent') return true;
    if (result === 'too-large' && ops.length > 1) {
      const half = Math.ceil(ops.length / 2);
      const head = sendBatch(ops.slice(0, half));
      const tail = sendBatch(ops.slice(half));
      return head && tail;
    }
    // Nothing is requeued: the ops are in the register index, `dirty` stays true, and
    // the backstop restates them. A single op over 64 KB will never fit and is the
    // one genuinely lost write - logged rather than retried forever.
    log('rtc-handle: ops frame not sent', { result, ops: ops.length });
    return false;
  }

  function flushOutbound(): void {
    if (outbound.length === 0) return;
    const batch = outbound;
    outbound = [];
    for (let i = 0; i < batch.length; i += opsPerMessage) {
      sendBatch(batch.slice(i, i + opsPerMessage));
    }
  }

  /** A local op: index it, mark us dirty, and coalesce it into this microtask's
   *  frame. Indexing and dirtying happen whether or not the write lands, which is
   *  what makes a send failure a repair the backstop performs rather than a loss. */
  function queueLocal(ops: readonly CanvasOp[]): void {
    if (ops.length === 0 || closed) return;
    for (const op of ops) {
      indexOp(op);
      outbound.push(op);
    }
    dirty = true;
    dirtyGen += 1;
    if (flushScheduled) return;
    flushScheduled = true;
    schedule(() => {
      flushScheduled = false;
      if (!closed) flushOutbound();
    });
  }

  // ── the state exchange (section 6.2) ───────────────────────────────────────────────────

  /**
   * The document as ops: one per register, deduplicated, ordered so a receiver's
   * MODEL rebuild agrees with its document (see the header). `latest` holds whole ops
   * under several keys - an `add` owns membership, paint order and every field it
   * carried - so identity dedup is what keeps the batch minimal.
   */
  function stateOps(): CanvasOp[] {
    const seen = new Set<CanvasOp>();
    const adds: CanvasOp[] = [];
    const orders: CanvasOp[] = [];
    const writes: CanvasOp[] = [];
    const removes: CanvasOp[] = [];
    for (const op of registers.values()) {
      if (seen.has(op)) continue;
      seen.add(op);
      if (op.k === 'add') adds.push(op);
      else if (op.k === 'order') orders.push(op);
      else if (op.k === 'remove') removes.push(op);
      else writes.push(op);
    }
    return [...adds, ...orders, ...writes, ...removes];
  }

  /** True when nothing has set `dirty` again since THIS exchange's snapshot was
   *  taken - the second half of "fully landed" that `exchangeLanded` alone cannot
   *  say (see `dirtyGen`'s comment). */
  function exchangeCoversLatest(): boolean {
    return dirtyGen === exchangeGen;
  }

  function pumpChunks(): void {
    if (closed) return;
    const next = chunkQueue.shift();
    if (next === undefined) {
      if (exchangeLanded && exchangeCoversLatest()) dirty = false;
      return;
    }
    if (!sendBatch(next)) exchangeLanded = false;
    if (chunkQueue.length === 0) {
      // Only a fully-delivered exchange that also covers every edit made since it
      // was snapshotted clears the flag: a partial one has to be repeated, and so
      // does one a local edit outran mid-pace - staying dirty is how the next tick
      // (or the backstop) knows either way.
      if (exchangeLanded && exchangeCoversLatest()) dirty = false;
      return;
    }
    chunkTimer = timers.setTimeout(() => {
      chunkTimer = null;
      pumpChunks();
    }, chunkGapMs);
  }

  function exchangeState(): void {
    // One paced exchange at a time. A second one starting mid-pace would interleave
    // two copies of the same registers for no gain, and (worse) double the rate.
    if (closed || chunkTimer !== null || chunkQueue.length > 0) return;
    // Snapshotted together, deliberately: `exchangeGen` must pin the SAME instant
    // `stateOps()` read the registers at, or a local edit landing between the two
    // reads would be covered by neither the snapshot nor the generation check.
    const gen = dirtyGen;
    const ops = stateOps();
    if (ops.length === 0) {
      // Nothing to restate NOW, but only clear `dirty` if nothing has arrived since
      // this read either (compared against `gen`, not the stale `exchangeGen` of
      // whatever exchange ran before this one) - an edit racing this exact check
      // must not be swallowed.
      if (dirtyGen === gen) dirty = false;
      return;
    }
    exchangeGen = gen;
    exchangeLanded = true;
    chunkQueue = [];
    for (let i = 0; i < ops.length; i += chunkSize) chunkQueue.push(ops.slice(i, i + chunkSize));
    pumpChunks();
  }

  function armBackstop(): void {
    if (closed || backstopTimer !== null || backstopMs <= 0 || connection === 'closed') return;
    backstopTimer = timers.setTimeout(() => {
      backstopTimer = null;
      if (closed) return;
      if (dirty && connection === 'live') exchangeState();
      armBackstop();
    }, backstopMs);
  }

  function disarmTimers(): void {
    if (backstopTimer !== null) {
      timers.clearTimeout(backstopTimer);
      backstopTimer = null;
    }
    if (chunkTimer !== null) {
      timers.clearTimeout(chunkTimer);
      chunkTimer = null;
    }
  }

  // ── connection state (section 11.3) ────────────────────────────────────────────────────

  function setConnection(next: CollabConnectionState): void {
    if (closed || next === connection) return;
    const previous = connection;
    connection = next;
    if (next === 'closed') disarmTimers();
    if (next === 'live') {
      armBackstop();
      if (!everLive) {
        everLive = true;
        // section 6.2's "late joiner gets the full state from the peer": whatever this side
        // already holds goes out the moment the lane opens. Usually nothing - the
        // document is born empty and the seed rides the hello - but a caller that
        // projected the mounted tool into the doc before connecting gets the catch-up
        // for free, and an empty index sends no frame at all.
        if (registers.size > 0) exchangeState();
      } else if (dirty && previous === 'reconnecting') {
        // A UDP blip healed. Reliable-ordered SCTP means nothing was dropped in the
        // ordinary case, so this costs one frame in exchange for "a Wi-Fi blip never
        // loses the helper's typing" (section 6.2a) being true even when it was not ordinary.
        exchangeState();
      }
    }
    events.emit(next);
  }

  // ── inbound (section 11.21) ────────────────────────────────────────────────────────────

  function noteReason(why: string): void {
    reason ??= why;
  }

  /** section 11.21: a peer that breaches a cap is DISCONNECTED, not silently throttled. */
  function disconnect(why: string): void {
    if (closed) return;
    noteReason(why);
    log('rtc-handle: disconnecting the peer', why);
    close();
  }

  /** section 11.19 / contract section 9: an incompatible op-contract major makes this side
   *  observer-only. Sticky - a session that has seen a mismatch never re-upgrades. */
  function downgrade(why: string): void {
    noteReason(why);
    if (role === 'observer') return;
    role = 'observer';
    log('rtc-handle: observer-only', why);
    roleIn.emit(role);
  }

  function notePeer(id: string): void {
    if (!id || id === selfId || knownPeers.has(id) || knownPeers.size >= MAX_KNOWN_PEERS) return;
    knownPeers.add(id);
  }

  /** Own-key check for the guardless floor: the three names that are never data,
   *  wherever a peer can put one. */
  function hasForbiddenName(op: CanvasOp): boolean {
    if (op.k === 'param') return FORBIDDEN_KEYS.has(op.key);
    if (op.col !== undefined && FORBIDDEN_KEYS.has(op.col)) return true;
    if (op.k === 'field') return FORBIDDEN_KEYS.has(op.field);
    if (op.k === 'add') return Object.keys(op.row).some((field) => FORBIDDEN_KEYS.has(field));
    return false;
  }

  /** Numbers the schema lets through: `type:'number'` is a `typeof` test, so NaN and
   *  Infinity are numbers, and `Infinity % 1` is NaN so `type:'integer'` passes too. */
  function hasNonFiniteNumber(op: CanvasOp): boolean {
    if (!Number.isFinite(op.origin.clock)) return true;
    if (op.k === 'geom') {
      for (const field of Object.keys(op.fields)) {
        const value = op.fields[field as keyof typeof op.fields];
        if (typeof value === 'number' && !Number.isFinite(value)) return true;
      }
      return false;
    }
    if (op.k === 'field') return typeof op.value === 'number' && !Number.isFinite(op.value);
    if (op.k === 'param') return typeof op.value === 'number' && !Number.isFinite(op.value);
    if (op.k === 'add') {
      return Object.keys(op.row).some((field) => {
        const value = op.row[field];
        return typeof value === 'number' && !Number.isFinite(value);
      });
    }
    return false;
  }

  /** The floor when no guard was supplied (see the header). Returns null when the
   *  peer has been disconnected for a cap breach. */
  function checkWithoutGuard(raw: readonly unknown[]): CanvasOp[] | null {
    const ok: CanvasOp[] = [];
    for (const entry of raw) {
      if (!validateCanvasOp(entry).valid) {
        log('rtc-handle: op failed the canonical schema');
        continue;
      }
      const op = entry as CanvasOp;
      // A clock outside the safe-integer band poisons every future merge - `++` stops
      // incrementing above MAX_SAFE_INTEGER, so it is a cap breach, not a stale op.
      if (!Number.isSafeInteger(op.origin.clock) || op.origin.clock < 0) {
        disconnect('op-clock-out-of-range');
        return null;
      }
      if (hasForbiddenName(op)) {
        disconnect('op-forbidden-key');
        return null;
      }
      if (hasNonFiniteNumber(op)) {
        log('rtc-handle: op dropped for a non-finite number');
        continue;
      }
      ok.push(op);
    }
    return ok;
  }

  function checkWithGuard(active: OpGuard, raw: readonly unknown[]): CanvasOp[] | null {
    const result = active.checkOps(raw);
    for (const rejection of result.rejected) {
      log('rtc-handle: op refused', rejection);
      if (ABUSE_REASONS.has(rejection.reason)) {
        disconnect(`op-${rejection.reason}`);
        return null;
      }
    }
    return result.ok;
  }

  function onOpsFrame(payload: unknown): void {
    if (closed) return;
    // A bare op is accepted as well as a batch: this module always writes an array,
    // but the transport's payload is opaque and a forward/older peer may not.
    const raw: unknown[] = Array.isArray(payload) ? payload : [payload];
    if (raw.length === 0) return;
    if (raw.length > opsPerMessage) {
      disconnect('op-batch-too-large');
      return;
    }
    if (guard && !guard.recordAndCheckRate('ops', raw.length, now())) {
      disconnect('op-rate-limited');
      return;
    }
    const checked = guard ? checkWithGuard(guard, raw) : checkWithoutGuard(raw);
    if (checked === null || checked.length === 0) return;
    // Nothing that cannot change the document is applied or surfaced (see
    // `redundant`) - a peer's backstop restating what we already hold is the normal
    // case, not an error, and re-emitting it would cost a render for no change.
    const fresh = checked.filter((op) => !redundant(op));
    if (fresh.length === 0) return;
    doc.applyRemotePatch(fresh);
    for (const op of fresh) indexOp(op);
    opsIn.emit(fresh);
  }

  function onHello(message: Extract<RtcInboundMessage, { kind: 'hello' }>): void {
    const id = message.clientId;
    if (typeof id === 'string' && id.length > 0 && id.length <= MAX_CLIENT_ID_CHARS && id !== selfId) {
      // First hello wins: a pair has exactly one peer, and a re-armed ceremony builds
      // a whole new transport (and so a whole new handle) rather than reusing this one.
      peerId ??= id;
      notePeer(id);
    }
    const version = message.opVersion;
    if (typeof version === 'string' && version.length > 0) {
      peerVersion = version;
      if (!isCompatibleOpVersion(version)) downgrade('op-version');
    }
    // Additive: an older peer omits it, and shared history simply stays unavailable
    // (plan 221 section 9). Recorded, never acted on here - the exchange protocol reads it.
    if (typeof message.history === 'string' && message.history.length > 0) peerHistory = message.history;
    // `message.seed` is deliberately ignored here: a packed session seed is the
    // ceremony's business (and untrusted URL text - section 11.21), and a caller that wants
    // it subscribes to `transport.on('message')` itself.
  }

  function onPresenceFrame(frame: PresenceFrame): void {
    if (closed) return;
    // Our own frame relayed back is never our own roster entry (the presence engine
    // drops it too - this saves the round trip through it).
    if (frame.from === selfId) return;
    if (guard && !guard.recordAndCheckRate('presence', 1, now())) {
      disconnect('presence-rate-limited');
      return;
    }
    notePeer(frame.from);
    presenceIn.emit(frame);
  }

  const offMessage = transport.on('message', (message: RtcInboundMessage) => {
    if (closed) return;
    if (message.lane === 'ops') {
      if (message.kind === 'hello') onHello(message);
      else onOpsFrame(message.op);
      return;
    }
    if (message.lane === 'presence') onPresenceFrame(message.frame);
    // The beam lane belongs to `lib/beam-sink.ts`; a session never reads it.
  });

  const offState = transport.on('state', (state: RtcTransportState) => {
    setConnection(state.connection);
  });

  // ── the adapter ─────────────────────────────────────────────────────────────────

  /**
   * `onLocalChange` and `apply` are the LOCAL doors and put what they produce on the
   * wire; `applyRemotePatch` is the REMOTE door and sends nothing - blurring the two
   * is where an echo storm would come from.
   *
   * An observer's local doors are inert (contract section 9's observer-only join, and
   * `collab-session.ts`'s `observerAdapter`, which wraps this the same way when the
   * demotion is known at construction). It is enforced HERE as well because the section 11.19
   * downgrade arrives in band, on the hello, which can land after the session has
   * already wrapped the adapter - at which point the session's wrapper is the writer
   * one forever.
   */
  const adapter: CanvasSyncAdapter = {
    onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
      if (closed || role === 'observer') return [];
      const ops = doc.onLocalChange(damage, rows, col);
      queueLocal(ops);
      return ops;
    },
    apply(op: CanvasOp): void {
      if (closed || role === 'observer') return;
      doc.apply(op);
      queueLocal([op]);
    },
    applyRemotePatch(ops: readonly CanvasOp[]): Damage {
      // Indexed as well as applied, so "the register index mirrors the document" - 
      // the invariant the whole backstop rests on - holds even for ops that reached
      // the document through a caller rather than through our own inbound path (a
      // catch-up seed, the loopback harness). Idempotent for the ordinary case, where
      // these are the very ops `onOpsFrame` has already indexed.
      for (const op of ops) indexOp(op);
      return doc.applyRemotePatch(ops);
    },
    presence(awareness: Awareness): void {
      // Ephemeral, and NOT written to the lane from here: the session's presence
      // engine owns cadence and the per-sender `seq` (section 11.5), and it hands its frames
      // to `sendPresence` below. Sending from both doors would put unsequenced
      // duplicates on an unordered channel.
      doc.presence(awareness);
    },
    state(): CanvasDocState {
      return doc.state();
    },
  };

  function sendPresence(frame: PresenceFrame): void {
    if (closed) return;
    const result = transport.sendPresence(frame);
    // The presence lane is lossy by construction (`maxRetransmits: 0`): a refused
    // frame is covered by the next heartbeat and is never an error.
    if (result !== 'sent') log('rtc-handle: presence frame not sent', result);
  }

  function peerRole(clientId: string): CollabRole | undefined {
    if (clientId === selfId) return role;
    if (!knownPeers.has(clientId)) return undefined;
    // Both peers see the same mismatch and both demote (contract section 9), so saying
    // 'writer' about a peer we know cannot write is the harmful direction.
    if (clientId === peerId && peerVersion !== undefined && !isCompatibleOpVersion(peerVersion)) {
      return 'observer';
    }
    return 'writer';
  }

  function close(): void {
    if (closed) return;
    closed = true;
    // Ops queued in this microtask are still the user's work: one best-effort frame
    // before the channel goes, which costs nothing if the lane is already gone.
    flushOutbound();
    disarmTimers();
    chunkQueue = [];
    if (connection !== 'closed') {
      connection = 'closed';
      events.emit('closed');
    }
    offMessage();
    offState();
    try {
      transport.close();
    } catch {
      /* a transport that is already gone is not a failure of the view */
    }
    events.clear();
    roleIn.clear();
    presenceIn.clear();
    opsIn.clear();
    history.dispose();
  }

  // A transport that was already live when the handle was built never emits a state
  // change, so the backstop would never be armed. (The document is empty at this
  // point, so there is nothing to exchange.)
  if (connection === 'live') {
    everLive = true;
    armBackstop();
  }

  return {
    adapter,
    get role(): CollabRole {
      return role;
    },
    history,
    self,
    presenceIn: presenceIn.stream,
    sendPresence,
    events: events.stream,
    close,
    /** section 6.2a: the inviter owns the session, so the inviter is the host. The acceptor
     *  learns it from the hello and reads `undefined` until then, which is exactly
     *  what `CollabParticipant.isHost` treats as "nobody declared a host yet". */
    get hostClientId(): string | undefined {
      return opts.role === 'inviter' ? selfId : peerId;
    },
    peerRole,
    transport,
    opsIn: opsIn.stream,
    roleIn: roleIn.stream,
    peerClientId: () => peerId,
    peerOpVersion: () => peerVersion,
    peerHistoryProtocol: () => peerHistory,
    historySharingAvailable: () => historySharingAgreed(peerHistory),
    reason: () => reason,
    exchangeState,
    docState: () => doc.state(),
  };
}
