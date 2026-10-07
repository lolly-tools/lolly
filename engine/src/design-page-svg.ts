// SPDX-License-Identifier: MPL-2.0
/**
 * A Design page exported as SVG from drawing operations (plan 295, phase 3, P3d).
 *
 * The authored document (the values `ExportOpts.sourceDocument` carries) is read once:
 * the frame's rows are compiled with Design semantics, their text laid out by the
 * engine's measure and outlined through the host, their pictures described and
 * embedded, and the page written by `designDrawSvg`. No DOM is involved, so every shell
 * gets the same bytes from the same document. What the operations do not carry is
 * returned as findings, never dropped; the caller decides whether a page with findings
 * may be delivered.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness. The host's shaper,
 * outliner and asset reader arrive as functions.
 */
import type { TextMeasureFontsV1 } from '@lolly-tools/core';

import { compileDesignDraw, describeDesignDrawPictures, layoutDesignDrawText, outlineDesignDrawText, rowNum, rowStr, type DesignDrawPage, type DrawFinding, type DrawOp, type DrawPictureInfo, type DrawTextToPath } from './design-draw.ts';
import { designDrawSvg, svgEscape } from './design-draw-svg.ts';
import { injectSvgMeta } from './image-meta.ts';
import { imageDimensions } from './penpot-file.ts';
import type { TextShaperV1 } from './design-text-measure.ts';

type Row = Record<string, unknown>;

/** One frame of a Design document: its row first, then its members in document order. */
export interface DesignFrameRows { id: string; name: string; width: number; height: number; rows: Row[] }

/** What the host lends the export. */
export interface DesignPageSvgHost {
  /** Shapes text for the measure (the same shaper the measure CLI uses). */
  shaper: TextShaperV1;
  /** Outlines a run, as `HostV1.text.toPath`; without it the words stay live text. */
  toPath?: DrawTextToPath;
  /**
   * A picture's media kind and, for a still, the asset's own bytes, which the page embeds
   * as they are so the picture's credentials travel with the page. `width` and `height` are
   * the host's own reading, used only when the header cannot be read here. Null when
   * the host cannot read the picture.
   */
  picture: (ref: string) => Promise<{ media?: DrawPictureInfo['media']; bytes?: Uint8Array; width?: number; height?: number } | null>;
  /** The live brand, asked first for a `var(...)` or `{token}` colour. */
  resolveColor?: (css: string) => string | null;
  /** The brand's font families by slot. */
  fonts?: TextMeasureFontsV1;
}

export interface DesignPageSvg {
  id: string;
  width: number;
  height: number;
  svg: string;
  /** The compiled page, for a consumer that checks or draws the operations itself. */
  page: DesignDrawPage;
  findings: DrawFinding[];
}

const isHidden = (row: Row): boolean => {
  const v = row.hidden;
  if (v === true || v === false) return v;
  const s = String(v ?? '').toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
};

/**
 * A document's frames as the renderer orders its pages: visible frames by `order`, then
 * by `x`, each with the rows that name it as their frame, in document (paint) order.
 */
export function designFrames(values: Record<string, unknown>): DesignFrameRows[] {
  const rows = Array.isArray(values.boxes) ? (values.boxes as unknown[]).filter((r): r is Row => !!r && typeof r === 'object') : [];
  const frames = rows.map((row, index) => ({ row, index }))
    .filter(({ row }) => rowStr(row as never, 'kind') === 'frame' && !isHidden(row))
    .sort((a, b) => (rowNum(a.row as never, 'order') - rowNum(b.row as never, 'order')) || (rowNum(a.row as never, 'x') - rowNum(b.row as never, 'x')));
  return frames.map(({ row, index }) => {
    const id = row.id !== undefined && row.id !== null && row.id !== '' ? String(row.id) : String(index);
    return {
      id,
      name: rowStr(row as never, 'name'),
      width: Math.max(1, Math.round(rowNum(row as never, 'w', 1))),
      height: Math.max(1, Math.round(rowNum(row as never, 'h', 1))),
      rows: [row, ...rows.filter((member) => member !== row && rowStr(member as never, 'kind') !== 'frame' && String(member.frame ?? '') === id)],
    };
  });
}

