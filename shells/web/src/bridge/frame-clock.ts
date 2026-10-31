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

export type FrameClockSize = { width: number; height: number };
export type FrameClockCanvas = HTMLCanvasElement & {
  __lollyFrameRender?: (t: number, clipSec?: number, size?: FrameClockSize) => void;
  __lollyFrameDriven?: boolean;
};

/** The clip length and size each driven canvas was last given, kept from begin to end. */
const remembered = new WeakMap<FrameClockCanvas, { clipSec?: number; size?: FrameClockSize }>();

/** Canvases a still export is holding for its whole render (see holdStillFrame). */
const stillHolds = new WeakSet<FrameClockCanvas>();

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
 * a real-time take films the tool's own loop. Sound has no picture. A container (a ZIP,
 * a Linux package) renders each member through the same entry, so the member is held
 * with its own format. The structural writers read the document, never the page.
 */
const NOT_HELD: ReadonlySet<string> = new Set([
  'webm', 'mp4', 'gif', 'apng', 'webp-anim', 'svg-anim',
  'wav', 'mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac',
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

/**
 * Pose a frame-clock tool for a still before the page is read, and keep it there until the
 * file is written. Returns the release.
 *
 * The raster paths always asked for the still frame (t 0, no clip length), but the vector,
 * print and document writers (SVG, PDF, the CMYK PDF, Penpot, EPS, Office, HTML) walked the
 * live node as it stood. A tool that plays an entrance in its preview (Certificate's reveal)
 * then exported whatever moment the walk met, and its rAF loop kept rewriting inline styles
 * while the walk was still reading them. One hold around every other still closes that for
 * every tool at once: the clock is called with no clip length, so a tool can draw its
 * finished pose, and the driven flag stays raised for the whole render, so nothing moves
 * underneath the walk. Releasing lowers the flag and the tool's own loop carries on.
 */
export function holdStillFrame(node: Element, format: string): () => void {
  if (!holdsStill(format)) return NO_HOLD;
  const c = frameClockCanvas(node);
  if (!c || stillHolds.has(c)) return NO_HOLD;
  stillHolds.add(c);
  remembered.delete(c);
  c.__lollyFrameDriven = true;
  renderFrameAt(c, 0);
  return () => {
    stillHolds.delete(c);
    remembered.delete(c);
    c.__lollyFrameDriven = false;
  };
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
