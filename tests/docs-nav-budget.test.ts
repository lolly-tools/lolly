// SPDX-License-Identifier: MPL-2.0
/**
 * The docs navigation budget (plan 354): how much a reader has to read past before the
 * page, and how the section rails are grouped. Two halves: the rails as the manifest
 * generates them (always checked), and the built pages (skipped with a registered reason
 * when no /info is built).
 *
 * Run: node --test tests/docs-nav-budget.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRegistry, DOCS_ROOT } from '../docs/navigation.ts';

const REGISTRY = readRegistry(DOCS_ROOT);
const BORROWED = 'Also in other sections';
const BUILD_TS = readFileSync(join(DOCS_ROOT, 'docs/build.ts'), 'utf-8');

/** The generated SIDEBARS table, parsed back: section key -> its groups. */
function sidebars(): Map<string, Array<{ label: string; slugs: string[] }>> {
  const block = /\/\/ BEGIN GENERATED DOCS SIDEBARS\n([\s\S]*?)\/\/ END GENERATED DOCS SIDEBARS/.exec(BUILD_TS)?.[1] ?? '';
  const out = new Map<string, Array<{ label: string; slugs: string[] }>>();
  let key = '';
  for (const line of block.split('\n')) {
    const sec = /^ {2}(\w+): \{ title:/.exec(line);
    if (sec) { key = sec[1]!; out.set(key, []); continue; }
    const grp = /^ {4}\{ label: '((?:[^'\\]|\\.)*)', items: \[/.exec(line);
    if (grp) { out.get(key)!.push({ label: grp[1]!.replace(/\\'/g, "'"), slugs: [] }); continue; }
    const item = /^ {6}\{ slug: '([^']+)'/.exec(line);
    if (item) out.get(key)!.at(-1)!.slugs.push(item[1]!);
  }
  return out;
}

test('every rail groups pages under its own groups, and borrowed pages under one last group', () => {
  const rails = sidebars();
  assert.ok(rails.size >= 6, 'the SIDEBARS block did not parse');
  for (const section of REGISTRY.sections) {
    const groups = rails.get(section.key) ?? [];
    const own = new Set(REGISTRY.pages.filter((p) => p.section === section.id).map((p) => p.group));
    for (const [i, g] of groups.entries()) {
      if (g.label === BORROWED) {
        assert.equal(i, groups.length - 1, `${section.title}: the borrowed group is not the last one`);
        continue;
      }
      assert.ok(own.has(g.label), `${section.title}: a group named "${g.label}" came from another section`);
    }
  }
});

test('no rail ends in a run of one-page groups borrowed from elsewhere', () => {
  let oneBorrowed = 0;
  for (const [key, groups] of sidebars()) {
    const section = REGISTRY.sections.find((s) => s.key === key)!;
    const own = new Set(REGISTRY.pages.filter((p) => p.section === section.id).map((p) => p.group));
    oneBorrowed += groups.filter((g) => g.slugs.length === 1 && !own.has(g.label) && g.label !== BORROWED).length;
  }
  assert.equal(oneBorrowed, 0, 'plan 354 measured 12 of these');
});

// ─── the built pages ─────────────────────────────────────────────────────────

const BUILT = join(DOCS_ROOT, 'shells/web/public/info');
const built = existsSync(join(BUILT, 'build/build-guide.html')) ? false : 'no built /info on disk - run `pnpm run build:info`';

test('a long section rail shows a handful of rows until a reader opens a group', { skip: built }, () => {
  // Automate is the longest rail. Rows outside a closed fold are what a reader scans.
  const html = readFileSync(join(BUILT, 'build/build-guide.html'), 'utf-8');
  const rail = /<aside class="docs-sidebar">([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
  assert.ok(rail, 'no rail on the page');
  assert.match(rail, /^\s*<a href="[^"]+" class="sidebar-pathway">/, 'the rail does not open with its hub as the heading');
  assert.ok(!/sidebar-home/.test(rail), 'the "<- Docs" link came back');
  const closed = [...rail.matchAll(/<details class="sidebar-group">([\s\S]*?)<\/details>/g)].map((m) => m[1]!);
  const hiddenRows = closed.reduce((n, body) => n + (body.match(/<a href=/g) ?? []).length, 0);
  const allRows = (rail.match(/<a href=/g) ?? []).length;
  const visible = allRows - hiddenRows;
  assert.ok(visible <= 20, `${visible} rows are visible before any fold opens (budget 20, of ${allRows})`);
  assert.match(rail, /<details class="sidebar-group" open><summary class="sidebar-label">[\s\S]*?class="active"/, 'the current page is not in an open group');
});

// Plan 354 aimed at eight tab stops or fewer before the rail. Row 1 alone is eight in the
// app (skip, back, four tabs, wide, avatar) and the six sections follow, so the budget
// protects what the count stood for (Andy's call through the coordinator, 2026-11-06):
// Skip to content is the first stop and moves focus to the article in one press, and the
// sections stay one row of six.
test('the skip link is the first stop and lands on the article, past the bar and the rail', { skip: built }, () => {
  const html = readFileSync(join(BUILT, 'build/build-guide.html'), 'utf-8');
  const body = html.slice(html.indexOf('<body'));
  const first = /<(a|button|input|summary)\b[^>]*>/.exec(body.slice(body.indexOf('>') + 1))?.[0] ?? '';
  assert.match(first, /class="skip-link" href="#docs-main"/, 'the skip link is not the first stop');
  assert.match(body, /<main class="docs-content[^"]*"[^>]* id="docs-main"|<main class="docs-content[^"]*" id="docs-main"/, 'the skip link target is not the article');
});

test('the sections row holds the sections and nothing else, so it stays one row', { skip: built }, () => {
  const html = readFileSync(join(BUILT, 'build/build-guide.html'), 'utf-8');
  const strip = /<nav class="docs-pathways"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  const tabs = strip.match(/<a class="docs-pathway/g) ?? [];
  assert.equal(tabs.length, REGISTRY.sections.length, 'the strip carries something besides the sections');
  assert.ok(tabs.length <= 6, `${tabs.length} tabs no longer fit one row at desktop width`);
});

test('a page names its section over the title and ends with Previous and Next in rail order', { skip: built }, () => {
  const html = readFileSync(join(BUILT, 'create/exporting.html'), 'utf-8');
  // The label sits in the band before the title row, generated, never in the article text.
  assert.match(html, /<p class="docs-eyebrow"><span>Create<\/span><span aria-hidden="true"> · <\/span><span>[^<]+<\/span><\/p><div class="mast-title"><h1/);
  const pager = /<nav class="docs-pager" aria-label="[^"]+">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  assert.match(pager, /rel="prev"/, 'no Previous link');
  assert.match(pager, /rel="next"/, 'no Next link');
  // Inside the article, so the in-app reader carries it with the rehosted fragment.
  const main = html.slice(html.indexOf('<main class="docs-content'), html.indexOf('</main>'));
  assert.ok(main.includes('class="docs-pager"'), 'the pager is outside the article');
  // The search index reads the page before this chrome, so the index holds neither line.
  const index = readFileSync(join(BUILT, 'search-index.json'), 'utf-8');
  assert.ok(!/docs-pager|docs-eyebrow/.test(index));
});
