// SPDX-License-Identifier: MPL-2.0
/**
 * Invariants for the Capabilities map (lib/capabilities-data.ts).
 *
 * The DATA SHAPE the Dashboard's Capabilities panel and its search rely on.
 * The panel escapes titles and feature names but renders `desc` RAW, so the
 * inline HTML authored there is a trusted-by-review surface - these tests are
 * that review, mechanised: the tag allowlist, balance, and the rule that an
 * external link carries rel="noopener". Plus the two optional per-card fields
 * the panel reads - `keywords` (live search) and `shot` (the detail-dialog
 * screenshot slug).
 *
 * The `shot` slug becomes /info/shots/<slug>.svg at runtime, but that directory
 * is gitignored build output (empty in a fresh checkout). The committed source
 * of truth is the docs submodule at repo-root docs/shots/<slug>.svg, so the
 * existence check resolves slugs there and SKIPS when the submodule is absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { CAPABILITY_SECTIONS } from './capabilities-data.ts';

const allCards = CAPABILITY_SECTIONS.flatMap((s) => s.cards);
const allFeatures = allCards.flatMap((c) => c.features);

test('sections and cards are structurally sound', () => {
  assert.ok(CAPABILITY_SECTIONS.length >= 8, 'the map should not have collapsed to a stub');
  for (const s of CAPABILITY_SECTIONS) {
    assert.ok(s.title.trim(), `section ${s.id} needs a title`);
    assert.ok(s.desc.trim(), `section ${s.id} needs a description`);
    assert.ok(s.icon.startsWith('<svg'), `section ${s.id} needs an icon`);
    assert.ok(s.flag.trim(), `section ${s.id} needs a deep-link flag`);
    assert.ok(s.cards.length > 0, `section ${s.id} has no cards`);
    for (const c of s.cards) {
      assert.ok(c.title.trim(), `a card in ${s.id} has no title`);
      assert.ok(c.icon.startsWith('<svg'), `card "${c.title}" has no icon`);
      // A card with no features renders a "0" count badge and pops an empty
      // dialog - the one shape the panel has no sensible rendering for.
      assert.ok(c.features.length > 0, `card "${c.title}" has no features`);
      for (const f of c.features) {
        assert.ok(f.name.trim(), `a feature in "${c.title}" has no name`);
        assert.ok(f.desc.trim(), `feature "${f.name}" has no description`);
      }
    }
  }
});

test('ids and deep-link flags are unique', () => {
  const ids = CAPABILITY_SECTIONS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate section id - a deep link would jump to whichever came first');
  // A flag is a space-separated list of deep-link keys (#/d?print). Two sections
  // claiming one key makes that link ambiguous.
  const flags = CAPABILITY_SECTIONS.flatMap((s) => s.flag.split(/\s+/).filter(Boolean));
  assert.equal(new Set(flags).size, flags.length, `duplicate deep-link flag among: ${flags.join(', ')}`);
});

test('card titles are unique - the search result list shows titles alone', () => {
  const titles = allCards.map((c) => c.title);
  const dupes = titles.filter((x, i) => titles.indexOf(x) !== i);
  assert.deepEqual(dupes, [], `two cards share a title, so a search hit is ambiguous: ${dupes.join(', ')}`);
});

test('desc inline HTML sticks to the reviewed tag allowlist', () => {
  // The panel renders `desc` raw. Anything outside this set is either a styling
  // escalation or a script vector, and should be a deliberate decision made in
  // this test rather than a quiet addition in the data.
  const ALLOWED = new Set(['code', 'strong', 'em', 'a', 'br']);
  for (const f of allFeatures) {
    for (const [, tag] of f.desc.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)) {
      assert.ok(ALLOWED.has(tag!.toLowerCase()), `feature "${f.name}" uses <${tag}>, which is not on the allowlist`);
    }
    // Only inside an attribute. The copy legitimately *names* `javascript:` as
    // prose (the SVG-import card, describing what sanitising strips), and a
    // blanket match would forbid the page from discussing its own sanitiser.
    for (const [, url] of f.desc.matchAll(/\b(?:href|src)="([^"]*)"/gi)) {
      assert.doesNotMatch(url!, /^\s*javascript:/i, `feature "${f.name}" carries a javascript: URL`);
    }
  }
});

test('desc tags are balanced - an unclosed tag would swallow the rest of the dialog', () => {
  for (const f of allFeatures) {
    const open = [...f.desc.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)(?![^>]*\/>)[^>]*>/g)].map((m) => m[1]!.toLowerCase()).filter((tg) => tg !== 'br');
    const close = [...f.desc.matchAll(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g)].map((m) => m[1]!.toLowerCase());
    assert.deepEqual(open.sort(), close.sort(), `feature "${f.name}" has unbalanced inline HTML`);
  }
});

test('external links open safely; in-app links stay in-app', () => {
  for (const f of allFeatures) {
    for (const [tagHtml, href] of [...f.desc.matchAll(/<a\b([^>]*)href="([^"]+)"/g)].map((m) => [m[0]!, m[2]!] as const)) {
      if (href.startsWith('#/')) continue;                    // an in-app route
      assert.ok(href.startsWith('https://'), `feature "${f.name}" links to a non-https URL: ${href}`);
      const attrs = tagHtml + f.desc.slice(f.desc.indexOf(tagHtml));
      const tag = attrs.slice(0, attrs.indexOf('>') + 1);
      if (tag.includes('target="_blank"')) {
        assert.match(tag, /rel="[^"]*noopener/, `feature "${f.name}" opens ${href} in a new tab without rel="noopener"`);
      }
    }
  }
});

test('every card carries search keywords', () => {
  // Search is the primary way into a large card map, and the visible copy alone
  // misses the words people actually type (a card can describe CMYK output
  // without the word "prepress"). A card with no keywords is reachable only by
  // the phrasing its author happened to choose.
  const bare = allCards.filter((c) => !c.keywords?.trim()).map((c) => c.title);
  assert.deepEqual(bare, [], `cards missing keywords: ${bare.join(', ')}`);
  for (const c of allCards) {
    assert.equal(c.keywords, c.keywords!.toLowerCase(), `keywords for "${c.title}" must be lowercase - the filter lowercases the query, not the haystack`);
  }
});

// The `shot` slug becomes /info/shots/<slug>.svg in the detail dialog, but that
// directory is gitignored build output. The committed baselines live in the
// docs submodule at repo-root docs/shots/ - four levels up from src/lib/.
const shotsDir = new URL('../../../../docs/shots/', import.meta.url);

test('every card screenshot resolves to a committed file', () => {
  // A `shot` typo or a retired slug is a broken image inside a dialog - 
  // invisible until someone opens that one card. Assert every slug resolves to a
  // committed docs baseline. When the docs submodule is not checked out (a bare
  // parent clone), the source of truth is absent, so skip rather than fail.
  if (!existsSync(shotsDir)) return;
  const missing = allCards
    .filter((c) => c.shot && !existsSync(new URL(`${c.shot}.${c.shotExt ?? 'svg'}`, shotsDir)))
    .map((c) => `${c.title} → ${c.shot}.${c.shotExt ?? 'svg'}`);
  assert.deepEqual(missing, [], `card screenshots that do not exist: ${missing.join(', ')}`);
});

test('a card`s `shot` is the base slug, never a variant suffix', () => {
  // `shot` names the base slug; the dialog derives the theme variant itself by
  // appending `.dark` under a dark/brand theme (views/dashboard.ts). A slug that
  // already carried `.dark` or a locale would be doubled into a 404.
  for (const c of allCards) {
    if (!c.shot) continue;
    assert.doesNotMatch(c.shot, /\.(dark|svg|png|jpg)$/, `card "${c.title}" - \`shot\` must be the bare slug, not "${c.shot}"`);
  }
});
