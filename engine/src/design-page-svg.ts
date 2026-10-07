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

import { compileDesignDraw, describeDesignDrawPictures, layoutDesignDrawText, outlineDesignDrawText, rowNum, rowStr, type DesignDrawPage, type DrawFinding, type DrawPictureInfo, type DrawTextToPath } from './design-draw.ts';
import { designDrawSvg } from './design-draw-svg.ts';
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
  /** A picture's own size and media kind, and the address the SVG embeds; null when the host cannot read the picture. */
  picture: (ref: string) => Promise<{ info: DrawPictureInfo; href: string } | null>;
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

/**
 * One frame of a Design document as a standalone SVG drawn from its operations. The
 * first frame in page order when `frameId` is absent; an unknown frame, or a document
 * with no frame, is refused.
 */
export async function designPageSvg(values: Record<string, unknown>, frameId: string | undefined, host: DesignPageSvgHost, opts: { title?: string } = {}): Promise<DesignPageSvg> {
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
  await describeDesignDrawPictures(page, async (ref) => {
    const found = await host.picture(ref);
    if (!found) return null;
    hrefs.set(ref, found.href);
    return found.info;
  });
  const svg = designDrawSvg(page, {
    assetHref: (ref) => hrefs.get(ref),
    family: (font) => font || 'sans-serif',
    mono: 'monospace',
    title: opts.title || frame.name || frame.id,
  });
  return { id: frame.id, width: frame.width, height: frame.height, svg, page, findings: page.findings };
}
