// SPDX-License-Identifier: MPL-2.0
/** Searchable file choices reuse low-resolution DAM thumbnails, never original bytes. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { assetFiles, selectAssetFile, selectedAssetFile, type AssetFile } from '../lib/asset-files.ts';
import { instancePath } from '../lib/instance.ts';
import { tRaw } from '../i18n.ts';
import { iconNode } from '../lib/icon-node.ts';
export function mountAssetFileList(into: HTMLElement, ref: AssetRef, choose: (file: AssetRef) => void, accepts?: (file: AssetRef) => boolean): void {
  const files = assetFiles(ref.meta); if (files.length < 2) return;
  const section = document.createElement('section'); section.className = 'asset-file-list'; section.setAttribute('aria-label', tRaw('Asset variations'));
  const h = document.createElement('h3'); h.textContent = tRaw('{count} files / variations', { count: String(files.length) });
  const hint = document.createElement('p'); hint.className = 'muted'; hint.textContent = tRaw('Choose a file from this asset. File variations are separate from revision history.');
  const search = document.createElement('input'); search.type = 'search'; search.className = 'field-input'; search.placeholder = tRaw('Search file names or formats'); search.setAttribute('aria-label', search.placeholder);
  const rows = document.createElement('div'); rows.className = 'asset-file-rows';
  const selected = selectedAssetFile(ref);
  function paint() {
    rows.replaceChildren(); const q = search.value.trim().toLowerCase();
    const matching = files.filter(f => !q || `${f.name} ${f.format}`.toLowerCase().includes(q));
    for (const file of matching) {
      const variant = selectAssetFile(ref, file), b = document.createElement('button'); b.type = 'button'; b.className = 'asset-file-choice';
      b.setAttribute('aria-pressed', String(file.id === selected)); b.disabled = !!accepts && !accepts(variant);
      b.title = b.disabled ? tRaw('This slot cannot use this file type') : file.name;
      const image = document.createElement('span'); image.className = 'asset-file-thumb';
      const fallback = () => { const glyph = iconNode('image'); if (glyph) image.replaceChildren(glyph); };
      if (file.thumbnail) { const img = document.createElement('img'); img.src = instancePath(file.thumbnail); img.alt = ''; img.loading = 'lazy'; img.addEventListener('error', () => { img.remove(); fallback(); }, { once: true }); image.append(img); }
      else fallback();
      const info = document.createElement('span'); info.className = 'asset-file-info';
      const name = document.createElement('strong'); name.textContent = file.name;
      const description = document.createElement('span'); description.className = 'muted'; description.textContent = fileSummary(file);
      info.append(name, description); b.append(image, info); b.addEventListener('click', () => choose(variant)); rows.append(b);
    }
    if (!matching.length) { const empty = document.createElement('p'); empty.textContent = tRaw('No matching files'); rows.append(empty); }
  }
  search.addEventListener('input', paint); section.append(h, hint, search, rows); into.append(section); paint();
}
function fileSummary(file: AssetFile): string {
  return [file.format.toUpperCase(), file.width && file.height ? `${file.width} × ${file.height}` : '',
    file.size ? `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(file.size / 1_000_000)} MB` : ''].filter(Boolean).join(' · ');
}
