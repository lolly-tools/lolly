// SPDX-License-Identifier: MPL-2.0
/**
 * The Profile view's "Design systems" card (plans/186 section 5): one row per
 * design system on this device with its source line, compact brand specimen and
 * active tick. The card only switches/opens/removes systems; their name and
 * actual brand work live together in the Start studio.
 *
 * The card is the only place a person manages the list; switching itself is
 * lib/design-system/switch.ts's ordered sweep, called from here with the profile
 * route so the view remounts and this card re-renders with the new active tick.
 * "From an instance" (section 3.6) is a later milestone and is not rendered
 * until it works - never a door that opens on nothing.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape } from '../../utils.ts';
import { icon } from '../icons.ts';
import { confirmDialog, promptDialog } from '../../components/confirm-dialog.ts';
import { createTokenSet } from '@lolly/engine';
import { brandFontStack, tokenValueToHex, contrastText } from '../../brand-vars.ts';
import type { DesignSystemRecord } from './registry.ts';
import { createDesignSystem, removeDesignSystem, type ManageHost } from './manage.ts';
import { switchDesignSystem, type SwitchHost } from './switch.ts';

export type CardHost = ManageHost & SwitchHost;

const DESIGN_SYSTEM_FILE_ACCEPT = '.lolly,application/vnd.lolly+zip,.json,application/json,.penpot,.svg,image/svg+xml,.zip,application/zip';

/** Native picker opened inside the button gesture. It creates no record and
 *  changes no active pointer; cancelling is therefore genuinely inert. */
function pickDesignSystemFile(): Promise<File | null> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = DESIGN_SYSTEM_FILE_ACCEPT;
  input.hidden = true;
  document.body.appendChild(input);
  return new Promise((resolve) => {
    let done = false;
    const finish = (file: File | null): void => {
      if (done) return;
      done = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      finish(file);
    }, { once: true });
    // Current Chromium/WebKit/Firefox fire `cancel` when the native chooser is
    // dismissed or the same file is selected again. Older engines merely leave
    // this inert detached control pending, still with no state mutation.
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.click();
  });
}

