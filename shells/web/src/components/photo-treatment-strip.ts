// SPDX-License-Identifier: MPL-2.0
/** Photo look choices and a single load shared by the picker's catalogue and uploads. */
import { treatmentFilterSvg, type PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';
import { photoTreatmentSwatch } from '../lib/photo-treatment-swatch.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';

export function createPhotoTreatmentLoader(read: () => Promise<PhotoTreatment[]>, apply: (list: PhotoTreatment[]) => void): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => pending ??= read().catch(() => []).then(apply);
}

export function photoTreatmentStripHtml(treatments: PhotoTreatment[], active: string | null | undefined): string {
  const button = (id: string, label: string, treatment?: PhotoTreatment): string =>
    `<button type="button" class="asset-picker-theme asset-picker-treat${(id || null) === (active || null) ? ' is-active' : ''}" data-treatment-id="${escapeHtml(id)}" aria-pressed="${(id || null) === (active || null)}">`
      + `<span class="asset-picker-treat-sw${treatment ? '' : ' is-none'}"${treatment ? ` style="background:${escapeHtml(photoTreatmentSwatch(treatment))}"` : ''}></span><span>${escapeHtml(label)}</span></button>`;
  return `<div class="asset-picker-treatments" role="group" aria-label="${escapeHtml(t('Photo colour treatment'))}"><span class="asset-picker-themes-label">${t('Colour')}</span>`
    + button('', t('None')) + treatments.map(treatment => button(treatment.id, treatment.label ?? treatment.id, treatment)).join('') + '</div>';
}

/** Use the same preview filter for catalogue pictures and uploaded pictures. */
export function previewPhotoTreatment(root: HTMLElement | null, prefix: string, treatment: PhotoTreatment | undefined, isPhoto: (id: string) => boolean): void {
  for (const card of root?.querySelectorAll<HTMLElement>('[data-asset-id]') ?? []) {
    if (!isPhoto(card.dataset.assetId || '')) continue;
    const image = card.querySelector<HTMLImageElement>('img.asset-picker-thumb');
    if (image) image.style.filter = treatment ? `url(#${prefix}${treatment.id})` : '';
  }
}

/** Install validated catalogue filters once for the picker's live previews. */
export function installPhotoTreatmentFilters(root: HTMLElement, treatments: PhotoTreatment[], prefix: string): void {
  if (!treatments.length || root.querySelector('#lolly-pt-defs')) return;
  const holder = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  holder.id = 'lolly-pt-defs';
  holder.setAttribute('width', '0'); holder.setAttribute('height', '0'); holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<defs>${treatments.map(t => treatmentFilterSvg(t, `${prefix}${t.id}`)).join('')}</defs>`;
  root.appendChild(holder);
}
