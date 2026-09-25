// SPDX-License-Identifier: MPL-2.0
/**
 * Slide masters as design-system data (plan 274 section 3.4).
 *
 * Covers the contract (packages/core/src/slide-master-v1.ts), the pure seeding and
 * re-layout in engine/src/slide-master.ts, and the two masters that ship in the
 * brand packs. Geometry is pinned as whole numbers, because those numbers are what
 * a compiled deck and a Design frame are made of.
 *
 * The SUSE master lives in a private submodule, so this file reads whichever masters
 * are on disk and always has the lolly-start one to work with. A public clone runs
 * every test here; it just has one master to run them against.
 *
 * Run with: node --test tests/slide-master.test.ts
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import Ajv from 'ajv/dist/2020.js';
import { ARCHETYPE_IDS, ARCHETYPE_ROLES, findArchetype, findFurniture, roleFontSize } from '../packages/core/src/index.ts';
import type {
  ArchetypeIdV1,
  DesignBoxRowV1,
  SlideMasterFileV1,
  SlideMasterV1,
} from '../packages/core/src/index.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { bgIsDark } from '../engine/src/logo-variant.ts';
import { applyArchetype, masterBoxToPx, resetFrame, seedFrame } from '../engine/src/slide-master.ts';
import { findStructure, slideStructureLibrary } from '../engine/src/slide-structures.ts';
import { resolveProfileDesignSystem } from '../packages/node-shell/src/rebrand/index.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const read = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
const onDisk = (rel: string): boolean => existsSync(fileURLToPath(new URL(rel, import.meta.url)));

const SCHEMA = read('../schemas/slide-master-v1.schema.json');
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => ((d: unknown) => boolean) & { errors?: unknown } };
const validate = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

const PACKS: Array<{ pack: string; path: string }> = [
  { pack: 'lolly-start', path: '../brands/lolly-start/catalog/assets/lolly/slides/masters.json' },
  { pack: 'suse', path: '../brands/suse/catalog/assets/suse/slides/masters.json' },
];

const present = PACKS.filter((p) => onDisk(p.path)).map((p) => ({
  ...p,
  file: read(p.path) as SlideMasterFileV1,
}));

test('the lolly-start master is always on disk, so this file always has one to read', () => {
  assert.ok(present.some((p) => p.pack === 'lolly-start'), 'brands/lolly-start/.../slides/masters.json is missing');
});

for (const { pack, path, file } of present) {
  test(`${pack}: masters.json validates against schemas/slide-master-v1.schema.json`, () => {
    assert.equal(validate(file), true, JSON.stringify(validate.errors, null, 1));
    assert.equal(file.version, 1);
    assert.equal(file.masters.length, 1, `${path} ships one master today`);
  });

  const master = file.masters[0] as SlideMasterV1;

  test(`${pack}: the master carries the twelve and every library structure the build expands, at 1280 by 720`, () => {
    assert.deepEqual(master.size, { width: 1280, height: 720 });
    const ids = master.archetypes.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'archetype ids are unique');
    for (const id of ARCHETYPE_IDS) assert.ok(ids.includes(id), `the tuned ${id} archetype is kept under its own id`);
    assert.deepEqual(master.archetypes.slice(0, ARCHETYPE_IDS.length).map((a) => a.id), [...ARCHETYPE_IDS],
      'the twelve come first, in the order the masters have always listed them');
    const library = slideStructureLibrary();
    const structures = new Set(master.archetypes.map((a) => a.structure));
    for (const id of library.expanded) assert.ok(structures.has(id), `no archetype restyles the library structure ${id}`);
    for (const a of master.archetypes) {
      assert.ok(a.structure && findStructure(a.structure), `${a.id} names a structure the library holds`);
    }
    assert.deepEqual(file.library, { id: library.id, version: String(library.version) }, 'the file names the library it restyles');
  });

  test(`${pack}: every furniture reference resolves and every box stays on the slide`, () => {
    const ids = new Set(master.furniture.map((f) => f.id));
    assert.equal(ids.size, master.furniture.length, 'furniture ids are unique');
    for (const a of master.archetypes) {
      for (const id of a.furniture ?? []) {
        assert.ok(ids.has(id), `${a.id} names furniture ${id} the master does not carry`);
        assert.ok(findFurniture(master, id), `findFurniture cannot find ${id}`);
      }
      assert.ok(a.placeholders.length > 0, `${a.id} has no placeholder`);
      for (const p of a.placeholders) {
        assert.ok(p.box.x >= 0 && p.box.y >= 0, `${a.id}/${p.role} starts off the slide`);
        assert.ok(p.box.x + p.box.w <= 1.0001, `${a.id}/${p.role} runs off the right edge`);
        assert.ok(p.box.y + p.box.h <= 1.0001, `${a.id}/${p.role} runs off the bottom edge`);
      }
    }
    for (const f of master.furniture) {
      assert.ok(f.box.x + f.box.w <= 1.0001, `${f.id} runs off the right edge`);
      assert.ok(f.box.y + f.box.h <= 1.0001, `${f.id} runs off the bottom edge`);
    }
  });

  test(`${pack}: the logo follows the background and states the tags it is found by`, () => {
    assert.equal(master.logo.variantByBackground, true);
    const tags = master.logo.assetTags;
    assert.ok(tags, 'a master states how its logo is found');
    assert.ok(tags.onLight.includes('logo') && tags.onDark.includes('logo'));
  });
}

// ---------------------------------------------------------------------------
// Seeding: the numbers a Design frame is actually made of
// ---------------------------------------------------------------------------

/** [id, kind, x, y, w, h, binding] for every row a seed produces, frame excluded. */
type RowShape = [string, unknown, unknown, unknown, unknown, unknown, unknown];

