// SPDX-License-Identifier: MPL-2.0
import type { AppHistoryRow } from '../bridge/app-history.ts';
import { bindHistoryLink } from '../lib/history-navigation.ts';
import { sessionOpenHref } from '../lib/search/projects-source.ts';
import { isBatchSlot, isDiscardedSlot } from '../lib/batch-slots.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';

type Glyph = Parameters<typeof icon>[0];
export const historyElement = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  if (className) el.className = className;
  return el;
};

export function historyIcon(name: Glyph, className = 'app-history-icon'): HTMLElement {
  const el = historyElement('span', undefined, className);
  el.innerHTML = icon(name);
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function historyAction<T extends HTMLButtonElement | HTMLAnchorElement>(el: T, label: string, glyph: Glyph, iconOnly = false): T {
  el.classList.add('app-history-action');
  el.replaceChildren(historyIcon(glyph), historyElement('span', t(label), iconOnly ? 'visually-hidden' : undefined));
  if (iconOnly) { el.classList.add('app-history-action--icon'); el.title = t(label); }
  return el;
}

export function historyButton(label: string, glyph: Glyph, iconOnly = false): HTMLButtonElement {
  const el = historyElement('button', undefined, 'btn'); el.type = 'button';
  return historyAction(el, label, glyph, iconOnly);
}

export function historyLink(label: string, href: string, glyph: Glyph, iconOnly = false): HTMLAnchorElement {
  const el = historyElement('a', undefined, 'btn'); el.href = href;
  return historyAction(el, label, glyph, iconOnly);
}

export function historyDayKey(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function historyDayLabel(at: string, now = new Date()): string {
  if (historyDayKey(at) === historyDayKey(now.toISOString())) return t('Today');
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  if (historyDayKey(at) === historyDayKey(yesterday.toISOString())) return t('Yesterday');
  return new Date(at).toLocaleDateString(undefined, { weekday: 'long' });
}

const kinds: Record<AppHistoryRow['kind'], { label: string; glyph: Glyph }> = {
  creation: { label: 'Creation', glyph: 'image' },
  revision: { label: 'Checkpoint', glyph: 'history' },
  export: { label: 'Exported', glyph: 'download' },
  operation: { label: 'File operation', glyph: 'convert' },
  batch: { label: 'Batch', glyph: 'grid' },
};

export interface HistoryTimelineContext {
  toolNames: ReadonlyMap<string, string>;
  preview(id: string, node: HTMLElement, image: HTMLImageElement): void;
  versions(row: AppHistoryRow): void;
  reopen(row: AppHistoryRow, button: HTMLButtonElement): void;
}

/** A creation keeps one prominent next step; supporting actions stay close by. */
export function historyRow(ctx: HistoryTimelineContext, row: AppHistoryRow): HTMLElement {
  const article = historyElement('article', undefined, 'app-history-row'); article.dataset.historyId = row.id;
  article.dataset.kind = row.milestone ? 'milestone' : row.kind;
  const kind = row.milestone ? { label: 'Milestone', glyph: 'star' as const } : kinds[row.kind];
  const cover = historyElement('div', undefined, 'app-history-cover'); cover.append(historyIcon(kind.glyph));
  cover.setAttribute('aria-hidden', 'true');
  const image = historyElement('img'); image.alt = ''; image.hidden = true; cover.append(image); ctx.preview(row.id, article, image);
  const text = historyElement('div', undefined, 'app-history-caption');
  const meta = historyElement('div', undefined, 'app-history-entry-meta');
  const badge = historyElement('span', undefined, 'app-history-kind'); badge.append(historyIcon(kind.glyph), historyElement('span', t(kind.label)));
  const time = historyElement('time', new Date(row.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }));
  time.dateTime = row.at; time.title = new Date(row.at).toLocaleString();
  meta.append(badge, time);
  const title = historyElement('h3', row.milestone || row.title);
  const metadata = historyElement('div', undefined, 'app-history-entry-context');
  metadata.append(historyElement('span', ctx.toolNames.get(row.toolId) || row.toolId, 'app-history-tool'));
  if (row.project) {
    const project = historyLink(row.project, row.projectId ? `#/p/${encodeURIComponent(row.projectId)}` : '#/p', 'folder');
    project.className = 'app-history-project'; project.title = row.project; project.lastElementChild!.textContent = row.project; metadata.append(project);
  }
  if (row.format) metadata.append(historyElement('span', row.format.toUpperCase(), 'app-history-format'));
  text.append(meta, title);
  if (row.milestone) text.append(historyElement('p', row.title, 'app-history-original-title'));
  text.append(metadata);
  if (row.counts) text.append(historyElement('p', `${row.counts.succeeded} ${t('ready')} · ${row.counts.failed} ${t('failed')} · ${row.counts.cancelled} ${t('cancelled')}${row.counts.partially_succeeded ? ` · ${row.counts.partially_succeeded} ${t('partial')}` : ''}${row.counts.pending ? ` · ${row.counts.pending} ${t('pending')}` : ''}`, 'app-history-result'));
  if (row.state) {
    const result = historyElement('p', t(({ succeeded: 'Ready to download', failed: 'Failed', cancelled: 'Cancelled', interrupted: 'Interrupted', running: 'Running' } as Record<string, string>)[row.state] ?? row.state), 'app-history-result');
    result.dataset.state = row.state; text.append(result);
  }
  const actions = historyElement('div', undefined, 'app-history-row-actions');
  actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', t('Actions for {title}', { title: row.milestone || row.title }));
  if (row.kind === 'creation' && row.slot) {
    const resume = historyLink('Resume', sessionOpenHref({ slot: row.slot, toolId: row.toolId }, isBatchSlot(row.slot)), 'arrowRight');
    resume.classList.add('btn--primary'); bindHistoryLink(resume); actions.append(resume);
  }
  if ((row.kind === 'creation' || row.kind === 'revision') && row.slot) {
    const versions = historyButton('Versions', 'history', row.kind === 'creation');
    if (row.kind === 'revision') versions.classList.add('btn--primary');
    versions.addEventListener('click', () => ctx.versions(row)); actions.append(versions);
    // A discarded creation is no longer in Projects; its versions are all that remain.
    if (!isDiscardedSlot(row.slot)) actions.append(historyLink('Show in Projects', row.projectId ? `#/p/${encodeURIComponent(row.projectId)}` : '#/p', 'folder', true));
  } else if (row.kind === 'export') {
    const reopen = historyButton('Reopen settings', 'sliders'); reopen.classList.add('btn--primary');
    reopen.addEventListener('click', () => ctx.reopen(row, reopen)); actions.append(reopen);
  } else if (row.kind === 'operation' || row.kind === 'batch') {
    const results = historyLink('View results', `#/convert?${row.kind === 'batch' ? 'batch' : 'history'}=${encodeURIComponent(row.ref)}`, 'arrowRight');
    results.classList.add('btn--primary'); actions.append(results);
  }
  article.append(cover, text, actions);
  return article;
}

/** A date is a complete, keyboard-operable chapter even while its entries are folded. */
export function historyDay(at: string, rows: AppHistoryRow[], open: boolean): { group: HTMLDetailsElement; body: HTMLElement } {
  const date = new Date(at), key = historyDayKey(at);
  const group = historyElement('details', undefined, 'app-history-day'); group.open = open; group.dataset.day = key;
  const summary = historyElement('summary', undefined, 'app-history-day-summary');
  const calendar = historyElement('span', undefined, 'app-history-calendar'); calendar.setAttribute('aria-hidden', 'true');
  calendar.append(historyElement('span', date.toLocaleDateString(undefined, { month: 'short' })), historyElement('strong', date.toLocaleDateString(undefined, { day: 'numeric' })));
  const heading = historyElement('div', undefined, 'app-history-day-heading');
  const title = historyElement('h2', historyDayLabel(at)); title.id = `history-day-${key}`;
  heading.append(title, historyElement('span', date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }), 'app-history-day-date'));
  const count = historyElement('span', rows.length === 1 ? t('1 entry') : t('{count} entries', { count: rows.length }), 'app-history-day-count');
  summary.append(calendar, heading, count, historyIcon('chevronDown', 'app-history-day-chevron'));
  const body = historyElement('div', undefined, 'app-history-day-entries'); body.setAttribute('role', 'group'); body.setAttribute('aria-labelledby', title.id);
  group.append(summary, body);
  return { group, body };
}

export function historyPeriod(ctx: HistoryTimelineContext, rows: AppHistoryRow[]): HTMLElement {
  const first = rows[0]!;
  if (rows.length === 1) return historyRow(ctx, first);
  const period = historyElement('details', undefined, 'app-history-period');
  const summary = historyElement('summary');
  const heading = historyElement('span', undefined, 'app-history-period-heading');
  heading.append(historyElement('strong', first.title), historyElement('span', t('{count} checkpoints', { count: rows.length })));
  const time = historyElement('time', `${new Date(rows.at(-1)!.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${new Date(first.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`);
  time.dateTime = first.at;
  summary.append(historyIcon('history'), heading, time, historyIcon('chevronDown', 'app-history-day-chevron'));
  const body = historyElement('div', undefined, 'app-history-period-entries');
  for (const row of rows) body.append(historyRow(ctx, row));
  period.append(summary, body);
  return period;
}
