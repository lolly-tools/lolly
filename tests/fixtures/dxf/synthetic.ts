// SPDX-License-Identifier: MPL-2.0
/**
 * Synthetic DXF files for the importer tests and the fuzz seeds. Nothing here is a real drawing:
 * each file is built from group codes written down from Autodesk's published DXF Reference, so the
 * tests need no network and no corpus. The round-trip case goes through Lolly's own `emitDxf`.
 */
export type Group = [code: number, value: string | number];

export function groups(list: Group[]): string {
  return list.map(([c, v]) => `${c}\n${v}`).join('\n') + '\n';
}

export interface DxfParts {
  header?: Group[];
  layers?: Array<{ name: string; aci?: number; flags?: number; tc?: number }>;
  styles?: Array<{ name: string; font?: string; bigfont?: string; typeface?: string }>;
  blocks?: Array<{ name: string; base?: [number, number]; flags?: number; xref?: string; entities?: Group[] }>;
  entities?: Group[];
}

/** An ASCII DXF document (R2000 layout unless the header says otherwise). */
export function dxfText(p: DxfParts): string {
  const out: Group[] = [];
  const header: Group[] = p.header ?? [[9, '$ACADVER'], [1, 'AC1027'], [9, '$INSUNITS'], [70, 4]];
  out.push([0, 'SECTION'], [2, 'HEADER'], ...header, [0, 'ENDSEC']);
  const tables: Group[] = [];
  if (p.layers?.length) {
    tables.push([0, 'TABLE'], [2, 'LAYER'], [70, p.layers.length]);
    for (const l of p.layers) {
      tables.push([0, 'LAYER'], [2, l.name], [70, l.flags ?? 0], [62, l.aci ?? 7]);
      if (l.tc !== undefined) tables.push([420, l.tc]);
      tables.push([6, 'CONTINUOUS']);
    }
    tables.push([0, 'ENDTAB']);
  }
  if (p.styles?.length) {
    tables.push([0, 'TABLE'], [2, 'STYLE'], [70, p.styles.length]);
    for (const s of p.styles) {
      tables.push([0, 'STYLE'], [2, s.name], [70, 0], [40, 0], [41, 1], [50, 0], [71, 0], [42, 0.2], [3, s.font ?? ''], [4, s.bigfont ?? '']);
      if (s.typeface) tables.push([1001, 'ACAD'], [1000, s.typeface], [1071, 0]);
    }
    tables.push([0, 'ENDTAB']);
  }
  if (tables.length) out.push([0, 'SECTION'], [2, 'TABLES'], ...tables, [0, 'ENDSEC']);
  if (p.blocks?.length) {
    out.push([0, 'SECTION'], [2, 'BLOCKS']);
    for (const b of p.blocks) {
      out.push([0, 'BLOCK'], [8, '0'], [2, b.name], [70, b.flags ?? (b.xref ? 4 : 0)], [10, b.base?.[0] ?? 0], [20, b.base?.[1] ?? 0], [30, 0], [3, b.name]);
      if (b.xref) out.push([1, b.xref]);
      out.push(...(b.entities ?? []), [0, 'ENDBLK'], [8, '0']);
    }
    out.push([0, 'ENDSEC']);
  }
  out.push([0, 'SECTION'], [2, 'ENTITIES'], ...(p.entities ?? []), [0, 'ENDSEC'], [0, 'EOF']);
  return groups(out);
}

// Entity builders (group codes per the DXF Reference).
export const line = (x0: number, y0: number, x1: number, y1: number, layer = '0', extra: Group[] = []): Group[] =>
  [[0, 'LINE'], [8, layer], ...extra, [10, x0], [20, y0], [30, 0], [11, x1], [21, y1], [31, 0]];
export const circle = (cx: number, cy: number, r: number, layer = '0'): Group[] => [[0, 'CIRCLE'], [8, layer], [10, cx], [20, cy], [30, 0], [40, r]];
export const arc = (cx: number, cy: number, r: number, a0: number, a1: number, layer = '0', extra: Group[] = []): Group[] =>
  [[0, 'ARC'], [8, layer], ...extra, [10, cx], [20, cy], [30, 0], [40, r], [50, a0], [51, a1]];
