// SPDX-License-Identifier: MPL-2.0
/** Loading feedback follows the media currently shown in an asset preview. */
import { t, tRaw } from '../i18n.ts';

export function mountAssetPreviewStatus(root: HTMLElement, bytes?: number): () => void {
  const media = root.querySelector<HTMLImageElement | HTMLVideoElement>('img.cat-thumb, video');
  if (!media) return () => {};
  const status = document.createElement('div');
  status.className = 'asset-preview-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const text = document.createElement('span');
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = t('Try again'); retry.hidden = true;
  status.append(text, retry); root.append(status);
  let disposed = false;
  const loading = () => {
    if (disposed) return;
    status.hidden = false; retry.hidden = true;
    root.setAttribute('aria-busy', 'true');
    text.textContent = bytes && bytes >= 1024 * 1024
      ? tRaw('Loading preview · {size} MB', { size: (bytes / (1024 * 1024)).toLocaleString(undefined, { maximumFractionDigits: 1 }) })
      : t('Loading preview…');
  };
  const ready = () => { if (!disposed) { status.hidden = true; root.setAttribute('aria-busy', 'false'); } };
  const failed = () => {
    if (disposed) return;
    root.setAttribute('aria-busy', 'false'); status.hidden = false; retry.hidden = false;
    text.textContent = t('Preview could not load.');
  };
  const image = media.tagName === 'IMG' ? media as HTMLImageElement : null;
  const video = media.tagName === 'VIDEO' ? media as HTMLVideoElement : null;
  const inspect = () => {
    if (image?.complete) image.naturalWidth > 0 ? ready() : failed();
    else if (video?.error) failed();
    else if (video && video.readyState >= 2) ready();
  };
  const change = () => { loading(); inspect(); };
  const controller = new AbortController();
  for (const event of ['load', 'loadeddata', 'canplay', 'playing']) media.addEventListener(event, ready, { signal: controller.signal });
  for (const event of ['waiting', 'stalled', 'loadstart']) media.addEventListener(event, loading, { signal: controller.signal });
  media.addEventListener('error', failed, { signal: controller.signal });
  retry.addEventListener('click', () => {
    loading();
    if (video) video.load();
    else if (image) {
      const src = image.getAttribute('src') ?? image.src;
      const url = new URL(src, image.ownerDocument.baseURI);
      if (/^https?:$/.test(url.protocol) && url.origin === image.ownerDocument.location.origin) {
        url.searchParams.set('_lolly_preview_retry', String(Date.now())); image.src = url.href;
      } else {
        image.removeAttribute('src'); queueMicrotask(() => { if (!disposed) image.setAttribute('src', src); });
      }
    }
  }, { signal: controller.signal });
  const observer = new MutationObserver(change);
  observer.observe(media, { attributes: true, attributeFilter: ['src', 'srcset'] });
  loading(); inspect();
  return () => { disposed = true; controller.abort(); observer.disconnect(); status.remove(); root.removeAttribute('aria-busy'); };
}
