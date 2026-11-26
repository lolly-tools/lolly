// SPDX-License-Identifier: MPL-2.0
/**
 * The partner kit format (`partner-kit-v1`, Lolly Work plan 82 M8): the engine reader, its
 * bounds, and the two colour proposers a person makes a kit from. The SDK constants, the
 * schema and its SDK mirror are held to each other here, so a limit a surface shows is the
 * limit the reader enforces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkPartnerKit,
  readPartnerKit,
  partnerKitLogoIds,
  partnerKitColoursFromTokens,
  partnerKitColoursFromInks,
} from '../engine/src/partner-kit.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { extractSvgColors } from '../engine/src/svg-colors.ts';
import {
  PARTNER_KIT_ASSET_TYPE,
  PARTNER_KIT_CLEAR_SPACE_UNITS,
  PARTNER_KIT_COLOUR_ROLES,
  PARTNER_KIT_LIMITS,
  PARTNER_KIT_LOGO_SURFACES,
  PARTNER_KIT_MAX_BYTES,
  PARTNER_KIT_MAX_COLOURS,
  PARTNER_KIT_SCHEMA_VERSION,
  PARTNER_KIT_SOURCE_KINDS,
  PARTNER_KIT_TREATMENTS,
  type PartnerKitV1,
} from '../packages/core/src/partner-kit-v1.ts';

const root = new URL('../', import.meta.url);
const read = (rel: string): string => readFileSync(new URL(rel, root), 'utf8');

/** The plan's example kit, Northwind IT at revision 2. */
function northwind(): PartnerKitV1 {
  return {
    schemaVersion: 1,
    id: 'northwind-it',
    label: 'Northwind IT',
    logos: { light: { id: 'inst/3f9cQm-x', version: 2 }, dark: { id: 'inst/8a1d_Zk', version: 1 }, mark: { id: 'inst/c07e', version: 1 } },
    colours: [
      { role: 'primary', name: 'Northwind blue', value: '#1D4ED8' },
      { role: 'accent', name: 'Signal', value: '#f59e0b' },
    ],
    rules: { clearSpace: { value: 0.5, unit: 'mark-height' }, minSize: { px: 96, mm: 20 }, treatments: ['colour', 'mono', 'on-photo'] },
    skills: [],
    source: { kind: 'tokens', reference: 'northwind-tokens.json' },
  };
}

test('partner kit: reads the example kit, from a value and from its JSON text', () => {
  const kit = readPartnerKit(northwind());
  assert.ok(kit);
  assert.equal(kit.id, 'northwind-it');
  assert.equal(kit.colours[0]!.value, '#1d4ed8', 'colour values come back lower case');
  assert.deepEqual(readPartnerKit(JSON.stringify(northwind())), kit);
});

test('partner kit: the reader returns a copy, so the caller cannot change what it read', () => {
  const source = northwind();
  const kit = readPartnerKit(source)!;
  kit.label = 'Changed';
  kit.logos.light!.version = 9;
  assert.equal(source.label, 'Northwind IT');
  assert.equal(source.logos.light!.version, 2);
});

test('partner kit: a kit with no rules, no logos and no colours is still a kit', () => {
  const kit = readPartnerKit({ schemaVersion: 1, id: 'acme', label: 'Acme', logos: {}, colours: [] });
  assert.ok(kit);
  assert.equal(kit.rules, undefined, 'an absent rule means the kit states none');
});

test('partner kit: refuses what is not JSON, and says so', () => {
  const result = checkPartnerKit('{ not json');
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.issues[0]!.code, 'kit.json');
});

test('partner kit: refuses a kit over 64 KB, as text and as a value', () => {
  const big = { ...northwind(), skills: Array.from({ length: 16 }, (_, i) => `${i}`.padEnd(160, 'x')) };
  assert.ok(JSON.stringify(big).length < PARTNER_KIT_MAX_BYTES, 'the schema bounds alone keep a valid kit well under the byte bound');
  const padded = JSON.stringify(northwind()) + ' '.repeat(PARTNER_KIT_MAX_BYTES);
  const asText = checkPartnerKit(padded);
  assert.equal(!asText.ok && asText.issues[0]!.code, 'kit.too-large');
  const asValue = checkPartnerKit({ ...northwind(), label: 'x'.repeat(70_000) });
  assert.equal(!asValue.ok && asValue.issues[0]!.code, 'kit.too-large');
  assert.match(!asValue.ok ? asValue.issues[0]!.message : '', /at most 65,536/);
});

