// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas Op Contract - v1.
 *
 * The single agreed SHAPE by which a canvas edit becomes (a) a presenter patch and
 * (b) a collaboration operation. Two independently-built, independently-deployed
 * repos meet at this seam - the OSS shell's Scene/presenter (this repo, `lolly`,
 * plans/98 + plans/99) and lolly-work's Yjs adapter (`lolly-work/plans/14`) - so
 * the diff between them cannot live as an implicit understanding in either. It is
 * pinned, versioned like the host bridge, and covered by a shared conformance test
 * neither side may edit alone (plans/99 section 1, section 8).
 *
 * Where this lives, and why in @lolly-tools/core: exactly like host-v1 and
 * extension-v1, the CONTRACT lives in the neutral SDK package so BOTH consumers can
 * compile against it without depending on the engine or the web shell. lolly-work
 * imports it via `engine-pin.json`; the OSS shell's dormant `org/` seam registers a
 * provider against it. This module is types + pure helpers + one version constant
 * only - importing it pulls in no engine, no DOM, no framework, no network, no yjs.
 *
 * Scope boundary (plans/99 section 1.1): the OSS repo ships NO server, NO socket, NO
 * persistence for this. It emits and applies ops locally against a dormant seam;
 * with no provider registered the code path is dead and behaviour is byte-identical
 * to single-player. Every piece that bears a server lives in lolly-work.
 *
 * Versioning (plans/99 section 9): append-only, never repurpose. New op kinds and new
 * fields are additive minor bumps; an existing kind's shape and an existing field's
 * LANE never change without a major (and a migration). The op kind set is
 * deliberately small (geometry / field / structural / order / param) - resist
 * growth; most "new ops" are just new fields, which need no new kind.
 *
 * LANE DISCIPLINE is a contract term, not an optimization (plans/99 section 4.3): geometry
 * (`x,y,w,h,rot`) and content are separate keys and separate lanes on both sides.
 * A concurrent move + restyle on the same box composes cleanly (different keys, no
 * lost update). The geometry lane NEVER invalidates a raster/tile - conflating
 * lanes re-rasterizes the world on every remote drag, the single worst regression
 * this contract exists to prevent (plans/98 section 5).
 *
 * No upstream-inverting imports: packages/core is UPSTREAM of engine and the shells
 * (engine/src/bridge/host-v1.ts re-exports FROM core, never the reverse). So this
 * module defines its own local `Scalar`/`BoxRow` and imports NOTHING from engine/ or
 * shells/. The CRDT-syncable subset of a box value is scalars anyway - plans/99 section 7
 * excludes file bytes, live frames, and unresolved bindings from sync.
 */

/**
 * The op contract version (semver), negotiated at room join. A client and gateway
 * on incompatible majors → the client joins observer-only rather than corrupting
 * state (plans/99 section 9). Independent of ENGINE_VERSION, CONTRACT_VERSION (host-v1),
 * and EXTENSION_CONTRACT_VERSION - this surface owns its own version, exactly like
 * extension-v1's EXTENSION_CONTRACT_VERSION.
 *
 * v1.1 (plans/100 section 3, additive): every box op takes an optional `col` - the
 * blocks-input collection it targets; absent = the default canvas collection, so
 * every v1.0 op stays valid (`param` stays collection-blind). Presence gains
 * focus/location/following/viewport/chat; CanvasDocState gains `collections`.
 */
export const CANVAS_OP_VERSION = '1.1.0';

// ── Identity (plans/99 section 2) ─────────────────────────────────────────────────────

/**
 * A stable, client-generated ULID carried in each box row (plans/99 section 2). Everything
 * keys on this, NOT the array index - a concurrent "insert box" + "edit box" must
 * not collide by position (lolly-work plans/14 section 4). Ids are never reused; a
 * deleted-then-undeleted box keeps its id.
 */
export type BoxId = string;

/**
 * The CRDT-syncable value of a single box field. Deliberately narrow: plans/99 section 7
 * keeps file bytes, live camera/recorder frames, and unresolved bindings OUT of the
 * sync log, so a scalar union is the correct wire type. NOT the engine's InputValue
 * (importing engine would invert the dependency and break engine purity).
 */
export type Scalar = string | number | boolean | null;

/**
 * A box's flat row of fields (plans/99 section 3 - no nested tree; the array stays truth).
 * Every field is an independent CRDT key ⇒ per-field last-writer-wins.
 */
export type BoxRow = Record<string, Scalar>;

/**
 * The origin stamp every op carries for the reference CRDT's ordering: a Lamport
 * `clock` with the `client` id as the deterministic tiebreak. This makes the OSS
 * reference model self-contained. lolly-work's real Yjs adapter MAY ignore it (Yjs
 * derives order from its own state vectors) - documented divergence, plans/99 section 8.
 */
