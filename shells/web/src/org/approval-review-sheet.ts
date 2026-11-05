// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-review-sheet - one approval request, in the shell: the file, its facts,
 * who decided what, and what this person can do next. Opened from the notification
 * queue and from a view that shows a request's state. The console stays the place for
 * chains, history and everything an admin does.
 *
 * A reviewer sees the file and decides, under the same rules as the console. The
 * Approve button stays off until the bytes have arrived with the token the instance
 * returns only with them, so nobody approves a file they have not loaded. The requester
 * sees the file once it is approved, and a rejection's reason without any file. A person
 * cannot reject without saying why.
 *
 * Everything the instance sends reaches the page through textContent. The bytes shown
 * are the bytes the request recorded: a digest mismatch shows no file and offers no
 * Approve. Modal lifecycle (Escape, backdrop, focus, teardown) is components/modal.ts.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */
import { announce } from '../a11y.ts';
import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { approvalPdfPreview } from '../lib/approval-request.ts';
import { deliverFile } from '../lib/deliver-file.ts';
import { fmtBytes } from '../lib/format.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { ApprovalArtifactError } from './approval-artifact.ts';
import { acknowledgeApprovalMessage } from './approval-queue.ts';
import { currentApproval, decideApproval, decidedAt, fetchApprovalFile, type ApprovalRow } from './approval-work.ts';

