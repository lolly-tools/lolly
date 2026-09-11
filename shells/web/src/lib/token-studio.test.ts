// SPDX-License-Identifier: MPL-2.0
/**
 * token-studio.ts - the pure DTCG surgery behind the Start studio's Tokens tab.
 *
 * Run with: node --test "shells/web/src/**\/*.test.ts"
 *
 * Exercised against the REAL shipped starter brand (brands/lolly-start) for the
 * layered-doc cases - a change to the token contract's set layout (base/light/
 * dark) fails here rather than silently writing tokens into the wrong set - 
 * plus small synthetic docs for the flat/imported shapes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TOKEN_EXT } from '@lolly/engine';
import { leafAt } from './brand-doc.ts';
import {
  listStudioTokens, addStudioToken, setStudioTokenValue, renameStudioToken,
  deleteStudioToken, defaultValueFor, gradientCss, resolveStopHex, formatStudioValue,
  gradientAliasRefCount, materializeGradientAliases,
} from './token-studio.ts';
import type { StudioKind, StudioToken, GradientStop } from './token-studio.ts';

const BRAND = fileURLToPath(
  new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url),
);
/** A fresh deep clone per test - every helper mutates in place. */
const load = (): Record<string, unknown> => JSON.parse(readFileSync(BRAND, 'utf8'));

const KINDS: StudioKind[] = ['spacing', 'sizing', 'stroke', 'opacity', 'rotation', 'number', 'shadow', 'gradient'];
const GROUP_OF: Record<StudioKind, string> = {
  spacing: 'space', sizing: 'size', stroke: 'stroke', opacity: 'opacity',
  rotation: 'rotation', number: 'number', shadow: 'shadow', gradient: 'gradient',
};

/** A bare StudioToken for the display-formatter tests. */
const tok = (kind: StudioKind, raw: unknown, angle?: number): StudioToken =>
  ({ path: [], key: '', kind, name: '', raw, ...(angle !== undefined ? { angle } : {}) });

test('the starter brand ships no studio tokens (it is a colour-only doc)', () => {
  assert.deepEqual(listStudioTokens(load()), []);
});

test('addStudioToken writes into `base` on the layered starter brand', () => {
  const doc = load();
  const p = addStudioToken(doc, 'spacing', 'Gutter', '16px');
  assert.deepEqual(p, ['base', 'space', 'gutter']);

  const leaf = leafAt(doc, p!)!;
  assert.equal(leaf.$value, '16px');
  assert.equal(leaf.$type, 'dimension');
  assert.equal(leaf.$description, 'Gutter');
  // The group itself carries the $type so future leaves inherit it.
  assert.equal(leafAt(doc, ['base', 'space'])!.$type, 'dimension');
});

test('add + list round-trip: key, kind, name, raw and path all line up', () => {
  const doc = load();
  const p = addStudioToken(doc, 'spacing', 'Gutter', '16px')!;
  const list = listStudioTokens(doc);
  assert.equal(list.length, 1);
  const t = list[0]!;
  assert.deepEqual(t.path, p);
  assert.equal(t.key, 'space.gutter'); // set prefix stripped
  assert.equal(t.kind, 'spacing');
  assert.equal(t.name, 'Gutter');
  assert.equal(t.raw, '16px');
});

test('every kind lands in its own group home, seeded from defaultValueFor', () => {
  const doc = load();
  for (const kind of KINDS) {
    const p = addStudioToken(doc, kind, `My ${kind}`, defaultValueFor(kind));
    assert.ok(p, `${kind} default must be addable`);
    assert.equal(p![0], 'base');
    assert.equal(p![1], GROUP_OF[kind]);
  }
  const list = listStudioTokens(doc);
  assert.equal(list.length, KINDS.length);
  for (const kind of KINDS) assert.ok(list.some(t => t.kind === kind), `${kind} must list back`);
});

test('a flat (imported, single-set) doc gets its groups at the top level', () => {
  const doc: Record<string, unknown> = {};
  assert.deepEqual(addStudioToken(doc, 'stroke', 'Hairline', '1px'), ['stroke', 'hairline']);
  const t = listStudioTokens(doc)[0]!;
  assert.deepEqual(t.path, ['stroke', 'hairline']);
  assert.equal(t.key, 'stroke.hairline');
});

