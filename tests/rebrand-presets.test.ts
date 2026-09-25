// SPDX-License-Identifier: MPL-2.0
/**
 * Renovation presets (`packages/node-shell/src/rebrand/presets.ts`, plan 274
 * section 2.2): where they resolve from, how a file preset is read, the codes an
 * unusable one is refused with, and the preset lolly-start ships, checked against
 * the first pass it changes.
 *
 * Every case pins the lolly-start profile, the one a public clone resolves, and a
 * personal presets file in a temp directory, so no machine's own state leaks in.
 * Counts are read from the pipeline, never pinned.
 *
 * Run with: node --test tests/rebrand-presets.test.ts
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

import { effectiveAction } from '../engine/src/index.ts';
import type { ObjectClassV1, ObjectPlanV1, RenovationPlanV1 } from '../packages/core/src/index.ts';
import {
  PERSONAL_PRESETS_FILE,
  RebrandPresetError,
  listPresets,
  planDeck,
  presetProblems,
  resolvePreset,
  resolveProfileDesignSystem,
  toRenovationPreset,
  type PresetEntryV1,
  type PresetOptsV1,
  type RebrandXmlParserV1,
} from '../packages/node-shell/src/rebrand/index.ts';

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const LOLLY = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const PACK_FILE = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'presets.json');
const FIXTURES = ['simple', 'palette', 'adversarial'] as const;

/** Options that read lolly-start and a personal file in a fresh temp directory. */
function opts(personal?: unknown): PresetOptsV1 & { dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-presets-'));
  const personalFile = join(dir, PERSONAL_PRESETS_FILE);
  if (personal !== undefined) writeFileSync(personalFile, JSON.stringify(personal));
  return { profile: 'lolly-start', personalFile, dir };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    assert.ok(err instanceof RebrandPresetError, `expected a RebrandPresetError, got ${String(err)}`);
    return err.code;
  }
  assert.fail('expected the call to throw');
}

const domParser = new (new JSDOM('').window.DOMParser)();
const parseXml: RebrandXmlParserV1 = (xml) => domParser.parseFromString(xml, 'application/xml');

function rows(plan: RenovationPlanV1): ObjectPlanV1[] {
  return plan.slides.flatMap((slide) => slide.objects);
}

// ─── resolution ──────────────────────────────────────────────────────────────

test('the lolly-start design system ships the tidy preset, read through its asset tags', () => {
  const listing = listPresets(opts());
  assert.equal(listing.profile, 'lolly-start');
  assert.deepEqual(listing.invalid, []);
  const tidy = listing.presets.find((one) => one.id === 'tidy');
  assert.ok(tidy, 'tidy resolves');
  assert.equal(tidy.origin, 'pack');
  assert.equal(tidy.assetId, 'lolly/slides/presets');
  assert.equal(tidy.file, PACK_FILE);
  assert.equal(tidy.name, 'Tidy');
  assert.ok(!('name' in tidy.preset) && !('description' in tidy.preset), 'the fields for people never reach the first pass');

  const resolved = resolvePreset('tidy', opts());
  assert.equal(resolved.origin, 'pack');
  assert.deepEqual(resolved.preset, tidy.preset);
});

test('a personal preset resolves after the design system, and one with a design-system id is shadowed', () => {
  const o = opts({
    version: 1,
    presets: [
      { id: 'keep-everything', name: 'Keep everything', actions: { decoration: 'keep', 'page-number': 'keep', date: 'keep' } },
      { id: 'tidy', actions: { photo: 'remove' } },
    ],
  });
  const listing = listPresets(o);
  const ids = listing.presets.map((one) => `${one.origin}:${one.id}${one.shadowed ? ':shadowed' : ''}`);
  assert.deepEqual(ids, ['pack:tidy', 'personal:keep-everything', 'personal:tidy:shadowed']);

  assert.equal(resolvePreset('keep-everything', o).origin, 'personal');
  const tidy = resolvePreset('tidy', o);
  assert.equal(tidy.origin, 'pack', 'a team preset means the same thing on every machine');
  assert.notEqual(tidy.preset.actions?.photo, 'remove');
});

