// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { LOLLY_MARK_SVG } from '../lib/lolly-mark.ts';
import { escapeHtml } from '../lib/util/escape.ts';
import { mountModal, type ModalHandle } from './modal.ts';

/** A short wait avoids flashing the card when a view is already cached. */
export const VIEW_LOADING_DELAY_MS = 150;

export interface ViewLoading {
  /** Remove the card and cancel any pending appearance. Safe to call again. */
  close(): void;
}

let active: ViewLoading | null = null;
let sequence = 0;
/** The card on screen now, if any. While it is open the page under it is inert. */
let shown: ModalHandle<void> | null = null;
/** The latest focus a mounting view asked for while the card was open. */
let pendingFocus: (() => void) | null = null;

/**
 * Place focus from a view that may still be mounting. The card is modal, so the page
 * under it is inert and a direct focus() there is ignored; the latest request waits
 * and runs as the card closes, before the router decides where focus goes.
 */
export function focusWhenViewReady(place: () => void): void {
  if (shown) pendingFocus = place;
  else place();
}

/** Shared loading feedback, available before any lazy view or its CSS downloads. */
export function beginViewLoading(delayMs = VIEW_LOADING_DELAY_MS): ViewLoading {
  // A request from the view being left must not follow into the next one.
  pendingFocus = null;
  active?.close();
  let closed = false;
  let modal: ModalHandle<void> | null = null;
  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handle: ViewLoading = {
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      observer?.disconnect();
      const wasShown = modal !== null;
      modal?.close();
      modal = null;
      if (active === handle) active = null;
      if (!wasShown) return;
      shown = null;
      // The native close has returned focus to whatever opened the card, usually a
      // control of the view that was replaced, so the waiting request goes last.
      const place = pendingFocus;
      pendingFocus = null;
      place?.();
    },
  };
  active = handle;

  // A saved-document progress card or a chooser takes over feedback and focus.
  const otherDialog = (): boolean =>
    [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].some(dialog => dialog !== modal?.el);
  observer = new MutationObserver(() => { if (otherDialog()) handle.close(); });
  observer.observe(document.body, { childList: true });

  timer = setTimeout(() => {
    if (closed) return;
    if (otherDialog()) { handle.close(); return; }
    const label = t('Loading…');
    // Other chrome uses the same SVG; give this instance its own gradient ids.
    const scope = `view-loading-${++sequence}`;
    const mark = LOLLY_MARK_SVG.replaceAll('lolly-primary-', `${scope}-primary-`)
      .replaceAll('lolly-reverse-', `${scope}-reverse-`);
    modal = mountModal(`<span class="view-loading-mark" aria-hidden="true">${mark}</span>
      <p class="view-loading-status" role="status" aria-live="polite">${escapeHtml(label)}</p>`, {
      className: 'modal view-loading',
      ariaLabel: label,
      backStack: false,
      dismissOnBackdrop: false,
      onEscape: () => {},
      onClose: () => handle.close(),
    });
    shown = modal;
  }, delayMs);

  return handle;
}
