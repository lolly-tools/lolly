// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation project store (plan 274 section 3.5).
 *
 * What is pinned here is the part a person feels: work that survives a reload,
 * two tabs that cannot overwrite each other, a storage refusal that is reported
 * as a refusal, and a delete that only drops bytes nothing else points at.
 *
 * The host is the tool-author SDK's in-memory mock, so no browser and no
 * IndexedDB are involved; the asset functions and the clock arrive through
 * `deps`.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/project-store.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMockHost } from '../../../../../packages/core/src/mock-host.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type {
  DesignSystemSnapshotV1,
  SourceDeckV1,
} from '../../../../../packages/core/src/rebrand-v1.ts';
import {
  createWebProjectStore,
  isRebrandSlot,
  partSlot,
  projectSlot,
  ProjectExistsError,
  ProjectQuotaError,
  REBRAND_SLOT_PREFIX,
  thumbSvgOf,
  type CreateProjectInputV1,
  type ProjectStoreDeps,
} from './project-store.ts';

const DESIGN_SYSTEM: DesignSystemSnapshotV1 = {
  id: 'suse',
  tokenHash: 'sha256:aaa',
  fontHashes: {},
  assetHashes: {},
};

function sourceFacts(overrides: Partial<CreateProjectInputV1['source']> = {}): CreateProjectInputV1['source'] {
  return {
    kind: 'pptx',
    hash: 'sha256:deck',
    lineageId: 'lin-1',
    instanceId: 'inst-1',
    name: 'Why SUSE Summary.pptx',
    pageCount: 12,
    ...overrides,
  };
}

function input(id: string, overrides: Partial<CreateProjectInputV1> = {}): CreateProjectInputV1 {
  return { id, name: 'Why SUSE Summary', source: sourceFacts(), designSystem: DESIGN_SYSTEM, ...overrides };
}

/** A clock the test steps by hand, so every stamp in a run is a chosen one. */
function clock(start = 1_000) {
  let t = start;
  return {
    tick: (by = 1) => { t += by; },
    now: () => new Date(t * 1000).toISOString(),
  };
}

function harness(o: { deps?: Partial<ProjectStoreDeps> } = {}) {
  const host = createMockHost();
  const uploads: { name: string; batch: boolean }[] = [];
  const deleted: string[] = [];
  const time = clock();
  const deps: ProjectStoreDeps = {
    now: time.now,
    async storeUpload(file, opts) {
      uploads.push({ name: file.name, batch: opts.batch });
      return { id: `user/upload/${file.name}`, type: 'image', url: '' } as unknown as AssetRef;
    },
    async referencedElsewhere() { return false; },
    async deleteAsset(ref) { deleted.push(ref); },
    ...o.deps,
  };
  return { host, deps, uploads, deleted, time, store: createWebProjectStore(host, deps) };
}

const deckWithMedia = (media: string[]): SourceDeckV1 => ({
  version: 1,
  source: sourceFacts(),
  slides: [{
    id: 's1',
    index: 0,
    width: 1280,
    height: 720,
    background: {},
    objects: media.map((ref, i) => ({
      id: `s1.${i}`,
      fingerprint: `fp-${i}`,
      kind: 'pic' as const,
      box: { x: 0, y: 0, w: 10, h: 10, rot: 0 },
      origin: 'slide' as const,
      fidelity: { state: 'raster-preserved' as const },
      media: ref,
    })),
    readingOrder: [],
    warnings: [],
    origin: { kind: 'pptx' as const },
  }],
  fonts: [],
  warnings: [],
  reader: { name: 'test', version: '1' },
});

// ── create ───────────────────────────────────────────────────────────────────

test('create returns revision 1 under one namespaced key, stamped from the injected clock', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));

  assert.equal(project.revision, 1);
  assert.equal(project.version, 1);
  assert.deepEqual(project.parts, {});
  assert.deepEqual(project.designSessionIds, []);
  assert.deepEqual(project.checkpoint, { stage: 'ingest' });
  assert.equal(project.createdAt, h.time.now());
  assert.equal(project.updatedAt, h.time.now());

  const slots = [...h.host.inspect.state.keys()];
  assert.deepEqual(slots, [projectSlot('p1')]);
  assert.ok(slots[0]?.startsWith(REBRAND_SLOT_PREFIX));
  assert.ok(isRebrandSlot(slots[0]));

  assert.deepEqual(await h.store.get('p1'), project);
});

