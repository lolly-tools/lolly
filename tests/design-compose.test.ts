// SPDX-License-Identifier: MPL-2.0
/**
 * Composing Design slides from slide-master archetypes (plan 291 W6):
 * engine/src/design-compose.ts and `masterAtSize` in engine/src/slide-master.ts.
 *
 * Public: the lolly-start neutral master (`neutralSlideMaster()`) and a synthetic
 * master written here. The SUSE slides live in the brand-gated
 * tests/design-compose-suse.test.ts.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { ContentInventoryV1, DesignComposeSpecV1, SlideMasterV1 } from '../packages/core/src/index.ts';
import { composeArchetypeCatalog, composeDesignSlides, type DesignComposeContext } from '../engine/src/design-compose.ts';
import { masterAtSize, seedFrame } from '../engine/src/slide-master.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { DESIGN_TEXT_LINE_HEIGHTS } from '../engine/src/design-text-style.ts';
import { bgIsDark, contrastRatio } from '../engine/src/logo-variant.ts';

type Row = Record<string, unknown>;

/** Neutral token answers, invented for these tests. */
const COLORS: Record<string, string> = {
  'color.semantic.text': '#1a1d24',
  'color.semantic.surface': '#fafafa',
  'color.semantic.muted': '#5f6672',
};
const LOGOS = { onLight: 'test/logo/pos', onDark: 'test/logo/neg', monoOnLight: 'test/logo/pos-mono', monoOnDark: 'test/logo/neg-mono' };

const neutral = (over: Partial<DesignComposeContext> = {}): DesignComposeContext => ({
  master: neutralSlideMaster(),
  masterOrigin: 'neutral',
  resolveToken: (p) => COLORS[p],
  ...over,
});

const compose = (spec: unknown, ctx: DesignComposeContext = neutral()) => composeDesignSlides(spec as DesignComposeSpecV1, ctx);
const rowsOf = (boxes: Row[], frame: string): Row[] => boxes.filter((r) => r.frame === frame);
const byId = (boxes: Row[], id: string): Row => {
  const row = boxes.find((r) => r.id === id);
  assert.ok(row, `row ${id} is composed`);
  return row;
};

/**
 * The editor's `sizedMaster` as it stood in shells/web/src/views/free-canvas/slide-masters.ts
 * before plan 291 moved it into the engine, kept here so the move is held to the numbers
 * Design's New slide from layout has always produced.
 */
function editorSizedMaster(master: SlideMasterV1, width: number, height: number): SlideMasterV1 {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!(w > 0) || !(h > 0)) return master;
  if (w === master.size.width && h === master.size.height) return master;
  const k = Math.min(w / master.size.width, h / master.size.height);
  const px = (n: number): number => Math.max(1, Math.round(n * k));
  const scaled = <T extends { fontSize?: number } | undefined>(s: T): T => (s && typeof s.fontSize === 'number' ? { ...s, fontSize: px(s.fontSize) } : s);
  const t = master.typeScale;
  return {
    ...master,
    size: { width: w, height: h },
    typeScale: { title: px(t.title), subtitle: px(t.subtitle), body: px(t.body), caption: px(t.caption), number: px(t.number), label: px(t.label) },
    archetypes: master.archetypes.map((a) => ({ ...a, placeholders: a.placeholders.map((p) => (p.style ? { ...p, style: scaled(p.style) } : p)) })),
    furniture: master.furniture.map((f) => (f.style ? { ...f, style: scaled(f.style) } : f)),
  };
}

/** A small master of its own shape (4:3, 1000x750), with one archetype of each kind compose handles. */
function syntheticMaster(): SlideMasterV1 {
  return {
    id: 'test/slides/synthetic',
    version: '0.1.0',
    name: 'Synthetic',
    size: { width: 1000, height: 750 },
    typeScale: { title: 40, subtitle: 28, body: 20, caption: 16, number: 12, label: 12 },
    logo: { variantByBackground: true },
    furniture: [
      { id: 'mark', kind: 'logo', box: { x: 0.05, y: 0.9, w: 0.12, h: 0.06 } },
      { id: 'folio', kind: 'page-number', box: { x: 0.9, y: 0.92, w: 0.06, h: 0.04 }, style: { fontSize: 12, align: 'right' } },
      { id: 'band', kind: 'bar', box: { x: 0, y: 0, w: 1, h: 0.02 }, hex: '#336699' },
    ],
    archetypes: [
      {
        id: 'cover', name: 'Cover', background: { hex: '#202020', dark: true }, furniture: ['mark'],
        placeholders: [
          { role: 'title', kind: 'text', box: { x: 0.1, y: 0.3, w: 0.8, h: 0.2 }, style: { fontSize: 50, weight: '700', fg: '#ffffff' } },
          { role: 'subtitle', kind: 'text', box: { x: 0.1, y: 0.55, w: 0.8, h: 0.1 } },
        ],
      },
      {
        id: 'pair', name: 'Pair', background: { hex: '#ffffff' }, furniture: ['band', 'mark', 'folio'], variants: { dark: 'pair-dark' },
        placeholders: [
          { role: 'title', kind: 'text', box: { x: 0.05, y: 0.05, w: 0.9, h: 0.12 } },
          { role: 'body', kind: 'text', box: { x: 0.05, y: 0.2, w: 0.42, h: 0.65 } },
          { role: 'body', kind: 'text', box: { x: 0.53, y: 0.2, w: 0.42, h: 0.65 } },
        ],
      },
      {
        id: 'pair-dark', name: 'Pair, dark', background: { hex: '#101010', dark: true }, furniture: ['band', 'mark', 'folio'], variantOf: 'pair',
        placeholders: [
          { role: 'title', kind: 'text', box: { x: 0.05, y: 0.05, w: 0.9, h: 0.12 }, style: { fg: '#ffffff' } },
          { role: 'body', kind: 'text', box: { x: 0.05, y: 0.2, w: 0.42, h: 0.65 }, style: { fg: '#ffffff' } },
          { role: 'body', kind: 'text', box: { x: 0.53, y: 0.2, w: 0.42, h: 0.65 }, style: { fg: '#ffffff' } },
        ],
      },
      {
        id: 'content', name: 'Content', background: { hex: '#ffffff' }, furniture: ['folio'],
        placeholders: [
          { role: 'title', kind: 'text', box: { x: 0.05, y: 0.05, w: 0.9, h: 0.12 } },
          { role: 'body', kind: 'text', box: { x: 0.05, y: 0.2, w: 0.9, h: 0.65 } },
        ],
      },
    ],
  } as SlideMasterV1;
}

