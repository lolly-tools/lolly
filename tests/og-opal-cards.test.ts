// SPDX-License-Identifier: MPL-2.0
/**
 * Opal's own share cards (docs/og-opal.ts): the house, tool and stage designs a pack
 * selects through its tokens. No browser: the layouts are measured with HarfBuzz against
 * the shell's own font files and the card SVG is read as text.
 *
 * The rules pinned here are the brand rules for Lolly's own compositions:
 *   1. every ground is green, never Liquorice, Reef or a yellow or cream ground;
 *   2. every text colour is legible on the ground under it (WCAG 2): 4.5:1 for titles
 *      and lines, 3:1 for kickers and addresses set at 24 px or more (large text);
 *   3. nothing stands under the lollipop or a sticker: no dish, shadow, stick or tilt;
 *   4. Outfit sets the headings, SUSE the text and SUSE Mono the labels; the rasteriser
 *      declares the same files the layout measures;
 *   5. a pitch or a line is cut from its description, is never reworded and never stops
 *      on the word "it";
 *   6. all copy stays inside its column and on the card; an address is never cut;
 *   7. only the why pages go on the stage;
 *   8. a pack's own landing card becomes the build's /og.png.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { docsCardDesign } from '../docs/og-image.ts';
import {
  GROUNDS, endsOnIt, groundAt, layoutOpalCard, loadOpalType, oneLiners, opalCardSvg,
  type OpalLayout, type TextBlock,
} from '../docs/og-opal.ts';
import { servePackShareCard } from '../shells/web/build/pack-share-card.ts';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// ── Independent colour maths (not imported, so the module is checked, not echoed) ──

const channel = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(h: string): number {
  const [r, g, b] = [0, 1, 2].map(i => linear(channel(h, i)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** OKLCH lightness, chroma and hue (degrees) of an sRGB hex. */
function oklch(h: string): { l: number; c: number; hue: number } {
  const [r, g, b] = [0, 1, 2].map(i => linear(channel(h, i))) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), hue: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360 };
}

// ── The cards: every lolly-demo tool, the views, the landing card and the docs pages ──

interface ToolEntry { id: string; name: string; description: string; icon?: string }
const TOOLS = (JSON.parse(read('brands/lolly-demo/catalog/tools/index.json')).tools as ToolEntry[]);

// The docs registry, read as text: one entry per line, with its description when set.
const REGISTRY = read('docs/build.ts');
const PAGES = [...REGISTRY.slice(REGISTRY.indexOf('const pages: Page[] = ['), REGISTRY.indexOf('// ── Door-structured URLs'))
  .matchAll(/^ {2}\{ slug: '([^']+)',\s*title: '((?:[^'\\]|\\.)+)'.*$/gm)]
  .map(m => ({
    slug: m[1]!,
    title: m[2]!.replace(/\\'/g, "'"),
    register: /register: 'stage'/.test(m[0]) ? 'stage' as const : undefined,
    description: /description: "((?:[^"\\]|\\.)*)"/.exec(m[0])?.[1] ?? /description: '((?:[^'\\]|\\.)*)'/.exec(m[0])?.[1],
    isLanding: /isLanding: true/.test(m[0]),
  }));

const VIEWS = [...read('scripts/build-view-og.ts').matchAll(/slug: '([^']+)',\s*title: '([^']+)',\s*description: '([^']+)'/g)]
  .map(m => ({ slug: m[1]!, title: m[2]!, description: m[3]! }));

interface Card { name: string; layout: OpalLayout; source?: string }

