// SPDX-License-Identifier: MPL-2.0
/**
 * The docs describe hosting neutrally: Lolly no longer runs on Vercel.
 *
 * A page that says Lolly is hosted on Vercel, or explains a limit "on Vercel", tells a
 * reader something that stopped being true. Where a limit applies only on one kind of host,
 * the page says what the limit is and where it applies. This is a small test of its own on
 * purpose: the vernacular gates match wording, and their lists are never widened.
 *
 * A ratchet: scripts/data/docs-ratchets/vercel.json records how many times each English
 * page named Vercel on 2026-10-23 (the highest count across the docs PRs open then). A page
 * fails when it goes above its count; a page not listed may not name Vercel at all.
 *
 * Run directly: node --test tests/docs-platform-neutral.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVercelBaseline, risenVercel, scanVercel, workingTree, type DocsTree } from '../scripts/docs-ratchets.ts';

test('no English page names Vercel more often than the baseline allows', () => {
  const risen = risenVercel(scanVercel(workingTree()), readVercelBaseline());
  assert.deepEqual(
    risen.map(r => `${r.src}: names Vercel ${r.now} times, baseline ${r.was}`), [],
    'Lolly no longer runs on Vercel. Describe the platform neutrally, and say where a host-specific limit applies.',
  );
});

test('every spelling counts, in prose, code and file names', () => {
  const tree: DocsTree = {
    pages: [{ slug: 'a', title: 'A', src: 'a.md' }, { slug: 'b', title: 'B', src: 'b.md' }],
    read: src => ({ 'a.md': 'Hosted on Vercel.\n```sh\nvercel deploy\n```\nSee vercel.json and env.VERCEL.', 'b.md': 'Runs on any Kubernetes host.' } as Record<string, string>)[src] ?? null,
  };
  assert.deepEqual(scanVercel(tree), { 'docs/a.md': 4 });
});

test('a page fails above its count, and a page not in the baseline fails on its first mention', () => {
  const baseline = { $comment: '', pages: { 'docs/a.md': 2 } };
  assert.deepEqual(risenVercel({ 'docs/a.md': 2 }, baseline), []);
  assert.deepEqual(risenVercel({ 'docs/a.md': 1 }, baseline), [], 'fewer mentions never fail');
  assert.deepEqual(risenVercel({ 'docs/a.md': 3, 'docs/b.md': 1 }, baseline), [
    { src: 'docs/a.md', was: 2, now: 3 }, { src: 'docs/b.md', was: 0, now: 1 },
  ]);
});
