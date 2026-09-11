// SPDX-License-Identifier: MPL-2.0
/**
 * Shell collab plumbing (plan 100 section 5, wave 0.5).
 *
 * The claims worth pinning, in order of how much a regression would cost:
 *
 *  1. INERTNESS. With no provider registered, attaching must not touch the runtime
 *     at all - proven by a call-count spy on the underlying setInput, not by
 *     reading the code. This is the single promise the whole seam makes to every
 *     build of this repo (plans/99 section 1.1).
 *  2. Echo suppression. A remote batch lands through `applyPatch` and must not come
 *     back out as ops, and must not record an undo step (section 5).
 *  3. Coalescing. A burst of remote ops is ONE apply per animation frame.
 *  4. The order-key progression this module mints must match the one the CONTRACT's
 *     own `damageToOps` threads - asserted against its real output, so a change on
 *     either side fails here rather than silently sorting two peers differently.
 *  5. Hook-derived patches never re-emit (plan 100 section 11.9). A hook that writes OTHER
 *     inputs/extras in response to an edit must not turn into ops of its own - only
 *     the id the caller actually set does. Mounts the real engine `createRuntime`
 *     (every other test here uses the fake `harness()`, whose setInput never runs a
 *     hook at all, so it can't pin this).
 *
 * Run directly:  node --test shells/web/src/lib/collab-plumbing.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReferenceCanvasDoc, damageToOps } from '@lolly-tools/core/canvas-op-v1';
import type {
  Awareness, BoxId, BoxRow, CanvasOp, CanvasSyncAdapter, Damage, ParamOp,
} from '@lolly-tools/core/canvas-op-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import { createRuntime } from '../../../../engine/src/runtime.ts';
import {
  _clearCanvasSyncProviderForTests, registerCanvasSyncProvider,
} from './canvas-sync-provider.ts';
import {
  _resetCollabDeviceForTests, attachCollabPlumbing, orderKeysFor,
} from './collab-plumbing.ts';
import type { CollabRuntime } from './collab-plumbing.ts';
import { ROW_ID_FIELD } from './row-id.ts';

// ── fakes ─────────────────────────────────────────────────────────────────────

/** A CanvasSyncAdapter that records every crossing and converges for real (the
 *  dependency-free reference document does the merging). */
class FakeAdapter implements CanvasSyncAdapter {
  readonly doc = new ReferenceCanvasDoc('peer');
  /** Ops the SHELL minted and handed over one at a time. */
  readonly applied: CanvasOp[] = [];
  /** Local-edit gestures the shell delegated to the adapter's own differ. */
  readonly local: { damage: Damage; rows: Map<BoxId, BoxRow>; col?: string }[] = [];
  readonly remote: CanvasOp[][] = [];

