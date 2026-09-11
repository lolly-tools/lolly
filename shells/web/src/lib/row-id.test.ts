// SPDX-License-Identifier: MPL-2.0
/**
 * Stable row ids (plan 100 section 3) - the ULID itself and the lazy `ensureRowIds` migration.
 *
 * The claims that matter for a collab are uniqueness (two devices minting rows with no
 * chance to coordinate must not collide), sort-by-creation (the time prefix), and the
 * idempotence of the migration: a legacy row must get an id EXACTLY once, or "the id of
 * this row" stops meaning anything the moment a session is reloaded.
 *
 * Run directly:  node --test shells/web/src/lib/row-id.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureRowIds, isUlid, migrateBlockRowIds, ROW_ID_FIELD, rowIdField, stripHiddenRowIds, ulid } from './row-id.ts';
import type { RowIdInput } from './row-id.ts';

const CROCKFORD = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

/** A block row as the model holds one: sub-field values keyed by field id. */
type Row = Record<string, unknown>;

test('a ULID is 26 Crockford-base32 characters', () => {
  const id = ulid();
  assert.equal(id.length, 26);
  assert.match(id, CROCKFORD);
  assert.ok(isUlid(id));
  // The ambiguous letters are the whole point of Crockford's alphabet.
  assert.equal(/[ILOU]/.test(id), false, 'no I, L, O or U');
  assert.equal(isUlid('nope'), false);
  assert.equal(isUlid(id.toLowerCase()), false, 'lowercase is not the canonical form');
  assert.equal(isUlid(null), false);
});

test('ids are unique, including inside one millisecond', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20000; i++) seen.add(ulid());
  assert.equal(seen.size, 20000);
});

test('ids sort in creation order (the time prefix is what buys that)', () => {
  const realNow = Date.now;
  try {
    // Ahead of the real clock: the generator's monotonic state has already seen "now"
    // (the tests above minted ids), and it never follows a clock backwards.
    let t = Date.now() + 1_000_000;
    Date.now = () => t;
    const a = ulid();
    const b = ulid();          // same millisecond → monotonic random bump
    t += 1;
    const c = ulid();
    assert.ok(a < b, 'same-millisecond ids still increase');
    assert.ok(b < c, 'a later millisecond sorts after');
    assert.equal(a.slice(0, 10), b.slice(0, 10), 'same ms → same time prefix');
    assert.notEqual(b.slice(0, 10), c.slice(0, 10));
  } finally {
    Date.now = realNow;
  }
});

test('a clock that steps backwards never repeats an id', () => {
  const realNow = Date.now;
  try {
    let t = Date.now() + 2_000_000;
    Date.now = () => t;
    const a = ulid();
    t -= 5000;                 // NTP correction / a device with a wrong clock
    const b = ulid();
    assert.notEqual(a, b);
    assert.ok(b > a, 'the id stays monotonic rather than following the clock backwards');
  } finally {
    Date.now = realNow;
  }
});

test('ensureRowIds gives an id to rows that lack one, and only to those', () => {
  const rows = [{ label: 'a', [ROW_ID_FIELD]: 'KEPT' }, { label: 'b' }, { label: 'c', [ROW_ID_FIELD]: '' }];
  const next = ensureRowIds(rows);
  assert.notEqual(next, rows, 'a change means a new array (the caller commits on identity)');
  assert.equal(next[0], rows[0], 'an id-bearing row is not even re-wrapped');
  assert.equal(next[0]![ROW_ID_FIELD], 'KEPT', 'an existing id is never rewritten');
  assert.ok(isUlid(next[1]![ROW_ID_FIELD]));
  assert.ok(isUlid(next[2]![ROW_ID_FIELD]), 'an empty-string id counts as missing');
  assert.notEqual(next[1]![ROW_ID_FIELD], next[2]![ROW_ID_FIELD]);
  assert.equal(next[1]!.label, 'b', 'the rest of the row is untouched');
});

test('ensureRowIds is idempotent - a legacy row is id\'d exactly once', () => {
  const rows: Row[] = [{ label: 'a' }, { label: 'b' }];
  const first = ensureRowIds(rows);
  const ids = first.map(r => r[ROW_ID_FIELD]);
  const second = ensureRowIds(first);
  assert.equal(second, first, 'nothing missing → the SAME array, so no commit is made');
  assert.deepEqual(second.map(r => r[ROW_ID_FIELD]), ids, 'and no id moved');
});

test('ensureRowIds targets a named field (a canvas collection keys on its own id)', () => {
  const boxes: Row[] = [{ id: 'b1', x: 0 }, { x: 10 }];
  const next = ensureRowIds(boxes, 'id');
  assert.equal(next[0]!.id, 'b1');
  assert.ok(isUlid(next[1]!.id));
  assert.equal(next[1]![ROW_ID_FIELD], undefined, 'the hidden field is not added as well');
});

