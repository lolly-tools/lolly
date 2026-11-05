// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - the document's state with reviewers, on the export bar.
 *
 * One control for the current state, in the slot Download would hold: Request approval,
 * then In review, then Download approved file when the current inputs and format match
 * an approved request, and Request approval again once they have changed. A line under
 * it says the rest, with a way to open the request.
 *
 * The instance decides the state: this view sends the inputs and never works out a
 * digest. It asks once on mount, again once an input has settled (a newer edit cancels
 * the wait and any answer on its way), after a request is sent, and when the window comes
 * back no sooner than half a minute after the last ask. It asks nothing when the tool has
 * no chain or no approval flow is registered, and an instance that gives no answer leaves
 * the plain request in place.
 *
 * Download approved file fetches the stored bytes and hands them to the bar's ordinary
 * delivery result. It runs no export, so the file is exactly what was reviewed.
 */
import { t, tRaw } from '../../i18n.ts';
import { approvalWork, type ApprovalStatus } from '../../lib/approval-request.ts';
import { getExportPolicy } from '../../lib/export-policy.ts';
import { shareUrlState } from '../../lib/share-privacy.ts';
import { extFor } from './shared.ts';
import { bindOp, type ActionsCtx } from './context.ts';

/** How long an input must rest before the instance is asked. */
export const SETTLE_MS = 600;
/** The window coming back asks again only after this long. */
const REFOCUS_MS = 30_000;
/** The same ceiling the request uses: past it the values are not sent at all. */
const QUERY_LIMIT_CHARS = 256 * 1024;

/** What the bar shows for one answer. */
export interface ApprovalBarView {
  action: 'request' | 'wait' | 'download';
  label: string;
  /** One plain line under the control, or nothing. */
  note: string;
  /** A way to open the request, when there is one to open. */
  open: string;
}