  onLocalChange(damage: Damage, rows: Map<BoxId, BoxRow>, col?: string): CanvasOp[] {
    this.local.push({ damage, rows: new Map(rows), col });
    return this.doc.onLocalChange(damage, rows, col);
  }
  apply(op: CanvasOp): void {
    this.applied.push(op);
    this.doc.apply(op);
  }
  applyRemotePatch(ops: readonly CanvasOp[]): Damage {
    this.remote.push([...ops]);
    return this.doc.applyRemotePatch(ops);
  }
  presence(_a: Awareness): void { /* ephemeral, never in the doc */ }
  state() { return this.doc.state(); }
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

interface Harness extends CollabRuntime {
  /** Every call that reached the base setter - the byte-identical-behaviour spy. */
  readonly base: { id: string; value: InputValue }[];
  /** What mountTool's undo wrapper would have recorded. */
  readonly history: { id: string; before: InputValue; after: InputValue }[];
  readonly patches: Record<string, unknown>[];
  valueOf(id: string): InputValue;
}

/** A runtime wired the way mountTool wires one: a base setter under an undo-history
 *  wrapper, plus the engine's applyPatch (which never re-enters setInput). */
function harness(items: InputModelItem[]): Harness {
  let model = items.map(i => ({ ...i }));
  const base: { id: string; value: InputValue }[] = [];
  const history: { id: string; before: InputValue; after: InputValue }[] = [];
  const patches: Record<string, unknown>[] = [];
  const write = (id: string, value: InputValue): void => {
    model = model.map(i => (i.id === id ? { ...i, value } : i));
  };
  return {
    base, history, patches,
    getModel: () => model,
    valueOf: (id) => model.find(i => i.id === id)!.value,
    async setInput(id, value) {
      const cur = model.find(i => i.id === id);
      if (cur && !same(cur.value, value)) history.push({ id, before: cur.value, after: value });
      base.push({ id, value });
      write(id, value);
    },
    async applyPatch(values) {
      patches.push(values);
      for (const [id, v] of Object.entries(values)) {
        if (model.some(i => i.id === id)) write(id, v as InputValue);
      }
    },
  };
}

function text(id: string, value: InputValue): InputModelItem {
  return { id, type: 'text', value, isDirty: false, control: 'text-input' };
}

function blocks(id: string, value: InputValue, extra: Partial<InputModelItem> = {}): InputModelItem {
  return {
    id, type: 'blocks', value, isDirty: false, control: 'blocks',
    fields: [{ id: 'label', type: 'text' }],
    ...extra,
  };
}

/** A hand-driven frame scheduler, so nothing here depends on rAF. */
function scheduler() {
  const pending: (() => void)[] = [];
  return {
    raf: (fn: () => void) => { pending.push(fn); },
    depth: () => pending.length,
    async frame() {
      const fns = pending.splice(0, pending.length);
      for (const fn of fns) fn();
      await new Promise(r => setTimeout(r, 0));   // let the async flush settle
    },
  };
}

const ROW = (rid: string, extra: Record<string, unknown> = {}) => ({ [ROW_ID_FIELD]: rid, ...extra });

// ── inertness ─────────────────────────────────────────────────────────────────

test('with no provider registered, attaching is a no-op and setInput is untouched', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const rt = harness([text('title', 'hello')]);
  const before = rt.setInput;

  const collab = attachCollabPlumbing(rt);

  assert.equal(collab, null, 'no provider → nothing to attach to');
  assert.equal(rt.setInput, before, 'the runtime setter was not even re-assigned');
  await rt.setInput('title', 'world');
  assert.deepEqual(rt.base, [{ id: 'title', value: 'world' }], 'exactly one call reached the base setter');
  assert.equal(rt.history.length, 1, 'undo history behaves exactly as before');
});

test('a registered provider is picked up from the registry, not just from opts', () => {
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const unregister = registerCanvasSyncProvider(adapter);
  try {
    const rt = harness([text('title', 'hello')]);
    const collab = attachCollabPlumbing(rt);
    assert.notEqual(collab, null);
    collab!.detach();
  } finally {
    unregister();
    _clearCanvasSyncProviderForTests();
  }
});

// ── outbound ──────────────────────────────────────────────────────────────────

test('a local scalar edit emits exactly one ParamOp and still reaches the runtime', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'hello')]);
  const emitted: CanvasOp[][] = [];
  attachCollabPlumbing(rt, { adapter, onOps: ops => emitted.push([...ops]) });

  await rt.setInput('title', 'world');

  assert.equal(adapter.applied.length, 1);
  const op = adapter.applied[0] as ParamOp;
  assert.equal(op.k, 'param');
  assert.equal(op.key, 'title');
  assert.equal(op.value, 'world');
  assert.equal(op.origin.client, 'device-a');
  assert.ok(op.origin.clock > 0, 'Lamport clock, never a wall clock');
  assert.deepEqual(emitted, [[op]]);
  // The edit itself is untouched: one base call, one undo step.
  assert.deepEqual(rt.base, [{ id: 'title', value: 'world' }]);
  assert.equal(rt.history.length, 1);
  assert.equal(adapter.doc.state().params.get('title'), 'world');
});

test('an identical re-write and an object value never cross the seam', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([
    text('title', 'hello'),
    { id: 'logo', type: 'asset', value: null, isDirty: false, control: 'asset-picker' },
  ]);
  attachCollabPlumbing(rt, { adapter });

  await rt.setInput('title', 'hello');                                  // no change
  await rt.setInput('logo', { source: 'library', id: 'x' } as unknown as InputValue);
  await rt.setInput('nope', 'x');                                        // no such input

  assert.deepEqual(adapter.applied, [], 'nothing minted');
  assert.equal(rt.base.length, 3, 'and every write still reached the runtime');
});

