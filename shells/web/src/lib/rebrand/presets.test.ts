// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation presets in the web shell (plan 274 section 2.2, section 10 decision 7):
 * the design system's preset files, the personal layer on the profile, and a preset
 * made from the decisions on a plan.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/presets.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { DeckCensusV1, RenovationPlanV1 } from '@lolly-tools/core/rebrand-v1';
import {
  PERSONAL_PRESET_TOOL_ID,
  PRESET_ASSET_TAGS,
  mergePresets,
  personalPresetId,
  presetFromPlan,
  presetOf,
  presetsFromFile,
  readPackPresets,
  readPersonalPresets,
  savePersonalPreset,
} from './presets.ts';

const REPO = new URL('../../../../../', import.meta.url);
const PACK_FILE = new URL('brands/lolly-start/catalog/assets/lolly/slides/presets.json', REPO);
const sample = <T>(name: string): T => JSON.parse(readFileSync(new URL(`tests/fixtures/rebrand/samples/${name}.json`, REPO), 'utf8')) as T;

test('the starter pack ships Tidy, and it reads as a preset the engine takes', () => {
  const entries = presetsFromFile(JSON.parse(readFileSync(PACK_FILE, 'utf8')), 'pack');
  const tidy = entries.find((one) => one.preset.id === 'tidy');
  assert.ok(tidy, 'lolly-start ships tidy');
  assert.equal(tidy.name, 'Tidy');
  assert.equal(tidy.origin, 'pack');
  assert.equal(tidy.preset.actions?.decoration, 'remove');
  assert.equal(tidy.preset.layout?.fallback, 'content');
  assert.equal('name' in tidy.preset, false, 'the name is for people and never reaches the engine');
});

test('a preset that would not validate is dropped, never passed on half read', () => {
  assert.equal(presetOf({ id: 'ok' })?.id, 'ok');
  assert.equal(presetOf({}), null, 'no id');
  assert.equal(presetOf({ id: 'x', actions: { photo: 'burn' } }), null, 'an action outside the contract');
  assert.equal(presetOf({ id: 'x', actions: { spaceship: 'keep' } }), null, 'a class outside the contract');
  assert.equal(presetOf({ id: 'x', actions: { photo: 'replace' } }), null, 'only a logo has a replacement the first pass can name');
  assert.equal(presetOf({ id: 'x', actions: { 'logo-candidate': 'replace' } })?.actions?.['logo-candidate'], 'replace');
  assert.equal(presetOf({ id: 'x', layout: { fallback: 'No Where' } }), null, 'an archetype id not written the way the contract writes one');
  assert.equal(presetOf({ id: 'x', logo: { policy: 'shrink' } }), null);
  assert.deepEqual(presetsFromFile({ version: 2, presets: [{ id: 'a' }] }, 'pack'), [], 'a file of another version is not read');
});

// ─── plan 275: open archetype ids and the two new layout maps ────────────────

