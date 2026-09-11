// SPDX-License-Identifier: MPL-2.0
/**
 * Unit coverage for the DesignCensus keystone (census.ts): every source adapter,
 * the merge, and - the point of the whole module - that a census reaches the
 * SHIPPED role proposer unchanged. `brand-propose.ts` is imported here on
 * purpose: it is the compatibility being asserted, not an implementation detail.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/census.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hexToOklch, oklchToHex } from '@lolly/engine';
import type { ImageCloud, CloudPoint, PenpotUsage } from '@lolly/engine';
import { proposeBrandRoles, proposeFonts } from '../brand-propose.ts';
import {
  censusHex, censusToUsage, censusFromPenpotUsage, censusFromSvgColors,
  censusFromImageCloud, censusFromPdfVectors, mergeCensus,
} from './census.ts';
import type { DesignCensus } from './census.ts';

const census = (o: Partial<DesignCensus> = {}): DesignCensus => ({
  colors: o.colors ?? [],
  gradients: o.gradients ?? [],
  fonts: o.fonts ?? [],
  ...(o.name ? { name: o.name } : {}),
  source: o.source ?? { kind: 'svg', label: 'fixture.svg' },
});

/** A cloud point at a known colour, so the hex read back out is predictable. */
function point(hex: string, n: number): CloudPoint {
  const ok = hexToOklch(hex)!;
  return { l: ok.l, c: ok.c, h: ok.h, n, hex };
}

function cloud(points: CloudPoint[]): ImageCloud {
  const sampled = points.reduce((a, p) => a + p.n, 0);
  return {
    space: 'srgb',
    points,
    sampled,
    transparent: 0,
    unique: points.length,
    uniqueCapped: false,
    coverage: { srgb: 1, p3: 0, rec2020: 0, none: 0 },
    clipped: 0,
    atRisk: 0,
    dominantHue: null,
    meanChroma: 0.1,
  };
}

// ── censusHex ────────────────────────────────────────────────────────────────

test('censusHex: every notation lands on one #RRGGBB spelling', () => {
  assert.equal(censusHex('#f60'), '#FF6600');
  assert.equal(censusHex('#ff6600'), '#FF6600');
  assert.equal(censusHex('rgb(255, 102, 0)'), '#FF6600');
  assert.equal(censusHex('red'), '#FF0000');
  assert.equal(censusHex('#FF660080'), '#FF6600', 'alpha dropped: one colour, two opacities');
  assert.equal(censusHex('transparent'), null, 'nothing was painted');
  assert.equal(censusHex('url(#grad)'), null);
  assert.equal(censusHex('not-a-colour'), null);
});

// ── censusToUsage ────────────────────────────────────────────────────────────

test('censusToUsage: each kind lands in its own paint bucket, unqualified counts as fill', () => {
  const usage = censusToUsage(census({
    colors: [
      { hex: '#FFFFFF', weight: 40, kind: 'fill' },
      { hex: '#111111', weight: 12, kind: 'text' },
      { hex: '#FF6600', weight: 5, kind: 'stroke' },
      { hex: '#0066FF', weight: 3, kind: 'gradient' },
      { hex: '#00AA55', weight: 7 },
    ],
  }));
  const row = (hex: string) => usage.colors.find(c => c.hex === hex)!;
  assert.equal(row('#FFFFFF').fills, 40);
  assert.equal(row('#111111').textRuns, 12);
  assert.equal(row('#FF6600').strokes, 5);
  assert.equal(row('#0066FF').gradientStops, 3);
  assert.equal(row('#00AA55').fills, 7, 'no kind → painted area');
  for (const c of usage.colors) {
    assert.equal(c.total, c.fills + c.strokes + c.textRuns + c.gradientStops);
  }
});

test('censusToUsage: one colour spelled two ways, used two ways, is one row', () => {
  const usage = censusToUsage(census({
    colors: [
      { hex: '#ff6600', weight: 4, kind: 'fill' },
      { hex: 'rgb(255,102,0)', weight: 6, kind: 'text' },
    ],
  }));
  assert.equal(usage.colors.length, 1);
  assert.deepEqual(usage.colors[0], {
    hex: '#FF6600', fills: 4, strokes: 0, textRuns: 6, gradientStops: 0, total: 10,
  });
});

