/**
 * Headshot cropper — a small modal for framing an avatar before it's saved.
 *
 * The user pans (drag) and zooms (slider / wheel) the source image inside a 1:1
 * viewport with a circular mask, then we render the framed square region to a
 * fixed-size canvas and encode WebP. Output is square (the circle is just the
 * guide); tools clip headshots to a circle at render time.
 *
 * openHeadshotCropper(file) → Promise<{ blob, width, height } | null>
 *   resolves null if the user cancels or the image can't be decoded.
 */
import { MAX_SOURCE_PIXELS } from '../bridge/image-resize.js';

const OUT_SIZE = 512;   // saved avatar resolution (square)
const STAGE = 300;      // on-screen viewport edge (px)
const MAX_ZOOM = 3;

export async function openHeadshotCropper(file) {
  let bitmap;
  try {
    // EXIF-oriented so it matches how the <img> below paints (and how it exports).
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const iw = bitmap.width, ih = bitmap.height;
  if (!iw || !ih || iw * ih > MAX_SOURCE_PIXELS) { bitmap.close?.(); return null; }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const overlay = document.createElement('div');
    overlay.className = 'cropper-overlay';
    overlay.innerHTML = `
      <div class="cropper" role="dialog" aria-modal="true" aria-label="Crop your headshot">
        <h3 class="cropper-title">Position your headshot</h3>
        <div class="cropper-stage" id="cropper-stage">
          <img class="cropper-img" id="cropper-img" src="${url}" alt="Headshot being cropped" draggable="false" style="image-orientation:from-image">
          <div class="cropper-mask" aria-hidden="true"></div>
        </div>
        <label class="cropper-zoom">
          <span>Zoom</span>
          <input type="range" id="cropper-zoom" min="1" max="${MAX_ZOOM}" step="0.01" value="1">
        </label>
        <div class="cropper-actions">
          <button type="button" class="cropper-btn cropper-btn--secondary" id="cropper-cancel">Cancel</button>
          <button type="button" class="cropper-btn cropper-btn--primary" id="cropper-save">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const img = overlay.querySelector('#cropper-img');
    const stage = overlay.querySelector('#cropper-stage');
    const zoomEl = overlay.querySelector('#cropper-zoom');

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
    const zoomTo = (next) => {
      const cx = (STAGE / 2 - tx) / s, cy = (STAGE / 2 - ty) / s;
      zoom = Math.min(MAX_ZOOM, Math.max(1, next));
      s = sMin * zoom;
      tx = STAGE / 2 - cx * s; ty = STAGE / 2 - cy * s;
      zoomEl.value = String(zoom);
      apply();
    };
    zoomEl.addEventListener('input', () => zoomTo(parseFloat(zoomEl.value)));
    stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomTo(zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06)); }, { passive: false });

    // Pan via pointer drag.
    let startX = 0, startY = 0, baseTx = 0, baseTy = 0, panning = false;
    stage.addEventListener('pointerdown', (e) => {
      panning = true; startX = e.clientX; startY = e.clientY; baseTx = tx; baseTy = ty;
      stage.setPointerCapture?.(e.pointerId); e.preventDefault();
    });
    stage.addEventListener('pointermove', (e) => {
      if (!panning) return;
      tx = baseTx + (e.clientX - startX); ty = baseTy + (e.clientY - startY); apply();
    });
    const endPan = (e) => { panning = false; stage.releasePointerCapture?.(e.pointerId); };
    stage.addEventListener('pointerup', endPan);
    stage.addEventListener('pointercancel', endPan);

    // Move focus into the dialog (the zoom control), and return it to whatever
    // opened the cropper on close.
    const opener = document.activeElement;
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      URL.revokeObjectURL(url);
      bitmap.close?.();
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
      resolve(result);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('pointerdown', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('#cropper-cancel').addEventListener('click', () => close(null));
    zoomEl.focus();

    overlay.querySelector('#cropper-save').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      apply(); // re-clamp before sampling
      // Map the viewport back to source-image pixels.
      const sx = -tx / s, sy = -ty / s, side = STAGE / s;
      const canvas = document.createElement('canvas');
      canvas.width = OUT_SIZE; canvas.height = OUT_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.85));
      close(blob ? { blob, width: OUT_SIZE, height: OUT_SIZE } : null);
    });
  });
}
