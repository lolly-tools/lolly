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
import { brandSpecimenHtml, specimenInk, type BrandPreview } from './brand-specimen.ts';
import { t, tRaw } from '../../i18n.ts';
import { isTauriShell } from '../instance-choice.ts';
import { escape } from '../../utils.ts';
import { icon } from '../icons.ts';
import { confirmDialog, promptDialog } from '../../components/confirm-dialog.ts';
import { createTokenSet } from '@lolly/engine';
import { withoutLeadColours } from './leads.ts';
import { brandFontStack, tokenValueToHex, SWATCH_INK } from '../../brand-vars.ts';
import type { DesignSystemRecord } from './registry.ts';
import { createDesignSystem, type ManageHost } from './manage.ts';
import { hideShippedDesignSystem, prepareDesignSystemRemoval, removeAndSwitchDesignSystem } from './remove-coordinator.ts';
import { resetDesignSystem, resetKind } from './reset.ts';
import { switchDesignSystem, type SwitchHost } from './switch.ts';
import { showUndoToast } from '../undo-toast.ts';
import { catalogSourceHtml, catalogSourceLabel } from './catalog-source.ts';

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
    case 'shipped': return catalogSourceLabel(record);
    case 'local':
      if (s.from === 'app') return t('Came with this app');
      if (s.from === 'shipped') return t('Edited here');
      return s.forkedFrom ? t('Made here, copied from {name}', { name: s.forkedFrom.id }) : t('Made here');
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

export type { BrandPreview } from './brand-specimen.ts';

/** A tiny, safe specimen from a system's own head document. It deliberately
 * loads only JSON already on-device; font files remain owned by the registry
 * and the browser simply falls back if a face has not been registered yet. */
