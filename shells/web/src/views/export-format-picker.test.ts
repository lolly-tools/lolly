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
 * a setFormats narrowing). The panel is a mountBodyPopover panel in the
 * trigger's own row, so the lifecycle tests pin that it mounts there, that
 * focus stays on the trigger and comes back to it, and that the export sheet's
 * own Escape on document never hears the press that closes the panel.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.Node = dom.window.Node;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { formatCategory, formatTriggerHtml, formatPanelInnerHtml, wireFormatPicker, placeFormatPanel } =
  await import('./export-format-picker.ts');

/** The outside-press listener is armed a tick after the open, as in every popover. */
const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });
const openPanel = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-fmt-panel]');

const label = (f: string): string => f.toUpperCase();

// The qr-code shape: authored formats plus the loader's derived companions.
const QR_FORMATS = ['svg', 'emf', 'eps', 'dxf', 'pdf', 'pdf-cmyk', 'png', 'jpeg', 'webp', 'svgz', 'wmf', 'bmp'];

function mount(formats: string[], current: string): { root: HTMLElement; select: HTMLSelectElement } {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="filename-extension">
      <select data-action="format" hidden>${formats.map(f => `<option value="${f}"${f === current ? ' selected' : ''}>${f}</option>`).join('')}</select>
      ${formatTriggerHtml(current, label)}
    </div>`;
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
  const html = formatPanelInnerHtml(QR_FORMATS, 'png', label);
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

test('dropdown: the panel mounts in the trigger\'s row, right after the trigger, and focus stays put', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
  assert.equal(openPanel(), null, 'nothing is mounted until the trigger is pressed');
  trigger.focus();
  trigger.click();
  const panel = openPanel()!;
  assert.ok(panel.classList.contains('fmt-pop'));
  assert.equal(panel.parentElement, trigger.parentElement, 'the row keeps every rule scoped to it');
  assert.equal(panel.previousElementSibling, trigger, 'Tab runs from the trigger into the chips');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.activeElement, trigger, 'opening does not move focus');
  trigger.click();
  assert.equal(openPanel(), null, 'the trigger again closes it');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  api.destroy();
  root.remove();
});

test('dropdown: an outside pointerdown closes it', async () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
  trigger.click();
  assert.ok(openPanel());
  await tick();
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  assert.equal(openPanel(), null);
  api.destroy();
  root.remove();
});

test('dropdown: Escape closes the panel only, and focus goes back to the trigger', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  // The export sheet's own Escape listener, registered before the panel opens.
  let sheetClosed = 0;
  const sheet = (e: KeyboardEvent): void => { if (e.key === 'Escape') sheetClosed++; };
  document.addEventListener('keydown', sheet);
  try {
    const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
    trigger.click();
    const chip = openPanel()!.querySelector<HTMLButtonElement>('[data-fmt="svg"]')!;
    chip.focus();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(openPanel(), null);
    assert.equal(sheetClosed, 0, 'the sheet stays open for this press');
    assert.equal(document.activeElement, trigger);
  } finally {
    document.removeEventListener('keydown', sheet);
    api.destroy();
    root.remove();
  }
});

test('wiring: a chip click writes the select, fires change, closes the panel', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label);
  assert.ok(api);
  let changes = 0;
  select.addEventListener('change', () => { changes++; });
  const trigger = root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!;
  trigger.click();
  assert.ok(openPanel());
  root.querySelector<HTMLButtonElement>('[data-fmt="pdf"]')!.click();
  assert.equal(select.value, 'pdf');
  assert.equal(changes, 1);
  assert.equal(openPanel(), null);
  assert.equal(document.activeElement, trigger, 'focus goes back to the trigger');
  assert.equal(trigger.querySelector('[data-fmt-trigger-label]')!.textContent, 'PDF');
  api!.destroy();
  root.remove();
});

test('wiring: a programmatic select change (matchExportFormat path) re-syncs chips and trigger', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!.click();
  select.value = 'svg';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  assert.equal(root.querySelector('[data-fmt="svg"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelector('[data-fmt="png"]')!.getAttribute('aria-pressed'), 'false');
  assert.equal(root.querySelector('[data-fmt-trigger-label]')!.textContent, 'SVG');
  api.destroy();
  root.remove();
});

test('refresh: a setFormats narrowing rebuilds the panel and keeps the current pick pressed', () => {
  const { root, select } = mount(QR_FORMATS, 'png');
  const api = wireFormatPicker(root, select, label)!;
  select.innerHTML = '<option value="png" selected>png</option><option value="jpeg">jpeg</option>';
  select.value = 'png';
  api.refresh(['png', 'jpeg'], 'png');
  root.querySelector<HTMLButtonElement>('[data-fmt-trigger]')!.click();
  const cats = [...root.querySelectorAll<HTMLElement>('.fmt-cat')].map(c => c.dataset.cat);
  assert.deepEqual(cats, ['image']);
  assert.equal(root.querySelector('[data-fmt="png"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelectorAll('.fmt-chip').length, 2);
  // A narrowing while the panel is open repaints it in place.
  api.refresh(['png'], 'png');
  assert.equal(root.querySelectorAll('.fmt-chip').length, 1);
  api.destroy();
  root.remove();
});

test('placement: under the row with the row\'s end edge, flipped above when the drop would leave the viewport', () => {
  const row = document.createElement('div');
  const el = document.createElement('div');
  document.body.append(row, el);
  const rect = (r: { left: number; top: number; width: number; height: number }) => () =>
    ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) }) as DOMRect;
  Object.defineProperty(window, 'innerWidth', { value: 1440, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
  Object.defineProperty(el, 'offsetWidth', { value: 332, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: 366, configurable: true });
  // The export sheet's row in the right column, 4px from the viewport's edge.
  row.getBoundingClientRect = rect({ left: 1104, top: 133, width: 332, height: 40 });
  el.getBoundingClientRect = () => {
    const left = Number.parseFloat(el.style.getPropertyValue('--fmt-left'));
    const top = Number.parseFloat(el.style.getPropertyValue('--fmt-top'));
    return rect({ left, top, width: 332, height: 366 })();
  };
  placeFormatPanel(el, row);
  assert.equal(el.style.getPropertyValue('--fmt-row-w'), '332px');
  assert.equal(el.style.getPropertyValue('--fmt-left'), '1104px', 'end edges aligned, not pulled in by the margin');
  assert.equal(el.style.getPropertyValue('--fmt-top'), '179px', 'the stylesheet\'s 100% + 6px');
  row.getBoundingClientRect = rect({ left: 1104, top: 700, width: 332, height: 40 });
  placeFormatPanel(el, row);
  assert.equal(el.style.getPropertyValue('--fmt-top'), `${700 - 6 - 366}px`, 'flipped above the row');
  // A transformed sheet offsets fixed children: the drawn box is moved by the difference.
  row.getBoundingClientRect = rect({ left: 1104, top: 133, width: 332, height: 40 });
  el.getBoundingClientRect = () => {
    const left = Number.parseFloat(el.style.getPropertyValue('--fmt-left')) + 1100;
    const top = Number.parseFloat(el.style.getPropertyValue('--fmt-top')) + 60;
    return rect({ left, top, width: 332, height: 366 })();
  };
  placeFormatPanel(el, row);
  assert.equal(el.style.getPropertyValue('--fmt-left'), '4px');
  assert.equal(el.style.getPropertyValue('--fmt-top'), '119px');
  row.remove();
  el.remove();
});