export const ellipse = (cx: number, cy: number, mx: number, my: number, ratio: number, t0 = 0, t1 = Math.PI * 2, layer = '0'): Group[] =>
  [[0, 'ELLIPSE'], [8, layer], [10, cx], [20, cy], [30, 0], [11, mx], [21, my], [31, 0], [210, 0], [220, 0], [230, 1], [40, ratio], [41, t0], [42, t1]];
export const lwpolyline = (pts: Array<[number, number, number?]>, closed = false, layer = '0'): Group[] => {
  const g: Group[] = [[0, 'LWPOLYLINE'], [8, layer], [90, pts.length], [70, closed ? 1 : 0]];
  for (const [x, y, b] of pts) { g.push([10, x], [20, y]); if (b) g.push([42, b]); }
  return g;
};
export const polyline = (pts: Array<[number, number, number?]>, closed = false, layer = '0'): Group[] => {
  const g: Group[] = [[0, 'POLYLINE'], [8, layer], [66, 1], [70, closed ? 1 : 0]];
  for (const [x, y, b] of pts) { g.push([0, 'VERTEX'], [8, layer], [10, x], [20, y], [30, 0]); if (b) g.push([42, b]); }
  g.push([0, 'SEQEND'], [8, layer]);
  return g;
};
export const spline = (degree: number, knots: number[], ctrl: Array<[number, number]>, layer = '0'): Group[] => {
  const g: Group[] = [[0, 'SPLINE'], [8, layer], [70, 8], [71, degree], [72, knots.length], [73, ctrl.length], [74, 0]];
  for (const k of knots) g.push([40, k]);
  for (const [x, y] of ctrl) g.push([10, x], [20, y], [30, 0]);
  return g;
};
export const fitSpline = (fit: Array<[number, number]>, layer = '0'): Group[] => {
  const g: Group[] = [[0, 'SPLINE'], [8, layer], [70, 1032], [71, 3], [72, 0], [73, 0], [74, fit.length]];
  for (const [x, y] of fit) g.push([11, x], [21, y], [31, 0]);
  return g;
};
export const text = (x: number, y: number, h: number, s: string, style = 'STANDARD', layer = '0', extra: Group[] = []): Group[] =>
  [[0, 'TEXT'], [8, layer], [10, x], [20, y], [30, 0], [40, h], [1, s], [7, style], ...extra];
export const mtext = (x: number, y: number, h: number, s: string, style = 'STANDARD', layer = '0', extra: Group[] = []): Group[] =>
  [[0, 'MTEXT'], [8, layer], [10, x], [20, y], [30, 0], [40, h], [41, 0], [71, 1], [1, s], [7, style], ...extra];
export const insert = (name: string, x: number, y: number, layer = '0', extra: Group[] = []): Group[] =>
  [[0, 'INSERT'], [8, layer], [2, name], [10, x], [20, y], [30, 0], ...extra];

/** The same tags as binary DXF. `r12` writes one-byte group codes, as AutoCAD R12 did. */
export function dxfBinary(ascii: string, r12 = false): Uint8Array {
  const lines = ascii.split('\n');
  const bytes: number[] = [...new TextEncoder().encode('AutoCAD Binary DXF\r\n\x1a\0')];
  const i16 = (n: number) => bytes.push(n & 255, (n >> 8) & 255);
  const f64 = (n: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, n, true); bytes.push(...b); };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i]), val = lines[i + 1]!;
    if (r12) { if (code >= 255) { bytes.push(255); i16(code); } else bytes.push(code); } else i16(code);
    if (code <= 9 || (code >= 100 && code <= 109) || (code >= 300 && code <= 309) || (code >= 320 && code <= 369) || code === 999 || (code >= 1000 && code <= 1003) || (code >= 1005 && code <= 1009)) {
      bytes.push(...new TextEncoder().encode(val), 0);
    } else if ((code >= 10 && code <= 59) || (code >= 110 && code <= 149) || (code >= 210 && code <= 239) || (code >= 1010 && code <= 1059)) f64(Number(val));
    else if (code >= 90 && code <= 99 || (code >= 420 && code <= 459) || code === 1071) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, Number(val), true); bytes.push(...b); }
    else i16(Number(val));
  }
  return new Uint8Array(bytes);
}
