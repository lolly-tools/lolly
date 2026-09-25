// SPDX-License-Identifier: MPL-2.0
/**
 * The slide layout library and the masters built from it (plan 275 section 2,
 * `engine/src/slide-structures.ts`, `scripts/build-slide-masters.ts`).
 *
 * Pins what the rest of the renovation relies on: the library is the seventy-three
 * of the research note with permanent ids, the engine's copy and both pack masters
 * rebuild byte for byte from it, a structure expands in each master's own geometry
 * with its cells grouped in reading order, a structure id meets an archetype id in
 * one place, every text placeholder states a weight, the master rules pass on the
 * built files and refuse a broken one, search finds what a person types, and a deck
 * planned and compiled against the built master still lowers to placeholder-bound
 * PowerPoint.
 *
 * Run with: node --test "tests/slide-structures.test.ts"
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ARCHETYPE_IDS, STRUCTURE_ID_PATTERN, isKnownArchetypeId } from '../packages/core/src/index.ts';
import type { ArchetypeV1, DesignBoxRowV1, MasterBoxV1, PlaceholderLayerV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';
import {
  archetypeForStructure,
  darkVariantOf,
  expandRepeat,
  expandStructure,
  findStructure,
  searchStructures,
  searchTokens,
  slideStructureLibrary,
  structureOf,
} from '../engine/src/slide-structures.ts';
import { applyArchetype, resetFrame, seedFrame } from '../engine/src/slide-master.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import {
  DATA_FILE,
  MASTER_BUILDS,
  buildMaster,
  libraryProblems,
  planWrites,
  readLibrary,
  renderStructuresData,
} from '../scripts/build-slide-masters.ts';
import { libraryStructureIds, slideMasterProblems, type SlideMasterFileLike } from '../scripts/lib/slide-master-rules.ts';
import { designFramesToPptx, framesOfDesignDoc } from '../packages/node-shell/src/design-pptx.ts';
import { compiledRows } from '../packages/node-shell/src/rebrand/pipeline.ts';
import { runRebrandPipeline, starterTokens, STARTER_MASTER } from './helpers/rebrand-pipeline.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

const PACKS = MASTER_BUILDS
  .filter((config) => existsSync(join(ROOT, config.file)))
  .map((config) => ({ config, file: JSON.parse(read(config.file)) as SlideMasterFileV1 }));

const LIBRARY = slideStructureLibrary();
const LIBRARY_IDS = new Set(LIBRARY.structures.map((s) => s.id));

/**
 * The library's ids in the order they were first published. Ids are permanent:
 * a new structure is appended to the library and to this list, and nothing here is
 * renamed, removed or moved, which is what a count alone could not catch.
 */
const PUBLISHED_STRUCTURE_IDS: readonly string[] = [
  'cover-title', 'cover-title-image', 'cover-full-image', 'title-only', 'section', 'section-numbered',
  'section-description', 'statement', 'title-body', 'title-subtitle-body', 'kicker-title-body',
  'one-column-text', 'text-two-column', 'comparison', 'text-and-callout', 'columns-2', 'columns-3',
  'columns-4', 'columns-5', 'icon-columns-3', 'icon-columns-4', 'grid-2x2', 'grid-3x2', 'grid-2x3',
  'grid-4x2', 'bento-5', 'cards-3', 'full-image', 'full-image-caption', 'visual', 'image-caption',
  'image-and-text', 'text-and-image', 'image-top-text-bottom', 'images-2', 'images-3', 'image-grid-2x2',
  'image-grid-3x2', 'image-with-quote', 'chart', 'chart-and-callout', 'callout-and-chart', 'charts-2',
  'big-number', 'stats-2', 'stats-3', 'stats-4', 'dashboard', 'table', 'table-and-text', 'steps-3',
  'steps-4', 'steps-5', 'timeline', 'timeline-vertical', 'roadmap', 'cycle', 'funnel', 'quote',
  'quote-portrait', 'profile', 'team-3', 'team-4', 'team-grid-4x2', 'logo-wall', 'agenda', 'agenda-numbered',
  'agenda-two-column', 'numbered-rows', 'checklist', 'closing-thanks', 'closing-contact', 'closing-cta',
];

/**
 * The first slice the masters build expands: the twelve tuned archetypes'
 * structures and twenty-seven more, thirty-nine light archetypes in all. Most of
 * them also get a dark variant, which is marked `variantOf` and is not part of
 * this count.
 */
