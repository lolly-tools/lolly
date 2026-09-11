// SPDX-License-Identifier: MPL-2.0
/**
 * collab-tile-state.ts - the registry (mirrors session-source.test.ts's shape)
 * plus the badge renderer's two essential claims:
 *
 *  1. ABSENT PROVIDER = ZERO DOM. A tile that never has a live collab must come
 *     out of `renderCollabBadge` byte-identical to a tile that function was
 *     never called on - every build of this repo today, since nothing
 *     registers a provider yet.
 *  2. WITH PEERS, the badge reflects the roster: avatar count (capped, "+N"
 *     overflow), the away modifier, and a count-correct aria-label.
 *
 * Run directly:  node --test shells/web/src/lib/collab-tile-state.test.ts
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { sessionTile } from '../folder-tiles.ts';
import {
  _clearCollabTileProviderForTests,
  type CollabTilePeer,
  type CollabTileProvider,
  getCollabTileProvider,
  registerCollabTileProvider,
  renderCollabBadge,
} from './collab-tile-state.ts';

function dom(): { document: Document } {
  const d = new JSDOM('<!doctype html><html><body></body></html>');
  (globalThis as Record<string, unknown>).window = d.window;
  (globalThis as Record<string, unknown>).document = d.window.document;
  (globalThis as Record<string, unknown>).HTMLElement = d.window.HTMLElement;
  return { document: d.window.document as unknown as Document };
}

const peer = (over: Partial<CollabTilePeer> = {}): CollabTilePeer => ({
  id: 'p1',
  name: 'Priya',
  color: '#3366cc',
  ...over,
});

const stubProvider = (peers: readonly CollabTilePeer[]): CollabTileProvider => ({
  peersFor: () => peers,
});

/** A real session tile, exactly as folder-tiles.ts / projects.ts produce it. */
function realTile(document: Document): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = sessionTile({
    slot: 's1',
    label: 'My design',
    updatedAt: '2026-08-01T00:00:00Z',
  });
  return host.firstElementChild as HTMLElement;
}

// ── registry (mirrors session-source.test.ts) ──────────────────────────────

test('dormant by default (no collab provider anywhere)', () => {
  _clearCollabTileProviderForTests();
  assert.equal(getCollabTileProvider(), undefined);
});

test('register installs the provider; unregister clears it', () => {
  _clearCollabTileProviderForTests();
  const off = registerCollabTileProvider(stubProvider([peer()]));
  assert.equal(getCollabTileProvider()?.peersFor('any').length, 1);
  off();
  assert.equal(getCollabTileProvider(), undefined);
});

test('last registration wins; a stale unregister is a no-op', () => {
  _clearCollabTileProviderForTests();
  const off1 = registerCollabTileProvider(stubProvider([peer({ id: 'a' })]));
  registerCollabTileProvider(stubProvider([peer({ id: 'b' }), peer({ id: 'c' })]));
  assert.equal(getCollabTileProvider()?.peersFor('x').length, 2);
  off1(); // stale - must NOT clear the current (second) registration
  assert.equal(getCollabTileProvider()?.peersFor('x').length, 2);
});

// ── renderCollabBadge: absent provider / empty peers ───────────────────────

test('byte-identical: an empty peer list paints nothing onto a real session tile', () => {
  const { document } = dom();
  const tile = realTile(document);
  const before = tile.outerHTML;
  renderCollabBadge(tile, []);
  assert.equal(
    tile.outerHTML,
    before,
    'renderCollabBadge([]) must not touch the tile at all - this is the guarantee every build of ' +
      'this repo relies on today, since no provider is registered anywhere'
  );
});

test('byte-identical: undefined peers is treated the same as an empty array', () => {
  const { document } = dom();
  const tile = realTile(document);
  const before = tile.outerHTML;
  renderCollabBadge(tile, undefined);
  assert.equal(tile.outerHTML, before);
});

test('a previously-painted badge is removed once the peer list empties', () => {
  const { document } = dom();
  const tile = realTile(document);
  const before = tile.outerHTML;
  renderCollabBadge(tile, [peer()]);
  assert.ok(tile.querySelector('.collab-tile-badge'), 'badge should have been painted');
  renderCollabBadge(tile, []);
  assert.equal(tile.querySelector('.collab-tile-badge'), null);
  assert.equal(tile.outerHTML, before, 'clearing the badge must restore the tile exactly');
});

// ── renderCollabBadge: with peers ───────────────────────────────────────────

test('one peer: one avatar, singular aria-label, no overflow chip', () => {
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ name: 'Priya' })]);
  const badge = tile.querySelector('.collab-tile-badge')!;
  assert.ok(badge, 'badge element missing');
  assert.equal(badge.querySelectorAll('.collab-tile-avatar').length, 1);
  assert.equal(badge.querySelector('.collab-tile-more'), null);
  assert.match(badge.getAttribute('aria-label') ?? '', /1 person/);
  assert.equal(badge.querySelector('.collab-tile-dot')?.getAttribute('data-state'), 'live');
});

