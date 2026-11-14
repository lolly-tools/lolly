// SPDX-License-Identifier: MPL-2.0
/**
 * The genre lock and the genre button (views/music-studio/genre-hero.ts): the lock is one
 * pressed toggle beside the genre button (a closed padlock keeps the genre), it says what
 * shuffle does now, shuffle keeps the genre while it is locked, and the genre picker has
 * no switch of its own any more, so there is one control.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/genre-hero.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { genreHeroHtml, lockLine, wireGenreLock } from './genre-hero.ts';
import { shuffleMusic } from '../../lib/music-shuffle.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';

/** A seeded random source, so the shuffles replay. */
const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

test('the lock sits before the genre button, a toggle named for what it keeps', () => {
  const html = genreHeroHtml();
  assert.ok(html.indexOf('data-genre-lock') < html.indexOf('data-genre '), 'lock, then the genre');
  assert.match(html, /data-genre-lock aria-pressed="false" aria-label="Keep this genre when shuffling" title="Keep this genre when shuffling"/);
  assert.match(html, /ms-lock-open[\s\S]*ms-lock-shut/, 'an open and a closed padlock, one shown at a time');
  assert.match(html, /data-genre-tag/, 'a line under the title');
});

test('pressing the lock keeps the genre, says so in the status line, and pressing again lets it go', () => {
  const { window } = new JSDOM(genreHeroHtml());
  const button = window.document.querySelector<HTMLElement>('[data-genre-lock]')!;
  let locked = false;
  const said: string[] = [];
  wireGenreLock(button, { locked: () => locked, setLocked: (on) => { locked = on; }, genre: () => 'straya', say: (t) => said.push(t) });
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  button.dispatchEvent(new window.MouseEvent('click'));
  assert.equal(locked, true);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(said.at(-1), 'Shuffle keeps Straya now, and draws a new seed and sound.');
  button.dispatchEvent(new window.MouseEvent('click'));
  assert.equal(locked, false);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(said.at(-1), lockLine(false, 'straya'));
});

test('while the genre is locked, shuffle keeps it and draws a new seed', () => {
  const rand = seeded(42);
  const seeds = new Set<number>();
  for (let i = 0; i < 12; i++) {
    const drawn = shuffleMusic(rand, { bars: 64, after: 'straya', genre: 'straya' });
    assert.equal(drawn.mood, 'straya');
    seeds.add(drawn.seed);
  }
  assert.ok(seeds.size > 1, 'the seed still changes');
  const free = new Set<LofiMood>();
  for (let i = 0; i < 12; i++) free.add(shuffleMusic(rand, { bars: 64, after: 'straya' }).mood);
  assert.ok(!free.has('straya'), 'unlocked, shuffle moves off the genre playing');
});

test('the view shuffles inside the genre while it is locked, and keeps the lock on the profile', () => {
  const src = readFileSync(new URL('../music-studio.ts', import.meta.url), 'utf8');
  assert.match(src, /shuffleGenres \? \{\} : \{ genre: state\.mood \}/);
  assert.match(src, /wireGenreLock\([^\n]*locked: \(\) => !shuffleGenres, setLocked: \(on\) => saveShuffleGenres\(!on\)/);
  assert.match(src, /setShuffleGenres\(profile, on\)/, 'the same Profile.music preference as before');
  const picker = readFileSync(new URL('./genre-picker.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(picker, /role="switch"|data-shuffle-genres|Shuffle genres'/, 'the picker has no switch: one control');
});

test('a change of genre lights the button only without reduced motion asked for', () => {
  const src = readFileSync(new URL('./genre-hero.ts', import.meta.url), 'utf8');
  assert.match(src, /function light\(\): void \{\n\s+if \(prefersReducedMotion\(\)\) return;/);
  const css = readFileSync(new URL('../../styles/parts/music-studio.css', import.meta.url), 'utf8');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n\s+\.ms-genre\.is-lit/);
  assert.match(css, /html\[data-a11y-motion="reduce"\] \.ms-genre\.is-lit/);
});
