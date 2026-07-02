// SPDX-License-Identifier: MPL-2.0
/**
 * ExportAPI — converts a rendered DOM node to a file format.
 *
 * The host owns the renderer choice. Tools call host.export.render(node, fmt)
 * and get back a Blob. Format support lives in the adapter registry below —
 * each format family in its own module (raster, cmyk-tiff, svg, emf-eps, pdf,
 * pdf-cmyk, html, text/data, favicon, zip, video, gif); adding or swapping a
 * format means registering an adapter, not editing a switch.
 *
 * Watermarking: applied when the tool is 'experimental' OR opts.watermark is
 * true, via the export snapshot (a corner overlay on the live node, removed —
 * along with every other export-time DOM effect — by snapshot.release()).
 */

import type { HostV1 } from '@lolly/engine';
import { createRegistry } from './registry.ts';
import { acquireExportSnapshot } from './snapshot.ts';
import { getDomToImage } from './dom.ts';
import { rasterAdapter } from './raster.ts';
import { cmykTiffAdapter } from './cmyk-tiff.ts';
import { svgAdapter } from './svg.ts';
import { emfEpsAdapter } from './emf-eps.ts';
import { pdfAdapter } from './pdf.ts';
import { pdfCmykAdapter } from './pdf-cmyk.ts';
import { htmlAdapter } from './html.ts';
import { textAdapter } from './text.ts';
import { faviconAdapter } from './favicon.ts';
import { zipAdapter } from './zip.ts';
import { videoAdapter } from './video.ts';
import { gifAdapter } from './gif.ts';
import type { ExportFormat, ExportOptions, RenderContext } from './types.ts';

// Preserve the pre-decomposition public surface: videoMimeType was exported
// from bridge/export.js.
export { videoMimeType } from './video.ts';

// One registry per module load; adapters are stateless, so sharing is safe.
const registry = createRegistry();
for (const adapter of [
  rasterAdapter, cmykTiffAdapter, svgAdapter, emfEpsAdapter, pdfAdapter,
  pdfCmykAdapter, htmlAdapter, textAdapter, faviconAdapter, zipAdapter,
  videoAdapter, gifAdapter,
]) registry.register(adapter);

// Dispatch one format → Blob. Separate from the snapshot wrapper in render() so
// the ZIP bundler can re-enter per sub-format without re-applying the watermark
// (the outer render() already snapshotted the live node once).
function renderFormat(host: HostV1 | null, node: HTMLElement, format: ExportFormat, opts: ExportOptions): Promise<Blob> {
  const adapter = registry.resolve(format);   // throws UnknownExportFormatError
  const ctx: RenderContext = {
    node,
    format,
    opts,
    host,
    getDomToImage,
    renderFormat: (f, o) => renderFormat(host, node, f, o),
  };
  return adapter.render(ctx);
}

/** The web shell's implementation of the host-v1 ExportAPI contract. */
export interface WebExportAPI {
  render(node: HTMLElement, format: ExportFormat, opts?: ExportOptions): Promise<Blob>;
  download(blob: Blob, filename: string): Promise<void>;
  file(blob: Blob, opts?: { filename?: string }): Promise<void>;
}

// The host is captured at bridge construction so the SVG/PDF text vectorisers
// can reach host.text.toPath. The reference is stable; host.text is attached
// just after createExportAPI runs (see bridge/index.js ordering), so adapters
// read it lazily at render time, never here.
export function createExportAPI(host: HostV1): WebExportAPI {
  return {
    async render(node, format, opts = {}) {
      // All export-time DOM side effects (watermark overlay + [data-export-hide]
      // detach) are isolated behind the snapshot handle, whose release() always
      // restores the live editor — see bridge/export/snapshot.ts (finding 8).
      const snapshot = acquireExportSnapshot(node, { watermark: Boolean(opts.watermark) });
      try {
        return await renderFormat(host, node, format, opts);
      } finally {
        snapshot.release();
      }
    },

    async download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // Transform-path delivery: a blob the tool produced itself (a transformed
    // user file from the exportFile hook). On the web this is just a download —
    // but it's deliberately a distinct verb from render(): no watermark and no
    // provenance metadata are ever applied, because the bytes are the user's own
    // content. (Tauri/CLI route this to a real save target.)
    async file(blob, opts = {}) {
      await this.download(blob, opts.filename || 'file');
    },
  };
}
