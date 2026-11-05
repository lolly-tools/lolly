// SPDX-License-Identifier: MPL-2.0
/**
 * Tool view - the document's state with reviewers, on the export bar.
 *
 * One control for the current state, in the slot Download would hold: Request approval,
 * then In review, then Download approved file when the current inputs, format and size
 * match an approved request, and Request approval again once they have changed. A line
 * under it says the rest, with a way to open the request.
 *
 * The instance decides the state for inputs and format: this view sends the inputs and
 * never works out a digest. It asks once on mount, again once an input has settled (a newer
 * edit cancels the wait and any answer on its way), after a request is sent, and when the
 * window comes back no sooner than half a minute after the last ask. It asks nothing when
 * the tool has no chain or no approval flow is registered, and an instance that gives no
 * answer leaves the plain request in place.
 *
 * An approval covers one exact file, and the instance's answer does not cover size. So when
 * the answer points to a request, this view reads this person's requests once, for that state
 * change, and compares the size each file records with the size on the bar. Editing the size
 * reads nothing: the comparison runs again once the field has rested, and once more on the
 * click. The same inputs can hold several requests at different sizes, and the one that fits
 * the bar decides. A setting the file does not record cannot be compared: marks, bleed,
 * transparency, and the page size of a PDF, which the app does not measure.
 *
 * Download approved file fetches the stored bytes and hands them to the bar's ordinary
 * delivery result. It runs no export, so the file is exactly what was reviewed.
 */
import { t, tRaw } from '../../i18n.ts';
import { approvalWork, type ApprovalFile, type ApprovalState, type ApprovalStatus } from '../../lib/approval-request.ts';
import { getExportPolicy } from '../../lib/export-policy.ts';
import { shareUrlState } from '../../lib/share-privacy.ts';
import { recordedFileSize } from '../export-dimension-fields.ts';
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

/** The bar's settings, as a file would record them. A side is absent when the tool
 *  chooses that side. A physical unit rounds on its way to pixels, so a side may be one off. */
export interface BarSettings {
  format: string;
  width?: number;
  height?: number;
  physical: boolean;
}

/** An answer with the bar's settings applied. `resized` is an open request for these
 *  inputs at another size: nothing for this size is with reviewers yet. */
export interface BarAnswer {
  state: ApprovalState | 'resized';
  approvalId?: string;
  decidedAt?: string;
  file?: ApprovalFile;
}

/** Whether a file is the one these settings would write. A side either of them does not
 *  state cannot differ. Pure. */
export function fileFits(file: ApprovalFile, settings: BarSettings): boolean {
  if (file.format !== settings.format) return false;
  const slack = settings.physical || file.video ? 1 : 0;
  const near = (recorded: number | undefined, current: number | undefined): boolean =>
    recorded === undefined || current === undefined || Math.abs(recorded - current) <= slack;
  return near(file.widthPx, settings.width) && near(file.heightPx, settings.height);
}

/** Apply the bar's settings to the instance's answer. Among the files for these inputs,
 *  newest first, approved beats open beats rejected, as the instance orders them. With no
 *  file to compare, the answer is kept, and the view then gives no size. Pure. */
export function answerForSettings(status: ApprovalStatus | null, files: readonly ApprovalFile[] | null, settings: BarSettings): BarAnswer | null {
  if (!status || (status.state !== 'approved' && status.state !== 'in_review') || !files?.length) return status;
  const fits = files.filter(file => fileFits(file, settings));
  const file = fits.find(row => row.state === 'approved') ?? fits.find(row => row.state === 'in_review') ?? fits.find(row => row.state === 'rejected');
  if (file) return { state: file.state, approvalId: file.approvalId, file, ...(file.decidedAt ? { decidedAt: file.decidedAt } : {}) };
  return { state: status.state === 'approved' ? 'changed' : 'resized', ...(status.approvalId ? { approvalId: status.approvalId } : {}) };
}

/** A file in a few words: its format, and its size when it records one. */
const fileWords = (file: ApprovalFile): string => {
  const format = file.format.toUpperCase();
  return file.widthPx && file.heightPx ? `${format}, ${file.widthPx} × ${file.heightPx}` : format;
};

