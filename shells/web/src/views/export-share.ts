// SPDX-License-Identifier: MPL-2.0
/** Live links and editable files share one tab in the app's panel column. */
import { mountSharePanel, type ShareDialogOpts } from '../components/share-dialog.ts';
import { mountDockedPanel } from '../components/docked-panel.ts';
import { getExportPolicy } from '../lib/export-policy.ts';
import { routeParams, updateRouteParams } from '../lib/url-state.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import './export-share.css';

export function canExportLolly(toolId: string): boolean {
  const policy = getExportPolicy();
  const formats = policy?.formatsFor(toolId);
  return policy?.canDownload !== false && (!formats || formats.includes('lolly'));
}

export function mountExportShare(root: HTMLElement, options: () => ShareDialogOpts): () => void {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'btn export-share';
  trigger.dataset.exportShare = '';
  const glyph = document.createElement('span');
  glyph.innerHTML = icon('share', { size: 18 });
  glyph.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = t('Share and editable file');
  trigger.append(glyph, label);
  const body = document.createElement('div');
  root.append(trigger);
  const select = root.querySelector<HTMLSelectElement>('[data-action="format"]');
  let dispose: (() => void) | undefined;
  let panel: ReturnType<typeof mountDockedPanel> | undefined;
  let signature = '';
  let refreshFrame = 0;
  let disposed = false;
  const refresh = (): void => {
    const opts = options();
    const next = JSON.stringify([opts.baseParts, opts.currentFormat, opts.fidelity, canExportLolly(opts.toolId ?? '')]);
    if (dispose && signature === next) return;
    signature = next;
    dispose?.();
    dispose = undefined;
    // Recheck on every opening; never let a stale format choice bypass policy.
    const vehicle = opts.lolly;
    const allowed = (): void => { if (!canExportLolly(opts.toolId ?? '')) throw new Error(t('Editable file downloads are unavailable for this tool.')); };
    const lolly = vehicle && canExportLolly(opts.toolId ?? '') ? {
      ...vehicle,
      build: async (settings: Parameters<typeof vehicle.build>[0]) => { allowed(); return vehicle.build(settings); },
      save: async (blob: Blob, filename: string) => { allowed(); return vehicle.save(blob, filename); },
      ...(vehicle.share ? { share: async (blob: Blob, filename: string) => { allowed(); return vehicle.share!(blob, filename); } } : {}),
    } : undefined;
    const currentFormat = opts.currentFormat === 'lolly' ? '' : opts.currentFormat;
    const baseParts = opts.baseParts?.filter(part => !/^format=lolly$/i.test(part));
    dispose = mountSharePanel(body, { ...opts, lolly, baseParts, currentFormat, title: t('Share this creation') }, () => panel?.close());
  };
  const open = (): void => {
    if (disposed) return;
    updateRouteParams({ _dialog: 'share', share: null });
    refresh();
    if (panel) { panel.show(); return; }
    panel = mountDockedPanel({ id: 'share', title: t('Share and editable file'), tabLabel: t('Share'), glyph: icon('share'),
      content: body, onActivate: () => { refresh(); if (!disposed) updateRouteParams({ _dialog: 'share' }); },
      onClose: () => {
        panel = undefined; dispose?.(); dispose = undefined;
        if (!disposed && root.isConnected && routeParams().get('_dialog') === 'share') updateRouteParams({ _dialog: null });
      } });
  };
  const onOpen = (event: Event): void => { event.preventDefault(); open(); };
  const onChange = (): void => {
    if (panel && !refreshFrame) refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; if (panel) refresh(); });
  };
  const sync = (): void => {
    const portable = select?.value === 'lolly';
    root.classList.toggle('export-is-lolly', portable);
    if (portable) open();
    else if (panel) refresh();
  };
  const onDownload = (event: Event): void => {
    if (select?.value !== 'lolly') return;
    const target = (event.target as Element).closest('[data-action="download"], [data-action="copy"], [data-send-kind]');
    if (!target) return;
    // A document package never reaches runtime.export(), the raster clipboard or
    // a rendered-output send target. Its own delivery controls own these actions.
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.matches('[data-action="download"]')) {
      open();
      body.querySelector<HTMLElement>('[data-lolly-download]')?.click();
    }
  };
  trigger.addEventListener('click', open);
  root.addEventListener('lolly:share-open', onOpen);
  root.addEventListener('lolly:share-change', onChange);
  select?.addEventListener('change', sync);
  root.addEventListener('click', onDownload, true);
  sync();
  return () => {
    disposed = true;
    panel?.close();
    cancelAnimationFrame(refreshFrame);
    dispose?.();
    root.removeEventListener('lolly:share-open', onOpen);
    root.removeEventListener('lolly:share-change', onChange);
    select?.removeEventListener('change', sync);
    root.removeEventListener('click', onDownload, true);
    root.classList.remove('export-is-lolly');
    trigger.remove();
  };
}
