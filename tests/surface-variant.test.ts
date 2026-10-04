// SPDX-License-Identifier: MPL-2.0
/**
 * Surface-aware logos and icons (plan 291 W4): `<id>?theme=auto` takes the variant the
 * surface under the layer asks for, through one resolver (engine/src/surface-variant.ts)
 * that the runtime, check, compose and the masters' logo sets share.
 *
 * Public cases run on brands/lolly-start (no logo-surface rule, no icon palette: the
 * fallbacks) and on an invented token document with a rule. The private case at the end
 * reproduces the 44 delivered logo and icon picks of the two SUSE Sleepwalking decks; it
 * needs brands/suse and LOLLY_CHECK_DELIVERED, and is listed in tests/expected-skips.json.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/surface-variant.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  applySurfaceRuleToLogoSet,
  brandRulesOfTokenDocument,
  buildSurfaceVariantTable,
  iconThemeSurfaces,
  pickSurfaceVariant,
  planSurfaceVariants,
  surfaceAutoId,
  surfaceColourResolver,
  surfaceUnderDesignLayer,
  themeSurfaceColours,
} from '../engine/src/surface-variant.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { deriveIconThemesDoc } from '../engine/src/brand-treatments.ts';
import { AUTO_ASSET_THEME, parseIconThemesDoc, parseThemedAssetId } from '../engine/src/icon-theme.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { checkDesignHouseRules } from '../engine/src/design-house-rules.ts';
import { tokenColorVar } from '../engine/src/color-face.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { composeDesignSlides } from '../engine/src/design-compose.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/design-system.ts';

type Row = Record<string, unknown>;
const START = fileURLToPath(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url));
const startDoc = (): unknown => JSON.parse(readFileSync(START, 'utf8'));

const frame = (id: string, bg: unknown, extra: Row = {}): Row => ({ id, kind: 'frame', x: 0, y: 0, w: 1000, h: 500, bg, ...extra });
const logo = (id: string, image: string, extra: Row = {}): Row => ({ id, kind: 'image', frame: 'f', x: 800, y: 420, w: 160, h: 40, image, ...extra });
const plain = (v: unknown): string | null => (typeof v === 'string' ? v : null);

// ── the surface under a layer ────────────────────────────────────────────────

test('the surface is the topmost earlier layer covering 90%, else the artboard fill', () => {
  const read = surfaceColourResolver(null);
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), logo('l', 'x')], 1, {}, read), 'light');
  assert.equal(surfaceUnderDesignLayer([frame('f', '#101820'), logo('l', 'x')], 1, {}, read), 'dark');
  const panel = { id: 'p', kind: 'box', frame: 'f', x: 780, y: 400, w: 200, h: 80, bg: '#101820' };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), panel, logo('l', 'x')], 2, {}, read), 'dark', 'a dark panel under the mark');
  // A panel covering 89% of the mark does not count.
  const short = { ...panel, x: 800, y: 420, w: 160, h: 35.6 };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), short, logo('l', 'x')], 2, {}, read), 'light');
  // A layer painted after the mark, a hidden one, a path and another artboard's are not under the mark.
  const rows = [frame('f', '#ffffff'), { ...panel, hidden: true }, { ...panel, id: 'q', kind: 'path' }, { ...panel, id: 'r', frame: 'g' }, logo('l', 'x'), { ...panel, id: 's' }];
  assert.equal(surfaceUnderDesignLayer(rows, 4, {}, read), 'light');
});

test('a picture is photography, and a translucent scrim over it still is', () => {
  const read = surfaceColourResolver(null);
  const photo = { id: 'ph', kind: 'image', frame: 'f', x: 0, y: 0, w: 1000, h: 500, image: 'user/media/abc', fit: 'cover' };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, logo('l', 'x')], 2, {}, read), 'photo');
  const scrim = { id: 'sc', kind: 'box', frame: 'f', x: 0, y: 0, w: 1000, h: 500, grad: 'lin_90_#ffffffe6_0_#ffffff99_50_#ffffff00_100' };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, scrim, logo('l', 'x')], 3, {}, read), 'photo', 'a scrim over a picture');
  const solid = { ...scrim, grad: 'lin_90_#101820_0_#202830_100' };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, solid, logo('l', 'x')], 3, {}, read), 'dark', 'an opaque gradient hides the picture');
  // A translucent white card over a dark artboard composites to a dark surface. Design's
  // opacity runs 0 to 100, the scale the renderer reads.
  const veil = { id: 'v', kind: 'box', frame: 'f', x: 0, y: 0, w: 1000, h: 500, bg: '#ffffff', opacity: 20 };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#101820'), veil, logo('l', 'x')], 2, {}, read), 'dark');
  // A 40% white veil over a picture is still a photograph.
  const photoVeil = { ...veil, opacity: 40 };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, photoVeil, logo('l', 'x')], 3, {}, read), 'photo', 'a 40% veil over a picture');
  // A black box at 20% on a white artboard paints #cccccc, a light surface.
  const tint = { ...veil, bg: '#000000', opacity: 20 };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), tint, logo('l', 'x')], 2, {}, read), 'light', 'a faint black tint');
  // Opacity 100 is opaque, and an absent opacity is Design's default of 100.
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), { ...tint, opacity: 100 }, logo('l', 'x')], 2, {}, read), 'dark');
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), { ...tint, opacity: undefined }, logo('l', 'x')], 2, {}, read), 'dark');
});

test('a layer\'s own fill or gradient is the topmost surface under its picture', () => {
  const read = surfaceColourResolver(null);
  // A mark on its own dark tile, on a white artboard.
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), logo('l', 'x', { bg: '#000000' })], 1, {}, read), 'dark');
  assert.equal(surfaceUnderDesignLayer([frame('f', '#101820'), logo('l', 'x', { bg: '#ffffff' })], 1, {}, read), 'light');
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), logo('l', 'x', { grad: 'lin_90_#101820_0_#202830_100' })], 1, {}, read), 'dark');
  // A translucent own fill composites over what is under the layer.
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), logo('l', 'x', { bg: '#00000033' })], 1, {}, read), 'light');
  // Over a picture, a translucent own fill is a scrim; an opaque one hides the picture.
  const photo = { id: 'ph', kind: 'image', frame: 'f', x: 0, y: 0, w: 1000, h: 500, image: 'user/media/abc' };
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, logo('l', 'x', { bg: '#ffffff66' })], 2, {}, read), 'photo');
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), photo, logo('l', 'x', { bg: '#101820' })], 2, {}, read), 'dark');
  // The layer's own picture is never its own surface.
  assert.equal(surfaceUnderDesignLayer([frame('f', '#ffffff'), logo('l', 'x')], 1, {}, read), 'light');
});

test('a frameless document sits on the canvas background', () => {
  const read = surfaceColourResolver(null);
  const loose = { id: 'l', kind: 'image', x: 800, y: 420, w: 160, h: 40, image: 'x' };
  assert.equal(surfaceUnderDesignLayer([loose], 0, { background: '#101820' }, read), 'dark');
  assert.equal(surfaceUnderDesignLayer([loose], 0, { background: '#ffffff' }, read), 'light');
  // Without a background nothing answers, as before.
  assert.equal(surfaceUnderDesignLayer([loose], 0, {}, read), null);
  // The canvas fill is read in the active theme, alias or token value alike.
  const doc = startDoc();
  const dark = surfaceColourResolver(createTokenSet(doc, { theme: 'dark' }));
  assert.equal(surfaceUnderDesignLayer([loose], 0, { background: '{color.semantic.surface}' }, dark), 'dark');
  assert.equal(surfaceUnderDesignLayer([loose], 0, { background: { ref: '{color.semantic.surface}', value: '#101820' } }, read), 'dark');
  // A box over the canvas still answers first.
  const panel = { id: 'p', kind: 'box', x: 780, y: 400, w: 200, h: 80, bg: '#ffffff' };
  assert.equal(surfaceUnderDesignLayer([panel, loose], 1, { background: '#101820' }, read), 'light');
  // In frames mode the root canvas is a pasteboard: the background paints nothing there.
  assert.equal(surfaceUnderDesignLayer([frame('g', '#ffffff'), loose], 1, { background: '#101820' }, read), null);
});

test('token references read as the colour they paint in the active theme', () => {
  const doc = startDoc();
  const light = createTokenSet(doc, { theme: 'light' });
  const dark = createTokenSet(doc, { theme: 'dark' });
  // The artboard seed Design writes, `var(--brand-surface, <fallback>)`.
  const seeded = [frame('f', 'var(--brand-surface, #ffffff)'), logo('l', 'x')];
  assert.equal(surfaceUnderDesignLayer(seeded, 1, {}, surfaceColourResolver(light)), 'light');
  assert.equal(surfaceUnderDesignLayer(seeded, 1, {}, surfaceColourResolver(dark)), 'dark');
  // A bare alias, and the colour field's `var(--brand-token-<hex>, <cached>)`.
  const alias = [frame('f', '{color.semantic.surface}'), logo('l', 'x')];
  assert.equal(surfaceUnderDesignLayer(alias, 1, {}, surfaceColourResolver(dark)), 'dark');
  const tokenVar = [frame('f', `var(${tokenColorVar('{color.semantic.surface}')}, #ffffff)`), logo('l', 'x')];
  assert.equal(surfaceUnderDesignLayer(tokenVar, 1, {}, surfaceColourResolver(dark)), 'dark');
  // With no token set the fallback inside the var() answers.
  assert.equal(surfaceUnderDesignLayer(seeded, 1, {}, surfaceColourResolver(null)), 'light');
});

// ── lolly-start: the fallbacks ───────────────────────────────────────────────

test('lolly-start has no logo rule: a mark flips to its reverse treatment on dark and photography', () => {
  const doc = startDoc();
  assert.deepEqual(brandRulesOfTokenDocument(doc).filter((r) => r.kind === 'logo-surface'), []);
  const table = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc) });
  assert.equal(table.logos.rule, null);
  assert.equal(pickSurfaceVariant('lolly/logo/primary?theme=auto', 'dark', table), 'lolly/logo/reverse');
  assert.equal(pickSurfaceVariant('lolly/logo/primary?theme=auto', 'photo', table), 'lolly/logo/reverse');
  assert.equal(pickSurfaceVariant('lolly/logo/primary?theme=auto', 'light', table), 'lolly/logo/primary');
  assert.equal(pickSurfaceVariant('lolly/logo/reverse', 'light', table), 'lolly/logo/primary');
  assert.equal(pickSurfaceVariant('lolly/logo/mono?theme=auto', 'dark', table), 'lolly/logo/mono-reverse', 'a mono mark stays mono');
  assert.equal(pickSurfaceVariant('lolly/logo/mono-reverse', 'light', table), 'lolly/logo/mono');
});

test('icons without declared surfaces are judged by contrast; lolly-start derives no pairing, so its icons keep their base', () => {
  const doc = startDoc();
  const colours = themeSurfaceColours(doc);
  assert.ok(colours.light && colours.dark, 'both lolly-start themes state a surface');
  // The neutral starter palette has no accent to pair, so nothing is derived and an
  // auto icon renders its base: the bridges serve plain bytes for a theme they do not know.
  const derived = deriveIconThemesDoc(doc);
  const start = buildSurfaceVariantTable({ tokens: createTokenSet(doc), iconThemes: derived, surfaceColours: colours });
  assert.equal(start.icons.from, 'none');
  assert.equal(pickSurfaceVariant('acme/icons/star?theme=auto', 'dark', start), null);
  // Two pairings with no `surfaces`: the base colour on light, the accent on dark, 3:1 each.
  const surfaces = { light: '#fafafa', dark: '#14141e' };
  const themes = { themes: [{ id: 'deep', c1: '#2050a0', c2: '#14141e' }, { id: 'pale', c1: '#a0f0d0', c2: '#e0fff0' }] };
  assert.deepEqual(iconThemeSurfaces(themes.themes[0]!, surfaces), { surfaces: ['light'], from: 'contrast' });
  assert.deepEqual(iconThemeSurfaces(themes.themes[1]!, surfaces), { surfaces: ['dark'], from: 'contrast' });
  const table = buildSurfaceVariantTable({ tokens: null, iconThemes: themes, surfaceColours: surfaces });
  assert.equal(table.icons.from, 'contrast');
  assert.equal(pickSurfaceVariant('acme/icons/star?theme=auto', 'light', table), 'acme/icons/star?theme=deep');
  assert.equal(pickSurfaceVariant('acme/icons/star?theme=auto', 'dark', table), 'acme/icons/star?theme=pale');
  assert.equal(pickSurfaceVariant('acme/icons/star?theme=auto', 'photo', table), 'acme/icons/star?theme=pale', 'a photograph counts as dark for an icon');
});

// ── a declared rule ──────────────────────────────────────────────────────────

/** An invented brand: two orientations, four treatments, and a rule that prefers the white mark on dark. */
function acmeDoc(rule = true): Row {
  const logo = (v: string): Row => ({ $type: 'asset', $value: v });
  return {
    asset: { logo: {
      'horizontal-primary': logo('acme/logo/h-pos'), 'horizontal-primary-reverse': logo('acme/logo/h-neg-colour'),
      'horizontal-mono': logo('acme/logo/h-black'), 'horizontal-mono-reverse': logo('acme/logo/h-white'),
      'vertical-primary': logo('acme/logo/v-pos'), 'vertical-primary-reverse': logo('acme/logo/v-neg-colour'),
      'vertical-mono': logo('acme/logo/v-black'), 'vertical-mono-reverse': logo('acme/logo/v-white'),
    } },
    color: { $type: 'color', paper: { $value: '#fafafa' }, night: { $value: '#14141e' } },
    ...(rule ? { $extensions: { 'com.suse.lolly': { brandSystem: { rules: [{
      id: 'logo-surface', kind: 'logo-surface', label: 'Marks by surface', roleIds: [], requirement: 'advisory', scope: { tools: ['design'] },
      parameters: {
        light: ['acme/logo/h-pos', 'acme/logo/v-pos', 'acme/logo/h-black', 'acme/logo/v-black'],
        dark: ['acme/logo/h-white', 'acme/logo/v-white', 'acme/logo/h-neg-colour', 'acme/logo/v-neg-colour'],
        photo: ['acme/logo/h-white', 'acme/logo/v-white'],
      },
    }] } } } } : {}),
  };
}

