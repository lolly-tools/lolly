// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDocumentSurface } from './document-surface.ts';

type Listener = (event: MessageEvent) => void;

function mount(win: Record<string, unknown>) {
  let listener: Listener | undefined;
  // The listener methods go on the object itself, so a window that is its own parent stays one.
  const w: any = Object.assign(win, { addEventListener: (_: string, fn: Listener) => { listener = fn; }, removeEventListener: () => { listener = undefined; } });
  const surface = { compile: async () => ({ id: 1 }), inspect: async () => ({}), measure: async () => ({}), diff: async () => ({}) };
  const cleanup = installDocumentSurface(w, surface);
  /** Send a compile request and collect the replies with the origin each was addressed to. */
  const ask = async (origin: string, source: unknown) => {
    const replies: Array<{ message: unknown; target: string }> = [];
    const src = source ?? {};
    (src as any).postMessage = (message: unknown, target: string) => replies.push({ message, target });
    listener?.({ data: { type: 'lolly:document', id: 'r1', verb: 'compile', args: [] }, origin, source: src } as any);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return replies;
  };
  return { w, surface, cleanup, ask, listening: () => listener !== undefined };
}

test('document surface installs, answers its own origin, and cleans up', async () => {
  const { w, surface, cleanup, ask, listening } = mount({ location: { origin: 'https://app.test' } });
  assert.equal(w.lolly.document, surface);
  const replies = await ask('https://app.test', {});
  assert.deepEqual(replies, [{ message: { type: 'lolly:document:result', id: 'r1', ok: true, value: { id: 1 } }, target: 'https://app.test' }]);
  cleanup(); assert.equal(w.lolly.document, undefined); assert.equal(listening(), false);
});

test('the page that embeds the app is answered, addressed to its own origin', async () => {
  const parent = {};
  const { ask } = mount({ location: { origin: 'https://app.test' }, parent });
  const replies = await ask('https://portal.example', parent);
  assert.equal(replies.length, 1);
  assert.equal(replies[0]!.target, 'https://portal.example', 'never "*"');
});

test('a page the app frames, an opaque sender or an unknown origin gets nothing', async () => {
  const parent = {};
  const { ask } = mount({ location: { origin: 'https://app.test' }, parent });
  assert.deepEqual(await ask('https://framed-page.example', {}), [], 'a web page box inside the app');
  assert.deepEqual(await ask('null', {}), [], "the Sandbox's opaque preview, where user code runs");
  assert.deepEqual(await ask('', parent), [], 'no origin, even from the parent: a reply would need "*"');
});

test('a top-level app answers nobody but its own origin', async () => {
  const self: any = { location: { origin: 'https://app.test' } };
  self.parent = self;
  const { ask } = mount(self);
  assert.deepEqual(await ask('https://other.example', self), [], 'a window that is its own parent is not embedded');
});
