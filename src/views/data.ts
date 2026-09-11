// SPDX-License-Identifier: MPL-2.0
/**
 * #/data - an offline spreadsheet viewer/editor (plan 89).
 *
 * For someone with no internet, no Excel and no LibreOffice who still needs to open,
 * read and lightly edit a spreadsheet. Drop an .xlsx/.csv/.tsv/.json → it renders in
 * the virtualized data-grid (millions of cells stay responsive), with a sheet-tab bar
 * for a multi-sheet workbook and a download-as menu. Everything runs on-device.
 *
 * Honest about its limits (Andy's ask - "knowing what they can and can't change"): it
 * shows VALUES. Formulas appear as their computed result; styles, merged cells, charts
 * and multiple sheets do not survive a save. The banner says so plainly, because
 * pretending otherwise would lose a user's work silently.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { TableValue } from '@lolly/engine';
import { readXlsx, listXlsxSheets } from '@lolly/engine';
import { mountDataGrid, type DataGridHandle } from '../components/data-grid.ts';
import { sourceToGrid, gridToTarget } from '../lib/convert-codecs.ts';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { wireTabs } from '../lib/tabs.ts';
import { attachDeliveryResult, releaseDeliveryFor } from '../lib/download-recovery.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { langFabHtml, attachLangMenu } from '../components/lang-menu.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { mountThemeFab } from '../components/theme-toggle.ts';
import { mountProfileFab } from '../components/profile-menu.ts';
import '../styles/parts/platform.css';
import '../styles/parts/data-view.css';

/** A generous read cap for the viewer - the engine bounds it internally by MAX_CELLS
 *  (2M), so a pathological book can't blow memory; we note truncation when it bites. */
const VIEW_ROW_LIMIT = 200_000;

