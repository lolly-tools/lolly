// SPDX-License-Identifier: MPL-2.0
/**
 * Deck themes and a slide's own ground (plan 275 section 6, work package 7).
 *
 * The acceptance lines this file pins, over the two packs this checkout carries
 * (the SUSE cases skip by name on a public clone):
 *
 *   - Dark draws only hexes from the pack's dark mode tokens;
 *   - no theme introduces a hex absent from the resolved token set of its mode;
 *   - Brand remaps every ground in both masters;
 *   - per ground group, no text sits under its minimum without an unresolved row,
 *     including on the slides whose source states no ground;
 *   - every bar, panel, page number and footer stays readable on what it sits on;
 *   - no two offered themes are one choice at a glance;
 *   - a stored Dark is never drawn in the light colours, in either realm;
 *   - the look theme is absent, and refused, on a locked design system;
 *   - undo restores the theme, every ground and every remapped use.
 *
 * Run with: node --test "tests/rebrand-theme.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { contrastRatio } from '../engine/src/brand-derive.ts';
import {
  masterForPlan,
  resolveRebrandDesignSystem,
  systemForPlan,
  themedColors,
  type DeckLookV1,
  type RebrandDesignSystemV1,
  type ThemeSourceV1,
} from '../engine/src/rebrand-design-system.ts';
import {
  brandGroundPath,
  buildDeckTheme,
  captureThemeRows,
  deckGround,
  deckThemeChoices,
  masterTokenPaths,
  restoreThemeRows,
  setDeckTheme,
  setSlideGround,
  slideGroundPlan,
  solveThemeColors,
  themePreview,
  THEME_ROW_ID,
  type ThemeSolveContextV1,
} from '../engine/src/rebrand-theme.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { compileRenovated, compileSystemOpts } from '../engine/src/deck-compile.ts';
import { firstPass } from '../engine/src/rebrand-plan.ts';
import type { DeckThemeV1, RenovationPlanV1, SlideMasterV1 } from '../packages/core/src/index.ts';
import { profileDesignSystem, runRebrandPipeline, STARTER_DESIGN_SYSTEM } from './helpers/rebrand-pipeline.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The pack's dark mode as a shell reads it: the `dark` theme composed over the base. */
function darkColorsOf(tokensFile: string): Record<string, string> {
  const doc: unknown = JSON.parse(readFileSync(path.join(ROOT, tokensFile), 'utf8'));
  const out: Record<string, string> = {};
  for (const entry of createTokenSet(doc, { theme: 'dark' }).query({ type: 'color' })) {
    if (typeof entry.value === 'string') out[entry.path] = entry.value;
  }
  return out;
}

const STARTER_TOKENS = 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json';
const SUSE_TOKENS = 'brands/suse/catalog/assets/suse/tokens/brand.json';

function sourceOf(system: RebrandDesignSystemV1, tokensFile: string, withDark = true): ThemeSourceV1 {
  return {
    colors: system.input.colors,
    ...(withDark ? { darkColors: darkColorsOf(tokensFile) } : {}),
    master: system.input.master,
  };
}

const STARTER = sourceOf(STARTER_DESIGN_SYSTEM, STARTER_TOKENS);
const SUSE_SYSTEM = await profileDesignSystem('suse');
const SUSE = SUSE_SYSTEM ? sourceOf(SUSE_SYSTEM, SUSE_TOKENS) : null;

const norm = (hex: string): string => hex.trim().toLowerCase().replace(/^#/, '').slice(0, 6);

/** Every colour a master draws with under a theme: grounds, panels, bars and inks, resolved. */
function drawnHexes(master: SlideMasterV1, colors: Record<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const tokenPath of masterTokenPaths(master).keys()) {
    const hex = colors[tokenPath];
    if (hex !== undefined) out.set(tokenPath, hex);
  }
  return out;
}

/** A saved look, made the way the look library makes its examples: from one colour. */
const ORCHARD: DeckLookV1 = {
  id: 'example:orchard',
  name: 'Orchard',
  colors: {
    'color.semantic.surface': '#f7f5ef',
    'color.semantic.text': '#1f2a22',
    'color.semantic.primary': '#39734d',
    'color.semantic.on-primary': '#ffffff',
    'color.semantic.muted': '#56615a',
  },
};

// ─── what a theme may draw ───────────────────────────────────────────────────