const EXPANDED_IDS: readonly string[] = [
  'cover-title', 'cover-title-image', 'title-only', 'section', 'statement', 'title-body',
  'title-subtitle-body', 'text-two-column', 'comparison', 'columns-2', 'columns-3', 'columns-4',
  'icon-columns-3', 'grid-2x2', 'grid-3x2', 'cards-3', 'full-image', 'full-image-caption', 'visual',
  'image-caption', 'image-and-text', 'text-and-image', 'images-2', 'images-3', 'image-grid-2x2', 'chart',
  'chart-and-callout', 'big-number', 'stats-3', 'stats-4', 'table', 'steps-3', 'steps-4', 'timeline',
  'quote', 'agenda', 'agenda-numbered', 'numbered-rows', 'closing-thanks',
];

const within = (box: MasterBoxV1): boolean =>
  box.x >= -1e-9 && box.y >= -1e-9 && box.x + box.w <= 1.0001 && box.y + box.h <= 1.0001 && box.w > 0 && box.h > 0;

const overlap = (a: MasterBoxV1, b: MasterBoxV1): boolean =>
  Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.001
  && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.001;

// ─── the library ─────────────────────────────────────────────────────────────

test('the library holds the seventy-three structures of the research note, in nine sections, with permanent ids', () => {
  const file = readLibrary(ROOT);
  assert.equal(file.structures.length, 73);
  assert.equal(file.sections.length, 9);
  assert.deepEqual(libraryProblems(file), []);
  for (const s of file.structures) {
    assert.match(s.id, STRUCTURE_ID_PATTERN);
    assert.ok(s.name.length > 0 && s.keywords.length > 0, `${s.id} has a name and search words`);
    assert.ok(s.mapsTo === null || isKnownArchetypeId(s.mapsTo), `${s.id} maps to one of the twelve or to nothing`);
  }
  // The first slice: the twelve's structures and the twenty-seven section 2.6 names.
  assert.deepEqual(file.expanded, [...EXPANDED_IDS]);
  assert.ok(file.expanded.every((id) => LIBRARY_IDS.has(id)));
  assert.ok(!file.expanded.includes('grid-2x3'), 'Six boxes tall waits: it is a near twin of Six boxes');
});

test('library ids are append only: every published id keeps its place, and new ones come after', () => {
  const ids = readLibrary(ROOT).structures.map((s) => s.id);
  assert.deepEqual(ids.slice(0, PUBLISHED_STRUCTURE_IDS.length), [...PUBLISHED_STRUCTURE_IDS],
    'a library id was renamed, removed or moved; ids are permanent, so append a new one instead');
  assert.equal(new Set(ids).size, ids.length);
});

test('the engine copy of the library rebuilds byte for byte from library.json', () => {
  assert.equal(renderStructuresData(readLibrary(ROOT)), read(DATA_FILE),
    `${DATA_FILE} has drifted from community/slide-structures/library.json; run node scripts/build-slide-masters.ts`);
  const { $comment: _comment, ...fromFile } = readLibrary(ROOT);
  assert.deepEqual(LIBRARY, fromFile);
});

test('every generated file is what the build would write today', () => {
  for (const { file, content } of planWrites(ROOT)) {
    assert.equal(content, read(file), `${file} is behind the library; run node scripts/build-slide-masters.ts`);
  }
});

test('a library problem is named: a duplicate id, an unknown section, a mirror of nothing, a missing expanded id', () => {
  const broken = structuredClone(readLibrary(ROOT));
  const [first, second] = broken.structures;
  assert.ok(first && second);
  second.id = first.id;
  first.section = 'nowhere';
  broken.structures.push({ ...structuredClone(first), id: 'mirror-of-nothing', slots: undefined, mirror: 'no-such-structure' });
  broken.expanded.push('not-in-the-library');
  const problems = libraryProblems(broken).join('\n');
  assert.match(problems, /declared twice/);
  assert.match(problems, /names the section "nowhere"/);
  assert.match(problems, /mirrors "no-such-structure"/);
  assert.match(problems, /expanded names "not-in-the-library"/);
});

// ─── expansion ───────────────────────────────────────────────────────────────

test('every structure expands on the library grid inside the slide, with no two text slots on top of each other', () => {
  for (const s of LIBRARY.structures) {
    const { placeholders } = expandStructure(s, LIBRARY.grid);
    assert.ok(placeholders.length > 0, `${s.id} expands to something`);
    for (const ph of placeholders) assert.ok(within(ph.box), `${s.id} ${ph.role} stays on the slide`);
    // Big number sets its caption into the foot of the figure's box on purpose; the masters mark it overlay.
    if (s.id === 'big-number') continue;
    const text = placeholders.filter((ph) => ph.kind !== 'image');
    for (let i = 0; i < text.length; i++) {
      for (let j = i + 1; j < text.length; j++) {
        const a = text[i];
        const b = text[j];
        assert.ok(a && b);
        assert.ok(!overlap(a.box, b.box), `${s.id}: ${a.role} and ${b.role} overlap`);
      }
    }
  }
});

