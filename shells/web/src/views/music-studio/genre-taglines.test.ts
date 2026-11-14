// SPDX-License-Identifier: MPL-2.0
/**
 * The line under the genre's title on the music generator's genre button
 * (views/music-studio/genre-taglines.ts): every genre has its own, each eight words or
 * fewer in plain English, and a genre the table does not know yet still gets a line.
 *
 * A genre added to the composer without a line fails the first test, which lists it:
 * add its line to genreTaglines(), written from how the composer builds that genre.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/genre-taglines.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOFI_MOODS } from '../../../../../engine/src/lofi-compose.ts';
import { GENRE_GROUPS } from '../../lib/genre-icons.ts';
import { genreTagline, genreTaglines } from './genre-taglines.ts';

test('every genre has its own line', () => {
  const lines = genreTaglines();
  const missing = [...new Set([...LOFI_MOODS, ...GENRE_GROUPS.flatMap(g => g.moods)])].filter(m => !Object.hasOwn(lines, m));
  assert.deepEqual(missing, [], `add a line for ${missing.join(', ')} in genre-taglines.ts`);
});

test('each line is eight words or fewer, in sentence case, with no dash and no closing stop', () => {
  for (const [mood, line] of Object.entries(genreTaglines())) {
    const words = line.split(/\s+/).filter(Boolean);
    assert.ok(words.length >= 2 && words.length <= 8, `${mood}: "${line}" is ${words.length} words`);
    assert.match(line, /^\p{Lu}|^\d/u, `${mood}: starts with a capital`);
    assert.doesNotMatch(line, /[—–]|\.$/, `${mood}: no dash, no full stop`);
  }
});

test('a genre the table does not know yet gets a plain line, never a blank', () => {
  const line = genreTagline('notAGenreYet');
  assert.ok(line.length > 0);
  assert.equal(line, genreTagline('anotherNewOne'), 'the same line for any unknown genre');
  assert.notEqual(genreTagline('straya'), line);
  assert.equal(genreTagline('straya'), 'Didgeridoo, banjo and bush birds');
  assert.equal(genreTagline('constructor'), line, 'an id that is a property of every object is still unknown');
});

test('the lines are copy a person reads, so each is a literal t() call', () => {
  const src = readFileSync(new URL('./genre-taglines.ts', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('return {'), src.indexOf('};'));
  const entries = body.split('\n').filter(l => /^\s+\w+: /.test(l));
  assert.ok(entries.length >= LOFI_MOODS.length);
  for (const l of entries) assert.match(l, /^\s+\w+: t\('[^']+'\),$/, l.trim());
});