const shape = (rows: DesignBoxRowV1[]): RowShape[] =>
  rows.map((r) => [String(r.id), r.kind, r.x, r.y, r.w, r.h, r.role ?? r.furniture]);

/**
 * Both masters share the template geometry, so one table pins both. The SUSE one adds
 * the segmented footer bar; that difference is asserted separately below.
 */
const SEEDS: Record<'title' | 'content' | 'visual', RowShape[]> = {
  title: [
    ['f.title', 'text', 44, 158, 925, 288, 'title'],
    ['f.subtitle', 'text', 44, 465, 1193, 111, 'subtitle'],
    ['f.logo-hero', 'image', 68, 54, 215, 63, 'logo-hero'],
  ],
  content: [
    ['f.title', 'text', 44, 25, 1192, 80, 'title'],
    ['f.body', 'text', 44, 137, 1192, 473, 'body'],
    ['f.footer', 'text', 205, 671, 320, 21, 'footer'],
    ['f.logo', 'image', 31, 662, 107, 32, 'logo'],
    ['f.page-number', 'text', 542, 660, 76, 37, 'page-number'],
  ],
  visual: [
    ['f.visual', 'image', 44, 137, 1192, 473, 'visual'],
    ['f.title', 'text', 44, 25, 1192, 80, 'title'],
    ['f.footer', 'text', 205, 671, 320, 21, 'footer'],
    ['f.logo', 'image', 31, 662, 107, 32, 'logo'],
    ['f.page-number', 'text', 542, 660, 76, 37, 'page-number'],
  ],
};

const BARS: RowShape[] = [
  ['f.bar-mint', 'box', 639, 671, 230, 15, 'bar-mint'],
  ['f.bar-blue', 'box', 869, 671, 93, 15, 'bar-blue'],
  ['f.bar-orange', 'box', 962, 671, 47, 15, 'bar-orange'],
  ['f.bar-green', 'box', 1009, 671, 271, 15, 'bar-green'],
];

/** Where the bars go among the content furniture: before the footer, logo and number. */
function expected(master: SlideMasterV1, archetype: 'title' | 'content' | 'visual'): RowShape[] {
  const base = SEEDS[archetype];
  const hasBars = master.furniture.some((f) => f.id === 'bar-mint');
  if (!hasBars || archetype === 'title') return base;
  const cut = base.findIndex((r) => r[0] === 'f.footer');
  return [...base.slice(0, cut), ...BARS, ...base.slice(cut)];
}

for (const { pack, file } of present) {
  const master = file.masters[0] as SlideMasterV1;
  for (const archetype of ['title', 'content', 'visual'] as const) {
    test(`${pack}: seedFrame lays out ${archetype} at the template numbers`, () => {
      const seeded = seedFrame(master, archetype, { frameId: 'f', x: 0, y: 0 });
      assert.ok(seeded, 'the archetype is on the master');
      assert.deepEqual(seeded.frame.id, 'f');
      assert.equal(seeded.frame.kind, 'frame');
      assert.equal(seeded.frame.w, 1280);
      assert.equal(seeded.frame.h, 720);
      assert.equal(seeded.frame.master, master.id);
      assert.equal(seeded.frame.archetype, archetype);
      assert.deepEqual(shape(seeded.layers), expected(master, archetype));
      for (const row of seeded.layers) {
        assert.equal(row.frame, 'f', `${String(row.id)} names its frame`);
        assert.equal(row.master, master.id, `${String(row.id)} keeps its master binding`);
        assert.ok(row.role || row.furniture, `${String(row.id)} is bound to a role or to furniture`);
      }
      assert.equal(seeded.frame.order, 0, 'order is the frame page number, and a new slide starts at 0');
      for (const row of seeded.layers) {
        assert.equal(row.order, undefined, `${String(row.id)} carries no order: paint order is array order`);
      }
    });
  }

  test(`${pack}: the frame origin shifts every layer and nothing else`, () => {
    const at00 = seedFrame(master, 'content', { frameId: 'f', x: 0, y: 0 });
    const at2k = seedFrame(master, 'content', { frameId: 'f', x: 2000, y: 400 });
    assert.ok(at00 && at2k);
    assert.equal(at2k.frame.x, 2000);
    assert.equal(at2k.frame.y, 400);
    at00.layers.forEach((row, i) => {
      const moved = at2k.layers[i];
      assert.ok(moved);
      assert.equal(moved.x, Number(row.x) + 2000);
      assert.equal(moved.y, Number(row.y) + 400);
      assert.equal(moved.w, row.w);
      assert.equal(moved.h, row.h);
    });
  });
}

