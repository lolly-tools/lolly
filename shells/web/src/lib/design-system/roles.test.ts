// SPDX-License-Identifier: MPL-2.0
/**
 * Roles as an assignment layer - the doc surgery and the readouts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/roles.test.ts"
 *
 * Two documents are used throughout, on purpose. The first is a REAL derived
 * one straight out of `deriveBrandTokens`, so the write path is exercised
 * against the exact multi-set shape the engine emits (base + light + dark, roles
 * as `{alias}`es into the ramps) rather than a hand-rolled approximation that
 * could drift from it. The second is a hand-built single-set import carrying
 * literal colours and no `semantic` group at all - the shape a bare DTCG export
 * arrives in, where the group has to be created before a role can land.
 *
 * jsdom supplies the DOM for the mount half only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { deriveBrandTokens, createTokenSet, colorToHex } from '@lolly/engine';

const dom = new JSDOM('<!doctype html><html><body><div id="mount"></div></body></html>', {
  url: 'http://localhost/#/start',
});
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const {
  ROLE_IDS, ROLE_IDS_ALL, ASSIGNABLE_ROLES, roleLabel, readRoles, roleAssignments, assignRole, clearRole,
  roleContrast, roleReadouts, buildRolesModel, rampStepName, rolesStripHtml, mountRolesStrip, WEAK_LC,
} = await import('./roles.ts');
type RoleId = import('./roles.ts').RoleId;

type Rec = Record<string, unknown>;

/** A fresh derived document - never share one across mutating tests. */
const derived = (): Rec => deriveBrandTokens({ primary: '#0c322c', name: 'Test' }) as Rec;

/** A LAYERED import, in the shape `views/start.ts` installs verbatim: a
 *  Tokens-Studio / Penpot document whose sets are named by the designer, plus
 *  the `Lolly roles` set `withRoleAliases` appends for the semantic slots. Named
 *  sets, no `base`/`light`/`dark` anywhere. */
const layered = (): Rec => ({
  Global: {
    color: {
      brand: {
        blue: { $value: '#1c4fd8', $type: 'color' },
        ink: { $value: '#101418', $type: 'color' },
        paper: { $value: '#fbfbf9', $type: 'color' },
      },
    },
  },
  'Lolly roles': { color: { semantic: { primary: { $value: '{color.brand.blue}', $type: 'color' } } } },
  $themes: [],
  $metadata: { tokenSetOrder: ['Global', 'Lolly roles'], activeSets: ['Global', 'Lolly roles'] },
});

/** A single-set import: literal colours, no `color.semantic` group. */
const imported = (): Rec => ({
  color: {
    $type: 'color',
    brand: {
      teal: { $value: '#0c322c', $description: 'Teal' },
      sand: { $value: '#f5f1e6', $description: 'Sand' },
      ink: { $value: '#111111', $description: 'Ink' },
    },
  },
});

/** Resolve through the real token modules, exactly as the editor does. */
const resolverFor = (doc: unknown, theme = 'light') =>
  (key: string): unknown => {
    try { return createTokenSet(doc, { theme }).resolve(key); } catch { return null; }
  };

const semanticAt = (doc: Rec, set: string): Rec =>
  ((doc[set] as Rec).color as Rec).semantic as Rec;

// ── Reading ──────────────────────────────────────────────────────────────────

