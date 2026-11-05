// SPDX-License-Identifier: MPL-2.0
/**
 * Small .xlsx builder for tests that need cached formula results. Each cell says what
 * a spreadsheet program would have saved: a constant, or a formula with the value it
 * last computed. Not collected by the test glob.
 */
import { strToU8, zipSync } from 'fflate';

export type BuiltValue = number | string | boolean | { e: string } | null;
export interface BuiltCell {
  /** A1 reference. */
  at: string;
  /** The constant, or the saved result of the formula. `undefined` writes a formula with no saved result. */
  v?: BuiltValue;
  /** Formula text without `=`. */
  f?: string;
  /** Raw attributes for the `<f>` tag, such as `t="shared" si="0"`. */
  fAttrs?: string;
}
export interface BuiltSheet { name: string; cells: BuiltCell[] }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cellXml(c: BuiltCell): string {
  const ref = c.at;
  let t = '';
  let inner = '';
  const v = c.v;
  if (typeof v === 'number') inner = `<v>${v}</v>`;
  else if (typeof v === 'boolean') { t = ' t="b"'; inner = `<v>${v ? 1 : 0}</v>`; }
  else if (typeof v === 'string') { t = c.f !== undefined ? ' t="str"' : ' t="inlineStr"'; inner = c.f !== undefined ? `<v>${esc(v)}</v>` : `<is><t>${esc(v)}</t></is>`; }
  else if (v && typeof v === 'object') { t = ' t="e"'; inner = `<v>${esc(v.e)}</v>`; }
  const f = c.f !== undefined ? `<f${c.fAttrs ? ' ' + c.fAttrs : ''}>${esc(c.f)}</f>` : c.fAttrs ? `<f ${c.fAttrs}/>` : '';
  return `<c r="${ref}"${t}>${f}${inner}</c>`;
}

function sheetXml(cells: BuiltCell[]): string {
  const rows = new Map<number, BuiltCell[]>();
  for (const c of cells) {
    const row = Number(/\d+/.exec(c.at)![0]);
    rows.set(row, [...(rows.get(row) ?? []), c]);
  }
  const body = [...rows].sort((a, b) => a[0] - b[0]).map(([r, cs]) => `<row r="${r}">${cs.map(cellXml).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function buildXlsx(sheets: BuiltSheet[], options: { date1904?: boolean } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${options.date1904 ? '<workbookPr date1904="1"/>' : ''}<sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.cells)); });
  return zipSync(files);
}

/** Two grids agree when every cell is equal as text, or both read as numbers within a relative 1e-12. */
export function gridDifferences(a: string[][], b: string[][]): string[] {
  const out: string[] = [];
  const rows = Math.max(a.length, b.length);
  for (let r = 0; r < rows; r++) {
    const cols = Math.max(a[r]?.length ?? 0, b[r]?.length ?? 0);
    for (let c = 0; c < cols; c++) {
      const x = a[r]?.[c] ?? '', y = b[r]?.[c] ?? '';
      if (x === y) continue;
      const nx = Number(x), ny = Number(y);
      if (x !== '' && y !== '' && Number.isFinite(nx) && Number.isFinite(ny) && Math.abs(nx - ny) <= 1e-12 * Math.max(Math.abs(nx), Math.abs(ny), 1)) continue;
      out.push(`${String.fromCharCode(65 + c)}${r + 1}: ${JSON.stringify(x)} vs ${JSON.stringify(y)}`);
    }
  }
  return out;
}