test('the logo rule order wins over the treatment flip, keeping orientation and a mono preference', () => {
  const doc = acmeDoc();
  const table = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc) });
  assert.equal(table.logos.rule?.ruleId, 'logo-surface');
  assert.equal(pickSurfaceVariant('acme/logo/h-pos?theme=auto', 'dark', table), 'acme/logo/h-white', 'the rule, not the flip to h-neg-colour');
  assert.equal(pickSurfaceVariant('acme/logo/v-pos?theme=auto', 'dark', table), 'acme/logo/v-white', 'same orientation');
  assert.equal(pickSurfaceVariant('acme/logo/h-white?theme=auto', 'light', table), 'acme/logo/h-black', 'a mono mark asks for a mono mark');
  assert.equal(pickSurfaceVariant('acme/logo/h-neg-colour', 'photo', table), 'acme/logo/h-white');
  // Without the rule, the same table falls back to the flip.
  const flat = buildSurfaceVariantTable({ tokens: createTokenSet(acmeDoc(false)) });
  assert.equal(pickSurfaceVariant('acme/logo/h-pos?theme=auto', 'dark', flat), 'acme/logo/h-neg-colour');
  // A master that keeps one mark everywhere turns the pick off.
  const fixed = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc), master: { logo: { variantByBackground: false } } as never });
  assert.equal(pickSurfaceVariant('acme/logo/h-pos?theme=auto', 'dark', fixed), 'acme/logo/h-pos');
});

