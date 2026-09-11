// SPDX-License-Identifier: MPL-2.0
/**
 * op-guard tests - plan 100 section 6.3 / section 11.21, wave 2.4.
 * Run directly:  node --test shells/web/src/collab/op-guard.test.ts
 *
 * What is actually being proved here, in rising order of what it would cost to lose:
 *
 *  1. THE SCHEMA IS NOT ENOUGH, and the test says so with the schema itself. Every
 *     hostile payload in "ajv-blind" is asserted to be VALID against the canonical
 *     `validateCanvasOp` before the guard is asked about it. If a future schema
 *     tightens one of them, that assertion fails and this file - not a production
 *     incident - is where the news arrives. These are not hypotheticals: NaN and
 *     Infinity geometry, an Infinity Lamport clock that would win every LWW merge
 *     forever, and an own `__proto__` key inside an `add` row all pass ajv today.
 *  2. THE WHITELIST IS A NARROWING, NEVER A PERMISSION. A manifest that declares an
 *     input literally called `__proto__` still cannot make one addressable.
 *  3. THE CAPS TRIP EXACTLY WHERE THEY SAY. Every size/length/depth/rate boundary is
 *     asserted at N (accepted) and N+1 (refused), not "somewhere around N" - a cap
 *     nobody has measured is a cap nobody can tune.
 *  4. VALID TRAFFIC IS UNTOUCHED. v1.0 and v1.1 batches come out as the SAME OBJECTS
 *     that went in (identity, not deep-equality): the guard is a gate, not a codec,
 *     and an op the adapter applies must be byte-identical to what the peer sent.
 *  5. DRIFT GUARDS. The param lane's input-type list is compared against the one in
 *     lib/collab-plumbing.ts (module-private there, so it is derived from BEHAVIOUR
 *     rather than imported), and the presence key set against the canvas-op schema's
 *     own `presence` $def. Two copies of a list is how they silently diverge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCanvasOp } from '@lolly-tools/core';
import canvasOpSchema from '@lolly-tools/core/schema/canvas-op.schema.json' with { type: 'json' };
import { ROW_ID_FIELD } from '../lib/row-id.ts';
import {
  ABUSE_REASONS, DEFAULT_OP_GUARD_CAPS, PRESENCE_KEYS, createOpGuard,
} from './op-guard.ts';
import type { OpCheckResult, OpGuardInput, OpRejectReason } from './op-guard.ts';

const HERE = dirname(fileURLToPath(import.meta.url));       // shells/web/src/collab/
const SRC = dirname(HERE);                                  // shells/web/src/

// ── Fixture: one tool's declared inputs (the whole whitelist) ──────────────────
//
// Shaped like a real model: scalar inputs on the param lane, two object-valued ones
// that are declared but must never take a param write, a CANVAS blocks collection
// (its rows are addressed by the tool's own declared `id` sub-field) and a GENERIC
// blocks collection (rows addressed by the hidden `__rid`).

const INPUTS: OpGuardInput[] = [
  { id: 'title', type: 'text' },
  { id: 'body', type: 'longtext' },
  { id: 'count', type: 'number' },
  { id: 'logo', type: 'asset' },
  { id: 'upload', type: 'file' },
  {
    id: 'boxes',
    type: 'blocks',
    canvas: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' },
    fields: [
      { id: 'id' }, { id: 'kind' }, { id: 'x' }, { id: 'y' }, { id: 'w' }, { id: 'h' },
      { id: 'rot' }, { id: 'text', type: 'longtext' }, { id: 'bg', type: 'color' },
    ],
  },
  { id: 'items', type: 'blocks', fields: [{ id: 'label' }, { id: 'note', type: 'longtext' }] },
];

const origin = (clock = 1, client = 'peer-a') => ({ client, clock });

function guard(inputs: OpGuardInput[] = INPUTS, caps?: Partial<typeof DEFAULT_OP_GUARD_CAPS>) {
  return createOpGuard({ inputs, caps });
}

const reasons = (r: OpCheckResult): OpRejectReason[] => r.rejected.map(x => x.reason);

/** Check one op and return its single rejection reason (or null when accepted). */
function reasonFor(op: unknown, g = guard()): OpRejectReason | null {
  const r = g.checkOps([op]);
  if (r.ok.length === 1) return null;
  assert.equal(r.rejected.length, 1, `expected exactly one rejection, got ${JSON.stringify(r.rejected)}`);
  return r.rejected[0]!.reason;
}

// ── 1. Valid traffic passes through untouched ─────────────────────────────────

test('a valid v1.0 batch passes through as the same objects', () => {
  const batch = [
    { k: 'geom', id: 'B1', fields: { x: 10, y: 20 }, origin: origin(1) },
    { k: 'field', id: 'B1', field: 'text', value: 'hello', origin: origin(2) },
    { k: 'add', id: 'B2', row: { kind: 'text', text: 'hi', bg: '#fff' }, orderKey: 'i', origin: origin(3) },
    { k: 'order', id: 'B2', orderKey: 'j', origin: origin(4) },
    { k: 'remove', id: 'B1', origin: origin(5) },
    { k: 'param', key: 'title', value: 'Deck', origin: origin(6) },
    { k: 'param', key: 'count', value: 3, origin: origin(7) },
    { k: 'param', key: 'title', value: null, origin: origin(8) },
  ];
  const r = guard().checkOps(batch);
  assert.deepEqual(reasons(r), []);
  assert.equal(r.ok.length, batch.length);
  // Identity, not deep-equality: the guard is a gate, never a codec.
  for (let i = 0; i < batch.length; i++) assert.equal(r.ok[i], batch[i]);
});