test('non-object entries pass through untouched', () => {
  const rows = [null, 'text', { label: 'a' }] as unknown as Array<Record<string, unknown>>;
  const next = ensureRowIds(rows);
  assert.equal(next[0], null);
  assert.equal(next[1], 'text');
  assert.ok(isUlid(next[2]![ROW_ID_FIELD]));
});

test('stripHiddenRowIds takes the hidden id off a link, and only that', () => {
  const rows = [{ label: 'a', [ROW_ID_FIELD]: ulid() }, { label: 'b', [ROW_ID_FIELD]: ulid() }];
  const stripped = stripHiddenRowIds(rows) as Row[];
  assert.deepEqual(stripped, [{ label: 'a' }, { label: 'b' }]);
  assert.notEqual(stripped, rows, 'the caller\'s value is never mutated');
  assert.ok(rows[0]![ROW_ID_FIELD], 'the model keeps its ids');

  // A canvas collection's DECLARED id is content - connector endpoints, frame
  // membership and masks reference it by name - so it must survive.
  const boxes = [{ id: 'b1', x: 0 }];
  assert.equal(stripHiddenRowIds(boxes), boxes, 'nothing to strip → the same array');
  assert.deepEqual(stripHiddenRowIds(boxes), [{ id: 'b1', x: 0 }]);
  assert.equal(stripHiddenRowIds('not-an-array'), 'not-an-array');
});

// ── which field, and the mount-time migration ─────────────────────────────────

test('rowIdField: a canvas collection keys on its declared id, everything else hides one', () => {
  assert.equal(rowIdField({ fields: [{ id: 'label' }] }), ROW_ID_FIELD, 'a plain blocks input');
  assert.equal(rowIdField({ canvas: {}, fields: [{ id: 'id' }, { id: 'x' }] }), 'id',
    'a canvas collection defaults to the `id` sub-field');
  assert.equal(rowIdField({ canvas: { idField: 'bid' }, fields: [{ id: 'bid' }] }), 'bid',
    'and honours a renamed one');
  assert.equal(rowIdField({ canvas: { idField: 'bid' }, fields: [{ id: 'x' }] }), ROW_ID_FIELD,
    'a canvas config naming a field the manifest never declares falls back to the hidden one');
});

/** A runtime double shaped like the engine's: getModel + the atomic applyPatch. */
function patchRuntime(items: RowIdInput[]) {
  let model = items.map(i => ({ ...i }));
  const patches: Record<string, unknown>[] = [];
  return {
    patches,
    getModel: () => model,
    valueOf: (id: string) => model.find(i => i.id === id)!.value,
    async applyPatch(values: Record<string, unknown>) {
      patches.push(values);
      model = model.map(i => (i.id in values ? { ...i, value: values[i.id] } : i));
    },
  };
}

test('migrateBlockRowIds ids every blocks input once, in ONE patch, and never twice', async () => {
  const rt = patchRuntime([
    { id: 'title', type: 'text', value: 'hi' },
    { id: 'deck', type: 'blocks', value: [{ label: 'a' }, { label: 'b' }], fields: [{ id: 'label' }] },
    { id: 'boxes', type: 'blocks', value: [{ id: 'kept', x: 1 }, { x: 2 }], canvas: { idField: 'id' }, fields: [{ id: 'id' }, { id: 'x' }] },
    { id: 'empty', type: 'blocks', value: [], fields: [{ id: 'label' }] },
  ]);

  await migrateBlockRowIds(rt);

  assert.equal(rt.patches.length, 1, 'one atomic patch, not one write per input');
  assert.deepEqual(Object.keys(rt.patches[0]!).sort(), ['boxes', 'deck'],
    'only the inputs that were actually missing ids');
  const deck = rt.valueOf('deck') as Array<Record<string, unknown>>;
  assert.ok(deck.every(r => isUlid(r[ROW_ID_FIELD])), 'a plain blocks input gets the hidden field');
  assert.equal(deck[0]!.label, 'a', 'the row is otherwise untouched');
  const boxes = rt.valueOf('boxes') as Array<Record<string, unknown>>;
  assert.equal(boxes[0]!.id, 'kept', 'an existing canvas id is never rewritten');
  assert.ok(isUlid(boxes[1]!.id), 'and a missing one is filled on the DECLARED field');
  assert.equal(boxes[1]![ROW_ID_FIELD], undefined);

  await migrateBlockRowIds(rt);
  assert.equal(rt.patches.length, 1, 'a second mount finds nothing to do - no write at all');
});

test('migrateBlockRowIds writes nothing when there is nothing to migrate', async () => {
  const rt = patchRuntime([
    { id: 'title', type: 'text', value: 'hi' },
    { id: 'deck', type: 'blocks', value: [{ label: 'a', [ROW_ID_FIELD]: ulid() }], fields: [{ id: 'label' }] },
  ]);
  await migrateBlockRowIds(rt);
  assert.deepEqual(rt.patches, [], 'no patch means no render, no dirty flag, nothing on the wire');
});
