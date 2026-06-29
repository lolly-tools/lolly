// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of the v1 capability bridge.
 *
 * Each capability is in its own file; this index composes them. This makes it
 * easy to swap individual implementations (e.g. test doubles) without touching
 * the rest.
 */

import { createStateAPI } from './state.js';
import { createProfileAPI } from './profile.js';
import { createPreviewsAPI } from './previews.js';
import { createAssetsAPI } from './assets.js';
import { createTokensAPI } from './tokens.js';
import { createClipboardAPI } from './clipboard.js';
import { createExportAPI } from './export.js';
import { createComposeAPI } from './compose.js';
import { createNetAPI } from './net.js';
import { createTextAPI } from './text.js';
import { createPdfAPI } from './pdf.js';
import { createCaptureAPI } from './capture.js';
import { createMediaAPI } from './media.js';
import { hasCaptureExtension, createExtensionCaptureAPI } from './capture-extension.js';
import { PROVIDED_CAPABILITIES } from './capabilities-provided.js';
import { openDB } from './db.js';

export async function createBridge() {
  const db = await openDB();

  // Best-effort: ask the browser to keep our local data durable so it's less
  // likely to be evicted under storage pressure (matters most on iOS/Safari).
  // Heuristic and silent in most browsers; never blocks startup.
  if (navigator.storage?.persist) {
    navigator.storage.persisted?.()
      .then(already => (already ? null : navigator.storage.persist()))
      .catch(() => {});
  }

  // The Lolly Chrome extension (if installed) provides page capture in the browser.
  // It's detected synchronously via a flag it sets at document_start, so this adds
  // no startup cost. When present, the 'capture' capability un-greys URL Screenshot.
  const extCapture = hasCaptureExtension();

  const host = {
    version: '1',
    shell: 'web',
    // What this shell can fulfil. Tools needing anything outside this set (e.g.
    // 'capture') are gated in the gallery and tool view. Other shells override
    // capabilities-provided.js to declare their own set.
    capabilities: extCapture ? [...PROVIDED_CAPABILITIES, 'capture'] : PROVIDED_CAPABILITIES,
    log: (level, msg, ctx) => console[level === 'debug' ? 'log' : level](`[${level}]`, msg, ctx ?? ''),
  };

  // Order matters: assets depends on db; export depends on host for watermark style.
  host.state = createStateAPI(db);
  host.profile = createProfileAPI(db);
  // Web-only host-UI helper (not in the tool-facing contract): cache of
  // profile-personalized gallery thumbnails. The gallery feature-detects it.
  host.previews = createPreviewsAPI(db);
  host.assets = createAssetsAPI(db);
  host.tokens = createTokensAPI(host); // depends on assets (reads the brand tokens asset)
  host.clipboard = createClipboardAPI();
  host.export = createExportAPI(host);
  // Compose depends on host (it renders child tools through the same bridge), so
  // it's wired after export — the child render goes through runtime.export.
  host.compose = createComposeAPI(host);
  host.net = createNetAPI({ allowlist: [] }); // populated per-tool from manifest
  host.text = createTextAPI();
  host.pdf = createPdfAPI(); // on-device PDF metadata inspect + strip (pdf-lib, lazy-loaded)
  // Extension when installed (real capture in the browser); otherwise the stub
  // that throws a clear error. In Tauri, capture.js is overridden to the native impl.
  host.capture = extCapture ? createExtensionCaptureAPI() : createCaptureAPI();
  // Live camera frames (v1.4) for motion-reactive tools. Progressive enhancement,
  // NOT a gated capability: a tool with an onFrame hook offers a "live" toggle only
  // where the camera is available, and runs as a still tool otherwise.
  host.media = createMediaAPI();

  // pick is a bridge-level concern: it needs the full host (logging, assets.get,
  // assets._uploadUserAsset). Defined here after all sub-APIs are wired so the
  // closure over `host` is complete by the time pick() is actually called.
  host.assets.pick = async (opts) => {
    const { openPicker } = await import('../views/picker.js');
    return openPicker(host, opts);
  };

  return host;
}