test('a valid v1.1 collection-scoped batch passes, on both collection shapes', () => {
  const batch = [
    { k: 'add', id: 'R1', col: 'items', row: { label: 'one', [ROW_ID_FIELD]: 'R1' }, orderKey: 'i', origin: origin(1) },
    { k: 'field', id: 'R1', col: 'items', field: 'note', value: 'long', origin: origin(2) },
    // The row-id field is addressable on a generic collection…
    { k: 'field', id: 'R1', col: 'items', field: ROW_ID_FIELD, value: 'R1', origin: origin(3) },
    // …and on a canvas collection it is the tool's OWN declared id sub-field.
    { k: 'field', id: 'B1', col: 'boxes', field: 'id', value: 'B1', origin: origin(4) },
    { k: 'geom', id: 'B1', col: 'boxes', fields: { x: 1, y: 2, w: 3, h: 4, rot: 5 }, origin: origin(5) },
    { k: 'remove', id: 'R1', col: 'items', origin: origin(6) },
  ];
  const r = guard().checkOps(batch);
  assert.deepEqual(reasons(r), []);
  assert.equal(r.ok.length, batch.length);
  for (let i = 0; i < batch.length; i++) assert.equal(r.ok[i], batch[i]);
});

test('a param binding descriptor is data-plane, not a value, and still passes', () => {
  // section 6: a binding syncs as a descriptor and the live datum never travels. The guard
  // lets it through (schema-legal, whitelisted key); what to DO with it is the
  // projection's decision, not the boundary's.
  assert.equal(reasonFor({
    k: 'param', key: 'title', value: { bind: { provider: 'sheet', query: 'A1' } }, origin: origin(),
  }), null);
});

test('a partially bad batch drops only the bad ops (never the batch, never a throw)', () => {
  const good = { k: 'param', key: 'title', value: 'ok', origin: origin(1) };
  const r = guard().checkOps([
    good,
    { k: 'param', key: 'nope', value: 'x', origin: origin(2) },
    { k: 'field', id: 'B1', col: 'boxes', field: 'undeclared', value: 1, origin: origin(3) },
  ]);
  assert.equal(r.ok.length, 1);
  assert.equal(r.ok[0], good);
  assert.deepEqual(reasons(r), ['unknown-input', 'unknown-field']);
  // section 11.11's survivable skew - none of it means "disconnect".
  for (const rej of r.rejected) assert.equal(ABUSE_REASONS.has(rej.reason), false);
});

// ── 2. Schema rejects ─────────────────────────────────────────────────────────

test('the canonical schema refuses malformed ops', () => {
  const g = guard();
  assert.equal(reasonFor({ k: 'nope', origin: origin() }, g), 'schema');
  assert.equal(reasonFor({ k: 'field', id: 'B1', field: 'text', value: 'x' }, g), 'schema');
  assert.equal(reasonFor({ k: 'add', id: 'B1', row: {}, origin: origin() }, g), 'schema');
  // `param` is collection-blind by contract - a `col` on one is not a v1.1 op.
  assert.equal(reasonFor({ k: 'param', key: 'title', col: 'boxes', value: 1, origin: origin() }, g), 'schema');
  // Geometry field names are closed at x/y/w/h/rot.
  assert.equal(reasonFor({ k: 'geom', id: 'B1', fields: { left: 1 }, origin: origin() }, g), 'schema');
  // A box field value must be a scalar.
  assert.equal(reasonFor({ k: 'field', id: 'B1', field: 'text', value: { a: 1 }, origin: origin() }, g), 'schema');
  // An empty origin client, and a negative clock.
  assert.equal(reasonFor({ k: 'remove', id: 'B1', origin: { client: '', clock: 1 } }, g), 'schema');
  assert.equal(reasonFor({ k: 'remove', id: 'B1', origin: { client: 'a', clock: -1 } }, g), 'schema');
});

test('a message that is not an array of ops is malformed, and nothing is accepted', () => {
  const g = guard();
  for (const raw of [null, undefined, 0, 'ops', { k: 'param' }]) {
    const r = g.checkOps(raw);
    assert.equal(r.ok.length, 0);
    assert.deepEqual(reasons(r), ['malformed']);
  }
});

// ── 3. What the schema does NOT catch ─────────────────────────────────────────