test('a history replay is a local edit and syncs like any other', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'hello')]);
  attachCollabPlumbing(rt, { adapter });

  await rt.setInput('title', 'world');
  await rt.setInput('title', 'hello');   // what undo replays through the same setter

  assert.equal(adapter.applied.length, 2);
  assert.equal((adapter.applied[1] as ParamOp).value, 'hello');
  assert.ok(
    adapter.applied[1]!.origin.clock > adapter.applied[0]!.origin.clock,
    'the undo is a strictly newer LWW write (plan 100 section 11.15)',
  );
});

test('a blocks row edit emits row-scoped ops carrying col', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rows = [ROW('AAA', { label: 'a' }), ROW('BBB', { label: 'b' })];
  const rt = harness([blocks('rows', rows as unknown as InputValue)]);
  const emitted: CanvasOp[] = [];
  attachCollabPlumbing(rt, { adapter, onOps: ops => emitted.push(...ops) });

  // First gesture: the shell hands over the WHOLE post-gesture row map, so an
  // adapter that has never seen this session catches itself up with adds. That
  // self-healing is why no explicit seeding step exists here.
  await rt.setInput('rows', [ROW('AAA', { label: 'a2' }), rows[1]!] as unknown as InputValue);
  assert.deepEqual(emitted.map(o => o.k), ['add', 'add']);
  emitted.length = 0;

  await rt.setInput('rows', [ROW('AAA', { label: 'a3' }), rows[1]!] as unknown as InputValue);

  assert.equal(adapter.local.length, 2, 'delegated to the adapter local-edit door');
  const gesture = adapter.local[1]!;
  assert.equal(gesture.col, 'rows', 'the collection is the input id (contract v1.1)');
  assert.deepEqual(gesture.damage.restyled, ['AAA']);
  assert.deepEqual([...gesture.rows.keys()], ['AAA', 'BBB']);
  assert.equal(gesture.rows.get('AAA')![ROW_ID_FIELD], undefined, 'the id is the KEY, not a field');
  assert.deepEqual(emitted.map(o => [o.k, o.k === 'param' ? o.key : o.col]), [['field', 'rows']]);
  assert.equal(adapter.applied.length, 0, 'a pure field edit needs no shell-minted op');
});

test('a blocks reorder emits an OrderOp per row, strictly newer than the adapter clock', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const a = ROW('AAA', { label: 'a' });
  const b = ROW('BBB', { label: 'b' });
  const rt = harness([blocks('rows', [a, b] as unknown as InputValue)]);
  const emitted: CanvasOp[] = [];
  attachCollabPlumbing(rt, { adapter, onOps: ops => emitted.push(...ops) });
  // A first gesture catches the adapter up (adds), so the reorder below is measured
  // against a document that already holds both rows.
  await rt.setInput('rows', [a, ROW('BBB', { label: 'b2' })] as unknown as InputValue);
  const adapterClock = Math.max(...emitted.map(o => o.origin.clock));
  emitted.length = 0;

  await rt.setInput('rows', [ROW('BBB', { label: 'b2' }), a] as unknown as InputValue);

  assert.equal(emitted.length, 2, 'a rewrite covers every row, so order is exact on the peer');
  assert.deepEqual(emitted, adapter.applied.slice(-2), 'shell-minted, handed over one at a time');
  assert.deepEqual(
    emitted.map(o => (o.k === 'order' ? [o.k, o.id, o.orderKey, o.col] : [o.k])),
    [['order', 'BBB', 'i', 'rows'], ['order', 'AAA', 'j', 'rows']],
  );
  assert.ok(
    emitted.every(o => o.origin.clock > adapterClock),
    'strictly newer than the adapter-minted add keys it must override',
  );
  assert.deepEqual(adapter.doc.state().collections!.get('rows')!.order, ['BBB', 'AAA']);
});

test('an insert rewrites the order too (an add-time key cannot know about deletions)', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const a = ROW('AAA', { label: 'a' });
  const b = ROW('BBB', { label: 'b' });
  const rt = harness([blocks('rows', [a, b] as unknown as InputValue)]);
  attachCollabPlumbing(rt, { adapter });

  const c = ROW('CCC', { label: 'c' });
  await rt.setInput('rows', [a, c, b] as unknown as InputValue);

  assert.deepEqual(adapter.applied.map(o => o.k), ['order', 'order', 'order']);
  assert.deepEqual(adapter.local[0]!.damage.added, ['CCC']);
  assert.deepEqual(
    adapter.doc.state().collections!.get('rows')!.order,
    ['AAA', 'CCC', 'BBB'],
    'the peer sees the inserted position, not an append',
  );
});

