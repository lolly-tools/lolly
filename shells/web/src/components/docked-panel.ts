// SPDX-License-Identifier: MPL-2.0
import { requestDock, releaseDock, isDocked, type PanelId } from '../lib/edge-dock.ts';
import { closeButton } from '../lib/close-button.ts';
import { mountModal, type ModalHandle } from './modal.ts';
import './docked-panel.css';

/** A tab in the shared desktop column, with the native dialog lifecycle on phones. */
export function mountDockedPanel(opts: {
  id: PanelId;
  title: string;
  tabLabel?: string;
  glyph: string;
  content: HTMLElement;
  onActivate?: () => void;
  onClose?: () => void;
}): { close(): void; show(): void } {
  const panel = document.createElement('section');
  panel.className = 'docked-panel';
  panel.dataset.panel = opts.id;
  panel.setAttribute('aria-label', opts.title);
  const head = document.createElement('header');
  head.className = 'export-popup-head';
  const title = document.createElement('h2');
  title.textContent = opts.title;
  const dismiss = closeButton({ className: 'export-popup-close' });
  head.append(title, dismiss);
  opts.content.classList.add('docked-panel-body');
  panel.append(head, opts.content);
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const mobile = window.matchMedia('(max-width: 640px)');
  let modal: ModalHandle<void> | undefined;
  let closed = false;
  let moving = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    mobile.removeEventListener('change', place);
    window.removeEventListener('hashchange', close);
    if (isDocked(opts.id)) releaseDock(opts.id, 'host');
    modal?.close();
    panel.remove();
    opts.onClose?.();
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const place = (): void => {
    if (closed) return;
    if (mobile.matches) {
      if (isDocked(opts.id)) releaseDock(opts.id, 'host');
      if (!modal) {
        modal = mountModal('', { className: 'modal docked-panel-dialog', ariaLabel: opts.title,
          onClose: () => { modal = undefined; if (!moving) close(); } });
        modal.el.append(panel);
        dismiss.focus();
      }
    } else {
      moving = true;
      panel.remove();
      modal?.close();
      moving = false;
      requestDock(opts.id, panel, { label: opts.tabLabel ?? opts.title, icon: opts.glyph, onActivate: opts.onActivate,
        onRelease: reason => {
          if (closed) return;
          if (reason === 'host' && mobile.matches) queueMicrotask(place);
          else close();
        } });
    }
  };
  dismiss.addEventListener('click', close);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  });
  mobile.addEventListener('change', place);
  window.addEventListener('hashchange', close);
  place();
  dismiss.focus();
  return { close, show: () => { opts.onActivate?.(); if (!closed) {
    if (!mobile.matches) requestDock(opts.id, panel);
    dismiss.focus();
  } } };
}
