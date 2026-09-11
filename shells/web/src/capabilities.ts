// SPDX-License-Identifier: MPL-2.0
/**
 * Capability gating (shell-agnostic).
 *
 * Tools declare the host abilities they need in tool.json `capabilities`. A shell
 * may run a tool only when it can fulfil EVERY declared capability. The set a
 * shell actually fulfils lives in `bridge/capabilities-provided.js` (overridden
 * per shell) and is surfaced as `host.capabilities` - always pass THAT here, so
 * the same gallery/tool code gates correctly in web, Tauri and CLI alike.
 *
 * Tools whose needs aren't met are surfaced as "desktop only" rather than mounted
 * into a state where their core action throws.
 */
import type { Capability } from '@lolly-tools/core/host-v1';

const CAPABILITY_LABELS: Record<Capability, string> = {
  capture: 'page capture',
  compose: 'tool composition',
  camera: 'camera access',
  microphone: 'microphone access',
  screen: 'screen capture',
  ffmpeg: 'video encoding',
  filesystem: 'file-system access',
  network: 'network access',
  clipboard: 'clipboard access',
  wasm: 'WebAssembly',
};

/**
 * Capabilities a tool needs that the shell can't provide. Empty array ⇒ runnable.
 * If `shellCapabilities` is absent the host hasn't declared a set, so gating is
 * skipped (nothing is hidden) - matching the HostV1 contract.
 * @param toolCapabilities   from the tool manifest / index
 * @param shellCapabilities  host.capabilities
 */
export function unmetCapabilities(
  toolCapabilities: readonly string[] | undefined,
  shellCapabilities: readonly string[] | undefined,
): string[] {
  if (!Array.isArray(toolCapabilities) || toolCapabilities.length === 0) return [];
  if (!Array.isArray(shellCapabilities)) return [];
  const have = new Set(shellCapabilities);
  return toolCapabilities.filter(c => !have.has(c));
}

/** Human-readable label for a capability id, for user-facing messaging. */
export function capabilityLabel(c: string): string {
  const labels: Record<string, string> = CAPABILITY_LABELS;
  return labels[c] ?? c;
}

/** True for Chromium-family browsers (Chrome, Edge, Brave, Arc, Opera, …). */
export function isChromium(): boolean {
  if (typeof navigator === 'undefined') return false;
  // UA-Client-Hints and window.chrome are Chromium-only, so lib.dom doesn't
  // declare them; widen via optional properties (no cast, honest absence).
  const nav: Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } } = navigator;
  const brands = nav.userAgentData?.brands;
  if (Array.isArray(brands) && brands.length) {
    return brands.some(b => /Chromium/i.test(b.brand));
  }
  // Fallback for browsers without UA-Client-Hints: window.chrome exists in
  // Chromium browsers but not Firefox/Safari.
  return typeof window !== 'undefined' &&
         !!(window as Window & { chrome?: unknown }).chrome &&
         !/firefox/i.test(navigator.userAgent);
}

/** The outcome of gating one tool against a shell's capabilities. */
export interface ToolSupport {
  status: 'ok' | 'install' | 'unavailable';
  unmet: string[];
}

/**
 * How the Design System studio's website source stands on THIS device
 * (plan 97 section 9). The same three-verdict vocabulary `toolSupport` uses, for a
 * feature that is gated by a transport rather than by a tool manifest:
 *
 *   'ready' - a transport exists (a Tauri shell's native fetch, or the
 *                   Lolly extension), so a page can actually be read.
 *   'install' - a Chromium browser with no transport: the extension can
 *                   fulfil this, exactly as it can fulfil `capture`.
 *   'unavailable' - anywhere else. There is no third transport to add later:
 *                   section 9's decision is that Lolly runs no fetching service, and
 *                   the deployed PWA's CSP cannot reach an arbitrary origin at
 *                   all, so this verdict is settled rather than pending.
 *
 * WHAT EACH VERDICT IS ALLOWED TO RENDER is the part worth writing down. Only
 * 'ready' puts a Website tile in the source picker - a disabled tile, or a
 * "get the app" teaser where the feature cannot run, is the dark pattern section 9
 * forbids. 'install' is documented on the capabilities surface
 * (lib/capabilities-data.ts → #/d?tab=caps), the same place every other gated
 * capability explains its unlock, so somebody who wants it can find out how and
 * nobody else ever trips over it.
 *
 * Transport DETECTION is not this module's business - it needs the host bridge,
 * and this file stays shell-agnostic - so the caller passes what it found
 * (lib/design-system/sources/website.ts's `detectSiteTransport`).
 */
