// SPDX-License-Identifier: MPL-2.0
/**
 * The Profile view's "Design systems" card (plans/186 section 5): one compact
 * row per design system on this device. Each row leads with a cover in the
 * system's own look (cover.ts), then its name, where it came from and a line
 * of facts: colours, typefaces, colourways and size. The card only
 * switches/opens/removes systems; their name and actual brand work live
 * together in the Start studio.
 *
 * The card is the only place a person manages the list; switching itself is
 * lib/design-system/switch.ts's ordered sweep, called from here with the profile
 * route so the view remounts and this card re-renders with the new active tick.
 * A switch made elsewhere (the account menu) re-renders the card in place.
 * mountDesignSystemsCard returns the function that detaches the card's window
 * and document listeners; the Profile view calls it when the route changes.
 * "From an instance" (section 3.6) is a later milestone and is not rendered
 * until it works - never a door that opens on nothing.
 */
import type { BrandPreview } from './brand-specimen.ts';
import { t, tRaw } from '../../i18n.ts';
import { isTauriShell } from '../instance-choice.ts';
import { escape } from '../../utils.ts';
import { icon } from '../icons.ts';
import { confirmDialog, promptDialog } from '../../components/confirm-dialog.ts';
import type { DesignSystemRecord } from './registry.ts';
import { createDesignSystem, type ManageHost } from './manage.ts';
import { hideShippedDesignSystem, prepareDesignSystemRemoval, removeAndSwitchDesignSystem } from './remove-coordinator.ts';
import { resetDesignSystem, resetKind } from './reset.ts';
import { DESIGN_SYSTEM_CHANGED_EVENT, switchDesignSystem, type SwitchHost } from './switch.ts';
import { switchWithUndo } from './switch-undo.ts';
import { catalogSourceHtml } from './catalog-source.ts';
import { sourceLine } from './source-line.ts';
import { looksFromColours, monogramOf, readDesignSystemPreview, type DesignSystemPreview } from './preview.ts';
import { coverHtml, wireCoverImages } from './cover.ts';

export { sourceLine };
export { previewOf } from './preview.ts';

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

/** "3.2 MB" for a row; '' below a kilobyte so the shipped row and an empty new
 *  system carry no size at all. */
