// SPDX-License-Identifier: MPL-2.0
/**
 * The clip search's work budget, and the handoff to the overrun search
 * (`CLIP_BUDGET` in engine/src/geom/intersect.ts).
 *
 * The intersector runs the clip search it has always run, counting its recursion nodes. A
 * pair that spends more than `CLIP_BUDGET.maxNodes` of them is abandoned whole and answered
 * instead by the overrun search, which reads which side of one curve the other is on rather
 * than clipping. What this file pins is that the switch is where it says it is, that it
 * changes nothing on the near side of it, and that it is the same on every call.
 *
 * ## The oracle for "unchanged" is HEAD's own output
 *
 * Every expected answer in `INSIDE_THE_BUDGET` and every `clip` list below was produced by
 * the file as it stood before the budget existed (`git show HEAD:engine/src/geom/intersect.ts`
 * at 58be2c11e, run over the same inputs). They are not what the search ought to return.
 * Some of them are plainly poor: a loop against a copy of itself a hundred-thousandth away
 * comes back as three near-identical points at t = 0.5 rather than its three crossings, and
 * an S curve against its own reversal comes back as 46 points strung along the whole curve.
 * They are recorded because they are what callers have had, and this change is not allowed to
 * move them. A diff here means the budget or the counting changed an answer that was never in
 * question, and the fix is the code, not the table.
 *
 * The node counts are pinned with the answers, so the margin between ordinary work and the
 * budget stays visible. A pair that suddenly costs ten times what it did should fail here
 * even when its answer is unchanged, because the next such change would cross the budget.
 *
 * ## What this file does not claim
 *
 * That the overrun answers are right. They are checked as regions and as crossings in
 * tests/geom-coincident-repeats.test.ts and tests/geom-scan-zones.test.ts; here they are only
 * pinned as a second answer that the budget can be moved across and back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type Cubic, evalCubic } from '../engine/src/geom/bezier.ts';
import { CLIP_BUDGET, CLIP_COUNTS, intersectCubics } from '../engine/src/geom/intersect.ts';

interface Hit { t1: number; t2: number; x: number; y: number }

/** The two curves the near-copy ladders below are built from, and the shift that makes a
 *  copy. The smaller the shift, the longer the two lie along each other within the
 *  tolerance, and the more nodes the clip search spends trying to separate them. */
const LOOP: Cubic = [0, 0, 150, 100, -50, 100, 100, 0];
const HUMP: Cubic = [0, 0, 30, 60, 70, 60, 100, 0];
const shift = (c: Cubic, dx: number, dy: number): Cubic =>
  c.map((v, i) => (i % 2 ? v + dy : v + dx)) as unknown as Cubic;
const reversed = (c: Cubic): Cubic => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];

/** Run one pair and say which search answered it. */
function answer(c1: Cubic, c2: Cubic, tol = 1e-9): { hits: Hit[]; nodes: number; overrun: boolean; reached: boolean } {
  const pairs = CLIP_COUNTS.pairs, overruns = CLIP_COUNTS.overruns;
  const hits = intersectCubics(c1, c2, tol);
  return {
    hits,
    nodes: CLIP_COUNTS.lastNodes,
    overrun: CLIP_COUNTS.overruns > overruns,
    reached: CLIP_COUNTS.pairs > pairs,
  };
}

/** Run `body` with the budget set to `maxNodes`, then put the budget back. */
function withBudget<T>(maxNodes: number, body: () => T): T {
  const was = CLIP_BUDGET.maxNodes;
  CLIP_BUDGET.maxNodes = maxNodes;
  try {
    return body();
  } finally {
    CLIP_BUDGET.maxNodes = was;
  }
}

// ── 1. inside the budget, nothing moved ───────────────────────────────────────

/**
 * Pairs the clip search finishes, from ten nodes to a few hundred short of the budget, with
 * the answers and node counts the search gave before the budget existed.
 */
