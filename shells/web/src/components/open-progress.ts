// SPDX-License-Identifier: MPL-2.0
/**
 * The "Opening…" modal shown while the tool view mounts a saved document.
 *
 * A large document takes seconds to open: a 19-page Design document spent about 6 s
 * before the editor drew anything (its onInit ran past the 5 s budget) and 14 s before
 * its text was laid out, with nothing on screen and no way to stop the open. This card
 * shows the document's name, the step now running, and a Cancel button.
 *
 * It appears only after `delayMs`, so an ordinary open never flashes it, and it is the
 * standard `.modal` card with the shared candy-stripe bar (job-toast.css), which stops
 * drifting under reduced motion.
 *
 * mountModal owns the dialog, with three of its options set:
 *   - `backStack: false`. The Back stack pushes a history entry and reads the next
 *     `popstate` as a Back press, and a tool open fires hashchange AND a late popstate
 *     (main.ts navigate() documents the pair), so the second event would have cancelled
 *     the open by itself. Back during an open reaches the router instead, and the tool
 *     view calls `left()` from its `_beforeLeave`.
 *   - `dismissOnBackdrop: false`: a stray click while waiting must not throw away a
 *     document someone asked for.
 *   - `onEscape`: Escape is Cancel, and the card stays up saying "Stopping…" until the
 *     mount has unwound.
 */
import { t } from '../i18n.ts';
import { escapeHtml } from '../lib/util/escape.ts';
import { mountModal, type ModalHandle } from './modal.ts';

/** The steps of an open after the tool itself has loaded, in order. */
export type OpenPhase = 'document' | 'pages' | 'editor' | 'layout';

/** Why an open stopped before it finished. */
export type OpenStop = 'cancel' | 'left';

export interface OpenProgressOpts {
  /** The document's name, as the tile that opened the document shows the name. */
  name?: string;
  /** Its thumbnail (a data: or blob: image URL), when the opening view had one. */
  thumb?: string | null;
  /** How long an open may take before the card appears. */
  delayMs?: number;
  /** Runs once when the card closes for good, however the open ended. */
  onClose?: () => void;
}

export interface OpenProgress {
  /** Show the step now running. */
  phase(p: OpenPhase): void;
  /** Text layout progress: `done` of `total` stories composed. While it runs, the card
   *  shows the count and a filling bar in place of the step name. */
  progress(done: number, total: number): void;
  /** Settles when the open is stopped: Cancel or Escape (`cancel`), or the router
   *  leaving the view (`left`). Never settles for an open that finishes. */
  readonly stopped: Promise<OpenStop>;
  /** How it stopped, or null while it has not. */
  stop(): OpenStop | null;
  /** The router is leaving this view mid-open (Back, a link). */
  left(): void;
  /** Take the card down for good: the document is open, or the open was abandoned. */
  close(): void;
}

/** The default wait before the card appears - the tool view's own "Loading…" delay. */
export const OPEN_PROGRESS_DELAY_MS = 400;

function phaseText(p: OpenPhase): string {
  switch (p) {
    case 'document': return t('Reading the document');
    case 'pages': return t('Preparing the pages');
    case 'editor': return t('Building the editor');
    case 'layout': return t('Finishing the layout');
  }
}

/** Only an image the page made itself: a saved thumbnail is a data: URL, a fresh one a blob:. */
const SAFE_THUMB = /^(data:image\/(png|jpeg|webp|gif|avif|svg\+xml)[;,]|blob:)/i;

let openProgressSeq = 0;

