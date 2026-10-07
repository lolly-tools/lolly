// SPDX-License-Identifier: MPL-2.0
/**
 * org/catalog-submit - "Submit to <workspace>": offer one of this person's own things
 * (an upload, a saved template, a tool they built) to the workspace's shared catalog.
 *
 * Registered by src/org/index.ts through the generic lib/catalog-submit.ts seam, and
 * only for a member whose org-config grants `can['catalog.submit']`, so a plain build
 * and a member without the right never see the action. Loaded lazily the first time
 * someone opens the dialog.
 *
 * Server contract (the control plane's documented catalog submit):
 *   POST /api/v1/catalog/submit?name&description&tags&type&toolId&note&clientRef
 *        body: the bytes (a file, or the template / user tool JSON)
 *        -> { assetId, state: 'live' | 'submitted', duplicate }
 *   GET  /api/v1/catalog/submissions -> { submissions: [{ clientRef, state, comment, ... }] }
 * `clientRef` is this shell's own reference for the thing (`template:<id>`), echoed on
 * the submission, which is how the dialog finds and shows an earlier one.
 *
 * Whether a submission goes live at once or waits for review is the workspace's
 * policy; the dialog says which happened and never promises either in advance. Every
 * string reaches the page through textContent.
 */
import '../styles/catalog-submit.css';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { mountModal } from '../components/modal.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import type { CatalogSubmitSubject } from '../lib/catalog-submit.ts';

/** One row of the submissions list, as much of it as this dialog reads. */
export interface SubmissionRow {
  id: string;
  state: 'submitted' | 'live' | 'returned';
  clientRef?: string;
  comment?: string;
  at?: string;
}

/** The control plane's `type` for a subject kind; an upload lets the server decide. */
export function submitType(kind: CatalogSubmitSubject['kind']): string | null {
  return kind === 'upload' ? null : kind;
}

/** The query a submission is sent with. Pure, exported for tests. */
export function submitQuery(subject: CatalogSubmitSubject, form: { name: string; description: string; tags: string; note: string }): URLSearchParams {
  const q = new URLSearchParams();
  const name = form.name.trim();
  if (name) q.set('name', name);
  if (form.description.trim()) q.set('description', form.description.trim());
  const tags = form.tags.split(',').map((x) => x.trim()).filter(Boolean);
  if (tags.length) q.set('tags', tags.join(','));
  const type = submitType(subject.kind);
  if (type) q.set('type', type);
  if (subject.toolId) q.set('toolId', subject.toolId);
  if (form.note.trim()) q.set('note', form.note.trim());
  q.set('clientRef', subject.ref);
  return q;
}

/** The newest submission for this subject, if it was submitted before. Pure. */
export function latestFor(rows: readonly SubmissionRow[], ref: string): SubmissionRow | null {
  const mine = rows.filter((r) => r.clientRef === ref);
  return mine.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))[0] ?? null;
}

/** A submission's state in words: "Waiting for review", "Live", "Returned: <why>". Pure. */
export function stateText(row: Pick<SubmissionRow, 'state' | 'comment'>): string {
  if (row.state === 'live') return t('Live');
  if (row.state === 'returned') return row.comment ? tRaw('Returned: {comment}', { comment: row.comment }) : t('Returned');
  return t('Waiting for review');
}

