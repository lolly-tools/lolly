// SPDX-License-Identifier: MPL-2.0
/**
 * The person's company card, first on the workspace's home shelf (Lolly Work
 * plans/82 M3): their company's logo for the current mode on the lead brand's
 * surface, its name, "Your details are on every piece" and Details, which opens
 * a sheet with the details read-only. A contact the workspace lets edit gets Edit
 * in the same sheet, with the same fields and the same checks the brand team's
 * page has. The lead brand's chrome never changes: the partner is a guest.
 *
 * The details come from the workspace's own route for the person's company
 * (`/api/v1/me/company/profile`), asked only when the workspace says which company
 * the person is in (lib/workspace-templates.ts), so a plain build asks nothing and
 * shows nothing.
 */
import { escape as escapeHtml } from '../utils.ts';
import { t, tRaw } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { currentTheme } from '../theme.ts';
import { mountModal } from '../components/modal.ts';
import '../styles/parts/company-card.css';

/** What the workspace answers for the person's company. */
export interface CompanyView {
  company: { id: string; name: string };
  programme?: { id: string; name: string };
  revision: number;
  profile: {
    logoLight?: string; logoDark?: string; mark?: string; website?: string;
    contact?: { name?: string; email?: string; phone?: string }; address?: string; currency?: string; taxNote?: string;
  };
  mayEdit?: boolean;
  changesWait?: boolean;
  pending?: unknown;
  limits?: {
    logo: { types: string[]; svgMaxBytes: number; pngMaxBytes: number; pngMinLongSide: number };
    fields: Record<string, number>;
  };
}

/** The slice of the host the card reads: catalog assets, for the logos. */
export interface CardHost {
  assets: { get(id: string): Promise<{ url?: string }> };
}

const ROUTE = '/api/v1/me/company/profile';

/** The person's company, or null when there is none to show (no workspace, no
 *  company, or a company with no details yet for someone who cannot add them). */
