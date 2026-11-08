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

// D1 (2026-11-07): a rendition tool's picture is the export's parent. Before this, the
// darkroom, filter and asset-export recorded the photo they changed as one more placed
// component, after a created step that said the file was made from scratch.
function renditionTool(action = 'c2pa.color_adjustments'): any {
  const tool = assetTool();
  tool.manifest.inputs = [{ id: 'image', type: 'asset' }, { id: 'badge', type: 'asset' }, { id: 'layers', type: 'blocks', fields: [{ id: 'img', type: 'asset' }], default: [] }];
  tool.manifest.renditionOf = { input: 'image', action, unlessSet: ['layers'] };
  return tool;
}

test('a rendition records its credentialed picture as the parent, and every other picture as a component', async () => {
  const photo = await credentialStore('Harbour photo', CAPTURE_SOURCE_TYPE);
  const badge = await credentialStore('Badge');
  const { host, rendered } = makeHost('user', photo, []);
  host.assets.credential = async (id: string) => ({ store: id === 'user/badge' ? badge : photo, format: 'svg' });
  const rt = await createRuntime(renditionTool(), host, { image: { id: 'user/photo' }, badge: { id: 'user/badge' } });
  await rt.export({} as any, 'png', {});
  assert.deepEqual(rendered[0].ingredients.map((i: any) => `${i.title}/${i.relationship}`), ['Harbour photo/parentOf', 'Badge/componentOf']);
  assert.deepEqual(rendered[0].c2paRendition, { action: 'c2pa.color_adjustments' });
});

test('a rendition whose picture has no credential records no parent and keeps the created step', async () => {
  const { host, rendered } = makeHost('user', null, []);
  const rt = await createRuntime(renditionTool(), host, { image: { id: 'user/photo' } });
  await rt.export({} as any, 'png', {});
  assert.equal(rendered[0].ingredients, undefined);
  assert.equal(rendered[0].c2paRendition, undefined, 'nothing to open, so nothing in place of created');
});