for (const [name, source] of [['starter', STARTER], ['SUSE', SUSE]] as const) {
  test(`${name}: Dark draws only hexes from the pack's dark mode tokens`, (t) => {
    if (!source) return t.skip('the SUSE pack is not in this checkout');
    const dark = new Set(Object.values(source.darkColors ?? {}).map(norm));
    const choice = buildDeckTheme('dark', source);
    assert.ok(choice);
    assert.equal(choice.theme.mode, 'dark');
    const themed = themedColors(source, choice.theme);
    assert.equal(themed.mode, 'dark');
    for (const [tokenPath, hex] of drawnHexes(themed.master, themed.colors)) {
      assert.ok(dark.has(norm(hex)), `${tokenPath} draws ${hex}, which the dark mode does not state`);
    }
    assert.deepEqual(choice.notes, []);
  });

  test(`${name}: no theme introduces a hex absent from the resolved token set of its mode`, (t) => {
    if (!source) return t.skip('the SUSE pack is not in this checkout');
    for (const withDark of [true, false]) {
      const from: ThemeSourceV1 = withDark ? source : { colors: source.colors, master: source.master };
      for (const choice of deckThemeChoices(from, { looks: [ORCHARD] })) {
        const themed = themedColors(from, choice.theme, { look: ORCHARD });
        const allowed = new Set(Object.values(themed.modeColors).map(norm));
        for (const [tokenPath, hex] of Object.entries(themed.colors)) {
          assert.ok(allowed.has(norm(hex)), `${choice.id}: ${tokenPath} resolves to ${hex}, outside its mode`);
        }
        // The master's own inks, after a failing one is swapped, still resolve inside the set.
        for (const archetype of themed.master.archetypes) {
          for (const placeholder of archetype.placeholders) {
            const ink = placeholder.style?.fgTokenPath;
            if (ink) assert.ok(themed.colors[ink] !== undefined, `${choice.id}: ${archetype.id} names ${ink}, which the theme cannot resolve`);
          }
        }
        // The swatch tile shows colours of the set too.
        for (const hex of Object.values(choice.swatches)) assert.ok(allowed.has(norm(hex)), `${choice.id} tile shows ${hex}`);
      }
    }
  });

  test(`${name}: Brand remaps every ground the Light theme draws light`, (t) => {
    if (!source) return t.skip('the SUSE pack is not in this checkout');
    const choice = buildDeckTheme('brand', source);
    assert.ok(choice);
    const light = themedColors(source, null);
    const brand = themedColors(source, choice.theme);
    const primary = norm(source.colors['color.semantic.primary'] ?? '');
    let moved = 0;
    for (const archetype of source.master.archetypes) {
      const ground = archetype.background?.tokenPath;
      if (!ground || archetype.background?.dark === true) continue;
      const before = light.colors[ground];
      const after = brand.colors[ground];
      assert.ok(after, `${archetype.id} has a ground under Brand`);
      // A ground already in a brand hue (SUSE's jungle section) stays; every plain ground takes the primary.
      if (norm(before ?? '') === norm(source.colors['color.semantic.secondary'] ?? '')) continue;
      assert.equal(norm(after), primary, `${archetype.id} ground ${ground}`);
      moved += 1;
    }
    assert.ok(moved > 10, 'the light archetypes of the master all moved');
  });

  test(`${name}: every themed layout keeps its text, page numbers, footers, rules and panels readable on what they sit on`, (t) => {
    if (!source) return t.skip('the SUSE pack is not in this checkout');
    const brandOnPrimary = buildDeckTheme('brand', source);
    const themes = [...deckThemeChoices(source).map((one) => one.theme), ...(brandOnPrimary ? [brandOnPrimary.theme] : [])];
    const shipped = themedColors(source, null);
    for (const theme of themes) {
      const themed = themedColors(source, theme);
      const furniture = new Map(themed.master.furniture.map((piece) => [piece.id, piece]));
      const baseFurniture = new Map(source.master.furniture.map((piece) => [piece.id, piece]));
      const under = (archetype: SlideMasterV1['archetypes'][number], pieces: Map<string, SlideMasterV1['furniture'][number]>, colors: Record<string, string>, ground: string, box: { x: number; y: number; w: number; h: number }, before?: number): string => {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        let backdrop = ground;
        const ids = archetype.furniture ?? [];
        for (const id of ids.slice(0, before ?? ids.length)) {
          const piece = pieces.get(id);
          if (piece?.kind !== 'rect') continue;
          const { x, y, w, h } = piece.box;
          if (cx < x || cx > x + w || cy < y || cy > y + h) continue;
          const fill = (piece.tokenPath ? colors[piece.tokenPath] : piece.hex) ?? backdrop;
          if (fill.length === 7 || Number.parseInt(fill.slice(7, 9), 16) >= 128) backdrop = fill;
        }
        return backdrop;
      };
      // The least contrast the shipped master gives each bar or panel across its layouts.
      const least = new Map<string, number>();
      for (const archetype of source.master.archetypes) {
        const groundPath = archetype.background?.tokenPath;
        const ground = groundPath ? shipped.colors[groundPath] : archetype.background?.hex;
        if (!ground) continue;
        (archetype.furniture ?? []).forEach((id, at) => {
          const piece = baseFurniture.get(id);
          const fill = piece?.tokenPath ? shipped.colors[piece.tokenPath] : undefined;
          if (!piece || !fill || (piece.kind !== 'bar' && piece.kind !== 'rect')) return;
          const ratio = contrastRatio(fill.slice(0, 7), under(archetype, baseFurniture, shipped.colors, ground, piece.box, at).slice(0, 7));
          least.set(id, Math.min(least.get(id) ?? Number.POSITIVE_INFINITY, ratio));
        });
      }
      for (const archetype of themed.master.archetypes) {
        const groundPath = archetype.background?.tokenPath;
        const ground = groundPath ? themed.colors[groundPath] : archetype.background?.hex;
        if (!ground) continue;
        for (const placeholder of archetype.placeholders) {
          const ink = placeholder.style?.fgTokenPath ? themed.colors[placeholder.style.fgTokenPath] : undefined;
          if (!ink) continue;
          const ratio = contrastRatio(ink.slice(0, 7), under(archetype, furniture, themed.colors, ground, placeholder.box).slice(0, 7));
          assert.ok(ratio >= 3, `${theme.id}: ${archetype.id} ${placeholder.role} at ${ratio.toFixed(2)}:1`);
        }
        (archetype.furniture ?? []).forEach((id, at) => {
          const piece = furniture.get(id);
          assert.ok(piece, `${theme.id}: ${archetype.id} names furniture ${id}, which the themed master holds`);
          const backdrop = under(archetype, furniture, themed.colors, ground, piece.box, at).slice(0, 7);
          const ink = piece.style?.fgTokenPath ? themed.colors[piece.style.fgTokenPath] : undefined;
          if (ink && (piece.kind === 'page-number' || piece.kind === 'footer')) {
            const ratio = contrastRatio(ink.slice(0, 7), backdrop);
            assert.ok(ratio >= 4.5, `${theme.id}: ${archetype.id} ${id} text at ${ratio.toFixed(2)}:1`);
          }
          const fill = piece.tokenPath ? themed.colors[piece.tokenPath] : undefined;
          const baseId = [...baseFurniture.keys()].find((one) => one === id || id.startsWith(`${one}-t`)) ?? id;
          const floor = least.get(baseId);
          if (fill && floor !== undefined && floor > 1.05) {
            const ratio = contrastRatio(fill.slice(0, 7), backdrop);
            assert.ok(ratio + 1e-9 >= Math.min(3, floor), `${theme.id}: ${archetype.id} ${id} at ${ratio.toFixed(2)}:1, the pack draws it at ${floor.toFixed(2)}:1 at least`);
          }
        });
      }
    }
  });

  test(`${name}: no two offered themes are one choice at a glance`, (t) => {
    if (!source) return t.skip('the SUSE pack is not in this checkout');
    const choices = deckThemeChoices(source, { looks: [ORCHARD] });
    const seen = new Set<string>();
    for (const choice of choices) {
      const key = [choice.swatches.ground, choice.swatches.ink, choice.swatches.accent].map(norm).join('|');
      assert.ok(!seen.has(key), `${choice.id} shows the same three colours as another tile`);
      seen.add(key);
    }
    const grounds = choices.filter((one) => one.id !== 'look').map((one) => one.swatches.ground);
    for (let i = 0; i < grounds.length; i += 1) {
      for (let j = i + 1; j < grounds.length; j += 1) {
        assert.ok(contrastRatio(grounds[i] ?? '', grounds[j] ?? '') >= 1.5, `${choices[i]?.id} and ${choices[j]?.id} ground on ${grounds[i]} and ${grounds[j]}`);
      }
    }
  });
}

