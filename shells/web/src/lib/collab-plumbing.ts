// SPDX-License-Identifier: MPL-2.0
/**
 * collab-plumbing - the transport-blind seam between ONE mounted tool's runtime and
 * a registered collaboration provider (plan 100 section 5, wave 0.5).
 *
 * INERTNESS IS THE CONTRACT. `attachCollabPlumbing` asks `getCanvasSyncProvider()`
 * for an adapter and returns `null` when there is none - it does not wrap
 * `runtime.setInput`, does not schedule a frame, does not read IndexedDB, does not
 * mint an id. With no provider registered (this repo ships none - plans/99 section 1.1)
 * a tool mount is byte-identical to single-player, and its co-located test proves
 * that with a call-count spy rather than by inspection.
 *
 * The two directions, per section 5:
 *
 *  - OUTBOUND. mountTool already wraps `runtime.setInput` once for undo history - 
 *    the one chokepoint every control and every canvas commit flows through. We wrap
 *    that wrapper, so a local edit becomes ops for the adapter. A history REPLAY
 *    (undo/redo) is a local edit and syncs like any other: it is just another LWW
 *    write (section 5, section 11.15). Only a remote apply is excluded. Deliberately NOT wrapped:
 *    `runtime.setInputNoHistory`, the escape hatch for writes that are not user
 *    edits - deck slide navigation through it is *location*, which is a presence
 *    field (section 4.2), not a document write, and forcing every peer to my slide is the
 *    bug that would cause.
 *
 *  - INBOUND. `applyRemotePatch(ops)` coalesces per animation frame and lands the
 *    batch through `runtime.applyPatch` - the engine's atomic multi-input apply
 *    (section 5). That path never re-enters `setInput`, so remote values (a) cannot record
 *    an undo step and (b) cannot echo back out as ops. The `applyingRemote` guard is
 *    belt-and-braces for a future refactor that routes it differently, and is held
 *    only across the SYNCHRONOUS part of the apply (see flush()). The VALUES in that
 *    patch come from the adapter's post-apply `state()`, never from `op.value` - the
 *    ops say which keys the batch touched, the document says what those keys now
 *    hold. See {@link ConvergedRead} for why reading the payload instead makes two
 *    peers' documents converge while their models permanently diverge.
 *
 * WHAT CROSSES THE SEAM (plan 100 section 3, plans/99 section 7):
 *  - a scalar input → one `ParamOp` keyed by the input id;
 *  - a `blocks` input → the box ops, scoped by `col` = the input id (v1.1), keyed by
 *    the row's stable ULID (lib/row-id.ts), with geometry fields on the geometry
 *    lane via the contract's own `laneForField`/`damageToOps`.
 * Object-valued inputs (asset refs, `vector`, `table`, `file`) do NOT: `ParamValue`
 * and `BoxRow` are scalar by contract, and file bytes/live frames are excluded
 * outright. A blocks row's non-scalar fields are simply not projected, so they are
 * neither sent nor clobbered by an inbound rebuild.
 *
 * TWO CONTRACT GAPS, worked around here and reported rather than papered over:
 *  1. `CanvasSyncAdapter` has no local entry point for a `param` write, and none for
 *     a gesture the adapter's own differ never sees. `onLocalChange` takes a row MAP,
 *     so the shell decides which gestures reach it: a pure REORDER changes no row, so
 *     it does not, and the shell mints the `OrderOp`s itself from the runtime's array
 *     (which is the order truth - an adapter's document can lag it). Both kinds are
 *     delivered through `apply()`, the contract's single-op door (`applyRemotePatch`
 *     being explicitly the REMOTE door). An adapter that DOES emit order ops of its
 *     own is honoured instead (the guard in emitCollection) - the contract's
 *     `damageToOps` now restates order whenever the sequence changed. A future v1.2
 *     may want an explicit `onLocalOps(ops)`.
 *  2. Ops the adapter mints carry ITS Lamport clock, ops we mint carry ours. We
 *     absorb every clock we see (`observeClock`) before minting, which is the
 *     Lamport rule and is what keeps a shell-minted OrderOp strictly newer than the
 *     adapter-minted AddOp it must override.
 *
 * No wall clock anywhere in this file: ordering is `(clock, client)` only, so an
 * airgapped device with a wrong clock converges identically (section 11.7).
 */

