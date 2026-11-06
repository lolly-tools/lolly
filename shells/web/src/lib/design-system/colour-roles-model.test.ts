// SPDX-License-Identifier: MPL-2.0
/**
 * What the Colour roles table shows, with no DOM (plans/352 R2). The fixture is Wefthouse,
 * an invented textile brand with four roles and three colourways.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/colour-roles-model.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addColourRole, deriveBrandTokens, readColourRoles, setColourRoles, setRoleSameAsLight } from '@lolly/engine';
import {
  colourRolesModel, explainRemoval, parseRoleWords, readingOption, refusalText, sameAsWords, slotLine, slotWord,
  specsForShippedRename, specsForWords, STARTING_POINTS, suggestedReadings,
} from './colour-roles-model.ts';
import type { SlotId } from './colour-roles-model.ts';

type Rec = Record<string, unknown>;
const wefthouse = (): Rec => JSON.parse(readFileSync(new URL('../../../../../tests/fixtures/colour-roles/wefthouse.tokens.json', import.meta.url), 'utf8')) as Rec;
const demo = (): Rec => JSON.parse(readFileSync(new URL('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8')) as Rec;
const single = (): Rec => deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;
const brandSystem = (doc: Rec): Rec => ((doc.$extensions as Rec)['com.suse.lolly'] as Rec).brandSystem as Rec;

test('a declared system: its own words in its own order, each read in the table\'s language', () => {
  const m = colourRolesModel(wefthouse());
  assert.equal(m.state, 'declared');
  assert.equal(m.editable, true);
  assert.deepEqual(m.rows.map(r => r.label), ['Main', 'Accent', 'Supporting', 'Tertiary']);
  assert.deepEqual(m.rows.map(r => r.slots), [['primary'], ['secondary'], [], []]);
  assert.deepEqual(m.modes.map(x => x.name), ['Light', 'Dark']);
  assert.equal(m.colourway?.name, 'Indigo');
  assert.deepEqual(m.unfilled.map(u => u.word), ['Background', 'Text', 'Quiet text', 'Hairlines'], 'a slot no role fills says so, in the same language');
  assert.equal(m.rows[0]!.description, 'The cloth\'s ground colour');
});

test('"Lolly reads this as" never uses a bare Primary or Secondary', () => {
  for (const slot of ['primary', 'secondary', 'surface', 'text', 'muted', 'edge'] as SlotId[]) {
    assert.doesNotMatch(slotWord(slot), /^(primary|secondary)$/i);
    assert.ok(slotLine(slot), `${slot} has a line saying what follows from it`);
  }
  assert.equal(slotWord('primary'), 'Lead colour');
  assert.equal(slotWord('secondary'), 'Partner colour');
});

test('each cell: value, contrast, and what sits on the colour, derived or stated', () => {
  const m = colourRolesModel(wefthouse());
  const [light, dark] = m.rows[0]!.cells;
  assert.equal(light!.hex, '#1b2a6b');
  assert.equal(light!.text, '#1b2a6b');
  assert.equal(dark!.hex, '#8fa2ff');
  assert.equal(light!.onWord, 'Derived', 'a derived on-colour is labelled as derived');
  assert.ok(light!.contrast && typeof light!.contrast.lc === 'number');
  // Dark follows light on Supporting in the fixture.
  const supporting = m.rows[2]!.cells[1]!;
  assert.equal(supporting.sameAs, 'Light');
  assert.equal(sameAsWords(supporting.sameAs!), 'Same as light');
  // Madder's Accent states its own on-colour, and that stays.
  const madder = colourRolesModel(wefthouse(), { colourway: 'madder' });
  assert.equal(madder.colourway?.name, 'Madder');
  assert.equal(madder.rows[1]!.cells[0]!.onWord, 'Stated');
});

test('a value copied rather than chosen says where it came from', () => {
  const added = addColourRole(wefthouse(), { label: 'Selvedge' });
  assert.ok(added.ok);
  const canonical = colourRolesModel(added.doc).rows.at(-1)!;
  assert.match(canonical.cells[0]!.copied ?? '', /Copied from the partner colour/);
  const other = colourRolesModel(added.doc, { colourway: 'madder' }).rows.at(-1)!;
  assert.match(other.cells[0]!.copied ?? '', /Copied from Indigo/);
  assert.equal(colourRolesModel(wefthouse()).rows[0]!.cells[0]!.copied, null, 'a chosen colour says nothing');
});

test('the default state shows today\'s words and offers nothing to reorder or remove', () => {
  const doc = demo();
  const before = JSON.stringify(doc);
  const m = colourRolesModel(doc);
  assert.equal(m.state, 'default');
  assert.deepEqual(m.rows.map(r => r.label), ['Primary', 'Secondary', 'Surface', 'Text']);
  assert.ok(m.rows.every(r => r.shipped && r.fixed));
  assert.deepEqual(m.unfilled.map(u => u.word), ['Quiet text', 'Hairlines']);
  assert.ok(m.rows[0]!.cells[0]!.hex.startsWith('#'), 'the values still show');
  assert.equal(JSON.stringify(doc), before, 'reading writes nothing');
});

test('undeclared: hand-written tokens are offered for naming, and a name with digits is left alone', () => {
  const doc = single();
  for (const mode of ['light', 'dark']) {
    const semantic = ((doc[mode] as Rec).color as Rec).semantic as Rec;
    semantic.accent = { $value: '#e05a2b', $type: 'color' };
    semantic['accent-2'] = { $value: '#123456', $type: 'color' };
  }
  const m = colourRolesModel(doc);
  assert.equal(m.state, 'undeclared');
  assert.deepEqual(m.rows.map(r => r.label), ['Primary', 'Secondary', 'Surface', 'Text']);
  assert.deepEqual(m.handWritten.map(h => [h.id, h.label]), [['accent', 'Accent']]);
  assert.ok(m.handWritten[0]!.colours.every(c => c.hex === '#e05a2b'));
  assert.deepEqual(m.unusable, ['accent-2']);
});

test('an unreadable record refuses edits with a plain reason and keeps the table', () => {
  const doc = wefthouse();
  brandSystem(doc).schemaVersion = 99;
  const m = colourRolesModel(doc);
  assert.equal(m.editable, false);
  assert.match(m.refusal, /does not validate/);
  assert.deepEqual(m.rows.map(r => r.label), ['Main', 'Accent', 'Supporting', 'Tertiary'], 'read one by one for display');
});

test('a read-only view draws no controls whatever the file allows, and gives no reason of its own', () => {
  const m = colourRolesModel(wefthouse(), { readOnly: true });
  assert.equal(m.editable, false);
  assert.equal(m.refusal, '');
  assert.equal(m.rows.length, 4);
});

test('each slot takes one role: a held slot says who holds it, and a slot a role is itself cannot move', () => {
  const m = colourRolesModel(wefthouse());
  const tertiary = m.rows[3]!;
  assert.deepEqual(readingOption(m, tertiary, 'primary'), { label: 'Lead colour (Main)', disabled: false });
  assert.deepEqual(readingOption(m, tertiary, 'surface'), { label: 'Background', disabled: false });
  assert.deepEqual(readingOption(m, m.rows[0]!, 'primary'), { label: 'Lead colour', disabled: false }, 'a role holding the slot is not its own rival');
  const self = setColourRoles(single(), [{ label: 'Primary' }, { label: 'Accent' }]);
  assert.ok(self.ok);
  const selfModel = colourRolesModel(self.doc);
  assert.equal(selfModel.rows[0]!.fixed, true, 'a role whose id is a slot reads as that slot, and that cannot move');
  assert.deepEqual(readingOption(selfModel, selfModel.rows[1]!, 'primary'), { label: 'Lead colour (Primary)', disabled: true });
});

test('starting points are suggestions: words parse in any script, and the first two are offered the two slots by position', () => {
  assert.deepEqual(STARTING_POINTS.map(s => [...s]), [['Primary', 'Secondary'], ['Main', 'Accent', 'Supporting', 'Tertiary']]);
  assert.deepEqual(parseRoleWords(' Main, Accent ,, main،绿色、青 '), ['Main', 'Accent', '绿色', '青'], 'commas in any script, no repeats');
  assert.deepEqual(suggestedReadings(['Main', 'Accent', 'Supporting']).map(r => r.slot), ['primary', 'secondary', null]);
  assert.deepEqual(suggestedReadings(['Accent', 'Primary']).map(r => r.slot), ['secondary', 'primary'], 'a word that is a slot\'s own name keeps that slot');
  assert.deepEqual(suggestedReadings(['Surface', 'Main']).map(r => r.slot), ['surface', 'primary']);
});

test('the shipped words as a starting point write nothing, so the document stays byte-identical', () => {
  const doc = demo();
  const edit = setColourRoles(doc, specsForWords(['Primary', 'Secondary']));
  assert.ok(edit.ok);
  assert.equal(edit.changed, false);
  assert.equal(JSON.stringify(edit.doc), JSON.stringify(doc));
});

test('own words on a system with one lead: the colourway is not called Main, and every colour stays', () => {
  const doc = single();
  const edit = setColourRoles(doc, specsForWords(['Main', 'Accent', 'Supporting', 'Tertiary']), { lift: { id: 'pine', name: 'Pine' } });
  assert.ok(edit.ok, edit.ok ? '' : edit.reasons.join(' '));
  const m = colourRolesModel(edit.doc);
  assert.equal(m.colourway?.name, 'Pine');
  assert.deepEqual(m.rows.map(r => [r.label, r.slots]), [['Main', ['primary']], ['Accent', ['secondary']], ['Supporting', []], ['Tertiary', []]]);
  assert.deepEqual(m.rows[0]!.cells.map(c => c.hex), colourRolesModel(doc).rows[0]!.cells.map(c => c.hex), 'the lead colour draws what it drew');
});

test('renaming a shipped word declares it with the two slots a tool reaches for, and leaves Surface and Text alone', () => {
  const lift = { id: 'pine', name: 'Pine' };
  const main = setColourRoles(single(), specsForShippedRename('primary', 'Main'), { lift });
  assert.ok(main.ok, main.ok ? '' : main.reasons.join(' '));
  const m = colourRolesModel(main.doc);
  assert.deepEqual(m.rows.map(r => [r.label, r.slots]), [['Main', ['primary']], ['Secondary', ['secondary']]]);
  assert.deepEqual(m.unfilled.map(u => u.slot), ['surface', 'text', 'muted', 'edge']);
  const paper = setColourRoles(single(), specsForShippedRename('surface', 'Paper'), { lift });
  assert.ok(paper.ok, paper.ok ? '' : paper.reasons.join(' '));
  assert.deepEqual(colourRolesModel(paper.doc).rows.map(r => [r.label, r.slots]), [['Primary', ['primary']], ['Secondary', ['secondary']], ['Paper', ['surface']]]);
  // A word that happens to be another slot's own name does not claim that slot.
  const swapped = setColourRoles(single(), specsForShippedRename('primary', 'Surface'), { lift });
  assert.ok(swapped.ok, swapped.ok ? '' : swapped.reasons.join(' '));
  assert.deepEqual(readColourRoles(swapped.doc).slots.find(s => s.slot === 'primary')?.roleId, 'role-surface');
});

test('removal: what uses the role, in plain words, and the sentence about saved documents every time', () => {
  const doc = wefthouse();
  const free = explainRemoval(doc, 'Supporting', undefined, { canRelease: false });
  assert.deepEqual(free.uses, []);
  assert.equal(free.blocked, false);
  assert.match(free.unseen, /saved Design document/);
  const inSlot = explainRemoval(doc, 'Main', { slots: ['primary'], rules: [], guideGroups: [], tokens: [], toolBindings: [] }, { canRelease: true });
  assert.match(inSlot.uses[0]!, /Lolly reads Main as Lead colour/);
  assert.match(inSlot.uses[0]!, /keeps the colour it draws now/);
  assert.equal(inSlot.releases, true);
  const rule = explainRemoval(doc, 'Main', { slots: [], rules: ['headline-case'], guideGroups: [], tokens: [], toolBindings: [] }, { canRelease: false });
  assert.match(rule.uses[0]!, /Headlines stay in sentence case/, 'a rule goes by its label');
  assert.equal(rule.blocked, true);
  assert.equal(rule.releases, false);
});

test('labels are inert: a hostile label cannot reach a key or a placeholder', () => {
  const doc = wefthouse();
  const added = addColourRole(doc, { label: '__proto__' });
  assert.ok(added.ok, added.ok ? '' : added.reasons.join(' '));
  const m = colourRolesModel(added.doc);
  assert.equal(({} as Rec).polluted, undefined);
  assert.equal(m.rows.at(-1)!.label, '__proto__');
  assert.match(m.rows.at(-1)!.key, /^[a-z][a-z-]*$/, 'a generated id, letters and hyphens');
  const text = explainRemoval(doc, '{slots}', { slots: ['primary'], rules: [], guideGroups: [], tokens: [], toolBindings: [] }, { canRelease: true }).uses[0]!;
  assert.match(text, /Lolly reads \{slots\} as Lead colour/, 'a placeholder in a label stays text');
});

test('long, Arabic, Chinese and emoji labels come through whole, and refusals read plainly', () => {
  const words = ['القماش الأساسي', '主色调', 'Selvedge 🧵', `${'Very long '.repeat(7)}name`];
  const edit = setColourRoles(single(), specsForWords(words), { lift: { id: 'pine', name: 'Pine' } });
  assert.ok(edit.ok, edit.ok ? '' : edit.reasons.join(' '));
  const m = colourRolesModel(edit.doc);
  assert.deepEqual(m.rows.map(r => r.label), words);
  assert.ok(m.rows.every(r => /^[a-z][a-z-]*$/.test(r.key)), 'ids stay usable whatever the label');
  const dup = setColourRoles(edit.doc, [...specsForWords(words), { label: 'x'.repeat(200) }]);
  assert.ok(!dup.ok);
  assert.match(refusalText(dup), /at most 80 characters/);
});

test('same-as-light shows up as a state of the row it belongs to', () => {
  const edit = setRoleSameAsLight(wefthouse(), { roleId: 'tertiary', mode: 'dark', colourway: 'weld' });
  assert.ok(edit.ok);
  const row = colourRolesModel(edit.doc, { colourway: 'weld' }).rows[3]!;
  assert.equal(row.cells[1]!.sameAs, 'Light');
  assert.equal(row.cells[1]!.hex, row.cells[0]!.hex);
  assert.equal(colourRolesModel(edit.doc, { colourway: 'indigo' }).rows[3]!.cells[1]!.sameAs, null, 'other colourways are untouched');
});
