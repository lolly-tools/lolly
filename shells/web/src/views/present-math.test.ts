// SPDX-License-Identifier: MPL-2.0
/**
 * Pure model behind presentation mode (plan 112). No DOM: buildDeck / resolveAddress /
 * navDir / frameStates / walkNext / walkPrev / stackStep against plain FrameSpec objects.
 * Run directly:  node --test shells/web/src/views/present-math.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeck,
  resolveAddress,
  navDir,
  frameStates,
  walkNext,
  walkPrev,
  stackStep,
  seedStacks,
  clampIndex,
  matchMorphBoxes,
  cameraFor,
  unionRect,
  rectOnScreen,
  rectsOverlap,
  flightPath,
  FLIGHT_MIN_MS,
  FLIGHT_MAX_MS,
  FLIGHT_MARGIN,
  type FrameSpec,
  type MorphBox,
  type Rect,
} from './present-math.ts';

/** A flat three-slide deck (no stacks) - the M1 shape. */
function linear(): FrameSpec[] {
  return [
    { id: 'slide1', order: 0, x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'slide2', order: 1, x: 2000, y: 0, w: 1920, h: 1080 },
    { id: 'slide3', order: 2, x: 4000, y: 0, w: 1920, h: 1080 },
  ];
}

test('buildDeck: linear deck is one-frame columns in order', () => {
  const deck = buildDeck(linear());
  assert.equal(deck.count, 3);
  assert.equal(deck.columnCount, 3);
  assert.deepEqual(deck.positions.map((p) => p.id), ['slide1', 'slide2', 'slide3']);
  assert.deepEqual(deck.positions.map((p) => p.index), [0, 1, 2]);
  // every column has exactly its head, no stack
  assert.deepEqual(deck.columns.map((c) => c.length), [1, 1, 1]);
});

test('buildDeck: sorts by order, then x, then id - not input order', () => {
  const deck = buildDeck([
    { id: 'c', order: 2, x: 0, y: 0, w: 10, h: 10 },
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 0, y: 0, w: 10, h: 10 },
  ]);
  assert.deepEqual(deck.positions.map((p) => p.id), ['a', 'b', 'c']);
});

test('buildDeck: equal order ties break on x', () => {
  const deck = buildDeck([
    { id: 'right', order: 0, x: 500, y: 0, w: 10, h: 10 },
    { id: 'left', order: 0, x: 100, y: 0, w: 10, h: 10 },
  ]);
  assert.deepEqual(deck.positions.map((p) => p.id), ['left', 'right']);
});

test('buildDeck: empty list yields an empty, total-function deck', () => {
  const deck = buildDeck([]);
  assert.equal(deck.count, 0);
  assert.equal(deck.columnCount, 0);
  assert.equal(clampIndex(deck, 5), 0);
  assert.deepEqual(frameStates(deck, 0), []);
  assert.equal(walkNext(deck, 0), 0);
  assert.equal(walkPrev(deck, 0), 0);
  assert.equal(stackStep(deck, 0, 'down'), 0);
});

test('buildDeck: stackOf groups sub-slides under their head, head at row 0', () => {
  // Two columns; column 2 (head b) has two sub-slides b2, b3 stacked below it.
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 100, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 2, x: 100, y: 200, w: 10, h: 10, stackOf: 'b' },
    { id: 'b3', order: 3, x: 100, y: 400, w: 10, h: 10, stackOf: 'b' },
  ]);
  assert.equal(deck.columnCount, 2);
  assert.deepEqual(deck.columns.map((c) => c.map((p) => p.id)), [['a'], ['b', 'b2', 'b3']]);
  // linear walk: head a, then head b, then down its stack
  assert.deepEqual(deck.positions.map((p) => p.id), ['a', 'b', 'b2', 'b3']);
  const b2 = deck.byId.get('b2')!;
  assert.equal(b2.col, 1);
  assert.equal(b2.row, 1);
  assert.equal(b2.index, 2);
});

test('buildDeck: a dangling stackOf degrades the frame to its own head, never dropped', () => {
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'orphan', order: 1, x: 100, y: 0, w: 10, h: 10, stackOf: 'nonexistent' },
  ]);
  assert.equal(deck.count, 2);
  assert.equal(deck.columnCount, 2);
  assert.deepEqual(deck.positions.map((p) => p.id), ['a', 'orphan']);
});

