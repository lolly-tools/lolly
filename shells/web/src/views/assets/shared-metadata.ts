// SPDX-License-Identifier: MPL-2.0
/** Source facts and organisation overlays have separate presentation and authority. */
import { inspectCatalogAsset, inspectedFile, saveCatalogFields, saveReviewedText, sharedAssetId, type AssetInspection, type CatalogField } from '../../catalog/curation.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { escape as esc } from '../../utils.ts';
import { t } from '../../i18n.ts';
import type { BrowseSource } from '../../catalog/browse.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

const date = (value: unknown): string => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : t('Not recorded');
const row = (label: string, value: unknown) => `<div><dt>${esc(t(label))}</dt><dd>${esc(String(value ?? t('Not recorded')))}</dd></div>`;
export function sourceFactsHtml(value: AssetInspection, ref: AssetRef, source?: BrowseSource): string {
  const meta = value.meta ?? {}, approved = meta.providerApproved;
  const lifecycle = value.lifecycle;
  const file = inspectedFile(value, ref);
  const role = file?.role ?? ref.meta?.fileRole;
  return `<section class="cat-shared-facts"><h3>${t('Source facts')}</h3><dl class="cat-details-meta">
    ${row('Library', meta.providerLabel ?? (value.id.startsWith('inst/') ? t('Organisation catalog') : value.provider))}
    ${row('Source ID', value.provider ?? 'instance')}${row('Indexed version', value.version)}
    ${row('Source modified', date(value.updatedAt))}${row('Last successful sync', date(source?.lastSyncedAt))}
    ${row('Listing status', source ? t(({ current: 'Current listing', stale: 'Cached listing', pending: 'Syncing', unavailable: 'Unavailable' })[source.status]) : t('Not recorded'))}
    ${row('Catalog availability', ({ live: t('Available'), scheduled: t('Scheduled'), expired: t('Expired'), revoked: t('Revoked') } as Record<string, string>)[value.state ?? ''] ?? t('Unknown'))}
    ${row('Source available from', date(value.availableFrom ?? lifecycle?.upstream?.availableFrom))}
    ${row('Source available until', date(value.availableUntil ?? lifecycle?.upstream?.availableUntil))}
    ${row('Organisation valid from', date(lifecycle?.validFrom))}${row('Organisation valid until', date(lifecycle?.validUntil))}
    ${row('Source approval', approved === true ? t('Approved in source') : approved === false ? t('Not approved in source') : t('Unknown'))}
    ${row('Selected file', file?.name ?? ref.meta?.name)}${row('File role', role === 'original' ? t('Original') : role === 'rendition' ? t('Rendition') : t('Unknown'))}
    ${meta.providerOriginalsAvailable === false ? row('Original availability', t('Unavailable through this connection')) : ''}
    </dl><p>${t('These are indexed source facts. File access is checked when opened. Source approval does not establish permission for every use.')}</p></section>`;
}
export function validFields(value: unknown): CatalogField[] {
  if (!Array.isArray(value)) return [];
  return value.filter((field): field is CatalogField => !!field && typeof field === 'object' && typeof field.id === 'string'
    && /^[a-z0-9][a-z0-9-]{0,39}$/.test(field.id) && typeof field.label === 'string'
    && ['text', 'date', 'url', 'select'].includes(field.kind)
    && (field.kind !== 'select' || (Array.isArray(field.options) && field.options.every((option: unknown) => typeof option === 'string')))).slice(0, 100);
}
const indexLabel = (value: AssetInspection) => t(({ none: 'No shared text index.', current: 'Reviewed text is searchable for this indexed revision.',
  stale: 'The source changed. Previously indexed text is excluded from search. Read the current file again.',
  unverified: 'Existing indexed text has no recorded source revision.' })[value.textIndex?.status ?? 'none']);

