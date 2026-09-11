// SPDX-License-Identifier: MPL-2.0
/**
 * org/collab-protocol - the WORK-COLLAB wire protocol (plan 100 section 7, wave 3.1).
 *
 * Types + pure helpers only: no socket, no DOM, no module state. This file is the
 * shell's written-down copy of the gateway contract implemented in lolly-work
 * (`server/src/collab/gateway.ts` + `rooms.ts`, its plans/14). Every frame shape,
 * close code and cap below has been RECONCILED against that implementation - where
 * a field name or a number is essential, the server file and symbol that owns it
 * is named beside it, so the next drift is a diff rather than a rediscovery.
 *
 * The endpoint: `wss://<instance-base>/ws/collab/<sessionId>`.
 *
 *   client → server   {t:'join', opVersion}
 *                     {t:'ops', ops}                   ← at most MAX_OPS_PER_FRAME
 *                     {t:'presence', frame}
 *                     {t:'leave'}
 *
 *   server → client   {t:'join-ack', roster, docState, serverClock, opVersion,
 *                                    you, notice?, unsynced?}
 *                     {t:'ops', from, ops}             ← peers only; never echoed to the sender
 *                     {t:'presence', from, frame}
 *                     {t:'peer-join', member}
 *                     {t:'peer-leave', id}             ← the CONNECTION id, not a user id
 *                     {t:'error', code, message, inputs?}  ← sender-only (input-locked veto)
 *                     + typed close codes (COLLAB_CLOSE)
 *
 * ── AUTH IS A COOKIE, SO THE GATEWAY IS SAME-ORIGIN ONLY ─────────────────────
 *
 * The upgrade carries no token: the gateway reads the instance's session cookie off
 * the upgrade request and refuses before the handshake (gateway.ts's `readPrincipal`
 * + `refuse(socket, 401)`). That cookie is `SameSite=Lax` (lolly-work
 * `server/src/iam/sessions.ts`), and a browser does NOT attach a Lax cookie to a
 * CROSS-SITE WebSocket handshake - so a shell pointed at a remote instance base
 * (lib/instance.ts) cannot authenticate at all, and the failure arrives as a bare
 * abnormal close with nothing to diagnose it by. Adding the origin to CSP
 * `connect-src` does not fix that; nothing on the client can.
 *
 * So the derivation REFUSES a cross-origin endpoint outright (`isCrossOriginSocket`
 * below, applied in org/collab-provider.ts's `endpoint()`), and the session ends
 * with a stated reason instead of an unexplained reconnect loop. A hosted work
 * collab on a remote base needs a server-side answer first (a same-site cookie
 * attribute the deployment can actually set, or a one-time ticket in the URL) - 
 * plan 100 section 7 gains that line before the remote case ships.
 *
 * CSP (plan 100 section 11.8 records that WebRTC is invisible to CSP; a WebSocket is NOT).
 * `connect-src 'self'` - what vercel.json and deploy/docker/nginx.conf both ship - 
 * covers the same-origin `wss:` upgrade this module allows, because 'self' matches
 * the page's own origin across the http→ws scheme pair. Nothing else is reachable,
 * which is also why the CSP egress inventory gains no new host for this feature.
 *
 * SERVER FRAMES ARE UNTRUSTED INPUT. Every field on a `server → client` frame is
 * declared optional here on purpose: the parser (`parseServerFrame`) proves only
 * that a frame is a JSON object with a known `t`, and each handler validates what it
 * actually reads. Ops get a structural gate (`isCanvasOp`) - deliberately NOT the
 * deep one: the ajv `validateCanvasOp` + shared op guard is separate concurrent work
 * (plan 100 section 11.21), and the integration must route inbound ops through it once it
 * lands. See the concerns note in org/collab-provider.ts.
 */

import { CANVAS_OP_VERSION, DEFAULT_GEOMETRY_FIELDS } from '@lolly-tools/core/canvas-op-v1';
import type {
  BoxId,
  BoxRow,
  CanvasOp,
  GeometryField,
  OpOrigin,
  ParamValue,
  Scalar,
} from '@lolly-tools/core/canvas-op-v1';
// The order-key progression the contract's own `damageToOps` threads, already
// mirrored once (and pinned by a test) in the shell's plumbing. Imported rather than
// re-derived so a snapshot seed sorts into the SAME space as a peer's live adds.
import { orderKeysFor } from '../lib/collab-plumbing.ts';