/** A three-slide inventory with invented words, a picture, notes and a table. */
function inventory(): ContentInventoryV1 {
  const text = (objectId: string, role: string, lines: string[], bold = false) => ({
    objectId, role, class: 'body', box: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
    paragraphs: lines.map((line) => ({ runs: [{ text: line, ...(bold ? { bold: true } : {}) }] })),
    plain: lines.join('\n'),
  });
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'invented.pptx', sha256: 'c'.repeat(64), bytes: 1000, kind: 'pptx', slides: 3, width: 960, height: 540 },
    slides: [
      {
        number: 1, id: 'slide1',
        text: [text('o1', 'title', ['Harbour lights at dusk'], true), text('o2', 'body', ['Maren Holt', 'Lighthouse keeper'])],
        notes: { text: 'Open with the tide table.\nThen the story.', paragraphs: [{ lines: ['Open with the tide table.', 'Then the story.'] }] },
        pictures: [{ objectId: 'p1', ref: 'media/image1.png', sha256: 'd'.repeat(64), mime: 'image/png', bytes: 10, width: 1600, height: 900, box: { x: 0, y: 0, width: 1, height: 1 }, kind: 'photo', class: 'content' }],
        tables: [], charts: [], objects: [],
      },
      {
        number: 2, id: 'slide2',
        text: [text('o3', 'title', ['Three tides'], false), text('o4', 'body', ['Spring tide', 'Neap tide', 'King tide'])],
        notes: null, pictures: [], tables: [], charts: [], objects: [],
      },
      {
        number: 3, id: 'slide3', text: [], notes: null, pictures: [],
        tables: [{ objectId: 't1', rows: [['Ebb', 'Flood']] }], charts: [], objects: [],
      },
    ],
    media: [],
    warnings: [],
  } as unknown as ContentInventoryV1;
}

// ─── masterAtSize ────────────────────────────────────────────────────────────

test('masterAtSize scales the type scale and every style size by the smaller axis, in whole px', () => {
  const master = neutralSlideMaster();
  assert.equal(masterAtSize(master, { width: 1280, height: 720 }), master, 'the master size returns the master itself');
  assert.equal(masterAtSize(master, { width: 0, height: 720 }), master, 'a size that is not positive returns the master');
  assert.equal(masterAtSize(master, { width: Number.NaN, height: 720 }), master);
  const big = masterAtSize(master, { width: 1920, height: 1080 });
  assert.deepEqual(big.size, { width: 1920, height: 1080 });
  assert.equal(big.typeScale.title, Math.round(master.typeScale.title * 1.5));
  assert.equal(big.typeScale.number, Math.max(1, Math.round(master.typeScale.number * 1.5)));
  // A page that only got wider keeps the type it had: the smaller axis decides.
  const wide = masterAtSize(master, { width: 2560, height: 720 });
  assert.deepEqual(wide.typeScale, master.typeScale);
  assert.equal(master.size.width, 1280, 'the input master is not changed');
});

test('masterAtSize is the editor rule: the same master the editor sized before the move, on both masters', () => {
  for (const master of [neutralSlideMaster(), syntheticMaster()]) {
    for (const [w, h] of [[1920, 1080], [1000, 500], [3840, 2160], [1279.6, 720.4], [800, 1200]] as const) {
      assert.deepEqual(masterAtSize(master, { width: w, height: h }), editorSizedMaster(master, w, h), `${master.id} at ${w}x${h}`);
    }
  }
});

// ─── frame geometry ──────────────────────────────────────────────────────────

test('a composed title sits where New slide from layout puts it at 1920x1080', () => {
  const { document } = compose({ slides: [{ archetype: 'title', slots: { title: 'Harbour lights', subtitle: 'Maren Holt' } }] });
  const editor = seedFrame(editorSizedMaster(neutralSlideMaster(), 1920, 1080), 'title', { frameId: 's01', x: 0, y: 0, resolveToken: (p) => COLORS[p] })!;
  for (const id of ['s01.title', 's01.subtitle']) {
    const seeded = editor.layers.find((l) => l.id === id)!;
    const composed = byId(document.boxes, id);
    for (const key of ['x', 'y', 'w', 'h', 'fontSize', 'weight', 'align', 'valign', 'fg']) {
      assert.equal(composed[key], seeded[key], `${id}.${key} matches the editor's seed`);
    }
  }
  const title = byId(document.boxes, 's01.title');
  assert.deepEqual([title.x, title.y, title.w, title.h, title.fontSize], [65, 238, 1389, 431, 104], 'the 1920 numbers the plan measured');
  assert.equal(document.__export_width, '1920');
  assert.equal(document.__export_height, '1080');
  assert.equal(document.__export_unit, 'px');
});

test('frames sit four to a row with the gap between them, in slide order, and order counts the deck', () => {
  const slides = Array.from({ length: 6 }, (_, i) => ({ archetype: 'content', slots: { title: `Slide ${i + 1}`, body: 'Words' } }));
  const { document } = compose({ slides, gap: 100, size: { width: 1000, height: 500 } });
  const frames = document.boxes.filter((r) => r.kind === 'frame');
  assert.deepEqual(frames.map((f) => f.id), ['s01', 's02', 's03', 's04', 's05', 's06']);
  assert.deepEqual(frames.map((f) => [f.x, f.y]), [[0, 0], [1100, 0], [2200, 0], [3300, 0], [0, 600], [1100, 600]]);
  assert.deepEqual(frames.map((f) => f.order), [0, 1, 2, 3, 4, 5]);
  assert.ok(frames.every((f) => f.w === 1000 && f.h === 500));
  // Children follow their own frame, so the document reads slide by slide.
  let current = '';
  for (const row of document.boxes) {
    if (row.kind === 'frame') current = String(row.id);
    else assert.equal(row.frame, current, `${String(row.id)} follows its own frame`);
  }
});

// ─── slots ───────────────────────────────────────────────────────────────────

test('every slot left unfilled is dropped and reported, and no empty placeholder remains', () => {
  const { document, report } = compose({
    slides: [
      { archetype: 'closing-thanks', slots: { title: 'Thank you', subtitle: null } },
      { archetype: 'two-column', slots: { title: 'Two sides', 'body#2': 'Right only', body: '' } },
      { archetype: 'cards-3', cells: [{ visual: 'photo:one', body: 'First' }] },
    ],
  });
  assert.deepEqual(report.slides[0]!.filled, ['title']);
  assert.deepEqual(report.slides[0]!.dropped, ['subtitle', 'caption']);
  assert.deepEqual(report.slides[1]!.filled, ['title', 'body#2']);
  assert.deepEqual(report.slides[1]!.dropped, ['body']);
  assert.ok(byId(document.boxes, 's02.body-2'), 'the second body keeps its seeded id, so its slot ordinal holds');
  assert.equal(document.boxes.some((r) => r.id === 's02.body'), false);
  const cards = report.slides[2]!;
  assert.deepEqual(cards.filled, ['visual', 'body']);
  assert.ok(cards.dropped.includes('label') && cards.dropped.includes('visual#2') && cards.dropped.includes('title'));
  for (const row of document.boxes) {
    if (row.role === undefined) continue;
    if (row.kind === 'image') assert.ok(typeof row.image === 'string' && row.image, `${String(row.id)} has a picture`);
    else assert.ok(typeof row.text === 'string' && row.text, `${String(row.id)} has words`);
  }
});

