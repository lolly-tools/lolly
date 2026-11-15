// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { resolveSonicRecipe } from '../../../../../engine/src/sonic-profile.ts';
import { lofiTuneBytes, lofiTuneFromBytes } from '../../lib/lofi-tune.ts';
import { musicProjectRecord } from '../../lib/music-project.ts';
import { parseMusicState } from '../../lib/music-state.ts';
import { sonicMusicAdapter, starterSonicProfile } from '../../lib/sonic-music.ts';
import { tuneSource, tuneSourceIngredient } from '../../lib/tune-provenance.ts';
import { mountMusicSoundProfile } from './sound-profile.ts';
import { clearSoundEdit, readSoundEdit, SOUND_ROOM_HREF, writeSoundEdit } from '../../lib/sound-edit-handoff.ts';

test('a kept profile permits new seeds, refuses drift and leaves the original intact when detached', async () => {
  const dom = new JSDOM('<main></main>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const profile = starterSonicProfile('qa-sound', 'QA');
    profile.identity.character = 'Private unpublished direction';
    const { recipe } = await resolveSonicRecipe(profile, { seed: 17 }, sonicMusicAdapter);
    assert.ok(recipe);
    const state = parseMusicState(recipe.music.parameters);
    const saved = musicProjectRecord(state, 'QA', recipe);
    let independent = 0;
    const panel = mountMusicSoundProfile(
      document.querySelector('main')!,
      state,
      (next) => Object.assign(state, next),
      () => independent++
    );
    panel.pending();
    await assert.rejects(panel.retained(), /Wait/);
    await panel.load(saved);
    assert.equal((await panel.retained())?.profileSha256, recipe.profileSha256);
    state.seed = 18;
    assert.equal((await panel.retained())?.seed, 18);
    state.bpm = 180;
    panel.refresh();
    await assert.rejects(panel.retained(), /Put the sound back/);
    document.querySelector<HTMLButtonElement>('[data-sound-reapply]')!.click();
    assert.equal(state.bpm, parseMusicState(recipe.music.parameters).bpm);
    assert.equal((await panel.retained())?.seed, 18);
    document.querySelector<HTMLButtonElement>('[data-sound-detach]')!.click();
    assert.equal(independent, 1);
    assert.equal(await panel.retained(), undefined);
    assert.deepEqual(saved.__musicStudio.sonic, recipe);
    panel.teardown();
    const invalid = mountMusicSoundProfile(
      document.querySelector('main')!,
      state,
      () => {},
      () => {}
    );
    await invalid.load({ __musicStudio: { sonic: { schemaVersion: 99 } } });
    await assert.rejects(invalid.retained(), /Put the sound back/);
    invalid.teardown();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
    dom.window.close();
  }
});

test('a saved tune keeps its sound context while public credentials expose only the recipe digest', async () => {
  const profile = starterSonicProfile('qa-sound', 'QA');
  profile.identity.character = 'Private unpublished direction';
  const { recipe: sonic } = await resolveSonicRecipe(profile, { seed: 19 }, sonicMusicAdapter);
  assert.ok(sonic);
  const state = parseMusicState(sonic.music.parameters);
  const recipe = { mood: state.mood, seed: state.seed, generator: sonic.music.parameters, sonic };
  assert.deepEqual(lofiTuneFromBytes(lofiTuneBytes(recipe)), recipe);
  const ingredient = await tuneSourceIngredient(tuneSource(recipe), { withMaker: false });
  const publicJson = JSON.stringify(ingredient);
  assert.ok(!publicJson.includes('Private unpublished direction'));
  assert.ok(!publicJson.includes('sonicProfile'));
});

test('editing a use for the Sound room: the line names it, and both buttons go back with an answer', async () => {
  const dom = new JSDOM('<main></main>');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const profile = starterSonicProfile('qa-sound', 'Harbour');
    const trip = { v: 1 as const, system: 'harbour', label: 'Harbour', base: null, profile, contextId: 'play', picked: true, dirty: true, at: Date.now() };
    const state = parseMusicState(profile.contexts[2]!.music.parameters);
    const went: string[] = [];
    for (const [button, answer] of [['[data-sound-keep]', 'keep'], ['[data-sound-cancel]', 'cancel']] as const) {
      writeSoundEdit(trip);
      const line = mountMusicSoundProfile(document.querySelector('main')!, state, () => {}, () => {}, { editing: true, navigate: (href) => went.push(href) });
      assert.equal(line.editing(), true);
      const aside = document.querySelector<HTMLElement>('.ms-sound-profile')!;
      assert.equal(aside.hidden, false);
      assert.match(aside.textContent ?? '', /Editing Play for Harbour/);
      state.bpm = 131;
      document.querySelector<HTMLButtonElement>(button)!.click();
      assert.equal(went.at(-1), SOUND_ROOM_HREF);
      const result = readSoundEdit()?.result;
      if (answer === 'keep') {
        assert.ok(result && 'parameters' in result);
        assert.equal(parseMusicState(result.parameters).bpm, 131, 'the generator’s settings go back to the room');
      } else assert.deepEqual(result, { cancelled: true });
      line.teardown();
    }
    // Without a trip (the address was shared, or the trip is over) the line stays away.
    clearSoundEdit();
    const none = mountMusicSoundProfile(document.querySelector('main')!, state, () => {}, () => {}, { editing: true });
    assert.equal(none.editing(), false);
    assert.equal(document.querySelector<HTMLElement>('.ms-sound-profile')!.hidden, true);
    none.teardown();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
    dom.window.close();
  }
});
