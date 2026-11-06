// SPDX-License-Identifier: MPL-2.0
/** Metadata links with an explicit destination warning before navigation. */
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { visibleTextHtml } from '../lib/invisible-chars.ts';
import { icon } from '../lib/icons.ts';
import { mountModal } from '../components/modal.ts';

export function metadataUrl(value: string): string | null {
  if (value.length > 2048 || /[\p{Cc}\p{Cf}\s]/u.test(value) || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Only a single recipient or phone number; no message headers or dial commands. */
export function contactUrl(value: string): string | null {
  if (value.length > 320 || /[\p{Cc}\p{Cf}]/u.test(value)) return null;
  const email = value.replace(/^mailto:/i, '');
  if (/^[a-z\d.!#$&'*+\-/=_`{|}~]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}$/i.test(email)) return `mailto:${email}`;
  const phone = value.replace(/^tel:/i, '');
  if (/^\+?[\d ()-]{7,30}$/.test(phone) && phone.replace(/\D/g, '').length >= 7) return `tel:${phone.replace(/[ ()-]/g, '')}`;
  return null;
}

export function contactLinkHtml(value: string): string {
  const url = contactUrl(value);
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - contactUrl() returns only a mailto: or tel: address built from a checked recipient or number
  return url ? `<a class="valid-metadata-link" href="${esc(url)}" data-metadata-url="${esc(url)}" title="${esc(t('Unverified contact from this file. Review before opening.'))}">${icon(url.startsWith('mailto:') ? 'mail' : 'link')}<span>${esc(value.replace(/^(?:mailto|tel):/i, ''))}</span></a>` : esc(value);
}

export function metadataLinkHtml(value: string, label = value): string {
  const url = metadataUrl(value);
  if (!url) return esc(label);
  // nosemgrep: lolly-href-escape-is-not-scheme-validation - metadataUrl() returns only a parsed http: or https: address with no credentials
  return `<a class="valid-metadata-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-metadata-url="${esc(url)}" title="${esc(t('Unverified link from this file. Review before opening.'))}" aria-label="${esc(label)} (${esc(t('unverified external link'))})">${esc(label)}<span aria-hidden="true"> ↗</span></a>`;
}

/** Link web addresses in prose without interpreting markup, scripts or local paths. */
export function metadataValueHtml(value: string): string {
  if (metadataUrl(value)) return metadataLinkHtml(value);
  return linkedText(value.slice(0, 8192), esc);
}

/** Keep invisible-character evidence visible when linkifying a text extract. */
export function visibleLinkedTextHtml(value: string): string {
  return linkedText(value.slice(0, 65536), (text) => visibleTextHtml(text, 'valid-invis'));
}

function linkedText(text: string, renderText: (text: string) => string): string {
  let html = '', offset = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
    const url = match[0].replace(/[),.;!?\]}]+$/, '');
    const index = match.index!;
    html += renderText(text.slice(offset, index)) + (metadataUrl(url) ? metadataLinkHtml(url) : renderText(url));
    offset = index + url.length;
  }
  return html + renderText(text.slice(offset));
}

export function wireMetadataLinks(root: HTMLElement): void {
  const openWarning = (event: MouseEvent) => {
    if (event.button === 2 || event.defaultPrevented) return;
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-metadata-url]') : null;
    const value = button?.dataset.metadataUrl ?? '';
    const url = metadataUrl(value) ?? (/^(?:mailto|tel):/i.test(value) ? contactUrl(value) : null);
    if (!url) return;
    event.preventDefault();
    const contact = /^(?:mailto|tel):/.test(url);
    // nosemgrep: lolly-href-escape-is-not-scheme-validation - url passed metadataUrl() (http/https only) or contactUrl() (mailto/tel only) just above
    const open = `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-link-open>${contact ? t('Open contact app') : t('Open link')} ↗</a>`;
    const modal = mountModal(`<h2 class="modal-title">${t('Open external link?')}</h2>
      <p class="modal-msg">${t('This address comes from the file. Its destination and safety have not been verified.')}</p>
      <p class="valid-link-destination">${esc(url)}</p>
      ${contact ? `<p class="modal-msg">${t('This opens your email or phone app. Review the recipient before sending or calling.')}</p>` : ''}
      ${url.startsWith('http:') ? `<p class="modal-msg">${t('This connection is not encrypted.')}</p>` : ''}
      <div class="modal-actions"><button type="button" class="btn" data-link-cancel>${t('Cancel')}</button>${open}</div>`, {
      className: 'modal valid-link-dialog', ariaLabel: t('Open external link?'),
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-link-cancel]'),
    });
    modal.el.querySelector('[data-link-cancel]')?.addEventListener('click', () => modal.close());
    modal.el.querySelector('[data-link-open]')?.addEventListener('click', () => { setTimeout(() => modal.close(), 0); });
  };
  root.addEventListener('click', openWarning);
  root.addEventListener('auxclick', openWarning);
}
