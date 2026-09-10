// SPDX-License-Identifier: MPL-2.0
/**
 * Sharing a template as a `.lolly` (plans/226 WP-6) - the outbound half of the file
 * whose inbound half drop-router-templates.test.ts covers. Headless: the host is the
 * three slices the share touches (assets, profile, export), so what is asserted is the
 * file that would have hit the person's Downloads folder.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { readLollyFile } from './lolly-pack.ts';
import { shareTemplateAsLolly, templateLollyName, templateSessionOf } from './template-share.ts';
import type { UserTemplate } from './user-templates.ts';

const TEMPLATE: UserTemplate = {
  id: 'ut-1',
  toolId: 'chart',
  name: 'Quarterly bars',
  description: 'The house chart',
  values: { title: 'Q3', __export_format: 'svg' },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

interface Delivered { blob: Blob; filename?: string }

function shareHost(opts: {
  profile?: Record<string, unknown>;
  blobs?: Record<string, { blob: Blob; meta?: Record<string, unknown>; format?: string; type?: string }>;
} = {}) {
  const out: { delivered: Delivered | null } = { delivered: null };
  const host = {
    assets: {
      _exportUserAssets: async () => [],
      _getBlob: async (id: string) => opts.blobs?.[id]?.blob ?? null,
      get: async (id: string) => {
        const row = opts.blobs?.[id];
        if (!row) throw new Error('unknown asset');
        return { id, type: row.type ?? 'vector', format: row.format ?? 'svg', url: '', meta: row.meta ?? {} };
      },
    },
    profile: { get: async () => opts.profile ?? {} },
    export: {
      file: async (blob: Blob, o?: { filename?: string }) => { out.delivered = { blob, filename: o?.filename }; },
    },
  };
  return { host: host as unknown as HostV1, out };
}

test('a shared template travels as both a template and an openable document', async () => {
  const { host, out } = shareHost({ profile: { firstname: 'Ada', lastname: 'L', useDetails: true } });
  await shareTemplateAsLolly(host, TEMPLATE);

  const delivered = out.delivered!;
  assert.ok(delivered, 'the file was handed to the host download path');
  assert.equal(delivered.filename, 'chart-quarterly-bars.lolly', 'named <toolId>-<slug>.lolly');
  assert.equal(templateLollyName(TEMPLATE), delivered.filename);

  const parsed = await readLollyFile(new Uint8Array(await delivered.blob.arrayBuffer()));
  assert.deepEqual(parsed.templates, [TEMPLATE], 'the record travels verbatim in templates.json');
  assert.deepEqual(parsed.session, { title: 'Q3', __export_format: 'svg', __toolId: 'chart', __label: 'Quarterly bars' },
    'and as a session, so a build without the part still opens something real');
  assert.equal(parsed.manifest.tool.id, 'chart');
  assert.deepEqual(parsed.manifest.templates, { count: 1 });
  assert.equal(parsed.manifest.minReader, 1);
  assert.equal(parsed.manifest.creator?.name, 'Ada L', 'the identity opt-in is honoured');
});

test('without the details opt-in a shared template carries no identity', async () => {
  const { host, out } = shareHost({ profile: { firstname: 'Ada', lastname: 'L', email: 'ada@x.io' } });
  await shareTemplateAsLolly(host, TEMPLATE);
  const parsed = await readLollyFile(new Uint8Array(await out.delivered!.blob.arrayBuffer()));
  assert.equal(parsed.manifest.creator?.name, undefined);
  assert.equal(parsed.manifest.creator?.email, undefined);
  assert.ok(parsed.manifest.creator?.createdWith.startsWith('Lolly '), 'the non-personal "made with" line still travels');
});

test('brand-locked catalog art a template points at never rides along', async () => {
  const open = new Blob([new Uint8Array([60, 115, 118, 103, 62])], { type: 'image/svg+xml' });
  const locked = new Blob([new Uint8Array([66, 82, 65, 78, 68])], { type: 'image/svg+xml' });
  const { host, out } = shareHost({
    blobs: {
      'lolly-start/pattern/waves': { blob: open, meta: { name: 'Waves' } },
      'suse/logo/primary': { blob: locked, meta: { name: 'SUSE Logo', brandLock: true } },
    },
  });
  await shareTemplateAsLolly(host, {
    ...TEMPLATE,
    values: {
      bg: { source: 'library', id: 'lolly-start/pattern/waves', url: '' },
      mark: { source: 'library', id: 'suse/logo/primary', url: '' },
    },
  });
  const parsed = await readLollyFile(new Uint8Array(await out.delivered!.blob.arrayBuffer()));
  const byId = Object.fromEntries(parsed.manifest.assets.map(a => [a.id, a]));
  assert.equal(byId['lolly-start/pattern/waves']!.kind, 'asset', 'ordinary catalog art carries its bytes');
  assert.equal(byId['suse/logo/primary']!.kind, 'asset-ref', 'the brand-locked mark stays home');
  assert.equal(byId['suse/logo/primary']!.licensed, true);
});

test('templateSessionOf copies the seed rather than aliasing the stored record', () => {
  const session = templateSessionOf(TEMPLATE) as { title: string };
  session.title = 'edited';
  assert.equal(TEMPLATE.values.title, 'Q3', 'the profile record is untouched');
});

test('a template with no tool id refuses with a readable message', async () => {
  const { host } = shareHost();
  await assert.rejects(
    () => shareTemplateAsLolly(host, { ...TEMPLATE, toolId: '' }),
    /incomplete/,
  );
});
