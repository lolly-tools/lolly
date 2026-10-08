// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { canvasProjection } from './canvas-projection.ts';

test('stable-ID projection reuses its DOM index and follows reorder, replacement and deletion before observer delivery', () => {
  const dom = new JSDOM('<div id="root"><div class="lolly-box" data-box-id="a"></div><div class="lolly-frame-page" data-frame-id="f"></div></div>');
  const root = dom.window.document.getElementById('root')!;
  let rows = [{ id: 'a', x: 10, y: 20, w: 100, h: 80, rot: 0 }, { id: 'f', x: 200, y: 300, w: 400, h: 500, rot: 0 }];
  const projection = canvasProjection(root, () => rows, { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' });
  const query = root.querySelectorAll.bind(root); let walks = 0;
  root.querySelectorAll = ((selector: string) => { walks++; return query(selector); }) as typeof root.querySelectorAll;
  try {
    const a = projection.snapshot()('a')!;
    for (let i = 0; i < 100; i++) assert.equal(projection.snapshot()('a')!.element, a.element);
    assert.equal(walks, 1);
    rows = [rows[1]!, { ...rows[0]!, x: 99 }];
    assert.equal(projection.snapshot()('a')!.x, 99); assert.equal(walks, 1);
    a.element!.replaceWith(a.element!.cloneNode(true));
    const replacement = projection.snapshot()('a')!; assert.notEqual(replacement.element, a.element); assert.equal(walks, 2);
    replacement.element!.remove(); assert.equal(projection.snapshot()('a')!.element, null);
    rows = rows.filter(row => row.id !== 'a'); assert.equal(projection.snapshot()('a'), null);
  } finally { projection.dispose(); dom.window.close(); }
});

test('ambiguous IDs cannot bind a preview to the wrong source or DOM node', () => {
  const dom = new JSDOM('<div id="root"><div class="lolly-box" data-box-id="x"></div><div class="lolly-box" data-box-id="x"></div></div>');
  const root = dom.window.document.getElementById('root')!, row = { id: 'x', x: 1, y: 2, w: 3, h: 4, rot: 0 };
  let rows = [row];
  const p = canvasProjection(root, () => rows, { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' });
  try {
    assert.equal(p.snapshot()('x')!.element, null);
    rows = [row, { ...row }]; assert.equal(p.snapshot()('x'), null);
  } finally { p.dispose(); dom.window.close(); }
});
