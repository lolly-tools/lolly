// SPDX-License-Identifier: MPL-2.0
/**
 * Pick a colour off the app's own surface (plan 216 item 8).
 *
 * The browser `EyeDropper` API samples anywhere on screen, but it exists only in
 * desktop Chromium: iOS Safari, Android Chrome and BOTH Tauri WebViews have none,
 * so on a phone the colour-field / Add-colour eyedropper had no control at all.
 * This provides one: when `EyeDropper` is present it is still used (it can reach the
 * whole desktop); otherwise we render the app's own creative surface to a bitmap and
 * let the finger drag a magnifier loupe over it, sampling the pixel on release. The
 * OS screen is unreachable from a WebView, so the scope is the app's surfaces - which
 * is what someone actually wants on a phone: a colour off their own artwork.
 *
 * LAZY on purpose: nothing here touches the boot path (the callers dynamic-import it
 * the first time the button is pressed). See scripts/check-bundle-budget.ts.
 *
 * The pure sampling helpers (coordinate mapping, hex formatting) are exported and
 * unit-tested; the loupe overlay + canvas decode + host render are device-verified,
 * as plan 216 item 8's acceptance says ("dragging over the tool canvas shows a loupe
 * and picks the pixel").
 */

import { clamp } from '@lolly/engine';
import { getHostRef } from './host-ref.ts';

/** A sampleable frame: a flat RGBA byte array plus its dimensions. */
export interface SampleFrame {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const hex2 = (n: number): string => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** One RGB triple as `#rrggbb` (lowercase), the shape parseColor / EyeDropper return. */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/**
 * Map a viewport point (a finger / cursor) over an element's on-screen rectangle to
 * the pixel of a bitmap that fills that rectangle. The render represents the
 * element's box, so the mapping is a straight fraction-of-rect times image size,
 * clamped so an edge touch still maps to a real pixel. A zero-area rect maps to the
 * origin rather than dividing by zero.
 */
export function clientToImagePixel(
  rect: { left: number; top: number; width: number; height: number },
  imgW: number, imgH: number, clientX: number, clientY: number,
): { x: number; y: number } {
  const fx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const fy = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return {
    x: clamp(Math.floor(fx * imgW), 0, Math.max(0, imgW - 1)),
    y: clamp(Math.floor(fy * imgH), 0, Math.max(0, imgH - 1)),
  };
}

/** The `#rrggbb` of one pixel in a flat RGBA frame; '#000000' for an out-of-range
 *  index rather than a throw (a caller that clamped first never hits that). */
export function pixelHex(frame: SampleFrame, x: number, y: number): string {
  const i = (y * frame.width + x) * 4;
  const d = frame.data;
  if (i < 0 || i + 2 >= d.length) return '#000000';
  return rgbToHex(d[i]!, d[i + 1]!, d[i + 2]!);
}

/** Sample the colour at a viewport point over `rect`, given a decoded frame. The
 *  combined map-then-read the loupe does on every move and on release; exported so
 *  the coordinate maths is testable without a canvas or pointer events. */
export function sampleAt(
  frame: SampleFrame,
  rect: { left: number; top: number; width: number; height: number },
  clientX: number, clientY: number,
): string {
  const { x, y } = clientToImagePixel(rect, frame.width, frame.height, clientX, clientY);
  return pixelHex(frame, x, y);
}

/** The app's primary creative surface, the default sample target for the loupe. */
function defaultRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>('#tool-canvas, .tool-canvas, #tool-content');
}

interface EyeDropperResult { sRGBHex: string }
interface EyeDropperCtor { new (): { open(opts?: { signal?: AbortSignal }): Promise<EyeDropperResult> } }

/** Decode a rendered PNG blob into a sampleable RGBA frame via an offscreen canvas
 *  (willReadFrequently: we read one pixel per pointer move). Returns null where the
 *  platform can't decode (no createImageBitmap / no 2-D context). */
async function decodeFrame(blob: Blob): Promise<SampleFrame | null> {
  try {
    if (typeof createImageBitmap !== 'function') return null;
    const bmp = await createImageBitmap(blob);
    const w = bmp.width, h = bmp.height;
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext('2d', { willReadFrequently: true }) as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) { bmp.close?.(); return null; }
    ctx.drawImage(bmp as CanvasImageSource, 0, 0);
    bmp.close?.();
    const img = ctx.getImageData(0, 0, w, h);
    return { data: img.data, width: w, height: h };
  } catch {
    return null;
  }
}

/**
 * Pick a colour. Resolves the chosen `#rrggbb`, or null when the user cancelled or
 * no surface could be sampled (so a caller applies a colour only on a real pick).
 *
 * `root` is the surface to sample in the loupe fallback; it defaults to the tool
 * canvas. `signal` cancels an in-flight pick (the popover closing).
 */
export async function pickColor(opts: { root?: Element | null; signal?: AbortSignal } = {}): Promise<string | null> {
  // `window.EyeDropper`, not `globalThis` - matches the call sites' feature check
  // and is what a jsdom harness stubs (globalThis.window is the jsdom window).
  const Native = typeof window !== 'undefined'
    ? (window as { EyeDropper?: EyeDropperCtor }).EyeDropper
    : undefined;
  if (Native) {
    try {
      const res = await new Native().open(opts.signal ? { signal: opts.signal } : undefined);
      return res.sRGBHex || null;
    } catch {
      return null; // Esc / dismissed
    }
  }
  return loupePick(opts.root ?? defaultRoot(), opts.signal);
}