export interface OpOrigin {
  /** Client id (also the LWW tiebreak: on equal clock, the higher id wins). */
  readonly client: string;
  /** Lamport clock - higher wins the last-writer-wins merge. */
  readonly clock: number;
}

// ── The damage set (plans/99 section 4.1 / section 4.2) ──────────────────────────────────────

/**
 * The diff over STABLE box ids produced by one gesture / one `setInput` - and, on
 * the inverse path, produced by a remote patch to feed the presenter. plans/99 section 1:
 * the damage set and the collaboration op-stream are the same thing. Every lane is
 * keyed by BoxId so concurrent insert + edit never collide by position (plans/99
 * section 2). NOTE: the shell's internal Scene (plans/98 section 4.1 SoA) may keep an index-form
 * damage (`number[]`) for its hot loop and interns BoxId ↔ i; the SEAM form here is
 * always id-based.
 */
export interface Damage {
  /** Geometry changed (`x,y,w,h,rot`) - positional LWW per field; re-place the
   *  node, NO re-render, NO raster invalidation (plans/99 section 4.2, plans/98 section 5). */
  moved: BoxId[];
  /** A content field changed - content lane, per-field LWW; re-emit the node and
   *  invalidate raster + tiles (plans/99 section 4.2). */
  restyled: BoxId[];
  /** New box: `boxes.set(id, row)` + insert into paint order (plans/99 section 4.1). */
  added: BoxId[];
  /** Box deleted: delete from paint order + `boxes.delete(id)` (plans/99 section 4.1). */
  removed: BoxId[];
  /** Paint/z order changed (order move, and/or a `frame`/`group`/`order` field
   * write) - structural + field lane (plans/99 section 4.1). */
  zChanged: BoxId[];
  /** A frame box (`kind:"frame"`) changed - a frame is a box, so it damages as
   *  `moved`/`restyled` (plans/99 section 4.1). Classified by the shell's Scene, which
   *  knows `kind`; generic op→damage mapping leaves this empty. */
  frames: BoxId[];
}

// ── Params & the data plane (plans/99 section 6) ──────────────────────────────────────

/** A descriptor of WHICH dataset/query a binding reads - never the resolved datum
 *  (plans/99 section 6). `version` optionally pins the provider so a schema change doesn't
 *  silently re-resolve differently across clients (plans/99 section 11, align with the
 *  rail's resource versioning, plans/19). */
export interface ProviderRef {
  readonly provider: string;
  readonly query?: string;
  readonly version?: string;
}

/** A param literal syncs as its value (plans/99 section 6). */
export type ParamLiteral = Scalar;

/** A param binding syncs as a descriptor `{bind: providerRef}`, never the resolved
 * datum - live data does not travel through the CRDT (plans/99 section 6). Each client
 *  resolves the live value locally from the shared data plane. */
export interface ParamBinding {
  readonly bind: ProviderRef;
}

/** The reactive/data-bus value stored per canonical id in `params` (plans/98 section 6.5,
 *  plans/99 section 3): either a literal or a binding descriptor. */
export type ParamValue = ParamLiteral | ParamBinding;

// ── The op union (plans/99 section 4, section 9) ─────────────────────────────────────────────

/** The five geometry field names, kept as their own kind so the section 4.3 lane split is
 *  encoded at the type level (geometry never invalidates a raster). */
export type GeometryField = 'x' | 'y' | 'w' | 'h' | 'rot';

/** Set a subset of geometry fields on one box - the geometry lane (plans/99 section 4.1
 *  `moved`). Separate from FieldOp precisely so geometry never invalidates a
 *  raster (plans/99 section 4.3). */
export interface GeomOp {
  readonly k: 'geom';
  readonly id: BoxId;
  /** v1.1 (plans/100 section 3): the blocks-input collection this op targets; absent =
   * the default canvas collection. Additive - every v1.0 op stays valid. */
  readonly col?: string;
  readonly fields: Partial<Record<GeometryField, number>>;
  readonly origin: OpOrigin;
}

/** Set one content field on one box - the content lane (plans/99 section 4.1 `restyled`).
 *  `frame`/`group`/`order` membership are ordinary field writes too (plans/99 section 3). */
export interface FieldOp {
  readonly k: 'field';
  readonly id: BoxId;
  /** v1.1: collection scope - see GeomOp.col. */
  readonly col?: string;
  readonly field: string;
  readonly value: Scalar;
  readonly origin: OpOrigin;
}

