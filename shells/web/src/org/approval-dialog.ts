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
 * files the request (POST /api/v1/approvals). When the instance takes a file, the view
 * hands over the exact export: the dialog shows the file, sends its bytes in parts and
 * refers to them in the request, so a reviewer decides on that file. An instance that takes no
 * file gets the older request, and the dialog says the file is not attached. All of it
 * goes through instanceFetch/instancePath so a shell pointed at a remote instance
 * files against THAT instance.
 * Errors surface inline in the dialog (never an alert()); the modal lifecycle
 * (Escape, backdrop, focus, teardown) is the shared components/modal.ts primitive.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import { getExportPolicy } from '../lib/export-policy.ts';
import type { ApprovalArtifact, ApprovalRequestContext } from '../lib/approval-request.ts';
import { mountModal } from '../components/modal.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { fmtBytes } from '../lib/format.ts';
import { ApprovalArtifactError, artifactChecksum, artifactFormat, sendApprovalFile } from './approval-artifact.ts';

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
interface ExportReviewBody {
  subjectType: 'export-review';
  title: string;
  chainId: string;
  nominees: string[];
  exportReview: {
    uploadId: string; checksum: string; toolId: string; format: string; name: string;
    query?: string; sessionId?: string; widthPx?: number; heightPx?: number;
  };
}

/** The most input text a request carries. The instance reads a smaller request body
 *  whole, so past this the values stay out and the digest says they were not sent. */
const QUERY_LIMIT_CHARS = 256 * 1024;

