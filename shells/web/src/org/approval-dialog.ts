// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-dialog - the "Request approval" flow for a tool's output.
 *
 * Loaded lazily by src/org/index.ts, and only when a deployment's control plane is
 * present AND the generic lib/export-policy.ts seam says the caller may request
 * approval (download withheld, request permitted). A plain (control-plane-free)
 * deployment never touches this file.
 *
 * It resolves the tool's approval chain from the export-policy accessor, fetches the
 * people eligible to approve the first step of that chain
 * (GET /api/v1/approvals/approvers), lets the requester nominate one by name, and
 * files the request (POST /api/v1/approvals). Both go through instanceFetch/
 * instancePath so a shell pointed at a remote instance files against THAT instance.
 * Errors surface inline in the dialog (never an alert()); the modal lifecycle
 * (Escape, backdrop, focus, teardown) is the shared components/modal.ts primitive.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import { getExportPolicy } from '../lib/export-policy.ts';
import type { ApprovalRequestContext } from '../lib/approval-request.ts';
import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';

// ── Contract types (the server product's documented shapes) ───────────────────

interface Approver { id: string; name: string }
interface ApproversReply {
  chainId: string;
  step: number;
  stepName?: string;
  groups?: string[];
  approvers: Approver[];
}
interface ApprovalBody {
  subjectType: 'asset';
  subjectRef: string;
  title: string;
  chainId: string;
  nominees: string[];
}

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/**
 * Filter the eligible-approver list by a name query (case-insensitive substring).
 * The list is already scoped to eligible people server-side, so this is a local
 * narrowing only - no per-keystroke round-trip. Pure.
 */
export function filterApprovers(approvers: readonly Approver[], query: string): Approver[] {
  const q = query.trim().toLowerCase();
  if (!q) return approvers.slice();
  return approvers.filter((a) => (a.name || a.id).toLowerCase().includes(q));
}

/** Assemble the POST /api/v1/approvals body from the resolved pieces. Pure. */
export function buildApprovalBody(o: { subjectRef: string; title: string; chainId: string; nominee: string }): ApprovalBody {
  return {
    subjectType: 'asset',
    subjectRef: o.subjectRef,
    title: o.title,
    chainId: o.chainId,
    nominees: [o.nominee],
  };
}

/**
 * The subjectRef a call site's context implies: its own reference when supplied
 * (e.g. a saved-session id), else a tool-scoped default (`tool:<id>`). Pure.
 */
export function subjectRefFor(ctx: ApprovalRequestContext): string {
  return ctx.subjectRef || (ctx.toolId ? `tool:${ctx.toolId}` : 'asset');
}

// ── Network (tolerant) ────────────────────────────────────────────────────────

async function fetchApprovers(chainId: string): Promise<ApproversReply | null> {
  try {
    const res = await instanceFetch(instancePath(`/api/v1/approvals/approvers?chainId=${encodeURIComponent(chainId)}`));
    if (!res.ok) return null;
    const body = (await res.json()) as ApproversReply;
    return body && Array.isArray(body.approvers) ? body : null;
  } catch {
    return null;
  }
}

/** POST the request. Resolves the outcome; a non-201 carries the server's error
 *  code (e.g. NOMINEE_NOT_ELIGIBLE) when it sent one, for a precise inline message. */
