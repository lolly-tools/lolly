// SPDX-License-Identifier: MPL-2.0
/**
 * Image lightbox — full-size preview overlay for a user image.
 *
 * Split out of profile.js's storage/image-grid code: this is the one bit of UI
 * that isn't really about storage management, just viewing a picture.
 */

import { escape } from '../../utils.ts';
import type { AssetRef } from '@lolly/engine';

// Full-size preview overlay for a user image. Closes on backdrop click, the ✕,
// or Escape. Mirrors the simple overlay pattern used by the clear-data dialog.
export function openImageLightbox(ref: AssetRef): void {
  const name = ref.meta?.name ?? 'Image';
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  // viewBox-only SVGs report no intrinsic size, so label them "SVG" rather than
  // leaving the dimensions blank.
  const dims = ref.width && ref.height ? `${ref.width} × ${ref.height}` : (isVector ? 'SVG' : '');

  const overlay = document.createElement('div');
  overlay.className = 'userimg-lightbox-overlay';
  overlay.innerHTML = `
    <div class="userimg-lightbox" role="dialog" aria-modal="true" aria-label="${escape(name)}">
      <button type="button" class="userimg-lightbox-close" aria-label="Close">&#x2715;</button>
      <img class="userimg-lightbox-img${isVector ? ' is-vector' : ''}" src="${escape(ref.url)}" alt="${escape(name)}">
      <div class="userimg-lightbox-caption">
        <span class="userimg-lightbox-name">${escape(name)}</span>
        ${dims ? `<span class="userimg-lightbox-dims">${escape(dims)}</span>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Return focus to whatever opened the lightbox when it closes.
  const opener = document.activeElement;
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (opener instanceof HTMLElement) opener.focus();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };

  overlay.addEventListener('click', (e) => {
    // Close when clicking the backdrop or the ✕; ignore clicks on the image itself.
    if (e.target === overlay || (e.target instanceof Element && e.target.closest('.userimg-lightbox-close'))) close();
  });
  document.addEventListener('keydown', onKey);
  overlay.querySelector<HTMLButtonElement>('.userimg-lightbox-close')?.focus();
}
