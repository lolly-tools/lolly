// SPDX-License-Identifier: MPL-2.0
/**
 * The Sound room (rooms/sound.ts): it opens on the starting sounds alone, choosing one
 * makes it the sound of every use and shows the uses as chips that play, and Edit in the
 * music generator takes the room's draft there and back (lib/sound-edit-handoff.ts).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/rooms/sound.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="room"></div></body></html>', { url: 'http://localhost/#/start?area=sound' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.CSS = { escape: (value: string) => value.replace(/["\\]/g, '\\$&') };
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.sessionStorage = dom.window.sessionStorage;
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
(dom.window as unknown as { matchMedia: unknown }).matchMedia = g.matchMedia;

const { mountSoundRoom } = await import('./sound.ts');
const { SONIC_DIRECTIONS, soundSummary: soundSummaryOf } = await import('../../sonic-music.ts');
const { parseMusicState, musicStateParams } = await import('../../music-state.ts');
const { readSoundEdit, finishSoundEdit, clearSoundEdit } = await import('../../sound-edit-handoff.ts');
const { sonicProfileOf } = await import('../../../../../../engine/src/sonic-profile.ts');
type Options = Parameters<typeof mountSoundRoom>[1];

/** A design system on a fake bridge: what Save writes is what the next read returns. */
function fakeHost(initial: Record<string, unknown> = { color: { ink: { $type: 'color', $value: '#112233' } } }) {
  let doc: Record<string, unknown> = structuredClone(initial);
  const saved: Array<Record<string, unknown>> = [];
  const host = {
    tokens: {
      raw: async () => structuredClone(doc),
      snapshot: async () => ({ document: structuredClone(doc) }),
      active: async () => ({ id: 'harbour', label: 'Harbour' }),
    },
    brandAdoption: {
      capture: async () => ({ snapshot: true }),
      prepare: async (_snapshot: unknown, next: { doc: Record<string, unknown> }) => next,
      commit: async (candidate: { doc: Record<string, unknown> }) => { doc = structuredClone(candidate.doc); saved.push(candidate.doc); },
    },
    assets: { query: async () => [], get: async () => ({ url: '', format: 'wav' }) },
    state: { save: async () => {} },
    speech: {
      voices: async () => [{ id: 'bf_lily', name: 'Lily', lang: 'en-GB' }],
      synthesize: async () => ({ pcm: new Float32Array(10), sampleRate: 48000, duration: 1 }),
    },
  };
  return { host: host as unknown as Options['host'], saved, doc: () => doc };
}

const studio = { load: async () => {}, checkpoint: async () => {} } as unknown as Options['studio'];
const audio = { src: '', play: async () => {}, pause() {}, addEventListener() {}, removeEventListener() {}, currentTime: 0, duration: 0 };
const until = async (check: () => unknown, what: string): Promise<void> => {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise((r) => setTimeout(r, 5)); }
  assert.fail(`timed out waiting for ${what}`);
};
/** Each test mounts on a fresh element, so a test that fails part way leaves no listeners behind. */
let current = document.getElementById('room')!;
const room = () => current;
const click = (selector: string) => {
  const button = room().querySelector<HTMLButtonElement>(selector);
  assert.ok(button, `no ${selector} in ${room().textContent}`);
  button.click();
};
/** The settings that make a sound itself: everything but the seed and the balance. */
const character = (parameters: string) => {
  const state = parseMusicState(parameters);
  return musicStateParams({ ...state, seed: 0, mix: parseMusicState('style=warm&seed=0').mix });
};

function mount(extra: Partial<Options> = {}) {
  const fresh = document.createElement('div');
  current.replaceWith(fresh);
  current = fresh;
  const heard: Array<{ parameters: string | readonly string[]; narrated: boolean }> = [];
  const went: string[] = [];
  const fake = (extra.host ? null : fakeHost());
  const handle = mountSoundRoom(room(), {
    host: fake?.host ?? extra.host!,
    studio,
    audio,
    audition: async (parameters, _signal, narration) => { heard.push({ parameters, narrated: !!narration }); return new Blob(['x']); },
    navigate: (href) => { went.push(href); },
    ...extra,
  });
  return { handle, heard, went, fake };
}