test('slugs collide-safely, and an unusable name falls back to the kind', () => {
  const doc = load();
  assert.deepEqual(addStudioToken(doc, 'spacing', 'Gutter', '16px'), ['base', 'space', 'gutter']);
  assert.deepEqual(addStudioToken(doc, 'spacing', 'Gutter', '24px'), ['base', 'space', 'gutter-2']);
  assert.deepEqual(addStudioToken(doc, 'spacing', 'Gutter', '32px'), ['base', 'space', 'gutter-3']);
  // All-symbol name → slug falls back to the kind, but the typed label is kept.
  const p = addStudioToken(doc, 'number', '  ~!~  ', 5)!;
  assert.deepEqual(p, ['base', 'number', 'number']);
  assert.equal(leafAt(doc, p)!.$description, '~!~');
  // A blank name falls back to the prettified slug for both.
  const p2 = addStudioToken(doc, 'number', '   ', 5)!;
  assert.deepEqual(p2, ['base', 'number', 'number-2']);
  assert.equal(leafAt(doc, p2)!.$description, 'Number 2');
});

test('an unusable value refuses the add without half-making a group', () => {
  const doc = load();
  assert.equal(addStudioToken(doc, 'spacing', 'Gutter', 'chunky'), null);
  assert.equal(addStudioToken(doc, 'shadow', 'Glow', { color: 'not a colour!' }), null);
  assert.equal(addStudioToken(doc, 'gradient', 'Fade', []), null);
  assert.equal('space' in (doc.base as Record<string, unknown>), false, 'no empty group left behind');
  assert.deepEqual(listStudioTokens(doc), []);
});

test('listStudioTokens ignores color.*, font.*, asset.* and shape.radius', () => {
  const doc: Record<string, unknown> = {
    color: { $type: 'color', brand: { blue: { $value: '#0055ff' } } },
    font: { brand: { $value: 'Inter', $type: 'fontFamily' } },
    asset: { logo: { primary: { $value: 'user/logo/horizontal-primary' } } },
    // Even with the dimension $type, shape.radius stays setBrandRadius's.
    shape: { radius: { $value: '8px', $type: 'dimension' } },
    space: { sm: { $value: '4px', $type: 'dimension' } },
  };
  const list = listStudioTokens(doc);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.key, 'space.sm');
});

test('a mislabeled leaf squatting in a studio group is ignored ($type disagrees)', () => {
  const doc: Record<string, unknown> = {
    space: {
      odd: { $value: '#ffffff', $type: 'color' },
      ok: { $value: '8px' }, // no $type at all → group segment decides
    },
    // A group-level $type inherits down to untyped leaves.
    opacity: { $type: 'number', dim: { $value: 0.5 } },
  };
  const keys = listStudioTokens(doc).map(t => t.key);
  assert.deepEqual(keys, ['space.ok', 'opacity.dim']);
});

test('tokens in a theme set still list, with the set prefix stripped from the key', () => {
  const doc: Record<string, unknown> = {
    light: { opacity: { dim: { $value: 0.5, $type: 'number' } } },
  };
  const t = listStudioTokens(doc)[0]!;
  assert.deepEqual(t.path, ['light', 'opacity', 'dim']);
  assert.equal(t.key, 'opacity.dim');
  assert.equal(t.kind, 'opacity');
});

test('setStudioTokenValue: dimensions validate, bare numbers become px', () => {
  const doc = load();
  const p = addStudioToken(doc, 'spacing', 'Gutter', '16px')!;
  assert.equal(setStudioTokenValue(doc, p, '1.5rem'), true);
  assert.equal(leafAt(doc, p)!.$value, '1.5rem');
  assert.equal(setStudioTokenValue(doc, p, 24), true);
  assert.equal(leafAt(doc, p)!.$value, '24px');
  assert.equal(setStudioTokenValue(doc, p, 'chunky'), false, 'not a length');
  assert.equal(leafAt(doc, p)!.$value, '24px', 'refused write leaves the doc untouched');
  assert.equal(setStudioTokenValue(doc, ['base', 'space', 'nope'], '8px'), false, 'miss, not a throw');
});

