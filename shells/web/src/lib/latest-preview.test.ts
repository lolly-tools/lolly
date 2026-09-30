// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as tick } from 'node:timers/promises';
import { latestPreview } from './latest-preview.ts';

test('a late render never replaces a newer choice; cancellation discards results', async () => {
  const finish: Array<(n: number) => void> = [];
  const ready: number[] = [];
  const signals: AbortSignal[] = [];
  const work = latestPreview<number, number>(async (_, signal) => { signals.push(signal); return new Promise(resolve => finish.push(resolve)); }, { pending() {}, ready: n => { ready.push(n); }, failed: error => { throw error; } }, 0);
  work.update(1); await tick(10);
  work.update(2); await tick(10);
  assert.equal(finish.length, 1, 'renders run serially');
  assert.equal(signals[0]?.aborted, true);
  finish[0]!(1); await tick(10);
  finish[1]!(2); await tick(10);
  assert.deepEqual(ready, [2]);
  work.update(3); await tick(10);
  work.dispose(); finish[2]!(3); await tick(10);
  assert.deepEqual(ready, [2]);
});