/** What a row says under its label. Plain sentences, "design system" not "brand". */
export function sourceLine(record: DesignSystemRecord, now = Date.now()): string {
  const s = record.source;
  switch (s.kind) {
    case 'shipped': return t('Shipped with this build');
    case 'local': return s.forkedFrom ? t('Made here, copied from {name}', { name: s.forkedFrom.id }) : t('Made here');
    case 'file': return s.publisher ? t('From a file by {publisher}', { publisher: s.publisher }) : t('From a file');
    case 'hosted': {
      const host = s.instance.replace(/^https?:\/\//, '');
      const when = s.lastSyncedAt ? relativeTime(now - s.lastSyncedAt) : null;
      if (s.stale) return t('Hosted at {host}. Update available when online', { host });
      return when ? t('Hosted at {host}. Synced {when}', { host, when }) : t('Hosted at {host}', { host });
    }
  }
}

function relativeTime(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 2) return t('just now');
  if (m < 60) return t('{n} min ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 48) return t('{n} h ago', { n: h });
  return t('{n} days ago', { n: Math.round(h / 24) });
}

/** "3.2 MB" for a row; '' below a kilobyte so the shipped row and an empty new
 *  system carry no size at all. */
function bytesLabel(n: number | undefined): string {
  if (!n || n < 1024) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export interface BrandPreview { font: string; colors: string[]; colorCount?: number; logoUrl?: string }

/** A tiny, safe specimen from a system's own head document. It deliberately
 * loads only JSON already on-device; font files remain owned by the registry
 * and the browser simply falls back if a face has not been registered yet. */
export async function previewOf(host: CardHost, record: DesignSystemRecord): Promise<BrandPreview> {
  const fallback = "'SUSE', ui-sans-serif, system-ui, sans-serif";
  // A shipped record has no user head to inspect. Still give it a tiny honest
  // specimen of the app's neutral starting palette rather than leaving the
  // preview as unexplained type alone.
  if (!record.headId) return { font: fallback, colors: ['#0c322c', '#30ba78', '#f1f5f9'] };
  try {
    const blob = await host.assets._getBlob(record.headId);
    const doc = blob ? JSON.parse(await blob.text()) : null;
    const tokens = createTokenSet(doc);
    const colors = tokens.colors()
      .map(token => tokenValueToHex(token.value))
      .filter((value): value is string => !!value)
      .filter((value, i, all) => all.indexOf(value) === i);
    const font = brandFontStack(tokens.resolve('font.brand'), fallback) ?? fallback;
    const dark = contrastText(colors[0] ?? '#172b29') === '#ffffff';
    const variants = dark ? ['vertical-primary-reverse', 'vertical-primary'] : ['vertical-primary', 'vertical-primary-reverse'];
    let logoUrl: string | undefined;
    for (const variant of variants) {
      const id = tokens.resolve(`asset.logo.${variant}`);
      if (typeof id !== 'string' || !id || id.startsWith('{')) continue;
      try {
        const asset = await host.assets.get(id);
        if (asset.url) { logoUrl = asset.url; break; }
      } catch { /* No usable logo: retain the geometric specimen. */ }
    }
    return { font, colors: colors.slice(0, 6), colorCount: colors.length, logoUrl };
  } catch { return { font: fallback, colors: [] }; }
}

export function designSystemCardHtml(r: DesignSystemRecord, activeId: string, bytes: number | undefined, preview: BrandPreview): string {
  const active = r.id === activeId;
  const removable = r.source.kind !== 'shipped';
  const size = bytesLabel(bytes);
  const colors = preview.colors.length ? preview.colors : ['#172b29', '#a5edda', '#f5f8f7'];
  const background = colors[0]!;
  const foreground = contrastText(background);
  const accent = colors[1] ?? foreground;
  return `
    <article class="ds-row${active ? ' is-active' : ' is-switchable'}" data-ds-row="${escape(r.id)}" aria-label="${escape(r.label)}">
      ${active ? '' : `<button type="button" class="ds-row-hit" data-ds-act="switch" aria-label="${escape(tRaw('Switch to {name}', { name: r.label }))}"></button>`}
      <div class="ds-row-preview" style="--ds-preview-bg:${escape(background)};--ds-preview-fg:${escape(foreground)};--ds-preview-accent:${escape(accent)};font-family:${escape(preview.font)}" aria-label="${escape(tRaw('Preview of {name}', { name: r.label }))}">
        <div class="ds-preview-top"><span>${escape(t('DESIGN SYSTEM'))}</span><span class="ds-row-active">${active ? `${icon('check', { size: 12 })} ${t('Active')}` : t('Use theme') + ' ↗'}</span></div>
        <div class="ds-preview-composition"><span class="ds-row-preview-type">Aa<span>Bb</span></span><span class="ds-preview-mark" aria-hidden="true">${preview.logoUrl ? `<img src="${escape(preview.logoUrl)}" alt="" class="ds-preview-logo">` : ''}<i></i><i></i></span></div>
        <span class="ds-preview-caption">${escape(r.label)}</span>
        <div class="ds-row-preview-swatches" aria-hidden="true">${colors.map(color => `<i style="--ds-swatch:${escape(color)}"></i>`).join('')}</div>
      </div>
      <div class="ds-row-main">
        <h3 class="ds-row-label">${escape(r.label)}${r.locked ? `<span class="ds-row-lock" title="${escape(t('Read-only'))}">${icon('lock', { size: 14 })}</span>` : ''}</h3>
        <span class="ds-row-source">${escape(sourceLine(r))}</span>
        <span class="ds-row-facts">${t('{n} colours', { n: preview.colorCount ?? preview.colors.length })}${size ? ` <span>·</span> ${escape(size)}` : ''}</span>
      </div>
      <div class="ds-row-actions">
        <button type="button" class="btn ds-row-btn" data-ds-act="studio">${t('Open')}</button>
        <button type="button" class="btn ds-row-btn ds-row-download" data-ds-act="download" aria-label="${escape(tRaw('Download {name} as .lolly', { name: r.label }))}">${icon('download', { size: 16 })}<span>${t('Download')}</span></button>
        ${removable || r.locked ? `<details class="ds-row-more"><summary aria-label="${escape(tRaw('More actions for {name}', { name: r.label }))}">${icon('menu', { size: 16 })}</summary><div class="ds-row-menu">
          ${r.source.kind === 'hosted' ? `<button type="button" data-ds-act="refresh">${icon('refresh', { size: 16 })}${t('Check for updates')}</button>` : ''}
          ${r.locked ? `<button type="button" data-ds-act="fork">${icon('duplicate', { size: 16 })}${t('Make an editable copy')}</button>` : ''}
          ${removable ? `<button type="button" class="ds-row-remove" data-ds-act="remove">${icon('trash', { size: 16 })}${t('Remove')}</button>` : ''}
        </div></details>` : '<span class="ds-row-more-placeholder" aria-hidden="true"></span>'}
      </div>
    </article>`;
}

export async function renderDesignSystemsCard(body: HTMLElement, host: CardHost): Promise<void> {
  const sizesOf = (host.assets as { _designMaterialSizes?(): Promise<Record<string, number>> })._designMaterialSizes;
  const [records, activeId, sizes] = await Promise.all([
    host.designSystems.list(),
    host.designSystems.activeId(),
    sizesOf ? sizesOf.call(host.assets).catch(() => ({} as Record<string, number>)) : Promise.resolve({} as Record<string, number>),
  ]);
  const previews = await Promise.all(records.map(record => previewOf(host, record)));
  body.innerHTML = `
    <p class="profile-appearance-sub">${t('The design systems on this device. The active one is what every tool renders with.')}</p>
    <div class="ds-rows">${records.map((r, i) => designSystemCardHtml(r, activeId, sizes[r.id], previews[i]!)).join('')}</div>
    <div class="ds-add">
      <button type="button" class="btn" data-ds-act="new">${icon('plus', { size: 14 })} ${t('Make a new one')}</button>
      <button type="button" class="btn" data-ds-act="file">${icon('upload', { size: 14 })} ${t('Open or import a file')}</button>
      <button type="button" class="btn" data-ds-act="instance">${icon('globe', { size: 14 })} ${t('From an instance')}</button>
    </div>`;
  body.querySelectorAll<HTMLImageElement>('.ds-preview-logo').forEach(img => {
    img.addEventListener('error', () => img.remove(), { once: true });
  });
}

/** A one-line status under the rows, replacing the last one. Plain text: the
 *  message may be an error's own sentence. */
function announce(body: HTMLElement, text: string): void {
  let el = body.querySelector<HTMLElement>('.ds-note');
  if (!el) { el = document.createElement('p'); el.className = 'profile-appearance-sub ds-note'; el.setAttribute('role', 'status'); body.appendChild(el); }
  el.textContent = text;
}

/** Mount the card body and wire its actions. Re-renders itself after every action. */
export function mountDesignSystemsCard(body: HTMLElement, host: CardHost): void {
  void renderDesignSystemsCard(body, host).catch(() => { body.innerHTML = `<p class="profile-appearance-sub">${t('Design systems are unavailable on this device.')}</p>`; });

  body.addEventListener('click', async (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-ds-act]');
    if (!btn) return;
    const act = btn.dataset.dsAct;
    const id = btn.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow;
    try {
      if (act === 'download' && id) {
        const { openBrandDownload } = await import('./brand-download.ts');
        await openBrandDownload(host as unknown as Parameters<typeof openBrandDownload>[0], id);
        return;
      }
      if (act === 'switch' && id) {
        await switchDesignSystem(host, id, { route: 'profile' });
        return; // the remount re-renders this card
      }
      if (act === 'studio' && id) {
        const activeId = await host.designSystems.activeId();
        if (activeId !== id) await switchDesignSystem(host, id, { route: 'profile', noRemount: true });
        location.hash = '#/start';
        return;
      }
      if (act === 'remove' && id) {
        const record = await host.designSystems.get(id);
        const ok = await confirmDialog({
          title: t('Remove “{name}”?', { name: record?.label ?? id }),
          message: t('Its colours, type and logos leave this device. Sessions made with it stay, and keep rendering with whatever design system is active. Images you uploaded are yours and stay.'),
          confirmLabel: t('Remove'),
          danger: true,
        });
        if (!ok) return;
        const res = await removeDesignSystem(host, id);
        if (res.wasActive) { await switchDesignSystem(host, 'shipped', { route: 'profile' }); return; }
      }
      if (act === 'refresh' && id) {
        const { refreshHostedDesignSystem } = await import('./hosted.ts');
        const outcome = await refreshHostedDesignSystem(host as unknown as Parameters<typeof refreshHostedDesignSystem>[0], id, { force: true });
        if (outcome === 'updated' && (await host.designSystems.activeId()) === id) {
          await switchDesignSystem(host, id, { route: 'profile' });
          return;
        }
        if (outcome === 'unreachable') announce(body, t('Could not reach the instance. The copy on this device stands.'));
        else if (outcome === 'stale') announce(body, t('An update is available but could not be brought down. It will be tried again when online.'));
        else if (outcome === 'unchanged') announce(body, t('Up to date.'));
        else if (outcome === 'updated') announce(body, t('Updated.'));
      }
      if (act === 'fork' && id) {
        const record = await host.designSystems.get(id);
        const copy = await createDesignSystem(host, { label: t('{name} copy', { name: record?.label ?? id }), seedFrom: id });
        await switchDesignSystem(host, copy.id, { route: 'profile', noRemount: true });
        location.hash = '#/start';
        return;
      }
      if (act === 'instance') {
        const url = await promptDialog({ title: t('Add a design system from an instance'), message: t('The address of a Lolly instance, for example https://brand.example.com'), confirmLabel: t('Add'), placeholder: 'https://' });
        if (!url || !url.trim()) return;
        const { addHostedDesignSystem } = await import('./hosted.ts');
        try {
          const record = await addHostedDesignSystem(host as unknown as Parameters<typeof addHostedDesignSystem>[0], url.trim());
          await switchDesignSystem(host, record.id, { route: 'profile' });
          return;
        } catch (e) {
          announce(body, e instanceof Error ? e.message : String(e));
        }
      }
      if (act === 'file') {
        const file = await pickDesignSystemFile();
        if (!file) return;
        const router = await import('../drop-router.ts');
        if (/\.lolly$/i.test(file.name) || file.type === 'application/vnd.lolly+zip') {
          await router.openLollyFile(file, host as unknown as Parameters<typeof router.openLollyFile>[1], { preferred: 'design-system' });
          return;
        }
        // A non-.lolly file on this explicitly design-system-scoped control is
        // unambiguous. Only now that bytes were actually chosen do we mint the
        // editable target and hand the file to its studio.
        const record = await createDesignSystem(host, { label: t('New design system') });
        await switchDesignSystem(host, record.id, { route: 'profile', noRemount: true });
        router.setPendingDesignSystemFile(file);
        location.hash = '#/start?source=file&rename=1';
        return;
      }
      if (act === 'new') {
        // Naming is part of brand authorship, so this makes the system then
  // focuses Start's editable name field instead of asking a disconnected
        // Profile-side question before the studio is even visible.
        const record = await createDesignSystem(host, { label: t('New design system') });
        await switchDesignSystem(host, record.id, { route: 'profile', noRemount: true });
        location.hash = '#/start?rename=1';
        return;
      }
    } finally {
      const note = body.querySelector<HTMLElement>('.ds-note')?.textContent ?? '';
      await renderDesignSystemsCard(body, host).catch(() => { /* the row list is cosmetic */ });
      if (note) announce(body, note);
    }
  });
}
