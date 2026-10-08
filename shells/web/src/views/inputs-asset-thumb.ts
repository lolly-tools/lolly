// SPDX-License-Identifier: MPL-2.0
/** Select a sidebar preview that can display the asset's actual media type. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { audioThumbPlaceholder } from '../lib/audio-thumb.ts';
import { peaksFingerprint } from '../lib/audio-peaks.ts';
import { icon } from '../lib/icons.ts';
import { thumbImgHtml } from '../lib/asset-thumb-src.ts';
import { escape as escapeHtml } from '../utils.ts';

export function assetInputThumbnail(value: AssetRef | null): string {
  if (value?.type === 'lottie') {
    return '<span class="asset-picker-thumb-inline asset-picker-thumb-lottie" aria-hidden="true">&#9654;</span>';
  }
  if (value?.type === 'model') {
    return `<span class="asset-picker-thumb-inline asset-picker-thumb-lottie" aria-hidden="true">${icon('box', { size: 40 })}</span>`;
  }
  if (value?.type === 'audio') {
    return `<span class="asset-picker-thumb-inline asset-picker-thumb-audio" data-audio-thumb="${escapeHtml(value.id)}" data-audio-fp="${escapeHtml(peaksFingerprint(value))}" aria-hidden="true">${audioThumbPlaceholder({})}</span>`;
  }
  if (!value?.url) return '';
  if (value.type === 'video') {
    return `<video class="asset-picker-thumb-inline" src="${escapeHtml(value.url)}#t=0.1" muted playsinline preload="metadata" aria-hidden="true"></video>`;
  }
  // A vector draws its own SVG (crisp at the preview's size); a raster keeps the exact
  // bytes picked, since a treated photo's thumb would still show the untreated one.
  return thumbImgHtml(value, 'asset-picker-thumb-inline', { preferThumb: false });
}