test('a master logo set is restated in the rule order, so compose and New slide match the runtime', () => {
  const doc = acmeDoc();
  const table = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc) });
  const fromTags = { onLight: 'acme/logo/h-pos', onDark: 'acme/logo/h-neg-colour', monoOnLight: 'acme/logo/h-black', monoOnDark: 'acme/logo/h-white' };
  assert.deepEqual(applySurfaceRuleToLogoSet(fromTags, table), { onLight: 'acme/logo/h-pos', onDark: 'acme/logo/h-white', monoOnLight: 'acme/logo/h-black', monoOnDark: 'acme/logo/h-white' });
  // No rule: the set is the master's.
  const flat = buildSurfaceVariantTable({ tokens: createTokenSet(acmeDoc(false)) });
  assert.deepEqual(applySurfaceRuleToLogoSet(fromTags, flat), fromTags);
  // A side the master has no mono mark for stays without one.
  assert.deepEqual(applySurfaceRuleToLogoSet({ onLight: 'acme/logo/h-pos' }, table), { onLight: 'acme/logo/h-pos', onDark: 'acme/logo/h-white' });
});

test('auto is reserved: no palette may declare it, and an auto form is built only on catalog ids', () => {
  assert.equal(AUTO_ASSET_THEME, 'auto');
  const parsed = parseIconThemesDoc({ themes: [{ id: 'auto', c1: '#111111', c2: '#222222' }, { id: 'ink', c1: '#111111', c2: '#222222', surfaces: ['light'] }] });
  assert.deepEqual(parsed.map((t) => t.id), ['ink']);
  assert.deepEqual(parsed[0]!.surfaces, ['light']);
  assert.equal(surfaceAutoId('acme/logo/h-pos'), 'acme/logo/h-pos?theme=auto');
  assert.equal(surfaceAutoId('acme/icons/a?theme=ink'), 'acme/icons/a?theme=ink');
  assert.equal(surfaceAutoId('https://lolly.tools/tool/qr-code.svg'), 'https://lolly.tools/tool/qr-code.svg');
  assert.deepEqual(parseThemedAssetId('acme/logo/h-pos?theme=auto'), { baseId: 'acme/logo/h-pos', theme: 'auto' });
});

