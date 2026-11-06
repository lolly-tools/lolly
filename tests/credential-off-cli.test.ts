// SPDX-License-Identifier: MPL-2.0
/**
 * The real CLI, with `--c2pa=off` and `--no-provenance`, on a fixture tool whose own template
 * inlines a credentialed logo, and what a render with no setting does on the same tool.
 *
 * Hermetic: a fixture repo pinned via LOLLY_ROOT with no built shell, so the browser-free path
 * answers. The root is pinned before the shell is imported, because the content resolver reads
 * it once per process.
 *
 * Run: node --test tests/credential-off-cli.test.ts
 */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';

const root = await mkdtemp(join(tmpdir(), 'lolly-credential-off-'));
after(() => rm(root, { recursive: true, force: true }));
process.env.LOLLY_ROOT = root;
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;

const { embedC2pa, verifyC2pa } = await import('../engine/src/index.ts');
const STAMP = { title: 'Logo', claimGenerator: 'LollyTest/1.0', dates: { created: '2026-01-01T00:00:00Z' } } as never;
const signedLogo = new TextDecoder().decode(await embedC2pa(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>'), 'svg', STAMP));
const LOGO_MANIFEST = /<c2pa:manifest[^>]*>[^<]*<\/c2pa:manifest>/.exec(signedLogo)![0];

const TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100" height="60"><svg x="1" y="1" width="20" height="20"><metadata id="logo-metadata">${LOGO_MANIFEST}</metadata><rect width="4" height="4"/></svg><text>{{label}}</text></svg>`;
function manifest(id: string, render: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 100, height: 60, formats: ['svg'], ...render },
    inputs: [{ id: 'label', type: 'text', label: 'Label', default: 'Kept words' }],
  });
}
await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({ version: '1', tools: [{ id: 'logo-page' }, { id: 'logo-page-unstamped' }] }));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
for (const [id, render] of [['logo-page', {}], ['logo-page-unstamped', { c2pa: false }]] as Array<[string, Record<string, unknown>]>) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), manifest(id, render));
  await writeFile(join(root, 'tools', id, 'template.html'), TEMPLATE);
}
const { stripSvgC2pa } = await import('../packages/node-shell/src/lolly-file.ts');
const { runToolCli } = await import('../shells/cli/src/run.ts');

async function run(toolId: string, params: Record<string, string>, name: string): Promise<Uint8Array> {
  const out = join(root, name);
  await runToolCli({ toolId, params, outputPath: out, format: 'svg' });
  return new Uint8Array(await readFile(out));
}
const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

test('CLI: --c2pa=off and --no-provenance leave no manifest, and the words and metadata stay', async () => {
  for (const [name, params] of [['off.svg', { c2pa: 'off' }], ['bare.svg', { 'no-provenance': '1' }]] as Array<[string, Record<string, string>]>) {
    const bytes = await run('logo-page', params, name);
    assert.equal((await verifyC2pa(bytes)).state, 'none', name);
    assert.equal(text(bytes).includes('<c2pa:manifest'), false, name);
    assert.ok(text(bytes).includes('Kept words'), name);
    assert.ok(text(bytes).includes('<metadata id="logo-metadata">'), name);
  }
});

test('CLI: a render with no c2pa argument keeps its bytes, on a tool that stamps and a tool that does not', async () => {
  for (const toolId of ['logo-page', 'logo-page-unstamped']) {
    const plain = await run(toolId, {}, `${toolId}-plain.svg`);
    // The inlined element is untouched and stays where the template put that element.
    assert.ok(text(plain).includes(LOGO_MANIFEST), toolId);
    assert.ok(text(plain).indexOf(LOGO_MANIFEST) > text(plain).indexOf('<metadata id="logo-metadata">'), toolId);
    // The opt-out takes that out and changes nothing else, so the two differ by the credential alone.
    assert.equal(stripSvgC2pa(text(plain)), text(await run(toolId, { c2pa: 'off' }, `${toolId}-off.svg`)), toolId);
    assert.equal(text(plain), text(await run(toolId, {}, `${toolId}-again.svg`)), `${toolId}: the same both times`);
  }
});
