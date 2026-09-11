// SPDX-License-Identifier: MPL-2.0
/**
 * Mobile export override.
 *
 * The web export API delivers a finished file with `URL.createObjectURL(blob)` +
 * an `<a download>` click (see shells/web/src/bridge/export.ts `download`). A
 * browser turns that into a download; the Android WebView has no download handler,
 * so the click is silently dropped - every export/download on mobile no-ops.
 *
 * So we wrap the web ExportAPI and replace ONLY `download`/`file` (the delivery
 * verbs) with a real save via tauri-plugin-fs. `render()` and everything else are
 * inherited unchanged - the rasteriser is identical. The save lands in a "Lolly"
 * subfolder - Downloads on Android (the app-private external files dir), the app
 * DOCUMENTS dir on iOS, where UIFileSharingEnabled + LSSupportsOpeningDocumentsInPlace
 * (Info.plist, plans/132 wave 1) surface it in the Files app - and then the OS
 * share sheet is offered:
 *   Android: the `LollyShare` JS interface MainActivity registers
 *            (ACTION_SEND + FileProvider).
 *   iOS:     the Web Share API (navigator.share with the file), which WKWebView
 *            forwards to the native sheet. Feature-detected; share() also needs
 *            LIVE user activation, which a long render can spend - the catch
 *            path degrades to the saved-file toast, never a failed export.
 * Neither present (older builds) → the saved-toast behaviour.
 */
import { createExportAPI as createWebExportAPI } from '../../web/src/bridge/export.ts';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';

// This override REPLACES the whole web export module for every importer inside
// bridge/, not just for the bridge index - so it must carry that module's full
// public surface, or a sibling importing one of its other exports fails the build
// (export-pptx.ts pulls rasterizeNodeToDataUrl, _host, pureRotationDeg, …).
// The star re-export forwards LIVE bindings, which `_host` (an `export let` the
// web createExportAPI assigns) depends on; our local createExportAPI below
// shadows the starred one per ES module semantics.
export * from '../../web/src/bridge/export.ts';

/**
 * The host and the API shape are DERIVED from the web factory this override wraps,
 * rather than restated. The override must remain substitutable for the web module
 * (the resolveId plugin swaps it in for every importer inside bridge/), so a change
 * to the web signature has to fail here at typecheck instead of at runtime in a
 * webview. `WebHost` itself is not exported by the web module, hence Parameters<>.
 */
type ExportHost = Parameters<typeof createWebExportAPI>[0];
type WebExportAPI = ReturnType<typeof createWebExportAPI>;

/**
 * The `ACTION_SEND` bridge MainActivity registers on the Android WebView via
 * `addJavascriptInterface`. Absent on iOS and on older builds, so every call site
 * must feature-detect - see shareSheet below.
 */
interface LollyShareBridge {
  shareFile(relPath: string, mime: string, title: string): boolean;
}
declare global {
  interface Window {
    LollyShare?: LollyShareBridge;
  }
}

const SUBDIR = 'Lolly';

/** iOS detection for the two per-platform choices below (save dir + share
 *  transport). The WKWebView UA carries iPhone/iPad; iPadOS 13+ may
 *  masquerade as Macintosh, which the touch-points check catches. */
const IS_IOS = typeof navigator !== 'undefined'
  && (/iP(hone|ad|od)/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** Where saves land: iOS Documents (exposed in the Files app via Info.plist),
 *  Downloads elsewhere. */
const SAVE_BASE = IS_IOS ? BaseDirectory.Document : BaseDirectory.Download;
const savedPlace = (): string => (IS_IOS ? `Files → ${SUBDIR}` : `Downloads/${SUBDIR}`);

// Keep only filesystem-safe characters; never let a tool-supplied name traverse.
const sanitize = (name: string | undefined): string =>
  String(name || 'lolly-export').replace(/[^\w.\- ]+/g, '_') || 'lolly-export';

function toast(message: string, isError?: boolean): void {
  try {
    const t = document.createElement('div');
    t.textContent = message;
    t.style.cssText =
      'position:fixed;left:50%;bottom:calc(24px + var(--safe-bottom));transform:translateX(-50%);' +
      'z-index:2147483647;padding:12px 18px;border-radius:12px;max-width:90vw;text-align:center;' +
      'font:14px/1.35 SUSE,system-ui,-apple-system,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);' +
      (isError ? 'background:#7a1f1f;color:#fff' : 'background:#0c322c;color:#eafff4');
    document.body.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2800);
  } catch { /* no DOM - nothing to show */ }
}