test('readRoles: a derived doc reports all four roles as ramp references', () => {
  const doc = derived();
  const roles = readRoles(doc, 'light', resolverFor(doc));
  for (const id of ROLE_IDS) {
    const s = roles[id];
    assert.ok(s.ref?.startsWith('color.ramp.'), `${id} should alias a ramp step, got ${s.ref}`);
    assert.equal(s.literal, false, `${id} is an alias, not a literal`);
    assert.match(s.hex, /^#[0-9a-f]{6}$/i, `${id} should resolve to a hex, got ${JSON.stringify(s.hex)}`);
  }
});

test('readRoles: light and dark are read independently', () => {
  const doc = derived();
  const light = readRoles(doc, 'light', resolverFor(doc, 'light'));
  const dark = readRoles(doc, 'dark', resolverFor(doc, 'dark'));
  assert.notEqual(light.surface.hex, dark.surface.hex,
    'the two themes must not report the same surface - the theme argument is being ignored');
});

test('readRoles: an import with no semantic group reports every role unset', () => {
  const doc = imported();
  const roles = readRoles(doc, 'light');
  for (const id of ROLE_IDS) {
    assert.deepEqual(roles[id], { ref: null, hex: '', literal: false }, `${id} should be unset`);
  }
  assert.deepEqual(roleAssignments(doc), {}, 'nothing is assigned yet');
});

test('readRoles: a literal role reads back as literal, with no ref', () => {
  const doc = imported();
  (doc.color as Rec).semantic = { primary: { $value: '#ff6600' } };
  const roles = readRoles(doc, 'light');
  assert.equal(roles.primary.literal, true);
  assert.equal(roles.primary.ref, null);
  assert.equal(roles.primary.hex.toLowerCase(), '#ff6600');
  // Absent-vs-literal is the distinction that matters to the strip.
  assert.equal(roles.secondary.literal, false);
  assert.equal(roles.secondary.hex, '');
});

test('readRoles: an alias with no resolver keeps its ref and reports no hex', () => {
  const doc = derived();
  const roles = readRoles(doc, 'light');
  assert.ok(roles.primary.ref, 'the reference survives without a resolver');
  assert.equal(roles.primary.hex, '', 'an unresolved alias has no colour of its own');
});

// ── Writing ──────────────────────────────────────────────────────────────────

test('assignRole: a custom swatch becomes the primary in BOTH theme sets', () => {
  const doc = derived();
  (((doc.base as Rec).color as Rec).custom as Rec | undefined) ?? (((doc.base as Rec).color as Rec).custom = {
    brandTeal: { $value: '#0c322c', $description: 'Brand teal' },
  });
  assert.equal(assignRole(doc, 'primary', 'color.custom.brandTeal'), true);

  for (const set of ['light', 'dark']) {
    const leaf = semanticAt(doc, set).primary as Rec;
    assert.equal(leaf.$value, '{color.custom.brandTeal}', `${set} was not repointed`);
    assert.equal(leaf.$type, 'color');
  }

  // Read it back through the real resolver.
  const roles = readRoles(doc, 'light', resolverFor(doc));
  assert.equal(roles.primary.ref, 'color.custom.brandTeal');
  assert.equal(roles.primary.hex.toLowerCase(), '#0c322c');
  assert.deepEqual(roleAssignments(doc, 'light', resolverFor(doc)).primary,
    { key: 'color.custom.brandTeal', hex: roles.primary.hex });
});

test('assignRole: a theme scopes the write to that theme alone', () => {
  const doc = derived();
  const darkBefore = JSON.stringify(semanticAt(doc, 'dark').surface);
  const lightBefore = (semanticAt(doc, 'light').surface as Rec).$value;
  const lightestNeutral = (readRoles(doc, 'light', resolverFor(doc, 'light')).surface.ref) ?? '';
  const darkestNeutral = (readRoles(doc, 'dark', resolverFor(doc, 'dark')).surface.ref) ?? '';
  assert.notEqual(lightestNeutral, darkestNeutral,
    'the fixture must carry INVERTED surfaces or this test proves nothing');

  assert.equal(assignRole(doc, 'surface', lightestNeutral, 'light'), true);
  assert.equal((semanticAt(doc, 'light').surface as Rec).$value, `{${lightestNeutral}}`);
  assert.equal(JSON.stringify(semanticAt(doc, 'dark').surface), darkBefore,
    'the dark theme keeps its own, deliberately inverted surface');
  assert.notEqual((semanticAt(doc, 'light').surface as Rec).$value, undefined);
  assert.equal(typeof lightBefore, 'string');

  // And the other way round (a target neither theme holds, so the assertion
  // cannot pass by coincidence).
  assert.equal(assignRole(doc, 'text', 'color.ramp.secondary.4', 'dark'), true);
  assert.equal((semanticAt(doc, 'dark').text as Rec).$value, '{color.ramp.secondary.4}');
  assert.notEqual((semanticAt(doc, 'light').text as Rec).$value, '{color.ramp.secondary.4}',
    'a dark-theme write must not reach the light theme');
});

test('clearRole: a theme scopes the removal to that theme alone', () => {
  const doc = derived();
  assert.equal(clearRole(doc, 'secondary', 'light'), true);
  assert.equal('secondary' in semanticAt(doc, 'light'), false);
  assert.equal('secondary' in semanticAt(doc, 'dark'), true, 'the dark theme still has its role');
  assert.equal(clearRole(doc, 'secondary', 'light'), false, 'nothing left in that theme');
  assert.equal(clearRole(doc, 'secondary', 'dark'), true);
  assert.equal('secondary' in semanticAt(doc, 'dark'), false);
});

test('a layered Tokens-Studio document is read and written in its own set', () => {
  const doc = layered();
  // Read: the role installed by withRoleAliases resolves, rather than reporting
  // "Not set" because three fixed set names were the only ones recognised.
  const roles = readRoles(doc, 'light', resolverFor(doc));
  assert.equal(roles.primary.ref, 'color.brand.blue');
  assert.equal(roles.primary.hex.toLowerCase(), '#1c4fd8');
  assert.equal(roles.surface.ref, null, 'an unfilled slot is still unset');

  // Write: goes into the role set (last in tokenSetOrder, so it wins), never at
  // the document root, and says so honestly.
  assert.equal(assignRole(doc, 'surface', 'color.brand.paper'), true);
  const roleSet = (doc['Lolly roles'] as Rec).color as Rec;
  assert.equal(((roleSet.semantic as Rec).surface as Rec).$value, '{color.brand.paper}');
  assert.equal(doc.color, undefined, 'nothing is written to the root of a layered document');
  assert.equal(readRoles(doc, 'light', resolverFor(doc)).surface.hex.toLowerCase(), '#fbfbf9');

  // And the whole strip works over it.
  const model = buildRolesModel(doc, 'light', [
    { key: 'color.brand.blue', name: 'Blue', hex: '#1c4fd8' },
    { key: 'color.brand.paper', name: 'Paper', hex: '#fbfbf9' },
  ], resolverFor(doc));
  assert.equal(model.rows.find(r => r.id === 'primary')!.value, 'Blue');
  assert.equal(model.rows.find(r => r.id === 'surface')!.set, true);

  assert.equal(clearRole(doc, 'primary'), true);
  assert.equal('primary' in ((((doc['Lolly roles'] as Rec).color as Rec).semantic ?? {}) as Rec), false);
});

test('a layered document with no semantic set yet takes the last COLOUR set in the order', () => {
  const doc = layered();
  delete (doc as Rec)['Lolly roles'];
  doc.Brand = { color: { brand: { extra: { $value: '#008000', $type: 'color' } } } };
  doc.Spacing = { spacing: { md: { $value: '8px', $type: 'dimension' } } };
  (doc.$metadata as Rec).tokenSetOrder = ['Global', 'Brand', 'Spacing'];

  assert.equal(assignRole(doc, 'primary', 'color.brand.blue'), true);
  assert.equal(((((doc.Brand as Rec).color as Rec).semantic as Rec).primary as Rec).$value,
    '{color.brand.blue}', 'the override winner is the last set in the order that holds colour');
  assert.equal(((doc.Global as Rec).color as Rec).semantic, undefined, 'the set below is left alone');
  assert.equal((doc.Spacing as Rec).color, undefined,
    'a set of spacing tokens is no place for a colour role');
});

test('a `base` group with no $metadata is FLAT - the engine decides, not the name', () => {
  // The mirror image of the layered case above. `base` here is an ordinary
  // group in a hand-written document, not a token SET: no $metadata, no
  // $themes, so createTokenSet reads the whole file flat. Recognising the name
  // anyway wrote the role into `base.color.semantic.primary`, returned true, and
  // left a reference the resolver could never see - a role the room announced as
  // assigned and the palette never showed.
  const doc: Rec = { base: { color: { brand: { blue: { $type: 'color', $value: '#123456' } } } } };
  assert.equal(assignRole(doc, 'primary', 'color.brand.blue'), false,
    'there is no colour group at the root of this document, so the write is refused');
  assert.equal((doc.base as Rec).color && ((doc.base as Rec).color as Rec).semantic, undefined,
    'and nothing is written into the group that merely looks like a set');

  // A root `color` group is the flat shape the write DOES belong in, and it
  // round-trips through the engine's own resolver.
  const flat: Rec = { color: { brand: { blue: { $type: 'color', $value: '#123456' } } } };
  assert.equal(assignRole(flat, 'primary', 'color.brand.blue'), true);
  assert.equal(colorToHex(createTokenSet(flat).resolve('color.semantic.primary')), '#123456');
});

test('assignRole: only the named role moves', () => {
  const doc = derived();
  const before = JSON.stringify(semanticAt(doc, 'light'));
  const others = (['on-primary', 'muted', 'edge', 'secondary', 'surface', 'text'] as const)
    .map(k => [k, JSON.stringify(semanticAt(doc, 'light')[k])] as const);
  assignRole(doc, 'primary', 'color.ramp.secondary.3');
  assert.notEqual(JSON.stringify(semanticAt(doc, 'light')), before, 'primary should have changed');
  for (const [k, json] of others) {
    assert.equal(JSON.stringify(semanticAt(doc, 'light')[k]), json,
      `${k} must be left alone - this module does not re-derive the contrast-enforced set`);
  }
});

test('assignRole: keeps a description and the print lock already on the slot', () => {
  const doc = derived();
  const light = semanticAt(doc, 'light');
  (light.surface as Rec).$description = 'Page';
  (light.surface as Rec).$extensions = { 'com.suse.lolly': { group: 'Semantic', cmyk: [0, 0, 0, 4] } };
  assignRole(doc, 'surface', 'color.ramp.neutral.9');
  const leaf = light.surface as Rec;
  assert.equal(leaf.$description, 'Page');
  const ns = (leaf.$extensions as Rec)['com.suse.lolly'] as Rec;
  assert.deepEqual(ns.cmyk, [0, 0, 0, 4], 'a print lock on the slot is not collateral damage');
  assert.equal(ns.group, 'Semantic');
});

test('assignRole: creates the semantic group on a single-set import', () => {
  const doc = imported();
  assert.equal((doc.color as Rec).semantic, undefined);
  assert.equal(assignRole(doc, 'text', 'color.brand.ink'), true);
  const leaf = ((doc.color as Rec).semantic as Rec).text as Rec;
  assert.equal(leaf.$value, '{color.brand.ink}');
  assert.equal(((leaf.$extensions as Rec)['com.suse.lolly'] as Rec).group, 'Semantic');
  // And it resolves for real.
  const roles = readRoles(doc, 'light', resolverFor(doc));
  assert.equal(roles.text.hex.toLowerCase(), '#111111');
});

test('assignRole: refuses a semantic target, an unknown slot and an empty key', () => {
  const doc = derived();
  const snapshot = JSON.stringify(doc);
  assert.equal(assignRole(doc, 'primary', 'color.semantic.secondary'), false,
    'a role aliasing a role chains');
  assert.equal(assignRole(doc, 'accent' as RoleId, 'color.ramp.primary.5'), false,
    'only the four declared slots are assignable');
  assert.equal(assignRole(doc, 'primary', '   '), false);
  assert.equal(assignRole(null, 'primary', 'color.ramp.primary.5'), false);
  assert.equal(JSON.stringify(doc), snapshot, 'a refused assignment writes nothing at all');
});

test('assignRole: a braced key is accepted and stored once-braced', () => {
  const doc = derived();
  assignRole(doc, 'secondary', '{color.ramp.secondary.2}');
  assert.equal((semanticAt(doc, 'light').secondary as Rec).$value, '{color.ramp.secondary.2}');
});

test('clearRole: removes the slot from every set, and says so honestly', () => {
  const doc = derived();
  assert.equal(clearRole(doc, 'secondary'), true);
  assert.equal('secondary' in semanticAt(doc, 'light'), false);
  assert.equal('secondary' in semanticAt(doc, 'dark'), false);
  assert.equal(clearRole(doc, 'secondary'), false, 'nothing left to remove');
  assert.equal(readRoles(doc, 'light', resolverFor(doc)).secondary.hex, '');
  // A system with no roles at all is valid.
  for (const id of ROLE_IDS) clearRole(doc, id);
  assert.deepEqual(roleAssignments(doc, 'light', resolverFor(doc)), {});
});

// ── Contrast ─────────────────────────────────────────────────────────────────

test('roleContrast: APCA leads, WCAG rides along', () => {
  const c = roleContrast('#111111', '#ffffff');
  assert.ok(c, 'black on white is readable');
  assert.ok(c.lc > 90, `expected a strong positive Lc, got ${c.lc}`);
  assert.equal(c.weak, false);
  assert.ok(c.wcag > 18 && c.wcag <= 21, `WCAG ratio out of range: ${c.wcag}`);
  assert.equal(typeof c.label, 'string');

  const rev = roleContrast('#ffffff', '#111111');
  assert.ok(rev && rev.lc < 0, 'light-on-dark is the negative polarity');
});

test('roleContrast: the weak boundary is |Lc| < 45, and unreadable pairs are null', () => {
  const near = roleContrast('#8a8a8a', '#909090');
  assert.ok(near, 'two greys still score');
  assert.equal(near.weak, true);
  assert.ok(Math.abs(near.lc) < WEAK_LC);
  assert.equal(roleContrast('', '#ffffff'), null);
  assert.equal(roleContrast('#ffffff', ''), null);
  assert.equal(roleContrast('not a colour', '#ffffff'), null);
});

test('roleReadouts: every derived role is measured, and text reads on the surface', () => {
  const doc = derived();
  const out = roleReadouts(doc, 'light', resolverFor(doc));
  for (const id of ROLE_IDS) {
    assert.ok(out[id].contrast, `${id} should have a readout`);
    assert.match(out[id].against, /^#[0-9a-f]{6}$/i, `${id} needs a colour to be judged against`);
  }
  // The derive enforces its floors, so text on surface must be comfortably readable.
  assert.equal(out.text.contrast!.weak, false,
    'a derived system\'s text is contrast-enforced against its own surface');
  assert.equal(out.text.against, out.surface.hex, 'text is measured on the surface role');
  assert.equal(out.secondary.against, out.text.hex, 'secondary is judged with the text colour');
});

test('roleReadouts: text falls back to white when there is no surface role', () => {
  const doc = imported();
  assignRole(doc, 'text', 'color.brand.ink');
  const out = roleReadouts(doc, 'light', resolverFor(doc));
  assert.equal(out.text.against, '#ffffff');
  assert.ok(out.text.contrast && out.text.contrast.lc > 90, 'ink on a blank page reads');
  assert.equal(out.primary.contrast, null, 'an unset role has nothing to measure');
});

test('roleReadouts: a hand-assigned primary is reported as it is, not corrected', () => {
  // A deliberately terrible pairing: primary set to the same near-white as
  // on-primary. The readout must SAY so rather than quietly re-picking a slot.
  const doc = imported();
  (doc.color as Rec).semantic = { 'on-primary': { $value: '#ffffff' } };
  ((doc.color as Rec).brand as Rec).pale = { $value: '#fafafa', $description: 'Pale' };
  assignRole(doc, 'primary', 'color.brand.pale');
  const out = roleReadouts(doc, 'light', resolverFor(doc));
  assert.ok(out.primary.contrast, 'the pair still scores');
  assert.equal(out.primary.contrast.weak, true, 'white on near-white must read as weak');
  assert.equal((((doc.color as Rec).semantic as Rec)['on-primary'] as Rec).$value, '#ffffff',
    'on-primary is left exactly as it was');
});

// ── The strip ────────────────────────────────────────────────────────────────

const OPTIONS = [
  { key: 'color.brand.teal', name: 'Teal', hex: '#0c322c', group: 'Brand' },
  { key: 'color.brand.sand', name: 'Sand', hex: '#f5f1e6', group: 'Brand' },
  { key: 'color.brand.ink', name: 'Ink', hex: '#111111', group: 'Brand' },
];

test('buildRolesModel: names the assigned swatch, and marks the rest unset', () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  const model = buildRolesModel(doc, 'light', OPTIONS, resolverFor(doc));
  assert.equal(model.rows.length, ROLE_IDS.length);
  const primary = model.rows.find(r => r.id === 'primary')!;
  assert.equal(primary.set, true);
  assert.equal(primary.value, 'Teal', 'the swatch name, not its key');
  assert.equal(primary.selected, 'color.brand.teal');
  assert.equal(primary.hex.toLowerCase(), '#0c322c');
  const surface = model.rows.find(r => r.id === 'surface')!;
  assert.equal(surface.set, false);
  assert.equal(surface.selected, '');
});

// plans/163 F6: an undescribed starter ramp step is named for its leaf key, so
// SURFACE read "9" and TEXT read "1". Display only - the doc is never touched.
test('rampStepName: a bare ramp step is shown with the ramp it belongs to', () => {
  assert.equal(rampStepName('9', 'color.ramp.neutral.9'), 'Neutral 9');
  assert.equal(rampStepName('1', 'base.color.ramp.brand-blue.1'), 'Brand Blue 1');
  assert.equal(rampStepName('Jungle', 'color.ramp.primary.4'), 'Jungle', 'a described step is left alone');
  assert.equal(rampStepName('2026', 'color.custom.2026'), '2026', 'only one or two digits read as a step');
  assert.equal(rampStepName('9', '9'), '9', 'a key with no ramp segment has nothing to add');
});

test('buildRolesModel: a bare ramp step reads with its ramp name', () => {
  const doc = imported();
  assignRole(doc, 'surface', 'color.ramp.neutral.9');
  const model = buildRolesModel(doc, 'light', [
    ...OPTIONS, { key: 'color.ramp.neutral.9', name: '9', hex: '#ffffff', group: 'Neutral' },
  ], resolverFor(doc));
  assert.equal(model.rows.find(r => r.id === 'surface')!.value, 'Neutral 9');
});

test('buildRolesModel: a semantic swatch is never offered as an option', () => {
  const doc = imported();
  const model = buildRolesModel(doc, 'light',
    [...OPTIONS, { key: 'color.semantic.primary', name: 'Primary', hex: '#0c322c' }], resolverFor(doc));
  assert.equal(model.options.some(o => o.key.startsWith('color.semantic.')), false);
});

// ── The ownership grammar in the strip (plan 182 section 4.2) ────────────────
// The strip used to claim the starter's ink WAS the person's Text colour. These
// pin the three registers apart: a role on an own colour, a role standing on a
// starter one, and a role resolving to the same swatch the primary already has.

const STARTER_OPTIONS = [
  ...OPTIONS,
  { key: 'color.ramp.neutral.1', name: 'Ink', hex: '#17191d', group: 'Neutral', starter: true },
  { key: 'color.ramp.neutral.9', name: 'Paper', hex: '#f8f8f9', group: 'Neutral', starter: true },
];

test('buildRolesModel: a role standing on a starter colour says so, and keeps its picker empty', () => {
  const doc = imported();
  assignRole(doc, 'text', 'color.ramp.neutral.1');
  assignRole(doc, 'primary', 'color.brand.teal');
  const model = buildRolesModel(doc, 'light', STARTER_OPTIONS, resolverFor(doc));

  const text = model.rows.find(r => r.id === 'text')!;
  assert.equal(text.starter, true);
  assert.equal(text.set, true, 'something IS resolving there - tools read it');
  assert.equal(text.value, 'Starter Ink stands in');
  assert.equal(text.selected, '', 'nothing was chosen, so the picker sits on its placeholder');

  const primary = model.rows.find(r => r.id === 'primary')!;
  assert.equal(primary.starter, false, 'an own colour is the full register');
  assert.equal(primary.value, 'Teal');
  assert.equal(primary.selected, 'color.brand.teal');
});

test('buildRolesModel: a role resolving to the primary draws the arrow, not the name twice', () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  assignRole(doc, 'secondary', 'color.brand.teal');
  const model = buildRolesModel(doc, 'light', OPTIONS, resolverFor(doc));

  const secondary = model.rows.find(r => r.id === 'secondary')!;
  assert.equal(secondary.follows, roleLabel('primary'));
  assert.equal(secondary.value, `\u21b3 follows ${roleLabel('primary')}`);
  assert.equal(secondary.selected, '', 'it is the first decision showing through, not a second one');
  assert.equal(model.rows.find(r => r.id === 'primary')!.follows, '', 'the primary follows nothing');
});

