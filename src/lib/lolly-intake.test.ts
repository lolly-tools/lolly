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

test('device backups are kept out of the .lolly intake family', () => {
  assert.throws(
    () => classifyLollyManifest({ format: 'lolly-backup' }, 'backup.lolly', 10),
    /Profile → Storage/
  );
});