/** Path prefix of the gateway endpoint; the session id is the last segment. */
export const COLLAB_WS_PATH = '/ws/collab';

/** The op-contract version this shell announces at join. */
export const COLLAB_OP_VERSION = CANVAS_OP_VERSION;

/** A joiner is either allowed to write ops or is present read-only. A version-major
 *  mismatch, or a principal without `session.edit`, resolves to 'observer' (plan 100
 *  section 7.6 / plans/99 section 9) - never to a refused join. */
export type CollabRole = 'writer' | 'observer';

/** One participant as the gateway lists them (lolly-work rooms.ts `RosterEntry`).
 *  Identity comes from the org session (SSO), so names are real names - plan 100
 *  section 4.5.
 *
 *  `id` is the CONNECTION id and is what `peer-leave` names; `userId` is the
 *  principal, and one principal can hold several connections (two tabs, a phone).
 *  Roster identity is therefore `id` when the gateway sent one, `userId` only as
 *  the fallback for a gateway that does not - keying on `userId` alone would drop
 *  a user's second device from the roster the moment their first one left. */
export interface RosterEntry {
  readonly id?: string;
  readonly userId: string;
  readonly name?: string;
  readonly color?: string;
  readonly role?: CollabRole;
}

// ── The document snapshot, in its JSON form ───────────────────────────────────

/**
 * `CanvasDocState` uses `Map`s, which do not survive `JSON.stringify` - so the wire
 * form of a snapshot is plain objects. This is the shape `join-ack.docState` carries.
 * Every field is optional: an empty room sends an empty (or absent) snapshot.
 */
export interface WireBoxes {
  readonly order?: readonly BoxId[];
  readonly boxes?: Readonly<Record<BoxId, BoxRow>>;
}

export interface WireDocState extends WireBoxes {
  readonly params?: Readonly<Record<string, ParamValue>>;
  /** v1.1 collections - one boxes-shaped doc per `blocks` input id. */
  readonly collections?: Readonly<Record<string, WireBoxes>>;
}

// ── Frames: client → server ───────────────────────────────────────────────────

/**
 * The presence lane's payload is deliberately OPAQUE to this module - it is never
 * read here, only forwarded. Two shapes legitimately ride it and the choice is not
 * this file's to make: the contract's own `Presence`/`Awareness` (what
 * `CanvasSyncAdapter.presence` takes), and the shell's richer `PresenceFrame`
 * (`lib/collab-presence.ts`), which wraps a presence state with the per-sender
 * `seq` that the newest-only rule for an unordered lane needs (plan 100 section 11.5) and
 * an `away` bit (section 11.4). Typing this `Presence` here would quietly forbid the
 * second, which is the one the wave-1 presence engine actually produces.
 */
export type CollabPresencePayload = unknown;

export interface JoinFrame { readonly t: 'join'; readonly opVersion: string }
export interface ClientOpsFrame { readonly t: 'ops'; readonly ops: readonly CanvasOp[] }
export interface ClientPresenceFrame { readonly t: 'presence'; readonly frame: CollabPresencePayload }
export interface LeaveFrame { readonly t: 'leave' }

export type ClientFrame = JoinFrame | ClientOpsFrame | ClientPresenceFrame | LeaveFrame;

// ── Frames: server → client (all fields optional - untrusted) ─────────────────

