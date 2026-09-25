// SPDX-License-Identifier: MPL-2.0
/**
 * Slide masters in Design (plan 274 section 3.4), against the real module.
 *
 * The host is a stub: a catalog that answers one `slide-master` data asset and three
 * logo assets, and a token set of two colours. Everything else is the shipping code -
 * the engine's `seedFrame`, `applyArchetype` and `resetFrame` included - so what these
 * tests pin is the binding between Design's box rows and the master contract.
 *
 * Three of them pin what counting rows cannot see: the paint ORDER a re-lay produces
 * (a backdrop panel belongs under the words, not over them), that a slot the target
 * archetype adds arrives as an empty placeholder, and that a layer a person drew comes
 * back field for field as it went in.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import {
  archetypeChoices,
  ARCHETYPE_THUMB_WIDTH,
  applyArchetypeToFrame,
  loadMaster,
  newSlideFromArchetype,
  openArchetypePanel,
  relayMessage,
  resetFrameToMaster,
  slideMasterMenuCopy,
} from './slide-masters.ts';
import { THUMB_TONES, archetypeThumbSvg } from './archetype-thumb.ts';
import type { FcCtx } from './context.ts';
import type { Box } from '../free-canvas-math.ts';
import { ARCHETYPE_IDS, ARCHETYPE_ROLES } from '@lolly-tools/core';
import type { SlideMasterFileV1 } from '@lolly-tools/core';

const REPO = new URL('../../../../../', import.meta.url);

// The chooser is DOM, and the rest of this file is not, so one jsdom serves the whole
// suite rather than a mount harness per test.
const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'KeyboardEvent', 'MouseEvent', 'DOMParser']) {
  (globalThis as Record<string, unknown>)[key] = (dom.window as unknown as Record<string, unknown>)[key];
}

const MASTER_FILE: SlideMasterFileV1 = {
  version: 1,
  masters: [
    {
      id: 'stub/slides/neutral',
      version: '1.0.0',
      name: 'Stub master',
      size: { width: 1000, height: 500 },
      typeScale: { title: 60, subtitle: 30, body: 20, caption: 14, number: 12, label: 12 },
      logo: {
        variantByBackground: true,
        assetTags: { onLight: ['logo', 'primary'], onDark: ['logo', 'on-dark'], mono: ['logo', 'mono'] },
      },
      furniture: [
        { id: 'logo', kind: 'logo', box: { x: 0.8, y: 0.05, w: 0.15, h: 0.1 }, variantByBackground: true },
        { id: 'page-number', kind: 'page-number', box: { x: 0.9, y: 0.9, w: 0.06, h: 0.05 }, text: '1' },
        { id: 'panel', kind: 'rect', box: { x: 0, y: 0, w: 0.4, h: 1 }, tokenPath: 'color.brand.accent' },
      ],
      archetypes: [
        {
          id: 'title',
          name: 'Title',
          background: { hex: '#101010', dark: true },
          furniture: ['logo'],
          placeholders: [
            { role: 'title', box: { x: 0.1, y: 0.2, w: 0.8, h: 0.3 }, kind: 'text' },
            { role: 'subtitle', box: { x: 0.1, y: 0.6, w: 0.8, h: 0.1 }, kind: 'text' },
          ],
        },
        {
          id: 'content',
          name: 'Content',
          background: { tokenPath: 'color.semantic.surface' },
          furniture: ['panel', 'logo', 'page-number'],
          placeholders: [
            { role: 'title', box: { x: 0.05, y: 0.05, w: 0.9, h: 0.2 }, kind: 'text' },
            { role: 'body', box: { x: 0.05, y: 0.3, w: 0.9, h: 0.6 }, kind: 'text' },
          ],
        },
      ],
    },
  ],
};

const CATALOG = [
  { id: 'stub/slides/masters', type: 'data', tags: ['slides', 'slide-master'], url: '/masters.json' },
  { id: 'brand/logo/primary', type: 'vector', tags: ['logo', 'primary'], url: '/primary.svg' },
  { id: 'brand/logo/reverse', type: 'vector', tags: ['logo', 'on-dark'], url: '/reverse.svg' },
  { id: 'brand/logo/mono-dark', type: 'vector', tags: ['logo', 'on-dark', 'mono'], url: '/mono.svg' },
];

const TOKENS = [
  { path: 'color.semantic.surface', value: '#ffffff' },
  { path: 'color.brand.accent', value: '#2244cc' },
];

/** The stage the chooser is clamped inside, in client coordinates. */
const STAGE = { left: 40, top: 60, width: 600, height: 400 };

interface Fixture {
  fc: FcCtx;
  commits: Box[][];
  boxes(): Box[];
  queries: Array<{ type?: string; tags?: string[] }>;
  flashes: string[];
  stageEl: HTMLElement;
  anchor: HTMLElement;
  /** One entry per placement: the fixture counts the stage rect the placement reads. */
  placements: number[];
  /** Move the anchor, for the clamp tests. Client coordinates, like a real rect. */
  moveAnchor(left: number, bottom: number): void;
  panel(): HTMLElement | null;
}

