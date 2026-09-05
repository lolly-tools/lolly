// SPDX-License-Identifier: MPL-2.0
/**
 * @lolly-tools/node-shell - shared plumbing for the Node shells (CLI + TUI).
 *
 * One implementation of the pieces both terminal shells need, so they cannot drift:
 *   repo-root.ts       - LOLLY_ROOT → marker walk → cwd repo-root resolution
 *   browsers.ts        - the scoped headless-Chromium launcher ("Tier B")
 *   browser-tier.ts    - "can a browser do what this host just failed at?", the one
 *                        escalation predicate the CLI, the TUI and MCP all read
 *   webshell-render.ts - drive the built web shell for browser-only formats
 *   raster.ts          - the resvg SVG→PNG fast path ("Tier A") + the format split
 *   c2pa-opts.ts       - the export Content-Credentials payload (incl. profile author)
 *   text.ts            - host.text (HarfBuzz text-to-path), so DOM-free vector output
 *                        outlines text the same as the web shell
 *   audio.ts           - host.audio (WAV + ZzFXM decode, engine analysis), so an
 *                        audio-reactive tool renders headlessly
 *   render-integrity.ts - the fail-loud checkpoint: never write a broken file + exit 0
 *   net.ts             - host.net (the allowlisted fetch + its 64 MB body cap)
 *   pptx.ts            - host.pptx (deck inspect + surgical rebrand, XML parser injected)
 *   pdf-pages.ts       - the pdf-lib page walk that feeds the engine's pure PDF interpreter
 *   inspect.ts         - "what is in this file, and is it safe to share": metadata, PDF
 *                        structure, and text present but not visible (failed redaction)
 *   inspect-render.ts  - the terminal rendering of an inspection, control-char scrubbed
 *
 * net.ts and pptx.ts are also what the WEB shell's bridge uses: they are DOM-free, and
 * shells/web/src/bridge/{net,pptx}.ts re-export them so one matcher and one deck
 * rebrander serve every shell. They used to live in shells/web, which meant the
 * terminal shells could not typecheck without that submodule checked out.
 *
 * Heavy deps (playwright-core, @resvg/resvg-js) are dynamically imported at point of
 * use, so importing this package never pulls a browser or a native module at startup.
 */
export { repoRoot } from './repo-root.ts';
export {
  INSTALL_BROWSERS_DIR, BrowserError, resolveBrowsersDir,
  getBrowser, browserInstalled, closeBrowser,
} from './browsers.ts';
export { needsBrowserTier, NEEDS_BROWSER } from './browser-tier.ts';
export {
  DesktopRendererError, desktopExecutableCandidates, desktopInstalled, desktopRendererReport,
  findDesktopExecutable, launchRenderServer, pingRenderServer, readRenderServer,
  rendererOrder, rendererPreference, rendererStatus, renderServerPath,
  renderThroughRungs, renderViaDesktopCommand, renderViaRenderServer,
} from './desktop-renderer.ts';
export type {
  DesktopRendererReport, RendererAvailability, RendererDrivers, RendererPreference,
  RendererRung, RendererStatus, RenderJob, RenderServer,
} from './desktop-renderer.ts';
export { renderViaWebShell, closeWebShell } from './webshell-render.ts';
export type { RenderDims } from './webshell-render.ts';
export { NODE_FORMATS, pxDims, rasterizeSvgToPng } from './raster.ts';
export type { PxDimsInput } from './raster.ts';
export { buildExportC2paOpts } from './c2pa-opts.ts';
export type { BuildExportC2paOpts, ExportC2paOpts } from './c2pa-opts.ts';
export { createNodeTextAPI } from './text.ts';
export { createNodeAudioAPI, decodeAudioPcm } from './audio.ts';
export type { NodeAudioOptions } from './audio.ts';
export {
  mixSequenceAudio, sequenceMixToWav, mixWindow, limitPlanes, clipGainEvents,
  bedDuckEnvelope, envelopeGainAt, isTrivialGain, MIX_RATE, MIX_CHANNELS,
} from './sequence-audio.ts';
export type {
  SeqAudioPlan, SeqAudioClip, SeqAudioBed, SeqPcm, SeqMixResult,
  MixSpec, MixClip, MixBed, GainEvent, VolumeKey, DuckSpan, ClipDuck,
} from './sequence-audio.ts';
export { assertRenderOk, RenderIntegrityError } from './render-integrity.ts';
export type { HookErrorLike } from './render-integrity.ts';
export { captureUrl, captureParamsFrom } from './url-capture.ts';
export type { CaptureParams, CaptureDims } from './url-capture.ts';
export { createNetAPI } from './net.ts';
export { PPTX_MIME, looksLikePptxFile, inflatePptx, createPptxAPI } from './pptx.ts';
export { inspectBytes, inspectPath, hasShareRisk, ABSENCE_CAVEAT } from './inspect.ts';
export type {
  Inspection, InspectOptions, MetadataSection, PdfSection, PdfPageSummary,
  HiddenTextSection, CredentialSection,
} from './inspect.ts';
export { renderInspection, clean as scrubControlChars } from './inspect-render.ts';
export type { RenderOptions as InspectRenderOptions } from './inspect-render.ts';
export { expandHome, splitAnchorList } from './trust-anchors.ts';
export { VERDICT_SLUGS, verdictSlug } from './verdict-slugs.ts';
export type { VerdictSlug } from './verdict-slugs.ts';
export { scanPdfPages } from './pdf-pages.ts';
export type { PdfScan, PdfScanOptions, PdfPageScan, PdfInfo } from './pdf-pages.ts';
export { createPdfAPI, organizePdf, stampPdf, lockPdf, parsePdfPageExpression } from './pdf.ts';
export {
  listNodeDesignSystems, activeNodeDesignSystem, readActiveDesignSystemTokens,
  createNodeDesignSystem, writeNodeDesignSystemTokens, activateNodeDesignSystem, addNodeDesignResources,
  exportActiveDesignSystem, nodeStartSeen, markNodeStartSeen,
} from './design-systems.ts';
export type { NodeDesignSystem, NodeDesignResource } from './design-systems.ts';
