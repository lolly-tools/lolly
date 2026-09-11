// SPDX-License-Identifier: MPL-2.0
/**
 * The one motion model (plans/179 M4) - lib/motion-model.ts.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/motion-model.test.ts
 * (also collected by `pnpm test`). No framework - node:test.
 *
 * What is actually at risk here, and why each section exists:
 *
 * 1. DERIVATION. The mode is not stored, so every player has to reach the same answer
 *    from the same fields - including on the legacy box that carries BOTH a build step
 *    and a start, where the three players already agree that the build wins.
 * 2. EXCLUSIVITY. `setAppear` is the only writer, and its whole job is that a box can
 *    never come back carrying two ways of appearing. The cleared value must be '' and
 *    not `undefined`, because the compact-blocks URL codec writes one column per field
 *    and `undefined` leaves the old column standing in a shared link.
 * 3. THE SLIDE PAIR. slide -> slide-left/slide-right looks like a typo and is not, so
 *    it is pinned by name; the two degraded kinds must SAY they degraded.
 * 4. THE REST POSE. A still of a slide has to be taken after the motion, not during it.
 *    A box with no "after" - a keyframe track, a hold - must not drag that moment
 *    anywhere: a decoration with no start of its own once pinned the whole page to t = 0
 *    and photographed every fading headline at opacity 0.
 * 6. THE NARRATED DWELL. A slide has to be long enough to hold what is spoken on it,
 *    and the three rules that make it so (plans/180 T1-T3) are arithmetic every player
 *    repeats - the dwell solver, the presenter, and the .pptx advTm - so they are pinned
 *    in one pure function rather than derived three times.
 * 5. THE REMEMBERED NUMBERS. The patch is exclusive, so switching modes clears fields.
 *    Both surfaces' controls promise the step / start / length survive a look at another
 *    mode, and only a per-box memory keyed off the row's own id can keep that promise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  appearModeOf, setAppear, appearSummary,
  slideTransitionPair, buildStepsDropped, restMsOf,
  narrationDwellMs, NARRATION_LEAD_IN_MS, NARRATION_TAIL_MS,
  type MotionBox,
} from './motion-model.ts';
import { isTransitionKind } from './transitions.ts';

const frag = (html: string): Element => {
  const doc = new JSDOM(`<!doctype html><body><div id="page">${html}</div></body>`).window.document;
  return doc.getElementById('page')!;
};

// ── 1. the derived mode ───────────────────────────────────────────────────────

test('appearModeOf: the three ways a box arrives', () => {
  assert.equal(appearModeOf({}), 'slide', 'nothing authored is "with the slide"');
  assert.equal(appearModeOf({ build: 2 }), 'click');
  assert.equal(appearModeOf({ build: '3' }), 'click', 'a URL carries the step as a string');
  assert.equal(appearModeOf({ start: 1.5 }), 'time');
  assert.equal(appearModeOf({ start: '0' }), 'time', 'start 0 is authored, not absent');
  assert.equal(appearModeOf({ lane: 'seq' }), 'time', 'a clip is timed even with no start yet');
  assert.equal(appearModeOf(null), 'slide');
  assert.equal(appearModeOf(undefined), 'slide');
});

test('appearModeOf: an empty or unparseable field is NOT authored', () => {
  for (const start of ['', null, undefined, 'soon', NaN]) {
    assert.equal(appearModeOf({ start } as MotionBox), 'slide', `start=${String(start)}`);
  }
  // build below 1 is the field's own "no build" value - never a click.
  for (const build of [0, '0', '', -2]) {
    assert.equal(appearModeOf({ build } as MotionBox), 'slide', `build=${String(build)}`);
  }
});

test('appearModeOf: BUILD WINS when a legacy box carries both', () => {
  // The precedence that matters: all three players check `build` first, so a box with a
  // step AND a start has always behaved as a click fragment. Deriving it as `time` would
  // change what already-shared documents do.
  assert.equal(appearModeOf({ build: 1, start: 4, dur: 2, lane: 'seq' }), 'click');
});

// ── 2. the exclusive patch ────────────────────────────────────────────────────

test('setAppear: every mode writes all four fields, so two can never both be set', () => {
  const keys = ['build', 'start', 'dur', 'lane'];
  for (const p of [
    setAppear({}, { mode: 'slide' }),
    setAppear({}, { mode: 'click', step: 2 }),
    setAppear({}, { mode: 'time', startS: 1, durS: 2 }),
  ]) {
    assert.deepEqual(Object.keys(p).sort(), [...keys].sort());
  }
});

test('setAppear clears with the EMPTY STRING, never undefined', () => {
  const p = setAppear({ build: 3, start: 9, dur: 2, lane: 'seq' }, { mode: 'slide' });
  assert.deepEqual(p, { build: '', start: '', dur: '', lane: '' });
  for (const [k, v] of Object.entries(p)) {
    assert.notEqual(v, undefined, `${k} cleared to undefined - the URL column would survive`);
    assert.equal(typeof v, 'string');
  }
});

test('setAppear: click clears the timing, time clears the step', () => {
  const timed = { build: '', start: 4, dur: 2, lane: 'seq' };
  const toClick = setAppear(timed, { mode: 'click', step: 2 });
  assert.deepEqual(toClick, { build: 2, start: '', dur: '', lane: '' });

  const built = { build: 3, start: '', dur: '', lane: '' };
  const toTime = setAppear(built, { mode: 'time', startS: 1.5, durS: 2 });
  assert.deepEqual(toTime, { build: '', start: 1.5, dur: 2, lane: '' });
});

test('setAppear: time PRESERVES the lane - a clip stays a clip, an overlay an overlay', () => {
  assert.equal(setAppear({ lane: 'seq' }, { mode: 'time', startS: 1 }).lane, 'seq');
  assert.equal(setAppear({ lane: '' }, { mode: 'time', startS: 1 }).lane, '');
  assert.equal(setAppear({}, { mode: 'time', startS: 1 }).lane, '');
});

test('setAppear: a step is rounded and floored at 1; an open-ended time clears dur', () => {
  assert.equal(setAppear({}, { mode: 'click', step: 2.4 }).build, 2);
  assert.equal(setAppear({}, { mode: 'click', step: 0 }).build, 1);
  assert.equal(setAppear({}, { mode: 'click' }).build, 1);
  assert.equal(setAppear({}, { mode: 'time', startS: 1, durS: 0 }).dur, '', 'a zero length is open-ended');
  assert.equal(setAppear({ dur: 5 }, { mode: 'time', startS: 1 }).dur, 5, 'an existing length is kept');
});

test('setAppear never mutates its input', () => {
  const b: MotionBox = { build: 3, start: 4, dur: 2, lane: 'seq' };
  const before = JSON.stringify(b);
  setAppear(b, { mode: 'slide' });
  setAppear(b, { mode: 'time', startS: 0 });
  setAppear(b, { mode: 'click', step: 1 });
  assert.equal(JSON.stringify(b), before);
});

test('setAppear round-trips: applying a patch reproduces the mode it was asked for', () => {
  const cases: Array<[MotionBox, Parameters<typeof setAppear>[1]]> = [
    [{}, { mode: 'slide' }],
    [{ build: 2 }, { mode: 'click', step: 4 }],
    [{ start: 3, lane: 'seq' }, { mode: 'time', startS: 2, durS: 1 }],
    [{ build: 9, start: 1, lane: 'seq' }, { mode: 'slide' }],
  ];
  for (const [box, intent] of cases) {
    const next = { ...box, ...setAppear(box, intent) };
    assert.equal(appearModeOf(next), intent.mode, JSON.stringify(intent));
  }
});

test('setAppear REMEMBERS the numbers a mode switch clears, per box id', () => {
  // "On click, step 5" → "With the slide" → "On click" comes back as step 5, not 1. The
  // patch is exclusive, so by the third press the box itself carries nothing: the memory
  // folded in on the FIRST call is the only place the number still exists.
  const box: MotionBox = { id: 'b1', build: 5 };
  const cleared = { ...box, ...setAppear(box, { mode: 'slide' }) };
  assert.equal(cleared.build, '', 'the clear is still exclusive');
  assert.equal(setAppear(cleared, { mode: 'click' }).build, 5);

  // Same for a start and a length.
  const timed: MotionBox = { id: 'b2', start: 12, dur: 3 };
  const off = { ...timed, ...setAppear(timed, { mode: 'slide' }) };
  const back = setAppear(off, { mode: 'time' });
  assert.equal(back.start, 12);
  assert.equal(back.dur, 3);

  // An EXPLICIT number in the intent always wins over the memory.
  assert.equal(setAppear(off, { mode: 'time', startS: 4 }).start, 4);

  // Per box: another row's numbers are not borrowed, and a row with no id remembers
  // nothing at all rather than sharing one anonymous slot.
  assert.equal(setAppear({ id: 'b3' }, { mode: 'click' }).build, 1);
  assert.equal(setAppear({}, { mode: 'click' }).build, 1);
  assert.equal(setAppear({}, { mode: 'time' }).start, 0);
});

test('appearSummary says which of the three it is', () => {
  assert.match(appearSummary({}), /with the slide/i);
  assert.match(appearSummary({ build: 2 }), /step 2/);
  assert.match(appearSummary({ start: 1.5, dur: 2 }), /1\.5/);
  assert.match(appearSummary({ start: 1.5, dur: 2 }), /2/);
  assert.match(appearSummary({ start: 1.5 }), /1\.5/);
});

// ── 3. the deck transition pair ───────────────────────────────────────────────

test('slideTransitionPair: every legal deck value', () => {
  assert.deepEqual(slideTransitionPair('fade'), { enter: 'fade', exit: 'fade' });
  // The pin the comment in the module exists for: an entering slide comes in FROM THE
  // RIGHT (slide-left), so its predecessor departs leftwards - which as a reversed
  // entrance is slide-right. Looks swapped, is not.
  assert.deepEqual(slideTransitionPair('slide'), { enter: 'slide-left', exit: 'slide-right' });
  assert.deepEqual(slideTransitionPair('none'), { enter: 'none', exit: 'none' });

  const morph = slideTransitionPair('morph');
  assert.equal(morph?.enter, 'fade');
  assert.equal(morph?.exit, 'fade');
  assert.ok(morph?.note, 'morph must SAY it was degraded to a crossfade');

  const flight = slideTransitionPair('flight');
  assert.equal(flight?.enter, 'fade');
  assert.equal(flight?.exit, 'fade');
  assert.ok(flight?.note, 'flight must SAY it was degraded to a crossfade');
});

test('slideTransitionPair derives NOTHING for custom, empty or junk', () => {
  assert.equal(slideTransitionPair('custom'), null, 'custom means the timeline owns it');
  assert.equal(slideTransitionPair(''), null, '"" must be resolved to the doc value first');
  assert.equal(slideTransitionPair(null), null);
  assert.equal(slideTransitionPair('constructor'), null);
  assert.equal(slideTransitionPair('zoom-in'), null, 'a box kind is not a deck transition');
});

test('every derived kind is a transition the compositor implements', () => {
  for (const k of ['fade', 'slide', 'morph', 'flight', 'none']) {
    const p = slideTransitionPair(k)!;
    assert.ok(isTransitionKind(p.enter), `${k} enter ${p.enter}`);
    assert.ok(isTransitionKind(p.exit), `${k} exit ${p.exit}`);
  }
});

// ── 4. the two element readers ────────────────────────────────────────────────

test('buildStepsDropped counts DISTINCT steps, not boxes', () => {
  const root = frag(`
    <div class="lolly-box" data-build="1"></div>
    <div class="lolly-box" data-build="1"></div>
    <div class="lolly-box" data-build="2"></div>
    <div class="lolly-box"></div>`);
  assert.equal(buildStepsDropped(root), 2, 'two boxes on step 1 are one click');
});

test('buildStepsDropped: nothing to drop is 0, and junk is not a step', () => {
  assert.equal(buildStepsDropped(frag('<div class="lolly-box"></div>')), 0);
  assert.equal(buildStepsDropped(frag('<div data-build="0"></div><div data-build="x"></div>')), 0);
  assert.equal(buildStepsDropped(null), 0);
});

test('restMsOf: the latest start + enter is the pose a still is taken at', () => {
  const page = frag(`
    <div class="lolly-box" data-t-start="0" data-t-enter="fade" data-t-enter-ms="400"></div>
    <div class="lolly-box" data-t-start="1000" data-t-enter="pop" data-t-enter-ms="600"></div>
    <div class="lolly-box" data-t-start="200"></div>`);
  assert.equal(restMsOf(page), 1600);
});

test('restMsOf: a box with no enter contributes only its start', () => {
  assert.equal(restMsOf(frag('<div data-t-start="900"></div>')), 900);
  assert.equal(restMsOf(frag('<div class="lolly-box"></div>')), 0, 'no timing at all rests at 0');
  assert.equal(restMsOf(null), 0);
});

test('restMsOf adds the SPLIT tail - the last unit gets its own dealt delay', () => {
  // stagger 100 over 4 units is 300 ms of tail before the last unit even starts its
  // own 400 ms enter: splitPhaseWindowMs(100, 4, 400) = 700.
  const units = '<span class="lly-u">a</span><span class="lly-u">b</span><span class="lly-u">c</span><span class="lly-u">d</span>';
  const page = frag(`<div class="lolly-box" data-t-start="0" data-t-enter="fade" data-t-enter-ms="400"
      data-t-split="letter" data-t-stagger="100">${units}</div>`);
  assert.equal(restMsOf(page), 700);
});

test('restMsOf: a keyframe / hold box never drags the page back to its own start', () => {
  // A box that never settles used to be a CEILING on the whole page - the earliest start
  // among the kf/hold boxes won - which meant one decoration decided when every other box
  // on the slide was photographed. The fade below rests at 1400 and still does.
  const page = frag(`
    <div class="lolly-box" data-t-start="1000" data-t-enter="fade" data-t-enter-ms="400"></div>
    <div class="lolly-box" data-t-start="250" data-t-kf="x t0 100"></div>`);
  assert.equal(restMsOf(page), 1400);

  // The case that made it a bug: a scenery box carries a hold with NO start at all, which
  // reads as 0 - so a single gently pulsing shape pinned the page's still to t = 0 and
  // the headline was photographed at opacity 0, a blank board.
  const scenery = frag(`
    <div class="lolly-box" data-t-start="1000" data-t-enter="fade" data-t-enter-ms="400"></div>
    <div class="lolly-box" data-t-hold="pulse"></div>`);
  assert.equal(restMsOf(scenery), 1400);

  // …and a page whose ONLY motion is that decoration still rests at 0: an untimed box has
  // no `data-t-start`, so it contributes nothing to the maximum.
  assert.equal(restMsOf(frag('<div class="lolly-box" data-t-hold="pulse"></div>')), 0);
});

test('restMsOf never returns a negative or fractional ms', () => {
  const page = frag('<div data-t-start="-500" data-t-enter="fade" data-t-enter-ms="100"></div>');
  const v = restMsOf(page);
  assert.ok(v >= 0 && Number.isInteger(v), `got ${v}`);
});

// ─── 6. narrationDwellMs (plans/180 T1-T3) ────────────────────────────────────

test('T1: the dwell is lead-in + narration + tail + exit', () => {
  assert.equal(narrationDwellMs({ narrationMs: 10_000 }), 400 + 10_000 + 600);
  assert.equal(narrationDwellMs({ narrationMs: 10_000, exitMs: 500 }), 400 + 10_000 + 600 + 500);
  // The defaults are the plan's, and they are exported so nothing re-types them.
  assert.equal(NARRATION_LEAD_IN_MS, 400);
  assert.equal(NARRATION_TAIL_MS, 600);
});

test('T2: the slide s own enter motion raises the lead-in, and never lowers it', () => {
  // A 900 ms entrance means the first word waits 900 ms, not 400.
  assert.equal(narrationDwellMs({ narrationMs: 5000, enterMs: 900 }), 900 + 5000 + 600);
  // A 100 ms entrance leaves the 400 ms floor standing.
  assert.equal(narrationDwellMs({ narrationMs: 5000, enterMs: 100 }), 400 + 5000 + 600);
});

test('T3: the exit is added AFTER the tail, so nothing leaves while words are still on', () => {
  const spoken = 8000;
  const dwell = narrationDwellMs({ narrationMs: spoken, enterMs: 400, exitMs: 700 });
  assert.ok(dwell - 700 >= 400 + spoken + 600, 'the exit begins only once the tail has run');
});

test('the authored dwell is a floor, not a target', () => {
  // A slide someone deliberately left up for 30 s stays up for 30 s.
  assert.equal(narrationDwellMs({ narrationMs: 5000, authoredMs: 30_000 }), 30_000);
  // …and a too-short authored value is raised to hold the narration.
  assert.equal(narrationDwellMs({ narrationMs: 5000, authoredMs: 1000 }), 400 + 5000 + 600);
});

test('a slide with nothing to say keeps its authored dwell and gains no padding', () => {
  assert.equal(narrationDwellMs({ narrationMs: 0, authoredMs: 3000 }), 3000);
  assert.equal(narrationDwellMs({ narrationMs: 0 }), 0);
  // Not even the lead-in and tail: "Narrate" must not touch a frame with no notes.
  assert.equal(narrationDwellMs({ narrationMs: 0, enterMs: 900, exitMs: 900, authoredMs: 3000 }), 3000);
});

test('the lead-in and tail are document settings, and a 0 is honoured as a 0', () => {
  assert.equal(narrationDwellMs({ narrationMs: 5000, leadInMs: 1000, tailMs: 2000 }), 1000 + 5000 + 2000);
  assert.equal(narrationDwellMs({ narrationMs: 5000, leadInMs: 0, tailMs: 0 }), 5000);
  // …but an enter motion still holds the words back even at a 0 lead-in.
  assert.equal(narrationDwellMs({ narrationMs: 5000, leadInMs: 0, enterMs: 250 }), 250 + 5000 + 600);
});

test('nonsense in never leaves a NaN in the timeline', () => {
  const bad = [Number.NaN, Number.POSITIVE_INFINITY, -1, undefined];
  for (const v of bad) {
    const n = narrationDwellMs({ narrationMs: v as number, authoredMs: 3000 });
    assert.ok(Number.isInteger(n) && n >= 0, `narrationMs ${String(v)} → ${n}`);
    assert.equal(n, 3000);
  }
  for (const v of bad) {
    const n = narrationDwellMs({ narrationMs: 5000, enterMs: v as number, exitMs: v as number, leadInMs: v as number, tailMs: v as number });
    assert.equal(n, 400 + 5000 + 600, `a bad ${String(v)} falls back to the defaults`);
  }
  assert.equal(narrationDwellMs(null), 0);
  assert.equal(narrationDwellMs(undefined), 0);
  // Fractions round: `dur` reaches the timeline as whole milliseconds.
  assert.ok(Number.isInteger(narrationDwellMs({ narrationMs: 5000.4, enterMs: 33.3 })));
});