/** A DOMRect literal, which is all `getBoundingClientRect` is read for here. */
function rectOf(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left, top, width, height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

function fixture(
  initial: Box[] = [],
  opts: { masterFile?: unknown; canvas?: { w: number; h: number } } = {}
): Fixture {
  let boxes: Box[] = initial.slice();
  const commits: Box[][] = [];
  const queries: Array<{ type?: string; tags?: string[] }> = [];
  const flashes: string[] = [];
  const placements: number[] = [];
  let minted = 0;
  const stageEl = document.createElement('div');
  const anchor = document.createElement('button');
  stageEl.append(anchor);
  document.body.append(stageEl);
  // jsdom lays nothing out, so the two rects the placement reads are given here. The
  // stage read is counted: `placeChooser` takes it exactly once per placement, so the
  // count IS the number of placements, and it needs no spy inside the module.
  stageEl.getBoundingClientRect = () => {
    placements.push(placements.length + 1);
    return rectOf(STAGE.left, STAGE.top, STAGE.width, STAGE.height);
  };
  let anchorRect = rectOf(220, 120, 160, 22);
  anchor.getBoundingClientRect = () => anchorRect;
  // The real `closeMorePanel` (views/free-canvas/document.ts) is the rung the Escape
  // ladder pulls, so the stub is the same two lines rather than a bare spy.
  const held: { fc: FcCtx | null } = { fc: null };
  const closeMorePanel = (): void => {
    const live = held.fc;
    if (!live) return;
    live.morePanel?.remove();
    live.morePanel = null;
  };
  const fc = {
    stageEl,
    morePanel: null,
    fieldPanels: {},
    disposed: false,
    cfg: { idField: 'id', kindField: 'kind', xField: 'x', yField: 'y', wField: 'w', hField: 'h', fillField: 'bg' },
    frameCfg: { frameField: 'frame', frameKind: 'frame', orderField: 'order', lockedField: 'locked' },
    nameField: 'name',
    addKinds: [
      { id: 'frame', seed: { kind: 'frame', bg: '', shape: 'rect' } },
      { id: 'text', seed: { kind: 'text', fg: '#11141f', fontSize: 64, lineHeight: 1.12, valign: 'top' } },
      { id: 'image', seed: { kind: 'image', fit: 'contain', shape: 'rounded' } },
      { id: 'box', seed: { kind: 'box', shape: 'rounded', radius: 16, bg: '' } },
    ],
    host: {
      assets: {
        async query(filter: { type?: string; tags?: string[] }) {
          queries.push(filter);
          return CATALOG.filter(
            (a) =>
              (!filter.type || a.type === filter.type) &&
              (filter.tags ?? []).every((tag) => a.tags.includes(tag))
          );
        },
        async get(id: string) {
          return CATALOG.find((a) => a.id === id) ?? null;
        },
        async bytes() {
          return new TextEncoder().encode(JSON.stringify(opts.masterFile ?? MASTER_FILE));
        },
      },
      tokens: {
        async get() {
          return { query: () => TOKENS };
        },
      },
    },
    helpers: { canvasWH: () => opts.canvas ?? { w: 1000, h: 500 } },
    select: {
      getBoxes: () => boxes,
      freshId: () => `row-${++minted}`,
      idOf: (b: Box | undefined, i: number) => String(b?.id ?? i),
      commit: (next: Box[]) => {
        commits.push(next);
        boxes = next;
      },
    },
    document: {
      closeMorePanel,
      withNewFrameOrder: (bs: Box[], box: Box) => ({
        boxes: bs,
        box: { ...box, order: bs.filter((b) => b.kind === 'frame').length },
      }),
    },
    chromeSync: { renderChrome() {} },
    stage: { flash: (m: string) => flashes.push(m) },
    selection: new Set<string>(),
  } as unknown as FcCtx;
  held.fc = fc;
  return {
    fc,
    commits,
    boxes: () => boxes,
    queries,
    flashes,
    stageEl,
    anchor,
    placements,
    moveAnchor: (left: number, bottom: number) => {
      anchorRect = rectOf(left, bottom - 22, 160, 22);
    },
    panel: () => stageEl.querySelector<HTMLElement>('.fc-arch-panel'),
  };
}

/** The chooser fills its body after one catalog read, so the tests wait for that turn. */
async function settle(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function tilesOf(panel: HTMLElement): HTMLButtonElement[] {
  return Array.from(panel.querySelectorAll<HTMLButtonElement>('.arch-tile'));
}

/**
 * What a browser does to a focused `<button>` when Enter is pressed: it fires the key,
 * and unless something cancels it, it fires the activation click. jsdom stops at the
 * first half, so the second is modelled here - which is also what makes the assertion
 * meaningful, because a grid that swallowed Enter would cancel the key and fail it.
 */
function pressEnter(tile: HTMLButtonElement): void {
  const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  const delivered = tile.dispatchEvent(key);
  assert.equal(delivered, true, 'nothing in the grid cancels Enter on a tile');
  tile.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** The children of one frame, in the array order Design paints them in. */
function childrenOf(rows: Box[], frameId: string): Box[] {
  return rows.filter((b) => String(b.frame ?? '') === frameId);
}

test('a new slide seeds the frame, its placeholders and its furniture in one commit', async () => {
  const f = fixture();
  const id = await newSlideFromArchetype(f.fc, 'title');
  assert.equal(id, 'row-1');
  assert.equal(f.commits.length, 1);

  const rows = f.boxes();
  const frame = rows.find((b) => b.kind === 'frame')!;
  assert.equal(frame.id, 'row-1');
  assert.equal(frame.x, 0);
  assert.equal(frame.w, 1000);
  assert.equal(frame.h, 500);
  assert.equal(frame.master, 'stub/slides/neutral');
  assert.equal(frame.archetype, 'title');
  assert.equal(frame.bg, '#101010');
  assert.equal(frame.order, 0);
  assert.equal(frame.shape, 'rect', 'the frame keeps the tool own seed underneath');

  const title = rows.find((b) => b.role === 'title')!;
  assert.equal(title.kind, 'text');
  assert.equal(title.frame, 'row-1');
  assert.equal(title.master, 'stub/slides/neutral');
  assert.equal(title.x, 100);
  assert.equal(title.y, 100);
  assert.equal(title.w, 800);
  assert.equal(title.h, 150);
  assert.equal(title.fontSize, 60, 'the master type scale wins over the tool own seed');
  assert.equal(title.order, undefined, 'order is the frame page number, never a child field');

  const logo = rows.find((b) => b.furniture === 'logo')!;
  assert.equal(logo.kind, 'image');
  assert.equal(logo.locked, true);
  assert.equal(logo.shape, undefined, 'furniture never takes the tool seed rounded corner');
  assert.equal(logo.image, 'brand/logo/reverse', 'a dark title slide takes the reverse mark');
  assert.equal(rows.filter((b) => b.furniture === 'page-number').length, 0, 'title shows no page number');
});

test('a second slide lands clear of the first, and a token background resolves', async () => {
  const f = fixture();
  await newSlideFromArchetype(f.fc, 'title');
  await newSlideFromArchetype(f.fc, 'content');
  const frames = f.boxes().filter((b) => b.kind === 'frame');
  assert.equal(frames.length, 2);
  assert.equal(frames[1]!.x, 1080, 'the next slide clears the first by the artboard gap');
  assert.equal(frames[1]!.order, 1);
  assert.equal(frames[1]!.bg, '#ffffff', 'the archetype background token resolved through host.tokens');

  const second = String(frames[1]!.id);
  const panel = f.boxes().find((b) => b.frame === second && b.furniture === 'panel')!;
  assert.equal(panel.kind, 'box');
  assert.equal(panel.bg, '#2244cc');
  assert.equal(panel.locked, true);
  assert.equal(panel.shape, undefined, 'a backdrop panel runs to the slide edge, square-cornered');
  assert.equal(panel.radius, undefined);
  const logo = f.boxes().find((b) => b.frame === second && b.furniture === 'logo')!;
  assert.equal(logo.image, 'brand/logo/primary', 'a light slide takes the colour mark');
});

test('a slide takes the page size the document already uses, not the master reference size', async () => {
  const f = fixture([], { canvas: { w: 1920, h: 1080 } });
  const id = (await newSlideFromArchetype(f.fc, 'content'))!;
  const frame = f.boxes().find((b) => b.id === id)!;
  assert.deepEqual([frame.w, frame.h], [1920, 1080], 'the frame is the document page, not 1000x500');

  const title = f.boxes().find((b) => b.frame === id && b.role === 'title')!;
  assert.deepEqual(
    [title.x, title.y, title.w, title.h],
    [96, 54, 1728, 216],
    'the master fractions resolve against the page size'
  );
  assert.equal(title.fontSize, 115, 'the type scale moves with the page: 60 px at 1000 wide, x1.92 here');

  // A second slide reads its size off the frames already down, so a deck stays one size.
  const next = (await newSlideFromArchetype(f.fc, 'title'))!;
  const nextFrame = f.boxes().find((b) => b.id === next)!;
  assert.deepEqual([nextFrame.w, nextFrame.h], [1920, 1080]);
});

test('applying another archetype re-lays bound layers, keeps content and swaps furniture', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  // The person types a title and drops a note the master knows nothing about.
  f.fc.select.commit(
    f.boxes().concat([{ id: 'loose', kind: 'text', frame: id, x: 10, y: 10, w: 50, h: 50, text: 'note' }]).map((b) =>
      b.role === 'title' ? { ...b, text: 'Quarterly review' } : b
    )
  );
  const before = f.commits.length;
  const looseBefore = { ...f.boxes().find((b) => b.id === 'loose')! };

  const result = await applyArchetypeToFrame(f.fc, id, 'content');
  assert.deepEqual(result, { ok: true, surplus: 1, adopted: false }, 'the stale subtitle is reported as surplus');
  assert.equal(f.commits.length, before + 1, 'one commit, so one undo step');

  const rows = f.boxes();
  const frame = rows.find((b) => b.id === id)!;
  assert.equal(frame.archetype, 'content');
  assert.equal(frame.bg, '#ffffff');
  assert.equal(frame.name, 'Content', 'a machine-written slide name follows the archetype');

  const title = rows.find((b) => b.role === 'title')!;
  assert.equal(title.text, 'Quarterly review', 'content survives the re-lay');
  assert.equal(title.x, 50, 'geometry follows the target archetype');
  assert.equal(title.y, 25);

  const subtitle = rows.find((b) => b.role === 'subtitle')!;
  assert.equal(subtitle.y, 300, 'a role the target has no slot for stays where it was');

  const body = rows.find((b) => b.role === 'body');
  assert.ok(body, 'a slot the target archetype adds arrives as an empty placeholder');
  assert.equal(body!.text, '');
  assert.deepEqual([body!.x, body!.y, body!.w, body!.h], [50, 150, 900, 300]);
  assert.equal(body!.fontSize, 20, 'the empty placeholder takes the master type scale');

  const loose = rows.find((b) => b.id === 'loose')!;
  assert.deepEqual(loose, looseBefore, 'a layer with no binding comes back field for field');

  assert.equal(rows.filter((b) => b.furniture === 'panel').length, 1, 'furniture the target adds is seeded');
  assert.equal(rows.filter((b) => b.furniture === 'page-number').length, 1);
  assert.equal(rows.filter((b) => b.furniture === 'logo').length, 1, 'furniture both archetypes show is kept once');
  const logo = rows.find((b) => b.furniture === 'logo')!;
  assert.equal(logo.image, 'brand/logo/primary', 'the mark follows the target background');
});

test('an applied archetype paints in the same order a fresh seed of it does', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  f.fc.select.commit(
    f.boxes().concat([{ id: 'loose', kind: 'text', frame: id, x: 10, y: 10, w: 50, h: 50, text: 'note' }])
  );
  await applyArchetypeToFrame(f.fc, id, 'content');
  const applied = childrenOf(f.boxes(), id);

  const fresh = fixture();
  const freshId = (await newSlideFromArchetype(fresh.fc, 'content'))!;
  const seeded = childrenOf(fresh.boxes(), freshId);

  const bindingOf = (b: Box): string => String(b.furniture ?? b.role ?? b.id ?? '');
  assert.deepEqual(
    applied.slice(0, seeded.length).map(bindingOf),
    seeded.map(bindingOf),
    'the master run is the target archetype own paint order'
  );
  assert.deepEqual(
    applied.slice(seeded.length).map(bindingOf),
    ['subtitle', 'loose'],
    'what the target has no slot for, and what the person drew, sit on top of the master run'
  );

  const panelAt = applied.findIndex((b) => b.furniture === 'panel');
  const titleAt = applied.findIndex((b) => b.role === 'title');
  assert.ok(panelAt >= 0 && panelAt < titleAt, 'the backdrop panel is painted under the title, never over it');
});

test('reset puts master geometry back and leaves an unseeded frame alone', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  f.fc.select.commit(f.boxes().map((b) => (b.role === 'title' ? { ...b, x: 7, y: 7, text: 'moved' } : b)));
  const before = f.commits.length;

  assert.deepEqual(await resetFrameToMaster(f.fc, id), { ok: true, surplus: 0, adopted: false });
  assert.equal(f.commits.length, before + 1);
  const title = f.boxes().find((b) => b.role === 'title')!;
  assert.deepEqual([title.x, title.y], [100, 100]);
  assert.equal(title.text, 'moved', 'reset is geometry, not content');

  const plain = fixture([{ id: 'hand-made', kind: 'frame', x: 0, y: 0, w: 100, h: 100 }]);
  assert.deepEqual(await resetFrameToMaster(plain.fc, 'hand-made'), { ok: false, refusal: 'not-seeded' });
  assert.deepEqual(await applyArchetypeToFrame(plain.fc, 'hand-made', 'content'), {
    ok: false,
    refusal: 'not-seeded',
  });
  assert.equal(plain.commits.length, 0, 'a frame no master seeded is never rewritten');
});

