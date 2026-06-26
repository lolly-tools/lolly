/**
 * Capability gating (shell-agnostic).
 *
 * Tools declare the host abilities they need in tool.json `capabilities`. A shell
 * may run a tool only when it can fulfil EVERY declared capability. The set a
 * shell actually fulfils lives in `bridge/capabilities-provided.js` (overridden
 * per shell) and is surfaced as `host.capabilities` — always pass THAT here, so
 * the same gallery/tool code gates correctly in web, Tauri and CLI alike.
 *
 * Tools whose needs aren't met are surfaced as "desktop only" rather than mounted
 * into a state where their core action throws.
 */

const CAPABILITY_LABELS = {
  capture: 'page capture',
  compose: 'tool composition',
  camera: 'camera access',
  ffmpeg: 'video encoding',
  filesystem: 'file-system access',
  network: 'network access',
  clipboard: 'clipboard access',
  wasm: 'WebAssembly',
};

/**
 * Capabilities a tool needs that the shell can't provide. Empty array ⇒ runnable.
 * If `shellCapabilities` is absent the host hasn't declared a set, so gating is
 * skipped (nothing is hidden) — matching the HostV1 contract.
 * @param {string[]|undefined} toolCapabilities   from the tool manifest / index
 * @param {readonly string[]|undefined} shellCapabilities  host.capabilities
 */
export function unmetCapabilities(toolCapabilities, shellCapabilities) {
  if (!Array.isArray(toolCapabilities) || toolCapabilities.length === 0) return [];
  if (!Array.isArray(shellCapabilities)) return [];
  const have = new Set(shellCapabilities);
  return toolCapabilities.filter(c => !have.has(c));
}

/** Human-readable label for a capability id, for user-facing messaging. */
export function capabilityLabel(c) {
  return CAPABILITY_LABELS[c] ?? c;
}

// Where to send Chromium users to install the capture extension. Points at the
// info-site install page (load-unpacked steps now; a Web Store button later).
export const CAPTURE_EXTENSION_URL = '/info/extension.html';

/** True for Chromium-family browsers (Chrome, Edge, Brave, Arc, Opera, …). */
export function isChromium() {
  if (typeof navigator === 'undefined') return false;
  const brands = navigator.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length) {
    return brands.some(b => /Chromium/i.test(b.brand));
  }
  // Fallback for browsers without UA-Client-Hints: window.chrome exists in
  // Chromium browsers but not Firefox/Safari.
  return typeof window !== 'undefined' && !!window.chrome && !/firefox/i.test(navigator.userAgent);
}

/**
 * How a tool can run in THIS shell/browser:
 *   'ok'          — all capabilities met; render normally.
 *   'install'     — only missing 'capture', on a Chromium browser → offer the
 *                   capture extension (it can fulfil capture in-browser).
 *   'unavailable' — missing a capability we can't offer here (capture on
 *                   Firefox/Safari, or any other capability) → desktop-only.
 */
export function toolSupport(tool, shellCapabilities) {
  const unmet = unmetCapabilities(tool?.capabilities, shellCapabilities);
  if (unmet.length === 0) return { status: 'ok', unmet };
  if (unmet.length === 1 && unmet[0] === 'capture' && isChromium()) {
    return { status: 'install', unmet };
  }
  return { status: 'unavailable', unmet };
}
