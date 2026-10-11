// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import manifest from '../../models-manifest.json' with { type: 'json' };
import { MODELS_BASE } from './models-base.ts';
import { currentModelStoredFileName, modelDirectoryId, modelFile, modelNetworkUrl, modelCacheUrl, legacyModelCacheUrl } from './model-manifest.ts';

test('the pinned transformers resolver uses the actual hashed directory URL', async () => {
  const { buildResourcePaths, getModelFile } = await import(new URL('../../../../node_modules/@huggingface/transformers/src/utils/hub.js', import.meta.url).href);
  const { env } = await import(new URL('../../../../node_modules/@huggingface/transformers/src/env.js', import.meta.url).href);
  const nested = manifest.find(file => file.url.startsWith('/models/reword/') && file.url.endsWith('/config.json'))!;
  const id = nested.url.slice('/models/'.length, -'/config.json'.length);
  const mapped = modelDirectoryId(id);
  assert.equal(mapped, nested.immutableUrl.slice(0, -'/config.json'.length));
  const paths = buildResourcePaths(mapped, 'config.json');
  assert.equal(paths.localPath, nested.immutableUrl);
  assert.equal(modelFile(paths.localPath)?.sha256, nested.sha256);
  assert.notEqual(paths.localPath, paths.remoteURL);
  const previous = { fetch: env.fetch, allowRemoteModels: env.allowRemoteModels, allowLocalModels: env.allowLocalModels, useFS: env.useFS, useFSCache: env.useFSCache, useBrowserCache: env.useBrowserCache, useCustomCache: env.useCustomCache };
  try {
    Object.assign(env, { allowRemoteModels: false, allowLocalModels: true, useFS: false, useFSCache: false, useBrowserCache: false, useCustomCache: false });
    let requested = '';
    env.fetch = async (input: string) => { requested = input; return new Response('{}'); };
    assert.deepEqual(await getModelFile(mapped, 'config.json'), new TextEncoder().encode('{}'));
    assert.equal(requested, nested.immutableUrl);
    assert.equal(modelNetworkUrl(requested), MODELS_BASE + nested.immutableUrl);
  } finally { Object.assign(env, previous); }
});

test('cache writes use immutable keys while legacy aliases stay read-only candidates', () => {
  for (const file of manifest) {
    assert.equal(modelCacheUrl(file.url), MODELS_BASE + file.immutableUrl);
    assert.equal(legacyModelCacheUrl(file.url), MODELS_BASE + file.url);
  }
});

test('old immutable model versions are not included in current installed-file rosters', () => {
  const file = manifest.find(file => file.url.startsWith('/models/sing/'))!;
  const currentName = file.url.slice('/models/sing/'.length);
  assert.equal(currentModelStoredFileName(file.immutableUrl), currentName);
  assert.equal(currentModelStoredFileName(file.immutableUrl.replace(/@[a-f0-9]{16}\//, '@0000000000000000/')), undefined);
  assert.equal(currentModelStoredFileName(currentName), currentName);
  assert.equal(modelFile('unresolved-model/config.json'), undefined);
});
