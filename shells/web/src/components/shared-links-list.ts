// SPDX-License-Identifier: MPL-2.0
/**
 * shared-links-list - "Links you've shared": the device-local list of links made
 * after a Send, each with a Stop sharing button where the provider can switch it
 * off. The list holds the link and the grant to remove, never a token (see
 * lib/share-links.ts), and a note under the heading tells the person that.
 */

import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { safeHref } from '../utils.ts';
import { audienceLabel, canStopSharing, forgetSharedLink, isExpired, listSharedLinks, stopSharing } from '../lib/share-links.ts';

/** Build the list; it re-renders itself after a change. Returns null when empty. */
export async function buildSharedLinksList(): Promise<HTMLElement | null> {
  const root = document.createElement('div');
  root.className = 'shared-links-list';
  const render = async (): Promise<void> => {
    const links = await listSharedLinks();
    root.replaceChildren();
    if (!links.length) { root.hidden = true; return; }
    root.hidden = false;
    const head = document.createElement('p');
    head.textContent = t("Links you've shared");
    head.style.cssText = 'margin:.4rem 0 .2rem;font-weight:600;font-size:.85rem';
    const note = document.createElement('p');
    note.textContent = t('Kept on this device only. The list holds no sign-in tokens.');
    note.style.cssText = 'margin:0 0 .4rem;font-size:.8rem;color:hsl(var(--muted-foreground))';
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:.4rem';
    for (const rec of links) {
      const li = document.createElement('li');
      li.style.cssText = 'font-size:.85rem';
      const name = document.createElement(safeHref(rec.url) ? 'a' : 'span');
      if (name instanceof HTMLAnchorElement) { name.href = rec.url; name.target = '_blank'; name.rel = 'noopener'; }
      name.textContent = rec.fileName;
      const meta = document.createElement('span');
      const when = isExpired(rec) ? t('expired') : rec.expiresAt ? t('until {date}', { date: rec.expiresAt.slice(0, 10) }) : t('no expiry');
      meta.textContent = ` - ${rec.providerLabel}, ${audienceLabel(rec.audience)}, ${when}`;
      li.append(name, meta);
      const stop = document.createElement('button');
      stop.type = 'button';
      stop.className = 'btn btn--sm';
      stop.style.marginLeft = '.5rem';
      if (canStopSharing(rec)) {
        stop.textContent = t('Stop sharing');
        stop.addEventListener('click', async () => {
          stop.disabled = true;
          try { await stopSharing(rec); announce(t('Sharing stopped')); await render(); }
          catch (err) { stop.disabled = false; li.append(Object.assign(document.createElement('div'), { textContent: String((err as Error)?.message || t('Could not stop sharing')) })); }
        });
      } else {
        stop.textContent = t('Remove from list');
        stop.title = t('This link cannot be switched off from here; it works until it expires. This only removes it from the list.');
        stop.addEventListener('click', async () => { await forgetSharedLink(rec.id); await render(); });
      }
      li.append(stop);
      ul.append(li);
    }
    root.append(head, note, ul);
  };
  await render();
  return root;
}
