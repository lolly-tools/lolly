// SPDX-License-Identifier: MPL-2.0
/**
 * A first compose spec for a source deck (plan 291 W6, `lolly compose --suggest`):
 * engine/src/design-compose-suggest.ts.
 *
 * Public: synthetic inventories written here (no census, so the slide's own text
 * decides), the public recreate fixture (tests/fixtures/rebrand/recreate.pptx, read
 * through `readContentInventory` so the structure matcher runs) and the lolly-start
 * neutral master. Every suggestion is composed again with `composeDesignSlides`, so a
 * slot key, a `from` reference or an authoring row the composer would refuse fails here.
 * The private Sleepwalking acceptance is tests/design-compose-suggest-sleepwalking.test.ts.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-compose-suggest.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { ComposeSlotValueV1, ContentInventoryV1, DesignComposeSpecV1, InventoryPictureV1, InventorySlideV1, InventoryTextV1 } from '../packages/core/src/index.ts';
import { suggestComposeSlides } from '../engine/src/design-compose-suggest.ts';
import { composeDesignSlides } from '../engine/src/design-compose.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { readContentInventory } from '../packages/node-shell/src/content-inventory.ts';

type Row = Record<string, unknown>;

const SHA_A = 'a1'.repeat(32);
const SHA_B = 'b2'.repeat(32);

let nextId = 0;
const newId = (prefix: string): string => {
  nextId += 1;
  return `${prefix}${nextId}`;
};

function text(plain: string, box: [number, number, number, number], opts: { role?: InventoryTextV1['role']; size?: number; align?: 'left' | 'center'; readingIndex?: number } = {}): InventoryTextV1 {
  const [x, y, width, height] = box;
  const paragraphs = plain.split('\n\n').map((para) => ({ runs: [{ text: para, ...(opts.size ? { size: opts.size } : {}) }], ...(opts.align ? { align: opts.align } : {}) }));
  return {
    objectId: newId('t'),
    role: opts.role ?? 'body',
    class: opts.role === 'title' ? 'title' : 'body',
    ...(opts.readingIndex !== undefined ? { readingIndex: opts.readingIndex } : {}),
    box: { x, y, width, height },
    paragraphs,
    plain: plain.replace(/\n\n/g, '\n'),
  };
}

function picture(sha: string, box: [number, number, number, number], kind: InventoryPictureV1['kind'] = 'photo'): InventoryPictureV1 {
  const [x, y, width, height] = box;
  return { objectId: newId('p'), ref: `user/media/${sha}`, sha256: sha, mime: 'image/jpeg', bytes: 1000, width: 1600, height: 1200, box: { x, y, width, height }, kind, class: 'unknown' };
}

function slide(number: number, texts: InventoryTextV1[], pictures: InventoryPictureV1[] = [], notes: string | null = null): InventorySlideV1 {
  return {
    number,
    id: `slide${number}`,
    text: texts,
    notes: notes === null ? null : { text: notes, paragraphs: [{ lines: notes.split('\n') }] },
    pictures,
    tables: [],
    charts: [],
    objects: [...texts.map((t) => ({ id: t.objectId, kind: 'text', class: t.class })), ...pictures.map((p) => ({ id: p.objectId, kind: 'pic', class: p.class }))],
  };
}

function inventory(slides: InventorySlideV1[]): ContentInventoryV1 {
  return {
    version: 'lolly/content-inventory-v1',
    source: { name: 'synthetic.pptx', sha256: 'c3'.repeat(32), bytes: 1, kind: 'pptx', slides: slides.length, width: 1280, height: 720 },
    slides,
    media: [
      { ref: `user/media/${SHA_A}`, sha256: SHA_A, mime: 'image/jpeg', bytes: 1000, width: 1600, height: 1200, file: `/media/${SHA_A}.jpg` },
      { ref: `user/media/${SHA_B}`, sha256: SHA_B, mime: 'image/jpeg', bytes: 1000, width: 1600, height: 1200 },
    ],
    warnings: [],
  };
}

const suggest = (inv: ContentInventoryV1, census: unknown = null, source: unknown = null) => suggestComposeSlides({ inventory: inv, census, source }, neutralSlideMaster());

/** Compose the suggestion with the neutral master, as `lolly compose` would. */
function composeBack(spec: DesignComposeSpecV1, inv: ContentInventoryV1) {
  const colors: Record<string, string> = { 'color.semantic.text': '#1a1d24', 'color.semantic.surface': '#fafafa', 'color.semantic.muted': '#5f6672' };
  return composeDesignSlides(spec, { master: neutralSlideMaster(), masterOrigin: 'neutral', resolveToken: (p) => colors[p], inventory: inv });
}

