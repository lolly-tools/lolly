// SPDX-License-Identifier: MPL-2.0
import { mountAssetSourceNavigation } from '../../components/asset-source-navigation.ts';
import { buildAssetSourceTree } from '../../lib/asset-source-tree.ts';
import { instanceFetch, getInstanceBase } from '../../lib/instance.ts';
import { updateRouteParams } from '../../lib/url-state.ts';
import { t } from '../../i18n.ts';
import { bindOp, type CatCtx } from './context.ts';
export function mount(cat: CatCtx): void {
  cat.sourceDispose?.();
  const root = cat.viewEl.querySelector<HTMLElement>('.asset-sources'); if (!root) return;
  const focusedId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-source-node]')?.dataset.sourceNode;
  root.replaceChildren(); root.hidden = !cat.sourcesOpen;
  const assets = cat.allAssets.filter(a => !cat.hiddenSet.has(a.id));
  cat.sourceDispose = mountAssetSourceNavigation(root, buildAssetSourceTree(assets, cat.sourceStatuses), cat.sourceSelection, cat.sourceExpanded, cat.sourceStatuses, id => {
    cat.sourceSelection = id; updateRouteParams({ sourceNode: id === 'all' ? null : id }); cat.sections.renderBody();
  }, () => { if (cat.sourcePrefsKey) void cat.host.state.save(cat.sourcePrefsKey, { expanded: [...cat.sourceExpanded].slice(0, 256) }).catch(() => {}); });
  const actions = document.createElement('div'); actions.className = 'asset-source-actions';
  const projects = document.createElement('a'); projects.href = '#/projects'; projects.className = 'btn btn--ghost btn--sm'; projects.textContent = t('Browse projects'); actions.append(projects);
  if (cat.sourceCanManage) { const manage = document.createElement('a'); manage.href = `${getInstanceBase() || ''}/admin/#/providers`; manage.className = 'btn btn--ghost btn--sm'; manage.textContent = t('Manage connections'); actions.append(manage); }
  if (focusedId) root.querySelector<HTMLElement>(`[data-source-node="${CSS.escape(focusedId)}"]`)?.focus();
  root.append(actions);
  const selectedStatus = cat.sourceStatuses.find(s => JSON.stringify([s.id]) === cat.sourceSelection);
  if (selectedStatus && selectedStatus.status !== 'current') { const note = document.createElement('p'); note.className = 'asset-source-health'; note.setAttribute('role', 'status'); note.textContent = t(selectedStatus.status === 'unavailable' ? 'This source is unavailable. Other sources can still be browsed.' : selectedStatus.status === 'pending' ? 'This source is syncing.' : 'Showing the last available listing. File access is checked when opened.'); if (selectedStatus.lastSyncedAt) note.title = new Date(selectedStatus.lastSyncedAt).toLocaleString(); root.append(note); }
  if (cat.sourceSelection !== 'all') { const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'btn btn--ghost btn--sm'; clear.textContent = t('All sources'); clear.addEventListener('click', () => { cat.sourceSelection = 'all'; updateRouteParams({ sourceNode: null }); cat.sections.renderBody(); mount(cat); }); root.append(clear); }
}
export function wire(cat: CatCtx): void {
  mount(cat);
  const button = cat.viewEl.querySelector<HTMLElement>('[data-browse-sources]');
  button?.setAttribute('aria-expanded', String(cat.sourcesOpen));
  button?.addEventListener('click', () => { cat.sourcesOpen = !cat.sourcesOpen; button.setAttribute('aria-expanded', String(cat.sourcesOpen)); const rail = cat.viewEl.querySelector<HTMLElement>('.asset-sources'); if (rail) { rail.hidden = !cat.sourcesOpen; if (cat.sourcesOpen) rail.querySelector<HTMLElement>('[tabindex="0"]')?.focus(); } });
}
export async function refresh(cat: CatCtx): Promise<void> {
  try {
    const response = await instanceFetch('/api/v1/catalog/sources', { cache: 'no-store' }); if (response.status === 401 || response.status === 403) { cat.sections.closeDetails(); cat.sourceStatuses = []; cat.allAssets = cat.allAssets.filter(a => !a.meta?.provider); cat.sections.renderBody(); cat.sources.mount(); return; } if (!response.ok) return;
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
    const viewedProvider = cat.detailsDialog?.dataset.viewerProvider;
    if (viewedProvider && !current.has(viewedProvider)) cat.sections.closeDetails();
    cat.allAssets = cat.allAssets.filter(a => typeof a.meta?.provider !== 'string' || current.has(a.meta.provider));
    cat.sources.mount(); cat.sections.renderBody();
  } catch { /* Retain the current listing when the instance cannot be reached. */ }
}
export const sourcesOps = (cat: CatCtx) => ({ mount: bindOp(cat, mount), wire: bindOp(cat, wire), refresh: bindOp(cat, refresh) });
