// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';
import { isMogrtAsset } from './picker-query.ts';
import { escapeHtml } from '../lib/html.ts';
import { icon } from '../lib/icons.ts';
import { isRadianceAsset } from '../lib/model-upload.ts';
import { audioThumbPlaceholder } from '../lib/audio-thumb.ts';
import { peaksFingerprint } from '../lib/audio-peaks.ts';
import { motionVideoThumb } from '../lib/preview-media.ts';

// Playback starts on hover, focus or the centred touch tile through the shared media policy.
export function videoThumb(url: string, className: string): string {
  return motionVideoThumb(url, className);
}

// Keep the poster or play glyph until the visible-tile player mounts.
export function lottieThumb(ref: AssetRef, className: string): string | null {
  const json = ref.source === 'user' ? ref.url : (typeof ref.meta?.animationUrl === 'string' ? ref.meta.animationUrl : '');
  if (!json) return null;
  const poster = ref.source !== 'user' && typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
  const style = poster ? ` style="background-image:url('${escapeHtml(poster)}')"` : '';
  return `<span class="${className} asset-picker-thumb-motion" data-lottie-src="${escapeHtml(json)}" data-lottie-fit="contain"${style} aria-hidden="true">${poster ? '' : '▶'}</span>`;
}

// The waveform observer replaces this placeholder with measured audio peaks.
export function audioThumb(ref: AssetRef, className: string): string {
  const label = String(ref.meta?.name ?? ref.id);
  return `<span class="${className} asset-picker-thumb-motion asset-picker-thumb-audio" data-audio-thumb="${escapeHtml(ref.id)}" data-audio-fp="${escapeHtml(peaksFingerprint(ref))}">`
    + audioThumbPlaceholder({ label })
    + `</span>`;
}

// Model and LUT bytes need a supplied poster or a format glyph.
export function modelThumb(ref: AssetRef): string {
  const poster = typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
  return poster
    ? `<img class="asset-picker-thumb" src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">`
    : `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">${icon(isRadianceAsset(ref) ? 'sunburst' : 'box', { size: 30 })}</span>`;
}

export function mogrtThumb(ref: AssetRef): string {
  const poster = typeof ref.meta?.thumbUrl === 'string' ? ref.meta.thumbUrl : typeof ref.meta?.posterUrl === 'string' ? ref.meta.posterUrl : '';
  return poster
    ? `<img class="asset-picker-thumb" src="${escapeHtml(poster)}" alt="" loading="lazy" decoding="async">`
    : `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">MOGRT</span>`;
}

// An image inside a folder - a plain pick tile (no delete affordance; deletion
// lives in the Your images list). Picking routes through the shared [data-asset-id] handler.
export function projectImageCardHtml(ref: AssetRef, actions: {
  upscaleButton(ref: AssetRef, name: string): string;
  matteButton(ref: AssetRef, name: string): string;
  vidMatteButton(ref: AssetRef, name: string): string;
  formatBadge(ref: AssetRef): string;
}): string {
  const { upscaleButton, matteButton, vidMatteButton, formatBadge } = actions;
  const name = String(ref.meta?.name ?? t('Image'));
  const thumb = isMogrtAsset(ref) ? mogrtThumb(ref) : ref.type === 'lottie'
    ? (lottieThumb(ref, 'asset-picker-thumb') ?? `<span class="asset-picker-thumb asset-picker-thumb-stub" aria-hidden="true">▶</span>`)
    : ref.type === 'video'
      ? videoThumb(ref.url, 'asset-picker-thumb')
      : ref.type === 'audio'
        ? audioThumb(ref, 'asset-picker-thumb')
        : `<img class="asset-picker-thumb" src="${escapeHtml(ref.url)}" alt="" loading="lazy" decoding="async">`;
  const upBtn = upscaleButton(ref, name);
  const cutBtn = matteButton(ref, name);
  const vidBtn = vidMatteButton(ref, name);
  const inner = `${thumb}
      <span class="asset-picker-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
  // A raster folder image splits into wrapper + pick button (like a user card) so the
  // Upscale / Remove-background siblings are valid HTML; a video image does the same
  // for its Remove-background sibling. Everything else stays the single plain pick button.
  if (!upBtn && !cutBtn && !vidBtn) {
    return `
    <button type="button" class="asset-picker-card" data-asset-id="${escapeHtml(ref.id)}" title="${escapeHtml(name)}">
      ${inner}
      ${formatBadge(ref)}
    </button>`;
  }
  return `
    <div class="asset-picker-card asset-picker-card-actionable">
      <button type="button" class="asset-picker-card-pick" data-asset-id="${escapeHtml(ref.id)}" title="${escapeHtml(name)}">
        ${inner}
      </button>
      ${upBtn}
      ${cutBtn}
      ${vidBtn}
      ${formatBadge(ref)}
    </div>`;
}
