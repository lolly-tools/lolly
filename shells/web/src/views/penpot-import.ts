// SPDX-License-Identifier: MPL-2.0
/**
 * Penpot reader for Unpack (#/unpack).
 *
 * A `.penpot` export (binfile-v3) is a ZIP of per-shape JSON: `manifest.json`, then
 * `files/<id>/pages/<page>/<shape>.json` for every shape, plus embedded media under
 * `objects/`. This reads that structure for extraction - the words in the text
 * shapes, the colours every shape paints with, the font families they name, the
 * rasters they embed, and the groups/components as standalone SVGs - and hands it
 * back as the same `PdfHandle` shape the other formats use.
 *
 * It is deliberately SEPARATE from `design-import.ts parsePenpotBinfile` (which maps
 * the same file into editable Design boxes): the two want different things
 * from the file, and keeping Unpack's read path here avoids dragging the heavy
 * design-import chunk (Kiwi/zstd for .fig) in behind a Penpot drop. The shape→SVG
 * and content parsing are the shared engine helpers, so the two never disagree about
 * what a shape is.
 *
 * Names, never bytes for anything linked: Penpot embeds its media, so those DO come
 * out as bytes, but font FILES are not in a standard export, so families are reported
 * names-only.
 */

import { strFromU8 } from 'fflate';
import { parsePenpotContent, collectPenpotFontUsage, penpotGroupToSvg, safeColor, extractSvgColors } from '@lolly/engine';
import type { PageText, TextBlock } from '@lolly/engine';
import { rasterSize } from './svg-unpack.ts';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedFont, EmbeddedImage, EmbeddedImageScan, ExtractedVector } from './pdf-import.ts';

/** The synthetic root frame id every Penpot page hangs its top-level shapes off. */
const ROOT = '00000000-0000-0000-0000-000000000000';

type Shape = Record<string, unknown>;
type ShapesById = Record<string, Shape>;

function safeJson(text: string): any {
  try { return JSON.parse(text); } catch { return null; }
}

const emptyPage = (): PageText =>
  ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

/** A referenced-but-not-embedded font row (a standard export ships no font files). */
function namesOnlyFont(family: string): EmbeddedFont {
  return {
    name: family, family, ext: 'ttf', bytes: new Uint8Array(0),
    subset: false, installable: false,
    embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
  };
}

// ── colour harvest ───────────────────────────────────────────────────────────────

/** Push a normalised colour into the accumulator, deduped. */
function pushColor(raw: unknown, seen: Set<string>, out: string[]): void {
  if (raw == null) return;
  const hex = safeColor(String(raw), '');
  if (!hex) return;
  const key = hex.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(hex);
}

/** Every distinct colour a shape paints with: solid fills, gradient stops, strokes. */
function shapeColors(shape: Shape, seen: Set<string>, out: string[]): void {
  const fills = Array.isArray(shape.fills) ? shape.fills : [];
  for (const f of fills as any[]) {
    if (!f) continue;
    pushColor(f.fillColor, seen, out);
    const stops = f.fillColorGradient?.stops;
    if (Array.isArray(stops)) for (const s of stops) pushColor(s?.color, seen, out);
  }
  const strokes = Array.isArray(shape.strokes) ? shape.strokes : [];
  for (const s of strokes as any[]) if (s) pushColor(s.strokeColor, seen, out);
}

// ── the opener ────────────────────────────────────────────────────────────────────