test('ajv-blind payloads: valid against the canonical schema, refused by the guard', () => {
  const g = guard();
  const cases: [string, unknown, OpRejectReason][] = [
    ['NaN geometry', { k: 'geom', id: 'B1', fields: { x: Number.NaN }, origin: origin() }, 'not-finite'],
    ['Infinity geometry', { k: 'geom', id: 'B1', fields: { x: Number.POSITIVE_INFINITY }, origin: origin() }, 'not-finite'],
    // `type: "integer"` is `!(data % 1)`, and `Infinity % 1` is NaN - so an origin
    // that beats every future write forever is schema-clean.
    ['Infinity clock', { k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock: Number.POSITIVE_INFINITY } }, 'not-finite'],
    ['NaN param value', { k: 'param', key: 'count', value: Number.NaN, origin: origin() }, 'not-finite'],
    // `row`'s additionalProperties is the scalar $ref, so ANY key is legal there - 
    // and JSON.parse makes `__proto__` an OWN property, which the rebuild would
    // assign straight onto an object literal.
    ['own __proto__ in an add row', JSON.parse('{"k":"add","id":"B1","row":{"__proto__":null},"orderKey":"i","origin":{"client":"a","clock":1}}'), 'forbidden-key'],
    ['__proto__ as a field name', { k: 'field', id: 'B1', field: '__proto__', value: 1, origin: origin() }, 'forbidden-key'],
    ['constructor as a field name', { k: 'field', id: 'B1', field: 'constructor', value: 1, origin: origin() }, 'forbidden-key'],
    ['prototype as a param key', { k: 'param', key: 'prototype', value: 1, origin: origin() }, 'forbidden-key'],
    ['__proto__ as a collection', { k: 'remove', id: 'B1', col: '__proto__', origin: origin() }, 'forbidden-key'],
  ];
  for (const [name, op, expected] of cases) {
    // The point of the whole module, stated as an assertion: the schema says yes.
    assert.equal(validateCanvasOp(op).valid, true, `${name} should still be schema-valid`);
    assert.equal(reasonFor(op, g), expected, name);
  }
});

test('a finite but astronomical clock is refused, not just an infinite one', () => {
  // `not-finite` covers Infinity. It does NOT cover 1e308, which is finite, is an
  // integer to ajv (`1e308 % 1 === 0`), and has the identical effect the module
  // header describes: an origin that wins every future LWW merge for the life of
  // the document. Worse - collab-plumbing's `observeClock` adopts the inbound
  // clock and `nextClock()` is `++clock`, and `++1e308 === 1e308`, so every LOCAL
  // op afterwards carries the same value, every write ties, and the tiebreak falls
  // to client id: a peer whose id sorts higher can permanently stop the local user
  // overwriting anything, with no recovery short of a reload.
  const g = guard();
  for (const clock of [1e308, Number.MAX_VALUE, 2 ** 53, Number.MAX_SAFE_INTEGER + 2]) {
    const op = { k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock } };
    assert.equal(reasonFor(op, g), 'clock-out-of-range', `clock=${clock}`);
  }
  // A fractional clock is the one case ajv's `!(data % 1)` DOES catch.
  assert.equal(reasonFor({ k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock: 1.5 } }, g), 'schema');
  // The band that still counts is the safe-integer one - `++` stops incrementing
  // above it, so that IS the range in which a Lamport counter is a counter.
  assert.equal(reasonFor({ k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock: Number.MAX_SAFE_INTEGER } }, g), null);
  assert.equal(reasonFor({ k: 'param', key: 'title', value: 'x', origin: { client: 'a', clock: 0 } }, g), null);
  // …and the schema, on its own, says yes to all of it.
  assert.equal(validateCanvasOp({ k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock: 1e308 } }).valid, true);
});

test('every peer-derived rejection detail is bounded, because the contract says it is loggable', () => {
  // `OpRejection.detail` is documented as capped and safe to log. Three sites put
  // the peer's raw string in it, and nothing upstream bounds a NAME: the per-value
  // cap runs on values, and the ops walk carries no string ceiling at all - so one
  // message could retain (and hand the logger) opsPerMessage × megabytes.
  const g = guard();
  const huge = 'x'.repeat(200_000);
  const cases: [string, unknown][] = [
    ['unknown-input', { k: 'param', key: huge, value: 1, origin: origin() }],
    ['unknown-field', { k: 'field', id: 'B1', col: 'items', field: huge, value: 1, origin: origin() }],
    ['unknown-collection', { k: 'remove', id: 'B1', col: huge, origin: origin() }],
    ['wrong-lane', { k: 'param', key: `${huge}`, value: 1, origin: origin() }],
  ];
  for (const [label, op] of cases) {
    const r = g.checkOps([op]);
    assert.equal(r.rejected.length, 1, label);
    const detail = r.rejected[0]?.detail ?? '';
    assert.ok(detail.length < 400, `${label} detail is ${detail.length} chars`);
  }
  // A short name is still reported verbatim - the cap must not cost diagnosability.
  const short = g.checkOps([{ k: 'param', key: 'not-declared', value: 1, origin: origin() }]);
  assert.equal(short.rejected[0]?.detail, 'not-declared');
});

