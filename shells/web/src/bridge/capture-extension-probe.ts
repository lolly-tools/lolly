// SPDX-License-Identifier: MPL-2.0
/**
 * "Is the Lolly Chrome extension here, and what can it do?" - the synchronous
 * announcement half of `bridge/capture-extension.ts`, split into its own leaf.
 *
 * WHY IT IS A SEPARATE FILE. The extension sets `window.__lollyCapture` at
 * document_start, so detection is two property reads and costs nothing. But the
 * DECISION is made at boot (`bridge/index.ts` picks the extension impl vs the
 * stub before the lazy `host.capture` facade exists, and the Design System studio
 * decides whether the Website source tile exists at all), while the TRANSPORT it
 * gates - the postMessage relay, the request/reply plumbing, the site-read
 * decoder - is only ever used behind a user gesture. Importing the probe from the
 * transport module put the whole ~2.5 KB of transport in the boot chunk to answer
 * a boolean. Same leaf-import discipline as `lib/viz-support.ts` (host.viz's sync
 * `isAvailable` beside a lazy impl) and `engine/src/speech-model-bytes.ts`.
 *
 * `capture-extension.ts` re-exports everything here, so existing importers of that
 * module (which need the transport anyway) are unchanged; only boot-path callers
 * need to reach for this file directly.
 *
 * See shells/chrome-extension/.
 */

/** What the extension announces about itself, synchronously, at document_start. */
export interface LollyCaptureFlag {
  version?: string;
  /**
   * Version of the site-read request/reply shape this extension speaks. Absent on
   * copies older than 0.2.0, which answer screenshots but not site reads - hence a
   * separate announcement rather than one version number for both.
   */
  siteProtocol?: number;
}

declare global {
  interface Window {
    /** Set at document_start by the extension's MAIN-world content script. */
    __lollyCapture?: LollyCaptureFlag | boolean;
  }
}

/** The site-read shape this build speaks. Bump in lockstep with inpage.js. */
export const SITE_PROTOCOL = 1;

/** Synchronous, zero-cost detection - the extension sets this at document_start. */
export function hasCaptureExtension(): boolean {
  return typeof window !== 'undefined' && !!window.__lollyCapture;
}

/**
 * Synchronous, zero-cost detection of the SITE read specifically.
 *
 * Separate from `hasCaptureExtension()` because an installed-but-older extension
 * has the flag and cannot do this, and because the studio decides whether the
 * Website source exists at all before it renders - showing a source that cannot
 * run is the thing plan 97 section 9 forbids.
 */
export function hasSiteCapture(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = window.__lollyCapture;
  if (!flag || typeof flag !== 'object') return false;
  return typeof flag.siteProtocol === 'number' && flag.siteProtocol >= SITE_PROTOCOL;
}