test('a repeat expands to its cells in reading order, each grouped and indexed, under one title', () => {
  const grid3x2 = findStructure('grid-3x2');
  assert.ok(grid3x2?.repeat);
  const { placeholders } = expandStructure(grid3x2, LIBRARY.grid);
  assert.equal(placeholders[0]?.role, 'title');
  const cells = placeholders.slice(1);
  assert.equal(cells.length, 12, 'six cells of a label over a body');
  cells.forEach((ph, i) => {
    assert.equal(ph.index, Math.floor(i / 2));
    assert.equal(ph.group, `c${Math.floor(i / 2) + 1}`);
    assert.equal(ph.role, i % 2 === 0 ? 'label' : 'body');
  });
  const labels = cells.filter((ph) => ph.role === 'label');
  // Row by row, left to right.
  assert.ok((labels[0]?.box.x ?? 1) < (labels[1]?.box.x ?? 0) && (labels[1]?.box.x ?? 1) < (labels[2]?.box.x ?? 0));
  assert.ok((labels[3]?.box.y ?? 0) > (labels[2]?.box.y ?? 1), 'the second row sits under the first');
  assert.equal(labels[3]?.box.x, labels[0]?.box.x, 'and starts where the first did');

  // Three across on the 12-column grid is four columns each: the column arithmetic.
  const three = expandRepeat({ count: 3, across: 3, cell: ['body:1'] }, LIBRARY.grid, { title: false }).placeholders;
  assert.equal(three.length, 3);
  assert.equal(three[0]?.box.w, 0.2867);
});

test('a stacked list keeps its number column beside the cell, and a timeline states its rule in the gap under the labels', () => {
  const rows = findStructure('numbered-rows');
  assert.ok(rows);
  const { placeholders } = expandStructure(rows, LIBRARY.grid);
  const first = placeholders.filter((ph) => ph.index === 0);
  assert.deepEqual(first.map((ph) => ph.role), ['number', 'label', 'body']);
  const [number, label] = first;
  assert.ok(number && label && number.box.x + number.box.w < label.box.x, 'the number sits left of its row');

  const timeline = findStructure('timeline');
  assert.ok(timeline);
  const expanded = expandStructure(timeline, LIBRARY.grid);
  assert.ok(expanded.rule, 'a timeline draws a rule');
  const firstLabel = expanded.placeholders.find((ph) => ph.role === 'label');
  const firstBody = expanded.placeholders.find((ph) => ph.role === 'body');
  assert.ok(firstLabel && firstBody);
  assert.ok(expanded.rule.y >= firstLabel.box.y + firstLabel.box.h && expanded.rule.y + expanded.rule.h <= firstBody.box.y,
    'between the labels and the bodies');
});

test('a title after a kicker keeps the rest of the band and half the gap under it: y 0.11, h 0.11 on the library grid', () => {
  const kicker = findStructure('kicker-title-body');
  assert.ok(kicker);
  const [label, title, body] = expandStructure(kicker, LIBRARY.grid).placeholders;
  assert.deepEqual(label?.box, { x: 0.05, y: 0.06, w: 0.9, h: 0.05 });
  assert.deepEqual(title?.box, { x: 0.05, y: 0.11, w: 0.9, h: 0.11 });
  assert.ok(title && body && title.box.y + title.box.h <= body.box.y, 'and stops above the content band');
});

test('a mirror is its structure turned left to right', () => {
  const left = findStructure('image-and-text');
  const right = findStructure('text-and-image');
  assert.ok(left && right);
  const a = expandStructure(left, LIBRARY.grid).placeholders;
  const b = expandStructure(right, LIBRARY.grid).placeholders;
  assert.equal(a.length, b.length);
  a.forEach((ph, i) => {
    const other = b[i];
    assert.ok(other);
    assert.equal(ph.role, other.role);
    assert.ok(Math.abs(ph.box.x - (1 - other.box.x - other.box.w)) < 1e-4);
  });
});

// ─── the built masters ───────────────────────────────────────────────────────