test('buildRolesModel: an unset role is still Not set, not a stand-in', () => {
  const doc = imported();
  const model = buildRolesModel(doc, 'light', STARTER_OPTIONS, resolverFor(doc));
  const surface = model.rows.find(r => r.id === 'surface')!;
  assert.equal(surface.set, false);
  assert.equal(surface.starter, false);
  assert.equal(surface.value, 'Not set');
});

test('rolesStripHtml: starter swatches keep their own heading, and a stand-in row reads Choose', () => {
  const doc = imported();
  assignRole(doc, 'text', 'color.ramp.neutral.1');
  const html = rolesStripHtml(buildRolesModel(doc, 'light', STARTER_OPTIONS, resolverFor(doc)));
  assert.ok(html.includes('<optgroup label="Starter">'), 'the starter neutrals are assignable, under their own heading');
  assert.ok(html.includes('be-role is-starter') || /class="be-role[^"]*is-starter/.test(html),
    'the stand-in row wears the muted register');
  assert.ok(html.includes('Choose'), 'and its picker asks rather than naming a placeholder as a choice');
  // The Starter heading comes LAST, after every colour of the person's own.
  assert.ok(html.indexOf('<optgroup label="Brand">') < html.indexOf('<optgroup label="Starter">'));
});

test('rolesStripHtml: one chip per role, escaped, with the picker keyed by role', () => {
  const doc = imported();
  assignRole(doc, 'primary', 'color.brand.teal');
  const html = rolesStripHtml(buildRolesModel(doc, 'light', OPTIONS, resolverFor(doc)));
  for (const id of ROLE_IDS) {
    assert.ok(html.includes(`data-be-role="${id}"`), `missing the ${id} chip`);
    assert.ok(html.includes(`data-be-role-pick="${id}"`), `missing the ${id} picker`);
  }
  assert.ok(html.includes('Not set'), 'the empty option is always offered');
  assert.ok(html.includes('<optgroup label="Brand">'), 'grouped options keep their heading');

  const nasty = [{ key: 'color.brand.x', name: '<img src=x onerror=1>', hex: '#000000' }];
  const escaped = rolesStripHtml(buildRolesModel(doc, 'light', nasty, resolverFor(doc)));
  assert.equal(escaped.includes('<img src=x'), false, 'a swatch name must not reach the sink raw');
  assert.ok(escaped.includes('&lt;img'));
});

