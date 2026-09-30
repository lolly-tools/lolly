// SPDX-License-Identifier: MPL-2.0
import { mountModal, type ModalHandle } from '../../components/modal.ts';
import { t } from '../../i18n.ts';
import { escape as e } from '../../utils.ts';

/** Reuse the compiler's inclusion decisions without granting them implicitly. */
export function reviewUsageArtwork(sources: Array<{ id: string; name: string; reason: string }>, signal: AbortSignal, opened: (modal: ModalHandle<void> | undefined) => void): Promise<ReadonlySet<string> | null> {
  if (!sources.length) return Promise.resolve(new Set());
  return new Promise(resolve => {
    let included: ReadonlySet<string> | null = null;
    const modal = mountModal(`<header><h2>${t('Include artwork in the poster file')}</h2><p>${t('Reusable posters include their artwork files. Review the files that need your permission to travel.')}</p></header><form class="usage-rule-form">${sources.map(source => `<label class="usage-resource"><input class="field-check" type="checkbox" name="include" value="${e(source.id)}" required><span>${e(t('I have permission to include {name}.', { name: source.name }))}<small>${e(source.reason)}</small></span></label>`).join('')}<footer><button class="btn" type="button" data-cancel>${t('Cancel')}</button><button class="btn btn--primary" type="submit">${t('Prepare poster file')}</button></footer></form>`, { className: 'modal usage-rule-modal', ariaLabel: t('Review included artwork'), onClose() { signal.removeEventListener('abort', cancel); opened(undefined); resolve(included); } });
    const cancel = (): void => modal.close();
    opened(modal);
    signal.addEventListener('abort', cancel, { once: true });
    modal.el.addEventListener('keydown', event => { if (event.key === 'Escape') event.stopPropagation(); });
    modal.el.querySelector('[data-cancel]')!.addEventListener('click', cancel);
    modal.el.querySelector('form')!.addEventListener('submit', event => {
      event.preventDefault();
      included = new Set([...modal.el.querySelectorAll<HTMLInputElement>('input:checked')].map(input => input.value));
      modal.close();
    });
    if (signal.aborted) cancel();
  });
}