test('a preset naming only the twelve archetypes still reads, and one with the new maps reads too', () => {
  const old = presetOf({ id: 'old', layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout2.xml': 'two-column' }, fallback: 'content', minGap: 0.1 } });
  assert.deepEqual(old?.layout, { bySourceLayout: { 'ppt/slideLayouts/slideLayout2.xml': 'two-column' }, fallback: 'content', minGap: 0.1 });
  const next = presetOf({
    id: 'library',
    layout: {
      bySourceLayoutName: { 'Three Column': 'columns-3' },
      byStructure: { 'row:3|pic:none': 'columns-3', 'grid-2x2': 'grid-2x2' },
      fallback: 'title-body',
    },
  });
  assert.deepEqual(next?.layout, {
    bySourceLayoutName: { 'Three Column': 'columns-3' },
    byStructure: { 'row:3|pic:none': 'columns-3', 'grid-2x2': 'grid-2x2' },
    fallback: 'title-body',
  });
});

test('the new layout maps drop a preset with a malformed id, a reserved key or a layout key this build does not read', () => {
  assert.equal(presetOf({ id: 'x', layout: { byStructure: { 'grid-2x2': 'Grid 2x2' } } }), null);
  assert.equal(presetOf({ id: 'x', layout: { bySourceLayoutName: { Title: 7 } } }), null);
  assert.equal(presetOf({ id: 'x', layout: { byStructure: 'columns-3' } }), null);
  assert.equal(presetOf({ id: 'x', layout: { bySourceLayoutName: JSON.parse('{"__proto__": "content"}') } }), null);
  assert.equal(presetOf({ id: 'x', layout: { byTheme: { dark: 'section' } } }), null, 'a newer key is refused rather than half applied');
});

test('a preset from a plan keeps the base preset structure and layout-name maps', () => {
  const plan = sample<RenovationPlanV1>('plan');
  const base = presetOf({ id: 'base', layout: { bySourceLayoutName: { Divider: 'section' }, byStructure: { 'grid-2x2': 'grid-2x2' } } });
  assert.ok(base);
  const made = presetFromPlan(plan, null, { id: 'mine/next', base });
  assert.deepEqual(made.layout?.bySourceLayoutName, { Divider: 'section' });
  assert.deepEqual(made.layout?.byStructure, { 'grid-2x2': 'grid-2x2' });
});

test('pinned colours and left-out slides are read from a pack file, and a preset from a plan keeps the pinned colours', () => {
  const base = presetOf({ id: 'pins', excludeSlideIds: ['s3'], lockedColors: [{ useId: 'u1', to: '#112233', toPath: 'color.semantic.text' }] });
  assert.ok(base);
  assert.deepEqual(base.excludeSlideIds, ['s3']);
  assert.deepEqual(base.lockedColors, [{ useId: 'u1', to: '#112233', toPath: 'color.semantic.text' }]);
  assert.equal(presetOf({ id: 'x', lockedColors: [{ useId: 'u1', to: 'red' }] }), null, 'a colour the CLI refuses is refused here too');
  assert.equal(presetOf({ id: 'x', spare: true }), null, 'a field the engine does not read is refused');
  const made = presetFromPlan(sample<RenovationPlanV1>('plan'), null, { id: 'mine/next', base });
  assert.deepEqual(made.lockedColors, base.lockedColors);
});

test('pack presets are read through the asset query the slide master uses', async () => {
  const asked: Array<{ type?: string; tags?: string[] }> = [];
  const bytes = readFileSync(PACK_FILE);
  const entries = await readPackPresets({
    query: async (filter) => {
      asked.push(filter);
      return [{ id: 'lolly/slides/presets', url: '/catalog/assets/lolly/slides/presets.json' }];
    },
    bytes: async () => new Uint8Array(bytes),
  });
  assert.deepEqual(asked, [{ type: 'data', tags: [...PRESET_ASSET_TAGS] }]);
  assert.deepEqual(entries.map((one) => one.preset.id), ['tidy']);
  assert.deepEqual(await readPackPresets({ query: async () => { throw new Error('offline'); } }), [], 'a query that fails offers none');
});

/** A profile host holding one profile record in memory. */
function profileHost(): { host: Parameters<typeof readPersonalPresets>[0]; profile: () => Record<string, unknown> } {
  let profile: Record<string, unknown> = { folders: [{ id: 'kept' }] };
  return {
    host: {
      profile: {
        get: async () => structuredClone(profile),
        set: async (next) => {
          profile = structuredClone(next) as Record<string, unknown>;
        },
      },
    },
    profile: () => profile,
  };
}

test('Save as my preset writes the personal layer on the profile, as a scoped template record', async () => {
  const { host, profile } = profileHost();
  const saved = await savePersonalPreset(host, { id: 'mine/charts', actions: { chart: 'keep' } }, 'Charts');
  assert.equal(saved.origin, 'personal');
  const records = profile().userTemplates as Array<Record<string, unknown>>;
  assert.equal(records.length, 1);
  assert.equal(records[0]?.toolId, PERSONAL_PRESET_TOOL_ID);
  assert.equal(records[0]?.scope, 'look', 'scoped, so no template chooser offers it as a starting point');
  assert.deepEqual(profile().folders, [{ id: 'kept' }], 'sibling profile fields survive');

  // The same id again replaces the record in place, under the name given now, one version on.
  await savePersonalPreset(host, { id: 'mine/charts', version: '1', actions: { chart: 'remove' } }, 'charts');
  const listed = await readPersonalPresets(host);
  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.preset.actions?.chart, 'remove');
  assert.equal(listed[0]?.name, 'charts', 'the name typed this time');
  assert.equal(listed[0]?.preset.version, '2', 'the preset itself counts up, so a plan can tell the two apart');
});

test('a preset from a plan after Accept all marks nothing accepted, so the next deck still asks', () => {
  const plan = structuredClone(sample<RenovationPlanV1>('plan'));
  const census = sample<DeckCensusV1>('census');
  // What Accept all writes: every proposal as the person's decision.
  for (const slide of plan.slides) {
    for (const row of slide.objects) {
      row.decision = row.proposal;
      row.author = 'user';
      row.review = 'accepted';
    }
  }
  const preset = presetFromPlan(plan, census, { id: 'mine/all' });
  assert.equal(preset.review, undefined, 'no class is accepted without a person changing one of its proposals');
  assert.equal(preset.actions, undefined);
});

test('a pack preset wins over a personal one with the same id', () => {
  const pack = [{ preset: { id: 'tidy' }, name: 'Tidy', origin: 'pack' as const }];
  const personal = [
    { preset: { id: 'tidy' }, name: 'My tidy', origin: 'personal' as const },
    { preset: { id: 'mine/x' }, name: 'X', origin: 'personal' as const },
  ];
  assert.deepEqual(mergePresets(pack, personal).map((one) => one.name), ['Tidy', 'X']);
});

test('a personal preset id is a slug under mine/', () => {
  assert.equal(personalPresetId('Team Deck, 2026!'), 'mine/team-deck-2026');
  assert.equal(personalPresetId('   '), 'mine/preset');
});

test('a preset from a plan keeps only what the person decided the same way every time', () => {
  const plan = structuredClone(sample<RenovationPlanV1>('plan'));
  const census = sample<DeckCensusV1>('census');
  const [one, two] = plan.slides;
  assert.ok(one && two);
  // Both charts removed by the person, the title kept once and removed once.
  for (const row of two.objects) {
    row.decision = 'remove';
    row.author = 'user';
  }
  const title = one.objects.find((row) => row.class === 'title');
  assert.ok(title);
  title.decision = 'keep';
  title.author = 'user';
  const second = structuredClone(title);
  second.id = `${title.id}.b`;
  second.decision = 'remove';
  one.objects.push(second);
  // A rule's own proposal says nothing about the person.
  const rule = one.objects.find((row) => row.class === 'logo-candidate');
  if (rule) rule.author = 'rule';
  one.layout = 'split';
  one.layoutSource = 'user';
  two.layoutSource = 'proposed';

  const preset = presetFromPlan(plan, census, { id: 'mine/test', base: { id: 'tidy', actions: { decoration: 'remove' } } });
  assert.equal(preset.id, 'mine/test');
  assert.equal(preset.actions?.chart, 'remove');
  assert.equal(preset.review?.chart, 'accepted');
  assert.equal(preset.actions?.title, undefined, 'decided both ways, so left to the rules');
  assert.equal(preset.actions?.decoration, 'remove', 'the base preset stands where the person decided nothing');
  assert.equal(preset.actions?.['logo-candidate'], undefined);
  assert.equal(preset.layout?.fallback, 'split');
  assert.deepEqual(preset.logo, { policy: plan.logo.policy, variantByBackground: plan.logo.variantByBackground });
  assert.ok(presetOf(preset), 'what is saved reads back as a preset');
});
