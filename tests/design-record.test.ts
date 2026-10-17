// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system record (plans/319 A7) through the runtime: an export records
 * which design system, version and colourway drew it, on by default, with the export
 * panel's card, `_madewith=0` and `--no-madewith` as the switch. The record is read
 * through the runtime's scoped host, so it gives the artefact's own colourway, and an
 * on-device utility never records one.
 *
 * Run with: node --test tests/design-record.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { resolveTokenSelection } from '../engine/src/token-selection.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';
import type { ExportMeta } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
type Tool = Parameters<typeof createRuntime>[0];
type Host = Parameters<typeof createRuntime>[1];

function colourwayDoc(): Rec {
  const start = JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
  const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

let seq = 0;
function tool(extra: Rec = {}): Tool {
  return {
    trustClass: 'catalog',
    manifest: {
      id: `design-record-${++seq}`, name: 'Chart', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 100, height: 100, formats: ['png'] },
      inputs: [{ id: 'title', type: 'text', default: 'Hello' }],
      ...extra,
    },
    template: '<p>{{title}}</p>',
    styles: null, hooksSource: null, hooksUrl: null,
    textTemplates: {}, textTemplateErrors: {},
  } as unknown as Tool;
}

/** A host whose tokens are one colourway document and whose system is "Acme". */
function host(renders: Rec[], opts: { snapshot?: boolean } = {}): Host {
  const doc = colourwayDoc();
  const tokens = {
    get: async (o = {}) => createTokenSet(doc, o),
    colors: async (o = {}) => createTokenSet(doc, o).colors(),
    resolve: async (ref: string, o = {}) => createTokenSet(doc, o).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
    ...(opts.snapshot === false ? {} : {
      snapshot: async () => ({
        document: doc,
        system: { id: 'acme', label: 'Acme', source: 'local', active: true, locked: false, headId: null },
        version: '2026-10',
        selection: { choices: resolveTokenSelection(doc).choices },
      }),
    }),
  };
  return {
    version: '1', shell: 'test',
    profile: { get: async () => ({ useDetails: true, firstname: 'Andy', lastname: 'Fitzsimon' }) },
    log: () => {},
    tokens,
    export: {
      render: async (_node: unknown, _format: string, options: Rec) => {
        renders.push(options);
        return new Blob([new Uint8Array([1])], { type: 'image/png' });
      },
    },
  } as unknown as Host;
}

const canvas = (): Element => new JSDOM('<div id="c"><p>Hello</p></div>').window.document.getElementById('c')!;
const metaOf = (r: Rec): ExportMeta => r.meta as ExportMeta;

test('on by default: an export records the system, version and the artefact\'s own colourway', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders), {}, { tokenSelection: { colourway: 'persimmon' } });
  assert.equal(runtime.madeWith(), true);
  await runtime.export(canvas(), 'png', {});
  const meta = metaOf(renders[0]!);
  assert.deepEqual(meta.designSystem, { id: 'acme', label: 'Acme' });
  assert.equal(meta.designVersion, '2026-10');
  assert.deepEqual(meta.themes, [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }]);
  assert.equal(meta.description, 'Made with https://lolly.tools : Chart (Persimmon colourway) by Andy Fitzsimon');
  assert.deepEqual(runtime.lastExportMeta, meta, 'the shells that stamp afterwards read the same record');
});

test('switching the artefact\'s colourway changes what the next export records', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders), {}, { tokenSelection: { colourway: 'persimmon' } });
  await runtime.setTokenSelection({ colourway: 'main' });
  await runtime.export(canvas(), 'png', {});
  assert.equal(metaOf(renders[0]!).themes?.[0]?.id, 'main');
  assert.equal(metaOf(renders[0]!).description, 'Made with https://lolly.tools : Chart (Main colourway) by Andy Fitzsimon');
});