test('more than 3 peers: caps at 3 avatars plus a "+N" overflow chip', () => {
  const { document } = dom();
  const tile = realTile(document);
  const peers = ['a', 'b', 'c', 'd', 'e'].map((id) => peer({ id, name: id.toUpperCase() }));
  renderCollabBadge(tile, peers);
  const badge = tile.querySelector('.collab-tile-badge')!;
  assert.equal(badge.querySelectorAll('.collab-tile-avatar').length, 4); // 3 shown + the "+2" chip itself carries the class
  const more = badge.querySelector('.collab-tile-more');
  assert.equal(more?.textContent, '+2');
  assert.match(badge.getAttribute('aria-label') ?? '', /5 people/);
});

test('an away peer carries the away modifier class and a text hint (opacity is not the only signal)', () => {
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ away: true, name: 'Priya' })]);
  const av = tile.querySelector('.collab-tile-avatar--away');
  assert.ok(av);
  assert.match(av!.getAttribute('title') ?? '', /away/i);
});

test('a nameless peer falls back to a bullet, never a blank avatar', () => {
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ name: undefined })]);
  const av = tile.querySelector('.collab-tile-avatar')!;
  assert.equal(av.textContent?.trim().length > 0, true);
});

test('the collaborator colour lands as the --collab-color custom property', () => {
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ color: '#ff00aa' })]);
  const av = tile.querySelector('.collab-tile-avatar') as HTMLElement;
  assert.equal(av.style.getPropertyValue('--collab-color'), '#ff00aa');
});

test('re-render is idempotent: no duplicate badges, updates the existing one in place', () => {
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ id: 'a' })]);
  renderCollabBadge(tile, [peer({ id: 'a' }), peer({ id: 'b' })]);
  assert.equal(tile.querySelectorAll('.collab-tile-badge').length, 1);
  assert.equal(tile.querySelectorAll('.collab-tile-avatar').length, 2);
});

test('renderCollabBadge never disturbs sibling tile chrome (.tile-primary, .tile-menu-btn)', () => {
  const { document } = dom();
  const tile = realTile(document);
  const primaryBefore = tile.querySelector('.tile-primary')?.outerHTML;
  const menuBefore = tile.querySelector('.tile-menu-btn')?.outerHTML;
  renderCollabBadge(tile, [peer(), peer({ id: 'b' })]);
  assert.equal(tile.querySelector('.tile-primary')?.outerHTML, primaryBefore);
  assert.equal(tile.querySelector('.tile-menu-btn')?.outerHTML, menuBefore);
});

// Collision guard: collab-pill.ts / collab-focus.ts / collab-overlay.ts each
// inject their OWN unlayered stylesheet using bare `.collab-pill`, `.collab-dot`,
// `.collab-av`, `.collab-ring*`, `.collab-chip*` and `.collab-cursor*` class
// names (see collab.css's header for why an unlayered sheet always beats this
// file's `@layer chrome` rules). The tile badge must never emit any of those
// bare names - every class it writes has to carry the `collab-tile-` prefix, or
// a future page that has ALSO mounted one of those components (their injected
// `<style>` persists for the SPA session, past a route change) would silently
// re-skin this badge with a stranger's CSS.
test('every class this module writes is collab-tile-prefixed - never a bare collab-* name another component owns', () => {
  const { document } = dom();
  const tile = realTile(document);
  const peers = ['a', 'b', 'c', 'd'].map((id) => peer({ id, away: id === 'a' }));
  renderCollabBadge(tile, peers);
  const badge = tile.querySelector('.collab-tile-badge')!;
  const classes = new Set<string>();
  for (const el of [badge, ...badge.querySelectorAll('*')]) {
    for (const c of el.classList) classes.add(c);
  }
  assert.ok(classes.size > 0, 'sanity: the badge should have painted some classes');
  for (const c of classes) {
    assert.match(
      c,
      /^collab-tile-/,
      `"${c}" is not collab-tile-prefixed - it risks colliding with an ` +
        'unlayered stylesheet injected by collab-pill.ts / collab-focus.ts / collab-overlay.ts'
    );
  }
});

test('a hostile peer colour cannot inject CSS declarations onto the tile', () => {
  // section 11.21: inbound presence is untrusted, continuously. `escape()` (utils.ts) covers
  // `&<>"'` and nothing else, so a colour interpolated into a `style=` attribute would
  // carry a `;` straight through and land arbitrary declarations on the avatar. Every
  // other collab surface writes this value through `style.setProperty`, which rejects
  // the whole thing rather than parsing it as a declaration list - and so does this.
  const { document } = dom();
  const tile = realTile(document);
  renderCollabBadge(tile, [peer({ color: 'red;background-image:url(https://x/?leak)' })]);
  const av = tile.querySelector('.collab-tile-avatar') as HTMLElement;

  assert.equal(av.style.getPropertyValue('--collab-color'), '',
    'the malformed value is dropped, not applied');
  assert.equal(av.style.backgroundImage, '', 'and nothing else was smuggled in with it');
  assert.ok(!(av.getAttribute('style') ?? '').includes('background-image'),
    'the style attribute carries no injected declaration');

  // Every colour syntax this codebase actually mints still lands, so the screen is a
  // shape check and not a blanket refusal.
  for (const ok of ['#ff00aa', 'rgb(255, 0, 170)', 'hsl(320 100% 50% / 0.9)', 'oklch(0.7 0.12 190)']) {
    renderCollabBadge(tile, [peer({ color: ok })]);
    assert.equal(
      (tile.querySelector('.collab-tile-avatar') as HTMLElement).style.getPropertyValue('--collab-color'),
      ok,
    );
  }
});