/** Insert a new box with its full row + a paint-order key (plans/99 section 4.1 `added`). */
export interface AddOp {
  readonly k: 'add';
  readonly id: BoxId;
  /** v1.1: collection scope - see GeomOp.col. */
  readonly col?: string;
  readonly row: BoxRow;
  /** The box's paint-order position as an LWW fractional-index string (see
   * ReferenceCanvasDoc). lolly-work's adapter uses `Y.Array<BoxId>` instead -
   *  documented divergence (plans/99 section 3, section 8). */
  readonly orderKey: string;
  readonly origin: OpOrigin;
}

/** Delete a box (plans/99 section 4.1 `removed`). The id is never reused. */
export interface RemoveOp {
  readonly k: 'remove';
  readonly id: BoxId;
  /** v1.1: collection scope - see GeomOp.col. */
  readonly col?: string;
  readonly origin: OpOrigin;
}

/** Set a box's paint-order key (plans/99 section 4.1 `zChanged`, order move). */
export interface OrderOp {
  readonly k: 'order';
  readonly id: BoxId;
  /** v1.1: collection scope - see GeomOp.col. */
  readonly col?: string;
  readonly orderKey: string;
  readonly origin: OpOrigin;
}

/** Set a `params` entry (plans/99 section 6). The one op beyond the four section 9 kinds because
 *  params is a separate document lane (`Y.Map<CanonicalId, ParamValue>`), not a box
 * field. Deliberately NOT collection-scoped in v1.1 - the params lane is
 *  collection-blind (plans/100 section 3). */
export interface ParamOp {
  readonly k: 'param';
  readonly key: string;
  readonly value: ParamValue;
  readonly origin: OpOrigin;
}

/** The discriminated union on `k` - the deliberately small kind set (plans/99 section 9). */
export type CanvasOp = GeomOp | FieldOp | AddOp | RemoveOp | OrderOp | ParamOp;

// ── Awareness (plans/99 section 5) ────────────────────────────────────────────────────

/**
 * Ephemeral presence - the Yjs awareness channel, NEVER written to the doc
 * (plans/99 section 5). Broadcast at pointer-move rate; drives presence ghosts and remote
 * cursors. Lost on disconnect - correct. It carries NO origin/clock: it is not an
 * op and never converges.
 */
export interface Presence {
  readonly userId: string;
  readonly name: string;
  readonly color: string;
  /** Normalized 0..1 of the design's unit space, so every zoom level and every
   *  presenter renders it identically (plans/99 section 5, plans/14 section 3.3). */
  readonly cursor: { readonly x: number; readonly y: number };
  readonly selection: BoxId[];
  /** In-flight drag delta (also normalized unit space) - never persisted. */
  readonly drag?: { readonly ids: BoxId[]; readonly dxy: readonly [number, number] };
  /** v1.1 (plans/100 section 3, section 4.1): the focused input - an input id, or
   *  `"<blocksId>:<rowId>"` for a blocks row. Drives the focus-ring presence
   *  primitive on every tool. */
  readonly focus?: string;
  /** v1.1 (plans/100 section 4.2): which slide/page/scene the user is on (big tools) -
   *  presence-bar grouping and the follow-mode target. */
  readonly location?: string;
  /** v1.1 (plans/100 section 4.2): the userId this user is following - follow is a pure
   *  presence field, never a mode. */
  readonly following?: string;
  /** v1.1 (plans/100 section 4.2): the follower-adoptable camera. */
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number };
  /** v1.1 (plans/100 section 3): cursor chat - ≤64 chars (schema-enforced), rides the
   *  awareness channel only, never persisted. */
  readonly chat?: string;
}

/** Alias - the value carried on the awareness channel is a Presence (plans/99 section 5). */
export type Awareness = Presence;

// ── Field lanes (plans/99 section 4.3) ────────────────────────────────────────────────

/**
 * The default geometry field NAMES. Grounded in the runtime BoxFieldConfig defaults
 * in shells/web/src/views/free-canvas.ts (idField 'id', xField 'x', yField 'y',
 * wField 'w', hField 'h', rotationField 'rot') and the shipped design
 * manifests. Field names are runtime-configurable via BoxFieldConfig, so the shell
 * must resolve its config to these ROLES before crossing the seam and pass the
 * resolved set to `laneForField`/`damageToOps` when a tool renames them.
 */
export const DEFAULT_GEOMETRY_FIELDS: readonly GeometryField[] = ['x', 'y', 'w', 'h', 'rot'];

/** Which lane a field write belongs to (plans/99 section 4.3). Geometry fields take the
 * geometry lane (never invalidates a raster); everything else - including the
 *  structural `frame`/`group`/`order`/`kind` fields, which ride the content lane as
 * ordinary field writes (plans/99 section 3) - takes the content lane. */
export function laneForField(
  field: string,
  geomFields: readonly string[] = DEFAULT_GEOMETRY_FIELDS,
): 'geometry' | 'content' {
  return geomFields.includes(field) ? 'geometry' : 'content';
}

