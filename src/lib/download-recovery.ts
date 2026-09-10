// SPDX-License-Identifier: MPL-2.0
/**
 * The recovery control every result surface mounts beside a delivered file
 * (plans/236). Bound to one DeliveryResult; it paints that result's state and
 * offers the two ways to ask for the same bytes again:
 *
 *   Save file…       the browser picker. The only path that can confirm a write
 *                    closed, so the only path that ever says "Saved". Offered where
 *                    the API exists (Chromium today), and called from the click.
 *   Retry download   the ordinary path again - anchor on web, native on the
 *                    shells. Always offered, because a browser without the picker
 *                    still needs a way back that is not "render it again".
 *
 * It never rebuilds a file and never regenerates a render: retrying reuses the
 * exact Blob and filename the result retained. The result's LABEL is painted next
 * to the controls so a retry of an earlier export cannot pass for an export of
 * edits made since. The control only unmounts itself; the result belongs to its
 * owner, who releases it when a newer file replaces it or the surface goes away.
 */
import './download-recovery.css';
import { t, tRaw } from '../i18n.ts';
import { DeliveryResult } from './delivery-result.ts';
import type { Deliver, DeliveryOutcome, PreparedFile } from './delivery-result.ts';
import { chooseLocationDeliver, deliverFile } from './deliver-file.ts';
import type { DeliveryHost } from './deliver-file.ts';
import { getHostRef } from './host-ref.ts';

export interface RecoveryCopy {
  /** The line while the file is ready, or after a download was requested. */
  ready: string;
  /** The line once a picker or native write has closed. */
  saved: string;
}

function control(label: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--ghost btn--sm';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}

/**
 * Paint `result` into `status` (a live region) with its recovery controls. Returns
 * the unmount; it does NOT dispose the result.
 */
export function mountDownloadRecovery(status: HTMLElement, result: DeliveryResult, copy: RecoveryCopy): () => void {
  const file = result.file;
  if (!file) return () => {};
  if (!status.hasAttribute('role') && !status.hasAttribute('aria-live')) status.setAttribute('role', 'status');

  const summary = document.createElement('span');
  summary.className = 'download-recovery-summary';
  const label = document.createElement('span');
  label.className = 'download-recovery-label';
  label.textContent = file.label;
  const recovery = document.createElement('span');
  recovery.className = 'download-recovery';
  const message = document.createElement('span');
  message.className = 'download-recovery-message';

  const canSave = result.canSave;
  // Save first where a location-choosing path exists: it is the one action that can
  // confirm the file. tRaw: these land in aria-label attributes and textContent
  // (text sinks), where t()'s HTML-escaping of the filename would read back as
  // literal entities.
  const saveButton = canSave ? control(t('Save file…'), tRaw('Save {name}', { name: file.filename })) : null;
  const retryButton = control(t('Retry download'), tRaw('Download {name} again', { name: file.filename }));

  const paint = (): void => {
    const state = result.state;
    if (state === 'saved') {
      summary.textContent = copy.saved;
      message.textContent = '';
    } else {
      summary.textContent = copy.ready;
      if (state === 'saving') message.textContent = t('Saving…');
      else if (state === 'failed') message.textContent = tRaw('Could not save: {error} Try again.', { error: result.error ?? '' });
      else if (state === 'requested') message.textContent = t('Download requested. If no file appears, try again.');
      else if (result.lastOutcome === 'cancelled') message.textContent = t('Save cancelled. Your file is still ready.');
      else message.textContent = canSave
        ? t('No file?')
        : t('If no file appears, check your browser’s download permissions or try a private window.');
    }
    const locked = result.busy || result.disposed;
    if (saveButton) saveButton.disabled = locked;
    retryButton.disabled = locked;
  };

  // No await between the click and the picker: save() opens it synchronously.
  const onSave = (): void => { void result.save(); };
  const onRetry = (): void => { void result.retry(); };
  saveButton?.addEventListener('click', onSave);
  retryButton.addEventListener('click', onRetry);
  const unsubscribe = result.subscribe(paint);

  recovery.append(message);
  if (saveButton) recovery.append(saveButton);
  recovery.append(retryButton);
  status.replaceChildren(summary, label, recovery);
  paint();

  return () => {
    unsubscribe();
    saveButton?.removeEventListener('click', onSave);
    retryButton.removeEventListener('click', onRetry);
    label.remove();
    recovery.remove();
  };
}

// One retained result per owning element (a batch overlay, a Projects render mount).
// A new run in the same owner replaces it; an owner that leaves the document lets
// the entry, and with it the retained bytes, go. Exactly one file per owner - the
// final ZIP or document - never a copy of every member.
const retained = new WeakMap<HTMLElement, { result: DeliveryResult; unmount: () => void }>();

/** Release whatever `owner` retained (a new run, or the owner going away). */
export function releaseDeliveryFor(owner: HTMLElement): void {
  const prior = retained.get(owner);
  if (!prior) return;
  prior.unmount();
  prior.result.dispose();
  retained.delete(owner);
}

/**
 * Retain an already-delivered file for `owner`, painting its recovery control into
 * `surface` with the outcome the first hand-over could vouch for. Replaces whatever
 * result the owner held before.
 */
export function attachDeliveryResult(
  owner: HTMLElement,
  surface: HTMLElement,
  file: PreparedFile,
  host: DeliveryHost,
  outcome: DeliveryOutcome | { failed: string },
  copy: Partial<RecoveryCopy> = {},
): DeliveryResult {
  releaseDeliveryFor(owner);
  const result = new DeliveryResult(file, (blob, filename) => deliverFile(host, blob, filename), chooseLocationDeliver(host));
  if (typeof outcome === 'string') result.recordOutcome(outcome);
  else result.recordFailure(outcome.failed);
  surface.hidden = false;
  const unmount = mountDownloadRecovery(surface, result, {
    ready: copy.ready ?? tRaw('{name} ready.', { name: file.filename }),
    saved: copy.saved ?? t('Saved.'),
  });
  retained.set(owner, { result, unmount });
  return result;
}

/** Deliver a prepared file the ordinary way from a surface with no host in scope:
 *  through the live host (which the Tauri shells override with a native save), or
 *  the bridge's own anchor before a host exists - never a raw anchor of a view's
 *  own, which the Tauri WebView drops (raw-anchor-download-guard.test.ts). */
export const deliverBlob: Deliver = async (blob, filename) => {
  const host = getHostRef();
  if (host?.export?.download) return deliverFile(host, blob, filename);
  (await import('../bridge/export.ts')).anchorSave(blob, filename);
  return 'requested';
};

/**
 * Retain an already-delivered file and offer recovery for it, from a status line
 * that already reads "ready". The result is owned here: the returned cleanup both
 * unmounts the control and releases the file.
 */
export function offerDownloadRecovery(status: HTMLElement, blob: Blob, filename: string, savedMessage: string): () => void {
  const result = new DeliveryResult({ blob, filename, label: filename }, deliverBlob, chooseLocationDeliver(getHostRef()));
  const unmount = mountDownloadRecovery(status, result, { ready: status.textContent || '', saved: savedMessage });
  return () => {
    unmount();
    result.dispose();
  };
}