for (const { config, file } of PACKS) {
  const master = file.masters.find((m) => m.id === config.masterId) as SlideMasterV1;

  test(`${config.pack}: the tuned twelve keep their ids and gain the structure they restyle`, () => {
    for (const id of ARCHETYPE_IDS) {
      const a = master.archetypes.find((x) => x.id === id);
      assert.ok(a?.structure && LIBRARY_IDS.has(a.structure), `${id} names a library structure`);
    }
    assert.equal(master.archetypes.find((a) => a.id === 'content')?.structure, 'title-body');
    assert.equal(master.archetypes.find((a) => a.id === 'main-point')?.structure, 'statement');
    assert.equal(master.archetypes.find((a) => a.id === 'full-image')?.structure, 'full-image-caption');
    assert.equal(master.archetypes.find((a) => a.id === 'full-image-plain')?.structure, 'full-image',
      'the captionless full-page picture takes an id of its own, because full-image is taken');
  });

  test(`${config.pack}: every text placeholder states a weight, titles 700 and every body 400`, () => {
    for (const a of master.archetypes) {
      for (const ph of a.placeholders) {
        if (ph.kind === 'image') continue;
        assert.ok(ph.style?.weight, `${a.id} ${ph.role} states a weight`);
        if (ph.role === 'title') assert.equal(ph.style.weight, '700', `${a.id} title`);
        if (ph.role === 'body' || ph.role === 'subtitle' || ph.role === 'quote') assert.equal(ph.style.weight, '400', `${a.id} ${ph.role}`);
      }
    }
  });

  test(`${config.pack}: the generated archetypes sit in this master's own margins and title strip`, () => {
    const content = master.archetypes.find((a) => a.id === 'content');
    const title = content?.placeholders.find((ph) => ph.role === 'title');
    assert.ok(title);
    for (const id of ['columns-3', 'grid-3x2', 'stats-4', 'steps-3', 'chart']) {
      const a = master.archetypes.find((x) => x.id === id);
      const t = a?.placeholders.find((ph) => ph.role === 'title');
      assert.deepEqual(t?.box, title.box, `${id} puts its title where Title and body does`);
      const left = Math.min(...(a?.placeholders ?? []).map((ph) => ph.box.x));
      assert.equal(left, title.box.x, `${id} starts at the tuned margin`);
    }
  });

  test(`${config.pack}: a structure drawn as explicit fractions is moved into this master's margins`, () => {
    const title = master.archetypes.find((a) => a.id === 'content')?.placeholders.find((ph) => ph.role === 'title');
    assert.ok(title);
    for (const id of ['cover-title-image', 'closing-thanks']) {
      const a = master.archetypes.find((x) => x.id === id);
      assert.ok(a, `${id} is built`);
      const left = Math.min(...a.placeholders.filter((ph) => ph.kind !== 'image').map((ph) => ph.box.x));
      assert.equal(left, title.box.x, `${id} starts its words at the tuned margin, not the library's 0.05`);
    }
    const picture = master.archetypes.find((a) => a.id === 'cover-title-image')?.placeholders.find((ph) => ph.kind === 'image');
    assert.ok(picture && Math.abs(picture.box.x + picture.box.w - 1) < 1e-4, 'a picture that runs to the slide edge still does');
  });

  test(`${config.pack}: Image and text is Text and image turned left to right, panel and furniture with it`, () => {
    const split = master.archetypes.find((a) => a.id === 'split');
    const mirror = master.archetypes.find((a) => a.id === 'image-and-text');
    assert.ok(split && mirror);
    assert.equal(mirror.structure, 'image-and-text');
    assert.deepEqual(mirror.placeholders.map((ph) => ph.role), split.placeholders.map((ph) => ph.role));
    mirror.placeholders.forEach((ph, i) => {
      const other = split.placeholders[i];
      assert.ok(other);
      assert.ok(Math.abs(ph.box.x - (1 - other.box.x - other.box.w)) < 1e-4, `${ph.role} is reflected`);
      assert.deepEqual([ph.box.y, ph.box.w, ph.box.h], [other.box.y, other.box.w, other.box.h]);
      assert.deepEqual(ph.style, other.style);
    });
    assert.equal(mirror.furniture?.length, split.furniture?.length);
    const panel = master.furniture.find((f) => f.id === 'split-panel');
    const mirrored = mirror.furniture?.map((id) => master.furniture.find((f) => f.id === id)).find((f) => f?.kind === 'rect');
    assert.ok(panel && mirrored);
    assert.ok(Math.abs(mirrored.box.x - (1 - panel.box.x - panel.box.w)) < 1e-4, 'the panel moves to the other side');
    assert.equal(mirror.variants, undefined, 'and like Text and image it has no dark variant');
    assert.equal(master.archetypes.some((a) => a.id === 'image-and-text-dark'), false);
  });

  test(`${config.pack}: a picture over master furniture takes the scrim under the page number and leaves the logo off`, () => {
    const plain = master.archetypes.find((a) => a.id === 'full-image-plain');
    assert.ok(plain);
    const shown = (plain.furniture ?? []).map((id) => master.furniture.find((f) => f.id === id));
    assert.ok(shown.every((f) => f !== undefined));
    assert.equal(shown.some((f) => f?.kind === 'logo'), false, 'no mark on a photograph nobody has seen');
    const scrim = shown.find((f) => f?.kind === 'rect');
    const number = shown.find((f) => f?.kind === 'page-number');
    assert.ok(scrim && number, 'the page number stays, on the scrim');
    assert.ok(scrim.box.x <= number.box.x && scrim.box.y <= number.box.y
      && scrim.box.x + scrim.box.w >= number.box.x + number.box.w && scrim.box.y + scrim.box.h >= number.box.y + number.box.h);
  });

  test(`${config.pack}: every dark variant is the same geometry on the dark ground`, () => {
    let variants = 0;
    for (const a of master.archetypes) {
      const dark = darkVariantOf(master, a.id);
      if (!a.variants?.dark) continue;
      variants += 1;
      assert.ok(dark, `${a.id} names a dark variant the master carries`);
      assert.equal(dark.background?.dark, true);
      assert.equal(dark.variantOf, a.id, 'a variant says what it is the variant of');
      assert.equal(structureOf(dark), structureOf(a));
      assert.deepEqual(dark.placeholders.map((ph) => ph.box), a.placeholders.map((ph) => ph.box));
    }
    assert.ok(variants >= 20, `${variants} light archetypes carry a dark variant`);
    const light = master.archetypes.filter((a) => a.variantOf === undefined);
    assert.equal(light.length, EXPANDED_IDS.length, 'leaving the variants out lists one archetype per expanded structure');
    assert.equal(master.archetypes.length - light.length, variants);
    assert.equal(darkVariantOf(master, 'content')?.id, 'content-dark');
    assert.equal(darkVariantOf(master, 'title'), undefined, 'a slide that is already dark has none');
  });

  test(`${config.pack}: the master rules pass on the built file and refuse a missing weight or an unknown structure`, () => {
    const ids = libraryStructureIds(LIBRARY);
    const clean = slideMasterProblems(file as SlideMasterFileLike, config.file, ids);
    assert.deepEqual(clean, { errors: [], warnings: [] });

    const unweighted = structuredClone(file);
    const body = unweighted.masters[0]?.archetypes.find((a) => a.id === 'columns-3')?.placeholders.find((ph) => ph.role === 'body');
    assert.ok(body?.style);
    delete body.style.weight;
    assert.ok(slideMasterProblems(unweighted as SlideMasterFileLike, config.file, ids).errors.some((line) => /no weight/.test(line)));

    const unknown = structuredClone(file);
    const columns = unknown.masters[0]?.archetypes.find((a) => a.id === 'columns-3');
    assert.ok(columns);
    columns.structure = 'columns-99';
    assert.ok(slideMasterProblems(unknown as SlideMasterFileLike, config.file, ids).errors.some((line) => /columns-99/.test(line)));
  });
}