test('setStudioTokenValue: opacity clamps to 0–1 and reads percent strings', () => {
  const doc = load();
  const p = addStudioToken(doc, 'opacity', 'Dim', 0.5)!;
  setStudioTokenValue(doc, p, 1.4);
  assert.equal(leafAt(doc, p)!.$value, 1);
  setStudioTokenValue(doc, p, -0.2);
  assert.equal(leafAt(doc, p)!.$value, 0);
  setStudioTokenValue(doc, p, '85%');
  assert.equal(leafAt(doc, p)!.$value, 0.85);
  assert.equal(setStudioTokenValue(doc, p, 'abc'), false);
});

test('setStudioTokenValue: rotation wraps to -360..360 keeping its sign', () => {
  const doc = load();
  const p = addStudioToken(doc, 'rotation', 'Tilt', 0)!;
  setStudioTokenValue(doc, p, 450);
  assert.equal(leafAt(doc, p)!.$value, 90);
  setStudioTokenValue(doc, p, -450);
  assert.equal(leafAt(doc, p)!.$value, -90, 'negative stays negative - never clamped positive');
  setStudioTokenValue(doc, p, 360);
  assert.equal(leafAt(doc, p)!.$value, 360, 'a full turn passes through');
  setStudioTokenValue(doc, p, -720);
  assert.ok(Object.is(leafAt(doc, p)!.$value, 0), 'wraps to 0, never -0');
  setStudioTokenValue(doc, p, '45deg');
  assert.equal(leafAt(doc, p)!.$value, 45, 'deg suffix accepted');
});

test('setStudioTokenValue: plain numbers accept numeric strings, refuse the rest', () => {
  const doc = load();
  const p = addStudioToken(doc, 'number', 'Scale', 1)!;
  assert.equal(setStudioTokenValue(doc, p, '2.5'), true);
  assert.equal(leafAt(doc, p)!.$value, 2.5);
  assert.equal(setStudioTokenValue(doc, p, NaN), false);
  assert.equal(setStudioTokenValue(doc, p, ''), false);
});

test('setStudioTokenValue: shadow is a full replacement in the DTCG shape', () => {
  const doc = load();
  const p = addStudioToken(doc, 'shadow', 'Card', defaultValueFor('shadow'))!;
  // Dimensions normalise (numbers → px) and default to 0px when omitted.
  assert.equal(setStudioTokenValue(doc, p, { color: 'oklch(60% 0.1 250)', offsetX: 4, offsetY: '4px', blur: '12px' }), true);
  assert.deepEqual(leafAt(doc, p)!.$value, {
    color: 'oklch(60% 0.1 250)', offsetX: '4px', offsetY: '4px', blur: '12px', spread: '0px',
  });
  assert.equal(setStudioTokenValue(doc, p, { color: 'not a colour!' }), false, 'unreadable colour refused');
  assert.equal(setStudioTokenValue(doc, p, '2px 2px'), false, 'not the DTCG object shape');
});

test('gradient: bad-colour stops drop, positions clamp + sort, angle rides the vendor extension', () => {
  const doc = load();
  const p = addStudioToken(doc, 'gradient', 'Fade', defaultValueFor('gradient'))!;
  assert.equal(listStudioTokens(doc)[0]!.angle, 135, 'default seeds an angle');

  // Bare stop-array form: stops replaced, stored angle untouched.
  assert.equal(setStudioTokenValue(doc, p, [
    { color: '#ff0000', position: 1.5 },        // clamps to 1
    { color: 'not a colour!', position: 0.2 },  // dropped
    { color: '#0000ff', position: 0.5 },
  ]), true);
  assert.deepEqual(leafAt(doc, p)!.$value, [
    { color: '#0000ff', position: 0.5 },
    { color: '#ff0000', position: 1 },
  ]);
  const ext = leafAt(doc, p)!.$extensions as Record<string, { angle?: number }>;
  assert.equal(ext[TOKEN_EXT]!.angle, 135, 'bare-array write left the angle alone');

  // Object form with a numeric angle updates it.
  const stops: GradientStop[] = [{ color: '#111111', position: 0 }, { color: '#eeeeee', position: 1 }];
  assert.equal(setStudioTokenValue(doc, p, { stops, angle: 90 }), true);
  assert.equal((leafAt(doc, p)!.$extensions as Record<string, { angle?: number }>)[TOKEN_EXT]!.angle, 90);
  assert.equal(listStudioTokens(doc)[0]!.angle, 90, 'the walker surfaces it on the token');

  // Every stop unreadable → the write is refused wholesale.
  assert.equal(setStudioTokenValue(doc, p, [{ color: 'nope!', position: 0 }]), false);
  assert.deepEqual(leafAt(doc, p)!.$value, stops);
});

