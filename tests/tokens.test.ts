/**
 * Engine design-tokens model — DTCG parse, alias resolution, theme/set layering,
 * colour normalisation, and the reference+cached input-value resolver.
 *
 * Pure engine: no DOM, no bridge. These pin the format contract the catalog
 * `tokens` asset, the `host.tokens` bridge, and the picker all rely on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, TOKEN_EXT,
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
  // The input document belongs to the caller — its stop objects must NOT be rewritten.
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
  // The same array shape under a non-gradient $type keeps its alias strings —
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
  assert.equal(colorToHex('rebeccapurple'), 'rebeccapurple');  // unknown named colour — untouched
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
  // inline style attributes (swatches, brand vars) — anything that isn't a
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
