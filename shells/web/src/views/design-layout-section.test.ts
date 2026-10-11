// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  layoutSectionRows,
  wireLayoutTracks,
  wireLayoutControls,
} from './design-layout-section.ts';
import type { ModelPort } from './design-ports.ts';
import type { Box } from './free-canvas-math.ts';
import {
  addTrackPlacement,
  removeTrackPlacement,
  reorderTrackPlacement,
} from './design-layout-track-placement.ts';

function fixture(boxes: Box[], rows: Box[]) {
  const dom = new JSDOM('<!doctype html><body><aside></aside></body>');
  const root = dom.window.document.querySelector<HTMLElement>('aside')!;
  let tracks = rows;
  let currentBoxes = boxes;
  const history: Array<{ boxes: Box[]; tracks: Box[] }> = [];
  const commits: Array<{ boxes: Box[]; patch?: Record<string, unknown>; label?: string }> = [];
  const remember = () => history.push(structuredClone({ boxes: currentBoxes, tracks }));
  const writes: unknown[] = [];
  const model = {
    cfg: { idField: 'id' },
    getBoxes: () => currentBoxes,
    commit: (next: Box[], patch?: Record<string, unknown>, label?: string) => {
      remember();
      currentBoxes = next;
      if (patch?.layoutTracks) tracks = patch.layoutTracks as Box[];
      commits.push({ boxes: next, patch, label });
    },
    setField: (ids: string[], field: string, value: unknown) => {
      model.commit(
        currentBoxes.map((row) =>
          ids.includes(String(row.id)) ? ({ ...row, [field]: value } as Box) : row
        )
      );
    },
    getInput: () => tracks,
    setInput: (id: string, value: unknown) => {
      assert.equal(id, 'layoutTracks');
      remember();
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
  return {
    dom,
    root,
    writes,
    commits,
    model,
    controls,
    tracks: () => tracks,
    boxes: () => currentBoxes,
    undo: () => {
      const previous = history.pop()!;
      currentBoxes = previous.boxes;
      tracks = previous.tracks;
    },
    render: (id: string, ids = [id]) => {
      root.innerHTML = layoutSectionRows(
        currentBoxes.find((row) => row.id === id)!,
        model,
        controls,
        ids
      );
      wireLayoutControls(root, model, ids);
    },
  };
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
    assert.equal(
      f.root
        .querySelector<HTMLButtonElement>(
          '[data-layout-field="layoutW"][data-layout-value="fixed"]'
        )!
        .getAttribute('aria-pressed'),
      'true'
    );
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
      f.root
        .querySelector<HTMLButtonElement>(
          '[data-layout-field="layoutAbsolute"][data-layout-value="true"]'
        )!
        .getAttribute('aria-pressed'),
      'true'
    );
  } finally {
    f.dom.window.close();
  }
});

test('compact defaults keep advanced fields and grid track rows collapsed', () => {
  const f = fixture([grid], [track]);
  try {
    f.render('grid');
    assert.equal(f.root.querySelector<HTMLDetailsElement>('[data-layout-advanced]')!.open, false);
    assert.equal(f.root.querySelector<HTMLElement>('[data-layout-grid-editor]')!.hidden, true);
    assert.equal(
      f.root.querySelector<HTMLDetailsElement>('[data-layout-track-section="column"]')!.open,
      false
    );
    assert.equal(
      f.root.querySelectorAll('.dl-first-row [data-layout-field="layoutAlign"]').length,
      3
    );
    assert.equal(f.root.querySelectorAll('[data-layout-field="layoutJustify"]').length, 6);
    assert.equal(
      f.root.querySelector<HTMLButtonElement>(
        '[data-layout-field="layoutW"][data-layout-value="fill"]'
      )!.disabled,
      true
    );
    assert.equal(f.commits.length + f.writes.length, 0);
  } finally {
    f.dom.window.close();
  }
});