test('an abuse breach clears the whole message, not just the op that tripped it', () => {
  // section 11.21 says a peer that breaches a cap is DISCONNECTED. Handing the caller ops
  // to apply from the very message it is disconnecting over lets the two decisions
  // disagree; `batch-too-large` already behaved this way and the rest did not.
  const g = guard();
  const good = { k: 'param', key: 'title', value: 'ok', origin: origin(1) };
  for (const abusive of [
    JSON.parse('{"k":"param","key":"title","value":{"__proto__":{"x":1}},"origin":{"client":"a","clock":2}}'),
    { k: 'geom', id: 'B1', fields: { x: 1 }, origin: { client: 'a', clock: 1e308 } },
  ]) {
    const r = g.checkOps([good, abusive, { ...good, origin: origin(3) }]);
    assert.equal(r.ok.length, 0, 'nothing from an abusive message is applied');
    assert.ok(r.rejected.some((x) => ABUSE_REASONS.has(x.reason)), 'and the caller is told to disconnect');
  }
  // An ordinary skew rejection still drops only its own op (section 11.11 - unchanged).
  const skew = g.checkOps([good, { k: 'param', key: 'nope', value: 'x', origin: origin(2) }]);
  assert.equal(skew.ok.length, 1);
});

test('a manifest cannot buy an input the right to be a prototype key', () => {
  // Even declared - by a hostile catalog entry, or a genuine mistake - these names
  // are never addressable. The whitelist narrows; it never permits.
  const g = guard([
    { id: '__proto__', type: 'text' },
    { id: 'constructor', type: 'blocks', fields: [{ id: 'prototype' }] },
  ]);
  assert.equal(reasonFor({ k: 'param', key: '__proto__', value: 'x', origin: origin() }, g), 'forbidden-key');
  assert.equal(reasonFor({ k: 'remove', id: 'B1', col: 'constructor', origin: origin() }, g), 'forbidden-key');
});

test('a forbidden key is refused wherever it is nested', () => {
  const op = JSON.parse(
    '{"k":"param","key":"title","value":{"bind":{"provider":"p","__proto__":{"x":1}}},"origin":{"client":"a","clock":1}}',
  );
  assert.equal(reasonFor(op), 'forbidden-key');
});

// ── 4. The manifest whitelist ─────────────────────────────────────────────────

test('a param op must name a declared input on the scalar lane', () => {
  const g = guard();
  assert.equal(reasonFor({ k: 'param', key: 'nope', value: 'x', origin: origin() }, g), 'unknown-input');
  // Declared, but object-valued: a bare string on an `asset` gives `{{asset logo}}`
  // a ref it cannot resolve (the reasoning lives in collab-plumbing's header).
  assert.equal(reasonFor({ k: 'param', key: 'logo', value: 'x', origin: origin() }, g), 'wrong-lane');
  assert.equal(reasonFor({ k: 'param', key: 'upload', value: 'x', origin: origin() }, g), 'wrong-lane');
  assert.equal(reasonFor({ k: 'param', key: 'boxes', value: 'x', origin: origin() }, g), 'wrong-lane');
  assert.equal(reasonFor({ k: 'param', key: 'body', value: 'x', origin: origin() }, g), null);
});

test('a col outside the declared blocks inputs is refused', () => {
  const g = guard();
  assert.equal(reasonFor({ k: 'remove', id: 'B1', col: 'missing', origin: origin() }, g), 'unknown-collection');
  // Declared, but not a blocks input.
  assert.equal(reasonFor({ k: 'remove', id: 'B1', col: 'title', origin: origin() }, g), 'unknown-collection');
});

test('a col-less box op means the canvas collection, and needs one to exist', () => {
  // With a canvas collection declared, the v1.0 shape resolves to it.
  assert.equal(reasonFor({ k: 'field', id: 'B1', field: 'kind', value: 'text', origin: origin() }), null);
  // Without one, a col-less box op has no legitimate meaning at all.
  const noCanvas = guard([{ id: 'items', type: 'blocks', fields: [{ id: 'label' }] }]);
  assert.equal(reasonFor({ k: 'field', id: 'B1', field: 'label', value: 'x', origin: origin() }, noCanvas), 'unknown-collection');
});

test('field and row keys must be declared sub-fields of that collection', () => {
  const g = guard();
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'nope', value: 1, origin: origin() }, g), 'unknown-field');
  assert.equal(reasonFor({ k: 'add', id: 'R1', col: 'items', row: { label: 'a', sneaky: 1 }, orderKey: 'i', origin: origin() }, g), 'unknown-field');
  // The hidden row id is addressable on a generic collection, and NOT on a canvas
  // one (whose rows are named by the tool's own declared id sub-field instead).
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: ROW_ID_FIELD, value: 'R1', origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'field', id: 'B1', col: 'boxes', field: ROW_ID_FIELD, value: 'B1', origin: origin() }, g), 'unknown-field');
});

test('geometry is refused on a collection that has no geometry', () => {
  // Schema-legal (x/y/w/h/rot are the only names it allows) but meaningless on a
  // generic blocks input, which declares none of them.
  const op = { k: 'geom', id: 'R1', col: 'items', fields: { x: 1 }, origin: origin() };
  assert.equal(validateCanvasOp(op).valid, true);
  assert.equal(reasonFor(op), 'unknown-field');
});

// ── 5. Size, length, depth and batch caps ─────────────────────────────────────

const ascii = (n: number) => 'a'.repeat(n);

