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
    button.textContent = t(showing ? 'Back to preview' : 'Details');
  });
  dialog.prepend(button);
}
