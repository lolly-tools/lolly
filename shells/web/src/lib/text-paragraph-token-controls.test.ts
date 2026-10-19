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
const typographySet = () => createTokenSet({ heading: { $type: 'typography', $value: { fontFamily: 'Beacon Sans', fontSize: { value: 24, unit: 'px' }, fontWeight: 700, letterSpacing: { value: 0, unit: 'px' }, lineHeight: 1.3 } }, ratio: { $type: 'number', $value: 1.6 } });
function chooseTypography(root: HTMLElement): void {
  const select = root.querySelector<HTMLSelectElement>('select[aria-label="Paragraph property"]')!;
  select.value = 'typography'; select.dispatchEvent(new Event('change'));
}
test('whole typography appears only with a typography port and links the resolved composite', async () => {
  const set = typographySet(), root = document.createElement('div'); document.body.append(root);
  const plain = mountParagraphTokenControls(root, { tokens: { get: async () => set } } as HostV1, () => ({}), () => {});
  assert.equal([...root.querySelectorAll('option')].some(option => option.value === 'typography'), false); plain.destroy();
  const links: unknown[] = [];
  const controls = mountParagraphTokenControls(root, { tokens: { get: async () => set } } as HostV1, () => ({}), () => {}, () => ({}), { read: () => ({ mixed: false }), write: async link => { links.push(link); } });
  try {
    chooseTypography(root);
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick(); await tick();
    const chooser = root.querySelector<HTMLSelectElement>('[data-token-options] select')!;
    assert.deepEqual([...chooser.options].map(option => option.value), ['', 'heading']);
    chooser.value = 'heading'; chooser.dispatchEvent(new Event('change')); await tick(); await tick();
    assert.deepEqual(links, [{ ref: '{heading}', typography: { fontFamily: 'Beacon Sans', fontSize: 24, fontWeight: 700, letterSpacing: 0, lineHeight: 1.3 } }]);
  } finally { controls.destroy(); root.remove(); }
});
test('a missing face is reported in the field and Make custom and Restore each write once', async () => {
  const set = typographySet(), root = document.createElement('div'); document.body.append(root);
  const writes: unknown[] = [];
  let state: { active?: { ref: string; value: string; adapter: 'typography' }; mixed: boolean; restoreRef?: string } = { mixed: false };
  const controls = mountParagraphTokenControls(root, { tokens: { get: async () => set } } as HostV1, () => ({}), () => {}, () => ({}), { read: () => state, write: async link => {
    writes.push(link);
    if (link) throw new Error('No installed face for Beacon Sans. Install the font or choose another token.');
  } });
  try {
    chooseTypography(root);
    root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click(); await tick(); await tick();
    const chooser = root.querySelector<HTMLSelectElement>('[data-token-options] select')!;
    chooser.value = 'heading'; chooser.dispatchEvent(new Event('change')); await tick(); await tick();
    assert.match(root.querySelector('[data-token-message]')!.textContent!, /No installed face for Beacon Sans/);
    state = { active: { ref: '{heading}', value: '{}', adapter: 'typography' }, mixed: false }; controls.refresh();
    assert.match(root.textContent!, /Linked: \{heading\}/);
    root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click(); await tick();
    assert.equal(writes.at(-1), undefined);
    state = { mixed: false, restoreRef: '{heading}' }; controls.refresh();
    root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click(); await tick(); await tick();
    assert.deepEqual((writes.at(-1) as { ref: string }).ref, '{heading}');
    assert.equal(writes.length, 3);
  } finally { controls.destroy(); root.remove(); }
});