test('a slide bound to another master is named as such, not refused as unseeded', async () => {
  const f = fixture([
    { id: 'foreign', kind: 'frame', x: 0, y: 0, w: 1000, h: 500, master: 'other/slides/deck', archetype: 'title' },
    { id: 'foreign.title', kind: 'text', frame: 'foreign', x: 0, y: 0, w: 10, h: 10, master: 'other/slides/deck', role: 'title', text: 'Hello' },
  ]);
  assert.deepEqual(
    await resetFrameToMaster(f.fc, 'foreign'),
    { ok: false, refusal: 'other-master' },
    'reset refuses rather than re-laying into a master this slide never used'
  );
  assert.equal(f.commits.length, 0);

  const applied = await applyArchetypeToFrame(f.fc, 'foreign', 'content');
  assert.deepEqual(applied, { ok: true, surplus: 0, adopted: true });
  assert.equal(
    relayMessage(applied),
    'This slide now follows the active design system.',
    'the adoption is stated, not silent'
  );
  assert.equal(f.boxes().find((b) => b.id === 'foreign')!.master, 'stub/slides/neutral');
});

test('an archetype the active master does not have is refused with its own reason', async () => {
  const f = fixture([
    { id: 'odd', kind: 'frame', x: 0, y: 0, w: 1000, h: 500, master: 'stub/slides/neutral', archetype: 'agenda' },
  ]);
  const result = await resetFrameToMaster(f.fc, 'odd');
  assert.deepEqual(result, { ok: false, refusal: 'unknown-archetype' });
  assert.ok(relayMessage(result).length > 0, 'a refusal always has a sentence');
  assert.equal(f.commits.length, 0);
});

