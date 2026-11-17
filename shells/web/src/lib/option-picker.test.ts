// SPDX-License-Identifier: MPL-2.0
/**
 * lib/option-picker.ts - the `display: "picker"` select. jsdom hosts the real
 * mountBodyPopover underneath, so these pin the genuine lifecycle: open and
 * close, focus, each key, choosing, an outside press, groups, the glyph pattern,
 * an option that is not applicable, the phone sheet and teardown. jsdom measures
 * nothing, so where the panel goes and how many columns it draws are pinned on
 * the two pure functions that decide them.
 *
 * The glyphs here are test fixtures. Chart's own are in its manifest, held by
 * tests/chart-sidebar-order.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

import {
  closeOptionPicker,
  drawsAsButtons,
  GLYPH_MAX_LENGTH,
  GLYPH_PATTERN,
  groupOptions,
  optionPickerHtml,
  panelPlace,
  pickerColumns,
  pickerPanelHtml,
  pickerSpec,
  safeGlyph,
  verticalNeighbour,
  wireOptionPicker,
  type PickerChoice,
  type PickerInput,
} from './option-picker.ts';

const BAR = 'M5 20V11 M12 20V5 M19 20v-7';
const LINE = 'M4 17l5-6 4 3 7-8';
const PIE = 'M12 3a9 9 0 1 0 9 9h-9z';

const INPUT: PickerInput = {
  id: 'chartType',
  label: 'Chart type',
  value: 'bar',
  options: [
    { value: 'bar', glyph: BAR, group: 'Compare' },
    { value: 'lollipop', group: 'Compare' },
    { value: 'line', glyph: LINE, group: 'Change over time' },
    { value: 'area', group: 'Change over time' },
    { value: 'pie', glyph: PIE, group: 'Parts of a whole' },
    { value: 'loose' },
  ],
};
const CHOICES: PickerChoice[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'lollipop', label: 'Lollipop' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'pie', label: 'Pie' },
  { value: 'loose', label: 'Loose one' },
];

interface Harness {
  doc: Document;
  win: Window & typeof globalThis;
  trigger: HTMLButtonElement;
  commits: string[];
  /** What held focus when each commit ran. */
  focusAtCommit: Array<Element | null>;
  panel(): HTMLElement | null;
  tiles(): HTMLElement[];
  key(key: string, target?: Element | null): KeyboardEvent;
  active(): Element | null;
}

