// SPDX-License-Identifier: MPL-2.0
/**
 * The page hook behind `lolly check` (design-checks.ts): it answers only for the
 * Design tool, waits for a settled canvas, and returns the structure report and the
 * mounted audit as plain JSON.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { checkDocumentSurface, DESIGN_CHECK_PAGE_FORMAT, runDesignChecks } from './design-checks.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const BOXES = [
  { id: 'f', kind: 'frame', name: 'Slide', x: 0, y: 0, w: 400, h: 300, bg: '#ffffff' },
  { id: 'title', kind: 'text', frame: 'f', x: 20, y: 20, w: 300, h: 60, text: 'Hello', fg: '#000000' },
];

function canvas(): HTMLElement {
  document.body.innerHTML = `<div id="canvas" style="background-color:rgb(255, 255, 255)">
    <div class="lolly-box" data-box-id="title"><div class="lolly-box-text" style="color:rgb(0, 0, 0);font-size:16px">Hello</div></div>
  </div>`;
  const el = document.getElementById('canvas')!;
  const box = el.querySelector<HTMLElement>('.lolly-box')!;
  const text = el.querySelector<HTMLElement>('.lolly-box-text')!;
  Object.defineProperties(box, { clientWidth: { value: 300 }, clientHeight: { value: 60 } });
  Object.defineProperties(text, { scrollWidth: { value: 320 }, scrollHeight: { value: 40 } });
  return el;
}

const deps = (over: Record<string, unknown> = {}) => ({
  toolId: 'design',
  canvasEl: canvas(),
  boxes: () => BOXES,
  whenSettled: async () => {},
  paintPending: () => false,
  ...over,
});

test('only the Design tool with a canvas answers', async () => {
  assert.equal(await checkDocumentSurface(deps({ toolId: 'qr-code' }) as never), null);
  assert.equal(await checkDocumentSurface(deps({ canvasEl: null }) as never), null);
});

test('a settled Design canvas returns the structure report and the mounted audit as JSON', async () => {
  const result = await checkDocumentSurface(deps() as never);
  assert.ok(result);
  assert.equal(result.format, DESIGN_CHECK_PAGE_FORMAT);
  assert.equal(result.version, 1);
  assert.equal(result.settled, true);
  assert.equal(result.layers, 2);
  assert.equal(result.painted, 1);
  assert.deepEqual(result.mounted.findings.map((f) => [f.id, f.layerId]), [['design.text.overflow', 'title']]);
  assert.equal(result.mounted.checked.overflow, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, 'plain JSON, nothing a page.evaluate would lose');
});

test('the hook waits for pending paints and says when the canvas never settled', async () => {
  let frames = 0;
  const waited = await checkDocumentSurface(deps({ paintPending: () => ++frames < 3 }) as never);
  assert.equal(waited?.settled, true);
  assert.ok(frames >= 3, 'it kept waiting while a paint was pending');
  const never = await checkDocumentSurface(deps({ paintPending: () => true, settleTimeoutMs: 60 }) as never);
  assert.equal(never?.settled, false);
});

test('runDesignChecks hands the structure report over before the mounted audit', async () => {
  const order: string[] = [];
  const { structure, mounted } = await runDesignChecks(canvas(), BOXES, { onStructure: () => order.push('structure') });
  order.push('mounted');
  assert.deepEqual(order, ['structure', 'mounted']);
  assert.equal(structure.layers.length, 2);
  assert.equal(mounted.checked.overflow, 1);
});