test('a design system with no sound opens on the starting sounds alone', async () => {
  clearSoundEdit();
  const { handle } = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  assert.equal(room().querySelectorAll('.sound-card').length, SONIC_DIRECTIONS.length + 1, 'three sounds and the mix');
  assert.equal(room().querySelector('.sound-uses'), null, 'no uses until a sound is chosen');
  assert.equal(room().querySelectorAll('input, select, textarea').length, 0, 'nothing to fill in at first');
  assert.equal(room().querySelectorAll('[data-choose]').length, SONIC_DIRECTIONS.length + 1);
  assert.equal(room().querySelector<HTMLElement>('[data-bar]')?.hidden, true, 'nothing to save yet');
  assert.equal(room().querySelector<HTMLElement>('[data-endbar]')?.hidden, true);
  handle.teardown();
});

test('a starting sound plays in place, and only one plays at a time', async () => {
  clearSoundEdit();
  const { handle, heard } = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  const [first, second] = SONIC_DIRECTIONS;
  click(`[data-play="dir:${first!.id}"]`);
  await until(() => heard.length === 1, 'the first preview');
  assert.equal(heard[0]!.parameters, first!.parameters, 'a card plays its exact recipe');
  await until(() => room().querySelector(`[data-play="dir:${first!.id}"]`)?.getAttribute('aria-pressed') === 'true', 'the first button to show it plays');
  click(`[data-play="dir:${second!.id}"]`);
  await until(() => heard.length === 2, 'the second preview');
  await until(() => room().querySelector(`[data-play="dir:${second!.id}"]`)?.getAttribute('aria-pressed') === 'true', 'the second to play');
  assert.equal(room().querySelector(`[data-play="dir:${first!.id}"]`)?.getAttribute('aria-pressed'), 'false', 'starting one stops the other');
  assert.equal(room().querySelectorAll('audio').length, 0, 'the player is never in the page');
  handle.teardown();
});

test('choosing a starting sound makes it every use’s sound, and each use keeps its own tune and balance', async () => {
  clearSoundEdit();
  const { handle, fake } = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  const bright = SONIC_DIRECTIONS.find((d) => d.id === 'play')!;
  click('[data-choose="play"]');
  await until(() => room().querySelector('.sound-uses'), 'the uses');
  assert.ok(room().querySelector('[data-direction="play"]')?.classList.contains('is-chosen'));
  assert.equal(room().querySelector('[data-sound-state]')?.textContent, 'Not saved yet');
  assert.equal(room().querySelector<HTMLElement>('[data-savebar]')?.hidden, false, 'Save sound shows once there is something to save');
  assert.equal(room().querySelectorAll('[data-save]').length, 2, 'beside the title and at the room’s end');
  assert.equal(room().querySelector<HTMLElement>('[data-endbar]')?.hidden, false);
  assert.equal(room().lastElementChild?.matches('[data-endbar]'), true, 'the end row comes after everything else');
  click('[data-save]');
  await until(() => fake!.saved.length === 1, 'the save');
  const profile = sonicProfileOf(fake!.doc()).profile!;
  assert.equal(profile.revision, 1);
  assert.equal(profile.review.state, 'draft');
  const seeds = new Set<number>();
  for (const context of profile.contexts) {
    assert.equal(character(context.music.parameters), character(bright.parameters), `${context.id} plays the chosen sound`);
    seeds.add(parseMusicState(context.music.parameters).seed);
  }
  assert.equal(seeds.size, profile.contexts.length, 'each use plays its own tune');
  const explain = profile.contexts.find((c) => c.id === 'explain')!;
  assert.equal(parseMusicState(explain.music.parameters).mix.lead, 0, 'Explain keeps the melody out of the voice’s way');
  await until(() => room().querySelector('[data-sound-state]')?.textContent === 'Saved', 'the saved state');
  handle.teardown();
});

