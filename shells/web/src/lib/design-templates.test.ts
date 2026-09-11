// SPDX-License-Identifier: MPL-2.0
/**
 * Components as templates - the storage half (plan section 2.2, phase 1.2).
 *
 * Run directly:  node --test shells/web/src/lib/design-templates.test.ts
 *
 * No DOM and no zip machinery: this module was split out of the importer so the
 * wire structure of a template session, the folder it lands in, and the two pure
 * helpers the importer leans on can be pinned against a fake host. The parsing
 * half (subtree walk → boxes) is pinned by tests/penpot-keynote-replay.test.ts
 * and tests/penpot-kitchen-sink.test.ts against real Penpot exports.
 *
 * The invariant most of this exists for is ADDITIVITY: a template is an
 * ordinary saved session carrying two extra `__` keys, so every existing reader
 * (Projects, backup/restore, the Tauri shells) keeps working untouched and
 * SESSION_FORMAT_VERSION does not move.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

import {
  alignBoxIds, fileTemplatesAsSessions, penpotComponentThumb,
  templateFolderName, templateSessionData, TEMPLATE_THUMB_MAX_BYTES,
  type DesignTemplate, type TemplateHost,
} from './design-templates.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

// ── a fake host: an in-memory profile + state store ──────────────────────────

interface FakeHost extends TemplateHost {
  _profile: { folders?: unknown[] };
  _saved: Array<{ slot: string; data: Record<string, unknown>; thumb: string | null }>;
}
function fakeHost(opts: { failSlot?: string } = {}): FakeHost {
  const profile: { folders?: any[] } = {};
  const saved: FakeHost['_saved'] = [];
  return {
    _profile: profile,
    _saved: saved,
    profile: {
      get: async () => profile,
      set: async (p: any) => { profile.folders = p.folders; },
    },
    state: {
      list: async () => saved.map(s => ({ slot: s.slot })),
      save: async (slot, data, thumb = null) => {
        if (opts.failSlot && slot === opts.failSlot) throw new Error('quota exceeded');
        saved.push({ slot, data, thumb: thumb ?? null });
      },
    },
    assets: { _listUserAssets: async () => [] },
  };
}

const tpl = (name: string, over: Partial<DesignTemplate> = {}): DesignTemplate => ({
  name, path: 'titles', boxes: [{ id: 'n0', kind: 'box' }], width: 895, height: 503,
  slots: [{ boxId: 'n1', kind: 'text', label: 'Subtitle', text: 'Lorem ipsum' }],
  ...over,
});

// ── the folder name ──────────────────────────────────────────────────────────

test('the folder is named after the imported file, extension stripped', () => {
  assert.equal(templateFolderName('UXDays 2026 Keynote (3).penpot'), 'UXDays 2026 Keynote (3) templates');
  assert.equal(templateFolderName('deck.zip'), 'deck templates');
  assert.equal(templateFolderName('  spaced  '), 'spaced templates');
  // A blob with no name must still land somewhere findable.
  assert.equal(templateFolderName(''), 'Imported templates');
  assert.equal(templateFolderName(undefined), 'Imported templates');
});

// ── the session payload ──────────────────────────────────────────────────────

test('a template session is an ordinary session plus two additive `__` keys', () => {
  const data = templateSessionData(tpl('PERSON INTRO'), {
    toolId: 'design', toolVersion: '1.10.0', boxesField: 'boxes', format: 'png',
  });
  // The boxes go to the tool's OWN blocks input, whatever it is called.
  assert.deepEqual(data.boxes, [{ id: 'n0', kind: 'box' }]);
  assert.equal(data.__toolId, 'design');
  assert.equal(data.__toolVersion, '1.10.0');
  assert.equal(data.__label, 'PERSON INTRO', 'the label IS the component name');
  assert.equal(data.__template, true);
  assert.deepEqual(data.__slots, [{ boxId: 'n1', kind: 'text', label: 'Subtitle', text: 'Lorem ipsum' }]);
  // The canvas size rides the existing export-bar keys - no new size channel.
  assert.equal(data.__export_width, '895');
  assert.equal(data.__export_height, '503');
  assert.equal(data.__export_unit, 'px');
  assert.equal(data.__export_format, 'png');
  // Nothing else: a template must not invent fields an old reader would choke on.
  assert.deepEqual(Object.keys(data).sort(), [
    '__export_format', '__export_height', '__export_unit', '__export_width',
    '__label', '__slots', '__template', '__toolId', '__toolVersion', 'boxes',
  ]);
  // And every added key is in the `__` namespace, which readers already ignore.
  assert.deepEqual(Object.keys(data).filter(k => k !== 'boxes' && !k.startsWith('__')), []);

  // A tool with a differently named blocks input, and no declared format.
  const other = templateSessionData(tpl('X'), { toolId: 'carousel-maker', boxesField: 'items' });
  assert.deepEqual(other.items, [{ id: 'n0', kind: 'box' }]);
  assert.equal(other.boxes, undefined);
  assert.equal(other.__export_format, '');
  assert.equal(other.__toolVersion, '');
});

// ── filing ───────────────────────────────────────────────────────────────────

test('one session per component, all filed into one new per-file folder', async () => {
  const host = fakeHost();
  const templates = [tpl('TEXT 8'), tpl('TEXT 9', { thumb: 'data:image/png;base64,AAAA' }), tpl('TITLES2')];
  const out = await fileTemplatesAsSessions(host, templates, {
    fileName: 'Keynote.penpot', toolId: 'design', toolVersion: '1.10.0',
    boxesField: 'boxes', format: 'png', now: () => 1000,
  });

  assert.equal(out.saved, 3);
  assert.equal(out.folderName, 'Keynote templates');
  assert.deepEqual(out.slots, ['design:1000', 'design:1001', 'design:1002'],
    'slots are minted off one stamp, so a batch can never collide with itself');
  assert.deepEqual(host._saved.map(s => s.data.__label), ['TEXT 8', 'TEXT 9', 'TITLES2']);
  // Penpot's own preview rides the existing 3-arg save; the rest save thumbless.
  assert.deepEqual(host._saved.map(s => s.thumb), [null, 'data:image/png;base64,AAAA', null]);

  const folders = host._profile.folders as Array<{ name: string; items: Array<{ type: string; ref: string }> }>;
  assert.equal(folders.length, 1, 'exactly one folder, not one per template');
  assert.equal(folders[0]!.name, 'Keynote templates');
  assert.deepEqual(folders[0]!.items, out.slots.map(ref => ({ type: 'session', ref })));
});

test('a failed save warns and the rest of the design system still lands', async () => {
  const host = fakeHost({ failSlot: 'design:2001' });
  const warnings: string[] = [];
  const out = await fileTemplatesAsSessions(host, [tpl('A'), tpl('B'), tpl('C')], {
    fileName: 'deck.penpot', toolId: 'design', boxesField: 'boxes',
    warn: (m) => warnings.push(m), now: () => 2000,
  });
  assert.equal(out.saved, 2);
  assert.deepEqual(out.slots, ['design:2000', 'design:2002']);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /“B”/);
  const folders = host._profile.folders as Array<{ items: unknown[] }>;
  assert.equal(folders[0]!.items.length, 2, 'only the saved ones are filed');
});

test('re-importing the same file mints a second folder (the v1 assumption)', async () => {
  const host = fakeHost();
  const opts = { fileName: 'deck.penpot', toolId: 'design', boxesField: 'boxes' };
  await fileTemplatesAsSessions(host, [tpl('A')], { ...opts, now: () => 10 });
  await fileTemplatesAsSessions(host, [tpl('A')], { ...opts, now: () => 20 });
  const folders = host._profile.folders as Array<{ name: string }>;
  assert.equal(folders.length, 2);
  assert.deepEqual(folders.map(f => f.name), ['deck templates', 'deck templates']);
});

// ── slot → box pairing ───────────────────────────────────────────────────────

const box = (id: string, kind: string, x: number, y: number, w: number, h: number) => ({ id, kind, x, y, w, h });

test('alignBoxIds pairs nodes with the boxes they became, dropped nodes included', () => {
  const nodes = [
    { kind: 'box', x: 0, y: 0, w: 100, h: 50 },
    { kind: 'text', x: 10.4, y: 20.6, w: 80, h: 12 },   // rounds to 10 / 21
    { kind: 'box', x: 5, y: 5, w: 0.2, h: 0.2 },        // degenerate: dropped
    { kind: 'image', x: 0, y: 0, w: 100, h: 100 },
  ];
  const boxes = [
    box('n0', 'box', 0, 0, 100, 50),
    box('n1', 'text', 10, 21, 80, 12),
    box('n2', 'image', 0, 0, 100, 100),
  ];
  assert.deepEqual(alignBoxIds(nodes, boxes), ['n0', 'n1', null, 'n2'],
    'the dropped node gets no box, and everything after it still pairs');
});

test('alignBoxIds refuses to guess when the shapes stop matching', () => {
  const nodes = [{ kind: 'box', x: 0, y: 0, w: 10, h: 10 }, { kind: 'text', x: 0, y: 0, w: 10, h: 10 }];
  // A box whose geometry matches nothing: the pairing stops rather than handing
  // a slot the wrong box (the whole point of matching instead of index-guessing).
  assert.deepEqual(alignBoxIds(nodes, [box('n0', 'box', 999, 0, 10, 10)]), [null, null]);
  assert.deepEqual(alignBoxIds([], [box('n0', 'box', 0, 0, 1, 1)]), []);
  assert.deepEqual(alignBoxIds([null, undefined], []), [null, null]);
});

// ── Penpot's own component previews ──────────────────────────────────────────
//
// The fixture carries the three `objects/*.png` previews its four
// `thumbnails/component/**` pointers reference (3.5 KB); the other five PNGs of
// the original export stay stripped. Without them this path would only ever be
// exercised by the gated keynote replay, and it is the reason a template tile
// looks like the component instead of a placeholder.

const FIXTURE = join(ROOT, 'tests/fixtures/penpot-kitchen-sink.penpot');
const FILE_ID = 'ddb7145f-a1be-80bb-8008-69139da641d1';
const PAGE_ID = 'd1b6b7c9-cced-466c-b71e-3575b7196282';
const MAIN_V1 = '827d3d24-06b4-8097-8008-6914c7c6f474';
const MAIN_V2 = '827d3d24-06b4-8097-8008-6914d498a685';
const files = unzipSync(new Uint8Array(readFileSync(FIXTURE))) as Record<string, Uint8Array>;

test('a component master resolves to Penpot’s own preview, as a raster data URL', () => {
  for (const frameId of [MAIN_V1, MAIN_V2]) {
    const url = penpotComponentThumb(files, FILE_ID, PAGE_ID, frameId)!;
    assert.ok(url, `${frameId}: a preview was found`);
    assert.match(url, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    // Round-trips to the exact bytes the archive holds (PNG magic, non-empty).
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.ok(bytes.length > 500);
  }
  // The two variants of one set have their own previews, so a set is not one
  // picture repeated.
  assert.notEqual(penpotComponentThumb(files, FILE_ID, PAGE_ID, MAIN_V1),
    penpotComponentThumb(files, FILE_ID, PAGE_ID, MAIN_V2));
});

test('a missing pointer, a missing object or a bad id yields null, never a broken src', () => {
  assert.equal(penpotComponentThumb(files, FILE_ID, PAGE_ID, 'no-such-frame'), null);
  assert.equal(penpotComponentThumb(files, 'no-such-file', PAGE_ID, MAIN_V1), null);
  assert.equal(penpotComponentThumb(files, FILE_ID, 'no-such-page', MAIN_V1), null);
  // A pointer whose object was stripped from the archive (the state the rest of
  // this fixture is in) resolves to nothing rather than a dangling data URL.
  const stripped = { ...files };
  for (const p of Object.keys(stripped)) if (/^objects\/.*\.png$/.test(p)) delete stripped[p];
  assert.equal(penpotComponentThumb(stripped, FILE_ID, PAGE_ID, MAIN_V1), null);
});

test('untrusted preview bytes: only real raster formats, only sane sizes', () => {
  const ptrPath = `files/${FILE_ID}/thumbnails/component/${PAGE_ID}/${MAIN_V1}.json`;
  const mediaId = JSON.parse(new TextDecoder().decode(files[ptrPath]!)).mediaId as string;
  const objPath = `objects/${mediaId}.png`;
  const swap = (bytes: Uint8Array): string | null =>
    penpotComponentThumb({ ...files, [objPath]: bytes }, FILE_ID, PAGE_ID, MAIN_V1);

  // An SVG wearing a .png name is refused: the magic number decides, so the
  // scriptable format can never reach an <img> through this path.
  assert.equal(swap(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
  assert.equal(swap(new Uint8Array(0)), null);
  assert.equal(swap(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), null);
  // JPEG and WebP are accepted (Penpot has written PNG so far, but the format
  // is its choice, not ours).
  assert.match(swap(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))!, /^data:image\/jpeg;base64,/);
  const webp = new Uint8Array(16);
  webp.set([0x52, 0x49, 0x46, 0x46], 0);
  webp.set([0x57, 0x45, 0x42, 0x50], 8);
  assert.match(swap(webp)!, /^data:image\/webp;base64,/);
  // Oversized: a session record carries the data URL inline, so it is dropped.
  const huge = new Uint8Array(TEMPLATE_THUMB_MAX_BYTES + 1);
  huge.set([0x89, 0x50, 0x4e, 0x47], 0);
  assert.equal(swap(huge), null);
});
