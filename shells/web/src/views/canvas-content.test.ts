// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { patchCanvasContent } from './canvas-content.ts';
import { contentPatchPlan } from './canvas-content-plan.ts';

const box = (id: string, text = 'Hello', style = 'width:100px;height:80px', fit = '') => `<div class="lolly-box" data-box-id="${id}" data-fit="${fit}" style="${style}"><div class="lolly-box-text">${text}</div></div>`;
const html = (changed: string, metadata = '{}', suffix = '') => `<div class="artboard">${changed}${box('retained')}<script type="application/json" data-penpot-doc>${metadata}</script><script>/* unchanged fit pass */</script>${suffix}</div>`;
function fixture(before: string) {
  const dom = new JSDOM('<div id="root"></div>'), root = dom.window.document.getElementById('root')!;
  root.innerHTML = before; return { root, close: () => dom.window.close() };
}

test('text, style and resize patches retain targets and untouched siblings with current export metadata', () => {
  let before = html(box('edit'));
  const f = fixture(before), target = f.root.querySelector('[data-box-id="edit"]')!, retained = f.root.querySelector('[data-box-id="retained"]')!;
  try {
    for (const after of [html(box('edit', 'New copy'), '{"text":"New copy"}'), html(box('edit', 'New copy', 'width:140px;height:90px;background:blue'), '{"w":140}')]) {
      assert.equal(patchCanvasContent(f.root, before, after, ['edit']), true);
      assert.equal(f.root.querySelector('[data-box-id="edit"]'), target);
      assert.equal(f.root.querySelector('[data-box-id="retained"]'), retained);
      const expected = f.root.ownerDocument.createElement('div'); expected.innerHTML = after;
      assert.equal(f.root.innerHTML, expected.innerHTML);
      before = after;
    }
  } finally { f.close(); }
});

test('unplanned changes, scripts, duplicate/missing targets and invalid metadata refuse atomically', () => {
  const before = html(box('edit'));
  for (const [after, ids] of [
    [html(box('edit', 'Change'), '{}', '<p>unplanned</p>'), ['edit']],
    [html(box('edit', 'Change')).replace('unchanged fit pass', 'changed executable code'), ['edit']],
    [html(box('edit', 'Change') + box('edit')), ['edit']],
    [html(box('edit', 'Change')), ['edit', 'missing']],
    [html(box('edit', 'Change'), '{bad}'), ['edit']],
  ] as const) {
    const f = fixture(before), original = f.root.innerHTML;
    try { assert.equal(patchCanvasContent(f.root, before, after, ids), false); assert.equal(f.root.innerHTML, original); }
    finally { f.close(); }
  }
});

test('fitted text, live enhancements and active text editing keep the full render path', () => {
  for (const content of [box('edit', 'Long copy', undefined, '1'), box('edit', '<video></video>'), box('edit', '<span contenteditable="true">Typing</span>'), box('edit', '<span data-t-split="letter">Animated</span>')]) {
    const before = html(content), f = fixture(before);
    try { assert.equal(patchCanvasContent(f.root, before, before.replace('80px', '90px'), ['edit']), false); }
    finally { f.close(); }
  }
});

test('a failed cached proof cannot contaminate a later valid edit', () => {
  const a = html(box('edit')), b = html(box('edit', 'Second')), c = html(box('edit', 'Third'));
  const f = fixture(a);
  try {
    assert.equal(patchCanvasContent(f.root, a, b, ['edit']), true);
    assert.equal(patchCanvasContent(f.root, b, html(box('edit', 'Third'), '{}', '<p>Unexpected</p>'), ['edit']), false);
    assert.equal(patchCanvasContent(f.root, b, c, ['edit']), true);
    assert.equal(f.root.querySelector('.lolly-box-text')!.textContent, 'Third');
  } finally { f.close(); }
});

test('a content patch restores authored geometry after a transient live pose', () => {
  const before = html(box('edit')), f = fixture(before);
  try {
    const node = f.root.querySelector<HTMLElement>('[data-box-id="edit"]')!;
    node.style.width = '250px'; node.setAttribute('data-transient', '1');
    assert.equal(patchCanvasContent(f.root, before, html(box('edit', 'Changed')), ['edit']), true);
    assert.equal(node.style.width, '100px'); assert.equal(node.hasAttribute('data-transient'), false);
  } finally { f.close(); }
});

test('content planner accepts independent damage and refuses structural or coupled edits', () => {
  const cfg = { field: { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' }, kindField: 'kind', frameField: 'frame', clipField: 'clip' };
  const before = [{ id: 'one', kind: 'text', x: 10, y: 20, w: 100, h: 80, rot: 0, text: 'A', frame: '' }];
  assert.deepEqual(contentPatchPlan(before, [{ ...before[0]!, text: 'B', w: 120 }], cfg), ['one']);
  assert.equal(contentPatchPlan(before, [{ ...before[0]!, frame: 'board' }], cfg), null);
  assert.equal(contentPatchPlan(before, [{ ...before[0]!, text: 'B' }], { ...cfg, connectorEndpointIds: new Set(['one']) }), null);
  assert.equal(contentPatchPlan(before, [...before, { ...before[0]!, id: 'two' }], cfg), null);
});