export function openProgress(opts: OpenProgressOpts = {}): OpenProgress {
  let current: OpenPhase = 'document';
  let laidOut = 0, stories = 0;
  const titleId = `open-progress-title-${++openProgressSeq}`;
  let stopped: OpenStop | null = null;
  let closed = false;
  let modal: ModalHandle<void> | null = null;
  let resolveStop!: (why: OpenStop) => void;
  const stoppedP = new Promise<OpenStop>((r) => { resolveStop = r; });

  const stepEl = (): HTMLElement | null => modal?.el.querySelector<HTMLElement>('.open-progress-step') ?? null;
  const laying = (): boolean => stories > 0 && laidOut < stories;
  /**
   * The step line, the count and the bar, from state. The step line is a live region,
   * so it only changes with the step: the per-story count sits beside it, hidden from
   * assistive tech, and the bar carries the numbers as a progressbar instead, which a
   * screen reader reports when asked rather than 106 times in a row.
   */
  const render = (): void => {
    if (!modal) return;
    const step = stepEl(), count = modal.el.querySelector<HTMLElement>('.open-progress-count');
    const bar = modal.el.querySelector<HTMLElement>('.job-bar'), fill = modal.el.querySelector<HTMLElement>('.job-bar-fill');
    const text = stopped ? t('Stopping…') : laying() ? t('Laying out text') : phaseText(current);
    if (step && step.textContent !== text) step.textContent = text;
    if (count) {
      count.hidden = stopped !== null || !laying();
      count.textContent = t('{done} of {total}', { done: String(laidOut), total: String(stories) });
    }
    if (bar && fill) {
      const known = stories > 0 && !stopped;
      bar.classList.toggle('job-bar--indef', !known);
      fill.style.width = known ? `${Math.round(Math.min(1, laidOut / stories) * 100)}%` : '';
      if (known) { bar.setAttribute('aria-valuemax', String(stories)); bar.setAttribute('aria-valuenow', String(Math.min(laidOut, stories))); }
      else { bar.removeAttribute('aria-valuemax'); bar.removeAttribute('aria-valuenow'); }
    }
  };

  const finish = (why: OpenStop): void => {
    if (stopped || closed) return;
    stopped = why;
    resolveStop(why);
  };

  const cancel = (): void => {
    if (stopped || closed) return;
    finish('cancel');
    // The mount stops at its next step, which can be a moment away, so the card
    // says so and the button cannot be pressed twice.
    render();
    const btn = modal?.el.querySelector<HTMLButtonElement>('[data-act="cancel"]');
    if (btn) btn.disabled = true;
  };

  const show = (): void => {
    if (closed || stopped) return;
    const name = (opts.name ?? '').trim();
    const title = name ? t('Opening {name}', { name }) : t('Opening document');
    const thumb = opts.thumb && SAFE_THUMB.test(opts.thumb)
      ? `<div class="open-progress-thumb"><img src="${escapeHtml(opts.thumb)}" alt=""></div>` : '';
    modal = mountModal<void>(`${thumb}
      <h2 class="modal-title" id="${titleId}">${escapeHtml(title)}</h2>
      <div class="open-progress-status">
        <p class="open-progress-step" role="status" aria-live="polite"></p>
        <span class="open-progress-count" aria-hidden="true" hidden></span>
      </div>
      <div class="job-bar job-bar--indef" role="progressbar" aria-valuemin="0" aria-labelledby="${titleId}"><span class="job-bar-fill"></span></div>
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-act="cancel">${escapeHtml(t('Cancel'))}</button>
      </div>`, {
      className: 'modal open-progress',
      ariaLabel: title,
      backStack: false,
      dismissOnBackdrop: false,
      onEscape: cancel,
      initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="cancel"]'),
    });
    modal.el.querySelector('[data-act="cancel"]')?.addEventListener('click', cancel);
    render();
  };

  const timer = setTimeout(show, opts.delayMs ?? OPEN_PROGRESS_DELAY_MS);

  const close = (): void => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    modal?.close();
    modal = null;
    opts.onClose?.();
  };

  return {
    phase(p) {
      current = p;
      render();
    },
    progress(done, total) {
      if (closed || !(total > 0)) return;
      laidOut = Math.max(0, Math.min(done, total));
      stories = total;
      render();
    },
    stopped: stoppedP,
    stop: () => stopped,
    // The next view is already mounting underneath, so the card goes now rather than
    // at the mount's next step.
    left() { finish('left'); close(); },
    close,
  };
}