export interface JoinAckFrame {
  readonly t: 'join-ack';
  /** The OTHER members. The gateway excludes the joiner deliberately (rooms.ts
   *  `join()`: "a new arrival that sees itself in the roster renders an orphan
   *  ghost of itself") - self is `you`. */
  readonly roster?: readonly RosterEntry[];
  readonly docState?: WireDocState | null;
  /**
   * The ROOM-WIDE highest `origin.clock` the gateway has accepted, over every
   * client (lolly-work rooms.ts: `private serverClock = 0` … `if (op.origin.clock >
   * this.serverClock) this.serverClock = op.origin.clock`).
   *
   * It is NOT this client's accepted-clock high-water mark, and it must never be
   * used as an ack watermark: a peer's clock alone can carry it past everything
   * this device ever minted, which would retire outbox entries the gateway never
   * received. The per-client `highestClock` map the gateway dedups replays against
   * is not published, so there is no watermark ack on this wire at all - see the
   * ack rules in org/collab-provider.ts.
   *
   * What it IS good for: a Lamport floor. This device's next minted clock must
   * exceed every clock the room has accepted, or the gateway's strictly-monotonic
   * per-client dedup silently drops it.
   */
  readonly serverClock?: number;
  readonly opVersion?: string;
  /** THE joiner's own seat, as the gateway assigned it - `you.role` is the
   *  authoritative role (gateway.ts `doJoin` → `ack.you`). A top-level `role` is
   *  accepted as a fallback for a gateway that publishes it that way; absent from
   *  BOTH, the client seats itself as an observer (fail closed). */
  readonly you?: RosterEntry;
  readonly role?: CollabRole;
  /** Why a would-be writer was seated read-only: 'no-edit-grant' |
   *  'op-version-observer' | 'room-full-view-only' (rooms.ts `JoinNotice`). */
  readonly notice?: string;
  /** Input ids in the stored session that the op contract cannot sync, declared
   *  "so a client shows them read-only instead of silently diverging"
   *  (rooms.ts `seedOpsFromInputs`). */
  readonly unsynced?: readonly string[];
  readonly reason?: string;
}

export interface ServerOpsFrame {
  readonly t: 'ops';
  /** The originating CONNECTION id - NOT the device client id that stamps
   *  `op.origin.client`, and not a user id either (rooms.ts `applyOps` broadcasts
   *  `from: from.id`). Acking matches on the origin pair, never on this.
   *
   *  This frame reaches PEERS ONLY: `applyOps` skips the sender (`if (peer.id ===
   *  from.id) continue`), so a writer never sees its own ops come back. The echo
   *  ack rule in org/collab-provider.ts therefore never fires against this gateway
   * - it is kept because it costs nothing and is exact where it does apply. */
  readonly from?: string;
  readonly ops?: readonly CanvasOp[];
}

export interface ServerPresenceFrame {
  readonly t: 'presence';
  readonly from?: string;
  readonly frame?: CollabPresencePayload;
}

export interface PeerJoinFrame {
  readonly t: 'peer-join';
  /** The arriving member (rooms.ts: `{t:'peer-join', member}`). */
  readonly member?: RosterEntry;
  /** Alias accepted for a gateway that names the same thing `peer`. */
  readonly peer?: RosterEntry;
  readonly from?: string;
  /** The gateway may send the whole roster instead of (or beside) the one peer. */
  readonly roster?: readonly RosterEntry[];
}

export interface PeerLeaveFrame {
  readonly t: 'peer-leave';
  /** The departing CONNECTION id (rooms.ts: `{t:'peer-leave', id}`) - matched
   *  against `RosterEntry.id`, falling back to `userId`. */
  readonly id?: string;
  readonly from?: string;
  readonly roster?: readonly RosterEntry[];
}

/** A per-sender error. Input-locked vetoes go to the SENDER only - never broadcast - 
 *  so `inputs` names the inputs the gateway refused to write (gateway.ts groups a
 *  batch's rejections by code and sends one frame per code). `inputId` is the
 *  single-input alias. */
export interface ErrorFrame {
  readonly t: 'error';
  readonly code?: string;
  readonly inputs?: readonly string[];
  readonly inputId?: string;
  readonly message?: string;
}

export type ServerFrame =
  | JoinAckFrame
  | ServerOpsFrame
  | ServerPresenceFrame
  | PeerJoinFrame
  | PeerLeaveFrame
  | ErrorFrame;

const SERVER_FRAME_TYPES = new Set(['join-ack', 'ops', 'presence', 'peer-join', 'peer-leave', 'error']);

/**
 * Parse one inbound message. Returns null for anything that is not a JSON object
 * carrying a known `t` - a binary frame, a truncated payload, a hostile string. The
 * caller ignores nulls rather than closing: a gateway minor may add frame types this
 * build does not know, and an unknown frame must be inert, not fatal.
 */