const DOWNLOAD_TARGETS = [
  { id: 'csv', label: 'CSV (.csv)', ext: 'csv', mime: 'text/csv' },
  { id: 'xlsx', label: 'Excel (.xlsx)', ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { id: 'json', label: 'JSON (.json)', ext: 'json', mime: 'application/json' },
  { id: 'tsv', label: 'TSV (.tsv)', ext: 'tsv', mime: 'text/tab-separated-values' },
];

export async function mountDataView(viewEl: HTMLElement, host: HostV1, _params = ''): Promise<void> {
  document.title = 'Spreadsheet - Lolly';
  viewEl.innerHTML = `
    ${backHomeHtml()}
    <div class="gallery-topright">${langFabHtml()}</div>
    <div class="platform-layout data-view">
      <header class="plat-header">
        <h1 class="plat-title">${t('Spreadsheet')}</h1>
        <p class="plat-sub">${t('Open, read and edit a spreadsheet on your device - no internet, no Excel needed. Nothing is uploaded.')}</p>
      </header>
      <div class="data-drop" data-drop tabindex="0" role="button" aria-label="${t('Drop a spreadsheet to open')}">
        <p>${t('Drop an .xlsx, .csv, .tsv or .json here, or choose one.')}</p>
        <button type="button" class="btn" data-pick>${t('Choose a file…')}</button>
        <input type="file" hidden data-file accept=".xlsx,.csv,.tsv,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
      </div>
      <div class="data-workspace" data-workspace hidden>
        <div data-tabs hidden></div>
        <p class="data-limits" data-limits hidden></p>
        <div id="data-sheet-panel" data-sheet-panel><div class="data-grid-host" data-grid></div></div>
        <div class="data-actions" data-actions hidden>
          <span class="data-actions-label">${t('Download as')}</span>
          ${DOWNLOAD_TARGETS.map((d) => `<button type="button" class="btn" data-dl="${d.id}">${d.label}</button>`).join('')}
        </div>
        <p class="data-status" data-status role="status" aria-live="polite"></p>
      </div>
    </div>`;

  // Reached as a tile OR a deep link - carry the full escape chrome (back pill +
  // always-home) plus the language + theme FABs, so nobody sent straight to the
  // spreadsheet is stranded with no way out.
  mountBackPill(viewEl);
  mountHomeFab(viewEl);
  mountThemeFab(viewEl.querySelector('.gallery-topright'), host);
  mountProfileFab(viewEl.querySelector('.gallery-topright'), host);
  attachLangMenu(viewEl.querySelector<HTMLElement>('.lang-fab'), host);

  const drop = viewEl.querySelector<HTMLElement>('[data-drop]')!;
  const fileInput = viewEl.querySelector<HTMLInputElement>('[data-file]')!;
  const workspace = viewEl.querySelector<HTMLElement>('[data-workspace]')!;
  const tabsEl = viewEl.querySelector<HTMLElement>('[data-tabs]')!;
  const limitsEl = viewEl.querySelector<HTMLElement>('[data-limits]')!;
  const gridHost = viewEl.querySelector<HTMLElement>('[data-grid]')!;
  const actionsEl = viewEl.querySelector<HTMLElement>('[data-actions]')!;
  const panel = viewEl.querySelector<HTMLElement>('[data-sheet-panel]')!;
  const status = viewEl.querySelector<HTMLElement>('[data-status]')!;

  let grid: DataGridHandle | null = null;
  let baseName = 'sheet';
  // Parse worksheets lazily, but retain each edited grid while the book is open.
  let xlsxBytes: Uint8Array | null = null;
  let activeSheet = 0;
  const sheets = new Map<number, { value: TableValue; note?: string }>();
  let generation = 0;
  let active = true;
  let downloading = false;
  let clearRecovery: (() => void) | undefined;
  (viewEl as HTMLElement & { _cleanup?: () => void })._cleanup = () => {
    active = false; generation++;
    clearRecovery?.(); grid?.destroy(); grid = null;
    sheets.clear(); xlsxBytes = null;
  };

  viewEl.querySelector('[data-pick]')?.addEventListener('click', () => fileInput.click());
  drop.addEventListener('click', (e) => { if (e.target === fileInput || (e.target as HTMLElement).closest('button')) return; fileInput.click(); });
  drop.addEventListener('keydown', (e) => {
    if (e.target === drop && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); fileInput.click(); }
  });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault(); drop.classList.remove('is-over');
    const f = e.dataTransfer?.files?.[0]; if (f) void onFile(f);
  });
  fileInput.addEventListener('change', () => { const f = fileInput.files?.[0]; fileInput.value = ''; if (f) void onFile(f); });

  // The honest-limits banner (Andy's ask): stated once the data is showing.
  const LIMITS_HTML = escape(t(
    'Lolly shows the data and lets you edit it - it doesn’t pretend to be Excel. Formulas appear as their current value; styles, merged cells, charts and extra sheets won’t survive a download. Your data will.',
  ));

  function showGrid(value: TableValue, truncatedNote?: string): void {
    grid?.destroy();
    grid = mountDataGrid(gridHost, { value, editable: true, onChange: (edited) => {
      const sheet = sheets.get(activeSheet);
      if (sheet) sheet.value = edited;
    } });
    workspace.hidden = false;
    actionsEl.hidden = false;
    limitsEl.hidden = false;
    limitsEl.innerHTML = `${LIMITS_HTML}${truncatedNote ? ` <b>${escape(truncatedNote)}</b>` : ''}`;
  }

  function renderTabs(names: string[]): void {
    tabsEl.replaceChildren();
    tabsEl.hidden = names.length <= 1;
    panel.removeAttribute('role'); panel.removeAttribute('aria-labelledby');
    if (names.length <= 1) return;
    // A new strip owns new listeners; switching a sheet never rebuilds the strip.
    const strip = document.createElement('div');
    strip.className = 'data-tabs'; strip.setAttribute('role', 'tablist');
    strip.setAttribute('aria-label', t('Worksheets'));
    strip.innerHTML = names.map((n, i) =>
      `<button type="button" class="btn data-tab" id="data-sheet-${i}" role="tab" aria-controls="data-sheet-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sheet="${i}">${escape(n)}</button>`).join('');
    tabsEl.append(strip);
    panel.setAttribute('role', 'tabpanel');
    const select = wireTabs(strip, { key: 'sheet', onSelect: (value) => {
      const sheet = Number(value);
      try {
        if (!sheets.has(sheet) && xlsxBytes) sheets.set(sheet, readSheet(xlsxBytes, sheet));
        const saved = sheets.get(sheet);
        if (!saved) return;
        activeSheet = sheet;
        panel.setAttribute('aria-labelledby', `data-sheet-${sheet}`);
        showGrid(saved.value, saved.note);
      } catch (e) {
        // Restore selection when a later worksheet cannot be read.
        select(String(activeSheet));
        announceError((e as Error).message);
      }
    } });
    select('0');
  }

  function readSheet(bytes: Uint8Array, sheet: number): { value: TableValue; note?: string } {
    const { rows, truncated } = readXlsx(bytes, { sheet, limit: VIEW_ROW_LIMIT });
    return { value: gridFromRows(rows), note: truncated ? t('Showing the first {n} rows.').replace('{n}', String(VIEW_ROW_LIMIT)) : undefined };
  }

  async function onFile(file: File): Promise<void> {
    const current = ++generation;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!active || current !== generation) return;
      const isXlsx = /\.xlsx$/i.test(file.name);
      const names = isXlsx ? listXlsxSheets(bytes).map((s) => s.name) : [];
      const kind = /\.tsv$/i.test(file.name) ? 'tsv' : /\.json$/i.test(file.name) ? 'json' : 'csv';
      const first = isXlsx ? readSheet(bytes, 0) : { value: gridFromRows(sourceToGrid(kind, bytes)), note: undefined };
      // Commit the replacement only after validation; a bad file must not rename
      // or corrupt the workbook already open on screen.
      baseName = file.name.replace(/\.[^.]+$/, '') || 'sheet';
      xlsxBytes = isXlsx ? bytes : null;
      activeSheet = 0; sheets.clear(); sheets.set(0, first);
      clearRecovery?.(); clearRecovery = undefined; status.textContent = '';
      showGrid(first.value, first.note);
      renderTabs(names);
    } catch (e) {
      if (active && current === generation) announceError((e as Error).message);
    }
  }

  // Download the CURRENT grid value (post-edit) in the chosen format.
  actionsEl.querySelectorAll<HTMLButtonElement>('[data-dl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!grid || downloading || !active) return;
      downloading = true;
      const current = generation;
      actionsEl.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
      clearRecovery?.(); clearRecovery = undefined;
      try {
        const target = DOWNLOAD_TARGETS.find((d) => d.id === btn.dataset.dl)!;
        const value = grid.getValue();
        const out = gridToTarget([value.columns, ...value.rows], target.id);
        const blob = new Blob([out as BlobPart], { type: target.mime });
        const name = `${baseName}.${target.ext}`;
        if (!active || current !== generation) return;
        clearRecovery = () => releaseDeliveryFor(status);
        const result = attachDeliveryResult(status, status, { blob, filename: name, label: name }, host, null, {
          ready: t('File ready.'),
          saved: t('File saved.'),
        });
        await result.retry();
      } catch (e) {
        if (active && current === generation) announceError((e as Error).message);
      } finally {
        downloading = false;
        if (active) actionsEl.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
      }
    });
  });

  function announceError(msg: string): void {
    workspace.hidden = false;
    status.textContent = msg || t('That file could not be read.');
  }

  // A native double-click / Open With arrives through the universal router.
  // Consume it only after this view is fully wired so it behaves exactly like a
  // file picked or dropped on the utility itself (including worksheet tabs).
  const { takePendingSpreadsheetFile } = await import('../lib/drop-router.ts');
  const pending = takePendingSpreadsheetFile();
  if (active && pending) await onFile(pending);
}

/** A ragged grid (row 0 = header) → the grid's {columns, rows} value. */
function gridFromRows(rows: string[][]): TableValue {
  const [header = [], ...body] = rows;
  return { columns: header, rows: body };
}
