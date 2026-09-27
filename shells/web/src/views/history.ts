// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { AppHistoryContext, AppHistoryRow, AppHistoryView, AppHistoryQuery } from '../bridge/app-history.ts';
import type { Folder } from '../folders.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { createHistoryPreviews } from '../components/history-previews.ts';
import { openHistoryPanel } from '../components/history-panel.ts';
import { historyPeriods } from '../lib/history-periods.ts';
import { icon } from '../lib/icons.ts';
import { SEARCH_DEBOUNCE_MS } from '../lib/search/match.ts';
import { t } from '../i18n.ts';
import { isTauriShell } from '../lib/instance-choice.ts';
import { historyFilterPicker } from './history-filter-picker.ts';
import { historyElement as element, historyButton as button, historyLink as link, historyIcon, historyAction, historyDayKey, historyDay, historyPeriod, type HistoryTimelineContext } from './history-timeline.ts';
import './history.css';

/** Route-backed app History, with the same creation panel used by editors. Only
 * the device capability may open its stores; shared mounts never feed this index. */
export async function mountHistory(view: HTMLElement & { _cleanup?: () => void }, host: HostV1, params = '', onRemember?: () => void): Promise<void> {
  const state = host.state as WebStateAPI, activity = state.history?.activity;
  let disposed = false, generation = 0, closePanel: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  view.innerHTML = backHomeHtml(); mountBackPill(view); mountHomeFab(view);
  const workspace = element('section', undefined, 'app-history'); workspace.setAttribute('aria-label', t('History workspace'));
  const header = element('header', undefined, 'app-history-header');
  const intro = element('div', undefined, 'app-history-intro');
  const title = element('h1', t('History'));
  const description = element('p', t('Pick up a creation or revisit the work that led to it.'), 'app-history-description');
  const source = element('span', undefined, 'app-history-source'); source.append(historyIcon('monitor'), element('span', isTauriShell() ? t('This device') : t('This browser')));
  const heading = element('div', undefined, 'app-history-heading'); heading.append(title, source);
  intro.append(heading, description);
  const headerActions = element('div', undefined, 'app-history-header-actions');
  const refresh = button('Refresh', 'refresh', true), projects = link('Open Projects', '#/p', 'folder');
  headerActions.append(refresh, projects); header.append(intro, headerActions); workspace.append(header); view.append(workspace);
  document.title = `${t('History')} - Lolly`;
  if (!activity) { workspace.append(element('p', t('App history is not available in this session. Open Projects to find your saved creations.'))); refresh.hidden = true; return; }
  const query = new URLSearchParams(params);
  let active: AppHistoryView = query.get('view') === 'changes' ? 'changes' : query.get('view') === 'milestones' ? 'milestones' : 'recent';
  const controls = element('section', undefined, 'app-history-controls');
  const tabs = element('nav', undefined, 'app-history-tabs'); tabs.setAttribute('aria-label', t('History views'));
  const tabButtons = new Map<AppHistoryView, HTMLButtonElement>();
  for (const [id, caption] of [['recent', 'Recent'], ['changes', 'Changes'], ['milestones', 'Milestones']] as const) {
    const tab = button(caption, id === 'recent' ? 'clock' : id === 'changes' ? 'history' : 'star'); tab.dataset.historyView = id; tabs.append(tab); tabButtons.set(id, tab);
    tab.addEventListener('click', () => { active = id; reload(); });
  }
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
  const dates = element('details', undefined, 'app-history-date-filter'), dateSummary = element('summary');
  dateSummary.append(historyIcon('calendar'), element('span', t('Dates')), historyIcon('chevronDown'));
  dates.append(dateSummary);
  const dateFields = element('div', undefined, 'app-history-date-fields');
  const dateField = (label: string): HTMLInputElement => {
    const input = element('input', undefined, 'field-input'); input.type = 'date'; input.setAttribute('aria-label', t(label)); dateFields.append(field(label, input)); return input;
  };
  const from = dateField('From date'), to = dateField('To date'); from.value = query.get('from') ?? ''; to.value = query.get('to') ?? '';
  dates.append(dateFields); dates.open = !!(from.value || to.value);
  const reset = button('Clear filters', 'close'); reset.classList.add('btn--ghost');
  const filterToggle = button('Filters', 'sliders'); filterToggle.classList.add('app-history-filter-toggle');
  const filterOptions = element('div', undefined, 'app-history-filter-options'); filterOptions.id = 'history-filter-options';
  filterOptions.append(field('Project', projectPicker.trigger), field('Tool', toolPicker.trigger), project, tool, dates, reset);
  const expandFilters = (open: boolean): void => { filters.classList.toggle('is-expanded', open); filterToggle.setAttribute('aria-expanded', String(open)); };
  filterToggle.setAttribute('aria-controls', filterOptions.id);
  expandFilters(!!(query.get('project') || query.get('tool') || from.value || to.value));
  filterToggle.addEventListener('click', () => expandFilters(!filters.classList.contains('is-expanded')));
  filters.append(searchWrap, filterToggle, filterOptions);
  controls.append(tabs, filters);
  const status = element('p', undefined, 'app-history-status'); status.setAttribute('role', 'status');
  const overview = element('div', undefined, 'app-history-overview');
  const overviewText = element('div'), sectionTitle = element('h2', t('Your recent creations'));
  const count = element('p', undefined, 'app-history-count'); overviewText.append(sectionTitle, count);
  const foldDates = button('Collapse dates', 'layers'); foldDates.classList.add('btn--ghost');
  overview.append(overviewText, foldDates);
  const content = element('div', undefined, 'app-history-content'), main = element('div', undefined, 'app-history-main');
  const list = element('div', undefined, 'app-history-list'); list.setAttribute('aria-label', t('History entries'));
  const pagination = element('div', undefined, 'app-history-pagination'), newer = button('Newer', 'arrowLeft'), older = button('Older', 'arrowRight'); pagination.append(newer, older);
  const detail = element('aside', undefined, 'app-history-detail'); detail.setAttribute('aria-label', t('Creation history'));
  const note = element('p', undefined, 'app-history-note');
  main.append(list, pagination, note); content.append(main, detail); workspace.append(controls, overview, status, content);
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
  const previews = createHistoryPreviews(list, rowId => {
    const row = currentRows.get(rowId); return row ? activity.preview(row) : Promise.resolve(null);
  }, { viewport: true });
  let currentRows = new Map<string, AppHistoryRow>();
  let before: string | undefined = query.get('before') || undefined, next: string | undefined;
  const pages: Array<string | undefined> = [];
  let context: AppHistoryContext = { folders: [] };
  const toolNames = new Map<string, string>();
  const fail = (error: unknown): void => { if (!disposed) status.textContent = error instanceof Error ? error.message : t('Could not load history.'); };
  const remember = (): void => {
    const next = new URLSearchParams();
    for (const [key, value] of [['view', active === 'recent' ? '' : active], ['project', project.value], ['tool', tool.value], ['q', search.value], ['from', from.value], ['to', to.value], ['before', before ?? '']]) if (value) next.set(key!, value);
    // Filters and paging are workspace state, not dozens of Back stops. The
    // entry survives browser Back from a resumed tool and reloads with its page.
    window.history.replaceState(window.history.state, '', `#/history${next.size ? `?${next}` : ''}`);
    onRemember?.();
  };
  const versions = (row: AppHistoryRow): void => {
    closePanel?.(); workspace.classList.add('has-detail');
    closePanel = openHistoryPanel({ state, slot: () => row.slot ?? null, container: detail,
      onClose: () => workspace.classList.remove('has-detail'), onNamed: () => { void load(); } });
  };
  const timeline: HistoryTimelineContext = {
    toolNames, preview: previews.add, versions,
    reopen: async (row, reopen) => {
      reopen.disabled = true;
      try {
        const href = await activity.reopenExport(row.ref);
        if (!href) throw new Error(t('This export is no longer in the recent download log.'));
        if (!disposed) { const { navigateHistoryHref } = await import('../lib/history-navigation.ts'); navigateHistoryHref(href); }
      } catch (error) { fail(error); } finally { reopen.disabled = false; }
    },
  };
  const load = async (): Promise<void> => {
    const token = ++generation; status.textContent = t('Loading history…'); older.disabled = newer.disabled = true; list.setAttribute('aria-busy', 'true');
    remember();
    for (const [id, tab] of tabButtons) tab.setAttribute('aria-pressed', String(id === active));
    const options: AppHistoryQuery = { view: active, search: search.value, project: project.value, toolId: tool.value, before,
      from: from.value ? new Date(`${from.value}T00:00:00`).toISOString() : undefined,
      to: to.value ? new Date(`${to.value}T23:59:59.999`).toISOString() : undefined };
    try {
      const page = await activity.list(options, context);
      if (disposed || token !== generation) return;
      previews.clear(); currentRows = new Map(page.entries.map(row => [row.id, row])); list.replaceChildren();
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
      foldDates.hidden = !days.size; updateFoldAction();
      sectionTitle.textContent = t(active === 'recent' ? 'Your recent creations' : active === 'changes' ? 'The story of your work' : 'Moments worth keeping');
      const entryCount = page.entries.length === 1 ? t('1 entry') : t('{count} entries', { count: page.entries.length });
      const dateCount = days.size === 1 ? t('1 day') : t('{count} days', { count: days.size });
      count.textContent = page.entries.length ? t('{entries} · {days} on this page', { entries: entryCount, days: dateCount }) : '';
      const filtered = !!(search.value || project.value || tool.value || from.value || to.value);
      reset.hidden = !filtered;
      const filterCount = [project.value, tool.value, from.value || to.value].filter(Boolean).length;
      historyAction(filterToggle, 'Filters', 'sliders');
      if (filterCount) filterToggle.append(element('span', String(filterCount), 'app-history-filter-count'));
      if (!page.entries.length) {
        const empty = element('section', undefined, 'app-history-empty');
        empty.append(historyIcon(filtered ? 'search' : active === 'milestones' ? 'star' : 'history'));
        empty.append(element('h3', t(page.before ? 'Nothing in this period' : filtered ? 'No matching history' : active === 'milestones' ? 'Keep the moments that matter' : 'Your story starts here')));
        empty.append(element('p', t(page.before ? 'Choose Older to continue through your history.' : filtered ? 'Try another search or clear your filters to see more of your work.' : active === 'milestones' ? 'Name a version from a creation’s history to find it here.' : 'As you create and save, your work will find a place on this timeline.')));
        if (filtered) { const clear = button('Clear filters', 'close'); clear.addEventListener('click', () => reset.click()); empty.append(clear); }
        else if (!page.before) { const start = link('Explore tools', '#/', 'arrowRight'); start.classList.add('btn--primary'); empty.append(start); }
        list.append(empty);
      }
      next = page.before; older.hidden = !next; newer.hidden = !before; pagination.hidden = !next && !before;
      status.textContent = !page.entries.length && next ? t('No matches in this period. Choose Older to keep searching.') : '';
      note.textContent = t(active === 'changes'
        ? 'Checkpoints, exports and file results, gathered in one timeline. Open an editing period to explore its versions.'
        : active === 'milestones' ? 'Named versions stay with their creation. Open Versions to compare them or make a copy.'
          : 'Your latest saved creations. Resume one to keep going, or open Versions to see how it took shape.');
    } catch (error) { if (token === generation) fail(error); }
    finally { if (!disposed && token === generation) { older.disabled = newer.disabled = false; list.setAttribute('aria-busy', 'false'); } }
  };
  function reload(): void { clearTimeout(timer); before = undefined; pages.length = 0; closePanel?.(); void load(); }
  filters.addEventListener('submit', event => { event.preventDefault(); reload(); });
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(reload, SEARCH_DEBOUNCE_MS); });
  for (const input of [project, tool, from, to]) input.addEventListener('change', reload);
  reset.addEventListener('click', () => { search.value = project.value = tool.value = from.value = to.value = ''; projectPicker.refresh(); toolPicker.refresh(); dates.open = false; expandFilters(false); reload(); });
  older.addEventListener('click', () => { pages.push(before); before = next; void load(); overview.scrollIntoView({ block: 'start' }); });
  newer.addEventListener('click', () => { before = pages.pop(); void load(); overview.scrollIntoView({ block: 'start' }); });
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
  refresh.addEventListener('click', () => { void updateContext().then(() => { if (!disposed) reload(); }).catch(fail); });
  view._cleanup = () => { disposed = true; generation++; clearTimeout(timer); closePanel?.(); projectPicker.dispose(); toolPicker.dispose(); previews.dispose(); currentRows.clear(); };
  try { await updateContext(); if (!disposed) await load(); } catch (error) { fail(error); }
}