test('mountRolesStrip: picking a swatch assigns once; picking Not set clears', () => {
  const doc = imported();
  const assigned: Array<[RoleId, string]> = [];
  const cleared: RoleId[] = [];
  const mount = document.getElementById('mount')!;
  const strip = mountRolesStrip(mount, {
    doc: () => doc,
    theme: () => 'light',
    resolve: resolverFor(doc),
    swatches: () => OPTIONS,
    assign: (role, key) => { assigned.push([role, key]); assignRole(doc, role, key); },
    clear: (role) => { cleared.push(role); clearRole(doc, role); },
  });

  assert.equal(mount.querySelectorAll('[data-be-role]').length, ROLE_IDS.length);

  const pick = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="primary"]')!;
  pick.value = 'color.brand.teal';
  pick.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(assigned, [['primary', 'color.brand.teal']]);
  assert.deepEqual(cleared, []);

  strip.render();
  const again = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="primary"]')!;
  assert.equal(again.value, 'color.brand.teal', 'the re-render restates the selection');
  const row = mount.querySelector('[data-be-role="primary"]')!;
  assert.equal(row.classList.contains('is-unset'), false);

  again.value = '';
  again.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(cleared, ['primary']);
  assert.equal(assigned.length, 1, 'clearing is not also an assignment');

  // One delegated listener survives a re-render - no duplicate handlers.
  strip.render();
  const third = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="secondary"]')!;
  third.value = 'color.brand.sand';
  third.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(assigned.length, 2, 'exactly one assign per change');
});

