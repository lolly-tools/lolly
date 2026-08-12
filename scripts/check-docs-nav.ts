#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Docs nav drift guard — every `docs/*.md` is either a registered `/info` page or
 * a DECLARED exception.
 *
 * Run as: node scripts/check-docs-nav.ts        (exit 1 on drift)
 *         node scripts/check-docs-nav.ts --json (machine-readable report)
 *
 * WHY THIS EXISTS
 * `docs/build.ts` holds a hand-maintained `pages` array; the `/info` site — nav,
 * sidebar, sitemap — is derived from it. Nothing connected that array to the
 * directory it reads from, so a `.md` could be written, reviewed and committed
 * while remaining unreachable from the site. `docs/ios-build.md` was exactly that
 * for as long as it existed: a complete iOS build walkthrough with no `pages`
 * entry, no sidebar item, and one prose mention naming its repository path. It is
 * registered now (maintainability-2026-07-29.md item 5), and this script is the
 * half that stops the next one drifting.
 *
 * It also checks the other direction — a `pages` entry whose `src` no longer
 * exists — because that fails the build with a bare ENOENT rather than saying
 * which page is stale.
 *
 * AND IT CHECKS SIDEBAR REACHABILITY, which is the stricter and more honest
 * question. A `pages` entry only means the HTML gets built; if no `SIDEBARS` item
 * names the slug, the page exists at a URL nobody can navigate to. docs/README.md
 * called that "a half-case" for content-credentials-engineering, and it is the
 * failure mode ios-build had one layer deeper. Both lists are checked, each with
 * its own declared exceptions.
 *
 * AND IT CHECKS THE README INDEX. docs/README.md opens by promising its sections
 * "mirror the pathways declared in docs/build.ts, so the index cannot drift from
 * the site" — but nothing enforced that, and by 2026-08-11 nine registered pages
 * (the whole Trust pathway among them: trust, status-quo, ai-stance, ai-features,
 * beatrice-warde, inclusive-design, input-not-impersonation, plus cli-signing and
 * contributing-setup) had no row at all. A contributor reading the index would
 * conclude those pages did not exist. So every `pages` entry must be NAMED in
 * docs/README.md — in one of the pathway tables, in the "Not in the site nav"
 * table, or in the prose that covers a page the tables cannot hold (the About
 * entry, which renders `../README.md`). The match is on the page's own source
 * path or its slug, not on table structure, so the index can be reorganised
 * freely; a mention in passing satisfies it, a page nobody wrote down does not.
 *
 * EXCEPTIONS ARE DECLARED, NOT INFERRED
 * Two files legitimately are not pages, and each is listed below with its reason
 * rather than pattern-matched. That is the point: an exception has to be a
 * decision someone wrote down, so "it isn't a page" cannot become the silent
 * default for anything unfinished. Adding a file here should feel like a small
 * act of documentation, because it is.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = join(ROOT, 'docs');
const BUILD_TS = join(DOCS_DIR, 'build.ts');
const DOCS_README = join(DOCS_DIR, 'README.md');

/**
 * `docs/*.md` files that are deliberately NOT `/info` pages, each with the reason
 * it is not one. A file here is a decision, not an oversight — if you cannot state
 * a reason, the file wants a `pages` entry instead.
 */
export const NOT_PAGES: Record<string, string> = {
  'README.md':
    'the docs directory\'s own index — a map for contributors reading the repo, ' +
    'not a page for readers of the site (it describes the nav rather than joining it)',
  'faq.md':
    'the source for the accordion on the /info landing page, parsed by loadFaqs() in ' +
    'build.ts — it ships as part of index.html, so registering it would publish the ' +
    'same content twice',
};

/**
 * Registered pages that deliberately have no `SIDEBARS` item, each with its
 * reason. Same discipline as NOT_PAGES: an unreachable page is a bug unless
 * someone decided otherwise in writing.
 */
export const NOT_IN_SIDEBAR: Record<string, string> = {
  index:
    'the /info landing page — the brand wordmark links to it from every page, and it ' +
    'renders the hub cards rather than sitting inside a pathway sidebar',
};

export interface NavReport {
  /** docs/*.md with neither a pages entry nor a NOT_PAGES exception. */
  orphaned: string[];
  /** pages entries whose src file is missing from disk. */
  missing: string[];
  /** NOT_PAGES entries for files that no longer exist — stale exceptions. */
  staleExceptions: string[];
  /** NOT_PAGES entries for files that ARE registered — contradictory. */
  contradictoryExceptions: string[];
  /** Page slugs with no SIDEBARS item and no NOT_IN_SIDEBAR exception. */
  unreachable: string[];
  /** NOT_IN_SIDEBAR entries for slugs that are not pages, or that DO have a
   *  sidebar item — stale or contradictory either way. */
  staleSidebarExceptions: string[];
  /** Registered pages that docs/README.md never names, as `slug (src)`. */
  unindexed: string[];
  registeredCount: number;
}