test('partner kit: every bound and closed list is refused past its edge', () => {
  const cases: Array<[string, (k: Record<string, any>) => void]> = [
    ['a font', (k) => { k.fonts = [{ family: 'Northwind Sans' }]; }],
    ['a token document', (k) => { k.$themes = []; }],
    ['schema version 2', (k) => { k.schemaVersion = 2; }],
    ['an upper-case id', (k) => { k.id = 'Northwind'; }],
    ['an empty label', (k) => { k.label = ''; }],
    ['a label over 120 characters', (k) => { k.label = 'x'.repeat(121); }],
    ['13 colours', (k) => { k.colours = Array.from({ length: 13 }, () => ({ role: 'accent', name: 'A', value: '#000000' })); }],
    ['a role outside the list', (k) => { k.colours[0].role = 'brand'; }],
    ['a colour name over 60 characters', (k) => { k.colours[0].name = 'x'.repeat(61); }],
    ['a named colour', (k) => { k.colours[0].value = 'blue'; }],
    ['a short hex', (k) => { k.colours[0].value = '#12f'; }],
    ['a translucent hex', (k) => { k.colours[0].value = '#1d4ed880'; }],
    ['a logo surface outside the list', (k) => { k.logos.photo = { id: 'inst/x', version: 1 }; }],
    ['logo version 0', (k) => { k.logos.light.version = 0; }],
    ['a fractional logo version', (k) => { k.logos.light.version = 1.5; }],
    ['a logo id that climbs a path', (k) => { k.logos.light.id = 'inst/../secret'; }],
    ['a logo id with a leading slash', (k) => { k.logos.light.id = '/inst/x'; }],
    ['a logo URL', (k) => { k.logos.light.id = 'https://example.com/logo.svg'; }],
    ['logo bytes', (k) => { k.logos.light.svg = '<svg/>'; }],
    ['a clear space in mm', (k) => { k.rules.clearSpace.unit = 'mm'; }],
    ['a clear space of 0', (k) => { k.rules.clearSpace.value = 0; }],
    ['a clear space past 4 mark heights', (k) => { k.rules.clearSpace.value = 4.5; }],
    ['an empty minimum size', (k) => { k.rules.minSize = {}; }],
    ['a minimum size of 0 px', (k) => { k.rules.minSize = { px: 0 }; }],
    ['a minimum size past 10,000 px', (k) => { k.rules.minSize = { px: 10_001 }; }],
    ['a minimum size past 1,000 mm', (k) => { k.rules.minSize = { mm: 1_001 }; }],
    ['a treatment outside the list', (k) => { k.rules.treatments = ['emboss']; }],
    ['an empty treatment list', (k) => { k.rules.treatments = []; }],
    ['a treatment named twice', (k) => { k.rules.treatments = ['mono', 'mono']; }],
    ['a rule outside the list', (k) => { k.rules.lockup = 'horizontal'; }],
    ['17 skills', (k) => { k.skills = Array.from({ length: 17 }, (_, i) => `skill-${i}`); }],
    ['a source kind outside the list', (k) => { k.source.kind = 'url'; }],
  ];
  for (const [what, edit] of cases) {
    const kit = northwind() as unknown as Record<string, any>;
    edit(kit);
    const result = checkPartnerKit(kit);
    assert.equal(result.ok, false, `refuses ${what}`);
    assert.ok(!result.ok && ['kit.schema', 'kit.too-large'].includes(result.issues[0]!.code), `refuses ${what} as a schema problem`);
  }
});

test('partner kit: refuses a kit that pins the same logo asset on two surfaces', () => {
  const kit = northwind();
  kit.logos.dark = { id: kit.logos.light!.id, version: 1 };
  const result = checkPartnerKit(kit);
  assert.equal(!result.ok && result.issues[0]!.code, 'kit.logo-duplicate');
  assert.equal(!result.ok && result.issues[0]!.path, '/logos/dark');
});

test('partner kit: twelve colours is the limit, and twelve read', () => {
  const kit = { ...northwind(), colours: Array.from({ length: PARTNER_KIT_MAX_COLOURS }, (_, i) => ({ role: 'accent', name: `Ink ${i}`, value: '#000000' })) };
  assert.ok(readPartnerKit(kit));
});

test('partner kit: the logo ids come back in surface order, once each', () => {
  assert.deepEqual(partnerKitLogoIds(northwind()), ['inst/3f9cQm-x', 'inst/8a1d_Zk', 'inst/c07e']);
  assert.deepEqual(partnerKitLogoIds({ logos: { mark: { id: 'inst/m', version: 1 } } }), ['inst/m']);
  assert.deepEqual(partnerKitLogoIds({ logos: {} }), []);
});

