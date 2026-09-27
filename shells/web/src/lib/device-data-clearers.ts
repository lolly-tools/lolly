// SPDX-License-Identifier: MPL-2.0
/**
 * Extra places "Clear all my data" must empty, registered by the shell that owns
 * them (plan 277 P2). The web clear (lib/clear-all-data.ts) empties everything
 * the browser holds for the origin; a Tauri shell also keeps copies OUTSIDE the
 * WebView, in its app-data folder (the mobile upload mirror, for one), and a copy
 * left there would be restored into the WebView on the next launch. Each shell's
 * bridge override registers a clearer for its own folder at module init.
 *
 * A leaf module with no imports, so a bridge override can register without
 * pulling the clear itself (or IndexedDB) onto its boot path.
 */

export interface DeviceDataClearer {
  /** A short name for logs and the clear's report. */
  name: string;
  run(): Promise<void>;
}

const clearers: DeviceDataClearer[] = [];

/** Register a clearer. The same name registered twice replaces the first (HMR). */
export function registerDeviceDataClearer(name: string, run: () => Promise<void>): void {
  const i = clearers.findIndex(c => c.name === name);
  if (i >= 0) clearers.splice(i, 1);
  clearers.push({ name, run });
}

/** Every registered clearer, in registration order. */
export function deviceDataClearers(): readonly DeviceDataClearer[] {
  return [...clearers];
}

/** Tests only: forget every registration. */
export function resetDeviceDataClearersForTests(): void {
  clearers.length = 0;
}
