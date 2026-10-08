// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESENT_INTERACT_DEFAULTS, parsePresentInteractDepth, parsePresentInteractOpts,
  serialisePresentInteractOpts, resolvePresentInteractDepth, resolvePresentInteractStops,
  pickPresentInteractStop, samplePresentInteractAuto,
} from '../engine/src/present-interact.ts';

const context = { scrollMax: 2000, boxHeight: 600 };
const near = (value: unknown, expected: number) => assert.ok(typeof value === 'number' && Math.abs(value - expected) < 0.001, `${value} should be near ${expected}`);
const opts = (wire: string) => {
  const parsed = parsePresentInteractOpts(wire);
  assert.ok(parsed, wire);
  return parsed;
};

test('empty wire supplies independent defaults and does not enable interaction', () => {
  const first = opts('');
  assert.deepEqual(first, PRESENT_INTERACT_DEFAULTS);
  first.stops.push(500);
  assert.deepEqual(opts('').stops, []);
  assert.deepEqual(parsePresentInteractOpts(undefined), PRESENT_INTERACT_DEFAULTS);
  assert.equal(serialisePresentInteractOpts({}), '');
});

test('every authored setting survives canonical serialization', () => {
  const authored = {
    highlight: 'spotlight' as const, highlightColor: 'color.role.accent', keys: 'key' as const,
    mode: 'pan' as const, pageLength: 3200, start: '#intro' as const,
    stops: [0, 640, '#pricing', '100%'] as const, walk: true, auto: 'focus' as const,
    from: 80, to: '75%' as const, seconds: 24, ease: 'el', repeat: 'alternate' as const,
    pauseSeconds: 2, hand: true, scrollMs: 450, keep: true,
  };
  const wire = serialisePresentInteractOpts({ ...authored, stops: [...authored.stops] });
  assert.match(wire, /stops=0,640,%23pricing,100%25/);
  assert.deepEqual(opts(wire), { ...authored, stops: [...authored.stops] });
  assert.equal(serialisePresentInteractOpts(opts(wire)), wire);
});

test('numeric settings clamp, while non-finite or malformed numbers refuse the record', () => {
  const parsed = opts('len=1e8;sec=0;pause=-2;ms=100000;start=-4;from=110%25;to=2e8');
  assert.deepEqual([parsed.pageLength, parsed.seconds, parsed.pauseSeconds, parsed.scrollMs, parsed.start, parsed.from, parsed.to],
    [1_000_000, 1, 0, 10_000, 0, '100%', 1_000_000]);
  for (const value of ['NaN', 'Infinity', '-Infinity', '1e999', 'one', '1px', '']) {
    assert.equal(parsePresentInteractOpts(`sec=${value}`), null, value);
  }
});

test('unknown, inherited, duplicate and malformed wire keys refuse the entire record', () => {
  for (const wire of [
    'hl=zoom;unknown=1', '__proto__=x', 'constructor=x', 'toString=x', 'prototype=x',
    'hl=ring;hl=zoom', 'hl=ring;;keys=scroll', '=ring', 'ring', 'hl=%ZZ', 'hl=ring=zoom',
    'hl=constructor', 'hlc=constructor', 'hlc=toString', 'keys=toString', 'mode=__proto__', 'auto=open;hand=true', 'ease=not-an-ease',
  ]) assert.equal(parsePresentInteractOpts(wire), null, wire);
  assert.equal(opts('hl=zoom;').highlight, 'zoom');
  assert.equal(parsePresentInteractOpts({ hl: 'zoom' }), null);
  assert.equal(parsePresentInteractOpts(1), null);
  assert.equal(({} as { polluted?: string }).polluted, undefined);
});

test('engine easing names normalize to their compact tokens without accepting unknown names', () => {
  assert.equal(opts('ease=ease-in-out').ease, 'eio');
  assert.equal(opts('ease=linear').ease, 'el');
  assert.equal(opts('ease=overshoot').ease, 'ev');
  assert.equal(serialisePresentInteractOpts({ ease: 'ease-in-out' }), '');
  assert.equal(parsePresentInteractOpts('ease=constructor'), null);
});

