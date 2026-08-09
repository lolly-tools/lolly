// SPDX-License-Identifier: MPL-2.0
/**
 * The §8 shared conformance test for the canvas-op contract (plans/99), OSS side.
 *
 * The suite BODY now lives in the shipped SDK — `@lolly-tools/core/canvas-op-testkit`
 * (`runConvergenceSuite`) — so lolly-work imports the SAME bytes via engine-pin.json and
 * runs it against its real Yjs adapter. Here we run it against the dependency-free
 * `ReferenceCanvasDoc`, and additionally cover the adapter-INDEPENDENT pure helpers
 * (damageToOps / opsToDamage / laneForField / version negotiation) that lolly-work does
 * not re-test. DO NOT change the exported suite signature without cross-repo
 * coordination (plans/99 §9).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runConvergenceSuite } from '../packages/core/src/canvas-op-testkit.ts';
import {
  ReferenceCanvasDoc,
  damageToOps,
  opsToDamage,
  laneForField,
  isCompatibleOpVersion,
  DEFAULT_GEOMETRY_FIELDS,
  CANVAS_OP_VERSION,
} from '../packages/core/src/canvas-op-v1.ts';
import type { BoxId, BoxRow, OpOrigin } from '../packages/core/src/canvas-op-v1.ts';

// ── OSS run: the reference CRDT is the adapter under test ────────────────────────

test('reference CRDT converges under the shared conformance suite (§8)', () => {
  runConvergenceSuite(() => new ReferenceCanvasDoc(), 'reference');
});

// ── Pure-helper conformance (shared, but adapter-independent) ────────────────────

test('damageToOps → opsToDamage round-trips the §4.1/§4.2 lane split', () => {
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

test('one gesture is one transaction (single origin) = one undo step (§5)', () => {
  // A gesture that both moves and restyles the same box emits a batch sharing ONE
  // origin stamp — the atomic unit an undo pops.
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

test('incompatible major → observer-only; same major → compatible (§9)', () => {
  assert.equal(isCompatibleOpVersion('1.0.0'), true);
  assert.equal(isCompatibleOpVersion('1.9.3', CANVAS_OP_VERSION), true);
  assert.equal(isCompatibleOpVersion('2.0.0', CANVAS_OP_VERSION), false);
  assert.equal(isCompatibleOpVersion('0.9.0', '1.0.0'), false);
});

test('laneForField splits geometry vs content, honouring a renamed geom set (§4.3)', () => {
  for (const f of DEFAULT_GEOMETRY_FIELDS) assert.equal(laneForField(f), 'geometry');
  assert.equal(laneForField('fill'), 'content');
  assert.equal(laneForField('kind'), 'content');
  // A tool that renames geometry fields passes its resolved role set across the seam.
  assert.equal(laneForField('px', ['px', 'py']), 'geometry');
  assert.equal(laneForField('x', ['px', 'py']), 'content');
});