test('mountRolesStrip: a repaint keeps the focused picker alive and focused', () => {
  const doc = imported();
  const mount = document.getElementById('mount')!;
  const strip = mountRolesStrip(mount, {
    doc: () => doc,
    theme: () => 'light',
    resolve: resolverFor(doc),
    swatches: () => OPTIONS,
    // Exactly what the room does: write, then re-render through the palette
    // hook while the <select> that fired the change is still focused.
    assign: (role, key) => { assignRole(doc, role, key); strip.render(); },
    clear: (role) => { clearRole(doc, role); strip.render(); },
  });

  const pick = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="primary"]')!;
  pick.focus();
  assert.equal(document.activeElement, pick, 'precondition: the picker is focused');

  pick.value = 'color.brand.teal';
  pick.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

  assert.equal(
    mount.querySelector('[data-be-role-pick="primary"]'), pick,
    'the repaint must patch the row, not replace the element the keyboard is on');
  assert.equal(document.activeElement, pick, 'focus must not fall to the body mid-interaction');
  assert.equal(pick.value, 'color.brand.teal', 'and the patched picker still states the assignment');
  assert.equal(mount.querySelector('[data-be-role="primary"]')!.classList.contains('is-unset'), false);

  // A second arrow press has something to land on - the Windows/Linux case where
  // a closed <select> fires change on every key.
  pick.value = 'color.brand.sand';
  pick.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(document.activeElement, pick);
  assert.equal(mount.querySelector<HTMLSelectElement>('[data-be-role-pick="primary"]')!.value, 'color.brand.sand');
});

