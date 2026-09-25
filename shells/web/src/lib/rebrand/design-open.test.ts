// SPDX-License-Identifier: MPL-2.0
/**
 * Opening a new Design document for a compiled deck (plan 274 section 2.1 step 5).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/rebrand/design-open.test.ts
 *
 * Navigation is a stub that records the route and, where a case wants the document to
 * mount, plays the canvas: it takes the waiter the way `views/free-canvas.ts` does on
 * mount and attaches a handle whose `lay` records the pages. The last case runs the
 * real `openCompiledDeckInDesign` over the opener, so the pair is pinned against the
 * caller that uses it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type {
  CompiledDeckV1,
  ProjectStageV1,
  ProjectWriteResultV1,
  RenovationProjectStoreV1,
  RenovationProjectV1,
} from '@lolly-tools/core/rebrand-v1';
import {
  REBRAND_DESIGN_TOOL_ID,
  designOpener,
  designRouteFor,
  hasPendingRebrandDesign,
  takePendingRebrandDesign,
  type RebrandDesignMountV1,
} from './design-open.ts';
import { getRebrandHandoff, openCompiledDeckInDesign, type DesignHandoffFrameV1 } from './design-handoff.ts';

const REPO = new URL('../../../../../', import.meta.url);
const sample = <T,>(name: string): T =>
  JSON.parse(readFileSync(new URL(`tests/fixtures/rebrand/samples/${name}`, REPO), 'utf8')) as T;

/** A state bridge that records deletes. */
function stubState(): { state: { save(): Promise<void>; load(): Promise<null>; list(): Promise<never[]>; delete(slot: string): Promise<void> }; deleted: string[] } {
  const deleted: string[] = [];
  return {
    deleted,
    state: {
      save: async () => undefined,
      load: async () => null,
      list: async () => [],
      delete: async (slot: string) => {
        deleted.push(slot);
      },
    },
  };
}

/** Plays the canvas: takes the waiter for Design and attaches a handle that records the pages. */
function mountDesign(laid: DesignHandoffFrameV1[][], owner: object = {}, keptIds = true): string | null {
  const pending = takePendingRebrandDesign(REBRAND_DESIGN_TOOL_ID);
  if (!pending) return null;
  const mount: RebrandDesignMountV1 = {
    owner,
    lay: async (frames, opts) => {
      laid.push(frames);
      return { landed: frames.length, keptIds: opts.keepIds && keptIds };
    },
  };
  pending.attach(mount);
  return pending.name;
}

test('navigate goes to a fresh Design document under a minted slot and resolves once it mounts', async () => {
  const { state } = stubState();
  const routes: string[] = [];
  const owner = {};
  const laid: DesignHandoffFrameV1[][] = [];
  let named: string | null = null;
  const opener = designOpener({ state }, {
    go: (hash) => {
      routes.push(hash);
      queueMicrotask(() => {
        named = mountDesign(laid, owner);
      });
    },
    mintSlot: () => 'design:fixed-1',
  });
  const session = await opener.navigate({ name: 'Quarterly review', frames: 2 });
  assert.deepEqual(routes, [designRouteFor('design:fixed-1')]);
  assert.equal(routes[0], '#/tool/design?slot=design%3Afixed-1');
  assert.equal(session.id, 'design:fixed-1');
  assert.equal(session.owner, owner, 'the marker is held against the mounted runtime');
  assert.equal(named, 'Quarterly review', 'the canvas is told the document name');
  assert.equal(hasPendingRebrandDesign(), false, 'the waiter is single use');
});

test('importer lays the pages down on the document navigate opened', async () => {
  const { state } = stubState();
  const laid: DesignHandoffFrameV1[][] = [];
  const opener = designOpener({ state }, {
    go: () => queueMicrotask(() => void mountDesign(laid)),
    mintSlot: () => 'design:fixed-2',
  });
  await opener.navigate({ name: 'Deck', frames: 1 });
  const frames = [{ id: 'frame-1', name: 'Slide 1', width: 960, height: 540, boxes: [] }] as DesignHandoffFrameV1[];
  const outcome = await opener.importer(frames, { keepIds: true, onWarning: () => undefined });
  assert.deepEqual(outcome, { landed: 1, keptIds: true });
  assert.equal(laid.length, 1);
  assert.equal(laid[0], frames, 'the pages reach the canvas as handed over');
});

test('importer refuses before a document is open', async () => {
  const { state } = stubState();
  const opener = designOpener({ state }, { go: () => undefined });
  await assert.rejects(() => Promise.resolve(opener.importer([], { keepIds: true, onWarning: () => undefined })), /not open/);
});

