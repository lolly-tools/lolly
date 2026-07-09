/**
 * Contract tests for the runtime's export-time ingredient sweep (runtime.ts
 * export()): a placed asset input whose resolved ref carries a preserved
 * Content Credential is handed to host.export.render as opts.ingredients, so
 * the shell embeds the source's provenance chain into the export. Covers BOTH
 * user uploads (host captured the store at ingest — v1.26) and library/catalog
 * assets (the host may extract the store from the asset's own bytes — v1.31).
 * Any other source is never consulted.
 *
 * Run with: node --test tests/runtime-ingredients.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import { embedC2pa, extractC2paStore } from '../engine/src/index.ts';

// Unique tool ids — compiled hook factories are memoised by id@version.
let toolSeq = 0;
function assetTool(): any {
  return {
    manifest: {
      id: `ingredient-${++toolSeq}`, name: 'Ingredient', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'img', type: 'asset' }],
    },
    template: '<b>x</b>',
  };
}

// A real, parseable manifest store: sign a tiny SVG, pull the store back out —
// exactly what a shell persists at upload ingest / reads from a library asset.
async function credentialStore(): Promise<Uint8Array> {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  const signed = await embedC2pa(svg, 'svg', { title: 'Source art' });
  const ex = extractC2paStore(signed);
  assert.ok(ex, 'embedded credential extracts back out');
  return ex!.store;
}

// Host double: assets.get resolves any id to a ref with the given `source`;
// assets.credential records what the runtime asked for; export.render records
// the opts it was handed.
function makeHost(source: string, store: Uint8Array | null, credentialCalls: string[]) {
  const rendered: any[] = [];
  const host: any = {
    version: '1',
    profile: { get: async () => ({}) },
    log: () => {},
    assets: {
      get: async (id: string) => ({ id, source, type: 'raster', format: 'png', url: 'blob:x' }),
      credential: async (id: string) => {
        credentialCalls.push(id);
        return store ? { store, format: 'svg' } : null;
      },
    },
    export: {
      render: async (_node: unknown, _format: string, opts: any) => { rendered.push(opts); return {}; },
    },
  };
  return { host, rendered };
}

test('a library-sourced credentialed asset rides into opts.ingredients (v1.31)', async () => {
  const store = await credentialStore();
  const calls: string[] = [];
  const { host, rendered } = makeHost('library', store, calls);
  const rt = await createRuntime(assetTool(), host, { img: { id: 'suse/photo/hero' } });
  await rt.export({} as any, 'png', {});
  assert.deepEqual(calls, ['suse/photo/hero'], 'credential consulted for the placed library asset');
  assert.equal(rendered.length, 1);
  assert.equal(rendered[0].ingredients?.length, 1, 'one prepared ingredient threaded to the shell');
  assert.equal(typeof rendered[0].ingredients[0].activeLabel, 'string');
  assert.ok(rendered[0].ingredients[0].manifestBoxes.length >= 1, 'ingredient carries the manifest superboxes verbatim');
});

test('a user-sourced credentialed asset still rides (v1.26 behaviour unchanged)', async () => {
  const store = await credentialStore();
  const calls: string[] = [];
  const { host, rendered } = makeHost('user', store, calls);
  const rt = await createRuntime(assetTool(), host, { img: { id: 'user/upload/1' } });
  await rt.export({} as any, 'png', {});
  assert.deepEqual(calls, ['user/upload/1']);
  assert.equal(rendered[0].ingredients?.length, 1);
});

test('an uncredentialed asset yields no ingredients (null credential is not fatal)', async () => {
  const calls: string[] = [];
  const { host, rendered } = makeHost('library', null, calls);
  const rt = await createRuntime(assetTool(), host, { img: { id: 'suse/photo/plain' } });
  await rt.export({} as any, 'png', {});
  assert.deepEqual(calls, ['suse/photo/plain'], 'credential was consulted');
  assert.equal(rendered[0].ingredients, undefined, 'no ingredients key when nothing to preserve');
});

test('a remote-sourced asset is never consulted for a credential', async () => {
  const calls: string[] = [];
  const { host, rendered } = makeHost('remote', null, calls);
  const rt = await createRuntime(assetTool(), host, { img: { id: 'ext/pic' } });
  await rt.export({} as any, 'png', {});
  assert.deepEqual(calls, [], 'remote refs are outside the sweep');
  assert.equal(rendered[0].ingredients, undefined);
});