test('the uses are chips that each play, with narration as a choice on the same player', async () => {
  clearSoundEdit();
  const { handle, heard } = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  click('[data-choose="explain"]');
  await until(() => room().querySelector('.sound-chip'), 'the chips');
  const chips = [...room().querySelectorAll('.sound-chip-name')].map((c) => c.textContent);
  assert.deepEqual(chips, ['ExplainMain', 'Demonstrate', 'Play']);
  assert.ok(![...room().querySelectorAll('details')].some((d) => (d as HTMLDetailsElement).open), 'every fold starts closed');
  for (const field of room().querySelectorAll('select, input, textarea'))
    assert.ok(field.closest('details:not([open])'), `${field.outerHTML.slice(0, 80)} waits in a closed fold`);

  click('[data-select="play"]');
  assert.equal(room().querySelector('.sound-use-name')?.textContent, 'Play');
  click('[data-play="use:demonstrate"]');
  await until(() => heard.length === 1, 'the use preview');
  assert.equal(heard[0]!.narrated, false);

  // With narration and no voice yet: the voice fold opens on the voice picker.
  click('[data-listen="voice"]');
  await until(() => room().querySelector<HTMLDetailsElement>('[data-fold="voice"]')?.open, 'the voice fold');
  assert.match(room().querySelector('[data-sound-status]')?.textContent ?? '', /Choose a voice/);
  const voice = room().querySelector<HTMLSelectElement>('[data-field="narration.voice"]')!;
  await until(() => voice.options.length > 1 || room().querySelector<HTMLSelectElement>('[data-field="narration.voice"]')!.options.length > 1, 'the voices');
  const picker = room().querySelector<HTMLSelectElement>('[data-field="narration.voice"]')!;
  picker.value = 'bf_lily';
  picker.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  click('[data-play="use:play"]');
  await until(() => heard.length === 2, 'the narrated preview');
  assert.equal(heard[1]!.narrated, true, 'the same play button now plays the voice over the music');
  handle.teardown();
});

test('adding a use names it in place', async () => {
  clearSoundEdit();
  const { handle } = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  click('[data-choose="explain"]');
  await until(() => room().querySelector('[data-add-use]'), 'Add a use');
  click('[data-add-use]');
  const name = room().querySelector<HTMLInputElement>('[data-field="context.label"]')!;
  assert.ok(name, 'the new use opens on its name');
  name.value = 'Launch';
  name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  name.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.equal(room().querySelector('.sound-use-name')?.textContent, 'Launch');
  assert.equal(room().querySelectorAll('.sound-chip').length, 4);
  handle.teardown();
});