/** Offer the Android share sheet for a just-saved export. Returns true when the
 *  native bridge accepted (chooser opening); false = no bridge or share failed. */
function shareSheet(relPath: string, mime: string, title: string): boolean {
  try {
    const bridge = typeof window !== 'undefined' ? window.LollyShare : null;
    if (!bridge || typeof bridge.shareFile !== 'function') return false;
    return bridge.shareFile(relPath, String(mime || ''), String(title || '')) === true;
  } catch {
    return false;
  }
}

/** Whether the iOS Web Share path exists here (WKWebView forwards
 *  navigator.share to the native sheet; file payloads need canShare). */
function webShareAvailable(): boolean {
  return IS_IOS
    && typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function';
}

/** iOS: hand the just-saved export to the native share sheet via the Web Share
 *  API. Returns true when the sheet ran (completed OR user-cancelled - the file
 *  is saved either way, so a cancel is a handled outcome, not a failure).
 *  False = unavailable / payload refused / activation expired → caller toasts
 *  the saved location instead. */
async function webShare(blob: Blob, name: string, mime: string): Promise<boolean> {
  if (!webShareAvailable()) return false;
  try {
    const file = new File([blob], name, { type: mime || 'application/octet-stream' });
    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: name });
    return true;
  } catch (err) {
    // AbortError = the person closed the sheet; the export is saved, done.
    // Anything else (NotAllowedError when a long render spent the user
    // activation) degrades to the saved-file toast.
    return (err as Error)?.name === 'AbortError';
  }
}

async function saveToDownloads(blob: Blob, filename: string | undefined, host: ExportHost): Promise<void> {
  const name = sanitize(filename);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  try {
    if (!(await exists(SUBDIR, { baseDir: SAVE_BASE }))) {
      await mkdir(SUBDIR, { baseDir: SAVE_BASE, recursive: true });
    }
    await writeFile(`${SUBDIR}/${name}`, bytes, { baseDir: SAVE_BASE });
    host?.log?.('info', `Saved ${name} to ${savedPlace()}`);
    if (shareSheet(`${SUBDIR}/${name}`, blob.type, name)) {
      toast(`Saved “${name}” - choose where to send it`);
    } else if (await webShare(blob, name, blob.type)) {
      // The iOS sheet was the feedback; no toast on top of it.
    } else {
      toast(`Saved “${name}” to ${savedPlace()}`);
    }
  } catch (err) {
    host?.log?.('error', 'Mobile export save failed', { error: String(err) });
    toast(`Couldn't save “${name}”: ${err instanceof Error ? err.message : String(err)}`, true);
    throw err;
  }
}

export function createExportAPI(host: ExportHost): WebExportAPI {
  const web = createWebExportAPI(host);
  return {
    ...web,
    async download(blob: Blob, filename: string) { await saveToDownloads(blob, filename, host); },
    async file(blob: Blob, opts: { filename?: string } = {}) { await saveToDownloads(blob, opts.filename || 'file', host); },
    // Native OS share. Android's ACTION_SEND needs the bytes persisted first, so this is
    // the same save-to-Downloads path - which already offers the native chooser via
    // shareSheet(). Returns true unconditionally: the file is delivered to the device
    // (and the sheet offered when the bridge is present) regardless of whether the chooser
    // actually opened, so the web caller never falls back and double-saves.
    async share(blob: Blob, opts: { filename?: string; mime?: string; title?: string } = {}): Promise<boolean> {
      await saveToDownloads(blob, opts.filename || 'file', host);
      return true;
    },
    // Native share is available where the Android LollyShare bridge is present, or
    // where iOS's Web Share path is (WKWebView → the native sheet). The "Send to…"
    // button gates on this, so it never shows where a tap would only save a file
    // without offering the chooser.
    canShare(): boolean {
      return (typeof window !== 'undefined' && typeof window.LollyShare?.shareFile === 'function')
        || webShareAvailable();
    },
  };
}
