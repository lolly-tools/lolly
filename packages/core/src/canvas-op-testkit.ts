// SPDX-License-Identifier: MPL-2.0
/**
 * The §8 shared conformance suite for the canvas-op contract (plans/99) — SHIPPED in
 * @lolly-tools/core so BOTH repos run the same bytes: OSS against the dependency-free
 * `ReferenceCanvasDoc` (tests/canvas-op-convergence.test.ts), and lolly-work against its
 * real Yjs adapter (imported via engine-pin.json). This is the coupling test the
 * contract calls "owned by the architect" — changing `runConvergenceSuite`'s signature
 * is a coordinated cross-repo (major) change (plans/99 §9).
 *
 * The suite is parameterized over `CanvasSyncAdapter` and asserts APPLY-ORDER
 * INDEPENDENCE: applying the same op log in any interleaving yields byte-identical
 * state + render-hash (plans/98 §11 determinism ⇒ identical `boxes` ⇒ identical pixels).
 * The claim is WITHIN each adapter model (all interleavings agree for THAT model), not
 * cross-model byte-equality — the reference's order is an LWW fractional index, a real
 * Yjs adapter's is a Y.Array (plans/99 §3, §8 order-model divergence).
 *
 * Self-contained: it imports only canvas-op TYPES and `node:assert` (a builtin), plus an
 * inlined mulberry32 PRNG — no `node:test`, no tests/ helper — so it is safe to ship and
 * to call from inside any test runner's `test()` block.
 */
import assert from 'node:assert/strict';
import type {
  BoxId,
  BoxRow,
  Scalar,
  GeometryField,
  OpOrigin,
  Damage,
  ParamValue,
  Awareness,
  CanvasOp,
  CanvasDocState,
  CanvasSyncAdapter,
} from './canvas-op-v1.ts';

// ── Seeded PRNG (inlined mulberry32; matches tests/fuzz/prng.ts) ─────────────────

