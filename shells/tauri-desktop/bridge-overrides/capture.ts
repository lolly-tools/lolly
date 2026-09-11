// SPDX-License-Identifier: MPL-2.0
/**
 * CaptureAPI (Tauri desktop) - page-to-image AND page-to-vector capture.
 *
 * Replaces the web shell's throwing stub (shells/web/src/bridge/capture.ts) at
 * build time via vite.config.js's resolveId override. Where a browser page can't
 * screenshot a cross-origin URL, the desktop shell can: it drives a headless
 * Chrome over the DevTools Protocol.
 *
 *   page(spec)   → raster. Native `capture_page` returns the PNG plus the page
 *                  geometry (page size, resolved scroll, the framed viewport
 *                  height inside a tall range strip). We wrap the PNG in a data-
 *                  URL AssetRef and carry the geometry in meta so a tool can pan
 *                  a scroll video over the strip.
 *   vector(spec) → true vector. Native `capture_page_pdf` prints the page to a
 *                  vector PDF; we convert it to a standalone SVG through the
 *                  engine's PDF interpreter (the same path a .ai/.pdf upload
 *                  takes) and WINDOW it - scroll depth, crop insets and the range
 *                  extension become viewBox geometry, so a vector shot frames
 *                  identical content to a raster shot of the same spec.
 *
 * Both results flow into the normal render/export path (units, format,
 * provenance, watermark) unchanged.
 */

import { invoke } from '@tauri-apps/api/core';
import { windowPdfSvg, HOOK_BUDGET_MS } from '@lolly/engine';
import type { AssetRef, CaptureAPI, CaptureSpec } from '@lolly-tools/core/host-v1';

/**
 * What the two native commands hand back. These MIRROR `CaptureResult` and
 * `VectorResult` in src-tauri/src/capture.rs, which serialise with serde
 * `rename_all = "camelCase"` - nothing checks the two sides against each other, so
 * a field renamed in Rust has to be renamed here by hand. Both `data` fields are
 * base64 (PNG / PDF) exactly as CDP returned them.
 */
interface NativeCaptureResult {
  data: string;
  /** Captured box in CSS px - crop applied, range extension included. */
  width: number;
  height: number;
  /** The cropped viewport height alone; height − frameHeight is the pan distance. */
  frameHeight: number;
  pageWidth: number;
  pageHeight: number;
  /** Resolved scroll offset the frame starts at, document space. */
  scrollY: number;
}

interface NativeVectorResult {
  data: string;
  /** Page geometry at capture time, CSS px. pageHeight reports the value actually
   *  printed, which the Rust side may have capped at MAX_PDF_H. */
  pageWidth: number;
  pageHeight: number;
}

// url-shot captures in beforeExport, which the runtime time-boxes at
// HOOK_BUDGET_MS.beforeExport (default 5s) and FAILS the export on overrun. A real
// capture is a headless navigation (Rust caps it at 30s) + a settle delay the user
// sets up to 15s + printToPDF + PDF→SVG - well past 5s, so with the default budget
// any non-trivial capture (or any waitMs > 5s) would time out and fail. HOOK_BUDGET_MS
// is exported mutable for exactly this - "shells with unusual needs, e.g. a long
// page-capture beforeExport" (runtime.ts). Raise it here, at desktop bridge load
// (the boot chunk, before any export), sized to cover the worst-case chain. Desktop
// only: the web stub throws instantly, so it never needs the longer wait.
HOOK_BUDGET_MS.beforeExport = Math.max(HOOK_BUDGET_MS.beforeExport, 90_000);

// A scroll position: 0..1 ⇒ fraction of the scrollable height, > 1 ⇒ px offset.
// Clamped into the page's real range. Mirrors capture.rs resolve_scroll so the
// vector window frames the same region the native raster clip does.
function resolveScroll(depth: number | undefined, pageH: number, viewportH: number): number {
  const max = Math.max(0, pageH - viewportH);
  if (depth == null) return 0;
  const px = depth <= 1 ? Math.max(0, depth) * max : depth;
  return Math.min(Math.max(0, px), max);
}

const clampInset = (v: number | undefined): number =>
  Number.isFinite(v) ? Math.min(0.9, Math.max(0, v as number)) : 0;