test('SUSE grounds Brand colour on its jungle with pine ink, since its primary is the Dark ground', (t) => {
  if (!SUSE) return t.skip('the SUSE pack is not in this checkout');
  const brand = deckThemeChoices(SUSE).find((one) => one.id === 'brand');
  assert.ok(brand, 'SUSE offers a Brand colour theme');
  assert.equal(norm(brand.swatches.ground), '30ba78');
  assert.equal(norm(brand.swatches.ink), '0c322c');
  assert.ok(contrastRatio(brand.swatches.ink, brand.swatches.ground) >= 4.5);
});

test('an achromatic pack whose primary is its Dark ground offers no Brand colour tile', () => {
  assert.deepEqual(deckThemeChoices(STARTER).map((one) => one.id), ['light', 'dark']);
});

test('a pack with no dark mode gets a Dark from its own ramp, and says so', () => {
  const source: ThemeSourceV1 = { colors: STARTER.colors, master: STARTER.master };
  const choice = buildDeckTheme('dark', source);
  assert.ok(choice);
  assert.equal(choice.theme.mode, undefined, 'the light set, since there is no other');
  assert.deepEqual(choice.notes.map((note) => note.code), ['theme.no-dark-mode']);
  const ground = choice.notes[0]?.params?.ground ?? '';
  assert.match(ground, /^color\.ramp\./, 'the ground is a step of a ramp the pack states');
  const themed = themedColors(source, choice.theme);
  assert.equal(norm(themed.colors['color.semantic.surface'] ?? ''), norm(source.colors[ground] ?? ''));
  assert.ok(contrastRatio(themed.colors['color.semantic.text'] ?? '', themed.colors['color.semantic.surface'] ?? '') >= 4.5);
});

test('a stored Dark theme over a pack that lost its dark mode is still dark, from its own ramp, and says so', () => {
  const choice = buildDeckTheme('dark', STARTER);
  assert.ok(choice);
  const lost: ThemeSourceV1 = { colors: STARTER.colors, master: STARTER.master };
  const themed = themedColors(lost, choice.theme);
  assert.equal(themed.mode, 'light', 'the only set there is');
  assert.ok(themed.notes.some((note) => note.code === 'theme.no-dark-mode'));
  const surface = themed.colors['color.semantic.surface'] ?? '';
  assert.notEqual(norm(surface), norm(STARTER.colors['color.semantic.surface'] ?? ''), 'never the light surface');
  assert.equal(norm(surface), norm(themedColors(lost, buildDeckTheme('dark', lost)?.theme).colors['color.semantic.surface'] ?? ''), 'the same Dark a pack with no dark mode is offered');
  assert.ok(contrastRatio(themed.colors['color.semantic.text'] ?? '', surface) >= 4.5);
  assert.equal(themed.master.archetypes.find((one) => one.id === 'content')?.background?.dark, true);
});