test('a design-system preset that does not validate still holds its id against a personal one', () => {
  // A content root of its own: one profile whose design system ships a broken tidy.
  const root = mkdtempSync(join(tmpdir(), 'lolly-presets-root-'));
  mkdirSync(join(root, 'tools'));
  mkdirSync(join(root, 'catalog', 'assets', 'team'), { recursive: true });
  writeFileSync(join(root, 'profiles.json'), JSON.stringify({ default: 'team', profiles: { team: { tools: ['tools'], catalog: 'catalog' } } }));
  writeFileSync(join(root, 'catalog', 'assets', 'team', 'presets.json'), JSON.stringify({ version: 1, presets: [{ id: 'tidy', actions: { photo: 'shred' } }] }));
  writeFileSync(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({
    version: '1',
    assets: [{ id: 'team/presets', type: 'data', tags: ['slides', 'rebrand-preset'], formats: [{ format: 'json', url: '/catalog/assets/team/presets.json' }] }],
  }));
  const o = { ...opts({ version: 1, presets: [{ id: 'tidy', actions: { photo: 'remove' } }] }), profile: 'team', root };
  const listing = listPresets(o);
  assert.deepEqual(listing.invalid.map((one) => `${one.origin}:${one.id}`), ['pack:tidy']);
  assert.deepEqual(listing.presets.map((one) => `${one.origin}:${one.id}${one.shadowed ? ':shadowed' : ''}`), ['personal:tidy:shadowed']);
  assert.equal(codeOf(() => resolvePreset('tidy', o)), 'preset.invalid', 'the personal tidy never stands in for the team one');
});

test('a broken personal file is listed as unusable and hides nothing else', () => {
  const o = opts();
  writeFileSync(o.personalFile!, '{ not json');
  const listing = listPresets(o);
  assert.ok(listing.presets.some((one) => one.id === 'tidy'));
  assert.equal(listing.invalid.length, 1);
  assert.equal(listing.invalid[0]?.origin, 'personal');
});

test('a file preset is read by path: one bare preset, or a preset file holding one', () => {
  const o = opts();
  const bare = join(o.dir, 'team.json');
  writeFileSync(bare, JSON.stringify({ id: 'team', review: { photo: 'needs-attention' } }));
  const one = resolvePreset(bare, o);
  assert.equal(one.origin, 'file');
  assert.equal(one.id, 'team');

  const wrapped = join(o.dir, 'wrapped.json');
  writeFileSync(wrapped, JSON.stringify({ version: 1, presets: [{ id: 'wrapped', layout: { fallback: 'content' } }] }));
  assert.equal(resolvePreset(wrapped, o).id, 'wrapped');

  const two = join(o.dir, 'two.json');
  writeFileSync(two, JSON.stringify({ version: 1, presets: [{ id: 'a' }, { id: 'b' }] }));
  assert.equal(codeOf(() => resolvePreset(two, o)), 'preset.invalid');

  const garbage = join(o.dir, 'garbage.json');
  writeFileSync(garbage, 'nope');
  assert.equal(codeOf(() => resolvePreset(garbage, o)), 'preset.unreadable');
  assert.equal(codeOf(() => resolvePreset(join(o.dir, 'absent.json'), o)), 'preset.unreadable');
});

test('an unknown id is refused with preset.unknown, and an invalid one with preset.invalid', () => {
  const o = opts({ version: 1, presets: [{ id: 'typo', action: { photo: 'remove' } }] });
  assert.equal(codeOf(() => resolvePreset('no-such-preset', o)), 'preset.unknown');
  assert.equal(codeOf(() => resolvePreset('typo', o)), 'preset.invalid');
});