test('text rows take pad 0 and their role line height; furniture is locked', () => {
  const { document } = compose({ footer: 'Tide tables', slides: [{ archetype: 'content', slots: { title: 'Tides', body: 'Twice a day.' } }] }, neutral({ logos: LOGOS }));
  const title = byId(document.boxes, 's01.title');
  const body = byId(document.boxes, 's01.body');
  assert.equal(title.pad, 0);
  assert.equal(title.lineHeight, DESIGN_TEXT_LINE_HEIGHTS.title);
  assert.equal(body.pad, 0);
  assert.equal(body.lineHeight, DESIGN_TEXT_LINE_HEIGHTS.body);
  const furniture = rowsOf(document.boxes, 's01').filter((r) => r.furniture);
  assert.ok(furniture.length >= 3, 'footer, logo and page number are drawn');
  for (const row of furniture) {
    assert.equal(row.locked, true, `${String(row.furniture)} is locked`);
    if (row.kind === 'text') assert.equal(row.pad, 0);
  }
  for (const row of document.boxes) assert.equal(row.z, undefined, 'compose never writes z');
});

test('slot objects: overrides are slide-local and win over the style, and $style resolves through the spec styles', () => {
  const { document } = compose({
    $styles: { headline: { fontSize: 90, weight: '600', align: 'center' } },
    slides: [
      { archetype: 'content', slots: { title: 'Lead' } },
      { archetype: 'content', slots: { title: { text: 'Moved', x: 100, y: 50, w: 900, $style: 'headline', align: 'right', fg: '#123456' }, body: { text: 'Calm', $style: { italic: true } } } },
    ],
  });
  const title = byId(document.boxes, 's02.title');
  assert.equal(title.x, 2080 + 100, 'x is relative to the slide');
  assert.equal(title.y, 50);
  assert.equal(title.w, 900);
  assert.equal(title.fontSize, 90, 'the named style sets the size');
  assert.equal(title.weight, '600');
  assert.equal(title.align, 'right', 'the explicit field wins over the style');
  assert.equal(title.fg, '#123456');
  assert.equal(title.role, 'title', 'the binding stays');
  assert.equal(byId(document.boxes, 's02.body').text, '*Calm*', 'an italic style sets the words in emphasis');
});

test('flow-cards-4-2 cells fill by role, and the cards keep their rules', () => {
  const { document, report } = compose({
    slides: [{ archetype: 'flow-cards-4-2', slots: { title: 'Four ports' }, cells: [
      { label: 'North', body: 'Cold water' }, { label: 'East', body: 'Sunrise' }, { body: 'Calm' }, { label: 'West', body: 'Storms' },
    ] }],
  });
  const slide = report.slides[0]!;
  assert.equal(slide.archetype, 'flow-cards-4-2');
  assert.deepEqual(slide.filled, ['title', 'label', 'body', 'label#2', 'body#2', 'body#3', 'label#4', 'body#4']);
  assert.deepEqual(slide.dropped, ['label#3']);
  assert.equal(byId(document.boxes, 's01.body-3').text, 'Calm');
  assert.equal(byId(document.boxes, 's01.label-4').text, 'West');
  assert.equal(slide.furniture.filter((f) => f.startsWith('flow-cards-4-2-rule-')).length, 4);
  assert.equal(byId(document.boxes, 's01').archetype, 'flow-cards-4-2');
});

