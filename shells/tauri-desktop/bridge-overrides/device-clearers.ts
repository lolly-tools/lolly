// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" on the desktop app (plan 277 P2, review S6). The web clear
 * (shells/web/src/lib/clear-all-data.ts) empties the WebView, and the state bridge
 * removes the saved-session files. Two more places live in the app's own folders,
 * outside anything the WebView can reach, and the dialog promises they go too:
 *
 *   - the capture sign-in browser profile: the cookies and site data a person's
 *     "Sign in" window left for URL Screenshot. Removed by `capture_clear_session`,
 *     the same command the tool's own Clear button calls, which also closes a
 *     sign-in window that is still open (src-tauri/src/capture.rs);
 *   - the Reword model files staged under app data. Removed by `reword_clear`,
 *     which deletes that one model folder and nothing else (src-tauri/src/reword.rs).
 *
 * Both are narrow native commands, not filesystem permissions: the fs scope in
 * capabilities/default.json stays limited to saved-state, pack-store and the
 * Downloads subfolder (tests/tauri-security.test.ts).
 *
 * Registered as a side effect of loading: capabilities-provided.ts imports this
 * on every boot, so the clearers exist before anyone can open the dialog.
 */
import { invoke } from '@tauri-apps/api/core';
import { registerDeviceDataClearer } from '../../web/src/lib/device-data-clearers.ts';

registerDeviceDataClearer('capture-profile', async () => { await invoke('capture_clear_session'); });
registerDeviceDataClearer('reword-model', async () => { await invoke('reword_clear'); });
