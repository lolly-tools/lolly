/**
 * CaptureAPI (Tauri desktop) — page-to-image capture.
 *
 * Replaces the web shell's throwing stub (shells/web/src/bridge/capture.js) at
 * build time via vite.config.js resolve.alias. Where a browser page can't
 * screenshot a cross-origin URL, the desktop shell can: it hands the spec to a
 * native Rust command (`capture_page`) that drives a headless Chrome over the
 * DevTools Protocol and returns the PNG bytes.
 *
 * The capture comes back as a data-URL AssetRef so it flows into the normal
 * render/export path (units, format, provenance, watermark) unchanged.
 */

import { invoke } from '@tauri-apps/api/core';

export function createCaptureAPI() {
  return {
    async page(spec) {
      const { url, width, height, scrollDepth, waitMs, dpr, css } = spec ?? {};
      if (!url) throw new Error('capture.page: a url is required');

      let b64;
      try {
        // Rust deserialises this into CaptureSpec (serde rename_all = camelCase),
        // so the keys here must stay camelCase.
        b64 = await invoke('capture_page', {
          spec: { url, width, height, scrollDepth, waitMs, dpr, css },
        });
      } catch (e) {
        const msg = typeof e === 'string' ? e : (e?.message ?? String(e));
        throw new Error(`Page capture failed: ${msg}`);
      }

      return {
        source: 'remote',
        id: `capture:${url}`,
        type: 'raster',
        format: 'png',
        url: `data:image/png;base64,${b64}`,
        width,
        height,
        meta: { capturedFrom: url },
      };
    },
  };
}
