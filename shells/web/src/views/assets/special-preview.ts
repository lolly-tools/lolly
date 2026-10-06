// SPDX-License-Identifier: MPL-2.0
/** Original-file previews for fonts and Adobe motion templates. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { fetchAssetBytes, MOGRT_LIMIT, readMogrt } from '../../lib/mogrt.ts';
import { detectFontFormat, parseFontMetadata } from '../../lib/font-utils.ts';
import { t } from '../../i18n.ts';
import type { CatCtx } from './context.ts';
import { mountMogrtSimulation } from '../../components/mogrt-simulation.ts';
import type { UserFontsHost } from '../../user-fonts.ts';

function canInstallFonts(host: CatCtx['host']): host is CatCtx['host'] & UserFontsHost {
  return ['_uploadUserAsset', '_deleteUserAsset', '_exportUserAssets', '_getBlob'].every(key => typeof Reflect.get(host.assets, key) === 'function');
}

export function hasSpecialPreview(ref: AssetRef): boolean {
  return ref.type === 'font' || (ref.original?.format ?? ref.format) === 'mogrt';
}

export function mountSpecialPreview(el: HTMLElement, ref: AssetRef, cat: CatCtx): () => void {
  const abort = new AbortController();
  const urls: string[] = [];
  let face: FontFace | undefined;
  let generation = 0;
  const panel = document.createElement('div');
  panel.style.cssText = 'padding:24px;width:100%;overflow:auto;max-height:100%;background:var(--ui-color-surface-overlay)';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  panel.append(status);
  el.replaceChildren(panel);
  const blobUrl = (blob: Blob) => { const url = URL.createObjectURL(blob); urls.push(url); return url; };
  const button = (label: string, run: () => Promise<void>) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn'; b.textContent = label;
    b.onclick = async () => {
      b.disabled = true;
      try { await run(); }
      catch (e) { if (!abort.signal.aborted) status.textContent = e instanceof Error ? e.message : t('Could not open this asset.'); }
      finally { b.disabled = false; }
    };
    panel.append(b);
  };
  const load = async (url: string, name: string) => {
    const request = ++generation;
    panel.querySelectorAll('[data-specimen]').forEach(node => { node.remove(); });
    if (face) { document.fonts.delete(face); face = undefined; }
    status.textContent = t('Loading preview…');
    const bytes = await fetchAssetBytes(url, ref.type === 'font' ? 32 * 1024 * 1024 : MOGRT_LIMIT, abort.signal);
    if (abort.signal.aborted || request !== generation) return;
    if (ref.type === 'font') {
      if (detectFontFormat(bytes.slice().buffer) === 'unknown') throw new Error(t('This file is not a supported font.'));
      const meta = parseFontMetadata(bytes.slice().buffer);
      const family = `lolly-specimen-${crypto.randomUUID()}`;
      const loaded = await new FontFace(family, bytes.slice().buffer).load();
      if (abort.signal.aborted || request !== generation) return;
      face = loaded; document.fonts.add(loaded);
      status.textContent = `${meta?.family ?? name} · ${meta?.weight ?? 400} · ${meta?.style ?? 'normal'}`;
      const sample = document.createElement('textarea');
      sample.className = 'field-input';
      sample.dataset.specimen = ''; sample.setAttribute('aria-label', t('Font preview text'));
      sample.value = 'The quick brown fox jumps over the lazy dog.\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz 0123456789';
      sample.style.cssText = 'display:block;width:100%;min-height:220px;font-size:32px;background:transparent;color:inherit;border:0';
      sample.style.fontFamily = family;
      panel.append(sample);
      button(t('Use this font'), async () => {
        const { installFontFromBytes } = await import('../../user-fonts.ts');
        if (!canInstallFonts(cat.host)) throw new Error(t('Font installation is unavailable in this shell.'));
        const installed = await installFontFromBytes(cat.host, bytes, { filename: name });
        if (!installed) throw new Error(t('This font could not be installed.'));
        if (!abort.signal.aborted) status.textContent = `${installed.family} · ${t('Ready to use')}`;
      });
      return;
    }
    const template = readMogrt(bytes);
    status.textContent = t('Original supplied preview. Try an editable approximation below; exact Adobe rendering requires Premiere Pro or After Effects.');
    if (template.video) {
      const video = document.createElement('video');
      video.dataset.specimen = ''; video.controls = true; video.playsInline = true;
      video.preload = 'metadata'; video.src = blobUrl(template.video);
      video.onerror = () => { if (!abort.signal.aborted) status.textContent = t('This browser cannot play the supplied preview. The original MOGRT is still available to download.'); };
      if (template.poster) video.poster = blobUrl(template.poster);
      video.style.cssText = 'display:block;width:100%;max-height:45vh';
      panel.append(video);
      button(t('Open preview in Sequence'), async () => {
        const { storeMogrtPreviewBlob } = await import('../../lib/special-upload.ts');
        const preview = await storeMogrtPreviewBlob(cat.host, ref, template, abort.signal);
        const choice = cat.actions.choices([preview]).find(c => c.intent.binding.kind === 'timeline');
        if (!choice) throw new Error(t('No Sequence tool is available. The preview has been saved to your assets.'));
        const { openAssetsWith } = await import('../../lib/asset-open-handoff.ts');
        if (!abort.signal.aborted) await openAssetsWith(cat.host, choice, [preview], async () => null, () => !abort.signal.aborted);
      });
    } else if (template.poster) {
      const img = document.createElement('img'); img.dataset.specimen = ''; img.alt = template.name;
      img.src = blobUrl(template.poster); img.style.maxWidth = '100%'; panel.append(img);
    } else status.textContent += ` ${t('No supplied preview media.')}`;
    const details = document.createElement('div'); details.dataset.specimen = '';
    const fonts = document.createElement('p'); fonts.textContent = `${t('Fonts')}: ${template.fonts.join(', ') || '—'}`;
    details.append(fonts);
    for (const control of template.controls) {
      const p = document.createElement('p'); p.textContent = `${control.name}: ${control.value}`; details.append(p);
    }
    panel.append(details);
    mountMogrtSimulation(panel, template);
  };
  const files = Array.isArray(ref.meta?.assetFiles) ? ref.meta.assetFiles.filter((f): f is { url: string; name: string; format: string } =>
    !!f && typeof f === 'object' && typeof f.url === 'string' && typeof f.name === 'string' && ['ttf', 'otf', 'woff', 'woff2'].includes(f.format)) : [];
  const startLoad = (url: string, name: string) => {
    const expected = generation + 1;
    void load(url, name).catch(error => {
      if (!abort.signal.aborted && generation === expected) status.textContent = String(error.message ?? error);
    });
  };
  if (ref.type === 'font' && files.length > 1) {
    const select = document.createElement('select'); select.setAttribute('aria-label', t('Font file'));
    select.className = 'field-select';
    for (const f of files) { const o = document.createElement('option'); o.value = f.url; o.textContent = f.name; select.append(o); }
    panel.prepend(select);
    select.onchange = () => {
      panel.querySelectorAll('button').forEach(b => { b.remove(); });
      const f = files.find(f => f.url === select.value)!;
      startLoad(f.url, f.name);
    };
  }
  const first = ref.type === 'font' ? files[0] : undefined;
  startLoad(first?.url ?? ref.original?.url ?? ref.url, first?.name ?? String(ref.meta?.name ?? ref.id));
  return () => {
    abort.abort(); generation++;
    if (face) document.fonts.delete(face);
    panel.querySelectorAll('video').forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    urls.forEach(url => { URL.revokeObjectURL(url); });
  };
}