const approvedNote = (answer: BarAnswer): string => {
  const date = dayOf(answer.decidedAt);
  if (!answer.file) return date ? tRaw('Approved {date}. Size not checked.', { date }) : t('Approved. Size not checked.');
  const file = fileWords(answer.file);
  return date ? tRaw('Approved {date}. {file}.', { date, file }) : tRaw('Approved. {file}.', { file });
};

/** The bar for an answer. No answer is the plain request. Pure. */
export function approvalBarView(status: BarAnswer | null): ApprovalBarView {
  const request = t('Request approval');
  switch (status?.state) {
    case 'in_review':
      return { action: 'wait', label: t('In review'), note: t('Reviewers have this file.'), open: status.approvalId ? t('See request') : '' };
    case 'approved':
      return { action: 'download', label: t('Download approved file'), note: approvedNote(status), open: '' };
    case 'rejected':
      return { action: 'request', label: request, note: t('Not approved.'), open: status.approvalId ? t('See why') : '' };
    case 'changed':
      return { action: 'request', label: request, note: t('Changed since approval.'), open: status.approvalId ? t('See request') : '' };
    case 'resized':
      return { action: 'request', label: request, note: t('Changed since the request.'), open: status.approvalId ? t('See request') : '' };
    default:
      return { action: 'request', label: request, note: '', open: '' };
  }
}

/** One document's state on the bar, and the handles that end the watch. */
export interface ApprovalBar {
  status: ApprovalStatus | null;
  /** The files behind the answer, or null when none were read or the read failed. */
  files: ApprovalFile[] | null;
  /** The state the files were read for. The same state reads nothing again. */
  filesFor: string;
  /** Read the files on the next answer, even an unchanged one: a request went out or time passed. */
  filesStale: boolean;
  /** The last approved request for a set of inputs. The answer for another format leaves
   *  this request out, and the person still needs to know this format is a different file. */
  approved: { query: string; approvalId: string } | null;
  timer: ReturnType<typeof setTimeout> | null;
  sizeTimer: ReturnType<typeof setTimeout> | null;
  asking: AbortController | null;
  askedAt: number;
  busy: boolean;
  stop: () => void;
}

const control = (ta: ActionsCtx): HTMLElement | null | undefined => ta.el?.querySelector<HTMLElement>('[data-action="request-approval"]');

/** The format the instance recorded for a request: the extension the export writes.
 *  A print PDF, for one, is a format of its own here and a plain `pdf` on the record. */
const requestedFormat = (ta: ActionsCtx): string => {
  const format = extFor(ta.formatEl?.value ?? ta.formats[0] ?? '', null).toLowerCase();
  return format === 'jpeg' ? 'jpg' : format;
};

/** What the bar is set to now. A tool with no size of its own states none: its inputs,
 *  which the instance already compared, decide the size. */
function barSettings(ta: ActionsCtx): BarSettings {
  const { manifest } = ta;
  const format = requestedFormat(ta);
  if (manifest.designTool || manifest.render.dims === false) return { format, physical: false };
  const dims = ta.dims.exportDims();
  return { format, ...recordedFileSize(dims, format), physical: typeof dims.width === 'string' || typeof dims.height === 'string' };
}

const currentAnswer = (ta: ActionsCtx, bar: ApprovalBar): BarAnswer | null => answerForSettings(bar.status, bar.files, barSettings(ta));

function paint(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  const button = control(ta);
  if (!bar || !button || bar.busy || button.getAttribute('aria-busy') === 'true') return;
  const answer = currentAnswer(ta, bar);
  const view = approvalBarView(answer);
  if (button.textContent !== view.label) button.textContent = view.label;
  button.dataset.approvalLabel = view.label;
  button.dataset.approvalState = answer?.state ?? 'none';
  button.toggleAttribute('disabled', view.action === 'wait');
  const line = ta.el?.querySelector<HTMLElement>('[data-approval-status]');
  if (!line) return;
  line.replaceChildren();
  line.hidden = !view.note;
  if (!view.note) return;
  const words = document.createElement('span');
  words.textContent = view.note;
  line.append(words);
  if (view.open && answer?.approvalId) {
    const { approvalId } = answer;
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'btn btn--ghost btn--sm'; open.textContent = view.open;
    open.addEventListener('click', () => { approvalWork()?.open(approvalId); });
    line.append(open);
  }
}

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
  if (answer?.state === 'approved' && answer.approvalId) bar.approved = { query, approvalId: answer.approvalId };
  const status: ApprovalStatus | null = answer?.state === 'none' && bar.approved?.query === query
    ? { state: 'changed', approvalId: bar.approved.approvalId } : answer;
  const named = (status?.state === 'approved' || status?.state === 'in_review') ? status.approvalId : undefined;
  const readFor = named ? `${status?.state}:${named}` : '';
  if (!named) { bar.files = null; bar.filesFor = ''; }
  else if (readFor !== bar.filesFor || bar.filesStale) {
    const files = await work.files(named).catch(() => null);
    if (asking.signal.aborted || ta.approvalBar !== bar) return;
    bar.files = files; bar.filesFor = readFor; bar.filesStale = !files;
  }
  bar.asking = null;
  bar.status = status;
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

