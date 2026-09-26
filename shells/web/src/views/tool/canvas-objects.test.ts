// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { buildInputModel, type InputValue } from '../../../../../engine/src/inputs.ts';
import { MountLifecycle } from '../../lib/mount-lifecycle.ts';
import { setToolInputPolicies } from '../../lib/input-policy.ts';
import { canvasControl, canvasObjectsOps } from './canvas-objects.ts';
import type { ToolViewCtx } from './context.ts';

function harness(source = 'visual') {
  const dom = new JSDOM(`<!doctype html><body><main><aside>
    <textarea data-input-id="dsl"></textarea>
    <details class="input-section"><div class="blocks-input" data-input-id="nodes">
      <div class="block-item is-typed is-collapsed" data-block-index="0"><div class="block-fields"><input class="block-field" data-field-id="nodes:0:label"></div></div>
      <div class="block-item is-typed" data-block-index="1"><div class="block-fields"><input class="block-field" data-field-id="nodes:1:label"></div></div>
    </div></details>
  </aside><div id="canvas"><svg><g tabindex="0" data-canvas-input="${source === 'visual' ? 'nodes:0' : 'dsl'}" data-canvas-name="Discover" data-canvas-settings="nodes:0:shape nodes:0:emphasis"><rect width="100" height="60"/></g></svg></div></main></body>`, { pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document, HTMLElement: w.HTMLElement, Element: w.Element, Node: w.Node,
    requestAnimationFrame: w.requestAnimationFrame.bind(w), cancelAnimationFrame: w.cancelAnimationFrame.bind(w), CSS: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`) } });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.matchMedia = (() => ({ matches: false, addEventListener() {}, removeEventListener() {} })) as unknown as typeof w.matchMedia;
  const model = buildInputModel({ inputs: [
    { id: 'source', type: 'select', default: source },
    { id: 'look', type: 'select', default: 'studio' },
    { id: 'dsl', type: 'longtext', default: 'Discover -> Design', showIf: { source: 'text' } },
    { id: 'nodes', type: 'blocks', showIf: { source: 'visual' }, default: [{ label: 'Discover', shape: 'rounded' }, { label: 'Design', shape: 'rounded' }], fields: [
      { id: 'label', type: 'text', label: 'Label' },
      { id: 'shape', type: 'select', label: 'Shape', options: [{ value: 'rounded', label: 'Rounded' }, { value: 'diamond', label: 'Diamond' }] },
      { id: 'emphasis', type: 'select', label: 'Emphasis', showIf: { look: ['minimal', 'studio'] }, options: [{ value: 'accent', label: 'Accent card' }] },
    ] },
  ] });
  const writes: Array<[string, InputValue]> = [], dirty: string[] = [];
  const ctx = { toolId: 'canvas-test', runtime: { getModel: () => model, setInput: async (id: string, value: InputValue) => { writes.push([id, value]); model.find(item => item.id === id)!.value = value; } },
    canvasEl: w.document.querySelector('#canvas'), inputsEl: w.document.querySelector('aside'), layout: w.document.querySelector('main'),
    hideSidebar: false, INLINE_EDIT_CONTROLS: new Set(), mountLifecycle: new MountLifecycle(),
    stageLayout: { setSidebarWidth() {}, getRestoreWidth: () => 280 }, session: { markUserDirty: (id: string) => dirty.push(id) },
  } as unknown as ToolViewCtx;
  ctx.canvasObjects = canvasObjectsOps(ctx); ctx.canvasObjects.wireCanvasObjects();
  return { dom, ctx, model, writes, dirty, card: w.document.querySelector('g')!, close: () => { ctx.mountLifecycle.dispose(); dom.window.close(); } };
}

test('canvas click reveals and focuses the exact card; imported objects focus the source', () => {
  for (const source of ['visual', 'text']) {
    const h = harness(source);
    h.card.dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true }));
    assert.equal(h.dom.window.document.activeElement?.getAttribute(source === 'visual' ? 'data-field-id' : 'data-input-id'), source === 'visual' ? 'nodes:0:label' : 'dsl');
    if (source === 'visual') {
      assert.ok(h.dom.window.document.querySelector('details')?.open);
      assert.ok(!h.dom.window.document.querySelector('[data-block-index="0"]')?.classList.contains('is-collapsed'));
      assert.ok(h.dom.window.document.querySelector('[data-block-index="1"]')?.classList.contains('is-collapsed'));
    }
    h.close();
  }
});

test('context menu changes only the selected row through the runtime and dirty path', async () => {
  const h = harness();
  h.card.dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 50 }));
  const click = (selector: string) => h.dom.window.document.querySelector<HTMLButtonElement>(selector)!.click();
  click('[data-act="field:nodes:0:shape"]');
  assert.match(h.dom.window.document.querySelector('.ctx-menu')!.textContent!, /Diamond/);
  click('[data-act="option:1"]'); await Promise.resolve();
  assert.deepEqual(h.writes, [['nodes', [{ label: 'Discover', shape: 'diamond' }, { label: 'Design', shape: 'rounded' }]]]);
  assert.deepEqual(h.dirty, ['nodes']);
  assert.equal(h.dom.window.document.querySelector('.ctx-menu'), null);
  h.close();
});

test('canvas references reject hidden, missing and malformed controls; array conditions match the sidebar', () => {
  const h = harness();
  for (const ref of ['dsl', 'missing', 'nodes:99', 'nodes:-1', 'nodes:0:missing', 'nodes:0:label:extra']) assert.equal(canvasControl(h.model, ref), null, ref);
  assert.equal(canvasControl(h.model, 'nodes:0:emphasis')?.label, 'Emphasis');
  h.close();
});

test('keyboard opens the same object menu and teardown removes it and its listeners', () => {
  const h = harness();
  h.card.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F10', shiftKey: true }));
  assert.ok(h.dom.window.document.querySelector('.ctx-menu'));
  h.ctx.mountLifecycle.dispose();
  assert.equal(h.dom.window.document.querySelector('.ctx-menu'), null);
  h.card.dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  assert.equal(h.dom.window.document.querySelector('.ctx-menu'), null);
  h.close();
});

test('an open object menu rechecks policy and rejects a detached object before writing', () => {
  for (const lock of [true, false]) {
    const h = harness();
    h.card.dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    h.dom.window.document.querySelector<HTMLButtonElement>('[data-act="field:nodes:0:shape"]')!.click();
    if (lock) setToolInputPolicies('canvas-test', { nodes: { mode: 'locked' } });
    else h.card.remove();
    h.dom.window.document.querySelector<HTMLButtonElement>('[data-act="option:1"]')!.click();
    assert.equal(h.writes.length, 0);
    setToolInputPolicies('canvas-test');
    h.close();
  }
});
