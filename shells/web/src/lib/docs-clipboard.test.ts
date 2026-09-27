// SPDX-License-Identifier: MPL-2.0
// The docs Copy writer never trusts the unchecked execCommand fallback.
// Run directly:  node --test shells/web/src/lib/docs-clipboard.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docsClipboardWriter } from './docs-clipboard.ts';

function withNavigator(clipboard: unknown, fn: () => Promise<void>): Promise<void> {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { clipboard }, configurable: true });
  return fn().finally(() => { if (desc) Object.defineProperty(globalThis, 'navigator', desc); });
}

test('with the async Clipboard API, the host bridge writes and its outcome is reported', async () => {
  const seen: string[] = [];
  const host = { clipboard: { writeText: async (s: string) => { seen.push(s); } } } as never;
  await withNavigator({ writeText: async () => {} }, async () => {
    await docsClipboardWriter(host)('exact text');
    assert.deepEqual(seen, ['exact text']);
  });
  const refusing = { clipboard: { writeText: () => Promise.reject(new Error('denied')) } } as never;
  await withNavigator({ writeText: async () => {} }, async () => {
    await assert.rejects(docsClipboardWriter(refusing)('x'), /denied/);
  });
});

test('without it, the writer refuses and never reaches the host bridge or execCommand', async () => {
  let bridged = false;
  const host = { clipboard: { writeText: async () => { bridged = true; } } } as never;
  await withNavigator(undefined, async () => {
    await assert.rejects(docsClipboardWriter(host)('x'), /unavailable/);
  });
  assert.equal(bridged, false, 'the bridge would fall back to an unchecked execCommand');
});