/** Above this a file waits for a click before it comes down, as the console does. */
const AUTOLOAD_BYTES = 16 * 1024 * 1024;

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', words = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (words) el.textContent = words;
  return el;
};
const btn = (cls: string, words: string): HTMLButtonElement => {
  const el = node('button', cls, words); el.type = 'button'; return el;
};
const dateOf = (iso: string): string => {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? '' : at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** The facts line under the file. Pure. */
export function factsLine(row: Pick<ApprovalRow, 'exportReview'>): string {
  const f = row.exportReview;
  return [f.format.toUpperCase(), f.widthPx && f.heightPx ? `${f.widthPx} × ${f.heightPx}` : '', f.size ? fmtBytes(f.size) : '',
    f.toolId ? [f.toolId, f.toolVersion].filter(Boolean).join(' ') : '', `SHA-256 ${f.sha256.slice(0, 12)}…`].filter(Boolean).join(' · ');
}

/** The line under the title: who asked and which step comes next. Pure. */
export function standingLine(row: Pick<ApprovalRow, 'relation' | 'state' | 'stepIndex' | 'stepCount' | 'stepName' | 'createdByName' | 'actions' | 'createdAt'>): string {
  if (row.state === 'approved') return tRaw('Approved {date}', { date: dateOf(decidedAt(row)) });
  if (row.state === 'rejected') return tRaw('Not approved {date}', { date: dateOf(decidedAt(row)) });
  if (row.state === 'withdrawn') return t('Withdrawn');
  const step = row.stepCount > 1 ? tRaw('Step {n} of {total}', { n: row.stepIndex + 1, total: row.stepCount }) : '';
  const where = [row.stepName, step].filter(Boolean).join(' · ');
  return row.relation === 'inbox'
    ? [tRaw('Asked by {name}', { name: row.createdByName }), where].filter(Boolean).join(' · ')
    : [t('In review'), where].filter(Boolean).join(' · ');
}

/** The sentence for an instance's refusal. */
export function refusalWords(error: unknown): string {
  const code = error instanceof ApprovalArtifactError ? error.code : undefined;
  if (code === 'ARTIFACT_SUBJECT_CHANGED') return t('This request changed. Close this and open it again.');
  if (code === 'ARTIFACT_NOT_LOADED') return t('Load the file before you approve.');
  if (code === 'ARTIFACT_REMOVED') return t('This request no longer holds its file.');
  if (code === 'ARTIFACT_DIGEST_MISMATCH') return t('This file does not match what was requested, so it cannot be approved.');
  if (code === 'SEPARATION_OF_DUTIES') return t('You cannot decide your own request.');
  if (code === 'NOT_ELIGIBLE' || code === 'ALREADY_ACTED' || code === 'NOT_OPEN' || code === 'TERMINAL') return t('This step has moved on. Close this and open it again.');
  return t('Could not finish that. Try again.');
}

/** Draw the file in the stage. Returns what to release when the sheet closes. */
function showFile(stage: HTMLElement, row: ApprovalRow, blob: Blob): () => void {
  const urls: string[] = [];
  const urlOf = (b: Blob): string => { const url = URL.createObjectURL(b); urls.push(url); return url; };
  const { preview, name } = row.exportReview;
  const label = tRaw('File for review: {name}', { name });
  const words = (s: string): void => { stage.replaceChildren(node('p', '', s)); };
  const picture = (b: Blob): void => {
    const img = node('img'); img.alt = label;
    img.addEventListener('error', () => { words(name); });
    img.src = urlOf(b);
    stage.replaceChildren(img);
  };
  if (preview === 'image') picture(blob);
  else if (preview === 'video') {
    const video = node('video'); video.controls = true; video.muted = true; video.setAttribute('aria-label', label); video.src = urlOf(blob);
    stage.replaceChildren(video);
  } else if (preview === 'audio') {
    const audio = node('audio'); audio.controls = true; audio.setAttribute('aria-label', label); audio.src = urlOf(blob);
    stage.replaceChildren(audio);
  } else if (preview === 'pdf') {
    words(name);
    void approvalPdfPreview(blob).then((page) => { if (page && stage.isConnected) picture(page); });
  } else words(name);
  return () => { for (const url of urls) URL.revokeObjectURL(url); };
}

/** Open one request. Says so when it is no longer there. */
export async function openApprovalSheet(id: string): Promise<void> {
  const row = await currentApproval(id);
  if (!row) { announce(t('This request is no longer available.'), { assertive: true }); return; }
  mountSheet(row);
}

function mountSheet(row: ApprovalRow): void {
  const canDecide = row.relation === 'inbox' && (row.state === 'submitted' || row.state === 'in_review');
  const requesterGetsFile = row.relation === 'mine' && row.state === 'approved';
  const hasFile = !row.exportReview.removedAt && (canDecide || requesterGetsFile);
  let release: () => void = () => {};
  const controller = new AbortController();
  const modal = mountModal<void>('', {
    className: 'modal approval-dialog approval-review',
    ariaLabel: row.title,
    onClose: () => { controller.abort(); release(); },
  });
  const sheet = modal.el;
  const body = node('div', 'approval-dialog-body');
  const title = node('h2', 'modal-title', row.title);
  const standing = node('p', 'approval-review-standing', standingLine(row));
  const file = node('div', 'approval-file');
  const stage = node('div', 'approval-file-stage');
  const facts = node('p', 'approval-file-facts', factsLine(row));
  const error = node('p', 'approval-error'); error.setAttribute('role', 'status'); error.hidden = true;
  const added = node('p', 'approval-file-note'); added.setAttribute('role', 'status'); added.hidden = true;
  const actions = node('div', 'approval-dialog-actions');
  const say = (words: string): void => { error.textContent = words; error.hidden = false; announce(words, { assertive: true }); };
  const clearSay = (): void => { error.hidden = true; error.textContent = ''; };
  body.append(title, standing);

  // The decisions so far, each with its reason. Earlier steps first.
  const history = row.actions.filter(a => a.comment || row.state === 'rejected' || row.relation === 'inbox');
  const historyList = history.length ? node('ul', 'approval-review-history') : null;
  for (const a of history) {
    const li = node('li');
    li.append(node('span', 'approval-review-who', a.action === 'approve' ? tRaw('{name} approved', { name: a.actorName }) : tRaw('{name} did not approve', { name: a.actorName })));
    if (a.comment) li.append(node('q', '', a.comment));
    historyList!.append(li);
  }

  let loaded: Blob | null = null;
  let token: string | null = null;
  const approve = canDecide ? btn('btn btn--primary', t('Approve')) : null;
  const reject = canDecide ? btn('btn', t('Reject')) : null;
  const comment = canDecide ? node('input', 'field-input') : null;
  const getFile = requesterGetsFile ? btn('btn btn--primary', t('Download approved file')) : null;
  const addToProject = requesterGetsFile ? btn('btn', t('Add to project')) : null;
  const download = canDecide ? btn('btn approval-review-aside', t('Download')) : null;
  const paintReady = (): void => {
    if (approve) approve.disabled = !token;
    if (getFile) getFile.disabled = !loaded;
    if (addToProject) addToProject.disabled = !loaded;
    if (download) download.disabled = !loaded;
  };

  const load = async (): Promise<void> => {
    clearSay();
    stage.replaceChildren(node('p', '', t('Loading…')));
    try {
      const got = await fetchApprovalFile(row);
      if (controller.signal.aborted) return;
      loaded = got.blob; token = got.token;
      release = showFile(stage, row, got.blob);
      if (canDecide && !got.token) say(t('You can read this file here, and decide in the console.'));
    } catch (e) {
      if (controller.signal.aborted) return;
      stage.replaceChildren(node('p', '', row.exportReview.name));
      say(refusalWords(e));
    }
    paintReady();
  };

  if (hasFile) {
    file.append(stage, facts);
    if (row.exportReview.size > AUTOLOAD_BYTES) {
      const start = btn('btn', tRaw('Load file ({size})', { size: fmtBytes(row.exportReview.size) }));
      start.addEventListener('click', () => { void load(); });
      stage.replaceChildren(start);
    } else void load();
    body.append(file);
  } else {
    const note = row.exportReview.removedAt ? t('This request no longer holds its file.')
      : row.relation === 'mine' && row.state !== 'approved' && row.state !== 'rejected' ? t('Reviewers have this file. You get it once it is approved.') : '';
    file.append(facts);
    if (note) file.append(node('p', 'approval-file-note', note));
    body.append(file);
  }
  if (historyList) body.append(historyList);

  const close = btn('btn', t('Close'));
  close.addEventListener('click', () => { modal.close(); });

  if (comment && approve && reject && download) {
    const field = node('label', 'approval-review-field', t('Comment'));
    comment.type = 'text'; comment.maxLength = 2000; comment.autocomplete = 'off';
    comment.placeholder = t('Needed to reject');
    comment.addEventListener('input', () => { comment.removeAttribute('aria-invalid'); clearSay(); });
    field.append(comment);
    body.append(field);
    const decide = async (action: 'approve' | 'reject'): Promise<void> => {
      const reason = comment.value.trim();
      if (action === 'reject' && !reason) {
        comment.setAttribute('aria-invalid', 'true'); comment.focus();
        say(t('Add a reason before you reject.'));
        return;
      }
      clearSay();
      approve.disabled = true; reject.disabled = true;
      try {
        await decideApproval(row, action, reason, token);
        acknowledgeApprovalMessage(row.id);
        announce(action === 'approve' ? tRaw('Approved {title}', { title: row.title }) : tRaw('Rejected {title}', { title: row.title }));
        modal.close();
      } catch (e) {
        say(refusalWords(e));
        reject.disabled = false; paintReady();
      }
    };
    approve.addEventListener('click', () => { void decide('approve'); });
    reject.addEventListener('click', () => { void decide('reject'); });
    download.addEventListener('click', () => {
      const host = getHostRef();
      if (loaded && host) void deliverFile(host, loaded, row.exportReview.name);
    });
    actions.append(download, close, reject, approve);
  } else if (getFile && addToProject) {
    getFile.addEventListener('click', () => {
      const host = getHostRef();
      if (loaded && host) void deliverFile(host, loaded, row.exportReview.name);
      acknowledgeApprovalMessage(row.id);
    });
    addToProject.addEventListener('click', () => {
      const blob = loaded;
      if (!blob) return;
      void import('./approval-add-to-project.ts').then(m => m.addApprovedFileToProject(row, blob))
        .then((words) => { if (words) { added.textContent = words; added.hidden = false; announce(words); } })
        .catch(() => { say(t('Could not finish that. Try again.')); });
    });
    actions.append(close, addToProject, getFile);
  } else actions.append(close);
  paintReady();
  body.append(error, added, actions);
  sheet.append(body);
  // A person reads first: nothing that decides takes the opening focus.
  (getFile ?? close).focus();
}
