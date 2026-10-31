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
 * Between begin and end the clock remembers the latest clip length and size it was given,
 * and a call that leaves them out reuses them. The static-chrome probe and the repaint
 * after it name only a time, so without this memory they would render a clip's second
 * frame at the canvas's own size and with a still's settings.
 */
import { _host } from './export-shared.ts';
import type { ExportOpts } from './export-shared.ts';
import { presentationOf } from './presentation.ts';

export type FrameClockSize = { width: number; height: number };
export type FrameClockCanvas = HTMLCanvasElement & {
  __lollyFrameRender?: (t: number, clipSec?: number, size?: FrameClockSize) => void;
  __lollyFrameDriven?: boolean;
};

/** The clip length and size each driven canvas was last given, kept from begin to end. */
const remembered = new WeakMap<FrameClockCanvas, { clipSec?: number; size?: FrameClockSize }>();

/** Canvases a still export is holding, with how many holds are open on each (see holdStillFrame). */
const stillHolds = new WeakMap<FrameClockCanvas, number>();

/**
 * Nodes a tool runtime is exporting for a tool that prepares its own exports, with how
 * many such exports are running (see holdStillExports).
 */
const toolPrepared = new WeakMap<Element, number>();

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
  'wav', 'mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac',
  'json', 'csv', 'ics', 'vcf', 'srt', 'vtt', 'css', 'scss', 'gpl',
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

/**
 * Freeze a frame-clock tool for a still before the page is read, pose it when nothing
 * else will, and keep it there until the file is written. Returns the release.
 *
 * The raster paths always asked for the still frame (t 0, no clip length), but the vector,
 * print and document writers (SVG, PDF, the CMYK PDF, Penpot, EPS, Office, HTML) walked the
 * live node as it stood. A tool that plays an entrance in its preview (Certificate's reveal)
 * then exported whatever moment the walk met, and its rAF loop kept rewriting inline styles
 * while the walk was still reading them. The hold raises the driven flag for the whole
 * render, so nothing moves underneath the walk, and calls the clock with no clip length,
 * so a tool can draw its finished pose. Releasing lowers the flag and the tool's own loop
 * carries on.
 *
 * The call is left out when the tool prepares the export itself, because it would draw
 * over what that preparation built: a tool with a beforeExport hook (Chart poses its
 * complete poster there, or builds a SMIL flipbook for an animated SVG, and the call would
 * redraw the entrance's first frame over either), and a declared presentation, whose
 * prepare() lays out every export and puts its programme back afterwards. The flag is
 * still raised. A sequence stage's still is the frame at its playhead, posed
 * already, and is never held.
 */
export function holdStillFrame(node: Element, format: string): () => void {
  if (!holdsStill(format) || holds(node, '[data-sequence]')) return NO_HOLD;
  const c = frameClockCanvas(node);
  if (!c) return NO_HOLD;
  const open = stillHolds.get(c) ?? 0;
  stillHolds.set(c, open + 1);
  if (!open) {
    remembered.delete(c);
    c.__lollyFrameDriven = true;
    if (!toolPrepared.has(node) && !(holds(node, '[data-presentation]') && presentationOf(node))) renderFrameAt(c, 0);
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
type HeldTool = { manifest: { hooks?: { beforeExport?: boolean } }; textTemplates?: Record<string, string | null> };

/**
 * Wrap a runtime's export so the still hold (holdStillFrame) knows whose export it is.
 *
 * A tool whose manifest declares a beforeExport hook prepares its own exports. Its node is
 * marked for the length of the export, and the hold the shell's export entry takes after
 * the hook has run only freezes the loop: the pose is the hook's, and the hook ran with the
 * tool's loop as it was. For every other tool the hold is taken here, before the engine
 * starts, so nothing moves from the first step of the export to the last; the entry's own
 * hold inside it only adds a count. A Markdown file from the tool's own template.md is
 * built from the inputs like the other data files, so it is not held.
 */
export function holdStillExports<R extends Exporting>(runtime: R, tool: HeldTool): R {
  const prepares = tool.manifest.hooks?.beforeExport === true;
  const exportFrom = runtime.export.bind(runtime);
  const held: Exporting['export'] = async (node, format, opts) => {
    const el = node && typeof (node as Element).querySelectorAll === 'function' ? node as Element : null;
    if (el && prepares) toolPrepared.set(el, (toolPrepared.get(el) ?? 0) + 1);
    const fromInputs = format === 'md' && tool.textTemplates?.md != null;
    const release = el && !prepares && !fromInputs ? holdStillFrame(el, format) : NO_HOLD;
    try { return await exportFrom(node, format, opts); }
    finally {
      release();
      if (el && prepares) {
        const left = (toolPrepared.get(el) ?? 1) - 1;
        if (left > 0) toolPrepared.set(el, left); else toolPrepared.delete(el);
      }
    }
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
 */
export async function posedFrame<T>(node: Element, ms: number, screenshot: (() => Promise<T>) | null, clone: () => Promise<T>): Promise<T | null> {
  if (!node.querySelector('animate, animateTransform, animateMotion, animateColor, set')) return screenshot ? screenshot() : null;
  const capture = screenshot ?? clone;
  try {
    const { captureSvgTime } = await import('./sequence-svg-clock.ts');
    return await captureSvgTime(node as HTMLElement, ms / 1000, capture);
  } catch (e) {
    _host?.log?.('warn', `frame capture: SMIL could not be posed, capturing as is: ${(e as Error)?.message ?? e}`);
    return capture();
  }
}
