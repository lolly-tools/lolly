// SPDX-License-Identifier: MPL-2.0
/** Panel ownership survives a compact resize after editing an open Sequence. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountDesignPanels } from './design-panels.ts';

const dom = new JSDOM('<!doctype html><body></body>');
for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Event', 'MutationObserver']) {
  (globalThis as Record<string, unknown>)[name] = (dom.window as unknown as Record<string, unknown>)[name];
}
const frames: FrameRequestCallback[] = [];
globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
function flush(): void {
  for (let count = 0; frames.length; count++) {
    assert.ok(count < 20, 'panel reserves settle without a resize loop');
    frames.shift()!(0);
  }
}
function width(value: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value });
  window.dispatchEvent(new Event('resize'));
  flush();
}
function fixture() {
  width(1440);
  const stage = document.createElement('div'), canvas = document.createElement('div');
  const sequence = document.createElement('div'), field = document.createElement('input');
  sequence.className = 'tl-panel'; field.value = 'Unsaved layer name';
  sequence.append(field); stage.append(canvas, sequence); document.body.append(stage);
  let timelineOpen = true, inspectorOpen = false, navigatorOpen = false;
  let timelineCloses = 0;
  const handle = mountDesignPanels({
    stage, canvas,
    design: {
      isTimelineOpen: () => timelineOpen,
      toggleTimeline() { timelineOpen = !timelineOpen; if (!timelineOpen) timelineCloses++; },
      setColumnWidths() {},
    } as unknown as Parameters<typeof mountDesignPanels>[0]['design'],
    navigator: {
      isOpen: () => navigatorOpen, width: () => navigatorOpen ? 220 : 0,
      setOpen(value: boolean) { navigatorOpen = value; },
    } as unknown as Parameters<typeof mountDesignPanels>[0]['navigator'],
    inspector: {
      isOpen: () => inspectorOpen, setOpen(value: boolean) { inspectorOpen = value; },
    } as unknown as Parameters<typeof mountDesignPanels>[0]['inspector'],
    more() {},
  });
  const showInspector = (): void => { inspectorOpen = true; handle.activate('inspector'); };
  return {
    stage, field, handle, showInspector,
    state: () => ({ timelineOpen, inspectorOpen, timelineCloses }),
    close() { handle.destroy(); flush(); stage.remove(); },
  };
}

for (const interaction of ['focus', 'pointer'] as const) {
  test(`${interaction} in an open Sequence keeps the editor through narrow and wide resizing`, () => {
    const f = fixture();
    try {
      f.showInspector();
      assert.deepEqual(f.state(), { timelineOpen: true, inspectorOpen: true, timelineCloses: 0 });
      if (interaction === 'focus') f.field.focus();
      else {
        // Nested editors contain their gestures so they never reach the canvas.
        f.field.parentElement!.addEventListener('pointerdown', event => event.stopPropagation());
        f.field.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
      }
      width(390);
      assert.deepEqual(f.state(), { timelineOpen: true, inspectorOpen: false, timelineCloses: 0 });
      assert.equal(f.field.value, 'Unsaved layer name');
      assert.equal(f.stage.querySelector('.tl-panel input'), f.field);
      width(1440); width(390);
      assert.equal(f.state().timelineCloses, 0);
      assert.equal(f.stage.querySelector('[aria-label="Editing actions"]')?.getAttribute('role'), 'toolbar');
    } finally { f.close(); }
  });
}

test('the inspector still wins when it is the latest requested panel', () => {
  const f = fixture();
  try {
    f.field.focus(); f.showInspector(); width(390);
    assert.deepEqual(f.state(), { timelineOpen: false, inspectorOpen: true, timelineCloses: 1 });
  } finally { f.close(); }
});

test('destroy removes Sequence interaction listeners', () => {
  const f = fixture();
  try {
    f.handle.destroy(); width(390); f.showInspector();
    f.field.focus(); f.field.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true }));
    assert.deepEqual(f.state(), { timelineOpen: true, inspectorOpen: true, timelineCloses: 0 });
  } finally { f.close(); }
});

test('on a phone the inspector and the layers list are the two tabs of one drop-down panel', () => {
  // A narrow window in jsdom is the phone layout; the sheet driver needs matchMedia.
  const mql = (query: string) => ({ matches: /max-width/.test(query), media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (window as unknown as { matchMedia: typeof mql }).matchMedia = mql;
  width(390);
  const layout = document.createElement('div');
  layout.className = 'tool-layout is-editor';
  const stage = document.createElement('div'), canvas = document.createElement('div');
  const navEl = document.createElement('aside');
  navEl.className = 'fc-nav';
  stage.append(canvas, navEl); layout.append(stage); document.body.append(layout);
  const inspEl = document.createElement('aside');
  inspEl.className = 'fc-insp';
  let inspectorOpen = false, navigatorOpen = false, phoneHost: ((el: HTMLElement) => void) | null = null, left = 0;
  const handle = mountDesignPanels({
    stage, canvas,
    design: { isTimelineOpen: () => false, toggleTimeline() {}, setColumnWidths() {} } as unknown as Parameters<typeof mountDesignPanels>[0]['design'],
    navigator: {
      el: navEl, isOpen: () => navigatorOpen, width: () => 0,
      // As the view wires it (views/tool/session.ts): an open column is activated.
      setOpen(value: boolean) { navigatorOpen = value; if (value) handle.activate('navigator'); handle.sync(); },
    } as unknown as Parameters<typeof mountDesignPanels>[0]['navigator'],
    inspector: {
      isOpen: () => inspectorOpen,
      setOpen(value: boolean) { inspectorOpen = value; if (value) handle.activate('inspector'); handle.sync(); return value; },
      enterPhone(host: (el: HTMLElement) => void) { phoneHost = host; host(inspEl); },
      leavePhone() { phoneHost = null; left++; inspEl.remove(); },
    } as unknown as Parameters<typeof mountDesignPanels>[0]['inspector'],
    more() {},
  });
  try {
    flush();
    const panel = layout.querySelector<HTMLElement>('.design-phone-panel');
    assert.ok(panel, 'the panel is mounted in the phone layout');
    assert.ok(phoneHost, 'and it holds the inspector');
    assert.equal(navEl.parentElement, panel!.querySelector('.dpp-body'), 'and the layers list');
    assert.equal(panel!.dataset.snap, 'peek');
    // The bottom bar's buttons pick the tab and open the panel to half.
    const bar = (name: string) => [...stage.querySelectorAll<HTMLButtonElement>('.design-compact-actions button')].find(b => b.textContent === name)!;
    bar('Inspect').click(); flush();
    assert.deepEqual([inspectorOpen, panel!.dataset.snap, panel!.dataset.tab], [true, 'half', 'inspect']);
    // (Where the canvas band starts is measured layout, which the browser test checks.)
    assert.equal(stage.style.getPropertyValue('--design-panel-reserve'), '', 'the bottom sheet\'s reserve is not written');
    bar('Layer/Page').click(); flush();
    assert.deepEqual([inspectorOpen, navigatorOpen, panel!.dataset.tab, panel!.dataset.snap], [false, true, 'layers', 'half']);
    bar('Layer/Page').click(); flush();
    assert.deepEqual([navigatorOpen, panel!.dataset.snap], [false, 'peek'], 'the same button folds it');
    // A wide window takes the panel down and hands both columns back.
    width(1440);
    assert.equal(layout.querySelector('.design-phone-panel'), null);
    assert.equal(left, 1, 'the inspector was let go');
    assert.equal(navEl.parentElement, stage, 'the layers list is home');
  } finally { handle.destroy(); flush(); layout.remove(); delete (window as unknown as { matchMedia?: unknown }).matchMedia; }
});
