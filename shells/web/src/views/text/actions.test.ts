// SPDX-License-Identifier: MPL-2.0
/**
 * views/text/actions.ts runAiAction: a missing Rewriter model is offered in place.
 *
 * Run:  node --import ./tests/css-stub.mjs --test shells/web/src/views/text/actions.test.ts
 *
 * The local model's module and the model offer are stubs through the module's
 * test hook, so no worker, no cache and no sheet are involved.
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/text' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'location', 'history', 'getComputedStyle', 'CustomEvent', 'Event']) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}

const { runAiAction, __setAiActionDepsForTest } = await import('./actions.ts');
type Ctx = import('./context.ts').TextContext;
type Reworder = typeof import('../../lib/reworder.ts');

function rig(status: 'need-download' | 'ready', ensure: (reason: string) => Promise<boolean>): { ctx: Ctx; said: string[]; runs: string[] } {
  const said: string[] = [];
  const runs: string[] = [];
  const root = document.createElement('div');
  root.innerHTML = '<button data-cancel hidden></button>';
  const ctx = {
    root,
    editor: { document: { revision: 1, value: { text: 'Some words to rewrite.', start: 0, end: 0 } } },
    abort: new AbortController(),
    activeJob: null,
    aiAbort: null,
    result: null,
    status: (m: string) => { said.push(m); },
    resultReady: () => { runs.push('ready'); },
  } as unknown as Ctx;
  const reworder = {
    rewordAvailable: () => true,
    rewordStatus: async () => status,
    assistText: (text: string, task: string) => {
      runs.push(`${task}:${text}`);
      return { abort() {}, done: Promise.resolve(['Rewritten words.']) };
    },
  } as unknown as Reworder;
  __setAiActionDepsForTest({ reworder: async () => reworder, ensureReword: ensure });
  return { ctx, said, runs };
}

afterEach(() => { __setAiActionDepsForTest(); });

test('a missing model is offered in place, then the action runs', async () => {
  const asked: string[] = [];
  const { ctx, runs } = rig('need-download', async (reason) => { asked.push(reason); return true; });
  await runAiAction(ctx, 'rewrite');
  assert.deepEqual(asked, ['Rewriting text']);
  assert.deepEqual(runs, ['rewrite:Some words to rewrite.', 'ready']);
  assert.equal(ctx.result?.value.text, 'Rewritten words.');
});

test('Not now leaves the text alone and runs nothing', async () => {
  let asked = 0;
  const { ctx, runs, said } = rig('need-download', async () => { asked++; return false; });
  await runAiAction(ctx, 'synopsis');
  assert.equal(asked, 1);
  assert.deepEqual(runs, []);
  assert.equal(ctx.result, null);
  assert.deepEqual(said, []);
});

test('a model already on this device runs without an offer', async () => {
  let asked = 0;
  const { ctx, runs } = rig('ready', async () => { asked++; return true; });
  await runAiAction(ctx, 'rewrite');
  assert.equal(asked, 0);
  assert.deepEqual(runs, ['rewrite:Some words to rewrite.', 'ready']);
});
