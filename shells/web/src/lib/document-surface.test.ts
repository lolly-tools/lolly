// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { installDocumentSurface } from './document-surface.ts';

test('document surface installs, answers postMessage, and cleans up', async () => {
  let listener: ((event: MessageEvent) => void) | undefined; const replies: unknown[] = [];
  const win: any = { addEventListener: (_: string, fn: any) => { listener = fn; }, removeEventListener: () => { listener = undefined; } };
  const surface = { compile: async () => ({ id: 1 }), inspect: async () => ({}), measure: async () => ({}), diff: async () => ({}) };
  const cleanup = installDocumentSurface(win, surface);
  assert.equal(win.lolly.document, surface);
  listener?.({ data: { type: 'lolly:document', id: 'r1', verb: 'compile', args: [] }, origin: 'https://embed.test', source: { postMessage: (m: unknown) => replies.push(m) } } as any);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(replies[0], { type: 'lolly:document:result', id: 'r1', ok: true, value: { id: 1 } });
  cleanup(); assert.equal(win.lolly.document, undefined); assert.equal(listener, undefined);
});