test('cells refuse more cells than the archetype has, and an archetype without cells', () => {
  assert.throws(() => compose({ slides: [{ archetype: 'flow-cards-2-2', cells: [{ body: 'a' }, { body: 'b' }, { body: 'c' }] }] }),
    /^Error: \/slides\/0\/cells: archetype "flow-cards-2-2" has 2 cells and 3 were given/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', cells: [{ body: 'a' }] }] }), /\/slides\/0\/cells: archetype "content" has no cells/);
  assert.throws(() => compose({ slides: [{ archetype: 'columns-2', cells: [{ quote: 'a' }] }] }), /\/slides\/0\/cells\/0\/quote: cell 1 of "columns-2" has no "quote"/);
  assert.throws(() => compose({ slides: [{ archetype: 'columns-2', slots: { body: 'a' }, cells: [{ body: 'b' }] }] }),
    /\/slides\/0\/cells\/0\/body: this slot is also filled by \/slides\/0\/slots\/body/);
});

// ─── grounds ─────────────────────────────────────────────────────────────────

test('a dark ground takes the dark twin; an archetype with none is themed dark, or keeps its own and says so', () => {
  const { document, report } = compose({
    slides: [
      { archetype: 'agenda', ground: 'dark', slots: { title: 'Agenda', body: '1. Tides' } },
      { archetype: 'content', slots: { title: 'Light', body: 'Here' } },
      { archetype: 'big-number', ground: 'dark', slots: { number: '42%' } },
      { archetype: 'content-dark', slots: { title: 'Asked by id', body: 'Here' } },
    ],
  });
  assert.equal(report.slides[0]!.archetype, 'agenda-dark');
  assert.equal(report.slides[0]!.requested, 'agenda');
  assert.equal(report.slides[0]!.ground, 'dark');
  assert.equal(byId(document.boxes, 's01').archetype, 'agenda-dark');
  assert.equal(report.slides[1]!.archetype, 'content');
  assert.equal(report.slides[1]!.ground, 'light');
  // big-number has no twin: it is drawn from the master under the Dark theme built from these colours.
  assert.equal(report.slides[2]!.archetype, 'big-number');
  assert.equal(report.slides[2]!.ground, 'dark');
  assert.equal(byId(document.boxes, 's03').bg, COLORS['color.semantic.text']);
  assert.equal(byId(document.boxes, 's03.number').fg, COLORS['color.semantic.surface']);
  assert.ok(report.notes.some((n) => n.code === 'compose.dark.themed' && n.path === '/slides/2/archetype'));
  assert.equal(report.slides[3]!.archetype, 'content-dark');
  assert.equal(report.slides[3]!.ground, 'dark');

  // With a dark mode stated, main-point's grey ground takes the dark mode's step.
  const light = { ...COLORS, 'color.ramp.neutral.8': '#eceef2' };
  const darkMode = { 'color.semantic.text': '#f4f4f6', 'color.semantic.surface': '#15171c', 'color.semantic.muted': '#9aa0aa', 'color.ramp.neutral.8': '#2a2d35' };
  const moded = compose({ slides: [{ archetype: 'main-point', ground: 'dark', slots: { title: 'Grey ground', subtitle: null } }] },
    neutral({ resolveToken: (p) => light[p as keyof typeof light], themeColors: { colors: light, darkColors: darkMode } }));
  assert.equal(moded.report.slides[0]!.ground, 'dark');
  assert.equal(byId(moded.document.boxes, 's01').bg, '#2a2d35');
  assert.equal(byId(moded.document.boxes, 's01.title').fg, '#f4f4f6');
  assert.ok(moded.report.notes.some((n) => n.code === 'compose.dark.themed'));

  // The Dark built from a few colours and no dark mode grounds on the grey ramp step, which is
  // light: main-point stays light, and the report says so.
  const none = compose({ slides: [{ archetype: 'main-point', ground: 'dark', slots: { title: 'Grey ground', subtitle: null } }] },
    neutral({ resolveToken: (p) => light[p as keyof typeof light] }));
  assert.equal(none.report.slides[0]!.ground, 'light');
  assert.equal(byId(none.document.boxes, 's01').bg, '#eceef2');
  assert.ok(none.report.notes.some((n) => n.code === 'compose.dark.none' && n.path === '/slides/0/archetype'));

  const themed = compose({ theme: 'dark', slides: [{ archetype: 'content', slots: { title: 'All dark', body: 'x' } }, { archetype: 'content', ground: 'light', slots: { title: 'But this', body: 'x' } }] });
  assert.deepEqual(themed.report.slides.map((s) => s.archetype), ['content-dark', 'content'], 'the spec theme, and a slide ground over it');
});

test('a synthetic master: twins, furniture by kind, and its own 4:3 page', () => {
  const ctx: DesignComposeContext = { master: syntheticMaster(), masterOrigin: 'flag', resolveToken: () => undefined, logos: { onLight: 'mark/pos', onDark: 'mark/neg' } };
  const { document, report } = compose({
    size: { width: 2000, height: 1500 },
    slides: [
      { archetype: 'cover', slots: { title: 'Harbour', subtitle: 'Notes' } },
      { archetype: 'pair', ground: 'dark', slots: { title: 'Both', body: 'Left', 'body#2': 'Right' }, furniture: { omit: ['bar'] } },
      { archetype: 'content', slots: { title: 'Last', body: 'Words' }, furniture: { omit: ['mark', 'footer'] } },
    ],
  }, ctx);
  assert.equal(byId(document.boxes, 's01.title').fontSize, 100, 'the cover title scales x2');
  assert.equal(byId(document.boxes, 's01.mark').image, 'mark/neg', 'the cover is dark, so the reverse mark');
  assert.equal(report.slides[1]!.archetype, 'pair-dark');
  assert.deepEqual(report.slides[1]!.furniture, ['mark', 'folio'], 'omit by kind takes the band');
  assert.equal(byId(document.boxes, 's02.mark').image, 'mark/neg');
  assert.equal(byId(document.boxes, 's02.folio').text, '2');
  const unknown = report.notes.filter((n) => n.code === 'compose.furniture.unknown');
  assert.deepEqual(unknown.map((n) => n.path), ['/slides/2/furniture/omit', '/slides/2/furniture/omit'], 'mark and footer are not on that slide');
  assert.deepEqual(report.master, { id: 'test/slides/synthetic', version: '0.1.0', origin: 'flag' });
  assert.deepEqual(report.size, { width: 2000, height: 1500 });
});

// ─── furniture ───────────────────────────────────────────────────────────────

test('page numbers count presentation order, and pageNumbers: false leaves them off', () => {
  const slides = [
    { archetype: 'title', slots: { title: 'Cover' } },
    { archetype: 'content', slots: { title: 'One', body: 'a' } },
    { archetype: 'content', slots: { title: 'Two', body: 'b' } },
    { archetype: 'closing-thanks', slots: { title: 'End' } },
  ];
  const { document } = compose({ footer: 'Harbour notes', slides });
  const numbers = document.boxes.filter((r) => r.kind === 'text' && typeof r.furniture === 'string' && String(r.furniture).startsWith('page-number'));
  assert.deepEqual(numbers.map((r) => [r.frame, r.text]), [['s02', '2'], ['s03', '3'], ['s04', '4']], 'the cover shows none; the others count from it');
  const off = compose({ footer: 'Harbour notes', pageNumbers: false, slides });
  assert.equal(off.document.boxes.some((r) => String(r.furniture ?? '').startsWith('page-number')), false);
});

test('footers take the spec text or the slide text; with none they are left off and noted', () => {
  const { document, report } = compose({
    footer: 'Harbour notes',
    slides: [
      { archetype: 'content', slots: { title: 'A', body: 'a' } },
      { archetype: 'content', slots: { title: 'B', body: 'b' }, furniture: { footer: 'Section two' } },
    ],
  });
  assert.equal(byId(document.boxes, 's01.footer').text, 'Harbour notes');
  assert.equal(byId(document.boxes, 's02.footer').text, 'Section two');
  assert.equal(report.notes.some((n) => n.code === 'compose.footer.empty'), false);

  const none = compose({ slides: [{ archetype: 'content', slots: { title: 'A', body: 'a' } }, { archetype: 'agenda', slots: { title: 'B', body: 'b' } }] });
  assert.equal(none.document.boxes.some((r) => r.furniture === 'footer'), false);
  const note = none.report.notes.find((n) => n.code === 'compose.footer.empty');
  assert.ok(note && /s01, s02/.test(note.message));
});

test('logos: the ground picks the mark, mono asks for the mono mark, none and no marks leave it off', () => {
  const withLogos = compose({
    slides: [
      { archetype: 'content', slots: { title: 'A', body: 'a' } },
      { archetype: 'title', slots: { title: 'B' }, furniture: { logo: 'mono' } },
      { archetype: 'content', slots: { title: 'C', body: 'c' }, furniture: { logo: 'none' } },
    ],
    footer: 'x',
  }, neutral({ logos: LOGOS }));
  assert.equal(byId(withLogos.document.boxes, 's01.logo').image, LOGOS.onLight);
  assert.equal(byId(withLogos.document.boxes, 's02.logo-hero').image, LOGOS.monoOnDark);
  assert.equal(withLogos.document.boxes.some((r) => r.id === 's03.logo'), false);
  assert.equal(withLogos.report.notes.some((n) => n.code === 'compose.logo.unresolved'), false, 'none is asked for, not a failure');

  const without = compose({ footer: 'x', slides: [{ archetype: 'content', slots: { title: 'A', body: 'a' } }] });
  assert.equal(without.document.boxes.some((r) => r.furniture === 'logo'), false, 'an empty logo would warn in check');
  assert.ok(without.report.notes.some((n) => n.code === 'compose.logo.unresolved' && /no logo marks were given/.test(n.message)));
});

// ─── under and over ──────────────────────────────────────────────────────────

test('under rows paint first and over rows last, slide-local, through the authoring expansion', () => {
  const { document, report } = compose({
    slides: [
      { archetype: 'content', slots: { title: 'Lead', body: 'x' } },
      {
        archetype: 'title',
        slots: { title: 'Over the photo' },
        under: [{ kind: 'image', image: 'photo:cover', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }],
        over: [{ id: 'eyebrow', $style: 'label', text: 'CHAPTER ONE', x: 65, y: 200, w: 600, h: 40 }],
      },
    ],
  });
  const slide = rowsOf(document.boxes, 's02');
  assert.equal(slide[0]!.id, 's02.under-1', 'the photo is the first layer of the slide');
  assert.equal(slide[0]!.x, 2080, 'x is relative to the slide');
  assert.equal(slide[0]!.fit, 'cover');
  assert.equal(slide[slide.length - 1]!.id, 'eyebrow', 'the over row paints last');
  assert.equal(slide[slide.length - 1]!.x, 2080 + 65);
  assert.equal(slide[1]!.role, 'title');
  assert.equal(document.boxes.findIndex((r) => r.id === 's02') + 1, document.boxes.findIndex((r) => r.id === 's02.under-1'), 'the photo follows its frame row');
  assert.ok(report.slides[1]!.filled.includes('title'));
  for (const row of document.boxes) for (const key of Object.keys(row)) assert.ok(!key.startsWith('$'), `${String(row.id)} carries no authoring key`);
});

test('under and over rows stay on their slide and outside the master binding', () => {
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: 'a', body: 'b' }, under: [{ $in: 'elsewhere', kind: 'box', x: 0, y: 0, w: 1, h: 1 }] }] }),
    /\/slides\/0\/under\/0\/\$in: under rows belong to this slide/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: 'a', body: 'b' }, over: [{ kind: 'frame', w: 1, h: 1 }] }] }), /\/slides\/0\/over\/0:/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: 'a', body: 'b' }, over: [{ kind: 'box', furniture: 'logo' }] }] }), /\/slides\/0\/over\/0\/furniture/);
  assert.throws(() => compose({ slides: [{ archetype: 'content', slots: { title: 'a', body: 'b' }, over: [{ id: 's01.title', kind: 'box', x: 0, y: 0, w: 1, h: 1 }] }] }),
    /\/slides\/0\/over\/0\/id: layer "s01.title" already exists/);
});

