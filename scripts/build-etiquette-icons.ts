#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build Lolly Demo's two-tone Etiquette icons from their stroke drawings.
 *
 * Etiquette is drawn as Lucide draws: a 24 px grid, a 2 px stroke, round caps and
 * joins. A themable catalog icon has to be fills only (`validate-catalog.ts` refuses
 * stroke styling), because a theme is baked by turning `class="c1"`/`class="c2"` into
 * fill attributes. So each source glyph sorts its strokes into the base and the
 * accent, and this script outlines every stroke with the engine's own
 * `strokeToPath`, unions each tone into one path and writes the c1/c2 file.
 *
 *   node scripts/build-etiquette-icons.ts            write the SVGs
 *   node scripts/build-etiquette-icons.ts --check    fail when a file is missing or differs
 *   node scripts/build-etiquette-icons.ts --sheet=<file.png>  also render a review sheet
 *   --source=<file.json> --out=<dir> --only=<slug,slug>       build another table or a subset
 *
 * The source table is scripts/data/etiquette-icons.json. The default fills are the first
 * pairing in lolly/palette/opal-icon-themes, which the validator also requires.
 * After writing, run `pnpm run build:catalog` so the index picks up the checksums.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { parseIconThemesDoc } from '../engine/src/icon-theme.ts';

interface EtiquetteIcon {
  slug: string;
  name: string;
  /** The web shell registry key the drawing comes from. */
  registry?: string;
  tags?: string[];
  /** False for a drawing of Lolly's own (the lolly glyph), which carries no Lucide licence. */
  lucide?: boolean;
  base: string[];
  accent: string[];
}
interface EtiquetteSource { stroke: number; icons: EtiquetteIcon[] }

const root = new URL('../', import.meta.url);
const sourceUrl = new URL('scripts/data/etiquette-icons.json', root);
const defaultOutDir = new URL('brands/lolly-demo/catalog/assets/lolly/icons/', root);
const themesUrl = new URL('brands/lolly-demo/catalog/assets/lolly/palette/opal-icon-themes.json', root);
const indexUrl = new URL('brands/lolly-demo/catalog/assets/index.json', root);
const LUCIDE_CREDIT = 'Lucide, Copyright (c) Lucide Contributors (portions Copyright (c) Cole Bemis, Feather, MIT). ISC License.';

const geom = makeGeomApi();
const num = (v: string | undefined): number => (v === undefined || v === '' ? 0 : Number(v));

