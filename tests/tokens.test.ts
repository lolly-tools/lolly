// SPDX-License-Identifier: MPL-2.0
/**
 * Engine design-tokens model - DTCG parse, alias resolution, theme/set layering,
 * colour normalisation, and the reference+cached input-value resolver.
 *
 * Pure engine: no DOM, no bridge. These pin the format contract the catalog
 * `tokens` asset, the `host.tokens` bridge, and the picker all rely on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, typographyFamilies, TOKEN_EXT,
} from '../engine/src/tokens.ts';

const BRAND = {
  color: {
    $type: 'color',
    brand: {
      jungle: {
        $value: '#30ba78',
        $description: 'Jungle',
        $extensions: { [TOKEN_EXT]: { cmyk: [70, 0, 65, 0] } },
      },
      pine: { $value: '#0c322c', $description: 'Pine' },
    },
    // Alias: semantic → brand primitive (DTCG curly-brace reference).
    semantic: {
      primary: { $value: '{color.brand.jungle}' },
      accent: { $value: '{color.semantic.primary}' }, // chained alias
    },
  },
  space: {
    sm: { $value: '8px', $type: 'dimension' },
  },
};

test('flattens groups, inherits $type, keeps dotted paths', () => {
  const ts = createTokenSet(BRAND);
  assert.equal(ts.get('color.brand.jungle')!.type, 'color'); // inherited from group $type
  assert.equal(ts.get('color.brand.jungle')!.value, '#30ba78');
  assert.equal(ts.get('space.sm')!.type, 'dimension');       // explicit on the token
  assert.ok(ts.has('color.semantic.primary'));
});

test('resolves aliases, including chains', () => {
  const ts = createTokenSet(BRAND);
  assert.equal(ts.resolve('{color.semantic.primary}'), '#30ba78');
  assert.equal(ts.resolve('color.semantic.accent'), '#30ba78'); // chained → same primitive
  assert.equal(ts.resolve('{color.brand.pine}'), '#0c322c');
  assert.equal(ts.resolve('{color.missing}'), undefined);
});

test('does not hang on a reference cycle', () => {
  const ts = createTokenSet({
    a: { $type: 'color', x: { $value: '{a.y}' }, y: { $value: '{a.x}' } },
  });
  // Either side resolves to a string without throwing/looping.
  assert.doesNotThrow(() => ts.resolve('{a.x}'));
});

// ── Composite alias resolution: gradient stops ────────────────────────────────

test('resolves aliases nested in gradient stops ($value[].color); the raw doc stays untouched', () => {
  const doc = {
    color: { $type: 'color', brand: { jungle: { $value: '#30ba78' }, pine: { $value: '{color.brand.jungle}' } } },
    gradient: {
      $type: 'gradient',
      hero: {
        $value: [
          { color: '{color.brand.jungle}', position: 0 },
          { color: '{color.brand.pine}', position: 0.5 },  // through a chained alias
          { color: '#ffffff', position: 1 },
          { color: '{color.missing}', position: 0.25 },    // unresolvable — stays as authored
        ],
      },
    },
  };
  const ts = createTokenSet(doc);
  const v = ts.get('gradient.hero')!.value as Array<{ color: unknown; position: number }>;
  assert.equal(v[0]!.color, '#30ba78');
  assert.equal(v[1]!.color, '#30ba78');
  assert.equal(v[2]!.color, '#ffffff');
  assert.equal(v[3]!.color, '{color.missing}');
  // The input document belongs to the caller - its stop objects must NOT be rewritten.
  assert.equal(doc.gradient.hero.$value[0]!.color, '{color.brand.jungle}');
  // resolve() on the gradient path hands back the same resolved stops.
  const r = ts.resolve('{gradient.hero}') as Array<{ color: unknown }>;
  assert.equal(r[0]!.color, '#30ba78');
});

test('gradient stop alias resolution is cycle-safe', () => {
  const doc = {
    color: { $type: 'color', a: { $value: '{color.b}' }, b: { $value: '{color.a}' } },
    gradient: {
      $type: 'gradient',
      loop: { $value: [{ color: '{color.a}', position: 0 }, { color: '#000000', position: 1 }] },
    },
  };
  const ts = createTokenSet(doc);
  const v = ts.get('gradient.loop')!.value as Array<{ color: unknown }>;
  assert.equal(v[0]!.color, '{color.a}', 'a cycled target stays as authored');
  assert.equal(v[1]!.color, '#000000');
});

test('composite resolution is scoped to gradient-typed tokens', () => {
  // The same array shape under a non-gradient $type keeps its alias strings - 
  // only $type gradient (own or inherited) opts a token into stop resolution.
  const doc = {
    color: { $type: 'color', a: { $value: '#112233' } },
    other: { thing: { $value: [{ color: '{color.a}', position: 0 }] } },
  };
  const ts = createTokenSet(doc);
  const v = ts.get('other.thing')!.value as Array<{ color: unknown }>;
  assert.equal(v[0]!.color, '{color.a}');
});

test('query by type and colour swatches', () => {
  const ts = createTokenSet(BRAND);
  assert.equal(ts.query({ type: 'dimension' }).length, 1);

  const swatches = ts.colors();
  const jungle = swatches.find(s => s.path === 'color.brand.jungle')!;
  assert.equal(jungle.ref, '{color.brand.jungle}'); // canonical reference for input values
  assert.equal(jungle.value, '#30ba78');
  assert.equal(jungle.name, 'Jungle');               // from $description
  assert.equal(jungle.group, 'Brand');               // parent group, prettified
  assert.deepEqual((jungle as { cmyk?: unknown }).cmyk, [70, 0, 65, 0]); // CMYK rides in $extensions
  // Aliased semantic colours are colours too (type flows through the alias).
  assert.ok(swatches.find(s => s.path === 'color.semantic.primary'));
});

test('themes select and order sets, later sets override earlier', () => {
  const doc = {
    base: { color: { bg: { $value: '#ffffff', $type: 'color' } } },
    dark: { color: { bg: { $value: '#000000', $type: 'color' } } },
    $metadata: { tokenSetOrder: ['base', 'dark'] },
    $themes: [
      { name: 'Light', selectedTokenSets: { base: 'enabled' } },
      { name: 'Dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    ],
  };
  assert.equal(createTokenSet(doc, { theme: 'Light' }).resolve('color.bg'), '#ffffff');
  assert.equal(createTokenSet(doc, { theme: 'Dark' }).resolve('color.bg'), '#000000'); // dark wins
  assert.equal(createTokenSet(doc).themes().length, 2);
});

test('colorToHex normalises every form Penpot can emit', () => {
  assert.equal(colorToHex('#FFF'), '#ffffff');                 // shorthand → full, lowercased
  assert.equal(colorToHex('#30BA78'), '#30ba78');
  assert.equal(colorToHex('rgb(48, 186, 120)'), '#30ba78');
  assert.equal(colorToHex('rgba(0, 0, 0, 0.5)'), '#00000080'); // alpha → 8-digit hex
  assert.equal(colorToHex('hsl(150, 59%, 46%)'), '#30bb75');   // ~jungle (hsl is lossy)
  assert.equal(colorToHex('transparent'), 'transparent');
  assert.equal(colorToHex({ colorSpace: 'srgb', components: [0, 0, 0], alpha: 1 }), '#000000');
  assert.equal(colorToHex({ hex: '#30ba78' }), '#30ba78');     // DTCG object with hex
  assert.equal(colorToHex('rebeccapurple'), 'rebeccapurple');  // unknown named colour - untouched
});

test('colorToHex parses oklch()/lch() via the brand-derive math', () => {
  assert.equal(colorToHex('oklch(100% 0 0)'), '#ffffff');
  assert.equal(colorToHex('oklch(0% 0 0)'), '#000000');
  assert.equal(colorToHex('lch(100% 0 0)'), '#ffffff'); // CIELAB form converts via Lab
  // sRGB red's OKLCH coordinates land back on red (small rounding slack).
  const red = colorToHex('oklch(62.796% 0.25768 29.234)')!;
  assert.match(red, /^#[0-9a-f]{6}$/);
  assert.ok(
    Math.abs(parseInt(red.slice(1, 3), 16) - 0xff) <= 1 &&
    parseInt(red.slice(3, 5), 16) <= 1 && parseInt(red.slice(5, 7), 16) <= 1,
    `≈ #ff0000, got ${red}`,
  );
  assert.match(colorToHex('oklch(62% 0.11 250 / 0.5)')!, /^#[0-9a-f]{8}$/); // alpha → 8-digit hex
  // Out-of-sRGB chroma gamut-maps to a real hex instead of clipping.
  assert.match(colorToHex('oklch(62% 0.35 145)')!, /^#[0-9a-f]{6}$/);
});

test('colorToHex rejects CSS-injection payloads (token values reach style attributes)', () => {
  // Token documents are untrusted user imports and colorToHex's output lands in
  // inline style attributes (swatches, brand vars) - anything that isn't a
  // plain colour must come back null, never verbatim.
  for (const hostile of [
    'javascript:',
    'url(//x)',
    'red;background:url(//x)',
    'expression(alert(1))',
    '#fff;background:url(//x)', // hex-prefixed smuggle — normHex must reject it
    '#zzzzzz',                  // non-hex digits behind a '#'
  ]) {
    assert.equal(colorToHex(hostile), null, hostile);
  }
  // Plain colour idents still pass through untouched.
  assert.equal(colorToHex('red'), 'red');
  assert.equal(colorToHex('transparent'), 'transparent');
  assert.equal(colorToHex('rebeccapurple'), 'rebeccapurple');
});

test('createTokenSet: oklch() $values resolve and swatch to hex', () => {
  const ts = createTokenSet({
    color: {
      $type: 'color',
      brand: { $value: 'oklch(62% 0.11 250)' },
      semantic: { primary: { $value: '{color.brand}' } }, // alias onto an oklch token
    },
  });
  assert.equal(ts.resolve('{color.brand}'), 'oklch(62% 0.11 250)'); // raw value survives
  const brand = ts.colors().find(s => s.path === 'color.brand')!;
  assert.match(brand.value, /^#[0-9a-f]{6}$/); // swatch is picker-ready hex
  const primary = ts.colors().find(s => s.path === 'color.semantic.primary')!;
  assert.equal(primary.value, brand.value); // alias resolves to the same colour
  assert.equal(resolveColorValue(ts, '{color.brand}'), brand.value); // hydration path too
});

test('resolveColorValue: ref + cached value model', () => {
  const ts = createTokenSet(BRAND);

  // A live token reference resolves to the token's current value.
  assert.equal(
    resolveColorValue(ts, { ref: '{color.brand.jungle}', value: '#000000' }),
    '#30ba78',
  );
  // Missing token → fall back to the cached value carried alongside the ref.
  assert.equal(
    resolveColorValue(ts, { ref: '{color.gone}', value: '#abcdef' }),
    '#abcdef',
  );
  // A bare alias string resolves; unresolvable → undefined (URLs re-resolve at the destination).
  assert.equal(resolveColorValue(ts, '{color.brand.pine}'), '#0c322c');
  assert.equal(resolveColorValue(ts, '{color.gone}'), undefined);
  // A plain colour string is returned untouched (existing tools unaffected).
  assert.equal(resolveColorValue(ts, '#123456'), '#123456');
  assert.equal(resolveColorValue(ts, 'transparent'), 'transparent');
});

test('alias + token-value helpers', () => {
  assert.ok(isAlias('{a.b}'));
  assert.equal(isAlias('#fff'), false);
  assert.equal(aliasPath('{color.brand.jungle}'), 'color.brand.jungle');
  assert.ok(isTokenValue({ ref: '{x}', value: '#fff' }));
  assert.equal(isTokenValue('#fff'), false);
});

test('an empty / invalid document yields an empty set, not a throw', () => {
  assert.equal(createTokenSet(null).size, 0);
  assert.equal(createTokenSet(undefined).colors().length, 0);
  assert.equal(createTokenSet('garbage').size, 0);
});

// ── multi-axis Tokens-Studio theme composition ────────────────────────────────
// A doc with two independent axes (group "mode" + group "brand"): a token in a brand-axis
// set aliases one in a mode-axis set. Composing a single theme entry (the old behaviour)
// would leave that cross-axis alias dangling; composing one theme per axis resolves it.
const MULTIAXIS = {
  $metadata: { tokenSetOrder: ['core', 'mode-light', 'mode-dark', 'brand-a', 'brand-b'] },
  $themes: [
    { name: 'Light', group: 'mode', selectedTokenSets: { core: 'source', 'mode-light': 'enabled' } },
    { name: 'Dark',  group: 'mode', selectedTokenSets: { core: 'source', 'mode-dark': 'enabled' } },
    { name: 'BrandA', group: 'brand', selectedTokenSets: { 'brand-a': 'enabled' } },
    { name: 'BrandB', group: 'brand', selectedTokenSets: { 'brand-b': 'enabled' } },
  ],
  core: { base: { $type: 'color', $value: '#111111' } },
  'mode-light': { surface: { $type: 'color', $value: '#ffffff' } },
  'mode-dark':  { surface: { $type: 'color', $value: '#000000' } },
  // brand-axis token aliases a mode-axis token (cross-axis) + a core (source) token
  'brand-a': { accent: { $type: 'color', $value: '{surface}' }, ink: { $type: 'color', $value: '{base}' } },
  'brand-b': { accent: { $type: 'color', $value: '{surface}' } },
};

test('multi-axis: cross-axis alias resolves by composing one theme per group', () => {
  const ts = createTokenSet(MULTIAXIS);   // no theme → Light (first mode) + BrandA (first brand)
  assert.equal(ts.get('accent')!.value, '#ffffff', 'brand-a.accent → mode-light.surface (cross-axis)');
  assert.equal(ts.get('ink')!.value, '#111111', 'brand-a.ink → core.base (source set)');
});

test('multi-axis: an explicit theme wins its axis, defaults fill the others', () => {
  const dark = createTokenSet(MULTIAXIS, { theme: 'Dark' });   // Dark (mode) + BrandA (default brand)
  assert.equal(dark.get('accent')!.value, '#000000', 'accent now → mode-dark.surface');
});

test('multi-axis: $metadata.activeThemes selects the per-axis combination', () => {
  const doc = { ...MULTIAXIS, $metadata: { ...MULTIAXIS.$metadata, activeThemes: ['Dark', 'BrandB'] } };
  const ts = createTokenSet(doc);
  assert.equal(ts.get('accent')!.value, '#000000', 'Dark surface');
  assert.ok(ts.has('accent'));  // brand-b set active
});

test('single-axis doc is unchanged: no theme → first theme, named theme honoured', () => {
  const doc = {
    $metadata: { tokenSetOrder: ['light', 'dark'] },
    $themes: [
      { name: 'Light', selectedTokenSets: { light: 'enabled' } },
      { name: 'Dark',  selectedTokenSets: { dark: 'enabled' } },
    ],
    light: { bg: { $type: 'color', $value: '#ffffff' } },
    dark:  { bg: { $type: 'color', $value: '#000000' } },
  };
  assert.equal(createTokenSet(doc).get('bg')!.value, '#ffffff', 'no theme → first (Light)');
  assert.equal(createTokenSet(doc, { theme: 'Dark' }).get('bg')!.value, '#000000', 'named → Dark');
});

// ─── Per-space faces (Phase 9: the authored sRGB face wins at export) ─────────

/**
 * The single change that makes an override real rather than decorative.
 *
 * `ColorSwatch.value` is what every consumer of a brand colour reads - the CMYK
 * palette map, the picker's swatches, the raster and vector export paths. So an
 * authored sRGB face has to be substituted HERE, and that is the whole of Phase 9
 * for the sRGB target. If this test is deleted, an override silently becomes a
 * note the exports ignore, which looks like it works right up to the print.
 */