test('a project reads back after the view is gone, which is why the store exists', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  // A second store over the same host is a reload: nothing was held in memory.
  const reopened = createWebProjectStore(h.host, h.deps);
  assert.equal((await reopened.get('p1'))?.name, 'Why SUSE Summary');
});

test('source bytes go through the upload path with batch set, and the ref is set on the source', async () => {
  const h = harness();
  const file = new File([new Uint8Array([1, 2, 3])], 'deck.pptx');
  const project = await h.store.create(input('p1'), { bytes: file });

  assert.deepEqual(h.uploads, [{ name: 'deck.pptx', batch: true }]);
  assert.equal(project.source.bytesAssetRef, 'user/upload/deck.pptx');
});

test('retainBytes false keeps the facts and no ref, and stores no bytes', async () => {
  const h = harness();
  const file = new File([new Uint8Array([1, 2, 3])], 'deck.pptx');
  const project = await h.store.create(
    input('p1', { source: sourceFacts({ bytesAssetRef: 'user/upload/old' }) }),
    { bytes: file, retainBytes: false },
  );

  assert.deepEqual(h.uploads, []);
  assert.equal(project.source.bytesAssetRef, undefined);
  assert.equal(project.source.hash, 'sha256:deck');
  assert.equal(project.source.name, 'Why SUSE Summary.pptx');
  assert.equal(project.source.pageCount, 12);
});

// ── the revision rule ────────────────────────────────────────────────────────

test('update bumps the revision and moves updatedAt on', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));
  h.time.tick(60);

  const result = await h.store.update('p1', project.revision, { name: 'Renamed' });
  assert.deepEqual(result, { ok: true, revision: 2 });

  const stored = await h.store.get('p1');
  assert.equal(stored?.name, 'Renamed');
  assert.equal(stored?.revision, 2);
  assert.equal(stored?.updatedAt, h.time.now());
  assert.notEqual(stored?.updatedAt, project.updatedAt);
  assert.equal(stored?.createdAt, project.createdAt);
});

test('the second tab is refused with the revision it is behind', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));
  const tabOne = project.revision;
  const tabTwo = project.revision;

  assert.deepEqual(await h.store.update('p1', tabOne, { name: 'First' }), { ok: true, revision: 2 });

  const late = await h.store.update('p1', tabTwo, { name: 'Second' });
  assert.equal(late.ok, false);
  assert.equal(late.ok === false && late.refusal, 'stale-revision');
  assert.equal(late.ok === false && late.currentRevision, 2);
  assert.equal((await h.store.get('p1'))?.name, 'First', 'a stale write must not reach a human decision');
});

test('putPart and checkpoint refuse a stale revision the same way', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  await h.store.update('p1', 1, { name: 'Moved on' });

  const part = await h.store.putPart('p1', 1, 'census', { version: 1 } as never);
  assert.equal(part.ok === false && part.refusal, 'stale-revision');
  assert.equal(part.ok === false && part.currentRevision, 2);
  assert.equal(await h.store.getPart('p1', 'census'), null, 'a refused part must not be readable');

  const mark = await h.store.checkpoint('p1', 1, 'census');
  assert.equal(mark.ok === false && mark.refusal, 'stale-revision');
  assert.equal(mark.ok === false && mark.currentRevision, 2);
});

test('a write against a project that is not on this device says so', async () => {
  const h = harness();
  const result = await h.store.update('gone', 1, { name: 'x' });
  assert.equal(result.ok === false && result.refusal, 'missing-project');
});

test('checkpoint records the stage, the time and the plan revision', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  h.time.tick(5);

  const result = await h.store.checkpoint('p1', 1, 'plan', 3);
  assert.deepEqual(result, { ok: true, revision: 2 });
  assert.deepEqual((await h.store.get('p1'))?.checkpoint, { stage: 'plan', at: h.time.now(), planRevision: 3 });
});

// ── parts ────────────────────────────────────────────────────────────────────

test('a part is its own record, and the project keeps only the pointer', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  const deck = deckWithMedia(['sha256:pic-a']);

  const result = await h.store.putPart('p1', 1, 'sourceDeck', deck);
  assert.deepEqual(result, { ok: true, revision: 2 });

  const project = await h.store.get('p1');
  assert.deepEqual(project?.parts, { sourceDeck: partSlot('p1', 'sourceDeck') });
  assert.equal(JSON.stringify(project).includes('sha256:pic-a'), false, 'the project record must stay small');

  assert.deepEqual(await h.store.getPart<SourceDeckV1>('p1', 'sourceDeck'), deck);
  assert.equal(await h.store.getPart('p1', 'compiled'), null);
});

