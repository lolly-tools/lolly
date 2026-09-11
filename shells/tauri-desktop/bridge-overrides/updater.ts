// SPDX-License-Identifier: MPL-2.0
/**
 * Self-update for the desktop shell (plans/202 WP4.1).
 *
 * Wraps tauri-plugin-updater in the smallest surface the web UI needs, published
 * as `window.__lollyUpdater`. shells/web/src/views/profile.ts shows a "Check for
 * updates" row only when that global exists, and the Help menu (src-tauri/src/menu.rs)
 * routes to the same row - so a browser, the mobile shell and a desktop build
 * without the plugin all show nothing rather than a control that cannot work.
 * Installed for its side effect from capabilities-provided.ts, beside the
 * eyedropper shim, for the same reason: it is the one module guaranteed to load
 * with the bridge on every boot.
 *
 * CONSENT IS ASKED TWICE (plans/202 principle 4). `check()` moves no bytes but a
 * few hundred of JSON. Then `download()` runs only on an explicit click, and
 * reports the artifact's real size the moment the server states it. Then
 * `install()` runs only on a second click, because that one replaces the
 * application and restarts it.
 *
 * The size is NOT known before the download starts. The plugin's manifest format
 * carries a URL and a signature per platform and no length, and the Update object
 * does not expose the URL, so there is nothing to ask for a Content-Length ahead
 * of time. The first download event carries it, which is why the progress line
 * shows "<received> of <total>" rather than a size in the confirmation.
 *
 * Signature checking is not optional and not ours: the plugin verifies the
 * artifact's minisign signature against `plugins.updater.pubkey` in
 * tauri.conf.json before it writes anything. A build whose pubkey is still the
 * placeholder fails there, loudly, which is the intended behaviour - see
 * release/build-latest-json.ts, which refuses to publish a manifest against a
 * placeholder key.
 */
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

/** One pending update, already found. Every method may reject; the caller shows
 *  the message. */
export interface ShellUpdate {
  /** The version on the server, e.g. "1.0.7". */
  version: string;
  /** The version running now. */
  currentVersion: string;
  /** Release notes, as the manifest wrote them. May be empty. */
  notes: string;
  /**
   * Fetch the artifact. `onProgress` is called with bytes received and the total
   * the server reported (0 while the total is still unknown). Resolves when the
   * bytes are on disk and verified; nothing is installed yet.
   */
  download(onProgress: (received: number, total: number) => void): Promise<void>;
  /** Replace the app with what download() fetched, then restart. Does not return. */
  install(): Promise<void>;
}

export interface ShellUpdater {
  /** Ask the endpoint. Resolves null when this build is current. */
  check(): Promise<ShellUpdate | null>;
}

const updater: ShellUpdater = {
  async check(): Promise<ShellUpdate | null> {
    const found = await check();
    if (!found) return null;
    let received = 0;
    let total = 0;
    return {
      version: found.version,
      currentVersion: found.currentVersion,
      notes: found.body ?? '',
      async download(onProgress): Promise<void> {
        await found.download((event) => {
          if (event.event === 'Started') {
            received = 0;
            total = event.data.contentLength ?? 0;
          } else if (event.event === 'Progress') {
            received += event.data.chunkLength;
          }
          onProgress(received, total);
        });
      },
      async install(): Promise<void> {
        await found.install();
        await relaunch();
      },
    };
  },
};

(globalThis as { __lollyUpdater?: ShellUpdater }).__lollyUpdater = updater;
