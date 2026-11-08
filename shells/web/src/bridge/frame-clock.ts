// SPDX-License-Identifier: MPL-2.0
/**
 * Deterministic export-frame clock (opt-in).
 *
 * A canvas-animation tool can register `__lollyFrameRender(t)` on its canvas to render a
 * deterministic frame at normalized loop time t in [0, 1). The snapshot export paths in
 * export.ts drive it: they raise `__lollyFrameDriven` (so the tool's own rAF loop bails,
 * because dom-to-image's toCanvas is async and a stray repaint would otherwise clobber the
 * frame), paint the exact phase, then capture. Presence-keyed, so a tool that never
 * registers the hook is byte-for-byte unchanged. Scoped to the snapshot paths only, never
 * the real-time captureStream path (which returns before createFrameSource), so the two
 * mechanisms can't both fire per export.
 *
 * Per-node channel (not a window global): the hook lives on the tool's canvas, so it can't
 * leak across SPA tool navigation. A detached canvas from a previous tool is never inside
 * the node being exported, so an unrelated tool never enters this path.
 *
 * The second argument is the exported clip's real length in seconds. It is additive: a tool
 * that declares `(t)` ignores it and behaves exactly as before. A tool that maps t onto its
 * own timeline (the audiogram's caption cues) must prefer it over any span of its own,
 * because the export's length is decided in export.ts, after a frame plan the tool never
 * sees, and a tool-side guess is what let captions drift.
 *
 * The third argument is the export's target pixel size. Also additive: a canvas tool that
 * draws at its on-screen size ignores it and the capture scales that bitmap, as before. A
 * tool that can resample (the 3D studio) re-renders at this size so a larger export carries
 * real detail rather than an upscaled preview.
 *
 * The rasters call every clock at t 0 for a still. The stills that read the page (SVG, PDF,
 * Penpot and the rest) call only a clock that declares `stillPose: true` on its function,
 * through a still hold (holdStillFrame); any other clock is left alone for those formats.
 *
 * Between begin and end the clock remembers the latest clip length and size it was given,
 * and a call that leaves them out reuses them. The static-chrome probe and the repaint
 * after it name only a time, so without this memory they would render a clip's second
 * frame at the canvas's own size and with a still's settings.
 */
import { _host } from './export-shared.ts';
import type { ExportOpts } from './export-shared.ts';
import { presentationOf } from './presentation.ts';

export type FrameClockSize = { width: number; height: number };
/**
 * A tool's frame clock. `stillPose: true` on the function declares that t 0 with no clip
 * length draws the finished piece, which lets a still hold pose it (see holdStillFrame).
 */
export type FrameClockRender = ((t: number, clipSec?: number, size?: FrameClockSize) => void) & { stillPose?: boolean };
export type FrameClockCanvas = HTMLCanvasElement & {
  __lollyFrameRender?: FrameClockRender;
  __lollyFrameDriven?: boolean;
};

/** The clip length and size each driven canvas was last given, kept from begin to end. */
const remembered = new WeakMap<FrameClockCanvas, { clipSec?: number; size?: FrameClockSize }>();

/** Canvases a still export is holding, with how many holds are open on each (see holdStillFrame). */
const stillHolds = new WeakMap<FrameClockCanvas, number>();

export function frameClockCanvas(node: Element): FrameClockCanvas | null {
  const self = node as FrameClockCanvas;
  if (typeof self.__lollyFrameRender === 'function') return self;
  for (const c of Array.from(node.querySelectorAll?.('canvas') ?? [])) {
    if (typeof (c as FrameClockCanvas).__lollyFrameRender === 'function') return c as FrameClockCanvas;
  }
  return null;
}

export function beginFrameClock(node: Element): FrameClockCanvas | null {
  const c = frameClockCanvas(node);
  if (c) {
    remembered.delete(c);
    c.__lollyFrameDriven = true;   // freeze the tool's own rAF for the capture
  }
  return c;
}

export function renderFrameAt(c: FrameClockCanvas | null, t: number, clipSec?: number, size?: FrameClockSize): void {
  if (!c || typeof c.__lollyFrameRender !== 'function') return;
  const last = remembered.get(c) ?? {};
  if (clipSec !== undefined) last.clipSec = clipSec;
  if (size !== undefined) last.size = size;
  remembered.set(c, last);
  try { c.__lollyFrameRender(t, last.clipSec, last.size); } catch (e) { _host?.log?.('warn', `__lollyFrameRender threw: ${(e as Error)?.message ?? e}`); }
}

