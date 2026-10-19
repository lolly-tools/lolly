// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal app's bulk exports and the design-system record (plans/319).
 *
 * The record is approved on the condition that it is visible at the moment of
 * export. A CSV batch, a Projects folder or selection export and the Profile
 * view's render-everything show no Design system row, so their files must carry
 * no `lolly:` properties, the same rule the web shell's Pro batches follow.
 *
 * Over a fixture catalog that ships one design system, so a single export from the
 * tool view would record it; the bulk paths below must not.
 *
 * Run with: node --test shells/tui/src/batch-export-record.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, copyFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const root = await mkdtemp(join(tmpdir(), 'lolly-tui-batch-record-'));
after(() => rm(root, { recursive: true, force: true }));

const TOOL_ID = 'vector-mark';
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets', 'lolly', 'tokens'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({ version: '1', tools: [{ id: TOOL_ID }] }));
await copyFile(join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'tokens', 'brand.json'), join(root, 'catalog', 'assets', 'lolly', 'tokens', 'brand.json'));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [{
  id: 'lolly/tokens/brand', name: 'Acme Brand Tokens', type: 'tokens', version: '1.0.0', tier: 'core', tags: [],
  formats: [{ format: 'json', url: '/catalog/assets/lolly/tokens/brand.json' }],
}] }));
await mkdir(join(root, 'tools', TOOL_ID), { recursive: true });
await writeFile(join(root, 'tools', TOOL_ID, 'tool.json'), JSON.stringify({
  id: TOOL_ID, name: 'Vector Mark', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: 120, height: 80, formats: ['svg'], c2pa: false },
  inputs: [{ id: 'shade', type: 'color', label: 'Shade', default: '#3cb44b' }],
}));
await writeFile(join(root, 'tools', TOOL_ID, 'template.html'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><rect width="120" height="80" fill="{{shade}}"/></svg>');
process.env.LOLLY_ROOT = root;
process.env.LOLLY_STATE_DIR = join(root, 'state');

const { createTuiBridge } = await import('./bridge.ts');
const { exportBatchRows, exportSessions } = await import('./batch-export.ts');
const { mountTool, exportToFile } = await import('./engine-render.ts');
const { host, dom } = await createTuiBridge({});
const outDir = join(root, 'out');
await mkdir(outDir, { recursive: true });

/** Every SVG member of a written zip, as text. */
async function svgMembers(zipPath: string): Promise<string[]> {
  const files = unzipSync(new Uint8Array(await readFile(zipPath)));
  return Object.entries(files).filter(([name]) => name.endsWith('.svg')).map(([, bytes]) => new TextDecoder().decode(bytes));
}

test('a single export from the tool view records the fixture design system', async () => {
  // The control: without it, an empty record below would prove nothing.
  const { runtime, manifest } = await mountTool(TOOL_ID, host, 'shade=%23ff0000');
  const out = join(outDir, 'single.svg');
  await exportToFile(runtime, dom, manifest, 'svg', out, { unit: 'px', dpi: 300, madeWith: true });
  assert.match(await readFile(out, 'utf8'), /<lolly:DesignSystemLabel>Acme<\/lolly:DesignSystemLabel>/);
});

test('a CSV batch writes no design-system record into its members', async () => {
  const res = await exportBatchRows(host, dom, [{ toolId: TOOL_ID, params: { shade: '#ff0000' }, format: 'svg' } as never], { outDir, name: 'csv-batch' });
  const svgs = await svgMembers(res.zipPath);
  assert.equal(svgs.length, 1);
  assert.equal(svgs[0]!.includes('lolly:'), false, 'no lolly: properties in a batch member');
});

test('a saved-session export (Projects selection, Profile render-everything) writes no record either', async () => {
  const session = { slot: 's1', toolId: TOOL_ID, label: 'Red mark', query: 'shade=%23ff0000', updatedAt: new Date().toISOString(), data: {} };
  const res = await exportSessions(host, dom, [session as never], { outDir, name: 'selection', format: 'svg' });
  const svgs = await svgMembers(res.zipPath);
  assert.equal(svgs.length, 1);
  assert.equal(svgs[0]!.includes('lolly:'), false, 'no lolly: properties in a session member');
});
