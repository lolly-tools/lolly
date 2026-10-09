// SPDX-License-Identifier: MPL-2.0
/** Asset rows use metadata already loaded for the grid, without extra reads. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { assetModifiedAt } from '../assets-filter.ts';
import { fmtBytes, relativeTime } from '../../lib/format.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { t } from '../../i18n.ts';

export const assetDetailsId = (ref: AssetRef): string => `cat-details-${encodeURIComponent(ref.id)}`;

export function assetRowDetails(ref: AssetRef): string {
  const at = assetModifiedAt(ref);
  const bytes = Number(ref.meta?.bytes ?? ref.meta?.size);
  const cells = [ref.format?.toUpperCase() || ref.type, Number.isFinite(bytes) && bytes > 0 ? fmtBytes(bytes) : '', at ? relativeTime(new Date(at).toISOString()) : ''];
  return `<span class="cat-tile-details" id="${escapeHtml(assetDetailsId(ref))}">${cells.map((value, i) => `<span class="cat-tile-detail cat-tile-detail--${['type', 'size', 'modified'][i]}">${escapeHtml(value)}</span>`).join('')}</span>`;
}

export function assetListHead(): string {
  return `<div class="cat-listhead" aria-hidden="true"><span>${t('Name')}</span><span>${t('Type')}</span><span class="cat-listhead-size">${t('Size')}</span><span class="cat-listhead-modified">${t('Last modified')}</span></div>`;
}