// ── The damage ⇄ op mapping (plans/99 section 4.1 / section 4.2, as code) ─────────────────────

/** True when a value is a param binding descriptor rather than a literal. */
function isParamBinding(v: ParamValue): v is ParamBinding {
  return typeof v === 'object' && v !== null && 'bind' in v;
}

/**
 * `onLocalChange` as a pure function (plans/99 section 4.1): diff two box maps into the
 * minimal op list - geometry changes coalesce into one GeomOp per box, each changed
 * content field is one FieldOp, appearing/disappearing ids are AddOp/RemoveOp. The
 * geometry-vs-content split is the section 4.3 lane discipline in code.
 *
 * ORDER (v1.1, plans/100 section 3 - `blocks` collections made this essential, because
 * for a blocks input row order IS the content): `next` iteration order is the paint
 * order the ops must reproduce. The order keys are minted from ONE ascending
 * sequence over the whole of `next`, and they are STAMPED on every row - the added
 * ones through their AddOp, the surviving ones through an OrderOp - whenever the
 * sequence actually changed (something was added, or the survivors' relative order
 * moved). That whole-sequence rewrite is the only correct answer available to a
 * helper that sees rows but not their current keys: minting an add's key from a
 * restarted sequence made it COLLIDE with a key a prior gesture had already given
 * another row, and both peers then converged on the wrong order (the tie broke by
 * BoxId, and ULIDs sort by creation time, so a new row always lost). A gesture that
 * only edits fields - the common case - still emits no order op at all, and a
 * removal alone leaves the survivors' keys correctly sorted, so neither pays for it.
 * The precise-insert alternative (a `keyBetween` over the neighbours' existing keys)
 * needs those keys at the seam; it is a v1.2 signature question, not a fix.
 *
 * A plain row map still cannot distinguish a `frame`/`group`/`order` FIELD edit from
 * a z-move, so those stay content FieldOps.
 *
 * @param prev       box state before the gesture (keyed by stable BoxId)
 * @param next       box state after the gesture
 * @param origin     the op origin stamp for every op produced here
 * @param geomFields resolved geometry field names (defaults to the shipped roles)
 * @param col        v1.1 (plans/100 section 3): the blocks-input collection the gesture
 *                   targets; default undefined = the canvas collection, in which
 *                   case every emitted op is byte-identical to its v1.0 shape
 */
export function damageToOps(
  prev: Map<BoxId, BoxRow>,
  next: Map<BoxId, BoxRow>,
  origin: OpOrigin,
  geomFields: readonly string[] = DEFAULT_GEOMETRY_FIELDS,
  col?: string,
): CanvasOp[] {
  const ops: CanvasOp[] = [];
  // Stamp the collection scope only when present - a default-canvas op must carry
  // no `col` key at all (the v1.0 shape, plans/100 section 3).
  const scope: { col?: string } = col === undefined ? {} : { col };

  // Removed: in prev, gone from next.
  for (const id of prev.keys()) {
    if (!next.has(id)) ops.push({ k: 'remove', id, origin, ...scope });
  }

  // Did the sequence itself change? Survivors compared in each map's own iteration
  // order: an insert anywhere, or any relative move, means every row's key is
  // restated below; a pure field edit (and a pure removal) means none is.
  const nextIds = [...next.keys()];
  const survivorsNext = nextIds.filter(id => prev.has(id));
  const survivorsPrev = [...prev.keys()].filter(id => next.has(id));
  const rewriteOrder = nextIds.length > survivorsNext.length
    || survivorsNext.some((id, i) => id !== survivorsPrev[i]);

  // Walk next in paint order, threading one ascending orderKey sequence.
  let orderKey = '';
  for (const [id, nextRow] of next) {
    orderKey = keyAfter(orderKey);
    const prevRow = prev.get(id);
    if (prevRow === undefined) {
      ops.push({ k: 'add', id, row: { ...nextRow }, orderKey, origin, ...scope });
      continue;
    }
    if (rewriteOrder) ops.push({ k: 'order', id, orderKey, origin, ...scope });
    // Existing box: collect changed fields, split by lane.
    const geom: Partial<Record<GeometryField, number>> = {};
    let geomChanged = false;
    const seen = new Set<string>();
    for (const field of Object.keys(nextRow)) {
      seen.add(field);
      const nv = nextRow[field] as Scalar;
      if (prevRow[field] === nv) continue;
      if (laneForField(field, geomFields) === 'geometry') {
        geom[field as GeometryField] = Number(nv);
        geomChanged = true;
      } else {
        ops.push({ k: 'field', id, field, value: nv, origin, ...scope });
      }
    }
    // A field removed from the row reads as clearing it to null (content lane).
    for (const field of Object.keys(prevRow)) {
      if (seen.has(field)) continue;
      if (laneForField(field, geomFields) === 'geometry') {
        geom[field as GeometryField] = Number(prevRow[field]);
        geomChanged = true;
      } else {
        ops.push({ k: 'field', id, field, value: null, origin, ...scope });
      }
    }
    if (geomChanged) ops.push({ k: 'geom', id, fields: geom, origin, ...scope });
  }

  return ops;
}

