// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system resolver every renovation surface shares (plan 274
 * milestone 3, `engine/src/rebrand-design-system.ts`).
 *
 * Pins the four things a surface relies on: the neutral master in the engine
 * equals the lolly-start pack's file, the token hash does not move with key
 * order, swatch roles follow the path first and the measured colour second, and
 * the theme slot table is the one the Design PPTX lowering writes the theme
 * part from.
 *
 * Run with: node --test "tests/rebrand-design-system.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  FALLBACK_BRAND_FACE,
  THEME_SLOTS,
  THEME_SLOT_ALIASES,
  THEME_SLOT_TOKENS,
  colorTokenHash,
  neutralSlideMaster,
  resolveRebrandDesignSystem,
  masterForPlan,
  themeSourceOf,
  themedColors,
  swatchesFromColors,
  themeSlotsFromColors,
  type RebrandDesignSystemInputV1,
} from '../engine/src/rebrand-design-system.ts';
import { THEME_SLOT_TOKENS as PPTX_THEME_SLOT_TOKENS } from '../packages/node-shell/src/design-pptx.ts';
import type { SlideMasterFileV1 } from '../packages/core/src/index.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/index.ts';
import { STARTER_COLORS, STARTER_DESIGN_SYSTEM, STARTER_MASTER } from './helpers/rebrand-pipeline.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MASTERS_FILE = 'brands/lolly-start/catalog/assets/lolly/slides/masters.json';

function input(overrides: Partial<RebrandDesignSystemInputV1> = {}): RebrandDesignSystemInputV1 {
  return {
    id: 'test/system',
    master: neutralSlideMaster(),
    colors: {
      'color.semantic.surface': '#FFFFFF',
      'color.semantic.text': '#1d1d1d',
      'color.semantic.primary': '#0c7c59',
      'color.semantic.secondary': '#525252',
    },
    fonts: { brand: 'Inter', mono: 'JetBrains Mono' },
    ...overrides,
  };
}

// ─── the neutral master ──────────────────────────────────────────────────────

test('neutralSlideMaster equals masters[0] of the lolly-start pack', () => {
  const file = JSON.parse(readFileSync(path.join(ROOT, MASTERS_FILE), 'utf8')) as SlideMasterFileV1;
  assert.deepEqual(neutralSlideMaster(), file.masters[0],
    `NEUTRAL_MASTER in engine/src/rebrand-design-system.ts has drifted from masters[0] of ${MASTERS_FILE}; copy that entry over the literal`);
  assert.deepEqual(neutralSlideMaster(), STARTER_MASTER);
});

test('neutralSlideMaster hands out a fresh copy each call', () => {
  const one = neutralSlideMaster();
  one.name = 'edited';
  one.archetypes.length = 0;
  const two = neutralSlideMaster();
  assert.notEqual(two.name, 'edited');
  assert.ok(two.archetypes.length > 0);
});

// ─── the snapshot ────────────────────────────────────────────────────────────

