// SPDX-License-Identifier: MPL-2.0
/**
 * Projects favourites - star a folder/session/image (context menu + selection bar), persisted
 * on the profile (`favouriteProjects`), surfaced as a strip at the top of the root view.
 *
 * Source scan, for the same reason as views/projects-duplicate.test.ts: views/projects.ts
 * can't be imported outside Vite. The store itself (lib/project-favourites.ts) IS importable
 * and covered inline below.
 *
 * Run directly:  node --test shells/web/src/views/projects-favourites.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => { const at = l.search(/(^|[^:])\/\//); return at === -1 ? l : l.slice(0, at === 0 ? 0 : at + 1); }).join('\n');
const CODE = strip(readFileSync(join(HERE, 'projects.ts'), 'utf8'));
const STORE = readFileSync(join(HERE, '..', 'lib', 'project-favourites.ts'), 'utf8');

test('the store persists to its OWN profile field (not tools/assets favourites)', () => {
  assert.match(STORE, /profile\?\.favouriteProjects/, 'reads profile.favouriteProjects');
  assert.match(STORE, /profile\.favouriteProjects = \[\.\.\.favs\]/, 'writes it back');
  assert.match(STORE, /host\.profile\.set\?\.\(profile\)/, 'flushes via profile.set, guarded');
});

test('every tile menu (folder / image / session) offers Favourite', () => {
  // One helper builds the row; each branch calls fav().
  assert.match(CODE, /menuItem\('fav', favourites\.has\(ref\) \? STAR_FILLED_ICON : STAR_ICON/, 'a filled star when already favourited');
  const body = CODE.slice(CODE.indexOf('function tileMenuHtml'), CODE.indexOf('function bulkMenuHtml'));
  assert.equal((body.match(/\bfav\(\)/g) ?? []).length, 3, 'fav() appears in all three branches');
});

test('the menu dispatch + bulk both route to their favourite handlers', () => {
  assert.match(CODE, /act === 'fav'\) toggleFavourite\(ref\)/, 'per-tile fav toggles that ref');
  assert.match(CODE, /id: 'favourite', icon: STAR_ICON/, 'the selection bar lists Favourite');
  assert.match(CODE, /action === 'favourite'\) \{ favouriteSelection\(\); return; \}/, 'handleBulk routes it');
  assert.match(CODE, /\[\.\.\.selected\.keys\(\)\]\.every\(r => favourites\.has\(r\)\) \? t\('Unfavourite'\) : t\('Favourite'\)/,
    'the bulk label flips to Unfavourite when the whole selection is already starred');
});

test('toggle + bulk persist to the profile and repaint', () => {
  const t = CODE.slice(CODE.indexOf('async function toggleFavourite'), CODE.indexOf('async function favouriteSelection'));
  assert.match(t, /if \(favourites\.has\(ref\)\) favourites\.delete\(ref\); else favourites\.add\(ref\)/, 'toggles the ref');
  assert.match(t, /saveProjectFavourites\(host, profile, favourites\)/, 'persists');
  const b = CODE.slice(CODE.indexOf('async function favouriteSelection'), CODE.indexOf('async function favouriteSelection') + 700);
  assert.match(b, /const allFav = refs\.every\(r => favourites\.has\(r\)\)/, 'bulk is a toggle over the whole selection');
});

test('the favourites strip mounts at the root only, from the starred refs', () => {
  // List mode skips the hero (plans/133 Part C, C2h) - the gate is favourites AND not the table.
  assert.match(CODE, /favourites\.size && !list \?/, 'the strip mount is gated on having favourites (and grid mode)');
  assert.match(CODE, /data-fav-strip/, 'root markup has the strip mount element');
  assert.match(CODE, /function mountFavStrip\(root: HTMLElement\)/, 'a dedicated mount fn');
  assert.match(CODE, /root\.querySelector<HTMLElement>\('\[data-fav-strip\]'\)/, 'finds ITS mount only (exists in rootHtml)');
  assert.match(CODE, /featuredHandle = mountFeaturedRow\(mount, tiles, host, \{/, 'reuses the shared featured strip');
  // favEntries resolves each ref kind
  assert.match(CODE, /const folder = folders\.find\(f => f\.id === ref\)/, 'resolves favourited folders');
});
