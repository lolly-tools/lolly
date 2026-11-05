// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-queue - approval requests and decisions in the shell's one notification
 * queue (lib/notifications.ts, plan 320 J11).
 *
 * The instance's inbox only reaches a person it nominated, so a reviewer on a later
 * step, or one who shares a group with the nominee, would hear nothing there. The queue
 * reads the requests themselves: a request open on a step this person may decide, and
 * this person's own request once it is decided. The inbox's messages about those same
 * requests stay out of the queue (org/inbox.ts) and are acknowledged from here, so one
 * request is never two rows.
 *
 * Reads on the inbox's own rhythm: at once, then about a minute apart while the tab is
 * visible, on focus no sooner than a minute after the last read, and never while hidden.
 * A 401, 403 or 404 stops: this person has no requests here.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */
import { t, tRaw } from '../i18n.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { registerNotificationSource, notificationsChanged, type ShellNotification } from '../lib/notifications.ts';
import { ApprovalArtifactError } from './approval-artifact.ts';
import { decidedAt, listApprovals, knownApprovals, onApprovalsChange, type ApprovalRow } from './approval-work.ts';
import { dismissMessage, inboxMessages, nextPollDelay, POLL_MS } from './inbox.ts';

/** A decision stays in the queue this long. After that it is history, in the console. */
export const DECISION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * The queue's rows for these requests. A step moves on with its own id, so a person
 * who dismissed step one still hears about step two. Pure.
 */
export function approvalNotifications(
  rows: readonly ApprovalRow[], scope: string, open: (id: string) => void, acknowledge: (id: string) => void, now = Date.now(),
): ShellNotification[] {
  const out: ShellNotification[] = [];
  for (const row of rows) {
    const onDismiss = (): void => { acknowledge(row.id); };
    if (row.relation === 'inbox' && (row.state === 'submitted' || row.state === 'in_review')) {
      out.push({
        id: `approval:${scope}:${row.id}:${row.stepIndex}`, tone: 'action', dismissible: true, onDismiss,
        title: tRaw('Review {title}', { title: row.title }),
        body: tRaw('{name} asked for approval.', { name: row.createdByName }),
        action: { label: t('Review'), run: () => { open(row.id); } },
      });
    } else if (row.relation === 'mine' && (row.state === 'approved' || row.state === 'rejected')) {
      const at = Date.parse(decidedAt(row));
      if (Number.isFinite(at) && now - at > DECISION_WINDOW_MS) continue;
      const approved = row.state === 'approved';
      out.push({
        id: `approval:${scope}:${row.id}:${row.state}`, tone: approved ? 'info' : 'action', dismissible: true, onDismiss,
        title: approved ? tRaw('{title} is approved', { title: row.title }) : tRaw('{title} was not approved', { title: row.title }),
        action: { label: approved ? t('Get the file') : t('See why'), run: () => { open(row.id); } },
      });
    }
  }
  return out;
}

/** Acknowledge the inbox message about this request, if there is one. */
export function acknowledgeApprovalMessage(id: string): void {
  for (const message of inboxMessages()) {
    if (message.data?.kind === 'export-review' && message.data.approvalId === id && message.dismissible) dismissMessage(message.id);
  }
}

let stop: (() => void) | null = null;

/** Keep the queue current until the returned function runs. A second call takes over. */
export function startApprovalQueue(open: (id: string) => void): () => void {
  stop?.();
  const scope = getInstanceBase();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let lastAt = 0;
  let stopped = false;
  const visible = (): boolean => document.visibilityState !== 'hidden';
  const clear = (): void => { if (timer !== null) { clearTimeout(timer); timer = null; } };
  const schedule = (): void => {
    clear();
    if (stopped || !visible()) return;
    timer = setTimeout(() => { timer = null; void read(); }, nextPollDelay(failures, Math.random()));
    if (typeof timer === 'object' && timer && 'unref' in timer && typeof timer.unref === 'function') timer.unref();
  };
  const read = async (): Promise<void> => {
    if (stopped) return;
    lastAt = Date.now();
    try {
      await listApprovals();
      failures = 0;
    } catch (error) {
      const status = error instanceof ApprovalArtifactError ? error.status : 0;
      if (status === 401 || status === 403 || status === 404) { halt(); return; }
      failures++;
    }
    schedule();
  };
  const wake = (): void => {
    if (!visible()) { clear(); return; }
    if (Date.now() - lastAt >= POLL_MS) void read();
    else if (timer === null) schedule();
  };
  const detachSource = registerNotificationSource('approvals', () => approvalNotifications(knownApprovals(), scope, open, acknowledgeApprovalMessage));
  const detachRows = onApprovalsChange(notificationsChanged);
  const halt = (): void => {
    stopped = true;
    clear();
    window.removeEventListener('focus', wake);
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', wake);
  };
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  void read();
  stop = () => { halt(); detachSource(); detachRows(); stop = null; };
  return stop;
}