test('partner kit: the SDK constants, the schema and its SDK mirror agree', () => {
  const text = read('schemas/partner-kit-v1.schema.json');
  assert.equal(read('packages/core/schema/partner-kit-v1.schema.json'), text, 'packages/core/schema/partner-kit-v1.schema.json has drifted from schemas/');
  const schema = JSON.parse(text);
  const p = schema.properties;
  assert.equal(p.schemaVersion.const, PARTNER_KIT_SCHEMA_VERSION);
  assert.equal(p.colours.maxItems, PARTNER_KIT_LIMITS.maxColours);
  assert.equal(p.colours.items.properties.name.maxLength, PARTNER_KIT_LIMITS.maxColourName);
  assert.deepEqual(p.colours.items.properties.role.enum, [...PARTNER_KIT_COLOUR_ROLES]);
  assert.equal(p.label.maxLength, PARTNER_KIT_LIMITS.maxLabel);
  assert.deepEqual(Object.keys(p.logos.properties), [...PARTNER_KIT_LOGO_SURFACES]);
  assert.equal(p.logos.properties.light.properties.version.maximum, PARTNER_KIT_LIMITS.maxLogoVersion);
  assert.equal(p.rules.properties.clearSpace.properties.value.maximum, PARTNER_KIT_LIMITS.maxClearSpace);
  assert.deepEqual(p.rules.properties.clearSpace.properties.unit.enum, [...PARTNER_KIT_CLEAR_SPACE_UNITS]);
  assert.equal(p.rules.properties.minSize.properties.px.maximum, PARTNER_KIT_LIMITS.maxMinPx);
  assert.equal(p.rules.properties.minSize.properties.mm.maximum, PARTNER_KIT_LIMITS.maxMinMm);
  assert.deepEqual(p.rules.properties.treatments.items.enum, [...PARTNER_KIT_TREATMENTS]);
  assert.equal(p.skills.maxItems, PARTNER_KIT_LIMITS.maxSkills);
  assert.deepEqual(p.source.properties.kind.enum, [...PARTNER_KIT_SOURCE_KINDS]);
  assert.equal(PARTNER_KIT_LIMITS.maxBytes, 65_536);
  assert.notEqual(PARTNER_KIT_ASSET_TYPE, 'tokens', 'a kit is never served as the design system');
  assert.equal(schema.properties.fonts, undefined, 'a kit carries no fonts');
});

test('partner kit: the SDK exports the format as a subpath', () => {
  const pkg = JSON.parse(read('packages/core/package.json'));
  assert.equal(pkg.exports['./partner-kit-v1'], './src/partner-kit-v1.ts');
  assert.equal(pkg.exports['./schema/partner-kit-v1.schema.json'], './schema/partner-kit-v1.schema.json');
});