export function createCaptureAPI(): CaptureAPI {
  return {
    async page(spec: CaptureSpec): Promise<AssetRef> {
      const s = spec ?? ({} as CaptureSpec);
      if (!s.url) throw new Error('capture.page: a url is required');

      let res: NativeCaptureResult;
      try {
        // Rust deserialises this into CaptureSpec (serde rename_all = camelCase),
        // so the keys here must stay camelCase.
        res = await invoke<NativeCaptureResult>('capture_page', {
          spec: {
            url: s.url, width: s.width, height: s.height,
            scrollDepth: s.scrollDepth, rangeTo: s.rangeTo,
            waitMs: s.waitMs, dpr: s.dpr, css: s.css, crop: s.crop,
          },
        });
      } catch (e) {
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
        throw new Error(`Page capture failed: ${msg}`);
      }

      return {
        source: 'remote',
        id: `capture:${s.url}`,
        type: 'raster',
        format: 'png',
        url: `data:image/png;base64,${res.data}`,
        width: res.width,
        height: res.height,
        meta: {
          capturedFrom: s.url,
          // Geometry a tool needs to pan a scroll video over a range strip: the
          // visible frame height, the resolved scroll offset, and the whole page.
          frameHeight: res.frameHeight,
          scrollYPx: res.scrollY,
          pageWidth: res.pageWidth,
          pageHeight: res.pageHeight,
        },
      };
    },

    async vector(spec: CaptureSpec): Promise<AssetRef> {
      const s = spec ?? ({} as CaptureSpec);
      if (!s.url) throw new Error('capture.vector: a url is required');

      let res: NativeVectorResult;
      try {
        res = await invoke<NativeVectorResult>('capture_page_pdf', {
          spec: {
            url: s.url, width: s.width, height: s.height,
            scrollDepth: s.scrollDepth, rangeTo: s.rangeTo,
            waitMs: s.waitMs, dpr: s.dpr, css: s.css, crop: s.crop,
          },
        });
      } catch (e) {
        const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
        throw new Error(`Vector capture failed: ${msg}`);
      }

      // PDF bytes → standalone SVG via the engine's PDF interpreter (lazy: only
      // the vector path pulls in pdf-lib). One printed page, so page index 0.
      const bytes = Uint8Array.from(atob(res.data), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const { openPdfFile } = await import('../../web/src/views/pdf-import.ts');
      const handle = await openPdfFile(blob);
      const page = await handle.pageToSvg(0);
      if (!page.elementCount) {
        throw new Error('Vector capture produced no drawable content - try a raster format.');
      }

      // Window to the requested region. The printed PDF is the WHOLE page; scroll
      // depth / crop / range trim it here, in the SVG's own point space (ratio =
      // svg points ÷ CSS px). page.width/height are points; res.pageWidth/Height
      // are CSS px. When height is omitted and nothing trims, emit the full page.
      const vw = Math.max(1, s.width || res.pageWidth || page.width);
      const crop = s.crop || {};
      const cl = clampInset(crop.left), cr = clampInset(crop.right);
      const ct = clampInset(crop.top), cb = clampInset(crop.bottom);
      const hasCrop = cl || cr || ct || cb;
      const from = resolveScroll(s.scrollDepth, res.pageHeight, s.height ?? res.pageHeight);
      const extra = s.rangeTo != null
        ? Math.max(0, resolveScroll(s.rangeTo, res.pageHeight, s.height ?? res.pageHeight) - from)
        : 0;

      let svg = page.svg;
      let outW = res.pageWidth || page.width;
      let outH = res.pageHeight || page.height;
      const windowed = s.height != null || hasCrop || from > 0 || extra > 0;
      if (windowed) {
        const vh = s.height ?? res.pageHeight;
        const frameW = Math.max(1, vw * (1 - cl - cr));
        const frameH = Math.max(1, vh * (1 - ct - cb));
        const y = Math.min(from + vh * ct, Math.max(0, res.pageHeight - frameH));
        const h = Math.min(frameH + extra, Math.max(frameH, res.pageHeight - y));
        const ratio = page.width / vw; // points per CSS px
        svg = windowPdfSvg(page.svg, {
          x: vw * cl * ratio, y: y * ratio,
          width: frameW * ratio, height: h * ratio,
          outWidth: frameW, outHeight: h,
        });
        outW = frameW;
        outH = h;
      }

      return {
        source: 'remote',
        id: `capture-vector:${s.url}`,
        type: 'vector',
        format: 'svg',
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        width: Math.round(outW),
        height: Math.round(outH),
        meta: {
          capturedFrom: s.url,
          scrollYPx: from,
          pageWidth: res.pageWidth,
          pageHeight: res.pageHeight,
        },
      };
    },
  };
}
