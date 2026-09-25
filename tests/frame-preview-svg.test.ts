// SPDX-License-Identifier: MPL-2.0
/**
 * The compiled-frame preview (plan 274 work package 5, "preview and Design share
 * one geometry").
 *
 * Two hand-built frames are drawn byte for byte, because the value of this module
 * is that the same rows the compile wrote come out at the same coordinates: a
 * snapshot is the only assertion that catches a drawing that quietly moved. A
 * later case runs a real renovate compile through it, so the two modules stay
 * agreed about what a compiled frame looks like.
 *
 * The escaping case matters on its own: a row's text, a frame's name and an
 * asset href are all document-controlled, so every one of them is checked with
 * the characters that would otherwise close a tag.
 *
 * The later cases pin what a row can ask for and get: the turn and the mirror a
 * faithful compile writes, the pill and the circle Design rounds, and the family
 * a row states, whether that is one of Design's three font slots or a family of
 * its own.
 *
 * Run with: node --test "tests/frame-preview-svg.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compileRenovated, DESIGN_LINE_HEIGHT, designTextFit } from '../engine/src/deck-compile.ts';
import { framePreviewSvg, wrapByAverageWidth } from '../engine/src/frame-preview-svg.ts';
import { encodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { runRebrandPipeline } from './helpers/rebrand-pipeline.ts';
import type {
  CompiledFrameV1,
  DesignBoxRowV1,
  RenovationPlanV1,
  SourceDeckV1,
} from '../packages/core/src/rebrand-v1.ts';
import type { SlideMasterFileV1 } from '../packages/core/src/slide-master-v1.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const href = (ref: string): string | undefined =>
  ref === 'lolly/logo/on-dark' ? 'https://example.invalid/logo.svg?a=1&b=2' : undefined;

/** A title frame with furniture, a picture, a bold title and a hidden row. */
const TITLE_FRAME: CompiledFrameV1 = {
  id: 'r.slide1',
  sourceSlideId: 'ppt/slides/slide1.xml',
  name: 'Quarterly & annual review',
  width: 400,
  height: 200,
  archetype: 'title',
  layers: [
    { id: 'r.slide1', kind: 'frame', x: 100, y: 50, w: 400, h: 200, bg: '#11201c', name: 'Quarterly & annual review' },
    { id: 'r.slide1.bar', kind: 'box', x: 100, y: 50, w: 400, h: 8, frame: 'r.slide1', bg: '#d65a28' },
    {
      id: 'r.slide1.logo', kind: 'image', x: 120, y: 70, w: 60, h: 20, frame: 'r.slide1',
      image: 'lolly/logo/on-dark', fit: 'contain',
    },
    {
      id: 'r.slide1.title', kind: 'text', x: 120, y: 110, w: 260, h: 60, frame: 'r.slide1',
      text: 'Growth <in> the "region"', fg: '#ffffff', fontSize: 20, align: 'left', valign: 'top', weight: 700,
    },
    { id: 'r.slide1.gone', kind: 'box', x: 100, y: 50, w: 20, h: 20, frame: 'r.slide1', bg: '#000000', hidden: true },
  ],
  furnitureLayerIds: ['r.slide1.bar', 'r.slide1.logo'],
  placeholderLayerIds: [],
};

