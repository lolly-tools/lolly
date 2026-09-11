// SPDX-License-Identifier: MPL-2.0
/**
 * org/share-links - the "On this instance" section of the Share dialog.
 *
 * Loaded lazily by src/org/index.ts, and only when a deployment's control plane is
 * present, so a plain (control-plane-free) deployment never touches this file. It
 * builds up to two permission-gated rows, mounted into the generic Share dialog via
 * the lib/share-sections.ts seam:
 *
 *   - Rendered link (needs can['link.create']) - mints an `embed` link whose URL
 *     serves the rendered image itself and stays current.
 *   - Guest access (needs can['link.create-guest']) - mints a `guest-edit` link the
 *     recipient can edit for a bounded time, optionally password-protected; their
 *     saves land in the inviter's project.
 *
 * Both go through the documented Links API (POST /api/v1/links, same-origin cookie),
 * routed via instanceFetch so a shell pointed at a remote instance mints against
 * THAT instance. Errors surface inline in the row (never an alert()).
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { ShareSectionContext } from '../lib/share-sections.ts';
import type { OrgConfig } from './index.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/** Which instance rows a caller's capabilities permit. Pure. */
export function instanceShareRows(can: Record<string, boolean> | undefined): { rendered: boolean; guest: boolean } {
  return {
    rendered: !!can?.['link.create'],
    guest: !!can?.['link.create-guest'],
  };
}

/** True when at least one instance row is permitted (so the section renders). Pure. */
export function hasInstanceShareRows(can: Record<string, boolean> | undefined): boolean {
  const rows = instanceShareRows(can);
  return rows.rendered || rows.guest;
}

/**
 * Split the dialog's serialised "key=value" parts into a Links-API target: the
 * export `format` (if present) is lifted out of the params into its own field, the
 * rest become `params`. Reuses exactly the parts the Share dialog already built, so
 * a minted link carries the same state as a copied one. Pure.
 */
export function targetFromBaseParts(baseParts: readonly string[]): { params: Record<string, string>; format?: string } {
  const params: Record<string, string> = {};
  let format: string | undefined;
  for (const part of baseParts) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = decodeURIComponent(part.slice(0, eq));
    const value = decodeURIComponent(part.slice(eq + 1));
    if (key === 'format') { format = value; continue; }
    params[key] = value;
  }
  return { params, format };
}

// ── Link minting ──────────────────────────────────────────────────────────────

interface MintTarget { toolId: string; params?: Record<string, string>; format?: string }
interface MintBody {
  kind: 'embed' | 'share' | 'download' | 'guest-edit';
  target: MintTarget;
  ttlHours?: number;
  password?: string;
}
interface MintResult { id: string; url: string; expiresAt?: string }