const INSIDE_THE_BUDGET: { what: string; nodes: number; c1: Cubic; c2: Cubic; hits: Hit[] }[] = [
  {
    what: 'two circles of the same radius, crossing twice',
    nodes: 10,
    c1: [50, 0, 50, 27.61423749153968, 27.614237491539683, 50, 3.061616997868383e-15, 50],
    c2: [40, 50, 12.385762508460324, 50, -10, 27.614237491539686, -10, 6.123233995736766e-15],
    hits: [
      { t1: 0.7424862040533354, t2: 0.2575137959455981, x: 20.00000000007612, y: 45.83956314587697 },
    ],
  },
  {
    what: 'a hump against an arc that cuts across it',
    nodes: 18,
    c1: [0, 0, 30, 60, 70, 60, 100, 0],
    c2: [50, 50, 33.431457505076196, 50, 20.000000000000004, 36.56854249492381, 20, 20.000000000000004],
    hits: [
      { t1: 0.23689846414488497, t2: 0.7298076429180511, x: 22.73858922593199, y: 32.539964729522346 },
    ],
  },
  {
    what: 'two arcs that touch at one point',
    nodes: 78,
    c1: [50, 0, 50, 27.61423749153968, 27.614237491539683, 50, 3.061616997868383e-15, 50],
    c2: [50, 6.123233995736766e-15, 50, -27.614237491539672, 72.38576250846032, -49.99999999999999, 99.99999999999999, -50],
    hits: [
      { t1: 1.2129723225389083e-16, t2: 3.637978807091713e-12, x: 50, y: -3.01373909070453e-10 },
    ],
  },
  {
    what: 'a loop against a copy of itself a tenth away',
    nodes: 405,
    c1: [0, 0, 150, 100, -50, 100, 100, 0],
    c2: [0.1, 0, 150.1, 100, -49.9, 100, 100.1, 0],
    hits: [
      { t1: 0.17300700854177564, t2: 0.8269929914580896, x: 50.049999999979846, y: 42.92267506118691 },
      { t1: 0.49933333056796125, t2: 0.5006666694321722, x: 50.04999999999292, y: 74.99986666556052 },
      { t1: 0.8276596608903576, t2: 0.17234033910471305, x: 50.04999999925834, y: 42.79174398659566 },
    ],
  },
  {
    what: 'a hump against a copy of itself a thousandth away',
    nodes: 1645,
    c1: [0, 0, 30, 60, 70, 60, 100, 0],
    c2: [0, 0.001, 30, 60.001, 70, 60.001, 100, 0.001],
    hits: [],
  },
  {
    what: 'a loop against a copy of itself a thousandth away',
    nodes: 3149,
    c1: [0, 0, 150, 100, -50, 100, 100, 0],
    c2: [0.001, 0, 150.001, 100, -49.999, 100, 100.001, 0],
    hits: [
      { t1: 0.1726764980302637, t2: 0.8273235019696081, x: 50.000499999980754, y: 42.85779751750562 },
      { t1: 0.499993333331312, t2: 0.5000066666581147, x: 50.000500000641615, y: 74.99999998666668 },
      { t1: 0.8273301686364058, t2: 0.17266983136372244, x: 50.00050000001924, y: 42.85648821016381 },
    ],
  },
  {
    what: 'a hump against a copy of itself a ten-thousandth away',
    nodes: 5647,
    c1: [0, 0, 30, 60, 70, 60, 100, 0],
    c2: [0, 0.0001, 30, 60.0001, 70, 60.0001, 100, 0.0001],
    hits: [],
  },
  {
    what: 'a loop against a copy of itself a ten-thousandth away',
    nodes: 10618,
    c1: [0, 0, 150, 100, -50, 100, 100, 0],
    c2: [0.0001, 0, 150.0001, 100, -49.9999, 100, 100.0001, 0],
    hits: [
      { t1: 0.17267349797985398, t2: 0.8273265020200178, x: 50.00004999998075, y: 42.8572083226018 },
      { t1: 0.4999993333525059, t2: 0.5000006666987411, x: 50.000049998562055, y: 74.99999999986666 },
      { t1: 0.8273271686868127, t2: 0.17267283131331565, x: 50.00005000001926, y: 42.85707739186766 },
    ],
  },
  {
    what: 'a loop against a copy of itself a hundred-thousandth away',
    nodes: 15701,
    c1: [0, 0, 150, 100, -50, 100, 100, 0],
    c2: [0.00001, 0, 150.00001, 100, -49.99999, 100, 100.00001, 0],
    hits: [
      { t1: 0.49999993282627275, t2: 0.5000000661768335, x: 50.00000503802953, y: 74.99999999999866 },
      { t1: 0.4999999329343964, t2: 0.5000000662481487, x: 50.000005029920274, y: 74.99999999999866 },
      { t1: 0.49999993304252, t2: 0.5000000663551216, x: 50.00000502181099, y: 74.99999999999866 },
    ],
  },
  {
    // From the recorded corpora of real paths and fuzz inputs: of their 41,151 pairs this is
    // the one the clip search works hardest on without going over.
    what: 'the heaviest pair of the recorded corpora that stays inside the budget',
    nodes: 15232,
    c1: [40, 39, 30.553103929021646, 39, 21, 29.44689607097527, 21, 20],
    c2: [21.04455275452146, 21.12207727339362, 21.015047468563246, 20.749753777628957, 21, 20.37475738171014, 21, 20],
    hits: [
      { t1: 0.9999820953189986, t2: 0.9995486593122739, x: 21.000000009187477, y: 20.000507431083914 },
      { t1: 0.9999911998256716, t2: 0.9997781661350378, x: 21.00000000221946, y: 20.000249403021527 },
    ],
  },
];

