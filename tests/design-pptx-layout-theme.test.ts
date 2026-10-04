// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 section 6: what a Tier A deck's layouts and theme carry.
 *
 *   - A piece of furniture a slide left out (compose's `omit: ["caption-scrim"]`) is
 *     left off the slide's layout too. PowerPoint draws the layout under the slide, so a
 *     scrim kept on the layout came back on the slide that omitted it, and `lolly check`
 *     read its colour as off-brand.
 *   - A translucent furniture bar keeps its alpha on the layout.
 *   - The theme slots no `color.semantic.*` token fills (`lt2`, `accent3` to `accent6`)
 *     take the design system's own colours when the caller hands them over, so
 *     PowerPoint's colour picker offers no colour the brand does not have.
 *
 * Public: frames are seeded from the engine's neutral master.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPptxParts } from '../engine/src/pptx.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { designFramesToPptx, themeSlotFills, tokenColorsFromStyle } from '../packages/node-shell/src/design-pptx.ts';
import { tokenColorVar } from '../engine/src/color-face.ts';
import type { DesignBoxRowV1, SlideMasterV1 } from '../packages/core/src/index.ts';

const master: SlideMasterV1 = neutralSlideMaster();
const NOW = '2026-10-03T00:00:00.000Z';

const TOKENS: Record<string, string> = {
  'color.semantic.text': '#13294b',
  'color.semantic.surface': '#ffffff',
  'color.semantic.muted': '#3a3a3a',
  'color.semantic.primary': '#13294b',
  'color.semantic.secondary': '#2fb8ac',
};
const tokens = (path: string): string | undefined => TOKENS[path];

/** The design system's colour tokens, in the order the fixture states them. */
const TOKEN_COLORS = [
  { path: 'color.brand.navy', value: '#13294b' },
  { path: 'color.brand.reef', value: '#2fb8ac' },
  { path: 'color.brand.white', value: '#ffffff' },
  { path: 'color.brand.sand', value: '#f3e9d2' },
  { path: 'color.brand.ink', value: '#1b1b1b' },
  { path: 'color.ramp.grey.2', value: '#3a3a3a' },
  { path: 'color.ramp.grey.7', value: '#d9d9d9' },
  { path: 'color.ramp.neutral.8', value: '#eef1f4' },
  ...Object.entries(TOKENS).map(([path, value]) => ({ path, value })),
];

type Frame = { row: DesignBoxRowV1; layers: DesignBoxRowV1[] };

function seeded(archetype: string, frameId: string, x = 0): Frame {
  const s = seedFrame(master, archetype, { frameId, x, y: 0, resolveToken: tokens });
  assert.ok(s, `the neutral master seeds ${archetype}`);
  return { row: s!.frame, layers: s!.layers };
}

/** What compose does with `omit`: the furniture layer is not written. */
function omit(frame: Frame, furnitureId: string): Frame {
  return { row: frame.row, layers: frame.layers.filter((l) => l.furniture !== furnitureId) };
}

function layoutXml(parts: Record<string, unknown>, name: string): string {
  for (const [path, body] of Object.entries(parts)) {
    if (!/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(path)) continue;
    const xml = typeof body === 'string' ? body : new TextDecoder().decode(body as Uint8Array);
    if (xml.includes(`name="${name}"`)) return xml;
  }
  throw new Error(`no layout named ${name}`);
}

test('a furniture piece every slide of a layout omits is left off that layout', async () => {
  const frame = omit(seeded('full-image', 'f1'), 'caption-scrim');
  const out = await designFramesToPptx({ frames: [frame], master, tokens });
  const parts = buildPptxParts(out.slides, { theme: out.theme, layouts: out.layouts, now: NOW });
  const xml = layoutXml(parts, master.archetypes.find((a) => a.id === 'full-image')!.name);
  assert.doesNotMatch(xml, /1D1D1D/, 'the omitted caption scrim is not on the layout');
});

test('a layout keeps a piece only when every slide drawn from it keeps it', async () => {
  const kept = seeded('full-image', 'f1');
  const left = omit(seeded('full-image', 'f2', 2000), 'caption-scrim');
  const both = await designFramesToPptx({ frames: [kept, left], master, tokens });
  const one = await designFramesToPptx({ frames: [kept], master, tokens });
  const name = master.archetypes.find((a) => a.id === 'full-image')!.name;
  const xmlBoth = layoutXml(buildPptxParts(both.slides, { layouts: both.layouts, now: NOW }), name);
  const xmlOne = layoutXml(buildPptxParts(one.slides, { layouts: one.layouts, now: NOW }), name);
  assert.doesNotMatch(xmlBoth, /1D1D1D/, 'one slide left the scrim out, so the shared layout does too');
  assert.match(xmlOne, /<a:srgbClr val="1D1D1D"><a:alpha val="72157"\/><\/a:srgbClr>/,
    'a slide that keeps the scrim keeps it on its layout, translucent as the master states (#1d1d1db8)');
});

test('the theme slots no semantic token fills take the design system colours', async () => {
  const frame = seeded('content', 'f1');
  const before = await designFramesToPptx({ frames: [frame], master, tokens });
  assert.equal(before.theme?.colors?.accent3, undefined, 'without the token list the slot is left to the engine default');

  const out = await designFramesToPptx({ frames: [frame], master, tokens, tokenColors: TOKEN_COLORS });
  const colors = out.theme!.colors!;
  const brand = new Set(TOKEN_COLORS.map((t) => t.value.slice(1).toUpperCase()));
  for (const slot of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const) {
    assert.ok(colors[slot] && brand.has(colors[slot]!), `${slot} is a brand colour (${colors[slot]})`);
  }
  assert.equal(colors.lt2, 'EEF1F4', 'Background 2 is the brand colour nearest Background 1 that is not Background 1');
  assert.equal(colors.accent3, 'F3E9D2', 'the first brand colour no slot holds');
  assert.equal(colors.accent4, '1B1B1B');
  const theme = buildPptxParts(out.slides, { theme: out.theme, layouts: out.layouts, now: NOW })['ppt/theme/theme1.xml'] as string;
  for (const off of ['B28727', 'EFEFEF', 'A0A0A0', '6B7280', 'E7E6E6']) {
    assert.ok(!new RegExp(`<a:(?:lt2|accent\\d)><a:srgbClr val="${off}"`).test(theme), `no theme slot keeps the default ${off}`);
  }
});

test('themeSlotFills: brand group first, repeats the accents once the brand runs out, deterministic', () => {
  const filled = new Map([['dk1', '000000'], ['lt1', 'FFFFFF'], ['accent1', '30BA78'], ['accent2', '0C322C']] as const);
  const fills = themeSlotFills(filled, [
    { path: 'color.ramp.neutral.8', hex: 'EFEFEF' },
    { path: 'color.brand.mint', hex: '90EBCD' },
    { path: 'color.brand.pine', hex: '0C322C' },
  ]);
  assert.deepEqual(fills, { lt2: 'EFEFEF', accent3: '90EBCD', accent4: '30BA78', accent5: '0C322C', accent6: '30BA78' });
  assert.deepEqual(themeSlotFills(filled, []), {}, 'no candidates, no change');
  const dark = new Map([['dk1', 'FFFFFF'], ['lt1', '1D1D1D'], ['accent1', 'FFFFFF']] as const);
  assert.equal(themeSlotFills(dark, [
    { path: 'color.ramp.neutral.1', hex: '1D1D1D' },
    { path: 'color.ramp.neutral.2', hex: '3E3E3E' },
    { path: 'color.ramp.neutral.8', hex: 'EFEFEF' },
  ]).lt2, '3E3E3E', 'a dark theme gets a dark second ground');
});

test('tokenColorsFromStyle reads the --brand-token-* properties a canvas carries', () => {
  const props = new Map<string, string>([
    ['--brand-primary', '#13294b'],
    [tokenColorVar('color.brand.reef'), ' #2fb8ac '],
    ['--brand-token-zz', '#000000'],
  ]);
  const names = [...props.keys()];
  const style = { length: names.length, item: (i: number) => names[i]!, getPropertyValue: (n: string) => props.get(n) ?? '' };
  assert.deepEqual(tokenColorsFromStyle(style), [{ path: 'color.brand.reef', value: '#2fb8ac' }]);
});
