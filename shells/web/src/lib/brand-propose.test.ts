// SPDX-License-Identifier: MPL-2.0
/**
 * Unit coverage for the usage-derived brand proposal (brand-propose.ts) on
 * SYNTHETIC PenpotUsage fixtures - the role heuristic, the essential
 * surface-shade exclusion, scheme classification, the text contrast pick, the
 * font role/source split, and doc composition. The real-file replay of the
 * same pipeline lives in the gated tests/penpot-keynote-replay.test.ts.
 *
 * Run with: node --test shells/web/src/lib/brand-propose.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { PenpotUsage, PenpotUsageColor, PenpotUsageGradient, PenpotAppliedToken } from '@lolly/engine';
import { adoptColourRoles, createTokenSet, danglingColourAliases, deriveBrandTokens, readColourRoles } from '@lolly/engine';
import { readFileSync } from 'node:fs';
import {
  colourRoleSpecs, proposeBrandRoles, proposeColourRoles, proposeFonts, buildBrandDocFromUsage,
  proposeRolesFromTokens, proposeFontsFromTokens, withRoleAliases, ROLE_SET_NAME,
} from './brand-propose.ts';
import type { ColourRoleChoice, ColourRoleProposal } from './brand-propose.ts';
import { listStudioTokens } from './token-studio.ts';

type FontRow = PenpotUsage['fonts'][number];

function color(hex: string, o: Partial<Omit<PenpotUsageColor, 'hex' | 'total'>> = {}): PenpotUsageColor {
  const fills = o.fills ?? 0, strokes = o.strokes ?? 0, textRuns = o.textRuns ?? 0, gradientStops = o.gradientStops ?? 0;
  return { hex, fills, strokes, textRuns, gradientStops, total: fills + strokes + textRuns + gradientStops };
}

function usage(o: { colors?: PenpotUsageColor[]; gradients?: PenpotUsageGradient[]; fonts?: FontRow[] } = {}): PenpotUsage {
  return { colors: o.colors ?? [], gradients: o.gradients ?? [], fonts: o.fonts ?? [] };
}

function grad(stops: [string, number][], count = 1, angle = 180): PenpotUsageGradient {
  return { type: 'linear', stops: stops.map(([c, off]) => ({ color: c, offset: off, opacity: 1 })), count, angle };
}

function font(fontId: string, fontFamily: string, runs: number, weight = 400): FontRow {
  return { fontId, fontFamily, fontVariantId: String(weight), fontWeight: weight, fontStyle: 'normal', runs };
}

// The keynote's decisive quartet, in miniature: a dark surface, its gradient
// shade whose weight x chroma score BEATS the real secondary, and two accents.
const QUARTET = [
  color('#151035', { fills: 1066 }),          // surface (dark, L 0.205)
  color('#F23AE5', { fills: 95 }),            // primary (C 0.274, score ~26)
  color('#312470', { gradientStops: 76 }),    // surface shade (score ~9.5 if left in)
  color('#14CECA', { fills: 57 }),            // real secondary (score ~7.4)
];

test('proposeBrandRoles: null when the census carries no colours', () => {
  assert.equal(proposeBrandRoles(usage()), null);
});

test('proposeBrandRoles: surface is the top fill colour, look follows its lightness', () => {
  const dark = proposeBrandRoles(usage({ colors: [color('#151035', { fills: 9 }), color('#F23AE5', { fills: 5 })] }))!;
  assert.equal(dark.surface, '#151035');
  assert.equal(dark.surfaceLook, 'dark');
  assert.equal(dark.text, '#FFFFFF', 'no text runs → white on a dark surface');

  const light = proposeBrandRoles(usage({ colors: [color('#F9FAFF', { fills: 9 }), color('#F23AE5', { fills: 5 })] }))!;
  assert.equal(light.surface, '#F9FAFF');
  assert.equal(light.surfaceLook, 'light');
  assert.equal(light.text, '#000000', 'no text runs → black on a light surface');
});

test('proposeBrandRoles: the surface-shade exclusion is decisive for secondary', () => {
  // With the shade co-occurring beside the surface in a gradient, it leaves
  // the accent pool and the lower-scoring true accent becomes secondary.
  const excluded = proposeBrandRoles(usage({
    colors: QUARTET,
    gradients: [grad([['#151035', 0], ['#312470', 1]], 76)],
  }))!;
  assert.equal(excluded.primary, '#F23AE5');
  assert.equal(excluded.secondary, '#14CECA');
  assert.ok(!excluded.extras.includes('#312470'), 'the shade never reaches the pool');

  // Control: the SAME weights without the co-occurrence - the shade's higher
  // score wins, proving the exclusion (not the scores) made the call above.
  const kept = proposeBrandRoles(usage({
    colors: QUARTET,
    gradients: [grad([['#312470', 0], ['#FFFFFF', 1]], 76)],
  }))!;
  assert.equal(kept.secondary, '#312470');
});

test('proposeBrandRoles: scheme is the nearest named hue relationship', () => {
  const pair = (a: string, b: string) => proposeBrandRoles(usage({
    colors: [color('#111111', { fills: 9 }), color(a, { fills: 5 }), color(b, { fills: 4 })],
  }))!;
  assert.equal(pair('#FF0000', '#00FFFF').scheme, 'complement', 'a ~165 degree arc');
  assert.equal(pair('#FF0000', '#FFAA00').scheme, 'analogous', 'a ~44 degree arc');
  assert.equal(pair('#F23AE5', '#14CECA').scheme, 'triad', 'the keynote pair, a 139 degree arc');

  const lone = proposeBrandRoles(usage({ colors: [color('#111111', { fills: 9 }), color('#FF0000', { fills: 5 })] }))!;
  assert.equal(lone.secondary, null, 'one accent → no secondary');
  assert.equal(lone.scheme, 'mono');
});

test('proposeBrandRoles: text is the most frequent run colour that clears 4.5:1', () => {
  const roles = proposeBrandRoles(usage({
    colors: [
      color('#151035', { fills: 9, textRuns: 58 }),  // most runs, but 1:1 on itself
      color('#FFFFFF', { textRuns: 49 }),            // passes at ~18:1
      color('#F23AE5', { fills: 5, textRuns: 10 }),  // passes at ~5.6:1 but fewer runs
    ],
  }))!;
  assert.equal(roles.text, '#FFFFFF');
});

test('proposeFonts: brand by runs, mono by name, sources split', () => {
  const fonts = proposeFonts(usage({
    fonts: [
      font('gfont-work-sans', 'Work Sans', 10, 700),
      font('gfont-spline-sans-mono', 'Spline Sans Mono', 2, 700),
      font('custom-foo', 'Foo', 1),
    ],
  }));
  assert.equal(fonts.brand, 'Work Sans');
  assert.equal(fonts.mono, 'Spline Sans Mono');
  assert.deepEqual(fonts.google, ['Work Sans', 'Spline Sans Mono']);
  assert.deepEqual(fonts.missing, ['Foo']);

  assert.deepEqual(proposeFonts(usage()), { brand: null, mono: null, google: [], missing: [] });
});

test('buildBrandDocFromUsage: composes a resolvable doc with the observed roles', () => {
  const u = usage({
    colors: [...QUARTET, color('#C8A2FF', { fills: 24 }), color('#FF8800', { strokes: 12 })],
    gradients: [
      grad([['#151035', 0], ['#312470', 1]], 74, 180),
      grad([['#FF1EBD', 0], ['#BF98FF', 1]], 9, 180),
      grad([['#F23AE5', 0], ['#14CECA', 1]], 2, 270),
      grad([['#FFFFFF', 0], ['#FFFFFF', 1]], 1, 180),
    ],
    fonts: [
      font('gfont-work-sans', 'Work Sans', 10, 700),
      font('gfont-spline-sans-mono', 'Spline Sans Mono', 2, 700),
      font('custom-foo', 'Foo', 1),
    ],
  });
  const { doc, roles, fonts, gradientCount } = buildBrandDocFromUsage(u, 'Fixture', { keepExtras: ['#C8A2FF', '#00FF00'] });

  assert.equal(roles.primary, '#F23AE5');
  assert.equal(roles.secondary, '#14CECA');
  assert.ok(roles.extras.includes('#C8A2FF'));

  // The observed secondary is pinned as a LITERAL in both theme sets.
  for (const set of ['light', 'dark'] as const) {
    const leaf = ((doc[set] as any).color.semantic as any).secondary;
    assert.equal(leaf.$value, '#14CECA', `${set}: semantic secondary detached to the literal`);
  }

  // Only kept extras that were actually proposed become custom swatches.
  const custom = ((doc.base as any).color.custom ?? {}) as Record<string, unknown>;
  const customKeys = Object.keys(custom).filter(k => !k.startsWith('$'));
  assert.equal(customKeys.length, 1, 'the un-proposed keepExtras entry is ignored');

  // Top three gradients became tokens, angle riding the vendor extension.
  assert.equal(gradientCount, 3);
  const gradTokens = listStudioTokens(doc).filter(t => t.kind === 'gradient');
  assert.equal(gradTokens.length, 3);
  const g1 = gradTokens.find(t => t.key === 'gradient.file-gradient-1')!;
  assert.equal(g1.angle, 180);
  assert.deepEqual((g1.raw as Array<{ color: string }>).map(s => s.color), ['#151035', '#312470']);
  const g3 = gradTokens.find(t => t.key === 'gradient.file-gradient-3')!;
  assert.equal(g3.angle, 270);

  // Font roles ride the doc so carryUserFontTokens keeps them on install.
  assert.deepEqual((doc.base as any).font.brand.$value, ['Work Sans']);
  assert.deepEqual((doc.base as any).font.mono.$value, ['Spline Sans Mono']);
  assert.deepEqual(fonts.missing, ['Foo']);

  assert.throws(() => buildBrandDocFromUsage(usage(), 'Empty'), /No colours/);
});

// ── Token-first proposal ────────────────────────────────────────────────────
// The declared-token path: roles ranked by the applied census, bridged through
// the paint census when a file declares tokens but references none, and falling
// back to the same chroma/hue guard rails when neither says anything.

function applied(rows: Array<Partial<PenpotAppliedToken> & { name: string }>): PenpotAppliedToken[] {
  return rows.map(r => {
    const fills = r.fills ?? 0, strokes = r.strokes ?? 0, text = r.text ?? 0, type = r.type ?? 0, geometry = r.geometry ?? 0;
    return { name: r.name, fills, strokes, text, type, geometry, total: fills + strokes + text + type + geometry };
  });
}

// A small declared brand: an ink neutral, a magenta, a teal, a near-white page.
const DECLARED = {
  color: {
    $type: 'color',
    page: { $value: '#F9FAFF' },
    ink: { $value: '#151035' },
    magenta: { $value: '#F23AE5' },
    teal: { $value: '#14CECA' },
  },
};

test('proposeRolesFromTokens: null when the doc declares no usable colour tokens', () => {
  assert.equal(proposeRolesFromTokens({ spacing: { sm: { $value: '4px', $type: 'dimension' } } }, []), null);
  assert.equal(proposeRolesFromTokens(null, []), null);
});

test('proposeRolesFromTokens: the applied census ranks the roles and refs name the tokens', () => {
  const roles = proposeRolesFromTokens(DECLARED, applied([
    { name: 'color.ink', fills: 40 },      // most-filled → surface
    { name: 'color.magenta', fills: 12 },  // top accent by weight x chroma
    { name: 'color.teal', fills: 3 },
    { name: 'color.page', text: 9 },       // reads on the dark surface → text
  ]))!;
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.surfaceLook, 'dark');
  assert.equal(roles.primary, '#F23AE5');
  assert.equal(roles.secondary, '#14CECA');
  assert.equal(roles.text, '#F9FAFF');
  assert.deepEqual(roles.refs, {
    primary: 'color.magenta', surface: 'color.ink', secondary: 'color.teal', text: 'color.page',
  });
});

test('proposeRolesFromTokens: the census beats raw paint frequency when they disagree', () => {
  // The file paints the page colour most, but the designer applied the ink
  // token to the most fills - the declared intent wins.
  const paint = usage({ colors: [color('#F9FAFF', { fills: 900 }), color('#151035', { fills: 4 })] });
  const roles = proposeRolesFromTokens(DECLARED, applied([
    { name: 'color.ink', fills: 40 },
    { name: 'color.magenta', fills: 12 },
  ]), paint)!;
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.refs.surface, 'color.ink');
});

test('proposeRolesFromTokens: an empty census bridges through the usage hexes', () => {
  const paint = usage({
    colors: [color('#F9FAFF', { fills: 200 }), color('#F23AE5', { fills: 30 }), color('#14CECA', { fills: 8 }), color('#151035', { textRuns: 12 })],
  });
  const roles = proposeRolesFromTokens(DECLARED, [], paint)!;
  assert.equal(roles.surface, '#F9FAFF', 'the most-painted declared colour is the surface');
  assert.equal(roles.refs.surface, 'color.page');
  assert.equal(roles.primary, '#F23AE5');
  assert.equal(roles.text, '#151035');
});

test('proposeRolesFromTokens: with no census at all the guard rails still pick sane roles', () => {
  const roles = proposeRolesFromTokens(DECLARED, [])!;
  assert.equal(roles.surface, '#F9FAFF', 'the least colourful declared colour is the surface');
  assert.ok(roles.primary === '#F23AE5' || roles.primary === '#14CECA');
  assert.equal(roles.text, '#000000', 'nothing declared clears the contrast floor → plain black');
  assert.equal(roles.refs.text, undefined);
});

test('proposeRolesFromTokens: a low-chroma-only doc still returns a primary', () => {
  const greys = { color: { $type: 'color', a: { $value: '#FFFFFF' }, b: { $value: '#888888' } } };
  const roles = proposeRolesFromTokens(greys, [])!;
  assert.ok(roles.primary);
  assert.equal(roles.secondary, null);
  assert.equal(roles.scheme, 'mono');
});

test('proposeRolesFromTokens: a colour sharing a gradient with the surface is not an accent', () => {
  const doc = {
    color: {
      $type: 'color',
      ink: { $value: '#151035' },
      shade: { $value: '#312470' },
      teal: { $value: '#14CECA' },
    },
  };
  const paint = usage({
    colors: [color('#151035', { fills: 90 }), color('#312470', { gradientStops: 76 }), color('#14CECA', { fills: 5 })],
    gradients: [grad([['#151035', 0], ['#312470', 1]], 38)],
  });
  const roles = proposeRolesFromTokens(doc, [], paint)!;
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.primary, '#14CECA', 'the surface shade never out-scores the real accent');
});

test('proposeFontsFromTokens: typography tokens rank by the census, families come off the composite', () => {
  const doc = {
    type: {
      body: { $type: 'typography', $value: { fontFamilies: ['Work Sans'], fontSizes: '16px' } },
      code: { $type: 'typography', $value: { fontFamilies: ['Spline Sans Mono'] } },
    },
  };
  const fonts = proposeFontsFromTokens(doc, applied([{ name: 'type.code', type: 40 }, { name: 'type.body', type: 3 }]));
  assert.equal(fonts.brand, 'Spline Sans Mono');
  assert.equal(fonts.mono, 'Spline Sans Mono');
  assert.deepEqual(fonts.google, [], 'a token doc never claims a fetchable source');
  assert.deepEqual(fonts.missing, ['Spline Sans Mono', 'Work Sans']);
});

test('withRoleAliases: a plain DTCG doc gets color.semantic aliases, input untouched', () => {
  const doc: Record<string, unknown> = { ...DECLARED };
  const out = withRoleAliases(doc, { primary: 'color.magenta', surface: 'color.ink' });
  assert.notEqual(out, doc);
  assert.equal((doc.color as Record<string, unknown>).semantic, undefined, 'the input doc is never mutated');
  const ts = createTokenSet(out);
  assert.equal(ts.resolve('color.semantic.primary'), '#F23AE5');
  assert.equal(ts.resolve('color.semantic.surface'), '#151035');
});

test('withRoleAliases: a layered doc gets its own set, ordered last and enabled everywhere', () => {
  const doc: Record<string, unknown> = {
    Base: { color: { $type: 'color', magenta: { $value: '#F23AE5' } } },
    $themes: [{ name: 'Light', selectedTokenSets: { Base: 'enabled' } }],
    $metadata: { tokenSetOrder: ['Base'] },
  };
  const out = withRoleAliases(doc, { primary: 'color.magenta' });
  assert.ok(Object.hasOwn(out, ROLE_SET_NAME), 'roles land in a set, not beside the sets');
  assert.deepEqual((out.$metadata as Record<string, unknown>).tokenSetOrder, ['Base', ROLE_SET_NAME]);
  assert.equal((out.$themes as Array<Record<string, Record<string, string>>>)[0]!.selectedTokenSets![ROLE_SET_NAME], 'enabled');
  assert.equal(createTokenSet(out).resolve('color.semantic.primary'), '#F23AE5');
  assert.equal((doc.$themes as Array<Record<string, Record<string, string>>>)[0]!.selectedTokenSets![ROLE_SET_NAME], undefined);
});

test('withRoleAliases: no refs → the doc passes through unchanged', () => {
  const doc: Record<string, unknown> = { ...DECLARED };
  assert.equal(withRoleAliases(doc, {}), doc);
});

// ── Themed files: the role follows the theme (plan 320 P1, S2) ──────────────
// The Northwind shape from the first-user study: a core palette, a semantic set
// that declares `color.primary`, and one set per product that overrides that
// token. Choosing the most colourful core token (`color.sky`) as the primary
// pinned every product to sky blue; the name is the designer saying which token
// each product overrides.
function northwind(semantic: Record<string, unknown> = {}): Record<string, unknown> {
  const product = (primary: string, surface: string) => ({ color: { primary: { $value: primary, $type: 'color' }, surface: { $value: surface, $type: 'color' } } });
  return {
    core: { color: {
      navy: { $value: '#1F3A93', $type: 'color' }, sky: { $value: '#4A6FE3', $type: 'color' },
      ink: { $value: '#0B1533', $type: 'color' }, mist: { $value: '#F3F5FA', $type: 'color' },
    } },
    'semantic/northwind': { color: {
      primary: { $value: '{color.navy}', $type: 'color' }, secondary: { $value: '{color.sky}', $type: 'color' },
      text: { $value: '{color.ink}', $type: 'color' }, surface: { $value: '{color.mist}', $type: 'color' },
      ...semantic,
    } },
    'product/pulse': product('#F0563A', '#FDECE8'),
    'product/tide': product('#0E9F8E', '#E8F6F4'),
    $themes: [
      { id: 't-nw', name: 'Northwind', group: 'Product', selectedTokenSets: { core: 'source', 'semantic/northwind': 'enabled' } },
      { id: 't-pulse', name: 'Pulse', group: 'Product', selectedTokenSets: { core: 'source', 'semantic/northwind': 'enabled', 'product/pulse': 'enabled' } },
      { id: 't-tide', name: 'Tide', group: 'Product', selectedTokenSets: { core: 'source', 'semantic/northwind': 'enabled', 'product/tide': 'enabled' } },
    ],
    $metadata: { tokenSetOrder: ['core', 'semantic/northwind', 'product/pulse', 'product/tide'] },
  };
}
const inProduct = (doc: unknown, id: string) => createTokenSet(doc, { selection: { Product: id } });

test('proposeRolesFromTokens: a themed file says which token each role is, and every product keeps its own colour', () => {
  const doc = northwind();
  const roles = proposeRolesFromTokens(doc, [], null)!;
  assert.deepEqual(roles.refs, { primary: 'color.primary', surface: 'color.surface', secondary: 'color.secondary', text: 'color.text' },
    'the declared names win over chroma: sky is more colourful than navy but is not the primary');
  const installed = withRoleAliases(doc, roles.refs);
  assert.equal(inProduct(installed, 't-pulse').resolve('color.semantic.primary'), '#F0563A');
  assert.equal(inProduct(installed, 't-tide').resolve('color.semantic.primary'), '#0E9F8E');
  assert.equal(inProduct(installed, 't-nw').resolve('color.semantic.primary'), '#1F3A93');
  assert.equal(inProduct(installed, 't-pulse').resolve('color.semantic.surface'), '#FDECE8');
});

test('proposeRolesFromTokens: a name that some theme leaves undefined does not win', () => {
  const doc = northwind();
  // `color.brand` exists only in Pulse, so Northwind and Tide would resolve the role to nothing.
  (doc['product/pulse'] as { color: Record<string, unknown> }).color.brand = { $value: '#F0563A', $type: 'color' };
  delete (doc['semantic/northwind'] as { color: Record<string, unknown> }).color.primary;
  const roles = proposeRolesFromTokens(doc, [], null)!;
  assert.notEqual(roles.refs.primary, 'color.brand');
});

test('withRoleAliases: a role the file already declares keeps its own definition', () => {
  const doc = northwind({ semantic: { primary: { $value: '{color.primary}', $type: 'color' } } });
  const roles = proposeRolesFromTokens(doc, [], null)!;
  assert.equal(roles.refs.primary, 'color.semantic.primary', "Lolly's own role path outranks every other name");
  const installed = withRoleAliases(doc, roles.refs);
  const set = installed[ROLE_SET_NAME] as { color: { semantic: Record<string, unknown> } };
  assert.equal(set.color.semantic.primary, undefined, 'no alias from the role to itself');
  assert.equal(inProduct(installed, 't-pulse').resolve('color.semantic.primary'), '#F0563A');
});

// ── Colour roles from a file's own words (plans/352 R4) ──────────────────────

const TEXTILE = {
  color: {
    $type: 'color',
    main: { $value: '#1b2a6b' }, accent: { $value: '#b23a48' }, supporting: { $value: '#6c7a89', $description: 'The selvedge' },
    tertiary: { $value: '#d9c7a0' }, beacon: { $value: '#c9a227' }, paper: { $value: '#faf7f2' }, ink: { $value: '#1c1a17' },
  },
};
const row = (id: string, proposal: ColourRoleProposal) => proposal.rows.find(r => r.id === id)!;

test('proposeColourRoles: a word on the list suggests a slot, and a word off it arrives by name only', () => {
  const proposal = proposeColourRoles(TEXTILE);
  assert.deepEqual(proposal.rows.map(r => [r.id, r.label, r.reads, r.path]), [
    ['main', 'Main', 'primary', 'color.main'],
    ['accent', 'Accent', 'secondary', 'color.accent'],
    ['supporting', 'Supporting', null, 'color.supporting'],
    ['tertiary', 'Tertiary', null, 'color.tertiary'],
    ['beacon', 'Beacon', null, 'color.beacon'],
    ['paper', 'Paper', 'surface', 'color.paper'],
    ['ink', 'Ink', null, 'color.ink'],
  ]);
  assert.equal(row('supporting', proposal).description, 'The selvedge');
  assert.equal(proposal.hasLead, false);
});

test('proposeColourRoles: an earlier word on the list wins a slot, and the file\'s own slot is respected', () => {
  const both = proposeColourRoles({ brand: { $type: 'color', primary: { $value: '#111111' }, main: { $value: '#222222' } } });
  assert.equal(row('primary', both).reads, 'primary');
  assert.equal(row('primary', both).fixed, true, 'a role named after a slot is that slot');
  assert.equal(row('main', both).reads, null);
  // The file's primary is another colour, so `main` leaves that slot alone.
  const other = proposeColourRoles({ color: { $type: 'color', semantic: { primary: { $value: '#111111' }, surface: { $value: '#ffffff' }, text: { $value: '#000000' } }, brand: { main: { $value: '#222222' }, tertiary: { $value: '#333333' } } } });
  assert.deepEqual(other.rows.map(r => [r.id, r.reads]), [['main', null], ['tertiary', null]]);
  assert.equal(other.hasLead, true);
  // The same colour in every look is the same thing said twice.
  const same = proposeColourRoles({ color: { $type: 'color', semantic: { primary: { $value: '#222222' } }, brand: { main: { $value: '#222222' } } } });
  assert.equal(row('main', same).reads, 'primary');
});

test('proposeColourRoles: only a group holding a known word counts, and a step on a ramp is not a word', () => {
  assert.deepEqual(proposeColourRoles({ color: { $type: 'color', flax: { $value: '#faf7f2' }, loom: { $value: '#1c1a17' } } }).rows, []);
  assert.deepEqual(proposeColourRoles({ color: { $type: 'color', 'blue-100': { $value: '#eeeeff' }, 'blue-900': { $value: '#000033' }, neutral100: { $value: '#eeeeee' } } }).rows, []);
  const mixed = proposeColourRoles({ a: { $type: 'color', accent: { $value: '#b23a48' }, 'accent-2': { $value: '#000000' } }, b: { $type: 'color', flax: { $value: '#faf7f2' } } });
  assert.deepEqual(mixed.rows.map(r => r.id), ['accent']);
  // A palette that happens to hold one word offers that word, not the palette.
  const palette = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`shade${'abcdefghijklmnopqrstuvwxyz'[i]}`, { $value: '#123456' }]));
  const wide = proposeColourRoles({ color: { $type: 'color', ...palette, accent: { $value: '#b23a48' } } });
  assert.deepEqual(wide.rows.map(r => r.id), ['accent']);
});

test('proposeColourRoles: a custom semantic token is offered, and per-look values are shown per look', () => {
  const doc = {
    $themes: [{ id: 'light', name: 'light', selectedTokenSets: { l: 'enabled' } }, { id: 'dark', name: 'dark', selectedTokenSets: { d: 'enabled' } }],
    $metadata: { tokenSetOrder: ['l', 'd'] },
    l: { color: { $type: 'color', semantic: { primary: { $value: '#111111' }, highlight: { $value: '#c9a227' } } } },
    d: { color: { $type: 'color', semantic: { primary: { $value: '#eeeeee' }, highlight: { $value: '#ffe08a' } } } },
  };
  const proposal = proposeColourRoles(doc);
  assert.deepEqual(proposal.rows.map(r => [r.id, r.path, r.colours.map(c => c.hex)]), [['highlight', 'color.semantic.highlight', ['#c9a227', '#ffe08a']]]);
});

test('proposeColourRoles: nothing to suggest for a file that declares its roles, for the shipped systems, or for garbage', () => {
  const load = (path: string): unknown => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
  for (const doc of [
    load('../../../../tests/fixtures/colour-roles/wefthouse.tokens.json'),
    load('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'),
    load('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json'),
    deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }),
    null, 7, 'text', [], { color: 'nope' },
  ]) assert.deepEqual(proposeColourRoles(doc).rows, []);
});

test('proposeColourRoles reads a hostile file without trouble: odd names stay data, and the list is bounded', () => {
  const hostile = JSON.parse('{"color":{"$type":"color","accent":{"$value":"#b23a48"},"__proto__":{"$value":"#000000"},"constructor":{"$value":"#000001"},"toString":{"$value":"#000002"},"<script>alert(1)</script>":{"$value":"#000003"}}}');
  const proposal = proposeColourRoles(hostile);
  assert.ok(proposal.rows.every(r => /^[a-z][a-z-]*$/.test(r.id)), 'every id is a usable one');
  assert.ok(!({} as Record<string, unknown>).accent, 'no prototype was touched');
  const many = { color: { $type: 'color', accent: { $value: '#b23a48' }, ...Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`word${'abcdefghijklmnop'[i]}`, { $value: '#123456' }])) } };
  assert.equal(proposeColourRoles(many).rows.length, 15);
});

test('colourRoleSpecs and adoption: what a person left is what gets written, and turning everything off writes nothing', () => {
  const proposal = proposeColourRoles(TEXTILE);
  const edited: ColourRoleChoice[] = proposal.rows.map(r => ({ id: r.id, label: r.label, description: r.description, reads: r.reads, keep: true }));
  const by = (id: string): ColourRoleChoice => edited.find(c => c.id === id)!;
  by('main').label = 'Ground';
  by('main').description = 'The cloth';
  by('ink').reads = 'text';
  by('beacon').keep = false;
  const specs = colourRoleSpecs(proposal, edited);
  assert.deepEqual(specs.map(s => [s.id, s.label, s.fills ?? null]), [['main', 'Ground', 'primary'], ['accent', 'Accent', 'secondary'], ['supporting', 'Supporting', null], ['tertiary', 'Tertiary', null], ['paper', 'Paper', 'surface'], ['ink', 'Ink', 'text']]);
  const edit = adoptColourRoles(TEXTILE, specs, { lift: { id: 'house', name: 'House' } });
  assert.ok(edit.ok, JSON.stringify(edit));
  const reading = readColourRoles(edit.doc);
  assert.deepEqual(reading.roles.filter(r => r.declared).map(r => [r.id, r.label, r.slots]), [['main', 'Ground', ['primary']], ['accent', 'Accent', ['secondary']], ['supporting', 'Supporting', []], ['tertiary', 'Tertiary', []], ['paper', 'Paper', ['surface']], ['ink', 'Ink', ['text']]]);
  assert.deepEqual(reading.issues, []);
  assert.deepEqual(danglingColourAliases(edit.doc), []);
  const light = createTokenSet(edit.doc, { selection: { '': 'light' } });
  assert.equal(light.resolve('color.semantic.primary'), '#1b2a6b');
  assert.equal(light.resolve('color.semantic.surface'), '#faf7f2');
  assert.equal(light.resolve('color.main'), '#1b2a6b', 'the file\'s own token is still there');
  assert.equal(createTokenSet(edit.doc).resolve('color.beacon'), '#c9a227', 'a word turned off stays a named colour');
  assert.equal(readColourRoles(edit.doc).roles.some(r => r.id === 'beacon'), false);
  const off = colourRoleSpecs(proposal, edited.map(c => ({ ...c, keep: false })));
  assert.deepEqual(off, []);
  const untouched = adoptColourRoles(TEXTILE, off);
  assert.ok(untouched.ok);
  assert.equal(untouched.changed, false);
  assert.deepEqual(untouched.doc, TEXTILE, 'the file as it came');
});

test('adoption: a layered file keeps its values per look, and themes that are not light and dark refuse', () => {
  const layered = {
    $themes: [{ id: 'light', name: 'light', selectedTokenSets: { core: 'enabled', l: 'enabled' } }, { id: 'dark', name: 'dark', selectedTokenSets: { core: 'enabled', d: 'enabled' } }],
    $metadata: { tokenSetOrder: ['core', 'l', 'd'] },
    core: { color: { $type: 'color', pine: { $value: '#135135' } } },
    l: { brand: { $type: 'color', main: { $value: '#1b2a6b' }, surface: { $value: '#ffffff' } } },
    d: { brand: { $type: 'color', main: { $value: '#8fa2ff' }, surface: { $value: '#111111' } } },
  };
  const proposal = proposeColourRoles(layered);
  const edit = adoptColourRoles(layered, colourRoleSpecs(proposal, proposal.rows.map(r => ({ id: r.id, label: r.label, description: '', reads: r.reads, keep: true }))), { lift: { id: 'house', name: 'House' } });
  assert.ok(edit.ok, JSON.stringify(edit));
  assert.equal(createTokenSet(edit.doc, { selection: { '': 'dark' } }).resolve('color.semantic.main'), '#8fa2ff');
  assert.equal(createTokenSet(edit.doc, { selection: { '': 'light' } }).resolve('color.semantic.surface'), '#ffffff');
  assert.equal(createTokenSet(edit.doc, { selection: { '': 'dark' } }).resolve('color.semantic.surface'), '#111111');
  const product = { $themes: [{ id: 'a', name: 'A', group: 'product', selectedTokenSets: { a: 'enabled' } }], $metadata: { tokenSetOrder: ['a'] }, a: { brand: { $type: 'color', main: { $value: '#1b2a6b' } } } };
  const refused = adoptColourRoles(product, [{ id: 'main', label: 'Main', from: 'brand.main', fills: 'primary' }]);
  assert.equal(refused.ok, false);
});

test('no render path can reach the word list: it lives in the shell, and the engine holds none of it', () => {
  const engine = readFileSync(new URL('../../../../engine/src/colour-role-portable.ts', import.meta.url), 'utf8');
  assert.ok(!/'supporting'|READING_WORDS/.test(engine));
  assert.ok(!/brand-propose/.test(readFileSync(new URL('./design-system/colour-roles-model.ts', import.meta.url), 'utf8')));
});
