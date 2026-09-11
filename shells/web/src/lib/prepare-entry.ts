// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { mountPreparationPanel } from '../components/prepare/panel.ts';
import { mountModal } from '../components/modal.ts';
import { NAV_EVENTS } from '../utils.ts';
import { t } from '../i18n.ts';
/** The dialog entry: the same panel the route mounts, inside the app's one modal lifecycle
 *  (mountModal owns Escape, the backdrop, system Back, route-change teardown and focus
 *  restore). The inspection panel stays in flow here - a body-level dock column would sit
 *  under a modal's top layer - so the panel is mounted without `dock`. */
export function openPreparation(host: HostV1, files: File[] = []): void {
  const headingId = `prepare-${crypto.randomUUID()}`;
  let dispose: (() => void) | undefined;
  const modal = mountModal<void>(
    `<button type="button" class="btn btn--ghost btn--sm prepare-dialog-close" data-close>${t('Close')}</button><h1 id="${headingId}">${t('Prepare for sharing')}</h1><div class="prepare-dialog-body"></div>`,
    {
      className: 'prepare-dialog',
      initialFocus: el => el.querySelector<HTMLElement>('[data-close]'),
      onClose: () => { dispose?.(); dispose = undefined; },
    },
  );
  modal.el.setAttribute('aria-labelledby', headingId);
  modal.el.querySelector('[data-close]')!.addEventListener('click', () => modal.close());
  dispose = mountPreparationPanel(modal.el.querySelector<HTMLElement>('.prepare-dialog-body')!, host, files);
}
let clearOffer: (() => void) | undefined;
/** Transient follow-on for transform results. Nothing is added to history. */
export function offerPreparationResult(host: HostV1, blob: Blob, name: string): void {
  offerPreparationFiles(host, [new File([blob], name, { type: blob.type })]);
}
export function offerPreparationFiles(host: HostV1, files: File[]): void {
  clearOffer?.();
  const root = document.createElement('div'); root.className = 'prepare-offer'; root.setAttribute('role', 'status');
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--primary btn--sm'; button.textContent = t('Prepare this copy for sharing');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn--ghost btn--sm'; close.textContent = t('Dismiss');
  let retained: File[] = files;
  const cleanup = (): void => { retained = []; root.remove(); clearTimeout(timer); NAV_EVENTS.forEach(event => { window.removeEventListener(event, cleanup); }); clearOffer = undefined; };
  const timer = setTimeout(cleanup, 120000); NAV_EVENTS.forEach(event => { window.addEventListener(event, cleanup, { once: true }); }); clearOffer = cleanup;
  button.addEventListener('click', () => { if (retained.length) openPreparation(host, retained); cleanup(); }); close.addEventListener('click', cleanup);
  root.append(button, close); document.body.append(root);
}
