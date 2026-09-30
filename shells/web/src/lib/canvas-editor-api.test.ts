// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { attachCanvasEditorApi } from './canvas-editor-api.ts';
import { isTrustedSender } from './message-sender.ts';

test('lolly:ui steers the editor only for the app origin and the embedding page', () => {
  const prev = (globalThis as { window?: unknown }).window;
  let listener: ((event: MessageEvent) => void) | undefined;
  const parent = {};
  (globalThis as { window?: unknown }).window = {
    location: { origin: 'https://app.test' },
    parent,
    addEventListener: (_: string, fn: (event: MessageEvent) => void) => { listener = fn; },
    removeEventListener: () => { listener = undefined; },
  };
  try {
    const applied: unknown[] = [];
    const detach = attachCanvasEditorApi({ uiState: () => ({}), applyUi: (s) => applied.push(s) });
    const send = (origin: string, source: unknown) => listener?.({ data: { type: 'lolly:ui', state: { v: 1, sel: ['a'] } }, origin, source } as unknown as MessageEvent);
    send('https://app.test', {});
    send('https://portal.example', parent);
    assert.equal(applied.length, 2, 'own origin and the embedding page are applied');
    send('https://framed-page.example', {});
    send('null', parent);
    assert.equal(applied.length, 2, 'a framed page and an opaque sender change nothing');
    detach();
    assert.equal(listener, undefined);
  } finally {
    (globalThis as { window?: unknown }).window = prev;
  }
});

test('isTrustedSender refuses a missing parent relation and an empty or opaque origin', () => {
  const win = { location: { origin: 'https://app.test' } };
  assert.equal(isTrustedSender({ origin: 'https://app.test' }, win), true);
  assert.equal(isTrustedSender({ origin: 'https://other.example', source: {} }, win), false, 'no parent at all');
  assert.equal(isTrustedSender({ origin: 'null', source: {} }, { ...win, parent: {} }), false);
  assert.equal(isTrustedSender({ origin: undefined }, win), false);
  assert.equal(isTrustedSender({ origin: 'https://app.test' }, {}), false, 'a window with no known origin trusts nobody');
});
