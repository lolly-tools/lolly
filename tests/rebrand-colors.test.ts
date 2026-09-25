// SPDX-License-Identifier: MPL-2.0
/**
 * Colour assignment by use, with feasibility (plan 274 section 3.3, work
 * package 4). The cases are the ones section 9 names under "colour
 * feasibility", plus the two the plan states about what a mapping may reach.
 *
 * Every case is a hand built census slice: uses, contrast pairs and a palette.
 * The point of this module is what it refuses to do, so most of the file is
 * about the refusals: more series than the palette can keep apart returns
 * `palette-too-small` rather than a collapse, a contrast pair that no candidate
 * can satisfy returns `contrast-unreachable` rather than a pretty colour, and
 * two locks that cannot both hold are reported as the conflict they are.
 *
 * Run with: node --test "tests/rebrand-colors.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastRatio } from '../engine/src/brand-derive.ts';
import { deltaEOk } from '../engine/src/color-tools.ts';
import { DEFAULT_MIN_SEPARATION, assignColors, assignColorsByGround, type AssignColorsGroundsV1, type BrandSwatchV1 } from '../engine/src/rebrand-colors.ts';
import type { ColorMappingV1, ColorUseV1, ContrastPairV1 } from '../packages/core/src/index.ts';

const PALETTE: BrandSwatchV1[] = [
  { path: 'color.semantic.surface', hex: '#FFFFFF', role: 'bg' },
  { path: 'color.semantic.text', hex: '#0C322C', role: 'ink' },
  { path: 'color.accent.1', hex: '#30BA78', role: 'accent' },
  { path: 'color.accent.2', hex: '#FE7C3F', role: 'accent' },
  { path: 'color.accent.3', hex: '#2453FF', role: 'accent' },
  { path: 'color.accent.4', hex: '#9B59B6', role: 'accent' },
  { path: 'color.ramp.neutral.5', hex: '#7C7C7C', role: 'neutral' },
];

function seriesUse(chartId: string, index: number, hex: string): ColorUseV1 {
  return {
    useId: `${chartId}:series:${index}`,
    hex,
    role: 'series',
    weight: 100,
    objectIds: [chartId],
    distinctionSet: chartId,
  };
}

function row(rows: ColorMappingV1[], useId: string): ColorMappingV1 {
  const found = rows.find((one) => one.useId === useId);
  assert.ok(found, `no mapping for ${useId}`);
  return found;
}

test('two uses that must stay apart never take the same target', () => {
  const uses = [seriesUse('slide1.9', 1, '#1F4E79'), seriesUse('slide1.9', 2, '#245E8C')];
  const rows = assignColors({ uses, contrastPairs: [], swatches: PALETTE });
  const a = row(rows, 'slide1.9:series:1');
  const b = row(rows, 'slide1.9:series:2');
  assert.ok(a.to && b.to, 'four accents can keep two series apart');
  assert.notEqual(a.to, b.to);
  assert.ok(deltaEOk(a.to as string, b.to as string) >= DEFAULT_MIN_SEPARATION);
});

test('eight series against four usable accents returns palette-too-small for the set, not a collapse', () => {
  const hexes = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF', '#B8860B', '#2E7D32', '#8E244A', '#3F51B5'];
  const uses = hexes.map((hex, i) => seriesUse('slide2.66', i + 1, hex));
  const rows = assignColors({ uses, contrastPairs: [], swatches: PALETTE });
  assert.equal(rows.length, 8);
  for (const one of rows) {
    assert.equal(one.unresolved, 'palette-too-small', `${one.useId} should be unresolved, not assigned`);
    assert.equal(one.to, undefined, 'an unresolved mapping carries no target');
  }
  const targets = rows.map((one) => one.to).filter((to) => to !== undefined);
  assert.equal(targets.length, 0, 'clustering eight series into four colours is not a way out');
});

test('one hex in three roles maps per use, not per hex', () => {
  // A deep blue in three places at once. The palette carries a CHROMATIC ground
  // as well as the paper one, because `nearestBrandColor` partitions by chroma
  // before it reads the role hint: a chromatic source never snaps onto an
  // achromatic swatch, so a dark blue ground looks for a dark brand ground.
  const swatches: BrandSwatchV1[] = [...PALETTE, { path: 'color.bg.deep', hex: '#123C5A', role: 'bg' }];
  const hex = '#1F4E79';
  const uses: ColorUseV1[] = [
    { useId: 'slide1.3:text', hex, role: 'ink', weight: 900, objectIds: ['slide1.3'] },
    { useId: 'slide1:fill', hex, role: 'bg', weight: 921600, objectIds: [] },
    seriesUse('slide2.66', 1, hex),
  ];
  const rows = assignColors({ uses, contrastPairs: [], swatches });
  assert.equal(rows.length, 3);
  assert.equal(row(rows, 'slide1.3:text').role, 'ink');
  assert.equal(row(rows, 'slide1:fill').role, 'bg');
  assert.equal(row(rows, 'slide2.66:series:1').role, 'series');
  assert.equal(row(rows, 'slide1.3:text').to, '#0C322C');
  assert.equal(row(rows, 'slide1:fill').to, '#123C5A');
  assert.equal(row(rows, 'slide2.66:series:1').to, '#2453FF');
  // One source hex, three targets, one per use.
  const targets = rows.map((one) => one.to);
  assert.equal(new Set(targets).size, 3);
  for (const one of rows) assert.equal(one.from, hex);
});

test('a contrast pair is measured on the actual pair and holds at 4.5', () => {
  const swatches: BrandSwatchV1[] = [
    { path: 'color.paper', hex: '#FFFFFF', role: 'bg' },
    { path: 'color.ink.light', hex: '#F2F2F2', role: 'ink' },
    { path: 'color.ink.dark', hex: '#1A1A1A', role: 'ink' },
  ];
  const uses: ColorUseV1[] = [
    { useId: 'slide1.4:fill', hex: '#FDFDFD', role: 'bg', weight: 400000, objectIds: ['slide1.4'] },
    { useId: 'slide1.4:text', hex: '#EEEEEE', role: 'ink', weight: 900, objectIds: ['slide1.4'] },
  ];
  const pairs: ContrastPairV1[] = [
    { foreground: 'slide1.4:text', background: 'slide1.4:fill', minimum: 4.5, objectId: 'slide1.4' },
  ];
  const rows = assignColors({ uses, contrastPairs: pairs, swatches });
  const fg = row(rows, 'slide1.4:text');
  const bg = row(rows, 'slide1.4:fill');
  assert.ok(fg.to && bg.to);
  assert.equal(fg.unresolved, undefined);
  assert.ok(contrastRatio(fg.to as string, bg.to as string) >= 4.5,
    `the nearest ink by colour distance is ${'#F2F2F2'}, and the pair forced the darker one`);
  assert.equal(fg.to, '#1A1A1A');
});

test('a contrast pair no candidate can satisfy returns contrast-unreachable and no target', () => {
  const swatches: BrandSwatchV1[] = [
    { path: 'color.paper', hex: '#FFFFFF', role: 'bg' },
    { path: 'color.ink.light', hex: '#F2F2F2', role: 'ink' },
    { path: 'color.ink.lighter', hex: '#F7F7F7', role: 'ink' },
  ];
  const uses: ColorUseV1[] = [
    { useId: 'slide1.4:fill', hex: '#FFFFFF', role: 'bg', weight: 400000, objectIds: ['slide1.4'] },
    { useId: 'slide1.4:text', hex: '#EEEEEE', role: 'ink', weight: 900, objectIds: ['slide1.4'] },
  ];
  const pairs: ContrastPairV1[] = [
    { foreground: 'slide1.4:text', background: 'slide1.4:fill', minimum: 4.5, objectId: 'slide1.4' },
  ];
  const rows = assignColors({ uses, contrastPairs: pairs, swatches });
  assert.equal(row(rows, 'slide1.4:text').unresolved, 'contrast-unreachable');
  assert.equal(row(rows, 'slide1.4:text').to, undefined);
  assert.ok(row(rows, 'slide1.4:fill').to, 'the rest of the component keeps its target');
});

test('two locks on one distinction set that cannot both hold report locked-conflict', () => {
  const uses = [seriesUse('slide2.66', 1, '#1F4E79'), seriesUse('slide2.66', 2, '#D65A28')];
  const rows = assignColors({
    uses,
    contrastPairs: [],
    swatches: PALETTE,
    locked: [
      { useId: 'slide2.66:series:1', to: '#30BA78', toPath: 'color.accent.1' },
      { useId: 'slide2.66:series:2', to: '#30BA78', toPath: 'color.accent.1' },
    ],
  });
  for (const one of rows) {
    assert.equal(one.unresolved, 'locked-conflict');
    assert.equal(one.locked, true);
    assert.equal(one.to, '#30BA78', 'a lock is a stated choice, so it stays beside the reason');
  }
});

test('an empty palette answers no-candidate-in-role rather than inventing a colour', () => {
  const uses: ColorUseV1[] = [{ useId: 'slide1.3:text', hex: '#1F4E79', role: 'ink', weight: 900, objectIds: ['slide1.3'] }];
  const rows = assignColors({ uses, contrastPairs: [], swatches: [] });
  assert.equal(row(rows, 'slide1.3:text').unresolved, 'no-candidate-in-role');
  assert.equal(row(rows, 'slide1.3:text').to, undefined);
});

test('a theme slot maps slot to slot when nothing stops it', () => {
  const uses: ColorUseV1[] = [
    { useId: 'slide1.60:fill', hex: '#1F4E79', scheme: 'accent1', role: 'accent', weight: 13500, objectIds: ['slide1.60'] },
  ];
  const rows = assignColors({
    uses,
    contrastPairs: [],
    swatches: PALETTE,
    slots: { accent1: { hex: '#30BA78', path: 'color.accent.1' } },
  });
  const one = row(rows, 'slide1.60:fill');
  assert.equal(one.scheme, 'accent1');
  assert.equal(one.to, '#30BA78');
  assert.equal(one.toPath, 'color.accent.1');
});

test('a slot target is the first candidate, and the solve moves it when contrast cannot hold', () => {
  // accent1 is the ink colour in a colourless starter: text named tx1 on a ground
  // named bg1 keeps both slots, but text named accent1 on a dark ground cannot
  // take the dark slot colour and still be read, so the solve moves it.
  const uses: ColorUseV1[] = [
    { useId: 'slide1.2:text', hex: '#1F4E79', scheme: 'accent1', role: 'ink', weight: 900, objectIds: ['slide1.2'] },
    { useId: 'slide1.2:fill', hex: '#101010', scheme: 'tx1', role: 'bg', weight: 90000, objectIds: ['slide1.2'] },
    { useId: 'slide1.3:text', hex: '#202020', scheme: 'tx1', role: 'ink', weight: 900, objectIds: ['slide1.3'] },
  ];
  const contrastPairs: ContrastPairV1[] = [
    { foreground: 'slide1.2:text', background: 'slide1.2:fill', minimum: 4.5, objectId: 'slide1.2' },
  ];
  const slots = {
    accent1: { hex: '#0C322C', path: 'color.semantic.text' },
    tx1: { hex: '#0C322C', path: 'color.semantic.text' },
  };
  const rows = assignColors({ uses, contrastPairs, swatches: PALETTE, slots });
  const moved = row(rows, 'slide1.2:text');
  const ground = row(rows, 'slide1.2:fill');
  assert.equal(moved.unresolved, undefined, 'a slot that cannot hold is moved, not reported unreachable');
  assert.ok(moved.to && ground.to);
  assert.ok(contrastRatio(moved.to, ground.to) >= 4.5, `${moved.to} on ${ground.to} reads`);
  assert.equal(row(rows, 'slide1.3:text').to, '#0C322C', 'an unconstrained slot use keeps its slot colour');
  assert.equal(row(rows, 'slide1.3:text').toPath, 'color.semantic.text');
});

test('two series named by one slot are kept apart rather than both pinned to it', () => {
  const uses: ColorUseV1[] = [
    { ...seriesUse('slide2.7', 1, '#1F4E79'), scheme: 'accent1' },
    { ...seriesUse('slide2.7', 2, '#1F4E79'), scheme: 'accent1' },
  ];
  const rows = assignColors({ uses, contrastPairs: [], swatches: PALETTE, slots: { accent1: { hex: '#30BA78', path: 'color.accent.1' } } });
  const a = row(rows, 'slide2.7:series:1');
  const b = row(rows, 'slide2.7:series:2');
  assert.ok(a.to && b.to, 'one of them takes the slot and the other a colour of its role');
  assert.ok([a.to, b.to].includes('#30BA78'), 'the slot colour is still used');
  assert.ok(deltaEOk(a.to, b.to) >= DEFAULT_MIN_SEPARATION);
});

test('a raster object is never in affects, and a slide ground names its own background', () => {
  const uses: ColorUseV1[] = [
    { useId: 'slide1.5:fill', hex: '#1F4E79', role: 'accent', weight: 1000, objectIds: ['slide1.5', 'slide1.9'] },
    { useId: 'slide1:fill', hex: '#FFFFFF', role: 'bg', weight: 921600, objectIds: [] },
  ];
  const rows = assignColors({ uses, contrastPairs: [], swatches: PALETTE, rasterObjectIds: ['slide1.9'] });
  assert.deepEqual(row(rows, 'slide1.5:fill').affects, ['slide1.5']);
  assert.deepEqual(row(rows, 'slide1:fill').affects, ['slide1#background']);
});

test('one seed repeats exactly, and a different seed reorders the candidates', () => {
  const hexes = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF'];
  const uses = hexes.map((hex, i) => seriesUse('slide2.66', i + 1, hex));
  const run = (seed?: number): ColorMappingV1[] =>
    assignColors({ uses, contrastPairs: [], swatches: PALETTE, ...(seed === undefined ? {} : { seed }) });

  assert.deepEqual(run(7), run(7), 'the same seed gives the same assignment');
  const base = JSON.stringify(run());
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  assert.ok(seeds.some((seed) => JSON.stringify(run(seed)) !== base),
    'Shuffle reorders the candidate sets, so some seed reaches a different assignment');

  // Whatever the seed, the distinction set stays a distinction set.
  for (const seed of seeds) {
    const targets = run(seed).map((one) => one.to).filter((to): to is string => to !== undefined);
    assert.equal(new Set(targets).size, targets.length, `seed ${seed} collapsed two series onto one target`);
  }
});

test('mappings come back in the order the uses arrived', () => {
  const uses: ColorUseV1[] = [
    { useId: 'z:fill', hex: '#FFFFFF', role: 'bg', weight: 5, objectIds: ['z'] },
    { useId: 'a:text', hex: '#111111', role: 'ink', weight: 5, objectIds: ['a'] },
  ];
  const rows = assignColors({ uses, contrastPairs: [], swatches: PALETTE });
  assert.deepEqual(rows.map((one) => one.useId), ['z:fill', 'a:text']);
});

test('a distinction set the palette cannot answer does not take the rest of its component with it', () => {
  // Six series in one set over four usable accents, plus an ink tied into the
  // same component by a contrast pair. The set is refused; the ink is not.
  const hexes = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF', '#B8860B', '#2E7D32'];
  const uses: ColorUseV1[] = [
    ...hexes.map((hex, i) => seriesUse('slide2.66', i + 1, hex)),
    { useId: 'slide2.70:fill', hex: '#FFFFFF', role: 'bg', weight: 400000, objectIds: ['slide2.70'] },
    { useId: 'slide2.70:text', hex: '#333333', role: 'ink', weight: 900, objectIds: ['slide2.70'] },
  ];
  const pairs: ContrastPairV1[] = [
    { foreground: 'slide2.70:text', background: 'slide2.66:series:1', minimum: 4.5, objectId: 'slide2.70' },
    { foreground: 'slide2.70:text', background: 'slide2.70:fill', minimum: 4.5, objectId: 'slide2.70' },
  ];
  const rows = assignColors({ uses, contrastPairs: pairs, swatches: PALETTE });

  for (let i = 1; i <= 6; i += 1) {
    assert.equal(row(rows, `slide2.66:series:${i}`).unresolved, 'palette-too-small');
    assert.equal(row(rows, `slide2.66:series:${i}`).to, undefined);
  }
  assert.ok(row(rows, 'slide2.70:text').to, 'the ink beside the chart still gets its colour');
  assert.equal(row(rows, 'slide2.70:text').unresolved, undefined);
});

test('every mapping comes back with either a target or a reason', () => {
  const hexes = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF', '#B8860B', '#2E7D32', '#8E244A', '#3F51B5'];
  const uses: ColorUseV1[] = [
    ...hexes.map((hex, i) => seriesUse('slide2.66', i + 1, hex)),
    { useId: 'slide2.70:text', hex: '#333333', role: 'ink', weight: 900, objectIds: ['slide2.70'] },
  ];
  const pairs: ContrastPairV1[] = [
    { foreground: 'slide2.70:text', background: 'slide2.66:series:1', minimum: 4.5, objectId: 'slide2.70' },
  ];
  for (const set of [
    assignColors({ uses, contrastPairs: pairs, swatches: PALETTE }),
    assignColors({ uses, contrastPairs: pairs, swatches: PALETTE, nodeBudget: 1 }),
    assignColors({ uses: uses.slice(0, 2), contrastPairs: [], swatches: [] }),
  ]) {
    for (const one of set) {
      assert.ok(one.to !== undefined || one.unresolved !== undefined,
        `${one.useId} came back with neither a target nor a reason`);
    }
  }
});

test('one contrast pair that cannot hold does not cost a pair that can', () => {
  // Two texts on two grounds. The pale ground has no ink dark enough for it in
  // this palette; the white one has. Relaxing every pair at once picked the
  // second text with no regard for its own pair and reported both unreachable.
  const swatches: BrandSwatchV1[] = [
    { path: 'color.paper', hex: '#FFFFFF', role: 'bg' },
    { path: 'color.ink.light', hex: '#F2F2F2', role: 'ink' },
    { path: 'color.ink.dark', hex: '#1A1A1A', role: 'ink' },
  ];
  const uses: ColorUseV1[] = [
    { useId: 'a:fill', hex: '#FDFDFD', role: 'bg', weight: 400000, objectIds: ['a'] },
    { useId: 'a:text', hex: '#EEEEEE', role: 'ink', weight: 900, objectIds: ['a'] },
    { useId: 'b:fill', hex: '#FBFBFB', role: 'bg', weight: 400000, objectIds: ['b'] },
    { useId: 'b:text', hex: '#EFEFEF', role: 'ink', weight: 900, objectIds: ['b'] },
  ];
  const pairs: ContrastPairV1[] = [
    // One ground is tied to the other's text, so the four uses form one component.
    { foreground: 'a:text', background: 'a:fill', minimum: 4.5, objectId: 'a' },
    { foreground: 'b:text', background: 'b:fill', minimum: 21.5, objectId: 'b' },
    { foreground: 'b:text', background: 'a:fill', minimum: 1, objectId: 'b' },
  ];
  const rows = assignColors({ uses, contrastPairs: pairs, swatches });
  assert.equal(row(rows, 'b:text').unresolved, 'contrast-unreachable', 'a ratio no pair of colours reaches is refused');
  assert.equal(row(rows, 'a:text').unresolved, undefined, 'the pair that could hold kept its target');
  assert.equal(row(rows, 'a:text').to, '#1A1A1A');
});

test('a slot order that runs out of search budget is retried in the role order before a pair is blamed', () => {
  // template-example: with the slot colour first, one component of 73 contrast
  // pairs ran out of its 20000 nodes, and the relaxation then reported a text
  // (slide 22, accent1) as contrast-unreachable that the role order resolves.
  // The same case in small: the ground's slot colour is visited first and holds
  // until the last use, so the search walks every series combination under it
  // before it can move the ground, and a small budget runs out on the way.
  const swatches: BrandSwatchV1[] = [
    { path: 'color.paper', hex: '#FFFFFF', role: 'bg' },
    { path: 'color.grey', hex: '#595959', role: 'neutral' },
    { path: 'color.ink', hex: '#000000', role: 'ink' },
    { path: 'color.red', hex: '#D0021B', role: 'accent' },
    { path: 'color.green', hex: '#1B7F3A', role: 'accent' },
    { path: 'color.blue', hex: '#1F4FD1', role: 'accent' },
  ];
  const uses: ColorUseV1[] = [
    { useId: 'a:fill', hex: '#FAFAFA', scheme: 'lt1', role: 'bg', weight: 400000, objectIds: ['a'] },
    { ...seriesUse('m', 1, '#D00000'), distinctionSet: 'set' },
    { ...seriesUse('m', 2, '#00A000'), distinctionSet: 'set' },
    { ...seriesUse('m', 3, '#0000D0'), distinctionSet: 'set' },
    { useId: 'z:text', hex: '#101010', role: 'ink', weight: 900, objectIds: ['z'], distinctionSet: 'set' },
  ];
  const pairs: ContrastPairV1[] = [{ foreground: 'z:text', background: 'a:fill', minimum: 10, objectId: 'z' }];
  const slots = { lt1: { hex: '#595959', path: 'color.grey' } };
  const budget = 40;

  // The small budget is enough for the role order, so the retry has something to find.
  const plain = assignColors({ uses, contrastPairs: pairs, swatches, nodeBudget: budget });
  assert.ok(plain.every((one) => one.unresolved === undefined), JSON.stringify(plain));

  const rows = assignColors({ uses, contrastPairs: pairs, swatches, slots, nodeBudget: budget });
  assert.ok(rows.every((one) => one.unresolved === undefined), `no pair is blamed for a search that ran out: ${JSON.stringify(rows)}`);
  assert.equal(row(rows, 'a:fill').to, '#FFFFFF');
  assert.equal(row(rows, 'z:text').to, '#000000');

  // With room to finish, the slot order reaches the same answer on its own.
  const roomy = assignColors({ uses, contrastPairs: pairs, swatches, slots, nodeBudget: 200000 });
  assert.deepEqual(roomy.map((one) => one.to), rows.map((one) => one.to));
});

// ─── the solve per ground group (plan 275 section 6.2) ───────────────────────

/** Two slides of body text over each slide's own ground: s1 stays on the deck ground, s2 is moved to Dark. */
function groundedDeck(): { uses: ColorUseV1[]; pairs: ContrastPairV1[]; objectSlides: Record<string, string> } {
  const uses: ColorUseV1[] = [
    { useId: 'slide:s1:fill', hex: '#FFFFFF', role: 'bg', weight: 1000, objectIds: [] },
    { useId: 'slide:s2:fill', hex: '#FFFFFF', role: 'bg', weight: 1000, objectIds: [] },
    { useId: 'ink:body', hex: '#222222', role: 'ink', weight: 50, objectIds: ['s1.t', 's2.t'] },
  ];
  const pairs: ContrastPairV1[] = [
    { foreground: 'ink:body', background: 'slide:s1:fill', minimum: 4.5, objectId: 's1.t' },
    { foreground: 'ink:body', background: 'slide:s2:fill', minimum: 4.5, objectId: 's2.t' },
  ];
  return { uses, pairs, objectSlides: { 's1.t': 's1', 's2.t': 's2' } };
}