test('a part kind that is not one of the four is refused', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  const result = await h.store.putPart('p1', 1, 'notes' as never, {} as never);
  assert.equal(result.ok === false && result.refusal, 'invalid-part');
});

// ── the quota path ───────────────────────────────────────────────────────────

test('a quota refusal on update is reported as a refusal and changes nothing', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));
  const before = await h.store.get('p1');

  h.host.state.save = async () => {
    throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
  };

  const result = await h.store.update('p1', project.revision, { name: 'Renamed' });
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.refusal, 'quota');
  assert.equal(result.ok === false && result.message.includes('in memory'), true);

  h.host.state.save = async (slot: string, data: object) => { void slot; void data; };
  assert.deepEqual(await h.store.get('p1'), before, 'the stored value is untouched, so the caller can offer a download');
});

test('a DOMException named QuotaExceededError is the same refusal, and a part write reports it too', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  h.host.state.save = async () => { throw new DOMException('no room', 'QuotaExceededError'); };

  const result = await h.store.putPart('p1', 1, 'census', { version: 1 } as never);
  assert.equal(result.ok === false && result.refusal, 'quota');
});

test('a quota refusal on the first write throws with the project in hand', async () => {
  const h = harness();
  h.host.state.save = async () => { throw new DOMException('no room', 'QuotaExceededError'); };

  const thrown = await h.store.create(input('p1')).then(() => null, (err: unknown) => err);
  assert.ok(thrown instanceof ProjectQuotaError);
  assert.equal(thrown.project.id, 'p1');
  assert.equal(thrown.project.revision, 1);
});

test('a failure that is not a quota refusal is not dressed up as one', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  h.host.state.save = async () => { throw new Error('database closed'); };

  await assert.rejects(() => h.store.update('p1', 1, { name: 'x' }), /database closed/);
});

// ── list ─────────────────────────────────────────────────────────────────────

test('list returns projects newest first by updatedAt, and nothing else in state', async () => {
  const h = harness();
  await h.store.create(input('old'));
  h.time.tick(60);
  await h.store.create(input('new'));
  h.time.tick(60);
  await h.host.state.save('a-saved-session', { __toolId: 'design' });

  assert.deepEqual((await h.store.list()).map((p) => p.id), ['new', 'old']);

  // A later write on the older project moves it to the front.
  h.time.tick(60);
  await h.store.update('old', 1, { name: 'Touched' });
  assert.deepEqual((await h.store.list()).map((p) => p.id), ['old', 'new']);
});

// ── remove ───────────────────────────────────────────────────────────────────

test('remove drops the record and its parts', async () => {
  const h = harness();
  await h.store.create(input('p1'), { bytes: new File([new Uint8Array([1])], 'deck.pptx') });
  await h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a']));

  const result = await h.store.remove('p1');

  assert.deepEqual([...h.host.inspect.state.keys()], []);
  assert.equal(await h.store.get('p1'), null);
  assert.equal(await h.store.getPart('p1', 'sourceDeck'), null);
  assert.deepEqual(result.removedAssetRefs.sort(), ['sha256:pic-a', 'user/upload/deck.pptx']);
  assert.deepEqual(result.keptAssetRefs, []);
  assert.deepEqual(h.deleted.sort(), ['sha256:pic-a', 'user/upload/deck.pptx']);
});

