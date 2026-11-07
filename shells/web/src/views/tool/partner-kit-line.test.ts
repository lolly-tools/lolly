// SPDX-License-Identifier: MPL-2.0
/**
 * The partner kit's line in the Design system section, views/tool/partner-kit-line.ts
 * (plans/82 M8): "Partner kit: <company> · revision <n>" with Detach for a piece that
 * carries a kit, "Attach <company>'s kit" for a member whose company has one, and nothing
 * for anyone else. The line shows the section on its own, and its Detach and Attach are
 * changes the session saves.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/partner-kit-line.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://work.example/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'MouseEvent', 'localStorage']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}

const { mountPartnerKitLine } = await import('./partner-kit-line.ts');
const { setPartnerKitOffer } = await import('../../lib/partner-kit-state.ts');
const { attachPieceKit, currentPiece, pieceKit } = await import('../../lib/partner-kit.ts');
const { mountThemeSection } = await import('./theme-section.ts');

const KIT = {
  schemaVersion: 1 as const, id: 'northwind-it', label: 'Northwind IT',
  logos: { light: { id: 'inst/nw-light', version: 2 } },
  colours: [{ role: 'primary' as const, name: 'Northwind blue', value: '#1d4ed8' }],
};
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const host = { assets: {} as never, log: () => {} };
const attach: typeof attachPieceKit = (h, runtime, att) => attachPieceKit(h, runtime, att, { load: async () => KIT as never });

function sectionRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.append(root);
  root.innerHTML = '<details class="input-section" id="theme-section" hidden><summary class="input-section-summary">Design system</summary><div class="input-section-body" id="theme-section-body"></div></details>';
  return root;
}

test('a piece that carries a kit shows its line, opens the section, and Detach is a saved change', async () => {
  const root = sectionRoot();
  const runtime = {};
  let dirty = 0;
  const line = mountPartnerKitLine({ root, host, runtime, attachment: { id: 'inst/k1', revision: 2 }, markDirty: () => { dirty++; }, attach });
  await flush();
  const text = root.querySelector('.partner-kit-line')!.textContent ?? '';
  assert.match(text, /^Partner kit: Northwind IT · revision 2/);
  assert.equal(line.visible(), true);
  const section = root.querySelector<HTMLDetailsElement>('#theme-section')!;
  assert.equal(section.hidden, false, 'the line shows the section on its own');
  assert.equal(section.open, true);
  assert.equal(currentPiece(), runtime, 'the asset picker reads this piece');
  root.querySelector<HTMLButtonElement>('[data-partner-kit="detach"]')!.click();
  assert.equal(pieceKit(runtime), null);
  assert.equal(dirty, 1);
  assert.equal(line.visible(), false, 'nobody else\'s company offers a kit here, so nothing shows after a detach');
  line.destroy();
  assert.equal(root.querySelector('.partner-kit-line'), null);
  assert.equal(currentPiece(), null);
});

test('a member whose company has a kit is offered Attach on a piece with none', async () => {
  setPartnerKitOffer({ id: 'inst/k1', revision: 3, label: 'Northwind IT' });
  try {
    const root = sectionRoot();
    const runtime = {};
    let dirty = 0;
    const line = mountPartnerKitLine({ root, host, runtime, attachment: null, markDirty: () => { dirty++; }, attach });
    const button = root.querySelector<HTMLButtonElement>('[data-partner-kit="attach"]')!;
    assert.equal(button.textContent, 'Attach Northwind IT’s kit');
    button.click();
    await flush();
    assert.deepEqual(pieceKit(runtime), { id: 'inst/k1', revision: 3 }, 'Attach takes the live revision');
    assert.equal(dirty, 1);
    assert.match(root.querySelector('.partner-kit-line')!.textContent ?? '', /revision 3/);
    line.destroy();
  } finally {
    setPartnerKitOffer(null);
  }
});

test('everyone else sees nothing new', () => {
  const root = sectionRoot();
  const line = mountPartnerKitLine({ root, host, runtime: {}, attachment: null, markDirty: () => {}, attach });
  assert.equal(line.visible(), false);
  assert.equal(root.querySelector<HTMLDetailsElement>('#theme-section')!.hidden, true);
  line.destroy();
});

test('the Design system section stays shown for the line when the design system offers no choice', async () => {
  const root = sectionRoot();
  const listeners = new Set<() => void>();
  const controller = { groups: () => [], subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, ready: Promise.resolve() } as never;
  let lineVisible = false;
  const section = mountThemeSection({ root, controller, load: async () => ({ mountThemeChoices: () => ({ destroy() {} }) as never }), extraVisible: () => lineVisible });
  await flush();
  const el = root.querySelector<HTMLDetailsElement>('#theme-section')!;
  assert.equal(el.hidden, true);
  lineVisible = true;
  section.refresh?.();
  assert.equal(el.hidden, false);
  for (const fn of listeners) fn();
  assert.equal(el.hidden, false, 'a controller update does not hide the line');
  section.destroy();
});