function harness(opts: { width?: number; input?: PickerInput; choices?: PickerChoice[] } = {}): Harness {
  const dom = new JSDOM('<!doctype html><html><body><div id="side"></div></body></html>', { pretendToBeVisual: true, url: 'https://lolly.test/#/tool/chart' });
  const win = dom.window as unknown as Window & typeof globalThis;
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = win.document;
  g.HTMLElement = win.HTMLElement;
  g.Element = win.Element;
  g.Node = win.Node;
  Object.defineProperty(win, 'innerWidth', { value: opts.width ?? 1440, configurable: true });
  Object.defineProperty(win, 'innerHeight', { value: 900, configurable: true });
  // The layout read needs a matchMedia; no query matches (a fine pointer), so no
  // history entry is pushed and the width alone decides phone or desktop.
  const mm = (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
  (win as unknown as Record<string, unknown>).matchMedia = mm;
  g.matchMedia = mm;
  const doc = win.document;
  const side = doc.getElementById('side')!;
  side.innerHTML = `<span id="irow-label-chartType">Chart type</span>${optionPickerHtml(opts.input ?? INPUT, opts.choices ?? CHOICES)}`;
  const trigger = side.querySelector<HTMLButtonElement>('[data-option-picker]')!;
  const commits: string[] = [];
  const focusAtCommit: Array<Element | null> = [];
  assert.equal(wireOptionPicker(trigger, (v) => { commits.push(v); focusAtCommit.push(doc.activeElement); }), true);
  return {
    doc,
    win,
    trigger,
    commits,
    focusAtCommit,
    panel: () => doc.querySelector<HTMLElement>('.option-picker-panel'),
    tiles: () => [...doc.querySelectorAll<HTMLElement>('[role="option"]')],
    key(key, target) {
      const e = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      (target ?? doc.activeElement ?? doc.body).dispatchEvent(e);
      return e;
    },
    active: () => doc.activeElement,
  };
}

const label = (el: Element | null): string => el?.querySelector('.option-picker-tile-label')?.textContent ?? '';
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test('the trigger is a button in the select box, naming the input and the current choice', () => {
  const h = harness();
  const t = h.trigger;
  assert.equal(t.tagName, 'BUTTON');
  assert.equal(t.type, 'button');
  assert.ok(t.classList.contains('field-select'), 'the native select box, chevron included');
  assert.equal(t.getAttribute('aria-haspopup'), 'listbox');
  assert.equal(t.getAttribute('aria-expanded'), 'false');
  assert.equal(t.getAttribute('aria-controls'), 'opick-chartType');
  assert.equal(t.dataset.inputId, 'chartType');
  assert.equal(t.dataset.badgeSelect, 'chartType');
  assert.equal(t.value, 'bar', 'the sync check reads the value off the control');
  assert.equal(t.getAttribute('aria-labelledby'), 'irow-label-chartType opick-cur-chartType');
  assert.equal(t.querySelector('.option-picker-current')!.textContent, 'Bar');
  assert.equal(t.querySelector('.option-picker-glyph path')!.getAttribute('d'), BAR);
  closeOptionPicker();
});

test('a non-picker element is left to the caller', () => {
  const h = harness();
  const other = h.doc.createElement('div');
  assert.equal(wireOptionPicker(other, () => {}), false);
});

test('opening mounts one listbox on body, labelled, with the chosen tile focused', () => {
  const h = harness();
  h.trigger.click();
  const panel = h.panel()!;
  assert.ok(panel, 'mounted');
  assert.equal(panel.parentElement, h.doc.body);
  const list = panel.querySelector('[role="listbox"]')!;
  assert.equal(list.id, 'opick-chartType');
  assert.equal(list.getAttribute('aria-label'), 'Chart type');
  assert.equal(h.trigger.getAttribute('aria-expanded'), 'true');
  const selected = h.tiles().filter((t) => t.getAttribute('aria-selected') === 'true');
  assert.deepEqual(selected.map(label), ['Bar'], 'exactly one tile is chosen');
  assert.ok(selected[0]!.classList.contains('is-on'));
  assert.equal(h.active(), selected[0], 'focus moves to the chosen tile');
  assert.equal(panel.style.position, '', 'position comes from the stylesheet');
  assert.match(panel.style.left, /px$/);
  closeOptionPicker();
  assert.equal(h.panel(), null);
});

test('groups: the unlabelled run first, then headings in order of first appearance', () => {
  const groups = groupOptions(pickerSpec(INPUT, CHOICES).options);
  assert.deepEqual(groups.map((g) => [g.heading, g.options.map((o) => o.value)]), [
    [null, ['loose']],
    ['Compare', ['bar', 'lollipop']],
    ['Change over time', ['line', 'area']],
    ['Parts of a whole', ['pie']],
  ]);
  const h = harness();
  h.trigger.click();
  const named = [...h.doc.querySelectorAll('[role="group"]')];
  assert.equal(named.length, 3);
  for (const group of named) {
    const head = h.doc.getElementById(group.getAttribute('aria-labelledby')!)!;
    assert.ok(group.contains(head), 'the heading labels its own group');
  }
  assert.deepEqual(named.map((g) => h.doc.getElementById(g.getAttribute('aria-labelledby')!)!.textContent), ['Compare', 'Change over time', 'Parts of a whole']);
  assert.deepEqual(h.tiles().map(label), ['Loose one', 'Bar', 'Lollipop', 'Line', 'Area', 'Pie']);
  closeOptionPicker();
});

test('Escape closes with no change and returns focus to the trigger', () => {
  const h = harness();
  h.trigger.click();
  h.key('Escape');
  assert.equal(h.panel(), null);
  assert.equal(h.active(), h.trigger);
  assert.equal(h.trigger.getAttribute('aria-expanded'), 'false');
  assert.deepEqual(h.commits, []);
});

test('Tab closes with no change and returns focus to the trigger', () => {
  const h = harness();
  h.trigger.click();
  const e = h.key('Tab');
  assert.equal(e.defaultPrevented, true);
  assert.equal(h.panel(), null);
  assert.equal(h.active(), h.trigger);
  assert.deepEqual(h.commits, []);
});

test('left and right step in reading order, Home and End go to the ends', () => {
  const h = harness();
  h.trigger.click();
  assert.equal(label(h.active()), 'Bar');
  h.key('ArrowRight');
  assert.equal(label(h.active()), 'Lollipop');
  h.key('ArrowRight');
  assert.equal(label(h.active()), 'Line', 'across a group boundary');
  h.key('ArrowLeft');
  assert.equal(label(h.active()), 'Lollipop');
  h.key('End');
  assert.equal(label(h.active()), 'Pie');
  h.key('ArrowRight');
  assert.equal(label(h.active()), 'Pie', 'the last tile stays put');
  h.key('Home');
  assert.equal(label(h.active()), 'Loose one');
  const focusable = h.tiles().filter((t) => t.tabIndex === 0);
  assert.deepEqual(focusable.map(label), ['Loose one'], 'one tab stop moves with focus');
  closeOptionPicker();
});

test('up and down move by geometry, across groups, to the nearest tile across', () => {
  const h = harness();
  h.trigger.click();
  // Two columns, 100px wide and 80px tall: the unlabelled run on row 0, Compare on
  // row 1, Change over time on row 2 (after a heading gap), Parts of a whole on row 3.
  const layout: Record<string, [number, number]> = {
    'Loose one': [0, 0], Bar: [0, 1], Lollipop: [1, 1], Line: [0, 2], Area: [1, 2], Pie: [0, 3],
  };
  for (const tile of h.tiles()) {
    const [col, row] = layout[label(tile)]!;
    const top = row * 110;
    const left = col * 104;
    tile.getBoundingClientRect = () => ({ top, left, bottom: top + 80, right: left + 100, width: 100, height: 80, x: left, y: top, toJSON() {} }) as DOMRect;
  }
  h.key('ArrowRight');
  assert.equal(label(h.active()), 'Lollipop');
  h.key('ArrowDown');
  assert.equal(label(h.active()), 'Area', 'straight down into the next group');
  h.key('ArrowDown');
  assert.equal(label(h.active()), 'Pie', 'the nearest tile on the next row');
  h.key('ArrowDown');
  assert.equal(label(h.active()), 'Pie', 'nothing below the last row');
  h.key('ArrowUp');
  assert.equal(label(h.active()), 'Line');
  h.key('ArrowUp');
  h.key('ArrowUp');
  assert.equal(label(h.active()), 'Loose one');
  closeOptionPicker();
});

test('without layout, up and down fall back to reading order', () => {
  const h = harness();
  h.trigger.click();
  const tiles = h.tiles();
  assert.equal(verticalNeighbour(tiles, tiles[1]!, 1), tiles[2]);
  assert.equal(verticalNeighbour(tiles, tiles[1]!, -1), tiles[0]);
  closeOptionPicker();
});

test('Enter chooses, closes and commits once; focus is back on the trigger first', () => {
  const h = harness();
  h.trigger.click();
  h.key('ArrowRight');
  h.key('ArrowRight');
  h.key('Enter');
  assert.deepEqual(h.commits, ['line']);
  assert.deepEqual(h.focusAtCommit, [h.trigger], 'the rebuild a commit causes restores focus by input id');
  assert.equal(h.panel(), null);
  assert.equal(h.active(), h.trigger);
});

test('Space chooses too, and choosing the current value commits nothing', () => {
  const h = harness();
  h.trigger.click();
  h.key('ArrowLeft');
  h.key(' ');
  assert.deepEqual(h.commits, ['loose']);
  h.trigger.click();
  h.key('Home');
  h.key('ArrowRight');
  h.key('Enter');
  assert.deepEqual(h.commits, ['loose'], 'Bar is still the value the trigger was drawn with');
});

test('a press on a tile chooses and closes', () => {
  const h = harness();
  h.trigger.click();
  h.tiles().find((t) => label(t) === 'Pie')!.click();
  assert.deepEqual(h.commits, ['pie']);
  assert.equal(h.panel(), null);
});

test('a press outside closes with no change; a second press on the trigger closes too', async () => {
  const h = harness();
  h.trigger.click();
  await tick();
  h.doc.body.dispatchEvent(new h.win.Event('pointerdown', { bubbles: true }));
  assert.equal(h.panel(), null);
  assert.deepEqual(h.commits, []);
  h.trigger.click();
  await tick();
  h.trigger.dispatchEvent(new h.win.Event('pointerdown', { bubbles: true }));
  assert.ok(h.panel(), 'a press on the trigger is not an outside press');
  h.trigger.click();
  assert.equal(h.panel(), null);
  assert.equal(h.active(), h.trigger);
});

test('typing letters jumps to the next tile whose label starts with them', () => {
  const h = harness();
  h.trigger.click();
  const e = h.key('l');
  assert.equal(e.defaultPrevented, true, 'a typed letter never reaches a view shortcut');
  assert.equal(label(h.active()), 'Lollipop');
  h.key('l');
  assert.equal(label(h.active()), 'Line', 'the same letter again steps on');
  h.key('l');
  assert.equal(label(h.active()), 'Loose one', 'and wraps round');
  closeOptionPicker();
  h.trigger.click();
  h.key('a');
  assert.equal(label(h.active()), 'Area');
  h.key('z');
  assert.equal(label(h.active()), 'Area', 'no match leaves focus where it is');
  closeOptionPicker();
});

test('the arrow keys open the panel from the trigger', () => {
  const h = harness();
  h.trigger.focus();
  h.key('ArrowDown', h.trigger);
  assert.ok(h.panel());
  assert.equal(label(h.active()), 'Bar');
  closeOptionPicker();
});

test('glyphs: drawn only when they pass the pattern; text-only tiles when none do', () => {
  assert.equal(safeGlyph(BAR), BAR);
  for (const hostile of ['"/><script>alert(1)</script>', 'M0 0" onload="alert(1)', 'url(#x)', '<path d="M0 0"/>', 'M0 0\nL1 1', '', 7, null]) {
    assert.equal(safeGlyph(hostile), null, String(hostile));
  }
  assert.equal(safeGlyph(`M0 0${' L1 1'.repeat(180)}`), null, 'longer than 900 characters');
  const hostile: PickerInput = { id: 'kind', label: 'Kind', value: 'a', options: [
    { value: 'a', glyph: '"><img src=x onerror=alert(1)>' },
    { value: 'b', glyph: 'M0 0" onmouseover="alert(1)' },
  ] };
  const choices = [{ value: 'a', label: '<b>A</b>' }, { value: 'b', label: 'B' }];
  const trigger = optionPickerHtml(hostile, choices);
  assert.doesNotMatch(trigger, /<img|<b>|onerror|onmouseover/);
  assert.match(trigger, /&lt;b&gt;A&lt;\/b&gt;/);
  assert.doesNotMatch(trigger, /<svg/, 'no picture, and no empty glyph slot either');
  const panel = pickerPanelHtml(pickerSpec(hostile, choices), false);
  assert.doesNotMatch(panel, /<img|<b>|onerror|onmouseover|<path/);
  assert.match(panel, /option-picker-list--text/, 'text-only tiles');
  const pictured = pickerPanelHtml(pickerSpec(INPUT, CHOICES), false);
  assert.doesNotMatch(pictured, /option-picker-list--text/);
  assert.equal((pictured.match(/<path d=/g) ?? []).length, 3, 'one outline per glyph');
  assert.match(pictured, /stroke-width="1\.75" stroke-linecap="round" stroke-linejoin="round"/);
});

test('the renderer tests the same glyph bound as the schema, character for character', () => {
  const schema = JSON.parse(readFileSync(new URL('../../../../schemas/tool.schema.json', import.meta.url), 'utf8'));
  const select = schema.$defs.input.allOf.find((b: { if?: { properties?: { type?: { const?: string } } } }) => b.if?.properties?.type?.const === 'select');
  const glyph = select.then.properties.options.items.properties.glyph;
  assert.equal(glyph.maxLength, GLYPH_MAX_LENGTH);
  const theirs = new RegExp(glyph.pattern);
  for (let c = 0; c < 0x3000; c += 1) {
    const s = `M${String.fromCharCode(c)}`;
    assert.equal(GLYPH_PATTERN.test(s), theirs.test(s), `U+${c.toString(16)}`);
  }
});

test('a glyph-free option falls back to its registry icon', () => {
  const html = pickerPanelHtml(pickerSpec({ id: 'k', value: 'a', options: [{ value: 'a' }] }, [{ value: 'a', label: 'A', icon: 'grid' }]), false);
  assert.match(html, /<svg[^>]*viewBox="0 0 24 24"/);
  assert.doesNotMatch(html, /option-picker-list--text/);
});

test('a current value whose option no longer applies stays, marked not applicable', () => {
  const choices: PickerChoice[] = [{ value: 'iso', label: 'Isometric', na: true }, { value: 'plain', label: 'Plain' }];
  const input: PickerInput = { id: 'chartStyle', label: 'Style', value: 'iso', options: [{ value: 'iso' }, { value: 'plain' }] };
  const h = harness({ input, choices });
  assert.ok(h.trigger.classList.contains('is-na'));
  assert.equal(h.trigger.title, 'Not applicable in this mode');
  assert.match(h.trigger.textContent ?? '', /Isometric \(not applicable\)/);
  h.trigger.click();
  const tile = h.tiles()[0]!;
  assert.ok(tile.classList.contains('is-na'));
  assert.equal(tile.getAttribute('aria-selected'), 'true');
  assert.equal(tile.title, 'Not applicable in this mode');
  assert.match(tile.textContent ?? '', /\(not applicable\)/);
  assert.equal(h.tiles()[1]!.classList.contains('is-na'), false);
  closeOptionPicker();
});

test('on a phone the panel is a sheet with a header, and the page behind holds still', () => {
  const h = harness({ width: 390 });
  h.doc.documentElement.style.overflow = 'auto';
  h.trigger.click();
  const panel = h.panel()!;
  assert.ok(panel.classList.contains('is-sheet'));
  assert.ok(panel.querySelector('[data-picker-scrim]'), 'a dimmed area');
  assert.equal(panel.querySelector('.option-picker-title')!.textContent, 'Chart type');
  const close = panel.querySelector<HTMLButtonElement>('[data-picker-close]')!;
  assert.equal(close.getAttribute('aria-label'), 'Close');
  assert.equal(panel.style.left, '', 'a sheet is placed by its stylesheet, not under the trigger');
  assert.equal(h.doc.documentElement.style.overflow, 'hidden');
  assert.equal(label(h.active()), 'Bar');
  close.click();
  assert.equal(h.panel(), null);
  assert.equal(h.doc.documentElement.style.overflow, 'auto', 'scrolling restored as it was');
  assert.equal(h.active(), h.trigger);
  h.trigger.click();
  h.panel()!.querySelector<HTMLElement>('[data-picker-scrim]')!.click();
  assert.equal(h.panel(), null, 'a press on the dimmed area closes');
  h.trigger.click();
  h.key('Escape');
  assert.equal(h.panel(), null, 'and so does Escape');
  assert.deepEqual(h.commits, []);
});

test('columns: four, five or six, whichever leaves the fewest empty cells', () => {
  const cols = (...sizes: number[]): number => pickerColumns(sizes.map((n) => ({ options: Array.from({ length: n }) })));
  assert.equal(cols(10, 6, 9, 5, 5), 5, "Chart's 35 types: five empty cells, where four columns leave thirteen");
  assert.equal(cols(3, 5, 5, 3), 5, 'the statistical forms');
  assert.equal(cols(4, 3, 4, 2), 4, 'the 3-D types');
  assert.equal(cols(5, 4), 5, 'the cinematic forms');
  assert.equal(cols(5), 5, 'five styles sit in one row');
  assert.equal(cols(7), 4);
  assert.equal(cols(6, 6, 6), 6);
  assert.equal(cols(8), 4, 'the fewest columns among equals');
  assert.equal(cols(12), 4);
  assert.equal(cols(3), 4);
  assert.equal(cols(), 4);
});

test('the floating panel carries its column count; a sheet takes its columns from the phone', () => {
  const h = harness();
  h.trigger.click();
  assert.equal(h.panel()!.dataset.cols, '4', 'groups of 1, 2, 2 and 1');
  closeOptionPicker();
  const five = harness({
    input: { id: 'chartType', label: 'Style', value: 'a', options: ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value })) },
    choices: ['a', 'b', 'c', 'd', 'e'].map((value) => ({ value, label: value.toUpperCase() })),
  });
  five.trigger.click();
  assert.equal(five.panel()!.dataset.cols, '5');
  closeOptionPicker();
  const phone = harness({ width: 390 });
  phone.trigger.click();
  assert.equal(phone.panel()!.dataset.cols, undefined);
  closeOptionPicker();
});

