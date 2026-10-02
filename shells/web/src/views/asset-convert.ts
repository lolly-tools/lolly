// SPDX-License-Identifier: MPL-2.0
/** List actual conversion targets, then reuse the file conversion workbench. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { fontConversionTargets, imageDimensions, sniffAnimatedRaster, sniffContainer } from '@lolly/engine';
import { isJxl } from '../../../../engine/src/jxl.ts';
import { mountModal } from '../components/modal.ts';
import { readAssetFile } from '../lib/asset-open-handoff.ts';
import { conversionFindings, validateConvertFiles } from '../lib/file-conversion.ts';
import { detectKind, sniffOfficeZip, targetsForSource } from '../lib/convert-codecs.ts';
import { mountConvertWorkbench, type ConvertSource } from './convert-workbench.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';
import { announce } from '../a11y.ts';
import '../styles/parts/convert.css';
import '../styles/parts/asset-actions.css';

export async function openAssetConvertDialog(host: HostV1, refs: AssetRef[], media: (ref: AssetRef, format: string) => Promise<void>): Promise<void> {
  let active = true;
  let cleanup: (() => void) | undefined;
  const modal = mountModal(`<header><h2>${t('Convert to')}</h2><button type="button" class="btn" data-close>${t('Close')}</button></header><div data-conversion><p role="status">${t('Reading supported transformations…')}</p></div>`, {
    className: 'asset-convert-dialog', ariaLabel: t('Convert to'), onClose: () => { active = false; cleanup?.(); },
  });
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
  const root = modal.el.querySelector<HTMLElement>('[data-conversion]')!;
  try {
    if (refs.length === 1 && ['audio', 'video'].includes(refs[0]!.type)) {
      const ref = refs[0]!;
      const support = await import('../bridge/format-support.ts');
      let formats: string[];
      if (ref.type === 'audio') {
        await support.probeWebCodecsAudioSupport();
        formats = Object.entries(support.audioSupport()).filter(([, yes]) => yes).map(([format]) => format);
      } else {
        await support.probeWebCodecsVideoSupport();
        formats = Object.entries(support.videoSupport()).filter(([, yes]) => yes).map(([format]) => format);
      }
      if (!active) return;
      formats = formats.filter(format => format !== ref.format);
      root.innerHTML = `<p>${t('Choose a format, then review quality and conversion settings.')}</p><div class="asset-conversion-list">${formats.map(format => `<button type="button" class="btn" data-media="${escapeHtml(format)}">${escapeHtml(format.toUpperCase())}</button>`).join('')}</div>${formats.length ? '' : `<p role="status">${t('No alternative format is supported on this device.')}</p>`}`;
      root.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('[data-media]');
        if (!button) return;
        modal.close();
        void media(ref, button.dataset.media!).catch(error => announce(error instanceof Error ? error.message : String(error), { assertive: true }));
      });
      return;
    }
    const files: File[] = [];
    for (const ref of refs) {
      if (!active) return;
      files.push(await readAssetFile(host, ref));
      validateConvertFiles(files);
    }
    const sources: ConvertSource[] = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let kind = detectKind(bytes, file);
      if (kind === 'unknown' && sniffContainer(bytes) === 'zip') kind = await sniffOfficeZip(bytes);
      if (sniffAnimatedRaster(bytes, { name: file.name, mime: file.type })) throw new Error(t('Still-image conversion would lose this animation. Choose a still image.'));
      if (kind === 'raster' && !isJxl(bytes)) {
        const dimensions = imageDimensions(bytes, file.type);
        if (dimensions && dimensions.w * dimensions.h > 40_000_000) throw new Error(t('Choose an image smaller than 40 megapixels.'));
        const url = URL.createObjectURL(file);
        try {
          await new Promise<void>((resolve, reject) => {
            const image = new Image();
            const timer = setTimeout(() => { image.src = ''; reject(new Error(t('Could not decode this image on this device.'))); }, 10_000);
            image.onload = () => { clearTimeout(timer); resolve(); };
            image.onerror = () => { clearTimeout(timer); reject(new Error(t('Could not decode this image on this device.'))); };
            image.src = url;
          });
        } finally { URL.revokeObjectURL(url); }
      }
      const fonts = fontConversionTargets(bytes);
      const targets = (await targetsForSource(kind, bytes)).filter(target => target.id !== kind && (!['ttf', 'otf', 'woff'].includes(kind) || fonts.includes(target.id as 'ttf' | 'otf' | 'woff'))).filter(target => {
        if (!['webp', 'avif'].includes(target.id)) return true;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        return canvas.toDataURL(target.mime).startsWith(`data:${target.mime}`);
      });
      sources.push({ file, bytes, kind, targets });
    }
    if (!active) return;
    const targets = sources[0]?.targets.filter(target => sources.every(source => source.targets.some(other => other.id === target.id))) ?? [];
    root.innerHTML = `<p>${escapeHtml(refs.length === 1 ? files[0]!.name : t('{n} files', { n: refs.length }))}</p><div class="asset-conversion-list">${targets.map((target, index) => `<button type="button" class="btn" data-target="${index}"><strong>${escapeHtml(t(target.label))}</strong><span>${escapeHtml(conversionFindings(sources[0]!.kind, target.id)[0]?.message ?? t('Create a converted copy.'))}</span></button>`).join('')}</div>${targets.length ? '' : `<p role="status">${t('These files do not share a supported conversion.')}</p>`}`;
    root.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLElement>('[data-target]');
      if (!button) return;
      const target = targets[Number(button.dataset.target)];
      if (target) { cleanup?.(); cleanup = mountConvertWorkbench(root, sources, host, target.id); }
    });
  } catch (error) {
    if (!active) return;
    root.innerHTML = '<p role="alert"></p>';
    root.firstElementChild!.textContent = error instanceof Error ? error.message : t('Could not read these assets.');
  }
}