const dayOf = (iso: string | undefined): string => {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

/** The bar for an answer. No answer is the plain request. Pure. */
export function approvalBarView(status: ApprovalStatus | null): ApprovalBarView {
  const request = t('Request approval');
  switch (status?.state) {
    case 'in_review':
      return { action: 'wait', label: t('In review'), note: t('Reviewers have this file.'), open: status.approvalId ? t('See request') : '' };
    case 'approved': {
      const day = dayOf(status.decidedAt);
      return { action: 'download', label: t('Download approved file'), note: day ? tRaw('Approved {date}.', { date: day }) : t('Approved.'), open: '' };
    }
    case 'rejected':
      return { action: 'request', label: request, note: t('Not approved.'), open: status.approvalId ? t('See why') : '' };
    case 'changed':
      return { action: 'request', label: request, note: t('Changed since approval.'), open: status.approvalId ? t('See request') : '' };
    default:
      return { action: 'request', label: request, note: '', open: '' };
  }
}

/** One document's state on the bar, and the handles that end the watch. */
export interface ApprovalBar {
  status: ApprovalStatus | null;
  timer: ReturnType<typeof setTimeout> | null;
  asking: AbortController | null;
  askedAt: number;
  busy: boolean;
  stop: () => void;
}

const control = (ta: ActionsCtx): HTMLElement | null | undefined => ta.el?.querySelector<HTMLElement>('[data-action="request-approval"]');

function paint(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  const button = control(ta);
  if (!bar || !button || bar.busy || button.getAttribute('aria-busy') === 'true') return;
  const view = approvalBarView(bar.status);
  if (button.textContent !== view.label) button.textContent = view.label;
  button.dataset.approvalLabel = view.label;
  button.dataset.approvalState = bar.status?.state ?? 'none';
  button.toggleAttribute('disabled', view.action === 'wait');
  const line = ta.el?.querySelector<HTMLElement>('[data-approval-status]');
  if (!line) return;
  line.replaceChildren();
  line.hidden = !view.note;
  if (!view.note) return;
  const words = document.createElement('span');
  words.textContent = view.note;
  line.append(words);
  if (view.open && bar.status?.approvalId) {
    const { approvalId } = bar.status;
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'btn btn--ghost btn--sm'; open.textContent = view.open;
    open.addEventListener('click', () => { approvalWork()?.open(approvalId); });
    line.append(open);
  }
}

/** The format the instance recorded for a request: the extension the export writes.
 *  A print PDF, for one, is a format of its own here and a plain `pdf` on the record. */
const requestedFormat = (ta: ActionsCtx): string => {
  const format = extFor(ta.formatEl?.value ?? ta.formats[0] ?? '', null).toLowerCase();
  return format === 'jpeg' ? 'jpg' : format;
};

async function ask(ta: ActionsCtx): Promise<void> {
  const bar = ta.approvalBar;
  const work = approvalWork();
  if (!bar || !work) return;
  bar.asking?.abort();
  let query: string;
  try { query = shareUrlState(ta.runtime.getModel()); } catch { bar.status = null; paint(ta); return; }
  if (query.length > QUERY_LIMIT_CHARS) { bar.status = null; paint(ta); return; }
  const asking = new AbortController();
  bar.asking = asking;
  bar.askedAt = Date.now();
  const answer = await work.status({ toolId: ta.manifest.id, format: requestedFormat(ta), query }, asking.signal).catch(() => null);
  if (asking.signal.aborted || ta.approvalBar !== bar) return;
  bar.asking = null;
  bar.status = answer;
  paint(ta);
}

/** Ask once things have rested. A newer call cancels the wait and any answer on its way. */
function schedule(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  if (bar.timer !== null) clearTimeout(bar.timer);
  bar.asking?.abort();
  bar.asking = null;
  bar.timer = setTimeout(() => { bar.timer = null; void ask(ta); }, SETTLE_MS);
}

/** Ask now. A request was just sent, so the answer is worth having at once. */
export function refresh(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  if (bar.timer !== null) { clearTimeout(bar.timer); bar.timer = null; }
  void ask(ta);
}

async function downloadApproved(ta: ActionsCtx, approvalId: string): Promise<void> {
  const bar = ta.approvalBar;
  const work = approvalWork();
  const button = control(ta);
  if (!bar || !work || !button || bar.busy) return;
  bar.busy = true;
  button.setAttribute('aria-busy', 'true');
  button.toggleAttribute('disabled', true);
  button.textContent = t('Getting file…');
  let failed = false;
  try {
    const { blob, name } = await work.approvedFile(approvalId);
    await ta.saving.deliverToBar(blob, name, tRaw('{name} · approved', { name }));
    if (ta.experience.recordDeviceActivity !== false) {
      void import('../../lib/export-activity.ts').then(({ recordExportActivity }) => recordExportActivity({
        allowed: true, bytes: blob, capture: async () => null,
        entry: { toolId: ta.manifest.id, label: ta.manifest.name, filename: name, format: requestedFormat(ta), query: shareUrlState(ta.runtime.getModel()), ...(ta.activeSlot ? { slot: ta.activeSlot } : {}) },
      })).catch(() => {});
    }
  } catch { failed = true; }
  bar.busy = false;
  button.removeAttribute('aria-busy');
  paint(ta);
  if (failed) {
    const line = ta.el?.querySelector<HTMLElement>('[data-approval-status]');
    if (line) { line.textContent = t('Could not get the approved file. Try again.'); line.hidden = false; }
  }
}

/** Take the click when this state owns the control. False hands it to the request flow. */
export function handleClick(ta: ActionsCtx): boolean {
  const bar = ta.approvalBar;
  if (!bar) return false;
  const view = approvalBarView(bar.status);
  if (view.action === 'wait') return true;
  if (view.action === 'download' && bar.status?.approvalId) { void downloadApproved(ta, bar.status.approvalId); return true; }
  return false;
}

/** Start following this document. Does nothing, and asks nothing, without a chain. */
export function wire(ta: ActionsCtx): void {
  if (!control(ta) || !approvalWork() || !getExportPolicy()?.approvalChainFor(ta.manifest.id)) return;
  const onChange = (): void => { schedule(ta); };
  const onFocus = (): void => { const bar = ta.approvalBar; if (bar && Date.now() - bar.askedAt >= REFOCUS_MS) void ask(ta); };
  const unsubscribe = ta.runtime.subscribe(onChange);
  ta.formatEl?.addEventListener('change', onChange);
  window.addEventListener('focus', onFocus);
  ta.approvalBar = {
    status: null, timer: null, asking: null, askedAt: 0, busy: false,
    stop: () => {
      unsubscribe();
      ta.formatEl?.removeEventListener('change', onChange);
      window.removeEventListener('focus', onFocus);
    },
  };
  void ask(ta);
}

export function dispose(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  ta.approvalBar = null;
  if (bar.timer !== null) clearTimeout(bar.timer);
  bar.asking?.abort();
  bar.stop();
}

export function approvalStateOps(ta: ActionsCtx) {
  return {
    wire: bindOp(ta, wire),
    refresh: bindOp(ta, refresh),
    handleClick: bindOp(ta, handleClick),
    dispose: bindOp(ta, dispose),
  };
}