test('bytes another project still points at are kept', async () => {
  const h = harness();
  const shared = new File([new Uint8Array([1])], 'deck.pptx');
  await h.store.create(input('p1'), { bytes: shared });
  await h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a', 'sha256:pic-only-here']));
  await h.store.create(input('p2'), { bytes: shared });
  await h.store.putPart('p2', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a']));

  const result = await h.store.remove('p1');

  assert.deepEqual(result.removedAssetRefs, ['sha256:pic-only-here']);
  assert.deepEqual(result.keptAssetRefs.sort(), ['sha256:pic-a', 'user/upload/deck.pptx']);
  assert.deepEqual(h.deleted, ['sha256:pic-only-here']);
  assert.equal((await h.store.get('p2'))?.source.bytesAssetRef, 'user/upload/deck.pptx');
});

test('bytes a Design session still references are kept', async () => {
  const asked: string[] = [];
  const h = harness({
    deps: {
      async referencedElsewhere(ref) {
        asked.push(ref);
        return ref === 'sha256:pic-a';
      },
    },
  });
  await h.store.create(input('p1'));
  await h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a', 'sha256:pic-b']));

  const result = await h.store.remove('p1');

  assert.deepEqual(asked.sort(), ['sha256:pic-a', 'sha256:pic-b']);
  assert.deepEqual(result.keptAssetRefs, ['sha256:pic-a']);
  assert.deepEqual(result.removedAssetRefs, ['sha256:pic-b']);
});

test('removing a project that is not here answers with two empty lists', async () => {
  const h = harness();
  assert.deepEqual(await h.store.remove('gone'), { removedAssetRefs: [], keptAssetRefs: [] });
});

// ── two writes at once ───────────────────────────────────────────────────────

test('two updates in flight at once: one is saved, the other is told it is behind', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));

  const [first, second] = await Promise.all([
    h.store.update('p1', project.revision, { name: 'The person renamed it' }),
    h.store.update('p1', project.revision, { designSessionIds: ['sess-1'] }),
  ]);

  const saved = [first, second].filter((r) => r.ok);
  const refused = [first, second].filter((r) => !r.ok);
  assert.equal(saved.length, 1, 'only one write may report a save');
  assert.equal(refused.length, 1);
  assert.equal(refused[0]?.ok === false && refused[0].refusal, 'stale-revision');

  const stored = await h.store.get('p1');
  assert.equal(stored?.revision, 2);
  if (first.ok) {
    assert.equal(stored?.name, 'The person renamed it');
    assert.deepEqual(stored?.designSessionIds, []);
  } else {
    assert.deepEqual(stored?.designSessionIds, ['sess-1']);
    assert.equal(stored?.name, 'Why SUSE Summary');
  }
});

test('two part writes at once: the refused one leaves no pointer of its own', async () => {
  const h = harness();
  await h.store.create(input('p1'));

  const [first, second] = await Promise.all([
    h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a'])),
    h.store.putPart('p1', 1, 'census', { version: 1, marker: 'b' } as never),
  ]);

  assert.equal([first, second].filter((r) => r.ok).length, 1);
  const project = await h.store.get('p1');
  assert.equal(project?.revision, 2);
  assert.equal(Object.keys(project?.parts ?? {}).length, 1, 'the refused part must not be pointed at');
  if (!first.ok) assert.equal(await h.store.getPart('p1', 'sourceDeck'), null);
  if (!second.ok) assert.equal(await h.store.getPart('p1', 'census'), null);
});

test('a refused pointer write leaves the earlier part readable', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  const accepted = { version: 1, marker: 'the accepted plan' };
  assert.equal((await h.store.putPart('p1', 1, 'plan', accepted as never)).ok, true);

  // The part record saves; the project record is refused, as a full device would.
  const save = h.host.state.save;
  h.host.state.save = async (slot: string, data: object) => {
    if (slot === projectSlot('p1')) throw new DOMException('no room', 'QuotaExceededError');
    await save(slot, data);
  };
  const result = await h.store.putPart('p1', 2, 'plan', { version: 1, marker: 'the refused plan' } as never);
  h.host.state.save = save;

  assert.equal(result.ok === false && result.refusal, 'quota');
  assert.deepEqual(await h.store.getPart('p1', 'plan'), accepted, 'a refused write must not replace a decision');
});

test('a write another tab overtook is reported as behind, not as a save', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));

  // The other tab commits its own revision 2 in the gap between this tab's save
  // and its read back. Separate tabs are separate chains, so only the token
  // stored with the record can catch it.
  const save = h.host.state.save;
  let overtaken = false;
  h.host.state.save = async (slot: string, data: object) => {
    await save(slot, data);
    if (slot === projectSlot('p1') && !overtaken) {
      overtaken = true;
      await save(slot, {
        record: 'rebrand-project',
        writeToken: 'the other tab',
        project: { ...project, revision: 2, name: 'The other tab decided' },
      });
    }
  };

  const result = await h.store.update('p1', project.revision, { name: 'This tab' });
  h.host.state.save = save;

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.refusal, 'stale-revision');
  assert.equal(result.ok === false && result.currentRevision, 2);
  assert.equal((await h.store.get('p1'))?.name, 'The other tab decided');
});