test('a design system with no slide master answers null and commits nothing', async () => {
  const f = fixture([], { masterFile: { version: 1, masters: [] } });
  assert.equal(await loadMaster(f.fc), null);
  assert.equal(await newSlideFromArchetype(f.fc, 'title'), null);
  assert.equal(f.commits.length, 0);
});

test('a master short of the parts the engine reads is reported, never thrown out of', async () => {
  const short = JSON.parse(JSON.stringify(MASTER_FILE)) as { masters: Array<Record<string, unknown>> };
  delete short.masters[0]!.logo;
  const f = fixture([], { masterFile: short });
  assert.equal(await loadMaster(f.fc), null);
  assert.equal(await newSlideFromArchetype(f.fc, 'title'), null);

  const noSize = JSON.parse(JSON.stringify(MASTER_FILE)) as { masters: Array<Record<string, unknown>> };
  delete noSize.masters[0]!.size;
  const g = fixture([], { masterFile: noSize });
  assert.equal(await loadMaster(g.fc), null);
  assert.equal(g.commits.length, 0);
});

test('an unknown archetype is refused rather than invented', async () => {
  const f = fixture();
  assert.equal(await newSlideFromArchetype(f.fc, 'agenda'), null);
  assert.equal(f.commits.length, 0);
});

test('the master is read once and found by the slide-master tags on every profile', async () => {
  const f = fixture();
  await newSlideFromArchetype(f.fc, 'title');
  await newSlideFromArchetype(f.fc, 'content');
  const masterQueries = f.queries.filter((q) => (q.tags ?? []).includes('slide-master'));
  assert.equal(masterQueries.length, 1, 'the catalog read is shared, not repeated per slide');
  assert.deepEqual(masterQueries[0], { type: 'data', tags: ['slides', 'slide-master'] });
});

