// SPDX-License-Identifier: MPL-2.0
/**
 * The Node side of a renovation `.lolly` (plan 274, work package 0b).
 *
 * The format has two readers - the web shell's and `packages/node-shell` - and they are
 * separate copies on purpose, because no shell may import another. So the check that
 * matters is not that the two files look alike: it is that bytes the web writer produced
 * open in the terminal reader, with the same integrity gate and the same refusals. The
 * sample project is written here through the web helper and read back through the node
 * one, which is what keeps the copies from drifting apart.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import type { RenovationProjectV1 } from '@lolly-tools/core';
import { readLollyFile, readRenovationLollyFile } from '@lolly-tools/node-shell/lolly-file';
import { buildRenovationLolly, type RenovationPartsV1 } from '../shells/web/src/lib/lolly-renovation.ts';
import { buildLollyFile, LOLLY_PROJECT_TOOL_ID } from '../shells/web/src/lib/lolly-pack.ts';
import type { BeamAssetRecord } from '../shells/web/src/lib/beam-pack.ts';

const SOURCE_REF = 'user/rebrand/source/sha256-deck';
const PHOTO_REF = 'user/rebrand/media/sha256-photo';

const PNG = (tag: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, tag, 0, 0]);
const upload = (id: string, tag: number): BeamAssetRecord => ({
  id, type: 'raster', format: 'png', blob: new Blob([PNG(tag)], { type: 'image/png' }), meta: { name: 'picture.png' },
});

function sampleProject(): RenovationProjectV1 {
  return {
    version: 1,
    id: 'ren-meddpicc',
    name: 'MEDDPICC Question-based Selling',
    source: { kind: 'pptx', hash: 'sha256:aa11', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 24, bytesAssetRef: SOURCE_REF },
    checkpoint: { stage: 'plan', at: '2026-09-23T10:00:00.000Z', planRevision: 2 },
    revision: 7,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    parts: { sourceDeck: 'part-source', plan: 'part-plan' },
    designSessionIds: [],
  };
}

function sampleParts(): RenovationPartsV1 {
  return {
    sourceDeck: {
      version: 1,
      source: { kind: 'pptx', hash: 'sha256:aa11', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 1 },
      slides: [{
        id: 'slide1', index: 0, width: 1280, height: 720, background: {},
        objects: [{ id: 'slide1.1', fingerprint: 'fp1', kind: 'pic', box: { x: 0, y: 0, w: 400, h: 300, rot: 0 }, origin: 'slide', fidelity: { state: 'raster-preserved' }, media: PHOTO_REF }],
        readingOrder: ['slide1.1'], warnings: [], origin: { kind: 'pptx' },
      }],
      fonts: [], warnings: [], reader: { name: 'pptx-read', version: '1.0' },
    },
    plan: {
      version: 1,
      source: { lineageId: 'lin-1', hash: 'sha256:aa11', instanceId: 'inst-1' },
      revision: 2,
      designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
      algorithms: { reader: '1.0', census: '1.0', plan: '1.0' },
      mode: 'renovate',
      slides: [], colors: [], fonts: [],
      logo: { policy: 'brand', variantByBackground: true },
      decisions: [],
    },
  };
}

async function buildSample(): Promise<Uint8Array> {
  const held = new Map([upload(SOURCE_REF, 1), upload(PHOTO_REF, 2)].map(r => [r.id, r]));
  const built = await buildRenovationLolly({
    project: sampleProject(),
    parts: sampleParts(),
    resolveAsset: async (ref) => held.get(ref) ?? null,
  });
  return built.bytes;
}

test('the node reader opens the bytes the web writer produced', async () => {
  const bytes = await buildSample();
  const read = readRenovationLollyFile(bytes);
  assert.equal(read.id, 'ren-meddpicc');
  assert.equal(read.name, 'MEDDPICC Question-based Selling');
  assert.deepEqual(read.project, sampleProject());
  assert.deepEqual(Object.keys(read.parts).sort(), ['plan', 'sourceDeck']);
  assert.deepEqual(read.parts.plan, sampleParts().plan);
  assert.deepEqual(read.parts.sourceDeck, sampleParts().sourceDeck);
  assert.deepEqual(read.assets, [SOURCE_REF, PHOTO_REF]);
  // The carried bytes are reachable through the manifest's own asset rows.
  const entry = (read.manifest as { assets?: Array<{ id: string; path?: string }> }).assets?.find(a => a.id === PHOTO_REF);
  assert.ok(entry?.path);
  assert.deepEqual(read.files.get(entry.path), PNG(2));
});

test('a plan edited after the file was written is refused', async () => {
  const bytes = await buildSample();
  const files = unzipSync(bytes);
  const plan = files['renovation/plan.json']!.slice();
  plan[10] = plan[10]! ^ 0x01;
  files['renovation/plan.json'] = plan;
  assert.throws(() => readRenovationLollyFile(zipSync(files)), /integrity check/);
});

test('the session reader says what a renovation file is instead of asking for an update', async () => {
  const bytes = await buildSample();
  assert.throws(() => readLollyFile(bytes), /renovation project, not a saved session/);
});

test('the session reader still refuses a project file exactly as before', async () => {
  const built = await buildLollyFile({
    kind: 'project', toolId: LOLLY_PROJECT_TOOL_ID, session: null, name: 'gartner-data', userAssets: [],
    project: {
      name: 'gartner-data',
      folders: [{ id: 'root', name: 'gartner-data', parentId: null, items: [{ type: 'session', ref: 'chart-1' }] }],
      sessions: [{ key: 'chart-1', toolId: 'chart', data: { __toolId: 'chart' } }],
    },
  });
  const bytes = new Uint8Array(await built.blob.arrayBuffer());
  assert.throws(() => readLollyFile(bytes), /project folder with 1 saved sessions/);
});

/**
 * Manifest edits both readers have to refuse, with the message each one gives.
 *
 * The two readers are separate copies, so the drift that matters is not in what they
 * accept - fixtures written by the web writer prove that - but in what they turn away.
 * The same table runs against both, and its twin lives in
 * shells/web/src/lib/lolly-renovation.test.ts: keep the two in step, case for case.
 */