test('Edit in the music generator takes the draft there and brings the new music back', async () => {
  clearSoundEdit();
  const first = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  click('[data-choose="explain"]');
  await until(() => room().querySelector('[data-edit-music]'), 'the edit button');
  click('[data-select="demonstrate"]');
  assert.equal(room().querySelector('.sound-use-name')?.textContent, 'Demonstrate');
  click('[data-edit-music]');
  assert.equal(first.went.length, 1);
  assert.match(first.went[0]!, /^#\/music\?style=warm&.*&sound=edit$/, 'the generator opens on this use’s settings');
  const trip = readSoundEdit();
  assert.ok(trip);
  assert.equal(trip.contextId, 'demonstrate');
  assert.equal(trip.dirty, true, 'an unsaved choice travels with the trip');
  first.handle.teardown();

  // The generator changes the tempo and saves it to this use.
  const edited = parseMusicState(new URLSearchParams(first.went[0]!.slice('#/music?'.length)).toString());
  edited.bpm = 96;
  finishSoundEdit({ parameters: musicStateParams(edited) });

  const back = mount({ host: first.fake!.host });
  await until(() => room().querySelector('.sound-uses'), 'the room again');
  assert.equal(readSoundEdit(), null, 'the trip is over');
  assert.equal(room().querySelector('.sound-use-name')?.textContent, 'Demonstrate', 'the edited use is the one shown');
  assert.match(room().querySelector('.sound-summary')?.textContent ?? '', /96 bpm/);
  assert.match(room().querySelector('[data-sound-status]')?.textContent ?? '', /Demonstrate has its new music/);
  assert.equal(room().querySelector('[data-sound-state]')?.textContent, 'Not saved yet', 'nothing is saved until Save sound');
  back.handle.teardown();
});

test('Cancel in the generator brings the draft back unchanged', async () => {
  clearSoundEdit();
  const first = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  click('[data-choose="play"]');
  await until(() => room().querySelector('[data-edit-music]'), 'the edit button');
  const before = room().querySelector('.sound-summary')?.textContent;
  click('[data-edit-music]');
  first.handle.teardown();
  finishSoundEdit({ cancelled: true });
  const back = mount({ host: first.fake!.host });
  await until(() => room().querySelector('.sound-uses'), 'the room again');
  assert.equal(room().querySelector('.sound-summary')?.textContent, before);
  assert.ok(room().querySelector('[data-direction="play"]')?.classList.contains('is-chosen'), 'the chosen sound is still chosen');
  assert.match(room().querySelector('[data-sound-status]')?.textContent ?? '', /Nothing was changed/);
  back.handle.teardown();
});

test('a draft made against an older save is left out rather than written over the newer one', async () => {
  clearSoundEdit();
  const first = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  click('[data-choose="explain"]');
  await until(() => room().querySelector('[data-edit-music]'), 'the edit button');
  click('[data-edit-music]');
  first.handle.teardown();
  // While this tab is in the generator, another tab saves a sound of its own.
  const pending = readSoundEdit()!;
  clearSoundEdit();
  const other = mount({ host: first.fake!.host });
  await until(() => room().querySelector('.sound-card'), 'the other tab');
  click('[data-choose="demonstrate"]');
  await until(() => room().querySelector('[data-save]'), 'its save button');
  click('[data-save]');
  await until(() => first.fake!.saved.length === 1, 'the other save');
  other.handle.teardown();
  // Back in this tab, the generator saves its edit to the use.
  const { writeSoundEdit } = await import('../../sound-edit-handoff.ts');
  writeSoundEdit({ ...pending, result: { parameters: 'style=jazz&seed=4' } });
  const back = mount({ host: first.fake!.host });
  await until(() => room().querySelector('[data-sound-status]')?.textContent, 'the message');
  assert.match(room().querySelector('[data-sound-status]')?.textContent ?? '', /changed while you were away/);
  assert.doesNotMatch(room().querySelector('.sound-summary')?.textContent ?? '', /Jazz/, 'the newer save stands');
  assert.equal(readSoundEdit(), null);
  back.handle.teardown();
});

test('a read-only design system shows its uses to play, and nothing to change', async () => {
  clearSoundEdit();
  const { withSonicProfile } = await import('../../../../../../engine/src/sonic-profile.ts');
  const { starterSonicProfile, applySonicDirection } = await import('../../sonic-music.ts');
  const profile = applySonicDirection(starterSonicProfile('sound', 'Harbour'), SONIC_DIRECTIONS[1]!);
  const { host } = fakeHost(withSonicProfile({}, profile));
  const ro = mount({ host, readonly: true });
  await until(() => room().querySelector('.sound-chip'), 'the chips');
  assert.equal(room().querySelector('.sound-card'), null, 'no starting sounds to choose from');
  assert.equal(room().querySelectorAll('[data-play^="use:"]').length, 3, 'every use still plays');
  for (const selector of ['[data-edit-music]', '[data-add-use]', '[data-rename]', '[data-save]', '[data-review]'])
    assert.equal(room().querySelector(selector), null, `${selector} is not offered`);
  for (const field of room().querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-field]'))
    assert.ok(field.disabled || (field as HTMLTextAreaElement).readOnly, `${field.dataset.field} cannot be changed`);
  assert.match(room().textContent ?? '', /Read-only/);
  ro.handle.teardown();
});

test('saving never floats over the room: no sticky or fixed positioning in its stylesheet', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../../styles/parts/start-sound.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /position:\s*(sticky|fixed)/, 'the save rows sit in the room’s flow, so they cover nothing');
});