/**
 * Every `src:` in build.ts's `pages` array. A regex rather than an import because
 * importing build.ts executes it (it reads catalog/tools/index.json at module
 * scope and would fail on a clone with no built profile view), and because this
 * guard should keep working if that array is ever reshaped around the same key.
 */
export function registeredSources(buildTs: string): string[] {
  return [...buildTs.matchAll(/\bsrc:\s*'([^']+)'/g)].map((m) => m[1] as string);
}

/**
 * Slice out one top-level declaration's text by name, so `slug:` matches can be
 * attributed to `pages` vs `SIDEBARS` (both use the same key). Ends at the next
 * top-level `const`/`interface`/`function`/`type`, which is how this file is laid
 * out; returns '' if the declaration is gone, and the callers below treat an empty
 * slice as a hard failure rather than passing vacuously.
 */
export function sliceDeclaration(buildTs: string, name: string): string {
  const start = buildTs.search(new RegExp(`^const ${name}\\b`, 'm'));
  if (start < 0) return '';
  const rest = buildTs.slice(start + 1);
  const end = rest.search(/^(?:const|interface|function|type|export) /m);
  return end < 0 ? rest : rest.slice(0, end);
}

const slugsIn = (block: string): string[] =>
  [...block.matchAll(/\bslug:\s*'([^']+)'/g)].map((m) => m[1] as string);

/**
 * The `pages` entries as `{ slug, src }` pairs — the README check needs both,
 * since the index links files (`[using.md](using.md)`) while the site is keyed
 * by slug. One entry is one object literal on one line, which is how the array
 * is written; a reshaped entry simply yields fewer pairs than there are slugs,
 * and checkDocsNav treats that mismatch as a hard failure rather than quietly
 * checking a subset.
 */
export function pageEntries(pagesBlock: string): Array<{ slug: string; src: string }> {
  return [...pagesBlock.matchAll(/\{[^{}]*?\bslug:\s*'([^']+)'[^{}]*?\bsrc:\s*'([^']+)'[^{}]*?\}/g)]
    .map((m) => ({ slug: m[1] as string, src: m[2] as string }));
}

/**
 * Does docs/README.md name this page at all? Matched on the page's SOURCE PATH,
 * which is the identifier the index actually uses, and deliberately
 * structure-agnostic: a markdown link (`](using.md)`), a bare filename in a table
 * cell, or a mention in prose all count, so the index can be regrouped without
 * touching this guard. Boundary-anchored so `cli.md` is not satisfied by
 * `cli-signing.md`, and so `../README.md` (the About page) is not satisfied by the
 * bare `README.md` row that stands for this index itself.
 *
 * NOT matched on the slug: too many slugs are ordinary English (`trust`, `about`,
 * `search`, `index`), and a prose coincidence would let a missing row pass — the
 * exact failure this check exists to catch. A `.md` path in the text is always a
 * reference to the doc.
 */
export function readmeNames(readme: string, page: { slug: string; src: string }): boolean {
  const esc = page.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\w./-])${esc}(?![\\w-])`).test(readme);
}

export function checkDocsNav(): NavReport {
  const buildTs = readFileSync(BUILD_TS, 'utf8');
  const sources = registeredSources(buildTs);
  // `../README.md` (the repo root readme, published as the About page) is
  // registered but lives outside docs/, so it is not part of the orphan question.
  const inDocs = new Set(sources.filter((s) => !s.startsWith('..')));

  const onDisk = readdirSync(DOCS_DIR).filter((n) => n.endsWith('.md'));

  const orphaned = onDisk.filter((n) => !inDocs.has(n) && !(n in NOT_PAGES)).sort();
  const missing = sources.filter((s) => !existsSync(join(DOCS_DIR, s))).sort();
  const staleExceptions = Object.keys(NOT_PAGES).filter((n) => !onDisk.includes(n)).sort();
  const contradictoryExceptions = Object.keys(NOT_PAGES).filter((n) => inDocs.has(n)).sort();

  // Sidebar reachability. Both slices must be non-empty — an empty one would make
  // every check below pass vacuously, which is the failure mode a guard must not have.
  const pagesBlock = sliceDeclaration(buildTs, 'pages');
  const sidebarBlock = sliceDeclaration(buildTs, 'SIDEBARS');
  if (!pagesBlock || !sidebarBlock) {
    throw new Error(
      'could not locate the `pages` and `SIDEBARS` declarations in docs/build.ts — ' +
        'this guard would pass vacuously. Update sliceDeclaration() to match the new layout.',
    );
  }
  const pageSlugs = slugsIn(pagesBlock);
  const sidebarSlugs = new Set(slugsIn(sidebarBlock));

  const unreachable = pageSlugs
    .filter((s) => !sidebarSlugs.has(s) && !(s in NOT_IN_SIDEBAR))
    .sort();
  const allPageSlugs = new Set(pageSlugs);
  const staleSidebarExceptions = Object.keys(NOT_IN_SIDEBAR)
    .filter((s) => !allPageSlugs.has(s) || sidebarSlugs.has(s))
    .sort();

  // The README index. Same vacuity discipline as the slices above: if the entry
  // matcher recovers fewer pages than there are `slug:` keys, the array has been
  // reshaped and this check would silently cover only part of it.
  const entries = pageEntries(pagesBlock);
  if (entries.length !== pageSlugs.length) {
    throw new Error(
      `recovered ${entries.length} of ${pageSlugs.length} \`pages\` entries from docs/build.ts — ` +
        'the README-index check would cover only a subset. Update pageEntries() to match the new layout.',
    );
  }
  const readme = readFileSync(DOCS_README, 'utf8');
  const unindexed = entries
    .filter((p) => !readmeNames(readme, p))
    .map((p) => `${p.slug} (docs/${p.src})`)
    .sort();

  return {
    orphaned,
    missing,
    staleExceptions,
    unreachable,
    staleSidebarExceptions,
    unindexed,
    contradictoryExceptions,
    registeredCount: inDocs.size,
  };
}