test('the generated type follows the master type scale: a master drawn at twice the scale gets twice the sizes', () => {
  const lollyStart = PACKS.find((p) => p.config.pack === 'lolly-start');
  assert.ok(lollyStart);
  const current = lollyStart.file.masters[0];
  assert.ok(current);
  const t = current.typeScale;
  const double: SlideMasterV1 = {
    ...current,
    typeScale: { title: t.title * 2, subtitle: t.subtitle * 2, body: t.body * 2, caption: t.caption * 2, number: t.number * 2, label: t.label * 2 },
  };
  const normal = buildMaster(current, LIBRARY, lollyStart.config);
  const large = buildMaster(double, LIBRARY, lollyStart.config);
  const size = (m: SlideMasterV1, id: string, role: string): number | undefined =>
    m.archetypes.find((a) => a.id === id)?.placeholders.find((ph) => ph.role === role)?.style?.fontSize;
  for (const [id, role] of [['cover-title-image', 'title'], ['columns-3', 'label'], ['columns-3', 'body'], ['title-subtitle-body', 'subtitle']] as const) {
    const a = size(normal, id, role);
    const b = size(large, id, role);
    assert.ok(a !== undefined && b !== undefined, `${id} ${role} states a size`);
    assert.ok(Math.abs(b - 2 * a) <= 1, `${id} ${role}: ${a} at the shipped scale, ${b} at twice it`);
  }
  assert.equal(size(normal, 'cover-title-image', 'title'), 59, 'and the shipped scale gives the sizes it always did');
});

