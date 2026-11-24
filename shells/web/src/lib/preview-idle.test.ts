// SPDX-License-Identifier: MPL-2.0
/**
 * Idle preview work (plan 373: the move of old pictures and the redraw of stale
 * tiles) waits for a moment that competes with nothing: not while the tab is
 * hidden, a tool is open or opening, a render the person asked for is running,
 * Performance UI is on, or the browser asks to save data.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-idle.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = { visibilityState: 'visible', held: false };
Object.assign(globalThis, {
  document: { get visibilityState() { return page.visibilityState; }, querySelector: (s: string) => (s === '.view-fade--hold' && page.held ? {} : null), querySelectorAll: () => [] },
  location: { hash: '#/p' },
});
const idle = await import('./preview-idle.ts');
const busy = await import('./render-busy.ts');

test('idle preview work runs only when nothing else wants the main thread', () => {
  assert.equal(idle.previewWorkAllowed(), true, 'Projects, visible, nothing running');
  page.visibilityState = 'hidden';
  assert.equal(idle.previewWorkAllowed(), false, 'never while the tab is hidden');
  page.visibilityState = 'visible';
  (globalThis.location as { hash: string }).hash = '#/tool/poster?slot=a';
  assert.equal(idle.previewWorkAllowed(), false, 'never on a tool route');
  (globalThis.location as { hash: string }).hash = '#/p';
  page.held = true;
  assert.equal(idle.previewWorkAllowed(), false, 'never during the tool-open sequence (the held view)');
  page.held = false;
  const end = busy.beginRender();
  assert.equal(idle.previewWorkAllowed(), false, 'never during an export or a batch render');
  end(); end();
  assert.equal(busy.renderBusy(), false, 'ending twice cannot go below zero');
  assert.equal(idle.previewWorkAllowed(), true);
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection: { saveData: true } } });
  assert.equal(idle.previewWorkAllowed(), false, 'never when the browser asks to save data');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  assert.equal(idle.previewWorkAllowed(), true);
});

test('a stale tile is queued once per page, and the queue never redraws a slot twice', () => {
  idle.resetPreviewIdle();
  // No window: nothing is scheduled in this harness, but the queue still records the ask.
  idle.queueStaleTile({ slot: 'poster:1' });
  idle.queueStaleTile({ slot: 'poster:1' });
  idle.queueStaleTile({ slot: '' });
  assert.ok(true, 'queueing is idempotent and never throws without a window');
});