const RENOVATION_REFUSALS: Array<[string, (m: Record<string, any>) => void, RegExp]> = [
  ['a downgraded gate', m => { m.minReader = 1; }, /invalid payload/],
  ['a deleted gate', m => { delete m.minReader; }, /invalid payload/],
  ['a deleted part list', m => { delete m.renovation.parts; }, /unreadable part list/],
  ['a part moved elsewhere', m => { m.renovation.parts.plan = 'renovation/project.json'; }, /unexpected path/],
  ['a part this reader does not know', m => { m.renovation.parts.notes = 'renovation/notes.json'; }, /does not know/],
  ['a project record moved elsewhere', m => { m.renovation.project = 'session.json'; }, /unexpected project record/],
  ['a repeated picture', m => { m.renovation.assets.push(m.renovation.assets[0]); }, /missing or repeated picture/],
  ['no id', m => { m.renovation.id = ''; }, /no id/],
  ['no name', m => { m.renovation.name = ''; }, /no name/],
  ['an id past the bound', m => { m.renovation.id = 'x'.repeat(500); }, /no id/],
  ['a name past the bound', m => { m.renovation.name = 'x'.repeat(5000); }, /no name/],
  ['more pictures than a file carries', m => { m.renovation.assets = Array.from({ length: 5001 }, (_, n) => `user/rebrand/media/sha256-${n}`); }, /unreadable media list/],
];

test('the node reader refuses a renovation block that does not hold together', async () => {
  const bytes = await buildSample();
  for (const [label, edit, expected] of RENOVATION_REFUSALS) {
    const files = unzipSync(bytes);
    const manifest = JSON.parse(strFromU8(files['manifest.json']!));
    edit(manifest);
    files['manifest.json'] = strToU8(JSON.stringify(manifest));
    assert.throws(() => readRenovationLollyFile(zipSync(files)), expected, label);
  }
});

test('a picture whose bytes nothing vouched for is refused here too', async () => {
  const bytes = await buildSample();
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json']!));
  const row = manifest.assets.find((a: { id: string }) => a.id === PHOTO_REF);
  files[row.path] = strToU8('not the picture that was packed');
  delete manifest.integrity[row.path];
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  assert.throws(() => readRenovationLollyFile(zipSync(files)), /not covered by the file's integrity map/);
});

test('the renovation reader refuses a file that carries no renovation', async () => {
  const built = await buildLollyFile({ toolId: 'chart', session: { chartType: 'bar' }, userAssets: [] });
  const bytes = new Uint8Array(await built.blob.arrayBuffer());
  assert.throws(() => readRenovationLollyFile(bytes), /carries no renovation project/);
});