async function mySubmissions(): Promise<SubmissionRow[]> {
  try {
    const res = await instanceFetch(instancePath('/api/v1/catalog/submissions'), { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { submissions?: SubmissionRow[] };
    return Array.isArray(body.submissions) ? body.submissions : [];
  } catch {
    return [];
  }
}

/** Open the dialog for one subject. */
export function openCatalogSubmitDialog(subject: CatalogSubmitSubject, workspace: string): void {
  const title = workspace ? tRaw('Submit to {name}', { name: workspace }) : t('Submit to the catalog');
  const lead = subject.kind === 'upload'
    ? t('Offer this file to the shared catalog for others in the workspace to use.')
    : subject.kind === 'template'
      ? t('Offer this template to the shared catalog for others in the workspace to start from.')
      : t('Offer this tool to the shared catalog for others in the workspace to use.');
  const modal = mountModal<void>(`
    <h2 class="modal-title" data-title></h2>
    <p class="modal-msg">${escapeHtml(lead)}</p>
    <p class="catalog-submit-state" data-state role="status" hidden></p>
    <form class="catalog-submit-form" data-form novalidate>
      <label class="catalog-submit-field"><span>${escapeHtml(t('Name'))}</span>
        <input type="text" class="field-input" data-name maxlength="200" required></label>
      <label class="catalog-submit-field"><span>${escapeHtml(t('Description'))}</span>
        <input type="text" class="field-input" data-description maxlength="500"></label>
      <label class="catalog-submit-field"><span>${escapeHtml(t('Tags'))}</span>
        <input type="text" class="field-input" data-tags placeholder="${escapeHtml(t('Separate tags with commas'))}"></label>
      <label class="catalog-submit-field"><span>${escapeHtml(t('Note to the reviewer'))}</span>
        <textarea class="field-input" data-note rows="3" maxlength="500"></textarea></label>
      <p class="catalog-submit-error" data-error role="alert" hidden></p>
      <div class="modal-actions">
        <button type="button" class="btn" data-act="cancel">${escapeHtml(t('Cancel'))}</button>
        <button type="submit" class="btn modal-primary" data-act="submit">${escapeHtml(t('Submit'))}</button>
      </div>
    </form>`, {
    className: 'modal catalog-submit-dialog',
    ariaLabel: title,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-name]'),
  });
  const root = modal.el;
  const q = <T extends HTMLElement>(sel: string): T => root.querySelector<T>(sel)!;
  q('[data-title]').textContent = title;
  const form = q<HTMLFormElement>('[data-form]');
  const name = q<HTMLInputElement>('[data-name]');
  const description = q<HTMLInputElement>('[data-description]');
  const tags = q<HTMLInputElement>('[data-tags]');
  const note = q<HTMLTextAreaElement>('[data-note]');
  const stateEl = q('[data-state]');
  const errorEl = q('[data-error]');
  const submit = q<HTMLButtonElement>('[data-act="submit"]');
  const cancel = q<HTMLButtonElement>('[data-act="cancel"]');
  name.value = subject.name;
  description.value = subject.description ?? '';
  tags.value = (subject.tags ?? []).join(', ');

  const showState = (text: string, kind: 'info' | 'done' | 'returned'): void => {
    stateEl.textContent = text;
    stateEl.dataset.kind = kind;
    stateEl.hidden = false;
  };
  const fail = (text: string): void => {
    errorEl.textContent = text;
    errorEl.hidden = false;
    announce(text, { assertive: true });
  };

  // An earlier submission of this same thing: show its state before anyone
  // sends it twice. Submitting again stays possible (a returned one, fixed).
  void mySubmissions().then((rows) => {
    const prior = latestFor(rows, subject.ref);
    if (!prior || !root.isConnected) return;
    showState(tRaw('Already submitted: {state}', { state: stateText(prior) }), prior.state === 'returned' ? 'returned' : 'info');
  });

  cancel.addEventListener('click', () => modal.close());
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    if (!name.value.trim()) { fail(t('Give it a name first.')); name.focus(); return; }
    submit.disabled = true;
    void (async () => {
      try {
        const body = await subject.body();
        const query = submitQuery(subject, { name: name.value, description: description.value, tags: tags.value, note: note.value });
        const res = await instanceFetch(instancePath(`/api/v1/catalog/submit?${query}`), {
          method: 'POST',
          headers: { 'content-type': body.type || 'application/octet-stream' },
          body,
        });
        const answer = (await res.json().catch(() => null)) as { state?: string; duplicate?: boolean; error?: { message?: string } } | null;
        if (!res.ok) { fail(answer?.error?.message || t('The workspace could not take this submission.')); submit.disabled = false; return; }
        const done = answer?.duplicate
          ? t('This is already in the catalog.')
          : answer?.state === 'submitted'
            ? t('Sent. It is waiting for review.')
            : workspace ? tRaw('Live in {name}.', { name: workspace }) : t('Live in the catalog.');
        showState(done, 'done');
        announce(done);
        form.hidden = true;
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'btn modal-primary';
        close.textContent = t('Done');
        close.addEventListener('click', () => modal.close());
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        actions.append(close);
        root.append(actions);
        close.focus();
      } catch {
        fail(t('The workspace could not be reached. Try again.'));
        submit.disabled = false;
      }
    })();
  });
}
