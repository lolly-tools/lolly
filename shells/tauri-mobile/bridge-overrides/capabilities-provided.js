/**
 * Capabilities the Tauri mobile (iOS / Android) shell fulfils — overrides the web
 * set (shells/web/src/bridge/capabilities-provided.js) at build time via the
 * overrideBridgeModules resolveId plugin in vite.config.js.
 *
 * It is the web set PLUS 'filesystem' (mobile's bridge-overrides/state.js is
 * backed by tauri-plugin-fs, exactly like the desktop override), and DELIBERATELY
 * WITHOUT 'capture'. Page capture on desktop is native headless-Chrome
 * (shells/tauri-desktop/bridge-overrides/capture.js); mobile ships no such
 * implementation, so it inherits the web capture.js STUB, which throws. Advertising
 * 'capture' here would un-grey url-shot and let it fail at runtime — so it must be
 * absent. Spread the web list (don't re-list it) so a web-side addition — e.g.
 * `compose` — can never silently go missing here and gate that tool off on mobile.
 */
import { PROVIDED_CAPABILITIES as WEB_CAPABILITIES } from '../../web/src/bridge/capabilities-provided.js';

export const PROVIDED_CAPABILITIES = [...WEB_CAPABILITIES, 'filesystem'];