test('paired padding and margins commit one gesture across selection and undo together', () => {
  const rows = [
    {
      id: 'a',
      layout: 'flex',
      layoutOwner: 'parent',
      layoutPadTop: 4,
      layoutPadBottom: 4,
      layoutMarginTop: 2,
      layoutMarginBottom: 2,
      x: 100,
    },
    {
      id: 'b',
      layout: 'flex',
      layoutOwner: 'parent',
      layoutPadTop: 8,
      layoutPadBottom: 8,
      layoutMarginTop: 6,
      layoutMarginBottom: 6,
      x: 220,
    },
    { id: 'parent', layout: 'flex' },
  ];
  const f = fixture(rows, []);
  try {
    f.render('a', ['a', 'b']);
    const input = f.root.querySelector<HTMLInputElement>(
      '[data-layout-number="padding-vertical"]'
    )!;
    assert.equal(input.value, '');
    input.value = '24';
    input.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.commits.length, 1);
    assert.deepEqual(
      f
        .boxes()
        .slice(0, 2)
        .map((row) => [row.layoutPadTop, row.layoutPadBottom, row.x]),
      [
        [24, 24, 100],
        [24, 24, 220],
      ]
    );
    f.undo();
    assert.deepEqual(f.boxes(), rows);
    f.render('a', ['a', 'b']);
    const margin = f.root.querySelector<HTMLInputElement>(
      '[data-layout-number="margin-horizontal"]'
    )!;
    margin.value = '12';
    margin.dispatchEvent(new f.dom.window.Event('change'));
    assert.deepEqual(
      f
        .boxes()
        .slice(0, 2)
        .map((row) => [row.layoutMarginLeft, row.layoutMarginRight]),
      [
        [12, 12],
        [12, 12],
      ]
    );
    const toggle = f.root.querySelector<HTMLButtonElement>('[data-layout-ui="margin"]')!;
    toggle.click();
    assert.equal(f.commits.length, 2, 'presentation toggles do not add history');
    assert.equal(
      f.root.querySelector<HTMLElement>('[data-layout-spacing="margin"] [data-layout-individual]')!
        .hidden,
      false
    );
    f.root.replaceChildren();
    margin.value = '35';
    margin.dispatchEvent(new f.dom.window.Event('change'));
    toggle.click();
    assert.equal(f.commits.length, 2, 'detached controls cannot edit a previous selection');
  } finally {
    f.dom.window.close();
  }
});

test('flex gap axes preserve inactive values and mixed sizing has explicit state', () => {
  const f = fixture(
    [
      { id: 'a', layout: 'flex', layoutDirection: 'row', layoutGapY: 29, layoutW: 'fixed' },
      { id: 'b', layout: 'flex', layoutDirection: 'row', layoutGapY: 31, layoutW: 'hug' },
    ],
    []
  );
  try {
    f.render('a', ['a', 'b']);
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-layout-number="gap-y"]')!.disabled,
      true
    );
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-layout-number="gap-x"]')!.disabled,
      false
    );
    assert.equal(
      f.root
        .querySelector<HTMLButtonElement>(
          '[data-layout-field="layoutW"][data-layout-value="fixed"]'
        )!
        .getAttribute('aria-pressed'),
      'mixed'
    );
    f.root.querySelector<HTMLButtonElement>('[data-layout-field="layoutWrap"]')!.click();
    assert.deepEqual(
      f.boxes().map((row) => [row.layoutWrap, row.layoutGapY]),
      [
        [true, 29],
        [true, 31],
      ]
    );
    f.render('a', ['a', 'b']);
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-layout-number="gap-y"]')!.disabled,
      false
    );
    const old = f.root.querySelector<HTMLButtonElement>(
      '[data-layout-field="layoutW"][data-layout-value="hug"]'
    )!;
    f.root.replaceChildren();
    old.click();
    assert.equal(f.commits.length, 1);
  } finally {
    f.dom.window.close();
  }
});

