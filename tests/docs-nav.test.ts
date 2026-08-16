// SPDX-License-Identifier: MPL-2.0
/**
 * The docs-nav guard is real, and its matchers are not vacuous.
 *
 * scripts/check-docs-nav.ts asserts that every `docs/*.md` is a registered `/info`
 * page (or a declared exception) and that every registered page has a `SIDEBARS`
 * item (or a declared exception). It reads docs/build.ts with regexes, and a
 * regex-based guard has one characteristic failure: the file gets restructured,
 * the pattern stops matching, and the check goes green while testing nothing.
 * These tests pin the current tree AND feed the matchers synthetic input so a
 * silent no-op is caught.
 *
 * Written after maintainability-2026-07-29.md item 5 and the ios-build.md orphan
 * it names - see that plan for why the orphan mattered.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkDocsNav, registeredSources, sliceDeclaration, NOT_PAGES, NOT_IN_SIDEBAR } from '../scripts/check-docs-nav.ts';

test('the tree is currently clean — no orphans, no unreachable pages', () => {
  const r = checkDocsNav();
  assert.deepEqual(r.orphaned, [], 'a docs/*.md has no pages entry and no declared exception');
  assert.deepEqual(r.missing, [], 'docs/build.ts registers a src that does not exist');
  assert.deepEqual(r.staleExceptions, [], 'NOT_PAGES exempts a file that no longer exists');
  assert.deepEqual(r.contradictoryExceptions, [], 'NOT_PAGES exempts a file that IS registered');
  assert.deepEqual(r.unreachable, [], 'a built page has no SIDEBARS item and no declared exception');
  assert.deepEqual(r.staleSidebarExceptions, [], 'NOT_IN_SIDEBAR exempts a slug that is not an unreachable page');
});

test('ios-build.md is registered — the orphan that motivated the guard', () => {
  // Named explicitly rather than left to the generic orphan check, so a revert
  // says WHICH page regressed and why anyone cared.
  const r = checkDocsNav();
  assert.equal(r.orphaned.includes('ios-build.md'), false);
  assert.equal(r.unreachable.includes('ios-build'), false,
    'ios-build is built but no longer linked from a sidebar — back to being unreachable');
});

test('every declared exception carries a non-trivial reason', () => {
  // An exception list whose entries say "n/a" is just a suppression list. The
  // reason is the whole mechanism, so assert it is actually written.
  for (const [name, reason] of Object.entries({ ...NOT_PAGES, ...NOT_IN_SIDEBAR })) {
    assert.ok(reason.length > 40, `the exception for ${name} needs a real reason, got: ${reason}`);
  }
});

test('the guard finds a healthy number of pages (the scan is not empty)', () => {
  const r = checkDocsNav();
  assert.ok(r.registeredCount > 20,
    `only ${r.registeredCount} pages found in docs/build.ts — the src: matcher has probably stopped matching`);
});

// ─── matcher non-vacuity ─────────────────────────────────────────────────────

test('registeredSources extracts src values, and misses nothing obvious', () => {
  const sample = `
    const pages: Page[] = [
      { slug: 'a', title: 'A', src: 'a.md', pathway: 'builders' },
      { slug: 'b', title: 'B', src: '../README.md' },
    ];
  `;
  assert.deepEqual(registeredSources(sample), ['a.md', '../README.md']);
  assert.deepEqual(registeredSources('const pages = [];'), []);
});

test('sliceDeclaration separates pages from SIDEBARS (both use `slug:`)', () => {
  // The whole reason the slug scan is scoped: a naive repo-wide `slug:` match
  // would treat every sidebar item as a page and the unreachable check would
  // always be empty.
  const sample = [
    "const pages: Page[] = [",
    "  { slug: 'only-a-page', src: 'x.md' },",
    "];",
    "const SIDEBARS: Record<Pathway, unknown> = {",
    "  builders: { items: [ { slug: 'only-in-sidebar' } ] },",
    "};",
    "const ICONS = {};",
  ].join('\n');

  const pages = sliceDeclaration(sample, 'pages');
  const sidebars = sliceDeclaration(sample, 'SIDEBARS');
  assert.match(pages, /only-a-page/);
  assert.doesNotMatch(pages, /only-in-sidebar/, 'the pages slice leaked into SIDEBARS');
  assert.match(sidebars, /only-in-sidebar/);
  assert.doesNotMatch(sidebars, /only-a-page/, 'the SIDEBARS slice leaked into pages');
});

test('sliceDeclaration returns empty for a renamed declaration, so the guard can refuse to run', () => {
  // checkDocsNav throws on an empty slice rather than reporting success - the
  // behaviour that stops a build.ts refactor silently disabling the check.
  assert.equal(sliceDeclaration('const somethingElse = [];', 'pages'), '');
});
