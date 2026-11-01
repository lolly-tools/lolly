// SPDX-License-Identifier: MPL-2.0
/**
 * Undo toast - the "act now, offer a way back" primitive (plans/132 WP-E).
 * Replaces confirm-then-permanent for reversible-enough actions: the caller
 * applies the visible effect immediately, shows a toast with an Undo button,
 * and the DESTRUCTIVE half (`commit`) only runs when the toast expires or is
 * flushed. Undo runs the caller's `undo` and the commit never happens.
 *
 * Lives in the shared floating cluster (lib/float-cluster.ts), so a toast
 * born inside an open modal keeps working over it and survives the modal
 * closing. Views that defer real deletions behind `commit` MUST call
 * flushUndoToasts() in their unmount - a deferred delete must not outlive the
 * surface that owns its Undo. A page unload before commit simply leaves the
 * data in place: the fail-safe direction.
 */
import { getFloatCluster } from './float-cluster.ts';
import { t } from '../i18n.ts';

export interface UndoToastOpts {
  message: string;
  /** Reverse the visible effect. Runs at most once, only if Undo is pressed. */
  undo: () => void | Promise<void>;
  /** The real (destructive) work, deferred until expiry/flush. Optional - an
   *  already-reversible action (hide) needs only `undo`. */
  commit?: () => void | Promise<void>;
  /** ms until auto-commit. Default 10s. */
  duration?: number;
  /** Button text. Default t('Undo') - override for the action-toast shape
   *  ("Saved" · "Open Projects"), where `undo` is the action and there is no
   *  deferred commit. */
  actionLabel?: string;
  /** A second button after the action, for a notice that offers a way back AND a way
   *  to accept ("Undo" · "Keep"). Pressing it settles the toast at once: `commit`
   *  runs, exactly as when the toast times out. */
  acceptLabel?: string;
  /** Let a sentence-long message wrap onto more lines instead of being cut short. */
  wrap?: boolean;
}

export interface UndoToastHandle {
  /** Commit now and remove the toast (no-op if already settled). */
  settle(): void;
  /** Take the toast down without running `undo` or `commit`, for a notice that steps
   *  aside and is shown again later (no-op if already settled). */
  withdraw(): void;
}

let wrap: HTMLElement | null = null;
const pending = new Set<() => void>();

function ensureWrap(): HTMLElement {
  if (wrap && wrap.isConnected) return wrap;
  wrap = document.createElement('div');
  wrap.className = 'undo-toasts';
  getFloatCluster().appendChild(wrap);
  return wrap;
}

export function showUndoToast(opts: UndoToastOpts): UndoToastHandle {
  const duration = opts.duration ?? 10_000;
  const el = document.createElement('div');
  el.className = opts.wrap ? 'undo-toast undo-toast--wrap' : 'undo-toast';
  el.setAttribute('role', 'status');
  const msg = document.createElement('span');
  msg.className = 'undo-toast-msg';
  msg.textContent = opts.message;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'undo-toast-btn';
  btn.textContent = opts.actionLabel ?? t('Undo');
  const bar = document.createElement('span');
  bar.className = 'undo-toast-bar';
  bar.setAttribute('aria-hidden', 'true');
  bar.style.animationDuration = `${duration}ms`;
  let accept: HTMLButtonElement | null = null;
  if (opts.acceptLabel) {
    accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'undo-toast-btn';
    accept.textContent = opts.acceptLabel;
  }
  if (accept) {
    // The pair wraps as one unit, so a narrow screen never strands one button.
    const actions = document.createElement('span');
    actions.className = 'undo-toast-actions';
    actions.append(btn, accept);
    el.append(msg, actions, bar);
  } else {
    el.append(msg, btn, bar);
  }
  ensureWrap().appendChild(el);

  let settled = false;
  const remove = (): void => {
    pending.delete(settle);
    el.remove();
  };
  const settle = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try { void opts.commit?.(); } finally { remove(); }
  };
  const timer = setTimeout(settle, duration);
  btn.addEventListener('click', () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    try { void opts.undo(); } finally { remove(); }
  });
  accept?.addEventListener('click', settle);
  pending.add(settle);
  const withdraw = (): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    remove();
  };
  return { settle, withdraw };
}

/** Commit every pending toast NOW. Call from a view's unmount. */
export function flushUndoToasts(): void {
  for (const settle of [...pending]) settle();
}
