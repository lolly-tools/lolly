// SPDX-License-Identifier: MPL-2.0
/**
 * A renovation project inside a `.lolly` (plan 274, work package 0b).
 *
 * Builds a project whose parts point at three pictures, two of which the store still
 * holds, then reads it back and checks that the record, the parts and the media list
 * come back as they went in. The tamper case is the point of the integrity map: a plan
 * edited after the file was written is refused, not handed on with a warning.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import type { CompiledDeckV1, DeckCensusV1, RenovationPlanV1, RenovationProjectV1, SourceDeckV1 } from '@lolly-tools/core';
import type { BeamAssetRecord } from './beam-pack.ts';
import { buildLollyFile, readLollyFile, ingestLollyFile, LOLLY_PROJECT_TOOL_ID, LOLLY_RENOVATION_MIN_READER, LOLLY_RENOVATION_TOOL_ID } from './lolly-pack.ts';
import type { BeamPackHost, BeamSessionRow } from './beam-pack.ts';
import { buildRenovationLolly, readRenovationLolly, renovationAssetRefs, type RenovationPartsV1 } from './lolly-renovation.ts';

const SOURCE_REF = 'user/rebrand/source/sha256-deck';
const PHOTO_REF = 'user/rebrand/media/sha256-photo';
const LOST_REF = 'user/rebrand/media/sha256-lost';

const PNG = (tag: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, tag, 0, 0]);
const upload = (id: string, tag: number): BeamAssetRecord => ({
  id, type: 'raster', format: 'png', blob: new Blob([PNG(tag)], { type: 'image/png' }), meta: { name: `${id.split('/').pop()}.png` },
});

function sampleProject(): RenovationProjectV1 {
  return {
    version: 1,
    id: 'ren-meddpicc',
    name: 'MEDDPICC Question-based Selling',
    source: {
      kind: 'pptx',
      hash: 'sha256:aa11',
      lineageId: 'lin-1',
      instanceId: 'inst-1',
      name: 'MEDDPICC Question-based Selling - SAP.pptx',
      bytes: 2_100_000,
      pageCount: 24,
      bytesAssetRef: SOURCE_REF,
    },
    checkpoint: { stage: 'plan', at: '2026-09-23T10:00:00.000Z', planRevision: 2 },
    revision: 7,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    parts: { sourceDeck: 'part-source', census: 'part-census', plan: 'part-plan' },
    designSessionIds: [],
    createdAt: '2026-09-23T09:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
  };
}

function sampleParts(): RenovationPartsV1 {
  const sourceDeck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: 'sha256:aa11', lineageId: 'lin-1', instanceId: 'inst-1', pageCount: 2 },
    slides: [
      {
        id: 'slide1', index: 0, width: 1280, height: 720,
        background: {},
        objects: [
          { id: 'slide1.1', fingerprint: 'fp1', kind: 'pic', box: { x: 0, y: 0, w: 400, h: 300, rot: 0 }, origin: 'slide', fidelity: { state: 'raster-preserved' }, media: PHOTO_REF },
          { id: 'slide1.2', fingerprint: 'fp2', kind: 'chart', box: { x: 0, y: 320, w: 400, h: 300, rot: 0 }, origin: 'slide', fidelity: { state: 'raster-preserved', reason: 'native-chart-no-fallback', fallbackAssetRef: LOST_REF, fallbackSource: 'embedded' } },
        ],
        readingOrder: ['slide1.1', 'slide1.2'],
        warnings: [],
        origin: { kind: 'pptx', layout: 'Title and Content' },
      },
    ],
    fonts: [{ family: 'Arial', provenance: 'literal', runs: 12 }],
    warnings: [],
    reader: { name: 'pptx-read', version: '1.0' },
  };
  const census: DeckCensusV1 = {
    version: 1, sourceHash: 'sha256:aa11', rules: { name: 'deck-census', version: '1.0' },
    objects: [], groups: [], colors: { uses: [], contrastPairs: [] }, fonts: [], layouts: [],
    flattenedSlideIds: [], warnings: [],
  };
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'lin-1', hash: 'sha256:aa11', instanceId: 'inst-1' },
    revision: 2,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    algorithms: { reader: '1.0', census: '1.0', plan: '1.0' },
    mode: 'renovate',
    slides: [], colors: [], fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };
  return { sourceDeck, census, plan };
}

function store(): BeamAssetRecord[] {
  return [upload(SOURCE_REF, 1), upload(PHOTO_REF, 2), upload('user/uploads/unrelated', 3)];
}

async function buildSample() {
  const held = new Map(store().map(r => [r.id, r]));
  return buildRenovationLolly({
    project: sampleProject(),
    parts: sampleParts(),
    resolveAsset: async (ref) => held.get(ref) ?? null,
  });
}

test('the media list is every ref the project and its parts point at, once each, in order', () => {
  const refs = renovationAssetRefs(sampleProject(), sampleParts());
  assert.deepEqual(refs, [SOURCE_REF, PHOTO_REF, LOST_REF]);
});

test('a renovation file carries the project, each written part, and the media in use', async () => {
  const built = await buildSample();
  assert.equal(built.filename, 'MEDDPICC-Question-based-Selling.lolly');
  assert.deepEqual(built.assets, [SOURCE_REF, PHOTO_REF, LOST_REF]);

  const parts = unzipSync(built.bytes);
  const manifest = JSON.parse(strFromU8(parts['manifest.json']!));
  assert.equal(manifest.minReader, LOLLY_RENOVATION_MIN_READER);
  assert.equal(manifest.tool.id, LOLLY_RENOVATION_TOOL_ID);
  assert.equal(manifest.renovation.id, 'ren-meddpicc');
  assert.equal(manifest.renovation.project, 'renovation/project.json');
  assert.deepEqual(manifest.renovation.parts, {
    sourceDeck: 'renovation/sourceDeck.json',
    census: 'renovation/census.json',
    plan: 'renovation/plan.json',
  });
  assert.ok(!('session.json' in parts), 'a renovation on its own carries no saved session');
  assert.ok(!('renovation/compiled.json' in parts), 'a stage that has not run writes no part');
  for (const path of ['renovation/project.json', 'renovation/sourceDeck.json', 'renovation/census.json', 'renovation/plan.json']) {
    assert.ok(parts[path], `${path} is in the file`);
    assert.ok(manifest.integrity?.[path], `${path} is integrity-covered`);
  }
  // The two the store still holds travel as bytes; the third is recorded as a reference.
  const carried = manifest.assets.filter((a: { kind: string }) => a.kind === 'asset').map((a: { id: string }) => a.id);
  assert.deepEqual(carried.sort(), [PHOTO_REF, SOURCE_REF].sort());
  assert.deepEqual(manifest.assets.filter((a: { kind: string }) => a.kind === 'asset-ref').map((a: { id: string }) => a.id), [LOST_REF]);
});

test('reading a renovation file back gives the same project, parts and media', async () => {
  const built = await buildSample();
  const read = await readRenovationLolly(built.bytes);
  assert.equal(read.id, 'ren-meddpicc');
  assert.equal(read.name, 'MEDDPICC Question-based Selling');
  assert.deepEqual(read.project, sampleProject());
  assert.deepEqual(read.parts, sampleParts());
  assert.deepEqual(read.assets.map(a => a.ref), [SOURCE_REF, PHOTO_REF, LOST_REF]);
  assert.deepEqual(read.assets[0]!.bytes, PNG(1));
  assert.deepEqual(read.assets[1]!.bytes, PNG(2));
  assert.equal(read.assets[1]!.mime, 'image/png');
  assert.equal(read.assets[2]!.bytes, undefined, 'a picture the store lost is named, not invented');
});

test('a renovation with nothing but the project record is a valid file', async () => {
  const project = sampleProject();
  delete project.source.bytesAssetRef;
  const built = await buildRenovationLolly({ project });
  assert.deepEqual(built.assets, []);
  const read = await readRenovationLolly(built.bytes);
  assert.deepEqual(read.parts, {});
  assert.deepEqual(read.assets, []);
  assert.deepEqual(read.project, project);

  const envelope = await readLollyFile(built.bytes);
  assert.equal(envelope.session, null);
  assert.equal(envelope.renovation?.id, 'ren-meddpicc');
});

/** A receiving device: saved-session slots and a user asset store, both in memory. */
function stubHost(): { host: BeamPackHost; slots: Map<string, { data: unknown; thumb?: string | null }>; userStore: Map<string, BeamAssetRecord> } {
  const slots = new Map<string, { data: unknown; thumb?: string | null }>();
  const userStore = new Map<string, BeamAssetRecord>();
  const host: BeamPackHost = {
    state: {
      list: async (): Promise<BeamSessionRow[]> => [...slots.keys()].map(slot => ({ slot })),
      load: async (slot: string) => slots.get(slot)?.data ?? null,
      save: async (slot: string, data: unknown, thumb?: string | null) => { slots.set(slot, { data, thumb }); },
      delete: async (slot: string) => { slots.delete(slot); },
    },
    assets: {
      _exportUserAssets: async () => [...userStore.values()],
      _uploadUserAsset: async (rec: BeamAssetRecord) => { userStore.set(rec.id, rec); },
      _getUserRecord: async (id: string) => userStore.get(id) ?? null,
      _deleteUserAsset: async (id: string) => { userStore.delete(id); },
    },
  };
  return { host, slots, userStore };
}