test('mountRolesStrip: a changed swatch list rebuilds, and puts focus back', () => {
  const doc = imported();
  const mount = document.getElementById('mount')!;
  let options = OPTIONS.slice();
  const strip = mountRolesStrip(mount, {
    doc: () => doc,
    theme: () => 'light',
    resolve: resolverFor(doc),
    swatches: () => options,
    assign: () => {}, clear: () => {},
  });
  const before = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="surface"]')!;
  before.focus();

  options = [...OPTIONS, { key: 'color.brand.new', name: 'Newcomer', hex: '#123456', group: 'Brand' }];
  strip.render();

  const after = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="surface"]')!;
  assert.notEqual(after, before, 'a new swatch has to reach the <option> list, so the strip is rebuilt');
  assert.equal(document.activeElement, after, 'the rebuild hands focus back to the same role');
  assert.ok([...after.options].some(o => o.value === 'color.brand.new'), 'the new swatch is offered');
});

test('roleLabel covers every declared role', () => {
  for (const id of ROLE_IDS_ALL) assert.ok(roleLabel(id).length > 0, `${id} has no label`);
  assert.equal(new Set(ROLE_IDS_ALL.map(roleLabel)).size, ROLE_IDS_ALL.length, 'labels must be distinct');
});

// ── All seven slots (plan 182 section 5.7 step 1) ────────────────────────────
// The token contract is seven `color.semantic.*` slots and the strip showed
// four, so `muted`, `edge` and `on-primary` were things a tool read and nobody
// could see. Beat 2 shows them all; the first two beats keep the four.