// ─── the inventory ───────────────────────────────────────────────────────────

test('from copies inventory words and pictures; notes come from the source slide', () => {
  const inv = inventory();
  const { document, report, edits } = compose({
    slides: [
      { archetype: 'title', source: 1, slots: { title: { from: 'o1' }, subtitle: { from: 'o2', para: 0 } }, under: [{ kind: 'image', image: 'user/media/' + 'd'.repeat(64), x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }] },
      { archetype: 'full-image', source: 1, notes: null, slots: { visual: { from: 'p1' }, caption: { from: 'o2', para: 1 } } },
      { archetype: 'agenda', source: 2, slots: { title: { from: 'o3' }, body: '- Spring tide\n- Neap tide' } },
    ],
  }, neutral({ inventory: inv }));
  assert.equal(byId(document.boxes, 's01.title').text, 'Harbour lights at dusk', 'bold over every word is the source style, left to the slot');
  assert.equal(byId(document.boxes, 's01.subtitle').text, 'Maren Holt');
  assert.equal(byId(document.boxes, 's02.visual').image, `user/media/${'d'.repeat(64)}`);
  assert.equal(byId(document.boxes, 's02.caption').text, 'Lighthouse keeper');
  assert.equal(byId(document.boxes, 's01').notes, 'Open with the tide table.\nThen the story.', 'a slide with a source carries its notes');
  assert.equal(byId(document.boxes, 's02').notes, undefined, 'notes: null leaves them off');
  assert.deepEqual(report.slides.map((s) => s.notes), [true, false, false]);
  assert.deepEqual(edits, [{ source: 'King tide', reason: 'Left out of the composed slides.' }], 'the one source string the slides do not carry');
});

test('notes: true says so when the source slide has none; edits list a reworded string', () => {
  const { report, edits } = compose({
    slides: [{ archetype: 'agenda', source: 2, notes: true, slots: { title: 'Three tides', body: 'Spring tide\nNeap tide\nKING TIDE!' } }],
  }, neutral({ inventory: inventory() }));
  assert.ok(report.notes.some((n) => n.code === 'compose.notes.none' && n.path === '/slides/0/notes'));
  assert.deepEqual(edits.map((e) => [e.source, e.result]), [['King tide', 'KING TIDE!']]);
});

test('inventory references are refused with a pointer when they cannot resolve', () => {
  const ctx = neutral({ inventory: inventory() });
  assert.throws(() => compose({ slides: [{ archetype: 'title', slots: { title: { from: 'o1' } } }] }), /\/slides\/0\/slots\/title\/from: no inventory was given/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', slots: { title: { from: 'nope' } } }] }, ctx), /the inventory has no text or picture "nope"/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', slots: { title: { from: 'o2', para: 2 } } }] }, ctx), /\/para: "o2" has 2 paragraphs \(0 to 1\)/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', slots: { title: { from: 'p1' } } }] }, ctx), /"p1" is a picture and slot "title" holds text/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', slots: { title: { from: 't1' } } }] }, ctx), /"t1" is a table/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', source: 4, slots: { title: 'x' } }] }, ctx), /\/slides\/0\/source: the inventory has 3 slides/);
  assert.throws(() => compose({ slides: [{ archetype: 'title', notes: true, slots: { title: 'x' } }] }), /\/slides\/0\/notes: notes: true copies/);
});

// ─── refusals ────────────────────────────────────────────────────────────────

test('an unknown archetype is refused with the closest ids', () => {
  assert.throws(() => compose({ slides: [{ archetype: 'agenda-numberd' }] }), (err: Error) => {
    assert.match(err.message, /^\/slides\/0\/archetype: master lolly\/slides\/neutral has no archetype "agenda-numberd"; the closest are agenda-numbered/);
    return true;
  });
  assert.throws(() => compose({ slides: [{ archetype: 'flow-cards-13-4' }] }), /\/slides\/0\/archetype: .*no archetype "flow-cards-13-4"/);
});