test('renameStudioToken writes $description; clearing falls back to the slug', () => {
  const doc = load();
  const p = addStudioToken(doc, 'spacing', 'Gutter', '16px')!;
  assert.equal(renameStudioToken(doc, p, '  Page gutter  '), true);
  assert.equal(leafAt(doc, p)!.$description, 'Page gutter');
  assert.equal(listStudioTokens(doc)[0]!.name, 'Page gutter');

  renameStudioToken(doc, p, '   ');
  assert.equal('$description' in leafAt(doc, p)!, false);
  assert.equal(listStudioTokens(doc)[0]!.name, 'Gutter', 'prettified leaf key');
  assert.equal(renameStudioToken(doc, ['base', 'space', 'nope'], 'x'), false);
});

test('deleteStudioToken prunes the emptied base.<group> but never base itself', () => {
  const doc = load();
  const p1 = addStudioToken(doc, 'spacing', 'Gutter', '16px')!;
  const p2 = addStudioToken(doc, 'spacing', 'Inset', '8px')!;

  assert.equal(deleteStudioToken(doc, p1), true);
  assert.ok(leafAt(doc, ['base', 'space']), 'group survives while a sibling remains');
  assert.equal(deleteStudioToken(doc, p2), true);
  assert.equal(leafAt(doc, ['base', 'space']), null, 'emptied group (its $type only) pruned');
  assert.ok(leafAt(doc, ['base', 'color']), 'unrelated groups untouched');
  assert.ok('base' in doc, 'the set itself survives');

  assert.equal(deleteStudioToken(doc, p2), false, 'deleting twice is a miss, not a throw');
});

test('deleteStudioToken prunes nested empty groups all the way up on a flat doc', () => {
  const doc: Record<string, unknown> = {
    space: { layout: { gutter: { $value: '8px', $type: 'dimension' } } },
  };
  assert.equal(deleteStudioToken(doc, ['space', 'layout', 'gutter']), true);
  assert.deepEqual(doc, {}, 'layout, then space, pruned; the root survives');
});