test('the three lists say what they are for', () => {
  assert.deepEqual([...ROLE_IDS], ['primary', 'secondary', 'surface', 'text']);
  assert.deepEqual([...ROLE_IDS_ALL],
    ['primary', 'secondary', 'surface', 'text', 'muted', 'edge', 'on-primary']);
  // Derived: the derive maintains on-primary against the primary, so a picker
  // that wrote it would be offering to break the pair it exists to keep.
  assert.equal(ASSIGNABLE_ROLES.includes('on-primary' as RoleId), false);
  assert.equal(ASSIGNABLE_ROLES.length, ROLE_IDS_ALL.length - 1);
});

test('the seven-row strip: every contract slot is shown, on-primary read-only', () => {
  const doc = derived();
  const model = buildRolesModel(doc, 'light', [], resolverFor(doc), ROLE_IDS_ALL);
  assert.deepEqual(model.rows.map(r => r.id), [...ROLE_IDS_ALL]);
  assert.deepEqual(model.rows.filter(r => r.derived).map(r => r.id), ['on-primary']);
  const html = rolesStripHtml(model);
  // Six pickers, not seven, and the derived row says why it has none.
  assert.equal([...html.matchAll(/data-be-role-pick=/g)].length, 6);
  assert.equal(/data-be-role-pick="on-primary"/.test(html), false);
  assert.match(html, /be-role-derived/);
  for (const id of ROLE_IDS_ALL) assert.match(html, new RegExp(`data-be-role="${id}"`));
});