/** What the instance says about how large a request's file may be. */
export interface ExportReviewLimits { maxFileBytes: number; partBytes: number }

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
export function buildExportReviewBody(o: {
  uploadId: string; checksum: string; toolId: string; title: string; chainId: string; nominee: string;
  artifact: ApprovalArtifact; widthPx?: number; heightPx?: number;
}): ExportReviewBody {
  const { artifact } = o;
  return {
    subjectType: 'export-review', title: o.title, chainId: o.chainId, nominees: [o.nominee],
    exportReview: {
      uploadId: o.uploadId, checksum: o.checksum, toolId: o.toolId, format: artifactFormat(artifact.name), name: artifact.name,
      ...(artifact.query !== undefined && artifact.query.length <= QUERY_LIMIT_CHARS ? { query: artifact.query } : {}),
      ...(artifact.sessionId ? { sessionId: artifact.sessionId } : {}),
      ...(o.widthPx ? { widthPx: o.widthPx } : {}), ...(o.heightPx ? { heightPx: o.heightPx } : {}),
    },
  };
}

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
async function submitApproval(body: ApprovalBody | ExportReviewBody): Promise<{ ok: true } | { ok: false; code?: string }> {
  try {
    const res = await instanceFetch(instancePath('/api/v1/approvals'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 201) return { ok: true };
    let code: string | undefined;
    try {
      const err = (await res.json()) as { error?: string | { code?: string }; code?: string };
      code = typeof err?.error === 'object' ? err.error?.code : err?.error || err?.code;
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
    { className: 'modal approval-dialog', ariaLabel: t('Request approval') },
  );
  modal.el.querySelector<HTMLButtonElement>('[data-act="close"]')!.addEventListener('click', () => modal.close());
}

/** The sentence for an instance's refusal of a file. */
function fileRefusal(code: string | undefined): string {
  if (code === 'UPLOAD_TOO_LARGE') return t('This file is larger than this workspace takes for review.');
  if (code === 'APPROVAL_ARTIFACT_BUDGET' || code === 'UPLOAD_BUDGET' || code === 'INSTANCE_UPLOAD_BUDGET' || code === 'UPLOAD_PENDING') return t('This workspace has no room for another file right now.');
  if (code === 'ARTIFACT_FORMAT_MISMATCH') return t('The file does not match its format. Export it again.');
  if (code === 'CHAIN_NOT_BOUND') return t('This tool now goes through a different approval chain. Reload and try again.');
  return t('Couldn’t send the file. Try again.');
}

/** Draw the file in its stage. Reports the size in pixels when the browser can read
 *  it, and returns what to release when the dialog closes. */
function showFile(stage: HTMLElement, artifact: ApprovalArtifact, onSize: (width: number, height: number) => void): () => void {
  const urls: string[] = [];
  const objectUrl = (blob: Blob): string => { const url = URL.createObjectURL(blob); urls.push(url); return url; };
  const type = artifact.blob.type.split(';')[0] ?? '';
  const format = artifactFormat(artifact.name);
  const label = tRaw('File for review: {name}', { name: artifact.name });
  const none = (text: string): void => { const p = document.createElement('p'); p.textContent = text; stage.replaceChildren(p); };
  const picture = (url: string, measure: boolean): void => {
    const img = document.createElement('img');
    img.alt = label;
    if (measure) img.addEventListener('load', () => { if (img.naturalWidth && img.naturalHeight) onSize(img.naturalWidth, img.naturalHeight); });
    img.addEventListener('error', () => none(artifact.name));
    img.src = url;
    stage.replaceChildren(img);
  };
  if (type.startsWith('image/') || format === 'svg') picture(objectUrl(artifact.blob), true);
  else if (type.startsWith('video/')) {
    const video = document.createElement('video');
    video.controls = true; video.muted = true; video.setAttribute('aria-label', label);
    video.addEventListener('loadedmetadata', () => { if (video.videoWidth && video.videoHeight) onSize(video.videoWidth, video.videoHeight); });
    video.src = objectUrl(artifact.blob);
    stage.replaceChildren(video);
  } else if (type.startsWith('audio/')) {
    const audio = document.createElement('audio');
    audio.controls = true; audio.setAttribute('aria-label', label);
    audio.src = objectUrl(artifact.blob);
    stage.replaceChildren(audio);
  } else if (format === 'pdf') {
    none(artifact.name);
    void artifact.firstPage?.().then((page) => {
      if (page && stage.isConnected) picture(objectUrl(page), false);
    }).catch(() => {});
  } else none(artifact.name);
  return () => { for (const url of urls) URL.revokeObjectURL(url); };
}

/**
 * Open the approval-request dialog for a context. Registered as the approval opener
 * by src/org/index.ts (via lib/approval-request.ts), so it is only ever reached when
 * a control plane is present. Resolves the chain from the export-policy seam; if
 * none is bound (it shouldn't be reachable then), shows a friendly notice instead.
 */
export function openApprovalDialog(ctx: ApprovalRequestContext, limits?: ExportReviewLimits): void {
  const toolId = ctx.toolId ?? '';
  const artifact = limits ? ctx.artifact : undefined;
  const chainId = getExportPolicy()?.approvalChainFor(toolId);
  if (!chainId) {
    notice(t('Approval isn’t set up for this tool on this instance.'));
    return;
  }

  const defaultTitle = ctx.title || toolId || t('Approval request');
  const subjectRef = subjectRefFor(ctx);

  const content = `
    <div class="approval-dialog-body" style="display:flex;flex-direction:column;gap:.75rem;min-width:min(100%,24rem)">
      <h2 style="margin:0;font-size:1.1rem;font-weight:700">${escape(t('Request approval'))}</h2>
      <p class="approval-step" data-step role="status" style="margin:0;color:hsl(var(--muted-foreground));font-size:.85rem" hidden></p>
      ${artifact ? `<div class="approval-file">
        <div class="approval-file-stage" data-file-stage></div>
        <p class="approval-file-facts" data-file-facts></p>
        <p class="approval-file-note">${escape(t('Reviewers see this exact file. You get it once it is approved.'))}</p>
      </div>` : `<p class="approval-file-note">${escape(t('The file is not attached, so reviewers see only the title.'))}</p>`}

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

      <p class="approval-error" data-error role="status" style="margin:0;color:hsl(var(--destructive-text));font-size:12px" hidden></p>

      <div class="approval-dialog-actions" style="display:flex;justify-content:flex-end;gap:.5rem">
        <button type="button" class="btn" data-act="cancel">${escape(t('Cancel'))}</button>
        <button type="button" class="btn btn--primary" data-act="submit" disabled>${escape(t('Send request'))}</button>
      </div>
    </div>`;

  let releaseFile: () => void = () => {};
  const modal = mountModal<void>(content, {
    className: 'modal approval-dialog',
    ariaLabel: t('Request approval'),
    initialFocus: (el) => el.querySelector<HTMLInputElement>('[data-approver-search]'),
    onClose: () => releaseFile(),
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

  // The file: its picture, the facts a reviewer will see, and a digest worked out once.
  let fileSize: { width: number; height: number } | null = null;
  let fileChecksum: string | null = null;
  const tooLarge = !!artifact && !!limits && artifact.blob.size > limits.maxFileBytes;
  const facts = artifact ? dialog.querySelector<HTMLElement>('[data-file-facts]')! : null;
  const paintFacts = (): void => {
    if (!artifact || !facts) return;
    const parts = [artifactFormat(artifact.name).toUpperCase(), fileSize ? `${fileSize.width} × ${fileSize.height}` : '', fmtBytes(artifact.blob.size),
      fileChecksum ? `SHA-256 ${fileChecksum.slice(0, 12)}…` : ''];
    facts.textContent = parts.filter(Boolean).join(' · ');
  };
  const checksumReady = artifact ? artifactChecksum(artifact.blob) : null;
  if (artifact) {
    releaseFile = showFile(dialog.querySelector<HTMLElement>('[data-file-stage]')!, artifact, (width, height) => { fileSize = { width, height }; paintFacts(); });
    paintFacts();
    void checksumReady!.then((sum) => { fileChecksum = sum; paintFacts(); }).catch(() => {});
    if (tooLarge) setError(tRaw('This file is {size}. This workspace takes up to {limit} for review.', { size: fmtBytes(artifact.blob.size), limit: fmtBytes(limits!.maxFileBytes) }));
  }

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
    submitBtn.disabled = !chosen || tooLarge;
    if (!tooLarge) clearError();
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

  // Kept across retries, so a request that fails after the file arrived does not send
  // the file again.
  let uploadId: string | null = null;
  submitBtn.addEventListener('click', async () => {
    if (!chosen) return;
    clearError();
    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = t('Sending…');
    const failed = (message: string): void => {
      if (!dialog.isConnected) return;
      submitBtn.disabled = false;
      submitBtn.textContent = label;
      setError(message);
    };
    const title = titleEl.value.trim() || defaultTitle;
    let body: ApprovalBody | ExportReviewBody;
    if (artifact && limits) {
      try {
        const checksum = await checksumReady!;
        uploadId ??= await sendApprovalFile(artifact, checksum, limits.partBytes, (sent, total) => {
          if (total > limits.partBytes && dialog.isConnected) submitBtn.textContent = tRaw('Sending… {percent}%', { percent: Math.round((sent / total) * 100) });
        });
        body = buildExportReviewBody({ uploadId, checksum, toolId, title, chainId, nominee: chosen, artifact,
          ...(fileSize ? { widthPx: fileSize.width, heightPx: fileSize.height } : {}) });
      } catch (error) {
        failed(fileRefusal(error instanceof ApprovalArtifactError ? error.code : undefined));
        return;
      }
    } else body = buildApprovalBody({ subjectRef, title, chainId, nominee: chosen });
    const result = await submitApproval(body);
    if (!dialog.isConnected) return;
    if (result.ok) {
      announce(t('Approval request sent'));
      modal.close();
      return;
    }
    // A request pointing at a used or expired upload needs the file sent again.
    if (result.code === 'UPLOAD_NOT_READY' || result.code === 'UPLOAD_CHANGED' || result.code === 'NOT_FOUND') uploadId = null;
    failed(result.code === 'NOMINEE_NOT_ELIGIBLE'
      ? t('That person can’t approve this step. Choose someone else.')
      : artifact ? fileRefusal(result.code) : t('Couldn’t send the request. Try again.'));
  });
}
