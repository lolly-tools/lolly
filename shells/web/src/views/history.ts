// SPDX-License-Identifier: MPL-2.0
import { replaceRouteUrl, routeParams, updateRouteParams } from '../lib/url-state.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { AppHistoryContext, AppHistoryRow, AppHistoryView, AppHistoryQuery } from '../bridge/app-history.ts';
import type { Folder } from '../folders.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { createHistoryPreviews } from '../components/history-previews.ts';
import { openHistoryPanel } from '../components/history-panel.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { syncBulkBar, wireEscapeClearsSelection, type BulkBarConfig } from '../lib/bulk-bar.ts';
import { menuItemHtml, wireTileContextMenu } from '../lib/context-menu.ts';
import { fmtBytes } from '../lib/format.ts';
import { historyPeriods } from '../lib/history-periods.ts';
import { navigateHistoryHref } from '../lib/history-navigation.ts';
import { sessionOpenHref } from '../lib/search/projects-source.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { icon } from '../lib/icons.ts';
import { SEARCH_DEBOUNCE_MS } from '../lib/search/match.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { historyFilterPicker } from './history-filter-picker.ts';
import { pruneOutcome } from './profile-storage-model.ts';
import { historyElement as element, historyButton as button, historyLink as link, historyIcon, historyAction, historyDayKey, historyDay, historyPeriod,
  historyProjectHref, historyResultsHref, historyRowActions, historyTitle, type HistoryRowAction, type HistoryTimelineContext } from './history-timeline.ts';
import './history.css';

type HistoryLayout = 'grid' | 'list';
// The browse-layout naming (components/browse-layout.ts), a chrome preference only.
const LAYOUT_KEY = 'lolly-layout-history';
const readLayout = (): HistoryLayout => { try { return localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; } };
const writeLayout = (layout: HistoryLayout): void => { try { if (layout === 'grid') localStorage.removeItem(LAYOUT_KEY); else localStorage.setItem(LAYOUT_KEY, layout); } catch { /* private mode */ } };

/** A segmented control with the `.view-seg` look (lib/seg.ts), built as nodes. */
function segment(label: string, options: ReadonlyArray<{ id: string; label: string; glyph?: Parameters<typeof historyIcon>[0]; iconOnly?: boolean }>, extra: string): { group: HTMLElement; buttons: Map<string, HTMLButtonElement> } {
  const group = element('div', undefined, `view-seg be-seg ${extra}`); group.setAttribute('role', 'group'); group.setAttribute('aria-label', t(label));
  const buttons = new Map<string, HTMLButtonElement>();
  for (const option of options) {
    const item = element('button', undefined, 'view-seg-btn'); item.type = 'button'; item.dataset.val = option.id;
    if (option.glyph) item.append(historyIcon(option.glyph));
    item.append(element('span', t(option.label), option.iconOnly ? 'visually-hidden' : undefined));
    if (option.iconOnly) item.title = t(option.label);
    group.append(item); buttons.set(option.id, item);
  }
  return { group, buttons };
}

/** Route-backed app History, with the same creation panel used by editors. Only
 * the device capability may open its stores; shared mounts never feed this index. */
