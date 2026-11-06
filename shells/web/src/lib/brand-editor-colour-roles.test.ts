// SPDX-License-Identifier: MPL-2.0
/**
 * The Colour roles table in the real Colours room (plans/352 R2), in jsdom with a fake
 * host that stores what the editor saves. The browser test drives the same room in
 * Chromium; these pin what is cheap to pin here: every state, every refusal and every
 * write, with no server.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/brand-editor-colour-roles.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { colorToHex, createTokenSet, deriveBrandTokens, danglingColourAliases, readColourRoles } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { addLead, leadTokenSet } from './design-system/leads.ts';

type Rec = Record<string, unknown>;

const wefthouse = (): Rec => JSON.parse(readFileSync(new URL('../../../../tests/fixtures/colour-roles/wefthouse.tokens.json', import.meta.url), 'utf8')) as Rec;
const demo = (): Rec => JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8')) as Rec;
const brandSystem = (doc: Rec): Rec => ((doc.$extensions as Rec)['com.suse.lolly'] as Rec).brandSystem as Rec;
const hexIn = (doc: unknown, lead: string | null, mode: string, name: string): unknown => colorToHex(leadTokenSet(doc, { lead, mode }).resolve(`color.semantic.${name}`));

function harness(first: Rec) {
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

  const state = { installed: structuredClone(first), writes: 0 };
  const assets = {
    _getBlob: async (id: string) => id === 'lolly/tokens/brand' ? new Blob([JSON.stringify(first)]) : null,
    _uploadUserAsset: async ({ blob }: { blob: Blob }) => { state.writes += 1; state.installed = JSON.parse(await blob.text()); },
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
    do { await new Promise(resolve => setTimeout(resolve, 15)); } while (until && !until() && Date.now() < deadline);
  };
  const type = (selector: string, value: string): void => {
    const el = $<HTMLInputElement>(selector);
    el.value = value;
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  };
  const choose = (selector: string, value: string): void => {
    const el = $<HTMLSelectElement>(selector);
    el.value = value;
    el.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
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
    dom, host, root, state, $, settle, type, choose, restore,
    click: (selector: string): void => $<HTMLElement>(selector).click(),
    tiles: (): number => root.querySelectorAll('[data-be-tile]').length,
    rows: (): string[] => [...root.querySelectorAll<HTMLInputElement>('[data-crt-name]')].map(i => i.value),
    popover: (): HTMLElement | null => document.querySelector<HTMLElement>('.crt-pick'),
    live: (): string => [...document.querySelectorAll('[aria-live], [role="status"]')].map(el => el.textContent).join(' '),
  };
}

type Editor = Awaited<ReturnType<typeof import('./brand-editor.ts')['mountBrandEditor']>>;

async function withRoom(first: Rec, run: (h: ReturnType<typeof harness>, editor: Editor) => Promise<void>): Promise<void> {
  const h = harness(first);
  let editor: Editor | undefined;
  try {
    const { mountBrandEditor } = await import('./brand-editor.ts');
    editor = await mountBrandEditor(h.root, h.host);
    await h.settle(() => h.tiles() > 0 || !!h.root.querySelector('[data-crt-name]'));
    await run(h, editor);
  } finally {
    editor?.teardown();
    h.restore();
  }
}

test('a declared system opens with its table, its own words, and the chips stepping aside', async () => {
  await withRoom(wefthouse(), async (h) => {
    const fold = h.$<HTMLDetailsElement>('[data-be-roles-fold]');
    assert.equal(fold.open, true);
    assert.deepEqual(h.rows(), ['Main', 'Accent', 'Supporting', 'Tertiary']);
    assert.equal(h.$('[data-crt-row="main"] .crt-value').title, '#1b2a6b');
    assert.equal(h.$<HTMLSelectElement>('[data-crt-reads="main"]').selectedOptions[0]!.textContent, 'Lead colour');
    assert.equal(h.$<HTMLSelectElement>('[data-crt-reads="tertiary"]').selectedOptions[0]!.textContent, 'By name only');
    assert.match(h.$('[data-crt-row="supporting"]').textContent ?? '', /Same as light/);
    assert.match(h.$('[data-crt-row="main"]').textContent ?? '', /Derived/);
    assert.equal(h.root.querySelector('[data-be-role-table] [role="table"]') !== null, true, 'a table in the accessibility tree');
    // The room speaks the system's words everywhere it speaks today.
    const chips = [...h.root.querySelectorAll('.be-rolechip-role')].map(c => c.firstChild?.textContent);
    assert.deepEqual(chips, ['Main', 'Accent', 'Supporting', 'Tertiary', 'Background', 'Text']);
    const strip = [...h.root.querySelectorAll('.be-role-name')].map(c => c.textContent);
    assert.deepEqual(strip, ['Main', 'Accent', 'Background', 'Text', 'Quiet text', 'Hairlines', 'On Main'], 'the fold says every colour, so it lists every colour');
    // The palette holds the roles too, each opening its value rather than its token.
    const tiles = [...h.root.querySelectorAll('[data-be-role-tile]')].map(t => (t as HTMLElement).dataset.beRoleTile);
    assert.deepEqual(tiles, ['main', 'accent', 'supporting', 'tertiary']);
    assert.equal(h.$('[data-be-group="Colour roles"] .be-pal-name').textContent, 'Main');
  });
});

test('the default state stays as it was: shut, today\'s words, and a visit writes nothing', async () => {
  const doc = demo();
  const before = JSON.stringify(doc);
  await withRoom(doc, async (h) => {
    assert.equal(h.$<HTMLDetailsElement>('[data-be-roles-fold]').open, false, 'calm by default');
    assert.deepEqual(h.rows(), ['Primary', 'Secondary', 'Surface', 'Text']);
    assert.deepEqual([...h.root.querySelectorAll('.be-rolechip-role')].map(c => c.firstChild?.textContent), ['Primary', 'Secondary', 'Surface', 'Text']);
    assert.equal(h.root.querySelector('[data-be-role-tile]'), null, 'no roles of its own to list');
    assert.equal(h.root.querySelector('[data-crt-remove]'), null, 'nothing to remove');
    assert.equal(h.root.querySelector('[data-reorder-handle][data-crt-focus]'), null, 'nothing to reorder');
    // Looking around changes nothing.
    h.$<HTMLDetailsElement>('[data-be-roles-fold]').open = true;
    h.click('[data-crt-start-open]');
    h.click('[data-crt-seed="1"]');
    h.click('[data-crt-start-cancel]');
    h.$('[data-crt-value="primary"][data-crt-mode="dark"]').click();
    await h.settle(() => !!h.popover());
    document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await h.settle(() => !h.popover());
    h.click('[data-be-lead-mode="dark"]');
    h.click('[data-be-lead-mode="light"]');
    await h.settle();
    assert.equal(h.state.writes, 0, 'nothing was saved');
    assert.equal(JSON.stringify(h.state.installed), before, 'byte-identical');
  });
});

test('the shipped words as a starting point write nothing, and say so', async () => {
  const doc = demo();
  const before = JSON.stringify(doc);
  await withRoom(doc, async (h) => {
    h.click('[data-crt-start-open]');
    h.click('[data-crt-seed="0"]');
    assert.equal(h.$<HTMLInputElement>('[data-crt-words]').value, 'Primary, Secondary', 'a suggestion fills the field and writes nothing');
    h.click('[data-crt-start-use]');
    await h.settle(() => !h.root.querySelector('[data-crt-words]'));
    assert.equal(h.state.writes, 0);
    assert.equal(JSON.stringify(h.state.installed), before);
    assert.equal(h.root.querySelector('[data-crt-words]'), null, 'and the panel closes');
  });
});

test('starting points on a system with one lead: the words take over, the colourway is not called Main, every colour stays', async () => {
  const doc = deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
  const primary = hexIn(doc, null, 'light', 'primary');
  await withRoom(doc, async (h) => {
    h.click('[data-crt-start-open]');
    h.click('[data-crt-seed="1"]');
    const preview = h.$('[data-crt-start-preview]').textContent ?? '';
    assert.match(preview, /MainLead colour/);
    assert.match(preview, /SupportingBy name only/);
    h.click('[data-crt-start-use]');
    await h.settle(() => readColourRoles(h.state.installed).state === 'declared');
    const reading = readColourRoles(h.state.installed);
    assert.deepEqual(reading.roles.filter(r => r.declared).map(r => [r.label, r.slots]), [['Main', ['primary']], ['Accent', ['secondary']], ['Supporting', []], ['Tertiary', []]]);
    assert.equal(hexIn(h.state.installed, null, 'light', 'primary'), primary, 'the lead colour draws what it drew');
    assert.deepEqual(danglingColourAliases(h.state.installed), []);
    assert.notEqual(((h.state.installed.$themes as Rec[]).find(t => t.group === 'colourway') as Rec).name, 'Main');
    assert.match(h.$('[data-crt-row="supporting"]').textContent ?? '', /Copied/, 'a copied value is marked');
    assert.deepEqual(h.rows(), ['Main', 'Accent', 'Supporting', 'Tertiary']);
  });
});

test('renaming a shipped word declares the vocabulary, and undo puts the document back', async () => {
  const doc = deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
  const before = JSON.stringify(doc);
  await withRoom(doc, async (h) => {
    h.$<HTMLDetailsElement>('[data-be-roles-fold]').open = true;
    h.type('[data-crt-name="primary"]', 'Ground');
    await h.settle(() => readColourRoles(h.state.installed).state === 'declared');
    await h.settle(() => h.rows()[0] === 'Ground');
    assert.deepEqual(h.rows(), ['Ground', 'Secondary']);
    const unfilled = h.$('.crt-unfilled-list').textContent ?? '';
    for (const word of ['Background', 'Text', 'Quiet text', 'Hairlines']) assert.ok(unfilled.includes(word), word);
    h.click('[data-be-undo]');
    await h.settle(() => JSON.stringify(h.state.installed) === before);
    assert.equal(JSON.stringify(h.state.installed), before);
    assert.deepEqual(h.rows(), ['Primary', 'Secondary', 'Surface', 'Text']);
  });
});

test('add, rename, describe, bind, reorder and remove, each through the room\'s one write', async () => {
  await withRoom(wefthouse(), async (h) => {
    // Add.
    h.click('[data-crt-add]');
    h.$<HTMLInputElement>('[data-crt-add-word]').value = 'Selvedge';
    h.click('[data-crt-add-go]');
    await h.settle(() => readColourRoles(h.state.installed).roles.some(r => r.label === 'Selvedge'));
    assert.deepEqual(h.rows().at(-1), 'Selvedge');
    assert.equal(h.$('[data-crt-row="selvedge"] .crt-copied').textContent, 'Copied');
    assert.match(h.$('[data-crt-row="selvedge"]').textContent ?? '', /No tool picks this by itself/);

    // Rename: the id stays and only the word changes.
    h.type('[data-crt-name="selvedge"]', 'Edge band');
    await h.settle(() => readColourRoles(h.state.installed).roles.some(r => r.label === 'Edge band'));
    assert.deepEqual(readColourRoles(h.state.installed).roles.find(r => r.label === 'Edge band')?.id, 'selvedge');
    await h.settle(() => h.rows().at(-1) === 'Edge band');

    // A duplicate word is refused where it was typed, and the document keeps the old one.
    h.type('[data-crt-name="selvedge"]', 'Main');
    await h.settle(() => !!h.root.querySelector('.crt-notice'));
    assert.match(h.$('[data-crt-row="selvedge"] .crt-notice').textContent ?? '', /already called Main/);
    assert.equal(h.$<HTMLInputElement>('[data-crt-name="selvedge"]').value, 'Edge band');

    // Describe.
    h.type('[data-crt-desc="selvedge"]', 'The woven border');
    await h.settle(() => readColourRoles(h.state.installed).roles.find(r => r.id === 'selvedge')?.description === 'The woven border');

    // Bind: each slot takes one role, so Main lets go of the lead colour.
    h.choose('[data-crt-reads="selvedge"]', 'primary');
    await h.settle(() => readColourRoles(h.state.installed).slots.find(s => s.slot === 'primary')?.roleId === 'selvedge');
    await h.settle(() => h.$<HTMLSelectElement>('[data-crt-reads="main"]').value === '');
    assert.equal(h.$<HTMLSelectElement>('[data-crt-reads="main"]').selectedOptions[0]!.textContent, 'By name only');
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'primary'), hexIn(h.state.installed, 'indigo', 'light', 'selvedge'), 'a tool now leads with it');

    // Back to by name only: the slot keeps the colour it drew.
    const drew = hexIn(h.state.installed, 'indigo', 'light', 'primary');
    h.choose('[data-crt-reads="selvedge"]', '');
    await h.settle(() => readColourRoles(h.state.installed).slots.find(s => s.slot === 'primary')?.roleId === null);
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'primary'), drew);
    await h.settle(() => (h.root.querySelector('.crt-unfilled-list')?.textContent ?? '').includes('Lead colour'));
    assert.match(h.$('.crt-unfilled-list').textContent ?? '', /Lead colour/, 'and says it stays as the system defines');

    // Remove: nothing uses it, so one plain confirmation, and the saved-document sentence.
    h.click('[data-crt-remove="selvedge"]');
    assert.match(h.$('.crt-removal').textContent ?? '', /saved Design document/);
    h.click('[data-crt-remove-go="plain"]');
    await h.settle(() => !readColourRoles(h.state.installed).roles.some(r => r.id === 'selvedge'));
    assert.deepEqual(danglingColourAliases(h.state.installed), []);
  });
});

test('a role in use: release is offered only where it is safe, and a house rule holds it', async () => {
  const doc = wefthouse();
  (brandSystem(doc).rules as Rec[])[0]!.roleIds = ['supporting'];
  await withRoom(doc, async (h) => {
    h.click('[data-crt-remove="main"]');
    const inSlot = h.$('.crt-removal').textContent ?? '';
    assert.match(inSlot, /Lolly reads Main as Lead colour/);
    assert.match(inSlot, /saved Design document can use Main by name/);
    assert.ok(h.root.querySelector('[data-crt-remove-go="release"]'), 'letting go is safe here');
    const drew = hexIn(h.state.installed, 'indigo', 'light', 'primary');
    h.click('[data-crt-remove-cancel]');
    assert.equal(h.root.querySelector('.crt-removal'), null);

    h.click('[data-crt-remove="supporting"]');
    assert.match(h.$('.crt-removal').textContent ?? '', /House rules use Supporting: Headlines stay in sentence case/);
    assert.equal(h.root.querySelector('[data-crt-remove-go]'), null, 'no way to remove until the rule changes');
    h.click('[data-crt-remove-cancel]');

    h.click('[data-crt-remove="tertiary"]');
    assert.match(h.$('.crt-removal').textContent ?? '', /A tool field is tied to Tertiary: swatch-card/);
    assert.equal(h.root.querySelector('[data-crt-remove-go]'), null);
    h.click('[data-crt-remove-cancel]');

    h.click('[data-crt-remove="main"]');
    h.click('[data-crt-remove-go="release"]');
    await h.settle(() => !readColourRoles(h.state.installed).roles.some(r => r.id === 'main' && r.declared));
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'primary'), drew, 'the slot keeps the colour it drew');
    assert.deepEqual(danglingColourAliases(h.state.installed), []);
  });
});

test('values: per colourway, "Same as light" a real state, and the rest of the document left alone', async () => {
  const doc = wefthouse();
  await withRoom(doc, async (h) => {
    // The Colourways row chooses whose values these are.
    h.click('[data-be-lead="madder"]');
    await h.settle(() => h.$('[data-crt-row="main"] .crt-value').title === '#8e1f2f');
    assert.equal(h.$('[data-crt-row="main"] .crt-value').title, '#8e1f2f');

    // Same as light, on Madder's Tertiary only.
    h.$('[data-crt-value="tertiary"][data-crt-mode="dark"]').click();
    await h.settle(() => !!h.popover());
    assert.match(h.popover()!.textContent ?? '', /Tertiary in Madder, Dark/);
    (h.popover()!.querySelector('[data-crt-same]') as HTMLElement).click();
    await h.settle(() => /Same as light/.test(h.$('[data-crt-row="tertiary"]').textContent ?? ''));
    assert.equal(hexIn(h.state.installed, 'madder', 'dark', 'tertiary'), hexIn(h.state.installed, 'madder', 'light', 'tertiary'));
    assert.equal(hexIn(h.state.installed, 'weld', 'dark', 'tertiary'), hexIn(doc, 'weld', 'dark', 'tertiary'), 'another colourway is untouched');

    // A palette colour for one look of one colourway.
    h.$('[data-crt-value="accent"][data-crt-mode="light"]').click();
    await h.settle(() => !!h.popover());
    (h.popover()!.querySelector('[data-be-rolepick="color.brand.loom"]') as HTMLElement).click();
    await h.settle(() => hexIn(h.state.installed, 'madder', 'light', 'accent') === '#1c1a17');
    assert.equal(hexIn(h.state.installed, 'madder', 'dark', 'accent'), hexIn(doc, 'madder', 'dark', 'accent'));
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'accent'), hexIn(doc, 'indigo', 'light', 'accent'));
    assert.deepEqual(danglingColourAliases(h.state.installed), []);
    assert.equal(h.$('[data-crt-row="accent"] .crt-value').title, 'Loom', 'a palette colour goes by its name');
  });
});

test('Keep this colour settles a copied value and moves nothing, including one that follows the other look', async () => {
  const added = addLead(wefthouse(), { colour: '#118866', name: 'Emerald' });
  assert.ok(added.ok, added.ok ? '' : added.reasons.join(' '));
  await withRoom(added.doc, async (h) => {
    h.click(`[data-be-lead="${added.id}"]`);
    await h.settle(() => h.$('[data-crt-row="main"] .crt-value').title === '#118866');
    const flags = (key: string): number => h.root.querySelectorAll(`[data-crt-row="${key}"] .crt-copied`).length;
    assert.equal(flags('tertiary'), 2, 'both looks are still copies');
    const dark = hexIn(h.state.installed, added.id!, 'dark', 'tertiary');

    h.$('[data-crt-value="tertiary"][data-crt-mode="dark"]').click();
    await h.settle(() => !!h.popover());
    assert.match(h.popover()!.textContent ?? '', /Copied from Indigo/);
    (h.popover()!.querySelector('[data-crt-keep]') as HTMLElement).click();
    await h.settle(() => flags('tertiary') === 1);
    assert.equal(hexIn(h.state.installed, added.id!, 'dark', 'tertiary'), dark);

    // Supporting's dark follows its light in Indigo, and the copy still does.
    assert.match(h.$('[data-crt-row="supporting"]').textContent ?? '', /Same as light/);
    assert.equal(flags('supporting'), 2);
    h.$('[data-crt-value="supporting"][data-crt-mode="dark"]').click();
    await h.settle(() => !!h.popover());
    (h.popover()!.querySelector('[data-crt-keep]') as HTMLElement).click();
    await h.settle(() => flags('supporting') === 1);
    assert.match(h.$('[data-crt-row="supporting"]').textContent ?? '', /Same as light/, 'it keeps following');
    assert.deepEqual(danglingColourAliases(h.state.installed), []);
  });
});

test('a colour typed into the picker shows while the panel stays open, and one burst is one undo step', async () => {
  const doc = wefthouse();
  await withRoom(doc, async (h) => {
    h.$('[data-crt-value="tertiary"][data-crt-mode="light"]').click();
    await h.settle(() => !!h.popover());
    const field = h.popover()!.querySelector<HTMLElement>('[data-crt-field] [data-color-field]');
    assert.ok(field, 'the studio\'s own picker mounts in the panel');
    const text = field.querySelector<HTMLInputElement>('input[type="text"]');
    assert.ok(text, 'with a field that takes any notation');
    const write = (value: string): void => {
      text.value = value;
      text.dispatchEvent(new h.dom.window.Event('input', { bubbles: true }));
      text.dispatchEvent(new h.dom.window.Event('change', { bubbles: true }));
    };
    write('#00aa88');
    await h.settle(() => hexIn(h.state.installed, 'indigo', 'light', 'tertiary') === '#00aa88');
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'tertiary'), '#00aa88');
    assert.ok(h.popover(), 'the panel stays open');
    await h.settle(() => h.$('[data-crt-value="tertiary"][data-crt-mode="light"]').title === '#00aa88');
    write('#0088aa');
    await h.settle(() => hexIn(h.state.installed, 'indigo', 'light', 'tertiary') === '#0088aa');
    document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await h.settle(() => !h.popover());
    h.click('[data-be-undo]');
    await h.settle(() => hexIn(h.state.installed, 'indigo', 'light', 'tertiary') === hexIn(doc, 'indigo', 'light', 'tertiary'));
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'tertiary'), hexIn(doc, 'indigo', 'light', 'tertiary'), 'one undo goes back past the whole burst');
  });
});

test('the In context preview repaints from the mapping', async () => {
  await withRoom(wefthouse(), async (h) => {
    const poster = (): string => h.$('[data-be-previews] .be-pv').innerHTML.toLowerCase();
    assert.ok(poster().includes('#1b2a6b'), 'Main leads the poster');
    h.choose('[data-crt-reads="tertiary"]', 'primary');
    await h.settle(() => poster().includes('#d9c7a0'));
    assert.ok(poster().includes('#d9c7a0'), 'Tertiary leads it now');
    h.click('[data-be-lead="weld"]');
    await h.settle(() => poster().includes('#efe6c4'));
    assert.ok(poster().includes('#efe6c4'), 'the colourway row repaints it too');
  });
});

test('Use as, and a palette tile, speak the same words', async () => {
  await withRoom(wefthouse(), async (h) => {
    h.$('[data-be-tile]').click();
    await h.settle();
    const words = [...h.root.querySelectorAll('button[data-be-useas]')].map(b => b.textContent);
    assert.deepEqual(words, ['Main', 'Accent', 'Supporting', 'Tertiary', 'Background', 'Text']);
    // Flax is the first tile: give it to Tertiary, by name.
    const tertiary = h.$('button[data-be-useas="role:tertiary"]');
    tertiary.click();
    await h.settle(() => hexIn(h.state.installed, 'indigo', 'light', 'tertiary') === '#faf7f2');
    assert.equal(hexIn(h.state.installed, 'indigo', 'light', 'tertiary'), '#faf7f2');
    assert.equal(hexIn(h.state.installed, 'indigo', 'dark', 'tertiary'), '#a8966f', 'only the look being shown');
    assert.equal(h.$('button[data-be-useas="role:tertiary"]').getAttribute('aria-pressed'), 'true');
    assert.match(h.$('button[data-be-useas="role:tertiary"]').title, /Every colourway needs its own Tertiary/);
    document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await h.settle();

    // A role's tile opens that role's value on the look being shown.
    (h.root.querySelector('[data-be-role-tile="accent"]') as HTMLElement).click();
    await h.settle(() => !!h.popover());
    assert.match(h.popover()!.textContent ?? '', /Accent in Indigo, Light/);
  });
});

test('an undeclared file: its colours can be named, and a name with digits is left alone', async () => {
  const doc = deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
  for (const mode of ['light', 'dark']) {
    const semantic = ((doc[mode] as Rec).color as Rec).semantic as Rec;
    semantic.accent = { $value: '#e05a2b', $type: 'color' };
    semantic['accent-2'] = { $value: '#123456', $type: 'color' };
  }
  await withRoom(doc, async (h) => {
    assert.equal(h.$<HTMLDetailsElement>('[data-be-roles-fold]').open, true, 'colours waiting for words open the fold');
    assert.deepEqual(h.rows(), ['Primary', 'Secondary', 'Surface', 'Text']);
    assert.match(h.$('.crt-tokens').textContent ?? '', /accent-2.*digits/s);
    assert.equal(h.$<HTMLInputElement>('[data-crt-token-word="accent"]').value, 'Accent');
    h.$<HTMLInputElement>('[data-crt-token-word="accent"]').value = 'Ember';
    h.click('[data-crt-name-token="accent"]');
    await h.settle(() => readColourRoles(h.state.installed).state === 'declared');
    const role = readColourRoles(h.state.installed).roles.find(r => r.id === 'accent')!;
    assert.equal(role.label, 'Ember');
    assert.equal(hexIn(h.state.installed, null, 'light', 'accent'), '#e05a2b', 'its colour stayed where it was');
    assert.equal(hexIn(h.state.installed, null, 'light', 'accent-2'), '#123456', 'the other stays by its path');
  });
});

test('an unreadable record: the table shows, the reason is plain, and nothing can be edited', async () => {
  const doc = wefthouse();
  brandSystem(doc).schemaVersion = 99;
  const before = JSON.stringify(doc);
  await withRoom(doc, async (h) => {
    assert.match(h.$('.crt .lp-status').textContent ?? '', /does not validate/);
    assert.equal(h.root.querySelector('[data-crt-name]'), null);
    assert.equal(h.root.querySelector('[data-crt-value]'), null);
    assert.equal(h.root.querySelector('[data-crt-reads]'), null);
    assert.equal(h.root.querySelector('[data-crt-add]'), null);
    assert.equal(h.root.querySelector('[data-crt-remove]'), null);
    assert.match(h.$('.crt').textContent ?? '', /Main/);
    assert.equal(JSON.stringify(h.state.installed), before);
  });
});

test('Escape closes the innermost thing and returns focus', async () => {
  await withRoom(wefthouse(), async (h) => {
    const key = (el: Element, name: string): void => { el.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); };
    // The removal explanation.
    h.click('[data-crt-remove="main"]');
    key(h.$('[data-crt-remove-cancel]'), 'Escape');
    assert.equal(h.root.querySelector('.crt-removal'), null);
    assert.equal((document.activeElement as HTMLElement | null)?.dataset.crtFocus, 'remove:main');
    // The add field.
    h.click('[data-crt-add]');
    assert.equal((document.activeElement as HTMLElement | null)?.dataset.crtFocus, 'add-word');
    key(h.$('[data-crt-add-word]'), 'Escape');
    assert.equal(h.root.querySelector('[data-crt-add-word]'), null);
    assert.equal((document.activeElement as HTMLElement | null)?.dataset.crtFocus, 'add');
    // A half-typed name goes back, and the key stops there.
    const name = h.$<HTMLInputElement>('[data-crt-name="main"]');
    name.value = 'Nope';
    key(name, 'Escape');
    assert.equal(name.value, 'Main');
    // The value picker, through the studio's own ladder.
    h.$('[data-crt-value="main"][data-crt-mode="light"]').click();
    await h.settle(() => !!h.popover());
    document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await h.settle(() => !h.popover());
    assert.equal(h.popover(), null);
  });
});

test('a keyboard reorder writes the brand\'s order and keeps focus on the moved row', async () => {
  await withRoom(wefthouse(), async (h) => {
    const grip = (): HTMLElement => h.$('[data-crt-focus="grip:accent"]');
    grip().focus();
    const press = (name: string): void => { grip().dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })); };
    press(' ');
    assert.equal(grip().getAttribute('aria-pressed'), 'true');
    press('ArrowUp');
    press(' ');
    await h.settle(() => readColourRoles(h.state.installed).roles.filter(r => r.declared)[0]?.id === 'accent');
    assert.deepEqual(readColourRoles(h.state.installed).roles.filter(r => r.declared).map(r => r.id), ['accent', 'main', 'supporting', 'tertiary']);
    assert.deepEqual(h.rows(), ['Accent', 'Main', 'Supporting', 'Tertiary']);
    assert.equal((document.activeElement as HTMLElement | null)?.dataset.crtFocus, 'grip:accent', 'focus stays on the row that moved');
    // Other roles keep their places: the record's Typeface does not move.
    assert.equal(((brandSystem(h.state.installed).roles as Rec[])[0] as Rec).id, 'typeface');
  });
});

test('hostile, long and non-Latin labels stay inert text', async () => {
  const doc = wefthouse();
  const roles = brandSystem(doc).roles as Rec[];
  roles.find(r => r.id === 'main')!.label = '<img src=x onerror=alert(1)>';
  roles.find(r => r.id === 'accent')!.label = '"><script>alert(2)</script>';
  roles.find(r => r.id === 'supporting')!.label = 'القماش 🧵 主色调';
  roles.find(r => r.id === 'tertiary')!.description = '<b>bold</b> {label} $& text';
  await withRoom(doc, async (h) => {
    const table = h.$('[data-be-role-table]');
    assert.equal(table.querySelector('img, script, b'), null, 'no markup survives in the table');
    assert.equal(h.$<HTMLInputElement>('[data-crt-name="main"]').value, '<img src=x onerror=alert(1)>');
    assert.equal(h.$<HTMLInputElement>('[data-crt-name="supporting"]').value, 'القماش 🧵 主色调');
    assert.equal(h.$<HTMLInputElement>('[data-crt-name="supporting"]').getAttribute('dir'), 'auto');
    assert.equal(h.$<HTMLTextAreaElement>('[data-crt-desc="tertiary"]').value, '<b>bold</b> {label} $& text');
    assert.equal(h.root.querySelector('.be-rolechips img, .be-rolechips script'), null, 'nor in the chips');
    assert.equal(h.root.querySelector('.be-pal-group img, .be-pal-group script'), null, 'nor in the palette');
    assert.equal(h.root.querySelector('[data-be-roles] img, [data-be-roles] script'), null, 'nor in the strip');
  });
});

test('a read-only view draws the table with no controls beyond choosing a colourway', async () => {
  const h = harness(wefthouse());
  try {
    const { mountColourRolesReadOnly } = await import('./design-system/rooms/colour-roles.ts');
    const section = document.createElement('section');
    h.root.append(section);
    const room = mountColourRolesReadOnly(section, h.state.installed);
    assert.equal(section.querySelector('h2')?.textContent, 'Colour roles');
    assert.deepEqual([...section.querySelectorAll('.crt-name--read')].map(n => n.textContent), ['Main', 'Accent', 'Supporting', 'Tertiary']);
    for (const control of ['input', 'select', 'textarea', '[data-crt-remove]', '[data-reorder-handle]', '[data-crt-add]', '[data-crt-value]']) assert.equal(section.querySelector(control), null, control);
    assert.match(section.textContent ?? '', /Lead colour/);
    assert.match(section.textContent ?? '', /Same as light/);
    assert.equal(section.querySelectorAll('[data-crt-view]').length, 3, 'looking at another colourway is not editing');
    assert.equal(section.querySelector('.crt-value--read')?.getAttribute('title'), '#1b2a6b');
    (section.querySelector('[data-crt-view="madder"]') as HTMLElement).click();
    assert.equal(section.querySelector('.crt-value--read')?.getAttribute('title'), '#8e1f2f');
    assert.equal(section.querySelector('[data-crt-view="madder"]')?.getAttribute('aria-pressed'), 'true');
    room.destroy();
  } finally {
    h.restore();
  }
});