export function endFrameClock(c: FrameClockCanvas | null): void {
  if (!c) return;
  remembered.delete(c);
  // A raster capture inside a still hold (a PDF's rasterised fallback, an icon's sizes)
  // ends its own clock, but the hold's render is not finished, so the flag stays up.
  if (!stillHolds.has(c)) c.__lollyFrameDriven = false;
}

/**
 * Formats a still hold leaves alone. A clip drives the clock itself, frame by frame, and
 * a real-time take films the tool's own loop. Sound has no picture. A data file (the
 * engine's DATA_FORMATS in runtime.ts) is built from the inputs and reads no page. A
 * container (a ZIP, a Linux package) renders each member through the same entry, so the
 * member is held with its own format. The structural writers read the document, never
 * the page.
 */
const NOT_HELD: ReadonlySet<string> = new Set([
  'webm', 'mp4', 'gif', 'apng', 'webp-anim', 'svg-anim',
  'wav', 'mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac', 'mid',
  'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'ttml', 'scc', 'css', 'scss', 'gpl',
  'zip', 'rpm', 'tar.gz',
  'lottie', 'idml', 'premiere-xml',
]);

/**
 * The stills whose renderer poses the clock itself, at the pixel size of the file, and
 * holds the flag for its own capture: renderRaster, renderBitmap, renderTiff, renderBmp,
 * renderCmykTiff and the icon's frame source in export.ts. A second, size-less call first
 * would make a tool that re-renders for the export (the 3D studio) draw every still twice.
 */
const SELF_POSED: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'avif', 'jxl', 'jxl-lossless',
  'tiff', 'bmp', 'cmyk-tiff', 'ico',
]);

/** True when an export to `format` reads the page as one still and does not pose the clock itself. */
export function holdsStill(format: string): boolean {
  return !NOT_HELD.has(format) && !SELF_POSED.has(format);
}

const NO_HOLD = (): void => {};

/** True when `node` is, or contains, an element matching `selector`. */
function holds(node: Element, selector: string): boolean {
  return typeof node.matches === 'function' && (node.matches(selector) || !!node.querySelector(selector));
}

/** True when the canvas's clock declares that t 0 with no clip length is its finished still. */
export function declaresStillPose(c: FrameClockCanvas): boolean {
  return typeof c.__lollyFrameRender === 'function' && c.__lollyFrameRender.stillPose === true;
}

/**
 * Pose a frame-clock tool that declares a still pose, freeze it before the page is read
 * and keep it there until the file is written. Returns the release.
 *
 * The raster paths always asked every clock for the still frame (t 0, no clip length), but
 * the vector, print and document writers (SVG, PDF, the CMYK PDF, Penpot, EPS, Office,
 * HTML) walked the live node as it stood. A tool that plays an entrance in its preview
 * (Certificate's reveal) then exported whatever moment the walk met, and its rAF loop kept
 * rewriting inline styles while the walk was still reading them. Such a tool sets
 * `stillPose = true` on its clock. The hold then calls the clock with no clip length, so
 * the tool draws its finished pose, and raises the driven flag for the whole render, so
 * nothing moves underneath the walk. Releasing lowers the flag and the tool's own loop
 * carries on.
 *
 * A clock with no declaration is never held here. Its t 0 is not a finished piece: Growth's
 * is the bare seed, and Chart's is the entrance's first frame, drawn over the poster or the
 * SMIL flipbook its beforeExport hook builds. Those formats read such a tool's page as it
 * stands, as they always did. A sequence stage's still is the frame at its playhead,
 * posed already, and is never held.
 */
export function holdStillFrame(node: Element, format: string): () => void {
  if (!holdsStill(format) || holds(node, '[data-sequence]')) return NO_HOLD;
  const c = frameClockCanvas(node);
  if (!c || !declaresStillPose(c)) return NO_HOLD;
  const open = stillHolds.get(c) ?? 0;
  stillHolds.set(c, open + 1);
  if (!open) {
    remembered.delete(c);
    c.__lollyFrameDriven = true;
    renderFrameAt(c, 0);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (stillHolds.get(c) ?? 1) - 1;
    if (left > 0) { stillHolds.set(c, left); return; }
    stillHolds.delete(c);
    remembered.delete(c);
    c.__lollyFrameDriven = false;
  };
}

