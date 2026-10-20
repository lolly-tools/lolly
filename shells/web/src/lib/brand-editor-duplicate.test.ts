// SPDX-License-Identifier: MPL-2.0
// The Colours room's Duplicate, driven through the real editor's selection bar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTokenSet } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { walkSwatches } from './brand-doc.ts';
import { paletteOrder } from './design-system/palette-order.ts';

const STARTER = { color: { custom: {
  ink: { $type: 'color', $value: '#142823', $description: 'Ink' },
  paper: { $type: 'color', $value: '#faf5e9', $description: 'Paper' },
  moss: { $type: 'color', $value: '#4a7a3a', $description: 'Moss' },
}, semantic: { primary: { $type: 'color', $value: '{color.custom.ink}' } } } };

/** The jsdom globals the editor reads, set for one test and put back when the test ends. */
function browser(): { dom: JSDOM; restore(): void } {
  const dom = new JSDOM('<!doctype html><body><div id="studio"></div></body>', { url: 'http://localhost:5173/#/start?area=color', pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown): void => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLCanvasElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'Option', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMRect', 'XMLSerializer', 'AbortController', 'AbortSignal']) set(key, (dom.window as any)[key]);
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  set('matchMedia', dom.window.matchMedia);
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('CSS', { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`), supports: () => false });
  (dom.window as any).CSS = globalThis.CSS;
  set('fetch', async () => new Response('{}', { status: 404 }));
  Object.defineProperty(dom.window.document, 'fonts', { value: { ready: Promise.resolve(), check: () => true } });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  return {
    dom,
    restore() {
      dom.window.close();
      for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
    },
  };
}

function hostOf(locked = false): { host: HostV1; installed: () => Record<string, unknown> } {
  let installed: Record<string, unknown> = structuredClone(STARTER);
  const assets = {
    _getBlob: async (id: string) => id === 'lolly/tokens/brand' ? new Blob([JSON.stringify(STARTER)]) : null,
    _uploadUserAsset: async ({ blob }: { blob: Blob }) => { installed = JSON.parse(await blob.text()); },
    _getMeta: async () => null, list: async () => [],
  };
  const host = {
    assets, profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {},
    tokens: { raw: async () => structuredClone(installed), isLocked: async () => locked, bust() {}, get: async () => createTokenSet(installed), resolve: async (key: string) => createTokenSet(installed).resolve(key), colors: async () => [] },
  } as unknown as HostV1;
  return { host, installed: () => installed };
}

const settle = async (until?: () => boolean): Promise<void> => {
  const deadline = Date.now() + 5000;
  do { await new Promise(resolve => setTimeout(resolve, 20)); } while (until && !until() && Date.now() < deadline);
};

test('Duplicate on the selection bar copies one or several colours, right after each source', async () => {
  const { dom, restore } = browser();
  const { host, installed } = hostOf();
  const root = document.querySelector<HTMLElement>('#studio')!;
  const names = (): string[] => walkSwatches(installed(), 'light').filter(s => s.kind !== 'semantic').map(s => s.name);
  const select = (name: string): void => {
    const box = root.querySelector<HTMLInputElement>(`[data-be-select][aria-label="Select ${name}"]`);
    assert.ok(box, `checkbox for ${name}`);
    box.click();
  };
  let editor: Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>> | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    editor = await mountBrandEditor(root, host); await settle();
    const bar = root.querySelector<HTMLElement>('[data-be-bulkbar]')!;
    const dup = bar.querySelector<HTMLButtonElement>('[data-be-bulk-dup]');
    assert.equal(dup?.textContent, 'Duplicate', 'the bar offers Duplicate');

    // One colour: the copy opens in the swatch editor, ready to be moved a shade.
    select('Paper');
    assert.equal(bar.hidden, false);
    dup!.click();
    await settle(() => names().includes('Paper copy'));
    const copy = walkSwatches(installed(), 'light').find(s => s.name === 'Paper copy')!;
    assert.equal(copy.raw, '#faf5e9');
    const order = paletteOrder(installed());
    assert.equal(order[order.indexOf('color.custom.paper') + 1], copy.key, 'the copy sits right after Paper');
    assert.equal(root.querySelector<HTMLElement>('[data-be-editor]')!.hidden, false, 'the editor opens on the copy');
    assert.equal(root.querySelector<HTMLInputElement>('[data-be-editor-name]')!.value, 'Paper copy');
    assert.equal(bar.hidden, true, 'the selection gave way to the editor');
    root.querySelector<HTMLButtonElement>('[data-be-editor-done]')?.click();
    await settle();

    // Several: every copy is made and the copies are what is selected now.
    select('Ink'); select('Moss');
    root.querySelector<HTMLButtonElement>('[data-be-bulk-dup]')!.click();
    await settle(() => names().includes('Moss copy'));
    assert.ok(names().includes('Ink copy'));
    assert.equal(root.querySelector('[data-be-bulk-n]')?.textContent, '2 selected');
    const checked = [...root.querySelectorAll<HTMLInputElement>('[data-be-select]')].filter(b => b.checked).map(b => b.getAttribute('aria-label'));
    assert.deepEqual(checked.sort(), ['Select Ink copy', 'Select Moss copy']);

    // One Undo takes the whole batch back.
    const before = names().length;
    root.querySelector<HTMLButtonElement>('[data-be-undo]')!.click();
    await settle(() => names().length === before - 2);
    assert.ok(!names().includes('Ink copy') && !names().includes('Moss copy'));
    assert.ok(names().includes('Paper copy'), 'the earlier duplicate is its own undo step');
  } finally {
    editor?.teardown();
    await settle();
    restore();
    void dom;
  }
});

test('a locked build renders no studio, so Duplicate is never offered', async () => {
  const { restore } = browser();
  const { host, installed } = hostOf(true);
  const root = document.querySelector<HTMLElement>('#studio')!;
  let editor: Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>> | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    editor = await mountBrandEditor(root, host); await settle();
    assert.equal(root.querySelector('[data-be-bulk-dup]'), null);
    assert.ok(root.querySelector('.be-locked'));
    assert.deepEqual(installed(), STARTER, 'nothing is written');
  } finally {
    editor?.teardown();
    await settle();
    restore();
  }
});
