// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { lollyFeatureReader } from '../packages/core/src/lolly-features.ts';
import { readLollyFile as readNode } from '../packages/node-shell/src/lolly-file.ts';
import { packageDesign } from '../packages/node-shell/src/design-lolly.ts';
import {
  buildLollyFile, readLollyFile, LOLLY_HIERARCHY_MIN_READER, LOLLY_READER_VERSION,
  LOLLY_PROJECT_TOOL_ID, type LollyBuildResult,
} from '../shells/web/src/lib/lolly-pack.ts';

const document = () => ({
  __toolId: 'design', __label: 'Nested campaign',
  pages: [{ id: 'one', name: 'Campaign', order: 0 }, { id: 'two', name: 'Archive', order: 1 }],
  boxes: [
    { id: 'f1', kind: 'frame', pageId: 'one', x: 0, y: 0, w: 400, h: 300 },
    { id: 'outer', kind: 'group', frame: 'f1', name: 'Card', x: 20, y: 30, w: 100, h: 80 },
    { id: 'inner', kind: 'group', group: 'outer', name: 'Badge', x: 20, y: 30, w: 60, h: 30 },
    { id: 'label', kind: 'text', group: 'inner', text: 'Hello', x: 20, y: 30, w: 60, h: 30,
      keyframes: [{ time: 0, x: 20 }, { time: 1, x: 40 }] },
    { id: 'f2', kind: 'frame', pageId: 'two', x: 0, y: 0, w: 400, h: 300 },
    { id: 'old', kind: 'box', frame: 'f2', x: 30, y: 40, w: 100, h: 50 },
  ],
});
const bytesOf = async (built: LollyBuildResult) => new Uint8Array(await built.blob.arrayBuffer());
function forgeReader(bytes: Uint8Array, reader: unknown): Uint8Array {
  const entries = unzipSync(bytes), manifest = JSON.parse(strFromU8(entries['manifest.json']!));
  if (reader === undefined) delete manifest.minReader;
  else manifest.minReader = reader;
  entries['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(entries);
}

test('hierarchical Design shares preserve pages, nested ownership and global geometry in both readers', async () => {
  const session = document();
  const built = await buildLollyFile({ toolId: 'design', session, userAssets: [] });
  assert.equal(LOLLY_HIERARCHY_MIN_READER, 7);
  assert.equal(LOLLY_READER_VERSION, 8);
  assert.equal(built.manifest.minReader, 7);
  const bytes = await bytesOf(built);
  assert.deepEqual((await readLollyFile(bytes)).session, session);
  assert.deepEqual(readNode(bytes).session, session);
  assert.ok(built.manifest.integrity?.['session.json']);
});

test('collective group effects and content sizing require reader 8 in both file readers', async () => {
  for (const fields of [{ opacity: 50 }, { opacity: 0 }, { blend: 'multiply' }, { layoutW: 'fill' }, { layoutH: 'hug' }]) {
    const session = document();
    Object.assign(session.boxes[1]!, fields);
    const built = await buildLollyFile({ toolId: 'design', session, userAssets: [] });
    assert.equal(built.manifest.minReader, 8);
    const bytes = await bytesOf(built);
    assert.deepEqual((await readLollyFile(bytes)).session, session);
    assert.deepEqual(readNode(bytes).session, session);
    for (const reader of [7, undefined, '8']) {
      await assert.rejects(readLollyFile(forgeReader(bytes, reader)), /reader gate.*reader 8/);
      assert.throws(() => readNode(forgeReader(bytes, reader)), /reader gate.*reader 8/);
    }
  }
});

test('group feature gates inspect later rows, projects and templates without downgrading', () => {
  const advanced = { kind: 'group', opacity: 50 };
  for (const boxes of [[{ kind: 'group' }, advanced], [advanced, { kind: 'box', layout: 'flex' }]]) {
    assert.equal(lollyFeatureReader({ toolId: 'design', session: { boxes } }), 8);
    assert.equal(lollyFeatureReader({ project: { sessions: [{ toolId: 'design', data: { boxes } }] } }), 8);
    assert.equal(lollyFeatureReader({ templates: [{ toolId: 'design', values: { boxes } }] }), 8);
  }
  assert.equal(lollyFeatureReader({ toolId: 'design', session: { boxes: [{ kind: 'group', opacity: 100, blend: 'normal', layoutW: 'fixed', layoutH: 'fixed' }, { layout: 'flex' }] } }), 7);
  assert.equal(lollyFeatureReader({ toolId: 'chart', session: { boxes: [advanced] } }), 1);
});

test('large ordinary hierarchy files retain reader 7 and inspect the final layer for new features', () => {
  const boxes: Record<string, unknown>[] = Array.from({ length: 20000 }, (_, n) => ({
    id: `b${n}`, kind: n === 0 ? 'group' : 'box', group: n === 0 ? '' : 'b0',
    ...Object.fromEntries(Array.from({ length: 158 }, (_, field) => [`field${field}`, field])),
  }));
  assert.equal(lollyFeatureReader({ toolId: 'design', session: { boxes } }), 7);
  boxes[boxes.length - 1] = { kind: 'group', opacity: 50 };
  assert.equal(lollyFeatureReader({ toolId: 'design', session: { boxes } }), 8);
});

test('Node Design packaging writes a hierarchy gate and preserves named pages and group records', async () => {
  const session = document();
  const built = await packageDesign(session, { catalog: null, toolVersion: '1.49.0', exportedAt: '2026-10-11T12:00:00.000Z' });
  const node = readNode(built.bytes), web = await readLollyFile(built.bytes);
  assert.equal(node.manifest.minReader, 7);
  assert.deepEqual(node.session.pages, session.pages);
  assert.deepEqual(node.session.boxes, session.boxes);
  assert.deepEqual(web.session, node.session);
  assert.equal(built.report.readback.ok, true);
});

test('hierarchy gates cover Design sessions within a project and retain the complete folder tree', async () => {
  const session = document();
  const folders = [
    { id: 'root', name: 'Campaign', parentId: null, items: [{ type: 'session' as const, ref: 'design' }] },
    { id: 'child', name: 'Charts', parentId: 'root', items: [{ type: 'session' as const, ref: 'chart' }] },
  ];
  const built = await buildLollyFile({ kind: 'project', toolId: LOLLY_PROJECT_TOOL_ID, session: null,
    project: { name: 'Campaign', folders, sessions: [
      { key: 'design', toolId: 'design', data: session },
      { key: 'chart', toolId: 'chart', data: { title: 'Totals', data: 'A,1' } },
    ] }, userAssets: [] });
  assert.equal(built.manifest.minReader, 7);
  const bytes = await bytesOf(built), read = await readLollyFile(bytes);
  assert.ok(read.project);
  assert.deepEqual(read.project?.folders, folders);
  assert.deepEqual(read.project.sessions[0]!.data, session);
  assert.deepEqual(read.project.sessions[1]!.data, { title: 'Totals', data: 'A,1' });
  await assert.rejects(readLollyFile(forgeReader(bytes, 6)), /reader gate.*reader 7/);
  assert.throws(() => readNode(bytes), /project folder with 2 saved sessions/);
});

test('Design template values require hierarchy support even beside an unrelated flat session', async () => {
  const templates = [{ id: 'starter', toolId: 'design', name: 'Card', values: document(), createdAt: '', updatedAt: '' }];
  const built = await buildLollyFile({ toolId: 'chart', session: { title: 'Flat' }, templates, userAssets: [] });
  assert.equal(built.manifest.minReader, 7);
  const bytes = await bytesOf(built);
  assert.deepEqual((await readLollyFile(bytes)).templates, templates);
  assert.deepEqual(readNode(bytes).session, { title: 'Flat' });
  for (const reader of [6, undefined]) {
    await assert.rejects(readLollyFile(forgeReader(bytes, reader)), /reader gate.*reader 7/);
    assert.throws(() => readNode(forgeReader(bytes, reader)), /reader gate.*reader 7/);
  }
});

test('each hierarchy representation is detected while legacy flat and unrelated values keep their gates', async () => {
  for (const session of [
    { pages: [{ id: 'one', name: 'One' }], boxes: [] },
    { boxes: [{ id: 'g', kind: 'group' }] },
    { boxes: [{ id: 'a', kind: 'box', pageId: 'one' }] },
  ]) {
    const built = await buildLollyFile({ toolId: 'design', session, userAssets: [] });
    assert.equal(built.manifest.minReader, 7);
  }
  const flat = { boxes: [{ id: 'a', kind: 'box', group: 'legacy-tag', pageId: '' }], pages: [] };
  const plain = await buildLollyFile({ toolId: 'design', session: flat, userAssets: [] });
  assert.equal(plain.manifest.minReader, 1);
  assert.deepEqual(readNode(await bytesOf(plain)).session, flat);
  const unrelated = await buildLollyFile({ toolId: 'chart', session: { pages: ['text'], kind: 'group', pageId: 'chapter' }, userAssets: [] });
  assert.equal(unrelated.manifest.minReader, 1);
  const layout = await buildLollyFile({ toolId: 'design', session: { boxes: [{ layout: 'grid' }] }, userAssets: [] });
  assert.equal(layout.manifest.minReader, 6);
  assert.deepEqual(readNode(await bytesOf(layout)).session, { boxes: [{ layout: 'grid' }] });
});

test('verified hierarchy payloads cannot bypass either reader by deleting, lowering or mistyping minReader', async () => {
  const built = await buildLollyFile({ toolId: 'design', session: document(), userAssets: [] });
  const bytes = await bytesOf(built);
  for (const reader of [1, 6, undefined, '7']) {
    const forged = forgeReader(bytes, reader);
    await assert.rejects(readLollyFile(forged), /reader gate.*reader 7/);
    assert.throws(() => readNode(forged), /reader gate.*reader 7/);
  }
});

test('bundled Design input declarations require reader 7 without authored hierarchy values', async () => {
  for (const input of [
    { id: 'pages', type: 'blocks', default: [], fields: [] },
    { id: 'boxes', type: 'blocks', fields: [{ id: 'pageId', type: 'text', default: '' }] },
    { id: 'boxes', type: 'blocks', fields: [{ id: 'kind', type: 'select', options: [{ value: 'box' }, { value: 'group' }] }] },
  ]) {
    const tool = { id: 'design', version: '1.49.0', trust: 'custom' as const, files: {
      'tool.json': strToU8(JSON.stringify({ id: 'design', version: '1.49.0', inputs: [input] })),
      'template.html': strToU8('<div>Design</div>'),
    } };
    const built = await buildLollyFile({ kind: 'tool', toolId: 'design', session: null, tool, userAssets: [] });
    assert.equal(built.manifest.minReader, 7);
    const bytes = await bytesOf(built);
    assert.equal((await readLollyFile(bytes)).manifest.kind, 'tool');
    assert.equal(readNode(bytes, { allowTool: true }).manifest.kind, 'tool');
    await assert.rejects(readLollyFile(forgeReader(bytes, 6)), /reader gate.*reader 7/);
    assert.throws(() => readNode(forgeReader(bytes, 6), { allowTool: true }), /reader gate.*reader 7/);
  }
});

test('the shared feature scan handles cycles and refuses to underdeclare an exhausted scan budget', () => {
  const cycle: Record<string, unknown> = { boxes: [] }; cycle.self = cycle;
  assert.equal(lollyFeatureReader({ toolId: 'design', session: cycle }), 1);
  assert.equal(lollyFeatureReader({ toolId: 'design', session: { boxes: Array.from({ length: 200001 }, () => 0) } }), 8);
  assert.equal(lollyFeatureReader({ toolManifest: { id: 'custom', inputs: [{ id: 'boxes',
    canvas: { groupField: 'group', textDocumentInput: 'textDocument' },
    fields: [{ id: 'kind', options: [{ value: 'group' }] }],
  }] } }), 7);
});
