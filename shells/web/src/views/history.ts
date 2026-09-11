// SPDX-License-Identifier: MPL-2.0
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { WebStateAPI } from '../bridge/state.ts';
import type { AppHistoryContext, AppHistoryRow, AppHistoryView, AppHistoryQuery } from '../bridge/app-history.ts';
import type { Folder } from '../folders.ts';
import { backHomeHtml, mountBackPill } from '../components/back-pill.ts';
import { mountHomeFab } from '../components/home-fab.ts';
import { createHistoryPreviews } from '../components/history-previews.ts';
import { openHistoryPanel } from '../components/history-panel.ts';
import { bindHistoryLink } from '../lib/history-navigation.ts';
import { sessionOpenHref } from '../lib/search/projects-source.ts';
import { isBatchSlot } from '../lib/batch-slots.ts';
import { historyPeriods } from '../lib/history-periods.ts';
import { SEARCH_DEBOUNCE_MS } from '../lib/search/match.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import './history.css';

const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag); if (text) el.textContent = text; if (className) el.className = className; return el;
};
const button = (text: string): HTMLButtonElement => { const el = element('button', t(text), 'btn'); el.type = 'button'; return el; };
const link = (text: string, href: string): HTMLAnchorElement => { const el = element('a', t(text), 'btn'); el.href = href; return el; };

/** Route-backed app History, with the same creation panel used by editors. Only
 * the device capability may open its stores; shared mounts never feed this index. */
