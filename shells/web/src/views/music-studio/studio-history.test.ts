// SPDX-License-Identifier: MPL-2.0
/**
 * Undo and redo in the music generator (views/music-studio/studio-history.ts): a run of
 * changes undoes newest first and redoes in the order it was made, a slider dragged with
 * the pointer held is one step however many values it passes through, quick key presses
 * on one slider merge, a new change after an undo clears the redo, and the keys that step
 * the history are Cmd or Ctrl+Z, with Shift to redo, and Ctrl+Y.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/studio-history.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStudioHistory, historyKey, stableJson, undoneLine, redoneLine } from './studio-history.ts';

/** A small studio: a genre, a seed and a level, kept as the view keeps it (one string a step). */
function studio(start = { mood: 'sugar', seed: 1, level: 1 }) {
  let live = { ...start };
  let clock = 0;
  const h = createStudioHistory({
    read: () => stableJson(live),
    write: (snap) => { live = JSON.parse(snap); },
    now: () => clock,
  });
  return {
    h,
    get: () => live,
    set: (patch: Partial<typeof start>) => { live = { ...live, ...patch }; },
    tick: (ms: number) => { clock += ms; },
  };
}

test('a run of changes undoes newest first and redoes in order', () => {
  const s = studio();
  s.set({ mood: 'straya' }); s.h.commit('Genre');
  s.tick(10); s.set({ seed: 2 }); s.h.commit('Seed');
  s.tick(10); s.set({ seed: 3 }); s.h.commit('Seed');
  s.tick(10); s.set({ level: 1.4 }); s.h.commit('Melody level', 'slider:lead');
  assert.deepEqual(s.h.sizes(), { undo: 4, redo: 0 }, 'each change its own step, the two seeds included');
  assert.equal(s.h.undo(), 'Melody level');
  assert.deepEqual(s.get(), { mood: 'straya', seed: 3, level: 1 });
  assert.equal(s.h.undo(), 'Seed');
  assert.equal(s.get().seed, 2);
  assert.equal(s.h.undo(), 'Seed');
  assert.equal(s.h.undo(), 'Genre');
  assert.deepEqual(s.get(), { mood: 'sugar', seed: 1, level: 1 }, 'back where it started');
  assert.equal(s.h.undo(), null, 'nothing more to undo');
  assert.equal(s.h.redo(), 'Genre');
  assert.equal(s.h.redo(), 'Seed');
  assert.deepEqual(s.get(), { mood: 'straya', seed: 2, level: 1 });
  assert.equal(s.h.redoLabel(), 'Seed', 'the next redo is the second seed');
  assert.equal(s.h.undoLabel(), 'Seed');
});

test('a slider dragged with the pointer held is one step, however long the drag', () => {
  const s = studio();
  s.h.beginHold();
  for (let v = 1; v <= 1.5; v += 0.05) { s.tick(700); s.set({ level: v }); s.h.commit('Melody level', 'slider:lead'); }
  s.h.endHold();
  assert.deepEqual(s.h.sizes(), { undo: 1, redo: 0 }, 'one step, though the drag paused longer than the merge window');
  s.h.undo();
  assert.equal(s.get().level, 1, 'and one undo takes the whole drag back');
});

test('quick key presses on one slider merge; slow ones and other controls stay apart', () => {
  const s = studio();
  for (const v of [1.05, 1.1, 1.15]) { s.tick(100); s.set({ level: v }); s.h.commit('Melody level', 'slider:lead'); }
  assert.equal(s.h.sizes().undo, 1, 'three presses inside half a second are one step');
  s.tick(2000); s.set({ level: 1.2 }); s.h.commit('Melody level', 'slider:lead');
  assert.equal(s.h.sizes().undo, 2, 'a press after a pause is a new step');
  s.tick(50); s.set({ seed: 9 }); s.h.commit('Seed');
  assert.equal(s.h.sizes().undo, 3, 'another control is always its own step');
});

