/**
 * Capabilities the Tauri desktop shell fulfils — overrides the web set
 * (shells/web/src/bridge/capabilities-provided.js) at build time via the
 * resolveId override in vite.config.js.
 *
 * Genuine SUPERSET of the web set: the native shell adds page capture (headless
 * Chrome, see bridge-overrides/capture.js) and real filesystem access
 * (tauri-plugin-fs, see bridge-overrides/state.js) ON TOP of everything web
 * provides. It must spread the web list (not re-list it) so a web-side addition
 * — e.g. `compose`, which the desktop shell wires via the shared bridge/index.js
 * — can never silently go missing here and gate that tool off "desktop only" on
 * the desktop itself.
 */
import { PROVIDED_CAPABILITIES as WEB_CAPABILITIES } from '../../web/src/bridge/capabilities-provided.js';

export const PROVIDED_CAPABILITIES = [...WEB_CAPABILITIES, 'filesystem', 'capture'];
