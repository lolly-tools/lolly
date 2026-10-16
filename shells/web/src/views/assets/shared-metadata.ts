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
  root.innerHTML = `<p role="status">${t('Loading shared asset details…')}</p>`;
  try {
    const value = await inspectCatalogAsset(id, controller.signal); if (!alive()) return;
    const fields = validFields(value.fieldDefs);
    const values = value.fields ?? {};
    const input = (field: CatalogField) => `<label class="cat-shared-field">${esc(field.label)}${field.required ? ` (${t('required')})` : ''}${field.kind === 'select'
      ? `<select class="field-input" aria-label="${esc(field.label)}" name="${field.id}"${field.required ? ' required' : ''}><option value=""></option>${(field.options ?? []).map(option => `<option value="${esc(option)}"${values[field.id] === option ? ' selected' : ''}>${esc(option)}</option>`).join('')}</select>`
      : `<input class="field-input" aria-label="${esc(field.label)}" name="${field.id}" type="${field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'}" value="${esc(values[field.id] ?? '')}" maxlength="4000"${field.required ? ' required' : ''}>`}</label>`;
    root.innerHTML = `${sourceFactsHtml(value, ref, source)}<details><summary>${t('Organisation metadata')}</summary><p>${t('These fields belong to this organisation. Source metadata stays with the connected library.')}</p>
      ${fields.length ? value.canEdit ? `<form>${fields.map(input).join('')}<button type="submit" class="btn">${t('Save metadata')}</button><p role="status" data-metadata-status></p></form>`
        : `<dl class="cat-details-meta">${fields.map(field => row(field.label, values[field.id] ?? t('Not recorded'))).join('')}</dl>` : `<p>${t('No organisation fields are configured.')}</p>`}
      ${value.fieldsUpdatedAt ? `<p>${t('Last organisation edit')}: ${esc(date(value.fieldsUpdatedAt))}</p>` : ''}</details>
      ${value.textIndex ? `<section class="cat-shared-index"><h3>${t('Shared text search')}</h3><p role="status" data-index-status>${indexLabel(value)}</p>${value.textIndex.source ? `<p>${esc(value.textIndex.source.method === 'ocr' ? t('Text recognition') : t('Document text'))} · ${esc(date(value.textIndex.source.reviewedAt))}</p>` : ''}
      ${value.canEdit && value.textIndex.status !== 'none' ? `<button type="button" class="btn btn--ghost" data-clear-index>${t('Remove indexed text')}</button>` : ''}</section>` : ''}`;
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
    root.innerHTML = `<p role="status">${t('Shared asset details could not be loaded. Check your access and connection.')}</p><button type="button" class="btn btn--ghost">${t('Retry details')}</button>`;
    root.querySelector('button')?.addEventListener('click', () => { if (alive()) void mountSharedMetadata(root, ref, refresh, source); }, { once: true });
  }
}