test('a change after an undo clears the redo, and a change to nothing is no step', () => {
  const s = studio();
  s.set({ seed: 2 }); s.h.commit('Seed');
  s.h.undo();
  assert.equal(s.h.redoLabel(), 'Seed');
  s.set({ mood: 'kpop' }); s.h.commit('Genre');
  assert.equal(s.h.redoLabel(), '', 'the old future is gone');
  assert.equal(s.h.commit('Seed'), false, 'nothing changed, so no step');
  assert.equal(s.h.sizes().undo, 1);
});

test('rebase takes the studio as it is without a step, and the next step starts from there', () => {
  const s = studio();
  s.set({ seed: 7 }); s.h.rebase();
  assert.equal(s.h.sizes().undo, 0);
  s.set({ mood: 'jazz' }); s.h.commit('Genre');
  s.h.undo();
  assert.deepEqual(s.get(), { mood: 'sugar', seed: 7, level: 1 }, 'undo goes back to the rebased studio, not the first one');
});

test('the same studio is the same string, whatever order its keys were set in', () => {
  assert.equal(stableJson({ b: 1, a: { d: [1, { z: 1, y: 2 }], c: undefined } }), stableJson({ a: { d: [1, { y: 2, z: 1 }] }, b: 1 }));
  assert.equal(stableJson({ a: undefined }), '{}', 'an unset setting is left out');
});

test('Cmd or Ctrl+Z undoes, Shift redoes, Ctrl+Y redoes; anything else is left alone', () => {
  const k = (key: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>> = {}) =>
    historyKey({ key, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...mods });
  assert.equal(k('z', { metaKey: true }), 'undo');
  assert.equal(k('z', { ctrlKey: true }), 'undo');
  assert.equal(k('Z', { metaKey: true, shiftKey: true }), 'redo');
  assert.equal(k('z', { ctrlKey: true, shiftKey: true }), 'redo');
  assert.equal(k('y', { ctrlKey: true }), 'redo');
  assert.equal(k('y', { metaKey: true }), null, 'Cmd+Y is the browser\'s history, not ours');
  assert.equal(k('z'), null, 'a bare Z is not a shortcut');
  assert.equal(k('z', { metaKey: true, altKey: true }), null);
});

test('the status line says what was undone or redone', () => {
  assert.equal(undoneLine('Shuffle'), 'Undone: Shuffle');
  assert.equal(redoneLine('Melody level'), 'Redone: Melody level');
});

test('the view records a step at every change a person makes, and undo plays on', () => {
  const src = readFileSync(new URL('../music-studio.ts', import.meta.url), 'utf8');
  for (const label of ['Genre', 'Seed', 'Shuffle', 'Reset', 'Length', 'Tempo', 'Key', 'Lolly tag', 'Drum kit', 'Snare', 'Cymbals', 'Drums on']) {
    assert.match(src, new RegExp(`step\\([^\\n]*t\\('${label}'\\)`), `a change of ${label} is a step`);
  }
  assert.match(src, /step\(attr === 'mute' \? tRaw\('Mute: \{track\}'/, 'mute and solo are steps');
  assert.match(src, /'\{track\} instrument'/, 'an instrument chosen is a step');
  assert.match(src, /listen\('\[data-slider\]', 'change', [^\n]*`slider:\$\{/, 'a slider is a step when let go, grouped by slider');
  assert.match(src, /listen\('\[data-slider\]', 'pointerdown', \(\) => studioHistory\.beginHold\(\)\)/, 'a held pointer is one step');
  // Undo of a level, mute or solo sets the mix as the track plays; only a change to the notes recomposes.
  const apply = src.slice(src.indexOf('function applySnapshot'), src.indexOf('const studioHistory'));
  assert.doesNotMatch(apply, /stopPlayback/, 'undo never stops the track');
  assert.match(apply, /if \(tuneOf\(state\) !== before\.tune\)/);
});