test('another tool mounting first leaves the waiter for Design', async () => {
  const { state } = stubState();
  const laid: DesignHandoffFrameV1[][] = [];
  const opener = designOpener({ state }, {
    go: () =>
      queueMicrotask(() => {
        assert.equal(takePendingRebrandDesign('org-chart'), null);
        assert.equal(takePendingRebrandDesign(undefined), null);
        assert.equal(hasPendingRebrandDesign(), true);
        mountDesign(laid);
      }),
    mintSlot: () => 'design:fixed-3',
  });
  const session = await opener.navigate({ name: 'Deck', frames: 1 });
  assert.equal(session.id, 'design:fixed-3');
});

test('a document that never mounts is given up on, and the waiter is withdrawn', async () => {
  const { state } = stubState();
  const opener = designOpener({ state }, { go: () => undefined, timeoutMs: 5, mintSlot: () => 'design:never' });
  await assert.rejects(() => Promise.resolve(opener.navigate({ name: 'Deck', frames: 1 })), /did not open/);
  assert.equal(hasPendingRebrandDesign(), false);
  assert.equal(takePendingRebrandDesign(REBRAND_DESIGN_TOOL_ID), null, 'a later Design mount finds nothing to take');
});

test('a newer open replaces one that never mounted', async () => {
  const { state } = stubState();
  const laid: DesignHandoffFrameV1[][] = [];
  let calls = 0;
  const opener = designOpener({ state }, {
    go: () => {
      calls += 1;
      if (calls === 2) queueMicrotask(() => void mountDesign(laid));
    },
    mintSlot: () => `design:open-${calls + 1}`,
  });
  const first = Promise.resolve(opener.navigate({ name: 'First', frames: 1 }));
  const second = await opener.navigate({ name: 'Second', frames: 1 });
  await assert.rejects(() => first, /replaced/);
  assert.equal(second.id, 'design:open-2');
});

test('close steps back from the document and forgets its slot', async () => {
  const { state, deleted } = stubState();
  let backs = 0;
  const opener = designOpener({ state }, {
    go: () => queueMicrotask(() => void mountDesign([])),
    back: () => {
      backs += 1;
    },
    mintSlot: () => 'design:closing',
  });
  const session = await opener.navigate({ name: 'Deck', frames: 1 });
  await session.close?.();
  assert.equal(backs, 1);
  assert.deepEqual(deleted, ['design:closing']);
  await assert.rejects(() => Promise.resolve(opener.importer([], { keepIds: true, onWarning: () => undefined })), /not open/);
});

/** The contract store with the revision rule, over one project. */
function oneProjectStore(project: RenovationProjectV1): RenovationProjectStoreV1 {
  let current = project;
  const notHere = (): ProjectWriteResultV1 => ({ ok: false, refusal: 'invalid-part', message: 'Not part of this test.' });
  return {
    list: async () => [current],
    get: async (id: string) => (id === current.id ? current : null),
    create: async () => current,
    update: async (id: string, expectedRevision: number, patch: Partial<RenovationProjectV1>): Promise<ProjectWriteResultV1> => {
      if (id !== current.id || expectedRevision !== current.revision) {
        return { ok: false, refusal: 'stale-revision', message: 'Another view changed this project.', currentRevision: current.revision };
      }
      current = { ...current, ...patch, revision: current.revision + 1 };
      return { ok: true, revision: current.revision };
    },
    putPart: async () => notHere(),
    getPart: async <T = unknown>(): Promise<T | null> => null,
    checkpoint: async (_id: string, _revision: number, _stage: ProjectStageV1) => notHere(),
    remove: async () => ({ removedAssetRefs: [], keptAssetRefs: [] }),
  };
}

test('openCompiledDeckInDesign over the opener records the minted slot and holds the marker on the runtime', async () => {
  const { state } = stubState();
  const owner = {};
  const laid: DesignHandoffFrameV1[][] = [];
  const opener = designOpener({ state }, {
    go: () => queueMicrotask(() => void mountDesign(laid, owner)),
    mintSlot: () => 'design:handoff',
  });
  const project = { ...sample<RenovationProjectV1>('project.json'), designSessionIds: [] };
  const deck = sample<CompiledDeckV1>('compiled.json');
  const result = await openCompiledDeckInDesign({ deck, project, store: oneProjectStore(project), ...opener });
  assert.equal(result.sessionId, 'design:handoff');
  assert.equal(result.recorded, true);
  assert.equal(result.idsKept, true);
  assert.equal(laid.length, 1);
  assert.ok(getRebrandHandoff(owner), 'the marker waits on the runtime for the next save');
});