test('a stored Dark compiles dark on a system resolved without its dark mode, and every realm draws it the same', async () => {
  const dark = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const plan = { designSystem: { theme: dark } };
  // The starter system as a shell resolves it today: no dark mode handed over.
  const bare = systemForPlan(STARTER_DESIGN_SYSTEM, plan);
  assert.notEqual(norm(bare.compile.tokens('color.semantic.surface') ?? ''), norm(STARTER.colors['color.semantic.surface'] ?? ''), 'a stored Dark is never light');
  // With its dark mode, in this realm and in a structured clone of the first-pass shape.
  const withDark = await resolveRebrandDesignSystem({ ...STARTER_DESIGN_SYSTEM.input, darkColors: STARTER.darkColors ?? {} });
  const here = systemForPlan(withDark, plan);
  const there = systemForPlan(structuredClone(withDark.firstPass), plan);
  assert.deepEqual(there.swatches, here.firstPass.swatches, 'the same swatches in either realm');
  assert.deepEqual(there.slots, here.firstPass.slots);
  assert.deepEqual(there.master, here.firstPass.master);
  assert.equal(norm(here.compile.tokens('color.semantic.surface') ?? ''), norm(STARTER.darkColors?.['color.semantic.surface'] ?? ''));
  const surface = there.swatches.find((one) => one.path === 'color.semantic.surface')?.hex ?? '';
  assert.equal(norm(surface), norm(here.compile.tokens('color.semantic.surface') ?? ''), 'the first pass and the compile agree');
});

test('the look theme is offered on an unlocked design system and absent on a locked one', () => {
  const open = deckThemeChoices(STARTER, { looks: [ORCHARD] });
  const locked = deckThemeChoices(STARTER, { looks: [ORCHARD], locked: true });
  assert.deepEqual(open.map((one) => one.id), ['light', 'dark', 'look']);
  assert.deepEqual(locked.map((one) => one.id), ['light', 'dark']);
  const look = open.find((one) => one.id === 'look');
  assert.equal(look?.name, 'Orchard', 'the result is named by the look, not the design system');
  assert.equal(look?.theme.lookId, ORCHARD.id);
});

test('a look theme with its look missing resolves to the design system and says so', () => {
  const choice = buildDeckTheme('look', STARTER, { look: ORCHARD });
  assert.ok(choice);
  const themed = themedColors(STARTER, choice.theme);
  assert.ok(themed.notes.some((note) => note.code === 'theme.look-missing'));
  assert.equal(themed.colors['color.semantic.surface'], STARTER.colors['color.semantic.surface']);
});

test('a look theme\'s deck ground is read from the look: a dark look puts the deck on dark', () => {
  const night: DeckLookV1 = { id: 'night', name: 'Night', colors: { 'color.semantic.surface': '#000000', 'color.semantic.text': '#ffffff', 'color.semantic.muted': '#bbbbbb' } };
  const look = buildDeckTheme('look', STARTER, { look: night })?.theme;
  assert.ok(look);
  const themed = themedColors(STARTER, look, { look: night });
  assert.equal(deckGround(look), 'light', 'without its colours a look counts as light');
  assert.equal(deckGround(look, { surface: themed.colors['color.semantic.surface'] }), 'dark');
  assert.equal(deckGround(look, { master: themed.master }), 'dark');
  assert.equal(deckGround(buildDeckTheme('look', STARTER, { look: ORCHARD })?.theme, { surface: '#f7f5ef' }), 'light');
});

test('a Brand ground takes the stored theme\'s hue, never a hue the caller holds', (t) => {
  if (!SUSE) return t.skip('the SUSE pack is not in this checkout');
  const brand = deckThemeChoices(SUSE).find((one) => one.id === 'brand')?.theme;
  assert.ok(brand);
  assert.equal(brandGroundPath(brand), 'color.semantic.secondary');
  assert.equal(brandGroundPath(null), 'color.semantic.primary');
  const dark = buildDeckTheme('dark', SUSE)?.theme;
  const layout = SUSE.master.archetypes.find((one) => one.variants?.dark)?.id ?? 'content';
  const placed = slideGroundPlan({ layout, ground: 'brand' }, SUSE.master, dark, { hue: 'color.brand.persimmon' });
  assert.equal(placed.groundPath, 'color.semantic.primary', 'the hue option is read no more');
});

// ─── systemForPlan ───────────────────────────────────────────────────────────

test('systemForPlan returns the system itself with no theme, and themes each shape without moving the token hash', () => {
  const system = STARTER_DESIGN_SYSTEM;
  assert.equal(systemForPlan(system, null), system);
  assert.equal(systemForPlan(system, { designSystem: { theme: { id: 'light', remap: [] } } }), system, 'a Light theme that changes nothing');
  const dark = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const plan = { designSystem: { theme: dark } };
  const themed = systemForPlan(system, plan, { source: STARTER });
  assert.notEqual(themed, system);
  assert.equal(themed.snapshot.tokenHash, system.snapshot.tokenHash);
  assert.deepEqual(themed.snapshot.theme, dark);
  assert.deepEqual(themed.firstPass.snapshot.theme, dark);
  assert.equal(norm(themed.compile.tokens('color.semantic.surface') ?? ''), norm(STARTER.darkColors?.['color.semantic.surface'] ?? ''));
  assert.equal(themed.firstPass.master.archetypes.find((one) => one.id === 'content')?.background?.dark, true);
  // The same theme again returns the shape it already made.
  assert.equal(systemForPlan(themed, plan, { source: STARTER }), themed);
  assert.equal(systemForPlan(themed.firstPass, plan), themed.firstPass);
  // The system it was given did not move.
  assert.equal(system.compile.tokens('color.semantic.surface'), STARTER.colors['color.semantic.surface']);
});

