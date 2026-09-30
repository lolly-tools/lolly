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

/** Shared loading feedback, available before any lazy view or its CSS downloads. */
export function beginViewLoading(delayMs = VIEW_LOADING_DELAY_MS): ViewLoading {
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
      modal?.close();
      modal = null;
      if (active === handle) active = null;
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
  }, delayMs);

  return handle;
}
