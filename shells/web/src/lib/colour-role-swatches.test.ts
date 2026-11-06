// SPDX-License-Identifier: MPL-2.0
/**
 * What a colour field offers (plans/352 R3). A system that declares colour roles leads
 * with them in its own words and order, and the copies that would repeat a role stay out.
 * A system that declares none gets the list and the markup it has always had, which is
 * checked here byte for byte against the markup the field drew before roles existed.
 *
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/colour-role-swatches.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createTokenSet, readColourRoles, renameColourRole } from '@lolly/engine';
import type { ColorSwatch } from '@lolly-tools/core/host-v1';
import { colourFieldOptions, declaresColourRoles, roleSwatchOptions } from './colour-role-swatches.ts';
import { colourRoleWord, linkedColourWord, setColourRoleWords } from './colour-role-words.ts';
import { designInputColorValue } from './design-color.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'CustomEvent', 'getComputedStyle', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const { colorFieldHtml, colorVarLabel, setSwatches, swatchName, wireColorField } = await import('../components/color-field.ts');

type Rec = Record<string, any>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const WEFTHOUSE = (): Rec => load('../../../../tests/fixtures/colour-roles/wefthouse.tokens.json');
const DEMO = (): Rec => load('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = (): Rec => load('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

const hostOf = (doc: unknown, selection: Record<string, string> = {}): { host: never; swatches: ColorSwatch[] } => ({
  host: { tokens: { snapshot: async () => ({ document: doc, system: null, version: null, selection: {} }) } } as never,
  swatches: createTokenSet(doc, { selection }).colors() as ColorSwatch[],
});

/** The markup the field drew for a plain swatch before colour roles existed, written out in full. */
function legacyButtons(id: string, list: ReadonlyArray<{ value: string; wide?: string; label?: string | null; group?: string | null; ref?: string | null }>): string[] {
  return list.map((s) => {
    const name = s.label || s.value;
    return [s.wide ?? s.value, s.ref ?? '', name, s.group && s.label ? `${s.group} · ${s.label}` : name, id].join('|');
  });
}

const openGrid = (id = 'cf'): HTMLElement => {
  const host = document.createElement('div');
  document.body.replaceChildren(host);
  host.innerHTML = colorFieldHtml(id, '#123456', { float: true });
  wireColorField(host, { onChange: (field, value) => { picked.push([field, value]); } });
  host.querySelector<HTMLElement>('.color-trigger')!.click();
  return host.querySelector<HTMLElement>('.color-swatches')!;
};
const picked: unknown[] = [];

test('the shipped systems declare no colour roles, so each of these proofs is about them', () => {
  for (const doc of [DEMO(), START()]) {
    assert.equal(declaresColourRoles(doc), false);
    assert.equal(readColourRoles(doc).roles.some(role => role.declared), false);
  }
  assert.equal(declaresColourRoles(WEFTHOUSE()), true);
  assert.equal(declaresColourRoles(null), false);
  assert.equal(declaresColourRoles({ $extensions: { 'com.suse.lolly': { brandSystem: { roles: [{ id: 'typeface', group: 'Type' }] } } } }), false, 'a role of another group is not a colour role');
});

test('a system with no roles keeps every colour, in order, with the fields it always had', async () => {
  for (const doc of [DEMO(), START()]) {
    const { host, swatches } = hostOf(doc);
    const options = await colourFieldOptions(host, swatches, { wide: true });
    assert.equal(options.length, swatches.length, 'nothing is left out, the colourway copies included');
    assert.deepEqual(options.map(o => o.ref), swatches.map(s => s.ref));
    for (const option of options) {
      assert.deepEqual(Object.keys(option), ['value', 'wide', 'label', 'group', 'ref'], 'the same fields, in the same order');
      assert.equal('role' in option, false);
    }
    const before = (await colourFieldOptions(host, swatches)).map(o => Object.keys(o));
    assert.deepEqual(before[0], ['value', 'label', 'group', 'ref']);
  }
});

