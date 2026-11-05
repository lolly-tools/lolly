// SPDX-License-Identifier: MPL-2.0
/**
 * Whole-document saves where the newest wins (lib/latest-save-queue.ts): saves run in
 * order, a superseded one never writes over a newer one, the newest always runs, and a
 * failure never stops the saves queued behind the failed one.
 *
 * Run directly:  node --test shells/web/src/lib/latest-save-queue.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatestSaveQueue } from './latest-save-queue.ts';

/** A save that writes `value` after a gate opens, reporting whether it was superseded first. */
function gatedSave(stored: string[], value: string) {
  let open!: () => void;
  const gate = new Promise<void>((r) => { open = r; });
  let sawSuperseded: boolean | null = null;
  const run = async (superseded: () => boolean): Promise<void> => {
    await gate;
    sawSuperseded = superseded();
    if (!sawSuperseded) stored.push(value);
  };
  return { run, open, seen: () => sawSuperseded };
}

test('one save at a time, in order, when nothing supersedes them', async () => {
  const q = createLatestSaveQueue();
  const stored: string[] = [];
  const a = gatedSave(stored, 'a');
  const done = q.push(a.run);
  a.open();
  await done;
  const b = gatedSave(stored, 'b');
  const doneB = q.push(b.run);
  b.open();
  await doneB;
  assert.deepEqual(stored, ['a', 'b']);
});

test('the drag-and-drag-back case: a superseded save never puts the older order back', async () => {
  const q = createLatestSaveQueue();
  const stored: string[] = [];
  // The keyboard swap has saved. The mouse drag back is still saving when the touch
  // drag queues its own save: the mouse save, told it was superseded, skips its write.
  const keyboard = gatedSave(stored, 'swapped');
  const k = q.push(keyboard.run); keyboard.open(); await k;
  const mouse = gatedSave(stored, 'original');
  q.push(mouse.run);
  await Promise.resolve(); await Promise.resolve();
  const touch = gatedSave(stored, 'swapped again');
  const last = q.push(touch.run);
  mouse.open(); touch.open();
  await last;
  assert.deepEqual(stored, ['swapped', 'swapped again'], 'the mouse order was never written');
  assert.equal(mouse.seen(), true, 'the mouse save ran, saw it was superseded and wrote nothing');
});

test('saves queued behind a running one: only the newest of them runs', async () => {
  const q = createLatestSaveQueue();
  const stored: string[] = [];
  const running = gatedSave(stored, 'running');
  q.push(running.run);
  await Promise.resolve(); await Promise.resolve();
  const middle = gatedSave(stored, 'middle');
  const newest = gatedSave(stored, 'newest');
  q.push(middle.run);
  const last = q.push(newest.run);
  running.open(); middle.open(); newest.open();
  await last;
  assert.equal(middle.seen(), null, 'superseded before it started, so it never ran');
  assert.deepEqual(stored, ['newest']);
});

test('a save already running is told it was superseded, so it can skip its write', async () => {
  const q = createLatestSaveQueue();
  const stored: string[] = [];
  const first = gatedSave(stored, 'first');
  const running = q.push(first.run);
  await Promise.resolve();
  const second = gatedSave(stored, 'second');
  const last = q.push(second.run);
  first.open();
  await running;
  assert.equal(first.seen(), true);
  second.open();
  await last;
  assert.deepEqual(stored, ['second']);
});

test('the newest save always runs, and a failed save never stops the next', async () => {
  const q = createLatestSaveQueue();
  const stored: string[] = [];
  const broken = q.push(async () => { throw new Error('disk full'); });
  await broken;
  await q.push(async () => { stored.push('after'); });
  assert.deepEqual(stored, ['after']);
});