test('the first-pass shape alone is themed from its own swatches', () => {
  const brand = buildDeckTheme('brand', STARTER)?.theme;
  assert.ok(brand);
  const fp = structuredClone({ ...STARTER_DESIGN_SYSTEM.firstPass });
  const themed = systemForPlan(fp, { designSystem: { theme: brand } });
  const surface = themed.swatches.find((one) => one.path === 'color.semantic.surface');
  assert.equal(norm(surface?.hex ?? ''), norm(STARTER.colors['color.semantic.primary'] ?? ''));
});

// ─── the solve and the edits over a real deck ────────────────────────────────

const FIXTURE = path.join(ROOT, 'tests/fixtures/rebrand/palette.pptx');
const RUN = await runRebrandPipeline('palette.pptx', new Uint8Array(readFileSync(FIXTURE)));
const PLAN: RenovationPlanV1 = RUN.plan;
const CTX: ThemeSolveContextV1 = { census: RUN.census, system: STARTER, source: RUN.deck };

test('a look theme is refused on a locked design system by the edit, the compile and the master', () => {
  const look = buildDeckTheme('look', STARTER, { look: ORCHARD })?.theme;
  assert.ok(look);
  const edit = setDeckTheme(PLAN, look, { locked: true });
  assert.equal(edit.plan, PLAN, 'the plan comes back as it was');
  assert.deepEqual(edit.skipped, [{ id: THEME_ROW_ID, reason: 'locked' }]);
  assert.deepEqual(edit.touched, []);
  // A plan themed before the lock, or by another route, still compiles on the design system.
  const plan = { designSystem: { theme: look } };
  assert.equal(systemForPlan(STARTER_DESIGN_SYSTEM, plan, { source: STARTER, look: ORCHARD, locked: true }), STARTER_DESIGN_SYSTEM);
  assert.equal(masterForPlan(STARTER.master, plan, { source: STARTER, look: ORCHARD, locked: true }), STARTER.master);
  const themed = themedColors(STARTER, look, { look: ORCHARD, locked: true });
  assert.deepEqual(themed.notes.map((note) => note.code), ['theme.look-locked']);
  assert.equal(themed.colors['color.semantic.surface'], STARTER.colors['color.semantic.surface']);
  // Unlocked, the same calls apply it.
  assert.notEqual(systemForPlan(STARTER_DESIGN_SYSTEM, plan, { source: STARTER, look: ORCHARD }), STARTER_DESIGN_SYSTEM);
});

test('Light over a plan with no grounds solves exactly as the first pass did', () => {
  const solved = solveThemeColors(PLAN, null, CTX);
  assert.deepEqual(solved.colors, PLAN.colors);
  assert.deepEqual(solved.groups, []);
});

test('a slide set to Dark takes its layout\'s dark variant, and Brand swaps the ground', () => {
  const master = STARTER.master;
  const withVariant = master.archetypes.find((one) => one.variants?.dark);
  assert.ok(withVariant);
  const dark = slideGroundPlan({ layout: withVariant.id, ground: 'dark' }, master, null);
  assert.deepEqual(dark, { archetype: withVariant.variants?.dark, ground: 'dark', moved: true });
  const brand = slideGroundPlan({ layout: withVariant.id, ground: 'brand' }, master, null);
  assert.equal(brand.groundPath, 'color.semantic.primary');
  const same = slideGroundPlan({ layout: withVariant.id, ground: 'light' }, master, null);
  assert.deepEqual(same, { archetype: withVariant.id, ground: 'light', moved: false });
  assert.equal(deckGround(buildDeckTheme('dark', STARTER)?.theme), 'dark');
});

test('per ground group, no text sits under its minimum without an unresolved row', () => {
  const included = PLAN.slides.filter((slide) => slide.include).map((slide) => slide.id);
  const moved = setSlideGround(PLAN, included.slice(0, Math.ceil(included.length / 2)), 'dark');
  const solved = solveThemeColors(moved.plan, null, CTX);
  const groundOf = new Map<string, { group: string; hex: string }>();
  for (const group of solved.groups) {
    for (const [slideId, ground] of Object.entries(group.groundBySlide ?? {})) groundOf.set(slideId, { group: group.ground, hex: ground.hex });
  }
  const slideOf = new Map(RUN.census.objects.map((row) => [row.id, row.slideId]));
  const rows = new Map(solved.colors.map((row) => [row.useId, row]));
  let measured = 0;
  for (const pair of RUN.census.colors.contrastPairs) {
    const slide = slideOf.get(pair.objectId);
    const placed = slide ? groundOf.get(slide) : undefined;
    const fg = rows.get(pair.foreground);
    const bg = rows.get(pair.background);
    if (!placed || !fg || !bg) continue;
    const entry = (row: typeof fg): { to?: string } | undefined => (placed.group === 'deck' ? undefined : row.byGround?.[placed.group as 'dark' | 'brand']);
    const pick = (row: typeof fg): string | undefined => (entry(row) ? entry(row)?.to : row.to);
    const fgHex = pick(fg);
    const bgHex = pick(bg);
    const said = (row: typeof fg): boolean => Boolean(row.unresolved) || solved.issues.some((one) => one.useId === row.useId && one.ground === placed.group);
    if (!fgHex || !bgHex || fg.unresolved || bg.unresolved) {
      assert.ok(said(fg) || said(bg), `${pair.foreground} on ${pair.background} has no target and no reason`);
      continue;
    }
    measured += 1;
    assert.ok(contrastRatio(fgHex, bgHex) >= pair.minimum, `${pair.foreground} on ${pair.background} (${placed.group}) at ${contrastRatio(fgHex, bgHex).toFixed(2)}`);
  }
  assert.ok(measured > 0, 'the fixture has text on a ground to measure');
});

