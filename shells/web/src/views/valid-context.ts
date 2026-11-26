// SPDX-License-Identifier: MPL-2.0
/** People, destinations and places recorded in an asset, kept separate by source. */
import type { FileMetadata } from '@lolly/engine';
import type { VerifyReport } from './valid-verdict.ts';
import { WORLD_VIEWBOX, WORLD_LAND_PATH, projectLatLon } from './world-map.ts';
import { escape as esc } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { metadataUrl, metadataLinkHtml, contactUrl, contactLinkHtml, metadataValueHtml } from './valid-links.ts';
import { hasHashVerdict, hashFailed } from './valid-verdict.ts';

interface Contact { name: string; source: string; role: string; values: string[]; }
export interface RecordedLink { url: string; sources: string[]; }
const emails = (value: string): string[] => [...value.slice(0, 8192).matchAll(/[a-z\d.!#$&'*+\-/=_`{|}~]+@[a-z\d.-]+\.[a-z]{2,}/gi)].map((m) => m[0]);

export function recordedLinks(meta?: FileMetadata): RecordedLink[] {
  const links = new Map<string, RecordedLink>();
  const fields = [...(meta?.fields ?? []), ...(meta?.appended?.metadata?.fields ?? []).map((f) => ({ ...f, source: `${meta?.appended?.metadata?.name}: ${f.source ?? f.label}` }))];
  for (const f of fields.slice(0, 256)) {
    for (const match of f.value.slice(0, 8192).matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const url = metadataUrl(f.value) ?? metadataUrl(match[0].replace(/[),.;!?\]}]+$/, ''));
      if (!url || links.size >= 64 && !links.has(url)) continue;
      const source = f.source ?? f.label;
      const entry = links.get(url) ?? { url, sources: [] };
      if (!entry.sources.includes(source)) entry.sources.push(source);
      links.set(url, entry);
    }
  }
  return [...links.values()];
}

/** A contact mentioned in prose is not assigned to the creator or signer. */
export function recordedContacts(report: VerifyReport, meta?: FileMetadata): Contact[] {
  const contacts: Contact[] = [];
  if (report.found && report.author) {
    const a = report.author;
    contacts.push({ name: a.name || t('Unnamed creator'), role: t('Creator'), source: report.state === 'valid' && hasHashVerdict(report) && !hashFailed(report) ? t('Intact C2PA declaration') : t('Unverified C2PA declaration'), values: [a.email, a.url].filter((v): v is string => !!v) });
  }
  const signer = report.signer;
  if (report.found && signer && (signer.commonName || signer.identity?.email)) contacts.push({ name: signer.commonName || signer.identity?.email || '', role: t('Signer'), source: signer.identity ? t('Verified certificate identity') : t('Unverified certificate identity'), values: [signer.identity?.email].filter((v): v is string => !!v) });
  const fields = meta?.fields ?? [];
  const authors = [...new Set(fields.filter((f) => f.group === 'authorship' && /^(Author|Artist|Creator|By-line)$/.test(f.label)).map((f) => f.value))].slice(0, 8);
  const explicit = fields.filter((f) => /^Contact |^Email$|^Phone$|^Website$/i.test(f.label));
  for (const name of authors) contacts.push({ name, role: t('Creator'), source: t('Metadata'), values: authors.length === 1 ? explicit.map((f) => f.value) : [] });
  if (explicit.length && authors.length !== 1) contacts.push({ name: t('Recorded contact'), role: t('Contact'), source: t('Metadata'), values: explicit.map((f) => f.value) });
  const known = new Set(contacts.flatMap((c) => [...emails(c.name), ...c.values.flatMap(emails)]));
  for (const f of fields.slice(0, 256)) {
    for (const email of emails(f.value)) {
      if (known.has(email) || contacts.length >= 16) continue;
      known.add(email);
      contacts.push({ name: email, role: t('Contact mentioned'), source: f.source ?? f.label, values: [email] });
    }
  }
  return contacts;
}

const contactValue = (value: string): string => {
  if (contactUrl(value)) return contactLinkHtml(value);
  const matches = emails(value);
  if (matches.length && !/https?:/i.test(value)) return matches.map(contactLinkHtml).join(' · ');
  return metadataValueHtml(value);
};

