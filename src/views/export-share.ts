// SPDX-License-Identifier: MPL-2.0
/** Plan 221: one Share implementation, also available inside the export panel. */
import { mountSharePanel, type ShareDialogOpts } from '../components/share-dialog.ts';
import { getExportPolicy } from '../lib/export-policy.ts';
import { t } from '../i18n.ts';
import './export-share.css';

export function canExportLolly(toolId: string): boolean {
  const policy = getExportPolicy();
  const formats = policy?.formatsFor(toolId);
  return policy?.canDownload !== false && (!formats || formats.includes('lolly'));
}

export function mountExportShare(root: HTMLElement, options: () => ShareDialogOpts): () => void {
  const details = document.createElement('details');
  details.className = 'export-share';
  details.dataset.exportShare = '';
  const summary = document.createElement('summary');
  summary.textContent = t('Share and editable file');
  const body = document.createElement('div');
  details.append(summary, body);
  root.append(details);
  const select = root.querySelector<HTMLSelectElement>('[data-action="format"]');
  let dispose: (() => void) | undefined;
  const refresh = (force = false): void => {
    if (details.open && dispose && !force) return;
    dispose?.();
    dispose = undefined;
    if (!details.open) return;
    const opts = options();
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
    dispose = mountSharePanel(body, { ...opts, lolly, baseParts, currentFormat, title: t('Share this creation') });
  };
  const sync = (): void => {
    const portable = select?.value === 'lolly';
    root.classList.toggle('export-is-lolly', portable);
    if (portable) details.open = true;
    refresh(true);
  };
  const onDownload = (event: Event): void => {
    if (select?.value !== 'lolly') return;
    const target = (event.target as Element).closest('[data-action="download"], [data-action="copy"], [data-send-kind]');
    if (!target) return;
    // A document package never reaches runtime.export(), the raster clipboard or
    // a rendered-output send target. Its own delivery controls own these actions.
    event.preventDefault(); event.stopImmediatePropagation();
    if (target.matches('[data-action="download"]')) {
      if (!details.open) { details.open = true; refresh(); }
      body.querySelector<HTMLElement>('[data-lolly-download]')?.click();
    }
  };
  const onToggle = (): void => refresh();
  details.addEventListener('toggle', onToggle);
  select?.addEventListener('change', sync);
  root.addEventListener('click', onDownload, true);
  sync();
  return () => {
    dispose?.();
    details.removeEventListener('toggle', onToggle);
    select?.removeEventListener('change', sync);
    root.removeEventListener('click', onDownload, true);
    root.classList.remove('export-is-lolly');
    details.remove();
  };
}