async function allCards(): Promise<Card[]> {
  const cards: Card[] = [{
    name: 'landing',
    layout: await layoutOpalCard('house', { title: 'Lolly', line: 'Free creative tools, with your rules.', url: 'lolly.tools' }),
  }];
  for (const t of TOOLS) {
    cards.push({
      name: `tool ${t.id}`, source: t.description,
      layout: await layoutOpalCard('tool', { name: t.name, description: t.description, url: `lolly.tools/t/${t.id}`, iconSvg: t.icon }),
    });
  }
  for (const v of VIEWS) {
    cards.push({
      name: `view ${v.slug}`, source: v.description,
      layout: await layoutOpalCard('house', { title: v.title, line: v.description, url: `lolly.tools/${v.slug}` }),
    });
  }
  for (const p of PAGES) {
    if (p.isLanding || !p.description) continue;
    const line = p.description;
    cards.push({
      name: `docs ${p.slug}`, source: line,
      layout: docsCardDesign(p) === 'stage'
        ? await layoutOpalCard('stage', { kicker: 'The why pages', title: p.title, line })
        : await layoutOpalCard('house', { title: p.title, line, url: 'lolly.tools' }),
    });
  }
  return cards;
}

const cardsOnce = allCards();

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The ground under a block: its corners, edge midpoints, centre and the point of the
 *  block nearest the gradient's centre, where the ground is lightest or darkest. */
function groundsUnder(layout: OpalLayout, b: TextBlock): string[] {
  const xs = [b.x, b.x + b.width / 2, b.x + b.width];
  const ys = [b.top, b.top + b.height / 2, b.top + b.height];
  const { cx, cy } = layout.ground;
  return [
    ...xs.flatMap(x => ys.map(y => groundAt(layout.ground, x, y))),
    groundAt(layout.ground, clamp(cx, b.x, b.x + b.width), clamp(cy, b.top, b.top + b.height)),
  ];
}

const LARGE_TEXT = 24;
const floorFor = (b: TextBlock) => (b.role === 'title' || b.role === 'line' || b.size < LARGE_TEXT ? 4.5 : 3);

// ── 1. green grounds ────────────────────────────────────────────────────────

const NOT_GROUNDS = {
  liquorice: '#09141a', reef: '#25c2c2', meringue: '#f9f7ef', beach: '#f2e1bf',
  honey: '#fac044', wattle: '#fdec9e', pancake: '#d8b890', basalt: '#373e44',
};

test('1. every ground is green: soft white light, then green hues only, never blue, yellow or cream', async () => {
  for (const [kind, ground] of Object.entries(GROUNDS)) {
    for (let x = 0; x <= 1200; x += 50) {
      for (let y = 0; y <= 630; y += 30) {
        const hex = groundAt(ground, x, y);
        const { l, c, hue } = oklch(hex);
        if (c < 0.02 && l > 0.95) continue; // the soft box's white light
        assert.ok(hue >= 115 && hue <= 192, `${kind} at ${x},${y} is ${hex}, hue ${hue.toFixed(1)}`);
      }
    }
  }
  // The forbidden grounds sit outside that band, so the band is the rule that keeps them out.
  for (const [name, hex] of Object.entries(NOT_GROUNDS)) {
    const { c, hue } = oklch(hex);
    assert.ok(c < 0.02 || hue < 115 || hue > 192, `${name} ${hex} would pass as green`);
  }
  for (const card of await cardsOnce) {
    const svg = opalCardSvg(card.layout, { mark: null });
    for (const [name, hex] of Object.entries(NOT_GROUNDS)) assert.doesNotMatch(svg, new RegExp(hex, 'i'), `${card.name}: ${name}`);
  }
});

// ── 2. contrast ─────────────────────────────────────────────────────────────

test('2. every text colour is legible on the ground under it', async () => {
  for (const card of await cardsOnce) {
    for (const b of card.layout.blocks) {
      const worst = Math.min(...groundsUnder(card.layout, b).map(g => ratio(b.fill, g)));
      assert.ok(worst >= floorFor(b), `${card.name} ${b.role} ${b.fill}: ${worst.toFixed(2)}:1 at ${b.size}px`);
    }
  }
});

// ── 3. no dish, shadow, stick or tilt ───────────────────────────────────────

const ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v16H4z"/></svg>';
const MARK = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E';

