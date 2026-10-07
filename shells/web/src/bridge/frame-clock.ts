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
  c.__lollyFrameDriven = false;
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