test('buildDeck: a sub-slide cannot head a stack (one level deep)', () => {
  // c points at b2, which is itself a sub-slide → c degrades to its own head.
  const deck = buildDeck([
    { id: 'b', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 1, x: 0, y: 200, w: 10, h: 10, stackOf: 'b' },
    { id: 'c', order: 2, x: 500, y: 0, w: 10, h: 10, stackOf: 'b2' },
  ]);
  assert.deepEqual(deck.columns.map((c) => c.map((p) => p.id)), [['b', 'b2'], ['c']]);
});

test('resolveAddress: positional s=N is a 1-based column-head index', () => {
  const deck = buildDeck(linear());
  assert.equal(resolveAddress('1', deck).position?.id, 'slide1');
  assert.equal(resolveAddress('2', deck).position?.id, 'slide2');
  assert.equal(resolveAddress('3', deck).position?.id, 'slide3');
});

test('resolveAddress: non-numeric is a frame id (any frame, reorder-proof)', () => {
  const deck = buildDeck(linear());
  assert.equal(resolveAddress('slide2', deck).position?.id, 'slide2');
  const withUlid = buildDeck([{ id: '01J8XZ', order: 0, x: 0, y: 0, w: 10, h: 10 }]);
  assert.equal(resolveAddress('01J8XZ', withUlid).position?.id, '01J8XZ');
});

test('resolveAddress: sub-slide reachable by id but numeric counts heads only', () => {
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 100, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 2, x: 100, y: 200, w: 10, h: 10, stackOf: 'b' },
  ]);
  assert.equal(resolveAddress('b2', deck).position?.id, 'b2'); // by id: found
  assert.equal(resolveAddress('2', deck).position?.id, 'b');   // numeric: 2nd head
  assert.equal(resolveAddress('3', deck).position, null);      // no 3rd head
});

test('resolveAddress: build suffix is a raw 1-based threshold; junk → null', () => {
  const deck = buildDeck(linear());
  assert.deepEqual(resolveAddress('2.3', deck), {
    position: deck.byId.get('slide2')!, build: 3, // reveal boxes with build ≤ 3
  });
  assert.equal(resolveAddress('slide1.1', deck).build, 1);
  assert.equal(resolveAddress('slide1.0', deck).build, null); // `.0` is meaningless
  assert.equal(resolveAddress('slide1', deck).build, null);
  assert.equal(resolveAddress('slide1.x', deck).build, null);
});

test('resolveAddress: empty / unknown / out-of-range → null position, never throws', () => {
  const deck = buildDeck(linear());
  assert.equal(resolveAddress('', deck).position, null);
  assert.equal(resolveAddress(null, deck).position, null);
  assert.equal(resolveAddress(undefined, deck).position, null);
  assert.equal(resolveAddress('99', deck).position, null);
  assert.equal(resolveAddress('nope', deck).position, null);
});

test('navDir: column change is horizontal and wins over row change', () => {
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 100, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 2, x: 100, y: 200, w: 10, h: 10, stackOf: 'b' },
  ]);
  const a = deck.byId.get('a')!, b = deck.byId.get('b')!, b2 = deck.byId.get('b2')!;
  assert.equal(navDir(a, b), 'right');
  assert.equal(navDir(b, a), 'left');
  assert.equal(navDir(b, b2), 'down');
  assert.equal(navDir(b2, b), 'up');
  assert.equal(navDir(a, b2), 'right'); // col change dominates row change
  assert.equal(navDir(a, a), null);
  assert.equal(navDir(null, a), null);
});

test('frameStates: positional trichotomy with active in the middle', () => {
  const deck = buildDeck(linear());
  const s = frameStates(deck, 1);
  assert.deepEqual(s.map((f) => f.state), ['past', 'present', 'future']);
  assert.deepEqual(s.map((f) => f.isPrev), [true, false, false]);
  assert.deepEqual(s.map((f) => f.isNext), [false, false, true]);
});

