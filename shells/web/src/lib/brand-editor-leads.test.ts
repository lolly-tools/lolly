// SPDX-License-Identifier: MPL-2.0
/**
 * The real Colours room on a design system with three colourways (plans/319 A2).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/brand-editor-leads.test.ts"
 *
 * A2 adds no new control, so the bar is that every surface the room already has
 * keeps working once a system has leads: the palette shows exactly the tiles its
 * single-lead self did, the roles strip shows and edits the canonical lead, the
 * unscoped primary writes (first colour, "Use as primary") reach the canonical
 * lead in both modes and no other lead, and Rebuild palette keeps every lead and
 * says so in its review. Where the room cannot do something on a system with
 * leads (rebuild a file that encodes its colourways its own way, clear a lead's
 * own role from "Use as"), it says why on screen. The harness is
 * brand-editor.test.ts's: a jsdom page, a fake host that stores what the editor
 * saves, and the editor's own DOM.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { colorToHex, createTokenSet, deriveBrandTokens } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { addSwatch, walkSwatches } from './brand-doc.ts';
import { readRoles } from './design-system/roles.ts';
import { addLead, listLeads, leadTokenSet } from './design-system/leads.ts';

type Rec = Record<string, unknown>;

/** Three leads, the studio way, over one derived system; plus the system they came from. */
function fixture(): { single: Rec; three: Rec } {
  const single = deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
  const one = addLead(structuredClone(single), { colour: '#e05a2b', name: 'Persimmon', canonical: { name: 'Pine' } });
  assert.ok(one.ok, one.ok ? '' : one.reasons.join(' '));
  const two = addLead(one.doc, { colour: '#0e7490', name: 'Waterhole' });
  assert.ok(two.ok, two.ok ? '' : two.reasons.join(' '));
  return { single, three: two.doc };
}

const links = (doc: Rec): unknown => ['light', 'dark'].map(mode => {
  const semantic = ((doc[mode] as Rec).color as Rec).semantic as Rec;
  return ['primary', 'on-primary', 'secondary'].map(role => (semantic[role] as Rec).$value);
});
const resolveIn = (doc: unknown, lead: string, mode: string, role: string): unknown =>
  leadTokenSet(doc, { lead, mode }).resolve(`color.semantic.${role}`);