test('no content box starts flush on the title band: the body clears the title (formatting fixture, slide 2)', () => {
  for (const pack of present) {
    for (const master of pack.file.masters) {
      for (const a of master.archetypes) {
        const title = a.placeholders.find((ph) => ph.role === 'title');
        if (!title) continue;
        const bottom = title.box.y + title.box.h;
        for (const ph of a.placeholders) {
          if (ph === title || ph.role === 'subtitle' || ph.overlay) continue;
          const flush: boolean = Math.abs(ph.box.y - bottom) <= 0.005 && ph.box.x < title.box.x + title.box.w && title.box.x < ph.box.x + ph.box.w;
          assert.equal(flush, false, `${master.id} ${a.id}: the ${ph.role} box starts on the title's bottom edge`);
        }
      }
    }
  }
});

const [firstPack] = present;
assert.ok(firstPack);
const M = firstPack.file.masters[0] as SlideMasterV1;

test('seedFrame refuses an archetype the master does not carry', () => {
  assert.equal(seedFrame(M, 'not-an-archetype' as ArchetypeIdV1, { frameId: 'f', x: 0, y: 0 }), null);
});

test('seedFrame resolves token paths through the injected resolver only', () => {
  const bare = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0 });
  assert.ok(bare);
  assert.equal(bare.frame.bg, undefined, 'no resolver means no colour invented');

  const seen: string[] = [];
  const withTokens = seedFrame(M, 'content', {
    frameId: 'f',
    x: 0,
    y: 0,
    resolveToken: (p) => {
      seen.push(p);
      return p === 'color.semantic.surface' ? '#ffffff' : '#123456';
    },
  });
  assert.ok(withTokens);
  assert.ok(seen.includes('color.semantic.surface'), 'the content background is asked for');
  assert.equal(withTokens.frame.bg, '#ffffff');
  const title = withTokens.layers.find((r) => r.role === 'title');
  assert.equal(title?.fg, '#123456');
});

test('a dark archetype takes the reverse mark and a light one takes the standard mark', () => {
  const logos = { onLight: 'mark/light', onDark: 'mark/dark' };
  const dark = seedFrame(M, 'title', { frameId: 'f', x: 0, y: 0, logos, resolveToken: () => '#0c322c' });
  const light = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0, logos, resolveToken: () => '#ffffff' });
  assert.equal(dark?.layers.find((r) => r.furniture === 'logo-hero')?.image, 'mark/dark');
  assert.equal(light?.layers.find((r) => r.furniture === 'logo')?.image, 'mark/light');
});

test('role font sizes come from the type scale unless the placeholder overrides them', () => {
  const content = findArchetype(M, 'content');
  assert.ok(content);
  const body = content.placeholders.find((p) => p.role === 'body');
  assert.ok(body);
  assert.equal(roleFontSize(M, 'body', body.style), M.typeScale.body);
  const cover = findArchetype(M, 'title');
  const coverTitle = cover?.placeholders.find((p) => p.role === 'title');
  assert.equal(roleFontSize(M, 'title', coverTitle?.style), 69, 'the cover title states its own size');
  assert.notEqual(69, M.typeScale.title);
});

test('masterBoxToPx is the same conversion the seed uses', () => {
  const content = findArchetype(M, 'content');
  const body = content?.placeholders.find((p) => p.role === 'body');
  assert.ok(body);
  assert.deepEqual(masterBoxToPx(M, body.box), { x: 44, y: 137, w: 1192, h: 473 });
});

// ---------------------------------------------------------------------------
// Apply archetype and reset
// ---------------------------------------------------------------------------

/** A layer nobody bound: no role, no furniture, no master. It must never move. */
const UNBOUND: DesignBoxRowV1 = { id: 'sticky-note', kind: 'text', x: 610, y: 320, w: 220, h: 90, text: 'ask legal' };

