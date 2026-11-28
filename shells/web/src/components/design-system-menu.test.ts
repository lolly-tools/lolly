// SPDX-License-Identifier: MPL-2.0
/**
 * The design system menu's colourway row (components/design-system-menu.ts).
 *
 * The menu lists the design systems and, under the active one, the Settings
 * colourway control. Pinned here: the row sits under the active system only, a
 * press saves the choice for that system and leaves the menu open, a system
 * with no colourways shows no row, and the Settings row follows a choice made
 * in the menu.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/design-system-menu.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><head></head><body><button id="trigger">Design system</button></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLSelectElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'CustomEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = cb => { setTimeout(() => cb(0), 0); return 0; };
(globalThis.window as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
// The logo tint decodes a bitmap it can never load here; the painter treats that as no tint.
(globalThis as { Image?: unknown }).Image = undefined;

const { attachDesignSystemMenu } = await import('./design-system-menu.ts');
const { mountColourwayPref } = await import('./colourway-pref.ts');

const demo = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const start = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

type Host = Parameters<typeof attachDesignSystemMenu>[1];

function fakeHost(document: unknown = demo) {
  let record: Record<string, unknown> = {};
  const systems = [{ id: 'starter', label: 'Lolly Starter' }, { id: 'shipped', label: 'Lolly Demo' }];
  return {
    get record() { return record; },
    profile: { get: async () => record, set: async (next: object) => { record = structuredClone(next) as Record<string, unknown>; } },
    tokens: { active: async () => ({ id: 'shipped' }), snapshot: async () => ({ document }), colors: async () => [] },
    designSystems: { list: async () => systems, visible: async () => systems, activeId: async () => 'shipped' },
  };
}

const trigger = (): HTMLElement => document.getElementById('trigger')!;
const menu = (): HTMLElement | null => document.querySelector('.design-system-menu');
const dots = (el: ParentNode): HTMLButtonElement[] => [...el.querySelectorAll<HTMLButtonElement>('.theme-swatch')];
const settle = async (): Promise<void> => { for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0)); };

test('the active system carries its colourways, and a press saves the choice with the menu still open', async () => {
  const host = fakeHost();
  const detach = attachDesignSystemMenu(trigger(), host as unknown as Host);
  try {
    trigger().click();
    await settle();
    const el = menu()!;
    const row = el.querySelector<HTMLElement>('[data-system-colourway]')!;
    assert.equal(row.hidden, false);
    assert.equal(row.previousElementSibling?.getAttribute('data-system'), 'shipped', 'the row sits under the active system');
    assert.equal(el.querySelectorAll('[data-system-colourway]').length, 1);
    assert.equal(dots(row).length, 6);
    assert.equal(el.querySelector('[aria-checked="true"]')?.getAttribute('data-system'), 'shipped', 'the first checked item is still the system');
    dots(row)[2]!.click();
    await settle();
    assert.deepEqual(host.record.colourways, { shipped: 'spring' });
    assert.ok(menu(), 'choosing a colourway does not close the menu');
    assert.equal(dots(menu()!)[2]!.getAttribute('aria-checked'), 'true');
  } finally { detach(); }
  assert.equal(menu(), null);
});

test('a design system with no colourways shows the systems alone', async () => {
  const detach = attachDesignSystemMenu(trigger(), fakeHost(start) as unknown as Host);
  try {
    trigger().click();
    await settle();
    const row = menu()!.querySelector<HTMLElement>('[data-system-colourway]')!;
    assert.equal(row.hidden, true);
    assert.equal(dots(row).length, 0);
    assert.equal(menu()!.querySelectorAll('[data-system]').length, 2);
  } finally { detach(); }
});

test('the Settings row follows a choice made in the menu', async () => {
  const host = fakeHost();
  const settings = document.createElement('div');
  document.body.append(settings);
  const control = mountColourwayPref(settings, { host, look: () => 'light', repaint: async () => {} });
  await control.ready;
  assert.equal(dots(settings)[0]!.getAttribute('aria-checked'), 'true');
  const detach = attachDesignSystemMenu(trigger(), host as unknown as Host);
  try {
    trigger().click();
    await settle();
    dots(menu()!)[5]!.click();
    await settle();
    assert.equal(dots(settings)[5]!.getAttribute('aria-checked'), 'true');
  } finally { detach(); control.destroy(); settings.remove(); }
});