/** Ask now. A request was just sent, so the answer is worth having at once, and the
 *  answer alone may not show the new request: an older approval still comes first. */
export function refresh(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  if (bar.timer !== null) { clearTimeout(bar.timer); bar.timer = null; }
  bar.filesStale = true;
  void ask(ta);
}

/** The size on the bar moved. Compare again once it has rested. This reads nothing. */
export function sizeChanged(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  if (bar.sizeTimer !== null) clearTimeout(bar.sizeTimer);
  bar.sizeTimer = setTimeout(() => { bar.sizeTimer = null; if (ta.approvalBar === bar) paint(ta); }, SETTLE_MS);
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
  const answer = currentAnswer(ta, bar);
  const view = approvalBarView(answer);
  // The settings moved and the bar has not caught up. Show the current state, and let the
  // next click act on that, so nobody receives a file they were not shown.
  const shown = control(ta)?.dataset.approvalLabel;
  if (shown && shown !== view.label) { paint(ta); return true; }
  if (view.action === 'wait') return true;
  if (view.action === 'download' && answer?.approvalId) { void downloadApproved(ta, answer.approvalId); return true; }
  return false;
}

/** Start following this document. Does nothing, and asks nothing, without a chain. */
export function wire(ta: ActionsCtx): void {
  if (!control(ta) || !approvalWork() || !getExportPolicy()?.approvalChainFor(ta.manifest.id)) return;
  const onChange = (): void => { schedule(ta); };
  const onFocus = (): void => { const bar = ta.approvalBar; if (bar && Date.now() - bar.askedAt >= REFOCUS_MS) { bar.filesStale = true; void ask(ta); } };
  const onSize = (): void => { sizeChanged(ta); };
  // Width and height report through sizeChanged, which also covers a scrub. These two
  // change the size a file records without touching those fields' own handlers.
  const sizeFields = [...(ta.el?.querySelectorAll<HTMLElement>('[data-action="export-unit"], [data-action="export-dpi"]') ?? [])];
  const unsubscribe = ta.runtime.subscribe(onChange);
  ta.formatEl?.addEventListener('change', onChange);
  window.addEventListener('focus', onFocus);
  for (const field of sizeFields) { field.addEventListener('input', onSize); field.addEventListener('change', onSize); }
  ta.approvalBar = {
    status: null, files: null, filesFor: '', filesStale: false, approved: null,
    timer: null, sizeTimer: null, asking: null, askedAt: 0, busy: false,
    stop: () => {
      unsubscribe();
      ta.formatEl?.removeEventListener('change', onChange);
      window.removeEventListener('focus', onFocus);
      for (const field of sizeFields) { field.removeEventListener('input', onSize); field.removeEventListener('change', onSize); }
    },
  };
  void ask(ta);
}

export function dispose(ta: ActionsCtx): void {
  const bar = ta.approvalBar;
  if (!bar) return;
  ta.approvalBar = null;
  if (bar.timer !== null) clearTimeout(bar.timer);
  if (bar.sizeTimer !== null) clearTimeout(bar.sizeTimer);
  bar.asking?.abort();
  bar.stop();
}

export function approvalStateOps(ta: ActionsCtx) {
  return {
    wire: bindOp(ta, wire),
    refresh: bindOp(ta, refresh),
    sizeChanged: bindOp(ta, sizeChanged),
    handleClick: bindOp(ta, handleClick),
    dispose: bindOp(ta, dispose),
  };
}