test('applyArchetype re-lays a role-bound text and leaves an unbound layer alone', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const before = seeded.layers.map((r) => ({ ...r }));
  const body = before.find((r) => r.role === 'body');
  assert.ok(body);
  body.text = 'The point of the slide';
  const layers = [...before, UNBOUND];

  const after = applyArchetype(M, 'content', 'two-column', layers, { x: 0, y: 0 });

  const movedBody = after.find((r) => r.role === 'body');
  assert.ok(movedBody);
  assert.deepEqual(
    { x: movedBody.x, y: movedBody.y, w: movedBody.w, h: movedBody.h },
    { x: 69, y: 187, w: 539, h: 430 },
    'the body takes the first column of two-column',
  );
  assert.equal(movedBody.text, 'The point of the slide', 'content rides along');
  assert.equal(movedBody.fontSize, 20, 'and takes the column type size');

  const title = after.find((r) => r.role === 'title');
  assert.deepEqual([title?.x, title?.y, title?.w, title?.h], [44, 25, 1192, 80], 'the title strip is the same in both');

  const sticky = after.find((r) => r.id === 'sticky-note');
  assert.equal(sticky, UNBOUND, 'an unbound layer comes back by reference, untouched');
  assert.deepEqual([sticky?.x, sticky?.y], [610, 320]);
  assert.equal(after.length, layers.length, 'apply never adds or drops a layer');
});

test('a second body layer takes the second column, in order', () => {
  const seeded = seedFrame(M, 'two-column', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const bodies = seeded.layers.filter((r) => r.role === 'body');
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0]?.id, 'f.body');
  assert.equal(bodies[1]?.id, 'f.body-2');
  assert.deepEqual([bodies[0]?.x, bodies[1]?.x], [69, 672]);

  // Going back to content, which has one body slot, keeps the surplus where it is.
  const back = applyArchetype(M, 'two-column', 'content', seeded.layers, { x: 0, y: 0 });
  const backBodies = back.filter((r) => r.role === 'body');
  assert.deepEqual([backBodies[0]?.x, backBodies[0]?.y], [44, 137], 'the first body takes the content slot');
  assert.deepEqual([backBodies[1]?.x, backBodies[1]?.y], [672, 187], 'the surplus one is left for the caller to report');
});

test('resetFrame puts moved placeholders and furniture back', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const nudged = seeded.layers.map((r) => ({ ...r }));
  const body = nudged.find((r) => r.role === 'body');
  const logo = nudged.find((r) => r.furniture === 'logo');
  assert.ok(body && logo);
  body.x = Number(body.x) + 200;
  body.y = Number(body.y) + 100;
  body.text = 'typed by a person';
  logo.x = 5;

  const reset = resetFrame(M, 'content', [...nudged, UNBOUND]);
  const resetBody = reset.find((r) => r.role === 'body');
  assert.deepEqual([resetBody?.x, resetBody?.y, resetBody?.w, resetBody?.h], [44, 137, 1192, 473]);
  assert.equal(resetBody?.text, 'typed by a person', 'reset moves geometry, never content');
  assert.deepEqual([reset.find((r) => r.furniture === 'logo')?.x], [31]);
  assert.equal(reset.find((r) => r.id === 'sticky-note'), UNBOUND);
});

test('resetFrame reads the frame origin back from the layers when it is not told', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 3000, y: 900 });
  assert.ok(seeded);
  const nudged = seeded.layers.map((r) => ({ ...r }));
  const body = nudged.find((r) => r.role === 'body');
  assert.ok(body);
  body.x = 0;
  body.y = 0;

  const reset = resetFrame(M, 'content', nudged);
  const resetBody = reset.find((r) => r.role === 'body');
  assert.deepEqual([resetBody?.x, resetBody?.y], [3044, 1037], 'one dragged layer cannot move the frame');
});

test('applyArchetype with an archetype the master does not carry changes nothing', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const out = applyArchetype(M, 'content', 'nope' as ArchetypeIdV1, seeded.layers);
  assert.deepEqual(out, seeded.layers);
});

// ---------------------------------------------------------------------------
// The logo mark: which background decides it, and when it is decided again
// ---------------------------------------------------------------------------

const MARKS = { onLight: 'mark/light', onDark: 'mark/dark' };

/**
 * One resolver both packs can use: the two ink token paths come back dark, everything
 * else white. lolly-start paints its split panel with `color.semantic.text` and SUSE
 * with `color.brand.pine`, so the same function gives each pack its own real answer.
 */
const INK = new Set(['color.semantic.text', 'color.brand.pine']);
const resolveInk = (path: string): string => (INK.has(path) ? '#0c322c' : '#ffffff');

const markOn = (rows: DesignBoxRowV1[], furniture: string): unknown =>
  rows.find((r) => r.furniture === furniture)?.image;

