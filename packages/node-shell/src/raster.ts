// SPDX-License-Identifier: MPL-2.0
/**
 * Shared no-browser raster plumbing for the Node shells (CLI + TUI): the format split,
 * pixel-dimension resolution, and the resvg SVG→PNG fast path ("Tier A" — pure Rust,
 * a few-MB native module, not a browser). Each shell keeps its own orchestration on
 * top (the CLI's renderRaster, the TUI's exportToFile).
 */
import { join } from 'node:path';
import { parseDimension, toPixels } from '@lolly/engine';
import { repoRoot } from './repo-root.ts';

/** Formats the DOM-free engine writes on its own (svg/emf/eps + text/data). Everything
 *  else — raster, pdf, video — is produced by the raster tiers (resvg fast path, else
 *  the scoped Chromium driving the built web shell — see webshell-render.ts). */
export const NODE_FORMATS = ['svg', 'emf', 'eps', 'eps-cmyk', 'dxf', 'html', 'json', 'csv', 'ics', 'vcf', 'txt', 'md'];

// Catalog fonts feed resvg so text-bearing SVG tools rasterise with the brand faces,
// not whatever the OS happens to have.
const FONTS_DIR = join(repoRoot(), 'catalog', 'fonts');

/** The dimension subset pxDims reads (both shells' export-dims shapes satisfy it). */
export interface PxDimsInput { width?: number; height?: number; unit?: string; dpi?: number }

/** Resolve export dims to plain pixels (converts a physical unit like mm via the engine's
 *  own unit math; falls back to the tool's render size, else 1280×720). */
export function pxDims(
  dims: PxDimsInput, manifest: { render?: { width?: number; height?: number } },
): { width: number; height: number; dpi: number } {
  const dpi = dims.dpi && dims.dpi > 0 ? dims.dpi : 300;
  const render = manifest.render ?? {};
  const toPx = (v: number | undefined, fallback: number): number => {
    if (!(typeof v === 'number' && v > 0)) return fallback;
    const u = dims.unit || 'px';
    if (u === 'px') return Math.round(v);
    const d = parseDimension(`${v}${u}`);
    return d ? Math.round(toPixels(d, dpi)) : Math.round(v);
  };
  return { width: toPx(dims.width, render.width ?? 1280), height: toPx(dims.height, render.height ?? 720), dpi };
}

/** Rasterise an SVG string to a `width`×`height` px PNG via resvg (pure Rust, no browser).
 *  resvg's `fitTo` can only constrain ONE axis, so to honour BOTH requested dimensions we
 *  set the root's width/height to the exact target box and render at that intrinsic size —
 *  the SVG's own viewBox + preserveAspectRatio then place the content (letterbox/meet as the
 *  tool authored it), matching the web/desktop raster rather than dropping the height.
 *  Text renders from the catalog fonts; the SVG's own background/transparency is kept. */
export async function rasterizeSvgToPng(svg: string, width: number, height: number): Promise<Uint8Array> {
  const { Resvg } = await import('@resvg/resvg-js');
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const m = svg.match(/<svg\b([^>]*)>/);
  let sized = svg;
  if (m) {
    let attrs = m[1]!;
    // Keep a viewBox (the content coordinate space); synthesise one from the root's own
    // width/height if it lacks one, so the content still scales to the target box.
    if (!/\bviewBox=/.test(attrs)) {
      const ow = attrs.match(/\bwidth="([\d.]+)"/)?.[1];
      const oh = attrs.match(/\bheight="([\d.]+)"/)?.[1];
      if (ow && oh) attrs += ` viewBox="0 0 ${ow} ${oh}"`;
    }
    attrs = attrs.replace(/\s(width|height)="[^"]*"/g, '');   // drop native size, keep viewBox + PAR
    sized = svg.replace(/<svg\b[^>]*>/, `<svg${attrs} width="${w}" height="${h}">`);
  }
  const r = new Resvg(sized, {
    fitTo: { mode: 'original' },
    font: { fontDirs: [FONTS_DIR], loadSystemFonts: true },
  });
  return r.render().asPng();
}

/**
 * matchExportFormat (web parity — shells/web/src/views/tool-actions.ts): a manifest can
 * flag one `asset`/`file` input so the export format DEFAULTS to the uploaded file's own
 * format (a dropped JPEG → jpg) until the user picks one explicitly. Reads `format` off
 * a resolved AssetRef, or the mime subtype off a FileRef, normalises the synonyms
 * (jpeg→jpg, svg+xml→svg), and only answers with a format the tool actually declares.
 * Returns null when the flag is absent, the input is empty, or the format isn't offered.
 */
export function matchedExportFormat(
  manifest: { inputs?: Array<{ id: string; matchExportFormat?: boolean }>; render?: { formats?: string[] } },
  model: ReadonlyArray<{ id: string; value: unknown }>,
): string | null {
  const flagged = (manifest.inputs ?? []).find(i => i.matchExportFormat);
  if (!flagged) return null;
  const v = model.find(m => m.id === flagged.id)?.value as { format?: string; mime?: string } | null | undefined;
  if (!v || typeof v !== 'object') return null;
  let f = (v.format ? String(v.format) : v.mime ? String(v.mime).split('/')[1] ?? '' : '').toLowerCase();
  if (f === 'jpeg') f = 'jpg';
  if (f === 'svg+xml') f = 'svg';
  const formats = (manifest.render?.formats ?? []).map(x => x.toLowerCase());
  return f && formats.includes(f) ? f : null;
}