test('malformed specs are refused at the key at fault', () => {
  const cases: Array<[unknown, RegExp]> = [
    [null, /^\/: a compose spec/],
    [{ slides: [] }, /^\/slides: a compose spec needs at least one slide/],
    [{ slides: [{ archetype: 'title' }], colour: 'red' }, /^\/colour: unknown spec key/],
    [{ slides: [{ archetype: 'title', titel: 'x' }] }, /^\/slides\/0\/titel: unknown slide key/],
    [{ slides: [{ archetype: 'title', slots: { heading: 'x' } }] }, /^\/slides\/0\/slots\/heading: archetype "title" has no slot "heading" \(its slots: title, subtitle\)/],
    [{ slides: [{ archetype: 'title', slots: { title: { text: 'x', role: 'body' } } }] }, /^\/slides\/0\/slots\/title\/role: "role" belongs to the master binding/],
    [{ slides: [{ archetype: 'title', slots: { title: { text: 'x', $in: 's01' } } }] }, /^\/slides\/0\/slots\/title\/\$in: unknown key/],
    [{ slides: [{ archetype: 'title', slots: { title: { text: 'x', image: 'y' } } }] }, /give one of text, image or from/],
    [{ slides: [{ archetype: 'full-image', slots: { visual: { text: 'x' } } }] }, /\/visual\/text: slot "visual" holds a picture/],
    [{ slides: [{ archetype: 'title', slots: { title: { fg: '#000000' } } }] }, /\/title: give text, image or from/],
    [{ slides: [{ archetype: 'title', slots: { title: { text: 'x', $style: 'nope' } } }] }, /\/title\/\$style: text style "nope" does not exist/],
    [{ slides: [{ archetype: 'title' }, { archetype: 'title', id: 's01' }] }, /^\/slides\/1\/id: artboard "s01" is used by an earlier slide/],
    [{ slides: [{ archetype: 'title', ground: 'dim' }] }, /^\/slides\/0\/ground: expected "light" or "dark"/],
    [{ size: { width: 0, height: 10 }, slides: [{ archetype: 'title' }] }, /^\/size\/width:/],
    [{ slides: [{ archetype: 'title', furniture: { logo: 'big' } }] }, /^\/slides\/0\/furniture\/logo:/],
    [{ $styles: { bad: { fontSize: 'big' } }, slides: [{ archetype: 'title' }] }, /^\/\$styles\/bad\/fontSize:/],
  ];
  for (const [spec, pattern] of cases) assert.throws(() => compose(spec), (err: Error) => {
    assert.match(err.message, pattern);
    return true;
  });
});

test('composing is deterministic and leaves its inputs as they were', () => {
  const spec = {
    footer: 'Harbour notes',
    slides: [
      { archetype: 'title', slots: { title: 'A' }, under: [{ kind: 'box', bg: '#000000', x: 0, y: 0, w: 10, h: 10 }] },
      { archetype: 'flow-columns-3-3', cells: [{ body: 'a' }, { body: 'b' }, { body: 'c' }] },
    ],
  };
  const before = JSON.stringify(spec);
  const master = neutralSlideMaster();
  const masterBefore = JSON.stringify(master);
  const a = compose(spec, neutral({ master }));
  const b = compose(spec, neutral({ master }));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(spec), before);
  assert.equal(JSON.stringify(master), masterBefore);
});

// ─── the catalogue ───────────────────────────────────────────────────────────

test('the catalogue lists light archetypes with their twin, slots by key, cells and keywords', () => {
  const master = neutralSlideMaster();
  const catalog = composeArchetypeCatalog(master);
  const ids = catalog.map((a) => a.id);
  assert.ok(!ids.some((id) => id.endsWith('-dark')), 'twins are reached through dark');
  assert.ok(ids.includes('title') && ids.includes('content'));
  const content = catalog.find((a) => a.id === 'content')!;
  assert.equal(content.dark, 'content-dark');
  assert.equal(content.ground, 'light');
  assert.deepEqual(content.slots.map((s) => s.key), ['title', 'body']);
  const two = catalog.find((a) => a.id === 'two-column')!;
  assert.deepEqual(two.slots.map((s) => s.key), ['title', 'body', 'body#2']);
  const numbered = catalog.find((a) => a.id === 'agenda-numbered')!;
  assert.equal(numbered.cells, 5);
  const title = catalog.find((a) => a.id === 'title')!;
  assert.equal(title.ground, 'dark');
  assert.equal(title.dark, undefined);
  assert.ok(typeof content.useWhen === 'string' && content.useWhen.length > 0);
  // Boxes are px at the size of the master given, so a sized master gives target geometry.
  const big = composeArchetypeCatalog(masterAtSize(master, { width: 1920, height: 1080 })).find((a) => a.id === 'title')!;
  const { document } = compose({ slides: [{ archetype: 'title', slots: { title: 'x' } }] });
  const row = byId(document.boxes, 's01.title');
  assert.deepEqual(big.slots[0]!.box, { x: row.x, y: row.y, w: row.w, h: row.h });
  // Every key the catalogue lists fills.
  for (const entry of catalog) {
    const slots = Object.fromEntries(entry.slots.map((s) => [s.key, s.kind === 'image' ? 'photo:x' : 'Words']));
    const r = compose({ footer: 'x', slides: [{ archetype: entry.id, slots }] });
    assert.deepEqual(r.report.slides[0]!.dropped, [], `${entry.id} fills every slot it lists`);
  }
});

// ─── plan 291 M3b: dark twins for flow layouts, ground notes, furniture ─────

test('a flow layout in a dark deck takes a twin made from the master\'s dark content slide', () => {
  const { document, report } = compose({
    theme: 'dark',
    slides: [{ archetype: 'flow-cards-3-3', slots: { title: 'Three tides' }, cells: [{ label: 'Spring', body: 'High' }, { body: 'Neap' }, { body: 'King' }] }],
  });
  assert.equal(report.slides[0]!.requested, 'flow-cards-3-3');
  assert.equal(report.slides[0]!.archetype, 'flow-cards-3-3-dark');
  assert.equal(report.slides[0]!.ground, 'dark');
  assert.equal(report.notes.some((n) => n.code === 'compose.dark.none'), false);
  const frame = byId(document.boxes, 's01');
  assert.equal(frame.archetype, 'flow-cards-3-3-dark');
  assert.equal(frame.bg, COLORS['color.semantic.text'], 'the dark content ground');
  for (const id of ['s01.title', 's01.label', 's01.body', 's01.body-2']) assert.equal(byId(document.boxes, id).fg, COLORS['color.semantic.surface'], `${id} takes the dark ink`);
  // The card rules take the dark body ink, and the furniture is the dark content slide's.
  const rules = rowsOf(document.boxes, 's01').filter((r) => String(r.furniture ?? '').startsWith('flow-cards-3-3-dark-rule-'));
  assert.equal(rules.length, 3);
  for (const rule of rules) assert.equal(rule.bg, COLORS['color.semantic.surface']);
  assert.ok(report.slides[0]!.furniture.includes('page-number-on-dark'));
  // The same geometry as the light layout.
  const light = compose({ slides: [{ archetype: 'flow-cards-3-3', slots: { title: 'Three tides' }, cells: [{ label: 'Spring', body: 'High' }, { body: 'Neap' }, { body: 'King' }] }] });
  for (const id of ['s01.title', 's01.label', 's01.body', 's01.body-3']) {
    const a = byId(document.boxes, id);
    const b = byId(light.document.boxes, id);
    assert.deepEqual([a.x, a.y, a.w, a.h, a.fontSize], [b.x, b.y, b.w, b.h, b.fontSize], `${id} keeps the light geometry`);
  }
  assert.equal(byId(light.document.boxes, 's01').archetype, 'flow-cards-3-3');
});

