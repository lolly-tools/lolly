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