test('check knows auto: no unknown reference, and the logo rule judges the mark the surface takes', () => {
  const doc = acmeDoc();
  const rows = [frame('f', '{color.night}'), logo('auto', 'acme/logo/h-pos?theme=auto'), logo('fixed', 'acme/logo/h-pos')];
  const brand = checkBrandDesign(rows, doc, { iconThemes: ['ink'] });
  assert.equal(brand.findings.some((f) => f.layerId === 'auto' && f.kind === 'reference'), false);
  const house = checkDesignHouseRules(rows, brandRulesOfTokenDocument(doc), doc);
  assert.deepEqual(house.findings.map((f) => f.layerId), ['fixed'], 'only the fixed positive mark on dark is reported');
});

test('the logo rule reads Design opacity and a frameless canvas the way the renderer paints them', () => {
  const doc = acmeDoc();
  const rules = brandRulesOfTokenDocument(doc);
  // The white mark on a photograph under a 40% white veil sits on a photograph.
  const photo = { id: 'ph', kind: 'image', frame: 'f', x: 0, y: 0, w: 1000, h: 500, image: 'user/media/abc' };
  const veil = { id: 'v', kind: 'box', frame: 'f', x: 0, y: 0, w: 1000, h: 500, bg: '#ffffff', opacity: 40 };
  const veiled = checkDesignHouseRules([frame('f', '#ffffff'), photo, veil, logo('mark', 'acme/logo/h-white')], rules, doc);
  assert.deepEqual(veiled.findings.map((f) => f.layerId), []);
  // A frameless document: the positive mark on a dark canvas is reported, on a light one it is not.
  const loose = { id: 'mark', kind: 'image', x: 800, y: 420, w: 160, h: 40, image: 'acme/logo/h-pos' };
  assert.deepEqual(checkDesignHouseRules([loose], rules, doc, { background: '{color.night}' }).findings.map((f) => f.layerId), ['mark']);
  assert.deepEqual(checkDesignHouseRules([loose], rules, doc, { background: '{color.paper}' }).findings.map((f) => f.layerId), []);
});

