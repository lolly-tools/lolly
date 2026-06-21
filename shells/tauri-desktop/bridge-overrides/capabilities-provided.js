/**
 * Capabilities the Tauri desktop shell fulfils — overrides the web set
 * (shells/web/src/bridge/capabilities-provided.js) at build time via the
 * resolveId override in vite.config.js.
 *
 * Superset of the web set: the native shell adds page capture (headless Chrome,
 * see bridge-overrides/capture.js) and real filesystem access (tauri-plugin-fs,
 * see bridge-overrides/state.js). Without this, the gallery would grey out
 * capture tools as "desktop only" even on the desktop.
 */
export const PROVIDED_CAPABILITIES = ['network', 'clipboard', 'wasm', 'filesystem', 'capture'];
