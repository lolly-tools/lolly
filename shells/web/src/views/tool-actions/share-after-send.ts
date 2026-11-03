// SPDX-License-Identifier: MPL-2.0
/**
 * share-after-send - the "Create a share link" offer under a finished Send.
 *
 * Only appears when the provider made a handle for the file (`SendOutcome.ref`),
 * can make links, and the person has not switched share links off for that provider. Pressing
 * the button opens the same panel the Share dialog uses, over the file that is already at
 * the provider, so nothing is uploaded a second time. The export panel's own status
 * line and send flow are otherwise untouched.
 */

import { t } from '../../i18n.ts';
import { canShare, type SendOutcome, type SendTarget } from '../../lib/send-target.ts';

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

/** Add the offer beside `status`. Safe to call for any outcome; does nothing when
 *  no link can be made. */
export function offerShareLink(status: HTMLElement, target: SendTarget, out: SendOutcome, fileName: string): void {
  const card = status.closest<HTMLElement>('.export-send');
  card?.querySelector('[data-share-after]')?.remove();
  if (!out.ref || !card || !canShare(target)) return;
  const ref = out.ref;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--sm';
  button.dataset.shareAfterOpen = '';
  button.setAttribute('aria-expanded', 'false');
  button.textContent = t('Create a share link');
  status.append(' ', button);
  button.addEventListener('click', async () => {
    const existing = card.querySelector('[data-share-after]');
    if (existing) { existing.remove(); button.setAttribute('aria-expanded', 'false'); return; }
    const { createShareLinkPanel } = await import('../../components/share-link-panel.ts');
    const { primeShareState } = await import('../../lib/share-links.ts');
    await primeShareState();
    const box = document.createElement('div');
    box.dataset.shareAfter = '';
    box.style.cssText = 'margin-top:.6rem';
    box.append(createShareLinkPanel({
      target, fileName, actionLabel: t('Create link'), copy: copyText,
      ...(out.url ? { openUrl: out.url } : {}),
      getRef: async () => ({ ref, ...(out.url ? { openUrl: out.url } : {}) }),
    }));
    card.append(box);
    button.setAttribute('aria-expanded', 'true');
  });
}