/** A content frame carrying an authored placeholder pair and a picture nothing resolves. */
const PLACEHOLDER_FRAME: CompiledFrameV1 = {
  id: 'r.slide2',
  sourceSlideId: 'ppt/slides/slide2.xml',
  name: 'Market data',
  width: 400,
  height: 200,
  archetype: 'visual',
  layers: [
    { id: 'r.slide2', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff', name: 'Market data' },
    {
      id: 'r.slide2.visual', kind: 'box', x: 20, y: 40, w: 200, h: 120, frame: 'r.slide2',
      bg: '#e7e7e7', shape: 'rounded', radius: 8, name: 'Visual',
    },
    {
      id: 'r.slide2.visual.label', kind: 'text', x: 20, y: 40, w: 200, h: 120, frame: 'r.slide2',
      text: 'Chart could not be read', fg: '#555555', fontSize: 18, align: 'center', valign: 'middle',
    },
    {
      id: 'r.slide2.side', kind: 'image', x: 240, y: 40, w: 140, h: 120, frame: 'r.slide2',
      image: 'user/media/missing', fit: 'cover', alt: 'Regional map',
    },
  ],
  furnitureLayerIds: [],
  placeholderLayerIds: ['r.slide2.visual', 'r.slide2.visual.label'],
};

test('a title frame draws as the rows the compile wrote, at the frame origin', () => {
  const svg = framePreviewSvg(TITLE_FRAME, { assetHref: href, fonts: { brand: 'Outfit' } });
  assert.equal(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" role="img"'
    + ' aria-label="Quarterly &amp; annual review">'
    + '<rect x="0" y="0" width="400" height="200" fill="#11201c"/>'
    + '<rect x="0" y="0" width="400" height="8" fill="#d65a28"/>'
    + '<image x="20" y="20" width="60" height="20" href="https://example.invalid/logo.svg?a=1&amp;b=2"'
    + ' preserveAspectRatio="xMidYMid meet"/>'
    // The row states no pad, so the words sit inside Design's default inset of 8 px; it
    // states no vertical alignment, so they are centred, and the box clips them, as in Design.
    + '<svg x="20" y="60" width="260" height="60" viewBox="20 60 260 60" overflow="hidden">'
    + '<text x="28" y="85.2" font-family="Outfit" font-size="20" fill="#ffffff" text-anchor="start" font-weight="700">'
    + '<tspan x="28">Growth &lt;in&gt; the &quot;region&quot;</tspan></text></svg>'
    + '</svg>',
  );
  assert.equal(svg.includes('r.slide1.gone'), false, 'a hidden row draws nothing');
  assert.equal(svg.includes('#000000'), false);
});

/** A drawing with each inline hatch replaced by a marker, so a snapshot reads the boxes rather than the lines. */
function hatchesMarked(svg: string): string {
  return svg.replace(/<path d="(?:M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+)+" fill="none" stroke="#8a8a8a" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0.5"\/>/g, '[hatch]');
}

test('a placeholder frame draws hatched and labelled, and an unresolved picture says so', () => {
  const svg = framePreviewSvg(PLACEHOLDER_FRAME, { assetHref: href });
  assert.equal(
    hatchesMarked(svg),
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" role="img"'
    + ' aria-label="Market data">'
    + '<rect x="0" y="0" width="400" height="200" fill="#ffffff"/>'
    + '<rect x="20" y="40" width="200" height="120" fill="#e7e7e7" stroke="#8a8a8a" stroke-width="1" vector-effect="non-scaling-stroke"/>[hatch]'
    + '<svg x="20" y="40" width="200" height="120" viewBox="20 40 200 120" overflow="hidden">'
    + '<text x="120" y="95.32" font-family="system-ui, sans-serif" font-size="18" fill="#555555" text-anchor="middle">'
    + '<tspan x="120">Chart could not be</tspan><tspan x="120" dy="20.16">read</tspan></text></svg>'
    + '<rect x="240" y="40" width="140" height="120" fill="#e7e7e7" stroke="#8a8a8a" stroke-width="1" vector-effect="non-scaling-stroke"/>[hatch]'
    + '<text x="310" y="105.4" font-family="system-ui, sans-serif" font-size="18" fill="#555555" text-anchor="middle">'
    + '<tspan x="310">Regional map</tspan></text>'
    + '</svg>',
  );

  const without = framePreviewSvg(PLACEHOLDER_FRAME, { assetHref: href, showPlaceholders: false });
  assert.equal(without.includes('Chart could not be read'), false);
  assert.equal(without.includes('Regional map'), true, 'only the placeholder layers are held back');
});

test('every document-controlled string is escaped', () => {
  const frame: CompiledFrameV1 = {
    ...TITLE_FRAME,
    name: '</svg><script>bad()</script>',
    layers: [
      { id: 'x', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff', name: 'x' },
      {
        id: 'x.t', kind: 'text', x: 0, y: 0, w: 400, h: 60, frame: 'x',
        text: '</text><script>bad()</script> & \'quoted\'', fg: '#111111', fontSize: 12,
      },
      {
        id: 'x.i', kind: 'image', x: 0, y: 80, w: 100, h: 100, frame: 'x',
        image: 'lolly/logo/on-dark', fit: 'fill',
      },
    ],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
  };
  const svg = framePreviewSvg(frame, { assetHref: href });
  assert.equal(svg.includes('<script>'), false);
  assert.equal(svg.includes('</svg><script'), false);
  assert.equal(svg.includes('&lt;/text&gt;&lt;script&gt;bad()&lt;/script&gt; &amp; &apos;quoted&apos;'), true);
  assert.equal(svg.includes('aria-label="&lt;/svg&gt;&lt;script&gt;bad()&lt;/script&gt;"'), true);
  assert.equal(svg.includes('href="https://example.invalid/logo.svg?a=1&amp;b=2"'), true);
  assert.equal(svg.endsWith('</svg>'), true);
  // Nothing but the caller's own href reaches outside the document.
  assert.equal(/<(?:link|style|script|use)\b/.test(svg), false);
});

test('the wrap is greedy, keeps explicit newlines and breaks a word wider than the line', () => {
  assert.deepEqual(wrapByAverageWidth('one two three', 10, 40), ['one two', 'three']);
  assert.deepEqual(wrapByAverageWidth('a\nb', 10, 1000), ['a', 'b']);
  assert.deepEqual(wrapByAverageWidth('abcdefghij', 10, 20), ['abcd', 'efgh', 'ij']);
  assert.deepEqual(wrapByAverageWidth('', 10, 100), ['']);
});

test('the same frame draws the same bytes twice', () => {
  const once = framePreviewSvg(PLACEHOLDER_FRAME, { assetHref: href });
  const twice = framePreviewSvg(PLACEHOLDER_FRAME, { assetHref: href });
  assert.equal(once, twice);
});

// ─── a real compiled frame, drawn ────────────────────────────────────────────

test('a frame the renovate compile produced draws its content and its placeholder', () => {
  const file = JSON.parse(
    readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/slides/masters.json'), 'utf8'),
  ) as SlideMasterFileV1;
  const master = file.masters[0];
  assert.ok(master);

  const hash = `sha256:${'5'.repeat(64)}`;
  const source: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash, lineageId: 'lin', instanceId: 'inst', pageCount: 1 },
    slides: [{
      id: 'slide1',
      index: 0,
      width: 1280,
      height: 720,
      background: {},
      objects: [
        {
          id: 'o1', fingerprint: 'fp:o1', kind: 'text', box: { x: 0, y: 0, w: 600, h: 80, rot: 0 },
          origin: 'slide', fidelity: { state: 'editable' }, placeholder: 'title',
          text: { paras: [{ runs: [{ text: 'Quarterly review' }] }] },
        },
        {
          id: 'o2', fingerprint: 'fp:o2', kind: 'chart', box: { x: 0, y: 120, w: 600, h: 400, rot: 0 },
          origin: 'slide', fidelity: { state: 'unavailable', reason: 'native-chart-no-fallback' },
        },
      ],
      readingOrder: ['o1', 'o2'],
      warnings: [],
      origin: { kind: 'pptx' },
    }],
    fonts: [],
    warnings: [],
    reader: { name: 'pptx-read', version: 'test' },
  };
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'lin', hash, instanceId: 'inst' },
    revision: 1,
    designSystem: { id: 'lolly-start', tokenHash: `sha256:${'0'.repeat(64)}`, fontHashes: {}, assetHashes: {} },
    algorithms: { reader: 'test', census: 'test', plan: 'test' },
    mode: 'renovate',
    slides: [{
      id: 'slide1',
      include: true,
      layout: 'visual',
      layoutSource: 'proposed',
      objects: [
        { id: 'o1', class: 'title', evidence: [], proposal: 'keep', review: 'accepted', role: 'title' },
        { id: 'o2', class: 'chart', evidence: [], proposal: 'keep', review: 'accepted', role: 'visual' },
      ],
    }],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };

  const out = compileRenovated({
    source,
    plan,
    master,
    designSystem: {
      snapshot: plan.designSystem,
      tokens: (path: string): string | undefined => (path === 'color.semantic.surface' ? '#ffffff' : '#11201c'),
      logos: { onLight: 'lolly/logo/primary' },
    },
  });
  const frame = out.frames[0];
  assert.ok(frame);

  const svg = framePreviewSvg(frame, {
    assetHref: (ref) => (ref === 'lolly/logo/primary' ? 'data:image/svg+xml,%3Csvg%2F%3E' : undefined),
    fonts: { brand: 'Outfit' },
  });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1280" height="720"/);
  assert.equal(svg.includes('>Quarterly review</tspan>'), true);
  assert.equal(svg.includes('Chart could not be read'), true);
  assert.match(hatchesMarked(svg), /\[hatch\]/, 'the placeholder is hatched in place');
  assert.equal(svg.includes('href="data:image/svg+xml,%3Csvg%2F%3E"'), true, 'the seeded logo draws from the caller href');
  assert.equal(svg.endsWith('</svg>'), true);
});