test('the manifest fields and the blocks wire order are appended in the same order', () => {
  const manifest = JSON.parse(
    readFileSync(fileURLToPath(new URL('community/design/tool.json', REPO)), 'utf8')
  ) as { inputs: Array<{ id: string; fields?: Array<{ id: string; showFor?: string[]; options?: Array<{ value?: string }> }> }> };
  const wire = JSON.parse(
    readFileSync(fileURLToPath(new URL('schemas/blocks-wire-order.json', REPO)), 'utf8')
  ) as { inputs: Record<string, string[]> };

  const fields = manifest.inputs.find((i) => i.id === 'boxes')?.fields ?? [];
  const ids = fields.map((f) => f.id);
  const pinned = wire.inputs['design:boxes'] ?? [];
  assert.deepEqual(ids, pinned, 'the wire order is the field order, position for position');

  const added = ['master', 'role', 'furniture', 'archetype'];
  assert.deepEqual(ids.slice(-4), added, 'the four master fields are appended at the end');
  for (const id of added) {
    const field = fields.find((f) => f.id === id)!;
    assert.deepEqual(field.showFor, [], `${id} stays out of the sidebar`);
  }

  // The SDK owns the two lists. The manifest options and the label table are copies, so
  // a thirteenth archetype in the SDK has to reach both rather than going unnoticed.
  const values = (id: string): string[] =>
    (fields.find((f) => f.id === id)?.options ?? [])
      .map((o) => String(o.value ?? ''))
      .filter((v) => v !== '');
  // The archetype field is either the SDK's closed list, or an open text field whose
  // pattern admits every SDK id (a master may also carry library ids like columns-3).
  const archetype = fields.find((f) => f.id === 'archetype') as { type?: string; pattern?: string } | undefined;
  if (archetype?.type === 'text') {
    const pattern = new RegExp(archetype.pattern ?? '^$');
    for (const id of ARCHETYPE_IDS) assert.ok(pattern.test(id), `the archetype pattern admits ${id}`);
    assert.ok(pattern.test('numbered-rows'), 'and a library id');
  } else {
    assert.deepEqual(values('archetype'), [...ARCHETYPE_IDS], 'the archetype options are the SDK list');
  }
  assert.deepEqual(values('role'), [...ARCHETYPE_ROLES], 'the role options are the SDK list');
});


// ══ the thumbnails ═══════════════════════════════════════════════════════════
// Snapshots against the REAL lolly-start master, so the picture and the design system
// move together: a change to either one has to be looked at here.

const LOLLY_MASTER = (
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL('brands/lolly-start/catalog/assets/lolly/slides/masters.json', REPO)),
      'utf8'
    )
  ) as SlideMasterFileV1
).masters[0]!;

test('the title layout draws a dark page, its logo and one heavy rule', () => {
  assert.equal(
    archetypeThumbSvg(LOLLY_MASTER, 'title', { width: ARCHETYPE_THUMB_WIDTH }),
    '<svg xmlns="http://www.w3.org/2000/svg" class="arch-thumb is-dark" viewBox="0 0 96 54" width="96" height="54" aria-hidden="true">' +
      '<rect class="arch-page" fill="#15181b" stroke="#2f3338" stroke-width="1" x="0.5" y="0.5" width="95" height="53" rx="2"/>' +
      '<rect class="arch-furn" fill="#464a4f" x="5.1" y="4.1" width="16.2" height="4.8" rx="1"/>' +
      '<rect class="arch-ph" fill="#33373b" x="3.3" y="11.9" width="69.4" height="21.5" rx="1"/>' +
      '<rect class="arch-mark" fill="#c9ced3" x="6.3" y="20.2" width="63.4" height="5" rx="2.5"/>' +
      '<rect class="arch-ph" fill="#33373b" x="3.3" y="34.9" width="89.5" height="8.3" rx="1"/>' +
      '</svg>',
    'a dark layout is a dark page with light marks, a subtitle a plain strip, and it says so in the markup'
  );
});

test('the content layout draws its furniture, a title rule and a neutral content box', () => {
  assert.equal(
    archetypeThumbSvg(LOLLY_MASTER, 'content', { width: ARCHETYPE_THUMB_WIDTH }),
    '<svg xmlns="http://www.w3.org/2000/svg" class="arch-thumb" viewBox="0 0 96 54" width="96" height="54" aria-hidden="true">' +
      '<rect class="arch-page" fill="#f7f8f9" stroke="#d5d9de" stroke-width="1" x="0.5" y="0.5" width="95" height="53" rx="2"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="15.4" y="50.4" width="24" height="1.5" rx="1"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="2.3" y="49.7" width="8.1" height="2.4" rx="1"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="40.6" y="49.5" width="5.8" height="2.8" rx="1"/>' +
      '<rect class="arch-ph" fill="#e7eaed" x="3.3" y="1.8" width="89.5" height="6" rx="1"/>' +
      '<rect class="arch-mark" fill="#55595f" x="4.1" y="3.7" width="87.8" height="2.4" rx="1.2"/>' +
      '<rect class="arch-ph" fill="#e7eaed" x="3.3" y="10.3" width="89.5" height="35.5" rx="1"/>' +
      '<rect class="arch-mark" fill="#55595f" x="43" y="27.2" width="10" height="1.5" rx="0.8"/>' +
      '<rect class="arch-mark" fill="#55595f" x="47.3" y="23" width="1.5" height="10" rx="0.8"/>' +
      '</svg>',
    'any content goes in the body box (plan 275 decision 30), so it carries the neutral plus, not ruled words'
  );
});