test('censusToUsage: colours come back heaviest-first, unreadable ones dropped', () => {
  const usage = censusToUsage(census({
    colors: [
      { hex: '#0066FF', weight: 2 },
      { hex: '#FFFFFF', weight: 90 },
      { hex: 'currentColor', weight: 500 },
      { hex: '#FF6600', weight: 30 },
    ],
  }));
  assert.deepEqual(usage.colors.map(c => c.hex), ['#FFFFFF', '#FF6600', '#0066FF']);
});

test('censusToUsage: gradients keep their stop colours, spaced evenly; singletons dropped', () => {
  const usage = censusToUsage(census({
    gradients: [
      { stops: ['#151035', '#312470', '#F23AE5'], angle: 180.4, weight: 9 },
      { stops: ['#FF6600'], weight: 99 },
      { stops: ['red', 'blue'], weight: 12 },
    ],
  }));
  assert.equal(usage.gradients.length, 2);
  assert.equal(usage.gradients[0]!.count, 12, 'heaviest first');
  assert.deepEqual(usage.gradients[0]!.stops.map(s => s.color), ['#FF0000', '#0000FF']);
  assert.deepEqual(usage.gradients[0]!.stops.map(s => s.offset), [0, 1]);
  const three = usage.gradients[1]!;
  assert.equal(three.type, 'linear');
  assert.equal(three.angle, 180);
  assert.deepEqual(three.stops.map(s => s.offset), [0, 0.5, 1]);
});

test('censusToUsage: gradients never invent colour rows', () => {
  const usage = censusToUsage(census({
    colors: [{ hex: '#FFFFFF', weight: 10 }],
    gradients: [{ stops: ['#FF6600', '#0066FF'], weight: 50 }],
  }));
  assert.deepEqual(usage.colors.map(c => c.hex), ['#FFFFFF'],
    'a stop is not a claim that the colour was painted on its own');
});

test('censusToUsage: fonts carry runs and no fetchable source', () => {
  const usage = censusToUsage(census({
    fonts: [
      { family: 'Inter', weight: 700, italic: false, usage: 'heading', count: 12 },
      { family: 'Inter', weight: 400, italic: true, usage: 'body', count: 30 },
      { family: 'IBM Plex Mono', usage: 'mono', count: 4 },
    ],
  }));
  assert.deepEqual(usage.fonts.map(f => [f.fontFamily, f.fontWeight, f.fontStyle, f.fontVariantId, f.runs]), [
    ['Inter', 700, 'normal', '700', 12],
    ['Inter', 400, 'italic', '400italic', 30],
    ['IBM Plex Mono', 400, 'normal', '400', 4],
  ]);

  const proposal = proposeFonts(usage);
  assert.equal(proposal.brand, 'Inter', 'runs aggregate per family: 42 beats 4');
  assert.equal(proposal.mono, 'IBM Plex Mono');
  assert.deepEqual(proposal.google, [], 'a census never claims a source it has not checked');
  assert.deepEqual(proposal.missing, ['Inter', 'IBM Plex Mono']);
});

// ── the round trip that matters ──────────────────────────────────────────────

test('proposeBrandRoles over a census with an obvious primary', () => {
  const roles = proposeBrandRoles(censusToUsage(census({
    name: 'Fixture',
    colors: [
      { hex: '#FFFFFF', weight: 520, kind: 'fill' },     // the ground
      { hex: '#FF6600', weight: 120, kind: 'fill' },     // the obvious primary
      { hex: '#0066FF', weight: 40, kind: 'fill' },      // an accent a hue away
      { hex: '#111111', weight: 80, kind: 'text' },      // the copy
      { hex: '#F2F2F2', weight: 30, kind: 'gradient' },  // a surface shade
    ],
    gradients: [{ stops: ['#FFFFFF', '#F2F2F2'], weight: 30 }],
    source: { kind: 'pdf', label: 'guidelines.pdf' },
  })))!;

  assert.equal(roles.surface, '#FFFFFF');
  assert.equal(roles.surfaceLook, 'light');
  assert.equal(roles.primary, '#FF6600');
  assert.equal(roles.secondary, '#0066FF');
  assert.equal(roles.text, '#111111', 'the observed text colour clears the contrast floor');
  assert.ok(!roles.extras.includes('#F2F2F2'), 'the surface shade never reaches the accent pool');
});

test('proposeBrandRoles: null on a census with no readable colours', () => {
  assert.equal(proposeBrandRoles(censusToUsage(census())), null);
  assert.equal(proposeBrandRoles(censusToUsage(census({
    colors: [{ hex: 'inherit', weight: 4 }],
  }))), null);
});

