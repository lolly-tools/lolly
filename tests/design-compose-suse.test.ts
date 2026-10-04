// SPDX-License-Identifier: MPL-2.0
/**
 * Composing on the SUSE master at 1920x1080 (plan 291 W6). Private: brands/suse is a
 * private submodule, so every test here skips without it (listed in
 * tests/expected-skips.json under brand:suse). The public cases are in
 * tests/design-compose.test.ts.
 *
 * Each composed slide is held to what Design's New slide from layout seeds on the
 * same master at the same size (`seedFrame` on `masterAtSize`), plus what compose adds:
 * slots filled or dropped, page numbers in deck order, furniture locked, photos under.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-suse.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { composeDesignSlides, type DesignComposeResultV1 } from '../engine/src/design-compose.ts';
import { masterAtSize, seedFrame } from '../engine/src/slide-master.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/design-system.ts';
import { readProfileBriefCatalog, readProfileTokenDocument } from '../packages/node-shell/src/design-brief.ts';
import { designBrief } from '../engine/src/design-brief.ts';
import { checkDesignHouseRules } from '../engine/src/design-house-rules.ts';
import { brandRulesOfTokenDocument, buildSurfaceVariantTable, pickSurfaceVariant } from '../engine/src/surface-variant.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import type { ContentInventoryV1, DesignComposeSpecV1 } from '../packages/core/src/index.ts';
import type { SlideMasterV1 } from '../packages/core/src/index.ts';

type Row = Record<string, unknown>;

const MASTERS = fileURLToPath(new URL('../brands/suse/catalog/assets/suse/slides/masters.json', import.meta.url));
const SKIP = existsSync(MASTERS) ? false : 'brands/suse is not checked out, so the suse profile cannot be resolved here';
const SIZE = { width: 1920, height: 1080 };

interface Suse { master: SlideMasterV1; colors: Record<string, string>; logos: Record<string, string>; composed: DesignComposeResultV1 }
let cached: Promise<Suse> | null = null;

/** The suse master, colours and logos, and one deck composed from the four archetypes under test. */
function suse(): Promise<Suse> {
  cached ??= (async () => {
    const resolved = await resolveProfileDesignSystem({ profile: 'suse' });
    assert.ok(resolved, 'the suse profile resolves');
    const { master, colors, logos } = resolved.input as unknown as { master: SlideMasterV1; colors: Record<string, string>; logos: Record<string, string> };
    const composed = composeDesignSlides({
      footer: 'Invented footer',
      slides: [
        {
          archetype: 'title', furniture: { logo: 'mono' },
          slots: { title: 'Harbour lights at dusk', subtitle: null },
          under: [{ kind: 'image', image: 'photo:cover', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }],
          notes: 'Open with the tide table.',
        },
        { archetype: 'agenda', slots: { title: 'Agenda', body: '1. Tides\n2. Lights\n3. Boats' } },
        { archetype: 'agenda', ground: 'dark', slots: { title: 'Agenda', body: '1. Tides' } },
        { archetype: 'full-image', slots: { visual: 'photo:harbour', caption: 'Who crosses here?' }, furniture: { omit: ['caption-scrim', 'logo-hero'] } },
        {
          archetype: 'closing-thanks',
          slots: { title: 'Thank you', subtitle: 'Questions welcome', caption: 'Invented closing line' },
          under: [{ kind: 'image', image: 'photo:closing', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' }],
        },
      ],
    }, { master, masterOrigin: 'catalog', resolveToken: (p) => colors[p], logos });
    return { master, colors, logos, composed };
  })();
  return cached;
}

const slideRows = (boxes: Row[], frame: string): Row[] => boxes.filter((r) => r.frame === frame);
const byId = (boxes: Row[], id: string): Row => {
  const row = boxes.find((r) => r.id === id);
  assert.ok(row, `row ${id} is composed`);
  return row;
};

/** The seeded row the editor's New slide from layout makes at 1920x1080, at the composed frame's origin. */
function editorRow(s: Suse, archetype: string, frame: Row, id: string): Row {
  const seeded = seedFrame(masterAtSize(s.master, SIZE), archetype, {
    frameId: String(frame.id), x: Number(frame.x), y: Number(frame.y), resolveToken: (p) => s.colors[p], logos: s.logos,
  });
  assert.ok(seeded, `${archetype} seeds`);
  const row = seeded.layers.find((l) => l.id === id);
  assert.ok(row, `${id} is seeded`);
  return row as Row;
}

const SAME = ['x', 'y', 'w', 'h', 'fontSize', 'weight', 'align', 'valign', 'fg'];

test('SUSE title at 1920x1080: the title lands where New slide from layout puts it, over a photo, with the mono mark', { skip: SKIP }, async () => {
  const s = await suse();
  const { document, report } = s.composed;
  const frame = byId(document.boxes, 's01');
  assert.equal(frame.archetype, 'title');
  assert.equal(frame.master, s.master.id);
  const title = byId(document.boxes, 's01.title');
  const seeded = editorRow(s, 'title', frame, 's01.title');
  for (const key of SAME) assert.equal(title[key], seeded[key], `title.${key} matches the editor`);
  assert.deepEqual([title.x, title.y, title.w, title.h, title.fontSize], [65, 238, 1389, 431, 104]);
  assert.equal(title.weight, '500', 'SUSE headlines are Medium');
  assert.deepEqual(report.slides[0]!.dropped, ['subtitle']);
  const rows = slideRows(document.boxes, 's01');
  assert.equal(rows[0]!.image, 'photo:cover', 'the photo paints first');
  const logo = byId(document.boxes, 's01.logo-hero');
  assert.equal(logo.image, s.logos.monoOnDark);
  assert.equal(logo.locked, true);
  assert.equal(frame.notes, 'Open with the tide table.');
  assert.equal(frame.order, 0);
});

test('SUSE agenda at 1920x1080: bars, footer and page number in deck order; a dark ground takes agenda-dark', { skip: SKIP }, async () => {
  const s = await suse();
  const { document, report } = s.composed;
  const frame = byId(document.boxes, 's02');
  for (const id of ['s02.title', 's02.body']) {
    const seeded = editorRow(s, 'agenda', frame, id);
    for (const key of SAME) assert.equal(byId(document.boxes, id)[key], seeded[key], `${id}.${key} matches the editor`);
  }
  assert.equal(byId(document.boxes, 's02.page-number').text, '2');
  assert.equal(byId(document.boxes, 's02.footer').text, 'Invented footer');
  assert.ok(report.slides[1]!.furniture.some((f) => f.startsWith('bar-')), 'the colour bars are drawn');
  assert.equal(byId(document.boxes, 's02.logo').image, s.logos.onLight);
  const dark = report.slides[2]!;
  assert.equal(dark.archetype, 'agenda-dark');
  assert.equal(dark.ground, 'dark');
  assert.equal(byId(document.boxes, 's03.page-number-on-dark').text, '3');
  assert.equal(byId(document.boxes, 's03.footer-on-dark').text, 'Invented footer');
  for (const row of slideRows(document.boxes, 's02').concat(slideRows(document.boxes, 's03'))) {
    if (row.furniture) assert.equal(row.locked, true, `${String(row.id)} is locked`);
    if (row.kind === 'text') assert.equal(row.pad, 0, `${String(row.id)} has pad 0`);
  }
});

test('SUSE full-image at 1920x1080: the photo and caption fill, the scrim and hero logo are left off', { skip: SKIP }, async () => {
  const s = await suse();
  const { document, report } = s.composed;
  const frame = byId(document.boxes, 's04');
  const visual = byId(document.boxes, 's04.visual');
  const seeded = editorRow(s, 'full-image', frame, 's04.visual');
  assert.deepEqual([visual.x, visual.y, visual.w, visual.h], [seeded.x, seeded.y, seeded.w, seeded.h]);
  assert.equal(visual.image, 'photo:harbour');
  assert.equal(visual.fit, seeded.fit);
  const caption = byId(document.boxes, 's04.caption');
  const seededCaption = editorRow(s, 'full-image', frame, 's04.caption');
  for (const key of SAME) assert.equal(caption[key], seededCaption[key], `caption.${key} matches the editor`);
  assert.deepEqual(report.slides[3]!.furniture, ['page-number-right-on-dark']);
  assert.equal(byId(document.boxes, 's04.page-number-right-on-dark').text, '4');
  assert.equal(report.notes.some((n) => n.code === 'compose.furniture.unknown'), false);
});

test('SUSE closing-thanks at 1920x1080: three slots fill over a photo, numbered last', { skip: SKIP }, async () => {
  const s = await suse();
  const { document, report } = s.composed;
  const frame = byId(document.boxes, 's05');
  for (const id of ['s05.title', 's05.subtitle', 's05.caption']) {
    const seeded = editorRow(s, 'closing-thanks', frame, id);
    for (const key of SAME) assert.equal(byId(document.boxes, id)[key], seeded[key], `${id}.${key} matches the editor`);
  }
  assert.deepEqual(report.slides[4]!.filled, ['title', 'subtitle', 'caption']);
  assert.deepEqual(report.slides[4]!.dropped, []);
  assert.equal(slideRows(document.boxes, 's05')[0]!.image, 'photo:closing');
  assert.equal(byId(document.boxes, 's05.page-number-right-on-dark').text, '5');
  // The closing sits on a full-bleed photo, so `logo: auto` takes the on-photo mark (E10 gap fix).
  assert.equal(byId(document.boxes, 's05.logo-hero').image, s.logos.monoOnDark);
  assert.equal(frame.order, 4);
});

// ─── plan 291 M3b: emphasis follows the brand, dark parity, the on-photo mark ─

/** One invented slide: a short line over a question with one bold word, set with pptx line breaks the way a source deck sets an eyebrow. */
function inventedInventory(): ContentInventoryV1 {
  const box = { x: 0.1, y: 0.1, width: 0.8, height: 0.2 };
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'invented.pptx', sha256: 'f'.repeat(64), bytes: 1000, kind: 'pptx', slides: 1, width: 960, height: 540 },
    slides: [{
      number: 1, id: 'slide1',
      text: [{ objectId: 'h1', role: 'title', class: 'title', box, paragraphs: [{ runs: [{ text: 'Tides', bold: true }, { text: '\n' }, { text: 'Are we ' }, { text: 'drifting', bold: true }, { text: ' past the Harbour Wall?' }] }], plain: 'Tides\nAre we drifting past the Harbour Wall?' }],
      notes: null, pictures: [], tables: [], charts: [], objects: [],
    }],
    media: [],
    warnings: [],
  } as unknown as ContentInventoryV1;
}