test('without grounds the solve is the single solve it always was', () => {
  const { uses, pairs } = groundedDeck();
  const one = assignColors({ uses, contrastPairs: pairs, swatches: PALETTE });
  const two = assignColorsByGround({ uses, contrastPairs: pairs, swatches: PALETTE });
  assert.deepEqual(two.colors, one);
  assert.deepEqual(two.issues, []);
});

test('a use on a light slide and a dark one holds contrast on each ground, the second target in byGround', () => {
  const { uses, pairs, objectSlides } = groundedDeck();
  const { colors, issues } = assignColorsByGround({
    uses,
    contrastPairs: pairs,
    swatches: PALETTE,
    grounds: {
      objectSlides,
      groups: [
        { ground: 'deck', slideIds: ['s1'], groundBySlide: { s1: { hex: '#FFFFFF', path: 'color.semantic.surface' } } },
        { ground: 'dark', slideIds: ['s2'], groundBySlide: { s2: { hex: '#0C322C', path: 'color.semantic.text' } } },
      ],
    },
  });
  assert.deepEqual(issues, []);
  const ink = row(colors, 'ink:body');
  assert.ok(ink.to && contrastRatio(ink.to, '#FFFFFF') >= 4.5, 'the deck target holds on the light ground');
  const dark = ink.byGround?.dark;
  assert.ok(dark?.to, 'the dark ground has a target of its own');
  assert.ok(contrastRatio(dark.to, '#0C322C') >= 4.5, 'and it holds on the dark ground');
  assert.equal(ink.unresolved, undefined);
  // Each slide ground takes the ground the compile draws there, and is not a lock.
  assert.equal(row(colors, 'slide:s1:fill').to, '#FFFFFF');
  assert.equal(row(colors, 'slide:s2:fill').to, '#0C322C', 'a ground use only on the dark slide is solved there, on its dark ground');
  assert.equal(row(colors, 'slide:s1:fill').locked, undefined);
});

