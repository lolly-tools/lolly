// SPDX-License-Identifier: MPL-2.0
/**
 * Desktop export override.
 *
 * The web export API delivers a finished file with `URL.createObjectURL(blob)` +
 * an `<a download>` click (see shells/web/src/bridge/export.ts `download`). A
 * browser turns that into a download; WKWebView hands the navigation to wry, which
 * CANCELS it outright unless a native download handler is registered:
 *
 *   // wry-0.55.1 src/wkwebview/navigation.rs, navigation_policy()
 *   if should_download {
 *     if has_download_handler { ...Policy::Download } else { ...Policy::Cancel }
 *   }
 *
 * `has_download_handler` is `attributes.download_started_handler.is_some()`, and we
 * register none - so every export was silently cancelled on desktop, the same class
 * of bug as the mobile shell's (which the Android WebView dropped instead).
 *
 * So we wrap the web ExportAPI and replace ONLY `download`/`file` (the delivery
 * verbs) with a real save via tauri-plugin-fs. `render()` and everything else are
 * inherited unchanged - the rasteriser is identical. Files land in the user's real
 * Downloads (a "Lolly" subfolder); the user gets a toast confirming.
 *
 * Unlike mobile - where Downloads is an app-private dir only we write to - macOS
 * BaseDirectory.Download is the user's own shared ~/Downloads. So we de-collide
 * rather than overwrite, matching both browser and wry's native download semantics
 * ("qr.png" → "qr (1).png").
 */
import { createExportAPI as createWebExportAPI } from '../../web/src/bridge/export.ts';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { basename, dirname, downloadDir, join } from '@tauri-apps/api/path';

// Seeded by the native side (src-tauri/src/cli.rs build_init_script) ONLY when the
// binary was invoked as a headless CLI render. Absent for every GUI launch, so the
// download/file paths below are byte-identical to before unless a CLI job is running.
declare global {
  interface Window {
    __LOLLY_CLI__?: { output?: string | null; stdout?: boolean };
    __LOLLY_DESKTOP_EXPORT__?: { requestSaveAs(): void; cancelSaveAs(): void };
  }
}

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

const SUBDIR = 'Lolly';
const BASE = { baseDir: BaseDirectory.Download };
const LAST_SAVE_DIR = 'lolly-desktop-last-save-dir';
let saveAsNext = false;

// The web export panel feature-detects this bridge to add its desktop-only
// secondary action. One-shot by construction: a cancelled dialog never makes a
// later unrelated download prompt unexpectedly.
window.__LOLLY_DESKTOP_EXPORT__ = {
  requestSaveAs() { saveAsNext = true; },
  cancelSaveAs() { saveAsNext = false; },
};

// Keep only filesystem-safe characters; never let a tool-supplied name traverse.
const sanitize = (name: string | undefined): string =>
  String(name || 'lolly-export').replace(/[^\w.\- ]+/g, '_') || 'lolly-export';

// Split at the LAST dot so "a.tar.gz" → ["a.tar", ".gz"] and a dotfile keeps its
// leading dot as part of the stem (".env" → [".env", ""], never ["", ".env"]).
function splitExt(name: string): [string, string] {
  const i = name.lastIndexOf('.');
  return i > 0 ? [name.slice(0, i), name.slice(i)] : [name, ''];
}

/**
 * First free "name (n).ext" in Downloads/Lolly, browser-style. Bounded: after
 * MAX_TRIES we fall through to the plain name and let it overwrite rather than
 * loop forever on a pathological directory.
 */
async function freeName(name: string): Promise<string> {
  const MAX_TRIES = 100;
  const [stem, ext] = splitExt(name);
  for (let n = 0; n < MAX_TRIES; n++) {
    const candidate = n === 0 ? name : `${stem} (${n})${ext}`;
    if (!(await exists(`${SUBDIR}/${candidate}`, BASE))) return candidate;
  }
  return name;
}

function toast(
  message: string,
  isError?: boolean,
  actions: Array<{ label: string; run(): void | Promise<void> }> = [],
): void {
  try {
    const t = document.createElement('div');
    const copy = document.createElement('span');
    copy.textContent = message;
    t.appendChild(copy);
    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.label;
      button.style.cssText = 'margin-left:12px;border:0;border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.14);color:inherit;font:inherit;cursor:pointer';
      button.addEventListener('click', () => { void action.run(); });
      t.appendChild(button);
    }
    t.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);' +
      'z-index:2147483647;padding:12px 18px;border-radius:12px;max-width:90vw;text-align:center;' +
      'font:14px/1.35 SUSE,system-ui,-apple-system,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35);' +
      (isError ? 'background:#7a1f1f;color:#fff' : 'background:#0c322c;color:#eafff4');
    document.body.appendChild(t);
    // Action toasts stay long enough to read and reach; plain confirmations remain
    // brief so repeated batch exports do not leave chrome hanging over the canvas.
    const lifetime = actions.length ? 6500 : 2800;
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, lifetime);
  } catch { /* no DOM - nothing to show */ }
}