// ─── the pose, the shapes and the family a row states ────────────────────────

/** A frame of one row, so a drawing decision can be read on its own. */
function oneRow(row: Record<string, string | number | boolean | null>): CompiledFrameV1 {
  return {
    id: 'r.one',
    sourceSlideId: 'slide1',
    name: 'One',
    width: 400,
    height: 200,
    archetype: 'content',
    layers: [
      { id: 'r.one', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff', name: 'One' },
      { frame: 'r.one', ...row },
    ],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
  };
}

test('a rotated row turns about its own centre, and a mirrored one turns over in place', () => {
  const turned = framePreviewSvg(
    oneRow({ id: 'r.one.a', kind: 'box', x: 100, y: 50, w: 200, h: 100, bg: '#d65a28', rot: 30 }),
    { assetHref: href },
  );
  assert.equal(
    turned.includes('<g transform="translate(200 100) rotate(30) translate(-200 -100)">'
      + '<rect x="100" y="50" width="200" height="100" fill="#d65a28"/></g>'),
    true,
    turned,
  );

  const mirrored = framePreviewSvg(
    oneRow({ id: 'r.one.b', kind: 'image', x: 0, y: 0, w: 100, h: 100, image: 'lolly/logo/on-dark', flipH: true }),
    { assetHref: href },
  );
  assert.equal(
    mirrored.includes('<g transform="translate(50 50) scale(-1 1) translate(-50 -50)">'),
    true,
    mirrored,
  );

  // Both at once compose the way Design composes them, and opacity rides along.
  const both = framePreviewSvg(
    oneRow({ id: 'r.one.c', kind: 'box', x: 0, y: 0, w: 100, h: 50, bg: '#111111', rot: 90, flipV: true, opacity: 50 }),
    { assetHref: href },
  );
  assert.equal(
    both.includes('<g opacity="0.5" transform="translate(50 25) rotate(90) scale(1 -1) translate(-50 -25)">'),
    true,
    both,
  );

  // A row that states no pose draws exactly as it did before, with no wrapper.
  const plain = framePreviewSvg(oneRow({ id: 'r.one.d', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: '#111111' }), {
    assetHref: href,
  });
  assert.equal(plain.includes('<g '), false);
});

test('a pill and a circle draw as Design rounds them', () => {
  const pill = framePreviewSvg(
    oneRow({ id: 'r.one.p', kind: 'box', x: 0, y: 0, w: 200, h: 40, bg: '#111111', shape: 'pill' }),
    { assetHref: href },
  );
  assert.equal(pill.includes('rx="20"'), true, pill);

  const circle = framePreviewSvg(
    oneRow({ id: 'r.one.c', kind: 'box', x: 0, y: 0, w: 80, h: 80, bg: '#111111', shape: 'circle' }),
    { assetHref: href },
  );
  assert.equal(circle.includes('<ellipse cx="40" cy="40" rx="40" ry="40"'), true, circle);
});

test('a text row draws in the family it states, slot or family', () => {
  const slot = framePreviewSvg(
    oneRow({ id: 'r.one.t', kind: 'text', x: 0, y: 0, w: 200, h: 40, text: 'Hello', font: 'display' }),
    { assetHref: href, fonts: { brand: 'Outfit', display: 'Playfair' } },
  );
  assert.equal(slot.includes('font-family="Playfair"'), true, slot);

  const family = framePreviewSvg(
    oneRow({ id: 'r.one.t', kind: 'text', x: 0, y: 0, w: 200, h: 40, text: 'Hello', font: 'Inter Tight' }),
    { assetHref: href, fonts: { brand: 'Outfit' } },
  );
  assert.equal(family.includes('font-family="Inter Tight, Outfit"'), true, family);

  // A row that states nothing takes the brand family, as it always did, and a row
  // whose family is nothing but punctuation cannot put punctuation in the drawing.
  const none = framePreviewSvg(
    oneRow({ id: 'r.one.t', kind: 'text', x: 0, y: 0, w: 200, h: 40, text: 'Hello' }),
    { assetHref: href, fonts: { brand: 'Outfit' } },
  );
  assert.equal(none.includes('font-family="Outfit"'), true);
  const odd = framePreviewSvg(
    oneRow({ id: 'r.one.t', kind: 'text', x: 0, y: 0, w: 200, h: 40, text: 'Hello', font: '"><script>' }),
    { assetHref: href, fonts: { brand: 'Outfit' } },
  );
  assert.equal(odd.includes('font-family="script, Outfit"'), true, odd);
  assert.equal(odd.includes('<script>'), false);
});

test('a picture nothing resolves is labelled from its name when the row states no alt', () => {
  const svg = framePreviewSvg(
    oneRow({ id: 'r.one.i', kind: 'image', x: 0, y: 0, w: 200, h: 100, image: 'user/media/gone', name: 'Regional map' }),
    { assetHref: href },
  );
  assert.equal(svg.includes('>Regional map</tspan>'), true, svg);
});

test('a text row sits inside its pad, as Design lays it, and the fill still covers the box', () => {
  const row = (pad: number | undefined): CompiledFrameV1 => ({
    id: 'r.pad', sourceSlideId: 's', name: 'Pad', width: 400, height: 200, archetype: 'content',
    layers: [
      { id: 'r.pad', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff' },
      {
        id: 'r.pad.body', kind: 'text', x: 100, y: 50, w: 200, h: 100, frame: 'r.pad', bg: '#eeeeee',
        text: 'Line', fg: '#111111', fontSize: 20, align: 'right', valign: 'bottom', ...(pad === undefined ? {} : { pad }),
      },
    ],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
  });
  const at = (svg: string): { x: string; y: string } => {
    const match = /<text x="([\d.]+)" y="([\d.]+)"/.exec(svg);
    assert.ok(match);
    return { x: match[1] as string, y: match[2] as string };
  };
  const none = framePreviewSvg(row(0), { assetHref: href });
  const wide = framePreviewSvg(row(20), { assetHref: href });
  const stated = framePreviewSvg(row(undefined), { assetHref: href });
  // Right and bottom aligned: the right edge moves in by the pad, the baseline up by it.
  assert.deepEqual(at(none), { x: '300', y: '144.8' });
  assert.deepEqual(at(wide), { x: '280', y: '124.8' });
  assert.deepEqual(at(stated), { x: '292', y: '136.8' }, 'no pad is Design default of 8');
  for (const svg of [none, wide, stated]) {
    assert.match(svg, /<rect x="100" y="50" width="200" height="100" fill="#eeeeee"\/>/, 'the fill is the whole box');
  }
  assert.deepEqual(at(framePreviewSvg(row(-5), { assetHref: href })), at(none), 'a negative pad is none');
});

// ─── plan 275 section 7.2 step 6: the preview reads Design's text subset ─────

test('plan 275: a row in Design text draws one tspan per run with its style, and no marker as a character', () => {
  const frame: CompiledFrameV1 = {
    id: 'r.fmt',
    sourceSlideId: 'ppt/slides/slide2.xml',
    name: 'Formatting',
    width: 800,
    height: 400,
    archetype: 'content',
    layers: [
      { id: 'r.fmt', kind: 'frame', x: 0, y: 0, w: 800, h: 400, bg: '#ffffff', name: 'Formatting' },
      {
        id: 'r.fmt.body', kind: 'text', x: 20, y: 20, w: 760, h: 360, frame: 'r.fmt', fontSize: 20, weight: '400', pad: 0,
        text: '- **Scope:** what *changes*\n  - {u|under} {s|struck} {#c00000|red}\n1. first\n2. second\nA \\*literal\\* star',
      },
    ],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
  };
  const svg = framePreviewSvg(frame, { assetHref: href });
  assert.doesNotMatch(svg, /\*\*|\{u\||\{s\||\{#c00000\|/, 'no markup is drawn');
  assert.match(svg, /<tspan x="20">• {2}<tspan font-weight="700">Scope:<\/tspan> what <tspan font-style="italic">changes<\/tspan><\/tspan>/);
  assert.match(svg, /dx="20" dy="22.4">• {2}<tspan text-decoration="underline">under<\/tspan> <tspan text-decoration="line-through">struck<\/tspan> <tspan fill="#c00000">red<\/tspan><\/tspan>/);
  assert.match(svg, />1\. {2}first<\/tspan>/);
  assert.match(svg, />2\. {2}second<\/tspan>/);
  assert.match(svg, />A \*literal\* star<\/tspan>/, 'an escaped star is drawn as a star');
  assert.match(svg, /<text [^>]*font-weight="400"/, 'the row weight stays the master\'s');
});

test('plan 275: a long styled line wraps like plain text, and the runs are cut where it wraps', () => {
  const frame: CompiledFrameV1 = {
    ...TITLE_FRAME,
    layers: [
      { id: 'r.slide1', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff' },
      { id: 'r.w', kind: 'text', x: 0, y: 0, w: 200, h: 200, frame: 'r.slide1', fontSize: 20, pad: 0, text: 'plain words then **a bold run that wraps** here' },
    ],
    furnitureLayerIds: [],
  };
  const svg = framePreviewSvg(frame, { assetHref: href });
  const lines = [...svg.matchAll(/<tspan x="0"[^>]*>(.*?)<\/tspan>(?=<tspan x=|<\/text>)/g)].map((m) => m[1]?.replace(/<[^>]+>/g, ''));
  assert.deepEqual(lines, wrapByAverageWidth('plain words then a bold run that wraps here', 20, 200));
  assert.match(svg, /then <tspan font-weight="700">a<\/tspan><\/tspan><tspan x="0" dy="22.4"><tspan font-weight="700">bold run that wraps<\/tspan>/, 'the bold run is cut at the wrap and stays bold on both lines');
});

// ─── plan 275 decision 32: a path row draws its outline ──────────────────────

test('a path row draws a path at its box, with its fill, stroke, caps and opacity', async () => {
  const { encodeAuthoredPaths } = await import('../engine/src/geom/authored-url.ts');
  // A triangle whose nodes are fractions of the row box, the form Design stores.
  const path = encodeAuthoredPaths([{ kind: 'cubic', closed: true, nodes: [
    { x: 0, y: 1, continuity: 'corner' }, { x: 0.5, y: 0, continuity: 'corner' }, { x: 1, y: 1, continuity: 'corner' },
  ] }]);
  const frame: CompiledFrameV1 = {
    id: 'r.p', sourceSlideId: 's', name: 'Paths', width: 200, height: 100, archetype: 'content', furnitureLayerIds: [], placeholderLayerIds: [],
    layers: [
      { id: 'r.p', kind: 'frame', x: 1000, y: 0, w: 200, h: 100 },
      { id: 'r.p.i0', kind: 'path', x: 1010, y: 10, w: 100, h: 50, path, bg: '#1f4e79', stroke: '#999999', strokeW: 2, strokeCap: 'butt', strokeJoin: 'miter', opacity: 30, group: 'vector:r.p' },
      { id: 'r.p.i1', kind: 'path', x: 1010, y: 10, w: 100, h: 50, path: 'not a path', bg: '#000000' },
    ],
  };
  const svg = framePreviewSvg(frame, { assetHref: href });
  assert.match(svg, /<g opacity="0\.3"><path d="M10 60[^"]*Z" fill="#1f4e79" stroke="#999999" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter"\/><\/g>/);
  assert.match(svg, /[ CL]60 10[C ]/, 'the apex sits at the middle of the top edge');
  assert.equal(svg.includes('<rect x="10" y="10" width="100" height="50"'), false, 'never a dark rectangle standing in for the outline');
  assert.equal((svg.match(/<path /g) ?? []).length, 1, 'a value that does not decode draws nothing');
});

test('a dashed box outline draws dashed, with the lengths the row states', () => {
  const dashed = framePreviewSvg(
    oneRow({ id: 'r.one.d', kind: 'box', x: 0, y: 0, w: 200, h: 40, bg: '', stroke: '#999999', strokeW: 1, strokeDash: 'dashed', strokeDashLen: 4, strokeGapLen: 2 }),
    { assetHref: href },
  );
  assert.equal(dashed.includes('stroke-dasharray="4 2"'), true, dashed);
  const solid = framePreviewSvg(
    oneRow({ id: 'r.one.s', kind: 'box', x: 0, y: 0, w: 200, h: 40, bg: '', stroke: '#999999', strokeW: 1 }),
    { assetHref: href },
  );
  assert.equal(solid.includes('stroke-dasharray'), false, solid);
});

// ─── the thumbnail rung, the empty slot and the design system's faces (close-out CP11) ──

/** A chart the source outlined: a bar, an axis line and label rows drawn as glyph shapes. */
function chartFrame(labels = 40): CompiledFrameV1 {
  // One glyph: a closed square contour, as Design's authored path value (box fractions).
  const glyphs = (n: number): string => {
    const paths = Array.from({ length: n }, (_unused, i) => {
      const x0 = i / n;
      const x1 = x0 + 0.7 / n;
      return { kind: 'line' as const, closed: true, nodes: [{ x: x0, y: 0.1 }, { x: x1, y: 0.1 }, { x: x1, y: 0.9 }, { x: x0, y: 0.9 }] };
    });
    return encodeAuthoredPaths(paths);
  };
  const layers: CompiledFrameV1['layers'] = [
    { id: 'c', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, bg: '#ffffff', name: 'Chart' },
    { id: 'c.bar', kind: 'path', x: 100, y: 200, w: 800, h: 60, frame: 'c', bg: '#999999', path: encodeAuthoredPaths([{ kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] }]) },
    { id: 'c.speck', kind: 'path', x: 1000, y: 600, w: 2, h: 2, frame: 'c', bg: '#000000', path: encodeAuthoredPaths([{ kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }] }]) },
  ];
  for (let i = 0; i < labels; i += 1) {
    layers.push({ id: `c.label${i}`, kind: 'path', x: 100, y: 300 + i * 10, w: 400, h: 14, frame: 'c', bg: '#1d1d1d', path: glyphs(30) });
  }
  return { id: 'c', sourceSlideId: 'slide1', name: 'Chart', width: 1280, height: 720, archetype: 'chart', masterId: 'm', layers, furnitureLayerIds: [], placeholderLayerIds: [] };
}

test('the thumbnail rung draws a chart\'s outlined labels as bars and leaves out what is under a pixel', () => {
  const frame = chartFrame();
  const full = framePreviewSvg(frame, { assetHref: href, fonts: { brand: 'SUSE' } });
  const thumb = framePreviewSvg(frame, { assetHref: href, fonts: { brand: 'SUSE' }, detail: 'thumbnail' });
  assert.ok(Buffer.byteLength(thumb) < 20 * 1024, `the thumbnail is ${Buffer.byteLength(thumb)} bytes`);
  assert.ok(Buffer.byteLength(full) > Buffer.byteLength(thumb) * 10, 'the outlines were most of the drawing');
  // The bar is still a shape; each label is one bar across its run; the speck is gone.
  assert.equal((thumb.match(/<path /g) ?? []).length, 1, 'the one bar of the chart');
  assert.equal((thumb.match(/<rect [^>]*opacity="0.45"\/>/g) ?? []).length, 40, 'one bar per label');
  assert.equal(thumb.includes('#000000'), false, 'a shape under a pixel at 192 px draws nothing');
  assert.equal(thumb.includes('opacity="0.5"'), false, 'a thumbnail draws no hatch lines');
  // Path coordinates are whole units at the thumbnail rung.
  const d = /<path d="([^"]+)"/.exec(thumb)?.[1] ?? '';
  assert.equal(/\d\.\d/.test(d), false, d);
});

test('the full drawing is byte for byte what it was, and `full` is the default', () => {
  for (const frame of [TITLE_FRAME, PLACEHOLDER_FRAME, chartFrame(3)]) {
    const plain = framePreviewSvg(frame, { assetHref: href });
    assert.equal(framePreviewSvg(frame, { assetHref: href, detail: 'full' }), plain);
    assert.equal(framePreviewSvg(frame, { assetHref: href, longEdge: 96 }), plain, 'a long edge alone changes nothing');
  }
  // A larger rung keeps more: at 1280 px nothing in this chart is under a pixel.
  const big = framePreviewSvg(chartFrame(1), { assetHref: href, detail: 'thumbnail', longEdge: 1280 });
  assert.equal(big.includes('#000000'), true);
});

test('a slot of the master that nothing filled draws a hatch and a 1 px edge', () => {
  const empty = oneRow({ id: 'r.one.t', kind: 'text', role: 'title', x: 20, y: 20, w: 360, h: 60, text: '' });
  const svg = framePreviewSvg(empty, { assetHref: href });
  assert.equal(
    hatchesMarked(svg).includes('<rect x="20" y="20" width="360" height="60" fill="#e7e7e7" stroke="#8a8a8a" stroke-width="1" vector-effect="non-scaling-stroke"/>[hatch]'),
    true,
    svg,
  );
  // The lines are cut to the box and drawn in place: a drawing mounted several times in
  // one document cannot lose its hatch to a pattern id another copy holds.
  assert.equal(svg.includes('url(#'), false);
  for (const [, x, y] of svg.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)) {
    assert.ok(Number(x) >= 20 && Number(x) <= 380 && Number(y) >= 20 && Number(y) <= 80, `${x},${y} inside the box`);
  }
  // A picture slot with no picture reads the same way; a filled slot does not.
  const picture = framePreviewSvg(oneRow({ id: 'r.one.p', kind: 'image', role: 'visual', x: 0, y: 0, w: 100, h: 100 }), { assetHref: href });
  assert.match(hatchesMarked(picture), /\[hatch\]/);
  const filled = framePreviewSvg(oneRow({ id: 'r.one.t', kind: 'text', role: 'title', x: 0, y: 0, w: 200, h: 40, text: 'Hello' }), { assetHref: href });
  assert.equal(filled.includes('#e7e7e7'), false);
  // A text box with a fill of its own is a card, not an empty slot.
  const card = framePreviewSvg(oneRow({ id: 'r.one.t', kind: 'text', role: 'label', x: 0, y: 0, w: 200, h: 40, text: '', bg: '#eeeeee' }), { assetHref: href });
  assert.equal(hatchesMarked(card).includes('[hatch]'), false);
  // Held back with the placeholders, and flat at the thumbnail rung.
  assert.equal(framePreviewSvg(empty, { assetHref: href, showPlaceholders: false }).includes('vector-effect'), false);
  // Left out on their own for a view that draws its own empty boxes, while an authored
  // placeholder keeps its hatch.
  assert.equal(framePreviewSvg(empty, { assetHref: href, emptySlots: false }).includes('vector-effect'), false);
  const box = oneRow({ id: 'r.one.b', kind: 'rect', x: 20, y: 20, w: 360, h: 60 });
  const authored = framePreviewSvg({ ...box, placeholderLayerIds: ['r.one.b'] }, { assetHref: href, emptySlots: false });
  assert.match(hatchesMarked(authored), /\[hatch\]/, 'a placeholder still draws');
  const flat = framePreviewSvg(empty, { assetHref: href, detail: 'thumbnail' });
  assert.equal(flat.includes('fill="#e7e7e7" stroke="#8a8a8a" stroke-width="1" vector-effect="non-scaling-stroke"'), true, flat);
  assert.equal(hatchesMarked(flat).includes('[hatch]'), false, 'flat at the thumbnail rung');
});

test('a renovated frame draws every text in the design system\'s faces, and a faithful one keeps the source\'s', () => {
  const row = { id: 'r.one.t', kind: 'text', x: 0, y: 0, w: 200, h: 40, text: 'Hello' } as const;
  const renovated = (font: string): string => framePreviewSvg(
    { ...oneRow({ ...row, font }), masterId: 'lolly-start' },
    { assetHref: href, fonts: { brand: 'SUSE', mono: 'SUSE Mono' } },
  );
  assert.equal(renovated('Calibri').includes('font-family="SUSE"'), true, 'a source family draws in the brand face');
  assert.equal(renovated('SUSE').includes('font-family="SUSE"'), true);
  assert.equal(renovated('mono').includes('font-family="SUSE Mono"'), true);
  assert.equal(renovated('suse mono').includes('font-family="SUSE Mono"'), true, 'the mono face by its own name');
  // With no mono face, code is set in the brand face too, never a face outside the system.
  const noMono = framePreviewSvg({ ...oneRow({ ...row, font: 'mono' }), masterId: 'm' }, { assetHref: href, fonts: { brand: 'SUSE' } });
  assert.equal(noMono.includes('font-family="SUSE"'), true, noMono);
  // A faithful frame names no master, so it keeps the family its row states.
  const faithful = framePreviewSvg(oneRow({ ...row, font: 'Calibri' }), { assetHref: href, fonts: { brand: 'SUSE' } });
  assert.equal(faithful.includes('font-family="Calibri, SUSE"'), true);
});

test('no font-family in a renovated preview names a face outside the design system', async () => {
  const faces = new Set(['SUSE', 'SUSE Mono']);
  for (const name of ['formatting.pptx', 'vector.pptx', 'structures.pptx', 'adversarial.pptx']) {
    const run = await runRebrandPipeline(name, new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/rebrand', name))), { applyUnreviewed: true, applyNeedsAttention: true });
    for (const frame of run.compiled.frames) {
      // An older stored compile wrote source families on its rows: the drawing still holds them to the system.
      const older: CompiledFrameV1 = { ...frame, layers: frame.layers.map((one) => (one.kind === 'text' ? { ...one, font: 'Calibri Light' } : one)) };
      for (const drawn of [frame, older]) {
        const svg = framePreviewSvg(drawn, { assetHref: () => undefined, fonts: { brand: 'SUSE', mono: 'SUSE Mono' } });
        for (const [, family] of svg.matchAll(/font-family="([^"]*)"/g)) {
          assert.ok(faces.has(family ?? ''), `${name} ${frame.id}: "${family}"`);
        }
      }
    }
  }
});

// ─── close-out CP13: the preview clips a text box the way Design does ────────

test('CP13: a text box clips its words at its edge, and designTextFit counts the words it clips', () => {
  const words = 'one two three four five six seven eight nine ten eleven twelve';
  const frameOf = (valign: string): CompiledFrameV1 => ({
    id: 'r.clip', sourceSlideId: 's', name: 'Clip', width: 400, height: 200, archetype: 'content',
    layers: [
      { id: 'r.clip', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff' },
      // Four lines at 20 px in a box three lines tall.
      { id: 'r.clip.body', kind: 'text', x: 50, y: 40, w: 150, h: 3 * 20 * DESIGN_LINE_HEIGHT, pad: 0, fontSize: 20, text: words, ...(valign ? { valign } : {}) },
    ],
    furnitureLayerIds: [],
    placeholderLayerIds: [],
  });
  const top = frameOf('top');
  const row = top.layers[1];
  assert.ok(row);
  assert.deepEqual(wrapByAverageWidth(words, 20, 150), ['one two three', 'four five six', 'seven eight', 'nine ten eleven', 'twelve']);
  const fit = designTextFit(row);
  assert.equal(fit.lines, 5);
  assert.equal(fit.shown, 3);
  assert.equal(fit.wordsCut, 4, 'the two lines under the edge hold four words');
  const svg = framePreviewSvg(top, { assetHref: href });
  assert.match(svg, /<svg x="50" y="40" width="150" height="67.2" viewBox="50 40 150 67.2" overflow="hidden"><text /, 'the words sit in a viewport the size of the box');
  // Under bottom the first lines go, and under middle, Design's default, both ends.
  assert.equal(designTextFit(frameOf('bottom').layers[1] as DesignBoxRowV1).wordsCut, 6, 'the first two lines hold six words');
  const middle = designTextFit(frameOf('').layers[1] as DesignBoxRowV1);
  assert.equal(middle.shown, 3, 'the middle three lines show');
  assert.equal(middle.wordsCut, 3 + 1, 'the first line and the last');
  // A box that holds its words cuts none.
  assert.equal(designTextFit({ ...row, h: 200 }).wordsCut, 0);
});
