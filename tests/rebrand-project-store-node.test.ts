// SPDX-License-Identifier: MPL-2.0
/**
 * The directory-backed renovation project store (plan 274 section 3.5, work
 * package 0b): packages/node-shell/src/rebrand-project-store.ts.
 *
 * What is pinned here is what the CLI and the TUI rely on and what a second
 * process could otherwise break:
 *
 *   - create writes revision 1 and refuses a second project under one id;
 *   - update, putPart and checkpoint refuse a write whose expected revision is
 *     behind the stored one, and leave the record untouched when they do;
 *   - remove deletes the project directory and drops only the asset refs no other
 *     project in the store claims;
 *   - a failing rename leaves the previous record intact, which is the property
 *     the temp-file-then-rename write exists for;
 *   - an id that would name the byte pool, a temp file or a hidden directory is
 *     refused, so every id the store accepts is one list and remove can see;
 *   - two writes issued together do not both commit, and asset refs written
 *     together are all recorded;
 *   - a directory holding another project's record answers for no one, which is
 *     what a case-insensitive filesystem would otherwise arrange;
 *   - a part becomes current when the project record points at it, so a refused
 *     commit leaves the last committed part and the revision alone.
 *
 * Every test runs against a fresh temp directory, with the clock and (where the
 * failure matters) the filesystem injected, so nothing here reads a real clock or
 * waits on a timer.
 *
 * Run with: node --test "tests/rebrand-project-store-node.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rename, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DeckCensusV1, DesignSystemSnapshotV1, RenovationProjectV1 } from '@lolly-tools/core';
import {
  PROJECT_FILE,
  ProjectStoreError,
  createDirProjectStore,
  nodeRebrandFs,
  type RebrandFsV1,
} from '../packages/node-shell/src/rebrand-project-store.ts';

const HASH_A = `sha256:${'a'.repeat(64)}`;
const HASH_B = `sha256:${'b'.repeat(64)}`;

/** A clock that only moves when a write happens, so timestamps are checkable. */
function fixedClock(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `2026-09-23T10:00:${String(n).padStart(2, '0')}.000Z`;
  };
}

const DESIGN_SYSTEM: DesignSystemSnapshotV1 = {
  id: 'lolly-start',
  masterId: 'content',
  masterVersion: '1',
  tokenHash: `sha256:${'c'.repeat(64)}`,
  fontHashes: {},
  assetHashes: {},
};

function seed(id: string, hash = HASH_A): Omit<RenovationProjectV1, 'version' | 'revision' | 'checkpoint' | 'parts' | 'designSessionIds'> {
  return {
    id,
    name: `Project ${id}`,
    source: { kind: 'pptx', hash, lineageId: `lineage-${id}`, instanceId: `instance-${id}`, pageCount: 12, name: 'deck.pptx' },
    designSystem: DESIGN_SYSTEM,
  };
}

/** The smallest census record that satisfies the contract, for the part tests. */
function censusOf(sourceHash: string): DeckCensusV1 {
  return {
    version: 1,
    sourceHash,
    rules: { name: 'deck-census', version: '1' },
    objects: [],
    groups: [],
    colors: { uses: [], contrastPairs: [] },
    fonts: [],
    layouts: [],
    flattenedSlideIds: [],
    warnings: [],
  };
}

async function freshDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'lolly-rebrand-store-'));
}

test('create writes revision 1, get and list read it back, and a second create is refused', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });

  const created = await store.create(seed('deck one'));
  assert.equal(created.revision, 1);
  assert.equal(created.version, 1);
  assert.equal(created.checkpoint.stage, 'ingest');
  assert.deepEqual(created.parts, {});
  assert.deepEqual(created.designSessionIds, []);
  assert.equal(created.createdAt, '2026-09-23T10:00:01.000Z');

  const read = await store.get('deck one');
  assert.deepEqual(read, created);
  assert.deepEqual((await store.list()).map(p => p.id), ['deck one']);

  // A slash or a space in the id names one directory, not a path.
  const entries = await readdir(dir);
  assert.deepEqual(entries, ['deck%20one']);

  await assert.rejects(() => store.create(seed('deck one')), (err: unknown) => {
    assert.ok(err instanceof ProjectStoreError);
    assert.equal(err.code, 'project-exists');
    return true;
  });
  await rm(dir, { recursive: true, force: true });
});