test('the budget is the measured one', () => {
  // A change here is a change to what callers get, and wants the measurement in the head of
  // engine/src/geom/intersect.ts redone rather than a new number typed in.
  assert.equal(CLIP_BUDGET.maxNodes, 16384);
});

test('a pair inside the budget answers exactly as the clip search always did', () => {
  for (const c of INSIDE_THE_BUDGET) {
    const got = answer(c.c1, c.c2);
    assert.equal(got.overrun, false, `${c.what}: went to the overrun search`);
    assert.equal(got.nodes, c.nodes, `${c.what}: the clip search spent ${got.nodes} nodes, not ${c.nodes}`);
    assert.ok(got.nodes <= CLIP_BUDGET.maxNodes, `${c.what}: ${got.nodes} nodes is over the budget`);
    assert.deepEqual(got.hits, c.hits, `${c.what}: the answer moved`);
  }
});

test('the exact line paths never reach the budget at all', () => {
  const line = (x0: number, y0: number, x1: number, y1: number): Cubic =>
    [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3, x1, y1];
  const cross = answer(line(0, 0, 100, 60), line(0, 60, 100, 0));
  assert.equal(cross.reached, false, 'a line against a line went through the clip search');
  assert.deepEqual(cross.hits, [{ t1: 0.5, t2: 0.5, x: 50, y: 30 }]);

  const overArch = answer(line(0, 30, 100, 30), HUMP);
  assert.equal(overArch.reached, false, 'a line against a cubic went through the clip search');
  assert.equal(overArch.hits.length, 2, 'a level line cuts the hump twice');
  // Even at a budget of one node the closed-form path is untouched.
  const squeezed = withBudget(1, () => answer(line(0, 30, 100, 30), HUMP));
  assert.deepEqual(squeezed.hits, overArch.hits, 'the line path depends on the budget');
});

// ── 2. over the budget, the other search answers ──────────────────────────────

/** Pairs the clip search cannot finish, with what each search says about them. */
const OVER_THE_BUDGET: { what: string; c1: Cubic; c2: Cubic; overrun: Hit[]; clipHits: number }[] = [
  {
    // Two curves with no crossing that stay within the tolerance of each other for a long
    // stretch. Both searches report nothing; only the path differs.
    what: 'a hump against a copy of itself a hundred-thousandth away',
    c1: HUMP,
    c2: shift(HUMP, 0, 0.00001),
    overrun: [],
    clipHits: 0,
  },
  {
    what: 'a loop against a copy of itself a millionth away',
    c1: LOOP,
    c2: shift(LOOP, 0.000001, 0),
    overrun: [
      { t1: 0.1726731679793448, t2: 0.8273268320205269, x: 50.00000049998075, y: 42.85714351182174 },
      { t1: 0.4999999943016867, t2: 0.50000000763502, x: 50.00000042737351, y: 75 },
      { t1: 0.827326838687322, t2: 0.1726731613128064, x: 50.00000050001924, y: 42.857142202514396 },
    ],
    // The clip search reports five points, all of them within a millionth of t = 0.5, and
    // none of them the two crossings at t = 0.17 and t = 0.83.
    clipHits: 5,
  },
  {
    what: 'an S curve against its own reversal',
    c1: [0, 0, 30, 60, 70, -60, 100, 0],
    c2: reversed([0, 0, 30, 60, 70, -60, 100, 0]),
    // The same curve backwards: the overrun search answers the shared run with its two ends.
    overrun: [
      { t1: 0, t2: 1, x: 0, y: 0 },
      { t1: 1, t2: 0, x: 100, y: 0 },
    ],
    // The clip search strings 46 points along the whole of it.
    clipHits: 46,
  },
];

function assertOverrunContacts(hits: Hit[], fixture: typeof OVER_THE_BUDGET[number]): void {
  assert.equal(hits.length, fixture.overrun.length, `${fixture.what}: contact count changed`);
  for (const [i, hit] of hits.entries()) {
    const expected = fixture.overrun[i]!;
    // The isolating root solver can choose a different point in a shallow contact zone.
    // Keep the recorded zones, but verify each answer lies on both original curves.
    assert.ok(Math.abs(hit.t1 - expected.t1) < 1e-8 && Math.abs(hit.t2 - expected.t2) < 1e-8,
      `${fixture.what}: contact moved out of its recorded zone`);
    const a = evalCubic(fixture.c1, hit.t1), b = evalCubic(fixture.c2, hit.t2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) <= 1e-9,
      `${fixture.what}: reported contact is not on both curves`);
    assert.ok(Math.hypot(hit.x - a.x, hit.y - a.y) <= 1e-9,
      `${fixture.what}: reported point does not match its parameter`);
  }
}