export async function mountHistory(view: HTMLElement & { _cleanup?: () => void }, host: HostV1, params = ''): Promise<void> {
  const state = host.state as WebStateAPI, activity = state.history?.activity;
  let disposed = false, generation = 0, closePanel: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  view.innerHTML = backHomeHtml(); mountBackPill(view); mountHomeFab(view);
  const workspace = element('section', undefined, 'app-history'); workspace.setAttribute('aria-label', t('History workspace'));
  const header = element('header'), title = element('h1', t('History'));
  const description = element('p', t('Pick up a creation or revisit the work that led to it.'));
  const source = element('span', t('This device'), 'app-history-source');
  const refresh = button('Refresh');
  header.append(title, source, refresh, link('Open Projects', '#/p'), description); workspace.append(header); view.append(workspace);
  document.title = `${t('History')} - Lolly`;
  if (!activity) { workspace.append(element('p', t('App history is not available in this session. Open Projects to find your saved creations.'))); refresh.hidden = true; return; }
  const query = new URLSearchParams(params);
  let active: AppHistoryView = query.get('view') === 'changes' ? 'changes' : query.get('view') === 'milestones' ? 'milestones' : 'recent';
  const tabs = element('nav'); tabs.setAttribute('aria-label', t('History views'));
  const tabButtons = new Map<AppHistoryView, HTMLButtonElement>();
  for (const [id, caption] of [['recent', 'Recent'], ['changes', 'Changes'], ['milestones', 'Milestones']] as const) {
    const tab = button(caption); tab.dataset.historyView = id; tabs.append(tab); tabButtons.set(id, tab);
    tab.addEventListener('click', () => { active = id; reload(); });
  }
  const filters = element('form', undefined, 'app-history-filters'); filters.setAttribute('aria-label', t('Filter history'));
  const search = element('input', undefined, 'field-input'); search.type = 'search'; search.maxLength = 200;
  search.placeholder = t('Search creations, projects and milestones'); search.setAttribute('aria-label', t('Search history')); search.value = query.get('q') ?? '';
  const select = (label: string, caption: string): HTMLSelectElement => {
    const el = element('select', undefined, 'field-select'); el.setAttribute('aria-label', t(label)); el.add(new Option(t(caption), '')); return el;
  };
  const project = select('Filter by project', 'All projects'), tool = select('Filter by tool', 'All tools');
  const dates = element('details'), dateSummary = element('summary', t('Dates')); dates.append(dateSummary);
  const dateField = (label: string): HTMLInputElement => {
    const wrap = element('label', t(label)), input = element('input', undefined, 'field-input'); input.type = 'date'; input.setAttribute('aria-label', t(label)); wrap.append(input); dates.append(wrap); return input;
  };
  const from = dateField('From date'), to = dateField('To date'); from.value = query.get('from') ?? ''; to.value = query.get('to') ?? '';
  dates.open = !!(from.value || to.value);
  const reset = button('Clear filters'); filters.append(search, project, tool, dates, reset);
  const status = element('p', undefined, 'app-history-status'); status.setAttribute('role', 'status');
  const content = element('div', undefined, 'app-history-content'), main = element('div', undefined, 'app-history-main');
  const list = element('div', undefined, 'app-history-list'); list.setAttribute('aria-label', t('History entries'));
  const pagination = element('div', undefined, 'app-history-pagination'), newer = button('Newer'), older = button('Older'); pagination.append(newer, older);
  const detail = element('aside', undefined, 'app-history-detail'); detail.setAttribute('aria-label', t('Creation history'));
  const note = element('p', undefined, 'app-history-note');
  main.append(list, pagination, note); content.append(main, detail); workspace.append(tabs, filters, status, content);
  const previews = createHistoryPreviews(list, rowId => {
    const row = currentRows.get(rowId); return row ? activity.preview(row) : Promise.resolve(null);
  });
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
  };
  const versions = (row: AppHistoryRow): void => {
    closePanel?.(); workspace.classList.add('has-detail');
    closePanel = openHistoryPanel({ state, slot: () => row.slot ?? null, container: detail,
      onClose: () => workspace.classList.remove('has-detail'), onNamed: () => { void load(); } });
  };
  const renderRow = (row: AppHistoryRow): HTMLElement => {
    const article = element('article', undefined, 'app-history-row'); article.dataset.historyId = row.id;
    const cover = element('div', undefined, 'app-history-cover'); cover.innerHTML = icon(row.kind === 'export' ? 'download' : row.kind === 'batch' ? 'grid' : 'history');
    cover.setAttribute('aria-hidden', 'true');
    const image = element('img'); image.alt = ''; image.hidden = true; cover.append(image); previews.add(row.id, article, image);
    const text = element('div', undefined, 'app-history-caption');
    text.append(element('h3', row.milestone || row.title));
    const kind = row.kind === 'creation' ? t('Creation') : row.kind === 'revision' ? t('Milestone') : row.kind === 'export' ? t('Exported') : row.kind === 'batch' ? t('Batch') : t('File operation');
    const caption = row.kind === 'revision' && !row.milestone ? t('Checkpoint') : kind;
    text.append(element('p', [caption, toolNames.get(row.toolId) || row.toolId, row.project, row.format?.toUpperCase()].filter(Boolean).join(' · ')));
    if (row.milestone) text.append(element('p', row.title));
    if (row.counts) text.append(element('p', `${row.counts.succeeded} ${t('ready')} · ${row.counts.failed} ${t('failed')} · ${row.counts.cancelled} ${t('cancelled')}${row.counts.partially_succeeded ? ` · ${row.counts.partially_succeeded} ${t('partial')}` : ''}${row.counts.pending ? ` · ${row.counts.pending} ${t('pending')}` : ''}`));
    if (row.state) text.append(element('p', t(({ succeeded: 'Ready to download', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', running: 'Running' } as Record<string, string>)[row.state] ?? row.state)));
    const time = element('time', new Date(row.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })); time.dateTime = row.at;
    const actions = element('div', undefined, 'app-history-row-actions');
    if (row.kind === 'creation' && row.slot) {
      const resume = link('Resume', sessionOpenHref({ slot: row.slot, toolId: row.toolId }, isBatchSlot(row.slot))); bindHistoryLink(resume); actions.append(resume);
    }
    if ((row.kind === 'creation' || row.kind === 'revision') && row.slot) {
      const open = button('Versions'); open.addEventListener('click', () => versions(row)); actions.append(open);
      actions.append(link('Show in Projects', row.projectId ? `#/p/${encodeURIComponent(row.projectId)}` : '#/p'));
    } else if (row.kind === 'export') {
      const reopen = button('Reopen settings');
      reopen.addEventListener('click', async () => {
        reopen.disabled = true;
        try {
          const href = await activity.reopenExport(row.ref);
          if (!href) throw new Error(t('This export is no longer in the recent download log.'));
          if (!disposed) { const { navigateHistoryHref } = await import('../lib/history-navigation.ts'); navigateHistoryHref(href); }
        } catch (error) { fail(error); } finally { reopen.disabled = false; }
      }); actions.append(reopen);
    } else if (row.kind === 'operation' || row.kind === 'batch') actions.append(link('View results', `#/convert?${row.kind === 'batch' ? 'batch' : 'history'}=${encodeURIComponent(row.ref)}`));
    text.append(time); article.append(cover, text, actions); return article;
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
      const days = new Map<string, HTMLDetailsElement>();
      for (const period of active === 'changes' ? historyPeriods(page.entries) : page.entries.map(row => [row])) {
        const first = period[0]!;
        const day = new Date(first.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        let group = days.get(day);
        if (!group) { group = element('details', undefined, 'app-history-day'); group.open = true; group.append(element('summary', day)); days.set(day, group); list.append(group); }
        if (period.length > 1) {
          const edits = element('details', undefined, 'app-history-period'); edits.open = false;
          const summary = element('summary');
          const cover = element('img'); cover.alt = ''; cover.hidden = true;
          previews.add(first.id, summary, cover);
          summary.append(cover, document.createTextNode(`${first.title} · ${period.length} ${t('checkpoints')}`)); edits.append(summary);
          for (const row of period) edits.append(renderRow(row)); group.append(edits);
        } else group.append(renderRow(first));
      }
      next = page.before; older.hidden = !next; newer.hidden = !before;
      status.textContent = page.entries.length ? '' : next ? t('No matches in this period. Choose Older to keep searching.') : active === 'recent' ? t('Saved creations appear here as you work. Start a tool or open Projects.') : t('No matching history yet.');
      note.textContent = active === 'changes'
        ? t('Nearby retained checkpoints are grouped into editing periods on each page. Exports reopen settings; saved file results include their reports. Project filters use current membership.')
        : active === 'milestones' ? t('Named versions are kept alongside each creation. Open Versions to compare or make a copy.')
          : t('One row per saved creation, ordered by its latest save or reopen. Automatic checkpoints cover Design, Gradient, Chart, Snippet, QR Code, Flow Chart, Pricing and Wordmark. Work and peer checkpoints are available inside their collaboration sessions.');
    } catch (error) { if (token === generation) fail(error); }
    finally { if (!disposed && token === generation) { older.disabled = newer.disabled = false; list.setAttribute('aria-busy', 'false'); } }
  };
  function reload(): void { clearTimeout(timer); before = undefined; pages.length = 0; closePanel?.(); void load(); }
  filters.addEventListener('submit', event => { event.preventDefault(); reload(); });
  search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(reload, SEARCH_DEBOUNCE_MS); });
  for (const input of [project, tool, from, to]) input.addEventListener('change', reload);
  reset.addEventListener('click', () => { search.value = project.value = tool.value = from.value = to.value = ''; reload(); });
  older.addEventListener('click', () => { pages.push(before); before = next; void load(); list.scrollTop = 0; });
  newer.addEventListener('click', () => { before = pages.pop(); void load(); list.scrollTop = 0; });
  let loadedContext = false;
  const updateContext = async (): Promise<void> => {
    const profile = await host.profile.get() as { folders?: Folder[] };
    if (disposed) return;
    const catalog = (window as typeof window & { __toolIndex?: { tools?: Array<{ id: string; name: string }> } }).__toolIndex;
    context = { folders: profile.folders ?? [], tools: [...(catalog?.tools ?? []), { id: 'convert', name: t('Convert') }] };
    const selectedProject = loadedContext ? project.value : query.get('project') || '', selectedTool = loadedContext ? tool.value : query.get('tool') || '';
    loadedContext = true;
    project.length = tool.length = 1; project.add(new Option(t('Uncategorised'), '__loose__'));
    for (const folder of context.folders) project.add(new Option(folder.name, folder.id));
    if (selectedProject && !Array.from(project.options).some(option => option.value === selectedProject)) project.add(new Option(t('Unavailable project'), selectedProject));
    for (const entry of context.tools!) { toolNames.set(entry.id, entry.name); tool.add(new Option(entry.name, entry.id)); }
    if (selectedTool && !toolNames.has(selectedTool)) tool.add(new Option(selectedTool, selectedTool));
    project.value = selectedProject; tool.value = selectedTool;
  };
  refresh.addEventListener('click', () => { void updateContext().then(() => { if (!disposed) reload(); }).catch(fail); });
  view._cleanup = () => { disposed = true; generation++; clearTimeout(timer); closePanel?.(); previews.dispose(); currentRows.clear(); };
  try { await updateContext(); if (!disposed) await load(); } catch (error) { fail(error); }
}