test('partner kit: proposes the light look\'s primary and secondary from the Lolly Demo tokens', () => {
  const doc = JSON.parse(read('brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'));
  const light = createTokenSet(doc, { theme: 'light' });
  const proposal = partnerKitColoursFromTokens(doc);
  assert.deepEqual(proposal.map((c) => c.role), ['primary', 'secondary'], 'the demo has no accent slot, so none is proposed');
  assert.equal(proposal[0]!.value, light.colors().find((c) => c.path === 'color.semantic.primary')!.value.toLowerCase());
  assert.equal(proposal[1]!.value, light.colors().find((c) => c.path === 'color.semantic.secondary')!.value.toLowerCase());
  for (const c of proposal) {
    assert.match(c.value, /^#[0-9a-f]{6}$/);
    assert.ok(c.name.length > 0 && c.name.length <= 60);
    assert.doesNotMatch(c.name, /[:.]/, 'a token description is prose, not a name');
  }
  // What it proposes is a kit the reader accepts.
  assert.ok(readPartnerKit({ schemaVersion: 1, id: 'lolly-demo', label: 'Lolly Demo', logos: {}, colours: proposal }));
});

test('partner kit: a plain token file\'s colour.primary and colour.accent are proposed, with names from the file', () => {
  const doc = {
    color: {
      $type: 'color',
      brand: { 'northwind-blue': { $value: '#1D4ED8' }, signal: { $value: '#F59E0B' } },
      primary: { $value: '{color.brand.northwind-blue}' },
      accent: { $value: '{color.brand.signal}' },
    },
  };
  assert.deepEqual(partnerKitColoursFromTokens(doc), [
    { role: 'primary', name: 'Northwind blue', value: '#1d4ed8' },
    { role: 'accent', name: 'Signal', value: '#f59e0b' },
  ]);
});

test('partner kit: a token file with no slots, a translucent slot or junk proposes nothing', () => {
  assert.deepEqual(partnerKitColoursFromTokens({ color: { $type: 'color', red: { $value: '#ff0000' } } }), []);
  assert.deepEqual(partnerKitColoursFromTokens({ color: { $type: 'color', primary: { $value: '#ff000080' } } }), []);
  assert.deepEqual(partnerKitColoursFromTokens(null), []);
  assert.deepEqual(partnerKitColoursFromTokens('tokens'), []);
});

test('partner kit: proposes colours from a fixture logo\'s inks', () => {
  const inks = extractSvgColors(read('tests/fixtures/partner-kit/northwind-logo.svg'));
  assert.deepEqual(partnerKitColoursFromInks(inks), [
    { role: 'primary', name: 'Primary', value: '#1d4ed8' },
    { role: 'text', name: 'Text', value: '#111827' },
    { role: 'secondary', name: 'Secondary', value: '#f59e0b' },
  ], 'the white knockout and the repeated blue are left out, and the slate wordmark reads as text');
});

test('partner kit: the ink proposer drops white and translucent inks, collapses repeats and stops at twelve', () => {
  assert.deepEqual(partnerKitColoursFromInks(['#fff', '#FFFFFF', 'rgba(0,0,0,0.5)', 'not a colour']), []);
  assert.deepEqual(partnerKitColoursFromInks(['#000000', '#222222', '#bbbbbb', '#cccccc']).map((c) => c.role), ['text', 'surface'], 'one text and one surface');
  const chromatic = ['#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#ea580c', '#db2777', '#4f46e5', '#65a30d', '#0d9488', '#c026d3', '#dc2626', '#7c3aed'];
  const proposal = partnerKitColoursFromInks(chromatic);
  assert.equal(proposal.length, PARTNER_KIT_MAX_COLOURS);
  assert.deepEqual(proposal.slice(0, 4).map((c) => c.name), ['Primary', 'Secondary', 'Accent', 'Accent 2']);
  assert.ok(readPartnerKit({ schemaVersion: 1, id: 'many', label: 'Many', logos: {}, colours: proposal }), 'twelve proposed colours still make a kit');
  assert.deepEqual(partnerKitColoursFromInks(undefined as unknown as string[]), []);
});

test('partner kit: a Tokens Studio file is read in its Light theme whatever its case, even saved with Dark active', () => {
  const doc = {
    $themes: [{ name: 'Light', selectedTokenSets: { light: 'enabled' } }, { name: 'Dark', selectedTokenSets: { dark: 'enabled' } }],
    $metadata: { tokenSetOrder: ['light', 'dark'], activeThemes: ['Dark'] },
    light: { color: { semantic: { primary: { $type: 'color', $value: '#1d4ed8' } } } },
    dark: { color: { semantic: { primary: { $type: 'color', $value: '#93c5fd' } } } },
  };
  assert.deepEqual(partnerKitColoursFromTokens(doc).map((c) => c.value), ['#1d4ed8']);
  // A theme whose id is the light one, with another display name, is read too.
  const byId = { ...doc, $themes: [{ id: 'light', name: 'Day', selectedTokenSets: { light: 'enabled' } }, { id: 'dark', name: 'Night', selectedTokenSets: { dark: 'enabled' } }], $metadata: { ...doc.$metadata, activeThemes: ['dark'] } };
  assert.deepEqual(partnerKitColoursFromTokens(byId).map((c) => c.value), ['#1d4ed8']);
  // With no light theme at all, the document is read in the theme it is set to.
  const noLight = { ...doc, $themes: [{ name: 'Dark', selectedTokenSets: { dark: 'enabled' } }] };
  assert.deepEqual(partnerKitColoursFromTokens(noLight).map((c) => c.value), ['#93c5fd']);
});

test('partner kit: named CSS colours in a logo are inks, as extractSvgColors keeps them', () => {
  const inks = extractSvgColors('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/><text fill="black">Acme</text><circle fill="White"/></svg>');
  assert.deepEqual(inks, ['red', 'black', 'White']);
  assert.deepEqual(partnerKitColoursFromInks(inks), [
    { role: 'primary', name: 'Primary', value: '#ff0000' },
    { role: 'text', name: 'Text', value: '#000000' },
  ], 'red and black are proposed and white is left out');
  assert.deepEqual(partnerKitColoursFromInks(['rebeccapurple', 'oklch(0.6 0.2 30)', 'transparent', 'currentColor']).map((c) => c.role), ['primary', 'secondary']);
});

