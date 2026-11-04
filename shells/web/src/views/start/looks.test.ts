// SPDX-License-Identifier: MPL-2.0
/**
 * views/start/looks.ts - Find a look.
 *
 * Pins: a click on a look previews it in context and writes nothing; every card
 * carries its own Use this look, which applies that look (with the register held
 * while it runs); Compare is an explicit toggle that reveals the checkboxes; the
 * name appears once per card and every card has a tag line.
 *
 * jsdom with a shimmed <dialog> (the surface components/modal.ts touches) and a
 * stub host whose every write is recorded.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/start/looks.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(
  '<!doctype html><html><body><div id="app"><main id="view"></main></div></body></html>',
  { url: 'https://instance.test/#/start', pretendToBeVisual: true },
);
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as unknown as typeof requestAnimationFrame;
for (const key of ['HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent']) {
  (globalThis as Record<string, unknown>)[key] ??= (dom.window as unknown as Record<string, unknown>)[key];
}
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };
dom.window.HTMLElement.prototype.scrollIntoView = () => { /* layout-free */ };

const { openLooks } = await import('./looks.ts');
const { exampleLooks } = await import('../../lib/design-system/look-library.ts');
type StartCtx = import('./context.ts').StartCtx;

const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));
const settle = async (): Promise<void> => { for (let i = 0; i < 8; i++) await tick(); };

/** A device with one saved system (no tags) beside the starting points. */
function harness() {
  const writes: string[] = [];
  const installs: Array<{ name: string; doc: unknown; busy: string | null }> = [];
  const savedDoc = { color: { semantic: { primary: { $type: 'color', $value: '#003B36' } } }, font: { brand: { $type: 'fontFamily', $value: 'Crossland' } } };
  const rows = async () => [{ id: 'mine', label: 'Lolly Demo', headId: 'mine-head', tags: [] }];
  const host = {
    designSystems: {
      visible: rows, list: rows,
      activeId: async () => 'mine',
      setActive: async (id: string) => { writes.push(`setActive:${id}`); },
      get: async () => null,
      put: async () => { writes.push('put'); },
    },
    assets: { _getBlob: async (id: string) => (id === 'mine-head' ? new Blob([JSON.stringify(savedDoc)]) : null) },
    tokens: { raw: async () => savedDoc },
  };
  const start = {
    looksModal: null,
    host,
    tokens: {
      install: async (doc: unknown, name: string, button: HTMLButtonElement, opts?: { onInstalled?: () => void }) => {
        installs.push({ name, doc, busy: button.closest<HTMLElement>('[data-register]')?.dataset.register ?? null });
        opts?.onInstalled?.();
      },
    },
  } as unknown as StartCtx;
  return { start, writes, installs };
}
const dialog = (): HTMLDialogElement => document.querySelector<HTMLDialogElement>('dialog.ds-looks-modal')!;
const q = <T extends Element = HTMLElement>(sel: string): T | null => dialog().querySelector<T>(sel);
const click = (el: Element | null): void => { assert.ok(el, 'element to click'); el!.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); };

test('a click previews a look in context, and nothing is written', async () => {
  const { start, writes, installs } = harness();
  await openLooks(start);
  await settle();
  // The active system is what the pane shows first.
  assert.equal(q('.ds-looks-preview-name')?.textContent, 'Lolly Demo');
  click(q('[data-look-preview="example:orchard"]'));
  assert.equal(q('.ds-looks-preview-name')?.textContent, 'Orchard');
  assert.equal(q('[data-look-preview="example:orchard"]')?.getAttribute('aria-pressed'), 'true');
  assert.ok(q('[data-look-card="example:orchard"]')?.classList.contains('is-previewing'));
  assert.equal(q('[data-look-preview="mine"]')?.getAttribute('aria-pressed'), 'false');
  // The pane draws the Colours room's scenes in Orchard's primary.
  const orchard = exampleLooks()[0]!.context.colors.find(c => c.path.endsWith('.semantic.primary'))!.value;
  assert.ok(q('.ds-looks-scenes')!.innerHTML.toLowerCase().includes(orchard.toLowerCase()));
  assert.equal(q('[data-looks-status]')?.textContent, 'Previewing Orchard');
  // A scene switch is a preview too.
  click(q('[data-looks-scene="1"]'));
  assert.deepEqual([...dialog().querySelectorAll<HTMLElement>('.ds-looks-scene')].map(f => f.hidden), [true, false, true]);
  assert.deepEqual(writes, []);
  assert.deepEqual(installs, []);
  start.looksModal?.close();
});

test('each card has its own Use this look, which applies that look at the register', async () => {
  const { start, installs } = harness();
  await openLooks(start);
  await settle();
  const cards = [...dialog().querySelectorAll<HTMLElement>('[data-look-card]')];
  assert.equal(cards.length, 4);
  for (const card of cards) {
    const use = card.querySelector<HTMLButtonElement>('[data-look-use]');
    assert.ok(use, `${card.dataset.lookCard} has a Use button`);
    assert.equal(use!.textContent, card.dataset.lookCard === 'mine' ? 'Active' : 'Use this look');
    assert.equal(use!.disabled, card.dataset.lookCard === 'mine');
    // The name appears once (in the specimen), and the card has a tag line.
    assert.equal(card.textContent!.split(card.querySelector('.ds-preview-caption')!.textContent!).length, 2);
    assert.ok(card.querySelector('.ds-look-tagline')!.textContent!.trim(), `${card.dataset.lookCard} has a tag line`);
  }
  assert.equal(q('[data-look-card="mine"] .ds-look-tagline')?.textContent, 'deep · teal · Crossland');
  click(q('[data-look-card="example:sunroom"] [data-look-use]'));
  await settle();
  assert.equal(installs.length, 1);
  assert.equal(installs[0]!.name, 'Sunroom');
  assert.equal(installs[0]!.busy, 'busy', 'the register is held while the look is applied');
  assert.equal(document.querySelector('dialog.ds-looks-modal'), null, 'the dialog closes once applied');
});

test('Compare is an explicit toggle that reveals the checkboxes', async () => {
  const { start, writes, installs } = harness();
  await openLooks(start);
  await settle();
  const toggle = q<HTMLButtonElement>('[data-looks-compare-toggle]')!;
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(dialog().querySelectorAll('[data-look-select]').length, 0, 'no checkboxes until Compare is on');
  click(toggle);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(dialog().querySelectorAll('[data-look-select]').length, 4);
  const check = (id: string): void => {
    const box = q<HTMLInputElement>(`[data-look-select="${id}"]`)!;
    box.checked = true;
    box.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  check('example:orchard');
  check('example:sunroom');
  assert.equal(dialog().querySelectorAll('[data-look-detail]').length, 2);
  check('example:playroom');
  assert.equal(q<HTMLInputElement>('[data-look-select="example:playroom"]')!.checked, false, 'two at a time');
  click(toggle);
  assert.equal(dialog().querySelectorAll('[data-look-select]').length, 0);
  assert.equal(q<HTMLElement>('[data-looks-compare]')!.hidden, true, 'turning Compare off clears the comparison');
  assert.deepEqual(writes, []);
  assert.deepEqual(installs, []);
  start.looksModal?.close();
});
