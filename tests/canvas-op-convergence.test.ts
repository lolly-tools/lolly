// SPDX-License-Identifier: MPL-2.0
/**
 * The section 8 shared conformance test for the canvas-op contract (plans/99), OSS side.
 *
 * The suite BODY now lives in the shipped SDK - `@lolly-tools/core/canvas-op-testkit`
 * (`runConvergenceSuite`) - so lolly-work imports the SAME bytes via engine-pin.json and
 * runs it against its real Yjs adapter. Here we run it against the dependency-free
 * `ReferenceCanvasDoc`, and additionally cover the adapter-INDEPENDENT pure helpers
 * (damageToOps / opsToDamage / laneForField / version negotiation) that lolly-work does
 * not re-test. DO NOT change the exported suite signature without cross-repo
 * coordination (plans/99 section 9).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { runConvergenceSuite } from '../packages/core/src/canvas-op-testkit.ts';
import { validateCanvasOp } from '../packages/core/src/validate.ts';
import {
  ReferenceCanvasDoc,
  damageToOps,
  opsToDamage,
  laneForField,
  isCompatibleOpVersion,
  isOpSendableTo,
  supportsCollections,
  DEFAULT_GEOMETRY_FIELDS,
  CANVAS_OP_VERSION,
} from '../packages/core/src/canvas-op-v1.ts';
import type { BoxId, BoxRow, CanvasOp, Damage, OpOrigin } from '../packages/core/src/canvas-op-v1.ts';

// ── OSS run: the reference CRDT is the adapter under test ────────────────────────

test('reference CRDT converges under the shared conformance suite (section 8)', () => {
  runConvergenceSuite(() => new ReferenceCanvasDoc(), 'reference');
});

// ── Pure-helper conformance (shared, but adapter-independent) ────────────────────

test('damageToOps → opsToDamage round-trips the section 4.1/section 4.2 lane split', () => {
  const prev = new Map<BoxId, BoxRow>([
    ['b1', { id: 'b1', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'red' }],
    ['b2', { id: 'b2', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'red' }],
    ['b4', { id: 'b4', x: 0, y: 0, w: 1, h: 1, rot: 0 }],
  ]);
  const next = new Map<BoxId, BoxRow>([
    ['b1', { id: 'b1', x: 50, y: 0, w: 10, h: 10, rot: 0, fill: 'red' }], // moved
    ['b2', { id: 'b2', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'blue' }], // restyled
    ['b3', { id: 'b3', x: 1, y: 1, w: 1, h: 1, rot: 0 }], // added
    // b4 dropped → removed
  ]);
  const ops = damageToOps(prev, next, { client: 'a', clock: 1 });
  const dmg = opsToDamage(ops);
  assert.deepEqual([...dmg.moved].sort(), ['b1']);
  assert.deepEqual([...dmg.restyled].sort(), ['b2']);
  assert.deepEqual([...dmg.added].sort(), ['b3']);
  assert.deepEqual([...dmg.removed].sort(), ['b4']);
  // Generic op→damage cannot tell a frame from `kind`; the shell's Scene fills this.
  assert.deepEqual(dmg.frames, []);
});

test('one gesture is one transaction (single origin) = one undo step (section 5)', () => {
  // A gesture that both moves and restyles the same box emits a batch sharing ONE
  // origin stamp - the atomic unit an undo pops.
  const prev = new Map<BoxId, BoxRow>([['b1', { id: 'b1', x: 0, y: 0, w: 10, h: 10, rot: 0, fill: 'red' }]]);
  const next = new Map<BoxId, BoxRow>([['b1', { id: 'b1', x: 80, y: 0, w: 10, h: 10, rot: 0, fill: 'blue' }]]);
  const origin: OpOrigin = { client: 'c1', clock: 9 };
  const ops = damageToOps(prev, next, origin);
  assert.ok(ops.length >= 2, 'a two-lane gesture emits ≥2 ops');
  for (const op of ops) assert.strictEqual(op.origin, origin, 'all ops in a gesture share one transaction stamp');
  const dmg = opsToDamage(ops);
  assert.deepEqual(dmg.moved, ['b1']);
  assert.deepEqual(dmg.restyled, ['b1']);
});

test('incompatible major → observer-only; same major → compatible (section 9)', () => {
  assert.equal(isCompatibleOpVersion('1.0.0'), true);
  assert.equal(isCompatibleOpVersion('1.9.3', CANVAS_OP_VERSION), true);
  assert.equal(isCompatibleOpVersion('2.0.0', CANVAS_OP_VERSION), false);
  assert.equal(isCompatibleOpVersion('0.9.0', '1.0.0'), false);
});

test('damageToOps restates paint order on an insert, and emits a pure reorder (plans/100 section 3)', () => {
  const origin: OpOrigin = { client: 'a', clock: 1 };
  const row = (id: BoxId): BoxRow => ({ id, x: 0, y: 0, w: 1, h: 1, rot: 0 });
  const prev = new Map<BoxId, BoxRow>([['r01', row('r01')], ['r02', row('r02')]]);

  // An insert at the TOP: the new row's key must not be one an existing row already
  // holds, so every surviving row's key is restated in the same gesture.
  const inserted = new Map<BoxId, BoxRow>([['r03', row('r03')], ...prev]);
  const ops = damageToOps(prev, inserted, origin);
  const add = ops.find(op => op.k === 'add');
  assert.ok(add && add.k === 'add', 'the inserted row emits an add');
  const orders = ops.filter((op): op is Extract<CanvasOp, { k: 'order' }> => op.k === 'order');
  assert.deepEqual(orders.map(op => op.id), ['r01', 'r02'], 'both survivors get a restated key');
  const keys = [add.orderKey, ...orders.map(op => op.orderKey)];
  assert.equal(new Set(keys).size, keys.length, 'no two rows may share an order key');
  assert.deepEqual([...keys].sort(), keys, 'the keys ascend in the gesture order');

  // A PURE reorder - no field changed - must still be expressible.
  const reordered = new Map<BoxId, BoxRow>([['r02', row('r02')], ['r01', row('r01')]]);
  const reorderOps = damageToOps(prev, reordered, origin);
  assert.deepEqual(reorderOps.map(op => op.k), ['order', 'order'], 'a pure reorder emits order ops only');
  assert.deepEqual(reorderOps.map(op => (op.k === 'param' ? '' : op.id)), ['r02', 'r01']);

  // A field-only edit still emits no order op at all (the common case pays nothing),
  // and neither does a pure removal - the survivors' keys still sort correctly.
  const edited = new Map<BoxId, BoxRow>([['r01', { ...row('r01'), fill: 'red' }], ['r02', row('r02')]]);
  assert.deepEqual(damageToOps(prev, edited, origin).map(op => op.k), ['field']);
  const removed = new Map<BoxId, BoxRow>([['r01', row('r01')]]);
  assert.deepEqual(damageToOps(prev, removed, origin).map(op => op.k), ['remove']);
});

test('v1.1: a col-scoped op is not sendable to a v1.0 peer (section 9 + plans/100 section 11.19)', () => {
  const origin: OpOrigin = { client: 'a', clock: 1 };
  const canvasOp: CanvasOp = { k: 'field', id: 'b1', field: 'fill', value: 'red', origin };
  const colOp: CanvasOp = { k: 'field', id: 'r1', col: 'rows', field: 'label', value: 'x', origin };

  assert.equal(supportsCollections('1.0.0'), false);
  assert.equal(supportsCollections(CANVAS_OP_VERSION), true);
  assert.equal(supportsCollections('1.10.0'), true, 'minors compare numerically, not lexically');
  assert.equal(supportsCollections('2.0.0'), true);

  // Same major, so the pair may still collaborate - on canvas ops only. The
  // collection edit is refused at the SENDER, never silently misrouted into the
  // peer's canvas box map.
  assert.equal(isOpSendableTo(canvasOp, '1.0.0'), true);
  assert.equal(isOpSendableTo(colOp, '1.0.0'), false);
  assert.equal(isOpSendableTo(colOp, CANVAS_OP_VERSION), true);
  // A major mismatch takes everything with it (observer-only, section 9).
  assert.equal(isOpSendableTo(canvasOp, '2.0.0'), false);
});

test('laneForField splits geometry vs content, honouring a renamed geom set (section 4.3)', () => {
  for (const f of DEFAULT_GEOMETRY_FIELDS) assert.equal(laneForField(f), 'geometry');
  assert.equal(laneForField('fill'), 'content');
  assert.equal(laneForField('kind'), 'content');
  // A tool that renames geometry fields passes its resolved role set across the seam.
  assert.equal(laneForField('px', ['px', 'py']), 'geometry');
  assert.equal(laneForField('x', ['px', 'py']), 'content');
});

// ── v1.1 - collection scoping + presence fields (plans/100 section 3) ───────────────────

test('v1.1: version bumped, still same-major compatible with a 1.0 peer (section 9)', () => {
  assert.equal(CANVAS_OP_VERSION, '1.1.0');
  assert.equal(isCompatibleOpVersion('1.0.0', CANVAS_OP_VERSION), true);
  assert.equal(isCompatibleOpVersion(CANVAS_OP_VERSION, '1.0.0'), true);
  // Compatible does NOT mean every op may cross: `col` re-lanes an op, so the pair
  // above is canvas-only until both sides are v1.1 — see the sendability test below.
});

test('damageToOps stamps the collection context; the default context stays v1.0-shaped', () => {
  const prev = new Map<BoxId, BoxRow>([['r0', { id: 'r0', x: 0, y: 0, w: 1, h: 1, rot: 0, label: 'old' }]]);
  const next = new Map<BoxId, BoxRow>([['r1', { id: 'r1', x: 0, y: 0, w: 1, h: 1, rot: 0, label: 'hi' }]]);
  const origin: OpOrigin = { client: 'a', clock: 1 };
  const scoped = damageToOps(prev, next, origin, DEFAULT_GEOMETRY_FIELDS, 'rows');
  assert.ok(scoped.length >= 2, 'expected a remove + an add');
  for (const op of scoped) {
    assert.notEqual(op.k, 'param');
    if (op.k !== 'param') assert.equal(op.col, 'rows', `${op.k} op missed the collection stamp`);
  }
  // Default context: no col key AT ALL - the emitted op is byte-identical to v1.0.
  for (const op of damageToOps(prev, next, origin)) {
    assert.ok(!('col' in op), 'a default-canvas op must not carry a col key');
  }
});

test('opsToDamage classifies per collection context (section 4.2 + plans/100 section 3)', () => {
  const origin: OpOrigin = { client: 'a', clock: 1 };
  const ops: CanvasOp[] = [
    { k: 'geom', id: 'c1', fields: { x: 1 }, origin },
    { k: 'field', id: 'r1', col: 'rows', field: 'label', value: 'x', origin },
    { k: 'add', id: 'r2', col: 'rows', row: { id: 'r2' }, orderKey: '001', origin },
    { k: 'remove', id: 'o1', col: 'other', origin },
    { k: 'order', id: 'o2', col: 'other', orderKey: '002', origin },
    { k: 'param', key: 'p', value: 1, origin },
  ];
  const canvas = opsToDamage(ops);
  assert.deepEqual(canvas.moved, ['c1']);
  assert.deepEqual(canvas.restyled, []);
  assert.deepEqual(canvas.added, []);
  assert.deepEqual(canvas.removed, []);
  assert.deepEqual(canvas.zChanged, []);
  const rows = opsToDamage(ops, 'rows');
  assert.deepEqual(rows.moved, []);
  assert.deepEqual(rows.restyled, ['r1']);
  assert.deepEqual(rows.added, ['r2']);
  const other = opsToDamage(ops, 'other');
  assert.deepEqual(other.removed, ['o1']);
  assert.deepEqual(other.zChanged, ['o2']);
});

test('reference doc: a collection-scoped gesture round-trips to a peer (plans/100 section 3)', () => {
  const a = new ReferenceCanvasDoc('a');
  const b = new ReferenceCanvasDoc('b');
  const rows = new Map<BoxId, BoxRow>([['r1', { id: 'r1', label: 'one' }]]);
  const damage: Damage = { moved: [], restyled: [], added: ['r1'], removed: [], zChanged: [], frames: [] };
  const ops = a.onLocalChange(damage, rows, 'list');
  assert.ok(ops.length > 0);
  for (const op of ops) {
    assert.notEqual(op.k, 'param');
    if (op.k !== 'param') assert.equal(op.col, 'list');
  }
  b.applyRemotePatch(ops);
  assert.deepEqual(b.state(), a.state(), 'peer diverged after a collection gesture');
  assert.equal(a.state().collections?.get('list')?.boxes.get('r1')?.label, 'one');
  assert.equal(a.state().boxes.size, 0, 'a collection gesture must not touch the canvas collection');

  // A second gesture against the SAME collection diffs against that collection's
  // converged rows (an unchanged row emits nothing; an edit emits one FieldOp).
  const rows2 = new Map<BoxId, BoxRow>([['r1', { id: 'r1', label: 'two' }]]);
  const editDamage: Damage = { moved: [], restyled: ['r1'], added: [], removed: [], zChanged: [], frames: [] };
  const ops2 = a.onLocalChange(editDamage, rows2, 'list');
  assert.equal(ops2.length, 1);
  assert.equal(ops2[0]?.k, 'field');
  b.applyRemotePatch(ops2);
  assert.deepEqual(b.state(), a.state());
  assert.equal(b.state().collections?.get('list')?.boxes.get('r1')?.label, 'two');
});

test('schema: v1.1 col validates on every box op, never on param; v1.0 ops still valid', () => {
  const origin = { client: 'a', clock: 1 };
  // v1.0 shapes stay valid.
  assert.equal(validateCanvasOp({ k: 'field', id: 'b1', field: 'fill', value: 'red', origin }).valid, true);
  assert.equal(validateCanvasOp({ k: 'remove', id: 'b1', origin }).valid, true);
  // v1.1 col on each box-op branch.
  assert.equal(validateCanvasOp({ k: 'geom', id: 'b1', col: 'rows', fields: { x: 1 }, origin }).valid, true);
  assert.equal(validateCanvasOp({ k: 'field', id: 'b1', col: 'rows', field: 'fill', value: 'red', origin }).valid, true);
  assert.equal(validateCanvasOp({ k: 'add', id: 'b1', col: 'rows', row: { id: 'b1' }, orderKey: '1', origin }).valid, true);
  assert.equal(validateCanvasOp({ k: 'remove', id: 'b1', col: 'rows', origin }).valid, true);
  assert.equal(validateCanvasOp({ k: 'order', id: 'b1', col: 'rows', orderKey: '2', origin }).valid, true);
  // ParamOp stays as is (plans/100 section 3): its branch has no col.
  assert.equal(validateCanvasOp({ k: 'param', key: 'p', value: 1, col: 'rows', origin }).valid, false);
  // col must be a non-empty string.
  assert.equal(validateCanvasOp({ k: 'remove', id: 'b1', col: '', origin }).valid, false);
  assert.equal(validateCanvasOp({ k: 'remove', id: 'b1', col: 7, origin }).valid, false);
});

test('schema: v1.1 presence fields are optional, the branch stays closed, chat caps at 64', () => {
  const schema = JSON.parse(
    readFileSync(fileURLToPath(new URL('../schemas/canvas-op.schema.json', import.meta.url)), 'utf8'),
  );
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(schema);
  const validate = ajv.getSchema('https://lolly.tools/schemas/canvas-op.schema.json#presence');
  assert.ok(validate, 'presence $anchor not resolvable');
  const base = { userId: 'u1', name: 'Ann', color: '#f00', cursor: { x: 0, y: 0 }, selection: [] };
  assert.equal(validate(base), true, 'a v1.0 presence must stay valid');
  assert.equal(
    validate({
      ...base,
      focus: 'list:r1',
      location: 'slide-2',
      following: 'u2',
      viewport: { x: 0.2, y: 0.4, zoom: 1.5 },
      chat: 'over here',
    }),
    true,
    JSON.stringify(validate.errors),
  );
  assert.equal(validate({ ...base, chat: 'x'.repeat(64) }), true);
  assert.equal(validate({ ...base, chat: 'x'.repeat(65) }), false, 'chat over 64 chars must fail');
  assert.equal(validate({ ...base, viewport: { x: 1, y: 2 } }), false, 'viewport requires zoom');
  assert.equal(validate({ ...base, viewport: { x: 1, y: 2, zoom: 1, extra: 0 } }), false, 'viewport is closed');
  assert.equal(validate({ ...base, unknown: 1 }), false, 'the presence branch stays closed');
});