test('ground light on an archetype that is dark by design is noted; on a -dark id it takes the light one', () => {
  const { report } = compose({
    slides: [
      { archetype: 'closing-thanks', ground: 'light', slots: { title: 'Thanks', subtitle: null, caption: null } },
      { archetype: 'content-dark', ground: 'light', slots: { title: 'Back to light', body: 'x' } },
      { archetype: 'title', slots: { title: 'A dark cover in a light deck says nothing' } },
    ],
  });
  assert.equal(report.slides[0]!.archetype, 'closing-thanks');
  assert.equal(report.slides[0]!.ground, 'dark');
  assert.deepEqual(report.notes.filter((n) => n.code === 'compose.ground.ignored').map((n) => n.path), ['/slides/0/ground']);
  assert.equal(report.slides[1]!.archetype, 'content');
  assert.equal(report.slides[1]!.ground, 'light');
});

test('deck furniture: omit lists add up, a slide\'s footer and logo win, pageNumbers false drops every number', () => {
  const { document, report } = compose({
    footer: 'Deck footer',
    furniture: { omit: ['page-number'], footer: 'Furniture footer', logo: 'mono' },
    slides: [
      { archetype: 'content', slots: { title: 'One', body: 'x' } },
      { archetype: 'content', slots: { title: 'Two', body: 'x' }, furniture: { omit: ['logo'], footer: 'Own footer' } },
      { archetype: 'content', slots: { title: 'Three', body: 'x' }, furniture: { logo: 'auto' } },
    ],
  }, neutral({ logos: LOGOS }));
  assert.deepEqual(report.slides.map((s) => s.furniture), [['footer', 'logo'], ['footer'], ['footer', 'logo']]);
  assert.equal(byId(document.boxes, 's01.footer').text, 'Furniture footer', 'the deck furniture footer over the spec footer');
  assert.equal(byId(document.boxes, 's02.footer').text, 'Own footer', 'the slide footer wins');
  assert.equal(byId(document.boxes, 's01.logo').image, LOGOS.monoOnLight, 'the deck logo mode');
  assert.equal(byId(document.boxes, 's03.logo').image, LOGOS.onLight, 'the slide logo mode wins');
  assert.equal(report.notes.some((n) => n.code === 'compose.furniture.unknown'), false);

  const numbered = compose({ pageNumbers: false, slides: [{ archetype: 'content', slots: { title: 'x', body: 'y' } }, { archetype: 'big-number', slots: { number: '9' } }] });
  assert.equal(numbered.document.boxes.some((r) => String(r.furniture ?? '').startsWith('page-number')), false);

  // A deck omit no slide shows is noted once, at the deck's pointer.
  const unknown = compose({ furniture: { omit: ['caption-scrim'] }, slides: [{ archetype: 'content', slots: { title: 'x', body: 'y' } }, { archetype: 'content', slots: { title: 'x', body: 'y' } }] });
  assert.deepEqual(unknown.report.notes.filter((n) => n.code === 'compose.furniture.unknown').map((n) => n.path), ['/furniture/omit']);
  assert.throws(() => compose({ furniture: { hide: [] }, slides: [{ archetype: 'content' }] }), /^Error: \/furniture\/hide: unknown furniture key/);
});

