// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Demo's colourways (plans/319, milestone A9): Spearmint, the canonical
 * lead, then Morning, Spring, Beach, Afternoon and Midnight. Each colourway is a
 * bundle of links to Opal's named colours, written by the engine's own editors
 * (liftToColourways and addColourway). These tests pin what the pack promises:
 * the order and the canonical, that every role links to a named Opal colour,
 * that the canonical resolves exactly as the single-lead pack did, the contrast
 * of every look, the family of leads a polychrome tool reads, and that a share
 * link's `_themes` picks each colourway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from '../engine/src/tokens.ts';
import { axisOfKind, readTokenAxes } from '../engine/src/token-axes.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { COLOURWAY_ROLES, colourwayFamily, colourwayPath, colourwaySetName } from '../engine/src/colourway.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SHIPPED = load('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const SINGLE_LEAD = load('./fixtures/colourway/lolly-demo-single-lead.json');

const LOOKS = ['light', 'dark'] as const;
type Look = (typeof LOOKS)[number];
/** Opal names for primary, on-primary and secondary, per look. */
type Bundle = Record<Look, readonly [string, string, string]>;

const COLOURWAYS: ReadonlyArray<{ id: string; name: string; colours: Bundle }> = [
  { id: 'spearmint', name: 'Spearmint', colours: { light: ['spearmint', 'sugar', 'bunyapine'], dark: ['green-apple', 'liquorice', 'bunyapine'] } },
  { id: 'morning', name: 'Morning', colours: { light: ['outback', 'sugar', 'lagoon'], dark: ['honey', 'liquorice', 'sky'] } },
  { id: 'spring', name: 'Spring', colours: { light: ['fuchsia', 'sugar', 'olive'], dark: ['donut', 'liquorice', 'green-apple'] } },
  { id: 'beach', name: 'Beach', colours: { light: ['lagoon', 'liquorice', 'bark'], dark: ['reef', 'liquorice', 'pancake'] } },
  { id: 'afternoon', name: 'Afternoon', colours: { light: ['ochre', 'sugar', 'khaki'], dark: ['arvo', 'liquorice', 'banksia'] } },
  { id: 'midnight', name: 'Midnight', colours: { light: ['liquorice', 'sugar', 'jacaranda'], dark: ['jacaranda', 'liquorice', 'swell'] } },
];

function nodeAt(root: unknown, path: string): Rec | undefined {
  let node: unknown = root;
  for (const seg of path.split('.')) {
    if (!node || typeof node !== 'object') return undefined;
    node = (node as Rec)[seg];
  }
  return node && typeof node === 'object' ? (node as Rec) : undefined;
}

const hexOf = (doc: unknown, selection: Record<string, string>, path: string): string => {
  const swatch = createTokenSet(doc, { selection }).colors().find(s => s.path === path);
  assert.ok(swatch, `${path} resolves under ${JSON.stringify(selection)}`);
  return swatch.value;
};

test('Lolly Demo offers six colourways in order, Spearmint canonical', () => {
  const axis = axisOfKind(readTokenAxes(SHIPPED).axes, 'colourway');
  assert.ok(axis, 'the pack has a colourway group');
  assert.equal(axis.canonical, 'spearmint');
  assert.deepEqual(axis.options.map(o => [o.id, o.name]), COLOURWAYS.map(c => [c.id, c.name]));
});

test('every colourway role links to a named Opal colour, never a bare value', () => {
  for (const { id, colours } of COLOURWAYS) {
    for (const look of LOOKS) {
      COLOURWAY_ROLES.forEach((role, i) => {
        const node = nodeAt(SHIPPED[colourwaySetName(id)], colourwayPath(look, role));
        const name = colours[look][i]!;
        assert.equal(node?.$value, `{color.brand.${name}}`, `${id} ${look} ${role}`);
        assert.ok(nodeAt(SHIPPED.base, `color.brand.${name}`)?.$value, `color.brand.${name} is an Opal colour`);
      });
    }
  }
});

test('the canonical colourway resolves every token exactly as the single-lead pack did', () => {
  for (const look of LOOKS) {
    const before = createTokenSet(SINGLE_LEAD, { selection: { '': look } }).query();
    const selections: Record<string, string>[] = [{ '': look }, { '': look, colourway: 'spearmint' }];
    for (const selection of selections) {
      const after = new Map(createTokenSet(SHIPPED, { selection }).query().map(e => [e.path, e]));
      for (const e of before) {
        const now = after.get(e.path);
        assert.ok(now, `${e.path} still resolves under ${JSON.stringify(selection)}`);
        assert.deepEqual([now.type, now.value, now.description ?? null, now.extensions ?? null], [e.type, e.value, e.description ?? null, e.extensions ?? null], `${e.path} under ${JSON.stringify(selection)}`);
      }
    }
  }
});

test('every colourway reads: label on lead 4.5:1, lead and partner 3:1 on the surface', () => {
  const rows: string[] = [];
  for (const { id } of COLOURWAYS) {
    for (const look of LOOKS) {
      const selection = { '': look, colourway: id };
      const [primary, onPrimary, secondary, surface] = ['primary', 'on-primary', 'secondary', 'surface'].map(role => hexOf(SHIPPED, selection, `color.semantic.${role}`));
      const label = contrastRatio(onPrimary!, primary!), lead = contrastRatio(primary!, surface!), partner = contrastRatio(secondary!, surface!);
      rows.push(`${id} ${look}: label ${label.toFixed(2)}, lead ${lead.toFixed(2)}, partner ${partner.toFixed(2)}`);
      assert.ok(label >= 4.5, `${id} ${look}: on-primary ${onPrimary} on primary ${primary} is ${label.toFixed(2)}:1`);
      assert.ok(lead >= 3, `${id} ${look}: primary ${primary} on surface ${surface} is ${lead.toFixed(2)}:1`);
      assert.ok(partner >= 3, `${id} ${look}: secondary ${secondary} on surface ${surface} is ${partner.toFixed(2)}:1`);
    }
  }
  assert.equal(rows.length, COLOURWAYS.length * LOOKS.length);
});

test('the family of leads lists all six, Spearmint first, in each look', () => {
  for (const look of LOOKS) {
    const family = colourwayFamily(SHIPPED, 'primary', { '': look });
    assert.deepEqual(family.map(l => [l.id, l.canonical]), COLOURWAYS.map((c, i) => [c.id, i === 0]));
    assert.deepEqual(family.map(l => l.value), COLOURWAYS.map(c => nodeAt(SHIPPED.base, `color.brand.${c.colours[look][0]}`)?.$value), `the ${look} leads`);
  }
});

test('a share link\'s _themes picks each colourway', () => {
  for (const { id, colours } of COLOURWAYS) {
    const state = parseUrlState(`_themes=${encodeURIComponent(JSON.stringify({ colourway: id }))}`, { inputs: [] });
    assert.deepEqual(state.tokenSelection, { colourway: id });
    for (const look of LOOKS) {
      const lead = hexOf(SHIPPED, { ...state.tokenSelection, '': look }, 'color.semantic.primary');
      const opal = nodeAt(SHIPPED.base, `color.brand.${colours[look][0]}`)?.$value;
      assert.equal(lead, opal, `${id} ${look} leads with ${colours[look][0]}`);
    }
  }
});
