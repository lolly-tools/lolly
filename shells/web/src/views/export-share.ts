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

/** What a tool mount does with the Share deep link: `?share`, or the `_dialog=share` the
 *  docked panel below writes while it is open. */
export type ShareDeepLink = { kind: 'open' } | { kind: 'clear'; changes: Record<string, null> };

/**
 * Read the Share deep link for a mount, or null when the address has none. Pure.
 *
 * A mount that joined a live collab (`live`) never reopens the share UI: starting a
 * collab from this panel remounts the tool at the address the panel was open at, and the
 * remount read `_dialog=share` and covered the live session with the Share dialog. The
 * flags are cleared instead (`changes`), so a reload does not bring the dialog back either.
 */
export function shareDeepLink(flags: URLSearchParams, live: boolean): ShareDeepLink | null {
  const dialog = flags.get('_dialog') === 'share';
  if (!dialog && !flags.has('share')) return null;
  if (!live) return { kind: 'open' };
  return { kind: 'clear', changes: { ...(flags.has('share') ? { share: null } : {}), ...(dialog ? { _dialog: null } : {}) } };
}

/**
 * Apply a `clear` from shareDeepLink to the mount's own flags and to the address bar.
 * Both, because the mount's first address write puts back every workspace key (and
 * `_dialog` is one) that its flags hold and the bar lacks; clearing only the bar let
 * `_dialog=share` return, and a reload then opened the dialog over the live collab.
 */
export function clearShareDeepLink(flags: URLSearchParams, changes: Record<string, null>): void {
  for (const key of Object.keys(changes)) flags.delete(key);
  updateRouteParams(changes);
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
  const shareAction = root.querySelector<HTMLButtonElement>('[data-action="copy-url"]');
  if (shareAction) {
    trigger.className = shareAction.className;
    label.textContent = t('Share');
    shareAction.replaceWith(trigger);
  } else root.append(trigger);
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
    if (shareAction && trigger.isConnected) trigger.replaceWith(shareAction);
    else trigger.remove();
  };
}
