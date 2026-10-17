// SPDX-License-Identifier: MPL-2.0
import { mountAssetSourceNavigation } from '../../components/asset-source-navigation.ts';
import { buildAssetSourceTree } from '../../lib/asset-source-tree.ts';
import { instanceFetch, instancePath, getInstanceBase } from '../../lib/instance.ts';
import { updateRouteParams } from '../../lib/url-state.ts';
import { t } from '../../i18n.ts';
import { setActionButtonContent } from '../../components/action-button.ts';
import { clampWidth, mountSplitter, readStoredWidths, writeStoredWidths } from '../../lib/splitter.ts';
import { bindOp, type CatCtx } from './context.ts';
/** The rail's width is a per-viewer chrome preference, kept in browser storage like the asset inspector's. */
export const SOURCES_WIDTH_KEY = 'lolly:asset-sources';
export const SOURCES_WIDTH = { min: 180, initial: 240, max: 480 } as const;
/** Room the listing keeps beside the rail: 320px plus the 20px workspace gap. asset-source-navigation.css caps the column with the same 340px. */
export const LISTING_ROOM = 340;
export function mount(cat: CatCtx): void {
  cat.sourceDispose?.();
  const root = cat.viewEl.querySelector<HTMLElement>('.asset-sources'); if (!root) return;
  const focusedId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-source-node]')?.dataset.sourceNode;
  root.replaceChildren(); root.hidden = !cat.sourcesOpen;
  const assets = cat.allAssets.filter(a => !cat.hiddenSet.has(a.id));
  const tree = cat.remote?.tree() ?? buildAssetSourceTree(assets, cat.sourceStatuses);
  const shared = cat.projects?.tree(); if (shared) tree.splice(3, 0, shared);
  cat.sourceDispose = mountAssetSourceNavigation(root, tree, cat.sourceSelection, cat.sourceExpanded, cat.sourceStatuses, id => {
    cat.sourceSelection = id; updateRouteParams({ sourceNode: id === 'all' ? null : id }); cat.sections.renderBody();
  }, () => { if (cat.sourcePrefsKey) void cat.host.state.save(cat.sourcePrefsKey, { expanded: [...cat.sourceExpanded].slice(0, 256) }).catch(() => {}); });
  const actions = document.createElement('div'); actions.className = 'asset-source-actions';
  const projects = document.createElement('a'); projects.href = '#/projects'; projects.className = 'btn btn--labelled btn--ghost'; setActionButtonContent(projects, t('Browse projects'), 'folder'); actions.append(projects);
  if (cat.sourceCanManage) { const manage = document.createElement('a'); manage.href = `${getInstanceBase() || ''}/admin/#/providers`; manage.className = 'btn btn--labelled btn--ghost'; setActionButtonContent(manage, t('Manage connections'), 'link'); actions.append(manage); }
  if (focusedId) root.querySelector<HTMLElement>(`[data-source-node="${CSS.escape(focusedId)}"]`)?.focus();
  root.append(actions);
  const selectedStatus = cat.sourceStatuses.find(s => JSON.stringify([s.id]) === cat.sourceSelection);
  if (selectedStatus && selectedStatus.status !== 'current') { const note = document.createElement('p'); note.className = 'asset-source-health'; note.setAttribute('role', 'status'); note.textContent = t(selectedStatus.status === 'unavailable' ? 'This source is unavailable. Other sources can still be browsed.' : selectedStatus.status === 'pending' ? 'This source is syncing.' : 'Showing the last available listing. File access is checked when opened.'); if (selectedStatus.lastSyncedAt) note.title = new Date(selectedStatus.lastSyncedAt).toLocaleString(); root.append(note); }
  if (cat.sourceSelection !== 'all') { const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn btn--ghost btn--sm'; clear.textContent = t('All sources'); clear.addEventListener('click', () => { cat.sourceSelection = 'all'; updateRouteParams({ sourceNode: null }); cat.sections.renderBody(); mount(cat); }); root.append(clear); }
}
/** The grip on the rail's edge (lib/splitter.ts). The grip sits in the column beside the rail, so it survives `mount` rebuilding the rail. */
export function resizable(cat: CatCtx): void {
  const column = cat.viewEl.querySelector<HTMLElement>('.asset-sources-column'), rail = column?.querySelector<HTMLElement>('.asset-sources'); if (!column || !rail) return;
  const { min, initial } = SOURCES_WIDTH;
  let width = clampWidth(readStoredWidths(SOURCES_WIDTH_KEY).width ?? initial, min, SOURCES_WIDTH.max);
  // A narrow window caps the rail without forgetting the wanted width; the stylesheet applies the same cap.
  const max = () => Math.max(min, Math.min(SOURCES_WIDTH.max, (column.parentElement?.clientWidth ?? 0) - LISTING_ROOM));
  const shown = () => Math.min(width, max());
  const apply = () => column.style.setProperty('--asset-sources-width', `${width}px`);
  const grip = document.createElement('div'); grip.className = 'asset-sources-grip'; column.append(grip); apply();
  const splitter = mountSplitter({ grip, controls: rail, panel: 'start', label: t('Resize the Sources panel'), valueText: px => t('{width} pixels wide', { width: px }), hint: t('Drag to resize. Use arrow keys to resize, or Enter to reset.'),
    value: shown, limits: () => ({ min, max: max(), initial: Math.min(initial, max()) }),
    set: (px, done) => { width = px; apply(); if (done) writeStoredWidths(SOURCES_WIDTH_KEY, { width }); return shown(); },
    reset: () => { width = initial; apply(); writeStoredWidths(SOURCES_WIDTH_KEY, {}); } });
  // The window may have changed size since the last move, so the value is read again on focus.
  grip.addEventListener('focus', splitter.sync);
}
export function wire(cat: CatCtx): void {
  mount(cat);
  resizable(cat);
  const button = cat.viewEl.querySelector<HTMLElement>('[data-browse-sources]');
  button?.setAttribute('aria-expanded', String(cat.sourcesOpen));
  button?.addEventListener('click', () => { cat.sourcesOpen = !cat.sourcesOpen; button.setAttribute('aria-expanded', String(cat.sourcesOpen)); const rail = cat.viewEl.querySelector<HTMLElement>('.asset-sources'); if (rail) { rail.hidden = !cat.sourcesOpen; if (cat.sourcesOpen) rail.querySelector<HTMLElement>('[tabindex="0"]')?.focus(); } });
}
export async function refresh(cat: CatCtx): Promise<void> {
  try {
    const response = await instanceFetch(instancePath('/api/v1/catalog/sources'), { cache: 'no-store' }); if (response.status === 401 || response.status === 403) { cat.sections.closeDetails(); cat.sourceStatuses = []; cat.remote?.restrictSources(new Set()); cat.allAssets = cat.allAssets.filter(a => !a.meta?.provider); cat.sections.renderBody(); cat.sources.mount(); return; } if (!response.ok) return;
    const data = await response.json() as { sources?: typeof cat.sourceStatuses; canManage?: boolean; scope?: string };
    if (!cat.mounted) return;
    if (typeof data.scope === 'string' && !cat.sourcePrefsKey) {
      const key = `catalog-source-tree:${getInstanceBase()}:${data.scope}`;
      const preferences = await cat.host.state.load(key) as { expanded?: string[] } | null;
      if (!cat.mounted) return; cat.sourcePrefsKey = key;
      if (Array.isArray(preferences?.expanded)) cat.sourceExpanded = new Set(preferences.expanded.filter(id => typeof id === 'string').slice(0, 256));
    }
    cat.sourceStatuses = Array.isArray(data.sources) ? data.sources : []; cat.sourceCanManage = data.canManage === true;
    const current = new Set(cat.sourceStatuses.map(s => s.id));
    cat.remote?.restrictSources(current);
    const viewedProvider = cat.detailsDialog?.dataset.viewerProvider;
    if (viewedProvider && !current.has(viewedProvider)) cat.sections.closeDetails();
    cat.allAssets = cat.allAssets.filter(a => typeof a.meta?.provider !== 'string' || current.has(a.meta.provider));
    cat.sources.mount(); cat.sections.renderBody();
  } catch { /* Retain the current listing when the instance cannot be reached. */ }
}
export const sourcesOps = (cat: CatCtx) => ({ mount: bindOp(cat, mount), wire: bindOp(cat, wire), refresh: bindOp(cat, refresh) });