async function submitApproval(body: ApprovalBody): Promise<{ ok: true } | { ok: false; code?: string }> {
  try {
    const res = await instanceFetch(instancePath('/api/v1/approvals'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 201) return { ok: true };
    let code: string | undefined;
    try {
      const err = (await res.json()) as { error?: string; code?: string };
      code = err?.error || err?.code;
    } catch { /* non-JSON error body - generic message */ }
    return { ok: false, code };
  } catch {
    return { ok: false };
  }
}

// ── DOM ─────────────────────────────────────────────────────────────────────

const FIELD_CSS =
  'width:100%;box-sizing:border-box;padding:8px 11px;font-size:13px;border:1px solid hsl(var(--input));' +
  'border-radius:var(--radius);background:hsl(var(--background));color:hsl(var(--foreground))';

/** A small notice modal (chain missing / approvers unavailable). */
function notice(message: string): void {
  const modal = mountModal<void>(
    `<div class="approval-dialog-body">
       <h2 style="margin:0 0 .6rem;font-size:1.1rem;font-weight:700">${escape(t('Request approval'))}</h2>
       <p style="margin:0 0 1rem;color:hsl(var(--muted-foreground));font-size:.9rem;line-height:1.5">${escape(message)}</p>
       <div class="approval-dialog-actions" style="display:flex;justify-content:flex-end">
         <button type="button" class="btn" data-act="close">${escape(t('Close'))}</button>
       </div>
     </div>`,
    { className: 'approval-dialog', ariaLabel: t('Request approval') },
  );
  modal.el.querySelector<HTMLButtonElement>('[data-act="close"]')!.addEventListener('click', () => modal.close());
}

/**
 * Open the approval-request dialog for a context. Registered as the approval opener
 * by src/org/index.ts (via lib/approval-request.ts), so it is only ever reached when
 * a control plane is present. Resolves the chain from the export-policy seam; if
 * none is bound (it shouldn't be reachable then), shows a friendly notice instead.
 */
export function openApprovalDialog(ctx: ApprovalRequestContext): void {
  const toolId = ctx.toolId ?? '';
  const chainId = getExportPolicy()?.approvalChainFor(toolId);
  if (!chainId) {
    notice(t('Approval isn’t set up for this tool on this instance.'));
    return;
  }

  const defaultTitle = ctx.title || toolId || t('Approval request');
  const subjectRef = subjectRefFor(ctx);

  const content = `
    <div class="approval-dialog-body" style="display:flex;flex-direction:column;gap:.75rem;min-width:min(92vw,24rem)">
      <h2 style="margin:0;font-size:1.1rem;font-weight:700">${escape(t('Request approval'))}</h2>
      <p class="approval-step" data-step role="status" style="margin:0;color:hsl(var(--muted-foreground));font-size:.85rem" hidden></p>

      <label style="display:flex;flex-direction:column;gap:.25rem;font-size:13px;font-weight:600">
        ${escape(t('Title'))}
        <input type="text" data-approval-title value="${escape(defaultTitle)}" spellcheck="false" style="${FIELD_CSS};font-weight:400">
      </label>

      <div style="display:flex;flex-direction:column;gap:.35rem">
        <label style="font-size:13px;font-weight:600">${escape(t('Send to'))}</label>
        <input type="search" data-approver-search autocomplete="off" spellcheck="false"
               placeholder="${escape(t('Search people…'))}" aria-label="${escape(t('Search people…'))}" style="${FIELD_CSS}">
        <div class="approval-approvers" data-approvers role="listbox" aria-label="${escape(t('People who can approve'))}"
             style="max-height:11rem;overflow:auto;border:1px solid hsl(var(--border));border-radius:var(--radius)">
          <p data-approvers-empty style="margin:0;padding:.6rem .7rem;color:hsl(var(--muted-foreground));font-size:13px">${escape(t('Loading…'))}</p>
        </div>
      </div>

      <p class="approval-error" data-error role="status" style="margin:0;color:hsl(var(--destructive));font-size:12px" hidden></p>

      <div class="approval-dialog-actions" style="display:flex;justify-content:flex-end;gap:.5rem">
        <button type="button" class="btn" data-act="cancel">${escape(t('Cancel'))}</button>
        <button type="button" class="btn btn--primary" data-act="submit" disabled>${escape(t('Send request'))}</button>
      </div>
    </div>`;

  const modal = mountModal<void>(content, {
    className: 'approval-dialog',
    ariaLabel: t('Request approval'),
    initialFocus: (el) => el.querySelector<HTMLInputElement>('[data-approver-search]'),
  });
  const dialog = modal.el;

  const stepEl    = dialog.querySelector<HTMLElement>('[data-step]')!;
  const titleEl   = dialog.querySelector<HTMLInputElement>('[data-approval-title]')!;
  const searchEl  = dialog.querySelector<HTMLInputElement>('[data-approver-search]')!;
  const listEl    = dialog.querySelector<HTMLElement>('[data-approvers]')!;
  const errEl     = dialog.querySelector<HTMLElement>('[data-error]')!;
  const submitBtn = dialog.querySelector<HTMLButtonElement>('[data-act="submit"]')!;
  const cancelBtn = dialog.querySelector<HTMLButtonElement>('[data-act="cancel"]')!;

  const setError = (msg: string): void => { errEl.textContent = msg; errEl.hidden = false; announce(msg, { assertive: true }); };
  const clearError = (): void => { errEl.hidden = true; errEl.textContent = ''; };

  cancelBtn.addEventListener('click', () => modal.close());

  let approvers: Approver[] = [];
  let chosen: string | null = null;

  // Render the (filtered) approver list as selectable option buttons. Clicking one
  // selects it (single nominee, v1); the chosen row stays highlighted and Submit
  // enables. Re-rendered on each keystroke over the already-fetched list.
  const renderList = (): void => {
    const shown = filterApprovers(approvers, searchEl.value);
    if (!shown.length) {
      listEl.innerHTML = `<p style="margin:0;padding:.6rem .7rem;color:hsl(var(--muted-foreground));font-size:13px">${escape(approvers.length ? t('No matches.') : t('No one is available to approve this yet.'))}</p>`;
      return;
    }
    listEl.innerHTML = shown.map((a) => {
      const sel = a.id === chosen;
      return `<button type="button" class="approval-approver" role="option" aria-selected="${sel}" data-approver-id="${escape(a.id)}"
        style="display:block;width:100%;text-align:left;padding:.5rem .7rem;border:0;border-bottom:1px solid hsl(var(--border));font-size:13px;cursor:pointer;background:${sel ? 'hsl(var(--accent))' : 'transparent'};color:hsl(var(--foreground))">${escape(a.name || a.id)}</button>`;
    }).join('');
  };

  listEl.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-approver-id]');
    if (!btn) return;
    chosen = btn.dataset.approverId ?? null;
    submitBtn.disabled = !chosen;
    clearError();
    renderList();
  });
  searchEl.addEventListener('input', renderList);

  // Fetch the eligible approvers (step 0, self excluded) for this chain, then render.
  fetchApprovers(chainId).then((reply) => {
    if (!dialog.isConnected) return;
    if (!reply) {
      listEl.innerHTML = `<p style="margin:0;padding:.6rem .7rem;color:hsl(var(--muted-foreground));font-size:13px">${escape(t('Couldn’t load the people who can approve this. Try again.'))}</p>`;
      return;
    }
    approvers = reply.approvers;
    if (reply.stepName) {
      stepEl.textContent = tRaw('Step: {name}', { name: reply.stepName });
      stepEl.hidden = false;
    }
    renderList();
  }).catch(() => { /* fetchApprovers is already tolerant; nothing else to do */ });

  submitBtn.addEventListener('click', async () => {
    if (!chosen) return;
    clearError();
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = t('Sending…');
    const body = buildApprovalBody({
      subjectRef,
      title: titleEl.value.trim() || defaultTitle,
      chainId,
      nominee: chosen,
    });
    const result = await submitApproval(body);
    if (!dialog.isConnected) return;
    if (result.ok) {
      announce(t('Approval request sent'));
      modal.close();
      return;
    }
    submitBtn.disabled = false;
    submitBtn.textContent = label;
    setError(result.code === 'NOMINEE_NOT_ELIGIBLE'
      ? t('That person can’t approve this step. Choose someone else.')
      : t('Couldn’t send the request. Try again.'));
  });
}