test('defaultValueFor seeds the documented neutrals', () => {
  assert.equal(defaultValueFor('spacing'), '16px');
  assert.equal(defaultValueFor('sizing'), '48px');
  assert.equal(defaultValueFor('stroke'), '2px');
  assert.equal(defaultValueFor('opacity'), 0.8);
  assert.equal(defaultValueFor('rotation'), 0);
  assert.equal(defaultValueFor('number'), 1);
  assert.deepEqual(defaultValueFor('shadow'),
    { color: '#00000040', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' });
  const g = defaultValueFor('gradient') as { stops: GradientStop[]; angle: number };
  assert.equal(g.stops.length, 2);
  assert.equal(g.angle, 135);
});

test('gradientCss renders sorted hex stops with the CSS-default 180deg', () => {
  const css = gradientCss([
    { color: '#0000FF', position: 1 },
    { color: '#ff0000', position: 0 },
  ]);
  assert.equal(css, 'linear-gradient(180deg, #ff0000 0%, #0000ff 100%)');
});

test('gradientCss: explicit angle wins over an embedded one, which wins over 180', () => {
  const stops = [{ color: '#ff0000', position: 0 }, { color: '#0000ff', position: 1 }];
  assert.match(gradientCss(stops, 90), /^linear-gradient\(90deg, /);
  assert.match(gradientCss({ stops, angle: 45 }), /^linear-gradient\(45deg, /);
  assert.match(gradientCss({ stops, angle: 45 }, 270), /^linear-gradient\(270deg, /);
});

test('gradientCss is injection-safe: colours go through colorToHex, bad stops drop', () => {
  // oklch() converts to a plain hex; a CSS-injection string is not a colour.
  const css = gradientCss([
    { color: 'oklch(60% 0.1 250)', position: 0 },
    { color: 'red;background:url(//evil)', position: 0.5 },
    { color: '#00ff00', position: 2 }, // clamps to 100%
  ]);
  assert.match(css, /^linear-gradient\(180deg, #[0-9a-f]{6} 0%, #00ff00 100%\)$/);
  assert.ok(!css.includes('evil'));
});

test('gradientCss: a single surviving stop renders flat; none at all → empty string', () => {
  const css = gradientCss([{ color: '#123456', position: 0.25 }, { color: 'nope!', position: 1 }]);
  assert.equal(css, 'linear-gradient(180deg, #123456 25%, #123456 100%)');
  assert.equal(gradientCss([{ color: 'nope!', position: 0 }]), '');
  assert.equal(gradientCss([]), '');
  assert.equal(gradientCss('linear-gradient(red, blue)'), '', 'not a stop array');
  assert.equal(gradientCss(undefined), '');
});

// ── Alias stops (gradients that wear palette swatches) ───────────────────────

test('gradient stops accept {alias} colours; an angle-only edit round-trips them unchanged', () => {
  const doc = load();
  const p = addStudioToken(doc, 'gradient', 'Hero', {
    stops: [{ color: '{color.ramp.primary.1}', position: 0 }, { color: '#ffffff', position: 1 }],
    angle: 135,
  })!;
  assert.deepEqual(leafAt(doc, p)!.$value, [
    { color: '{color.ramp.primary.1}', position: 0 },
    { color: '#ffffff', position: 1 },
  ]);
  // The write gate: an angle-only edit sends the STORED stops back through
  // readGradientInput → normStops - aliases must survive verbatim.
  const stored = leafAt(doc, p)!.$value as GradientStop[];
  assert.equal(setStudioTokenValue(doc, p, { stops: stored, angle: 90 }), true);
  assert.deepEqual(leafAt(doc, p)!.$value, [
    { color: '{color.ramp.primary.1}', position: 0 },
    { color: '#ffffff', position: 1 },
  ]);
  assert.equal((leafAt(doc, p)!.$extensions as Record<string, { angle?: number }>)[TOKEN_EXT]!.angle, 90);
});

test('legacy literal gradients round-trip the write gate byte-identically', () => {
  const doc = load();
  const p = addStudioToken(doc, 'gradient', 'Fade', {
    stops: [{ color: '#102030', position: 0 }, { color: 'oklch(60% 0.1 250)', position: 1 }], angle: 30,
  })!;
  const before = JSON.stringify(leafAt(doc, p));
  assert.equal(setStudioTokenValue(doc, p, { stops: leafAt(doc, p)!.$value }), true);
  assert.equal(JSON.stringify(leafAt(doc, p)), before);
});

test('gradientCss resolves alias stops through opts.resolve; junk answers die at colorToHex', () => {
  const stops = [
    { color: '{color.brand.a}', position: 0 },
    { color: '{color.missing}', position: 0.5 }, // resolver can't answer → dropped
    { color: '#0000ff', position: 1 },
  ];
  const resolve = (ref: string): unknown =>
    ref === '{color.brand.a}' ? '#ff0000'
      : ref === '{color.evil}' ? 'red;background:url(//evil)'
      : undefined;
  assert.equal(gradientCss(stops, 90, { resolve }), 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)');
  // No resolver at all: alias stops drop, literals still render.
  assert.equal(gradientCss(stops, 90), 'linear-gradient(90deg, #0000ff 100%, #0000ff 100%)');
  // A resolver answering with a CSS-injection string is re-validated away.
  const evil = gradientCss([{ color: '{color.evil}', position: 0 }, { color: '#00ff00', position: 1 }], 90, { resolve });
  assert.ok(!evil.includes('evil'));
});

test("gradientCss space:'oklch' emits perceptual interpolation; 'srgb' stays plain", () => {
  const stops = [{ color: '#ff0000', position: 0 }, { color: '#0000ff', position: 1 }];
  assert.equal(gradientCss(stops, 45, { space: 'oklch' }), 'linear-gradient(45deg in oklch, #ff0000 0%, #0000ff 100%)');
  assert.match(gradientCss(stops, 45, { space: 'srgb' }), /^linear-gradient\(45deg, /);
});

test('resolveStopHex: literal, alias with/without resolver, junk resolver output', () => {
  assert.equal(resolveStopHex({ color: '#123456', position: 0 }), '#123456');
  assert.equal(resolveStopHex({ color: 'oklch(60% 0.1 250)', position: 0 })?.[0], '#');
  assert.equal(resolveStopHex({ color: '{color.x}', position: 0 }), null, 'alias without a resolver');
  assert.equal(resolveStopHex({ color: '{color.x}', position: 0 }, () => '#ff0000'), '#ff0000');
  assert.equal(resolveStopHex({ color: '{color.x}', position: 0 }, () => 'red;background:url(//evil)'), null);
  assert.equal(resolveStopHex({ color: '{color.x}', position: 0 }, () => ({ nope: 1 })), null, 'non-colour object');
  assert.equal(resolveStopHex({ color: '{color.x}', position: 0 }, () => { throw new Error('boom'); }), null, 'thrown resolver contained');
});

test('materializeGradientAliases pins approved refs; gradientAliasRefCount counts them', () => {
  const doc = load();
  const p = addStudioToken(doc, 'gradient', 'Hero', {
    stops: [
      { color: '{color.custom.sun}', position: 0 },
      { color: '{color.ramp.primary.5}', position: 0.5 },
      { color: '#ffffff', position: 1 },
    ], angle: 45,
  })!;
  assert.equal(gradientAliasRefCount(doc, 'color.custom.sun'), 1);
  assert.equal(gradientAliasRefCount(doc, 'color.nope'), 0);
  const n = materializeGradientAliases(doc, ref => ref === '{color.custom.sun}', () => '#ffcc00');
  assert.equal(n, 1);
  assert.deepEqual(leafAt(doc, p)!.$value, [
    { color: '#ffcc00', position: 0 },
    { color: '{color.ramp.primary.5}', position: 0.5 },
    { color: '#ffffff', position: 1 },
  ]);
  // An unanswerable resolver leaves the stop alone (render guards handle it) …
  assert.equal(materializeGradientAliases(doc, () => true, () => null), 0);
  // … and so does one answering with something colorToHex can't read.
  assert.equal(materializeGradientAliases(doc, () => true, () => 'not a colour!'), 0);
  assert.equal(gradientAliasRefCount(doc, 'color.ramp.primary.5'), 1, 'the unpinned alias survives');
});

test('formatStudioValue: short display strings per kind', () => {
  assert.equal(formatStudioValue(tok('spacing', '8px')), '8px');
  assert.equal(formatStudioValue(tok('sizing', '3rem')), '3rem');
  assert.equal(formatStudioValue(tok('stroke', '2px')), '2px');
  assert.equal(formatStudioValue(tok('opacity', 0.8)), '0.8');
  assert.equal(formatStudioValue(tok('rotation', 45)), '45°');
  assert.equal(formatStudioValue(tok('number', 2.5)), '2.5');
  assert.equal(
    formatStudioValue(tok('shadow', { color: '#00000040', offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px' })),
    '0 2px 8px', 'zero offsets compress, zero spread drops',
  );
  assert.equal(
    formatStudioValue(tok('shadow', { color: '#000', offsetX: '1px', offsetY: '2px', blur: '8px', spread: '4px' })),
    '1px 2px 8px 4px', 'non-zero spread shown',
  );
  const stops = [{ color: '#000000', position: 0 }, { color: '#ffffff', position: 1 }];
  assert.equal(formatStudioValue(tok('gradient', stops, 135)), '135° · 2 stops');
  assert.equal(formatStudioValue(tok('gradient', stops)), '180° · 2 stops', 'CSS default angle');
  assert.equal(formatStudioValue(tok('gradient', [stops[0]!])), '180° · 1 stop');
});
