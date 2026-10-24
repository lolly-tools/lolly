/**
 * Links that name a Markdown source file reach the page published from that file.
 *
 * The /info pages are served as <door>/<slug>.html with a raw <slug>.md twin beside each
 * one, so a link written as `create-a-tool.md` (the form GitHub follows, used by the
 * README and the guides) opened the raw Markdown when both pages shared a door and a
 * 404 when they did not. Twenty pages and all 26 locale copies of each shipped that way.
 * The build now maps such a link to the published page, or to GitHub for a repository
 * file the site does not publish (docs/doc-links.ts), and refuses to finish while a
 * relative .md link or a link into plans/ remains. plans/ is gitignored, so every link
 * into it 404s for every reader.
 *
 * The resolver and the audit are pinned here without a build. The built-site check reads
 * the output of `pnpm run build:info` (gitignored) and skips when that build is absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pointsIntoPlans, resolveSourceLink, unpublishedLinks, type LinkablePage } from '../docs/doc-links.ts';
import { readRegistry } from '../docs/navigation.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = join(ROOT, 'shells/web/public/info');

const PAGES: LinkablePage[] = [
  { src: 'create-a-tool.md', path: 'create/create-a-tool' },
  { src: 'url-mode.md', path: 'build/url-mode' },
  { src: 'work/governance.md', path: 'manage/governance' },
  { src: 'work/providers/README.md', path: 'manage/provider-guides' },
  { src: '../README.md', path: 'start/about' },
];
const REPO_FILES = new Set(['CONTRIBUTING.md', 'engine/README.md', 'plans/73-cli-ga-contract.md']);
const resolveFrom = (url: string, fromSrc: string): string | null =>
  resolveSourceLink(url, fromSrc, { pages: PAGES, repoFile: (path) => REPO_FILES.has(path) });

test('a link to a registered source becomes the published page, anchor kept', () => {
  assert.equal(resolveFrom('create-a-tool.md', 'templates.md'), '/info/create/create-a-tool.html');
  assert.equal(resolveFrom('./create-a-tool.md#rules', 'templates.md'), '/info/create/create-a-tool.html#rules');
  assert.equal(resolveFrom('work/governance.md#policy-as-code', 'overview.md'), '/info/manage/governance.html#policy-as-code');
  assert.equal(resolveFrom('../README.md#licensing', 'overview.md'), '/info/start/about.html#licensing');
});

test('the README links from the repository root, the way GitHub follows its links', () => {
  assert.equal(resolveFrom('docs/url-mode.md', '../README.md'), '/info/build/url-mode.html');
  assert.equal(resolveFrom('docs/create-a-tool.md', '../README.md'), '/info/create/create-a-tool.html');
});

test('a Work guide resolves a sibling from its own directory', () => {
  assert.equal(resolveFrom('governance.md#policy-as-code', 'work/catalog.md'), '/info/manage/governance.html#policy-as-code');
  assert.equal(resolveFrom('providers/README.md', 'work/catalog.md'), '/info/manage/provider-guides.html');
  assert.equal(resolveFrom('../governance.md', 'work/providers/penpot.md'), '/info/manage/governance.html');
});

test('a target written as a registry source resolves from any page', () => {
  assert.equal(resolveFrom('docs/url-mode.md', 'overview.md'), '/info/build/url-mode.html');
});

test('a repository file the site does not publish becomes its GitHub URL on main', () => {
  assert.equal(resolveFrom('../engine/README.md', 'overview.md'), 'https://github.com/lolly-tools/lolly/blob/main/engine/README.md');
  assert.equal(resolveFrom('CONTRIBUTING.md', '../README.md'), 'https://github.com/lolly-tools/lolly/blob/main/CONTRIBUTING.md');
  assert.equal(resolveFrom('../CONTRIBUTING.md#tests', 'ci-qualification.md'), 'https://github.com/lolly-tools/lolly/blob/main/CONTRIBUTING.md#tests');
});

test('nothing else is rewritten', () => {
  // A plans/ file exists on the maintainer's machine, but plans/ is never published.
  assert.equal(resolveFrom('../plans/73-cli-ga-contract.md', 'cli.md'), null);
  // A file that is not in the repository, or a path that leaves the repository.
  assert.equal(resolveFrom('missing.md', 'cli.md'), null);
  assert.equal(resolveFrom('../../outside.md', 'cli.md'), null);
  // Not a relative .md link.
  for (const url of ['/info/create-a-tool.html', 'https://example.com/a.md', '#create-a-tool', 'mailto:a@b.c', 'notes.txt', 'docs/']) {
    assert.equal(resolveFrom(url, 'cli.md'), null, url);
  }
});

test('the link audit names relative .md links and links into plans/', () => {
  const html = [
    '<a href="create-a-tool.md">a</a>',
    '<a href="../CONTRIBUTING.md#tests">b</a>',
    '<a href="https://github.com/lolly-tools/lolly/blob/main/plans/73-cli-ga-contract.md">c</a>',
    '<a href="https://github.com/lolly-tools/lolly-work/blob/7f2be8c/plans/30-penpot.md">d</a>',
    '<a href="../../plans/30-penpot.md">e</a>',
    '<a href="/info/plans/x.html">f</a>',
  ].join('');
  assert.deepEqual(unpublishedLinks(html), [
    'create-a-tool.md',
    '../CONTRIBUTING.md#tests',
    'https://github.com/lolly-tools/lolly/blob/main/plans/73-cli-ga-contract.md',
    'https://github.com/lolly-tools/lolly-work/blob/7f2be8c/plans/30-penpot.md',
    '../../plans/30-penpot.md',
    '/info/plans/x.html',
  ]);
  const fine = [
    '<a href="/info/create/create-a-tool.html#rules">a</a>',
    '<link rel="alternate" type="text/markdown" href="https://lolly.tools/info/create/templates.md">',
    '<a href="/info/agent-instructions.md">b</a>',
    '<a href="https://github.com/lolly-tools/lolly/blob/main/SECURITY.md">c</a>',
    '<a href="https://example.com/pricing/plans/">d</a>',
    '<a href="#plans">e</a>',
    '<code>href="create-a-tool.md"</code>',
  ].join('');
  assert.deepEqual(unpublishedLinks(fine), []);
});

test('no registered page source or translation links into plans/', () => {
  const registry = readRegistry(ROOT);
  const sources = registry.pages.map((page) => join(ROOT, 'docs', page.src));
  const i18n = join(ROOT, 'docs/i18n');
  for (const lang of readdirSync(i18n, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue;
    for (const f of readdirSync(join(i18n, lang.name))) if (f.endsWith('.md')) sources.push(join(i18n, lang.name, f));
  }
  const found: string[] = [];
  for (const file of sources) {
    let fenced = false;
    readFileSync(file, 'utf-8').split('\n').forEach((line, n) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (fenced) return;
      for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (pointsIntoPlans(m[1]!)) found.push(`${file.slice(ROOT.length + 1)}:${n + 1} ${m[1]}`);
      }
    });
  }
  assert.deepEqual(found, [], `plans/ is gitignored, so these links 404 for every reader:\n${found.join('\n')}`);
});

const skip = !existsSync(join(BUILT, 'create', 'using.html')) ? 'no built /info on disk - run `pnpm run build:info`' : false;

/** Every built HTML page: English and every locale, door pages, side doors and spec chapters. */
function builtPages(dir = BUILT, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) builtPages(path, out);
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

test('no built docs page links a relative .md target or into plans/', { skip }, () => {
  const found: string[] = [];
  for (const file of builtPages()) {
    const html = readFileSync(file, 'utf-8');
    // Most pages carry neither form; the substring test spares them the attribute scan.
    if (!html.includes('.md') && !html.includes('plans/')) continue;
    for (const href of unpublishedLinks(html)) found.push(`${file.slice(BUILT.length + 1)}: ${href}`);
  }
  assert.deepEqual(found.slice(0, 40), [], `${found.length} built links a reader cannot open`);
});