test('planSurfaceVariants lists every auto image with its surface and pick, and leaves other images alone', () => {
  const doc = acmeDoc();
  const set = createTokenSet(doc);
  const table = buildSurfaceVariantTable({ tokens: set, rules: brandRulesOfTokenDocument(doc), iconThemes: { themes: [{ id: 'ink', c1: '#2050a0', c2: '#14141e', surfaces: ['light'] }, { id: 'glow', c1: '#a0f0d0', c2: '#40c090', surfaces: ['dark'] }] } });
  const rows = [
    frame('f', '{color.night}'),
    logo('a', 'acme/logo/h-pos?theme=auto'),
    logo('b', 'acme/icons/star?theme=auto', { x: 10, y: 10, w: 40, h: 40 }),
    logo('c', 'acme/icons/star?theme=ink', { x: 60, y: 10, w: 40, h: 40 }),
  ];
  const picks = planSurfaceVariants(rows, {}, table, surfaceColourResolver(set));
  assert.deepEqual(picks.map((p) => [p.index, p.surface, p.id]), [[1, 'dark', 'acme/logo/h-white'], [2, 'dark', 'acme/icons/star?theme=glow']]);
});

test('lolly-start: compose for two themes writes the master logo as an auto mark, and one theme keeps it concrete', async () => {
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(resolved);
  const { master, colors, logos } = resolved.input as unknown as { master: never; colors: Record<string, string>; logos: Record<string, string> };
  const spec = { slides: [{ archetype: 'title', slots: { title: 'Harbour lights' } }, { archetype: 'content', slots: { title: 'Tides', body: 'Low at six.' } }] };
  const ctx = { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos };
  const marks = (doc: { boxes: Row[] }): string[] => doc.boxes.filter((r) => typeof r.furniture === 'string' && String(r.furniture).startsWith('logo')).map((r) => String(r.image));
  const one = marks(composeDesignSlides(spec as never, ctx).document);
  const two = marks(composeDesignSlides({ ...spec, themes: ['light', 'dark'] } as never, ctx).document);
  assert.ok(one.length >= 1, 'the neutral master places a logo');
  assert.ok(one.every((id) => !id.includes('?')));
  // An auto mark is written under the light side of the pair it picked; the runtime
  // re-picks it from the surface (the reverse mark on dark).
  const lightSide = (id: string): string => (id === logos.onDark ? logos.onLight! : id === logos.monoOnDark ? logos.monoOnLight! : id);
  assert.deepEqual(two, one.map((id) => `${lightSide(id)}?theme=auto`));
  assert.throws(() => composeDesignSlides({ ...spec, themes: ['light', 'light'] } as never, ctx), /\/themes\/1: theme "light" is listed twice/);
});