async function suseBrief(): Promise<{ doc: unknown; brief: ReturnType<typeof designBrief> }> {
  const tokens = readProfileTokenDocument({ profile: 'suse' });
  assert.ok(tokens, 'the suse token document resolves');
  return { doc: tokens.doc, brief: designBrief(tokens.doc, readProfileBriefCatalog({ profile: 'suse' }), {}) };
}

test('SUSE E15: source bold in a Medium headline takes the accent the pairings allow on its ground, and the house rules pass', { skip: SKIP }, async () => {
  const s = await suse();
  const { doc, brief } = await suseBrief();
  const title = { from: 'h1', join: ': ' };
  const { document, report, edits } = composeDesignSlides({
    case: 'sentence',
    slides: [
      { archetype: 'content', source: 1, notes: null, slots: { title, body: null } },
      { archetype: 'title', source: 1, notes: null, slots: { title: { ...title, fg: '#ffffff' }, subtitle: null } },
    ],
  } as DesignComposeSpecV1, { master: s.master, masterOrigin: 'catalog', resolveToken: (p) => s.colors[p], logos: s.logos, inventory: inventedInventory(), brief });
  // On white, jungle is not a SUSE text colour: the pairings give waterhole, which differs from the pine ink.
  assert.equal(byId(document.boxes, 's01.title').text, '{#2453ff|Tides}: are we {#2453ff|drifting} past the harbour wall?');
  // On the pine cover ground, mint is allowed and differs from the white ink the slot asks for.
  assert.equal(byId(document.boxes, 's02.title').text, '{#90ebcd|Tides}: are we {#90ebcd|drifting} past the harbour wall?');
  assert.equal(report.notes.filter((n) => n.code === 'compose.emphasis.accent').length, 2);
  // Named by the source line the case changed (plan 291 M4).
  assert.ok(edits.some((e) => e.source === 'Are we drifting past the Harbour Wall?' && e.result === 'are we drifting past the harbour wall?'));
  const findings = checkDesignHouseRules(document.boxes, brief.houseRules, doc).findings.filter((f) => f.layerId.endsWith('.title'));
  assert.deepEqual(findings.map((f) => `${f.layerId} ${f.ruleId}`), [], 'no text-weight or pairing finding on the titles');
});

