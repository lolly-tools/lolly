// SPDX-License-Identifier: MPL-2.0
/**
 * The sidebar pass that draws input notices (views/input-notices.ts): the line under
 * the row, the description link, the dot on a section head, and that the pass can
 * run again and again without leaving anything behind.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM(`<!doctype html><body><div id="panel">
  <label class="input-row"><span class="input-label"><span class="input-label-text">Module colour</span></span>
    <div class="color-picker-field"><button type="button" class="color-trigger"></button><input class="color-input" data-input-id="color"></div></label>
  <details class="input-section"><summary class="input-section-summary">Modules</summary><div class="input-section-body">
    <label class="input-row"><span class="input-label"><span class="input-label-text">Quiet zone <span class="input-value">1</span></span></span>
      <div class="custom-slider" data-input-id="padding" role="slider" aria-describedby="helptip-1"></div></label>
    <label class="input-row"><span class="input-label"><span class="input-label-text">Shape</span></span><select data-input-id="shape"></select></label>
  </div></details>
</div></body>`);
const g = globalThis as Record<string, unknown>;
g.document = dom.window.document;
g.window = dom.window;
g.requestAnimationFrame = (fn: () => void) => { fn(); return 0; };
const { applyInputNotices } = await import('./input-notices.ts');

const doc = dom.window.document;
const panel = doc.getElementById('panel') as unknown as HTMLElement;
const said = (): string => [...doc.querySelectorAll('[aria-live]')].map((e) => e.textContent).join('|');

test('a notice is one line of text under its row, described on the control that takes focus', () => {
  applyInputNotices(panel, {
    color: { tone: 'warning', text: 'Low <b>contrast</b>.' },
    padding: { tone: 'error', text: 'Too small.' },
    ghost: { tone: 'info', text: 'No row for this one.' },
  });
  const notes = [...panel.querySelectorAll('.input-notice--hook')];
  assert.equal(notes.length, 2, 'an input with no row shows nothing');
  const colour = doc.getElementById('inotice-hook-color')!;
  assert.equal(colour.textContent, 'Low <b>contrast</b>.');
  assert.equal(colour.querySelector('b'), null, 'text, never markup');
  assert.equal(colour.dataset.tone, 'warning');
  assert.equal(colour.getAttribute('aria-hidden'), 'true');
  assert.ok(colour.classList.contains('input-notice'), 'the row fine print, not a second look');
  assert.equal(colour.parentElement!.lastElementChild, colour, 'after the control');
  assert.equal(panel.querySelector('.color-trigger')!.getAttribute('aria-describedby'), 'inotice-hook-color');
  assert.equal(panel.querySelector('[role="slider"]')!.getAttribute('aria-describedby'), 'helptip-1 inotice-hook-padding', 'the help tip keeps its place');
  assert.equal(said(), '', 'what a panel opens with is not announced');
});

test('a section that holds a notice wears one dot, in the strongest tone inside, and stays folded', () => {
  const section = panel.querySelector('details')!;
  const mark = section.querySelector('.input-section-mark') as HTMLElement;
  assert.equal(mark.dataset.tone, 'error');
  assert.equal(mark.getAttribute('aria-label'), '1 notice');
  assert.equal(section.open, false);
  applyInputNotices(panel, { padding: { tone: 'error', text: 'Too small.' }, shape: { tone: 'info', text: 'Fine.' } });
  assert.equal(section.querySelectorAll('.input-section-mark').length, 1);
  assert.equal(mark.getAttribute('aria-label'), '2 notices');
  assert.equal(mark.dataset.tone, 'error');
});

test('a second pass changes only what changed, announces it once and clears what went away', () => {
  applyInputNotices(panel, { padding: { tone: 'warning', text: 'Still small.' } });
  assert.equal(panel.querySelectorAll('.input-notice--hook').length, 1);
  assert.equal(doc.getElementById('inotice-hook-padding')!.textContent, 'Still small.');
  assert.equal(panel.querySelector('.color-trigger')!.hasAttribute('aria-describedby'), false);
  assert.match(said(), /Quiet zone: Still small\./, 'the label without its value readout, then the text');

  const region = [...doc.querySelectorAll('[aria-live]')].find((e) => e.textContent)!;
  region.textContent = '';
  applyInputNotices(panel, { padding: { tone: 'warning', text: 'Still small.' } });
  assert.equal(said(), '', 'the same set again says nothing');

  applyInputNotices(panel, {});
  assert.equal(panel.querySelectorAll('.input-notice--hook, .input-section-mark').length, 0);
  assert.equal(panel.querySelector('[role="slider"]')!.getAttribute('aria-describedby'), 'helptip-1');
  assert.equal(said(), '', 'a notice that went away is not announced');
  applyInputNotices(panel, undefined);
});