/**
 * `applyRemotePatch`'s classification step as a pure function (plans/99 section 4.2):
 * fold an op list into the Damage set that feeds the presenter's identical patch
 * path. Ids are de-duplicated per lane. `frames` is left empty - a frame is a box
 * (`kind:"frame"`), which only the shell's Scene can tell from `kind`. ParamOps
 * carry no box damage (params is a separate lane).
 *
 * @param col v1.1 (plans/100 section 3): the collection context this damage set is FOR;
 *            default undefined = the canvas collection. An op targets exactly one
 * collection, so ops scoped elsewhere carry no damage in this context -
 *            a v1.0 call site (no col anywhere) behaves exactly as before.
 */
export function opsToDamage(ops: readonly CanvasOp[], col?: string): Damage {
  const moved = new Set<BoxId>();
  const restyled = new Set<BoxId>();
  const added = new Set<BoxId>();
  const removed = new Set<BoxId>();
  const zChanged = new Set<BoxId>();
  for (const op of ops) {
    if (op.k !== 'param' && op.col !== col) continue;
    switch (op.k) {
      case 'geom':
        moved.add(op.id);
        break;
      case 'field':
        restyled.add(op.id);
        break;
      case 'add':
        added.add(op.id);
        break;
      case 'remove':
        removed.add(op.id);
        break;
      case 'order':
        zChanged.add(op.id);
        break;
      case 'param':
        break;
    }
  }
  return {
    moved: [...moved],
    restyled: [...restyled],
    added: [...added],
    removed: [...removed],
    zChanged: [...zChanged],
    frames: [],
  };
}

// ── Version compatibility (plans/99 section 9) ────────────────────────────────────────

/**
 * Same major ⇒ compatible; else the client joins observer-only rather than
 * corrupting state (plans/99 section 9). Append-only minors are always compatible.
 *
 * NECESSARY, NOT SUFFICIENT, per op. A minor may add a field that changes an op's
 * PAYLOAD, which an older peer can ignore - but `col` (v1.1) changes an op's
 * ROUTING: to a v1.0 peer a collection-scoped op is either invalid (its schema
 * closes every branch) or, worse, a canvas-box write, which breaks the plans/99 section 8
 * "identical boxes ⇒ identical render" invariant. So a sender ALSO gates each op on
 * what the receiver's version can honour - `isOpSendableTo` - and PWA staleness
 * (plans/100 section 11.19) makes that pair routine, not exotic.
 */
export function isCompatibleOpVersion(remote: string, local: string = CANVAS_OP_VERSION): boolean {
  return majorOf(remote) === majorOf(local);
}

/** The version that introduced collection-scoped ops (`col`) - plans/100 section 3. */
export const COLLECTIONS_SINCE = '1.1.0';

/** Can a peer on `version` honour `col`? False for every v1.0 peer, which is why a
 *  blocks-collection edit must not be sent to one (see `isOpSendableTo`). */
export function supportsCollections(version: string): boolean {
  return atLeast(version, COLLECTIONS_SINCE);
}

/**
 * The send-side gate: may this op go to a peer running `remoteVersion`? A transport
 * calls it per op and treats `false` as "this edit cannot cross to that peer" -
 * dropping it and telling the user their collaborator is on an older build, never
 * sending it and hoping. Ops with no version-gated field always pass, so a v1.0-only
 * session is unaffected.
 */
export function isOpSendableTo(op: CanvasOp, remoteVersion: string): boolean {
  if (!isCompatibleOpVersion(remoteVersion)) return false;
  if (op.k !== 'param' && op.col !== undefined && !supportsCollections(remoteVersion)) return false;
  return true;
}

function majorOf(version: string): string {
  const dot = version.indexOf('.');
  return dot === -1 ? version : version.slice(0, dot);
}

/** `version >= floor`, comparing major then minor numerically ('1.10.0' > '1.9.0').
 * Patch is deliberately ignored - the contract never gates on it. */
function atLeast(version: string, floor: string): boolean {
  const [vMaj, vMin] = numericParts(version);
  const [fMaj, fMin] = numericParts(floor);
  if (vMaj !== fMaj) return vMaj > fMaj;
  return vMin >= fMin;
}