test('a brand whose preferred dark mark is its white mono mark: a mark seeded on dark takes the rule\'s first light mark on light', async () => {
  // E18 restates the master's tags in the rule order, so the dark colour slot holds the
  // white mono mark. Seeded on a dark slide and moved to light (or shown in light), it
  // must give the brand's first light mark, not the black mono mark.
  const doc = acmeDoc();
  const table = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc) });
  const logos = applySurfaceRuleToLogoSet({ onLight: 'acme/logo/h-pos', onDark: 'acme/logo/h-neg-colour', monoOnLight: 'acme/logo/h-black', monoOnDark: 'acme/logo/h-white' }, table);
  assert.equal(logos.onDark, 'acme/logo/h-white');
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(resolved);
  const { master, colors } = resolved.input as unknown as { master: never; colors: Record<string, string> };
  const spec = { themes: ['light', 'dark'], slides: [{ archetype: 'title-only', slots: {} }, { archetype: 'title-only-dark', slots: {} }] };
  const composed = composeDesignSlides(spec as never, { master, masterOrigin: 'catalog' as const, resolveToken: (p: string) => colors[p], logos });
  const marks = composed.document.boxes.filter((r: Row) => typeof r.furniture === 'string' && String(r.furniture).startsWith('logo')).map((r: Row) => String(r.image));
  assert.ok(marks.length >= 2, 'both slides place a logo');
  for (const id of marks) {
    assert.equal(pickSurfaceVariant(id, 'light', table), 'acme/logo/h-pos', `${id} on light`);
    assert.equal(pickSurfaceVariant(id, 'dark', table), 'acme/logo/h-white', `${id} on dark`);
  }
});

// ── the runtime ──────────────────────────────────────────────────────────────

let toolSeq = 0;
function designDouble(extraInputs: Row[] = []): any {
  return {
    manifest: {
      id: `surface-double-${++toolSeq}`, name: 'Surface double', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [...extraInputs, {
        id: 'boxes', type: 'blocks', default: [],
        fields: [
          { id: 'id', type: 'text' }, { id: 'kind', type: 'text' }, { id: 'frame', type: 'text' },
          { id: 'x', type: 'number' }, { id: 'y', type: 'number' }, { id: 'w', type: 'number' }, { id: 'h', type: 'number' },
          { id: 'bg', type: 'color' }, { id: 'image', type: 'asset' }, { id: 'tokenLinks', type: 'text' },
        ],
        canvas: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', frameField: 'frame', fillField: 'bg', imageField: 'image', frameKind: 'frame' },
        tokenBindingsField: 'tokenLinks',
      }],
    },
    template: '{{#each boxes}}<i>{{this.image.url}}</i>{{/each}}',
    hooksSource: null,
  };
}

function startHost(doc: unknown): any {
  const gets: string[] = [];
  return {
    gets,
    host: {
      version: '1',
      shell: 'test',
      profile: { get: async () => ({}) },
      assets: {
        get: async (id: string) => { gets.push(id); return { id, url: `asset:${id}`, meta: {} }; },
        query: async () => [],
      },
      tokens: {
        get: async (opts = {}) => createTokenSet(doc, opts),
        colors: async (opts = {}) => createTokenSet(doc, opts).colors(),
        resolve: async (ref: string, opts = {}) => createTokenSet(doc, opts).resolve(ref),
        snapshot: async () => ({ document: doc, system: null, version: null, selection: { choices: {} } }),
      },
      log: () => {},
    },
  };
}