/** One SVG element of a source glyph as path data, with the attribute set Lucide uses. */
export function elementToPathData(el: string): string {
  const tag = /^<\s*([a-z]+)/i.exec(el)?.[1]?.toLowerCase();
  const attrs: Record<string, string> = {};
  for (const m of el.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g)) attrs[m[1]!] = m[2]!;
  switch (tag) {
    case 'path': return attrs.d ?? '';
    case 'line': return `M${num(attrs.x1)} ${num(attrs.y1)}L${num(attrs.x2)} ${num(attrs.y2)}`;
    case 'polyline':
    case 'polygon': {
      const pts = (attrs.points ?? '').trim().split(/[\s,]+/).map(Number);
      let d = '';
      for (let i = 0; i + 1 < pts.length; i += 2) d += `${i ? 'L' : 'M'}${pts[i]} ${pts[i + 1]}`;
      return tag === 'polygon' ? `${d}Z` : d;
    }
    case 'circle':
    case 'ellipse': {
      const cx = num(attrs.cx), cy = num(attrs.cy);
      const rx = tag === 'circle' ? num(attrs.r) : num(attrs.rx);
      const ry = tag === 'circle' ? num(attrs.r) : num(attrs.ry);
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    case 'rect': {
      const x = num(attrs.x), y = num(attrs.y), w = num(attrs.width), h = num(attrs.height);
      let rx = attrs.rx !== undefined ? num(attrs.rx) : num(attrs.ry);
      let ry = attrs.ry !== undefined ? num(attrs.ry) : rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 ${-rx} ${ry}`
        + `h${-(w - 2 * rx)}a${rx} ${ry} 0 0 1 ${-rx} ${-ry}v${-(h - 2 * ry)}a${rx} ${ry} 0 0 1 ${rx} ${-ry}Z`;
    }
    default: throw new Error(`Unsupported element in Etiquette source: ${el}`);
  }
}

/** The filled outline of a set of stroked elements, as one path. */
export function outlineTone(elements: string[], width: number): string {
  const parts: string[] = [];
  for (const el of elements) {
    const r = geom.stroke(elementToPathData(el), width, { cap: 'round', join: 'round', decimals: 3 });
    if (!r.ok) throw new Error(`Could not outline ${el}: ${r.message}`);
    if (r.d) parts.push(r.d);
  }
  if (parts.length <= 1) return parts[0] ?? '';
  const u = geom.union(parts, { decimals: 3 });
  if (!u.ok) throw new Error(`Could not merge ${elements.join(' ')}: ${u.message}`);
  return u.d;
}

/**
 * The catalog row for one icon. `pnpm run build:catalog` adds the checksum, size and
 * date; every field it owns is kept when the row already exists.
 */
export function indexRow(icon: EtiquetteIcon): Record<string, unknown> {
  return {
    id: `lolly/icons/${icon.slug}`,
    name: icon.name,
    type: 'vector',
    version: '1.0.0',
    tier: 'on-demand',
    tags: ['icon', 'themable', 'two-color', 'etiquette', ...(icon.tags ?? [])],
    formats: [{ format: 'svg', url: `/catalog/assets/lolly/icons/${icon.slug}.svg` }],
    ...(icon.lucide === false ? {} : { license: 'ISC', attribution: LUCIDE_CREDIT }),
  };
}

/** Put every icon's row into the Lolly Demo index, after the icon pairings, in source order. */
function upsertRows(index: { assets: Record<string, unknown>[] }, icons: EtiquetteIcon[]): { added: number; changed: number } {
  const ours = new Set(icons.map((i) => `lolly/icons/${i.slug}`));
  const old = new Map(index.assets.filter((a) => ours.has(String(a.id))).map((a) => [String(a.id), a]));
  let added = 0, changed = 0;
  const rows = icons.map((icon) => {
    const row = indexRow(icon);
    const prev = old.get(String(row.id));
    if (!prev) { added++; return row; }
    const prevFormat = (prev.formats as Record<string, unknown>[] | undefined)?.[0] ?? {};
    const merged = { ...prev, ...row, formats: [{ ...prevFormat, ...(row.formats as Record<string, unknown>[])[0] }] };
    if (JSON.stringify(merged) !== JSON.stringify(prev)) changed++;
    return merged;
  });
  const rest = index.assets.filter((a) => !ours.has(String(a.id)));
  const at = rest.findIndex((a) => a.id === 'lolly/palette/opal-icon-themes');
  rest.splice(at < 0 ? rest.length : at + 1, 0, ...rows);
  index.assets = rest;
  return { added, changed };
}

export function iconSvg(icon: EtiquetteIcon, width: number, c1: string, c2: string): string {
  const base = outlineTone(icon.base, width);
  const accent = outlineTone(icon.accent, width);
  if (!base || !accent) throw new Error(`${icon.slug}: an icon needs both a base and an accent stroke`);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    + `<defs><style>.c1{fill:${c1}}.c2{fill:${c2}}</style></defs>`
    + `<path class="c2" d="${base}"/><path class="c1" d="${accent}"/></svg>\n`;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const sheetArg = process.argv.find((a) => a.startsWith('--sheet='))?.slice('--sheet='.length);
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length).split(',');
  const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.slice('--source='.length);
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const outDir = outArg ? pathToFileURL(outArg.endsWith('/') ? outArg : `${outArg}/`) : defaultOutDir;
  const source = JSON.parse(await readFile(sourceArg ? pathToFileURL(sourceArg) : sourceUrl, 'utf8')) as EtiquetteSource;
  const first = parseIconThemesDoc(JSON.parse(await readFile(themesUrl, 'utf8')))[0];
  if (!first) throw new Error('opal-icon-themes has no pairing to take the default fills from');
  await mkdir(outDir, { recursive: true });
  const built: { slug: string; svg: string }[] = [];
  let stale = 0;
  for (const icon of source.icons) {
    if (only && !only.includes(icon.slug)) continue;
    const svg = iconSvg(icon, source.stroke, first.c1, first.c2);
    const file = new URL(`${icon.slug}.svg`, outDir);
    built.push({ slug: icon.slug, svg });
    if (check) {
      const have = await readFile(file, 'utf8').catch(() => null);
      if (have !== svg) { stale++; console.error(`stale: ${icon.slug}.svg`); }
    } else {
      await writeFile(file, svg);
    }
  }
  if (sheetArg) await writeSheet(sheetArg, built, first.c1, first.c2);
  // The index rows follow the real table only: a scratch --source, --out or --only run
  // leaves the catalog alone.
  if (!sourceArg && !outArg && !only) {
    const index = JSON.parse(await readFile(indexUrl, 'utf8')) as { assets: Record<string, unknown>[] };
    const { added, changed } = upsertRows(index, source.icons);
    if (check && (added || changed)) { stale += added + changed; console.error(`${added + changed} lolly/icons index row(s) differ from the source`); }
    if (!check && (added || changed)) await writeFile(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
  }
  if (check && stale) { console.error(`${stale} Etiquette icon file(s) differ from the source; run node scripts/build-etiquette-icons.ts`); process.exit(1); }
  console.log(`${check ? 'checked' : 'wrote'} ${built.length} Etiquette icons`);
}

/** A review sheet: every icon in its default pairing, with its slug underneath. */
async function writeSheet(file: string, built: { slug: string; svg: string }[], c1: string, c2: string): Promise<void> {
  const { Resvg } = await import('@resvg/resvg-js');
  const cols = 10, cell = 96, pad = 16;
  const rows = Math.ceil(built.length / cols);
  const cells = built.map(({ slug, svg }, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    const inner = svg.replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">', `<svg x="${x + pad}" y="${y + 8}" width="${cell - 2 * pad}" height="${cell - 2 * pad}" viewBox="0 0 24 24">`)
      .replaceAll('class="c1"', 'fill="var(--c1)"').replaceAll('class="c2"', 'fill="var(--c2)"').replace(/<defs>.*?<\/defs>/, '');
    return `${inner}<text x="${x + cell / 2}" y="${y + cell - 6}" font-size="10" text-anchor="middle" fill="#555">${slug}</text>`;
  }).join('');
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cell}" height="${rows * cell}"><rect width="100%" height="100%" fill="#fff"/>${cells.replaceAll('var(--c1)', c1).replaceAll('var(--c2)', c2)}</svg>`;
  await writeFile(file, new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng());
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