function numericParts(version: string): [number, number] {
  const parts = version.split('.');
  const maj = Number(parts[0]);
  const min = Number(parts[1]);
  return [Number.isFinite(maj) ? maj : -1, Number.isFinite(min) ? min : -1];
}

// ── The document + the sync-provider seam (plans/99 section 3, section 1) ─────────────────────

/**
 * The persisted CRDT state (plans/99 section 3): paint order, the flat box rows, and the
 * param bus. The real shape is Yjs (`Y.Array` + `Y.Map`), owned by lolly-work's
 * adapter; this is the transport-agnostic snapshot both sides can compare.
 */
export interface CanvasDocState {
  /** Paint/z order (plans/99 section 3 `order: Y.Array<BoxId>`). */
  order: BoxId[];
  /** Each box's flat row (plans/99 section 3 `boxes: Y.Map<BoxId, Y.Map<Field,Scalar>>`). */
  boxes: Map<BoxId, BoxRow>;
  /** The reactive/data bus (plans/99 section 3 `params: Y.Map<CanonicalId, ParamValue>`). */
  params: Map<string, ParamValue>;
  /** v1.1 (plans/100 section 3): per-blocks-input collections - each a boxes-shaped doc
   *  of its own (own order, own rows), keyed by the blocks input id. Absent when
   *  no collection-scoped op has been applied, so a v1.0 op log yields a
   *  v1.0-shaped state. */
  collections?: Map<string, { order: BoxId[]; boxes: Map<BoxId, BoxRow> }>;
}

/**
 * The dormant sync-provider plug point (plans/99 section 1, lolly-work plans/14 section 8). The
 * OSS shell registers an implementation into a neutral registry; with none
 * registered the path is dead and behaviour is single-player. lolly-work supplies a
 * Yjs-backed implementation via the rail. The OSS ReferenceCanvasDoc implements the
 * SAME interface so the shared conformance test (plans/99 section 8) runs against both.
 */
export interface CanvasSyncAdapter {
  /** Local edit → ops to broadcast (plans/99 section 4.1). Applies them locally too; the
   * returned ops are what a transport would send. `damage` is an advisory hint -
   *  `rows` is the post-gesture box state the ops are derived against. v1.1
   *  (plans/100 section 3): `col` scopes the gesture to a blocks-input collection
   *  (absent = the canvas collection). A pre-v1.1 two-arg implementation still
   *  TYPE-checks against this interface, but it does not pass the v1.1 conformance
   * suite - the collection cases assert that a scoped op lands in `collections`
   *  and never in `boxes`. Honouring `col` is the work, not the signature (the
   *  cross-repo sequencing for that is plans/100 wave 3.2). */
  onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[];
  /** Apply one op to the document (LWW / convergent). Idempotent and
   * order-independent within this adapter's model. v1.1: honours `op.col` -
   *  per-collection registers and order, default collection when absent. */
  apply(op: CanvasOp): void;
  /** Remote ops → Damage for the presenter (plans/99 section 4.2). Applies them, then
   *  classifies. Returns the CANVAS collection's damage; a caller presenting a
   *  blocks collection computes its own via `opsToDamage(ops, col)` (v1.1). */
  applyRemotePatch(ops: readonly CanvasOp[]): Damage;
  /** Ephemeral presence - never written to the doc (plans/99 section 5). */
  presence(a: Awareness): void;
  /** A transport-agnostic snapshot of the converged document. */
  state(): CanvasDocState;
}

// ── The dependency-free reference CRDT (plans/99 section 8, testHarness) ───────────────
//
// Per-field last-writer-wins keyed by OpOrigin (Lamport `clock`; ties broken by the
// higher `client` id) over boxes and params. Membership is an LWW `alive` register
// (so concurrent add/remove and re-add converge). Paint order is modelled WITHOUT a
// list-CRDT - as a per-box LWW fractional-index `orderKey`; converged paint order is
// a stable sort by (orderKey, BoxId). lolly-work's real adapter uses `Y.Array<BoxId>`
// instead (plans/99 section 3): the shared assertion is order-INDEPENDENCE WITHIN each model
// (all interleavings converge for THAT adapter), NOT reference-order == Yjs-order
// byte-equality - under concurrent reorders/inserts the two models may settle on
// different (each internally-consistent) orders (plans/99 section 8 risk).

interface Reg<T> {
  value: T;
  origin: OpOrigin;
}

interface BoxState {
  fields: Map<string, Reg<Scalar>>;
  order: Reg<string> | null;
  alive: Reg<boolean> | null;
}

/** Does origin `a` beat origin `b`? Higher clock wins; on a tie the higher client
 *  id wins. Strict (`>`) so re-applying an identical op is a no-op (idempotent). */
