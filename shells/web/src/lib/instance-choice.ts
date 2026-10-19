// SPDX-License-Identifier: MPL-2.0
/**
 * Which shell is this? The isTauriShell/isTauriMobileShell probes most of the web
 * shell imports, from a leaf module that costs the boot path nothing.
 *
 * This module also held the Tauri first-run instance gate: a sheet that asked
 * "Where should Lolly get its tools?" before the first catalog sync. Plan 320 D2
 * retired that gate. The app now boots local like the web app and shows the same
 * welcome; the instance sheet, with its optional backup import, opens from Settings
 * only (views/profile/chrome.ts). An organisation gets someone connected from the
 * start with a link in their invite, not a first-launch question.
 */
export { isTauriShell, isTauriMobileShell } from './native-shell.ts';
