// SPDX-License-Identifier: MPL-2.0
/**
 * Reading choices for one spreadsheet, CSV, TSV or JSON source in the convert
 * workbench: the worksheet (or every worksheet into a ZIP with a manifest),
 * formula text or saved results, the column delimiter, the text encoding and
 * how the first row is treated. The values are the engine's data options, so
 * the request saved with the operation replays exactly and the report's
 * findings describe the copy that was made.
 */
import { listXlsxSheets, type DataDelimiter, type DataHeaderMode, type DataTextEncoding } from '@lolly/engine';
import { t } from '../i18n.ts';

/** Source kinds that take these choices. */
export const DATA_SOURCE_KINDS: readonly string[] = ['xlsx', 'csv', 'tsv', 'json'];

/** The live choices, as a file operation's options record. */
export interface DataOptionsHandle {
  read(): Record<string, string | number | boolean>;
  /** True when the output is a ZIP of every worksheet. */
  zip(): boolean;
}

const encodingLabels = (): Record<DataTextEncoding, string> => ({
  auto: t('Automatic'),
  'utf-8': t('UTF-8'),
  'utf-16le': t('UTF-16 (little-endian)'),
  'utf-16be': t('UTF-16 (big-endian)'),
  'windows-1250': t('Central European (Windows-1250)'),
  'windows-1251': t('Cyrillic (Windows-1251)'),
  'windows-1252': t('Western European (Windows-1252)'),
  'windows-1253': t('Greek (Windows-1253)'),
  'windows-1254': t('Turkish (Windows-1254)'),
  'windows-1256': t('Arabic (Windows-1256)'),
  shift_jis: t('Japanese (Shift_JIS)'),
  'euc-kr': t('Korean (EUC-KR)'),
  gb18030: t('Chinese, simplified (GB18030)'),
  big5: t('Chinese, traditional (Big5)'),
});

const delimiterLabels = (): Record<DataDelimiter, string> => ({
  auto: t('Automatic'),
  comma: t('Commas'),
  semicolon: t('Semicolons'),
  tab: t('Tabs'),
  pipe: t('Vertical bars (|)'),
});

const headerLabels = (): Record<DataHeaderMode, string> => ({
  'first-row': t('Column headings'),
  none: t('Data, with no headings'),
  generate: t('Data, under added headings (Column 1, Column 2)'),
});

const options = (labels: Record<string, string>): string =>
  Object.entries(labels).map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

/** The choices markup for one data source: static labels and engine values only. */
export function dataOptionsHtml(kind: string): string {
  const xlsx = kind === 'xlsx';
  return `<details class="convert-advanced" open data-data-options><summary>${t('How to read this file')}</summary>
    <div class="convert-options">
      ${xlsx ? `<label class="convert-field">${t('Worksheet')}<select data-sheet><option value="0">${t('First worksheet')}</option></select><small>${t('All worksheets makes one file per sheet in a ZIP, with manifest.json listing each one.')}</small></label>
      <label class="convert-field">${t('Formulas')}<select data-cells><option value="cached">${t('Saved results')}</option><option value="formulas">${t('Formula text')}</option></select><small>${t('Saved results are the values the workbook last calculated. Formula text keeps each formula, starting with =.')}</small></label>` : ''}
      ${kind === 'csv' || kind === 'tsv' ? `<label class="convert-field">${t('Columns separated by')}<select data-delimiter>${options(delimiterLabels())}</select></label>` : ''}
      ${xlsx ? '' : `<label class="convert-field">${t('Text encoding')}<select data-encoding>${options(encodingLabels())}</select><small>${t('Automatic reads UTF-8 and reads anything else as Windows-1252. Choose the encoding if characters look wrong.')}</small></label>`}
      <label class="convert-field">${t('First row')}<select data-header>${options(headerLabels())}</select></label>
    </div>
  </details>`;
}

/**
 * Wire the choices rendered by {@link dataOptionsHtml}. A workbook's sheet names
 * are read from the whole file in the background; until then, and when the
 * workbook does not list them, the first worksheet is the only choice.
 */
export function wireDataOptions(root: HTMLElement, source: { file: File; kind: string }, onChange: () => void): DataOptionsHandle {
  const pick = (name: string): HTMLSelectElement | null => root.querySelector<HTMLSelectElement>(`[data-data-options] [data-${name}]`);
  const sheet = pick('sheet'), cells = pick('cells'), delimiter = pick('delimiter'), encoding = pick('encoding'), header = pick('header');
  for (const select of [sheet, cells, delimiter, encoding, header]) select?.addEventListener('change', onChange);
  if (sheet && source.kind === 'xlsx') {
    void source.file.arrayBuffer().then(buffer => listXlsxSheets(new Uint8Array(buffer))).then(sheets => {
      if (!sheets.length) return;
      const choices = sheets.map(s => new Option(s.name, String(s.index)));
      if (sheets.length > 1) choices.push(new Option(t('All worksheets'), 'all'));
      sheet.replaceChildren(...choices);
      sheet.value = '0';
      onChange();
    }).catch(() => { /* Unlisted sheets: the first worksheet stays the only choice and the conversion reports any read error. */ });
  }
  return {
    read() {
      const out: Record<string, string | number | boolean> = {};
      if (sheet) {
        if (sheet.value === 'all') out.allSheets = true;
        else if (Number(sheet.value) > 0) out.sheet = Number(sheet.value);
      }
      if (cells) out.cells = cells.value;
      if (delimiter) out.delimiter = delimiter.value;
      if (encoding) out.encoding = encoding.value;
      if (header) out.header = header.value;
      return out;
    },
    zip: () => sheet?.value === 'all',
  };
}