export function parseServerFrame(data: unknown): ServerFrame | null {
  if (typeof data !== 'string') return null;
  let body: unknown;
  try {
    body = JSON.parse(data);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const t = (body as { t?: unknown }).t;
  if (typeof t !== 'string' || !SERVER_FRAME_TYPES.has(t)) return null;
  return body as ServerFrame;
}

// ── Close codes ───────────────────────────────────────────────────────────────

/**
 * The application close codes, VERBATIM from lolly-work `server/src/collab/
 * gateway.ts`'s `CLOSE` (4000-4999 is the private-use range RFC 6455 reserves for
 * applications, so these can never collide with a transport-level code).
 *
 * There is deliberately no NOT_FOUND / ROOM_FULL / UNSUPPORTED_VERSION here: the
 * gateway refuses an unknown or unreadable session with a plain HTTP 401/404 on the
 * upgrade (no socket is ever created - the browser reports that as 1006), and a
 * full room or an incompatible op major seats the joiner as an OBSERVER rather than
 * closing (rooms.ts `JoinNotice`). Inventing codes for those cases is how the
 * previous table came to disagree with the gateway on what 4003 and 4004 mean.
 */
export const COLLAB_CLOSE = {
  /** Clean shutdown - either side. */
  NORMAL: 1000,
  /** The caller stopped being a live member while the socket was open - disabled,
   *  session-epoch bumped, or the cookie expired. */
  UNAUTHORIZED: 4001,
  /** No `join` frame within the gateway's join timeout. */
  JOIN_TIMEOUT: 4003,
  /** Unparseable frame, unknown type, or a second `join`. */
  PROTOCOL: 4004,
  /** Presence frames over PRESENCE_FRAMES_PER_SEC. */
  PRESENCE_RATE: 4008,
  /** More than MAX_OPS_PER_FRAME ops in one message. */
  OPS_RATE: 4009,
  /** The gateway is shutting down (a restart, a redeploy, a rolling upgrade). */
  GOING_AWAY: 4010,
} as const;

/**
 * Which closes are ANSWERS rather than blips - the ones where reconnecting would
 * only repeat the same refusal:
 *
 *   1000 normal, 1008 policy violation, 4001 unauthorized, 4004 protocol.
 *
 * Everything else gets the backoff, INCLUDING the rest of the private range. That
 * default is the important half. `GOING_AWAY` (4010) is how the gateway signals its
 * own restart, and a blanket "4000-4999 is terminal" rule turned every redeploy into
 * a permanent kill for every live collab in the fleet - the exact opposite of what a
 * restart should mean. A code this build does not recognise is far more likely to be
 * a newer gateway's transient condition than a permanent verdict, and the cost of
 * guessing wrong is bounded by the backoff: jittered, capped at 30 s.
 *
 * 4009 OPS_RATE and 4008 PRESENCE_RATE are retryable for the same reason - a burst
 * is a moment, not a verdict - and the client no longer produces the op-rate one at
 * all now that every `ops` frame is chunked to MAX_OPS_PER_FRAME.
 */
const TERMINAL_CLOSE_CODES: ReadonlySet<number> = new Set([
  COLLAB_CLOSE.NORMAL,
  1008,
  COLLAB_CLOSE.UNAUTHORIZED,
  COLLAB_CLOSE.PROTOCOL,
]);

export function isTerminalClose(code: number): boolean {
  return TERMINAL_CLOSE_CODES.has(code);
}

// ── Socket shape (structural, so a fake needs six lines) ──────────────────────

export interface CollabSocketEvent { readonly data?: unknown }
export interface CollabCloseEvent { readonly code?: number; readonly reason?: string }

/**
 * The slice of `WebSocket` this client uses. Deliberately the `on*` handler form
 * rather than `addEventListener`: teardown is then exactly "null the four fields",
 * which is both the smallest fake a test can write and the strongest guarantee that
 * `close()` really does stop delivering events.
 */
export interface CollabSocket {
  readyState?: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: CollabSocketEvent) => void) | null;
  onclose: ((ev: CollabCloseEvent) => void) | null;
  onerror: ((ev: unknown) => void) | null;
}

export type CollabSocketCtor = new (url: string) => CollabSocket;

/** `WebSocket.OPEN`. Spelled out so this module needs no DOM lib at runtime. */
export const SOCKET_OPEN = 1;

// ── URL derivation ────────────────────────────────────────────────────────────

/**
 * Turn an instance-resolved gateway PATH into a socket URL. `resolved` is whatever
 * `instancePath()` returned: a root-relative path in the ordinary same-origin case,
 * or an absolute `https://…` URL when the shell is pointed at a remote instance
 * base. Both are handled by resolving against the page URL and swapping the scheme - 
 * `http:` → `ws:` (a dev server on localhost), everything else → `wss:`, which keeps
 * a mixed-content downgrade unreachable from an https page.
 */