test('the strip still shows four by default - a beat is not this module\'s business', () => {
  const doc = derived();
  assert.deepEqual(buildRolesModel(doc, 'light', [], resolverFor(doc)).rows.map(r => r.id), [...ROLE_IDS]);
});

test('muted and edge are ink: they read against the surface, like text', () => {
  const doc = derived();
  const out = roleReadouts(doc, 'light', resolverFor(doc));
  assert.equal(out.muted.against, out.text.against, 'both are judged on the surface');
  assert.equal(out.edge.against, out.text.against);
  for (const id of ['muted', 'edge'] as RoleId[]) {
    assert.ok(out[id].hex, `${id} resolves to a colour`);
    assert.ok(out[id].contrast, `${id} is measured`);
  }
});

test('on-primary is measured against the primary itself', () => {
  const doc = derived();
  const out = roleReadouts(doc, 'light', resolverFor(doc));
  assert.equal(out['on-primary'].against.toLowerCase(), out.primary.hex.toLowerCase());
  assert.ok(out['on-primary'].contrast, 'the derived pair is still measured');
  // It is the same pair the Primary row reports, read from the other end.
  assert.equal(out['on-primary'].contrast?.lc, out.primary.contrast?.lc);
});

// A hairline is meant to be quiet. The engine's own derive puts `edge` around
// Lc 22, so flagging it would be an alarm that is always on.
test('the edge row reports its Lc without the weak warning', () => {
  const doc = derived();
  const raw = roleReadouts(doc, 'light', resolverFor(doc)).edge.contrast;
  assert.ok(raw && raw.weak, 'the raw reading really is under the text floor');
  const row = buildRolesModel(doc, 'light', [], resolverFor(doc), ROLE_IDS_ALL)
    .rows.find(r => r.id === 'edge');
  assert.equal(row?.contrast?.lc, raw.lc, 'the number is unchanged');
  assert.equal(row?.contrast?.weak, false, 'but it is not painted as a fault');
});

test('muted and edge can be re-pointed; on-primary cannot', () => {
  const doc = derived();
  assert.equal(assignRole(doc, 'muted', 'color.ramp.neutral.5', 'light'), true);
  assert.equal(assignRole(doc, 'edge', 'color.ramp.neutral.5', 'light'), true);
  assert.equal(assignRole(doc, 'on-primary', 'color.ramp.neutral.5', 'light'), false,
    'the derive owns on-primary');
  assert.equal(readRoles(doc, 'light', resolverFor(doc)).muted.ref, 'color.ramp.neutral.5');
});

test('the extra slots are not counted as decisions somebody made', () => {
  const doc = derived();
  // Every one of the seven is assigned by the derive, but roleAssignments - what
  // the Overview's worth-exporting latch counts - reports the four.
  assert.deepEqual(Object.keys(roleAssignments(doc, 'light', resolverFor(doc))).sort(),
    [...ROLE_IDS].sort());
});

test('mountRolesStrip widens on demand and keeps its pickers working', () => {
  const doc = derived();
  const mount = document.getElementById('mount') as HTMLElement;
  mount.innerHTML = '';
  let ids: readonly RoleId[] = ROLE_IDS;
  const assigned: string[] = [];
  const strip = mountRolesStrip(mount, {
    doc: () => doc,
    theme: () => 'light',
    resolve: resolverFor(doc),
    swatches: () => [{ key: 'color.ramp.neutral.5', name: 'Neutral 5', hex: '#888888' }],
    ids: () => ids,
    assign: (role, key) => { assigned.push(`${role}=${key}`); },
    clear: (role) => { assigned.push(`${role}=`); },
  });
  assert.equal(mount.querySelectorAll('[data-be-role]').length, 4);
  ids = ROLE_IDS_ALL;
  strip.render();
  assert.equal(mount.querySelectorAll('[data-be-role]').length, 7, 'the row set moved, so it rebuilt');
  const pick = mount.querySelector<HTMLSelectElement>('[data-be-role-pick="muted"]')!;
  pick.value = 'color.ramp.neutral.5';
  pick.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.deepEqual(assigned, ['muted=color.ramp.neutral.5']);
  // And back down again, with no residue.
  ids = ROLE_IDS;
  strip.render();
  assert.equal(mount.querySelectorAll('[data-be-role]').length, 4);
});

test('sanity: the derived fixture really is the multi-set engine shape', () => {
  const doc = derived();
  assert.ok(doc.base && doc.light && doc.dark, 'deriveBrandTokens changed shape');
  assert.match(String(colorToHex('#0c322c')), /^#0c322c$/i);
});