test('logo auto over a photograph covering 90% of the slide takes the on-photo mark where the master places it', () => {
  const photo = { kind: 'image', image: 'photo:sea', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' };
  const { document } = compose({
    slides: [
      { archetype: 'main-point', slots: { title: 'Over the sea', subtitle: null }, under: [photo] },
      { archetype: 'main-point', slots: { title: 'A small photo', subtitle: null }, under: [{ ...photo, w: 600, h: 400 }] },
      { archetype: 'main-point', slots: { title: 'Mono asked', subtitle: null }, under: [photo], furniture: { logo: 'mono' } },
    ],
  }, neutral({ logos: LOGOS }));
  const seeded = seedFrame(masterAtSize(neutralSlideMaster(), { width: 1920, height: 1080 }), 'main-point', { frameId: 's01', x: 0, y: 0, resolveToken: (p) => COLORS[p], logos: LOGOS });
  const placed = seeded!.layers.find((l) => l.id === 's01.logo-hero')!;
  const logo = byId(document.boxes, 's01.logo-hero');
  assert.equal(logo.image, LOGOS.monoOnDark, 'the on-photo mark');
  assert.deepEqual([logo.x, logo.y, logo.w, logo.h], [placed.x, placed.y, placed.w, placed.h], 'the master\'s logo place');
  assert.equal(byId(document.boxes, 's02.logo-hero').image, LOGOS.onLight, 'a photo under part of the slide changes nothing');
  assert.equal(byId(document.boxes, 's03.logo-hero').image, LOGOS.monoOnLight, 'logo: mono is the author\'s choice');
  // Without a mono mark, the on-dark mark.
  const two = compose({ slides: [{ archetype: 'main-point', slots: { title: 'x', subtitle: null }, under: [photo] }] }, neutral({ logos: { onLight: 'a/pos', onDark: 'a/neg' } }));
  assert.equal(byId(two.document.boxes, 's01.logo-hero').image, 'a/neg');
});

test('the neutral master page number at 1920 sits where its 1280 design puts it, scaled', () => {
  // The neutral master (the starter deck's geometry) sets the page number at 42.3% across,
  // beside the footer field, in the number size: 11 px at 1280. At 1920 that is x 813 and
  // 17 px, which is the master scaled exactly, not a rounding drift.
  const at = (width: number, height: number): Row => {
    const { document } = compose({ size: { width, height }, footer: 'Footer', slides: [{ archetype: 'content', slots: { title: 'x', body: 'y' } }] });
    return byId(document.boxes, 's01.page-number');
  };
  const small = at(1280, 720);
  const big = at(1920, 1080);
  const box = neutralSlideMaster().furniture.find((f) => f.id === 'page-number')!.box;
  assert.deepEqual([small.x, small.y, small.fontSize], [Math.round(box.x * 1280), Math.round(box.y * 720), 11]);
  assert.deepEqual([big.x, big.y, big.w, big.h, big.fontSize], [813, 990, 115, 56, 17]);
  assert.ok(Math.abs(Number(big.x) - Number(small.x) * 1.5) <= 1 && Math.abs(Number(big.y) - Number(small.y) * 1.5) <= 1, 'the 1280 place, scaled');
  assert.equal(big.fontSize, Math.round(Number(small.fontSize) * 1.5));
});

test('a slide reported dark is drawn on a dark colour: a themed ground that does not resolve keeps the light ground', () => {
  // A design system with no grey ramp: the Dark theme puts main-point on color.ramp.neutral.8,
  // which resolves to nothing here. The frame would get no bg (painted white) under the
  // theme's light ink. The slide keeps the archetype's light ground instead, with a note.
  const darkMode = { 'color.semantic.text': '#f4f4f6', 'color.semantic.surface': '#15171c', 'color.semantic.muted': '#9aa0aa' };
  for (const ctx of [neutral(), neutral({ themeColors: { colors: COLORS } }), neutral({ themeColors: { colors: COLORS, darkColors: darkMode } })]) {
    const lights = composeArchetypeCatalog(neutralSlideMaster()).filter((a) => a.ground === 'light');
    const slots = (a: (typeof lights)[number]) => Object.fromEntries(a.slots.filter((k) => k.kind !== 'image').map((k) => [k.key, 'Words']));
    const { document, report } = compose({ theme: 'dark', slides: lights.map((a) => ({ archetype: a.id, slots: slots(a) })) }, ctx);
    for (const slide of report.slides) {
      const frame = byId(document.boxes, slide.id);
      const rows = rowsOf(document.boxes, slide.id);
      // The ground under a text row: the last panel box painted under its centre, else the frame (white when it has no bg).
      const groundOf = (row: Row): string => {
        const cx = Number(row.x) + Number(row.w) / 2;
        const cy = Number(row.y) + Number(row.h) / 2;
        let ground = String(frame.bg ?? '#ffffff');
        for (const r of rows.slice(0, rows.indexOf(row))) {
          if (r.kind === 'box' && typeof r.bg === 'string' && /^#[0-9a-f]{6}$/i.test(r.bg) && cx >= Number(r.x) && cx <= Number(r.x) + Number(r.w) && cy >= Number(r.y) && cy <= Number(r.y) + Number(r.h)) ground = r.bg;
        }
        return ground;
      };
      const ink = rows.filter((r) => r.kind === 'text' && !r.furniture && typeof r.fg === 'string').map((r) => [String(r.fg), groundOf(r)] as const);
      if (slide.ground === 'dark') {
        assert.equal(typeof frame.bg, 'string', `${slide.requested} is reported dark, so its frame has a bg`);
        assert.ok(bgIsDark(String(frame.bg)), `${slide.requested} is reported dark on ${String(frame.bg)}`);
      }
      // Either way the words read on the ground they sit on.
      assert.ok(ink.length > 0, `${slide.requested} carries words`);
      for (const [fg, ground] of ink) assert.ok(contrastRatio(fg, ground) >= 3, `${slide.requested}: ${fg} on ${ground}`);
    }
    const mainPoint = report.slides.find((s) => s.requested === 'main-point')!;
    assert.equal(mainPoint.ground, 'light');
    assert.ok(report.notes.some((n) => n.code === 'compose.dark.none' && n.path === `/slides/${mainPoint.index}/archetype`));
    assert.equal(report.notes.some((n) => n.code === 'compose.dark.themed' && n.path === `/slides/${mainPoint.index}/archetype`), false);
  }
});

test('no two layers of a composed deck share an id: a later slide, an under or an over row is refused with a pointer', () => {
  const box = (over: Record<string, unknown> = {}) => ({ kind: 'box', x: 0, y: 0, w: 10, h: 10, ...over });
  const slide = (over: Record<string, unknown> = {}) => ({ archetype: 'content', slots: { title: 'a', body: 'b' }, ...over });
  // An over row that takes the id the next slide takes by default.
  assert.throws(() => compose({ slides: [slide({ over: [box({ id: 's02' })] }), slide()] }),
    /^Error: \/slides\/0\/over\/0: layer "s02" is also the id slide 2 takes by default/);
  // An under row that takes the next slide's title row id.
  assert.throws(() => compose({ slides: [slide({ under: [box({ id: 's02.title' })] }), slide()] }),
    /^Error: \/slides\/0\/under\/0: layer "s02.title" is also the id of slide 2's title row/);
  // A slide id that is an earlier slide's row id, or its automatic under row id.
  assert.throws(() => compose({ slides: [slide(), slide({ id: 's01.title' })] }),
    /^Error: \/slides\/1\/id: artboard "s01.title" is already the id of slide 1's title row/);
  assert.throws(() => compose({ slides: [slide({ under: [box()] }), slide({ id: 's01.under-1' })] }),
    /^Error: \/slides\/1\/id: artboard "s01.under-1" is already the id of an under row of slide 1 \(\/slides\/0\/under\/0\)/);
  // An earlier slide's own id over a later slide's default row id.
  assert.throws(() => compose({ slides: [slide({ id: 's02.title' }), slide()] }),
    /^Error: \/slides\/0\/id: artboard "s02.title" is also the id of slide 2's title row/);
  // An over row that takes an id an earlier slide's under row holds.
  assert.throws(() => compose({ slides: [slide({ under: [box({ id: 'shared' })] }), slide({ over: [box({ id: 'shared' })] })] }), /\/slides\/1\/over\/0/);
  // Distinct ids compose, and every id is there once.
  const { document } = compose({ slides: [slide({ under: [box()], over: [box({ id: 'tag' })] }), slide({ under: [box()] })] });
  const ids = document.boxes.map((r) => String(r.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('transition is one of Design\'s four, and gap is capped so every frame sits at a finite place', () => {
  assert.equal(compose({ transition: 'morph', slides: [{ archetype: 'content' }] }).document.transition, 'morph');
  for (const transition of ['Fade', 'wipe', '', 3]) {
    assert.throws(() => compose({ transition, slides: [{ archetype: 'content' }] }), /^Error: \/transition: expected one of slide, fade, morph, flight/);
  }
  assert.throws(() => compose({ gap: 1e308, slides: [{ archetype: 'content' }] }), /^Error: \/gap: expected a number from 0 to 100000 px/);
  const { document } = compose({ gap: 100_000, size: { width: 100_000, height: 100_000 }, slides: Array.from({ length: 6 }, () => ({ archetype: 'content' })) });
  for (const frame of document.boxes.filter((r) => r.kind === 'frame')) assert.ok(Number.isFinite(frame.x) && Number.isFinite(frame.y), JSON.stringify(frame));
});