export async function mountHistory(view: HTMLElement & { _cleanup?: () => void }, host: HostV1, params = '', onRemember?: () => void): Promise<void> {
  const state = host.state as WebStateAPI, activity = state.history?.activity;
  let disposed = false, generation = 0, closePanel: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  view.innerHTML = backHomeHtml(); mountBackPill(view); mountHomeFab(view);
  const workspace = element('section', undefined, 'app-history'); workspace.setAttribute('aria-label', t('History workspace'));
  const header = element('header', undefined, 'app-history-header');
  const title = element('h1', t('History'));
  const source = element('span', undefined, 'app-history-source'); source.append(historyIcon('monitor'), element('span', isTauriShell() ? t('This device') : t('This browser')));
  const heading = element('div', undefined, 'app-history-heading'); heading.append(title, source);
  const headerActions = element('div', undefined, 'app-history-header-actions');
  const refresh = button('Refresh', 'refresh', true), projects = link('Open Projects', '#/p', 'folder');
  refresh.classList.add('btn--ghost'); projects.classList.add('btn--ghost');
  headerActions.append(refresh, projects); header.append(heading, headerActions); workspace.append(header); view.append(workspace);
  document.title = `${t('History')} - Lolly`;
  if (!activity) { workspace.append(element('p', t('App history is not available in this session. Open Projects to find your saved creations.'))); refresh.hidden = true; return; }
  const query = new URLSearchParams(params);
  let active: AppHistoryView = query.get('view') === 'changes' ? 'changes' : query.get('view') === 'milestones' ? 'milestones' : 'recent';
  let layout: HistoryLayout = readLayout();

  // ── Toolbar: what to show, how to find it, how to lay it out ────────────────
  const controls = element('section', undefined, 'app-history-controls');
  const tabs = segment('History views', [{ id: 'recent', label: 'Recent' }, { id: 'changes', label: 'Changes' }, { id: 'milestones', label: 'Milestones' }], 'app-history-tabs');
  for (const [id, tab] of tabs.buttons) tab.addEventListener('click', () => { if (active === id) return; active = id as AppHistoryView; clearSelection(false); reload(); });
  const layoutSeg = segment('Layout', [{ id: 'grid', label: 'Grid', glyph: 'grid', iconOnly: true }, { id: 'list', label: 'List', glyph: 'menuLines', iconOnly: true }], 'app-history-layout');
  const filters = element('form', undefined, 'app-history-filters'); filters.setAttribute('aria-label', t('Filter history'));
  const search = element('input', undefined, 'field-input'); search.type = 'search'; search.maxLength = 200;
  search.placeholder = t('Search creations, projects and milestones'); search.setAttribute('aria-label', t('Search history')); search.value = query.get('q') ?? '';
  const select = (label: string, caption: string): HTMLSelectElement => {
    const el = element('select', undefined, 'field-select'); el.setAttribute('aria-label', t(label)); el.add(new Option(t(caption), '')); return el;
  };
  const project = select('Filter by project', 'All projects'), tool = select('Filter by tool', 'All tools');
  const toolIcons = new Map<string, string>();
  const projectPicker = historyFilterPicker(project, { id: 'history-project', label: 'Filter by project', searchLabel: 'Search projects', emptyLabel: 'No matching projects', glyph: 'folder',
    preview: async id => {
      if (id === '__loose__') return null;
      const page = await activity.list({ view: 'recent', project: id }, context);
      for (const row of page.entries.slice(0, 4)) { const preview = await activity.preview(row); if (preview) return preview; }
      return null;
    } });
  const toolPicker = historyFilterPicker(tool, { id: 'history-tool', label: 'Filter by tool', searchLabel: 'Search tools', emptyLabel: 'No matching tools', glyph: 'grid', icon: id => toolIcons.get(id) });
  const searchWrap = element('label', undefined, 'app-history-search'); searchWrap.append(historyIcon('search'), search);
  const field = (caption: string, control: HTMLElement): HTMLElement => {
    const wrap = element('label', undefined, 'app-history-filter-field'); wrap.append(element('span', t(caption)), control); return wrap;
  };
  const dateFields = element('div', undefined, 'app-history-date-fields');
  const dateField = (label: string): HTMLInputElement => {
    const input = element('input', undefined, 'field-input'); input.type = 'date'; input.setAttribute('aria-label', t(label)); dateFields.append(field(label, input)); return input;
  };
  const from = dateField('From date'), to = dateField('To date'); from.value = query.get('from') ?? ''; to.value = query.get('to') ?? '';
  const reset = button('Clear filters', 'close'); reset.classList.add('btn--ghost');
  const filterToggle = button('Filters', 'sliders'); filterToggle.classList.add('app-history-filter-toggle');
  const filterOptions = element('div', undefined, 'app-history-filter-options'); filterOptions.id = 'history-filter-options';
  filterOptions.append(field('Project', projectPicker.trigger), field('Tool', toolPicker.trigger), project, tool, dateFields, reset);
  const expandFilters = (open: boolean): void => { filters.classList.toggle('is-expanded', open); filterToggle.setAttribute('aria-expanded', String(open)); };
  filterToggle.setAttribute('aria-controls', filterOptions.id);
  expandFilters(!!(query.get('project') || query.get('tool') || from.value || to.value));
  filterToggle.addEventListener('click', () => expandFilters(!filters.classList.contains('is-expanded')));
  const toolbar = element('div', undefined, 'app-history-toolbar');
  toolbar.append(tabs.group, searchWrap, filterToggle, layoutSeg.group);
  filters.append(toolbar, filterOptions);
  controls.append(filters);

  const status = element('p', undefined, 'app-history-status'); status.setAttribute('role', 'status');
  const overview = element('div', undefined, 'app-history-overview');
  const overviewText = element('div'), sectionTitle = element('h2', t('Recent creations'));
  const count = element('p', undefined, 'app-history-count'); overviewText.append(sectionTitle, count);
  const foldDates = button('Collapse dates', 'layers'); foldDates.classList.add('btn--ghost');
  overview.append(overviewText, foldDates);
  const content = element('div', undefined, 'app-history-content'), main = element('div', undefined, 'app-history-main');
  const list = element('div', undefined, 'app-history-list'); list.setAttribute('aria-label', t('History entries'));
  const pagination = element('div', undefined, 'app-history-pagination'), newer = button('Newer', 'arrowLeft'), older = button('Older', 'arrowRight'); pagination.append(newer, older);
  const detail = element('aside', undefined, 'app-history-detail'); detail.setAttribute('aria-label', t('Creation history'));
  // What History holds, and the one clean-up it can do safely: automatic
  // checkpoints older than 30 days (the same action Settings > Storage offers).
  const storage = element('footer', undefined, 'app-history-storage'); storage.hidden = true;
  const storageText = element('span', undefined, 'app-history-storage-text');
  const storageLink = element('a', t('Storage'), 'app-history-storage-link'); storageLink.href = '#/profile?focus=storage-section';
  const prune = element('button', t('Remove automatic checkpoints older than 30 days'), 'btn btn--ghost app-history-prune'); prune.type = 'button';
  storage.append(historyIcon('box'), storageLink, storageText, prune);
  main.append(list, pagination, storage); content.append(main, detail); workspace.append(controls, overview, status, content);

  // ── Selection: saved creations can be picked and moved to the Trash ─────────
  const selected = new Set<string>();
  let currentRows = new Map<string, AppHistoryRow>();
  const bulkActions: BulkBarConfig['actions'] = [
    { id: 'all', label: () => t('Select all'), hidden: () => selectableRows().every(row => selected.has(row.id)) },
    { id: 'trash', label: () => t('Move to Trash'), extraClass: 'app-history-bulk-danger' },
  ];
  const bulkConfig: BulkBarConfig = { prefix: 'app-history-bulkbar', rootSelector: '.app-history', count: () => selected.size, actions: bulkActions };
  const bulkBar = element('div', undefined, 'app-history-bulkbar'); bulkBar.setAttribute('role', 'region'); bulkBar.setAttribute('aria-label', t('Selection actions')); bulkBar.hidden = true;
  const bulkCount = element('span', undefined, 'app-history-bulkbar-count'); bulkCount.setAttribute('aria-live', 'polite');
  const bulkButtons = element('div', undefined, 'app-history-bulkbar-actions');
  for (const action of bulkActions) {
    const b = element('button', undefined, `btn${action.extraClass ? ` ${action.extraClass}` : ''}`); b.type = 'button'; b.dataset.bulk = action.id;
    // syncBulkBar writes the label into the button's first <span>, so the glyph goes
    // in bare, the way bulkBarHtml draws the bar.
    if (action.id === 'trash') b.append(historyIcon('trash').firstElementChild!);
    b.append(element('span', typeof action.label === 'function' ? action.label() : action.label)); bulkButtons.append(b);
  }
  const bulkClear = element('button', undefined, 'app-history-bulkbar-clear'); bulkClear.type = 'button'; bulkClear.dataset.bulk = 'clear';
  bulkClear.setAttribute('aria-label', t('Clear selection')); bulkClear.append(historyIcon('close'));
  bulkBar.append(bulkCount, bulkButtons, bulkClear); workspace.append(bulkBar);
  const selectableRow = (row: AppHistoryRow): boolean => active === 'recent' && historyRowActions(row).includes('trash');
  const selectableRows = (): AppHistoryRow[] => [...currentRows.values()].filter(selectableRow);
  const paintSelection = (): void => {
    for (const tile of list.querySelectorAll<HTMLElement>('.app-history-row')) {
      const on = selected.has(tile.dataset.historyId ?? '');
      tile.classList.toggle('is-selected', on);
      tile.querySelector('.tile-check')?.setAttribute('aria-pressed', String(on));
    }
    syncBulkBar(view, bulkConfig);
  };
  function clearSelection(paint = true): void { selected.clear(); if (paint) paintSelection(); else syncBulkBar(view, bulkConfig); }
  const unbindEscape = wireEscapeClearsSelection({ active: () => selected.size > 0, clear: () => clearSelection() });

  const closedDates = new Set<string>();
  const updateFoldAction = (): void => {
    const anyOpen = !!list.querySelector('.app-history-day[open]');
    historyAction(foldDates, anyOpen ? 'Collapse dates' : 'Expand dates', 'layers');
  };
  foldDates.addEventListener('click', () => {
    const open = !list.querySelector('.app-history-day[open]');
    for (const day of list.querySelectorAll<HTMLDetailsElement>('.app-history-day')) day.open = open;
    updateFoldAction();
  });
  const paintLayout = (): void => {
    list.dataset.layout = layout;
    for (const [id, item] of layoutSeg.buttons) item.setAttribute('aria-pressed', String(id === layout));
  };
  for (const [id, item] of layoutSeg.buttons) item.addEventListener('click', () => { layout = id as HistoryLayout; writeLayout(layout); paintLayout(); previews.refresh(); });
  paintLayout();
  // A grid shows more pictures at once than the old list, so more may decode.
  const previews = createHistoryPreviews(list, rowId => {
    const row = currentRows.get(rowId); return row ? activity.preview(row) : Promise.resolve(null);
  }, { viewport: true, limit: 36 });
  let before: string | undefined = query.get('before') || undefined, next: string | undefined;
  const pages: Array<string | undefined> = [];
  let context: AppHistoryContext = { folders: [] };
  const toolNames = new Map<string, string>();
  const fail = (error: unknown): void => { if (!disposed) status.textContent = error instanceof Error ? error.message : t('Could not load history.'); };
  const remember = (): void => {
    const next = routeParams();
    for (const [key, value] of [['view', active === 'recent' ? '' : active], ['project', project.value], ['tool', tool.value], ['q', search.value], ['from', from.value], ['to', to.value], ['before', before ?? '']]) { if (value) next.set(key!, value); else next.delete(key!); }
    // Filters and paging are workspace state, not dozens of Back stops. The
    // entry survives browser Back from a resumed tool and reloads with its page.
    replaceRouteUrl(`#/history${next.size ? `?${next}` : ''}`);
    onRemember?.();
  };
  const versions = (row: Pick<AppHistoryRow, 'slot'>): void => {
    closePanel?.(); workspace.classList.add('has-detail');
    updateRouteParams({ _detail: row.slot ?? null });
    closePanel = openHistoryPanel({ state, slot: () => row.slot ?? null, container: detail,
      onClose: () => { workspace.classList.remove('has-detail'); if (!disposed) updateRouteParams({ _detail: null }); }, onNamed: () => { void load(); } });
  };
  const reopen = async (row: AppHistoryRow, control?: HTMLButtonElement): Promise<void> => {
    if (control) control.disabled = true;
    try {
      const href = await activity.reopenExport(row.ref);
      if (!href) throw new Error(t('This export is no longer in the recent download log.'));
      if (!disposed) navigateHistoryHref(href);
    } catch (error) { fail(error); } finally { if (control) control.disabled = false; }
  };
  const timeline: HistoryTimelineContext = {
    toolNames, preview: previews.add, versions, reopen: (row, control) => { void reopen(row, control); },
    selectable: selectableRow, isSelected: row => selected.has(row.id),
  };

  // ── Moving creations to the Trash: the same soft delete Projects uses ───────
  const trashRows = async (rows: AppHistoryRow[]): Promise<void> => {
    const slots = rows.map(row => row.slot!).filter(Boolean);
    if (!slots.length) return;
    const [{ createTrash, trashHostOf }, { showTrashUndoToast }] = await Promise.all([import('../lib/trash.ts'), import('../components/trash-dialog.ts')]);
    const trash = createTrash(trashHostOf(host));
    const names = new Map(rows.map(row => [row.slot!, historyTitle(timeline, row)]));
    const moved = await trash.trashSessions(slots, slot => names.get(slot) ?? slot);
    if (disposed) return;
    for (const row of rows) selected.delete(row.id);
    await load(); void measure();
    showTrashUndoToast(trash, moved, async () => { if (!disposed) { await load(); void measure(); } });
  };
  bulkBar.addEventListener('click', event => {
    const action = (event.target as Element).closest<HTMLButtonElement>('[data-bulk]')?.dataset.bulk;
    if (action === 'clear') clearSelection();
    else if (action === 'all') { for (const row of selectableRows()) selected.add(row.id); paintSelection(); }
    else if (action === 'trash') void trashRows([...selected].map(id => currentRows.get(id)).filter((row): row is AppHistoryRow => !!row)).catch(fail);
  });

  const labels: Record<HistoryRowAction, [string, Parameters<typeof icon>[0]]> = {
    resume: ['Resume', 'arrowRight'], versions: ['Versions', 'history'], project: ['Show in Projects', 'folder'],
    reopen: ['Reopen settings', 'sliders'], results: ['View results', 'arrowRight'], trash: ['Move to Trash', 'trash'],
  };
  const runAction = (action: string, row: AppHistoryRow): void => {
    if (action === 'resume' && row.slot) navigateHistoryHref(sessionOpenHref({ slot: row.slot, toolId: row.toolId }, isBatchSlot(row.slot)));
    else if (action === 'versions') versions(row);
    else if (action === 'project') location.hash = historyProjectHref(row);
    else if (action === 'reopen') void reopen(row);
    else if (action === 'results') location.hash = historyResultsHref(row);
    else if (action === 'trash') void trashRows([row]).catch(fail);
  };
  const menu = wireTileContextMenu({
    host: list, tileSelector: '.app-history-row', presentation: 'sheet',
    refOf: tile => tile.dataset.historyId && currentRows.has(tile.dataset.historyId) ? tile.dataset.historyId : null,
    isBulkTarget: ref => selected.size > 1 && selected.has(ref),
    singleHtml: ({ ref }) => {
      const row = currentRows.get(ref); if (!row) return '';
      return historyRowActions(row).map(action => menuItemHtml(action, icon(labels[action][1]), t(labels[action][0]), { danger: action === 'trash' })).join('');
    },
    bulkHtml: () => `<div class="folder-menu-head">${t('{n} selected', { n: selected.size })}</div><div role="menu">${menuItemHtml('trash', icon('trash'), t('Move to Trash'), { danger: true })}</div>`,
    head: target => {
      const row = target ? currentRows.get(target.ref) : undefined;
      return row ? { name: historyTitle(timeline, row) } : null;
    },
    onAction: (action, target) => {
      if (!target) { if (action === 'trash') bulkBar.querySelector<HTMLButtonElement>('[data-bulk="trash"]')?.click(); return; }
      const row = currentRows.get(target.ref); if (row) runAction(action, row);
    },
  });
  list.addEventListener('click', event => {
    const target = event.target as Element;
    const check = target.closest<HTMLButtonElement>('[data-history-select]');
    if (check) {
      const id = check.dataset.historySelect!;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      paintSelection(); return;
    }
    const kebab = target.closest<HTMLButtonElement>('[data-history-menu]');
    if (kebab) {
      const tile = kebab.closest<HTMLElement>('.app-history-row'), box = kebab.getBoundingClientRect();
      menu.openAt(box.left, box.bottom + 4, { ref: kebab.dataset.historyMenu!, tile }, kebab);
      return;
    }
    // While picking, a click anywhere on a selectable tile toggles that tile.
    const tile = target.closest<HTMLElement>('.app-history-row');
    if (selected.size && tile?.querySelector('[data-history-select]') && !target.closest('.app-history-versions')) {
      event.preventDefault(); event.stopPropagation();
      const id = tile.dataset.historyId!;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      paintSelection();
    }
  }, true);

  const measure = async (): Promise<void> => {
    const usage = await state.history?.usage().catch(() => undefined);
    if (disposed || !usage) return;
    const total = usage.checkpoints + usage.previews + usage.recovery;
    storage.hidden = total <= 0;
    storageText.textContent = tRaw('{size} used', { size: fmtBytes(total) });
  };
  prune.addEventListener('click', async () => {
    const history = state.history; if (!history) return;
    if (!await confirmDialog({
      title: tRaw('Remove automatic checkpoints older than 30 days?'),
      message: tRaw('Older automatic checkpoints go for good, in every creation. Explicit saves, named versions and the current version of each creation stay. This cannot be undone.'),
      confirmLabel: tRaw('Remove checkpoints'),
    })) { prune.focus(); return; }
    const label = prune.textContent; prune.disabled = true; prune.textContent = t('Removing…');
    try {
      const { removed, bytes } = await history.pruneAutomatic();
      announce(pruneOutcome(removed, bytes));
    } catch { announce(t('Older checkpoints could not be removed. Try again.'), { assertive: true }); }
    prune.textContent = label; prune.disabled = false;
    if (!disposed) { await load(); void measure(); }
  });

  const load = async (): Promise<void> => {
    const token = ++generation; status.textContent = t('Loading history…'); older.disabled = newer.disabled = true; list.setAttribute('aria-busy', 'true');
    remember();
    for (const [id, tab] of tabs.buttons) tab.setAttribute('aria-pressed', String(id === active));
    const options: AppHistoryQuery = { view: active, search: search.value, project: project.value, toolId: tool.value, before,
      from: from.value ? new Date(`${from.value}T00:00:00`).toISOString() : undefined,
      to: to.value ? new Date(`${to.value}T23:59:59.999`).toISOString() : undefined };
    try {
      const page = await activity.list(options, context);
      if (disposed || token !== generation) return;
      previews.clear(); currentRows = new Map(page.entries.map(row => [row.id, row])); list.replaceChildren();
      for (const id of [...selected]) if (!currentRows.has(id)) selected.delete(id);
      workspace.dataset.view = active;
      const days = new Map<string, AppHistoryRow[][]>();
      for (const period of active === 'changes' ? historyPeriods(page.entries) : page.entries.map(row => [row])) {
        const key = historyDayKey(period[0]!.at);
        const periods = days.get(key) ?? []; periods.push(period); days.set(key, periods);
      }
      for (const [key, periods] of days) {
        const rows = periods.flat();
        const { group, body } = historyDay(rows[0]!.at, rows, !closedDates.has(key));
        group.addEventListener('toggle', () => {
          if (!group.isConnected) return;
          if (group.open) closedDates.delete(key); else closedDates.add(key);
          updateFoldAction();
        });
        for (const period of periods) body.append(historyPeriod(timeline, period));
        list.append(group);
      }
      foldDates.hidden = days.size < 2; updateFoldAction();
      sectionTitle.textContent = t(active === 'recent' ? 'Recent creations' : active === 'changes' ? 'Checkpoints and exports' : 'Named versions');
      const entryCount = page.entries.length === 1 ? t('1 entry') : t('{count} entries', { count: page.entries.length });
      // One day already shows its own count on its divider.
      count.textContent = days.size > 1 ? entryCount : '';
      const filtered = !!(search.value || project.value || tool.value || from.value || to.value);
      reset.hidden = !filtered;
      const filterCount = [project.value, tool.value, from.value || to.value].filter(Boolean).length;
      historyAction(filterToggle, 'Filters', 'sliders');
      if (filterCount) filterToggle.append(element('span', String(filterCount), 'app-history-filter-count'));
      if (!page.entries.length) {
        const empty = element('section', undefined, 'app-history-empty');
        empty.append(historyIcon(filtered ? 'search' : active === 'milestones' ? 'star' : 'history'));
        empty.append(element('h3', t(page.before ? 'Nothing in this period' : filtered ? 'No matching history' : active === 'milestones' ? 'No named versions yet' : 'Nothing here yet')));
        empty.append(element('p', t(page.before ? 'Choose Older to continue through your history.' : filtered ? 'Try another search or clear your filters to see more of your work.' : active === 'milestones' ? 'Name a version from a creation’s history to find it here.' : 'Saved creations appear here.')));
        if (filtered) { const clear = button('Clear filters', 'close'); clear.addEventListener('click', () => reset.click()); empty.append(clear); }
        else if (!page.before) { const start = link('Explore tools', '#/', 'arrowRight'); start.classList.add('btn--primary'); empty.append(start); }
        list.append(empty);
      }
      controls.classList.toggle('is-quiet', !page.entries.length && !filtered && !page.before && !before);
      next = page.before; older.hidden = !next; newer.hidden = !before; pagination.hidden = !next && !before;
      status.textContent = !page.entries.length && next ? t('No matches in this period. Choose Older to keep searching.') : '';
      paintSelection();
    } catch (error) { if (token === generation) fail(error); }
    finally { if (!disposed && token === generation) { older.disabled = newer.disabled = false; list.setAttribute('aria-busy', 'false'); } }
  };
  function reload(): void { clearTimeout(timer); before = undefined; pages.length = 0; closePanel?.(); void load(); }
  filters.addEventListener('submit', event => { event.preventDefault(); reload(); });
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(reload, SEARCH_DEBOUNCE_MS); });
  for (const input of [project, tool, from, to]) input.addEventListener('change', reload);
  reset.addEventListener('click', () => { search.value = project.value = tool.value = from.value = to.value = ''; projectPicker.refresh(); toolPicker.refresh(); expandFilters(false); reload(); });
  older.addEventListener('click', () => { pages.push(before); before = next; clearSelection(false); void load(); overview.scrollIntoView({ block: 'start' }); });
  newer.addEventListener('click', () => { before = pages.pop(); clearSelection(false); void load(); overview.scrollIntoView({ block: 'start' }); });
  let loadedContext = false;
  const updateContext = async (): Promise<void> => {
    const profile = await host.profile.get() as { folders?: Folder[] };
    if (disposed) return;
    const catalog = (window as typeof window & { __toolIndex?: { tools?: Array<{ id: string; name: string; icon?: string }> } }).__toolIndex;
    toolIcons.clear(); toolNames.clear();
    toolIcons.set('convert', icon('convert'));
    for (const entry of catalog?.tools ?? []) if (entry.icon) toolIcons.set(entry.id, entry.icon);
    context = { folders: profile.folders ?? [], tools: [...(catalog?.tools ?? []), { id: 'convert', name: t('Convert') }] };
    const selectedProject = loadedContext ? project.value : query.get('project') || '', selectedTool = loadedContext ? tool.value : query.get('tool') || '';
    loadedContext = true;
    project.length = tool.length = 1; project.add(new Option(t('Uncategorised'), '__loose__'));
    for (const folder of context.folders) project.add(new Option(folder.name, folder.id));
    if (selectedProject && !Array.from(project.options).some(option => option.value === selectedProject)) project.add(new Option(t('Unavailable project'), selectedProject));
    for (const entry of context.tools!) { toolNames.set(entry.id, entry.name); tool.add(new Option(entry.name, entry.id)); }
    if (selectedTool && !toolNames.has(selectedTool)) tool.add(new Option(selectedTool, selectedTool));
    project.value = selectedProject; tool.value = selectedTool; projectPicker.refresh(); toolPicker.refresh();
  };
  refresh.addEventListener('click', () => { void updateContext().then(() => { if (!disposed) { reload(); void measure(); } }).catch(fail); });
  view._cleanup = () => { disposed = true; generation++; clearTimeout(timer); closePanel?.(); menu.destroy(); unbindEscape(); projectPicker.dispose(); toolPicker.dispose(); previews.dispose(); currentRows.clear(); selected.clear(); };
  // The History-open sweep (plan 277 P4 section 5): discarded never-saved creations
  // and protected drafts older than 30 days go for good before the first listing.
  // A sweep that fails leaves them for the next visit; History still opens.
  const sweep = state.history?.sweep().catch(() => undefined);
  try { await updateContext(); await sweep; if (!disposed) { await load(); void measure(); const detailSlot = query.get('_detail'); if (detailSlot && detailSlot.length <= 512) versions({ slot: detailSlot }); } } catch (error) { fail(error); }
}