test('a use that cannot hold on a moved ground records it there and in an issue, and stays resolved for the deck', () => {
  const { uses, pairs, objectSlides } = groundedDeck();
  // Only dark inks: nothing holds 4.5:1 on the deep ground.
  const swatches: BrandSwatchV1[] = [
    { path: 'color.semantic.text', hex: '#111111', role: 'ink' },
    { path: 'color.ink.2', hex: '#333333', role: 'ink' },
  ];
  const { colors, issues } = assignColorsByGround({
    uses,
    contrastPairs: pairs,
    swatches,
    grounds: {
      objectSlides,
      groups: [
        { ground: 'deck', slideIds: ['s1'], groundBySlide: { s1: { hex: '#FFFFFF' } } },
        { ground: 'dark', slideIds: ['s2', 's3'], groundBySlide: { s2: { hex: '#141414' }, s3: { hex: '#141414' } } },
      ],
    },
  });
  const ink = row(colors, 'ink:body');
  // A compile skips a row that carries `unresolved` on every slide, so a failure on
  // the moved ground alone must not take the colour away from the deck-ground slides.
  assert.equal(ink.unresolved, undefined, 'the row stays resolved for the slides on the deck ground');
  assert.ok(ink.to && contrastRatio(ink.to, '#FFFFFF') >= 4.5, 'the deck target holds on the light slides');
  assert.deepEqual(ink.byGround?.dark, {}, 'the dark ground holds no target, which says no colour holds there');
  const issue = issues.find((one) => one.useId === 'ink:body');
  assert.deepEqual(issue, { useId: 'ink:body', ground: 'dark', reason: 'contrast-unreachable', slideIds: ['s2'] });
});