test('frameStates: hidden window is |index − active| > viewDistance', () => {
  const deck = buildDeck([
    { id: 's0', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 's1', order: 1, x: 1, y: 0, w: 10, h: 10 },
    { id: 's2', order: 2, x: 2, y: 0, w: 10, h: 10 },
    { id: 's3', order: 3, x: 3, y: 0, w: 10, h: 10 },
    { id: 's4', order: 4, x: 4, y: 0, w: 10, h: 10 },
  ]);
  // active = 2, viewDistance 1 → s0 and s4 hidden, s1..s3 live
  assert.deepEqual(frameStates(deck, 2, 1).map((f) => f.hidden), [true, false, false, false, true]);
  // viewDistance 2 → nothing hidden
  assert.deepEqual(frameStates(deck, 2, 2).map((f) => f.hidden), [false, false, false, false, false]);
});

test('frameStates: isStack true only for multi-frame columns', () => {
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 100, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 2, x: 100, y: 200, w: 10, h: 10, stackOf: 'b' },
  ]);
  const byId = new Map(frameStates(deck, 0).map((f) => [f.id, f.isStack]));
  assert.equal(byId.get('a'), false);
  assert.equal(byId.get('b'), true);
  assert.equal(byId.get('b2'), true);
});

test('frameStates: active index is clamped (out-of-range never crashes)', () => {
  const deck = buildDeck(linear());
  assert.equal(frameStates(deck, 99)[2]!.state, 'present'); // clamps to last
  assert.equal(frameStates(deck, -5)[0]!.state, 'present'); // clamps to first
});

test('walkNext/walkPrev: clamp at the ends without loop, wrap with loop', () => {
  const deck = buildDeck(linear());
  assert.equal(walkNext(deck, 0), 1);
  assert.equal(walkNext(deck, 2), 2); // stays at end
  assert.equal(walkNext(deck, 2, { loop: true }), 0); // wraps
  assert.equal(walkPrev(deck, 2), 1);
  assert.equal(walkPrev(deck, 0), 0); // stays at start
  assert.equal(walkPrev(deck, 0, { loop: true }), 2); // wraps
});

// ── morph matching (M5) ──────────────────────────────────────────────────────────────

const mb = (id: string, o: Partial<MorphBox> = {}): MorphBox => ({ id, ...o });

test('matchMorphBoxes: explicit matchOf links, one-to-one', () => {
  const from = [mb('a', { matchOf: 'logo' }), mb('b', { matchOf: 'x' })];
  const to = [mb('c', { matchOf: 'logo' }), mb('d', { matchOf: 'y' })];
  const pairs = matchMorphBoxes(from, to);
  assert.deepEqual(pairs, [{ fromId: 'a', toId: 'c', via: 'matchOf' }]);
});

test('matchMorphBoxes: identical text matches implicitly', () => {
  const pairs = matchMorphBoxes([mb('a', { text: 'Hello' })], [mb('b', { text: 'Hello' })]);
  assert.deepEqual(pairs, [{ fromId: 'a', toId: 'b', via: 'text' }]);
});

test('matchMorphBoxes: same image key matches; empty keys never match', () => {
  const pairs = matchMorphBoxes(
    [mb('a', { imageKey: 'logo.png' }), mb('x', { imageKey: '' })],
    [mb('b', { imageKey: 'logo.png' }), mb('y', { imageKey: '' })],
  );
  assert.deepEqual(pairs, [{ fromId: 'a', toId: 'b', via: 'image' }]);
});

test('matchMorphBoxes: matchOf beats text; a box is claimed only once', () => {
  // `a`/`c` share text "Title" but `a` also has matchOf pointing at `d`. matchOf wins, so
  // `a`→`d`, and `c` is then free to match `b` by text.
  const from = [mb('a', { matchOf: 'k', text: 'Title' }), mb('c2', { text: 'Body' })];
  const to = [mb('b', { text: 'Body' }), mb('c', { text: 'Title' }), mb('d', { matchOf: 'k', text: 'Different' })];
  const pairs = matchMorphBoxes(from, to);
  assert.deepEqual(pairs, [
    { fromId: 'a', toId: 'd', via: 'matchOf' },
    { fromId: 'c2', toId: 'b', via: 'text' },
  ]);
});

test('matchMorphBoxes: no false matches (different everything → empty)', () => {
  assert.deepEqual(matchMorphBoxes([mb('a', { text: 'x' })], [mb('b', { text: 'y' })]), []);
  assert.deepEqual(matchMorphBoxes([], []), []);
});