test('orderKeysFor mirrors the contract\'s own add-time key progression', () => {
  const origin = { client: 'x', clock: 1 };
  for (const n of [1, 3, 40, 80]) {
    const next = new Map<BoxId, BoxRow>();
    for (let i = 0; i < n; i++) next.set(`id${i}`, {});
    const contractKeys = damageToOps(new Map(), next, origin)
      .filter(op => op.k === 'add')
      .map(op => (op as { orderKey: string }).orderKey);
    assert.deepEqual(orderKeysFor(n), contractKeys, `n=${n}`);
  }
});

// ── hook-derived patches never re-emit (plan 100 section 11.9, section 13 wave 0.6) ──────────
//
// section 11.9: a local edit runs onInput; the hook's OWN patched inputs/extras are
// derived state each peer computes locally, and must never sync as ops of their
// own - only falls out naturally if hook patches keep flowing through engine
// internals rather than the shell's wrapped setInput. Every other test in this
// file uses the hand-rolled `harness()`, whose fake setInput/applyPatch never run
// a hook at all - that would pin nothing here, since the property under test IS
// the real engine's hook plumbing (setInput/applyPatch merge a hook's patch into
// `model`/`extras` directly, never re-entering `runtime.setInput` - see
// runtime.ts). So this section mounts the real `createRuntime`.

let hookToolSeq = 0;

/** A loadable tool whose onInput hook, on every `title` edit, patches a SECOND
 *  declared input (`mirror`) and an extras-only key (`note`) - the exact "hook
 *  writes other inputs/extras" shape section 11.9 is about. */
function hookTool(hooksSource: string): any {
  return {
    manifest: {
      id: `collab-hooky-${++hookToolSeq}`, name: 'Hooky', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [
        { id: 'title', type: 'text', default: 'hello' },
        { id: 'mirror', type: 'text', default: '' },
      ],
      hooks: { onInput: true },
    },
    template: '<b>{{title}}</b><i>{{mirror}}</i><u>{{note}}</u>',
    hooksSource,
  };
}

/** The minimal HostV1 double createRuntime needs for a hooks-only, asset-free,
 *  compose-free tool (mirrors tests/runtime-hooks.test.ts's logHost). */
function engineHost(): any {
  return { version: '1', profile: { get: async () => ({}) }, log: () => {} };
}

test('a hook-derived patch to OTHER inputs/extras never crosses the seam as an op', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = await createRuntime(
    hookTool(
      "function onInput({ id, value }) {" +
      " if (id !== 'title') return {};" +
      " return { mirror: 'mirror:' + value, note: 'note:' + value };" +
      " }",
    ),
    engineHost(),
    {},
  );
  const emitted: CanvasOp[] = [];
  attachCollabPlumbing(rt, { adapter, onOps: ops => emitted.push(...ops) });

  await rt.setInput('title', 'hi');
  await rt.setInput('title', 'again');

  // Ground truth: the hook actually ran and wrote a DIFFERENT declared input plus
  // an extras-only key - otherwise this test would pass for having tested nothing.
  assert.equal(rt.getModel().find(i => i.id === 'mirror')!.value, 'mirror:again', 'hook wrote another declared input');
  assert.equal(rt.getHydrated(), '<b>again</b><i>mirror:again</i><u>note:again</u>', 'and an extras-only key');

  // The seam saw ops ONLY for the id actually passed to setInput - never the
  // hook-written 'mirror', and never any op keyed 'note' (it isn't even an input).
  assert.deepEqual(emitted.map(o => (o.k === 'param' ? o.key : o.k)), ['title', 'title']);
  assert.deepEqual(adapter.applied.map(o => (o.k === 'param' ? o.key : o.k)), ['title', 'title']);
  assert.ok(emitted.every(o => o.k !== 'param' || o.key !== 'mirror'), 'never an op for the hook-written input');
});

// ── inbound ───────────────────────────────────────────────────────────────────

