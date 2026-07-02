// SPDX-License-Identifier: MPL-2.0
/**
 * Capability gating (shell-agnostic).
 *
 * Tools declare the host abilities they need in tool.json `capabilities`. A shell
 * may run a tool only when it can fulfil EVERY declared capability. The set a
 * shell actually fulfils lives in `bridge/capabilities-provided.ts` (overridden
 * per shell) and is surfaced as `host.capabilities` — always pass THAT here, so
 * the same gallery/tool code gates correctly in web, Tauri and CLI alike.
 *
 * Tools whose needs aren't met are surfaced as "desktop only" rather than mounted
 * into a state where their core action throws.
 *
 * This module also owns the ENVIRONMENT-gating policy (which browser/device can
 * produce which export formats): each decision is a pure function over an
 * injected probe object, with a thin zero-arg wrapper reading the real
 * `navigator`/`document` for production call sites.
 */
import type { Capability } from '@lolly/engine';

const CAPABILITY_LABELS: Record<Capability, string> = {
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

// Where to send Chromium users to install the capture extension. Points at the
// info-site install page (load-unpacked steps now; a Web Store button later).
export const CAPTURE_EXTENSION_URL = '/info/extension.html';

/** The navigator facts the Chromium-family decision reads. */
export interface ChromiumProbe {
  /** `navigator.userAgentData?.brands` (UA-Client-Hints; Chromium-only today). */
  brands: ReadonlyArray<{ brand: string }> | undefined;
  /** Whether `window.chrome` exists (Chromium browsers, not Firefox/Safari). */
  hasWindowChrome: boolean;
  userAgent: string;
}

/** Pure decision: is this a Chromium-family browser (Chrome, Edge, Brave, Arc, Opera, …)? */
export function isChromiumFor(probe: ChromiumProbe): boolean {
  const brands = probe.brands;
  if (Array.isArray(brands) && brands.length) {
    return brands.some(b => /Chromium/i.test(b.brand));
  }
  // Fallback for browsers without UA-Client-Hints: window.chrome exists in
  // Chromium browsers but not Firefox/Safari.
  return probe.hasWindowChrome && !/firefox/i.test(probe.userAgent);
}

/** True for Chromium-family browsers, read from the real environment. */
export function isChromium(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  // UA-Client-Hints and window.chrome are Chromium-only, so lib.dom doesn't
  // declare them; widen via optional properties (no cast, honest absence).
  const nav: Navigator & { userAgentData?: { brands?: Array<{ brand: string }> } } = navigator;
  const w: Window & { chrome?: unknown } = window;
  return isChromiumFor({
    brands: nav.userAgentData?.brands,
    hasWindowChrome: Boolean(w.chrome),
    userAgent: nav.userAgent,
  });
}

export interface ToolSupport {
  status: 'ok' | 'install' | 'unavailable';
  unmet: string[];
}

/**
 * How a tool can run in THIS shell/browser:
 *   'ok'          — all capabilities met; render normally.
 *   'install'     — only missing 'capture', on a Chromium browser → offer the
 *                   capture extension (it can fulfil capture in-browser).
 *   'unavailable' — missing a capability we can't offer here (capture on
 *                   Firefox/Safari, or any other capability) → desktop-only.
 */
export function toolSupportFor(
  tool: { capabilities?: readonly string[] } | null | undefined,
  shellCapabilities: readonly string[] | undefined,
  chromium: boolean,
): ToolSupport {
  const unmet = unmetCapabilities(tool?.capabilities, shellCapabilities);
  if (unmet.length === 0) return { status: 'ok', unmet };
  if (unmet.length === 1 && unmet[0] === 'capture' && chromium) {
    return { status: 'install', unmet };
  }
  return { status: 'unavailable', unmet };
}

/** `toolSupportFor` with Chromium detection read from the real environment. */
export function toolSupport(
  tool: { capabilities?: readonly string[] } | null | undefined,
  shellCapabilities: readonly string[] | undefined,
): ToolSupport {
  return toolSupportFor(tool, shellCapabilities, isChromium());
}

// ── CMYK TIFF (print) gating ─────────────────────────────────────────────────

/** The environment facts the CMYK-TIFF decision reads. */
export interface CmykTiffProbe {
  /** Canvas pixel readback worked (getImageData not blocked by Tor / Firefox RFP). */
  canvasReadback: boolean;
  userAgent: string;
  /** `navigator.maxTouchPoints` (iPadOS masquerades as Macintosh but is multi-touch). */
  maxTouchPoints: number;
}

/**
 * Pure decision: can this environment both PRODUCE and DELIVER a DeviceCMYK TIFF?
 * Production needs canvas pixel readback (blocked by Tor / Firefox RFP, which
 * breaks every raster export). Delivery is the TIFF-specific catch: the browser
 * can't preview a CMYK TIFF, and mobile Safari / in-app WebViews route blob
 * downloads to an in-page view — a dead end for a non-displayable file. So the
 * format is offered on desktop only, until a previewable / colour-managed path
 * exists. The shell calls this from keepFormat to hide the option where unusable.
 */
export function cmykTiffSupportFor(probe: CmykTiffProbe): boolean {
  if (!probe.canvasReadback) return false;
  const ua = probe.userAgent;
  const touch = probe.maxTouchPoints;
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && touch > 1);
  const mobile = iOS || /Android/.test(ua) || (/Mobi/.test(ua) && touch > 0);
  return !mobile;
}

// Memoised environment read for cmykTiffSupportFor (the probe is not free: it
// draws to a scratch canvas to test pixel readback).
let _cmykTiff: boolean | null = null;
export function cmykTiffSupport(): boolean {
  if (_cmykTiff !== null) return _cmykTiff;
  _cmykTiff = false;
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return _cmykTiff;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    if (!ctx) return _cmykTiff;
    ctx.fillRect(0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);                     // throws if readback is blocked
  } catch { return _cmykTiff; }
  _cmykTiff = cmykTiffSupportFor({
    canvasReadback: true,
    userAgent: navigator.userAgent || '',
    maxTouchPoints: navigator.maxTouchPoints || 0,
  });
  return _cmykTiff;
}

// ── Video (MediaRecorder) gating ─────────────────────────────────────────────

export const WEBM_CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
export const MP4_CODECS  = ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'];

/** The environment facts the video-container decision reads. */
export interface VideoProbe {
  /** MediaRecorder + canvas.captureStream are both present (see `canRecord`). */
  canRecord: boolean;
  /** `MediaRecorder.isTypeSupported` (absent → treat every type as unsupported). */
  isTypeSupported(type: string): boolean;
}

export interface VideoSupport {
  webm: boolean;
  mp4: boolean;
}

// True only if this browser's MediaRecorder pipeline is usable at all (it also
// needs canvas.captureStream).
export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' &&
         typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/**
 * Pure decision: which video containers this browser can actually record.
 * Safari/iOS = mp4 only; Firefox = webm only; recent Chrome = both. The view
 * uses this to gate the format picker so users only see formats their browser
 * can produce.
 */
export function videoSupportFor(probe: VideoProbe): VideoSupport {
  const ok = (t: string) => probe.canRecord && probe.isTypeSupported(t);
  return { webm: WEBM_CODECS.some(ok), mp4: MP4_CODECS.some(ok) };
}

/** `videoSupportFor` read from the real MediaRecorder pipeline. */
export function videoSupport(): VideoSupport {
  return videoSupportFor({
    canRecord: canRecord(),
    isTypeSupported: (t) =>
      typeof MediaRecorder !== 'undefined' && (MediaRecorder.isTypeSupported?.(t) ?? false),
  });
}
