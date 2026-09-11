// SPDX-License-Identifier: MPL-2.0
// Exercise the real editor through its DOM, including persistence and fresh mounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { colorToHex, createTokenSet, deriveBrandTokens } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getExcludedSwatches, seedRampCurve, setRampCurve, walkSwatches } from './brand-doc.ts';
import { draftShades } from './design-system/palette-draft.ts';
import { paletteGroups } from './design-system/palette-groups.ts';

test('colour workspace creates empty groups, moves directly, saves on Enter, previews selection, and restores starter colours', async () => {
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
  const starter = { color: { custom: { ink: { $type: 'color', $value: '#142823', $description: 'Ink' }, paper: { $type: 'color', $value: '#faf5e9', $description: 'Paper' } }, semantic: { primary: { $type: 'color', $value: '{color.custom.ink}' } } } };
  setRampCurve(starter, 'primary', seedRampCurve(deriveBrandTokens({ primary: '#a312bc', steps: 5 }), 'primary', 5));
  let installed: Record<string, unknown> = structuredClone(starter);
  let inFlight = 0, peakWrites = 0;
  const assets = {
    _getBlob: async (id: string) => id === 'lolly/tokens/brand' ? new Blob([JSON.stringify(starter)]) : null,
    _uploadUserAsset: async ({ blob }: { blob: Blob }) => {
      inFlight++; peakWrites = Math.max(peakWrites, inFlight);
      await new Promise(resolve => setTimeout(resolve, 3));
      installed = JSON.parse(await blob.text()); inFlight--;
    },
    _getMeta: async () => null, list: async () => [],
  };
  const host = {
    assets, profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {},
    tokens: { raw: async () => structuredClone(installed), isLocked: async () => false, bust() {}, get: async () => createTokenSet(installed), resolve: async (key: string) => createTokenSet(installed).resolve(key), colors: async () => [] },
  } as unknown as HostV1;
  const root = document.querySelector<HTMLElement>('#studio')!;
  const $ = <T extends Element = HTMLElement>(selector: string): T => {
    const result = root.querySelector<T>(selector); assert.ok(result, selector); return result;
  };
  const click = (selector: string): void => $<HTMLElement>(selector).click();
  const input = (selector: string, value: string): void => { const el = $<HTMLInputElement>(selector); el.value = value; el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); };
  const enter = (selector: string): void => { $(selector).dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); };
  // A fixed 20 ms pause raced the editor's async commit chain on a loaded CI runner (the
  // colour rename produced 'Ink' instead of 'Evening ink'); `until` polls the outcome instead.
  const settle = async (until?: () => boolean): Promise<void> => {
    const deadline = Date.now() + 5000;
    do { await new Promise(resolve => setTimeout(resolve, 20)); } while (until && !until() && Date.now() < deadline);
  };
  let editor: Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>> | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    editor = await mountBrandEditor(root, host); await settle();
    assert.equal(root.querySelectorAll('.be-pal-group--starter [data-be-tile]').length, 2);
    assert.equal($('.be-pal-count').textContent, '2 starter colours');
    assert.doesNotMatch($('[data-be-previews]').innerHTML, /Arial|Helvetica/);
    assert.ok($('[data-be-replace-palette]').closest('details:not([open])'), 'whole-palette rebuilding is an explicit advanced action');
    const beforeDraft = structuredClone(installed);
    input('[data-be-steps]', '5'); await settle();
    assert.deepEqual(installed, beforeDraft, 'changing draft controls saves nothing');
    const expectedShades = draftShades(deriveBrandTokens({ primary: '#142823', steps: 5 }), 'primary');
    assert.equal($('[data-be-add-shade="color.ramp.primary.1"]').getAttribute('title'), expectedShades[0]!.hex, 'saved curves cannot override the starting colour of new shade suggestions');
    assert.equal($('[data-be-replace-palette]').classList.contains('is-active'), false, 'exploration never nags to regenerate');
    $<HTMLDetailsElement>('.be-draft-themes').open = true;
    $('[data-be-ramp="neutral"][data-be-step="2"]').focus();
    click('[data-be-ramp="neutral"][data-be-step="2"]');
    assert.equal($<HTMLDetailsElement>('.be-draft-themes').open, true, 'choosing a theme anchor keeps its disclosure open');
    assert.equal(document.activeElement, $('[data-be-ramp="neutral"][data-be-step="2"]'), 'choosing a theme anchor retains keyboard focus');
    assert.deepEqual(installed, beforeDraft, 'theme examples leave the installed roles intact');
    click('[data-be-replace-palette]');
    assert.equal($('[data-be-review-go]').textContent, 'Apply rebuilt palette');
    assert.deepEqual(installed, beforeDraft, 'reviewing does not apply');
    input('[data-be-steps]', '6');
    assert.equal($<HTMLElement>('[data-be-review]').hidden, true, 'changing settings retires a stale proposal');
    click('[data-be-add-ramp="primary"]'); await settle();
    assert.deepEqual((installed as any).color.semantic, (beforeDraft as any).color.semantic);
    assert.deepEqual((installed as any).color.custom.ink, (beforeDraft as any).color.custom.ink);
    assert.ok(paletteGroups(installed).includes('Primary shades'));
    assert.ok(walkSwatches(installed, 'light').length > 2);
    click('[data-be-undo]'); await settle();
    assert.deepEqual(installed, beforeDraft, 'Undo restores the complete document after adding a shade group');
    click('[data-be-add-shade]:not(:disabled)'); await settle();
    assert.equal(walkSwatches(installed, 'light').filter(s => s.kind !== 'semantic').length, 3, 'a single shade adds exactly one swatch');
    click('[data-be-undo]'); await settle();
    assert.deepEqual(installed, beforeDraft);
    click('[data-be-replace-palette]'); click('[data-be-review-cancel]');
    assert.deepEqual(installed, beforeDraft, 'cancelling a full rebuild leaves the brand intact');
    click('[data-be-replace-palette]'); click('[data-be-review-go]'); await settle();
    assert.notDeepEqual(installed, beforeDraft, 'only the explicit apply button rebuilds the palette');
    const rebuilt = structuredClone(installed);
    document.documentElement.dataset.theme = 'dark'; await settle();
    const darkSurface = colorToHex(createTokenSet(installed, { theme: 'dark' }).resolve('color.semantic.surface'));
    assert.equal($('[data-be-previews] svg[aria-label*="Analytics"] > rect').getAttribute('fill'), darkSurface, 'samples repaint with the active theme roles');
    assert.deepEqual(installed, rebuilt, 'viewing another theme does not rewrite the palette');
    document.documentElement.dataset.theme = 'light'; await settle();
    click('[data-be-review-undo]'); await settle();
    assert.deepEqual(installed, beforeDraft, 'Undo also restores the document after a full rebuild');

    click('[data-be-addgroup]'); input('[data-be-group-form] input', 'Campaign');
    $('[data-be-group-form] form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await settle(); assert.deepEqual(paletteGroups(installed), ['Campaign']);
    assert.equal(root.querySelectorAll('[data-be-group="Campaign"] [data-be-tile]').length, 0);
    click('[data-be-tile="0"]');
    const group = $<HTMLSelectElement>('[data-be-editor-group]'); group.value = 'Campaign'; group.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    input('[data-be-editor-name]', 'Evening ink'); enter('[data-be-editor-name]');
    await settle(() => walkSwatches(installed, 'light')[0]?.name === 'Evening ink');
    assert.equal($<HTMLElement>('[data-be-editor]').hidden, true);
    assert.equal(walkSwatches(installed, 'light')[0]?.name, 'Evening ink');
    assert.ok(root.querySelector('[data-be-group="Campaign"] [data-be-tile]'));
    click('[data-be-select="0"]');
    assert.equal($('[data-be-preview-source]').textContent, '1 selected');
    click('[data-be-scenes] [data-scene="2"]');
    assert.match($('.be-pv:not([hidden]) svg').getAttribute('aria-label') ?? '', /Product card/);
    click('[data-be-hide-starter]'); await settle();
    assert.equal(getExcludedSwatches(installed).length, 1);
    assert.equal(createTokenSet(installed).resolve('color.semantic.primary'), '#142823', 'hiding retains aliases');
    click('[data-be-restore]'); await settle();
    assert.deepEqual(getExcludedSwatches(installed), []);
    // Adding can be cancelled without leaving a placeholder token behind.
    const before = walkSwatches(installed, 'light').length;
    click('[data-be-add]'); click('[data-be-editor-cancel]'); await settle();
    assert.equal(walkSwatches(installed, 'light').length, before);
    editor.teardown(); root.replaceChildren();
    editor = await mountBrandEditor(root, host);
    await settle(() => Boolean(root.querySelector('[data-be-group="Campaign"] [data-be-tile]')));
    assert.ok(root.querySelector('[data-be-group="Campaign"] [data-be-tile]'));
    assert.match($('[data-be-group="Campaign"] .be-pal-name').textContent ?? '', /Evening ink/);
    assert.equal(peakWrites, 1, 'overlapping edit commits are serialized');
  } finally {
    editor?.teardown();
    await settle();
    dom.window.close();
    for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key]; }
  }
});
