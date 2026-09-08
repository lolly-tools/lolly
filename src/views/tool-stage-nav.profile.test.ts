// SPDX-License-Identifier: MPL-2.0
/**
 * Where the profile avatar lives on a canvas stage (plan 179, the right-dock wave).
 *
 * There is ONE avatar node in the Design editor and two surfaces that can show it: the
 * top bar (views/design-topbar.ts) while the right column is closed, and the compact
 * zoom bar in the column while it is open. The bar hands the node over and takes it back
 * - `profileHome()` is the address it hands it to - so what has to hold here is that the
 * address exists in editor layout and is null when there is no pill to hand it to.
 * Missing that, the bar hid its own avatar and the column had none: no profile menu
 * anywhere for as long as the column stayed open, which is exactly what shipped.
 *
 * The fold gesture is the second half. A long-press on the avatar folds the floating
 * pill behind the swirl, and that binding assumes the avatar is permanently the pill's.
 * In editor layout it is on loan and the pill is a docked bar that must not fold at all,
 * so the binding is not made there - the inline `touch-action` it writes is the visible
 * proof either way.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-stage-nav.profile.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { setupStageNav } = await import('./tool-stage-nav.ts');
type Opts = Parameters<typeof setupStageNav>[8];

function avatar(): HTMLElement {
  const a = dom.window.document.createElement('a');
  a.className = 'profile-link stage-nav-profile';
  return a;
}

function mount(opts: Opts, profileEl?: HTMLElement) {
  const stage = document.createElement('div');
  const outer = document.createElement('div');
  const canvas = document.createElement('div');
  outer.appendChild(canvas);
  stage.appendChild(outer);
  document.body.appendChild(stage);
  const nav = setupStageNav(stage, outer, canvas, 800, null, undefined, undefined, profileEl, opts);
  return { stage, nav, teardown() { nav.destroy(); stage.remove(); } };
}

test('editor layout publishes the docked pill as the avatar\'s address', () => {
  const h = mount({ editorLayout: true, hud: false });
  try {
    const home = h.nav.profileHome();
    assert.ok(home, 'editor layout builds the pill even with hud:false - it IS the docked bar');
    assert.ok(home!.classList.contains('stage-nav'), 'the address is the pill itself, so the avatar sits among its controls');
    assert.ok(home!.classList.contains('stage-nav--editor'),
      'the modifier editor.css keys the avatar exceptions on (last, ordinary size) must be there');
    // The top bar appends into it, so the avatar has to land after the theme/sound toggles.
    const a = avatar();
    home!.appendChild(a);
    assert.equal(home!.lastElementChild, a);
  } finally { h.teardown(); }
});

test('a plain canvas HUD carries no editor modifier, and a HUD-less stage has no address', () => {
  const plain = mount(undefined);
  try {
    const home = plain.nav.profileHome();
    assert.ok(home, 'every ordinary canvas tool still builds its floating pill');
    assert.equal(home!.classList.contains('stage-nav--editor'), false);
  } finally { plain.teardown(); }

  const none = mount({ hud: false });
  try {
    assert.equal(none.nav.profileHome(), null,
      'no pill, no address - which is the top bar\'s signal to keep the avatar itself');
  } finally { none.teardown(); }
});

test('the hold-to-fold gesture is bound on a floating pill and skipped in editor layout', () => {
  const floating = mount(undefined, avatar());
  try {
    const a = floating.nav.profileHome()!.querySelector<HTMLElement>('.stage-nav-profile')!;
    assert.equal(a.style.touchAction, 'none',
      'the floating pill folds behind its avatar, so the avatar owns the press');
  } finally { floating.teardown(); }

  const editor = mount({ editorLayout: true, hud: false }, avatar());
  try {
    const a = editor.nav.profileHome()!.querySelector<HTMLElement>('.stage-nav-profile')!;
    // jsdom leaves an unset, unrecognised property undefined rather than '' - either
    // way what is asserted is that nothing wrote it.
    assert.ok(!a.style.touchAction,
      'the docked bar cannot fold and only borrows the avatar - it must leave the press alone');
  } finally { editor.teardown(); }
});
