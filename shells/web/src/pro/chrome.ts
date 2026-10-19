// SPDX-License-Identifier: MPL-2.0
import { backPillHtml } from '../components/back-pill.ts';
import { langFabHtml } from '../components/lang-menu.ts';
import { icon } from '../lib/icons.ts';
import { escapeHtml as esc } from '../lib/util/escape.ts';
import { t } from '../i18n.ts';
import { formatPanelHtml, formatTriggerHtml } from '../components/export-format-picker.ts';
import { fmtLabel } from '../lib/export-format-info.ts';

export function batchChrome(state: { format: string; unit: string; dpi: number }, formats: string[], units: string[]): string {
  const options = (values: string[], current: string) => values.map(value => `<option value="${esc(value)}"${value === current ? ' selected' : ''}>${esc(value === 'pdf-cmyk' ? 'Print PDF' : value.toUpperCase())}</option>`).join('');
  return `<div class="pro-wrap">
    <header class="pro-header">
      ${backPillHtml({ class: 'btn btn--labelled pro-back', iconOnly: true })}
      <div class="pro-heading"><h1>${t('Batch')}</h1><p>${t('Create many assets from a table of inputs.')}</p></div>
      <button type="button" class="btn btn--labelled" id="pro-sessions">${icon('folder')} ${t('Sessions')}</button>
      ${langFabHtml()}
    </header>
    <div class="pro-toolbar" aria-label="${t('Export settings')}">
      <button type="button" class="btn btn--labelled pro-hamburger" id="pro-menu" aria-expanded="false" aria-controls="pro-toolbar-group">${icon('menu')} ${t('Export settings')}</button>
      <div class="pro-toolbar-group" id="pro-toolbar-group">
        <label class="pro-format pro-zip" title="${t('Name for the downloaded .zip')}">
          <span>${t('File name')}</span>
          <input type="text" id="pro-zip-name" class="field-input field-input--sm" placeholder="lolly-batch" autocomplete="off" spellcheck="false" aria-label="${t('Name for the downloaded .zip')}">
          <span class="pro-zip-ext" aria-hidden="true">.zip</span>
        </label>
        <div class="pro-format pro-format-picker" id="pro-format-field"><span>${t('Default format')}</span>
          <select id="pro-format" hidden aria-hidden="true" tabindex="-1">${options(formats, state.format)}</select>
          ${formatTriggerHtml(state.format, fmtLabel)}
          ${formatPanelHtml(formats, state.format, fmtLabel)}
        </div>
        <label class="pro-format" id="pro-unit-field">${t('Unit')}
          <select id="pro-unit" class="field-select field-select--auto field-select--sm" aria-label="${t('Units for the Width & Height columns')}">${units.map(u => `<option value="${u}"${u === state.unit ? ' selected' : ''}>${u}</option>`).join('')}</select>
        </label>
        <label class="pro-format pro-dpi-field" id="pro-dpi-field">DPI
          <input type="number" id="pro-dpi" class="field-input field-input--auto field-input--sm" aria-label="${t('Raster resolution in DPI')}" min="36" max="1200" step="1" value="${state.dpi}"${state.unit === 'px' ? ' disabled' : ''}>
        </label>
        <button type="button" class="btn btn--labelled btn--sm" id="pro-print" hidden aria-expanded="false">${icon('crop')} ${t('Print settings')}</button>
      </div>
      <button type="button" class="btn btn--primary btn--labelled" id="pro-render">${t('Render all')}</button>
    </div>
    <div class="pro-table-tools" aria-label="${t('Batch actions')}">
      <button type="button" class="btn btn--labelled" data-toolbar-add>${icon('plus')} ${t('Add row')}</button>
      <button type="button" class="btn btn--labelled" data-import-csv>${icon('upload')} ${t('Import CSV')}</button>
      <button type="button" class="btn btn--labelled" data-export-csv>${t('Export CSV')}</button>
      <button type="button" class="btn btn--labelled" id="pro-tosheet">${t('Print sheet')}</button>
      <span class="pro-tools-spacer"></span>
      <button type="button" class="btn btn--ghost" id="pro-common-inputs">${t('Shared inputs')}</button>
      <button type="button" class="btn btn--ghost" id="pro-event-kit">${t('Event kit')}</button>
      <div class="pro-zoom" data-pro-zoom></div>
      <input type="file" id="pro-csv-file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values" hidden>
    </div>
    <div class="pro-selection-bar" data-row-actions aria-label="${t('Row selection')}">
      <span data-selection-count role="status" aria-live="polite"></span>
      <span data-selection-hint class="pro-selection-hint">${t('Use checkboxes for rows. Drag cells to copy a range.')}</span>
      <div data-cell-actions hidden><span data-cell-count role="status"></span><button type="button" class="btn btn--sm btn--labelled" data-copy-cells>${icon('clipboard')} ${t('Copy cells')}</button><button type="button" class="btn btn--sm btn--ghost" data-clear-cells>${t('Clear cell selection')}</button><span class="pro-cell-hint">${t('Drag or Shift-click cells. Double-click to edit.')}</span></div>
      <div data-selected-actions hidden>
        <select class="field-select field-select--auto field-select--sm" data-edit-selected aria-label="${t('Edit input in selected rows')}"></select>
        <button type="button" class="btn btn--sm btn--labelled" data-duplicate-rows>${icon('duplicate')} ${t('Duplicate')}</button>
        <button type="button" class="btn btn--sm btn--danger btn--labelled" data-remove-rows>${icon('trash')} ${t('Remove')}</button>
        <button type="button" class="btn btn--sm btn--ghost" data-clear-selection>${t('Clear selection')}</button>
      </div>
      <button type="button" class="btn btn--sm btn--ghost" data-select-every-row hidden></button>
      <button type="button" class="btn btn--sm" data-undo-remove hidden></button>
    </div>
    <section id="pro-kit-host" aria-label="${t('Event kit')}" hidden></section>
    <div id="pro-grid-host"></div>
    <details class="pro-results" open><summary>${t('Batch activity')}</summary><div class="pro-progress" id="pro-progress" hidden></div></details>
  </div>`;
}