function bytesLabel(n: number | undefined): string {
  if (!n || n < 1024) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export type { BrandPreview } from './brand-specimen.ts';

/** What a row is drawn from: a full preview, or (the component library's demo
 *  rows) only a font and some colours, with the rest derived here. */
export type RowPreview = BrandPreview & Partial<DesignSystemPreview>;

/** Previews read for one mounted card, keyed `${id}|${headId}` (preview.ts). */
type PreviewCache = Map<string, Promise<DesignSystemPreview>>;

/** "1 colour", "16 colours": the card read "1 colours" (plan 320 S10). */
function colourCount(n: number): string {
  return t(n === 1 ? '{n} colour' : '{n} colours', { n });
}

/** The row's facts, in order: colours, up to three typefaces, colourways when
 *  there is a choice of them, and the size on this device. A system whose head
 *  could not be read shows its size alone, never "0 colours". */
function factsOf(preview: RowPreview, size: string): string[] {
  if (preview.unread) return size ? [size] : [];
  const facts = [colourCount(preview.colorCount ?? preview.colors.length)];
  const families = (preview.families ?? []).slice(0, 3);
  if (families.length) facts.push(families.join(', '));
  const ways = preview.colourways ?? 0;
  if (ways >= 2) facts.push(t('{n} colourways', { n: ways }));
  if (size) facts.push(size);
  return facts;
}

/** Read the previews four at a time, so a long list does not start every blob read at once. */
async function readPreviews(host: CardHost, records: readonly DesignSystemRecord[], cache?: PreviewCache): Promise<DesignSystemPreview[]> {
  const out: DesignSystemPreview[] = [];
  for (let at = 0; at < records.length; at += 4) {
    out.push(...await Promise.all(records.slice(at, at + 4).map(record => readDesignSystemPreview(host, record, cache))));
  }
  return out;
}

/** `canHide`: the shipped row may be removed (hidden) because the build is not
 *  locked and another system is on the device to fall back to. */
export function designSystemCardHtml(r: DesignSystemRecord, activeId: string, bytes: number | undefined, preview: RowPreview, adminHref?: string | null, opts: { canHide?: boolean } = {}): string {
  const active = r.id === activeId;
  const removable = r.source.kind !== 'shipped' || (!!opts.canHide && !r.locked);
  // The switch's name is what the row shows: the "Use" pill, then the system's
  // name, so a person who says "Click Use" with voice control reaches the switch.
  const idPart = r.id.replace(/[^\w-]/g, '_');
  const useId = `ds-row-use-${idPart}`;
  const labelId = `ds-row-label-${idPart}`;
  const cover = preview.unread ? '<span class="ds-cover ds-cover--row is-pending" aria-hidden="true"></span>' : coverHtml({
    ...preview,
    looks: preview.looks ?? looksFromColours(preview.colors),
    logos: preview.logos ?? (preview.logoUrl ? { light: preview.logoUrl } : {}),
    monogram: preview.monogram ?? monogramOf(r.label),
    display: preview.display ?? preview.font,
  }, 'row', { active });
  // Each fact keeps its separator on its own line end, so a wrapped line never opens on a dot.
  const list = factsOf(preview, bytesLabel(bytes));
  const facts = list.map((f, i) => `<span class="ds-row-fact">${escape(f)}${i < list.length - 1 ? '<span aria-hidden="true"> ·</span>' : ''}</span>`).join(' ');
  return `
    <article class="ds-row${active ? ' is-active' : ' is-switchable'}" data-ds-row="${escape(r.id)}" aria-label="${escape(r.label)}">
      ${active ? '' : `<button type="button" class="ds-row-hit" data-ds-act="switch" aria-labelledby="${useId} ${labelId}"></button>`}
      <span class="ds-row-cover">${cover}</span>
      <div class="ds-row-main">
        <div class="ds-row-head">
          <h3 class="ds-row-label" id="${labelId}">${escape(r.label)}${r.locked ? `<span class="ds-row-lock" title="${escape(t('Read-only'))}">${icon('lock', { size: 14 })}</span>` : ''}</h3>
          ${active ? `<span class="ds-row-active">${icon('check', { size: 14 })} ${t('Active')}</span>` : `<span class="ds-row-use" id="${useId}">${t('Use')}</span>`}
        </div>
        <span class="ds-row-source">${escape(sourceLine(r))}</span>
        <span class="ds-row-facts">${facts}</span>
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

/** Render the card body. `cache` is the mounted card's own (mountDesignSystemsCard). */
export async function renderDesignSystemsCard(body: HTMLElement, host: CardHost, cache?: PreviewCache): Promise<void> {
  const sizesOf = (host.assets as { _designMaterialSizes?(): Promise<Record<string, number>> })._designMaterialSizes;
  const [all, records, activeId, sizes] = await Promise.all([
    host.designSystems.list(),
    host.designSystems.visible(),
    host.designSystems.activeId(),
    sizesOf ? sizesOf.call(host.assets).catch(() => ({} as Record<string, number>)) : Promise.resolve({} as Record<string, number>),
  ]);
  const adminHref = (await import('../../org/index.ts')).orgAdminHref();
  const previews = await readPreviews(host, records, cache);
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
  wireCoverImages(body);
}

/** While an action runs every control reads as unavailable but keeps its focus:
 *  `aria-disabled`, never `disabled`, which would drop the focus to the page. */
function markBusy(body: HTMLElement, on: boolean): void {
  body.querySelectorAll<HTMLElement>('[data-ds-act], details.ds-row-more > summary').forEach(el => {
    if (on) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
  });
}

/** Forget the previews of these systems, so their next render reads their heads again. */
function dropPreviews(cache: PreviewCache, ids: ReadonlyArray<string | null | undefined>): void {
  for (const key of [...cache.keys()]) {
    if (ids.some(id => id && key.startsWith(`${id}|`))) cache.delete(key);
  }
}

/** A one-line status under the rows, replacing the last one. Plain text: the
 *  message may be an error's own sentence. */
function announce(body: HTMLElement, text: string): void {
  let el = body.querySelector<HTMLElement>('.ds-note');
  if (!el) { el = document.createElement('p'); el.className = 'profile-appearance-sub ds-note'; el.setAttribute('role', 'status'); body.appendChild(el); }
  el.textContent = text;
}

/**
 * Open a row's More actions menu on the side with room. It opens downward, and
 * on a row near the foot of the card the card's clip would cut it off, so it
 * then opens upward when there is more room above.
 */
function placeMenu(menu: HTMLDetailsElement): void {
  const list = menu.querySelector<HTMLElement>('.ds-row-menu');
  const summary = menu.querySelector<HTMLElement>('summary');
  const view = menu.ownerDocument.defaultView;
  if (!list || !summary || !view) return;
  delete list.dataset.up;
  let clip: HTMLElement | null = menu.parentElement;
  while (clip && clip !== menu.ownerDocument.body) {
    const style = view.getComputedStyle(clip);
    if ([style.overflow, style.overflowX, style.overflowY].some(v => v && v !== 'visible')) break;
    clip = clip.parentElement;
  }
  const bounds = clip && clip !== menu.ownerDocument.body ? clip.getBoundingClientRect() : { top: 0, bottom: view.innerHeight };
  const box = list.getBoundingClientRect();
  if (box.bottom <= bounds.bottom) return;
  const at = summary.getBoundingClientRect();
  if (at.top - bounds.top > bounds.bottom - at.bottom) list.dataset.up = '';
}

/**
 * Mount the card body and wire its actions. Re-renders itself after every
 * action. Returns the function that detaches the card's window and document
 * listeners, for the view's teardown.
 */
export function mountDesignSystemsCard(body: HTMLElement, host: CardHost): () => void {
  let busy = true;
  const cache: PreviewCache = new Map();

  // A switch made somewhere else (the account menu, the Settings strip) moves the
  // active tick. The card re-renders in place when it is idle, keeping the focus
  // on the same control; an action of its own re-renders when it finishes.
  let refreshing = false;
  let refreshAgain = false;
  let staleWhileBusy = false;
  const refresh = (): void => {
    staleWhileBusy = false;
    if (refreshing) { refreshAgain = true; return; }
    refreshing = true;
    const current = document.activeElement;
    const focused = current && body.contains(current) ? current.closest<HTMLElement>('[data-ds-act]') : null;
    const act = focused?.dataset.dsAct;
    const row = focused?.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow;
    void renderDesignSystemsCard(body, host, cache).catch(() => { /* keep the last usable rows */ }).finally(() => {
      refreshing = false;
      if (act && body.isConnected && !body.contains(document.activeElement)) {
        const actions = [...body.querySelectorAll<HTMLElement>('[data-ds-act]')];
        const inRow = actions.filter(el => el.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow === row);
        (inRow.find(el => el.dataset.dsAct === act) ?? inRow[0] ?? actions.find(el => el.dataset.dsAct === act))?.focus();
      }
      if (refreshAgain && body.isConnected && !busy) { refreshAgain = false; refresh(); }
    });
  };
  const onChanged = (e: Event): void => {
    if (!body.isConnected) { detach(); return; }
    const was = body.querySelector<HTMLElement>('.ds-row.is-active')?.dataset.dsRow;
    dropPreviews(cache, [was, (e as CustomEvent<{ id?: string } | undefined>).detail?.id]);
    if (busy) { staleWhileBusy = true; return; }
    refresh();
  };

  body.setAttribute('aria-busy', 'true');
  announce(body, t('Loading design systems…'));
  void renderDesignSystemsCard(body, host, cache).catch(() => { body.innerHTML = `<p class="profile-appearance-sub">${isTauriShell() ? t('Design systems are unavailable on this device.') : t('Design systems are unavailable in this browser.')}</p>`; }).finally(() => {
    busy = false;
    body.removeAttribute('aria-busy');
    if (staleWhileBusy && body.isConnected) refresh();
  });

  // A row's "More actions" menu is a <details>. Escape and a press anywhere
  // else close it, as they close the app's other menus, and opening one row's
  // menu closes another's. The listeners go with the card.
  const closeMenus = (except?: Element | null): void => {
    body.querySelectorAll<HTMLDetailsElement>('details.ds-row-more[open]').forEach(menu => { if (menu !== except) menu.open = false; });
  };
  body.addEventListener('toggle', (e) => {
    const menu = e.target as HTMLDetailsElement | null;
    if (menu?.matches?.('details.ds-row-more') && menu.open) { closeMenus(menu); placeMenu(menu); }
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
    window.removeEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged);
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('pointerdown', onPress, true);
  window.addEventListener(DESIGN_SYSTEM_CHANGED_EVENT, onChanged);

  body.addEventListener('click', async (e) => {
    const target = e.target as Element;
    // A row menu stays shut while an action runs; its items are blocked below.
    if (busy && target.closest?.('details.ds-row-more > summary')) { e.preventDefault(); return; }
    const btn = target.closest<HTMLElement>('[data-ds-act]');
    if (!btn || busy) return;
    const act = btn.dataset.dsAct;
    const id = btn.closest<HTMLElement>('[data-ds-row]')?.dataset.dsRow;
    busy = true;
    body.setAttribute('aria-busy', 'true');
    markBusy(body, true);
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
        await switchWithUndo(host, id, { route: 'profile' });
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
        // An action can change a head under the same id (reset, a hosted update).
        cache.clear();
        staleWhileBusy = false;
        await renderDesignSystemsCard(body, host, cache).catch(() => { /* retain the last usable rows */ });
        markBusy(body, false);
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
  return detach;
}
