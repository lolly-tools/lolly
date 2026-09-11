// SPDX-License-Identifier: MPL-2.0
/**
 * views/export-format-picker.ts - the grouped export-format picker.
 *
 * Run directly:  node --test shells/web/src/views/export-format-picker.test.ts
 *
 * Pins the three contracts the export sheet relies on: the plain-word category
 * map (no vector/bitmap at the top level, unknowns read as Other), the panel
 * markup (only non-empty categories render; the chosen format's drawer is the
 * open one), and the mirror wiring (chips write the hidden select and fire
 * 'change'; a programmatic select change re-syncs the chips; refresh survives
 * a setFormats narrowing).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;

const { formatCategory, formatTriggerHtml, formatPanelHtml, formatPanelInnerHtml, wireFormatPicker } =
  await import('./export-format-picker.ts');

const label = (f: string): string => f.toUpperCase();

// The qr-code shape: authored formats plus the loader's derived companions.
const QR_FORMATS = ['svg', 'emf', 'eps', 'dxf', 'pdf', 'pdf-cmyk', 'png', 'jpeg', 'webp', 'svgz', 'wmf', 'bmp'];

function mount(formats: string[], current: string): { root: HTMLElement; select: HTMLSelectElement } {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="filename-extension">
      <select data-action="format" hidden>${formats.map(f => `<option value="${f}"${f === current ? ' selected' : ''}>${f}</option>`).join('')}</select>
      ${formatTriggerHtml(current, label)}
    </div>
    ${formatPanelHtml(formats, current, label)}`;
  document.body.appendChild(root);
  return { root, select: root.querySelector('select')! };
}

test('category map: plain words on top, unknowns read as Other', () => {
  assert.equal(formatCategory('png'), 'image');
  assert.equal(formatCategory('svg'), 'image');          // no vector/bitmap split up top
  assert.equal(formatCategory('pdf-cmyk'), 'document');  // print output reads as document
  assert.equal(formatCategory('gif'), 'motion');
  assert.equal(formatCategory('wav'), 'audio');
  assert.equal(formatCategory('dxf'), 'other');
  assert.equal(formatCategory('never-heard-of-it'), 'other');
});

test('dropdown: only non-empty categories render, every section visible, chips carry glyphs', () => {
  const html = formatPanelHtml(QR_FORMATS, 'png', label);
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const cats = [...holder.querySelectorAll<HTMLElement>('.fmt-cat')].map(c => c.dataset.cat);
  assert.deepEqual(cats, ['image', 'document', 'other']);   // no motion, no audio for qr-code
  // No accordion: headers are plain (not buttons), every body always shows.
  for (const cat of holder.querySelectorAll<HTMLElement>('.fmt-cat')) {
    assert.equal(cat.querySelector('.fmt-cat-head')!.tagName, 'DIV');
    assert.equal(cat.querySelector<HTMLElement>('.fmt-cat-body')!.hidden, false);
  }
  assert.equal(holder.querySelector('[data-fmt="png"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(holder.querySelector('[data-fmt="svg"]')!.getAttribute('aria-pressed'), 'false');
  // Every chip carries a metaphor glyph; a few carry format-specific ones.
  for (const chip of holder.querySelectorAll('.fmt-chip')) {
    assert.ok(chip.querySelector('svg.fmt-chip-ic'), `glyph on ${(chip as HTMLElement).dataset.fmt}`);
  }
  assert.notEqual(
    holder.querySelector('[data-fmt="dxf"] svg')!.innerHTML,     // scissors (cut file)
    holder.querySelector('[data-fmt="png"] svg')!.innerHTML,     // category image glyph
  );
});

test('recommended view leads with the outcome formats and can disclose the complete set', () => {
  const holder = document.createElement('div');
  holder.innerHTML = formatPanelInnerHtml(['png', 'pdf', 'svg'], 'png', label, ['png', 'pdf']);
  assert.equal(holder.querySelector('.fmt-cat-head')?.textContent, 'Recommended');
  assert.deepEqual(
    [...holder.querySelectorAll<HTMLElement>('.fmt-chip')].map(chip => chip.dataset.fmt),
    ['png', 'pdf'],
  );
  assert.equal(holder.querySelector('[data-fmt-show-all]')?.textContent, 'All formats (3)');

  holder.innerHTML = formatPanelInnerHtml(['png', 'pdf', 'svg'], 'png', label, ['png', 'pdf'], true);
  assert.ok(holder.querySelector('[data-fmt="svg"]'), 'the expanded view restores non-recommended formats');
  assert.equal(holder.querySelector('[data-fmt-show-all]'), null);
});

test('dropdown: an outside pointerdown closes it', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  wireFormatPicker(root, select, label);
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
  const panel = root.querySelector<HTMLElement>('[data-fmt-panel]')!;
  trigger.click();
  assert.equal(panel.hidden, false);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  assert.equal(panel.hidden, true);
  root.remove();
});

test('wiring: a chip click writes the select, fires change, closes the panel', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label);
  assert.ok(api);
  let changes = 0;
  select.addEventListener('change', () => { changes++; });
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
  const panel = root.querySelector<HTMLElement>('[data-fmt-panel]')!;
  trigger.click();
  assert.equal(panel.hidden, false);
  root.querySelector<HTMLButtonElement>('[data-fmt="pdf"]')!.click();
  assert.equal(select.value, 'pdf');
  assert.equal(changes, 1);
  assert.equal(panel.hidden, true);
  assert.equal(trigger.querySelector('[data-fmt-trigger-label]')!.textContent, 'PDF');
  root.remove();
});

test('wiring: a programmatic select change (matchExportFormat path) re-syncs chips and trigger', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  wireFormatPicker(root, select, label);
  select.value = 'svg';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(root.querySelector('[data-fmt="svg"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelector('[data-fmt="png"]')!.getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelector('[data-fmt-trigger-label]')!.textContent, 'SVG');
  root.remove();
});

test('refresh: a setFormats narrowing rebuilds the panel and keeps the current pick pressed', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  select.innerHTML = '<option value="png" selected>png</option><option value="jpeg">jpeg</option>';
  select.value = 'png';
  api.refresh(['png', 'jpeg'], 'png');
  const cats = [...root.querySelectorAll<HTMLElement>('.fmt-cat')].map(c => c.dataset.cat);
  assert.deepEqual(cats, ['image']);
  assert.equal(root.querySelector('[data-fmt="png"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelectorAll('.fmt-chip').length, 2);
  root.remove();
});