test('a remote batch applies once per frame, never echoes, never records undo', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'hello'), text('sub', 'x')]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([{ k: 'param', key: 'title', value: 'from peer', origin: { client: 'peer', clock: 7 } }]);
  collab.applyRemotePatch([{ k: 'param', key: 'sub', value: 'also', origin: { client: 'peer', clock: 8 } }]);
  assert.equal(sched.depth(), 1, 'two bursts, one frame');
  assert.deepEqual(rt.patches, [], 'nothing applied before the frame runs');

  await sched.frame();

  assert.deepEqual(rt.patches, [{ title: 'from peer', sub: 'also' }], 'ONE coalesced apply');
  assert.deepEqual(rt.base, [], 'the remote values never went through setInput');
  assert.deepEqual(rt.history, [], 'and never entered the undo stack');
  assert.deepEqual([...adapter.applied], [], 'no echo back out');
  assert.equal(adapter.remote.length, 1, 'the adapter document saw the batch');

  // The device clock absorbed the peer's, so the next local op beats it (Lamport).
  await rt.setInput('title', 'mine');
  assert.ok(adapter.applied[0]!.origin.clock > 8);
});

test('a remote batch mixing param + geom + add ops produces no outbound op of ANY kind', async () => {
  // Echo suppression, exercised across every op kind this seam knows about at
  // once - not just the scalar param case the previous test already covers.
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const canvas = blocks('boxes', [{ id: 'AAA', x: 0, y: 0 }] as unknown as InputValue, {
    fields: [{ id: 'id', type: 'text' }, { id: 'x', type: 'number' }, { id: 'y', type: 'number' }],
    canvas: { idField: 'id' },
  });
  const rt = harness([text('title', 'hello'), canvas]);
  const sched = scheduler();
  const emitted: CanvasOp[] = [];
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf, onOps: ops => emitted.push(...ops) })!;

  collab.applyRemotePatch([
    { k: 'param', key: 'title', value: 'from peer', origin: { client: 'peer', clock: 1 } },
    { k: 'geom', id: 'AAA', col: 'boxes', fields: { x: 42 }, origin: { client: 'peer', clock: 2 } },
    { k: 'add', id: 'BBB', col: 'boxes', row: { x: 1, y: 1 }, orderKey: 'k', origin: { client: 'peer', clock: 3 } },
  ]);
  await sched.frame();

  // Ground truth: the batch actually landed (else "no outbound ops" would be vacuous).
  assert.deepEqual(rt.patches, [{
    title: 'from peer',
    boxes: [{ id: 'AAA', x: 42, y: 0 }, { id: 'BBB', x: 1, y: 1 }],
  }]);
  assert.deepEqual(rt.base, [], 'setInput itself was never called for a remote apply');
  assert.deepEqual(adapter.applied, [], 'no outbound op minted for any op kind in the batch');
  assert.deepEqual(emitted, [], 'onOps - the SAME spy a local edit reports through - never fires for a remote batch');
});

test('remote param ops for undeclared ids, wrong lanes and bindings are dropped', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'hello'), blocks('rows', [])]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([
    { k: 'param', key: 'nope', value: 1, origin: { client: 'peer', clock: 1 } },
    { k: 'param', key: '__proto__', value: 'polluted', origin: { client: 'peer', clock: 2 } },
    { k: 'param', key: 'rows', value: 'not a lane', origin: { client: 'peer', clock: 3 } },
    { k: 'param', key: 'title', value: { bind: { provider: 'p' } }, origin: { client: 'peer', clock: 4 } },
  ]);
  await sched.frame();

  assert.deepEqual(rt.patches, [], 'an all-invalid batch never reaches the runtime at all');
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.deepEqual(rt.valueOf('rows'), []);
});

test('an inbound param is gated on the input\'s TYPE, not just the value\'s shape', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  // The object-valued types the header says never cross. A scalar-shaped value is
  // still wrong for them: a bare string on `logo` gives `{{asset logo}}` a ref it
  // cannot resolve, and the engine's own constraints are deliberately shape-blind
  // for `asset`, so THIS is the gate.
  const item = (id: string, type: string, value: InputValue): InputModelItem =>
    ({ id, type, value, isDirty: false, control: 'text-input' } as unknown as InputModelItem);
  const logo = { source: 'library', id: 'brand/logo' };
  const rt = harness([
    item('logo', 'asset', logo as unknown as InputValue),
    item('pad', 'vector', { x: 1 } as unknown as InputValue),
    item('grid', 'table', { columns: [], rows: [] } as unknown as InputValue),
    item('doc', 'file', null),
    text('title', 'hello'),
  ]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([
    { k: 'param', key: 'logo', value: 'anything', origin: { client: 'peer', clock: 1 } },
    { k: 'param', key: 'pad', value: 4, origin: { client: 'peer', clock: 2 } },
    { k: 'param', key: 'grid', value: 'x,y', origin: { client: 'peer', clock: 3 } },
    { k: 'param', key: 'doc', value: '/etc/passwd', origin: { client: 'peer', clock: 4 } },
    { k: 'param', key: 'title', value: 'from peer', origin: { client: 'peer', clock: 5 } },
  ]);
  await sched.frame();

  assert.deepEqual(rt.patches, [{ title: 'from peer' }], 'only the scalar-typed input crossed');
  assert.deepEqual(rt.valueOf('logo'), logo, 'the asset ref is untouched');
});