test('an id that would step outside the store is refused', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await assert.rejects(() => store.create(seed('..')), (err: unknown) => {
    assert.ok(err instanceof ProjectStoreError);
    assert.equal(err.code, 'invalid-id');
    return true;
  });
  await rm(dir, { recursive: true, force: true });
});

test('update bumps the revision, and a stale expected revision is refused without touching the record', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const first = await store.update('p1', 1, { name: 'Renamed', designSessionIds: ['session-1'] });
  assert.deepEqual(first, { ok: true, revision: 2 });

  // The second terminal still holds revision 1.
  const stale = await store.update('p1', 1, { name: 'Written by the other tab' });
  assert.equal(stale.ok, false);
  assert.equal(stale.ok === false ? stale.refusal : '', 'stale-revision');
  assert.equal(stale.ok === false ? stale.currentRevision : 0, 2);

  const after = await store.get('p1');
  assert.equal(after?.name, 'Renamed');
  assert.equal(after?.revision, 2);
  assert.deepEqual(after?.designSessionIds, ['session-1']);

  const missing = await store.update('nobody', 1, { name: 'x' });
  assert.equal(missing.ok === false ? missing.refusal : '', 'missing-project');
  await rm(dir, { recursive: true, force: true });
});

test('putPart stores the record, points the project at it, and round-trips through getPart', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const census = censusOf(HASH_A);
  const wrote = await store.putPart('p1', 1, 'census', census);
  assert.deepEqual(wrote, { ok: true, revision: 2 });

  const project = await store.get('p1');
  // The part file is stamped with the revision that committed it, and the record
  // is what makes it the current one.
  assert.equal(project?.parts.census, 'parts/census.2.json');
  assert.deepEqual(await store.getPart('p1', 'census'), census);
  assert.equal(await store.getPart('p1', 'plan'), null);

  const onDisk = JSON.parse(await readFile(join(dir, 'p1', 'parts', 'census.2.json'), 'utf8'));
  assert.deepEqual(onDisk, census);

  // A second write supersedes the file and the older one goes.
  const again = await store.putPart('p1', 2, 'census', censusOf(HASH_B));
  assert.deepEqual(again, { ok: true, revision: 3 });
  assert.deepEqual(await readdir(join(dir, 'p1', 'parts')), ['census.3.json']);

  const stale = await store.putPart('p1', 1, 'census', census);
  assert.equal(stale.ok === false ? stale.refusal : '', 'stale-revision');
  // The refused write left the committed part alone.
  assert.deepEqual(await store.getPart('p1', 'census'), censusOf(HASH_B));

  const bogus = await store.putPart('p1', 3, 'notes' as 'census', census);
  assert.equal(bogus.ok === false ? bogus.refusal : '', 'invalid-part');
  await rm(dir, { recursive: true, force: true });
});

test('checkpoint records the stage, the time and the plan revision', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const ok = await store.checkpoint('p1', 1, 'review', 4);
  assert.deepEqual(ok, { ok: true, revision: 2 });
  const project = await store.get('p1');
  assert.equal(project?.checkpoint.stage, 'review');
  assert.equal(project?.checkpoint.planRevision, 4);
  assert.equal(typeof project?.checkpoint.at, 'string');

  const bogus = await store.checkpoint('p1', 2, 'polish' as 'review');
  assert.equal(bogus.ok === false ? bogus.refusal : '', 'invalid-part');
  await rm(dir, { recursive: true, force: true });
});