export function renderLocator(lat: number, lon: number): string {
  const { x, y } = projectLatLon(lat, lon);
  return `<svg class="valid-locator" viewBox="${WORLD_VIEWBOX}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(t('World map with a pin at the recorded location'))}">
    <rect class="valid-locator-sea" x="151.67" y="242.58" width="656.66" height="288.84" rx="7"/>
    <path class="valid-locator-land" d="${WORLD_LAND_PATH}"/>
    <g class="valid-locator-pin" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path class="valid-locator-tick" d="M0,-15V-7 M0,7V15 M-15,0H-7 M7,0H15"/><circle class="valid-locator-halo" r="9"/><circle class="valid-locator-dot" r="3"/></g></svg>`;
}

export function locationCardHtml(meta?: FileMetadata, withMap = true): string {
  const gps = meta?.gps;
  if (!gps || !Number.isFinite(gps.lat) || !Number.isFinite(gps.lon) || Math.abs(gps.lat) > 90 || Math.abs(gps.lon) > 180) return '';
  return `<section class="valid-origin-card valid-location-card"><h3>${icon('mapPin')}<span>${t('Recorded location')}</span><small>${t('EXIF')}</small></h3>${withMap ? renderLocator(gps.lat, gps.lon) : ''}<div class="valid-location-caption"><strong>${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}</strong><div class="valid-location-actions">${meta.mapUrl ? metadataLinkHtml(meta.mapUrl, t('Open map')) : ''}<button type="button" class="btn" data-request-address data-lat="${gps.lat.toFixed(5)}" data-lon="${gps.lon.toFixed(5)}">${icon('mapPin')}<span>${t('Request address')}</span></button></div></div><p class="valid-origin-note">${t('Precise location from editable metadata. Map displayed offline.')}</p></section>`;
}

export function contextCardsHtml(report: VerifyReport, meta?: FileMetadata, withMap = true): string {
  const contacts = recordedContacts(report, meta);
  const links = recordedLinks(meta);
  const row = (link: RecordedLink): string => {
    const url = new URL(link.url);
    return `<li><span class="valid-link-icon" aria-hidden="true">${icon('link')}</span><div>${metadataLinkHtml(link.url, url.host)}<span class="valid-recorded-path">${esc(url.pathname + url.search + url.hash)}</span><small>${esc(link.sources.join(' · '))}</small></div><button type="button" class="btn valid-icon-button" data-copy-evidence="${esc(link.url)}" aria-label="${esc(t('Copy link'))}" title="${esc(t('Copy link'))}">${icon('duplicate')}</button></li>`;
  };
  return `<div class="valid-context-cards">${contacts.length ? `<section class="valid-origin-card valid-people"><h3>${icon('users')}<span>${t('People & contacts')}</span></h3><div class="valid-contact-grid">${contacts.map((c) => `<article class="valid-contact"><span class="valid-contact-avatar" aria-hidden="true">${icon(c.role === t('Signer') ? 'seal' : 'user')}</span><div><span class="valid-origin-label">${esc(c.role)}</span><strong>${esc(c.name)}</strong><small>${esc(c.source)}</small>${c.values.length ? `<ul>${[...new Set(c.values)].slice(0, 12).map((v) => `<li>${contactValue(v)}</li>`).join('')}</ul>` : ''}</div></article>`).join('')}</div></section>` : ''}
    ${locationCardHtml(meta, withMap)}
    ${links.length ? `<section class="valid-origin-card valid-recorded-links"><h3>${icon('link')}<span>${t('Links in this file')}</span><small>${links.length}</small></h3><p class="valid-origin-note">${t('Unverified destinations. Review before opening.')}</p><ul class="valid-link-list">${links.slice(0, 4).map(row).join('')}</ul>${links.length > 4 ? `<details class="valid-more-links"><summary>${icon('link')}<span>${t('Show {n} more links', { n: links.length - 4 })}</span>${icon('chevronDown')}</summary><ul class="valid-link-list">${links.slice(4).map(row).join('')}</ul></details>` : ''}</section>` : ''}
  </div>`;
}

export function journeyEvidenceLabel(report: VerifyReport): string {
  return report.state === 'valid' && hasHashVerdict(report) && !hashFailed(report)
    ? t('Recorded in Content Credentials') : t('Recorded in unverified Content Credentials');
}