function beats(a: OpOrigin, b: OpOrigin): boolean {
  return a.clock !== b.clock ? a.clock > b.clock : a.client > b.client;
}

function put<T>(current: Reg<T> | null | undefined, value: T, origin: OpOrigin): Reg<T> {
  return current && !beats(origin, current.origin) ? current : { value, origin };
}

/**
 * A dependency-free reference CRDT implementing CanvasSyncAdapter - the OSS proof of
 * convergence with NO yjs. The shared conformance test (tests/canvas-op-convergence
 * .test.ts) is parameterized over CanvasSyncAdapter so lolly-work runs the same
 * bytes against `() => new YjsAdapter()`.
 */
export class ReferenceCanvasDoc implements CanvasSyncAdapter {
  /** The default canvas collection's box registers. */
  private readonly boxes = new Map<BoxId, BoxState>();
  /** v1.1 (plans/100 section 3): per-blocks-collection box registers, keyed by the blocks
   * input id. Each collection is an independent boxes-shaped doc - same registers,
   * same order model - materialized on first op, never on read. */
  private readonly collections = new Map<string, Map<BoxId, BoxState>>();
  private readonly params = new Map<string, Reg<ParamValue>>();
  private readonly clientId: string;
  private clock = 0;
  /** Last presence seen - for inspection only; never enters the doc (plans/99 section 5). */
  private lastPresence: Awareness | null = null;

  constructor(clientId: string = 'ref') {
    this.clientId = clientId;
  }

  onLocalChange(_damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
    // Diff the incoming rows against our own converged state and emit minimal ops
    // (the `damage` arg is an advisory scope hint the reference does not need).
    // v1.1: `col` scopes both the diff base and the emitted ops to one collection.
    const origin: OpOrigin = { client: this.clientId, clock: ++this.clock };
    const ops = damageToOps(this.currentRows(col), rows, origin, DEFAULT_GEOMETRY_FIELDS, col);
    for (const op of ops) this.apply(op);
    return ops;
  }

  apply(op: CanvasOp): void {
    // Lamport rule: absorb the origin's clock so a subsequently-minted local op
    // (++this.clock in onLocalChange) is causally after anything we have applied.
    // Without this, a local edit made after receiving a higher remote clock would
    // get a LOWER clock and lose the merge to the older remote write on the same key.
    if (op.origin.clock > this.clock) this.clock = op.origin.clock;
    switch (op.k) {
      case 'geom': {
        const box = this.ensure(op.id, op.col);
        for (const field of Object.keys(op.fields)) {
          const v = op.fields[field as GeometryField];
          if (v !== undefined) box.fields.set(field, put(box.fields.get(field), v, op.origin));
        }
        break;
      }
      case 'field': {
        const box = this.ensure(op.id, op.col);
        box.fields.set(op.field, put(box.fields.get(op.field), op.value, op.origin));
        break;
      }
      case 'add': {
        const box = this.ensure(op.id, op.col);
        box.alive = put(box.alive, true, op.origin);
        box.order = put(box.order, op.orderKey, op.origin);
        for (const field of Object.keys(op.row)) {
          box.fields.set(field, put(box.fields.get(field), op.row[field] as Scalar, op.origin));
        }
        break;
      }
      case 'remove': {
        const box = this.ensure(op.id, op.col);
        box.alive = put(box.alive, false, op.origin);
        break;
      }
      case 'order': {
        const box = this.ensure(op.id, op.col);
        box.order = put(box.order, op.orderKey, op.origin);
        break;
      }
      case 'param': {
        this.params.set(op.key, put(this.params.get(op.key), op.value, op.origin));
        break;
      }
    }
  }

  applyRemotePatch(ops: readonly CanvasOp[]): Damage {
    for (const op of ops) this.apply(op);
    return opsToDamage(ops);
  }

  presence(a: Awareness): void {
    // Awareness is ephemeral and never touches the doc (plans/99 section 5).
    this.lastPresence = a;
  }

  state(): CanvasDocState {
    // Emit boxes and params in CANONICAL key order (sorted), not apply order, so
    // state() is interleaving-independent and directly comparable across clients
    // (plans/99 section 8). `order` is already deterministically sorted. v1.1: collections
    // likewise - sorted collection ids, each snapshotted the same canonical way -
    // and the key is ABSENT when no collection-scoped op has ever applied, so a
    // v1.0 op log yields a v1.0-shaped state.
    const params = new Map<string, ParamValue>();
    for (const key of [...this.params.keys()].sort()) {
      const reg = this.params.get(key);
      if (reg !== undefined) params.set(key, reg.value);
    }
    const state: CanvasDocState = {
      order: this.orderOf(this.boxes),
      boxes: this.snapshot(this.boxes),
      params,
    };
    if (this.collections.size > 0) {
      const collections = new Map<string, { order: BoxId[]; boxes: Map<BoxId, BoxRow> }>();
      for (const colId of [...this.collections.keys()].sort()) {
        const store = this.collections.get(colId);
        if (store !== undefined) {
          collections.set(colId, { order: this.orderOf(store), boxes: this.snapshot(store) });
        }
      }
      state.collections = collections;
    }
    return state;
  }