test('remove deletes the project and keeps an asset ref another project claims', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });

  const shared = 'asset:shared-source';
  const mineOnly = 'asset:only-mine';
  await store.create({ ...seed('p1'), source: { ...seed('p1').source, bytesAssetRef: shared } });
  await store.create({ ...seed('p2', HASH_B), source: { ...seed('p2', HASH_B).source, bytesAssetRef: shared } });

  assert.deepEqual(await store.putAsset('p1', shared, new Uint8Array([1, 2, 3])), { ok: true, revision: 1 });
  await store.putAsset('p1', mineOnly, new Uint8Array([9]));
  assert.deepEqual(await store.assetRefs('p1'), [mineOnly, shared].sort());

  const result = await store.remove('p1');
  assert.deepEqual(result.removedAssetRefs, [mineOnly]);
  assert.deepEqual(result.keptAssetRefs, [shared]);

  assert.equal(await store.get('p1'), null);
  assert.deepEqual((await store.list()).map(p => p.id), ['p2']);
  assert.deepEqual([...(await store.getAsset(shared)) ?? []], [1, 2, 3]);
  assert.equal(await store.getAsset(mineOnly), null);

  // Removing the last claimant drops the bytes too.
  const last = await store.remove('p2');
  assert.deepEqual(last.removedAssetRefs, [shared]);
  assert.deepEqual(last.keptAssetRefs, []);
  assert.equal(await store.getAsset(shared), null);
  await rm(dir, { recursive: true, force: true });
});

test('a rename that fails leaves the previous record intact and no half file behind', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  const created = await store.create(seed('p1'));

  const crashing: RebrandFsV1 = {
    ...nodeRebrandFs,
    rename: async () => {
      throw Object.assign(new Error('the machine stopped between the write and the rename'), { code: 'EIO' });
    },
  };
  const crashed = createDirProjectStore(dir, { now: fixedClock(), fs: crashing });
  await assert.rejects(() => crashed.update('p1', 1, { name: 'never written' }));

  const after = await store.get('p1');
  assert.deepEqual(after, created);
  assert.deepEqual(await readdir(join(dir, 'p1')), ['project.json']);
  await rm(dir, { recursive: true, force: true });
});

test('a disk that refuses the bytes is a quota refusal, not a thrown error', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const full: RebrandFsV1 = {
    ...nodeRebrandFs,
    writeFile: async () => {
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    },
  };
  const store2 = createDirProjectStore(dir, { now: fixedClock(), fs: full });
  const refused = await store2.update('p1', 1, { name: 'x' });
  assert.equal(refused.ok, false);
  assert.equal(refused.ok === false ? refused.refusal : '', 'quota');
  assert.equal((await store.get('p1'))?.revision, 1);
  // A disk that stopped mid-write leaves nothing behind for the next one to trip on.
  assert.deepEqual(await readdir(join(dir, 'p1')), ['project.json']);
  await rm(dir, { recursive: true, force: true });
});

test('a corrupt or half-written file is skipped by list rather than taking it down', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('good'));
  await mkdir(join(dir, 'broken'), { recursive: true });
  await writeFile(join(dir, 'broken', 'project.json'), '{ "id": "broken", ');
  await writeFile(join(dir, '.tmp-leftover'), 'half a record');

  assert.deepEqual((await store.list()).map(p => p.id), ['good']);
  await rm(dir, { recursive: true, force: true });
});

test('an id that would name the byte pool, a temp file or a hidden directory is refused', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('normal'));
  await store.putAsset('normal', 'asset:one', new Uint8Array([1, 2, 3]));

  for (const id of ['assets', '.hidden', '.tmp-run']) {
    await assert.rejects(() => store.create(seed(id)), (err: unknown) => {
      assert.ok(err instanceof ProjectStoreError);
      assert.equal(err.code, 'invalid-id');
      return true;
    });
    await assert.rejects(() => store.remove(id));
  }

  // A read answers null for an id the store will not accept, as the contract types it.
  assert.equal(await store.get('assets'), null);
  assert.equal(await store.getPart('.hidden', 'census'), null);
  assert.deepEqual(await store.assetRefs('assets'), []);

  // The pool and the project that claims it are untouched.
  assert.deepEqual([...(await store.getAsset('asset:one')) ?? []], [1, 2, 3]);
  assert.deepEqual((await store.list()).map(p => p.id), ['normal']);
  await rm(dir, { recursive: true, force: true });
});