test('placement: under the trigger when the whole panel fits, beside it when it does not', () => {
  const viewport = { width: 1440, height: 900 };
  const trigger = { left: 4, right: 268, top: 464, bottom: 502 };
  assert.deepEqual(panelPlace(trigger, { width: 540, height: 88 }, viewport), { left: 4, top: 506, maxHeight: null },
    'left edges aligned, even with the trigger nearer the edge than the margin');
  assert.deepEqual(panelPlace(trigger, { width: 540, height: 744 }, viewport), { left: 276, top: 144, maxHeight: null },
    'beside, moved up until the whole panel is in view');
  assert.deepEqual(panelPlace(trigger, { width: 432, height: 300 }, { width: 1440, height: 760 }), { left: 276, top: 448, maxHeight: null },
    'a short panel beside keeps to the bottom margin');
  assert.deepEqual(panelPlace({ ...trigger, top: 100, bottom: 138 }, { width: 432, height: 780 }, viewport), { left: 276, top: 100, maxHeight: null },
    'top edges aligned when there is room below that line');
  assert.deepEqual(panelPlace(trigger, { width: 540, height: 1200 }, viewport), { left: 276, top: 12, maxHeight: 876 },
    'a panel taller than the viewport fills the height and scrolls');
});

test('placement: the near side when the far side has no room, then over or under', () => {
  const viewport = { width: 1440, height: 900 };
  // A sidebar on the right, as a right-to-left layout has.
  const right = { left: 1172, right: 1436, top: 464, bottom: 502 };
  assert.deepEqual(panelPlace(right, { width: 540, height: 744 }, viewport), { left: 624, top: 144, maxHeight: null });
  assert.deepEqual(panelPlace(right, { width: 540, height: 88 }, viewport), { left: 888, top: 506, maxHeight: null },
    'under the trigger, pulled in from the right edge');
  // A window too narrow for the panel beside the trigger on either side.
  const narrow = { width: 700, height: 900 };
  const trigger = { left: 4, right: 268, top: 464, bottom: 502 };
  assert.deepEqual(panelPlace(trigger, { width: 540, height: 744 }, narrow), { left: 4, top: 12, maxHeight: 448 },
    'over the trigger, the larger side, scrolling');
  assert.deepEqual(panelPlace(trigger, { width: 540, height: 420 }, narrow), { left: 4, top: 40, maxHeight: null },
    'over the trigger whole');
  assert.deepEqual(panelPlace({ ...trigger, top: 100, bottom: 138 }, { width: 540, height: 900 }, narrow), { left: 4, top: 142, maxHeight: 746 },
    'under the trigger when that side is larger');
  for (const place of [
    panelPlace(trigger, { width: 540, height: 5000 }, { width: 300, height: 200 }),
    panelPlace({ left: -400, right: -136, top: -50, bottom: -12 }, { width: 540, height: 744 }, viewport),
  ]) {
    assert.ok(place.left >= 0 && place.top >= 12, 'never off the top or the left of the viewport');
    assert.ok(place.maxHeight === null || place.maxHeight >= 120);
  }
  // A trigger scrolled out above the viewport: the panel stays in view.
  assert.deepEqual(panelPlace({ left: 4, right: 268, top: -156, bottom: -118 }, { width: 432, height: 200 }, { width: 1440, height: 768 }),
    { left: 4, top: 12, maxHeight: null });
  // Too little room over and under the trigger for a list worth opening, and none
  // beside: the panel takes the viewport's height and never runs past its bottom.
  const short = { width: 800, height: 200 };
  const mid = { left: 280, right: 500, top: 70, bottom: 110 };
  assert.deepEqual(panelPlace(mid, { width: 432, height: 176 }, short), { left: 280, top: 12, maxHeight: null });
  assert.deepEqual(panelPlace(mid, { width: 432, height: 400 }, short), { left: 280, top: 12, maxHeight: 176 });
});