test('a person\'s locked colour that cannot hold on a moved ground keeps its target and stays usable on the deck ground', () => {
  const { uses, pairs, objectSlides } = groundedDeck();
  const swatches: BrandSwatchV1[] = [
    { path: 'color.semantic.text', hex: '#111111', role: 'ink' },
    { path: 'color.semantic.surface', hex: '#FFFFFF', role: 'bg' },
  ];
  const { colors, issues } = assignColorsByGround({
    uses,
    contrastPairs: pairs,
    swatches,
    locked: [{ useId: 'ink:body', to: '#111111', toPath: 'color.semantic.text' }],
    grounds: {
      objectSlides,
      groups: [
        { ground: 'deck', slideIds: ['s1'], groundBySlide: { s1: { hex: '#FFFFFF' } } },
        { ground: 'dark', slideIds: ['s2'], groundBySlide: { s2: { hex: '#141414' } } },
      ],
    },
  });
  const ink = row(colors, 'ink:body');
  assert.equal(ink.unresolved, undefined, 'the lock holds on the deck ground, so the row is not skipped there');
  assert.equal(ink.to, '#111111');
  assert.equal(ink.locked, true);
  assert.ok(ink.byGround?.dark && ink.byGround.dark.to === undefined, 'the moved ground says no colour holds there');
  assert.deepEqual(issues.map((one) => [one.useId, one.ground, one.slideIds]), [['ink:body', 'dark', ['s2']]], 'and an issue names the ground and its slide');
});

