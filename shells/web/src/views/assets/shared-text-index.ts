// SPDX-License-Identifier: MPL-2.0
/** Extraction remains local until a curator reviews and explicitly publishes the words. */
import { inspectCatalogAsset, inspectedFile, saveReviewedText, sharedAssetId, CatalogCurationError } from '../../catalog/curation.ts';
import { getInstanceBase } from '../../lib/instance.ts';
import { t } from '../../i18n.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

const MAX_TEXT = 8192;

export async function prepareSharedTextReview(ref: AssetRef, root: HTMLElement | null, refresh: () => void) {
  const id = sharedAssetId(ref); if (!id || !root) return null;
  const origin = getInstanceBase(), controller = new AbortController();
  root.closest('dialog')?.addEventListener('close', () => controller.abort(), { once: true });
  const alive = () => root.isConnected && !controller.signal.aborted && origin === getInstanceBase();
  try {
    const value = await inspectCatalogAsset(id, controller.signal);
    if (!alive() || !value.canEdit || !value.textIndex) return null;
    const file = inspectedFile(value, ref);
    const changed = (String(ref.version ?? '') !== value.textIndex.assetVersion && !(id.startsWith('inst/') && String(ref.version ?? '') === String(value.version ?? '')))
      || (typeof ref.meta?.originalChecksum === 'string' && !!file?.checksum && ref.meta.originalChecksum !== file.checksum);
    return { offer(text: string, method: 'ocr' | 'digital') {
      if (!alive()) return;
      root.querySelector('[data-text-review]')?.remove();
      const section = document.createElement('section'); section.dataset.textReview = ''; section.className = 'cat-text-review';
      root.append(section);
      if (changed || !file) { section.textContent = t('This file no longer matches the indexed source. Open the current asset and read it again before adding text to shared search.'); return; }
      const heading = document.createElement('h3'); heading.textContent = t('Review text for shared search');
      const lead = document.createElement('p'); lead.textContent = t('Saving sends these words to your organisation so members who can access this asset can find it by its text. Nothing has been sent yet.');
      const source = document.createElement('p'); source.textContent = `${file.name} · ${file.role === 'rendition' ? t('Rendition') : file.role === 'original' ? t('Original') : t('File role unknown')} · ${method === 'ocr' ? t('Text recognition') : t('Document text')}`;
      const form = document.createElement('form'), label = document.createElement('label'), input = document.createElement('textarea');
      label.className = 'cat-shared-field'; label.textContent = t('Reviewed search text');
      input.className = 'field-input'; input.rows = 6; input.maxLength = MAX_TEXT; input.required = true; input.value = text.slice(0, MAX_TEXT);
      label.append(input);
      const button = document.createElement('button'); button.type = 'submit'; button.className = 'btn'; button.textContent = t('Add reviewed text to shared search');
      const status = document.createElement('p'); status.setAttribute('role', 'status');
      const limit = document.createElement('p'); limit.textContent = text.length > MAX_TEXT
        ? t('Only the first 8192 characters are included. Review this excerpt before saving.') : t('Up to 8192 characters can be indexed. Review and correct any recognition mistakes.');
      form.append(label, limit, button, status); section.append(heading, lead, source, form);
      form.addEventListener('submit', async event => {
        event.preventDefault(); if (!alive() || button.disabled || !input.value.trim() || !form.reportValidity()) return;
        button.disabled = true; input.disabled = true; status.textContent = t('Saving reviewed text…');
        try {
          await saveReviewedText(id, value.textIndex!.revision, { text: input.value, fileId: file.id, method }, controller.signal);
          if (alive()) { status.textContent = t('Reviewed text added to shared search.'); lead.textContent = t('These reviewed words are stored in the organisation search index. Reopen asset details to remove indexed text.'); refresh(); }
        } catch (error) {
          if (alive()) status.textContent = error instanceof CatalogCurationError && error.status === 409
            ? t('The source has changed. Your text was not saved. Open the current asset and read it again.')
            : t('Reviewed text could not be saved. Your edits are still here. Check your access and try again.');
        } finally { if (alive()) { button.disabled = false; input.disabled = false; } }
      });
    } };
  } catch { return null; }
}