// ── Penpot round trip ────────────────────────────────────────────────────────

test('censusFromPenpotUsage → censusToUsage preserves the proposal', () => {
  // The keynote quartet in miniature: a dark surface, its gradient shade whose
  // raw score would beat the real secondary, and two accents.
  const usage: PenpotUsage = {
    colors: [
      { hex: '#151035', fills: 1066, strokes: 0, textRuns: 0, gradientStops: 0, total: 1066 },
      { hex: '#F23AE5', fills: 95, strokes: 0, textRuns: 0, gradientStops: 0, total: 95 },
      { hex: '#312470', fills: 0, strokes: 0, textRuns: 0, gradientStops: 76, total: 76 },
      { hex: '#14CECA', fills: 50, strokes: 7, textRuns: 0, gradientStops: 0, total: 57 },
      { hex: '#FFFFFF', fills: 0, strokes: 0, textRuns: 40, gradientStops: 0, total: 40 },
    ],
    gradients: [{
      type: 'linear',
      stops: [{ color: '#151035', offset: 0, opacity: 1 }, { color: '#312470', offset: 1, opacity: 1 }],
      count: 76,
      angle: 180,
    }],
    fonts: [
      { fontId: 'gfont-inter', fontFamily: 'Inter', fontVariantId: '400', fontWeight: 400, fontStyle: 'normal', runs: 22 },
      { fontId: 'sourcemono', fontFamily: 'Source Code Mono', fontVariantId: '400', fontWeight: 400, fontStyle: 'normal', runs: 3 },
    ],
  };

  const c = censusFromPenpotUsage(usage, 'keynote.penpot');
  assert.equal(c.source.kind, 'penpot');
  assert.equal(c.source.label, 'keynote.penpot');
  assert.deepEqual(
    c.colors.filter(r => r.hex === '#14CECA'),
    [{ hex: '#14CECA', weight: 50, kind: 'fill' }, { hex: '#14CECA', weight: 7, kind: 'stroke' }],
    'each tallied bucket survives as its own row',
  );
  assert.equal(c.fonts.find(f => f.family === 'Source Code Mono')!.usage, 'mono');

  const back = censusToUsage(c);
  assert.deepEqual(back.colors, usage.colors, 'the four buckets rebuild exactly');
  assert.deepEqual(proposeBrandRoles(back), proposeBrandRoles(usage));

  const roles = proposeBrandRoles(back)!;
  assert.equal(roles.surface, '#151035');
  assert.equal(roles.primary, '#F23AE5');
  assert.equal(roles.secondary, '#14CECA', 'the shade exclusion survived the trip');
  assert.equal(roles.text, '#FFFFFF');
});

// ── source adapters ──────────────────────────────────────────────────────────

test('censusFromSvgColors: first-seen order, one row per colour, ink split from ground', () => {
  const c = censusFromSvgColors(
    ['#0C322C', 'rgb(48, 186, 120)', '#0c322c', 'none', 'currentColor', 'white'],
    'logo.svg',
  );
  // Weight falls with position WITHIN a bucket: the leading neutral is the
  // ground, the leading chromatic mark is the main ink.
  assert.deepEqual(c.colors, [
    { hex: '#0C322C', weight: 2, kind: 'fill' },
    { hex: '#30BA78', weight: 1, kind: 'stroke' },
    { hex: '#FFFFFF', weight: 1, kind: 'fill' },
  ]);
  assert.deepEqual(c.source, { kind: 'svg', label: 'logo.svg' });
  assert.deepEqual(c.gradients, []);
  assert.deepEqual(c.fonts, []);
});

test('censusFromSvgColors: the leading neutral proposes as the surface', () => {
  const roles = proposeBrandRoles(censusToUsage(
    censusFromSvgColors(['#FFFFFF', '#30BA78', '#0C322C'], 'logo.svg'),
  ))!;
  assert.equal(roles.surface, '#FFFFFF');
  assert.equal(roles.primary, '#30BA78');
});

// The regression this split exists for: a mark's own colour must never propose
// as the page background just because the file drew it first.
test('censusFromSvgColors: a wordmark proposes its ink as the colour, not the ground', () => {
  for (const order of [['#0057B8', '#FFFFFF'], ['#FFFFFF', '#0057B8']]) {
    const roles = proposeBrandRoles(censusToUsage(censusFromSvgColors(order, 'acme-logo.svg')))!;
    assert.equal(roles.surface, '#FFFFFF', `surface for ${order.join(' then ')}`);
    assert.equal(roles.primary, '#0057B8', `primary for ${order.join(' then ')}`);
    assert.equal(roles.surfaceLook, 'light');
  }
});

