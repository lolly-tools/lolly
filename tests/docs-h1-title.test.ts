// SPDX-License-Identifier: MPL-2.0
/**
 * A page opens on the name the nav gives the page.
 *
 * The sidebar shows the manifest title (docs/manifest.json) and the page opens on its first
 * `# ` heading. When the two disagree ("Settings" over "The Dashboard", "Overview" over
 * "Lolly architecture") a reader cannot tell whether the link went where it said. The
 * heading may be the title or a longer form of it: every title word, in order ("Install
 * Lolly Work" for "Install Lolly Work", "Run your own Lolly Work server" for "Run your own
 * server").
 *
 * A ratchet: scripts/data/docs-ratchets/h1-title.json records the pages that disagreed on
 * 2026-10-23, including those in the docs PRs open then, and only a page missing from it
 * fails. Fix the heading or the title rather than adding a page there.
 *
 * Run directly: node --test tests/docs-h1-title.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstH1, headingMatchesTitle, newTitles, readTitlesBaseline, scanTitles, workingTree, type DocsTree } from '../scripts/docs-ratchets.ts';

test('every page opens on its nav title, or a longer form of it, beyond the baseline', () => {
  const fresh = newTitles(scanTitles(workingTree()), readTitlesBaseline());
  assert.deepEqual(
    fresh.map(h => `${h.slug}: heading ${JSON.stringify(h.h1)}, nav title ${JSON.stringify(h.title)}`), [],
    'make the first # heading the manifest title, or a longer form that keeps every title word in order',
  );
});

test('a longer form keeps every title word in order', () => {
  assert.ok(headingMatchesTitle('Install Lolly Work', 'Install Lolly Work'));
  assert.ok(headingMatchesTitle('Run your own Lolly Work server', 'Run your own server'));
  assert.ok(headingMatchesTitle('Questions & answers', 'Questions &amp; answers'));
  assert.ok(headingMatchesTitle('The `lw` CLI: administer an instance', 'lw CLI'));
  assert.ok(!headingMatchesTitle('The Dashboard', 'Settings'));
  assert.ok(!headingMatchesTitle('CLI', 'lolly CLI: create and process files'), 'a shorter heading is a different name');
  assert.ok(!headingMatchesTitle('Server run your own', 'Run your own server'), 'the words must keep their order');
});

test('the heading is the first # line outside code, and a page without one is listed', () => {
  assert.equal(firstH1('```md\n# Not this\n```\n\n# This one\n\n# Not the second'), 'This one');
  assert.equal(firstH1('## Only a section'), null);
  const tree: DocsTree = {
    pages: [{ slug: 'a', title: 'Alpha', src: 'a.md' }, { slug: 'b', title: 'Beta', src: 'b.md' }, { slug: 'c', title: 'Gamma', src: 'c.md' }],
    read: src => ({ 'a.md': '# Alpha guide', 'b.md': '# Something else', 'c.md': 'No heading' } as Record<string, string>)[src] ?? null,
  };
  assert.deepEqual(scanTitles(tree), [{ slug: 'b', title: 'Beta', h1: 'Something else' }, { slug: 'c', title: 'Gamma', h1: null }]);
});
