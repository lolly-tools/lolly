// SPDX-License-Identifier: MPL-2.0
/**
 * The temporary Performance UI switch for a constrained device
 * (lib/perf-ui-auto-temporary.ts), driven with synthetic pressure, battery, Save-Data and
 * calm timelines on a synthetic clock, stepped once a second as the wiring would. Pure,
 * so no DOM.
 *
 * Run directly:  node --test shells/web/src/lib/perf-ui-auto-temporary.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONSTRAINT_TIMINGS, ConstraintSwitch, LOW_BATTERY_LEVEL, batteryConstrained, isPressureState, scaledTimings,
  type ConstraintDecision, type Counting, type PressureState,
} from './perf-ui-auto-temporary.ts';

const S = 1000;
const MIN = 60 * S;
/** Past the first seconds after load, so constrained time can count from the start. */
const T0 = 20 * S;
const BROWSE: Counting = { constraint: true, calm: true };
const TOOL: Counting = { constraint: false, calm: true };
const AWAY: Counting = { constraint: false, calm: false };

type Event =
  | { at: number; pressure: PressureState }
  | { at: number; battery: boolean }
  | { at: number; saveData: boolean }
  | { at: number; counting: Counting }
  | { at: number; input: true };

interface Run { sw: ConstraintSwitch; decisions: Array<{ at: number } & ConstraintDecision> }

/** Play `events` (times relative to T0) against a switch, stepping every second up to
 *  `until`, and return every decision with its time (relative to T0). */
function play(events: Event[], until: number, start: Partial<ConstructorParameters<typeof ConstraintSwitch>[0]> = {}): Run {
  const sw = new ConstraintSwitch({ now: T0, sources: { pressure: true, battery: true }, ...start });
  sw.counting(T0, BROWSE);
  sw.battery(T0, false);
  const decisions: Run['decisions'] = [];
  const queue = [...events].sort((a, b) => a.at - b.at);
  for (let t = 0; t <= until; t += S) {
    while (queue.length && queue[0]!.at <= t) {
      const e = queue.shift()!;
      const at = T0 + e.at;
      if ('pressure' in e) sw.pressure(at, e.pressure);
      else if ('battery' in e) sw.battery(at, e.battery);
      else if ('saveData' in e) sw.saveData(at, e.saveData);
      else if ('counting' in e) sw.counting(at, e.counting);
      else sw.input(at);
    }
    const d = sw.step(T0 + t);
    if (d) decisions.push({ at: t, ...d });
  }
  return { sw, decisions };
}

const ons = (r: Run): number[] => r.decisions.filter(d => d.kind === 'on').map(d => d.at);
const offs = (r: Run): number[] => r.decisions.filter(d => d.kind === 'off').map(d => d.at);

// ── The signals ────────────────────────────────────────────────────────────────

test('a low battery counts only while it is discharging, at 20% or less', () => {
  assert.equal(LOW_BATTERY_LEVEL, 0.2);
  assert.equal(batteryConstrained(false, 0.2), true);
  assert.equal(batteryConstrained(false, 0.05), true);
  assert.equal(batteryConstrained(false, 0.21), false);
  assert.equal(batteryConstrained(true, 0.05), false, 'charging is never a constraint');
  assert.equal(batteryConstrained(false, Number.NaN), false);
  assert.equal(batteryConstrained(false, -1), false);
});

test('only the four pressure states are read', () => {
  for (const s of ['nominal', 'fair', 'serious', 'critical']) assert.ok(isPressureState(s));
  for (const s of ['', 'high', null, 3]) assert.equal(isPressureState(s), false);
});