test('the limit counts UTF-8 bytes, not UTF-16 characters', () => {
  assert.equal(parsePresentInteractOpts(`stops=${Array.from({ length: 5 }, () => `#${'é'.repeat(120)}`).join(',')}`), null);
  assert.equal(parsePresentInteractOpts(`hlc=${'a'.repeat(1025)}`), null);
  assert.throws(() => serialisePresentInteractOpts({ stops: Array.from({ length: 33 }, () => 10) }), RangeError);
  assert.throws(() => serialisePresentInteractOpts({ evil: 1 } as never), TypeError);
  assert.throws(() => serialisePresentInteractOpts(Object.create({ highlight: 'zoom' })), TypeError);
});

test('stops are individually decoded and bounded to 32 entries', () => {
  assert.deepEqual(opts('stops=%23part%2Ctwo,50%25,640').stops, ['#part,two', '50%', 640]);
  assert.equal(opts(`stops=${Array.from({ length: 32 }, (_, i) => i).join(',')}`).stops.length, 32);
  assert.equal(parsePresentInteractOpts(`stops=${Array.from({ length: 33 }, (_, i) => i).join(',')}`), null);
  assert.equal(parsePresentInteractOpts('stops=0,,500'), null);
  assert.equal(parsePresentInteractOpts('stops=%ZZ'), null);
});

test('a valid options record close to the byte limit round trips without redundant defaults', () => {
  const wire = `stops=${Array.from({ length: 8 }, (_, index) => `%23${index}${'a'.repeat(115)}`).join(',')}`;
  assert.ok(new TextEncoder().encode(wire).length < 1024);
  const options = opts(wire);
  assert.equal(serialisePresentInteractOpts(options), wire);
});

test('depths distinguish pixels, percentages and safe fragment identifiers', () => {
  assert.equal(parsePresentInteractDepth(640), 640);
  assert.equal(parsePresentInteractDepth(' 50% '), '50%');
  assert.equal(parsePresentInteractDepth('#価格'), '#価格');
  assert.equal(parsePresentInteractDepth('-1%'), '0%');
  assert.equal(parsePresentInteractDepth('120%'), '100%');
  for (const depth of [NaN, Infinity, {}, [], '#', '#two words', '#a#b', '#a\n', '#\ud800', '#\udfff', '640px']) {
    assert.equal(parsePresentInteractDepth(depth), null, String(depth));
  }
});

test('resolution clamps against the real scroll range and leaves places unresolved', () => {
  assert.equal(resolvePresentInteractDepth('50%', context), 1000);
  assert.equal(resolvePresentInteractDepth(3000, context), 2000);
  assert.equal(resolvePresentInteractDepth('#pricing', context), null);
  assert.equal(resolvePresentInteractDepth('50%', { ...context, scrollMax: 0 }), 0);
  assert.equal(resolvePresentInteractDepth(600, { ...context, scrollMax: NaN }), null);
  assert.deepEqual(resolvePresentInteractStops([0, '50%', '#pricing', '100%'], context), [
    { depth: 0, y: 0, index: 0 }, { depth: '50%', y: 1000, index: 1 },
    { depth: '#pricing', y: null, index: 2 }, { depth: '100%', y: 2000, index: 3 },
  ]);
});

test('next and previous stops retain the authored path, including a return upwards', () => {
  const stops = resolvePresentInteractStops([0, 1000, 400, '#pricing', '100%'], context);
  assert.equal(pickPresentInteractStop(stops, 0, -1), null);
  assert.equal(pickPresentInteractStop(stops, '100%', 1), null);
  assert.equal(pickPresentInteractStop(stops, 1000, 1)?.depth, 400);
  assert.equal(pickPresentInteractStop(stops, 400, -1)?.depth, 1000);
  assert.equal(pickPresentInteractStop(stops, '#pricing', 1)?.depth, '100%');
  assert.equal(pickPresentInteractStop(stops, 200, 1)?.depth, 1000);
  assert.equal(pickPresentInteractStop([], 0, 1), null);
});

test('a once-only automatic scroll follows engine easing and holds its destination', () => {
  const options = opts('auto=open;from=0;to=100%25;sec=10;ease=el');
  assert.deepEqual(samplePresentInteractAuto(options, 0, context), { to: 0, done: false, stopIndex: null, paused: false });
  near(samplePresentInteractAuto(options, 2500, context).to, 500);
  assert.equal(samplePresentInteractAuto(options, 5000, context).to, 1000);
  assert.deepEqual(samplePresentInteractAuto(options, 12000, context), { to: '100%', done: true, stopIndex: null, paused: false });
  assert.equal(samplePresentInteractAuto(opts(''), 1000, context).to, 0);
});

test('loop and alternating repeats sample the correct leg at its boundaries', () => {
  const loop = opts('auto=open;to=1000;sec=10;ease=el;rep=loop');
  assert.equal(samplePresentInteractAuto(loop, 10_000, context).to, 0);
  near(samplePresentInteractAuto(loop, 12_500, context).to, 250);
  const alternate = { ...loop, repeat: 'alternate' as const };
  assert.equal(samplePresentInteractAuto(alternate, 10_000, context).to, 1000);
  near(samplePresentInteractAuto(alternate, 12_500, context).to, 750);
  assert.equal(samplePresentInteractAuto(alternate, 20_000, context).to, 0);
});

test('each authored stop pauses, without consuming the authored movement time', () => {
  const options = opts('auto=focus;from=0;to=1000;stops=0,500,1000;sec=10;pause=2;ease=el');
  assert.deepEqual(samplePresentInteractAuto(options, 1000, context), { to: 0, done: false, stopIndex: 0, paused: true });
  assert.equal(samplePresentInteractAuto(options, 4500, context).to, 250);
  assert.deepEqual(samplePresentInteractAuto(options, 7500, context), { to: 500, done: false, stopIndex: 1, paused: true });
  assert.equal(samplePresentInteractAuto(options, 16_000, context).done, true);
  assert.equal(samplePresentInteractAuto(options, 15_000, context).paused, true);
});

test('external pause freezes the supplied elapsed time; reduced motion only jumps at stops', () => {
  const options = opts('auto=open;from=0;to=1000;sec=10;ease=el');
  const paused = samplePresentInteractAuto(options, 9000, context, { pausedAtMs: 2000 });
  near(paused.to, 200);
  assert.deepEqual({ ...paused, to: 200 }, { to: 200, done: false, stopIndex: null, paused: true });
  assert.equal(samplePresentInteractAuto(options, 9000, context, { reducedMotion: true }).to, 0);
  const stops = { ...options, stops: [0, 500, 1000] };
  assert.equal(samplePresentInteractAuto(stops, 4000, context, { reducedMotion: true }).to, 0);
  assert.equal(samplePresentInteractAuto(stops, 6000, context, { reducedMotion: true }).to, 500);
  assert.equal(samplePresentInteractAuto(stops, 10_000, context, { reducedMotion: true }).to, 1000);
});

test('places walk at timed boundaries without pretending to know page geometry', () => {
  const options = opts('auto=open;mode=places;from=%23intro;to=%23end;stops=%23intro,%23middle,%23end;sec=10');
  assert.equal(samplePresentInteractAuto(options, 4999, context).to, '#intro');
  assert.equal(samplePresentInteractAuto(options, 5000, context).to, '#middle');
  assert.equal(samplePresentInteractAuto(options, 10_000, context).to, '#end');
});

test('places auto scrolling uses the authored places when from and to have their defaults', () => {
  const options = opts('auto=open;mode=places;stops=%23intro,%23middle,%23end;sec=10');
  const outside = { scrollMax: 0, boxHeight: 600 };
  assert.equal(samplePresentInteractAuto(options, 0, outside).to, '#intro');
  assert.equal(samplePresentInteractAuto(options, 5000, outside).to, '#middle');
  assert.equal(samplePresentInteractAuto(options, 10000, outside).to, '#end');
  const backwards = { ...options, from: '#end' as const, to: '#intro' as const };
  assert.equal(samplePresentInteractAuto(backwards, 0, outside).to, '#end');
  assert.equal(samplePresentInteractAuto(backwards, 10000, outside).to, '#intro');
});

test('overshoot easing cannot scroll outside the page range', () => {
  const options = opts('auto=open;to=100%25;sec=10;ease=ev');
  for (let time = 0; time <= 10_000; time += 100) {
    const to = resolvePresentInteractDepth(samplePresentInteractAuto(options, time, context).to, context);
    assert.ok(to !== null && to >= 0 && to <= context.scrollMax);
    if (typeof samplePresentInteractAuto(options, time, context).to === 'number') {
      assert.equal(to, samplePresentInteractAuto(options, time, context).to);
    }
  }
});

test('hostile elapsed times stay finite and bounded after parsing', () => {
  const options = opts('auto=open;len=1000000;to=100%25;sec=600;rep=alternate;ease=eb(0.2)(0)(0.8)(1)');
  for (const time of [NaN, Infinity, -Infinity, -100, 0, 1e15]) {
    const sampled = samplePresentInteractAuto(options, time, context);
    assert.ok(typeof sampled.to === 'number' && Number.isFinite(sampled.to));
    assert.ok(sampled.to >= 0 && sampled.to <= 2000);
  }
});