for (const { pack, file } of present) {
  const master = file.masters[0] as SlideMasterV1;

  test(`${pack}: the mark reads the background under the logo, not the slide's own`, () => {
    const split = seedFrame(master, 'split', { frameId: 'f', x: 0, y: 0, logos: MARKS, resolveToken: resolveInk });
    assert.ok(split);
    assert.equal(split.frame.bg, '#ffffff', 'a split slide is a light slide');
    assert.equal(markOn(split.layers, 'logo'), 'mark/dark', 'and its logo sits on the dark panel');

    const content = seedFrame(master, 'content', { frameId: 'f', x: 0, y: 0, logos: MARKS, resolveToken: resolveInk });
    assert.ok(content);
    assert.equal(markOn(content.layers, 'logo'), 'mark/light', 'nothing is painted under the content logo');
  });

  test(`${pack}: a slide moved to another archetype picks its mark again`, () => {
    const seeded = seedFrame(master, 'content', { frameId: 'f', x: 0, y: 0, logos: MARKS, resolveToken: resolveInk });
    assert.ok(seeded);
    assert.equal(markOn(seeded.layers, 'logo'), 'mark/light');

    const opts = { x: 0, y: 0, resolveToken: resolveInk, logos: MARKS };
    const onTitle = applyArchetype(master, 'content', 'title', seeded.layers, opts);
    assert.equal(markOn(onTitle, 'logo'), 'mark/dark', 'the title archetype is dark, so the reverse mark goes on');

    const andBack = applyArchetype(master, 'title', 'content', onTitle, opts);
    assert.equal(markOn(andBack, 'logo'), 'mark/light', 'and back again');

    const noLogos = applyArchetype(master, 'content', 'title', seeded.layers, { x: 0, y: 0, resolveToken: resolveInk });
    assert.equal(markOn(noLogos, 'logo'), 'mark/light', 'a caller that passes no logos keeps the mark it has');
  });

  test(`${pack}: the footer and the page number are chrome-sized, 8pt at the master size`, () => {
    assert.equal(master.typeScale.label, 11, 'both deck tools draw the footer at 8pt, which is 11px at 96dpi');
    assert.equal(master.typeScale.number, 11, 'and the page number with it');
    const seeded = seedFrame(master, 'content', { frameId: 'f', x: 0, y: 0 });
    assert.ok(seeded);
    assert.equal(seeded.layers.find((r) => r.furniture === 'footer')?.fontSize, 11);
    assert.equal(seeded.layers.find((r) => r.furniture === 'page-number')?.fontSize, 11);
  });

  test(`${pack}: every archetype states whether it is dark, and a literal hex agrees`, () => {
    for (const a of master.archetypes) {
      const bg = a.background;
      assert.ok(bg, `${a.id} states no background`);
      assert.equal(typeof bg.dark, 'boolean', `${a.id} leaves the mark to a measurement it may not agree with`);
      if (typeof bg.hex === 'string') {
        assert.equal(bgIsDark(bg.hex), bg.dark, `${a.id} states dark ${String(bg.dark)} for ${bg.hex}`);
      }
    }
  });

  test(`${pack}: no furniture id spells a placeholder role, so no two seeded layers share an id`, () => {
    const roles = new Set<string>(ARCHETYPE_ROLES);
    for (const f of master.furniture) {
      assert.ok(!roles.has(f.id), `furniture ${f.id} would collide with the ${f.id} placeholder id`);
      const dash = f.id.lastIndexOf('-');
      if (dash > 0 && /^\d+$/.test(f.id.slice(dash + 1))) {
        assert.ok(!roles.has(f.id.slice(0, dash)), `furniture ${f.id} would collide with a numbered placeholder id`);
      }
    }
    const seeded = seedFrame(master, 'two-column', { frameId: 'f', x: 0, y: 0 });
    assert.ok(seeded);
    const ids = seeded.layers.map((r) => String(r.id));
    assert.equal(new Set(ids).size, ids.length, 'a seeded frame has no two layers with one id');
  });
}

// ---------------------------------------------------------------------------
// What a re-layout reads, and what it restates
// ---------------------------------------------------------------------------

test('geometry that arrived as text is still geometry', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 3000, y: 900 });
  assert.ok(seeded);
  // A URL, a `?z=` document or a saved session hands every non-asset field back as a
  // string, which is why Design coerces with num() everywhere.
  const asText = seeded.layers.map((row) => {
    const out: DesignBoxRowV1 = { ...row };
    for (const key of ['x', 'y', 'w', 'h']) out[key] = String(out[key]);
    return out;
  });
  const reset = resetFrame(M, 'content', asText);
  const body = reset.find((r) => r.role === 'body');
  assert.deepEqual([body?.x, body?.y], [3044, 1037], 'the frame stays where it was, rather than at the canvas origin');
});

test('no bound layer states an origin, so the layers are left alone', () => {
  const stray: DesignBoxRowV1[] = [
    { id: 'a', kind: 'text', x: 500, y: 500, w: 100, h: 20, text: 'a note' },
    { id: 'b', kind: 'text', role: 'body', w: 100, h: 20, text: 'no position at all' },
  ];
  const out = resetFrame(M, 'content', stray);
  assert.deepEqual(out, stray, 'nothing is moved to 0,0 on the strength of a guess');
});

