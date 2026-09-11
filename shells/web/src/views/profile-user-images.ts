// SPDX-License-Identifier: MPL-2.0
/**
 * The "My images" grid in /profile - one tile, and the full-size preview it
 * opens. Both are leaf renderers over an AssetRef, so they live beside the view
 * rather than inside it.
 *
 * The lightbox is registered with the view's own modal set (mountProfile's
 * _cleanup closes whatever is still open on a view swap), which is why the
 * registry is passed in rather than owned here.
 */

import { mountModal } from '../components/modal.ts';
import type { ModalHandle } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
// Aliased on import: a bare `escape` shadows the deprecated global of that name.
import { escape as escapeHtml } from '../utils.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

/** The slice of /profile's `openProfileModals` set this module needs. */
export interface ProfileModalRegistry {
  add(modal: ModalHandle<void>): unknown;
  delete(modal: ModalHandle<void>): unknown;
}

export function userImageThumb(ref: AssetRef): string {
  const name = String(ref.meta?.name ?? t('Image'));
  // SVGs (logos/icons) shouldn't be cropped to fill - show the whole mark.
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  // A lottie's url is JSON (no still image) - show a play-glyph stub, not a broken
  // <img>. Its live preview surface is Design; here it's just manageable.
  // A video plays itself, muted + looping; gif/apng/animated-webp animate in <img>.
  const media = ref.type === 'lottie'
    ? `<span class="userimg-thumb" style="display:flex;align-items:center;justify-content:center;font-size:2rem;color:var(--text-muted,#789)" aria-hidden="true">▶</span>`
    : ref.type === 'video'
      ? `<video class="userimg-thumb" src="${escapeHtml(ref.url)}" muted loop autoplay playsinline preload="metadata"></video>`
      : `<img class="userimg-thumb${isVector ? ' is-vector' : ''}" src="${escapeHtml(ref.url)}" alt="${escapeHtml(name)}" loading="lazy">`;
  return `
    <div class="userimg-item" data-userimg="${escapeHtml(ref.id)}">
      <button type="button" class="userimg-view" data-view-userimg="${escapeHtml(ref.id)}" title="${escapeHtml(name)}" aria-label="${escapeHtml(tRaw('View {name}', { name }))}">
        ${media}
      </button>
      <button type="button" class="userimg-delete" data-delete-userimg="${escapeHtml(ref.id)}" title="${escapeHtml(t('Delete'))}" aria-label="${escapeHtml(tRaw('Delete {name}', { name }))}">&#x2715;</button>
    </div>
  `;
}

// Full-size preview overlay for a user image. Closes on backdrop click, the ✕,
// or Escape. Mirrors the simple overlay pattern used by the clear-data dialog.
export function openImageLightbox(ref: AssetRef, modals: ProfileModalRegistry): void {
  const name = String(ref.meta?.name ?? t('Image'));
  const isVector = ref.type === 'vector' || ref.format === 'svg';
  const isLottie = ref.type === 'lottie';
  const isVideo = ref.type === 'video';
  // viewBox-only SVGs report no intrinsic size, so label them "SVG" rather than
  // leaving the dimensions blank.
  const dims = ref.width && ref.height ? `${ref.width} × ${ref.height}` : (isVector ? 'SVG' : (isLottie ? 'Lottie' : (isVideo ? 'Video' : '')));
  // A lottie has no still frame to enlarge - show a play-glyph placeholder instead
  // of a broken <img>. (Placing it in Design is where it actually plays.)
  // A video plays full-size with controls; gif/apng/animated-webp enlarge as <img>.
  const media = isLottie
    ? `<div class="userimg-lightbox-img" style="display:flex;align-items:center;justify-content:center;min-width:220px;min-height:220px;font-size:5rem;color:var(--text-muted,#789)" aria-hidden="true">▶</div>`
    : isVideo
      ? `<video class="userimg-lightbox-img" src="${escapeHtml(ref.url)}" muted loop autoplay playsinline controls></video>`
      : `<img class="userimg-lightbox-img${isVector ? ' is-vector' : ''}" src="${escapeHtml(ref.url)}" alt="${escapeHtml(name)}">`;

  const content = `
    <button type="button" class="userimg-lightbox-close" aria-label="${escapeHtml(t('Close'))}">&#x2715;</button>
    ${media}
    <div class="userimg-lightbox-caption">
      <span class="userimg-lightbox-name">${escapeHtml(name)}</span>
      ${dims ? `<span class="userimg-lightbox-dims">${escapeHtml(dims)}</span>` : ''}
    </div>`;
  const modal = mountModal<void>(content, {
    className: 'userimg-lightbox',
    ariaLabel: name,
    initialFocus: (el) => el.querySelector<HTMLElement>('.userimg-lightbox-close'),
    onClose: () => modals.delete(modal),
  });
  modals.add(modal);
  // Close on the ✕; a click on the backdrop is already handled by mountModal's own
  // hit-test (clicks on the image/caption itself sit inside the dialog's box and don't).
  modal.el.addEventListener('click', (e) => {
    if ((e.target as Element).closest('.userimg-lightbox-close')) modal.close();
  });
}
