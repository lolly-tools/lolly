// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_ROOT, readRegistry, validateRegistry } from '../docs/navigation.ts';
import { publicWorkMarkdown } from '../docs/work-pages.ts';
import { buildWorkBundle, sha256 } from '../scripts/export-work-docs.ts';
import { syncDocsNavigation } from '../scripts/sync-docs-navigation.ts';

const registry = readRegistry();
const page = (slug: string) => registry.pages.find(p => p.slug === slug)!;

test('the approved sections share one generated registry and canonical entrance', () => {
  assert.deepEqual(registry.sections.map(s => s.title), ['Start here', 'Create & use', 'Build & automate', 'Manage an organisation', 'Deploy & operate', 'Trust & security']);
  assert.equal(registry.sectionSubtitles, false);
  assert.equal(registry.canonical, 'https://lolly.tools/info');
  syncDocsNavigation(DOCS_ROOT, true);
  const duplicate = structuredClone(registry);
  duplicate.pages[1]!.aliases.push(registry.pages[0]!.path);
  assert.throws(() => validateRegistry(duplicate), /overwrite/);
});

test('all imported Work guides keep their console identities and original screenshot bytes', () => {
  const bundle = buildWorkBundle();
  const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: DOCS_ROOT, encoding: 'utf8' }).trim().split('\n'));
  for (const source of Object.values(bundle.sourcePaths)) assert.ok(tracked.has(source), source + ' must ship in a plain clone');
  const guides = registry.pages.filter(p => p.work);
  assert.equal(guides.length, 66);
  const index = JSON.parse(bundle.files['docs.json']!.toString());
  const entries = index.sections.flatMap((s: { docs: Array<{ slug: string; path: string }> }) => s.docs);
  assert.deepEqual(entries.map((p: { slug: string }) => p.slug).sort(), guides.map(p => p.work!.slug).sort());
  for (const p of guides) assert.ok(bundle.files[p.work!.path]!.equals(readFileSync(join(DOCS_ROOT, 'docs', p.src))), p.work!.path);
  for (const [path, entry] of Object.entries(registry.workImport.files)) {
    if (/\.(svg|pem)$/.test(path)) assert.equal(sha256(bundle.files[path]!), entry.sha256, path);
  }
});

test('public Work links resolve relative guides, assets, fragments and instance routes', () => {
  const provider = page('work-provider-gdrive');
  const markdown = '[setup](../install.md?mode=demo#9-connect-a-source)\n![shot](../shots/provider-gdrive-setup.svg)\n[console](/admin#/providers)\n```sh\n[unchanged](../install.md)\n```';
  const publicText = publicWorkMarkdown(markdown, provider, registry);
  assert.ok(publicText.includes(`/info/${page('work-install').path}.html?mode=demo#9-connect-a-source`));
  assert.ok(publicText.includes('/info/shots/work/provider-gdrive-setup.svg'));
  assert.ok(publicText.includes('`/admin#/providers` on your Work instance'));
  assert.ok(publicText.includes('[unchanged](../install.md)'));
  assert.ok(publicWorkMarkdown('[guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md#first)', page('deployment'), registry).includes(`/info/${page('work-install').path}.html#first`));
});

test('built public pages retain old HTML and Markdown paths and copied Work assets', t => {
  const output = join(DOCS_ROOT, 'shells/web/public/info');
  if (!existsSync(join(output, 'agents.md'))) { t.skip('Run build:info to inspect generated pages.'); return; }
  const renderManifest = JSON.parse(readFileSync(join(output, 'docs-render-manifest.json'), 'utf8'));
  for (const [path] of Object.entries(registry.workImport.files)) if (path.startsWith('shots/') && path.endsWith('.svg')) {
    const image = '/info/shots/work/' + path.slice(6);
    assert.equal(renderManifest.credentials[image]?.src, image);
    assert.ok(renderManifest.sizes[image]?.w > 0);
  }
  const llms = readFileSync(join(output, 'llms.txt'), 'utf8');
  for (const p of registry.pages) {
    const html = readFileSync(join(output, p.path + '.html'), 'utf8');
    assert.ok(html.includes(`href="/info/${p.slug}.c2pa"`), p.slug + ' keeps its signed identity');
    if (p.headingId) assert.ok(html.includes(`id="${p.headingId}"`), p.slug + ' keeps its heading anchor');
    assert.ok(existsSync(join(output, p.path + '.md')), p.path + '.md');
    if (!p.isLanding) assert.ok(llms.includes('/' + p.path + '.md'), p.slug);
    for (const alias of p.aliases) {
      assert.ok(readFileSync(join(output, alias + '.html'), 'utf8').includes('/info/' + p.path + '.html'), alias);
      assert.ok(existsSync(join(output, alias + '.md')), alias + '.md');
      assert.ok(existsSync(join(output, 'de', alias + '.html')), 'de/' + alias);
    }
  }
  for (const [path, source] of Object.entries(registry.workImport.files)) {
    if (path.startsWith('shots/') && /\.(svg|pem)$/.test(path)) assert.ok(readFileSync(join(output, 'shots/work', path.slice(6))).equals(readFileSync(join(DOCS_ROOT, 'docs', source.source))), path);
  }
});