test('off: no design system, version or theme is written, and the description keeps its plain form', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders), {}, { tokenSelection: { colourway: 'persimmon' } });
  runtime.setMadeWith(false);
  assert.equal(runtime.madeWith(), false);
  await runtime.export(canvas(), 'png', {});
  const meta = metaOf(renders[0]!);
  assert.equal('designSystem' in meta || 'designVersion' in meta || 'themes' in meta, false);
  assert.equal(meta.description, 'Made with https://lolly.tools : Chart by Andy Fitzsimon');
  assert.equal('designSystem' in runtime.lastExportMeta!, false);
});

test('an export\'s own madeWith wins over the runtime setting for that one export', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders));
  await runtime.export(canvas(), 'png', { madeWith: false });
  runtime.setMadeWith(false);
  await runtime.export(canvas(), 'png', { madeWith: true });
  assert.equal('designSystem' in metaOf(renders[0]!), false);
  assert.deepEqual(metaOf(renders[1]!).designSystem, { id: 'acme', label: 'Acme' });
  assert.equal(runtime.madeWith(), false, 'a per-export choice does not move the switch');
});

test('the preview shows the exact record and both descriptions before anything is written', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders), {}, { tokenSelection: { colourway: 'persimmon' } });
  const preview = await runtime.madeWithPreview();
  assert.deepEqual(preview, {
    record: {
      designSystem: { id: 'acme', label: 'Acme' }, designVersion: '2026-10',
      themes: [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }],
    },
    description: 'Made with https://lolly.tools : Chart (Persimmon colourway) by Andy Fitzsimon',
    plainDescription: 'Made with https://lolly.tools : Chart by Andy Fitzsimon',
  });
  assert.equal(renders.length, 0, 'a preview exports nothing');
  // The preview does not depend on the switch: the card shows what ticking it writes.
  runtime.setMadeWith(false);
  assert.deepEqual((await runtime.madeWithPreview())?.record, preview?.record);
});

test('nothing to record: a host with no token snapshot, and every on-device utility', async () => {
  const renders: Rec[] = [];
  const bare = await createRuntime(tool(), host(renders, { snapshot: false }));
  assert.equal(await bare.madeWithPreview(), null);
  await bare.export(canvas(), 'png', {});
  assert.equal('designSystem' in metaOf(renders[0]!), false);

  const utility = await createRuntime(tool({ privacy: 'on-device' }), host(renders));
  assert.equal(await utility.madeWithPreview(), null, 'an on-device utility adds nothing to the file');
});

test('lastExportMeta follows the export that just ran, and is null when it embedded none', async () => {
  const renders: Rec[] = [];
  const runtime = await createRuntime(tool(), host(renders));
  assert.equal(runtime.lastExportMeta, null, 'nothing before the first export');
  await runtime.export(canvas(), 'png', {});
  assert.ok(runtime.lastExportMeta?.designSystem);
  await runtime.export(canvas(), 'png', { embedMeta: false });
  assert.equal(runtime.lastExportMeta, null, 'a thumbnail export leaves no record behind for a shell to stamp');
  const own = { software: 'Lolly', source: 'x', tool: 'T', author: '', contact: '', description: 'd' };
  await runtime.export(canvas(), 'png', { meta: own });
  assert.deepEqual(runtime.lastExportMeta, own, 'a caller\'s own meta is taken as given, with no record added');
  // A copy, so a shell cannot edit the runtime's record by mutating what it read.
  (runtime.lastExportMeta as { tool: string }).tool = 'changed';
  assert.equal(runtime.lastExportMeta!.tool, 'T');
});

test('the CLI labels the shipped design system the way the web shell does', async () => {
  const { shippedSystemLabel } = await import('../shells/cli/src/bridge.ts');
  const { stripTokensSuffix } = await import('../shells/web/src/lib/design-system/registry.ts');
  for (const name of ['Lolly Starter Tokens', 'Acme Brand Tokens', 'SUSE Design Tokens', 'Opal brand design tokens', 'Tokens', 'Acme']) {
    assert.equal(shippedSystemLabel(name), stripTokensSuffix(name), name);
  }
  assert.equal(shippedSystemLabel(undefined), 'Lolly', 'the web shell\'s own fallback for a catalog with no name');
});
