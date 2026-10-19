// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly validate <artifact> --rebuild <session.lolly>` over a catalog that ships a
 * design system (plans/319), so a default export records that system.
 *
 * A file exported with the record off (`--no-madewith`, `_madewith=0`, or the web
 * card unticked) carries no record. The rebuild has to leave the record out too, or
 * the same inputs on the same machine come back DIFFERENT, with a `content` reason
 * that points at the `lolly:` namespace rather than at anything the person changed.
 *
 * Its own file because the fixture differs from tests/reproducibility-rebuild.test.ts
 * (one tokens asset), and LOLLY_ROOT has to be pinned before the first import.
 *
 * Run with: node --test tests/reproducibility-rebuild-record.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLollyFile } from '../shells/web/src/lib/lolly-pack.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const root = await mkdtemp(join(tmpdir(), 'lolly-rebuild-record-'));
after(() => rm(root, { recursive: true, force: true }));

const TOOL_ID = 'vector-mark';
const TEMPLATE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">' +
  '<rect x="4" y="4" width="112" height="72" fill="{{shade}}"/></svg>';
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets', 'lolly', 'tokens'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({ version: '1', tools: [{ id: TOOL_ID }] }));
await copyFile(join(HERE, '..', 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'tokens', 'brand.json'),
  join(root, 'catalog', 'assets', 'lolly', 'tokens', 'brand.json'));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [{
  id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens', type: 'tokens', version: '1.0.0', tier: 'core', tags: [],
  formats: [{ format: 'json', url: '/catalog/assets/lolly/tokens/brand.json' }],
}] }));
await mkdir(join(root, 'tools', TOOL_ID), { recursive: true });
await writeFile(join(root, 'tools', TOOL_ID, 'tool.json'), JSON.stringify({
  id: TOOL_ID, name: TOOL_ID, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: 120, height: 80, formats: ['svg', 'dxf'] },
  inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
}));
await writeFile(join(root, 'tools', TOOL_ID, 'template.html'), TEMPLATE);

process.env.LOLLY_ROOT = root;
process.env.LOLLY_STATE_DIR = join(root, 'state');
const { runToolCli } = await import('../shells/cli/src/run.ts');
const { rebuildSession } = await import('../shells/cli/src/rebuild.ts');

let seq = 0;
async function render(format: string, params: Record<string, string> = {}): Promise<string> {
  const out = join(root, `artifact-${seq++}.${format}`);
  await runToolCli({ toolId: TOOL_ID, params: { 'no-provenance': '1', ...params }, outputPath: out, format });
  return out;
}

async function writeLolly(name: string): Promise<string> {
  const { blob } = await buildLollyFile({
    session: { __toolId: TOOL_ID, __toolVersion: '1.0.0', __export_format: 'svg', shade: '#3cb44b' },
    toolId: TOOL_ID, toolVersion: '1.0.0', userAssets: [],
  });
  const path = join(root, name);
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}

test('with the record on, the SVG names the design system and rebuilds IDENTICAL', async () => {
  const artifact = await render('svg');
  assert.match(await readFile(artifact, 'utf8'), /<lolly:DesignSystem>/, 'the fixture system is recorded');
  const report = await rebuildSession(artifact, await writeLolly('on.lolly'));
  assert.equal(report.identical, true, `expected IDENTICAL, got ${JSON.stringify(report.reasons)}`);
});

test('an SVG exported with --no-madewith rebuilds IDENTICAL, with no record written', async () => {
  const artifact = await render('svg', { 'no-madewith': '1' });
  assert.equal((await readFile(artifact, 'utf8')).includes('lolly:'), false, 'the artifact carries no record');
  const report = await rebuildSession(artifact, await writeLolly('off.lolly'));
  assert.equal(report.identical, true, `expected IDENTICAL, got ${JSON.stringify(report.reasons)}`);
  assert.deepEqual(report.reasons, []);
});

test('a format whose bytes hold no record is rebuilt as before (dxf)', async () => {
  // Nothing in a DXF says whether the record was on, so the rebuild keeps the default.
  for (const params of [{}, { 'no-madewith': '1' }] as Record<string, string>[]) {
    const artifact = await render('dxf', params);
    const report = await rebuildSession(artifact, await writeLolly(`dxf-${seq}.lolly`));
    assert.equal(report.identical, true, `expected IDENTICAL, got ${JSON.stringify(report.reasons)}`);
  }
});
