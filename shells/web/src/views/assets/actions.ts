// SPDX-License-Identifier: MPL-2.0
/** Catalog opening and conversion share selection rules across entry points. */
import { assetOpenChoices, type AssetOpenToolV1 } from '@lolly-tools/core/asset-open-v1';
import { presentApis, type AssetRef } from '@lolly-tools/core/host-v1';
import { toolSupport } from '../../capabilities.ts';
import { mountBodyPopover, pointAnchor } from '../../components/body-popover.ts';
import { menuItemHtml } from '../../lib/context-menu.ts';
import { announce } from '../../a11y.ts';
import { icon } from '../../lib/icons.ts';
import { t } from '../../i18n.ts';
import { bindOp, type CatCtx } from './context.ts';

export function selection(cat: CatCtx): AssetRef[] {
  const refs = [...cat.selected].map(id => cat.assetById.get(id));
  return refs.every((ref): ref is AssetRef => !!ref) ? refs : [];
}
export function choices(cat: CatCtx, refs: AssetRef[]) {
  const tools = (window.__toolIndex?.tools ?? []) as (AssetOpenToolV1 & { capabilities?: string[]; requires?: string[] })[];
  return assetOpenChoices(tools.filter(tool => toolSupport(tool, cat.host.capabilities, presentApis(cat.host)).status === 'ok'), refs);
}
export function canConvert(_cat: CatCtx, refs: AssetRef[]): boolean {
  if (!refs.length) return false;
  const image = (ref: AssetRef) => ['raster', 'vector'].includes(ref.type) && ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'svgz', 'bmp', 'tiff', 'tif', 'jxl'].includes(ref.original?.format ?? ref.format) && ref.meta?.animated !== true;
  if (refs.length > 1) return refs.every(image) && refs.length <= 20;
  const ref = refs[0]!;
  return image(ref) || (ref.type === 'audio' && ['wav', 'mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac'].includes(ref.format)) || ref.type === 'video' || ['txt', 'md', 'markdown', 'pdf', 'docx', 'pptx', 'xlsx', 'csv', 'tsv', 'json', 'ttf', 'otf', 'woff'].includes(ref.original?.format ?? ref.format);
}
export function menuHtml(cat: CatCtx, refs: AssetRef[]): string {
  return menuItemHtml('open-with', icon('externalLink'), t('Open with…'), { reason: choices(cat, refs).length ? '' : t('No tool accepts this selection.') })
    + menuItemHtml('convert', icon('duplicate'), t('Convert…'), { reason: canConvert(cat, refs) ? '' : t('No conversion accepts this selection.') });
}
export function openWith(cat: CatCtx, refs: AssetRef[], anchor?: HTMLElement): void {
  cat.actionsPopover?.close();
  const destinations = choices(cat, refs);
  if (!destinations.length) { announce(t('No tool accepts this selection.')); return; }
  const fallback = pointAnchor(cat.viewEl.getBoundingClientRect().left + 24, 100);
  const popover = mountBodyPopover(anchor ?? fallback, el => {
    el.innerHTML = destinations.map((choice, index) => menuItemHtml(String(index), icon('externalLink'), `${choice.tool.name ?? choice.tool.id}${choice.intent.binding.kind === 'timeline' ? ` · ${t('Sequence')}` : ''}`)).join('');
    const items = [...el.querySelectorAll<HTMLButtonElement>('button')];
    el.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    });
    el.addEventListener('click', async event => {
      const row = (event.target as Element).closest<HTMLElement>('[data-act]');
      if (!row) return;
      const choice = destinations[Number(row.dataset.act)];
      if (!choice) return;
      popover.close();
      try {
        const { openAssetsWith } = await import('../../lib/asset-open-handoff.ts');
        const chooseLottie = async (ref: AssetRef) => (await import('../lottie-import.ts')).chooseLottieAsset(ref);
        if (cat.mounted) await openAssetsWith(cat.host, choice, refs, chooseLottie, () => cat.mounted);
      } catch (error) { announce(error instanceof Error ? error.message : t('Could not open this asset.'), { assertive: true }); }
    });
    return el.querySelector<HTMLElement>('button');
  }, { className: 'folder-menu', ariaLabel: t('Open with'), container: anchor?.closest<HTMLDialogElement>('dialog') ?? undefined });
  cat.actionsPopover = popover;
  popover.open();
}
export async function convert(cat: CatCtx, refs: AssetRef[]): Promise<void> {
  try {
    if (!canConvert(cat, refs)) { announce(t('No conversion accepts this selection.')); return; }
    const { openAssetConvertDialog } = await import('../asset-convert.ts');
    if (cat.mounted) await openAssetConvertDialog(cat.host, refs, async (ref, format) => {
      if (ref.type === 'audio') await cat.downloads.openAudioDownloadDialog(ref, format);
      else await cat.downloads.openVideoDownloadDialog(ref, format);
    });
  } catch (error) { announce(error instanceof Error ? error.message : t('Could not convert this asset.'), { assertive: true }); }
}
export const actionsOps = (cat: CatCtx) => ({
  selection: bindOp(cat, selection), choices: bindOp(cat, choices), canConvert: bindOp(cat, canConvert),
  menuHtml: bindOp(cat, menuHtml), openWith: bindOp(cat, openWith), convert: bindOp(cat, convert),
});