test('typed track edits preserve IDs, custom expressions and the grid editing session', () => {
  const f = fixture([grid], [track, { ...track, id: 'custom', order: 1, track: 'minmax(0,1fr)' }]);
  try {
    f.render('grid');
    f.root.querySelector<HTMLButtonElement>('[data-layout-edit-grid]')!.click();
    const details = f.root.querySelector<HTMLDetailsElement>(
      '[data-layout-track-section="column"]'
    )!;
    details.open = true;
    details.dispatchEvent(new f.dom.window.Event('toggle'));
    assert.equal(
      f.root.querySelector<HTMLSelectElement>(
        '[data-layout-track-unit][data-layout-track-id="custom"]'
      )!.value,
      'custom'
    );
    assert.equal(
      f.root.querySelector<HTMLInputElement>(
        '[data-layout-track-value][data-layout-track-id="custom"]'
      )!.disabled,
      true
    );
    const unit = f.root.querySelector<HTMLSelectElement>(
      '[data-layout-track-unit][data-layout-track-id="track"]'
    )!;
    unit.value = 'px';
    unit.dispatchEvent(new f.dom.window.Event('change'));
    assert.deepEqual(
      f.tracks().map((row) => [row.id, row.track]),
      [
        ['track', '1px'],
        ['custom', 'minmax(0,1fr)'],
      ]
    );
    assert.equal(f.writes.length, 1);
    f.render('grid');
    assert.equal(f.root.querySelector<HTMLElement>('[data-layout-grid-editor]')!.hidden, false);
    assert.equal(
      f.root.querySelector<HTMLDetailsElement>('[data-layout-track-section="column"]')!.open,
      true
    );
    const value = f.root.querySelector<HTMLInputElement>(
      '[data-layout-track-value][data-layout-track-id="track"]'
    )!;
    value.value = '120';
    value.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.tracks()[0]!.track, '120px');
    f.undo();
    assert.equal(f.tracks()[0]!.track, '1px');
    f.root.replaceChildren();
    value.value = '20';
    value.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.writes.length, 2);
  } finally {
    f.dom.window.close();
  }
});

test('grid structural actions update explicit cells and tracks in one undo step', () => {
  const item = { id: 'item', frame: 'grid', layoutColumn: 2, layoutRow: 2, layoutColumnSpan: 1 };
  const tracks = [track, { ...track, id: 'second', order: 1, track: '100px' }];
  const f = fixture([grid, item], tracks);
  try {
    f.render('grid');
    assert.equal(
      f.root.querySelector<HTMLButtonElement>(
        '[data-layout-track-action="up"][data-layout-track-id="track"]'
      )!.disabled,
      true
    );
    f.root
      .querySelector<HTMLButtonElement>(
        '[data-layout-track-action="remove"][data-layout-track-id="track"]'
      )!
      .click();
    assert.equal(f.commits.length, 1);
    assert.equal(f.writes.length, 0);
    assert.equal(f.boxes()[1]!.layoutColumn, 1);
    assert.deepEqual(
      f.tracks().map((row) => [row.id, row.order]),
      [['second', 0]]
    );
    f.undo();
    assert.deepEqual(f.boxes(), [grid, item]);
    assert.deepEqual(f.tracks(), tracks);
    f.render('grid');
    f.root
      .querySelector<HTMLButtonElement>(
        '[data-layout-track-action="up"][data-layout-track-id="second"]'
      )!
      .click();
    assert.equal(f.boxes()[1]!.layoutColumn, 1);
    assert.deepEqual(
      f.tracks().map((row) => row.id),
      ['second', 'track']
    );
    f.undo();
    assert.deepEqual(f.boxes(), [grid, item]);
    assert.deepEqual(f.tracks(), tracks);
  } finally {
    f.dom.window.close();
  }
});