  /** The deterministic serialization of the converged doc - rows in paint order
   *  (the default canvas collection). The render-hash proxy for the section 8 assertion:
   *  the plans/98 section 11 determinism invariant guarantees identical `boxes` input ⇒
   *  identical render. */
  canonicalBoxes(): BoxRow[] {
    return this.orderOf(this.boxes).map((id) => this.rowOf(this.boxes, id));
  }

  // - internals -

  private ensure(id: BoxId, col?: string): BoxState {
    let store: Map<BoxId, BoxState>;
    if (col === undefined) {
      store = this.boxes;
    } else {
      let m = this.collections.get(col);
      if (m === undefined) {
        m = new Map();
        this.collections.set(col, m);
      }
      store = m;
    }
    let box = store.get(id);
    if (box === undefined) {
      box = { fields: new Map(), order: null, alive: null };
      store.set(id, box);
    }
    return box;
  }

  private aliveIds(store: Map<BoxId, BoxState>): BoxId[] {
    const ids: BoxId[] = [];
    for (const [id, box] of store) {
      if (box.alive?.value === true) ids.push(id);
    }
    return ids;
  }

  /** Converged paint order: alive boxes, stable-sorted by (orderKey, BoxId). */
  private orderOf(store: Map<BoxId, BoxState>): BoxId[] {
    return this.aliveIds(store).sort((a, b) => {
      const ka = store.get(a)?.order?.value ?? '';
      const kb = store.get(b)?.order?.value ?? '';
      return ka < kb ? -1 : ka > kb ? 1 : a < b ? -1 : a > b ? 1 : 0;
    });
  }

  private rowOf(store: Map<BoxId, BoxState>, id: BoxId): BoxRow {
    const box = store.get(id);
    const row: BoxRow = {};
    if (box) {
      // Sort keys so the row serialization is CANONICAL - field insertion order
      // depends on op apply order, but the render-hash proxy (plans/99 section 8) must be
      // interleaving-independent. Field VALUES converge via LWW; key order must not
      // leak the apply order.
      for (const field of [...box.fields.keys()].sort()) {
        const reg = box.fields.get(field);
        if (reg !== undefined) row[field] = reg.value;
      }
    }
    return row;
  }

  /** Alive rows keyed by id, in canonical order - the snapshot both `state()`
   *  collections and the canvas `boxes` map are built from. */
  private snapshot(store: Map<BoxId, BoxState>): Map<BoxId, BoxRow> {
    const boxes = new Map<BoxId, BoxRow>();
    for (const id of this.aliveIds(store).sort()) boxes.set(id, this.rowOf(store, id));
    return boxes;
  }

  private currentRows(col?: string): Map<BoxId, BoxRow> {
    // Read path: an untouched collection has no store and must NOT materialize one.
    const store = col === undefined ? this.boxes : this.collections.get(col);
    const rows = new Map<BoxId, BoxRow>();
    if (store !== undefined) {
      for (const id of this.orderOf(store)) rows.set(id, this.rowOf(store, id));
    }
    return rows;
  }
}

// ── Fractional-index helper (append-only, base-36, lexically sortable) ──────────
//
// orderKey strings are compared LEXICALLY, and lexical order of base-36 digit
// strings equals fractional order (a shorter string that is a prefix sorts first,
// like a shorter decimal fraction). `keyAfter` returns a key strictly greater than
// its argument with no upper bound - all `damageToOps` ever needs (it appends in
// paint order). The between-two-keys case (concurrent mid-inserts) is the real
// Y.Array adapter's job (plans/99 section 8 order-model divergence).

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const MID_DIGIT = DIGITS[Math.floor(DIGITS.length / 2)] ?? 'i';

function keyAfter(a: string): string {
  if (a === '') return MID_DIGIT;
  const chars = a.split('');
  for (let i = chars.length - 1; i >= 0; i--) {
    const d = DIGITS.indexOf(chars[i] ?? '0');
    if (d >= 0 && d < DIGITS.length - 1) {
      const next = DIGITS[d + 1];
      if (next !== undefined) {
        chars[i] = next;
        return chars.slice(0, i + 1).join('');
      }
    }
  }
  // All digits are the max ('z…'): append a mid digit to grow strictly larger.
  return a + MID_DIGIT;
}