test('validation checks every field the engine reads against the contract lists', () => {
  assert.deepEqual(presetProblems({ id: 'ok', actions: { decoration: 'remove' }, review: { photo: 'accepted' } }), []);
  const cases: Array<[unknown, RegExp]> = [
    [{ id: 'x', action: {} }, /"action" is not a preset field/],
    [{ id: 'x', actions: { poster: 'remove' } }, /not an object class/],
    [{ id: 'x', actions: { photo: 'delete' } }, /"actions.photo"/],
    [{ id: 'x', actions: { photo: 'replace' } }, /only a logo/],
    [{ id: 'x', review: { photo: 'done' } }, /"review.photo"/],
    [{ id: 'x', layout: { fallback: 'Hero Slide' } }, /"layout.fallback"/],
    [{ id: 'x', logo: { policy: 'swap' } }, /"logo.policy"/],
    [{ id: 'x', lockedColors: [{ useId: 'u', to: 'red' }] }, /#rrggbb/],
    [{ id: '' }, /"id"/],
  ];
  for (const [value, pattern] of cases) {
    const problems = presetProblems(value);
    assert.ok(problems.some((line) => pattern.test(line)), `${JSON.stringify(value)} gave ${JSON.stringify(problems)}`);
  }
});

// ─── plan 275: open archetype ids and the two new layout maps ────────────────

/** A preset from before plan 275: every archetype one of the twelve, every layout key one the old validator knew. */
const OLD_PRESET = {
  id: 'old',
  version: '1',
  name: 'Before the layout library',
  layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout2.xml': 'two-column' }, fallback: 'content', minGap: 0.1 },
};

test('a preset naming only the twelve archetypes still validates and reads the same', () => {
  assert.deepEqual(presetProblems(OLD_PRESET), []);
  const tidy = (JSON.parse(readFileSync(PACK_FILE, 'utf8')) as { presets: unknown[] }).presets;
  for (const preset of tidy) assert.deepEqual(presetProblems(preset), [], 'the shipped pack presets validate');
  const read = toRenovationPreset(OLD_PRESET as PresetEntryV1);
  assert.deepEqual(read.layout, OLD_PRESET.layout);
  assert.equal('name' in read, false);
});

test('a preset with byStructure and bySourceLayoutName validates, and both maps reach the engine', () => {
  const preset = {
    id: 'library',
    layout: {
      bySourceLayout: { 'ppt/slideLayouts/slideLayout3.xml': 'content' },
      bySourceLayoutName: { 'Three Column': 'columns-3', 'Title Only': 'title-only' },
      byStructure: { 'row:3|pic:none': 'columns-3', 'grid-2x2': 'grid-2x2' },
      fallback: 'title-body',
    },
  };
  assert.deepEqual(presetProblems(preset), []);
  const read = toRenovationPreset(preset as PresetEntryV1);
  assert.deepEqual(read.layout?.bySourceLayoutName, preset.layout.bySourceLayoutName);
  assert.deepEqual(read.layout?.byStructure, preset.layout.byStructure);
  assert.equal(read.layout?.fallback, 'title-body');
  assert.notEqual(read.layout?.byStructure, preset.layout.byStructure, 'copied, so an edit to the file value does not reach the engine');
});

test('the new layout maps refuse a malformed id, a reserved key and a key they do not know', () => {
  const cases: Array<[unknown, RegExp]> = [
    [{ id: 'x', layout: { byStructure: { 'grid-2x2': 'Grid 2x2' } } }, /"layout.byStructure.grid-2x2"/],
    [{ id: 'x', layout: { bySourceLayoutName: { Title: 7 } } }, /"layout.bySourceLayoutName.Title"/],
    [{ id: 'x', layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout1.xml': '-content' } } }, /"layout.bySourceLayout/],
    [{ id: 'x', layout: { byStructure: 'columns-3' } }, /"layout.byStructure" is an object/],
    [{ id: 'x', layout: { byStructure: JSON.parse('{"__proto__": "content"}') } }, /has the key "__proto__"/],
    [{ id: 'x', layout: { byTheme: { dark: 'section' } } }, /"layout.byTheme" is not a layout field/],
  ];
  for (const [value, pattern] of cases) {
    const problems = presetProblems(value);
    assert.ok(problems.some((line) => pattern.test(line)), `${JSON.stringify(value)} gave ${JSON.stringify(problems)}`);
  }
});

test('the CLI refuses an unknown preset with PRESET_UNKNOWN and lists what resolves', () => {
  const o = opts();
  const env = { ...process.env, LOLLY_PROFILE: 'lolly-start', LOLLY_STATE_DIR: o.dir, NO_COLOR: '1' };
  const deck = join(REPO, 'tests', 'fixtures', 'rebrand', 'simple.pptx');
  const refused = spawnSync(process.execPath, [LOLLY, 'rebrand', 'plan', deck, '--preset=no-such-preset', '--dry-run', '--json'], { cwd: REPO, env, encoding: 'utf8' });
  assert.equal(refused.status, 2, refused.stderr);
  const envelope = JSON.parse(refused.stdout) as { error: { kind: string; detail?: string } };
  assert.equal(envelope.error.kind, 'PRESET_UNKNOWN');
  assert.equal(envelope.error.detail, 'preset.unknown');

  const listed = spawnSync(process.execPath, [LOLLY, 'rebrand', 'presets', '--json'], { cwd: REPO, env, encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const result = (JSON.parse(listed.stdout) as { result: { presets: Array<{ id: string; origin: string }> } }).result;
  assert.deepEqual(result.presets.map((one) => `${one.origin}:${one.id}`), ['pack:tidy']);

  const byId = spawnSync(process.execPath, [LOLLY, 'rebrand', 'plan', deck, '--preset=tidy', '--dry-run', '--json'], { cwd: REPO, env, encoding: 'utf8' });
  assert.ok(byId.status === 0, byId.stderr);
  const plan = JSON.parse(byId.stdout) as { result: { preset: { id: string; origin: string } } };
  assert.deepEqual([plan.result.preset.id, plan.result.preset.origin], ['tidy', 'pack']);
});

// ─── the shipped preset against the first pass ───────────────────────────────

test('the lolly-start preset validates and changes the first pass the way it states', async () => {
  const file = JSON.parse(readFileSync(PACK_FILE, 'utf8')) as { version: number; presets: unknown[] };
  assert.equal(file.version, 1);
  for (const entry of file.presets) assert.deepEqual(presetProblems(entry), [], JSON.stringify(entry));

  const tidy = resolvePreset('tidy', opts());
  const stated = tidy.preset;
  const system = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(system);

  const removed: ObjectClassV1[] = ['decoration', 'page-number', 'date'];
  let seenRemoved = 0;
  for (const name of FIXTURES) {
    const bytes = new Uint8Array(readFileSync(join(REPO, 'tests', 'fixtures', 'rebrand', `${name}.pptx`)));
    const common = { bytes, name: `${name}.pptx`, parseXml, system: system.system, instanceId: `presets-${name}` };
    const plain = await planDeck(common);
    const shaped = await planDeck({ ...common, preset: stated });
    assert.equal(shaped.plan.presetId, 'tidy');

    const before = new Map(rows(plain.plan).map((row) => [row.id, row]));
    for (const row of rows(shaped.plan)) {
      const was = before.get(row.id);
      assert.ok(was, `${row.id} is in both plans`);
      assert.equal(row.class, was.class, 'a preset never changes what the census read');
      const action = stated.actions?.[row.class];
      const review = stated.review?.[row.class];
      if (action !== undefined || review !== undefined) {
        if (action !== undefined) assert.equal(effectiveAction(row), action, `${name} ${row.id} (${row.class}) takes the stated action`);
        if (review !== undefined) assert.equal(row.review, review, `${name} ${row.id} (${row.class}) takes the stated review`);
        assert.equal(row.author, 'preset');
        if (removed.includes(row.class)) seenRemoved += 1;
      } else {
        assert.equal(row.proposal, was.proposal, `${name} ${row.id} (${row.class}) is left to the rule`);
        assert.equal(row.review, was.review, `${name} ${row.id} (${row.class}) keeps the rule's review`);
      }
    }
    // "Without asking": nothing the preset answers is left for a person.
    for (const row of rows(shaped.plan)) {
      if (removed.includes(row.class)) {
        assert.equal(row.review, 'accepted');
        assert.equal(effectiveAction(row), 'remove');
      }
      if (row.class === 'photo') {
        assert.equal(effectiveAction(row), 'keep');
        assert.equal(row.review, 'needs-attention', 'every photo is still a question for a person');
      }
    }
  }
  assert.ok(seenRemoved > 0, 'the fixtures hold decoration, page numbers or dates for the preset to answer');
  assert.equal(stated.layout?.fallback, 'content');
});

// ─── the web reader and the CLI validator agree ──────────────────────────────

test('the web preset reader takes and refuses exactly what the CLI validator does, and carries the same fields', async () => {
  const web = await import('../shells/web/src/lib/rebrand/presets.ts');
  const cases: Array<[string, unknown]> = [
    ['a bare id', { id: 'ok' }],
    ['a name and a sentence for people', { id: 'ok', name: 'Tidy', description: 'Takes the clutter out.' }],
    ['pinned colours', { id: 'pins', lockedColors: [{ useId: 'u1', to: '#112233' }, { useId: 'u2', to: '#AABBCC', toPath: 'color.semantic.text' }] }],
    ['slides left out', { id: 'skip', excludeSlideIds: ['s1', 's2'] }],
    ['everything at once', {
      id: 'all', version: '2', actions: { decoration: 'remove', 'known-logo': 'replace' }, review: { photo: 'needs-attention' },
      layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout2.xml': 'two-column' }, byStructure: { 'row:3|pic:none': 'columns-3' }, fallback: 'content', minGap: 0.1 },
      logo: { policy: 'brand', variantByBackground: false }, excludeSlideIds: ['s9'], minSeparation: 0.05,
      lockedColors: [{ useId: 'u1', to: '#000000' }],
    }],
    ['an unknown top-level field', { id: 'x', action: { photo: 'keep' } }],
    ['a name that is not a string', { id: 'x', name: 7 }],
    ['a locked colour written as a word', { id: 'x', lockedColors: [{ useId: 'u1', to: 'red' }] }],
    ['a locked colour with no use id', { id: 'x', lockedColors: [{ to: '#112233' }] }],
    ['a locked colour with a numeric path', { id: 'x', lockedColors: [{ useId: 'u1', to: '#112233', toPath: 4 }] }],
    ['locked colours that are not a list', { id: 'x', lockedColors: { useId: 'u1', to: '#112233' } }],
    ['slide ids that are not strings', { id: 'x', excludeSlideIds: [1, 2] }],
    ['slide ids that are not a list', { id: 'x', excludeSlideIds: 's1' }],
    ['an unknown logo field', { id: 'x', logo: { policy: 'keep', size: 'large' } }],
    ['an unknown layout field', { id: 'x', layout: { byColour: {} } }],
    ['a replace on a photo', { id: 'x', actions: { photo: 'replace' } }],
    ['a separation of 0', { id: 'x', minSeparation: 0 }],
  ];
  for (const [what, value] of cases) {
    const cli = presetProblems(value);
    const read = web.presetOf(value);
    assert.equal(read === null, cli.length > 0, `${what}: the CLI says ${JSON.stringify(cli)}, the web reader ${read === null ? 'refuses it' : 'takes it'}`);
    if (read) assert.deepEqual(read, toRenovationPreset(value as PresetEntryV1), `${what}: both hand the engine the same preset`);
  }
});