test('track edits adapt occupied Penpot span semantics and preserve automatic intent', () => {
  const rows: Box[] = [
    { id: 'cover', layoutOwner: 'grid', layoutColumn: 1, layoutColumnSpan: 3 },
    { id: 'start', layoutOwner: 'grid', layoutColumn: 2, layoutColumnSpan: 2 },
    { id: 'later', frame: 'grid', layoutColumn: 3 },
    {
      id: 'orphan',
      layoutOwner: 'grid',
      layoutRow: 1,
      layoutColumn: 2,
      layoutRowSpan: 2,
      layoutColumnSpan: 1,
      layoutArea: 'hero',
    },
    { id: 'auto', layoutOwner: 'grid', layoutColumn: 0, layoutRow: 0 },
    { id: 'absolute', layoutOwner: 'grid', layoutColumn: 2, layoutAbsolute: true },
    { id: 'other', layoutOwner: 'other', frame: 'grid', layoutColumn: 3 },
  ];
  const removed = removeTrackPlacement(rows, 'grid', 'column', 1);
  assert.deepEqual(
    removed.slice(0, 3).map((row) => [row.layoutColumn, row.layoutColumnSpan]),
    [
      [1, 2],
      [2, 1],
      [2, undefined],
    ]
  );
  assert.deepEqual(
    [
      removed[3]!.layoutRow,
      removed[3]!.layoutColumn,
      removed[3]!.layoutRowSpan,
      removed[3]!.layoutColumnSpan,
      removed[3]!.layoutArea,
    ],
    [0, 0, 1, 1, '']
  );
  assert.deepEqual(removed.slice(4), rows.slice(4));
  const split = reorderTrackPlacement(
    [{ id: 'split', layoutOwner: 'grid', layoutColumn: 1, layoutColumnSpan: 2 }],
    'grid',
    'column',
    2,
    1
  );
  assert.equal(
    split[0]!.layoutColumnSpan,
    1,
    'upward insertion uses the boundary before the target'
  );
  const added = addTrackPlacement(rows, 'grid', 'column', 2);
  assert.deepEqual(
    added.slice(0, 3).map((row) => [row.layoutColumn, row.layoutColumnSpan]),
    [
      [1, 4],
      [2, 3],
      [4, undefined],
    ]
  );
  assert.deepEqual(added.slice(4), rows.slice(4));
});

test('grid item coordinates and provisional area controls reflect undo and frame ownership', () => {
  const item = { id: 'item', frame: 'grid', layoutRow: 1, layoutColumn: 2, layoutColumnSpan: 2 };
  const f = fixture([grid, item], [track]);
  try {
    f.render('item');
    assert.equal(
      f.root.querySelector<HTMLInputElement>('[data-layout-coordinate="column-end"]')!.value,
      '4'
    );
    assert.equal(
      f.root.querySelector<HTMLButtonElement>(
        '[data-layout-field="layoutW"][data-layout-value="fill"]'
      )!.disabled,
      false
    );
    const end = f.root.querySelector<HTMLInputElement>('[data-layout-coordinate="column-end"]')!;
    end.value = '6';
    end.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.boxes()[1]!.layoutColumnSpan, 4);
    f.undo();
    f.render('item');
    f.root.querySelector<HTMLButtonElement>('[data-layout-placement="auto"]')!.click();
    f.render('item');
    assert.equal(
      f.root
        .querySelector<HTMLButtonElement>('[data-layout-placement="auto"]')!
        .getAttribute('aria-pressed'),
      'true'
    );
    f.undo();
    f.render('item');
    assert.equal(
      f.root
        .querySelector<HTMLButtonElement>('[data-layout-placement="manual"]')!
        .getAttribute('aria-pressed'),
      'true'
    );
  } finally {
    f.dom.window.close();
  }
});