const imageOf = (rt: any, id: string): any => (rt.getModel().find((i: any) => i.id === 'boxes').value as Row[]).find((r) => r.id === id)!.image;

test('the runtime resolves an auto mark to its pick, keeps the authored id, and re-picks per theme and per edit', async () => {
  const doc = startDoc();
  const { host, gets } = startHost(doc);
  const boxes = [
    frame('f', 'var(--brand-surface, #ffffff)'),
    { id: 'panel', kind: 'box', frame: 'f', x: 0, y: 0, w: 300, h: 500, bg: '#101820' },
    logo('mark', 'lolly/logo/primary?theme=auto'),
  ];
  const rt = await createRuntime(designDouble(), host, { boxes: boxes as never });
  let ref = imageOf(rt, 'mark');
  assert.equal(ref.id, 'lolly/logo/primary?theme=auto', 'the authored id stays the reference');
  assert.equal(ref.url, 'asset:lolly/logo/primary');
  assert.deepEqual(ref.meta.surfaceVariant, { id: 'lolly/logo/primary', surface: 'light' });

  // Another theme: the artboard is dark there, so the reverse mark.
  await rt.setTokenSelection({ '': 'dark' });
  ref = imageOf(rt, 'mark');
  assert.equal(ref.id, 'lolly/logo/primary?theme=auto');
  assert.deepEqual(ref.meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  assert.equal(ref.url, 'asset:lolly/logo/reverse');

  // Back to light, then move the mark onto the dark panel: one edit, one re-pick.
  await rt.setTokenSelection({});
  assert.equal(imageOf(rt, 'mark').meta.surfaceVariant.id, 'lolly/logo/primary');
  const moved = (rt.getModel().find((i: any) => i.id === 'boxes')!.value as unknown as Row[]).map((r) => (r.id === 'mark' ? { ...r, x: 40, y: 40 } : r));
  gets.length = 0;
  await rt.setInput('boxes', moved as never);
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  assert.deepEqual(gets, ['lolly/logo/reverse'], 'only the changed mark is resolved again');
  assert.equal(imageOf(rt, 'mark').id, 'lolly/logo/primary?theme=auto');

  // An edit that changes nothing under the mark resolves nothing.
  gets.length = 0;
  const renamed = (rt.getModel().find((i: any) => i.id === 'boxes')!.value as unknown as Row[]).map((r) => (r.id === 'panel' ? { ...r, name: 'Panel' } : r));
  await rt.setInput('boxes', renamed as never);
  assert.deepEqual(gets, []);
  rt.destroy?.();
});

test('the runtime leaves documents without auto marks alone and keeps the base when nothing answers', async () => {
  const doc = startDoc();
  const { host, gets } = startHost(doc);
  const rt = await createRuntime(designDouble(), host, { boxes: [frame('f', '#ffffff'), logo('plain', 'lolly/logo/primary'), logo('odd', 'acme/unknown/thing?theme=auto')] as never });
  assert.equal(imageOf(rt, 'plain').id, 'lolly/logo/primary');
  assert.equal(imageOf(rt, 'plain').meta.surfaceVariant, undefined);
  // An id the table does not know is treated as an icon, and lolly-start pairs none: the
  // authored id itself is resolved, and the ref records no pick.
  const odd = imageOf(rt, 'odd');
  assert.equal(odd.id, 'acme/unknown/thing?theme=auto');
  assert.equal(odd.meta.surfaceVariant, undefined);
  assert.ok(gets.includes('acme/unknown/thing?theme=auto'));
  rt.destroy?.();
});

test('the runtime reads a mark\'s own tile as its surface', async () => {
  const { host } = startHost(startDoc());
  const rt = await createRuntime(designDouble(), host, { boxes: [frame('f', '#ffffff'), logo('mark', 'lolly/logo/primary?theme=auto', { bg: '#000000' })] as never });
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  assert.equal(imageOf(rt, 'mark').url, 'asset:lolly/logo/reverse');
  rt.destroy?.();
});

test('the runtime reads a frameless document\'s canvas background, per theme and per edit', async () => {
  const { host } = startHost(startDoc());
  const background = { id: 'background', type: 'color', default: '{color.semantic.surface}' };
  const loose = { id: 'mark', kind: 'image', x: 800, y: 420, w: 160, h: 40, image: 'lolly/logo/primary?theme=auto' };
  const rt = await createRuntime(designDouble([background]), host, { boxes: [loose] as never });
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/primary', surface: 'light' });
  await rt.setTokenSelection({ '': 'dark' });
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  // A new canvas fill re-picks the mark.
  await rt.setInput('background', '#ffffff' as never);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/primary', surface: 'light' });
  rt.destroy?.();
});

test('a theme switch made while no auto mark is present does not leave the old theme\'s surface context behind', async () => {
  const { host } = startHost(startDoc());
  const seeded = [frame('f', '{color.semantic.surface}'), logo('mark', 'lolly/logo/primary?theme=auto')];
  const rt = await createRuntime(designDouble(), host, { boxes: seeded as never });
  assert.equal(imageOf(rt, 'mark').meta.surfaceVariant.id, 'lolly/logo/primary');
  const rowsNow = (): Row[] => rt.getModel().find((i: any) => i.id === 'boxes')!.value as unknown as Row[];
  // Delete the mark, switch to dark, then put the mark back (an undo).
  await rt.setInput('boxes', rowsNow().filter((r) => r.id !== 'mark') as never);
  await rt.setTokenSelection({ '': 'dark' });
  await rt.setInput('boxes', [...rowsNow(), seeded[1]] as never);
  await new Promise((r) => setTimeout(r, 20));
  assert.deepEqual(imageOf(rt, 'mark').meta.surfaceVariant, { id: 'lolly/logo/reverse', surface: 'dark' });
  rt.destroy?.();
});

// ── private: the delivered Sleepwalking picks ───────────────────────────────

const SUSE_TOKENS = fileURLToPath(new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url));
const SUSE_ICONS = fileURLToPath(new URL('../brands/suse/catalog/assets/suse/palette/icon-themes.json', import.meta.url));
const DELIVERED = process.env.LOLLY_CHECK_DELIVERED;
const SKIP_SUSE = existsSync(SUSE_TOKENS) && DELIVERED && existsSync(`${DELIVERED}/light.lolly.boxes.json`) ? false
  : 'the delivered Sleepwalking design fixture is not on this machine (set LOLLY_CHECK_DELIVERED)';