export function collabSocketUrl(resolved: string, pageHref: string): string {
  const u = new URL(resolved, pageHref);
  u.protocol = u.protocol === 'http:' ? 'ws:' : 'wss:';
  return u.toString();
}

/**
 * Is this socket URL a different origin from the page? See the module header: the
 * gateway authenticates from a `SameSite=Lax` cookie, which a browser will not
 * attach to a cross-site upgrade, so a cross-origin endpoint cannot succeed and must
 * be refused with a stated reason rather than retried forever.
 *
 * Unparseable ⇒ treated as cross-origin: refusing an endpoint we cannot reason about
 * is the failure that says why.
 */
export function isCrossOriginSocket(socketUrl: string, pageHref: string): boolean {
  try {
    const page = new URL(pageHref);
    const sock = new URL(socketUrl);
    if (sock.host !== page.host) return true;
    return sock.protocol !== (page.protocol === 'http:' ? 'ws:' : 'wss:');
  } catch {
    return true;
  }
}

// ── Outbound framing caps (the gateway's, mirrored) ───────────────────────────

/**
 * Ops the gateway accepts in ONE `ops` message - lolly-work rooms.ts
 * `MAX_OPS_PER_MESSAGE`. Exceeding it is not an error frame: gateway.ts closes the
 * socket with `CLOSE.OPS_RATE`. Every outbound batch (a live gesture as much as an
 * outbox replay) is chunked to this, so the client cannot trip it.
 */
export const MAX_OPS_PER_FRAME = 200;

/**
 * Byte budget for one serialized frame. The gateway's `WebSocketServer` runs with
 * `maxPayload: MAX_MESSAGE_BYTES` (256 KiB) and a browser answers an oversize frame
 * by closing (1009), so the op-count cap alone is not enough - 200 ops carrying long
 * text scalars pass the count and blow the payload. 192 KiB leaves headroom for
 * multi-byte UTF-8 the estimate below cannot see.
 */
export const MAX_FRAME_BYTES = 192 * 1024;

/** `{"t":"ops","ops":[]}` plus slack, so the budget is spent on ops. */
const FRAME_ENVELOPE_BYTES = 64;

function jsonByteLength(value: unknown): number {
  const json = JSON.stringify(value) ?? '';
  // TextEncoder is a platform global everywhere this runs (browser, Node, Tauri);
  // the fallback keeps the helper honest in an exotic host rather than throwing.
  const enc = (globalThis as { TextEncoder?: new () => { encode(s: string): { length: number } } }).TextEncoder;
  return enc ? new enc().encode(json).length : json.length;
}

/**
 * Split ops into frames that satisfy BOTH caps, order preserved. A single op larger
 * than the byte budget is sent alone rather than dropped - the gateway will refuse
 * it, which is a visible answer, whereas dropping it here would be a silent one.
 */
export function chunkOps(
  ops: readonly CanvasOp[],
  maxOps: number = MAX_OPS_PER_FRAME,
  maxBytes: number = MAX_FRAME_BYTES,
): CanvasOp[][] {
  const out: CanvasOp[][] = [];
  let batch: CanvasOp[] = [];
  let bytes = FRAME_ENVELOPE_BYTES;
  for (const op of ops) {
    const size = jsonByteLength(op) + 1; // + the separating comma
    if (batch.length > 0 && (batch.length >= maxOps || bytes + size > maxBytes)) {
      out.push(batch);
      batch = [];
      bytes = FRAME_ENVELOPE_BYTES;
    }
    batch.push(op);
    bytes += size;
  }
  if (batch.length > 0) out.push(batch);
  return out;
}

// ── Structural op gate (see the header: NOT the deep validator) ───────────────