function main(): void {
  let report: NavReport;
  try {
    report = checkDocsNav();
  } catch (err) {
    // The vacuity guard in checkDocsNav (and any read failure) — report it as a
    // failed check with its message, not as an unhandled stack trace.
    console.error(`\n✗ docs nav check could not run: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const problems =
    report.orphaned.length +
    report.missing.length +
    report.staleExceptions.length +
    report.contradictoryExceptions.length +
    report.unreachable.length +
    report.staleSidebarExceptions.length +
    report.unindexed.length;

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(problems ? 1 : 0);
  }

  let failed = false;

  if (report.orphaned.length) {
    failed = true;
    console.error(
      `\n✗ ${report.orphaned.length} docs page(s) are unreachable from /info — no \`pages\`` +
        ' entry in docs/build.ts and no declared exception:\n',
    );
    for (const n of report.orphaned) console.error(`    docs/${n}`);
    console.error(
      '\n  Either add a `pages` entry (slug, title, src, pathway) in docs/build.ts, fold the\n' +
        '  content into a page that is registered, or — if it genuinely is not a site page —\n' +
        '  add it to NOT_PAGES in this script WITH the reason.',
    );
  }

  if (report.missing.length) {
    failed = true;
    console.error('\n✗ docs/build.ts registers page source(s) that do not exist:\n');
    for (const n of report.missing) console.error(`    docs/${n}`);
    console.error('\n  The /info build would fail with a bare ENOENT. Fix the src or drop the entry.');
  }

  if (report.staleExceptions.length) {
    failed = true;
    console.error('\n✗ NOT_PAGES in this script exempts file(s) that no longer exist:\n');
    for (const n of report.staleExceptions) console.error(`    docs/${n}`);
    console.error('\n  Remove the stale exception so the list keeps meaning something.');
  }

  if (report.contradictoryExceptions.length) {
    failed = true;
    console.error('\n✗ NOT_PAGES exempts file(s) that ARE registered as pages:\n');
    for (const n of report.contradictoryExceptions) console.error(`    docs/${n}`);
    console.error('\n  Drop the exception — the page is in the nav, which is what we wanted.');
  }

  if (report.unreachable.length) {
    failed = true;
    console.error(
      `\n✗ ${report.unreachable.length} page(s) are built but have no SIDEBARS item, so ` +
        'nothing links to them:\n',
    );
    for (const s of report.unreachable) console.error(`    ${s} (/info/${s}.html)`);
    console.error(
      '\n  Add the slug to the right pathway group in SIDEBARS (docs/build.ts), or — if it\n' +
        '  is deliberately reachable only through cross-links — add it to NOT_IN_SIDEBAR in\n' +
        '  this script WITH the reason.',
    );
  }

  if (report.staleSidebarExceptions.length) {
    failed = true;
    console.error('\n✗ NOT_IN_SIDEBAR exempts slug(s) that are not pages, or that DO appear in the sidebar:\n');
    for (const s of report.staleSidebarExceptions) console.error(`    ${s}`);
    console.error('\n  Remove the exception so the list keeps meaning something.');
  }

  if (report.unindexed.length) {
    failed = true;
    console.error(
      `\n✗ ${report.unindexed.length} registered page(s) are missing from the docs/README.md index, ` +
        'which says it mirrors the pathways in docs/build.ts:\n',
    );
    for (const s of report.unindexed) console.error(`    ${s}`);
    console.error(
      '\n  Add a row to the matching pathway table in docs/README.md (Doc | Audience | What it\n' +
        '  covers), linking the file by name. A page the index never mentions reads to a\n' +
        '  contributor as a page that does not exist.',
    );
  }

  if (failed) process.exit(1);

  const exempt = Object.keys(NOT_PAGES).length;
  const sidebarExempt = Object.keys(NOT_IN_SIDEBAR).length;
  console.log(
    `✓ docs nav complete — ${report.registeredCount} page(s) registered, ` +
      `${exempt} declared non-page(s), 0 orphans; every page reachable from a sidebar ` +
      `(${sidebarExempt} declared exception(s)) and indexed in docs/README.md`,
  );
}

// Only run when invoked directly, so tests/docs-nav.test.ts can import the checker
// without this module exiting the process out from under the test runner.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