test('per-value size caps trip exactly at the boundary', () => {
  const g = guard();
  const cap = DEFAULT_OP_GUARD_CAPS.stringBytes;
  assert.equal(reasonFor({ k: 'param', key: 'title', value: ascii(cap), origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'param', key: 'title', value: ascii(cap + 1), origin: origin() }, g), 'value-too-large');
  // A blocks sub-field is capped by ITS declared type, not the input's.
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'label', value: ascii(cap), origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'label', value: ascii(cap + 1), origin: origin() }, g), 'value-too-large');
  // A whole `add` row is checked key by key.
  assert.equal(reasonFor({ k: 'add', id: 'R1', col: 'items', row: { label: ascii(cap + 1) }, orderKey: 'i', origin: origin() }, g), 'value-too-large');
});

test('longtext earns the larger cap, as an input and as a sub-field', () => {
  const g = guard();
  const long = DEFAULT_OP_GUARD_CAPS.longtextBytes;
  const short = DEFAULT_OP_GUARD_CAPS.stringBytes;
  assert.equal(reasonFor({ k: 'param', key: 'body', value: ascii(long), origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'param', key: 'body', value: ascii(long + 1), origin: origin() }, g), 'value-too-large');
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'note', value: ascii(long), origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'note', value: ascii(long + 1), origin: origin() }, g), 'value-too-large');
  // …and a non-longtext sibling does NOT inherit it.
  assert.equal(reasonFor({ k: 'field', id: 'R1', col: 'items', field: 'label', value: ascii(short + 1), origin: origin() }, g), 'value-too-large');
});

test('the size cap is measured in UTF-8 bytes, not code units', () => {
  const g = guard();
  const cap = DEFAULT_OP_GUARD_CAPS.stringBytes;   // 65536
  // '€' is one UTF-16 unit and three UTF-8 bytes: 21845 of them is 65535 bytes
  // (accepted) and 21846 is 65538 (refused) - a code-unit count would take both.
  const under = '€'.repeat(21845);
  const over = '€'.repeat(21846);
  assert.equal(under.length * 3, cap - 1);
  assert.equal(reasonFor({ k: 'param', key: 'title', value: under, origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'param', key: 'title', value: over, origin: origin() }, g), 'value-too-large');
});

test('identifier length caps trip exactly at the boundary', () => {
  const g = guard();
  const cap = DEFAULT_OP_GUARD_CAPS.idChars;
  assert.equal(reasonFor({ k: 'remove', id: ascii(cap), origin: origin() }, g), null);
  assert.equal(reasonFor({ k: 'remove', id: ascii(cap + 1), origin: origin() }, g), 'id-too-long');
  assert.equal(reasonFor({ k: 'remove', id: 'B1', origin: origin(1, ascii(cap + 1)) }, g), 'id-too-long');
  assert.equal(reasonFor({ k: 'order', id: 'B1', orderKey: ascii(cap + 1), origin: origin() }, g), 'id-too-long');
});

test('JSON depth trips exactly at the boundary', () => {
  const g = guard();
  const nest = (depth: number): unknown => {
    let v: unknown = 1;
    for (let i = 0; i < depth; i++) v = [v];
    return v;
  };
  // At the cap the walk lets it through - and it then dies on the schema, which is
  // how the test knows the depth check was not what refused it.
  assert.equal(reasonFor(nest(DEFAULT_OP_GUARD_CAPS.maxDepth), g), 'schema');
  assert.equal(reasonFor(nest(DEFAULT_OP_GUARD_CAPS.maxDepth + 1), g), 'too-deep');
});

test('array length trips exactly at the boundary', () => {
  const g = guard(INPUTS, { maxArrayLength: 4 });
  // At the cap the walk lets it through, and the schema is what refuses it.
  assert.equal(reasonFor({ a: [1, 2, 3, 4] }, g), 'schema');
  assert.equal(reasonFor({ a: [1, 2, 3, 4, 5] }, g), 'array-too-long');
});

test('the visit budget counts primitives, not just containers', () => {
  // The budget bounds the WORK, which is why it is charged per value: a container
  // count alone would let arrays-of-scalars cost maxNodes × maxArrayLength
  // iterations while never exceeding a count of containers.
  const g = guard(INPUTS, { maxNodes: 3 });
  assert.equal(reasonFor({ a: { b: {} } }, g), 'schema');           // 3 values exactly
  assert.equal(reasonFor({ a: { b: { c: {} } } }, g), 'too-many-nodes');
  // Two containers and three scalars is five values - wide, shallow, and refused.
  assert.equal(reasonFor({ a: [1, 2, 3] }, g), 'too-many-nodes');
});

test('an oversized array costs a length read, not a traversal', () => {
  // The length is checked when the array is popped, before its children are pushed,
  // so the refusal does not first pay for the thing being refused.
  const g = guard(INPUTS, { maxArrayLength: 8, maxNodes: 16 });
  assert.equal(reasonFor({ a: Array.from({ length: 100000 }, (_, i) => i) }, g), 'array-too-long');
});