async function mintLink(body: MintBody): Promise<MintResult> {
  const res = await instanceFetch(instancePath('/api/v1/links'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as MintResult;
  if (!data || typeof data.url !== 'string') throw new Error('bad-response');
  return data;
}

// ── DOM ─────────────────────────────────────────────────────────────────────

/** A ready-to-copy URL field + copy button, hidden until a link is minted. Reuses
 *  the dialog's own row classes so it reads as native chrome. */
function makeResultRow(copy: (text: string) => Promise<void>): { el: HTMLElement; show(url: string): void } {
  const el = document.createElement('div');
  el.className = 'share-link-row';
  el.hidden = true;
  el.style.marginTop = '.5rem';
  el.innerHTML =
    `<input type="text" class="share-link-field" readonly aria-label="${escape(t('Instance link'))}">` +
    `<button type="button" class="share-copy-btn">${escape(t('Copy'))}</button>`;
  const field = el.querySelector<HTMLInputElement>('.share-link-field')!;
  const btn = el.querySelector<HTMLButtonElement>('.share-copy-btn')!;
  btn.addEventListener('click', async () => {
    await copy(field.value);
    announce(t('Link copied'));
    const prev = btn.textContent;
    btn.textContent = t('Copied!');
    setTimeout(() => { btn.textContent = prev; }, 1500);
  });
  return {
    el,
    show(url: string) { field.value = url; el.hidden = false; field.focus(); field.select(); },
  };
}

/** A small inline error line (house style - never alert()). */
function makeErrorLine(): { el: HTMLElement; set(msg: string): void; clear(): void } {
  const el = document.createElement('p');
  el.className = 'share-instance-error';
  el.setAttribute('role', 'status');
  el.hidden = true;
  el.style.cssText = 'margin:.4rem 0 0;color:hsl(var(--destructive));font-size:12px';
  return {
    el,
    set(msg: string) { el.textContent = msg; el.hidden = false; announce(msg, { assertive: true }); },
    clear() { el.hidden = true; el.textContent = ''; },
  };
}

/**
 * Build the "On this instance" section, or null when the caller may create no
 * instance links (so the dialog adds nothing - dormant even for a signed-in member
 * without link permissions).
 */
export function buildInstanceShareSection(ctx: ShareSectionContext, config: OrgConfig): HTMLElement | null {
  const can = (config as OrgConfig & { can?: Record<string, boolean> }).can;
  const rows = instanceShareRows(can);
  if (!rows.rendered && !rows.guest) return null;
  const toolId = ctx.toolId;
  if (!toolId) return null; // no tool to target - nothing to mint

  const { params, format: parsedFormat } = targetFromBaseParts(ctx.baseParts);
  const format = ctx.currentFormat || parsedFormat;
  const target: MintTarget = { toolId, params, ...(format ? { format } : {}) };
  const instanceName = config.instance?.name || '';

  const section = document.createElement('section');
  section.className = 'share-instance';
  section.style.cssText = 'margin-top:.9rem;padding-top:.8rem;border-top:1px solid hsl(var(--border))';

  const heading = instanceName
    ? tRaw('On {name}', { name: instanceName })
    : t('On this instance');
  section.innerHTML = `<h3 style="margin:0 0 .5rem;font-size:.82rem;font-weight:650;letter-spacing:.02em;text-transform:uppercase;color:hsl(var(--muted-foreground))">${escape(heading)}</h3>`;

  // ── Rendered link ───────────────────────────────────────────────────────────
  if (rows.rendered) {
    const row = document.createElement('div');
    row.className = 'share-instance-row';
    row.style.marginBottom = rows.guest ? '.9rem' : '0';
    row.innerHTML =
      `<div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">` +
        `<strong style="font-weight:650">${escape(t('Rendered link'))}</strong>` +
        `<button type="button" class="btn btn--sm" data-act="mint-rendered">${escape(t('Get link'))}</button>` +
      `</div>` +
      `<span class="share-shortest-note" style="display:block;margin-top:.2rem">${escape(t('A link whose URL serves the rendered image itself, and stays current.'))}</span>`;
    const result = makeResultRow(ctx.copy);
    const err = makeErrorLine();
    row.append(result.el, err.el);
    const btn = row.querySelector<HTMLButtonElement>('[data-act="mint-rendered"]')!;
    btn.addEventListener('click', async () => {
      err.clear();
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = t('Creating…');
      try {
        const { url } = await mintLink({ kind: 'embed', target });
        result.show(url);
      } catch {
        err.set(t('Could not create the link. Try again.'));
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
    section.appendChild(row);
  }

  // ── Guest access ────────────────────────────────────────────────────────────
  if (rows.guest) {
    const row = document.createElement('div');
    row.className = 'share-instance-row';
    // TTL options (hours); 72h is the default per the contract.
    const ttls: Array<{ h: number; label: string }> = [
      { h: 24, label: t('24 hours') },
      { h: 72, label: t('72 hours') },
      { h: 168, label: t('7 days') },
    ];
    row.innerHTML =
      `<div style="display:flex;align-items:baseline;gap:.5rem;flex-wrap:wrap">` +
        `<strong style="font-weight:650">${escape(t('Guest access'))}</strong>` +
      `</div>` +
      `<span class="share-shortest-note" style="display:block;margin:.2rem 0 .5rem">${escape(t('The recipient can edit this tool for the chosen period; their saves land with you.'))}</span>` +
      `<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">` +
        `<label style="display:inline-flex;align-items:center;gap:.35rem;font-size:13px">${escape(t('Expires in'))} ` +
          `<select data-guest-ttl class="field-select field-select--sm field-select--auto">` +
            ttls.map(o => `<option value="${o.h}"${o.h === 72 ? ' selected' : ''}>${escape(o.label)}</option>`).join('') +
          `</select>` +
        `</label>` +
        `<button type="button" class="btn btn--sm" data-act="mint-guest">${escape(t('Create guest link'))}</button>` +
      `</div>` +
      // Box recipe from the shared .field-input primitive (styles/parts/fields.css);
      // only the row's own top gap stays local - no view sheet reaches this node.
      `<input type="password" data-guest-pw class="field-input" autocomplete="off" spellcheck="false" placeholder="${escape(t('Password (optional)'))}" aria-label="${escape(t('Password (optional)'))}" ` +
        `style="margin-top:.5rem">`;
    const result = makeResultRow(ctx.copy);
    const err = makeErrorLine();
    row.append(result.el, err.el);
    const btn = row.querySelector<HTMLButtonElement>('[data-act="mint-guest"]')!;
    const ttlSel = row.querySelector<HTMLSelectElement>('[data-guest-ttl]')!;
    const pw = row.querySelector<HTMLInputElement>('[data-guest-pw]')!;
    btn.addEventListener('click', async () => {
      err.clear();
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = t('Creating…');
      try {
        const ttlHours = Number(ttlSel.value) || 72;
        const password = pw.value.trim();
        const { url } = await mintLink({
          kind: 'guest-edit',
          target,
          ttlHours,
          ...(password ? { password } : {}),
        });
        result.show(url);
      } catch {
        err.set(t('Could not create the link. Try again.'));
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
    section.appendChild(row);
  }

  return section;
}
