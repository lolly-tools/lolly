// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectTokenDocument } from '../../../../../engine/src/token-inspect.ts';
import { colourRoleCopies, roleValuesByColourway, withoutRoleCopies } from './colour-role-copies.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const DEMO = (): Rec => load('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = (): Rec => load('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
const WEFTHOUSE = (): Rec => load('../../../../../tests/fixtures/colour-roles/wefthouse.tokens.json');
const NO_ROLES = (): Rec => load('../../../../../tests/fixtures/colour-roles/lolly-demo-no-roles.json');

test('a system with no colour roles has no copies, and every token stays listed', () => {
  for (const [name, doc] of [['Lolly Start', START()], ['Lolly Demo before its roles', NO_ROLES()], ['nothing', null], ['a list', []]] as const) {
    assert.equal(colourRoleCopies(doc), null, name);
  }
  const tokens = inspectTokenDocument(NO_ROLES()).tokens;
  assert.ok(tokens.some(t => t.path.startsWith('color.colourway.')), 'the fixture has colourway values');
  assert.equal(withoutRoleCopies(tokens, colourRoleCopies(NO_ROLES())).length, tokens.length);
});

test('Lolly Demo keeps each role\'s values in every colourway and look with the role', () => {
  const doc = DEMO();
  const copies = colourRoleCopies(doc)!;
  assert.deepEqual(copies.roles.map(r => r.label), ['Lead', 'Partner', 'Paper', 'Ink']);
  const tokens = inspectTokenDocument(doc).tokens;
  const listed = withoutRoleCopies(tokens, copies);
  assert.deepEqual(listed.filter(t => t.path.startsWith('color.colourway.')).map(t => t.path), [], 'no colourway value is a token of its own');
  for (const [path, label] of [['color.colourway.light.primary', 'Lead'], ['color.colourway.dark.on-primary', 'Lead'], ['color.colourway.light.surface', 'Paper'], ['color.colourway.dark.on-surface', 'Paper'], ['color.colourway.dark.text', 'Ink'], ['color.colourway.light.on-secondary', 'Partner']] as const) {
    assert.equal(copies.roleOf(path)?.label, label, path);
  }
  for (const path of ['color.semantic.primary', 'color.brand.spearmint', 'color.colourway.light', 'color.colourway.light.primary.x']) assert.equal(copies.roleOf(path), null, path);
  assert.equal(copies.roleAt('color.semantic.surface')?.label, 'Paper');
  assert.equal(copies.secondNames.size, 0, 'each role is its slot, so no slot is a second name');
  assert.ok(listed.some(t => t.path === 'color.semantic.primary'), 'the role itself stays listed');
  assert.equal(tokens.length - listed.length, 14, 'seven names in two looks');
});

test('a role that fills a slot of another name makes the slot a second name, its on-colour too', () => {
  const copies = colourRoleCopies(WEFTHOUSE())!;
  assert.deepEqual([...copies.secondNames].map(([path, role]) => [path, role.id]), [
    ['color.semantic.primary', 'main'], ['color.semantic.on-primary', 'main'], ['color.semantic.secondary', 'accent'],
  ]);
  // The colourway sets write the binding as an alias from the slot to the role: that is the role too.
  assert.equal(copies.roleOf('color.colourway.light.primary')?.id, 'main');
  assert.equal(copies.roleOf('color.colourway.dark.on-supporting')?.id, 'supporting');
  // A slot no role fills is the design system's own.
  assert.equal(copies.roleOf('color.colourway.light.muted'), null);
});

test('a role\'s values read one row per colourway, each look beside it, as the Colour roles table reads them', () => {
  const doc = WEFTHOUSE();
  const values = roleValuesByColourway(doc, 'supporting', [{ id: 'indigo', name: 'Indigo' }, { id: 'madder', name: 'Madder' }]);
  assert.deepEqual(values.modes.map(m => m.id), ['light', 'dark']);
  assert.deepEqual(values.rows.map(r => r.colourway), ['Indigo', 'Madder']);
  assert.equal(values.rows[0]!.values[0], '#6c7a89');
  assert.equal(values.rows[1]!.values[0], '#7d6b5d');
  assert.deepEqual(roleValuesByColourway(doc, 'no-such-role', [{ id: 'indigo', name: 'Indigo' }]).rows, []);
});