test('the columns keep their own content when one is brought to the front', () => {
  const seeded = seedFrame(M, 'two-column', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const rows = seeded.layers.map((r) => ({ ...r }));
  const left = rows.find((r) => r.id === 'f.body');
  const right = rows.find((r) => r.id === 'f.body-2');
  assert.ok(left && right);
  left.text = 'LEFT COLUMN';
  right.text = 'RIGHT COLUMN';

  const raised = rows.filter((r) => r !== right).concat(right);
  const reset = resetFrame(M, 'two-column', raised, { x: 0, y: 0 });
  assert.equal(reset.find((r) => r.id === 'f.body')?.x, 69, 'the first column is still the first column');
  assert.equal(reset.find((r) => r.id === 'f.body-2')?.x, 672);
  assert.equal(reset.find((r) => r.id === 'f.body')?.text, 'LEFT COLUMN');
  assert.equal(reset.find((r) => r.id === 'f.body-2')?.text, 'RIGHT COLUMN');
});

test('a picture takes the target archetype fit, so it stops being cropped', () => {
  const seeded = seedFrame(M, 'split', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  assert.equal(seeded.layers.find((r) => r.role === 'visual')?.fit, 'cover', 'split fills its panel');
  const moved = applyArchetype(M, 'split', 'visual', seeded.layers, { x: 0, y: 0 });
  assert.equal(moved.find((r) => r.role === 'visual')?.fit, 'contain', 'the visual archetype shows the whole picture');
});

test('a re-layout states the target type and drops what only the old archetype said', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0, resolveToken: resolveInk });
  assert.ok(seeded);
  const before = seeded.layers.find((r) => r.role === 'title');
  assert.equal(before?.weight, '700', 'the content title is bold in both packs');

  const moved = applyArchetype(M, 'content', 'main-point', seeded.layers, { x: 0, y: 0, resolveToken: resolveInk });
  const after = moved.find((r) => r.role === 'title');
  assert.equal(after?.fontSize, 59, 'the main-point title states its own size');
  assert.equal(after?.weight, '700', 'and its own weight');
  assert.equal(after?.align, 'left', 'what the target does state is written');

  // Every master placeholder states a weight since plan 275, so a target that leaves
  // one out is made by hand here: the old archetype's weight must not ride along.
  const unweighted = structuredClone(M);
  const target = unweighted.archetypes.find((a) => a.id === 'main-point')?.placeholders.find((p) => p.role === 'title');
  assert.ok(target?.style);
  delete target.style.weight;
  const bare = applyArchetype(unweighted, 'content', 'main-point', seeded.layers, { x: 0, y: 0, resolveToken: resolveInk });
  assert.equal(bare.find((r) => r.role === 'title')?.weight, undefined, 'a weight the target does not state is dropped');
});

test('a stated dark background decides the mark, whatever the token resolves to', () => {
  // The title archetype is dark in both packs. A resolver that hands back white does
  // not change what the master said about its own background.
  const seeded = seedFrame(M, 'title', { frameId: 'f', x: 0, y: 0, logos: MARKS, resolveToken: () => '#ffffff' });
  assert.equal(markOn(seeded?.layers ?? [], 'logo-hero'), 'mark/dark');
});

test('with no resolver the mark still agrees with the frame, and no colour is invented', () => {
  const seeded = seedFrame(M, 'title', { frameId: 'f', x: 0, y: 0, logos: MARKS });
  assert.ok(seeded);
  assert.equal(seeded.frame.bg, undefined, 'no resolver means no colour invented');
  assert.equal(markOn(seeded.layers, 'logo-hero'), 'mark/dark', 'the archetype says it is dark, so the mark is too');

  const light = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0, logos: MARKS });
  assert.equal(markOn(light?.layers ?? [], 'logo'), 'mark/light');
});

test('a frame dropped at a fractional position keeps its layers square to it', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 10.6, y: 0.5 });
  const whole = seedFrame(M, 'content', { frameId: 'f', x: 11, y: 1 });
  assert.ok(seeded && whole);
  assert.deepEqual([seeded.frame.x, seeded.frame.y], [11, 1]);
  assert.deepEqual(shape(seeded.layers), shape(whole.layers), 'the rounded origin is the only origin');
});

test('the frame carries the page order it was given, and its children carry none', () => {
  const seeded = seedFrame(M, 'content', { frameId: 'f', x: 0, y: 0, order: 7 });
  assert.ok(seeded);
  assert.equal(seeded.frame.order, 7, 'order is Design frame field: the slide number in the deck');
  for (const row of seeded.layers) assert.equal(row.order, undefined);
});