test('censusFromSvgColors: a mark with no ground of its own gets paper', () => {
  const c = censusFromSvgColors(['#FF6600', '#0057B8'], 'two-colour.svg');
  assert.deepEqual(c.colors, [
    { hex: '#FF6600', weight: 2, kind: 'stroke' },
    { hex: '#0057B8', weight: 1, kind: 'stroke' },
    { hex: '#FFFFFF', weight: 1, kind: 'fill' },
  ]);
  const roles = proposeBrandRoles(censusToUsage(c))!;
  assert.equal(roles.surface, '#FFFFFF');
  assert.equal(roles.primary, '#FF6600', 'the leading ink');
  assert.equal(roles.secondary, '#0057B8');
});

test('censusFromSvgColors: nothing readable stays an empty census, paper included', () => {
  const c = censusFromSvgColors(['none', 'currentColor', 'url(#grad)'], 'blank.svg');
  assert.deepEqual(c.colors, [], 'no ink means no artwork to imply a ground for');
  assert.equal(proposeBrandRoles(censusToUsage(c)), null);
});

test('censusFromImageCloud: bucket counts are the weights, points read back through OKLCH', () => {
  const c = censusFromImageCloud(cloud([
    point('#FFFFFF', 8000),
    point('#30BA78', 900),
    point('#0C322C', 120),
  ]), 'screenshot.png');
  assert.deepEqual(c.colors.map(r => [r.hex, r.weight, r.kind]), [
    ['#FFFFFF', 8000, 'fill'],
    ['#30BA78', 900, 'fill'],
    ['#0C322C', 120, 'fill'],
  ]);
  assert.deepEqual(c.source, { kind: 'image', label: 'screenshot.png' });

  const roles = proposeBrandRoles(censusToUsage(c))!;
  assert.equal(roles.surface, '#FFFFFF', 'most of a screenshot is its background');
  assert.equal(roles.primary, '#30BA78');
});

test('censusFromImageCloud: buckets that map onto one hex sum', () => {
  const white = hexToOklch('#FFFFFF')!;
  // Two points either side of the sRGB boundary that gamut-map to the same byte.
  const a: CloudPoint = { l: white.l, c: 0, h: 0, n: 10, hex: '#ffffff' };
  const b: CloudPoint = { l: white.l, c: 0, h: 120, n: 5, hex: '#ffffff' };
  assert.equal(oklchToHex({ l: a.l, c: a.c, h: a.h }), oklchToHex({ l: b.l, c: b.c, h: b.h }));
  const c = censusFromImageCloud(cloud([a, b]), 'photo.jpg');
  assert.equal(c.colors.length, 1);
  assert.equal(c.colors[0]!.weight, 15);
});

test('censusFromPdfVectors: per-mark order weights, summed across marks', () => {
  const c = censusFromPdfVectors([
    { fills: ['#30BA78', '#0C322C', '#FFFFFF'] },
    { fills: ['#0C322C', '#30BA78'] },
    { fills: ['#0C322C', '#0c322c'] },
  ], 'guidelines.pdf');
  const w = (hex: string) => c.colors.find(r => r.hex === hex)!.weight;
  assert.equal(w('#30BA78'), 3 + 1);
  assert.equal(w('#0C322C'), 2 + 2 + 1, 'a mark repeating one colour still counts it once');
  assert.equal(w('#FFFFFF'), 1);
  // Marks are ink; only the neutrals read as ground the artwork sits on.
  const kind = (hex: string) => c.colors.find(r => r.hex === hex)!.kind;
  assert.equal(kind('#30BA78'), 'stroke');
  assert.equal(kind('#0C322C'), 'fill');
  assert.equal(kind('#FFFFFF'), 'fill');
  assert.deepEqual(c.source, { kind: 'pdf', label: 'guidelines.pdf' });
});