test('Lolly Demo still offers its six colourway copies, because it declares no roles', async () => {
  const { host, swatches } = hostOf(DEMO());
  const options = await colourFieldOptions(host, swatches, { wide: true });
  assert.equal(options.filter(o => /^\{color\.colourway\./.test(o.ref ?? '')).length, 6);
});

test('a system with no roles draws the same grid, and no word map, with no heading in it', async () => {
  const { host, swatches } = hostOf(DEMO());
  const options = await colourFieldOptions(host, swatches, { wide: true });
  setSwatches(options);
  const grid = openGrid();
  assert.equal(grid.querySelector('.color-role-swatches'), null);
  assert.equal(grid.querySelector('.color-swatch-head'), null);
  const drawn = [...grid.children].map((el) => [el.getAttribute('data-swatch-value') ?? '', el.getAttribute('data-swatch-ref') ?? '', el.getAttribute('data-name') ?? '', el.getAttribute('aria-label') ?? '', el.getAttribute('data-swatch-for') ?? ''].join('|'));
  assert.deepEqual(drawn, legacyButtons('cf', options), 'every button carries what it always carried, in the same order');
  assert.equal([...grid.children].every(el => el.classList.contains('color-swatch')), true);
  assert.equal(colourRoleWord('{color.semantic.primary}'), '', 'the words stay empty');
  assert.equal(colorVarLabel('var(--brand-primary, #000)'), 'Primary', 'and a slot keeps its own name');
});

test('roles lead in brand order, in their own words, and the copies stay out', () => {
  const doc = WEFTHOUSE();
  const swatches = createTokenSet(doc, { selection: { colourway: 'indigo' } }).colors() as ColorSwatch[];
  const options = roleSwatchOptions(readColourRoles(doc), swatches);
  const roles = options.filter(o => o.role);
  assert.deepEqual(roles.map(o => o.label), ['Main', 'Accent', 'Supporting', 'Tertiary']);
  assert.deepEqual(options.slice(0, 4), roles, 'first in the list');
  assert.deepEqual(roles.map(o => o.ref), ['{color.semantic.main}', '{color.semantic.accent}', '{color.semantic.supporting}', '{color.semantic.tertiary}']);
  assert.equal(roles[0]!.value, '#1b2a6b');
  assert.equal(roles[0]!.role!.description, "The cloth's ground colour");
  assert.deepEqual(roles[0]!.role!.fills, ['primary']);
  assert.deepEqual(roles[2]!.role!.fills, []);
  assert.equal(roles[0]!.role!.on!.ref, '{color.semantic.on-main}');
  assert.equal(roles[0]!.role!.on!.label, 'On Main');

  const rest = options.filter(o => !o.role).map(o => o.ref);
  assert.equal(rest.some(ref => /color\.colourway\./.test(ref ?? '')), false, 'no Light or Dark copies');
  assert.equal(rest.some(ref => /color\.semantic\.on-/.test(ref ?? '')), false, 'no On tokens');
  assert.equal(rest.includes('{color.semantic.primary}'), false, 'a filled slot is a second name for its role');
  assert.equal(rest.includes('{color.semantic.secondary}'), false);
  for (const slot of ['surface', 'text', 'muted', 'edge']) assert.ok(rest.includes(`{color.semantic.${slot}}`), `${slot} fills no role, so it stays`);
  for (const named of ['flax', 'loom', 'slate']) assert.ok(rest.includes(`{color.brand.${named}}`));
});

test('the list follows brand order after a reorder, and a role with no colour in this look is left out', () => {
  const doc = WEFTHOUSE();
  const reading = readColourRoles(doc);
  const reordered = { ...reading, roles: [reading.roles[2]!, reading.roles[0]!, reading.roles[1]!, reading.roles[3]!] };
  const swatches = createTokenSet(doc).colors() as ColorSwatch[];
  assert.deepEqual(roleSwatchOptions(reordered, swatches).filter(o => o.role).map(o => o.label), ['Supporting', 'Main', 'Accent', 'Tertiary']);
  const gap = swatches.filter(s => s.path !== 'color.semantic.tertiary');
  assert.deepEqual(roleSwatchOptions(reading, gap).filter(o => o.role).map(o => o.label), ['Main', 'Accent', 'Supporting']);
});

test('a stranger finds the word without hovering, and a pick stays a link', async () => {
  const doc = WEFTHOUSE();
  const { host, swatches } = hostOf(doc);
  setSwatches(await colourFieldOptions(host, swatches, { wide: true }));
  const grid = openGrid();
  const words = [...grid.querySelectorAll('.color-role-word')].map(el => el.textContent);
  assert.deepEqual(words, ['Main', 'Accent', 'Supporting', 'Tertiary'], 'the word is text on the row');
  const row = grid.querySelector<HTMLElement>('[aria-label="Supporting"]')!;
  assert.ok(row, 'the accessible name is the word alone');
  assert.equal(row.getAttribute('aria-description'), 'The selvedge and the small print');
  assert.equal(row.getAttribute('data-swatch-ref'), '{color.semantic.supporting}');
  assert.equal(row.getAttribute('data-name'), null, 'no hover chip to repeat a word already on show');
  assert.deepEqual([...grid.querySelectorAll('.color-swatch-head')].map(el => el.textContent), ['Colour roles', 'Other colours']);
  assert.equal(grid.querySelector('.color-swatch[aria-label="Semantic · Supporting"]'), null);
  assert.equal(grid.querySelector('[aria-label="Light · Supporting"]'), null);

  picked.length = 0;
  row.click();
  assert.deepEqual((picked[0] as [string, { ref: string; value: string }])[1].ref, '{color.semantic.supporting}');
  assert.equal(document.querySelector('.color-trigger-name')!.textContent, 'Supporting', 'the trigger reads the word');

  // The colour that sits on a role is one press away, painted as what it gives.
  const on = grid.querySelector<HTMLElement>('[aria-label="On Main"]')!;
  assert.equal(on.getAttribute('data-swatch-ref'), '{color.semantic.on-main}');
  picked.length = 0;
  on.click();
  assert.equal((picked[0] as [string, { ref: string }])[1].ref, '{color.semantic.on-main}');
  assert.equal(document.querySelector('.color-trigger-name')!.textContent, 'On Main');
});

test('a word is inert: markup in a label or description arrives as text, in any script', async () => {
  let doc: unknown = WEFTHOUSE();
  for (const [id, label] of [['main', 'القماش الأساسي'], ['accent', '<img src=x onerror=alert(1)>'], ['supporting', '"><script>alert(1)</script>']] as const) {
    const edit = renameColourRole(doc, id, label);
    assert.ok(edit.ok);
    doc = edit.doc;
  }
  const { host, swatches } = hostOf(doc);
  setSwatches(await colourFieldOptions(host, swatches));
  const grid = openGrid();
  assert.equal(grid.querySelector('script, img'), null);
  const words = [...grid.querySelectorAll<HTMLElement>('.color-role-word')];
  assert.equal(words[0]!.textContent, 'القماش الأساسي');
  assert.equal(words[0]!.getAttribute('dir'), 'auto');
  assert.equal(words[1]!.textContent, '<img src=x onerror=alert(1)>');
});

test('the words answer for a role, a slot it fills, and its on-colour, whatever shares a hex', async () => {
  const { host, swatches } = hostOf(WEFTHOUSE());
  setSwatches(await colourFieldOptions(host, swatches));
  assert.equal(colourRoleWord('{color.semantic.main}'), 'Main');
  assert.equal(colourRoleWord('{color.semantic.primary}'), 'Main', 'Lolly\'s slot reads the brand\'s word');
  assert.equal(colourRoleWord('{color.semantic.secondary}'), 'Accent');
  assert.equal(colourRoleWord('{color.semantic.on-primary}'), 'On Main');
  assert.equal(colourRoleWord('{color.semantic.surface}'), '', 'a slot no role fills has no word');
  assert.equal(colorVarLabel('var(--brand-primary, #1e293b)'), 'Main', 'not Primary');
  assert.equal(colorVarLabel('var(--brand-supporting)'), 'Supporting');
  assert.equal(colorVarLabel('var(--brand-surface)'), 'Surface');
  const hex = (path: string): string => Array.from(new TextEncoder().encode(path), b => b.toString(16).padStart(2, '0')).join('');
  assert.equal(colorVarLabel(`var(--brand-token-${hex('color.semantic.tertiary')}, #fff)`), 'Tertiary');
  assert.equal(swatchName({ ref: '{color.semantic.accent}', value: '#000000' }), 'Accent', 'a link beats the hex');
  assert.equal(swatchName('#6c7a89'), 'Supporting');
});

test('Design: a row\'s link names its colour, until the colour on screen stops being the link\'s', () => {
  setColourRoleWords(new Map([['{color.semantic.supporting}', 'Supporting']]));
  const row = { bg: '#7d6b5d', tokenLinks: JSON.stringify({ bg: { ref: '{color.semantic.supporting}', status: 'linked', value: '#7d6b5d' } }) };
  assert.equal(linkedColourWord(row, 'bg', row.bg), 'Supporting', 'after a colourway switch moved the literal');
  assert.equal(linkedColourWord(row, 'bg', '7d6b5d'), 'Supporting', 'a compact link drops the #');
  assert.equal(linkedColourWord(row, 'bg'), 'Supporting');
  assert.equal(linkedColourWord(row, 'bg', '#ff0000'), '', 'a keyframe\'s pose is not the link');
  assert.equal(linkedColourWord(row, 'fg', row.bg), '');
  assert.equal(linkedColourWord(null, 'bg'), '');
  assert.equal(linkedColourWord({ bg: '#000', tokenLinks: JSON.stringify({ bg: { ref: '{color.semantic.supporting}', custom: true, value: '#000' } }) }, 'bg'), '', 'a custom value has left the link');
  assert.equal(linkedColourWord({ bg: '#000', tokenLinks: JSON.stringify({ bg: { ref: '{color.brand.flax}', status: 'linked', value: '#000' } }) }, 'bg'), '', 'a token with no word');
  setColourRoleWords(new Map());
  assert.equal(linkedColourWord(row, 'bg', row.bg), '', 'no words, no name: the row keeps what it showed');
});

test('Design: a role stays a link on an input that keeps what it is given, and everything else keeps its form', () => {
  const role = { ref: '{color.semantic.supporting}', value: '#6c7a89' };
  const named = { ref: '{color.brand.flax}', value: '#faf7f2' };
  setColourRoleWords(new Map([['{color.semantic.supporting}', 'Supporting']]));
  assert.deepEqual(designInputColorValue(role, 'sdr'), role);
  assert.match(designInputColorValue(named, 'sdr') as string, /^var\(--brand-token-[0-9a-f]+, #faf7f2\)$/);
  assert.equal(designInputColorValue('#123456', 'sdr'), '#123456');
  setColourRoleWords(new Map());
  assert.match(designInputColorValue(role, 'sdr') as string, /^var\(--brand-token-/, 'a system with no roles writes what it always wrote');
});
