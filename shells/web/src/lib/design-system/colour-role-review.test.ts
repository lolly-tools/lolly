// SPDX-License-Identifier: MPL-2.0
/**
 * The review of a file's colour words, with no DOM (plans/352 R4). A browser run of the same
 * step is in tests/colour-roles-import.browser.test.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/colour-role-review.test.ts"
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposeColourRoles } from '../brand-propose.ts';
import { chooseReading, colourRoleReviewHtml, declaredRolesHtml, initialChoices, reviewHasLead } from './colour-role-review.ts';
import { readDesignMdSource } from './sources/declared.ts';
import { docNeedsMappingReview, routeDesignFile } from './sources/file.ts';

const TEXTILE = { color: { $type: 'color', main: { $value: '#1b2a6b' }, accent: { $value: '#b23a48' }, tertiary: { $value: '#d9c7a0' } } };
const wefthouse = (): Record<string, unknown> => JSON.parse(readFileSync(new URL('../../../../../tests/fixtures/colour-roles/wefthouse.tokens.json', import.meta.url), 'utf8')) as Record<string, unknown>;

test('each row shows the word, the token and what Lolly reads it as, and starts on', () => {
  const proposal = proposeColourRoles(TEXTILE);
  const choices = initialChoices(proposal);
  assert.deepEqual(choices.map(c => [c.id, c.keep, c.reads]), [['main', true, 'primary'], ['accent', true, 'secondary'], ['tertiary', true, null]]);
  const html = colourRoleReviewHtml(proposal, choices);
  assert.match(html, /This file has its own words for its colours/);
  assert.match(html, /data-role-label="main" value="Main"/);
  assert.match(html, /<code class="ds-role-path"[^>]*>color\.main<\/code>/);
  assert.match(html, /data-role-reads="main"[\s\S]*?<option value="primary" selected>Lead colour<\/option>/);
  assert.match(html, /data-role-reads="tertiary"[\s\S]*?<option value="" selected>By name only<\/option>/);
  assert.ok(!/<option[^>]*>(Primary|Secondary)</.test(html), 'Lolly\'s reading never says a bare Primary or Secondary');
});

test('reading a row as a slot moves the slot here, because each slot takes one role', () => {
  const choices = initialChoices(proposeColourRoles(TEXTILE));
  const moved = chooseReading(choices, 'tertiary', 'primary');
  assert.deepEqual(moved.map(c => [c.id, c.reads]), [['main', null], ['accent', 'secondary'], ['tertiary', 'primary']]);
  assert.deepEqual(chooseReading(moved, 'tertiary', null).map(c => c.reads), [null, 'secondary', null], 'and by name only frees it');
});

test('a file with no lead colour of its own needs a row read as one, unless every word is turned off', () => {
  const proposal = proposeColourRoles(TEXTILE);
  const choices = initialChoices(proposal);
  assert.equal(reviewHasLead(proposal, choices), true);
  const none = chooseReading(choices, 'main', null);
  assert.equal(reviewHasLead(proposal, none), false);
  assert.match(colourRoleReviewHtml(proposal, none), /data-role-needs-lead(?! hidden)/);
  assert.equal(reviewHasLead(proposal, none.map(c => ({ ...c, keep: false }))), true, 'with no roles the file installs as it came');
  assert.equal(reviewHasLead({ ...proposal, hasLead: true }, none), true);
});

test('a file\'s words are escaped everywhere they are drawn', () => {
  const hostile = '"><img src=x onerror=alert(1)><script>alert(1)</script>';
  const proposal = proposeColourRoles({ color: { $type: 'color', accent: { $value: '#b23a48', $description: hostile }, supporting: { $value: '#6c7a89' } } });
  const choices = initialChoices(proposal).map(c => ({ ...c, label: hostile }));
  const html = colourRoleReviewHtml(proposal, choices);
  assert.ok(!html.includes('<img') && !html.includes('<script'));
  assert.match(html, /&lt;script&gt;/);
  const doc = wefthouse() as { $extensions: Record<string, { brandSystem: { roles: Array<{ id: string; label: string; description?: string }> } }> };
  doc.$extensions['com.suse.lolly']!.brandSystem.roles.find(r => r.id === 'main')!.label = hostile;
  doc.$extensions['com.suse.lolly']!.brandSystem.roles.find(r => r.id === 'accent')!.description = hostile;
  const declared = declaredRolesHtml(doc);
  assert.ok(!declared.includes('<img') && !declared.includes('<script'));
  assert.match(declared, /dir="auto"/);
});

test('a file that states its roles shows them as written, with no controls', () => {
  const html = declaredRolesHtml(wefthouse());
  assert.match(html, /This file states its colour roles/);
  assert.match(html, /<strong dir="auto">Main<\/strong><span class="lp-help" dir="auto">The cloth&#39;s ground colour<\/span>/);
  assert.match(html, /Lead colour/);
  assert.match(html, /By name only/);
  assert.ok(!/<input|<select/.test(html));
  assert.equal(proposeColourRoles(wefthouse()).rows.length, 0);
});

test('a file with no words has no new step at all', () => {
  const doc = { color: { $type: 'color', flax: { $value: '#faf7f2' }, loom: { $value: '#1c1a17' } } };
  assert.equal(declaredRolesHtml(doc), '');
  const proposal = proposeColourRoles(doc);
  assert.equal(colourRoleReviewHtml(proposal, initialChoices(proposal)), '');
  assert.equal(docNeedsMappingReview(doc), true, 'that file keeps the card it had');
});

test('every import route hands the review a document with its words, untouched', async () => {
  const encode = (text: string): Uint8Array => new TextEncoder().encode(text);
  const json = await routeDesignFile('tokens.json', encode(JSON.stringify(TEXTILE)));
  assert.equal(json.kind, 'tokens');
  assert.deepEqual(json.kind === 'tokens' ? json.extraction.doc : null, TEXTILE);
  // A stranger's DESIGN.md: its names land as named colours, and the review offers them.
  const md = readDesignMdSource('---\nname: Textile\ncolors:\n  main: "#1b2a6b"\n  accent: "#b23a48"\n  tertiary: "#d9c7a0"\n---\n', 'DESIGN.md');
  assert.ok(md.ok);
  if (md.ok) {
    const proposal = proposeColourRoles(md.source.doc);
    assert.deepEqual(proposal.rows.map(r => [r.id, r.reads, r.path]), [['main', 'primary', 'color.brand.main'], ['accent', 'secondary', 'color.brand.accent'], ['tertiary', null, 'color.brand.tertiary']]);
  }
  // A file Lolly wrote comes back declared, with nothing to review.
  const declared = await routeDesignFile('w.json', encode(JSON.stringify(wefthouse())));
  assert.equal(declared.kind, 'tokens');
  assert.equal(declared.kind === 'tokens' ? proposeColourRoles(declared.extraction.doc).rows.length : -1, 0);
});
