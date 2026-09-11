// SPDX-License-Identifier: MPL-2.0
/**
 * Capabilities the Tauri desktop shell fulfils - overrides the web set
 * (shells/web/src/bridge/capabilities-provided.ts) at build time via the
 * resolveId override in vite.config.js.
 *
 * Genuine SUPERSET of the web set: the native shell adds page capture (headless
 * Chrome, see bridge-overrides/capture.ts) and real filesystem access
 * (tauri-plugin-fs, see bridge-overrides/state.ts) ON TOP of everything web
 * provides. It must spread the web list (not re-list it) so a web-side addition
 * - e.g. `compose`, which the desktop shell wires via the shared bridge/index.ts
 * - can never silently go missing here and gate that tool off "desktop only" on
 * the desktop itself.
 *
 * The ONE subtraction is 'screen' (engine v1.54): display capture is getDisplayMedia,
 * and wry's webviews don't grant it out of the box - WKWebView needs the host app to
 * answer a display-capture permission delegate, which this shell doesn't implement, so
 * the promise would simply reject. Advertising it would un-grey screencap on desktop
 * and fail at the tap - the exact trap the mobile override documents for 'capture'.
 * Drop this filter once a wry shell actually answers the picker; the bridge code is
 * shared with web and needs no change, only the permission plumbing.
 */
import type { Capability } from '@lolly-tools/core/host-v1';
// Side effect on purpose: this override loads with the bridge on every boot,
// which makes it the one guaranteed-early spot to install the portal-backed
// window.EyeDropper before any colour field wires its buttons (plans/174 #4).
import './eyedropper-shim.ts';
// Three more side-effect installs, here for the same reason (plans/202 WP4.1).
// Each publishes one small global the web shell probes for, so a shell without
// it shows nothing rather than a dead control:
//   __lollyNotify   job-toast's OS notification channel
//   __lollyZoom     the View > Zoom menu's whole-UI zoom
//   __lollyUpdater  the "Check for updates" row in Profile and the Help menu
// They are not entries in vite.config.js's override map: that map only fires for
// a module imported from inside bridge/, and their callers live in lib/ and views/.
import './notify.ts';
import './zoom.ts';
import './updater.ts';
import { PROVIDED_CAPABILITIES as WEB_CAPABILITIES } from '../../web/src/bridge/capabilities-provided.ts';

export const PROVIDED_CAPABILITIES: readonly Capability[] = [...WEB_CAPABILITIES.filter(c => c !== 'screen'), 'filesystem', 'capture'];