test('asset refs written together are all recorded, and a ref that is not a name is refused', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const refs = Array.from({ length: 12 }, (_, i) => `asset:media-${i}`);
  const results = await Promise.all(refs.map(ref => store.putAsset('p1', ref, new Uint8Array([i8(ref)]))));
  assert.equal(results.every(r => r.ok), true);
  assert.deepEqual(await store.assetRefs('p1'), [...refs].sort());

  const bad = await store.putAsset('p1', '..', new Uint8Array([1]));
  assert.equal(bad.ok === false ? bad.refusal : '', 'invalid-part');
  assert.equal(await store.getAsset('..'), null);

  // Removing the only claimant drops every pooled file it held.
  const removed = await store.remove('p1');
  assert.deepEqual(removed.removedAssetRefs, [...refs].sort());
  await rm(dir, { recursive: true, force: true });
});

function i8(s: string): number {
  return s.length % 256;
}

test('two writes at the same revision do not both land: one commits, the other is refused', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const [a, b] = await Promise.all([
    store.update('p1', 1, { name: 'A' }),
    store.update('p1', 1, { name: 'B' }),
  ]);
  const outcomes = [a, b].map(r => (r.ok ? 'ok' : r.refusal)).sort();
  assert.deepEqual(outcomes, ['ok', 'stale-revision']);

  const after = await store.get('p1');
  assert.equal(after?.revision, 2);
  assert.equal(after?.name, a.ok ? 'A' : 'B');
  await rm(dir, { recursive: true, force: true });
});

test('a create that could not write its record leaves the id free for the next attempt', async () => {
  const dir = await freshDir();
  const crashing: RebrandFsV1 = {
    ...nodeRebrandFs,
    rename: async () => {
      throw Object.assign(new Error('the machine stopped between the write and the rename'), { code: 'EIO' });
    },
  };
  const crashed = createDirProjectStore(dir, { now: fixedClock(), fs: crashing });
  await assert.rejects(() => crashed.create(seed('p1')));

  // The name a create claims is taken before the record is written, so a failure
  // has to hand it back rather than hold the id against a retry.
  const store = createDirProjectStore(dir, { now: fixedClock() });
  const created = await store.create(seed('p1'));
  assert.equal(created.revision, 1);
  assert.equal((await store.get('p1'))?.name, 'Project p1');
  await rm(dir, { recursive: true, force: true });
});

test('a directory holding another project answers for no one: the id on the record is checked', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  const deck = await store.create(seed('deck'));

  // What a case-insensitive filesystem arranges on its own, written out.
  await mkdir(join(dir, 'other'), { recursive: true });
  await writeFile(join(dir, 'other', PROJECT_FILE), JSON.stringify(deck));

  assert.equal(await store.get('other'), null);
  assert.equal(await store.getPart('other', 'census'), null);
  const write = await store.update('other', 1, { name: 'written onto the neighbour' });
  assert.equal(write.ok === false ? write.refusal : '', 'missing-project');

  const removed = await store.remove('other');
  assert.deepEqual(removed, { removedAssetRefs: [], keptAssetRefs: [] });
  assert.equal(JSON.parse(await readFile(join(dir, 'other', PROJECT_FILE), 'utf8')).id, 'deck');
  assert.equal((await store.get('deck'))?.name, deck.name);
  await rm(dir, { recursive: true, force: true });
});

test('a project directory the person renamed keeps its claims, so remove leaves the shared bytes', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  const shared = 'asset:shared-source';
  await store.create(seed('p1'));
  await store.create(seed('p2', HASH_B));
  await store.putAsset('p1', shared, new Uint8Array([7]));
  await store.putAsset('p2', shared, new Uint8Array([7]));

  await rename(join(dir, 'p2'), join(dir, 'p2-backup'));

  const result = await store.remove('p1');
  assert.deepEqual(result.removedAssetRefs, []);
  assert.deepEqual(result.keptAssetRefs, [shared]);
  assert.deepEqual([...(await store.getAsset(shared)) ?? []], [7]);
  await rm(dir, { recursive: true, force: true });
});