export async function previewOf(host: CardHost, record: DesignSystemRecord): Promise<BrandPreview> {
  const fallback = "'SUSE', ui-sans-serif, system-ui, sans-serif";
  try {
    const blob = record.headId ? await host.assets._getBlob(record.headId) : null;
    const current = !blob && (await host.designSystems.activeId()) === record.id;
    const doc = blob && blob.size <= 2 * 1024 * 1024 ? JSON.parse(await blob.text()) : current ? await host.tokens?.raw?.() : null;
    const tokens = createTokenSet(doc);
    // A colourway's own colours (plans/319) repeat the roles they fill, and the
    // canonical lead's dark ones would count again in a light specimen.
    const colors = withoutLeadColours(tokens.colors())
      .map(token => tokenValueToHex(token.value))
      .filter((value): value is string => !!value)
      .filter((value, i, all) => all.indexOf(value) === i);
    const font = brandFontStack(tokens.resolve('font.brand'), fallback) ?? fallback;
    const dark = specimenInk(colors[0] ?? '#172b29') === SWATCH_INK.light;
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

/** "1 colour", "16 colours": the card read "1 colours" (plan 320 S10). */
function colourCount(n: number): string {
  return t(n === 1 ? '{n} colour' : '{n} colours', { n });
}

/** `canHide`: the shipped row may be removed (hidden) because the build is not
 *  locked and another system is on the device to fall back to. */
export function designSystemCardHtml(r: DesignSystemRecord, activeId: string, bytes: number | undefined, preview: BrandPreview, adminHref?: string | null, opts: { canHide?: boolean } = {}): string {
  const active = r.id === activeId;
  const removable = r.source.kind !== 'shipped' || (!!opts.canHide && !r.locked);
  const size = bytesLabel(bytes);
  return `
    <article class="ds-row${active ? ' is-active' : ' is-switchable'}" data-ds-row="${escape(r.id)}" aria-label="${escape(r.label)}">
      ${active ? '' : `<button type="button" class="ds-row-hit" data-ds-act="switch" aria-label="${escape(tRaw('Switch to {name}', { name: r.label }))}"></button>`}
      ${brandSpecimenHtml(r.label, preview, active)}
      <div class="ds-row-main">
        <h3 class="ds-row-label">${escape(r.label)}${r.locked ? `<span class="ds-row-lock" title="${escape(t('Read-only'))}">${icon('lock', { size: 14 })}</span>` : ''}</h3>
        <span class="ds-row-source">${escape(sourceLine(r))}</span>
        <span class="ds-row-facts">${colourCount(preview.colorCount ?? preview.colors.length)}${size ? ` <span>·</span> ${escape(size)}` : ''}</span>
        ${catalogSourceHtml(r, adminHref)}
      </div>
      <div class="ds-row-actions">
        <button type="button" class="btn ds-row-btn" data-ds-act="studio">${t('Open')}</button>
        <button type="button" class="btn ds-row-btn ds-row-download" data-ds-act="download" aria-label="${escape(tRaw('Download {name} as .lolly', { name: r.label }))}">${icon('download', { size: 16 })}<span>${t('Download')}</span></button>
        ${removable || r.locked ? `<details class="ds-row-more"><summary aria-label="${escape(tRaw('More actions for {name}', { name: r.label }))}">${icon('menu', { size: 16 })}</summary><div class="ds-row-menu">
          ${r.source.kind === 'hosted' ? `<button type="button" data-ds-act="refresh">${icon('refresh', { size: 16 })}${t('Check for updates')}</button>` : ''}
          ${r.locked ? `<button type="button" data-ds-act="fork">${icon('duplicate', { size: 16 })}${t('Make an editable copy')}</button>` : ''}
          ${resetKind(r) ? `<button type="button" data-ds-act="reset">${icon('undo', { size: 16 })}${t('Reset to original')}</button>` : ''}
          ${removable ? `<button type="button" class="ds-row-remove" data-ds-act="remove">${icon('trash', { size: 16 })}${t('Remove')}</button>` : ''}
        </div></details>` : '<span class="ds-row-more-placeholder" aria-hidden="true"></span>'}
      </div>
    </article>`;
}

export async function renderDesignSystemsCard(body: HTMLElement, host: CardHost): Promise<void> {
  const sizesOf = (host.assets as { _designMaterialSizes?(): Promise<Record<string, number>> })._designMaterialSizes;
  const [all, records, activeId, sizes] = await Promise.all([
    host.designSystems.list(),
    host.designSystems.visible(),
    host.designSystems.activeId(),
    sizesOf ? sizesOf.call(host.assets).catch(() => ({} as Record<string, number>)) : Promise.resolve({} as Record<string, number>),
  ]);
  const adminHref = (await import('../../org/index.ts')).orgAdminHref();
  const previews = await Promise.all(records.map(record => previewOf(host, record)));
  // The shipped row can go while something else stays; a removed one can come back.
  const canHide = records.some(r => r.source.kind !== 'shipped');
  const hiddenShipped = records.some(r => r.source.kind === 'shipped') ? null : all.find(r => r.source.kind === 'shipped' && !r.locked) ?? null;
  body.innerHTML = `
    <p class="profile-appearance-sub">${isTauriShell() ? t('The design systems on this device. The active one is what every tool renders with.') : t('The design systems in this browser. The active one is what every tool renders with.')}</p>
    <div class="ds-rows">${records.map((r, i) => designSystemCardHtml(r, activeId, sizes[r.id], previews[i]!, adminHref ? `${adminHref}#/instance?tab=design` : null, { canHide })).join('')}</div>
    <div class="ds-add">
      ${hiddenShipped ? `<button type="button" class="btn" data-ds-act="restore">${icon('refresh', { size: 14 })} ${escape(records.some(r => r.label === hiddenShipped.label)
        ? tRaw('Bring back the original {name}', { name: hiddenShipped.label }) : tRaw('Bring back {name}', { name: hiddenShipped.label }))}</button>` : ''}
      <button type="button" class="btn" data-ds-act="looks">${t('Find a look')}</button>
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
  let busy = true;
  body.setAttribute('aria-busy', 'true');
  announce(body, t('Loading design systems…'));
  void renderDesignSystemsCard(body, host).catch(() => { body.innerHTML = `<p class="profile-appearance-sub">${isTauriShell() ? t('Design systems are unavailable on this device.') : t('Design systems are unavailable in this browser.')}</p>`; }).finally(() => { busy = false; body.removeAttribute('aria-busy'); });

  // A row's "More actions" menu is a <details>. Escape and a press anywhere
  // else close it, as they close the app's other menus, and opening one row's
  // menu closes another's. The listeners go with the card.
  const closeMenus = (except?: Element | null): void => {
    body.querySelectorAll<HTMLDetailsElement>('details.ds-row-more[open]').forEach(menu => { if (menu !== except) menu.open = false; });
  };
  body.addEventListener('toggle', (e) => {
    const menu = e.target as HTMLDetailsElement | null;
    if (menu?.matches?.('details.ds-row-more') && menu.open) closeMenus(menu);
  }, true);
  const onKey = (e: KeyboardEvent): void => {
    if (!body.isConnected) { detach(); return; }
    const open = body.querySelector<HTMLDetailsElement>('details.ds-row-more[open]');
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    open.open = false;
    open.querySelector<HTMLElement>('summary')?.focus();
  };
  const onPress = (e: Event): void => {
    if (!body.isConnected) { detach(); return; }
    if (!(e.target as Element | null)?.closest?.('details.ds-row-more')) closeMenus();
  };
  const detach = (): void => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPress, true);
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPress, true);

  body.addEventListener('click', async (e) => {
    const btn = (e.target as Element).closest<HTMLElement>('[data-ds-act]');
    if (!btn || busy) return;
    const act = btn.dataset.dsAct;
    const id = btn.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow;
    busy = true;
    body.setAttribute('aria-busy', 'true');
    body.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
    const loading = act === 'switch' || act === 'studio' ? t('Loading design system…') : t('Working…');
    announce(body, loading);
    try {
      if (act === 'looks') { location.hash = '#/start?focus=looks'; return; }
      if (act === 'download' && id) {
        const { openBrandDownload } = await import('./brand-download.ts');
        await openBrandDownload(host as unknown as Parameters<typeof openBrandDownload>[0], id);
        return;
      }
      if (act === 'switch' && id) {
        // Say what changed and offer the way back (plan 320 M5): the switch
        // repaints every tool, so a silent one reads as nothing happening.
        const previous = await host.designSystems.active();
        const { record } = await switchDesignSystem(host, id, { route: 'profile', previous });
        showUndoToast({
          message: tRaw('Using {name}.', { name: record.label }),
          undo: async () => { await switchDesignSystem(host, previous.id, { route: 'profile' }); },
        });
        return; // the remount re-renders this card
      }
      if (act === 'studio' && id) {
        const activeId = await host.designSystems.activeId();
        if (activeId !== id) await switchDesignSystem(host, id, { route: 'profile', noRemount: true });
        location.hash = '#/start';
        return;
      }
      if (act === 'restore') {
        const shipped = await host.designSystems.get('shipped');
        await host.designSystems.setShippedHidden(false);
        announce(body, tRaw('“{name}” is back in the list.', { name: shipped?.label ?? '' }));
      }
      if (act === 'remove' && id === 'shipped') {
        const record = await host.designSystems.get(id);
        const ok = await confirmDialog({
          title: t('Remove “{name}”?', { name: record?.label ?? id }),
          message: t('This app supplies this design system, so its catalogue assets stay available. You can bring it back from this card.'),
          confirmLabel: t('Remove'),
          danger: true,
        });
        if (!ok) return;
        const res = await hideShippedDesignSystem(host, { route: 'profile' });
        announce(body, res.wasActive ? t('Removed. “{name}” is active.', { name: res.fallback.label }) : t('Removed.'));
      } else if (act === 'remove' && id) {
        const reviewed = await prepareDesignSystemRemoval(host.designSystems, id);
        const record = await host.designSystems.get(id);
        const ok = await confirmDialog({
          title: t('Remove “{name}”?', { name: record?.label ?? id }),
          message: reviewed.message,
          confirmLabel: t('Remove'),
          danger: true,
        });
        if (!ok) return;
        const res = await removeAndSwitchDesignSystem(host, id, reviewed, { route: 'profile' });
        const status = res.catalogStatus === 'cached'
          ? t('Removed from this device. The catalogue could not refresh; cached material remains until you reconnect.')
          : res.wasActive ? t('Removed. “{name}” is active.', { name: res.fallback.label }) : t('Removed.');
        announce(body, status + (res.kept ? ' ' + t('{n} shared assets were kept.', { n: res.kept }) : ''));
      }
      if (act === 'reset' && id) {
        const record = await host.designSystems.get(id);
        const ok = await confirmDialog({
          title: t('Reset “{name}”?', { name: record?.label ?? id }),
          message: t('Changes made here are discarded and “{name}” goes back to how it came with this app. Saved sessions and personal uploads stay.', { name: record?.label ?? id }),
          confirmLabel: t('Reset'),
          danger: true,
        });
        if (!ok) return;
        const original = await resetDesignSystem(host, id, { route: 'profile' });
        announce(body, t('“{name}” is back to the original.', { name: original.label }));
      }
      if (act === 'refresh' && id) {
        const { refreshHostedDesignSystem } = await import('./hosted.ts');
        const outcome = await refreshHostedDesignSystem(host as unknown as Parameters<typeof refreshHostedDesignSystem>[0], id, { force: true });
        if (outcome === 'updated' && (await host.designSystems.activeId()) === id) {
          await switchDesignSystem(host, id, { route: 'profile' });
          return;
        }
        if (outcome === 'unreachable') announce(body, isTauriShell() ? t('Could not reach the instance. The copy on this device stands.') : t('Could not reach the instance. The copy in this browser stands.'));
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
    } catch (error) {
      announce(body, error instanceof Error ? error.message : t('Could not complete this action. Please try again.'));
    } finally {
      const note = body.querySelector<HTMLElement>('.ds-note')?.textContent ?? '';
      if (body.isConnected) {
        const restoreFocus = body.contains(document.activeElement) || document.activeElement === document.body;
        await renderDesignSystemsCard(body, host).catch(() => { /* retain the last usable rows */ });
        body.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = false; });
        if (note && note !== loading) announce(body, note);
        else body.querySelector('.ds-note')?.remove();
        if (restoreFocus) {
          const actions = [...body.querySelectorAll<HTMLElement>('[data-ds-act]')];
          const target = actions.find(el => el.dataset.dsAct === act && el.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow === id)
            ?? actions.find(el => el.dataset.dsAct === 'new');
          target?.focus();
        }
      }
      busy = false;
      body.removeAttribute('aria-busy');
    }
  });
}
