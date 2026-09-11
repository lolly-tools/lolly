// SPDX-License-Identifier: MPL-2.0
/**
 * data-grid - the pure windowing math (the essential part) + a jsdom smoke test
 * of the mount structure and the TableValue round-trip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { visibleRange, mountDataGrid } from './data-grid.ts';

// ── visibleRange (pure) ──────────────────────────────────────────────────────

test('visibleRange: at the top, renders the first window with overscan clamped to 0', () => {
  // viewport 280px / 28px rows = 10 visible; +overscan 4*2. first clamps at 0.
  const r = visibleRange(0, 280, 28, 1000, 4);
  assert.equal(r.first, 0);
  assert.equal(r.last, 10 + 8); // 0 + (10 + 8)
  assert.equal(r.offsetY, 0);
  assert.equal(r.totalHeight, 1000 * 28);
});

test('visibleRange: mid-scroll windows around the scroll position with overscan', () => {
  // scrollTop 2800 / 28 = row 100 at the top; first = 100 - 4 = 96.
  const r = visibleRange(2800, 280, 28, 1000, 4);
  assert.equal(r.first, 96);
  assert.equal(r.last, 96 + (10 + 8));
  assert.equal(r.offsetY, 96 * 28);
});

test('visibleRange: near the end clamps last to total', () => {
  const total = 1000;
  const r = visibleRange((total - 5) * 28, 280, 28, total, 4);
  assert.equal(r.last, total, 'never renders past the last row');
  assert.ok(r.first < total);
});

test('visibleRange: empty / zero-height degrade to an empty window', () => {
  assert.deepEqual(visibleRange(0, 280, 28, 0, 4), { first: 0, last: 0, offsetY: 0, totalHeight: 0 });
  assert.deepEqual(visibleRange(0, 0, 28, 100, 4), { first: 0, last: 0, offsetY: 0, totalHeight: 2800 });
});

test('visibleRange: a huge sheet keeps the window bounded (fixed DOM budget)', () => {
  const r = visibleRange(500_000, 400, 20, 1_000_000, 6);
  assert.ok(r.last - r.first <= Math.ceil(400 / 20) + 6 * 2 + 1, 'window size is O(viewport), not O(total)');
  assert.equal(r.totalHeight, 1_000_000 * 20);
});

// ── mount (jsdom) ────────────────────────────────────────────────────────────

test('mountDataGrid: builds the grid structure and round-trips the value', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<div id="host"></div>');
  const g = globalThis as unknown as { document?: Document; ResizeObserver?: unknown };
  const prevDoc = g.document, prevRO = g.ResizeObserver;
  g.document = dom.window.document;
  g.ResizeObserver = undefined; // exercise the no-RO fallback
  try {
    const host = dom.window.document.getElementById('host')!;
    const value = { columns: ['A', 'B'], rows: [['1', '2'], ['3', '4'], ['5', '6']] };
    const grid = mountDataGrid(host as unknown as HTMLElement, { value, editable: true });

    assert.equal(host.getAttribute('role'), 'grid');
    assert.equal(host.getAttribute('aria-colcount'), '2');
    assert.equal(host.getAttribute('aria-rowcount'), '4', 'rows + header');
    assert.ok(host.querySelector('.dg-header'), 'has a header');
    // getValue clones - a mutation of the returned object must not leak back in.
    const got = grid.getValue();
    assert.deepEqual(got, value);
    got.rows[0]![0] = 'mutated';
    assert.deepEqual(grid.getValue().rows[0]![0], '1', 'getValue returns a defensive copy');

    grid.setValue({ columns: ['X'], rows: [['9']] });
    assert.equal(host.getAttribute('aria-colcount'), '1');
    grid.destroy();
    assert.equal(host.getAttribute('role'), null, 'destroy cleans up');
  } finally {
    g.document = prevDoc; g.ResizeObserver = prevRO;
  }
});

test('mountDataGrid: row/column delete removes the right cells and commits', async () => {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<div id="host"></div>');
  const g = globalThis as unknown as { document?: Document; ResizeObserver?: unknown };
  const prevDoc = g.document, prevRO = g.ResizeObserver;
  g.document = dom.window.document;
  g.ResizeObserver = undefined;
  try {
    const host = dom.window.document.getElementById('host')!;
    let last: { columns: string[]; rows: string[][] } | null = null;
    const value = { columns: ['A', 'B', 'C'], rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']] };
    const grid = mountDataGrid(host as unknown as HTMLElement, { value, editable: true, onChange: v => { last = v; } });
    // jsdom reports clientHeight 0, so rows don't virtualize in; give the viewport a
    // height and re-render so the per-row × controls exist to click.
    const vp = host.querySelector('.dg-viewport')!;
    Object.defineProperty(vp, 'clientHeight', { value: 280, configurable: true });
    grid.setValue(value);
    const click = (el: Element) => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));

    // Delete the middle row via its gutter ×.
    click(host.querySelector('[data-del-row="1"]')!);
    assert.deepEqual(grid.getValue().rows, [['1', '2', '3'], ['7', '8', '9']]);
    assert.deepEqual(last!.rows, [['1', '2', '3'], ['7', '8', '9']], 'onChange fired with the shrunk table');
    assert.equal(host.getAttribute('aria-rowcount'), '3', '2 rows + header');

    // Delete column A via its header ×.
    click(host.querySelector('[data-del-col="0"]')!);
    assert.deepEqual(grid.getValue(), { columns: ['B', 'C'], rows: [['2', '3'], ['8', '9']] });
    assert.equal(host.getAttribute('aria-colcount'), '2');
    grid.destroy();

    // A read-only viewer shows NO delete controls at all.
    const ro = mountDataGrid(host as unknown as HTMLElement, { value, editable: false });
    assert.equal(host.querySelector('[data-del-col]'), null, 'no column-delete when not editable');
    assert.equal(host.querySelector('.dg-rowctl'), null, 'no row-delete gutter when not editable');
    ro.destroy();
  } finally {
    g.document = prevDoc; g.ResizeObserver = prevRO;
  }
});