test('placement right-to-left: right edges align and the far side is the left', () => {
  const viewport = { width: 1440, height: 900 };
  const right = { left: 1172, right: 1436, top: 464, bottom: 502 };
  assert.deepEqual(panelPlace(right, { width: 540, height: 88 }, viewport, true), { left: 896, top: 506, maxHeight: null });
  assert.deepEqual(panelPlace(right, { width: 540, height: 744 }, viewport, true), { left: 624, top: 144, maxHeight: null });
  // A sidebar that stays on the left: the left has no room, so the panel takes the right.
  const left = { left: 4, right: 268, top: 464, bottom: 502 };
  assert.deepEqual(panelPlace(left, { width: 540, height: 744 }, viewport, true), { left: 276, top: 144, maxHeight: null });
  assert.deepEqual(panelPlace(left, { width: 540, height: 88 }, viewport, true), { left: 12, top: 506, maxHeight: null },
    'pulled in from the left edge');
});

test('right-to-left, the left and right arrows swap', () => {
  const h = harness();
  h.doc.documentElement.dir = 'rtl';
  h.trigger.click();
  assert.equal(label(h.active()), 'Bar');
  h.key('ArrowLeft');
  assert.equal(label(h.active()), 'Lollipop', 'left is forward in reading order');
  h.key('ArrowRight');
  assert.equal(label(h.active()), 'Bar');
  closeOptionPicker();
});