test('a picture layout draws the neutral box, a plus, in its picture slot: any box takes any content', () => {
  const svg = archetypeThumbSvg(LOLLY_MASTER, 'visual', { width: ARCHETYPE_THUMB_WIDTH });
  assert.equal(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" class="arch-thumb" viewBox="0 0 96 54" width="96" height="54" aria-hidden="true">' +
      '<rect class="arch-page" fill="#f7f8f9" stroke="#d5d9de" stroke-width="1" x="0.5" y="0.5" width="95" height="53" rx="2"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="15.4" y="50.4" width="24" height="1.5" rx="1"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="2.3" y="49.7" width="8.1" height="2.4" rx="1"/>' +
      '<rect class="arch-furn" fill="#dcdfe3" x="40.6" y="49.5" width="5.8" height="2.8" rx="1"/>' +
      '<rect class="arch-ph" fill="#e7eaed" x="3.3" y="1.8" width="89.5" height="6" rx="1"/>' +
      '<rect class="arch-mark" fill="#55595f" x="4.1" y="3.7" width="87.8" height="2.4" rx="1.2"/>' +
      '<rect class="arch-ph" fill="#e7eaed" x="3.3" y="10.3" width="89.5" height="35.5" rx="1"/>' +
      '<rect class="arch-mark" fill="#55595f" x="43" y="27.2" width="10" height="1.5" rx="0.8"/>' +
      '<rect class="arch-mark" fill="#55595f" x="47.3" y="23" width="1.5" height="10" rx="0.8"/>' +
      '</svg>'
  );
  assert.ok(
    !/var\(|currentColor/.test(svg),
    'the tones are fixed, so the picture cannot be repainted by the theme it is shown in'
  );
});

test('a light archetype is a light page and a dark one is a dark page, in either theme', () => {
  // The bug this pins: the page and the marks used to be chrome tokens, so under
  // html[data-theme=dark] the three dark archetypes came out as the LIGHTEST tiles in
  // the grid. A thumbnail is a picture of a slide, so it does not follow the app theme.
  const tone = (svg: string, cls: string): string =>
    new RegExp(`class="${cls}" fill="(#[0-9a-f]{6})"`).exec(svg)?.[1] ?? '';
  const lum = (hex: string): number =>
    (Number.parseInt(hex.slice(1, 3), 16) +
      Number.parseInt(hex.slice(3, 5), 16) +
      Number.parseInt(hex.slice(5, 7), 16)) /
    3;

  const light = archetypeThumbSvg(LOLLY_MASTER, 'content', { width: 96 });
  const dark = archetypeThumbSvg(LOLLY_MASTER, 'title', { width: 96 });
  assert.ok(lum(tone(light, 'arch-page')) > 200, 'a light archetype is a near-white page');
  assert.ok(lum(tone(light, 'arch-mark')) < 110, 'with dark marks on it');
  assert.ok(lum(tone(dark, 'arch-page')) < 45, 'a dark archetype is a near-black page');
  assert.ok(lum(tone(dark, 'arch-mark')) > 180, 'with light marks on it');

  // The page carries its own edge either way, because a dark page is shown on a dark
  // tile and a light page on a light one.
  for (const svg of [light, dark]) {
    assert.match(svg, /class="arch-page" fill="#[0-9a-f]{6}" stroke="#[0-9a-f]{6}"/);
  }
  assert.deepEqual(
    Object.keys(THUMB_TONES).sort(),
    ['dark', 'light'],
    'two pages, named where the stylesheet points at them'
  );
});

test('the tile frame and its mark stay on chrome tokens, and the wireframe holds no colour', () => {
  // The tile rules are shared with Rebrand's chooser, so they live in its sheet
  // (lib/slide-structures-ui.ts imports it for both tools).
  const css = readFileSync(
    fileURLToPath(new URL('shells/web/src/styles/parts/rebrand-chooser.css', REPO)),
    'utf8'
  );
  // One rule body, found by its selector at the start of a line, indented or not. Read
  // as text rather than parsed: this is checking which tokens the sheet names.
  const rule = (selector: string): string => {
    const found = new RegExp(`\\n[ \\t]*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`).exec(css);
    if (!found) return '';
    const end = css.indexOf('}', found.index);
    return end < 0 ? '' : css.slice(found.index + 1, end + 1);
  };

  // The thumbnail's own parts have no colour rule left at all: the tones are in the SVG.
  for (const part of ['.arch-page', '.arch-furn', '.arch-group', '.arch-ph', '.arch-mark']) {
    assert.equal(rule(part), '', `${part} is painted in the markup, not here`);
  }
  // The one tile rule (plans/275 close-out principle 3): flat on its surface, no border
  // and no card of its own.
  const tile = rule('.arch-tile');
  assert.match(tile, /border: 0;/u, 'no border');
  assert.match(tile, /background: transparent;/u, 'no card');
  assert.doesNotMatch(css, /(border|outline)[\w-]*:[^;]*dashed/u, 'no dashed tile: dashed means a drop area');

  // Hover is a ring at 40% of the selection colour; the current tile draws it at full
  // strength on the selection tint, so the two differ at a glance.
  // Both rings are the effect roles tokens.css declares, read here as they resolve.
  const tokens = readFileSync(fileURLToPath(new URL('shells/web/src/styles/tokens.css', REPO)), 'utf8');
  assert.match(tokens, /--ui-effect-selection-ring-hover: 0 0 0 2px color-mix\(in srgb, var\(--ui-color-selection-border\) 40%, transparent\);/u);
  assert.match(tokens, /--ui-effect-selection-ring: 0 0 0 2px var\(--ui-color-selection-border\);/u);
  const hover = rule('.arch-tile:hover');
  assert.match(hover, /box-shadow: var\(--ui-effect-selection-ring-hover\)/u, 'hover is the faint ring');
  const current = rule('.arch-tile[aria-current="true"]');
  assert.match(current, /box-shadow: var\(--ui-effect-selection-ring\)/u, 'the current tile keeps the full-strength ring');
  assert.match(current, /background: var\(--ui-color-selection-surface\)/u, 'on the selection tint');
});

test('an archetype this master does not carry draws nothing', () => {
  assert.equal(archetypeThumbSvg(LOLLY_MASTER, 'main-point', { width: 96 }).length > 0, true);
  const short = { ...LOLLY_MASTER, archetypes: [] };
  assert.equal(archetypeThumbSvg(short, 'title', { width: 96 }), '');
});

test('the chooser lists the master own layouts, each named from the layout library', async () => {
  // Plan 275: the list is the master's, not the twelve of the SDK, and the names are the
  // library's, so Design and Rebrand name a layout the same way.
  const f = fixture([], { masterFile: { version: 1, masters: [LOLLY_MASTER] } });
  await loadMaster(f.fc);
  const choices = archetypeChoices(f.fc);
  const byId = new Map(choices.map((c) => [c.id, c.label]));
  assert.ok(choices.length > ARCHETYPE_IDS.length, 'more layouts than the first twelve');
  assert.equal(byId.get('columns-3'), 'Three boxes');
  assert.equal(byId.get('content'), 'Title and body', 'a tuned archetype takes the name of the structure it restyles');
  assert.equal(byId.get('main-point'), 'Statement');
  assert.equal(byId.has('content-dark'), false, 'a dark variant is reached through the background, not listed');
  assert.equal(byId.has('image-and-text'), false, 'a mirror rides on its partner tile');
  for (const [id, label] of byId) assert.ok(label && label !== id, `${id} has a readable name`);
});

// ══ the chooser ══════════════════════════════════════════════════════════════

test('the chooser draws one tile per archetype and marks the one this slide follows', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  openArchetypePanel(f.fc, f.anchor, 'apply', id);
  await settle();

  const panel = f.panel()!;
  assert.ok(panel, 'the panel opened');
  assert.equal(panel.querySelector('.fc-panel-head')?.textContent, 'Apply layout');
  assert.equal(panel.querySelector('.fc-css-hint'), null, 'no explanatory paragraph above the grid');

  const grid = panel.querySelector<HTMLElement>('.arch-grid')!;
  assert.equal(grid.getAttribute('role'), 'group');
  assert.equal(grid.getAttribute('aria-label'), null, 'the group name is not read twice');
  assert.equal(
    grid.getAttribute('aria-labelledby'),
    panel.querySelector('.fc-panel-head')?.id,
    'the grid points at the head instead of restating it'
  );

  const tiles = tilesOf(panel);
  assert.deepEqual(
    tiles.map((tile) => tile.dataset.archetype),
    ['title', 'content'],
    'one tile per archetype the master carries, in the SDK order'
  );
  assert.deepEqual(
    tiles.map((tile) => tile.getAttribute('aria-current')),
    ['true', null],
    'the slide follows Title, so that tile is the current one and the rest carry no state'
  );
  assert.equal(
    tiles.some((tile) => tile.hasAttribute('aria-pressed')),
    false,
    'one of twelve is current, which is not twelve toggles'
  );
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1], 'the grid is one Tab stop');
  assert.deepEqual(
    tiles.map((tile) => tile.querySelector('.arch-name')?.textContent),
    ['Title slide', 'Title and body'],
    'the name under each tile is the layout library name for the structure it restyles, the same word Rebrand uses'
  );
  assert.equal(tiles[0]!.querySelector('svg')?.getAttribute('class'), 'arch-thumb is-dark',
    'the wireframe is a real node, and a dark archetype says so on the element');
});