import {
  DEFAULT_GEOMETRY_FIELDS,
  damageToOps,
  opsToDamage,
} from '@lolly-tools/core/canvas-op-v1';
import type {
  BoxId,
  BoxRow,
  CanvasDocState,
  CanvasOp,
  CanvasSyncAdapter,
  OpOrigin,
  OrderOp,
  ParamOp,
  Scalar,
} from '@lolly-tools/core/canvas-op-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { getCanvasSyncProvider } from './canvas-sync-provider.ts';
// `rowIdField` is shared with the sidebar (where rows are BORN with an id) and the
// canvas: a row minted under one name and addressed under another is a row nothing
// can resolve, so there is exactly one definition and it lives in a DOM-free module.
import { rowIdField, ulid } from './row-id.ts';

/** The runtime slice this module drives - a structural subset of the web shell's
 *  ToolRuntime, so nothing here needs the view, the DOM, or a real engine mount. */
export interface CollabRuntime {
  getModel(): InputModelItem[];
  setInput(id: string, value: InputValue): Promise<void>;
  applyPatch(values: Record<string, unknown>): Promise<void>;
}

export interface CollabPlumbingOpts {
  /** The adapter to talk to. Defaults to the registered provider; passing one
   *  explicitly is how tests (and a loopback pair, plan 100 section 10) drive this. */
  adapter?: CanvasSyncAdapter;
  /** This device's collab client id. Defaults to the per-device persisted ULID. */
  clientId?: string;
  /** Frame scheduler - injected so tests need no rAF and a Worker-driven variant
   *  stays possible. Defaults to `requestAnimationFrame`, then a macrotask. */
  raf?: (fn: () => void) => void;
  /** Every op a local edit produced, after the adapter took it. Observability for
   *  tests, presence diagnostics and the ceremony UI's "live" indicator. */
  onOps?: (ops: readonly CanvasOp[]) => void;
}

export interface CollabPlumbing {
  /** Inbound: queue remote ops, coalesced and applied once per animation frame. */
  applyRemotePatch(ops: readonly CanvasOp[]): void;
  /** Restore the runtime's setInput and stop applying queued frames. Idempotent. */
  detach(): void;
}

// ── Per-device identity + the Lamport clock (plan 100 section 5) ──────────────────────

/** Key of the collab client id inside the 'profile' KV store - a sibling of the
 *  'me' record, like lib/offline-pins.ts and lib/instance.ts. Never localStorage. */
const CLIENT_ID_KEY = 'collab-client-id';

let clientId: string | null = null;
let clientIdInit: Promise<string> | null = null;

/**
 * This device's collab client id - a random ULID with no linkage to the profile,
 * the identity, or anything else (section 11.23: "the per-device collab client id is a
 * random ULID with no linkage to anything"). Synchronous, so plumbing never blocks
 * a mount; mints an in-memory id if `initCollabClientId()` has not resolved yet.
 */
export function getCollabClientId(): string {
  clientId ??= ulid();
  return clientId;
}

/**
 * Load (or mint and persist) the per-device client id. Whoever registers a provider
 * - the private-collab ceremony, or `org/` for a work collab - awaits this BEFORE
 * registering, so every mount's synchronous read already sees the durable value.
 * Memoised; never throws (an unreadable DB just means an in-memory id this session).
 */
export function initCollabClientId(): Promise<string> {
  clientIdInit ??= (async () => {
    try {
      // Imported lazily: the sync path above must not drag `idb` into the boot
      // chunk (or into this module's DOM-free unit tests).
      const { openDB } = await import('../bridge/db.ts');
      const db = await openDB();
      const stored = await db.get('profile', CLIENT_ID_KEY);
      const durable = typeof stored === 'string' && stored ? stored : null;
      // Adopt the stored id only if nothing has been handed out yet - swapping ids
      // mid-session would put two clients on the wire from one device.
      if (durable !== null && clientId === null) {
        clientId = durable;
        return durable;
      }
      const id = getCollabClientId();
      // Persist ONLY when there is nothing durable to keep. If a mount beat this
      // init and minted an in-memory id, that id serves this session - but writing
      // it over the stored one would destroy this device's identity permanently,
      // which is the opposite of what "per-device, IDB-persisted" means (section 5).
      if (durable === null) await db.put('profile', id, CLIENT_ID_KEY);
      return id;
    } catch {
      return getCollabClientId();
    }
  })();
  return clientIdInit;
}