async function noteAndOfferReveal(path: string, message: string): Promise<void> {
  let noted = false;
  try {
    await invoke('desktop_note_export', { path });
    noted = true;
  } catch { /* save still succeeded; omit an action the native side cannot allow */ }
  toast(message, false, noted ? [{
    label: 'Reveal',
    run: async () => {
      try { await invoke('desktop_reveal_export', { path }); }
      catch (err) { toast(`Couldn't reveal that file: ${String(err)}`, true); }
    },
  }] : []);
}

function rememberedSaveDir(): string | null {
  try { return localStorage.getItem(LAST_SAVE_DIR); } catch { return null; }
}

function rememberSaveDir(path: string): void {
  try { localStorage.setItem(LAST_SAVE_DIR, path); } catch { /* device-local nicety */ }
}

async function saveAs(bytes: Uint8Array, filename: string): Promise<void> {
  const fallback = await downloadDir();
  const initialDir = rememberedSaveDir() || fallback;
  const defaultPath = await join(initialDir, filename);
  const ext = splitExt(filename)[1].slice(1).toLowerCase();
  const path = await save({
    title: 'Save Lolly export',
    defaultPath,
    ...(ext ? { filters: [{ name: `${ext.toUpperCase()} file`, extensions: [ext] }] } : {}),
  });
  if (!path) throw new DOMException('Save cancelled', 'AbortError');
  // No baseDir here - `path` can be anywhere the user picked, outside every scope this
  // shell's fs capability declares ($APPDATA/saved-state/**, pack-store/**,
  // $DOWNLOAD/Lolly/**). That is not a gap: `tauri-plugin-dialog`'s `save()` command
  // calls `Scopes::allow_file`/`try_fs_scope().allow_file` on the picked path itself
  // (tauri-plugin-dialog 2.7.2, src/commands.rs, the `save` command) before returning
  // it, which extends the fs scope for THIS SESSION only - it is not persisted to
  // capabilities/default.json and does not survive a restart. Verified 2026-09-05
  // against the vendored crate source at
  // ~/.cargo/registry/src/*/tauri-plugin-dialog-2.7.2/src/commands.rs.
  await writeFile(path, bytes);
  rememberSaveDir(await dirname(path));
  const chosenName = await basename(path);
  await noteAndOfferReveal(path, `Saved “${chosenName}”`);
}

async function saveToDownloads(blob: Blob, filename: string | undefined, host: ExportHost): Promise<void> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const name = sanitize(filename);
  try {
    if (saveAsNext) {
      saveAsNext = false;
      await saveAs(bytes, name);
      host?.log?.('info', `Saved ${name} with the native Save As dialog`);
      return;
    }
    if (!(await exists(SUBDIR, BASE))) {
      await mkdir(SUBDIR, { ...BASE, recursive: true });
    }
    const finalName = await freeName(name);
    await writeFile(`${SUBDIR}/${finalName}`, bytes, BASE);
    host?.log?.('info', `Saved ${finalName} to Downloads/${SUBDIR}`);
    const absolute = await join(await downloadDir(), SUBDIR, finalName);
    await noteAndOfferReveal(absolute, `Saved “${finalName}” to Downloads/${SUBDIR}`);
  } catch (err) {
    saveAsNext = false;
    if ((err as { name?: string })?.name === 'AbortError') throw err;
    host?.log?.('error', 'Desktop export save failed', { error: String(err) });
    toast(`Couldn't save “${name}”: ${err instanceof Error ? err.message : String(err)}`, true);
    throw err;
  }
}

/**
 * Headless-CLI delivery. When the binary is running a `Lolly run <tool>` job (see
 * src-tauri/src/cli.rs), the finished bytes go straight to Rust - which writes them
 * to the path the user asked for (or stdout) - instead of into Downloads. On success
 * `cli_done` ends the process (exit 0); on failure `cli_fail` prints and exits 1.
 * This is what turns the auto-export deep link the CLI navigates to into a file on
 * disk. Bytes cross as a plain number[] (Tauri serialises it to Vec<u8>); fine for
 * the KB–few-MB exports a single CLI render produces.
 */
async function deliverCli(blob: Blob, filename: string): Promise<void> {
  try {
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    await invoke('cli_write', { bytes, filename });
    await invoke('cli_done');
  } catch (err) {
    // cli_write rejected (e.g. unwritable --output). Report and exit non-zero.
    try { await invoke('cli_fail', { message: `export failed: ${err instanceof Error ? err.message : String(err)}` }); } catch { /* process already gone */ }
  }
}

export function createExportAPI(host: ExportHost): WebExportAPI {
  const web = createWebExportAPI(host);
  return {
    ...web,
    async download(blob: Blob, filename: string) {
      if (window.__LOLLY_CLI__) return deliverCli(blob, filename);
      await saveToDownloads(blob, filename, host);
    },
    async file(blob: Blob, opts: { filename?: string } = {}) {
      if (window.__LOLLY_CLI__) return deliverCli(blob, opts.filename || 'file');
      await saveToDownloads(blob, opts.filename || 'file', host);
    },
  };
}