test('themePreview counts the texts a theme would leave under their minimum, without changing the plan', () => {
  const before = structuredClone(PLAN);
  const dark = buildDeckTheme('dark', STARTER)?.theme ?? null;
  const preview = themePreview(PLAN, dark, CTX);
  assert.deepEqual(PLAN, before);
  assert.equal(preview.textsUnder, preview.textUseIds.length);
  for (const id of preview.textUseIds) {
    assert.ok(preview.issues.some((issue) => issue.useId === id && issue.reason === 'contrast-unreachable'));
  }
  assert.deepEqual(preview.theme, dark);
  assert.equal(preview.master.archetypes.find((one) => one.id === 'content')?.background?.dark, true);
  const plain = themePreview(PLAN, null, CTX);
  assert.equal(plain.changed, 0, 'Light over an unthemed plan changes no row');
});

test('setDeckTheme writes the theme as one edit; a Light that changes nothing stores no theme', () => {
  const dark = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const edit = setDeckTheme(PLAN, dark, { solve: CTX });
  assert.deepEqual(edit.plan.designSystem.theme, dark);
  assert.equal(edit.plan.designSystem.tokenHash, PLAN.designSystem.tokenHash);
  assert.ok(edit.touched.includes(THEME_ROW_ID));
  assert.equal(edit.rows.theme, true);
  assert.equal(edit.rows.slideIds?.length, PLAN.slides.length, 'every ground is captured');
  const back = setDeckTheme(edit.plan, { id: 'light', remap: [] });
  assert.equal(back.plan.designSystem.theme, undefined);
  assert.deepEqual(setDeckTheme(PLAN, null).touched, [], 'no theme to no theme touches nothing');
});

test('setSlideGround stores a ground equal to the deck\'s as none, and skips unknown slides', () => {
  const [first] = PLAN.slides;
  assert.ok(first);
  const dark = setSlideGround(PLAN, [first.id, 'no-such-slide'], 'dark');
  assert.equal(dark.plan.slides[0]?.ground, 'dark');
  assert.deepEqual(dark.skipped, [{ id: 'no-such-slide', reason: 'unknown' }]);
  const light = setSlideGround(dark.plan, [first.id], 'light');
  assert.equal(light.plan.slides[0]?.ground, undefined, 'Light on a light deck is the deck\'s own ground');
  assert.equal(setSlideGround(PLAN, [first.id], null).touched.length, 0);
});

// Every text is measured on its slide's themed ground, whether or not its source
// stated one; these decks state none, so before the measuring rows nothing was.
const MEASURED_RUNS = await Promise.all(['simple.pptx', 'formatting.pptx'].map(async (name) => ({
  name,
  run: await runRebrandPipeline(name, new Uint8Array(readFileSync(path.join(ROOT, 'tests/fixtures/rebrand', name)))),
})));

for (const [packName, pack] of [['starter', STARTER], ['SUSE', SUSE]] as const) {
  for (const { name, run } of MEASURED_RUNS) {
    test(`${packName}, ${name}: under every theme each text holds on its slide's themed ground, or its row or an issue says why`, (t) => {
      if (!pack) return t.skip('the SUSE pack is not in this checkout');
      const ctx: ThemeSolveContextV1 = { census: run.census, system: pack, source: run.deck };
      const slideOf = new Map(run.census.objects.map((row) => [row.id, row.slideId]));
      const smallest = new Map<string, number>();
      for (const slide of run.deck.slides) {
        for (const object of slide.objects) {
          for (const para of object.text?.paras ?? []) for (const one of para.runs) if (one.sizePt !== undefined) smallest.set(object.id, Math.min(smallest.get(object.id) ?? one.sizePt, one.sizePt));
        }
      }
      const themes = [...deckThemeChoices(pack).filter((one) => one.id !== 'light').map((one) => one.theme), buildDeckTheme('brand', pack)?.theme].filter((one): one is DeckThemeV1 => Boolean(one));
      let measured = 0;
      for (const theme of themes) {
        const solved = solveThemeColors(run.plan, theme, ctx);
        const preview = themePreview(run.plan, theme, ctx);
        const groundOf = new Map<string, { group: string; hex: string }>();
        for (const group of solved.groups) for (const [slideId, ground] of Object.entries(group.groundBySlide ?? {})) groundOf.set(slideId, { group: group.ground, hex: ground.hex });
        let failing = 0;
        for (const use of run.census.colors.uses.filter((one) => one.role === 'ink')) {
          const row = solved.colors.find((one) => one.useId === use.useId);
          assert.ok(row, `${use.useId} has a row`);
          if (solved.issues.some((one) => one.useId === use.useId && one.reason === 'contrast-unreachable')) failing += 1;
          for (const objectId of use.objectIds) {
            const slide = slideOf.get(objectId);
            const placed = slide ? groundOf.get(slide) : undefined;
            if (!placed) continue;
            const minimum = (smallest.get(objectId) ?? 12) < 18 ? 4.5 : 3;
            const target: string | undefined = placed.group === 'deck' ? row.to : row.byGround?.[placed.group as 'dark' | 'brand']?.to ?? row.to;
            const issue = solved.issues.some((one) => one.useId === use.useId && one.ground === placed.group);
            if (!target || row.unresolved) {
              assert.ok(row.unresolved && issue, `${theme.id}: ${use.useId} has no target and ${row.unresolved ? 'no issue' : 'no reason'}`);
              continue;
            }
            measured += 1;
            const ratio = contrastRatio(target, placed.hex);
            assert.ok(ratio >= minimum || issue, `${theme.id}: ${use.useId} ${target} on ${placed.hex} at ${ratio.toFixed(2)}:1 with no reason`);
          }
        }
        assert.equal(preview.textsUnder, failing, `${theme.id}: the preview counts every text the solve could not hold`);
      }
      assert.ok(measured > 0, 'the deck has text to measure');
    });
  }
}