/**
 * The WebView / mobile-Safari fallback: render `root` once, then a full-screen loupe
 * follows the pointer over it and samples the pixel on release. Resolves null when
 * there is nothing to sample, the render/decode fails, or the pick is cancelled.
 */
async function loupePick(root: Element | null, signal?: AbortSignal): Promise<string | null> {
  const host = getHostRef();
  if (!root || !(root instanceof HTMLElement) || !host?.export?.render) return null;
  if (signal?.aborted) return null;

  let frame: SampleFrame | null;
  try {
    const blob = await host.export.render(root, 'png');
    frame = await decodeFrame(blob);
  } catch {
    frame = null;
  }
  if (!frame || signal?.aborted) return null;
  const px = frame;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    // Full-screen catcher over everything, so a drag that leaves the canvas is still
    // tracked and a tap outside the canvas cancels. The loupe rides above it.
    const overlay = document.createElement('div');
    overlay.className = 'lolly-eyedropper-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:crosshair;touch-action:none;';

    const LOUPE = 116, ZOOM = 8;
    const loupe = document.createElement('canvas');
    loupe.width = LOUPE; loupe.height = LOUPE;
    loupe.className = 'lolly-eyedropper-loupe';
    loupe.style.cssText =
      'position:fixed;width:116px;height:116px;border-radius:50%;pointer-events:none;' +
      'box-shadow:0 4px 24px rgba(0,0,0,.4),0 0 0 3px #fff,0 0 0 4px rgba(0,0,0,.25);' +
      'image-rendering:pixelated;opacity:0;transition:opacity .12s;background:#0c322c;';
    const lctx = loupe.getContext('2d');
    overlay.append(loupe);
    document.body.append(overlay);

    const rectOf = (): DOMRect => root.getBoundingClientRect();

    const paint = (clientX: number, clientY: number): string => {
      const rect = rectOf();
      const { x, y } = clientToImagePixel(rect, px.width, px.height, clientX, clientY);
      const hex = pixelHex(px, x, y);
      // Position the loupe above-left of the finger so it isn't covered.
      loupe.style.left = `${clientX - LOUPE - 8}px`;
      loupe.style.top = `${clientY - LOUPE - 8}px`;
      loupe.style.opacity = '1';
      if (lctx) {
        const span = Math.round(LOUPE / ZOOM);
        lctx.imageSmoothingEnabled = false;
        lctx.clearRect(0, 0, LOUPE, LOUPE);
        // Blit a `span`-wide crop centred on (x,y), scaled up ZOOM×. A tiny scratch
        // canvas carries the crop's pixels so we can drawImage-scale it.
        const crop = document.createElement('canvas');
        crop.width = span; crop.height = span;
        const cctx = crop.getContext('2d');
        if (cctx) {
          const sub = cctx.createImageData(span, span);
          for (let dy = 0; dy < span; dy++) {
            for (let dx = 0; dx < span; dx++) {
              const sx = clamp(x - (span >> 1) + dx, 0, px.width - 1);
              const sy = clamp(y - (span >> 1) + dy, 0, px.height - 1);
              const si = (sy * px.width + sx) * 4;
              const di = (dy * span + dx) * 4;
              sub.data[di] = px.data[si]!; sub.data[di + 1] = px.data[si + 1]!;
              sub.data[di + 2] = px.data[si + 2]!; sub.data[di + 3] = 255;
            }
          }
          cctx.putImageData(sub, 0, 0);
          lctx.drawImage(crop, 0, 0, span, span, 0, 0, LOUPE, LOUPE);
        }
        // Centre crosshair box over the sampled pixel.
        lctx.strokeStyle = '#fff'; lctx.lineWidth = 1;
        lctx.strokeRect((LOUPE - ZOOM) / 2 + 0.5, (LOUPE - ZOOM) / 2 + 0.5, ZOOM - 1, ZOOM - 1);
        lctx.strokeStyle = 'rgba(0,0,0,.5)';
        lctx.strokeRect((LOUPE - ZOOM) / 2 - 0.5, (LOUPE - ZOOM) / 2 - 0.5, ZOOM + 1, ZOOM + 1);
      }
      return hex;
    };

    const inRoot = (clientX: number, clientY: number): boolean => {
      const r = rectOf();
      return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
    };

    const onMove = (e: PointerEvent): void => { e.preventDefault(); paint(e.clientX, e.clientY); };
    const onUp = (e: PointerEvent): void => {
      e.preventDefault();
      // A release outside the surface is a cancel, matching a tap-away.
      finish(inRoot(e.clientX, e.clientY) ? paint(e.clientX, e.clientY) : null);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); finish(null); } };
    const onAbort = (): void => finish(null);

    function cleanup(): void {
      overlay.removeEventListener('pointermove', onMove);
      overlay.removeEventListener('pointerup', onUp);
      overlay.removeEventListener('pointercancel', onAbort);
      window.removeEventListener('keydown', onKey, true);
      signal?.removeEventListener('abort', onAbort);
      overlay.remove();
    }

    overlay.addEventListener('pointermove', onMove);
    overlay.addEventListener('pointerup', onUp);
    overlay.addEventListener('pointercancel', onAbort);
    window.addEventListener('keydown', onKey, true);
    signal?.addEventListener('abort', onAbort);
  });
}
