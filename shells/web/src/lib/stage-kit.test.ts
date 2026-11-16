// SPDX-License-Identifier: MPL-2.0
/**
 * The stage kit (lib/stage-kit.ts) in jsdom: the layer's place, what it carries, how
 * a second setBar keeps buttons and focus, the status line, the toolbar keys, and the
 * band it asks the fit for. jsdom lays nothing out, so each test stubs the two rects the
 * band is measured from.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/stage-kit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>', { pretendToBeVisual: true });
for (const k of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent', 'KeyboardEvent', 'getComputedStyle', 'DOMParser']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
if (typeof dom.window.matchMedia !== 'function') {
  (dom.window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({ matches: false });
}

const { mountStageKit } = await import('./stage-kit.ts');
type Group = Parameters<ReturnType<typeof mountStageKit>['setBar']>[0][number];

function rect(top: number, bottom: number): DOMRect {
  return { top, bottom, left: 0, right: 800, width: 800, height: bottom - top, x: 0, y: top, toJSON() {} } as DOMRect;
}

function mount(phone = false) {
  const stage = document.createElement('div');
  stage.className = 'tool-stage';
  const outer = document.createElement('div');
  outer.id = 'tool-canvas-outer';
  const canvas = document.createElement('div');
  canvas.id = 'tool-canvas';
  outer.append(canvas);
  stage.append(outer);
  document.body.append(stage);
  stage.getBoundingClientRect = () => rect(0, 600);
  let resized = 0;
  canvas.addEventListener('canvas-resize', () => { resized++; });
  const kit = mountStageKit(stage, { canvas, phone: () => phone, label: 'Canvas controls' });
  kit.element.getBoundingClientRect = () => (phone ? rect(500, 560) : rect(8, 60));
  return { stage, canvas, kit, resized: () => resized, teardown() { kit.dispose(); stage.remove(); } };
}

const modes = (pressed: string): Group => ({
  id: 'mode',
  label: 'Pointer mode',
  segmented: true,
  items: [
    { id: 'orbit', label: 'Orbit', icon: 'rotateCw', pressed: pressed === 'orbit', data: { 'studio-orbit': '' }, onPress() {} },
    { id: 'lights', label: 'Move lights', shortLabel: 'Lights', icon: 'sunburst', pressed: pressed === 'lights', onPress() {} },
  ],
});

test('the layer sits beside the canvas, out of every capture, with presses of its own', () => {
  const h = mount();
  try {
    const root = h.kit.element;
    assert.equal(root.parentElement, h.stage, 'a child of the stage');
    assert.equal(h.canvas.contains(root), false, 'never inside #tool-canvas');
    for (const attr of ['data-export-hide', 'data-live-hide']) assert.ok(root.hasAttribute(attr), attr);
    assert.equal(root.getAttribute('data-canvas-keys'), 'off');
    assert.equal(root.getAttribute('data-stage-gestures'), 'own');
    assert.equal(root.hidden, true, 'nothing asked for, nothing shown');
    assert.equal(root.querySelector('[role="toolbar"]')?.getAttribute('aria-label'), 'Canvas controls');
  } finally { h.teardown(); }
});

test('a second setBar updates buttons in place and keeps focus on the same action', () => {
  const h = mount();
  try {
    h.kit.setBar([modes('orbit')]);
    const lights = h.kit.element.querySelector<HTMLButtonElement>('[data-kit-action="lights"]')!;
    lights.focus();
    assert.equal(document.activeElement, lights);
    h.kit.setBar([
      { id: 'view', label: 'View', items: [{ id: 'fit', label: 'Fit object', icon: 'fitAll', onPress() {} }] },
      modes('lights'),
    ]);
    const after = h.kit.element.querySelector<HTMLButtonElement>('[data-kit-action="lights"]')!;
    assert.equal(after, lights, 'the same node');
    assert.equal(document.activeElement, lights, 'focus stayed on the moved button');
    assert.equal(after.getAttribute('aria-pressed'), 'true');
    assert.equal(h.kit.element.querySelector('[data-kit-action="orbit"]')!.getAttribute('aria-pressed'), 'false');
    assert.ok(h.kit.element.querySelector('[data-studio-orbit]'), 'data attributes reach the button');
    assert.equal(h.kit.element.querySelector('[data-kit-group="mode"]')!.getAttribute('role'), 'group');
    assert.ok(h.kit.element.querySelector('[data-kit-group="mode"]')!.hasAttribute('data-segmented'));
    h.kit.setBar([modes('orbit')]);
    assert.equal(h.kit.element.querySelector('[data-kit-action="fit"]'), null, 'a dropped action leaves');
  } finally { h.teardown(); }
});

test('a press runs the action; a disabled or hidden one does nothing', () => {
  const h = mount();
  try {
    const pressed: string[] = [];
    h.kit.setBar([{
      id: 'g', label: 'G', items: [
        { id: 'a', label: 'A', icon: 'plus', onPress: () => pressed.push('a') },
        { id: 'b', label: 'B', icon: 'plus', disabled: true, onPress: () => pressed.push('b') },
        { id: 'c', label: 'C', icon: 'plus', hidden: true, onPress: () => pressed.push('c') },
        { kind: 'pill', id: 'p', text: '1 of 3: Badge', data: { 'studio-object-label': '' } },
      ],
    }]);
    for (const id of ['a', 'b', 'c']) h.kit.element.querySelector<HTMLButtonElement>(`[data-kit-action="${id}"]`)!.click();
    assert.deepEqual(pressed, ['a']);
    assert.equal(h.kit.element.querySelector('[data-kit-action="c"]')!.hasAttribute('hidden'), true);
    assert.equal(h.kit.element.querySelector('[data-studio-object-label]')!.textContent, '1 of 3: Badge');
  } finally { h.teardown(); }
});

test('the toolbar has one tab stop and the arrow keys walk it', () => {
  const h = mount();
  try {
    h.kit.setBar([modes('orbit'), { id: 'v', label: 'View', items: [{ id: 'fit', label: 'Fit', icon: 'fitAll', onPress() {} }] }]);
    const all = [...h.kit.element.querySelectorAll<HTMLButtonElement>('button')];
    assert.deepEqual(all.map((b) => b.tabIndex), [0, -1, -1]);
    all[0]!.focus();
    const key = (k: string) => document.activeElement!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    key('ArrowRight');
    assert.equal(document.activeElement, all[1]);
    assert.deepEqual(all.map((b) => b.tabIndex), [-1, 0, -1], 'the stop follows focus');
    key('End');
    assert.equal(document.activeElement, all[2]);
    key('ArrowRight');
    assert.equal(document.activeElement, all[0], 'wraps');
  } finally { h.teardown(); }
});

test('the status line is one polite sentence and takes no space when empty', () => {
  const h = mount();
  try {
    const status = h.kit.element.querySelector<HTMLElement>('[data-stage-status]')!;
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
    assert.equal(status.hidden, true);
    h.kit.setBar([modes('lights')]);
    h.kit.setStatus('Key light selected.');
    assert.equal(status.hidden, false);
    assert.equal(status.textContent, 'Key light selected.');
    h.kit.setStatus('');
    assert.equal(status.hidden, true);
  } finally { h.teardown(); }
});

test('a wide screen reserves the top band; a phone reserves the foot; dispose gives both back', () => {
  const wide = mount(false);
  try {
    wide.stage.style.setProperty('--stage-reserve-bottom', '12px');
    wide.kit.setBar([modes('orbit')]);
    assert.equal(wide.kit.element.dataset.placement, 'top');
    assert.equal(wide.stage.style.getPropertyValue('--stage-reserve-top'), '60px');
    assert.equal(wide.resized(), 1, 'the canvas is told to fit again');
    wide.kit.setBar([modes('lights')]);
    assert.equal(wide.resized(), 1, 'an unchanged band is not news');
    wide.kit.setBar([]);
    assert.equal(wide.kit.element.hidden, true);
    assert.equal(wide.stage.style.getPropertyValue('--stage-reserve-top'), '', 'an empty bar gives the band back');
    assert.equal(wide.resized(), 2);
  } finally { wide.teardown(); }

  const phone = mount(true);
  try {
    phone.kit.setBar([modes('orbit')]);
    assert.equal(phone.kit.element.dataset.placement, 'foot');
    assert.equal(phone.stage.style.getPropertyValue('--stage-reserve-bottom'), '100px');
    assert.equal(phone.stage.style.getPropertyValue('--stage-reserve-top'), '');
    phone.kit.dispose();
    assert.equal(phone.stage.style.getPropertyValue('--stage-reserve-bottom'), '');
    assert.equal(phone.kit.element.isConnected, false);
    assert.equal(phone.resized(), 2);
  } finally { phone.teardown(); }
});

test('icon-only buttons carry their name as the shell tooltip; labelled ones only their help', () => {
  const h = mount(true);
  try {
    h.kit.setBar([
      modes('orbit'),
      { id: 'view', label: 'View', phoneIcons: true, items: [{ id: 'fit', label: 'Fit object', shortLabel: 'Fit', icon: 'fitAll', onPress() {} }] },
    ]);
    const tip = (id: string) => h.kit.element.querySelector<HTMLElement>(`[data-kit-action="${id}"]`)!.dataset.tip;
    assert.equal(tip('lights'), undefined, 'a phone shows "Lights" under the icon');
    assert.equal(tip('orbit'), 'Orbit', 'no short label: icon only on a phone');
    assert.equal(tip('fit'), 'Fit object', 'a group a phone draws as icons');
  } finally { h.teardown(); }
});

test('a menu action opens the shell popover and runs the chosen item', () => {
  const h = mount();
  try {
    const chosen: string[] = [];
    h.kit.setBar([{
      id: 'view', label: 'View', items: [{
        id: 'views', label: 'View', icon: 'eye',
        menu: () => [
          { id: 'front', label: 'Front', onPress: () => chosen.push('front') },
          { id: 'side', label: 'Side', checked: true, onPress: () => chosen.push('side') },
        ],
      }],
    }]);
    const b = h.kit.element.querySelector<HTMLButtonElement>('[data-kit-action="views"]')!;
    assert.equal(b.getAttribute('aria-haspopup'), 'menu');
    b.click();
    const menu = document.querySelector<HTMLElement>('.stage-kit-menu')!;
    assert.ok(menu, 'the menu opened on the body');
    assert.equal(b.getAttribute('aria-expanded'), 'true');
    assert.equal(menu.querySelector('[aria-checked="true"]')!.textContent, 'Side');
    menu.querySelector<HTMLButtonElement>('[data-kit-menu-item="front"]')!.click();
    assert.deepEqual(chosen, ['front']);
    assert.equal(document.querySelector('.stage-kit-menu'), null, 'a choice closes the menu');
  } finally { h.teardown(); }
});

test('a button disabled while its action reloads the tool gets focus back when it is usable', () => {
  const h = mount();
  try {
    const bar = (disabled: boolean): Group[] => [{ id: 'v', label: 'View', items: [{ id: 'fit', label: 'Fit', icon: 'fitAll', disabled, onPress() {} }] }];
    h.kit.setBar(bar(false));
    const fit = h.kit.element.querySelector<HTMLButtonElement>('[data-kit-action="fit"]')!;
    fit.focus();
    h.kit.setBar(bar(true));
    // jsdom keeps focus on a disabled button; a browser lets it go, which is what this is.
    fit.blur();
    assert.equal(document.activeElement, document.body);
    h.kit.setBar(bar(false));
    assert.equal(document.activeElement, fit, 'focus came back to the same action');
  } finally { h.teardown(); }
});