test('undoing a refused part write never reaches a record another tab put there', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  assert.equal((await h.store.putPart('p1', 1, 'plan', { version: 1, marker: 'first' } as never)).ok, true);

  // While this tab is writing its own plan, the other tab stores its plan at the
  // same key and commits revision 3. This tab is refused, and what it undoes
  // must be its own write, not the decision that was accepted.
  const save = h.host.state.save;
  let overtaken = false;
  h.host.state.save = async (slot: string, data: object) => {
    await save(slot, data);
    if (slot === partSlot('p1', 'plan') && !overtaken) {
      overtaken = true;
      const current = await h.store.get('p1');
      await save(slot, {
        record: 'rebrand-part',
        projectId: 'p1',
        part: 'plan',
        writeToken: 'the other tab',
        value: { version: 1, marker: 'the other tab decided' },
      });
      await save(projectSlot('p1'), {
        record: 'rebrand-project',
        writeToken: 'the other tab',
        project: { ...current, revision: 3 },
      });
    }
  };

  const result = await h.store.putPart('p1', 2, 'plan', { version: 1, marker: 'this tab' } as never);
  h.host.state.save = save;

  assert.equal(result.ok === false && result.refusal, 'stale-revision');
  assert.deepEqual(await h.store.getPart('p1', 'plan'), { version: 1, marker: 'the other tab decided' });
});

// ── an id already in use ─────────────────────────────────────────────────────

test('create refuses an id this device already holds, and the first project survives', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  await h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a']));
  await h.store.update('p1', 2, { name: 'Decided' });

  const thrown = await h.store.create(input('p1')).then(() => null, (err: unknown) => err);
  assert.ok(thrown instanceof ProjectExistsError);
  assert.equal(thrown.projectId, 'p1');
  assert.equal(thrown.existing?.revision, 3);

  const stored = await h.store.get('p1');
  assert.equal(stored?.name, 'Decided');
  assert.equal(stored?.revision, 3);
  assert.ok(await h.store.getPart('p1', 'sourceDeck'));
});

test('create with replace clears the old parts and releases the old bytes', async () => {
  const h = harness();
  await h.store.create(input('p1'), { bytes: new File([new Uint8Array([1])], 'first.pptx') });
  await h.store.putPart('p1', 1, 'sourceDeck', deckWithMedia(['sha256:pic-a']));

  const fresh = await h.store.create(input('p1'), {
    bytes: new File([new Uint8Array([2])], 'second.pptx'),
    replace: true,
  });

  assert.equal(fresh.revision, 1);
  assert.deepEqual(fresh.parts, {});
  assert.equal(fresh.source.bytesAssetRef, 'user/upload/second.pptx');
  assert.equal(await h.store.getPart('p1', 'sourceDeck'), null);
  assert.deepEqual(h.deleted.sort(), ['sha256:pic-a', 'user/upload/first.pptx']);
  assert.deepEqual(
    [...h.host.inspect.state.keys()].filter((k) => k.includes('part:')),
    [],
    'no part record may outlive the project that pointed at it',
  );
});

// ── the quota path around the upload ─────────────────────────────────────────

test('a quota refusal while storing the deck is the documented refusal, with no ref on the project', async () => {
  const h = harness({
    deps: { async storeUpload() { throw new DOMException('no room', 'QuotaExceededError'); } },
  });

  const thrown = await h.store
    .create(input('p1'), { bytes: new File([new Uint8Array([1])], 'deck.pptx') })
    .then(() => null, (err: unknown) => err);

  assert.ok(thrown instanceof ProjectQuotaError);
  assert.equal(thrown.project.id, 'p1');
  assert.equal(thrown.project.source.bytesAssetRef, undefined);
  assert.equal(thrown.project.source.hash, 'sha256:deck');
});

test('a quota refusal on the first record releases the bytes it just stored', async () => {
  const h = harness();
  h.host.state.save = async () => { throw new DOMException('no room', 'QuotaExceededError'); };

  const thrown = await h.store
    .create(input('p1'), { bytes: new File([new Uint8Array([1])], 'deck.pptx') })
    .then(() => null, (err: unknown) => err);

  assert.ok(thrown instanceof ProjectQuotaError);
  assert.deepEqual(h.deleted, ['user/upload/deck.pptx'], 'nothing names those bytes, so they go');
  assert.equal(thrown.project.source.bytesAssetRef, undefined);
});

// ── reading a part back ──────────────────────────────────────────────────────

test('a pointer to another project record reads as no part, not as the wrong deck', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  await h.store.create(input('p2'));
  await h.store.putPart('p2', 1, 'census', { version: 1, marker: 'p2' } as never);
  await h.store.update('p1', 1, { parts: { census: partSlot('p2', 'census') } });

  assert.equal(await h.store.getPart('p1', 'census'), null);
  assert.deepEqual(await h.store.getPart('p2', 'census'), { version: 1, marker: 'p2' });
});