export async function openPenpotFile(files: Record<string, Uint8Array>): Promise<UnpackHandle> {
  const manifest = files['manifest.json'] ? safeJson(strFromU8(files['manifest.json'])) : null;
  const fileId = Array.isArray(manifest?.files) && manifest.files[0] ? manifest.files[0].id : null;
  if (!fileId) throw new Error('This Penpot file has no importable file.');

  const pageDir = `files/${fileId}/pages/`;
  const pages = new Map<string, ShapesById>();
  const pageIndex = new Map<string, number>();
  for (const path of Object.keys(files)) {
    if (!path.startsWith(pageDir)) continue;
    const rel = path.slice(pageDir.length);
    const meta = /^([^/]+)\.json$/i.exec(rel);
    if (meta) { const m = safeJson(strFromU8(files[path]!)); pageIndex.set(meta[1]!, Number.isFinite(m?.index) ? m.index : 0); continue; }
    const sh = /^([^/]+)\/([^/]+)\.json$/i.exec(rel);
    if (sh) {
      const shape = safeJson(strFromU8(files[path]!));
      if (shape && shape.id) {
        if (!pages.has(sh[1]!)) pages.set(sh[1]!, {});
        pages.get(sh[1]!)![String(shape.id)] = shape;
      }
    }
  }
  const pageIds = [...pages.keys()].sort((a, b) => (pageIndex.get(a) ?? 0) - (pageIndex.get(b) ?? 0));
  if (!pageIds.length) throw new Error('This Penpot file has no pages to take apart.');

  // Shapes in paint order: DFS from the root frame following each container's
  // `shapes` array; anything unreachable is appended in map order.
  const ordered = (byId: ShapesById): Shape[] => {
    const out: Shape[] = [];
    const seen = new Set<string>();
    const visit = (id: string): void => {
      const s = byId[id];
      if (!s || seen.has(id)) return;
      seen.add(id);
      if (id !== ROOT) out.push(s);
      const kids = Array.isArray(s.shapes) ? s.shapes : [];
      for (const k of kids) visit(String(k));
    };
    visit(ROOT);
    for (const id of Object.keys(byId)) visit(id);
    return out;
  };

  // ── palette + fonts, harvested once across the whole file ──
  const palette: string[] = [];
  const seenColor = new Set<string>();
  const fonts: string[] = [];
  const seenFont = new Set<string>();
  for (const byId of pages.values()) {
    for (const shape of Object.values(byId)) {
      shapeColors(shape, seenColor, palette);
      if (String(shape.type || '') === 'text' && shape.content) {
        const info = parsePenpotContent(shape.content);
        pushColor(info.fg, seenColor, palette);
        for (const u of collectPenpotFontUsage(shape.content)) {
          const fam = (u.fontFamily || '').trim();
          if (fam && !seenFont.has(fam.toLowerCase())) { seenFont.add(fam.toLowerCase()); fonts.push(fam); }
        }
      }
    }
  }

  // ── media (embedded rasters), loaded lazily on the Images pass ──
  const loadImages = (): EmbeddedImage[] => {
    const out: EmbeddedImage[] = [];
    const done = new Set<string>();
    const take = (fillImageId: string, page: number): void => {
      if (done.has(fillImageId)) return;
      done.add(fillImageId);
      let mediaId = fillImageId, mtype = 'image/png';
      const metaPath = `files/${fileId}/media/${fillImageId}.json`;
      if (files[metaPath]) {
        const meta = safeJson(strFromU8(files[metaPath]!));
        if (meta) { mediaId = meta.mediaId || meta.id || mediaId; mtype = meta.mtype || mtype; }
      }
      const objPath = Object.keys(files).find((p) => p.startsWith(`objects/${mediaId}.`) && !/\.json$/i.test(p));
      if (!objPath) return;
      const bytes = files[objPath]!;
      const size = rasterSize(bytes);
      out.push({ bytes, mime: mtype, width: size?.w || 0, height: size?.h || 0, colorSpace: null, page });
    };
    pageIds.forEach((pid, page) => {
      for (const shape of Object.values(pages.get(pid)!)) {
        const fills = Array.isArray(shape.fills) ? shape.fills : [];
        for (const f of fills as any[]) {
          const id = f?.fillImage?.id;
          if (id) take(String(id), page);
        }
      }
    });
    return out;
  };

  // ── components / groups → standalone SVGs ──
  const loadVectors = (): ExtractedVector[] => {
    const out: ExtractedVector[] = [];
    pageIds.forEach((pid, page) => {
      const byId = pages.get(pid)!;
      for (const shape of Object.values(byId)) {
        if (String(shape.type || '') !== 'group') continue;
        const svg = penpotGroupToSvg(shape, (cid: string) => byId[cid]);
        if (!svg) continue;
        const sel = (shape.selrect && typeof shape.selrect === 'object') ? shape.selrect as any : shape as any;
        const w = Math.round(Number(sel.width) || 0), h = Math.round(Number(sel.height) || 0);
        if (!w || !h) continue;
        const localSeen = new Set<string>();
        const fills: string[] = [];
        shapeColors(shape, localSeen, fills);
        out.push({
          svg, width: w, height: h, page,
          fills: (fills.length ? fills : extractSvgColors(svg)).slice(0, 12),
          shapes: (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line)\b/g) || []).length,
          reason: 'a Penpot group',
        });
      }
    });
    return out;
  };

  // A whole page as one SVG: wrap its top-level shapes in a synthetic group and let
  // the shared renderer flatten it. Best-effort - returns a blank page when the page
  // has nothing the vector renderer can bake (e.g. only text).
  const pageSvg = (pid: string): { svg: string; width: number; height: number } => {
    const byId = pages.get(pid)!;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of Object.values(byId)) {
      if (String(s.id) === ROOT) continue;
      const sel = (s.selrect && typeof s.selrect === 'object') ? s.selrect as any : s as any;
      const x = Number(sel.x), y = Number(sel.y), w = Number(sel.width), h = Number(sel.height);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w); maxY = Math.max(maxY, y + h);
    }
    const width = Number.isFinite(minX) ? Math.max(1, Math.round(maxX - minX)) : 1080;
    const height = Number.isFinite(minY) ? Math.max(1, Math.round(maxY - minY)) : 1080;
    const topIds = Array.isArray(byId[ROOT]?.shapes) ? (byId[ROOT]!.shapes as unknown[]).map(String) : Object.keys(byId).filter((id) => id !== ROOT);
    const root: Shape = {
      type: 'group', shapes: topIds,
      selrect: { x: Number.isFinite(minX) ? minX : 0, y: Number.isFinite(minY) ? minY : 0, width, height },
    };
    const inner = penpotGroupToSvg(root, (cid: string) => byId[cid]);
    const svg = inner || `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ffffff"/></svg>`;
    return { svg, width, height };
  };

  return {
    pageCount: pageIds.length,
    async pageToSvg(i: number): Promise<PdfPageSvg> {
      const pid = pageIds[i];
      if (!pid) throw new Error(`No page ${i + 1} in this Penpot file.`);
      const { svg, width, height } = pageSvg(pid);
      return { svg, width, height, elementCount: (svg.match(/<(path|rect|circle|ellipse|text|image)\b/g) || []).length };
    },
    pageToText(i: number): PageText {
      const pid = pageIds[i];
      if (!pid) return emptyPage();
      const blocks: TextBlock[] = [];
      for (const shape of ordered(pages.get(pid)!)) {
        if (String(shape.type || '') !== 'text' || !shape.content) continue;
        const info = parsePenpotContent(shape.content);
        const txt = (info.text || '').trim();
        if (!txt) continue;
        blocks.push({
          kind: 'paragraph', text: txt,
          size: info.fontSize || 0,
          bold: (Number(info.fontWeight) || 400) >= 600,
          column: 0,
        });
      }
      if (!blocks.length) return emptyPage();
      const text = blocks.map((b) => b.text).join('\n\n');
      return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
    },
    listPalette(): string[] {
      return palette;
    },
    listFonts(): EmbeddedFont[] {
      return fonts.map(namesOnlyFont);
    },
    listImages(): Promise<EmbeddedImageScan> {
      return Promise.resolve({ images: loadImages(), skipped: 0, skippedFilters: [] });
    },
    listVectors(): Promise<ExtractedVector[]> {
      return Promise.resolve(loadVectors());
    },
  };
}