interface Rng {
  next(): number;
  int(n: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
}

/** Deterministic 32-bit PRNG — no Date.now / Math.random, so a failing seed reproduces
 *  forever and CI never flakes. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number): number => Math.floor(next() * n),
    chance: (p: number): boolean => next() < p,
    pick<T>(arr: readonly T[]): T { return arr[Math.floor(next() * arr.length)]!; },
  };
}

// ── Deterministic serialization (the comparison keys) ───────────────────────────

/** The full converged document as a stable string. `state()` already emits boxes and
 *  params in canonical (sorted) key order, so this string is interleaving-independent
 *  for a convergent adapter. v1.1: collections serialize too — sorted HERE by
 *  collection id (emission order is not part of the contract) and normalized so an
 *  absent map and an empty map compare equal. */
function serializeState(s: CanvasDocState): string {
  const colEntries = s.collections === undefined ? [] : [...s.collections.entries()];
  const collections = colEntries
    .map(([id, c]) => [id, { order: c.order, boxes: [...c.boxes.entries()] }] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify({
    order: s.order,
    boxes: [...s.boxes.entries()],
    params: [...s.params.entries()],
    collections,
  });
}

/** The render-hash proxy (plans/99 §8): box rows in paint order, from the
 *  CanvasSyncAdapter interface alone (not the reference-only `canonicalBoxes()`).
 *  v1.1: each collection's rows ride in ITS paint order, keyed by collection id. */
function renderHash(s: CanvasDocState): string {
  const colEntries = s.collections === undefined ? [] : [...s.collections.entries()];
  const collections = colEntries
    .map(([id, c]) => [id, c.order.map((bid) => c.boxes.get(bid) ?? null)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify({
    canvas: s.order.map((id) => s.boxes.get(id) ?? null),
    collections,
  });
}

/** Fisher–Yates over a seeded PRNG — a reproducible client apply-order. */
function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const ai = a[i]!;
    const aj = a[j]!;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

function applyAll(adapter: CanvasSyncAdapter, ops: readonly CanvasOp[]): void {
  for (const op of ops) adapter.apply(op);
}

/** Apply `ops` in generated order to establish the "truth", then in N random
 *  interleavings; assert every interleaving converges to identical full state AND
 *  identical render-hash. */
function assertConverges(
  makeAdapter: () => CanvasSyncAdapter,
  ops: readonly CanvasOp[],
  rng: Rng,
  nClients: number,
  label: string,
): void {
  const truth = makeAdapter();
  applyAll(truth, ops);
  const truthState = serializeState(truth.state());
  const truthRender = renderHash(truth.state());

  for (let c = 0; c < nClients; c++) {
    const d = makeAdapter();
    applyAll(d, shuffle(rng, ops));
    assert.equal(serializeState(d.state()), truthState, `${label}: full state diverged (client ${c})`);
    assert.equal(renderHash(d.state()), truthRender, `${label}: render-hash diverged (client ${c})`);
  }
}

// ── Deterministic op-log generation ─────────────────────────────────────────────

const AUTHORS = ['c1', 'c2', 'c3'] as const;
const CONTENT_FIELDS = ['text', 'fill', 'stroke', 'locked'] as const;
const GEOM_FIELDS = ['x', 'y', 'w', 'h', 'rot'] as const;

function scalarValue(rng: Rng): Scalar {
  switch (rng.int(5)) {
    case 0:
      return rng.int(1000);
    case 1:
      return `s${rng.int(100)}`;
    case 2:
      return rng.chance(0.5);
    case 3:
      return null;
    default:
      return rng.int(50) - 25;
  }
}

/**
 * A mixed op log across three authors. Each author keeps its OWN strictly-increasing
 * Lamport clock, so (clock, client) is unique per author and two authors that land on
 * the same clock are genuinely CONCURRENT — resolved by the `client` tiebreak. This
 * gives a strict total order over every origin that appears, which is exactly what
 * makes convergence order-independent (the property under test).
 */
function genOps(rng: Rng, count: number): CanvasOp[] {
  const ops: CanvasOp[] = [];
  const clk = new Map<string, number>();
  const ids: BoxId[] = [];
  let orderN = 0;
  let boxN = 0;

  const nextOrderKey = (): string => String(orderN++).padStart(6, '0');
  const originOf = (): OpOrigin => {
    const client = rng.pick(AUTHORS);
    const clock = (clk.get(client) ?? 0) + 1;
    clk.set(client, clock);
    return { client, clock };
  };

  for (let i = 0; i < count; i++) {
    const roll = ids.length === 0 ? 0 : rng.next();

    if (roll < 0.2) {
      const id = `box${String(boxN++).padStart(4, '0')}`;
      ids.push(id);
      const row: BoxRow = {
        id,
        x: rng.int(500),
        y: rng.int(500),
        w: 10 + rng.int(200),
        h: 10 + rng.int(200),
        rot: rng.int(360),
        text: `t${rng.int(50)}`,
      };
      ops.push({ k: 'add', id, row, orderKey: nextOrderKey(), origin: originOf() });
    } else if (roll < 0.45) {
      const id = rng.pick(ids);
      const fields: Partial<Record<GeometryField, number>> = {};
      for (const g of GEOM_FIELDS) if (rng.chance(0.5)) fields[g] = rng.int(1000);
      if (Object.keys(fields).length === 0) fields.x = rng.int(1000);
      ops.push({ k: 'geom', id, fields, origin: originOf() });
    } else if (roll < 0.65) {
      const id = rng.pick(ids);
      ops.push({ k: 'field', id, field: rng.pick(CONTENT_FIELDS), value: scalarValue(rng), origin: originOf() });
    } else if (roll < 0.78) {
      ops.push({ k: 'order', id: rng.pick(ids), orderKey: nextOrderKey(), origin: originOf() });
    } else if (roll < 0.9) {
      const value: ParamValue = rng.chance(0.5)
        ? scalarValue(rng)
        : { bind: { provider: `prov${rng.int(3)}`, query: `q${rng.int(5)}` } };
      ops.push({ k: 'param', key: `p${rng.int(4)}`, value, origin: originOf() });
    } else {
      ops.push({ k: 'remove', id: rng.pick(ids), origin: originOf() });
    }
  }
  return ops;
}

// ── Focused cases (each parameterized over the adapter) ──────────────────────────

/** §4.3 lane discipline: a concurrent move + restyle on ONE box composes with no lost
 *  update, because geometry and content are different keys. */
function caseConcurrentMoveRestyle(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const add: CanvasOp = {
    k: 'add',
    id: 'b1',
    row: { id: 'b1', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'red' },
    orderKey: '000',
    origin: { client: 'c0', clock: 1 },
  };
  const move: CanvasOp = { k: 'geom', id: 'b1', fields: { x: 100 }, origin: { client: 'c1', clock: 5 } };
  const restyle: CanvasOp = { k: 'field', id: 'b1', field: 'fill', value: 'blue', origin: { client: 'c2', clock: 5 } };

  for (const order of [
    [add, move, restyle],
    [add, restyle, move],
  ] as const) {
    const d = makeAdapter();
    applyAll(d, order);
    const row = d.state().boxes.get('b1');
    assert.ok(row, `${label}: box lost`);
    assert.equal(row.x, 100, `${label}: geometry lost to a concurrent restyle`);
    assert.equal(row.fill, 'blue', `${label}: restyle lost to a concurrent move`);
  }
}

/** §6: a param LITERAL converges by LWW (higher clock wins). */
function caseParamLiteralConverges(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const lo: CanvasOp = { k: 'param', key: 'k', value: 1, origin: { client: 'a', clock: 1 } };
  const hi: CanvasOp = { k: 'param', key: 'k', value: 2, origin: { client: 'b', clock: 2 } };
  for (const order of [
    [lo, hi],
    [hi, lo],
  ] as const) {
    const d = makeAdapter();
    applyAll(d, order);
    assert.equal(d.state().params.get('k'), 2, `${label}: param literal did not converge`);
  }
}

/** §6: a param BINDING syncs as a descriptor `{bind: providerRef}`, never a resolved
 *  datum — live data does not travel through the CRDT. */
function caseParamBindingDescriptor(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const binding: ParamValue = { bind: { provider: 'sales', query: 'q1', version: 'v3' } };
  const d = makeAdapter();
  d.apply({ k: 'param', key: 'ds', value: binding, origin: { client: 'a', clock: 1 } });
  const v = d.state().params.get('ds');
  assert.ok(v && typeof v === 'object' && 'bind' in v, `${label}: binding lost its descriptor shape`);
  assert.deepEqual(v, binding, `${label}: binding descriptor mutated in transit`);
}

/** §7: an op on a LOCKED field is filtered from the stream before it reaches the doc.
 *  Convergence still holds and the locked field never enters the persisted state. */
function caseLockedFieldFiltered(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const rng = mulberry32(0x10cced);
  const ops = genOps(rng, 50).filter((op) => !(op.k === 'field' && op.field === 'locked'));
  assertConverges(makeAdapter, ops, rng, 4, `${label} locked-filtered`);
  const d = makeAdapter();
  applyAll(d, ops);
  for (const row of d.state().boxes.values()) {
    assert.ok(!('locked' in row), `${label}: a filtered locked field leaked into the doc`);
  }
}

/** §2: an id is never reused; a remove-then-re-add converges by LWW on the `alive`
 *  register — the highest-clock write wins regardless of interleaving. */
function caseRemoveReAdd(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const add1: CanvasOp = { k: 'add', id: 'z', row: { id: 'z', x: 1, y: 2, w: 3, h: 4, rot: 0 }, orderKey: '001', origin: { client: 'a', clock: 1 } };
  const rem: CanvasOp = { k: 'remove', id: 'z', origin: { client: 'a', clock: 2 } };
  const readd: CanvasOp = { k: 'add', id: 'z', row: { id: 'z', x: 9, y: 9, w: 9, h: 9, rot: 0 }, orderKey: '002', origin: { client: 'a', clock: 3 } };
  const perms: CanvasOp[][] = [
    [add1, rem, readd],
    [add1, readd, rem],
    [rem, add1, readd],
    [rem, readd, add1],
    [readd, add1, rem],
    [readd, rem, add1],
  ];
  for (const perm of perms) {
    const d = makeAdapter();
    applyAll(d, perm);
    const row = d.state().boxes.get('z');
    assert.ok(row, `${label}: highest-clock re-add did not win (box absent)`);
    assert.equal(row.x, 9, `${label}: re-add row lost`);
  }
}

/** §4.1: the emit → remote-apply loop. `onLocalChange` derives ops from a gesture and
 *  applies them locally; a second client's `applyRemotePatch` reproduces the state. */
function caseEmitApplyLoop(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const a = makeAdapter();
  const b = makeAdapter();

  const b1: BoxRow = { id: 'b1', x: 0, y: 0, w: 10, h: 10, rot: 0, text: 'hi' };
  const b2: BoxRow = { id: 'b2', x: 5, y: 5, w: 20, h: 20, rot: 0, text: 'yo' };
  const rows = new Map<BoxId, BoxRow>([['b1', b1], ['b2', b2]]);
  const addDamage: Damage = { moved: [], restyled: [], added: ['b1', 'b2'], removed: [], zChanged: [], frames: [] };
  b.applyRemotePatch(a.onLocalChange(addDamage, rows));
  assert.equal(serializeState(b.state()), serializeState(a.state()), `${label}: emit→apply (adds) diverged`);

  // A second gesture: move b1, restyle b2 — different lanes, one transaction.
  const rows2 = new Map<BoxId, BoxRow>([
    ['b1', { ...b1, x: 99 }],
    ['b2', { ...b2, text: 'changed' }],
  ]);
  const editDamage: Damage = { moved: ['b1'], restyled: ['b2'], added: [], removed: [], zChanged: [], frames: [] };
  b.applyRemotePatch(a.onLocalChange(editDamage, rows2));
  assert.equal(serializeState(b.state()), serializeState(a.state()), `${label}: emit→apply (move+restyle) diverged`);
}

/**
 * §4.1 + plans/100 §3: a gesture's row ORDER survives the emit → remote-apply loop,
 * including the two cases a row-map diff is blind to — an insert at the TOP, and a
 * pure reorder that touches no field.
 *
 * This is the case that was missing while `damageToOps` minted every added row's
 * order key from a sequence that restarted per call: the second gesture handed a new
 * row a key an EXISTING row already held, the tie broke by BoxId (and ULIDs sort by
 * creation time, so the new row always lost), and both peers converged — on an order
 * neither user asked for. For a `blocks` collection that is not cosmetic: row order
 * is the content.
 */
function caseLocalOrderRoundTrips(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const a = makeAdapter();
  const b = makeAdapter();
  const row = (id: BoxId, text: string): BoxRow => ({ id, x: 0, y: 0, w: 10, h: 10, rot: 0, text });
  const damageOf = (added: BoxId[], zChanged: BoxId[]): Damage =>
    ({ moved: [], restyled: [], added, removed: [], zChanged, frames: [] });
  const sync = (rows: Map<BoxId, BoxRow>, damage: Damage): CanvasOp[] => {
    const ops = a.onLocalChange(damage, rows);
    b.applyRemotePatch(ops);
    return ops;
  };
  const expectOrder = (expected: BoxId[], what: string): void => {
    assert.deepEqual(a.state().order, expected, `${label}: ${what} — author's own order is wrong`);
    assert.deepEqual(b.state().order, expected, `${label}: ${what} — peer's order diverged`);
  };

  const g1 = new Map<BoxId, BoxRow>([['r01', row('r01', 'one')], ['r02', row('r02', 'two')]]);
  sync(g1, damageOf(['r01', 'r02'], []));
  expectOrder(['r01', 'r02'], 'initial adds');

  // Insert at the TOP of an existing collection — the collision case.
  const g2 = new Map<BoxId, BoxRow>([['r03', row('r03', 'three')], ...g1]);
  sync(g2, damageOf(['r03'], []));
  expectOrder(['r03', 'r01', 'r02'], 'insert at the top');

  // A pure reorder: same rows, same fields, different sequence.
  const g3 = new Map<BoxId, BoxRow>([['r01', row('r01', 'one')], ['r03', row('r03', 'three')], ['r02', row('r02', 'two')]]);
  const ops = sync(g3, damageOf([], ['r01', 'r02', 'r03']));
  assert.ok(ops.length > 0, `${label}: a pure reorder emitted nothing at all`);
  expectOrder(['r01', 'r03', 'r02'], 'pure reorder');

  // And the next gesture diffs against THAT order, not a stale one.
  const g4 = new Map<BoxId, BoxRow>([...g3, ['r04', row('r04', 'four')]]);
  sync(g4, damageOf(['r04'], []));
  expectOrder(['r01', 'r03', 'r02', 'r04'], 'append after a reorder');
}

/** §5: awareness/presence is ephemeral and must NEVER mutate the persisted doc —
 *  including every v1.1 field (focus/location/following/viewport/chat, plans/100 §3). */
function caseAwarenessNeverMutatesDoc(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const d = makeAdapter();
  d.apply({ k: 'add', id: 'b1', row: { id: 'b1', x: 0, y: 0, w: 1, h: 1, rot: 0 }, orderKey: '001', origin: { client: 'a', clock: 1 } });
  d.apply({ k: 'add', id: 'r1', col: 'list', row: { id: 'r1', label: 'one' }, orderKey: '001', origin: { client: 'a', clock: 2 } });
  const before = serializeState(d.state());
  const presence: Awareness = {
    userId: 'u1',
    name: 'Ann',
    color: '#f00',
    cursor: { x: 0.5, y: 0.5 },
    selection: ['b1'],
    drag: { ids: ['b1'], dxy: [0.1, 0.2] },
    focus: 'list:r1',
    location: 'slide-2',
    following: 'u2',
    viewport: { x: 0.25, y: 0.5, zoom: 1.5 },
    chat: 'look here',
  };
  d.presence(presence);
  assert.equal(serializeState(d.state()), before, `${label}: awareness mutated the persisted doc`);
}

// ── v1.1 focused cases (plans/100 §3 — collections + presence, additive) ─────────

/** plans/100 §3: collection-scoped ops converge exactly like canvas ops — per-
 *  collection registers, per-collection order — and land in `collections`, never
 *  the canvas box map. */
function caseCollectionOpsConverge(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const rng = mulberry32(0xc0111d);
  const ops = genOps(rng, 60).map((op) => (op.k === 'param' ? op : { ...op, col: 'rows' }));
  assertConverges(makeAdapter, ops, rng, 4, `${label} col=rows`);

  const d = makeAdapter();
  applyAll(d, ops);
  const s = d.state();
  assert.equal(s.boxes.size, 0, `${label}: collection-scoped ops leaked into the canvas collection`);
  const rows = s.collections?.get('rows');
  assert.ok(rows !== undefined && rows.boxes.size > 0, `${label}: collection 'rows' missing from state()`);

  // A mixed log — canvas + two collections interleaved — converges the same way.
  const rng2 = mulberry32(0x5c07ed);
  const base = genOps(rng2, 60);
  const cols = [undefined, 'a', 'b'] as const;
  const mixed = base.map((op) => {
    if (op.k === 'param') return op;
    const col = rng2.pick(cols);
    return col === undefined ? op : { ...op, col };
  });
  assertConverges(makeAdapter, mixed, rng2, 4, `${label} mixed-collections`);
}

/** plans/100 §3: the same BoxId in the canvas collection and in a blocks collection
 *  are INDEPENDENT documents — writes and removes on one never touch the other. */
function caseCollectionsIndependent(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const addCanvas: CanvasOp = { k: 'add', id: 'b1', row: { id: 'b1', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'red' }, orderKey: '001', origin: { client: 'a', clock: 1 } };
  const addList: CanvasOp = { k: 'add', id: 'b1', col: 'list', row: { id: 'b1', label: 'one' }, orderKey: '001', origin: { client: 'a', clock: 2 } };
  const editList: CanvasOp = { k: 'field', id: 'b1', col: 'list', field: 'label', value: 'two', origin: { client: 'b', clock: 3 } };
  const removeCanvas: CanvasOp = { k: 'remove', id: 'b1', origin: { client: 'b', clock: 4 } };
  const ops = [addCanvas, addList, editList, removeCanvas];
  for (const order of [ops, [...ops].reverse(), [addList, removeCanvas, addCanvas, editList]]) {
    const d = makeAdapter();
    applyAll(d, order);
    const s = d.state();
    assert.equal(s.boxes.has('b1'), false, `${label}: canvas remove lost, or leaked in from the collection`);
    const list = s.collections?.get('list');
    assert.ok(list !== undefined, `${label}: collection 'list' missing`);
    assert.equal(list.boxes.get('b1')?.label, 'two', `${label}: collection row lost or cross-written`);
    assert.deepEqual(list.order, ['b1'], `${label}: collection order wrong`);
  }
}

/** The additive guarantee (plans/100 §3): a v1.0 op stream — no `col` anywhere —
 *  still applies to the default canvas collection and yields a v1.0-shaped state
 *  (`collections` absent or empty). */
function caseV10OpsUnscoped(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const d = makeAdapter();
  d.apply({ k: 'add', id: 'b1', row: { id: 'b1', x: 1, y: 2, w: 3, h: 4, rot: 0 }, orderKey: '001', origin: { client: 'a', clock: 1 } });
  d.apply({ k: 'field', id: 'b1', field: 'fill', value: 'red', origin: { client: 'a', clock: 2 } });
  const s = d.state();
  assert.equal(s.boxes.get('b1')?.fill, 'red', `${label}: a v1.0 op no longer applies to the canvas`);
  assert.ok(
    s.collections === undefined || s.collections.size === 0,
    `${label}: a v1.0 op stream materialized a collection`,
  );
}

// ── The exported shared suite (plans/99 §8) ─────────────────────────────────────

/**
 * The cross-repo conformance suite. Runs the fuzz convergence property plus the focused
 * lane/param/awareness cases against whatever adapter `makeAdapter` builds. Call it from
 * inside a `test()` block: `test('yjs §8', () => runConvergenceSuite(() => new YjsAdapter(), 'yjs'))`.
 * Keep the signature `(makeAdapter, label) => void` stable — changing it is a coordinated,
 * cross-repo (major) change (plans/99 §9).
 */
export function runConvergenceSuite(makeAdapter: () => CanvasSyncAdapter, label: string): void {
  const SEEDS = [1, 7, 13, 42, 99, 256, 1024, 7777, 20260808, 0xc0ffee];
  const N_CLIENTS = 5;

  for (const seed of SEEDS) {
    const rng = mulberry32(seed);
    const ops = genOps(rng, 60);
    assertConverges(makeAdapter, ops, rng, N_CLIENTS, `${label} seed=${seed}`);

    // Idempotency: re-applying the whole log changes nothing (LWW keeps the winner).
    const d = makeAdapter();
    applyAll(d, ops);
    const once = serializeState(d.state());
    applyAll(d, ops);
    assert.equal(serializeState(d.state()), once, `${label} seed=${seed}: apply is not idempotent`);
  }

  caseConcurrentMoveRestyle(makeAdapter, label);
  caseParamLiteralConverges(makeAdapter, label);
  caseParamBindingDescriptor(makeAdapter, label);
  caseLockedFieldFiltered(makeAdapter, label);
  caseRemoveReAdd(makeAdapter, label);
  caseEmitApplyLoop(makeAdapter, label);
  caseLocalOrderRoundTrips(makeAdapter, label);
  caseAwarenessNeverMutatesDoc(makeAdapter, label);
  // v1.1 (plans/100 §3) — appended, never reordered; the suite signature is pinned.
  caseCollectionOpsConverge(makeAdapter, label);
  caseCollectionsIndependent(makeAdapter, label);
  caseV10OpsUnscoped(makeAdapter, label);
}
