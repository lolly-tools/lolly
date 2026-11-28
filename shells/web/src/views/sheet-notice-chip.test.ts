// SPDX-License-Identifier: MPL-2.0
/**
 * The phone sheet's notice chip (views/sheet-notice-chip.ts): it counts the warnings
 * and errors the sheet is not showing, ignores notes that only inform, and a tap
 * opens the section, raises a sheet at its small stop, scrolls and focuses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><body><div class="tool-layout" id="layout"><aside class="sidebar" id="sidebar">
  <div class="sidebar-body"><div id="panel">
    <label class="input-row" id="r1"><select data-input-id="a"></select></label>
    <label class="input-row" id="r2"><select data-input-id="b"></select></label>
    <details class="input-section"><summary class="input-section-summary">More</summary><div class="input-section-body">
      <label class="input-row" id="r3"><select data-input-id="c"></select></label>
    </div></details>
  </div></div></aside></div></body>`);
const g = globalThis as Record<string, unknown>;
g.document = dom.window.document;
g.window = dom.window;
g.requestAnimationFrame = (fn: () => void) => { fn(); return 1; };
const { applyInputNotices } = await import('./input-notices.ts');
const { mountSheetNoticeChip } = await import('./sheet-notice-chip.ts');

const doc = dom.window.document;
const $ = (id: string) => doc.getElementById(id) as unknown as HTMLElement;
const body = doc.querySelector('.sidebar-body') as unknown as HTMLElement;

// A sheet 300px tall whose list shows 100..300; rows are 80px apart from y=120, less the scroll.
let scrolled = 0;
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, width: height ? 300 : 0, left: 0, right: 300, x: 0, y: top, toJSON() {} });
$('sidebar').getBoundingClientRect = () => rect(0, 300) as DOMRect;
body.getBoundingClientRect = () => rect(100, 200) as DOMRect;
body.scrollTo = ((o: { top: number }) => { scrolled = o.top; body.scrollTop = o.top; }) as never;
// Rows answer with where they are now, so a fold or a scroll made mid-tap is seen at once.
const place = (): void => {
  for (const [i, id] of ['r1', 'r2', 'r3'].entries()) {
    const row = $(id);
    const folded = (): boolean => { const d = row.closest('details') as HTMLDetailsElement | null; return !!d && !d.open; };
    const top = (): number => 120 + i * 160 - body.scrollTop;
    row.getBoundingClientRect = () => (folded() ? rect(0, 0) : rect(top(), 60)) as DOMRect;
    const note = row.querySelector<HTMLElement>('.input-notice--hook');
    if (note) note.getBoundingClientRect = () => (folded() ? rect(0, 0) : rect(top() + 40, 20)) as DOMRect;
  }
};

let state: 'peek' | 'half' | 'full' = 'half';
let phone = true;
const chip = mountSheetNoticeChip({
  layout: $('layout'), sidebar: $('sidebar'), isPhone: () => phone,
  sheet: { state: () => state, setState: (s) => { state = s; } },
});
const show = (notices: Parameters<typeof applyInputNotices>[1]): void => { applyInputNotices($('panel'), notices); place(); chip.update(); };

test('no chip while every loud notice is on show, and none for a note that only informs', () => {
  assert.equal(chip.el.hidden, true);
  show({ a: { tone: 'warning', text: 'Seen.' } });
  assert.equal(chip.el.hidden, true, 'the first row is inside the list');
  show({ a: { tone: 'warning', text: 'Seen.' }, c: { tone: 'info', text: 'Folded, and only a note.' } });
  assert.equal(chip.el.hidden, true);
});

test('a warning scrolled out or folded away raises one chip with the count and the strongest tone', () => {
  show({ b: { tone: 'warning', text: 'Below the edge.' } });
  assert.equal(chip.el.hidden, false);
  assert.equal(chip.el.textContent, '1 notice');
  assert.equal(chip.el.tagName, 'BUTTON');
  assert.ok(chip.el.classList.contains('chip'), 'the shared chip');
  assert.equal(chip.el.hasAttribute('aria-live'), false);
  const dot = chip.el.querySelector('.input-section-mark') as HTMLElement;
  assert.equal(dot.dataset.tone, 'warning');
  show({ b: { tone: 'warning', text: 'Below the edge.' }, c: { tone: 'error', text: 'Folded away.' } });
  assert.equal(chip.el.textContent, '2 notices');
  assert.equal(dot.dataset.tone, 'error');
  assert.equal($('layout').querySelectorAll('.sheet-notice-chip').length, 1);
});

test('a wider layout never shows the chip', () => {
  phone = false; chip.update();
  assert.equal(chip.el.hidden, true);
  phone = true; chip.update();
  assert.equal(chip.el.hidden, false);
});

test('a tap scrolls the list to the first hidden notice and focuses its control', () => {
  chip.el.click();
  assert.ok(scrolled > 0, 'the list scrolled, not the page');
  assert.equal(doc.activeElement, $('r2').querySelector('select'));
  place(); chip.update();
  assert.equal(chip.el.textContent, '1 notice', 'the folded one is still out of sight');
});

test('the next tap opens the folded section; at the small stop the sheet is raised first', async () => {
  state = 'peek';
  chip.el.click();
  assert.equal((doc.querySelector('details') as HTMLDetailsElement).open, true);
  assert.equal(state, 'half');
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(doc.activeElement, $('r3').querySelector('select'));
  chip.update();
  const c = $('r3').querySelector('.input-notice--hook')!.getBoundingClientRect();
  assert.ok(c.top >= 100 && c.bottom <= 300, 'the folded notice is now inside the list');
  // Two rows do not fit this short list at once, so the one scrolled past is the hidden one now.
  assert.equal(chip.el.textContent, '1 notice');
});

test('fixed: the chip goes with the last hidden notice', () => {
  body.scrollTop = 0;
  show({ b: { tone: 'warning', text: 'Below the edge.' } });
  assert.equal(chip.el.hidden, false);
  show({});
  assert.equal(chip.el.hidden, true);
});
