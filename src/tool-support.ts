// SPDX-License-Identifier: MPL-2.0
/**
 * Which tools the TUI can run. With the browser render tier (browser.ts +
 * webshell-render.ts / url-capture.ts) the terminal shell can now produce raster,
 * pdf and video AND capture a live URL via the scoped Chromium - so almost everything
 * runs. The only tools it still can't fulfil need a live capture device the headless
 * browser can't grant: microphone / camera recording.
 *
 * (Chromium itself may not be installed; that surfaces as a clear "run
 * `pnpm run install:browser`" error at export time, not as a hidden tool.)
 */
import type { ToolEntry } from './catalog.ts';

// Capabilities a headless browser genuinely can't provide - device recording. Tools
// that declare these are hidden from the TUI gallery (they need a real device + UI).
const HEADLESS_UNSUPPORTED = new Set(['microphone', 'camera']);

export type ToolSupport = 'ok' | 'needs-file' | 'browser-only';

export function toolSupport(t: ToolEntry): ToolSupport {
  if (t.fileTransform) return 'needs-file';
  const caps = t.capabilities ?? [];
  // Needs a recording device (mic/camera) the headless browser can't open → hidden.
  if (caps.some(c => HEADLESS_UNSUPPORTED.has(c))) return 'browser-only';
  return 'ok';
}

export const isBrowserOnly = (t: ToolEntry): boolean => toolSupport(t) === 'browser-only';
