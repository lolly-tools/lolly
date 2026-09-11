// SPDX-License-Identifier: MPL-2.0
/**
 * active.ts - the head id and the "is this mine" verdict, from the registry when
 * there is one and from the legacy test when there is not.
 * Run: node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/active.test.ts"
 *
 * The hosts below are plain stubs on purpose: what is under test is which of the
 * two sources each accessor believes, not how the bridge builds either of them.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { USER_TOKENS_ID } from '../../bridge/tokens.ts';
import {
  activeDesignSystemLabel,
  activeDesignSystemRecord,
  activeDesignSystemSource,
  activeHeadId,
  isUserDesignSystemActive,
} from './active.ts';
import type { DesignSystemRecord } from './registry.ts';

const record = (over: Partial<DesignSystemRecord> = {}): DesignSystemRecord => ({
  id: 'default',
  label: 'Acme',
  ns: 'user/',
  headId: USER_TOKENS_ID,
  source: { kind: 'local' },
  locked: false,
  createdAt: 1,
  lastUsedAt: 1,
  ...over,
});

/** A host with a registry behind its tokens surface. */
const withRegistry = (rec: DesignSystemRecord | null) => ({
  tokens: { activeRecord: async () => rec },
  assets: { _findMetaByType: async () => ({ id: 'lolly/tokens/brand' }) },
});

/** A host from before the registry: no activeRecord, discovery only. */
const noRegistry = (discoveredId: string) => ({
  tokens: { bust: () => {} },
  assets: { _findMetaByType: async () => ({ id: discoveredId }) },
});

test('a local record answers with its own head, label and source', async () => {
  const active = record({ headId: 'user/ds/acme/tokens/brand', label: 'Acme Health' });
  const host = withRegistry(active);
  assert.equal(await activeDesignSystemRecord(host), active);
  assert.equal(await activeHeadId(host), 'user/ds/acme/tokens/brand');
  assert.equal(await isUserDesignSystemActive(host), true);
  assert.equal(await activeDesignSystemSource(host), 'local');
  assert.equal(await activeDesignSystemLabel(host), 'Acme Health');
});

test('the shipped system is not the person’s: the head falls back to the legacy id', async () => {
  const host = withRegistry(
    record({
      id: 'shipped',
      label: 'Lolly',
      ns: '',
      headId: 'lolly/tokens/brand',
      source: { kind: 'shipped' },
    })
  );
  assert.equal(await activeHeadId(host), USER_TOKENS_ID);
  assert.equal(await isUserDesignSystemActive(host), false);
  assert.equal(await activeDesignSystemSource(host), 'shipped');
  assert.equal(await activeDesignSystemLabel(host), 'Lolly');
});

test('without a registry, a user tokens install still reads as the person’s', async () => {
  const host = noRegistry(USER_TOKENS_ID);
  assert.equal(await activeHeadId(host), USER_TOKENS_ID);
  assert.equal(await isUserDesignSystemActive(host), true);
  // Nothing to name it with, and saying so is what lets a caller keep its own
  // older test rather than paint a stand-in answer.
  assert.equal(await activeDesignSystemSource(host), null);
  assert.equal(await activeDesignSystemLabel(host), null);
});

test('without a registry, a catalog-discovered head is not the person’s', async () => {
  const host = noRegistry('lolly/tokens/brand');
  assert.equal(await activeHeadId(host), USER_TOKENS_ID);
  assert.equal(await isUserDesignSystemActive(host), false);
  assert.equal(await activeDesignSystemSource(host), null);
});

test('a registry that answers null, a throwing one and a bare host all degrade quietly', async () => {
  assert.equal(await activeHeadId(withRegistry(null)), USER_TOKENS_ID);
  // withRegistry's discovery answers the catalog id, so the legacy test says no.
  assert.equal(await isUserDesignSystemActive(withRegistry(null)), false);

  const throwing = {
    tokens: {
      activeRecord: async () => {
        throw new Error('store closed');
      },
    },
    assets: {
      _findMetaByType: async () => {
        throw new Error('store closed');
      },
    },
  };
  assert.equal(await activeHeadId(throwing), USER_TOKENS_ID);
  assert.equal(await isUserDesignSystemActive(throwing), false);

  assert.equal(await activeHeadId({}), USER_TOKENS_ID);
  assert.equal(await isUserDesignSystemActive({}), false);
  assert.equal(await activeDesignSystemLabel({}), null);
});