test('stackStep: walks within a column, stops at column edges (no spill)', () => {
  const deck = buildDeck([
    { id: 'a', order: 0, x: 0, y: 0, w: 10, h: 10 },
    { id: 'b', order: 1, x: 100, y: 0, w: 10, h: 10 },
    { id: 'b2', order: 2, x: 100, y: 200, w: 10, h: 10, stackOf: 'b' },
    { id: 'b3', order: 3, x: 100, y: 400, w: 10, h: 10, stackOf: 'b' },
  ]);
  const b = deck.byId.get('b')!.index;
  const b2 = deck.byId.get('b2')!.index;
  const b3 = deck.byId.get('b3')!.index;
  assert.equal(stackStep(deck, b, 'down'), b2);
  assert.equal(stackStep(deck, b2, 'down'), b3);
  assert.equal(stackStep(deck, b3, 'down'), b3); // bottom edge: stay
  assert.equal(stackStep(deck, b, 'up'), b);      // top edge: stay (no spill to prev column)
  assert.equal(stackStep(deck, b2, 'up'), b);
});

// ── seedStacks (plan 112 M5): geometry proposes, structure disposes ───────────

test('seedStacks: same-x columns become stacks, head topmost, sub-slides in y order', () => {
  const seeded = seedStacks([
    { id: 'a', order: 0, x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'a2', order: 1, x: 0, y: 1200, w: 1920, h: 1080 },
    { id: 'b', order: 2, x: 2000, y: 0, w: 1920, h: 1080 },
    { id: 'a3', order: 3, x: 60, y: 2400, w: 1800, h: 1080 },  // x-centre inside a's span
  ]);
  const deck = buildDeck(seeded);
  assert.equal(deck.columnCount, 2, 'two columns');
  assert.deepEqual(deck.columns[0]!.map((p) => p.id), ['a', 'a2', 'a3'], 'the a column stacks in y order');
  assert.deepEqual(deck.columns[1]!.map((p) => p.id), ['b']);
  // The linear walk goes head, its stack, next head - reveal's own advance.
  assert.deepEqual(deck.positions.map((p) => p.id), ['a', 'a2', 'a3', 'b']);
});

test('seedStacks abstains: authored stackOf anywhere, a single column, or nothing to stack', () => {
  // Authored structure disposes - even one stackOf turns the inference off.
  const authored = [
    { id: 'a', order: 0, x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'a2', order: 1, x: 0, y: 1200, w: 1920, h: 1080, stackOf: 'a' },
    { id: 'c', order: 2, x: 0, y: 2400, w: 1920, h: 1080 },
  ];
  assert.deepEqual(seedStacks(authored), authored, 'authored decks pass through verbatim');
  // A vertical strip (ALL one column) stays linear: collapsing it would break
  // every numeric s= link and read 1/1 on an N-frame deck.
  const strip: FrameSpec[] = [
    { id: 'a', order: 0, x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'b', order: 1, x: 0, y: 1200, w: 1920, h: 1080 },
  ];
  assert.equal(buildDeck(seedStacks(strip)).columnCount, 2, 'the strip stays two columns of one');
  // Pure side-by-side has nothing to stack.
  const flat = linear();
  assert.deepEqual(seedStacks(flat), flat);
});

// ── The canvas camera and the flight transition (plan 179 M4 section 7) ──────────────

/** A 16:9 board, and the presenter viewport the tests fly it in. */
const BOARD = (x: number, y = 0): Rect => ({ x, y, w: 1920, h: 1080 });
const VIEW = { w: 1000, h: 600 };

/** Is `r` inside the viewport, with a pixel of slack for rounding? */
function insideView(r: Rect): boolean {
  return r.x >= -1 && r.y >= -1 && r.x + r.w <= VIEW.w + 1 && r.y + r.h <= VIEW.h + 1;
}

