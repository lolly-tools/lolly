// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { layoutSectionRows, wireLayoutTracks } from './design-layout-section.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box } from './free-canvas-math.ts';

function fixture(boxes: Box[], rows: Box[]) {
  const dom = new JSDOM('<!doctype html><body><aside></aside></body>');
  const root = dom.window.document.querySelector<HTMLElement>('aside')!;
  let tracks = rows;
  const writes: unknown[] = [];
  const model = {
    getBoxes: () => boxes,
    getInput: () => tracks,
    setInput: (id: string, value: unknown) => {
      assert.equal(id, 'layoutTracks');
      tracks = value as Box[];
      writes.push(value);
    },
  } as unknown as ModelPort;
  const controls = {
    selectRow: (
      label: string,
      field: string,
      value: unknown,
      options: Array<{ value: string; label: string }>
    ) =>
      `<label>${label}<select data-fld="${field}">${options.map((o) => `<option value="${o.value}"${o.value === value ? ' selected' : ''}>${o.label}</option>`).join('')}</select></label>`,
    toggleRow: (label: string, field: string, value: boolean) =>
      `<label>${label}<input data-fld="${field}" type="checkbox"${value ? ' checked' : ''}></label>`,
    numRow: (label: string, field: string, value: number) =>
      `<label>${label}<input data-fld="${field}" type="number" value="${value}"></label>`,
    textRow: (label: string, field: string, value: unknown) =>
      `<label>${label}<input data-fld="${field}" value="${value}"></label>`,
  };
  return { dom, root, writes, model, controls, tracks: () => tracks };
}
const grid: Box = { id: 'grid', kind: 'box', layout: 'grid' };
const track: Box = { id: 'track', container: 'grid', axis: 'column', order: 0, track: '1fr' };

test('grid controls show editable typed tracks and exclude ownership cycles', () => {
  const child = { id: 'child', layout: 'flex', layoutOwner: 'grid' },
    unrelated = { id: 'other', name: 'Other layout', layout: 'flex' };
  const f = fixture([grid, child, unrelated], [track]);
  try {
    f.root.innerHTML = layoutSectionRows(grid, f.model, f.controls);
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-layout-tracks="column"]')!.value,
      '1fr'
    );
    assert.equal(f.root.querySelector<HTMLInputElement>('[data-layout-tracks="row"]')!.value, '');
    assert.deepEqual(
      [...f.root.querySelector<HTMLSelectElement>('[data-fld="layoutOwner"]')!.options].map(
        (o) => o.value
      ),
      ['', 'other']
    );
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-fld="layoutMaxW"]')!.value,
      '',
      'an absent maximum is unlimited'
    );
    assert.equal(f.root.querySelector<HTMLSelectElement>('[data-fld="layoutW"]')!.value, 'fixed');
  } finally {
    f.dom.window.close();
  }
});

test('track edits preserve stable identities, validate first and write one whole collection', () => {
  const f = fixture(
    [grid],
    [
      track,
      { id: 'row', container: 'grid', axis: 'row', order: 0, track: 'auto' },
      { id: 'other', container: 'other', axis: 'column', order: 0, track: '20px' },
    ]
  );
  try {
    f.root.innerHTML = layoutSectionRows(grid, f.model, f.controls);
    wireLayoutTracks(f.root, f.model, ['grid']);
    const control = f.root.querySelector<HTMLInputElement>('[data-layout-tracks="column"]')!;
    const change = (value: string) => {
      control.value = value;
      control.dispatchEvent(new f.dom.window.Event('change', { bubbles: true }));
    };
    change('120px auto 2fr 25%');
    assert.equal(f.writes.length, 1);
    const columns = f.tracks().filter((t) => t.axis === 'column' && t.container === 'grid');
    assert.equal(columns[0]!.id, 'track');
    assert.equal(new Set(columns.map((t) => t.id)).size, 4);
    assert.deepEqual(
      columns.map((t) => t.track),
      ['120px', 'auto', '2fr', '25%']
    );
    assert.equal(f.tracks().find((t) => t.id === 'row')!.track, 'auto');
    assert.equal(f.tracks().find((t) => t.id === 'other')!.track, '20px');
    const previous = structuredClone(f.tracks());
    change('1fr minmax(0,1fr)');
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.tracks(), previous);
    assert.equal(control.checkValidity(), false);
    change('');
    assert.equal(control.checkValidity(), true);
    assert.equal(f.writes.length, 2);
    assert.equal(f.tracks().filter((t) => t.container === 'grid' && t.axis === 'column').length, 0);
    f.root.replaceChildren();
    change('1fr');
    assert.equal(f.writes.length, 2, 'detached controls cannot commit');
  } finally {
    f.dom.window.close();
  }
});

test('multiple selected layouts do not accidentally edit only the first grid tracks', () => {
  const f = fixture([grid, { ...grid, id: 'other' }], [track]);
  try {
    f.root.innerHTML = layoutSectionRows(grid, f.model, f.controls, ['grid', 'other']);
    assert.equal(f.root.querySelectorAll('[data-layout-tracks]').length, 0);
  } finally {
    f.dom.window.close();
  }
});

test('absolute controls expose local coordinates and grid spans remain authorable', () => {
  const item = {
    id: 'item',
    layoutOwner: 'grid',
    layoutAbsolute: 'true',
    layoutX: 3,
    layoutY: 5,
    layoutAngle: 20,
    layoutRowSpan: 2,
    layoutColumnSpan: 3,
  };
  const f = fixture([grid, item], [track]);
  try {
    f.root.innerHTML = layoutSectionRows(item, f.model, f.controls);
    for (const [field, value] of [
      ['layoutX', 3],
      ['layoutY', 5],
      ['layoutAngle', 20],
      ['layoutRowSpan', 2],
      ['layoutColumnSpan', 3],
    ])
      assert.equal(
        f.root.querySelector<HTMLInputElement>(`[data-fld="${field}"]`)!.value,
        String(value)
      );
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-fld="layoutAbsolute"]')!.checked,
      true
    );
  } finally {
    f.dom.window.close();
  }
});