test('a trigger inside an open dialog mounts its panel in that dialog', () => {
  const h = harness();
  const dialog = h.doc.createElement('dialog');
  dialog.setAttribute('open', '');
  h.doc.body.appendChild(dialog);
  dialog.appendChild(h.doc.getElementById('side')!);
  h.trigger.click();
  assert.equal(h.panel()!.parentElement, dialog, 'a node on body would sit under a modal dialog');
  h.key('Escape');
  assert.equal(h.panel(), null);
  assert.equal(h.active(), h.trigger);
});

test('crossing from the desktop layout to the phone layout closes the panel', () => {
  const h = harness();
  h.trigger.click();
  assert.ok(h.panel());
  Object.defineProperty(h.win, 'innerWidth', { value: 390, configurable: true });
  h.win.dispatchEvent(new h.win.Event('resize'));
  assert.equal(h.panel(), null);
  assert.deepEqual(h.commits, []);
});

test('a rebuild that changes the choices closes the panel; one that drops the input does too', async () => {
  const h = harness();
  h.trigger.click();
  const side = h.doc.getElementById('side')!;
  // The same input with one choice gone and another value current.
  const fewer = CHOICES.filter((c) => c.value !== 'pie');
  side.innerHTML = `<span id="irow-label-chartType">Chart type</span>${optionPickerHtml({ ...INPUT, value: 'line' }, fewer)}`;
  const fresh = side.querySelector<HTMLButtonElement>('[data-option-picker]')!;
  wireOptionPicker(fresh, (v) => h.commits.push(v));
  assert.equal(h.panel(), null, 'the panel was showing a set that no longer stands');
  assert.equal(fresh.getAttribute('aria-expanded'), 'false');
  assert.equal(h.active(), fresh, 'focus is on the button on screen');
  fresh.click();
  assert.deepEqual(h.tiles().map(label), ['Loose one', 'Bar', 'Lollipop', 'Line', 'Area'], 'opened again from the new choices');
  assert.equal(label(h.active()), 'Line');
  // The input leaves the sidebar (its showIf turned false): no trigger takes over.
  side.innerHTML = '';
  assert.ok(h.panel(), 'still mounted until the sidebar has finished its rebuild');
  await tick();
  assert.equal(h.panel(), null);
  assert.deepEqual(h.commits, []);
  assert.equal(h.doc.body.children.length, 1, 'only the sidebar is left');
});