/**
 * One render from the shell's export entry (export.ts renderFormat), inside its still hold,
 * with a declared presentation laid out after the hold is taken and put back before it is
 * released. `reads` is false for a payload the engine already built, which reads no page.
 */
export async function withStillHold<T>(node: Element, format: string, opts: ExportOpts, reads: boolean, render: () => Promise<T>): Promise<T> {
  const release = reads ? holdStillFrame(node, format) : NO_HOLD;
  let restore: (() => void) | undefined;
  try {
    restore = await presentationOf(node)?.prepare(format, opts);
    return await render();
  } finally { restore?.(); release(); }
}

/** The part of a tool runtime a still hold needs to see. */
type Exporting = { export(node: unknown, format: string, opts?: never): Promise<Blob> };

/** What holdStillExports reads off the loaded tool. */
type HeldTool = { textTemplates?: Record<string, string | null> };

/**
 * Wrap a runtime's export so a tool whose clock declares a still pose (holdStillFrame) is
 * posed and frozen before the engine starts: before its beforeExport hook, its emoji pass
 * and every other step, so nothing moves from the first step of the export to the last.
 * The hold the shell's export entry takes inside it only adds a count. An export the shell
 * makes outside a runtime (a docs capture) has no such steps, and the entry's hold poses
 * the tool before the page is read. A Markdown file from the tool's own template.md is
 * built from the inputs like the other data files, so it is not held.
 */
export function holdStillExports<R extends Exporting>(runtime: R, tool: HeldTool): R {
  const exportFrom = runtime.export.bind(runtime);
  const held: Exporting['export'] = async (node, format, opts) => {
    const el = node && typeof (node as Element).querySelectorAll === 'function' ? node as Element : null;
    const fromInputs = format === 'md' && tool.textTemplates?.md != null;
    const release = el && !fromInputs ? holdStillFrame(el, format) : NO_HOLD;
    try { return await exportFrom(node, format, opts); }
    finally { release(); }
  };
  runtime.export = held as R['export'];
  return runtime;
}

/**
 * The capture for one export frame when plain dom-to-image is not enough, or null
 * when it is (the caller then captures as usual).
 *
 * Two cases. A Node/Playwright caller that registered an external screenshot gets a real
 * Chromium screenshot (`screenshot`). And SMIL motion is posed at the frame's time first:
 * scrubAnimations reaches only what getAnimations() lists, which SMIL is not, and
 * dom-to-image's clone restarts every <animate*> at 0, so a tool whose inline <svg>
 * animates (Pose Geeko's alive loop) used to export its first frame N times.
 * captureSvgTime poses SMIL and CSS at `ms`, pins the result into the markup for the
 * one capture, then puts everything back; a picture it cannot pose is captured as is.
 *
 * `posed`, when given, runs once the frame is in its final pose and before it is taken,
 * whichever way it is taken: inside the SMIL pose, or before returning null to a caller
 * that captures the frame itself. A stamped export records the pictures the frame draws
 * there. It may run twice when a SMIL pose fails, so it has to be safe to repeat.
 */
export async function posedFrame<T>(node: Element, ms: number, screenshot: (() => Promise<T>) | null, clone: () => Promise<T>, posed?: () => Promise<void>): Promise<T | null> {
  if (!node.querySelector('animate, animateTransform, animateMotion, animateColor, set')) {
    await posed?.();
    return screenshot ? screenshot() : null;
  }
  const take = screenshot ?? clone;
  const capture = posed ? async (): Promise<T> => { await posed(); return take(); } : take;
  try {
    const { captureSvgTime } = await import('./sequence-svg-clock.ts');
    return await captureSvgTime(node as HTMLElement, ms / 1000, capture);
  } catch (e) {
    _host?.log?.('warn', `frame capture: SMIL could not be posed, capturing as is: ${(e as Error)?.message ?? e}`);
    return capture();
  }
}