test('a new slide follows no archetype yet, so no tile is marked current', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  // The head names where you are, it does not read the row back to you: the menu row
  // that opened this said "New slide from layout…".
  assert.equal(f.panel()!.querySelector('.fc-panel-head')?.textContent, 'New slide');
  const tiles = tilesOf(f.panel()!);
  assert.equal(tiles.length, 2);
  assert.deepEqual(tiles.map((tile) => tile.hasAttribute('aria-current')), [false, false]);
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1], 'the first tile is the Tab stop');
});

test('the tile the slide already follows closes the chooser and changes nothing', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  openArchetypePanel(f.fc, f.anchor, 'apply', id);
  await settle();
  const before = f.commits.length;
  const tiles = tilesOf(f.panel()!);
  assert.equal(tiles[0]!.getAttribute('aria-current'), 'true', 'the slide follows Title');

  tiles[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();

  assert.equal(f.panel(), null, 'the chooser closed');
  assert.equal(f.commits.length, before, 'no commit, so a hand-placed layer stayed where it was');
  assert.deepEqual(f.flashes, [], 'and nothing to say about a slide nobody changed');
});

test('the panel is placed again once the grid it has to fit is in it', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  assert.equal(f.placements.length, 1, 'placed once while the body is still empty');
  await settle();
  assert.equal(f.placements.length, 2, 'and again with the tiles in, so the clamp reads a real height');
});

test('the chooser opens under the row that was pressed, not in the corner of the stage', async () => {
  const f = fixture();
  f.moveAnchor(220, 142);
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  const panel = f.panel()!;
  // Stage origin is (40, 60), so the row's left edge is 180 into it and its foot 82,
  // with the panel's own 8px gap under it. A panel pinned to the stage would read 6px.
  assert.equal(panel.style.left, '180px');
  assert.equal(panel.style.top, '90px');
});

test('the anchor is read before the menu that holds it goes away', async () => {
  const f = fixture();
  f.moveAnchor(220, 142);
  // What the context menu does: the row that was pressed is removed the moment the
  // chooser opens, and a detached element measures zero. The placement has to have been
  // taken already, or the panel opens in the bottom-left corner of the stage.
  const detach = (): void => {
    f.moveAnchor(0, 0);
  };
  openArchetypePanel(f.fc, f.anchor, 'new');
  detach();
  await settle();
  assert.equal(f.panel()!.style.top, '90px', 'the point was read while the row was there');
});

test('the chooser clears the phone dock rather than opening under it', async () => {
  const f = fixture();
  // A row near the foot of the stage, so the bottom clamp is what decides the top.
  f.moveAnchor(220, 440);
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  assert.equal(f.panel()!.style.top, '388px', 'no dock, so the clamp is the stage foot');

  // The two lengths views/design-panels.ts writes on the stage under the compact
  // layout: the dock's own height with the safe-area inset in it, and what the
  // on-screen keyboard takes.
  const g = fixture();
  g.stageEl.style.setProperty('--design-actions-h', '76px');
  g.stageEl.style.setProperty('--design-viewport-inset', '12px');
  g.moveAnchor(220, 440);
  openArchetypePanel(g.fc, g.anchor, 'new');
  await settle();
  assert.equal(g.panel()!.style.top, '304px', 'the dock and the keyboard are both reserved');
});