test('SUSE dark deck: a flow layout takes its dark twin, main-point is themed dark, and a full photo takes the on-photo mark', { skip: SKIP }, async () => {
  const s = await suse();
  const resolved = await resolveProfileDesignSystem({ profile: 'suse' });
  const darkColors = (resolved!.input as unknown as { darkColors?: Record<string, string> }).darkColors;
  const photo = { kind: 'image', image: 'photo:sea', x: 0, y: 0, w: 1920, h: 1080, fit: 'cover' };
  const { document, report } = composeDesignSlides({
    theme: 'dark',
    furniture: { omit: ['bar'] },
    slides: [
      { archetype: 'flow-columns-3-1', slots: { title: 'Three questions' }, cells: [{ body: 'One?' }, { body: 'Two?' }, { body: 'Three?' }] },
      { archetype: 'main-point', slots: { title: 'A statement', subtitle: null } },
      { archetype: 'main-point', slots: { title: 'Over the sea', subtitle: null }, under: [photo] },
    ],
  } as DesignComposeSpecV1, { master: s.master, masterOrigin: 'catalog', resolveToken: (p) => s.colors[p], logos: s.logos, themeColors: { colors: s.colors, ...(darkColors ? { darkColors } : {}) } });
  assert.deepEqual(report.slides.map((r) => [r.archetype, r.ground]), [['flow-columns-3-1-dark', 'dark'], ['main-point', 'dark'], ['main-point', 'dark']]);
  assert.equal(byId(document.boxes, 's01').bg, s.colors['color.brand.pine']);
  assert.equal(byId(document.boxes, 's01.body').fg, '#ffffff');
  assert.deepEqual(report.notes.filter((n) => n.code === 'compose.dark.themed').map((n) => n.path), ['/slides/1/archetype', '/slides/2/archetype']);
  assert.equal(document.boxes.some((r) => String(r.furniture ?? '').startsWith('bar-')), false, 'the deck omits the colour bars');
  assert.equal(byId(document.boxes, 's02.logo-hero').image, s.logos.onDark);
  assert.equal(byId(document.boxes, 's03.logo-hero').image, s.logos.monoOnDark, 'the on-photo mark');
});