/** Every `from` reference in a slide's slots and cells. */
function fromsOf(s: DesignComposeSpecV1['slides'][number]): string[] {
  const values: ComposeSlotValueV1[] = [...Object.values(s.slots ?? {}), ...(s.cells ?? []).flatMap((c) => Object.values(c))];
  // A slot may list several objects (plan 291 M4: an eyebrow folded in, a role under a name).
  return values.flatMap((v) => (v && typeof v === 'object' ? (typeof v.from === 'string' ? [v.from] : Array.isArray(v.from) ? v.from : []) : []));
}

test('a heading over a full-bleed photograph on the first slide is a cover over the photo, on the last a closing', () => {
  const cover = [text('Harbour lights', [0.06, 0.6, 0.7, 0.15], { role: 'title', size: 40 }), text('Robin Vale', [0.06, 0.78, 0.4, 0.05], { size: 20 })];
  const closing = [text('Plan for the tide', [0.06, 0.3, 0.7, 0.15], { role: 'title', size: 40 }), text('See you on the quay', [0.06, 0.6, 0.6, 0.05], { size: 18 })];
  const inv = inventory([
    slide(1, cover, [picture(SHA_A, [0, 0, 1, 1])], 'Welcome.'),
    slide(2, [text('Middle', [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), text('One line of body text here.', [0.06, 0.3, 0.88, 0.3], { size: 20 })]),
    slide(3, closing, [picture(SHA_B, [-0.01, 0, 1.02, 1.01])]),
  ]);
  const { spec, reasons, assets } = suggest(inv);
  const [first, , last] = spec.slides;
  assert.equal(first?.archetype, 'title');
  assert.deepEqual(first?.slots, { title: { from: cover[0]!.objectId }, subtitle: { from: cover[1]!.objectId } });
  assert.deepEqual(first?.under, [{ id: 's01.photo', kind: 'image', x: 0, y: 0, w: 1920, h: 1080, image: `photo:${SHA_A.slice(0, 12)}`, fit: 'cover' }]);
  assert.equal(first?.notes, true);
  assert.equal(first?.source, 1);
  assert.equal(last?.archetype, 'closing-thanks');
  const lastUnder = (last?.under ?? []) as Row[];
  assert.equal(lastUnder[0]?.image, `photo:${SHA_B.slice(0, 12)}`);
  assert.equal(last?.notes, null, 'a slide with no notes says so');
  assert.match(reasons[0]!.why, /cover/);
  assert.match(reasons[2]!.why, /closing/);
  assert.deepEqual(assets.map((a) => [a.key, a.sha256, a.file ?? null]), [
    [`photo:${SHA_A.slice(0, 12)}`, SHA_A, `/media/${SHA_A}.jpg`],
    [`photo:${SHA_B.slice(0, 12)}`, SHA_B, null],
  ]);
  const composed = composeBack(spec, inv);
  assert.deepEqual(composed.edits, [], 'every string of the source is on a composed slide');
});

test('a heading whose first line is a short lead over a longer one is joined with ": ", not set as an eyebrow', () => {
  // One paragraph with a line break (pptx a:br), over a full-bleed photo: the cover.
  const lead = text('AI\nAre we ready for the tide?', [0.06, 0.5, 0.8, 0.2], { role: 'title', size: 40 });
  const name = text('Robin Vale', [0.06, 0.78, 0.4, 0.05], { size: 20 });
  // Two paragraphs: the same reading.
  const agenda = text('Agenda\n\nThree tides of the year ahead', [0.06, 0.08, 0.88, 0.12], { role: 'title', size: 32 });
  // A first line no shorter than the next is two lines of one heading, left whole.
  const even = text('Spring tides\n\nNeap', [0.06, 0.08, 0.88, 0.12], { role: 'title', size: 32 });
  const inv = inventory([
    slide(1, [lead, name], [picture(SHA_A, [0, 0, 1, 1])]),
    slide(2, [agenda, text('One line of body text here.', [0.06, 0.3, 0.88, 0.3], { size: 20 })]),
    slide(3, [even, text('Another line of body text.', [0.06, 0.3, 0.88, 0.3], { size: 20 })]),
  ]);
  const { spec, reasons } = suggest(inv);
  assert.equal(spec.slides[0]!.archetype, 'title');
  assert.deepEqual(spec.slides[0]!.slots, { title: { from: lead.objectId, join: ': ' }, subtitle: { from: name.objectId } });
  assert.deepEqual(spec.slides[1]!.slots?.title, { from: agenda.objectId, join: ': ' });
  assert.deepEqual(spec.slides[2]!.slots?.title, { from: even.objectId });
  assert.match(reasons[0]!.why, /joined with ": " \(join\) rather than set as an eyebrow/);
  assert.doesNotMatch(reasons[2]!.why, /join/);
  const { document, edits } = composeBack(spec, inv);
  const title = (id: string): unknown => document.boxes.find((r) => r.id === id)?.text;
  assert.equal(title('s01.title'), 'AI: Are we ready for the tide?');
  assert.equal(title('s02.title'), 'Agenda: Three tides of the year ahead');
  assert.deepEqual(edits, [], 'every word of the source is carried');
});

test('a photograph short of full bleed, or on a middle slide, is no cover', () => {
  const inv = inventory([
    slide(1, [text('Half a picture', [0.06, 0.1, 0.4, 0.15], { role: 'title', size: 40 }), text('Words beside it, a few of them.', [0.06, 0.4, 0.4, 0.2], { size: 18 })], [picture(SHA_A, [0.5, 0, 0.5, 1])]),
    slide(2, [text('A middle slide', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })], [picture(SHA_B, [0, 0, 1, 1])]),
    slide(3, [text('The end', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
  ]);
  const { spec } = suggest(inv);
  assert.notEqual(spec.slides[0]?.archetype, 'title');
  assert.equal(spec.slides[0]?.under, undefined);
  // Mid deck, a full-bleed photo under one large line is a statement over the photo (plan 291 M4), never the cover.
  assert.notEqual(spec.slides[1]?.archetype, 'title', 'a full-bleed photo mid deck is no cover');
  assert.equal(spec.slides[1]?.archetype, 'main-point');
  composeBack(spec, inv);
});

test('a last slide told by its words is a closing with no photograph', () => {
  const inv = inventory([
    slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Thank you', [0.06, 0.39, 0.88, 0.15], { role: 'title', size: 44 }), text('Questions to the desk, any time.', [0.06, 0.56, 0.88, 0.06], { size: 20 })]),
  ]);
  const { spec } = suggest(inv);
  assert.equal(spec.slides[1]?.archetype, 'closing-thanks');
  assert.equal(spec.slides[1]?.under, undefined);
  assert.equal(fromsOf(spec.slides[1]!).length, 2);
  assert.deepEqual(composeBack(spec, inv).edits, []);
});

test('an eyebrow over a heading folds into the heading: from lists both objects, joined with ": "', () => {
  const eyebrow = text('WHY TIDES MATTER', [0.06, 0.11, 0.47, 0.04], { role: 'label', size: 12 });
  const heading = text('Every crossing starts with a timetable', [0.06, 0.17, 0.88, 0.15], { role: 'title', size: 36 });
  const body = text('The window opens twice a day and closes faster than it looks.', [0.06, 0.36, 0.55, 0.28], { size: 20 });
  const inv = inventory([slide(1, [eyebrow, heading, body]), slide(2, [text('Next', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })])]);
  const { spec, reasons } = suggest(inv);
  const s = spec.slides[0]!;
  // Plan 291 M4: the trap table folds an eyebrow into the heading, even when it is its own object.
  assert.equal(s.archetype, 'content');
  assert.deepEqual(s.slots?.title, { from: [eyebrow.objectId, heading.objectId], join: ': ' });
  assert.equal(s.slots?.subtitle, undefined);
  assert.deepEqual(s.slots?.body, { from: body.objectId });
  assert.match(reasons[0]!.why, /eyebrow over the heading is its own object/);
  const composed = composeBack(spec, inv);
  assert.equal(composed.document.boxes.find((r) => r.id === 's01.title')?.text, 'WHY TIDES MATTER: Every crossing starts with a timetable');
  assert.deepEqual(composed.edits, []);
});

test('a heading alone is a statement; a lattice of text boxes is a table set out in the data box', () => {
  const lattice: InventoryTextV1[] = [];
  const cols = [0.3, 0.5, 0.7];
  const rows = [0.3, 0.45, 0.6];
  for (const [c, x] of cols.entries()) lattice.push(text(`Stage ${c + 1}`, [x, 0.21, 0.15, 0.05], { size: 18 }));
  for (const [r, y] of rows.entries()) {
    lattice.push(text(`Crew ${r + 1}`, [0.06, y, 0.15, 0.05], { size: 18 }));
    for (const [c, x] of cols.entries()) lattice.push(text(`Task ${r + 1}.${c + 1}`, [x, y, 0.15, 0.05], { size: 16 }));
  }
  const inv = inventory([
    slide(1, [text('The tide does not wait', [0.11, 0.4, 0.78, 0.19], { role: 'title', size: 44, align: 'center' })]),
    slide(2, [text('Who holds each stage', [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), ...lattice]),
  ]);
  const { spec } = suggest(inv);
  assert.equal(spec.slides[0]?.archetype, 'main-point');
  const table = spec.slides[1]!;
  assert.equal(table.archetype, 'table');
  // Plan 291 M4: the data slot takes the table rows ($table), set out in its own box.
  const macro = (table.slots!.data as Row).$table as Row;
  assert.equal(table.over, undefined);
  const tableRows = macro.rows as Row[];
  assert.equal(tableRows.length, 4, 'a header row and three rows');
  assert.equal((tableRows[0] as Row).label, null, 'the corner stays empty');
  assert.deepEqual((tableRows[1] as Row).label, 'Crew 1');
  assert.deepEqual(composeBack(spec, inv).edits, []);
});

/** A source slide and census for the matcher, built from inventory texts (the fields the read uses). */
function readerInputs(inv: ContentInventoryV1): { source: unknown; census: unknown } {
  const slides = inv.slides.map((s, index) => ({
    id: s.id,
    index,
    width: 1280,
    height: 720,
    origin: {},
    objects: s.text.map((t) => ({ id: t.objectId, kind: 'text', box: { x: t.box.x, y: t.box.y, w: t.box.width, h: t.box.height }, text: { paras: t.paragraphs.map((p) => ({ runs: p.runs.map((r) => ({ text: r.text })) })) } })),
  }));
  const layouts = inv.slides.map((s) => ({
    slideId: s.id,
    counts: {},
    imageAreaShare: 0,
    chartPresent: false,
    tablePresent: false,
    distinctLeftEdges: 0,
    equalSiblingBoxes: 0,
    textParagraphs: 0,
    textWords: 0,
    units: s.text.map((t) => ({ id: t.objectId, kind: 'text', box: { x: t.box.x, y: t.box.y, w: t.box.width, h: t.box.height }, words: t.plain.split(/\s+/).length, maxPt: Math.max(...t.paragraphs.flatMap((p) => p.runs.map((r) => r.size ?? 0))) })),
    containers: [],
  }));
  const objects = inv.slides.flatMap((s) => s.text.map((t) => ({ id: t.objectId, slideId: s.id, hypothesis: { class: t.class } })));
  return { source: { slides }, census: { layouts, objects } };
}

test('numbered cards whose numbers only count them stay a row of columns, the counters left out and declared', () => {
  const cards = [0.09, 0.39, 0.69].flatMap((x, k) => [
    text(`0${k + 1}`, [x, 0.35, 0.05, 0.08], { role: 'label', size: 28 }),
    text(`Which way does question ${k + 1} lean?`, [x, 0.47, 0.23, 0.3], { size: 22 }),
  ]);
  const inv = inventory([
    slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Three questions', [0.07, 0.09, 0.87, 0.15], { size: 40 }), ...cards]),
    slide(3, [text('End', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
  ]);
  const { source, census } = readerInputs(inv);
  const { spec, reasons } = suggest(inv, census, source);
  const s = spec.slides[1]!;
  assert.ok(reasons[1]!.read, 'the matcher read the slide');
  // Plan 291 M4: a column archetype in place of numbered rows, the 01 to 03 left out.
  assert.equal(s.archetype, 'columns-3', 'the cards stay a row');
  assert.deepEqual(s.slots?.title, { from: inv.slides[1]!.text[0]!.objectId }, 'the largest text at the top is the heading');
  assert.deepEqual(s.cells, [0, 1, 2].map((k) => ({ body: { from: cards[k * 2 + 1]!.objectId } })));
  assert.match(reasons[1]!.why, /decorative numbering/);
  const edits = composeBack(spec, inv).edits;
  assert.deepEqual(edits.map((e) => e.source).sort(), ['01', '02', '03']);
  for (const e of edits) assert.match(e.reason, /Decorative numbering/);
});

test('a 2x2 grid of cells numbered 01 to 04 drops the counters: each label takes the cell\'s heading', () => {
  // One text object per cell: the counter, the cell's heading and its line, as paragraphs.
  const cells = [[0.08, 0.3], [0.52, 0.3], [0.08, 0.62], [0.52, 0.62]].map(([x, y], k) =>
    text(`0${k + 1}\n\nTest ${k + 1}\n\nHow test ${k + 1} reads in one line.`, [x!, y!, 0.38, 0.26], { size: 22 }));
  const inv = inventory([
    slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Four tests', [0.07, 0.09, 0.87, 0.12], { role: 'title', size: 40 }), ...cells]),
    slide(3, [text('End', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
  ]);
  const { source, census } = readerInputs(inv);
  const { spec, reasons } = suggest(inv, census, source);
  const s = spec.slides[1]!;
  assert.equal(reasons[1]!.read, 'grid-2x2', 'the matcher read a grid');
  assert.match(s.archetype, /grid/);
  assert.deepEqual(s.cells, cells.map((c) => ({ label: { from: c.objectId, para: 1 }, body: { from: c.objectId, para: 2 } })), 'the counters (paragraph 0) are left out');
  assert.match(reasons[1]!.why, /decorative numbering/);
  const edits = composeBack(spec, inv).edits;
  assert.deepEqual(edits.map((e) => e.source).sort(), ['01', '02', '03', '04']);
  for (const e of edits) assert.match(e.reason, /Decorative numbering/);
});

test('a closing heading at two sizes whose smaller lines outrun the subtitle slot runs them into one line', () => {
  const runsOf = (pieces: Array<[string, number]>) => ({ runs: pieces.map(([t, size]) => ({ text: t, size })) });
  const heading = (smaller: Array<Array<[string, number]>>): InventoryTextV1 => {
    const paragraphs = [runsOf([['Are you ready for the tide?', 40]]), ...smaller.map(runsOf)];
    return {
      objectId: newId('t'), role: 'title', class: 'title', box: { x: 0.05, y: 0.12, width: 0.45, height: 0.76 },
      paragraphs, plain: paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n'),
    };
  };
  // One sentence broken by hand over four lines (a line break and three paragraphs).
  const long = heading([[['Harbour Offers', 27], ['\n', 27], ['Boats for the Quay and', 27]], [['Quays for the Boats', 27]], [['Every Day of the Year', 27]]]);
  const short = heading([[['Harbour Offers Boats', 27]]]);
  for (const [lead, joined] of [[long, true], [short, false]] as const) {
    const inv = inventory([
      slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
      slide(2, [lead], [picture(SHA_A, [0, 0, 1, 1])]),
    ]);
    const { spec, reasons } = suggest(inv);
    const sub = spec.slides[1]!.slots?.subtitle as Row | undefined;
    assert.equal(spec.slides[1]!.archetype, 'closing-thanks');
    assert.equal(sub?.from, lead.objectId);
    assert.equal(sub?.join, joined ? ' ' : undefined, joined ? 'four hand-broken lines are joined' : 'one line keeps its form');
    if (joined) {
      assert.match(reasons[1]!.why, /run into one \(join\)/);
      const row = composeBack(spec, inv).document.boxes.find((b) => b.id === 's02.subtitle') as Row;
      assert.equal(row.text, 'Harbour Offers Boats for the Quay and Quays for the Boats Every Day of the Year');
      assert.deepEqual(composeBack(spec, inv).edits, [], 'the joined lines are carried, word for word');
    }
  }
});

test('loose groups of text with no census read become a content-sized layout', () => {
  // Without the census the matcher cannot run, so loose groups become a content-sized layout.
  const groups = [0.1, 0.4, 0.7].flatMap((x, k) => [
    text(`Question ${k + 1} heading`, [x, 0.3, 0.25, 0.06], { size: 22 }),
    text(`A line under question ${k + 1}.`, [x, 0.37, 0.25, 0.08], { size: 16 }),
  ]);
  const inv = inventory([slide(1, [text('Three questions', [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), ...groups]), slide(2, [text('End', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })])]);
  const { spec } = suggest(inv);
  assert.match(spec.slides[0]!.archetype, /^flow-columns-3-\d$/);
  assert.equal(spec.slides[0]!.cells?.length, 3);
  assert.deepEqual(composeBack(spec, inv).edits, []);
});

test('strings no slot holds sit where the source had them, cut at the slide edge', () => {
  const scattered = Array.from({ length: 14 }, (_, k) => text(`Note ${k + 1} with words`, [0.05 + (k % 7) * 0.13, 0.3 + Math.floor(k / 7) * 0.33 + (k % 3) * 0.07, 0.12, 0.05], { size: 12 }));
  scattered.push(text('Off the edge', [0.9, 0.9, 0.2, 0.2], { size: 12 }));
  const inv = inventory([slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]), slide(2, [text('Busy slide', [0.06, 0.05, 0.88, 0.1], { role: 'title', size: 32 }), ...scattered])]);
  const { spec, reasons } = suggest(inv);
  const s = spec.slides[1]!;
  const over = (s.over ?? []) as Row[];
  assert.ok(over.length > 0);
  for (const row of over) {
    assert.equal(row.kind, 'text');
    assert.ok(Number(row.x) + Number(row.w) <= 1920 && Number(row.y) + Number(row.h) <= 1080, `${String(row.id)} stays on the slide`);
  }
  const edge = over.find((r) => r.text === 'Off the edge');
  assert.ok(edge, 'the off-edge string is kept');
  assert.equal(edge.fontSize, Math.round(12 * (1920 / 1280) * (96 / 72)), 'type keeps its source size, scaled to the page');
  assert.match(reasons[1]!.why, /no slot/);
  assert.deepEqual(composeBack(spec, inv).edits, []);
});

test('the suggestion is deterministic and leaves its input alone', () => {
  const make = (): ContentInventoryV1 => {
    nextId = 1000;
    return inventory([
      slide(1, [text('Harbour lights', [0.06, 0.6, 0.7, 0.15], { role: 'title', size: 40 })], [picture(SHA_A, [0, 0, 1, 1])]),
      slide(2, [text('Thank you', [0.06, 0.4, 0.7, 0.15], { role: 'title', size: 40 })]),
    ]);
  };
  const inv = make();
  const before = JSON.stringify(inv);
  const a = suggest(inv);
  assert.equal(JSON.stringify(inv), before);
  assert.deepEqual(suggest(make()), a);
});

test('a source that is not 16:9 gets a page of its own aspect', () => {
  const inv = inventory([slide(1, [text('Four by three', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })])]);
  inv.source.width = 960;
  inv.source.height = 720;
  assert.deepEqual(suggest(inv).spec.size, { width: 1920, height: 1440 });
});

// ─── the public recreate fixture ────────────────────────────────────────────

const FIXTURE = fileURLToPath(new URL('./fixtures/rebrand/recreate.pptx', import.meta.url));

test('the recreate fixture: an archetype per slide, every string referenced, and it composes clean', { skip: existsSync(FIXTURE) ? false : 'tests/fixtures/rebrand/recreate.pptx is not built (node scripts/build-rebrand-fixtures.ts)' }, async () => {
  const read = await readContentInventory({ bytes: new Uint8Array(readFileSync(FIXTURE)), name: 'recreate.pptx' });
  const inv = read.inventory;
  const { spec, reasons, assets } = suggestComposeSlides({ inventory: inv, census: read.census, source: read.source }, neutralSlideMaster());
  assert.equal(spec.slides.length, inv.slides.length);
  assert.equal(reasons.length, inv.slides.length);
  const master = neutralSlideMaster();
  for (const s of spec.slides) {
    assert.ok(master.archetypes.some((a) => a.id === s.archetype) || /^flow-(cards|columns)-\d+-\d$/.test(s.archetype), `${s.id}: ${s.archetype} is an archetype`);
    assert.equal(typeof s.source, 'number');
  }
  // The cover and the closing are the master's, over or without a photograph.
  assert.equal(spec.slides[0]?.archetype, 'title');
  assert.equal(spec.slides[0]?.under?.length, 1);
  assert.equal(spec.slides.at(-1)?.archetype, 'closing-thanks');
  // Numbered cards stay a row of columns, their counters left out (plan 291 M4).
  assert.equal(spec.slides[1]!.archetype, 'columns-3');
  // Every pictures key is in the asset list.
  const keys = new Set(assets.map((a) => a.key));
  for (const s of spec.slides) {
    for (const row of [...(s.under ?? []), ...(s.over ?? [])] as Row[]) if (typeof row.image === 'string') assert.ok(keys.has(row.image));
    for (const v of Object.values(s.slots ?? {})) if (typeof v === 'string' && v.startsWith('photo:')) assert.ok(keys.has(v));
  }
  // Every content string is referenced by `from`, or set out where no slot can hold it
  // (a third cover line, a table's cells), and says so.
  const furniture = new Set(['page-number', 'footer']);
  inv.slides.forEach((src, k) => {
    const s = spec.slides[k]!;
    const froms = new Set(fromsOf(s));
    const copied = JSON.stringify([s.over ?? [], s.slots ?? {}]);
    for (const t of src.text) {
      if (furniture.has(t.role) || !t.plain.trim()) continue;
      // A counter (01, 02, 03) the reason calls decorative numbering is left out on purpose (plan 291 M4).
      if (/^\s*0?\d{1,2}[.)]?\s*$/.test(t.plain) && /decorative numbering/.test(reasons[k]!.why)) continue;
      const referenced = froms.has(t.objectId);
      assert.ok(referenced || copied.includes(JSON.stringify(t.plain).slice(1, -1)), `slide ${src.number}: "${t.objectId}" is on the suggested slide`);
      if (!referenced) assert.match(reasons[k]!.why, /no slot|table/, `slide ${src.number}: the reason says why ${t.objectId} has no from`);
    }
  });
  const composed = composeBack(spec, inv);
  assert.equal(composed.document.boxes.filter((r) => r.kind === 'frame').length, inv.slides.length);
  // Only the decorative counters are left out, and declared as such.
  assert.deepEqual(composed.edits.map((e) => e.source).sort(), ['01', '02', '03'], 'no other source string is changed or left out');
});

// ─── review fixes (plan 291 M3b) ────────────────────────────────────────────

/** A text of a given inventory class (the helper above sets the class from the role). */
function classed(t: InventoryTextV1, cls: string): InventoryTextV1 {
  return { ...t, class: cls as InventoryTextV1['class'] };
}

test('the cover and closing priors need a heading: a photo credit or a body paragraph is no title', () => {
  const credit = text('Photo: J. Smith, CC BY 4.0', [0.6, 0.92, 0.38, 0.05], { role: 'caption', size: 10 });
  const closingInv = inventory([
    slide(1, [text('Report', [0.1, 0.1, 0.8, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Findings', [0.05, 0.05, 0.9, 0.15], { role: 'title', size: 36 }), text('Body copy.', [0.05, 0.4, 0.9, 0.3])]),
    slide(3, [credit], [picture(SHA_A, [0, 0, 1, 1])]),
  ]);
  const closing = suggest(closingInv).spec.slides[2]!;
  assert.notEqual(closing.archetype, 'closing-thanks', 'a credit line over a photo is no closing');
  assert.notDeepEqual(closing.slots?.title, { from: credit.objectId }, 'the credit is not set as a title');
  assert.deepEqual(composeBack(suggest(closingInv).spec, closingInv).edits, []);

  const para = text('In 2025 the port handled four million containers, and most of them arrived at night when the cranes run at half speed and the yard is quiet.', [0.05, 0.7, 0.5, 0.2], { size: 14 });
  const coverInv = inventory([
    slide(1, [para], [picture(SHA_B, [0, 0, 1, 1])]),
    slide(2, [text('Findings', [0.05, 0.05, 0.9, 0.15], { role: 'title', size: 36 }), text('Body copy.', [0.05, 0.4, 0.9, 0.3])]),
  ]);
  const cover = suggest(coverInv).spec.slides[0]!;
  assert.notEqual(cover.archetype, 'title', 'a body paragraph over a photo is no cover');
  assert.notDeepEqual(cover.slots?.title, { from: para.objectId });

  // A display line set large over the photo is a heading, whatever its placeholder role.
  const big = text('Do we understand the urgency?', [0.04, 0.63, 0.62, 0.33], { size: 50 });
  const lastBig = suggest(inventory([slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]), slide(2, [big], [picture(SHA_A, [0, 0, 1, 1])])])).spec.slides[1]!;
  assert.equal(lastBig.archetype, 'closing-thanks');
  assert.deepEqual(lastBig.slots?.title, { from: big.objectId });
});

test('the recreate fixture cut so its captioned photo slide is last keeps the matcher read, not a closing', { skip: existsSync(FIXTURE) ? false : 'tests/fixtures/rebrand/recreate.pptx is not built (node scripts/build-rebrand-fixtures.ts)' }, async () => {
  const read = await readContentInventory({ bytes: new Uint8Array(readFileSync(FIXTURE)), name: 'recreate.pptx' });
  const whole = suggestComposeSlides({ inventory: read.inventory, census: read.census, source: read.source }, neutralSlideMaster());
  const cut = { ...read.inventory, slides: read.inventory.slides.slice(0, 6) };
  const { spec } = suggestComposeSlides({ inventory: cut, census: read.census, source: read.source }, neutralSlideMaster());
  assert.notEqual(spec.slides[5]!.archetype, 'closing-thanks');
  assert.equal(spec.slides[5]!.archetype, whole.spec.slides[5]!.archetype, 'the captioned photo reads the same last as mid deck');
});

test('a last slide that only mentions questions in its body is no closing', () => {
  const body = text('We now answer customer questions in under an hour.\n\nBacklog fell by half.\n\nHiring two more agents in Q3.', [0.06, 0.3, 0.88, 0.4], { size: 20 });
  const inv = inventory([
    slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Summary', [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), body]),
  ]);
  const { spec, reasons } = suggest(inv);
  assert.notEqual(spec.slides[1]!.archetype, 'closing-thanks');
  assert.doesNotMatch(reasons[1]!.why, /thanks the room/);
  // A short closing line under a heading still tells the closing.
  const short = inventory([
    slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]),
    slide(2, [text('Wrap-up', [0.06, 0.39, 0.88, 0.15], { role: 'title', size: 44 }), text('Questions?', [0.06, 0.56, 0.88, 0.06], { size: 20 })]),
  ]);
  assert.equal(suggest(short).spec.slides[1]!.archetype, 'closing-thanks');
});

test('a title wrapped by a line break is not joined with ": " when its first line cannot stand alone', () => {
  const why = text('Why we\nbuilt this platform for you', [0.05, 0.05, 0.9, 0.2], { role: 'title', size: 36 });
  const tale = text('A tale of\ntwo very different cities', [0.05, 0.05, 0.9, 0.2], { role: 'title', size: 36 });
  const lower = text('Ship it\nbefore the tide turns again', [0.05, 0.05, 0.9, 0.2], { role: 'title', size: 36 });
  const inv = inventory([
    slide(1, [text('Kick-off', [0.1, 0.1, 0.8, 0.15], { role: 'title', size: 40 })]),
    slide(2, [why, text('Body copy here about the topic.', [0.05, 0.4, 0.9, 0.3])]),
    slide(3, [tale]),
    slide(4, [lower, text('Body copy here about the topic.', [0.05, 0.4, 0.9, 0.3])]),
    slide(5, [text('Thanks', [0.1, 0.1, 0.8, 0.15], { role: 'title', size: 40 })]),
  ]);
  const { spec, reasons } = suggest(inv);
  assert.deepEqual(spec.slides[1]!.slots?.title, { from: why.objectId });
  assert.deepEqual(spec.slides[2]!.slots?.title, { from: tale.objectId });
  assert.deepEqual(spec.slides[3]!.slots?.title, { from: lower.objectId }, 'a second line that runs on in lower case continues the first');
  for (const r of reasons) assert.doesNotMatch(r.why, /joined with/);
  const { document } = composeBack(spec, inv);
  const title = (id: string): unknown => document.boxes.find((r) => r.id === id)?.text;
  assert.doesNotMatch(String(title('s02.title')), /: /);
  assert.doesNotMatch(String(title('s03.title')), /: /);
});

test('the deck footer is one that recurs; a slide whose own footer differs keeps it', () => {
  const footer = (s: string): InventoryTextV1 => classed(text(s, [0.06, 0.94, 0.5, 0.03], { role: 'footer', size: 9 }), 'footer');
  const body = (k: number): InventoryTextV1[] => [text(`Heading ${k}`, [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), text(`One line of body text ${k}.`, [0.06, 0.3, 0.88, 0.3], { size: 20 })];
  const each = inventory([1, 2, 3].map((k) => slide(k, [...body(k), footer(`Source: report 202${k}`)])));
  const a = suggest(each);
  assert.equal(a.spec.footer, undefined, 'no footer recurs, so the deck has none');
  for (const [k, s] of a.spec.slides.entries()) assert.equal(s.furniture?.footer, `Source: report 202${k + 1}`, `${s.id} keeps its own source line`);
  for (const r of a.reasons) assert.match(r.why, /footer/);
  const composed = composeBack(a.spec, each);
  const rows = composed.document.boxes;
  for (const k of [1, 2, 3]) {
    const row = rows.find((r) => r.id === `s0${k}.footer`);
    assert.ok(row, `s0${k} draws a footer`);
    assert.equal(row.text, `Source: report 202${k}`);
  }

  const most = inventory([slide(1, [...body(1), footer('Harbourline 2026')]), slide(2, [...body(2), footer('Harbourline 2026')]), slide(3, [...body(3), footer('Tide tables: port office')])]);
  const b = suggest(most);
  assert.equal(b.spec.footer, 'Harbourline 2026');
  assert.equal(b.spec.slides[0]!.furniture, undefined);
  assert.equal(b.spec.slides[2]!.furniture?.footer, 'Tide tables: port office');
});

test('what is left to the master is counted in the reason, and content-like strings are named', () => {
  const legend = (): InventoryTextV1 => classed(text('Key: north, south, east', [0.7, 0.85, 0.25, 0.04], { role: 'caption', size: 10 }), 'recurring-text');
  const mark = (): InventoryTextV1 => classed(text('Internal draft', [0.8, 0.95, 0.15, 0.03], { size: 8 }), 'recurring-text');
  const page = (): InventoryTextV1 => classed(text('2', [0.95, 0.95, 0.03, 0.03], { role: 'page-number', size: 8 }), 'page-number');
  const other = text('east', [0.5, 0.5, 0.05, 0.03], { role: 'other', size: 10 });
  const head = (k: number): InventoryTextV1[] => [text(`Heading ${k}`, [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }), text(`One line of body text ${k}.`, [0.06, 0.3, 0.88, 0.3], { size: 20 })];
  const inv = inventory([
    slide(1, [...head(1), mark(), page()]),
    slide(2, [...head(2), legend(), mark(), page(), other]),
    slide(3, [...head(3), legend(), mark(), page()]),
  ]);
  const { reasons } = suggest(inv);
  assert.match(reasons[0]!.why, /left to the master/i);
  assert.doesNotMatch(reasons[0]!.why, /Internal draft/, 'text on every slide is furniture and only counted');
  assert.match(reasons[1]!.why, /"Key: north, south, east"/);
  assert.match(reasons[1]!.why, /"east"/);
  assert.match(reasons[2]!.why, /"Key: north, south, east"/);
});

test('a slide with a source table counts every loose string in its reason', () => {
  const s2 = slide(2, [
    text('Results', [0.06, 0.08, 0.88, 0.1], { role: 'title', size: 32 }),
    text('First note beside the table.', [0.06, 0.8, 0.4, 0.05], { size: 14 }),
    text('Second note beside the table.', [0.5, 0.8, 0.4, 0.05], { size: 14 }),
  ]);
  (s2 as { tables: unknown[] }).tables = [{ objectId: 'tbl1', box: { x: 0.06, y: 0.25, width: 0.88, height: 0.5 }, rows: [['Port', 'Ships'], ['North', '12'], ['South', '9']] }];
  const inv = inventory([slide(1, [text('Opening', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })]), s2, slide(3, [text('End', [0.06, 0.1, 0.7, 0.15], { role: 'title', size: 40 })])]);
  const { spec, reasons } = suggest(inv);
  const over = (spec.slides[1]!.over ?? []) as Row[];
  assert.ok(((spec.slides[1]!.slots!.data as Row).$table as Row).rows, 'the table is set out in the data slot');
  assert.equal(over.filter((r) => r.kind === 'text').length, 2);
  assert.match(reasons[1]!.why, /2 strings have no slot/);
});