test('the timings: a minute on, five calm minutes back, ten minutes in either state, never under a gesture', () => {
  assert.deepEqual(
    { on: CONSTRAINT_TIMINGS.onMs, saveData: CONSTRAINT_TIMINGS.saveDataOnMs, calm: CONSTRAINT_TIMINGS.calmMs, dwell: CONSTRAINT_TIMINGS.dwellMs, stale: CONSTRAINT_TIMINGS.staleMs, quiet: CONSTRAINT_TIMINGS.quietMs },
    { on: MIN, saveData: 30 * S, calm: 5 * MIN, dwell: 10 * MIN, stale: MIN, quiet: 2 * S },
  );
  assert.ok(CONSTRAINT_TIMINGS.calmMs >= 5 * CONSTRAINT_TIMINGS.onMs, 'strong hysteresis: calm takes five times as long');
  assert.ok(CONSTRAINT_TIMINGS.dwellMs > CONSTRAINT_TIMINGS.calmMs, 'and the dwell outlasts both');
  assert.equal(scaledTimings(20).dwellMs, 30 * S, 'a browser test may divide them');
  assert.deepEqual(scaledTimings(0.5), { ...CONSTRAINT_TIMINGS }, 'never multiply them');
});

// ── On ─────────────────────────────────────────────────────────────────────────

test('sustained serious pressure switches on after a minute', () => {
  const r = play([{ at: 0, pressure: 'serious' }], 3 * MIN);
  assert.deepEqual(ons(r), [MIN]);
  assert.deepEqual(r.decisions[0], { at: MIN, kind: 'on', reason: 'pressure' });
});

test('critical counts like serious; fair and nominal never do', () => {
  assert.deepEqual(ons(play([{ at: 0, pressure: 'critical' }], 2 * MIN)), [MIN]);
  assert.deepEqual(ons(play([{ at: 0, pressure: 'fair' }], 30 * MIN)), []);
  assert.deepEqual(ons(play([{ at: 0, pressure: 'nominal' }], 30 * MIN)), []);
});

test('brief spikes never switch, however many: each calm reading starts the count again', () => {
  // 40 s of 'serious' then 10 s of 'fair', for half an hour.
  const events: Event[] = [];
  for (let t = 0; t < 30 * MIN; t += 50 * S) events.push({ at: t, pressure: 'serious' }, { at: t + 40 * S, pressure: 'fair' });
  const r = play(events, 30 * MIN);
  assert.deepEqual(r.decisions, []);
});

test('a low battery that is not charging switches on, and says so', () => {
  const r = play([{ at: 0, pressure: 'nominal' }, { at: 0, battery: true }], 2 * MIN);
  assert.deepEqual(r.decisions, [{ at: MIN, kind: 'on', reason: 'battery' }]);
});

test('Save-Data alone never switches, but halves the time a constraint must last', () => {
  assert.deepEqual(play([{ at: 0, pressure: 'nominal' }, { at: 0, saveData: true }], 30 * MIN).decisions, []);
  assert.deepEqual(ons(play([{ at: 0, pressure: 'serious' }, { at: 0, saveData: true }], 2 * MIN)), [30 * S]);
});

test('constrained time counts only where it may: not on another screen, not while busy', () => {
  // Serious throughout, but on a tool route (or busy work): Lolly's own work raises pressure too.
  const r = play([{ at: 0, pressure: 'serious' }, { at: 0, counting: TOOL }], 10 * MIN);
  assert.deepEqual(r.decisions, []);
  assert.equal(r.sw.summary().constrainedMs, 0);
});

test('a hidden or unfocused tab counts nothing: the browser stops reporting pressure there', () => {
  const r = play([{ at: 0, pressure: 'serious' }, { at: 0, counting: AWAY }], 10 * MIN);
  assert.deepEqual(r.decisions, []);
});

test('a short break pauses the count; a stretch longer than a minute makes it stale', () => {
  // 50 s counted, 2 s of route settling, 10 s more: 60 s, switches.
  const pause = play([
    { at: 0, pressure: 'serious' },
    { at: 50 * S, counting: TOOL }, { at: 52 * S, counting: BROWSE },
  ], 2 * MIN);
  assert.deepEqual(ons(pause), [62 * S]);
  // 50 s counted, two minutes in a tool, 20 s back on a browse route: the 50 s are stale.
  const stale = play([
    { at: 0, pressure: 'serious' },
    { at: 50 * S, counting: TOOL }, { at: 170 * S, counting: BROWSE },
  ], 4 * MIN);
  assert.deepEqual(ons(stale), [230 * S], 'a full minute again after coming back');
});

