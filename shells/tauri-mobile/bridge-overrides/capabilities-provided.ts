// SPDX-License-Identifier: MPL-2.0
/**
 * Capabilities the Tauri mobile (iOS / Android) shell fulfils - overrides the web
 * set (shells/web/src/bridge/capabilities-provided.ts) at build time via the
 * overrideBridgeModules resolveId plugin in vite.config.js.
 *
 * It is the web set PLUS 'filesystem' (mobile's bridge-overrides/state.ts is
 * backed by tauri-plugin-fs, exactly like the desktop override), and DELIBERATELY
 * WITHOUT 'capture'. Page capture on desktop is native headless-Chrome; mobile
 * ships no working implementation yet, so it inherits the web capture.ts STUB,
 * which throws. Advertising 'capture' here would un-grey url-shot and let it fail
 * at runtime - so it must be absent. Spread the web list (don't re-list it) so a
 * web-side addition - e.g. `compose` - can never silently go missing here and gate
 * that tool off on mobile.
 *
 * IN PROGRESS (url-shot on iOS): the JS half (bridge-overrides/capture.ts) is
 * staged and the Rust draft is at src-tauri/src/capture.rs, but objc2-web-kit's
 * WKWebView is bound against the macOS class hierarchy (super = NSView) and is
 * unavailable on the iOS target - so the native command needs a Swift plugin (or
 * raw objc2 msg_send) before 'capture' can be advertised here (iOS-gated).
 *
 * 'screen' (engine v1.54) is SUBTRACTED for the same reason: display capture is
 * getDisplayMedia, which no mobile webview implements (it is absent on iOS entirely,
 * and Android's WebView does not carry Chrome's picker). Inheriting it from the web
 * set would un-grey screencap on a phone and fail at the tap. Subtract rather than
 * re-list, so the next web-side addition still reaches mobile by default.
 */
import type { Capability } from '@lolly-tools/core/host-v1';
import { PROVIDED_CAPABILITIES as WEB_CAPABILITIES } from '../../web/src/bridge/capabilities-provided.ts';

export const PROVIDED_CAPABILITIES: readonly Capability[] = [...WEB_CAPABILITIES.filter(c => c !== 'screen'), 'filesystem'];