test('ops per message trips exactly at the boundary, and takes the whole batch', () => {
  const g = guard();
  const op = (i: number) => ({ k: 'param', key: 'title', value: `v${i}`, origin: origin(i + 1) });
  const max = DEFAULT_OP_GUARD_CAPS.opsPerMessage;
  const okBatch = g.checkOps(Array.from({ length: max }, (_, i) => op(i)));
  assert.equal(okBatch.ok.length, max);
  assert.deepEqual(reasons(okBatch), []);
  const over = g.checkOps(Array.from({ length: max + 1 }, (_, i) => op(i)));
  assert.equal(over.ok.length, 0, 'a cap breach is not partially honoured');
  assert.deepEqual(reasons(over), ['batch-too-large']);
  assert.equal(ABUSE_REASONS.has('batch-too-large'), true);
});

test('the abuse set is exactly the structural breaches, not the value ones', () => {
  // section 11.11 says an out-of-range VALUE drops that key and the session continues; only
  // a structural breach means the peer is not playing the protocol.
  // `clock-out-of-range` sits here rather than with the value refusals: a Lamport
  // clock is minted by `++` from zero, so nothing running this protocol in good
  // faith can produce one outside the safe-integer band - same test as the other
  // six ("could an honest build emit this?"), same answer.
  assert.deepEqual([...ABUSE_REASONS].sort(), [
    'array-too-long', 'batch-too-large', 'clock-out-of-range', 'forbidden-key', 'rate-limited',
    'too-deep', 'too-many-nodes',
  ]);
  for (const benign of ['schema', 'unknown-input', 'unknown-field', 'unknown-collection',
    'wrong-lane', 'value-too-large', 'not-finite', 'id-too-long', 'unsafe-string'] as OpRejectReason[]) {
    assert.equal(ABUSE_REASONS.has(benign), false, benign);
  }
});

// ── 6. Rate caps (injected clock, no wall clock anywhere) ─────────────────────

test('the ops rate cap trips exactly at the boundary and resets with the window', () => {
  const g = guard();
  const max = DEFAULT_OP_GUARD_CAPS.opsPerSecond;
  assert.equal(g.recordAndCheckRate('ops', max - 1, 0), true);
  assert.equal(g.recordAndCheckRate('ops', 1, 10), true, 'the Nth op is still within the cap');
  assert.equal(g.recordAndCheckRate('ops', 1, 20), false, 'the N+1th is not');
  assert.equal(g.recordAndCheckRate('ops', 1, 999), false, 'and stays refused for the rest of the window');
  assert.equal(g.recordAndCheckRate('ops', 1, 1000), true, 'the window is exactly one second');
});

test('presence has its own, separate, 40/s lane', () => {
  const g = guard();
  const max = DEFAULT_OP_GUARD_CAPS.presencePerSecond;
  assert.equal(max, 40);
  for (let i = 0; i < max; i++) {
    assert.equal(g.recordAndCheckRate('presence', 1, i), true, `frame ${i + 1}`);
  }
  assert.equal(g.recordAndCheckRate('presence', 1, max), false);
  // Exhausting presence must not touch the ops lane (separate channels, section 11.6).
  assert.equal(g.recordAndCheckRate('ops', 1, max), true);
});

test('a single oversized burst trips the cap on its own', () => {
  const g = guard();
  assert.equal(g.recordAndCheckRate('ops', DEFAULT_OP_GUARD_CAPS.opsPerSecond + 1, 0), false);
});

test('a clock that steps backwards opens a fresh window rather than locking the peer out', () => {
  const g = guard();
  assert.equal(g.recordAndCheckRate('ops', DEFAULT_OP_GUARD_CAPS.opsPerSecond, 5000), true);
  assert.equal(g.recordAndCheckRate('ops', 1, 5001), false);
  assert.equal(g.recordAndCheckRate('ops', 1, 100), true);
});

test('an unusable timestamp cannot permanently condemn a peer', () => {
  // `nowMs` is injected, so a caller bug can hand this a NaN. Recorded, it would
  // open a window that can never close - `NaN - start >= RATE_WINDOW_MS` is false
  // and `nowMs < start` is false for every later value - so the counter would
  // accumulate forever and the lane would return false permanently. That is the
  // "disconnect this peer" answer, given for good, for a LOCAL fault: exactly the
  // permanent false accusation the backwards-clock branch exists to prevent.
  const g = guard();
  const max = DEFAULT_OP_GUARD_CAPS.opsPerSecond;
  assert.equal(g.recordAndCheckRate('ops', 1, Number.NaN), true);
  assert.equal(g.recordAndCheckRate('ops', max + 1, Number.NaN), false, 'the batch is still bounded on its own');
  // The window itself was never poisoned: ordinary traffic behaves normally after.
  assert.equal(g.recordAndCheckRate('ops', max, 1e9), true);
  assert.equal(g.recordAndCheckRate('ops', 1, 1e9 + 1), false);
  assert.equal(g.recordAndCheckRate('ops', 1, 1e9 + 1000), true, 'and the window still closes on time');
});