test('cameraFor centres a rect in the viewport and fits it with the margin to spare', () => {
  const cam = cameraFor(BOARD(0), VIEW, 1);
  // Width-bound here (1000/1920 < 600/1080), so the frame fills the width exactly.
  assert.equal(cam.scale, 1000 / 1920);
  const on = rectOnScreen(BOARD(0), cam);
  assert.ok(Math.abs(on.x) < 1, 'flush left when width-bound');
  assert.equal(Math.round(on.x + on.w), VIEW.w, 'and flush right');
  assert.equal(Math.round(on.y + on.h / 2), VIEW.h / 2, 'centred vertically');
  // A margin shrinks the frame about the same centre - it never moves it off centre.
  const inset = cameraFor(BOARD(0), VIEW, 0.9);
  const onInset = rectOnScreen(BOARD(0), inset);
  assert.equal(Math.round(onInset.x + onInset.w / 2), VIEW.w / 2);
  assert.ok(onInset.w < on.w, 'the margin leaves room around the frame');
});

test('unionRect covers every frame, and degrades to a unit box on nothing', () => {
  assert.deepEqual(unionRect([BOARD(0), BOARD(4000, 500)]), { x: 0, y: 0, w: 5920, h: 1580 });
  assert.deepEqual(unionRect([]), { x: 0, y: 0, w: 1, h: 1 });
});

test('flightPath: a near move is ONE eased leg, framing the destination exactly', () => {
  // The destination is a quarter-size board inside the one being left, so once the camera
  // frames it the frame it came from still fills the screen - nothing is lost sight of.
  const a = BOARD(0);
  const b: Rect = { x: 200, y: 100, w: 480, h: 270 };
  const path = flightPath(a, b, VIEW)!;
  assert.ok(path, 'a flyable pair');
  assert.equal(path.zoomOut, false, 'no arc needed');
  assert.equal(path.phases.length, 1);
  const camB = cameraFor(b, VIEW, FLIGHT_MARGIN);
  assert.deepEqual(
    { scale: path.phases[0]!.scale, tx: path.phases[0]!.tx, ty: path.phases[0]!.ty },
    camB,
    'the move ends framing B, exactly as the stacked stage would fit it',
  );
  assert.equal(path.phases[0]!.ms, path.total, 'one leg takes the whole move');
});

test('flightPath: frames that do not share the screen ARC out to hold both, then in on B', () => {
  const a = BOARD(0);
  const b = BOARD(4000);
  const camB = cameraFor(b, VIEW, FLIGHT_MARGIN);
  // The premise: from B's camera, A is nowhere on screen - that is what makes the arc
  // necessary rather than decorative.
  assert.equal(rectsOverlap(rectOnScreen(a, camB), { x: 0, y: 0, ...VIEW }), false);
  const path = flightPath(a, b, VIEW)!;
  assert.equal(path.zoomOut, true);
  assert.equal(path.phases.length, 2);
  // Top of the arc: BOTH frames are on screen at once.
  const out = path.phases[0]!;
  assert.ok(insideView(rectOnScreen(a, out)), 'the frame being left is inside the wide shot');
  assert.ok(insideView(rectOnScreen(b, out)), 'and so is the one being flown to');
  assert.ok(out.scale < camB.scale, 'the wide shot is further away than the arrival');
  // ...and the landing is the same frame-filling camera the near move ends on.
  const last = path.phases[1]!;
  assert.deepEqual({ scale: last.scale, tx: last.tx, ty: last.ty }, camB);
  assert.equal(out.ms + last.ms, path.total, 'the legs add up to the whole move');
  assert.ok(out.ms > 0 && last.ms > 0, 'neither leg is instant');
});

test('flightPath: the duration is clamped to the band, and grows with the distance', () => {
  const near = flightPath(BOARD(0), BOARD(0), VIEW)!;
  assert.equal(near.total, FLIGHT_MIN_MS, 'no travel takes the floor');
  const far = flightPath(BOARD(0), BOARD(40_000), VIEW)!;
  assert.equal(far.total, FLIGHT_MAX_MS, 'a long haul is capped, not slower and slower');
  const mid = flightPath(BOARD(0), BOARD(2000), VIEW)!;
  assert.ok(mid.total > FLIGHT_MIN_MS && mid.total < FLIGHT_MAX_MS, 'a neighbouring board sits between');
  assert.ok(far.spans > mid.spans && mid.spans > near.spans, 'spans measure the travel');
});

test('flightPath: nothing to fly returns null (a zero viewport, an empty frame)', () => {
  assert.equal(flightPath(BOARD(0), BOARD(2000), { w: 0, h: 600 }), null);
  assert.equal(flightPath({ x: 0, y: 0, w: 0, h: 0 }, BOARD(2000), VIEW), null);
});
