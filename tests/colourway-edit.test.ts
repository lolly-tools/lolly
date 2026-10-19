// SPDX-License-Identifier: MPL-2.0
/**
 * Editing the colourways a design system already has (plans/319 A2): rename,
 * reorder, choose the canonical one, remove, copy, plus the surface lift and the
 * name rules addColourway now shares. Each edit is checked the way the lift and
 * the add are: every explicit selection resolves exactly as before, or the edit
 * is refused. Fixtures are a derived system and the public Lolly Demo system.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readTokenAxes } from '../engine/src/token-axes.ts';
import { deriveBrandTokens } from '../engine/src/brand-derive.ts';
import {
  addColourway, colourwayAxis, colourwayRolesOf, colourwaysEditable, duplicateColourway, liftToColourways,
  removeColourway, renameColourway, reorderColourways, setCanonicalColourway, MAX_COLOURWAY_NAME,
  type ColourwayValues,
} from '../engine/src/colourway.ts';
import type { TokenResolveOptions } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const FIXTURES: Record<string, () => Rec> = {
  'Lolly Demo': () => load('../brands/lolly-demo/catalog/assets/lolly/tokens/opal.json'),
  'a derived system': () => deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }),
};

const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};
const WATERHOLE: Record<string, ColourwayValues> = {
  light: { primary: '#0e7490', 'on-primary': '#ffffff', secondary: '#164e63' },
  dark: { primary: '#67e8f9', 'on-primary': '#0b0b0b', secondary: '#cffafe' },
};

/** Three leads: the lifted canonical `main`, then Persimmon, then Waterhole. */
function threeLeads(doc: Rec): Rec {
  const lifted = liftToColourways(doc, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok, lifted.ok ? '' : lifted.reasons.join(' '));
  const one = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON });
  assert.ok(one.ok, one.ok ? '' : one.reasons.join(' '));
  const two = addColourway(one.doc, { id: 'waterhole', name: 'Waterhole', values: WATERHOLE });
  assert.ok(two.ok, two.ok ? '' : two.reasons.join(' '));
  return two.doc;
}

const ok = (result: ReturnType<typeof renameColourway>): Rec => {
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  return result.doc;
};
const refused = (result: ReturnType<typeof renameColourway>, pattern: RegExp): void => {
  assert.equal(result.ok, false, 'the edit should be refused');
  if (!result.ok) assert.match(result.reasons.join(' '), pattern);
};

const ids = (doc: Rec): string[] => colourwayAxis(doc)!.options.map(o => o.id);
const hex = (doc: unknown, path: string, opts: TokenResolveOptions): string | undefined =>
  createTokenSet(doc, opts).colors().find(s => s.path === path)?.value;

/** Every token under every explicit selection of the groups `axesOf` has, as one comparable map. */
function resolvedUnder(doc: unknown, axesOf: unknown): Map<string, string> {
  const out = new Map<string, string>();
  let combos: Record<string, string>[] = [{}];
  for (const axis of readTokenAxes(axesOf).axes) combos = combos.flatMap(c => axis.options.map(o => ({ ...c, [axis.group]: o.id })));
  for (const selection of combos) {
    for (const e of createTokenSet(doc, { selection }).query()) out.set(`${JSON.stringify(selection)} ${e.path}`, JSON.stringify(e.value));
  }
  return out;
}