test('an unknown pressure (not yet reported) counts as neither constrained nor calm', () => {
  const sw = new ConstraintSwitch({ now: T0, sources: { pressure: true, battery: false } });
  sw.counting(T0, BROWSE);
  assert.equal(sw.step(T0 + 10 * MIN), null);
  assert.equal(sw.summary().now, 'unknown');
  assert.equal(sw.nextStep(T0 + 10 * MIN), null, 'nothing heading towards a change: no timer');
});

test('the look never changes under a gesture: it waits for input to pause', () => {
  const inputs: Event[] = [];
  for (let t = 0; t < 90 * S; t += 500) inputs.push({ at: t, input: true });
  const r = play([{ at: 0, pressure: 'serious' }, ...inputs], 3 * MIN);
  assert.deepEqual(ons(r), [92 * S], 'two seconds after the last input');
});

// ── Back off ───────────────────────────────────────────────────────────────────

test('five minutes of unbroken calm switch it back, once ten minutes have passed since it went on', () => {
  const r = play([{ at: 0, pressure: 'serious' }, { at: 2 * MIN, pressure: 'nominal' }], 20 * MIN);
  assert.deepEqual(ons(r), [MIN]);
  // Calm from 2 min reaches five minutes at 7 min, but the look went on at 1 min.
  assert.deepEqual(offs(r), [11 * MIN], 'the minimum time in the state, not the calm, decides here');
});

test('calm long after the dwell switches back exactly when calm has lasted five minutes', () => {
  const r = play([{ at: 0, pressure: 'serious' }, { at: 15 * MIN, pressure: 'fair' }], 30 * MIN);
  assert.deepEqual(offs(r), [20 * MIN]);
});

test('calm counts on any screen, since nothing Lolly does makes a hot device read calm', () => {
  const r = play([{ at: 0, pressure: 'serious' }, { at: 2 * MIN, pressure: 'nominal' }, { at: 2 * MIN, counting: TOOL }], 20 * MIN);
  assert.deepEqual(offs(r), [11 * MIN]);
});

test('constrained anywhere breaks calm: a device busy on and off stays on the simpler look', () => {
  // Thermal flapping: serious for two minutes, fair for three, for an hour.
  const events: Event[] = [];
  for (let t = 0; t < 60 * MIN; t += 5 * MIN) events.push({ at: t, pressure: 'serious' }, { at: t + 2 * MIN, pressure: 'fair' });
  const r = play(events, 60 * MIN);
  assert.deepEqual(ons(r), [MIN], 'on once');
  assert.deepEqual(offs(r), [], 'and never back while it keeps coming back');
  // Even a constrained reading on another screen breaks the calm count.
  const tool = play([
    { at: 0, pressure: 'serious' }, { at: 2 * MIN, pressure: 'nominal' },
    { at: 6 * MIN, counting: TOOL }, { at: 6 * MIN, pressure: 'serious' }, { at: 6 * MIN + 10 * S, pressure: 'nominal' },
  ], 20 * MIN);
  assert.deepEqual(offs(tool), [6 * MIN + 10 * S + 5 * MIN]);
});

test('a battery that starts charging switches back after the calm period', () => {
  const r = play([{ at: 0, pressure: 'nominal' }, { at: 0, battery: true }, { at: 3 * MIN, battery: false }], 20 * MIN);
  assert.deepEqual(r.decisions.map(d => [d.at, d.kind]), [[MIN, 'on'], [11 * MIN, 'off']]);
});

test('calm pauses while the tab is away, and an unknown reading never counts as calm', () => {
  const r = play([
    { at: 0, pressure: 'serious' }, { at: 15 * MIN, pressure: 'nominal' },
    { at: 17 * MIN, counting: AWAY }, { at: 40 * MIN, counting: BROWSE },
  ], 50 * MIN);
  // Two calm minutes before the tab went away, three after it came back.
  assert.deepEqual(offs(r), [43 * MIN]);
});

// ── No flicker ─────────────────────────────────────────────────────────────────

