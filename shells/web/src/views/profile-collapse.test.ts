// SPDX-License-Identifier: MPL-2.0
/**
 * /profile after the 2026-08-23 reshape (owner call). Three properties that are
 * easy to regress one card at a time, so they are pinned against the real source:
 *
 *  1. EVERY section is a collapsible card and they ALL start closed. Half the
 *     cards used to be plain <section class="profile-card"> (always open); a new
 *     card added in that older shape would silently reintroduce the mixed page.
 *     Closed is the DEFAULT, never the rule: a stored open state or a ?focus=
 *     target still opens one, which is what startOpen() resolves.
 *  2. A closed card must still be reachable: the nav rail (and the deep-link
 *     handler) opens the target <details> before scrolling, or a jump stops at a
 *     folded heading.
 *  3. Sync across devices is a sub-block INSIDE Connected services, not a card:
 *     one open, two bodies, and the sync search keywords ride the connections
 *     entry so a query for "passphrase" still finds it. The old
 *     ?focus=sync-section links resolve to the merged card.
 *
 * Source scans, like profile-nav.test.ts (the view needs a full host bridge to
 * mount); the jsdom preamble is only there because profile.ts's import graph
 * expects a window.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/profile-collapse.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { NAV_SECTIONS } = await import('./profile.ts');
const SRC = readFileSync(fileURLToPath(new URL('./profile.ts', import.meta.url)), 'utf8');

test('every section is a <details> card wired to startOpen - no always-open sections left', () => {
  for (const s of NAV_SECTIONS) {
    assert.ok(
      SRC.includes(`<details class="profile-card profile-collapse`),
      'the collapsible card shape is the only card shape',
    );
    assert.ok(
      SRC.includes(`id="${s.id}"\${startOpen('${s.id}')}`),
      `${s.id} takes its open state from startOpen()`,
    );
  }
  assert.ok(!SRC.includes('<section class="profile-card'), 'no plain always-open card remains');
});

test('the default is CLOSED, with a stored open state or a ?focus= target as the only openers', () => {
  assert.ok(
    SRC.includes("const startOpen = (id: string) => (openState[id] || focusSectionId === id ? ' open' : '');"),
    'no entry and no focus target ⇒ no open attribute',
  );
  // The two legacy aliases name a section, so a deep link never arrives at a folded card
  // (use-details targets a checkbox INSIDE the details card).
  assert.ok(SRC.includes("focusFlags ? 'feature-flags-section'"), 'the flags alias opens its card');
  assert.ok(SRC.includes("focusUseDetails ? 'details-section'"), 'the use-details alias opens the details card');
});

test('a nav jump (mouse or keyboard) expands the target before scrolling', () => {
  assert.ok(
    SRC.includes('if (el instanceof HTMLDetailsElement && !el.open) el.open = true;'),
    'jump() opens the card, which also fires the lazy-mount toggle listeners',
  );
  // The rail items are real <button>s, so Enter/Space fire the same click handler -
  // there is no separate keydown path to keep in step.
  assert.ok(SRC.includes('class="profile-nav-item" data-nav="${s.id}"'), 'the rail is buttons');
  assert.ok(SRC.includes("btn.addEventListener('click'"), 'one handler covers pointer and keyboard');
});

test('the folded details card still names its owner (identity in the summary)', () => {
  assert.ok(SRC.includes('class="profile-summary-name"'), 'the summary carries a name slot');
  assert.match(SRC, /const displayName = \[profile\.firstname, profile\.lastname\]/, 'name first');
  assert.ok(SRC.includes("(profile.email ?? '').trim()"), 'email is the fallback');
});

test('Sync across devices is a sub-block of Connected services, not a card of its own', () => {
  assert.ok(!NAV_SECTIONS.some((s) => s.id === 'sync-section'), 'the nav entry is gone');
  assert.ok(!SRC.includes('id="sync-section"'), 'and so is the card');
  // The sub-block sits inside the connections card's body, between its opening
  // <details> and the next card.
  const card = SRC.slice(SRC.indexOf('id="connections-section"'), SRC.indexOf('id="feature-flags-section"'));
  assert.ok(card.includes('id="connections-body"'), 'providers first');
  assert.ok(card.includes('id="sync-body"'), 'then the titled sync sub-block');
  assert.ok(card.indexOf('id="connections-body"') < card.indexOf('id="sync-body"'), 'in that order');
  // One toggle, two lazy bodies.
  assert.ok(
    SRC.includes('const loadConnectionsCard = (): void => { void loadConnections(); void loadSync(); };'),
    'both bodies mount when the card opens',
  );
  const conn = NAV_SECTIONS.find((s) => s.id === 'connections-section')!;
  for (const word of ['sync', 'passphrase', 'icloud', 'devices']) {
    assert.ok(conn.keywords.includes(word), `profile search still finds "${word}"`);
  }
});

test('old ?focus=sync-section links resolve to the merged card', () => {
  assert.ok(
    SRC.includes("rawFocus === 'sync-section' ? 'connections-section' : rawFocus"),
    'the alias is normalised before anything reads it',
  );
});

test('the Feature flags list renders the connectors as one named cluster', () => {
  assert.ok(SRC.includes('CONNECTOR_FLAGS.map(flagRow)'), 'the cluster is the registry, not a hand-kept copy');
  assert.ok(SRC.includes('class="feature-flag-group"'), 'with a heading row of its own');
  // A flip re-mounts the connections card in place; the send surfaces need nothing.
  assert.ok(SRC.includes("flagId.startsWith('conn-') && connectionsLoaded"), 'a flip re-renders the open card');
});
