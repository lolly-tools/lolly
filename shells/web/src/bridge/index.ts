// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of the v1 capability bridge.
 *
 * Each capability is in its own file; this index composes them. This makes it
 * easy to swap individual implementations (e.g. test doubles) without touching
 * the rest.
 */

import type { WebAssetPickerOpts } from './assets.ts';
import type { HostV1, AssetRef } from '../../../../engine/src/bridge/host-v1.ts';
import { createStateAPI } from './state.ts';
import type { WebStateAPI } from './state.ts';
import { createProfileAPI } from './profile.ts';
import type { WebProfileAPI } from './profile.ts';
import { createPreviewsAPI } from './previews.ts';
import type { PreviewsAPI } from './previews.ts';
import { createAssetsAPI } from './assets.ts';
import type { WebAssetsAPI } from './assets.ts';
import { createTokensAPI } from './tokens.ts';
import type { WebTokensAPI } from './tokens.ts';
import { createClipboardAPI } from './clipboard.ts';
import type { WebClipboardAPI } from './clipboard.ts';
import { createExportAPI } from './export/index.ts';
import type { WebExportAPI } from './export/index.ts';
import { createComposeAPI } from './compose.ts';
import type { WebComposeAPI } from './compose.ts';
import { createNetAPI } from './net.ts';
import { createTextAPI } from './text.ts';
import { createPdfAPI } from './pdf.ts';
import { createCaptureAPI } from './capture.ts';
import { createMediaAPI } from './media.ts';
import { hasCaptureExtension, createExtensionCaptureAPI } from './capture-extension.ts';
import { PROVIDED_CAPABILITIES } from './capabilities-provided.ts';
import { openDB } from './db.ts';

/**
 * The web shell's full host surface: HostV1 with every optional capability
 * this shell actually provides made concrete, plus the web-only `previews`
 * helper (not part of the tool-facing v1 contract — see previews.ts).
 */
export interface WebHost extends HostV1 {
  readonly shell: 'web';
  state: WebStateAPI;
  profile: WebProfileAPI;
  previews: PreviewsAPI;
  assets: WebAssetsAPI;
  tokens: WebTokensAPI;
  clipboard: WebClipboardAPI;
  export: WebExportAPI;
  compose: WebComposeAPI;
}

export async function createBridge(): Promise<WebHost> {
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

  // Assembled incrementally below: several sub-APIs (tokens, export, compose)
  // close over this exact object and read properties attached to it AFTER
  // their own construction (e.g. export's adapters read host.text lazily, at
  // render time, never at construction — see export/index.ts's comment). That
  // circular, build-as-you-go shape can't be expressed as a single object
  // literal, so `host` is declared once with its final type and populated
  // field by field below; the assertion is sound because nothing reads `host`
  // until createBridge has returned it fully assembled.
  const host = {
    version: '1',
    shell: 'web',
    // What this shell can fulfil. Tools needing anything outside this set (e.g.
    // 'capture') are gated in the gallery and tool view. Other shells override
    // capabilities-provided.ts to declare their own set.
    capabilities: extCapture ? [...PROVIDED_CAPABILITIES, 'capture'] : PROVIDED_CAPABILITIES,
    log: (level, msg, ctx) => console[level === 'debug' ? 'log' : level](`[${level}]`, msg, ctx ?? ''),
  } as WebHost;

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
  host.assets.pick = async (opts: WebAssetPickerOpts): Promise<AssetRef | null> => {
    const { openPicker } = await import('../views/picker.ts');
    return openPicker(host, opts);
  };

  return host;
}