export async function loadCompanyView(): Promise<CompanyView | null> {
  try {
    const res = await instanceFetch(instancePath(ROUTE), { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return null;
    const view = await res.json() as CompanyView;
    if (!view?.company?.name) return null;
    return view.revision > 0 || view.mayEdit ? view : null;
  } catch {
    return null;
  }
}

/** The logo for the chrome's mode: the light-surface logo in light, the dark one
 *  otherwise, each falling back to the other. */
export function cardLogoId(view: Pick<CompanyView, 'profile'>, theme = currentTheme()): string | undefined {
  const p = view.profile;
  return theme === 'light' ? p.logoLight ?? p.logoDark : p.logoDark ?? p.logoLight;
}

/** The card's markup. The whole card opens the details sheet. */
export function companyCardHtml(view: CompanyView): string {
  const empty = view.revision === 0;
  const line = empty ? t('Add your logo and details') : t('Your details are on every piece');
  return `<button type="button" class="published-card company-card" data-company-card>
            <span class="published-card-media company-card-media" aria-hidden="true"><span class="published-card-icon">${icon('building', { size: 22 })}</span></span>
            <span class="published-card-text">
              <span class="published-card-name">${escapeHtml(view.company.name)}</span>
              <span class="published-card-sub">${escapeHtml(line)}</span>
            </span>
            <span class="btn btn--sm published-card-use">${escapeHtml(empty ? t('Add') : t('Details'))}</span>
          </button>`;
}

/** Draw the card's logo once the catalog answers; the icon stays otherwise. */
export async function drawCardLogo(card: HTMLElement, view: CompanyView, host: CardHost): Promise<void> {
  const id = cardLogoId(view);
  const media = card.querySelector<HTMLElement>('.company-card-media');
  if (!id || !media) return;
  try {
    const ref = await host.assets.get(id);
    if (!ref?.url || !media.isConnected) return;
    const img = document.createElement('img');
    img.className = 'company-card-logo';
    img.alt = '';
    img.src = ref.url;
    media.replaceChildren(img);
  } catch { /* the icon stays */ }
}

const row = (label: string, value: string | undefined): string =>
  `<div class="company-sheet-row"><dt>${escapeHtml(label)}</dt><dd>${value ? escapeHtml(value) : '<span class="company-sheet-none">-</span>'}</dd></div>`;

/** Open the details sheet. A contact who may edit gets Edit; saving re-reads the details. */
export function openCompanySheet(view: CompanyView, host: CardHost, onChanged?: (next: CompanyView) => void): void {
  const p = view.profile;
  const contact = [p.contact?.name, p.contact?.email, p.contact?.phone].filter(Boolean).join(', ');
  const readHtml = `
      <h2 class="modal-title">${escapeHtml(view.company.name)}</h2>
      <p class="modal-msg">${escapeHtml(view.programme ? tRaw('Your details on pieces for {programme}.', { programme: view.programme.name }) : t('Your details on every piece.'))}</p>
      <div class="company-sheet-logos">
        <figure class="company-sheet-logo is-light"><span data-logo="light"></span><figcaption>${escapeHtml(t('Light backgrounds'))}</figcaption></figure>
        <figure class="company-sheet-logo is-dark"><span data-logo="dark"></span><figcaption>${escapeHtml(t('Dark backgrounds'))}</figcaption></figure>
      </div>
      <dl class="company-sheet-list">
        ${row(t('Website'), p.website)}${row(t('Contact'), contact || undefined)}${row(t('Address'), p.address?.split('\n').join(', '))}
        ${row(t('Currency'), p.currency)}${row(t('Tax note'), p.taxNote)}
      </dl>
      ${view.pending ? `<p class="modal-msg">${escapeHtml(t('A change you sent is waiting for approval.'))}</p>` : ''}
      <div class="modal-actions">
        ${view.mayEdit ? `<button type="button" class="btn modal-cancel" data-act="edit">${escapeHtml(t('Edit'))}</button>` : ''}
        <button type="button" class="btn modal-primary" data-act="close">${escapeHtml(t('Close'))}</button>
      </div>`;
  const modal = mountModal<void>(readHtml, {
    className: 'modal company-sheet',
    ariaLabel: view.company.name,
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-act="close"]'),
  });
  const el = modal.el;
  const drawLogos = async (): Promise<void> => {
    for (const [side, id] of [['light', p.logoLight ?? p.logoDark], ['dark', p.logoDark ?? p.logoLight]] as const) {
      const slot = el.querySelector<HTMLElement>(`[data-logo="${side}"]`);
      if (!slot) continue;
      if (!id) { slot.textContent = t('No logo yet'); continue; }
      try {
        const ref = await host.assets.get(id);
        if (!ref?.url) continue;
        const img = document.createElement('img');
        img.src = ref.url;
        img.alt = tRaw('{name} logo', { name: view.company.name });
        slot.replaceChildren(img);
      } catch { slot.textContent = t('No logo yet'); }
    }
  };
  void drawLogos();
  el.addEventListener('click', (event) => {
    const act = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'close') modal.close();
    if (act === 'edit') { modal.close(); openCompanyEditSheet(view, onChanged); }
  });
}

/** The contact's edit sheet: the same details, saved to the workspace, which checks
 *  them as the brand team's page does. When changes wait for approval it says so. */