test('opening a renovation file lands its media and mints no blank saved session', async () => {
  const built = await buildSample();
  const { host, slots, userStore } = stubHost();
  const res = await ingestLollyFile(built.bytes, host);
  assert.equal(res.imported, 2);
  assert.equal(res.slot, '');
  assert.equal(slots.size, 0);
  // The media arrive under freshly minted local ids, so the project's refs name nothing
  // here until they are rebased. The map that makes that possible comes back with them.
  assert.ok(res.renovation, 'the result carries the renovation it just landed');
  assert.equal(res.renovation.contents.id, 'ren-meddpicc');
  for (const ref of [SOURCE_REF, PHOTO_REF]) {
    const landed = res.renovation.rekey.get(ref);
    assert.ok(landed && userStore.has(landed), `${ref} maps to an id this device holds`);
  }
  assert.equal(res.renovation.rekey.get(LOST_REF), undefined, 'a picture the sender had lost maps to nothing');
});

test('a renovation travelling beside a document comes back from the import too', async () => {
  const built = await buildLollyFile({
    toolId: 'chart', session: { __toolId: 'chart', title: 'Q3' }, name: 'both', userAssets: store(),
    renovation: { id: 'r1', name: 'R One', project: { id: 'r1', name: 'R One', source: { bytesAssetRef: SOURCE_REF } }, assets: [SOURCE_REF] },
  });
  const { host, slots } = stubHost();
  const res = await ingestLollyFile(new Uint8Array(await built.blob.arrayBuffer()), host);
  assert.equal(slots.size, 1, 'the document still lands as a saved session');
  assert.ok(res.slot, 'and it reports the slot it landed in');
  assert.equal(res.renovation?.contents.id, 'r1', 'the renovation is handed back rather than dropped');
  assert.ok(res.renovation?.rekey.get(SOURCE_REF), 'with the map its refs need');
});