for (const [label, make] of Object.entries(FIXTURES)) {
  test(`${label}: renaming changes the name, never the id, and nothing resolves differently`, () => {
    const doc = threeLeads(make());
    const next = ok(renameColourway(doc, 'persimmon', 'Burnt orange'));
    assert.deepEqual(ids(next), ids(doc), 'ids are permanent');
    assert.equal(colourwayAxis(next)!.options.find(o => o.id === 'persimmon')!.name, 'Burnt orange');
    assert.deepEqual(resolvedUnder(next, doc), resolvedUnder(doc, doc));
    assert.equal(colourwayAxis(doc)!.options.find(o => o.id === 'persimmon')!.name, 'Persimmon', 'the input is never modified');
  });

  test(`${label}: a new order keeps the canonical lead first and every token as it was`, () => {
    const doc = threeLeads(make());
    const next = ok(reorderColourways(doc, ['main', 'waterhole', 'persimmon']));
    assert.deepEqual(ids(next), ['main', 'waterhole', 'persimmon']);
    assert.deepEqual(resolvedUnder(next, doc), resolvedUnder(doc, doc));
    refused(reorderColourways(doc, ['persimmon', 'main', 'waterhole']), /canonical colourway stays first/);
    refused(reorderColourways(doc, ['main', 'persimmon']), /every colourway exactly once/);
    refused(reorderColourways(doc, ['main', 'persimmon', 'persimmon']), /every colourway exactly once/);
    refused(reorderColourways(doc, ['main', 'persimmon', 'ghost']), /every colourway exactly once/);
  });

  test(`${label}: making a lead canonical moves the mark and the entry, and keeps every explicit choice`, () => {
    const doc = threeLeads(make());
    const next = ok(setCanonicalColourway(doc, 'waterhole'));
    const axis = colourwayAxis(next)!;
    assert.equal(axis.canonical, 'waterhole');
    assert.deepEqual(ids(next), ['waterhole', 'main', 'persimmon'], 'the canonical lead is written first, so the mark and the first-option rule agree');
    const marks = (next.$themes as Rec[]).filter(t => t.group === 'colourway')
      .map(t => ((t.$extensions as Rec)['com.suse.lolly'] as Rec).axis as Rec);
    assert.deepEqual(marks.map(m => m.canonical === true), [true, false, false], 'exactly one entry is marked');
    assert.ok(marks.every(m => m.kind === 'colourway'), 'every entry keeps its kind');
    assert.deepEqual(resolvedUnder(next, doc), resolvedUnder(doc, doc), 'explicit choices resolve as before');
    // The default is the one thing that moves, and on purpose: no choice here picks a colourway.
    assert.equal(hex(next, 'color.semantic.primary', { theme: 'light' }), hex(doc, 'color.semantic.primary', { selection: { '': 'light', colourway: 'waterhole' } }));
    refused(setCanonicalColourway(doc, 'ghost'), /not a colourway/);
  });

  test(`${label}: removing a lead takes its set and its stored choice, and leaves the others alone`, () => {
    const doc = threeLeads(make());
    (doc.$metadata as Rec).activeThemeSelection = { colourway: 'persimmon' };
    (doc.$metadata as Rec).activeThemes = ['Persimmon'];
    const next = ok(removeColourway(doc, 'persimmon'));
    assert.deepEqual(ids(next), ['main', 'waterhole']);
    assert.equal(next['colourway/persimmon'], undefined, 'its set goes');
    assert.ok(!((next.$metadata as Rec).tokenSetOrder as string[]).includes('colourway/persimmon'));
    assert.deepEqual((next.$metadata as Rec).activeThemeSelection, {}, 'a stored choice of it is cleared');
    assert.deepEqual((next.$metadata as Rec).activeThemes, []);
    assert.deepEqual(resolvedUnder(next, next), resolvedUnder(doc, next), 'every remaining pairing resolves as before');
    refused(removeColourway(doc, 'main'), /Make another colourway canonical before removing Main/);
    refused(removeColourway(doc, 'ghost'), /not a colourway/);
  });

  test(`${label}: a copy resolves exactly as its source and goes last`, () => {
    const doc = threeLeads(make());
    const next = ok(duplicateColourway(doc, 'persimmon', { id: 'persimmon-2', name: 'Persimmon 2' }));
    assert.deepEqual(ids(next), ['main', 'persimmon', 'waterhole', 'persimmon-2']);
    for (const look of ['light', 'dark']) {
      const source = createTokenSet(next, { selection: { '': look, colourway: 'persimmon' } });
      const copy = createTokenSet(next, { selection: { '': look, colourway: 'persimmon-2' } });
      for (const role of ['primary', 'on-primary', 'secondary', 'surface', 'text']) {
        assert.equal(copy.resolve(`color.semantic.${role}`), source.resolve(`color.semantic.${role}`), `${look} ${role}`);
      }
    }
    assert.deepEqual(resolvedUnder(next, doc), resolvedUnder(doc, doc), 'the existing pairings are untouched');
    refused(duplicateColourway(doc, 'persimmon', { id: 'persimmon', name: 'Another' }), /already has a theme called persimmon/);
    refused(duplicateColourway(doc, 'persimmon', { id: 'p2', name: 'waterhole' }), /already called waterhole/);
    refused(duplicateColourway(doc, 'persimmon', { id: 'Bad Id', name: 'Fine' }), /not a usable colourway id/);
  });
}

