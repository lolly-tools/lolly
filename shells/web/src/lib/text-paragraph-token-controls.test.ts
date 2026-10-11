// SPDX-License-Identifier: MPL-2.0
/** Paragraph token actions preserve selection identity during asynchronous lookups. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { mountParagraphTokenControls } from './text-paragraph-token-controls.ts';
const dom = new JSDOM('<body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Event', 'Option', 'AbortController']) Object.defineProperty(globalThis, key, { configurable: true, value: Reflect.get(dom.window, key) });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('same-formatted caret moves dispose pending token actions', async () => {
  const set = createTokenSet({ ratio: { $type: 'number', $value: 1.6 } });
  let finish: (value: typeof set) => void = () => {}, selection = 's:0', writes = 0;
  const pending = new Promise<typeof set>(resolve => { finish = resolve; });
  const root = document.createElement('div'); document.body.append(root);
  const controls = mountParagraphTokenControls(root, { tokens: { get: () => pending } } as HostV1, () => ({ lineHeight: 1.2 }), () => { writes++; }, () => ({ selection }));
  try {
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); selection = 's:4'; controls.refresh(); finish(set); await tick();
    assert.equal(writes, 0); assert.equal(root.querySelector<HTMLElement>('[data-token-options]')!.hidden, true);
  } finally { controls.destroy(); root.remove(); }
});
test('mixed selection can make linked later paragraphs custom without copying a literal', () => {
  const root = document.createElement('div'); document.body.append(root); const commands: unknown[] = [];
  const controls = mountParagraphTokenControls(root, {} as HostV1, () => ({ lineHeight: 2 }), (field, value) => { commands.push([field, value]); }, () => ({ mixed: ['lineHeight'], active: { lineHeight: { ref: '{ratio}', value: 1.4 } } }));
  try {
    assert.match(root.textContent!, /Mixed values/); root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click(); assert.deepEqual(commands, [['lineHeight', undefined]]);
  } finally { controls.destroy(); root.remove(); }
});
