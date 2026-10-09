// SPDX-License-Identifier: MPL-2.0
/** One owned corpus process group, with the existing deadline and bounded teardown. */
import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import type { EventEmitter } from 'node:events';

export const PRODUCT_CORPUS_MS = 120_000;
interface Clock { set(callback: () => void, ms: number): unknown; clear(handle: unknown): void }
const clock: Clock = { set: (callback, ms) => setTimeout(callback, ms), clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>) };
export async function waitOwnedCorpus(child: ChildProcess, dependencies: { signals?: EventEmitter; clock?: Clock; killGroup?: (pid: number, signal: NodeJS.Signals) => void } = {}): Promise<number> {
  assert.ok(Number.isSafeInteger(child.pid) && child.pid! > 0, 'The newly created corpus process group has no valid owner.');
  const signals = dependencies.signals ?? process, timers = dependencies.clock ?? clock;
  const killGroup = dependencies.killGroup ?? ((pid, signal) => {
    try { process.kill(-pid, signal); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  });
  const stop = () => killGroup(child.pid!, 'SIGTERM');
  let interrupt: (() => void) | undefined, timer: unknown;
  const waitExit = () => new Promise<void>(done => {
    if (child.exitCode !== null || child.signalCode !== null) { done(); return; }
    let exitTimer: unknown;
    const finish = () => { timers.clear(exitTimer); child.off('exit', finish); done(); };
    exitTimer = timers.set(finish, 3000); child.once('exit', finish);
  });
  try {
    return await new Promise<number>((done, reject) => {
      interrupt = () => { reject(new Error('Owned product qualification was interrupted.')); stop(); };
      signals.once('SIGINT', interrupt); signals.once('SIGTERM', interrupt);
      timer = timers.set(() => { reject(new Error('The unchanged 120-second corpus deadline expired.')); stop(); }, PRODUCT_CORPUS_MS);
      child.once('exit', status => done(status ?? 1)); child.once('error', reject);
    });
  } finally {
    timers.clear(timer);
    if (interrupt) { signals.off('SIGINT', interrupt); signals.off('SIGTERM', interrupt); }
    stop();
    if (child.exitCode === null && child.signalCode === null) {
      await waitExit();
      if (child.exitCode === null && child.signalCode === null) { killGroup(child.pid!, 'SIGKILL'); await waitExit(); }
      assert.ok(child.exitCode !== null || child.signalCode !== null, 'The owned corpus group did not exit after bounded teardown.');
    }
  }
}