test('an authored sRGB face wins over the automatic bake', () => {
  const ts = createTokenSet({
    color: {
      // A wide-gamut brand green. Its automatic sRGB bake is whatever §14.2's map
      // reaches; the brand has authored a different one.
      wide: {
        $type: 'color',
        $value: 'oklch(70% 0.25 145)',
        $extensions: { [TOKEN_EXT]: { faces: { srgb: { value: '#00b050' } } } },
      },
      // The same colour with NO override - the control, so the test proves a
      // substitution rather than just reading a hex back.
      plain: { $type: 'color', $value: 'oklch(70% 0.25 145)' },
    },
  });
  const wide = ts.colors().find(s => s.path === 'color.wide')!;
  const plain = ts.colors().find(s => s.path === 'color.plain')!;
  assert.equal(wide.value, '#00b050', 'the authored bake is what a consumer gets');
  assert.notEqual(plain.value, '#00b050', 'and it is a substitution, not the automatic answer');
  assert.match(plain.value, /^#[0-9a-f]{6}$/i, 'the automatic bake is still a hex');
});

test('a face is re-serialised to a hex, and a broken one cannot blank a colour', () => {
  const ts = createTokenSet({
    color: {
      // Authored in OKLCH - `value` is contractually a hex, so it must convert.
      typed: {
        $type: 'color', $value: '#123456',
        $extensions: { [TOKEN_EXT]: { faces: { srgb: { value: 'oklch(62% 0.2 145)' } } } },
      },
      // A malformed override must be IGNORED, never emitted: a brand colour that
      // renders as nothing is far worse than one that ignores a typo.
      broken: {
        $type: 'color', $value: '#123456',
        $extensions: { [TOKEN_EXT]: { faces: { srgb: { value: 'not a colour' } } } },
      },
    },
  });
  const typed = ts.colors().find(s => s.path === 'color.typed')!;
  assert.match(typed.value, /^#[0-9a-f]{6}$/i, `converted to hex: ${typed.value}`);
  assert.notEqual(typed.value.toLowerCase(), '#123456', 'and it is the face, not the $value');
  assert.equal(ts.colors().find(s => s.path === 'color.broken')!.value.toLowerCase(), '#123456',
    'a malformed face falls back to the automatic bake');
});

test('faces ride alongside, and only when there are any', () => {
  const ts = createTokenSet({
    color: {
      press: {
        $type: 'color', $value: '#123456',
        $extensions: {
          [TOKEN_EXT]: {
            faces: {
              srgb: { value: '#00b050' },
              'icc:ab12cd:relative': { value: [0, 90, 100, 0] },
            },
          },
        },
      },
      bare: { $type: 'color', $value: '#123456' },
    },
  });
  const press = ts.colors().find(s => s.path === 'color.press')!;
  // A wider/press face is carried UNTOUCHED - baking it into `value` would discard
  // exactly what it was authored to hold.
  assert.deepEqual(press.faces?.['icc:ab12cd:relative'], [0, 90, 100, 0]);
  assert.equal(press.faces?.srgb, '#00b050');
  // Absent, not empty, on a token with no overrides: `faces: {}` on every swatch
  // would be noise in every serialised payload.
  assert.equal(ts.colors().find(s => s.path === 'color.bare')!.faces, undefined);
});

test('the existing cmyk/spot locks are untouched by faces', () => {
  // They are a shipped contract that brand packs in the wild already carry, so a
  // face must coexist with them rather than migrate them on read.
  const ts = createTokenSet({
    color: {
      both: {
        $type: 'color', $value: '#123456',
        $extensions: {
          [TOKEN_EXT]: {
            cmyk: [70, 0, 65, 0],
            spot: { name: 'PANTONE 186 C' },
            faces: { srgb: { value: '#00b050' } },
          },
        },
      },
    },
  });
  const s = ts.colors()[0]!;
  assert.deepEqual(s.cmyk, [70, 0, 65, 0]);
  assert.equal(s.spot?.name, 'PANTONE 186 C');
  assert.equal(s.value, '#00b050');
  // Strictly additive: a spot with no finish is byte-identical to what it always
  // was. No `finish` key appears, so a JSON.stringify of this swatch (which is
  // exactly what services/mcp/src/resources.ts ships) is unchanged.
  assert.equal(s.spot?.finish, undefined);
  assert.deepEqual(Object.keys(s.spot!), ['name']);
});

// ── SpotColor.finish - a finish ink is a PLATE, not a colour ────────────────
// The offered set is brand data, so the union is open and the reader must never
// gate on membership. See FinishKind in packages/core/src/host-v1.ts.

const spotDoc = (spot: unknown) => ({
  color: { ink: { $type: 'color', $value: '#123456', $extensions: { [TOKEN_EXT]: { spot } } } },
});

test('a spot carrying a finish round-trips to ColorSwatch.spot.finish', () => {
  const s = createTokenSet(spotDoc({ name: 'Gold', book: 'Foilco', finish: 'foil' })).colors()[0]!;
  // `book` and `finish` coexist - a foil still has a stock it is ordered from.
  assert.deepEqual(s.spot, { name: 'Gold', book: 'Foilco', finish: 'foil' });
});

test('a finish outside FinishKind still surfaces — the union is open', () => {
  // A brand's house process must not need an engine release, so the reader
  // validates the SHAPE (a string) and never the membership.
  const s = createTokenSet(spotDoc({ name: 'House Press', finish: 'letterpress' })).colors()[0]!;
  assert.equal(s.spot?.finish, 'letterpress');
});

test('a malformed finish degrades to no finish, keeping the ink', () => {
  // Total-function tolerance: `name` is the field a /Separation plate is named
  // for, so a hand-edited doc with a nonsense finish must not cost us the ink.
  for (const bad of [42, null, { kind: 'foil' }, ['foil'], true]) {
    const s = createTokenSet(spotDoc({ name: 'Gold', book: 'Foilco', finish: bad })).colors()[0]!;
    assert.deepEqual(s.spot, { name: 'Gold', book: 'Foilco' }, `finish: ${JSON.stringify(bad)}`);
  }
  // …and a spot that was never valid is still null, finish or no finish.
  assert.equal(createTokenSet(spotDoc({ finish: 'foil' })).colors()[0]!.spot, null);
});

// ── Single-axis activeThemes + typography families ──────────────────────────
// Penpot writes $metadata.activeThemes as the designer's own ON state. Before
// this, a single-group multi-theme doc always resolved themes[0] and quietly
// ignored it.

const TWO_THEMES = {
  Light: { color: { bg: { $value: '#ffffff', $type: 'color' } } },
  Dark: { color: { bg: { $value: '#000000', $type: 'color' } } },
  $themes: [
    { id: 't1', name: 'Light', selectedTokenSets: { Light: 'enabled' } },
    { id: 't2', name: 'Dark', selectedTokenSets: { Dark: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['Light', 'Dark'] },
};

test('single-axis: $metadata.activeThemes picks the theme instead of the first', () => {
  const doc = { ...TWO_THEMES, $metadata: { ...TWO_THEMES.$metadata, activeThemes: ['Dark'] } };
  assert.equal(createTokenSet(doc).resolve('color.bg'), '#000000');
});

test('single-axis: an explicit theme still beats activeThemes', () => {
  const doc = { ...TWO_THEMES, $metadata: { ...TWO_THEMES.$metadata, activeThemes: ['Dark'] } };
  assert.equal(createTokenSet(doc, { theme: 'Light' }).resolve('color.bg'), '#ffffff');
});

test('single-axis: an empty or unmatched activeThemes keeps the first theme', () => {
  assert.equal(createTokenSet(TWO_THEMES).resolve('color.bg'), '#ffffff');
  for (const activeThemes of [[], ['Nope'], 'Dark', [42]]) {
    const doc = { ...TWO_THEMES, $metadata: { ...TWO_THEMES.$metadata, activeThemes } };
    assert.equal(createTokenSet(doc).resolve('color.bg'), '#ffffff', `activeThemes ${JSON.stringify(activeThemes)}`);
  }
});

test('single-axis: activeThemes may name a grouped theme as "group/name"', () => {
  const doc = {
    ...TWO_THEMES,
    $themes: TWO_THEMES.$themes.map(t => ({ ...t, group: 'Mode' })),
    $metadata: { ...TWO_THEMES.$metadata, activeThemes: ['Mode/Dark'] },
  };
  assert.equal(createTokenSet(doc).resolve('color.bg'), '#000000');
});

test('typographyFamilies: plural, singular, array, stack and string forms', () => {
  // Penpot's encoder writes the plural keys and stores split families as arrays.
  assert.deepEqual(typographyFamilies({ fontFamilies: ['Work Sans', 'Arial'], fontSizes: '16px' }), ['Work Sans', 'Arial']);
  assert.deepEqual(typographyFamilies({ fontFamily: 'Work Sans' }), ['Work Sans']);
  assert.deepEqual(typographyFamilies({ fontFamilies: "'Work Sans', sans-serif" }), ['Work Sans', 'sans-serif']);
  assert.deepEqual(typographyFamilies('Spline Sans Mono'), ['Spline Sans Mono']);
  assert.deepEqual(typographyFamilies(['Work Sans', 'Work Sans']), ['Work Sans'], 'deduped');
  // Aliases and unreadable values name nothing rather than guessing.
  assert.deepEqual(typographyFamilies('{type.body}'), []);
  assert.deepEqual(typographyFamilies({ fontSizes: '16px' }), []);
  assert.deepEqual(typographyFamilies(null), []);
  assert.deepEqual(typographyFamilies(42), []);
});