/**
 * One Lamport clock per DEVICE (not per mount): every local op is causally after
 * everything this device has seen, on any tool.
 *
 * NOT persisted, unlike the client id beside it - so a reload restarts at 0 and this
 * device re-mints `(client, clock)` pairs it has used before. That is safe only
 * because a session is re-entered through a full-state exchange, which is what the
 * transport owes this module: on connect (and on reconnect) the joiner takes the
 * peer's state and every clock in it goes through `observeClock`, after which the
 * next local op beats everything again. A transport that resumes a live session
 * WITHOUT that exchange (plan 100 wave 2.3's catch-up path is the one that must not
 * be skipped) would silently lose this device's post-reload writes to a peer's
 * higher-clocked registers. Persisting the counter per op would cost an IDB write on
 * every keystroke; making the exchange required for correctness is the cheaper, stated trade.
 */
let clock = 0;

function nextClock(): number {
  return ++clock;
}

/** Absorb a clock we have seen, so the next op we mint beats it (plans/99 section 8). */
function observeClock(seen: number): void {
  if (seen > clock) clock = seen;
}

/** TEST-ONLY: reset the module's device identity + clock. */
export function _resetCollabDeviceForTests(id: string | null = null): void {
  clientId = id;
  clientIdInit = null;
  clock = 0;
}

// ── Value projection (what a row/param looks like on the wire) ─────────────────

function isScalar(v: unknown): v is Scalar {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/**
 * The input types whose whole value IS a scalar, and therefore the only ones a
 * `param` op may land in. The header's rule ("object-valued inputs do NOT cross")
 * has to be enforced on the INBOUND side against the input's DECLARED type, not
 * just the op value's shape: a scalar-shaped value is still wrong for an object-
 * valued input, and a bare string dropped on an `asset` gives `{{asset logo}}` a
 * ref it cannot resolve. The engine's own constraints reject most of the rest, but
 * `asset` is deliberately shape-blind there (an AssetRef and an `{_unresolved}`
 * stub are both legitimate objects), so this is the gate for it.
 */
const SCALAR_INPUT_TYPES = new Set([
  'text', 'longtext', 'number', 'boolean', 'color', 'select',
  'date', 'time', 'datetime-local', 'url',
]);

/** `canvas` config keys holding each geometry ROLE, in DEFAULT_GEOMETRY_FIELDS order
 *  (the BoxFieldConfig defaults in views/free-canvas.ts). */
const GEOM_ROLE_KEYS = ['xField', 'yField', 'wField', 'hField', 'rotationField'] as const;

/**
 * The geometry field NAMES this collection uses. The contract requires the shell to
 * resolve its own config to the roles before crossing the seam, so a tool that
 * renames `x` keeps the geometry lane (a move must never invalidate a raster - 
 * plans/99 section 4.3). Both peers run the same tool, so both resolve the same names.
 */
function resolveGeomFields(item: Pick<InputModelItem, 'canvas'>): readonly string[] {
  const cfg = item.canvas;
  if (!cfg) return DEFAULT_GEOMETRY_FIELDS;
  return DEFAULT_GEOMETRY_FIELDS.map((role, i) => {
    const named = cfg[GEOM_ROLE_KEYS[i]!];
    return typeof named === 'string' && named ? named : role;
  });
}

/**
 * A blocks array projected to the contract's box shape: keyed by stable row id,
 * scalar fields only. A row with no id is not addressable and is skipped (it gets
 * one from the sidebar's lazy migration, then syncs). The id field itself is the
 * KEY, never a row field.
 */
function toRowMap(value: unknown, idField: string): Map<BoxId, BoxRow> {
  const out = new Map<BoxId, BoxRow>();
  if (!Array.isArray(value)) return out;
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const id = rec[idField];
    if (typeof id !== 'string' || !id) continue;
    const row: BoxRow = {};
    for (const field of Object.keys(rec)) {
      if (field === idField) continue;
      const v = rec[field];
      if (isScalar(v)) row[field] = v;
    }
    out.set(id, row);
  }
  return out;
}

// ── Fractional order keys ─────────────────────────────────────────────────────
//
// MIRRORS the append progression `damageToOps` threads for added boxes (`keyAfter`
// in packages/core/src/canvas-op-v1.ts, which is module-private). It must match, or
// an order rewrite from this shell and an add from a peer's adapter would sort into
// different spaces. The co-located test pins the two together against the real
// `damageToOps` output rather than against a copied literal.