test('neutralSlideMaster is the built lolly-start master', () => {
  const lollyStart = PACKS.find((p) => p.config.pack === 'lolly-start');
  assert.ok(lollyStart, 'the lolly-start master is always on disk');
  assert.deepEqual(neutralSlideMaster(), lollyStart.file.masters[0]);
});

// ─── structures and archetypes ───────────────────────────────────────────────

test('a structure id finds the archetype that restyles it, light before dark, and the id is the fallback', () => {
  const master = neutralSlideMaster();
  assert.equal(archetypeForStructure(master, 'title-body')?.id, 'content');
  assert.equal(archetypeForStructure(master, 'statement')?.id, 'main-point');
  assert.equal(archetypeForStructure(master, 'full-image')?.id, 'full-image-plain');
  assert.equal(archetypeForStructure(master, 'full-image-caption')?.id, 'full-image');
  assert.equal(archetypeForStructure(master, 'columns-3')?.id, 'columns-3', 'not its dark variant');
  assert.equal(archetypeForStructure(master, 'content')?.id, 'content', 'an archetype id answers for itself');
  assert.equal(archetypeForStructure(master, 'columns-5'), undefined, 'a structure this master does not carry');
  assert.equal(archetypeForStructure(master, 'columns-5', { nearest: true }), undefined, 'and has no nearest of the twelve');
  assert.equal(archetypeForStructure(master, 'section-numbered', { nearest: true })?.id, 'section');

  // A hand-written master from before the library: no structure fields, ids only.
  const old: SlideMasterV1 = { ...master, archetypes: master.archetypes.filter((a) => isKnownArchetypeId(a.id)).map((a) => ({ ...a, structure: undefined })) };
  assert.equal(archetypeForStructure(old, 'full-image')?.id, 'full-image');
  assert.equal(archetypeForStructure(old, 'title-body'), undefined);
  assert.equal(archetypeForStructure(old, 'title-body', { nearest: true })?.id, 'content');
});

// ─── search ──────────────────────────────────────────────────────────────────

test('search reads digits and number words alike, and finds the PowerPoint and Google names', () => {
  assert.deepEqual(searchTokens('Four boxes'), ['4', 'box']);
  assert.deepEqual(searchTokens('columns-4'), ['column', '4']);
  const four = searchStructures('4');
  for (const id of ['columns-4', 'steps-4', 'stats-4', 'image-grid-2x2', 'grid-2x2']) assert.ok(four.includes(id), `4 finds ${id}`);
  assert.equal(searchStructures('four boxes')[0], 'columns-4');
  assert.equal(searchStructures('4 box')[0], 'columns-4');
  assert.equal(searchStructures('columns-4')[0], 'columns-4', 'an exact id comes first');
  const twoContent = searchStructures('two content');
  assert.ok(twoContent.includes('columns-2') && twoContent.includes('text-two-column'));
  assert.ok(searchStructures('picture with caption').includes('image-caption'));
  assert.ok(searchStructures('swot').includes('grid-2x2'));
  assert.deepEqual(searchStructures(''), LIBRARY.structures.map((s) => s.id));
  assert.deepEqual(searchStructures('colmns'), [], 'no guess at a misspelling here; the chooser suggests one');
});

// ─── seeding, re-layout and the deck ─────────────────────────────────────────

const master = neutralSlideMaster();

test('a Six boxes frame seeds six grouped cells in reading order', () => {
  const seeded = seedFrame(master, 'grid-3x2', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded?.cells);
  assert.equal(seeded.cells.length, 6);
  seeded.cells.forEach((cell, k) => {
    assert.equal(cell.index, k);
    assert.equal(cell.group, `c${k + 1}`);
    assert.deepEqual(cell.layerIds, k === 0 ? ['f.label', 'f.body'] : [`f.label-${k + 1}`, `f.body-${k + 1}`]);
    assert.deepEqual(cell.optionalIds, [cell.layerIds[0]], 'the label may stay empty');
  });
  const at = (id: string): { x: number; y: number } => {
    const row = seeded.layers.find((r) => r.id === id);
    return { x: Number(row?.x), y: Number(row?.y) };
  };
  assert.ok(at('f.label').x < at('f.label-2').x && at('f.label-2').x < at('f.label-3').x);
  assert.ok(at('f.label-4').y > at('f.label').y);
  assert.equal(seedFrame(master, 'content', { frameId: 'f', x: 0, y: 0 })?.cells, undefined, 'a slide with no cells lists none');
});

