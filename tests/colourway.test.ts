// SPDX-License-Identifier: MPL-2.0
/**
 * Colourways (plans/319): theme-group meaning, the selection precedence fix, the
 * indirection encoding, the lift's no-change guarantee, the family, rotation and
 * slot derivation. The fixtures are the two public design systems that ship in
 * this repository, so a change to either is tested here too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from '../engine/src/tokens.ts';
import { resolveTokenSelection } from '../engine/src/token-selection.ts';
import { withTokenSelection } from '../engine/src/token-context.ts';
import { readTokenAxes, modeAxis } from '../engine/src/token-axes.ts';
import { deriveBrandTokens, deriveColourwaySlots } from '../engine/src/brand-derive.ts';
import {
  addColourway, colourwayAxis, colourwayFamily, liftToColourways, pickColourway, withColourway,
  colourwaySetName, type ColourwayValues,
} from '../engine/src/colourway.ts';
import type { HostV1, TokenResolveOptions } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const FIXTURES: Record<string, () => Rec> = {
  'Lolly Start': () => load('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json'),
  'Lolly Demo': () => load('../brands/lolly-demo/catalog/assets/lolly/tokens/opal.json'),
  'a derived system': () => deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }),
};

const hex = (doc: unknown, path: string, opts: TokenResolveOptions = {}): string | undefined =>
  createTokenSet(doc, opts).colors().find(s => s.path === path)?.value;

const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};

function lifted(doc: Rec): Rec {
  const result = liftToColourways(doc, { id: 'main', name: 'Main' });
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  return result.doc;
}

function withPersimmon(doc: Rec): Rec {
  const result = addColourway(doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON });
  assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
  return result.doc;
}

// ─── Selection precedence ────────────────────────────────────────────────────

const threeGroups = (): Rec => ({
  base: { ink: { $type: 'color', $value: '#000000' }, step: { $type: 'number', $value: 1 }, voice: { $type: 'string', $value: 'plain' } },
  light: { ink: { $value: '#111111' } },
  dark: { ink: { $value: '#eeeeee' } },
  roomy: { step: { $value: 3 } },
  compact: { step: { $value: 2 } },
  warm: { voice: { $value: 'warm' } },
  crisp: { voice: { $value: 'crisp' } },
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'source', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'source', dark: 'enabled' } },
    { name: 'compact', group: 'density', selectedTokenSets: { compact: 'enabled' } },
    { name: 'roomy', group: 'density', selectedTokenSets: { roomy: 'enabled' } },
    { name: 'crisp', group: 'voice', selectedTokenSets: { crisp: 'enabled' } },
    { name: 'warm', group: 'voice', selectedTokenSets: { warm: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['base', 'light', 'dark', 'compact', 'roomy', 'crisp', 'warm'], activeThemeSelection: { '': 'dark', density: 'roomy', voice: 'warm' } },
});

test('a theme request decides only the group that declares it, with one, two and three groups', () => {
  const one = threeGroups();
  one.$themes = (one.$themes as Rec[]).slice(0, 2);
  assert.equal(createTokenSet(one, { theme: 'light' }).resolve('ink'), '#111111');
  assert.equal(createTokenSet(one, { theme: 'dark' }).resolve('ink'), '#eeeeee');

  const two = threeGroups();
  two.$themes = (two.$themes as Rec[]).slice(0, 4);
  const lightTwo = createTokenSet(two, { theme: 'light' });
  assert.equal(lightTwo.resolve('ink'), '#111111');
  assert.equal(lightTwo.resolve('step'), 3, 'density keeps the stored Roomy, not Compact, its first option');

  const three = createTokenSet(threeGroups(), { theme: 'light' });
  assert.deepEqual([three.resolve('ink'), three.resolve('step'), three.resolve('voice')], ['#111111', 3, 'warm']);
  const named = resolveTokenSelection(threeGroups(), { theme: 'density/compact' });
  assert.deepEqual(named.choices, { '': 'dark', density: 'compact', voice: 'warm' });
});

test('a theme beats an explicit selection only for its own group, and an unknown theme changes nothing else', () => {
  const both = resolveTokenSelection(threeGroups(), { theme: 'light', selection: { '': 'dark', density: 'compact' } });
  assert.deepEqual(both.choices, { '': 'light', density: 'compact', voice: 'crisp' }, 'voice is not in the explicit selection, so it falls to its first option');
  const unknown = resolveTokenSelection(threeGroups(), { theme: 'sepia' });
  assert.deepEqual(unknown.choices, { '': 'dark', density: 'roomy', voice: 'warm' });
  assert.match(unknown.diagnostics.map(d => d.message).join(' '), /Unknown theme sepia; the other choices are effective/);
});

test('every shipped single-group pack resolves a theme request exactly as an explicit choice', () => {
  for (const [label, make] of Object.entries(FIXTURES)) {
    const doc = make();
    for (const theme of ['light', 'dark']) {
      assert.deepEqual(createTokenSet(doc, { theme }).colors(), createTokenSet(doc, { selection: { '': theme } }).colors(), `${label} ${theme}`);
    }
  }
});

// ─── Axis meaning ────────────────────────────────────────────────────────────

test('axis kinds, canonical options, rotation and windows are read from entries and the root', () => {
  const doc = withPersimmon(lifted(FIXTURES['Lolly Demo']!()));
  const selection = resolveTokenSelection(doc);
  const groups = Object.fromEntries(selection.groups.map(g => [g.id, g]));
  assert.equal(groups['']!.kind, 'mode');
  assert.equal(groups['']!.canonical, 'light');
  assert.equal(groups.colourway!.kind, 'colourway');
  assert.equal(groups.colourway!.canonical, 'main');
  assert.deepEqual(groups.colourway!.options.map(o => o.id), ['main', 'persimmon']);
  const themes = createTokenSet(doc).themes();
  assert.deepEqual(themes.filter(t => t.group === 'colourway'), [
    { name: 'Main', group: 'colourway', id: 'main', kind: 'colourway', canonical: true },
    { name: 'Persimmon', group: 'colourway', id: 'persimmon', kind: 'colourway' },
  ]);
  assert.deepEqual(themes.filter(t => t.group === null).map(t => [t.kind, t.canonical]), [['mode', true], ['mode', undefined]]);
  assert.deepEqual(createTokenSet(FIXTURES['Lolly Demo']!()).themes(), [{ name: 'light', group: null }, { name: 'dark', group: null }], 'a group with no kind lists exactly as before');

  const rooted: Rec = {
    a: {}, b: {}, c: {},
    $themes: [
      { name: 'A', group: 'season', selectedTokenSets: { a: 'enabled' } },
      { name: 'B', group: 'season', selectedTokenSets: { b: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { window: { from: '2026-12-01', to: '2026-12-31' } } } } },
      { name: 'C', group: 'season', selectedTokenSets: { c: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'brand' } } } },
    ],
    $extensions: { 'com.suse.lolly': { themeAxes: { season: { kind: 'colourway', canonical: 'B', rotation: 'by-date' } } } },
  };
  const { axes, diagnostics } = readTokenAxes(rooted);
  assert.equal(axes[0]!.kind, 'brand', 'an entry wins over the root');
  assert.equal(axes[0]!.canonical, 'B');
  assert.equal(axes[0]!.rotation, 'by-date');
  assert.deepEqual(axes[0]!.options[1]!.window, { from: '2026-12-01', to: '2026-12-31' });
  assert.match(diagnostics.map(d => d.message).join(' '), /declares the kind colourway but The theme C in season declares brand/);
});

test('an unknown or malformed kind is reported and the group behaves as a plain theme group', () => {
  const doc: Rec = {
    x: {}, y: {},
    $themes: [
      { name: 'X', group: 'g', selectedTokenSets: { x: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 'flavour', canonical: true } } } },
      { name: 'Y', group: 'g', selectedTokenSets: { y: 'enabled' }, $extensions: { 'com.suse.lolly': { axis: { kind: 7, canonical: true, window: { from: 'soon' } } } } },
    ],
  };
  const selection = resolveTokenSelection(doc);
  assert.equal(selection.groups[0]!.kind, undefined);
  assert.equal(selection.groups[0]!.canonical, 'X', 'the first canonical mark wins');
  const text = selection.diagnostics.map(d => `${d.code}:${d.message}`).join('\n');
  assert.match(text, /unsupported:.*kind flavour/);
  assert.match(text, /type:.*kind that is not text/);
  assert.match(text, /marks 2 themes as canonical/);
  assert.match(text, /window from that is not an ISO date/);
});

// ─── Lifting ─────────────────────────────────────────────────────────────────

test('lifting a single-lead system changes nothing any look resolves to', () => {
  for (const [label, make] of Object.entries(FIXTURES)) {
    const doc = make();
    const next = lifted(doc);
    assert.notDeepEqual(next, doc);
    const axis = colourwayAxis(next);
    assert.ok(axis, label);
    assert.equal(axis.canonical, 'main');
    for (const theme of ['light', 'dark']) {
      const before = createTokenSet(doc, { theme }).colors();
      const after = createTokenSet(next, { theme }).colors();
      for (const swatch of before) assert.deepEqual(after.find(s => s.path === swatch.path), swatch, `${label} ${theme} ${swatch.path}`);
      assert.equal(createTokenSet(next, { theme }).resolve('color.semantic.primary'), createTokenSet(doc, { theme }).resolve('color.semantic.primary'));
    }
    assert.deepEqual(liftToColourways(next), { ok: true, doc: next }, `${label}: lifting twice is a no-op`);
    assert.deepEqual(doc, make(), `${label}: the source document is not modified`);
  }
});

test('the lift writes links in the looks and today\'s colours into the canonical colourway', () => {
  const next = lifted(FIXTURES['Lolly Demo']!());
  const light = (next.light as Rec).color as Rec;
  assert.equal(((light.semantic as Rec).primary as Rec).$value, '{color.colourway.light.primary}');
  assert.equal(((light.semantic as Rec).primary as Rec).$description, 'The accent: Spearmint, 13.3:1 with a Sugar label', 'the slot keeps its description');
  assert.equal(((light.semantic as Rec).text as Rec).$value, '{color.brand.liquorice}', 'slots a colourway does not re-point stay literal');
  const main = next[colourwaySetName('main')] as Rec;
  assert.equal(((((main.color as Rec).colourway as Rec).dark as Rec).primary as Rec).$value, '{color.brand.green-apple}');
  assert.deepEqual((next.$metadata as Rec).tokenSetOrder, ['base', 'light', 'dark', 'colourway/main']);
});

test('the lift refuses documents it cannot re-point without a visible change', () => {
  assert.equal(liftToColourways({ color: { a: { $type: 'color', $value: '#fff' } } }).ok, false);
  const inked = FIXTURES['Lolly Start']!();
  ((((inked.light as Rec).color as Rec).semantic as Rec).primary as Rec).$extensions = { 'com.suse.lolly': { cmyk: [0, 0, 0, 100] } };
  const refused = liftToColourways(inked);
  assert.equal(refused.ok, false);
  assert.match(refused.ok ? '' : refused.reasons.join(' '), /carries its own cmyk/);
  const clash = liftToColourways(FIXTURES['Lolly Start']!(), { id: 'dark' });
  assert.match(clash.ok ? '' : clash.reasons.join(' '), /already has a theme called dark/);
  assert.match((() => { const r = liftToColourways(FIXTURES['Lolly Start']!(), { id: 'Bad Id' }); return r.ok ? '' : r.reasons.join(' '); })(), /not a usable colourway id/);
});

// ─── Adding colourways ───────────────────────────────────────────────────────

test('a colourway re-points the lead in every look and leaves the rest of the system alone', () => {
  for (const [label, make] of Object.entries(FIXTURES)) {
    const doc = withPersimmon(make());
    for (const mode of ['light', 'dark'] as const) {
      const canonical = { selection: { '': mode } };
      const persimmon = { selection: { '': mode, colourway: 'persimmon' } };
      assert.equal(hex(doc, 'color.semantic.primary', canonical), hex(make(), 'color.semantic.primary', { theme: mode }), `${label} ${mode} canonical`);
      assert.equal(hex(doc, 'color.semantic.primary', persimmon), PERSIMMON[mode]!.primary, `${label} ${mode} persimmon`);
      assert.equal(hex(doc, 'color.semantic.on-primary', persimmon), PERSIMMON[mode]!['on-primary']);
      assert.equal(hex(doc, 'color.semantic.secondary', persimmon), PERSIMMON[mode]!.secondary);
      for (const slot of ['surface', 'text', 'muted', 'edge']) {
        assert.equal(hex(doc, `color.semantic.${slot}`, persimmon), hex(make(), `color.semantic.${slot}`, { theme: mode }), `${label} ${mode} ${slot}`);
      }
    }
  }
});

test('a colourway can tint the surface while every other colourway keeps its own', () => {
  const base = withPersimmon(FIXTURES['Lolly Demo']!());
  const tinted = addColourway(base, {
    id: 'waterhole', name: 'Waterhole',
    values: { light: { primary: '#0369a1', 'on-primary': '#ffffff', secondary: '#0c4a6e', surface: '#f0f9ff' }, dark: { primary: '#38bdf8', 'on-primary': '#0b1120', secondary: '#bae6fd' } },
  });
  assert.ok(tinted.ok);
  const doc = tinted.doc;
  const surface = (mode: string, colourway: string) => hex(doc, 'color.semantic.surface', { selection: { '': mode, colourway } });
  assert.equal(surface('light', 'waterhole'), '#f0f9ff');
  assert.equal(surface('dark', 'waterhole'), hex(base, 'color.semantic.surface', { theme: 'dark' }), 'a look with no tint keeps the canonical surface');
  assert.equal(surface('light', 'main'), hex(base, 'color.semantic.surface', { theme: 'light' }));
  assert.equal(surface('light', 'persimmon'), hex(base, 'color.semantic.surface', { theme: 'light' }));
});

test('adding a colourway validates its id, name and colours', () => {
  const doc = FIXTURES['Lolly Start']!();
  const reasons = (opts: Parameters<typeof addColourway>[1]) => { const r = addColourway(doc, opts); return r.ok ? '' : r.reasons.join(' '); };
  assert.match(reasons({ id: 'light', name: 'Light', values: PERSIMMON }), /already has a theme called light/);
  assert.match(reasons({ id: 'p', name: ' ', values: PERSIMMON }), /needs a name/);
  assert.match(reasons({ id: 'p', name: 'P', values: { light: PERSIMMON.light! } }), /Give the dark colours/);
  assert.match(reasons({ id: 'p', name: 'P', values: { ...PERSIMMON, light: { ...PERSIMMON.light!, primary: 'not a colour' } } }), /light primary for P is not a colour/);
});

test('the theme fix carries a document\'s colourway through hooks that ask for light or dark', async () => {
  const doc = withPersimmon(FIXTURES['Lolly Start']!());
  assert.equal(hex(doc, 'color.semantic.primary', { theme: 'dark', selection: { colourway: 'persimmon' } }), PERSIMMON.dark!.primary);
  const host = {
    tokens: {
      get: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts),
      colors: async (opts?: TokenResolveOptions) => createTokenSet(doc, opts).colors(),
      resolve: async (ref: string, opts?: TokenResolveOptions) => createTokenSet(doc, opts).resolve(ref),
      themes: async () => createTokenSet(doc).themes(),
    },
  } as unknown as HostV1;
  const scoped = withTokenSelection(host, { '': 'dark', colourway: 'persimmon' });
  const light = await scoped.tokens!.colors({ theme: 'light' });
  assert.equal(light.find(s => s.path === 'color.semantic.primary')?.value, PERSIMMON.light!.primary, 'deck-studio style colors({ theme: "light" }) keeps Persimmon');
});

test('a stored choice survives adding another colourway', () => {
  const two = withPersimmon(FIXTURES['Lolly Demo']!());
  const stored = { '': 'light', colourway: 'persimmon' };
  const before = hex(two, 'color.semantic.primary', { selection: stored });
  const three = addColourway(two, { id: 'waterhole', name: 'Waterhole', values: { light: { primary: '#0369a1', 'on-primary': '#ffffff', secondary: '#0c4a6e' }, dark: { primary: '#38bdf8', 'on-primary': '#0b1120', secondary: '#bae6fd' } } });
  assert.ok(three.ok);
  assert.equal(hex(three.doc, 'color.semantic.primary', { selection: stored }), before);
  // ...while a policy picks differently for new work once the list grows.
  assert.equal(pickColourway(colourwayAxis(two)!, 'cycle', { index: 2 }).option, 'main');
  assert.equal(pickColourway(colourwayAxis(three.doc)!, 'cycle', { index: 2 }).option, 'waterhole');
});

// ─── The family ──────────────────────────────────────────────────────────────

test('the family lists every lead canonical first and follows the look', () => {
  const make = FIXTURES['Lolly Demo']!;
  const doc = withPersimmon(make());
  assert.deepEqual(colourwayFamily(doc, 'primary', { '': 'light' }).map(l => [l.id, l.canonical, l.value]), [
    ['main', true, hex(make(), 'color.semantic.primary', { theme: 'light' })],
    ['persimmon', false, PERSIMMON.light!.primary],
  ]);
  assert.deepEqual(colourwayFamily(doc, 'primary', { '': 'dark' }).map(l => l.value), [hex(make(), 'color.semantic.primary', { theme: 'dark' }), PERSIMMON.dark!.primary]);
  assert.deepEqual(colourwayFamily(doc, 'color.semantic.secondary', { '': 'dark' })[1]!.value, PERSIMMON.dark!.secondary);
  assert.deepEqual(colourwayFamily(make()), [], 'a system with one lead has no family');
});

// ─── Rotation ────────────────────────────────────────────────────────────────

const fourLeads = () => {
  let doc: Rec = FIXTURES['Lolly Start']!();
  for (const id of ['jungle', 'persimmon', 'waterhole']) {
    const r = addColourway(doc, { id, name: id, values: PERSIMMON });
    assert.ok(r.ok);
    doc = r.doc;
  }
  return colourwayAxis(doc)!;
};

test('canonical and cycle pick in series order, canonical first', () => {
  const axis = fourLeads();
  assert.equal(pickColourway(axis, 'canonical', { index: 3 }).option, 'main');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(index => pickColourway(axis, 'cycle', { index }).option), ['main', 'jungle', 'persimmon', 'waterhole', 'main', 'jungle']);
  assert.deepEqual(pickColourway(axis, 'cycle', { index: -2 }), { group: 'colourway', option: 'main' });
  assert.deepEqual(withColourway({ '': 'dark' }, pickColourway(axis, 'cycle', { index: 1 })), { '': 'dark', colourway: 'jungle' });
});

test('by-key gives the same key the same lead, with values pinned so every host agrees', () => {
  const axis = fourLeads();
  const picks = ['Ada', 'Grace', 'Linus', 'Ada', ''].map(key => pickColourway(axis, 'by-key', { key }).option);
  assert.equal(picks[0], picks[3]);
  assert.equal(picks[4], 'main', 'no key means canonical');
  // Pinned: FNV-1a over UTF-16 code units, mod 4 (Ada 2596513115, Grace 1107553291,
  // Linus 2314400108, checked outside JavaScript). A change here changes what every
  // planned series would pick.
  assert.deepEqual(picks.slice(0, 3), ['waterhole', 'waterhole', 'main']);
});

test('shuffle uses every lead once per round, repeats for a seed and differs between seeds', () => {
  const axis = fourLeads();
  const run = (seed: number | string) => Array.from({ length: 12 }, (_, index) => pickColourway(axis, 'shuffle', { seed, index }).option);
  const a = run('launch-2026');
  assert.deepEqual(a, run('launch-2026'));
  for (let round = 0; round < 3; round++) assert.deepEqual([...a.slice(round * 4, round * 4 + 4)].sort(), ['jungle', 'main', 'persimmon', 'waterhole'], `round ${round}`);
  assert.notDeepEqual(a, run('launch-2027'));
  assert.deepEqual(run(7), run(7));
  // Pinned so a change to the generator or the per-round seed is noticed.
  assert.deepEqual(a.slice(0, 8), ['jungle', 'main', 'waterhole', 'persimmon', 'waterhole', 'jungle', 'persimmon', 'main']);
  assert.equal(pickColourway(axis, 'shuffle', { index: 2 }).option, 'main', 'no seed means canonical');
});

test('by-date picks the colourway whose window contains the date, else canonical', () => {
  const axis = fourLeads();
  axis.options[2]!.window = { from: '2026-12-01', to: '2026-12-31' };
  axis.options[3]!.window = { from: '2027-01-01' };
  assert.equal(pickColourway(axis, 'by-date', { date: '2026-12-25' }).option, 'persimmon');
  assert.equal(pickColourway(axis, 'by-date', { date: '2026-11-30' }).option, 'main');
  assert.equal(pickColourway(axis, 'by-date', { date: '2027-06-01T09:00:00Z' }).option, 'waterhole');
  assert.equal(pickColourway(axis, 'by-date', {}).option, 'main');
});

// ─── Slot derivation ─────────────────────────────────────────────────────────

test('a derived colourway matches what a whole derived system gives the same colour', () => {
  for (const primary of ['#2453ff', '#0c322c', '#ffd400', 'oklch(0.62 0.18 30)']) {
    for (const contrast of ['comfort', 'high'] as const) {
      for (const foreground of ['auto', 'light'] as const) {
        const system = deriveBrandTokens({ primary, contrast, foreground, scheme: 'complement' });
        for (const mode of ['light', 'dark'] as const) {
          const set = createTokenSet(system, { theme: mode });
          const slots = deriveColourwaySlots(primary, { mode, contrast, foreground, scheme: 'complement' });
          assert.deepEqual(slots, {
            primary: set.resolve('color.semantic.primary'),
            'on-primary': set.resolve('color.semantic.on-primary'),
            secondary: set.resolve('color.semantic.secondary'),
          }, `${primary} ${contrast} ${foreground} ${mode}`);
        }
      }
    }
  }
  assert.throws(() => deriveColourwaySlots('nope', { mode: 'light' }), /unparseable lead/);
});

test('derived slots drop straight into a new colourway', () => {
  const doc = FIXTURES['Lolly Start']!();
  const values = { light: deriveColourwaySlots('#e05a2b', { mode: 'light' }), dark: deriveColourwaySlots('#e05a2b', { mode: 'dark' }) };
  const r = addColourway(doc, { id: 'ember', name: 'Ember', values });
  assert.ok(r.ok);
  const mode = modeAxis(readTokenAxes(r.doc).axes);
  assert.equal(mode?.kind, 'mode');
  assert.equal(createTokenSet(r.doc, { selection: { colourway: 'ember' } }).resolve('color.semantic.primary'), values.light.primary);
});

// ─── Writers that carry the selection ────────────────────────────────────────

test('a Penpot export of a system with colourways opens with a colourway on, so the links resolve', async () => {
  const { penpotTokensJson } = await import('../engine/src/penpot-file.ts');
  const doc = withPersimmon(FIXTURES['Lolly Start']!());
  const out = penpotTokensJson(doc)!;
  const meta = out.$metadata as Rec;
  assert.deepEqual(meta.activeThemes, ['light', 'Main']);
  assert.ok((meta.activeSets as string[]).includes(colourwaySetName('main')));
  const dark = penpotTokensJson(doc, { activeThemes: ['dark', 'colourway/Persimmon'] })!;
  assert.deepEqual((dark.$metadata as Rec).activeThemes, ['dark', 'colourway/Persimmon']);
  assert.deepEqual((penpotTokensJson(FIXTURES['Lolly Start']!())!.$metadata as Rec).activeThemes, ['light'], 'one group: unchanged');
  // The canonical mark, not list order, decides which colourway the file opens on.
  for (const t of doc.$themes as Rec[]) {
    if (t.group !== 'colourway') continue;
    ((t.$extensions as Rec)['com.suse.lolly'] as Rec).axis = { kind: 'colourway', canonical: t.id === 'persimmon' };
  }
  assert.deepEqual((penpotTokensJson(doc)!.$metadata as Rec).activeThemes, ['light', 'Persimmon']);
});

test('the CLI\'s --themes=all exports each look once, and a named colourway exports in it', async () => {
  const { themeRuns } = await import('../shells/cli/src/themes.ts');
  const doc = withPersimmon(FIXTURES['Lolly Start']!());
  assert.deepEqual(themeRuns(doc, 'all'), [
    { theme: 'light', selection: { '': 'light', colourway: 'main' } },
    { theme: 'dark', selection: { '': 'dark', colourway: 'main' } },
  ]);
  assert.deepEqual(themeRuns(doc, 'Persimmon'), [{ theme: 'Persimmon', selection: { '': 'light', colourway: 'persimmon' } }]);
});

test('the design brief lists colourways apart from the looks, and only when there are some', async () => {
  const { designBrief } = await import('../engine/src/design-brief.ts');
  const plain = designBrief(FIXTURES['Lolly Start']!());
  assert.equal('colourways' in plain, false);
  const brief = designBrief(withPersimmon(FIXTURES['Lolly Start']!())) as ReturnType<typeof designBrief> & { colourways?: { group: string; canonical: string; options: { id: string; slots: Record<string, Record<string, string>> }[] } };
  assert.deepEqual(brief.themes.map(t => t.name), plain.themes.map(t => t.name));
  assert.deepEqual(brief.themes, plain.themes, 'the looks read exactly as before');
  const colourways = brief.colourways;
  assert.ok(colourways);
  assert.equal(colourways.group, 'colourway');
  assert.equal(colourways.canonical, 'main');
  assert.equal(colourways.options[1]!.slots.dark!.primary, PERSIMMON.dark!.primary);
});