test('SUSE logos follow the brand logo-surface order over the master tags, and a two-theme deck writes auto marks (plan 291 E18)', { skip: SKIP }, async () => {
  const s = await suse();
  const doc = JSON.parse(readFileSync(fileURLToPath(new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url)), 'utf8'));
  const rule = brandRulesOfTokenDocument(doc).find((r) => r.kind === 'logo-surface');
  assert.ok(rule, 'the SUSE brand system states a logo-surface rule');
  const dark = (rule.parameters as { dark: string[] }).dark;
  const light = (rule.parameters as { light: string[] }).light;
  // The colour mark on dark is the rule's first, not the one the master's tags find first.
  assert.equal(s.logos.onDark, dark[0]);
  assert.equal(s.logos.onLight, light[0]);
  assert.ok(dark.includes(s.logos.monoOnDark!) && light.includes(s.logos.monoOnLight!));
  const { document } = composeDesignSlides({
    themes: ['light', 'dark'],
    slides: [{ archetype: 'agenda', slots: { title: 'Agenda', body: '1. Tides' } }, { archetype: 'agenda', ground: 'dark', slots: { title: 'Agenda', body: '1. Tides' } }],
  } as DesignComposeSpecV1, { master: s.master, masterOrigin: 'catalog', resolveToken: (p) => s.colors[p], logos: s.logos });
  assert.equal(byId(document.boxes, 's01.logo').image, `${s.logos.onLight}?theme=auto`);
  // A mark seeded on dark is written under the light side of its pair, so the dark
  // slot's white mono mark is not read as a mono choice: moved to light (or shown in
  // light) it takes the rule's first light mark, not the black mark.
  assert.equal(byId(document.boxes, 's02.logo').image, `${s.logos.onLight}?theme=auto`);
  const table = buildSurfaceVariantTable({ tokens: createTokenSet(doc), rules: brandRulesOfTokenDocument(doc) });
  for (const id of ['s01.logo', 's02.logo']) {
    const mark = String(byId(document.boxes, id).image);
    assert.equal(pickSurfaceVariant(mark, 'light', table), light[0], `${id} on light`);
    assert.equal(pickSurfaceVariant(mark, 'dark', table), dark[0], `${id} on dark`);
  }
});
