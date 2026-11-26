// SPDX-License-Identifier: MPL-2.0
/**
 * The Neurospicy player's one share card: share this tune, or share this moment. The tune
 * plays from its start for whoever opens the link; the moment plays from where the sharer
 * had got to, with the visualiser as the sharer was seeing it (lib/neuro-share.ts builds
 * both links). The card shows the link it will share, copies it, and offers the device's
 * own share sheet where there is one. A track that cannot travel says why rather than
 * handing out a link that would not play.
 *
 * The standard .modal card (components/modal.ts): Escape and the backdrop close it, and
 * focus starts on the title so a stray key presses nothing.
 */
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { copyText } from '../lib/share-url.ts';
import { mountModal } from './modal.ts';

/** What the player can share right now. A null link is a choice that is not available, with its reason. */
export interface NeuroShareOffer {
  track: string;
  tune: string | null;
  moment: string | null;
  /** Where the moment starts ("bar 12", "1:24", "live") and the look it carries ("Tunnel, Jungle colours"). */
  where: string;
  look: string;
  /** Why there is no tune link, or no moment link. */
  reason?: string;
  momentReason?: string;
}

export function openNeuroShare(offer: NeuroShareOffer): void {
  const titleId = 'neuro-share-title';
  const choice = (id: 'tune' | 'moment', label: string, detail: string, link: string | null, why: string | undefined, checked: boolean): string => `
    <label class="neuro-share-choice${link ? '' : ' is-unavailable'}">
      <input type="radio" name="neuro-share" value="${id}"${checked ? ' checked' : ''}${link ? '' : ' disabled'}>
      <span class="neuro-share-choice-text">
        <span class="neuro-share-choice-label">${escapeHtml(label)}</span>
        <span class="neuro-share-choice-detail">${escapeHtml(link ? detail : (why ?? ''))}</span>
      </span>
    </label>`;
  const first = offer.tune ? 'tune' : offer.moment ? 'moment' : null;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const modal = mountModal<void>(`
    <h2 class="modal-title" id="${titleId}" tabindex="-1">${escapeHtml(t('Share what’s playing'))}</h2>
    <p class="neuro-share-track">${escapeHtml(offer.track)}</p>
    ${first ? `
    <fieldset class="neuro-share-choices">
      <legend class="neuro-share-legend">${escapeHtml(t('What to share'))}</legend>
      ${choice('tune', t('This tune'), t('Plays from the start.'), offer.tune, offer.reason, first === 'tune')}
      ${choice('moment', t('This moment'), t('From {where}, with the visualiser as you see it: {look}.', { where: offer.where, look: offer.look }), offer.moment, offer.momentReason ?? offer.reason, first === 'moment')}
    </fieldset>
    <input class="field-input neuro-share-link" type="text" readonly aria-label="${escapeHtml(t('Link'))}" data-link>
    <p class="neuro-share-status" role="status" aria-live="polite" data-status></p>
    <div class="modal-actions">
      ${canShare ? `<button type="button" class="btn" data-act="share">${escapeHtml(t('Share…'))}</button>` : ''}
      <button type="button" class="btn btn--primary" data-act="copy">${escapeHtml(t('Copy link'))}</button>
    </div>` : `
    <p class="neuro-share-reason">${escapeHtml(offer.reason ?? '')}</p>
    <div class="modal-actions"><button type="button" class="btn" data-act="done">${escapeHtml(t('Done'))}</button></div>`}`, {
    className: 'modal neuro-share',
    ariaLabel: t('Share what’s playing'),
    initialFocus: (el) => el.querySelector<HTMLElement>('.modal-title'),
  });
  const el = modal.el;
  const field = el.querySelector<HTMLInputElement>('[data-link]');
  const status = el.querySelector<HTMLElement>('[data-status]');
  const chosen = (): string => {
    const which = el.querySelector<HTMLInputElement>('input[name="neuro-share"]:checked')?.value;
    return (which === 'moment' ? offer.moment : offer.tune) ?? offer.moment ?? '';
  };
  const show = (): void => { if (field) field.value = chosen(); if (status) status.textContent = ''; };
  for (const radio of el.querySelectorAll<HTMLInputElement>('input[name="neuro-share"]')) radio.addEventListener('change', show);
  field?.addEventListener('focus', () => field.select());
  el.querySelector('[data-act="copy"]')?.addEventListener('click', () => {
    void copyText(chosen())
      .then(() => { if (status) status.textContent = t('Link copied'); })
      .catch(() => { if (status) status.textContent = t('Could not copy. Select the link and copy it yourself.'); field?.select(); });
  });
  el.querySelector('[data-act="share"]')?.addEventListener('click', () => {
    void navigator.share({ title: offer.track, url: chosen() }).catch(() => { /* the sheet was dismissed */ });
  });
  el.querySelector('[data-act="done"]')?.addEventListener('click', () => modal.close());
  show();
}