test('SUSE, formatting.pptx: the red text that fell to 2.42:1 on the Dark ground now holds or is counted', (t) => {
  if (!SUSE) return t.skip('the SUSE pack is not in this checkout');
  const run = MEASURED_RUNS.find((one) => one.name === 'formatting.pptx')?.run;
  assert.ok(run);
  const dark = buildDeckTheme('dark', SUSE)?.theme;
  const ctx: ThemeSolveContextV1 = { census: run.census, system: SUSE, source: run.deck };
  const solved = solveThemeColors(run.plan, dark, ctx);
  const row = solved.colors.find((one) => one.useId === 'ppt/slides/slide2.xml.1:text:c00000');
  assert.ok(row);
  // The census rule: 4.5:1, or 3:1 when the smallest run is 18 pt or more.
  const object = run.deck.slides.flatMap((slide) => slide.objects).find((one) => one.id === 'ppt/slides/slide2.xml.1');
  const sizes = (object?.text?.paras ?? []).flatMap((para) => para.runs.flatMap((one) => (one.sizePt === undefined ? [] : [one.sizePt])));
  const minimum = (sizes.length > 0 ? Math.min(...sizes) : 12) < 18 ? 4.5 : 3;
  const held = row.to !== undefined && !row.unresolved && contrastRatio(row.to, '#0c322c') >= minimum;
  assert.ok(held || themePreview(run.plan, dark, ctx).textUseIds.includes(row.useId), `${row.to} on #0c322c`);
});

test('a slide whose layout has no dark version keeps the deck\'s ground, and the edit says so', () => {
  const master = STARTER.master;
  const bare = master.archetypes.find((one) => !one.variants?.dark && one.background?.dark !== true);
  assert.ok(bare, 'the starter master has a light layout with no dark version');
  const placed = slideGroundPlan({ layout: bare.id, ground: 'dark' }, master, null);
  assert.deepEqual(placed, { archetype: bare.id, ground: 'light', moved: false, noVariant: true });
  const plan: RenovationPlanV1 = { ...PLAN, slides: PLAN.slides.map((slide, at) => (at === 0 ? { ...slide, layout: bare.id } : slide)) };
  const first = plan.slides[0];
  assert.ok(first);
  const edit = setSlideGround(plan, [first.id], 'dark', { master });
  assert.equal(edit.plan.slides[0]?.ground, undefined, 'the slide keeps the deck ground');
  assert.deepEqual(edit.touched, []);
  assert.deepEqual(edit.groundSkipped, [{ id: first.id, reason: 'no-variant' }]);
});

test('undo restores the theme, every ground and every remapped use', () => {
  const included = PLAN.slides.filter((slide) => slide.include).map((slide) => slide.id);
  // Step one: two slides on Brand. Step two: the deck on Dark.
  const one = setSlideGround(PLAN, included.slice(0, 2), 'brand', { solve: CTX });
  const oneSnap = captureThemeRows(PLAN, one.rows);
  const dark: DeckThemeV1 | undefined = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const two = setDeckTheme(one.plan, dark, { solve: CTX });
  const twoSnap = captureThemeRows(one.plan, two.rows);
  assert.ok(two.rows.useIds && two.rows.useIds.length > 0, 'the Dark theme moved some colours');

  const undoTwo = restoreThemeRows(two.plan, twoSnap);
  assert.deepEqual(undoTwo, one.plan, 'undoing the theme puts back the theme and every use it moved');
  const undoOne = restoreThemeRows(undoTwo, oneSnap);
  assert.deepEqual(undoOne, PLAN, 'undoing the grounds puts back every ground and use');
  // Redo is the same edits again.
  assert.deepEqual(setDeckTheme(setSlideGround(PLAN, included.slice(0, 2), 'brand', { solve: CTX }).plan, dark, { solve: CTX }).plan, two.plan);
});

// ─── close-out CP12: the theme through the first pass and the compile ─────────

test('a plan made again over a themed plan keeps its theme and grounds, and solves per ground', () => {
  const dark = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const included = PLAN.slides.filter((slide) => slide.include).map((slide) => slide.id);
  const themed = setSlideGround(setDeckTheme(PLAN, dark, { solve: CTX }).plan, included.slice(0, 1), 'light', { solve: CTX }).plan;
  const again = firstPass({ source: RUN.deck, census: RUN.census, designSystem: STARTER_DESIGN_SYSTEM.firstPass, algorithms: PLAN.algorithms, previous: themed });
  assert.deepEqual(again.designSystem.theme, dark, 'a preset or a new reading keeps the deck on Dark');
  assert.equal(again.designSystem.tokenHash, PLAN.designSystem.tokenHash, 'the theme never moves the token hash');
  assert.equal(again.slides.find((slide) => slide.id === included[0])?.ground, 'light', 'the slide keeps its own ground');
  const expected = solveThemeColors(again, dark, CTX).colors;
  assert.deepEqual(again.colors.map((row) => [row.useId, row.to, row.byGround ?? null]), expected.map((row) => [row.useId, row.to, row.byGround ?? null]), 'the colours are the themed solve\'s');
  // A plan over another pack starts with no theme.
  const other = { ...themed, designSystem: { ...themed.designSystem, tokenHash: `sha256:${'0'.repeat(64)}` } };
  const fresh = firstPass({ source: RUN.deck, census: RUN.census, designSystem: STARTER_DESIGN_SYSTEM.firstPass, algorithms: PLAN.algorithms, previous: other });
  assert.equal(fresh.designSystem.theme, undefined);
});

