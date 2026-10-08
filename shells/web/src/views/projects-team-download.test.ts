// SPDX-License-Identifier: MPL-2.0
/**
 * views/projects-team-download.ts: "Download as .lolly file" for a shared session hands
 * the builder only the uploads this session uses, and catalog bytes only through the
 * same redistribution answer as the Share dialog, with nothing licensed included.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { BeamAssetRecord } from '../lib/beam-pack.ts';
import { downloadTeamSessionFile, teamSessionLollyInput } from './projects-team-download.ts';

const mine = 'user/upload/mine', other = 'user/upload/other', held = 'lolly/pattern/unmarked';
const record = (id: string): BeamAssetRecord => ({ id, type: 'raster', format: 'png', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), meta: { name: `${id}.png` } }) as BeamAssetRecord;

function fixture() {
  const exported: string[] = [], downloads: Array<{ name: string; size: number }> = [];
  const host = {
    profile: { get: async () => ({}) },
    export: { download: async (blob: Blob, name: string) => { downloads.push({ name, size: blob.size }); } },
    assets: {
      get: async (id: string) => ({ id, type: 'vector', format: 'svg', url: '', meta: { name: 'Unmarked pattern' } }),
      _getBlob: async () => new Blob(['<svg/>'], { type: 'image/svg+xml' }),
      _getUserRecord: async (id: string) => (id === mine || id === other ? record(id) : null),
      _exportUserAssets: async () => { exported.push('all'); return [record(mine), record(other)]; },
    },
  };
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ id: 's1', projectId: 'p', toolId: 'demo-tool', toolVersion: '3', meta: { label: 'Poster' },
    inputs: { photo: { id: mine, source: 'user', type: 'raster', format: 'png', url: '' }, pattern: { id: held, source: 'library', type: 'vector', format: 'svg', url: '' } } });
  return { host: host as unknown as HostV1, exported, downloads, close: () => { globalThis.fetch = original; } };
}

test('the file is built from this session alone, with licensed catalog bytes held back', async () => {
  const f = fixture();
  try {
    const input = await teamSessionLollyInput(f.host, 's1', 'Poster');
    assert.deepEqual(input.userAssets.map(entry => entry.id), [mine], 'only the upload the session uses');
    assert.deepEqual(f.exported, [], 'every upload on the device is never read');
    assert.equal(input.includeLicensed, false);
    assert.equal(input.toolVersion, '3');
    assert.deepEqual({ tool: (input.session as Record<string, unknown>).__toolId, label: (input.session as Record<string, unknown>).__label }, { tool: 'demo-tool', label: 'Poster' });
    const { buildLollyFile } = await import('../lib/lolly-pack.ts');
    const built = await buildLollyFile(input);
    assert.equal(built.summary.assetCount, 1, 'the upload travels');
    assert.equal(built.summary.licensedExcluded, 1, 'the unrecorded catalog work stays behind');
    assert.equal(built.summary.credits, true, 'and CREDITS.txt says why');
  } finally { f.close(); }
});

test('the download hands the finished file to the host, and stops when the view has gone', async () => {
  const f = fixture();
  try {
    await downloadTeamSessionFile(f.host, 's1', 'Poster', () => true);
    assert.equal(f.downloads.length, 1);
    assert.match(f.downloads[0]!.name, /\.lolly$/);
    await downloadTeamSessionFile(f.host, 's1', 'Poster', () => false);
    assert.equal(f.downloads.length, 1);
  } finally { f.close(); }
});