// ---------------------------------------------------------------------------
// Fixture masters: shapes the shipped packs do not have yet
// ---------------------------------------------------------------------------

/** The SUSE bar fractions, which meet edge to edge and must keep meeting at every size. */
function barMaster(width: number, height: number): SlideMasterV1 {
  const segs: Array<[string, number, number]> = [
    ['bar-1', 0.4992, 0.1799],
    ['bar-2', 0.6791, 0.0725],
    ['bar-3', 0.7516, 0.0365],
    ['bar-4', 0.7881, 0.2119],
  ];
  return {
    id: 'fixture/slides/bars',
    version: '1.0.0',
    name: 'Bars',
    size: { width, height },
    typeScale: { title: 37, subtitle: 27, body: 24, caption: 20, number: 11, label: 11 },
    logo: { variantByBackground: false },
    furniture: segs.map(([id, x, w]) => ({ id, kind: 'bar' as const, box: { x, y: 0.9325, w, h: 0.0206 }, hex: '#90ebcd' })),
    archetypes: [{
      id: 'content',
      name: 'Content',
      furniture: segs.map(([id]) => id),
      placeholders: [{ role: 'body', box: { x: 0.0341, y: 0.1455, w: 0.9318, h: 0.7011 }, kind: 'text' }],
    }],
  };
}

test('furniture that meets edge to edge keeps meeting at every master size', () => {
  for (const [width, height] of [[1280, 720], [1920, 1080], [1001, 563], [2560, 1440]] as const) {
    const seeded = seedFrame(barMaster(width, height), 'content', { frameId: 'f', x: 0, y: 0 });
    assert.ok(seeded);
    const bars = seeded.layers.filter((r) => String(r.id).startsWith('f.bar-'));
    assert.equal(bars.length, 4);
    for (let i = 1; i < bars.length; i += 1) {
      const before = bars[i - 1];
      const now = bars[i];
      assert.ok(before && now);
      assert.equal(
        Number(before.x) + Number(before.w),
        Number(now.x),
        `at ${width} the bar segments open a hairline between ${String(before.id)} and ${String(now.id)}`,
      );
    }
    const last = bars[bars.length - 1];
    assert.equal(Number(last?.x) + Number(last?.w), width, 'and the last segment reaches the edge');
  }
});

/** One role with a text slot declared before an image slot, which neither pack has yet. */
const MIXED: SlideMasterV1 = {
  id: 'fixture/slides/mixed',
  version: '1.0.0',
  name: 'Mixed',
  size: { width: 1280, height: 720 },
  typeScale: { title: 37, subtitle: 27, body: 24, caption: 20, number: 11, label: 11 },
  logo: { variantByBackground: false },
  furniture: [],
  archetypes: [{
    id: 'content',
    name: 'Content',
    placeholders: [
      { role: 'visual', box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, kind: 'text' },
      { role: 'visual', box: { x: 0.6, y: 0.6, w: 0.3, h: 0.3 }, kind: 'image' },
    ],
  }],
};

test('a role whose slots are a text one then an image one round-trips into its own slots', () => {
  const seeded = seedFrame(MIXED, 'content', { frameId: 'f', x: 0, y: 0 });
  assert.ok(seeded);
  const text = seeded.layers.find((r) => r.kind === 'text');
  const image = seeded.layers.find((r) => r.kind === 'image');
  assert.equal(text?.id, 'f.visual', 'the declared order names the slots');
  assert.equal(image?.id, 'f.visual-2');
  assert.deepEqual([text?.x, text?.y], [128, 72]);
  assert.deepEqual([image?.x, image?.y], [768, 432]);

  const moved = seeded.layers.map((r) => ({ ...r, x: 0, y: 0 }));
  const reset = resetFrame(MIXED, 'content', moved, { x: 0, y: 0 });
  assert.deepEqual([reset.find((r) => r.id === 'f.visual')?.x, reset.find((r) => r.id === 'f.visual')?.y], [128, 72]);
  assert.deepEqual([reset.find((r) => r.id === 'f.visual-2')?.x, reset.find((r) => r.id === 'f.visual-2')?.y], [768, 432]);
});

// ---------------------------------------------------------------------------
// Every ink a master states reads on the ground it is drawn on
// ---------------------------------------------------------------------------

/**
 * The grounds under one text box: the archetype's own background unless a
 * rectangle or bar covers the box whole, plus every rectangle or bar the box
 * touches. A box that runs across the edge of a panel is drawn on both sides of
 * that edge, so its ink has to read on both. A translucent fill is laid over the
 * archetype ground first, which is what the eye sees. Over a picture the ground
 * is the picture, which nobody has seen: a translucent fill is laid over both a
 * white and a black one, and the ink has to read on each.
 */