test('per ground group, no text sits under its minimum without an unresolved row', () => {
  const { uses, pairs, objectSlides } = groundedDeck();
  const grounds: AssignColorsGroundsV1 = {
    objectSlides,
    groups: [
      { ground: 'deck', slideIds: ['s1'], groundBySlide: { s1: { hex: '#FFFFFF' } } },
      { ground: 'brand', slideIds: ['s2'], groundBySlide: { s2: { hex: '#30BA78' } } },
    ],
  };
  const { colors, issues } = assignColorsByGround({ uses, contrastPairs: pairs, swatches: PALETTE, grounds });
  for (const group of grounds.groups) {
    for (const pair of pairs.filter((one) => group.slideIds.includes(objectSlides[one.objectId] ?? ''))) {
      const fg = row(colors, pair.foreground);
      const target = group.ground === 'deck' ? fg.to : fg.byGround?.[group.ground]?.to;
      const slide = objectSlides[pair.objectId] ?? '';
      const ground = group.groundBySlide?.[slide];
      if (!target || !ground) {
        const said = group.ground === 'deck' ? Boolean(fg.unresolved) : issues.some((one) => one.useId === pair.foreground && one.ground === group.ground);
        assert.ok(said, `${pair.foreground} has no target on ${group.ground} and says so`);
        continue;
      }
      assert.ok(contrastRatio(target, ground.hex) >= pair.minimum || fg.unresolved, `${pair.foreground} on ${group.ground}`);
    }
  }
});