test('a pair over the budget is answered by the overrun search', () => {
  for (const c of OVER_THE_BUDGET) {
    const got = answer(c.c1, c.c2);
    assert.equal(got.overrun, true, `${c.what}: the clip search finished it`);
    assert.equal(got.nodes, CLIP_BUDGET.maxNodes + 1, `${c.what}: stopped at ${got.nodes} nodes`);
    assertOverrunContacts(got.hits, c);
  }
});

test('raising the budget past the pair puts the clip search back in charge, and lowering it hands over again', () => {
  for (const c of OVER_THE_BUDGET) {
    // Ten million nodes is more than the heaviest pair ever measured (six million).
    const wide = withBudget(10_000_000, () => answer(c.c1, c.c2));
    assert.equal(wide.overrun, false, `${c.what}: still went over with the budget raised`);
    assert.equal(wide.hits.length, c.clipHits, `${c.what}: the clip search's own answer moved`);

    const back = answer(c.c1, c.c2);
    assert.equal(back.overrun, true, `${c.what}: did not hand over again`);
    assertOverrunContacts(back.hits, c);
  }
});

test('the switch is at the pair\'s own node count, to the node', () => {
  // The pair that costs most without going over, from the table above.
  const c = INSIDE_THE_BUDGET[INSIDE_THE_BUDGET.length - 2]!;
  const at = withBudget(c.nodes, () => answer(c.c1, c.c2));
  assert.equal(at.overrun, false, 'a budget equal to the pair\'s cost is enough');
  assert.deepEqual(at.hits, c.hits, 'the answer at the exact budget is the clip search\'s');

  const one = withBudget(c.nodes - 1, () => answer(c.c1, c.c2));
  assert.equal(one.overrun, true, 'one node short still finished');
  assert.equal(one.nodes, c.nodes, 'the search stops one node past the budget');
  assert.notDeepEqual(one.hits, c.hits, 'this pair is answered differently by the two searches');

  const back = answer(c.c1, c.c2);
  assert.equal(back.overrun, false, 'the budget was not put back');
  assert.deepEqual(back.hits, c.hits, 'the clip search\'s answer did not come back');
});

// ── 3. the same question, the same answer ─────────────────────────────────────

test('a pair takes the same path and gives the same answer on every call', () => {
  // Two from each side of the budget, three calls each: enough to catch state carried
  // between calls, cheap enough that the file stays quick.
  for (const c of [INSIDE_THE_BUDGET[0]!, INSIDE_THE_BUDGET[7]!, OVER_THE_BUDGET[1]!, OVER_THE_BUDGET[2]!]) {
    const first = answer(c.c1, c.c2);
    for (let k = 0; k < 2; k++) {
      const again = answer(c.c1, c.c2);
      assert.equal(again.overrun, first.overrun, `${c.what}: the path changed between calls`);
      assert.equal(again.nodes, first.nodes, `${c.what}: the cost changed between calls`);
      assert.deepEqual(again.hits, first.hits, `${c.what}: the answer changed between calls`);
    }
  }
});

test('either operand order is answered the same way every time, though the two orders can cost different amounts', () => {
  const pairs: [string, Cubic, Cubic][] = [
    ['a loop against a copy a ten-thousandth away', LOOP, shift(LOOP, 0.0001, 0)],
    ['an S curve against its own reversal', [0, 0, 30, 60, 70, -60, 100, 0], reversed([0, 0, 30, 60, 70, -60, 100, 0])],
  ];
  for (const [what, a, b] of pairs) {
    for (const [c1, c2] of [[a, b], [b, a]] as [Cubic, Cubic][]) {
      const first = answer(c1, c2);
      const again = answer(c1, c2);
      assert.equal(again.overrun, first.overrun, `${what}: one order changed path between calls`);
      assert.deepEqual(again.hits, first.hits, `${what}: one order changed answer between calls`);
    }
  }
  // A pair well clear of the budget takes the same path whichever way round it is given.
  const easy = shift(LOOP, 0.0001, 0);
  assert.equal(answer(LOOP, easy).overrun, false);
  assert.equal(answer(easy, LOOP).overrun, false);
  // A pair well over it does too.
  const hard = shift(LOOP, 0.000001, 0);
  assert.equal(answer(LOOP, hard).overrun, true);
  assert.equal(answer(hard, LOOP).overrun, true);
  // Right at the budget the two orders can part company: this pair costs 15,701 nodes one
  // way round and more than the budget the other. Both answers are still answers to the
  // question asked, and the cost has never been symmetric.
  const edge = shift(LOOP, 0.00001, 0);
  assert.equal(answer(LOOP, edge).overrun, false);
  assert.equal(answer(edge, LOOP).overrun, true);
});