test('leaving the optional labels out keeps every other id where it was', () => {
  const all = seedFrame(master, 'columns-3', { frameId: 'f', x: 0, y: 0 });
  const lean = seedFrame(master, 'columns-3', { frameId: 'f', x: 0, y: 0, omitOptional: true });
  assert.ok(all && lean);
  assert.equal(all.layers.filter((r) => r.role === 'label').length, 3);
  assert.equal(lean.layers.filter((r) => r.role === 'label').length, 0);
  assert.deepEqual(lean.layers.filter((r) => r.role === 'body').map((r) => r.id), ['f.body', 'f.body-2', 'f.body-3']);
  assert.deepEqual(lean.cells?.map((c) => c.layerIds), [['f.body'], ['f.body-2'], ['f.body-3']]);
});

test('a repeat is never expanded at runtime: the seed reads the placeholders the master states, and the rules refuse a repeat with no cells', () => {
  const built = master.archetypes.find((a) => a.id === 'columns-3');
  assert.ok(built?.repeat);
  const title = built.placeholders.find((ph) => ph.role === 'title');
  assert.ok(title);
  const handWritten: ArchetypeV1 = { id: 'columns-3', name: 'Three boxes', repeat: built.repeat, placeholders: [title], background: built.background };
  const small: SlideMasterV1 = { ...master, archetypes: [handWritten] };
  const seeded = seedFrame(small, 'columns-3', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  assert.equal(seeded.cells, undefined, 'no cells were stated, so none are seeded');
  assert.deepEqual(seeded.layers.filter((r) => r.role).map((r) => r.role), ['title']);

  const file = { version: 1, library: { id: 'x', version: '1' }, masters: [small] } as SlideMasterFileLike;
  const { errors } = slideMasterProblems(file, 'hand-written', libraryStructureIds(LIBRARY));
  assert.ok(errors.some((line) => /states a repeat but none of its cells/.test(line)), errors.join('\n'));
});

test('Title and body re-lays into Three boxes and Six boxes and back, and a reset puts a nudged cell back', () => {
  const seeded = seedFrame(master, 'columns-3', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const filled = seeded.layers.map((r) => (r.role === 'body' ? { ...r, text: `Box ${String(r.id)}` } : r));
  const six = applyArchetype(master, 'columns-3', 'grid-3x2', filled, { x: 0, y: 0 });
  const sixSeed = seedFrame(master, 'grid-3x2', { frameId: 'f', x: 0, y: 0 });
  assert.ok(sixSeed);
  for (const id of ['f.body', 'f.body-2', 'f.body-3']) {
    const moved = six.find((r) => r.id === id);
    const cell: DesignBoxRowV1 | undefined = sixSeed.layers.find((r) => r.id === id);
    assert.deepEqual([moved?.x, moved?.y, moved?.w, moved?.h], [cell?.x, cell?.y, cell?.w, cell?.h], `${id} takes its cell`);
    assert.equal(moved?.text, `Box ${id}`, 'and keeps its words');
  }
  const back = applyArchetype(master, 'grid-3x2', 'columns-3', six, { x: 0, y: 0 });
  assert.deepEqual(back.map((r) => [r.x, r.y, r.w, r.h]), filled.map((r) => [r.x, r.y, r.w, r.h]));

  const nudged = six.map((r) => (r.id === 'f.body-2' ? { ...r, x: 3, y: 3 } : r));
  const reset = resetFrame(master, 'grid-3x2', nudged, { x: 0, y: 0 });
  const body2 = reset.find((r) => r.id === 'f.body-2');
  const home: DesignBoxRowV1 | undefined = sixSeed.layers.find((r) => r.id === 'f.body-2');
  assert.deepEqual([body2?.x, body2?.y], [home?.x, home?.y]);
});

test('a Design document with archetype content lowers to placeholder-bound slides on the built master', async () => {
  const tokens = starterTokens;
  const content = seedFrame(master, 'content', { frameId: 'a', x: 0, y: 0, resolveToken: tokens });
  const boxes = seedFrame(master, 'grid-3x2', { frameId: 'b', x: 1400, y: 0, resolveToken: tokens });
  assert.ok(content && boxes);
  content.frame.order = 0;
  boxes.frame.order = 1;
  const fill = (rows: typeof content.layers): typeof content.layers =>
    rows.map((r) => (r.kind === 'text' && r.role ? { ...r, text: `Words for ${String(r.id)}` } : r));
  const out = await designFramesToPptx({
    frames: [{ row: content.frame, layers: fill(content.layers) }, { row: boxes.frame, layers: fill(boxes.layers) }],
    master,
    tokens,
  });
  assert.deepEqual(out.layoutOfArchetype.map((e) => e.archetype), ['content', 'grid-3x2']);
  const bound = (i: number): number => (out.slides[i]?.shapes ?? []).filter((s) => s.kind === 'text' && s.ph).length;
  assert.equal(bound(0), 2, 'the title and the body are bound');
  assert.equal(bound(1), 13, 'the title and the six labels and six bodies are bound');
});

test('every archetype of both built masters exports with unique placeholder indices, and a figure is never a slide number', async () => {
  for (const { config, file } of PACKS) {
    const packMaster = file.masters.find((m) => m.id === config.masterId);
    assert.ok(packMaster);
    const frames = packMaster.archetypes.map((a, i) => {
      const seeded = seedFrame(packMaster, a.id, { frameId: `s${i}`, x: i * 1400, y: 0, resolveToken: starterTokens });
      assert.ok(seeded, `${config.pack} ${a.id} seeds`);
      seeded.frame.order = i;
      const layers = seeded.layers.map((r) => (r.kind === 'text' && r.role ? { ...r, text: `Words for ${String(r.id)}` } : r));
      return { row: seeded.frame, layers };
    });
    const out = await designFramesToPptx({ frames, master: packMaster, tokens: starterTokens });
    for (const layout of out.layouts) {
      const placeholders = layout.placeholders ?? [];
      const idx = placeholders.map((ph) => ph.idx).filter((n) => n !== undefined);
      assert.equal(new Set(idx).size, idx.length, `${config.pack} layout ${layout.name}: ${JSON.stringify(placeholders.map((ph) => [ph.type, ph.idx]))}`);
      assert.equal(placeholders.some((ph) => ph.type === 'sldNum'), false, `${config.pack} layout ${layout.name} binds no figure as a slide number`);
    }
    out.slides.forEach((slide, i) => {
      const idx = slide.shapes.flatMap((sh) => (sh.kind === 'text' && sh.ph?.idx !== undefined ? [sh.ph.idx] : []));
      assert.equal(new Set(idx).size, idx.length, `${config.pack} slide ${i + 1} (${packMaster.archetypes[i]?.id})`);
    });
  }
});

test('a deck planned and compiled against the built master still binds and re-lays its frames', async () => {
  const bytes = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/rebrand/simple.pptx')));
  const run = await runRebrandPipeline('simple.pptx', bytes);
  assert.ok(run.plan.slides.every((slide) => isKnownArchetypeId(slide.layout)),
    'with no rule for the library archetypes yet, the first pass picks among the twelve as it always has');
  const frames = framesOfDesignDoc({ boxes: compiledRows(run.compiled) });
  assert.equal(frames.length, run.compiled.frames.length);
  const out = await designFramesToPptx({ frames, master: STARTER_MASTER, tokens: starterTokens });
  assert.equal(out.slides.length, frames.length);
  for (const [i, frame] of frames.entries()) {
    assert.ok(out.slides[i]?.shapes.some((s) => s.kind === 'text' && s.ph), `slide ${i + 1} (${String(frame.row.archetype)}) carries a placeholder binding`);
  }

  const contentFrame = frames.find((f) => f.row.archetype === 'content');
  assert.ok(contentFrame, 'the fixture has a Title and body slide');
  const x = Number(contentFrame.row.x);
  const y = Number(contentFrame.row.y);
  const asBoxes = applyArchetype(STARTER_MASTER, 'content', 'columns-3', contentFrame.layers, { x, y });
  const body = asBoxes.find((r) => r.role === 'body');
  const firstCell = STARTER_MASTER.archetypes.find((a) => a.id === 'columns-3')?.placeholders.find((ph: PlaceholderLayerV1) => ph.role === 'body');
  assert.ok(body && firstCell);
  assert.equal(body.x, Math.round(x + firstCell.box.x * 1280), 'the body moves into the first box');
  const reset = resetFrame(STARTER_MASTER, 'content', asBoxes, { x, y });
  const original = contentFrame.layers.find((r) => r.role === 'body');
  assert.deepEqual([reset.find((r) => r.role === 'body')?.x, reset.find((r) => r.role === 'body')?.y], [original?.x, original?.y]);
});