export interface SiteIngestSupport {
  status: 'ready' | 'install' | 'unavailable';
}

export function siteIngestSupport(hasTransport: boolean): SiteIngestSupport {
  if (hasTransport) return { status: 'ready' };
  return { status: isChromium() ? 'install' : 'unavailable' };
}

/**
 * How a tool can run in THIS shell/browser:
 *   'ok' - all capabilities met; render normally.
 *   'install' - only missing 'capture', on a Chromium browser → offer the
 *                   capture extension (it can fulfil capture in-browser).
 *   'unavailable' - missing a capability we can't offer here (capture on
 *                   Firefox/Safari, or any other capability) → desktop-only.
 */
export function toolSupport(
  tool: { capabilities?: readonly string[]; requires?: readonly string[] } | null | undefined,
  shellCapabilities: readonly string[] | undefined,
  hostApis?: readonly string[],
): ToolSupport {
  const unmet = unmetCapabilities(tool?.capabilities, shellCapabilities);
  // Manifest `requires` (optional host.* APIs the tool calls unguarded): when
  // the caller says what this host provides, a missing one makes the tool
  // unavailable here, the same way a missing device capability does. Absent
  // ⇒ not gated, like shellCapabilities.
  if (hostApis && tool?.requires?.length) {
    const present = new Set(hostApis);
    for (const api of tool.requires) if (!present.has(api)) unmet.push(`host.${api}`);
  }
  if (unmet.length === 0) return { status: 'ok', unmet };
  if (unmet.length === 1 && unmet[0] === 'capture' && isChromium()) {
    return { status: 'install', unmet };
  }
  return { status: 'unavailable', unmet };
}

/**
 * Whether /batch can run this tool as a row (plans/147 M1, the "Bulk from rows"
 * gate). Three conditions, and all three are the batch's OWN admission test
 * restated: the grid only lists tools the index marks `exportable`
 * (scripts/build-catalog-index.ts: `render.export !== false` AND at least one
 * format) and only those the shell can fulfil every capability of
 * (`shellCanRun` in pro/index.ts), and a row can only fill fields the tool
 * declares.
 *
 * A gate that skipped the capability half would offer "Bulk from rows" on a
 * `capture` tool in a plain browser and land the user on an empty grid: the
 * batch hides that tool, so the deep link seeds nothing. Live case: url-shot on
 * Chromium without the extension, which the tool view mounts anyway
 * (toolSupport 'install').
 */
export function canBatchTool(
  manifest: {
    inputs?: readonly unknown[];
    render?: { export?: boolean; formats?: readonly string[] };
    capabilities?: readonly string[];
  } | null | undefined,
  shellCapabilities: readonly string[] | undefined,
): boolean {
  if (!manifest) return false;
  return (manifest.inputs?.length ?? 0) > 0
    && manifest.render?.export !== false
    && (manifest.render?.formats?.length ?? 0) > 0
    && toolSupport(manifest, shellCapabilities).status === 'ok';
}

/**
 * plans/147 M2 - "Bulk from files". A file-transform tool (file in → file out) can
 * be looped over N picked files, each set on the live runtime, exported through the
 * exportFile hook, and packed into one zip. Returns the id of the sole single-file
 * input, or null when the shape does not fit: no file input, more than one, or a
 * `multiple` file input (which already takes N files in ONE render, so it is not a
 * per-file loop). The exportFile half is a runtime fact, checked at the call site
 * via `runtime.hasExportFile` - a manifest cannot state which hooks it defines.
 */
export function singleFileInputId(
  manifest: {
    inputs?: readonly { id?: string; type?: string; multiple?: boolean }[];
    render?: { export?: boolean };
  } | null | undefined,
): string | null {
  // Only a pure file-in → file-out transform qualifies: its sole export IS the
  // exportFile hook, so it declares `render.export: false` (no canvas export). That
  // excludes a render tool that merely takes a secondary file - darkroom's optional
  // LUT upload, 3d's model - where the file is not the thing that would be looped.
  if (manifest?.render?.export !== false) return null;
  const files = (manifest?.inputs ?? []).filter((i) => i.type === 'file');
  if (files.length !== 1 || files[0]!.multiple) return null;
  return typeof files[0]!.id === 'string' ? files[0]!.id : null;
}