/** Compile a plan on the starter design system, the way every surface does. */
function compileStarter(plan: RenovationPlanV1) {
  return compileRenovated({
    source: RUN.deck,
    census: RUN.census,
    plan,
    master: STARTER_DESIGN_SYSTEM.input.master,
    designSystem: STARTER_DESIGN_SYSTEM.compile,
    opts: { ...compileSystemOpts(STARTER_DESIGN_SYSTEM.input), applyUnreviewed: true, applyNeedsAttention: true },
  });
}

test('decision 33a: a hero stays dark under Dark, and the logo follows every ground', () => {
  const dark = buildDeckTheme('dark', STARTER)?.theme;
  assert.ok(dark);
  const hero = STARTER.master.archetypes.find((one) => one.background?.dark === true);
  assert.ok(hero, 'the starter master draws a layout dark');
  const first = PLAN.slides.find((slide) => slide.include);
  assert.ok(first);
  const onHero: RenovationPlanV1 = { ...PLAN, slides: PLAN.slides.map((slide) => (slide.id === first.id ? { ...slide, layout: hero.id, layoutSource: 'user' } : slide)) };
  const plain = compileStarter(onHero);
  const themed = compileStarter(setDeckTheme(onHero, dark, { solve: CTX }).plan);
  const frameOf = (deck: ReturnType<typeof compileStarter>) => deck.frames.find((frame) => frame.sourceSlideId === first.id && !frame.continuation);
  const ground = String(frameOf(themed)?.layers[0]?.bg ?? '');
  assert.ok(ground, 'the hero frame states its ground');
  assert.ok(contrastRatio(ground.slice(0, 7), '#ffffff') > contrastRatio(ground.slice(0, 7), '#000000'), `the hero stays dark under Dark (${ground})`);
  // Every frame's logo is the variant for the ground it sits on.
  const logos = (deck: ReturnType<typeof compileStarter>) => deck.frames.flatMap((frame) => frame.layers.filter((row) => String(row.furniture ?? '').startsWith('logo')).map((row) => `${frame.id}:${String(row.image ?? '')}`));
  assert.notDeepEqual(logos(themed), logos(plain), 'the content slides take the mark for a dark ground');
});

test('SUSE: on the Brand colour ground the frame draws the mono mark, and an unthemed deck keeps the colour marks', async (t) => {
  if (!SUSE || !SUSE_SYSTEM) return t.skip('the SUSE pack is not in this checkout');
  // The tile the view offers: SUSE grounds Brand colour on its jungle.
  const brand = deckThemeChoices(SUSE).find((one) => one.id === 'brand')?.theme;
  assert.ok(brand);
  const suse = SUSE_SYSTEM;
  const run = await runRebrandPipeline('simple.pptx', new Uint8Array(readFileSync(path.join(ROOT, 'tests/fixtures/rebrand/simple.pptx'))), { system: suse });
  const ctx: ThemeSolveContextV1 = { census: run.census, system: SUSE, source: run.deck };
  const themed = setDeckTheme(run.plan, brand, { solve: ctx }).plan;
  const compiled = compileRenovated({
    source: run.deck, census: run.census, plan: themed, master: suse.input.master, designSystem: suse.compile,
    opts: { ...compileSystemOpts(suse.input), applyUnreviewed: true, applyNeedsAttention: true },
  });
  const logos = suse.input.logos ?? {};
  const marks = compiled.frames.flatMap((frame) => frame.layers.filter((row) => String(row.furniture ?? '').startsWith('logo')).map((row) => ({ ground: String(frame.layers[0]?.bg ?? '').toLowerCase(), image: String(row.image ?? '') })));
  const jungle = String(themedColors(SUSE, brand).modeColors[brandGroundPath(brand)] ?? '').toLowerCase();
  const onBrand = marks.filter((one) => one.ground === jungle);
  assert.ok(onBrand.length > 0, `some frames sit on the Brand colour ground (${jungle}): ${JSON.stringify(marks)}`);
  const mono = new Set([logos.monoOnLight, logos.monoOnDark].filter(Boolean));
  assert.ok(mono.size > 0, 'the SUSE pack ships mono marks');
  assert.ok(onBrand.every((one) => mono.has(one.image)), `the mono mark on the Brand ground: ${JSON.stringify(onBrand)}`);
  // Unthemed, the same deck draws the colour marks the master and the ground choose.
  const plain = compileRenovated({
    source: run.deck, census: run.census, plan: run.plan, master: suse.input.master, designSystem: suse.compile,
    opts: { ...compileSystemOpts(suse.input), applyUnreviewed: true, applyNeedsAttention: true },
  });
  const plainMarks = plain.frames.flatMap((frame) => frame.layers.filter((row) => String(row.furniture ?? '').startsWith('logo')).map((row) => String(row.image ?? '')));
  assert.ok(plainMarks.every((image) => !mono.has(image)), `an unthemed deck keeps the colour marks: ${plainMarks.join(', ')}`);
});