/** The room's DOM and a fake host around it: brand-editor.test.ts's harness, shared by the tests below. */
function harness(starter: Rec, first: Rec) {
  const dom = new JSDOM('<!doctype html><body><div id="studio"></div></body>', { url: 'http://localhost:5173/#/start?area=color', pretendToBeVisual: true });
  const original = new Map<string, PropertyDescriptor | undefined>();
  const set = (key: string, value: unknown): void => {
    original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  };
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLImageElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLOptionElement', 'HTMLCanvasElement', 'HTMLDetailsElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'sessionStorage', 'CustomEvent', 'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'Option', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMRect', 'XMLSerializer', 'AbortController', 'AbortSignal']) set(key, (dom.window as any)[key]);
  dom.window.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as any;
  set('matchMedia', dom.window.matchMedia);
  set('ResizeObserver', class { observe() {} disconnect() {} });
  set('CSS', { escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`), supports: () => false });
  (dom.window as any).CSS = globalThis.CSS;
  set('fetch', async () => new Response('{}', { status: 404 }));
  Object.defineProperty(dom.window.document, 'fonts', { value: { ready: Promise.resolve(), check: () => true } });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};

  const state = { installed: structuredClone(first) };
  const assets = {
    _getBlob: async (id: string) => id === 'lolly/tokens/brand' ? new Blob([JSON.stringify(starter)]) : null,
    _uploadUserAsset: async ({ blob }: { blob: Blob }) => { state.installed = JSON.parse(await blob.text()); },
    _getMeta: async () => null, list: async () => [],
  };
  const host = {
    assets, profile: { get: async () => ({}) }, state: { get: async () => null, set: async () => {} }, log() {},
    tokens: { raw: async () => structuredClone(state.installed), isLocked: async () => false, bust() {}, get: async () => createTokenSet(state.installed), resolve: async (key: string) => createTokenSet(state.installed).resolve(key), colors: async () => createTokenSet(state.installed).colors() },
  } as unknown as HostV1;
  const root = document.querySelector<HTMLElement>('#studio')!;
  const $ = <T extends Element = HTMLElement>(selector: string): T => {
    const result = root.querySelector<T>(selector); assert.ok(result, selector); return result;
  };
  const settle = async (until?: () => boolean): Promise<void> => {
    const deadline = Date.now() + 5000;
    do { await new Promise(resolve => setTimeout(resolve, 20)); } while (until && !until() && Date.now() < deadline);
  };
  const restore = (): void => {
    root.replaceChildren();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
    dom.window.close();
  };
  return {
    dom, host, root, state, $, settle, restore,
    click: (selector: string): void => $<HTMLElement>(selector).click(),
    tiles: (): number => root.querySelectorAll('[data-be-tile]').length,
  };
}

test('the Colours room works on three leads: same tiles, canonical edits, and Rebuild keeps every lead', async () => {
  const { single, three } = fixture();
  // The starter is the single-lead system, so its shades are starter colours and
  // the first colour typed in is the person's first own colour.
  const h = harness(structuredClone(single), single);
  const { dom, host, root, $, click, settle, tiles } = h;
  const stripColour = (role: string): string => $(`[data-be-role="${role}"] .be-role-sw`).style.getPropertyValue('--sw');
  const addTyped = (value: string): void => {
    const field = $<HTMLInputElement>('[data-ds-addc-input]');
    field.value = value;
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  };
  const pick = (role: string, key: string): void => {
    const sel = $<HTMLSelectElement>(`[data-be-role-pick="${role}"]`);
    sel.value = key;
    sel.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };

  let editor: Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>> | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    // The single-lead system, shown the way the room has always shown one.
    editor = await mountBrandEditor(root, host); await settle(() => tiles() > 0);
    const singleTiles = tiles();
    const singleStrip = ['primary', 'secondary', 'surface', 'text'].map(stripColour);
    assert.ok(singleTiles > 0);
    editor.teardown(); root.replaceChildren();

    // The same system with three leads shows the same room.
    h.state.installed = structuredClone(three);
    editor = await mountBrandEditor(root, host); await settle(() => tiles() > 0);
    assert.equal(tiles(), singleTiles, 'no colourway colour surfaces as a tile');
    assert.deepEqual(['primary', 'secondary', 'surface', 'text'].map(stripColour), singleStrip, 'the strip shows the canonical lead, which is the system it was lifted from');
    assert.equal($<HTMLOptionElement>('[data-be-role-pick="primary"] option[value=""]').disabled, true, "a lead's primary cannot be emptied");
    assert.equal($<HTMLOptionElement>('[data-be-role-pick="text"] option[value=""]').disabled, false, 'a role every lead shares still can');

    // The first colour typed in becomes the primary of the canonical lead, in both modes.
    addTyped('#ef775d');
    await settle(() => walkSwatches(h.state.installed, 'light').some(s => s.kind === 'custom'));
    const coral = walkSwatches(h.state.installed, 'light').find(s => s.kind === 'custom')!;
    for (const mode of ['light', 'dark']) assert.equal(resolveIn(h.state.installed, 'pine', mode, 'primary'), '#ef775d', `pine ${mode}`);
    assert.deepEqual(links(h.state.installed), links(three), 'the looks still link every role to the colourways');
    const others = (doc: Rec): unknown => ({ persimmon: doc['colourway/persimmon'], waterhole: doc['colourway/waterhole'] });
    assert.deepEqual(others(h.state.installed), others(three), 'the other leads keep their primaries');

    // "Use as primary" on the next colour: the canonical lead again, both modes.
    addTyped('#2a9d8f');
    await settle(() => !root.querySelector<HTMLElement>('[data-be-added-primary]')?.hidden);
    click('[data-be-added-primary]');
    await settle(() => resolveIn(h.state.installed, 'pine', 'dark', 'primary') === '#2a9d8f');
    for (const mode of ['light', 'dark']) assert.equal(resolveIn(h.state.installed, 'pine', mode, 'primary'), '#2a9d8f', `pine ${mode}`);
    assert.deepEqual(others(h.state.installed), others(three));

    // A role picked in the strip is written to the canonical lead's light colours only.
    pick('secondary', coral.key);
    await settle(() => resolveIn(h.state.installed, 'pine', 'light', 'secondary') === '#ef775d');
    assert.equal(resolveIn(h.state.installed, 'pine', 'light', 'secondary'), '#ef775d');
    assert.equal(resolveIn(h.state.installed, 'pine', 'dark', 'secondary'), resolveIn(three, 'pine', 'dark', 'secondary'), 'the dark secondary is untouched');
    assert.deepEqual(links(h.state.installed), links(three));
    assert.deepEqual(others(h.state.installed), others(three));

    // Rebuild palette: the review counts per lead, and applying keeps every lead.
    const beforeRebuild = structuredClone(h.state.installed);
    click('[data-be-replace-palette]');
    const review = $('[data-be-review]').textContent ?? '';
    assert.match(review, /The Pine colourway follows the new starting colour/);
    assert.match(review, /2 other colourways keep their own colours: Persimmon, Waterhole/);
    assert.match(review, /1 kept as assigned/, 'the hand-picked secondary of the canonical lead is kept');
    assert.doesNotMatch(review, /stays as it was|stay as they were/, 'leads added from a colour hold literals, so nothing needs pinning');
    click('[data-be-review-go]');
    await settle(() => JSON.stringify(h.state.installed) !== JSON.stringify(beforeRebuild));
    assert.deepEqual(listLeads(h.state.installed).map(l => [l.id, l.name, l.canonical]), listLeads(three).map(l => [l.id, l.name, l.canonical]));
    assert.deepEqual(listLeads(h.state.installed).slice(1).map(l => l.colours), listLeads(three).slice(1).map(l => l.colours), 'Persimmon and Waterhole look exactly as they did');
    assert.deepEqual(((h.state.installed.$themes as Rec[]).filter(t => t.group === 'colourway')), ((beforeRebuild.$themes as Rec[]).filter(t => t.group === 'colourway')), 'every colourway entry is kept as it was');
    assert.deepEqual(((h.state.installed.$metadata as Rec).tokenSetOrder as string[]).filter(s => s.startsWith('colourway/')), ['colourway/pine', 'colourway/persimmon', 'colourway/waterhole']);
    assert.equal(resolveIn(h.state.installed, 'pine', 'light', 'secondary'), '#ef775d', "the canonical lead's hand-picked secondary survives");
    assert.ok(!walkSwatches(h.state.installed, 'light').some(s => s.key.startsWith('color.colourway.')), 'still no colourway tiles after the rebuild');

    // Undo puts the whole document back, leads and all.
    click('[data-be-review-undo]');
    await settle(() => JSON.stringify(h.state.installed) === JSON.stringify(beforeRebuild));
    assert.deepEqual(h.state.installed, beforeRebuild);

    // Dark mode shows the canonical lead's dark colours.
    document.documentElement.dataset.theme = 'dark'; await settle();
    assert.equal(stripColour('primary'), '#2a9d8f');
    assert.equal(stripColour('surface'), colorToHex(resolveIn(h.state.installed, 'pine', 'dark', 'surface')));
    document.documentElement.dataset.theme = 'light'; await settle();
  } finally {
    editor?.teardown();
    h.restore();
  }
});

test('the room says why it cannot: a refused rebuild shows its reason, and a lead\'s own role in Use as explains instead of clearing', async () => {
  const { single, three } = fixture();
  // A second set turned on for one lead: Lolly can choose between these
  // colourways but no longer knows where that lead's colours live, so a rebuild
  // would lose them.
  const foreign = structuredClone(three);
  ((foreign.$themes as Rec[]).find(t => t.id === 'persimmon')!.selectedTokenSets as Rec).base = 'enabled';
  const h = harness(structuredClone(single), foreign);
  const { root, $, click, settle, tiles } = h;
  let editor: Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>> | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    editor = await mountBrandEditor(root, h.host); await settle(() => tiles() > 0);
    const before = JSON.stringify(h.state.installed);
    click('[data-be-replace-palette]');
    const review = $('[data-be-review]');
    assert.equal(review.hidden, false, 'the card is on screen, not only in the screen-reader region');
    assert.match(review.textContent ?? '', /Couldn't rebuild the palette/);
    assert.match($('[data-be-review-reason]').textContent ?? '', /encodes its colourways its own way/);
    assert.equal(root.querySelector('[data-be-review-go]'), null, 'nothing to apply');
    const assertive = (): string => [...document.querySelectorAll('[aria-live="assertive"]')].map(el => el.textContent).join(' ');
    await settle(() => /Couldn't rebuild the palette/.test(assertive()));
    assert.match(assertive(), /Couldn't rebuild the palette/, 'and a screen reader hears it');
    click('[data-be-review-cancel]');
    assert.equal(review.hidden, true);
    assert.equal(JSON.stringify(h.state.installed), before, 'nothing was written');
    editor.teardown(); root.replaceChildren();

    // The studio's own three leads: open the tile that is the canonical lead's
    // secondary, whose "Use as Secondary" button is pressed.
    h.state.installed = structuredClone(three);
    editor = await mountBrandEditor(root, h.host); await settle(() => tiles() > 0);
    const secondary = (): HTMLElement => $('[data-be-useas="secondary"]');
    for (const tile of root.querySelectorAll<HTMLElement>('[data-be-tile]')) {
      tile.click();
      if (secondary().getAttribute('aria-pressed') === 'true') break;
    }
    assert.equal(secondary().getAttribute('aria-pressed'), 'true', 'found the tile that is the secondary');
    assert.equal(secondary().getAttribute('aria-disabled'), 'true', "a lead's own role is not a toggle");
    assert.match(secondary().title, /Every colourway needs its own Secondary/);
    const hint = $('[data-be-useas-hint]');
    assert.equal(hint.hidden, true);
    const ref = readRoles(h.state.installed, { lead: null, mode: 'light' }).secondary.ref;
    secondary().click();
    await settle();
    assert.equal(hint.hidden, false, 'pressing it says why on screen');
    assert.match(hint.textContent ?? '', /Every colourway needs its own Secondary\. To change this one, use another colour as Secondary\./);
    assert.equal(secondary().getAttribute('aria-pressed'), 'true', 'the role is still this colour');
    assert.equal(readRoles(h.state.installed, { lead: null, mode: 'light' }).secondary.ref, ref, 'and the design system still says so');
    assert.equal(root.querySelector<HTMLElement>('[data-be-undo]')?.hidden ?? true, true, 'no undo step for a change that did not happen');
    // A role every lead shares stays an ordinary toggle.
    for (const role of ['surface', 'text']) assert.equal(root.querySelector(`[data-be-useas="${role}"]`)?.getAttribute('aria-disabled'), null, role);
  } finally {
    editor?.teardown();
    h.restore();
  }
});

test('Rebuild palette on a single-lead system hands the fresh derive back untouched', async () => {
  // brand-editor.test.ts drives the single-lead flow through the DOM and checks
  // that its review mentions no colourway; here, the carry itself changes nothing.
  const { carryLeads } = await import('./design-system/leads.ts');
  const single = deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
  addSwatch(single, 'custom', 'Coral', '#ef775d');
  const fresh = deriveBrandTokens({ primary: '#7a1fa2', name: 'Rebuilt' }) as Rec;
  const before = JSON.stringify(fresh);
  const carried = carryLeads(single, fresh);
  assert.ok(carried.ok && carried.canonical === null && carried.kept.length === 0);
  assert.equal(JSON.stringify(carried.ok ? carried.doc : null), before, 'the fresh derive is handed back untouched');
});