test('adding a track opens its axis and options stay collapsed until requested', () => {
  const f = fixture([grid], [track]);
  try {
    f.render('grid');
    assert.equal(
      f.root.querySelector<HTMLDetailsElement>('[data-layout-track-options="track"]')!.open,
      false
    );
    f.root.querySelector<HTMLButtonElement>('[data-layout-edit-grid]')!.click();
    f.root
      .querySelector<HTMLButtonElement>(
        '[data-layout-track-action="add"][data-layout-axis="column"]'
      )!
      .click();
    assert.equal(f.commits.length, 1);
    assert.equal(f.tracks().length, 2);
    f.render('grid');
    assert.equal(
      f.root.querySelector<HTMLDetailsElement>('[data-layout-track-section="column"]')!.open,
      true
    );
    assert.equal(f.root.querySelector<HTMLElement>('[data-layout-grid-editor]')!.hidden, false);
    const options = f.root.querySelector<HTMLDetailsElement>(
      '[data-layout-track-options="track"]'
    )!;
    options.open = true;
    options.dispatchEvent(new f.dom.window.Event('toggle'));
    const expression = f.root.querySelector<HTMLInputElement>(
      '[data-layout-track-expression][data-layout-track-id="track"]'
    )!;
    expression.value = '0fr';
    expression.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(expression.checkValidity(), false);
    assert.equal(f.writes.length, 0);
    expression.value = '2fr';
    expression.dispatchEvent(new f.dom.window.Event('change'));
    f.render('grid');
    assert.equal(
      f.root.querySelector<HTMLDetailsElement>('[data-layout-track-options="track"]')!.open,
      true
    );
    assert.equal(f.tracks()[0]!.track, '2fr');
  } finally {
    f.dom.window.close();
  }
});

test('uniform gap stops writing an axis after flex wrap is disabled', () => {
  const f = fixture(
    [{ id: 'a', layout: 'flex', layoutWrap: true, layoutGapX: 4, layoutGapY: 19 }],
    []
  );
  try {
    f.render('a');
    f.root.querySelector<HTMLButtonElement>('[data-layout-ui="gap"]')!.click();
    f.root.querySelector<HTMLButtonElement>('[data-layout-field="layoutWrap"]')!.click();
    f.render('a');
    const column = f.root.querySelector<HTMLInputElement>('[data-layout-number="gap-x"]')!;
    column.value = '14';
    column.dispatchEvent(new f.dom.window.Event('change'));
    assert.equal(f.boxes()[0]!.layoutGapX, 14);
    assert.equal(f.boxes()[0]!.layoutGapY, 19);
    assert.equal(f.commits.length, 2);
  } finally {
    f.dom.window.close();
  }
});

test('grid distribution mirrors upstream stretch choices and keeps evenly available in advanced', () => {
  const f = fixture(
    [{ ...grid, layoutDirection: 'column', layoutJustify: 'space-evenly' }],
    [track]
  );
  try {
    f.render('grid');
    for (const field of ['layoutJustify', 'layoutAlignContent']) {
      assert.deepEqual(
        [...f.root.querySelectorAll<HTMLButtonElement>(`[data-layout-field="${field}"]`)].map(
          (button) => button.dataset.layoutValue
        ),
        ['start', 'center', 'end', 'space-around', 'space-between', 'stretch']
      );
    }
    assert.equal(
      f.root.querySelector<HTMLSelectElement>('[data-fld="layoutJustify"]')!.value,
      'space-evenly'
    );
    assert.equal(f.root.querySelectorAll('.dl-grid-first-row button').length, 8);
    f.root
      .querySelector<HTMLButtonElement>(
        '[data-layout-field="layoutJustify"][data-layout-value="stretch"]'
      )!
      .click();
    assert.equal(f.boxes()[0]!.layoutJustify, 'stretch');
    f.undo();
    assert.equal(f.boxes()[0]!.layoutJustify, 'space-evenly');
  } finally {
    f.dom.window.close();
  }
});
