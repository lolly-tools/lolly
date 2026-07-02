// SPDX-License-Identifier: MPL-2.0
/**
 * CaptureAPI (web) — page-to-image capture.
 *
 * The web PWA *cannot* fulfil this capability, and not for want of a library:
 * a browser page cannot read pixels from a cross-origin URL. Frame-busting
 * headers (X-Frame-Options / CSP frame-ancestors) stop most sites rendering in
 * a frame at all, and the tainted-canvas rule blocks pixel readback even for the
 * ones that do render. There is deliberately no page-level API for the final
 * composited framebuffer of content the page doesn't own — that's the same-origin
 * boundary, not a gap.
 *
 * So capture is a native-only capability: the Tauri shell fulfils it with its
 * authoritative native webview; a headless-Chromium CLI build can too. Here we
 * expose a stub that throws a clear, actionable error. Tools that need capture
 * declare the 'capture' capability and the host should disable them in the web
 * shell (see the capability-gating follow-up).
 */

import type { CaptureAPI } from '../../../../engine/src/bridge/host-v1.ts';

export function createCaptureAPI(): CaptureAPI {
  return {
    async page() {
      throw new Error(
        'Page capture isn’t available in the web app — a browser can’t ' +
        'screenshot a cross-origin URL. Use the desktop app to capture URLs.',
      );
    },
  };
}