test('censusFromPdfVectors: all-chromatic artwork gets the ground it implies', () => {
  const c = censusFromPdfVectors([{ fills: ['#F23AE5', '#14CECA'] }], 'deck.pdf');
  assert.deepEqual(c.colors.map(r => [r.hex, r.kind]), [
    ['#F23AE5', 'stroke'], ['#14CECA', 'stroke'], ['#FFFFFF', 'fill'],
  ]);
  const roles = proposeBrandRoles(censusToUsage(c))!;
  assert.equal(roles.surface, '#FFFFFF');
  assert.equal(roles.primary, '#F23AE5');
});

test('censusFromPdfVectors: no marks is an empty census, not a throw', () => {
  const c = censusFromPdfVectors([], 'empty.pdf');
  assert.deepEqual(c.colors, []);
  assert.equal(proposeBrandRoles(censusToUsage(c)), null);
});

// ── merge ────────────────────────────────────────────────────────────────────

test('mergeCensus: colours dedupe on value per kind, keeping first spelling and order', () => {
  const merged = mergeCensus([
    census({
      colors: [{ hex: '#FF6600', weight: 4, kind: 'fill' }, { hex: '#111111', weight: 2, kind: 'text' }],
      source: { kind: 'pdf', label: 'guidelines.pdf' },
    }),
    census({
      colors: [
        { hex: 'rgb(255,102,0)', weight: 6, kind: 'fill' },
        { hex: '#ff6600', weight: 1, kind: 'text' },
        { hex: '#0066FF', weight: 3, kind: 'fill' },
      ],
      source: { kind: 'image', label: 'shot.png' },
    }),
  ]);
  assert.deepEqual(merged.colors, [
    { hex: '#FF6600', weight: 10, kind: 'fill' },
    { hex: '#111111', weight: 2, kind: 'text' },
    { hex: '#ff6600', weight: 1, kind: 'text' },
    { hex: '#0066FF', weight: 3, kind: 'fill' },
  ]);
  assert.deepEqual(merged.source, { kind: 'pdf', label: 'guidelines.pdf' }, 'where it started');
});

test('mergeCensus: gradients dedupe on stops and angle', () => {
  const merged = mergeCensus([
    census({ gradients: [{ stops: ['#FF6600', '#0066FF'], angle: 90, weight: 2 }] }),
    census({ gradients: [
      { stops: ['#ff6600', '#0066ff'], angle: 90, weight: 5 },
      { stops: ['#FF6600', '#0066FF'], angle: 180, weight: 1 },
    ] }),
  ]);
  assert.equal(merged.gradients.length, 2);
  assert.equal(merged.gradients[0]!.weight, 7);
  assert.equal(merged.gradients[1]!.angle, 180);
});

test('mergeCensus: fonts sum per family, weight and slant; a concrete role wins', () => {
  const merged = mergeCensus([
    census({ fonts: [
      { family: 'Inter', weight: 400, italic: false, usage: 'unknown', count: 5 },
      { family: 'Inter', weight: 700, italic: false, usage: 'heading', count: 2 },
    ] }),
    census({ fonts: [
      { family: 'inter', weight: 400, italic: false, usage: 'body', count: 6 },
      { family: 'Inter', weight: 400, italic: true, usage: 'unknown', count: 1 },
    ] }),
  ]);
  assert.deepEqual(merged.fonts, [
    { family: 'Inter', weight: 400, italic: false, usage: 'body', count: 11 },
    { family: 'Inter', weight: 700, italic: false, usage: 'heading', count: 2 },
    { family: 'Inter', weight: 400, italic: true, usage: 'unknown', count: 1 },
  ]);
});

test('mergeCensus: the first name given is the name; an empty merge reports no source', () => {
  assert.equal(mergeCensus([census(), census({ name: 'Fixture' }), census({ name: 'Other' })]).name, 'Fixture');
  const empty = mergeCensus([]);
  assert.deepEqual(empty.colors, []);
  assert.equal(empty.source.label, '');
});

test('mergeCensus: three sources propose one system', () => {
  const merged = mergeCensus([
    censusFromSvgColors(['#0C322C', '#30BA78'], 'logo.svg'),
    censusFromPdfVectors([{ fills: ['#30BA78', '#0C322C'] }], 'guidelines.pdf'),
    censusFromImageCloud(cloud([point('#FFFFFF', 4000), point('#30BA78', 300)]), 'shot.png'),
  ]);
  const roles = proposeBrandRoles(censusToUsage(merged))!;
  assert.equal(roles.surface, '#FFFFFF');
  assert.equal(roles.primary, '#30BA78');
  assert.equal(roles.surfaceLook, 'light');
});