test('arrow keys walk the tiles and move the one Tab stop with the focus', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  const panel = f.panel()!;
  const tiles = tilesOf(panel);
  const grid = panel.querySelector<HTMLElement>('.arch-grid')!;
  const press = (key: string): void => {
    grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  press('ArrowRight');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [-1, 0]);
  press('ArrowRight');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1], 'the walk wraps');
  press('End');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [-1, 0]);
  press('Home');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1]);
  // Both tiles share a top edge here, so they are one row and there is nowhere to go
  // down to: the focus stays where it is rather than walking sideways.
  press('ArrowDown');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1], 'one row, so Down stays put');
  press('ArrowUp');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1]);
});

test('Down and Up step a row, which the laid-out tiles are measured for', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  const panel = f.panel()!;
  const tiles = tilesOf(panel);
  // jsdom lays nothing out, so the two rows are stated: one tile per row, which is the
  // narrow panel a phone gets. Each tile sits in a cell of its own, so its offsetTop
  // counts from that cell and says nothing; the rows are read off the page's boxes. The
  // browser test (views/rebrand/strip.browser.test.ts) presses Down in a laid-out grid.
  tiles.forEach((tile, i) => {
    Object.defineProperty(tile, 'offsetTop', { value: 0, configurable: true });
    tile.getBoundingClientRect = () => ({ x: 8, y: 40 + i * 80, top: 40 + i * 80, left: 8, right: 104, bottom: 110 + i * 80, width: 96, height: 70, toJSON: () => ({}) }) as DOMRect;
  });
  const grid = panel.querySelector<HTMLElement>('.arch-grid')!;
  const press = (key: string): void => {
    grid.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  press('ArrowDown');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [-1, 0], 'one row down is the tile below');
  press('ArrowUp');
  assert.deepEqual(tiles.map((tile) => tile.tabIndex), [0, -1]);
});

test('Enter on a focused tile applies that archetype and closes the chooser', async () => {
  const f = fixture();
  const id = (await newSlideFromArchetype(f.fc, 'title'))!;
  openArchetypePanel(f.fc, f.anchor, 'apply', id);
  await settle();
  const before = f.commits.length;

  pressEnter(tilesOf(f.panel()!)[1]!);
  await settle();

  assert.equal(f.panel(), null, 'the chooser closed on the press');
  assert.equal(f.fc.morePanel, null);
  assert.equal(f.commits.length, before + 1, 'one commit, so one undo step');
  assert.equal(f.boxes().find((b) => b.id === id)!.archetype, 'content');
});

test('a tile press in New mode lays a slide down and closes the chooser', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  tilesOf(f.panel()!)[1]!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await settle();

  assert.equal(f.panel(), null);
  const frames = f.boxes().filter((b) => b.kind === 'frame');
  assert.equal(frames.length, 1);
  assert.equal(frames[0]!.archetype, 'content');
});

test('the chooser is the morePanel rung, so the Escape ladder closes it', async () => {
  const f = fixture();
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  const panel = f.panel()!;
  assert.equal(f.fc.morePanel, panel, 'the panel registers as the one the ladder dismisses');

  // The ladder listens on the window, so a press inside the panel has to reach it. The
  // panel swallows pointerdown, never keys.
  const key = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  let reached = false;
  const spy = (): void => { reached = true; };
  dom.window.addEventListener('keydown', spy);
  tilesOf(panel)[0]!.dispatchEvent(key);
  dom.window.removeEventListener('keydown', spy);
  assert.equal(reached, true, 'Escape reaches the window listener the ladder is on');

  f.fc.document.closeMorePanel();
  assert.equal(f.panel(), null, 'and that rung takes the panel off the stage');
  assert.equal(f.fc.morePanel, null);
});

test('a design system with no slide master gets one sentence where the grid would be', async () => {
  const f = fixture([], { masterFile: { version: 1, masters: [] } });
  openArchetypePanel(f.fc, f.anchor, 'new');
  await settle();
  const panel = f.panel()!;
  assert.equal(panel.querySelector('.arch-grid'), null);
  assert.equal(
    panel.querySelector('.arch-empty')?.textContent,
    'This design system has no slide master.'
  );
});

// ══ the words ════════════════════════════════════════════════════════════════

test('every message is one short plain sentence, and the menu words are pinned', () => {
  const said = [
    relayMessage({ ok: false, refusal: 'no-master' }),
    relayMessage({ ok: false, refusal: 'no-frame' }),
    relayMessage({ ok: false, refusal: 'not-seeded' }),
    relayMessage({ ok: false, refusal: 'other-master' }),
    relayMessage({ ok: false, refusal: 'unknown-archetype' }),
    relayMessage({ ok: true, surplus: 1, adopted: false }),
    relayMessage({ ok: true, surplus: 0, adopted: true }),
  ];
  assert.deepEqual(said, [
    'This design system has no slide master.',
    'That slide is no longer on the canvas, so nothing was changed.',
    'This slide was not made from a slide master.',
    'This slide was made from a different slide master.',
    'This slide master has no such layout.',
    'Layers this layout has no place for stayed where they were.',
    'This slide now follows the active design system.',
  ]);
  assert.equal(relayMessage({ ok: true, surplus: 0, adopted: false }), '',
    'a re-lay that did what it looks like says nothing');

  for (const sentence of said) {
    assert.equal(sentence.split('. ').length, 1, `"${sentence}" is one sentence`);
    assert.ok(!sentence.includes('’'), 'straight apostrophes only');
    assert.ok(/^(This|That|Layers)\b/.test(sentence), `"${sentence}" names what it is about`);
  }
  // The two that report a failure carry the view's standing promise, the way pen-tool and
  // dialogs word theirs, so a person knows the slide was left alone.
  assert.ok(said[1]!.endsWith(', so nothing was changed.'));

  assert.deepEqual(slideMasterMenuCopy(), {
    newSlide: 'New slide from layout…',
    applyLayout: 'Apply layout…',
    resetSlide: 'Reset slide',
    noMaster: 'This design system has no slide master.',
  });
});