const OP_KINDS = new Set(['geom', 'field', 'add', 'remove', 'order', 'param']);

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isScalar(v: unknown): v is Scalar {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/** A plain object whose every value is a scalar (a `BoxRow` on the wire). */
function isBoxRow(v: unknown): v is BoxRow {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(isScalar);
}

/** True for a literal or a `{bind}` provider descriptor (plans/99 section 6). */
export function isParamValue(v: unknown): v is ParamValue {
  if (isScalar(v)) return true;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const bind = (v as { bind?: unknown }).bind;
  return !!bind && typeof bind === 'object'
    && typeof (bind as { provider?: unknown }).provider === 'string';
}

/**
 * Structural gate for one inbound op: the discriminant, the origin stamp, and the
 * fields that op kind cannot work without. Enough that nothing downstream reads
 * `undefined` off a hostile frame - NOT enough to be the security boundary, which is
 * the ajv validator plus the manifest own-property whitelist (plan 100 section 11.21).
 */
export function isCanvasOp(v: unknown): v is CanvasOp {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const op = v as Record<string, unknown>;
  if (typeof op.k !== 'string' || !OP_KINDS.has(op.k)) return false;
  const origin = op.origin as { client?: unknown; clock?: unknown } | undefined;
  if (!origin || typeof origin !== 'object') return false;
  if (typeof origin.client !== 'string' || !isFiniteNumber(origin.clock)) return false;
  if (op.k === 'param') return typeof op.key === 'string' && isParamValue(op.value);
  if (typeof op.id !== 'string' || !op.id) return false;
  if (op.col !== undefined && typeof op.col !== 'string') return false;
  switch (op.k) {
    case 'geom': {
      const fields = op.fields;
      if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
      return Object.values(fields as Record<string, unknown>).every(isFiniteNumber);
    }
    case 'field':
      return typeof op.field === 'string' && isScalar(op.value);
    case 'add':
      return typeof op.orderKey === 'string' && isBoxRow(op.row);
    case 'order':
      return typeof op.orderKey === 'string';
    default:
      return true; // remove - id + origin is the whole payload
  }
}

/** Keep only the ops of a frame that pass the structural gate. */
export function sanitizeOps(v: unknown): CanvasOp[] {
  return Array.isArray(v) ? v.filter(isCanvasOp) : [];
}

// ── Snapshot → ops (the join-ack seed) ────────────────────────────────────────

const GEOM_SET = new Set<string>(DEFAULT_GEOMETRY_FIELDS);

function boxesToOps(
  wire: WireBoxes | undefined,
  origin: OpOrigin,
  col: string | undefined,
  out: CanvasOp[],
): void {
  const boxes = wire?.boxes;
  if (!boxes || typeof boxes !== 'object') return;
  // `order` is the paint order; ids present in `boxes` but missing from it are
  // appended in key order so a partial/absent order never drops a row.
  const declared = Array.isArray(wire?.order) ? wire.order.filter((id) => typeof id === 'string') : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of declared) {
    if (Object.hasOwn(boxes, id) && !seen.has(id)) { seen.add(id); ids.push(id); }
  }
  for (const id of Object.keys(boxes)) {
    if (!seen.has(id)) { seen.add(id); ids.push(id); }
  }
  const keys = orderKeysFor(ids.length);
  const scope: { col?: string } = col === undefined ? {} : { col };
  ids.forEach((id, i) => {
    const row = boxes[id];
    if (!isBoxRow(row)) return;
    // Membership + paint order first, with an EMPTY row, then the fields as their
    // own ops - so `withoutHeldKeys` can drop exactly one field of one box without
    // having to take apart an `add`, and so the geometry lane stays a `geom` op
    // (plans/99 section 4.3: a move must never invalidate a raster).
    out.push({ k: 'add', id, row: {}, orderKey: keys[i]!, origin, ...scope });
    const geom: Partial<Record<GeometryField, number>> = {};
    let geomChanged = false;
    for (const field of Object.keys(row)) {
      const value = row[field] as Scalar;
      if (GEOM_SET.has(field) && isFiniteNumber(value)) {
        geom[field as GeometryField] = value;
        geomChanged = true;
      } else {
        out.push({ k: 'field', id, field, value, origin, ...scope });
      }
    }
    if (geomChanged) out.push({ k: 'geom', id, fields: geom, origin, ...scope });
  });
}

/**
 * A `join-ack` snapshot expressed as the op list that reproduces it - the one form
 * both the local convergence doc and the runtime plumbing already consume, so a seed
 * needs no second apply path of its own.
 *
 * The snapshot carries no per-key origins, so the whole seed takes ONE invented
 * origin. The caller supplies it (see org/collab-provider.ts: client `''`, which
 * loses every `(clock, client)` tie-break, at the gateway's `serverClock`).
 */