test('the module reads no wall clock', () => {
  // section 11.7: nothing in the convergence path may depend on wall time, and the rate
  // window is deterministic only because `nowMs` is injected.
  // Comments stripped first - the module's own header NAMES what it must not call,
  // and a scan that cannot tell prose from code would fail on the documentation.
  const src = readFileSync(join(HERE, 'op-guard.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const banned of ['Date.now', 'performance.now', 'new Date']) {
    assert.equal(src.includes(banned), false, `op-guard.ts must not reference ${banned}`);
  }
});

// ── 7. Presence ───────────────────────────────────────────────────────────────

const presence = (over: Record<string, unknown> = {}) => ({
  userId: 'U1',
  name: 'Priya',
  color: 'oklch(0.72 0.14 250)',
  cursor: { x: 0.25, y: 0.5 },
  selection: ['B1', 'B2'],
  ...over,
});

test('a valid presence frame passes through as the same object', () => {
  const g = guard();
  const frame = presence({
    drag: { ids: ['B1'], dxy: [0.01, -0.02] },
    focus: 'boxes:R1',
    location: 'slide-3',
    following: 'U2',
    viewport: { x: -10, y: 40, zoom: 1.5 },
    chat: 'be right back',
  });
  const r = g.checkPresence(frame);
  assert.deepEqual(r.rejected, []);
  assert.equal(r.ok, frame);
});

test('presence refuses a frame missing anything the schema requires', () => {
  const g = guard();
  const missing = (key: string) => {
    const f = presence() as Record<string, unknown>;
    delete f[key];
    return g.checkPresence(f);
  };
  for (const key of ['userId', 'name', 'color', 'cursor', 'selection']) {
    const r = missing(key);
    assert.equal(r.ok, null, key);
    assert.deepEqual(r.rejected.map(x => x.reason), ['schema'], key);
  }
  for (const raw of [null, undefined, 'presence', 42, ['U1']]) {
    assert.deepEqual(g.checkPresence(raw).rejected.map(x => x.reason), ['malformed']);
  }
});

test('the cursor is normalized unit space, and finite', () => {
  const g = guard();
  const reason = (cursor: unknown) => g.checkPresence(presence({ cursor })).rejected[0]?.reason;
  assert.equal(reason({ x: 0, y: 1 }), undefined);
  assert.equal(reason({ x: -0.001, y: 0.5 }), 'schema');
  assert.equal(reason({ x: 1.001, y: 0.5 }), 'schema');
  assert.equal(reason({ x: Number.NaN, y: 0.5 }), 'not-finite');
  assert.equal(reason({ x: '0.5', y: 0.5 }), 'schema');
  assert.equal(reason(null), 'schema');
});

test('presence colour cannot escape the CSS value it is painted into', () => {
  const g = guard();
  const reason = (color: string) => g.checkPresence(presence({ color })).rejected[0]?.reason;
  // The colour engine's own output must keep working - parens and spaces are fine.
  assert.equal(reason('oklch(0.72 0.14 250)'), undefined);
  assert.equal(reason('#a1b2c3'), undefined);
  assert.equal(reason('red;background:url(x)'), 'unsafe-string');
  assert.equal(reason('red}body{display:none'), 'unsafe-string');
  assert.equal(reason('red" onload="x'), 'unsafe-string');
  assert.equal(reason(`red${String.fromCharCode(10)}`), 'unsafe-string');

  // Two that the character ban alone let through, and neither is cosmetic. A bare
  // `url()` is a NETWORK FETCH from the viewer's browser to an address a paired
  // peer chose - the deployed CSP would refuse it, but this module claims to BE
  // the defence in depth, and a Tauri shell or self-hosted instance may not carry
  // that header. An unterminated `/*` swallows the rest of the declaration it is
  // interpolated into.
  assert.equal(reason('url(https://evil.example/x.png)'), 'unsafe-string');
  assert.equal(reason('image-set("https://evil.example/x.png")'), 'unsafe-string');
  assert.equal(reason('red/*'), 'unsafe-string');
  assert.equal(reason('red*/'), 'unsafe-string');
  assert.equal(reason('var(--anything)'), 'unsafe-string');
  assert.equal(reason('(0.5 0.2 30)'), 'unsafe-string', 'a paren with no function name in front of it');

  // …while every colour form the engine can actually emit still paints, including
  // the modern alpha slash (which is why `/` is NOT banned).
  for (const ok of [
    'oklch(0.72 0.14 250 / 0.5)', 'oklab(0.7 0.1 -0.05)', 'rgb(0 0 0 / 50%)', 'rgba(1,2,3,0.4)',
    'hsl(210 50% 40%)', 'hwb(210 20% 30%)', 'lch(70% 40 250)', 'lab(70% 20 -30)',
    'color(display-p3 0.1 0.2 0.3)', 'color-mix(in oklch, #fff 40%, #000)', 'rebeccapurple',
  ]) {
    assert.equal(reason(ok), undefined, ok);
  }
});

test('cursor chat is capped at the schema\'s own 64 characters', () => {
  const g = guard();
  assert.equal(DEFAULT_OP_GUARD_CAPS.chatChars, 64);
  assert.deepEqual(g.checkPresence(presence({ chat: ascii(64) })).rejected, []);
  assert.deepEqual(
    g.checkPresence(presence({ chat: ascii(65) })).rejected.map(x => x.reason),
    ['value-too-large'],
  );
});

test('presence strings are capped per string and in total', () => {
  const g = guard();
  const per = DEFAULT_OP_GUARD_CAPS.presenceStringChars;
  const total = DEFAULT_OP_GUARD_CAPS.presenceTotalChars;
  assert.deepEqual(g.checkPresence(presence({ name: ascii(per) })).rejected, []);
  assert.deepEqual(
    g.checkPresence(presence({ name: ascii(per + 1) })).rejected.map(x => x.reason),
    ['value-too-large'],
  );
  // …and the sum, so a frame cannot be padded out of many legal-sized strings.
  const many = Array.from({ length: Math.ceil(total / per) + 1 }, () => ascii(per));
  assert.deepEqual(
    g.checkPresence(presence({ selection: many })).rejected.map(x => x.reason),
    ['value-too-large'],
  );
});

test('presence arrays are length-capped and their ids are id-capped', () => {
  const g = guard(INPUTS, { maxArrayLength: 3 });
  assert.deepEqual(g.checkPresence(presence({ selection: ['a', 'b', 'c'] })).rejected, []);
  assert.deepEqual(
    g.checkPresence(presence({ selection: ['a', 'b', 'c', 'd'] })).rejected.map(x => x.reason),
    ['array-too-long'],
  );
  const long = guard(INPUTS, { idChars: 4, presenceStringChars: 64 });
  assert.deepEqual(
    long.checkPresence(presence({ selection: ['abcde'] })).rejected.map(x => x.reason),
    ['id-too-long'],
  );
});

test('presence refuses a forbidden key anywhere in the frame', () => {
  const g = guard();
  const frame = JSON.parse(
    '{"userId":"U1","name":"P","color":"#fff","cursor":{"x":0,"y":0},"selection":[],"drag":{"__proto__":{"x":1}}}',
  );
  assert.deepEqual(g.checkPresence(frame).rejected.map(x => x.reason), ['forbidden-key']);
});

test('an unknown presence key is tolerated, not refused', () => {
  // Presence is ephemeral, lossy and forward-compatible: refusing a frame because a
  // newer peer added a v1.2 field would make that peer's cursor invisible for the
  // whole session (section 11.19). The structural scan has already bounded it.
  const g = guard();
  const frame = presence({ someFutureField: { nested: 'value' } });
  const r = g.checkPresence(frame);
  assert.deepEqual(r.rejected, []);
  assert.equal(r.ok, frame);
});

test('optional presence fields are type-checked when present', () => {
  const g = guard();
  const reason = (over: Record<string, unknown>) => g.checkPresence(presence(over)).rejected[0]?.reason;
  assert.equal(reason({ drag: { ids: ['B1'], dxy: [1] } }), 'schema');
  assert.equal(reason({ drag: { ids: 'B1', dxy: [1, 2] } }), 'schema');
  assert.equal(reason({ drag: { ids: ['B1'], dxy: [1, '2'] } }), 'schema');
  assert.equal(reason({ focus: 3 }), 'schema');
  assert.equal(reason({ following: {} }), 'schema');
  assert.equal(reason({ viewport: { x: 1, y: 2 } }), 'schema');
  assert.equal(reason({ viewport: { x: 1, y: 2, zoom: Number.POSITIVE_INFINITY } }), 'not-finite');
  assert.equal(reason({ chat: 7 }), 'schema');
});

// ── 8. Drift guards ───────────────────────────────────────────────────────────

test('the param lane accepts exactly the input types collab-plumbing projects', () => {
  // collab-plumbing's SCALAR_INPUT_TYPES is module-private, so the guard's copy is
  // compared against the SOURCE list rather than an import - two hand-kept copies of
  // a whitelist is precisely how one quietly grows an entry the other has not.
  const src = readFileSync(join(SRC, 'lib', 'collab-plumbing.ts'), 'utf8');
  const block = /const SCALAR_INPUT_TYPES\s*=\s*new Set\(\[([\s\S]*?)\]\)/.exec(src);
  assert.ok(block, 'could not find SCALAR_INPUT_TYPES in lib/collab-plumbing.ts - update this test');
  const theirs = [...block[1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort();

  // Derived from BEHAVIOUR: every declared input type, asked whether a param op may
  // address it. (The list is schemas/tool.schema.json's `$defs/input.type` enum.)
  const ALL_TYPES = [
    'text', 'longtext', 'number', 'boolean', 'color', 'select', 'asset',
    'date', 'time', 'datetime-local', 'url', 'blocks', 'vector', 'file', 'table',
  ];
  const mine = ALL_TYPES.filter(type => {
    const g = guard([{ id: 'probe', type }]);
    return g.checkOps([{ k: 'param', key: 'probe', value: 'x', origin: origin() }]).ok.length === 1;
  }).sort();
  assert.deepEqual(mine, theirs);
});

test('the presence key set matches the canvas-op schema\'s own presence $def', () => {
  const def = (canvasOpSchema as { $defs: { presence: { properties: Record<string, unknown> } } })
    .$defs.presence;
  assert.deepEqual([...PRESENCE_KEYS].sort(), Object.keys(def.properties).sort());
});

test('the guard needs no model to be safe', () => {
  // A runtime with no inputs yet (pre-mount, or a tool that declares none) must
  // address nothing rather than everything.
  const g = guard([]);
  assert.equal(reasonFor({ k: 'param', key: 'title', value: 'x', origin: origin() }, g), 'unknown-input');
  assert.equal(reasonFor({ k: 'remove', id: 'B1', origin: origin() }, g), 'unknown-collection');
});
