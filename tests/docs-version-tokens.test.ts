// SPDX-License-Identifier: MPL-2.0
/**
 * Versions are written once (docs/version-tokens.ts).
 *
 * `%work{version}` and `%work{chart}` read docs/manifest.json's workImport, the Work release
 * the guides describe. `%download{<id>}` reads the `version` on a docs/site/downloads.json
 * tile, the same field the landing's "Get the app" rail reads. docs/build.ts expands both
 * for every locale and scripts/export-work-docs.ts expands them for the Work bundle.
 *
 * Checked against the SOURCE, like tests/docs-downloads.test.ts: the built pages are
 * gitignored and only as fresh as the last local build.
 *
 * Run directly: node --test tests/docs-version-tokens.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DOCS_ROOT, readRegistry } from '../docs/navigation.ts';
import { checkVersionFacts, expandVersionTokens, readVersionFacts, type VersionFacts } from '../docs/version-tokens.ts';

const registry = readRegistry();
const facts = readVersionFacts();
const read = (p: string) => readFileSync(resolve(DOCS_ROOT, p), 'utf-8');
type Tile = { id: string; file?: string; version?: string };
const tiles = (JSON.parse(read('docs/site/downloads.json')) as { rows: Array<{ items: Tile[] }> }).rows.flatMap(r => r.items);

test('a token expands to its version, in prose and in code alike', () => {
  const f: VersionFacts = { work: { version: '2.0.0', chart: '0.9.0' }, downloads: { windows: '1.9.0' } };
  assert.equal(expandVersionTokens('Work %work{version}, chart %work{chart}.', f), 'Work 2.0.0, chart 0.9.0.');
  assert.equal(expandVersionTokens('```sh\ncurl -O https://lolli.li/Lolly_%download{windows}_x64-setup.exe\n```', f),
    '```sh\ncurl -O https://lolli.li/Lolly_1.9.0_x64-setup.exe\n```');
  // Other percent-brace text is left alone: curl's write-out and the provenance pills.
  assert.equal(expandVersionTokens("-w '%{http_code}' %entity{Lolly}", f), "-w '%{http_code}' %entity{Lolly}");
});

test('an unknown or misspelt token stops the build and names the file', () => {
  const f: VersionFacts = { work: { version: '2.0.0', chart: '0.9.0' }, downloads: { windows: '1.9.0' } };
  assert.throws(() => expandVersionTokens('%work{app}', f, 'docs/x.md'), /docs\/x\.md: unknown version token %work\{app\}/);
  assert.throws(() => expandVersionTokens('%download{ios}', f), /%download\{ios\}/);
  assert.throws(() => expandVersionTokens('%download{Windows}', f), /%download\{Windows\}/);
  assert.throws(() => expandVersionTokens('%work{ version }', f), /%work\{ version \}/);
});

test('a fact that is not a release version is refused', () => {
  assert.throws(() => checkVersionFacts({ work: { version: '1.1', chart: '0.3.3' }, downloads: {} }), /workImport\.version/);
  assert.throws(() => checkVersionFacts({ work: { version: '1.1.2', chart: '0.3.3' }, downloads: { macos: 'latest' } }), /macos\.version/);
  assert.doesNotThrow(() => checkVersionFacts({ work: { version: '1.2.0-rc.1', chart: '0.4.0' }, downloads: {} }));
});

test('workImport names the newest Work release the docs carry notes for', () => {
  // A release-notes page for a newer Work version than workImport.version means the token
  // (and the Lolly Work source link) still points at the previous release.
  const released = registry.pages.map(p => /^work-release-(\d+)-(\d+)-(\d+)$/.exec(p.slug)).filter(m => m !== null)
    .map(m => m.slice(1, 4).map(Number)).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);
  assert.ok(released.length, 'no work-release-x-y-z page found; the slug pattern has changed');
  assert.equal(registry.workImport.version, released.at(-1)!.join('.'), 'workImport.version is behind the newest Work release notes');
  assert.match(registry.workImport.commit, /^[a-f0-9]{40}$/);
  assert.equal(facts.work.version, registry.workImport.version);
  assert.equal(facts.work.chart, registry.workImport.chart);
});

test('every file download states its version on its tile', () => {
  for (const tile of tiles) {
    if (tile.file) assert.ok(tile.version, `${tile.id}: a tile that hands out a file must say which version it is`);
    if (tile.version) assert.equal(facts.downloads[tile.id], tile.version);
  }
});

test('install.md reads the Mac versions from the downloads source', () => {
  const install = read('docs/install.md');
  for (const id of ['macos', 'macos-intel']) assert.ok(install.includes(`%download{${id}}`), `install.md should state the ${id} version as %download{${id}}`);
  const expanded = expandVersionTokens(install, facts, 'docs/install.md');
  assert.ok(expanded.includes(`version ${facts.downloads.macos} for Apple silicon`));
});

test('every version token in the docs sources resolves', () => {
  // English pages and every locale's sidecars: build.ts expands both, so a stale token in a
  // translation fails as loudly as one in English.
  const sources = registry.pages.map(p => 'docs/' + p.src);
  const i18n = join(DOCS_ROOT, 'docs/i18n');
  for (const lang of readdirSync(i18n, { withFileTypes: true }).filter(d => d.isDirectory())) {
    for (const p of registry.pages) {
      const sidecar = join('docs/i18n', lang.name, p.src);
      if (existsSync(resolve(DOCS_ROOT, sidecar))) sources.push(sidecar);
    }
  }
  let tokens = 0;
  for (const src of sources) {
    const md = read(src);
    tokens += (md.match(/%(?:work|download)\{/g) ?? []).length;
    assert.doesNotThrow(() => expandVersionTokens(md, facts, src));
  }
  assert.ok(tokens > 0, 'no version token found anywhere; the scan is not reading the pages');
});