test('the mix: a fourth card that plays every sound in turn, each use its own genre, and it survives a save', async () => {
  clearSoundEdit();
  const first = mount();
  await until(() => room().querySelector('.sound-card'), 'the cards');
  assert.equal(room().querySelectorAll('.sound-card').length, SONIC_DIRECTIONS.length + 1, 'three sounds and the mix');
  const mixCard = room().querySelector('[data-direction="mixed"]')!;
  assert.match(mixCard.textContent ?? '', /Mixed/);
  assert.equal(mixCard.querySelectorAll('.sound-card-icon').length, SONIC_DIRECTIONS.length, 'a disc for each use’s sound');

  click('[data-play="dir:mixed"]');
  await until(() => first.heard.length === 1, 'the mix preview');
  assert.deepEqual(first.heard[0]!.parameters, SONIC_DIRECTIONS.map((d) => d.parameters), 'one press hears each sound in turn');

  click('[data-choose="mixed"]');
  await until(() => room().querySelector('.sound-uses'), 'the uses');
  assert.ok(room().querySelector('[data-direction="mixed"]')?.classList.contains('is-chosen'));
  for (const direction of SONIC_DIRECTIONS) {
    click(`[data-select="${direction.id}"]`);
    const genre = soundSummaryOf(direction.parameters).split(' · ')[0]!;
    assert.match(room().querySelector('.sound-summary')?.textContent ?? '', new RegExp(`^${genre}`), `${direction.id} plays its own genre`);
  }
  // A chip plays its own use's sound.
  click('[data-play="use:demonstrate"]');
  await until(() => first.heard.length === 2, 'the use preview');
  assert.equal(parseMusicState(first.heard[1]!.parameters as string).mood, SONIC_DIRECTIONS.find((d) => d.id === 'demonstrate')!.mood);
  // Edit in the music generator takes the selected use's own genre.
  click('[data-select="play"]');
  click('[data-edit-music]');
  assert.match(first.went.at(-1)!, new RegExp(`style=${SONIC_DIRECTIONS.find((d) => d.id === 'play')!.mood}&`));
  first.handle.teardown();
  finishSoundEdit({ cancelled: true });

  // Back in the room, save; a fresh room reads the mix back from the design system.
  const second = mount({ host: first.fake!.host });
  await until(() => room().querySelector('[data-save]'), 'the save button');
  click('[data-save]');
  await until(() => first.fake!.saved.length === 1, 'the save');
  assert.deepEqual(sonicProfileOf(first.fake!.doc()).profile?.startingSound, { mode: 'mixed' });
  second.handle.teardown();
  const third = mount({ host: first.fake!.host });
  await until(() => room().querySelector('.sound-card.is-chosen'), 'the chosen card');
  assert.equal(room().querySelector<HTMLElement>('.sound-card.is-chosen')?.dataset.direction, 'mixed');
  // And one sound again, each use keeping its tune.
  const before = sonicProfileOf(first.fake!.doc()).profile!.contexts.map((c) => parseMusicState(c.music.parameters).seed);
  click('[data-choose="explain"]');
  click('[data-save]');
  await until(() => first.fake!.saved.length === 2, 'the second save');
  const after = sonicProfileOf(first.fake!.doc()).profile!;
  assert.deepEqual(after.startingSound, { mode: 'one', sound: 'explain' });
  assert.deepEqual(after.contexts.map((c) => parseMusicState(c.music.parameters).seed), before);
  third.handle.teardown();
});
