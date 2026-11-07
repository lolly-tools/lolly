// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the runtime's export-time ingredient sweep (runtime.ts
 * export()): a placed asset input whose resolved ref carries a preserved
 * Content Credential is handed to host.export.render as opts.ingredients, so
 * the shell embeds the source's provenance chain into the export. Covers BOTH
 * user uploads (host captured the store at ingest - v1.26) and library/catalog
 * assets (the host may extract the store from the asset's own bytes - v1.31).
 * Any other source is never consulted.
 *
 * Run with: node --test tests/runtime-ingredients.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRuntime } from '../engine/src/runtime.ts';
import { CAPTURE_SOURCE_TYPE, GENERATED_SOURCE_TYPE, embedC2pa, exportActionSteps, extractC2paStore, verifyC2pa } from '../engine/src/index.ts';

// Unique tool ids - compiled hook factories are memoised by id@version.
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

// A real, parseable manifest store: sign a tiny SVG, pull the store back out - 
// exactly what a shell persists at upload ingest / reads from a library asset.
async function credentialStore(title = 'Source art', digitalSourceType?: string): Promise<Uint8Array> {
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  const signed = await embedC2pa(svg, 'svg', { title, ...(digitalSourceType ? { actions: [{ action: 'c2pa.created', digitalSourceType }] } : {}) });
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

// A page that places pictures in a repeating field, as Design's boxes do.
function pageTool(): any {
  return {
    manifest: {
      id: `ingredient-page-${++toolSeq}`, name: 'Page', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'boxes', type: 'blocks', fields: [{ id: 'image', type: 'asset' }] }],
    },
    template: '<b>x</b>',
  };
}

test('two placed credentialed pictures are components, and the credential they make is valid', async () => {
  const stores: Record<string, Uint8Array> = {
    'user/upload/photo': await credentialStore('Harbour photo', CAPTURE_SOURCE_TYPE),
    'user/upload/sky': await credentialStore('Generated sky', GENERATED_SOURCE_TYPE),
  };
  const rendered: any[] = [];
  const host: any = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    assets: {
      get: async (id: string) => ({ id, source: 'user', type: 'raster', format: 'png', url: 'blob:x' }),
      credential: async (id: string) => (stores[id] ? { store: stores[id], format: 'svg' } : null),
    },
    export: { render: async (_node: unknown, _format: string, opts: any) => { rendered.push(opts); return {}; } },
  };
  const rt = await createRuntime(pageTool(), host, { boxes: [{ image: { id: 'user/upload/photo' } }, { image: { id: 'user/upload/sky' } }] });
  await rt.export({} as any, 'png', {});
  const ingredients = rendered[0].ingredients;
  assert.equal(ingredients?.length, 2, 'both pictures are carried');
  assert.deepEqual(ingredients.map((i: any) => i.relationship), ['componentOf', 'componentOf'], 'a placed picture is a component, never the parent');

  // The same list written into a credential, as the web shell's stamp does: it used to be
  // refused for holding two parentOf ingredients (manifest.multipleParents).
  const page = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
  const signed = await embedC2pa(page, 'svg', { title: 'Page', actions: exportActionSteps('svg', {}), ingredients });
  const report = await verifyC2pa(signed);
  assert.equal(report.state, 'valid');
  const active = report.ingredients?.at(-1)?.manifest;
  assert.deepEqual((report.ingredients ?? []).filter((i) => i.manifest === active).map((i) => `${i.title}/${i.relationship}`).sort(),
    ['Generated sky/componentOf', 'Harbour photo/componentOf']);
  const placed = (report.history ?? []).filter((s) => s.action === 'c2pa.placed');
  assert.equal(placed.length, 2, 'one placed step per picture');
  assert.ok(placed.some((s) => s.digitalSourceType === GENERATED_SOURCE_TYPE), 'the AI source type travels on its placed step');
  assert.equal((report.history ?? []).some((s) => s.action === 'c2pa.opened'), false, 'nothing is recorded as opened');
});