test('names: a colourway may not reuse another theme\'s id or name, in any case', () => {
  const doc = threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }));
  // A theme request matches by name, so a colourway called "light" would answer colors({ theme: 'light' }).
  refused(renameColourway(doc, 'persimmon', 'light'), /already has a theme called light/);
  refused(renameColourway(doc, 'persimmon', 'Dark'), /already has a theme called Dark/);
  refused(renameColourway(doc, 'persimmon', 'WATERHOLE'), /Another colourway is already called WATERHOLE/);
  refused(renameColourway(doc, 'persimmon', 'main'), /Another colourway is already called main/);
  refused(renameColourway(doc, 'persimmon', '   '), /needs a name/);
  refused(renameColourway(doc, 'persimmon', 'x'.repeat(MAX_COLOURWAY_NAME + 1)), /at most/);
  ok(renameColourway(doc, 'persimmon', 'persimmon'));
  // The add shares the rules.
  refused(addColourway(doc, { id: 'night', name: 'light', values: PERSIMMON }), /already has a theme called light/);
  refused(addColourway(doc, { id: 'second', name: 'persimmon', values: PERSIMMON }), /Another colourway is already called persimmon/);
});

test('names: the lift shares the rules, so the canonical colourway cannot be named after a look', () => {
  const doc = deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' });
  // Named "light", the canonical colourway would answer every light request, the
  // other colourways' included: a theme request beats an explicit colourway choice.
  refused(liftToColourways(doc, { name: 'light' }), /already has a theme called light/);
  refused(liftToColourways(doc, { name: 'Dark' }), /already has a theme called Dark/);
  refused(liftToColourways(doc, { name: 'x'.repeat(MAX_COLOURWAY_NAME + 1) }), /at most/);
  refused(addColourway(doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON, lift: { name: 'light' } }), /already has a theme called light/);
  // A blank name still means the default, and a usable one is kept as typed.
  assert.equal(colourwayAxis(ok(liftToColourways(doc, { name: '  ' })))!.options[0]!.name, 'Main');
  assert.equal(colourwayAxis(ok(liftToColourways(doc, { id: 'pine', name: ' Pine ' })))!.options[0]!.name, 'Pine');
});

test('renaming a lead whose entry has no id of its own pins the old name as the id', () => {
  const doc = threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }));
  const entry = (doc.$themes as Rec[]).find(t => t.id === 'persimmon')!;
  delete entry.id;
  entry.name = 'persimmon';
  const next = ok(renameColourway(doc, 'persimmon', 'Burnt orange'));
  const renamed = (next.$themes as Rec[]).find(t => t.name === 'Burnt orange')!;
  assert.equal(renamed.id, 'persimmon', 'a stored choice of persimmon keeps finding it');
  assert.equal(hex(next, 'color.semantic.primary', { selection: { '': 'light', colourway: 'persimmon' } }), '#c2410c');
});

test('renaming a lead keeps a stored activeThemes choice that used the old name', () => {
  const doc = threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }));
  (doc.$metadata as Rec).activeThemes = ['light', 'Persimmon'];
  const before = hex(doc, 'color.semantic.primary', {});
  const next = ok(renameColourway(doc, 'persimmon', 'Burnt orange'));
  assert.deepEqual((next.$metadata as Rec).activeThemes, ['light', 'persimmon'], 'the stored name becomes the permanent id');
  assert.equal(hex(next, 'color.semantic.primary', {}), before, 'the stored choice still draws Persimmon');
  // The group-qualified spelling is rewritten the same way.
  (doc.$metadata as Rec).activeThemes = ['colourway/Persimmon'];
  assert.deepEqual((ok(renameColourway(doc, 'persimmon', 'Ember')).$metadata as Rec).activeThemes, ['colourway/persimmon']);
});

