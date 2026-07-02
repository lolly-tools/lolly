// SPDX-License-Identifier: MPL-2.0
// The settling policy behind waitForQuiescence, isolated from the DOM so the
// state machine is testable (finding 5 groundwork). Semantics mirror the
// original views/tool.js implementation exactly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQuiescenceGate } from './quiescence.ts';

/** Deterministic manual timer. */
function fakeClock() {
  type Entry = { fn: () => void; at: number; cancelled: boolean };
  const entries: Entry[] = [];
  let now = 0;
  return {
    setTimer(fn: () => void, ms: number): () => void {
      const e: Entry = { fn, at: now + ms, cancelled: false };
      entries.push(e);
      return () => { e.cancelled = true; };
    },
    advance(ms: number): void {
      const target = now + ms;
      // fire in time order, allowing timers scheduled while advancing
      for (;;) {
        const due = entries.filter(e => !e.cancelled && e.at <= target).sort((a, b) => a.at - b.at)[0];
        if (!due) break;
        now = due.at;
        due.cancelled = true;
        due.fn();
      }
      now = target;
    },
    pending(): number { return entries.filter(e => !e.cancelled).length; },
  };
}

function makeGate(opts: { needsReadySignal: boolean; silenceMs?: number; timeoutMs?: number }) {
  const clock = fakeClock();
  let settledCount = 0;
  const gate = createQuiescenceGate(
    { needsReadySignal: opts.needsReadySignal, silenceMs: opts.silenceMs ?? 400, timeoutMs: opts.timeoutMs ?? 8000, setTimer: clock.setTimer },
    { onSettled: () => { settledCount += 1; } },
  );
  return { clock, gate, settled: () => settledCount };
}

test('silence-only mode settles after silenceMs with no activity', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: false });
  assert.equal(gate.settled, false);
  clock.advance(399);
  assert.equal(settled(), 0);
  clock.advance(1);
  assert.equal(settled(), 1);
  assert.equal(gate.settled, true);
});

test('activity resets the silence window', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: false });
  clock.advance(300);
  gate.activity();
  clock.advance(300);
  assert.equal(settled(), 0);
  clock.advance(100);
  assert.equal(settled(), 1);
});

test('ready-signal mode requires BOTH ready and silence', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: true });
  clock.advance(1000); // silent for ages, but not ready
  assert.equal(settled(), 0);
  gate.ready();
  assert.equal(settled(), 1); // already silent → settles immediately on ready
});

test('ready before silence settles once silence arrives', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: true });
  gate.ready();
  gate.activity();
  clock.advance(399);
  assert.equal(settled(), 0);
  clock.advance(1);
  assert.equal(settled(), 1);
});

test('timeout cap settles regardless of readiness or activity', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: true, timeoutMs: 8000 });
  // keep it noisy AND never ready
  for (let t = 0; t < 7900; t += 100) { clock.advance(100); gate.activity(); }
  assert.equal(settled(), 0);
  clock.advance(200);
  assert.equal(settled(), 1);
});

test('onSettled fires exactly once and later events are ignored', () => {
  const { clock, gate, settled } = makeGate({ needsReadySignal: false });
  clock.advance(400);
  assert.equal(settled(), 1);
  gate.activity();
  gate.ready();
  clock.advance(10000);
  assert.equal(settled(), 1);
  assert.equal(gate.settled, true);
});

test('all timers are cancelled after settling', () => {
  const { clock, settled } = makeGate({ needsReadySignal: false });
  clock.advance(400);
  assert.equal(settled(), 1);
  assert.equal(clock.pending(), 0);
});
