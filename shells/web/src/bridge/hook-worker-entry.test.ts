// SPDX-License-Identifier: MPL-2.0
/**
 * The hook Worker entry binds ONE message listener per realm, however many times
 * the realm evaluates the file.
 *
 * WebKit evaluates a module Worker's entry script again when a chunk it loads
 * imports that script back by URL, which the production build's geometry-host chunk
 * does. Before the guard, the second evaluation bound a second listener with an
 * empty core: it missed `init`, then answered every invoke "no hook" ahead of the
 * real core, so Snippet and every other Worker-isolated tool rendered without hook
 * output in Safari. Node gives each `?query` its own module instance, which stands
 * in for that second evaluation here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('worker entry: a second evaluation in the same realm binds no second listener', async () => {
  const g = globalThis as Record<string, unknown>;
  const saved = { WorkerGlobalScope: g.WorkerGlobalScope, addEventListener: g.addEventListener, postMessage: g.postMessage };
  const bound: string[] = [];
  g.WorkerGlobalScope = function WorkerGlobalScope() {};
  g.addEventListener = (type: string) => { bound.push(type); };
  g.postMessage = () => {};
  try {
    const entry = new URL('./hook-worker.worker.ts', import.meta.url).href;
    await import(`${entry}?evaluation=first`);
    await import(`${entry}?evaluation=second`);
    assert.deepEqual(bound, ['message']);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete g[key];
      else g[key] = value;
    }
    delete (globalThis as Record<symbol, unknown>)[Symbol.for('lolly.hook-worker.listener')];
  }
});