export function openCompanyEditSheet(view: CompanyView, onChanged?: (next: CompanyView) => void): void {
  const p = view.profile;
  const max = (field: string): string => (view.limits?.fields[field] ? ` maxlength="${view.limits.fields[field]}"` : '');
  const input = (name: string, label: string, value: string | undefined, attrs = ''): string =>
    `<label class="company-edit-field"><span>${escapeHtml(label)}</span><input class="field-input" name="${name}" value="${escapeHtml(value ?? '')}"${attrs}></label>`;
  // A button opens the file chooser and the chosen file's name shows beside it, in
  // place of the browser's own unstyled control.
  const logoPick = (name: 'light' | 'dark', label: string): string =>
    `<div class="company-edit-field"><span>${escapeHtml(label)}</span><span class="company-edit-file">`
    + `<button type="button" class="btn btn--sm" data-pick="${name}" aria-label="${escapeHtml(tRaw('Choose a file: {label}', { label }))}">${escapeHtml(t('Choose a file'))}</button>`
    + `<span class="company-edit-file-name" data-file-name="${name}"></span>`
    + `<input type="file" name="${name}" accept=".svg,.png,image/svg+xml,image/png" hidden></span></div>`;
  const kb = (n: number): string => (n >= 1024 * 1024 ? `${Math.round(n / (1024 * 1024))} MB` : `${Math.round(n / 1024)} KB`);
  const logoHint = view.limits
    ? tRaw('SVG up to {svg}, or PNG up to {png} and at least {px} pixels on its long side.', { svg: kb(view.limits.logo.svgMaxBytes), png: kb(view.limits.logo.pngMaxBytes), px: view.limits.logo.pngMinLongSide })
    : t('SVG or PNG.');
  const content = `
      <h2 class="modal-title">${escapeHtml(tRaw('Edit {name}', { name: view.company.name }))}</h2>
      ${view.changesWait ? `<p class="modal-msg">${escapeHtml(t('Your changes go to the brand team for approval before they apply.'))}</p>` : ''}
      <form class="company-edit-form">
        ${input('website', t('Website'), p.website, ` type="url"${max('website')}`)}
        ${input('contactName', t('Contact name'), p.contact?.name, max('contactName'))}
        ${input('contactEmail', t('Contact email'), p.contact?.email, ` type="email"${max('email')}`)}
        ${input('contactPhone', t('Contact phone'), p.contact?.phone, ` type="tel"${max('phone')}`)}
        <label class="company-edit-field"><span>${escapeHtml(t('Address'))}</span><textarea class="field-input" name="address" rows="3"${max('address')}>${escapeHtml(p.address ?? '')}</textarea></label>
        ${input('currency', t('Currency'), p.currency, ' maxlength="3"')}
        ${input('taxNote', t('Tax note'), p.taxNote, max('taxNote'))}
        ${logoPick('light', t('Logo for light backgrounds'))}
        ${logoPick('dark', t('Logo for dark backgrounds'))}
        <p class="company-edit-hint">${escapeHtml(logoHint)}</p>
      </form>
      <div class="company-edit-status" role="status"></div>
      <div class="modal-actions">
        <button type="button" class="btn modal-cancel" data-act="cancel">${escapeHtml(t('Cancel'))}</button>
        <button type="button" class="btn modal-primary" data-act="save">${escapeHtml(t('Save'))}</button>
      </div>`;
  const modal = mountModal<void>(content, { className: 'modal company-sheet company-edit-sheet', ariaLabel: view.company.name });
  const el = modal.el;
  const status = el.querySelector<HTMLElement>('.company-edit-status')!;
  const form = el.querySelector<HTMLFormElement>('.company-edit-form')!;
  const say = (lines: string[]): void => { status.replaceChildren(...lines.map((line) => Object.assign(document.createElement('p'), { textContent: line }))); };
  const send = async (path: string, init: RequestInit): Promise<Record<string, unknown>> => {
    const res = await instanceFetch(instancePath(path), { credentials: 'include', ...init });
    const out = await res.json().catch(() => null) as Record<string, unknown> | null;
    if (!res.ok) throw new Error(((out?.error as { message?: string } | undefined)?.message) ?? res.statusText);
    return out ?? {};
  };
  form.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (input.type !== 'file') return;
    const name = el.querySelector<HTMLElement>(`[data-file-name="${input.name}"]`);
    if (name) name.textContent = input.files?.[0]?.name ?? '';
  });
  el.addEventListener('click', async (event) => {
    const pick = (event.target as HTMLElement).closest<HTMLElement>('[data-pick]')?.dataset.pick;
    if (pick) { form.querySelector<HTMLInputElement>(`input[type="file"][name="${pick}"]`)?.click(); return; }
    const act = (event.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'cancel') { modal.close(); return; }
    if (act !== 'save') return;
    const data = new FormData(form);
    const text = (name: string): string | null => String(data.get(name) ?? '').trim() || null;
    const saveBtn = el.querySelector<HTMLButtonElement>('[data-act="save"]')!;
    saveBtn.disabled = true;
    const notes: string[] = [];
    try {
      const fields = await send(ROUTE, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        website: text('website'), contact: { name: text('contactName'), email: text('contactEmail'), phone: text('contactPhone') },
        address: text('address'), currency: text('currency')?.toUpperCase() ?? null, taxNote: text('taxNote'),
      }) });
      if (fields.state === 'pending') notes.push(t('Sent for approval.'));
      for (const surface of ['light', 'dark'] as const) {
        const file = data.get(surface);
        if (!(file instanceof File) || !file.size) continue;
        const out = await send(`${ROUTE}/logo?surface=${surface}`, { method: 'POST', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
        for (const w of (out.warnings as Array<{ message: string }> | undefined) ?? []) notes.push(w.message);
        if (out.state === 'pending') notes.push(t('Sent for approval.'));
      }
      const next = await loadCompanyView();
      if (next) onChanged?.(next);
      if (notes.length) { say(notes); saveBtn.disabled = false; saveBtn.textContent = t('Done'); saveBtn.dataset.act = 'cancel'; return; }
      modal.close();
    } catch (e) {
      say([(e as Error).message]);
      saveBtn.disabled = false;
    }
  });
}