test('a rendition of a data: picture reads the parent from the bytes, and a tool without renditionOf is unchanged', async () => {
  const signed = await embedC2pa(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>'), 'svg', { title: 'Linked photo' });
  const url = `data:image/svg+xml;base64,${Buffer.from(signed).toString('base64')}`;
  const host: any = { ...makeHost('remote', null, []).host };
  const seen: any[] = [];
  host.assets = { get: async (id: string) => ({ id, source: 'remote', type: 'vector', format: 'svg', url }), credential: async () => null };
  host.export = { render: async (_n: unknown, _f: string, opts: any) => { seen.push(opts); return {}; } };
  const rt = await createRuntime(renditionTool('c2pa.filtered'), host, { image: { id: 'linked', source: 'remote', type: 'vector', format: 'svg', url } });
  await rt.export({} as any, 'png', {});
  assert.equal(seen[0].ingredients?.[0]?.relationship, 'parentOf');
  assert.equal(seen[0].ingredients?.[0]?.title, 'Linked photo');
  assert.deepEqual(seen[0].c2paRendition, { action: 'c2pa.filtered' });

  const store = await credentialStore();
  const plain = makeHost('user', store, []);
  const rt2 = await createRuntime(assetTool(), plain.host, { img: { id: 'user/photo' } });
  await rt2.export({} as any, 'png', {});
  assert.equal(plain.rendered[0].ingredients[0].relationship, 'componentOf');
  assert.equal(plain.rendered[0].c2paRendition, undefined);
});

test('a rendition credential opens its parent, names what was done, and verifies', async () => {
  const store = await credentialStore('Harbour photo', CAPTURE_SOURCE_TYPE);
  const { host, rendered } = makeHost('user', store, []);
  const rt = await createRuntime(renditionTool(), host, { image: { id: 'user/photo' } });
  await rt.export({} as any, 'png', {});
  const opts = rendered[0];
  const png = (await import('../engine/src/png.ts')).packPng(new Uint8Array(4 * 4 * 4).fill(90), { width: 4, height: 4 });
  const signed = await embedC2pa(png, 'png', { title: 'Darkroom', ingredients: opts.ingredients, actions: exportActionSteps('png', { rendition: opts.c2paRendition }) });
  const report = await verifyC2pa(signed);
  assert.equal(report.state, 'valid');
  // The history walks the parent's own steps first, then this file's.
  const steps = (report.history ?? []).map((s: any) => s.action);
  const own = steps.slice(steps.indexOf('c2pa.opened'));
  assert.deepEqual(own, ['c2pa.opened', 'c2pa.color_adjustments', 'c2pa.converted'], 'the parent opened, what the tool did to it, then the render');
  assert.equal(report.history?.[0]?.digitalSourceType, CAPTURE_SOURCE_TYPE, 'the parent keeps its own camera origin in the chain');
  assert.equal(report.madeWithLolly, true, 'a rendition Lolly made reads as made with Lolly, not as parts of it');
  const { renditionFromSteps } = await import('../engine/src/c2pa.ts');
  assert.deepEqual(renditionFromSteps(report.history!.slice(steps.indexOf('c2pa.opened'))), { action: 'c2pa.color_adjustments' }, 'and a replacing shell reads the same step back');
});

test('the engine refuses a renditionOf that names no top-level asset input, as the SDK does', async () => {
  const { validateManifest } = await import('../engine/src/validate.ts');
  const tool = renditionTool();
  assert.equal(validateManifest(tool.manifest).valid, true);
  const wrong = { ...tool.manifest, renditionOf: { input: 'caption', action: 'c2pa.filtered' } };
  assert.deepEqual(validateManifest(wrong).errors.map((e) => e.path), ['/renditionOf/input']);
});

test('a rendition is not recorded while another input replaces the picture, and one manifest is one ingredient', async () => {
  const store = await credentialStore('Harbour photo', CAPTURE_SOURCE_TYPE);
  const layered = makeHost('user', store, []);
  const rt = await createRuntime(renditionTool(), layered.host, { image: { id: 'user/photo' }, layers: [{ img: { id: 'user/layer' } }] });
  await rt.export({} as any, 'png', {});
  assert.equal(layered.rendered[0].c2paRendition, undefined, 'a layer stack took the photo\'s place');
  assert.ok(layered.rendered[0].ingredients.every((i: any) => i.relationship === 'componentOf'));

  // The same signed picture under two ids is the parent once, not also a component.
  const twice = makeHost('user', store, []);
  const rt2 = await createRuntime(renditionTool(), twice.host, { image: { id: 'user/photo' }, badge: { id: 'user/photo-copy' } });
  await rt2.export({} as any, 'png', {});
  assert.deepEqual(twice.rendered[0].ingredients.map((i: any) => i.relationship), ['parentOf']);
});

test('a percent-encoded binary data: picture is read byte for byte', async () => {
  const png = (await import('../engine/src/png.ts')).packPng(new Uint8Array(4 * 4 * 4).fill(120), { width: 4, height: 4 });
  const signed = await embedC2pa(png, 'png', { title: 'Binary photo' });
  const url = `data:image/png,${Array.from(signed, (b) => `%${b.toString(16).padStart(2, '0')}`).join('')}`;
  const seen: any[] = [];
  const host: any = { ...makeHost('remote', null, []).host };
  host.assets = { get: async (id: string) => ({ id, source: 'remote', type: 'raster', format: 'png', url }), credential: async () => null };
  host.export = { render: async (_n: unknown, _f: string, opts: any) => { seen.push(opts); return {}; } };
  const rt = await createRuntime(renditionTool(), host, { image: { id: 'linked', source: 'remote', type: 'raster', format: 'png', url } });
  await rt.export({} as any, 'png', {});
  assert.equal(seen[0].ingredients?.[0]?.title, 'Binary photo');
  assert.equal(seen[0].ingredients?.[0]?.relationship, 'parentOf');
});