test('checkpoint carries the plan revision forward when the caller does not restate it', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  await h.store.checkpoint('p1', 1, 'plan', 3);

  assert.equal((await h.store.checkpoint('p1', 2, 'review')).ok, true);
  assert.equal((await h.store.get('p1'))?.checkpoint.planRevision, 3);

  await h.store.checkpoint('p1', 3, 'plan', 4);
  assert.equal((await h.store.get('p1'))?.checkpoint.planRevision, 4);
});

test('a patch key the contract does not define never reaches the record', async () => {
  const h = harness();
  await h.store.create(input('p1'));

  const result = await h.store.update('p1', 1, { name: 'Named', surprise: 'from a stale object' } as never);
  assert.deepEqual(result, { ok: true, revision: 2 });

  const stored = await h.store.get('p1');
  assert.equal(stored?.name, 'Named');
  assert.equal(JSON.stringify(stored).includes('surprise'), false);
});

// ── remove, and what it is allowed to delete ─────────────────────────────────

test('a picture another project holds in its plan is kept, and this project releases its own', async () => {
  const h = harness();
  await h.store.create(input('p1'));
  await h.store.putPart('p1', 1, 'plan', {
    version: 1,
    objects: [
      { id: 'o1', decisionReplacement: { kind: 'supplied-picture', assetRef: 'user/upload/shared.png' } },
      { id: 'o2', decisionReplacement: { kind: 'supplied-picture', assetRef: 'user/upload/only-p1.png' } },
    ],
  } as never);
  await h.store.create(input('p2'));
  await h.store.putPart('p2', 1, 'plan', {
    version: 1,
    objects: [{ id: 'o1', decisionReplacement: { kind: 'supplied-picture', assetRef: 'user/upload/shared.png' } }],
  } as never);

  const result = await h.store.remove('p1');

  assert.deepEqual(result.keptAssetRefs, ['user/upload/shared.png']);
  assert.deepEqual(result.removedAssetRefs, ['user/upload/only-p1.png']);
  assert.deepEqual(h.deleted, ['user/upload/only-p1.png']);
});

test('a referencedElsewhere that cannot answer keeps the bytes', async () => {
  const h = harness({
    deps: { async referencedElsewhere() { throw new Error('the session store is unavailable'); } },
  });
  await h.store.create(input('p1'), { bytes: new File([new Uint8Array([1])], 'deck.pptx') });

  const result = await h.store.remove('p1');

  assert.deepEqual(result.keptAssetRefs, ['user/upload/deck.pptx']);
  assert.deepEqual(result.removedAssetRefs, []);
  assert.deepEqual(h.deleted, [], 'an unanswered question must never delete the only copy');
});

test('a delete the asset store refuses is reported as kept, not as removed', async () => {
  const h = harness({
    deps: { async deleteAsset() { throw new Error('the asset store is locked'); } },
  });
  await h.store.create(input('p1'), { bytes: new File([new Uint8Array([1])], 'deck.pptx') });

  const result = await h.store.remove('p1');

  assert.deepEqual(result.removedAssetRefs, [], 'bytes still on the device are not a release');
  assert.deepEqual(result.keptAssetRefs, ['user/upload/deck.pptx']);
});

test('a project thumbnail is written as an SVG string within 16 KB, and nothing else is (close-out CP11)', async () => {
  const h = harness();
  const project = await h.store.create(input('p1'));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="192" height="108"></svg>';
  assert.deepEqual(await h.store.update('p1', project.revision, { thumbSvg: svg }), { ok: true, revision: 2 });
  assert.equal((await h.store.get('p1'))?.thumbSvg, svg);

  // Over the cap, or not a drawing at all: the write goes through and the thumbnail stays as it was.
  const big = `<svg>${'x'.repeat(16 * 1024)}</svg>`;
  assert.deepEqual(await h.store.update('p1', 2, { thumbSvg: big }), { ok: true, revision: 3 });
  assert.equal((await h.store.get('p1'))?.thumbSvg, svg);
  assert.deepEqual(await h.store.update('p1', 3, { thumbSvg: '<script>bad()</script>' }), { ok: true, revision: 4 });
  assert.equal((await h.store.get('p1'))?.thumbSvg, svg);

  assert.equal(thumbSvgOf(svg), svg);
  assert.equal(thumbSvgOf(big), undefined);
  assert.equal(thumbSvgOf(`<svg>${'é'.repeat(8200)}</svg>`), undefined, 'the cap is in bytes, not characters');
  assert.equal(thumbSvgOf(42), undefined);
});