test('a refused commit leaves the committed part and the revision where they were', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));
  await store.putPart('p1', 1, 'census', censusOf(HASH_A));

  // The stage record is written; the record that would point at it is refused.
  const fullForRecords: RebrandFsV1 = {
    ...nodeRebrandFs,
    writeFile: async (path, data) => {
      if (path.startsWith(join(dir, 'p1', 'parts'))) return nodeRebrandFs.writeFile(path, data);
      throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    },
  };
  const store2 = createDirProjectStore(dir, { now: fixedClock(), fs: fullForRecords });
  const refused = await store2.putPart('p1', 2, 'census', censusOf(HASH_B));
  assert.equal(refused.ok === false ? refused.refusal : '', 'quota');

  assert.equal((await store.get('p1'))?.revision, 2);
  assert.deepEqual(await store.getPart('p1', 'census'), censusOf(HASH_A));
  // The staged file went with the refusal.
  assert.deepEqual(await readdir(join(dir, 'p1', 'parts')), ['census.2.json']);
  await rm(dir, { recursive: true, force: true });
});

test('update refuses a checkpoint or a part path the store could not read back', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));

  const stage = await store.update('p1', 1, { checkpoint: { stage: 'bogus' as 'review' } });
  assert.equal(stage.ok === false ? stage.refusal : '', 'invalid-part');
  const part = await store.update('p1', 1, { parts: { census: '../../elsewhere.json' } });
  assert.equal(part.ok === false ? part.refusal : '', 'invalid-part');
  const design = await store.update('p1', 1, { designSystem: { ...DESIGN_SYSTEM, id: '' } });
  assert.equal(design.ok === false ? design.refusal : '', 'invalid-part');

  const after = await store.get('p1');
  assert.equal(after?.revision, 1);
  assert.equal(after?.checkpoint.stage, 'ingest');
  await rm(dir, { recursive: true, force: true });
});

test('a record from a later contract version is not read, and getPart follows the record', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  const created = await store.create(seed('p1'));

  // A part file nothing points at is not a part.
  await mkdir(join(dir, 'p1', 'parts'), { recursive: true });
  await writeFile(join(dir, 'p1', 'parts', 'census.9.json'), JSON.stringify({ v: 'never committed' }));
  assert.equal(await store.getPart('p1', 'census'), null);

  // A field this version does not know is carried through a write rather than dropped.
  await writeFile(join(dir, 'p1', PROJECT_FILE), JSON.stringify({ ...created, futureField: 'kept' }));
  assert.deepEqual(await store.update('p1', 1, { name: 'renamed' }), { ok: true, revision: 2 });
  const raw = JSON.parse(await readFile(join(dir, 'p1', PROJECT_FILE), 'utf8'));
  assert.equal(raw.futureField, 'kept');
  assert.equal(raw.name, 'renamed');

  await writeFile(join(dir, 'p1', PROJECT_FILE), JSON.stringify({ ...created, version: 2, later: 'field' }));
  assert.equal(await store.get('p1'), null);
  assert.deepEqual(await store.list(), []);
  await rm(dir, { recursive: true, force: true });
});

test('a pool file that could not be deleted is reported as kept, not as removed', async () => {
  const dir = await freshDir();
  const store = createDirProjectStore(dir, { now: fixedClock() });
  await store.create(seed('p1'));
  await store.putAsset('p1', 'asset:one', new Uint8Array([1]));

  const stubborn: RebrandFsV1 = {
    ...nodeRebrandFs,
    rm: async (path, rmOpts) => {
      if (path.startsWith(join(dir, 'assets'))) throw Object.assign(new Error('the file is busy'), { code: 'EBUSY' });
      return nodeRebrandFs.rm(path, rmOpts);
    },
  };
  const store2 = createDirProjectStore(dir, { now: fixedClock(), fs: stubborn });
  const result = await store2.remove('p1');
  assert.deepEqual(result.removedAssetRefs, []);
  assert.deepEqual(result.keptAssetRefs, ['asset:one']);
  assert.deepEqual([...(await store.getAsset('asset:one')) ?? []], [1]);
  await rm(dir, { recursive: true, force: true });
});