const ORDER_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const ORDER_MID = 'i';

function orderKeyAfter(a: string): string {
  if (a === '') return ORDER_MID;
  const chars = a.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const d = ORDER_DIGITS.indexOf(chars[i] ?? '0');
    if (d >= 0 && d < ORDER_DIGITS.length - 1) {
      chars[i] = ORDER_DIGITS[d + 1]!;
      return chars.slice(0, i + 1).join('');
    }
  }
  return a + ORDER_MID;
}

/** `n` lexically ascending order keys - the paint order of a whole collection. */
export function orderKeysFor(n: number): string[] {
  const out: string[] = [];
  let key = '';
  for (let i = 0; i < n; i++) {
    key = orderKeyAfter(key);
    out.push(key);
  }
  return out;
}

/** Placeholder-key prefix for a row that has no stable id yet. A NUL is not a
 *  character any id field carries, so it can never collide with a real id.
 *  Spelled through `fromCharCode` so this source stays plain ASCII. */
const NO_ID = String.fromCharCode(0);

/** Element-wise sequence equality - compares id order without inventing a
 *  delimiter that a tool-chosen id might itself contain. */
function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Origin for the throwaway diff whose only product is the `damage` HINT the
 *  adapter's `onLocalChange` takes. The ops it stamps are discarded, so the clock
 *  is deliberately not drawn from the device counter. */
const HINT_ORIGIN: OpOrigin = { client: '', clock: 0 };