test('3. nothing stands under the lollipop or a sticker; neither one tilts', async () => {
  const house = opalCardSvg(await layoutOpalCard('house', { title: 'Lolly', line: 'Free creative tools, with your rules.', url: 'lolly.tools' }), { mark: MARK });
  const tool = opalCardSvg(await layoutOpalCard('tool', { name: 'QR Code', description: 'Scannable codes of every kind.', url: 'lolly.tools/t/qr-code' }), { mark: MARK, iconSvg: ICON });
  const bare = opalCardSvg(await layoutOpalCard('tool', { name: 'Flythrough', description: 'Fly a camera.', url: 'lolly.tools/t/flythrough' }), { mark: MARK });
  const stage = opalCardSvg(await layoutOpalCard('stage', { kicker: 'The why pages', title: 'Beatrice Warde', line: 'The typographer.' }), { mark: MARK });
  for (const [name, svg] of Object.entries({ house, tool, bare, stage })) {
    assert.doesNotMatch(svg, /<filter|filter=|drop-shadow|<ellipse|rotate\(|skew|matrix\(/, `${name}: no shadow, dish or tilt`);
  }
  // The house subject is the mark alone: one untransformed image and no other shape.
  assert.equal((house.match(/<image\b/g) ?? []).length, 1);
  assert.match(house, /<image x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="\1" href="data:/);
  assert.doesNotMatch(house, /<(?:path|line|circle|polyline|polygon)\b/, 'no stick or plinth under the lolly');
  // The sticker is one square tile with the tool's own glyph or, for a tool with none, the mark.
  assert.match(tool, /<rect x="195" y="253.8" width="210" height="210" rx="37.5" fill="#ffffff"\/><svg x="[\d.]+" y="[\d.]+" width="156" height="156"/);
  assert.match(bare, /<rect x="195" y="253.8" width="210" height="210" rx="37.5" fill="#ffffff"\/><image /);
  assert.equal((tool.match(/<rect\b/g) ?? []).length, 2, 'the ground and the sticker');
});

// ── 4. type ─────────────────────────────────────────────────────────────────

test('4. Outfit sets the headings, SUSE the text and SUSE Mono the labels, as the rasteriser declares them', async () => {
  const expect: Record<string, string> = {
    'house title': 'Outfit 600', 'tool title': 'Outfit 500', 'stage title': 'Outfit 200',
    'house line': 'SUSE 400', 'stage line': 'SUSE 400',
    'house url': 'SUSE Mono 500', 'tool url': 'SUSE Mono 500', 'tool kicker': 'SUSE Mono 500', 'stage kicker': 'SUSE Mono 500',
  };
  for (const card of await cardsOnce) {
    for (const b of card.layout.blocks) {
      assert.equal(`${b.face.family} ${b.face.weight}`, expect[`${card.layout.kind} ${b.role}`], `${card.name} ${b.role}`);
    }
  }
  const rasteriser = read('scripts/lib/rasterize-svg-browser.ts');
  assert.match(rasteriser, /\['Outfit', 'shells\/web\/public\/fonts\/Outfit\[wght\]\.ttf', '100 900'\]/);
  assert.match(rasteriser, /\['SUSE Mono', 'shells\/web\/public\/fonts\/SUSEMono\[wght\]\.ttf', '100 800'\]/);
  assert.match(rasteriser, /const FALLBACK_FONT = 'shells\/web\/public\/fonts\/SUSE\[wght\]\.ttf'/);
  const opal = read('docs/og-opal.ts');
  for (const file of ['Outfit[wght].ttf', 'SUSE[wght].ttf', 'SUSEMono[wght].ttf']) assert.ok(opal.includes(`'${file}'`), file);
});

// ── 5. copy is cut, never reworded ──────────────────────────────────────────

const normal = (s: string) => s.replace(/\s+/g, ' ').trim();

test('5. a pitch or a line is the start of its own description and never stops on "it"', async () => {
  for (const card of await cardsOnce) {
    for (const b of card.layout.blocks) {
      if (b.role === 'title' || b.role === 'line') assert.ok(!endsOnIt(b.lines.join(' ')), `${card.name} ${b.role}: "${b.lines.join(' ')}"`);
    }
    if (!card.source) continue;
    const b = card.layout.blocks.find(x => (card.layout.kind === 'tool' ? x.role === 'title' : x.role === 'line'))!;
    const drawn = b.lines.join(' ').replace(/…$/, '');
    assert.ok(normal(card.source).startsWith(drawn), `${card.name}: "${drawn}"`);
    assert.ok(drawn.length >= 12, `${card.name}: "${drawn}" says too little`);
  }
  // A cut that stops on "it" is never offered: the lead goes and the sentence stays.
  assert.deepEqual(oneLiners('Drop in one photo and move a camera through it: depth is read on your device.'),
    ['Drop in one photo and move a camera through it: depth is read on your device']);
  // When every cut stops on "it", the sentence stops short of the word instead.
  assert.deepEqual(oneLiners('Uploading a logo to a stranger to resize it. Artwork locked behind a plan.'),
    ['Uploading a logo to a stranger to resize…']);
  assert.ok(endsOnIt('through it') && endsOnIt('resize it.') && endsOnIt('it…') && endsOnIt('It'));
  assert.ok(!endsOnIt('submit') && !endsOnIt("it's") && !endsOnIt('a unit') && !endsOnIt('it all'));
  // The rules behind the cut.
  assert.deepEqual(oneLiners('Scannable codes of every kind: QR and more - plus barcodes. A second sentence.'),
    ['Scannable codes of every kind: QR and more - plus barcodes', 'Scannable codes of every kind']);
  assert.deepEqual(oneLiners('Render any catalog asset - or a Lolly tool link - out to any format and size.'),
    ['Render any catalog asset - or a Lolly tool link - out to any format and size'], 'an aside is not a lead');
  assert.deepEqual(oneLiners('Differential growth: a line that repels itself.'),
    ['Differential growth: a line that repels itself'], 'a two-word lead is too thin');
  assert.deepEqual(oneLiners('Turn event details into a calendar (.ics) file. Then import it.'),
    ['Turn event details into a calendar (.ics) file']);
  assert.deepEqual(oneLiners('Every tool, e.g. Chart, in one place. Pick one.', true),
    ['Every tool, e.g. Chart, in one place. Pick one.', 'Every tool, e.g. Chart, in one place']);
});

// ── 6. fit ──────────────────────────────────────────────────────────────────

test('6. all copy stays inside its column and on the card; an address is never cut', async () => {
  const m = await loadOpalType();
  for (const card of await cardsOnce) {
    let previousBottom = -Infinity;
    for (const b of card.layout.blocks) {
      if (b.role === 'url') {
        assert.equal(b.lines.length, 1, `${card.name}: one address line`);
        assert.ok(!b.lines[0]!.includes('…'), `${card.name}: the address "${b.lines[0]}" is cut`);
        assert.ok(b.size >= LARGE_TEXT || b.fill === '#033633', `${card.name}: a small address in Spearmint`);
      }
      for (const line of b.lines) {
        const w = m.width(line, b.face, b.size);
        assert.ok(w <= b.width + 0.5, `${card.name} ${b.role}: "${line}" is ${w.toFixed(1)}px in ${b.width}px`);
      }
      assert.ok(b.top >= previousBottom, `${card.name} ${b.role} overlaps the block above`);
      previousBottom = b.top + b.height;
      assert.ok(b.top >= 24 && previousBottom <= 606, `${card.name} ${b.role} leaves the card`);
      if (card.layout.kind === 'stage') assert.ok(b.top >= 300, `${card.name} ${b.role} reaches the timeline`);
      else assert.ok(b.x >= 600 && b.x + b.width <= 1128, `${card.name} ${b.role} leaves the copy column`);
    }
  }
  // The brand page's own house card keeps its sizes: Lolly at 120 px, the line at 43.2 px.
  const landing = (await cardsOnce)[0]!.layout.blocks;
  assert.deepEqual(landing.map(b => [b.role, b.size, b.lines.length]), [['title', 120, 1], ['line', 43.2, 2], ['url', 25.2, 1]]);
  // A link too long for the column gives way to its host, at 24 px or more; a host too
  // long even for that shrinks into Spearmint, which reads at small sizes.
  const address = async (url: string) => (await layoutOpalCard('house', { title: 'Lolly', line: 'A line.', url })).blocks[2]!;
  const longLink = await address('docs.example.org/a/very/long/path/that/never/fits/on/one/line/of/the/card');
  assert.deepEqual([longLink.lines, longLink.size >= LARGE_TEXT, longLink.fill], [['docs.example.org'], true, '#008657']);
  const longHost = await address('a-very-long-instance-host-name.that-belongs-to.some-organisation.example');
  assert.equal(longHost.lines[0], 'a-very-long-instance-host-name.that-belongs-to.some-organisation.example');
  assert.ok(longHost.size < LARGE_TEXT && longHost.fill === '#033633');
  // A why page keeps its whole lead on two lines rather than lose words on one.
  const giants = (await cardsOnce).find(c => c.name === 'docs shoulders-of-giants')!.layout.blocks.find(b => b.role === 'line')!;
  assert.ok(!giants.lines.join(' ').endsWith('…'), giants.lines.join(' / '));
});

// ── 7. the why pages go on the stage ────────────────────────────────────────

test('7. only the why pages go on the stage', () => {
  const stage = PAGES.filter(p => p.register === 'stage').map(p => p.slug).sort();
  assert.deepEqual(stage, [
    'ai-stance', 'beatrice-warde', 'creative-rights', 'input-not-impersonation',
    'shoulders-of-giants', 'sovereign-production', 'status-quo', 'tenets',
  ]);
  assert.equal(PAGES.filter(p => p.register === 'stage').length, (REGISTRY.match(/register: 'stage'/g) ?? []).length);
  for (const p of PAGES) assert.equal(docsCardDesign(p), p.register === 'stage' ? 'stage' : 'house', p.slug);
  assert.ok(PAGES.length > 100, `the registry parse found ${PAGES.length} pages`);
  assert.ok(VIEWS.length >= 10, `the view table parse found ${VIEWS.length} views`);
});

// ── 8. where the landing card goes ──────────────────────────────────────────

const DIST = mkdtempSync(join(tmpdir(), 'lolly-og-dist-'));
after(() => rmSync(DIST, { recursive: true, force: true }));

test('8. a pack\'s own landing card stays in its catalog and becomes the build\'s /og.png', () => {
  assert.match(read('scripts/build-og-base.ts'), /const out = chrome\.cards \? catalogFile\('og\/og\.png'\) : SHARED;/);
  // A dist/ with the pack's card in its materialised catalog: the card replaces the shared og.png.
  const withCard = join(DIST, 'with-card');
  mkdirSync(join(withCard, 'catalog/og'), { recursive: true });
  writeFileSync(join(withCard, 'og.png'), 'the shared card');
  writeFileSync(join(withCard, 'catalog/og/og.png'), 'the pack card');
  assert.equal(servePackShareCard(withCard), true);
  assert.equal(readFileSync(join(withCard, 'og.png'), 'utf8'), 'the pack card');
  // A pack without its own card keeps the shared one, untouched.
  const without = join(DIST, 'without-card');
  mkdirSync(join(without, 'catalog/og'), { recursive: true });
  writeFileSync(join(without, 'og.png'), 'the shared card');
  assert.equal(servePackShareCard(without), false);
  assert.equal(readFileSync(join(without, 'og.png'), 'utf8'), 'the shared card');
  // The web build runs the step once the catalog is in dist/.
  const vite = readFileSync(join(ROOT, 'shells/web/vite.config.js'), 'latin1');
  assert.match(vite, /import \{ servePackShareCard \} from '\.\/build\/pack-share-card\.ts';/);
  assert.match(vite, /materializeInto\(outDir\);\n(?:\s*\/\/[^\n]*\n)*\s*servePackShareCard\(outDir\);/);
});
