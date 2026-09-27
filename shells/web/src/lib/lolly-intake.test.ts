// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import {
  classifyLollyManifest,
  lollyBytesLabel,
  lollySizeBand,
  peekLollyFile,
} from './lolly-intake.ts';

test('classifies a shared session by manifest capabilities, not its screen or name', () => {
  const preview = classifyLollyManifest(
    {
      format: 'lolly-share',
      kind: 'session',
      counts: { assets: 3, byReference: 1, bytes: 2048 },
      tool: { id: 'poster' },
      bundledTool: { files: [{ path: 'tool/tool.json' }, { path: 'tool/hooks.js' }] },
      designSystem: { label: 'Acme' },
      fonts: [{ family: 'Inter' }],
      creator: { name: 'Ada' },
    },
    'handoff.lolly',
    12 * 1024 * 1024
  );
  assert.equal(preview.kind, 'session');
  if (preview.kind !== 'session') return;
  assert.equal(preview.toolId, 'poster');
  assert.equal(preview.embeddedAssets, 3);
  assert.equal(preview.referencedAssets, 1);
  assert.equal(preview.includesTool, true);
  assert.equal(preview.toolFiles, 2);
  assert.equal(preview.includesDesignSystem, true);
  assert.equal(preview.designSystemLabel, 'Acme');
  assert.equal(preview.sizeBand, 'medium');
});

test('distinguishes an instance pack from a plain design-system pack', () => {
  const brand = classifyLollyManifest(
    {
      format: 'lolly-brand',
      label: 'Acme',
      counts: { tokens: true, fontFiles: 2, logos: 1 },
    },
    'anything.lolly',
    1200
  );
  assert.equal(brand.kind, 'brand');

  const instance = classifyLollyManifest(
    {
      format: 'lolly-brand',
      label: 'Studio',
      counts: { tokens: true },
      pack: {
        kind: 'instance-pack',
        name: 'Studio',
        toolCount: 8,
        assetCount: 42,
        instance: 'https://studio.example',
      },
    },
    'brand.lolly',
    1200
  );
  assert.equal(instance.kind, 'instance');
  if (instance.kind !== 'instance') return;
  assert.equal(instance.tools, 8);
  assert.equal(instance.catalogAssets, 42);
  assert.equal(instance.instance, 'https://studio.example');
});

test('brand collection preview names its local content without calling it an instance pack', () => {
  const preview = classifyLollyManifest({ format: 'lolly-brand', label: 'Acme', contents: { sessions: 2, assets: 3, tools: 1 } }, 'acme.lolly', 1000);
  assert.equal(preview.kind, 'brand');
  if (preview.kind !== 'brand') return;
  assert.equal(preview.localSessions, 2); assert.equal(preview.localAssets, 3); assert.equal(preview.localTools, 1);
});

test('streams just manifest.json from a real .lolly zip', async () => {
  const zipped = zipSync({
    'large.bin': new Uint8Array(2 * 1024 * 1024),
    'manifest.json': strToU8(
      JSON.stringify({
        format: 'lolly-share',
        kind: 'session',
        counts: { assets: 0, byReference: 0, bytes: 0 },
        tool: { id: 'chart' },
      })
    ),
    'session.json': strToU8('{}'),
  });
  const file = new File([zipped as BlobPart], 'chart.lolly', { type: 'application/vnd.lolly+zip' });
  const preview = await peekLollyFile(file);
  assert.equal(preview.kind, 'session');
  assert.equal(preview.label, 'chart');
});

test('size bands and byte labels keep the large-file policy visible', () => {
  assert.equal(lollySizeBand(10 * 1024 * 1024), 'small');
  assert.equal(lollySizeBand(10 * 1024 * 1024 + 1), 'medium');
  assert.equal(lollySizeBand(100 * 1024 * 1024 + 1), 'large');
  assert.equal(lollyBytesLabel(12 * 1024 * 1024), '12 MB');
});

// plans/277 P13: a copy Sync wrote (`snapshot.lolly`, `day-N.lolly`,
// `before-apply.lolly`) holds the backup bundle. It used to be refused here; it now
// previews as an import into this device, and never as a shared design.
test('a Sync copy previews as an import of this person’s data, not as a design', () => {
  const preview = classifyLollyManifest(
    { format: 'lolly-backup', formatVersion: 3, minReader: 1, exportedAt: '2026-09-27T08:30:00.000Z', counts: { sessions: 4, userAssets: 2 } },
    'day-3.lolly',
    2048
  );
  assert.equal(preview.kind, 'backup');
  if (preview.kind !== 'backup') return;
  assert.equal(preview.encrypted, false);
  assert.equal(preview.label, 'day-3');
  assert.equal(preview.exportedAt, '2026-09-27T08:30:00.000Z');
  assert.equal(preview.sessions, 4);
  assert.equal(preview.userAssets, 2);
});

test('peekLollyFile reads a real Sync copy from the engine’s writer, plain and encrypted', async () => {
  const { buildSnapshot } = await import('./sync-engine.ts');
  const sessions = new Map<string, unknown>([['s1', { v: 1 }], ['s2', { v: 2 }]]);
  const host = {
    profile: { async get() { return { firstname: 'Ada' }; }, async set() {} },
    state: {
      async list() { return [...sessions.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sessions.get(slot) ?? null; },
      async save() {},
    },
    assets: { async _exportUserAssets() { return []; }, async _importUserAsset() {} },
  };
  const storage = { getItem: () => null, setItem: () => {} };

  const plain = (await buildSnapshot({ host: host as never, storage })).bytes;
  const copy = await peekLollyFile(new File([plain as BlobPart], 'snapshot.lolly', { type: 'application/vnd.lolly+zip' }));
  assert.equal(copy.kind, 'backup');
  if (copy.kind !== 'backup') return;
  assert.equal(copy.encrypted, false);
  assert.equal(copy.sessions, 2);
  assert.ok(copy.exportedAt);

  // Encrypted with the sync passphrase: not a zip at all, recognised by its header.
  const locked = (await buildSnapshot({ host: host as never, storage }, { passphrase: 'correct horse' })).bytes;
  const sealed = await peekLollyFile(new File([locked as BlobPart], 'lolly-sync.lolly'));
  assert.equal(sealed.kind, 'backup');
  if (sealed.kind !== 'backup') return;
  assert.equal(sealed.encrypted, true);
  assert.equal(sealed.label, 'lolly-sync');
  assert.equal(sealed.manifest, null, 'nothing inside is read before it is unlocked');
  assert.equal(sealed.fileBytes, locked.length);
});

test('a .lolly that is neither a zip nor a Sync copy is still refused', async () => {
  await assert.rejects(
    peekLollyFile(new File([strToU8('not a zip, not LSE1')], 'odd.lolly')),
    /manifest\.json is missing|does not look like a \.lolly file/
  );
});
