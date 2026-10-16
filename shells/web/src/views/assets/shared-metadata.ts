// SPDX-License-Identifier: MPL-2.0
/** Source facts and organisation overlays have separate presentation and authority. */
import { inspectCatalogAsset, inspectedFile, saveCatalogFields, saveReviewedText, sharedAssetId, type AssetInspection, type CatalogField } from '../../catalog/curation.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { t } from '../../i18n.ts';
import type { BrowseSource } from '../../catalog/browse.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

const date = (value: unknown): string => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString() : t('Not recorded');
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
    const node = root.ownerDocument.createElement(tag); if (text !== undefined) node.textContent = text; return node;
  };
  const statusNode = (text: string) => { const node = element('p', text); node.setAttribute('role', 'status'); return node; };
  root.replaceChildren(statusNode(t('Loading shared asset details…')));
  try {
    const value = await inspectCatalogAsset(id, controller.signal); if (!alive()) return;
    const fields = validFields(value.fieldDefs), values = value.fields ?? {};
    const meta = value.meta ?? {}, lifecycle = value.lifecycle, file = inspectedFile(value, ref), role = file?.role ?? ref.meta?.fileRole;
    const facts = element('section'); facts.className = 'cat-shared-facts';
    const list = element('dl'); list.className = 'cat-details-meta';
    const factsRows: Array<[string, unknown]> = [
      ['Library', meta.providerLabel ?? (value.id.startsWith('inst/') ? t('Organisation catalog') : value.provider)],
      ['Source ID', value.provider ?? 'instance'], ['Indexed version', value.version],
      ['Source modified', date(value.updatedAt)], ['Last successful sync', date(source?.lastSyncedAt)],
      ['Listing status', source ? t(({ current: 'Current listing', stale: 'Cached listing', pending: 'Syncing', unavailable: 'Unavailable' })[source.status]) : t('Not recorded')],
      ['Catalog availability', ({ live: t('Available'), scheduled: t('Scheduled'), expired: t('Expired'), revoked: t('Revoked') } as Record<string, string>)[value.state ?? ''] ?? t('Unknown')],
      ['Source available from', date(value.availableFrom ?? lifecycle?.upstream?.availableFrom)],
      ['Source available until', date(value.availableUntil ?? lifecycle?.upstream?.availableUntil)],
      ['Organisation valid from', date(lifecycle?.validFrom)], ['Organisation valid until', date(lifecycle?.validUntil)],
      ['Source approval', meta.providerApproved === true ? t('Approved in source') : meta.providerApproved === false ? t('Not approved in source') : t('Unknown')],
      ['Selected file', file?.name ?? ref.meta?.name], ['File role', role === 'original' ? t('Original') : role === 'rendition' ? t('Rendition') : t('Unknown')],
    ];
    if (meta.providerOriginalsAvailable === false) factsRows.push(['Original availability', t('Unavailable through this connection')]);
    for (const [label, text] of factsRows) { const row = element('div'); row.append(element('dt', t(label)), element('dd', String(text ?? t('Not recorded')))); list.append(row); }
    facts.append(element('h3', t('Source facts')), list, element('p', t('These are indexed source facts. File access is checked when opened. Source approval does not establish permission for every use.')));
    const details = element('details');
    details.append(element('summary', t('Organisation metadata')), element('p', t('These fields belong to this organisation. Source metadata stays with the connected library.')));
    if (!fields.length) details.append(element('p', t('No organisation fields are configured.')));
    else if (!value.canEdit) {
      const metadata = element('dl');
      for (const field of fields) metadata.append(element('dt', field.label), element('dd', values[field.id] ?? t('Not recorded')));
      details.append(metadata);
    } else {
      const form = element('form');
      for (const field of fields) {
        const label = element('label', field.label + (field.required ? ` (${t('required')})` : '')); label.className = 'cat-shared-field';
        let control: HTMLInputElement | HTMLSelectElement;
        if (field.kind === 'select') {
          const select = element('select'), blank = element('option'); blank.value = ''; select.append(blank);
          for (const option of field.options ?? []) { const choice = element('option', option); choice.value = option; select.append(choice); }
          control = select;
        } else { const input = element('input'); input.type = field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'; input.maxLength = 4000; control = input; }
        control.className = 'field-input'; control.name = field.id; control.required = !!field.required;
        control.setAttribute('aria-label', field.label); control.value = values[field.id] ?? '';
        label.append(control); form.append(label);
      }
      const button = element('button', t('Save metadata')); button.type = 'submit'; button.className = 'btn';
      const status = statusNode(''); status.dataset.metadataStatus = ''; form.append(button, status); details.append(form);
    }
    if (value.fieldsUpdatedAt) details.append(element('p', `${t('Last organisation edit')}: ${date(value.fieldsUpdatedAt)}`));
    root.replaceChildren(facts, details);
    if (value.textIndex) {
      const index = element('section'); index.className = 'cat-shared-index';
      const status = statusNode(indexLabel(value)); status.dataset.indexStatus = ''; index.append(element('h3', t('Shared text search')), status);
      if (value.textIndex.source) index.append(element('p', `${value.textIndex.source.method === 'ocr' ? t('Text recognition') : t('Document text')} · ${date(value.textIndex.source.reviewedAt)}`));
      if (value.canEdit && value.textIndex.status !== 'none') { const button = element('button', t('Remove indexed text')); button.type = 'button'; button.className = 'btn btn--ghost'; button.dataset.clearIndex = ''; index.append(button); }
      root.append(index);
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
    root.replaceChildren(statusNode(t('Shared asset details could not be loaded. Check your access and connection.')), retry);
    root.querySelector('button')?.addEventListener('click', () => { if (alive()) void mountSharedMetadata(root, ref, refresh, source); }, { once: true });
  }
}
