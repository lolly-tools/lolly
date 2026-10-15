// SPDX-License-Identifier: MPL-2.0
/** Organisation fields are local overlays; this editor never rewrites upstream source facts. */
import { instanceFetch, instancePath, getInstanceBase } from '../../lib/instance.ts';
import { t } from '../../i18n.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
interface Field { id: string; label: string; kind: 'text' | 'date' | 'url' | 'select'; required?: boolean; options?: string[] }

export async function mountSharedMetadata(root: HTMLElement, ref: AssetRef, refresh: () => void): Promise<void> {
  const id = String(ref.meta?.assetGroupId ?? ref.id.split('?')[0]);
  if (!/^(ext|inst)\/[A-Za-z0-9._/-]+$/.test(id) || id.includes('..')) return;
  const origin = getInstanceBase();
  const controller = new AbortController();
  root.closest('dialog')?.addEventListener('close', () => controller.abort(), { once: true });
  const path = instancePath(`/api/v1/catalog/assets/${id}`);
  try {
    const response = await instanceFetch(path, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return;
    const value = await response.json() as { id: string; canEdit?: boolean; fields?: Record<string, string>; fieldDefs?: Field[] };
    if (!root.isConnected || origin !== getInstanceBase() || value.id !== id) return;
    const fields = (value.fieldDefs ?? []).filter(field => /^[a-z0-9][a-z0-9-]{0,39}$/.test(field.id)).slice(0, 100);
    const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] => {
      const node = root.ownerDocument.createElement(tag);
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const details = element('details');
    details.append(element('summary', t('Organisation metadata')), element('p', t('These fields belong to this organisation. Source metadata stays with the connected library.')));
    if (!fields.length) details.append(element('p', t('No organisation fields are configured.')));
    else if (!value.canEdit) {
      const list = element('dl');
      for (const field of fields) list.append(element('dt', field.label), element('dd', value.fields?.[field.id] ?? t('Not recorded')));
      details.append(list);
    } else {
      const form = element('form');
      for (const field of fields) {
        const label = element('label', field.label); label.className = 'cat-shared-field';
        const control = field.kind === 'select' ? element('select') : element('input');
        if (control instanceof HTMLSelectElement) {
          const blank = element('option'); blank.value = ''; control.append(blank);
          for (const option of field.options ?? []) { const node = element('option', option); node.value = option; control.append(node); }
        } else { control.type = field.kind === 'date' ? 'date' : field.kind === 'url' ? 'url' : 'text'; control.maxLength = 4000; }
        control.name = field.id; control.required = !!field.required;
        control.setAttribute('aria-label', field.label); control.value = value.fields?.[field.id] ?? '';
        label.append(control); form.append(label);
      }
      const button = element('button', t('Save metadata')); button.type = 'submit'; button.className = 'btn';
      const status = element('p'); status.setAttribute('role', 'status'); status.dataset.metadataStatus = '';
      form.append(button, status); details.append(form);
    }
    root.replaceChildren(details);
    root.querySelector('form')?.addEventListener('submit', async event => {
      event.preventDefault(); if (controller.signal.aborted || origin !== getInstanceBase()) return;
      const form = event.currentTarget as HTMLFormElement, button = form.querySelector<HTMLButtonElement>('button')!, status = form.querySelector<HTMLElement>('[data-metadata-status]')!;
      const data = new FormData(form), patch = Object.fromEntries(fields.filter(field => String(data.get(field.id) ?? '') !== (value.fields?.[field.id] ?? '')).map(field => [field.id, String(data.get(field.id) ?? '') || null]));
      if (!Object.keys(patch).length) { status.textContent = t('No changes to save.'); return; }
      button.disabled = true;
      try {
        const saved = await instanceFetch(`${path}/meta`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fields: patch }), signal: controller.signal });
        if (!saved.ok) throw new Error(saved.status === 401 || saved.status === 403 ? t('You no longer have permission to edit these fields.') : t('Metadata could not be saved. Refresh and try again.'));
        value.fields = { ...value.fields, ...Object.fromEntries(Object.entries(patch).map(([key, next]) => [key, next ?? ''])) };
        if (root.isConnected) status.textContent = t('Metadata saved.');
        refresh();
      } catch (error) { if (root.isConnected) status.textContent = error instanceof Error ? error.message : t('Metadata could not be saved.'); }
      finally { button.disabled = false; }
    });
  } catch { /* A failed metadata read does not prevent inspection of the selected file. */ }
}
