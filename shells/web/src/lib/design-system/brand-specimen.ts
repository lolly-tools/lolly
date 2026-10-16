// SPDX-License-Identifier: MPL-2.0
/** The same specimen in the system switcher, local library and comparison view. */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeText } from '../../utils.ts';
import { icon } from '../icons.ts';
import { swatchInk, SWATCH_INK } from '../../brand-vars.ts';
export interface BrandPreview { font: string; colors: string[]; colorCount?: number; logoUrl?: string }
/** The ink the specimen's words take on its first colour: the swatch ink (APCA).
 *  design-systems-card.ts picks the reverse logo by the same answer. */
export const specimenInk = (background: string): string => swatchInk(background) ?? SWATCH_INK.dark;
export function brandSpecimenHtml(label: string, preview: BrandPreview, active = false, showStatus = true): string {
  const colors = preview.colors.length ? preview.colors : ['#172b29', '#a5edda', '#f5f8f7'];
  const background = colors[0]!;
  const foreground = specimenInk(background);
  const accent = colors[1] ?? foreground;
  return `<div class="ds-row-preview" style="--ds-preview-bg:${escapeText(background)};--ds-preview-fg:${escapeText(foreground)};--ds-preview-accent:${escapeText(accent)};font-family:${escapeText(preview.font)}" aria-label="${escapeText(tRaw('Preview of {name}', { name: label }))}">
        <div class="ds-preview-top"><span>${escapeText(t('DESIGN SYSTEM'))}</span>${showStatus ? (active ? `<span class="ds-row-active">${icon('check', { size: 12 })} ${t('Active')}</span>` : `<span class="ds-row-active ds-row-use">${t('Use')}</span>`) : ''}</div>
        <div class="ds-preview-composition"><span class="ds-row-preview-type">Aa<span>Bb</span></span><span class="ds-preview-mark" aria-hidden="true">${preview.logoUrl ? `<img src="${escapeText(preview.logoUrl)}" alt="" class="ds-preview-logo">` : ''}<i></i><i></i></span></div>
        <span class="ds-preview-caption">${escapeText(label)}</span>
        <div class="ds-row-preview-swatches" aria-hidden="true">${colors.map(color => `<i style="--ds-swatch:${escapeText(color)}"></i>`).join('')}</div>
      </div>`;
}
