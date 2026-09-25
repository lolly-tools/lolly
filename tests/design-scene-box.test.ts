// SPDX-License-Identifier: MPL-2.0
/**
 * Design 3D scene boxes - the kind, the field, the marker and the transport
 * (plan 265 milestone 3, lane A).
 *
 * Run with: node --test tests/design-scene-box.test.ts  (node:test, no framework).
 *
 * A scene box is a `kind:'3d'` row that keeps ONE string: the 3D Studio's own
 * readable link query, with everything at the studio's default left out and
 * device-local upload ids kept. Everything this milestone builds on top of it - the
 * poster, the live renderer, the playhead, the exports, the editor door - reads that
 * string, so the contract guarded here is small and everything else rests on it:
 *
 *   - `'3d'` is a real Design layer kind: `inspectDesignV1` accepts it, reports its
 *     scene, and raises nothing new (an unedited scene is not a fault);
 *   - `scene` is field 101 of `design:boxes` and the wire-order pin ratcheted with it,
 *     so every link minted before this release still decodes with its fields in place;
 *   - the grammar round trips: encode, decode, encode again gives the same bytes, and
 *     a whole document carrying one packs into `?z=` and comes back identical;
 *   - the asset ids inside a scene are findable, so an upload travels in a `.lolly`
 *     and a pinned version stays retained;
 *   - the share link keeps the field (a blocks sub-field is content, never a scalar
 *     under SCALAR_CAP);
 *   - the hook emits the marker the shell enhances, a scene box still PAINTS (unlike
 *     an audio bed or a camera), and a scene box on the sequence lane is timed.
 *
 * Loads the REAL community pack and drives the Design tool through the engine with a
 * stub host, the same way design-audio.test.ts and design-sequence.test.ts do.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { designSceneEncode, designSceneDecode, designSceneAssetIds, designSceneTime } from '../engine/src/design-scene.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import type { InputManifest, InputModelItem, InputValue } from '../engine/src/inputs.ts';
import { isPackAvailable, packQuery, unpackToken } from '../engine/src/url-pack.ts';
import { encodeAssetVersion } from '../engine/src/asset-version.ts';
import { DESIGN_LAYER_KINDS, inspectDesignV1 } from '../packages/core/src/design-v1.ts';
import { encodeModelParam, SCALAR_CAP } from '../shells/web/src/lib/url-budget.ts';
import { collectSessionAssetRefs } from '../shells/web/src/lib/beam-pack.ts';
import { setSceneManifest } from '../shells/web/src/bridge/asset-dependencies.ts';
import { collectAssetRefs } from '../shells/web/src/bridge/asset-ref-collector.ts';
import { baseHost } from './helpers/host.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_DIR = join(ROOT, 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

const designTool: any = await loadTool('design', fetchFile);
const studioManifest = JSON.parse(
  await readFile(join(PACK_DIR, '3d-studio', 'tool.json'), 'utf8'),
) as InputManifest & { inputs: { id: string; type: string; fields?: { id: string }[] }[] };
const wireOrder = JSON.parse(
  await readFile(join(ROOT, 'schemas', 'blocks-wire-order.json'), 'utf8'),
) as { inputs: Record<string, string[]> };

// The studio manifest the two shell walkers decode scenes with. The app registers it
// from its tool loader; a test registers it directly, which is also the statement that
// the walkers read a REGISTERED manifest rather than guessing at a query's shape.
setSceneManifest(studioManifest);

const boxesField = designTool.manifest.inputs.find((i: { id: string }) => i.id === 'boxes');

// ── the three scenes this suite round trips ─────────────────────────────────────────
const TEXT_SCENE: Record<string, InputValue> = {
  source: 'text', words: 'Ship it', wordPose: 'scene', studio: 'electric', motion: 'turntable',
};
const ARRANGEMENT_SCENE: Record<string, InputValue> = {
  source: 'arrangement',
  objects: [
    { name: 'Badge', kind: 'primitive', primitive: 'badge', x: -1.2, z: 0.3, rotY: 12, scale: 0.55 },
    { name: 'Logo', kind: 'artwork', asset: 'user/upload-9f2c', x: 1.05, z: -0.2, scale: 0.4 },
  ] as never,
  backdropImage: 'lolly/backdrop/dune',
  studio: 'warm',
};
const COLLECTION_SCENE: Record<string, InputValue> = {
  source: 'collection',
  collectionName: 'Icon set',
  subjects: [
    { name: 'Badge', kind: 'primitive', primitive: 'badge' },
    { name: 'Ring', kind: 'artwork', asset: 'suse/logo/primary' },
    { name: 'Cube', kind: 'primitive', primitive: 'box', scale: 1.2 },
  ] as never,
  outputMode: 'object',
};

async function mount(boxes: unknown[]): Promise<string> {
  const rt = await createRuntime(designTool, baseHost(), { boxes: boxes as never });
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  return rt.getHydrated() as string;
}

function boxEl(html: string, id: string): HTMLElement {
  const doc = new JSDOM(`<!doctype html><body>${html}</body>`).window.document;
  const el = doc.querySelector(`.lolly-box[data-box-id="${id}"]`) as HTMLElement | null;
  assert.ok(el, `no .lolly-box with data-box-id="${id}"`);
  return el as HTMLElement;
}

// ── A1: the kind ────────────────────────────────────────────────────────────────────

test('"3d" is a Design layer kind, appended and never reordered', () => {
  assert.deepEqual([...DESIGN_LAYER_KINDS],
    ['box', 'text', 'image', 'path', 'audio', 'camera', 'frame', '3d'],
    'DESIGN_LAYER_KINDS is append-only: an existing wire value must never move');
  const kinds = boxesField.fields.find((f: { id: string }) => f.id === 'kind');
  assert.deepEqual(kinds.options.map((o: { value: string }) => o.value),
    [...DESIGN_LAYER_KINDS], 'the manifest kind select and the read model list the same kinds');
});

test('inspectDesignV1 accepts a 3d box, reports its scene, and raises nothing new', () => {
  const report = inspectDesignV1([
    { id: 'page', kind: 'frame', name: 'Page', x: 0, y: 0, w: 1080, h: 1080 },
    { id: 'hero', kind: '3d', frame: 'page', x: 40, y: 40, w: 640, h: 640, scene: 'source=text&words=Hi' },
  ]);
  assert.equal(report.valid, true, `a 3d box is valid: ${JSON.stringify(report.findings)}`);
  assert.deepEqual(report.findings, [], 'the new kind raises nothing of its own');
  const layer = report.layers.find(l => l.id === 'hero')!;
  assert.equal(layer.kind, '3d');
  assert.equal(layer.scene, 'source=text&words=Hi');
});

test('an unedited 3d box (empty scene) is valid and reports no scene', () => {
  const report = inspectDesignV1([{ id: 'hero', kind: '3d', x: 0, y: 0, w: 640, h: 640, scene: '' }]);
  assert.equal(report.valid, true);
  assert.deepEqual(report.findings, []);
  assert.equal(report.layers[0]!.scene, undefined, 'an empty scene is absent, not an empty string');
});

test('the add menu offers a 3D scene whose seed is a scene box', () => {
  const add = boxesField.canvas.addKinds.find((k: { id: string }) => k.id === '3d');
  assert.ok(add, 'canvas.addKinds has no "3d" entry');
  assert.equal(add.label, '3D scene');
  assert.equal(add.seed.kind, '3d');
  assert.equal(add.seed.w, 640);
  assert.equal(add.seed.h, 640);
  // The seed names its studio settings explicitly so a hand-read URL says what the box
  // is. Every one of them is a studio default, so it decodes to exactly what an empty
  // scene decodes to - the encoder normalises it away on the first edit round trip.
  assert.equal(add.seed.scene, 'source=primitive&primitive=badge&studio=dramatic');
  assert.deepEqual(designSceneDecode(add.seed.scene, studioManifest), designSceneDecode('', studioManifest));
});

// ── A2: the field and its wire order ────────────────────────────────────────────────

test('scene is field 101 of design:boxes and the wire-order pin ratcheted with it', () => {
  const current: string[] = boxesField.fields.map((f: { id: string }) => f.id);
  const pinned = wireOrder.inputs['design:boxes']!;
  assert.equal(current.length, 112, 'text ownership, paint, credits, wrap and the slide-master binding append fields');
  assert.equal(current[103], 'textStory');
  assert.equal(current[104], 'textFrame');
  assert.deepEqual(current.slice(105, 108), ['pathPaint', 'vectorSource', 'textWrap']);
  // Plan 274: a box bound to a slide master's placeholder carries the master, its role,
  // whether it is furniture, and the archetype it was laid out from.
  assert.deepEqual(current.slice(108), ['master', 'role', 'furniture', 'archetype']);
  assert.equal(current[101], 'animationId');
  assert.equal(current[102], 'animationEdits');
  assert.equal(current[100], 'scene', 'scene is the 101st field, appended after plainText');
  // The rule scripts/validate-catalog.ts enforces: the pin is a prefix of the manifest
  // and the two are the same length once ratcheted. Nothing existing may move.
  assert.deepEqual(pinned, current, 'schemas/blocks-wire-order.json must be ratcheted in the same change');
  const scene = boxesField.fields[100];
  assert.equal(scene.type, 'text', 'a blocks field has no longtext control; text is what path and kf use');
  assert.deepEqual(scene.showFor, [], 'machine-written, so it never appears in the sidebar');
  assert.equal(scene.default, '');
  assert.match(scene.help, /3D Studio/);
});

// ── A3: the grammar ─────────────────────────────────────────────────────────────────

for (const [name, values] of Object.entries({
  'a text scene': TEXT_SCENE,
  'an arrangement with two objects and a user upload': ARRANGEMENT_SCENE,
  'a collection with three subjects': COLLECTION_SCENE,
})) {
  test(`${name} encodes to a delta and round trips byte-equal`, () => {
    const query = designSceneEncode(values, studioManifest);
    const decoded = designSceneDecode(query, studioManifest);
    assert.equal(designSceneEncode(decoded, studioManifest), query,
      'encode(decode(q)) must be the same bytes, or a document changes when it is merely reopened');
    // Only what differs from the studio's defaults. `studio` defaults to 'dramatic',
    // so a scene that never touched it must not carry it.
    const params = new URLSearchParams(query);
    assert.equal(params.has('primitive'), false, 'a value left at its default is not in the query');
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === 'string') assert.equal(params.get(key), value, `${key} survives`);
    }
    // Small enough to sit in a box field: the whole recipe as JSON is about 2.5 KB.
    assert.ok(query.length < 1024, `${name} encodes to ${query.length} bytes`);
  });
}

test('a cleared value is written as a bare key, not omitted back to the default', () => {
  // `words` defaults to "Hello". Omitting an emptied field would hand the default back.
  const query = designSceneEncode({ words: '' }, studioManifest);
  assert.equal(query, 'words=');
  assert.equal(designSceneDecode(query, studioManifest).words, '');
});

test('an empty scene decodes to the studio defaults and encodes back to nothing', () => {
  assert.equal(designSceneEncode({}, studioManifest), '');
  const decoded = designSceneDecode('', studioManifest);
  assert.equal(decoded.studio, 'dramatic');
  assert.equal(decoded.words, 'Hello');
});

test('a whole document with a 3d box packs into ?z= and comes back byte-equal', async (t) => {
  if (!isPackAvailable()) return t.skip('no CompressionStream on this runtime');
  const boxes = [
    { id: 'page', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080 },
    { id: 'hero', kind: '3d', frame: 'page', x: 40, y: 40, w: 640, h: 640,
      scene: designSceneEncode(ARRANGEMENT_SCENE, studioManifest) },
  ];
  const model = buildInputModel(designTool.manifest, { initial: { boxes: boxes as never } });
  const readable = serializeUrlState(model as InputModelItem[], { keepUserIds: true });
  const token = await packQuery(readable);
  assert.ok(token, 'packQuery returned nothing');
  assert.equal(await unpackToken(token!), readable, 'the ?z= round trip is lossy');
  // ...and the scene survives the readable form itself, not just the compression.
  const back = parseUrlState(readable, designTool.manifest).values.boxes as Record<string, unknown>[];
  assert.equal(back[1]!.kind, '3d');
  assert.equal(back[1]!.scene, boxes[1]!.scene);
});

// ── A5: the dependency walkers ──────────────────────────────────────────────────────

test('designSceneAssetIds finds catalog and user ids, in manifest order, deduped', () => {
  const query = designSceneEncode(ARRANGEMENT_SCENE, studioManifest);
  assert.deepEqual(designSceneAssetIds(query, studioManifest), ['user/upload-9f2c', 'lolly/backdrop/dune']);
  assert.deepEqual(designSceneAssetIds(designSceneEncode(COLLECTION_SCENE, studioManifest), studioManifest),
    ['suse/logo/primary']);
  assert.deepEqual(designSceneAssetIds(designSceneEncode(TEXT_SCENE, studioManifest), studioManifest), [],
    'a scene with no pictures references no assets');
  assert.deepEqual(designSceneAssetIds('', studioManifest), []);
});

test('a user upload inside a scene is part of the session closure a .lolly packs', () => {
  const session = {
    tool: 'design',
    values: {
      boxes: [
        { id: 'page', kind: 'frame', x: 0, y: 0, w: 1080, h: 1080 },
        { id: 'photo', kind: 'image', x: 0, y: 0, w: 300, h: 300,
          image: { source: 'user', id: 'user/photo-1', url: 'blob:x' } },
        { id: 'hero', kind: '3d', x: 40, y: 40, w: 640, h: 640,
          scene: designSceneEncode(ARRANGEMENT_SCENE, studioManifest) },
      ],
    },
  };
  const refs = collectSessionAssetRefs(session);
  assert.ok(refs.user.includes('user/upload-9f2c'),
    `the scene's upload must travel; got ${JSON.stringify(refs.user)}`);
  assert.ok(refs.user.includes('user/photo-1'), 'the ordinary image box still travels');
  assert.ok(refs.library.includes('lolly/backdrop/dune'),
    `the scene's catalog asset is listed by reference; got ${JSON.stringify(refs.library)}`);
});

test('a scene with no 3d kind, or an empty scene, adds nothing to the closure', () => {
  const plain = collectSessionAssetRefs({
    values: { boxes: [{ id: 'a', kind: 'box', scene: 'artwork=user%2Fnever' }] },
  });
  assert.deepEqual(plain.user, [], 'a scene string on a non-3d row is not a scene');
  const empty = collectSessionAssetRefs({ values: { boxes: [{ id: 'a', kind: '3d', scene: '' }] } });
  assert.deepEqual([...empty.user, ...empty.library], []);
});

test('a PINNED scene asset stays a retention root; an unpinned one names no version', () => {
  const pinnedId = encodeAssetVersion('lolly/backdrop/dune', { version: '3', format: 'png' });
  const pinned = new Set<string>();
  collectAssetRefs({ boxes: [{ id: 'hero', kind: '3d', scene: `backdropImage=${encodeURIComponent(pinnedId)}` }] }, pinned);
  assert.deepEqual([...pinned], ['lolly/backdrop/dune:png:3']);
  const loose = new Set<string>();
  collectAssetRefs({ boxes: [{ id: 'hero', kind: '3d', scene: 'backdropImage=lolly%2Fbackdrop%2Fdune' }] }, loose);
  assert.deepEqual([...loose], [], 'retention is about held versions, and an unpinned id names none');
});

// ── A2 (the other half): the share link keeps the field ─────────────────────────────

test('the share link keeps a scene: a blocks sub-field is content, never a capped scalar', () => {
  const scene = designSceneEncode(COLLECTION_SCENE, studioManifest);
  assert.ok(scene.length > SCALAR_CAP,
    `this scene must be longer than SCALAR_CAP to be worth the test (${scene.length} bytes)`);
  const rows = encodeModelParam({
    id: 'boxes', type: 'blocks', label: 'Boxes', value: [{ id: 'hero', kind: '3d', scene }] as never,
    fields: boxesField.fields, isDirty: true, control: 'blocks',
  } as unknown as InputModelItem);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.status, 'kept', 'the boxes value rides uncapped, so the scene rides with it');
  assert.ok(rows[0]!.emit.includes(encodeURIComponent(encodeURIComponent('source=collection'))),
    'the scene query is in the emitted share param (two encode layers, as the blocks form documents)');
});

// ── A4: the marker ──────────────────────────────────────────────────────────────────

test('a 3d box emits the scene marker, html-escaped, in the poster state', async () => {
  const scene = designSceneEncode(TEXT_SCENE, studioManifest);
  const html = await mount([
    { id: 'hero', kind: '3d', x: 0, y: 0, w: 640, h: 640, scene },
  ]);
  const marker = boxEl(html, 'hero').querySelector('.lolly-box-scene') as HTMLElement | null;
  assert.ok(marker, 'no .lolly-box-scene marker');
  assert.ok(marker!.classList.contains('lolly-box-img'), 'the marker reuses .lolly-box-img for position and size');
  assert.equal(marker!.getAttribute('data-lolly-scene'), scene, 'the attribute decodes back to the exact query');
  assert.equal(marker!.getAttribute('data-scene-state'), 'poster');
  assert.ok(html.includes('&amp;'), 'the query\'s "&" is html-escaped in the attribute');
});

test('an empty scene still emits the marker, with an empty attribute', async () => {
  const html = await mount([{ id: 'hero', kind: '3d', x: 0, y: 0, w: 640, h: 640, scene: '' }]);
  const marker = boxEl(html, 'hero').querySelector('.lolly-box-scene') as HTMLElement | null;
  assert.ok(marker, 'a box that has never been edited is still a scene box');
  assert.equal(marker!.getAttribute('data-lolly-scene'), '');
});

test('a scene box PAINTS: unlike an audio bed or a camera it keeps its fill and its text', async () => {
  const html = await mount([
    { id: 'hero', kind: '3d', x: 0, y: 0, w: 640, h: 640, bg: '#123456', text: 'Caption', scene: 'source=text' },
    { id: 'cam', kind: 'camera', x: 0, y: 0, w: 100, h: 100, bg: '#123456', text: 'Caption' },
  ]);
  const scene = boxEl(html, 'hero');
  assert.match(scene.getAttribute('style') ?? '', /#123456/, 'a scene box keeps its own background');
  assert.match(scene.textContent ?? '', /Caption/, 'a scene box keeps its text run');
  const cam = boxEl(html, 'cam');
  assert.doesNotMatch(cam.getAttribute('style') ?? '', /#123456/, 'a camera is still bare');
  assert.doesNotMatch(cam.textContent ?? '', /Caption/, 'a camera is still bare');
});

test('a 3d box on the sequence lane is timed like any other box', async () => {
  const html = await mount([
    { id: 'hero', kind: '3d', lane: 'seq', start: 0.5, dur: 3, x: 0, y: 0, w: 640, h: 640, scene: 'source=text' },
  ]);
  const el = boxEl(html, 'hero');
  assert.equal(el.getAttribute('data-t-start'), '500', 'timeAttrsFor needs no scene branch');
  assert.equal(el.getAttribute('data-t-dur'), '3000');
});

test('a 3d box OFF the lane is scenery and carries no timing', async () => {
  const html = await mount([{ id: 'hero', kind: '3d', x: 0, y: 0, w: 640, h: 640, scene: 'source=text' }]);
  assert.equal(boxEl(html, 'hero').getAttribute('data-t-start'), null);
});

// ── the playhead's own arithmetic (lane C) ──────────────────────────────────

test('designSceneTime turns a source moment into a position in the scene clip', () => {
  // The ONE conversion the preview clock and the export compositor both use, so a
  // scrubbed frame and an exported one are the same picture (decision Q21).
  assert.equal(designSceneTime(0, 4), 0);
  assert.equal(designSceneTime(1000, 4), 0.25);
  assert.equal(designSceneTime(4000, 4), 1, 'the end of the clip is a whole turn');
  // Past the clip length the answer keeps climbing: looping is the RECIPE's business
  // (a looping camera path wraps, an open one holds its last key), never this helper's.
  assert.equal(designSceneTime(6000, 4), 1.5);
  // The clip length is the SCENE's, not the box's, so a box trimmed short shows less of
  // the scene rather than a faster version of it.
  assert.equal(designSceneTime(1000, 2), 0.5);
  // Nothing to divide by is the scene at rest, never Infinity or NaN.
  assert.equal(designSceneTime(1000, 0), 0);
  assert.equal(designSceneTime(1000, Number.NaN), 0);
  assert.equal(designSceneTime(Number.NaN, 4), 0);
});

// ── the manifest registration at boot (lane E) ──────────────────────────────

test('the boot module registers how to load the 3D Studio manifest, lazily', async () => {
  // Packing a project to a `.lolly` from Projects is the case this exists for: no Design
  // canvas has painted, so nothing has read a scene marker, and without a registered
  // loader the walker above would find no scene ids and the upload inside the scene
  // would be left out of the file. A SOURCE pin rather than a mounted test, because
  // main.ts is the browser entry - it touches window, the service worker and the DOM on
  // import, so Node cannot load it.
  const main = await readFile(join(ROOT, 'shells/web/src/main.ts'), 'utf8');
  assert.match(main, /import \{ setSceneManifestLoader, SCENE_TOOL_ID \} from '\.\/bridge\/scene-manifest\.ts';/,
    'main.ts imports the registration from the boot-safe module that owns the registry');
  assert.match(main, /setSceneManifestLoader\(\(\) =>/, 'and calls it during boot');
  // Lazy: the tool loader pulls in the engine barrel, which must stay off the boot path
  // (shells/web/src/boot-path-guard.test.ts), so it is reached with an import() INSIDE
  // the registered function rather than at the top of the file.
  const call = /setSceneManifestLoader\(\(\)[\s\S]{0,600}?\)\);/.exec(main)?.[0] ?? '';
  assert.match(call, /import\('\.\/bridge\/tool-loader\.ts'\)/, 'the tool loader is reached with import()');
  assert.match(call, /getTool\(SCENE_TOOL_ID\)/);
  assert.match(call, /tool\.manifest/);
  assert.match(call, /\.catch\(/, 'a catalog that cannot answer is not a boot failure');
  assert.doesNotMatch(main, /from '\.\/bridge\/tool-loader\.ts'/, 'and never statically');
  assert.doesNotMatch(main, /design-scene-mount/, 'the canvas enhancer stays off the boot path entirely');
});