test('the token hash is stable across key order and case, and moves with a value', async () => {
  const a = await colorTokenHash({ 'color.a': '#AABBCC', 'color.b': '#112233' });
  const b = await colorTokenHash({ 'color.b': '#112233', 'color.a': '#aabbcc' });
  const c = await colorTokenHash({ 'color.a': '#aabbcc', 'color.b': '#112234' });
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('the token hash reads every spelling of one colour as the same colour', async () => {
  const white = await colorTokenHash({ 'color.a': '#ffffff' });
  for (const spelling of ['#FFF', '#fff', 'ffffff', '#FFFFFFFF', '#ffff', ' #FfFfFf ']) {
    assert.equal(await colorTokenHash({ 'color.a': spelling }), white, spelling);
  }
  assert.notEqual(await colorTokenHash({ 'color.a': '#ffffff80' }), white, 'a real alpha is a different colour');
  assert.equal(await colorTokenHash({ 'color.a': '#abc8' }), await colorTokenHash({ 'color.a': '#aabbcc88' }));
});

test('the same input in a different key order resolves to the same snapshot', async () => {
  const forward = input({ fontHashes: { Inter: 'sha256:1', Mono: 'sha256:2' }, assetHashes: { 'x/logo': 'sha256:3' } });
  const colors = Object.fromEntries(Object.entries(forward.colors).reverse());
  const fontHashes = { Mono: 'sha256:2', Inter: 'sha256:1' };
  const one = await resolveRebrandDesignSystem(forward);
  const two = await resolveRebrandDesignSystem({ ...forward, colors, fontHashes });
  assert.deepEqual(one.snapshot, two.snapshot);
  assert.equal(JSON.stringify(one.snapshot), JSON.stringify(two.snapshot));
  assert.deepEqual(one.firstPass.swatches, two.firstPass.swatches);
  assert.deepEqual(one.slots, two.slots);
});

test('the snapshot names the master, the preset and the hashes', async () => {
  const resolved = await resolveRebrandDesignSystem(input({
    preset: { id: 'org/quarterly', version: '2.1.0' },
    fontHashes: { Inter: 'sha256:f' },
    assetHashes: { 'test/logo': 'sha256:a' },
  }));
  const master = neutralSlideMaster();
  assert.equal(resolved.snapshot.id, 'test/system');
  assert.equal(resolved.snapshot.masterId, master.id);
  assert.equal(resolved.snapshot.masterVersion, master.version);
  assert.equal(resolved.snapshot.presetId, 'org/quarterly');
  assert.equal(resolved.snapshot.presetVersion, '2.1.0');
  assert.deepEqual(resolved.snapshot.fontHashes, { Inter: 'sha256:f' });
  assert.deepEqual(resolved.snapshot.assetHashes, { 'test/logo': 'sha256:a' });
  assert.equal(resolved.firstPass.snapshot, resolved.snapshot);
  assert.equal(resolved.compile.snapshot, resolved.snapshot);
});

test('the compile shape resolves tokens, carries logos and names the brand face twice', async () => {
  const resolved = await resolveRebrandDesignSystem(input({ logos: { onLight: 'test/logo/primary', onDark: 'test/logo/reverse' } }));
  assert.equal(resolved.compile.tokens('color.semantic.primary'), '#0c7c59');
  assert.equal(resolved.compile.tokens('color.semantic.missing'), undefined);
  assert.deepEqual(resolved.compile.logos, { onLight: 'test/logo/primary', onDark: 'test/logo/reverse' });
  assert.deepEqual(resolved.compile.fonts, { major: 'Inter', minor: 'Inter' });
  assert.equal(resolved.firstPass.fonts.brand, 'Inter');
  assert.equal(resolved.firstPass.fonts.mono, 'JetBrains Mono');
});

test('a design system with no face plans against a generic family and claims none in the compile', async () => {
  const resolved = await resolveRebrandDesignSystem(input({ fonts: undefined }));
  assert.equal(resolved.firstPass.fonts.brand, FALLBACK_BRAND_FACE);
  assert.equal(resolved.compile.fonts, undefined);
});

test('the resolved input is a copy, so a later edit to the caller object moves nothing', async () => {
  const raw = input({ logos: { onLight: 'test/logo/primary' } });
  const resolved = await resolveRebrandDesignSystem(raw);
  raw.colors['color.semantic.primary'] = '#ff0000';
  raw.master.name = 'mutated';
  raw.master.archetypes.length = 0;
  if (raw.logos) raw.logos.onLight = 'mutated';
  assert.equal(resolved.input.colors['color.semantic.primary'], '#0c7c59');
  assert.equal(resolved.compile.tokens('color.semantic.primary'), '#0c7c59');
  assert.equal(resolved.firstPass.master.name, neutralSlideMaster().name);
  assert.ok(resolved.firstPass.master.archetypes.length > 0);
  assert.equal(resolved.compile.logos?.onLight, 'test/logo/primary');
});

test('the first pass is handed the slot table, as first candidates the solve may move', async () => {
  const resolved = await resolveRebrandDesignSystem(input());
  assert.deepEqual(resolved.firstPass.slots, resolved.slots);
  assert.deepEqual(resolved.slots.accent1, { hex: '#0c7c59', path: 'color.semantic.primary' });
  assert.ok(STARTER_DESIGN_SYSTEM.firstPass.slots?.tx1, 'the starter names its text slot too');
});

test('the input survives a structured clone, so a shell can post it to a worker', async () => {
  const raw = input({ neutralMaster: true, preset: { id: 'p' } });
  const posted = structuredClone(raw);
  const one = await resolveRebrandDesignSystem(raw);
  const two = await resolveRebrandDesignSystem(posted);
  assert.deepEqual(one.snapshot, two.snapshot);
  assert.equal(two.input.neutralMaster, true);
});

// ─── swatches ────────────────────────────────────────────────────────────────

test('swatch roles come from the path first and the measured colour second', () => {
  const swatches = swatchesFromColors({
    'color.semantic.surface': '#ffffff',
    'color.background.alt': '#f4f4f4',
    'color.paper': '#fafafa',
    'color.canvas-dark': '#101010',
    'color.semantic.text': '#1d1d1d',
    'color.ink': '#222222',
    'color.foreground.muted': '#555555',
    'color.semantic.on-primary': '#ffffff',
    'color.semantic.primary': '#0c7c59',
    'color.ramp.neutral.5': '#999999',
    'color.brand.teal': '#30ba78',
  });
  const role = Object.fromEntries(swatches.map((swatch) => [swatch.path, swatch.role]));
  assert.deepEqual(role, {
    'color.background.alt': 'bg',
    'color.brand.teal': 'accent',
    'color.canvas-dark': 'bg',
    'color.foreground.muted': 'ink',
    'color.ink': 'ink',
    'color.paper': 'bg',
    'color.ramp.neutral.5': 'neutral',
    'color.semantic.on-primary': 'neutral',
    'color.semantic.primary': 'accent',
    'color.semantic.surface': 'bg',
    'color.semantic.text': 'ink',
  });
  assert.deepEqual(swatches.map((swatch) => swatch.path), Object.keys(role).sort());
  const onPrimary = swatches.find((swatch) => swatch.path === 'color.semantic.on-primary');
  assert.equal(onPrimary?.inkFor, 'primary', 'on-primary is ink for the primary fill, and says so');
});

test('role words are read in kebab, snake and camel case, last word first, with a leading on as ink for that surface', () => {
  const swatches = swatchesFromColors({
    'color.canvas-text': '#111111',
    'color.footer.page-number': '#777777',
    'color.onPrimary': '#ffffff',
    'color.onSurface': '#1d1d1d',
    'color.surfaceBrand': '#30ba78',
    'color.text_on_dark': '#fefefe',
    'color.backgroundSubtle': '#f4f4f4',
    'color.page': '#fafafa',
    'color.fgMuted': '#666666',
    'color.brand.teal': '#30ba78',
  });
  const role = Object.fromEntries(swatches.map((swatch) => [swatch.path, swatch.role]));
  assert.deepEqual(role, {
    'color.backgroundSubtle': 'bg',
    'color.brand.teal': 'accent',
    'color.canvas-text': 'ink',
    'color.fgMuted': 'ink',
    'color.footer.page-number': 'neutral',
    'color.onPrimary': 'neutral',
    'color.onSurface': 'neutral',
    'color.page': 'neutral',
    'color.surfaceBrand': 'bg',
    'color.text_on_dark': 'ink',
  });
  const inkFor = Object.fromEntries(swatches.filter((swatch) => swatch.inkFor).map((swatch) => [swatch.path, swatch.inkFor]));
  assert.deepEqual(inkFor, { 'color.onPrimary': 'primary', 'color.onSurface': 'surface' });
});

test('an achromatic colour with no role name is neutral, and equal hexes stay separate paths', () => {
  const swatches = swatchesFromColors({ 'color.semantic.primary': '#1d1d1d', 'color.ramp.1': '#1d1d1d' });
  assert.equal(swatches.length, 2);
  assert.ok(swatches.every((swatch) => swatch.role === 'neutral'));
});

test('the starter pack: primary is ink-coloured but named for nothing, so it is neutral now', () => {
  // The harness used to hand-map color.semantic.primary to ink. The general rule
  // reads the path, which names no role, and the colour, which is a grey, so it
  // is neutral; only surface and text keep a named role, and on-primary is ink
  // for the primary fill only, so it takes the neutral role its grey gives it.
  const role = Object.fromEntries(STARTER_DESIGN_SYSTEM.firstPass.swatches.map((swatch) => [swatch.path, swatch.role]));
  assert.equal(role['color.semantic.surface'], 'bg');
  assert.equal(role['color.semantic.text'], 'ink');
  assert.equal(role['color.semantic.on-primary'], 'neutral');
  assert.equal(role['color.semantic.primary'], 'neutral');
  assert.equal(STARTER_DESIGN_SYSTEM.firstPass.swatches.length, STARTER_COLORS.size);
});

/**
 * The swatch roles of the two token sets a renovation meets, pinned. The only
 * generic ink is the colour named for text; `on-primary` is white, set on the
 * primary fill, and filing it as ink sent a deck's black body text to white on
 * the white content slide.
 */
test('swatch roles over the starter and SUSE token sets: text is ink, surface is ground, on-primary is ink for primary only', async (t) => {
  const suse = await resolveProfileDesignSystem({ profile: 'suse', root: ROOT }).catch(() => null);
  const sets: Array<{ name: string; swatches: typeof STARTER_DESIGN_SYSTEM.firstPass.swatches }> = [
    { name: 'lolly-start', swatches: STARTER_DESIGN_SYSTEM.firstPass.swatches },
  ];
  if (suse?.system.input.master.id === 'suse/slides/brand') sets.push({ name: 'suse', swatches: suse.system.firstPass.swatches });
  else t.diagnostic('brands/suse is not on this machine, so only the starter set is pinned');
  for (const { name, swatches } of sets) {
    const byPath = new Map(swatches.map((swatch) => [swatch.path, swatch]));
    assert.equal(byPath.get('color.semantic.text')?.role, 'ink', `${name}: text is ink`);
    assert.equal(byPath.get('color.semantic.surface')?.role, 'bg', `${name}: surface is ground`);
    const onPrimary = byPath.get('color.semantic.on-primary');
    assert.ok(onPrimary, `${name}: states on-primary`);
    assert.notEqual(onPrimary.role, 'ink', `${name}: on-primary is not generic ink`);
    assert.equal(onPrimary.inkFor, 'primary');
    const inks = swatches.filter((swatch) => swatch.role === 'ink').map((swatch) => swatch.path);
    assert.deepEqual(inks, ['color.semantic.text'], `${name}: the one generic ink is the text colour`);
    if (name === 'suse') {
      assert.equal(byPath.get('color.semantic.text')?.hex, '#0c322c', 'SUSE text is pine');
      assert.equal(byPath.get('color.semantic.on-primary')?.hex, '#ffffff', 'SUSE on-primary is white');
    }
  }
});

// ─── theme slots ─────────────────────────────────────────────────────────────

test('the slot table is the one the Design PPTX lowering writes the theme from', () => {
  assert.equal(PPTX_THEME_SLOT_TOKENS, THEME_SLOT_TOKENS, 'the lowering reads the engine table itself, not a copy');
  assert.deepEqual({ ...THEME_SLOT_TOKENS }, {
    dk1: 'color.semantic.text',
    lt1: 'color.semantic.surface',
    dk2: 'color.semantic.muted',
    accent1: 'color.semantic.primary',
    accent2: 'color.semantic.secondary',
    accent3: 'color.semantic.accent',
  });
  assert.deepEqual([...THEME_SLOTS], ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6']);
  assert.ok(Object.isFrozen(THEME_SLOT_TOKENS) && Object.isFrozen(THEME_SLOT_ALIASES));
});

test('themeSlotsFromColors answers each slot whose token is stated, and the tx and bg aliases', () => {
  const slots = themeSlotsFromColors({
    'color.semantic.text': '#111111',
    'color.semantic.surface': '#fefefe',
    'color.semantic.primary': '#0c7c59',
  });
  assert.deepEqual(slots, {
    accent1: { hex: '#0c7c59', path: 'color.semantic.primary' },
    dk1: { hex: '#111111', path: 'color.semantic.text' },
    lt1: { hex: '#fefefe', path: 'color.semantic.surface' },
    bg1: { hex: '#fefefe', path: 'color.semantic.surface' },
    tx1: { hex: '#111111', path: 'color.semantic.text' },
  });
  for (const [slot, tokenPath] of Object.entries(THEME_SLOT_TOKENS)) {
    const entry = themeSlotsFromColors({ [tokenPath]: '#123456' })[slot];
    assert.deepEqual(entry, { hex: '#123456', path: tokenPath }, `${slot} reads ${tokenPath}`);
  }
});

// ─── the dark mode and the deck theme (plan 275 section 6) ───────────────────

test('the dark mode rides on the input without moving the token hash, and survives a structured clone', async () => {
  const darkColors = { 'color.semantic.surface': '#1d1d1d', 'color.semantic.text': '#ffffff' };
  const plain = await resolveRebrandDesignSystem(input());
  const withDark = await resolveRebrandDesignSystem(input({ darkColors }));
  assert.equal(withDark.snapshot.tokenHash, plain.snapshot.tokenHash, 'the hash identifies the pack before a theme');
  assert.deepEqual(structuredClone(withDark.input).darkColors, darkColors);
  assert.deepEqual(themeSourceOf(withDark.compile)?.darkColors, darkColors, 'the compile shape remembers the colours it came from');
  assert.equal(themeSourceOf(structuredClone(withDark.firstPass)), undefined, 'a clone forgets, and systemForPlan then reads its swatches');
});

test('themedColors resolves the Dark mode, keeps every hex inside it, and measures each ground', async () => {
  const darkColors = {
    'color.semantic.surface': '#1d1d1d',
    'color.semantic.text': '#ffffff',
    'color.semantic.primary': '#9ad1b9',
    'color.semantic.secondary': '#dcdbdc',
  };
  const system = await resolveRebrandDesignSystem(input({ darkColors }));
  const theme = { id: 'dark' as const, mode: 'dark' as const, remap: [], flipDark: true };
  const themed = themedColors(themeSourceOf(system) ?? { colors: {}, master: system.input.master }, theme);
  assert.equal(themed.mode, 'dark');
  assert.deepEqual(themed.notes, []);
  assert.equal(themed.colors['color.semantic.surface'], '#1d1d1d');
  const content = themed.master.archetypes.find((one) => one.id === 'content');
  const title = themed.master.archetypes.find((one) => one.id === 'title');
  assert.equal(content?.background?.dark, true, 'a surface ground is dark in the dark mode');
  assert.equal(title?.background?.dark, false, 'a text ground is light in the dark mode');
  const allowed = new Set(Object.values(darkColors));
  for (const hex of Object.values(themed.colors)) assert.ok(allowed.has(hex), `${hex} is a dark mode colour`);
});

test('a remap target the mode does not state is skipped and reported, never filled', async () => {
  const system = await resolveRebrandDesignSystem(input());
  const themed = themedColors(themeSourceOf(system) ?? { colors: {}, master: system.input.master }, {
    id: 'brand',
    remap: [{ from: 'color.semantic.surface', to: 'color.brand.invented' }],
  });
  assert.equal(themed.colors['color.semantic.surface'], '#FFFFFF');
  assert.deepEqual(themed.notes, [{ code: 'theme.remap-skipped', params: { from: 'color.semantic.surface', to: 'color.brand.invented' } }]);
});

test('masterForPlan sets the flags for the plan\'s theme and hands the master back unchanged with none', async () => {
  const system = await resolveRebrandDesignSystem(input({ darkColors: { 'color.semantic.surface': '#101010', 'color.semantic.text': '#fafafa' } }));
  const master = system.input.master;
  assert.equal(masterForPlan(master, null, { system }), master);
  const themed = masterForPlan(master, { designSystem: { theme: { id: 'dark', mode: 'dark', remap: [], flipDark: true } } }, { system });
  assert.equal(themed.archetypes.find((one) => one.id === 'content')?.background?.dark, true);
  assert.equal(master.archetypes.find((one) => one.id === 'content')?.background?.dark, false, 'the given master is not changed');
});