test('SUSE: one auto reference per logo and icon layer reproduces the 44 delivered picks of both decks', { skip: SKIP_SUSE }, () => {
  const doc = JSON.parse(readFileSync(SUSE_TOKENS, 'utf8'));
  const iconThemes = JSON.parse(readFileSync(SUSE_ICONS, 'utf8'));
  let delivered = 0;
  let reproduced = 0;
  const misses: string[] = [];
  for (const theme of ['light', 'dark']) {
    const rows: Row[] = JSON.parse(readFileSync(`${DELIVERED}/${theme}.lolly.boxes.json`, 'utf8'));
    const set = createTokenSet(doc, { theme });
    const table = buildSurfaceVariantTable({ tokens: set, rules: brandRulesOfTokenDocument(doc), iconThemes, surfaceColours: themeSurfaceColours(doc) });
    // Write the document once: every logo as the rule's first light mark, every icon as
    // its base, all auto. An icon the author fixed to a theme the surfaces never pick stays fixed.
    const rule = table.logos.rule!;
    const logos = new Set([...rule.light, ...rule.dark, ...rule.photo, ...Object.keys(table.logos.members)]);
    const surfaceThemes = new Set([table.icons.light, table.icons.dark, table.icons.photo]);
    const fixed = new Set<number>();
    const authored = rows.map((row, index) => {
      const id = plain(row.image) ?? (typeof row.image === 'object' ? plain((row.image as Row | null)?.id) : null);
      if (!id?.includes('/') || id.startsWith('photo:') || id.startsWith('user/')) return row;
      delivered++;
      const { baseId, theme: t } = parseThemedAssetId(id);
      if (t && !surfaceThemes.has(t)) { fixed.add(index); return row; }
      return { ...row, image: surfaceAutoId(logos.has(baseId) ? rule.light[0]! : baseId) };
    });
    reproduced += fixed.size;
    for (const pick of planSurfaceVariants(authored, {}, table, surfaceColourResolver(set))) {
      const want = plain(rows[pick.index]!.image) ?? plain((rows[pick.index]!.image as Row).id);
      if (pick.id === want) reproduced++;
      else misses.push(`${theme} ${String(rows[pick.index]!.id)} on ${pick.surface}: delivered ${want}, picked ${pick.id}`);
    }
  }
  assert.deepEqual(misses, []);
  assert.equal(delivered, 44, 'the two decks carry 44 logo and icon layers');
  assert.equal(reproduced, 44);
});
