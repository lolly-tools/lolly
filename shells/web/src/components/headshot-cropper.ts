// SPDX-License-Identifier: MPL-2.0
/**
 * Headshot cropper - a small modal for framing an avatar before it's saved.
 *
 * The user pans (drag) and zooms (slider / wheel) the source image inside a 1:1
 * viewport with a circular mask, then we render the framed square region to a
 * fixed-size canvas and encode WebP. Output is square (the circle is just the
 * guide); tools clip headshots to a circle at render time.
 *
 * openHeadshotCropper(file) → Promise<{ blob, width, height } | null>
 *   resolves null if the user cancels; throws a clear, coded error if the image
 *   can't be decoded (e.g. HEIC off Safari) or is too large - so the caller can
 *   show the reason rather than silently doing nothing.
 */
import { MAX_SOURCE_PIXELS, describeDecodeFailure } from '../bridge/image-resize.ts';
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { looksLikeHeic, decodeHeicBitmap } from '../bridge/heic-decode.ts';

const OUT_SIZE = 512;   // saved avatar resolution (square)
const STAGE = 300;      // on-screen viewport edge (px)
const MAX_ZOOM = 3;

type CroppedHeadshot = { blob: Blob; width: number; height: number };

export async function openHeadshotCropper(file: File): Promise<CroppedHeadshot | null> {
  const decodeError = () => Object.assign(new Error(describeDecodeFailure(file)), { code: 'DECODE_UNSUPPORTED' });

  // EXIF-oriented so it matches how the <img> below paints (and how it exports).
  // Native decode first; if it fails on a HEIC (iPhone default, off Safari), fall
  // back to the bundled libheif decoder.
  let bitmap!: ImageBitmap, isHeicPath = false;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (!(await looksLikeHeic(file))) throw decodeError();
    try { bitmap = await decodeHeicBitmap(file); isHeicPath = true; }
    catch { throw decodeError(); }
  }
  const iw = bitmap.width, ih = bitmap.height;
  if (!iw || !ih) { bitmap.close?.(); throw decodeError(); }
  if (iw * ih > MAX_SOURCE_PIXELS) { bitmap.close?.(); throw new Error(`Image is too large to process (${iw}×${ih} px).`); }

  // The preview <img> needs a URL it can actually paint: the raw file for natively-
  // decodable images, a re-encoded copy for HEIC (which an <img> can't show on
  // Chrome/Firefox even though we decoded it). The output canvas draws `bitmap`, so
  // the saved avatar is correct regardless.
  const displayUrl = isHeicPath ? await bitmapToObjectUrl(bitmap) : URL.createObjectURL(file);

  return new Promise<CroppedHeadshot | null>((resolve) => {
    const url = displayUrl;
    const overlay = document.createElement('div');
    overlay.className = 'cropper-overlay';
    overlay.innerHTML = `
      <div class="cropper" role="dialog" aria-modal="true" aria-label="Crop your headshot">
        <h3 class="cropper-title">Position your headshot</h3>
        <div class="cropper-stage" id="cropper-stage" tabindex="0" role="group" aria-label="Headshot preview. Drag, or use the arrow keys to pan and + or − to zoom.">
          <img class="cropper-img" id="cropper-img" src="${url}" alt="Headshot being cropped" draggable="false" style="image-orientation:from-image">
          <div class="cropper-mask" aria-hidden="true"></div>
        </div>
        <label class="cropper-zoom">
          <span>Zoom</span>
          <input type="range" class="field-range" id="cropper-zoom" min="1" max="${MAX_ZOOM}" step="0.01" value="1">
        </label>
        <div class="cropper-actions">
          <button type="button" class="cropper-btn cropper-btn--secondary" id="cropper-cancel">Cancel</button>
          <button type="button" class="cropper-btn cropper-btn--primary" id="cropper-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const img = overlay.querySelector<HTMLImageElement>('#cropper-img')!;
    const stage = overlay.querySelector<HTMLDivElement>('#cropper-stage')!;
    const zoomEl = overlay.querySelector<HTMLInputElement>('#cropper-zoom')!;

    // sMin = "cover": the shorter edge exactly fills the viewport.
    const sMin = STAGE / Math.min(iw, ih);
    let zoom = 1, s = sMin, tx = (STAGE - iw * s) / 2, ty = (STAGE - ih * s) / 2;

    const apply = () => {
      s = sMin * zoom;
      // Keep the image covering the viewport (no gaps).
      tx = Math.min(0, Math.max(STAGE - iw * s, tx));
      ty = Math.min(0, Math.max(STAGE - ih * s, ty));
      img.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
    };
    img.addEventListener('load', apply);
    apply();

    // Zoom about the viewport centre so the framed subject stays put.
    const zoomTo = (next: number) => {
      const cx = (STAGE / 2 - tx) / s, cy = (STAGE / 2 - ty) / s;
      zoom = Math.min(MAX_ZOOM, Math.max(1, next));
      s = sMin * zoom;
      tx = STAGE / 2 - cx * s; ty = STAGE / 2 - cy * s;
      zoomEl.value = String(zoom);
      apply();
    };
    zoomEl.addEventListener('input', () => zoomTo(parseFloat(zoomEl.value)));
    stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false });

    // Pan via single-pointer drag; pinch-zoom with two pointers. The stage sets
    // touch-action:none (so the page never pans/zooms under the finger), which also
    // kills the browser's native pinch - so we track the active pointers ourselves
    // and drive the cropper's own zoomTo, mirroring the canvas pinch in tool.js.
    const pointers = new Map<number, { x: number; y: number }>();   // pointerId -> { x, y }
    let startX = 0, startY = 0, baseTx = 0, baseTy = 0, panning = false;
    let pinchStartDist = 0, pinchStartZoom = 1;
    const pinchDist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };
    const beginPan = (x: number, y: number) => { panning = true; startX = x; startY = y; baseTx = tx; baseTy = ty; };

    stage.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      stage.setPointerCapture?.(e.pointerId); e.preventDefault();
      if (pointers.size === 2) {
        panning = false;              // hand the gesture off from pan to pinch
        pinchStartDist = pinchDist();
        pinchStartZoom = zoom;
      } else if (pointers.size === 1) {
        beginPan(e.clientX, e.clientY);
      }
    });
    stage.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size >= 2) {
        if (pinchStartDist > 0) zoomTo(pinchStartZoom * (pinchDist() / pinchStartDist));
      } else if (panning) {
        tx = baseTx + (e.clientX - startX); ty = baseTy + (e.clientY - startY); apply();
      }
    });
    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      stage.releasePointerCapture?.(e.pointerId);
      // Falling from two fingers back to one: resume panning from the survivor so
      // the image doesn't jump on the next move.
      if (pointers.size === 1) { const [p] = [...pointers.values()]; beginPan(p!.x, p!.y); }
      else if (pointers.size === 0) { panning = false; }
    };
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);

    // Move focus into the dialog (the zoom control), and return it to whatever
    // opened the cropper on close.
    const opener = document.activeElement;
    let trap: FocusTrap | undefined;
    const close = (result: CroppedHeadshot | null) => {
      trap?.release();
      document.removeEventListener('keydown', onKey);
      URL.revokeObjectURL(url);
      bitmap.close?.();
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(result);
    };
    // Keyboard pan/zoom - the accessible peer of drag + wheel/slider (WCAG 2.1.1).
    // Arrows nudge the frame; Shift = coarse; + / − zoom about centre. The zoom
    // slider keeps its own native arrow keys when it's the focused element.
    const PAN_STEP = 24;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(null); return; }
      if (e.target === zoomEl) return;
      const step = e.shiftKey ? PAN_STEP * 3 : PAN_STEP;
      switch (e.key) {
        case 'ArrowLeft':  tx += step; break;
        case 'ArrowRight': tx -= step; break;
        case 'ArrowUp':    ty += step; break;
        case 'ArrowDown':  ty -= step; break;
        case '+': case '=': zoomTo(zoom * 1.1); e.preventDefault(); return;
        case '-': case '_': zoomTo(zoom / 1.1); e.preventDefault(); return;
        default: return;
      }
      apply();   // re-clamps tx/ty so the image keeps covering the viewport
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('#cropper-cancel')!.addEventListener('click', () => close(null));
    zoomEl.focus();
    trap = trapFocus(overlay);   // Escape handled above; inert the page + wrap Tab

    overlay.querySelector('#cropper-save')!.addEventListener('click', async (e) => {
      (e.currentTarget as HTMLButtonElement).disabled = true;
      apply(); // re-clamp before sampling
      // Map the viewport back to source-image pixels.
      const sx = -tx / s, sy = -ty / s, side = STAGE / s;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_SIZE; canvas.height = OUT_SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.85));
      close(blob ? { blob, width: OUT_SIZE, height: OUT_SIZE } : null);
    });
  });
}

// Draw a decoded bitmap to a canvas and hand back a WebP object URL - gives the
// preview <img> a displayable source when the original (HEIC) can't paint in one.
async function bitmapToObjectUrl(bitmap: ImageBitmap): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width; canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', 0.9));
  if (!blob) throw Object.assign(new Error('Could not prepare the image preview.'), { code: 'DECODE_UNSUPPORTED' });
  return URL.createObjectURL(blob);
}