test('a group that states its canonical lead at the document root has the root updated too', () => {
  const doc = threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }));
  doc.$extensions = { 'com.suse.lolly': { themeAxes: { colourway: { kind: 'colourway', canonical: 'main' } } } };
  const next = ok(setCanonicalColourway(doc, 'persimmon'));
  const root = (((next.$extensions as Rec)['com.suse.lolly'] as Rec).themeAxes as Rec).colourway as Rec;
  assert.equal(root.canonical, 'persimmon');
  const { diagnostics } = readTokenAxes(next);
  assert.equal(diagnostics.length, 0, 'the mark and the root agree');
});

test('removing a lead keeps a set another theme still turns on', () => {
  const doc = threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }));
  // A hand-built file where the light theme also turns Persimmon's set on.
  const light = (doc.$themes as Rec[]).find(t => t.name === 'light')!;
  (light.selectedTokenSets as Rec)['colourway/persimmon'] = 'source';
  const next = ok(removeColourway(doc, 'persimmon'));
  assert.ok(next['colourway/persimmon'], 'the set another theme uses stays');
  assert.deepEqual(ids(next), ['main', 'waterhole']);
});

test('removing and copying refuse a file that encodes colourways its own way', () => {
  const foreign: Rec = {
    base: { color: { $type: 'color', ink: { $value: '#111111' } } },
    light: { color: { semantic: { primary: { $value: '#222222' } } } },
    dark: { color: { semantic: { primary: { $value: '#dddddd' } } } },
    pine: { color: { semantic: { primary: { $value: '#0c322c' } } } },
    jungle: { color: { semantic: { primary: { $value: '#30ba78' } } } },
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
      { id: 'pine', name: 'Pine', group: 'brand', selectedTokenSets: { pine: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'colourway', canonical: true } } } },
      { id: 'jungle', name: 'Jungle', group: 'brand', selectedTokenSets: { jungle: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'colourway' } } } },
    ],
    $metadata: { tokenSetOrder: ['base', 'light', 'dark', 'pine', 'jungle'] },
  };
  refused(removeColourway(foreign, 'jungle'), /its own way/);
  refused(duplicateColourway(foreign, 'jungle', { id: 'copy', name: 'Copy' }), /its own way/);
  assert.equal(colourwaysEditable(foreign).ok, false);
  // Only $themes changes for these three, so they work on any colourway group.
  ok(renameColourway(foreign, 'jungle', 'Bright jungle'));
  ok(setCanonicalColourway(foreign, 'jungle'));
  ok(reorderColourways(foreign, ['pine', 'jungle']));
});

test('the surface can be lifted with the lead roles, and every look resolves as before', () => {
  const doc = deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' });
  const lifted = liftToColourways(doc, { id: 'main', name: 'Main', surface: true });
  assert.ok(lifted.ok, lifted.ok ? '' : lifted.reasons.join(' '));
  assert.deepEqual(colourwayRolesOf(lifted.doc), ['primary', 'on-primary', 'secondary', 'surface']);
  const lightSurface = ((((lifted.doc.light as Rec).color as Rec).semantic as Rec).surface as Rec).$value;
  assert.equal(lightSurface, '{color.colourway.light.surface}');
  for (const theme of ['light', 'dark']) {
    for (const e of createTokenSet(doc, { theme }).query()) {
      if (e.path.startsWith('color.colourway.')) continue;
      assert.deepEqual(createTokenSet(lifted.doc, { theme }).resolve(e.path), e.value, `${theme} ${e.path}`);
    }
  }
  const plain = liftToColourways(doc, { id: 'main', name: 'Main' });
  assert.ok(plain.ok);
  assert.deepEqual(colourwayRolesOf(plain.ok ? plain.doc : {}), ['primary', 'on-primary', 'secondary'], 'the surface stays the look\'s own by default');
  assert.deepEqual(colourwayRolesOf(doc), [], 'a single-lead system re-points nothing');
});

test('editability: a single-lead system answers with the lift, a lifted one yes, a system without looks no', () => {
  assert.deepEqual(colourwaysEditable(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' })), { ok: true });
  assert.deepEqual(colourwaysEditable(threeLeads(deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }))), { ok: true });
  const flat = colourwaysEditable({ color: { brand: { $value: '#123456' } } });
  assert.equal(flat.ok, false);
  refused(renameColourway({ color: {} }, 'x', 'y'), /no colourways yet/);
});