export function docStateToOps(state: WireDocState | null | undefined, origin: OpOrigin): CanvasOp[] {
  const out: CanvasOp[] = [];
  if (!state || typeof state !== 'object') return out;
  boxesToOps(state, origin, undefined, out);
  const collections = state.collections;
  if (collections && typeof collections === 'object') {
    for (const col of Object.keys(collections)) {
      boxesToOps(collections[col], origin, col, out);
    }
  }
  const params = state.params;
  if (params && typeof params === 'object') {
    for (const key of Object.keys(params)) {
      const value = params[key];
      if (isParamValue(value)) out.push({ k: 'param', key, value, origin });
    }
  }
  return out;
}

// ── Held keys: what an unacked local op owns, and the snapshot may not overwrite ─

/**
 * The register keys one op writes. Used to answer "does the snapshot I just received
 * overwrite an edit of mine the gateway has not accepted yet?" - geometry and content
 * share the `f` namespace deliberately, because a `geom` op and a `field` op on `x`
 * write the SAME register.
 */
export function opKeys(op: CanvasOp): string[] {
  if (op.k === 'param') return [`p\u0000${op.key}`];
  const box = `${op.col ?? ''}\u0000${op.id}`;
  switch (op.k) {
    case 'field':
      return [`f\u0000${box}\u0000${op.field}`];
    case 'geom':
      return Object.keys(op.fields).map((f) => `f\u0000${box}\u0000${f}`);
    case 'order':
      return [`o\u0000${box}`];
    case 'remove':
      return [`m\u0000${box}`];
    default:
      return [`m\u0000${box}`, `o\u0000${box}`, ...Object.keys(op.row).map((f) => `f\u0000${box}\u0000${f}`)];
  }
}

/** Newest-wins index of every register the given (outbox) ops own. */
export function heldKeyIndex(ops: readonly CanvasOp[]): Map<string, CanvasOp> {
  const held = new Map<string, CanvasOp>();
  for (const op of ops) for (const key of opKeys(op)) held.set(key, op);
  return held;
}

/**
 * Strip from a SEED op everything an unacked local op already owns, returning null
 * when nothing of it survives.
 *
 * Why this exists rather than a clock trick: the seed's invented origin is a single
 * watermark, and any single watermark is wrong in one direction or the other - high
 * enough to carry a peer's edits made while we were away is also high enough to
 * clobber our own unacked edit, which would make the user's typing visibly revert
 * and never come back (their replayed op keeps its original, lower, clock). Filtering
 * by register is the version with no invented ordering in it at all: the seed governs
 * every key we are not holding, and we govern the ones we are.
 */
export function withoutHeldKeys(op: CanvasOp, held: ReadonlyMap<string, CanvasOp>): CanvasOp | null {
  const [first] = opKeys(op);
  switch (op.k) {
    case 'param':
    case 'field':
    case 'order':
    case 'remove':
      return first !== undefined && held.has(first) ? null : op;
    case 'geom': {
      const box = `${op.col ?? ''}\u0000${op.id}`;
      const fields: Partial<Record<GeometryField, number>> = {};
      let kept = false;
      for (const field of Object.keys(op.fields)) {
        if (held.has(`f\u0000${box}\u0000${field}`)) continue;
        const v = op.fields[field as GeometryField];
        if (v === undefined) continue;
        fields[field as GeometryField] = v;
        kept = true;
      }
      return kept ? { ...op, fields } : null;
    }
    default: {
      // `add`: membership is all-or-nothing - an unacked add/remove of ours owns
      // whether the row exists at all, so the seed must not restate it. Otherwise
      // the seed keeps membership but yields the paint-order key to a pending
      // order/add of ours, which would otherwise lose to the watermark forever.
      const box = `${op.col ?? ''}\u0000${op.id}`;
      if (held.has(`m\u0000${box}`)) return null;
      const pending = held.get(`o\u0000${box}`);
      const orderKey = pending && (pending.k === 'order' || pending.k === 'add')
        ? pending.orderKey
        : op.orderKey;
      const row: BoxRow = {};
      for (const field of Object.keys(op.row)) {
        if (held.has(`f\u0000${box}\u0000${field}`)) continue;
        row[field] = op.row[field] as Scalar;
      }
      return { ...op, row, orderKey };
    }
  }
}

/** The `(client, clock)` pair the gateway dedups on - one gesture's ops all share it,
 *  so it identifies a BATCH, which is exactly the granularity an ack arrives at. */
export function originKey(origin: OpOrigin): string {
  return `${origin.client}\u0000${origin.clock}`;
}
