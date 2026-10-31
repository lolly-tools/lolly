// SPDX-License-Identifier: MPL-2.0
/** Keep the catalog's document surface and details reachable on small screens. */
import { t } from '../i18n.ts';

let nextDetailsId = 0;

export function mountAssetViewerDetails(dialog: HTMLDialogElement): void {
  const body = dialog.querySelector<HTMLElement>('.cat-details-body');
  if (!body) return;
  body.id = `asset-viewer-details-${++nextDetailsId}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm asset-viewer-details-toggle';
  button.textContent = t('Details');
  button.setAttribute('aria-controls', body.id);
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', () => {
    const showing = dialog.classList.toggle('is-showing-details');
    button.setAttribute('aria-expanded', String(showing));
    button.textContent = showing ? t('Back to preview') : t('Details');
  });
  // The button sits in the dialog's header, beside Close: anywhere else on a phone the
  // header covers it, and the details could not be opened at all.
  const header = dialog.querySelector<HTMLElement>(':scope > .cat-details-header');
  const close = header?.querySelector<HTMLElement>(':scope > .cat-details-close');
  if (close) close.before(button); else if (header) header.append(button); else dialog.prepend(button);
}