function groundsUnder(
  box: { x: number; y: number; w: number; h: number },
  archetypeGround: string,
  rects: Array<{ id: string; box: { x: number; y: number; w: number; h: number }; hex: string }>,
  pictures: Array<{ x: number; y: number; w: number; h: number }> = [],
): Array<{ where: string; hex: string }> {
  const eps = 1e-4;
  const touches = (other: { x: number; y: number; w: number; h: number }): boolean =>
    box.x < other.x + other.w - eps && box.x + box.w > other.x + eps
    && box.y < other.y + other.h - eps && box.y + box.h > other.y + eps;
  const onPicture = pictures.some(touches);
  const unders = onPicture ? ['#ffffff', '#000000'] : [archetypeGround];
  const out: Array<{ where: string; hex: string }> = [];
  let covered = false;
  for (const r of rects) {
    if (!touches(r.box)) continue;
    const inside = box.x >= r.box.x - eps && box.y >= r.box.y - eps
      && box.x + box.w <= r.box.x + r.box.w + eps && box.y + box.h <= r.box.y + r.box.h + eps;
    if (inside) covered = true;
    for (const under of unders) out.push({ where: onPicture ? `${r.id} over a picture` : r.id, hex: composite(r.hex, under) });
  }
  if (!covered) {
    if (onPicture) out.push({ where: 'a picture, with no scrim under the words', hex: '' });
    else out.push({ where: 'the archetype ground', hex: archetypeGround });
  }
  return out;
}

/** `#rrggbbaa` laid over an opaque `#rrggbb`; an opaque colour comes back as it is. */
function composite(hex: string, under: string): string {
  const top = hex.replace('#', '');
  const base = under.replace('#', '');
  if (top.length !== 8) return `#${top.slice(0, 6)}`;
  const alpha = Number.parseInt(top.slice(6, 8), 16) / 255;
  const channel = (i: number): string => {
    const a = Number.parseInt(top.slice(i, i + 2), 16);
    const b = Number.parseInt(base.slice(i, i + 2), 16);
    return Math.round(a * alpha + b * (1 - alpha)).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

for (const { pack } of present) {
  test(`${pack}: every placeholder and furniture ink passes contrast on its own archetype ground`, async () => {
    const resolved = await resolveProfileDesignSystem({ profile: pack, root: REPO_ROOT });
    assert.ok(resolved && resolved.profile === pack, `the ${pack} profile resolves in this checkout`);
    const { master, colors } = resolved.system.input;
    const ink = (tokenPath: string | undefined, hex: string | undefined): string | undefined =>
      hex ?? (tokenPath ? colors[tokenPath] : undefined);
    const failures: string[] = [];
    let checked = 0;
    for (const a of master.archetypes) {
      const ground = ink(a.background?.tokenPath, a.background?.hex);
      assert.ok(ground, `${a.id} names a ground the design system resolves`);
      const shown = (a.furniture ?? []).map((id) => findFurniture(master, id)).filter((f) => f !== undefined);
      const rects = shown.flatMap((f) => {
        if (f.kind !== 'rect' && f.kind !== 'bar') return [];
        const hex = ink(f.tokenPath, f.hex);
        return hex ? [{ id: f.id, box: f.box, hex }] : [];
      });
      const pictures = a.placeholders.filter((p) => p.kind === 'image').map((p) => p.box);
      const check = (what: string, box: typeof a.placeholders[number]['box'], fg: string | undefined, px: number, bold: boolean): void => {
        assert.ok(fg, `${a.id} ${what} names an ink the design system resolves`);
        // WCAG 2.2: large text is 18pt, or 14pt bold, which is 24 px or 18.66 px at 96 dpi.
        const minimum = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
        for (const under of groundsUnder(box, composite(ground, '#ffffff'), rects, pictures)) {
          checked += 1;
          if (!under.hex) {
            failures.push(`${a.id} ${what} sits on ${under.where}`);
            continue;
          }
          const ratio = contrastRatio(fg, under.hex);
          if (!(ratio >= minimum)) {
            failures.push(`${a.id} ${what}: ${fg} on ${under.hex} (${under.where}) is ${ratio.toFixed(2)}:1, under ${minimum}:1`);
          }
        }
      };
      for (const p of a.placeholders) {
        if (p.kind === 'image') continue;
        check(`${p.role} placeholder`, p.box, ink(p.style?.fgTokenPath, p.style?.fg), roleFontSize(master, p.role, p.style), p.style?.weight === '700');
      }
      for (const f of shown) {
        if (f.kind !== 'page-number' && f.kind !== 'footer') continue;
        const role = f.kind === 'page-number' ? 'number' : 'label';
        check(`${f.id} furniture`, f.box, ink(f.style?.fgTokenPath, f.style?.fg), roleFontSize(master, role, f.style), f.style?.weight === '700');
      }
    }
    assert.ok(checked > 30, `${checked} pairs were checked`);
    assert.deepEqual(failures, []);
  });
}