test('remote row ops rebuild the array, keeping non-scalar fields and id-less rows', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const start = [
    { [ROW_ID_FIELD]: 'AAA', label: 'a', pic: { source: 'library', id: 'logo' } },
    { label: 'legacy, not yet id\'d' },
    { [ROW_ID_FIELD]: 'BBB', label: 'b' },
  ];
  const rt = harness([blocks('rows', start as unknown as InputValue)]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([
    { k: 'field', id: 'AAA', col: 'rows', field: 'label', value: 'a from peer', origin: { client: 'peer', clock: 1 } },
    { k: 'field', id: 'GHOST', col: 'rows', field: 'label', value: 'resurrected?', origin: { client: 'peer', clock: 2 } },
    { k: 'remove', id: 'BBB', col: 'rows', origin: { client: 'peer', clock: 3 } },
    { k: 'add', id: 'CCC', col: 'rows', row: { label: 'c' }, orderKey: 'k', origin: { client: 'peer', clock: 4 } },
  ]);
  await sched.frame();

  const rows = rt.valueOf('rows') as Record<string, unknown>[];
  assert.equal(rows.length, 3);
  assert.equal(rows[0]![ROW_ID_FIELD], 'AAA');
  assert.equal(rows[0]!.label, 'a from peer');
  assert.deepEqual(rows[0]!.pic, { source: 'library', id: 'logo' }, 'an object field is never clobbered');
  assert.equal(rows[1]!.label, "legacy, not yet id'd", 'an id-less row keeps its place');
  assert.equal(rows[2]![ROW_ID_FIELD], 'CCC');
  assert.equal(rows.some(r => r.label === 'resurrected?'), false, 'no zombie from a field write');
  assert.deepEqual(rt.history, []);
  assert.deepEqual(adapter.applied, []);
});

test('a col-less box op targets the canvas collection', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const canvas = blocks('boxes', [{ id: 'AAA', x: 0, y: 0 }] as unknown as InputValue, {
    fields: [{ id: 'id', type: 'text' }, { id: 'x', type: 'number' }, { id: 'y', type: 'number' }],
    canvas: { idField: 'id' },
  });
  const rt = harness([canvas]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([
    { k: 'geom', id: 'AAA', fields: { x: 42 }, origin: { client: 'peer', clock: 1 } },
  ]);
  await sched.frame();

  assert.deepEqual(rt.valueOf('boxes'), [{ id: 'AAA', x: 42, y: 0 }]);
});

test('a remote batch that changes nothing performs no apply at all', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([blocks('rows', [ROW('AAA', { label: 'a' })] as unknown as InputValue)]);
  const sched = scheduler();
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([
    { k: 'field', id: 'AAA', col: 'rows', field: 'label', value: 'a', origin: { client: 'peer', clock: 1 } },
  ]);
  await sched.frame();

  assert.deepEqual(rt.patches, []);
});

test('detach restores the wrapped setter and drops queued ops', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'hello')]);
  const sched = scheduler();
  const wrapped = rt.setInput;
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;
  assert.notEqual(rt.setInput, wrapped);

  collab.applyRemotePatch([{ k: 'param', key: 'title', value: 'peer', origin: { client: 'peer', clock: 1 } }]);
  collab.detach();
  collab.detach();   // idempotent
  await sched.frame();

  assert.equal(rt.setInput, wrapped, 'the undo wrapper is back in place');
  assert.deepEqual(rt.patches, [], 'a queued batch is abandoned, not applied to a dead mount');
  await rt.setInput('title', 'local again');
  assert.deepEqual(adapter.applied, [], 'and local edits no longer emit');
});

// ── the merge result, not the wire value ──────────────────────────────────────

