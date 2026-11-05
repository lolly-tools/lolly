// SPDX-License-Identifier: MPL-2.0
/**
 * The role chips at the top of the Colours room (plan 346 change 7).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/role-chips.test.ts"
 *
 * The chips read the same model as the full roles strip, so these tests pin what
 * is the chips' own: four chips in the strip's order, a plain colour name on a
 * stand-in with "Starter" beside the role, the picker's grouping, and the one
 * thing that matters most - pressing a chip and choosing a swatch re-points the
 * role, and the chip then says so.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createTokenSet } from '@lolly/engine';

const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  url: 'http://localhost/#/start',
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Node = dom.window.Node;
g.Element = dom.window.Element;

const { ROLE_IDS, assignRole, readRoles } = await import('./roles.ts');
const { roleChipsHtml, roleChipsModel, rolePickerHtml, mountRoleChips } = await import('./role-chips.ts');

type Rec = Record<string, unknown>;

/** A single-set import: literal colours, no `color.semantic` group yet. */
const imported = (): Rec => ({
  color: {
    $type: 'color',
    brand: {
      teal: { $value: '#0c322c', $description: 'Teal' },
      sand: { $value: '#f5f1e6', $description: 'Sand' },
    },
    ramp: { neutral: { 1: { $value: '#17191d', $description: 'Ink' }, 9: { $value: '#f8f8f9', $description: 'Paper' } } },
  },
});

const resolverFor = (doc: unknown) => (key: string): unknown => {
  try { return createTokenSet(doc, { theme: 'light' }).resolve(key); } catch { return null; }
};

const OPTIONS = [
  { key: 'color.brand.teal', name: 'Teal', hex: '#0c322c', group: 'Brand' },
  { key: 'color.brand.sand', name: 'Sand', hex: '#f5f1e6', group: 'Brand' },
  { key: 'color.ramp.neutral.1', name: 'Ink', hex: '#17191d', group: 'Neutral', starter: true },
  { key: 'color.ramp.neutral.9', name: 'Paper', hex: '#f8f8f9', group: 'Neutral', starter: true },
];

test('one chip per first decision, in the strip\'s order, escaped', () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  const html = roleChipsHtml(roleChipsModel(doc, 'light', OPTIONS, resolverFor(doc)));
  const ids = [...html.matchAll(/data-be-rolechip="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, [...ROLE_IDS]);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.match(html, /Teal/, 'the primary chip names its colour');
  assert.match(html, /--sw:#0c322c/, 'and paints it');

  const nasty = [{ key: 'color.brand.teal', name: '<img src=x onerror=1>', hex: '#0c322c', group: 'Brand' }];
  const escaped = roleChipsHtml(roleChipsModel(doc, 'light', nasty, resolverFor(doc)));
  assert.equal(escaped.includes('<img src=x'), false, 'a swatch name never reaches the sink raw');
  assert.ok(escaped.includes('&lt;img'));
});

test('a stand-in chip names its colour plainly and says Starter beside the role', () => {
  const doc = imported();
  assignRole(doc, 'text', 'color.ramp.neutral.1');
  const html = roleChipsHtml(roleChipsModel(doc, 'light', OPTIONS, resolverFor(doc)));
  const chip = html.slice(html.indexOf('data-be-rolechip="text"'));
  const body = chip.slice(0, chip.indexOf('</button>'));
  assert.match(html, /class="be-rolechip[^"]*is-starter[^"]*"[^>]*data-be-rolechip="text"/, 'the muted register');
  assert.match(body, /<span class="be-rolechip-val">Ink<\/span>/, 'the visible value is just the name');
  assert.match(body, /be-rolechip-tag">Starter</, 'and the role line says Starter');
  assert.match(html, /aria-label="Text: Starter Ink stands in\. Choose a colour"/, 'the full sentence stays in the accessible name');
});

test('the picker files the person\'s colours first, the starter\'s last, and presses the current one', () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  const html = rolePickerHtml(roleChipsModel(doc, 'light', OPTIONS, resolverFor(doc)), 'primary');
  assert.ok(html.indexOf('>Brand<') < html.indexOf('>Starter<'), 'Starter comes after every own group');
  assert.match(html, /data-be-rolepick="color\.brand\.teal"[^>]*aria-pressed="true"/);
  assert.match(html, /data-be-rolepick="color\.brand\.sand"[^>]*aria-pressed="false"/);
  assert.match(html, /Colour for Primary/);
});

test('choosing a swatch from a chip re-points the role, and the chip then says so', async () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  const mount = document.getElementById('mount')!;
  const assigned: Array<[string, string]> = [];
  let chips: ReturnType<typeof mountRoleChips> | null = null;
  chips = mountRoleChips(mount, {
    doc: () => doc,
    context: () => 'light',
    resolve: resolverFor(doc),
    swatches: () => OPTIONS,
    // Exactly what the room does: write, then repaint through the palette hook.
    assign: (role, key) => { assigned.push([role, key]); assignRole(doc, role, key); chips?.render(); },
  });
  try {
    const chip = mount.querySelector<HTMLButtonElement>('[data-be-rolechip="primary"]')!;
    chip.click();
    const picker = document.querySelector<HTMLElement>('.be-rolepick');
    assert.ok(picker, 'the picker opens on the body');
    assert.equal(picker.getAttribute('role'), 'dialog');
    assert.equal(mount.querySelector('[data-be-rolechip="primary"]')!.getAttribute('aria-expanded'), 'true');

    picker.querySelector<HTMLButtonElement>('[data-be-rolepick="color.brand.sand"]')!.click();
    assert.deepEqual(assigned, [['primary', 'color.brand.sand']]);
    assert.equal(readRoles(doc, 'light').primary.ref, 'color.brand.sand', 'the role now points at the chosen swatch');
    assert.equal(document.querySelector('.be-rolepick'), null, 'the picker closes on a choice');
    const val = mount.querySelector('[data-be-rolechip="primary"] .be-rolechip-val')!.textContent;
    assert.equal(val, 'Sand', 'the chip names the new colour');

    // Choosing the swatch the role already sits on writes nothing.
    mount.querySelector<HTMLButtonElement>('[data-be-rolechip="primary"]')!.click();
    document.querySelector<HTMLButtonElement>('.be-rolepick [data-be-rolepick="color.brand.sand"]')!.click();
    assert.equal(assigned.length, 1, 'no second write for the same choice');
  } finally {
    chips.destroy();
  }
});

test('a second press on the open chip closes its picker', () => {
  const doc = imported();
  const mount = document.getElementById('mount')!;
  const chips = mountRoleChips(mount, {
    doc: () => doc, context: () => 'light', resolve: resolverFor(doc), swatches: () => OPTIONS,
    assign: () => {},
  });
  try {
    const press = (): void => mount.querySelector<HTMLButtonElement>('[data-be-rolechip="surface"]')!.click();
    press();
    assert.ok(document.querySelector('.be-rolepick'));
    assert.equal(chips.isOpen(), true, 'the room reads this to leave Escape to the picker');
    press();
    assert.equal(document.querySelector('.be-rolepick'), null);
    assert.equal(chips.isOpen(), false);
    // Escape closes an open picker and hands focus back to its chip.
    press();
    document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(document.querySelector('.be-rolepick'), null);
    assert.equal(document.activeElement, mount.querySelector('[data-be-rolechip="surface"]'));
  } finally {
    chips.destroy();
  }
});