export async function mountSharedMetadata(root: HTMLElement, ref: AssetRef, refresh: () => void, source?: BrowseSource): Promise<void> {
  const id = sharedAssetId(ref); if (!id) return;
  const origin = getInstanceBase(), controller = new AbortController();
  root.closest('dialog')?.addEventListener('close', () => controller.abort(), { once: true });
  const alive = () => root.isConnected && !controller.signal.aborted && origin === getInstanceBase();
  const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
    const node = root.ownerDocument.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const statusLine = (text: string) => { const node = element('p', text); node.setAttribute('role', 'status'); return node; };
  root.replaceChildren(statusLine(t('Loading shared asset details…')));
  try {
    const value = await inspectCatalogAsset(id, controller.signal); if (!alive()) return;
    const fields = validFields(value.fieldDefs);
    const values = value.fields ?? {};
    const facts = element('div'); facts.innerHTML = sourceFactsHtml(value, ref, source);
    const details = element('details');
    details.append(element('summary', t('Organisation metadata')), element('p', t('These fields belong to this organisation. Source metadata stays with the connected library.')));
    if (!fields.length) details.append(element('p', t('No organisation fields are configured.')));
    else if (!value.canEdit) {
      const list = element('dl'); list.className = 'cat-details-meta';
      for (const field of fields) { const entry = element('div'); entry.append(element('dt', field.label), element('dd', values[field.id] ?? t('Not recorded'))); list.append(entry); }
      details.append(list);
    } else {
      const form = element('form');
      for (const field of fields) {
        const label = element('label', field.label + (field.required ? ` (${t('required')})` : '')); label.className = 'cat-shared-field';
        const control = field.kind === 'select' ? element('select') : element('input');
        if (control instanceof HTMLSelectElement) {
          const blank = element('option'); blank.value = ''; control.append(blank);
          for (const option of field.options ?? []) { const node = element('option', option); node.value = option; control.append(node); }
        } else { control.type = field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'; control.maxLength = 4000; }
        control.className = 'field-input'; control.name = field.id; control.required = !!field.required;
        control.setAttribute('aria-label', field.label); control.value = values[field.id] ?? '';
        label.append(control); form.append(label);
      }
      const button = element('button', t('Save metadata')); button.type = 'submit'; button.className = 'btn';
      const status = statusLine(''); status.dataset.metadataStatus = '';
      form.append(button, status); details.append(form);
    }
    if (value.fieldsUpdatedAt) details.append(element('p', `${t('Last organisation edit')}: ${date(value.fieldsUpdatedAt)}`));
    root.replaceChildren(...facts.childNodes, details);
    if (value.textIndex) {
      const section = element('section'); section.className = 'cat-shared-index';
      const status = statusLine(indexLabel(value)); status.dataset.indexStatus = '';
      section.append(element('h3', t('Shared text search')), status);
      if (value.textIndex.source) section.append(element('p', `${value.textIndex.source.method === 'ocr' ? t('Text recognition') : t('Document text')} · ${date(value.textIndex.source.reviewedAt)}`));
      if (value.canEdit && value.textIndex.status !== 'none') { const button = element('button', t('Remove indexed text')); button.type = 'button'; button.className = 'btn btn--ghost'; button.dataset.clearIndex = ''; section.append(button); }
      root.append(section);
    }
    root.querySelector<HTMLButtonElement>('[data-clear-index]')?.addEventListener('click', async event => {
      if (!alive()) return;
      const button = event.currentTarget as HTMLButtonElement, status = root.querySelector<HTMLElement>('[data-index-status]')!; button.disabled = true;
      try { await saveReviewedText(id, value.textIndex!.revision, null, controller.signal); if (alive()) { status.textContent = t('Shared text removed from search.'); button.remove(); refresh(); } }
      catch { if (alive()) { status.textContent = t('Indexed text could not be removed. Refresh the asset and try again.'); button.disabled = false; } }
    });
    root.querySelector('form')?.addEventListener('submit', async event => {
      event.preventDefault(); if (!alive()) return;
      const form = event.currentTarget as HTMLFormElement, button = form.querySelector<HTMLButtonElement>('button')!, status = form.querySelector<HTMLElement>('[data-metadata-status]')!;
      if (button.disabled || !form.reportValidity()) return;
      const data = new FormData(form), patch = Object.fromEntries(fields.filter(field => String(data.get(field.id) ?? '') !== (values[field.id] ?? '')).map(field => [field.id, String(data.get(field.id) ?? '') || null]));
      if (!Object.keys(patch).length) { status.textContent = t('No changes to save.'); return; }
      const controls = form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button');
      for (const control of controls) control.disabled = true;
      status.textContent = t('Saving metadata…');
      try {
        await saveCatalogFields(id, patch, controller.signal); if (!alive()) return;
        Object.assign(values, Object.fromEntries(Object.entries(patch).map(([key, next]) => [key, next ?? ''])));
        status.textContent = t('Metadata saved.'); refresh();
      } catch { if (alive()) status.textContent = t('Metadata could not be saved. Your edits are still here. Check your access and try again.'); }
      finally { if (alive()) for (const control of controls) control.disabled = false; }
    });
  } catch {
    if (!alive()) return;
    const retry = element('button', t('Retry details')); retry.type = 'button'; retry.className = 'btn btn--ghost';
    root.replaceChildren(statusLine(t('Shared asset details could not be loaded. Check your access and connection.')), retry);
    root.querySelector('button')?.addEventListener('click', () => { if (alive()) void mountSharedMetadata(root, ref, refresh, source); }, { once: true });
  }
}
