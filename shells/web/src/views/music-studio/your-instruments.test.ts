// SPDX-License-Identifier: MPL-2.0
/**
 * Your instruments (views/music-studio/your-instruments.ts) and the genre Manage list's
 * lines (views/music-studio/genre-manage.ts): every star and block for every part, in one
 * list, favourites first and each part in its own order, and the toast says what a change
 * did so Undo can take it back.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/your-instruments.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { removedLine, yourEntries } from './your-instruments.ts';
import { genrePrefLine } from './genre-manage.ts';

test('every star and block, favourites first, by part (Melody, Chords, Bass) and in each part\'s own order', () => {
  const prefs = { favourites: new Set(['bass:upright', 'lead:fiddle', 'lead:banjo', 'keys:felt', 'lead:notAnInstrument']), blocked: new Set(['keys:organ']) };
  const list = yourEntries(prefs).map(e => `${e.kind}:${e.part}:${e.id}`);
  assert.deepEqual(list.slice(-1), ['blocked:keys:organ'], 'blocks after favourites');
  assert.deepEqual(list.filter(x => x.startsWith('favourite:lead')).length, 2, 'an instrument this build does not know is left out');
  const parts = list.map(x => x.split(':')[1]);
  assert.deepEqual(parts.slice(0, 4), ['lead', 'lead', 'keys', 'bass'], 'Melody, then Chords, then Bass');
  assert.equal(yourEntries({ favourites: new Set(), blocked: new Set() }).length, 0);
});

test('the toast says what a removal did', () => {
  assert.equal(removedLine({ part: 'lead', id: 'banjo', kind: 'favourite' }, 'Banjo'), 'Banjo is no longer a favourite.');
  assert.equal(removedLine({ part: 'keys', id: 'organ', kind: 'blocked' }, 'Organ'), 'Organ can play in shuffles again.');
  assert.equal(genrePrefLine('favourite', true, 'Jazz'), 'Jazz is a favourite: it leads the genre picker and comes up more often in shuffles.');
  assert.equal(genrePrefLine('hidden', true, 'Metal'), 'Metal is hidden: the picker and shuffle leave it out.');
  assert.equal(genrePrefLine('hidden', false, 'Metal'), 'Metal shows again.');
});

test('every change offers Undo in the shared toast, and puts the genre or instrument back as it stood', () => {
  const read = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
  for (const src of [read('./genre-manage.ts'), read('./your-instruments.ts')]) {
    assert.match(src, /showUndoToast\(\{/);
    assert.match(src, /undo: \(\) =>/);
  }
  assert.match(read('./genre-manage.ts'), /if \(was\) deps\.setPref\(entry\.mood, was, true\);/, 'a hidden genre unhidden by a star comes back hidden');
});