test('the minimum time in each state holds after switching back too: no quick return', () => {
  const r = play([
    { at: 0, pressure: 'serious' }, { at: 2 * MIN, pressure: 'nominal' },
    { at: 12 * MIN, pressure: 'serious' }, // a minute after switching back at 11 min
  ], 40 * MIN);
  assert.deepEqual(r.decisions.map(d => [d.at / MIN, d.kind]), [[1, 'on'], [11, 'off'], [21, 'on']],
    'back on only once ten minutes have passed since it switched back');
});

test('whatever the readings do, the look changes at most once in ten minutes', () => {
  // A worst case: four hours of states held for 7 seconds to 8 minutes each, from a fixed
  // pseudo-random sequence, with long enough calm now and then to switch back.
  const states: PressureState[] = ['serious', 'nominal', 'critical', 'fair', 'serious', 'nominal', 'fair'];
  const events: Event[] = [];
  let seed = 7;
  const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let t = 0, i = 0; t < 240 * MIN; i++) {
    events.push({ at: t, pressure: states[i % states.length]! });
    t += Math.round(7 + next() * 473) * S;
  }
  const r = play(events, 240 * MIN);
  assert.ok(r.decisions.length >= 4, `not vacuous: ${r.decisions.map(d => `${d.kind}@${d.at / S}s`).join(', ')}`);
  for (let i = 1; i < r.decisions.length; i++) {
    const gap = r.decisions[i]!.at - r.decisions[i - 1]!.at;
    assert.ok(gap >= CONSTRAINT_TIMINGS.dwellMs, `changes ${gap / S} s apart`);
  }
});

test('a temporary look from an earlier session keeps its dwell and switches back on calm', () => {
  // Switched on two minutes before this page started; calm from the start.
  const r = play([{ at: 0, pressure: 'nominal' }], 20 * MIN, { on: true, reason: 'pressure', changedAt: T0 - 2 * MIN });
  assert.deepEqual(offs(r), [8 * MIN], 'ten minutes after it went on, past five of calm');
  // Switched back a minute before this page started: a constraint must wait out the dwell.
  const back = play([{ at: 0, pressure: 'serious' }], 20 * MIN, { changedAt: T0 - MIN });
  assert.deepEqual(ons(back), [9 * MIN]);
});

test('while on, the reason follows the constraint that holds now', () => {
  const r = play([
    { at: 0, pressure: 'nominal' }, { at: 0, battery: true },
    { at: 3 * MIN, battery: false }, { at: 3 * MIN, pressure: 'serious' },
  ], 5 * MIN);
  assert.deepEqual(r.decisions.map(d => d.kind === 'off' ? [d.at, d.kind] : [d.at, d.kind, d.reason]),
    [[MIN, 'on', 'battery'], [3 * MIN, 'reason', 'pressure']]);
});

test('nextStep says when to look again, so the wiring needs no timer while nothing is heading for a change', () => {
  const sw = new ConstraintSwitch({ now: T0, sources: { pressure: true, battery: false } });
  sw.counting(T0, BROWSE);
  sw.pressure(T0, 'nominal');
  assert.equal(sw.nextStep(T0 + S), null, 'calm and off: nothing to time');
  sw.pressure(T0 + S, 'serious');
  assert.equal(sw.nextStep(T0 + 11 * S), T0 + S + MIN, 'the minute the constraint needs');
  sw.input(T0 + 60 * S);
  assert.equal(sw.nextStep(T0 + 60 * S), T0 + 62 * S, 'and the pause after input');
  sw.counting(T0 + 61 * S, TOOL);
  assert.equal(sw.nextStep(T0 + 61 * S), null, 'not counting: events will wake it');
});

test('a signal the browser takes away stops counting as known', () => {
  const sw = new ConstraintSwitch({ now: T0, sources: { pressure: true, battery: true } });
  sw.counting(T0, BROWSE);
  sw.pressure(T0, 'serious');
  sw.unavailable(T0 + S, 'pressure');
  sw.battery(T0 + S, false);
  assert.equal(sw.summary().now, 'calm', 'the battery alone now decides');
  assert.equal(sw.step(T0 + 5 * MIN), null);
});