test('an inbound value that LOST the merge never reaches the model', async () => {
  // The one arrangement that separates "raw op value" from "converged value": the
  // key already carries a HIGHER-clocked write, so the document discards the op that
  // arrives. Reading `op.value` would stomp the winner and put this peer's model
  // permanently out of step with its own document - and with every other peer's.
  // (collab-loopback.test.ts proves the same thing end to end with two runtimes and
  // a partition; this pins the seam itself.)
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const canvas = blocks('rows', [{ id: 'AAA', label: 'mine' }] as unknown as InputValue, {
    fields: [{ id: 'id', type: 'text' }, { id: 'label', type: 'text' }],
    canvas: { idField: 'id' },
  });
  const rt = harness([text('title', 'mine'), canvas]);
  const sched = scheduler();

  // What a local edit at clock 9 leaves in the document, on both lanes. The row is
  // ADDED first, because a box only enters the snapshot once its `alive` register
  // says so - a bare field write on an unknown id is not a resurrection (section 3).
  adapter.doc.apply({ k: 'param', key: 'title', value: 'winner', origin: { client: 'zz', clock: 9 } });
  adapter.doc.apply({
    k: 'add', id: 'AAA', col: 'rows', row: { label: 'winner' }, orderKey: 'i',
    origin: { client: 'zz', clock: 9 },
  });

  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;
  collab.applyRemotePatch([
    { k: 'param', key: 'title', value: 'loser', origin: { client: 'aa', clock: 4 } },
    { k: 'field', id: 'AAA', col: 'rows', field: 'label', value: 'loser', origin: { client: 'aa', clock: 4 } },
  ]);
  await sched.frame();

  assert.equal(adapter.doc.state().params.get('title'), 'winner',
    'the document discarded the older write - it always did');
  assert.deepEqual(rt.patches, [{ title: 'winner', rows: [{ id: 'AAA', label: 'winner' }] }],
    'and the patch carries what the document converged to, on BOTH the param lane '
    + 'and the field lane inside a collection - not what was on the wire');
  assert.equal(rt.valueOf('title'), 'winner');
});

test('a batch whose ops all lose the merge changes nothing, rather than applying stale values', async () => {
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const adapter = new FakeAdapter();
  const rt = harness([text('title', 'winner')]);
  const sched = scheduler();
  adapter.doc.apply({ k: 'param', key: 'title', value: 'winner', origin: { client: 'zz', clock: 9 } });
  const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;

  collab.applyRemotePatch([{ k: 'param', key: 'title', value: 'loser', origin: { client: 'aa', clock: 2 } }]);
  await sched.frame();

  // The patch is still built (the key WAS touched), it just carries the value that
  // is already there - so applyPatch is a no-op in effect and the render never moves.
  assert.deepEqual(rt.patches, [{ title: 'winner' }]);
  assert.equal(rt.valueOf('title'), 'winner');
});

test('an adapter whose state() throws degrades to the raw op values, never to no patch', async () => {
  // The snapshot is a courtesy the contract asks for, not a precondition. A provider
  // that cannot produce one must cost the CONVERGENCE guarantee, not the edit - the
  // fallback is exactly the behaviour that shipped before the snapshot existed.
  _clearCanvasSyncProviderForTests();
  _resetCollabDeviceForTests('device-a');
  const inner = new FakeAdapter();
  const adapter: CanvasSyncAdapter = {
    onLocalChange: (d, r, c) => inner.onLocalChange(d, r, c),
    apply: (op) => { inner.apply(op); },
    applyRemotePatch: (ops) => inner.applyRemotePatch(ops),
    presence: () => {},
    state: () => { throw new Error('snapshot unavailable'); },
  };
  const rt = harness([text('title', 'hello')]);
  const sched = scheduler();
  const realWarn = console.warn;
  const warned: string[] = [];
  console.warn = (m: string): void => { warned.push(m); };
  try {
    const collab = attachCollabPlumbing(rt, { adapter, raf: sched.raf })!;
    collab.applyRemotePatch([{ k: 'param', key: 'title', value: 'from peer', origin: { client: 'peer', clock: 3 } }]);
    await sched.frame();
  } finally {
    console.warn = realWarn;
  }

  assert.deepEqual(rt.patches, [{ title: 'from peer' }], 'the edit still lands');
  assert.ok(warned.some(m => m.includes('adapter state')), 'and the degradation is reported, not silent');
});