/** An embedded picture's type from its own bytes: the formats every SVG reader draws, or null. */
export function pictureMime(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  const head = new TextDecoder().decode(b.subarray(0, 512)).replace(/^\uFEFF/, '').trimStart();
  if (/^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return null;
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Whether a raster picture holds far more pixels than its drawing shows: the walker's
 * rule, which embeds at most twice the drawn size (more at a print DPI, never under
 * 256 px) and leaves a picture alone within 15 percent of that. The page embeds the
 * asset's own bytes, so until a portable resampler embeds fewer, such a page is
 * reported rather than delivered several times larger than before.
 */
function oversize(op: DrawOp, dpi: number): boolean {
  const picture = op.picture;
  if (!picture?.natural) return false;
  const cap = Math.max(256, Math.ceil(Math.max(picture.area.w, picture.area.h) * picture.zoom * Math.max(2, dpi / 96)));
  return Math.max(picture.natural.width, picture.natural.height) > cap * 1.15;
}

/**
 * One frame of a Design document as a standalone SVG drawn from its operations. The
 * first frame in page order when `frameId` is absent; an unknown frame, or a document
 * with no frame, is refused. `dpi` is the export's resolution (96 when absent), which
 * sets how large a picture may be before it is reported as oversize.
 */
export interface DesignPageSvgOptions {
  title?: string;
  dpi?: number;
  /**
   * The size the export asks for: CSS lengths for the root (`210mm`, `640px`) and the
   * same size in CSS px. The viewBox stays the page, stretched to a different shape
   * as the walker scales its content.
   */
  size?: { width: string; height: string; px: { w: number; h: number } };
  /** The export's metadata block (`ExportOpts.meta`). */
  meta?: Parameters<typeof injectSvgMeta>[1];
}

export async function designPageSvg(values: Record<string, unknown>, frameId: string | undefined, host: DesignPageSvgHost, opts: DesignPageSvgOptions = {}): Promise<DesignPageSvg> {
  const frames = designFrames(values);
  const frame = frameId === undefined ? frames[0] : frames.find((f) => f.id === frameId);
  if (!frame) throw new Error(frameId === undefined ? 'This document has no frame to export as a page.' : `There is no visible frame "${frameId}" in this document.`);
  const page = compileDesignDraw(frame.rows as never, { width: frame.width, height: frame.height }, {
    effects: true, colors: 'resolved',
    ...(host.resolveColor ? { resolveColor: host.resolveColor } : {}),
    ...(host.fonts ? { fonts: host.fonts } : {}),
  });
  await layoutDesignDrawText(page, host.shaper);
  if (host.toPath) await outlineDesignDrawText(page, host.toPath);
  const hrefs = new Map<string, string>();
  const vectors = new Set<string>();
  const unread = new Set<string>();
  await describeDesignDrawPictures(page, async (ref) => {
    const found = await host.picture(ref);
    if (found?.media === 'motion' || found?.media === 'audio') return { width: 0, height: 0, media: found.media };
    const mime = found?.bytes ? pictureMime(found.bytes) : null;
    if (!found?.bytes || !mime) { unread.add(ref); return null; }
    const size = imageDimensions(found.bytes, mime) ?? (found.width && found.height ? { w: found.width, h: found.height } : null);
    hrefs.set(ref, dataUrl(found.bytes, mime));
    if (mime === 'image/svg+xml') vectors.add(ref);
    return size ? { width: size.w, height: size.h } : null;
  });
  for (const op of [...(page.frame ? [page.frame] : []), ...page.ops]) {
    // The canvas may draw a picture this host could not read; drawing nothing in its place would lose the picture.
    if (op.picture && unread.has(op.picture.ref)) page.findings.push({ id: op.id, feature: 'image-unread' });
  }
  for (const op of [...(page.frame ? [page.frame] : []), ...page.ops]) {
    if (op.picture && !vectors.has(op.picture.ref) && oversize(op, opts.dpi ?? 96)) page.findings.push({ id: op.id, feature: 'image-oversize' });
  }
  let svg = designDrawSvg(page, {
    assetHref: (ref) => hrefs.get(ref),
    family: (font) => font || 'sans-serif',
    mono: 'monospace',
    title: opts.title || frame.name || frame.id,
  });
  const size = opts.size;
  if (size) {
    const stretch = Math.abs(size.px.w / size.px.h - frame.width / frame.height) > 1e-6;
    svg = svg.replace(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[^"]*" height="[^"]*"/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${svgEscape(size.width)}" height="${svgEscape(size.height)}"${stretch ? ' preserveAspectRatio="none"' : ''}`);
  }
  if (opts.meta) svg = injectSvgMeta(svg, opts.meta);
  return { id: frame.id, width: frame.width, height: frame.height, svg, page, findings: page.findings };
}