function defaultRaf(fn: () => void): void {
  const raf = (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
    .requestAnimationFrame;
  if (typeof raf === 'function') raf(() => fn());
  else setTimeout(fn, 0);
}

// ── The merge result, not the wire value (plan 100 section 5, section 11.15) ─────────────────

/**
 * Reads the value a key holds in the DOCUMENT after a batch has been applied - which
 * is not, in general, the value that arrived on the wire.
 *
 * THIS IS THE WHOLE OF THE INBOUND CORRECTNESS ARGUMENT, so it is stated once here.
 * `applyRemotePatch` hands the ops to a CRDT, which arbitrates every per-key write by
 * `(clock, client)` and DISCARDS the loser. If the model is then patched from
 * `op.value`, a remote write that lost the merge still stomps the local value: the
 * two peers' documents converge byte-for-byte while their input models - and their
 * renders - diverge permanently, until somebody writes that key again. Found by
 * `collab-loopback.test.ts` with two real runtimes and a partition, which is the only
 * arrangement that separates "raw op value" from "converged value"; every other test
 * delivers an op to a side that has not concurrently written the same key, and there
 * the two agree.
 *
 * It is also what a Yjs adapter will REQUIRE rather than merely prefer: its merge
 * result is a property of the shared type, never of the op payload, so a shell that
 * reads the payload would be wrong there by construction.
 *
 * The raw value stays the fallback for every key the snapshot does not carry - a
 * legacy row the adapter never projected, a `remove` that took the box out of the doc
 * this frame, or an adapter whose `state()` failed. Falling back is exactly today's
 * behaviour, so the worst case of a missing snapshot is the bug this fixes, never a
 * dropped edit.
 */
interface ConvergedRead {
  param(key: string, raw: unknown): unknown;
  /** `col` is the op's OWN scope: absent means the document's default box store,
   *  which is what a v1.0 op log (and the canvas collection) lands in. */
  field(col: string | undefined, id: BoxId, field: string, raw: unknown): unknown;
}

function convergedRead(state: CanvasDocState | null): ConvergedRead {
  return {
    param(key, raw) {
      if (!state) return raw;
      return state.params.has(key) ? state.params.get(key) : raw;
    },
    field(col, id, field, raw) {
      if (!state) return raw;
      const boxes = col === undefined ? state.boxes : state.collections?.get(col)?.boxes;
      const row = boxes?.get(id);
      // hasOwnProperty, not `in`: a snapshot row is peer-derived data, and a field
      // named `toString` must read as absent rather than as Object.prototype's.
      if (!row || !Object.prototype.hasOwnProperty.call(row, field)) return raw;
      return row[field];
    },
  };
}

// ── The plumbing ──────────────────────────────────────────────────────────────

/**
 * Wire one mounted runtime to the registered collaboration provider. Call AFTER
 * mountTool's undo wrapper is installed, so a local edit records an undo step AND
 * syncs. Returns `null` - having touched nothing at all - when no provider is
 * registered, which is every build of this repo today.
 */
export function attachCollabPlumbing(
  runtime: CollabRuntime,
  opts: CollabPlumbingOpts = {},
): CollabPlumbing | null {
  const registered = opts.adapter ?? getCanvasSyncProvider();
  if (!registered) return null;

  // Re-bound as a non-optional const: the emit/flush helpers below are hoisted
  // function declarations, where TS cannot carry the guard's narrowing.
  const adapter: CanvasSyncAdapter = registered;
  const client = opts.clientId ?? getCollabClientId();
  const raf = opts.raf ?? defaultRaf;
  let applyingRemote = false;
  let detached = false;
  let queue: CanvasOp[] = [];
  let scheduled = false;

  const warn = (what: string, e: unknown): void => {
    console.warn(`[lolly:collab] ${what}`, e);
  };

  // ── outbound ────────────────────────────────────────────────────────────────

  const model = (): InputModelItem[] => runtime.getModel();

  function paramOpFor(item: InputModelItem, value: InputValue): ParamOp | null {
    // Objects never cross: ParamValue is a scalar or a {bind} descriptor, and a
    // `file`/`asset`/`vector`/`table` value is neither (plan 100 section 3, plans/99 section 7).
    if (!isScalar(value)) return null;
    if (Object.is(item.value, value)) return null;   // an identical re-write is not an edit
    return { k: 'param', key: item.id, value, origin: { client, clock: nextClock() } };
  }

  function emitCollection(item: InputModelItem, value: InputValue): CanvasOp[] {
    if (!Array.isArray(value)) return [];
    const col = item.id;
    const idField = rowIdField(item);
    const geomFields = resolveGeomFields(item);
    const prev = toRowMap(item.value, idField);
    const next = toRowMap(value, idField);
    const emitted: CanvasOp[] = [];

    // The damage hint the adapter's local-edit door takes. Derived through the
    // contract's own differ so the shell and the adapter agree on what changed.
    // `zChanged` is deliberately NOT counted: a gesture that only reordered rows
    // changed nothing the adapter's row diff could act on, and the order rewrite
    // below is this shell's answer to it.
    const damage = opsToDamage(damageToOps(prev, next, HINT_ORIGIN, geomFields, col), col);
    const touched = damage.moved.length + damage.restyled.length
      + damage.added.length + damage.removed.length;
    if (touched > 0) {
      const ops = adapter.onLocalChange(damage, next, col);
      for (const op of ops) observeClock(op.origin.clock);
      emitted.push(...ops);
    }

    // Paint order is invisible to a row-map diff, so the shell emits it (gap 1 in
    // the header). A rewrite is needed when the surviving rows changed relative
    // order, and after ANY insert: an add-time key is threaded from the array's
    // CURRENT positions, which a since-deleted row has already shifted.
    const prevIds = [...prev.keys()];
    const nextIds = [...next.keys()];
    const added = nextIds.some(id => !prev.has(id));
    const reordered = !sameSequence(
      nextIds.filter(id => prev.has(id)),
      prevIds.filter(id => next.has(id)),
    );
    if (nextIds.length && (added || reordered) && !emitted.some(op => op.k === 'order')) {
      const origin: OpOrigin = { client, clock: nextClock() };
      const keys = orderKeysFor(nextIds.length);
      nextIds.forEach((id, i) => {
        const op: OrderOp = { k: 'order', id, col, orderKey: keys[i]!, origin };
        adapter.apply(op);
        emitted.push(op);
      });
    }
    return emitted;
  }

  function emitLocal(id: string, value: InputValue): void {
    const item = model().find(i => i.id === id);
    if (!item) return;
    let ops: CanvasOp[];
    if (item.type === 'blocks') {
      ops = emitCollection(item, value);
    } else {
      const op = paramOpFor(item, value);
      if (op) adapter.apply(op);
      ops = op ? [op] : [];
    }
    if (ops.length) opts.onOps?.(ops);
  }

  // The wrapper mountTool installed for undo history - ours sits outside it, so a
  // local edit records a step AND syncs, and an undo replay syncs like any edit.
  // Kept by REFERENCE (not bound) so detach() can restore the exact function that
  // was there; it is invoked through the runtime so a method-style setter still
  // sees its receiver.
  const inner = runtime.setInput;
  const outer = (id: string, value: InputValue): Promise<void> => {
    if (!applyingRemote && !detached) {
      // A sync failure must never cost the user their edit.
      try { emitLocal(id, value); } catch (e) { warn('outbound', e); }
    }
    return inner.call(runtime, id, value);
  };
  runtime.setInput = outer;

  // ── inbound ─────────────────────────────────────────────────────────────────

  /** Rebuild one blocks input's array from its CURRENT value plus this batch's ops.
   *  Returns null when the ops changed nothing.
   *
   *  MEMBERSHIP merges (add/remove/order are applied as they arrive), because that
   *  is already convergent here - a row-map rebuild adds, removes and re-sorts rather
   *  than replacing. VALUES do not: every field write is resolved through `merged`,
   *  so a remote write that lost the CRDT's arbitration cannot stomp the newer local
   *  one (see {@link ConvergedRead}). */
  function rebuildCollection(
    item: InputModelItem,
    ops: readonly CanvasOp[],
    merged: ConvergedRead,
  ): unknown[] | null {
    const idField = rowIdField(item);
    const current = Array.isArray(item.value) ? item.value : [];
    // Insertion-ordered working copy. A row with no stable id keeps its place under
    // a synthetic key (a NUL prefix can never collide with a ULID), so a legacy
    // session that has not been migrated yet is never dropped by a remote patch.
    const rows = new Map<string, Record<string, unknown>>();
    let synthetic = 0;
    for (const raw of current) {
      if (!raw || typeof raw !== 'object') continue;
      const rec = raw as Record<string, unknown>;
      const id = rec[idField];
      const key = typeof id === 'string' && id ? id : NO_ID + synthetic++;
      rows.set(key, { ...rec });
    }

    const orderKeys = new Map<string, string>();
    let changed = false;
    let ordered = false;
    const setField = (id: string, field: string, value: unknown): void => {
      const row = rows.get(id);
      // No resurrection: a field write on an unknown/removed id creates nothing
      // (plan 100 section 3 - "objects cannot be brought into existence by writing a
      // property to an unassigned ID"). The id field itself is never a payload.
      if (!row || field === idField) return;
      if (Object.is(row[field], value)) return;
      row[field] = value;
      changed = true;
    };

    for (const op of ops) {
      switch (op.k) {
        case 'add': {
          const existing = rows.get(op.id);
          if (existing) {
            for (const field of Object.keys(op.row)) {
              setField(op.id, field, merged.field(op.col, op.id, field, op.row[field]));
            }
          } else {
            const row: Record<string, unknown> = { [idField]: op.id };
            for (const field of Object.keys(op.row)) {
              if (field !== idField) row[field] = merged.field(op.col, op.id, field, op.row[field]);
            }
            rows.set(op.id, row);
            changed = true;
          }
          orderKeys.set(op.id, op.orderKey);
          ordered = true;
          break;
        }
        case 'remove':
          if (rows.delete(op.id)) changed = true;
          break;
        case 'field':
          setField(op.id, op.field, merged.field(op.col, op.id, op.field, op.value));
          break;
        case 'geom':
          for (const field of Object.keys(op.fields)) {
            const v = op.fields[field as keyof typeof op.fields];
            if (v !== undefined) setField(op.id, field, merged.field(op.col, op.id, field, v));
          }
          break;
        case 'order':
          orderKeys.set(op.id, op.orderKey);
          ordered = true;
          break;
        case 'param':
          break;
      }
    }

    let ids = [...rows.keys()];
    if (ordered && ids.length) {
      // Rows with no key of their own are seeded at their current position, so an
      // append lands after them and a full rewrite (every row carrying a key)
      // reproduces the sender's order exactly. Ties break on id, as the reference
      // document's own converged order does.
      const seeded = orderKeysFor(ids.length);
      const keyOf = new Map(ids.map((id, i) => [id, orderKeys.get(id) ?? seeded[i]!]));
      const sorted = [...ids].sort((a, b) => {
        const ka = keyOf.get(a)!;
        const kb = keyOf.get(b)!;
        return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : a > b ? 1 : 0;
      });
      if (!sameSequence(sorted, ids)) {
        ids = sorted;
        changed = true;
      }
    }
    return changed ? ids.map(id => rows.get(id)!) : null;
  }

  /** Ops → the values object `runtime.applyPatch` takes, or null when empty.
   *  `merged` is the adapter's POST-APPLY snapshot: the ops say which keys this batch
   *  touched, the document says what those keys now hold ({@link ConvergedRead}). */
  function buildPatch(ops: readonly CanvasOp[], merged: ConvergedRead): Record<string, unknown> | null {
    const items = model();
    const byId = new Map(items.map(i => [i.id, i]));
    // A `col`-less box op means the default canvas collection (v1.0 shape, and
    // v1.1's documented default) - the editor-layout tool's `canvas` blocks input.
    const canvasCol = items.find(i => i.type === 'blocks' && i.canvas)?.id;
    const out = new Map<string, unknown>();
    const perCol = new Map<string, CanvasOp[]>();

    for (const op of ops) {
      if (op.k === 'param') {
        // Own-property whitelist against the declared inputs (section 11.21): an id this
        // build does not declare, or one on the wrong lane, dies here rather than
        // reaching the model. `__proto__` and friends are simply not input ids.
        const item = byId.get(op.key);
        if (!item || !SCALAR_INPUT_TYPES.has(item.type)) continue;
        // The MERGED value, not the wire value: an op that lost the arbitration must
        // not land in the model (see {@link ConvergedRead}). The gates below apply to
        // whatever actually won, which is the value that would reach the render.
        const value = merged.param(op.key, op.value);
        if (!isScalar(value)) continue;   // a {bind} descriptor is data-plane, not a value
        out.set(op.key, value);
        continue;
      }
      const col = op.col ?? canvasCol;
      if (!col) continue;
      if (byId.get(col)?.type !== 'blocks') continue;
      const bucket = perCol.get(col);
      if (bucket) bucket.push(op);
      else perCol.set(col, [op]);
    }

    for (const [col, colOps] of perCol) {
      const rebuilt = rebuildCollection(byId.get(col)!, colOps, merged);
      if (rebuilt) out.set(col, rebuilt);
    }
    // Built through fromEntries so a hostile key becomes an OWN property rather
    // than touching Object.prototype (it is dropped by applyPatch either way).
    return out.size ? Object.fromEntries(out) : null;
  }

  async function flush(): Promise<void> {
    if (detached) return;
    const ops = queue;
    queue = [];
    if (!ops.length) return;
    for (const op of ops) observeClock(op.origin.clock);
    try { adapter.applyRemotePatch(ops); } catch (e) { warn('adapter apply', e); }
    // Read the document AFTER the apply and BEFORE the patch is built: the ops name
    // the keys this batch touched, the snapshot says what those keys converged to.
    // One snapshot per flush (a batch is already coalesced per frame), and an adapter
    // that cannot produce one degrades to the raw op values rather than to no patch.
    let snapshot: CanvasDocState | null = null;
    try { snapshot = adapter.state(); } catch (e) { warn('adapter state', e); }
    let values: Record<string, unknown> | null = null;
    try { values = buildPatch(ops, convergedRead(snapshot)); } catch (e) { warn('inbound', e); }
    if (!values) return;
    // The guard is held across the SYNCHRONOUS part of the apply only. That is the
    // whole re-entrancy window - applyPatch lands every value in the model before
    // its first await - and releasing it there means a keystroke the user makes
    // while the batch's hooks are still running is still a local edit that syncs.
    let pending: Promise<void>;
    applyingRemote = true;
    try {
      pending = runtime.applyPatch(values);
    } finally {
      applyingRemote = false;
    }
    await pending;
  }

  return {
    applyRemotePatch(ops) {
      if (detached || !ops.length) return;
      // Coalesce per frame (section 5): a burst of remote ops is ONE apply, so one hook
      // pass and one paint. Unbounded by design for now - the hidden-tab queue cap
      // + full-state resync is section 11.13, and belongs with the transport (wave 2.3).
      // Appended one at a time, not spread: this is untrusted input, and a spread
      // of a hostile-sized array is an argument-count crash rather than a queue.
      for (const op of ops) queue.push(op);
      if (scheduled) return;
      scheduled = true;
      raf(() => {
        scheduled = false;
        void flush().catch(e => warn('flush', e));
      });
    },
    detach() {
      if (detached) return;
      detached = true;
      queue = [];
      // Only if nothing wrapped us since - otherwise we would drop their wrapper.
      if (runtime.setInput === outer) runtime.setInput = inner;
    },
  };
}
