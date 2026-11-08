// SPDX-License-Identifier: MPL-2.0
/**
 * The sound shape slider under the Sound switch.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/sound-toggle.test.ts
 *
 * What is pinned:
 *  - the slider renders with the Bouba shape at one end and the Kiki shape at the other,
 *    at the stored shape, with words (not a number) for a screen reader;
 *  - dragging moves the shape live; letting go saves `sfxShape` to the profile;
 *  - clicking a shape jumps to that end;
 *  - the slider stays usable while sound is muted (only dimmed), so a listener can choose
 *    before hearing anything.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
for (const k of ['HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'HTMLLabelElement', 'HTMLDetailsElement', 'Element', 'Node', 'Event', 'CustomEvent'] as const) {
  (globalThis as Record<string, unknown>)[k] = dom.window[k];
}
globalThis.requestAnimationFrame = (cb) => { setTimeout(() => cb(0), 0); return 0; };
localStorage.setItem('lolly:sfxMuted', '1');   // muted: nothing tries to make a sound

const { soundSwitchHtml, wireSoundSwitch, soundShapeCaption } = await import('./sound-toggle.ts');
const { getSfxShape, setSfxShape } = await import('../lib/sfx.ts');

function mount(): { root: HTMLElement; saved: Array<Record<string, unknown>> } {
  const saved: Array<Record<string, unknown>> = [];
  let profile: Record<string, unknown> = { firstname: 'Ada' };
  const host = {
    profile: {
      get: async () => profile,
      set: async (p: object) => { profile = p as Record<string, unknown>; saved.push(profile); return profile; },
    },
    assets: {} as never,
  };
  document.body.innerHTML = `<div id="root">${soundSwitchHtml()}</div>`;
  const root = document.getElementById('root')!;
  wireSoundSwitch(root, host as unknown as Parameters<typeof wireSoundSwitch>[1]);
  return { root, saved };
}
const settle = (): Promise<void> => new Promise(r => setTimeout(r, 5));

test('the slider sits between the Bouba and Kiki shapes, at the stored shape', () => {
  setSfxShape(0.25);
  const { root } = mount();
  const ends = [...root.querySelectorAll<HTMLElement>('.sound-shape-end')].map(e => e.dataset.end);
  assert.deepEqual(ends, ['bouba', 'kiki']);
  assert.ok(root.querySelector('.sound-shape-end[data-end="bouba"] svg path'), 'the Bouba shape is drawn');
  const input = root.querySelector<HTMLInputElement>('[data-sound-shape]')!;
  assert.equal(input.value, '25');
  assert.equal(input.getAttribute('aria-valuetext'), soundShapeCaption(0.25));
  assert.match(input.getAttribute('aria-label') ?? '', /Bouba.*Kiki/);
});

test('dragging moves the shape live; letting go saves it to the profile', async () => {
  setSfxShape(0.5);
  const { root, saved } = mount();
  const input = root.querySelector<HTMLInputElement>('[data-sound-shape]')!;
  input.value = '80';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  assert.equal(getSfxShape(), 0.8);
  assert.equal(root.querySelector('[data-sound-shape-caption]')!.textContent, 'Mostly ticks and scratches');
  assert.equal(saved.length, 0, 'nothing is saved mid-drag');
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  assert.equal(saved.at(-1)?.sfxShape, 0.8);
  assert.equal(saved.at(-1)?.firstname, 'Ada', 'the rest of the profile is kept');
});

test('clicking a shape jumps to that end', async () => {
  setSfxShape(0.5);
  const { root, saved } = mount();
  root.querySelector<HTMLElement>('[data-end="kiki"]')!.click();
  await settle();
  assert.equal(getSfxShape(), 1);
  assert.equal(saved.at(-1)?.sfxShape, 1);
  assert.equal(root.querySelector('[data-sound-shape-caption]')!.textContent, 'Kiki: ticks, scratches and metal');
  root.querySelector<HTMLElement>('[data-end="bouba"]')!.click();
  await settle();
  assert.equal(getSfxShape(), 0);
});

test('muted, the slider is dimmed but still usable', () => {
  const { root } = mount();
  const wrap = root.querySelector<HTMLElement>('[data-sound-shape-root]')!;
  assert.ok(wrap.classList.contains('is-muted'));
  assert.equal(root.querySelector<HTMLInputElement>('[data-sound-shape]')!.disabled, false);
});

test('captions run from Bouba through the chimes to Kiki', () => {
  assert.deepEqual([0, 0.1, 0.4, 0.5, 0.6, 0.9, 1].map(soundShapeCaption), [
    'Bouba: drops, bubbles and bass', 'Mostly drops and bubbles', 'Chimes with drops', 'Chimes and notes',
    'Chimes with ticks', 'Mostly ticks and scratches', 'Kiki: ticks, scratches and metal',
  ]);
});