test('a rebuild that draws the same trigger again keeps the panel open', async () => {
  const h = harness();
  h.trigger.click();
  const side = h.doc.getElementById('side')!;
  side.innerHTML = `<span id="irow-label-chartType">Chart type</span>${optionPickerHtml(INPUT, CHOICES)}`;
  wireOptionPicker(side.querySelector<HTMLButtonElement>('[data-option-picker]')!, (v) => h.commits.push(v));
  await tick();
  assert.ok(h.panel(), 'the new trigger took the panel over before the observer reported');
  closeOptionPicker();
});

test('teardown and a route change each leave no node on body', () => {
  const h = harness();
  h.trigger.click();
  closeOptionPicker(h.doc.createElement('div'));
  assert.ok(h.panel(), 'another sidebar tearing down leaves this panel alone');
  closeOptionPicker(h.doc.getElementById('side')!);
  assert.equal(h.panel(), null, 'its own sidebar tearing down closes the panel');
  h.trigger.click();
  h.win.dispatchEvent(new h.win.Event('hashchange'));
  assert.equal(h.panel(), null, 'a route change closes the panel');
  assert.equal(h.doc.body.children.length, 1, 'only the sidebar is left');
});

test('a sidebar rebuild while open hands the panel the new trigger', () => {
  const h = harness();
  h.trigger.click();
  const side = h.doc.getElementById('side')!;
  side.innerHTML = `<span id="irow-label-chartType">Chart type</span>${optionPickerHtml(INPUT, CHOICES)}`;
  const fresh = side.querySelector<HTMLButtonElement>('[data-option-picker]')!;
  wireOptionPicker(fresh, (v) => h.commits.push(v));
  assert.ok(h.panel(), 'still open');
  assert.equal(fresh.getAttribute('aria-expanded'), 'true');
  h.key('Escape');
  assert.equal(h.panel(), null);
  assert.equal(h.active(), fresh, 'focus lands on the button on screen');
  assert.equal(fresh.getAttribute('aria-expanded'), 'false');
});

test('drawsAsButtons: picker, segmented and badged selects; never a plain select', () => {
  assert.equal(drawsAsButtons({ control: 'select', display: 'picker' }), true);
  assert.equal(drawsAsButtons({ control: 'select', display: 'segmented' }), true);
  assert.equal(drawsAsButtons({ control: 'select', options: [{ badge: 'vector' }] }), true);
  assert.equal(drawsAsButtons({ control: 'select', display: 'select', options: [{ badge: 'vector' }] }), false);
  assert.equal(drawsAsButtons({ control: 'select', options: [{}] }), false);
  assert.equal(drawsAsButtons({ control: 'text-input', display: 'picker' }), false);
});