/** Rewrite one part's bytes, keeping every other part and the manifest as written. */
function withPart(bytes: Uint8Array, path: string, edit: (raw: Uint8Array) => Uint8Array): Uint8Array {
  const files = unzipSync(bytes);
  files[path] = new Uint8Array(edit(files[path]!));
  return zipSync(files);
}

/** Rewrite the manifest, keeping every part's bytes. */
function withManifest(bytes: Uint8Array, edit: (m: Record<string, any>) => void): Uint8Array {
  const files = unzipSync(bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json']!));
  edit(manifest);
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  return zipSync(files);
}

test('a plan edited after the file was written is refused, not repaired', async () => {
  const built = await buildSample();
  const tampered = withPart(built.bytes, 'renovation/plan.json', (raw) => {
    const copy = raw.slice();
    copy[10] = copy[10]! ^ 0x01;
    return copy;
  });
  await assert.rejects(readRenovationLolly(tampered), /integrity check/);
});

/**
 * Manifest edits both readers have to refuse, with the message each one gives.
 *
 * The two readers are separate copies, so the drift that matters is not in what they
 * accept - a fixture written here and read there proves that - but in what they turn
 * away. The same table runs against both, and its twin lives in
 * tests/lolly-renovation-node.test.ts: keep the two in step, case for case.
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

test('the reader refuses a renovation block that does not hold together', async () => {
  const built = await buildSample();
  for (const [label, edit, expected] of RENOVATION_REFUSALS) {
    await assert.rejects(readRenovationLolly(withManifest(built.bytes, edit)), expected, label);
  }
});

test('the builder refuses a project record it could not read back', async () => {
  const project = { ...sampleProject(), id: '' } as RenovationProjectV1;
  await assert.rejects(buildRenovationLolly({ project }), /no id/);
});

/** A compiled deck as `deck-compile.ts` and `slide-master.ts` write one: a picture layer
 *  naming its bytes in the `design:boxes` field `image`, and a master logo doing the same
 *  with a ref that exists in no other part. */
function sampleCompiled(logoRef: string): CompiledDeckV1 {
  return {
    version: 1, sourceHash: 'sha256:aa11', planRevision: 2,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    frames: [{
      id: 'f1', index: 0, width: 1280, height: 720,
      layers: [
        { id: 'l1', kind: 'image', x: 0, y: 0, w: 400, h: 300, image: PHOTO_REF, fit: 'fill', order: 1, name: 'slide1.1' },
        { id: 'l2', kind: 'image', x: 900, y: 40, w: 200, h: 60, image: logoRef, fit: 'contain', order: 2, name: 'logo', master: 'm1', furniture: 'logo' },
      ],
    }],
    lineage: { forward: [], back: [] },
  } as unknown as CompiledDeckV1;
}

test('a compiled part travels when the compile has run', async () => {
  const compiled = {
    version: 1, sourceHash: 'sha256:aa11', planRevision: 2,
    designSystem: { id: 'suse', tokenHash: 'sha256:bb22', fontHashes: {}, assetHashes: {} },
    frames: [], lineage: { forward: [], back: [] },
  } as unknown as CompiledDeckV1;
  const built = await buildRenovationLolly({ project: sampleProject(), parts: { ...sampleParts(), compiled } });
  const read = await readRenovationLolly(built.bytes);
  assert.deepEqual(read.parts.compiled, compiled);
});

test('a compiled frame names its pictures in `image`, and those travel too', async () => {
  const logoRef = 'user/rebrand/media/sha256-logo';
  const refs = renovationAssetRefs(sampleProject(), { compiled: sampleCompiled(logoRef) });
  assert.deepEqual(refs, [SOURCE_REF, PHOTO_REF, logoRef]);

  const held = new Map([...store(), upload(logoRef, 4)].map(r => [r.id, r]));
  const built = await buildRenovationLolly({
    project: sampleProject(), parts: { compiled: sampleCompiled(logoRef) },
    resolveAsset: async (ref) => held.get(ref) ?? null,
  });
  const read = await readRenovationLolly(built.bytes);
  // The master's logo lives only in the compiled part, so nothing else would carry it.
  assert.deepEqual(read.assets.find(a => a.ref === logoRef)?.bytes, PNG(4));
  assert.deepEqual(read.assets.find(a => a.ref === PHOTO_REF)?.bytes, PNG(2));
});

test('a part the reader would refuse is refused at write time instead', async () => {
  await assert.rejects(
    buildRenovationLolly({ project: sampleProject(), parts: { census: null } as unknown as RenovationPartsV1 }),
    /"census" part of this renovation is unreadable/,
  );
  await assert.rejects(
    buildLollyFile({ toolId: LOLLY_RENOVATION_TOOL_ID, session: null, userAssets: [], renovation: { id: 'r1', name: 'R One', project: 'hello' } }),
    /project record in this renovation is unreadable/,
  );
});

test('more pictures than one file carries is said, not silently dropped', async () => {
  const project = sampleProject();
  const objects = Array.from({ length: 5002 }, (_, n) => ({
    id: `o${n}`, fingerprint: `fp${n}`, kind: 'pic', box: { x: 0, y: 0, w: 1, h: 1, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: `user/rebrand/media/sha256-${n}`,
  }));
  const parts = { census: { version: 1, objects } } as unknown as RenovationPartsV1;
  assert.equal(renovationAssetRefs(project, parts).length, 5000, 'a read stays bounded');
  await assert.rejects(buildRenovationLolly({ project, parts }), /more than 5000 pictures/);
});

test('a picture whose bytes nothing vouched for is refused', async () => {
  const built = await buildSample();
  const files = unzipSync(built.bytes);
  const manifest = JSON.parse(strFromU8(files['manifest.json']!));
  const row = manifest.assets.find((a: { id: string }) => a.id === PHOTO_REF);
  files[row.path] = strToU8('not the picture that was packed');
  delete manifest.integrity[row.path];
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  await assert.rejects(readRenovationLolly(zipSync(files)), /not covered by the file's integrity map/);
});

test('a ref that carries a modifier still finds the bytes that travelled with it', async () => {
  const dressed = `${PHOTO_REF}?treatment=warm`;
  const project = sampleProject();
  delete project.source.bytesAssetRef;
  const parts = { census: { version: 1, objects: [{ media: dressed }] } } as unknown as RenovationPartsV1;
  const held = new Map(store().map(r => [r.id, r]));
  const built = await buildRenovationLolly({
    project, parts,
    // The closure files the row under the stripped id, so that is the ref it asks for.
    resolveAsset: async (ref) => held.get(ref) ?? null,
  });
  const read = await readRenovationLolly(built.bytes);
  assert.deepEqual(read.assets.map(a => a.ref), [dressed]);
  assert.deepEqual(read.assets[0]!.bytes, PNG(2), 'the bytes are found under the ref the manifest filed them as');
});

test('a project file carrying a renovation keeps both sets of pictures', async () => {
  const built = await buildLollyFile({
    kind: 'project', toolId: LOLLY_PROJECT_TOOL_ID, session: null, name: 'both', userAssets: store(),
    project: {
      name: 'both',
      folders: [{ id: 'root', name: 'both', parentId: null, items: [{ type: 'session', ref: 'chart-1' }] }],
      sessions: [{ key: 'chart-1', toolId: 'chart', data: { __toolId: 'chart' } }],
    },
    renovation: { id: 'r1', name: 'R One', project: { id: 'r1', name: 'R One', source: { bytesAssetRef: SOURCE_REF } }, assets: [SOURCE_REF] },
  });
  const bytes = new Uint8Array(await built.blob.arrayBuffer());
  const read = await readLollyFile(bytes);
  const row = read.manifest.assets.find(a => a.id === SOURCE_REF);
  assert.equal(row?.kind, 'asset', 'the renovation media travel beside the project sessions');
  assert.deepEqual(read.renovation?.assets, [SOURCE_REF]);
});

test('the id is trimmed once, at write time, so every reader files it the same way', async () => {
  const built = await buildLollyFile({
    toolId: LOLLY_RENOVATION_TOOL_ID, session: null, userAssets: [],
    renovation: { id: '  p1  ', name: '  P One  ', project: { id: 'p1' } },
  });
  const read = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  assert.equal(read.manifest.renovation?.id, 'p1');
  assert.equal(read.renovation?.id, 'p1');
  assert.equal(read.renovation?.name, 'P One');
});
